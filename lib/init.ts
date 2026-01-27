import { query } from './db';

export async function initDB() {
    const sql = `
    CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(50) PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW(),
      active BOOLEAN DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS photos (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(50) REFERENCES sessions(id),
      filename VARCHAR(255),
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW(),
      taken_at TIMESTAMP
    );

    INSERT INTO sessions (id) VALUES ('main') ON CONFLICT (id) DO NOTHING;
  `;

    try {
        await query(sql);
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Failed to initialize database:', error);
    }
}
