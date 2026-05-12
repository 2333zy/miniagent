import { callLLM, loadLLMConfig } from "./llm.js";
import { parseAssistantOutput } from "./parser.js";
import { SYSTEM_PROMPT } from "./prompt.js";
import {
  traceAssistantOutput,
  traceFinalAnswer,
  traceLLMConfigStatus,
  traceMaxStepsReached,
  traceStepStart,
  traceToolCall,
  traceToolObservation,
  traceUserQuestion,
} from "./tracer.js";
import { executeTool } from "./tools.js";
import type { Message } from "./types.js";

const MAX_AGENT_STEPS = 5;

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

  traceLLMConfigStatus(llmConfig);

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

  traceUserQuestion(question);

  for (let step = 1; step <= MAX_AGENT_STEPS; step = step + 1) {
    traceStepStart(step);
    const assistantText = await callLLM(history, llmConfig);

    traceAssistantOutput(assistantText);

    history.push({
      role: "assistant",
      content: assistantText,
    });

    const parsed = parseAssistantOutput(assistantText);

    if (parsed.final) {
      traceFinalAnswer(parsed.final);
      return;
    }

    if (parsed.action) {
      traceToolCall(parsed.action);
      const observation = await executeTool(parsed.action);

      traceToolObservation(observation);

      history.push({
        role: "user",
        content: `<observation>${observation}</observation>`,
      });
    }
  }

  traceMaxStepsReached(MAX_AGENT_STEPS);
}

await runAgent(getUserQuestion());
