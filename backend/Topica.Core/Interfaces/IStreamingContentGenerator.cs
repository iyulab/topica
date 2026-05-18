using Topica.Core.Entities;
using Topica.Core.Enums;

namespace Topica.Core.Interfaces;

public interface IStreamingContentGenerator : IContentGenerator
{
    IAsyncEnumerable<string> StreamAsync(
        Topic topic,
        IReadOnlyList<ResearchDoc> research,
        int level,
        CancellationToken ct = default);
}
