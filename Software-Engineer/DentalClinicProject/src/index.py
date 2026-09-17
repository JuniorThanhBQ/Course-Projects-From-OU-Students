import dao, cloudinary.uploader, os, uuid, math
from flask import render_template, request, redirect, url_for
from src import app, login, db, oauth, utils, admin
from src.decorators import anonymous_required, Local, Google
from flask_login import login_user, current_user, logout_user
from datetime import datetime, timedelta

@login.user_loader
def get_account(account_id):
    return dao.get_account_by_id(account_id=account_id)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/login", methods=["get", "post"])
@anonymous_required
def login_my_user():
    err_msg = None
    if request.method.__eq__("POST"):
        auth_strategy = Local()
        account = auth_strategy.auth()

        if account:
            login_user(account)
            return redirect("/")
        else:
            err_msg = "Tài khoản hoặc mật khẩu không đúng!"

    return render_template("components/login.html", err_msg=err_msg)

@app.route("/login-admin", methods=["post"])
def login_admin_process():
    auth_strategy = Local()
    account = auth_strategy.auth()

    if account:
        login_user(account)
        return redirect("/admin")
    else:
        err_msg = "Tài khoản hoặc mật khẩu không đúng!"

    return render_template("components/login.html", err_msg=err_msg)

@app.route("/register", methods=['get', 'post'])
def register():
    err_msg = None
    if request.method.__eq__("POST"):
        password = request.form.get("password")
        confirm = request.form.get("confirm")

        if password.__eq__(confirm):
            username = request.form.get("username").strip()
            email = request.form.get("Email").lower().strip()

            if dao.get_exist_account(username=username, email=email):
                err_msg = "Tài khoản đã tồn tại"
            else:
                user = dao.get_user(email=email)
                if user:
                    dao.add_account(username, password, user.id)
                    return redirect("/login")
                else:
                    firstname = request.form.get('FirstName').strip()
                    lastname = request.form.get('LastName').strip()
                    name = f"{lastname} {firstname}"
                    avatar = None

                    try:
                        profile = dao.add_user(name, email, avatar)
                        dao.add_account(username, password, profile.id)
                        return redirect('/login')
                    except Exception as e:
                        db.session.rollback()
                        err_msg = "Hệ thống đang bị lỗi! Vui lòng quay lại sau!"
                        print(f"Thông tin lỗi: {e}")
        else:
            err_msg = "Mật khẩu không khớp!"

    return render_template("components/register.html", err_msg=err_msg)

@app.route('/google/login')
def google_login():
    redirect_uri = url_for('google_auth_login', _external=True)
    return oauth.google.authorize_redirect(redirect_uri)

@app.route('/google/auth_login')
def google_auth_login():
    auth_strategy = Google()
    account = auth_strategy.auth()

    if account:
        login_user(account)
        return redirect("/")
    else:
        err_msg = "Hãy thử đăng kí tài khoản"

    return render_template("components/register.html", err_msg=err_msg)

@app.route('/google/register')
def google_register():
    redirect_uri = url_for('google_auth_register', _external=True)
    return oauth.google.authorize_redirect(redirect_uri)

@app.route('/google/auth_register')
def google_auth_register():
    try:
        token = oauth.google.authorize_access_token()
        google_account = oauth.google.parse_id_token(token, token['userinfo']['nonce'])
    except Exception as e:
        err_msg = "Có vấn đề trong việc đăng ký tài khoản"
        print(f"Lỗi đăng ký google: {e}")
        return render_template("components/register.html", err_msg=err_msg)

    account = dao.get_exist_account(email=google_account['email'])

    if account:
        login_user(account)
        return redirect("/")
    else:
        username = google_account["email"]
        password = str(uuid.uuid4())
        email = google_account['email']
        user = dao.get_user(email=email)

        if user:
            account = dao.add_account(username, password, user.id)
            login_user(account)
            return redirect("/")
        else:
            firstname = google_account['given_name']
            lastname = google_account['family_name']
            name = f"{lastname} {firstname}"
            avatar = google_account['picture']

            try:
                profile = dao.add_user(name=name, email=email, avatar=avatar)
                account = dao.add_account(username, password, profile.id)
                login_user(account)
                return redirect("/")
            except Exception as e:
                db.session.rollback()
                err_msg = "Hệ thống đang bị lỗi! Vui lòng quay lại sau!"
                print(f"Thông tin lỗi: {e}")

    return render_template("components/login.html", err_msg=err_msg)

