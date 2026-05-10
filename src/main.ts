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

type ParsedAssistantOutput = {
  action?: Action;
  final?: string;
};

// 第一步：告诉模型必须用什么格式表达“调用工具”或“最终回答”。
const SYSTEM_PROMPT = `
You are a tiny teaching Agent.

When you need a tool, respond like this:
<action tool="getWeather">{"city":"Shanghai"}</action>

When you know the final answer, respond like this:
<final>Your answer here.</final>
`;

// 第二步：先用假模型模拟真实大模型的两种输出。
async function fakeLLM(messages: Message[]): Promise<string> {
  const hasObservation = messages.some((message) =>
    message.content.includes("<observation>")
  );

  if (!hasObservation) {
    return '<action tool="getWeather">{"city":"Shanghai"}</action>';
  }

  return "<final>根据工具结果，上海今天是多云，气温 22°C。这个答案来自 Agent 调用工具后的观察结果。</final>";
}

// 第三步：准备一个工具，模拟查询天气。
async function getWeather(input: string): Promise<string> {
  const data = JSON.parse(input) as { city: string };

  return `${data.city} weather: cloudy, 22°C`;
}

// 第四步：把模型返回的文本解析成程序能执行的结构。
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

// 第五步：根据模型请求的工具名，执行对应的工具函数。
async function executeTool(action: Action): Promise<string> {
  if (action.tool === "getWeather") {
    return await getWeather(action.input);
  }

  return `Unknown tool: ${action.tool}`;
}

// 第六步：从命令行读取用户输入的问题。
function getUserQuestion(): string {
  const question = process.argv.slice(2).join(" ").trim();

  if (question) {
    return question;
  }

  return "What is the weather in Shanghai today?";
}

// 第七步：把“模型决策、工具执行、结果回填”串成一个循环。
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

// 第八步：启动 Agent。
await runAgent(getUserQuestion());
