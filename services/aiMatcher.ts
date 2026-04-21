import { aiService } from './aiService';
import { ParsedLine, CatalogProduct } from '../types';
import { Type } from '@google/genai';
import Fuse from 'fuse.js';

/**
 * Strict dimension normalization from takeoff line for gated matching.
 */
const normalizeDimsFromAny = (value: string): string | null => {
    if (!value) return null;
    const clean = value.toUpperCase()
        .replace(/[\s\t]/g, '')
        .replace(/[×X*]/g, 'x');
    
    const match = clean.match(/(\d{2,4})x(\d{2,4})/);
    if (match) {
        const d1 = parseInt(match[1]);
        const d2 = parseInt(match[2]);
        // Sort DESC to match catalog enrichment
        return d1 > d2 ? `${d1}x${d2}` : `${d2}x${d1}`;
    }
    return null;
};

export interface AiMatchResult {
  sourceId: string;
  status: 'MATCH' | 'NO_MATCH';
  itemNo?: string;
  confidence: number;
  why: string;
  overrideReason?: string;
  isSuspiciousQty?: boolean;
  qtyWarning?: string;
}

const verifyQuantity = (item: ParsedLine): { isSuspicious: boolean; warning?: string } => {
    const qty = item.qty || 0;
    const section = (item.section || '').toUpperCase();
    
    // Thresholds for suspicious quantities
    if (section.includes('STRUCTURAL') && qty > 300) {
        return { isSuspicious: true, warning: `High quantity (${qty}) for structural framing. Verify if this is correct.` };
    }
    if (section.includes('LVL') && qty > 50) {
        return { isSuspicious: true, warning: `High quantity (${qty}) for LVL. Verify if this is correct.` };
    }
    if (section.includes('HARDIE') && qty > 200) {
        return { isSuspicious: true, warning: `High quantity (${qty}) for Hardie/FC. Verify if this is correct.` };
    }
    if (qty > 1000) {
        return { isSuspicious: true, warning: `Extremely high quantity (${qty}). Possible parsing error or typo.` };
    }
    
    return { isSuspicious: false };
};

