"use client";

import { useState } from "react";
import { Subheading } from "@/components/heading";
import { Badge } from "@/components/badge";
import { MOCK_EXTRACTED_SECTIONS } from "@/lib/mock-data";

// ── Confidence badge mapping ─────────────────────────────

const CONFIDENCE_CONFIG = {
  high: { color: "green" as const, label: "Fiable" },
  medium: { color: "amber" as const, label: "Moyen" },
  low: { color: "red" as const, label: "Faible" },
};

// ── Shared input class ───────────────────────────────────

const INPUT_CLASS =
  "mt-1 block w-full rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm text-zinc-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400";

// ── Component ────────────────────────────────────────────

/**
 * Step 2: displays AI-extracted data in editable fields.
 * Each field is an <input> (short values) or <textarea> (long values),
 * with a confidence badge and source attribution.
 * State is fully local — the page doesn't need these values until generation.
 */
export function StepSummary() {
  // Track user edits keyed by "sectionId-fieldIndex"
  const [edits, setEdits] = useState<Record<string, string>>({});

  const updateField = (key: string, value: string) => {
    setEdits((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex flex-col gap-10">
      {MOCK_EXTRACTED_SECTIONS.map((section) => (
        <div key={section.id}>
          <Subheading>{section.title}</Subheading>
          <div className="mt-3 grid grid-cols-1 gap-px rounded-lg border border-zinc-200 sm:grid-cols-2">
            {section.fields.map((field, i) => {
              const key = `${section.id}-${i}`;
              const currentValue = edits[key] ?? field.value;
              const isEdited =
                key in edits && edits[key] !== field.value;
              const confidence = CONFIDENCE_CONFIG[field.confidence];
              const isLong = field.value.length > 80;

              return (
                <div
                  key={key}
                  className="flex items-start gap-3 border-t border-zinc-100 px-4 py-3 first:border-t-0 sm:[&:nth-child(2)]:border-t-0"
                >
                  {/* Label + input + source */}
                  <div className="min-w-0 flex-1">
                    <label className="flex items-center gap-2 text-xs font-medium text-zinc-500">
                      {field.label}
                      {isEdited && (
                        <span className="text-[10px] font-normal text-indigo-500">
                          modifié
                        </span>
                      )}
                    </label>
                    {isLong ? (
                      <textarea
                        value={currentValue}
                        onChange={(e) => updateField(key, e.target.value)}
                        rows={2}
                        className={INPUT_CLASS}
                      />
                    ) : (
                      <input
                        type="text"
                        value={currentValue}
                        onChange={(e) => updateField(key, e.target.value)}
                        className={INPUT_CLASS}
                      />
                    )}
                    <p className="mt-1 text-[10px] text-zinc-400">
                      Source : {field.source}
                    </p>
                  </div>

                  {/* Confidence badge */}
                  <Badge className="mt-6 shrink-0" color={confidence.color}>
                    {confidence.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
