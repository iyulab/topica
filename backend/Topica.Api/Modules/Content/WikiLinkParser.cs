// backend/Topica.Api/Modules/Content/WikiLinkParser.cs
using System.Text.RegularExpressions;

namespace Topica.Api.Modules.Contents;

public static class WikiLinkParser
{
    private static readonly Regex CodeBlockRe =
        new(@"```[\s\S]*?```|`[^`\n]*`", RegexOptions.Compiled);

    private static readonly Regex WikiLinkRe =
        new(@"\[\[([^\]\n]+)\]\]", RegexOptions.Compiled);

    /// <summary>
    /// 마크다운에서 [[TopicName]] 형식의 토픽 참조를 추출한다.
    /// 코드 블록(``` ```) 및 인라인 코드(`) 내부는 제외된다.
    /// </summary>
    public static IReadOnlySet<string> Extract(string markdown)
    {
        markdown ??= string.Empty;
        var stripped = CodeBlockRe.Replace(markdown, " ");
        return WikiLinkRe.Matches(stripped)
            .Select(m => m.Groups[1].Value.Trim())
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .ToHashSet();
    }
}
