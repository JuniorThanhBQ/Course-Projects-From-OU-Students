from datetime import datetime
from src.models import (Account, GenderRole, User, Doctor, Patient, Medicine, Appointment, TreatmentRecord,
    TreatmentServices, MedicineRecord, MedicineRecordInfo, Receipt, ReceiptInfo, UserRole, AppointmentStatus,
    MedicalService, MedicalServiceRole)
from src import app, db, utils
from sqlalchemy import cast, Date, insert
from flask_login import current_user

def auth_account(username, password):
    password = utils.hashlib_password(password)
    return Account.query.filter(Account.username.__eq__(username), Account.password.__eq__(password)).first()

def add_account(username, password, user_id):
    password = utils.hashlib_password(password)
    account = Account(username=username, password=password, user_id=user_id)
    db.session.add(account)
    db.session.commit()
    return account

def get_exist_account(username=None, email = None):
    account = None
    if username:
        account = Account.query.filter(Account.username.__eq__(username)).first()
    if email:
        account = Account.query.join(User).filter(User.email.__eq__(email)).first()
    return account

def get_account_by_id(account_id):
    return Account.query.get(account_id)

def add_user(name, gender=GenderRole.OTHER, email=None,avatar=None, birthday=None, phone=None):
    user = User(name=name, email=email, birthday=birthday, avatar=avatar, phone=phone, gender=gender)
    db.session.add(user)
    db.session.commit()
    return user

def get_user(email=None, user_id = None):
    if user_id:
        return User.query.filter(User.id.__eq__(user_id)).first()
    if email:
        return User.query.filter(User.email.__eq__(email)).first()
    return None

def update_user(account, username, password=None):
    account.username = username
    if password:
        password = utils.hashlib_password(password)
        account.password = password

    db.session.add(account)
    db.session.commit()

def update_user_info(user, name=None, birthday=None, address=None, phone=None, email=None, path_file=None, gender=None):
    if name:
        user.name = name
    if birthday:
        user.birthday = birthday
    if address:
        user.address = address
    if phone:
        user.phone = phone
    if email:
        user.email = email
    if path_file:
        user.avatar = path_file
    if gender:
        user.gender = GenderRole[gender]

    db.session.add(user)
    db.session.commit()
    return user

def update_user_to_patient(user, pathology=None):
    patient = insert(Patient.__table__).values(
        id=user.id,
        pathology=pathology,
    )
    db.session.execute(patient)
    db.session.commit()
    return patient

def add_patient(name, birthday, gender,email=None, address=None, pathology=None, phone=None):
    user = get_user(email=email)

    if user:
        patient = update_user_to_patient(user,pathology)
    else:
        patient = Patient(name=name, email=email, birthday=birthday, gender=gender, address=address, role=UserRole.PATIENT,phone=phone,
                          pathology=pathology)

    db.session.add(patient)
    db.session.commit()
    return patient

def get_patient(email=None, patient_id=None, appointment_id=None):
    if email:
        return Patient.query.filter(Patient.email.__eq__(email)).first()

    if patient_id:
        return Patient.query.get(patient_id)

    if appointment_id:
        return (Patient.query.join(Appointment, Appointment.patient_id == Patient.id)
              .join(TreatmentRecord, TreatmentRecord.appointment_id == Appointment.id)
                .filter(TreatmentRecord.appointment_id == appointment_id).first())

    return None

def get_medical_services():
    return MedicalService.query.filter(MedicalService.medical_type == MedicalServiceRole.TREATMENT).all()

def load_medical_service():
    return MedicalService.query.filter(MedicalService.medical_type == MedicalServiceRole.EXAMINE).all()

def add_appointment(patient_id, doctor_id, service_id, date_book, content):
    date = date_book.strftime("%d/%m/%Y")
    name = f"Lịch khám: {patient_id}-{service_id}-{date}"
    appointment = Appointment(name=name,patient_id=patient_id, doctor_id=doctor_id, medical_service_id=service_id,
                              appointment_date=date_book, content=content, status=AppointmentStatus.NOT_DONE)
    db.session.add(appointment)
    db.session.commit()
    return appointment

def check_appointment(doctor_id, date_book):
    count_doctor_appointment = Appointment.query.filter(Appointment.doctor_id == doctor_id,cast(Appointment.appointment_date, Date) == date_book.date()).count()
    is_duplicate = Appointment.query.filter(Appointment.doctor_id == doctor_id,Appointment.appointment_date == date_book).first()

    if count_doctor_appointment == 5:
        return "Bác sĩ đã đủ 5 lịch hẹn/ngày. Vui lòng chọn ngày khác!"

    if is_duplicate:
        return "Trùng lịch. Vui lòng đặt lịch khác"

    return False

