using Microsoft.EntityFrameworkCore;
using Topica.Infrastructure.Data;
using Topica.Core.Entities;

namespace Topica.Api.Modules.Topics;

public record TopicSummary(Guid Id, string Title, string Description, int UserLevel, DateTime CreatedAt, DateTime UpdatedAt, string[] Tags);

public class TopicService(ApplicationDbContext db)
{
    public async Task<List<TopicSummary>> GetAllAsync(CancellationToken ct = default)
        => await db.Topics
            .Include(t => t.Tags)
            .OrderByDescending(t => t.UpdatedAt)
            .Select(t => new TopicSummary(
                t.Id, t.Title, t.Description, t.UserLevel, t.CreatedAt, t.UpdatedAt,
                t.Tags.Select(tg => tg.Tag).ToArray()))
            .ToListAsync(ct);

    public async Task<List<TopicSummary>> SearchAsync(
        string? q,
        string[]? tags,
        string? sort,
        CancellationToken ct = default)
    {
        IQueryable<Topic> query;

        if (!string.IsNullOrWhiteSpace(q))
        {
            var pattern = $"%{q}%";
            // Include Contents so in-memory provider can evaluate t.Contents.Any(...)
            query = db.Topics
                .Include(t => t.Tags)
                .Include(t => t.Contents)
                .Where(t =>
                    EF.Functions.Like(t.Title, pattern) ||
                    EF.Functions.Like(t.Description, pattern) ||
                    t.Contents.Any(c => EF.Functions.Like(c.Body, pattern)));
        }
        else
        {
            query = db.Topics.Include(t => t.Tags);
        }

        if (tags is { Length: > 0 })
        {
            foreach (var tag in tags)
                query = query.Where(t => t.Tags.Any(tg => tg.Tag == tag));
        }

        query = sort switch
        {
            "updated_asc"  => query.OrderBy(t => t.UpdatedAt),
            "title_asc"    => query.OrderBy(t => t.Title),
            "created_desc" => query.OrderByDescending(t => t.CreatedAt),
            _              => query.OrderByDescending(t => t.UpdatedAt),
        };

        return await query
            .Select(t => new TopicSummary(
                t.Id, t.Title, t.Description, t.UserLevel, t.CreatedAt, t.UpdatedAt,
                t.Tags.Select(tg => tg.Tag).ToArray()))
            .ToListAsync(ct);
    }

    public async Task<Core.Entities.Topic?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await db.Topics.FindAsync([id], ct);

    public async Task<Core.Entities.Topic> CreateAsync(string title, int userLevel, CancellationToken ct = default)
    {
        var topic = new Core.Entities.Topic
        {
            Title = title,
            UserLevel = userLevel,
        };
        db.Topics.Add(topic);
        await db.SaveChangesAsync(ct);
        return topic;
    }

    public async Task<Core.Entities.Topic?> UpdateAsync(Guid id, string? title, int? userLevel, CancellationToken ct = default)
    {
        var topic = await db.Topics.FindAsync([id], ct);
        if (topic is null) return null;

        if (title is not null) topic.Title = title;
        if (userLevel is not null) topic.UserLevel = userLevel.Value;
        topic.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        return topic;
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var topic = await db.Topics.FindAsync([id], ct);
        if (topic is null) return false;
        db.Topics.Remove(topic);
        await db.SaveChangesAsync(ct);
        return true;
    }
}
