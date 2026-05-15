using Topica.Core.Enums;

namespace Topica.Core.Entities;

public class ContentQueueItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TopicId { get; set; }
    public ContentType Type { get; set; }
    public int Level { get; set; }
    public int Priority { get; set; }
    public QueueStatus Status { get; set; } = QueueStatus.Pending;
    public ModelProvider ModelProvider { get; set; } = ModelProvider.Local;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime? FailedAt { get; set; }
    public string? ErrorMessage { get; set; }

    public Topic Topic { get; set; } = null!;
}
