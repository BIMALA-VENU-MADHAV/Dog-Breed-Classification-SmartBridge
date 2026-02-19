import os
from flask import Flask, request, jsonify, render_template, redirect, url_for, session, flash
import numpy as np
import pandas as pd
import tensorflow as tf
import tensorflow_hub as hub
from PIL import Image
import io
import base64
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

# === CONFIG === #
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model", "20250515-05211747286492-full-images-mobilenetv2-Adam.keras")
LABELS_PATH = os.path.join(BASE_DIR, "data", "labels.csv")
MODEL_URL = "https://tfhub.dev/google/imagenet/mobilenet_v2_130_224/classification/4"
IMG_SIZE = 224

app = Flask(__name__)

# === AUTH CONFIG (ADDED ONLY) === #
app.secret_key = "super_secret_key_change_this"
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + os.path.join(BASE_DIR, "users.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

# === USER MODEL (ADDED ONLY) === #
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)

with app.app_context():
    db.create_all()

# === LOAD LABELS === #
try:
    labels_csv = pd.read_csv(LABELS_PATH)
    labels = labels_csv.sort_values("id")["breed"].to_numpy()
    unique_breeds = np.unique(labels)
except Exception as e:
    print(f"Error loading labels: {str(e)}")
    raise

# === TF HUB WRAPPER === #
def hub_layer_fn(x):
    return hub.KerasLayer(MODEL_URL, trainable=False)(x)

# === LOAD MODEL === #
try:
    print(f"Loading model from: {MODEL_PATH}")
    model = tf.keras.models.load_model(
        MODEL_PATH,
        custom_objects={
            'hub_layer_fn': hub_layer_fn,
            'KerasLayer': hub.KerasLayer
        }
    )
    print("Model loaded successfully.")
except Exception as e:
    print(f"Error loading model: {str(e)}")
    raise

# === UTILITY FUNCTIONS === #
def process_image_pil(img):
    img = img.convert('RGB')
    img = img.resize((IMG_SIZE, IMG_SIZE))
    img_array = np.array(img).astype(np.float32) / 255.0
    return np.expand_dims(img_array, axis=0)

def predict_breed(image):
    try:
        image_array = process_image_pil(image)
        preds = model.predict(image_array)[0]
        top_idx = np.argmax(preds)
        confidence = float(preds[top_idx])
        return unique_breeds[top_idx], confidence
    except Exception as e:
        print(f"Error during prediction: {str(e)}")
        raise

# === ROUTES === #
@app.route("/")
def home():
    return render_template("home.html")

@app.route("/index")
def index():
    if "user_id" not in session:
        flash("Please login to continue", "error")
        return redirect(url_for("home"))
    return render_template("index.html")


@app.route("/about")
def about():
    return render_template("about.html")

@app.route("/contact")
def contact():
    return render_template("contact.html")

# === SIGNUP ROUTE (UPDATED ONLY) === #
@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "POST":
        username = request.form.get("username")
        email = request.form.get("email")
        password = request.form.get("password")

        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            flash("Email already registered" , "error")
            return redirect(url_for("signup"))

        hashed_password = generate_password_hash(password)

        new_user = User(
            username=username,
            email=email,
            password=hashed_password
        )

        db.session.add(new_user)
        db.session.commit()

        session["user_id"] = new_user.id
        session["username"] = new_user.username

        flash("Account created successfully!", "success")
        return redirect(url_for("home"))


    return render_template("signup.html")

# === LOGIN ROUTE (UPDATED ONLY) === #
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email")
        password = request.form.get("password")

        user = User.query.filter_by(email=email).first()

        if user and check_password_hash(user.password, password):
            session["user_id"] = user.id
            session["username"] = user.username
            return redirect(url_for("home"))
        else:
            flash("Invalid email or password" , "error")
            return redirect(url_for("login"))

    return render_template("login.html")

# === LOGOUT ROUTE (ADDED ONLY) === #
@app.route("/logout")
def logout():
    session.clear()
    flash("Logged out successfully", "success")
    return redirect(url_for("home"))

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        if 'image' not in data:
            return jsonify({'error': 'No image data provided'}), 400

        # Remove the data:image/jpeg;base64 prefix if present
        image_data = data['image']
        if ',' in image_data:
            image_data = image_data.split(',')[1]

        try:
            # Decode base64 image
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
        except Exception as e:
            return jsonify({'error': f'Invalid image data: {str(e)}'}), 400
        
        try:
            breed, confidence = predict_breed(image)
            return jsonify({
                'breed': breed,
                'confidence': round(confidence * 100, 2)
            })
        except Exception as e:
            return jsonify({'error': f'Prediction failed: {str(e)}'}), 500
            
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500


# === RUN APP === #
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
