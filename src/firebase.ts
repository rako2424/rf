
import { socket } from './services/socket';
import axios from 'axios';

// Mock Firebase Config
const firebaseConfig = {};

// Mock App
const app = {
  name: '[DEFAULT]',
  options: {},
  automaticDataCollectionEnabled: false
};

// --- AUTH MOCK ---
class MockAuth {
  currentUser: any = null;
  private authStateListeners: ((user: any) => void)[] = [];

  constructor() {
    // Try to load user from local storage
    const savedUser = localStorage.getItem('rf_user');
    const token = localStorage.getItem('rf_token');
    if (savedUser && token) {
      this.currentUser = JSON.parse(savedUser);
      // Ensure uid exists for compatibility
      if (this.currentUser) {
        if (!this.currentUser.uid) this.currentUser.uid = this.currentUser.id;
        if (!this.currentUser.providerData) this.currentUser.providerData = [];
        this.currentUser.emailVerified = true;
      }
    }
  }

  onAuthStateChanged(callback: (user: any) => void) {
    this.authStateListeners.push(callback);
    if (this.currentUser) this.currentUser.emailVerified = true;
    setTimeout(() => callback(this.currentUser), 0);
    return () => {
      this.authStateListeners = this.authStateListeners.filter(l => l !== callback);
    };
  }

  async signInWithEmailAndPassword(email: string, pass: string) {
    try {
      const res = await axios.post('/api/auth/login', { email, password: pass });
      const user = res.data.user;
      if (user && !user.uid) user.uid = user.id;
      if (user && !user.providerData) user.providerData = [];
      user.emailVerified = true;
      this.currentUser = user;
      localStorage.setItem('rf_token', res.data.token);
      localStorage.setItem('rf_user', JSON.stringify(this.currentUser));
      this.authStateListeners.forEach(l => l(this.currentUser));
      return { user: this.currentUser };
    } catch (err: any) {
      const error: any = new Error(err.response?.data?.message || 'Login failed');
      error.code = err.response?.data?.code || 'auth/invalid-credential';
      throw error;
    }
  }

  async createUserWithEmailAndPassword(email: string, pass: string) {
    try {
      const res = await axios.post('/api/auth/register', { email, password: pass });
      const user = res.data.user;
      if (user && !user.uid) user.uid = user.id;
      if (user && !user.providerData) user.providerData = [];
      user.emailVerified = true;
      this.currentUser = user;
      localStorage.setItem('rf_token', res.data.token);
      localStorage.setItem('rf_user', JSON.stringify(this.currentUser));
      this.authStateListeners.forEach(l => l(this.currentUser));
      return { user: this.currentUser };
    } catch (err: any) {
      const error: any = new Error(err.response?.data?.message || 'Registration failed');
      error.code = err.response?.data?.code || 'auth/email-already-in-use';
      throw error;
    }
  }

  async signOut() {
    this.currentUser = null;
    localStorage.removeItem('rf_token');
    localStorage.removeItem('rf_user');
    this.authStateListeners.forEach(l => l(null));
  }

  async updateProfile(data: { displayName?: string, photoURL?: string }) {
    if (!this.currentUser) throw new Error('No user logged in');
    const token = localStorage.getItem('rf_token');
    await axios.patch(`/api/firestore/users/${this.currentUser.uid}`, data, {
      headers: { Authorization: `Bearer ${token}` }
    });
    this.currentUser = { ...this.currentUser, ...data };
    localStorage.setItem('rf_user', JSON.stringify(this.currentUser));
    this.authStateListeners.forEach(l => l(this.currentUser));
  }
}

export const auth = new MockAuth() as any;

export const onAuthStateChanged = (authObj: any, callback: any) => authObj.onAuthStateChanged(callback);
export const signInWithEmailAndPassword = (authObj: any, email: string, pass: string) => authObj.signInWithEmailAndPassword(email, pass);
export const createUserWithEmailAndPassword = (authObj: any, email: string, pass: string) => authObj.createUserWithEmailAndPassword(email, pass);
export const signOut = (authObj: any) => authObj.signOut();
export const updateProfile = (user: any, data: any) => auth.updateProfile(data);
export const sendEmailVerification = async () => { console.log('Email verification sent (mock)'); };
export const sendPasswordResetEmail = async () => { console.log('Password reset sent (mock)'); };

// --- FIRESTORE MOCK ---
export const db = {
  type: 'firestore',
  app
} as any;

