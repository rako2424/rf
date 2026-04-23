import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Upload, Store, Wrench, LogOut, Image as ImageIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { useToast } from '../context/ToastContext';
import { uploadImage, resizeImageForStorage } from '../utils/storage';

interface VerificationViewProps {
  userProfile: UserProfile;
  onLogout: () => void;
}

const resizeImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const VerificationView: React.FC<VerificationViewProps> = ({ userProfile, onLogout }) => {
  console.log('[VerificationView] Render:', { 
    status: userProfile.status, 
    hasWorkplace: !!userProfile.workplaceName,
    hasShopPhoto: !!userProfile.shopPhotoURL,
    hasEquipPhoto: !!userProfile.equipmentPhotoURL
  });
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    workplaceName: userProfile.workplaceName || '',
    workplaceAddress: userProfile.workplaceAddress || '',
    shopPhotoURL: userProfile.shopPhotoURL || '',
    equipmentPhotoURL: userProfile.equipmentPhotoURL || ''
  });

  const isSubmitted = formData.shopPhotoURL && formData.equipmentPhotoURL && formData.workplaceName;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'shopPhotoURL' | 'equipmentPhotoURL') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('Şəkil ölçüsü 5MB-dan çox olmamalıdır.', 'error');
      return;
    }

    try {
      setLoading(true);
      const resizedBlob = await resizeImageForStorage(file, 800, 800);
      const fileName = `verification/${auth.currentUser?.uid || 'unknown'}/${field}_${Date.now()}`;
      const imageUrl = await uploadImage(resizedBlob, fileName);
      
      setFormData(prev => ({ ...prev, [field]: imageUrl }));
      showToast('Şəkil yükləndi.', 'success');
    } catch (error) {
      console.error("Error processing image:", error);
      showToast('Şəkil emal edilərkən xəta baş verdi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.workplaceName || !formData.workplaceAddress || !formData.shopPhotoURL || !formData.equipmentPhotoURL) {
      showToast('Zəhmət olmasa bütün məlumatları doldurun və şəkilləri yükləyin.', 'error');
      return;
    }

    setLoading(true);
    console.log('[VerificationView] Submitting form:', formData);
    try {
      const userRef = doc(db, 'users', userProfile.uid);
      await updateDoc(userRef, {
        ...formData,
        status: 'pending',
        updatedAt: serverTimestamp()
      });
      console.log('[VerificationView] Submission successful');
      showToast('Məlumatlar göndərildi. Təsdiq gözləyin.', 'success');
    } catch (error) {
      console.error('[VerificationView] Submission error:', error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${userProfile.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const hasSubmittedData = !!(userProfile.shopPhotoURL && userProfile.equipmentPhotoURL && userProfile.workplaceName);

  if (userProfile.status === 'pending' && (hasSubmittedData || isSubmitted)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-center p-6 space-y-8">
        <motion.div 
          animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.5, 1, 0.5]
          }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-24 h-24 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.2)]"
        >
          <ShieldCheck size={48} />
        </motion.div>
        <div className="space-y-4">
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Təsdiq Gözlənilir</h2>
          <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-[2rem] max-w-md mx-auto">
            <p className="text-slate-300 font-medium leading-relaxed">
              Hörmətli <span className="text-primary font-bold">{userProfile.displayName}</span>, 
              məlumatlarınız uğurla göndərildi.
            </p>
            <div className="h-px bg-slate-700 my-4" />
            <p className="text-slate-400 text-sm">
              Admin tərəfindən yoxlanıldıqdan sonra hesabınız aktivləşdiriləcək. 
              Zəhmət olmasa təsdiq olunana qədər gözləyin.
            </p>
          </div>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
            Təsdiq edildikdən sonra bütün bölmələrə girişiniz açılacaq.
          </p>
        </div>
        <button 
          onClick={onLogout}
          className="px-8 py-4 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-700 transition-all flex items-center gap-2 border border-slate-700"
        >
          <LogOut size={20} />
          Hesabdan Çıx
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto py-12">
      <div className="w-full max-w-xl space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex p-4 bg-primary/10 rounded-3xl text-primary mb-2">
            <ShieldCheck size={48} />
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight uppercase">Texnik Təsdiqləməsi</h2>
          {userProfile.status === 'rejected' && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-start gap-3 text-left">
              <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
              <div className="space-y-1">
                <p className="text-red-200 text-sm font-bold">Məlumatlarınız rədd edildi.</p>
                <p className="text-red-200/70 text-xs">Zəhmət olmasa məlumatları yenidən yoxlayıb daxil edin və yenidən göndərin.</p>
              </div>
            </div>
          )}
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl">
            <p className="text-amber-200 text-sm font-medium leading-relaxed">
              Sistem sizin doğurdan da usta və proqramist olduğunuzu təsdiq etmək üçün bu məlumatları doldurun. 
              <br />
              <span className="font-bold">Not:</span> Bütün bunlar saxtakarlığa qarşıdır.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-800/50 border border-slate-700 p-6 sm:p-8 rounded-[2.5rem] shadow-2xl space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">İş yerinin / Dükanın adı</label>
              <div className="relative">
                <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="text"
                  value={formData.workplaceName}
                  onChange={(e) => setFormData(prev => ({ ...prev, workplaceName: e.target.value }))}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  placeholder="Məs: RF Servis"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">İş yerinin ünvanı</label>
              <div className="relative">
                <Wrench className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="text"
                  value={formData.workplaceAddress}
                  onChange={(e) => setFormData(prev => ({ ...prev, workplaceAddress: e.target.value }))}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  placeholder="Məs: Bakı ş., 28 May küç."
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Dükanın şəkli</label>
                <label className="relative group cursor-pointer block">
                  <div className={`aspect-video rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 overflow-hidden ${formData.shopPhotoURL ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-700 bg-slate-900/50 hover:border-primary/50'}`}>
                    {formData.shopPhotoURL ? (
                      <img src={formData.shopPhotoURL} alt="Shop" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <ImageIcon className="text-slate-500 group-hover:text-primary transition-colors" size={32} />
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Şəkil yüklə</span>
                      </>
                    )}
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'shopPhotoURL')} disabled={loading} />
                </label>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Avadanlıqların şəkli</label>
                <label className="relative group cursor-pointer block">
                  <div className={`aspect-video rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 overflow-hidden ${formData.equipmentPhotoURL ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-700 bg-slate-900/50 hover:border-primary/50'}`}>
                    {formData.equipmentPhotoURL ? (
                      <img src={formData.equipmentPhotoURL} alt="Equipment" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <ImageIcon className="text-slate-500 group-hover:text-primary transition-colors" size={32} />
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Şəkil yüklə</span>
                      </>
                    )}
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'equipmentPhotoURL')} disabled={loading} />
                </label>
              </div>
            </div>
          </div>

          <div className="pt-4 flex flex-col gap-3">
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-primary text-white rounded-2xl font-bold hover:bg-cyan-600 transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 size={20} />
                  Yadda Saxla və Göndər
                </>
              )}
            </button>
            <button 
              type="button"
              onClick={onLogout}
              className="w-full py-4 bg-slate-900/50 text-slate-400 rounded-2xl font-bold hover:bg-slate-900 transition-all border border-slate-700 flex items-center justify-center gap-2 active:scale-95"
            >
              <LogOut size={20} />
              Hesabdan Çıx
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VerificationView;
