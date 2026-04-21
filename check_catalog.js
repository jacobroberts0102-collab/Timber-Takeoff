
import fs from 'fs';
const content = fs.readFileSync('services/defaultCatalog.ts', 'utf8');
const lines = content.split('\n');
const itemNos = lines
  .filter(line => line.includes('itemNo:'))
  .map(line => {
    const match = line.match(/itemNo: '([^']+)'/);
    return match ? match[1] : null;
  })
  .filter(Boolean);

console.log('Total itemNo lines:', itemNos.length);
const counts = {};
itemNos.forEach(no => {
  counts[no] = (counts[no] || 0) + 1;
});

const duplicates = Object.entries(counts).filter(([no, count]) => count > 1);
if (duplicates.length > 0) {
  console.log('Found duplicates:');
  duplicates.forEach(([no, count]) => {
    console.log(`${no}: ${count} times`);
  });
} else {
  console.log('No duplicates found.');
}
