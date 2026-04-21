import { ParsedLine, TextLine, ParseProfile, ParserRule, ParsingTrace, CatalogProduct, FileMetadata, SheetDims, MemoryItem } from '../types';
import { GenericCADProfile, CREstimatingProfile } from './profiles';
// Unified memory key logic
import { buildLookupKey } from '../utils/learnedKey';
export { buildLookupKey };
import Fuse from 'fuse.js';

// --- Core Parsing Regex Patterns ---
const DIMENSION_X_REGEX = /\b(?:M\d+(?:[/xX][\d.]+)*(?:mm)?|\d+(?:\.\d+)?\s*[xX]\s*\d+(?:\.\d+)?(?:\s*[xX]\s*\d+(?:\.\d+)?)?(?:\s*mm|\s*m|\s*lm|\s*ea|\s*kg|\s*t|[a-zA-Z]{1,2})?|\d+(?:\.\d+)?(?:MM|mm))/i;
const DIMENSION_SPACE_REGEX = /\b(\d{2,3})\s+(\d{2,3})\b(?!\s+\d{4})/; 
const GRADE_REGEX = /\b(MGP\s*\d+|LVL\s*\d+|F\d+(?:\s*LOSP)?|H\d+|HWD|MDF(?:\s+TO\s+SELECT)?|GALV|OSBRACE|TS\.1|GL\d+[S]?|HARDIEFLEX|BLACKBUTT|PRIMED QUAD|PINUS(?:\s+CCA|\s+LOSP|\s+H2)?|PINE|HARDWOOD|CCA|LOSP|EZI TRIM|BLUEBOARD|SCYON|FRC|HARDIEWRAP|WET AREA|STANDARD|MER)\b/i;
const SLASH_QTY_LEN_REGEX = /(?<![\d.])(\d{1,4})\s*[/]\s*(\d+(?:\.\d+)?)\b/g;
const ONLY_REGEX = /\b(\d+)\s+ONLY\b/i;
const AREA_REGEX = /\b(\d+(?:\.\d+)?)\s*(?:m2|sqm)\b/i;
const LM_REGEX = /\b(\d+(?:\.\d+)?)\s*(?:lm|l\/m|m)(?=\s|$|\.|,)\b/i; 
const AT_LENGTH_REGEX = /(?:^|\s|x)@\s*(\d+(?:\.\d+)?)(?:\s*m|mm)?\b/i;
const SHEETS_TUBES_REGEX = /\b(\d+)\s*(?:Sheets?|Tubes?|Packets?|Pks?|Rolls?|Box(?:es)?|Each(?:s|es)?|Bags?|Units?|Lengths?|Pieces?|Pcs?|Pairs?|Sets?)(?:\s+of)?\b/i;
const CATEGORY_REGEX = /^(?:(?:(?:LOWER|UPPER|GROUND|FIRST|SECOND|Item)\s+)?(?:WALL|ROOF|FLOOR)\s+(?:FRAME|TRUSSES|JOISTS)|TIE\s+DOWNS|EAVES|2ND\s+FIX|EXTERNAL\s+CLADDINGS?|HARDWARE|METALWORK|BRACING|GENERAL\s+NOTES|FLOORING\s+&\s+DECKING|TEMPORARY\s+BRACE|CAVITY\s+SLIDERS|TOP\s+PLATES|BOTTOM\s+PLATES|COMMON\s+STUDS|GABLE\s+FRAMING|JAMB\s+STUDS|STUDS|NOGGING|LINTELS|BEAMS|POSTS|RAFTERS)/i;

const LEFT_COLUMN_THRESHOLD = 120;
const SUMMARY_CLEAN_REGEX = /\b(total|lm\s*total|total\s*lm)\b/gi;
const FLOORING_QTY_GATE_REGEX = /\b(\d+)\s*(SHEETS?|TUBES?|ROLLS?|PACKETS?|EACH|EA)\b/i;
const HARD_IGNORE_PATTERN = /\bPage\s+\d+\b|\bQuantities\b|\bBuilder:\b|\bSite\s+Address:\b|\bJob\s*#\b/i;
const BRACING_FORCE_ORPHAN_REGEX = /\bROLLS\s+TENSION\s+BRACE\b|\bROLLS\s+STRAP\s+BRACE\s+WITH\s+NO\s+TENSIONERS\b/i;
const BRACING_NOISE_REGEX = /\b(MULTI-TENSIONER|WINGNUT|WASHER|TA\d+)\b/gi;
const LIQUID_NAILS_REGEX = /LIQUID\s*NAILS/i;

const GENERIC_PINE_CODE = 'PIDRRDM';
const GENERIC_PINE_DESC = 'Derived Pine MGP10 6.0m';

const getRightmostMatch = (text: string, regex: RegExp): RegExpMatchArray | null => {
    const matches = Array.from(text.matchAll(new RegExp(regex, 'gi')));
    return matches.length > 0 ? matches[matches.length - 1] : null;
};

export const cleanDescription = (text: string): string => {
    if (!text) return '';
    let cleaned = text.replace(/\+\+/g, ' ')
               .replace(/^[\s:\-.,;*]+|[\s:\-.,;*]+$/g, '')
               .replace(/\s+/g, ' ')
               .trim();
    cleaned = cleaned.replace(/^(?:MM|mm|M|m)\s+/, '').replace(/\s+(?:MM|mm|M|m)$/, '');
    cleaned = cleaned.replace(/\b(?:Units?|Single|Only|Sheets?|Pieces?)\b/gi, '').trim();
    return cleaned;
};

const normalizeText = (s: string) => s.toUpperCase().replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

const extractBracketCodes = (s: string): Set<string> => {
    const codes = new Set<string>();
    if (!s) return codes;
    const matches = s.match(/\(([^)]+)\)/g);
    if (matches) {
        matches.forEach(m => {
            const clean = m.replace(/[()]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (clean) codes.add(clean);
        });
    }
    return codes;
};

const normalizeAttr = (val: string) => val.toLowerCase().replace(/[^a-z0-9]/g, '');

export const normalizeUnit = (unit: string): string => {
    if (!unit) return 'EA';
    const u = unit.toUpperCase().replace(/[^A-Z0-9/]/g, '').trim();
    if (['LM', 'L/M', 'LINEAL', 'M', 'METERS', 'METRES', 'LIN', 'LINM'].includes(u)) return 'L/M';
    if (['EA', 'EACH', 'PCS', 'PIECES', 'UNIT', 'UNITS', 'OFF', 'PCS'].includes(u)) return 'EA';
    if (['M2', 'SQM', 'SQUARE', 'SQ', 'SM'].includes(u)) return 'm2';
    if (['M3', 'CUM', 'CUBIC'].includes(u)) return 'm3';
    if (['KG', 'KILOS', 'KILOGRAMS'].includes(u)) return 'kg';
    if (['T', 'TONNES', 'TONS'].includes(u)) return 't';
    return 'EA';
};

export const convertValue = (value: number, fromUnit: string, toUnit: string, dimensions?: string): number => {
    const from = normalizeUnit(fromUnit);
    const to = normalizeUnit(toUnit);
    if (from === to) return value;
    
    // Basic conversions (can be expanded)
    if (from === 'L/M' && to === 'EA' && dimensions) {
        // Assume standard 6.0m if no length specified? Or just return value.
        return value / 6.0;
    }
    
    return value;
};

export const normalizeDimensions = (text: string): string => {
    if (!text) return '';
    const cleanText = text.toLowerCase().replace(/\s*mm/g, '').replace(/\s+x\s+/g, 'x');
    const numbers = cleanText.match(/\d+(?:\.\d+)?/g);
    if (!numbers) return '';
    
    // If we have exactly 2 or 3 numbers, it's likely a dimension set (e.g. 90x45 or 2400x1200x7)
    // In this case, we keep common lengths if they are part of the set.
    const isSet = numbers.length >= 2 && numbers.length <= 3;
    
    const dims = numbers.map(Number).filter(n => {
        if (n <= 2) return false;
        if (isSet) return true; // Keep everything in a set
        // Otherwise filter out common lengths
        return ![2400, 2700, 3000, 6000, 1200, 900, 600, 450].includes(n);
    });
    
    if (dims.length < 1) return '';
    return dims.sort((a, b) => b - a).join('x');
};

const isSummaryLine = (text: string): boolean => {
    const upper = text.toUpperCase();
    if (upper.includes('TOTAL')) return true;
    if (upper.includes('SUBTOTAL')) return true;
    if (upper.includes('SUMMARY')) return true;
    if (/^\s*\d+(?:\.\d+)?\s*(?:LM|L\s*\/\s*M)\s*$/i.test(text)) return true;
    return false;
};

const hasDataIndicator = (text: string): boolean => {
    return !!(
        text.match(SLASH_QTY_LEN_REGEX) || 
        text.match(ONLY_REGEX) || 
        text.match(SHEETS_TUBES_REGEX) || 
        text.match(LM_REGEX) || 
        text.match(AREA_REGEX) ||
        text.match(FLOORING_QTY_GATE_REGEX) ||
        text.match(/\bQTY\s*:?\s*\d+\b/i) ||
        // Support Revit style numeric column in triple-space joined text
        text.match(/\s{3,}\d+\s{3,}/)
    );
};

