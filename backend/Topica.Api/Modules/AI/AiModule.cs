using FluxIndex.Core.Application.Interfaces;
using Microsoft.Extensions.AI;

namespace Topica.Api.Modules.AI;

public static class AiModule
{
    public static IServiceCollection AddAiModule(this IServiceCollection services, IConfiguration config)
    {
        services.Configure<AiSettings>(config.GetSection("AI:OpenAI"));
        services.AddKeyedSingleton<IChatClient>("local",
            (sp, _) => new LMSupplyChatAdapter(
                sp.GetRequiredService<ILogger<LMSupplyChatAdapter>>()));
        services.AddKeyedSingleton<IEmbeddingService>("local",
            (sp, _) => new LMSupplyEmbeddingAdapter(
                sp.GetRequiredService<ILogger<LMSupplyEmbeddingAdapter>>()));
        services.AddSingleton<IChatClient, DynamicChatClient>();
        services.AddSingleton<IEmbeddingService, DynamicEmbeddingService>();
        return services;
    }
}
