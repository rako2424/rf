import React, { useState, useRef } from 'react';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth } from '../firebase';
import { UserProfile } from '../types';
import { X, Upload, User as UserIcon, MapPin, MapPinOff, Moon, Sun, Store, Wrench, ShieldCheck, ChevronDown, ChevronUp, Image as ImageIcon, Volume2, RefreshCw } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { useToast } from '../context/ToastContext';
import { motion, AnimatePresence } from 'motion/react';
import { uploadImage, resizeImageForStorage } from '../utils/storage';

interface ProfileModalProps {
  userProfile: UserProfile;
  onClose: () => void;
  onUpdate: (updatedProfile: UserProfile) => void;
  onImageClick?: (src: string) => void;
  onPlaySound?: () => void;
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
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
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
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

export default function ProfileModal({ userProfile, onClose, onUpdate, onImageClick, onPlaySound }: ProfileModalProps) {
  const [displayName, setDisplayName] = useState(userProfile.displayName || '');
  const [photoURL, setPhotoURL] = useState(userProfile.photoURL || '');
  const [phoneNumber, setPhoneNumber] = useState(userProfile.phoneNumber || '');
  const [showLocation, setShowLocation] = useState(userProfile.showLocation || false);
  const [location, setLocation] = useState(userProfile.location || null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  
  // Verification fields
  const [workplaceName, setWorkplaceName] = useState(userProfile.workplaceName || '');
  const [workplaceAddress, setWorkplaceAddress] = useState(userProfile.workplaceAddress || '');
  const [shopPhotoURL, setShopPhotoURL] = useState(userProfile.shopPhotoURL || '');
  const [equipmentPhotoURL, setEquipmentPhotoURL] = useState(userProfile.equipmentPhotoURL || '');
  const [shopImageFile, setShopImageFile] = useState<File | null>(null);
  const [equipmentImageFile, setEquipmentImageFile] = useState<File | null>(null);
  const [showVerification, setShowVerification] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const { theme, toggleTheme } = useTheme();

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Şəkilin həcmi 2MB-dan çox olmamalıdır.');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoURL(reader.result as string);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const updateLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation dəstəklənmir.', 'error');
      return;
    }

