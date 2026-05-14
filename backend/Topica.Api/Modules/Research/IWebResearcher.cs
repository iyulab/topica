using WebLookup;

namespace Topica.Api.Modules.Research;

public interface IWebResearcher
{
    Task<IReadOnlyList<SearchResult>> SearchAsync(string query, CancellationToken ct = default);
}
