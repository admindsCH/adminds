---
name: No Docling/Azure Document Intelligence for schema extraction
description: Docling and Azure Document Intelligence cannot be used for template field extraction because they don't know ff_index positions needed by the DOCX filler
type: feedback
---

Do NOT suggest Docling or Azure Document Intelligence as solutions for template schema extraction.

**Why:** These tools can detect form fields visually, but they don't return the `ff_index` (Word form field index) or `field_name` (AcroForm name) positions that `generic_filler.py` and `pdf_filler.py` need to write values back into the correct slots. The filling pipeline requires exact positional references (ff_index for DOCX, field_name for PDF) that only python-docx XML parsing and PyMuPDF widget iteration can provide.

**How to apply:** When proposing solutions for field extraction (e.g., PDFs without AcroForm), suggest approaches that preserve the ability to write back into the template — not just visual detection.
