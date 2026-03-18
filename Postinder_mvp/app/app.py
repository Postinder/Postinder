from flask import Flask, render_template, request, jsonify
from uuid import uuid4
import os

app = Flask(__name__)

UPLOAD_FOLDER = "static/uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Banco simples em memória
BATCH = {
    "default": {
        "images": []
    }
}

@app.get("/")
def index():
    return render_template("index.html")

@app.get("/batch")
def batch():
    return jsonify({"ok": True, "batch": BATCH["default"]})

@app.post("/upload")
def upload():
    files = request.files.getlist("files")
    items = []

    for f in files:
        if f.filename == "":
            continue

        ext = os.path.splitext(f.filename)[1]
        filename = f"{uuid4().hex}{ext}"
        path = os.path.join(UPLOAD_FOLDER, filename)
        f.save(path)

        item = {
            "id": uuid4().hex,
            "url": f"/{UPLOAD_FOLDER}/{filename}",
            "status": "pending",
            "feedback": ""
        }

        BATCH["default"]["images"].append(item)
        items.append(item)

    return jsonify({"ok": True, "items": items})

@app.post("/review")
def review():
    data = request.json
    img_id = data.get("id")
    status = data.get("status")
    feedback = data.get("feedback", "")

    for img in BATCH["default"]["images"]:
        if img["id"] == img_id:
            img["status"] = status
            img["feedback"] = feedback
            return jsonify({"ok": True, "item": img})

    return jsonify({"ok": False, "error": "Imagem não encontrada"})

@app.get("/report")
def report():
    images = BATCH["default"]["images"]

    approved = len([i for i in images if i["status"] == "approved"])
    rejected = len([i for i in images if i["status"] == "rejected"])
    pending = len([i for i in images if i["status"] == "pending"])
    total = len(images)

    return render_template(
        "report.html",
        images=images,
        approved=approved,
        rejected=rejected,
        pending=pending,
        total=total
    )

# ✅ NOVA ROTA REPROVADAS
@app.get("/reprovadas")
def reprovadas():
    images = BATCH["default"]["images"]
    rejected_imgs = [i for i in images if i["status"] == "rejected"]

    return render_template(
        "reprovadas.html",
        images=rejected_imgs,
        total=len(rejected_imgs)
    )

if __name__ == "__main__":
    app.run(debug=False)