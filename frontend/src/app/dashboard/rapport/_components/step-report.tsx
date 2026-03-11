"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Subheading } from "@/components/heading";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import { CANTONS, type Canton } from "@/lib/mock-data";
import { api } from "@/lib/api";
import type { FieldSchemaEntry } from "@/lib/schemas/report";
import { renderAsync } from "docx-preview";
import clsx from "clsx";

// ── Icons ────────────────────────────────────────────────

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

// ── Progress checklist (reused from step-summary pattern) ──

const REPORT_STEPS = [
  "Préparation du contexte patient",
  "Rédaction du document",
  "Création du document",
  "Rendu de l'aperçu",
];

function SpinnerIcon() {
  return (
    <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
    </svg>
  );
}

function ReportProgressChecklist({ currentStep }: { currentStep: number }) {
  return (
    <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 px-5 py-8">
      <ul className="space-y-3">
        {REPORT_STEPS.map((label, i) => {
          const done = i < currentStep;
          const active = i === currentStep;
          return (
            <li key={i} className="flex items-center gap-3">
              {done ? (
                <CheckIcon />
              ) : active ? (
                <SpinnerIcon />
              ) : (
                <span className="flex h-4 w-4 items-center justify-center">
                  <span className="h-2 w-2 rounded-full bg-zinc-300" />
                </span>
              )}
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

// ── Shared input class ───────────────────────────────────

const INPUT_CLASS =
  "block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400";

// ── Helpers ──────────────────────────────────────────────

/** Build a descriptive filename for downloads. */
function buildFilename(ext: string): string {
  const patient = "Marie Dupont"; // TODO: replace with real patient name
  const type = "Première demande AI"; // TODO: replace with real stade
  const date = new Date()
    .toLocaleDateString("fr-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    .replace(/\//g, ".");
  return `Rapport AI - ${patient} - ${type} - ${date}.${ext}`;
}

// ── Types for editor sections (built from backend field_schema) ──

interface EditorField {
  id: string;
  label: string;
  type: "text" | "multiline" | "date";
}

interface EditorSection {
  id: string;
  title: string;
  fields: EditorField[];
}

/** Build editor sections by grouping schema entries by `section`.
 *  Uses field value length to decide text vs multiline rendering. */
function buildEditorSections(
  schema: FieldSchemaEntry[],
  values: Record<string, string | boolean>,
): EditorSection[] {
  const sectionMap = new Map<string, EditorField[]>();

  for (const entry of schema) {
    // Skip checkbox/choice fields — not editable as text (they map to "X" marks)
    if (entry.type === "checkbox") continue;

    if (!sectionMap.has(entry.section)) sectionMap.set(entry.section, []);
    const val = values[entry.id];
    // Render as multiline if value is long or contains newlines
    const isLong =
      typeof val === "string" && (val.length > 80 || val.includes("\n"));
    sectionMap.get(entry.section)!.push({
      id: entry.id,
      label: entry.label,
      type: entry.type === "date" ? "date" : isLong ? "multiline" : "text",
    });
  }

  return Array.from(sectionMap.entries()).map(([title, fields], i) => ({
    id: `section_${i}`,
    title,
    fields,
  }));
}

/** Convert a base64 string to a Blob (for docx-preview rendering). */
function base64ToBlob(base64: string): Blob {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  return new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

// ── Sub-components ───────────────────────────────────────

/** Collapsible section in the slide-over editor. */
function EditorSectionPanel({
  section,
  editedValues,
  onFieldChange,
  isCollapsed,
  onToggle,
  onUpdate,
}: {
  section: EditorSection;
  editedValues: Record<string, string>;
  onFieldChange: (fieldId: string, value: string) => void;
  isCollapsed: boolean;
  onToggle: () => void;
  onUpdate: () => void;
}) {
  return (
    <div className="rounded-lg border border-zinc-200">
      {/* Header — click to expand/collapse */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-zinc-900">
          {section.title}
        </span>
        <ChevronIcon
          className={clsx(
            "h-4 w-4 text-zinc-400 transition-transform",
            !isCollapsed && "rotate-180"
          )}
        />
      </button>

      {/* Body — labeled fields */}
      {!isCollapsed && (
        <div className="border-t border-zinc-100 px-4 py-3">
          <div className="flex flex-col gap-4">
            {section.fields.map((field) => (
              <div key={field.id}>
                <label className="mb-1 block text-xs font-medium text-zinc-500">
                  {field.label}
                </label>
                {field.type === "multiline" ? (
                  <textarea
                    value={editedValues[field.id] ?? ""}
                    onChange={(e) => onFieldChange(field.id, e.target.value)}
                    rows={4}
                    className={INPUT_CLASS + " py-2"}
                  />
                ) : (
                  <input
                    type="text"
                    value={editedValues[field.id] ?? ""}
                    onChange={(e) => onFieldChange(field.id, e.target.value)}
                    className={INPUT_CLASS}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <Button outline onClick={onUpdate}>
              Mettre à jour
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────

interface StepReportProps {
  canton: Canton;
  dossierId: string | null;
}

/**
 * Report generation step: calls backend to fill the .docx template,
 * renders in-browser preview, and provides a slide-over editor.
 */
export function StepReport({ canton, dossierId }: StepReportProps) {
  // Generation state: null = idle, 0..3 = current step index
  const [genStep, setGenStep] = useState<number | null>(null);
  const [generated, setGenerated] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Docx preview
  const previewRef = useRef<HTMLDivElement>(null);
  const docxBlobRef = useRef<Blob | null>(null);
  const [docxLoading, setDocxLoading] = useState(false);

  // Real field data from the backend (replaces mock fields)
  const [fieldSchema, setFieldSchema] = useState<FieldSchemaEntry[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string | boolean>>({});

  // Editor slide-over
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [showEditor, setShowEditor] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Build editor sections from backend schema + values (grouped by section name)
  const editorSections = useMemo(
    () => buildEditorSections(fieldSchema, fieldValues),
    [fieldSchema, fieldValues],
  );

  // ── Docx preview loading (empty template shown before generation) ──

  useEffect(() => {
    // After generation, the blob is already set — skip fetching the empty template.
    if (generated) return;
    if (!previewRef.current) return;
    let cancelled = false;

    async function loadDocx() {
      setDocxLoading(true);
      try {
        const res = await fetch(`/templates/${canton}.docx`);
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled || !previewRef.current) return;
        docxBlobRef.current = blob;
        previewRef.current.innerHTML = "";
        await renderAsync(blob, previewRef.current, undefined, {
          ignoreWidth: true,
          ignoreHeight: true,
        });
      } finally {
        if (!cancelled) setDocxLoading(false);
      }
    }

    loadDocx();
    return () => { cancelled = true; };
  }, [canton, generated]);

  // ── Render a blob into the docx preview container ─────

  const renderPreview = useCallback(async (blob: Blob) => {
    docxBlobRef.current = blob;
    if (previewRef.current) {
      previewRef.current.innerHTML = "";
      await renderAsync(blob, previewRef.current, undefined, {
        ignoreWidth: true,
        ignoreHeight: true,
      });
    }
  }, []);

  // ── Generation — calls the real backend endpoint ──────

  const generate = useCallback(async () => {
    if (!dossierId) return;

    setGenError(null);

    try {
      // Step 0: Préparation du contexte patient
      setGenStep(0);

      // Step 1: Rédaction par l'IA (the long API call)
      setGenStep(1);
      const result = await api.generateReport(dossierId, canton);

      // Step 2: Création du document — convert base64 to Blob
      setGenStep(2);
      const blob = base64ToBlob(result.docx_base64);

      // Store real field data from the backend
      setFieldSchema(result.field_schema);
      setFieldValues(result.field_values);

      // Pre-fill editor with string values from the LLM output
      const initial: Record<string, string> = {};
      for (const [key, val] of Object.entries(result.field_values)) {
        initial[key] = String(val);
      }
      setEditedValues(initial);

      // Step 3: Rendu de l'aperçu
      setGenStep(3);
      await renderPreview(blob);

      setGenerated(true);
      setShowEditor(true);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Erreur lors de la génération");
    } finally {
      setGenStep(null);
    }
  }, [dossierId, canton, renderPreview]);

  // ── Downloads ──────────────────────────────────────────

  const downloadDocx = useCallback(() => {
    const blob = docxBlobRef.current;
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildFilename("docx");
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const downloadPdf = useCallback(() => {
    if (!previewRef.current) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const styles = Array.from(
      document.querySelectorAll("style, link[rel='stylesheet']")
    )
      .map((el) => el.outerHTML)
      .join("\n");
    win.document.write(
      `<!DOCTYPE html><html><head><title>${buildFilename("pdf")}</title>${styles}
      <style>@media print { body { margin: 0; } .docx-preview { box-shadow: none !important; } }</style>
      </head><body>${previewRef.current.innerHTML}</body></html>`
    );
    win.document.close();
    win.onload = () => {
      win.print();
      win.close();
    };
  }, []);

  // ── Editor helpers ─────────────────────────────────────

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      next.has(sectionId) ? next.delete(sectionId) : next.add(sectionId);
      return next;
    });
  }, []);

  const updateField = useCallback((fieldId: string, value: string) => {
    setEditedValues((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  /** Re-fill the docx template with user-edited values and refresh preview. */
  const handleUpdate = useCallback(async () => {
    if (!dossierId) return;
    setUpdating(true);
    setDocxLoading(true);
    try {
      const result = await api.updateReport(dossierId, canton, editedValues);
      const blob = base64ToBlob(result.docx_base64);
      await renderPreview(blob);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Erreur lors de la mise à jour");
    } finally {
      setUpdating(false);
      setDocxLoading(false);
    }
  }, [dossierId, canton, editedValues, renderPreview]);

  // ── Render ─────────────────────────────────────────────

  const cantonLabel = CANTONS.find((c) => c.value === canton)?.label;

  return (
    <div>
      {/* Header: title + action buttons */}
      <div className="flex items-center justify-between">
        <div>
          <Subheading>Rapport AI — {cantonLabel}</Subheading>
          <Text>Modèle officiel du canton</Text>
        </div>
        <div className="flex gap-2">
          {!generated && (
            <Button color="indigo" onClick={generate} disabled={genStep !== null || !dossierId}>
              {genStep !== null ? "Génération..." : "Générer"}
            </Button>
          )}
          {generated && (
            <>
              <Button outline onClick={downloadPdf}>
                Télécharger PDF
              </Button>
              <Button color="indigo" onClick={downloadDocx}>
                Télécharger .docx
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Generation progress checklist */}
      {genStep !== null && <ReportProgressChecklist currentStep={genStep} />}

      {/* Generation error */}
      {genError && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-center">
          <Text className="font-medium text-red-700">Erreur lors de la génération</Text>
          <Text className="mt-1 text-sm text-red-600">{genError}</Text>
        </div>
      )}

      {/* Docx preview */}
      <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200 bg-white">
        {docxLoading && (
          <div className="flex items-center justify-center py-32">
            <Text>Chargement du modèle...</Text>
          </div>
        )}
        <div ref={previewRef} className="docx-preview" />
      </div>

      {/* ── Slide-over: editable report sections ── */}
      {generated && (
        <>
          {/* Backdrop */}
          {showEditor && (
            <div
              className="fixed inset-0 z-40 bg-black/20 transition-opacity"
              onClick={() => setShowEditor(false)}
            />
          )}

          {/* Toggle button — fixed on the right edge */}
          {!showEditor && (
            <button
              type="button"
              onClick={() => setShowEditor(true)}
              className="fixed right-0 top-1/2 z-50 -translate-y-1/2 rounded-l-lg bg-indigo-600 px-2 py-4 text-white shadow-lg transition-colors hover:bg-indigo-700"
            >
              <PencilIcon className="h-5 w-5" />
            </button>
          )}

          {/* Panel */}
          <div
            className={clsx(
              "fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl transition-transform duration-300",
              showEditor ? "translate-x-0" : "translate-x-full"
            )}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <span className="text-sm font-semibold text-zinc-900">
                Modifier le rapport
              </span>
              <button
                type="button"
                onClick={() => setShowEditor(false)}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable sections list */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="flex flex-col gap-3">
                {editorSections.map((section) => (
                  <EditorSectionPanel
                    key={section.id}
                    section={section}
                    editedValues={editedValues}
                    onFieldChange={updateField}
                    isCollapsed={collapsedSections.has(section.id)}
                    onToggle={() => toggleSection(section.id)}
                    onUpdate={handleUpdate}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
