namespace Topica.Core.Entities;

public class TopicEmbedding
{
    public Guid TopicId { get; set; }
    public byte[] Vector { get; set; } = [];
    public string Model { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Topic Topic { get; set; } = null!;
}
