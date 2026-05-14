using System.Net;
using System.Net.Http.Json;

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

    private record TopicResponse(Guid Id, string Title, string Description, int UserLevel, DateTime CreatedAt, DateTime UpdatedAt);
}
