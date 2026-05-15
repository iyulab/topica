namespace Topica.Core.Entities;

public class LearningSession
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TopicId { get; set; }
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public int DurationSeconds { get; set; }
    public int? QuizScore { get; set; }
    public int FlashcardsStudied { get; set; }

    public Topic Topic { get; set; } = null!;
}
