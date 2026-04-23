import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, deleteDoc, doc, limit } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { UserProfile } from '../types';
import { MapPin, Navigation, MessageSquare, Phone, User as UserIcon, Search, AlertCircle, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function NearbyMasters({ currentUserProfile, isAdmin, onImageClick }: { currentUserProfile: UserProfile | null, isAdmin?: boolean, onImageClick?: (src: string) => void }) {
  const [masters, setMasters] = useState<UserProfile[]>([]);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => {
          showToast('Məkanınızı təyin edə bilmədik. Distansiyalar görünməyəcək.', 'info');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }

    // Fetch masters who opted to show location
    const q = query(
      collection(db, 'publicProfiles'),
      where('showLocation', '==', true),
      where('status', '==', 'active'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('NearbyMasters: Snapshot received, size:', snapshot.size);
      const mastersData = snapshot.docs
        .map(doc => {
          const data = doc.data();
          console.log('NearbyMasters: Processing doc:', doc.id, data);
          return { uid: doc.id, ...data } as UserProfile;
        })
        .filter(m => {
          const isMaster = m.userType === 'master' || m.userType === 'programmer';
          if (!isMaster) console.log('NearbyMasters: Filtered out non-master:', m.uid, m.userType);
          return isMaster;
        });
      console.log('NearbyMasters: Final masters list:', mastersData.length);
      setMasters(mastersData);
      setLoading(false);
    }, (error) => {
      console.error('NearbyMasters: Snapshot error:', error);
      showToast('Məlumatları yükləyərkən xəta baş verdi.', 'error');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const sortedMasters = [...masters]
    .map(m => {
      let distance = Infinity;
      if (userLocation && m.location) {
        distance = getDistance(userLocation.lat, userLocation.lng, m.location.lat, m.location.lng);
      }
      return { ...m, distance };
    })
    .filter(m => 
      m.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.userType.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => a.distance - b.distance);

  const [masterToDelete, setMasterToDelete] = useState<string | null>(null);

  const handleDeleteMaster = (e: React.MouseEvent, masterId: string) => {
    e.stopPropagation();
    setMasterToDelete(masterId);
  };

  const confirmDeleteMaster = async () => {
    if (!masterToDelete) return;
    try {
      await deleteDoc(doc(db, 'publicProfiles', masterToDelete));
      await deleteDoc(doc(db, 'users', masterToDelete)).catch(() => {});
      showToast('Usta uğurla silindi', 'success');
      setMasterToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `publicProfiles/${masterToDelete}`);
    }
  };

  return (
    <div className="p-4 pb-32 max-w-2xl mx-auto bg-white dark:bg-slate-900 min-h-screen transition-colors duration-300">
      <header className="mb-8">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter flex items-center gap-3">
          <Navigation className="text-primary animate-pulse" size={28} />
          Yaxınlıqdakı Ustalar və Proqramistlər
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Sizə ən yaxın olan təmir ustaları və proqramistləri tapın.</p>
        
        {userLocation && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
              <Navigation size={16} />
            </div>
            <div>
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Sizin Məkanınız Təyin Edildi</p>
              <p className="text-[9px] text-slate-400 font-mono">{userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}</p>
            </div>
          </div>
        )}
      </header>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
        <input 
          type="text"
          placeholder="Usta və ya xidmət axtar..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-slate-900 dark:text-white outline-none focus:border-primary transition-colors shadow-lg shadow-slate-200 dark:shadow-none"
        />
      </div>

      {currentUserProfile && (currentUserProfile.userType === 'master' || currentUserProfile.userType === 'programmer') && (
        <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-3xl">
          <h4 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Sizin Görünürlük Statusunuz</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600 dark:text-slate-300">Xəritədə Görün:</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                currentUserProfile.showLocation ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'
              }`}>
                {currentUserProfile.showLocation ? 'Aktiv' : 'Deaktiv'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300">Hesab Statusu:</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                currentUserProfile.status === 'active' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'
              }`}>
                {currentUserProfile.status === 'active' ? 'Təsdiqlənib' : 'Gözləyir'}
              </span>
            </div>
            {!currentUserProfile.showLocation && (
              <p className="text-[10px] text-amber-500 flex items-center gap-1 mt-2">
                <AlertCircle size={10} />
                Profil ayarlarından "Xəritədə Görün" seçimini aktivləşdirin.
              </p>
            )}
            {currentUserProfile.status !== 'active' && (
              <p className="text-[10px] text-amber-500 flex items-center gap-1 mt-1">
                <AlertCircle size={10} />
                Hesabınız hələ təsdiqlənməyib. Təsdiqləndikdən sonra görünəcəksiniz.
              </p>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Ustalar axtarılır...</p>
        </div>
      ) : sortedMasters.length === 0 ? (
        <div className="bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-[2.5rem] p-12 text-center">
          <MapPin className="mx-auto text-slate-400 dark:text-slate-600 mb-4" size={48} />
          <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-sm">Heç bir usta tapılmadı</p>
          <p className="text-slate-400 dark:text-slate-600 text-xs mt-2">Axtarış meyarlarını dəyişin və ya daha sonra yoxlayın.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {sortedMasters.map((master) => (
            <div
              key={master.uid}
              onClick={() => navigate(`/messages?userId=${master.uid}`)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 flex flex-col gap-3 shadow-xl shadow-slate-200 dark:shadow-none hover:border-primary/50 transition-colors group cursor-pointer animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              <div className="flex items-center gap-2.5">
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 overflow-hidden border-2 border-slate-200 dark:border-slate-600">
                    {master.photoURL ? (
                      <img 
                        src={master.photoURL} 
                        alt={master.displayName} 
                        className="w-full h-full object-cover cursor-zoom-in hover:opacity-90 transition-opacity" 
                        onClick={(e) => {
                          e.stopPropagation();
                          onImageClick && onImageClick(master.photoURL!);
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <UserIcon className="text-slate-400 dark:text-slate-500" size={18} />
                      </div>
                    )}
                  </div>
                  {master.isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <h3 className="font-black text-slate-900 dark:text-white truncate uppercase tracking-tight text-[11px]">{master.displayName || 'Adsız Usta'}</h3>
                    <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest shrink-0 ${
                      master.userType === 'master' ? 'bg-primary/20 text-primary' : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {master.userType === 'master' ? 'Usta' : 'Proqramist'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {master.distance !== Infinity && (
                      <div className="flex items-center gap-1 text-emerald-400 text-[9px] font-bold">
                        <MapPin size={8} />
                        {master.distance < 1 ? `${(master.distance * 1000).toFixed(0)} m` : `${master.distance.toFixed(1)} km`}
                      </div>
                    )}
                    <div className="text-slate-500 text-[9px] font-medium">
                      {master.isOnline ? 'Onlayn' : 'Oflayn'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100 dark:border-slate-700/50">
                {master.phoneNumber ? (
                  <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-[9px] font-bold truncate">
                    <Phone size={8} className="text-primary shrink-0" />
                    <span className="truncate">{master.phoneNumber}</span>
                  </div>
                ) : (
                  <div className="text-slate-400 dark:text-slate-500 text-[9px] italic">Nömrə yoxdur</div>
                )}
                
                <div className="flex gap-1 shrink-0">
                  {master.phoneNumber && (
                    <a 
                      href={`tel:${master.phoneNumber}`}
                      className="w-7 h-7 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all active:scale-90"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone size={12} />
                    </a>
                  )}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/messages?userId=${master.uid}`);
                    }}
                    className="w-7 h-7 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-primary hover:border-primary transition-all active:scale-90"
                  >
                    <MessageSquare size={12} />
                  </button>
                  {isAdmin && (
                    <button 
                      onClick={(e) => handleDeleteMaster(e, master.uid)}
                      className="w-7 h-7 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-90"
                      title="Ustanı Sil"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-12 bg-primary/10 border border-primary/20 rounded-3xl p-6">
        <h4 className="text-primary font-black uppercase tracking-widest text-xs mb-2">Məlumat</h4>
        <p className="text-slate-400 text-[11px] leading-relaxed">
          Bu siyahıda yalnız öz məkanını paylaşmağa icazə verən ustalar görünür. Siz də usta və ya proqramistsinizsə, profil ayarlarından "Xəritədə Görün" seçimini aktivləşdirə bilərsiniz.
        </p>
      </div>

      {masterToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Ustanı Sil</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              Bu ustanı xəritədən və sistemdən silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarıla bilməz.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setMasterToDelete(null)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Ləğv et
              </button>
              <button
                onClick={confirmDeleteMaster}
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
