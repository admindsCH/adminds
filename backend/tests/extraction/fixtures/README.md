# Extraction Test Fixtures

Drop template files and their ground truth schemas here.

## Naming convention

- `template_a.docx` + `template_a_schema.json`
- `template_b.pdf` + `template_b_schema.json`

The test runner auto-discovers pairs by matching `*_schema.json` to the
corresponding `.docx` or `.pdf` with the same prefix.

## Ground truth format

Each `_schema.json` is a full `TemplateSchema` JSON (as produced by
`TemplateSchema.model_dump()`). Only the `fields` array is used for
scoring -- `template_id` and `extracted_at` are ignored.
