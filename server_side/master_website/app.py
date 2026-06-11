from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import uuid

app = Flask(__name__)
CORS(app)

tvs_conectadas = []  # Lista para armazenar as TVs conectadas
playlists = []  # Lista para armazenar as playlists criadas

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
    return jsonify(tvs_conectadas)



@app.route("/api/tvs", methods=["POST"])
def add_tv():
    tv = request.get_json()
    nova_tv = {"id": len(tvs_conectadas) + 1, "name": tv["name"], "ip": tv["ip"]}
    tvs_conectadas.append(nova_tv)
    return jsonify(nova_tv), 201


################################################

@app.route("/api/playlists", methods=["GET"])
def get_playlists():
    return jsonify(playlists)



@app.route("/api/playlists", methods=["POST"])
def add_playlist():
    playlist = request.get_json()
    nova_playlist = {
        "id": len(playlists) + 1, 
        "name": playlist.get("name"), 
        "items": playlist.get("items", [])
    }
    playlists.append(nova_playlist)
    return jsonify(nova_playlist), 201



@app.route("/api/playlists/<int:playlist_id>", methods=["GET"])
def get_playlist(playlist_id):
    for playlist in playlists:
        if playlist["id"] == playlist_id:
            return jsonify(playlist)
    return jsonify({"error": "Playlist não encontrada"}), 404





@app.route("/api/playlists/<int:playlist_id>/items", methods=["POST"])
def add_item_to_playlist(playlist_id):
    # Procurar a playlist
    playlist_encontrada = None
    for playlist in playlists:
        if playlist["id"] == playlist_id:
            playlist_encontrada = playlist
            break
    
    if not playlist_encontrada:
        return jsonify({"error": "Playlist não encontrada"}), 404
    
    # Receber os dados do item
    item = request.get_json()
    media_id = item.get("media_id")
    duration = item.get("duration", 10)
    
    if not media_id:
        return jsonify({"error": "media_id é obrigatório"}), 400
    
    # Calcular ordem
    novo_ordem = len(playlist_encontrada["items"]) + 1
    
    # Adicionar item
    novo_item = {
        "media_id": media_id,
        "duration": duration,
        "ordem": novo_ordem
    }
    playlist_encontrada["items"].append(novo_item)
    
    return jsonify(playlist_encontrada), 201

##################################################################


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
        resultados.append({
            "filename": filename,
            "url": f"/{upload_folder}{filename}"
        })
    
    return jsonify(resultados), 201



if __name__ == '__main__':
    app.run(debug=True, port=5000)