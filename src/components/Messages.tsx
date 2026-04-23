import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, where, updateDoc, doc, setDoc, or, and, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { MessageSquare, Send, User as UserIcon, ArrowLeft, Search, CheckCheck } from 'lucide-react';
import { UserProfile, Message } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { az } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';

export default function Messages({ userProfile, onImageClick }: { userProfile: UserProfile | null, onImageClick?: (src: string) => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChatUserIds, setActiveChatUserIds] = useState<Set<string>>(new Set());
  const [chatTimestamps, setChatTimestamps] = useState<Map<string, number>>(new Map());
  const [unreadSenders, setUnreadSenders] = useState<Set<string>>(new Set());
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialLoad = useRef(true);

  useEffect(() => {
    if (!userProfile) return;

    const q = query(
      collection(db, 'publicProfiles'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs
        .map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile))
        .filter(u => u.uid !== userProfile.uid);
      setUsers(usersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'publicProfiles');
    });

    return () => unsubscribe();
  }, [userProfile]);

  useEffect(() => {
    const targetUserId = searchParams.get('userId');
    if (targetUserId && users.length > 0) {
      const targetUser = users.find(u => u.uid === targetUserId);
      if (targetUser && (!selectedUser || selectedUser.uid !== targetUserId)) {
        setSelectedUser(targetUser);
        searchParams.delete('userId');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, users, selectedUser, setSearchParams]);

  const [allMessages, setAllMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!userProfile) return;

    const q = query(
      collection(db, 'messages'),
      or(
        where('senderId', '==', userProfile.uid),
        where('receiverId', '==', userProfile.uid)
      ),
      orderBy('createdAt', 'desc'),
      limit(200)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatIds = new Set<string>();
      const timestamps = new Map<string, number>();
      const unread = new Set<string>();
      
      const allMsgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message));

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const isIncoming = data.receiverId === userProfile.uid;
        const otherId = isIncoming ? data.senderId : data.receiverId;
        
        chatIds.add(otherId);
        const time = data.createdAt?.toMillis?.() || Date.now();
        const current = timestamps.get(otherId) || 0;
        if (time > current) {
          timestamps.set(otherId, time);
        }
        if (isIncoming && data.read === false) {
          unread.add(otherId);
        }
      });
      
      setActiveChatUserIds(chatIds);
      setChatTimestamps(timestamps);
      setUnreadSenders(unread);
      setAllMessages(allMsgs);

      if (initialLoad.current) {
        initialLoad.current = false;
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });

    return () => unsubscribe();
  }, [userProfile]);

  useEffect(() => {
    if (!userProfile || !selectedUser) return;

    const chatId = [userProfile.uid, selectedUser.uid].sort().join('_');

    // Listen for typing status
    const unsubTyping = onSnapshot(doc(db, 'chats', chatId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.typing && data.typing[selectedUser.uid]) {
          setIsOtherTyping(true);
        } else {
          setIsOtherTyping(false);
        }
      } else {
        setIsOtherTyping(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'chats');
    });

    const chatMsgs = allMessages.filter(m => m.chatId === chatId);

    // Mark unread messages as read
    chatMsgs.forEach(m => {
      if (m.receiverId === userProfile.uid && m.read === false) {
        updateDoc(doc(db, 'messages', m.id), { read: true }).catch(err => {
          console.error('Failed to mark message as read', err);
        });
      }
    });

    // Fix delay for pending messages (null timestamp) by sorting them to the bottom
    chatMsgs.sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || Date.now() + 100000;
      const timeB = b.createdAt?.toMillis?.() || Date.now() + 100000;
      return timeA - timeB;
    });

    setMessages(chatMsgs);
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    return () => {
      unsubTyping();
    };
  }, [selectedUser, userProfile, allMessages]);

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    if (!selectedUser || !userProfile) return;
    const chatId = [userProfile.uid, selectedUser.uid].sort().join('_');
    
    // Set typing to true
    setDoc(doc(db, 'chats', chatId), {
      typing: { [userProfile.uid]: true }
    }, { merge: true }).catch(() => {});

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setDoc(doc(db, 'chats', chatId), {
        typing: { [userProfile.uid]: false }
      }, { merge: true }).catch(() => {});
    }, 2000);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser || !userProfile) return;

    const messageContent = newMessage;
    setNewMessage('');
    const chatId = [userProfile.uid, selectedUser.uid].sort().join('_');

    try {
      // Clear typing status when message is sent
      setDoc(doc(db, 'chats', chatId), {
        typing: { [userProfile.uid]: false }
      }, { merge: true }).catch(() => {});

      await addDoc(collection(db, 'messages'), {
        chatId,
        senderId: userProfile.uid,
        senderName: userProfile.displayName || 'Anonim',
        receiverId: selectedUser.uid,
        content: messageContent,
        createdAt: serverTimestamp(),
        read: false
      });

      await addDoc(collection(db, 'notifications'), {
        userId: selectedUser.uid,
        title: 'Yeni Mesaj',
        body: `${userProfile.displayName || 'Anonim'} sizə mesaj göndərdi.`,
        link: `/messages?userId=${userProfile.uid}`,
        createdAt: serverTimestamp(),
        read: false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'messages');
    }
  };

  const filteredUsers = users.filter(u => {
    if (searchQuery.trim() === '') {
      return true; // Show all users by default
    }
    const searchLower = searchQuery.toLowerCase();
    const nameMatch = (u.displayName || '').toLowerCase().includes(searchLower);
    const emailMatch = (u.email || '').toLowerCase().includes(searchLower);
    return nameMatch || emailMatch;
  }).sort((a, b) => {
    const unreadA = unreadSenders.has(a.uid);
    const unreadB = unreadSenders.has(b.uid);
    
    if (unreadA && !unreadB) return -1;
    if (!unreadA && unreadB) return 1;

    const timeA = chatTimestamps.get(a.uid) || 0;
    const timeB = chatTimestamps.get(b.uid) || 0;
    
    // If both have chat history, sort by recent message
    if (timeA > 0 && timeB > 0) {
      return timeB - timeA;
    }
    
    // If only one has chat history, it goes first
    if (timeA > 0 && timeB === 0) return -1;
    if (timeA === 0 && timeB > 0) return 1;

    // If neither has chat history, sort alphabetically
    return (a.displayName || '').localeCompare(b.displayName || '');
  });

  const isUserOnline = (user: UserProfile) => {
    if (!user.isOnline) return false;
    if (!user.lastSeen) return user.isOnline; // Fallback for users without lastSeen yet
    
    const lastSeenTime = user.lastSeen.toMillis?.() || 0;
    const now = Date.now();
    // Consider online if lastSeen was within the last 2 minutes
    return (now - lastSeenTime) < 120000;
  };

  const handleMarkAllAsRead = async () => {
    if (!userProfile) return;
    const unreadMsgs = allMessages.filter(m => m.receiverId === userProfile.uid && m.read === false);
    
    for (const msg of unreadMsgs) {
      try {
        await updateDoc(doc(db, 'messages', msg.id), { read: true });
      } catch (error) {
        console.error("Error marking message as read:", error);
      }
    }
  };

  if (!userProfile) return null;

  return (
    <div className="flex flex-1 min-h-0 bg-white dark:bg-slate-900 overflow-hidden relative">
      {/* Users List */}
      <div className={`w-full sm:w-80 border-r border-slate-200 dark:border-slate-800 flex flex-col min-h-0 ${selectedUser ? 'hidden sm:flex' : 'flex'}`}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="text-primary" size={20} />
              Mesajlar
            </h2>
            {unreadSenders.size > 0 && (
              <button 
                onClick={handleMarkAllAsRead}
                className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-primary transition-colors flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700"
                title="Bütün mesajları oxunmuş et"
              >
                <CheckCheck size={14} />
                Oxunmuş et
              </button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="İstifadəçi axtar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary border border-slate-200 dark:border-slate-700"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
          {filteredUsers.length === 0 ? (
            <div className="text-center p-4 text-slate-500 text-sm">
              {searchQuery.trim() === '' 
                ? 'Sistemdə başqa istifadəçi yoxdur.' 
                : 'İstifadəçi tapılmadı.'}
            </div>
          ) : (
            filteredUsers.map(user => (
              <button
                key={user.uid}
                onClick={() => setSelectedUser(user)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${
                  selectedUser?.uid === user.uid ? 'bg-primary/10 dark:bg-primary/20 border border-primary/30' : 'hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
                }`}
              >
                <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center shrink-0 overflow-hidden relative">
                  {user.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt={user.displayName || 'User'} 
                      className="w-full h-full object-cover cursor-zoom-in hover:opacity-90 transition-opacity" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onImageClick && onImageClick(user.photoURL!);
                      }}
                    />
                  ) : (
                    <UserIcon size={20} className="text-slate-400 dark:text-slate-500" />
                  )}
                  {isUserOnline(user) && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full"></div>
                  )}
                </div>
                <div className="overflow-hidden flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className={`font-bold text-sm truncate flex items-center gap-1.5 ${unreadSenders.has(user.uid) ? 'text-rose-500 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                      {user.displayName || 'Adsız İstifadəçi'}
                      {user.email?.toLowerCase() === 'rauf2289@gmail.com' ? (
                        <span className="text-[7px] bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1 py-0.5 rounded-md border border-amber-500/30 font-black uppercase tracking-tighter">
                          Rəhbərlik
                        </span>
                      ) : user.role === 'admin' ? (
                        <span className="text-[7px] bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1 py-0.5 rounded-md border border-amber-500/30 font-black uppercase tracking-tighter">
                          Admin
                        </span>
                      ) : user.userType === 'master' ? (
                        <span className="text-[7px] bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 px-1 py-0.5 rounded-md border border-purple-500/30 font-black uppercase tracking-tighter">
                          Usta
                        </span>
                      ) : user.userType === 'programmer' ? (
                        <span className="text-[7px] bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-1 py-0.5 rounded-md border border-blue-500/30 font-black uppercase tracking-tighter">
                          Proqramist
                        </span>
                      ) : null}
                    </h3>
                    {unreadSenders.has(user.uid) && (
                      <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse shrink-0"></span>
                    )}
                  </div>
                  {userProfile.role === 'admin' && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col ${!selectedUser ? 'hidden sm:flex' : 'flex'}`}>
        {selectedUser ? (
          <>
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm z-10">
              <button 
                onClick={() => setSelectedUser(null)}
                className="sm:hidden p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <ArrowLeft size={20} />
              </button>
                <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center shrink-0 overflow-hidden relative">
                {selectedUser.photoURL ? (
                  <img 
                    src={selectedUser.photoURL} 
                    alt={selectedUser.displayName || 'User'} 
                    className="w-full h-full object-cover cursor-zoom-in hover:opacity-90 transition-opacity" 
                    onClick={() => onImageClick && onImageClick(selectedUser.photoURL!)}
                  />
                ) : (
                  <UserIcon size={20} className="text-slate-400 dark:text-slate-500" />
                )}
                {isUserOnline(selectedUser) && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full"></div>
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  {selectedUser.displayName || 'Adsız İstifadəçi'}
                  {selectedUser.email?.toLowerCase() === 'rauf2289@gmail.com' ? (
                    <span className="text-[8px] bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-md border border-amber-500/30 font-black tracking-tighter uppercase">
                      Rəhbərlik
                    </span>
                  ) : selectedUser.role === 'admin' ? (
                    <span className="text-[8px] bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-md border border-amber-500/30 font-black tracking-tighter uppercase">
                      Admin
                    </span>
                  ) : selectedUser.userType === 'master' ? (
                    <span className="text-[8px] bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded-md border border-purple-500/30 font-black tracking-tighter uppercase">
                      Usta
                    </span>
                  ) : selectedUser.userType === 'programmer' ? (
                    <span className="text-[8px] bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-md border border-blue-500/30 font-black tracking-tighter uppercase">
                      Proqramist
                    </span>
                  ) : null}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {isUserOnline(selectedUser) ? 'Onlayn' : selectedUser.lastSeen ? `Son görülmə: ${formatDistanceToNow(selectedUser.lastSeen?.toDate?.() || Date.now(), { addSuffix: true, locale: az })}` : 'Oflayn'}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
              {messages.map((msg) => {
                const isMine = msg.senderId === userProfile.uid;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMine ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                  >
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                      isMine 
                        ? 'bg-primary text-white rounded-br-none' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-none border border-slate-200 dark:border-slate-700'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap break-words selectable-text">{msg.content}</p>
                      <p className={`text-[10px] mt-1 text-right ${isMine ? 'text-primary-foreground/70' : 'text-slate-500 dark:text-slate-400'}`}>
                        {msg.createdAt ? formatDistanceToNow(msg.createdAt.toDate(), { addSuffix: true, locale: az }) : 'İndi'}
                      </p>
                    </div>
                  </div>
                );
              })}
              {isOtherTyping && (
                <div
                  className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <div className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl rounded-bl-none px-4 py-3 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 pb-20 sm:pb-4">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={handleTyping}
                  placeholder="Mesajınızı yazın..."
                  className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="bg-primary text-white p-3 rounded-xl hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={20} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-6 text-center">
            <MessageSquare size={48} className="mb-4 opacity-20" />
            <p>Söhbətə başlamaq üçün sol tərəfdən bir istifadəçi seçin.</p>
          </div>
        )}
      </div>
    </div>
  );
}
