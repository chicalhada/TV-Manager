# db.py - Gerenciador do banco de dados SQLite (separado do Flask)
import sqlite3
import os
from datetime import datetime

DB_PATH = 'tvmanager.db'

def get_connection():
    """Retorna uma conexão com o banco de dados"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # permite acesso por nome de coluna
    return conn

def init_db():
    """Cria todas as tabelas se não existirem"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # child_sites (televisões)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS child_sites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            ip TEXT,
            codigo TEXT UNIQUE,  -- código permanente da TV
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # media (vídeos/fotos)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS media (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            url TEXT NOT NULL,
            mime_type TEXT,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # playlists
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # playlist_items
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS playlist_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            playlist_id INTEGER NOT NULL,
            media_id INTEGER NOT NULL,
            duration_seconds INTEGER DEFAULT 10,
            display_order INTEGER NOT NULL,
            FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
            FOREIGN KEY (media_id) REFERENCES media(id)
        )
    ''')
    
    # assignments
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            child_site_id INTEGER NOT NULL,
            playlist_id INTEGER NOT NULL,
            assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (child_site_id) REFERENCES child_sites(id),
            FOREIGN KEY (playlist_id) REFERENCES playlists(id)
        )
    ''')
    
    conn.commit()
    conn.close()
    print("✅ Banco de dados inicializado com sucesso!")

# ========== FUNÇÕES CRUD para child_sites (TVs) ==========
def add_child_site(name, ip=None, codigo=None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO child_sites (name, ip, codigo) VALUES (?, ?, ?)",
        (name, ip, codigo)
    )
    conn.commit()
    site_id = cursor.lastrowid
    conn.close()
    return site_id

def get_child_site_by_codigo(codigo):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM child_sites WHERE codigo = ?", (codigo,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def list_child_sites():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM child_sites ORDER BY id")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

# ========== FUNÇÕES CRUD para media ==========
def add_media(filename, url, mime_type):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO media (filename, url, mime_type) VALUES (?, ?, ?)",
        (filename, url, mime_type)
    )
    conn.commit()
    media_id = cursor.lastrowid
    conn.close()
    return media_id

def list_media():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM media ORDER BY uploaded_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_media(media_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM media WHERE id = ?", (media_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

# ========== FUNÇÕES CRUD para playlists ==========
def add_playlist(name):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO playlists (name) VALUES (?)", (name,))
    conn.commit()
    playlist_id = cursor.lastrowid
    conn.close()
    return playlist_id

def add_playlist_item(playlist_id, media_id, duration_seconds, display_order=None):
    conn = get_connection()
    cursor = conn.cursor()
    if display_order is None:
        cursor.execute("SELECT COALESCE(MAX(display_order), 0) + 1 FROM playlist_items WHERE playlist_id = ?", (playlist_id,))
        display_order = cursor.fetchone()[0]
    cursor.execute(
        "INSERT INTO playlist_items (playlist_id, media_id, duration_seconds, display_order) VALUES (?, ?, ?, ?)",
        (playlist_id, media_id, duration_seconds, display_order)
    )
    conn.commit()
    item_id = cursor.lastrowid
    conn.close()
    return item_id

def get_playlist_with_items(playlist_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM playlists WHERE id = ?", (playlist_id,))
    playlist = cursor.fetchone()
    if not playlist:
        conn.close()
        return None
    cursor.execute('''
        SELECT pi.*, m.url, m.mime_type, m.filename 
        FROM playlist_items pi
        JOIN media m ON pi.media_id = m.id
        WHERE pi.playlist_id = ?
        ORDER BY pi.display_order
    ''', (playlist_id,))
    items = [dict(row) for row in cursor.fetchall()]
    conn.close()
    result = dict(playlist)
    result['items'] = items
    return result

def list_playlists():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM playlists ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

# ========== FUNÇÕES para assignments ==========
def assign_playlist_to_tv(child_site_id, playlist_id):
    conn = get_connection()
    cursor = conn.cursor()
    # Remove assignment anterior para esta TV
    cursor.execute("DELETE FROM assignments WHERE child_site_id = ?", (child_site_id,))
    cursor.execute(
        "INSERT INTO assignments (child_site_id, playlist_id) VALUES (?, ?)",
        (child_site_id, playlist_id)
    )
    conn.commit()
    conn.close()
    return True

def get_current_playlist_for_tv(child_site_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT playlist_id FROM assignments
        WHERE child_site_id = ?
        ORDER BY assigned_at DESC LIMIT 1
    ''', (child_site_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return get_playlist_with_items(row['playlist_id'])
    return None

# ========== EXEMPLO DE USO (se rodar este arquivo diretamente) ==========
if __name__ == '__main__':
    init_db()
    
    # Testes rápidos
    print("Adicionando uma TV de exemplo...")
    add_child_site("Sala de Estar", "192.168.1.100", "1234")
    
    print("Adicionando mídias de exemplo...")
    add_media("paisagem.jpg", "/uploads/paisagem.jpg", "image/jpeg")
    add_media("video_demo.mp4", "/uploads/video_demo.mp4", "video/mp4")
    
    print("Listando TVs:")
    for tv in list_child_sites():
        print(f" - {tv['name']} (código: {tv['codigo']})")
    
    print("Listando mídias:")
    for m in list_media():
        print(f" - {m['filename']} ({m['mime_type']})")
    
    print("Criando uma playlist e adicionando itens...")
    playlist_id = add_playlist("Playlist Principal")
    add_playlist_item(playlist_id, 1, 10)  # imagem por 10 seg
    add_playlist_item(playlist_id, 2, 30)  # vídeo por 30 seg
    
    print("Atribuindo playlist à TV...")
    assign_playlist_to_tv(1, playlist_id)
    
    print("Playlist atual da TV 1:")
    playlist_data = get_current_playlist_for_tv(1)
    if playlist_data:
        print(f"Playlist: {playlist_data['name']}")
        for item in playlist_data['items']:
            print(f"  - ordem {item['display_order']}: {item['filename']} duração {item['duration_seconds']}s")
    
    print("\n✅ Banco preparado! Agora você pode usar as funções do db.py em outros scripts.")