// Date wrapper helper
const wrapDates = (data: any) => {
  if (!data) return data;
  if (typeof data !== 'object') return data;
  
  const wrapped = Array.isArray(data) ? [...data] : { ...data };
  
  Object.keys(wrapped).forEach(key => {
    const val = (wrapped as any)[key];
    
    // If it looks like a date string
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
      const date = new Date(val);
      if (!isNaN(date.getTime())) {
        (wrapped as any)[key] = {
          toDate: () => date,
          toMillis: () => date.getTime(),
          toString: () => val,
          _isMockDate: true
        };
        return;
      }
    }
    
    // If it's already a mock date, skip
    if (val && typeof val === 'object' && val._isMockDate) {
      return;
    }

    // Recurse for nested objects/arrays
    if (val && typeof val === 'object') {
      (wrapped as any)[key] = wrapDates(val);
    }
  });
  return wrapped;
};

export const doc = (db: any, collection: string, id: string) => ({ type: 'doc', collection, id });
export const collection = (db: any, path: string) => ({ type: 'collection', path });
export const query = (col: any, ...constraints: any[]) => ({ ...col, constraints });
export const where = (field: string, op: string, value: any) => ({ type: 'where', field, op, value });
export const limit = (n: number) => ({ type: 'limit', value: n });
export const or = (...constraints: any[]) => ({ type: 'or', constraints });
export const and = (...constraints: any[]) => ({ type: 'and', constraints });
export const serverTimestamp = () => new Date().toISOString();
export const addDoc = async (colRef: any, data: any) => {
  const id = Math.random().toString(36).substr(2, 12);
  const token = localStorage.getItem('rf_token');
  await axios.post(`/api/firestore/${colRef.path}/${id}`, { data }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return { id };
};
export const deleteDoc = async (docRef: any) => {
  const token = localStorage.getItem('rf_token');
  await axios.delete(`/api/firestore/${docRef.collection}/${docRef.id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
};
export const getDocs = async (queryRef: any) => {
  const token = localStorage.getItem('rf_token');
  const res = await axios.post(`/api/firestore/query`, queryRef, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return {
    docs: res.data.map((d: any) => ({
      id: d.id,
      data: () => wrapDates(d),
      exists: () => true
    })),
    size: res.data.length
  };
};
export const orderBy = (field: string, direction: 'asc' | 'desc' = 'asc') => ({ type: 'orderBy', field, direction });
export const arrayUnion = (...elements: any[]) => ({ type: 'arrayUnion', elements });
export const arrayRemove = (...elements: any[]) => ({ type: 'arrayRemove', elements });

export const getDoc = async (docRef: any) => {
  const token = localStorage.getItem('rf_token');
  const res = await axios.get(`/api/firestore/${docRef.collection}/${docRef.id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = res.data ? wrapDates(res.data) : null;
  return {
    exists: () => !!data,
    data: () => data,
    id: docRef.id
  };
};

export const setDoc = async (docRef: any, data: any, options: any = {}) => {
  const token = localStorage.getItem('rf_token');
  await axios.post(`/api/firestore/${docRef.collection}/${docRef.id}`, { data, options }, {
    headers: { Authorization: `Bearer ${token}` }
  });
};

export const updateDoc = async (docRef: any, data: any) => {
  const token = localStorage.getItem('rf_token');
  await axios.patch(`/api/firestore/${docRef.collection}/${docRef.id}`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
};

export const onSnapshot = (queryRef: any, callback: (snapshot: any) => void, errorCallback?: (err: any) => void) => {
  const path = queryRef.path || queryRef.collection;
  const id = queryRef.id;

  const handleUpdate = () => {
    if (id) {
      getDoc(queryRef).then(callback).catch(errorCallback);
    } else {
      const token = localStorage.getItem('rf_token');
      axios.post(`/api/firestore/query`, queryRef, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => {
        callback({
          docs: res.data.map((d: any) => ({
            id: d.id,
            data: () => wrapDates(d),
            exists: () => true
          })),
          size: res.data.length,
          docChanges: () => [] 
        });
      }).catch(errorCallback);
    }
  };

  socket.on(`update:${path}`, handleUpdate);
  if (id) socket.on(`update:${path}:${id}`, handleUpdate);

  handleUpdate();

  return () => {
    socket.off(`update:${path}`, handleUpdate);
    if (id) socket.off(`update:${path}:${id}`, handleUpdate);
  };
};

export const getDocFromCache = getDoc;
export const getDocFromServer = getDoc;

export const initializeApp = () => app;
export const initializeFirestore = () => db;
export const getStorage = () => ({});
export const storage = getStorage();

// Storage mocks
export const ref = (storage: any, path: string) => ({ path });
export const uploadBytes = async (storageRef: any, file: any) => {
  // convert file to base64 if it's a blob/file
  const reader = new FileReader();
  const base64: string = await new Promise((resolve) => {
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
  
  const res = await axios.post('/api/upload', {
    file: base64,
    fileName: storageRef.path
  });
  
  (storageRef as any).downloadURL = res.data.url;
  return { ref: storageRef };
};
export const getDownloadURL = async (storageRef: any) => {
  return (storageRef as any).downloadURL || 'https://via.placeholder.com/150';
};

export default app;
