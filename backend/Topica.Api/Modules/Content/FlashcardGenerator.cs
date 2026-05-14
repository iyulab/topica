using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;
using Topica.Api.Modules.AI;
using Topica.Core.Entities;
using Topica.Core.Enums;
using Topica.Core.Interfaces;

namespace Topica.Api.Modules.Contents;

public class FlashcardGenerator(IChatClient chatClient, IOptionsMonitor<AiSettings> options) : IContentGenerator
{
    public ContentType Type => ContentType.Flashcard;

    public async Task<Content> GenerateAsync(
        Topic topic,
        IReadOnlyList<ResearchDoc> research,
        int level,
        CancellationToken ct = default)
    {
        var lang = options.CurrentValue.Language;
        var ctx = PromptBuilder.ResearchContext(research, lang);
        var prompt = PromptBuilder.Flashcard(topic, ctx, level, lang);
        var response = await chatClient.GetResponseAsync(prompt, cancellationToken: ct);

        return new Content
        {
            TopicId = topic.Id,
            Type = ContentType.Flashcard,
            Level = level,
            Body = response.Text ?? "[]",
            Status = ContentStatus.Published,
        };
    }
}
