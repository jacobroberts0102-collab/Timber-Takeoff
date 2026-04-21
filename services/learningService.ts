import { ParserRule, MemoryItem } from '../types';
import { storageService } from './storage';
import { SEED_LEARNED_MAPPINGS } from './seedLearnedMappings';
import { buildLookupKey, normalizeWhitespace } from '../utils/learnedKey';

const STORAGE_KEY = 'parser_rules_v1';

export const learningService = {
  getRules: (): ParserRule[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Failed to load parser rules", e);
      return [];
    }
  },

  addRule: (rule: ParserRule) => {
    const rules = learningService.getRules();
    // Avoid exact duplicates
    const exists = rules.some(r => 
        r.type === rule.type && 
        r.pattern === rule.pattern && 
        r.profileId === rule.profileId &&
        r.replacement === rule.replacement &&
        r.unit === rule.unit
    );
    
    if (!exists) {
        const newRules = [...rules, rule];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newRules));
    }
  },

  updateRule: (rule: ParserRule) => {
    const rules = learningService.getRules();
    const index = rules.findIndex(r => r.id === rule.id);
    if (index !== -1) {
        rules[index] = rule;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
    }
  },

  deleteRule: (id: string) => {
    const rules = learningService.getRules();
    const filtered = rules.filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  },

  importRules: (jsonString: string): number => {
      try {
          const imported = JSON.parse(jsonString) as ParserRule[];
          if (!Array.isArray(imported)) throw new Error("Invalid format");
          
          const current = learningService.getRules();
          let count = 0;
          
          imported.forEach(rule => {
              if (rule.id && rule.type && rule.pattern && rule.profileId) {
                  // Check duplicate by ID or Content
                  const exists = current.some(r => r.id === rule.id || (
                      r.type === rule.type && r.pattern === rule.pattern && r.profileId === rule.profileId
                  ));
                  
                  if (!exists) {
                      current.push(rule);
                      count++;
                  }
              }
          });
          
          localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
          return count;
      } catch (e) {
          console.error(e);
          throw new Error("Failed to import rules", { cause: e });
      }
  },

  exportRules: (): string => {
      const rules = learningService.getRules();
      return JSON.stringify(rules, null, 2);
  },

  /**
   * Seeds the App Memory (Learned Mappings) with entries from the codebase seed file.
   * Only adds mappings that are missing from the current IndexedDB store.
   */
  async seedLearnedMappingsIfMissing(): Promise<number> {
    try {
      const currentMappings = await storageService.getLearnedMappings();
      const existingKeys = new Set(currentMappings.map(m => m.lookupKey));
      let seededCount = 0;

      for (const seed of SEED_LEARNED_MAPPINGS) {
        let namePart: string;
        let dimsPart: string;

        // Backwards compatibility: Handle legacy "NAME|DIMS" strings
        if (seed.takeoffItemName.includes('|')) {
          const parts = seed.takeoffItemName.split('|');
          namePart = parts[0] || "";
          dimsPart = parts[1] || "";
        } else {
          namePart = seed.takeoffItemName;
          dimsPart = seed.dimensions || "";
        }
        
        // Minimal normalization for display consistency: fix symbols and spacing but keep casing
        const displayDims = dimsPart
          .replace(/×/g, 'x')
          .replace(/\s*x\s*/gi, 'x')
          .trim();

        const normKey = buildLookupKey(namePart, displayDims);

        if (!existingKeys.has(normKey)) {
          const memoryItem: MemoryItem = {
            lookupKey: normKey,
            displayName: normalizeWhitespace(namePart),
            dimensions: displayDims,
            itemNo: seed.itemNo,
            description: seed.description
          };

          await storageService.saveLearnedMapping(memoryItem);
          seededCount++;
        }
      }

      if (seededCount > 0) {
        console.log(`Seeded ${seededCount} learned mappings from codebase.`);
      }
      return seededCount;
    } catch (e) {
      console.error("Seeding learned mappings failed", e);
      return 0;
    }
  }
};