import json
import os
import cloudinary
import cloudinary.uploader
from flask import (
    Flask,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__)

# Absolute base directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Security & App Config
app.secret_key = os.environ.get(
    'SECRET_KEY', 'happy_got_a_glock'
)
ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD_HASH = generate_password_hash(
    os.environ.get('ADMIN_PASSWORD', 'admin2026')
)

# Cloudinary Configuration using CLOUDINARY_URL
cloudinary.config(
    cloudinary_url=os.environ.get('CLOUDINARY_URL'),
    secure=True
)

# PostgreSQL / SQLAlchemy Configuration
db_url = os.environ.get('DATABASE_URL', f"sqlite:///{os.path.join(BASE_DIR, 'cars.db')}")
if db_url and db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['MAX_CONTENT_LENGTH'] = 25 * 1024 * 1024  # Increased to 25MB for multiple files

db = SQLAlchemy(app)

# Database Models
class Car(db.Model):
    __tablename__ = 'car'
    id = db.Column(db.Integer, primary_key=True)
    type = db.Column(db.String(20), default='sale')
    title = db.Column(db.String(100), nullable=False)
    specs = db.Column(db.String(200))
    image = db.Column(db.String(500))  # Legacy primary image field
    fuelType = db.Column(db.String(50), default='Gasoline')
    drivetrain = db.Column(db.String(50), default='AWD')
    make = db.Column(db.String(50))
    year = db.Column(db.Integer)
    price = db.Column(db.Integer)
    mileage = db.Column(db.Integer)
    category = db.Column(db.String(50))
    dailyPrice = db.Column(db.Integer)
    stock = db.Column(db.Integer, default=1)  # Stock inventory tracking

    # One-to-many relationship for multiple images
    images = db.relationship('CarImage', backref='car', cascade='all, delete-orphan', lazy=True)

    def to_dict(self):
        # Extract list of image URLs or fall back to primary image / placeholder
        image_urls = [img.image_url for img in self.images] if self.images else ([self.image] if self.image else ['/static/placeholder.jpg'])
        
        data = {
            'id': self.id,
            'type': self.type,
            'title': self.title,
            'specs': self.specs,
            'image': image_urls[0],  # Primary image for legacy frontend views
            'images': image_urls,    # Array of all image URLs
            'stock': self.stock,
            'fuelType': self.fuelType,
            'drivetrain': self.drivetrain,
        }
        if self.type == 'sale':
            data.update({
                'make': self.make or 'Other',
                'year': self.year or 2024,
                'price': self.price or 0,
                'mileage': self.mileage or 0,
            })
        else:
            data.update({
                'category': self.category or 'Rental',
                'dailyPrice': self.dailyPrice or 0,
            })
        return data


class CarImage(db.Model):
    __tablename__ = 'car_image'
    id = db.Column(db.Integer, primary_key=True)
    image_url = db.Column(db.String(500), nullable=False)
    car_id = db.Column(db.Integer, db.ForeignKey('car.id'), nullable=False)


# Automatically initialize table structure
with app.app_context():
    db.create_all()


@app.errorhandler(413)
def request_entity_too_large(error):
    return (
        jsonify({
            'success': False,
            'message': (
                'Total file size too large. Please upload files smaller than 25MB total.'
            ),
        }),
        413,
    )


def parse_int(val, default=0):
    try:
        return int(val) if val is not None and str(val).strip() != '' else default
    except (ValueError, TypeError):
        return default


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
        if username == ADMIN_USERNAME and check_password_hash(
            ADMIN_PASSWORD_HASH, password
        ):
            session['admin_logged_in'] = True
            return redirect(url_for('admin_page'))
        return render_template('login.html', error='Invalid credentials')
    return render_template('login.html')


@app.route('/logout')
def logout():
    session.pop('admin_logged_in', None)
    return redirect(url_for('index'))


@app.route('/api/cars', methods=['GET'])
def get_cars():
    cars = Car.query.all()
    return jsonify([car.to_dict() for car in cars])


@app.route('/api/cars', methods=['POST'])
def add_car():
    if not session.get('admin_logged_in'):
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401

    car_type = request.form.get('type', 'sale').strip()

    new_car = Car(
        type=car_type,
        title=request.form.get('title', '').strip(),
        specs=request.form.get('specs', '').strip(),
        fuelType=request.form.get('fuelType', 'Gasoline').strip(),
        drivetrain=request.form.get('drivetrain', 'AWD').strip(),
        stock=parse_int(request.form.get('stock'), 1),
    )

    if car_type == 'sale':
        new_car.make = request.form.get('make', 'Other').strip()
        new_car.year = parse_int(request.form.get('year'), 2024)
        new_car.price = parse_int(request.form.get('price'), 0)
        new_car.mileage = parse_int(request.form.get('mileage'), 0)
    else:
        new_car.category = request.form.get('category', 'Rental').strip()
        new_car.dailyPrice = parse_int(request.form.get('dailyPrice'), 0)

    db.session.add(new_car)
    db.session.flush()  # Generates new_car.id before binding images

    # Handle multiple image uploads
    uploaded_files = request.files.getlist('images')
    if not uploaded_files or not uploaded_files[0].filename:
        # Check single file fallback
        if 'image' in request.files and request.files['image'].filename:
            uploaded_files = [request.files['image']]

    first_image_url = None
    has_uploaded_images = False

    for file in uploaded_files:
        if file and file.filename:
            try:
                upload_result = cloudinary.uploader.upload(
                    file, folder='drivenation_cars'
                )
                img_url = upload_result.get('secure_url')
                if img_url:
                    if not first_image_url:
                        first_image_url = img_url
                    db.session.add(CarImage(image_url=img_url, car_id=new_car.id))
                    has_uploaded_images = True
            except Exception as e:
                db.session.rollback()
                return (
                    jsonify({
                        'success': False,
                        'message': f'Cloudinary upload failed: {str(e)}',
                    }),
                    500,
                )

    # Fallback to URL input or default placeholder
    if not has_uploaded_images:
        fallback_url = request.form.get('image', '').strip() or '/static/placeholder.jpg'
        new_car.image = fallback_url
        db.session.add(CarImage(image_url=fallback_url, car_id=new_car.id))
    else:
        new_car.image = first_image_url

    db.session.commit()
    return jsonify({'success': True, 'car': new_car.to_dict()})


@app.route('/api/cars/<int:car_id>', methods=['DELETE'])
def delete_car(car_id):
    if not session.get('admin_logged_in'):
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401

    car = Car.query.get(car_id)
    if not car:
        return jsonify({'success': False, 'message': 'Vehicle not found'}), 404

    db.session.delete(car)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Vehicle deleted'})

@app.route('/admin/reset-db')
def reset_db():
    if not session.get('admin_logged_in'):
        return redirect(url_for('login'))
    
    db.drop_all()
    db.create_all()
    return "Database schema recreated successfully! <a href='/admin'>Return to Admin Panel</a>"


if __name__ == '__main__':
    app.run(debug=True)