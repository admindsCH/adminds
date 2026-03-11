import { Badge } from "@/components/badge";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/schemas/classification";
import type { WizardDocument } from "@/lib/mock-data";

// ── Helpers ──────────────────────────────────────────────

/** Format bytes into a human-readable string (B / KB / MB). */
export function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

/** Status text shown below the filename while processing. */
function statusText(doc: WizardDocument): string {
  if (doc.status === "classifying") return " — Classification...";
  if (doc.status === "done" && doc.summary) return ` — ${doc.summary}`;
  if (doc.status === "error") return " — Erreur de classification";
  return "";
}

// ── Status dot colors ────────────────────────────────────

const STATUS_DOT: Record<WizardDocument["status"], string> = {
  classifying: "bg-indigo-500 animate-pulse",
  done: "bg-green-500",
  error: "bg-red-500",
};

// ── Component ────────────────────────────────────────────

interface DocumentListItemProps {
  doc: WizardDocument;
  /** Show file size + status text (step 1 = true, step 3 = false). */
  showDetails?: boolean;
  /** Called when the user clicks the delete button. If omitted, no delete button is shown. */
  onDelete?: (id: string) => void;
}

/**
 * A single document row used in upload lists.
 * Renders a status dot, filename, optional size/status, category badge, and optional delete button.
 */
export function DocumentListItem({
  doc,
  showDetails = true,
  onDelete,
}: DocumentListItemProps) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      {/* Status dot */}
      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[doc.status]}`} />

      {/* Name + optional details */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-900">
          {doc.fileName}
        </p>
        {showDetails && (
          <p className="truncate text-xs text-zinc-500">
            {formatBytes(doc.fileSize)}
            {statusText(doc)}
          </p>
        )}
      </div>

      {/* Category badge (only when classification is done) */}
      {doc.status === "done" && (
        <Badge color={CATEGORY_COLORS[doc.category]}>
          {CATEGORY_LABELS[doc.category]}
        </Badge>
      )}

      {/* Delete button */}
      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(doc.id)}
          className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
          aria-label={`Supprimer ${doc.fileName}`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </li>
  );
}
