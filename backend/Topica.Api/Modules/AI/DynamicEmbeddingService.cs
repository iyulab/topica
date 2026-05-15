using FluxIndex.Core.Application.Interfaces;
using FluxIndex.Core.Domain.ValueObjects;
using FluxIndex.Providers.OpenAI.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Topica.Api.Modules.AI;

// Singleton wrapper that lazily creates OpenAICompatibleEmbeddingService and recreates
// it when AiSettings change (OpenAI > Ollama > local fallback priority, matching DynamicChatClient).
public sealed class DynamicEmbeddingService(
    IOptionsMonitor<AiSettings> options,
    ILoggerFactory loggerFactory,
    [FromKeyedServices("local")] IEmbeddingService localEmbedding) : IEmbeddingService, IDisposable
{
    private OpenAICompatibleEmbeddingService? _inner;
    private readonly object _lock = new();
    private string _cachedEndpoint = string.Empty;
    private string _cachedApiKey = string.Empty;
    private string _cachedModel = string.Empty;

    private IEmbeddingService GetOrCreate()
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
            return localEmbedding;
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
        => GetOrCreate().GenerateEmbeddingAsync(text, ct);

    public Task<IEnumerable<float[]>> GenerateEmbeddingsBatchAsync(
        IEnumerable<string> texts, CancellationToken ct = default)
        => GetOrCreate().GenerateEmbeddingsBatchAsync(texts, ct);

    public int GetEmbeddingDimension()
    {
        var s = options.CurrentValue;
        if (!string.IsNullOrWhiteSpace(s.ApiKey) || !string.IsNullOrWhiteSpace(s.OllamaEmbeddingModel))
            return s.EmbeddingDimension;
        return localEmbedding.GetEmbeddingDimension();
    }

    public string GetModelName()
    {
        var s = options.CurrentValue;
        if (!string.IsNullOrWhiteSpace(s.ApiKey)) return s.EmbeddingModel;
        if (!string.IsNullOrWhiteSpace(s.OllamaEmbeddingModel)) return s.OllamaEmbeddingModel;
        return localEmbedding.GetModelName();
    }

    public int GetMaxTokens() => 512;

    public Task<int> CountTokensAsync(string text, CancellationToken ct = default)
        => Task.FromResult(0);

    public EmbeddingIdentity GetIdentity()
    {
        var s = options.CurrentValue;
        if (!string.IsNullOrWhiteSpace(s.ApiKey))
            return new EmbeddingIdentity { Provider = "OpenAI", Model = s.EmbeddingModel, Dimension = s.EmbeddingDimension };
        if (!string.IsNullOrWhiteSpace(s.OllamaEmbeddingModel))
            return new EmbeddingIdentity { Provider = "Ollama", Model = s.OllamaEmbeddingModel, Dimension = s.EmbeddingDimension };
        return localEmbedding.GetIdentity();
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
