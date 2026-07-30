import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const getDatabase = async () => {
  if (!db) {
    db = await SQLite.openDatabaseAsync('personalmaps.db');
  }
  return db;
};

export const initDatabase = async () => {
  const database = await getDatabase();

  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS Markers (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      category TEXT,
      photo TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      icon TEXT,
      color TEXT
    );

    CREATE TABLE IF NOT EXISTS Journey (
      id TEXT PRIMARY KEY,
      startTime INTEGER NOT NULL,
      endTime INTEGER,
      distance REAL NOT NULL,
      duration INTEGER NOT NULL,
      avgSpeed REAL NOT NULL,
      maxSpeed REAL NOT NULL,
      polyline TEXT
    );

    CREATE TABLE IF NOT EXISTS JourneyPoints (
      id TEXT PRIMARY KEY,
      journeyId TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      timestamp INTEGER NOT NULL,
      speed REAL NOT NULL,
      FOREIGN KEY (journeyId) REFERENCES Journey (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Favorites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS History (
      id TEXT PRIMARY KEY,
      journeyId TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (journeyId) REFERENCES Journey (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Settings (
      id TEXT PRIMARY KEY,
      darkMode INTEGER DEFAULT 0,
      mapType TEXT DEFAULT 'normal',
      gpsAccuracy TEXT DEFAULT 'high',
      trackingInterval INTEGER DEFAULT 5000,
      unit TEXT DEFAULT 'km'
    );

    CREATE TABLE IF NOT EXISTS SearchHistory (
      id TEXT PRIMARY KEY,
      query TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      createdAt INTEGER NOT NULL
    );
  `);
};
