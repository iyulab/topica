using Microsoft.Extensions.AI;
using Topica.Core.Entities;
using Topica.Core.Enums;
using Topica.Core.Interfaces;

namespace Topica.Api.Modules.Contents;

public class LectureGenerator(IChatClient chatClient) : IContentGenerator
{
    public ContentType Type => ContentType.Lecture;

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
            당신은 교육 콘텐츠 작성자입니다. 아래 토픽에 대한 상세 강해(Lecture)를 작성하세요.

            토픽: {topic.Title}
            대상 수준: {level}/10 (1=완전 초보, 10=전문가)

            참고 자료:
            {researchContext}

            요구사항:
            - 상세하고 교육적인 마크다운 강의 자료 형식
            - 개념 설명, 예시, 핵심 용어 정의 포함
            - 섹션별 체계적 구조
            - 마크다운만 응답 (다른 설명 불필요)
            """;

        var response = await chatClient.GetResponseAsync(prompt, cancellationToken: ct);

        return new Content
        {
            TopicId = topic.Id,
            Type = ContentType.Lecture,
            Level = level,
            Body = response.Text ?? string.Empty,
            Status = ContentStatus.Published,
        };
    }
}
