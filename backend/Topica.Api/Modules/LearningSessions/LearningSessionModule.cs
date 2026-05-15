namespace Topica.Api.Modules.LearningSessions;

public static class LearningSessionModule
{
    public static IServiceCollection AddLearningSessionModule(this IServiceCollection services)
    {
        services.AddScoped<LearningSessionService>();
        return services;
    }

    public static void MapLearningSessionEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/learning-sessions");

        group.MapPost("/", async (LearningSessionRequest req, LearningSessionService svc, CancellationToken ct) =>
        {
            var session = await svc.RecordAsync(
                req.TopicId, req.DurationSeconds, req.QuizScore, req.FlashcardsStudied, ct);
            if (session is null) return Results.NotFound();
            return Results.Created($"/learning-sessions/{session.Id}", session);
        });

        group.MapGet("/stats", async (LearningSessionService svc, CancellationToken ct) =>
            Results.Ok(await svc.GetStatsAsync(ct)));
    }
}

public record LearningSessionRequest(Guid TopicId, int DurationSeconds, int? QuizScore, int FlashcardsStudied);
public record LearningStatsDto(
    int TotalTopicsStudied,
    int TotalStudyMinutes,
    int TodaySessionCount,
    int[] Streak7d,
    ScoreByTopicDto[] ScoreByTopic);
public record ScoreByTopicDto(string Title, double AvgScore);
