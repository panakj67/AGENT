import puppeteer from "puppeteer-extra"
import StealthPlugin from "puppeteer-extra-plugin-stealth"
puppeteer.use(StealthPlugin())

async function launchBrowser() {
  return puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ]
  })
}

export async function scrapeWebsite({ url, extract_text = true }) {
  const browser = await launchBrowser()
  const page = await browser.newPage()

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  )

  try {
    await page.goto(url, { 
      waitUntil: "networkidle2", 
      timeout: 15000 
    })

    if (extract_text) {
      const text = await page.evaluate(() => document.body.innerText)
      return { 
        url, 
        content: text.replace(/\s+/g, " ").trim().slice(0, 3000) 
      }
    }

    const html = await page.content()
    return { url, content: html.slice(0, 3000) }

  } finally {
    await browser.close()
  }
}

export async function clickAndScrape({ url, selector, extract_text = true }) {
  const browser = await launchBrowser()
  const page = await browser.newPage()

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  )

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 15000 })
    await page.waitForSelector(selector, { timeout: 5000 })
    await page.click(selector)
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 })
      .catch(() => {}) // ignore if no navigation happens

    if (extract_text) {
      const text = await page.evaluate(() => document.body.innerText)
      return { 
        url: page.url(), 
        content: text.replace(/\s+/g, " ").trim().slice(0, 3000) 
      }
    }

    return { url: page.url(), content: await page.content() }

  } finally {
    await browser.close()
  }
}

export async function fillAndSubmitForm({ url, fields, submit_selector }) {
  const browser = await launchBrowser()
  const page = await browser.newPage()

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  )

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 15000 })

    for (const [selector, value] of Object.entries(fields)) {
      await page.waitForSelector(selector, { timeout: 5000 })
      await page.click(selector, { clickCount: 3 }) // clear existing
      await page.type(selector, String(value), { delay: 50 })
    }

    if (submit_selector) {
      await page.click(submit_selector)
      await page.waitForNavigation({ 
        waitUntil: "networkidle2", 
        timeout: 10000 
      }).catch(() => {})
    }

    const text = await page.evaluate(() => document.body.innerText)
    return { 
      success: true, 
      url: page.url(),
      result: text.replace(/\s+/g, " ").trim().slice(0, 1000) 
    }

  } finally {
    await browser.close()
  }
}

export async function takeScreenshot({ url }) {
  const browser = await launchBrowser()
  const page = await browser.newPage()

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 15000 })
    const screenshot = await page.screenshot({ 
      encoding: "base64",
      fullPage: false 
    })
    return { url, screenshot_base64: screenshot }

  } finally {
    await browser.close()
  }
}