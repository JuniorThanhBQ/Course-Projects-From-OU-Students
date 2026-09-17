import json
from src.models import Account, User, Doctor, Cashier, Patient, MedicalService, Category, Medicine
from src import db, app, utils

if __name__ == "__main__":
    with app.app_context():
        def load_data(path,model):
            with open(path, encoding="utf-8") as f:
                data = json.load(f)

                for i in data:
                    if model == Account:
                        i['password'] = utils.hashlib_password(i['password'])

                    model_object = model(**i)
                    db.session.add(model_object)

        try:
            load_data("data/category.json", Category)
            load_data("data/medical_services.json", MedicalService)
            load_data("data/user.json", User)
            load_data("data/doctor.json", Doctor)
            load_data("data/cashier.json", Cashier)
            load_data("data/patient.json", Patient)
            load_data("data/account.json", Account)
            load_data("data/medicine.json", Medicine)

            db.session.commit()
            print("Đã import các file data thành công")
        except Exception as e:
            db.session.rollback()
            print(f"Lỗi trong thêm dữ liệu: {e}")


