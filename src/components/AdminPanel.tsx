import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, addDoc, setDoc, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { ShieldCheck, User as UserIcon, Trash2, Mail, ShieldAlert, Ban, MessageSquare, X, ShoppingBag, CheckCircle, XCircle, Server, DollarSign, Megaphone, Monitor, Sparkles, Save, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, Message, PurchaseRequest, FrpRequest, Product } from '../types';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { formatDistanceToNow } from 'date-fns';
import { az } from 'date-fns/locale';
import AdManager from './AdManager';
import { uploadImage, resizeImageForStorage } from '../utils/storage';

export default function AdminPanel({ isAdmin }: { isAdmin: boolean }) {
  const [activeTab, setActiveTab] = useState<'users' | 'approvals' | 'orders' | 'frp' | 'ads' | 'ai'>('users');

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [frpRequests, setFrpRequests] = useState<FrpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [frpLoading, setFrpLoading] = useState(true);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [frpToDelete, setFrpToDelete] = useState<string | null>(null);
  const [viewingMessagesFor, setViewingMessagesFor] = useState<UserProfile | null>(null);
  const [viewingVerificationFor, setViewingVerificationFor] = useState<UserProfile | null>(null);
  const [userMessages, setUserMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [editingPrice, setEditingPrice] = useState<{id: string, price: string} | null>(null);
  const [geminiKey, setGeminiKey] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    const unsubscribe = onSnapshot(doc(db, 'settings', 'ai_config'), (snapshot) => {
      if (snapshot.exists()) {
        setGeminiKey(snapshot.data().geminiApiKey || '');
      }
    });
    return () => unsubscribe();
  }, [isAdmin]);

  const handleSaveAIKey = async () => {
    if (!isAdmin) return;
    setIsSavingKey(true);
    try {
      await setDoc(doc(db, 'settings', 'ai_config'), {
        geminiApiKey: geminiKey,
        updatedAt: serverTimestamp()
      }, { merge: true });
      alert('API açarı uğurla yadda saxlanıldı!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE);
    } finally {
      setIsSavingKey(false);
    }
  };

  useEffect(() => {
    if (!viewingMessagesFor) {
      setUserMessages([]);
      return;
    }

    setMessagesLoading(true);
    const q = query(
      collection(db, 'messages'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Message))
        .filter(msg => msg.senderId === viewingMessagesFor.uid || msg.receiverId === viewingMessagesFor.uid);
      setUserMessages(msgs);
      setMessagesLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST);
      setMessagesLoading(false);
    });

    return () => unsubscribe();
  }, [viewingMessagesFor]);

  useEffect(() => {
    if (!isAdmin) return;

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        ...doc.data(),
        uid: doc.id
      })) as UserProfile[];
      setUsers(usersData.filter(u => u.status !== 'pending'));
      setPendingUsers(usersData.filter(u => u.status === 'pending'));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST);
      setLoading(false);
    });

    const qOrders = query(collection(db, 'purchaseRequests'), orderBy('createdAt', 'desc'));
    const unsubscribeOrders = onSnapshot(qOrders, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PurchaseRequest[];
      setPurchaseRequests(ordersData);
      setOrdersLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'purchaseRequests');
      setOrdersLoading(false);
    });

    const qFrp = query(collection(db, 'frpRequests'), orderBy('createdAt', 'desc'));
    const unsubscribeFrp = onSnapshot(qFrp, (snapshot) => {
      const frpData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FrpRequest[];
      setFrpRequests(frpData);
      setFrpLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'frpRequests');
      setFrpLoading(false);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeOrders();
      unsubscribeFrp();
    };
  }, [isAdmin]);

  const handleStatusChange = async (userId: string, newStatus: 'active' | 'rejected') => {
    try {
      const targetUser = users.find(u => u.uid === userId) || pendingUsers.find(u => u.uid === userId);
      const isLeadership = targetUser?.email?.toLowerCase() === 'rauf2289@gmail.com';
      const isCurrentUserLeadership = auth.currentUser?.email?.toLowerCase() === 'rauf2289@gmail.com';

      if (isLeadership && !isCurrentUserLeadership) {
        alert('Rəhbərliyin statusunu dəyişmək səlahiyyətiniz yoxdur.');
        return;
      }

      await updateDoc(doc(db, 'users', userId), { status: newStatus });
      
      // Update public profile status as well
      await setDoc(doc(db, 'publicProfiles', userId), { 
        status: newStatus 
      }, { merge: true }).catch(() => {});

      // Notify user
      await addDoc(collection(db, 'notifications'), {
        userId: userId,
        title: 'Hesab Statusu',
        body: `Hesabınız admin tərəfindən ${newStatus === 'active' ? 'təsdiqləndi!' : 'rədd edildi.'}`,
        link: '/',
        createdAt: serverTimestamp(),
        read: false
      });

      // Send automated welcome message if approved
      if (newStatus === 'active' && auth.currentUser) {
        const adminUid = auth.currentUser.uid;
        const adminName = auth.currentUser.displayName || 'RF Servis Rəhbərlik';
        const chatId = [adminUid, userId].sort().join('_');
        const welcomeText = "Salam, dəyərli həmkar! 🛠️ RF Servis təmir və proqram asistanına xoş gəldin! Bu platforma sırf ustalar və proqramistlər üçün, işimizi daha da asanlaşdırmaq və bir-birimizə dəstək olmaq məqsədilə yaradılıb.\n\nTətbiqimizi daha da mükəmməlləşdirmək üçün sizin kimi peşəkarların fikri bizim üçün çox önəmlidir. Proqram haqqında ilk təəssüratlarınız necədir? Tətbiqdə nələri bəyəndiniz, nələrin əlavə olunmasını və ya dəyişdirilməsini istərdiniz?\n\nZəhmət olmasa, fikirlərinizi bizimlə bölüşməkdən çəkinməyin.";

        await addDoc(collection(db, 'messages'), {
          chatId,
          senderId: adminUid,
          senderName: adminName,
          receiverId: userId,
          content: welcomeText,
          createdAt: serverTimestamp(),
          read: false
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleRoleChange = async (userId: string, newValue: string) => {
    try {
      const targetUser = users.find(u => u.uid === userId);
      const isLeadership = targetUser?.email?.toLowerCase() === 'rauf2289@gmail.com';
      const isCurrentUserLeadership = auth.currentUser?.email?.toLowerCase() === 'rauf2289@gmail.com';

      if (isLeadership && !isCurrentUserLeadership) {
        alert('Rəhbərliyin rolunu dəyişmək səlahiyyətiniz yoxdur.');
        return;
      }

      let updates: any = {};
      if (newValue === 'admin') {
        updates = { role: 'admin', userType: 'user' };
      } else if (newValue === 'user') {
        updates = { role: 'user', userType: 'user' };
      } else if (newValue === 'master') {
        updates = { role: 'user', userType: 'master' };
      } else if (newValue === 'programmer') {
        updates = { role: 'user', userType: 'programmer' };
      }

      await updateDoc(doc(db, 'users', userId), updates);
      await setDoc(doc(db, 'publicProfiles', userId), {
        userType: updates.userType,
        role: updates.role,
        status: 'active' // If role is being changed by admin, they are likely active
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleBanToggle = async (user: UserProfile) => {
    try {
      await updateDoc(doc(db, 'users', user.uid), { banned: !user.banned });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    try {
      const user = users.find(u => u.uid === userToDelete);
      if (user && user.email) {
        await setDoc(doc(db, 'bannedUsers', user.email), {
          email: user.email,
          deletedAt: serverTimestamp()
        });
      }
      await deleteDoc(doc(db, 'users', userToDelete));
      await deleteDoc(doc(db, 'publicProfiles', userToDelete)).catch(() => {});
      setUserToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userToDelete}`);
    }
  };

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    try {
      await deleteDoc(doc(db, 'purchaseRequests', orderToDelete));
      setOrderToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `purchaseRequests/${orderToDelete}`);
    }
  };

  const confirmDeleteFrp = async () => {
    if (!frpToDelete) return;
    try {
      await deleteDoc(doc(db, 'frpRequests', frpToDelete));
      setFrpToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `frpRequests/${frpToDelete}`);
    }
  };

  const handleOrderStatus = async (orderId: string, status: 'approved' | 'rejected', userId: string, productName: string) => {
    try {
      await updateDoc(doc(db, 'purchaseRequests', orderId), { status });
      
      // Notify user
      await addDoc(collection(db, 'notifications'), {
        userId: userId,
        title: 'Sifariş Statusu',
        body: `"${productName}" sifarişiniz ${status === 'approved' ? 'təsdiqləndi! İndi yükləyə bilərsiniz.' : 'rədd edildi.'}`,
        link: '/shop',
        createdAt: serverTimestamp(),
        read: false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `purchaseRequests/${orderId}`);
    }
  };

  const handleFrpStatus = async (requestId: string, status: 'completed' | 'rejected', userId: string, phoneModel: string) => {
    try {
      await updateDoc(doc(db, 'frpRequests', requestId), { status, updatedAt: serverTimestamp() });
      
      // Notify user
      await addDoc(collection(db, 'notifications'), {
        userId: userId,
        title: 'FRP Sorğusu Statusu',
        body: `"${phoneModel}" üçün FRP sorğunuz ${status === 'completed' ? 'Bitti, cihazı yenidən başladın' : 'rədd edildi.'}`,
        link: '/',
        createdAt: serverTimestamp(),
        read: false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `frpRequests/${requestId}`);
    }
  };

  const handleSetFrpPrice = async (requestId: string, price: number, userId: string, phoneModel: string) => {
    try {
      await updateDoc(doc(db, 'frpRequests', requestId), { 
        price, 
        status: 'price_set',
        updatedAt: serverTimestamp() 
      });
      
      // Notify user
      await addDoc(collection(db, 'notifications'), {
        userId: userId,
        title: 'FRP Qiyməti Təyin Edildi',
        body: `"${phoneModel}" üçün FRP sorğusuna ${price} AZN qiymət təyin edildi. Ödəniş edə bilərsiniz.`,
        link: '/',
        createdAt: serverTimestamp(),
        read: false
      });
      setEditingPrice(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `frpRequests/${requestId}`);
    }
  };

  const isUserOnline = (user: UserProfile) => {
    if (!user.isOnline) return false;
    if (!user.lastSeen) return user.isOnline;
    
    const lastSeenTime = user.lastSeen.toMillis?.() || 0;
    const now = Date.now();
    return (now - lastSeenTime) < 120000;
  };

  const formatUserDate = (date: any) => {
    if (!date) return null;
    try {
      const d = date.toDate ? date.toDate() : new Date(date);
      return formatDistanceToNow(d, { addSuffix: true, locale: az });
    } catch (e) {
      return null;
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <ShieldAlert size={48} className="text-red-500" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Giriş Qadağandır</h2>
        <p className="text-slate-500 dark:text-slate-400">Bu səhifəyə daxil olmaq üçün admin hüquqlarınız yoxdur.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 bg-white dark:bg-slate-900 min-h-screen pb-32 transition-colors duration-300">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="text-primary" size={24} />
          Admin Panel
        </h2>
        <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Cəmi İstifadəçi: </span>
          <span className="text-sm font-black text-primary">{users.length}</span>
          <button
            onClick={() => setActiveTab('ai')}
            className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
              activeTab === 'ai' 
                ? 'bg-primary text-white shadow-lg shadow-cyan-500/20' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Sparkles size={16} />
            AI Ayarları
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-700 pb-2 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors whitespace-nowrap ${
            activeTab === 'users' ? 'bg-primary text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          İstifadəçilər
        </button>
        <button
          onClick={() => setActiveTab('approvals')}
          className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'approvals' ? 'bg-primary text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Təsdiqlər
          {pendingUsers.length > 0 && (
            <span className="bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full">
              {pendingUsers.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'orders' ? 'bg-primary text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Sifarişlər
          {purchaseRequests.filter(r => r.status === 'pending').length > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">
              {purchaseRequests.filter(r => r.status === 'pending').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('frp')}
          className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'frp' ? 'bg-primary text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          FRP Sorğuları
          {frpRequests.filter(r => r.status === 'pending' || r.status === 'paid').length > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">
              {frpRequests.filter(r => r.status === 'pending' || r.status === 'paid').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('ads')}
          className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'ads' ? 'bg-primary text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Megaphone size={16} />
          Reklamlar
        </button>
      </div>

      {activeTab === 'users' ? (
        <div className="space-y-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={`user-skeleton-${i}`} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 animate-pulse flex items-center gap-4 shadow-lg shadow-slate-200 dark:shadow-none">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded w-1/3"></div>
                  <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-1/2"></div>
                </div>
              </div>
            ))
          ) : (
            users.map((user) => (
              <div
                key={user.uid}
                className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-200 dark:shadow-slate-900/50 flex flex-col sm:flex-row sm:items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-400 shrink-0 relative">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <UserIcon size={24} />
                    )}
                    {isUserOnline(user) && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full shadow-lg shadow-emerald-500/20"></div>
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="font-black text-slate-900 dark:text-white text-sm truncate flex items-center gap-2">
                      {user.displayName || 'Adsız İstifadəçi'}
                      {user.email?.toLowerCase() === 'rauf2289@gmail.com' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          Rəhbərlik
                        </span>
                      ) : user.role === 'admin' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          Admin
                        </span>
                      ) : (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                          user.userType === 'master' ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30' :
                          user.userType === 'programmer' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30' :
                          'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-transparent'
                        }`}>
                          {user.userType === 'master' ? 'Usta' : user.userType === 'programmer' ? 'Proqramist' : 'İstifadəçi'}
                        </span>
                      )}
                      {user.banned && <span className="bg-red-500/20 text-red-500 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">Bloklanıb</span>}
                      {isUserOnline(user) && <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Onlayn</span>}
                    </h3>
                    <div className="flex flex-col gap-1 mt-1">
                      <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-xs">
                        <Mail size={12} />
                        <span className="truncate">{user.email}</span>
                      </div>
                      {user.createdAt && formatUserDate(user.createdAt) && (
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                          Qeydiyyat: {formatUserDate(user.createdAt)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-700">
                  <button
                    onClick={() => setViewingMessagesFor(user)}
                    className="p-2 bg-slate-50 dark:bg-slate-900 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-colors"
                    title="Mesajlara bax"
                  >
                    <MessageSquare size={18} />
                  </button>

                  <button
                    onClick={() => handleBanToggle(user)}
                    disabled={user.email?.toLowerCase() === 'rauf2289@gmail.com'}
                    className={`p-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      user.banned 
                        ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' 
                        : 'bg-slate-50 dark:bg-slate-900 text-slate-400 hover:text-orange-500 hover:bg-orange-500/10'
                    }`}
                    title={user.banned ? "Blokdan çıxar" : "Blokla"}
                  >
                    <Ban size={18} />
                  </button>

                  <select
                    value={user.role === 'admin' ? 'admin' : (user.userType || 'user')}
                    onChange={(e) => handleRoleChange(user.uid, e.target.value)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border outline-none transition-colors ${
                      user.role === 'admin' 
                        ? 'bg-primary/20 text-primary border-primary/30' 
                        : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 focus:border-primary'
                    }`}
                  >
                    <option value="user">İstifadəçi</option>
                    <option value="master">Usta</option>
                    <option value="programmer">Proqramist</option>
                    <option value="admin">{user.email?.toLowerCase() === 'rauf2289@gmail.com' ? 'Rəhbərlik' : 'Admin'}</option>
                  </select>

                  <button
                    onClick={() => setUserToDelete(user.uid)}
                    disabled={user.email?.toLowerCase() === 'rauf2289@gmail.com'}
                    className="p-2 bg-slate-50 dark:bg-slate-900 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="İstifadəçini sil"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'approvals' ? (
        <div className="space-y-4">
          {pendingUsers.length > 0 ? (
            pendingUsers.map((user) => (
              <div
                key={user.uid}
                className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-200 dark:shadow-slate-900/50 flex flex-col sm:flex-row sm:items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-400 shrink-0">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <UserIcon size={24} />
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="font-black text-slate-900 dark:text-white text-sm truncate flex items-center gap-2">
                      {user.displayName || 'Adsız İstifadəçi'}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                        user.userType === 'master' ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30' :
                        'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30'
                      }`}>
                        {user.userType === 'master' ? 'Usta' : 'Proqramist'}
                      </span>
                    </h3>
                    <div className="flex flex-col gap-1 mt-1">
                      <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-xs">
                        <Mail size={12} />
                        <span className="truncate">{user.email}</span>
                      </div>
                      {user.createdAt && formatUserDate(user.createdAt) && (
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                          Qeydiyyat: {formatUserDate(user.createdAt)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-700">
                  {(user.workplaceName || user.shopPhotoURL || user.equipmentPhotoURL) && (
                    <button
                      onClick={() => setViewingVerificationFor(user)}
                      className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors"
                      title="Təsdiq məlumatlarına bax"
                    >
                      <ShieldCheck size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => handleStatusChange(user.uid, 'active')}
                    className="flex-1 sm:flex-none px-4 py-2 bg-emerald-500/20 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl transition-all flex items-center justify-center gap-1 text-xs font-bold"
                  >
                    <CheckCircle size={16} />
                    Təsdiqlə
                  </button>
                  <button
                    onClick={() => handleStatusChange(user.uid, 'rejected')}
                    className="flex-1 sm:flex-none px-4 py-2 bg-red-500/20 text-red-600 dark:text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all flex items-center justify-center gap-1 text-xs font-bold"
                  >
                    <XCircle size={16} />
                    Rədd et
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-white dark:bg-slate-800/50 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-700 shadow-lg shadow-slate-200 dark:shadow-none">
              <ShieldCheck size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Gözləyən təsdiq yoxdur</p>
            </div>
          )}
        </div>
      ) : activeTab === 'orders' ? (
        <div className="space-y-4">
          {ordersLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={`order-skeleton-${i}`} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 animate-pulse flex items-center gap-4 shadow-lg shadow-slate-200 dark:shadow-none">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded w-1/3"></div>
                  <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-1/2"></div>
                </div>
              </div>
            ))
          ) : purchaseRequests.length > 0 ? (
            purchaseRequests.map((request) => (
              <div
                key={request.id}
                className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-200 dark:shadow-slate-900/50 flex flex-col sm:flex-row sm:items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-400 shrink-0">
                    <ShoppingBag size={24} />
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="font-black text-slate-900 dark:text-white text-sm truncate flex items-center gap-2">
                      {request.productName}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        request.status === 'pending' ? 'bg-orange-500/20 text-orange-600 dark:text-orange-500' :
                        request.status === 'approved' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-500' :
                        'bg-red-500/20 text-red-600 dark:text-red-500'
                      }`}>
                        {request.status === 'pending' ? 'Gözləyir' : request.status === 'approved' ? 'Təsdiqlənib' : 'Rədd edilib'}
                      </span>
                    </h3>
                    <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-xs mt-1">
                      <UserIcon size={12} />
                      <span className="truncate">{request.userName} ({request.userEmail})</span>
                    </div>
                    <div className="text-xs font-bold text-primary mt-1">
                      {request.price} AZN
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-700">
                  {request.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleOrderStatus(request.id, 'approved', request.userId, request.productName)}
                        className="p-2 bg-emerald-500/20 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl transition-colors flex items-center gap-1 text-xs font-bold"
                      >
                        <CheckCircle size={16} />
                        Təsdiqlə
                      </button>
                      <button
                        onClick={() => handleOrderStatus(request.id, 'rejected', request.userId, request.productName)}
                        className="p-2 bg-red-500/20 text-red-600 dark:text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-colors flex items-center gap-1 text-xs font-bold"
                      >
                        <XCircle size={16} />
                        Rədd et
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setOrderToDelete(request.id)}
                    className="p-2 bg-slate-50 dark:bg-slate-900 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                    title="Sifarişi sil"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-slate-500 py-8">
              Sifariş tapılmadı.
            </div>
          )}
        </div>
      ) : activeTab === 'frp' ? (
        <div className="space-y-4">
          {frpLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={`frp-skeleton-${i}`} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 animate-pulse flex items-center gap-4 shadow-lg shadow-slate-200 dark:shadow-none">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded w-1/3"></div>
                  <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-1/2"></div>
                </div>
              </div>
            ))
          ) : frpRequests.length > 0 ? (
            frpRequests.map((request) => (
              <div
                key={request.id}
                className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-200 dark:shadow-slate-900/50 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-400 shrink-0">
                    <Server size={24} />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex justify-between items-start">
                      <h3 className="font-black text-slate-900 dark:text-white text-sm truncate flex items-center gap-2">
                        {request.phoneModel}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          request.status === 'pending' ? 'bg-orange-500/20 text-orange-600 dark:text-orange-500' :
                          request.status === 'price_set' ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-500' :
                          request.status === 'paid' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-500' :
                          request.status === 'completed' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-500' :
                          'bg-red-500/20 text-red-600 dark:text-red-500'
                        }`}>
                          {request.status === 'pending' ? 'Gözləyir' : 
                           request.status === 'price_set' ? 'Qiymət təyin edilib' : 
                           request.status === 'paid' ? 'FRP işlənir' :
                           request.status === 'completed' ? 'Bitti' : 'Rədd edilib'}
                        </span>
                      </h3>
                      <span className="text-[10px] text-slate-500">
                        {request.createdAt ? formatDistanceToNow(request.createdAt.toDate(), { addSuffix: true, locale: az }) : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold">Android: <span className="text-slate-900 dark:text-slate-200">{request.androidVersion || '-'}</span></div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold">IMEI: <span className="text-slate-900 dark:text-slate-200">{request.imei}</span></div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold">S/N: <span className="text-slate-900 dark:text-slate-200">{request.serialNumber || '-'}</span></div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold">İstifadəçi: <span className="text-slate-900 dark:text-slate-200">{request.userName}</span></div>
                    </div>
                    {request.price && (
                      <div className="text-xs font-bold text-primary mt-2">
                        Qiymət: {request.price} AZN
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                  {request.status === 'pending' && (
                    <div className="flex gap-2 flex-1">
                      {editingPrice?.id === request.id ? (
                        <div className="flex gap-2 flex-1">
                          <input 
                            type="number"
                            placeholder="Qiymət"
                            value={editingPrice.price}
                            onChange={(e) => setEditingPrice({...editingPrice, price: e.target.value})}
                            className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-primary"
                          />
                          <button 
                            onClick={() => handleSetFrpPrice(request.id, Number(editingPrice.price), request.userId, request.phoneModel)}
                            className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold"
                          >
                            Təsdiqlə
                          </button>
                          <button 
                            onClick={() => setEditingPrice(null)}
                            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white rounded-xl text-xs font-bold"
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingPrice({id: request.id, price: ''})}
                          className="flex-1 py-2 bg-cyan-500/20 text-cyan-600 dark:text-cyan-500 hover:bg-cyan-500 hover:text-white rounded-xl transition-colors flex items-center justify-center gap-1 text-xs font-bold"
                        >
                          <DollarSign size={16} />
                          Qiymət Təyin Et
                        </button>
                      )}
                    </div>
                  )}

                  {request.status === 'paid' && (
                    <button
                      onClick={() => handleFrpStatus(request.id, 'completed', request.userId, request.phoneModel)}
                      className="flex-1 py-2 bg-emerald-500/20 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl transition-colors flex items-center justify-center gap-1 text-xs font-bold"
                    >
                      <CheckCircle size={16} />
                      FRP-ni Tamamla
                    </button>
                  )}

                  {(request.status === 'pending' || request.status === 'price_set' || request.status === 'paid') && (
                    <button
                      onClick={() => handleFrpStatus(request.id, 'rejected', request.userId, request.phoneModel)}
                      className="p-2 bg-red-500/20 text-red-600 dark:text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-colors flex items-center gap-1 text-xs font-bold"
                    >
                      <XCircle size={16} />
                      Rədd et
                    </button>
                  )}

                  <button
                    onClick={() => setFrpToDelete(request.id)}
                    className="p-2 bg-slate-50 dark:bg-slate-900 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                    title="Sorğunu sil"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-slate-500 py-8">
              FRP sorğusu tapılmadı.
            </div>
          )}
        </div>
      ) : activeTab === 'ai' ? (
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-xl">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
                <Sparkles size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">RF AI Tənzimləmələri</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">Süni İntellekt Konfiqurasiyası</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Gemini API Key</label>
                <div className="relative">
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AI Studio-dan aldığınız API açarını bura yazın..."
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm outline-none focus:border-primary transition-colors font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium ml-1">
                  Bu açar saytın canlı versiyasında RF AI-nın işləməsi üçün vacibdir.
                </p>
              </div>

              <button
                onClick={handleSaveAIKey}
                disabled={isSavingKey}
                className="w-full py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSavingKey ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                Yadda Saxla
              </button>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-[2rem]">
            <div className="flex gap-4">
              <ShieldAlert className="text-amber-500 shrink-0" size={24} />
              <div className="space-y-1">
                <h4 className="text-sm font-black text-amber-600 dark:text-amber-400 uppercase tracking-tight">Təhlükəsizlik Xəbərdarlığı</h4>
                <p className="text-xs text-amber-600/80 dark:text-amber-400/80 font-medium leading-relaxed">
                  API açarını yadda saxladıqdan sonra o, bazada şifrələnmiş şəkildə saxlanılacaq. 
                  Yalnız təsdiqlənmiş ustalar və proqramistlər AI-dan istifadə edə biləcək.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'ads' ? (
        <AdManager />
      ) : null}

      {/* Verification Modal */}
      <AnimatePresence>
        {viewingVerificationFor && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm sticky top-0">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-widest text-sm">
                  <ShieldCheck size={18} className="text-primary" />
                  Təsdiq Məlumatları
                </h3>
                <button 
                  onClick={() => setViewingVerificationFor(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">İş Yerinin Adı</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{viewingVerificationFor.workplaceName || 'Qeyd edilməyib'}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Ünvan</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{viewingVerificationFor.workplaceAddress || 'Qeyd edilməyib'}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Dükan Şəkli</p>
                    <div className="aspect-video bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                      {viewingVerificationFor.shopPhotoURL ? (
                        <img src={viewingVerificationFor.shopPhotoURL} alt="Shop" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs italic">Şəkil yüklənməyib</div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Avadanlıq Şəkli</p>
                    <div className="aspect-video bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                      {viewingVerificationFor.equipmentPhotoURL ? (
                        <img src={viewingVerificationFor.equipmentPhotoURL} alt="Equipment" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs italic">Şəkil yüklənməyib</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex gap-3">
                <button
                  onClick={() => {
                    handleStatusChange(viewingVerificationFor.uid, 'active');
                    setViewingVerificationFor(null);
                  }}
                  className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform"
                >
                  Təsdiqlə
                </button>
                <button
                  onClick={() => {
                    handleStatusChange(viewingVerificationFor.uid, 'rejected');
                    setViewingVerificationFor(null);
                  }}
                  className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-500/20 active:scale-95 transition-transform"
                >
                  Rədd et
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Modal */}
      <AnimatePresence>
        {viewingMessagesFor && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm sticky top-0">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <MessageSquare size={18} className="text-primary" />
                    {viewingMessagesFor.displayName || 'Adsız İstifadəçi'} - Mesajları
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{viewingMessagesFor.email}</p>
                </div>
                <button 
                  onClick={() => setViewingMessagesFor(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messagesLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : userMessages.length === 0 ? (
                  <div className="text-center text-slate-500 py-8">
                    Bu istifadəçinin heç bir mesajı yoxdur.
                  </div>
                ) : (
                  userMessages.map(msg => {
                    const isSender = msg.senderId === viewingMessagesFor.uid;
                    return (
                      <div key={msg.id} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50">
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-xs font-bold px-2 py-1 rounded-md ${isSender ? 'bg-primary/20 text-primary' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                            {isSender ? 'Göndərən' : 'Alan'}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {msg.createdAt ? formatDistanceToNow(msg.createdAt.toDate(), { addSuffix: true, locale: az }) : 'İndi'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 break-words">{msg.content}</p>
                        <div className="mt-2 text-[10px] text-slate-500 flex gap-2">
                          <span>Göndərən ID: {msg.senderId}</span>
                          <span>•</span>
                          <span>Alan ID: {msg.receiverId}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl max-w-sm w-full border border-slate-200 dark:border-slate-700 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">İstifadəçini silmək istədiyinizə əminsiniz?</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
              Bu əməliyyat istifadəçinin məlumatlarını bazadan siləcək. (Qeyd: Auth sistemindən tam silinməsi üçün Firebase Console-dan da silinməlidir).
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setUserToDelete(null)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Ləğv et
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Order Confirmation Modal */}
      {orderToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl max-w-sm w-full border border-slate-200 dark:border-slate-700 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Sifarişi silmək istədiyinizə əminsiniz?</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
              Bu əməliyyat sifarişi bazadan həmişəlik siləcək və geri qaytarmaq mümkün olmayacaq.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setOrderToDelete(null)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Ləğv et
              </button>
              <button 
                onClick={confirmDeleteOrder}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete FRP Confirmation Modal */}
      {frpToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl max-w-sm w-full border border-slate-200 dark:border-slate-700 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Sorğunu silmək istədiyinizə əminsiniz?</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
              Bu əməliyyat FRP sorğusunu bazadan həmişəlik siləcək.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setFrpToDelete(null)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Ləğv et
              </button>
              <button 
                onClick={confirmDeleteFrp}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
