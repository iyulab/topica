using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Topica.Tests.Settings;

public class SettingsEndpointTests(TestWebAppFactory factory) : IClassFixture<TestWebAppFactory>
{
    [Fact]
    public async Task Get_Settings_ReturnsEmbeddingDimension()
    {
        var client = factory.CreateClient();
        var res = await client.GetAsync("/settings");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.True(doc.RootElement.TryGetProperty("embeddingDimension", out var dim));
        Assert.Equal(JsonValueKind.Number, dim.ValueKind);
        Assert.True(dim.GetInt32() > 0);
    }

    [Fact]
    public async Task Get_Settings_ReturnsAllExpectedFields()
    {
        var client = factory.CreateClient();
        var res = await client.GetAsync("/settings");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        // Verify all expected fields exist
        Assert.True(root.TryGetProperty("model", out _));
        Assert.True(root.TryGetProperty("language", out _));
        Assert.True(root.TryGetProperty("hasApiKey", out _));
        Assert.True(root.TryGetProperty("embeddingModel", out _));
        Assert.True(root.TryGetProperty("embeddingDimension", out _));
        Assert.True(root.TryGetProperty("ollamaEndpoint", out _));
        Assert.True(root.TryGetProperty("ollamaModel", out _));
        Assert.True(root.TryGetProperty("ollamaEmbeddingModel", out _));
        Assert.True(root.TryGetProperty("chatProvider", out _));
        Assert.True(root.TryGetProperty("embeddingProvider", out _));
    }

    [Fact]
    public async Task Put_Settings_ResponseContainsReindexRequiredField()
    {
        var client = factory.CreateClient();
        var payload = new
        {
            embeddingModel = (string?)null,
            embeddingDimension = (int?)null,
            apiKey = (string?)null,
            model = (string?)null,
            language = (string?)null,
            ollamaEndpoint = (string?)null,
            ollamaModel = (string?)null,
            ollamaEmbeddingModel = (string?)null,
        };
        var res = await client.PutAsJsonAsync("/settings", payload);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.True(doc.RootElement.TryGetProperty("reindexRequired", out var flag));
        Assert.Equal(JsonValueKind.False, flag.ValueKind); // null fields → no change
    }

    [Fact]
    public async Task Get_Settings_ReturnsChatProviderField()
    {
        var client = factory.CreateClient();
        var res = await client.GetAsync("/settings");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.True(doc.RootElement.TryGetProperty("chatProvider", out var cp));
        Assert.Equal("local", cp.GetString());
    }

    [Fact]
    public async Task Get_Settings_ReturnsEmbeddingProviderField()
    {
        var client = factory.CreateClient();
        var res = await client.GetAsync("/settings");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.True(doc.RootElement.TryGetProperty("embeddingProvider", out var ep));
        Assert.Equal("local", ep.GetString());
    }

    [Fact]
    public async Task Post_Reindex_ReturnsOkWithCounts()
    {
        var client = factory.CreateClient();
        var res = await client.PostAsync("/settings/reindex", null);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.True(doc.RootElement.TryGetProperty("topicsReindexed", out _));
        Assert.True(doc.RootElement.TryGetProperty("ragReindexed", out _));
    }

    [Fact]
    public async Task Post_Reindex_WithTopics_CountsTopics()
    {
        var client = factory.CreateClient();
        await client.PostAsJsonAsync("/topics", new { Title = "Reindex_Test_Topic", UserLevel = 1 });

        var res = await client.PostAsync("/settings/reindex", null);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.True(doc.RootElement.TryGetProperty("topicsReindexed", out var count));
        Assert.True(count.GetInt32() >= 1);
    }

    [Fact]
    public async Task Put_Settings_ReindexRequired_WhenEmbeddingModelChanges()
    {
        var client = factory.CreateClient();
        var payload = new { embeddingModel = "text-embedding-3-large" };
        var res = await client.PutAsJsonAsync("/settings", payload);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.True(doc.RootElement.TryGetProperty("reindexRequired", out var flag));
        Assert.Equal(JsonValueKind.True, flag.ValueKind);
    }

    [Fact]
    public async Task Get_OllamaEmbeddingDimension_WithoutModel_ReturnsBadRequest()
    {
        var client = factory.CreateClient();
        var res = await client.GetAsync("/ollama/embedding-dimension?endpoint=http://localhost:11434");
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Get_OllamaEmbeddingDimension_WithUnreachableEndpoint_ReturnsBadRequest()
    {
        var client = factory.CreateClient();
        var res = await client.GetAsync("/ollama/embedding-dimension?endpoint=http://127.0.0.1:19999&model=nomic-embed-text");
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }
}

