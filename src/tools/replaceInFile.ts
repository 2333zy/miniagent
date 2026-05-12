import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { resolveSafePath } from "./pathSafety.js";
import { formatDiffReviewCommand } from "./reviewHint.js";
import { getRequiredString, getStringField, parseJsonObject } from "./validation.js";

const EDITABLE_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

// 安全替换工具：只在 oldText 精确匹配一次时修改文件。
export async function replaceInFile(input: string): Promise<string> {
  const data = parseJsonObject(input, "replaceInFile");
  const requestedPath = getRequiredString(data, "path", "replaceInFile");
  const oldText = getRequiredString(data, "oldText", "replaceInFile");
  const newText = getStringField(data, "newText", "replaceInFile");

  if (oldText === newText) {
    throw new Error("replaceInFile 的 oldText 和 newText 不能完全相同");
  }

  const safePath = resolveSafePath(requestedPath);
  const relativePath = path.relative(process.cwd(), safePath);

  validateEditablePath(relativePath);

  const content = await readFile(safePath, "utf8");
  const matchCount = countOccurrences(content, oldText);

  if (matchCount === 0) {
    throw new Error("replaceInFile 找不到 oldText，文件未修改");
  }

  if (matchCount > 1) {
    throw new Error(`replaceInFile 找到 ${matchCount} 处 oldText，担心误改，文件未修改`);
  }

  const updatedContent = content.replace(oldText, newText);

  await writeFile(safePath, updatedContent, "utf8");

  return [
    `File edited: ${relativePath}`,
    `Replacements: 1`,
    `Old text characters: ${oldText.length}`,
    `New text characters: ${newText.length}`,
    formatDiffReviewCommand(relativePath),
  ].join("\n");
}

function validateEditablePath(relativePath: string): void {
  const extension = path.extname(relativePath).toLowerCase();

  if (!EDITABLE_EXTENSIONS.has(extension)) {
    throw new Error("replaceInFile 只允许编辑常见文本或代码文件");
  }
}

function countOccurrences(text: string, searchText: string): number {
  let count = 0;
  let index = 0;

  while (true) {
    const foundIndex = text.indexOf(searchText, index);

    if (foundIndex === -1) {
      return count;
    }

    count = count + 1;
    index = foundIndex + searchText.length;
  }
}
