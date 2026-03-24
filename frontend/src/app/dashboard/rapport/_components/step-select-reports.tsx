"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Badge } from "@/components/badge";
import { Text } from "@/components/text";
import { api, type TemplateResponse } from "@/lib/api";
import { SchemaEditorDialog } from "./schema-editor-dialog";
import clsx from "clsx";

// ── Icons ───────────────────────────────────────────────

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}

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

function CogIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
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

// ── Document Row ────────────────────────────────────────

function DocumentRow({
  template,
  isSelected,
  onToggle,
  onConfigure,
}: {
  template: TemplateResponse;
  isSelected: boolean;
  onToggle: () => void;
  onConfigure: () => void;
}) {
  const categoryLabel = CATEGORY_LABELS[template.category] ?? template.category;
  const cantonLabel = template.canton === "all" ? null : capitalize(template.canton);

  return (
    <button
      type="button"
      onClick={onToggle}
      className={clsx(
        "flex w-full items-center gap-4 rounded-xl px-5 py-4 text-left transition-all",
        isSelected ? "bg-indigo-50 ring-1 ring-indigo-200" : "hover:bg-zinc-50"
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-900">{template.name}</p>
        <p className="mt-0.5 truncate text-xs text-zinc-500">{template.description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {cantonLabel && <Badge color="zinc">{cantonLabel}</Badge>}
        {template.insurance_name && <Badge color="zinc">{template.insurance_name}</Badge>}
        <Badge color={CATEGORY_BADGE[template.category] ?? "zinc"}>{categoryLabel}</Badge>
        {!template.has_schema && (
          <Badge color="amber">En cours</Badge>
        )}
        {template.has_schema && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onConfigure(); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onConfigure(); } }}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
            title="Configurer le schéma"
          >
            <CogIcon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="shrink-0">
        {isSelected ? (
          <CheckCircleIcon className="h-5 w-5 text-indigo-600" />
        ) : (
          <div className="h-5 w-5 rounded-full border-2 border-zinc-300" />
        )}
      </div>
    </button>
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedInsurance, setSelectedInsurance] = useState<string | "all">("all");
  const fileRef = useRef<HTMLInputElement>(null);
  const [editingTemplate, setEditingTemplate] = useState<TemplateResponse | null>(null);

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

  const hasActiveFilters = searchQuery !== "" || selectedCategory !== "all" || selectedInsurance !== "all";

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (t.canton !== "all" && t.canton !== canton) return false;
      if (selectedCategory !== "all" && t.category !== selectedCategory) return false;
      if (selectedInsurance !== "all" && t.insurance_id !== selectedInsurance) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const searchable = `${t.name} ${t.description} ${t.insurance_name}`.toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }, [templates, canton, selectedCategory, selectedInsurance, searchQuery]);

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
  }, [canton]);

  return (
    <div>
      {/* Upload your own */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="flex w-full items-center gap-4 rounded-xl border border-dashed border-zinc-300 px-5 py-4 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/30 disabled:opacity-50"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
          {uploading ? (
            <SpinnerIcon className="h-5 w-5 text-indigo-500" />
          ) : (
            <UploadIcon className="h-5 w-5 text-zinc-400" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-700">
            {uploading ? "Import en cours..." : "Importer un modèle"}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            {uploading
              ? "Analyse du formulaire et extraction des champs..."
              : "Importez votre propre formulaire (.docx ou .pdf)."}
          </p>
        </div>
      </button>

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

      {/* Search bar */}
      <div className="relative mt-6">
        <SearchIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          placeholder="Rechercher un rapport par nom, assurance ou type..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 bg-white py-3.5 pl-12 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {/* Filter chips */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
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

      {/* Loading state */}
      {loading && (
        <div className="mt-12 flex flex-col items-center py-8">
          <SpinnerIcon className="h-6 w-6 text-indigo-500" />
          <Text className="mt-3 text-sm text-zinc-500">Chargement des modèles...</Text>
        </div>
      )}

      {/* Results list */}
      {!loading && (hasActiveFilters || searchQuery === "") && (
        <div className="mt-8">
          <p className="mb-4 text-xs font-medium text-zinc-400">
            {filteredTemplates.length} document{filteredTemplates.length !== 1 ? "s" : ""} disponible{filteredTemplates.length !== 1 ? "s" : ""}
          </p>
          <div className="space-y-2">
            {filteredTemplates.map((template) => (
              <DocumentRow
                key={template.id}
                template={template}
                isSelected={selectedIds.has(template.id)}
                onToggle={() => toggleTemplate(template)}
                onConfigure={() => setEditingTemplate(template)}
              />
            ))}
          </div>
          {filteredTemplates.length === 0 && (
            <div className="flex flex-col items-center py-16 text-center">
              <SearchIcon className="h-8 w-8 text-zinc-300" />
              <p className="mt-3 text-sm font-medium text-zinc-500">Aucun document trouvé</p>
              <p className="mt-1 text-xs text-zinc-400">
                Essayez d&apos;autres filtres ou importez votre propre formulaire.
              </p>
            </div>
          )}
        </div>
      )}

      {editingTemplate && (
        <SchemaEditorDialog
          templateId={editingTemplate.id}
          templateName={editingTemplate.name}
          open={!!editingTemplate}
          onClose={() => setEditingTemplate(null)}
        />
      )}
    </div>
  );
}
