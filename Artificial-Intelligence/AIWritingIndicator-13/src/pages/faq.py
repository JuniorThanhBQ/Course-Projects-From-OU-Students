import streamlit as st

from utils.utils import init_page, render_footer

init_page("Tài liệu hướng dẫn | OUEL")

st.markdown("""
<div class="guide-wrapper-light">
    <div class="header-light">
        <div class="badge-light">KỶ NGUYÊN SỐ</div>
        <h1 class="hero-text-light">AI News <span class="gradient-text-blue">Indicator</span></h1>
        <p class="description-light">Hướng dẫn sử dụng hệ thống AI News Indicator cho sinh viên trường Đại học Mở TP.HCM.</p>
    </div>
""", unsafe_allow_html=True)

steps_data = [
    {
        "id": "01",
        "title": "CHUẨN BỊ",
        "summary": "Truy cập vào trang AI News Detector để kiểm tra văn bản bài báo thực tế.",
        "points": [
            "Truy cập trang AI News Detector",
            "Vào mục Kiểm Tra AI",
            "Thưực hiện bước 02"
        ]
    },
    {
        "id": "02",
        "title": "PHƯƠNG THỨC KIỂM ĐỊNH",
        "summary": "Tải lên nội dung cần đánh giá độ thuần thục và nguồn gốc.",
        "points": [
            "Dán văn bản trực tiếp",
            "Tải tệp tin PDF/Word (Không bao gồm hình ảnh)",
            "Xác nhận bắt đầu quá trình phân tích"
        ]
    },
    {
        "id": "03",
        "title": "KẾT QUẢ CHỈ SỐ AI",
        "summary": "Hệ thống sẽ tiến hành tách và xử lý nội dung Input. Kết quả sẽ là chỉ số AI trong văn bản và kết luận",
        "points": [
            "Mức độ dự đoán AI (Tính bằng %)",
            "Kết luận văn bản do AI hoặc con người viết"
        ]
    }, {
        "id": "04",
        "title": "Lưu trữ kết quả",
        "summary": "Kết quả sẽ được hệ thống lưu trữ trong một khoảng thời gian trước khi xoá",
        "points": [
            "Người dùng có thể lưu kết quả về file",
            "Hỗ trợ xuất báo cáo file docx",
        ]
    }
]

faqs = [
    {
        "question": "Yêu cầu độ dài tối thiểu và tối đa?",
        "answer": "Văn bản nên có độ dài ngắn nhất là 256 từ, dài nhất 1000 từ để thuật toán phân tích được cấu trúc câu tốt nhất."
    },
    {
        "question": "Hệ thống có lưu bài viết không?",
        "answer": "Dữ liệu chỉ lưu tạm thời trong phiên làm việc và được xóa ngay sau khi đóng trình duyệt."
    },
    {
        "question": "Hệ thống hỗ trợ ngôn ngữ nào?",
        "answer": "Hiện tại hệ thống chỉ hỗ trợ tiếng Việt."
    },
    {
        "question": "Mất bao lâu để trả về kết quả?",
        "answer": "Thời gian phân tích trung bình dao động từ 5 đến 10 giây tùy thuộc vào độ dài của văn bản."
    }
]


def render_step_light(num, title, text, points):
    col1, col2 = st.columns([1.2, 1], gap="large", vertical_alignment="center")

    with col1:
        st.markdown(f"""
        <div class="step-num-light">{num}</div>
        <div class="step-box-light">
            <h2 class="step-title-light">{title}</h2>
            <p class="step-summary-light">{text}</p>
            <div class="point-item-light">
                {"".join([f'<div class="point-item-light">{p}</div>' for p in points])}
            </div>
        </div>
        """, unsafe_allow_html=True)
    with col2:
        st.markdown(f"""
        <div class="ui-mockup-light">
            <div class="mockup-indicator">ẢNH HƯỚNG DẪN {num}</div>
            <div class="mockup-line"></div>
            <div class="mockup-line" style="width: 60%;"></div>
            <div class="mockup-btn"></div>
        </div>
        """, unsafe_allow_html=True)


def render_steps():
    for i, step in enumerate(steps_data):
        render_step_light(
            step["id"],
            step["title"],
            step["summary"],
            step["points"]
        )

        if i < len(steps_data) - 1:
            st.markdown('<div class="spacer-light" style="height: 80px;"></div>', unsafe_allow_html=True)


def render_faqs(faq_data, num_cols=2):
    for i in range(0, len(faq_data), num_cols):
        columns = st.columns(num_cols)
        row_items = faq_data[i: i + num_cols]

        for col, item in zip(columns, row_items):
            with col:
                with st.expander(item["question"]):
                    st.write(item["answer"])


cols = st.columns(4)
navs = ["01 CHUẨN BỊ", "02 KIỂM ĐỊNH", "03 KẾT QUẢ", "04 LƯU TRỮ"]
for i, name in enumerate(navs):
    cols[i].markdown(f'<div class="nav-item-light">{name}</div>', unsafe_allow_html=True)

for i in range(0, 3):
    st.write("")

render_steps()
st.markdown("<h2 class='faq-header-light' style='margin-top: 40px;'>GIẢI ĐÁP THẮC MẮC</h2>", unsafe_allow_html=True)
render_faqs(faqs)
render_footer()
