using Microsoft.EntityFrameworkCore;
using Topica.Core.Entities;

namespace Topica.Infrastructure.Data;

public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
    : DbContext(options)
{
    public DbSet<Topic> Topics => Set<Topic>();
    public DbSet<ResearchDoc> ResearchDocs => Set<ResearchDoc>();
    public DbSet<Content> Contents => Set<Content>();
    public DbSet<ContentQueueItem> ContentQueueItems => Set<ContentQueueItem>();
    public DbSet<TopicTag> TopicTags => Set<TopicTag>();
    public DbSet<TopicEdge> TopicEdges => Set<TopicEdge>();
    public DbSet<EvalSession> EvalSessions => Set<EvalSession>();
    public DbSet<ChatSession> ChatSessions => Set<ChatSession>();
    public DbSet<AppNotification> Notifications => Set<AppNotification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<TopicTag>()
            .HasKey(t => new { t.TopicId, t.Tag });

        modelBuilder.Entity<TopicEdge>()
            .HasKey(e => new { e.FromTopicId, e.ToTopicId });

        modelBuilder.Entity<TopicEdge>()
            .HasOne(e => e.FromTopic)
            .WithMany(t => t.OutgoingEdges)
            .HasForeignKey(e => e.FromTopicId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TopicEdge>()
            .HasOne(e => e.ToTopic)
            .WithMany(t => t.IncomingEdges)
            .HasForeignKey(e => e.ToTopicId)
            .OnDelete(DeleteBehavior.Restrict);

        // ContentQueueItem: Pending/Processing 중복 방지 partial index
        modelBuilder.Entity<ContentQueueItem>()
            .HasIndex(q => new { q.TopicId, q.Type, q.Level, q.Status })
            .HasFilter("\"Status\" IN (0, 1)")
            .IsUnique();
    }
}
