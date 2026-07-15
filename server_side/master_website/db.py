import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'tvmanager.db')

def get_connection():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def init_db():
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                email TEXT,
                role TEXT DEFAULT 'admin'
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS child_sites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                ip TEXT,
                codigo TEXT UNIQUE NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS media (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                url TEXT NOT NULL,
                mime_type TEXT,
                user_id INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS playlists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS playlist_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                playlist_id INTEGER NOT NULL,
                media_id INTEGER NOT NULL,
                duration_seconds INTEGER DEFAULT 10,
                display_order INTEGER DEFAULT 0,
                start_time TEXT,
                end_time TEXT,
                selected_dates TEXT,
                FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE,
                FOREIGN KEY (media_id) REFERENCES media (id)
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS tv_playlist_assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                child_site_id INTEGER NOT NULL,
                playlist_id INTEGER NOT NULL,
                assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (child_site_id) REFERENCES child_sites (id),
                FOREIGN KEY (playlist_id) REFERENCES playlists (id)
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS schedule (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                child_site_id INTEGER NOT NULL,
                playlist_id INTEGER NOT NULL,
                day_of_week TEXT,
                selected_dates TEXT,
                start_time TEXT NOT NULL,
                end_time TEXT,
                active INTEGER DEFAULT 1,
                FOREIGN KEY (child_site_id) REFERENCES child_sites (id),
                FOREIGN KEY (playlist_id) REFERENCES playlists (id)
            )
        ''')
        conn.commit()
        
        # Migrações para bases de dados antigas
        try:
            cursor.execute("ALTER TABLE playlist_items ADD COLUMN selected_dates TEXT")
        except sqlite3.OperationalError:
            pass  # coluna já existe
        try:
            cursor.execute("ALTER TABLE schedule ADD COLUMN selected_dates TEXT")
        except sqlite3.OperationalError:
            pass  # coluna já existe
        try:
            cursor.execute("ALTER TABLE schedule ADD COLUMN day_of_week TEXT")
        except sqlite3.OperationalError:
            pass  # coluna já existe
        try:
            cursor.execute("ALTER TABLE playlist_items ADD COLUMN start_time TEXT")
        except sqlite3.OperationalError:
            pass
        try:
            cursor.execute("ALTER TABLE playlist_items ADD COLUMN end_time TEXT")
        except sqlite3.OperationalError:
            pass
        conn.commit()

# ... (resto das funções, incluindo as que já estavam)

def add_user(username, password_hash, email=None, role='admin'):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, ?)",
            (username, password_hash, email, role)
        )
        conn.commit()
        return cursor.lastrowid

def get_user_by_username(username):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        return cursor.fetchone()

def authenticate_user(username, password):
    user = get_user_by_username(username)
    if not user:
        return None
    return dict(user)

def list_users():
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, email, role FROM users")
        return [dict(row) for row in cursor.fetchall()]

def delete_user(user_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()

def add_child_site(name, user_id, ip, codigo):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO child_sites (name, user_id, ip, codigo) VALUES (?, ?, ?, ?)",
            (name, user_id, ip, codigo)
        )
        conn.commit()
        return cursor.lastrowid

def list_child_sites(user_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM child_sites WHERE user_id = ? ORDER BY id", (user_id,))
        return [dict(row) for row in cursor.fetchall()]

def get_child_site_by_codigo(codigo):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM child_sites WHERE codigo = ?", (codigo,))
        row = cursor.fetchone()
        return dict(row) if row else None

def get_child_site_by_id(child_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM child_sites WHERE id = ?", (child_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def delete_child_site(child_id, user_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM child_sites WHERE id = ? AND user_id = ?", (child_id, user_id))
        conn.commit()

def add_media(filename, url, mime_type, user_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO media (filename, url, mime_type, user_id) VALUES (?, ?, ?, ?)",
            (filename, url, mime_type, user_id)
        )
        conn.commit()
        return cursor.lastrowid

def list_media(user_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM media WHERE user_id = ?", (user_id,))
        return [dict(row) for row in cursor.fetchall()]

def get_media(media_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM media WHERE id = ?", (media_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def delete_media(media_id, user_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM media WHERE id = ? AND user_id = ?", (media_id, user_id))
        conn.commit()

def add_playlist(name, user_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO playlists (name, user_id) VALUES (?, ?)",
            (name, user_id)
        )
        conn.commit()
        return cursor.lastrowid

def list_playlists(user_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM playlists WHERE user_id = ?", (user_id,))
        return [dict(row) for row in cursor.fetchall()]

def get_playlist(playlist_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM playlists WHERE id = ?", (playlist_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def delete_playlist(playlist_id, user_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM playlists WHERE id = ? AND user_id = ?", (playlist_id, user_id))
        conn.commit()

def add_playlist_item(playlist_id, media_id, duration_seconds, display_order,
                      start_time=None, end_time=None, selected_dates=None):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO playlist_items
               (playlist_id, media_id, duration_seconds, display_order, start_time, end_time, selected_dates)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (playlist_id, media_id, duration_seconds, display_order, start_time, end_time, selected_dates)
        )
        conn.commit()
        return cursor.lastrowid

def get_playlist_items(playlist_id, user_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT pi.*, m.filename, m.url, m.mime_type
            FROM playlist_items pi
            JOIN media m ON pi.media_id = m.id
            JOIN playlists p ON pi.playlist_id = p.id
            WHERE pi.playlist_id = ? AND p.user_id = ?
            ORDER BY pi.display_order
        """, (playlist_id, user_id))
        return [dict(row) for row in cursor.fetchall()]

def remove_playlist_item(item_id, playlist_id, user_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            DELETE FROM playlist_items
            WHERE id = ? AND playlist_id = ?
            AND playlist_id IN (SELECT id FROM playlists WHERE user_id = ?)
        """, (item_id, playlist_id, user_id))
        conn.commit()

def update_playlist_item(item_id, playlist_id, user_id,
                         start_time=None, end_time=None, selected_dates=None,
                         duration_seconds=None):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE playlist_items
            SET start_time = ?, end_time = ?, selected_dates = ?, duration_seconds = ?
            WHERE id = ? AND playlist_id = ?
            AND playlist_id IN (SELECT id FROM playlists WHERE user_id = ?)
        """, (start_time, end_time, selected_dates, duration_seconds, item_id, playlist_id, user_id))
        conn.commit()

def reorder_playlist_items(playlist_id, user_id, item_ids):
    with get_connection() as conn:
        cursor = conn.cursor()
        for order, item_id in enumerate(item_ids, start=1):
            cursor.execute("""
                UPDATE playlist_items
                SET display_order = ?
                WHERE id = ? AND playlist_id = ?
                AND playlist_id IN (SELECT id FROM playlists WHERE user_id = ?)
            """, (order, item_id, playlist_id, user_id))
        conn.commit()

def assign_playlist_to_tv(child_site_id, playlist_id, user_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM tv_playlist_assignments WHERE child_site_id = ?", (child_site_id,))
        cursor.execute(
            "INSERT INTO tv_playlist_assignments (child_site_id, playlist_id) VALUES (?, ?)",
            (child_site_id, playlist_id)
        )
        conn.commit()

def get_current_playlist_for_tv(child_site_id, user_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.*
            FROM tv_playlist_assignments a
            JOIN playlists p ON a.playlist_id = p.id
            WHERE a.child_site_id = ? AND p.user_id = ?
            ORDER BY a.assigned_at DESC LIMIT 1
        """, (child_site_id, user_id))
        row = cursor.fetchone()
        if row:
            playlist = dict(row)
            playlist['items'] = get_playlist_items(playlist['id'], user_id)
            return playlist
        return None

def get_assignment_for_tv(child_site_id, user_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM tv_playlist_assignments
            WHERE child_site_id = ?
            ORDER BY assigned_at DESC LIMIT 1
        """, (child_site_id,))
        return dict(cursor.fetchone()) if cursor.fetchone() else None

def get_current_active_playlist_for_tv(child_site_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.*
            FROM tv_playlist_assignments a
            JOIN playlists p ON a.playlist_id = p.id
            WHERE a.child_site_id = ?
            ORDER BY a.assigned_at DESC LIMIT 1
        """, (child_site_id,))
        row = cursor.fetchone()
        if row:
            playlist = dict(row)
            cursor2 = conn.cursor()
            cursor2.execute("""
                SELECT pi.*, m.filename, m.url, m.mime_type
                FROM playlist_items pi
                JOIN media m ON pi.media_id = m.id
                WHERE pi.playlist_id = ?
                ORDER BY pi.display_order
            """, (playlist['id'],))
            playlist['items'] = [dict(r) for r in cursor2.fetchall()]
            return playlist
        return None

def add_schedule(child_site_id, playlist_id, day_of_week, start_time, end_time,
                 active=1, selected_dates=None):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO schedule (child_site_id, playlist_id, day_of_week, start_time, end_time, active, selected_dates)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (child_site_id, playlist_id, day_of_week, start_time, end_time, active, selected_dates))
        conn.commit()
        return cursor.lastrowid

def get_all_schedules(user_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT s.*, p.name as playlist_name, cs.name as child_site_name, cs.codigo
            FROM schedule s
            JOIN playlists p ON s.playlist_id = p.id
            JOIN child_sites cs ON s.child_site_id = cs.id
            WHERE cs.user_id = ?
            ORDER BY s.day_of_week, s.start_time
        """, (user_id,))
        return [dict(row) for row in cursor.fetchall()]

def update_schedule(schedule_id, child_site_id=None, playlist_id=None, day_of_week=None,
                    start_time=None, end_time=None, active=None, selected_dates=None):
    with get_connection() as conn:
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
        if selected_dates is not None:
            updates.append("selected_dates = ?")
            params.append(selected_dates)
        params.append(schedule_id)
        query = f"UPDATE schedule SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, params)
        conn.commit()

def delete_schedule(schedule_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM schedule WHERE id = ?", (schedule_id,))
        conn.commit()

def get_active_playlist_for_tv(child_site_id, day_of_week, current_time, current_date):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT s.*, p.name as playlist_name
            FROM schedule s
            JOIN playlists p ON s.playlist_id = p.id
            WHERE s.child_site_id = ? AND s.active = 1
              AND (s.day_of_week = ? OR s.selected_dates LIKE ?)
        """, (child_site_id, day_of_week, f'%{current_date}%'))
        schedules = cursor.fetchall()
        for sched in schedules:
            start = sched['start_time']
            end = sched['end_time']
            if end:
                if start <= end:
                    if not (start <= current_time <= end):
                        continue
                else:
                    if not (current_time >= start or current_time <= end):
                        continue
            playlist = get_playlist(sched['playlist_id'])
            if playlist:
                playlist['items'] = get_playlist_items(playlist['id'], playlist['user_id'])
                return playlist
        return None

def item_valido_para_data(item, current_date):
    datas = item.get('selected_dates')
    if not datas:
        return True
    datas_list = [d.strip() for d in datas.split(',') if d.strip()]
    return current_date in datas_list