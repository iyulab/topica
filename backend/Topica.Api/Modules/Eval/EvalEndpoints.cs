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

        return app;
    }
}

public record EvalRequest(Guid ContentId, int Score, int Total);
