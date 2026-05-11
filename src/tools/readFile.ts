import { readFile as readFileFromDisk } from "node:fs/promises";
import path from "node:path";

import { resolveSafePath } from "./pathSafety.js";

type ReadFileInput = {
  path: string;
};

const MAX_FILE_CHARS = 8000;

// 读文件工具：允许读取当前项目内的文本文件，但会拦截敏感路径和超长输出。
export async function readFile(input: string): Promise<string> {
  const data = JSON.parse(input) as Partial<ReadFileInput>;

  if (typeof data.path !== "string") {
    throw new Error("readFile 需要 path 字段，并且 path 必须是字符串");
  }

  const safePath = resolveSafePath(data.path);
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
