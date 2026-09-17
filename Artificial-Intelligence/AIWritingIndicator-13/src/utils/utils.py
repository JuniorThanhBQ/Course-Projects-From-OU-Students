import os
import streamlit as st
from PIL import Image


def init_page(title):
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) 
    icon_path = os.path.join(BASE_DIR, "assets", "icons.png")
    icon = Image.open(icon_path)

    st.set_page_config(
        page_title=title,
        page_icon=icon,
        layout="wide"
    )

    css_path = os.path.join(BASE_DIR, "assets", "css", "styles.css")
    try:
        with open(css_path) as f:
            st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)
    except FileNotFoundError:
        pass


def render_footer():
    st.markdown("""
        <div class="footer-minimal">
            <div class="footer-content">
                <span>© 2026 OUEL PROJECT</span>
                <span class="dot">•</span>
                <span>DEVELOPED BY OU STUDENTS</span>
            </div>
        </div>
    """, unsafe_allow_html=True)
