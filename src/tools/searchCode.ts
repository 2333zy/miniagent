import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { resolveSafePath } from "./pathSafety.js";

type SearchCodeInput = {
  query: string;
  path?: string;
};

type ExecFileError = Error & {
  code?: number | string;
  stdout?: string;
  stderr?: string;
};

const execFileAsync = promisify(execFile);
const MAX_SEARCH_OUTPUT_CHARS = 8000;

// 搜索代码工具：模型只传 query，底层由程序安全调用 rg。
export async function searchCode(input: string): Promise<string> {
  const data = JSON.parse(input) as Partial<SearchCodeInput>;

  if (typeof data.query !== "string" || data.query.trim().length === 0) {
    throw new Error("searchCode 需要非空 query 字段");
  }

  if (data.path !== undefined && typeof data.path !== "string") {
    throw new Error("searchCode 的 path 字段必须是字符串");
  }

  const searchRoot = resolveSafePath(data.path ?? ".");
  const relativeRoot = path.relative(process.cwd(), searchRoot) || ".";
  const args = [
    "--line-number",
    "--column",
    "--hidden",
    "--glob",
    "!node_modules",
    "--glob",
    "!dist",
    "--glob",
    "!.git",
    data.query,
    relativeRoot,
  ];

  try {
    const { stdout } = await execFileAsync("rg", args, {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });

    return formatSearchResult(data.query, relativeRoot, stdout);
  } catch (error) {
    const execError = error as ExecFileError;

    if (execError.code === 1) {
      return `Search query: ${data.query}\nPath: ${relativeRoot}\nMatches:\nNo matches found.`;
    }

    throw new Error(execError.stderr || execError.message);
  }
}

function formatSearchResult(query: string, searchPath: string, output: string): string {
  if (output.length <= MAX_SEARCH_OUTPUT_CHARS) {
    return `Search query: ${query}\nPath: ${searchPath}\nMatches:\n${output.trimEnd()}`;
  }

  return [
    `Search query: ${query}`,
    `Path: ${searchPath}`,
    `Matches:`,
    output.slice(0, MAX_SEARCH_OUTPUT_CHARS).trimEnd(),
    `[truncated: search output is longer than ${MAX_SEARCH_OUTPUT_CHARS} characters]`,
  ].join("\n");
}
