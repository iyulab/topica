namespace Topica.Core.Entities;

public class EvalSession
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TopicId { get; set; }
    public Guid ContentId { get; set; }
    public float Score { get; set; }
    public int LevelBefore { get; set; }
    public int LevelAfter { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Topic Topic { get; set; } = null!;
    public Content Content { get; set; } = null!;
}
