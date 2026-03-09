"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Subheading } from "@/components/heading";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import {
  CANTONS,
  MOCK_FRIBOURG_FIELDS,
  MOCK_GENEVE_FIELDS,
  type Canton,
  type ReportFieldSection,
} from "@/lib/mock-data";
import { renderAsync } from "docx-preview";
import clsx from "clsx";

// ── Constants ────────────────────────────────────────────

/** Simulated generation steps with labels and durations (ms). */
const GEN_STEPS = [
  { label: "Extraction des données du dossier patient", duration: 2200 },
  { label: "Analyse des antécédents médicaux", duration: 1800 },
  { label: "Intégration des notes du médecin", duration: 1400 },
  { label: "Rédaction du rapport AI", duration: 2500 },
  { label: "Mise en forme du document", duration: 1000 },
];

// ── Icons ────────────────────────────────────────────────

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

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

// ── Sub-components ───────────────────────────────────────

/** Progress list shown during generation. */
function GenerationProgress({ currentStep }: { currentStep: number }) {
  return (
    <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 px-5 py-4">
      <ul className="flex flex-col gap-3">
        {GEN_STEPS.map((s, i) => {
          const done = currentStep > i;
          const active = currentStep === i;
          return (
            <li key={i} className="flex items-center gap-3">
              {/* Icon: checkmark / spinner / dot */}
              {done ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600">
                  <CheckIcon className="h-3 w-3 text-white" />
                </span>
              ) : active ? (
                <span className="flex h-5 w-5 items-center justify-center">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                </span>
              ) : (
                <span className="flex h-5 w-5 items-center justify-center">
                  <span className="h-2 w-2 rounded-full bg-zinc-300" />
                </span>
              )}
              <span
                className={clsx(
                  "text-sm transition-colors",
                  done && "text-zinc-900",
                  active && "font-medium text-indigo-700",
                  !done && !active && "text-zinc-400"
                )}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Collapsible section in the slide-over editor. */
function EditorSection({
  section,
  editedValues,
  onFieldChange,
  isCollapsed,
  onToggle,
  onUpdate,
}: {
  section: ReportFieldSection;
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
                    value={editedValues[field.id] ?? field.value}
                    onChange={(e) => onFieldChange(field.id, e.target.value)}
                    rows={4}
                    className={INPUT_CLASS + " py-2"}
                  />
                ) : (
                  <input
                    type="text"
                    value={editedValues[field.id] ?? field.value}
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
}

/**
 * Step 4: report generation, in-browser docx preview, and slide-over editor.
 * All state (generation progress, editor values, docx blob) is local.
 */
export function StepReport({ canton }: StepReportProps) {
  // Generation state
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [genStep, setGenStep] = useState(-1);

  // Docx preview
  const previewRef = useRef<HTMLDivElement>(null);
  const docxBlobRef = useRef<Blob | null>(null);
  const [docxLoading, setDocxLoading] = useState(false);

  // Editor slide-over
  const [editedSections, setEditedSections] = useState<Record<string, string>>({});
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [showEditor, setShowEditor] = useState(false);

  // Which template fields to use based on canton
  const templateFields: ReportFieldSection[] =
    canton === "geneve" ? MOCK_GENEVE_FIELDS : MOCK_FRIBOURG_FIELDS;

  // ── Docx preview loading ───────────────────────────────

  useEffect(() => {
    if (!previewRef.current) return;
    let cancelled = false;

    async function loadDocx() {
      setDocxLoading(true);
      try {
        const suffix = generated ? "-filled" : "";
        const res = await fetch(`/templates/${canton}${suffix}.docx`);
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
    return () => {
      cancelled = true;
    };
  }, [canton, generated]);

  // ── Generation ─────────────────────────────────────────

  const generate = useCallback(() => {
    setGenerating(true);
    setGenStep(0);

    let currentStep = 0;
    const advance = () => {
      currentStep += 1;
      if (currentStep < GEN_STEPS.length) {
        setGenStep(currentStep);
        setTimeout(advance, GEN_STEPS[currentStep].duration);
      } else {
        setGenStep(GEN_STEPS.length);
        setTimeout(() => {
          setGenerating(false);
          setGenerated(true);
          // Pre-fill editable fields from the canton template
          const initial: Record<string, string> = {};
          for (const section of templateFields) {
            for (const field of section.fields) {
              initial[field.id] = field.value;
            }
          }
          setEditedSections(initial);
          setShowEditor(true);
        }, 500);
      }
    };
    setTimeout(advance, GEN_STEPS[0].duration);
  }, [templateFields]);

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
    setEditedSections((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  const simulateUpdate = useCallback(() => {
    setDocxLoading(true);
    setTimeout(() => setDocxLoading(false), 800);
  }, []);

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
            <Button color="indigo" onClick={generate} disabled={generating}>
              {generating ? "Génération..." : "Générer"}
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

      {/* Generation progress */}
      {generating && <GenerationProgress currentStep={genStep} />}

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
                {templateFields.map((section) => (
                  <EditorSection
                    key={section.id}
                    section={section}
                    editedValues={editedSections}
                    onFieldChange={updateField}
                    isCollapsed={collapsedSections.has(section.id)}
                    onToggle={() => toggleSection(section.id)}
                    onUpdate={simulateUpdate}
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
