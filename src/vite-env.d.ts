/// <reference types="vite/client" />

// @iyulab/declart exports field lacks a "types" condition — declare manually
// until upstream fixes package.json (see claudedocs/issues/ISSUE-Declart-…)
declare module "@iyulab/declart" {
  export function render(input: string, theme?: string, width?: number): string;
  export function renderJson(input: string, theme?: string, width?: number): string;
  export function renderWithThemeToml(input: string, themeToml: string, width?: number): string;
  export function validate(input: string): void;
  export function themes(): string[];
  export function kinds(): string[];
}
