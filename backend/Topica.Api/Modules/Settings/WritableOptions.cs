using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;

namespace Topica.Api.Modules.Settings;

public interface IWritableOptions<T> where T : class
{
    T Value { get; }
    Task UpdateAsync(Action<T> applyChanges);
}

public class JsonFileWritableOptions<T>(
    IOptionsMonitor<T> monitor,
    IWebHostEnvironment env,
    string sectionPath) : IWritableOptions<T> where T : class, new()
{
    public T Value => monitor.CurrentValue;

    public async Task UpdateAsync(Action<T> applyChanges)
    {
        var instance = JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(monitor.CurrentValue)) ?? new T();
        applyChanges(instance);

        var filePath = Path.Combine(env.ContentRootPath, "appsettings.json");
        JsonObject root = File.Exists(filePath)
            ? JsonNode.Parse(await File.ReadAllTextAsync(filePath))?.AsObject() ?? new JsonObject()
            : new JsonObject();

        var keys = sectionPath.Split(':');
        var node = root;
        foreach (var key in keys[..^1])
        {
            node[key] ??= new JsonObject();
            node = node[key]!.AsObject();
        }
        node[keys[^1]] = JsonSerializer.SerializeToNode(instance);

        await File.WriteAllTextAsync(filePath,
            root.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
    }
}
