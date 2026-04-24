import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { Bell, Check, Trash2 } from 'lucide-react';
import { AppNotification } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { az } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';

export default function NotificationsDropdown({ userId, isAdmin }: { userId: string, isAdmin?: boolean }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const initialLoad = useRef(true);

  useEffect(() => {
    const userIds = [userId, 'all'];
    if (isAdmin) {
      userIds.push('admin');
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', 'in', userIds)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as AppNotification & { deletedBy?: string[] }))
        .filter(n => !(n.deletedBy || []).includes(userId));
      
      // Re-sort in memory to fix the delay caused by pending server timestamps (which are null locally)
      notifs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || Date.now() + 100000;
        const timeB = b.createdAt?.toMillis?.() || Date.now() + 100000;
        return timeB - timeA;
      });

      if (initialLoad.current) {
        initialLoad.current = false;
      }

      setNotifications(notifs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    return () => unsubscribe();
  }, [userId, isAdmin]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read && n.userId !== 'all').length;

  const markAsRead = async (id: string, isGlobal: boolean) => {
    if (isGlobal) return; // Global notifications don't have per-user read status in this simple implementation
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  const deleteNotification = async (e: React.MouseEvent, id: string, isGlobal: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (isGlobal) {
        await updateDoc(doc(db, 'notifications', id), {
          deletedBy: arrayUnion(userId)
        });
      } else {
        await deleteDoc(doc(db, 'notifications', id));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notifications/${id}`);
    }
  };

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const deleteAllNotifications = async () => {
    if (notifications.length === 0) return;
    
    try {
      const promises = notifications.map(notif => {
        const isGlobal = notif.userId === 'all';
        if (isGlobal) {
          return updateDoc(doc(db, 'notifications', notif.id), {
            deletedBy: arrayUnion(userId)
          });
        } else {
          return deleteDoc(doc(db, 'notifications', notif.id));
        }
      });
      await Promise.all(promises);
      setShowClearConfirm(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'notifications/all');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 bg-slate-700 text-slate-300 hover:text-primary hover:bg-slate-600 rounded-xl transition-all active:scale-90"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-[300px] sm:w-80 max-w-[90vw] max-h-[400px] overflow-y-auto bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl z-50">
          <div className="p-3 border-b border-slate-700 flex justify-between items-center sticky top-0 bg-slate-800/95 backdrop-blur-sm">
            <h3 className="font-bold text-white text-sm">Bildirişlər</h3>
            {notifications.length > 0 && (
              <div className="flex items-center gap-2">
                {showClearConfirm ? (
                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
                    <button 
                      onClick={deleteAllNotifications}
                      className="text-red-400 hover:text-red-300 text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-red-500/10 rounded-lg transition-colors"
                    >
                      Təsdiqlə
                    </button>
                    <button 
                      onClick={() => setShowClearConfirm(false)}
                      className="text-slate-400 hover:text-slate-300 text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-slate-700 rounded-lg transition-colors"
                    >
                      Ləğv et
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowClearConfirm(true)}
                    className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider"
                    title="Hamısını sil"
                  >
                    <Trash2 size={14} />
                    <span>Hamısını sil</span>
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                Yeni bildiriş yoxdur.
              </div>
            ) : (
              notifications.map((notif) => {
                const isGlobal = notif.userId === 'all';
                return (
                  <Link
                    key={notif.id}
                    to={notif.link || '#'}
                    onClick={() => {
                      markAsRead(notif.id, isGlobal);
                      setIsOpen(false);
                    }}
                    className={`p-4 border-b border-slate-700/50 hover:bg-slate-700/50 transition-colors flex flex-col gap-1 ${
                      !notif.read && !isGlobal ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <h4 className={`text-sm font-bold break-words ${!notif.read && !isGlobal ? 'text-white' : 'text-slate-300'}`}>
                        {notif.title}
                      </h4>
                      <button 
                        onClick={(e) => deleteNotification(e, notif.id, isGlobal)}
                        className="text-slate-500 hover:text-red-400 p-1 shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed break-words whitespace-pre-wrap">{notif.body}</p>
                    <span className="text-[10px] text-slate-500 mt-1">
                      {notif.createdAt 
                        ? formatDistanceToNow(
                            typeof notif.createdAt.toDate === 'function' ? notif.createdAt.toDate() : new Date(notif.createdAt as any), 
                            { addSuffix: true, locale: az }
                          ) 
                        : 'İndi'}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
