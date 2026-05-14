using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.DependencyInjection;
using Topica.Api.Modules.Research;
using Topica.Infrastructure.Data;
using WebLookup;

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
            var chatClientDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(IChatClient));
            if (chatClientDescriptor is not null) services.Remove(chatClientDescriptor);
            services.AddSingleton<IChatClient>(new FakeChatClient("**테스트 요약입니다.**"));
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
        public Task<IReadOnlyList<SearchResult>> SearchAsync(string query, CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<SearchResult>>([]);
    }
}
