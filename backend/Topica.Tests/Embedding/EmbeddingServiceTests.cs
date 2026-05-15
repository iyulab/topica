using FluxIndex.Core.Application.Interfaces;
using FluxIndex.Core.Application.Utilities;
using FluxIndex.Core.Domain.Entities;
using FluxIndex.Core.Domain.ValueObjects;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Topica.Api.Modules.AI;
using Topica.Api.Modules.Graph;
using Topica.Api.Modules.RAG;
using Topica.Core.Entities;
using Topica.Infrastructure.Data;

namespace Topica.Tests.Embedding;

// Tests for the new IVectorStore-based TopicEmbeddingService and RagService.
// Uses a deterministic embedding service and an in-memory Dictionary-backed vector store
// so that actual embedding/search logic can be verified without Ollama or lm-supply.
public class EmbeddingServiceTests
{
    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    // Deterministic embedding: hash text → float[8], then normalize
    private sealed class DeterministicEmbeddingService : IEmbeddingService
    {
        private const int Dim = 8;

        public Task<float[]> GenerateEmbeddingAsync(string text, CancellationToken ct = default)
        {
            var vec = new float[Dim];
            int hash = text.Length > 0 ? text.Aggregate(17, (acc, c) => acc * 31 + c) : 0;
            for (int i = 0; i < Dim; i++)
                vec[i] = (float)((hash >> i) & 0xFF) / 255f;

            var norm = MathF.Sqrt(vec.Sum(v => v * v));
            if (norm > 0)
                for (int i = 0; i < Dim; i++) vec[i] /= norm;

            return Task.FromResult(vec);
        }

        public Task<IEnumerable<float[]>> GenerateEmbeddingsBatchAsync(IEnumerable<string> texts, CancellationToken ct = default)
            => Task.FromResult<IEnumerable<float[]>>(texts.Select(t => GenerateEmbeddingAsync(t).Result));

        public int GetEmbeddingDimension() => Dim;
        public string GetModelName() => "deterministic-test";
        public int GetMaxTokens() => 512;
        public Task<int> CountTokensAsync(string text, CancellationToken ct = default) => Task.FromResult(0);
        public EmbeddingIdentity GetIdentity() => new() { Provider = "test", Model = "deterministic", Dimension = Dim };
    }

    // In-memory vector store backed by a Dictionary
    private sealed class InMemoryVectorStore : IVectorStore
    {
        private readonly Dictionary<string, DocumentChunk> _store = new();

        public string? ResolvedStoreName => "test";
        public int? DetectedDimension => 8;
        public EmbeddingIdentity? BoundIdentity => null;
        public void BindIdentity(EmbeddingIdentity identity) { }
        public Task<bool> VerifyHealthAsync(CancellationToken ct = default) => Task.FromResult(true);

        public Task<string> StoreAsync(DocumentChunk chunk, CancellationToken ct = default)
        {
            _store[chunk.Id] = chunk;
            return Task.FromResult(chunk.Id);
        }

        public Task<IEnumerable<string>> StoreBatchAsync(IEnumerable<DocumentChunk> chunks, CancellationToken ct = default)
        {
            var ids = new List<string>();
            foreach (var c in chunks) { _store[c.Id] = c; ids.Add(c.Id); }
            return Task.FromResult<IEnumerable<string>>(ids);
        }

        public Task<DocumentChunk?> GetAsync(string id, CancellationToken ct = default)
            => Task.FromResult(_store.TryGetValue(id, out var c) ? c : null);

        public Task<IEnumerable<DocumentChunk>> GetByDocumentIdAsync(string documentId, CancellationToken ct = default)
            => Task.FromResult(_store.Values.Where(c => c.DocumentId == documentId));

        public Task<IEnumerable<DocumentChunk>> GetChunksByIdsAsync(IEnumerable<string> ids, CancellationToken ct = default)
            => Task.FromResult(_store.Values.Where(c => ids.Contains(c.Id)));

        public Task<IEnumerable<DocumentChunk>> SearchAsync(float[] queryEmbedding, int topK, float minScore, Dictionary<string, object>? filters, CancellationToken ct = default)
        {
            var results = _store.Values
                .Where(c => c.Embedding is { Length: > 0 } && c.Embedding.Length == queryEmbedding.Length)
                .Select(c => { c.Score = VectorMathUtilities.CosineSimilarity(queryEmbedding, c.Embedding!); return c; })
                .Where(c => c.Score >= minScore)
                .OrderByDescending(c => c.Score)
                .Take(topK);
            return Task.FromResult<IEnumerable<DocumentChunk>>(results.ToList());
        }

        public Task<bool> DeleteAsync(string id, CancellationToken ct = default)
            => Task.FromResult(_store.Remove(id));

        public Task<bool> DeleteByDocumentIdAsync(string documentId, CancellationToken ct = default)
        {
            var keys = _store.Values.Where(c => c.DocumentId == documentId).Select(c => c.Id).ToList();
            foreach (var k in keys) _store.Remove(k);
            return Task.FromResult(keys.Count > 0);
        }

        public Task<bool> ExistsAsync(string id, CancellationToken ct = default)
            => Task.FromResult(_store.ContainsKey(id));

        public Task<DocumentChunk?> GetByIdAsync(string id, CancellationToken ct = default)
            => GetAsync(id, ct);

        public Task<bool> UpdateAsync(DocumentChunk chunk, CancellationToken ct = default)
        {
            _store[chunk.Id] = chunk;
            return Task.FromResult(true);
        }

