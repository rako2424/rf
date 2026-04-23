import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, auth, storage } from '../firebase';
import { Folder, File, Plus, Trash2, ArrowLeft, Link as LinkIcon, ChevronRight, Image as ImageIcon, Upload, Loader2, Eye, Download, FolderPlus, FilePlus, Edit2, Save, X as XIcon, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { uploadImage, resizeImageForStorage } from '../utils/storage';

// Helper to resize and convert image to Base64 (Same as Shop.tsx)
const resizeImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200; // Good balance for schematics
        const MAX_HEIGHT = 1200;
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

interface DriveFile {
  id: string;
  name: string;
  type: 'folder' | 'file' | 'image';
  url?: string;
  imageUrl?: string; // Added for file icons/covers
  parentId: string | null;
  kitType: string;
  createdAt: any;
  createdBy: string;
  storagePath?: string;
  description?: string;
}

export default function FileManager({ isAdmin }: { isAdmin: boolean }) {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{id: string, name: string}[]>([]);
  
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [showAddFile, setShowAddFile] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemUrl, setNewItemUrl] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [itemToEdit, setItemToEdit] = useState<DriveFile | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    url: '',
    description: ''
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedImage, setSelectedImage] = useState<DriveFile | null>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showAddImage, setShowAddImage] = useState(false);
  const [imageDescription, setImageDescription] = useState('');
  const [selectedUploadFiles, setSelectedUploadFiles] = useState<File[]>([]);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);

  const kitName = type === 'repair-kit' ? 'Təmir Kit' : type === 'isp-kit' ? 'ISP / Test Point' : 'Proqram Kit';

  useEffect(() => {
    if (!type) return;

    const q = type === 'isp-kit' 
      ? query(
          collection(db, 'driveFiles'),
          where('kitType', '==', type)
        )
      : query(
          collection(db, 'driveFiles'),
          where('kitType', '==', type),
          where('parentId', '==', currentFolderId)
        );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedFiles = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DriveFile[];
      
      // Sort: folders first, then files, alphabetically
      fetchedFiles.sort((a, b) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name);
        }
        return a.type === 'folder' ? -1 : 1;
      });
      
      setFiles(fetchedFiles);
    });

    return () => unsubscribe();
  }, [type, currentFolderId]);

  const handleAddFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !auth.currentUser) return;

    try {
      await addDoc(collection(db, 'driveFiles'), {
        name: newItemName.trim(),
        type: 'folder',
        parentId: currentFolderId,
        kitType: type,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid
      });
      setNewItemName('');
      setShowAddFolder(false);
      setErrorMsg(null);
    } catch (error) {
      console.error("Error adding folder:", error);
      setErrorMsg("Qovluq yaradılarkən xəta baş verdi.");
    }
  };

  const handleAddFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    if (type !== 'isp-kit' && !newItemName.trim()) return;

    setUploading(true);
    setUploadProgress(0);
    setErrorMsg(null);

    try {
      if (selectedUploadFiles.length > 0) {
        for (let i = 0; i < selectedUploadFiles.length; i++) {
          const file = selectedUploadFiles[i];
          setCurrentUploadIndex(i + 1);
          setUploadProgress(Math.round((i / selectedUploadFiles.length) * 100));

          const resizedBlob = await resizeImageForStorage(file, 1200, 1200);
          const fileName = `drive/${type}/${Date.now()}_${file.name}`;
          const finalImageUrl = await uploadImage(resizedBlob, fileName);

          await addDoc(collection(db, 'driveFiles'), {
            name: (selectedUploadFiles.length === 1 && newItemName.trim()) ? newItemName.trim() : file.name,
            type: newItemUrl.trim() ? 'file' : 'image',
            url: newItemUrl.trim() || finalImageUrl,
            imageUrl: newItemUrl.trim() ? finalImageUrl : '',
            parentId: currentFolderId,
            kitType: type,
            description: imageDescription.trim(),
            createdAt: serverTimestamp(),
            createdBy: auth.currentUser.uid,
            storagePath: fileName
          });
        }
      } else {
        if (!newItemName.trim()) return;
        await addDoc(collection(db, 'driveFiles'), {
          name: newItemName.trim(),
          type: 'file',
          url: newItemUrl.trim(),
          imageUrl: '',
          parentId: currentFolderId,
          kitType: type,
          description: imageDescription.trim(),
          createdAt: serverTimestamp(),
          createdBy: auth.currentUser.uid
        });
      }

      setUploadProgress(100);
      setNewItemName('');
      setNewItemUrl('');
      setImageDescription('');
      setSelectedUploadFiles([]);
      setShowAddFile(false);
      setErrorMsg(null);
    } catch (error: any) {
      console.error("Error adding file:", error);
      setErrorMsg(`Xəta baş verdi: ${error.message || "Naməlum"}`);
    } finally {
      setUploading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !auth.currentUser) return;

    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      if (files[i].type.startsWith('image/')) {
        validFiles.push(files[i]);
      }
    }

    if (validFiles.length === 0) {
      setErrorMsg("Yalnız şəkil faylları yüklənə bilər.");
      return;
    }

    setSelectedUploadFiles(prev => [...prev, ...validFiles]);
    if (!showAddFile) {
      setShowAddImage(true);
    }
  };

  const handleFinishImageUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUploadFiles.length === 0 || !auth.currentUser) return;

    setUploading(true);
    setUploadProgress(0);
    setCurrentUploadIndex(0);
    setErrorMsg(null);
    
    try {
      for (let i = 0; i < selectedUploadFiles.length; i++) {
        const file = selectedUploadFiles[i];
        setCurrentUploadIndex(i + 1);
        
        // Step 1: Resize
        const resizedBlob = await resizeImageForStorage(file, 1200, 1200);
        const fileName = `drive/${type}/${Date.now()}_${file.name}`;
        
        // Step 2: Upload to Storage
        const imageUrl = await uploadImage(resizedBlob, fileName);
        
        // Step 3: Save to Firestore
        await addDoc(collection(db, 'driveFiles'), {
          name: file.name,
          type: 'image',
          url: imageUrl,
          parentId: currentFolderId,
          kitType: type,
          description: imageDescription.trim(),
          createdAt: serverTimestamp(),
          createdBy: auth.currentUser.uid,
          storagePath: fileName
        });

        // Update progress
        setUploadProgress(Math.round(((i + 1) / selectedUploadFiles.length) * 100));
      }

      console.log("Success! All images saved to Storage.");
      setShowAddImage(false);
      setSelectedUploadFiles([]);
      setImageDescription('');
    } catch (error: any) {
      console.error("Critical upload error:", error);
      setErrorMsg(`Şəkillər yüklənərkən xəta baş verdi: ${error.message || "Naməlum"}`);
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      // No need to delete from Storage anymore
      await deleteDoc(doc(db, 'driveFiles', itemToDelete));
      setItemToDelete(null);
      setErrorMsg(null);
    } catch (error) {
      console.error("Error deleting item:", error);
      setErrorMsg("Silinərkən xəta baş verdi.");
      setItemToDelete(null);
    }
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItemToDelete(id);
  };

  const handleEditClick = (file: DriveFile, e: React.MouseEvent) => {
    e.stopPropagation();
    setItemToEdit(file);
    setEditForm({
      name: file.name,
      url: file.url || '',
      description: file.description || ''
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemToEdit || !editForm.name.trim()) return;

    try {
      const docRef = doc(db, 'driveFiles', itemToEdit.id);
      const updates: any = {
        name: editForm.name.trim(),
        description: editForm.description.trim()
      };
      
      if (itemToEdit.type === 'file') {
        updates.url = editForm.url.trim();
      }

      await updateDoc(docRef, updates);
      setItemToEdit(null);
      setErrorMsg(null);
    } catch (error) {
      console.error("Error updating item:", error);
      setErrorMsg("Yenilənərkən xəta baş verdi.");
    }
  };

  const navigateToFolder = (folder: DriveFile) => {
    setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
    setCurrentFolderId(folder.id);
  };

  const navigateUp = () => {
    if (folderPath.length === 0) return;
    const newPath = [...folderPath];
    newPath.pop();
    setFolderPath(newPath);
    setCurrentFolderId(newPath.length > 0 ? newPath[newPath.length - 1].id : null);
  };

  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      setFolderPath([]);
      setCurrentFolderId(null);
    } else {
      const newPath = folderPath.slice(0, index + 1);
      setFolderPath(newPath);
      setCurrentFolderId(newPath[newPath.length - 1].id);
    }
  };

  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (file.description && file.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-6 max-w-6xl mx-auto pb-24">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white">
              <Folder className="text-primary" size={20} />
              {kitName}
            </h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-0.5">Fayllar və Qovluqlar</p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => { setShowAddFile(!showAddFile); setShowAddFolder(false); }}
              className="bg-emerald-500 text-white p-3 rounded-2xl shadow-lg shadow-emerald-500/20 active:scale-90 transition-transform"
              title="Fayl Əlavə Et"
            >
              <FilePlus size={24} />
            </button>
            {type !== 'isp-kit' && (
              <button 
                onClick={() => { setShowAddFolder(!showAddFolder); setShowAddFile(false); }}
                className="bg-primary text-white p-3 rounded-2xl shadow-lg shadow-cyan-500/20 active:scale-90 transition-transform"
                title="Qovluq Yarat"
              >
                <FolderPlus size={24} />
              </button>
            )}
          </div>
        )}
      </header>

      {/* Breadcrumbs */}
      {type !== 'isp-kit' && (
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 text-sm font-medium">
          <button 
            onClick={() => navigateToBreadcrumb(-1)}
            className={`flex items-center gap-1 ${currentFolderId === null ? 'text-primary' : 'text-slate-400 hover:text-white'}`}
          >
            <Folder size={16} />
            Əsas
          </button>
          {folderPath.map((crumb, index) => (
            <React.Fragment key={crumb.id}>
              <ChevronRight size={14} className="text-slate-600 shrink-0" />
              <button 
                onClick={() => navigateToBreadcrumb(index)}
                className={`truncate max-w-[150px] ${index === folderPath.length - 1 ? 'text-primary' : 'text-slate-400 hover:text-white'}`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Fayllarda axtar..."
            className="w-full bg-slate-800 text-white pl-12 pr-4 py-3 rounded-2xl border border-slate-700 focus:outline-none focus:border-primary shadow-lg"
          />
          <ZoomIn className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm">
          {errorMsg}
          <button onClick={() => setErrorMsg(null)} className="ml-4 underline hover:text-white">Bağla</button>
        </div>
      )}



      {/* Add Forms */}
      <AnimatePresence>
        {showAddFolder && (
          <motion.form 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAddFolder}
            className="bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-6 overflow-hidden"
          >
            <h3 className="text-white font-bold mb-3">Yeni Qovluq</h3>
            <div className="flex gap-3">
              <input 
                type="text" 
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                placeholder="Qovluq adı..."
                className="flex-1 bg-slate-900 text-white px-4 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-primary"
                autoFocus
              />
              <button type="submit" className="px-6 py-2 bg-primary text-black font-bold rounded-xl hover:bg-primary/90">
                Yarat
              </button>
              <button type="button" onClick={() => setShowAddFolder(false)} className="px-4 py-2 bg-slate-700 text-white rounded-xl hover:bg-slate-600">
                Ləğv et
              </button>
            </div>
          </motion.form>
        )}

        {showAddFile && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-slate-800 p-6 rounded-[2rem] border border-slate-700 mb-6 overflow-hidden shadow-2xl"
          >
            <form onSubmit={handleAddFile} className="space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/20 text-primary rounded-xl">
                  <Plus size={20} />
                </div>
                <h3 className="text-white font-bold uppercase tracking-widest text-sm">Yeni Fayl / Proqram Əlavə Et</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`space-y-4 ${type === 'isp-kit' ? 'hidden' : ''}`}>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 ml-1">Faylın Adı</label>
                    <input 
                      type="text" 
                      value={newItemName}
                      onChange={e => setNewItemName(e.target.value)}
                      placeholder="Məs: Samsung A50 Firmware..."
                      className="w-full bg-slate-900 text-white px-4 py-3 rounded-2xl border border-slate-700 focus:outline-none focus:border-primary text-sm"
                      required={type !== 'isp-kit'}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 ml-1">Yükləmə Linki (Könüllü)</label>
                    <input 
                      type="url" 
                      value={newItemUrl}
                      onChange={e => setNewItemUrl(e.target.value)}
                      placeholder="Google Drive, Mega və s. linki..."
                      className="w-full bg-slate-900 text-white px-4 py-3 rounded-2xl border border-slate-700 focus:outline-none focus:border-primary text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 ml-1">Təsvir / Qeyd</label>
                    <textarea 
                      value={imageDescription}
                      onChange={e => setImageDescription(e.target.value)}
                      placeholder="Fayl haqqında qısa məlumat..."
                      className="w-full bg-slate-900 text-white px-4 py-3 rounded-2xl border border-slate-700 focus:outline-none focus:border-primary text-sm min-h-[100px] resize-none"
                    />
                  </div>
                </div>

                <div className={`space-y-4 ${type === 'isp-kit' ? 'md:col-span-2' : ''}`}>
                  <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 ml-1">Şəkillər / İkonlar Yüklə (Çoxlu Seçim)</label>
                  <div className="relative group">
                    <input 
                      type="file" 
                      className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                      accept="image/*" 
                      onChange={handleImageUpload} 
                      disabled={uploading} 
                      multiple
                    />
                    <div className={`border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center gap-4 transition-all ${
                      selectedUploadFiles.length > 0 ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-700 bg-slate-900/50 group-hover:border-primary/50'
                    }`}>
                      {selectedUploadFiles.length > 0 ? (
                        <div className="text-center">
                          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-2">
                            <ImageIcon size={32} />
                          </div>
                          <p className="text-emerald-400 font-bold text-sm truncate max-w-[200px]">{selectedUploadFiles.length} fayl seçildi</p>
                          <button 
                            type="button" 
                            onClick={(e) => { e.preventDefault(); setSelectedUploadFiles([]); }}
                            className="text-xs text-red-400 hover:text-red-300 mt-2 underline"
                          >
                            Təmizlə
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="w-16 h-16 bg-slate-800 text-slate-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Upload size={32} />
                          </div>
                          <div className="text-center">
                            <p className="text-white font-bold text-sm">Şəkilləri Seçin</p>
                            <p className="text-slate-500 text-[10px] mt-1 uppercase tracking-widest">PNG, JPG (Çoxlu seçim mümkündür)</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-700">
                <button 
                  type="submit" 
                  disabled={uploading}
                  className="flex-1 py-4 bg-primary text-black font-bold rounded-2xl hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      <span>Yüklənir {currentUploadIndex > 0 ? `${currentUploadIndex}/${selectedUploadFiles.length}` : ''} {uploadProgress}%</span>
                    </>
                  ) : (
                    <>
                      <Plus size={20} />
                      <span>{selectedUploadFiles.length > 1 ? `${selectedUploadFiles.length} Faylı Əlavə Et` : 'Faylı Əlavə Et'}</span>
                    </>
                  )}
                </button>
                <button 
                  type="button" 
                  onClick={() => { setShowAddFile(false); setSelectedUploadFiles([]); setNewItemName(''); setNewItemUrl(''); setImageDescription(''); }} 
                  className="px-8 py-4 bg-slate-700 text-white font-bold rounded-2xl hover:bg-slate-600 transition-colors"
                >
                  Ləğv et
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {showAddImage && selectedUploadFiles.length > 0 && (
          <motion.form 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleFinishImageUpload}
            className="bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-6 overflow-hidden space-y-3"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/20 text-primary rounded-lg">
                <ImageIcon size={20} />
              </div>
              <h3 className="text-white font-bold">Şəkillərin Təsviri</h3>
            </div>
            <div className="max-h-32 overflow-y-auto bg-slate-900/50 rounded-xl p-2 mb-2">
              <p className="text-slate-400 text-[10px] uppercase tracking-widest font-bold mb-2 px-1">Seçilmiş fayllar ({selectedUploadFiles.length}):</p>
              <div className="flex flex-wrap gap-2">
                {selectedUploadFiles.map((f, i) => (
                  <div key={i} className="bg-slate-800 px-2 py-1 rounded text-[10px] text-slate-300 border border-slate-700 flex items-center gap-2">
                    <span className="truncate max-w-[100px]">{f.name}</span>
                    <button 
                      type="button" 
                      onClick={() => setSelectedUploadFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-red-400 hover:text-red-300"
                    >
                      <XIcon size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <textarea 
              value={imageDescription}
              onChange={e => setImageDescription(e.target.value)}
              placeholder="Bütün şəkillər üçün ümumi məlumat yazın (məs: Samsung A10 Sxemləri)..."
              className="w-full bg-slate-900 text-white px-4 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-primary min-h-[80px] resize-none"
              autoFocus
            />
            <div className="flex gap-3 pt-2">
              <button 
                type="submit" 
                disabled={uploading}
                className="flex-1 py-3 bg-primary text-black font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 flex flex-col items-center justify-center gap-1 min-h-[56px]"
              >
                {uploading ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Loader2 size={18} className="animate-spin" />
                      <span>Yüklənir {currentUploadIndex} / {selectedUploadFiles.length} ({uploadProgress}%)</span>
                    </div>
                    <div className="w-full max-w-[120px] h-1 bg-black/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-black transition-all duration-300" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <Upload size={18} />
                    <span>{selectedUploadFiles.length} Şəkli Yüklə</span>
                  </div>
                )}
              </button>
              <button 
                type="button" 
                onClick={() => { setShowAddImage(false); setSelectedUploadFiles([]); setImageDescription(''); }} 
                className="px-6 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600"
              >
                Ləğv et
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* File Grid */}
      <div className={type === 'isp-kit' ? "grid grid-cols-2 gap-3" : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"}>
        {currentFolderId && type !== 'isp-kit' && (
          <div 
            onClick={navigateUp}
            className="bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-800 transition-all group aspect-square"
          >
            <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <ArrowLeft size={20} className="text-slate-400" />
            </div>
            <span className="text-white font-bold text-[10px] uppercase tracking-widest">Geri</span>
          </div>
        )}

        {filteredFiles.map(file => (
          <div 
            key={file.id}
            onClick={() => {
              if (file.type === 'folder') {
                navigateToFolder(file);
              } else if (file.type === 'image') {
                setSelectedImage(file);
              } else if (file.url) {
                window.open(file.url, '_blank');
              }
            }}
            className={`transition-all group cursor-pointer relative ${
              type === 'isp-kit'
                ? 'bg-slate-800 p-2 rounded-2xl border border-slate-700 flex flex-col gap-2 hover:border-primary/50 shadow-lg'
                : file.type === 'folder' 
                  ? 'bg-slate-800 p-3 rounded-2xl flex flex-col items-center justify-center gap-2 active:scale-95 shadow-lg border-2 border-transparent hover:border-primary/50' 
                  : 'bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden flex flex-col hover:border-primary/50 shadow-lg'
            }`}
          >
            {type === 'isp-kit' ? (
              <>
                <div className="aspect-square w-full rounded-xl bg-slate-900 overflow-hidden shrink-0">
                  {file.url || file.imageUrl ? (
                    <img 
                      src={file.url || file.imageUrl} 
                      alt={file.name} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                      <ImageIcon size={24} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 px-1 pb-1">
                  <h4 className="text-white font-bold text-[11px] truncate" title={file.name}>{file.name}</h4>
                </div>
                {isAdmin && (
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => handleEditClick(file, e)}
                      className="p-1 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button 
                      onClick={(e) => handleDeleteClick(file.id, e)}
                      className="p-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </>
            ) : file.type === 'folder' ? (
              <>
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Folder size={20} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-white text-center truncate w-full">{file.name}</span>
                
                {isAdmin && (
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1">
                    <button 
                      onClick={(e) => handleEditClick(file, e)}
                      className="p-1 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors shadow-lg"
                    >
                      <Edit2 size={10} />
                    </button>
                    <button 
                      onClick={(e) => handleDeleteClick(file.id, e)}
                      className="p-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-lg"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Preview / Icon Area */}
                <div className="aspect-video relative bg-slate-900 flex items-center justify-center overflow-hidden">
                  {(file.imageUrl || (file.type === 'image' && file.url)) ? (
                    <img 
                      src={file.imageUrl || file.url} 
                      alt={file.name} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center transition-transform group-hover:scale-110">
                      <File size={24} />
                    </div>
                  )}
                  
                  {/* Overlay for Admin Actions */}
                  {isAdmin && (
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1">
                      <button 
                        onClick={(e) => handleEditClick(file, e)}
                        className="p-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors shadow-lg"
                        title="Redaktə et"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button 
                        onClick={(e) => handleDeleteClick(file.id, e)}
                        className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-lg"
                        title="Sil"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}

                  {/* Type Badge */}
                  <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-[8px] font-black text-white uppercase tracking-widest">
                    {file.type === 'image' ? 'Şəkil' : 'Fayl'}
                  </div>
                </div>

                {/* Info Area */}
                <div className="p-2.5 flex-1 flex flex-col">
                  <h4 className="text-white font-bold text-[11px] truncate mb-0.5" title={file.name}>{file.name}</h4>
                  {file.description && (
                    <p className="text-slate-500 text-[9px] line-clamp-1 italic" title={file.description}>{file.description}</p>
                  )}
                  
                  <div className="mt-auto pt-1.5 flex justify-between items-center">
                    <span className="text-[8px] text-slate-400 font-medium uppercase tracking-widest">
                      {file.type === 'image' ? 'Görüntülə' : 'Yüklə'}
                    </span>
                    <div className="p-1 bg-slate-700 rounded text-slate-300 group-hover:bg-primary group-hover:text-white transition-colors">
                      {file.type === 'image' ? <Eye size={10} /> : <Download size={10} />}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}

        {files.length === 0 && !currentFolderId && (
          <div className="col-span-full text-center py-12 text-slate-500">
            <Folder size={48} className="mx-auto mb-4 opacity-20" />
            <p>Heç bir fayl və ya qovluq yoxdur.</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-800 p-6 rounded-2xl border border-slate-700 max-w-sm w-full shadow-2xl"
          >
            <h3 className="text-xl font-bold text-white mb-2">Silmək istədiyinizə əminsiniz?</h3>
            <p className="text-slate-400 text-sm mb-6">
              Bu əməliyyat geri qaytarıla bilməz.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2.5 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600 transition-colors"
              >
                Ləğv et
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-2.5 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors"
              >
                Sil
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Modal */}
      <AnimatePresence>
        {itemToEdit && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-slate-800 w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl border border-slate-700 overflow-hidden relative"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Məhsulu Redaktə Et</h3>
                <button onClick={() => setItemToEdit(null)} className="p-2 text-slate-400 hover:text-white transition-colors">
                  <XIcon size={24} />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Ad</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl outline-none text-white text-xs placeholder-slate-600 focus:border-primary transition-colors"
                    required
                  />
                </div>

                {itemToEdit.type === 'file' && (
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Yükləmə Linki</label>
                    <input
                      type="url"
                      value={editForm.url}
                      onChange={(e) => setEditForm({...editForm, url: e.target.value})}
                      className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl outline-none text-white text-xs placeholder-slate-600 focus:border-primary transition-colors"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Təsvir / Qeyd</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                    className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl outline-none text-white text-xs placeholder-slate-600 focus:border-primary transition-colors min-h-[100px] resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-4 bg-primary text-black font-black rounded-2xl shadow-lg shadow-cyan-500/30 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  >
                    <Save size={18} />
                    YADDA SAXLA
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemToEdit(null)}
                    className="px-6 py-4 bg-slate-700 text-white font-bold rounded-2xl hover:bg-slate-600 transition-colors"
                  >
                    Ləğv et
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Protected Image Viewer */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center p-4 overflow-hidden"
          >
            {/* Background click to close */}
            <div className="absolute inset-0 cursor-zoom-out" onClick={() => { setSelectedImage(null); setScale(1); setRotation(0); }} />

            {/* Controls */}
            <div className="absolute top-6 right-6 flex items-center gap-3 z-[110]">
              <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md rounded-full p-1 border border-white/10">
                <button
                  onClick={(e) => { e.stopPropagation(); setScale(prev => Math.max(prev - 0.5, 1)); }}
                  disabled={scale <= 1}
                  className="p-2.5 hover:bg-white/10 text-white rounded-full transition-all active:scale-90 disabled:opacity-30 disabled:pointer-events-none"
                  title="Uzaqlaşdır"
                >
                  <ZoomOut size={20} />
                </button>
                <div className="w-px h-4 bg-white/10 mx-1" />
                <button
                  onClick={(e) => { e.stopPropagation(); setScale(prev => Math.min(prev + 0.5, 4)); }}
                  disabled={scale >= 4}
                  className="p-2.5 hover:bg-white/10 text-white rounded-full transition-all active:scale-90 disabled:opacity-30 disabled:pointer-events-none"
                  title="Yaxınlaşdır"
                >
                  <ZoomIn size={20} />
                </button>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); setRotation(prev => prev + 90); }}
                className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all active:scale-90 border border-white/10"
                title="Döndər"
              >
                <RotateCcw size={20} />
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); setScale(1); setRotation(0); }}
                className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all active:scale-90 border border-white/10"
                title="Sıfırla"
              >
                <span className="text-xs font-bold px-1">1:1</span>
              </button>

              <button 
                className="p-2.5 bg-rose-500/20 hover:bg-rose-500/40 text-rose-500 rounded-full backdrop-blur-md transition-all active:scale-90 border border-rose-500/20"
                onClick={() => { setSelectedImage(null); setScale(1); setRotation(0); }}
                title="Bağla"
              >
                <XIcon size={20} />
              </button>
            </div>

            <motion.div 
              drag={scale > 1}
              dragConstraints={{ left: -1000, right: 1000, top: -1000, bottom: 1000 }}
              dragElastic={0.1}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ 
                scale: scale, 
                rotate: rotation,
                opacity: 1 
              }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`relative max-w-5xl w-full max-h-[80vh] flex items-center justify-center select-none ${scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.preventDefault()}
            >
              {/* Transparent Overlay to prevent saving */}
              <div className="absolute inset-0 z-10" />
              
              <img 
                src={selectedImage.url}
                alt={selectedImage.name}
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl pointer-events-none"
                referrerPolicy="no-referrer"
                onDragStart={(e) => e.preventDefault()}
              />

              {/* Watermark */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 z-20 overflow-hidden">
                <div className="text-white text-6xl font-black uppercase tracking-[2rem] -rotate-45 whitespace-nowrap">
                  RF SERVİS • RF SERVİS • RF SERVİS
                </div>
              </div>
            </motion.div>

            {/* Image Info / Description */}
            <AnimatePresence>
              {scale === 1 && (
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  className="mt-6 text-center max-w-2xl z-[110]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-white font-bold text-xl mb-2">{selectedImage.name}</h3>
                  {selectedImage.description && (
                    <p className="text-slate-300 text-sm leading-relaxed bg-white/5 p-4 rounded-2xl border border-white/10">
                      {selectedImage.description}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-white/60 text-xs font-bold uppercase tracking-widest pointer-events-none z-[110]">
              Müəllif hüquqları qorunur • RF SERVİS
            </div>

            {/* Scale Indicator */}
            {scale > 1 && (
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 backdrop-blur-md rounded-full border border-white/10 text-white text-xs font-bold tracking-widest uppercase z-[110]">
                Zoom: {Math.round(scale * 100)}%
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
