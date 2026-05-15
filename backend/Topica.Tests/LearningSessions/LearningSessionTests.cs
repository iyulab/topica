using System.Net;
using System.Net.Http.Json;

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

    private record TopicDto(Guid Id, string Title);
    private record StatsDto(
        int TotalTopicsStudied,
        int TotalStudyMinutes,
        int TodaySessionCount,
        int[] Streak7d,
        ScoreByTopicDto[] ScoreByTopic);
    private record ScoreByTopicDto(string Title, double AvgScore);
}
