import { HistoryItem, CatalogProduct, User, AppSettings, MemoryItem, SheetDims, HistoryFolder } from '../types';
import { BONE_TIMBER_DEFAULTS } from './defaultCatalog';
import { buildLookupKey, normalizeWhitespace } from '../utils/learnedKey';
import { db, handleFirestoreError, OperationType, sanitizeForFirestore } from '../firebase';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, writeBatch, orderBy, getDocFromCache, getDocsFromCache } from 'firebase/firestore';

/**
 * Migration helper to convert old-style memory items to new shape.
 */
export const parseSheetDimsFromCatalogDescription = (desc: string): SheetDims | null => {
    if (!desc) return null;
    const clean = desc.toUpperCase().replace(/[\s\t]/g, '').replace(/[×X*]/g, 'x');
    const dimMatch = clean.match(/(\d{3,4})x(\d{3,4})/);
    if (!dimMatch) return null;
    const l = parseInt(dimMatch[1]);
    const w = parseInt(dimMatch[2]);
    const thicknessMatch = clean.match(/(\d{1,2})MM/);
    const t = thicknessMatch ? parseInt(thicknessMatch[1]) : undefined;
    return { l, w, t };
};

export const enrichCatalogProduct = (p: CatalogProduct): CatalogProduct => {
    const text = `${p.description} ${p.itemNo} ${p.dimensions || ''}`.toUpperCase().replace(/[\s\t]/g, '').replace(/[×X*]/g, 'x');
    let dimsKey = p.dimsKey;
    if (!dimsKey) {
        const dimMatch = text.match(/(\d{2,4})x(\d{2,4})/);
        if (dimMatch) {
            const d1 = parseInt(dimMatch[1]);
            const d2 = parseInt(dimMatch[2]);
            dimsKey = d1 > d2 ? `${d1}x${d2}` : `${d2}x${d1}`;
        }
    }
    let gradeKey = p.gradeKey;
    if (!gradeKey) {
        const gradeMatch = text.match(/\b(MGP\s?10|MGP\s?12|LVL\s?\d+|GL\s?\d+S?|H\s?\d|F\s?\d+)\b/i);
        if (gradeMatch) {
            gradeKey = gradeMatch[1].replace(/\s+/g, '').toUpperCase();
        }
    }
    let lengthKeyM = p.lengthKeyM;
    if (lengthKeyM === undefined || lengthKeyM === null) {
        const mMatch = text.match(/\b(\d{1,2}(?:\.\d)?)M\b/);
        const mmMatch = text.match(/\b(\d{4})MM\b/);
        if (mMatch) lengthKeyM = parseFloat(mMatch[1]);
        else if (mmMatch) lengthKeyM = parseFloat(mmMatch[1]) / 1000;
    }
    const sheetDimsMm = p.sheetDimsMm || parseSheetDimsFromCatalogDescription(p.description);
    return { ...p, dimsKey, gradeKey, lengthKeyM, sheetDimsMm };
};

/**
 * Tokenizes a manual search query into meaningful words for catalog matching.
 */
export const tokenizeCatalogQuery = (input: string): string[] => {
    const NOISE_TOKENS = new Set(['MM', 'M', 'LM', 'L/M', 'EA', 'EACH', 'SHEET', 'SHEETS', 'LENGTH', 'LENGTHS', 'THE', 'AND', 'WITH', 'C/W', 'CW', 'OF', 'TO', 'FOR', 'SQM', 'M2']);
    if (!input) return [];
    return input
        .toUpperCase()
        .replace(/[^\w\s+]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length >= 3)
        .filter(t => !NOISE_TOKENS.has(t))
        .slice(0, 12);
};

/**
 * Shared relevance sorting logic for manual catalog search.
 */
