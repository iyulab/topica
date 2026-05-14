using Microsoft.EntityFrameworkCore;
using System.Net.WebSockets;
using System.Text.Json;
using Topica.Infrastructure.Data;

var builder = WebApplication.CreateBuilder(args);

var port = Environment.GetEnvironmentVariable("TOPICA_PORT") ?? "5174";
builder.WebHost.UseUrls($"http://127.0.0.1:{port}");

var dbPath = Path.Combine(
    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
    "topica", "topica.db");

Directory.CreateDirectory(Path.GetDirectoryName(dbPath)!);

builder.Services.AddDbContext<ApplicationDbContext>(opt =>
    opt.UseSqlite($"Data Source={dbPath}"));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    if (db.Database.IsRelational())
        db.Database.Migrate();
    else
        db.Database.EnsureCreated();
}

app.UseWebSockets();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Map("/ws", async (HttpContext context) =>
{
    if (!context.WebSockets.IsWebSocketRequest)
    {
        context.Response.StatusCode = 400;
        return;
    }

    var ct = context.RequestAborted;
    using var ws = await context.WebSockets.AcceptWebSocketAsync();

    var msg = JsonSerializer.SerializeToUtf8Bytes(new { type = "connected" });
    await ws.SendAsync(msg, WebSocketMessageType.Text, true, ct);

    var buffer = new byte[1024];
    while (ws.State == WebSocketState.Open)
    {
        var result = await ws.ReceiveAsync(buffer, ct);
        if (result.MessageType == WebSocketMessageType.Close)
            await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, null, CancellationToken.None);
    }
});

app.Run();

public partial class Program { }
