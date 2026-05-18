using Topica.Api.Modules.AI;

namespace Topica.Tests.Content;

public class MindmapNormalizerTests
{
    [Fact]
    public void AlreadyToml_Passthrough()
    {
        var input = "kind = 'hierarchy'\ntitle = \"광합성\"\n[[nodes]]\nlabel = \"광합성\"";
        var result = MindmapNormalizer.Normalize(input);
        Assert.StartsWith("kind = 'hierarchy'", result);
        Assert.Equal(input, result);
    }

    [Fact]
    public void MarkdownHeadings_ConvertsToToml()
    {
        var input = "# 광합성\n## 명반응 과정\n### 틸라코이드막\n## 암반응 과정";
        var result = MindmapNormalizer.Normalize(input);

        Assert.StartsWith("kind = 'hierarchy'", result);
        Assert.Contains("title = \"광합성\"", result);
        Assert.Contains("label = \"광합성\"", result);
        Assert.Contains("label = \"명반응 과정\"", result);
        Assert.Contains("label = \"틸라코이드막\"", result);
        Assert.Contains("label = \"암반응 과정\"", result);
        Assert.Contains("[[nodes]]", result);
    }

    [Fact]
    public void MarkdownHeadings_ParentAssignedCorrectly()
    {
        var input = "# 루트\n## 자식1\n### 손자1\n## 자식2";
        var result = MindmapNormalizer.Normalize(input);

        // 자식1 → 루트
        var lines = result.Split('\n');
        int idx자식1 = Array.FindIndex(lines, l => l.Contains("자식1"));
        Assert.True(idx자식1 >= 0);
        Assert.Contains($"parent = \"루트\"", lines[idx자식1 + 1]);

        // 손자1 → 자식1
        int idx손자1 = Array.FindIndex(lines, l => l.Contains("손자1"));
        Assert.True(idx손자1 >= 0);
        Assert.Contains($"parent = \"자식1\"", lines[idx손자1 + 1]);

        // 자식2 → 루트 (자식1과 같은 레벨이므로 손자1 무시)
        int idx자식2 = Array.FindIndex(lines, l => l.Contains("자식2"));
        Assert.True(idx자식2 >= 0);
        Assert.Contains($"parent = \"루트\"", lines[idx자식2 + 1]);
    }

    [Fact]
    public void CodeFence_StrippedBeforeConversion()
    {
        var inner = "kind = 'hierarchy'\ntitle = \"테스트\"\n[[nodes]]\nlabel = \"테스트\"";
        var input = $"```toml\n{inner}\n```";
        var result = MindmapNormalizer.Normalize(input);
        Assert.StartsWith("kind = 'hierarchy'", result);
    }

    [Fact]
    public void CodeFence_WrappedMarkdown_ConvertsToToml()
    {
        var input = "```\n# 광합성\n## 명반응 과정\n```";
        var result = MindmapNormalizer.Normalize(input);
        Assert.StartsWith("kind = 'hierarchy'", result);
        Assert.Contains("label = \"광합성\"", result);
        Assert.Contains("label = \"명반응 과정\"", result);
    }

    [Fact]
    public void InlineFormatting_StrippedFromLabels()
    {
        var input = "# **광합성** 핵심\n## `틸라코이드`막";
        var result = MindmapNormalizer.Normalize(input);
        Assert.Contains("광합성 핵심", result);
        Assert.Contains("틸라코이드막", result);
        Assert.DoesNotContain("**", result);
        Assert.DoesNotContain("`", result);
    }

    [Fact]
    public void RealQwenOutput_ConvertsToValidToml()
    {
        // Actual qwen3.6 output observed during E2E testing
        var input = """
            # 광합성
            ## 정의와 생리적 필요성
            ### 태양에너지 전환 매커니즘
            ### 생산자 생물의 핵심 대사
            ### 지구 탄소 순환 기점
            ## 핵심 화학 반응식
            ### 반응물과 생성물
            ### 에너지 전환 표현
            """;

        var result = MindmapNormalizer.Normalize(input);

        Assert.StartsWith("kind = 'hierarchy'", result);
        Assert.Contains("title = \"광합성\"", result);
        Assert.Contains("label = \"정의와 생리적 필요성\"", result);
        Assert.Contains("label = \"태양에너지 전환 매커니즘\"", result);
        Assert.Contains("parent = \"광합성\"", result);
        Assert.Contains("parent = \"정의와 생리적 필요성\"", result);
        Assert.DoesNotContain("## ", result);
        Assert.DoesNotContain("### ", result);
    }

    [Fact]
    public void RootNode_HasNoParent()
    {
        var input = "# 루트\n## 자식";
        var result = MindmapNormalizer.Normalize(input);

        var lines = result.Split('\n');
        // First [[nodes]] block should have label = "루트" with no parent line before second [[nodes]]
        int firstNodes = Array.FindIndex(lines, l => l.Trim() == "[[nodes]]");
        Assert.True(firstNodes >= 0);
        // Next line after label should be [[nodes]] (no parent) or end
        int labelLine = Array.FindIndex(lines, firstNodes, l => l.Contains("label = \"루트\""));
        Assert.True(labelLine >= 0);
        Assert.DoesNotContain("parent", lines[labelLine + 1]);
    }
}
