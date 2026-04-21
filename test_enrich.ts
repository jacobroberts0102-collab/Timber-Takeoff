import { BONE_TIMBER_DEFAULTS } from './services/defaultCatalog.ts';
import { enrichCatalogProduct } from './services/storage.ts';

const first = BONE_TIMBER_DEFAULTS[0];
console.log(first);
const enriched = enrichCatalogProduct(first);
console.log(enriched);
