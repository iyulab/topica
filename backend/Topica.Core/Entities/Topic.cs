namespace Topica.Core.Entities;

public class Topic
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int UserLevel { get; set; } = 1;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<ResearchDoc> ResearchDocs { get; set; } = [];
    public ICollection<Content> Contents { get; set; } = [];
    public ICollection<ContentQueueItem> QueueItems { get; set; } = [];
    public ICollection<TopicTag> Tags { get; set; } = [];
    public ICollection<TopicEdge> OutgoingEdges { get; set; } = [];
    public ICollection<TopicEdge> IncomingEdges { get; set; } = [];
    public ICollection<EvalSession> EvalSessions { get; set; } = [];
    public ICollection<ChatSession> ChatSessions { get; set; } = [];
}
