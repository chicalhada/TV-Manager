from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import uuid
import random
import string
from flask import send_from_directory
from db import (
    add_child_site,
    list_child_sites,
    add_media,
    list_media,
    add_playlist_db,
    add_playlist_item,
    get_playlist_with_items,
    list_playlists,
    assign_playlist_to_tv,
    get_current_playlist_for_tv,
    get_connection,
    get_media,
    get_child_site_by_codigo   # <-- ADICIONADO
)

app = Flask(__name__)
CORS(app)

upload_folder = 'uploads/'
os.makedirs(upload_folder, exist_ok=True)

########################################################################################

@app.route("/")
def test():
    return "TV Manager - Admin"

@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory('static', filename)

@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})

################################################################################

@app.route("/api/tvs", methods=["GET"])
def get_tvs():
    tvs = list_child_sites()
    return jsonify(tvs)

@app.route('/tv')
def tv():
    return send_from_directory('static', 'tv.html')   # <-- CORRIGIDO

@app.route("/api/tvs", methods=["POST"])
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
def get_playlists():
    playlists = list_playlists()
    return jsonify(playlists)

@app.route("/api/playlists", methods=["POST"])
def add_playlist():
    data = request.get_json()
    playlist_id = add_playlist_db(data["name"])
    playlist = get_playlist_with_items(playlist_id)
    return jsonify(playlist), 201

@app.route("/api/playlists/<int:playlist_id>", methods=["GET"])
def get_playlist(playlist_id):
    playlist = get_playlist_with_items(playlist_id)
    if not playlist:
        return jsonify({"error": "Playlist não encontrada"}), 404
    return jsonify(playlist)

@app.route("/api/playlists/<int:playlist_id>/items", methods=["POST"])
def add_item_to_playlist(playlist_id):
    item = request.get_json()
    media_id = item.get("media_id")
    duration = item.get("duration", 10)
    
    if not media_id:
        return jsonify({"error": "media_id é obrigatório"}), 400
    
    playlist = get_playlist_with_items(playlist_id)
    if not playlist:
        return jsonify({"error": "Playlist não encontrada"}), 404
    
    next_order = len(playlist.get("items", [])) + 1
    add_playlist_item(playlist_id, media_id, duration, next_order)
    
    playlist_atualizada = get_playlist_with_items(playlist_id)
    return jsonify(playlist_atualizada), 201

########################################################################################

@app.route("/api/upload", methods=["POST"])
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
def get_media():
    media = list_media()
    return jsonify(media)






@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory('uploads', filename)

################################################################################

@app.route("/api/assign", methods=["POST"])
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
def delete_tv(child_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM child_sites WHERE id = ?", (child_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "TV removida com sucesso"}), 200




@app.route("/api/media/<int:media_id>", methods=["DELETE"])
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
def delete_playlist(playlist_id):
    playlist = get_playlist_with_items(playlist_id)
    if not playlist:
        return jsonify({"error": "Playlist não encontrada"}), 404
    

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM playlists WHERE id = ?", (playlist_id,))
    conn.commit()
    conn.close()
    
    return jsonify({"success": True, "message": "Playlist removida com sucesso"}), 200






@app.route("/api/playlists/<int:playlist_id>/items/<int:item_id>", methods=["DELETE"])
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

if __name__ == '__main__':
    app.run(debug=True, port=5000)