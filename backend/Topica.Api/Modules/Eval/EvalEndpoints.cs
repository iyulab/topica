using Microsoft.EntityFrameworkCore;
using Topica.Core.Entities;
using Topica.Infrastructure.Data;

namespace Topica.Api.Modules.Eval;

public static class EvalEndpoints
{
    public static IEndpointRouteBuilder MapEvalEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/topics/{topicId:guid}/eval");

        group.MapPost("/", async (Guid topicId, EvalRequest req, ApplicationDbContext db, CancellationToken ct) =>
        {
            var topic = await db.Topics.FindAsync([topicId], ct);
            if (topic is null) return Results.NotFound();

            var content = await db.Contents.FindAsync([req.ContentId], ct);
            if (content is null) return Results.BadRequest("Content not found");

            float ratio = req.Total > 0 ? (float)req.Score / req.Total : 0f;
            int levelBefore = topic.UserLevel;
            int levelAfter = levelBefore;

            if (ratio >= 0.8f) levelAfter = Math.Min(10, levelBefore + 1);
            else if (ratio <= 0.4f) levelAfter = Math.Max(1, levelBefore - 1);

            var session = new EvalSession
            {
                TopicId = topicId,
                ContentId = req.ContentId,
                Score = ratio,
                LevelBefore = levelBefore,
                LevelAfter = levelAfter,
            };

            db.EvalSessions.Add(session);

            if (levelAfter != levelBefore)
            {
                topic.UserLevel = levelAfter;
                topic.UpdatedAt = DateTime.UtcNow;
            }

            await db.SaveChangesAsync(ct);
            return Results.Ok(new { newLevel = levelAfter, levelChanged = levelAfter != levelBefore });
        });

        group.MapGet("/history", async (Guid topicId, ApplicationDbContext db, CancellationToken ct) =>
        {
            var sessions = await db.EvalSessions
                .Where(e => e.TopicId == topicId)
                .OrderByDescending(e => e.CreatedAt)
                .Take(20)
                .Select(e => new { e.Score, e.LevelBefore, e.LevelAfter, e.CreatedAt })
                .ToListAsync(ct);
            return Results.Ok(sessions);
        });

        group.MapGet("/recommendation", async (Guid topicId, ApplicationDbContext db, CancellationToken ct) =>
        {
            var topic = await db.Topics.FindAsync([topicId], ct);
            if (topic is null) return Results.NotFound();

            var scores = await db.EvalSessions
                .Where(e => e.TopicId == topicId)
                .OrderByDescending(e => e.CreatedAt)
                .Take(5)
                .Select(e => e.Score)
                .ToListAsync(ct);

            var since = DateTime.UtcNow.AddDays(-7);
            var recentSessionCount = await db.LearningSessions
                .CountAsync(s => s.TopicId == topicId && s.StartedAt >= since, ct);

            if (scores.Count == 0)
            {
                var noHistoryReason = recentSessionCount > 0
                    ? $"퀴즈 이력 없음 (최근 7일 학습 {recentSessionCount}회) — 퀴즈로 레벨을 확인해보세요"
                    : "학습 및 퀴즈 이력이 없습니다";
                return Results.Ok(new { recommendedLevel = topic.UserLevel, hasHistory = false, avgScore = (float?)null, reason = noHistoryReason });
            }

            var avg = scores.Average();
            int recommended = topic.UserLevel;
            if (avg >= 0.75f) recommended = Math.Min(10, topic.UserLevel + 1);
            else if (avg <= 0.45f) recommended = Math.Max(1, topic.UserLevel - 1);

            int pct = (int)Math.Round(avg * 100);
            string sessionSuffix = recentSessionCount > 0 ? $", 최근 7일 학습 {recentSessionCount}회" : "";
            string direction = recommended > topic.UserLevel ? "수준 향상 권장"
                : recommended < topic.UserLevel ? "레벨 낮춰 복습 권장"
                : "현재 레벨 유지";
            string reason = $"최근 퀴즈 {scores.Count}회 평균 {pct}%{sessionSuffix} — {direction}";

            return Results.Ok(new { recommendedLevel = recommended, hasHistory = true, avgScore = avg, reason });
        });

        return app;
    }
}

public record EvalRequest(Guid ContentId, int Score, int Total);
