using FluxIndex.Core.Application.Interfaces;
using FluxIndex.Core.Domain.ValueObjects;
using LMSupply.Embedder;

namespace Topica.Api.Modules.AI;

// IEmbeddingService wrapping LMSupply.Embedder.
// LoadAsync starts on construction; inference calls return empty until model is ready.
public sealed class LMSupplyEmbeddingAdapter : IEmbeddingService, ILmSupplyStatus
{
    private readonly Task<IEmbeddingModel?> _loadTask;
    private readonly ILogger<LMSupplyEmbeddingAdapter> _logger;

    public LMSupplyEmbeddingAdapter(ILogger<LMSupplyEmbeddingAdapter> logger)
    {
        _logger = logger;
        _loadTask = LoadAsync();
    }

    private async Task<IEmbeddingModel?> LoadAsync()
    {
        try
        {
            return await LocalEmbedder.Pool.GetOrLoadAsync("auto");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "lm-supply 임베딩 모델 로드 실패");
            return null;
        }
    }

    public async Task<float[]> GenerateEmbeddingAsync(string text, CancellationToken ct = default)
    {
        var model = await GetModelAsync();
        if (model is null) return [];
        return await model.EmbedAsync(text, ct);
    }

    public async Task<IEnumerable<float[]>> GenerateEmbeddingsBatchAsync(
        IEnumerable<string> texts, CancellationToken ct = default)
    {
        var model = await GetModelAsync();
        if (model is null) return [];
        return await model.EmbedAsync(texts.ToList(), ct);
    }

    public bool IsLoading => !_loadTask.IsCompleted;
    public bool IsReady => _loadTask.IsCompletedSuccessfully && _loadTask.Result != null;
    public bool IsFailed => _loadTask.IsFaulted;

    public int GetEmbeddingDimension()
        => _loadTask.IsCompletedSuccessfully && _loadTask.Result is { } m ? m.Dimensions : 0;

    public string GetModelName() => "local";

    public int GetMaxTokens() => 512;

    public Task<int> CountTokensAsync(string text, CancellationToken ct = default)
        => Task.FromResult(0);

    public EmbeddingIdentity GetIdentity() => new()
    {
        Provider = "local",
        Model = "auto",
        Dimension = GetEmbeddingDimension(),
    };

    private async Task<IEmbeddingModel?> GetModelAsync()
    {
        try { return await _loadTask; }
        catch { return null; }
    }
}
