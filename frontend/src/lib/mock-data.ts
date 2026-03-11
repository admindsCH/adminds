import type { LucideIcon } from "lucide-react";
import { FileText, Shield, TrendingDown } from "lucide-react";
import type { CategoryType, DocumentClassification } from "@/lib/schemas/classification";

// --- Patient types & mock data ---

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO date
  avsNumber: string; // Swiss social security number (numéro AVS)
  createdAt: string; // ISO datetime
  hasReport: boolean; // true = at least one rapport has been generated
  documentsCount: number;
}

export const MOCK_PATIENTS: Patient[] = [
  {
    id: "1",
    firstName: "Marie",
    lastName: "Dupont",
    dateOfBirth: "1985-03-12",
    avsNumber: "756.1234.5678.90",
    createdAt: "2026-03-08T09:30:00",
    hasReport: false,
    documentsCount: 3,
  },
  {
    id: "2",
    firstName: "Jean-Pierre",
    lastName: "Müller",
    dateOfBirth: "1972-07-25",
    avsNumber: "756.9876.5432.10",
    createdAt: "2026-03-08T11:15:00",
    hasReport: false,
    documentsCount: 0,
  },
  {
    id: "3",
    firstName: "Sophie",
    lastName: "Rochat",
    dateOfBirth: "1990-11-03",
    avsNumber: "756.5555.1234.56",
    createdAt: "2026-03-07T14:00:00",
    hasReport: true,
    documentsCount: 5,
  },
  {
    id: "4",
    firstName: "Ahmed",
    lastName: "Benali",
    dateOfBirth: "1968-01-18",
    avsNumber: "756.3333.7890.12",
    createdAt: "2026-03-06T10:45:00",
    hasReport: false,
    documentsCount: 2,
  },
  {
    id: "5",
    firstName: "Isabelle",
    lastName: "Favre",
    dateOfBirth: "1995-09-30",
    avsNumber: "756.7777.4567.89",
    createdAt: "2026-03-05T16:20:00",
    hasReport: true,
    documentsCount: 1,
  },
];

// --- Patient notes ---

export interface PatientNote {
  id: string;
  patientId: string;
  createdAt: string; // ISO datetime
  type: "text" | "voice"; // how the note was created
  summary: string; // short title or auto-generated summary
  content: string; // full note body
  durationSeconds?: number; // only for voice notes
}

export const MOCK_NOTES: PatientNote[] = [
  {
    id: "n1",
    patientId: "1",
    createdAt: "2026-03-08T10:15:00",
    type: "text",
    summary: "Première consultation — anamnèse",
    content:
      "Patiente se présente pour évaluation AI. Antécédents de trouble dépressif récurrent depuis 2018. Actuellement sous Sertraline 100mg. Dernier épisode majeur en novembre 2025, ayant conduit à un arrêt de travail prolongé.",
  },
  {
    id: "n2",
    patientId: "1",
    createdAt: "2026-03-08T11:00:00",
    type: "voice",
    summary: "Observation clinique — état mental",
    content:
      "Patiente orientée dans les trois sphères. Contact adéquat mais ralenti. Thymie abaissée, affect restreint. Pas d'idéation suicidaire active. Sommeil perturbé avec réveils précoces. Concentration diminuée, décrit des difficultés à maintenir l'attention au travail.",
    durationSeconds: 127,
  },
  {
    id: "n3",
    patientId: "1",
    createdAt: "2026-03-07T14:30:00",
    type: "text",
    summary: "Capacité de travail — évaluation",
    content:
      "Capacité de travail estimée à 50% dans l'activité habituelle. Limitations fonctionnelles : concentration réduite, fatigabilité accrue, difficultés relationnelles avec la hiérarchie. Pronostic réservé à 6 mois.",
  },
];

// --- Patient documents ---

