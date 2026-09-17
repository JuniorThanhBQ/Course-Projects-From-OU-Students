from datetime import datetime
from src import db, app
from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime, Enum, Float, Text, Date, BigInteger
from sqlalchemy.orm import relationship
from flask_login import UserMixin
from enum import Enum as RoleEnum

class AppointmentStatus(RoleEnum):
    NOT_DONE = 1
    DONE = 2

class GenderRole(RoleEnum):
    MALE = 1
    FEMALE = 2
    OTHER = 3

class MedicineUnit(RoleEnum):
    PILL = 1
    PACK = 2

class MedicalServiceRole(RoleEnum):
    EXAMINE = 1
    TREATMENT = 2

class ServiceRole(RoleEnum):
    MEDICAL = 1
    MEDICINE = 2

class UserRole(RoleEnum):
    PATIENT = 1
    RECEPTIONIST = 2
    DOCTOR = 3
    CASHIER = 4
    ADMINISTRATOR = 5

class Base(db.Model):
    __abstract__ = True
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False, default='')
    created_date = Column(DateTime, default=datetime.now())

    def __str__(self):
        return self.name

class User(Base):
    __tablename__ = 'user'
    address = Column(String(500), nullable=True)
    avatar = Column(String(500), nullable=True,
                    default="https://diemchuan.net/uploads/worigin/2022/07/13/truongdaihocmotphcm_1.png")
    birthday = Column(Date, nullable=True)
    email = Column(String(200), nullable=True, unique=True)
    gender = Column(Enum(GenderRole), default=GenderRole.OTHER)
    phone = Column(BigInteger, nullable=True)
    role = Column(Enum(UserRole), default=UserRole.PATIENT)
    account = relationship('Account', backref='user', lazy=True, uselist=False)

    @property
    def is_patient(self):
        return self.role == UserRole.PATIENT

    @property
    def is_doctor(self):
        return self.role == UserRole.DOCTOR

    @property
    def is_cashier(self):
        return self.role == UserRole.CASHIER

    @property
    def is_receptionist(self):
        return self.role == UserRole.RECEPTIONIST

    @property
    def is_administrator(self):
        return self.role == UserRole.ADMINISTRATOR

    @property
    def is_male(self):
        return self.gender == GenderRole.MALE

    @property
    def is_female(self):
        return self.gender  == GenderRole.FEMALE

class Doctor(User):
    __tablename__ = 'doctor'
    id = Column(Integer, ForeignKey('user.id'), primary_key=True)
    degree = Column(String(200), nullable=True)
    experience = Column(Integer, default=0)
    title = Column(String(200), nullable=False)
    appointments = relationship('Appointment', backref='doctor', lazy=True)

class Cashier(User):
    __tablename__ = 'cashier'
    id = Column(Integer, ForeignKey('user.id'), primary_key=True)
    title = Column(String(200), nullable=False)
    receipt = relationship('Receipt', backref="cashier", lazy=True)

class Patient(User):
    __tablename__ = 'patient'
    id = Column(Integer, ForeignKey('user.id'), primary_key=True)
    pathology = Column(String(500), nullable=True)
    appointments = relationship('Appointment', backref='patient', lazy=True)

class Account(Base, UserMixin):
    __tablename__ = 'account'
    username = Column(String(200), unique=True, nullable=False)
    password = Column(String(500), nullable=False)
    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)

    def __str__(self):
        return self.username

class Service(db.Model):
    __tablename__ = 'service'
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), unique=True, nullable=False)
    note = Column(Text, nullable=True)
    price = Column(Float, default=0.0)
    type = Column(Enum(ServiceRole), default=ServiceRole.MEDICAL)
    created_date = Column(DateTime, default=datetime.now())
    receipt_info = relationship('ReceiptInfo', backref='service', lazy=True)

    def __str__(self):
        return self.name

class MedicalService(Service):
    __tablename__ = 'medical_service'
    id = Column(Integer, ForeignKey('service.id'), primary_key=True)
    medical_type = Column(Enum(MedicalServiceRole), default=MedicalServiceRole.EXAMINE)
    appointments = relationship('Appointment', backref='medical_service', lazy=True)
    treatment_record = relationship('TreatmentServices', backref="medical_service")

    @property
    def vat(self):
        return self.price * (10/100)

    @property
    def total(self):
        return self.price + self.vat

class Category(db.Model):
    __tablename__ = 'category'
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(300), unique=True, nullable=False)
    content = Column(String(500))
    created_date = Column(DateTime, default=datetime.now())
    medicines = relationship('Medicine', backref='category', lazy=True)

    def __str__(self):
        return self.name