const hasNewItemQtyToken = (text: string): boolean => {
    return !!(
        text.match(SLASH_QTY_LEN_REGEX) ||
        text.match(/\b(\d+)\s*(Sheets?|Tubes?|Packets?|Pks?|Rolls?|Box(?:es)?|Each(?:s|es)?|Bags?|Units?|Lengths?|Pieces?|Pcs?|Pairs?|Sets?|off)\b/i) ||
        text.match(/\bQTY\s*:?\s*\d+\b/i) ||
        text.match(/\b(\d+(?:\.\d+)?)\s*(?:Lm|LM|l\/m|m)\b/i) || // Added "m" here
        text.match(/\s{3,}\d+([.]\d+)?\s{3,}/) // Bare number in column
    );
};

const looksLikeFcSpecLine = (text: string): boolean => {
    const hasJh = /JH\+/i.test(text);
    const hasSpecCombo = /\b\d{6}\b/.test(text) && DIMENSION_X_REGEX.test(text) && (/\bSQM\b/i.test(text) || /\bm2\b/i.test(text));
    return hasJh || hasSpecCombo;
};

const looksLikeSpecOrCodeLine = (text: string): boolean => {
    const upper = text.toUpperCase();
    return (
        upper.includes('JH+') ||
        /\b\d{6}\b/.test(text) ||
        DIMENSION_X_REGEX.test(text) ||
        DIMENSION_SPACE_REGEX.test(text) ||
        /\b(SQM|M2|MM)\b/i.test(text)
    );
};

const isHeaderOrSubHeader = (lineObj: TextLine, text: string): boolean => {
    if (text.startsWith('#')) return true;
    const upper = text.toUpperCase();
    
    // Check for common header keywords at the start of the line
    const headerKeywords = ['SECTION', 'CATEGORY', 'LOCATION', 'LEVEL', 'AREA', 'ZONE', 'PHASE'];
    if (headerKeywords.some(kw => upper.startsWith(kw + ' ') || upper.startsWith(kw + ':'))) return true;

    if (CATEGORY_REGEX.test(text) && (lineObj.rect && lineObj.rect[0] < LEFT_COLUMN_THRESHOLD)) return true;
    
    if (lineObj.rect && lineObj.rect[0] < LEFT_COLUMN_THRESHOLD) {
        // If it's in the first column and has no data indicators, it's likely a header
        if (!hasDataIndicator(text)) {
            const isLabelStyle = /^[A-Z\s&/\-().]+$/.test(text) && !/\d/.test(text);
            if (isLabelStyle && text.length >= 3 && text.length <= 50) return true;
        }

        if (text.includes('   ')) {
            const parts = text.split('   ');
            const col1 = parts[0].trim();
            if (looksLikeSpecOrCodeLine(col1)) return false;
            const isLabelStyle = /^[A-Z\s&/\-().]+$/.test(col1) && !/\d/.test(col1);
            if (isLabelStyle && col1.length >= 3 && col1.length <= 40 && !hasDataIndicator(col1)) {
                 if (!DIMENSION_X_REGEX.test(col1)) return true;
            }
        }
    }
    return false;
};

const isContinuationCandidate = (text: string): boolean => {
    if (!text || text.length < 2) return false;
    if (HARD_IGNORE_PATTERN.test(text)) return false;
    if (hasNewItemQtyToken(text)) return false;
    if (isSummaryLine(text)) return false;
    
    const hasLetters = /[a-zA-Z]/.test(text);
    const hasCode = /\([^)]+\)/.test(text);
    const hasJoiners = /\b(C\/W|WITH|AND|WASHER|WINGNUT|FOR|TO|SUIT|INCL|INCLUDING|ONLY)\b/i.test(text);
    
    // If it's all uppercase and short, it might be a header
    if (/^[A-Z\s&/\-().]+$/.test(text) && text.length < 20 && !hasJoiners) return false;

    if (!hasLetters && !hasCode && !hasJoiners) return false;
    
    if (text.length < 15) {
        if (/^\s*MGP\d+\s*$/i.test(text)) return false;
        if (/^\s*\d+x\d+\s*$/i.test(text)) return false;
        if (/^\s*(EA|LM|L\/M|M2|SQM)\s*$/i.test(text)) return false;
    }
    return true;
};

export const parseSheetDimsFromLine = (dims: string): SheetDims | null => {
    if (!dims) return null;
    const parts = dims.toLowerCase().split(/[x*]/).map(p => p.trim());
    if (parts.length < 2) return null;
    const rawValues = parts.map(p => {
        const match = p.match(/\d+(?:\.\d+)?/);
        return match ? parseFloat(match[0]) : 0;
    }).filter(v => v > 0);
    if (rawValues.length < 2) return null;
    const lw = rawValues.slice(0, 2).map(n => {
        if (n <= 10) return Math.round(n * 1000);
        return Math.round(n);
    });
    let t = undefined;
    if (rawValues.length >= 3) {
        if (rawValues[2] <= 50) t = rawValues[2];
    }
    return { l: lw[0], w: lw[1], t };
};

export const sheetDimsMatch = (a: SheetDims, b: SheetDims): { ok: boolean; score: number } => {
    const L_TOLERANCE = 60;
    const W_TOLERANCE = 0; 
    const T_TOLERANCE = 0; 
    const checkInternal = (d1a: number, d1b: number, d2a: number, d2b: number) => {
        const [max1, min1] = d1a > d1b ? [d1a, d1b] : [d1b, d1a];
        const [max2, min2] = d2a > d2b ? [d2a, d2b] : [d2b, d2a];
        return Math.abs(max1 - max2) <= L_TOLERANCE && Math.abs(min1 - min2) <= W_TOLERANCE;
    };
    const isMatch = checkInternal(a.l, a.w, b.l, b.w);
    if (!isMatch) return { ok: false, score: 9999 };
    let tPenalty = 0;
    if (a.t !== undefined && b.t !== undefined) {
        const diff = Math.abs(a.t - b.t);
        if (diff > T_TOLERANCE) return { ok: false, score: 9999 };
        tPenalty = diff * 10;
    }
    const score = Math.abs(a.l - b.l) + Math.abs(a.w - b.w) + tPenalty;
    return { ok: true, score };
};

const getKeywords = (text: string): Set<string> => {
    const noise = new Set(['treated', 'timber', 'with', 'and', 'only', 'each', 'length', 'size', 'mm', 'mtr', 'm2', 'qty', 'count', 'for', 'the', 'item', 'code', 'nan']);
    const words = text.toLowerCase()
        .split(/[\s/\-.,xX]+/)
        .filter(w => w.length > 2 && !/^\d+$/.test(w) && !noise.has(w));
    return new Set(words);
};

const extractLength = (text: string): number | null => {
    if (!text) return null;
    const mMatch = text.match(/\b(\d+(?:\.\d+)?)\s*m\b/i);
    if (mMatch) return parseFloat(mMatch[1]);
    const mmMatch = text.match(/\b(\d{4})\s*mm\b/i);
    if (mmMatch) return parseFloat(mmMatch[1]) / 1000;
    return null;
};

const normalizeCode = (input: string | null | undefined): string | null => {
    if (!input) return null;
    return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
};

const buildLmItemNo = (dims: string): string | null => {
    if (!dims) return null;
    const parts = dims.toLowerCase().split('x');
    if (parts.length < 2) return null;
    const nums = parts.map(p => parseInt(p.match(/\d+/)?.[0] || '0')).filter(n => n > 0);
    if (nums.length < 2) return null;
    const [w, h] = nums.sort((a, b) => b - a);
    return `PIDR${String(w).padStart(3, '0')}${String(h).padStart(3, '0')}LM`;
};

const looksLikeDimension = (text: string): boolean => {
    return DIMENSION_X_REGEX.test(text) || DIMENSION_SPACE_REGEX.test(text);
};

const cleanupLine = (line: string, profile: ParseProfile): string => {
    let cleaned = line.replace(/\+\+/g, ' ')
        .replace(/(\d)mm([A-Z])/gi, '$1mm $2')
        .replace(/(\d{5,})(\d{3,4}[xX])/g, '$1 $2')
        .replace(/([A-Z])(\d{3,4}[xX])/g, '$1 $2')
        .replace(/([A-Z])(\d{5,})/g, '$1 $2')
        .replace(/(\d)MM/g, '$1 MM')
        .replace(/x(\d+)MM/gi, 'x$1 MM')
        .replace(/(\d)x(\d)/gi, '$1x$2')
        .replace(/SECURA\s*JH/i, 'SECURA JH')
        .replace(/EXTERNAL\s*(\d)/i, 'EXTERNAL $1')
        .replace(/\bLI\s+NNG\b/ig, 'LINING')
        .replace(/\bFL\s+OORING\b/ig, 'FLOORING')
        .replace(/\bCL\s+ADDING\b/ig, 'CLADDING')
        .replace(/\s+/g, ' ');

    if (profile.settings.lineCleanupRules) {
        for (const rule of profile.settings.lineCleanupRules) {
            cleaned = cleaned.replace(rule.pattern, rule.replacement);
        }
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
    }
    return cleaned.trim();
};

