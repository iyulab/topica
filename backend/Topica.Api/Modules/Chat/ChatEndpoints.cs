namespace Topica.Api.Modules.Chat;

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

        group.MapDelete("/", async (Guid topicId, ChatService svc, CancellationToken ct) =>
        {
            await svc.ClearHistoryAsync(topicId, ct);
            return Results.NoContent();
        });

        return app;
    }
}

public record ChatRequest(string Message);
