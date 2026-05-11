import { readdir } from "node:fs/promises";
import path from "node:path";

import { isSensitivePath, resolveSafePath } from "./pathSafety.js";

type ListFilesInput = {
  path?: string;
};

const MAX_LIST_ENTRIES = 120;
const IGNORED_DIRECTORIES = new Set([".git", "node_modules", "dist"]);

// 列目录工具：递归列出当前项目内的文件，方便模型先探索项目结构。
export async function listFiles(input: string): Promise<string> {
  const data = JSON.parse(input || "{}") as Partial<ListFilesInput>;

  if (data.path !== undefined && typeof data.path !== "string") {
    throw new Error("listFiles 的 path 字段必须是字符串");
  }

  const safePath = resolveSafePath(data.path ?? ".");
  const entries = await collectFiles(safePath);
  const relativePath = path.relative(process.cwd(), safePath) || ".";
  const visibleEntries = entries.slice(0, MAX_LIST_ENTRIES);
  const suffix =
    entries.length > MAX_LIST_ENTRIES
      ? `\n[truncated: showing ${MAX_LIST_ENTRIES} of ${entries.length} entries]`
      : "";

  return `Directory: ${relativePath}\nFiles:\n${visibleEntries.join("\n")}${suffix}`;
}

async function collectFiles(rootPath: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(currentPath: string): Promise<void> {
    if (results.length >= MAX_LIST_ENTRIES + 1) {
      return;
    }

    const dirEntries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of dirEntries) {
      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(process.cwd(), fullPath);

      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name) || isSensitivePath(fullPath)) {
          continue;
        }

        results.push(`${relativePath}/`);
        await walk(fullPath);
        continue;
      }

      if (entry.isFile() && !isSensitivePath(fullPath)) {
        results.push(relativePath);
      }
    }
  }

  await walk(rootPath);

  return results;
}
