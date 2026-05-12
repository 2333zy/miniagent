import { execFile } from "node:child_process";
import { promisify } from "node:util";

type BashInput = {
  command: string;
};

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
  const data = JSON.parse(input) as Partial<BashInput>;

  if (typeof data.command !== "string" || data.command.trim().length === 0) {
    throw new Error("bash 需要非空 command 字段");
  }

  const tokens = parseCommand(data.command);
  const safeCommand = toSafeCommand(tokens);

  try {
    const { stdout, stderr } = await execFileAsync(safeCommand.file, safeCommand.args, {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024,
      timeout: COMMAND_TIMEOUT_MS,
      windowsHide: true,
    });

    return formatCommandResult(data.command, 0, stdout, stderr);
  } catch (error) {
    const execError = error as ExecFileError;

    if (execError.code !== undefined) {
      return formatCommandResult(
        data.command,
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
