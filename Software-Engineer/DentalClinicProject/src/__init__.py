import os
import cloudinary
from dotenv import load_dotenv
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from pathlib import Path
from urllib.parse import quote
from flask_babel import Babel
from authlib.integrations.flask_client import OAuth

#env
env_path = Path(__file__).resolve().parent.parent / '.env'
if env_path.exists():
    load_dotenv(env_path)
else:
    print("Lỗi: Chưa tồn tại file env!")

#App config
app = Flask(__name__)
DB_PASS = quote(str(os.getenv('DB_PASSWORD')))
app.secret_key = os.getenv("SECRET_KEY")
app.config[
    "SQLALCHEMY_DATABASE_URI"] = f"mysql+pymysql://{os.getenv('DB_USER')}:{DB_PASS}@localhost/{os.getenv('DB_NAME')}?charset=utf8mb4"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = True
app.config["PAGE_SIZE"] = 2
db = SQLAlchemy(app)
login = LoginManager(app)

#Localization
def get_locale():
    return 'vi'
babel = Babel(app, locale_selector=get_locale)

#Cloudinary
cloudinary.config(cloud_name=os.getenv("CLOUDINARY_API_NAME"),api_key=os.getenv("CLOUDINARY_API_KEY"),
                  api_secret=os.getenv("CLOUDINARY_API_SECRETKEY"))

#Google OAuth2
oauth = OAuth(app)
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')
CONF_URL = 'https://accounts.google.com/.well-known/openid-configuration'
oauth.register(
    name='google',
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    server_metadata_url=CONF_URL,
    client_kwargs={
        'scope': 'openid email profile'
    }
)
