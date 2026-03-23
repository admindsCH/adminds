/** One field descriptor from the backend canton field map. */
export interface FieldSchemaEntry {
  id: string;
  type: string;       // "text" | "date" | "checkbox" | "select_one" | "choice"
  label: string;
  section: string;
  section_number?: string;  // e.g. "2.2" — extracted from template heading
  hint?: string;
  options?: string[];
}

/** Response from POST /api/generate-report. */
export interface GenerateReportResponse {
  field_values: Record<string, string | boolean>;
  field_schema: FieldSchemaEntry[];
  docx_base64: string;
}

/** Response from POST /api/update-report. */
export interface UpdateReportResponse {
  docx_base64: string;
}
