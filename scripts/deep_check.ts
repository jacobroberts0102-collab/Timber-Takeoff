
import { BONE_TIMBER_DEFAULTS as defaultCatalog } from '../services/defaultCatalog';

const itemsByProps = new Map<string, string[]>();
const itemsByCanonicalItemNo = new Map<string, string[]>();

for (const item of defaultCatalog) {
    const propsKey = JSON.stringify({
        description: item.description,
        priceCents: item.priceCents,
        group: item.group,
        section: item.section
    });
    
    if (!itemsByProps.has(propsKey)) {
        itemsByProps.set(propsKey, []);
    }
    itemsByProps.get(propsKey)!.push(item.itemNo);
    
    const canonicalItemNo = item.itemNo.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!itemsByCanonicalItemNo.has(canonicalItemNo)) {
        itemsByCanonicalItemNo.set(canonicalItemNo, []);
    }
    itemsByCanonicalItemNo.get(canonicalItemNo)!.push(item.itemNo);
}

console.log('--- Identical Props (Different ItemNo) ---');
for (const [props, itemNos] of itemsByProps.entries()) {
    if (itemNos.length > 1) {
        console.log(`Props: ${props}`);
        console.log(`ItemNos: ${itemNos.join(', ')}`);
        console.log('---');
    }
}

console.log('--- Duplicate Canonical ItemNo ---');
for (const [canonical, itemNos] of itemsByCanonicalItemNo.entries()) {
    if (itemNos.length > 1) {
        console.log(`Canonical: ${canonical}`);
        console.log(`ItemNos: ${itemNos.join(', ')}`);
        console.log('---');
    }
}
