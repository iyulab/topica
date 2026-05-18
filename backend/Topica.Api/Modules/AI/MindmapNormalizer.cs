using System.Text;
using System.Text.RegularExpressions;

namespace Topica.Api.Modules.AI;

public static class MindmapNormalizer
{
    private static readonly Regex CodeFence = new(@"```[^\n]*\n([\s\S]*?)```", RegexOptions.Compiled);
    private static readonly Regex Heading = new(@"^(#{1,6})\s+(.+)$", RegexOptions.Multiline | RegexOptions.Compiled);
    private static readonly Regex InlineFmt = new(@"\*\*(.+?)\*\*|`(.+?)`|\*(.+?)\*|_(.+?)_", RegexOptions.Compiled);

    public static string Normalize(string body)
    {
        var text = body.Trim();

        if (text.StartsWith("kind = 'hierarchy'", StringComparison.Ordinal))
            return body;

        // Strip code fences first (model may wrap output in ```toml ... ```)
        var fenceMatch = CodeFence.Match(text);
        if (fenceMatch.Success)
            text = fenceMatch.Groups[1].Value.Trim();

        if (text.StartsWith("kind = 'hierarchy'", StringComparison.Ordinal))
            return text;

        // Convert markdown headings → TOML hierarchy
        var headings = Heading.Matches(text);
        if (headings.Count == 0)
            return body;

        return BuildToml(headings);
    }

    private static string BuildToml(MatchCollection headings)
    {
        var sb = new StringBuilder();
        sb.AppendLine("kind = 'hierarchy'");

        var firstLabel = CleanLabel(headings[0].Groups[2].Value);
        sb.AppendLine($"title = \"{Escape(firstLabel)}\"");

        // parentByLevel[depth] = label of the most recent node at that depth
        var parentByLevel = new string?[7];
        bool isFirst = true;

        foreach (Match m in headings)
        {
            int depth = m.Groups[1].Value.Length;
            var label = CleanLabel(m.Groups[2].Value);

            sb.AppendLine("[[nodes]]");
            sb.AppendLine($"label = \"{Escape(label)}\"");

            if (!isFirst)
            {
                var parent = FindParent(parentByLevel, depth);
                if (parent != null)
                    sb.AppendLine($"parent = \"{Escape(parent)}\"");
            }

            parentByLevel[depth] = label;
            // Invalidate children levels when a node at this depth is written
            for (int i = depth + 1; i <= 6; i++)
                parentByLevel[i] = null;

            isFirst = false;
        }

        return sb.ToString().TrimEnd();
    }

    private static string? FindParent(string?[] parentByLevel, int depth)
    {
        for (int i = depth - 1; i >= 1; i--)
            if (parentByLevel[i] != null) return parentByLevel[i];
        return null;
    }

    private static string CleanLabel(string label) =>
        InlineFmt.Replace(label.Trim(), m =>
            m.Groups[1].Success ? m.Groups[1].Value :
            m.Groups[2].Success ? m.Groups[2].Value :
            m.Groups[3].Success ? m.Groups[3].Value :
            m.Groups[4].Value);

    private static string Escape(string value) =>
        value.Replace("\\", "\\\\").Replace("\"", "\\\"");
}
