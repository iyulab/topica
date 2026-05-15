using FluxIndex.Core.Application.Interfaces;
using FluxIndex.Core.Domain.Entities;
using FluxIndex.Core.Domain.ValueObjects;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Topica.Api.Modules.AI;
using Topica.Api.Modules.Queue;
using Topica.Api.Modules.Research;
using Topica.Api.Modules.Settings;
using Topica.Infrastructure.Data;
using WebSearchResult = WebLookup.SearchResult;

namespace Topica.Tests;

public class TestWebAppFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // EF Core 10 registers IDbContextOptionsConfiguration<T> in addition to DbContextOptions<T>.
            // Remove both to avoid "multiple database providers" validation error.
            var toRemove = services
                .Where(d =>
                    d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>) ||
                    (d.ServiceType.IsGenericType &&
                     d.ServiceType.GetGenericTypeDefinition().Name.Contains("DbContextOptionsConfiguration") &&
                     d.ServiceType.IsAssignableTo(typeof(IDbContextOptionsConfiguration<ApplicationDbContext>))))
                .ToList();

            foreach (var d in toRemove)
                services.Remove(d);

            var dbName = Guid.NewGuid().ToString();
            services.AddDbContext<ApplicationDbContext>(opt =>
                opt.UseInMemoryDatabase(dbName));

            // Replace real web researcher with a no-op fake for tests
            var researcherDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(IWebResearcher));
            if (researcherDescriptor is not null) services.Remove(researcherDescriptor);
            services.AddScoped<IWebResearcher>(_ => new NoOpWebResearcher());

            // Replace AI chat client with a deterministic fake for tests
            var chatClientDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(IChatClient) && d.ServiceKey == null);
            if (chatClientDescriptor is not null) services.Remove(chatClientDescriptor);
            services.AddSingleton<IChatClient>(new FakeChatClient("**테스트 요약입니다.**"));

            // Remove ContentQueueWorker to prevent background content generation from racing with tests.
            // POST /topics enqueues defaults; without the worker, topics start with empty contents.
            var workerDescriptors = services
                .Where(d => d.ServiceType == typeof(IHostedService) &&
                            d.ImplementationType == typeof(ContentQueueWorker))
                .ToList();
            foreach (var d in workerDescriptors)
                services.Remove(d);

            // Remove keyed "local" lm-supply services to prevent model downloads in tests
            var localKeyedToRemove = services
                .Where(d => d.ServiceKey is "local")
                .ToList();
            foreach (var d in localKeyedToRemove)
                services.Remove(d);

            // Register no-op stubs for keyed "local" services
            services.AddKeyedSingleton<Microsoft.Extensions.AI.IChatClient>("local",
                (sp, _) => new FakeChatClient("*(로컬 모델 테스트 스텁)*"));
            services.AddKeyedSingleton<FluxIndex.Core.Application.Interfaces.IEmbeddingService>("local",
                (sp, _) => new NoOpLocalEmbeddingService());

            // Replace file-based settings writer with in-memory stub to prevent test-side appsettings.json writes
            var writableOpts = services.SingleOrDefault(d => d.ServiceType == typeof(IWritableOptions<AiSettings>));
            if (writableOpts is not null) services.Remove(writableOpts);
            services.AddSingleton<IWritableOptions<AiSettings>>(
                new InMemoryWritableOptions<AiSettings>(new AiSettings()));

            // Replace SQLite vector store with no-op stub for tests (no DB setup needed)
            var vectorStoreDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(IVectorStore));
            if (vectorStoreDescriptor is not null) services.Remove(vectorStoreDescriptor);
            // Also remove migration/hosted services registered by AddSQLiteVectorStore
            var sqliteHostedServices = services
                .Where(d => d.ServiceType == typeof(IHostedService) &&
                            d.ImplementationType?.FullName?.Contains("FluxIndex") == true)
                .ToList();
            foreach (var d in sqliteHostedServices) services.Remove(d);
            services.AddScoped<IVectorStore>(_ => new NoOpVectorStore());
        });
    }

    private sealed class FakeChatClient(string responseText) : IChatClient
    {
        public ChatClientMetadata Metadata => new("fake", null, null);

        public Task<ChatResponse> GetResponseAsync(
            IEnumerable<ChatMessage> messages,
            ChatOptions? options = null,
            CancellationToken cancellationToken = default)
            => Task.FromResult(new ChatResponse([new ChatMessage(ChatRole.Assistant, responseText)]));

        public IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(
            IEnumerable<ChatMessage> messages,
            ChatOptions? options = null,
            CancellationToken cancellationToken = default)
            => throw new NotSupportedException();

        public object? GetService(Type serviceType, object? serviceKey = null) => null;
        public void Dispose() { }
    }

    private sealed class NoOpWebResearcher : IWebResearcher
    {
        public Task<IReadOnlyList<WebSearchResult>> SearchAsync(string query, CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<WebSearchResult>>([]);
    }

    private sealed class NoOpLocalEmbeddingService
        : FluxIndex.Core.Application.Interfaces.IEmbeddingService
    {
        public Task<float[]> GenerateEmbeddingAsync(string text, CancellationToken ct = default)
            => Task.FromResult(Array.Empty<float>());

        public Task<IEnumerable<float[]>> GenerateEmbeddingsBatchAsync(
            IEnumerable<string> texts, CancellationToken ct = default)
            => Task.FromResult(Enumerable.Empty<float[]>());

        public int GetEmbeddingDimension() => 0;
        public string GetModelName() => "local-stub";
        public int GetMaxTokens() => 512;
        public Task<int> CountTokensAsync(string text, CancellationToken ct = default)
            => Task.FromResult(0);
        public FluxIndex.Core.Domain.ValueObjects.EmbeddingIdentity GetIdentity()
            => new() { Provider = "local", Model = "stub", Dimension = 0 };
    }

    private sealed class InMemoryWritableOptions<T>(T initialValue) : IWritableOptions<T> where T : class
    {
        public T Value { get; private set; } = initialValue;

        public Task UpdateAsync(Action<T> applyChanges)
        {
            applyChanges(Value);
            return Task.CompletedTask;
        }
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
}
