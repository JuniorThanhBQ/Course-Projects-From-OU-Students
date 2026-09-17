#!/bin/bash
echo "I. Kiểm tra môi trường ảo dự án"
if [ -d "venv" ]; then
  echo "- Đã có môi trường ảo venv"
else
  python -m venv venv
  echo "- Đã tạo môi trường ảo mới"
fi

echo -e "\nII. Khởi động venv"
if [[ "$OSTYPE" == "darwin"* ]]; then
    source venv/bin/activate
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    source venv/Scripts/activate
else
    echo "Lỗi"
fi

echo -e "\nIII. Kiểm tra gói thư viện"
if [ -f "requirements.txt" ]; then
  pip install -r requirements.txt
else
  echo "Không tim thấy file requirements!"
fi

echo -e "\nIV. Kiểm tra file env"
if [ -f ".env" ]; then
  echo "Đã có file env"
else
  echo "" >> .env
  echo "SECRET_KEY='asjdahjsdaskdjahsd%#adsd'

CLOUDINARY_API_NAME=''
CLOUDINARY_API_KEY=''
CLOUDINARY_API_SECRETKEY=''

GOOGLE_CLIENT_ID=''
GOOGLE_CLIENT_SECRET=''

DB_NAME=''
DB_USER=''
DB_PASSWORD=''

DEBUG_MODE='True'" >> .env_example
  echo "Đã tạo file env rỗng. Vui lòng cấu hình lại file env!"
fi

echo -e "\nĐã khởi tạo xong."