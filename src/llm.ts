import "dotenv/config";

import type { LLMConfig, Message } from "./types.js";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

// 从环境变量读取模型配置，优先使用 DeepSeek 变量名，也兼容 OpenAI 变量名。
export function loadLLMConfig(): LLMConfig {
  return {
    apiKey: readEnv("DEEPSEEK_API_KEY", "OPENAI_API_KEY"),
    baseUrl: readEnv("DEEPSEEK_BASE_URL", "OPENAI_BASE_URL") ?? "https://api.deepseek.com",
    model: readEnv("DEEPSEEK_MODEL", "OPENAI_MODEL") ?? "deepseek-v4-pro",
  };
}

// 打印配置状态，但不打印真实 API key。
export function printLLMConfigStatus(config: LLMConfig): void {
  console.log("LLM config:");
  console.log(`- API key: ${config.apiKey ? "configured" : "missing"}`);
  console.log(`- Base URL: ${config.baseUrl}`);
  console.log(`- Model: ${config.model}`);
  console.log("- Runtime: real LLM");
}

// 把 history 发送给 OpenAI-compatible 接口，并取回 assistant 文本。
export async function callLLM(messages: Message[], config: LLMConfig): Promise<string> {
  if (!config.apiKey) {
    throw new Error("缺少 DEEPSEEK_API_KEY 或 OPENAI_API_KEY，无法调用真实大模型");
  }

  const response = await fetch(buildChatCompletionsUrl(config.baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0,
    }),
  });

  const body = (await response.json().catch(() => null)) as ChatCompletionResponse | null;

  if (!response.ok) {
    const message = body?.error?.message ?? `${response.status} ${response.statusText}`;
    throw new Error(`真实大模型请求失败：${message}`);
  }

  const content = body?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("真实大模型响应里没有 assistant content");
  }

  return content;
}

function readEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value && !isPlaceholderValue(value)) {
      return value;
    }
  }

  return undefined;
}

function isPlaceholderValue(value: string): boolean {
  const normalizedValue = value.toLowerCase();

  return normalizedValue.includes("your_") || normalizedValue.includes("placeholder");
}

function buildChatCompletionsUrl(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  if (normalizedBaseUrl.endsWith("/chat/completions")) {
    return normalizedBaseUrl;
  }

  return `${normalizedBaseUrl}/chat/completions`;
}
