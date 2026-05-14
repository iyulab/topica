using Topica.Core.Entities;
using Topica.Core.Enums;

namespace Topica.Core.Interfaces;

public interface IContentGenerator
{
    ContentType Type { get; }

    Task<Content> GenerateAsync(
        Topic topic,
        IReadOnlyList<ResearchDoc> research,
        int level,
        CancellationToken ct = default);
}
