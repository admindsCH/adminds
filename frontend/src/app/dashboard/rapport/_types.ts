import type { CategoryType, DocumentClassification } from "@/lib/schemas/classification";

/** A single uploaded & processed document in the wizard. */
export interface WizardDocument {
  id: string;
  file: File;                              // actual File object kept for backend upload
  fileName: string;
  fileSize: number;
  category: CategoryType;                  // 9-value category from classification agent
  status: "classifying" | "done" | "error";
  classification: DocumentClassification | null; // full backend response
  summary: string;                         // one-line summary from classification
}
