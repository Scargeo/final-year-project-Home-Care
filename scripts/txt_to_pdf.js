/* eslint-env node */
import fs from 'fs'
import path from 'path'
import puppeteer from 'puppeteer'

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

(async () => {
  const input = globalThis.process?.argv?.[2] || 'cybersecurity_submission_grid.txt'
  const output = globalThis.process?.argv?.[3] || 'cybersecurity_submission_grid.pdf'
  const absInput = path.resolve(globalThis.process.cwd(), input)
  const absOutput = path.resolve(globalThis.process.cwd(), output)

  if (!fs.existsSync(absInput)) {
    console.error('Input file not found:', absInput)
    globalThis.process?.exit(2)
  }

  const txt = fs.readFileSync(absInput, 'utf8')
  // Normalize paragraphs: split on two or more newlines
  const paragraphs = txt.split(/\n{2,}/).map(p => p.trim())

  const html = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <title>Document</title>
    <style>
      @page { margin: 1in }
      body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.5; color: #000; }
      h1,h2,h3 { font-weight: 700; }
      p { margin: 0 0 0.9em 0; text-align: justify; }
      pre { white-space: pre-wrap; }
    </style>
  </head>
  <body>
    ${paragraphs.map(p => '<p>' + escapeHtml(p).replace(/\n/g, '<br />') + '</p>').join('\n')}
  </body>
  </html>`

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })
  await page.pdf({ path: absOutput, format: 'A4', printBackground: true })
  await browser.close()
  console.log('PDF written to', absOutput)
})().catch((err) => {
  console.error(err)
  globalThis.process?.exit(1)
})
