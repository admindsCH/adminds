"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Subheading } from "@/components/heading";
import { Text } from "@/components/text";
import { Badge } from "@/components/badge";
import type { WizardDocument } from "@/lib/mock-data";
import type {
  PatientDossier,
  PatientDossierPatch,
  TimelineEntry,
  Medication,
  Diagnostic,
} from "@/lib/schemas/classification";
import { api } from "@/lib/api";

// ── Props ────────────────────────────────────────────────

interface StepSummaryProps {
  docs: WizardDocument[];
  notes: string;
  dossierId: string | null;
  dossier: PatientDossier | null;
  onDossierChange: (dossierId: string, dossier: PatientDossier) => void;
}

// ── Diagnostic type badge config ─────────────────────────

const DIAG_TYPE_BADGE: Record<string, { color: "red" | "zinc" | "amber"; label: string }> = {
  incapacitant: { color: "red", label: "Incapacitant" },
  sans_incidence: { color: "zinc", label: "Sans incidence" },
  inconnu: { color: "amber", label: "Non déterminé" },
};

// ── Date formatting helper ───────────────────────────────

/** Format YYYY-MM-DD → "25 juin 2024". Falls back to raw string. */
function formatDate(raw: string | null): string {
  if (!raw) return "—";
  try {
    const d = new Date(raw + "T00:00:00");
    return d.toLocaleDateString("fr-CH", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return raw;
  }
}

// ── Shared input styles ──────────────────────────────────

const INPUT_CLASS =
  "block w-full rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm text-zinc-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400";

// ── Pencil icon ──────────────────────────────────────────

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
    </svg>
  );
}

// ── Progress checklist (shown during dossier parsing) ────

/** Labels for each step shown during the parsing flow. */
const PROGRESS_STEPS = [
  "Préparation des documents",
  "Analyse du dossier (peut prendre quelques minutes)",
  "Enregistrement",
];

/** Spinner icon — 16×16 animated circle. */
function SpinnerIcon() {
  return (
    <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
  );
}

/** Checkmark icon — 16×16 green circle with tick. */
function CheckIcon() {
  return (
    <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
    </svg>
  );
}

/**
 * Renders a vertical checklist of steps. Each step shows:
 * - a green checkmark if completed (index < currentStep)
 * - a spinner if in progress (index === currentStep)
 * - a gray dot if pending (index > currentStep)
 */
