from pypdf import PdfReader


class PdfReaderManager:
    @staticmethod
    def load_file(data):
        text = ""
        reader = PdfReader(data)

        for i, page in enumerate(reader.pages):
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"

        return text
