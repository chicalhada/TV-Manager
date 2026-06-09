from flask import Flask, jsonify, request
from flask_cors import CORS


app = Flask(__name__)
CORS(app)

tvs_conectadas = []  # Lista para armazenar as TVs conectadas





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

if __name__ == '__main__':
    app.run(debug=True, port=5000)