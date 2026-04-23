import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Send, Sparkles, User, Bot, Loader2, Trash2, AlertCircle, Image as ImageIcon, X } from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const RFAI: React.FC = () => {
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string, image?: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(process.env.GEMINI_API_KEY || null);
  const [isFetchingKey, setIsFetchingKey] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchApiKey = async () => {
      if (apiKey) return;
      
      setIsFetchingKey(true);
      try {
        const configDoc = await getDoc(doc(db, 'settings', 'ai_config'));
        if (configDoc.exists()) {
          const data = configDoc.data();
          if (data.geminiApiKey) {
            setApiKey(data.geminiApiKey);
          }
        }
      } catch (error) {
        console.error('API key fetch error:', error);
      } finally {
        setIsFetchingKey(false);
      }
    };

    fetchApiKey();
  }, [apiKey]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Şəkil ölçüsü 5MB-dan çox olmamalıdır.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userMessage = input.trim();
    const currentImage = selectedImage;
    setInput('');
    setSelectedImage(null);
    setMessages(prev => [...prev, { role: 'user', text: userMessage || 'Şəkil analizi', image: currentImage || undefined }]);
    setIsLoading(true);

    try {
      let currentKey = apiKey;
      
      // Double check if we can get it from Firestore if still null
      if (!currentKey) {
        const configDoc = await getDoc(doc(db, 'settings', 'ai_config'));
        if (configDoc.exists()) {
          currentKey = configDoc.data().geminiApiKey;
          if (currentKey) setApiKey(currentKey);
        }
      }

      if (!currentKey) {
        throw new Error('API açarı tapılmadı. Zəhmət olmasa Admin Panelindən tənzimləmələri yoxlayın.');
      }

      const ai = new GoogleGenAI({ apiKey: currentKey });
      
      let promptParts: any[] = [{ text: userMessage || "Bu şəkli analiz et." }];
      
      if (currentImage) {
        const base64Data = currentImage.split(',')[1];
        promptParts.push({
          inlineData: {
            data: base64Data,
            mimeType: "image/jpeg"
          }
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts: promptParts },
        config: {
          systemInstruction: `Sən RF Servis platformasının rəsmi süni intellekt asistanısan (RF AI). Sənin əsas vəzifən telefon təmiri, elektronika, sxemlər, proqram təminatı (FRP, flashing və s.) və usta işləri üzrə peşəkar məsləhətlər verməkdir.

Vacib məlumatlar (Kimliyin haqqında):
1. RF nədir: Bu ad platformanın yaradıcısı olan Raufun adının baş (R) və son (f) hərflərinin birləşməsidir.
2. Yaradıcı: Bu proqramın və bütün RF Servis ekosisteminin yaradıcısı Raufdur.
3. Məqsəd: Platformanın yaradılma məqsədi Azərbaycandakı mobil təmir ustalarını, proqramistləri bir araya toplamaq, bir-birlərinə işlərində kömək etmək, işlərini asanlaşdırmaq, müştəriləri bu platforma sayəsində onlara yaxın ustaları və proqramistləri tapmaqda kömək etmək, həmçinin ehtiyat hissələrinin və proqram təminatlarının (tool-ların) onlayn satışını təşkil edərək vahid bir mərkəz yaratmaqdır.

Davranış qaydaların:
- Cavablarını həmişə Azərbaycan dilində, texniki cəhətdən dəqiq və peşəkarların başa düşəcəyi şəkildə ver.
- Əgər kimsə səndən RF-in mənasını və ya yaradıcısını soruşsa, yuxarıdakı məlumatları fəxrlə bildir.
- Əgər sual telefon təmiri, elektronika və ya platforma haqqında deyilsə, nəzakətlə bildir ki, sən yalnız texniki mövzularda və RF Servis haqqında kömək edə bilərsən.
- Şəkil göndərildikdə, şəkildəki komponentləri, zədələri və ya sxemləri diqqətlə analiz et və usta üçün faydalı məlumatlar ver.`,
        }
      });

      const aiText = response.text || 'Üzr istəyirəm, cavab ala bilmədim.';
      setMessages(prev => [...prev, { role: 'model', text: aiText }]);
    } catch (error: any) {
      console.error('RF AI Error:', error);
      setMessages(prev => [...prev, { role: 'model', text: `Xəta baş verdi: ${error.message || 'Bilinməyən xəta'}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    if (window.confirm('Söhbəti təmizləmək istədiyinizə əminsiniz?')) {
      setMessages([]);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">RF AI Asistan</h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">Süni İntellekt Dəstəyi</p>
          </div>
        </div>
        <button 
          onClick={clearChat}
          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
          title="Təmizlə"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center text-slate-400">
              <Sparkles size={32} />
            </div>
            <div>
              <p className="text-slate-900 dark:text-white font-bold">RF AI-ya xoş gəlmisiniz!</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                Telefon təmiri, sxemlər və ya proqram təminatı haqqında istənilən sualı verə bilərsiniz.
              </p>
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' 
                    : 'bg-primary text-white'
                }`}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-tr-none'
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-tl-none'
                }`}>
                  {msg.image && (
                    <img 
                      src={msg.image} 
                      alt="User upload" 
                      className="max-w-full h-auto rounded-lg mb-2 border border-slate-200 dark:border-slate-700"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="markdown-body">
                    <Markdown>{msg.text}</Markdown>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        {isLoading && (
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center text-white shadow-sm">
              <Bot size={16} />
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-3 rounded-2xl rounded-tl-none border border-slate-200 dark:border-slate-700">
              <Loader2 size={16} className="animate-spin text-primary" />
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
        <AnimatePresence>
          {selectedImage && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-24 h-24 mb-4"
            >
              <img 
                src={selectedImage} 
                alt="Preview" 
                className="w-full h-full object-cover rounded-xl border-2 border-primary shadow-lg"
                referrerPolicy="no-referrer"
              />
              <button 
                onClick={() => setSelectedImage(null)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative flex items-center gap-2">
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-12 h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 rounded-2xl flex items-center justify-center hover:text-primary hover:border-primary transition-all shadow-sm shrink-0"
            title="Şəkil əlavə et"
          >
            <ImageIcon size={20} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Sualınızı bura yazın..."
            className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-3.5 text-sm outline-none focus:border-primary transition-colors shadow-sm"
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !selectedImage) || isLoading}
            className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/20 shrink-0"
          >
            <Send size={20} />
          </button>
        </div>
        <p className="text-[10px] text-center mt-3 text-slate-400 font-medium uppercase tracking-widest">
          RF AI bəzən səhv məlumat verə bilər. Vacib qərarlar üçün həmişə sxemləri yoxlayın.
        </p>
      </div>
    </div>
  );
};

export default RFAI;
