import { useCallback, useState, useEffect, useRef } from "react";
import { Subheading } from "@/components/heading";
import type { WizardDocument } from "../_types";
import type { CategoryType } from "@/lib/schemas/classification";
import { useFileUpload } from "../_hooks/use-file-upload";
import { useAudioRecorder } from "../_hooks/use-audio-recorder";
import { DocumentListItem } from "./document-list-item";
import { api } from "@/lib/api";
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

// ── EHR Export Guide ─────────────────────────────────────

type EhrSystem = "mediway" | "medicloud";

const EHR_SYSTEMS: { id: EhrSystem; label: string }[] = [
  { id: "mediway", label: "Mediway" },
  { id: "medicloud", label: "Medicloud" },
];

const EHR_STEPS: Record<EhrSystem, string[]> = {
  mediway: ["Fichier", "Exporter", "Dossier patient", "PDF / XML", "Enregistrer"],
  medicloud: ["Fichier", "Exporter", "Sélectionner la période", "PDF", "Télécharger"],
};

function EhrExportGuide() {
  const [active, setActive] = useState<EhrSystem | null>(null);

  return (
    <div className="mb-6 rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-zinc-500">Comment exporter depuis :</span>
        {EHR_SYSTEMS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActive((prev) => (prev === id ? null : id))}
            className={clsx(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              active === id
                ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-indigo-200 hover:text-indigo-600"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {active && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {EHR_STEPS[active].map((step, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 shadow-sm">
                {step}
              </span>
              {i < EHR_STEPS[active].length - 1 && (
                <span className="text-zinc-300">→</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
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
  doctorName?: string;
}

/**
 * Step 2: drag-and-drop document upload with classification + date filter.
 * The parent owns `docs` state because it needs it for `canNext` logic.
 */
export function StepDocuments({ docs, onDocsChange, notes, onNotesChange, dateFrom, dateTo, onDateFromChange, onDateToChange, doctorName }: StepDocumentsProps) {
  const { dragging, fileRef, addFiles, onDrop, onDragOver, onDragLeave } =
    useFileUpload(onDocsChange, doctorName);

  const { isRecording, audioBlob, startRecording, stopRecording } = useAudioRecorder();
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer for recording duration display
  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  // When recording stops and we have a blob, transcribe it
  useEffect(() => {
    if (!audioBlob) return;
    let cancelled = false;
    setIsTranscribing(true);
    api.transcribeAudio(audioBlob)
      .then((res) => {
        if (!cancelled) onNotesChange((prev) => (prev ? prev + " " + res.text : res.text));
      })
      .catch((err) => {
        if (!cancelled) console.error("Transcription failed:", err);
      })
      .finally(() => { if (!cancelled) setIsTranscribing(false); });
    return () => { cancelled = true; };
  }, [audioBlob, onNotesChange]);

  const handleMicClick = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording().catch((err) => console.error("Mic access denied:", err));
    }
  }, [isRecording, startRecording, stopRecording]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleCategoryChange = useCallback((id: string, category: CategoryType) => {
    onDocsChange((prev) =>
      prev.map((d) => (d.id === id ? { ...d, category } : d))
    );
}, [onDocsChange]);

  const INPUT_DATE =
    "rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-sm text-zinc-700 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400";

  return (
    <div>
      {/* Top bar — date filter + mic button */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        {/* Mic button — right-aligned */}
        <div className="order-last flex items-center gap-2">
          {isRecording && (
            <>
              <div className="flex items-center gap-0.5">
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="w-0.5 rounded-full bg-red-400 animate-pulse"
                    style={{ height: `${4 + Math.random() * 10}px`, animationDelay: `${i * 0.07}s` }}
                  />
                ))}
              </div>
              <span className="text-xs font-medium text-red-600">{formatTime(recordingTime)}</span>
            </>
          )}
          {isTranscribing && (
            <span className="text-xs text-zinc-400">Transcription...</span>
          )}
          <button
            type="button"
            onClick={handleMicClick}
            disabled={isTranscribing}
            className={clsx(
              "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
              isRecording
                ? "bg-red-500 text-white shadow-lg shadow-red-200 scale-105"
                : isTranscribing
                  ? "bg-zinc-200 text-zinc-400 cursor-wait"
                  : "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 hover:shadow-md"
            )}
          >
            {isRecording ? (
              <div className="h-3.5 w-3.5 rounded-sm bg-white" />
            ) : isTranscribing ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : (
              <MicrophoneIcon className="h-4 w-4" />
            )}
            {isRecording ? "Arrêter" : isTranscribing ? "Transcription..." : "Dicter mes notes"}
          </button>
        </div>

        {/* Date filter */}
        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500 sm:gap-3">
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
      </div>

      <EhrExportGuide />

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
        accept=".pdf,.docx,.dotx,.doc,.xml,.jpg,.jpeg,.png,.tiff,.heic"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* File list — split by Interne / Externe */}
      {docs.length > 0 && (() => {
        const interne = docs.filter((d) => d.classification?.author_type === "psychiatre_traitant");
        const externe = docs.filter((d) => !d.classification || d.classification.author_type !== "psychiatre_traitant");
        return (
          <div className="mt-6 space-y-6">
            {interne.length > 0 && (
              <div>
                <Subheading>Interne — {interne.length} document{interne.length > 1 ? "s" : ""}</Subheading>
                <ul className="mt-2 divide-y divide-zinc-100 rounded-lg border border-zinc-200">
                  {interne.map((d) => (
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
            {externe.length > 0 && (
              <div>
                <Subheading>Externe — {externe.length} document{externe.length > 1 ? "s" : ""}</Subheading>
                <ul className="mt-2 divide-y divide-zinc-100 rounded-lg border border-zinc-200">
                  {externe.map((d) => (
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
          </div>
        );
      })()}

      {/* Notes complémentaires — shown when notes exist or transcription in progress */}
      {(notes || isTranscribing) && (
        <div className="mt-6">
          <Subheading>Notes complémentaires</Subheading>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Ex : patient présente une anhédonie marquée depuis 3 mois, sommeil perturbé..."
            rows={4}
            className="mt-2 block w-full rounded-lg border border-zinc-950/10 bg-transparent px-3 py-2 text-sm text-zinc-950 placeholder:text-zinc-500 focus:border-zinc-950/20 focus:outline-none sm:text-sm/6"
          />
        </div>
      )}
    </div>
  );
}
