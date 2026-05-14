using WebLookup;

namespace Topica.Api.Modules.Research;

public class WebResearcher(WebSearchClient client) : IWebResearcher
{
    public Task<IReadOnlyList<SearchResult>> SearchAsync(string query, CancellationToken ct = default)
        => client.SearchAsync(query, ct);
}
