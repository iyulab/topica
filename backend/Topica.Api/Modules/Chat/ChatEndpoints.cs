using System.Text;
using System.Text.Json;
using Topica.Core.Entities;

namespace Topica.Api.Modules.Chat;

public record ChatStreamChunk
{
    public string? Delta { get; init; }
    public bool Done { get; init; }
    public ChatSession? Message { get; init; }
}

public static class ChatEndpoints
{
    public static IServiceCollection AddChatModule(this IServiceCollection services)
    {
        services.AddScoped<ChatService>();
        return services;
    }

    public static IEndpointRouteBuilder MapChatEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/topics/{topicId:guid}/chat");

        group.MapGet("/", async (Guid topicId, ChatService svc, CancellationToken ct) =>
            Results.Ok(await svc.GetHistoryAsync(topicId, ct)));

        group.MapPost("/", async (Guid topicId, ChatRequest req, ChatService svc, CancellationToken ct) =>
        {
            try
            {
                var response = await svc.SendAsync(topicId, req.Message, ct);
                return Results.Ok(response);
            }
            catch (KeyNotFoundException)
            {
                return Results.NotFound();
            }
        });

        group.MapPost("/stream", async (Guid topicId, ChatRequest req, ChatService svc, HttpContext ctx, CancellationToken ct) =>
        {
            ctx.Response.ContentType = "text/event-stream; charset=utf-8";
            ctx.Response.Headers.CacheControl = "no-cache";
            ctx.Response.Headers.Connection = "keep-alive";

            try
            {
                await foreach (var chunk in svc.SendStreamAsync(topicId, req.Message, ct))
                {
                    var data = JsonSerializer.Serialize(chunk, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
                    await ctx.Response.WriteAsync($"data: {data}\n\n", Encoding.UTF8, ct);
                    await ctx.Response.Body.FlushAsync(ct);
                }
                await ctx.Response.CompleteAsync();
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { }
        });

        group.MapDelete("/", async (Guid topicId, ChatService svc, CancellationToken ct) =>
        {
            await svc.ClearHistoryAsync(topicId, ct);
            return Results.NoContent();
        });

        return app;
    }
}

public record ChatRequest(string Message);