@app.route("/logout")
def logout_my_user():
    logout_user()
    return redirect('/login')

@app.route('/Dashboard')
def dashboard():
    return render_template('components/dashboard/Dashboard.html', TongQuan=True, now=datetime.now())

@app.route('/Dashboard/QuanLyCaNhan')
def dashboard_user():
    return render_template('components/dashboard/Dashboard.html', QuanLyCaNhan=True, now=datetime.now())

@app.route('/Dashboard/QuanLyTaiKhoan')
def dashboard_account():
    return render_template('components/dashboard/Dashboard.html', QuanLyTaiKhoan=True, now=datetime.now())

@app.route('/CapNhatTK', methods=['get', 'post'])
def update_account_information():
    err_msg = None
    if request.method.__eq__("POST"):
        username = request.form.get("username").strip()
        if username:
            current_password = request.form.get("current_password")
            if current_password:
                account = dao.auth_account(current_user.username, current_password)
                if account:
                    password = request.form.get("password")
                    confirm = request.form.get("confirm")
                    if password.__eq__(confirm):
                        try:
                            dao.update_user(account,username, password)
                            return redirect('/Dashboard/QuanLyTaiKhoan')
                        except Exception as e:
                            db.session.rollback()
                            err_msg = "Hệ thống đang bị lỗi! Vui lòng quay lại sau!"
                            print(f"Thông tin lỗi: {e}")
                    else:
                        err_msg = "Hai ô mật khẩu mới không thể khác nhau!"
                else:
                    err_msg = "Không thể cập nhật do sai tài khoản hoặc mật khẩu"
            else:
                err_msg = "Phải nhập mật khẩu hiện tại!"
        else:
            err_msg = "Phải nhập username để có thể cập nhật!"

    return render_template("components/Dashboard/CapNhat.html", CapNhat=True, err_msg=err_msg, CapNhatTK=True)


@app.route('/CapNhatTT', methods=['get', 'post'])
def update_user_information():
    err_msg = None
    today = datetime.today().strftime('%Y-%m-%d')
    if request.method.__eq__("POST"):
        birthday = request.form.get("birth")

        if birthday:
            birthday = datetime.strptime(birthday, '%Y-%m-%d').date()
            age = datetime.now().year - birthday.year
            if age >= 6:
                name = request.form.get("name").strip()
                address = request.form.get("address").strip()
                phone = request.form.get("phone")
                email = request.form.get("email").lower().strip()
                avatar = request.files.get('avatar')
                gender = request.form.get("gender")
                path_file = None

                if avatar:
                    res = cloudinary.uploader.upload(avatar)
                    path_file = res['secure_url']

                try:
                    dao.update_user_info(user=current_user.user,name=name,birthday=birthday,address=address, phone=phone, email=email, path_file=path_file, gender=gender)
                    return redirect('/Dashboard/QuanLyCaNhan')
                except Exception as e:
                    db.session.rollback()
                    err_msg = "Có vấn đề xảy ra!"
                    print(f"Thông tin lỗi: {e}")
            else:
                err_msg = "Bạn phải ít nhất từ 6 tuổi trở lên!"

    return render_template("components/Dashboard/CapNhat.html", CapNhat=True, err_msg=err_msg, CapNhatTK=False, today=today)


