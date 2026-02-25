import axios from "axios";
import nodemailer from "nodemailer";
import "dotenv/config";

function parseArguments(rawArgs) {
  if (!rawArgs) return {};
  if (typeof rawArgs === "object") return rawArgs;

  try {
    return JSON.parse(rawArgs);
  } catch {
    return {};
  }
}

async function searchWeb({ query }) {
  const response = await axios.post("https://api.tavily.com/search", {
    api_key: process.env.TAVILY_API_KEY,
    query,
    max_results: 5,
  });

  const results = Array.isArray(response.data?.results) ? response.data.results : [];
  return results.map((item) => `${item.title}: ${item.content}`).join("\n");
}

async function sendEmail({ to, subject, body }) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    text: body,
  });

  return { success: true, message: `Email sent to ${to}` };
}

async function getWeather({ city }) {
  const response = await axios.get("https://api.openweathermap.org/data/2.5/weather", {
    params: {
      q: city,
      appid: process.env.WEATHER_API_KEY,
      units: "metric",
    },
  });

  const temp = response.data?.main?.temp;
  const description = response.data?.weather?.[0]?.description;
  return `Weather in ${city}: ${temp}°C, ${description}`;
}

const TOOL_HANDLERS = {
  search_web: searchWeb,
  send_email: sendEmail,
  get_weather: getWeather,
};

export async function executeTool(toolCall) {
  const name = toolCall?.function?.name;
  const params = parseArguments(toolCall?.function?.arguments);

  const handler = TOOL_HANDLERS[name];
  if (!handler) {
    return { error: `Unknown tool: ${name}` };
  }

  try {
    return await handler(params);
  } catch (error) {
    return {
      error: `Tool execution failed for ${name}`,
      details: error.message,
    };
  }
}