export const getRelevanceSortedResults = (catalog: CatalogProduct[], searchTerm: string): CatalogProduct[] => {
    if (!searchTerm || searchTerm.length < 2) return [];
    
    const tokens = tokenizeCatalogQuery(searchTerm);
    const lowQuery = searchTerm.toLowerCase();

    if (tokens.length === 0) {
        return catalog.filter(p => 
            p.itemNo.toLowerCase().includes(lowQuery) || 
            (p.description?.toLowerCase() || '').includes(lowQuery)
        ).slice(0, 50);
    }

    const matches = catalog.map(p => {
        const lowItemNo = p.itemNo.toLowerCase();
        const lowDesc = p.description?.toLowerCase() || '';
        const upperItemNo = p.itemNo.toUpperCase();
        const upperDesc = (p.description || '').toUpperCase();

        let hitCount = 0;
        tokens.forEach(t => {
            if (upperItemNo.includes(t) || upperDesc.includes(t)) hitCount++;
        });

        if (hitCount === 0 && !lowItemNo.includes(lowQuery) && !lowDesc.includes(lowQuery)) {
            return null;
        }

        const isExactCode = lowItemNo === lowQuery;
        const isExactDesc = lowDesc === lowQuery;

        return {
            product: p,
            hitCount,
            isExactCode,
            isExactDesc
        };
    }).filter((m): m is NonNullable<typeof m> => m !== null);

    matches.sort((a, b) => {
        if (a.isExactCode && !b.isExactCode) return -1;
        if (!a.isExactCode && b.isExactCode) return 1;
        if (a.isExactDesc && !b.isExactDesc) return -1;
        if (!a.isExactDesc && b.isExactDesc) return 1;
        if (b.hitCount !== a.hitCount) return b.hitCount - a.hitCount;
        return (a.product.description?.length || 0) - (b.product.description?.length || 0);
    });

    return matches.map(m => m.product).slice(0, 50);
};

