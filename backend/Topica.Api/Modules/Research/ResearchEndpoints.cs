using WebLookup;

namespace Topica.Api.Modules.Research;

public static class ResearchEndpoints
{
    public static IServiceCollection AddResearchModule(this IServiceCollection services)
    {
        services.AddWebLookup(options => options.AddDuckDuckGo());
        services.AddScoped<WebResearcher>();
        services.AddScoped<IWebResearcher, WebResearcher>();
        services.AddScoped<ResearchService>();
        return services;
    }

    public static IEndpointRouteBuilder MapResearchEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/topics/{topicId:guid}/research");

        group.MapGet("/", async (Guid topicId, ResearchService svc, CancellationToken ct) =>
        {
            var docs = await svc.GetResearchDocsAsync(topicId, ct);
            return Results.Ok(docs);
        });

        return app;
    }
}
