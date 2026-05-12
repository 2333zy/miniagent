import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { truncateOutput } from "./output.js";
import { resolveSafePath } from "./pathSafety.js";
import { getOptionalString, getRequiredString, parseJsonObject } from "./validation.js";

type ExecFileError = Error & {
  code?: number | string;
  stdout?: string;
  stderr?: string;
};

const execFileAsync = promisify(execFile);

// 搜索代码工具：模型只传 query，底层由程序安全调用 rg。
export async function searchCode(input: string): Promise<string> {
  const data = parseJsonObject(input, "searchCode");
  const query = getRequiredString(data, "query", "searchCode");
  const requestedPath = getOptionalString(data, "path", "searchCode");

  const searchRoot = resolveSafePath(requestedPath ?? ".");
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
    query,
    relativeRoot,
  ];

  try {
    const { stdout } = await execFileAsync("rg", args, {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });

    return formatSearchResult(query, relativeRoot, stdout);
  } catch (error) {
    const execError = error as ExecFileError;

    if (execError.code === 1) {
      return `Search query: ${query}\nPath: ${relativeRoot}\nMatches:\nNo matches found.`;
    }

    throw new Error(execError.stderr || execError.message);
  }
}

function formatSearchResult(query: string, searchPath: string, output: string): string {
  const visibleOutput = truncateOutput(output.trimEnd(), "search output");

  return `Search query: ${query}\nPath: ${searchPath}\nMatches:\n${visibleOutput}`;
}
