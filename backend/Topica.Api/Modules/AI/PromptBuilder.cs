using Topica.Core.Entities;

namespace Topica.Api.Modules.AI;

public static class PromptBuilder
{
    public static string ResearchContext(IReadOnlyList<ResearchDoc> docs, string language)
    {
        if (docs.Count == 0)
            return language == "en" ? "No research data available." : "리서치 자료 없음";

        return string.Join("\n---\n", docs.Select(r => $"[{r.Source}]\n{r.Content}"));
    }

    public static string RagContext(IReadOnlyList<string> chunks, string language)
    {
        if (chunks.Count == 0)
            return language == "en" ? "No relevant context found." : "관련 컨텍스트 없음";

        return string.Join("\n---\n", chunks.Select((c, i) => $"[Chunk {i + 1}]\n{c}"));
    }

    public static string Summary(
        Topic topic,
        string researchContext,
        int level,
        string language,
        IReadOnlyList<string>? existingTopicTitles = null)
    {
        var linkHint = BuildLinkHint(existingTopicTitles, language);
        var declartHint = BuildDeclartHint(language);

        return language == "en"
            ? $"""
                You are an educational content writer. Write a structured markdown summary for the topic below.

                Topic: {topic.Title}
                Target level: {level}/10 (1=absolute beginner, 10=expert)

                Reference material:
                {researchContext}

                Requirements:
                - Concise, structured markdown format
                - Include overview, key concepts (bullet points), and why it matters
                - Respond with markdown only (no extra explanation){linkHint}{declartHint}
                """
            : $"""
                당신은 교육 콘텐츠 작성자입니다. 아래 토픽에 대한 마크다운 요약을 작성하세요.

                토픽: {topic.Title}
                대상 수준: {level}/10 (1=완전 초보, 10=전문가)

                참고 자료:
                {researchContext}

                요구사항:
                - 간결하고 구조화된 마크다운 형식
                - 개요, 핵심 개념(불릿 포인트), 중요한 이유 포함
                - 마크다운만 응답 (다른 설명 불필요){linkHint}{declartHint}
                """;
    }

    public static string Lecture(
        Topic topic,
        string researchContext,
        int level,
        string language,
        IReadOnlyList<string>? existingTopicTitles = null)
    {
        var linkHint = BuildLinkHint(existingTopicTitles, language);
        var declartHint = BuildDeclartHint(language);

        return language == "en"
            ? $"""
                You are an educational content writer. Write a detailed lecture for the topic below.

                Topic: {topic.Title}
                Target level: {level}/10

                Reference material:
                {researchContext}

                Requirements:
                - Detailed, educational markdown lecture format
                - Include concept explanations, examples, and key term definitions
                - Systematic structure with sections
                - Respond with markdown only (no extra explanation){linkHint}{declartHint}
                """
            : $"""
                당신은 교육 콘텐츠 작성자입니다. 아래 토픽에 대한 상세 강의를 작성하세요.

                토픽: {topic.Title}
                대상 수준: {level}/10

                참고 자료:
                {researchContext}

                요구사항:
                - 상세하고 교육적인 마크다운 강의 자료 형식
                - 개념 설명, 예시, 핵심 용어 정의 포함
                - 섹션별 체계적 구조
                - 마크다운만 응답 (다른 설명 불필요){linkHint}{declartHint}
                """;
    }

    public static string Flashcard(Topic topic, string researchContext, int level, string language) => language == "en"
        ? $$"""
            You are an educational content writer. Generate a flashcard set for the topic below in JSON format.

            Topic: {{topic.Title}}
            Target level: {{level}}/10

            Reference material:
            {{researchContext}}

            Requirements:
            - Generate 10-15 flashcards
            - Each card has a front (question/term) and back (answer/explanation)
            - Adjust difficulty to the target level
            - Respond ONLY with this JSON format:
            [
              {"front": "question or term", "back": "answer or explanation"},
              ...
            ]
            """
        : $$"""
            당신은 교육 콘텐츠 작성자입니다. 아래 토픽에 대한 플래시카드 세트를 JSON 형식으로 생성하세요.

            토픽: {{topic.Title}}
            대상 수준: {{level}}/10

            참고 자료:
            {{researchContext}}

            요구사항:
            - 10~15개의 플래시카드 생성
            - 각 카드는 앞면(질문/용어)과 뒷면(답/설명)으로 구성
            - 수준에 맞는 난이도 조절
            - 반드시 아래 JSON 형식만 응답:
            [
              {"front": "질문 또는 용어", "back": "답변 또는 설명"},
              ...
            ]
            """;

