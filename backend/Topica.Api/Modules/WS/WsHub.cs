using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text.Json;

namespace Topica.Api.Modules.WS;

public class WsHub
{
    private readonly ConcurrentDictionary<string, WebSocket> _sockets = new();

    public void Register(string id, WebSocket socket) => _sockets[id] = socket;

    public void Unregister(string id) => _sockets.TryRemove(id, out _);

    public async Task BroadcastAsync(object message, CancellationToken ct = default)
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(message);
        var buffer = new ReadOnlyMemory<byte>(bytes);

        var dead = new List<string>();
        foreach (var (id, socket) in _sockets)
        {
            if (socket.State != WebSocketState.Open)
            {
                dead.Add(id);
                continue;
            }
            try
            {
                await socket.SendAsync(buffer, WebSocketMessageType.Text, true, ct);
            }
            catch
            {
                dead.Add(id);
            }
        }
        foreach (var id in dead) _sockets.TryRemove(id, out _);
    }
}
