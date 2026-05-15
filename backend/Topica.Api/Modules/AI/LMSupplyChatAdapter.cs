using LMSupply.Generator;
using LMSupply.Generator.Abstractions;
using Microsoft.Extensions.AI;
using LMChatMessage = LMSupply.Generator.Models.ChatMessage;

namespace Topica.Api.Modules.AI;

// IChatClient wrapping LMSupply.Generator.
// LoadAsync starts on construction; returns "준비 중" message until model is ready.
public sealed class LMSupplyChatAdapter : IChatClient, ILmSupplyStatus
{
    private readonly Task<IGeneratorModel?> _loadTask;
    private readonly ILogger<LMSupplyChatAdapter> _logger;

    public ChatClientMetadata Metadata => new("local", null, null);

    public bool IsLoading => !_loadTask.IsCompleted;
    public bool IsReady => _loadTask.IsCompletedSuccessfully && _loadTask.Result != null;
    public bool IsFailed => _loadTask.IsFaulted;

    public LMSupplyChatAdapter(ILogger<LMSupplyChatAdapter> logger)
    {
        _logger = logger;
        _loadTask = LoadAsync();
    }

    private async Task<IGeneratorModel?> LoadAsync()
    {
        try
        {
            return await LocalGenerator.Pool.GetOrLoadAsync("auto");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "lm-supply 생성 모델 로드 실패");
            return null;
        }
    }

    public async Task<ChatResponse> GetResponseAsync(
        IEnumerable<ChatMessage> messages,
        ChatOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        var model = await GetModelAsync();
        if (model is null)
        {
            const string notReady = "*(로컬 모델 준비 중입니다. 잠시 후 재시도해주세요.)*";
            return new ChatResponse([new ChatMessage(ChatRole.Assistant, notReady)]);
        }

        var text = await model.GenerateChatCompleteAsync(
            MapMessages(messages), cancellationToken: cancellationToken);
        return new ChatResponse([new ChatMessage(ChatRole.Assistant, text)]);
    }

    public async IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(
        IEnumerable<ChatMessage> messages,
        ChatOptions? options = null,
        [System.Runtime.CompilerServices.EnumeratorCancellation]
        CancellationToken cancellationToken = default)
    {
        var model = await GetModelAsync();
        if (model is null)
        {
            yield return new ChatResponseUpdate
            {
                Role = ChatRole.Assistant,
                Contents = [new TextContent("*(로컬 모델 준비 중입니다.)*")]
            };
            yield break;
        }

        await foreach (var token in model.GenerateChatAsync(
            MapMessages(messages), cancellationToken: cancellationToken))
        {
            yield return new ChatResponseUpdate
            {
                Role = ChatRole.Assistant,
                Contents = [new TextContent(token)]
            };
        }
    }

    public object? GetService(Type serviceType, object? serviceKey = null) => null;
    public void Dispose() { }

    private async Task<IGeneratorModel?> GetModelAsync()
    {
        try { return await _loadTask; }
        catch { return null; }
    }

    private static IEnumerable<LMChatMessage> MapMessages(IEnumerable<ChatMessage> messages)
    {
        foreach (var m in messages)
        {
            if (m.Role == ChatRole.System)
                yield return LMChatMessage.System(m.Text ?? string.Empty);
            else if (m.Role == ChatRole.Assistant)
                yield return LMChatMessage.Assistant(m.Text ?? string.Empty);
            else if (m.Role == ChatRole.Tool)
            {
                var result = m.Contents.OfType<FunctionResultContent>().FirstOrDefault();
                var callId = result?.CallId ?? string.Empty;
                var content = result?.Result?.ToString() ?? m.Text ?? string.Empty;
                yield return LMChatMessage.ToolResult(callId, content);
            }
            else
                yield return LMChatMessage.User(m.Text ?? string.Empty);
        }
    }
}
