import { ParsedLine } from '../types';

export interface Anomaly {
    rowId: string;
    field: keyof ParsedLine;
    message: string;
    severity: 'warning' | 'error';
}

export const detectRowAnomalies = (row: ParsedLine, allData: ParsedLine[] = [], precomputed?: { avgQty: number }): Anomaly[] => {
    const anomalies: Anomaly[] = [];
    
    // 1. Quantity Anomaly (Outlier)
    if (allData.length > 0 || precomputed?.avgQty !== undefined) {
        const avgQty = precomputed?.avgQty !== undefined 
            ? precomputed.avgQty 
            : allData.reduce((acc, r) => acc + (r.qty || 0), 0) / allData.length;

        if (row.qty > avgQty * 10 && row.qty > 50) {
            anomalies.push({
                rowId: row.id,
                field: 'qty',
                message: `High quantity outlier (${row.qty} vs avg ${avgQty.toFixed(1)})`,
                severity: 'warning'
            });
        }
    }

    // 2. Length Anomaly (Unrealistic for timber)
    if (row.length && row.length > 15) {
        anomalies.push({
            rowId: row.id,
            field: 'length',
            message: `Unusually long length (${row.length}m). Standard max is ~6-7m.`,
            severity: 'error'
        });
    }

    // 3. Unit Mismatch (e.g. 100m for EA)
    if (row.unit === 'EA' && row.length && row.length > 10) {
        anomalies.push({
            rowId: row.id,
            field: 'unit',
            message: `Unit is 'EA' but length is ${row.length}m. Should this be 'L/M'?`,
            severity: 'warning'
        });
    }

    // 4. Missing Catalog Match
    if (!row.spruceMapped && !row.isNew) {
        anomalies.push({
            rowId: row.id,
            field: 'spruceItemNo',
            message: 'No catalog match found for this item.',
            severity: 'warning'
        });
    }

    // 5. Dimension Format
    if (row.dimensions && !/\d+x\d+/.test(row.dimensions)) {
        anomalies.push({
            rowId: row.id,
            field: 'dimensions',
            message: 'Dimensions format looks non-standard (expected WxH).',
            severity: 'warning'
        });
    }

    return anomalies;
};

export const detectAnomalies = (data: ParsedLine[]): Anomaly[] => {
    return data.flatMap(row => detectRowAnomalies(row, data));
};
