import React, { useState, useEffect } from 'react';
import { 
  Routes, 
  Route, 
  Navigate, 
  Link, 
  useLocation,
  useNavigate
} from 'react-router-dom';
import { 
  onAuthStateChanged, 
  signOut, 
  User,
  sendEmailVerification
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  collection,
  where,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { 
  Home as HomeIcon, 
  MessageSquare, 
  Wrench, 
  ShoppingBag, 
  User as UserIcon, 
  LogOut,
  MessageCircle,
  ShieldCheck,
  Mail,
  Ban,
  Settings,
  Sun,
  Moon,
  RefreshCw,
  Monitor,
  Cpu,
  Download,
  X,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const LiveClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
      {time.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </div>
  );
};

import { UserProfile } from './types';

// Components
import Auth from './components/Auth';
import Home from './components/Home';
import Forum from './components/Forum';
import RepairGuide from './components/RepairGuide';
import Shop from './components/Shop';
import AdminPanel from './components/AdminPanel';
import Messages from './components/Messages';
import NotificationsDropdown from './components/NotificationsDropdown';
import ProfileModal from './components/ProfileModal';
import VerificationView from './components/VerificationView';
import ICSearch from './components/ICSearch';
import NearbyMasters from './components/NearbyMasters';
import ImageModal from './components/ImageModal';
import RFAI from './components/RFAI';
import { handleFirestoreError, OperationType } from './utils/errorHandling';
import ErrorBoundary from './components/ErrorBoundary';
import { useToast } from './context/ToastContext';

const Layout = ({ children, userProfile, isAdmin, onLogout, hasUnreadMessages, isDarkMode, toggleTheme, onImageClick, pendingVerificationsCount, onPlaySound }: { 
  children: React.ReactNode, 
  userProfile: UserProfile | null,
  isAdmin: boolean,
  onLogout: () => void,
  hasUnreadMessages: boolean,
  isDarkMode: boolean,
  toggleTheme: () => void,
  onImageClick: (src: string) => void,
  pendingVerificationsCount: number,
  onPlaySound: () => void
}) => {
  const location = useLocation();
  const whatsappNumber = "+994772282424";
  const [showProfileModal, setShowProfileModal] = useState(false);
  const { showToast } = useToast();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    // Optionally, send analytics event with outcome of user choice
    console.log(`User response to the install prompt: ${outcome}`);
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const isMasterOrProgrammer = userProfile?.userType === 'master' || userProfile?.userType === 'programmer';
  const isAdminUser = isAdmin || userProfile?.role === 'admin';

  const navItems: any[] = [
    { path: '/', icon: HomeIcon, label: 'Ana Səhifə' },
    { path: '/forum', icon: MessageSquare, label: 'Forum' },
    { path: '/repair', icon: Wrench, label: 'Təmir asistanı' },
    { path: '/ic-search', icon: Cpu, label: 'IC Uyğunluq' },
    { path: '/rf-ai', icon: Sparkles, label: 'RF AI' },
    { path: '/shop', icon: ShoppingBag, label: 'Mağaza' },
    { path: '/messages', icon: Mail, label: 'Mesajlar' },
    { action: () => setShowProfileModal(true), icon: UserIcon, label: 'Kabinet' },
  ];

  const filteredNavItems = navItems.filter(item => {
    if (item.restricted && !isMasterOrProgrammer && !isAdminUser) return false;
    return true;
  });

  if (isAdminUser) {
    filteredNavItems.push({ path: '/admin', icon: ShieldCheck, label: 'Admin' });
  }

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-sans pb-16 transition-colors duration-300">
      <header className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 sticky top-0 z-50 flex justify-between items-center shadow-sm backdrop-blur-md bg-slate-50/80 dark:bg-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-white font-black text-sm shadow-lg shadow-cyan-500/20">RF</div>
          <div className="flex flex-col justify-center">
            <h1 className="text-lg font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none mb-1">RF SERVİS</h1>
            <LiveClock />
          </div>
        </div>
        <div className="flex items-center gap-4">
          {showInstallBanner && (
            <button
              onClick={handleInstallClick}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg transition-all text-[10px] font-black uppercase tracking-widest border border-primary/20"
            >
              <Download size={14} />
              Quraşdır
            </button>
          )}
          <div 
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="hidden sm:flex flex-col items-end" onClick={() => setShowProfileModal(true)}>
              <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest group-hover:text-primary transition-colors">Xoş gəlmisiniz</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors flex items-center gap-1.5">
                {userProfile?.displayName || userProfile?.email?.split('@')[0]}
                {userProfile?.email?.toLowerCase() === 'rauf2289@gmail.com' ? (
                  <span className="text-[8px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-md border border-amber-500/30 font-black tracking-tighter uppercase shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                    Rəhbərlik
                  </span>
                ) : userProfile?.role === 'admin' ? (
                  <span className="text-[8px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-md border border-amber-500/30 font-black tracking-tighter uppercase shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                    Admin
                  </span>
                ) : userProfile?.userType === 'master' ? (
                  <span className="text-[8px] bg-purple-500/20 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded-md border border-purple-500/30 font-black tracking-tighter uppercase">
                    Usta
                  </span>
                ) : userProfile?.userType === 'programmer' ? (
                  <span className="text-[8px] bg-blue-500/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-md border border-blue-500/30 font-black tracking-tighter uppercase">
                    Proqramist
                  </span>
                ) : null}
              </span>
            </div>
            {userProfile?.photoURL ? (
              <img 
                src={userProfile.photoURL} 
                alt="Profile" 
                className="w-8 h-8 sm:w-6 sm:h-6 rounded-full object-cover border border-slate-200 dark:border-slate-600 hover:scale-110 transition-transform" 
                onClick={() => onImageClick(userProfile.photoURL!)}
              />
            ) : (
              <div className="w-8 h-8 sm:w-6 sm:h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center border border-slate-200 dark:border-slate-600" onClick={() => setShowProfileModal(true)}>
                <UserIcon size={14} className="text-slate-400" />
              </div>
            )}
          </div>
          <button 
            onClick={toggleTheme}
            className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-all active:scale-90"
            title={isDarkMode ? 'İşıqlı rejim' : 'Qaranlıq rejim'}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button 
            onClick={onLogout}
            className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-all active:scale-90"
          >
            <LogOut size={18} />
          </button>
          {userProfile && <NotificationsDropdown userId={userProfile.uid} isAdmin={isAdmin} />}
        </div>
      </header>

      {showProfileModal && userProfile && (
        <ProfileModal 
          userProfile={userProfile} 
          onClose={() => setShowProfileModal(false)}
          onImageClick={onImageClick}
          onPlaySound={onPlaySound}
          onUpdate={(updatedProfile) => {
            // The App component will re-fetch or we can just let it be since we don't have a direct setter here
            // Actually, we can't easily update the App state from Layout without a prop.
            // Let's just reload the page or rely on the onSnapshot (wait, App uses getDoc, not onSnapshot for userProfile).
            // Let's reload for simplicity or we can add a prop.
            window.location.reload();
          }}
        />
      )}

      <main className="flex-1 flex flex-col min-h-0 relative">
        <AnimatePresence>
          {showInstallBanner && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="sm:hidden bg-primary/10 border-b border-primary/20 p-3 flex items-center justify-between gap-3 overflow-hidden z-[40]"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
                  <Download size={16} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest leading-none mb-1">RF SERVIS Tətbiqi</p>
                  <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold">Daha sürətli giriş üçün quraşdırın</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleInstallClick}
                  className="px-3 py-1.5 bg-primary text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-cyan-500/20"
                >
                  Quraşdır
                </button>
                <button
                  onClick={() => setShowInstallBanner(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col min-h-0"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-3 left-1/2 -translate-x-1/2 w-[95%] max-w-md bg-white/80 dark:bg-slate-800/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-full flex justify-around items-center py-1.5 px-4 z-50 shadow-xl dark:shadow-[0_15px_30px_rgba(0,0,0,0.5)]">
        {filteredNavItems.map((item) => {
          const itemKey = item.path || item.label;
          if (item.action) {
            return (
              <button 
                key={itemKey}
                onClick={item.action}
                className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-2xl transition-all text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 relative"
              >
                <item.icon size={20} strokeWidth={2} />
                <span className="text-[8px] font-black uppercase tracking-wider hidden sm:block">
                  {item.label}
                </span>
              </button>
            );
          }
          const isActive = location.pathname === item.path;
          return (
            <Link 
              key={itemKey}
              to={item.path!}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-2xl transition-all relative ${
                isActive ? 'text-primary scale-105' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-[8px] font-black uppercase tracking-wider ${isActive ? 'block' : 'hidden sm:block'}`}>
                {item.label}
              </span>
              {item.path === '/messages' && hasUnreadMessages && (
                <span className="absolute top-0 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-slate-800 shadow-[0_0_10px_rgba(244,63,94,0.8)] animate-pulse" />
              )}
              {item.path === '/admin' && pendingVerificationsCount > 0 && (
                <span className="absolute top-0 right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-white dark:border-slate-800 shadow-[0_0_10px_rgba(245,158,11,0.8)] animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

const Contact = () => {
  const whatsappNumber = "+994772282424";
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
      <div className="w-20 h-20 bg-emerald-500/10 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center shadow-inner">
        <MessageCircle size={40} />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Bizimlə Əlaqə</h2>
        <p className="text-slate-600 dark:text-slate-400 mt-2">Hər hansı bir sualınız və ya təklifiniz varsa, bizə WhatsApp vasitəsilə yaza bilərsiniz.</p>
      </div>
      <a 
        href={`https://wa.me/${whatsappNumber}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full max-w-xs py-4 bg-emerald-500 text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 active:scale-95 transition-transform"
      >
        <MessageCircle size={20} />
        WhatsApp ilə Yaz
      </a>
      <div className="pt-8 border-t border-slate-200 dark:border-slate-700 w-full text-slate-500 dark:text-slate-400 text-sm">
        <p>İş saatları: 09:00 - 20:00</p>
        <p>Ünvan: Bakı şəhəri, Azərbaycan</p>
      </div>
    </div>
  );
};

import FileManager from './components/FileManager';

import { useTheme } from './context/ThemeContext';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [pendingVerificationsCount, setPendingVerificationsCount] = useState(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const notificationAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Connection test to Firestore
    const testConnection = async () => {
      try {
        const { getDocFromServer } = await import('firebase/firestore');
        await getDocFromServer(doc(db, 'test', 'connection'));
        console.log("Firestore connection successful");
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
          // We won't show a toast here to avoid annoying the user if it's a temporary issue
        }
      }
    };
    testConnection();

    // Pre-load notification sound
    notificationAudioRef.current = new Audio('/new.mp3');
    notificationAudioRef.current.preload = 'auto';
    notificationAudioRef.current.volume = 0.8;
    
    // Interaction listener to "unlock" audio on some browsers
    const unlockAudio = () => {
      if (notificationAudioRef.current) {
        const audio = notificationAudioRef.current;
        audio.play().then(() => {
          audio.pause();
          audio.currentTime = 0;
          console.log("Audio system unlocked");
          document.removeEventListener('click', unlockAudio);
          document.removeEventListener('touchstart', unlockAudio);
        }).catch(err => {
          console.log("Audio unlock failed, will retry on next interaction", err);
        });
      }
    };
    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);
  }, []);

  const playNotification = () => {
    if (notificationAudioRef.current) {
      const audio = notificationAudioRef.current;
      
      // Reset to beginning if already playing
      audio.pause();
      audio.currentTime = 0;
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log("Playback failed, retrying...", error);
          // Fallback: reload and play
          audio.load();
          audio.play().catch(e => console.error("Final playback attempt failed", e));
        });
      }
    }
  };

  useEffect(() => {
    const isAdmin = userProfile?.role === 'admin' || user?.email?.toLowerCase() === 'rauf2289@gmail.com';
    if (!userProfile || !isAdmin || !user?.emailVerified) {
      setPendingVerificationsCount(0);
      return;
    }

    const q = query(collection(db, 'users'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingVerificationsCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [userProfile?.role, user?.email, user?.emailVerified]);

  useEffect(() => {
    const isAdmin = userProfile?.role === 'admin' || user?.email?.toLowerCase() === 'rauf2289@gmail.com';
    if (!userProfile || !isAdmin || !user?.emailVerified) return;

    // One-time notification for existing pending requests
    if (pendingVerificationsCount > 0) {
      showToast(`${pendingVerificationsCount} gözləyən təsdiqləmə sorğusu var.`, 'info');
    }
  }, [userProfile?.role, user?.email, user?.emailVerified, pendingVerificationsCount > 0]);

  useEffect(() => {
    const isAdmin = userProfile?.role === 'admin' || user?.email?.toLowerCase() === 'rauf2289@gmail.com';
    if (!userProfile || !isAdmin || !user?.emailVerified) return;

    let isFirstSnapshot = true;
    const seenUserIds = new Set<string>();
    
    const q = query(collection(db, 'users'), where('status', '==', 'pending'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (isFirstSnapshot) {
        snapshot.docs.forEach(doc => seenUserIds.add(doc.id));
        isFirstSnapshot = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        const userId = change.doc.id;
        if (change.type === 'added' || change.type === 'modified') {
          const newUser = change.doc.data() as UserProfile;
          
          if (newUser.status === 'pending' && !seenUserIds.has(userId)) {
            seenUserIds.add(userId);
            playNotification();
            showToast(`Yeni təsdiqləmə sorğusu: ${newUser.displayName || newUser.email} təsdiq gözləyir.`, 'info');
          }
        } else if (change.type === 'removed') {
          seenUserIds.delete(userId);
        }
      });
    });

    return () => unsubscribe();
  }, [userProfile?.role, user?.email, user?.emailVerified]);

  useEffect(() => {
    if (!userProfile || !user?.emailVerified) {
      setHasUnreadMessages(false);
      return;
    }

    let isFirstSnapshot = true;
    const seenMessageIds = new Set<string>();
    const q = query(
      collection(db, 'messages'),
      where('receiverId', '==', userProfile.uid),
      where('read', '==', false),
      limit(20) // Limit unread message check
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const hasUnread = snapshot.docs.length > 0;
      setHasUnreadMessages(hasUnread);

      if (isFirstSnapshot) {
        snapshot.docs.forEach(doc => seenMessageIds.add(doc.id));
        isFirstSnapshot = false;
        return;
      }

      const senderProfilesCache = new Map<string, string>();

      snapshot.docChanges().forEach(async (change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          
          if (!seenMessageIds.has(change.doc.id)) {
            seenMessageIds.add(change.doc.id);
            playNotification();

            // Show in-app WhatsApp-style notification
            let senderPhoto = '';
            try {
              if (senderProfilesCache.has(data.senderId)) {
                senderPhoto = senderProfilesCache.get(data.senderId)!;
              } else {
                const senderDoc = await getDoc(doc(db, 'publicProfiles', data.senderId));
                if (senderDoc.exists()) {
                  senderPhoto = senderDoc.data().photoURL || '';
                  senderProfilesCache.set(data.senderId, senderPhoto);
                }
              }
            } catch (e) {
              console.error("Error fetching sender photo:", e);
            }

            showToast(data.content || 'Yeni bir mesajınız var.', 'info', {
              duration: 2000,
              isMessage: true,
              senderName: data.senderName || 'Anonim',
              senderPhoto: senderPhoto,
              onClick: () => {
                navigate(`/messages?userId=${data.senderId}`);
              }
            });
          }
        }
      });
    }, (error) => {
      console.error("Error fetching unread messages:", error);
    });

    return () => unsubscribe();
  }, [userProfile?.uid, user?.emailVerified]);

  useEffect(() => {
    if (!userProfile || !user?.emailVerified) return;

    const userIds = [userProfile.uid, 'all'];
    const isAdmin = userProfile.role === 'admin' || user?.email?.toLowerCase() === 'rauf2289@gmail.com';
    if (isAdmin) {
      userIds.push('admin');
    }

    let isFirstSnapshot = true;
    const seenNotifIds = new Set<string>();

    const q = query(
      collection(db, 'notifications'),
      where('userId', 'in', userIds),
      limit(50) // Limit notification check
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (isFirstSnapshot) {
        snapshot.docs.forEach(doc => seenNotifIds.add(doc.id));
        isFirstSnapshot = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (!seenNotifIds.has(change.doc.id)) {
            seenNotifIds.add(change.doc.id);
            
            // Only play sound if it's NOT a message notification
            // (Message notifications are handled by the messages listener above)
            if (data.title !== 'Yeni Mesaj') {
              playNotification();
              showToast(`${data.title}: ${data.body}`, 'info', {
                onClick: () => {
                  if (data.link) navigate(data.link);
                }
              });
            }
          }
        }
      });
    });

    return () => unsubscribe();
  }, [userProfile?.uid, userProfile?.role, user?.emailVerified]);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG' || target.closest('img')) {
        e.preventDefault();
        return false;
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG' || target.closest('img')) {
        // This can sometimes help on older Androids, but be careful not to break scrolling
      }
    };

    window.addEventListener('contextmenu', handleContextMenu, { capture: true });
    return () => window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
  }, []);

  useEffect(() => {
    // Request notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          console.log('Notification permission granted.');
        }
      });
    }
  }, []);

  useEffect(() => {
    let bannedUnsubscribe: (() => void) | null = null;
    let profileUnsubscribe: (() => void) | null = null;
    let loadingTimeout: NodeJS.Timeout | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setLoading(true); // Ensure loading is true while fetching profile
        
        // Safety timeout: if profile doesn't load in 10 seconds, show retry button
        loadingTimeout = setTimeout(() => {
          setLoading(prev => {
            if (prev && !userProfile && !quotaExceeded) {
              console.warn("Profile loading timed out after 10s");
              return false;
            }
            return prev;
          });
        }, 10000);

        if (currentUser.email) {
          // Listen for ban status
          bannedUnsubscribe = onSnapshot(doc(db, 'bannedUsers', currentUser.email), async (docSnapshot) => {
            if (docSnapshot.exists()) {
              await signOut(auth);
              setUser(null);
              setUserProfile(null);
              setLoading(false);
              showToast('Hesabınız admin tərəfindən silinib və ya bloklanıb.', 'error');
            }
          }, (error) => {
            if (error.message.includes('Quota limit exceeded') || error.message.includes('quota exceeded')) {
              setQuotaExceeded(true);
              setLoading(false);
            } else {
              handleFirestoreError(error, OperationType.GET, `bannedUsers/${currentUser.email}`);
            }
          });
        }

        try {
          const userRef = doc(db, 'users', currentUser.uid);

          // Try to get from cache first to save quota
          try {
            const { getDocFromCache } = await import('firebase/firestore');
            const cachedDoc = await getDocFromCache(userRef);
            if (cachedDoc.exists()) {
              setUserProfile(cachedDoc.data() as UserProfile);
            }
          } catch (e) {
            // Cache miss is fine
          }

          // Listen for real-time profile updates (e.g., admin approval)
          profileUnsubscribe = onSnapshot(userRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
              const data = docSnapshot.data() as UserProfile;
              setUserProfile(data);
              setLoading(false);
              setQuotaExceeded(false);
              if (loadingTimeout) clearTimeout(loadingTimeout);
            }
          }, (error) => {
            if (error.message.includes('Quota limit exceeded') || error.message.includes('quota exceeded')) {
              setQuotaExceeded(true);
              setLoading(false);
            } else {
              try {
                handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
              } catch (e) {
                console.error("Firestore error handled:", e);
              }
            }
            setLoading(false);
            if (loadingTimeout) clearTimeout(loadingTimeout);
          });

          // Give registration a moment to finish its setDoc before we check for existence
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            const data = userDoc.data() as UserProfile;
            let updates: any = { isOnline: true };
            
            if (!data.userType) updates.userType = 'user';
            if (!data.status) updates.status = 'active';
            if (!data.uid) updates.uid = currentUser.uid;
            if (!data.email) updates.email = currentUser.email || '';

            if (currentUser.email?.toLowerCase() === 'rauf2289@gmail.com' && data.role !== 'admin') {
              updates.role = 'admin';
              updates.status = 'active';
            }
            
            await updateDoc(userRef, updates);
            
            await setDoc(doc(db, 'publicProfiles', currentUser.uid), {
              uid: currentUser.uid,
              displayName: data.displayName || currentUser.displayName || currentUser.email?.split('@')[0] || 'Anonim',
              photoURL: data.photoURL || currentUser.photoURL || '',
              isOnline: true,
              lastSeen: serverTimestamp(),
              userType: data.userType || 'user',
              status: data.status || 'active',
              showLocation: data.showLocation || false,
              location: data.location || null,
              phoneNumber: data.phoneNumber || ''
            }, { merge: true });

          } else {
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || '',
              photoURL: currentUser.photoURL || '',
              role: currentUser.email?.toLowerCase() === 'rauf2289@gmail.com' ? 'admin' : 'user',
              userType: 'user',
              status: 'active',
              isOnline: true,
              createdAt: serverTimestamp()
            };
            await setDoc(userRef, newProfile);
            
            await setDoc(doc(db, 'publicProfiles', currentUser.uid), {
              uid: currentUser.uid,
              displayName: newProfile.displayName || 'Anonim',
              photoURL: newProfile.photoURL || '',
              isOnline: true,
              lastSeen: serverTimestamp(),
              userType: 'user',
              status: 'active'
            });
          }

        } catch (error: any) {
          console.error("Error in auth state change handler:", error);
          setLoading(false);
          if (loadingTimeout) clearTimeout(loadingTimeout);
          
          if (error.message.includes('Quota limit exceeded') || error.message.includes('quota exceeded')) {
            setQuotaExceeded(true);
          } else {
            try {
              handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
            } catch (e) {
              // Error already logged by handleFirestoreError
            }
          }
        }
      } else {
        if (bannedUnsubscribe) {
          bannedUnsubscribe();
          bannedUnsubscribe = null;
        }
        if (profileUnsubscribe) {
          profileUnsubscribe();
          profileUnsubscribe = null;
        }
        if (loadingTimeout) {
          clearTimeout(loadingTimeout);
          loadingTimeout = null;
        }
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (bannedUnsubscribe) bannedUnsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
      if (loadingTimeout) clearTimeout(loadingTimeout);
    };
  }, []);

  const handleLogout = async () => {
    if (userProfile) {
      try {
        await updateDoc(doc(db, 'users', userProfile.uid), {
          isOnline: false,
          lastSeen: serverTimestamp()
        });
      } catch (e) {
        console.error("Failed to update online status", e);
      }
    }
    await signOut(auth);
    showToast('Sistemdən çıxış edildi.', 'info');
  };

  useEffect(() => {
    if (!userProfile?.uid) return;

    // Heartbeat to keep user online
    const heartbeatInterval = setInterval(async () => {
      try {
        const updates = {
          isOnline: true,
          lastSeen: serverTimestamp()
        };
        await updateDoc(doc(db, 'users', userProfile.uid), updates);
        await updateDoc(doc(db, 'publicProfiles', userProfile.uid), updates);
      } catch (e) {
        console.error("Heartbeat failed", e);
      }
    }, 600000); // Every 10 minutes (600000ms) to save Firebase quota

    const handleVisibilityChange = () => {
      const updates = {
        isOnline: document.visibilityState === 'visible',
        lastSeen: serverTimestamp()
      };
      updateDoc(doc(db, 'users', userProfile.uid), updates).catch(() => {});
      updateDoc(doc(db, 'publicProfiles', userProfile.uid), updates).catch(() => {});
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userProfile?.uid]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (userProfile?.uid) {
        // Use keepalive fetch or just try to update
        updateDoc(doc(db, 'users', userProfile.uid), {
          isOnline: false,
          lastSeen: serverTimestamp()
        }).catch(() => {});
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [userProfile?.uid]);

  const handleReload = async () => {
    if (user) {
      await user.reload();
      setUser({ ...auth.currentUser! });
      if (auth.currentUser?.emailVerified) {
        showToast('E-poçtunuz təsdiqləndi!', 'success');
      } else {
        showToast('E-poçt hələ təsdiqlənməyib.', 'info');
      }
    }
  };

  const handleResendEmail = async () => {
    if (user) {
      try {
        await sendEmailVerification(user);
        showToast('Təsdiqləmə linki yenidən göndərildi.', 'success');
      } catch (error: any) {
        console.error("Error resending verification email:", error);
        if (error.code === 'auth/too-many-requests') {
          showToast('Çox sayda sorğu göndərildi. Zəhmət olmasa bir az gözləyin.', 'error');
        } else {
          showToast('Xəta baş verdi. Yenidən cəhd edin.', 'error');
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col items-center justify-center relative overflow-hidden transition-colors duration-300">
        {/* Neon glow background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/20 rounded-full blur-[100px]" />
        
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="relative z-10 text-primary mb-8"
        >
          <Settings size={64} strokeWidth={1.5} />
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-center z-10"
        >
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-widest uppercase mb-2">RF Servis</h2>
          <p className="text-primary/60 text-sm font-mono tracking-widest uppercase">SİSTEM YÜKLƏNİR...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {!user ? (
        <Auth />
      ) : quotaExceeded ? (
        <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col items-center justify-center p-6 text-center transition-colors duration-300">
          <div className="w-20 h-20 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mb-6 shadow-inner">
            <RefreshCw size={40} className="animate-spin-slow" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase mb-4">Limit Dolub</h2>
          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-[2rem] max-w-md mx-auto shadow-xl mb-8">
            <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
              Google Firebase-in pulsuz gündəlik oxuma limiti tamamlanıb. Sistem Bakı vaxtı ilə səhər saatlarında avtomatik sıfırlanacaq.
            </p>
            <div className="h-px bg-slate-200 dark:bg-slate-700 my-4" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Bu müddət ərzində bəzi funksiyalar (forum, mağaza) işləməyə bilər. Zəhmət olmasa bir az sonra yenidən cəhd edin.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm justify-center">
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-cyan-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 active:scale-95"
            >
              <RefreshCw size={20} />
              Yenidən Yoxla
            </button>
            <button 
              onClick={handleLogout}
              className="px-8 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 active:scale-95"
            >
              <LogOut size={20} />
              Çıxış Et
            </button>
          </div>
        </div>
      ) : !userProfile ? (
        <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col items-center justify-center p-6 text-center transition-colors duration-300">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full mb-6"
          />
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-widest uppercase mb-2">RF Servis</h2>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mb-8">Profil yüklənir...</p>
          
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-primary text-white rounded-2xl font-bold hover:bg-cyan-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 active:scale-95"
            >
              <RefreshCw size={18} />
              Yenidən Cəhd Et
            </button>
            <button 
              onClick={handleLogout}
              className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 active:scale-95"
            >
              <LogOut size={18} />
              Hesabdan Çıx
            </button>
          </div>
          
          <p className="mt-8 text-[10px] text-slate-400 dark:text-slate-500 max-w-xs">
            Əgər yükləmə çox uzun çəkirsə, internet bağlantınızı yoxlayın və ya yenidən daxil olun.
          </p>
        </div>
      ) : userProfile?.banned ? (
          <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-center p-6 space-y-6">
            <div className="w-24 h-24 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center">
              <Ban size={48} />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white mb-2">Hesabınız Bloklanıb</h2>
              <p className="text-slate-400 max-w-md mx-auto">
                Qeyri-etik davranışlara və ya qayda pozuntularına görə hesabınız admin tərəfindən bloklanmışdır.
              </p>
            </div>
            <button 
              onClick={handleLogout}
              className="px-8 py-4 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-700 transition-colors flex items-center gap-2"
            >
              <LogOut size={20} />
              Hesabdan Çıx
            </button>
          </div>
        ) : userProfile && (userProfile.userType === 'master' || userProfile.userType === 'programmer') && (userProfile.status !== 'active' || !userProfile.workplaceName) ? (
          <VerificationView 
            userProfile={userProfile} 
            onLogout={handleLogout} 
          />
        ) : (
          <Layout 
            userProfile={userProfile} 
            isAdmin={userProfile?.role === 'admin' || user?.email?.toLowerCase() === 'rauf2289@gmail.com'} 
            onLogout={handleLogout}
            hasUnreadMessages={hasUnreadMessages}
            isDarkMode={isDarkMode}
            toggleTheme={toggleTheme}
            onImageClick={(src) => setPreviewImage(src)}
            pendingVerificationsCount={pendingVerificationsCount}
            onPlaySound={playNotification}
          >
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/forum" element={<Forum userProfile={userProfile} isAdmin={userProfile?.role === 'admin' || user?.email?.toLowerCase() === 'rauf2289@gmail.com'} onImageClick={(src) => setPreviewImage(src)} />} />
              <Route path="/repair" element={<RepairGuide />} />
              <Route path="/ic-search" element={<ICSearch />} />
              <Route path="/rf-ai" element={<RFAI />} />
              <Route path="/kit/:type" element={<FileManager isAdmin={userProfile?.role === 'admin' || user?.email?.toLowerCase() === 'rauf2289@gmail.com'} />} />
              <Route path="/shop" element={<Shop isAdmin={userProfile?.role === 'admin' || user?.email?.toLowerCase() === 'rauf2289@gmail.com'} />} />
              <Route path="/messages" element={
                <Messages 
                  userProfile={userProfile} 
                  onImageClick={(src) => setPreviewImage(src)} 
                  onPlaySound={playNotification}
                />
              } />
              <Route path="/contact" element={<Contact />} />
              <Route path="/admin" element={<AdminPanel isAdmin={userProfile?.role === 'admin' || user?.email?.toLowerCase() === 'rauf2289@gmail.com'} />} />
              <Route path="/masters" element={<NearbyMasters currentUserProfile={userProfile} isAdmin={userProfile?.role === 'admin' || user?.email?.toLowerCase() === 'rauf2289@gmail.com'} onImageClick={(src) => setPreviewImage(src)} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        )}
        {previewImage && (
          <ImageModal 
            src={previewImage} 
            onClose={() => setPreviewImage(null)} 
          />
        )}
      </ErrorBoundary>
  );
}
