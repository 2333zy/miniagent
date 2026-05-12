import type { Action } from "./types.js";

export type ToolCallRecord = {
  step: number;
  tool: string;
};

export type ToolStats = {
  calls: ToolCallRecord[];
};

export const MAX_TOOL_CALLS_PER_TASK = 5;

// 创建单个任务内的工具调用统计。
export function createToolStats(): ToolStats {
  return {
    calls: [],
  };
}

// 记录模型在某一步调用了哪个工具。
export function recordToolCall(stats: ToolStats, step: number, action: Action): void {
  stats.calls.push({
    step,
    tool: action.tool,
  });
}

export function hasReachedToolCallLimit(stats: ToolStats): boolean {
  return stats.calls.length >= MAX_TOOL_CALLS_PER_TASK;
}

// 把工具调用统计整理成日志文本。
export function formatToolStats(stats: ToolStats): string {
  if (stats.calls.length === 0) {
    return ["Tool calls: 0", "Tools: none"].join("\n");
  }

  const toolOrder = stats.calls.map((call) => call.tool).join(" -> ");
  const details = stats.calls.map((call, index) => {
    return `${index + 1}. Step ${call.step}: ${call.tool}`;
  });

  return [`Tool calls: ${stats.calls.length}`, `Tools: ${toolOrder}`, ...details].join("\n");
}
