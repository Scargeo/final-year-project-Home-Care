const fs = require("fs")
const path = require("path")
const { PDFParse } = require("pdf-parse")

const pdfPath = path.join(__dirname, "..", "data", "first-aid-reference-guide.pdf")

async function extract() {
  const dataBuffer = fs.readFileSync(pdfPath)
  if (typeof PDFParse !== "function") {
    throw new Error("pdf-parse PDFParse class is unavailable")
  }

  const parser = new PDFParse({ data: new Uint8Array(dataBuffer) })
  try {
    const result = await parser.getText()
    console.log(result.text)
  } finally {
    await parser.destroy()
  }
}

extract().catch((error) => {
  console.error("Failed to extract PDF text:", error.message)
  process.exitCode = 1
})