"use client";

import { useState, useCallback, useRef } from "react";
import type { WizardDocument } from "../_types";
import { api } from "@/lib/api";

/**
 * Shared hook for file upload, drag-and-drop, and classification.
 * Used by both step 1 (main docs) and step 3 (extra docs).
 *
 * When files are added, they immediately appear as "classifying" in the UI.
 * The hook sends them to POST /api/classify and updates state with the result.
 *
 * @param setDocs - state setter for the document list this hook manages
 */
export function useFileUpload(
  setDocs: React.Dispatch<React.SetStateAction<WizardDocument[]>>,
  doctorName?: string,
) {
  // Whether the user is currently dragging a file over the drop zone
  const [dragging, setDragging] = useState(false);
  // Hidden <input type="file"> ref — triggered by click on the drop zone
  const fileRef = useRef<HTMLInputElement>(null);

  // Send files to backend for classification, then update state with results
  const classifyBatch = useCallback(
    async (files: File[], docIds: string[]) => {
      try {
        // POST /api/classify — sends all files as multipart/form-data
        const results = await api.classifyDocuments(files, doctorName);

        // Map results back to docs by index (backend returns same order as uploaded)
        setDocs((prev) =>
          prev.map((d) => {
            const idx = docIds.indexOf(d.id);
            if (idx === -1 || !results[idx]) return d;
            const result = results[idx];
            return {
              ...d,
              status: "done" as const,
              category: result.classification.category,
              classification: result.classification,
              summary: result.classification.summary,
            };
          })
        );
      } catch {
        // On any error, mark all docs in this batch as failed
        setDocs((prev) =>
          prev.map((d) =>
            docIds.includes(d.id) ? { ...d, status: "error" as const } : d
          )
        );
      }
    },
    [setDocs, doctorName]
  );

  // Convert a FileList into WizardDocuments and start classification
  const addFiles = useCallback(
    (files: FileList) => {
      const fileArray = Array.from(files);

      // Create placeholder docs with "classifying" status
      const newDocs: WizardDocument[] = fileArray.map((f) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        fileName: f.name,
        fileSize: f.size,
        category: "autre" as const,
        status: "classifying" as const,
        classification: null,
        summary: "",
      }));

      // Add to state immediately so user sees the files
      setDocs((prev) => [...prev, ...newDocs]);

      // Send to backend for classification
      const docIds = newDocs.map((d) => d.id);
      classifyBatch(fileArray, docIds);
    },
    [setDocs, classifyBatch]
  );

  // Drop handler — call on the drop zone's onDrop
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  // Drag handlers — attach to the drop zone
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  return { dragging, fileRef, addFiles, onDrop, onDragOver, onDragLeave };
}
