using FluxIndex.Core.Application.Interfaces;
using FluxIndex.Core.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Topica.Infrastructure.Data;

namespace Topica.Api.Modules.Graph;

public class TopicEmbeddingService(
    ApplicationDbContext db,
    IEmbeddingService embeddingService,
    IVectorStore vectorStore,
    ILogger<TopicEmbeddingService> logger)
{
    // DocumentId prefix to distinguish topic embeddings from RAG chunks
    private const string Prefix = "topic:";

    public async Task EmbedTopicAsync(Guid topicId, CancellationToken ct = default)
    {
        var topic = await db.Topics
            .Include(t => t.Tags)
            .FirstOrDefaultAsync(t => t.Id == topicId, ct);
        if (topic is null) return;

        var tagText = topic.Tags.Count > 0 ? string.Join(", ", topic.Tags.Select(t => t.Tag)) : "";
        var text = $"{topic.Title}. {topic.Description} {tagText}".Trim();
        if (string.IsNullOrWhiteSpace(text)) return;

        try
        {
            var vector = await embeddingService.GenerateEmbeddingAsync(text, ct);
            if (vector.Length == 0) return;

            var chunkId = $"{Prefix}{topicId}";
            var chunk = new DocumentChunk
            {
                Id = chunkId,
                DocumentId = chunkId,
                Content = text,
                Embedding = vector,
                ChunkIndex = 0,
                TotalChunks = 1,
            };

            if (await vectorStore.ExistsAsync(chunkId, ct))
                await vectorStore.UpdateAsync(chunk, ct);
            else
                await vectorStore.StoreAsync(chunk, ct);

            logger.LogInformation("Embedded topic {TopicId}", topicId);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Topic embedding failed for {TopicId}", topicId);
        }
    }

    public async Task DeleteTopicEmbeddingAsync(Guid topicId, CancellationToken ct = default)
    {
        var chunkId = $"{Prefix}{topicId}";
        if (await vectorStore.ExistsAsync(chunkId, ct))
            await vectorStore.DeleteAsync(chunkId, ct);
    }

    public async Task<List<(Guid TopicId, float Score)>> FindSimilarAsync(Guid topicId, int top = 5, CancellationToken ct = default)
    {
        var chunkId = $"{Prefix}{topicId}";
        var target = await vectorStore.GetAsync(chunkId, ct);
        if (target?.Embedding is null || target.Embedding.Length == 0) return [];

        // Overfetch: request all stored vectors to ensure all topic: chunks are included
        // (the store is shared with rag: chunks; a small topK might return only rag: chunks)
        var totalCount = await vectorStore.CountAsync(ct);
        var results = await vectorStore.SearchAsync(target.Embedding, Math.Max(totalCount, top + 1), 0.5f, null, ct);

        return results
            .Where(r => r.DocumentId?.StartsWith(Prefix) == true && r.Id != chunkId)
            .Take(top)
            .Select(r =>
            {
                var suffix = r.DocumentId![Prefix.Length..];
                return Guid.TryParse(suffix, out var g) ? ((Guid, float)?) (g, r.Score ?? 0f) : null;
            })
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .ToList();
    }

    public async Task<bool> HasEmbeddingAsync(Guid topicId, CancellationToken ct = default)
        => await vectorStore.ExistsAsync($"{Prefix}{topicId}", ct);
}
