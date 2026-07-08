import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../chat.db');

let db = null;

// Initialize and connect to SQLite database
export async function getDbConnection() {
  if (db) return db;

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Create tables if they do not exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL, -- 'user' or 'model'
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
  `);

  return db;
}

// Get all conversations ordered by creation date desc
export async function getConversations() {
  const database = await getDbConnection();
  return await database.all('SELECT * FROM conversations ORDER BY created_at DESC');
}

// Get all messages for a specific conversation
export async function getConversationMessages(conversationId) {
  const database = await getDbConnection();
  return await database.all(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC',
    [conversationId]
  );
}

// Create a new conversation
export async function createConversation(id, title) {
  const database = await getDbConnection();
  await database.run(
    'INSERT OR IGNORE INTO conversations (id, title) VALUES (?, ?)',
    [id, title]
  );
}

// Save a new message
export async function saveMessage(conversationId, role, content) {
  const database = await getDbConnection();
  await database.run(
    'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)',
    [conversationId, role, content]
  );
}

export async function deleteConversation(conversationId) {
  const database = await getDbConnection();
  await database.run('DELETE FROM conversations WHERE id = ?', [conversationId]);
}

export async function deleteMessagesAfter(conversationId, afterMessageId) {
  const database = await getDbConnection();
  await database.run(
    'DELETE FROM messages WHERE conversation_id = ? AND id > ?',
    [conversationId, afterMessageId]
  );
}