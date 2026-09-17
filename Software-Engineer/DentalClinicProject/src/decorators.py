from functools import wraps
from flask_login import current_user
from flask import redirect, request
from src import oauth, dao

def anonymous_required(f):
    @wraps(f)
    def decorated_func(*args, **kwargs):
        if current_user.is_authenticated:
            return redirect('/')
        return f(*args, **kwargs)

    return decorated_func

#Auth
class AuthStrategy:
    def auth(self):
        pass

class Local(AuthStrategy):
    def auth(self):
        username = request.form.get("username").strip()
        password = request.form.get("password")
        return dao.auth_account(username, password)

class Google(AuthStrategy):
    def auth(self):
        try:
            token = oauth.google.authorize_access_token()
            google_account = oauth.google.parse_id_token(token, token['userinfo']['nonce'])
        except Exception as e:
            print(f"Lỗi đăng nhập google: {e}")
            return None

        return dao.get_exist_account(email=google_account['email'])