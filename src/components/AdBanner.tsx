import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Ad } from '../types';
import { ExternalLink, Megaphone, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';

interface AdBannerProps {
  placement: Ad['placement'];
}

export default function AdBanner({ placement }: AdBannerProps) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const fetchAds = async () => {
      try {
        const q = query(
          collection(db, 'ads'),
          where('active', '==', true),
          where('placement', 'in', [placement, 'all']),
          orderBy('createdAt', 'desc'),
          limit(5)
        );
        const snapshot = await getDocs(q);
        const adsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ad));
        setAds(adsData);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'ads');
      } finally {
        setLoading(false);
      }
    };

    fetchAds();
  }, [placement]);

  useEffect(() => {
    if (ads.length <= 1) return;

    const interval = setInterval(() => {
      if (!isExpanded) {
        setCurrentIndex((prev) => (prev + 1) % ads.length);
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [ads.length, isExpanded]);

  if (loading || ads.length === 0 || !isVisible) return null;

  const currentAd = ads[currentIndex];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentAd.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        onClick={() => setIsExpanded(!isExpanded)}
        className={`relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-2xl overflow-hidden shadow-xl shadow-slate-200 dark:shadow-black/20 group cursor-pointer transition-all duration-300 ${isExpanded ? 'ring-2 ring-primary/50' : ''}`}
      >
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsVisible(false);
          }}
          className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-all z-10 opacity-0 group-hover:opacity-100"
          title="Bağla"
        >
          <X size={16} />
        </button>

        <div className={`flex flex-col md:flex-row items-stretch transition-all duration-300 ${isExpanded ? 'min-h-[200px]' : 'min-h-[120px]'}`}>
          {currentAd.imageUrl && (
            <div className={`w-full md:w-48 shrink-0 relative transition-all duration-300 ${isExpanded ? 'h-48 md:h-auto' : 'h-32 md:h-auto'}`}>
              <img 
                src={currentAd.imageUrl} 
                alt={currentAd.title} 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/50 dark:to-slate-800/50 md:to-transparent" />
            </div>
          )}
          
          <div className="flex-1 p-5 flex flex-col justify-center gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="text-primary shrink-0" size={16} />
                <h4 className="font-black text-xs uppercase tracking-widest text-primary/80">Elan</h4>
              </div>
              {isExpanded && (
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Tam oxunur</span>
              )}
            </div>
            
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{currentAd.title}</h3>
              <motion.p 
                layout
                className={`text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}
              >
                {currentAd.content}
              </motion.p>
            </div>

            {currentAd.link && (
              <a
                href={currentAd.link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-2 text-xs font-bold text-white bg-primary px-4 py-2 rounded-xl w-fit mt-2 shadow-lg shadow-cyan-500/20 active:scale-95 transition-transform"
              >
                Ətraflı bax
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>

        {ads.length > 1 && !isExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-700/30">
            <motion.div 
              key={`progress-${currentAd.id}`}
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 8, ease: "linear" }}
              className="h-full bg-primary shadow-[0_0_8px_rgba(6,182,212,0.5)]"
            />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
