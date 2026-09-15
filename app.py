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
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024

db = SQLAlchemy(app)

# Database Model
class Car(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    type = db.Column(db.String(20), default='sale')
    title = db.Column(db.String(100), nullable=False)
    specs = db.Column(db.String(200))
    image = db.Column(db.String(500))
    fuelType = db.Column(db.String(50), default='Gasoline')
    drivetrain = db.Column(db.String(50), default='AWD')
    make = db.Column(db.String(50))
    year = db.Column(db.Integer)
    price = db.Column(db.Integer)
    mileage = db.Column(db.Integer)
    category = db.Column(db.String(50))
    dailyPrice = db.Column(db.Integer)

    def to_dict(self):
        data = {
            'id': self.id,
            'type': self.type,
            'title': self.title,
            'specs': self.specs,
            'image': self.image,
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

# Automatically initialize table structure
with app.app_context():
    db.create_all()


@app.errorhandler(413)
def request_entity_too_large(error):
  return (
      jsonify({
          'success': False,
          'message': (
              'File size too large. Please upload an image smaller than 10MB.'
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

  # Direct upload to Cloudinary CDN
  image_path = '/static/placeholder.jpg'
  if 'image' in request.files and request.files['image'].filename:
    file = request.files['image']
    try:
      upload_result = cloudinary.uploader.upload(
          file, folder='drivenation_cars'
      )
      image_path = upload_result.get('secure_url', image_path)
    except Exception as e:
      return (
          jsonify({
              'success': False,
              'message': f'Cloudinary upload failed: {str(e)}',
          }),
          500,
      )
  elif request.form.get('image'):
    image_path = request.form.get('image').strip()

  car_type = request.form.get('type', 'sale').strip()

  new_car = Car(
      type=car_type,
      title=request.form.get('title', '').strip(),
      specs=request.form.get('specs', '').strip(),
      image=image_path,
      fuelType=request.form.get('fuelType', 'Gasoline').strip(),
      drivetrain=request.form.get('drivetrain', 'AWD').strip(),
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


if __name__ == '__main__':
  app.run(debug=True)