export interface PatientDocument {
  id: string;
  patientId: string;
  category: "dpi-smeex" | "antecedents" | "autre";
  fileName: string;
  fileSize: number; // bytes
  uploadedAt: string; // ISO datetime
  mimeType: string;
}

export const MOCK_DOCUMENTS: PatientDocument[] = [
  {
    id: "d1",
    patientId: "1",
    category: "dpi-smeex",
    fileName: "DPI_Dupont_Marie_SMEEX.xml",
    fileSize: 245_000,
    uploadedAt: "2026-03-08T09:45:00",
    mimeType: "application/xml",
  },
  {
    id: "d2",
    patientId: "1",
    category: "antecedents",
    fileName: "Rapport_Dr_Weber_2024.pdf",
    fileSize: 1_230_000,
    uploadedAt: "2026-03-08T09:50:00",
    mimeType: "application/pdf",
  },
  {
    id: "d3",
    patientId: "1",
    category: "antecedents",
    fileName: "Bilan_neuropsychologique_2025.pdf",
    fileSize: 890_000,
    uploadedAt: "2026-03-07T15:20:00",
    mimeType: "application/pdf",
  },
  {
    id: "d4",
    patientId: "1",
    category: "autre",
    fileName: "Formulaire_AI_rempli.pdf",
    fileSize: 156_000,
    uploadedAt: "2026-03-07T15:25:00",
    mimeType: "application/pdf",
  },
];

// --- Report template types ---

export interface ReportType {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
}

// --- Generated report content (mock) ---

export interface ReportSection {
  id: string;
  title: string;
  content: string;
}

// Realistic Rapport AI sections for patient Marie Dupont
export const MOCK_REPORT_SECTIONS: Record<string, ReportSection[]> = {
  "rapport-ai": [
    {
      id: "anamnese",
      title: "1. Anamnèse",
      content:
        "Mme Marie Dupont, née le 12.03.1985, est adressée pour une évaluation psychiatrique dans le cadre d'une demande de prestations de l'assurance-invalidité. La patiente rapporte un trouble dépressif récurrent diagnostiqué en 2018, initialement traité par psychothérapie ambulatoire. Un épisode dépressif majeur est survenu en novembre 2025, entraînant un arrêt de travail complet depuis le 15.11.2025.\n\nLa patiente travaillait comme assistante administrative à 100% depuis 2012. Elle décrit une dégradation progressive de son état depuis septembre 2025, avec des difficultés croissantes de concentration, une fatigue invalidante et des troubles du sommeil. Le traitement actuel comprend Sertraline 100mg/j et un suivi psychothérapeutique hebdomadaire.",
    },
    {
      id: "examen-clinique",
      title: "2. Examen clinique / Status psychique",
      content:
        "Patiente orientée dans les trois sphères. Présentation soignée, contact adéquat mais ralenti. Le discours est cohérent, de débit légèrement diminué. La thymie est abaissée avec un affect restreint. On note une anhédonie marquée et une perte d'intérêt pour les activités habituelles.\n\nPas d'idéation suicidaire active ni de symptômes psychotiques. Le sommeil est perturbé avec des réveils précoces vers 4h. L'appétit est diminué avec une perte de poids de 4 kg en 3 mois. La concentration est significativement réduite, la patiente décrit des difficultés à lire plus de 10 minutes et à maintenir le fil d'une conversation complexe.",
    },
    {
      id: "diagnostic",
      title: "3. Diagnostic (CIM-10)",
      content:
        "F33.1 — Trouble dépressif récurrent, épisode actuel moyen\nF51.0 — Insomnie non organique\n\nDiagnostics différentiels exclus : trouble bipolaire, trouble anxieux généralisé (pas de critères suffisants), trouble de la personnalité.",
    },
    {
      id: "limitations",
      title: "4. Limitations fonctionnelles",
      content:
        "Selon les indicateurs standards de la jurisprudence fédérale (ATF 141 V 281) :\n\n• Concentration et attention : Limitation sévère — incapacité à maintenir l'attention au-delà de 15-20 minutes sur une tâche cognitive\n• Endurance : Limitation modérée à sévère — fatigabilité accrue nécessitant des pauses fréquentes\n• Adaptabilité : Limitation modérée — difficultés face aux changements et aux situations imprévues\n• Relations interpersonnelles : Limitation légère à modérée — retrait social, mais capacité préservée de contacts brefs\n• Planification et organisation : Limitation modérée — difficultés à structurer une journée de travail complète",
    },
    {
      id: "capacite-travail",
      title: "5. Capacité de travail",
      content:
        "Dans l'activité habituelle d'assistante administrative :\n— Capacité de travail actuelle : 50%\n— Horaire adapté recommandé : mi-temps (4h/jour, 5 jours/semaine)\n— Limitations : pas de tâches nécessitant une concentration soutenue, pas de pression temporelle excessive, environnement de travail calme\n\nDans une activité adaptée :\n— Capacité de travail estimée : 60-70%\n— Activité sans exigence cognitive élevée, avec possibilité de pauses régulières\n\nL'exigibilité d'une reprise à temps plein n'est pas raisonnable dans l'état actuel.",
    },
    {
      id: "pronostic",
      title: "6. Pronostic",
      content:
        "Le pronostic est réservé à moyen terme (6-12 mois). L'évolution dépendra de la réponse au traitement antidépresseur en cours et de la poursuite de la psychothérapie. Une réévaluation est recommandée dans 6 mois.\n\nFacteurs favorables : compliance thérapeutique, motivation de la patiente, bon fonctionnement prémorbide.\nFacteurs défavorables : récurrence du trouble, durée de l'épisode actuel, persistance des troubles du sommeil malgré le traitement.",
    },
  ],
};

