using Topica.Api.Modules.AI;
using Topica.Core.Entities;

namespace Topica.Tests.Content;

public class MindmapPromptTests
{
    private static Topic MakeTopic() => new()
    {
        Id = Guid.NewGuid(),
        Title = "머신러닝",
        UserLevel = 3
    };

    [Fact]
    public void Mindmap_EnglishPrompt_ContainsMarkdownHeadings()
    {
        var prompt = PromptBuilder.Mindmap(MakeTopic(), "no context", 3, "en");
        Assert.Contains("# ", prompt);
        Assert.Contains("## ", prompt);
        Assert.Contains("### ", prompt);
    }

    [Fact]
    public void Mindmap_KoreanPrompt_ContainsMarkdownHeadings()
    {
        var prompt = PromptBuilder.Mindmap(MakeTopic(), "컨텍스트 없음", 3, "ko");
        Assert.Contains("# ", prompt);
        Assert.Contains("## ", prompt);
        Assert.Contains("### ", prompt);
    }

    [Fact]
    public void Mindmap_Prompt_DoesNotContainDeclartToml()
    {
        var prompt = PromptBuilder.Mindmap(MakeTopic(), "no context", 3, "en");
        Assert.DoesNotContain("kind = \"hierarchy\"", prompt);
        Assert.DoesNotContain("[[items]]", prompt);
        Assert.DoesNotContain("parent =", prompt);
    }
}
