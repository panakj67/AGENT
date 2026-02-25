// tools/executor.js
import axios from "axios"
import nodemailer from "nodemailer"
import 'dotenv/config'
//import Task from "../models/task.model.js"
//import { VM } from "vm2" // sandboxed code execution

export const executeTool = async (toolCall, userId) => {
  const { name, arguments: args } = toolCall.function
  const params = JSON.parse(args)

  switch (name) {

    case "search_web": {
       
      // Use a real search API (Serper, Brave, Tavily)
      const response = await axios.post("https://api.tavily.com/search", {
        params: {
          api_key: process.env.TAVILY_API_KEY,
          query: params.query,
          max_results: 5
        }
      })
      
      return response.data.results
        .map(r => `${r.title}: ${r.content}`)
        .join("\n")
    }

    case "send_email": {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      })
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: params.to,
        subject: params.subject,
        text: params.body
      })
      return { success: true, message: `Email sent to ${params.to}` }
    }

    case "get_weather": {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather`, {
        params: {
          q: params.city,
          appid: process.env.WEATHER_API_KEY,
          units: "metric"
        }
      })
      const { temp } = response.data.main
      const description = response.data.weather[0].description
      return `Weather in ${params.city}: ${temp}°C, ${description}`
    }

    // case "save_to_database": {
    //   const task = await Task.create({
    //     userId,
    //     type: params.type,
    //     content: params.content,
    //     dueDate: params.due_date
    //   })
    //   return { success: true, savedId: task._id }
    // }

    // case "execute_code": {
    //   // Sandboxed — never run raw eval()
    //   const vm = new VM({ timeout: 3000 })
    //   const result = vm.run(params.code)
    //   return { result: String(result) }
    // }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}