import { storageService } from './services/storage.ts';
import { BONE_TIMBER_DEFAULTS } from './services/defaultCatalog.ts';

console.log("BONE_TIMBER_DEFAULTS length:", BONE_TIMBER_DEFAULTS.length);

async function run() {
  const catalog = await storageService.getCatalog();
  console.log("getCatalog length:", catalog.length);
  if (catalog.length > 0) {
    console.log("First item:", catalog[0]);
  }
}

run().catch(console.error);
