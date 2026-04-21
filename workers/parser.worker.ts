import { parseTakeoff } from '../services/parser';

self.onmessage = (e: MessageEvent) => {
  const { lines, profile, rules, catalog, learnedMappings } = e.data;
  
  try {
    // Convert learnedMappings back to Map if it was serialized as an object/array
    const mappingsMap = learnedMappings instanceof Map 
      ? learnedMappings 
      : new Map(Object.entries(learnedMappings));

    const result = parseTakeoff(lines, profile, rules, catalog, mappingsMap);
    self.postMessage({ type: 'SUCCESS', result });
  } catch (error: any) {
    self.postMessage({ type: 'ERROR', error: error.message });
  }
};
