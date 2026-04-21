import { GoogleGenAI } from "@google/genai";
import { ParsedLine } from "../types";

// Initialize the SDK lazily to avoid crashing if the key is missing on startup
let genAI: GoogleGenAI | null = null;

const getGenAI = () => {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured. Please set it in the environment.");
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
};

export const aiService = {
  async generateContent(params: {
    model?: string;
    contents: any;
    config?: any;
  }): Promise<any> {
    try {
      const ai = getGenAI();
      const response = await ai.models.generateContent({
        model: params.model || "gemini-3-flash-preview",
        contents: params.contents,
        config: params.config
      });

      return response;
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  },

  async generateText(prompt: string, model?: string): Promise<string> {
    const response = await this.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    return response.text || "";
  },

  async smartSection(data: ParsedLine[]): Promise<Record<string, string>> {
    const items = data.map(d => ({ id: d.id, item: d.item, description: d.description }));
    const prompt = `
      You are a structural timber expert. Analyze the following timber takeoff items and categorize each into one of these structural sections:
      - Wall Framing
      - Roof Trusses
      - Floor Framing
      - Structural Beams/Posts
      - External/Decking
      - Internal Fit-out
      - Miscellaneous

      Return ONLY a JSON object where keys are item IDs and values are the section names.
      
      Items:
      ${JSON.stringify(items)}
    `;

    const response = await this.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" }
    });

    try {
      const text = response.text;
      if (!text) return {};
      return JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse AI response for smart sectioning", e);
      return {};
    }
  }
};
