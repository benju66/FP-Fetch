import base64
import os
import tempfile
from pdf_converter import convert_to_pdf

def process_payload(payload: dict) -> dict:
    """
    Decodes the base64 file, triggers the PDF conversion, and routes it to OneDrive.
    """
    try:
        file_name = payload.get("fileName")
        base64_data = payload.get("fileData")
        target_directory = payload.get("targetDirectory")  # e.g., .../OneDrive/Projects/1024 - Orchard Path III/Bids/Quotes/
        final_pdf_name = payload.get("finalPdfName")  # e.g., 03-0000 - Concrete - North Construction.pdf

        if not all([file_name, base64_data, target_directory, final_pdf_name]):
            return {"status": "error", "message": "Missing required payload data."}

        # 1. Ensure target directory exists
        os.makedirs(target_directory, exist_ok=True)
        final_pdf_path = os.path.join(target_directory, final_pdf_name)

        # 2. Decode the Base64 string to a temporary file
        temp_dir = tempfile.gettempdir()
        temp_input_path = os.path.join(temp_dir, file_name)

        # Split off the "data:application/vnd.openxmlformats...;base64," header if present
        if "," in base64_data:
            base64_data = base64_data.split(",")[1]

        with open(temp_input_path, "wb") as f:
            f.write(base64.b64decode(base64_data))

        # 3. Convert to PDF
        success = convert_to_pdf(temp_input_path, final_pdf_path)

        # 4. Clean up the temp docx file
        if os.path.exists(temp_input_path):
            os.remove(temp_input_path)

        if success:
            return {"status": "success", "message": f"Successfully saved to {final_pdf_path}"}
        else:
            return {"status": "error", "message": "PDF Conversion failed via COM Interop."}

    except Exception as e:
        return {"status": "error", "message": str(e)}