const parseHarroldKiteLine = (
    rawText: string,
    currentCategory: string,
    currentSection: string,
    currentSubSection: string,
    lineObj: TextLine,
    createLine: any,
    fuse: any,
    normalizedCatalog: any,
    catalogByCode: any,
    learnedMappings: any
): ParsedLine | null => {
    if (!rawText || rawText.length < 5) return null;
    if (/total|subtotal|summary/i.test(rawText)) return null;

    const parts = rawText.split(/\s{2,}/).map(p => p.trim()).filter(Boolean);
    if (parts.length < 2) return null;

    let unitStr = '';
    let numbers: number[] = [];
    const descParts: string[] = [];

    for (let j = parts.length - 1; j >= 0; j--) {
        const p = parts[j];
        if (j === parts.length - 1) {
            const subParts = p.split(/\s+/);
            const possibleUnit = subParts[subParts.length - 1].toLowerCase();
            if (['m', 'lm', 'ea', 'pcs', 'l/m'].includes(possibleUnit)) {
                unitStr = possibleUnit;
                let foundNonNumber = false;
                const tempDescParts: string[] = [];
                for (let k = subParts.length - 2; k >= 0; k--) {
                    const sp = subParts[k];
                    const num = parseFloat(sp.replace(/,/g, ''));
                    if (!foundNonNumber && !isNaN(num) && sp.match(/^[\d,]+(?:\.\d+)?$/)) {
                        numbers.unshift(num);
                    } else {
                        foundNonNumber = true;
                        tempDescParts.unshift(sp);
                    }
                }
                if (tempDescParts.length > 0) {
                    descParts.unshift(tempDescParts.join(' '));
                }
            } else {
                break;
            }
        } else {
            const subParts = p.split(/\s+/);
            let allNumbers = true;
            const tempNums: number[] = [];
            for (const sp of subParts) {
                const num = parseFloat(sp.replace(/,/g, ''));
                if (!isNaN(num) && sp.match(/^[\d,]+(?:\.\d+)?$/)) {
                    tempNums.push(num);
                } else {
                    allNumbers = false;
                    break;
                }
            }
            if (allNumbers && descParts.length === 0) {
                numbers = tempNums.concat(numbers);
            } else {
                descParts.unshift(p);
            }
        }
    }

    if (unitStr && numbers.length > 0 && descParts.length > 0) {
        let qty: number;
        let length: number | null;
        let total: number;

        if (numbers.length >= 3) {
            qty = numbers[numbers.length - 3];
            length = numbers[numbers.length - 2];
            total = numbers[numbers.length - 1];
        } else if (numbers.length === 2) {
            qty = numbers[0];
            if (['ea', 'pcs'].includes(unitStr)) {
                length = null;
                total = numbers[1];
            } else {
                if (numbers[1] === qty) {
                    length = null;
                    total = numbers[1];
                } else if (numbers[1] % 1 !== 0 || numbers[1] <= 12) {
                    length = numbers[1];
                    total = qty * length;
                } else {
                    length = null;
                    total = numbers[1];
                }
            }
        } else {
            qty = numbers[0];
            length = null;
            total = qty;
        }

        const productDesc = descParts[descParts.length - 1];
        let dims = '';
        const allDimMatches = [...productDesc.matchAll(new RegExp(DIMENSION_X_REGEX, 'g'))];
        const bestXMatch = allDimMatches.length > 0 ? (allDimMatches.find(m => /[xX]/.test(m[0])) || allDimMatches[0]) : null;
        if (bestXMatch) {
            dims = bestXMatch[0].replace(/\s+/g, '').toUpperCase();
        } else {
            const spaceDimMatch = productDesc.match(DIMENSION_SPACE_REGEX);
            if (spaceDimMatch) {
                dims = `${spaceDimMatch[1]}x${spaceDimMatch[2]}`;
            }
        }

        let grade = '';
        const gradeMatch = productDesc.match(GRADE_REGEX);
        if (gradeMatch) {
            grade = gradeMatch[0];
        }

        const finalDesc = cleanDescription(productDesc);
        let normalizedUnit: 'L/M' | 'EA' | 'm2' = 'EA';
        if (['m', 'lm', 'l/m'].includes(unitStr)) normalizedUnit = 'L/M';
        else if (['m2', 'sqm'].includes(unitStr)) normalizedUnit = 'm2';
        
        const trace: ParsingTrace = { stepLog: ['HARROLD&KITE specific parsing'], appliedRules: [], extraction: [] };
        
        return createLine(
            currentCategory,
            currentSection,
            currentSubSection,
            finalDesc,
            dims,
            grade,
            qty,
            length,
            normalizedUnit,
            total,
            rawText,
            lineObj,
            'harrold_kite_exact',
            trace,
            fuse,
            normalizedCatalog,
            catalogByCode,
            learnedMappings,
            false
        );
    }
    return null;
};

const extractPotentialCodes = (item: string, originalLine?: string): string[] => {
    const codes: string[] = [];
    const candidates = [item, originalLine].filter(Boolean) as string[];
    const alphaNumRegex = /\b[A-Z]{2,5}\s*\d{5,10}\b/gi;
    const pureDigitsRegex = /\b\d{5,10}\b/g;
    candidates.forEach(text => {
        const anMatches = text.match(alphaNumRegex) || [];
        anMatches.forEach(m => {
            const norm = normalizeCode(m);
            if (norm && !codes.includes(norm)) codes.push(norm);
        });
        const dMatches = text.match(pureDigitsRegex) || [];
        dMatches.forEach(m => {
            const norm = normalizeCode(m);
            if (norm && !codes.includes(norm)) codes.push(norm);
        });
    });
    return codes;
};

interface NormalizedProduct extends CatalogProduct {
    _canonDims: string;
    _normGrade: string;
    _keywordSet: Set<string>;
    _searchStr: string;
    _itemNoNums: string[];
    _fixedLength: number | null;
}

