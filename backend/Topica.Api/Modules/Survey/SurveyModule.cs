using System.Text;
using System.Text.Json;

namespace Topica.Api.Modules.Survey;

public static class SurveyModule
{
    public static IServiceCollection AddSurveyModule(this IServiceCollection services)
    {
        services.AddScoped<SurveyService>();
        return services;
    }

    public static void MapSurveyEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/topics/{topicId:guid}/survey");

        group.MapGet("/", async (Guid topicId, SurveyService svc, HttpContext ctx, CancellationToken ct) =>
        {
            ctx.Response.ContentType = "text/event-stream; charset=utf-8";
            ctx.Response.Headers.CacheControl = "no-cache";
            ctx.Response.Headers.Connection = "keep-alive";

            await foreach (var question in svc.StreamQuestionsAsync(topicId, ct))
            {
                var data = JsonSerializer.Serialize(new { question });
                var line = $"data: {data}\n\n";
                await ctx.Response.WriteAsync(line, Encoding.UTF8, ct);
                await ctx.Response.Body.FlushAsync(ct);
            }

            await ctx.Response.WriteAsync("data: {\"done\":true}\n\n", Encoding.UTF8, ct);
            await ctx.Response.Body.FlushAsync(ct);
        });

        group.MapPost("/answers", async (Guid topicId, SurveyAnswers req, SurveyService svc, CancellationToken ct) =>
        {
            await svc.SaveAnswersAsync(topicId, req.Answers, ct);
            return Results.Ok();
        });
    }
}

public record SurveyAnswers(List<string> Answers);
