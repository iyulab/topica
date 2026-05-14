using Topica.Api.Modules.Contents;
using Topica.Api.Modules.WS;
using Topica.Core.Enums;

namespace Topica.Api.Modules.Queue;

public class ContentQueueWorker(
    ContentQueueService queue,
    IServiceProvider services,
    WsHub wsHub,
    ILogger<ContentQueueWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var req in queue.Reader.ReadAllAsync(stoppingToken))
        {
            await ProcessRequestAsync(req, stoppingToken);
        }
    }

    private async Task ProcessRequestAsync(QueueRequest req, CancellationToken ct)
    {
        try
        {
            await using var scope = services.CreateAsyncScope();
            var contentService = scope.ServiceProvider.GetRequiredService<ContentService>();

            var content = await contentService.GenerateAsync(req.TopicId, req.Type, req.Level, ct);

            await wsHub.BroadcastAsync(new
            {
                type = "content_ready",
                topicId = req.TopicId,
                contentId = content.Id,
                contentType = req.Type.ToString(),
            }, ct);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            logger.LogError(ex, "Content generation failed for topic {TopicId} type {Type}", req.TopicId, req.Type);
        }
    }
}
