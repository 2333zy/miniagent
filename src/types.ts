export type Role = "system" | "user" | "assistant";

export type Message = {
  role: Role;
  content: string;
};

export type Action = {
  tool: string;
  input: string;
};

export type ParsedAssistantOutput = {
  action?: Action;
  final?: string;
};

export type LLMConfig = {
  apiKey?: string;
  baseUrl: string;
  model: string;
};
