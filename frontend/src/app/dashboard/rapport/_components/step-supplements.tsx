"use client";

import { useState } from "react";
import { Subheading } from "@/components/heading";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import type { WizardDocument } from "@/lib/mock-data";
import { useFileUpload } from "../_hooks/use-file-upload";
import { useVoiceDictation } from "../_hooks/use-voice-dictation";
import { DocumentListItem } from "./document-list-item";
import clsx from "clsx";

// ── Icons ────────────────────────────────────────────────

function MicrophoneIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
      />
    </svg>
  );
}

// ── Component ────────────────────────────────────────────

/**
 * Step 3: notes (primary) + extra document upload (secondary).
 * All state is local — notes and extra docs are only used at generation time.
 */
export function StepSupplements() {
  // Notes textarea state
  const [notes, setNotes] = useState("");
  const { listening, toggle: toggleVoice } = useVoiceDictation(setNotes);

  // Extra documents state
  const [extraDocs, setExtraDocs] = useState<WizardDocument[]>([]);
  const { dragging, fileRef, addFiles, onDrop, onDragOver, onDragLeave } =
    useFileUpload(setExtraDocs);

  return (
    <div>
      {/* ── Notes — primary action, shown first ── */}
      <div>
        <div className="flex items-center justify-between">
          <Subheading>Notes complémentaires</Subheading>
          <button
            type="button"
            onClick={toggleVoice}
            className={clsx(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              listening
                ? "bg-red-50 text-red-600 hover:bg-red-100"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            )}
          >
            <MicrophoneIcon className="h-3.5 w-3.5" />
            {listening ? "Arrêter" : "Dicter"}
          </button>
        </div>
        <Text className="mt-1">
          Ajoutez vos observations cliniques, éléments d&apos;anamnèse ou
          précisions pour le rapport.
        </Text>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex : patient présente une anhédonie marquée depuis 3 mois, sommeil perturbé..."
          rows={5}
          className={clsx(
            "mt-3 block w-full rounded-lg border bg-transparent px-3 py-2 text-sm text-zinc-950 placeholder:text-zinc-500 focus:outline-none sm:text-sm/6",
            listening
              ? "border-red-300 ring-2 ring-red-100"
              : "border-zinc-950/10 focus:border-zinc-950/20"
          )}
        />
      </div>

      {/* ── Extra documents — secondary ── */}
      <div className="mt-8">
        <Subheading>Documents supplémentaires</Subheading>
        <Text className="mt-1">
          Rapports, imagerie ou autres pièces à joindre au dossier.
        </Text>
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={clsx(
            "mt-3 rounded-lg border-2 border-dashed px-6 py-5 text-center transition-colors",
            dragging ? "border-indigo-400 bg-indigo-50" : "border-zinc-200"
          )}
        >
          <Button outline onClick={() => fileRef.current?.click()}>
            Ajouter des documents
          </Button>
        </div>

        {/* Hidden file input (reuses the same ref pattern) */}
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.docx,.doc,.xml,.jpg,.jpeg,.png,.tiff"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {extraDocs.length > 0 && (
          <ul className="mt-3 divide-y divide-zinc-100 rounded-lg border border-zinc-200">
            {extraDocs.map((d) => (
              <DocumentListItem key={d.id} doc={d} showDetails={false} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
