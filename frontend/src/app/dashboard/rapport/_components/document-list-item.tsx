import { Badge } from "@/components/badge";
import {
  DOC_CATEGORY_LABELS,
  DOC_CATEGORY_COLORS,
  type WizardDocument,
} from "@/lib/mock-data";

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
  if (doc.status === "extracting") return " — Extraction...";
  if (doc.status === "done") return ` — ${doc.extractedFields} champs extraits`;
  return "";
}

// ── Status dot colors ────────────────────────────────────

const STATUS_DOT: Record<WizardDocument["status"], string> = {
  classifying: "bg-indigo-500 animate-pulse",
  extracting: "bg-amber-500 animate-pulse",
  done: "bg-green-500",
  error: "bg-red-500",
};

// ── Component ────────────────────────────────────────────

interface DocumentListItemProps {
  doc: WizardDocument;
  /** Show file size + status text (step 1 = true, step 3 = false). */
  showDetails?: boolean;
}

/**
 * A single document row used in upload lists.
 * Renders a status dot, filename, optional size/status, and category badge.
 */
export function DocumentListItem({
  doc,
  showDetails = true,
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
          <p className="text-xs text-zinc-500">
            {formatBytes(doc.fileSize)}
            {statusText(doc)}
          </p>
        )}
      </div>

      {/* Category badge (only when classification is done) */}
      {doc.status === "done" && (
        <Badge color={DOC_CATEGORY_COLORS[doc.category] as "indigo" | "amber" | "blue" | "purple" | "zinc"}>
          {DOC_CATEGORY_LABELS[doc.category]}
        </Badge>
      )}
    </li>
  );
}