// --- Editable report fields matching Fribourg docx template ---
// Mirrors the sections from backend/app/services/fribourg_field_map.py

export interface ReportField {
  id: string;
  label: string;
  value: string;
  type: "text" | "date" | "multiline";
}

export interface ReportFieldSection {
  id: string;
  title: string;
  fields: ReportField[];
}

// Mock filled values matching the Fribourg template structure
export const MOCK_FRIBOURG_FIELDS: ReportFieldSection[] = [
  {
    id: "1_informations_generales",
    title: "1. Informations générales",
    fields: [
      { id: "date_derniere_consultation", label: "Date de la dernière consultation", value: "08.03.2026", type: "date" },
      { id: "consultations_precedentes_par", label: "Consultations effectuées précédemment par", value: "Dr Weber, psychiatre FMH, Fribourg", type: "text" },
      { id: "consultations_ulterieures_par", label: "Consultations effectuées à une date ultérieure par", value: "", type: "text" },
      { id: "frequence_consultations", label: "Fréquence des consultations", value: "1x/semaine", type: "text" },
      { id: "incapacite_pct_1", label: "Incapacité de travail — ligne 1 (%)", value: "100%", type: "text" },
      { id: "incapacite_du_1", label: "Incapacité de travail — ligne 1 (du)", value: "15.11.2025", type: "date" },
      { id: "incapacite_au_1", label: "Incapacité de travail — ligne 1 (au)", value: "15.02.2026", type: "date" },
      { id: "incapacite_pct_2", label: "Incapacité de travail — ligne 2 (%)", value: "50%", type: "text" },
      { id: "incapacite_du_2", label: "Incapacité de travail — ligne 2 (du)", value: "16.02.2026", type: "date" },
      { id: "incapacite_au_2", label: "Incapacité de travail — ligne 2 (au)", value: "indéterminé", type: "text" },
      { id: "activites_incapacite", label: "Pour quelles activités avez-vous attesté une incapacité de travail ?", value: "Activité habituelle d'assistante administrative à 100%", type: "text" },
      { id: "autres_intervenants", label: "Autres intervenants (médecins, hôpitaux, thérapeutes)", value: "Mme Schneider, psychologue FSP — psychothérapie cognitivo-comportementale hebdomadaire", type: "text" },
    ],
  },
  {
    id: "2_situation_medicale",
    title: "2. Situation médicale",
    fields: [
      { id: "antecedents_evolution", label: "Antécédents médicaux et évolution", value: "Trouble dépressif récurrent diagnostiqué en 2018, traité initialement par psychothérapie ambulatoire. Épisode dépressif majeur en novembre 2025 entraînant un arrêt de travail complet. Dégradation progressive depuis septembre 2025 avec difficultés de concentration croissantes, fatigue invalidante et troubles du sommeil.", type: "multiline" },
      { id: "situation_symptomes_actuels", label: "Situation et symptômes médicaux actuels", value: "Thymie abaissée, affect restreint, anhédonie marquée. Sommeil perturbé avec réveils précoces vers 4h. Appétit diminué, perte de poids de 4 kg en 3 mois. Concentration significativement réduite. Pas d'idéation suicidaire active ni de symptômes psychotiques.", type: "multiline" },
      { id: "medication_actuelle", label: "Médication actuelle (y compris le dosage)", value: "Sertraline 100mg/jour", type: "text" },
      { id: "constats_medicaux", label: "Constats médicaux (examens pratiqués)", value: "Patiente orientée dans les trois sphères. Contact adéquat mais ralenti. Discours cohérent, débit légèrement diminué. Bilan neuropsychologique (2025) confirmant déficit attentionnel et fatigabilité cognitive.", type: "multiline" },
      { id: "diagnostics_pertinents", label: "Diagnostics pertinents pour l'AI (codes CIM)", value: "F33.1 — Trouble dépressif récurrent, épisode actuel moyen\nF51.0 — Insomnie non organique", type: "multiline" },
      { id: "diagnostics_non_pertinents", label: "Diagnostics sans influence sur la capacité de travail", value: "Aucun", type: "text" },
      { id: "pronostic_capacite_travail", label: "Pronostic sur la capacité de travail", value: "Réservé à moyen terme (6-12 mois). Dépend de la réponse au traitement antidépresseur et de la poursuite de la psychothérapie. Réévaluation recommandée dans 6 mois.", type: "multiline" },
      { id: "plan_traitement", label: "Prochaines mesures / plan de traitement", value: "Poursuite Sertraline 100mg/j, psychothérapie hebdomadaire TCC. Évaluation d'un ajustement médicamenteux si pas d'amélioration dans 2 mois. Reprise progressive du travail à 50% envisagée.", type: "multiline" },
    ],
  },
  {
    id: "3_situation_professionnelle",
    title: "3. Situation professionnelle",
    fields: [
      { id: "activite_actuelle", label: "Activité actuelle du patient", value: "Assistante administrative chez Fiduciaire Romande SA, taux 100%. En arrêt de travail complet depuis le 15.11.2025, reprise à 50% depuis le 16.02.2026.", type: "text" },
      { id: "situation_professionnelle_info", label: "Situation professionnelle avant l'atteinte", value: "Assistante administrative à 100% depuis 2012, fonctionnement satisfaisant jusqu'en septembre 2025.", type: "text" },
      { id: "exigences_activite", label: "Exigences de l'activité professionnelle", value: "Travail de bureau, rédaction de courriers, gestion de dossiers, contact téléphonique avec la clientèle, utilisation de logiciels comptables.", type: "text" },
      { id: "limitations_fonctionnelles", label: "Limitations fonctionnelles", value: "Concentration réduite (< 20 min sur tâche cognitive), fatigabilité accrue, difficultés relationnelles avec la hiérarchie, hypersensibilité au stress, difficultés de planification.", type: "multiline" },
      { id: "ressources_patient", label: "Ressources du patient", value: "Bonne compliance thérapeutique, motivation pour la reprise, bon fonctionnement prémorbide, soutien familial présent.", type: "text" },
      { id: "capacite_conduire", label: "Doutes quant à la capacité de conduire", value: "Pas de doute", type: "text" },
      { id: "heures_travail_activite_habituelle", label: "Heures de travail/jour dans l'activité habituelle", value: "4h/jour (50%). Pas de tâches nécessitant une concentration soutenue, pas de pression temporelle excessive, environnement calme.", type: "text" },
      { id: "heures_travail_activite_adaptee", label: "Heures de travail/jour dans une activité adaptée", value: "5-6h/jour (60-70%). Activité sans exigence cognitive élevée, avec possibilité de pauses régulières.", type: "text" },
    ],
  },
  {
    id: "4_potentiel_readaptation",
    title: "4. Potentiel de réadaptation",
    fields: [
      { id: "pronostic_readaptation", label: "Pronostic sur le potentiel de réadaptation", value: "Favorable sous réserve de la poursuite du traitement. Capacité de travail susceptible d'augmenter progressivement sur 6-12 mois.", type: "multiline" },
      { id: "obstacles_readaptation", label: "Facteurs faisant obstacle à une réadaptation", value: "Récurrence du trouble dépressif, persistance des troubles du sommeil malgré le traitement, durée de l'épisode actuel.", type: "multiline" },
      { id: "limitations_vie_quotidienne", label: "Limitations dans les activités de la vie quotidienne", value: "Difficultés modérées pour le ménage et les courses (fatigabilité). Soins corporels et déplacements préservés. Repas simples possibles.", type: "multiline" },
    ],
  },
  {
    id: "divers",
    title: "5. Divers",
    fields: [
      { id: "divers", label: "Autres éléments à signaler", value: "Aucune information complémentaire à signaler.", type: "text" },
    ],
  },
];

