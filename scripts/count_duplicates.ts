
import { BONE_TIMBER_DEFAULTS } from '../services/defaultCatalog';

const counts = new Map<string, number>();
const caseInsensitiveCounts = new Map<string, string[]>();

for (const item of BONE_TIMBER_DEFAULTS) {
    const itemNo = item.itemNo;
    counts.set(itemNo, (counts.get(itemNo) || 0) + 1);
    
    const lower = itemNo.toLowerCase();
    if (!caseInsensitiveCounts.has(lower)) {
        caseInsensitiveCounts.set(lower, []);
    }
    caseInsensitiveCounts.get(lower)!.push(itemNo);
}

console.log('--- Case-Sensitive Duplicates ---');
for (const [itemNo, count] of counts.entries()) {
    if (count > 1) {
        console.log(`${itemNo}: ${count}`);
    }
}

console.log('--- Case-Insensitive (but distinct strings) Duplicates ---');
for (const [lower, itemNos] of caseInsensitiveCounts.entries()) {
    const uniqueItems = new Set(itemNos);
    if (uniqueItems.size > 1) {
        console.log(`${lower}: ${itemNos.join(', ')}`);
    }
}

console.log(`Total items: ${BONE_TIMBER_DEFAULTS.length}`);
console.log(`Unique items (case-sensitive): ${counts.size}`);
console.log(`Unique items (case-insensitive): ${caseInsensitiveCounts.size}`);
