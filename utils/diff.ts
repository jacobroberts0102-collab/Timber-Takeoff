import { ParsedLine } from '../types';

export interface DiffResult {
    added: ParsedLine[];
    removed: ParsedLine[];
    modified: {
        original: ParsedLine;
        updated: ParsedLine;
        changes: (keyof ParsedLine)[];
    }[];
}

export const compareVersions = (oldData: ParsedLine[], newData: ParsedLine[]): DiffResult => {
    const result: DiffResult = {
        added: [],
        removed: [],
        modified: []
    };

    const oldMap = new Map(oldData.map(r => [r.id, r]));
    const newMap = new Map(newData.map(r => [r.id, r]));

    // Check for added and modified
    newData.forEach(newRow => {
        const oldRow = oldMap.get(newRow.id);
        if (!oldRow) {
            result.added.push(newRow);
        } else {
            const changes: (keyof ParsedLine)[] = [];
            const keysToCompare: (keyof ParsedLine)[] = ['item', 'qty', 'length', 'unit', 'spruceItemNo', 'dimensions', 'grade'];
            
            keysToCompare.forEach(key => {
                if (oldRow[key] !== newRow[key]) {
                    changes.push(key);
                }
            });

            if (changes.length > 0) {
                result.modified.push({
                    original: oldRow,
                    updated: newRow,
                    changes
                });
            }
        }
    });

    // Check for removed
    oldData.forEach(oldRow => {
        if (!newMap.has(oldRow.id)) {
            result.removed.push(oldRow);
        }
    });

    return result;
};
