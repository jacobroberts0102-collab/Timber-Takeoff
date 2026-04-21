import { ParsedLine } from '../types';

export interface DiffRow {
  key: string;
  section: string;
  item: string;
  desc: string;
  qtyA: number;
  qtyB: number;
  diff: number;
  status: 'added' | 'removed' | 'changed' | 'unchanged';
}

export const calculateDiff = (rowsA: ParsedLine[], rowsB: ParsedLine[]): DiffRow[] => {
    // Helper to generate a unique key for comparison
    const getKey = (row: ParsedLine) => `${row.section}|${row.item}|${row.dimensions}|${row.grade}`;
    const getDesc = (row: ParsedLine) => `${row.dimensions} ${row.grade} ${row.unit}`;

    const mapA = new Map<string, { qty: number, row: ParsedLine }>();
    const mapB = new Map<string, { qty: number, row: ParsedLine }>();

    // Aggregate A (Old)
    rowsA.forEach(row => {
        const key = getKey(row);
        const existing = mapA.get(key)?.qty || 0;
        mapA.set(key, { qty: existing + row.total, row });
    });

    // Aggregate B (New)
    rowsB.forEach(row => {
        const key = getKey(row);
        const existing = mapB.get(key)?.qty || 0;
        mapB.set(key, { qty: existing + row.total, row });
    });

    const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
    const results: DiffRow[] = [];

    allKeys.forEach(key => {
        const entryA = mapA.get(key);
        const entryB = mapB.get(key);
        
        const qtyA = entryA?.qty || 0;
        const qtyB = entryB?.qty || 0;
        const diff = qtyB - qtyA;
        
        // Use the row definition from B if avail, else A
        const def = entryB?.row || entryA!.row;

        let status: DiffRow['status'] = 'unchanged';
        if (!entryA && entryB) status = 'added';
        else if (entryA && !entryB) status = 'removed';
        else if (diff !== 0) status = 'changed';

        if (status !== 'unchanged') {
            results.push({
                key,
                section: def.section,
                item: def.item,
                desc: getDesc(def),
                qtyA,
                qtyB,
                diff,
                status
            });
        }
    });

    return results.sort((a, b) => a.section.localeCompare(b.section) || a.item.localeCompare(b.item));
};

export const generateDiffCsv = (diffData: DiffRow[], nameA: string, nameB: string): string => {
    const csvData = diffData.map(d => ({
        Status: d.status,
        Section: d.section,
        Item: d.item,
        Description: d.desc,
        [`${nameA} (Old)`]: d.qtyA,
        [`${nameB} (New)`]: d.qtyB,
        Difference: d.diff
    }));
    
    if (csvData.length === 0) return '';

    const headers = Object.keys(csvData[0]).join(',');
    const rows = csvData.map(obj => Object.values(obj).map(v => `"${v}"`).join(',')).join('\n');
    return `${headers}\n${rows}`;
};