using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using OpenAI.Embeddings;
using System.Runtime.InteropServices;
using Topica.Api.Modules.AI;
using Topica.Core.Entities;
using Topica.Infrastructure.Data;

namespace Topica.Api.Modules.RAG;

public sealed class RagService(IOptionsMonitor<AiSettings> options, ILogger<RagService> logger)
{
    public async Task IndexTopicAsync(Guid topicId, IEnumerable<ResearchDoc> docs, ApplicationDbContext db, CancellationToken ct = default)
    {
        var settings = options.CurrentValue;
        if (string.IsNullOrWhiteSpace(settings.ApiKey)) return;

        var chunks = docs
            .Where(d => !string.IsNullOrWhiteSpace(d.Content))
            .Select((d, i) => (Text: d.Content, Index: i))
            .ToList();

        if (chunks.Count == 0) return;

        try
        {
            var client = new EmbeddingClient(settings.EmbeddingModel, settings.ApiKey);

            var existing = await db.ResearchChunkEmbeddings
                .Where(e => e.TopicId == topicId)
                .ToListAsync(ct);
            db.ResearchChunkEmbeddings.RemoveRange(existing);

            foreach (var (text, index) in chunks)
            {
                var result = await client.GenerateEmbeddingAsync(text, cancellationToken: ct);
                var vector = result.Value.ToFloats().ToArray();

                db.ResearchChunkEmbeddings.Add(new ResearchChunkEmbedding
                {
                    TopicId = topicId,
                    ChunkText = text,
                    Vector = ToBytes(vector),
                    Model = settings.EmbeddingModel,
                    ChunkIndex = index,
                });
            }

            await db.SaveChangesAsync(ct);
            logger.LogInformation("Indexed {Count} chunks for topic {TopicId}", chunks.Count, topicId);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "RAG indexing failed for topic {TopicId}", topicId);
        }
    }

    public async Task<List<string>> SearchAsync(Guid topicId, string query, ApplicationDbContext db, int top = 5, CancellationToken ct = default)
    {
        var settings = options.CurrentValue;
        if (string.IsNullOrWhiteSpace(settings.ApiKey)) return [];

        try
        {
            var client = new EmbeddingClient(settings.EmbeddingModel, settings.ApiKey);
            var queryResult = await client.GenerateEmbeddingAsync(query, cancellationToken: ct);
            var queryVec = queryResult.Value.ToFloats().ToArray();

            var embeddings = await db.ResearchChunkEmbeddings
                .Where(e => e.TopicId == topicId)
                .ToListAsync(ct);

            if (embeddings.Count == 0) return [];

            return embeddings
                .Select(e => (e.ChunkText, Score: CosineSimilarity(queryVec, FromBytes(e.Vector))))
                .Where(x => x.Score > 0.3f)
                .OrderByDescending(x => x.Score)
                .Take(top)
                .Select(x => x.ChunkText)
                .ToList();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "RAG search failed for topic {TopicId}", topicId);
            return [];
        }
    }

    private static byte[] ToBytes(float[] v)
        => MemoryMarshal.Cast<float, byte>(v).ToArray();

    private static float[] FromBytes(byte[] b)
        => MemoryMarshal.Cast<byte, float>(b).ToArray();

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
