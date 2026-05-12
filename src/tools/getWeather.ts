import { getRequiredString, parseJsonObject } from "./validation.js";

// 天气工具：目前先返回模拟天气，但会校验模型传入的 city 和 time。
export async function getWeather(input: string): Promise<string> {
  const data = parseJsonObject(input, "getWeather");
  const city = getRequiredString(data, "city", "getWeather");
  const time = getRequiredString(data, "time", "getWeather");

  return `Weather result: ${city} weather at ${time} is cloudy, 22°C`;
}
