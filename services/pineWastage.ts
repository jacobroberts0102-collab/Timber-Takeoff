import { ParsedLine, CatalogProduct, PineWastageRow, PineWastageSummary } from '../types';

const PINE_LENGTH_M = 6.0;

/**
 * Normalizes dimensions to a consistent key (e.g. 90x45)
 */
export const normalizeDims = (dims: string): string => {
    if (!dims) return 'NO_DIMS';
    const parts = dims.toLowerCase().match(/\d+/g);
    if (!parts || parts.length < 2) return 'NO_DIMS';
    const nums = parts.map(Number).sort((a, b) => b - a);
    return `${nums[0]}x${nums[1]}`;
};

/**
 * Checks if a line is a Pine requirement line.
 * REQUIREMENT: Only factor items matched to PIDRRDM.
 */
export const isPineRequirement = (l: ParsedLine): boolean => {
    // Exclusively track items matched to the generic code 'PIDRRDM'
    return l.spruceItemNo === 'PIDRRDM' && !!l.dimensions;
};

/**
 * Builds an index of suggested PINE products from the catalog
 */
const buildPineIndex = (catalog: CatalogProduct[]) => {
    const index = new Map<string, CatalogProduct[]>();
    
    catalog.forEach(p => {
        const isPineCode = p.itemNo.startsWith('PI');
        const isPineDesc = /PINE|MGP10/.test(p.description.toUpperCase());
        if (!(isPineCode || isPineDesc)) return;
        
        const key = normalizeDims(p.dimensions || p.description);
        if (key === 'NO_DIMS') return;
        
        if (!index.has(key)) index.set(key, []);
        index.get(key)!.push(p);
    });
    
    return index;
};

/**
 * Main calculation engine for Pine Wastage.
 * Calculates theoretical 6.0m stock orders based on takeoff requirements.
 */
export const computePineWastage = (linesAll: ParsedLine[], catalog: CatalogProduct[]): { rows: PineWastageRow[]; summary: PineWastageSummary } => {
    const pineIndex = buildPineIndex(catalog);
    const sourceRequirements = linesAll.filter(isPineRequirement);

    const dimsMap = new Map<string, { requiredLm: number, sourceLineIds: string[], dimsLabel: string }>();

    // 1. Group Requirements by Dimensions
    sourceRequirements.forEach(l => {
        const key = normalizeDims(l.dimensions);
        if (!dimsMap.has(key)) {
            dimsMap.set(key, { requiredLm: 0, sourceLineIds: [], dimsLabel: l.dimensions });
        }
        const entry = dimsMap.get(key)!;
        entry.requiredLm += l.total;
        entry.sourceLineIds.push(l.id);
    });

    // 2. Calculate Wastage Rows
    const rows: PineWastageRow[] = Array.from(dimsMap.entries()).map(([key, data]) => {
        const requiredLm = data.requiredLm;
        const lengths6m = Math.ceil(requiredLm / PINE_LENGTH_M);
        const suppliedLm = lengths6m * PINE_LENGTH_M;
        const offcutLm = Math.max(0, suppliedLm - requiredLm);
        const wastagePct = suppliedLm > 0 ? (offcutLm / suppliedLm) * 100 : 0;

        const candidates = pineIndex.get(key) || [];
        const item6m = candidates.find(p => p.description.includes('6.0m') || p.description.includes('6.0 M') || p.itemNo.endsWith('60'));

        return {
            dimsKey: key,
            dimsLabel: data.dimsLabel,
            totalLm: Number(requiredLm.toFixed(4)),
            lengths6m,
            suppliedLm: Number(suppliedLm.toFixed(4)),
            offcutLm: Number(offcutLm.toFixed(4)),
            wastagePct: Number(wastagePct.toFixed(2)),
            suggestedItemNo: item6m?.itemNo,
            suggestedDesc: item6m?.description,
            sourceLineIds: data.sourceLineIds
        };
    }).sort((a, b) => b.totalLm - a.totalLm);

    // 3. Final Summary
    const summary: PineWastageSummary = rows.reduce((acc, row) => ({
        totalLm: acc.totalLm + row.totalLm,
        totalLengths6m: acc.totalLengths6m + row.lengths6m,
        totalSuppliedLm: acc.totalSuppliedLm + row.suppliedLm,
        totalOffcutLm: acc.totalOffcutLm + row.offcutLm,
        overallWastagePct: 0
    }), { totalLm: 0, totalLengths6m: 0, totalSuppliedLm: 0, totalOffcutLm: 0, overallWastagePct: 0 });

    if (summary.totalSuppliedLm > 0) {
        summary.overallWastagePct = (summary.totalOffcutLm / summary.totalSuppliedLm) * 100;
    }

    return { rows, summary };
};
