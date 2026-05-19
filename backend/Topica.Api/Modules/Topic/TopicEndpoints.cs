using Microsoft.AspNetCore.Mvc;
using Topica.Api.Modules.Queue;
using Topica.Api.Modules.Research;

namespace Topica.Api.Modules.Topics;

public static class TopicEndpoints
{
    public static IServiceCollection AddTopicModule(this IServiceCollection services)
    {
        services.AddScoped<TopicService>();
        return services;
    }

    public static IEndpointRouteBuilder MapTopicEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/topics");

        group.MapGet("/", async (
            [FromQuery] string? q,
            [FromQuery] string? tags,
            [FromQuery] string? sort,
            TopicService svc,
            CancellationToken ct) =>
        {
            var tagList = string.IsNullOrWhiteSpace(tags)
                ? null
                : tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            var topics = await svc.SearchAsync(q, tagList, sort, ct);
            return Results.Ok(topics);
        });

        group.MapGet("/{id:guid}", async (Guid id, TopicService svc, CancellationToken ct) =>
        {
            var topic = await svc.GetByIdAsync(id, ct);
            return topic is not null ? Results.Ok(topic) : Results.NotFound();
        });

        group.MapPost("/", async (
            [FromBody] CreateTopicRequest req,
            TopicService svc,
            IServiceProvider sp,
            ContentQueueService queue,
            ILogger<Program> logger,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(req.Title))
                return Results.BadRequest("Title is required.");

            var level = req.UserLevel is >= 1 and <= 10 ? req.UserLevel : 1;
            var topic = await svc.CreateAsync(req.Title.Trim(), level, ct);

            // Start web research in background
            _ = Task.Run(async () =>
            {
                try
                {
                    await using var scope = sp.CreateAsyncScope();
                    var researchSvc = scope.ServiceProvider.GetRequiredService<ResearchService>();
                    await researchSvc.RunResearchAsync(topic.Id);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Background research failed for topic {TopicId}", topic.Id);
                }
            });

            // Enqueue default content generation (Summary + Lecture)
            await queue.EnqueueDefaultsForTopicAsync(topic.Id, level, ct);

            return Results.Created($"/topics/{topic.Id}", topic);
        });

        group.MapPatch("/{id:guid}", async (Guid id, [FromBody] UpdateTopicRequest req, TopicService svc, CancellationToken ct) =>
        {
            var topic = await svc.UpdateAsync(id, req.Title?.Trim(), req.UserLevel, ct);
            return topic is not null ? Results.Ok(topic) : Results.NotFound();
        });

        group.MapDelete("/{id:guid}", async (Guid id, TopicService svc, CancellationToken ct) =>
        {
            var deleted = await svc.DeleteAsync(id, ct);
            return deleted ? Results.NoContent() : Results.NotFound();
        });

        return app;
    }
}

public record CreateTopicRequest(string Title, int UserLevel = 1);
public record UpdateTopicRequest(string? Title, int? UserLevel);