// Mock filled values matching the Geneva template structure
// Geneva is simpler: 14 numbered questions, each a free-text answer box
export const MOCK_GENEVE_FIELDS: ReportFieldSection[] = [
  {
    id: "anamnese",
    title: "1. Anamnèse et status",
    fields: [
      { id: "q01_anamnese_status", label: "Anamnèse et status (constatations objectives)", value: "Mme Marie Dupont, née le 12.03.1985, est suivie depuis le 15.11.2025 pour un trouble dépressif récurrent (F33.1). Épisode actuel depuis novembre 2025 avec dégradation progressive depuis septembre 2025.\n\nStatus: Patiente orientée dans les trois sphères. Contact adéquat mais ralenti. Thymie abaissée, affect restreint, anhédonie marquée. Sommeil perturbé (réveils précoces 4h). Concentration significativement réduite. Pas d'idéation suicidaire active ni de symptômes psychotiques.", type: "multiline" },
    ],
  },
  {
    id: "diagnostics",
    title: "2-3. Diagnostics",
    fields: [
      { id: "q02_diagnostics_avec_repercussion", label: "Diagnostic(s) avec répercussion durable sur la capacité de travail", value: "F33.1 — Trouble dépressif récurrent, épisode actuel moyen\nF51.0 — Insomnie non organique", type: "multiline" },
      { id: "q03_diagnostics_sans_repercussion", label: "Diagnostic(s) sans répercussion durable sur la capacité de travail", value: "Néant", type: "text" },
    ],
  },
  {
    id: "traitement",
    title: "4-5. Traitement et observance",
    fields: [
      { id: "q04_suivi_traitement", label: "Suivi médical, traitement et propositions thérapeutiques", value: "Première consultation: 15.11.2025. Suivi hebdomadaire.\nTraitement: Sertraline 100mg/jour.\nPsychothérapie TCC hebdomadaire (Mme Schneider, psychologue FSP).\nPropositions: évaluation ajustement médicamenteux si pas d'amélioration dans 2 mois.", type: "multiline" },
      { id: "q05_observance", label: "Observance thérapeutique et compliance", value: "Bonne observance thérapeutique. Patiente compliant au traitement médicamenteux et psychothérapeutique. Pas de monitoring sanguin requis pour Sertraline.", type: "multiline" },
    ],
  },
  {
    id: "evolution",
    title: "6. Évolution",
    fields: [
      { id: "q06_evolution", label: "Évolution de l'état de santé depuis la prise en charge", value: "Légère amélioration depuis le début de la prise en charge. Thymie reste abaissée mais stabilisée. Troubles du sommeil persistants malgré le traitement. Reprise partielle du travail à 50% depuis le 16.02.2026.", type: "multiline" },
    ],
  },
  {
    id: "pronostic",
    title: "7. Pronostic",
    fields: [
      { id: "q07_pronostic", label: "Pronostic", value: "Réservé à moyen terme (6-12 mois). Dépend de la réponse au traitement antidépresseur et de la poursuite de la psychothérapie. Facteurs favorables: compliance, motivation, bon fonctionnement prémorbide. Facteurs défavorables: récurrence du trouble, persistance des troubles du sommeil.", type: "multiline" },
    ],
  },
  {
    id: "limitations",
    title: "8-9. Limitations fonctionnelles et vie quotidienne",
    fields: [
      { id: "q08_limitations_fonctionnelles", label: "Limitations fonctionnelles", value: "Concentration réduite (< 20 min sur tâche cognitive), fatigabilité accrue nécessitant des pauses fréquentes, difficultés d'adaptation au changement, retrait social avec capacité préservée de contacts brefs, difficultés de planification et d'organisation.", type: "multiline" },
      { id: "q09_repercussions_vie_quotidienne", label: "Répercussions dans la vie quotidienne et journée type", value: "Difficultés modérées pour le ménage et les courses (fatigabilité). Soins corporels préservés. Activités sociales réduites. Journée type: lever 7h, difficultés à initier les activités, fatigue dès la mi-journée, sieste fréquente, coucher 22h avec réveils précoces.", type: "multiline" },
    ],
  },
  {
    id: "ressources_readaptation",
    title: "10-11. Ressources et réadaptation",
    fields: [
      { id: "q10_ressources", label: "Ressources disponibles ou mobilisables", value: "Soutien familial présent (conjoint). Bonne aptitude à la collaboration. Ancien réseau professionnel maintenu. Loisirs: lecture (limitée), promenades.", type: "multiline" },
      { id: "q11_readaptation", label: "Aptitude à suivre une mesure de réadaptation professionnelle", value: "Envisageable à moyen terme (3-6 mois), sous réserve d'une amélioration de la concentration et de la fatigabilité. Mesure de type reprise progressive recommandée.", type: "multiline" },
    ],
  },
  {
    id: "capacite_travail",
    title: "12-13. Capacité de travail",
    fields: [
      { id: "q12_capacite_activite_habituelle", label: "Capacité de travail dans l'activité habituelle", value: "Assistante administrative. Capacité actuelle: 50% depuis le 16.02.2026. Reprise à taux plus élevé envisageable dans 3-6 mois selon évolution.", type: "multiline" },
      { id: "q13_capacite_activite_adaptee", label: "Capacité de travail dans une activité adaptée", value: "60-70% dans une activité sans exigence cognitive élevée, avec possibilité de pauses régulières et sans pression temporelle. Envisageable dès maintenant.", type: "multiline" },
    ],
  },
  {
    id: "remarques",
    title: "14. Remarques",
    fields: [
      { id: "q14_remarques", label: "Remarques éventuelles", value: "Réévaluation recommandée dans 6 mois.", type: "text" },
    ],
  },
];

