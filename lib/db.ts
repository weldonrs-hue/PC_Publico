import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'progcir.db');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS dados_pessoais (
    id_usuario INTEGER PRIMARY KEY,
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
    telefonePessoal TEXT,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
  );

  CREATE TABLE IF NOT EXISTS congregacoes (
    id TEXT PRIMARY KEY,
    id_usuario INTEGER NOT NULL,
    nome TEXT NOT NULL,
    cidade TEXT NOT NULL,
    estado TEXT NOT NULL,
    grupos TEXT, -- JSON string
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
  );

  CREATE TABLE IF NOT EXISTS substitutos (
    id TEXT PRIMARY KEY,
    id_usuario INTEGER NOT NULL,
    nome TEXT NOT NULL,
    congregacao_id TEXT NOT NULL,
    congregacao_nome TEXT NOT NULL,
    cidade TEXT NOT NULL,
    estado TEXT NOT NULL,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
    FOREIGN KEY (congregacao_id) REFERENCES congregacoes(id)
  );
`);

// Migration: Ensure all columns exist in dados_pessoais
const columns = [
  'nomeEsposa', 'endereco', 'cidade', 'cep', 'uf', 
  'emailJwpub', 'telefoneCircuito', 'emailPessoal', 'telefonePessoal'
];

const tableInfo = db.prepare("PRAGMA table_info(dados_pessoais)").all() as any[];
const existingColumns = tableInfo.map(col => col.name);

columns.forEach(col => {
  if (!existingColumns.includes(col)) {
    try {
      db.exec(`ALTER TABLE dados_pessoais ADD COLUMN ${col} TEXT`);
    } catch (e) {
      console.error(`Error adding column ${col}:`, e);
    }
  }
});

export default db;
