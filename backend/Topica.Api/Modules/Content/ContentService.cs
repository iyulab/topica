using Microsoft.EntityFrameworkCore;
using Topica.Core.Entities;
using Topica.Core.Enums;
using Topica.Core.Interfaces;
using Topica.Infrastructure.Data;

namespace Topica.Api.Modules.Contents;

public class ContentService(ApplicationDbContext db, IEnumerable<IContentGenerator> generators)
{
    public async Task<List<Content>> GetContentsAsync(Guid topicId, CancellationToken ct = default)
        => await db.Contents
            .Where(c => c.TopicId == topicId)
            .OrderBy(c => c.GeneratedAt)
            .ToListAsync(ct);

    public async Task<Content?> GetContentAsync(Guid topicId, Guid contentId, CancellationToken ct = default)
        => await db.Contents
            .FirstOrDefaultAsync(c => c.TopicId == topicId && c.Id == contentId, ct);

    public async Task<Content> GenerateAsync(Guid topicId, ContentType type, int level = 1, CancellationToken ct = default)
    {
        var topic = await db.Topics
            .Include(t => t.ResearchDocs)
            .FirstOrDefaultAsync(t => t.Id == topicId, ct)
            ?? throw new KeyNotFoundException($"Topic {topicId} not found");

        var generator = generators.FirstOrDefault(g => g.Type == type)
            ?? throw new NotSupportedException($"No generator registered for ContentType.{type}");

        var content = await generator.GenerateAsync(topic, topic.ResearchDocs.ToList(), level, ct);
        db.Contents.Add(content);
        await db.SaveChangesAsync(ct);
        return content;
    }
}
