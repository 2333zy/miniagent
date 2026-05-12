import { stdin as input, stdout as output } from "node:process";
import { createInterface, type Interface } from "node:readline/promises";

import { callLLM, loadLLMConfig } from "./llm.js";
import { parseAssistantOutput } from "./parser.js";
import { SYSTEM_PROMPT } from "./prompt.js";
import {
  traceAssistantOutput,
  traceFinalAnswer,
  traceLLMConfigStatus,
  traceMaxStepsReached,
  traceSessionEnd,
  traceSessionStart,
  traceStepStart,
  traceTaskError,
  traceTaskStart,
  traceToolCall,
  traceToolObservation,
  traceUserQuestion,
} from "./tracer.js";
import { executeTool } from "./tools.js";
import type { LLMConfig, Message } from "./types.js";

const MAX_AGENT_STEPS = 5;

type ReadlineClosedError = Error & {
  code?: string;
};

// 从命令行参数读取用户问题；没有参数时进入交互式会话。
function getCliQuestion(): string | undefined {
  const question = process.argv.slice(2).join(" ").trim();

  if (question) {
    return question;
  }

  return undefined;
}

// 把“模型决策、工具执行、结果回填”串成一个循环。
async function runAgent(question: string, llmConfig: LLMConfig): Promise<void> {
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

async function runInteractiveSession(llmConfig: LLMConfig): Promise<void> {
  const rl = createInterface({ input, output });
  let taskNumber = 1;

  traceSessionStart();

  try {
    while (true) {
      const rawQuestion = await askQuestion(rl);

      if (rawQuestion === undefined) {
        traceSessionEnd();
        return;
      }

      const question = rawQuestion.trim();

      if (question === "/exit" || question === "/quit") {
        traceSessionEnd();
        return;
      }

      if (!question) {
        continue;
      }

      traceTaskStart(taskNumber);
      try {
        await runAgent(question, llmConfig);
      } catch (error) {
        traceTaskError(error);
      }
      taskNumber = taskNumber + 1;
    }
  } finally {
    rl.close();
  }
}

async function askQuestion(rl: Interface): Promise<string | undefined> {
  try {
    return await rl.question("\nYou > ");
  } catch (error) {
    if (isReadlineClosedError(error)) {
      return undefined;
    }

    throw error;
  }
}

function isReadlineClosedError(error: unknown): error is ReadlineClosedError {
  return error instanceof Error && (error as ReadlineClosedError).code === "ERR_USE_AFTER_CLOSE";
}

async function main(): Promise<void> {
  const llmConfig = loadLLMConfig();

  traceLLMConfigStatus(llmConfig);

  if (!llmConfig.apiKey) {
    throw new Error("请先在 .env 中配置 DEEPSEEK_API_KEY");
  }

  const cliQuestion = getCliQuestion();

  if (cliQuestion) {
    await runAgent(cliQuestion, llmConfig);
    return;
  }

  await runInteractiveSession(llmConfig);
}

await main();