export const storageService = {
  async getBranding(): Promise<{ companyName: string; logoUrl: string | null } | null> {
    const path = 'branding/global';
    const docRef = doc(db, path);
    try {
      // 1. Try Cache
      try {
        const cacheSnap = await getDocFromCache(docRef);
        if (cacheSnap.exists()) {
          return cacheSnap.data() as any;
        }
      } catch {
        // Cache miss
      }

      // 2. Try Network
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() as any : null;
    } catch (error) {
      try { handleFirestoreError(error, OperationType.GET, path); } catch(e) { console.warn("Swallowed firestore error to allow fallback"); }
      return null;
    }
  },

  async saveBranding(branding: { companyName: string; logoUrl: string | null }): Promise<void> {
    const path = 'branding/global';
    try {
      await setDoc(doc(db, path), sanitizeForFirestore(branding));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async getUsers(): Promise<User[]> {
    const path = 'users';
    try {
      // 1. Try Cache First (0 quota)
      try {
        const cacheSnap = await getDocsFromCache(collection(db, path));
        if (!cacheSnap.empty) {
          return cacheSnap.docs.map(doc => doc.data() as User);
        }
      } catch {
        // Cache miss
      }

      // 2. Try Network
      const querySnapshot = await getDocs(collection(db, path));
      return querySnapshot.docs.map(doc => doc.data() as User);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async getUser(id: string): Promise<User | null> {
    const path = `users/${id}`;
    const userDocRef = doc(db, path);
    try {
      // 1. Try Cache First (0 quota)
      try {
        const cacheSnap = await getDocFromCache(userDocRef);
        if (cacheSnap.exists()) {
          return cacheSnap.data() as User;
        }
      } catch {
        // Cache miss or error, proceed to network
      }

      // 2. Try Network/SDK default
      const docSnap = await getDoc(userDocRef);
      return docSnap.exists() ? docSnap.data() as User : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  async getUserByEmail(email: string): Promise<User | null> {
    const path = 'users';
    try {
      const q = query(collection(db, path), where('email', '==', email));
      
      // 1. Try Cache First
      try {
        const cacheSnap = await getDocsFromCache(q);
        if (!cacheSnap.empty) {
          return cacheSnap.docs[0].data() as User;
        }
      } catch {
        // Cache miss
      }

      // 2. Try Network
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty ? querySnapshot.docs[0].data() as User : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return null;
    }
  },

  async saveUser(user: User): Promise<void> {
    const path = `users/${user.id}`;
    try {
      await setDoc(doc(db, path), sanitizeForFirestore(user));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async deleteUser(id: string): Promise<void> {
    const path = `users/${id}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async getUserSettings(userId: string): Promise<AppSettings | null> {
    const path = `users/${userId}`;
    const docRef = doc(db, path);
    try {
      // 1. Try Cache
      try {
        const cacheSnap = await getDocFromCache(docRef);
        if (cacheSnap.exists()) {
          return (cacheSnap.data() as any).settings || null;
        }
      } catch {
        // Cache miss
      }

      // 2. Try Network
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? (docSnap.data() as any).settings || null : null;
    } catch (error) {
      try { handleFirestoreError(error, OperationType.GET, path); } catch(e) { console.warn("Swallowed firestore error to allow fallback"); }
      return null;
    }
  },

  async saveUserSettings(userId: string, settings: AppSettings): Promise<void> {
    const path = `users/${userId}`;
    try {
      await updateDoc(doc(db, path), sanitizeForFirestore({ settings }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async getAll(userId?: string): Promise<HistoryItem[]> {
    const path = 'history';
    try {
      let q = collection(db, path);
      if (userId) {
        // @ts-expect-error - legacy data structure
        q = query(q, where('userId', '==', userId));
      }

      // 1. Try Cache First
      try {
        const cacheSnap = await getDocsFromCache(q);
        if (!cacheSnap.empty) {
          const items = cacheSnap.docs.map(doc => doc.data() as HistoryItem);
          items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          return items;
        }
      } catch {
        // Cache miss
      }

      // 2. Try Network
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map(doc => doc.data() as HistoryItem);
      items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      return items;
    } catch (error) {
      try { handleFirestoreError(error, OperationType.LIST, path); } catch(e) {}
      return [];
    }
  },

  async getById(id: string): Promise<HistoryItem | null> {
    const path = `history/${id}`;
    const docRef = doc(db, path);
    try {
      // 1. Try Cache
      try {
        const cacheSnap = await getDocFromCache(docRef);
        if (cacheSnap.exists()) {
          return cacheSnap.data() as HistoryItem;
        }
      } catch {
        // Cache miss
      }

      // 2. Try Network
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() as HistoryItem : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  async add(item: HistoryItem): Promise<void> {
    const path = `history/${item.id}`;
    try {
      await setDoc(doc(db, path), sanitizeForFirestore(item));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async delete(id: string): Promise<void> {
    const path = `history/${id}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async updateJob(id: string, updates: Partial<HistoryItem>): Promise<void> {
    const path = `history/${id}`;
    try {
      const docRef = doc(db, path);
      const current = await getDoc(docRef);
      
      if (current.exists()) {
        const data = current.data() as HistoryItem;
        const versionId = crypto.randomUUID();
        await setDoc(doc(db, `history/${id}/versions`, versionId), sanitizeForFirestore({
          ...data,
          versionTimestamp: Date.now()
        }));
      }
      
      await updateDoc(docRef, sanitizeForFirestore(updates));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async getVersions(jobId: string): Promise<any[]> {
    const path = `history/${jobId}/versions`;
    try {
      const q = query(collection(db, path), orderBy('versionTimestamp', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async togglePin(id: string): Promise<void> {
    const path = `history/${id}`;
    try {
      const docRef = doc(db, path);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const item = docSnap.data() as HistoryItem;
        await updateDoc(docRef, { isPinned: !item.isPinned });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async updateTags(id: string, tags: string[]): Promise<void> {
    const path = `history/${id}`;
    try {
      await updateDoc(doc(db, path), { tags });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async updateFolder(id: string, folderId: string | null): Promise<void> {
    const path = `history/${id}`;
    try {
      await updateDoc(doc(db, path), { folderId });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async getFolders(userId: string): Promise<HistoryFolder[]> {
    const path = 'folders';
    try {
      const q = query(collection(db, path), where('userId', '==', userId));
      
      // 1. Try Cache
      try {
        const cacheSnap = await getDocsFromCache(q);
        if (!cacheSnap.empty) {
          return cacheSnap.docs.map(doc => doc.data() as HistoryFolder);
        }
      } catch {
        // Cache miss
      }

      // 2. Try Network
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as HistoryFolder);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async saveFolder(folder: HistoryFolder): Promise<void> {
    const path = `folders/${folder.id}`;
    try {
      await setDoc(doc(db, path), sanitizeForFirestore(folder));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async deleteFolder(id: string): Promise<void> {
    const path = `folders/${id}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async getCatalog(): Promise<CatalogProduct[]> {
    const path = 'catalog';
    const fallbackMap = new Map<string, CatalogProduct>();
    if (Array.isArray(BONE_TIMBER_DEFAULTS)) {
        BONE_TIMBER_DEFAULTS.forEach(p => {
            if (p && p.itemNo) { 
                fallbackMap.set(p.itemNo, enrichCatalogProduct({ ...p, isSystem: true })); 
            }
        });
    }

    try {
      const colRef = collection(db, path);
      let userItems: CatalogProduct[] = [];
      
      try {
        const cacheSnap = await getDocsFromCache(colRef);
        if (!cacheSnap.empty) {
          userItems = cacheSnap.docs.map(doc => doc.data() as CatalogProduct);
        }
      } catch { /* ignore */ }

      if (userItems.length === 0) {
        const querySnapshot = await getDocs(colRef);
        userItems = querySnapshot.docs.map(doc => doc.data() as CatalogProduct);
      }
      
      userItems.forEach(p => {
          if (p && p.itemNo) { fallbackMap.set(p.itemNo, { ...p, isSystem: false }); }
      });
      return Array.from(fallbackMap.values());
    } catch (error) {
      console.warn("Using fallback catalog. Error:", error);
      return Array.from(fallbackMap.values());
    }
  },

  async saveCatalog(products: CatalogProduct[]): Promise<void> {
    const path = 'catalog';
    try {
      const batch = writeBatch(db);
      const systemItemNos = new Set(BONE_TIMBER_DEFAULTS.map(p => p.itemNo));
      products.forEach(p => {
        if (p && p.itemNo && !systemItemNos.has(p.itemNo)) { 
            const docRef = doc(db, path, p.itemNo);
            batch.set(docRef, sanitizeForFirestore(enrichCatalogProduct(p))); 
        }
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async updateCatalogItem(oldItemNo: string, updatedProduct: CatalogProduct): Promise<void> {
    const path = 'catalog';
    try {
      if (oldItemNo !== updatedProduct.itemNo) {
        await deleteDoc(doc(db, path, oldItemNo));
      }
      await setDoc(doc(db, path, updatedProduct.itemNo), sanitizeForFirestore(enrichCatalogProduct(updatedProduct)));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async clearCatalog(): Promise<void> {
    const path = 'catalog';
    try {
      const querySnapshot = await getDocs(collection(db, path));
      const batch = writeBatch(db);
      querySnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async deleteCatalogItem(itemNo: string): Promise<void> {
    const path = `catalog/${itemNo}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async getLearnedMappings(): Promise<MemoryItem[]> {
    const path = 'learnedMappings';
    try {
      const colRef = collection(db, path);
      
      // 1. Try Cache
      try {
        const cacheSnap = await getDocsFromCache(colRef);
        if (!cacheSnap.empty) {
          return cacheSnap.docs.map(doc => doc.data() as MemoryItem);
        }
      } catch {
        // Cache miss
      }

      // 2. Try Network
      const querySnapshot = await getDocs(colRef);
      return querySnapshot.docs.map(doc => doc.data() as MemoryItem);
    } catch (error) {
      try { handleFirestoreError(error, OperationType.LIST, path); } catch(e) {}
      return [];
    }
  },

  async saveLearnedMapping(item: MemoryItem): Promise<void> {
      const path = `learnedMappings/${item.lookupKey}`;
      try {
        await setDoc(doc(db, path), sanitizeForFirestore(item));
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
  },

  async updateLearnedMapping(oldKey: string, newName: string, newDims: string, newItemNo: string, newDescription: string): Promise<void> {
      const path = 'learnedMappings';
      const newKey = buildLookupKey(newName, newDims);
      try {
        if (oldKey !== newKey) {
          await deleteDoc(doc(db, path, oldKey));
        }
        const updated: MemoryItem = { 
            lookupKey: newKey, 
            displayName: normalizeWhitespace(newName),
            dimensions: normalizeWhitespace(newDims),
            itemNo: newItemNo, 
            description: newDescription 
        };
        await setDoc(doc(db, path, newKey), sanitizeForFirestore(updated));
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
  },

  async deleteLearnedMapping(lookupKey: string): Promise<void> {
    const path = `learnedMappings/${lookupKey}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async clearLearnedMappings(): Promise<void> {
    const path = 'learnedMappings';
    try {
      const querySnapshot = await getDocs(collection(db, path));
      const batch = writeBatch(db);
      querySnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
};
