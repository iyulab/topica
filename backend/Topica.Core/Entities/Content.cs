using Topica.Core.Enums;

namespace Topica.Core.Entities;

public class Content
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TopicId { get; set; }
    public ContentType Type { get; set; }
    public int Level { get; set; }
    public string Body { get; set; } = string.Empty;
    public string? PreviousBody { get; set; }
    public ContentStatus Status { get; set; } = ContentStatus.Draft;
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;

    public Topic Topic { get; set; } = null!;
}
