import type { ClassifiedDocument, DossierResponse, PatientDossierPatch } from "@/lib/schemas/classification";
import type { DoctorProfile, GenerateReportResponse, UpdateReportResponse } from "@/lib/schemas/report";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Clerk token integration ─────────────────────────────
// Set once from a React component via useAuth().getToken,
// then used automatically in every API call.
let _getToken: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
  _getToken = fn;
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (_getToken) {
    const token = await _getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/** Return only the Authorization header (no Content-Type — for FormData uploads). */
async function getAuthOnlyHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (_getToken) {
    const token = await _getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function apiGet<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}${path}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
}

/** POST with FormData body (for file uploads). No Content-Type header — browser sets multipart boundary. */
export async function apiPostFormData<T>(path: string, formData: FormData): Promise<T> {
  const headers = await getAuthOnlyHeaders();
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
}

/** POST that returns a binary Blob (for file downloads like .docx). */
export async function apiPostBlob(path: string, body?: unknown): Promise<Blob> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.blob();
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}${path}`, {
    method: "PUT",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
}

export async function apiDelete(path: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}${path}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok && response.status !== 204) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `API error: ${response.status}`);
  }
}

// API Types

export interface TemplateResponse {
  id: string;
  name: string;
  description: string;
  category: string;
  insurance_id: string;
  insurance_name: string;
  canton: string;
  estimated_minutes: number;
  page_count: number;
  is_official: boolean;
  has_schema: boolean;
  filename: string;
  size: number;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  subscription_status: string | null;
}

export interface SchemaFieldResponse {
  id: string;
  slot_type: string;
  position: Record<string, unknown>;
  field_type: string;
  label: string;
  section: string;
  section_number: string;
  hint: string;
  options: string[];
  original_text: string | null;
  choice_columns: Record<string, number> | null;
  mapped_rubrique: string | null;
}

export interface TemplateSchemaResponse {
  template_id: string;
  template_name: string;
  fields: SchemaFieldResponse[];
  template_format: string;
  extracted_at: string;
}

export interface RegenerateFieldResponse {
  field_id: string;
  value: string;
}

// API Functions
export const api = {
  hello: () => apiGet<{ message: string }>("/api/hello"),

  /** Upload files and classify them via GPT-4o vision (Step 1 badges). */
  classifyDocuments: (files: File[], doctorName?: string): Promise<ClassifiedDocument[]> => {
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    if (doctorName) formData.append("doctor_name", doctorName);
    return apiPostFormData<ClassifiedDocument[]>("/api/classify", formData);
  },

  /** Parse dossier with SSE streaming. Calls onEvent for each progress event, resolves with final DossierResponse. */
  parseDossierStream: async (
    files: File[],
    onEvent: (event: { type: string; step?: string }) => void,
  ): Promise<import("@/lib/schemas/classification").DossierResponse> => {
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));

    const authHeaders = await getAuthOnlyHeaders();
    const response = await fetch(`${API_URL}/api/parse-dossier-stream`, {
      method: "POST",
      headers: authHeaders,
      body: formData,
    });
    if (!response.ok || !response.body) {
      throw new Error(`API error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // Flush remaining bytes and ensure final event gets split
        buffer += decoder.decode();
        if (buffer.trim()) buffer += "\n\n";
      } else {
        buffer += decoder.decode(value, { stream: true });
      }
      const lines = buffer.split("\n\n");
      buffer = lines.pop() ?? "";
      for (const chunk of lines) {
        // Skip SSE comments (heartbeat keepalives)
        if (chunk.startsWith(":")) continue;
        const dataLine = chunk.startsWith("data: ") ? chunk.slice(6) : null;
        if (!dataLine) continue;
        let event: Record<string, unknown>;
        try {
          event = JSON.parse(dataLine);
        } catch {
          continue; // malformed chunk — skip
        }
        if (event.type === "complete") return event as unknown as import("@/lib/schemas/classification").DossierResponse;
        if (event.type === "error") throw new Error((event.message as string) || "Erreur serveur");
        onEvent(event as { type: string; step?: string });
      }
      if (done) break;
    }
    throw new Error("La connexion a été interrompue. Veuillez réessayer.");
  },

  /** Fetch a stored dossier by ID. */
  getDossier: (dossierId: string): Promise<DossierResponse> =>
    apiGet<DossierResponse>(`/api/dossiers/${dossierId}`),

  /** Partially update a stored dossier (inline edits). */
  updateDossier: (dossierId: string, patch: PatientDossierPatch): Promise<DossierResponse> =>
    apiPatch<DossierResponse>(`/api/dossiers/${dossierId}`, patch),

  /** Generate a filled .docx report. Returns field values, schema, and base64 docx. */
  generateReport: (dossierId: string, canton: string, templateId?: string, doctorName?: string, doctorProfile?: DoctorProfile): Promise<GenerateReportResponse> =>
    apiPost<GenerateReportResponse>("/api/generate-report", {
      dossier_id: dossierId,
      canton,
      template_id: templateId ?? null,
      doctor_name: doctorName ?? null,
      doctor_profile: doctorProfile ?? null,
    }),

  /** Re-fill the docx template with user-edited field values. Returns updated base64 docx. */
  updateReport: (dossierId: string, canton: string, fieldValues: Record<string, string | boolean>, templateId?: string): Promise<UpdateReportResponse> =>
    apiPost<UpdateReportResponse>("/api/update-report", {
      dossier_id: dossierId,
      canton,
      field_values: fieldValues,
      template_id: templateId ?? null,
    }),

  /** Ask a question about the patient dossier. */
  dossierChat: (question: string, rawContent: string): Promise<{ answer: string }> =>
    apiPost<{ answer: string }>("/api/dossier-chat", { question, raw_content: rawContent }),

  // ── Template management ────────────────────────────────

  /** List all available report templates. */
  listTemplates: (): Promise<TemplateResponse[]> =>
    apiGet<TemplateResponse[]>("/api/templates"),

  /** Upload a new template. Backend auto-classifies (name, category, canton, insurance). */
  uploadTemplate: (file: File): Promise<TemplateResponse> => {
    const formData = new FormData();
    formData.append("file", file);
    return apiPostFormData<TemplateResponse>("/api/templates", formData);
  },

  /** Rename a template. */
  renameTemplate: (templateId: string, name: string): Promise<void> =>
    apiPatch(`/api/templates/${templateId}/rename`, { name }),

  /** Delete a template. */
  deleteTemplate: (templateId: string): Promise<void> =>
    apiDelete(`/api/templates/${templateId}`),

  /** Download a template file as a Blob (for preview). */
  downloadTemplate: async (templateId: string): Promise<Blob> => {
    const headers = await getAuthOnlyHeaders();
    const response = await fetch(`${API_URL}/api/templates/${templateId}/download`, { headers });
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    return response.blob();
  },

  /** Re-run schema extraction on a template. */
  extractSchema: (templateId: string): Promise<{ template_id: string; field_count: number; sections: string[] }> =>
    apiPost(`/api/templates/${templateId}/extract-schema`),

  /** Fetch the schema for a template. */
  getTemplateSchema: (templateId: string): Promise<TemplateSchemaResponse> =>
    apiGet<TemplateSchemaResponse>(`/api/templates/${templateId}/schema`),

  /** Update the schema for a template (edit labels, hints, delete fields). */
  updateTemplateSchema: (templateId: string, fields: SchemaFieldResponse[]): Promise<TemplateSchemaResponse> =>
    apiPut<TemplateSchemaResponse>(`/api/templates/${templateId}/schema`, { fields }),

  /** Transcribe an audio blob via Azure Whisper. */
  transcribeAudio: (blob: Blob): Promise<{ text: string }> => {
    const formData = new FormData();
    formData.append("file", blob, "recording.webm");
    return apiPostFormData<{ text: string }>("/api/transcribe", formData);
  },

  /** Regenerate a single field with optional doctor instructions. */
  regenerateField: (dossierId: string, templateId: string, fieldId: string, instruction?: string, doctorName?: string, doctorProfile?: DoctorProfile): Promise<RegenerateFieldResponse> =>
    apiPost<RegenerateFieldResponse>("/api/regenerate-field", {
      dossier_id: dossierId,
      template_id: templateId,
      field_id: fieldId,
      instruction: instruction || null,
      doctor_name: doctorName ?? null,
      doctor_profile: doctorProfile ?? null,
    }),
};
