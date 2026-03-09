import { Subheading } from "@/components/heading";
import type { WizardDocument } from "@/lib/mock-data";
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

// ── Component ────────────────────────────────────────────

interface StepDocumentsProps {
  docs: WizardDocument[];
  onDocsChange: React.Dispatch<React.SetStateAction<WizardDocument[]>>;
}

/**
 * Step 1: drag-and-drop document upload with simulated classification.
 * The parent owns `docs` state because it needs it for `canNext` logic.
 */
export function StepDocuments({ docs, onDocsChange }: StepDocumentsProps) {
  const { dragging, fileRef, addFiles, onDrop, onDragOver, onDragLeave } =
    useFileUpload(onDocsChange);

  return (
    <div>
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
              <DocumentListItem key={d.id} doc={d} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
