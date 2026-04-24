import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  doc,
  getDocs,
  limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { MessageSquare, Send, User, Clock, Plus, X, Trash2, Heart, Edit3, Reply, Check } from 'lucide-react';
import { Post, UserProfile, Comment } from '../types';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { az } from 'date-fns/locale';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { deleteDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import AdBanner from './AdBanner';

export default function Forum({ userProfile, isAdmin, onImageClick }: { userProfile: UserProfile | null, isAdmin?: boolean, onImageClick?: (src: string) => void }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<'Təmir' | 'Proqram'>('Təmir');
  const [filterCategory, setFilterCategory] = useState<'Bütün' | 'Təmir' | 'Proqram'>('Bütün');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [itemToDelete, setItemToDelete] = useState<{type: 'post' | 'comment', id: string} | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');
  const commentInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'posts'), 
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Post[];
      
      // Fix delay for pending posts (null timestamp) by sorting them to the top
      postsData.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || Date.now() + 100000;
        const timeB = b.createdAt?.toMillis?.() || Date.now() + 100000;
        return timeB - timeA;
      });

      setPosts(postsData);
      setInitialLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'posts');
      setInitialLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedPost) {
      const q = query(
        collection(db, `posts/${selectedPost.id}/comments`), 
        orderBy('createdAt', 'asc'),
        limit(50)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const commentsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Comment[];
        
        // Fix delay for pending comments (null timestamp) by sorting them to the bottom
        commentsData.sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() || Date.now() + 100000;
          const timeB = b.createdAt?.toMillis?.() || Date.now() + 100000;
          return timeA - timeB;
        });

        setComments(commentsData);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `posts/${selectedPost.id}/comments`);
      });
      return () => unsubscribe();
    }
  }, [selectedPost]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim() || !userProfile) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'posts'), {
        authorUid: userProfile.uid,
        authorName: userProfile.displayName || 'Anonim',
        authorPhotoURL: userProfile.photoURL || '',
        title: newTitle,
        content: newContent,
        createdAt: serverTimestamp(),
        category: newCategory
      });
      setNewTitle('');
      setNewContent('');
      setNewCategory('Təmir');
      setShowNewPost(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'posts');
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedPost || !userProfile) return;

    try {
      await addDoc(collection(db, `posts/${selectedPost.id}/comments`), {
        postId: selectedPost.id,
        authorUid: userProfile.uid,
        authorName: userProfile.displayName || 'Anonim',
        authorPhotoURL: userProfile.photoURL || '',
        content: newComment,
        createdAt: serverTimestamp(),
        likes: [],
        isEdited: false
      });

      // Add notification to post author if it's not their own comment
      if (selectedPost.authorUid !== userProfile.uid) {
        await addDoc(collection(db, 'notifications'), {
          userId: selectedPost.authorUid,
          title: 'Yeni Rəy',
          body: `${userProfile.displayName || 'Anonim'} postunuza rəy bildirdi.`,
          link: '/forum',
          createdAt: serverTimestamp(),
          read: false
        });
      }

      setNewComment('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `posts/${selectedPost.id}/comments`);
    }
  };

  const handleDeletePost = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    setItemToDelete({ type: 'post', id: postId });
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedPost) return;
    setItemToDelete({ type: 'comment', id: commentId });
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      if (itemToDelete.type === 'post') {
        await deleteDoc(doc(db, 'posts', itemToDelete.id));
        if (selectedPost?.id === itemToDelete.id) {
          setSelectedPost(null);
        }
      } else if (itemToDelete.type === 'comment' && selectedPost) {
        await deleteDoc(doc(db, `posts/${selectedPost.id}/comments`, itemToDelete.id));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, itemToDelete.type === 'post' ? `posts/${itemToDelete.id}` : `posts/${selectedPost?.id}/comments/${itemToDelete.id}`);
    } finally {
      setItemToDelete(null);
    }
  };

  const handleLike = async (e: React.MouseEvent, post: Post) => {
    e.stopPropagation();
    if (!userProfile) return;

    const postRef = doc(db, 'posts', post.id);
    const hasLiked = post.likes?.includes(userProfile.uid);

    try {
      if (hasLiked) {
        await updateDoc(postRef, {
          likes: arrayRemove(userProfile.uid)
        });
      } else {
        await updateDoc(postRef, {
          likes: arrayUnion(userProfile.uid)
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posts/${post.id}`);
    }
  };

  const handleLikeComment = async (commentId: string, currentLikes: string[] = []) => {
    if (!userProfile || !selectedPost) return;

    const commentRef = doc(db, `posts/${selectedPost.id}/comments`, commentId);
    const hasLiked = currentLikes.includes(userProfile.uid);

    try {
      if (hasLiked) {
        await updateDoc(commentRef, {
          likes: arrayRemove(userProfile.uid)
        });
      } else {
        await updateDoc(commentRef, {
          likes: arrayUnion(userProfile.uid)
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posts/${selectedPost.id}/comments/${commentId}`);
    }
  };

  const handleReplyComment = (authorName: string) => {
    setNewComment(`@${authorName} `);
    setTimeout(() => {
      commentInputRef.current?.focus();
    }, 100);
  };

  const startEditingComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentContent(comment.content);
  };

  const cancelEditingComment = () => {
    setEditingCommentId(null);
    setEditingCommentContent('');
  };

  const submitEditComment = async (commentId: string) => {
    if (!selectedPost || !editingCommentContent.trim()) return;
    try {
      const commentRef = doc(db, `posts/${selectedPost.id}/comments`, commentId);
      await updateDoc(commentRef, {
        content: editingCommentContent.trim(),
        isEdited: true
      });
      setEditingCommentId(null);
      setEditingCommentContent('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posts/${selectedPost.id}/comments/${commentId}`);
    }
  };

  const filteredPosts = posts.filter(post => 
    filterCategory === 'Bütün' ? true : post.category === filterCategory
  );

  return (
    <div className="p-4 relative pb-32">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-slate-900 dark:text-white">
          <MessageSquare className="text-primary" size={20} />
          İcma Forumu
        </h2>
        <button 
          onClick={() => setShowNewPost(true)}
          className="bg-primary text-white p-3 rounded-2xl shadow-lg shadow-cyan-500/20 active:scale-90 transition-transform"
        >
          <Plus size={24} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {['Bütün', 'Təmir', 'Proqram'].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat as any)}
            className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors ${
              filterCategory === cat 
                ? 'bg-primary text-white shadow-lg shadow-cyan-500/20' 
                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <AdBanner placement="forum" />

      <div className="space-y-4">
        {initialLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={`forum-skeleton-${i}`} className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-200 dark:shadow-slate-900/50 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-2xl"></div>
                <div className="space-y-2">
                  <div className="h-3 w-24 bg-slate-100 dark:bg-slate-700 rounded-full"></div>
                  <div className="h-2 w-16 bg-slate-100 dark:bg-slate-700 rounded-full"></div>
                </div>
              </div>
              <div className="h-4 w-3/4 bg-slate-100 dark:bg-slate-700 rounded-full mb-3"></div>
              <div className="h-3 w-full bg-slate-100 dark:bg-slate-700 rounded-full mb-2"></div>
              <div className="h-3 w-5/6 bg-slate-100 dark:bg-slate-700 rounded-full"></div>
            </div>
          ))
        ) : filteredPosts.length > 0 ? (
          filteredPosts.map((post) => (
            <div 
              key={post.id} 
              onClick={() => setSelectedPost(post)}
              className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-200 dark:shadow-slate-900/50 active:bg-slate-50 dark:active:bg-slate-700 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center text-primary overflow-hidden">
                  {post.authorPhotoURL ? (
                    <img 
                      src={post.authorPhotoURL} 
                      alt={post.authorName} 
                      className="w-full h-full object-cover cursor-zoom-in hover:opacity-90 transition-opacity" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onImageClick && onImageClick(post.authorPhotoURL!);
                      }}
                    />
                  ) : (
                    <User size={20} />
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  <Link 
                    to={`/messages?userId=${post.authorUid}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider hover:text-primary transition-colors block truncate"
                  >
                    {post.authorName}
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-700 text-primary px-2 py-0.5 rounded-md">
                      {post.category || 'Ümumi'}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                      <Clock size={10} />
                      {post.createdAt 
                        ? formatDistanceToNow(
                            typeof post.createdAt.toDate === 'function' ? post.createdAt.toDate() : new Date(post.createdAt as any), 
                            { addSuffix: true, locale: az }
                          ) 
                        : 'İndi'}
                    </div>
                  </div>
                </div>
                {(isAdmin || userProfile?.uid === post.authorUid) && (
                  <button 
                    onClick={(e) => handleDeletePost(e, post.id)}
                    className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <h3 className="font-black text-slate-900 dark:text-white mb-2 text-sm uppercase tracking-tight selectable-text">{post.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 font-medium leading-relaxed mb-3 selectable-text">{post.content}</p>
              
              <div className="flex items-center gap-4 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                <button 
                  onClick={(e) => handleLike(e, post)}
                  className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
                    post.likes?.includes(userProfile?.uid || '') 
                      ? 'text-rose-500' 
                      : 'text-slate-400 hover:text-rose-400'
                  }`}
                >
                  <Heart size={16} className={post.likes?.includes(userProfile?.uid || '') ? 'fill-current' : ''} />
                  {post.likes?.length || 0}
                </button>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                  <MessageSquare size={16} />
                  Şərh yaz
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            <p className="text-sm">Hələ ki, heç bir post yoxdur.</p>
          </div>
        )}
      </div>

      {/* New Post Modal */}
      {showNewPost && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300 border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Yeni Mövzu</h3>
              <button onClick={() => setShowNewPost(false)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleCreatePost} className="space-y-4">
              <div className="flex gap-2 mb-4">
                {['Təmir', 'Proqram'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setNewCategory(cat as any)}
                    className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors ${
                      newCategory === cat 
                        ? 'bg-primary text-white shadow-lg shadow-cyan-500/20' 
                        : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Başlıq"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none text-slate-900 dark:text-white placeholder-slate-500"
                required
              />
              <textarea
                placeholder="Məzmun..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none min-h-[150px] text-slate-900 dark:text-white placeholder-slate-500"
                required
              ></textarea>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-cyan-500/20"
              >
                {loading ? 'Paylaşılır...' : 'Paylaş'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Post Detail Modal */}
      {selectedPost && (
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-[70] flex flex-col text-slate-900 dark:text-white">
          <header className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-4 bg-white dark:bg-slate-800">
            <button onClick={() => setSelectedPost(null)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white">
              <X size={24} />
            </button>
            <h3 className="font-bold truncate">{selectedPost.title}</h3>
          </header>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-primary overflow-hidden">
                  {selectedPost.authorPhotoURL ? (
                    <img 
                      src={selectedPost.authorPhotoURL} 
                      alt={selectedPost.authorName} 
                      className="w-full h-full object-cover cursor-zoom-in hover:opacity-90 transition-opacity" 
                      onClick={() => onImageClick && onImageClick(selectedPost.authorPhotoURL!)}
                    />
                  ) : (
                    <User size={20} />
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  <Link 
                    to={`/messages?userId=${selectedPost.authorUid}`}
                    className="font-bold text-slate-900 dark:text-white hover:text-primary transition-colors block truncate"
                  >
                    {selectedPost.authorName}
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-700 text-primary px-2 py-0.5 rounded-md">
                      {selectedPost.category || 'Ümumi'}
                    </span>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {selectedPost.createdAt 
                        ? formatDistanceToNow(
                            typeof selectedPost.createdAt.toDate === 'function' ? selectedPost.createdAt.toDate() : new Date(selectedPost.createdAt as any), 
                            { addSuffix: true, locale: az }
                          ) 
                        : 'İndi'}
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap mb-6">{selectedPost.content}</p>
              
              <div className="flex items-center gap-4 pb-6">
                <button 
                  onClick={(e) => handleLike(e, selectedPost)}
                  className={`flex items-center gap-2 text-sm font-bold transition-colors px-4 py-2 rounded-xl border ${
                    selectedPost.likes?.includes(userProfile?.uid || '') 
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-rose-400 hover:border-rose-400/30'
                  }`}
                >
                  <Heart size={18} className={selectedPost.likes?.includes(userProfile?.uid || '') ? 'fill-current' : ''} />
                  {selectedPost.likes?.length || 0} Bəyənmə
                </button>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
              <h4 className="font-bold mb-4 text-slate-900 dark:text-white">Şərhlər ({comments.length})</h4>
              <div className="space-y-4 mb-20">
                {comments.map((comment) => (
                  <div key={comment.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 relative group">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Link 
                          to={`/messages?userId=${comment.authorUid}`}
                          className="text-xs font-bold text-primary hover:opacity-80 transition-opacity truncate"
                        >
                          {comment.authorName}
                        </Link>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {comment.createdAt 
                            ? formatDistanceToNow(
                                typeof comment.createdAt.toDate === 'function' ? comment.createdAt.toDate() : new Date(comment.createdAt as any), 
                                { addSuffix: true, locale: az }
                              ) 
                            : 'İndi'}
                          {comment.isEdited && ' (redaktə edilib)'}
                        </span>
                        {isAdmin && editingCommentId !== comment.id && (
                          <button 
                            onClick={() => startEditingComment(comment)}
                            className="text-slate-400 hover:text-blue-500 transition-colors"
                            title="Redaktə et"
                          >
                            <Edit3 size={14} />
                          </button>
                        )}
                        {(isAdmin || userProfile?.uid === comment.authorUid) && (
                          <button 
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                            title="Sil"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    {editingCommentId === comment.id ? (
                      <div className="mt-2 flex gap-2">
                        <input
                          type="text"
                          value={editingCommentContent}
                          onChange={(e) => setEditingCommentContent(e.target.value)}
                          className="flex-1 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-primary text-slate-900 dark:text-white text-sm"
                          autoFocus
                        />
                        <button 
                          onClick={() => submitEditComment(comment.id)}
                          className="p-2 bg-emerald-500/20 text-emerald-500 rounded-lg hover:bg-emerald-500 hover:text-white transition-colors"
                        >
                          <Check size={16} />
                        </button>
                        <button 
                          onClick={cancelEditingComment}
                          className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-600 dark:text-slate-300">{comment.content}</p>
                    )}
                    
                    {!editingCommentId && (
                      <div className="flex items-center gap-4 mt-3">
                        <button 
                          onClick={() => handleLikeComment(comment.id, comment.likes)}
                          className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                            comment.likes?.includes(userProfile?.uid || '') 
                              ? 'text-rose-500' 
                              : 'text-slate-500 hover:text-rose-400'
                          }`}
                        >
                          <Heart size={14} className={comment.likes?.includes(userProfile?.uid || '') ? 'fill-current' : ''} />
                          {comment.likes?.length || 0}
                        </button>
                        <button 
                          onClick={() => handleReplyComment(comment.authorName)}
                          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-primary transition-colors"
                        >
                          <Reply size={14} />
                          Cavabla
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 sticky bottom-0">
            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                ref={commentInputRef}
                type="text"
                placeholder="Şərh yazın..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-white placeholder-slate-500"
              />
              <button type="submit" className="bg-primary text-white p-3 rounded-xl">
                <Send size={20} />
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl max-w-sm w-full border border-slate-200 dark:border-slate-700 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Silmək istədiyinizə əminsiniz?</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">Bu əməliyyatı geri qaytarmaq mümkün deyil.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setItemToDelete(null)}
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
    </div>
  );
}