@app.route('/Datlich', methods=['GET', 'POST'])
def create_appointment():
    if current_user.is_authenticated:
        err_msg = None
        success_msg = None
        today = (datetime.today() + timedelta(days=1)).strftime('%Y-%m-%d')
        doctors = dao.load_doctor()
        services = dao.load_medical_service()

        if request.method == "POST":
            name = request.form.get("name").strip()
            email = request.form.get("email").strip()
            if email == "":
                email = None

            phone = request.form.get("phone")
            gender = request.form.get("gender")
            pathology = request.form.get("pathology")

            patient = dao.get_patient(email=email)
            birthday = datetime.fromisoformat(request.form.get("birthday"))

            if patient is None:
                try:
                    patient = dao.add_patient(name=name,email=email, birthday=birthday,phone=phone,gender=gender, pathology=pathology)
                    if patient is None:
                        raise Exception("Lỗi trong việc chuyển đổi user có sẵn")
                except Exception as e:
                    db.session.rollback()
                    print(f"Lỗi tạo user: {e}")
                    return render_template('components/receptionist_patient/DatLichKham.html', err_msg="Hệ thống đang bị lỗi! Vui lòng thử lại sau!",doctors=doctors, services=services)
            else:
                if patient.name != name:
                    return render_template('components/receptionist_patient/DatLichKham.html', err_msg="Email đã được sử dụng cho hồ sơ khác. Vui lòng điền email khác hoặc bỏ trống",
                                           doctors=doctors, services=services)

                if phone or birthday:
                    try:
                        dao.update_user_info(user=patient, phone=phone, birthday=birthday, gender=gender)
                    except Exception as e:
                        db.session.rollback()
                        err_msg = "Lỗi trong việc gán số điện thoại hoặc ngày sinh!"
                        print(f"Thông tin lỗi: {e}")

            doctor_id = int(request.form.get("doctor"))
            service_id = int(request.form.get("service"))

            date = datetime.fromisoformat(request.form.get("date"))
            time = request.form.get("time")
            date_book = utils.process_date_appointment(date,time)
            validate_appointment = dao.check_appointment(doctor_id, date_book)

            if validate_appointment:
                 err_msg = validate_appointment
            else:
                try:
                    content = request.form.get("content")
                    dao.add_appointment(patient_id=patient.id,doctor_id=doctor_id, service_id=service_id,date_book=date_book, content=content)
                    success_msg = "Đặt lịch khám thành công"
                except Exception as e:
                    db.session.rollback()
                    print(f"Lỗi trong đặt lịch khám: {e}")
                    err_msg = "Hệ thống đang bị lỗi! Vui lòng quay lại sau!"

        return render_template('components/receptionist_patient/DatLichKham.html', err_msg=err_msg,doctors=doctors, services=services, today=today, success_msg=success_msg)
    return redirect('/login')

@app.route('/TimBacSi')
def search_doctor():
    return render_template('components/receptionist_patient/TimBacSi.html', doctor=dao.load_doctor())

@app.route('/XemLich/<int:user_id>')
def get_user_appointments(user_id):
    search = request.args.get("search")
    page = request.args.get("page")

    if page is None:
        page = "1"

    if user_id == 0:
        if current_user.user.is_receptionist or current_user.user.is_cashier:
            user_number = 0
            appointments = dao.load_appointment(get_all=True, search=search, page=page)
            pages = math.ceil(dao.count_appointment(get_all=True) / 3)
            return render_template("components/patient/XemLich.html", user_number=user_number,
                                   appointments=appointments, pages=pages)
        else:
            return redirect(f"/XemLich/{current_user.id}")
    else:
        if current_user.user.is_doctor:
            user = dao.get_user(user_id=user_id)
            appointments = dao.load_appointment(doctor=user, search=search, page=page)
            pages = math.ceil(dao.count_appointment(doctor=user) / app.config["PAGE_SIZE"])

        else:
            user = dao.get_user(user_id=user_id)
            appointments = dao.load_appointment(user=user, search=search, page=page)
            pages = math.ceil(dao.count_appointment(user=user) / app.config["PAGE_SIZE"])

        user_number = user.id

    return render_template("components/patient/XemLich.html", user_number=user_number, appointments=appointments, pages=pages)

@app.route('/XemPhieu/<int:user_id>')
def get_patient_treatment_records(user_id):
    search = request.args.get("search")
    page = request.args.get("page")
    user = dao.get_user(user_id=user_id)

    if page is None:
        page = "1"

    records = dao.load_treatment_record(user=user,search=search, page=page)
    pages = math.ceil(dao.count_treatment_record(user=user) / app.config["PAGE_SIZE"])
    return render_template("components/patient/XemPhieu.html", user=user, records=records, pages=pages)

