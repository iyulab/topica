using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.AI;
using System.Text.Json;
using Topica.Api.Modules.AI;
using Topica.Core.Entities;
using Topica.Infrastructure.Data;

namespace Topica.Api.Modules.Tag;

public class TagService(ApplicationDbContext db, IChatClient chatClient)
{
    public async Task<List<string>> GetTagsAsync(Guid topicId, CancellationToken ct = default)
        => await db.TopicTags
            .Where(t => t.TopicId == topicId)
            .Select(t => t.Tag)
            .ToListAsync(ct);

    public async Task GenerateTagsAsync(Guid topicId, string summaryContent, CancellationToken ct = default)
    {
        var topic = await db.Topics.FindAsync([topicId], ct);
        if (topic is null) return;

        var messages = new List<ChatMessage>
        {
            new(ChatRole.System, PromptBuilder.TagSystem()),
            new(ChatRole.User, $"Topic: {topic.Title}\n\nSummary:\n{summaryContent}"),
        };

        ChatResponse response;
        try { response = await chatClient.GetResponseAsync(messages, cancellationToken: ct); }
        catch { return; }

        var text = response.Text ?? string.Empty;
        List<string>? tags = null;

        // extract JSON array
        var start = text.IndexOf('[');
        var end = text.LastIndexOf(']');
        if (start >= 0 && end > start)
        {
            try { tags = JsonSerializer.Deserialize<List<string>>(text[start..(end + 1)]); }
            catch { }
        }

        if (tags is null || tags.Count == 0) return;

        var existing = await db.TopicTags.Where(t => t.TopicId == topicId).ToListAsync(ct);
        db.TopicTags.RemoveRange(existing);

        foreach (var tag in tags.Take(8).Where(t => !string.IsNullOrWhiteSpace(t)))
        {
            db.TopicTags.Add(new TopicTag { TopicId = topicId, Tag = tag.Trim() });
        }

        await db.SaveChangesAsync(ct);
    }
}
