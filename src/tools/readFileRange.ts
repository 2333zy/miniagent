import { readFile as readFileFromDisk } from "node:fs/promises";
import path from "node:path";

import { resolveSafePath } from "./pathSafety.js";
import { getRequiredInteger, getRequiredString, parseJsonObject } from "./validation.js";

const MAX_RANGE_LINES = 200;

// 按行读取文件片段：适合 searchCode 定位后查看附近上下文。
export async function readFileRange(input: string): Promise<string> {
  const data = parseJsonObject(input, "readFileRange");
  const requestedPath = getRequiredString(data, "path", "readFileRange");
  const startLine = getRequiredInteger(data, "startLine", "readFileRange");
  const endLine = getRequiredInteger(data, "endLine", "readFileRange");

  if (startLine < 1 || endLine < startLine) {
    throw new Error("readFileRange 要求 startLine >= 1 且 endLine >= startLine");
  }

  if (endLine - startLine + 1 > MAX_RANGE_LINES) {
    throw new Error(`readFileRange 一次最多读取 ${MAX_RANGE_LINES} 行`);
  }

  const safePath = resolveSafePath(requestedPath);
  const content = await readFileFromDisk(safePath, "utf8");
  const lines = content.split(/\r?\n/);
  const startIndex = startLine - 1;
  const endIndex = Math.min(endLine, lines.length);
  const selectedLines = lines.slice(startIndex, endIndex);
  const relativePath = path.relative(process.cwd(), safePath);

  if (selectedLines.length === 0) {
    return `File: ${relativePath}\nRequested lines: ${startLine}-${endLine}\nContent:\n[no lines in requested range]`;
  }

  const numberedLines = selectedLines.map((line, index) => {
    const lineNumber = startLine + index;

    return `${lineNumber}: ${line}`;
  });

  return `File: ${relativePath}\nLines: ${startLine}-${endIndex}\nContent:\n${numberedLines.join("\n")}`;
}
