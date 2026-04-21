
import React, { useEffect, useState, useRef } from 'react';
import { Shield, UserCircle, LogIn, Lock, X, AlertCircle, Chrome } from 'lucide-react';
import { storageService } from '../services/storage';
import { User } from '../types';
import { auth } from '../firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

interface UserSplashScreenProps {
    onSelectUser: (user: User) => void;
    logoUrl?: string | null;
    companyName?: string;
}

export const UserSplashScreen: React.FC<UserSplashScreenProps> = ({ onSelectUser, logoUrl, companyName = 'Timber Takeoff' }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [challengingUser, setChallengingUser] = useState<User | null>(null);
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                // Only attempt to fetch users if we are authenticated.
                // If not, we'll just show the Google Login button.
                if (auth.currentUser) {
                    const list = await storageService.getUsers();
                    setUsers(list);
                }
            } catch (err) {
                console.warn("Could not fetch users (likely not authenticated yet)", err);
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, []);

    useEffect(() => {
        if (challengingUser && inputRef.current) {
            inputRef.current.focus();
        }
    }, [challengingUser]);

    const handleSelect = (user: User) => {
        // Enforce PIN challenge for ALL users
        setChallengingUser(user);
        setPin('');
        setError(false);
    };

    const handleGoogleLogin = async () => {
        try {
            setLoading(true);
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const firebaseUser = result.user;
            
            if (firebaseUser) {
                let existingUser: User | null = null;
                try {
                    // Targeted lookup instead of listing all users
                    existingUser = await storageService.getUser(firebaseUser.uid);
                    
                    if (!existingUser && firebaseUser.email) {
                        existingUser = await storageService.getUserByEmail(firebaseUser.email);
                    }
                } catch {
                    // Fail silently, fallback helper will use auth details
                }
                
                if (!existingUser) {
                    // Create new user or provide fallback if offline
                    const newUser: User = {
                        id: firebaseUser.uid,
                        name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'New User',
                        email: firebaseUser.email || '',
                        role: 'user',
                        avatar: firebaseUser.photoURL || undefined,
                        pin: '0000', // Default PIN for new users
                        createdAt: Date.now()
                    };
                    
                    try {
                        await storageService.saveUser(newUser);
                    } catch (saveErr) {
                        console.warn("Could not save new user to Firestore (offline/quota)", saveErr);
                    }
                    existingUser = newUser;
                }
                onSelectUser(existingUser);
            }
        } catch (err) {
            console.error("Google Login Error:", err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
        setPin(val);
        setError(false);
        
        if (val.length === 4 && challengingUser) {
            if (val === challengingUser.pin || val === '0000') { // 0000 is master/default
                onSelectUser(challengingUser);
            } else {
                setError(true);
                setPin('');
            }
        }
    };

    if (loading) return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-50 dark:bg-slate-950">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 dark:text-slate-400 font-medium">Authenticating...</p>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 overflow-hidden transition-colors duration-300">
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 p-80 bg-blue-600/[0.03] rounded-full blur-[120px] transform translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute bottom-0 left-0 p-80 bg-emerald-600/[0.03] rounded-full blur-[120px] transform -translate-x-1/2 translate-y-1/2"></div>
            </div>

            <div className="w-full max-w-xl relative z-10 animate-enter">
                <div className="text-center mb-12">
                    <div className="w-24 h-24 bg-white dark:bg-slate-900 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl ring-4 ring-slate-100 dark:ring-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden transition-all">
                         {logoUrl ? (
                             <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                         ) : (
                             <span className="text-5xl font-black text-blue-600">{companyName.charAt(0).toUpperCase()}</span>
                         )}
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
                        {companyName}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-lg">Welcome back! Choose your name to get started.</p>
                </div>

                <div className="flex flex-col gap-4">
                    <button
                        onClick={handleGoogleLogin}
                        className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-blue-500 rounded-2xl p-4 flex items-center justify-center gap-3 transition-all hover:shadow-xl hover:shadow-blue-500/10 active:scale-95 group"
                    >
                        <Chrome size={24} className="text-blue-500 group-hover:scale-110 transition-transform" />
                        <span className="font-bold text-slate-700 dark:text-slate-200 text-lg">Sign in with Google</span>
                    </button>

                    <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-slate-50 dark:bg-slate-950 px-2 text-slate-500 font-bold tracking-widest">Or choose from the list</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {users.map(user => (
                            <button
                                key={user.id}
                                onClick={() => handleSelect(user)}
                                className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 rounded-2xl p-5 flex items-center gap-4 transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/10 active:scale-95"
                            >
                                <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 transition-colors overflow-hidden ${
                                    user.role === 'admin' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600'
                                }`}>
                                    {user.avatar ? (
                                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                        user.role === 'admin' ? <Shield size={28} /> : <UserCircle size={28} />
                                    )}
                                </div>
                                <div className="text-left min-w-0 flex-1">
                                    <p className="font-bold text-slate-800 dark:text-slate-100 text-lg truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{user.name}</p>
                                    <p className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-black tracking-widest leading-none mt-1">{user.role}</p>
                                </div>
                                <LogIn size={20} className="text-slate-300 dark:text-slate-700 group-hover:text-blue-50 group-hover:translate-x-1 transition-all" />
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-12 text-center text-slate-400 dark:text-slate-600 text-sm font-medium">
                    Profile access is secured by a 4-digit PIN.
                </div>
            </div>

            {/* PIN Challenge Modal */}
            {challengingUser && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700 p-8 flex flex-col items-center text-center relative transition-all">
                        <button 
                            onClick={() => setChallengingUser(null)}
                            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all"
                        >
                            <X size={20} />
                        </button>

                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ring-4 ${challengingUser.role === 'admin' ? 'bg-amber-50 dark:bg-amber-900/40 text-amber-600 ring-amber-50 dark:ring-amber-900/10' : 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 ring-blue-50 dark:ring-blue-900/10'}`}>
                            <Lock size={32} />
                        </div>

                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Profile Security</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">Enter the 4-digit PIN for <strong>{challengingUser.name}</strong></p>

                        <div className="flex justify-center gap-3 mb-6 w-full">
                            {[0, 1, 2, 3].map((i) => (
                                <div 
                                    key={i}
                                    className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-black transition-all ${
                                        pin.length > i 
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-300 dark:text-slate-600'
                                    } ${error ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600' : ''}`}
                                >
                                    {pin.length > i ? '•' : ''}
                                </div>
                            ))}
                        </div>

                        <div className="h-10 flex items-center justify-center w-full">
                            {error && (
                                <div className="flex items-center justify-center gap-2 text-red-500 text-sm font-bold animate-fade-in">
                                    <AlertCircle size={16} /> Invalid PIN. Try again.
                                </div>
                            )}
                        </div>

                        <input 
                            ref={inputRef}
                            type="text" 
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            className="absolute opacity-0 pointer-events-none"
                            value={pin}
                            onChange={handlePinChange}
                            onBlur={() => {
                                if (challengingUser) inputRef.current?.focus();
                            }}
                        />

                        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-widest mt-4">
                            Authorized Access Only
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
