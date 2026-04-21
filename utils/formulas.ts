import { ParsedLine } from '../types';

export const evaluateFormula = (formula: string, row: ParsedLine): number | null => {
    if (!formula || !formula.startsWith('=')) return null;

    try {
        const expression = formula.substring(1).toUpperCase();
        
        // Replace keywords with row values
        const sanitized = expression
            .replace(/QTY/g, String(row.qty || 0))
            .replace(/LEN/g, String(row.length || 0))
            .replace(/LENGTH/g, String(row.length || 0))
            .replace(/PRICE/g, String(row.price || 0));

        // Basic math evaluation (safe-ish for this context)
        // We use Function constructor as a simple evaluator for math expressions
        // In a production app, a proper math parser like mathjs would be better
        const result = new Function(`return ${sanitized}`)();
        
        return typeof result === 'number' && isFinite(result) ? result : null;
    } catch (e) {
        console.error('Formula evaluation error:', e);
        return null;
    }
};
