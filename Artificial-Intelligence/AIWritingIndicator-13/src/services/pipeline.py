import re


class PipelineManager:
    @staticmethod
    def input_processing(text):
        pattern = r'[^a-zA-Z0-9\sàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệđìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆĐÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ.,!?():;\-\'\" ]'
        text = text.strip()
        text = re.sub(pattern, '', text)
        text = re.sub(r'\s+', ' ', text)

        return text.strip()

    @staticmethod
    def output_processing(text, clf, st):
        raw = clf(text)

        result = raw[0][0] if isinstance(raw[0], list) else raw[0]

        label_map = {
            "LABEL_1": "Văn bản do AI tạo",
            "LABEL_0": "Văn bản do con người viết"
        }

        label = label_map.get(result["label"], result["label"])
        confidence = result["score"] * 100

        st.divider()
        st.subheader("Kết quả phân tích")

        if result["label"] == "LABEL_1":
            st.error(f"**{label}**")
            st.progress(result["score"])
        else:
            st.success(f"**{label}**")
            st.progress(result["score"])

        st.write(f"Độ tin cậy: **{confidence:.2f}%**")