@app.route('/XemHoaDon/<int:user_id>')
def get_patient_receipts(user_id):
    search = request.args.get("search")
    page = request.args.get("page")
    user = dao.get_user(user_id=user_id)

    if page is None:
        page = "1"

    receipts = dao.load_receipt(user=user,search=search, page=page)
    pages = math.ceil(dao.count_receipt(user=user) / app.config["PAGE_SIZE"])
    return render_template("components/patient/XemHoaDon.html",user=user, receipts=receipts, pages=pages)

@app.route('/HuyLich/<int:appointment_id>',  methods=['GET','DELETE'] )
def delete_appointment(appointment_id):
    if request.method == "DELETE":
        if not current_user.is_authenticated:
            return '',401

        if not (current_user.user.is_receptionist or current_user.user.is_patient):
            return '', 401

        if current_user.user.is_patient:
            is_valid = dao.is_patient_appointment(appointment_id)
            if not is_valid:
                return '', 403

        try:
            dao.delete_appointment_by_id(appointment_id)
            return '', 200
        except Exception as e:
            db.session.rollback()
            print(f"Có vấn đề trong việc xóa lịch qua API: {e}")
            return '', 500

    return render_template("components/receptionist_patient/HuyLich.html",appointment_id=appointment_id)

@app.route('/LapPhieuDieuTri', methods=['get'])
def load_treatment_record_page():
    appointment = None
    medical_services = dao.get_medical_services()
    appointments = dao.load_appointment(doctor=current_user.user)

    return render_template("components/doctor/LapPhieuDieuTri.html",
                           appointments=appointments, appointment=appointment, services=medical_services)

@app.route('/LapPhieuDieuTri/<int:appointment_id>', methods=['GET', 'POST'])
def create_treatment_record(appointment_id):
    if not current_user.user.is_doctor:
        return redirect('/')

    appointment = dao.get_appointment(appointment_id=appointment_id)
    medical_services = dao.get_medical_services()
    appointments = dao.load_appointment(doctor=current_user.user)
    medicines = dao.get_medicince()
    success = None
    err_msg = None

    if request.method == 'POST':
        content = request.form.get('content')
        s_ids = request.form.getlist('service_ids[]')

        if not s_ids:
            err_msg = "Cảnh báo: chọn ít nhất một dịch vụ điều trị"
            return render_template("components/doctor/LapPhieuDieuTri.html",
                                   appointments=appointments,
                                   services=medical_services,
                                   appointment=appointment,
                                   medicines=medicines, err_msg=err_msg, success=success)

        notes = request.form.getlist('notes[]')
        services_data = []

        for sid, note in zip(s_ids, notes):
            services_data.append({
                'id': int(sid),
                'note': note.strip()
            })

        medicines_data = []
        ke_toa = request.form.get('keToa')
        no_medicine_reason = None

        if ke_toa:
            m_ids = request.form.getlist('medicine_ids[]')

            if not m_ids:
                err_msg = "Cảnh báo: chọn ít nhất một thuốc"
                return render_template("components/doctor/LapPhieuDieuTri.html",
                                       appointments=appointments,
                                       services=medical_services,
                                       appointment=appointment,
                                       medicines=medicines, err_msg=err_msg, success=success)

            quantities = request.form.getlist('quantities[]')
            guides = request.form.getlist('guides[]')

            for mid, qty, guide in zip(m_ids, quantities, guides):
                medicines_data.append({
                    'id': int(mid),
                    'quantity': int(qty),
                    'guide': guide.strip()
                })

            validation = dao.is_medicines_valid(medicines_data)

            if validation:
                err_msg = f"Cảnh báo: {validation}"
                return render_template("components/doctor/LapPhieuDieuTri.html",
                                       appointments=appointments,
                                       services=medical_services,
                                       appointment=appointment,
                                       medicines=medicines, err_msg=err_msg, success=success)

        else:
            no_medicine_reason = request.form.get('no_medicine')

        try:
            dao.add_treatment_record(
                appointment_id=appointment_id,
                content=content,
                treatment_services=services_data,
                medicines=medicines_data,
                note=no_medicine_reason
            )
            success = "Tạo phiếu thành công"
        except Exception as e:
            db.session.rollback()
            print(f'Có lỗi xảy ra khi lưu phiếu!: {e}')
            err_msg = "Có lỗi trong tạo phiếu điều trị!"
    return render_template("components/doctor/LapPhieuDieuTri.html",
                           appointments=appointments,
                           services=medical_services,
                           appointment=appointment,
                           medicines=medicines, err_msg=err_msg, success=success)


