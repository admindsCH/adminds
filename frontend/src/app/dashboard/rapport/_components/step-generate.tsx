"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/button";
import { Badge } from "@/components/badge";
import { Text } from "@/components/text";
import { Subheading } from "@/components/heading";
import {
  MOCK_INSURANCES,
  type Canton,
} from "@/lib/mock-data";
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

function base64ToBlob(base64: string): Blob {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  return new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
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
  fields: EditorField[];
}

function buildEditorSections(
  schema: FieldSchemaEntry[],
  values: Record<string, string | boolean>,
): EditorSection[] {
  const sectionMap = new Map<string, EditorField[]>();

  for (const entry of schema) {
    if (entry.type === "checkbox") continue;
    if (!sectionMap.has(entry.section)) sectionMap.set(entry.section, []);
    const val = values[entry.id];
    const isLong = typeof val === "string" && (val.length > 80 || val.includes("\n"));
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
        <span className="text-sm font-semibold text-zinc-900">{section.title}</span>
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

// ── Document Detail View (docx preview + inline editor) ─

function DocumentDetailView({
  item,
  canton,
  dossierId,
  onBack,
}: {
  item: CartItem;
  canton: Canton;
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

  useEffect(() => {
    if (!result || !previewRef.current) return;
    docxBlobRef.current = result.docxBlob;
    previewRef.current.innerHTML = "";
    renderAsync(result.docxBlob, previewRef.current, undefined, {
      ignoreWidth: true,
      ignoreHeight: true,
    });
  }, [result]);

  useEffect(() => {
    if (!result) return;
    const initial: Record<string, string> = {};
    for (const [key, val] of Object.entries(result.fieldValues)) {
      initial[key] = String(val);
    }
    setEditedValues(initial);
  }, [result]);

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
      const blob = base64ToBlob(res.docx_base64);
      await renderPreview(blob);
      setShowEditor(false);
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
    a.download = buildFilename(item.template.name, "docx");
    a.click();
    URL.revokeObjectURL(url);
  }, [item.template.name]);

  const downloadPdf = useCallback(() => {
    if (!previewRef.current) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const styles = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"))
      .map((el) => el.outerHTML)
      .join("\n");
    win.document.write(
      `<!DOCTYPE html><html><head><title>${buildFilename(item.template.name, "pdf")}</title>${styles}
      <style>@media print { body { margin: 0; } .docx-preview { box-shadow: none !important; } }</style>
      </head><body>${previewRef.current.innerHTML}</body></html>`
    );
    win.document.close();
    win.onload = () => { win.print(); win.close(); };
  }, [item.template.name]);

  const insurance = MOCK_INSURANCES.find((i) => i.id === item.template.insurance_id);
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
              <Badge color="zinc">{insurance?.name ?? "—"}</Badge>
            </div>
            <Text className="mt-0.5">Document généré</Text>
          </div>
        </div>
        <div className="flex gap-2">
          {hasEditor && (
            showEditor ? (
              <Button outline onClick={() => setShowEditor(false)}>
                <ArrowLeftIcon className="h-4 w-4" />
                Voir le document
              </Button>
            ) : (
              <Button outline onClick={() => setShowEditor(true)}>
                <PencilIcon className="h-4 w-4" />
                Modifier
              </Button>
            )
          )}
          <Button outline onClick={downloadPdf}>Télécharger PDF</Button>
          <Button color="indigo" onClick={downloadDocx}>Télécharger .docx</Button>
        </div>
      </div>

      {/* Error */}
      {updateError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center">
          <Text className="text-sm text-red-600">{updateError}</Text>
        </div>
      )}

      {/* Editor panel (inline, collapsible below header) */}
      {hasEditor && showEditor && (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-900">Modifier le rapport</span>
            <button
              type="button"
              onClick={() => setShowEditor(false)}
              className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
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
      )}

      {/* Docx preview */}
      <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200 bg-white">
        {updating && (
          <div className="flex items-center justify-center py-32">
            <Text>Mise à jour du document...</Text>
          </div>
        )}
        <div ref={previewRef} className="docx-preview" />
      </div>
    </div>
  );
}

// ── Generation Progress View ────────────────────────────

function GenerationView({
  cart,
  doneCount,
  allDone,
  onViewItem,
}: {
  cart: CartItem[];
  doneCount: number;
  allDone: boolean;
  onViewItem: (templateId: string) => void;
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
          const insurance = MOCK_INSURANCES.find((i) => i.id === item.template.insurance_id);
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
                    <Badge color="zinc">{insurance?.name ?? "—"}</Badge>
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
                <div className="shrink-0">
                  {isDone ? (
                    <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
                  ) : item.status === "error" ? (
                    <XIcon className="h-5 w-5 text-red-400" />
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
  canton: Canton;
  dossierId: string | null;
}

export function StepGenerate({ selectedTemplates, canton, dossierId }: StepGenerateProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [viewingTemplateId, setViewingTemplateId] = useState<string | null>(null);
  const generationStarted = useRef(false);

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

    const updateItem = (templateId: string, patch: Partial<CartItem>) => {
      setCart((prev) =>
        prev.map((c) => (c.template.id === templateId ? { ...c, ...patch } : c))
      );
    };

    const run = async () => {
      const promises = initialCart.map((item, idx) =>
        (async () => {
          await new Promise((r) => setTimeout(r, idx * 300));

          const canGenerate = item.template.has_schema;

          updateItem(item.template.id, { status: "preparing", progress: 25 });
          if (!canGenerate) await new Promise((r) => setTimeout(r, 800 + Math.random() * 500));

          updateItem(item.template.id, { status: "generating", progress: 50 });

          if (canGenerate && dossierId) {
            try {
              const templateCanton = item.template.canton === "all" ? canton : item.template.canton;
              const result = await api.generateReport(dossierId, templateCanton, item.template.id);

              updateItem(item.template.id, { status: "formatting", progress: 80 });
              const docxBlob = base64ToBlob(result.docx_base64);

              updateItem(item.template.id, {
                status: "done",
                progress: 100,
                result: { docxBlob, fieldSchema: result.field_schema, fieldValues: result.field_values },
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
        })()
      );

      await Promise.all(promises);
      setAllDone(true);
    };

    run();
  }, [selectedTemplates, dossierId, canton]);

  const doneCount = cart.filter((c) => c.status === "done").length;

  // Detail view
  const viewingItem = viewingTemplateId
    ? cart.find((c) => c.template.id === viewingTemplateId)
    : null;

  if (viewingItem && viewingItem.result) {
    return (
      <DocumentDetailView
        item={viewingItem}
        canton={viewingItem.template.canton === "all" ? canton : viewingItem.template.canton as Canton}
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
