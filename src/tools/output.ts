export const MAX_TOOL_OUTPUT_CHARS = 8000;

// 统一截断工具输出，避免长文件、长搜索结果或长命令结果一次性塞爆上下文。
export function truncateOutput(
  text: string,
  description: string,
  maxChars = MAX_TOOL_OUTPUT_CHARS,
): string {
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars)}\n[truncated: ${description} is longer than ${maxChars} characters]`;
}
