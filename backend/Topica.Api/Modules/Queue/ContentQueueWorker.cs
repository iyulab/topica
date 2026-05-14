using Microsoft.EntityFrameworkCore;
using Topica.Api.Modules.Contents;
using Topica.Api.Modules.Graph;
using Topica.Api.Modules.Tag;
using Topica.Api.Modules.WS;
using Topica.Core.Enums;
using Topica.Infrastructure.Data;

namespace Topica.Api.Modules.Queue;

public class ContentQueueWorker(
    ContentQueueService queue,
    IServiceProvider services,
    WsHub wsHub,
    ILogger<ContentQueueWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await RestorePendingItemsAsync(stoppingToken);

        await foreach (var req in queue.Reader.ReadAllAsync(stoppingToken))
        {
            await ProcessRequestAsync(req, stoppingToken);
        }
    }

    private async Task RestorePendingItemsAsync(CancellationToken ct)
    {
        try
        {
            await using var scope = services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var items = await db.ContentQueueItems
                .Where(q => q.Status == QueueStatus.Pending || q.Status == QueueStatus.Processing)
                .OrderByDescending(q => q.Priority).ThenBy(q => q.CreatedAt)
                .ToListAsync(ct);

            foreach (var item in items.Where(i => i.Status == QueueStatus.Processing))
                item.Status = QueueStatus.Pending;

            if (items.Any(i => i.Status == QueueStatus.Processing))
                await db.SaveChangesAsync(ct);

            foreach (var item in items)
                queue.TryRestoreToChannel(new QueueRequest(item.TopicId, item.Type, item.Level, item.Priority));

            if (items.Count > 0)
                logger.LogInformation("Restored {Count} pending queue items on startup", items.Count);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to restore pending queue items — continuing without restoration");
        }
    }

    private async Task ProcessRequestAsync(QueueRequest req, CancellationToken ct)
    {
        await wsHub.BroadcastAsync(new
        {
            type = "queue_started",
            topicId = req.TopicId,
            contentType = req.Type.ToString(),
        }, ct);

        try
        {
            await using var scope = services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            await MarkProcessingAsync(db, req, ct);

            var contentService = scope.ServiceProvider.GetRequiredService<ContentService>();
            var content = await contentService.GenerateAsync(req.TopicId, req.Type, req.Level, ct);

            await wsHub.BroadcastAsync(new
            {
                type = "content_ready",
                topicId = req.TopicId,
                contentId = content.Id,
                contentType = req.Type.ToString(),
            }, ct);

            if (req.Type == ContentType.Summary && !string.IsNullOrWhiteSpace(content.Body))
            {
                var tagService = scope.ServiceProvider.GetRequiredService<TagService>();
                await tagService.GenerateTagsAsync(req.TopicId, content.Body, ct);

                var embedSvc = scope.ServiceProvider.GetRequiredService<TopicEmbeddingService>();
                await embedSvc.EmbedTopicAsync(req.TopicId, ct);
            }

            await MarkDoneAsync(db, req, ct);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            logger.LogError(ex, "Content generation failed for topic {TopicId} type {Type}", req.TopicId, req.Type);
            await wsHub.BroadcastAsync(new
            {
                type = "queue_failed",
                topicId = req.TopicId,
                contentType = req.Type.ToString(),
            }, CancellationToken.None);

            try
            {
                await using var errScope = services.CreateAsyncScope();
                var errDb = errScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                await MarkFailedAsync(errDb, req, CancellationToken.None);
            }
            catch { /* best-effort */ }
        }
    }

    private static async Task MarkProcessingAsync(ApplicationDbContext db, QueueRequest req, CancellationToken ct)
    {
        var item = await db.ContentQueueItems
            .Where(q => q.TopicId == req.TopicId && q.Type == req.Type && q.Level == req.Level && q.Status == QueueStatus.Pending)
            .FirstOrDefaultAsync(ct);
        if (item is null) return;
        item.Status = QueueStatus.Processing;
        item.StartedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    private static async Task MarkDoneAsync(ApplicationDbContext db, QueueRequest req, CancellationToken ct)
    {
        var item = await db.ContentQueueItems
            .Where(q => q.TopicId == req.TopicId && q.Type == req.Type && q.Level == req.Level && q.Status == QueueStatus.Processing)
            .FirstOrDefaultAsync(ct);
        if (item is null) return;
        item.Status = QueueStatus.Done;
        item.CompletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    private static async Task MarkFailedAsync(ApplicationDbContext db, QueueRequest req, CancellationToken ct)
    {
        var item = await db.ContentQueueItems
            .Where(q => q.TopicId == req.TopicId && q.Type == req.Type && q.Level == req.Level &&
                        (q.Status == QueueStatus.Processing || q.Status == QueueStatus.Pending))
            .FirstOrDefaultAsync(ct);
        if (item is null) return;
        item.Status = QueueStatus.Failed;
        item.CompletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }
}
