namespace Topica.Api.Modules.AI;

public class AiSettings
{
    public string ApiKey { get; set; } = string.Empty;
    public string Model { get; set; } = "gpt-4o-mini";
    public string Language { get; set; } = "ko"; // "ko" | "en"
    public string EmbeddingModel { get; set; } = "text-embedding-3-small";
    public int EmbeddingDimension { get; set; } = 1536;
    public string OllamaEndpoint { get; set; } = "http://localhost:11434";
    public string OllamaModel { get; set; } = string.Empty;
    public string OllamaEmbeddingModel { get; set; } = string.Empty;
}
