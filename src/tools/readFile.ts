import { readFile as readFileFromDisk } from "node:fs/promises";
import path from "node:path";

import { resolveSafePath } from "./pathSafety.js";
import { getRequiredString, parseJsonObject } from "./validation.js";

const MAX_FILE_CHARS = 8000;

// 读文件工具：允许读取当前项目内的文本文件，但会拦截敏感路径和超长输出。
export async function readFile(input: string): Promise<string> {
  const data = parseJsonObject(input, "readFile");
  const requestedPath = getRequiredString(data, "path", "readFile");

  const safePath = resolveSafePath(requestedPath);
  const content = await readFileFromDisk(safePath, "utf8");
  const relativePath = path.relative(process.cwd(), safePath);

  if (content.length <= MAX_FILE_CHARS) {
    return `File: ${relativePath}\nContent:\n${content}`;
  }

  return [
    `File: ${relativePath}`,
    `Content:`,
    content.slice(0, MAX_FILE_CHARS),
    `[truncated: file is longer than ${MAX_FILE_CHARS} characters]`,
  ].join("\n");
}
