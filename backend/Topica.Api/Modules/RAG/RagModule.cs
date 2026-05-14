namespace Topica.Api.Modules.RAG;

public static class RagModule
{
    public static IServiceCollection AddRagModule(this IServiceCollection services)
    {
        services.AddSingleton<RagService>();
        return services;
    }
}