class Medicine(Service):
    __tablename__ = 'medicine'
    id = Column(Integer, ForeignKey('service.id'), primary_key=True)
    unit = Column(Enum(MedicineUnit), default=MedicineUnit.PILL)
    quantity = Column(Integer, default=1, nullable=False)
    expiry = Column(Date, nullable=False)
    category_id = Column(Integer, ForeignKey('category.id'), nullable=False)
    medicine_record_info = relationship('MedicineRecordInfo', backref="medicine", lazy=True)

class Appointment(Base):
    __tablename__ = 'appointment'
    content = Column(Text)
    appointment_date = Column(DateTime, default=datetime.now())
    status = Column(Enum(AppointmentStatus), default=AppointmentStatus.NOT_DONE)
    doctor_id = Column(Integer, ForeignKey('doctor.id'), nullable=False)
    patient_id = Column(Integer, ForeignKey('patient.id'), nullable=False)
    medical_service_id = Column(Integer, ForeignKey('medical_service.id'), nullable=False)
    treatment_record = relationship('TreatmentRecord', backref='appointment', lazy=True, uselist=False)

    def __str__(self):
        return self.name

class TreatmentRecord(Base):
    __tablename__ = 'treatment_record'
    content = Column(Text)
    active = Column(Boolean, default=False)
    appointment_id = Column(Integer, ForeignKey('appointment.id'), nullable=False)
    services = relationship('TreatmentServices', backref="treatment_record")
    medicine_record = relationship('MedicineRecord', backref="treatment_record", lazy=True, uselist=False)
    receipt = relationship('Receipt', backref="treatment_record", lazy=True, uselist=False)

    def __str__(self):
        return self.name

class TreatmentServices(Base):
    note = Column(Text, nullable=True)
    medical_service_id = Column(Integer, ForeignKey('medical_service.id'), nullable=False)
    treatment_record_id = Column(Integer, ForeignKey('treatment_record.id'), nullable=False)

    def __str__(self):
        return self.medical_service.name

class MedicineRecord(Base):
    __tablename__ = 'medicine_record'
    content = Column(Text)
    treatment_record_id = Column(Integer, ForeignKey('treatment_record.id'), nullable=False)
    medicine_record_info = relationship('MedicineRecordInfo', backref="medicine_record", lazy=True)

    def __str__(self):
        return self.name

class MedicineRecordInfo(Base):
    __tablename__ = 'medicine_record_info'
    quantity = Column(Integer, default=0, nullable=False)
    guide = Column(String(300), nullable=False)
    medicine_id = Column(Integer, ForeignKey('medicine.id'), nullable=False)
    medicine_record_id = Column(Integer, ForeignKey('medicine_record.id'), nullable=False)

    def __str__(self):
        return f"{self.medicine.name} - {self.medicine_record.content}"

    @property
    def vat(self):
        return (self.medicine.price * self.quantity) * (10/100)

    @property
    def total(self):
        return (self.medicine.price * self.quantity) + self.vat

class Receipt(Base):
    __tablename__ = 'receipt'
    content = Column(Text)
    payment_date = Column(DateTime, nullable=True)
    treatment_record_id = Column(Integer, ForeignKey('treatment_record.id'), nullable=False)
    cashier_id = Column(Integer, ForeignKey('cashier.id'), nullable=False)
    receipt_info = relationship('ReceiptInfo', backref='receipt', lazy=True)

    def __str__(self):
        return self.name

    @property
    def total_pay_amount(self):
        return sum(item.subtotal for item in self.receipt_info)

    @property
    def total_pay_display(self):
        return "{:,.0f} VNĐ".format(self.total_pay_amount)

class ReceiptInfo(Base):
    __tablename__ = 'receipt_info'
    unit_price = Column(Float, default=0.0)
    quantity = Column(Integer, default=1, nullable=False)
    receipt_id = Column(Integer, ForeignKey('receipt.id'), nullable=False)
    service_id = Column(Integer, ForeignKey('service.id'), nullable=False)

    def __str__(self):
        return f"{self.service.name} - {self.receipt.content}"

    @property
    def is_medical(self):
        return self.service.type == ServiceRole.MEDICAL

    @property
    def subtotal(self):
        return self.quantity * self.unit_price

    @property
    def total_price(self):
        return "{:,.0f} VNĐ".format(self.subtotal)

if __name__ == "__main__":
    with app.app_context():
        try:
            db.create_all()
            print("Khởi tạo Model thành công")
        except Exception as e:
            print(f"Lỗi khởi tạo Model trong database: {e}")
