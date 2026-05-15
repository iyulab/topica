namespace Topica.Api.Modules.RAG;

public static class RagModule
{
    public static IServiceCollection AddRagModule(this IServiceCollection services)
    {
        services.AddScoped<RagService>();
        return services;
    }
}
