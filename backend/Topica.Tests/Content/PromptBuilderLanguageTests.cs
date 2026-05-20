using Topica.Api.Modules.AI;
using Topica.Core.Entities;

namespace Topica.Tests.Content;

public class PromptBuilderLanguageTests
{
    private static Topic MakeTopic() => new() { Id = Guid.NewGuid(), Title = "Machine Learning" };

    [Fact]
    public void SurveySystem_Ko_ContainsKorean()
    {
        var result = PromptBuilder.SurveySystem(MakeTopic(), "ko");
        Assert.Contains("학습 도우미", result);
    }

    [Fact]
    public void SurveySystem_En_ContainsEnglish()
    {
        var result = PromptBuilder.SurveySystem(MakeTopic(), "en");
        Assert.Contains("learning assistant", result);
    }

    [Fact]
    public void TagSystem_AlwaysEnglish()
    {
        var ko = PromptBuilder.TagSystem("ko");
        var en = PromptBuilder.TagSystem("en");
        Assert.Contains("Extract", ko);
        Assert.Contains("Extract", en);
    }
}
