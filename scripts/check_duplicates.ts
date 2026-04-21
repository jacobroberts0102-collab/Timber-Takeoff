
import fs from 'fs';
import path from 'path';

const content = fs.readFileSync(path.join(process.cwd(), 'services/defaultCatalog.ts'), 'utf8');
const lines = content.split('\n');

const lineCount = new Map<string, number[]>();

lines.forEach((l, i) => {
    const trimmed = l.trim();
    if (trimmed.startsWith('{ itemNo:')) {
        if (!lineCount.has(trimmed)) lineCount.set(trimmed, []);
        lineCount.get(trimmed)!.push(i + 1);
    }
});

let found = false;
lineCount.forEach((lines, lineContent) => {
    if (lines.length > 1) {
        found = true;
        console.log(`DUPLICATE LINE at lines ${lines.join(', ')}:\n  ${lineContent}`);
    }
});

if (!found) {
    console.log('No exact duplicate lines found.');
}
