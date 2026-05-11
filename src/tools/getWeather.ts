type WeatherInput = {
  city: string;
  time: string;
};

// 天气工具：目前先返回模拟天气，但会校验模型传入的 city 和 time。
export async function getWeather(input: string): Promise<string> {
  const data = JSON.parse(input) as Partial<WeatherInput>;

  if (typeof data.city !== "string") {
    throw new Error("getWeather 需要 city 字段，并且 city 必须是字符串");
  }

  if (typeof data.time !== "string") {
    throw new Error("getWeather 需要 time 字段，并且 time 必须是字符串");
  }

  return `Weather result: ${data.city} weather at ${data.time} is cloudy, 22°C`;
}
