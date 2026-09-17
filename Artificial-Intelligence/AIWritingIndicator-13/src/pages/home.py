import streamlit as st

from utils.utils import init_page, render_footer

init_page("AI News Indicator")

st.markdown("""
<div class="main-wrapper">
    <div class="header-section">
        <p class="eyebrow">HCMC-OU • AI DETECTOR PROJECT</p>
        <h1 class="main-title">AI NEWS<br><span class="text-outline">INDICATOR</span></h1>
        <p class="sub-text">Hệ thống với khả năng phân tích ngôn ngữ tự nhiên, xác định độ tin cậy và phân loại văn bản báo trí có sử dụng trí tuệ nhân tạo bằng mô hình Deep Learning.</p>
    </div>
""", unsafe_allow_html=True)

st.write("")
col1, col2 = st.columns(2, gap="medium")

with col1:
    st.markdown("""
    <div class="glass-card">
        <div class="card-num">01</div>
        <div class="card-content">
            <h3>NHẬP VĂN BẢN</h3>
            <p>Kiểm tra trực tiếp các đoạn văn bản ngắn hoặc bài luận. Nhận kết quả phân tích theo thời gian thực với biểu đồ chi tiết.</p>
            <a href="/detector" target="_self" class="action-link" style="text-decoration: none;">
            BẮT ĐẦU PHÂN TÍCH →
            </a>
        </div>
    </div>
    """, unsafe_allow_html=True)

with col2:
    st.markdown("""
    <div class="glass-card">
        <div class="card-num">02</div>
        <div class="card-content">
            <h3>XỬ LÝ TỆP TIN</h3>
            <p>Hỗ trợ quét tệp PDF, DOCX. Hệ thống tự động bóc tách nội dung và chèn vào khung nhập liệu. Tối ưu hoá trải nghiệm người dùng</p>
            <a href="/detector" target="_self" class="action-link" style="text-decoration: none;">
                TẢI TỆP LÊN →
            </a>
        </div>
    </div>
    """, unsafe_allow_html=True)

render_footer()
