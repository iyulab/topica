using Microsoft.AspNetCore.Mvc;
using System.Text;
using System.Text.Json;
using Topica.Core.Entities;
using Topica.Core.Enums;
using Topica.Core.Interfaces;

namespace Topica.Api.Modules.Contents;

public record ContentStreamChunk
{
    public string? Delta { get; init; }
    public bool Done { get; init; }
    public Content? Content { get; init; }
}

public static class ContentEndpoints
{
    public static IServiceCollection AddContentModule(this IServiceCollection services)
    {
        services.AddScoped<ContentService>();
        services.AddScoped<IStreamingContentGenerator, SummaryGenerator>();
        services.AddScoped<IStreamingContentGenerator, LectureGenerator>();
        services.AddScoped<IStreamingContentGenerator, FlashcardGenerator>();
        services.AddScoped<IStreamingContentGenerator, QuizGenerator>();
        services.AddScoped<IContentGenerator, SummaryGenerator>();
        services.AddScoped<IContentGenerator, LectureGenerator>();
        services.AddScoped<IContentGenerator, FlashcardGenerator>();
        services.AddScoped<IContentGenerator, QuizGenerator>();
        services.AddScoped<IContentGenerator, MindmapGenerator>();
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
                var (content, isNew) = await svc.GenerateAsync(topicId, req.Type, req.Level, ct);
                return isNew
                    ? Results.Created($"/topics/{topicId}/contents/{content.Id}", content)
                    : Results.Ok(content);
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

        group.MapPost("/stream", async (
            Guid topicId,
            [FromBody] GenerateContentRequest req,
            ContentService svc,
            HttpContext ctx,
            CancellationToken ct) =>
        {
            ctx.Response.ContentType = "text/event-stream; charset=utf-8";
            ctx.Response.Headers.CacheControl = "no-cache";
            ctx.Response.Headers.Connection = "keep-alive";

            await foreach (var chunk in svc.StreamGenerateAsync(topicId, req.Type, req.Level, ct))
            {
                var data = JsonSerializer.Serialize(chunk, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
                await ctx.Response.WriteAsync($"data: {data}\n\n", Encoding.UTF8, ct);
                await ctx.Response.Body.FlushAsync(ct);
            }
            await ctx.Response.CompleteAsync();
        });

        return app;
    }
}

public record GenerateContentRequest(ContentType Type, int Level = 1);
