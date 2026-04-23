import React, { useState, useMemo } from 'react';
import { Search, Cpu, Smartphone, Info, ChevronRight, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { icData, ICItem } from '../data/icData';

const ICSearch: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Hamısı');

  const categories = useMemo(() => {
    const cats = Array.from(new Set(icData.map(item => item.category)));
    return ['Hamısı', ...cats];
  }, []);

  const filteredData = useMemo(() => {
    return icData.filter(item => {
      const matchesSearch = 
        item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.models.some(model => model.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'Hamısı' || item.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, selectedCategory]);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 pb-24">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
            Mikrosxem Uyğunluğu
          </h1>
          <p className="text-slate-400 text-sm">
            Mikrosxem kodunu və ya telefon modelini yazaraq uyğun donorları tapın.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-500 group-focus-within:text-primary transition-colors" />
          </div>
          <input
            type="text"
            placeholder="IC kodu və ya Model axtar... (məs: PM8953, A207F)"
            className="block w-full pl-12 pr-4 py-4 bg-slate-900 border border-slate-800 rounded-2xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-lg shadow-xl"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Categories */}
        <div className="flex overflow-x-auto pb-2 gap-2 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-primary text-white shadow-lg shadow-primary/20'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="grid gap-4">
          <AnimatePresence mode="popLayout">
            {filteredData.length > 0 ? (
              filteredData.map((item, idx) => (
                <motion.div
                  key={item.code}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-primary/50 transition-all shadow-lg group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-primary/10 rounded-xl">
                        <Cpu className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">
                          {item.code}
                        </h3>
                        <span className="text-xs font-medium px-2 py-0.5 bg-slate-800 text-slate-400 rounded-md border border-slate-700">
                          {item.category}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                      <Smartphone className="w-4 h-4" />
                      <span>Uyğun Modellər:</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.models.map(model => (
                        <span 
                          key={model}
                          className="px-3 py-1 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                        >
                          {model}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20 bg-slate-900/50 rounded-3xl border border-dashed border-slate-800"
              >
                <div className="inline-flex p-4 bg-slate-800 rounded-full mb-4">
                  <Info className="w-8 h-8 text-slate-500" />
                </div>
                <h3 className="text-xl font-medium text-slate-300">Nəticə tapılmadı</h3>
                <p className="text-slate-500 mt-2">Başqa bir kod və ya model yoxlayın.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Disclaimer */}
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex gap-3">
          <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-300/80 leading-relaxed">
            Bu məlumatlar usta təcrübələri və forumlardan toplanmışdır. Dəqiqliyini sxem (schematic) vasitəsilə yoxlamağınız tövsiyə olunur.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ICSearch;
