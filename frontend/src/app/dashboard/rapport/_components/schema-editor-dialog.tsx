"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Dialog, DialogTitle, DialogBody, DialogActions } from "@/components/dialog";
import { Button } from "@/components/button";
import { Badge } from "@/components/badge";
import { Text } from "@/components/text";
import { api, type SchemaFieldResponse } from "@/lib/api";
import clsx from "clsx";

// ── Icons ───────────────────────────────────────────────

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
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

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <div className={clsx("animate-spin rounded-full border-2 border-current border-t-transparent", className ?? "h-4 w-4")} />
  );
}

// ── Helpers ─────────────────────────────────────────────

const INPUT_CLASS =
  "block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400";

const RUBRIQUE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "— Aucune —" },
  { value: "r01_historique", label: "R01 Historique" },
  { value: "r02_clinique", label: "R02 Clinique" },
  { value: "r03_traitement", label: "R03 Traitement" },
  { value: "r04_professionnel", label: "R04 Professionnel" },
  { value: "r05_capacite_travail", label: "R05 Capacité travail" },
  { value: "r06_readaptation", label: "R06 Réadaptation" },
  { value: "r07_freins_cognition", label: "R07 Freins & cognition" },
  { value: "r08_activites", label: "R08 Activités" },
];

interface SectionGroup {
  name: string;
  fields: SchemaFieldResponse[];
}

function groupBySection(fields: SchemaFieldResponse[]): SectionGroup[] {
  const map = new Map<string, SchemaFieldResponse[]>();
  for (const f of fields) {
    const key = f.section || "Non classé";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(f);
  }
  return Array.from(map.entries()).map(([name, fields]) => ({ name, fields }));
}

// ── Main Component ──────────────────────────────────────

interface SchemaEditorDialogProps {
  templateId: string;
  templateName: string;
  open: boolean;
  onClose: () => void;
}

export function SchemaEditorDialog({ templateId, templateName, open, onClose }: SchemaEditorDialogProps) {
  const [fields, setFields] = useState<SchemaFieldResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Fetch schema when dialog opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    api.getTemplateSchema(templateId)
      .then((schema) => setFields(schema.fields))
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur de chargement"))
      .finally(() => setLoading(false));
  }, [open, templateId]);

  const sections = useMemo(() => groupBySection(fields), [fields]);

  const updateField = useCallback((fieldId: string, patch: Partial<SchemaFieldResponse>) => {
    setFields((prev) => prev.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)));
  }, []);

  const deleteField = useCallback((fieldId: string) => {
    setFields((prev) => prev.filter((f) => f.id !== fieldId));
  }, []);

  const toggleSection = useCallback((name: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await api.updateTemplateSchema(templateId, fields);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }, [templateId, fields, onClose]);

  return (
    <Dialog open={open} onClose={onClose} size="4xl">
      <DialogTitle>Configurer le schéma — {templateName}</DialogTitle>
      <Text className="mt-1">
        Modifiez les libellés, instructions et rubriques des champs détectés. Les modifications sont permanentes.
      </Text>

      <DialogBody>
        {loading && (
          <div className="flex items-center justify-center py-16">
            <SpinnerIcon className="h-6 w-6 text-indigo-500" />
            <Text className="ml-3">Chargement du schéma...</Text>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <Text className="text-sm text-red-600">{error}</Text>
          </div>
        )}

        {!loading && fields.length > 0 && (
          <div className="max-h-[60vh] overflow-y-auto space-y-3">
            {sections.map((section) => {
              const isCollapsed = collapsedSections.has(section.name);
              return (
                <div key={section.name} className="rounded-lg border border-zinc-200">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.name)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                  >
                    <span className="text-sm font-semibold text-zinc-900">
                      {section.name}
                      <Badge color="zinc" className="ml-2">{section.fields.length}</Badge>
                    </span>
                    <ChevronIcon className={clsx("h-4 w-4 text-zinc-400 transition-transform", !isCollapsed && "rotate-180")} />
                  </button>

                  {!isCollapsed && (
                    <div className="border-t border-zinc-100 px-4 py-3 space-y-4">
                      {section.fields.map((field) => (
                        <div key={field.id} className="group flex gap-3 items-start">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge color="zinc" className="font-mono text-[10px]">{field.id}</Badge>
                              <Badge color="sky">{field.field_type}</Badge>
                              <Badge color="indigo">{field.slot_type}</Badge>
                            </div>
                            <input
                              type="text"
                              value={field.label}
                              onChange={(e) => updateField(field.id, { label: e.target.value })}
                              placeholder="Libellé du champ"
                              className={INPUT_CLASS}
                            />
                            <input
                              type="text"
                              value={field.hint}
                              onChange={(e) => updateField(field.id, { hint: e.target.value })}
                              placeholder="Instruction pour l'IA (hint)"
                              className={clsx(INPUT_CLASS, "text-xs")}
                            />
                            <select
                              value={field.mapped_rubrique || ""}
                              onChange={(e) => updateField(field.id, { mapped_rubrique: e.target.value || null })}
                              className={clsx(INPUT_CLASS, "text-xs")}
                            >
                              {RUBRIQUE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteField(field.id)}
                            className="mt-6 shrink-0 rounded-md p-1.5 text-zinc-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all"
                            title="Supprimer ce champ"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && fields.length === 0 && !error && (
          <div className="py-12 text-center">
            <Text>Aucun champ détecté dans ce template.</Text>
          </div>
        )}
      </DialogBody>

      <DialogActions>
        <Button plain onClick={onClose}>Annuler</Button>
        <Button color="indigo" onClick={handleSave} disabled={saving || loading}>
          {saving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
