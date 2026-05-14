using Microsoft.AspNetCore.Mvc;
using Topica.Core.Enums;
using Topica.Core.Interfaces;

namespace Topica.Api.Modules.Contents;

public static class ContentEndpoints
{
    public static IServiceCollection AddContentModule(this IServiceCollection services)
    {
        services.AddScoped<ContentService>();
        services.AddScoped<IContentGenerator, SummaryGenerator>();
        services.AddScoped<IContentGenerator, LectureGenerator>();
        return services;
    }

    public static IEndpointRouteBuilder MapContentEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/topics/{topicId:guid}/contents");

        group.MapGet("/", async (Guid topicId, ContentService svc, CancellationToken ct) =>
            Results.Ok(await svc.GetContentsAsync(topicId, ct)));

        group.MapGet("/{contentId:guid}", async (Guid topicId, Guid contentId, ContentService svc, CancellationToken ct) =>
        {
            var content = await svc.GetContentAsync(topicId, contentId, ct);
            return content is not null ? Results.Ok(content) : Results.NotFound();
        });

        group.MapPost("/generate", async (
            Guid topicId,
            [FromBody] GenerateContentRequest req,
            ContentService svc,
            CancellationToken ct) =>
        {
            try
            {
                var content = await svc.GenerateAsync(topicId, req.Type, req.Level, ct);
                return Results.Created($"/topics/{topicId}/contents/{content.Id}", content);
            }
            catch (KeyNotFoundException)
            {
                return Results.NotFound();
            }
            catch (NotSupportedException ex)
            {
                return Results.BadRequest(ex.Message);
            }
        });

        return app;
    }
}

public record GenerateContentRequest(ContentType Type, int Level = 1);
