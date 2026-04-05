"""Pytest fixtures for extraction tests."""

from __future__ import annotations

import pytest

from tests.extraction.fixtures_loader import TemplateCase, discover_cases


@pytest.fixture(scope="session")
def template_cases() -> list[TemplateCase]:
    """All discovered template + ground truth pairs."""
    return discover_cases()
