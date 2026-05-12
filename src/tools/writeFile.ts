import { mkdir, writeFile as writeFileToDisk } from "node:fs/promises";
import path from "node:path";

import { resolveSafePath } from "./pathSafety.js";
import { formatWrittenFileReviewHint } from "./reviewHint.js";
import { getRequiredString, parseJsonObject } from "./validation.js";

// 写文件工具第一版：只允许写 notes/ 目录下的 Markdown 文件。
export async function writeFile(input: string): Promise<string> {
  const data = parseJsonObject(input, "writeFile");
  const requestedPath = getRequiredString(data, "path", "writeFile");
  const content = getRequiredString(data, "content", "writeFile");

  const safePath = resolveSafePath(requestedPath);
  const relativePath = path.relative(process.cwd(), safePath);

  validateWritableMarkdownPath(relativePath);

  await mkdir(path.dirname(safePath), { recursive: true });
  await writeFileToDisk(safePath, content, "utf8");

  return [
    `File written: ${relativePath}`,
    `Characters: ${content.length}`,
    formatWrittenFileReviewHint(relativePath),
  ].join("\n");
}

function validateWritableMarkdownPath(relativePath: string): void {
  const normalizedPath = relativePath.split(path.sep).join("/");

  if (path.dirname(normalizedPath) !== "notes") {
    throw new Error("writeFile 目前只允许写 notes/ 目录下的文件");
  }

  if (path.extname(normalizedPath).toLowerCase() !== ".md") {
    throw new Error("writeFile 目前只允许写 .md 文件");
  }
}
