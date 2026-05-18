using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;
using System.Runtime.CompilerServices;
using System.Text;
using Topica.Api.Modules.AI;
using Topica.Api.Modules.RAG;
using Topica.Core.Entities;
using Topica.Infrastructure.Data;
using ChatRoleMs = Microsoft.Extensions.AI.ChatRole;
using AppChatRole = Topica.Core.Enums.ChatRole;

namespace Topica.Api.Modules.Chat;

public class ChatService(ApplicationDbContext db, IChatClient chatClient, IOptionsMonitor<AiSettings> options, RagService rag)
{
    public async Task<List<ChatSession>> GetHistoryAsync(Guid topicId, CancellationToken ct = default)
        => await db.ChatSessions
            .Where(c => c.TopicId == topicId)
            .OrderBy(c => c.CreatedAt)
            .ToListAsync(ct);

    public async Task<ChatSession> SendAsync(Guid topicId, string userMessage, CancellationToken ct = default)
    {
        var topic = await db.Topics
            .Include(t => t.ResearchDocs)
            .FirstOrDefaultAsync(t => t.Id == topicId, ct)
            ?? throw new KeyNotFoundException($"Topic {topicId} not found");

        var history = await GetHistoryAsync(topicId, ct);

        var lang = options.CurrentValue.Language;
        var ragChunks = await rag.SearchAsync(topicId, userMessage, top: 5, ct);
        var researchCtx = ragChunks.Count > 0
            ? PromptBuilder.RagContext(ragChunks, lang)
            : PromptBuilder.ResearchContext(topic.ResearchDocs.Take(5).ToList(), lang);
        var systemPrompt = PromptBuilder.ChatSystem(topic, researchCtx, lang);

        var messages = new List<ChatMessage> { new(ChatRoleMs.System, systemPrompt) };

        foreach (var msg in history.TakeLast(20))
        {
            var role = msg.Role == AppChatRole.User ? ChatRoleMs.User : ChatRoleMs.Assistant;
            messages.Add(new ChatMessage(role, msg.Message));
        }
        messages.Add(new ChatMessage(ChatRoleMs.User, userMessage));

        var userEntry = new ChatSession { TopicId = topicId, Role = AppChatRole.User, Message = userMessage };
        db.ChatSessions.Add(userEntry);

        var response = await chatClient.GetResponseAsync(messages, cancellationToken: ct);
        var assistantText = response.Text ?? string.Empty;

        var assistantEntry = new ChatSession { TopicId = topicId, Role = AppChatRole.Assistant, Message = assistantText };
        db.ChatSessions.Add(assistantEntry);

        await db.SaveChangesAsync(ct);
        return assistantEntry;
    }

    public async IAsyncEnumerable<ChatStreamChunk> SendStreamAsync(
        Guid topicId,
        string userMessage,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        var topic = await db.Topics
            .Include(t => t.ResearchDocs)
            .FirstOrDefaultAsync(t => t.Id == topicId, ct);
        if (topic is null) yield break;

        var history = await GetHistoryAsync(topicId, ct);

        var lang = options.CurrentValue.Language;
        var ragChunks = await rag.SearchAsync(topicId, userMessage, top: 5, ct);
        var researchCtx = ragChunks.Count > 0
            ? PromptBuilder.RagContext(ragChunks, lang)
            : PromptBuilder.ResearchContext(topic.ResearchDocs.Take(5).ToList(), lang);
        var systemPrompt = PromptBuilder.ChatSystem(topic, researchCtx, lang);

        var messages = new List<ChatMessage> { new(ChatRoleMs.System, systemPrompt) };
        foreach (var msg in history.TakeLast(20))
        {
            var role = msg.Role == AppChatRole.User ? ChatRoleMs.User : ChatRoleMs.Assistant;
            messages.Add(new ChatMessage(role, msg.Message));
        }
        messages.Add(new ChatMessage(ChatRoleMs.User, userMessage));

        var userEntry = new ChatSession { TopicId = topicId, Role = AppChatRole.User, Message = userMessage };
        db.ChatSessions.Add(userEntry);
        await db.SaveChangesAsync(ct);

        var sb = new StringBuilder();
        await foreach (var update in chatClient.GetStreamingResponseAsync(messages, cancellationToken: ct))
        {
            var text = update.Text ?? string.Empty;
            if (!string.IsNullOrEmpty(text))
            {
                sb.Append(text);
                yield return new ChatStreamChunk { Delta = text };
            }
        }

        var assistantEntry = new ChatSession { TopicId = topicId, Role = AppChatRole.Assistant, Message = sb.ToString() };
        db.ChatSessions.Add(assistantEntry);
        await db.SaveChangesAsync(ct);

        yield return new ChatStreamChunk { Done = true, Message = assistantEntry };
    }

    public async Task ClearHistoryAsync(Guid topicId, CancellationToken ct = default)
    {
        var messages = await db.ChatSessions.Where(c => c.TopicId == topicId).ToListAsync(ct);
        db.ChatSessions.RemoveRange(messages);
        await db.SaveChangesAsync(ct);
    }
}
