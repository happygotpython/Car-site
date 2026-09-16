from extensions import db

class Car(db.Model):
    __tablename__ = 'cars'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    price = db.Column(db.Float, nullable=False)
    stock = db.Column(db.Integer, default=1, nullable=False)  # <-- Stock field
    
    # Relationship to hold multiple images
    images = db.relationship('CarImage', backref='car', cascade='all, delete-orphan', lazy=True)

class CarImage(db.Model):
    __tablename__ = 'car_images'
    
    id = db.Column(db.Integer, primary_key=True)
    image_url = db.Column(db.String(255), nullable=False)
    public_id = db.Column(db.String(255), nullable=True)  # For deleting from Cloudinary
    car_id = db.Column(db.Integer, db.ForeignKey('cars.id'), nullable=False)