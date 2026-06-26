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
            user_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS media (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            url TEXT NOT NULL,
            mime_type TEXT,
            user_id INTEGER NOT NULL,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
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
            user_id INTEGER NOT NULL,
            FOREIGN KEY (child_site_id) REFERENCES child_sites(id) ON DELETE CASCADE,
            FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tv_schedule (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            child_site_id INTEGER NOT NULL,
            playlist_id INTEGER NOT NULL,
            day_of_week TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT,
            active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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

def add_child_site(name, user_id, ip=None, codigo=None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO child_sites (name, user_id, ip, codigo) VALUES (?, ?, ?, ?)", (name, user_id, ip, codigo))
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

def list_child_sites(user_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM child_sites WHERE user_id = ? ORDER BY id", (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def delete_child_site(site_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM child_sites WHERE id = ?", (site_id,))
    conn.commit()
    conn.close()

def add_media(filename, url, mime_type, user_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO media (filename, url, mime_type, user_id) VALUES (?, ?, ?, ?)", (filename, url, mime_type, user_id))
    conn.commit()
    media_id = cursor.lastrowid
    conn.close()
    return media_id

def list_media(user_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM media WHERE user_id = ? ORDER BY uploaded_at DESC", (user_id,))
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

def delete_media(media_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM media WHERE id = ?", (media_id,))
    conn.commit()
    conn.close()

def add_playlist(name, user_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO playlists (name, user_id) VALUES (?, ?)", (name, user_id))
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

def get_playlist_with_items(playlist_id):
    playlist = get_playlist(playlist_id)
    if not playlist:
        return None
    items = get_playlist_items(playlist_id)
    playlist['items'] = items
    return playlist

def list_playlists(user_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM playlists WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
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

def get_playlist_items(playlist_id, user_id=None):
    conn = get_connection()
    cursor = conn.cursor()
    if user_id:
        cursor.execute('''
            SELECT pi.*, m.url, m.mime_type, m.filename
            FROM playlist_items pi
            JOIN media m ON pi.media_id = m.id
            JOIN playlists p ON pi.playlist_id = p.id
            WHERE pi.playlist_id = ? AND p.user_id = ?
            ORDER BY pi.display_order
        ''', (playlist_id, user_id))
    else:
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

def assign_playlist_to_tv(child_site_id, playlist_id, user_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM assignments WHERE child_site_id = ? AND user_id = ?", (child_site_id, user_id))
    cursor.execute("INSERT INTO assignments (child_site_id, playlist_id, user_id) VALUES (?, ?, ?)", (child_site_id, playlist_id, user_id))
    conn.commit()
    conn.close()

def get_current_playlist_for_tv(child_site_id, user_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT playlist_id FROM assignments WHERE child_site_id = ? AND user_id = ? ORDER BY assigned_at DESC LIMIT 1", (child_site_id, user_id))
    row = cursor.fetchone()
    conn.close()
    if row:
        playlist_id = row['playlist_id']
        return get_playlist_with_items(playlist_id)
    return None

def get_assignment_for_tv(child_site_id, user_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM assignments WHERE child_site_id = ? AND user_id = ? ORDER BY assigned_at DESC LIMIT 1", (child_site_id, user_id))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

# ========== FUNÇÕES PARA AGENDAMENTO ==========
def add_schedule(child_site_id, playlist_id, day_of_week, start_time, end_time=None, active=1):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO tv_schedule (child_site_id, playlist_id, day_of_week, start_time, end_time, active)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (child_site_id, playlist_id, day_of_week, start_time, end_time, active))
    conn.commit()
    schedule_id = cursor.lastrowid
    conn.close()
    return schedule_id

def get_schedules_by_tv(child_site_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT s.*, p.name as playlist_name
        FROM tv_schedule s
        JOIN playlists p ON s.playlist_id = p.id
        WHERE s.child_site_id = ?
        ORDER BY s.day_of_week, s.start_time
    ''', (child_site_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_all_schedules(user_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT s.*, c.name as child_site_name, p.name as playlist_name
        FROM tv_schedule s
        JOIN child_sites c ON s.child_site_id = c.id
        JOIN playlists p ON s.playlist_id = p.id
        WHERE c.user_id = ?
        ORDER BY s.day_of_week, s.start_time
    ''', (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def update_schedule(schedule_id, child_site_id=None, playlist_id=None, day_of_week=None, start_time=None, end_time=None, active=None):
    conn = get_connection()
    cursor = conn.cursor()
    
    updates = []
    params = []
    
    if child_site_id is not None:
        updates.append("child_site_id = ?")
        params.append(child_site_id)
    if playlist_id is not None:
        updates.append("playlist_id = ?")
        params.append(playlist_id)
    if day_of_week is not None:
        updates.append("day_of_week = ?")
        params.append(day_of_week)
    if start_time is not None:
        updates.append("start_time = ?")
        params.append(start_time)
    if end_time is not None:
        updates.append("end_time = ?")
        params.append(end_time)
    if active is not None:
        updates.append("active = ?")
        params.append(active)
    
    if not updates:
        conn.close()
        return None
    
    params.append(schedule_id)
    cursor.execute(f"UPDATE tv_schedule SET {', '.join(updates)} WHERE id = ?", params)
    conn.commit()
    conn.close()
    return True

def delete_schedule(schedule_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM tv_schedule WHERE id = ?", (schedule_id,))
    conn.commit()
    conn.close()
    return True

def get_active_playlist_for_tv(child_site_id, day_of_week, current_time):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT s.playlist_id
        FROM tv_schedule s
        WHERE s.child_site_id = ?
        AND s.day_of_week = ?
        AND s.start_time <= ?
        AND (s.end_time IS NULL OR s.end_time >= ?)
        AND s.active = 1
        ORDER BY s.start_time DESC
        LIMIT 1
    ''', (child_site_id, day_of_week, current_time, current_time))
    row = cursor.fetchone()
    conn.close()
    if row:
        return get_playlist_with_items(row['playlist_id'])
    return None

def get_current_active_playlist_for_tv(child_site_id):
    from datetime import datetime
    now = datetime.now()
    day_of_week = now.strftime("%a").upper()
    current_time = now.strftime("%H:%M")
    return get_active_playlist_for_tv(child_site_id, day_of_week, current_time)

if __name__ == '__main__':
    init_db()
    print("✅ Banco de dados criado/atualizado.")