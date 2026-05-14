using Topica.Core.Enums;

namespace Topica.Core.Entities;

public class AppNotification
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public NotificationType Type { get; set; }
    public Guid? TopicId { get; set; }
    public Guid? ContentId { get; set; }
    public string Message { get; set; } = string.Empty;
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
