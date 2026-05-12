type JsonObject = Record<string, unknown>;

// 统一解析工具参数：模型传进来的 input 必须是 JSON 对象。
export function parseJsonObject(input: string, toolName: string): JsonObject {
  let data: unknown;

  try {
    data = JSON.parse(input.trim().length === 0 ? "{}" : input);
  } catch {
    throw new Error(`${toolName} 参数必须是合法 JSON`);
  }

  if (!isJsonObject(data)) {
    throw new Error(`${toolName} 参数必须是 JSON 对象`);
  }

  return data;
}

// 读取必填字符串字段：适合 command、path、query、city 这类参数。
export function getRequiredString(data: JsonObject, fieldName: string, toolName: string): string {
  const value = data[fieldName];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${toolName} 需要非空 ${fieldName} 字段`);
  }

  return value;
}

// 读取必填字符串字段，但允许空字符串：适合 replaceInFile 的 newText。
export function getStringField(data: JsonObject, fieldName: string, toolName: string): string {
  const value = data[fieldName];

  if (typeof value !== "string") {
    throw new Error(`${toolName} 需要 ${fieldName} 字段，并且 ${fieldName} 必须是字符串`);
  }

  return value;
}

// 读取可选字符串字段：适合 listFiles/searchCode 里的 path。
export function getOptionalString(
  data: JsonObject,
  fieldName: string,
  toolName: string,
): string | undefined {
  const value = data[fieldName];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${toolName} 的 ${fieldName} 字段必须是非空字符串`);
  }

  return value;
}

// 读取必填整数字段：适合 startLine、endLine 这类行号参数。
export function getRequiredInteger(data: JsonObject, fieldName: string, toolName: string): number {
  const value = data[fieldName];

  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${toolName} 需要整数 ${fieldName} 字段`);
  }

  return value;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
