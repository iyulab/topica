using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;
using Topica.Api.Modules.AI;
using Topica.Core.Entities;
using Topica.Core.Enums;
using Topica.Core.Interfaces;

namespace Topica.Api.Modules.Contents;

public class MindmapGenerator(IChatClient chatClient, IOptionsMonitor<AiSettings> options) : IContentGenerator
{
    public ContentType Type => ContentType.Mindmap;

    public async Task<Content> GenerateAsync(
        Topic topic,
        IReadOnlyList<ResearchDoc> research,
        int level,
        CancellationToken ct = default)
    {
        var lang = options.CurrentValue.Language;
        var ctx = PromptBuilder.ResearchContext(research, lang);
        var prompt = PromptBuilder.Mindmap(topic, ctx, level, lang);
        var response = await chatClient.GetResponseAsync(prompt, cancellationToken: ct);

        return new Content
        {
            TopicId = topic.Id,
            Type = ContentType.Mindmap,
            Level = level,
            Body = MindmapNormalizer.Normalize(response.Text ?? string.Empty),
            Status = ContentStatus.Published,
        };
    }
}
