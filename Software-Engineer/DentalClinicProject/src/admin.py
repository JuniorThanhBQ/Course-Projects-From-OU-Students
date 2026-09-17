from flask import redirect, request
from flask_admin import Admin, AdminIndexView, expose, BaseView
from flask_admin.contrib.sqla import ModelView
from flask_admin.form.upload import FileUploadField
from flask_admin.theme import Bootstrap4Theme
from src import app, db, utils
from src.models import (Account, User, Doctor, Cashier, Patient, MedicalService, Category, Medicine,
                        Appointment, TreatmentRecord, TreatmentServices, MedicineRecord, MedicineRecordInfo,
                        Receipt, ReceiptInfo, UserRole)
from flask_login import logout_user, current_user
from wtforms import TextAreaField
from wtforms.widgets import TextArea
import cloudinary.uploader

class MyImage(FileUploadField):
    def populate_obj(self, obj, name):
        avatar = request.files['avatar']

        if avatar:
            res = cloudinary.uploader.upload(avatar)
            setattr(obj, name, res['secure_url'])

class CKTextAreaWidget(TextArea):
    def __call__(self, field, **kwargs):
        if kwargs.get('class'):
            kwargs['class'] += ' ckeditor'
        else:
            kwargs.setdefault('class', 'ckeditor')
        return super(CKTextAreaWidget, self).__call__(field, **kwargs)

class CKTextAreaField(TextAreaField):
    widget = CKTextAreaWidget()

class MyBaseView(ModelView):
    column_display_pk = True
    can_view_details = True
    can_export = True

    column_formatters = {
        'created_date': utils.datetime_formatter
    }

    extra_js = ['//cdn.ckeditor.com/4.6.0/standard/ckeditor.js']
    form_overrides = {
        'content': CKTextAreaField,
        'note': CKTextAreaField,
        'avatar': MyImage
    }

class MyAuthenticatedView(MyBaseView):
    def is_accessible(self) -> bool:
        return current_user.is_authenticated and current_user.user.is_administrator

class MyAccountView(MyAuthenticatedView):
    column_list = ["username", "created_date", "user"]
    column_searchable_list = ['username']
    column_filters = ['username']
    
    column_labels = {
        'username': 'Tên tài khoản',
        'created_date': 'Ngày tạo',
        'user': 'Người dùng',
    }

    def on_model_change(self, form, model, is_created):
        if form.password.data:
            password = utils.hashlib_password(form.password.data)
            model.password = password

    form_excluded_columns = ['created_date', 'name']


class MyUserView(MyAuthenticatedView):
    column_list = ["id", "name","email", "role", "address", "birthday", "phone", "gender"]
    column_searchable_list = ['name']
    column_filters = ['name', "role"]
    column_labels = {
        'name': 'Họ và tên',
        'role': 'Vai trò',
        'birthday': 'Ngày sinh',
        'phone': 'Số điện thoại',
        'gender': 'Giới tính',
        'address': 'Địa chỉ'
    }

    column_formatters = {
        'birthday': utils.date_formatter,
    }

    form_excluded_columns = ['appointments', 'account', 'created_date']


class MyPatientView(MyUserView):
    form_excluded_columns = ['appointments', 'account', 'created_date', 'role']

    def on_model_change(self, form, model, is_created):
        if is_created:
            model.role = UserRole.PATIENT

        return super().on_model_change(form, model, is_created)

    def is_accessible(self) -> bool:
        return current_user.is_authenticated and (current_user.user.is_administrator or current_user.user.is_receptionist)

class MyReadOnlyPatientView(MyUserView):
    can_create = False
    can_edit = False
    can_delete = False
    can_view_details = True

    def is_accessible(self) -> bool:
        return current_user.is_authenticated and (current_user.user.is_doctor or current_user.user.is_cashier)

class MyCashierView(MyUserView):
    form_excluded_columns = ['appointments', 'account', 'created_date', 'role']

    def on_model_change(self, form, model, is_created):
        if is_created:
            model.role = UserRole.CASHIER

        return super().on_model_change(form, model, is_created)

class MyDoctorView(MyUserView):
    def on_model_change(self, form, model, is_created):
        if is_created:
            model.role = UserRole.DOCTOR

        return super().on_model_change(form, model, is_created)


class MyServiceView(MyAuthenticatedView):
    column_searchable_list = ['name']
    column_filters = ['name']

class MyMedicineView(MyServiceView):
    column_list = ["id","name", "price", "note", "unit", "quantity", "expiry"]

    column_labels = {
        'name': 'Tên thuốc',
        'price': 'Giá',
        'note': 'Ghi chú',
        'unit': 'Đơn vị thuốc',
        'quantity': 'Số lượng',
        'expiry': 'Hạn'
    }

    column_formatters = {
        'expiry': utils.datetime_formatter,
    }

    form_excluded_columns = ['created_date', 'receipt_info', 'medicine_record_info', 'type']


class MyCategoryView(MyAuthenticatedView):
    column_list = ["id", "name", "content", "created_date"]

    column_labels = {
        'id': 'Mã',
        'name': 'Tên',
        'content': 'Nội dung',
        'created_date': 'Ngày tạo',
    }

    form_excluded_columns = ['created_date','receipt_info', 'medicine_record_info', 'type', 'medicines']


class MyMedicalServiceView(MyServiceView):
    column_list = ["id", "name", "price", "note"]

    column_labels = {
        'name': 'Tên dịch vụ',
        'price': 'Giá',
        'note': 'Ghi chú',
    }

    form_excluded_columns = ['created_date', 'updated_date', 'treatment_record', 'doctors', 'appointments', 'receipt_info', 'type']


