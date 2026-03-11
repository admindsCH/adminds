/**
 * Classification agent schemas — mirrors backend classification/schemas.py.
 * Each backend agent will have a corresponding schema file here.
 */

// --- Constrained string types (match backend Literal types) ---

/** Document type — 9 categories matching backend CategoryType. */
export type CategoryType =
  | "consultation_note"
  | "rapport_anterieur"
  | "hospitalisation"
  | "medication"
  | "bilan_evaluation"
  | "document_professionnel"
  | "evaluation_fonctionnelle"
  | "dpi_smeex"
  | "autre";

/** Who produced the document — 7 author types. */
export type AuthorType =
  | "psychiatre_traitant"
  | "medecin_generaliste"
  | "specialiste_autre"
  | "hopital"
  | "employeur"
  | "assurance"
  | "inconnu";

/** Semantic field keys — 14 canton-agnostic keys mapped to form sections at generation time. */
export type RapportAiField =
  | "antecedents"
  | "situation_actuelle"
  | "medication"
  | "constats_medicaux"
  | "diagnostics_incapacitants"
  | "diagnostics_sans_incidence"
  | "pronostic_capacite_travail"
  | "plan_traitement"
  | "situation_professionnelle"
  | "limitations_fonctionnelles"
  | "freins_readaptation"
  | "capacite_readaptation"
  | "fonctions_cognitives"
  | "activites_possibles";

// --- API response types ---

/** Structured classification result for a single document (from LLM). */
export interface DocumentClassification {
  category: CategoryType;
  date: string | null;
  author_type: AuthorType;
  summary: string;
  rapport_ai_fields: RapportAiField[];
}

/** A classified document as returned by POST /api/classify. */
export interface ClassifiedDocument {
  filename: string;
  classification: DocumentClassification;
}

// --- Display constants ---

/** Human-readable labels for each category (French). */
export const CATEGORY_LABELS: Record<CategoryType, string> = {
  consultation_note: "Consultation",
  rapport_anterieur: "Rapport antérieur",
  hospitalisation: "Hospitalisation",
  medication: "Médication",
  bilan_evaluation: "Bilan / évaluation",
  document_professionnel: "Document professionnel",
  evaluation_fonctionnelle: "Évaluation fonctionnelle",
  dpi_smeex: "DPI (SMEEX)",
  autre: "Autre",
};

/** Badge colors for each category (must match Catalyst Badge color union). */
export const CATEGORY_COLORS: Record<CategoryType,
  "red" | "orange" | "amber" | "yellow" | "lime" | "green" | "emerald"
  | "teal" | "cyan" | "sky" | "blue" | "indigo" | "violet" | "purple"
  | "fuchsia" | "pink" | "rose" | "zinc"> = {
  consultation_note: "blue",
  rapport_anterieur: "purple",
  hospitalisation: "red",
  medication: "emerald",
  bilan_evaluation: "amber",
  document_professionnel: "zinc",
  evaluation_fonctionnelle: "indigo",
  dpi_smeex: "sky",
  autre: "zinc",
};


// =====================================================================
// Dossier parsing — deep extraction (Step 2), mirrors backend PatientDossier
// =====================================================================

export interface PatientInfo {
  age: number | null;
  sexe: "homme" | "femme" | "inconnu" | null;
  situation_sociale: string | null;
  antecedents: string | null;
}

export interface TimelineEntry {
  date: string | null;
  title: string;
  source: string | null;
  summary: string;
}

export interface Medication {
  nom: string;
  dosage: string | null;
  date: string | null;
}

export interface Diagnostic {
  label: string;
  code_cim: string | null;
  type: "incapacitant" | "sans_incidence" | "inconnu";
}

export interface RapportAiFields {
  antecedents: string | null;
  situation_actuelle: string | null;
  medication: string | null;
  constats_medicaux: string | null;
  diagnostics_incapacitants: string | null;
  diagnostics_sans_incidence: string | null;
  pronostic_capacite_travail: string | null;
  plan_traitement: string | null;
  situation_professionnelle: string | null;
  limitations_fonctionnelles: string | null;
  freins_readaptation: string | null;
  capacite_readaptation: string | null;
  fonctions_cognitives: string | null;
  activites_possibles: string | null;
}

/** Complete structured output from POST /api/parse-dossier. */
export interface PatientDossier {
  patient_info: PatientInfo;
  timeline: TimelineEntry[];
  medications: Medication[];
  diagnostics: Diagnostic[];
  rapport_ai_fields: RapportAiFields;
  notes: string | null;
}

/** Response wrapper — dossier with its server-side ID. */
export interface DossierResponse {
  dossier_id: string;
  dossier: PatientDossier;
}

/** Partial update for PatientDossier (all fields optional). */
export interface PatientDossierPatch {
  patient_info?: Partial<PatientInfo>;
  timeline?: TimelineEntry[];
  medications?: Medication[];
  diagnostics?: Diagnostic[];
  rapport_ai_fields?: Partial<RapportAiFields>;
  notes?: string | null;
}
