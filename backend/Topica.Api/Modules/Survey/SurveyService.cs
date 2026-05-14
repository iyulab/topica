using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.AI;
using System.Runtime.CompilerServices;
using Topica.Api.Modules.AI;
using Topica.Infrastructure.Data;

namespace Topica.Api.Modules.Survey;

public class SurveyService(ApplicationDbContext db, IChatClient chatClient)
{
    public async IAsyncEnumerable<string> StreamQuestionsAsync(
        Guid topicId,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        var topic = await db.Topics.FindAsync([topicId], ct);
        if (topic is null) yield break;

        var systemPrompt = PromptBuilder.SurveySystem(topic);
        var messages = new List<ChatMessage>
        {
            new(ChatRole.System, systemPrompt),
            new(ChatRole.User, "Start the survey.")
        };

        var question = new System.Text.StringBuilder();
        int questionCount = 0;

        await foreach (var update in chatClient.GetStreamingResponseAsync(messages, cancellationToken: ct))
        {
            var text = update.Text ?? string.Empty;
            foreach (var ch in text)
            {
                question.Append(ch);
                if (ch == '\n' && question.ToString().TrimEnd().EndsWith('?'))
                {
                    var q = question.ToString().Trim();
                    if (!string.IsNullOrWhiteSpace(q))
                    {
                        yield return q;
                        questionCount++;
                        if (questionCount >= 5) yield break;
                    }
                    question.Clear();
                }
            }
        }

        // Yield any remaining question without newline
        var remaining = question.ToString().Trim();
        if (!string.IsNullOrWhiteSpace(remaining) && questionCount < 5)
            yield return remaining;
    }

    public async Task SaveAnswersAsync(Guid topicId, List<string> answers, CancellationToken ct = default)
    {
        var topic = await db.Topics.FindAsync([topicId], ct);
        if (topic is null) return;

        var context = string.Join(" | ", answers.Where(a => !string.IsNullOrWhiteSpace(a)));
        if (string.IsNullOrWhiteSpace(context)) return;

        var separator = string.IsNullOrWhiteSpace(topic.Description) ? "" : "\n\n---\n학습 목표 컨텍스트: ";
        topic.Description = topic.Description + separator + context;
        await db.SaveChangesAsync(ct);
    }
}