    public static string Quiz(Topic topic, string researchContext, int level, string language) => language == "en"
        ? $$"""
            You are an educational content writer. Generate a quiz for the topic below in JSON format.

            Topic: {{topic.Title}}
            Target level: {{level}}/10

            Reference material:
            {{researchContext}}

            Requirements:
            - Generate 5-10 multiple choice questions
            - Each question has 4 options, an answer index (0-3), and an explanation
            - Respond ONLY with this JSON format:
            [
              {
                "question": "question text",
                "options": ["option1", "option2", "option3", "option4"],
                "answer": 0,
                "explanation": "explanation of the correct answer"
              },
              ...
            ]
            """
        : $$"""
            당신은 교육 콘텐츠 작성자입니다. 아래 토픽에 대한 퀴즈를 JSON 형식으로 생성하세요.

            토픽: {{topic.Title}}
            대상 수준: {{level}}/10

            참고 자료:
            {{researchContext}}

            요구사항:
            - 5~10개의 객관식 문제 생성
            - 각 문제는 4개의 선택지와 정답 인덱스(0~3), 해설 포함
            - 반드시 아래 JSON 형식만 응답:
            [
              {
                "question": "문제 내용",
                "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
                "answer": 0,
                "explanation": "정답 해설"
              },
              ...
            ]
            """;

    public static string Mindmap(Topic topic, string researchContext, int level, string language) => language == "en"
        ? $$"""
            You are an educational content writer. Generate a mind map for the topic below in Declart TOML hierarchy format.

            Topic: {{topic.Title}}
            Target level: {{level}}/10

            Reference material:
            {{researchContext}}

            Requirements:
            - Use kind = 'hierarchy' at the top
            - First node is the root (no parent field)
            - 4-7 main branches (parent = root label)
            - 2-4 sub-concepts per branch (parent = branch label)
            - Labels must be concise (1-5 words)
            - CRITICAL: Each 'parent' value must be the EXACT full string of another node's 'label'. Never abbreviate — partial matches break rendering.
            - Respond ONLY with the TOML below, no extra text, no code fences:

            kind = 'hierarchy'
            title = 'Topic Title'
            [[nodes]]
            label = 'Root'
            [[nodes]]
            label = 'Branch 1'
            parent = 'Root'
            [[nodes]]
            label = 'Sub 1.1'
            parent = 'Branch 1'
            [[nodes]]
            label = 'Branch 2'
            parent = 'Root'
            """
        : $$"""
            당신은 교육 콘텐츠 작성자입니다. 아래 토픽에 대한 마인드맵을 Declart TOML 계층 형식으로 생성하세요.

            토픽: {{topic.Title}}
            대상 수준: {{level}}/10

            참고 자료:
            {{researchContext}}

            요구사항:
            - 최상단에 kind = 'hierarchy' 선언
            - 첫 번째 노드가 루트 (parent 필드 없음)
            - 주요 가지 4~7개 (parent = 루트 레이블)
            - 가지당 하위 개념 2~4개 (parent = 가지 레이블)
            - 레이블은 간결하게 (1~5 단어)
            - 반드시 지킬 것: 각 'parent' 값은 다른 노드의 'label' 전체 문자열과 정확히 일치해야 합니다. 절대 축약 불가 — 부분 일치는 렌더링 오류를 유발합니다.
            - 반드시 아래 TOML 형식만 응답, 다른 텍스트 없음, 코드 펜스 없음:

            kind = 'hierarchy'
            title = '토픽 제목'
            [[nodes]]
            label = '루트'
            [[nodes]]
            label = '가지 1'
            parent = '루트'
            [[nodes]]
            label = '하위 1.1'
            parent = '가지 1'
            [[nodes]]
            label = '가지 2'
            parent = '루트'
            """;

    private static string BuildLinkHint(IReadOnlyList<string>? titles, string language) =>
        titles?.Count > 0
            ? language == "en"
                ? $"\nExisting topics list: {string.Join(", ", titles)}\nIf a concept in your response overlaps with a topic from the list, link it once using [[TopicName]] format."
                : $"\n기존 학습 토픽 목록: {string.Join(", ", titles)}\n본문에서 해당 목록의 토픽과 겹치는 개념이 등장하면 [[토픽명]] 형식으로 한 번만 링크하세요."
            : string.Empty;

    private static string BuildDeclartHint(string language) => language == "en"
        ? """

            - If the topic has a clear hierarchical structure (3+ levels), include ONE declart block to visualize it:
            ```declart
            kind = 'hierarchy'
            title = 'Topic Title'
            [[nodes]]
            label = 'Root'
            [[nodes]]
            label = 'Branch'
            parent = 'Root'
            [[nodes]]
            label = 'Leaf'
            parent = 'Branch'
            ```
            Use declart only once per response and only when hierarchy genuinely exists.
            CRITICAL: Each 'parent' value must be the EXACT full string of another node's 'label'. Never abbreviate — partial matches will break rendering.
            """
        : """

            - 토픽에 명확한 계층 구조(3단계 이상)가 있다면, 이를 시각화하는 declart 블록을 1개 포함하세요:
            ```declart
            kind = 'hierarchy'
            title = '토픽 제목'
            [[nodes]]
            label = '루트'
            [[nodes]]
            label = '가지'
            parent = '루트'
            [[nodes]]
            label = '잎'
            parent = '가지'
            ```
            declart는 응답당 1번만, 실제 계층 구조가 있을 때만 사용하세요.
            반드시 지킬 것: 각 'parent' 값은 다른 노드의 'label' 전체 문자열과 정확히 일치해야 합니다. 절대 축약하지 마세요 — 부분 일치는 렌더링 오류를 유발합니다.
            """;

