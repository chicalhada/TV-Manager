from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import uuid
import random
import string
from flask import send_from_directory
import bcrypt
import jwt
from functools import wraps
from datetime import datetime, timedelta
from flask_socketio import SocketIO, emit, join_room, leave_room
from db import (
    add_child_site,
    list_child_sites,
    add_media,
    list_media,
    add_playlist,
    add_playlist_item,
    get_playlist_items,
    list_playlists,
    assign_playlist_to_tv,
    get_current_playlist_for_tv,
    get_connection,
    get_media,
    get_child_site_by_codigo,
    add_user,
    get_user_by_username,
    authenticate_user,
    list_users as db_list_users,
    delete_user as db_delete_user,
    get_assignment_for_tv,
    get_playlist
)

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

upload_folder = 'uploads/'
os.makedirs(upload_folder, exist_ok=True)

JWT_SECRET = "tvmanager_secret_key_2026"
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24


############################################################################################################

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            return jsonify({"error": "Token não fornecido"}), 401
        
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            request.current_user = payload
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expirado"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Token inválido"}), 401
        
        return f(*args, **kwargs)
    return decorated_function

########################################################################################

@app.route('/')
def index():
    return send_from_directory('templates', 'login.html')

@app.route('/login.html')
def login_page():
    return send_from_directory('templates', 'login.html')

@app.route('/index.html')
def dashboard():
    return send_from_directory('templates', 'index.html')

@app.route('/register.html')
def register_page():
    return send_from_directory('templates', 'register.html')

@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

@app.route('/style.css')
def serve_css():
    return send_from_directory('static', 'style.css')

@app.route('/admin.js')
def serve_js():
    return send_from_directory('static', 'admin.js')

########################################################################################

@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})

################################################################################

@app.route("/api/tvs", methods=["GET"])
@login_required
def get_tvs():
    tvs = list_child_sites()
    return jsonify(tvs)

@app.route('/tv')
def tv():
    return send_from_directory('static', 'tv.html')

@app.route("/api/tvs", methods=["POST"])
@login_required
def add_tv():
    data = request.get_json()
    child_id = add_child_site(data["name"], data.get("ip"), None)
    tvs = list_child_sites()
    nova_tv = next((tv for tv in tvs if tv["id"] == child_id), None)
    return jsonify(nova_tv), 201

@app.route("/api/tv/register", methods=["POST"])
def register_tv():
    data = request.get_json() or {}
    codigo = data.get("codigo")
    
    if not codigo:
        codigo = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    
    tv = get_child_site_by_codigo(codigo)
    if not tv:
        child_id = add_child_site(f"TV {codigo}", None, codigo)
        tv = get_child_site_by_codigo(codigo)
    
    return jsonify({"success": True, "codigo": tv["codigo"], "child_id": tv["id"]}), 200

################################################################################

@app.route("/api/playlists", methods=["GET"])
@login_required
def get_playlists():
    playlists = list_playlists()
    return jsonify(playlists)

@app.route("/api/playlists", methods=["POST"])
@login_required
def add_playlist():
    data = request.get_json()
    playlist_id = add_playlist(data["name"])
    playlist_items = get_playlist_items(playlist_id)
    playlist = {"id": playlist_id, "name": data["name"], "items": playlist_items}
    return jsonify(playlist), 201

@app.route("/api/playlists/<int:playlist_id>", methods=["GET"])
@login_required
def get_playlist(playlist_id):
    items = get_playlist_items(playlist_id)
    if items is None:
        return jsonify({"error": "Playlist não encontrada"}), 404
    return jsonify({"id": playlist_id, "items": items})

@app.route("/api/playlists/<int:playlist_id>/items", methods=["POST"])
@login_required
def add_item_to_playlist(playlist_id):
    item = request.get_json()
    media_id = item.get("media_id")
    duration = item.get("duration", 10)
    
    if not media_id:
        return jsonify({"error": "media_id é obrigatório"}), 400
    
    items = get_playlist_items(playlist_id)
    if items is None:
        return jsonify({"error": "Playlist não encontrada"}), 404
    
    next_order = len(items) + 1
    add_playlist_item(playlist_id, media_id, duration, next_order)
    
    playlist_atualizada = get_playlist_items(playlist_id)
    return jsonify({"id": playlist_id, "items": playlist_atualizada}), 201

########################################################################################

@app.route("/api/upload", methods=["POST"])
@login_required
def upload_file():
    files = request.files.getlist('file')
    
    if not files or files[0].filename == '':
        return jsonify({"error": "Nenhum ficheiro selecionado"}), 400
    
    resultados = []
    
    for file in files:
        original_name = secure_filename(file.filename)
        unique_id = str(uuid.uuid4())[:8]
        filename = f"{unique_id}_{original_name}"
        filepath = os.path.join(upload_folder, filename)
        file.save(filepath)
        
        url = f"/{upload_folder}{filename}"
        mime_type = file.mimetype
        media_id = add_media(filename, url, mime_type)
        
        resultados.append({
            "id": media_id,
            "filename": filename,
            "url": url
        })
    
    return jsonify(resultados), 201

@app.route("/api/media", methods=["GET"])
@login_required
def get_media():
    media = list_media()
    return jsonify(media)

@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory('uploads', filename)

################################################################################

