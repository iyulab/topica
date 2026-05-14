using System.Threading.Channels;
using Microsoft.EntityFrameworkCore;
using Topica.Core.Entities;
using Topica.Core.Enums;
using Topica.Infrastructure.Data;

namespace Topica.Api.Modules.Queue;

public record QueueRequest(Guid TopicId, ContentType Type, int Level = 1, int Priority = 0);

public class ContentQueueService
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
        var request = new QueueRequest(topicId, type, level, priority);
        return await _channel.Writer.WaitToWriteAsync(ct) &&
               _channel.Writer.TryWrite(request);
    }

    public async Task EnqueueDefaultsForTopicAsync(Guid topicId, int userLevel, CancellationToken ct = default)
    {
        await EnqueueAsync(topicId, ContentType.Summary, userLevel, priority: 10, ct: ct);
        await EnqueueAsync(topicId, ContentType.Lecture, userLevel, priority: 9, ct: ct);
    }
}
