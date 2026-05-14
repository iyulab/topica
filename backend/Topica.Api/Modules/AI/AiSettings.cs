namespace Topica.Api.Modules.AI;

public class AiSettings
{
    public string ApiKey { get; set; } = string.Empty;
    public string Model { get; set; } = "gpt-4o-mini";
    public string Language { get; set; } = "ko"; // "ko" | "en"
}