const _matchCatalogCodeInternal = (
    item: string, 
    dims: string, 
    grade: string, 
    length: number | null,
    unit: string,
    section: string,
    subSection: string,
    originalLine: string,
    fuse: Fuse<NormalizedProduct> | null,
    normalizedCatalog: NormalizedProduct[],
    catalogByCode: Map<string, NormalizedProduct>,
    learnedMappings: Map<string, MemoryItem>
): { code: string, description: string, isMapped: boolean, source?: ParsedLine['mappingSource'], priceCents?: number | null, group?: string | null, section?: string | null, lineSheetDimsMm?: SheetDims | null, failureReason?: string, matchedFromMemory?: boolean } => {
    const upperItem = item.toUpperCase();
    const upperUnit = unit.toUpperCase();
    const isMgp10 = grade.toUpperCase().replace(/\s+/g, '') === 'MGP10';
    const isPine = upperItem.includes('PINE') || isMgp10;

    if (!normalizedCatalog || normalizedCatalog.length === 0) {
        if (isPine) {
            return { code: GENERIC_PINE_CODE, description: GENERIC_PINE_DESC, isMapped: true, source: 'LM_FALLBACK', group: 'Timber', section: 'Structural Pine Mgp' };
        }
        return { code: '', description: '', isMapped: false, failureReason: 'Product catalog is empty.' };
    }

    // 1. Forced Mappings (OS Brace 2745x1200)
    const isOsBrace = /(OS\s?BRACE|OSB)/i.test(item);
    const lineSheetDims = parseSheetDimsFromLine(dims);
    if (isOsBrace && lineSheetDims && lineSheetDims.l === 2745 && lineSheetDims.w === 1200) {
        const forcedMatch = catalogByCode.get('OSBB27451200');
        if (forcedMatch) return { code: forcedMatch.itemNo, description: forcedMatch.description, isMapped: true, source: 'CODE_EXACT', priceCents: forcedMatch.priceCents, group: forcedMatch.group, section: forcedMatch.section, lineSheetDimsMm: lineSheetDims };
    }

    // 2. Exact Code Matches (from potential codes in text)
    const potentialCodes = extractPotentialCodes(item, originalLine);
    for (const code of potentialCodes) {
        const exactMatch = catalogByCode.get(code);
        if (exactMatch) return { code: exactMatch.itemNo, description: exactMatch.description, isMapped: true, source: 'CODE_EXACT', priceCents: exactMatch.priceCents, group: exactMatch.group, section: exactMatch.section };
    }

    // 3. Learned Mappings (Memory)
    const exactKey = buildLookupKey(item, dims);
    let memoryMatch = learnedMappings.get(exactKey);
    
    if (!memoryMatch) {
        const noDimsKey = buildLookupKey(item, "");
        memoryMatch = learnedMappings.get(noDimsKey);
    }
    
    if (memoryMatch) {
        const found = catalogByCode.get(normalizeCode(memoryMatch.itemNo) || '');
        if (found) return { code: found.itemNo, description: found.description, isMapped: true, source: 'MEMORY', matchedFromMemory: true, priceCents: found.priceCents, group: found.group, section: found.section };
    }

    // 4. Hardcoded Rules (Liquid Nails)
    if (LIQUID_NAILS_REGEX.test(upperItem)) {
        const lnMatch = catalogByCode.get('LN0');
        if (lnMatch) return { code: lnMatch.itemNo, description: lnMatch.description, isMapped: true, source: 'CODE_EXACT', priceCents: lnMatch.priceCents, group: lnMatch.group, section: lnMatch.section };
    }

    // 5. Bracing Context Rules
    const isBracingContext = subSection.toUpperCase() === 'BRACING' || section.toUpperCase().includes('BRACING');
    const isCountUnit = /EA|ROLL|PACKET|BOX|BAG/.test(upperUnit);
    const isNotPine = !upperItem.includes('PINE');
    if (isBracingContext && isCountUnit && isNotPine) {
        const bracketCodes = extractBracketCodes(originalLine);
        const lineTextNorm = normalizeText(`${item} ${originalLine}`);
        const bracingCandidates = normalizedCatalog.filter(p => {
            const descNorm = normalizeText(p.description);
            if (bracketCodes.size > 0) {
                let foundCode = false;
                bracketCodes.forEach(code => { if (descNorm.includes(code) || normalizeText(p.itemNo).includes(code)) foundCode = true; });
                if (!foundCode) return false;
            }
            const braceRules = [
                { req: ["ROLLS", "TENSION", "BRACE"], opt: ["TA550"] },
                { req: ["ROLLS", "STRAP", "BRACE"], opt: ["NO", "TENSIONERS"] },
                { req: ["MULTI", "TENSIONER"], opt: ["WINGNUT", "TA0424", "WASHER"] }
            ];
            return braceRules.some(r => {
                const matchesLine = r.req.every(term => lineTextNorm.includes(term));
                const matchesDesc = r.req.every(term => descNorm.includes(term));
                return matchesLine && matchesDesc;
            });
        });
        if (bracingCandidates.length === 1) {
            const best = bracingCandidates[0];
            return { code: best.itemNo, description: best.description, isMapped: true, source: 'RULE_BRACING', priceCents: best.priceCents, group: best.group, section: best.section };
        }
    }
    
    // 6. Sheet Goods Matching (by dimensions)
    const isSheetGoodsCandidate = /OSB|BRACE|BOARD|SHEET|VILLABOARD|HARDFLEX|STRUCTAFLOOR/.test(upperItem) || /EA|SHEETS|M2/.test(upperUnit) || (dims.split(/[x*]/).length >= 3);
    if (isSheetGoodsCandidate && lineSheetDims) {
        const candidates = normalizedCatalog
            .filter(p => {
                if (isOsBrace && /(HARDIE|HARDIFLEX|VILLABOARD|FIBRE\s?CEMENT|FC)/i.test(p.description)) return false;
                return !!p.sheetDimsMm;
            })
            .map(p => {
                const matchResult = sheetDimsMatch(lineSheetDims, p.sheetDimsMm!);
                return { product: p, ...matchResult };
            })
            .filter(res => res.ok)
            .sort((a, b) => a.score - b.score);
        if (candidates.length > 0) {
            const best = candidates[0].product;
            return { code: best.itemNo, description: best.description, isMapped: true, source: 'FUZZY', priceCents: best.priceCents, group: best.group, section: best.section, lineSheetDimsMm: lineSheetDims };
        }
    }

    // 7. Dimension-Gated Fuzzy Matching
    const lineDimsKey = normalizeDimensions(dims) || normalizeDimensions(item);
    let eligibleCatalog = normalizedCatalog;
    if (lineDimsKey) eligibleCatalog = normalizedCatalog.filter(p => p.dimsKey === lineDimsKey);
    
    const explicitMatch = eligibleCatalog.find(p => upperItem.includes(p.itemNo.toUpperCase()));
    if (explicitMatch) return { code: explicitMatch.itemNo, description: explicitMatch.description, isMapped: true, source: 'CODE_EXACT', priceCents: explicitMatch.priceCents, group: explicitMatch.group, section: explicitMatch.section };

    const takeoffGrade = normalizeAttr(grade);
    const takeoffKeywords = getKeywords(`${item} ${dims} ${grade}`);
    const SCORE_THRESHOLD = 45; 
    let activeFuse = fuse;
    if (lineDimsKey && eligibleCatalog.length < normalizedCatalog.length && eligibleCatalog.length > 0) {
        activeFuse = new Fuse(eligibleCatalog, { keys: [{ name: 'description', weight: 0.7 }, { name: 'itemNo', weight: 0.3 }], includeScore: true, threshold: 0.5, distance: 100 });
    }

    if (activeFuse) {
        const query = `${item} ${dims} ${grade}`.trim();
        const results = activeFuse.search(query, { limit: 50 });
        let bestMatch: NormalizedProduct | null = null;
        let highestScore = 0;
        for (const result of results) {
            const prod = result.item;
            if (isOsBrace && /(HARDIE|HARDIFLEX|VILLABOARD|FIBRE\s?CEMENT|FC)/i.test(prod.description)) continue;
            let score = 0;
            const fuzzyFactor = (1 - (result.score || 0));
            score += fuzzyFactor * 30;
            if (length !== null && prod._fixedLength !== null) {
                const diff = Math.abs(length - prod._fixedLength);
                if (diff < 0.05) { score += 40; } else score -= 100;
            }
            if (takeoffKeywords.size > 0) {
                let matches = 0;
                takeoffKeywords.forEach(kw => { if (prod._keywordSet.has(kw)) matches++; });
                score += (matches / Math.max(takeoffKeywords.size, 1)) * 20;
            }
            if (lineDimsKey && prod.dimsKey === lineDimsKey) score += 50;
            if (takeoffGrade && prod._normGrade === takeoffGrade) score += 15;
            if (score > highestScore) { highestScore = score; bestMatch = prod; }
            if (highestScore >= 120) break;
        }
        if (bestMatch && highestScore >= SCORE_THRESHOLD) return { code: bestMatch.itemNo, description: bestMatch.description, isMapped: true, source: 'FUZZY', priceCents: bestMatch.priceCents, group: bestMatch.group, section: bestMatch.section };
    }

    // 8. Pine Fallback
    if (isPine) {
        const lineDimsKey = normalizeDimensions(dims) || normalizeDimensions(item);
        const isLm = upperUnit === 'L/M' || upperUnit === 'LM';
        if (lineDimsKey && isLm) {
            const lmCode = buildLmItemNo(lineDimsKey);
            if (lmCode) {
                const lmMatch = catalogByCode.get(lmCode);
                if (lmMatch) return { code: lmMatch.itemNo, description: lmMatch.description, isMapped: true, source: 'LM_FALLBACK', priceCents: lmMatch.priceCents, group: lmMatch.group, section: lmMatch.section };
            }
        }
        return { code: GENERIC_PINE_CODE, description: GENERIC_PINE_DESC, isMapped: true, source: 'LM_FALLBACK', group: 'Timber', section: 'Structural Pine Mgp' };
    }

    return { code: '', description: '', isMapped: false, failureReason: 'No suitable catalog match found.' };
};

export const matchCatalogCode = (
    item: string, 
    dims: string, 
    grade: string, 
    length: number | null,
    unit: string,
    section: string,
    subSection: string,
    originalLine: string,
    fuse: Fuse<NormalizedProduct> | null,
    normalizedCatalog: NormalizedProduct[],
    catalogByCode: Map<string, NormalizedProduct>,
    learnedMappings: Map<string, MemoryItem>
) => {
    const result = _matchCatalogCodeInternal(item, dims, grade, length, unit, section, subSection, originalLine, fuse, normalizedCatalog, catalogByCode, learnedMappings);
    if (result.isMapped && result.code === 'PIDR042019') {
        const substitute = catalogByCode.get('PIFJ4218');
        if (substitute) return { ...result, code: substitute.itemNo, description: substitute.description, priceCents: substitute.priceCents, group: substitute.group, section: substitute.section, overrideReason: "PIDR042019 → PIFJ4218 rule" };
    }
    return result;
};

const calculateConfidence = (line: ParsedLine, parseMethod: string): { score: number, notes: string[] } => {
  let score = 0.0;
  const notes: string[] = [];
  if (parseMethod === 'explicit_columns') score += 0.3;
  else if (parseMethod === 'implicit_columns') { score += 0.15; notes.push('Auto-Detected Split'); }
  else if (parseMethod === 'pattern_match') score += 0.2;
  if (line.dimensions) score += 0.2;
  if (line.grade) score += 0.1;
  if (line.qty > 0) score += 0.2; else { notes.push('No quantity found'); score -= 0.2; }
  if (line.item && line.item !== 'Unknown Item') { if (line.item.length > 3) score += 0.1; } else { notes.push('Item description unclear'); score -= 0.1; }
  return { score: Math.min(Math.max(score, 0.01), 1.0), notes };
};

