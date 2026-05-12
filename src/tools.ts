import { bash } from "./tools/bash.js";
import { getTime } from "./tools/getTime.js";
import { getWeather } from "./tools/getWeather.js";
import { listFiles } from "./tools/listFiles.js";
import { readFile } from "./tools/readFile.js";
import { readFileRange } from "./tools/readFileRange.js";
import { searchCode } from "./tools/searchCode.js";
import type { Action } from "./types.js";

type ToolFunction = (input: string) => Promise<string>;

type ToolMap = {
  [toolName: string]: ToolFunction | undefined;
};

// 工具注册表：以后新增工具时，主要是在这里登记。
const tools: ToolMap = {
  bash,
  getTime,
  getWeather,
  readFile,
  readFileRange,
  listFiles,
  searchCode,
};

// 根据模型请求的工具名，从工具表中找到并执行对应工具。
export async function executeTool(action: Action): Promise<string> {
  const tool = tools[action.tool];

  if (!tool) {
    return `Tool error: unknown tool "${action.tool}"`;
  }

  try {
    return await tool(action.input);
  } catch (error) {
    if (error instanceof Error) {
      return `Tool error from ${action.tool}: ${error.message}`;
    }

    return `Tool error from ${action.tool}: ${String(error)}`;
  }
}
