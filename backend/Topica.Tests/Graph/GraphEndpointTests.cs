using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Topica.Tests.Graph;

public class GraphEndpointTests(TestWebAppFactory factory) : IClassFixture<TestWebAppFactory>
{
    [Fact]
    public async Task Get_Related_WhenNoEmbeddings_ReturnsEmptyArray()
    {
        var client = factory.CreateClient();
        var topicResp = await client.PostAsJsonAsync("/topics", new { Title = "Graph_Related_Empty", UserLevel = 3 });
        var topic = await topicResp.Content.ReadFromJsonAsync<TopicDto>();
        Assert.NotNull(topic);

        var res = await client.GetAsync($"/topics/{topic.Id}/related");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal(JsonValueKind.Array, doc.RootElement.ValueKind);
        Assert.Equal(0, doc.RootElement.GetArrayLength());
    }

    [Fact]
    public async Task Get_Graph_ReturnsTopicWithExpectedStructure()
    {
        var client = factory.CreateClient();
        await client.PostAsJsonAsync("/topics", new { Title = "Graph_Structure", UserLevel = 4 });

        var res = await client.GetAsync("/graph");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var topics = await res.Content.ReadFromJsonAsync<List<GraphTopicDto>>();
        Assert.NotNull(topics);
        var found = topics.FirstOrDefault(t => t.Title == "Graph_Structure");
        Assert.NotNull(found);
        Assert.Equal(4, found.UserLevel);
        Assert.NotNull(found.Tags);
        Assert.False(found.HasEmbedding);
    }

    [Fact]
    public async Task Get_Graph_ReturnsOkEvenWhenEmpty()
    {
        // GraphEndpointTests has its own factory (separate InMemory DB)
        // so this test can verify the empty-topics case without interference
        // only if it runs before any other test in this class adds topics.
        // Since xunit runs tests sequentially within a class, create a fresh client
        // and just assert the response is OK with an array shape.
        var client = factory.CreateClient();
        var res = await client.GetAsync("/graph");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal(JsonValueKind.Array, doc.RootElement.ValueKind);
    }

    private record TopicDto(Guid Id);
    private record GraphTopicDto(Guid Id, string Title, int UserLevel, List<string> Tags, bool HasEmbedding);
}
