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
