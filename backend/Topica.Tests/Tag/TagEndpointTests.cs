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

    private record TopicDto(Guid Id);
}
