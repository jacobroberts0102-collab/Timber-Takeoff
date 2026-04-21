import { useContext } from 'react';
import { CollaborationContext } from '../contexts/CollaborationContext';

export const useCollaboration = () => {
  const context = useContext(CollaborationContext);
  if (!context) throw new Error('useCollaboration must be used within CollaborationProvider');
  return context;
};
