using Microsoft.Extensions.AI;
using OpenAI;

namespace Topica.Api.Modules.AI;

public static class AiModule
{
    public static IServiceCollection AddAiModule(this IServiceCollection services, IConfiguration config)
    {
        var openAiApiKey = config["AI:OpenAI:ApiKey"];

        if (!string.IsNullOrWhiteSpace(openAiApiKey))
        {
            var model = config["AI:OpenAI:Model"] ?? "gpt-4o-mini";
            services.AddSingleton<IChatClient>(
                new OpenAIClient(openAiApiKey).GetChatClient(model).AsIChatClient());
        }
        else
        {
            // No provider configured — use a stub for development/testing
            services.AddSingleton<IChatClient, StubChatClient>();
        }

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
        var text = "*(AI 제공자가 구성되지 않았습니다. `AI:OpenAI:ApiKey`를 설정하거나 로컬 모델을 구성하세요.)*";
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
