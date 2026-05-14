using System.Threading.Channels;
using Microsoft.EntityFrameworkCore;
using Topica.Core.Entities;
using Topica.Core.Enums;
using Topica.Infrastructure.Data;

namespace Topica.Api.Modules.Queue;

public record QueueRequest(Guid TopicId, ContentType Type, int Level = 1, int Priority = 0);

public class ContentQueueService(IServiceProvider services)
{
    private readonly Channel<QueueRequest> _channel =
        Channel.CreateBounded<QueueRequest>(new BoundedChannelOptions(100)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
        });

    public ChannelReader<QueueRequest> Reader => _channel.Reader;

    public async Task<bool> EnqueueAsync(
        Guid topicId,
        ContentType type,
        int level = 1,
        int priority = 0,
        CancellationToken ct = default)
    {
        try
        {
            await using var scope = services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.ContentQueueItems.Add(new ContentQueueItem
            {
                TopicId = topicId,
                Type = type,
                Level = level,
                Priority = priority,
                Status = QueueStatus.Pending,
            });
            await db.SaveChangesAsync(ct);
        }
        catch { /* duplicate or transient error — channel-only enqueue still proceeds */ }

        var request = new QueueRequest(topicId, type, level, priority);
        return await _channel.Writer.WaitToWriteAsync(ct) &&
               _channel.Writer.TryWrite(request);
    }

    public async Task EnqueueDefaultsForTopicAsync(Guid topicId, int userLevel, CancellationToken ct = default)
    {
        await EnqueueAsync(topicId, ContentType.Summary, userLevel, priority: 10, ct: ct);
        await EnqueueAsync(topicId, ContentType.Lecture, userLevel, priority: 9, ct: ct);
        await EnqueueAsync(topicId, ContentType.Flashcard, userLevel, priority: 8, ct: ct);
        await EnqueueAsync(topicId, ContentType.Quiz, userLevel, priority: 7, ct: ct);
        await EnqueueAsync(topicId, ContentType.Mindmap, userLevel, priority: 6, ct: ct);
    }

    internal bool TryRestoreToChannel(QueueRequest request)
        => _channel.Writer.TryWrite(request);
}
