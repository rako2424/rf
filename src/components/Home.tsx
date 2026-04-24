import React, { useState, useEffect } from 'react';
import { Smartphone, ChevronRight, Info, Zap, Cpu, Terminal, Users, ShoppingBag, Server, X, Send, CreditCard, CheckCircle, Clock, Navigation, HeartPulse, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { SiSamsung, SiApple, SiXiaomi, SiHonor } from 'react-icons/si';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { FrpRequest, UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { useToast } from '../context/ToastContext';
import AdBanner from './AdBanner';

const NothingIcon = (props: any) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <circle cx="6" cy="5" r="1.5" />
    <circle cx="6" cy="9.6" r="1.5" />
    <circle cx="6" cy="14.2" r="1.5" />
    <circle cx="6" cy="18.8" r="1.5" />
    <circle cx="10" cy="9.6" r="1.5" />
    <circle cx="14" cy="14.2" r="1.5" />
    <circle cx="18" cy="5" r="1.5" />
    <circle cx="18" cy="9.6" r="1.5" />
    <circle cx="18" cy="14.2" r="1.5" />
    <circle cx="18" cy="18.8" r="1.5" />
  </svg>
);

const brands = [
  { id: 'samsung', name: 'Samsung', color: 'bg-[#034EA2]', icon: SiSamsung },
  { id: 'iphone', name: 'iPhone', color: 'bg-[#000000]', icon: SiApple },
  { id: 'xiaomi', name: 'Xiaomi', color: 'bg-[#FF6700]', icon: SiXiaomi },
  { id: 'honor', name: 'Honor', color: 'bg-[#000000]', icon: SiHonor },
  { id: 'nothing', name: 'Nothing', color: 'bg-[#000000]', icon: NothingIcon },
];

const brandUpdates = {
  samsung: [
    { id: 's1', title: 'Galaxy S26 Ultra Qlobal Satışda', content: 'Snapdragon 8 Gen 5 prosessoru, inqilabi Galaxy AI 3.0 və yeni titan dizaynı ilə Galaxy S26 Ultra rəsmən satışa çıxarıldı.', date: 'Fevral 2026' },
    { id: 's2', title: 'One UI 8.1 Yenilənməsi', content: 'Samsung, daha ağıllı animasiyalar və təkmilləşdirilmiş batareya idarəetməsi gətirən One UI 8.1 versiyasını S25 və S26 seriyaları üçün yayımladı.', date: 'Mart 2026' },
    { id: 's3', title: 'Galaxy Ring 2 Təqdimatı', content: 'Daha uzun batareya ömrü, qan şəkəri izləmə funksiyası və yeni rəng seçimləri ilə Galaxy Ring 2 rəsmən duyuruldu.', date: 'Mart 2026' },
    { id: 's4', title: 'Galaxy A57 və A37 5G', content: 'Orta seqmentin yeni liderləri Galaxy A57 və A37 modelləri 7 illik yenilənmə zəmanəti ilə təqdim edildi.', date: 'Mart 2026' },
  ],
  iphone: [
    { id: 'i1', title: 'iPhone 17 Pro Seriyası Uğuru', content: 'A19 Pro çipi və təkmilləşdirilmiş 48MP telefoto kamerası ilə iPhone 17 Pro seriyası qlobal satışlarda yeni rekordlar qırır.', date: 'Fevral 2026' },
    { id: 'i2', title: 'iPhone SE 4 Satışda', content: 'OLED ekran, Face ID və A18 çipi ilə təchiz olunmuş yeni büdcə dostu iPhone SE 4 qlobal bazarda satışa çıxarıldı.', date: 'Fevral 2026' },
    { id: 'i3', title: 'MacBook Air M4', content: 'Apple, süni intellekt əməliyyatları üçün xüsusi olaraq optimallaşdırılmış yeni M4 çipli MacBook Air modellərini təqdim etdi.', date: 'Mart 2026' },
    { id: 'i4', title: 'Apple Vision Pro 2 Şayiələri', content: 'Daha yüngül dizayn və M5 çipi ilə təchiz olunacaq Apple Vision Pro 2-nin bu ilin sonlarında təqdim ediləcəyi gözlənilir.', date: 'Mart 2026' },
  ],
  xiaomi: [
    { id: 'x1', title: 'Xiaomi 16 Ultra Qlobal Təqdimatı', content: 'Beşinci nəsil Leica optikası, 200MP periskop kamerası və Snapdragon 8 Gen 5 ilə təchiz olunmuş Xiaomi 16 Ultra qlobal bazara çıxdı.', date: 'Mart 2026' },
    { id: 'x2', title: 'HyperOS 3.0', content: 'Xiaomi, bütün ekosistem cihazlarını (telefon, ev, avtomobil) tək mərkəzdən idarə edən HyperOS 3.0 sistemini duyurdu.', date: 'Fevral 2026' },
    { id: 'x3', title: 'Xiaomi SU7 Ultra', content: 'Xiaomi-nin 1000 at gücündən çox performansa malik yeni idman avtomobili SU7 Ultra rəsmən Avropa bazarına daxil oldu.', date: 'Mart 2026' },
    { id: 'x4', title: 'Redmi Note 15 Seriyası', content: '240W sürətli şarj və 200MP kamera ilə təchiz olunmuş yeni Redmi Note 15 seriyası satışa çıxarıldı.', date: 'Yanvar 2026' },
  ],
  honor: [
    { id: 'h1', title: 'Honor Magic 8 Pro', content: 'Yeni nəsil silikon-karbon batareya (6000 mAh), süni intellekt dəstəkli kamera və Snapdragon 8 Gen 5 çipi ilə Magic 8 Pro rəsmən təqdim edildi.', date: 'Fevral 2026' },
    { id: 'h2', title: 'Honor Magic V4', content: 'Cəmi 8.8 mm qalınlığı ilə dünyanın ən incə qatlana bilən smartfonu rekordunu yeniləyən Honor Magic V4 qlobal bazarda satışa çıxarıldı.', date: 'Mart 2026' },
    { id: 'h3', title: 'Honor 300 Seriyası', content: 'Studio Harcourt ilə əməkdaşlıq çərçivəsində peşəkar portret çəkilişi təklif edən Honor 300 və 300 Pro modelləri təqdim olundu.', date: 'Yanvar 2026' },
  ],
  nothing: [
    { id: 'n1', title: 'Nothing Phone (4) Təqdim Edildi', content: 'Tamamilə yenilənmiş Micro-LED Glyph interfeysi, Snapdragon 8 Gen 4 prosessoru və süni intellekt inteqrasiyası ilə Nothing Phone (4) rəsmən duyuruldu.', date: 'Mart 2026' },
    { id: 'n2', title: 'Nothing Ear (3)', content: 'Daha güclü aktiv səs-küy ləğvi (ANC) və yüksək keyfiyyətli səs kodekləri ilə yeni nəsil qulaqlıqlar təqdim edildi.', date: 'Fevral 2026' },
    { id: 'n3', title: 'Nothing OS 4.0', content: 'Android 16 əsaslı, daha minimalist dizayn və fərdiləşdirilə bilən vidjetlərlə Nothing OS 4.0 istifadəyə verildi.', date: 'Mart 2026' },
  ],
};

const firstAidTips = [
  {
    id: 'water',
    title: '💧 Telefon Suya Düşərsə',
    content: 'ƏN VACİB QAYDA: Telefonu dərhal söndürün və zaryadkaya taxmayın!\n\n1. Cihazı sudan çıxaran kimi söndürün.\n2. Çexolu, SİM və yaddaş kartını çıxarın.\n3. Yumşaq dəsmalla qurulayın.\n4. Fenlə qurutma: Mütləq soyuq və ya çox mülayim havada, 20-30 sm məsafədən ehtiyatla edin.\n\nSəhvlər: İsti fenlə qurutmayın, düyüyə qoymayın, telefonu silkələməyin.'
  },
  {
    id: 'frozen',
    title: '❄️ Telefon Donarsa',
    content: 'Əgər telefon cavab vermirsə, "Məcburi Yenidən Başlatma" (Force Restart) edin.\n\niPhone: Səsartırma (+), səsalçaltma (-) basıb buraxın, sonra "Power" düyməsini alma loqosu gələnə qədər basıb saxlayın.\n\nAndroid: "Power" və Səsalçaltma (-) düyməsini 10-15 saniyə eyni anda basıb saxlayın.'
  },
  {
    id: 'charging',
    title: '🔌 Telefon Zaryadka Yığmırsa',
    content: '1. Portun təmizlənməsi: Diş çöpü və ya quru fırça ilə yuvadakı tozları ehtiyatla təmizləyin.\n2. Kabel və Adaptor: Başqa bir orijinal kabel və başlıqla yoxlayın.\n3. Rozetka: Fərqli yerdə yoxlayın.'
  },
  {
    id: 'heat',
    title: '🔥 Telefon Həddindən Artıq Qızarsa',
    content: '1. Çexolu çıxarın: İstiliyin çıxmasına mane olur.\n2. Ağır proqramları bağlayın: Oyunları və GPS-i söndürün.\n3. Günəşdən uzaq tutun.\n\nSəhv: Soyuducuya qoymayın! Nəmişlik qısaqapanma yarada bilər.'
  },
  {
    id: 'black-screen',
    title: '🌑 Ekran Qaralıbsa',
    content: 'Əgər səs gəlir amma görüntü yoxdursa:\n1. Məcburi Yenidən Başlatma üsulunu yoxlayın.\n2. Əgər düzəlmirsə, ekranın daxili matrisası zədələnib və usta müdaxiləsi şərtdir.'
  },
  {
    id: 'sound',
    title: '🔊 Səs Zəif Gəlirsə',
    content: '1. Təmizlik: Dinamik və mikrofon dəliklərini quru diş fırçası ilə ehtiyatla təmizləyin.\n2. Ayarlar: "Səssiz" rejimin bağlı olduğundan əmin olun.\n3. Bluetooth: Qulaqlığa bağlı qalıb-qalmadığını yoxlayın.'
  },
  {
    id: 'battery',
    title: '🔋 Batareya Tez Bitirsə',
    content: '1. Sağlamlıq: Ayarlardan "Battery Health" hissəsinə baxın. 80%-dən aşağıdırsa, dəyişilməlidir.\n2. Arxa fon: İstifadə etmədiyiniz proqramları tam bağlayın.\n3. Parlaqlıq: Avtomatik rejimə qoyun.'
  },
  {
    id: 'network',
    title: '📶 Wi-Fi və ya Şəbəkə Tutmursa',
    content: '1. Uçuş Rejimi: Yandırıb 10 saniyə gözləyin və söndürün.\n2. Ayarları Sıfırlama: "Reset Network Settings" edin.\n3. SİM Kart: Çıxarıb sarı hissəsini pozanla ehtiyatla silib yenidən taxın.'
  },
  {
    id: 'storage',
    title: '💾 Yaddaş Doludur / Donur',
    content: '1. Keş Təmizlənməsi: Telegram, WhatsApp və TikTok-un keşini təmizləyin.\n2. Boş Yer: Yaddaşın ən azı 15%-i boş olmalıdır.'
  },
  {
    id: 'camera',
    title: '📸 Kamera Bulanıq Çəkirsə',
    content: '1. Linzanı Silin: Mikrofiber bezlə ehtiyatla silin.\n2. Fokus: Telefonu yüngülcə əlinizə vurun (bəzən mexanizm ilişir).'
  },
  {
    id: 'password',
    title: '🔑 Şifrəni Unutmusunuzsa',
    content: 'Şifrəni unutduqda tək yol telefonu tam sıfırlamaqdır (Format). Bu zaman bütün məlumatlar silinəcək. iCloud və ya Google hesabınızı bilirsinizsə, məlumatları bərpa etmək olar.'
  }
];

export default function Home() {
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [expandedTip, setExpandedTip] = useState<string | null>(null);
  const [showFirstAidModal, setShowFirstAidModal] = useState(false);
  const [showFrpModal, setShowFrpModal] = useState(false);
  const [showFrpInfo, setShowFrpInfo] = useState(false);
  const [frpRequests, setFrpRequests] = useState<FrpRequest[]>([]);
  const [frpLoading, setFrpLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [frpForm, setFrpForm] = useState({
    phoneModel: '',
    androidVersion: '',
    imei: '',
    serialNumber: ''
  });
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Fetch user profile
    const fetchProfile = async () => {
      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserProfile(docSnap.data() as UserProfile);
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
      }
    };
    fetchProfile();

    const q = query(collection(db, 'frpRequests'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FrpRequest[];
      setFrpRequests(requests);
    });

    return () => unsubscribe();
  }, []);

  const handleFrpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    if (!frpForm.phoneModel || !frpForm.imei) {
      showToast('Model və IMEI mütləqdir', 'error');
      return;
    }

    setFrpLoading(true);
    try {
      await addDoc(collection(db, 'frpRequests'), {
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName || 'İstifadəçi',
        ...frpForm,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // Notify admin
      await addDoc(collection(db, 'notifications'), {
        userId: 'admin',
        title: 'Yeni FRP Sorğusu',
        body: `${user.displayName || 'İstifadəçi'} tərəfindən yeni FRP sorğusu göndərildi.`,
        link: '/admin',
        createdAt: serverTimestamp(),
        read: false
      });

      showToast('Sorğunuz göndərildi. Admin tərəfindən qiymət təyin olunmasını gözləyin.', 'success');
      setFrpForm({ phoneModel: '', androidVersion: '', imei: '', serialNumber: '' });
      setShowFrpModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'frpRequests');
    } finally {
      setFrpLoading(false);
    }
  };

  const handleFrpPayment = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'frpRequests', requestId), {
        status: 'paid',
        updatedAt: serverTimestamp()
      });

      // Notify admin
      await addDoc(collection(db, 'notifications'), {
        userId: 'admin',
        title: 'FRP Ödənişi',
        body: `Bir istifadəçi FRP sorğusu üçün ödəniş etdiyini bildirdi.`,
        link: '/admin',
        createdAt: serverTimestamp(),
        read: false
      });

      showToast('Ödəniş məlumatı göndərildi. FRP işlənməsini gözləyin.', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `frpRequests/${requestId}`);
    }
  };

  const isCustomer = userProfile?.userType !== 'master' && userProfile?.userType !== 'programmer';

  return (
    <div className="p-4 pb-32 space-y-8">
      <AdBanner placement="home" />
      
      {/* Welcome Section */}
      <section className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-200 dark:shadow-slate-900/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase mb-2">
          RF SERVİS <span className="text-primary">ASİSTAN</span>
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-xs font-medium max-w-xs leading-relaxed">
          Bu proqram ustalar, proqramistlər və online satış üçün RF SERVİS tərəfindən yaradıldı
        </p>
      </section>

      {/* Auto-Deploy Test Banner */}
      <section className="bg-emerald-500/10 border-2 border-emerald-500/20 p-4 rounded-3xl flex items-center justify-center gap-3">
        <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white shrink-0">
          <CheckCircle size={18} />
        </div>
        <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest text-center">
          AVTOMATİK YENİLƏNMƏ TESTİ: AKTİVDİR ✅
        </p>
      </section>

      {/* Brands Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
            <Zap className="text-primary" size={16} />
            Xidmətlər
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <button 
            onClick={() => setShowFrpModal(true)}
            className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-lg flex flex-col items-center gap-3 group relative"
          >
            {frpRequests.some(r => r.status !== 'completed' && r.status !== 'rejected') && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-white dark:border-slate-800 animate-pulse"></span>
            )}
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Server size={24} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white">FRP SERVER</span>
          </button>

          {isCustomer && (
            <button 
              onClick={() => setShowFirstAidModal(true)}
              className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-lg flex flex-col items-center gap-3 group"
            >
              <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <HeartPulse size={24} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white text-center">İlkin Yardım Kiti</span>
            </button>
          )}

          {(userProfile?.userType === 'master' || userProfile?.userType === 'programmer' || userProfile?.role === 'admin') && (
            <>
              <Link 
                to="/kit/repair-kit" 
                className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-lg flex flex-col items-center gap-3 group"
              >
                <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Cpu size={24} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white">Təmir Kit</span>
              </Link>
              <Link 
                to="/kit/software-kit" 
                className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-lg flex flex-col items-center gap-3 group"
              >
                <div className="w-12 h-12 bg-purple-500/10 text-purple-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Terminal size={24} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white">Proqram Kit</span>
              </Link>
              <Link 
                to="/kit/isp-kit" 
                className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-lg flex flex-col items-center gap-3 group"
              >
                <div className="w-12 h-12 bg-cyan-500/10 text-cyan-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Cpu size={24} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white text-center">ISP / Test Point</span>
              </Link>
            </>
          )}

          <Link 
            to="/masters" 
            className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-lg flex flex-col items-center gap-3 group"
          >
            <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Navigation size={24} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white text-center">Usta Proqramist Axtar</span>
          </Link>
        </div>
      </section>

      {/* Brands Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
            <Smartphone className="text-primary" size={16} />
            Brend Yenilikləri
          </h2>
        </div>
        
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {brands.map((brand) => (
            <button
              key={brand.id}
              onClick={() => setSelectedBrand(brand.id)}
              className={`p-4 rounded-3xl flex flex-col items-center justify-center gap-3 transition-all active:scale-95 border-2 ${
                selectedBrand === brand.id 
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-primary shadow-xl shadow-cyan-500/10' 
                  : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-transparent shadow-lg shadow-slate-200 dark:shadow-none'
              }`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${selectedBrand === brand.id ? 'bg-primary' : brand.color + ' text-white shadow-md'}`}>
                <brand.icon size={24} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest">{brand.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* News Section */}
      <section className="space-y-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
          <Zap className="text-primary" size={16} />
          Son Xəbərlər
        </h2>

        <div className="grid gap-4">
          {selectedBrand ? (
            brandUpdates[selectedBrand as keyof typeof brandUpdates]?.map((update) => (
              <div
                key={update.id}
                className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-200 dark:shadow-slate-900/50"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-black text-slate-900 dark:text-white text-sm leading-tight uppercase tracking-tight max-w-[70%]">{update.title}</h3>
                  <span className="text-[8px] font-black text-primary bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full uppercase tracking-widest">{update.date}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">{update.content}</p>
                <button className="mt-4 text-[10px] font-black text-primary flex items-center gap-1 uppercase tracking-widest hover:gap-2 transition-all">
                  Ətraflı Oxu <ChevronRight size={14} />
                </button>
              </div>
            ))
          ) : (
            <div className="bg-white dark:bg-slate-800 p-12 rounded-[2.5rem] text-center border-2 border-dashed border-slate-200 dark:border-slate-700">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Info className="text-slate-400" size={32} />
              </div>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Məlumatları görmək üçün brend seçin</p>
            </div>
          )}
        </div>
      </section>

      {/* First Aid Modal */}
      <AnimatePresence>
        {showFirstAidModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[2.5rem] p-6 shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden relative flex flex-col max-h-[90vh]"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
              
              <div className="flex justify-between items-center mb-6 relative shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-rose-500/10 text-rose-500 rounded-xl flex items-center justify-center">
                    <HeartPulse size={20} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">İLKİN YARDIM KİTİ</h3>
                </div>
                <button onClick={() => setShowFirstAidModal(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide space-y-3 pb-4">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mb-4 ml-1">Ev şəraitində ilkin tədbirlər</p>
                
                {firstAidTips.map((tip) => (
                  <div 
                    key={tip.id}
                    className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden transition-all"
                  >
                    <button
                      onClick={() => setExpandedTip(expandedTip === tip.id ? null : tip.id)}
                      className="w-full p-4 flex items-center justify-between text-left"
                    >
                      <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tight">{tip.title}</span>
                      <motion.div
                        animate={{ rotate: expandedTip === tip.id ? 180 : 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <ChevronDown size={16} className="text-slate-400" />
                      </motion.div>
                    </button>
                    
                    <AnimatePresence>
                      {expandedTip === tip.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="px-4 pb-5">
                            <div className="h-px bg-slate-200 dark:bg-slate-700 mb-3"></div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium whitespace-pre-line">
                              {tip.content}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 text-center shrink-0">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">⚠️ Diqqət: Bu məsləhətlər yalnız ilkin yardım üçündür. Ciddi problemlərdə mütləq ustaya müraciət edin.</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FRP Modal */}
      <AnimatePresence>
        {showFrpModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden relative"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
              
              <div className="flex justify-between items-center mb-6 relative">
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">FRP SERVER SORĞUSU</h3>
                <button onClick={() => setShowFrpModal(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              {frpRequests.length > 0 && (
                <div className="mb-6 space-y-3 max-h-48 overflow-y-auto pr-2 scrollbar-hide">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Mövcud Sorğularınız</h4>
                  {frpRequests.map(req => (
                    <div key={req.id} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{req.phoneModel}</p>
                          <p className="text-[10px] text-slate-500 font-mono">IMEI: {req.imei}</p>
                        </div>
                        <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-widest ${
                          req.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                          req.status === 'price_set' ? 'bg-cyan-500/20 text-cyan-400' :
                          req.status === 'paid' ? 'bg-blue-500/20 text-blue-400' :
                          req.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {req.status === 'pending' ? 'Gözləyir' : 
                           req.status === 'price_set' ? 'Ödəniş gözlənilir' : 
                           req.status === 'paid' ? 'FRP işlənir' :
                           req.status === 'completed' ? 'Bitti' : 'Rədd edildi'}
                        </span>
                      </div>

                      {req.status === 'price_set' && (
                        <div className="pt-3 border-t border-slate-700 space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-400">Təyin olunmuş məbləğ:</span>
                            <span className="text-lg font-black text-primary">{req.price} AZN</span>
                          </div>
                          
                          <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                            <p className="text-[9px] text-slate-500 mb-2 uppercase tracking-widest font-black">Kart nömrəsi:</p>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-900 dark:text-white font-mono font-bold text-sm tracking-wider">5239 1517 1324 5515</span>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText('5239151713245515');
                                  setCopied(true);
                                  setTimeout(() => setCopied(false), 2000);
                                }}
                                className={`text-[10px] px-2 py-1 rounded-lg font-bold transition-colors ${
                                  copied ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-primary/20 text-primary'
                                }`}
                              >
                                {copied ? 'Kopyalandı' : 'Kopyala'}
                              </button>
                            </div>
                          </div>

                          <button 
                            onClick={() => handleFrpPayment(req.id)}
                            className="w-full py-3 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                          >
                            <CreditCard size={18} />
                            Ödəniş etdim
                          </button>
                        </div>
                      )}

                      {req.status === 'paid' && (
                        <div className="flex items-center gap-2 text-blue-400 text-[10px] font-bold uppercase tracking-widest bg-blue-500/10 p-2 rounded-lg">
                          <Clock size={14} className="animate-spin" />
                          FRP işlənir, zəhmət olmasa gözləyin...
                        </div>
                      )}

                      {req.status === 'completed' && (
                        <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 p-2 rounded-lg">
                          <CheckCircle size={14} />
                          Bitti, cihazı yenidən başladın
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleFrpSubmit} className="space-y-4 relative">
                <div className="flex items-center gap-2 ml-1">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">FRP GÖNDƏR</h4>
                  <button 
                    type="button"
                    onClick={() => setShowFrpInfo(!showFrpInfo)}
                    className="text-slate-400 hover:text-primary transition-colors"
                  >
                    <Info size={14} />
                  </button>
                </div>

                <AnimatePresence>
                  {showFrpInfo && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 text-[10px] text-slate-300 space-y-2 mb-2 leading-relaxed">
                        <p>
                          Samsung modelləri üçün FRP serverdə modeli yazırsınız, IMEI yazırsınız, Android versiyasını yazırsınız, sorğu göndərirsiniz. FRP server bölməsində "Gözləyin" yazılır. Sonra qiymət təyin olunur, yenidən FRP serverdə "Ödəniş et" yazısı olur və kart nömrəsi göstərilir. Həmin karta təyin olunan məbləği göndərirsiniz, "Ödəniş etdim" yazısını vurursunuz, FRP işləri başlayır və bütün prosesi server bölməsində və yaxud FRP server ikonunun üstündə görə bilirsiniz.
                        </p>
                        <p className="text-red-400 font-medium">
                          Əgər "Rədd edildi" yazılırsa, bu o deməkdir ki, cihazın SPL versiyası server tərəfindən dəstəklənmir və ödənişiniz geri ödənilir.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Model</label>
                    <input
                      type="text"
                      placeholder="Məs: Samsung S24"
                      value={frpForm.phoneModel}
                      onChange={(e) => setFrpForm({...frpForm, phoneModel: e.target.value})}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white text-xs placeholder-slate-400 dark:placeholder-slate-600 focus:border-primary transition-colors"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Android</label>
                    <input
                      type="text"
                      placeholder="Məs: 14"
                      value={frpForm.androidVersion}
                      onChange={(e) => setFrpForm({...frpForm, androidVersion: e.target.value})}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white text-xs placeholder-slate-400 dark:placeholder-slate-600 focus:border-primary transition-colors"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">IMEI Kod</label>
                  <input
                    type="text"
                    placeholder="15 rəqəmli IMEI"
                    value={frpForm.imei}
                    onChange={(e) => setFrpForm({...frpForm, imei: e.target.value})}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white text-xs placeholder-slate-400 dark:placeholder-slate-600 focus:border-primary transition-colors"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Seriya Nömrəsi</label>
                  <input
                    type="text"
                    placeholder="S/N"
                    value={frpForm.serialNumber}
                    onChange={(e) => setFrpForm({...frpForm, serialNumber: e.target.value})}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white text-xs placeholder-slate-400 dark:placeholder-slate-600 focus:border-primary transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={frpLoading}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-black shadow-lg shadow-cyan-500/30 flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50 mt-2"
                >
                  <Send size={18} />
                  {frpLoading ? 'GÖNDƏRİLİR...' : 'FRP GÖNDƏR'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
