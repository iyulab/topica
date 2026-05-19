using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;
using System.Runtime.CompilerServices;
using Topica.Api.Modules.AI;
using Topica.Core.Entities;
using Topica.Core.Enums;
using Topica.Core.Interfaces;

namespace Topica.Api.Modules.Contents;

public class QuizGenerator(IChatClient chatClient, IOptionsMonitor<AiSettings> options) : IStreamingContentGenerator
{
    private static readonly ChatOptions JsonOptions = new()
    {
        ResponseFormat = ChatResponseFormat.Json,
    };

    public ContentType Type => ContentType.Quiz;

    public async Task<Content> GenerateAsync(
        Topic topic,
        IReadOnlyList<ResearchDoc> research,
        int level,
        CancellationToken ct = default)
    {
        var lang = options.CurrentValue.Language;
        var ctx = PromptBuilder.ResearchContext(research, lang);
        var prompt = PromptBuilder.Quiz(topic, ctx, level, lang);
        var response = await chatClient.GetResponseAsync(prompt, JsonOptions, ct);

        return new Content
        {
            TopicId = topic.Id,
            Type = ContentType.Quiz,
            Level = level,
            Body = response.Text ?? "[]",
            Status = ContentStatus.Published,
        };
    }

    public async IAsyncEnumerable<string> StreamAsync(
        Topic topic,
        IReadOnlyList<ResearchDoc> research,
        int level,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        var lang = options.CurrentValue.Language;
        var ctx = PromptBuilder.ResearchContext(research, lang);
        var prompt = PromptBuilder.Quiz(topic, ctx, level, lang);

        await foreach (var update in chatClient.GetStreamingResponseAsync(prompt, cancellationToken: ct))
        {
            var text = update.Text ?? string.Empty;
            if (!string.IsNullOrEmpty(text))
                yield return text;
        }
    }
}
