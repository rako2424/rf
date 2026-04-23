import axios from 'axios';

// Mocking Firebase-like API
export const dbLocal = {
  collection: (name: string) => {
    return {
      name,
      async get() {
        const res = await axios.get(`/api/db/${name}`);
        return {
          docs: res.data.map((doc: any) => ({
            id: doc.id,
            data: () => doc,
            exists: () => true
          }))
        };
      },
      add: async (data: any) => {
        const res = await axios.post(`/api/db/${name}`, data);
        return { id: res.data.id };
      }
    };
  }
};

// Firestore-like helpers
export const collection = (db: any, name: string) => {
  return { name, path: name };
};

export const query = (col: any, ...constraints: any[]) => {
  return col; // Simple mock, filtering can be added later
};

export const where = (field: string, op: string, value: any) => {
  return { field, op, value };
};

export const orderBy = (field: string, dir: string = 'asc') => {
  return { field, dir };
};

export const onSnapshot = (q: any, callback: (snapshot: any) => void) => {
  let active = true;
  const poll = async () => {
    if (!active) return;
    try {
      const res = await axios.get(`/api/db/${q.name || q.path}`);
      callback({
        docs: res.data.map((doc: any) => ({
          id: doc.id,
          data: () => doc,
          exists: () => true
        })),
        forEach: (cb: any) => res.data.forEach((d: any) => cb({ id: d.id, data: () => d }))
      });
    } catch (e) {
      console.error("Snapshot error:", e);
    }
    setTimeout(poll, 3000); // Poll every 3 seconds
  };
  poll();
  return () => { active = false; };
};

export const addDoc = async (col: any, data: any) => {
  const res = await axios.post(`/api/db/${col.name || col.path}`, data);
  return { id: res.data.id };
};

export const updateDoc = async (docRef: any, data: any) => {
   // Simplified: use POST/id to update
   await axios.post(`/api/db/${docRef.colName}`, { ...data, id: docRef.id });
};

export const deleteDoc = async (docRef: any) => {
   // To be implemented on server
   console.log("Delete not implemented yet");
};

export const doc = (db: any, colName: string, id?: string) => {
  if (!id) return { colName };
  return { colName, id };
};

export const getDoc = async (docRef: any) => {
   const res = await axios.get(`/api/db/${docRef.colName}`);
   const found = res.data.find((d: any) => d.id === docRef.id);
   return {
     exists: () => !!found,
     data: () => found,
     id: docRef.id
   };
};
