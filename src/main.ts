// 第一版目标：不用真实大模型，先跑通 Agent 的基本循环。

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

// 第一步：告诉模型必须用什么格式表达“调用工具”或“最终回答”。
const SYSTEM_PROMPT = `
You are a tiny teaching Agent.

When you need a tool, respond like this:
<action tool="getTime">{}</action>
<action tool="getWeather">{"city":"Shanghai"}</action>

When you know the final answer, respond like this:
<final>Your answer here.</final>
`;

// 第二步：先用假模型模拟真实大模型的多轮工具调用。
async function fakeLLM(messages: Message[]): Promise<string> {
  const allMessages = messages.map((message) => message.content).join("\n");
  const userQuestion = messages.find((message) => message.role === "user")?.content ?? "";
  const normalizedQuestion = userQuestion.toLowerCase();
  const hasToolError = allMessages.includes("Tool error");
  const hasTimeObservation = allMessages.includes("Current time:");
  const hasWeatherObservation = allMessages.includes("Weather result:");

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
    return '<action tool="getWeather">{"city":"Shanghai"}</action>';
  }

  return "<final>我已经先获取当前时间，再查询上海天气。根据工具结果，上海今天是多云，气温 22°C。</final>";
}

// 第三步：准备两个工具，分别模拟查询时间和查询天气。
async function getTime(_input: string): Promise<string> {
  return `Current time: ${new Date().toISOString()}`;
}

async function getWeather(input: string): Promise<string> {
  const data = JSON.parse(input) as { city: string };

  if (typeof data.city !== "string") {
    throw new Error("getWeather 需要 city 字段，并且 city 必须是字符串");
  }

  return `Weather result: ${data.city} weather is cloudy, 22°C`;
}

// 第四步：把所有工具集中登记到工具表里。
const tools: ToolMap = {
  getTime,
  getWeather,
};

// 第五步：把模型返回的文本解析成程序能执行的结构。
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

// 第六步：根据模型请求的工具名，从工具表中找到并执行对应的工具函数。
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

// 第七步：从命令行读取用户输入的问题。
function getUserQuestion(): string {
  const question = process.argv.slice(2).join(" ").trim();

  if (question) {
    return question;
  }

  return "What is the weather in Shanghai today?";
}

// 第八步：把“模型决策、工具执行、结果回填”串成一个循环。
async function runAgent(question: string): Promise<void> {
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

    const assistantText = await fakeLLM(history);

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

// 第九步：启动 Agent。
await runAgent(getUserQuestion());
