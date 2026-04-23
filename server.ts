import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { exec } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("database.db");

// Initialize Database Schema based on blueprint
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      uid TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      displayName TEXT,
      photoURL TEXT,
      phoneNumber TEXT,
      role TEXT,
      userType TEXT,
      status TEXT,
      isOnline INTEGER,
      lastSeen TEXT,
      banned INTEGER,
      showLocation INTEGER,
      location TEXT,
      workplaceName TEXT,
      workplaceAddress TEXT,
      shopPhotoURL TEXT,
      equipmentPhotoURL TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      authorUid TEXT,
      authorName TEXT,
      title TEXT,
      content TEXT,
      createdAt TEXT,
      category TEXT,
      likes TEXT
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      postId TEXT,
      authorUid TEXT,
      authorName TEXT,
      content TEXT,
      createdAt TEXT,
      likes TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      price REAL,
      imageUrl TEXT,
      category TEXT,
      isDigital INTEGER,
      downloadUrl TEXT
    );

    CREATE TABLE IF NOT EXISTS frpRequests (
      id TEXT PRIMARY KEY,
      userId TEXT,
      userEmail TEXT,
      userName TEXT,
      phoneModel TEXT,
      androidVersion TEXT,
      imei TEXT,
      serialNumber TEXT,
      status TEXT,
      price REAL,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      userId TEXT,
      title TEXT,
      body TEXT,
      link TEXT,
      createdAt TEXT,
      read INTEGER
    );

    CREATE TABLE IF NOT EXISTS driveFiles (
      id TEXT PRIMARY KEY,
      name TEXT,
      type TEXT,
      url TEXT,
      parentId TEXT,
      kitType TEXT,
      description TEXT,
      createdAt TEXT,
      createdBy TEXT,
      storagePath TEXT
    );
    
    CREATE TABLE IF NOT EXISTS ads (
      id TEXT PRIMARY KEY,
      title TEXT,
      imageUrl TEXT,
      link TEXT,
      active INTEGER,
      createdAt TEXT
    );

    -- Seed Admin User
    INSERT OR IGNORE INTO users (uid, email, displayName, role, status, createdAt) 
    VALUES ('admin_1', 'rfservis2026@gmail.com', 'Admin RF', 'admin', 'active', datetime('now'));
    
    INSERT OR IGNORE INTO users (uid, email, displayName, role, status, createdAt) 
    VALUES ('admin_2', 'rauf2289@gmail.com', 'Rauf Admin', 'admin', 'active', datetime('now'));
  `);
}

initDb();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // GitHub Webhook for Auto-Deploy
  app.post("/api/deploy", (req, res) => {
    console.log("GitHub Webhook Signal Received!");
    exec("cd " + process.cwd() + " && sh ./update.sh", (error, stdout, stderr) => {
      if (error) {
        console.error(`Deploy Error: ${error.message}`);
        return res.status(500).json({ status: "error", message: error.message });
      }
      console.log(`Deploy Success: ${stdout}`);
      res.json({ status: "success", detail: "Deployment triggered successfully" });
    });
  });

  // Generic CRUD for collections to simulate Firestore
  app.get("/api/db/:collection", (req, res) => {
    const { collection } = req.params;
    try {
      const rows = db.prepare(`SELECT * FROM ${collection}`).all();
      // Parse JSON strings back to objects
      const parsed = rows.map(row => {
        const item = { ...row };
        if (item.location && typeof item.location === 'string') item.location = JSON.parse(item.location);
        if (item.likes && typeof item.likes === 'string') item.likes = JSON.parse(item.likes);
        return item;
      });
      res.json(parsed);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/db/:collection", (req, res) => {
    const { collection } = req.params;
    const data = req.body;
    const id = data.id || Math.random().toString(36).substring(2);
    data.id = id;

    // Handle partial updates vs full inserts
    const existing = db.prepare(`SELECT * FROM ${collection} WHERE id = ? OR (uid = ? AND '${collection}' = 'users')`).get(id, id) as any;
    
    let finalData = { ...data };
    if (existing) {
       finalData = { ...(existing as any), ...data };
       // Handle arrayUnion/arrayRemove logic from client
       Object.keys(data).forEach(key => {
         if (data[key] && data[key]._type === 'arrayUnion') {
            const currentArray = existing[key] ? (typeof existing[key] === 'string' ? JSON.parse(existing[key]) : existing[key]) : [];
            if (!currentArray.includes(data[key].item)) {
              currentArray.push(data[key].item);
            }
            finalData[key] = currentArray;
         } else if (data[key] && data[key]._type === 'arrayRemove') {
            const currentArray = existing[key] ? (typeof existing[key] === 'string' ? JSON.parse(existing[key]) : existing[key]) : [];
            finalData[key] = currentArray.filter((i: any) => i !== data[key].item);
         }
       });
    }

    // Stringify objects for SQLite
    const preparedData = { ...finalData };
    if (preparedData.location && typeof preparedData.location !== 'string') preparedData.location = JSON.stringify(preparedData.location);
    if (preparedData.likes && typeof preparedData.likes !== 'string') preparedData.likes = JSON.stringify(preparedData.likes);

    const keys = Object.keys(preparedData);
    const values = Object.values(preparedData);
    const placeholders = keys.map(() => "?").join(",");

    try {
      db.prepare(`INSERT OR REPLACE INTO ${collection} (${keys.join(",")}) VALUES (${placeholders})`).run(...values);
      res.json({ id, ...finalData });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Auth Simulation Routes
  app.post("/api/auth/login", (req, res) => {
    const { email } = req.body;
    let user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user) {
      // Auto-register for demo purposes, or return error
      return res.status(401).json({ error: "User not found" });
    }
    res.json(user);
  });

  // Vite development middleware
  const distPath = path.join(process.cwd(), "dist");
  const isProduction = process.env.NODE_ENV === "production" || fs.existsSync(distPath);

  if (isProduction) {
    console.log("Serving production build from:", distPath);
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    console.log("Starting Vite development server...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
