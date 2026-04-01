import { GoogleGenAI } from "@google/genai";

async function findJWApi() {
  const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: "What is the current public API endpoint for searching Jehovah's Witnesses meeting locations (congregations) on jw.org? The old one https://apps.jw.org/api/v1/meetings/search is returning 404. Please provide the correct URL and required query parameters. Use Google Search to find the most recent information.",
    config: {
      tools: [{ googleSearch: {} }]
    }
  });
  console.log(response.text);
}

findJWApi();
