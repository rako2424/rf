import React, { useState } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ImageModalProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

export default function ImageModal({ src, alt, onClose }: ImageModalProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = src;
    link.download = `rf-servis-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale(prev => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale(prev => Math.max(prev - 0.5, 1));
  };

  const handleRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRotation(prev => prev + 90);
  };

  const resetTransform = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale(1);
    setRotation(0);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4 overflow-hidden"
      >
        {/* Background click to close */}
        <div className="absolute inset-0 cursor-zoom-out" onClick={onClose} />

        {/* Controls */}
        <div className="absolute top-6 right-6 flex items-center gap-3 z-[210]">
          <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md rounded-full p-1 border border-white/10">
            <button
              onClick={handleZoomOut}
              disabled={scale <= 1}
              className="p-2.5 hover:bg-white/10 text-white rounded-full transition-all active:scale-90 disabled:opacity-30 disabled:pointer-events-none"
              title="Uzaqlaşdır"
            >
              <ZoomOut size={20} />
            </button>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button
              onClick={handleZoomIn}
              disabled={scale >= 4}
              className="p-2.5 hover:bg-white/10 text-white rounded-full transition-all active:scale-90 disabled:opacity-30 disabled:pointer-events-none"
              title="Yaxınlaşdır"
            >
              <ZoomIn size={20} />
            </button>
          </div>

          <button
            onClick={handleRotate}
            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all active:scale-90 border border-white/10"
            title="Döndər"
          >
            <RotateCcw size={20} />
          </button>

          <button
            onClick={resetTransform}
            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all active:scale-90 border border-white/10"
            title="Sıfırla"
          >
            <span className="text-xs font-bold px-1">1:1</span>
          </button>

          <button
            onClick={handleDownload}
            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all active:scale-90 border border-white/10"
            title="Yüklə"
          >
            <Download size={20} />
          </button>

          <button
            onClick={onClose}
            className="p-2.5 bg-rose-500/20 hover:bg-rose-500/40 text-rose-500 rounded-full backdrop-blur-md transition-all active:scale-90 border border-rose-500/20"
            title="Bağla"
          >
            <X size={20} />
          </button>
        </div>

        {/* Image Container */}
        <motion.div
          drag={scale > 1}
          dragConstraints={{ left: -500, right: 500, top: -500, bottom: 500 }}
          dragElastic={0.1}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ 
            scale: scale, 
            rotate: rotation,
            opacity: 1 
          }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className={`relative max-w-full max-h-full flex items-center justify-center ${scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={src}
            alt={alt || 'Görünüş'}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl pointer-events-none select-none"
            referrerPolicy="no-referrer"
          />
        </motion.div>

        {/* Scale Indicator */}
        {scale > 1 && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 backdrop-blur-md rounded-full border border-white/10 text-white text-xs font-bold tracking-widest uppercase">
            Zoom: {Math.round(scale * 100)}%
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