@app.route('/QuanLyHoaDon', methods=['GET', 'POST'])
def manage_payment():
    if not current_user.user.is_cashier:
        return redirect('/')

    patient = None
    treatment_record = []

    if request.method == "POST":
        patient_appointment_id = request.form.get('patient_appointment_id')
        patient = dao.get_patient(patient_id=patient_appointment_id)

        if patient:
            treatment_record = dao.get_treatment_record(user=patient).all()
        else:
            patient = dao.get_patient(appointment_id=patient_appointment_id)
            treatment_record = dao.get_treatment_record(user=patient).all()

    return render_template(
        "components/cashier/QuanLyHoaDon.html",
        patient=patient, treatment_record=treatment_record
    )

@app.route('/ThanhToanHoaDon/<int:patient_id>/<int:treatment_record_id>', methods=['GET', 'POST'])
def pay_receipt(patient_id,treatment_record_id):
    if not current_user.user.is_cashier:
        return redirect('/')

    err_msg = None
    patient = dao.get_patient(patient_id=patient_id)
    treatment_services = dao.get_treatment_services(treatment_record_id=treatment_record_id)
    treatment_record = dao.get_treatment_record(treatment_record_id=treatment_record_id)
    appointment_service = dao.get_appointment_service(treatment_record=treatment_record)
    medicine_record_info = dao.get_medicine_record_info(treatment_record_id=treatment_record_id)
    total_money = utils.get_total_money(treatment_services=treatment_services,appointment_service=appointment_service,medicine_record_info=medicine_record_info)

    if request.method == "POST":
        patient_pay = request.form.get("patient_pay")
        patient_pay = float(patient_pay) if patient_pay else 0

        if patient_pay.__lt__(total_money):
            err_msg = f"Thanh toán không phù hợp: {patient_pay} < {total_money}"
        else:
            try:
                dao.add_receipt(appointment_service=appointment_service,treatment_services=treatment_services,medicine_record_info=medicine_record_info,
                                treatment_record_id=treatment_record_id, cashier_id=current_user.user.id)
                return redirect(f"/QuanLyHoaDon")
            except Exception as e:
                db.session.rollback()
                print(f'Có lỗi xảy ra khi tạo hóa đơn!: {e}')
                err_msg = "Có lỗi trong tạo hóa đơn!"

    return render_template(
        "components/cashier/ThanhToanHoaDon.html",
        patient=patient,
        treatment_record=treatment_record,
        treatment_services=treatment_services,
        appointment_service=appointment_service,
        medicine_record_info=medicine_record_info,
        total_money=total_money,
        err_msg=err_msg
    )

@app.route('/ThongKeDoanhThu')
def view_report():
    if not current_user.user.is_administrator:
        return redirect('/')

    receipt = dao.get_receipts_by_date()
    return render_template("admin/ThongKeDoanhThu.html", receipts=receipt)

@app.route('/ThongKeDoanhThu/<string:report_type>')
def view_report_type(report_type):
    if not current_user.user.is_administrator:
        return redirect('/')

    receipt = dao.get_receipts_by_date()
    doctor_receipt = None
    if report_type:
        doctor_receipt = dao.get_doctor_receipt()
    return render_template("admin/ThongKeDoanhThu.html", receipts=receipt, type=report_type, doctor_receipt=doctor_receipt)

if __name__ == "__main__":
    app.run(debug=os.getenv('DEBUG_MODE'), port=5000)
