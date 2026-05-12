import type { Action } from "./types.js";

const TOOLS_REQUIRING_APPROVAL = new Set(["writeFile", "replaceInFile"]);

// 写文件和改代码属于高风险动作，执行前必须让用户确认。
export function requiresApproval(action: Action): boolean {
  return TOOLS_REQUIRING_APPROVAL.has(action.tool);
}

export function isApprovalGranted(answer: string | undefined): boolean {
  const normalizedAnswer = answer?.trim().toLowerCase();

  return normalizedAnswer === "y" || normalizedAnswer === "yes";
}
