using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Topica.Core.Enums;
using Topica.Infrastructure.Data;

namespace Topica.Tests.LearningSessions;

public class LearningSessionTests(TestWebAppFactory factory)
    : IClassFixture<TestWebAppFactory>
{
    [Fact]
    public async Task PostSession_ReturnsCreated()
    {
        var client = factory.CreateClient();

        var topicRes = await client.PostAsJsonAsync("/topics", new { Title = "통계 테스트", UserLevel = 3 });
        var topic = await topicRes.Content.ReadFromJsonAsync<TopicDto>();
        Assert.NotNull(topic);

        var res = await client.PostAsJsonAsync("/learning-sessions", new
        {
            TopicId = topic.Id,
            DurationSeconds = 300,
            QuizScore = 80,
            FlashcardsStudied = 5
        });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
    }

    [Fact]
    public async Task GetStats_ReturnsAggregatedData()
    {
        var client = factory.CreateClient();

        var topicRes = await client.PostAsJsonAsync("/topics", new { Title = "Stats 테스트", UserLevel = 3 });
        var topic = await topicRes.Content.ReadFromJsonAsync<TopicDto>();
        Assert.NotNull(topic);

        await client.PostAsJsonAsync("/learning-sessions", new
        {
            TopicId = topic.Id,
            DurationSeconds = 600,
            QuizScore = 90,
            FlashcardsStudied = 10
        });

        var statsRes = await client.GetAsync("/learning-sessions/stats");
        Assert.Equal(HttpStatusCode.OK, statsRes.StatusCode);

        var stats = await statsRes.Content.ReadFromJsonAsync<StatsDto>();
        Assert.NotNull(stats);
        Assert.True(stats.TotalStudyMinutes > 0);
        Assert.Equal(7, stats.Streak7d.Length);
    }

    [Fact]
    public async Task GetPathSuggestions_WhenNoSessions_ReturnsEmptyArray()
    {
        var client = factory.CreateClient();
        var res = await client.GetAsync("/learning-sessions/path-suggestions");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal(JsonValueKind.Array, doc.RootElement.ValueKind);
    }

    [Fact]
    public async Task GetPathSuggestions_WithWikiLinkedContent_ReturnsSuggestions()
    {
        var client = factory.CreateClient();

        // Create two topics
        var aRes = await client.PostAsJsonAsync("/topics", new { Title = "PathSug_A", UserLevel = 2 });
        var topicA = await aRes.Content.ReadFromJsonAsync<TopicDto>();
        var bRes = await client.PostAsJsonAsync("/topics", new { Title = "PathSug_B", UserLevel = 2 });
        var topicB = await bRes.Content.ReadFromJsonAsync<TopicDto>();
        Assert.NotNull(topicA); Assert.NotNull(topicB);

        // Seed content for A that links to B
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Contents.Add(new Topica.Core.Entities.Content
            {
                TopicId = topicA.Id,
                Type = ContentType.Summary,
                Level = 2,
                Body = "A를 설명하는 내용. [[PathSug_B]] 참조.",
                Status = ContentStatus.Draft,
                GeneratedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }

        // Record session for A only
        await client.PostAsJsonAsync("/learning-sessions", new
        {
            TopicId = topicA.Id,
            DurationSeconds = 60,
            QuizScore = (int?)null,
            FlashcardsStudied = 0,
        });

        var res = await client.GetAsync("/learning-sessions/path-suggestions");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var suggestions = await res.Content.ReadFromJsonAsync<List<SuggestionDto>>();
        Assert.NotNull(suggestions);
        Assert.Contains(suggestions, s => s.Title == "PathSug_B");
    }

    private record TopicDto(Guid Id, string Title);
    private record StatsDto(
        int TotalTopicsStudied,
        int TotalStudyMinutes,
        int TodaySessionCount,
        int[] Streak7d,
        ScoreByTopicDto[] ScoreByTopic);
    private record ScoreByTopicDto(string Title, double AvgScore);
    private record SuggestionDto(Guid Id, string Title);
}
