// src/services/feedbackExtractor.ts
import { Feedback } from "../models/Feedback";

export async function extractFeedbackAndSave(
  userMessage: string,
  aiResponse: string,
  tenantId: string
): Promise<void> {
  try {
    const combined = (userMessage + " " + aiResponse).toLowerCase();

    const feedbackKeywords = [
      "feedback",
      "complaint",
      "review",
      "rating",
      "experience",
      "satisfied",
      "unsatisfied",
      "happy",
      "unhappy",
      "good",
      "bad",
      "poor",
      "excellent",
      "worst",
      "best",
    ];

    const hasFeedback = feedbackKeywords.some((k) => combined.includes(k));
    if (!hasFeedback) return;

    // Extract patient name
    const nameMatch =
      userMessage.match(/(?:patient|from|by|name)[:\s]+([A-Za-z\s]+)/i) ??
      aiResponse.match(/(?:patient|from|by|name)[:\s]+([A-Za-z\s]+)/i);

    // Detect sentiment
    const positiveWords = ["good", "great", "excellent", "happy", "satisfied", "best", "love", "perfect"];
    const negativeWords = ["bad", "poor", "worst", "unhappy", "unsatisfied", "complaint", "problem", "issue"];

    let sentiment = "neutral";
    if (positiveWords.some((w) => combined.includes(w))) sentiment = "positive";
    if (negativeWords.some((w) => combined.includes(w))) sentiment = "negative";

    await Feedback.create({
      tenantId,
      patientName: nameMatch?.[1]?.trim() ?? "Unknown",
      feedback: userMessage.slice(0, 500),
      sentiment,
      source: "ai_chat",
    });

    console.log("[feedback] saved from chat");
  } catch (err) {
    console.error("[feedback] failed to save:", err);
  }
}