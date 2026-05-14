namespace Topica.Api.Modules.Tag;

public static class TagModule
{
    public static IServiceCollection AddTagModule(this IServiceCollection services)
    {
        services.AddScoped<TagService>();
        return services;
    }

    public static IEndpointRouteBuilder MapTagEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/topics/{topicId:guid}/tags");

        group.MapGet("/", async (Guid topicId, TagService svc, CancellationToken ct) =>
            Results.Ok(await svc.GetTagsAsync(topicId, ct)));

        group.MapPost("/generate", async (Guid topicId, TagService svc, TagGenerateRequest req, CancellationToken ct) =>
        {
            await svc.GenerateTagsAsync(topicId, req.SummaryContent, ct);
            return Results.Ok(await svc.GetTagsAsync(topicId, ct));
        });

        return app;
    }
}

public record TagGenerateRequest(string SummaryContent);
