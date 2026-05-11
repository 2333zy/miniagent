import { readFile as readFileFromDisk } from "node:fs/promises";
import path from "node:path";

import type { Action } from "./types.js";

type ToolFunction = (input: string) => Promise<string>;

type ToolMap = {
  [toolName: string]: ToolFunction | undefined;
};

type WeatherInput = {
  city: string;
  time: string;
};

type ReadFileInput = {
  path: string;
};

const MAX_FILE_CHARS = 8000;

// 时间工具：返回当前时间，供模型继续传给天气工具。
async function getTime(_input: string): Promise<string> {
  return `Current time: ${new Date().toISOString()}`;
}

// 天气工具：目前先返回模拟天气，但会校验模型传入的 city 和 time。
async function getWeather(input: string): Promise<string> {
  const data = JSON.parse(input) as Partial<WeatherInput>;

  if (typeof data.city !== "string") {
    throw new Error("getWeather 需要 city 字段，并且 city 必须是字符串");
  }

  if (typeof data.time !== "string") {
    throw new Error("getWeather 需要 time 字段，并且 time 必须是字符串");
  }

  return `Weather result: ${data.city} weather at ${data.time} is cloudy, 22°C`;
}

// 读文件工具：允许读取当前项目内的文本文件，但会拦截敏感路径和超长输出。
async function readFile(input: string): Promise<string> {
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

// 把模型给的路径解析成项目内的安全绝对路径。
function resolveSafePath(filePath: string): string {
  const projectRoot = process.cwd();
  const resolvedPath = path.resolve(projectRoot, filePath);

  if (!resolvedPath.startsWith(projectRoot + path.sep) && resolvedPath !== projectRoot) {
    throw new Error("readFile 只能读取当前项目目录内的文件");
  }

  if (isSensitivePath(resolvedPath)) {
    throw new Error("readFile 不允许读取敏感文件");
  }

  return resolvedPath;
}

function isSensitivePath(filePath: string): boolean {
  const normalizedPath = filePath.toLowerCase();
  const fileName = path.basename(normalizedPath);

  return (
    fileName === ".env" ||
    fileName.startsWith(".env.") ||
    normalizedPath.includes(`${path.sep}.git${path.sep}`) ||
    normalizedPath.includes(`${path.sep}.ssh${path.sep}`) ||
    normalizedPath.includes("id_rsa") ||
    normalizedPath.includes("token") ||
    normalizedPath.includes("secret")
  );
}

// 工具注册表：以后新增工具时，主要是在这里登记。
const tools: ToolMap = {
  getTime,
  getWeather,
  readFile,
};

// 根据模型请求的工具名，从工具表中找到并执行对应工具。
export async function executeTool(action: Action): Promise<string> {
  const tool = tools[action.tool];

  if (!tool) {
    return `Tool error: unknown tool "${action.tool}"`;
  }

  try {
    return await tool(action.input);
  } catch (error) {
    if (error instanceof Error) {
      return `Tool error from ${action.tool}: ${error.message}`;
    }

    return `Tool error from ${action.tool}: ${String(error)}`;
  }
}
