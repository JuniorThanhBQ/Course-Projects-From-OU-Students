cd ../

#Xử lý môi trường ảo
if [ -f "venv/Scripts/activate" ]; then
    echo "Đã cài đặt môi trường ảo"
else
    echo "Chưa cài đặt môi trường ảo"
    echo "Tiến hành cài đặt môi trường ảo"
    python -m venv venv
fi

#Đi vào thư mục chứa dự án Django
cd OpenUniversityLMS_Server || exit

source ../venv/Scripts/activate

echo "=== cài đặt thư viện từ requirements.txt ==="
pip install -r requirements.txt

echo "=== Thực thi migrate cơ sở dữ liệu ==="
if python manage.py migrate; then
    echo "=== Tạo superuser ==="
    export DJANGO_SUPERUSER_USERNAME=admin
    export DJANGO_SUPERUSER_EMAIL=admin@example.com
    export DJANGO_SUPERUSER_PASSWORD=Admin@123

    python manage.py createsuperuser --no-input || echo "SuperUser đã tồn tại!"

#    echo "=== Chèn dữ liệu mẫu ==="
#    python manage.py shell
#    exec(open('Data.py', encoding='utf-8').read())

    echo "=== Chạy server Django ==="
    python manage.py runserver
else
    echo "Vui lòng kiểm tra lại cấu hình Database trong MySQL và Setting!"
fi
