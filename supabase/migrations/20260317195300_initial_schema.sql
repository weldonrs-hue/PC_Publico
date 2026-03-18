-- Create usuarios table
CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario SERIAL PRIMARY KEY,
  usuario TEXT UNIQUE NOT NULL,
  senha TEXT NOT NULL,
  data_cadastro TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create dados_pessoais table
CREATE TABLE IF NOT EXISTS dados_pessoais (
  id_usuario INTEGER PRIMARY KEY REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  nome TEXT,
  nomeEsposa TEXT,
  endereco TEXT,
  cidade TEXT,
  cep TEXT,
  uf TEXT,
  circuito TEXT,
  emailJwpub TEXT,
  telefoneCircuito TEXT,
  emailPessoal TEXT,
  telefonePessoal TEXT
);

-- Create congregacoes table
CREATE TABLE IF NOT EXISTS congregacoes (
  id TEXT PRIMARY KEY,
  id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cidade TEXT NOT NULL,
  estado TEXT NOT NULL,
  grupos JSONB -- PostgreSQL uses JSONB for JSON data
);

-- Create substitutos table
CREATE TABLE IF NOT EXISTS substitutos (
  id TEXT PRIMARY KEY,
  id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  congregacao_id TEXT NOT NULL REFERENCES congregacoes(id) ON DELETE CASCADE,
  congregacao_nome TEXT NOT NULL,
  cidade TEXT NOT NULL,
  estado TEXT NOT NULL
);

-- Create todos table for testing
CREATE TABLE IF NOT EXISTS todos (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security (RLS)
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE dados_pessoais ENABLE ROW LEVEL SECURITY;
ALTER TABLE congregacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE substitutos ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies should be created based on the application's auth logic.
-- For now, we'll assume the API routes handle the logic, but in a real Supabase setup,
-- you'd want policies like:
-- CREATE POLICY "Users can only see their own data" ON dados_pessoais FOR ALL USING (auth.uid()::text = id_usuario::text);
