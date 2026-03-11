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
  generateReport: (dossierId: string, canton: string): Promise<GenerateReportResponse> =>
    apiPost<GenerateReportResponse>("/api/generate-report", { dossier_id: dossierId, canton }),

  /** Re-fill the docx template with user-edited field values. Returns updated base64 docx. */
  updateReport: (dossierId: string, canton: string, fieldValues: Record<string, string | boolean>): Promise<UpdateReportResponse> =>
    apiPost<UpdateReportResponse>("/api/update-report", { dossier_id: dossierId, canton, field_values: fieldValues }),
};
