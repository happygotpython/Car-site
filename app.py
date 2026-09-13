import os
import json
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Security: Load secrets and admin credentials from environment variables
app.secret_key = os.environ.get('SECRET_KEY', 'default-dev-secret-change-in-production')
ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD_HASH = generate_password_hash(os.environ.get('ADMIN_PASSWORD', 'admin123'))

CARS_FILE = 'cars.json'
UPLOAD_FOLDER = os.path.join('static', 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def parse_int(val, default=0):
    try:
        return int(val) if val is not None and str(val).strip() != '' else default
    except (ValueError, TypeError):
        return default

def load_cars():
    if not os.path.exists(CARS_FILE):
        return []
    try:
        with open(CARS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return []

def save_cars(cars):
    temp_file = f"{CARS_FILE}.tmp"
    with open(temp_file, 'w', encoding='utf-8') as f:
        json.dump(cars, f, indent=2)
    os.replace(temp_file, CARS_FILE)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/admin')
def admin_page():
    if not session.get('admin_logged_in'):
        return redirect(url_for('login'))
    return render_template('admin.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        if username == ADMIN_USERNAME and check_password_hash(ADMIN_PASSWORD_HASH, password):
            session['admin_logged_in'] = True
            return redirect(url_for('admin_page'))
        return render_template('login.html', error="Invalid credentials")
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.pop('admin_logged_in', None)
    return redirect(url_for('index'))

@app.route('/api/cars', methods=['GET'])
def get_cars():
    return jsonify(load_cars())

@app.route('/api/cars', methods=['POST'])
def add_car():
    if not session.get('admin_logged_in'):
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401

    cars = load_cars()
    new_id = max([c.get('id', 0) for c in cars], default=0) + 1

    # Save uploaded file or read image URL
    image_path = '/static/placeholder.jpg'
    if 'image' in request.files and request.files['image'].filename:
        file = request.files['image']
        filename = secure_filename(file.filename)
        save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(save_path)
        image_path = f"/{app.config['UPLOAD_FOLDER']}/{filename}"
    elif request.form.get('image'):
        image_path = request.form.get('image').strip()

    car_type = request.form.get('type', 'sale').strip()

    car = {
        'id': new_id,
        'type': car_type,
        'title': request.form.get('title', '').strip(),
        'specs': request.form.get('specs', '').strip(),
        'image': image_path,
        'fuelType': request.form.get('fuelType', 'Gasoline').strip(),
        'drivetrain': request.form.get('drivetrain', 'AWD').strip()
    }

    if car_type == 'sale':
        car.update({
            'make': request.form.get('make', 'Other').strip(),
            'year': parse_int(request.form.get('year'), 2024),
            'price': parse_int(request.form.get('price'), 0),
            'mileage': parse_int(request.form.get('mileage'), 0)
        })
    else:
        car.update({
            'category': request.form.get('category', 'Rental').strip(),
            'dailyPrice': parse_int(request.form.get('dailyPrice'), 0)
        })

    cars.append(car)
    save_cars(cars)
    return jsonify({'success': True, 'car': car})

@app.route('/api/cars/<int:car_id>', methods=['DELETE'])
def delete_car(car_id):
    if not session.get('admin_logged_in'):
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401

    cars = load_cars()
    filtered_cars = [c for c in cars if c.get('id') != car_id]

    if len(filtered_cars) == len(cars):
        return jsonify({'success': False, 'message': 'Vehicle not found'}), 404

    save_cars(filtered_cars)
    return jsonify({'success': True, 'message': 'Vehicle deleted'})

if __name__ == '__main__':
    app.run(debug=True)