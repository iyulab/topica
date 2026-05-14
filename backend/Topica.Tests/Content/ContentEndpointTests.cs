using System.Net;
using System.Net.Http.Json;
using Topica.Core.Enums;

namespace Topica.Tests.Content;

public class ContentEndpointTests(TestWebAppFactory factory)
    : IClassFixture<TestWebAppFactory>
{
    [Fact]
    public async Task Generate_Summary_ReturnsCreated()
    {
        var client = factory.CreateClient();

        var topicRes = await client.PostAsJsonAsync("/topics", new { Title = "AI 기초", UserLevel = 3 });
        var topic = await topicRes.Content.ReadFromJsonAsync<TopicDto>();
        Assert.NotNull(topic);

        var genRes = await client.PostAsJsonAsync(
            $"/topics/{topic.Id}/contents/generate",
            new { Type = (int)ContentType.Summary, Level = 3 });

        Assert.Equal(HttpStatusCode.Created, genRes.StatusCode);

        var content = await genRes.Content.ReadFromJsonAsync<ContentDto>();
        Assert.NotNull(content);
        Assert.Equal(topic.Id, content.TopicId);
        Assert.NotEmpty(content.Body);
    }

    [Fact]
    public async Task Generate_ForMissingTopic_ReturnsNotFound()
    {
        var client = factory.CreateClient();
        var res = await client.PostAsJsonAsync(
            $"/topics/{Guid.NewGuid()}/contents/generate",
            new { Type = (int)ContentType.Summary, Level = 1 });
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task Regenerate_Summary_UpsertsPreviousContent()
    {
        var client = factory.CreateClient();
        var topicRes = await client.PostAsJsonAsync("/topics", new { Title = "Regen_Upsert", UserLevel = 3 });
        var topic = await topicRes.Content.ReadFromJsonAsync<TopicDto>();
        Assert.NotNull(topic);

        var gen1 = await (await client.PostAsJsonAsync(
            $"/topics/{topic.Id}/contents/generate",
            new { Type = (int)ContentType.Summary, Level = 3 }))
            .Content.ReadFromJsonAsync<ContentDto>();
        Assert.NotNull(gen1);

        var gen2 = await (await client.PostAsJsonAsync(
            $"/topics/{topic.Id}/contents/generate",
            new { Type = (int)ContentType.Summary, Level = 7 }))
            .Content.ReadFromJsonAsync<ContentDto>();
        Assert.NotNull(gen2);

        Assert.Equal(gen1.Id, gen2.Id); // same record — upserted, not duplicated
        Assert.Equal(7, gen2.Level);    // level updated

        var contents = await (await client.GetAsync($"/topics/{topic.Id}/contents"))
            .Content.ReadFromJsonAsync<List<ContentDto>>();
        Assert.NotNull(contents);
        Assert.Single(contents, c => c.Type == (int)ContentType.Summary);
    }

    [Fact]
    public async Task Get_Contents_ReturnsEmptyForNewTopic()
    {
        var client = factory.CreateClient();
        var topicRes = await client.PostAsJsonAsync("/topics", new { Title = "신규 토픽2", UserLevel = 1 });
        var topic = await topicRes.Content.ReadFromJsonAsync<TopicDto>();
        Assert.NotNull(topic);

        var res = await client.GetAsync($"/topics/{topic.Id}/contents");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var contents = await res.Content.ReadFromJsonAsync<List<ContentDto>>();
        Assert.NotNull(contents);
        Assert.Empty(contents);
    }

    private record TopicDto(Guid Id, string Title, int UserLevel);
    private record ContentDto(Guid Id, Guid TopicId, int Type, int Level, string Body, int Status);
}
