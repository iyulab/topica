using FluxIndex.Storage.SQLite;
using Microsoft.EntityFrameworkCore;
using System.Net.WebSockets;
using System.Text.Json;
using Topica.Api.Modules.AI;
using Topica.Api.Modules.Chat;
using Topica.Api.Modules.Contents;
using Topica.Api.Modules.Queue;
using Topica.Api.Modules.Eval;
using Topica.Api.Modules.Graph;
using Topica.Api.Modules.RAG;
using Topica.Api.Modules.Tag;
using Topica.Api.Modules.Research;
using Topica.Api.Modules.Settings;
using Topica.Api.Modules.Survey;
using Topica.Api.Modules.Topics;
using Topica.Api.Modules.WS;
using Topica.Infrastructure.Data;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.json", optional: true, reloadOnChange: true);

builder.Services.ConfigureHttpJsonOptions(opts =>
    opts.SerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles);

var port = Environment.GetEnvironmentVariable("TOPICA_PORT") ?? "5174";
builder.WebHost.UseUrls($"http://127.0.0.1:{port}");

var dbPath = Path.Combine(
    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
    "topica", "topica.db");

Directory.CreateDirectory(Path.GetDirectoryName(dbPath)!);

var vectorDbPath = Path.Combine(Path.GetDirectoryName(dbPath)!, "topica_vectors.db");

builder.Services.AddDbContext<ApplicationDbContext>(opt =>
    opt.UseSqlite($"Data Source={dbPath}"));
builder.Services.AddSQLiteVectorStore(vectorDbPath);

builder.Services.AddTopicModule();
builder.Services.AddResearchModule();
builder.Services.AddAiModule(builder.Configuration);
builder.Services.AddSettingsServices();
builder.Services.AddRagModule();
builder.Services.AddContentModule();
builder.Services.AddChatModule();
builder.Services.AddSurveyModule();
builder.Services.AddTagModule();
builder.Services.AddGraphModule();

builder.Services.AddSingleton<WsHub>();
builder.Services.AddSingleton<ContentQueueService>();
builder.Services.AddHostedService<ContentQueueWorker>();

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
app.MapTopicEndpoints();
app.MapResearchEndpoints();
app.MapContentEndpoints();
app.MapChatEndpoints();
app.MapSettingsEndpoints();
app.MapSurveyEndpoints();
app.MapEvalEndpoints();
app.MapTagEndpoints();
app.MapGraphEndpoints();

app.Map("/ws", async (HttpContext context, WsHub hub) =>
{
    if (!context.WebSockets.IsWebSocketRequest)
    {
        context.Response.StatusCode = 400;
        return;
    }

    var ct = context.RequestAborted;
    using var ws = await context.WebSockets.AcceptWebSocketAsync();

    var socketId = Guid.NewGuid().ToString("N");
    hub.Register(socketId, ws);

    var msg = JsonSerializer.SerializeToUtf8Bytes(new { type = "connected" });
    await ws.SendAsync(msg, WebSocketMessageType.Text, true, ct);

    var buffer = new byte[1024];
    try
    {
        while (ws.State == WebSocketState.Open)
        {
            var result = await ws.ReceiveAsync(buffer, ct);
            if (result.MessageType == WebSocketMessageType.Close)
                await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, null, CancellationToken.None);
        }
    }
    finally
    {
        hub.Unregister(socketId);
    }
});

app.Run();

public partial class Program { }
