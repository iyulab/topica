namespace Topica.Core.Entities;

public class TopicEdge
{
    public Guid FromTopicId { get; set; }
    public Guid ToTopicId { get; set; }
    public string Relation { get; set; } = "prerequisite";
    public float Confidence { get; set; } = 1.0f;

    public Topic FromTopic { get; set; } = null!;
    public Topic ToTopic { get; set; } = null!;
}
