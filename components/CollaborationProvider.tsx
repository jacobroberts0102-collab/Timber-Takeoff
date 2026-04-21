import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, setDoc, collection } from 'firebase/firestore';
import { ParsedLine } from '../types';
import { CollaborationContext, Presence } from '../contexts/CollaborationContext';

export const CollaborationProvider: React.FC<{ jobId: string; userId: string; userName: string; children: React.ReactNode }> = ({ jobId, userId, userName, children }) => {
  const [presence, setPresence] = useState<Presence[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (!jobId || !userId) return;

    const presenceRef = doc(db, 'history', jobId, 'presence', userId);

    // Update own presence
    setDoc(presenceRef, {
      uid: userId,
      name: userName || 'Anonymous',
      lastActive: Date.now()
    }, { merge: true });

    // Listen to all presence
    const unsub = onSnapshot(collection(db, 'history', jobId, 'presence'), (snapshot) => {
      const presences = snapshot.docs.map(d => d.data() as Presence);
      setPresence(presences);
    });

    return () => unsub();
  }, [jobId, userId, userName]);

  const updateCursor = async (cursor: Presence['cursor']) => {
    if (!jobId || !userId) return;
    const presenceRef = doc(db, 'history', jobId, 'presence', userId);
    await updateDoc(presenceRef, {
      cursor,
      lastActive: Date.now()
    });
  };

  const syncData = async (data: ParsedLine[]) => {
    if (!jobId) return;
    setIsSyncing(true);
    try {
      const jobRef = doc(db, 'history', jobId);
      await updateDoc(jobRef, { data, lastUpdated: Date.now() });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <CollaborationContext.Provider value={{ presence, updateCursor, syncData, isSyncing }}>
      {children}
    </CollaborationContext.Provider>
  );
};


