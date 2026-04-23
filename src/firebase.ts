import * as dbLocal from './db-local';

// Mock Auth
const mockAuth = {
  currentUser: JSON.parse(localStorage.getItem('rf_user') || 'null'),
  onAuthStateChanged: (callback: (user: any) => void) => {
    const user = JSON.parse(localStorage.getItem('rf_user') || 'null');
    callback(user);
    return () => {};
  },
  signOut: async () => {
    localStorage.removeItem('rf_user');
    window.location.reload();
  },
  signInWithEmailAndPassword: async (auth: any, email: string) => {
    // Basic mock: search for user in DB via API
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const user = await res.json();
      if (user.error) throw new Error(user.error);
      localStorage.setItem('rf_user', JSON.stringify(user));
      return { user };
    } catch (e) {
      throw e;
    }
  },
  createUserWithEmailAndPassword: async (auth: any, email: string) => {
    try {
      const res = await fetch('/api/db/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          uid: Math.random().toString(36).substring(2),
          email,
          role: 'user',
          status: 'pending',
          createdAt: new Date().toISOString()
        })
      });
      const user = await res.json();
      localStorage.setItem('rf_user', JSON.stringify(user));
      return { user };
    } catch (e) {
      throw e;
    }
  }
};

export const getAuth = () => mockAuth;
export const auth = mockAuth;
export const onAuthStateChanged = mockAuth.onAuthStateChanged;
export const signOut = mockAuth.signOut;
export const signInWithEmailAndPassword = mockAuth.signInWithEmailAndPassword;
export const createUserWithEmailAndPassword = mockAuth.createUserWithEmailAndPassword;
export const db = {}; 

// Mock Storage
export const getStorage = () => ({});
export const ref = (storage: any, path: string) => ({ path });
export const uploadBytes = async (ref: any, blob: any) => ({ ref });
export const getDownloadURL = async (ref: any) => "";
export const storage = {
  ref: () => ({
    put: async () => ({ ref: { getDownloadURL: async () => "" } }),
    getDownloadURL: async () => ""
  })
};

// Firestore-like functions
export const collection = (db: any, path: string) => dbLocal.dbLocal.collection(path);
export const query = (col: any, ...constraints: any[]) => col; 
export const where = dbLocal.where;
export const or = (...args: any[]) => ({ _type: 'or', args });
export const and = (...args: any[]) => ({ _type: 'and', args });
export const orderBy = dbLocal.orderBy;
export const onSnapshot = (q: any, callback: any) => dbLocal.onSnapshot(q, callback);
export const addDoc = dbLocal.addDoc;
export const updateDoc = dbLocal.updateDoc;
export const deleteDoc = dbLocal.deleteDoc;
export const doc = (db: any, path: string, id?: string) => dbLocal.doc(db, path, id);
export const getDoc = dbLocal.getDoc;
export const setDoc = async (docRef: any, data: any, options?: any) => {
  const finalData = options?.merge ? data : data;
  return dbLocal.addDoc({ name: docRef.colName, id: docRef.id }, finalData);
};
export const getDocFromCache = dbLocal.getDoc;
export const getDocFromServer = dbLocal.getDoc;
export const limit = (n: number) => n;
export const serverTimestamp = () => new Date().toISOString();
export const arrayUnion = (item: any) => ({ _type: 'arrayUnion', item });
export const arrayRemove = (item: any) => ({ _type: 'arrayRemove', item });
export const getDocs = async (q: any) => {
  const col = typeof q === 'string' ? dbLocal.dbLocal.collection(q) : q;
  return col.get();
};
export const sendEmailVerification = async () => console.log("Email verification skipped in mock");
export const sendPasswordResetEmail = async (auth: any, email: string) => {
  console.log("Password reset email skipped for: ", email);
};
export const updateProfile = async (user: any, data: any) => {
  const updatedUser = { ...user, ...data };
  localStorage.setItem('rf_user', JSON.stringify(updatedUser));
  return updatedUser;
};

export default { auth, db };
