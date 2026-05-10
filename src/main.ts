import "dotenv/config";

// 当前目标：先跑通 Agent 循环，并为后续接入真实大模型准备配置。

type Role = "system" | "user" | "assistant";

type Message = {
  role: Role;
  content: string;
};

type Action = {
  tool: string;
  input: string;
};

type ToolFunction = (input: string) => Promise<string>;

type ToolMap = {
  [toolName: string]: ToolFunction | undefined;
};

type ParsedAssistantOutput = {
  action?: Action;
  final?: string;
};

type WeatherInput = {
  city: string;
  time: string;
};

type LLMConfig = {
  apiKey?: string;
  baseUrl: string;
  model: string;
};

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

// 第一步：告诉模型必须用什么格式表达“调用工具”或“最终回答”。
const SYSTEM_PROMPT = `
You are a tiny teaching Agent.

You can use these tools:
- getTime: input is {}
- getWeather: input is {"city": string, "time": string}

For weather questions, call getTime first.
After receiving Current time, call getWeather with city and time.
After receiving Weather result or Tool error, respond with final.

Only output one action or one final answer each turn.

When you need a tool, respond like this:
<action tool="getTime">{}</action>
<action tool="getWeather">{"city":"Shanghai","time":"2026-05-10T15:00:00.000Z"}</action>

When you know the final answer, respond like this:
<final>Your answer here.</final>
`;

// 第二步：读取真实大模型需要的环境变量，但暂时还不调用真实模型。
function loadLLMConfig(): LLMConfig {
  return {
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.deepseek.com",
    model: process.env.OPENAI_MODEL ?? "deepseek-chat",
  };
}

// 第三步：打印配置状态，只显示是否已配置密钥，不打印密钥本身。
function printLLMConfigStatus(config: LLMConfig): void {
  console.log("LLM config:");
  console.log(`- API key: ${config.apiKey ? "configured" : "missing"}`);
  console.log(`- Base URL: ${config.baseUrl}`);
  console.log(`- Model: ${config.model}`);
  console.log(`- Runtime: ${config.apiKey ? "real LLM" : "fake LLM fallback"}`);
}

// 第四步：根据配置拼出真实大模型的聊天接口地址。
function buildChatCompletionsUrl(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  if (normalizedBaseUrl.endsWith("/chat/completions")) {
    return normalizedBaseUrl;
  }

  return `${normalizedBaseUrl}/chat/completions`;
}

// 第五步：调用真实大模型，让模型根据 history 输出 action 或 final。
async function callLLM(messages: Message[], config: LLMConfig): Promise<string> {
  if (!config.apiKey) {
    throw new Error("缺少 OPENAI_API_KEY，无法调用真实大模型");
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

// 第六步：没有密钥时继续用假模型，有密钥时切换到真实模型。
async function callModel(messages: Message[], config: LLMConfig): Promise<string> {
  if (!config.apiKey) {
    return await fakeLLM(messages);
  }

  return await callLLM(messages, config);
}

// 第七步：先用假模型模拟真实大模型的多轮工具调用。
async function fakeLLM(messages: Message[]): Promise<string> {
  const observations = messages
    .filter((message) => message.content.includes("<observation>"))
    .map((message) => message.content)
    .join("\n");
  const userQuestion = messages.find((message) => message.role === "user")?.content ?? "";
  const normalizedQuestion = userQuestion.toLowerCase();
  const hasToolError = observations.includes("Tool error");
  const hasTimeObservation = observations.includes("Current time:");
  const hasWeatherObservation = observations.includes("Weather result:");
  const currentTime = observations.match(/Current time: ([^<\n]+)/)?.[1] ?? "";

  if (hasToolError) {
    return "<final>工具调用失败了，但 Agent 没有崩溃。真实 Agent 会把这个错误结果交给模型，让模型决定下一步怎么修正。</final>";
  }

  if (normalizedQuestion.includes("unknown tool")) {
    return '<action tool="unknownTool">{}</action>';
  }

  if (normalizedQuestion.includes("bad json")) {
    return "<action tool=\"getWeather\">not json</action>";
  }

  if (!hasTimeObservation) {
    return '<action tool="getTime">{}</action>';
  }

  if (!hasWeatherObservation) {
    const weatherInput = JSON.stringify({
      city: "Shanghai",
      time: currentTime,
    });

    return `<action tool="getWeather">${weatherInput}</action>`;
  }

  return `<final>我已经先获取当前时间 ${currentTime}，再把这个时间传给天气工具。根据工具结果，上海今天是多云，气温 22°C。</final>`;
}

// 第八步：准备两个工具，分别模拟查询时间和查询天气。
async function getTime(_input: string): Promise<string> {
  return `Current time: ${new Date().toISOString()}`;
}

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

// 第九步：把所有工具集中登记到工具表里。
const tools: ToolMap = {
  getTime,
  getWeather,
};

// 第十步：把模型返回的文本解析成程序能执行的结构。
function parseAssistantOutput(text: string): ParsedAssistantOutput {
  const actionMatch = text.match(/<action tool="([^"]+)">([\s\S]*?)<\/action>/);

  if (actionMatch) {
    return {
      action: {
        tool: actionMatch[1],
        input: actionMatch[2],
      },
    };
  }

  const finalMatch = text.match(/<final>([\s\S]*?)<\/final>/);

  if (finalMatch) {
    return {
      final: finalMatch[1],
    };
  }

  return {
    final: text,
  };
}

// 第十一步：根据模型请求的工具名，从工具表中找到并执行对应的工具函数。
async function executeTool(action: Action): Promise<string> {
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

// 第十二步：从命令行读取用户输入的问题。
function getUserQuestion(): string {
  const question = process.argv.slice(2).join(" ").trim();

  if (question) {
    return question;
  }

  return "What is the weather in Shanghai today?";
}

// 第十三步：把“模型决策、工具执行、结果回填”串成一个循环。
async function runAgent(question: string): Promise<void> {
  const llmConfig = loadLLMConfig();

  printLLMConfigStatus(llmConfig);

  const history: Message[] = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: question,
    },
  ];

  console.log("User question:");
  console.log(question);

  for (let step = 1; step <= 5; step = step + 1) {
    console.log(`\n--- Step ${step} ---`);

    const assistantText = await callModel(history, llmConfig);

    console.log("Assistant raw output:");
    console.log(assistantText);

    history.push({
      role: "assistant",
      content: assistantText,
    });

    const parsed = parseAssistantOutput(assistantText);

    if (parsed.final) {
      console.log("\nFinal answer:");
      console.log(parsed.final);
      return;
    }

    if (parsed.action) {
      console.log("\nTool call:");
      console.log(parsed.action);

      const observation = await executeTool(parsed.action);

      console.log("\nTool observation:");
      console.log(observation);

      history.push({
        role: "user",
        content: `<observation>${observation}</observation>`,
      });
    }
  }

  console.log("Agent stopped because it reached the max step limit.");
}

// 第十四步：启动 Agent。
await runAgent(getUserQuestion());
