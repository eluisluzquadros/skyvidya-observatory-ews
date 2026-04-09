import os
import PyPDF2

pdf_dir = r"C:\Users\eluzq\workspace\s2id-disaster-monitor\docs\edital-ics"
for f in os.listdir(pdf_dir):
    if f.endswith('.pdf'):
        pdf_path = os.path.join(pdf_dir, f)
        txt_path = os.path.join(pdf_dir, f.replace('.pdf', '.txt'))
        try:
            with open(pdf_path, 'rb') as file:
                reader = PyPDF2.PdfReader(file)
                text = ''
                for page in reader.pages:
                    extracted = page.extract_text()
                    if extracted:
                        text += extracted + '\n'
            with open(txt_path, 'w', encoding='utf-8') as out:
                out.write(text)
            print(f"Extracted {f} to {txt_path}")
        except Exception as e:
            print(f"Error extracting {f}: {e}")
