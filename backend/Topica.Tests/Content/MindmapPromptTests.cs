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
    public void Mindmap_EnglishPrompt_ContainsDeclartToml()
    {
        var prompt = PromptBuilder.Mindmap(MakeTopic(), "no context", 3, "en");
        Assert.Contains("kind = 'hierarchy'", prompt);
        Assert.Contains("[[nodes]]", prompt);
        Assert.Contains("parent =", prompt);
    }

    [Fact]
    public void Mindmap_KoreanPrompt_ContainsDeclartToml()
    {
        var prompt = PromptBuilder.Mindmap(MakeTopic(), "컨텍스트 없음", 3, "ko");
        Assert.Contains("kind = 'hierarchy'", prompt);
        Assert.Contains("[[nodes]]", prompt);
        Assert.Contains("parent =", prompt);
    }

    [Fact]
    public void Mindmap_Prompt_DoesNotContainMarkdownHeadings()
    {
        var prompt = PromptBuilder.Mindmap(MakeTopic(), "no context", 3, "en");
        Assert.DoesNotContain("## ", prompt);
        Assert.DoesNotContain("### ", prompt);
    }
}
