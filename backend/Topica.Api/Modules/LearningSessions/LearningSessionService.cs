using Microsoft.EntityFrameworkCore;
using Topica.Core.Entities;
using Topica.Infrastructure.Data;

namespace Topica.Api.Modules.LearningSessions;

public class LearningSessionService(ApplicationDbContext db)
{
    public async Task<LearningSession?> RecordAsync(
        Guid topicId, int durationSeconds, int? quizScore, int flashcardsStudied,
        CancellationToken ct = default)
    {
        var topicExists = await db.Topics.AnyAsync(t => t.Id == topicId, ct);
        if (!topicExists) return null;

        var session = new LearningSession
        {
            TopicId = topicId,
            DurationSeconds = durationSeconds,
            QuizScore = quizScore,
            FlashcardsStudied = flashcardsStudied,
        };
        db.LearningSessions.Add(session);
        await db.SaveChangesAsync(ct);
        return session;
    }

    public async Task<LearningStatsDto> GetStatsAsync(CancellationToken ct = default)
    {
        var today = DateTime.UtcNow.Date;

        var totalTopicsStudied = await db.LearningSessions
            .Select(s => s.TopicId).Distinct().CountAsync(ct);

        var totalDurationSeconds = await db.LearningSessions
            .SumAsync(s => (int?)s.DurationSeconds, ct) ?? 0;
        var totalStudyMinutes = totalDurationSeconds / 60;

        var todaySessionCount = await db.LearningSessions
            .CountAsync(s => s.StartedAt >= today, ct);

        var since = today.AddDays(-6);
        var byDay = await db.LearningSessions
            .Where(s => s.StartedAt >= since)
            .GroupBy(s => s.StartedAt.Date)
            .Select(g => new { Day = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        var streak7d = Enumerable.Range(0, 7)
            .Select(i => byDay.FirstOrDefault(x => x.Day == today.AddDays(-i))?.Count ?? 0)
            .ToArray();

        var scoreByTopic = await db.LearningSessions
            .Where(s => s.QuizScore.HasValue)
            .GroupBy(s => s.Topic.Title)
            .Select(g => new ScoreByTopicDto(g.Key, g.Average(s => (double)s.QuizScore!.Value)))
            .ToArrayAsync(ct);

        return new LearningStatsDto(
            totalTopicsStudied,
            totalStudyMinutes,
            todaySessionCount,
            streak7d,
            scoreByTopic);
    }
}