def get_appointment(appointment_id=None, user=None, doctor=None):
   if appointment_id:
      return Appointment.query.get(appointment_id)

   if user:
      return Appointment.query.filter(Appointment.patient_id.__eq__(user.id))

   return Appointment.query.filter(Appointment.doctor_id.__eq__(doctor.id))

def get_appointment_service(treatment_record):
    appointment = Appointment.query.filter(Appointment.treatment_record.__eq__(treatment_record)).first()
    appointment_service = MedicalService.query.filter(appointment.medical_service_id == MedicalService.id)
    return appointment_service.first()

def count_appointment(doctor=None, user=None, get_all=None):
    if get_all:
       return Appointment.query.count()

    return get_appointment(doctor=doctor, user=user).count()

def load_appointment(get_all=False, user=None, doctor=None, search=None, page=None):
    appointments = Appointment.query
    if get_all or search:

        if search:
            if current_user.user.is_receptionist or current_user.user.is_doctor:
                appointments = appointments.join(Patient, Appointment.patient_id == Patient.id).filter((Appointment.name.icontains(search)) | (Patient.name.icontains(search)))
            else:
                appointments = appointments.join(Patient, Appointment.patient_id == Patient.id).filter((Patient.name.__eq__(search)))

        if page:
            size = 3
            start = (int(page) - 1) * size
            appointments = appointments.slice(start, start + size)

        return appointments.all()

    if user:
        appointments = get_appointment(user=user)

    if doctor:
        appointments = get_appointment(doctor=doctor).filter(Appointment.status != AppointmentStatus.DONE)

    if page:
        size = app.config["PAGE_SIZE"]
        start = (int(page) - 1) * size
        appointments = appointments.slice(start, start + size)

    return appointments.all()

def is_patient_appointment(appointment_id):
    appointment = Appointment.query.get(appointment_id)

    if appointment.patient_id == current_user.id:
        return True
    return False

def delete_appointment_by_id(appointment_id):
    appointment = Appointment.query.get(appointment_id)

    if appointment.status.name == "DONE":
        raise ValueError("Hành vi xóa lịch đã khám chỉ được phép ở trang quản lý!")

    db.session.delete(appointment)
    db.session.commit()

def add_receipt(appointment_service=None,treatment_services=None,medicine_record_info=None,treatment_record_id=None, cashier_id=None):
    name = f'Hóa đơn của phiếu: {treatment_record_id}'
    treatment = TreatmentRecord.query.get(treatment_record_id)

    if not treatment:
        return None

    receipt = Receipt(name=name,payment_date=datetime.now(), treatment_record_id=treatment_record_id, cashier_id=cashier_id)
    db.session.add(receipt)
    db.session.flush()

    if appointment_service:
        receipt_info = ReceiptInfo(name=name, quantity=1, unit_price=appointment_service.total, receipt_id=receipt.id,service_id=appointment_service.id)
        db.session.add(receipt_info)

    if treatment_services:
        for services in treatment_services:
            receipt_info = ReceiptInfo(name=name, quantity=1, unit_price=services.medical_service.total, receipt_id=receipt.id,service_id=services.medical_service_id)
            db.session.add(receipt_info)

    if medicine_record_info:
        for medicine_info in medicine_record_info:
            receipt_info = ReceiptInfo(name=name, quantity=1, unit_price=medicine_info.total,
                                       receipt_id=receipt.id, service_id=medicine_info.medicine_id)
            db.session.add(receipt_info)

    try:
        treatment.active = True
        db.session.commit()
        return receipt
    except Exception as ex:
        print(ex)
        db.session.rollback()

    return None

def load_doctor():
    return Doctor.query.all()

def add_treatment_record(appointment_id = None, content = None, treatment_services = None, medicines = None, note = None):
    name = f'Phiếu điều trị lịch {appointment_id}'
    if note:
        content = f'{content}. Lý do không kê toa: {note}'
    record = TreatmentRecord(name=name,content=content, appointment_id=appointment_id, active=False)
    db.session.add(record)

    if treatment_services:
        db.session.flush()
        for service in treatment_services:
            ts = TreatmentServices(
                treatment_record_id=record.id,
                medical_service_id=service['id'],
                note=service['note']
            )
            db.session.add(ts)

    try:
        appointment = Appointment.query.get(appointment_id)
        appointment.status = AppointmentStatus.DONE
        db.session.commit()

        if medicines:
            add_medicine_record(record.id, medicines)

        return record
    except Exception as ex:
        print(ex)
        db.session.rollback()

    return None

