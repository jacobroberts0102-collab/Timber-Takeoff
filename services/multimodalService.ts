import { aiService } from "./aiService";

export const multimodalService = {
  async analyzeDrawing(base64Image: string, mimeType: string) {
    const response = await aiService.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: base64Image, mimeType } },
            { text: "Analyze this structural drawing or takeoff document. Extract any timber items, dimensions, quantities, and notes. Return the data in a structured JSON format." }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            items: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  item: { type: "STRING" },
                  dimensions: { type: "STRING" },
                  qty: { type: "NUMBER" },
                  length: { type: "NUMBER" },
                  unit: { type: "STRING" },
                  section: { type: "STRING" },
                  notes: { type: "STRING" }
                },
                required: ["item", "qty"]
              }
            }
          }
        }
      }
    });

    try {
      return JSON.parse(response.text || '{"items":[]}');
    } catch (e) {
      console.error("Failed to parse multimodal response", e);
      return { items: [] };
    }
  },

  async suggestFormula(item: string, dimensions: string): Promise<string | null> {
    const response = await aiService.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: `Suggest a mathematical formula for calculating the total quantity of this timber item: "${item}" with dimensions "${dimensions}". Return only the formula string (e.g., "QTY * 1.05" for 5% wastage) or null if no specific formula is needed.` }] }],
      config: {
        systemInstruction: "You are a timber takeoff expert. Suggest formulas for wastage or conversion based on item types."
      }
    });

    const text = (response.text || '').trim();
    return text === 'null' ? null : text;
  }
};
