using Microsoft.EntityFrameworkCore;
using Topica.Api.Modules.RAG;
using Topica.Core.Entities;
using Topica.Infrastructure.Data;

namespace Topica.Api.Modules.Research;

public class ResearchService(ApplicationDbContext db, IWebResearcher researcher, RagService rag)
{
    public async Task<List<ResearchDoc>> GetResearchDocsAsync(Guid topicId, CancellationToken ct = default)
        => await db.ResearchDocs
            .Where(r => r.TopicId == topicId)
            .OrderBy(r => r.ChunkIndex)
            .ToListAsync(ct);

    public async Task RunResearchAsync(Guid topicId, CancellationToken ct = default)
    {
        var topic = await db.Topics.FindAsync([topicId], ct);
        if (topic is null) return;

        var results = await researcher.SearchAsync(topic.Title, ct);

        var docs = results
            .Select((r, i) => new ResearchDoc
            {
                TopicId = topicId,
                Source = r.Url,
                ChunkIndex = i,
                Content = $"{r.Title}\n{r.Description}".Trim(),
            })
            .ToList();

        if (docs.Count > 0)
        {
            db.ResearchDocs.AddRange(docs);
            await db.SaveChangesAsync(ct);

            await rag.IndexTopicAsync(topicId, docs, ct);
        }
    }
}
