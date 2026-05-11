import "dotenv/config";

import type { LLMConfig, Message } from "./types.js";

// 这里只描述我们会用到的那一小部分响应结构。
// DeepSeek/OpenAI-compatible 接口会把模型回复放在 choices[0].message.content。
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

// 第一步：从 .env 读取模型配置。
// 代码优先使用 DeepSeek 变量名，也兼容 OpenAI 变量名，方便以后切不同厂商。
export function loadLLMConfig(): LLMConfig {
  return {
    apiKey: readEnv("DEEPSEEK_API_KEY", "OPENAI_API_KEY"),
    baseUrl: readEnv("DEEPSEEK_BASE_URL", "OPENAI_BASE_URL") ?? "https://api.deepseek.com",
    model: readEnv("DEEPSEEK_MODEL", "OPENAI_MODEL") ?? "deepseek-v4-pro",
  };
}

// 第二步：打印当前用的是哪个模型服务。
// 这里永远不打印真实 API key，只告诉你有没有配置成功。
export function printLLMConfigStatus(config: LLMConfig): void {
  console.log("LLM config:");
  console.log(`- API key: ${config.apiKey ? "configured" : "missing"}`);
  console.log(`- Base URL: ${config.baseUrl}`);
  console.log(`- Model: ${config.model}`);
  console.log("- Runtime: real LLM");
}

// 第三步：把 Agent 的 history 发送给真实大模型。
// 这个函数只负责“模型通信”：发请求、收响应、取出 assistant 文本。
export async function callLLM(messages: Message[], config: LLMConfig): Promise<string> {
  if (!config.apiKey) {
    throw new Error("缺少 DEEPSEEK_API_KEY 或 OPENAI_API_KEY，无法调用真实大模型");
  }

  // OpenAI-compatible 的聊天接口使用 POST 请求。
  // 请求体里的 messages 就是 Agent 到目前为止的完整对话历史。
  const response = await fetch(buildChatCompletionsUrl(config.baseUrl), {
    method: "POST",
    headers: {
      // Bearer token 是这类 API 最常见的鉴权方式。
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      // temperature 设为 0，让模型更稳定地遵守 action/final 格式。
      temperature: 0,
    }),
  });

  // 即使请求失败，服务端也可能返回 JSON 格式的错误信息。
  // 如果响应不是 JSON，就先当成 null，后面用 HTTP 状态码兜底。
  const body = (await response.json().catch(() => null)) as ChatCompletionResponse | null;

  // HTTP 层失败时，把服务端错误转成普通 Error，交给上层显示。
  if (!response.ok) {
    const message = body?.error?.message ?? `${response.status} ${response.statusText}`;
    throw new Error(`真实大模型请求失败：${message}`);
  }

  // 成功响应里，我们只需要 assistant 的文本内容。
  const content = body?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("真实大模型响应里没有 assistant content");
  }

  return content;
}

// 按顺序读取多个环境变量，返回第一个有效值。
// 这样可以同时支持 DEEPSEEK_API_KEY 和 OPENAI_API_KEY。
function readEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value && !isPlaceholderValue(value)) {
      return value;
    }
  }

  return undefined;
}

// 避免把 .env.example 里的占位符误当成真实 key。
function isPlaceholderValue(value: string): boolean {
  const normalizedValue = value.toLowerCase();

  return normalizedValue.includes("your_") || normalizedValue.includes("placeholder");
}

// 把 baseUrl 统一转换成 chat completions 完整接口地址。
function buildChatCompletionsUrl(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  if (normalizedBaseUrl.endsWith("/chat/completions")) {
    return normalizedBaseUrl;
  }

  return `${normalizedBaseUrl}/chat/completions`;
}
