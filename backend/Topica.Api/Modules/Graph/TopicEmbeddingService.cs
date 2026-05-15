using FluxIndex.Core.Application.Interfaces;
using FluxIndex.Core.Application.Utilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Runtime.InteropServices;
using Topica.Api.Modules.AI;
using Topica.Core.Entities;
using Topica.Infrastructure.Data;

namespace Topica.Api.Modules.Graph;

public class TopicEmbeddingService(
    ApplicationDbContext db,
    IOptionsMonitor<AiSettings> options,
    IEmbeddingService embeddingService,
    ILogger<TopicEmbeddingService> logger)
{
    public async Task EmbedTopicAsync(Guid topicId, CancellationToken ct = default)
    {
        var settings = options.CurrentValue;

        var topic = await db.Topics
            .Include(t => t.Tags)
            .FirstOrDefaultAsync(t => t.Id == topicId, ct);
        if (topic is null) return;

        var tagText = topic.Tags.Count > 0 ? string.Join(", ", topic.Tags.Select(t => t.Tag)) : "";
        var text = $"{topic.Title}. {topic.Description} {tagText}".Trim();
        if (string.IsNullOrWhiteSpace(text)) return;

        var activeModel = !string.IsNullOrWhiteSpace(settings.ApiKey)
            ? settings.EmbeddingModel
            : !string.IsNullOrWhiteSpace(settings.OllamaEmbeddingModel)
            ? settings.OllamaEmbeddingModel
            : embeddingService.GetModelName();

        try
        {
            var vector = await embeddingService.GenerateEmbeddingAsync(text, ct);
            var bytes = MemoryMarshal.Cast<float, byte>(vector).ToArray();

            var existing = await db.TopicEmbeddings.FindAsync([topicId], ct);
            if (existing is null)
            {
                db.TopicEmbeddings.Add(new TopicEmbedding
                {
                    TopicId = topicId,
                    Vector = bytes,
                    Model = activeModel,
                    UpdatedAt = DateTime.UtcNow,
                });
            }
            else
            {
                existing.Vector = bytes;
                existing.Model = activeModel;
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

        var expectedDim = targetVec.Length;
        var dimMismatch = all.Where(e => MemoryMarshal.Cast<byte, float>(e.Vector).Length != expectedDim).ToList();
        if (dimMismatch.Count > 0)
            logger.LogWarning("FindSimilar: {Count} topic embedding(s) have dimension mismatch (expected {Dim}d). Re-embed after changing embedding model.", dimMismatch.Count, expectedDim);

        return all
            .Select(e => (e.TopicId, Score: VectorMathUtilities.CosineSimilarity(targetVec, MemoryMarshal.Cast<byte, float>(e.Vector).ToArray())))
            .Where(x => x.Score > 0.5f)
            .OrderByDescending(x => x.Score)
            .Take(top)
            .ToList();
    }
}
