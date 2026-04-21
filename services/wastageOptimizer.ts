import { ParsedLine } from '../types';
import { aiService } from './aiService';

interface CuttingResult {
  stockLength: number;
  cuts: number[];
  waste: number;
}

export async function predictWastageWithAI(items: ParsedLine[]): Promise<string> {
  const pineItems = items.filter(item => 
    (item.item.toLowerCase().includes('pine') || item.spruceDescription?.toLowerCase().includes('pine')) && 
    item.length && 
    item.length > 0
  );

  if (pineItems.length === 0) return "No significant pine items found for wastage prediction.";

  const prompt = `
    Analyze the following timber items and predict the smartest wastage strategy.
    Consider standard Australian timber lengths (2.4m to 6.0m in 0.3m increments).
    
    Items:
    ${pineItems.map(i => `- ${i.item} ${i.dimensions}: ${i.qty} x ${i.length}m`).join('\n')}
    
    Provide a concise (2-3 sentence) recommendation on:
    1. The best stock length to order for these specific cuts.
    2. Expected wastage percentage.
    3. Any "smart" substitution (e.g. if many 2.7m cuts, order 5.4m instead of 6.0m).
  `;

  try {
    const response = await aiService.generateText(prompt);
    return response;
  } catch (error) {
    console.error("AI Wastage Prediction failed", error);
    return "AI prediction unavailable at this time.";
  }
}

export function optimizeCutting(items: ParsedLine[], stockLength: number = 6000): CuttingResult[] {
  // Filter for pine items that have lengths and are not EA units
  const pineItems = items.filter(item => 
    (item.item.toLowerCase().includes('pine') || item.spruceDescription?.toLowerCase().includes('pine')) && 
    item.length && 
    item.length > 0 &&
    item.unit === 'L/M'
  );

  // Flatten items by quantity
  const requiredLengths: number[] = [];
  pineItems.forEach(item => {
    const count = Math.ceil(item.qty || 0);
    for (let i = 0; i < count; i++) {
      requiredLengths.push(item.length!);
    }
  });

  // Sort lengths descending for First Fit Decreasing (FFD)
  requiredLengths.sort((a, b) => b - a);

  const bins: CuttingResult[] = [];

  requiredLengths.forEach(length => {
    let placed = false;
    for (const bin of bins) {
      if (bin.waste >= length) {
        bin.cuts.push(length);
        bin.waste -= length;
        placed = true;
        break;
      }
    }

    if (!placed) {
      bins.push({
        stockLength,
        cuts: [length],
        waste: stockLength - length
      });
    }
  });

  return bins;
}
