import cron from "node-cron"
import { Task } from "../models/task.model.js"
import nodemailer from "nodemailer"

function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  })
}

async function sendReminderEmail({ to, title, description, dueAt }) {
  const transporter = createTransporter()

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: `⏰ Reminder: ${title}`,
    html: `
      <h2>Aura Reminder</h2>
      <h3>${title}</h3>
      ${description ? `<p>${description}</p>` : ""}
      ${dueAt ? `<p>Due: ${new Date(dueAt).toLocaleString()}</p>` : ""}
      <hr/>
      <small>Sent by Aura AI Assistant</small>
    `
  })
}

async function sendDailyBriefing({ to, userId }) {
  // Import tools dynamically to avoid circular deps
  const { executeTool } = await import("../tools/executor.js")

  // Run all three in parallel
  const [news, weather, crypto] = await Promise.all([
    executeTool({ function: { name: "get_news", arguments: JSON.stringify({ topic: "top headlines", count: 3 }) } }),
    executeTool({ function: { name: "get_weather", arguments: JSON.stringify({ city: "Bhopal" }) } }),
    executeTool({ function: { name: "get_crypto_price", arguments: JSON.stringify({ coin: "bitcoin", currency: "usd" }) } })
  ])

  const transporter = createTransporter()

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: `☀️ Good Morning — Aura Daily Briefing`,
    html: `
      <h2>Your Daily Briefing</h2>
      
      <h3>🌤️ Weather</h3>
      <p>${JSON.stringify(weather)}</p>

      <h3>₿ Bitcoin</h3>
      <p>$${crypto.price}</p>

      <h3>📰 Top News</h3>
      <ul>
        ${Array.isArray(news) ? news.map(n => `<li><a href="${n.url}">${n.title}</a></li>`).join("") : "<li>No news available</li>"}
      </ul>

      <hr/>
      <small>Sent by Aura AI Assistant</small>
    `
  })
}

export function startReminderJob() {

  // Runs every minute — checks for due tasks
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date()

      const dueTasks = await Task.find({
        dueAt: { $lte: now },
        completed: false,
        notified: false,
        recurring: "none"
      })

      for (const task of dueTasks) {
        console.log(`[reminder] Sending reminder: ${task.title}`)

        await sendReminderEmail({
          to: task.userEmail,
          title: task.title,
          description: task.description,
          dueAt: task.dueAt
        })

        task.notified = true
        task.completed = true
        await task.save()
      }
    } catch (error) {
      console.error("[reminder] Error in reminder job:", error.message)
    }
  })

  // Runs every day at 8:00 AM — daily briefing
  cron.schedule("0 8 * * *", async () => {
    try {
      const recurringTasks = await Task.find({
        recurring: "daily",
        completed: false
      })

      for (const task of recurringTasks) {
        console.log(`[reminder] Sending daily briefing to ${task.userEmail}`)
        await sendDailyBriefing({ 
          to: task.userEmail,
          userId: task.userId
        })
      }
    } catch (error) {
      console.error("[reminder] Error in daily briefing:", error.message)
    }
  })

  console.log("[reminder] Reminder job started")
}