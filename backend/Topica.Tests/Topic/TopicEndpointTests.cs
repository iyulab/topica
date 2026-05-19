using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Json;
using Topica.Core.Entities;
using Topica.Core.Enums;
using Topica.Infrastructure.Data;

namespace Topica.Tests.Topics;

public class TopicEndpointTests(TestWebAppFactory factory)
    : IClassFixture<TestWebAppFactory>
{
    [Fact]
    public async Task Post_Topic_ReturnsCreated()
    {
        var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/topics", new { Title = "Python 기초", UserLevel = 3 });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<TopicResponse>();
        Assert.NotNull(body);
        Assert.Equal("Python 기초", body.Title);
        Assert.Equal(3, body.UserLevel);
        Assert.NotEqual(Guid.Empty, body.Id);
    }

    [Fact]
    public async Task Post_Topic_EmptyTitle_ReturnsBadRequest()
    {
        var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/topics", new { Title = "", UserLevel = 1 });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Get_Topics_ReturnsOk()
    {
        var client = factory.CreateClient();
        var response = await client.GetAsync("/topics");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Get_Topic_NotFound()
    {
        var client = factory.CreateClient();
        var response = await client.GetAsync($"/topics/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Post_Then_Get_Topic_ReturnsCreatedTopic()
    {
        var client = factory.CreateClient();
        var created = await client.PostAsJsonAsync("/topics", new { Title = "머신러닝", UserLevel = 5 });
        var body = await created.Content.ReadFromJsonAsync<TopicResponse>();
        Assert.NotNull(body);

        var getResponse = await client.GetAsync($"/topics/{body.Id}");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
        var fetched = await getResponse.Content.ReadFromJsonAsync<TopicResponse>();
        Assert.Equal("머신러닝", fetched?.Title);
    }

    [Fact]
    public async Task Delete_Topic_ReturnsNoContent()
    {
        var client = factory.CreateClient();
        var created = await client.PostAsJsonAsync("/topics", new { Title = "삭제 대상", UserLevel = 1 });
        var body = await created.Content.ReadFromJsonAsync<TopicResponse>();
        Assert.NotNull(body);

        var deleteResponse = await client.DeleteAsync($"/topics/{body.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var getResponse = await client.GetAsync($"/topics/{body.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);
    }

    [Fact]
    public async Task Get_Topics_WithQuery_MatchesTitle()
    {
        var client = factory.CreateClient();
        await client.PostAsJsonAsync("/topics", new { Title = "SrchTitle_GoLang", UserLevel = 1 });
        await client.PostAsJsonAsync("/topics", new { Title = "SrchTitle_Cooking", UserLevel = 1 });

        var res = await client.GetAsync("/topics?q=SrchTitle_GoLang");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var topics = await res.Content.ReadFromJsonAsync<List<TopicResponse>>();
        Assert.NotNull(topics);
        Assert.Contains(topics, t => t.Title == "SrchTitle_GoLang");
        Assert.DoesNotContain(topics, t => t.Title == "SrchTitle_Cooking");
    }

    [Fact]
    public async Task Get_Topics_WithQuery_MatchesContentBody()
    {
        var client = factory.CreateClient();
        var topicRes = await client.PostAsJsonAsync("/topics", new { Title = "SrchBody_Host", UserLevel = 1 });
        var topic = await topicRes.Content.ReadFromJsonAsync<TopicResponse>();
        Assert.NotNull(topic);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.Contents.Add(new Topica.Core.Entities.Content
        {
            TopicId = topic.Id,
            Type = ContentType.Summary,
            Level = 1,
            Body = "유일한본문검색어xyz987 이 포함된 내용입니다.",
            Status = ContentStatus.Published,
        });
        await db.SaveChangesAsync();

        var res = await client.GetAsync("/topics?q=유일한본문검색어xyz987");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var topics = await res.Content.ReadFromJsonAsync<List<TopicResponse>>();
        Assert.NotNull(topics);
        Assert.Contains(topics, t => t.Id == topic.Id);
    }

    [Fact]
    public async Task Get_Topics_WithTags_FiltersCorrectly()
    {
        var client = factory.CreateClient();
        var topicRes = await client.PostAsJsonAsync("/topics", new { Title = "SrchTag_Target", UserLevel = 1 });
        var topic = await topicRes.Content.ReadFromJsonAsync<TopicResponse>();
        Assert.NotNull(topic);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.TopicTags.Add(new TopicTag { TopicId = topic.Id, Tag = "uniquetag_srch" });
        await db.SaveChangesAsync();

        var res = await client.GetAsync("/topics?tags=uniquetag_srch");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var topics = await res.Content.ReadFromJsonAsync<List<TopicResponse>>();
        Assert.NotNull(topics);
        Assert.NotEmpty(topics);
        Assert.All(topics, t => Assert.Equal(topic.Id, t.Id));
    }

    [Fact]
    public async Task Get_Topics_WithSort_TitleAsc_ReturnsSorted()
    {
        var client = factory.CreateClient();
        await client.PostAsJsonAsync("/topics", new { Title = "sorttest_Zebra", UserLevel = 1 });
        await client.PostAsJsonAsync("/topics", new { Title = "sorttest_Apple", UserLevel = 1 });
        await client.PostAsJsonAsync("/topics", new { Title = "sorttest_Mango", UserLevel = 1 });

        var res = await client.GetAsync("/topics?q=sorttest_&sort=title_asc");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var topics = await res.Content.ReadFromJsonAsync<List<TopicResponse>>();
        Assert.NotNull(topics);
        var sortTopics = topics.Where(t => t.Title.StartsWith("sorttest_")).ToList();
        Assert.Equal(3, sortTopics.Count);
        Assert.True(string.Compare(sortTopics[0].Title, sortTopics[1].Title, StringComparison.Ordinal) < 0);
        Assert.True(string.Compare(sortTopics[1].Title, sortTopics[2].Title, StringComparison.Ordinal) < 0);
    }

    private record TopicResponse(Guid Id, string Title, string Description, int UserLevel, DateTime CreatedAt, DateTime UpdatedAt);
}
