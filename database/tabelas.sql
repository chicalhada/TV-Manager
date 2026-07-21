-- ============================================================
-- TV Manager – Esquema da Base de Dados (agendamentos só por datas)
-- ============================================================

-- Tabela de utilizadores (administradores)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'admin'
);

-- Tabela de televisões (child_sites)
CREATE TABLE IF NOT EXISTS child_sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    ip TEXT,
    codigo TEXT UNIQUE NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Tabela de ficheiros multimédia (imagens, vídeos)
CREATE TABLE IF NOT EXISTS media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    url TEXT NOT NULL,
    mime_type TEXT,
    user_id INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Tabela de playlists
CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Tabela de itens das playlists (com suporte a datas múltiplas)
CREATE TABLE IF NOT EXISTS playlist_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL,
    media_id INTEGER NOT NULL,
    duration_seconds INTEGER DEFAULT 10,
    display_order INTEGER DEFAULT 0,
    start_time TEXT,          -- formato HH:MM (opcional)
    end_time TEXT,            -- formato HH:MM (opcional)
    selected_dates TEXT,      -- lista de datas separadas por vírgula: "2026-07-13,2026-07-14"
    FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE,
    FOREIGN KEY (media_id) REFERENCES media (id)
);

-- Tabela de atribuições de playlists a televisões (atribuição manual)
CREATE TABLE IF NOT EXISTS tv_playlist_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_site_id INTEGER NOT NULL,
    playlist_id INTEGER NOT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (child_site_id) REFERENCES child_sites (id),
    FOREIGN KEY (playlist_id) REFERENCES playlists (id)
);

-- Tabela de agendamentos (playlists programadas por datas específicas)
CREATE TABLE IF NOT EXISTS schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_site_id INTEGER NOT NULL,
    playlist_id INTEGER NOT NULL,
    selected_dates TEXT NOT NULL,  -- lista de datas específicas, obrigatória
    start_time TEXT NOT NULL,      -- formato HH:MM
    end_time TEXT,                 -- formato HH:MM (opcional)
    active INTEGER DEFAULT 1,
    FOREIGN KEY (child_site_id) REFERENCES child_sites (id),
    FOREIGN KEY (playlist_id) REFERENCES playlists (id)
);

-- Índices para melhor desempenho
CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON playlist_items (playlist_id);
CREATE INDEX IF NOT EXISTS idx_schedule_child_site ON schedule (child_site_id);
CREATE INDEX IF NOT EXISTS idx_child_sites_codigo ON child_sites (codigo);