    public static string TagSystem() =>
        """
        Extract 3-8 concise topic tags from the given content.
        Return ONLY a JSON array of strings, nothing else.
        Example: ["machine learning", "neural network", "deep learning"]
        Tags should be lowercase, 1-3 words each.
        """;

    public static string SurveySystem(Topic topic) =>
        $"""
        You are a learning assistant helping understand a learner's goals for the topic "{topic.Title}".
        Ask up to 5 short, focused questions (one per line, ending with '?') to understand:
        - Their current knowledge level
        - What they want to learn
        - Any specific aspects they care about
        Keep each question concise (1 sentence). Ask them in order, one per line.
        """;

    public static string ChatSystem(Topic topic, string researchContext, string language) => language == "en"
        ? $"""
            You are a topic learning assistant.

            Topic: {topic.Title}
            {(string.IsNullOrEmpty(topic.Description) ? "" : $"Description: {topic.Description}")}

            Reference material:
            {researchContext}

            Rules:
            - Only answer questions related to the topic above.
            - Explain clearly and educationally.
            - Respond in English.
            - When presenting numerical data, progress, or comparisons, you MAY include a widget block:
            {WidgetExampleEn}
            Available widgets: metric, gauge, progress, chart.bar, table
            Use widgets sparingly — only when they genuinely aid understanding.
            - When explaining a concept with 3+ levels of hierarchy (e.g. category → subcategory → detail), you MAY include a declart block:
            {DeclartExampleEn}
            Use declart ONLY for genuinely hierarchical structures — not for simple lists or flat comparisons.
            """
        : $"""
            당신은 토픽 학습 도우미입니다.

            토픽: {topic.Title}
            {(string.IsNullOrEmpty(topic.Description) ? "" : $"설명: {topic.Description}")}

            참고 자료:
            {researchContext}

            규칙:
            - 위 토픽에 관련된 질문에만 답하세요.
            - 명확하고 교육적으로 설명하세요.
            - 한국어로 답하세요.
            - 수치 데이터, 진도, 비교를 설명할 때 다음과 같이 위젯 블록을 포함할 수 있습니다:
            {WidgetExampleKo}
            사용 가능한 위젯: metric, gauge, progress, chart.bar, table
            위젯은 이해에 실질적으로 도움이 될 때만 사용하세요.
            - 3단계 이상의 계층 구조를 설명할 때(예: 대분류 → 중분류 → 세부 항목) 다음과 같이 declart 블록을 포함할 수 있습니다:
            {DeclartExampleKo}
            declart는 진정한 계층 구조에만 사용하세요 — 단순 목록이나 평면적 비교에는 사용하지 마세요.
            """;

    private const string DeclartExampleEn = """
        ```declart
        kind = 'hierarchy'
        title = 'Concept Title'
        [[nodes]]
        label = 'Root Concept'
        [[nodes]]
        label = 'Category A'
        parent = 'Root Concept'
        [[nodes]]
        label = 'Detail A1'
        parent = 'Category A'
        [[nodes]]
        label = 'Category B'
        parent = 'Root Concept'
        ```
        CRITICAL: Each 'parent' value must be the EXACT full string of another node's 'label'. Never abbreviate or shorten — partial matches will break rendering.
        """;

    private const string DeclartExampleKo = """
        ```declart
        kind = 'hierarchy'
        title = '개념 제목'
        [[nodes]]
        label = '루트 개념'
        [[nodes]]
        label = '분류 A'
        parent = '루트 개념'
        [[nodes]]
        label = '세부 A1'
        parent = '분류 A'
        [[nodes]]
        label = '분류 B'
        parent = '루트 개념'
        ```
        반드시 지킬 것: 각 'parent' 값은 다른 노드의 'label' 전체 문자열과 정확히 일치해야 합니다. 절대 축약하거나 일부만 쓰지 마세요 — 부분 일치는 렌더링 오류를 유발합니다.
        """;

    private const string WidgetExampleEn = """
        ```widget
        {"widget":"metric","data":{"value":42,"unit":"items","label":"Total"}}
        ```
        ```widget
        {"widget":"gauge","data":{"value":73,"min":0,"max":100,"label":"Completion"}}
        ```
        ```widget
        {"widget":"chart.bar","data":[{"x":"Mon","y":3},{"x":"Tue","y":5}],"mapping":{"x":"x","y":"y"}}
        ```
        ```widget
        {"widget":"table","data":[{"term":"A","def":"..."},{"term":"B","def":"..."}]}
        ```
        """;

    private const string WidgetExampleKo = """
        ```widget
        {"widget":"metric","data":{"value":42,"unit":"개","label":"총계"}}
        ```
        ```widget
        {"widget":"gauge","data":{"value":73,"min":0,"max":100,"label":"완료율"}}
        ```
        ```widget
        {"widget":"chart.bar","data":[{"x":"월","y":3},{"x":"화","y":5}],"mapping":{"x":"x","y":"y"}}
        ```
        ```widget
        {"widget":"table","data":[{"항목":"A","설명":"..."},{"항목":"B","설명":"..."}]}
        ```
        """;
}
