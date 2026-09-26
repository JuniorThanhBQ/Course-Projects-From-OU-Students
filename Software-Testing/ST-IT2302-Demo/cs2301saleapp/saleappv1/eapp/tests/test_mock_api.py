from .base import test_client, test_app


def test_pay_success(test_client, mocker):
    class FakeUser:
        is_authenticated = True

    mocker.patch("flask_login.utils._get_user", return_value=FakeUser())
    mocker.patch("eapp.dao.current_user", new=FakeUser())

    with test_client.session_transaction() as sess:
        sess["cart"] = {
            "1": {"id": 1, "price": 100, "quantity": 2}
        }

    mock_add = mocker.patch("eapp.dao.add_receipt")
    response = test_client.post("/api/pay")

    assert response.status_code == 200
    assert response.get_json()["status"] == 200

    with test_client.session_transaction() as sess:
        assert 'cart' not in sess

    mock_add.assert_called_once()

def test_pay_fail_no_login(test_client, mocker):
    with test_client.session_transaction() as sess:
        sess["cart"] = {
            "1": {"id": 1, "price": 100, "quantity": 2}
        }

    mock_add = mocker.patch("eapp.dao.add_receipt")
    response = test_client.post("/api/pay")

    data = response.get_json()
    assert data["status"] == 400
    assert data['err_msg'] == 'DB ERROR'

    with test_client.session_transaction() as sess:
        assert 'cart' in sess

    mock_add.assert_called_once()

def test_pay_fail(test_client, mocker):
    class FakeUser:
        is_authenticated = True

    mocker.patch("flask_login.utils._get_user", return_value=FakeUser())
    mocker.patch("eapp.dao.current_user", new=FakeUser())

    with test_client.session_transaction() as sess:
        sess["cart"] = {
            "1": {"id": 1, "price": 100, "quantity": 2}
        }

    mock_add = mocker.patch("eapp.dao.add_receipt", side_effect=Exception("DB ERROR"))
    response = test_client.post("/api/pay")

    data = response.get_json()
    assert data["status"] == 400
    assert data['err_msg'] == 'DB ERROR'

    with test_client.session_transaction() as sess:
        assert 'cart' in sess

    mock_add.assert_called_once()
