using FluxIndex.Core.Application.Interfaces;
using FluxIndex.Core.Application.Utilities;
using FluxIndex.Core.Domain.Entities;
using Topica.Core.Entities;

namespace Topica.Api.Modules.RAG;

public sealed class RagService(
    IEmbeddingService embeddingService,
    IVectorStore vectorStore,
    ILogger<RagService> logger)
{
    // DocumentId prefix to distinguish RAG chunks from topic embeddings
    private const string Prefix = "rag:";

    public async Task IndexTopicAsync(Guid topicId, IEnumerable<ResearchDoc> docs, CancellationToken ct = default)
    {
        var chunks = docs
            .Where(d => !string.IsNullOrWhiteSpace(d.Content))
            .Select((d, i) => (Text: d.Content, Index: i))
            .ToList();

        if (chunks.Count == 0) return;

        try
        {
            // Build all new chunks first — old data stays intact until we have valid replacements
            var docChunks = new List<DocumentChunk>(chunks.Count);
            foreach (var (text, index) in chunks)
            {
                var vector = await embeddingService.GenerateEmbeddingAsync(text, ct);
                if (vector.Length == 0) continue;

                docChunks.Add(new DocumentChunk
                {
                    Id = $"{Prefix}{topicId}:{index}",
                    DocumentId = $"{Prefix}{topicId}",
                    Content = text,
                    Embedding = vector,
                    ChunkIndex = index,
                    TotalChunks = chunks.Count,
                });
            }

            if (docChunks.Count > 0)
            {
                await vectorStore.DeleteByDocumentIdAsync($"{Prefix}{topicId}", ct);
                await vectorStore.StoreBatchAsync(docChunks, ct);
                logger.LogInformation("Indexed {Count} chunks for topic {TopicId}", docChunks.Count, topicId);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "RAG indexing failed for topic {TopicId}", topicId);
        }
    }

    public async Task<List<string>> SearchAsync(Guid topicId, string query, int top = 5, CancellationToken ct = default)
    {
        try
        {
            var queryVec = await embeddingService.GenerateEmbeddingAsync(query, ct);
            if (queryVec.Length == 0) return [];

            // Load only this topic's chunks and do in-memory cosine similarity (exact, no cross-topic bleed)
            var topicChunks = (await vectorStore.GetByDocumentIdAsync($"{Prefix}{topicId}", ct)).ToList();
            if (topicChunks.Count == 0) return [];

            return topicChunks
                .Where(c => c.Embedding is { Length: > 0 } && c.Embedding.Length == queryVec.Length)
                .Select(c => (c.Content, Score: VectorMathUtilities.CosineSimilarity(queryVec, c.Embedding!)))
                .Where(x => x.Score > 0.3f)
                .OrderByDescending(x => x.Score)
                .Take(top)
                .Select(x => x.Content)
                .ToList();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "RAG search failed for topic {TopicId}", topicId);
            return [];
        }
    }

    public async Task DeleteTopicIndexAsync(Guid topicId, CancellationToken ct = default)
        => await vectorStore.DeleteByDocumentIdAsync($"{Prefix}{topicId}", ct);
}
