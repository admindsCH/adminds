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

/** Rubrique keys — 8 thematic groups for report data. */
export type RubriqueKey =
  | "r01_historique"
  | "r02_clinique"
  | "r03_traitement"
  | "r04_professionnel"
  | "r05_capacite_travail"
  | "r06_readaptation"
  | "r07_freins_cognition"
  | "r08_activites";

// --- API response types ---

/** Structured classification result for a single document (from LLM). */
export interface DocumentClassification {
  category: CategoryType;
  date: string | null;
  author_type: AuthorType;
  summary: string;
  rubriques: RubriqueKey[];
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

// --- Rubrique models (R01–R08) ---

export interface R01Historique {
  antecedents: string | null;
  periode_traitement: string | null;
  consultations: string | null;
  intervenants: string | null;
  cause_incapacite: string | null;
  timeline: TimelineEntry[];
}

export interface R02Clinique {
  symptomes_actuels: string | null;
  constats_medicaux: string | null;
  diagnostics_incapacitants: string | null;
  diagnostics_sans_incidence: string | null;
  frequence_consultations: string | null;
  diagnostics: Diagnostic[];
}

export interface R03Traitement {
  medication: string | null;
  plan_traitement: string | null;
  pronostic: string | null;
  medications: Medication[];
}

export interface R04Professionnel {
  activite: string | null;
  historique_emploi: string | null;
  exigences_poste: string | null;
  historique_it: string | null;
}

export interface R05CapaciteTravail {
  heures_jour_habituelle: string | null;
  heures_jour_adaptee: string | null;
  rythme: string | null;
  absences: string | null;
}

export interface R06Readaptation {
  potentiel: string | null;
  obstacles: string | null;
  ressources: string | null;
  taches_menageres: string | null;
  facteurs_environnementaux: string | null;
}

export interface R07FreinsCognition {
  freins_psy: string | null;
  fonctions_cognitives: string | null;
}

export interface R08Activites {
  limitations_fonctionnelles: string | null;
  activites_possibles: string | null;
  capacite_conduire: string | null;
}

export interface Rubriques {
  r01_historique: R01Historique;
  r02_clinique: R02Clinique;
  r03_traitement: R03Traitement;
  r04_professionnel: R04Professionnel;
  r05_capacite_travail: R05CapaciteTravail;
  r06_readaptation: R06Readaptation;
  r07_freins_cognition: R07FreinsCognition;
  r08_activites: R08Activites;
}

/** Complete structured output from POST /api/parse-dossier. */
export interface PatientDossier {
  patient_info: PatientInfo;
  rubriques: Rubriques;
  notes: string | null;
}

/** Response wrapper — dossier with its server-side ID. */
export interface DossierResponse {
  dossier_id: string;
  dossier: PatientDossier;
}

/** Deep partial — makes all nested properties optional too. */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** Partial update for PatientDossier (all fields optional, deeply). */
export interface PatientDossierPatch {
  patient_info?: Partial<PatientInfo>;
  rubriques?: DeepPartial<Rubriques>;
  notes?: string | null;
}
