from flask_admin import Admin
from flask_admin.theme import Bootstrap4Theme
from flask_admin.contrib.sqla import ModelView
from models import Category,Product
from saleapp import app, db

admin = Admin(app=app, name="E-COMMERCIAL", theme=Bootstrap4Theme())

admin.add_view(ModelView(Category,db.session))

admin.add_view(ModelView(Product,db.session))