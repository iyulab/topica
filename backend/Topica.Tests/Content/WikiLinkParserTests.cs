// backend/Topica.Tests/Content/WikiLinkParserTests.cs
using Topica.Api.Modules.Contents;

namespace Topica.Tests.Content;

public class WikiLinkParserTests
{
    [Fact]
    public void Extract_BasicLink_ReturnsTitle()
    {
        var result = WikiLinkParser.Extract("학습 중 [[머신러닝]] 개념이 등장합니다.");
        Assert.Contains("머신러닝", result);
        Assert.Single(result);
    }

    [Fact]
    public void Extract_MultipleLinks_ReturnsAll()
    {
        var result = WikiLinkParser.Extract("[[딥러닝]]과 [[자연어처리]]를 이해하세요.");
        Assert.Contains("딥러닝", result);
        Assert.Contains("자연어처리", result);
        Assert.Equal(2, result.Count);
    }

    [Fact]
    public void Extract_LinkInsideFencedCodeBlock_IsIgnored()
    {
        var result = WikiLinkParser.Extract("```\n[[코드블록 내부]]\n```");
        Assert.Empty(result);
    }

    [Fact]
    public void Extract_LinkInsideInlineCode_IsIgnored()
    {
        var result = WikiLinkParser.Extract("예시: `[[인라인]]` 코드");
        Assert.Empty(result);
    }

    [Fact]
    public void Extract_DuplicateLinks_ReturnsDistinct()
    {
        var result = WikiLinkParser.Extract("[[머신러닝]]과 [[머신러닝]]의 차이");
        Assert.Single(result);
        Assert.Contains("머신러닝", result);
    }

    [Fact]
    public void Extract_EmptyString_ReturnsEmpty()
    {
        var result = WikiLinkParser.Extract(string.Empty);
        Assert.Empty(result);
    }

    [Fact]
    public void Extract_NoLinks_ReturnsEmpty()
    {
        var result = WikiLinkParser.Extract("링크 없는 일반 텍스트입니다.");
        Assert.Empty(result);
    }

    [Fact]
    public void Extract_LinkWithWhitespace_TrimsTitle()
    {
        var result = WikiLinkParser.Extract("[[ 공백 포함 ]]");
        Assert.Contains("공백 포함", result);
    }

    [Fact]
    public void Extract_NullInput_ReturnsEmpty()
    {
        var result = WikiLinkParser.Extract(null!);
        Assert.Empty(result);
    }
}
