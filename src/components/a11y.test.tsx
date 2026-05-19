import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import QuizViewer from "./QuizViewer";
import SurveyModal from "./SurveyModal";

// API 모킹
vi.mock("../lib/api", () => ({
  submitEval: vi.fn().mockResolvedValue({ newLevel: 5, levelChanged: false }),
  surveyStream: async function* () { /* 질문 없음 */ },
  saveSurveyAnswers: vi.fn().mockResolvedValue(undefined),
}));

const SAMPLE_QUIZ = JSON.stringify([
  {
    question: "Python은 어떤 언어인가?",
    options: ["프로그래밍 언어", "마크업 언어", "데이터베이스", "운영체제"],
    answer: 0,
    explanation: "Python은 범용 프로그래밍 언어입니다.",
  },
]);

// --- QuizViewer A11y ---

describe("QuizViewer A11y", () => {
  it("퀴즈 옵션이 button으로 렌더링됨", () => {
    render(<QuizViewer body={SAMPLE_QUIZ} />);
    const buttons = screen.getAllByRole("button");
    const optionButtons = buttons.filter((b) =>
      /^[A-D]\./.test(b.getAttribute("aria-label") ?? "")
    );
    expect(optionButtons.length).toBe(4);
  });

  it("퀴즈 옵션 버튼에 aria-label 있음", () => {
    render(<QuizViewer body={SAMPLE_QUIZ} />);
    expect(screen.getByRole("button", { name: /A\. 프로그래밍 언어/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /B\. 마크업 언어/ })).toBeTruthy();
  });

  it("퀴즈 옵션 버튼에 aria-pressed 속성 있음 (선택 전)", () => {
    render(<QuizViewer body={SAMPLE_QUIZ} />);
    const optBtn = screen.getByRole("button", { name: /A\. 프로그래밍 언어/ });
    expect(optBtn.hasAttribute("aria-pressed")).toBe(true);
  });

  it("빈 body — 빈 상태 메시지 렌더링", () => {
    render(<QuizViewer body="" />);
    expect(screen.getByText("문제가 없습니다.")).toBeTruthy();
  });
});

// --- SurveyModal A11y ---

describe("SurveyModal A11y", () => {
  it("role=dialog 있음", () => {
    render(<SurveyModal topicId="test-topic" onClose={() => {}} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
  });

  it("aria-modal=true 있음", () => {
    render(<SurveyModal topicId="test-topic" onClose={() => {}} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("aria-labelledby로 제목과 연결됨", () => {
    render(<SurveyModal topicId="test-topic" onClose={() => {}} />);
    const dialog = screen.getByRole("dialog");
    const labelId = dialog.getAttribute("aria-labelledby");
    expect(labelId).toBeTruthy();
    const title = document.getElementById(labelId!);
    expect(title).toBeTruthy();
    expect(title?.textContent).toContain("학습 목표 파악");
  });

  it("닫기 버튼에 aria-label 있음", () => {
    render(<SurveyModal topicId="test-topic" onClose={() => {}} />);
    const closeBtn = screen.getByRole("button", { name: "모달 닫기" });
    expect(closeBtn).toBeTruthy();
  });
});

// --- SurveyModal Focus Trap 키보드 통합 테스트 ---

describe("SurveyModal Focus Trap", () => {
  it("Tab: 마지막 포커서블 요소에서 첫 번째로 순환", async () => {
    const user = userEvent.setup();
    render(<SurveyModal topicId="test-topic" onClose={vi.fn()} />);

    // surveyStream이 즉시 완료되어 스트리밍 종료 대기
    const submitBtn = await screen.findByRole("button", { name: "완료 — 학습 시작" });
    const closeBtn = screen.getByRole("button", { name: "모달 닫기" });
    const cancelBtn = screen.getByRole("button", { name: "건너뛰기" });

    // 마지막 요소(취소 버튼)에 포커스
    cancelBtn.focus();
    expect(document.activeElement).toBe(cancelBtn);

    // Tab → 첫 번째 포커서블 요소(닫기 버튼)로 순환해야 함
    await user.keyboard("{Tab}");
    expect(document.activeElement).toBe(closeBtn);
    void submitBtn; // 사용 확인
  });

  it("Shift+Tab: 첫 번째 포커서블 요소에서 마지막으로 순환", async () => {
    const user = userEvent.setup();
    render(<SurveyModal topicId="test-topic" onClose={vi.fn()} />);

    await screen.findByRole("button", { name: "완료 — 학습 시작" });
    const closeBtn = screen.getByRole("button", { name: "모달 닫기" });
    const cancelBtn = screen.getByRole("button", { name: "건너뛰기" });

    // 첫 번째 요소(닫기 버튼)에 포커스
    closeBtn.focus();
    expect(document.activeElement).toBe(closeBtn);

    // Shift+Tab → 마지막 포커서블 요소(취소 버튼)로 순환
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement).toBe(cancelBtn);
  });

  it("Escape 키로 모달 닫힘", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SurveyModal topicId="test-topic" onClose={onClose} />);

    await screen.findByRole("button", { name: "완료 — 학습 시작" });

    await user.keyboard("{Escape}");
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("다이얼로그 외부 포커스 이탈 방지 — Tab 사이클 완전 순환", async () => {
    const user = userEvent.setup();
    render(<SurveyModal topicId="test-topic" onClose={vi.fn()} />);

    await screen.findByRole("button", { name: "완료 — 학습 시작" });
    const closeBtn = screen.getByRole("button", { name: "모달 닫기" });
    const submitBtn = screen.getByRole("button", { name: "완료 — 학습 시작" });
    const cancelBtn = screen.getByRole("button", { name: "건너뛰기" });

    // 첫 요소부터 Tab 3회 → 첫 요소로 돌아와야 함
    closeBtn.focus();
    await user.keyboard("{Tab}"); // close → submit
    expect(document.activeElement).toBe(submitBtn);
    await user.keyboard("{Tab}"); // submit → cancel
    expect(document.activeElement).toBe(cancelBtn);
    await user.keyboard("{Tab}"); // cancel → close (wrap)
    expect(document.activeElement).toBe(closeBtn);
  });
});
