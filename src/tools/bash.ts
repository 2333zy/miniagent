import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { resolveSafePath } from "./pathSafety.js";
import { getRequiredString, parseJsonObject } from "./validation.js";

type SafeCommand = {
  file: string;
  args: string[];
};

type ExecFileError = Error & {
  code?: number | string;
  stdout?: string;
  stderr?: string;
};

const execFileAsync = promisify(execFile);
const MAX_COMMAND_OUTPUT_CHARS = 8000;
const COMMAND_TIMEOUT_MS = 30_000;

// 安全命令工具：只允许少量只读或检查类命令。
export async function bash(input: string): Promise<string> {
  const data = parseJsonObject(input, "bash");
  const command = getRequiredString(data, "command", "bash");

  const tokens = parseCommand(command);
  const safeCommand = toSafeCommand(tokens);

  try {
    const { stdout, stderr } = await execFileAsync(safeCommand.file, safeCommand.args, {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024,
      timeout: COMMAND_TIMEOUT_MS,
      windowsHide: true,
    });

    return formatCommandResult(command, 0, stdout, stderr);
  } catch (error) {
    const execError = error as ExecFileError;

    if (execError.code !== undefined) {
      return formatCommandResult(
        command,
        execError.code,
        execError.stdout ?? "",
        execError.stderr ?? execError.message,
      );
    }

    throw error;
  }
}

function parseCommand(command: string): string[] {
  const matches = command.match(/"([^"]*)"|'([^']*)'|[^\s]+/g) ?? [];

  return matches.map((token) => token.replace(/^["']|["']$/g, ""));
}

function toSafeCommand(tokens: string[]): SafeCommand {
  const [program, ...args] = tokens;

  if (!program) {
    throw new Error("bash 命令不能为空");
  }

  if (program === "npm" && args.length === 2 && args[0] === "run" && args[1] === "check") {
    return npmRunCheckCommand();
  }

  if (program === "git") {
    return safeGitCommand(args);
  }

  if (program === "rg") {
    return safeRipgrepCommand(args);
  }

  throw new Error(`bash 不允许执行命令：${program}`);
}

function npmRunCheckCommand(): SafeCommand {
  if (process.platform === "win32") {
    return { file: "cmd.exe", args: ["/d", "/s", "/c", "npm run check"] };
  }

  return { file: "npm", args: ["run", "check"] };
}

function safeGitCommand(args: string[]): SafeCommand {
  const command = args.join(" ");

  if (isGitDiffForPath(args)) {
    return gitDiffForPathCommand(args);
  }

  if (
    command === "status" ||
    command === "status --short" ||
    command === "status --short --branch" ||
    command === "status --branch --short" ||
    command === "diff" ||
    command === "diff --stat" ||
    command === "log --oneline -5"
  ) {
    return { file: "git", args };
  }

  throw new Error(`bash 不允许执行 git ${command}`);
}

function isGitDiffForPath(args: string[]): boolean {
  return (
    (args.length === 3 && args[0] === "diff" && args[1] === "--") ||
    (args.length === 4 && args[0] === "diff" && args[1] === "--stat" && args[2] === "--")
  );
}

function gitDiffForPathCommand(args: string[]): SafeCommand {
  const requestedPath = args.at(-1);

  if (!requestedPath || requestedPath.startsWith("-")) {
    throw new Error("git diff 需要安全的项目内路径");
  }

  const safePath = resolveSafePath(requestedPath);
  const relativePath = path.relative(process.cwd(), safePath) || ".";

  if (args[1] === "--stat") {
    return { file: "git", args: ["diff", "--stat", "--", relativePath] };
  }

  return { file: "git", args: ["diff", "--", relativePath] };
}

function safeRipgrepCommand(args: string[]): SafeCommand {
  if (args.length === 0) {
    throw new Error("rg 需要搜索关键词");
  }

  if (args.some((arg) => arg.startsWith("-"))) {
    throw new Error("bash 里的 rg 不允许传自定义参数，请只传搜索关键词");
  }

  const query = args.join(" ");

  return {
    file: "rg",
    args: [
      "--line-number",
      "--column",
      "--hidden",
      "--glob",
      "!node_modules",
      "--glob",
      "!dist",
      "--glob",
      "!.git",
      "--glob",
      "!.env",
      "--glob",
      "!.env.*",
      query,
      ".",
    ],
  };
}

function formatCommandResult(
  command: string,
  exitCode: number | string,
  stdout: string,
  stderr: string,
): string {
  const output = [
    `Command: ${command}`,
    `Exit code: ${exitCode}`,
    `Stdout:`,
    stdout.trimEnd() || "[empty]",
    `Stderr:`,
    stderr.trimEnd() || "[empty]",
  ].join("\n");

  if (output.length <= MAX_COMMAND_OUTPUT_CHARS) {
    return output;
  }

  return `${output.slice(0, MAX_COMMAND_OUTPUT_CHARS)}\n[truncated: command output is longer than ${MAX_COMMAND_OUTPUT_CHARS} characters]`;
}
