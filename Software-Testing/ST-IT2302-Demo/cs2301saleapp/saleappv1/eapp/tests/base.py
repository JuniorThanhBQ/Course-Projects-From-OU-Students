import pytest
from flask import Flask
from eapp.extensions import db
from eapp.extensions import login
from eapp.index import register_routes


def create_app():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["PAGE_SIZE"] = 2
    app.config["TESTING"] = True
    app.secret_key = '34y394yjsbdkjsdjksdh#b37hex59@_2!'
    db.init_app(app)
    login.init_app(app)

    register_routes(app=app)

    return app


@pytest.fixture
def test_app():
    app = create_app()

    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()
        db.engine.dispose()


@pytest.fixture
def test_session(test_app):
    with test_app.app_context():
        yield db.session
        db.session.rollback()
        db.session.remove()


@pytest.fixture
def test_client(test_app):
    return test_app.test_client()
