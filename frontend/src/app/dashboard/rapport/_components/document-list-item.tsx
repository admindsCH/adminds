import { Badge } from "@/components/badge";
import { CATEGORY_LABELS, CATEGORY_COLORS, type CategoryType } from "@/lib/schemas/classification";
import type { WizardDocument } from "../_types";

// ── Helpers ──────────────────────────────────────────────

/** Format bytes into a human-readable string (B / KB / MB). */
export function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

// All category keys for rendering selectable badges
const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as CategoryType[];

// ── Status dot colors ────────────────────────────────────

const STATUS_DOT: Record<WizardDocument["status"], string> = {
  classifying: "bg-indigo-500 animate-pulse",
  done: "bg-green-500",
  error: "bg-red-500",
};

// ── Component ────────────────────────────────────────────

interface DocumentListItemProps {
  doc: WizardDocument;
  /** Called when the user clicks a category badge to change classification. */
  onCategoryChange?: (id: string, category: CategoryType) => void;
  /** Called when the user clicks the delete button. If omitted, no delete button is shown. */
  onDelete?: (id: string) => void;
}

/**
 * A single document row used in upload lists.
 * When classification is done, shows all category labels as selectable badges.
 * The AI-selected category is highlighted; user can click others to override.
 */
export function DocumentListItem({
  doc,
  onCategoryChange,
  onDelete,
}: DocumentListItemProps) {
  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-3 sm:flex-nowrap sm:gap-3 sm:px-4">
      {/* File icon */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
        <svg className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      </div>

      {/* Name + size */}
      <div className="min-w-0 flex-1 sm:flex-initial sm:shrink-0">
        <p className="truncate text-sm font-medium text-zinc-900">
          {doc.fileName}
        </p>
        <p className="text-xs text-zinc-500">
          {formatBytes(doc.fileSize)}
        </p>
      </div>

      {/* Delete button — on mobile, show next to file name */}
      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(doc.id)}
          className="shrink-0 rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 sm:order-last"
          aria-label={`Supprimer ${doc.fileName}`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Category badges — all shown when done, selected one highlighted */}
      {doc.status === "done" && (
        <div className="flex w-full flex-wrap items-center gap-1 sm:w-auto sm:flex-1 sm:gap-1.5 sm:pl-2">
          {ALL_CATEGORIES.map((cat) => {
            const isSelected = doc.category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onCategoryChange?.(doc.id, cat)}
                className="cursor-pointer"
              >
                <Badge color={isSelected ? CATEGORY_COLORS[cat] : "zinc"}>
                  {CATEGORY_LABELS[cat]}
                </Badge>
              </button>
            );
          })}
        </div>
      )}

      {/* Classifying indicator */}
      {doc.status === "classifying" && (
        <div className="flex flex-1 items-center gap-2 pl-2">
          <span className={`h-2 w-2 rounded-full ${STATUS_DOT[doc.status]}`} />
          <span className="text-xs text-zinc-500">Classification...</span>
        </div>
      )}

      {/* Error indicator */}
      {doc.status === "error" && (
        <div className="flex flex-1 items-center gap-2 pl-2">
          <span className={`h-2 w-2 rounded-full ${STATUS_DOT[doc.status]}`} />
          <span className="text-xs text-red-500">Erreur de classification</span>
        </div>
      )}
    </li>
  );
}
