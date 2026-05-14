using Microsoft.EntityFrameworkCore;
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

        // Full graph: topics + their tags
        app.MapGet("/graph", async (ApplicationDbContext db, CancellationToken ct) =>
        {
            var topics = await db.Topics
                .Include(t => t.Tags)
                .Select(t => new
                {
                    t.Id,
                    t.Title,
                    t.UserLevel,
                    Tags = t.Tags.Select(tag => tag.Tag).ToList(),
                    HasEmbedding = db.TopicEmbeddings.Any(e => e.TopicId == t.Id),
                })
                .ToListAsync(ct);

            return Results.Ok(topics);
        });

        return app;
    }
}
