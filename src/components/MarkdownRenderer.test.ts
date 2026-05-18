import { describe, it, expect } from "vitest";
import { preprocessWikiLinks } from "./MarkdownRenderer";

describe("preprocessWikiLinks", () => {
  it("알려진 토픽은 topic: 링크로 변환", () => {
    const index = { "머신러닝": "topic-123" };
    const result = preprocessWikiLinks("[[머신러닝]] 개요", index);
    expect(result).toBe("[머신러닝](topic:topic-123) 개요");
  });

  it("알 수 없는 토픽은 볼드체로 변환", () => {
    const result = preprocessWikiLinks("[[자연어처리]] 개요", {});
    expect(result).toBe("**자연어처리** 개요");
  });

  it("인덱스가 비어있으면 모두 볼드체", () => {
    const result = preprocessWikiLinks("[[딥러닝]] 및 [[강화학습]]", {});
    expect(result).toBe("**딥러닝** 및 **강화학습**");
  });

  it("위키링크 없으면 원본 반환", () => {
    const result = preprocessWikiLinks("일반 텍스트", { "머신러닝": "id1" });
    expect(result).toBe("일반 텍스트");
  });

  it("alias 있는 토픽은 표시명으로 링크", () => {
    const index = { "머신러닝": "ml-id" };
    const result = preprocessWikiLinks("[[머신러닝|ML]] 소개", index);
    expect(result).toBe("[ML](topic:ml-id) 소개");
  });

  it("alias 있는 미존재 토픽은 표시명으로 볼드체", () => {
    const result = preprocessWikiLinks("[[딥러닝|DL]] 개요", {});
    expect(result).toBe("**DL** 개요");
  });
});
