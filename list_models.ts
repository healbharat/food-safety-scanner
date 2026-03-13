import { GoogleGenAI } from "@google/genai";
import fs from "fs";

async function list() {
  const env = fs.readFileSync('.env', 'utf8');
  const keyMatch = env.match(/GEMINI_API_KEY=["']?([^"'\s]+)["']?/);
  const apiKey = keyMatch ? keyMatch[1] : "";
  const genAI = new GoogleGenAI({ apiKey });
  
  try {
    const models = await genAI.models.list();
    for await (const m of models) {
       if (m.name.includes('1.5-pro')) {
         console.log(`FOUND_PRO: ${m.name}`);
       }
    }
  } catch (err: any) {
    console.error("F:", err.message);
  }
}

list();
