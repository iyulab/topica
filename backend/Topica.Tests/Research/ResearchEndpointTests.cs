using System.Net;
using System.Net.Http.Json;

namespace Topica.Tests.Research;

public class ResearchEndpointTests(TestWebAppFactory factory)
    : IClassFixture<TestWebAppFactory>
{
    [Fact]
    public async Task Get_Research_ForNewTopic_ReturnsEmpty()
    {
        var client = factory.CreateClient();
        var created = await client.PostAsJsonAsync("/topics", new { Title = "신규 토픽", UserLevel = 1 });
        var topic = await created.Content.ReadFromJsonAsync<TopicResponse>();
        Assert.NotNull(topic);

        var response = await client.GetAsync($"/topics/{topic.Id}/research");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var docs = await response.Content.ReadFromJsonAsync<List<ResearchDocResponse>>();
        Assert.NotNull(docs);
        // NoOpWebResearcher returns empty, so docs should be empty
        Assert.Empty(docs);
    }

    [Fact]
    public async Task Get_Research_UnknownTopic_ReturnsEmptyList()
    {
        var client = factory.CreateClient();
        var response = await client.GetAsync($"/topics/{Guid.NewGuid()}/research");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var docs = await response.Content.ReadFromJsonAsync<List<ResearchDocResponse>>();
        Assert.NotNull(docs);
        Assert.Empty(docs);
    }

    private record TopicResponse(Guid Id, string Title, int UserLevel);
    private record ResearchDocResponse(Guid Id, Guid TopicId, string Source, int ChunkIndex, string Content);
}
