import { callLLM, loadLLMConfig, printLLMConfigStatus } from "./llm.js";
import { parseAssistantOutput } from "./parser.js";
import { SYSTEM_PROMPT } from "./prompt.js";
import { executeTool } from "./tools.js";
import type { Message } from "./types.js";

// 从命令行读取用户输入的问题。
function getUserQuestion(): string {
  const question = process.argv.slice(2).join(" ").trim();

  if (question) {
    return question;
  }

  return "What is the weather in Shanghai today?";
}

// 把“模型决策、工具执行、结果回填”串成一个循环。
async function runAgent(question: string): Promise<void> {
  const llmConfig = loadLLMConfig();

  printLLMConfigStatus(llmConfig);

  if (!llmConfig.apiKey) {
    throw new Error("请先在 .env 中配置 DEEPSEEK_API_KEY");
  }

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

    const assistantText = await callLLM(history, llmConfig);

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

await runAgent(getUserQuestion());
