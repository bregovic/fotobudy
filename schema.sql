CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(50) PRIMARY KEY, -- Session code
  created_at TIMESTAMP DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS photos (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(50) REFERENCES sessions(id),
  filename VARCHAR(255), -- NULL until captured
  status VARCHAR(20) DEFAULT 'pending', -- pending, capturing, done, error
  created_at TIMESTAMP DEFAULT NOW(),
  taken_at TIMESTAMP
);
