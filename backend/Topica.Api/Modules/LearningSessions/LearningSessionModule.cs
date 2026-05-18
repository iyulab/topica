using Microsoft.EntityFrameworkCore;
using Topica.Api.Modules.Contents;
using Topica.Core.Enums;
using Topica.Infrastructure.Data;

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

        group.MapGet("/review-suggestions", async (LearningSessionService svc, CancellationToken ct) =>
            Results.Ok(await svc.GetReviewSuggestionsAsync(ct)));

        group.MapGet("/path-suggestions", async (ApplicationDbContext db, CancellationToken ct) =>
        {
            var studiedIds = await db.LearningSessions
                .Select(s => s.TopicId)
                .Distinct()
                .ToListAsync(ct);

            if (studiedIds.Count == 0)
                return Results.Ok(Array.Empty<object>());

            var bodies = await db.Contents
                .Where(c => studiedIds.Contains(c.TopicId) &&
                       (c.Type == ContentType.Summary || c.Type == ContentType.Lecture))
                .Select(c => c.Body)
                .ToListAsync(ct);

            if (bodies.Count == 0)
                return Results.Ok(Array.Empty<object>());

            var mentioned = bodies
                .SelectMany(WikiLinkParser.Extract)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            if (mentioned.Count == 0)
                return Results.Ok(Array.Empty<object>());

            var allTopics = await db.Topics
                .Select(t => new { t.Id, t.Title })
                .ToListAsync(ct);

            var studiedIdSet = studiedIds.ToHashSet();

            var suggestions = allTopics
                .Where(t => mentioned.Contains(t.Title, StringComparer.OrdinalIgnoreCase) &&
                            !studiedIdSet.Contains(t.Id))
                .Select(t => new { id = t.Id, title = t.Title })
                .OrderBy(t => t.title)
                .ToList();

            return Results.Ok(suggestions);
        });

        group.MapGet("/graph-data", async (ApplicationDbContext db, CancellationToken ct) =>
        {
            var studiedIds = await db.LearningSessions
                .Select(s => s.TopicId)
                .Distinct()
                .ToListAsync(ct);

            if (studiedIds.Count == 0)
                return Results.Ok(new { nodes = Array.Empty<object>(), edges = Array.Empty<object>() });

            var studiedIdSet = studiedIds.ToHashSet();

            // Load studied topics
            var studiedTopics = await db.Topics
                .Where(t => studiedIdSet.Contains(t.Id))
                .Select(t => new { t.Id, t.Title })
                .ToListAsync(ct);

            // Load content bodies for studied topics
            var contentsByTopic = await db.Contents
                .Where(c => studiedIdSet.Contains(c.TopicId) &&
                       (c.Type == ContentType.Summary || c.Type == ContentType.Lecture))
                .Select(c => new { c.TopicId, c.Body })
                .ToListAsync(ct);

            // All topics (for wiki-link resolution)
            var allTopics = await db.Topics
                .Select(t => new { t.Id, t.Title })
                .ToListAsync(ct);
            var titleToId = allTopics
                .GroupBy(t => t.Title, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First().Id, StringComparer.OrdinalIgnoreCase);

            // Build edges: studied → connected existing un-studied
            var edgeSet = new HashSet<(Guid, Guid)>();
            var connectedUnstudied = new Dictionary<Guid, string>();

            foreach (var topic in studiedTopics)
            {
                var bodies = contentsByTopic
                    .Where(c => c.TopicId == topic.Id)
                    .Select(c => c.Body);

                var mentioned = bodies
                    .SelectMany(WikiLinkParser.Extract)
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);

                foreach (var title in mentioned)
                {
                    if (!titleToId.TryGetValue(title, out var linkedId)) continue;
                    if (linkedId == topic.Id) continue;
                    if (studiedIdSet.Contains(linkedId)) continue;

                    connectedUnstudied.TryAdd(linkedId, title);
                    edgeSet.Add((topic.Id, linkedId));
                }
            }

            var nodes = studiedTopics
                .Select(t => new { id = t.Id, title = t.Title, studied = true })
                .Concat(connectedUnstudied.Select(kvp => new { id = kvp.Key, title = kvp.Value, studied = false }))
                .Cast<object>()
                .ToList();

            var edges = edgeSet
                .Select(e => new { source = e.Item1, target = e.Item2 })
                .Cast<object>()
                .ToList();

            return Results.Ok(new { nodes, edges });
        });
    }
}

public record LearningSessionRequest(Guid TopicId, int DurationSeconds, int? QuizScore, int FlashcardsStudied);
public record ReviewSuggestionDto(Guid Id, string Title, double AvgScore);
public record LearningStatsDto(
    int TotalTopicsStudied,
    int TotalStudyMinutes,
    int TodaySessionCount,
    int[] Streak7d,
    ScoreByTopicDto[] ScoreByTopic);
public record ScoreByTopicDto(string Title, double AvgScore);
