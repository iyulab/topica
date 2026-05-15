using FluxIndex.Core.Application.Interfaces;
using FluxIndex.Core.Domain.ValueObjects;
using FluxIndex.Providers.OpenAI.Services;
using Microsoft.Extensions.Options;

namespace Topica.Api.Modules.AI;

// Singleton wrapper that lazily creates OpenAICompatibleEmbeddingService and recreates
// it when AiSettings change (OpenAI > Ollama > null priority, matching DynamicChatClient).
public sealed class DynamicEmbeddingService(
    IOptionsMonitor<AiSettings> options,
    ILoggerFactory loggerFactory) : IEmbeddingService, IDisposable
{
    private OpenAICompatibleEmbeddingService? _inner;
    private readonly object _lock = new();
    private string _cachedEndpoint = string.Empty;
    private string _cachedApiKey = string.Empty;
    private string _cachedModel = string.Empty;

    private OpenAICompatibleEmbeddingService? GetOrCreate()
    {
        var s = options.CurrentValue;

        string endpoint, apiKey, model;
        if (!string.IsNullOrWhiteSpace(s.ApiKey))
        {
            endpoint = "https://api.openai.com/v1";
            apiKey = s.ApiKey;
            model = s.EmbeddingModel;
        }
        else if (!string.IsNullOrWhiteSpace(s.OllamaEmbeddingModel))
        {
            endpoint = s.OllamaEndpoint.TrimEnd('/') + "/v1";
            apiKey = string.Empty;
            model = s.OllamaEmbeddingModel;
        }
        else
        {
            return null;
        }

        lock (_lock)
        {
            if (_inner != null
                && _cachedEndpoint == endpoint
                && _cachedApiKey == apiKey
                && _cachedModel == model)
                return _inner;

            _inner?.Dispose();
            _cachedEndpoint = endpoint;
            _cachedApiKey = apiKey;
            _cachedModel = model;
            _inner = new OpenAICompatibleEmbeddingService(
                endpoint,
                string.IsNullOrWhiteSpace(apiKey) ? null : apiKey,
                model,
                s.EmbeddingDimension,
                loggerFactory.CreateLogger<OpenAICompatibleEmbeddingService>());
            return _inner;
        }
    }

    public Task<float[]> GenerateEmbeddingAsync(string text, CancellationToken ct = default)
        => GetOrCreate()?.GenerateEmbeddingAsync(text, ct) ?? Task.FromResult<float[]>([]);

    public Task<IEnumerable<float[]>> GenerateEmbeddingsBatchAsync(
        IEnumerable<string> texts, CancellationToken ct = default)
        => GetOrCreate()?.GenerateEmbeddingsBatchAsync(texts, ct)
           ?? Task.FromResult<IEnumerable<float[]>>([]);

    public int GetEmbeddingDimension() => options.CurrentValue.EmbeddingDimension;

    public string GetModelName()
    {
        var s = options.CurrentValue;
        return !string.IsNullOrWhiteSpace(s.ApiKey) ? s.EmbeddingModel : s.OllamaEmbeddingModel;
    }
    public int GetMaxTokens() => 512;

    public Task<int> CountTokensAsync(string text, CancellationToken ct = default)
        => Task.FromResult(0);

    public EmbeddingIdentity GetIdentity()
    {
        var s = options.CurrentValue;
        var provider = !string.IsNullOrWhiteSpace(s.ApiKey) ? "OpenAI" : "Ollama";
        var model = !string.IsNullOrWhiteSpace(s.ApiKey) ? s.EmbeddingModel : s.OllamaEmbeddingModel;
        return new EmbeddingIdentity { Provider = provider, Model = model, Dimension = s.EmbeddingDimension };
    }

    public void Dispose()
    {
        lock (_lock)
        {
            _inner?.Dispose();
            _inner = null;
        }
    }
}