@app.route("/api/assign", methods=["POST"])
@login_required
def assign_playlist():
    data = request.get_json()
    child_site_codigo = data.get("child_site_codigo")
    playlist_id = data.get("playlist_id")

    if not child_site_codigo or not playlist_id:
        return jsonify({"error": "child_site_codigo e playlist_id são obrigatórios"}), 400
    
    child_site = get_child_site_by_codigo(child_site_codigo)
    if not child_site:
        return jsonify({"error": "TV não encontrada"}), 404
    
    assign_playlist_to_tv(child_site["id"], playlist_id)

    socketio.emit('playlist_updated', {
    'child_site_codigo': child_site_codigo,
    'playlist_id': playlist_id
    }, room=child_site_codigo)


    return jsonify({"success": True, "child_site_codigo": child_site["codigo"], "playlist_id": playlist_id}), 200



@app.route("/api/child/<string:child_site_codigo>/playlist", methods=["GET"])
def get_child_playlist(child_site_codigo):
    child_site = get_child_site_by_codigo(child_site_codigo)
    if not child_site:
        return jsonify({"error": "TV não encontrada"}), 404
    playlist = get_current_playlist_for_tv(child_site["id"])
    if not playlist:
        return jsonify({"error": "Nenhuma playlist atribuída a esta TV"}), 404
    return jsonify(playlist)

################################################################################

@app.route("/api/tvs/<int:child_id>", methods=["DELETE"])
@login_required
def delete_tv(child_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM child_sites WHERE id = ?", (child_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "TV removida com sucesso"}), 200

@app.route("/api/media/<int:media_id>", methods=["DELETE"])
@login_required
def delete_media(media_id):
    media = get_media(media_id)
    if not media:
        return jsonify({"error": "Media não encontrado"}), 404
    
    filepath = os.path.join(upload_folder, media["filename"])
    if os.path.exists(filepath):
        os.remove(filepath)
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM media WHERE id = ?", (media_id,))
    conn.commit()
    conn.close()
    
    return jsonify({"success": True, "message": "Media removido com sucesso"}), 200

@app.route("/api/playlists/<int:playlist_id>", methods=["DELETE"])
@login_required 
def delete_playlist(playlist_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM playlists WHERE id = ?", (playlist_id,))
    conn.commit()
    conn.close()
    
    return jsonify({"success": True, "message": "Playlist removida com sucesso"}), 200

@app.route("/api/playlists/<int:playlist_id>/items/<int:item_id>", methods=["DELETE"])
@login_required
def delete_playlist_item(playlist_id, item_id):
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM playlist_items WHERE id = ? AND playlist_id = ?", (item_id, playlist_id))
    item = cursor.fetchone()
    if not item:
        conn.close()
        return jsonify({"error": "Item não encontrado nesta playlist"}), 404
    
    cursor.execute("DELETE FROM playlist_items WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()
    
    return jsonify({"success": True, "message": "Item removido da playlist"}), 200

###########################################################################################################

@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")
    email = data.get("email")

    if not username or not password:
        return jsonify({"error": "Username e password são obrigatórios"}), 400

    existing = get_user_by_username(username)
    if existing:
        return jsonify({"error": "Username já existe"}), 409

    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user_id = add_user(username, password_hash, email)
    return jsonify({"success": True, "user_id": user_id, "username": username}), 201

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Username e password são obrigatórios"}), 400

    user = authenticate_user(username, password)
    if not user:
        return jsonify({"error": "Credenciais inválidas"}), 401

    expiration = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    token = jwt.encode({
        "user_id": user["id"],
        "username": user["username"],
        "role": user["role"],
        "exp": expiration
    }, JWT_SECRET, algorithm=JWT_ALGORITHM)

    return jsonify({
        "success": True,
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "role": user["role"]
        }
    }), 200

@app.route("/api/auth/me", methods=["GET"])
def get_current_user():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        return jsonify({"error": "Token necessário"}), 401

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = get_user_by_username(payload["username"])
        if not user:
            return jsonify({"error": "Utilizador não encontrado"}), 404
        return jsonify({
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "role": user["role"]
        }), 200
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token expirado"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Token inválido"}), 401

##############################################################################################################

@app.route('/api/users', methods=['GET'])
@login_required
def list_users():
    return jsonify(db_list_users())

@app.route('/api/users', methods=['POST'])
@login_required
def create_user():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    email = data.get('email')
    role = data.get('role', 'admin')
    if not username or not password:
        return jsonify({'error': 'Usuário e senha obrigatórios'}), 400
    existing = get_user_by_username(username)
    if existing:
        return jsonify({'error': 'Usuário já existe'}), 409
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user_id = add_user(username, password_hash, email, role)
    return jsonify({'id': user_id, 'username': username}), 201

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
@login_required
def delete_user(user_id):
    db_delete_user(user_id)
    return jsonify({'message': 'removido'}), 200

@app.route('/api/assign', methods=['GET'])
@login_required
def get_assignments():
    sites = list_child_sites()
    result = []
    for site in sites:
        assign = get_assignment_for_tv(site['id'])
        if assign:
            playlist = get_playlist(assign['playlist_id'])
            result.append({
                'child_site_id': site['id'],
                'child_site_name': site['name'],
                'playlist_id': assign['playlist_id'],
                'playlist_name': playlist['name'] if playlist else None,
                'assigned_at': assign['assigned_at']
            })
    return jsonify(result)

###############################################################################################################

@socketio.on('connect')
def handle_connect():
    print(f"Cliente conectado: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    print(f"Cliente desconectado: {request.sid}")

@socketio.on('register_tv')
def handle_register_tv(data):
    codigo = data.get('codigo')
    if codigo:
        join_room(codigo)
        print(f"TV {codigo} registada na sala {codigo}")
        emit('registered', {'status': 'ok', 'codigo': codigo}, room=request.sid)


################################################################################################################



if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000, allow_unsafe_werkzeug=True)