"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Badge } from "@/components/badge";
import { Text } from "@/components/text";
import { api, type TemplateResponse } from "@/lib/api";
import clsx from "clsx";

// ── Icons ───────────────────────────────────────────────

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
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

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <div className={clsx("animate-spin rounded-full border-2 border-current border-t-transparent", className ?? "h-4 w-4")} />
  );
}

// ── Helpers ─────────────────────────────────────────────

const CATEGORY_BADGE: Record<string, "indigo" | "sky" | "amber" | "purple" | "zinc"> = {
  "rapport-ai": "indigo",
  "rapport-medical": "sky",
  "rapport-assurance": "amber",
  "rapport-perte-gain": "purple",
};

const CATEGORY_LABELS: Record<string, string> = {
  "rapport-ai": "Rapport AI",
  "rapport-medical": "Rapport médical",
  "rapport-assurance": "Rapport assurance",
  "rapport-perte-gain": "Perte de gain",
};

/** Capitalize first letter: "fribourg" → "Fribourg" */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Preview Modal ───────────────────────────────────────

function PreviewModal({
  template,
  onClose,
}: {
  template: TemplateResponse;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const isDocx = template.filename.endsWith(".docx");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const blob = await api.downloadTemplate(template.id);

        if (cancelled) return;

        if (isDocx) {
          const { renderAsync } = await import("docx-preview");
          if (containerRef.current && !cancelled) {
            await renderAsync(blob, containerRef.current, undefined, {
              className: "docx-preview",
              inWrapper: true,
            });
          }
        } else {
          // PDF — use blob URL in iframe
          const url = URL.createObjectURL(blob);
          if (!cancelled) setPdfUrl(url);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erreur de chargement");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <p className="text-sm font-medium text-zinc-900">{template.name}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading && (
            <div className="flex h-full items-center justify-center">
              <SpinnerIcon className="h-8 w-8 text-indigo-500" />
            </div>
          )}
          {error && (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}
          {isDocx ? (
            <div ref={containerRef} />
          ) : (
            pdfUrl && (
              <iframe
                src={pdfUrl}
                className="h-full w-full rounded-lg border border-zinc-200"
                title={`Apercu de ${template.name}`}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ── Document Row ────────────────────────────────────────

function DocumentRow({
  template,
  isSelected,
  onToggle,
  onPreview,
  onRename,
  onDelete,
}: {
  template: TemplateResponse;
  isSelected: boolean;
  onToggle: () => void;
  onPreview: () => void;
  onRename: ((name: string) => void) | null;
  onDelete: (() => void) | null;
}) {
  const [renaming, setRenaming] = useState(false);
  const [localName, setLocalName] = useState(template.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) renameRef.current?.focus();
  }, [renaming]);
  useEffect(() => { setLocalName(template.name); }, [template.name]);

  const commitRename = () => {
    setRenaming(false);
    if (localName.trim() && localName !== template.name && onRename) {
      onRename(localName.trim());
    } else {
      setLocalName(template.name);
    }
  };

  const categoryLabel = CATEGORY_LABELS[template.category] ?? template.category;
  const cantonLabel = template.canton === "all" ? null : capitalize(template.canton);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={clsx(
          "group w-full rounded-xl px-4 py-3 text-left transition-all sm:px-5 sm:py-4",
          isSelected ? "bg-indigo-50 ring-1 ring-indigo-200" : "hover:bg-zinc-50"
        )}
      >
        {/* Top row: name + description + actions + check circle */}
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            {renaming ? (
              <input
                ref={renameRef}
                type="text"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") { setLocalName(template.name); setRenaming(false); }
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full rounded border border-indigo-300 bg-white px-2 py-0.5 text-sm font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            ) : (
              <p className="text-sm font-medium text-zinc-900">{template.name}</p>
            )}
            <p className="mt-0.5 truncate text-xs text-zinc-500">
              {template.description}
              {template.created_at && (
                <span className="ml-2 text-zinc-400">
                  · {new Date(template.created_at).toLocaleDateString("fr-CH", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              )}
            </p>
          </div>

          {/* Action buttons — preview + rename + delete */}
          {!renaming && (
            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <span
                role="button"
                tabIndex={0}
                title="Aperçu"
                onClick={(e) => { e.stopPropagation(); onPreview(); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onPreview(); } }}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              >
                <EyeIcon className="h-4 w-4" />
              </span>
              {onRename && (
                <span
                  role="button"
                  tabIndex={0}
                  title="Renommer"
                  onClick={(e) => { e.stopPropagation(); setRenaming(true); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setRenaming(true); } }}
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                >
                  <PencilIcon className="h-4 w-4" />
                </span>
              )}
              {onDelete && (
                <span
                  role="button"
                  tabIndex={0}
                  title="Supprimer"
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setConfirmDelete(true); } }}
                  className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                >
                  <TrashIcon className="h-4 w-4" />
                </span>
              )}
            </div>
          )}

          <div className="shrink-0">
            {isSelected ? (
              <CheckCircleIcon className="h-5 w-5 text-indigo-600" />
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-zinc-300" />
            )}
          </div>
        </div>

        {/* Bottom row: badges */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {cantonLabel && <Badge color="zinc">{cantonLabel}</Badge>}
          {template.insurance_name && <Badge color="zinc">{template.insurance_name}</Badge>}
          <Badge color={CATEGORY_BADGE[template.category] ?? "zinc"}>{categoryLabel}</Badge>
          {!template.has_schema && (
            <Badge color="amber">En cours</Badge>
          )}
        </div>
      </button>

      {/* Delete confirmation overlay */}
      {confirmDelete && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/95 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <p className="text-sm text-zinc-700">Supprimer ce modèle ?</p>
            <button
              type="button"
              onClick={() => { onDelete?.(); setConfirmDelete(false); }}
              className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600"
            >
              Supprimer
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────

interface StepSelectReportsProps {
  canton: string;
  onCantonChange: (canton: string) => void;
  selectedTemplates: TemplateResponse[];
  onSelectedTemplatesChange: React.Dispatch<React.SetStateAction<TemplateResponse[]>>;
}

export function StepSelectReports({
  canton,
  onCantonChange,
  selectedTemplates,
  onSelectedTemplatesChange,
}: StepSelectReportsProps) {
  const [templates, setTemplates] = useState<TemplateResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedInsurance, setSelectedInsurance] = useState<string | "all">("all");
  const [previewTemplate, setPreviewTemplate] = useState<TemplateResponse | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Fetch templates from API on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await api.listTemplates();
        if (!cancelled) setTemplates(result);
      } catch (e) {
        console.error("Failed to load templates:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Derive filter options from loaded templates
  const availableCantons = useMemo(
    () => [...new Set(templates.map((t) => t.canton).filter((c) => c !== "all"))].sort(),
    [templates],
  );
  const availableCategories = useMemo(
    () => [...new Set(templates.map((t) => t.category))].sort(),
    [templates],
  );
  const availableInsurances = useMemo(
    () => [...new Map(templates.filter((t) => t.insurance_id).map((t) => [t.insurance_id, t.insurance_name])).entries()].sort((a, b) => a[0].localeCompare(b[0])),
    [templates],
  );

  const filteredTemplates = useMemo(() => {
    const filtered = templates.filter((t) => {
      if (t.canton !== "all" && t.canton !== canton) return false;
      if (selectedCategory !== "all" && t.category !== selectedCategory) return false;
      if (selectedInsurance !== "all" && t.insurance_id !== selectedInsurance) return false;
      return true;
    });
    // Sort: user uploads (non-official) first, then by most recent
    return filtered.sort((a, b) => {
      if (a.is_official !== b.is_official) return a.is_official ? 1 : -1;
      return (b.created_at || "").localeCompare(a.created_at || "");
    });
  }, [templates, canton, selectedCategory, selectedInsurance]);

  const selectedIds = useMemo(() => new Set(selectedTemplates.map((t) => t.id)), [selectedTemplates]);

  const toggleTemplate = useCallback((template: TemplateResponse) => {
    onSelectedTemplatesChange((prev) => {
      if (prev.some((t) => t.id === template.id)) {
        return prev.filter((t) => t.id !== template.id);
      }
      return [...prev, template];
    });
  }, [onSelectedTemplatesChange]);

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploading(true);

    try {
      const result = await api.uploadTemplate(file);
      setTemplates((prev) => [...prev, result]);
    } catch (e) {
      console.error("Upload failed:", e);
    } finally {
      setUploading(false);
    }
  }, []);

  const handleRename = useCallback(async (templateId: string, newName: string) => {
    try {
      await api.renameTemplate(templateId, newName);
      setTemplates((prev) => prev.map((t) => t.id === templateId ? { ...t, name: newName } : t));
      onSelectedTemplatesChange((prev) => prev.map((t) => t.id === templateId ? { ...t, name: newName } : t));
    } catch (e) {
      console.error("Rename failed:", e);
    }
  }, [onSelectedTemplatesChange]);

  const handleDelete = useCallback(async (templateId: string) => {
    try {
      await api.deleteTemplate(templateId);
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      onSelectedTemplatesChange((prev) => prev.filter((t) => t.id !== templateId));
    } catch (e) {
      console.error("Delete failed:", e);
    }
  }, [onSelectedTemplatesChange]);

  return (
    <div>
      {/* Top bar — filters + import button */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        {/* Filter chips */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 py-2">
            <span className="text-xs text-zinc-500">Canton</span>
            <select
              value={canton}
              onChange={(e) => onCantonChange(e.target.value)}
              className="border-none bg-transparent p-0 text-xs font-medium text-zinc-900 focus:outline-none"
            >
              {availableCantons.map((c) => (
                <option key={c} value={c}>{capitalize(c)}</option>
              ))}
            </select>
          </div>

          <div className="h-5 w-px bg-zinc-200" />

          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={clsx(
              "rounded-lg px-3.5 py-2 text-xs font-medium transition-colors",
              selectedCategory === "all"
                ? "bg-zinc-900 text-white"
                : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50"
            )}
          >
            Tous
          </button>
          {availableCategories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setSelectedCategory(c)}
              className={clsx(
                "rounded-lg px-3.5 py-2 text-xs font-medium transition-colors",
                selectedCategory === c
                  ? "bg-zinc-900 text-white"
                  : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50"
              )}
            >
              {CATEGORY_LABELS[c] ?? c}
            </button>
          ))}

          <div className="h-5 w-px bg-zinc-200" />

          <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 py-2">
            <span className="text-xs text-zinc-500">Assurance</span>
            <select
              value={selectedInsurance}
              onChange={(e) => setSelectedInsurance(e.target.value)}
              className="border-none bg-transparent p-0 text-xs font-medium text-zinc-900 focus:outline-none"
            >
              <option value="all">Toutes</option>
              {availableInsurances.map(([id, name]) => (
                <option key={id} value={id}>{name || id}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Import button */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className={clsx(
            "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
            uploading
              ? "bg-zinc-200 text-zinc-400 cursor-wait"
              : "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 hover:shadow-md"
          )}
        >
          {uploading ? (
            <SpinnerIcon className="h-4 w-4" />
          ) : (
            <UploadIcon className="h-4 w-4" />
          )}
          {uploading ? "Import en cours..." : "Importer un modèle"}
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept=".docx,.pdf"
        onChange={(e) => {
          handleUpload(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Loading state */}
      {loading && (
        <div className="mt-12 flex flex-col items-center py-8">
          <SpinnerIcon className="h-6 w-6 text-indigo-500" />
          <Text className="mt-3 text-sm text-zinc-500">Chargement des modèles...</Text>
        </div>
      )}

      {/* Results list */}
      {!loading && (
        <div>
          <p className="mb-4 text-xs font-medium text-zinc-400">
            {filteredTemplates.length} modèle{filteredTemplates.length !== 1 ? "s" : ""} disponible{filteredTemplates.length !== 1 ? "s" : ""}
          </p>
          <div className="space-y-2">
            {filteredTemplates.map((template) => (
              <DocumentRow
                key={template.id}
                template={template}
                isSelected={selectedIds.has(template.id)}
                onToggle={() => toggleTemplate(template)}
                onPreview={() => setPreviewTemplate(template)}
                onRename={!template.is_official ? (name) => handleRename(template.id, name) : null}
                onDelete={!template.is_official ? () => handleDelete(template.id) : null}
              />
            ))}
          </div>
          {filteredTemplates.length === 0 && (
            <div className="flex flex-col items-center py-16 text-center">
              <p className="text-sm font-medium text-zinc-500">Aucun modèle trouvé</p>
              <p className="mt-1 text-xs text-zinc-400">
                Essayez d&apos;autres filtres ou importez votre propre formulaire.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Preview modal */}
      {previewTemplate && (
        <PreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
        />
      )}
    </div>
  );
}
