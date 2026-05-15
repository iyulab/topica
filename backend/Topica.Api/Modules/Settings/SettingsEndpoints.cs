using Microsoft.Extensions.Options;
using System.Text.Json;
using System.Text.Json.Nodes;
using Topica.Api.Modules.AI;

namespace Topica.Api.Modules.Settings;

public static class SettingsEndpoints
{
    public static IEndpointRouteBuilder MapSettingsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/settings", (IOptionsMonitor<AiSettings> opts) =>
        {
            var s = opts.CurrentValue;
            return Results.Ok(new
            {
                model = s.Model,
                language = s.Language,
                hasApiKey = !string.IsNullOrWhiteSpace(s.ApiKey),
                embeddingModel = s.EmbeddingModel,
                ollamaEndpoint = s.OllamaEndpoint,
                ollamaModel = s.OllamaModel,
                ollamaEmbeddingModel = s.OllamaEmbeddingModel,
            });
        });

        app.MapPut("/settings", async (SettingsRequest req, IWebHostEnvironment env) =>
        {
            var path = Path.Combine(env.ContentRootPath, "appsettings.json");

            JsonObject root;
            if (File.Exists(path))
            {
                var raw = await File.ReadAllTextAsync(path);
                root = JsonNode.Parse(raw)?.AsObject() ?? new JsonObject();
            }
            else
            {
                root = new JsonObject();
            }

            root["AI"] ??= new JsonObject();
            root["AI"]!.AsObject()["OpenAI"] ??= new JsonObject();
            var openAi = root["AI"]!["OpenAI"]!.AsObject();

            if (!string.IsNullOrWhiteSpace(req.ApiKey))
                openAi["ApiKey"] = req.ApiKey;
            if (req.Model is not null)
                openAi["Model"] = req.Model;
            if (req.Language is not null)
                openAi["Language"] = req.Language;
            if (req.EmbeddingModel is not null)
                openAi["EmbeddingModel"] = req.EmbeddingModel;
            if (req.OllamaEndpoint is not null)
                openAi["OllamaEndpoint"] = req.OllamaEndpoint;
            if (req.OllamaModel is not null)
                openAi["OllamaModel"] = req.OllamaModel;
            if (req.OllamaEmbeddingModel is not null)
                openAi["OllamaEmbeddingModel"] = req.OllamaEmbeddingModel;

            await File.WriteAllTextAsync(path, root.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));

            return Results.Ok(new { message = "설정이 저장되었습니다." });
        });

        return app;
    }
}

public record SettingsRequest(string? ApiKey, string? Model, string? Language, string? EmbeddingModel, string? OllamaEndpoint, string? OllamaModel, string? OllamaEmbeddingModel);
