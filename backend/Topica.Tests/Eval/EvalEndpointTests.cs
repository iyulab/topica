using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Topica.Core.Enums;
using Topica.Infrastructure.Data;

namespace Topica.Tests.Eval;

public class EvalEndpointTests(TestWebAppFactory factory) : IClassFixture<TestWebAppFactory>
{
    private async Task<(Guid topicId, Guid contentId)> SeedAsync(string title, int userLevel)
    {
        var client = factory.CreateClient();
        var topicResp = await client.PostAsJsonAsync("/topics", new { Title = title, UserLevel = userLevel });
        var topic = await topicResp.Content.ReadFromJsonAsync<TopicDto>();
        Assert.NotNull(topic);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var content = new global::Topica.Core.Entities.Content
        {
            TopicId = topic.Id,
            Type = ContentType.Quiz,
            Level = userLevel,
            Body = "test quiz body",
            Status = ContentStatus.Draft,
        };
        db.Contents.Add(content);
        await db.SaveChangesAsync();

        return (topic.Id, content.Id);
    }

    [Fact]
    public async Task Post_Eval_HighScore_IncreasesLevel()
    {
        var (topicId, contentId) = await SeedAsync("Eval_High", 5);
        var client = factory.CreateClient();
        var res = await client.PostAsJsonAsync(
            $"/topics/{topicId}/eval",
            new { ContentId = contentId, Score = 8, Total = 10 });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<EvalResultDto>();
        Assert.NotNull(body);
        Assert.Equal(6, body.NewLevel);
        Assert.True(body.LevelChanged);
    }

    [Fact]
    public async Task Post_Eval_MidScore_NoChange()
    {
        var (topicId, contentId) = await SeedAsync("Eval_Mid", 5);
        var client = factory.CreateClient();
        var res = await client.PostAsJsonAsync(
            $"/topics/{topicId}/eval",
            new { ContentId = contentId, Score = 5, Total = 10 });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<EvalResultDto>();
        Assert.NotNull(body);
        Assert.Equal(5, body.NewLevel);
        Assert.False(body.LevelChanged);
    }

    [Fact]
    public async Task Post_Eval_LowScore_DecreasesLevel()
    {
        var (topicId, contentId) = await SeedAsync("Eval_Low", 5);
        var client = factory.CreateClient();
        var res = await client.PostAsJsonAsync(
            $"/topics/{topicId}/eval",
            new { ContentId = contentId, Score = 3, Total = 10 });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<EvalResultDto>();
        Assert.NotNull(body);
        Assert.Equal(4, body.NewLevel);
        Assert.True(body.LevelChanged);
    }

    [Fact]
    public async Task Post_Eval_LevelAtMin_LowScore_NoDecrease()
    {
        var (topicId, contentId) = await SeedAsync("Eval_MinLevel", 1);
        var client = factory.CreateClient();
        var res = await client.PostAsJsonAsync(
            $"/topics/{topicId}/eval",
            new { ContentId = contentId, Score = 2, Total = 10 });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<EvalResultDto>();
        Assert.NotNull(body);
        Assert.Equal(1, body.NewLevel);
        Assert.False(body.LevelChanged);
    }

    [Fact]
    public async Task Post_Eval_LevelAtMax_HighScore_NoIncrease()
    {
        var (topicId, contentId) = await SeedAsync("Eval_MaxLevel", 10);
        var client = factory.CreateClient();
        var res = await client.PostAsJsonAsync(
            $"/topics/{topicId}/eval",
            new { ContentId = contentId, Score = 10, Total = 10 });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<EvalResultDto>();
        Assert.NotNull(body);
        Assert.Equal(10, body.NewLevel);
        Assert.False(body.LevelChanged);
    }

    [Fact]
    public async Task Post_Eval_TopicNotFound_Returns404()
    {
        var client = factory.CreateClient();
        var res = await client.PostAsJsonAsync(
            $"/topics/{Guid.NewGuid()}/eval",
            new { ContentId = Guid.NewGuid(), Score = 5, Total = 10 });
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task Post_Eval_ContentNotFound_ReturnsBadRequest()
    {
        var (topicId, _) = await SeedAsync("Eval_ContentMissing", 3);
        var client = factory.CreateClient();
        var res = await client.PostAsJsonAsync(
            $"/topics/{topicId}/eval",
            new { ContentId = Guid.NewGuid(), Score = 5, Total = 10 });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Get_Eval_History_ReturnsSessionAfterEval()
    {
        var (topicId, contentId) = await SeedAsync("Eval_History", 4);
        var client = factory.CreateClient();
        await client.PostAsJsonAsync(
            $"/topics/{topicId}/eval",
            new { ContentId = contentId, Score = 9, Total = 10 });

        var res = await client.GetAsync($"/topics/{topicId}/eval/history");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var sessions = await res.Content.ReadFromJsonAsync<List<EvalHistoryDto>>();
        Assert.NotNull(sessions);
        Assert.Single(sessions);
        Assert.Equal(4, sessions[0].LevelBefore);
        Assert.Equal(5, sessions[0].LevelAfter);
    }

    private record TopicDto(Guid Id);
    private record EvalResultDto(int NewLevel, bool LevelChanged);
    private record EvalHistoryDto(float Score, int LevelBefore, int LevelAfter, DateTime CreatedAt);
}
