using Microsoft.EntityFrameworkCore;
using Topica.Api.Modules.Research;
using Topica.Core.Entities;
using Topica.Infrastructure.Data;
using WebLookup;

namespace Topica.Tests.Research;

public class ResearchServiceTests
{
    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    [Fact]
    public async Task RunResearch_SavesDocsForTopic()
    {
        await using var db = CreateContext();
        var topic = new Topic { Title = "Python 기초" };
        db.Topics.Add(topic);
        await db.SaveChangesAsync();

        var fakeResults = new List<SearchResult>
        {
            new() { Url = "https://example.com/1", Title = "Python Tutorial", Description = "Learn Python" },
            new() { Url = "https://example.com/2", Title = "Python Docs", Description = "Official docs" },
        };

        var svc = new ResearchService(db, new FakeResearcher(fakeResults));
        await svc.RunResearchAsync(topic.Id);

        var docs = await db.ResearchDocs.Where(r => r.TopicId == topic.Id).ToListAsync();
        Assert.Equal(2, docs.Count);
        Assert.Contains(docs, d => d.Source == "https://example.com/1");
        Assert.Contains(docs, d => d.ChunkIndex == 1);
    }

    [Fact]
    public async Task RunResearch_TopicNotFound_DoesNothing()
    {
        await using var db = CreateContext();
        var svc = new ResearchService(db, new FakeResearcher([]));
        await svc.RunResearchAsync(Guid.NewGuid());
        Assert.Equal(0, await db.ResearchDocs.CountAsync());
    }

    [Fact]
    public async Task GetResearchDocs_ReturnsSavedDocsInOrder()
    {
        await using var db = CreateContext();
        var topic = new Topic { Title = "딥러닝" };
        db.Topics.Add(topic);
        db.ResearchDocs.AddRange(
            new ResearchDoc { TopicId = topic.Id, Source = "https://b.com", ChunkIndex = 1, Content = "B" },
            new ResearchDoc { TopicId = topic.Id, Source = "https://a.com", ChunkIndex = 0, Content = "A" }
        );
        await db.SaveChangesAsync();

        var svc = new ResearchService(db, new FakeResearcher([]));
        var docs = await svc.GetResearchDocsAsync(topic.Id);

        Assert.Equal(2, docs.Count);
        Assert.Equal(0, docs[0].ChunkIndex);
        Assert.Equal(1, docs[1].ChunkIndex);
    }

    private sealed class FakeResearcher(IReadOnlyList<SearchResult> results) : IWebResearcher
    {
        public Task<IReadOnlyList<SearchResult>> SearchAsync(string query, CancellationToken ct = default)
            => Task.FromResult(results);
    }
}
