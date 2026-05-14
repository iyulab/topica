using Microsoft.Extensions.AI;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Json;
using Topica.Core.Entities;
using Topica.Infrastructure.Data;
using TopicTag = Topica.Core.Entities.TopicTag;

namespace Topica.Tests.Tag;

public class TagEndpointTests(TestWebAppFactory factory) : IClassFixture<TestWebAppFactory>
{
    [Fact]
    public async Task Get_Tags_ReturnsEmptyForNewTopic()
    {
        var client = factory.CreateClient();
        var topicResp = await client.PostAsJsonAsync("/topics", new { Title = "Tag_Empty", UserLevel = 1 });
        var topic = await topicResp.Content.ReadFromJsonAsync<TopicDto>();
        Assert.NotNull(topic);

        var res = await client.GetAsync($"/topics/{topic.Id}/tags");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var tags = await res.Content.ReadFromJsonAsync<List<string>>();
        Assert.NotNull(tags);
        Assert.Empty(tags);
    }

    [Fact]
    public async Task Get_Tags_ReturnsSeededTags()
    {
        var client = factory.CreateClient();
        var topicResp = await client.PostAsJsonAsync("/topics", new { Title = "Tag_Seeded", UserLevel = 2 });
        var topic = await topicResp.Content.ReadFromJsonAsync<TopicDto>();
        Assert.NotNull(topic);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.TopicTags.Add(new TopicTag { TopicId = topic.Id, Tag = "Python" });
        db.TopicTags.Add(new TopicTag { TopicId = topic.Id, Tag = "프로그래밍" });
        db.TopicTags.Add(new TopicTag { TopicId = topic.Id, Tag = "기초" });
        await db.SaveChangesAsync();

        var res = await client.GetAsync($"/topics/{topic.Id}/tags");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var tags = await res.Content.ReadFromJsonAsync<List<string>>();
        Assert.NotNull(tags);
        Assert.Equal(3, tags.Count);
        Assert.Contains("Python", tags);
    }

    [Fact]
    public async Task Post_GenerateTags_WhenAIGivesGarbage_ReturnsEmpty()
    {
        var client = factory.CreateClient();
        var topicResp = await client.PostAsJsonAsync("/topics", new { Title = "Tag_GarbageAI", UserLevel = 1 });
        var topic = await topicResp.Content.ReadFromJsonAsync<TopicDto>();
        Assert.NotNull(topic);

        var res = await client.PostAsJsonAsync(
            $"/topics/{topic.Id}/tags/generate",
            new { SummaryContent = "파이썬 기초 내용입니다." });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var tags = await res.Content.ReadFromJsonAsync<List<string>>();
        Assert.NotNull(tags);
        Assert.Empty(tags);
    }

    [Fact]
    public async Task Post_GenerateTags_WhenAIGivesValidJson_SavesAndReturnsTags()
    {
        await using var jsonFactory = factory.WithWebHostBuilder(b =>
            b.ConfigureServices(services =>
            {
                var existing = services.SingleOrDefault(d => d.ServiceType == typeof(IChatClient));
                if (existing is not null) services.Remove(existing);
                services.AddSingleton<IChatClient>(
                    new FakeJsonTagClient("""["python", "programming", "basics"]"""));
            }));

        var client = jsonFactory.CreateClient();
        var topicResp = await client.PostAsJsonAsync("/topics", new { Title = "Tag_ValidJson", UserLevel = 3 });
        var topic = await topicResp.Content.ReadFromJsonAsync<TopicDto>();
        Assert.NotNull(topic);

        var res = await client.PostAsJsonAsync(
            $"/topics/{topic.Id}/tags/generate",
            new { SummaryContent = "파이썬 기초 내용입니다." });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var tags = await res.Content.ReadFromJsonAsync<List<string>>();
        Assert.NotNull(tags);
        Assert.Equal(3, tags.Count);
        Assert.Contains("python", tags);
        Assert.Contains("programming", tags);
        Assert.Contains("basics", tags);
    }

    [Fact]
    public async Task Post_GenerateTags_WhenAIWrapsJsonInMarkdown_ParsesCorrectly()
    {
        // AI sometimes wraps JSON in markdown code fences; extraction should still work.
        await using var jsonFactory = factory.WithWebHostBuilder(b =>
            b.ConfigureServices(services =>
            {
                var existing = services.SingleOrDefault(d => d.ServiceType == typeof(IChatClient));
                if (existing is not null) services.Remove(existing);
                services.AddSingleton<IChatClient>(
                    new FakeJsonTagClient("```json\n[\"머신러닝\", \"인공지능\"]\n```"));
            }));

        var client = jsonFactory.CreateClient();
        var topicResp = await client.PostAsJsonAsync("/topics", new { Title = "Tag_MarkdownWrapped", UserLevel = 2 });
        var topic = await topicResp.Content.ReadFromJsonAsync<TopicDto>();
        Assert.NotNull(topic);

        var res = await client.PostAsJsonAsync(
            $"/topics/{topic.Id}/tags/generate",
            new { SummaryContent = "머신러닝 개요." });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var tags = await res.Content.ReadFromJsonAsync<List<string>>();
        Assert.NotNull(tags);
        Assert.Equal(2, tags.Count);
        Assert.Contains("머신러닝", tags);
        Assert.Contains("인공지능", tags);
    }

    private record TopicDto(Guid Id);

    private sealed class FakeJsonTagClient(string json) : IChatClient
    {
        public ChatClientMetadata Metadata => new("fake-json-tag", null, null);

        public Task<ChatResponse> GetResponseAsync(
            IEnumerable<ChatMessage> messages,
            ChatOptions? options = null,
            CancellationToken cancellationToken = default)
            => Task.FromResult(new ChatResponse([new ChatMessage(ChatRole.Assistant, json)]));

        public IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(
            IEnumerable<ChatMessage> messages,
            ChatOptions? options = null,
            CancellationToken cancellationToken = default)
            => throw new NotSupportedException();

        public object? GetService(Type serviceType, object? serviceKey = null) => null;
        public void Dispose() { }
    }
}
