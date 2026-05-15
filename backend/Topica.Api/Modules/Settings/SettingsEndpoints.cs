using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;
using System.Text.Json;
using Topica.Api.Modules.AI;
using Topica.Api.Modules.Graph;
using Topica.Api.Modules.RAG;
using Topica.Infrastructure.Data;

namespace Topica.Api.Modules.Settings;

public static class SettingsEndpoints
{
    public static IServiceCollection AddSettingsServices(this IServiceCollection services)
    {
        services.AddSingleton<IWritableOptions<AiSettings>>(sp =>
            new JsonFileWritableOptions<AiSettings>(
                sp.GetRequiredService<IOptionsMonitor<AiSettings>>(),
                sp.GetRequiredService<IWebHostEnvironment>(),
                "AI:OpenAI"));
        return services;
    }

    public static IEndpointRouteBuilder MapSettingsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/settings", (
            IOptionsMonitor<AiSettings> opts,
            [FromKeyedServices("local")] IChatClient localChat,
            [FromKeyedServices("local")] FluxIndex.Core.Application.Interfaces.IEmbeddingService localEmbedding) =>
        {
            var s = opts.CurrentValue;
            var chatStatus = localChat as ILmSupplyStatus;
            var embeddingStatus = localEmbedding as ILmSupplyStatus;
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
                chatProvider = !string.IsNullOrWhiteSpace(s.ApiKey) ? "openai"
                             : !string.IsNullOrWhiteSpace(s.OllamaModel) ? "ollama"
                             : "local",
                embeddingProvider = !string.IsNullOrWhiteSpace(s.ApiKey) ? "openai"
                                  : !string.IsNullOrWhiteSpace(s.OllamaEmbeddingModel) ? "ollama"
                                  : "local",
                localChatLoading = chatStatus?.IsLoading ?? false,
                localChatReady = chatStatus?.IsReady ?? false,
                localChatFailed = chatStatus?.IsFailed ?? false,
                localEmbeddingLoading = embeddingStatus?.IsLoading ?? false,
                localEmbeddingReady = embeddingStatus?.IsReady ?? false,
                localEmbeddingFailed = embeddingStatus?.IsFailed ?? false,
            });
        });

        app.MapPut("/settings", async (SettingsRequest req, IWritableOptions<AiSettings> settings) =>
        {
            var prev = settings.Value;
            bool reindexRequired =
                (req.EmbeddingModel is not null && req.EmbeddingModel != prev.EmbeddingModel) ||
                (req.OllamaEmbeddingModel is not null && req.OllamaEmbeddingModel != prev.OllamaEmbeddingModel) ||
                (req.EmbeddingDimension is not null && req.EmbeddingDimension.Value != prev.EmbeddingDimension);

            await settings.UpdateAsync(s =>
            {
                if (!string.IsNullOrWhiteSpace(req.ApiKey)) s.ApiKey = req.ApiKey;
                if (req.Model is not null) s.Model = req.Model;
                if (req.Language is not null) s.Language = req.Language;
                if (req.EmbeddingModel is not null) s.EmbeddingModel = req.EmbeddingModel;
                if (req.EmbeddingDimension is not null) s.EmbeddingDimension = req.EmbeddingDimension.Value;
                if (req.OllamaEndpoint is not null) s.OllamaEndpoint = req.OllamaEndpoint;
                if (req.OllamaModel is not null) s.OllamaModel = req.OllamaModel;
                if (req.OllamaEmbeddingModel is not null) s.OllamaEmbeddingModel = req.OllamaEmbeddingModel;
            });

            return Results.Ok(new { message = "설정이 저장되었습니다.", reindexRequired });
        });

        app.MapPost("/settings/reindex", async (
            ApplicationDbContext db,
            TopicEmbeddingService topicEmbedding,
            RagService rag,
            ILogger<Program> logger,
            CancellationToken ct) =>
        {
            var topicIds = await db.Topics.Select(t => t.Id).ToListAsync(ct);
            int topicCount = 0, ragCount = 0;

            foreach (var topicId in topicIds)
            {
                await topicEmbedding.EmbedTopicAsync(topicId, ct);
                topicCount++;

                var docs = await db.ResearchDocs.Where(d => d.TopicId == topicId).ToListAsync(ct);
                if (docs.Count > 0)
                {
                    await rag.IndexTopicAsync(topicId, docs, ct);
                    ragCount++;
                }
            }

            logger.LogInformation("Reindex complete: {Topics} topics, {Rag} RAG re-indexed", topicCount, ragCount);
            return Results.Ok(new { message = "재색인 완료", topicsReindexed = topicCount, ragReindexed = ragCount });
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
