import fs from "fs";
import { PDFParse } from "pdf-parse";

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: node scripts/extract-pdf-text.mjs <path-to-pdf>");
  process.exit(1);
}

const buffer = fs.readFileSync(pdfPath);
const parser = new PDFParse({ data: buffer });
const result = await parser.getText();
const text = result.pages.map((p) => p.text).join("\n\n");
await parser.destroy();

console.log(JSON.stringify({ pages: result.total, text }));
