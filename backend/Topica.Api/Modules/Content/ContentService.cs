using Microsoft.EntityFrameworkCore;
using System.Runtime.CompilerServices;
using System.Text;
using Topica.Core.Entities;
using Topica.Core.Enums;
using Topica.Core.Interfaces;
using Topica.Infrastructure.Data;

namespace Topica.Api.Modules.Contents;

public class ContentService(ApplicationDbContext db, IEnumerable<IContentGenerator> generators, IEnumerable<IStreamingContentGenerator> streamingGenerators)
{
    public async Task<List<Content>> GetContentsAsync(Guid topicId, CancellationToken ct = default)
        => await db.Contents
            .Where(c => c.TopicId == topicId)
            .OrderBy(c => c.GeneratedAt)
            .ToListAsync(ct);

    public async Task<Content?> GetContentAsync(Guid topicId, Guid contentId, CancellationToken ct = default)
        => await db.Contents
            .FirstOrDefaultAsync(c => c.TopicId == topicId && c.Id == contentId, ct);

    public async Task<(Content content, bool isNew)> GenerateAsync(Guid topicId, ContentType type, int level = 1, CancellationToken ct = default)
    {
        var topic = await db.Topics
            .Include(t => t.ResearchDocs)
            .FirstOrDefaultAsync(t => t.Id == topicId, ct)
            ?? throw new KeyNotFoundException($"Topic {topicId} not found");

        var generator = generators.FirstOrDefault(g => g.Type == type)
            ?? throw new NotSupportedException($"No generator registered for ContentType.{type}");

        var generated = await generator.GenerateAsync(topic, topic.ResearchDocs.ToList(), level, ct);

        // Upsert: replace existing content of the same type so regeneration doesn't create duplicates.
        var existing = await db.Contents.FirstOrDefaultAsync(c => c.TopicId == topicId && c.Type == type, ct);
        if (existing is not null)
        {
            existing.PreviousBody = string.IsNullOrEmpty(existing.Body) ? null : existing.Body;
            existing.Body = generated.Body;
            existing.Level = generated.Level;
            existing.Status = generated.Status;
            existing.GeneratedAt = generated.GeneratedAt;
            await db.SaveChangesAsync(ct);
            return (existing, isNew: false);
        }

        db.Contents.Add(generated);
        await db.SaveChangesAsync(ct);
        return (generated, isNew: true);
    }

    public async IAsyncEnumerable<ContentStreamChunk> StreamGenerateAsync(
        Guid topicId,
        ContentType type,
        int level,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        var topic = await db.Topics
            .Include(t => t.ResearchDocs)
            .FirstOrDefaultAsync(t => t.Id == topicId, ct);
        if (topic is null) yield break;

        var generator = streamingGenerators.FirstOrDefault(g => g.Type == type);
        if (generator is null) yield break;

        var sb = new StringBuilder();
        await foreach (var token in generator.StreamAsync(topic, topic.ResearchDocs.ToList(), level, ct))
        {
            sb.Append(token);
            yield return new ContentStreamChunk { Delta = token };
        }

        var existing = await db.Contents.FirstOrDefaultAsync(c => c.TopicId == topicId && c.Type == type, ct);
        Content saved;
        if (existing is not null)
        {
            existing.PreviousBody = string.IsNullOrEmpty(existing.Body) ? null : existing.Body;
            existing.Body = sb.ToString();
            existing.Level = level;
            existing.Status = ContentStatus.Published;
            existing.GeneratedAt = DateTime.UtcNow;
            saved = existing;
        }
        else
        {
            saved = new Content { TopicId = topicId, Type = type, Level = level, Body = sb.ToString(), Status = ContentStatus.Published };
            db.Contents.Add(saved);
        }
        await db.SaveChangesAsync(ct);

        yield return new ContentStreamChunk { Done = true, Content = saved };
    }
}
