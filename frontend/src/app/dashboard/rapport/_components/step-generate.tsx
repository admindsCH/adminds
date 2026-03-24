"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/button";
import { Badge } from "@/components/badge";
import { Text } from "@/components/text";
import { Subheading } from "@/components/heading";
import { api, type TemplateResponse } from "@/lib/api";
import type { FieldSchemaEntry } from "@/lib/schemas/report";
import { renderAsync } from "docx-preview";
import clsx from "clsx";

// ── Types ───────────────────────────────────────────────

type GenerationStatus = "pending" | "preparing" | "generating" | "formatting" | "done" | "error";

interface GenerationResult {
  docxBlob: Blob;
  fieldSchema: FieldSchemaEntry[];
  fieldValues: Record<string, string | boolean>;
  isPdf: boolean;
}

interface CartItem {
  template: TemplateResponse;
  status: GenerationStatus;
  progress: number;
  error?: string;
  result?: GenerationResult;
}

// ── Icons ───────────────────────────────────────────────

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <div className={clsx("animate-spin rounded-full border-2 border-current border-t-transparent", className ?? "h-4 w-4")} />
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
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

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
    </svg>
  );
}

// ── Helpers ─────────────────────────────────────────────

const STATUS_LABELS: Record<GenerationStatus, string> = {
  pending: "En attente",
  preparing: "Préparation du contexte",
  generating: "Rédaction par l'IA",
  formatting: "Mise en forme",
  done: "Terminé",
  error: "Erreur",
};

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

function getFileMeta(filename: string) {
  const isPdf = filename.toLowerCase().endsWith(".pdf");
  const mimeType = isPdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return { isPdf, mimeType };
}