    showToast('Məkan yenilənir...', 'info');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLoc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          updatedAt: new Date()
        };
        setLocation(newLoc);
        showToast('Məkan uğurla təyin edildi.', 'success');
      },
      (error) => {
        showToast(`Xəta: ${error.message}`, 'error');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      let finalPhotoUrl = photoURL;
      if (imageFile) {
        const resizedBlob = await resizeImageForStorage(imageFile, 400, 400);
        const fileName = `profiles/${userProfile.uid}/avatar_${Date.now()}`;
        finalPhotoUrl = await uploadImage(resizedBlob, fileName);
      }

      let finalShopPhotoUrl = shopPhotoURL;
      if (shopImageFile) {
        const resizedBlob = await resizeImageForStorage(shopImageFile, 800, 800);
        const fileName = `profiles/${userProfile.uid}/shop_${Date.now()}`;
        finalShopPhotoUrl = await uploadImage(resizedBlob, fileName);
      }

      let finalEquipmentPhotoUrl = equipmentPhotoURL;
      if (equipmentImageFile) {
        const resizedBlob = await resizeImageForStorage(equipmentImageFile, 800, 800);
        const fileName = `profiles/${userProfile.uid}/equipment_${Date.now()}`;
        finalEquipmentPhotoUrl = await uploadImage(resizedBlob, fileName);
      }

      const userRef = doc(db, 'users', userProfile.uid);
      const publicRef = doc(db, 'publicProfiles', userProfile.uid);
      
      const updateData: any = {
        displayName,
        photoURL: finalPhotoUrl,
        phoneNumber,
        showLocation,
        userType: userProfile.userType,
        status: userProfile.status,
        workplaceName,
        workplaceAddress,
        shopPhotoURL: finalShopPhotoUrl,
        equipmentPhotoURL: finalEquipmentPhotoUrl
      };

      const publicData = {
        displayName,
        photoURL: finalPhotoUrl,
        phoneNumber,
        showLocation,
        userType: userProfile.userType,
        status: userProfile.status,
        location: location ? {
          ...location,
          updatedAt: serverTimestamp()
        } : null
      };

      if (location) {
        updateData.location = {
          ...location,
          updatedAt: serverTimestamp()
        };
      }
      
      await updateDoc(userRef, updateData);

      await setDoc(publicRef, publicData, { merge: true }).catch(() => {});

      if (auth.currentUser) {
        const profileUpdates: { displayName: string; photoURL?: string } = { displayName };
        if (finalPhotoUrl === '' || (finalPhotoUrl && !finalPhotoUrl.startsWith('data:') && finalPhotoUrl.length < 2000)) {
          profileUpdates.photoURL = finalPhotoUrl;
        }
        await updateProfile(auth.currentUser, profileUpdates);
      }

      onUpdate({ 
        ...userProfile, 
        displayName, 
        photoURL: finalPhotoUrl, 
        phoneNumber, 
        showLocation, 
        location,
        workplaceName,
        workplaceAddress,
        shopPhotoURL: finalShopPhotoUrl,
        equipmentPhotoURL: finalEquipmentPhotoUrl
      });
      showToast('Profil uğurla yeniləndi!', 'success');
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userProfile.uid}`);
      setError('Profil yenilənərkən xəta baş verdi.');
      showToast('Profil yenilənərkən xəta baş verdi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 shrink-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Şəxsi Kabinet</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
          {error && (
            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
              {error}
            </div>
          )}

          <div className="flex flex-col items-center gap-2">
            <div className="relative w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 flex items-center justify-center overflow-hidden group">
              {photoURL ? (
                <img 
                  src={photoURL} 
                  alt="Profil" 
                  className="w-full h-full object-cover cursor-zoom-in hover:opacity-90 transition-opacity" 
                  onClick={() => onImageClick && onImageClick(photoURL)}
                />
              ) : (
                <UserIcon size={32} className="text-slate-400" />
              )}
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Upload size={18} className="text-white mb-1" />
                <span className="text-[9px] text-white font-bold">Dəyiş</span>
              </button>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              className="hidden" 
            />
            <p className="text-[10px] text-slate-500">Maksimum: 2MB</p>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {theme === 'dark' ? <Moon size={16} className="text-primary" /> : <Sun size={16} className="text-amber-500" />}
                <span className="text-xs font-bold text-slate-900 dark:text-white">Qaranlıq Rejim</span>
              </div>
              <button 
                onClick={toggleTheme}
                className={`w-10 h-5 rounded-full transition-colors relative ${theme === 'dark' ? 'bg-primary' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${theme === 'dark' ? 'right-0.5' : 'left-0.5'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 size={16} className="text-primary" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">Bildiriş Səsinə Bax</span>
              </div>
              <button 
                onClick={() => {
                  if (onPlaySound) {
                    onPlaySound();
                    showToast('Səs yoxlanılır...', 'info');
                  }
                }}
                className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 p-2 rounded-xl text-primary transition-colors border border-slate-200 dark:border-slate-600"
                title="Səsi yoxla"
              >
                <RefreshCw size={14} className="text-primary" />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">E-poçt Ünvanı</label>
              <input
                type="email"
                value={userProfile.email}
                disabled
                className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-xs text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">İstifadəçi Adı</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                placeholder="Adınızı daxil edin"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Telefon Nömrəsi</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                placeholder="+994 XX XXX XX XX"
              />
            </div>

            {(userProfile.userType === 'master' || userProfile.userType === 'programmer') && (
              <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button 
                  onClick={() => setShowVerification(!showVerification)}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={18} className="text-primary" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest">Peşəkar Təsdiq Məlumatları</span>
                  </div>
                  {showVerification ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </button>

                <AnimatePresence>
                  {showVerification && (
                    <div className="space-y-4 p-1 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Hörmətli həmkar, hesabınızın təsdiqlənməsi üçün iş yeriniz və avadanlıqlarınız haqqında məlumatları daxil edin. Bu məlumatlar yalnız admin tərəfindən yoxlanılır.
                      </div>

                      <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 ml-1">İş Yerinin Adı</label>
                        <div className="relative">
                          <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                          <input
                            type="text"
                            value={workplaceName}
                            onChange={(e) => setWorkplaceName(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-900 dark:text-white focus:border-primary outline-none transition-colors"
                            placeholder="Məs: RF Servis"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 ml-1">Ünvan / Yerləşdiyi Yer</label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                          <input
                            type="text"
                            value={workplaceAddress}
                            onChange={(e) => setWorkplaceAddress(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-900 dark:text-white focus:border-primary outline-none transition-colors"
                            placeholder="Məs: 28 May küçəsi, bina 5"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 ml-1">Dükan Şəkli</label>
                          <div 
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'image/*';
                              input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (file) {
                                  setShopImageFile(file);
                                  const reader = new FileReader();
                                  reader.onload = () => setShopPhotoURL(reader.result as string);
                                  reader.readAsDataURL(file);
                                }
                              };
                              input.click();
                            }}
                            className="aspect-video bg-slate-100 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary transition-colors overflow-hidden group"
                          >
                            {shopPhotoURL ? (
                              <img src={shopPhotoURL} alt="Shop" className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
                            ) : (
                              <>
                                <ImageIcon size={20} className="text-slate-400" />
                                <span className="text-[8px] font-bold text-slate-500 uppercase">Yüklə</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 ml-1">Avadanlıq Şəkli</label>
                          <div 
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'image/*';
                              input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (file) {
                                  setEquipmentImageFile(file);
                                  const reader = new FileReader();
                                  reader.onload = () => setEquipmentPhotoURL(reader.result as string);
                                  reader.readAsDataURL(file);
                                }
                              };
                              input.click();
                            }}
                            className="aspect-video bg-slate-100 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary transition-colors overflow-hidden group"
                          >
                            {equipmentPhotoURL ? (
                              <img src={equipmentPhotoURL} alt="Equipment" className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
                            ) : (
                              <>
                                <Wrench size={20} className="text-slate-400" />
                                <span className="text-[8px] font-bold text-slate-500 uppercase">Yüklə</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </AnimatePresence>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-primary" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Xəritədə Görün</span>
                  </div>
                  <button 
                    onClick={() => setShowLocation(!showLocation)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${showLocation ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${showLocation ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>
                
                <button 
                  onClick={updateLocation}
                  className="w-full py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-[10px] font-bold flex items-center justify-center gap-2 hover:border-primary transition-colors"
                >
                  <MapPin size={12} className="text-primary" />
                  Məkanımı Yenilə
                </button>
                
                {location && (
                  <p className="text-[9px] text-slate-500 dark:text-slate-400 text-center font-mono">
                    Son: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-lg shadow-cyan-500/20 active:scale-[0.98]"
          >
            {loading ? 'Yadda saxlanılır...' : 'Yadda Saxla'}
          </button>
        </div>
      </div>
    </div>
  );
}