export const applyMappingToRow = (row: ParsedLine, mapping: any): Partial<ParsedLine> => {
    const source = mapping.source || 'MEMORY';
    let reason: string;
    switch (source) {
        case 'CODE_EXACT': reason = `Matched by exact code from the PDF: ${mapping.code || mapping.itemNo}.`; break;
        case 'LM_FALLBACK': reason = mapping.code === GENERIC_PINE_CODE ? `Mapped to generic Pine code ${GENERIC_PINE_CODE} because no specific board match was found.` : `No exact length match, used LM item for ${row.dimensions}: ${mapping.code || mapping.itemNo}.`; break;
        case 'RULE_BRACING': reason = `Matched by bracing rule using code: ${mapping.code || mapping.itemNo}.`; break;
        case 'MEMORY': reason = `Matched using learned memory from previous jobs.`; break;
        case 'MANUAL': reason = `Matched manually by user selection.`; break;
        case 'FUZZY':
            if (mapping.lineSheetDimsMm) reason = `Matched by sheet size: ${row.dimensions} matched catalog size.`;
            else {
                const signals = [row.dimensions, row.length ? `${row.length}m` : null].filter(Boolean).join(' and ');
                reason = signals ? `Matched by dimensions and length: ${signals}.` : `Matched by description similarity.`;
            }
            break;
        default: reason = `Matched via ${source}.`;
    }
    const updates: Partial<ParsedLine> = { spruceItemNo: mapping.code || mapping.itemNo, spruceDescription: mapping.description, sprucePriceCents: mapping.priceCents ?? null, spruceGroup: mapping.group ?? null, spruceSection: mapping.section ?? null, spruceMapped: true, matchedFromMemory: mapping.matchedFromMemory || false, overrideReason: mapping.overrideReason || undefined, manuallyUnmapped: false, mappingSource: source, matchReason: reason, price: (mapping.priceCents || 0) / 100, lineSheetDimsMm: mapping.lineSheetDimsMm ?? null };
    if (!row.sectionLocked && mapping.group && mapping.group.toUpperCase() !== 'N/A' && mapping.group.toLowerCase() !== 'nan') updates.section = mapping.group;
    if (!row.subSectionLocked && mapping.section && mapping.section.toUpperCase() !== 'N/A' && mapping.section.toLowerCase() !== 'nan') updates.subSection = mapping.section;
    return updates;
};

