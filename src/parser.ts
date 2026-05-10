import type { ParsedAssistantOutput } from "./types.js";

// 把模型输出的 XML 风格文本解析成 action 或 final。
export function parseAssistantOutput(text: string): ParsedAssistantOutput {
  const actionMatch = text.match(/<action tool="([^"]+)">([\s\S]*?)<\/action>/);

  if (actionMatch) {
    return {
      action: {
        tool: actionMatch[1],
        input: actionMatch[2],
      },
    };
  }

  const finalMatch = text.match(/<final>([\s\S]*?)<\/final>/);

  if (finalMatch) {
    return {
      final: finalMatch[1],
    };
  }

  return {
    final: text,
  };
}
