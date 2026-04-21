import { ParsedLine, OptimizationGroup, StockBin, CutItem } from '../types';

export const DEFAULT_STOCK_LENGTHS = [2.4, 2.7, 3.0, 3.6, 4.2, 4.8, 5.4, 6.0];
export const DEFAULT_KERF = 4; // 4mm saw blade width

/**
 * Prepares raw data into groups suitable for optimization.
 * Groups by Dimensions + Grade.
 */
export const groupForOptimization = (data: ParsedLine[]): Map<string, ParsedLine[]> => {
    const groups = new Map<string, ParsedLine[]>();

    data.forEach(row => {
        // Only include items that are Linear Metres or items with explicit length
        // Exclude m2 (Area) items as they aren't linear cuts
        if (row.unit === 'm2') return;
        if (row.unit === 'EA' && (!row.length || row.length <= 0)) return;
        if (!row.length) return;

        const key = `${row.dimensions} ${row.grade}`.trim();
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(row);
    });

    return groups;
};

/**
 * Converts a ParsedLine into individual CutItems (e.g. Qty 5 @ 3.0m becomes 5 separate items)
 */
const expandCuts = (rows: ParsedLine[]): CutItem[] => {
    const cuts: CutItem[] = [];
    rows.forEach(row => {
        if (!row.length) return;
        for (let i = 0; i < row.qty; i++) {
            cuts.push({
                id: `${row.id}_${i}`,
                length: row.length,
                description: row.item,
                section: row.section,
                originalRef: row
            });
        }
    });
    return cuts;
};

/**
 * Core Algorithm: Best Fit Decreasing with Post-Optimization Shrinking
 * 
 * 1. Sort cuts largest to smallest.
 * 2. Place cuts into bins. When creating a new bin, assume MAX stock length 
 *    to allow future cuts to fit.
 * 3. After placing all cuts, shrink the bins to the smallest available stock 
 *    length that fits the content.
 */
export const optimizeGroup = (
    groupKey: string, 
    rows: ParsedLine[], 
    availableStock: number[], 
    kerfMm: number
): OptimizationGroup => {
    const sortedStock = [...availableStock].sort((a, b) => a - b);
    const maxStock = sortedStock[sortedStock.length - 1];
    const kerfM = kerfMm / 1000;

    // 1. Expand and Sort Cuts (Descending)
    const cuts = expandCuts(rows);
    cuts.sort((a, b) => b.length - a.length);

    const bins: StockBin[] = [];
    const unplaceable: CutItem[] = []; // Should technically not happen if maxStock > cut

    // 2. Allocation Phase
    for (const cut of cuts) {
        if (cut.length > maxStock) {
            unplaceable.push(cut); // Cut is longer than longest board
            continue;
        }

        let bestBinIndex = -1;

        // Try to fit in existing bins
        for (let i = 0; i < bins.length; i++) {
            const bin = bins[i];
            const currentUsed = bin.usedLength;
            // Check if fits: Current + Kerf + NewCut <= MaxStock
            // Note: We check against MaxStock during allocation, shrink later
            const needed = (currentUsed > 0 ? kerfM : 0) + cut.length;
            
            if (currentUsed + needed <= bin.stockLength) {
                bestBinIndex = i;
                break; 
            }
        }

        if (bestBinIndex !== -1) {
            // Add to existing bin
            const bin = bins[bestBinIndex];
            bin.usedLength += (bin.usedLength > 0 ? kerfM : 0) + cut.length;
            bin.cuts.push(cut);
        } else {
            // Create new bin
            // Initialize with MAX stock length to keep options open
            bins.push({
                id: crypto.randomUUID(),
                stockLength: maxStock,
                cuts: [cut],
                usedLength: cut.length,
                waste: 0 // Calc later
            });
        }
    }

    // 3. Shrink Phase & Calculate Stats
    let totalStockLength = 0;
    const orderMap = new Map<number, number>();

    bins.forEach(bin => {
        // Find smallest stock that fits usedLength
        const actualStock = sortedStock.find(s => s >= bin.usedLength);
        
        if (actualStock) {
            bin.stockLength = actualStock;
            bin.waste = actualStock - bin.usedLength;
            totalStockLength += actualStock;
            
            const currentCount = orderMap.get(actualStock) || 0;
            orderMap.set(actualStock, currentCount + 1);
        }
    });

    const totalRequired = cuts.reduce((sum, c) => sum + c.length, 0);
    const totalWaste = totalStockLength - totalRequired; // Simple waste calc (Stock - Net Product)

    // Handle Unplaceable (treat as special bins with 0 waste but flagged?)
    // For now, we ignore them in the bin list but they affect totals logic?
    // In reality, user needs to special order. We won't include them in 'bins' but logs warning.

    // Extract meta from first row
    const first = rows[0];
    
    return {
        key: groupKey,
        dimensions: first.dimensions,
        grade: first.grade,
        unit: first.unit,
        totalRequiredLength: totalRequired,
        bins: bins,
        totalStockLength: totalStockLength,
        totalWaste: totalWaste,
        wastePercentage: totalStockLength > 0 ? (totalWaste / totalStockLength) * 100 : 0,
        orderList: Array.from(orderMap.entries())
            .map(([length, count]) => ({ length, count }))
            .sort((a, b) => b.length - a.length)
    };
};