        public Task<int> CountAsync(CancellationToken ct = default) => Task.FromResult(_store.Count);
        public Task<int> GetCountAsync(CancellationToken ct = default) => Task.FromResult(_store.Count);
        public Task ClearAsync(CancellationToken ct = default) { _store.Clear(); return Task.CompletedTask; }
        public Task<int> GetDistinctDocumentCountAsync(CancellationToken ct = default)
            => Task.FromResult(_store.Values.Select(c => c.DocumentId).Distinct().Count());
        public Task<bool> HasVectorsForDocumentAsync(string documentId, CancellationToken ct = default)
            => Task.FromResult(_store.Values.Any(c => c.DocumentId == documentId));
    }

    [Fact]
    public async Task EmbedTopicAsync_StoresEmbedding_HasEmbeddingReturnsTrue()
    {
        await using var db = CreateContext();
        var topic = new Topic { Title = "머신러닝 기초", Description = "ML 입문 과정" };
        db.Topics.Add(topic);
        await db.SaveChangesAsync();

        var vectorStore = new InMemoryVectorStore();
        var svc = new TopicEmbeddingService(
            db, new DeterministicEmbeddingService(), vectorStore, NullLogger<TopicEmbeddingService>.Instance);

        await svc.EmbedTopicAsync(topic.Id);

        Assert.True(await svc.HasEmbeddingAsync(topic.Id));
    }

    [Fact]
    public async Task FindSimilarAsync_ReturnsSimilarTopic()
    {
        await using var db = CreateContext();
        var topicA = new Topic { Title = "Python", Description = "Python 프로그래밍" };
        var topicB = new Topic { Title = "Python", Description = "Python 프로그래밍" }; // identical → high similarity
        var topicC = new Topic { Title = "역사", Description = "중세 유럽의 역사" };
        db.Topics.AddRange(topicA, topicB, topicC);
        await db.SaveChangesAsync();

        var vectorStore = new InMemoryVectorStore();
        var svc = new TopicEmbeddingService(
            db, new DeterministicEmbeddingService(), vectorStore, NullLogger<TopicEmbeddingService>.Instance);

        await svc.EmbedTopicAsync(topicA.Id);
        await svc.EmbedTopicAsync(topicB.Id);
        await svc.EmbedTopicAsync(topicC.Id);

        var similar = await svc.FindSimilarAsync(topicA.Id, top: 5);

        Assert.Contains(similar, s => s.TopicId == topicB.Id);
    }

    [Fact]
    public async Task RagIndexAndSearch_RoundTrip_ReturnsRelevantChunks()
    {
        var vectorStore = new InMemoryVectorStore();
        var svc = new RagService(
            new DeterministicEmbeddingService(), vectorStore, NullLogger<RagService>.Instance);

        var topicId = Guid.NewGuid();
        var docs = new List<ResearchDoc>
        {
            new() { TopicId = topicId, Content = "Python은 데이터 과학에 사용됩니다.", ChunkIndex = 0, Source = "test" },
            new() { TopicId = topicId, Content = "JavaScript는 웹 개발에 사용됩니다.", ChunkIndex = 1, Source = "test" },
        };

        await svc.IndexTopicAsync(topicId, docs);

        var results = await svc.SearchAsync(topicId, "Python 데이터 과학", top: 1);

        Assert.NotEmpty(results);
        Assert.Contains(results, r => r.Contains("Python"));
    }

    [Fact]
    public async Task IndexTopicAsync_EmbeddingFailure_PreservesOldData()
    {
        var vectorStore = new InMemoryVectorStore();

        // First index with working embedding service
        var svc = new RagService(
            new DeterministicEmbeddingService(), vectorStore, NullLogger<RagService>.Instance);

        var topicId = Guid.NewGuid();
        var originalDocs = new List<ResearchDoc>
        {
            new() { TopicId = topicId, Content = "원본 청크 데이터", ChunkIndex = 0, Source = "test" },
        };
        await svc.IndexTopicAsync(topicId, originalDocs);

        // Verify original data is stored
        var stored = (await vectorStore.GetByDocumentIdAsync($"rag:{topicId}")).ToList();
        Assert.Single(stored);

        // Try to re-index with a service that returns empty vectors (simulates failure)
        var failingSvc = new RagService(
            new FailingEmbeddingService(), vectorStore, NullLogger<RagService>.Instance);

        var newDocs = new List<ResearchDoc>
        {
            new() { TopicId = topicId, Content = "새 청크 데이터", ChunkIndex = 0, Source = "test" },
        };
        await failingSvc.IndexTopicAsync(topicId, newDocs);

        // Original data should still be intact (not deleted)
        var afterFail = (await vectorStore.GetByDocumentIdAsync($"rag:{topicId}")).ToList();
        Assert.Single(afterFail);
        Assert.Contains(afterFail, c => c.Content == "원본 청크 데이터");
    }

    private sealed class FailingEmbeddingService : IEmbeddingService
    {
        public Task<float[]> GenerateEmbeddingAsync(string text, CancellationToken ct = default)
            => Task.FromResult(Array.Empty<float>());
        public Task<IEnumerable<float[]>> GenerateEmbeddingsBatchAsync(IEnumerable<string> texts, CancellationToken ct = default)
            => Task.FromResult(Enumerable.Empty<float[]>());
        public int GetEmbeddingDimension() => 0;
        public string GetModelName() => "failing";
        public int GetMaxTokens() => 0;
        public Task<int> CountTokensAsync(string text, CancellationToken ct = default) => Task.FromResult(0);
        public EmbeddingIdentity GetIdentity() => new() { Provider = "test", Model = "failing" };
    }
}
