import { createContext } from 'react';
import { ParsedLine } from '../types';

interface Presence {
  uid: string;
  name: string;
  cursor?: { x: number; y: number; rowId?: string };
  lastActive: number;
}

interface CollaborationContextType {
  presence: Presence[];
  updateCursor: (cursor: Presence['cursor']) => void;
  syncData: (data: ParsedLine[]) => Promise<void>;
  isSyncing: boolean;
}

export const CollaborationContext = createContext<CollaborationContextType | null>(null);
export type { Presence, CollaborationContextType };
