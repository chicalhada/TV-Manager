from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import uuid
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
    get_current_playlist_for_tv
)

app = Flask(__name__)
CORS(app)

upload_folder = 'uploads/'
os.makedirs(upload_folder, exist_ok=True)



@app.route("/")
def test():
    return "TV Manager - Admin"




@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})




@app.route("/api/tvs", methods=["GET"])
def get_tvs():
    tvs = list_child_sites()
    return jsonify(tvs)




@app.route("/api/tvs", methods=["POST"])
def add_tv():
    data = request.get_json()
    child_id = add_child_site(data["name"], data.get("ip"), None)
    tvs = list_child_sites()
    nova_tv = next((tv for tv in tvs if tv["id"] == child_id), None)
    return jsonify(nova_tv), 201




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




@app.route("/api/assign", methods=["POST"])
def assign_playlist():
    data = request.get_json()
    child_site_id = data.get("child_site_id")
    playlist_id = data.get("playlist_id")
    
    if not child_site_id or not playlist_id:
        return jsonify({"error": "child_site_id e playlist_id são obrigatórios"}), 400
    
    assign_playlist_to_tv(child_site_id, playlist_id)
    return jsonify({"success": True, "child_site_id": child_site_id, "playlist_id": playlist_id}), 200


@app.route("/api/child/<int:child_site_id>/playlist", methods=["GET"])
def get_child_playlist(child_site_id):
    playlist = get_current_playlist_for_tv(child_site_id)
    if not playlist:
        return jsonify({"error": "Nenhuma playlist atribuída a esta TV"}), 404
    return jsonify(playlist)



if __name__ == '__main__':
    app.run(debug=True, port=5000)