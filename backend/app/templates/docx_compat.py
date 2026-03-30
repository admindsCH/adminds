"""Compatibility helper for opening Word files with python-docx.

Handles .dotm / .docm files (macro-enabled templates/documents) that
python-docx rejects because their OPC content type differs from a
standard .docx.  We rewrite [Content_Types].xml inside the ZIP so
python-docx sees the expected content type.
"""

from __future__ import annotations

import io
import zipfile


# OPC content types that python-docx does not accept by default
_COMPAT_MAP: dict[bytes, bytes] = {
    b"application/vnd.ms-word.template.macroEnabledTemplate.main+xml": b"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
    b"application/vnd.ms-word.document.macroEnabled.main+xml": b"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
}


def normalize_docx_bytes(raw: bytes) -> bytes:
    """Return bytes that python-docx can open, patching content types if needed.

    If the file is already a standard .docx, the original bytes are returned
    unchanged.  For .dotm / .docm files the [Content_Types].xml is rewritten
    so python-docx accepts them.
    """
    buf = io.BytesIO(raw)
    try:
        with zipfile.ZipFile(buf, "r") as zin:
            ct_bytes = zin.read("[Content_Types].xml")
    except (zipfile.BadZipFile, KeyError):
        return raw  # not a ZIP or missing manifest — let caller handle error

    patched = ct_bytes
    for old, new in _COMPAT_MAP.items():
        if old in patched:
            patched = patched.replace(old, new)

    if patched is ct_bytes:
        return raw  # nothing to patch

    out = io.BytesIO()
    with zipfile.ZipFile(buf, "r") as zin, zipfile.ZipFile(out, "w") as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == "[Content_Types].xml":
                data = patched
            zout.writestr(item, data)
    return out.getvalue()
