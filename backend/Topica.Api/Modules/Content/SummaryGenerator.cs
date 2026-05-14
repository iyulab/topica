using Microsoft.Extensions.AI;
using Topica.Core.Entities;
using Topica.Core.Enums;
using Topica.Core.Interfaces;

namespace Topica.Api.Modules.Contents;

public class SummaryGenerator(IChatClient chatClient) : IContentGenerator
{
    public ContentType Type => ContentType.Summary;

    public async Task<Content> GenerateAsync(
        Topic topic,
        IReadOnlyList<ResearchDoc> research,
        int level,
        CancellationToken ct = default)
    {
        var researchContext = research.Count > 0
            ? string.Join("\n---\n", research.Select(r => $"[{r.Source}]\n{r.Content}"))
            : "리서치 자료 없음";

        var prompt = $"""
            당신은 교육 콘텐츠 작성자입니다. 아래 토픽에 대한 마크다운 요약을 작성하세요.

            토픽: {topic.Title}
            대상 수준: {level}/10 (1=완전 초보, 10=전문가)

            참고 자료:
            {researchContext}

            요구사항:
            - 간결하고 구조화된 마크다운 형식
            - 개요, 핵심 개념(불릿 포인트), 중요한 이유 포함
            - 마크다운만 응답 (다른 설명 불필요)
            """;

        var response = await chatClient.GetResponseAsync(prompt, cancellationToken: ct);

        return new Content
        {
            TopicId = topic.Id,
            Type = ContentType.Summary,
            Level = level,
            Body = response.Text ?? string.Empty,
            Status = ContentStatus.Published,
        };
    }
}