function ProgressChecklist({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <ul className="space-y-3">
        {PROGRESS_STEPS.map((label, i) => {
          // Determine the visual state of this step
          const done = i < currentStep;
          const active = i === currentStep;

          return (
            <li key={i} className="flex items-center gap-3">
              {/* Icon: checkmark, spinner, or gray dot */}
              {done ? (
                <CheckIcon />
              ) : active ? (
                <SpinnerIcon />
              ) : (
                <span className="flex h-4 w-4 items-center justify-center">
                  <span className="h-2 w-2 rounded-full bg-zinc-300" />
                </span>
              )}
              {/* Label: bold when active, muted when pending */}
              <span
                className={
                  done
                    ? "text-sm text-zinc-500"
                    : active
                      ? "text-sm font-medium text-zinc-900"
                      : "text-sm text-zinc-400"
                }
              >
                {label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Component ────────────────────────────────────────────

export function StepSummary({ docs, notes, dossierId, dossier, onDossierChange }: StepSummaryProps) {
  // Progress tracking: null = not started, 0..2 = current step index, 3 = all done
  const [progressStep, setProgressStep] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Auto-save helper ────────────────────────────────────

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
    [dossierId, onDossierChange]
  );

  // ── Parse dossier on mount (only if not already parsed) ──

  // Ref prevents the duplicate call caused by React StrictMode's
  // double-mount in development (mount → unmount → mount).
  const parseStarted = useRef(false);

  useEffect(() => {
    // Skip if we already have a dossier from a previous visit to this step
    if (dossier) return;
    // Guard against StrictMode double-mount firing a second API call
    if (parseStarted.current) return;

    const files = docs.filter((d) => d.status === "done").map((d) => d.file);
    if (files.length === 0) return;

    parseStarted.current = true;

    async function parse() {
      // Step 0: Préparation des documents
      setProgressStep(0);
      setError(null);

      try {
        // Step 1: Analyse par l'IA (the long call)
        setProgressStep(1);
        const { dossier_id, dossier: parsed } = await api.parseDossier(files);

        // Step 2: Enregistrement (notes patch if needed)
        setProgressStep(2);
        if (notes) {
          const { dossier: withNotes } = await api.updateDossier(dossier_id, { notes });
          onDossierChange(dossier_id, withNotes);
        } else {
          onDossierChange(dossier_id, parsed);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur inattendue");
      } finally {
        setProgressStep(null);
      }
    }

    parse();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading — step-by-step progress checklist ──────────

  if (progressStep !== null) {
    return <ProgressChecklist currentStep={progressStep} />;
  }

  // ── Error ──────────────────────────────────────────────

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-8 text-center">
        <Text className="font-medium text-red-700">Erreur lors de l&apos;analyse</Text>
        <Text className="mt-1 text-sm text-red-600">{error}</Text>
      </div>
    );
  }

  // ── No data ────────────────────────────────────────────

  if (!dossier) {
    return (
      <div className="py-20 text-center">
        <Text className="text-zinc-400">Aucun document à analyser.</Text>
      </div>
    );
  }

  const { patient_info, timeline, medications, diagnostics } = dossier;

  // ── Render ─────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-8">
      {/* ── Patient info — editable fields ── */}
      <div className="rounded-lg border border-zinc-200 p-4">
        <Subheading>Patient</Subheading>
        <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
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
              const sexe = normalized.startsWith("h") ? "homme" as const : normalized.startsWith("f") ? "femme" as const : "inconnu" as const;
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

      {/* ── 2-column: timeline (left) + diagnostics & meds (right) ── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        {/* Left: Timeline */}
        {timeline.length > 0 && (
          <div>
            <Subheading>Chronologie ({timeline.length})</Subheading>
            <div className="relative mt-3 ml-3">
              {/* Vertical connector line */}
              <div className="absolute top-0 bottom-0 left-0 w-px bg-zinc-200" />
              {timeline.map((entry, i) => (
                <EditableTimelineItem
                  key={i}
                  entry={entry}
                  isLast={i === timeline.length - 1}
                  onSave={(updated) => {
                    const newTimeline = [...timeline];
                    newTimeline[i] = updated;
                    savePatch({ timeline: newTimeline });
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Right: Diagnostics + Medications stacked */}
        <div className="flex flex-col gap-8">
          {/* Diagnostics */}
          {diagnostics.length > 0 && (
            <div>
              <Subheading>Diagnostics ({diagnostics.length})</Subheading>
              <ul className="mt-3 space-y-2">
                {diagnostics.map((d, i) => (
                  <EditableDiagnosticItem
                    key={i}
                    diagnostic={d}
                    onSave={(updated) => {
                      const newDiags = [...diagnostics];
                      newDiags[i] = updated;
                      savePatch({ diagnostics: newDiags });
                    }}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* Medications */}
          {medications.length > 0 && (
            <div>
              <Subheading>Médication ({medications.length})</Subheading>
              <ul className="mt-3 space-y-1">
                {medications.map((m, i) => (
                  <EditableMedicationItem
                    key={i}
                    medication={m}
                    onSave={(updated) => {
                      const newMeds = [...medications];
                      newMeds[i] = updated;
                      savePatch({ medications: newMeds });
                    }}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

// ── Editable info field ──────────────────────────────────

/** Click-to-edit text field. Shows value as text, toggles to input on click. Auto-saves on blur/Enter. */
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
  const [local, setLocal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // Sync local state when value prop changes (after backend response)
  useEffect(() => { setLocal(value); }, [value]);

  const commit = () => {
    setEditing(false);
    if (local !== value) onSave(local);
  };

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
    <div
      className="group cursor-pointer rounded-md px-1 py-0.5 hover:bg-zinc-50"
      onClick={() => setEditing(true)}
    >
      <p className="text-xs font-medium text-zinc-400">{label}</p>
      <div className="mt-0.5 flex items-center gap-1">
        <p className="text-sm text-zinc-900">
          {value || <span className="text-zinc-300">—</span>}
          {value && suffix}
        </p>
        <PencilIcon className="h-3 w-3 text-zinc-300 opacity-0 group-hover:opacity-100" />
      </div>
    </div>
  );
}

// ── Editable timeline item ───────────────────────────────

function EditableTimelineItem({
  entry,
  isLast,
  onSave,
}: {
  entry: TimelineEntry;
  isLast: boolean;
  onSave: (updated: TimelineEntry) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(entry);

  useEffect(() => { setLocal(entry); }, [entry]);

  const commit = () => {
    setEditing(false);
    onSave(local);
  };

  if (editing) {
    return (
      <div className={`relative pl-6 ${isLast ? "pb-0" : "pb-6"}`}>
        <div className="absolute left-0 top-1 -translate-x-1/2">
          <span className="block h-2.5 w-2.5 rounded-full border-2 border-indigo-500 bg-white" />
        </div>
        <div className="flex flex-col gap-1.5">
          <input
            type="text"
            value={local.date ?? ""}
            onChange={(e) => setLocal({ ...local, date: e.target.value || null })}
            placeholder="YYYY-MM-DD"
            className={INPUT_CLASS}
          />
          <input
            type="text"
            value={local.title}
            onChange={(e) => setLocal({ ...local, title: e.target.value })}
            placeholder="Titre"
            className={INPUT_CLASS}
          />
          <input
            type="text"
            value={local.source ?? ""}
            onChange={(e) => setLocal({ ...local, source: e.target.value || null })}
            placeholder="Source"
            className={INPUT_CLASS}
          />
          <textarea
            value={local.summary}
            onChange={(e) => setLocal({ ...local, summary: e.target.value })}
            rows={2}
            placeholder="Résumé"
            className={INPUT_CLASS}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={commit}
              className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
            >
              OK
            </button>
            <button
              type="button"
              onClick={() => { setLocal(entry); setEditing(false); }}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative cursor-pointer rounded-md pl-6 hover:bg-zinc-50 ${isLast ? "pb-0" : "pb-6"}`}
      onClick={() => setEditing(true)}
    >
      <div className="absolute left-0 top-1 -translate-x-1/2">
        <span className="block h-2.5 w-2.5 rounded-full border-2 border-indigo-500 bg-white" />
      </div>
      <p className="text-xs font-medium text-indigo-600">
        {formatDate(entry.date)}
      </p>
      <p className="mt-0.5 text-sm font-medium text-zinc-900">
        {entry.title}
        {entry.source && (
          <span className="ml-1.5 font-normal text-zinc-400">— {entry.source}</span>
        )}
        <PencilIcon className="ml-1 inline h-3 w-3 text-zinc-300 opacity-0 group-hover:opacity-100" />
      </p>
      <p className="mt-0.5 text-xs leading-5 text-zinc-600">{entry.summary}</p>
    </div>
  );
}

// ── Editable diagnostic item ─────────────────────────────

function EditableDiagnosticItem({
  diagnostic,
  onSave,
}: {
  diagnostic: Diagnostic;
  onSave: (updated: Diagnostic) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(diagnostic);

  useEffect(() => { setLocal(diagnostic); }, [diagnostic]);

  const commit = () => {
    setEditing(false);
    onSave(local);
  };

  const badge = DIAG_TYPE_BADGE[diagnostic.type] ?? DIAG_TYPE_BADGE.inconnu;

  if (editing) {
    return (
      <li className="rounded-md border border-indigo-200 bg-indigo-50/30 px-3 py-2">
        <div className="flex flex-col gap-1.5">
          <input
            type="text"
            value={local.label}
            onChange={(e) => setLocal({ ...local, label: e.target.value })}
            placeholder="Diagnostic"
            className={INPUT_CLASS}
          />
          <input
            type="text"
            value={local.code_cim ?? ""}
            onChange={(e) => setLocal({ ...local, code_cim: e.target.value || null })}
            placeholder="Code CIM-10"
            className={INPUT_CLASS}
          />
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
            <button
              type="button"
              onClick={commit}
              className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
            >
              OK
            </button>
            <button
              type="button"
              onClick={() => { setLocal(diagnostic); setEditing(false); }}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100"
            >
              Annuler
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li
      className="group flex cursor-pointer items-start gap-2 rounded-md border border-zinc-100 px-3 py-2 hover:bg-zinc-50"
      onClick={() => setEditing(true)}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <p className="text-sm font-medium text-zinc-900">{diagnostic.label}</p>
          <PencilIcon className="h-3 w-3 text-zinc-300 opacity-0 group-hover:opacity-100" />
        </div>
        {diagnostic.code_cim && (
          <p className="text-xs text-zinc-400">{diagnostic.code_cim}</p>
        )}
      </div>
      <Badge color={badge.color} className="shrink-0">{badge.label}</Badge>
    </li>
  );
}

// ── Editable medication item ─────────────────────────────

function EditableMedicationItem({
  medication,
  onSave,
}: {
  medication: Medication;
  onSave: (updated: Medication) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(medication);

  useEffect(() => { setLocal(medication); }, [medication]);

  const commit = () => {
    setEditing(false);
    onSave(local);
  };

  if (editing) {
    return (
      <li className="rounded-md border border-indigo-200 bg-indigo-50/30 px-3 py-1.5">
        <div className="flex flex-col gap-1.5">
          <input
            type="text"
            value={local.nom}
            onChange={(e) => setLocal({ ...local, nom: e.target.value })}
            placeholder="Médicament"
            className={INPUT_CLASS}
          />
          <input
            type="text"
            value={local.dosage ?? ""}
            onChange={(e) => setLocal({ ...local, dosage: e.target.value || null })}
            placeholder="Dosage"
            className={INPUT_CLASS}
          />
          <input
            type="text"
            value={local.date ?? ""}
            onChange={(e) => setLocal({ ...local, date: e.target.value || null })}
            placeholder="YYYY-MM-DD"
            className={INPUT_CLASS}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={commit}
              className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
            >
              OK
            </button>
            <button
              type="button"
              onClick={() => { setLocal(medication); setEditing(false); }}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100"
            >
              Annuler
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li
      className="group flex cursor-pointer items-baseline gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-zinc-50"
      onClick={() => setEditing(true)}
    >
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
      <span className="font-medium text-zinc-900">{medication.nom}</span>
      {medication.dosage && <span className="text-zinc-500">{medication.dosage}</span>}
      {medication.date && (
        <span className="ml-auto shrink-0 text-xs text-zinc-400">{formatDate(medication.date)}</span>
      )}
      <PencilIcon className="h-3 w-3 shrink-0 text-zinc-300 opacity-0 group-hover:opacity-100" />
    </li>
  );
}
