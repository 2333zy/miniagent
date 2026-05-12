export type MemoryItem = {
  question: string;
  answer: string;
};

export type SessionMemory = MemoryItem[];

const MAX_MEMORY_ITEMS = 5;
const MAX_ANSWER_CHARS = 500;
const MAX_QUESTION_CHARS = 200;

// 创建当前交互会话的短期记忆；程序退出后这份记忆就消失。
export function createSessionMemory(): SessionMemory {
  return [];
}

// 保存一次任务的最终结果，只记用户问题和 final answer。
export function rememberFinalAnswer(
  memory: SessionMemory,
  question: string,
  answer: string,
): void {
  memory.push({
    question: truncateText(question, MAX_QUESTION_CHARS),
    answer: truncateText(answer, MAX_ANSWER_CHARS),
  });

  if (memory.length > MAX_MEMORY_ITEMS) {
    memory.splice(0, memory.length - MAX_MEMORY_ITEMS);
  }
}

// 把短期记忆整理成一段文本，下一次调用模型时放进 messages。
export function formatSessionMemory(memory: SessionMemory): string | undefined {
  if (memory.length === 0) {
    return undefined;
  }

  const lines = ["Previous session memory:"];

  memory.forEach((item, index) => {
    lines.push(`${index + 1}. User asked: ${item.question}`);
    lines.push(`   Assistant answered: ${item.answer}`);
  });

  return lines.join("\n");
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars)}...[truncated]`;
}
