using FluxIndex.Core.Application.Interfaces;
using FluxIndex.Core.Application.Utilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Runtime.InteropServices;
using Topica.Api.Modules.AI;
using Topica.Core.Entities;
using Topica.Infrastructure.Data;

namespace Topica.Api.Modules.RAG;

public sealed class RagService(
    IOptionsMonitor<AiSettings> options,
    IEmbeddingService embeddingService,
    ILogger<RagService> logger)
{
    public async Task IndexTopicAsync(Guid topicId, IEnumerable<ResearchDoc> docs, ApplicationDbContext db, CancellationToken ct = default)
    {
        var settings = options.CurrentValue;
        var chunks = docs
            .Where(d => !string.IsNullOrWhiteSpace(d.Content))
            .Select((d, i) => (Text: d.Content, Index: i))
            .ToList();

        if (chunks.Count == 0) return;

        try
        {
            var existing = await db.ResearchChunkEmbeddings
                .Where(e => e.TopicId == topicId)
                .ToListAsync(ct);
            db.ResearchChunkEmbeddings.RemoveRange(existing);

            foreach (var (text, index) in chunks)
            {
                var vector = await embeddingService.GenerateEmbeddingAsync(text, ct);

                var activeModel = !string.IsNullOrWhiteSpace(settings.ApiKey)
                    ? settings.EmbeddingModel
                    : !string.IsNullOrWhiteSpace(settings.OllamaEmbeddingModel)
                    ? settings.OllamaEmbeddingModel
                    : embeddingService.GetModelName();

                db.ResearchChunkEmbeddings.Add(new ResearchChunkEmbedding
                {
                    TopicId = topicId,
                    ChunkText = text,
                    Vector = ToBytes(vector),
                    Model = activeModel,
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
        try
        {
            var queryVec = await embeddingService.GenerateEmbeddingAsync(query, ct);

            var embeddings = await db.ResearchChunkEmbeddings
                .Where(e => e.TopicId == topicId)
                .ToListAsync(ct);

            if (embeddings.Count == 0) return [];

            var expectedDim = queryVec.Length;
            var dimMismatch = embeddings.Where(e => FromBytes(e.Vector).Length != expectedDim).ToList();
            if (dimMismatch.Count > 0)
                logger.LogWarning("RAG search: {Count} chunk(s) have dimension mismatch (expected {Dim}d). Re-index after changing embedding model.", dimMismatch.Count, expectedDim);

            return embeddings
                .Select(e => (e.ChunkText, Score: VectorMathUtilities.CosineSimilarity(queryVec, FromBytes(e.Vector))))
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
}
