import React, { useState } from 'react';
import { Wrench, ShieldAlert, WifiOff, SignalHigh, Cpu, ChevronRight, CheckCircle2, BatteryWarning, Smartphone, VolumeX, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

const guides = [
  {
    id: 'short-circuit',
    title: 'Qısa Qapanma (Short Circuit) Diaqnostikası',
    icon: Zap,
    problem: 'Telefon ümumiyyətlə açılmır, qidalanma bloku (DC Power Supply) yüksək cərəyan çəkir.',
    steps: [
      'Multimetr ilə VDD_MAIN (və ya VPH_PWR) xəttində qısa qapanma olub-olmadığını yoxlayın.',
      'Termal kamera və ya Rosin (kanifol) tüstüsü istifadə edərək qızan komponenti (kondensator, IC) tapın.',
      'Qısa qapanma olan kondensatoru çıxarın və xəttin normala döndüyünü yoxlayın.',
      'Əgər qısa qapanma PMIC (Qidalanma mikrosxemi) ətrafındadırsa, əvvəlcə ətrafdakı kondensatorları yoxlayın, dərhal PMIC-i sökməyin.',
      'Təmirdən sonra cihazın normal cərəyan çəkdiyini (Boot sequence) DC Power Supply-da izləyin.'
    ]
  },
  {
    id: 'audio-ic',
    title: 'Audio IC (Səs Mikrosxemi) Problemləri',
    icon: VolumeX,
    problem: 'Zəng zamanı səs getmir/gəlmir, səs yazarı (Voice Memos) işləmir, dinamik (Speaker) düyməsi sönükdür.',
    steps: [
      'Xüsusilə iPhone 7/7 Plus modellərində Audio IC altındakı C12, F12, H12, J12 yollarının qırılıb-qırılmadığını yoxlayın.',
      'Audio IC-ni (U3101) sökün və qırılmış yolları (Jumper) bərpa edin.',
      'Mikrosxemi yenidən lehimləyin (Reballing) və yerinə oturdun.',
      'Mikrofonların və dinamiklərin (Speaker/Receiver) fiziki olaraq təmiz və işlək olduğuna əmin olun.',
      'Təmirdən sonra Səs Yazarı (Voice Memos) tətbiqində test edin.'
    ]
  },
  {
    id: 'face-id',
    title: 'Face ID / TrueDepth Kamera Təmiri',
    icon: Smartphone,
    problem: 'Face ID qeydə alınmır, "Move iPhone a little lower/higher" xətası verir və ya Portrait rejim işləmir.',
    steps: [
      'Dot Projector (Nöqtə proyektoru) kabelinin qırılıb-qırılmadığını və ya maye təmasına məruz qalıb-qalmadığını yoxlayın.',
      'Xüsusi proqramator (JC, QianLi və s.) ilə Dot Projector məlumatlarını oxuyun və yeni flex kabelə yazın.',
      'Flood Illuminator və Ambient Light Sensor (Earpiece flex) üzərindəki komponentlərin zədələnmədiyinə əmin olun.',
      'Orijinal prizmanı (Prism) zədələmədən yeni flex kabelə lehimləyin.',
      'Təmirdən sonra 3uTools və ya oxşar proqramla hissələrin orijinal olaraq tanındığını yoxlayın.'
    ]
  },
  {
    id: 'battery-data',
    title: 'Batareya Dəyişimi və Sağlamlıq (Battery Health)',
    icon: BatteryWarning,
    problem: 'Batareya dəyişdirildikdən sonra ayarlarda "Important Battery Message" çıxır və sağlamlıq faizi (Health) görünmür.',
    steps: [
      'Orijinal batareyanın BMS (Battery Management System) platasını diqqətlə kəsib ayırın.',
      'BMS platanı yeni (hüceyrə) batareyaya spot qaynaq (Spot Welding) ilə birləşdirin.',
      'Batareya proqramatoru (JC V1S və s.) istifadə edərək batareyanın dövr sayını (Cycle Count) sıfırlayın və sağlamlığı 100% edin.',
      'Bəzi yeni modellərdə (iPhone 11 və yuxarı) əlavə Tag-on flex istifadə etmək tələb oluna bilər.',
      'Cihazı yandırıb ayarlardan batareya sağlamlığının normal göründüyünü təsdiqləyin.'
    ]
  },
  {
    id: 'no-service',
    title: 'Şəbəkə Yoxdur (No Service / Searching)',
    icon: WifiOff,
    problem: 'Telefon sim kartı oxuyur, lakin şəbəkə tapmır və ya daim "Searching" (Axtarılır) yazır.',
    steps: [
      'Ayarlardan "Haqqında" (About) bölməsinə daxil olub Modem Firmware (Baseband) versiyasının olub-olmadığını yoxlayın.',
      'Əgər Modem Firmware yoxdursa, Baseband CPU, Baseband PMIC və ya EEPROM-da problem var.',
      'Əgər Modem Firmware varsa, *#06# yığaraq IMEI nömrəsinin gəldiyini yoxlayın.',
      'IMEI varsa, lakin şəbəkə yoxdursa, RF Transceiver (WTR/SDR), Baseband qidalanması və ya Anten gücləndirici (PA) modulunu yoxlayın.',
      'Ana platanın (xüsusilə ikiqat platalı modellərdə - iPhone X və yuxarı) alt və üst qatları arasındakı lehimlərin qırılmadığına əmin olun.'
    ]
  }
];

export default function RepairGuide() {
  const [selectedGuide, setSelectedGuide] = useState<string | null>(null);

  return (
    <div className="p-4 space-y-6 pb-32 bg-white dark:bg-slate-900 min-h-screen transition-colors duration-300">
      <header className="bg-slate-50 dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-200 dark:shadow-slate-900/50">
        <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 mb-3 text-slate-900 dark:text-white">
          <Wrench className="text-primary" size={20} />
          RF Təmir asistanı
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-6">Mobil telefonların təmiri və proqram təminatı haqda qısa məlumatları burda görə biləcəksiz.</p>
      </header>

      <div className="space-y-4">
        {guides.map((guide) => (
          <div key={guide.id} className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-200 dark:shadow-slate-900/50 overflow-hidden">
            <button 
              onClick={() => setSelectedGuide(selectedGuide === guide.id ? null : guide.id)}
              className="w-full p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center text-primary">
                  <guide.icon size={24} />
                </div>
                <div className="text-left">
                  <h3 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-tight">{guide.title}</h3>
                  <p className="text-[9px] text-primary uppercase font-black tracking-widest mt-1">Diaqnostika</p>
                </div>
              </div>
              <ChevronRight 
                size={20} 
                className={`text-slate-400 dark:text-slate-500 transition-transform ${selectedGuide === guide.id ? 'rotate-90 text-primary' : ''}`} 
              />
            </button>

            {selectedGuide === guide.id && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700"
              >
                <div className="py-4">
                  <div className="bg-amber-500/10 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-500/20 dark:border-amber-900/50 flex gap-3 mb-4">
                    <ShieldAlert className="text-amber-600 dark:text-amber-500 shrink-0" size={20} />
                    <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                      <span className="font-bold">Problem:</span> {guide.problem}
                    </p>
                  </div>
                  
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 ml-1">Həll Addımları:</h4>
                  <ul className="space-y-3">
                    {guide.steps.map((step, index) => (
                      <li key={index} className="flex gap-3">
                        <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-primary shrink-0 mt-0.5">
                          <CheckCircle2 size={12} />
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700">
        <h4 className="font-bold mb-2">Daha çox kömək lazımdər?</h4>
        <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">Əgər problem həll olunmursa, forumda sual verə və ya bizimlə birbaşa əlaqə saxlaya bilərsiniz.</p>
        <button className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm active:scale-95 transition-transform shadow-lg shadow-cyan-500/20">
          Texniki Dəstək Al
        </button>
      </div>
    </div>
  );
}