export const extractContactDetails = (text: string | TextLine[]): Partial<FileMetadata> => {
    const fullText = Array.isArray(text) ? text.map(t => t.text).join('\n') : text;
    const headerLines = fullText.split('\n').slice(0, 150);
    const headerText = headerLines.join('\n');
    const cleanMeta = (val: string | undefined) => { if (!val) return undefined; return val.replace(/^[\s:\-.,;+]+|[\s:\-.,;+]+$/g, '').trim(); };
    const emailMatch = headerText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = headerText.match(/(?:\b04\d{2}[-\s]?\d{3}[-\s]?\d{3}\b)|(?:\(0\d\)|0\d)\s*\d{4}[\s-]*\d{4}/);
    const formattedPhone = phoneMatch ? phoneMatch[0].trim() : undefined;
    let address = undefined;
    for (let i = 0; i < headerLines.length; i++) {
        const line = headerLines[i];
        const match = line.match(/^(?:Site\s*Address|Site|Address|Location|Project|Deliver To)(?:\s*(?:Addr|Address)?[:.]|\s+)\s*(.*)/i);
        if (match) {
            let addrPart = match[1].trim();
            if (i + 1 < headerLines.length) {
                const subMatch = headerLines[i+1].match(/^SUBURB\s*[:.]?\s*(.*)/i);
                if (subMatch) addrPart = `${addrPart.replace(/[,.]+$/, '').trim()}, ${subMatch[1].trim()}`;
            }
            address = addrPart; break; 
        }
    }
    if (!address) { const addressMatch = headerText.match(/(?:Site|Address|Location|Project|Deliver To)(?:\s*(?:Addr|Address)?[:.]|\s+)\s*([^\n\r]+)/i); if (addressMatch) address = addressMatch[1].trim(); }
    if (address) address = address.replace(/,{2,}/g, ',').replace(/\.{2,}/g, '.').replace(/,\s*,/g, ', ').trim();
    address = cleanMeta(address);
    let dateStr = undefined;
    const explicitDateMatch = headerText.match(/(?:Printed on|Date|Dated|Date Enter)(?:[:.]|\s+).*?(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i);
    if (explicitDateMatch) dateStr = explicitDateMatch[1];
    let builderName = undefined;
    const builderMatch = headerText.match(/(?:Builder|Client|Customer)(?:[:.]|\s)\s*([^\n\r]*)/i);
    if (builderMatch) {
        let rawName = builderMatch[1];
        const splitMatch = rawName.search(/(?:Date| Ph|Mob|Page|Job|Site|Ref)[:.]/i);
        if (splitMatch !== -1) rawName = rawName.substring(0, splitMatch);
        builderName = rawName.trim();
    }
    builderName = cleanMeta(builderName);
    let jobNumber = undefined;
    const jobMatch = headerText.match(/(?:Job\s*#|Job\s*No|Project\s*#)(?:[:.]|\s+)\s*([^\n\r]+)/i);
    if (jobMatch) {
        let rawJob = jobMatch[1].trim();
        const dateIdx = rawJob.search(/\s+DATE\s+/i);
        if (dateIdx !== -1) rawJob = rawJob.substring(0, dateIdx).trim();
        jobNumber = rawJob;
    }
    jobNumber = cleanMeta(jobNumber);
    return { email: emailMatch ? emailMatch[0] : undefined, phoneNumber: formattedPhone, address, dateStr, builder: builderName, jobNumber };
};

export const remapParsedRow = (
    row: ParsedLine, 
    catalog: CatalogProduct[],
    learnedMappings: Map<string, MemoryItem>
): Partial<ParsedLine> => {
    const catalogByCode = new Map<string, any>();
    const normalizedCatalog: any[] = catalog.map(p => {
        const normKey = normalizeCode(p.itemNo);
        const prod = { ...p, _canonDims: normalizeDimensions(p.dimensions || '') || normalizeDimensions(p.description), _normGrade: normalizeAttr(p.grade || ''), _keywordSet: getKeywords(`${p.description} ${p.dimensions || ''} ${p.grade || ''}`), _fixedLength: extractLength(p.description) };
        if (normKey) catalogByCode.set(normKey, prod);
        return prod;
    });
    const fuse = new Fuse(normalizedCatalog, { keys: [{ name: 'description', weight: 0.7 }, { name: 'itemNo', weight: 0.3 }], includeScore: true, threshold: 0.5, distance: 100 });
    const mapping = matchCatalogCode(row.item, row.dimensions, row.grade, row.length, row.unit, row.section, row.subSection, row.originalLine || '', fuse, normalizedCatalog, catalogByCode, learnedMappings);
    if (mapping.isMapped) return applyMappingToRow(row, mapping);
    return { spruceItemNo: '', spruceDescription: '', spruceMapped: false, price: 0, matchReason: mapping.failureReason || 'No match found during re-map.' };
};

export const parseTakeoff = (
    input: string | TextLine[], 
    profile: ParseProfile = GenericCADProfile,
    rules: ParserRule[] = [],
    catalog: CatalogProduct[] = [],
    learnedMappings: Map<string, MemoryItem> = new Map()
): { items: ParsedLine[], notes: string[], errors: string[] } => {
  // Re-attach section handlers if they were stripped for worker transfer
  if (profile.id === 'cr-estimating' && (!profile.sectionHandlers || !profile.sectionHandlers[0].process)) {
      profile.sectionHandlers = CREstimatingProfile.sectionHandlers;
  }
  
  const textLines: TextLine[] = typeof input === 'string' ? input.split(/\r?\n/).map(text => ({ text, page: 1, rect: [0,0,0,0] })) : input;
  const catalogByCode = new Map<string, NormalizedProduct>();
  const normalizedCatalog: NormalizedProduct[] = catalog.map(p => {
      let desc = String(p.description || '');
      if (desc.toLowerCase() === 'nan' || !desc.trim()) {
          const codeParts = p.itemNo.match(/[A-Z]+|\d+/g) || []; desc = codeParts.join(' ');
          if (p.itemNo.startsWith('PI')) desc = 'PINE ' + desc;
      }
      let fixedLength = extractLength(desc);
      if (fixedLength === null) {
          const tailNums = p.itemNo.match(/\d+$/);
          if (tailNums && p.itemNo.length > 8) {
              const val = parseInt(tailNums[0]);
              if (val >= 18 && val <= 72 && val % 3 === 0) fixedLength = val / 10;
              else if (val >= 1800 && val <= 7200) fixedLength = val / 1000;
          }
      }
      const normProd = { ...p, description: desc, _canonDims: normalizeDimensions(p.dimensions || '') || normalizeDimensions(desc), _normGrade: normalizeAttr(p.grade || ''), _keywordSet: getKeywords(`${desc} ${p.dimensions || ''} ${p.grade || ''}`), _searchStr: `${desc} ${p.itemNo}`.toLowerCase(), _itemNoNums: p.itemNo.match(/\d+/g) || [], _fixedLength: fixedLength };
      const normKey = normalizeCode(p.itemNo);
      if (normKey) catalogByCode.set(normKey, normProd);
      return normProd;
  });
  const fuse: Fuse<NormalizedProduct> | null = normalizedCatalog.length > 0 ? new Fuse(normalizedCatalog, { keys: [{ name: 'description', weight: 0.7 }, { name: 'itemNo', weight: 0.3 }], includeScore: true, threshold: 0.5, distance: 100 }) : null;
  const activeRules = rules.filter(r => !r.profileId || r.profileId === profile.id || r.profileId === 'custom');
  const ignoreRules = activeRules.filter(r => r.type === 'ignore_pattern');
  const sectionRenameRules = activeRules.filter(r => r.type === 'section_rename');
  const dimRules = activeRules.filter(r => r.type === 'dimensions_rule');
  const gradeRules = activeRules.filter(r => r.type === 'grade_rule');
  const unitOverrideRules = activeRules.filter(r => r.type === 'unit_override');
  const parsedData: ParsedLine[] = []; const notes: string[] = []; const errors: string[] = [];
  const currentCategory = 'Structural'; let currentSection = 'General'; let currentSubSection = 'General';
  let isSkippingSection = false; let isNotesSection = false;
  let lastItem = ''; let lastDims = ''; let lastGrade = '';
  const finalizeItem = (itm: string) => cleanDescription(itm);
  const createLine = (category: string, section: string, subSection: string, item: string, dimensions: string, grade: string, qty: number, length: number | null, unit: 'L/M' | 'EA' | 'm2', total: number, originalLine: string, lineObj: TextLine, parseMethod: 'explicit_columns' | 'implicit_columns' | 'pattern_match' = 'pattern_match', trace: ParsingTrace, fuse: Fuse<NormalizedProduct> | null, normalizedCatalog: NormalizedProduct[] = [], catalogByCode: Map<string, NormalizedProduct>, learnedMappings: Map<string, MemoryItem>, isContinued: boolean = false): ParsedLine => {
      let finalGrade = grade; let finalItemName = item; const normGrade = finalGrade.toUpperCase().replace(/\s+/g, '');
      if (normGrade.startsWith('LVL')) finalItemName = 'LVL';
      else if (normGrade === 'MGP10') finalItemName = 'PINE';
      else {
          const isTimber = normGrade === 'MGP12' || finalItemName.toUpperCase().includes('PINE');
          if (isTimber) { finalItemName = finalItemName.replace(SUMMARY_CLEAN_REGEX, '').trim(); finalItemName = finalItemName.replace(/\s+LM$/i, '').trim(); }
          if (normGrade === 'MGP12' && (!finalItemName || finalItemName === 'Unknown Item' || finalItemName === dimensions || /STUDS|PLATES|NOGGING|FRAME/i.test(finalItemName))) finalItemName = 'PINE';
      }
      if (finalItemName.toUpperCase() === 'PINE' && !finalGrade.trim()) finalGrade = 'MGP10';
      if (BRACING_FORCE_ORPHAN_REGEX.test(finalItemName)) finalItemName = finalItemName.replace(BRACING_NOISE_REGEX, '').replace(/\s+/g, ' ').trim();
      const mapping = matchCatalogCode(finalItemName, dimensions, finalGrade, length, unit, section, subSection, originalLine, fuse, normalizedCatalog, catalogByCode, learnedMappings);
      let line: ParsedLine = { id: crypto.randomUUID(), category, section, subSection, item: finalItemName || 'Unknown Item', dimensions, grade: finalGrade, qty, length, unit, total, originalLine, page: lineObj.page, rect: lineObj.rect, isNew: false, isContinued, debugTrace: JSON.parse(JSON.stringify(trace)) };
      if (mapping.isMapped) { const mappingUpdates = applyMappingToRow(line, mapping); line = { ...line, ...mappingUpdates }; line.totalPrice = (line.price || 0) * line.total; } else { line.spruceMapped = false; line.price = 0; line.totalPrice = 0; line.matchReason = !line.dimensions ? "No match found, dimensions missing." : mapping.failureReason || `No match found for ${line.dimensions}.`; }
      if (mapping.source === 'MEMORY' || mapping.source === 'CODE_EXACT' || mapping.source === 'LM_FALLBACK' || mapping.source === 'RULE_BRACING') { line.confidence = 1.0; line.parsingNotes = [`Mapped from ${mapping.source}`]; } else { const { score, notes } = calculateConfidence(line, parseMethod); line.confidence = score; line.parsingNotes = notes; }
      return line;
  };
  let flooringAcc: { section: string; subSection: string; qty: number; unit: 'EA'; textParts: string[]; lineObj: TextLine; originalLines: string[]; } | null = null;
  let flooringOrphans: string[] = [];
  const flushFlooringItem = () => {
    if (!flooringAcc) return;
    const combinedText = flooringAcc.textParts.join(' ').replace(/\s+/g, ' ').trim(); const originalText = flooringAcc.originalLines.join(' ');
    let itemText = combinedText; let dims = ''; const dimMatch = itemText.match(DIMENSION_X_REGEX);
    if (dimMatch) { dims = dimMatch[0].replace(/\s+/g, '').toUpperCase(); itemText = itemText.replace(dimMatch[0], ''); }
    let grade = ''; const gradeMatch = itemText.match(GRADE_REGEX);
    if (gradeMatch) { grade = gradeMatch[0]; itemText = itemText.replace(gradeMatch[0], ''); }
    const atLenMatch = itemText.match(AT_LENGTH_REGEX);
    let len: number | null = null; if (atLenMatch) { len = parseFloat(atLenMatch[1]); if (len > 50) len = len / 1000; itemText = itemText.replace(atLenMatch[0], ''); }
    const trace: ParsingTrace = { stepLog: ['Flooring Multi-line Flush'], appliedRules: [], extraction: [] };
    parsedData.push(createLine(currentCategory, flooringAcc.section, flooringAcc.subSection, finalizeItem(itemText), dims, grade, flooringAcc.qty, len, flooringAcc.unit, flooringAcc.qty, originalText, flooringAcc.lineObj, 'pattern_match', trace, fuse, normalizedCatalog, catalogByCode, learnedMappings));
    flooringAcc = null;
  };
  let bracingOrphans: TextLine[] = [];
  for (let i = 0; i < textLines.length; i++) {
    const lineObj = textLines[i]; let line = lineObj.text.trim();
    
    // Check for section handlers first
    if (profile.sectionHandlers) {
        let handled = false;
        for (const handler of profile.sectionHandlers) {
            if (handler.header.test(line)) {
                const result = handler.process(textLines, i);
                if (result.notes) {
                    notes.push(result.notes);
                }
                i += result.consumedLines; // Skip the lines consumed by the handler
                handled = true;
                break;
            }
        }
        if (handled) continue;
    }

    if (profile.id === 'harrold-kite') {
        const parsedLine = parseHarroldKiteLine(lineObj.text.trim(), currentCategory, currentSection, currentSubSection, lineObj, createLine, fuse, normalizedCatalog, catalogByCode, learnedMappings);
        if (parsedLine) {
            parsedData.push(parsedLine);
            continue;
        }
        continue;
    }

    if (profile.id === 'revit-csv') {
        const parts = lineObj.text.split('   ').map(p => p.trim());
        if (parts.length >= 6) {
            // Revit Standard CSV Map:
            // 0: Level
            // 1: Instance
            // 2: Qty (Number of Items)
            // 3: Material (Item + Dims + Grade)
            // 4: Member Type
            // 5: Cut Length (m)
            const level = parts[0];
            const instance = parts[1];
            const rawQty = parts[2];
            const material = parts[3];
            const memberType = parts[4];
            const rawLen = parts[5];

            const qty = parseInt(rawQty, 10);
            const len = parseFloat(rawLen.replace(/[^\d.]/g, ''));
            
            if (!isNaN(qty) && qty > 0) {
                // Update sections based on level
                if (level && level !== currentSection) {
                    currentSection = level;
                    currentSubSection = 'General';
                }
                
                // Extract dims/grade from material if possible
                let item = material || memberType || 'Unknown';
                let dims = '';
                const dimMatch = item.match(DIMENSION_X_REGEX);
                if (dimMatch) {
                    dims = dimMatch[0].replace(/\s+/g, '').toUpperCase();
                    item = item.replace(dimMatch[0], '').trim();
                }
                let grade = '';
                const gradeMatch = item.match(GRADE_REGEX);
                if (gradeMatch) {
                    grade = gradeMatch[0];
                    item = item.replace(gradeMatch[0], '').trim();
                }

                const trace: ParsingTrace = { stepLog: ['Revit CSV Specialized Parse'], appliedRules: [], extraction: [] };
                parsedData.push(createLine(currentCategory, currentSection, currentSubSection, finalizeItem(`${item} (${instance})`), dims, grade, qty, len, 'L/M', qty * len, lineObj.text, lineObj, 'explicit_columns', trace, fuse, normalizedCatalog, catalogByCode, learnedMappings));
                continue;
            }
        }
    }

    line = cleanupLine(line, profile);

    const trace: ParsingTrace = { stepLog: [], appliedRules: [], extraction: [] };
    if (line.length === 0) continue;
    if (HARD_IGNORE_PATTERN.test(line)) continue;
    if (looksLikeFcSpecLine(line) && !hasNewItemQtyToken(line)) continue;
    let matchedIgnore = false;
    for (const rule of ignoreRules) { try { if (new RegExp(rule.pattern, 'i').test(line)) { matchedIgnore = true; break; } } catch { /* ignore invalid regex */ } }
    if (matchedIgnore) continue;
    let isIgnored = false;
    for (const pattern of profile.settings.ignorePatterns) { if (pattern.test(line)) { const isSummary = /Total|Subtotal|Summary/i.test(line); if (isSummary && profile.id === 'ezequote') { isIgnored = true; break; } if (isSummary && DIMENSION_X_REGEX.test(line)) continue; isIgnored = true; break; } }
    if (isIgnored || isSummaryLine(line)) continue;
    const notesHeaderMatch = line.match(/^(?:GENERAL|JOB|SITE|DELIVERY|PROJECT|COVER|ESTIMATOR|ADDITIONAL)\s+NOTES(?:[:-]|\s*$)/i) || line.match(/^NOTES[:-]/i);
    if (notesHeaderMatch) { if (flooringAcc) flushFlooringItem(); isNotesSection = true; currentSection = "General Notes"; const contentAfter = line.substring(notesHeaderMatch[0].length).trim(); if (contentAfter.length > 2) { const cleanedNote = cleanDescription(contentAfter); if (cleanedNote) notes.push(cleanedNote); } continue; }
    if (isNotesSection) {
        const isNewHeader = line.startsWith('#') || CATEGORY_REGEX.test(line) || /CONSTRUCTION\s+DETAILS|ERRORS\s+&\s+OMISSIONS|Page\s+\d+/i.test(line);
        const looksLikeTimberItem = DIMENSION_X_REGEX.test(line) && (SLASH_QTY_LEN_REGEX.test(line) || GRADE_REGEX.test(line) || /qty|count/i.test(line));
        if (isNewHeader || (looksLikeTimberItem && line.length < 80)) isNotesSection = false; else { const cleaned = cleanDescription(line); if (cleaned.length > 3 && !/^\d+$/.test(cleaned) && !/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(cleaned) && !/Builder:|Client:|Project:|Address:/i.test(line)) notes.push(cleaned); continue; }
    }
    const headerMatch = line.match(CATEGORY_REGEX);
    if (headerMatch && (lineObj.rect && lineObj.rect[0] < LEFT_COLUMN_THRESHOLD)) {
        if (flooringAcc) flushFlooringItem();
        const headerPart = headerMatch[0]; const cleanHeader = headerPart.trim();
        if (cleanHeader.length > 2) { currentSubSection = cleanHeader; if (/JAMB|STUD|NOGGING|PLATE|RAFTER|LINTEL/i.test(currentSubSection)) { lastItem = 'PINE'; lastGrade = 'MGP10'; } else { lastItem = ''; lastDims = ''; lastGrade = ''; } const remaining = line.substring(headerPart.length).trim(); if (remaining.length > 0) line = remaining; else continue; }
    }
    if (line.startsWith('#') || (lineObj.rect && lineObj.rect[0] < 50 && line.includes('#') && line.indexOf('#') < 3)) { if (flooringAcc) flushFlooringItem(); const cleanSection = line.replace(/#/g, '').trim().replace(/^[\s:\-.,;+]+|[\s:\-.,;+]+$/g, '').trim(); if (cleanSection.length > 2) { currentSection = cleanSection; currentSubSection = 'General'; isSkippingSection = false; isNotesSection = /NOTES/i.test(cleanSection); lastItem = ''; lastDims = ''; lastGrade = ''; continue; } }
    
    let matchedProfileHeader = false;
    if (profile.settings.sectionHeaderPatterns && profile.settings.sectionHeaderPatterns.length > 0) {
        for (const pattern of profile.settings.sectionHeaderPatterns) {
            if (pattern.test(line)) {
                if (flooringAcc) flushFlooringItem();
                const cleanSection = line.trim();
                if (cleanSection.length > 2) {
                    currentSection = cleanSection;
                    currentSubSection = 'General';
                    isSkippingSection = false;
                    isNotesSection = /NOTES/i.test(cleanSection);
                    lastItem = ''; lastDims = ''; lastGrade = '';
                    matchedProfileHeader = true;
                    break;
                }
            }
        }
    }
    if (matchedProfileHeader) continue;

    const isStartedInFirstColumn = (lineObj.rect && lineObj.rect[0] < LEFT_COLUMN_THRESHOLD);
    if (isStartedInFirstColumn && line.includes('   ')) {
        const parts = line.split('   '); const col1 = parts[0].trim(); const colRemainder = parts.slice(1).join(' ').trim();
        if (DIMENSION_X_REGEX.test(colRemainder) && !DIMENSION_X_REGEX.test(col1) && col1.length > 2 && !hasDataIndicator(col1)) {
            let finalSubSectionName = col1; const renameRule = sectionRenameRules.find(r => r.pattern === col1);
            if (renameRule && renameRule.replacement) finalSubSectionName = renameRule.replacement;
            if (finalSubSectionName !== currentSubSection) { if (flooringAcc) flushFlooringItem(); currentSubSection = finalSubSectionName; if (/JAMB|STUD|NOGGING|PLATE|RAFTER|LINTEL/i.test(currentSubSection)) { lastItem = 'PINE'; lastGrade = 'MGP10'; } else { lastItem = ''; lastDims = ''; lastGrade = ''; } }
            line = colRemainder; 
        }
    } else if (isStartedInFirstColumn) {
        const dimXMatch = line.match(DIMENSION_X_REGEX); const dimSpaceMatch = line.match(DIMENSION_SPACE_REGEX);
        const firstDimIdx = dimXMatch && dimSpaceMatch ? Math.min(dimXMatch.index!, dimSpaceMatch.index!) : dimXMatch ? dimXMatch.index! : dimSpaceMatch ? dimSpaceMatch.index! : -1;
        if (firstDimIdx > 2 && hasDataIndicator(line)) {
            const prefix = line.substring(0, firstDimIdx).trim();
            if (prefix.length >= 3 && prefix.length <= 35 && /^[A-Z\s&/\-().]+$/.test(prefix) && !/\b(PINE|LVL|MGP|OSB|BRACE|BOARD|SHEET)\b/i.test(prefix)) { currentSubSection = prefix; line = line.substring(firstDimIdx).trim(); }
        }
    }
    if (line.toUpperCase().includes('BY OTHERS')) { if (!DIMENSION_X_REGEX.test(line) && !SLASH_QTY_LEN_REGEX.test(line)) { isSkippingSection = true; currentSubSection = line; isNotesSection = false; } continue; }
    if (isSkippingSection) continue;
    const inFlooring = /FLOORING/i.test(currentSection) || /FLOORING/i.test(currentSubSection);
    if (inFlooring) {
        const qtyMatch = line.match(FLOORING_QTY_GATE_REGEX);
        if (qtyMatch) { flushFlooringItem(); const extractedQty = parseInt(qtyMatch[1], 10); flooringAcc = { section: currentSection, subSection: currentSubSection, qty: extractedQty, unit: 'EA', textParts: [], lineObj: lineObj, originalLines: [line] }; if (flooringOrphans.length > 0) { const orphanText = flooringOrphans.join(' '); if (/(JH\+)|(INTERNAL)|(WA)/i.test(orphanText) || DIMENSION_X_REGEX.test(orphanText)) flooringAcc.textParts.push(orphanText); flooringOrphans = []; } flooringAcc.textParts.push(line.replace(qtyMatch[0], '').trim()); } else { if (flooringAcc) { flooringAcc.textParts.push(line); flooringAcc.originalLines.push(line); } else flooringOrphans.push(line); } continue;
    } else { if (flooringAcc) flushFlooringItem(); flooringOrphans = []; }
    const determineUnit = (fallback: 'L/M' | 'EA' | 'm2'): 'L/M' | 'EA' | 'm2' => { const override = unitOverrideRules.find(r => r.type === 'unit_override' && (currentSection.includes(r.pattern) || currentSubSection.includes(r.pattern))); return (override && override.unit) ? override.unit : fallback; };
    if (BRACING_FORCE_ORPHAN_REGEX.test(line) && !hasDataIndicator(line)) { bracingOrphans.push(lineObj); continue; }
    let lineWithoutData = line; let dims = ''; const allDimMatches = [...lineWithoutData.matchAll(new RegExp(DIMENSION_X_REGEX, 'g'))];
    const bestXMatch = allDimMatches.length > 0 ? (allDimMatches.find(m => /[xX]/.test(m[0])) || allDimMatches[0]) : null;
    if (bestXMatch) { dims = bestXMatch[0].replace(/\s+/g, '').toUpperCase(); lineWithoutData = lineWithoutData.replace(bestXMatch[0], ''); }
    else { const spaceDimMatch = lineWithoutData.match(DIMENSION_SPACE_REGEX); if (spaceDimMatch) { dims = `${spaceDimMatch[1]}x${spaceDimMatch[2]}`; lineWithoutData = lineWithoutData.replace(spaceDimMatch[0], ''); } }
    const dimOverride = dimRules.find(r => line.includes(r.pattern) || new RegExp(r.pattern, 'i').test(line));
    if (dimOverride && dimOverride.replacement) dims = dimOverride.replacement;
    let grade = ''; const gradeMatch = lineWithoutData.match(GRADE_REGEX);
    if (gradeMatch) { grade = gradeMatch[0]; lineWithoutData = lineWithoutData.replace(gradeMatch[0], ''); }
    const gradeOverride = gradeRules.find(r => line.includes(r.pattern) || new RegExp(r.pattern, 'i').test(line));
    if (gradeOverride && gradeOverride.replacement) grade = gradeOverride.replacement;
    let explicitLength: number | null = null; const atLengthMatch = lineWithoutData.match(AT_LENGTH_REGEX);
    if (atLengthMatch) { explicitLength = parseFloat(atLengthMatch[1]); if (explicitLength > 50) explicitLength = explicitLength / 1000; lineWithoutData = lineWithoutData.replace(atLengthMatch[0], ''); }
    let explicitQty: number | null = null; let extractedUnit: 'L/M' | 'EA' | 'm2' | null = null;
    const candidates = [ { match: getRightmostMatch(line, ONLY_REGEX), unit: 'EA' as const }, { match: getRightmostMatch(line, SHEETS_TUBES_REGEX), unit: 'EA' as const }, { match: getRightmostMatch(line, LM_REGEX), unit: 'L/M' as const }, { match: getRightmostMatch(line, AREA_REGEX), unit: 'm2' as const } ].filter(c => c.match).sort((a, b) => (b.match!.index || 0) - (a.match!.index || 0));
    if (candidates.length > 0) { const best = candidates[0]; explicitQty = parseFloat(best.match![1]); extractedUnit = best.unit; lineWithoutData = lineWithoutData.replace(best.match![0], ''); }
    const slashMatches = [...lineWithoutData.matchAll(SLASH_QTY_LEN_REGEX)];
    const foundCuts = slashMatches.length > 0; if (foundCuts) lineWithoutData = lineWithoutData.replace(SLASH_QTY_LEN_REGEX, '');
    const trailingNumsMatch = lineWithoutData.match(/((?:\s+\d+(?:\.\d+)?)+)$/);
    if (trailingNumsMatch) {
        const potentialNums = trailingNumsMatch[1].trim().split(/\s+/);
        // If the last part of the line looks like a dimension, don't treat it as trailing numbers for qty/len
        if (potentialNums.some(n => looksLikeDimension(n))) {
            // Do nothing, keep it as part of the description for now
        } else {
            lineWithoutData = lineWithoutData.substring(0, lineWithoutData.length - trailingNumsMatch[1].length).trim();
        }
    }
    let itemToUse = line.includes('   ') ? (line.split('   ').filter(Boolean).length >= 3 ? `${line.split('   ').filter(Boolean)[1]} ${line.split('   ').filter(Boolean)[0]}` : cleanDescription(lineWithoutData)) : cleanDescription(lineWithoutData);
    let fullLineForTrace = line;
    if (bracingOrphans.length > 0 && (hasDataIndicator(line) || BRACING_FORCE_ORPHAN_REGEX.test(itemToUse))) { const orphanText = bracingOrphans.map(o => o.text).join(' '); itemToUse = `${orphanText} ${itemToUse}`.trim(); fullLineForTrace = `${orphanText} ${line}`.trim(); bracingOrphans = []; }
    if (!itemToUse || itemToUse.length < 2) { const normGrd = grade.toUpperCase().replace(/\s+/g, ''); if (normGrd === 'MGP10' || normGrd === 'MGP12') itemToUse = 'PINE'; else if (grade) itemToUse = grade; else if (dims) itemToUse = dims; else itemToUse = ''; }
    let isContinued = false; const hasData = foundCuts || !!trailingNumsMatch || explicitQty !== null || explicitLength !== null || line.match(LM_REGEX) || line.match(AREA_REGEX) || line.match(/\bQTY\s*\d+\b/i);
    if (hasData) {
        let lookaheadIdx = i + 1;
        while (lookaheadIdx < textLines.length) {
            const nextLineObj = textLines[lookaheadIdx]; const nextText = nextLineObj.text.trim();
            if (!nextText || nextText.length < 2 || HARD_IGNORE_PATTERN.test(nextText) || isSummaryLine(nextText) || hasNewItemQtyToken(nextText) || isHeaderOrSubHeader(nextLineObj, nextText) || (/^[A-Z\s&/\-().]+$/.test(nextText) && !/\d/.test(nextText) && nextText.length > 3)) break;
            if (isContinuationCandidate(nextText)) { const chunk = cleanDescription(nextText); if (chunk) { itemToUse = `${itemToUse} ${chunk}`.trim(); fullLineForTrace = `${fullLineForTrace} ${nextText}`.trim(); isContinued = true; } i = lookaheadIdx; lookaheadIdx++; } else break;
        }
    }
    if (itemToUse.length > 0 && hasData) { if (dims) lastDims = dims; if (grade) lastGrade = grade; lastItem = itemToUse; }
    else { dims = dims || lastDims; grade = grade || lastGrade; if (!lastItem && /JAMB|STUD|NOGGING|PLATE|RAFTER|LINTEL/i.test(currentSubSection)) { lastItem = 'PINE'; lastGrade = 'MGP10'; grade = 'MGP10'; } }
    let handled = false;
    if (trailingNumsMatch && explicitQty !== null && !foundCuts) {
        const nums = trailingNumsMatch[1].trim().split(/\s+/).map(Number);
        if (nums.length === 2) {
            if (extractedUnit === 'L/M' || extractedUnit === 'm2') {
                parsedData.push(createLine(currentCategory, currentSection, currentSubSection, finalizeItem(itemToUse || lastItem), dims, grade, nums[0], nums[1], determineUnit(extractedUnit || 'L/M'), explicitQty, fullLineForTrace, lineObj, 'pattern_match', trace, fuse, normalizedCatalog, catalogByCode, learnedMappings, isContinued));
                handled = true;
            } else if (extractedUnit === 'EA') {
                parsedData.push(createLine(currentCategory, currentSection, currentSubSection, finalizeItem(itemToUse || lastItem), dims, grade, nums[0], nums[1], determineUnit('EA'), nums[0], fullLineForTrace, lineObj, 'pattern_match', trace, fuse, normalizedCatalog, catalogByCode, learnedMappings, isContinued));
                handled = true;
            }
        } else if (nums.length === 1 && extractedUnit === 'EA') {
            parsedData.push(createLine(currentCategory, currentSection, currentSubSection, finalizeItem(itemToUse || lastItem), dims, grade, nums[0], explicitQty, determineUnit('EA'), nums[0], fullLineForTrace, lineObj, 'pattern_match', trace, fuse, normalizedCatalog, catalogByCode, learnedMappings, isContinued));
            handled = true;
        } else if (nums.length === 1 && extractedUnit === 'L/M') {
            parsedData.push(createLine(currentCategory, currentSection, currentSubSection, finalizeItem(itemToUse || lastItem), dims, grade, nums[0], explicitQty, determineUnit('L/M'), nums[0] * explicitQty, fullLineForTrace, lineObj, 'pattern_match', trace, fuse, normalizedCatalog, catalogByCode, learnedMappings, isContinued));
            handled = true;
        }
    }
    if (handled) continue;

    if (extractedUnit === 'L/M' && explicitQty !== null && !foundCuts) { parsedData.push(createLine(currentCategory, currentSection, currentSubSection, finalizeItem(itemToUse || lastItem), dims, grade, 1, explicitQty, determineUnit('L/M'), explicitQty, fullLineForTrace, lineObj, 'pattern_match', trace, fuse, normalizedCatalog, catalogByCode, learnedMappings, isContinued)); continue; }
    if (extractedUnit === 'm2' && explicitQty !== null && !foundCuts) { parsedData.push(createLine(currentCategory, currentSection, currentSubSection, finalizeItem(itemToUse || lastItem), dims, grade, 1, explicitQty, determineUnit('m2'), explicitQty, fullLineForTrace, lineObj, 'pattern_match', trace, fuse, normalizedCatalog, catalogByCode, learnedMappings, isContinued)); continue; }
    if (explicitQty !== null && !foundCuts) { parsedData.push(createLine(currentCategory, currentSection, currentSubSection, finalizeItem(itemToUse || lastItem), dims, grade, explicitQty, explicitLength, determineUnit('EA'), explicitQty, fullLineForTrace, lineObj, 'pattern_match', trace, fuse, normalizedCatalog, catalogByCode, learnedMappings, isContinued)); continue; }
    if (foundCuts) { slashMatches.forEach(m => { const qty = parseInt(m[1], 10); const len = parseFloat(m[2]); parsedData.push(createLine(currentCategory, currentSection, currentSubSection, finalizeItem(itemToUse || lastItem), dims, grade, qty, len, determineUnit('L/M'), qty * len, fullLineForTrace, lineObj, 'pattern_match', trace, fuse, normalizedCatalog, catalogByCode, learnedMappings, isContinued)); }); continue; }
    if (trailingNumsMatch) {
        const nums = trailingNumsMatch[1].trim().split(/\s+/).map(Number);
        if (nums.length >= 3 && nums.length % 2 !== 0) {
            let calcTotal = 0; for (let j = 0; j < nums.length - 1; j += 2) calcTotal += (nums[j] * nums[j+1]);
            if (Math.abs(calcTotal - nums[nums.length - 1]) < 0.1) { for (let j = 0; j < nums.length - 1; j += 2) parsedData.push(createLine(currentCategory, currentSection, currentSubSection, finalizeItem(itemToUse || lastItem), dims, grade, nums[j], nums[j+1], determineUnit('L/M'), nums[j] * nums[j+1], fullLineForTrace, lineObj, 'pattern_match', trace, fuse, normalizedCatalog, catalogByCode, learnedMappings, isContinued)); continue; }
        } else if (nums.length === 2) {
            parsedData.push(createLine(currentCategory, currentSection, currentSubSection, finalizeItem(itemToUse || lastItem), dims, grade, nums[0], nums[1], determineUnit('L/M'), nums[0] * nums[1], fullLineForTrace, lineObj, 'pattern_match', trace, fuse, normalizedCatalog, catalogByCode, learnedMappings, isContinued)); continue;
        }
    }
  }
  if (flooringAcc) flushFlooringItem();
  return { items: parsedData, notes, errors };
};