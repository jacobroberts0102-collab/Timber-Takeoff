import { parseTakeoff } from './services/parser.ts';
import { BONE_TIMBER_DEFAULTS } from './services/defaultCatalog.ts';
import { enrichCatalogProduct } from './services/storage.ts';
import { GenericCADProfile } from './services/profiles.ts';

const lines = [
    { text: "Item     Description     Qty     Length", page: 1 },
    { text: "1.0      90x45 MGP10 Pine         10      4.8", page: 1 }
];
const enrichedCatalog = BONE_TIMBER_DEFAULTS.map(p => enrichCatalogProduct({...p, isSystem: true}));
const output = parseTakeoff(lines, GenericCADProfile, [], enrichedCatalog, new Map());
console.log(JSON.stringify(output.items[0], null, 2));
