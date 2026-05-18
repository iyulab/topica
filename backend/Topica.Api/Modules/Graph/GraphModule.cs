using Microsoft.EntityFrameworkCore;
using Topica.Api.Modules.Contents;
using Topica.Core.Enums;
using Topica.Infrastructure.Data;

namespace Topica.Api.Modules.Graph;

public static class GraphModule
{
    public static IServiceCollection AddGraphModule(this IServiceCollection services)
    {
        services.AddScoped<TopicEmbeddingService>();
        return services;
    }

    public static IEndpointRouteBuilder MapGraphEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/topics/{topicId:guid}");

        group.MapGet("/related", async (Guid topicId, TopicEmbeddingService svc, ApplicationDbContext db, CancellationToken ct) =>
        {
            var similar = await svc.FindSimilarAsync(topicId, top: 5, ct);
            if (similar.Count == 0) return Results.Ok(Array.Empty<object>());

            var ids = similar.Select(s => s.TopicId).ToList();
            var topics = await db.Topics.Where(t => ids.Contains(t.Id)).ToListAsync(ct);

            var result = similar
                .Select(s => new
                {
                    id = s.TopicId,
                    score = s.Score,
                    topic = topics.FirstOrDefault(t => t.Id == s.TopicId),
                })
                .Where(x => x.topic is not null)
                .ToList();

            return Results.Ok(result);
        });

        group.MapGet("/suggested-next", async (Guid topicId, ApplicationDbContext db, CancellationToken ct) =>
        {
            var bodies = await db.Contents
                .Where(c => c.TopicId == topicId &&
                       (c.Type == ContentType.Summary || c.Type == ContentType.Lecture))
                .Select(c => c.Body)
                .ToListAsync(ct);

            if (bodies.Count == 0) return Results.Ok(Array.Empty<string>());

            var mentioned = bodies
                .SelectMany(WikiLinkParser.Extract)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            if (mentioned.Count == 0) return Results.Ok(Array.Empty<string>());

            var existingTitles = (await db.Topics
                .Select(t => t.Title)
                .ToListAsync(ct))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            return Results.Ok(mentioned
                .Where(t => !existingTitles.Contains(t))
                .OrderBy(t => t)
                .ToList());
        });

        // Full graph: topics + their tags + embedding presence
        app.MapGet("/graph", async (ApplicationDbContext db, TopicEmbeddingService svc, CancellationToken ct) =>
        {
            var topics = await db.Topics
                .Include(t => t.Tags)
                .ToListAsync(ct);

            var result = new List<object>(topics.Count);
            foreach (var t in topics)
            {
                result.Add(new
                {
                    t.Id,
                    t.Title,
                    t.UserLevel,
                    Tags = t.Tags.Select(tag => tag.Tag).ToList(),
                    HasEmbedding = await svc.HasEmbeddingAsync(t.Id, ct),
                });
            }

            return Results.Ok(result);
        });

        return app;
    }
}
