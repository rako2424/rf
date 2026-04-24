
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import sqlite3 from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  app.use(express.json({ limit: '10mb' }));

  // Ensure uploads directory exists
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // File Upload Route
  app.post('/api/upload', (req, res) => {
    const { file, fileName } = req.body; // base64
    if (!file || !fileName) return res.status(400).send('Missing file or fileName');
    
    // Remove metadata from base64 if present
    const base64Data = file.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    
    // sanitize filename
    const safeName = fileName.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
    const filePath = join(uploadsDir, safeName);
    
    // Ensure parent dir exists
    const dir = dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFile(filePath, buffer, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Save failed');
      }
      res.json({ url: `/uploads/${safeName}` });
    });
  });

  // Database setup
  const db = sqlite3('database.db');
  db.pragma('journal_mode = WAL');

  // Initialize schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user'
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT NOT NULL,
      collectionName TEXT NOT NULL,
      data TEXT NOT NULL,
      PRIMARY KEY(id, collectionName)
    );
  `);

  const JWT_SECRET = process.env.JWT_SECRET || 'rf-servis-default-secret-2026';

  // Middleware for auth
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // Auth Routes
  app.post('/api/auth/register', (req, res) => {
    const { email, password, displayName, userType } = req.body;
    const id = Math.random().toString(36).substr(2, 9);
    const hashedPassword = bcrypt.hashSync(password, 10);
    const role = email.toLowerCase() === 'rauf2289@gmail.com' ? 'admin' : 'user';

    try {
      db.prepare('INSERT INTO users (id, email, password, role) VALUES (?, ?, ?, ?)').run(id, email, hashedPassword, role);
      
      const userData = { 
        uid: id, 
        id, 
        email, 
        displayName: displayName || email.split('@')[0], 
        userType: userType || 'user', 
        role, 
        createdAt: new Date().toISOString(), 
        status: 'active', 
        emailVerified: true 
      };
      db.prepare('INSERT INTO documents (id, collectionName, data) VALUES (?, ?, ?)').run(id, 'users', JSON.stringify(userData));
      
      const token = jwt.sign({ id, email, role }, JWT_SECRET);
      res.json({ token, user: userData });
    } catch (err: any) {
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ code: 'auth/email-already-in-use', message: 'Bu e-poçt artıq istifadə olunur.' });
      }
      console.error(err);
      res.status(400).json({ code: 'auth/internal-error', message: 'Qeydiyyat zamanı xəta baş verdi' });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    try {
      const user: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

      if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(400).json({ code: 'auth/invalid-credential', message: 'E-poçt və ya şifrə yanlışdır.' });
      }

      const doc: any = db.prepare('SELECT data FROM documents WHERE id = ? AND collectionName = ?').get(user.id, 'users');
      const userData = doc ? JSON.parse(doc.data) : { id: user.id, uid: user.id, email: user.email, role: user.role };
      
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);
      res.json({ token, user: userData });
    } catch (err) {
      res.status(500).json({ code: 'auth/internal-error', message: 'Giriş zamanı xəta baş verdi' });
    }
  });

  // Generic Firestore-like API
  app.get('/api/firestore/:collection/:id', (req, res) => {
    const row: any = db.prepare('SELECT data FROM documents WHERE id = ? AND collectionName = ?').get(req.params.id, req.params.collection);
    res.json(row ? JSON.parse(row.data) : null);
  });

  app.post('/api/firestore/:collection/:id', authenticateToken, (req, res) => {
    const { data } = req.body;
    const json = JSON.stringify({ ...data, id: req.params.id });
    db.prepare('INSERT OR REPLACE INTO documents (id, collectionName, data) VALUES (?, ?, ?)').run(req.params.id, req.params.collection, json);
    io.emit(`update:${req.params.collection}`, { id: req.params.id, data });
    io.emit(`update:${req.params.collection}:${req.params.id}`, data);
    res.sendStatus(200);
  });

  app.patch('/api/firestore/:collection/:id', authenticateToken, (req, res) => {
    const row: any = db.prepare('SELECT data FROM documents WHERE id = ? AND collectionName = ?').get(req.params.id, req.params.collection);
    const existing = row ? JSON.parse(row.data) : {};
    
    // Handle special field updates like arrayUnion/arrayRemove
    const data = { ...req.body };
    Object.keys(data).forEach(key => {
      const val = data[key];
      if (val && typeof val === 'object' && val.type === 'arrayUnion') {
        const currentArr = Array.isArray(existing[key]) ? existing[key] : [];
        const toAdd = val.elements.filter((el: any) => !currentArr.includes(el));
        data[key] = [...currentArr, ...toAdd];
      } else if (val && typeof val === 'object' && val.type === 'arrayRemove') {
        const currentArr = Array.isArray(existing[key]) ? existing[key] : [];
        data[key] = currentArr.filter((el: any) => !val.elements.includes(el));
      }
    });

    const updated = { ...existing, ...data };
    db.prepare('INSERT OR REPLACE INTO documents (id, collectionName, data) VALUES (?, ?, ?)').run(req.params.id, req.params.collection, JSON.stringify(updated));
    io.emit(`update:${req.params.collection}`, { id: req.params.id, data: updated });
    io.emit(`update:${req.params.collection}:${req.params.id}`, updated);
    res.sendStatus(200);
  });

  app.delete('/api/firestore/:collection/:id', authenticateToken, (req, res) => {
    db.prepare('DELETE FROM documents WHERE id = ? AND collectionName = ?').run(req.params.id, req.params.collection);
    io.emit(`update:${req.params.collection}`, { id: req.params.id, deleted: true });
    io.emit(`update:${req.params.collection}:${req.params.id}`, null);
    res.sendStatus(200);
  });

  app.post('/api/firestore/query', (req, res) => {
    const { path, constraints } = req.body;
    const rows = db.prepare('SELECT data FROM documents WHERE collectionName = ?').all(path);
    let results = rows.map((r: any) => JSON.parse(r.data));

    // Basic filtering implementation for 'where'
    if (constraints) {
      constraints.forEach((c: any) => {
        if (c.type === 'where') {
          results = results.filter(item => {
            const val = item[c.field];
            if (c.op === '==') return val === c.value;
            if (c.op === 'array-contains') return Array.isArray(val) && val.includes(c.value);
            if (c.op === 'in') return Array.isArray(c.value) && c.value.includes(val);
            return true;
          });
        }
        if (c.type === 'limit') {
          results = results.slice(0, c.value);
        }
      });
    }

    res.json(results);
  });

  // Test connection route
  app.get('/api/firestore/test/connection', (req, res) => {
    res.json({ status: 'connected' });
  });

  // Socket
  io.on('connection', (socket) => {
    socket.on('join_room', (id) => socket.join(id));
  });

  // Vite
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => res.sendFile(join(distPath, 'index.html')));
    }
  }

  httpServer.listen(3000, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:3000`);
  });
}

startServer();
