// 时间工具：返回当前时间，供模型继续传给天气工具。
export async function getTime(_input: string): Promise<string> {
  return `Current time: ${new Date().toISOString()}`;
}
