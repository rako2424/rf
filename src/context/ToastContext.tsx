import React, { createContext, useContext, useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastOptions {
  duration?: number;
  senderName?: string;
  senderPhoto?: string;
  isMessage?: boolean;
  onClick?: () => void;
}

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  options?: ToastOptions;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = React.useCallback((message: string, type: ToastType = 'info', options?: ToastOptions) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, options }]);
    
    const duration = options?.duration || 3000;
    
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-0 left-0 right-0 z-[9999] flex flex-col gap-3 w-full items-center p-4 pointer-events-none pt-[calc(1rem+env(safe-area-inset-top,0px))]">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -120, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -80, scale: 0.9, transition: { duration: 0.2 } }}
              className="w-full max-w-md pointer-events-auto"
            >
              {toast.options?.isMessage ? (
                <div 
                  onClick={() => {
                    if (toast.options?.onClick) toast.options.onClick();
                  }}
                  className="bg-slate-800/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-3 active:scale-95 transition-transform cursor-pointer pointer-events-auto"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden shrink-0 border border-white/5">
                    {toast.options.senderPhoto ? (
                      <img src={toast.options.senderPhoto} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-slate-400 font-bold text-xs uppercase">
                        {toast.options.senderName?.charAt(0) || '?'}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-xs font-black text-cyan-400 uppercase tracking-widest truncate">
                        {toast.options.senderName || 'Yeni Mesaj'}
                      </span>
                      <span className="text-[9px] text-slate-500 font-bold uppercase">İndi</span>
                    </div>
                    <p className="text-sm text-white font-medium truncate leading-tight">
                      {toast.message}
                    </p>
                  </div>
                </div>
              ) : (
                <div className={`px-5 py-3 rounded-2xl flex items-center gap-3 backdrop-blur-xl border shadow-2xl ${
                  toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500/50 text-emerald-400 shadow-[0_10px_40px_rgba(16,185,129,0.3)]' :
                  toast.type === 'error' ? 'bg-rose-900/90 border-rose-500/50 text-rose-400 shadow-[0_10px_40px_rgba(244,63,94,0.3)]' :
                  'bg-cyan-900/90 border-cyan-500/50 text-cyan-400 shadow-[0_10px_40px_rgba(34,211,238,0.3)]'
                }`}>
                  {toast.type === 'success' && <CheckCircle2 size={20} />}
                  {toast.type === 'error' && <XCircle size={20} />}
                  {toast.type === 'info' && <Info size={20} />}
                  <span className="font-medium text-sm">{toast.message}</span>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
