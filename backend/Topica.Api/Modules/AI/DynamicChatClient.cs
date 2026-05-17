using Microsoft.Extensions.AI;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using OpenAI;
using System.ClientModel;

namespace Topica.Api.Modules.AI;

// Wraps IChatClient to pick up settings changes without restart.
// OpenAI > Ollama > local(lm-supply) priority. Creates the underlying cloud client per-call.
public class DynamicChatClient(
    IOptionsMonitor<AiSettings> options,
    [FromKeyedServices("local")] IChatClient localChat) : IChatClient
{
    public ChatClientMetadata Metadata => new("dynamic", null, null);

    private IChatClient CreateInner()
    {
        var settings = options.CurrentValue;
        if (!string.IsNullOrWhiteSpace(settings.ApiKey))
            return new OpenAIClient(settings.ApiKey)
                .GetChatClient(settings.Model).AsIChatClient();
        if (!string.IsNullOrWhiteSpace(settings.OllamaModel))
        {
            var endpoint = new Uri(settings.OllamaEndpoint.TrimEnd('/') + "/v1");
            var ollamaKey = !string.IsNullOrWhiteSpace(settings.OllamaApiKey) ? settings.OllamaApiKey : "ollama";
            return new OpenAIClient(
                new ApiKeyCredential(ollamaKey),
                new OpenAIClientOptions { Endpoint = endpoint })
                .GetChatClient(settings.OllamaModel).AsIChatClient();
        }
        return localChat;
    }

    public Task<ChatResponse> GetResponseAsync(
        IEnumerable<ChatMessage> messages,
        ChatOptions? options = null,
        CancellationToken cancellationToken = default)
        => CreateInner().GetResponseAsync(messages, options, cancellationToken);

    public IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(
        IEnumerable<ChatMessage> messages,
        ChatOptions? options = null,
        CancellationToken cancellationToken = default)
        => CreateInner().GetStreamingResponseAsync(messages, options, cancellationToken);

    public object? GetService(Type serviceType, object? serviceKey = null) => null;
    public void Dispose() { }
}