// The 3 rapport types available for each patient
export const REPORT_TYPES: ReportType[] = [
  {
    id: "rapport-ai",
    name: "Rapport AI",
    description: "Rapport d'assurance invalidité généré par IA",
    icon: FileText,
  },
  {
    id: "rapport-assurance-privee",
    name: "Rapport assurance privée",
    description: "Rapport pour les assurances privées du patient",
    icon: Shield,
  },
  {
    id: "rapport-perte-de-gain",
    name: "Rapport perte de gain",
    description: "Rapport d'évaluation de la perte de gain",
    icon: TrendingDown,
  },
];

// --- Wizard: Extracted information from documents (Step 2 mock) ---

export type Canton = "geneve" | "fribourg";

export const CANTONS: { value: Canton; label: string }[] = [
  { value: "fribourg", label: "Fribourg" },
  { value: "geneve", label: "Genève" },
];

// A single uploaded & processed document in the wizard
export interface WizardDocument {
  id: string;
  file: File;                              // actual File object kept for backend upload
  fileName: string;
  fileSize: number;
  category: CategoryType;                  // 9-value category from classification agent
  status: "classifying" | "done" | "error";
  classification: DocumentClassification | null; // full backend response
  summary: string;                         // one-line summary from classification
}

// Extracted information organized by section
export interface ExtractedSection {
  id: string;
  title: string;
  icon: string; // emoji for visual distinction
  fields: ExtractedField[];
}

