import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Mail, Lock, User as UserIcon, Phone, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { useToast } from '../context/ToastContext';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [userType, setUserType] = useState<'user' | 'master' | 'programmer'>('user');
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  // Logo URL - User should replace this with their actual logo path
  const logoUrl = "https://raw.githubusercontent.com/rauf2289/rfservis/main/logo.png"; // Placeholder path

  const [isRegistered, setIsRegistered] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetMessage('');
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setResetMessage('Şifrə yeniləmə linki e-poçt ünvanınıza göndərildi.');
      showToast('Şifrə yeniləmə linki e-poçt ünvanınıza göndərildi.', 'success');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found') {
        setError('Bu e-poçt ünvanı ilə qeydiyyatdan keçmiş istifadəçi tapılmadı.');
        showToast('Bu e-poçt ünvanı ilə qeydiyyatdan keçmiş istifadəçi tapılmadı.', 'error');
      } else if (err.code === 'auth/invalid-email') {
        setError('Düzgün e-poçt ünvanı daxil edin.');
        showToast('Düzgün e-poçt ünvanı daxil edin.', 'error');
      } else {
        setError('Xəta baş verdi. Yenidən cəhd edin.');
        showToast('Xəta baş verdi. Yenidən cəhd edin.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (auth.currentUser) {
      try {
        await sendEmailVerification(auth.currentUser);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        showToast('Sistemə uğurla daxil oldunuz!', 'success');
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName });
        
        // Send email verification
        await sendEmailVerification(userCredential.user);
        
        try {
          const status = userType === 'user' ? 'active' : 'pending';
          const userData = {
            uid: userCredential.user.uid,
            email,
            displayName,
            role: 'user',
            userType,
            status,
            createdAt: new Date().toISOString()
          };
          
          await setDoc(doc(db, 'users', userCredential.user.uid), userData);
          
          // Also create a public profile for the messages list
          await setDoc(doc(db, 'publicProfiles', userCredential.user.uid), {
            uid: userCredential.user.uid,
            displayName,
            userType,
            status,
            photoURL: '',
            isOnline: true,
            lastSeen: new Date()
          });

          // Notify Admin about new registration
          await addDoc(collection(db, 'notifications'), {
            userId: 'admin',
            title: 'Yeni Qeydiyyat',
            body: `${displayName} (${userType === 'user' ? 'Müştəri' : userType === 'master' ? 'Usta' : 'Proqramist'}) qeydiyyatdan keçdi.`,
            link: '/admin/users',
            createdAt: serverTimestamp(),
            read: false
          });
          
          setIsRegistered(true);
          if (status === 'pending') {
            showToast('Qeydiyyat tamamlandı! Hesabınızın təsdiqlənməsini gözləyin.', 'info');
          } else {
            showToast('Qeydiyyat uğurla tamamlandı! Zəhmət olmasa e-poçtunuzu təsdiqləyin.', 'success');
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${userCredential.user.uid}`);
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Bu e-poçt artıq istifadə olunur.');
        showToast('Bu e-poçt artıq istifadə olunur.', 'error');
      } else if (err.code === 'auth/invalid-credential') {
        setError('E-poçt və ya şifrə yanlışdır.');
        showToast('E-poçt və ya şifrə yanlışdır.', 'error');
      } else if (err.code === 'auth/weak-password') {
        setError('Şifrə ən azı 6 simvoldan ibarət olmalıdır.');
        showToast('Şifrə ən azı 6 simvoldan ibarət olmalıdır.', 'error');
      } else {
        setError('Xəta baş verdi. Yenidən cəhd edin.');
        showToast('Xəta baş verdi. Yenidən cəhd edin.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900 p-6 transition-colors duration-300">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-slate-50 dark:bg-slate-800 rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700"
      >
        <div className="bg-slate-50 dark:bg-slate-800 p-8 text-center border-b border-slate-200 dark:border-slate-700">
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-red-500 dark:text-red-400 text-xs font-bold uppercase tracking-wider leading-relaxed">
              Qeydiyyat qaydalarına düzgün riayət edin, əks halda hesabınız silinəcək
            </p>
          </div>
          <div className="w-full h-32 flex items-center justify-center mb-4">
            {/* Using an img tag for the logo as requested */}
            <img 
              src={logoUrl} 
              alt="RF SERVİS Logo" 
              className="max-h-full object-contain"
              onError={(e) => {
                // Fallback to a styled div if image fails
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  const fallback = document.createElement('div');
                  fallback.className = "w-20 h-20 bg-primary rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg";
                  fallback.innerText = "RF";
                  parent.appendChild(fallback);
                }
              }}
            />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">RF SERVİS</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1 uppercase tracking-widest">Təmir Proqram və online şhop Xidməti</p>
        </div>

        <div className="p-8">
          {isRegistered ? (
            <div className="text-center space-y-6 py-4">
              <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                <Mail size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">E-poçtunuzu yoxlayın</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  Qeydiyyat uğurla tamamlandı. Zəhmət olmasa <span className="font-bold text-primary">{email}</span> ünvanına göndərilən təsdiqləmə linkinə klikləyin.
                </p>
              </div>
              <div className="pt-4 space-y-3">
                <button
                  onClick={handleResendEmail}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-black shadow-xl shadow-cyan-500/20 hover:bg-cyan-600 active:scale-[0.97] transition-all uppercase tracking-widest text-sm"
                >
                  Yenidən Göndər
                </button>
                <button
                  onClick={() => setIsRegistered(false)}
                  className="w-full py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-all uppercase tracking-widest text-sm"
                >
                  Girişə Qayıt
                </button>
              </div>
            </div>
          ) : isResettingPassword ? (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div className="text-center mb-6">
                <h3 className="text-slate-900 dark:text-white font-bold text-lg mb-2">Şifrəni Yenilə</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">E-poçt ünvanınızı daxil edin, sizə şifrə yeniləmə linki göndərəcəyik.</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase ml-1 tracking-widest">E-poçt</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                    placeholder="nümunə@mail.com"
                  />
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-xs font-bold bg-red-900/20 p-4 rounded-xl border border-red-900/50 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                  {error}
                </p>
              )}

              {resetMessage && (
                <p className="text-emerald-400 text-xs font-bold bg-emerald-900/20 p-4 rounded-xl border border-emerald-900/50 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                  {resetMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-primary text-white rounded-2xl font-black shadow-xl shadow-cyan-500/20 hover:bg-cyan-600 active:scale-[0.97] transition-all disabled:opacity-70 mt-4 uppercase tracking-widest text-sm"
              >
                {loading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
                ) : (
                  'Linki Göndər'
                )}
              </button>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsResettingPassword(false);
                    setError('');
                    setResetMessage('');
                  }}
                  className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Geri Qayıt
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase ml-1 tracking-widest">Ad Soyad</label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                      <input
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                        placeholder="Adınız"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase ml-1 tracking-widest">İstifadəçi Növü</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setUserType('user')}
                        className={`py-3 px-2 rounded-xl text-[9px] font-bold uppercase tracking-tighter transition-all border ${
                          userType === 'user' 
                            ? 'bg-primary text-white border-primary shadow-lg shadow-cyan-500/20' 
                            : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500'
                        }`}
                      >
                        Müştəriyəm, proqramist usta axtarıram
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserType('master')}
                        className={`py-3 rounded-xl text-[10px] font-bold uppercase tracking-tighter transition-all border ${
                          userType === 'master' 
                            ? 'bg-primary text-white border-primary shadow-lg shadow-cyan-500/20' 
                            : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500'
                        }`}
                      >
                        Usta
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserType('programmer')}
                        className={`py-3 rounded-xl text-[10px] font-bold uppercase tracking-tighter transition-all border ${
                          userType === 'programmer' 
                            ? 'bg-primary text-white border-primary shadow-lg shadow-cyan-500/20' 
                            : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500'
                        }`}
                      >
                        Proqramist
                      </button>
                    </div>
                    {userType === 'user' && (
                      <p className="text-[9px] text-amber-500 dark:text-amber-400 font-bold mt-1 ml-1">
                        * qeydiyyatdan kecdikdən sonra Ana səhifədə usta proqramist axtar bölməsinə girin
                      </p>
                    )}
                    {userType !== 'user' && (
                      <p className="text-[9px] text-amber-600 dark:text-amber-400 font-bold mt-1 ml-1 animate-pulse">
                        * Usta/Proqramist hesabı admin tərəfindən təsdiqlənməlidir.
                      </p>
                    )}
                  </div>
                </>
              )}

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase ml-1 tracking-widest">E-poçt</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                  placeholder="nümunə@mail.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase ml-1 tracking-widest">Şifrə</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                  placeholder="••••••"
                />
              </div>
            </div>

            {isLogin && (
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsResettingPassword(true);
                    setError('');
                  }}
                  className="text-primary text-xs font-bold hover:text-cyan-400 transition-colors"
                >
                  Şifrənizi unutmusunuz?
                </button>
              </div>
            )}

            {error && (
              <p className="text-red-400 text-xs font-bold bg-red-900/20 p-4 rounded-xl border border-red-900/50 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-primary text-white rounded-2xl font-black shadow-xl shadow-cyan-500/20 hover:bg-cyan-600 active:scale-[0.97] transition-all disabled:opacity-70 mt-4 uppercase tracking-widest text-sm"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
              ) : (
                isLogin ? 'Daxil Ol' : 'Qeydiyyatdan Keç'
              )}
            </button>
          </form>
          )}

          {!isResettingPassword && (
            <div className="mt-8 text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-slate-900 dark:text-white text-xs font-black uppercase tracking-widest hover:text-primary transition-colors"
              >
                {isLogin ? 'Hesabınız yoxdur? Qeydiyyat' : 'Artıq hesabınız var? Giriş'}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
