# Dự án Flask App cho Dental Clinic 
## I. Thành viên nhóm: 
1. Văn Trung Thành 
2. Nguễn Thanh Phong

## II. Công cụ, lib và framework sử dụng:
+ Flask
+ Pycharm
+ MySQL
+ Các Lib chính: 
  + Flask: Các thư viện quan trọng của Flask
  + Flask-admin: thư viện flask admin
  + Flask-login: thư viện flask login
  + Flask-sqlAlchemy: thư viện hỗ trợ tạo truy vấn MySQL cho Flask 
  + Cloudinary: Lưu trữ ảnh/video trên cloud 
  + Pymysql: Kết nối mysql 
  + Dotenv: Thao tác với .env 
  + OAuth2: Xác thực google token 

## III. Hướng dẫn cài đặt ở máy mới
+ Bước 1: Đứng ở thư mục DentalClinicProject 
+ Bước 2: Mở git bash trong terminal (Alt+F12)
+ Bước 3: Nhập chmod +x setup.sh
+ Bước 4: Nhập source ./setup.sh
+ Bước 5: Vào file .env và chỉnh lại tên, user, mật khẩu database
+ Bước 6: Mở MySQL và tạo database tương ứng
+ Bước 7: Vào pycharm settings --> Chỉnh lại python interpreter 
+ Bước 8: Python interpreter --> Add interpreter --> Select existing --> DentalClinicProject/venv/Scripts/python.exe
+ Bước 9: Chạy file models.py
+ Bước 10: Chạy file data.py để thêm dữ liệu mẫu
+ Bước 10: Chạy file index.py

## IV. Lời cảm ơn
Cảm ơn mọi người đã dành thời gian