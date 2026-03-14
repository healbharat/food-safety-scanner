import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";

async function list() {
  const env = fs.readFileSync('.env', 'utf8');
  const keyMatch = env.match(/GEMINI_API_KEY=["']?([^"'\s]+)["']?/);
  const apiKey = keyMatch ? keyMatch[1] : "";
  const genAI = new GoogleGenerativeAI(apiKey);
  
  try {
    // Note: In @google/generative-ai, listing models is handled slightly differently
    // but we can try to get a model to verify it works.
    console.log("Checking Gemini 1.5 Flash connectivity...");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("List your system capabilities briefly.");
    console.log("Response:", (await result.response).text());
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

list();
