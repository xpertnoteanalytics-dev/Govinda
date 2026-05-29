import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";

const genAI = new GoogleGenerativeAI(env.gemini.apiKey);

const model = genAI.getGenerativeModel({
  model: env.gemini.model,
});

export async function extractOperationalIntent(
  message: string
) {
  const prompt = `
You are a healthcare operations assistant.

Extract intent from the message.

Possible intents:
- appointment
- feedback
- none

Return ONLY valid JSON.

Message:
"${message}"

Example output:
{
  "intent": "appointment",
  "patientName": "Ravi",
  "service": "blood test",
  "appointmentDate": "tomorrow",
  "appointmentTime": "5 PM",
  "feedback": "",
  "sentiment": ""
}
`;

  let result;

for (let i = 0; i < 3; i++) {
  try {
    result = await model.generateContent(prompt);
    break;
  } catch (err: any) {
    if (i === 2) throw err;

    console.log("[AI] Retry Gemini request...");

    await new Promise((resolve) =>
      setTimeout(resolve, 2000)
    );
  }
}

  const text = result!.response.text();
  const cleaned = text
  .replace(/```json/g, "")
  .replace(/```/g, "")
  .trim();

  return JSON.parse(cleaned);
}