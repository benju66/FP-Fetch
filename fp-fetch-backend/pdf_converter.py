import win32com.client
import os
import pythoncom

def convert_to_pdf(input_path: str, output_path: str) -> bool:
    """
    Safely converts a Word document to PDF using an isolated COM instance.
    Returns True if successful, False otherwise.
    """
    word = None
    doc = None

    # Required when running COM objects in background threads or listeners
    pythoncom.CoInitialize()

    try:
        # DispatchEx creates a completely independent, invisible instance of Word
        word = win32com.client.DispatchEx("Word.Application")
        word.Visible = False
        word.DisplayAlerts = False  # Prevent popup dialogs from hanging the script

        # Open the document
        doc = word.Documents.Open(os.path.abspath(input_path))

        # Save as PDF (Format 17 is wdFormatPDF)
        doc.SaveAs(os.path.abspath(output_path), FileFormat=17)
        return True

    except Exception:
        # In a production app, we would log this to a file
        return False

    finally:
        # Cleanup is critical to prevent ghost 'WINWORD.EXE' processes
        if doc:
            doc.Close(SaveChanges=False)
        if word:
            word.Quit()
        pythoncom.CoUninitialize()
