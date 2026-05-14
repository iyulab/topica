namespace Topica.Core.Entities;

public class ResearchChunkEmbedding
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TopicId { get; set; }
    public string ChunkText { get; set; } = string.Empty;
    public byte[] Vector { get; set; } = [];
    public string Model { get; set; } = string.Empty;
    public int ChunkIndex { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Topic Topic { get; set; } = null!;
}
