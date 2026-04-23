import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Ad } from '../types';
import { Megaphone, Plus, Trash2, ExternalLink, Image as ImageIcon, CheckCircle2, XCircle, Pencil } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';

export default function AdManager() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [deletingAdId, setDeletingAdId] = useState<string | null>(null);
  const [newAd, setNewAd] = useState({
    title: '',
    content: '',
    imageUrl: '',
    link: '',
    placement: 'home' as Ad['placement'],
    active: true
  });

  const fetchAds = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'ads'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const adsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ad));
      setAds(adsData);
    } catch (error) {
      console.error("Failed to fetch ads:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAds();
  }, []);

  const handleAddAd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAd) {
        await updateDoc(doc(db, 'ads', editingAd.id), {
          ...newAd,
          updatedAt: serverTimestamp()
        });
        setEditingAd(null);
      } else {
        await addDoc(collection(db, 'ads'), {
          ...newAd,
          createdAt: serverTimestamp()
        });
      }
      setShowAddForm(false);
      setNewAd({
        title: '',
        content: '',
        imageUrl: '',
        link: '',
        placement: 'home',
        active: true
      });
      fetchAds();
    } catch (error) {
      handleFirestoreError(error, editingAd ? OperationType.UPDATE : OperationType.CREATE, editingAd ? `ads/${editingAd.id}` : 'ads');
    }
  };

  const startEditing = (ad: Ad) => {
    setEditingAd(ad);
    setNewAd({
      title: ad.title,
      content: ad.content,
      imageUrl: ad.imageUrl || '',
      link: ad.link || '',
      placement: ad.placement,
      active: ad.active
    });
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleAdStatus = async (adId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'ads', adId), {
        active: !currentStatus
      });
      setAds(prev => prev.map(ad => ad.id === adId ? { ...ad, active: !currentStatus } : ad));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `ads/${adId}`);
    }
  };

  const deleteAd = async (adId: string) => {
    try {
      await deleteDoc(doc(db, 'ads', adId));
      setAds(prev => prev.filter(ad => ad.id !== adId));
      setDeletingAdId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `ads/${adId}`);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-500 dark:text-slate-400">Yüklənir...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Megaphone className="text-primary" size={20} />
          Reklam və Elanlar
        </h3>
        <button
          onClick={() => {
            if (showAddForm) {
              setShowAddForm(false);
              setEditingAd(null);
              setNewAd({ title: '', content: '', imageUrl: '', link: '', placement: 'home', active: true });
            } else {
              setShowAddForm(true);
            }
          }}
          className="bg-primary text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 active:scale-95 transition-transform"
        >
          <Plus size={20} />
          {editingAd ? 'Redaktəni Bitir' : 'Yeni Elan'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddAd} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-primary/30 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300 shadow-xl shadow-slate-200 dark:shadow-none">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold text-primary uppercase tracking-wider">
              {editingAd ? 'Elanı Redaktə Et' : 'Yeni Elan Əlavə Et'}
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Başlıq</label>
              <input
                required
                type="text"
                value={newAd.title}
                onChange={(e) => setNewAd({ ...newAd, title: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-primary outline-none transition-colors"
                placeholder="Məs: Yeni Endirim!"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Yerləşdirmə</label>
              <select
                value={newAd.placement}
                onChange={(e) => setNewAd({ ...newAd, placement: e.target.value as Ad['placement'] })}
                className="w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-primary outline-none transition-colors"
              >
                <option value="home">Ana Səhifə</option>
                <option value="shop">Mağaza</option>
                <option value="forum">Forum</option>
                <option value="all">Hər yer</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Məzmun</label>
            <textarea
              required
              value={newAd.content}
              onChange={(e) => setNewAd({ ...newAd, content: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-primary outline-none min-h-[100px] transition-colors"
              placeholder="Elan mətni..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Şəkil URL (Könüllü)</label>
              <input
                type="url"
                value={newAd.imageUrl}
                onChange={(e) => setNewAd({ ...newAd, imageUrl: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-primary outline-none transition-colors"
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Keçid Linki (Könüllü)</label>
              <input
                type="url"
                value={newAd.link}
                onChange={(e) => setNewAd({ ...newAd, link: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-primary outline-none transition-colors"
                placeholder="https://example.com"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setEditingAd(null);
                setNewAd({ title: '', content: '', imageUrl: '', link: '', placement: 'home', active: true });
              }}
              className="px-6 py-3 text-slate-500 dark:text-slate-400 font-bold hover:text-slate-700 dark:hover:text-white transition-colors"
            >
              Ləğv et
            </button>
            <button
              type="submit"
              className="bg-primary text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-cyan-500/20 active:scale-95 transition-transform"
            >
              {editingAd ? 'Yadda saxla' : 'Əlavə et'}
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4">
        {ads.map((ad) => (
          <div key={ad.id} className={`bg-white dark:bg-slate-800 p-5 rounded-2xl border transition-all ${ad.active ? 'border-slate-200 dark:border-slate-700 shadow-lg shadow-slate-200 dark:shadow-none' : 'border-slate-100 dark:border-slate-800 opacity-60'}`}>
            <div className="flex flex-col md:flex-row gap-6">
              {ad.imageUrl && (
                <div className="w-full md:w-48 h-32 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 shrink-0 border border-slate-200 dark:border-slate-700">
                  <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
              )}
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 dark:text-white">{ad.title}</h4>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                      {ad.placement === 'all' ? 'Hər yer' : ad.placement === 'home' ? 'Ana Səhifə' : ad.placement === 'shop' ? 'Mağaza' : 'Forum'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEditing(ad)}
                      className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="Redaktə et"
                    >
                      <Pencil size={20} />
                    </button>
                    <button
                      onClick={() => toggleAdStatus(ad.id, ad.active)}
                      className={`p-2 rounded-lg transition-colors ${ad.active ? 'text-green-500 dark:text-green-400 hover:bg-green-400/10' : 'text-slate-400 hover:bg-slate-500/10'}`}
                      title={ad.active ? 'Deaktiv et' : 'Aktiv et'}
                    >
                      {ad.active ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                    </button>
                    <button
                      onClick={() => setDeletingAdId(ad.id)}
                      className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                      title="Sil"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>

                {deletingAdId === ad.id && (
                  <div className="bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 p-3 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                    <span className="text-xs font-bold text-red-600 dark:text-red-400">Bu elanı silmək istədiyinizə əminsiniz?</span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setDeletingAdId(null)}
                        className="px-3 py-1 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                      >
                        Xeyr
                      </button>
                      <button 
                        onClick={() => deleteAd(ad.id)}
                        className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors"
                      >
                        Bəli, sil
                      </button>
                    </div>
                  </div>
                )}

                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{ad.content}</p>
                {ad.link && (
                  <a
                    href={ad.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary font-bold hover:underline mt-2"
                  >
                    <ExternalLink size={12} />
                    Keçidə bax
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}

        {ads.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg shadow-slate-200 dark:shadow-none">
            <Megaphone size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
            <p className="text-slate-500 dark:text-slate-400">Hələ heç bir elan yoxdur</p>
          </div>
        )}
      </div>
    </div>
  );
}
