using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;
using System.Runtime.CompilerServices;
using Topica.Api.Modules.AI;
using Topica.Core.Entities;
using Topica.Core.Enums;
using Topica.Core.Interfaces;
using Topica.Infrastructure.Data;

namespace Topica.Api.Modules.Contents;

public class LectureGenerator(
    IChatClient chatClient,
    IOptionsMonitor<AiSettings> options,
    ApplicationDbContext db) : IStreamingContentGenerator
{
    public ContentType Type => ContentType.Lecture;

    public async Task<Content> GenerateAsync(
        Topic topic,
        IReadOnlyList<ResearchDoc> research,
        int level,
        CancellationToken ct = default)
    {
        var lang = options.CurrentValue.Language;
        var ctx = PromptBuilder.ResearchContext(research, lang);
        var existingTitles = await db.Topics
            .Where(t => t.Id != topic.Id)
            .Select(t => t.Title)
            .ToListAsync(ct);
        var prompt = PromptBuilder.Lecture(topic, ctx, level, lang, existingTitles);
        var response = await chatClient.GetResponseAsync(prompt, cancellationToken: ct);

        return new Content
        {
            TopicId = topic.Id,
            Type = ContentType.Lecture,
            Level = level,
            Body = response.Text ?? string.Empty,
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
        var existingTitles = await db.Topics
            .Where(t => t.Id != topic.Id)
            .Select(t => t.Title)
            .ToListAsync(ct);
        var prompt = PromptBuilder.Lecture(topic, ctx, level, lang, existingTitles);

        await foreach (var update in chatClient.GetStreamingResponseAsync(prompt, cancellationToken: ct))
        {
            var text = update.Text ?? string.Empty;
            if (!string.IsNullOrEmpty(text))
                yield return text;
        }
    }
}
