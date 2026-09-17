#!/bin/bash

read -p "Xác nhận đang đứng ở /AIWritingIndicator-13 (Y/N): " confirm


if [[ "$confirm" != [yY] ]]; then
    echo "Vui lòng đứng ở thư mục gốc!"
    exit 1
fi


if [ ! -d "venv" ]; then
    python -m venv venv
else
    echo "Đã có môi trường ảo!"
fi


if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
elif [ -f "venv/Scripts/activate" ]; then
    source venv/Scripts/activate
else
    echo "Lỗi kích hoạt môi trường ảo!"
    exit 1
fi


if [ -f "src/requirements/requirements.txt" ]; then
    pip install -r src/requirements/requirements.txt
else
    pip install streamlit
fi


cd src
streamlit run main.py