def get_treatment_record(user=None, treatment_record_id=None):
    if user:
        return TreatmentRecord.query.join(Appointment).filter(Appointment.patient_id == user.id).order_by(-Appointment.appointment_date)
    return TreatmentRecord.query.get(treatment_record_id)

def count_treatment_record(user):
    return get_treatment_record(user=user).count()

def load_treatment_record(user=None,search=None, page=None):
    if search:
        records = (TreatmentRecord.query.join(Appointment, Appointment.id == TreatmentRecord.appointment_id)
            .join(Patient, Patient.id == Appointment.patient_id)
            .filter(Patient.name.__eq__(search) | Appointment.name.icontains(search) | TreatmentRecord.name.icontains(search)).all())
        return records

    if user:
        records = get_treatment_record(user=user)

        if page:
            size = app.config["PAGE_SIZE"]
            start = (int(page) - 1) * size
            records = records.slice(start, start + size)
    else:
        return []

    return records.all()

def get_treatment_services(treatment_record_id):
    return TreatmentServices.query.filter(TreatmentServices.treatment_record_id == treatment_record_id).all()

def add_medicine_record(treatment_record_id, medicine_list):
    record = MedicineRecord.query.filter_by(treatment_record_id=treatment_record_id).first()

    if not record:
        name = f"Toa thuốc của phiếu {treatment_record_id}"
        record = MedicineRecord(name=name, treatment_record_id=treatment_record_id, content=name)
        db.session.add(record)
        db.session.flush()

    for m in medicine_list:
        detail = MedicineRecordInfo(medicine_id=m['id'], quantity=m['quantity'], guide=m['guide'],
                                    medicine_record_id=record.id)
        db.session.add(detail)

        medicine = Medicine.query.get(m['id'])
        if medicine:
            medicine.quantity -= int(m['quantity'])

    try:
        db.session.commit()
        return True
    except Exception as e:
        db.session.rollback()
        print(f"Lỗi: {e}")

    return False

def get_medicine_record_info(treatment_record_id):
    medicine_record = MedicineRecord.query.filter(MedicineRecord.treatment_record_id == treatment_record_id).first()
    if medicine_record:
        medicine_record_info = MedicineRecordInfo.query.filter(MedicineRecordInfo.medicine_record_id == medicine_record.id).all()
        return medicine_record_info
    return None

def get_medicince():
    return Medicine.query.filter().all()

def is_medicines_valid(medicines_data):
    category_id = None

    for item in medicines_data:
        medicine_id = item['id']
        quantity = item['quantity']
        if quantity <= 0:
           return "Số lượng thuốc phải lớn hơn 0"

        db_medicine = Medicine.query.get(medicine_id)

        if quantity > db_medicine.quantity:
           return f"Thuốc '{db_medicine.name}' không đủ số lượng để kê đơn (Tồn kho: {db_medicine.quantity})."

        if category_id is None:
            category_id = db_medicine.category_id
        else:
            if db_medicine.category_id != category_id:
               return "Phát hiện hai thuốc không cùng danh mục"

    return None

def get_receipt(user):
    receipts = ((Receipt.query.join(TreatmentRecord, Receipt.treatment_record_id == TreatmentRecord.id)
                .join(Appointment, TreatmentRecord.appointment_id == Appointment.id))
                .filter(Appointment.patient_id == user.id))
    return receipts

def get_receipts_by_date():
    receipts = Receipt.query.order_by(-Receipt.payment_date).all()
    return receipts

def count_receipt(user):
    return get_receipt(user).count()

def load_receipt(user=None,search=None, page=None):
    if user:
        receipts = get_receipt(user)

        if search:
            receipts = receipts.filter(Receipt.name.icontains(search))

        if page:
            size = app.config["PAGE_SIZE"]
            start = (int(page) - 1) * size
            receipts = receipts.slice(start, start + size)
    else:
        return []

    return receipts.all()

def get_doctor_receipt():
    results = (Doctor.query.join(Appointment, Appointment.doctor_id == Doctor.id)
               .join(TreatmentRecord, TreatmentRecord.appointment_id == Appointment.id)
               .join(Receipt, Receipt.treatment_record_id == TreatmentRecord.id)
               .with_entities(Doctor, Receipt).all())
    return results

if __name__ == "__main__":
    with app.app_context():
        pass
