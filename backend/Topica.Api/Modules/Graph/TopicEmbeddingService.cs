using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using OpenAI.Embeddings;
using System.Runtime.InteropServices;
using Topica.Api.Modules.AI;
using Topica.Core.Entities;
using Topica.Infrastructure.Data;

namespace Topica.Api.Modules.Graph;

public class TopicEmbeddingService(ApplicationDbContext db, IOptionsMonitor<AiSettings> options, ILogger<TopicEmbeddingService> logger)
{
    public async Task EmbedTopicAsync(Guid topicId, CancellationToken ct = default)
    {
        var settings = options.CurrentValue;
        if (string.IsNullOrWhiteSpace(settings.ApiKey)) return;

        var topic = await db.Topics
            .Include(t => t.Tags)
            .FirstOrDefaultAsync(t => t.Id == topicId, ct);
        if (topic is null) return;

        var tagText = topic.Tags.Count > 0 ? string.Join(", ", topic.Tags.Select(t => t.Tag)) : "";
        var text = $"{topic.Title}. {topic.Description} {tagText}".Trim();
        if (string.IsNullOrWhiteSpace(text)) return;

        try
        {
            var client = new EmbeddingClient(settings.EmbeddingModel, settings.ApiKey);
            var result = await client.GenerateEmbeddingAsync(text, cancellationToken: ct);
            var vector = result.Value.ToFloats().ToArray();
            var bytes = MemoryMarshal.Cast<float, byte>(vector).ToArray();

            var existing = await db.TopicEmbeddings.FindAsync([topicId], ct);
            if (existing is null)
            {
                db.TopicEmbeddings.Add(new TopicEmbedding
                {
                    TopicId = topicId,
                    Vector = bytes,
                    Model = settings.EmbeddingModel,
                    UpdatedAt = DateTime.UtcNow,
                });
            }
            else
            {
                existing.Vector = bytes;
                existing.Model = settings.EmbeddingModel;
                existing.UpdatedAt = DateTime.UtcNow;
            }

            await db.SaveChangesAsync(ct);
            logger.LogInformation("Embedded topic {TopicId}", topicId);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Topic embedding failed for {TopicId}", topicId);
        }
    }

    public async Task<List<(Guid TopicId, float Score)>> FindSimilarAsync(Guid topicId, int top = 5, CancellationToken ct = default)
    {
        var target = await db.TopicEmbeddings.FindAsync([topicId], ct);
        if (target is null || target.Vector.Length == 0) return [];

        var targetVec = MemoryMarshal.Cast<byte, float>(target.Vector).ToArray();

        var all = await db.TopicEmbeddings
            .Where(e => e.TopicId != topicId)
            .ToListAsync(ct);

        return all
            .Select(e => (e.TopicId, Score: CosineSimilarity(targetVec, MemoryMarshal.Cast<byte, float>(e.Vector).ToArray())))
            .Where(x => x.Score > 0.5f)
            .OrderByDescending(x => x.Score)
            .Take(top)
            .ToList();
    }

    private static float CosineSimilarity(float[] a, float[] b)
    {
        if (a.Length != b.Length) return 0f;
        float dot = 0, normA = 0, normB = 0;
        for (int i = 0; i < a.Length; i++)
        {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        float denom = (float)(Math.Sqrt(normA) * Math.Sqrt(normB));
        return denom == 0f ? 0f : dot / denom;
    }
}