export interface ExtractedField {
  label: string;
  value: string;
  source: string; // which document it came from
  confidence: "high" | "medium" | "low";
}

// Mock extracted data that would come from AI processing of uploaded documents
export const MOCK_EXTRACTED_SECTIONS: ExtractedSection[] = [
  {
    id: "patient-info",
    title: "Informations du patient",
    icon: "👤",
    fields: [
      { label: "Nom", value: "Dupont", source: "DPI_Dupont_Marie_SMEEX.xml", confidence: "high" },
      { label: "Prénom", value: "Marie", source: "DPI_Dupont_Marie_SMEEX.xml", confidence: "high" },
      { label: "Date de naissance", value: "12.03.1985", source: "DPI_Dupont_Marie_SMEEX.xml", confidence: "high" },
      { label: "N° AVS", value: "756.1234.5678.90", source: "DPI_Dupont_Marie_SMEEX.xml", confidence: "high" },
      { label: "Adresse", value: "Rue de la Gare 12, 1700 Fribourg", source: "DPI_Dupont_Marie_SMEEX.xml", confidence: "high" },
      { label: "Profession", value: "Assistante administrative", source: "DPI_Dupont_Marie_SMEEX.xml", confidence: "high" },
      { label: "Employeur", value: "Fiduciaire Romande SA", source: "DPI_Dupont_Marie_SMEEX.xml", confidence: "medium" },
    ],
  },
  {
    id: "diagnostic",
    title: "Diagnostic",
    icon: "🩺",
    fields: [
      { label: "Diagnostic principal (CIM-10)", value: "F33.1 — Trouble dépressif récurrent, épisode actuel moyen", source: "Rapport_Dr_Weber_2024.pdf", confidence: "high" },
      { label: "Diagnostic secondaire", value: "F51.0 — Insomnie non organique", source: "Rapport_Dr_Weber_2024.pdf", confidence: "high" },
      { label: "Date du diagnostic", value: "2018", source: "Rapport_Dr_Weber_2024.pdf", confidence: "medium" },
      { label: "Diagnostics exclus", value: "Trouble bipolaire, trouble anxieux généralisé, trouble de la personnalité", source: "Bilan_neuropsychologique_2025.pdf", confidence: "high" },
    ],
  },
  {
    id: "anamnese",
    title: "Anamnèse",
    icon: "📋",
    fields: [
      { label: "Début des troubles", value: "2018 — trouble dépressif récurrent diagnostiqué, traité initialement par psychothérapie ambulatoire", source: "Rapport_Dr_Weber_2024.pdf", confidence: "high" },
      { label: "Épisode actuel", value: "Novembre 2025 — épisode dépressif majeur entraînant arrêt de travail complet depuis le 15.11.2025", source: "DPI_Dupont_Marie_SMEEX.xml", confidence: "high" },
      { label: "Évolution", value: "Dégradation progressive depuis septembre 2025 : difficultés de concentration croissantes, fatigue invalidante, troubles du sommeil", source: "Rapport_Dr_Weber_2024.pdf", confidence: "medium" },
      { label: "Antécédents familiaux", value: "Mère traitée pour dépression, pas d'antécédents psychiatriques paternels connus", source: "Rapport_Dr_Weber_2024.pdf", confidence: "medium" },
    ],
  },
  {
    id: "traitement",
    title: "Traitement actuel",
    icon: "💊",
    fields: [
      { label: "Médicament", value: "Sertraline 100mg/jour", source: "DPI_Dupont_Marie_SMEEX.xml", confidence: "high" },
      { label: "Psychothérapie", value: "Suivi hebdomadaire — thérapie cognitivo-comportementale", source: "Rapport_Dr_Weber_2024.pdf", confidence: "high" },
      { label: "Compliance", value: "Bonne — patiente observante au traitement", source: "Rapport_Dr_Weber_2024.pdf", confidence: "medium" },
    ],
  },
  {
    id: "limitations",
    title: "Limitations fonctionnelles",
    icon: "⚠️",
    fields: [
      { label: "Concentration", value: "Limitation sévère — incapacité à maintenir l'attention > 15-20 min sur une tâche cognitive", source: "Bilan_neuropsychologique_2025.pdf", confidence: "high" },
      { label: "Endurance", value: "Limitation modérée à sévère — fatigabilité accrue nécessitant des pauses fréquentes", source: "Bilan_neuropsychologique_2025.pdf", confidence: "high" },
      { label: "Adaptabilité", value: "Limitation modérée — difficultés face aux changements et situations imprévues", source: "Rapport_Dr_Weber_2024.pdf", confidence: "medium" },
      { label: "Relations interpersonnelles", value: "Limitation légère à modérée — retrait social, capacité préservée de contacts brefs", source: "Rapport_Dr_Weber_2024.pdf", confidence: "medium" },
      { label: "Planification", value: "Limitation modérée — difficultés à structurer une journée de travail complète", source: "Bilan_neuropsychologique_2025.pdf", confidence: "high" },
    ],
  },
  {
    id: "capacite-travail",
    title: "Capacité de travail",
    icon: "💼",
    fields: [
      { label: "Activité habituelle", value: "50% — mi-temps recommandé (4h/jour, 5 jours/semaine)", source: "Rapport_Dr_Weber_2024.pdf", confidence: "high" },
      { label: "Activité adaptée", value: "60-70% — sans exigence cognitive élevée, avec pauses régulières", source: "Bilan_neuropsychologique_2025.pdf", confidence: "medium" },
      { label: "Restrictions", value: "Pas de tâches nécessitant concentration soutenue, pas de pression temporelle excessive, environnement calme", source: "Rapport_Dr_Weber_2024.pdf", confidence: "high" },
    ],
  },
  {
    id: "pronostic",
    title: "Pronostic",
    icon: "📈",
    fields: [
      { label: "Pronostic", value: "Réservé à moyen terme (6-12 mois)", source: "Rapport_Dr_Weber_2024.pdf", confidence: "high" },
      { label: "Facteurs favorables", value: "Compliance thérapeutique, motivation de la patiente, bon fonctionnement prémorbide", source: "Rapport_Dr_Weber_2024.pdf", confidence: "medium" },
      { label: "Facteurs défavorables", value: "Récurrence du trouble, durée de l'épisode actuel, persistance des troubles du sommeil", source: "Rapport_Dr_Weber_2024.pdf", confidence: "medium" },
      { label: "Réévaluation", value: "Recommandée dans 6 mois", source: "Rapport_Dr_Weber_2024.pdf", confidence: "high" },
    ],
  },
];
