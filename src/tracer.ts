import type { Action, LLMConfig } from "./types.js";

// 日志模块：集中打印 Agent 运行过程，避免 main.ts 里到处都是 console.log。
export function traceSessionStart(): void {
  traceBlock("Session start", ["MiniAgent interactive mode started.", "Type /exit to quit."]);
}

export function traceSessionEnd(): void {
  traceBlock("Session end", ["MiniAgent stopped."]);
}

export function traceTaskStart(taskNumber: number): void {
  console.log(`\n=== Task ${taskNumber} ===`);
}

export function traceTaskError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);

  traceBlock("Task error", [message]);
}

export function traceLLMConfigStatus(config: LLMConfig): void {
  traceBlock("LLM config", [
    `API key: ${config.apiKey ? "configured" : "missing"}`,
    `Base URL: ${config.baseUrl}`,
    `Model: ${config.model}`,
    "Runtime: real LLM",
  ]);
}

export function traceUserQuestion(question: string): void {
  traceBlock("User question", [question]);
}

export function traceStepStart(step: number): void {
  console.log(`\n--- Step ${step} ---`);
}

export function traceAssistantOutput(text: string): void {
  traceBlock("Assistant raw output", [text]);
}

export function traceToolCall(action: Action): void {
  traceBlock("Tool call", [`Tool: ${action.tool}`, `Input: ${formatToolInput(action.input)}`]);
}

export function traceToolObservation(observation: string): void {
  traceBlock("Tool observation", [observation]);
}

export function traceFinalAnswer(answer: string): void {
  traceBlock("Final answer", [answer]);
}

export function traceMaxStepsReached(maxSteps: number): void {
  traceBlock("Agent stopped", [`Reached the max step limit: ${maxSteps}`]);
}

function traceBlock(title: string, lines: string[]): void {
  console.log(`\n[${title}]`);
  console.log(lines.join("\n"));
}

function formatToolInput(input: string): string {
  try {
    return JSON.stringify(JSON.parse(input), null, 2);
  } catch {
    return input;
  }
}
