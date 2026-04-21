
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Shield, Save, AlertCircle, Camera, Lock, Key, ChevronDown } from 'lucide-react';
import { storageService } from '../services/storage';
import { User } from '../types';
import { ConfirmDialog } from './ConfirmDialog';

interface UserManagerProps {
    currentUser: User;
    onUserUpdate?: (user: User) => void;
}

export const UserManager: React.FC<UserManagerProps> = ({ currentUser, onUserUpdate }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState<Partial<User>>({ name: '', role: 'user', avatar: '', pin: '' });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const listFileInputRef = useRef<HTMLInputElement>(null);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
    const [resetingPinUserId, setResetingPinUserId] = useState<string | null>(null);
    const [newPin, setNewPin] = useState('');
    const [alertConfig, setAlertConfig] = useState<{ title: string; message: string } | null>(null);

    useEffect(() => {
        storageService.getUsers().then(setUsers);
    }, []);

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, isNewUser: boolean = true, targetUserId?: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result as string;
            if (isNewUser) {
                setFormData(prev => ({ ...prev, avatar: base64 }));
            } else if (targetUserId) {
                const user = users.find(u => u.id === targetUserId);
                if (user) {
                    const updatedUser = { ...user, avatar: base64 };
                    await storageService.saveUser(updatedUser);
                    setUsers(await storageService.getUsers());
                    
                    // If the updated user is the one currently logged in, notify the app
                    if (onUserUpdate && updatedUser.id === currentUser.id) {
                        onUserUpdate(updatedUser);
                    }
                }
            }
        };
        reader.readAsDataURL(file);
    };

    const handleRoleChange = async (userId: string, newRole: 'admin' | 'user') => {
        const user = users.find(u => u.id === userId);
        if (!user || user.role === newRole) return;

        // Protection for specific system accounts: Role cannot be changed
        if (userId === 'admin' || userId === 'john_braden') {
            setAlertConfig({
                title: "Action Restricted",
                message: "This primary administrator role cannot be changed."
            });
            return;
        }

        const updatedUser = { ...user, role: newRole };
        await storageService.saveUser(updatedUser);
        
        // Refresh local list
        const freshUsers = await storageService.getUsers();
        setUsers(freshUsers);

        // If current user updated themselves, refresh the whole app context
        if (onUserUpdate && userId === currentUser.id) {
            onUserUpdate(updatedUser);
        }
    };

    const handleCreate = async () => {
        if (!formData.name) return;
        // Enforce PIN for everyone
        if (!formData.pin || formData.pin.length !== 4) {
            setAlertConfig({
                title: "PIN Required",
                message: "All users require a 4-digit PIN."
            });
            return;
        }

        const newUser: User = {
            id: crypto.randomUUID(),
            name: formData.name,
            role: formData.role || 'user',
            avatar: formData.avatar,
            pin: formData.pin,
            createdAt: Date.now()
        };
        await storageService.saveUser(newUser);
        setUsers(await storageService.getUsers());
        setIsCreating(false);
        setFormData({ name: '', role: 'user', avatar: '', pin: '' });
    };

    const handleResetPin = async () => {
        if (!resetingPinUserId || newPin.length !== 4) return;
        
        const user = users.find(u => u.id === resetingPinUserId);
        if (user) {
            const updatedUser = { ...user, pin: newPin };
            await storageService.saveUser(updatedUser);
            setUsers(await storageService.getUsers());
            
            if (onUserUpdate && updatedUser.id === currentUser.id) {
                onUserUpdate(updatedUser);
            }
        }
        setResetingPinUserId(null);
        setNewPin('');
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        const id = deleteTarget.id;
        if (id === 'john_braden' || id === 'admin') {
            setAlertConfig({
                title: "Action Restricted",
                message: "This system administrator account cannot be deleted."
            });
            setDeleteTarget(null);
            return;
        }

        try {
            await storageService.deleteUser(id);
            setUsers(await storageService.getUsers());
        } catch (error) {
            console.error("Failed to delete user", error);
            setAlertConfig({
                title: "Error",
                message: "An error occurred while deleting the user."
            });
        } finally {
            setDeleteTarget(null);
        }
    };

    if (currentUser.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center h-full p-12 text-center">
                <AlertCircle size={48} className="text-red-500 mb-4 opacity-50" />
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Access Denied</h3>
                <p className="text-slate-500 dark:text-slate-400">Only administrators can manage users.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 rounded-lg overflow-hidden animate-fade-in">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Shield size={18} className="text-blue-500" /> User Management
                </h3>
                <button 
                    onClick={() => setIsCreating(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95"
                >
                    <Plus size={16} /> Add User
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {isCreating && (
                    <div className="bg-white dark:bg-slate-800 rounded-xl border-2 border-blue-500 p-4 shadow-xl animate-in slide-in-from-top-4">
                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="flex flex-col items-center gap-2">
                                <label className="block text-[10px] font-black uppercase text-slate-500 text-center mb-1 w-full">Photo</label>
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-24 h-24 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 bg-slate-50 dark:bg-slate-900 flex items-center justify-center overflow-hidden transition-all group relative"
                                >
                                    {formData.avatar ? (
                                        <img src={formData.avatar} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                        <Camera size={24} className="text-slate-400 group-hover:text-blue-500" />
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                        <Camera size={20} className="text-white" />
                                    </div>
                                </button>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    accept="image/*" 
                                    onChange={(e) => handlePhotoUpload(e, true)} 
                                />
                            </div>
                            
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-1">
                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Full Name</label>
                                    <input 
                                        autoFocus
                                        type="text" 
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                                        placeholder="Enter name..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Role</label>
                                    <select 
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value as any })}
                                        className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                                    >
                                        <option value="user">Standard User</option>
                                        <option value="admin">Administrator</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Security PIN (4-digits)</label>
                                    <input 
                                        type="text" 
                                        maxLength={4}
                                        value={formData.pin || ''}
                                        onChange={e => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '') })}
                                        className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-mono text-center tracking-[0.5em]"
                                        placeholder="0000"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                            <button onClick={() => setIsCreating(false)} className="px-4 py-2 text-slate-500 text-sm font-bold">Cancel</button>
                            <button onClick={handleCreate} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold flex items-center gap-2 transition-all active:scale-95 shadow-md hover:bg-blue-700"><Save size={16} /> Create User</button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {users.map(u => {
                        const isPrimaryAdmin = u.id === 'admin' || u.id === 'john_braden';
                        return (
                            <div key={u.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between group shadow-sm transition-all hover:shadow-md">
                                <div className="flex items-center gap-4">
                                    <div className="relative group/avatar">
                                        <button 
                                            onClick={() => {
                                                setEditingUserId(u.id);
                                                listFileInputRef.current?.click();
                                            }}
                                            className={`w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden transition-all relative ${u.role === 'admin' ? 'bg-amber-100 text-amber-600 ring-2 ring-amber-500/20' : 'bg-blue-100 text-blue-600 ring-2 ring-blue-500/20'}`}
                                        >
                                            {u.avatar ? (
                                                <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                            ) : (
                                                <span className="text-xl font-bold">{u.name.charAt(0)}</span>
                                            )}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                                                <Camera size={18} className="text-white" />
                                            </div>
                                        </button>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-slate-800 dark:text-white truncate text-lg">{u.name} {u.id === currentUser.id && '(You)'}</p>
                                            <span title="Protected by PIN"><Lock size={12} className={u.role === 'admin' ? 'text-amber-500' : 'text-blue-500'} /></span>
                                        </div>
                                        <div className="relative inline-block mt-1">
                                            <select 
                                                value={u.role}
                                                disabled={isPrimaryAdmin}
                                                onChange={(e) => handleRoleChange(u.id, e.target.value as any)}
                                                className={`appearance-none bg-transparent pr-6 text-[10px] uppercase font-black tracking-widest outline-none transition-all ${
                                                    u.role === 'admin' ? 'text-amber-600 dark:text-amber-500' : 'text-blue-600 dark:text-blue-500'
                                                } ${isPrimaryAdmin ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:underline'}`}
                                            >
                                                <option value="user">Standard User</option>
                                                <option value="admin">Administrator</option>
                                            </select>
                                            {!isPrimaryAdmin && (
                                                <ChevronDown size={10} className={`absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none ${
                                                    u.role === 'admin' ? 'text-amber-600' : 'text-blue-600'
                                                }`} />
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button 
                                        onClick={() => setResetingPinUserId(u.id)}
                                        className="p-3 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl transition-all"
                                        title="Reset PIN"
                                    >
                                        <Key size={20} />
                                    </button>
                                    {!isPrimaryAdmin && (
                                        <button 
                                            onClick={() => setDeleteTarget(u)}
                                            className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                                            title="Delete User"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            
            <input 
                type="file" 
                ref={listFileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => {
                    if (editingUserId) {
                        handlePhotoUpload(e, false, editingUserId);
                        setEditingUserId(null);
                        if (e.target) e.target.value = '';
                    }
                }} 
            />

            <ConfirmDialog 
                isOpen={!!deleteTarget}
                title="Delete User Account"
                message={`Are you sure you want to delete ${deleteTarget?.name}? All associated job history will be permanently removed.`}
                confirmLabel="Delete User"
                isDestructive={true}
                onConfirm={handleDeleteConfirm}
                onCancel={() => setDeleteTarget(null)}
            />

            <ConfirmDialog 
                isOpen={!!alertConfig}
                title={alertConfig?.title || 'Alert'}
                message={alertConfig?.message || ''}
                confirmLabel="OK"
                onConfirm={() => setAlertConfig(null)}
            />

            {resetingPinUserId && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden p-6">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                            <Key size={20} className="text-amber-500" /> Reset User PIN
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                            Enter a new 4-digit PIN for <strong>{users.find(u => u.id === resetingPinUserId)?.name}</strong>.
                        </p>
                        <input 
                            autoFocus
                            type="text" 
                            maxLength={4}
                            value={newPin}
                            onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                            className="w-full p-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white outline-none focus:border-blue-500 shadow-sm font-mono text-center text-3xl tracking-[0.5em] mb-6"
                            placeholder="0000"
                        />
                        <div className="flex gap-3">
                            <button onClick={() => setResetingPinUserId(null)} className="flex-1 py-2 text-slate-500 font-bold">Cancel</button>
                            <button 
                                onClick={handleResetPin}
                                disabled={newPin.length !== 4}
                                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-bold transition-all shadow-md"
                            >
                                Update PIN
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