function buildFilename(name: string, ext: string): string {
  const date = new Date()
    .toLocaleDateString("fr-CH", { day: "2-digit", month: "2-digit", year: "numeric" })
    .replace(/\//g, ".");
  return `${name} - ${date}.${ext}`;
}

const INPUT_CLASS =
  "block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400";

// ── Editor types ────────────────────────────────────────

interface EditorField {
  id: string;
  label: string;
  type: "text" | "multiline" | "date";
}

interface EditorSection {
  id: string;
  title: string;
  sectionNumber: string;
  fields: EditorField[];
}

function buildEditorSections(
  schema: FieldSchemaEntry[],
  values: Record<string, string | boolean>,
): EditorSection[] {
  const sectionMap = new Map<string, { fields: EditorField[]; sectionNumber: string }>();

  for (const entry of schema) {
    if (entry.type === "checkbox") continue;
    if (!sectionMap.has(entry.section)) {
      sectionMap.set(entry.section, { fields: [], sectionNumber: entry.section_number ?? "" });
    }
    const val = values[entry.id];
    const isLong = typeof val === "string" && (val.length > 80 || val.includes("\n"));
    sectionMap.get(entry.section)!.fields.push({
      id: entry.id,
      label: entry.label,
      type: entry.type === "date" ? "date" : isLong ? "multiline" : "text",
    });
  }

  return Array.from(sectionMap.entries()).map(([title, { fields, sectionNumber }], i) => ({
    id: `section_${i}`,
    title,
    sectionNumber,
    fields,
  }));
}

// ── Editor Section Panel ────────────────────────────────

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
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-zinc-900">
          {section.sectionNumber && <span className="text-indigo-600 mr-1.5">{section.sectionNumber}</span>}
          {section.title}
        </span>
        <ChevronIcon
          className={clsx("h-4 w-4 text-zinc-400 transition-transform", !isCollapsed && "rotate-180")}
        />
      </button>
      {!isCollapsed && (
        <div className="border-t border-zinc-100 px-4 py-3">
          <div className="flex flex-col gap-4">
            {section.fields.map((field) => (
              <div key={field.id}>
                <label className="mb-1 block text-xs font-medium text-zinc-500">{field.label}</label>
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
            <Button outline onClick={onUpdate}>Mettre à jour</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Document Detail View (docx preview + side panel editor) ─

function DocumentDetailView({
  item,
  canton,
  dossierId,
  onBack,
}: {
  item: CartItem;
  canton: string;
  dossierId: string | null;
  onBack: () => void;
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const docxBlobRef = useRef<Blob | null>(null);

  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [showEditor, setShowEditor] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const result = item.result;

  const editorSections = useMemo(
    () => (result ? buildEditorSections(result.fieldSchema, result.fieldValues) : []),
    [result],
  );

  const pdfUrlRef = useRef<string | null>(null);

  const renderPreview = useCallback(async (blob: Blob, isPdf: boolean) => {
    if (pdfUrlRef.current) { URL.revokeObjectURL(pdfUrlRef.current); pdfUrlRef.current = null; }
    docxBlobRef.current = blob;
    if (!previewRef.current) return;
    previewRef.current.innerHTML = "";
    if (isPdf) {
      const url = URL.createObjectURL(blob);
      pdfUrlRef.current = url;
      const iframe = document.createElement("iframe");
      iframe.src = url;
      iframe.className = "w-full border-0";
      iframe.style.height = "80vh";
      previewRef.current.appendChild(iframe);
    } else {
      await renderAsync(blob, previewRef.current, undefined, { ignoreWidth: true, ignoreHeight: true });
    }
  }, []);

  useEffect(() => {
    if (!result) return;
    renderPreview(result.docxBlob, result.isPdf);
    const initial: Record<string, string> = {};
    for (const [key, val] of Object.entries(result.fieldValues)) {
      initial[key] = String(val);
    }
    setEditedValues(initial);
    return () => { if (pdfUrlRef.current) { URL.revokeObjectURL(pdfUrlRef.current); pdfUrlRef.current = null; } };
  }, [result, renderPreview]);

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

  const handleUpdate = useCallback(async () => {
    if (!dossierId) return;
    setUpdating(true);
    setUpdateError(null);
    try {
      const res = await api.updateReport(dossierId, canton, editedValues, item.template.id);
      const { isPdf, mimeType } = getFileMeta(item.template.filename);
      const blob = base64ToBlob(res.docx_base64, mimeType);
      await renderPreview(blob, isPdf);
    } catch (e) {
      setUpdateError(e instanceof Error ? e.message : "Erreur lors de la mise à jour");
    } finally {
      setUpdating(false);
    }
  }, [dossierId, canton, editedValues, renderPreview]);

  const downloadDocx = useCallback(() => {
    const blob = docxBlobRef.current;
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ext = result?.isPdf ? "pdf" : "docx";
    a.download = buildFilename(item.template.name, ext);
    a.click();
    URL.revokeObjectURL(url);
  }, [item.template.name, result?.isPdf]);

  const downloadPdf = useCallback(() => {
    if (!previewRef.current) return;
    const styles = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"))
      .map((el) => el.outerHTML)
      .join("\n");
    const printStyles = "<style>@media print { body { margin: 0; } .docx-preview { box-shadow: none !important; } }</style>";
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.srcdoc = `<!DOCTYPE html><html><head>${styles}${printStyles}</head><body>${previewRef.current.innerHTML}</body></html>`;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    };
  }, []);

  const insuranceName = item.template.insurance_name;
  const hasEditor = result && editorSections.length > 0;

  return (
    <div>
      {/* Header — back button, title, action buttons (modify + downloads) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Subheading>{item.template.name}</Subheading>
              <Badge color="zinc">{insuranceName || "—"}</Badge>
            </div>
            <Text className="mt-0.5">Document généré</Text>
          </div>
        </div>
        <div className="flex gap-2">
          {hasEditor && (
            <Button outline onClick={() => setShowEditor(!showEditor)}>
              <PencilIcon className="h-4 w-4" />
              {showEditor ? "Fermer" : "Modifier"}
            </Button>
          )}
          {result?.isPdf ? (
            <Button color="indigo" onClick={downloadDocx}>Télécharger PDF</Button>
          ) : (
            <>
              <Button outline onClick={downloadPdf}>Télécharger PDF</Button>
              <Button color="indigo" onClick={downloadDocx}>Télécharger .docx</Button>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {updateError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center">
          <Text className="text-sm text-red-600">{updateError}</Text>
        </div>
      )}

      {/* Docx preview — always full width */}
      <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200 bg-white">
        {updating && (
          <div className="flex items-center justify-center py-32">
            <SpinnerIcon className="mr-2 h-4 w-4 text-indigo-500" />
            <Text>Mise à jour du document...</Text>
          </div>
        )}
        <div ref={previewRef} className="docx-preview" />
      </div>

      {/* Slide-over panel from right */}
      {hasEditor && showEditor && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20 transition-opacity"
            onClick={() => setShowEditor(false)}
          />
          {/* Panel */}
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-zinc-200 bg-white shadow-xl">
            {/* Panel header */}
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <span className="text-sm font-semibold text-zinc-900">Modifier le rapport</span>
              <button
                type="button"
                onClick={() => setShowEditor(false)}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable sections */}
            <div className="flex-1 overflow-y-auto p-5">
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

            {/* Footer with global update button */}
            <div className="border-t border-zinc-200 px-5 py-3 flex justify-end">
              <Button color="indigo" onClick={handleUpdate} disabled={updating}>
                {updating ? "Mise à jour..." : "Mettre à jour le document"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Generation Progress View ────────────────────────────

function RetryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M20.015 4.356v4.992" />
    </svg>
  );
}

function GenerationView({
  cart,
  doneCount,
  allDone,
  onViewItem,
  onRetryItem,
}: {
  cart: CartItem[];
  doneCount: number;
  allDone: boolean;
  onViewItem: (templateId: string) => void;
  onRetryItem: (templateId: string) => void;
}) {
  return (
    <div className="mx-auto max-w-2xl py-8">
      <div className="text-center">
        {allDone ? (
          <>
            <CheckCircleIcon className="mx-auto h-12 w-12 text-emerald-500" />
            <h2 className="mt-4 text-lg font-semibold text-zinc-900">
              {cart.length} document{cart.length > 1 ? "s" : ""} généré{cart.length > 1 ? "s" : ""}
            </h2>
            <Text className="mt-1">Cliquez sur un document pour le consulter et le modifier.</Text>
          </>
        ) : (
          <>
            <SpinnerIcon className="mx-auto h-8 w-8 text-indigo-600" />
            <h2 className="mt-4 text-lg font-semibold text-zinc-900">Génération en cours</h2>
            <Text className="mt-1">
              {doneCount} sur {cart.length} — les documents sont générés en parallèle
            </Text>
          </>
        )}
      </div>

      <div className="mt-8 h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div
          className={clsx(
            "h-full rounded-full transition-all duration-500",
            allDone ? "bg-emerald-500" : "bg-indigo-500"
          )}
          style={{ width: `${(doneCount / cart.length) * 100}%` }}
        />
      </div>

      <ul className="mt-8 space-y-3">
        {cart.map((item) => {
          const insuranceName = item.template.insurance_name;
          const isDone = item.status === "done";

          return (
            <li key={item.template.id}>
              <button
                type="button"
                disabled={!isDone}
                onClick={() => isDone && onViewItem(item.template.id)}
                className={clsx(
                  "flex w-full items-center gap-4 rounded-xl border border-zinc-100 bg-white px-5 py-4 text-left transition-all",
                  isDone && "cursor-pointer hover:border-indigo-200 hover:bg-indigo-50/50",
                  !isDone && "cursor-default"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-900">{item.template.name}</p>
                    <Badge color="zinc">{insuranceName || "—"}</Badge>
                  </div>
                  <p
                    className={clsx(
                      "mt-0.5 text-xs",
                      item.status === "done" && "text-emerald-600",
                      item.status === "error" && "text-red-500",
                      item.status === "pending" && "text-zinc-400",
                      !["done", "error", "pending"].includes(item.status) && "text-indigo-600"
                    )}
                  >
                    {STATUS_LABELS[item.status]}
                    {isDone && " — cliquez pour voir"}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {isDone ? (
                    <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
                  ) : item.status === "error" ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onRetryItem(item.template.id); }}
                      className="flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100 transition-colors"
                    >
                      <RetryIcon className="h-3.5 w-3.5" />
                      Réessayer
                    </button>
                  ) : item.status !== "pending" ? (
                    <SpinnerIcon className="h-5 w-5 text-indigo-500" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-zinc-200" />
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────

interface StepGenerateProps {
  selectedTemplates: TemplateResponse[];
  canton: string;
  dossierId: string | null;
}

export function StepGenerate({ selectedTemplates, canton, dossierId }: StepGenerateProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [viewingTemplateId, setViewingTemplateId] = useState<string | null>(null);
  const generationStarted = useRef(false);
  const cartRef = useRef<CartItem[]>([]);

  const updateItem = useCallback((templateId: string, patch: Partial<CartItem>) => {
    setCart((prev) => {
      const next = prev.map((c) => (c.template.id === templateId ? { ...c, ...patch } : c));
      cartRef.current = next;
      return next;
    });
  }, []);

  const generateItem = useCallback(async (item: CartItem) => {
    const canGenerate = item.template.has_schema;

    updateItem(item.template.id, { status: "preparing", progress: 25, error: undefined });
    if (!canGenerate) await new Promise((r) => setTimeout(r, 800 + Math.random() * 500));

    updateItem(item.template.id, { status: "generating", progress: 50 });

    if (canGenerate && dossierId) {
      try {
        const templateCanton = item.template.canton === "all" ? canton : item.template.canton;
        const result = await api.generateReport(dossierId, templateCanton, item.template.id);

        updateItem(item.template.id, { status: "formatting", progress: 80 });
        const { isPdf, mimeType } = getFileMeta(item.template.filename);
        const docxBlob = base64ToBlob(result.docx_base64, mimeType);

        updateItem(item.template.id, {
          status: "done",
          progress: 100,
          result: { docxBlob, fieldSchema: result.field_schema, fieldValues: result.field_values, isPdf },
        });
      } catch (e) {
        updateItem(item.template.id, {
          status: "error",
          error: e instanceof Error ? e.message : "Erreur",
        });
      }
    } else {
      await new Promise((r) => setTimeout(r, 2000 + Math.random() * 500));
      updateItem(item.template.id, { status: "formatting", progress: 80 });
      await new Promise((r) => setTimeout(r, 1200 + Math.random() * 500));
      updateItem(item.template.id, { status: "done", progress: 100 });
    }
  }, [dossierId, canton, updateItem]);

  const retryItem = useCallback((templateId: string) => {
    setAllDone(false);
    const item = cartRef.current.find((c) => c.template.id === templateId);
    if (!item) return;
    generateItem(item).then(() => {
      const allFinished = cartRef.current.every(
        (c) => c.status === "done" || c.status === "error"
      );
      if (allFinished) setAllDone(true);
    });
  }, [generateItem]);

  // Auto-start generation on mount
  useEffect(() => {
    if (generationStarted.current || selectedTemplates.length === 0) return;
    generationStarted.current = true;

    const initialCart: CartItem[] = selectedTemplates.map((t) => ({
      template: t,
      status: "pending" as GenerationStatus,
      progress: 0,
    }));
    setCart(initialCart);
    setIsGenerating(true);

    const run = async () => {
      const promises = initialCart.map((item, idx) =>
        (async () => {
          await new Promise((r) => setTimeout(r, idx * 300));
          await generateItem(item);
        })()
      );

      await Promise.all(promises);
      setAllDone(true);
    };

    run();
  }, [selectedTemplates, dossierId, canton, generateItem]);

  const doneCount = cart.filter((c) => c.status === "done").length;

  // Detail view
  const viewingItem = viewingTemplateId
    ? cart.find((c) => c.template.id === viewingTemplateId)
    : null;

  if (viewingItem && viewingItem.result) {
    return (
      <DocumentDetailView
        item={viewingItem}
        canton={viewingItem.template.canton === "all" ? canton : viewingItem.template.canton}
        dossierId={dossierId}
        onBack={() => setViewingTemplateId(null)}
      />
    );
  }

  // Generation progress
  if (isGenerating || cart.length > 0) {
    return (
      <GenerationView
        cart={cart}
        doneCount={doneCount}
        allDone={allDone}
        onViewItem={setViewingTemplateId}
        onRetryItem={retryItem}
      />
    );
  }

  // No templates selected — shouldn't happen if navigation is correct
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <Text>Aucun rapport sélectionné. Retournez à l&apos;étape 1 pour choisir des rapports.</Text>
    </div>
  );
}
