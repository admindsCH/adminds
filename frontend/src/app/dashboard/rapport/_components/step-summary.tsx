"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Subheading } from "@/components/heading";
import { Text } from "@/components/text";
import { Badge } from "@/components/badge";
import {
  CheckCircle2,
  Circle,
  CircleDotDashed,
  ChevronRight,
  Clock,
  Stethoscope,
  Pill,
  Briefcase,
  Gauge,
  RotateCcw,
  Brain,
  Activity,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import type { WizardDocument } from "../_types";
import type {
  PatientDossier,
  PatientDossierPatch,
  Rubriques,
  TimelineEntry,
  Medication,
  Diagnostic,
} from "@/lib/schemas/classification";
import { api } from "@/lib/api";
import { DossierChat } from "./dossier-chat";

// ── Props ────────────────────────────────────────────────

interface StepSummaryProps {
  docs: WizardDocument[];
  notes: string;
  dateFrom: string;
  dateTo: string;
  dossierId: string | null;
  dossier: PatientDossier | null;
  onDossierChange: (dossierId: string, dossier: PatientDossier) => void;
}

// ── Rubrique config ──────────────────────────────────────

interface RubriqueConfig {
  key: keyof Rubriques;
  title: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  badgeColor: "red" | "orange" | "amber" | "blue" | "purple" | "green" | "teal" | "violet" | "emerald";
  /** Human-readable labels for each sub-field */
  fieldLabels: Record<string, string>;
  /** Fields that contain structured lists (not prose) */
  listFields?: string[];
}

const RUBRIQUE_CONFIGS: RubriqueConfig[] = [
  {
    key: "r01_historique",
    title: "Historique",
    icon: Clock,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    badgeColor: "orange",
    fieldLabels: {
      antecedents: "Antécédents",
      periode_traitement: "Période de traitement",
      consultations: "Consultations",
      intervenants: "Intervenants",
      cause_incapacite: "Cause d'incapacité",
    },
    listFields: ["timeline"],
  },
  {
    key: "r02_clinique",
    title: "Clinique",
    icon: Stethoscope,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    badgeColor: "blue",
    fieldLabels: {
      symptomes_actuels: "Symptômes actuels",
      constats_medicaux: "Constats médicaux",
      diagnostics_incapacitants: "Diagnostics incapacitants",
      diagnostics_sans_incidence: "Diagnostics sans incidence",
      frequence_consultations: "Fréquence consultations",
    },
    listFields: ["diagnostics"],
  },
  {
    key: "r03_traitement",
    title: "Traitement",
    icon: Pill,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    badgeColor: "purple",
    fieldLabels: {
      medication: "Médication",
      plan_traitement: "Plan de traitement",
      pronostic: "Pronostic",
    },
    listFields: ["medications"],
  },
  {
    key: "r04_professionnel",
    title: "Professionnel",
    icon: Briefcase,
    color: "text-green-600",
    bgColor: "bg-green-50",
    badgeColor: "green",
    fieldLabels: {
      activite: "Activité",
      historique_emploi: "Historique emploi",
      exigences_poste: "Exigences du poste",
      historique_it: "Historique IT (%)",
    },
  },
  {
    key: "r05_capacite_travail",
    title: "Capacité de travail",
    icon: Gauge,
    color: "text-red-600",
    bgColor: "bg-red-50",
    badgeColor: "red",
    fieldLabels: {
      heures_jour_habituelle: "Heures/jour (habituelle)",
      heures_jour_adaptee: "Heures/jour (adaptée)",
      rythme: "Rythme",
      absences: "Absences",
    },
  },
  {
    key: "r06_readaptation",
    title: "Réadaptation",
    icon: RotateCcw,
    color: "text-teal-600",
    bgColor: "bg-teal-50",
    badgeColor: "teal",
    fieldLabels: {
      potentiel: "Potentiel",
      obstacles: "Obstacles",
      ressources: "Ressources",
      taches_menageres: "Tâches ménagères",
      facteurs_environnementaux: "Facteurs environnementaux",
    },
  },
  {
    key: "r07_freins_cognition",
    title: "Freins & Cognition",
    icon: Brain,
    color: "text-violet-600",
    bgColor: "bg-violet-50",
    badgeColor: "violet",
    fieldLabels: {
      freins_psy: "Freins psychiatriques",
      fonctions_cognitives: "Fonctions cognitives",
    },
  },
  {
    key: "r08_activites",
    title: "Activités",
    icon: Activity,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    badgeColor: "emerald",
    fieldLabels: {
      limitations_fonctionnelles: "Limitations fonctionnelles",
      activites_possibles: "Activités possibles",
      capacite_conduire: "Capacité de conduire",
    },
  },
];

// ── Helpers ──────────────────────────────────────────────

function formatDate(raw: string | null): string {
  if (!raw) return "—";
  try {
    const d = new Date(raw + "T00:00:00");
    return d.toLocaleDateString("fr-CH", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return raw;
  }
}

/** Count filled prose fields in a rubrique (excludes list fields). */
function countFilled(data: Record<string, unknown>, config: RubriqueConfig): { filled: number; total: number } {
  const proseKeys = Object.keys(config.fieldLabels);
  const filled = proseKeys.filter((k) => {
    const v = data[k];
    return typeof v === "string" && v.length > 0;
  }).length;
  return { filled, total: proseKeys.length };
}

const INPUT_CLASS =
  "block w-full rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm text-zinc-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400";

const DIAG_TYPE_BADGE: Record<string, { color: "red" | "zinc" | "amber"; label: string }> = {
  incapacitant: { color: "red", label: "Incapacitant" },
  sans_incidence: { color: "zinc", label: "Sans incidence" },
  inconnu: { color: "amber", label: "Non déterminé" },
};

// ── Progress checklist (shown during dossier parsing) ────

// Maps SSE step keys → display info (reuses RUBRIQUE_CONFIGS colors/icons)
const STEP_META: Record<string, { label: string; Icon: React.ElementType; color: string; bgColor: string }> = {
  extraction:        { label: "Lecture des documents",   Icon: Activity,    color: "text-zinc-500",   bgColor: "bg-zinc-100" },
  patient_info:      { label: "Informations patient",    Icon: Activity,    color: "text-indigo-600", bgColor: "bg-indigo-50" },
  r01_historique:    { label: "Historique",              Icon: Clock,       color: "text-orange-600", bgColor: "bg-orange-50" },
  r02_clinique:      { label: "Clinique",                Icon: Stethoscope, color: "text-blue-600",   bgColor: "bg-blue-50" },
  r03_traitement:    { label: "Traitement",              Icon: Pill,        color: "text-purple-600", bgColor: "bg-purple-50" },
  r04_professionnel: { label: "Professionnel",           Icon: Briefcase,   color: "text-green-600",  bgColor: "bg-green-50" },
  r05_capacite_travail: { label: "Capacité de travail", Icon: Gauge,       color: "text-red-600",    bgColor: "bg-red-50" },
  r06_readaptation:  { label: "Réadaptation",            Icon: RotateCcw,   color: "text-teal-600",   bgColor: "bg-teal-50" },
  r07_freins_cognition: { label: "Freins & Cognition",  Icon: Brain,       color: "text-violet-600", bgColor: "bg-violet-50" },
  r08_activites:     { label: "Activités",               Icon: Activity,    color: "text-emerald-600",bgColor: "bg-emerald-50" },
  saving:            { label: "Enregistrement",          Icon: CheckCircle2,color: "text-zinc-500",   bgColor: "bg-zinc-100" },
};

const STEP_ORDER = [
  "extraction",
  "r01_historique", "r02_clinique", "r03_traitement", "r04_professionnel",
  "r05_capacite_travail", "r06_readaptation", "r07_freins_cognition", "r08_activites",
  "patient_info", "saving",
];

function StreamingProgress({ doneSteps }: { doneSteps: Set<string> }) {
  const activeKey = STEP_ORDER.find((s) => !doneSteps.has(s)) ?? STEP_ORDER[STEP_ORDER.length - 1];
  const meta = STEP_META[activeKey];
  const { Icon } = meta;
  const progress = Math.round((doneSteps.size / STEP_ORDER.length) * 100);

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-5">
      {/* Spinner with current step icon inside */}
      <div className="relative flex h-14 w-14 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-zinc-100 border-t-indigo-500" />
        <AnimatePresence mode="wait">
          <motion.div
            key={activeKey}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.2 }}
            className={`flex h-7 w-7 items-center justify-center rounded-lg ${meta.bgColor}`}
          >
            <Icon className={`h-4 w-4 ${meta.color}`} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Animated label */}
      <div className="h-6 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={activeKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="text-sm font-medium text-zinc-700"
          >
            {activeKey === "extraction" ? "Lecture des documents…" : `Extraction : ${meta.label}…`}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-44 overflow-hidden rounded-full bg-zinc-100">
        <motion.div
          className="h-full rounded-full bg-indigo-500"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ── Animation variants ───────────────────────────────────

const subtaskListVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: {
    height: "auto",
    opacity: 1,
    transition: { duration: 0.25, staggerChildren: 0.04 },
  },
  exit: { height: 0, opacity: 0, transition: { duration: 0.2 } },
};

const subtaskVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.2 } },
};

// ── Date helpers (used for filtering) ─────────────────────

function parseDocDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  try {
    const d = new Date(raw.length <= 7 ? raw + "-01T00:00:00" : raw + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

// ── Main component ───────────────────────────────────────

export function StepSummary({ docs, notes, dateFrom, dateTo, dossierId, dossier, onDossierChange }: StepSummaryProps) {
  const [parsing, setParsing] = useState(false);
  const [doneSteps, setDoneSteps] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [expandedRubriques, setExpandedRubriques] = useState<string[]>([]);

  // ── Filter docs using date filter from Step 2 ───────────
  const filteredDocs = useMemo(() => {
    const doneDocs = docs.filter((d) => d.status === "done");
    if (!dateFrom && !dateTo) return doneDocs;

    const from = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
    const to = dateTo ? new Date(dateTo + "T23:59:59") : null;

    return doneDocs.filter((d) => {
      const docDate = parseDocDate(d.classification?.date);
      if (!docDate) return true; // always include undated docs
      if (from && docDate < from) return false;
      if (to && docDate > to) return false;
      return true;
    });
  }, [docs, dateFrom, dateTo]);

  const savePatch = useCallback(
    async (patch: PatientDossierPatch) => {
      if (!dossierId) return;
      try {
        const { dossier: updated } = await api.updateDossier(dossierId, patch);
        onDossierChange(dossierId, updated);
      } catch (e) {
        console.error("Failed to save dossier patch:", e);
      }
    },
    [dossierId, onDossierChange],
  );

  // ── Auto-parse dossier on mount ─────────────────────────
  const parseStarted = useRef(false);

  useEffect(() => {
    if (dossier) return;
    if (parseStarted.current) return;

    const files = filteredDocs.map((d) => d.file);
    if (files.length === 0) return;

    parseStarted.current = true;

    async function parse() {
      setParsing(true);
      setDoneSteps(new Set());
      setError(null);
      try {
        const { dossier_id, dossier: parsed } = await api.parseDossierStream(files, (event) => {
          if (event.type === "progress" && event.step) {
            setDoneSteps((prev) => new Set([...prev, event.step!]));
          }
        });
        setDoneSteps(new Set(STEP_ORDER)); // mark all done before unmounting progress
        if (notes) {
          const { dossier: withNotes } = await api.updateDossier(dossier_id, { notes });
          onDossierChange(dossier_id, withNotes);
        } else {
          onDossierChange(dossier_id, parsed);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur inattendue");
      } finally {
        setParsing(false);
      }
    }

    parse();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (parsing) return <StreamingProgress doneSteps={doneSteps} />;

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-8 text-center">
        <Text className="font-medium text-red-700">Erreur lors de l&apos;analyse</Text>
        <Text className="mt-1 text-sm text-red-600">{error}</Text>
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="py-20 text-center">
        <Text className="text-zinc-400">Aucun document à analyser.</Text>
      </div>
    );
  }

  const { patient_info, rubriques } = dossier;

  const toggleRubrique = (key: string) => {
    setExpandedRubriques((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Patient info ── */}
      <div className="rounded-lg border border-zinc-200 p-4">
        <Subheading>Patient</Subheading>
        <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-[1fr_1fr_2fr_2fr]">
          <EditableInfoField
            label="Âge"
            value={patient_info.age != null ? `${patient_info.age}` : ""}
            suffix=" ans"
            onSave={(val) => savePatch({ patient_info: { age: val ? parseInt(val, 10) : null } })}
          />
          <EditableInfoField
            label="Sexe"
            value={patient_info.sexe === "homme" ? "Homme" : patient_info.sexe === "femme" ? "Femme" : ""}
            onSave={(val) => {
              const normalized = val.toLowerCase();
              const sexe = normalized.startsWith("h") ? ("homme" as const) : normalized.startsWith("f") ? ("femme" as const) : ("inconnu" as const);
              savePatch({ patient_info: { sexe } });
            }}
          />
          <EditableInfoField
            label="Situation sociale"
            value={patient_info.situation_sociale ?? ""}
            onSave={(val) => savePatch({ patient_info: { situation_sociale: val || null } })}
          />
          <EditableInfoField
            label="Antécédents"
            value={patient_info.antecedents ?? ""}
            onSave={(val) => savePatch({ patient_info: { antecedents: val || null } })}
          />
        </div>
      </div>

      {/* ── Dossier search chat ── */}
      <DossierChat dossier={dossier} />

      {/* ── Rubriques accordion ── */}
      <div className="rounded-lg border border-zinc-200 overflow-hidden">
        <LayoutGroup>
          <div className="divide-y divide-zinc-100">
            {RUBRIQUE_CONFIGS.map((config) => {
              const data = rubriques[config.key] as unknown as Record<string, unknown>;
              const isExpanded = expandedRubriques.includes(config.key);
              const { filled, total } = countFilled(data, config);
              const status = filled === 0 ? "empty" : filled === total ? "complete" : "partial";
              const Icon = config.icon;

              return (
                <div key={config.key}>
                  {/* Rubrique header row */}
                  <motion.div
                    className="group flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-zinc-50/50"
                    onClick={() => toggleRubrique(config.key)}
                    whileTap={{ scale: 0.995 }}
                  >
                    {/* Status icon */}
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.bgColor}`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>

                    {/* Title + count */}
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="text-sm font-medium text-zinc-900">{config.title}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          status === "complete"
                            ? "bg-emerald-100 text-emerald-700"
                            : status === "partial"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-zinc-100 text-zinc-400"
                        }`}
                      >
                        {filled}/{total}
                      </span>
                    </div>

                    {/* Status indicator */}
                    <div className="flex items-center gap-2">
                      {status === "complete" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                      {status === "partial" && <CircleDotDashed className="h-4 w-4 text-amber-500" />}
                      {status === "empty" && <Circle className="h-4 w-4 text-zinc-300" />}
                      <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronRight className="h-4 w-4 text-zinc-400" />
                      </motion.div>
                    </div>
                  </motion.div>

                  {/* Expanded content */}
                  <AnimatePresence mode="wait">
                    {isExpanded && (
                      <motion.div
                        variants={subtaskListVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="border-t border-zinc-100 bg-zinc-50/30"
                      >
                        <div className="px-4 py-3 space-y-1">
                          {/* Prose fields */}
                          {Object.entries(config.fieldLabels).map(([fieldKey, label]) => (
                            <motion.div key={fieldKey} variants={subtaskVariants}>
                              <EditableProseField
                                label={label}
                                value={(data[fieldKey] as string) ?? ""}
                                color={config.color}
                                onSave={(val) => {
                                  savePatch({
                                    rubriques: { [config.key]: { [fieldKey]: val || null } },
                                  });
                                }}
                              />
                            </motion.div>
                          ))}

                          {/* Structured lists */}
                          {config.key === "r01_historique" && (
                            <TimelineList
                              entries={(data.timeline as TimelineEntry[]) ?? []}
                              onSave={(updated) => {
                                savePatch({ rubriques: { r01_historique: { timeline: updated } } });
                              }}
                            />
                          )}
                          {config.key === "r02_clinique" && (
                            <DiagnosticsList
                              items={(data.diagnostics as Diagnostic[]) ?? []}
                              onSave={(updated) => {
                                savePatch({ rubriques: { r02_clinique: { diagnostics: updated } } });
                              }}
                            />
                          )}
                          {config.key === "r03_traitement" && (
                            <MedicationsList
                              items={(data.medications as Medication[]) ?? []}
                              onSave={(updated) => {
                                savePatch({ rubriques: { r03_traitement: { medications: updated } } });
                              }}
                            />
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </LayoutGroup>
      </div>

    </div>
  );
}

// ── Editable info field (patient info) ───────────────────

function EditableInfoField({
  label,
  value,
  suffix,
  onSave,
}: {
  label: string;
  value: string;
  suffix?: string;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [local, setLocal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);
  useEffect(() => { setLocal(value); }, [value]);

  const commit = () => {
    setEditing(false);
    if (local !== value) onSave(local);
  };

  const isLong = value.length > PROSE_TRUNCATE_THRESHOLD || value.includes("\n");

  if (!editing && !value) return null;

  if (editing) {
    return (
      <div>
        <p className="text-xs font-medium text-zinc-400">{label}</p>
        <input
          ref={inputRef}
          type="text"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          className={INPUT_CLASS + " mt-0.5"}
        />
      </div>
    );
  }

  return (
    <div className="group cursor-pointer rounded-md px-1 py-0.5 hover:bg-zinc-50" onClick={() => setEditing(true)}>
      <div className="flex items-center gap-1">
        <p className="text-xs font-medium text-zinc-400">{label}</p>
        <Pencil className="h-3 w-3 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <p
        className={`mt-0.5 text-sm text-zinc-900 ${!expanded && isLong ? "line-clamp-2" : ""}`}
      >
        {value}
        {suffix}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          className="mt-0.5 text-[11px] font-medium text-indigo-500 hover:text-indigo-700"
        >
          {expanded ? "Voir moins ↑" : "Voir plus ↓"}
        </button>
      )}
    </div>
  );
}

// ── Editable prose field (rubrique sub-field) ────────────

const PROSE_TRUNCATE_THRESHOLD = 120;

function EditableProseField({
  label,
  value,
  color: _color,
  onSave,
}: {
  label: string;
  value: string;
  color: string;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [local, setLocal] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [editing]);
  useEffect(() => { setLocal(value); }, [value]);

  const commit = () => {
    setEditing(false);
    if (local !== value) onSave(local);
  };

  const isFilled = value.length > 0;
  const isLong = value.length > PROSE_TRUNCATE_THRESHOLD || value.includes("\n");

  if (!editing && !isFilled) return null;

  if (editing) {
    return (
      <div className="rounded-md border border-zinc-200 bg-white p-3">
        <p className="mb-1 text-xs font-medium text-zinc-500">{label}</p>
        <textarea
          ref={textareaRef}
          value={local}
          onChange={(e) => {
            setLocal(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          className={INPUT_CLASS + " min-h-[60px] resize-none"}
        />
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={commit} className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700">
            OK
          </button>
          <button type="button" onClick={() => { setLocal(value); setEditing(false); }} className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100">
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group rounded-md px-2 py-1.5 hover:bg-white">
      <div className="flex cursor-pointer items-start gap-2" onClick={() => setEditing(true)}>
        <div className="mt-0.5 shrink-0">
          {isFilled ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Circle className="h-3.5 w-3.5 text-zinc-300" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-medium ${isFilled ? "text-zinc-700" : "text-zinc-400"}`}>{label}</p>
          {isFilled && (
            <p className={`mt-0.5 whitespace-pre-wrap text-xs text-zinc-500 ${!expanded && isLong ? "line-clamp-2" : ""}`}>
              {value}
            </p>
          )}
        </div>
      </div>
      {isFilled && isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-0.5 pl-6 text-[11px] font-medium text-indigo-500 hover:text-indigo-700"
        >
          {expanded ? "Voir moins ↑" : "Voir plus ↓"}
        </button>
      )}
    </div>
  );
}

// ── Timeline list (inside R01) ───────────────────────────

function TimelineList({ entries, onSave }: { entries: TimelineEntry[]; onSave: (entries: TimelineEntry[]) => void }) {
  if (entries.length === 0) return null;

  return (
    <motion.div variants={subtaskVariants} className="mt-2">
      <p className="mb-1.5 flex items-center gap-1.5 px-2 text-xs font-medium text-zinc-500">
        <Clock className="h-3 w-3" />
        Chronologie ({entries.length})
      </p>
      <div className="relative ml-3.5 border-l border-zinc-200 pl-4 space-y-2">
        {entries.map((entry, i) => (
          <EditableTimelineItem
            key={i}
            entry={entry}
            onSave={(updated) => {
              const next = [...entries];
              next[i] = updated;
              onSave(next);
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

function EditableTimelineItem({ entry, onSave }: { entry: TimelineEntry; onSave: (updated: TimelineEntry) => void }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(entry);

  useEffect(() => { setLocal(entry); }, [entry]);

  const commit = () => {
    setEditing(false);
    onSave(local);
  };

  if (editing) {
    return (
      <div className="rounded-md border border-zinc-200 bg-white p-2 space-y-1.5">
        <input type="text" value={local.date ?? ""} onChange={(e) => setLocal({ ...local, date: e.target.value || null })} placeholder="YYYY-MM-DD" className={INPUT_CLASS} />
        <input type="text" value={local.title} onChange={(e) => setLocal({ ...local, title: e.target.value })} placeholder="Titre" className={INPUT_CLASS} />
        <input type="text" value={local.source ?? ""} onChange={(e) => setLocal({ ...local, source: e.target.value || null })} placeholder="Source" className={INPUT_CLASS} />
        <textarea value={local.summary} onChange={(e) => setLocal({ ...local, summary: e.target.value })} rows={2} placeholder="Résumé" className={INPUT_CLASS} />
        <div className="flex gap-2">
          <button type="button" onClick={commit} className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700">OK</button>
          <button type="button" onClick={() => { setLocal(entry); setEditing(false); }} className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100">Annuler</button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative cursor-pointer rounded-md py-1 hover:bg-white" onClick={() => setEditing(true)}>
      <div className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full border-2 border-indigo-400 bg-white" />
      <p className="text-[10px] font-medium text-indigo-600">{formatDate(entry.date)}</p>
      <p className="text-xs font-medium text-zinc-800">
        {entry.title}
        {entry.source && <span className="font-normal text-zinc-400"> — {entry.source}</span>}
      </p>
      <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-500">{entry.summary}</p>
    </div>
  );
}

// ── Diagnostics list (inside R02) ────────────────────────

function DiagnosticsList({ items, onSave }: { items: Diagnostic[]; onSave: (items: Diagnostic[]) => void }) {
  return (
    <motion.div variants={subtaskVariants} className="mt-2">
      <p className="mb-1.5 flex items-center gap-1.5 px-2 text-xs font-medium text-zinc-500">
        <Stethoscope className="h-3 w-3" />
        Diagnostics ({items.length})
      </p>
      <div className="space-y-1 px-2">
        {items.map((d, i) => (
          <EditableDiagnosticItem
            key={i}
            item={d}
            onSave={(updated) => {
              const next = [...items];
              next[i] = updated;
              onSave(next);
            }}
            onDelete={() => {
              onSave(items.filter((_, idx) => idx !== i));
            }}
          />
        ))}
        <button
          type="button"
          onClick={() => onSave([...items, { label: "", code_cim: null, type: "inconnu" }])}
          className="flex w-full items-center gap-1.5 rounded-md border border-dashed border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-400 hover:border-zinc-300 hover:text-zinc-600"
        >
          <Plus className="h-3 w-3" />
          Ajouter un diagnostic
        </button>
      </div>
    </motion.div>
  );
}

function EditableDiagnosticItem({ item, onSave, onDelete }: { item: Diagnostic; onSave: (updated: Diagnostic) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(item);

  useEffect(() => { setLocal(item); }, [item]);

  const commit = () => {
    setEditing(false);
    if (local.label) onSave(local);
  };

  if (editing) {
    return (
      <div className="rounded-md border border-zinc-200 bg-white p-2 space-y-1.5">
        <input type="text" value={local.label} onChange={(e) => setLocal({ ...local, label: e.target.value })} placeholder="Diagnostic" className={INPUT_CLASS} />
        <input type="text" value={local.code_cim ?? ""} onChange={(e) => setLocal({ ...local, code_cim: e.target.value || null })} placeholder="Code CIM (ex: F32.1)" className={INPUT_CLASS} />
        <select
          value={local.type}
          onChange={(e) => setLocal({ ...local, type: e.target.value as Diagnostic["type"] })}
          className={INPUT_CLASS}
        >
          <option value="incapacitant">Incapacitant</option>
          <option value="sans_incidence">Sans incidence</option>
          <option value="inconnu">Non déterminé</option>
        </select>
        <div className="flex gap-2">
          <button type="button" onClick={commit} className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700">OK</button>
          <button type="button" onClick={() => { setLocal(item); setEditing(false); }} className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100">Annuler</button>
        </div>
      </div>
    );
  }

  const badge = DIAG_TYPE_BADGE[item.type] ?? DIAG_TYPE_BADGE.inconnu;
  return (
    <div className="group flex cursor-pointer items-center gap-2 rounded-md border border-zinc-100 bg-white px-2.5 py-1.5 hover:border-zinc-200" onClick={() => setEditing(true)}>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-zinc-800">{item.label || <span className="text-zinc-300">—</span>}</p>
        {item.code_cim && <p className="text-[10px] text-zinc-400">{item.code_cim}</p>}
      </div>
      <Badge color={badge.color} className="shrink-0 text-[10px]">{badge.label}</Badge>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="shrink-0 rounded p-0.5 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

// ── Medications list (inside R03) ────────────────────────

function MedicationsList({ items, onSave }: { items: Medication[]; onSave: (items: Medication[]) => void }) {
  return (
    <motion.div variants={subtaskVariants} className="mt-2">
      <p className="mb-1.5 flex items-center gap-1.5 px-2 text-xs font-medium text-zinc-500">
        <Pill className="h-3 w-3" />
        Médication ({items.length})
      </p>
      <div className="space-y-0.5 px-2">
        {items.map((m, i) => (
          <EditableMedicationItem
            key={i}
            item={m}
            onSave={(updated) => {
              const next = [...items];
              next[i] = updated;
              onSave(next);
            }}
            onDelete={() => {
              onSave(items.filter((_, idx) => idx !== i));
            }}
          />
        ))}
        <button
          type="button"
          onClick={() => onSave([...items, { nom: "", dosage: null, date: null }])}
          className="flex w-full items-center gap-1.5 rounded-md border border-dashed border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-400 hover:border-zinc-300 hover:text-zinc-600"
        >
          <Plus className="h-3 w-3" />
          Ajouter un médicament
        </button>
      </div>
    </motion.div>
  );
}

function EditableMedicationItem({ item, onSave, onDelete }: { item: Medication; onSave: (updated: Medication) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(item);

  useEffect(() => { setLocal(item); }, [item]);

  const commit = () => {
    setEditing(false);
    if (local.nom) onSave(local);
  };

  if (editing) {
    return (
      <div className="rounded-md border border-zinc-200 bg-white p-2 space-y-1.5">
        <input type="text" value={local.nom} onChange={(e) => setLocal({ ...local, nom: e.target.value })} placeholder="Nom du médicament" className={INPUT_CLASS} />
        <input type="text" value={local.dosage ?? ""} onChange={(e) => setLocal({ ...local, dosage: e.target.value || null })} placeholder="Dosage (ex: 50mg)" className={INPUT_CLASS} />
        <input type="text" value={local.date ?? ""} onChange={(e) => setLocal({ ...local, date: e.target.value || null })} placeholder="Date (YYYY-MM-DD)" className={INPUT_CLASS} />
        <div className="flex gap-2">
          <button type="button" onClick={commit} className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700">OK</button>
          <button type="button" onClick={() => { setLocal(item); setEditing(false); }} className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100">Annuler</button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex cursor-pointer items-baseline gap-2 rounded-md bg-white px-2.5 py-1 text-xs hover:bg-zinc-50" onClick={() => setEditing(true)}>
      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
      <span className="font-medium text-zinc-800">{item.nom || <span className="text-zinc-300">—</span>}</span>
      {item.dosage && <span className="text-zinc-500">{item.dosage}</span>}
      {item.date && <span className="ml-auto text-[10px] text-zinc-400">{formatDate(item.date)}</span>}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="shrink-0 rounded p-0.5 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}