export const runSmartAiMatch = async (
  itemsToMatch: ParsedLine[],
  catalog: CatalogProduct[],
  onProgress: (progress: number) => void,
  signal?: AbortSignal
): Promise<AiMatchResult[]> => {
  const BATCH_SIZE = 10;
  const results: AiMatchResult[] = [];
  
  const validItems = itemsToMatch.filter(item => !item.manuallyUnmapped);
  if (validItems.length === 0) return [];

    const batches = [];
    for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
      batches.push(validItems.slice(i, i + BATCH_SIZE));
    }

    for (let b = 0; b < batches.length; b++) {
    if (signal?.aborted) {
      throw new Error('AbortError');
    }

    const currentBatch = batches[b];
    const batchItemsToProcess: any[] = [];
    
    for (const item of currentBatch) {
      const isOsBraceItem = /(OS\s?BRACE|OSB)/i.test(item.item);
      const lineDimsKey = normalizeDimsFromAny(item.dimensions);
      
      // PRIORITY 0: FORCED MAPPING (AI Pre-check)
      if (isOsBraceItem && lineDimsKey === "2745x1200") {
          results.push({
              sourceId: item.id,
              status: 'MATCH',
              itemNo: 'OSBB27451200',
              confidence: 1.0,
              why: 'Forced System Rule: OS BRACE 2745x1200 always maps to OSBB27451200'
          });
          continue;
      }

      let candidatePool = catalog;
      let isGated = false;

      // RULE: If valid dimensions are present, activate the hard gate
      if (lineDimsKey) {
          candidatePool = catalog.filter(p => p.dimsKey === lineDimsKey);
          isGated = true;
          
          if (candidatePool.length === 0) {
              results.push({
                  sourceId: item.id,
                  status: 'NO_MATCH',
                  confidence: 0,
                  why: `Filtered by exact dims: No catalog items found for ${lineDimsKey}`
              });
              continue;
          }
      }

      // Safety Net: Filter candidate pool to prevent OS BRACE / Hardie crossing
      const isHardieItem = /(HARDIE|HARDIFLEX|VILLABOARD|FIBRE\s?CEMENT|FC)/i.test(item.item);

      if (isOsBraceItem) {
          candidatePool = candidatePool.filter(p => !/(HARDIE|HARDIFLEX|VILLABOARD|FIBRE\s?CEMENT|FC)/i.test(p.description));
      } else if (isHardieItem) {
          candidatePool = candidatePool.filter(p => !/OSB|OS\s?BRACE/i.test(p.description));
      }

      // Secondary Section Gate: Filter by grade affinity
      const takeoffGrade = item.grade.toUpperCase().replace(/\s+/g, '');
      if (takeoffGrade.includes('LVL')) {
          candidatePool = candidatePool.filter(p => 
              p.section?.includes('Lvl') || p.section?.includes('Engineered')
          );
      } else if (takeoffGrade === 'MGP10' || takeoffGrade === 'MGP12') {
          candidatePool = candidatePool.filter(p => 
              !['Australian Oak', 'Australian Hardwoods', 'NZ Clear Pine'].includes(p.section || '')
          );
      }

      // Fuse search within the restricted pool
      const fuse = new Fuse(candidatePool, {
        keys: ['description', 'itemNo'],
        threshold: 0.25,
        includeScore: true
      });

      const query = `${item.item} ${item.dimensions} ${item.grade}`.trim();
      const fuseResults = fuse.search(query, { limit: 15 });
      
      const candidates = fuseResults.map(res => {
          const p = res.item;
          let rankScore = 0;
          
          // Grade exact match (MGP10, etc)
          const takeoffGrade = item.grade.toUpperCase().replace(/\s+/g, '');
          if (takeoffGrade && p.gradeKey === takeoffGrade) rankScore += 20;
          
          // Length match
          if (item.length && p.lengthKeyM === item.length) rankScore += 10;

          // Structural Framing Signal
          const structuralKeywords = ['STUD', 'PLATE', 'NOGGING', 'RAFTER', 'PURLIN', 'JOIST', 'TRIMMER', 'BATTEN', 'LINTEL', 'JAMB', 'HEAD', 'SILL', 'BRACE', 'FASCIA', 'BEARER', 'BLOCKING'];
          const upperItem = item.item.toUpperCase();
          const isStructuralTakeoff = structuralKeywords.some(kw => upperItem.includes(kw));
          if (isStructuralTakeoff && p.section === 'Structural Pine Mgp') {
              rankScore += 15;
          }

          // LVL Signal
          if (upperItem.includes('LVL') && p.section === 'Lvl / Engineered ') {
              rankScore += 15;
          }

          return {
              itemNo: p.itemNo,
              description: p.description,
              dimsKey: p.dimsKey,
              gradeKey: p.gradeKey,
              lengthKeyM: p.lengthKeyM,
              _rank: rankScore
          };
      }).sort((a, b) => b._rank - a._rank).slice(0, 10);

      batchItemsToProcess.push({
        id: item.id,
        takeoffText: item.item,
        takeoffDims: item.dimensions,
        lineDimsKey,
        takeoffGrade: item.grade,
        takeoffLength: item.length,
        isGated,
        isOsBraceItem,
        candidates
      });
    }

    if (batchItemsToProcess.length > 0) {
        const response = await aiService.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Match timber items to catalog candidates. 
          STRICT RULES:
          1. DIMENSIONS: If "lineDimsKey" exists, matched candidate "dimsKey" MUST equal it.
          2. GRADE: Prioritize matches for gradeKey (e.g., MGP10).
          3. LENGTH: Prefer lengthKeyM matches if applicable.
          4. BRAND SAFETY: If "isOsBraceItem" is true, DO NOT match to any Hardie/FC products.
          5. FORCED MAPPING: If "isOsBraceItem" is true and "lineDimsKey" is "2745x1200", you MUST suggest "OSBB27451200" if present.
          6. SECTION AFFINITY: Structural framing items (studs, plates, noggings, rafters, purlins, lintels, battens, fascia) MUST match candidates from 'Structural Pine Mgp' section. Never match structural framing to NZ Clear Pine, Australian Oak, or Hardwood sections.
          7. LVL ITEMS: If takeoff grade contains 'LVL', only match to LVL/Engineered section candidates.
          8. LENGTH PRECISION: For cut-length timber (unit L/M with explicit lengths like 2.7m, 3.0m, 6.0m), prefer catalog items whose lengthKeyM matches the takeoff length exactly. If no exact match, prefer the nearest longer standard length.
          9. TREATMENT: If takeoff item specifies H3, only match to catalog items whose description contains H3. Do not match H3 items to untreated stock.
          10. GRADE SUBSTITUTION: If the exact grade is not found in the catalog (e.g., MGP12 requested but only MGP10 available), you MAY suggest the next best structural equivalent, but you MUST mention this in the "why" field.
          
          Only MATCH if > 0.9 confidence.
          
          DATA: ${JSON.stringify(batchItemsToProcess)}`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sourceId: { type: Type.STRING },
                  status: { type: Type.STRING },
                  itemNo: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  why: { type: Type.STRING }
                },
                required: ['sourceId', 'status', 'confidence', 'why']
              }
            }
          }
        });

        try {
          const batchResults = JSON.parse(response.text || '[]') as AiMatchResult[];
          
          // Safety Net Validator & Post-AI Overrides
          batchResults.forEach(r => {
              if (r.status === 'MATCH') {
                  const procItem = batchItemsToProcess.find(p => p.id === r.sourceId);
                  const matchedProduct = catalog.find(p => p.itemNo === r.itemNo);
                  
                  // PIDR042019 → PIFJ4218 Override Rule
                  if (r.itemNo === 'PIDR042019') {
                      const substitute = catalog.find(p => p.itemNo === 'PIFJ4218');
                      if (substitute) {
                          r.itemNo = 'PIFJ4218';
                          r.why = `Forced Rule: Substitute PIDR042019 with PIFJ4218. ${r.why}`;
                          r.overrideReason = "PIDR042019 → PIFJ4218 rule";
                      }
                  }

                  if (procItem?.lineDimsKey && matchedProduct?.dimsKey !== procItem.lineDimsKey && r.itemNo !== 'PIFJ4218') {
                      r.status = 'NO_MATCH';
                      r.confidence = 0;
                      r.why = 'SafetyNet: Dimension mismatch detected after AI selection.';
                  } else if (procItem?.isGated) {
                      r.why = `Filtered by exact dims. ${r.why}`;
                  }
                  
                  // Brand Safety Net Post-Verification
                  if (procItem?.isOsBraceItem && matchedProduct && /(HARDIE|HARDIFLEX|VILLABOARD|FIBRE\s?CEMENT|FC)/i.test(matchedProduct.description)) {
                      r.status = 'NO_MATCH';
                      r.confidence = 0;
                      r.why = 'SafetyNet: OS Brace cannot map to Hardie product.';
                  }

                  // Quantity Verification
                  const originalItem = itemsToMatch.find(i => i.id === r.sourceId);
                  if (originalItem) {
                      const qtyCheck = verifyQuantity(originalItem);
                      if (qtyCheck.isSuspicious) {
                          r.isSuspiciousQty = true;
                          r.qtyWarning = qtyCheck.warning;
                          r.why = `${r.why} [WARNING: ${qtyCheck.warning}]`;
                      }
                  }
              }
          });
          
          results.push(...batchResults);
        } catch (e) {
          console.error("AI Response parse error", e);
        }
    }

    onProgress(((b + 1) / batches.length) * 100);
  }

  return results;
};