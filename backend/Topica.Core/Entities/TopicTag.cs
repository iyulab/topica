namespace Topica.Core.Entities;

public class TopicTag
{
    public Guid TopicId { get; set; }
    public string Tag { get; set; } = string.Empty;

    public Topic Topic { get; set; } = null!;
}
