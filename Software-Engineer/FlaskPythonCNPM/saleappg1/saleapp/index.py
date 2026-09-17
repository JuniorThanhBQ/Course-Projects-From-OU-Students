import math
from flask import render_template, request
import dao
from saleapp import app


@app.route("/")
def index():
    q = request.args.get("q")
    cate_id = request.args.get("cate_id")
    prods = dao.load_products(q=q, cate_id=cate_id)
    pages = math.ceil(dao.count_product()/3)
    return render_template("index.html", prods=prods, pages=pages)

@app.route("/products/<int:id>")
def details(id):
    prod = dao.get_product_by_id(id)
    return render_template("product-details.html", prod=prod)

@app.context_processor
def common_attribute():
    return {
        "cates": dao.load_categories()
    }

if __name__=="__main__":
    with app.app_context():
        app.run(debug=True)