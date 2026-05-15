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
                embeddingDimension = s.EmbeddingDimension,
                ollamaEndpoint = s.OllamaEndpoint,
                ollamaModel = s.OllamaModel,
                ollamaEmbeddingModel = s.OllamaEmbeddingModel,
            });
        });

        app.MapPut("/settings", async (SettingsRequest req, IWebHostEnvironment env, IOptionsMonitor<AiSettings> opts) =>
        {
            var prev = opts.CurrentValue;
            bool reindexRequired =
                (req.EmbeddingModel is not null && req.EmbeddingModel != prev.EmbeddingModel) ||
                (req.OllamaEmbeddingModel is not null && req.OllamaEmbeddingModel != prev.OllamaEmbeddingModel) ||
                (req.EmbeddingDimension is not null && req.EmbeddingDimension.Value != prev.EmbeddingDimension);

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
            if (req.EmbeddingDimension is not null)
                openAi["EmbeddingDimension"] = req.EmbeddingDimension.Value;
            if (req.OllamaEndpoint is not null)
                openAi["OllamaEndpoint"] = req.OllamaEndpoint;
            if (req.OllamaModel is not null)
                openAi["OllamaModel"] = req.OllamaModel;
            if (req.OllamaEmbeddingModel is not null)
                openAi["OllamaEmbeddingModel"] = req.OllamaEmbeddingModel;

            await File.WriteAllTextAsync(path, root.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));

            return Results.Ok(new { message = "설정이 저장되었습니다.", reindexRequired });
        });

        app.MapGet("/ollama/embedding-dimension", async (string? endpoint, string? model, ILogger<Program> logger) =>
        {
            var ollamaBase = (endpoint ?? "http://localhost:11434").TrimEnd('/');
            var modelName = model ?? string.Empty;

            if (string.IsNullOrWhiteSpace(modelName))
                return Results.BadRequest(new { error = "model 파라미터가 필요합니다." });

            try
            {
                using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
                var body = JsonSerializer.Serialize(new { model = modelName, input = "dimension-probe" });
                var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");
                var response = await http.PostAsync($"{ollamaBase}/api/embed", content);

                if (!response.IsSuccessStatusCode)
                {
                    var err = await response.Content.ReadAsStringAsync();
                    logger.LogWarning("Ollama /api/embed 실패 ({Status}): {Err}", response.StatusCode, err);
                    return Results.BadRequest(new { error = $"Ollama 응답 오류: {response.StatusCode}" });
                }

                var json = await response.Content.ReadAsStringAsync();
                var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("embeddings", out var embeddings)
                    && embeddings.GetArrayLength() > 0)
                {
                    var dim = embeddings[0].GetArrayLength();
                    return Results.Ok(new { dimension = dim });
                }

                return Results.BadRequest(new { error = "Ollama 응답에서 embeddings 필드를 찾을 수 없습니다." });
            }
            catch (HttpRequestException ex)
            {
                logger.LogWarning(ex, "Ollama 연결 실패");
                return Results.BadRequest(new { error = $"Ollama 연결 실패: {ex.Message}" });
            }
            catch (TaskCanceledException)
            {
                return Results.BadRequest(new { error = "Ollama 요청 타임아웃 (15초)" });
            }
        });

        return app;
    }
}

public record SettingsRequest(
    string? ApiKey,
    string? Model,
    string? Language,
    string? EmbeddingModel,
    int? EmbeddingDimension,
    string? OllamaEndpoint,
    string? OllamaModel,
    string? OllamaEmbeddingModel);
