using FluxIndex.Core.Application.Interfaces;
using FluxIndex.Core.Domain.Entities;
using FluxIndex.Core.Domain.ValueObjects;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Topica.Api.Modules.AI;
using Topica.Api.Modules.RAG;
using Topica.Api.Modules.Research;
using Topica.Core.Entities;
using Topica.Infrastructure.Data;
using SearchResult = WebLookup.SearchResult;

namespace Topica.Tests.Research;

public class ResearchServiceTests
{
    private static RagService CreateNullRagService()
    {
        var monitor = new StubOptionsMonitor(new AiSettings());
        return new RagService(new StubEmbeddingService(), new NoOpVectorStore(), NullLogger<RagService>.Instance);
    }

    private sealed class NoOpVectorStore : IVectorStore
    {
        public string? ResolvedStoreName => null;
        public int? DetectedDimension => null;
        public EmbeddingIdentity? BoundIdentity => null;
        public void BindIdentity(EmbeddingIdentity identity) { }
        public Task<bool> VerifyHealthAsync(CancellationToken ct = default) => Task.FromResult(true);
        public Task<string> StoreAsync(DocumentChunk chunk, CancellationToken ct = default) => Task.FromResult(chunk.Id);
        public Task<IEnumerable<string>> StoreBatchAsync(IEnumerable<DocumentChunk> chunks, CancellationToken ct = default) => Task.FromResult(chunks.Select(c => c.Id));
        public Task<DocumentChunk?> GetAsync(string id, CancellationToken ct = default) => Task.FromResult<DocumentChunk?>(null);
        public Task<IEnumerable<DocumentChunk>> GetByDocumentIdAsync(string documentId, CancellationToken ct = default) => Task.FromResult(Enumerable.Empty<DocumentChunk>());
        public Task<IEnumerable<DocumentChunk>> GetChunksByIdsAsync(IEnumerable<string> ids, CancellationToken ct = default) => Task.FromResult(Enumerable.Empty<DocumentChunk>());
        public Task<IEnumerable<DocumentChunk>> SearchAsync(float[] queryEmbedding, int topK, float minScore, Dictionary<string, object>? filters, CancellationToken ct = default) => Task.FromResult(Enumerable.Empty<DocumentChunk>());
        public Task<bool> DeleteAsync(string id, CancellationToken ct = default) => Task.FromResult(true);
        public Task<bool> DeleteByDocumentIdAsync(string documentId, CancellationToken ct = default) => Task.FromResult(true);
        public Task<bool> ExistsAsync(string id, CancellationToken ct = default) => Task.FromResult(false);
        public Task<DocumentChunk?> GetByIdAsync(string id, CancellationToken ct = default) => Task.FromResult<DocumentChunk?>(null);
        public Task<bool> UpdateAsync(DocumentChunk chunk, CancellationToken ct = default) => Task.FromResult(true);
        public Task<int> CountAsync(CancellationToken ct = default) => Task.FromResult(0);
        public Task<int> GetCountAsync(CancellationToken ct = default) => Task.FromResult(0);
        public Task ClearAsync(CancellationToken ct = default) => Task.CompletedTask;
        public Task<int> GetDistinctDocumentCountAsync(CancellationToken ct = default) => Task.FromResult(0);
        public Task<bool> HasVectorsForDocumentAsync(string documentId, CancellationToken ct = default) => Task.FromResult(false);
    }

    private sealed class StubOptionsMonitor(AiSettings value) : IOptionsMonitor<AiSettings>
    {
        public AiSettings CurrentValue => value;
        public AiSettings Get(string? name) => value;
        public IDisposable? OnChange(Action<AiSettings, string?> listener) => null;
    }

    private sealed class StubEmbeddingService : IEmbeddingService
    {
        public Task<float[]> GenerateEmbeddingAsync(string text, CancellationToken ct = default)
            => Task.FromResult<float[]>([]);
        public Task<IEnumerable<float[]>> GenerateEmbeddingsBatchAsync(IEnumerable<string> texts, CancellationToken ct = default)
            => Task.FromResult<IEnumerable<float[]>>([]);
        public int GetEmbeddingDimension() => 0;
        public string GetModelName() => string.Empty;
        public int GetMaxTokens() => 0;
        public Task<int> CountTokensAsync(string text, CancellationToken ct = default) => Task.FromResult(0);
        public EmbeddingIdentity GetIdentity() => new() { Provider = "stub", Model = "stub" };
    }
    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    [Fact]
    public async Task RunResearch_SavesDocsForTopic()
    {
        await using var db = CreateContext();
        var topic = new Topic { Title = "Python 기초" };
        db.Topics.Add(topic);
        await db.SaveChangesAsync();

        var fakeResults = new List<SearchResult>
        {
            new() { Url = "https://example.com/1", Title = "Python Tutorial", Description = "Learn Python" },
            new() { Url = "https://example.com/2", Title = "Python Docs", Description = "Official docs" },
        };

        var svc = new ResearchService(db, new FakeResearcher(fakeResults), CreateNullRagService());
        await svc.RunResearchAsync(topic.Id);

        var docs = await db.ResearchDocs.Where(r => r.TopicId == topic.Id).ToListAsync();
        Assert.Equal(2, docs.Count);
        Assert.Contains(docs, d => d.Source == "https://example.com/1");
        Assert.Contains(docs, d => d.ChunkIndex == 1);
    }

    [Fact]
    public async Task RunResearch_TopicNotFound_DoesNothing()
    {
        await using var db = CreateContext();
        var svc = new ResearchService(db, new FakeResearcher([]), CreateNullRagService());
        await svc.RunResearchAsync(Guid.NewGuid());
        Assert.Equal(0, await db.ResearchDocs.CountAsync());
    }

    [Fact]
    public async Task GetResearchDocs_ReturnsSavedDocsInOrder()
    {
        await using var db = CreateContext();
        var topic = new Topic { Title = "딥러닝" };
        db.Topics.Add(topic);
        db.ResearchDocs.AddRange(
            new ResearchDoc { TopicId = topic.Id, Source = "https://b.com", ChunkIndex = 1, Content = "B" },
            new ResearchDoc { TopicId = topic.Id, Source = "https://a.com", ChunkIndex = 0, Content = "A" }
        );
        await db.SaveChangesAsync();

        var svc = new ResearchService(db, new FakeResearcher([]), CreateNullRagService());
        var docs = await svc.GetResearchDocsAsync(topic.Id);

        Assert.Equal(2, docs.Count);
        Assert.Equal(0, docs[0].ChunkIndex);
        Assert.Equal(1, docs[1].ChunkIndex);
    }

    private sealed class FakeResearcher(IReadOnlyList<SearchResult> results) : IWebResearcher
    {
        public Task<IReadOnlyList<SearchResult>> SearchAsync(string query, CancellationToken ct = default)
            => Task.FromResult(results);
    }
}
