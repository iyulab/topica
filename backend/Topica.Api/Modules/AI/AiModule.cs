using Microsoft.Extensions.AI;
using OpenAI;

namespace Topica.Api.Modules.AI;

public static class AiModule
{
    public static IServiceCollection AddAiModule(this IServiceCollection services, IConfiguration config)
    {
        services.Configure<AiSettings>(config.GetSection("AI:OpenAI"));
        services.AddSingleton<IChatClient, DynamicChatClient>();
        return services;
    }
}

// Returns placeholder text when no AI provider is configured
internal sealed class StubChatClient : IChatClient
{
    public ChatClientMetadata Metadata => new("stub", null, null);

    public Task<ChatResponse> GetResponseAsync(
        IEnumerable<ChatMessage> messages,
        ChatOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        var text = "*(AI 제공자가 구성되지 않았습니다. 설정에서 OpenAI API 키를 입력하세요.)*";
        return Task.FromResult(new ChatResponse([new ChatMessage(ChatRole.Assistant, text)]));
    }

    public IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(
        IEnumerable<ChatMessage> messages,
        ChatOptions? options = null,
        CancellationToken cancellationToken = default)
        => throw new NotSupportedException("Stub does not support streaming");

    public object? GetService(Type serviceType, object? serviceKey = null) => null;
    public void Dispose() { }
}