class MyAppointmentView(MyBaseView):
    column_list = ["id", 'name', "doctor", "patient", "medical_service", "content", "status", 'created_date']
    column_filters = ['name', 'doctor.name', 'status']
    column_searchable_list = ['name']

    column_labels = {
        'name': 'Tên lịch',
        'doctor': 'Bác sĩ',
        'patient': 'Bệnh nhân',
        'medical_service': 'Dịch vụ',
        'content': 'Nội dung',
        'status': 'Trạng thái',
        'appointment_date': 'Ngày hẹn',
        'created_date': 'Ngày tạo',
        'doctor.name': 'Tên bác sĩ'
    }

    form_excluded_columns = ['created_date', 'doctors', 'appointments', 'medicine_record_info', 'type','treatment_record','receipt_info']

    def is_accessible(self) -> bool:
        return current_user.is_authenticated and (current_user.user.is_receptionist or current_user.user.is_administrator)


class MyMedicineRecordView(MyAuthenticatedView):
    column_list = ["id", "name", "content", "treatment_record", 'medicine_record_info', "created_date"]
    column_searchable_list = ['name']
    column_labels = {
        'name': 'Tên toa thuốc',
        'content': 'Nội dung',
        'treatment_record': 'Phiếu điều trị',
        'medicine_record_info': 'Danh sách kê đơn ',
        'created_date': 'Ngày tạo'
    }

    form_excluded_columns = ['created_date']
    inline_models = (MedicineRecordInfo,)

    def is_accessible(self) -> bool:
        return current_user.is_authenticated and (current_user.user.is_doctor or current_user.user.is_administrator)


class MyReceiptView(MyBaseView):
    column_list = ["id", "name", "content", "payment_date", 'created_date', 'cashier']
    column_searchable_list = ['name']
    column_labels = {
        'name': 'Tên hóa đơn',
        'content': 'Nội dung',
        'treatment_record': 'Phiếu điều trị',
        'payment_date': 'Ngày thanh toán',
        'cashier': 'Thu ngân',
        'created_date': 'Ngày tạo',
        'active': 'Trạng thái thanh toán'
    }

    column_formatters = {
        'payment_date': utils.datetime_formatter,
    }

    form_excluded_columns = ['created_date']
    inline_models = (ReceiptInfo,)

    def is_accessible(self) -> bool:
        return current_user.is_authenticated and (current_user.user.is_cashier or current_user.user.is_administrator)


class MyTreatmentRecordView(MyBaseView):
    column_list = ["id", "name", "content", "services", "medicine_record", "appointment", "active"]
    column_searchable_list = ['name']
    column_labels = {
        'name': 'Tên phiếu',
        'content': 'Nội dung',
        'doctor': 'Bác sĩ',
        'patient': 'Bệnh nhân',
        'services': 'Các dịch vụ',
        'medicine_record': 'Toa thuốc',
        'appointment': 'Lịch hẹn',
        'created_date': 'Ngày tạo',
        'active': 'Trạng thái thanh toán'
    }
    form_excluded_columns = ['created_date', 'medicine_record', 'services', 'receipt']
    inline_models = (TreatmentServices,)

    def is_accessible(self) -> bool:
        return current_user.is_authenticated and (current_user.user.is_doctor or current_user.user.is_administrator)

class MyReadOnlyTreatmentView(MyTreatmentRecordView):
    can_create = False
    can_edit = False
    can_delete = False
    can_view_details = True

    def is_accessible(self) -> bool:
        return current_user.is_authenticated and current_user.user.is_cashier

class MyAdminIndexView(AdminIndexView):
    @expose('/')
    def index(self) -> str:
        return self.render('admin/index.html')

class MyLogoutView(BaseView):
    @expose("/")
    def index(self):
        logout_user()
        return redirect("/admin")

    def is_accessible(self) -> bool:
        return current_user.is_authenticated

admin = Admin(app=app, name="OU Dental Clinic", theme=Bootstrap4Theme(), index_view=MyAdminIndexView())

admin.add_view(MyAccountView(Account, db.session, name="Tài khoản"))
admin.add_view(MyMedicalServiceView(MedicalService, db.session, name="Dịch vụ"))
admin.add_view(MyAppointmentView(Appointment, db.session, name="Lịch hẹn"))

admin.add_view(MyUserView(User, db.session, category='Quản lý người dùng', name="Hồ sơ/Người dùng"))
admin.add_view(MyPatientView(Patient, db.session, category='Quản lý người dùng', name="Hồ sơ bệnh nhân"))
admin.add_view(MyDoctorView(Doctor, db.session, category='Quản lý người dùng', name="Bác sĩ"))
admin.add_view(MyCashierView(Cashier, db.session, category='Quản lý người dùng', name="Thu ngân"))

admin.add_view(MyMedicineView(Medicine, db.session, category='Quản lý thuốc', name="Thuốc"))
admin.add_view(MyCategoryView(Category, db.session, category='Quản lý thuốc', name="Danh mục thuốc"))

admin.add_view(MyReadOnlyPatientView(Patient,db.session, name="Hồ sơ người bệnh", endpoint='doctor_patient'))
admin.add_view(MyReadOnlyTreatmentView(TreatmentRecord, db.session,name='Phiếu điều trị', endpoint='readonly_treatment_record'))
admin.add_view(MyTreatmentRecordView(TreatmentRecord, db.session, category='Quản lý phiếu khám', name="Phiếu điều trị"))
admin.add_view(MyMedicineRecordView(MedicineRecord, db.session, category='Quản lý phiếu khám', name="Toa thuốc"))
admin.add_view(MyReceiptView(Receipt, db.session, category='Quản lý phiếu khám', name="Hóa đơn"))

admin.add_view(MyLogoutView("Đăng xuất"))
