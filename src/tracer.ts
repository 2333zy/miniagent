import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Action, LLMConfig } from "./types.js";

const traceEntries: string[] = [];
const TRACE_DIR = "logs";

// 日志模块：集中打印 Agent 运行过程，避免 main.ts 里到处都是 console.log。
export function traceSessionStart(): void {
  traceBlock("Session start", ["MiniAgent interactive mode started.", "Type /help to see commands."]);
}

export function traceSessionEnd(): void {
  traceBlock("Session end", ["MiniAgent stopped."]);
}

export function traceHelp(): void {
  traceBlock("Help", [
    "/help    Show available commands.",
    "/memory  Show current session memory.",
    "/clear   Clear current session memory.",
    "/exit    Quit MiniAgent.",
    "/quit    Quit MiniAgent.",
  ]);
}

export function traceTaskStart(taskNumber: number): void {
  traceLine(`\n=== Task ${taskNumber} ===`);
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

export function traceMemoryContext(memoryText: string): void {
  traceBlock("Memory context", [memoryText]);
}

export function traceMemoryUpdated(memorySize: number): void {
  traceBlock("Memory updated", [`Stored tasks: ${memorySize}`]);
}

export function traceMemoryView(memoryText: string | undefined): void {
  traceBlock("Session memory", [memoryText ?? "Current session memory is empty."]);
}

export function traceMemoryCleared(): void {
  traceBlock("Memory cleared", ["Current session memory is now empty."]);
}

export function traceStepStart(step: number): void {
  traceLine(`\n--- Step ${step} ---`);
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

export function traceToolLimitReached(maxToolCalls: number): void {
  traceBlock("Tool limit", [`Reached max tool calls: ${maxToolCalls}`]);
}

export function traceToolSummary(summary: string): void {
  traceBlock("Tool summary", [summary]);
}

export function traceFinalAnswer(answer: string): void {
  traceBlock("Final answer", [answer]);
}

export function traceMaxStepsReached(maxSteps: number): void {
  traceBlock("Agent stopped", [`Reached the max step limit: ${maxSteps}`]);
}

export async function saveTraceToFile(): Promise<string> {
  const filePath = buildTraceFilePath();

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${traceEntries.join("\n")}\n`, "utf8");

  const relativePath = path.relative(process.cwd(), filePath);

  console.log(`\n[Trace saved]`);
  console.log(relativePath);

  return filePath;
}

function traceBlock(title: string, lines: string[]): void {
  traceLine(`\n[${title}]`);
  traceLine(lines.join("\n"));
}

function traceLine(text: string): void {
  console.log(text);
  traceEntries.push(text);
}

function formatToolInput(input: string): string {
  try {
    return JSON.stringify(JSON.parse(input), null, 2);
  } catch {
    return input;
  }
}

function buildTraceFilePath(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  return path.join(process.cwd(), TRACE_DIR, `${timestamp}.trace.txt`);
}
