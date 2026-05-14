using System.Net.WebSockets;
using Xunit;

namespace Topica.Tests.Foundation;

public class WebSocketTests(TestWebAppFactory factory)
    : IClassFixture<TestWebAppFactory>
{
    [Fact]
    public async Task WebSocket_Connect_ReturnsOpen()
    {
        var wsClient = factory.Server.CreateWebSocketClient();
        var ws = await wsClient.ConnectAsync(
            new Uri("ws://localhost/ws"), CancellationToken.None);
        Assert.Equal(WebSocketState.Open, ws.State);

        // Verify server sends {"type":"connected"} greeting
        var buffer = new byte[256];
        var result = await ws.ReceiveAsync(buffer, CancellationToken.None);
        var message = System.Text.Encoding.UTF8.GetString(buffer, 0, result.Count);
        Assert.Contains("connected", message);

        await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "done", CancellationToken.None);
    }
}
