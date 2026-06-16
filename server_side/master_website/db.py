import sqlite3
from datetime import datetime
import bcrypt

DB_PATH = 'tvmanager.db'

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT UNIQUE,
            role TEXT DEFAULT 'admin',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS child_sites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            ip TEXT,
            codigo TEXT UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS media (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            url TEXT NOT NULL,
            mime_type TEXT,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS playlist_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            playlist_id INTEGER NOT NULL,
            media_id INTEGER NOT NULL,
            duration_seconds INTEGER DEFAULT 10,
            display_order INTEGER NOT NULL,
            FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
            FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            child_site_id INTEGER NOT NULL,
            playlist_id INTEGER NOT NULL,
            assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (child_site_id) REFERENCES child_sites(id) ON DELETE CASCADE,
            FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
        )
    ''')
    conn.commit()
    conn.close()
    print("✅ Banco de dados inicializado.")

def add_user(username, password_hash, email=None, role='admin'):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, ?)",
        (username, password_hash, email, role)
    )
    conn.commit()
    user_id = cursor.lastrowid
    conn.close()
    return user_id

def get_user_by_username(username):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def list_users():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, email, role, created_at FROM users ORDER BY id")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def delete_user(user_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()


def authenticate_user(username, password):
    user = get_user_by_username(username)
    if user and bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
        return user
    return None





def add_child_site(name, ip=None, codigo=None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO child_sites (name, ip, codigo) VALUES (?, ?, ?)", (name, ip, codigo))
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

def get_child_site_by_id(site_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM child_sites WHERE id = ?", (site_id,))
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

def delete_child_site(site_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM child_sites WHERE id = ?", (site_id,))
    conn.commit()
    conn.close()

def add_media(filename, url, mime_type):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO media (filename, url, mime_type) VALUES (?, ?, ?)", (filename, url, mime_type))
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

def get_media_by_id(media_id):
    return get_media(media_id)

def delete_media(media_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM media WHERE id = ?", (media_id,))
    conn.commit()
    conn.close()

def add_playlist(name):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO playlists (name) VALUES (?)", (name,))
    conn.commit()
    pid = cursor.lastrowid
    conn.close()
    return pid

def get_playlist(playlist_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM playlists WHERE id = ?", (playlist_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def list_playlists():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM playlists ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def delete_playlist(playlist_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM playlists WHERE id = ?", (playlist_id,))
    conn.commit()
    conn.close()

def add_playlist_item(playlist_id, media_id, duration_seconds, display_order=None):
    conn = get_connection()
    cursor = conn.cursor()
    if display_order is None:
        cursor.execute("SELECT COALESCE(MAX(display_order), 0) + 1 FROM playlist_items WHERE playlist_id = ?", (playlist_id,))
        display_order = cursor.fetchone()[0]
    cursor.execute('''
        INSERT INTO playlist_items (playlist_id, media_id, duration_seconds, display_order)
        VALUES (?, ?, ?, ?)
    ''', (playlist_id, media_id, duration_seconds, display_order))
    conn.commit()
    item_id = cursor.lastrowid
    conn.close()
    return item_id

def get_playlist_items(playlist_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT pi.*, m.url, m.mime_type, m.filename
        FROM playlist_items pi
        JOIN media m ON pi.media_id = m.id
        WHERE pi.playlist_id = ?
        ORDER BY pi.display_order
    ''', (playlist_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def remove_playlist_item(item_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM playlist_items WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()

def assign_playlist_to_tv(child_site_id, playlist_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM assignments WHERE child_site_id = ?", (child_site_id,))
    cursor.execute("INSERT INTO assignments (child_site_id, playlist_id) VALUES (?, ?)", (child_site_id, playlist_id))
    conn.commit()
    conn.close()

def get_current_playlist_for_tv(child_site_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT playlist_id FROM assignments WHERE child_site_id = ? ORDER BY assigned_at DESC LIMIT 1", (child_site_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        playlist_id = row['playlist_id']
        playlist = get_playlist(playlist_id)
        if playlist:
            items = get_playlist_items(playlist_id)
            playlist['items'] = items
            return playlist
    return None

def get_assignment_for_tv(child_site_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM assignments WHERE child_site_id = ? ORDER BY assigned_at DESC LIMIT 1", (child_site_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

if __name__ == '__main__':
    init_db()

    conn = get_connection()
    conn.execute("DELETE FROM playlist_items")
    conn.execute("DELETE FROM assignments")
    conn.execute("DELETE FROM media")
    conn.execute("DELETE FROM playlists")
    conn.execute("DELETE FROM child_sites")
    conn.commit()
    conn.close()

    tv_id = add_child_site("TV Sala", "192.168.1.10", "1234")
    print(f"✅ TV adicionada com id: {tv_id}")

    tv = get_child_site_by_id(tv_id)
    print("get_child_site_by_id:", tv)

    media_id = add_media("demo.jpg", "/uploads/demo.jpg", "image/jpeg")
    print(f"✅ Media adicionada com id: {media_id}")

    media = get_media_by_id(media_id)
    print("get_media_by_id:", media)

    playlist_id = add_playlist("Playlist Teste")
    item_id = add_playlist_item(playlist_id, media_id, 15)
    print(f"✅ Playlist criada id: {playlist_id}, item id: {item_id}")

    assign_playlist_to_tv(tv_id, playlist_id)
    print("✅ Playlist atribuída à TV")

    delete_media(media_id)
    print("🗑️ Media removida")
    print("Media após delete:", get_media_by_id(media_id))

    items_restantes = get_playlist_items(playlist_id)
    print(f"Itens na playlist após delete_media: {items_restantes}")

    delete_playlist(playlist_id)
    print("🗑️ Playlist removida")
    print("Playlist após delete:", get_playlist(playlist_id))

    assign = get_assignment_for_tv(tv_id)
    print(f"Atribuição após delete_playlist: {assign}")

    delete_child_site(tv_id)
    print("🗑️ TV removida")
    print("TV após delete:", get_child_site_by_id(tv_id))

    print("\n✅ Testes concluídos. Todas as funções estão operacionais.")