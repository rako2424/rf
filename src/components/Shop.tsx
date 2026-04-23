import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc,
  serverTimestamp,
  query,
  where,
  updateDoc
} from 'firebase/firestore';
import { db, auth, storage } from '../firebase';
import { ShoppingBag, ExternalLink, Plus, Trash2, Tag, DollarSign, Image as ImageIcon, Smartphone, Wrench, Headphones, PenTool, X, Monitor, Download, Edit2, Search, Loader2 } from 'lucide-react';
import { Product, PurchaseRequest } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import AdBanner from './AdBanner';
import { uploadImage, resizeImageForStorage } from '../utils/storage';

const resizeImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
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
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

const CATEGORIES = [
  { id: 'all', label: 'Bütün Məhsullar', icon: ShoppingBag },
  { id: 'Aksesuarlar', label: 'Aksesuarlar', icon: Headphones },
  { id: 'Telefonlar', label: 'Telefonlar', icon: Smartphone },
  { id: 'Ehtiyat hissələri', label: 'Ehtiyat hissələri', icon: Wrench },
  { id: 'Təmir Alətləri', label: 'Təmir Alətləri', icon: PenTool },
  { id: 'Proqramlar', label: 'Proqramlar', icon: Monitor },
];

export default function Shop({ isAdmin }: { isAdmin: boolean }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [userPurchaseRequests, setUserPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [newCategory, setNewCategory] = useState('Aksesuarlar');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDownloadUrl, setNewDownloadUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [orderProduct, setOrderProduct] = useState<Product | null>(null);
  const [copied, setCopied] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(productsData);
      setInitialLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
      setInitialLoading(false);
    });

    let unsubscribePurchases = () => {};
    
    // We need to wait for auth to be ready to get current user
    const unsubscribeAuth = auth.onAuthStateChanged(user => {
      if (user) {
        const q = query(collection(db, 'purchaseRequests'), where('userId', '==', user.uid));
        unsubscribePurchases = onSnapshot(q, (snapshot) => {
          const requests = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as PurchaseRequest[];
          setUserPurchaseRequests(requests);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'purchaseRequests');
        });
      } else {
        setUserPurchaseRequests([]);
      }
    });

    return () => {
      unsubscribeProducts();
      unsubscribePurchases();
      unsubscribeAuth();
    };
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPrice || !newDesc || !imageFile) return;
    if (newCategory === 'Proqramlar' && !newDownloadUrl) return;

    setLoading(true);
    try {
      const resizedBlob = await resizeImageForStorage(imageFile, 800, 800);
      const fileName = `products/${Date.now()}_${imageFile.name}`;
      const imageUrl = await uploadImage(resizedBlob, fileName);

      const productData: any = {
        name: newName,
        price: parseFloat(newPrice),
        description: newDesc,
        imageUrl: imageUrl,
        category: newCategory
      };

      if (newCategory === 'Proqramlar') {
        productData.isDigital = true;
        productData.downloadUrl = newDownloadUrl;
      }

      await addDoc(collection(db, 'products'), productData);

      // Add notification
      await addDoc(collection(db, 'notifications'), {
        userId: 'all',
        title: 'Yeni Məhsul',
        body: `Mağazaya yeni məhsul əlavə edildi: ${newName}`,
        link: '/shop',
        createdAt: serverTimestamp(),
        read: false
      });

      setNewName('');
      setNewPrice('');
      setNewDesc('');
      setNewDownloadUrl('');
      setImageFile(null);
      setImagePreview(null);
      setShowAddForm(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'products');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (product: Product) => {
    setProductToEdit(product);
    setNewName(product.name);
    setNewPrice(product.price.toString());
    setNewDesc(product.description);
    setNewCategory(product.category);
    setNewDownloadUrl(product.downloadUrl || '');
    setImagePreview(product.imageUrl);
    setImageFile(null);
  };

  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productToEdit || !newName || !newPrice || !newDesc) return;
    if (newCategory === 'Proqramlar' && !newDownloadUrl) return;

    setLoading(true);
    try {
      const productData: any = {
        name: newName,
        price: parseFloat(newPrice),
        description: newDesc,
        category: newCategory
      };

      if (imageFile) {
        const resizedBlob = await resizeImageForStorage(imageFile, 800, 800);
        const fileName = `products/${Date.now()}_${imageFile.name}`;
        productData.imageUrl = await uploadImage(resizedBlob, fileName);
      }

      if (newCategory === 'Proqramlar') {
        productData.isDigital = true;
        productData.downloadUrl = newDownloadUrl;
      } else {
        productData.isDigital = false;
        productData.downloadUrl = null;
      }

      await updateDoc(doc(db, 'products', productToEdit.id), productData);

      setProductToEdit(null);
      setNewName('');
      setNewPrice('');
      setNewDesc('');
      setNewDownloadUrl('');
      setImageFile(null);
      setImagePreview(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${productToEdit.id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    setItemToDelete(id);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'products', itemToDelete));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${itemToDelete}`);
    } finally {
      setItemToDelete(null);
    }
  };

  const handleDigitalPurchase = async () => {
    if (!orderProduct) return;
    setPurchaseLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('İstifadəçi daxil olmayıb');

      await addDoc(collection(db, 'purchaseRequests'), {
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName || 'İstifadəçi',
        productId: orderProduct.id,
        productName: orderProduct.name,
        price: orderProduct.price,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // Add notification for admin
      await addDoc(collection(db, 'notifications'), {
        userId: 'admin', // Assuming admin checks global or specific notifications
        title: 'Yeni Sifariş (Proqram)',
        body: `${user.displayName || 'İstifadəçi'} tərəfindən "${orderProduct.name}" üçün ödəniş təsdiqi gözlənilir.`,
        link: '/admin',
        createdAt: serverTimestamp(),
        read: false
      });

      setPurchaseSuccess(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'purchaseRequests');
    } finally {
      setPurchaseLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (searchTerm) {
      return matchesSearch;
    }
    
    if (activeCategory === 'all') {
      return true;
    }
    
    return p.category === activeCategory;
  });

  const approvedReq = selectedProduct?.isDigital ? userPurchaseRequests.find(req => req.productId === selectedProduct.id && req.status === 'approved' && !req.downloaded) : null;
  const downloadedReq = selectedProduct?.isDigital ? userPurchaseRequests.find(req => req.productId === selectedProduct.id && req.status === 'approved' && req.downloaded) : null;
  const pendingReq = selectedProduct?.isDigital ? userPurchaseRequests.find(req => req.productId === selectedProduct.id && req.status === 'pending') : null;

  return (
    <div className="p-4 space-y-6 pb-32">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-slate-900 dark:text-white">
          <ShoppingBag className="text-primary" size={20} />
          Mağaza
        </h2>
        {isAdmin && (
          <button 
            onClick={() => setShowAddForm(true)}
            className="bg-primary text-white p-3 rounded-2xl shadow-lg shadow-cyan-500/20 active:scale-90 transition-transform"
          >
            <Plus size={24} />
          </button>
        )}
      </header>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
        <input 
          type="text"
          placeholder="Məhsul axtar..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-slate-900 dark:text-white outline-none focus:border-primary transition-colors shadow-lg"
        />
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm whitespace-nowrap transition-all ${
                isActive 
                  ? 'bg-primary text-white shadow-lg shadow-cyan-500/20' 
                  : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
              }`}
            >
              <Icon size={18} />
              {cat.label}
            </button>
          );
        })}
      </div>

      <AdBanner placement="shop" />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {initialLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={`shop-skeleton-${i}`} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col animate-pulse">
              <div className="w-full aspect-[4/3] bg-slate-100 dark:bg-slate-700"></div>
              <div className="p-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="h-4 w-3/4 bg-slate-100 dark:bg-slate-700 rounded-full mb-2"></div>
                  <div className="h-3 w-full bg-slate-100 dark:bg-slate-700 rounded-full mb-1"></div>
                </div>
                <div className="flex justify-between items-center mt-3">
                  <div className="h-5 w-16 bg-slate-100 dark:bg-slate-700 rounded-full"></div>
                  <div className="h-6 w-20 bg-slate-100 dark:bg-slate-700 rounded-full"></div>
                </div>
              </div>
            </div>
          ))
        ) : filteredProducts.length > 0 ? (
          filteredProducts.map((product) => (
            <div 
              key={product.id} 
              onClick={() => setSelectedProduct(product)}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col cursor-pointer hover:border-primary/50 transition-colors group animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              <div className="w-full aspect-[4/3] relative overflow-hidden bg-slate-50 dark:bg-slate-900">
                <img 
                  src={product.imageUrl} 
                  alt={product.name} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                {isAdmin && (
                  <div className="absolute top-2 right-2 flex gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleEditClick(product); }} 
                      className="p-2 bg-blue-500/80 text-white rounded-full hover:bg-blue-500 transition-colors backdrop-blur-sm"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }} 
                      className="p-2 bg-red-500/80 text-white rounded-full hover:bg-red-500 transition-colors backdrop-blur-sm"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
              <div className="p-3 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white line-clamp-1">{product.name}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">{product.description}</p>
                </div>
                <div className="flex justify-between items-center mt-3">
                  <span className="text-primary font-bold text-base">{product.price} AZN</span>
                  {(() => {
                    const pApprovedReq = product.isDigital ? userPurchaseRequests.find(req => req.productId === product.id && req.status === 'approved' && !req.downloaded) : null;
                    const pDownloadedReq = product.isDigital ? userPurchaseRequests.find(req => req.productId === product.id && req.status === 'approved' && req.downloaded) : null;
                    const pPendingReq = product.isDigital ? userPurchaseRequests.find(req => req.productId === product.id && req.status === 'pending') : null;

                    if (pApprovedReq) {
                      return (
                        <a 
                          href={product.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await updateDoc(doc(db, 'purchaseRequests', pApprovedReq.id), { downloaded: true });
                            } catch (error) {
                              handleFirestoreError(error, OperationType.UPDATE, `purchaseRequests/${pApprovedReq.id}`);
                            }
                          }}
                          className="text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full hover:bg-emerald-500 hover:text-white transition-colors flex items-center gap-1"
                        >
                          <Download size={10} />
                          Yüklə
                        </a>
                      );
                    }
                    if (pPendingReq) {
                      return (
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 px-2.5 py-1 rounded-full">
                          Gözləyir
                        </span>
                      );
                    }
                    if (pDownloadedReq) {
                      return (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setOrderProduct(product); }}
                          className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full hover:bg-primary hover:text-white transition-colors"
                        >
                          Sifariş et
                        </button>
                      );
                    }
                    return (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setOrderProduct(product); }}
                        className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full hover:bg-primary hover:text-white transition-colors"
                      >
                        Sifariş et
                      </button>
                    );
                  })()}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-12 text-slate-500 dark:text-slate-400">
            <p className="text-sm">Bu kateqoriyada hələ ki, məhsul əlavə edilməyib.</p>
          </div>
        )}
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-6 text-slate-900 dark:text-white">Yeni Məhsul</h3>
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Məhsul adı"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                  required
                />
              </div>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white appearance-none"
                  required
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="number"
                  placeholder="Qiymət (AZN)"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                  required
                />
              </div>
              {newCategory === 'Proqramlar' && (
                <div className="relative">
                  <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="url"
                    placeholder="Yükləmə linki (Google Drive, Mega və s.)"
                    value={newDownloadUrl}
                    onChange={(e) => setNewDownloadUrl(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                    required
                  />
                </div>
              )}
              <div>
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase ml-1 tracking-widest">Şəkil</label>
                <div className="mt-1 flex items-center gap-4">
                  <label className="flex-1 flex flex-col items-center justify-center py-6 px-4 bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <ImageIcon className="text-slate-500 mb-2" size={24} />
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Şəkil seçin</span>
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" required />
                  </label>
                  {imagePreview && (
                    <div className="w-24 h-24 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>
              <textarea
                placeholder="Təsvir..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none min-h-[100px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
              ></textarea>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600"
                >
                  Ləğv et
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-cyan-500/20"
                >
                  {loading ? 'Əlavə edilir...' : 'Əlavə et'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Product Modal */}
      {productToEdit && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-6 text-slate-900 dark:text-white">Məhsulu Redaktə Et</h3>
            <form onSubmit={handleEditProduct} className="space-y-4">
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Məhsul adı"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                  required
                />
              </div>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white appearance-none"
                  required
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="number"
                  placeholder="Qiymət (AZN)"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                  required
                />
              </div>
              {newCategory === 'Proqramlar' && (
                <div className="relative">
                  <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="url"
                    placeholder="Yükləmə linki (Google Drive, Mega və s.)"
                    value={newDownloadUrl}
                    onChange={(e) => setNewDownloadUrl(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                    required
                  />
                </div>
              )}
              <div>
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase ml-1 tracking-widest">Şəkil (Dəyişmək istəmirsinizsə boş saxlayın)</label>
                <div className="mt-1 flex items-center gap-4">
                  <label className="flex-1 flex flex-col items-center justify-center py-6 px-4 bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <ImageIcon className="text-slate-500 mb-2" size={24} />
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Yeni Şəkil seçin</span>
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                  {imagePreview && (
                    <div className="w-24 h-24 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>
              <textarea
                placeholder="Təsvir..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none min-h-[100px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
              ></textarea>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setProductToEdit(null);
                    setNewName('');
                    setNewPrice('');
                    setNewDesc('');
                    setNewDownloadUrl('');
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                  className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600"
                >
                  Ləğv et
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-cyan-500/20"
                >
                  {loading ? 'Yadda saxlanılır...' : 'Yadda saxla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl max-w-sm w-full border border-slate-200 dark:border-slate-700 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Silmək istədiyinizə əminsiniz?</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">Bu əməliyyatı geri qaytarmaq mümkün deyil.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Ləğv et
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Modal */}
      {orderProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 text-center">
            <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Sifariş et</h3>
            {orderProduct.isDigital ? (
              purchaseSuccess ? (
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShoppingBag size={32} />
                  </div>
                  <p className="text-emerald-400 font-bold">Sorğunuz göndərildi!</p>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">
                    Ödəniş təsdiqləndikdən sonra proqramı yükləyə biləcəksiniz.
                  </p>
                  <button 
                    onClick={() => {
                      setPurchaseSuccess(false);
                      setOrderProduct(null);
                      setSelectedProduct(null);
                    }}
                    className="w-full py-4 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors mt-4"
                  >
                    Bağla
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                    "{orderProduct.name}" proqramını yükləmək üçün aşağıdakı karta ödəniş edin və təsdiqləyin.
                  </p>
                  <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                    <p className="text-xs text-slate-500 mb-2">Ödəniş üçün kart nömrəsi:</p>
                    <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-lg">
                      <span className="text-slate-900 dark:text-white font-mono font-bold text-lg tracking-wider">5239 1517 1324 5515</span>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText('5239151713245515');
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors ${
                          copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-primary/20 text-primary hover:bg-primary/30'
                        }`}
                      >
                        {copied ? 'Kopyalandı!' : 'Kopyala'}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 dark:text-slate-400 text-sm">Ödəniləcək məbləğ:</span>
                    <span className="text-2xl font-black text-primary">{orderProduct.price} AZN</span>
                  </div>
                  <button 
                    onClick={handleDigitalPurchase}
                    disabled={purchaseLoading}
                    className="w-full py-4 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/50 hover:bg-emerald-600 transition-colors disabled:opacity-50"
                  >
                    {purchaseLoading ? 'Göndərilir...' : 'Ödəniş etdim'}
                  </button>
                  <button 
                    onClick={() => {
                      setOrderProduct(null);
                      setSelectedProduct(null);
                    }}
                    className="w-full py-3 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors font-bold"
                  >
                    Ləğv et
                  </button>
                </div>
              )
            ) : (
              <>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                  "{orderProduct.name}" məhsulunu sifariş etmək üçün WhatsApp vasitəsilə bizə yazın.
                </p>
                <div className="space-y-4">
                  <a 
                    href={`https://api.whatsapp.com/send?phone=994772282424&text=${encodeURIComponent(`Salam, mən mağazanızdan "${orderProduct.name}" məhsulunu sifariş etmək istəyirəm. Qiyməti: ${orderProduct.price} AZN.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-4 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/50 hover:bg-emerald-600 transition-colors"
                  >
                    WhatsApp-a Keçid
                  </a>
                  <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                    <p className="text-xs text-slate-500 mb-2">Və ya nömrəni kopyalayın:</p>
                    <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-lg">
                      <span className="text-slate-900 dark:text-white font-mono font-bold">+994 77 228 24 24</span>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText('+994772282424');
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors ${
                          copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-primary/20 text-primary hover:bg-primary/30'
                        }`}
                      >
                        {copied ? 'Kopyalandı!' : 'Kopyala'}
                      </button>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setOrderProduct(null);
                      setSelectedProduct(null);
                    }}
                    className="w-full py-3 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors font-bold"
                  >
                    Ləğv et
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && !orderProduct && !itemToDelete && !productToEdit && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4" onClick={() => setSelectedProduct(null)}>
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row max-h-[90vh]"
          >
            <div className="w-full md:w-1/2 aspect-square md:aspect-auto bg-slate-50 dark:bg-slate-900 relative shrink-0">
              <img 
                src={selectedProduct.imageUrl} 
                alt={selectedProduct.name} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <button 
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 left-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors backdrop-blur-sm md:hidden"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 md:p-8 w-full md:w-1/2 flex flex-col overflow-y-auto">
              <div className="flex justify-between items-start mb-4 hidden md:flex">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white pr-4">{selectedProduct.name}</h3>
                <button 
                  onClick={() => setSelectedProduct(null)}
                  className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0 -mr-2 -mt-2"
                >
                  <X size={24} />
                </button>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 md:hidden">{selectedProduct.name}</h3>
              
              <div className="inline-block bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider w-max mb-4">
                {selectedProduct.category}
              </div>
              
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6 flex-1 whitespace-pre-wrap">
                {selectedProduct.description}
              </p>
              
              <div className="mt-auto pt-6 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Qiymət</span>
                  <span className="text-3xl font-black text-slate-900 dark:text-white">{selectedProduct.price} <span className="text-primary text-xl">AZN</span></span>
                </div>
                {approvedReq ? (
                  <a 
                    href={selectedProduct.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={async () => {
                      try {
                        await updateDoc(doc(db, 'purchaseRequests', approvedReq.id), { downloaded: true });
                      } catch (error) {
                        handleFirestoreError(error, OperationType.UPDATE, `purchaseRequests/${approvedReq.id}`);
                      }
                    }}
                    className="w-full py-4 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2"
                  >
                    <Download size={20} />
                    Yüklə
                  </a>
                ) : pendingReq ? (
                  <button 
                    disabled
                    className="w-full py-4 bg-amber-500/50 text-white rounded-xl font-bold shadow-lg shadow-amber-500/10 cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <ShoppingBag size={20} />
                    Təsdiq gözlənilir
                  </button>
                ) : downloadedReq ? (
                  <button 
                    onClick={() => setOrderProduct(selectedProduct)}
                    className="w-full py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-cyan-500/20 hover:bg-cyan-400 transition-colors flex items-center justify-center gap-2"
                  >
                    <ShoppingBag size={20} />
                    Sifariş et
                  </button>
                ) : (
                  <button 
                    onClick={() => setOrderProduct(selectedProduct)}
                    className="w-full py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-cyan-500/20 hover:bg-cyan-400 transition-colors flex items-center justify-center gap-2"
                  >
                    <ShoppingBag size={20} />
                    Sifariş et
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
