import type { ClassifiedDocument, DossierResponse, PatientDossierPatch } from "@/lib/schemas/classification";
import type { GenerateReportResponse, UpdateReportResponse } from "@/lib/schemas/report";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function getAuthHeaders(): Promise<HeadersInit> {
  // Clerk exposes getToken() via useAuth hook on client side
  // For server components, use auth() from @clerk/nextjs/server
  // This will be wired up when Clerk is installed
  return {
    "Content-Type": "application/json",
  };
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
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
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
}

export interface UserProfile {
  id: string;
  email: string;
  subscription_status: string | null;
}

// API Functions
export const api = {
  hello: () => apiGet<{ message: string }>("/api/hello"),

  /** Upload files and classify them via GPT-4o vision (Step 1 badges). */
  classifyDocuments: (files: File[]): Promise<ClassifiedDocument[]> => {
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    return apiPostFormData<ClassifiedDocument[]>("/api/classify", formData);
  },

  /** Parse all uploaded files into a structured patient dossier. Returns dossier + server-side ID. */
  parseDossier: (files: File[]): Promise<DossierResponse> => {
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    return apiPostFormData<DossierResponse>("/api/parse-dossier", formData);
  },

  /** Fetch a stored dossier by ID. */
  getDossier: (dossierId: string): Promise<DossierResponse> =>
    apiGet<DossierResponse>(`/api/dossiers/${dossierId}`),

  /** Partially update a stored dossier (inline edits). */
  updateDossier: (dossierId: string, patch: PatientDossierPatch): Promise<DossierResponse> =>
    apiPatch<DossierResponse>(`/api/dossiers/${dossierId}`, patch),

  /** Generate a filled .docx report. Returns field values, schema, and base64 docx. */
  generateReport: (dossierId: string, canton: string, templateId?: string): Promise<GenerateReportResponse> =>
    apiPost<GenerateReportResponse>("/api/generate-report", {
      dossier_id: dossierId,
      canton,
      template_id: templateId ?? null,
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

  /** Delete a template. */
  deleteTemplate: (templateId: string): Promise<void> =>
    apiDelete(`/api/templates/${templateId}`),

  /** Re-run schema extraction on a template. */
  extractSchema: (templateId: string): Promise<{ template_id: string; field_count: number; sections: string[] }> =>
    apiPost(`/api/templates/${templateId}/extract-schema`),
};
