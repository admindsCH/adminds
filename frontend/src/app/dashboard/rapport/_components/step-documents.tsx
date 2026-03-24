import { useCallback } from "react";
import { Subheading } from "@/components/heading";
import { Text } from "@/components/text";
import type { WizardDocument } from "../_types";
import type { CategoryType } from "@/lib/schemas/classification";
import { useFileUpload } from "../_hooks/use-file-upload";
import { DocumentListItem } from "./document-list-item";
import clsx from "clsx";

// ── Icons ────────────────────────────────────────────────

/** Upload arrow icon (Heroicons outline). */
function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
      />
    </svg>
  );
}

function MicrophoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
      />
    </svg>
  );
}

// ── Component ────────────────────────────────────────────

interface StepDocumentsProps {
  docs: WizardDocument[];
  onDocsChange: React.Dispatch<React.SetStateAction<WizardDocument[]>>;
  notes: string;
  onNotesChange: React.Dispatch<React.SetStateAction<string>>;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
}

/**
 * Step 2: drag-and-drop document upload with classification + date filter.
 * The parent owns `docs` state because it needs it for `canNext` logic.
 */
export function StepDocuments({ docs, onDocsChange, notes, onNotesChange, dateFrom, dateTo, onDateFromChange, onDateToChange }: StepDocumentsProps) {
  const { dragging, fileRef, addFiles, onDrop, onDragOver, onDragLeave } =
    useFileUpload(onDocsChange);

  const handleCategoryChange = useCallback((id: string, category: CategoryType) => {
    onDocsChange((prev) =>
      prev.map((d) => (d.id === id ? { ...d, category } : d))
    );
  }, [onDocsChange]);

  const INPUT_DATE =
    "rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-sm text-zinc-700 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400";

  return (
    <div>
      {/* Date filter — discreet row at the top */}
      <div className="mb-6 flex items-center gap-3 text-sm text-zinc-500">
        <span className="text-xs font-medium text-zinc-400">Période :</span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-400">Du</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className={INPUT_DATE}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-400">Au</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className={INPUT_DATE}
          />
        </div>
        {(dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => { onDateFromChange(""); onDateToChange(""); }}
            className="text-xs text-zinc-400 hover:text-zinc-600"
          >
            Effacer
          </button>
        )}
      </div>

      {/* Drop zone — big, inviting, entire area clickable */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter") fileRef.current?.click();
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={clsx(
          "group flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all",
          docs.length > 0 ? "py-10" : "py-20",
          dragging
            ? "border-indigo-500 bg-indigo-50"
            : "border-zinc-300 bg-zinc-50/50 hover:border-indigo-400 hover:bg-indigo-50/30"
        )}
      >
        {/* Icon */}
        <div
          className={clsx(
            "mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-colors",
            dragging ? "bg-indigo-100" : "bg-zinc-100 group-hover:bg-indigo-50"
          )}
        >
          <UploadIcon
            className={clsx(
              "h-6 w-6 transition-colors",
              dragging
                ? "text-indigo-600"
                : "text-zinc-400 group-hover:text-indigo-500"
            )}
          />
        </div>
        <p className="text-sm font-semibold text-zinc-900">
          Importez le dossier patient
        </p>
        <p className="mt-1.5 max-w-xs text-center text-xs leading-5 text-zinc-500">
          Glissez-déposez ou cliquez pour parcourir. PDF, Word, XML, scans et
          images.
        </p>
      </div>

      {/* Hidden file input */}
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

      {/* File list */}
      {docs.length > 0 && (
        <div className="mt-6">
          <Subheading>
            {docs.length} document{docs.length > 1 ? "s" : ""}
          </Subheading>
          <ul className="mt-2 divide-y divide-zinc-100 rounded-lg border border-zinc-200">
            {docs.map((d) => (
              <DocumentListItem
                key={d.id}
                doc={d}
                onCategoryChange={handleCategoryChange}
                onDelete={(id) => onDocsChange((prev) => prev.filter((doc) => doc.id !== id))}
              />
            ))}
          </ul>
        </div>
      )}

      {/* Notes complémentaires + voice dictation */}
      <div className="mt-8 rounded-lg border border-zinc-200 p-4">
        <div className="flex items-center justify-between">
          <Subheading>Notes complémentaires</Subheading>
          <span className="group relative flex cursor-default items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-400">
            <MicrophoneIcon className="h-3.5 w-3.5" />
            Dicter
            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">
              Coming soon
            </span>
          </span>
        </div>
        <Text className="mt-1">
          Ajoutez vos observations cliniques, éléments d&apos;anamnèse ou précisions pour le rapport.
        </Text>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Ex : patient présente une anhédonie marquée depuis 3 mois, sommeil perturbé..."
          rows={5}
          className="mt-3 block w-full rounded-lg border border-zinc-950/10 bg-transparent px-3 py-2 text-sm text-zinc-950 placeholder:text-zinc-500 focus:border-zinc-950/20 focus:outline-none sm:text-sm/6"
        />
      </div>
    </div>
  );
}
