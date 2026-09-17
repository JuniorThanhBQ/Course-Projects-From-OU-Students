# AI Writing Indicator

---

## I. Mô tả

Dự án "AI Writing Indicator" thuộc bài toán phân loại nhị phân. Mục tiêu là huấn luyện một mô hình có khả năng đánh giá
mức độ sử dụng trí tuệ nhân tạo trong tạo sinh văn bản thuộc lĩnh vực báo trí và kết luận đúng văn bản/bài báo đó do AI
hoặc nguời viết.
Ngôn ngữ của mô hình là tiếng Việt.

---

## II. Thành viên nhóm

| MSSV       | Họ tên             | Vai trò     | Nhiệm vụ                                                                                                                                          |
|------------|--------------------|-------------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| 2351050111 | Đào Thị Kim Ngân   | Thành viên  | Xây dựng code templates, dựng các pipeline quy trình và thực hiện xử lý dữ liệu và huấn luyện mô hình                                             |
| 2351050133 | Nguyễn Thanh Phong | Thành viên  | Phát triển ứng dụng và tích hợp mô hình vào hệ thống. Xây dựng bộ kiểm thử ứng dụng để test hiệu quả thực tế mô hình                              |
| 2351050164 | Văn Trung Thành    | Trưởng nhóm | Phân tích lý thuyết và đề ra các bước thực hiện đề tài. Thu thập dữ liệu và hỗ trợ bước xử lý - huấn luyện mô hình. Đánh giá và tổng kết mô hình. |

---

## III. Tài nguyên sử dụng

- **Framework**: Streamlit
- **Lưu trữ model, dataset**: HuggingFace
- **Môi trường Notebook**: Google Colab
- **Dataset gốc**: ICCIES-2025-DetectAI/vietnamese_news_human_ai
- **Mô hình huấn luyện** (không trọng số): ViBERT và LSTM
- **Mô hình fine-tune** (có trọng số): PhoBERT
- **Quản lý phiên bản**: Github

---

## IV. Hướng dẫn ứng dụng
### 1. Khởi tạo và chạy
<pre>
- Đứng tại thư mục gốc /AIWritingIndicator
- Mở Git bash
- Nhập "chmod +x run_streamlit.sh"
- Nhập "source run_streamlit.sh"
</pre>
### 2. Chạy ứng dụng
<pre>
- Đứng tại thư mục gốc /AIWritingIndicator
- Mở Command Prompt
- venv\Scripts\Activate (với Windows)
- cd src
- streamlit run main.py
</pre>
### 3. Truy cập ứng dụng
<pre>
- Local URL: http://localhost:8501
- Network URL: http://192.168.1.2:8501
</pre>
### 4. Kiểm thử ứng dụng (chưa có)
<pre>
- Đứng tại thư mục gốc /AIWritingIndicator
- Mở Command Prompt
- venv\Scripts\Activate (với Windows)
- cd src/test
- python test_tools.py
</pre>

---

## V. Demo
- [Videos demo](https://drive.google.com/drive/u/0/folders/1BVbH_WtRwYL6I-k_UYHpFzbQI4x9o5oC)
- [Images demo](https://drive.google.com/drive/u/0/folders/1KnI1r4ohItFuDT7zW_XjOdAShVwcwYC8)

---

## VI. Tài liệu

- [Các README streamlit](docs/streamlit)
- [Các README models](docs/models)
- [Các README data](docs/data)
- [Sản phẩm của nhóm](https://drive.google.com/drive/u/0/folders/1p7XzVhdrkYSfHFNE1ingXyEY0EVP63oa)
- [Github của nhóm](https://github.com/JuniorThanhBQ/AIWritingIndicator-13)