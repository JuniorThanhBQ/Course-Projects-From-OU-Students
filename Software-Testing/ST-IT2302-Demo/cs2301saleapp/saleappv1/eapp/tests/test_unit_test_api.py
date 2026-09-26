import pytest

from eapp.tests.base import test_client, test_app


def client_post_carts(id=None, name=None, price=None, test_client=None):
    return test_client.post("/api/carts", json={
        "id": id,
        "name": name,
        "price": price
    })


def client_update_carts(id=None, quantity=None, test_client=None):
    return test_client.put(f"/api/carts/{id}", json={
        "quantity": quantity
    })


def client_delete_carts(id=None, test_client=None):
    return test_client.delete(f"/api/carts/{id}")


def test_add_to_cart_first_time(test_client):
    response = client_post_carts(id=1, name="Laptop", price=300, test_client=test_client)
    assert response.status_code == 200

    data = response.get_json()

    assert data["total_quantity"] == 1
    assert data["total_amount"] == 300


def test_add_to_cart_second_time(test_client):
    response = client_post_carts(id=1, name="Laptop", price=300, test_client=test_client)
    assert response.status_code == 200

    response = client_post_carts(id=1, name="Laptop", price=300, test_client=test_client)
    assert response.status_code == 200

    response = client_post_carts(id=2, name="abc", price=50, test_client=test_client)
    assert response.status_code == 200

    data = response.get_json()
    assert data["total_quantity"] == 3
    assert data["total_amount"] == 650

    with test_client.session_transaction() as sess:
        assert 'cart' in sess
        assert len(sess['cart']) == 2
        assert sess['cart']['1']['quantity'] == 2


def test_add_to_cart_missing_name_fields(test_client):
    response = client_post_carts(id=1, price=300, test_client=test_client)
    assert response.status_code == 200

    data = response.get_json()
    assert data["total_quantity"] == 1
    assert data["total_amount"] == 300

    with test_client.session_transaction() as sess:
        assert 'cart' in sess
        assert len(sess['cart']) == 1
        assert sess['cart']['1']['name'] is None
        assert sess['cart']['1']['price'] == 300


def test_add_to_cart_missing_price_fields(test_client):
    with pytest.raises(TypeError) as e:
        response = client_post_carts(id=1, name="LOTO", test_client=test_client)

    with test_client.session_transaction() as sess:
        assert 'cart' not in sess


def test_add_existing(test_client):
    with test_client.session_transaction() as sess:
        sess['cart'] = {
            "2": {
                'id': "2",
                'name': 'aaaa',
                'price': 50,
                'quantity': 2
            }
        }

    responses = client_post_carts(id=2, name='aaaa', price=123, test_client=test_client)

    data = responses.get_json()
    assert data['total_quantity'] == 3
    assert data['total_amount'] == 150

    with test_client.session_transaction() as sess:
        assert 'cart' in sess
        assert len(sess['cart']) == 1
        assert sess['cart']['2']['quantity'] == 3


def test_update_to_cart_success(test_client):
    responses = client_post_carts(id=2, name='aaaa', price=100, test_client=test_client)

    update_res = client_update_carts(id=2, quantity=5, test_client=test_client)
    assert update_res.status_code == 200

    data = update_res.get_json()
    assert data['total_quantity'] == 5
    assert data['total_amount'] == 500

    with test_client.session_transaction() as sess:
        assert 'cart' in sess
        assert len(sess['cart']) == 1
        assert sess['cart']['2']['quantity'] == 5


def test_update_to_cart_missing_id(test_client):
    client_post_carts(id=2, name='aaaa', price=100, test_client=test_client)
    update_res = client_update_carts(quantity=5, test_client=test_client)
    assert update_res.status_code == 200

    data = update_res.get_json()
    assert data['total_quantity'] == 1
    assert data['total_amount'] == 100

    with test_client.session_transaction() as sess:
        assert 'cart' in sess
        assert len(sess['cart']) == 1
        assert sess['cart']['2']['quantity'] == 1


def test_update_to_cart_without_cart_session(test_client):
    update_res = client_update_carts(id=2, quantity=5, test_client=test_client)
    assert update_res.status_code == 200

    data = update_res.get_json()
    assert data['total_quantity'] == 0
    assert data['total_amount'] == 0

    with test_client.session_transaction() as sess:
        assert 'cart' in sess
        assert sess['cart'] is None


def test_delete_to_cart_success(test_client):
    client_post_carts(id=2, name='aaaa', price=100, test_client=test_client)
    responses = client_delete_carts(id=2, test_client=test_client)
    assert responses.status_code == 200

    data = responses.get_json()
    assert data['total_quantity'] == 0
    assert data['total_amount'] == 0

    with test_client.session_transaction() as sess:
        assert 'cart' in sess
        assert sess['cart'] == {}


def test_delete_to_cart_non_existed(test_client):
    responses = client_delete_carts(id=2, test_client=test_client)

    with test_client.session_transaction() as sess:
        assert 'cart' in sess
        assert sess['cart'] is None


def test_delete__to_cart_without_id(test_client):
    responses = client_delete_carts(test_client=test_client)

    with test_client.session_transaction() as sess:
        assert 'cart' in sess
        assert sess['cart'] is None
