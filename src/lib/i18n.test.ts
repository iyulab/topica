import { describe, it, expect, beforeEach } from "vitest";
import i18n from "./i18n";

describe("i18n language switching", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("ko");
  });

  it("한국어 상태에서 quiz.empty가 한국어로 반환됨", () => {
    expect(i18n.t("quiz.empty")).toBe("문제가 없습니다.");
  });

  it("영어 전환 후 quiz.empty가 영어로 반환됨", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("quiz.empty")).toBe("No questions.");
  });

  it("영어 전환 후 survey.submit이 영어로 반환됨", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("survey.submit")).toBe("Done — Start Learning");
  });

  it("한국어 복원 후 topic.add가 한국어로 반환됨", async () => {
    await i18n.changeLanguage("en");
    await i18n.changeLanguage("ko");
    expect(i18n.t("topic.add")).toBe("시작하기");
  });
});
