"use client";

import { useState, useCallback, useRef } from "react";
import type { DocCategory, WizardDocument } from "@/lib/mock-data";

// All doc categories for random assignment during mock classification
const CATEGORIES: DocCategory[] = [
  "dpi-smeex",
  "antecedents",
  "rapports-medicaux",
  "imagerie",
  "autre",
];

/**
 * Shared hook for file upload, drag-and-drop, and mock classification.
 * Used by both step 1 (main docs) and step 3 (extra docs).
 *
 * @param setDocs - state setter for the document list this hook manages
 */
export function useFileUpload(
  setDocs: React.Dispatch<React.SetStateAction<WizardDocument[]>>
) {
  // Whether the user is currently dragging a file over the drop zone
  const [dragging, setDragging] = useState(false);
  // Hidden <input type="file"> ref — triggered by click on the drop zone
  const fileRef = useRef<HTMLInputElement>(null);

  // Simulate AI classification: classifying → extracting → done
  const classify = useCallback(
    (doc: WizardDocument) => {
      setTimeout(() => {
        // Move to "extracting" after 1s
        setDocs((prev) =>
          prev.map((d) =>
            d.id === doc.id ? { ...d, status: "extracting" } : d
          )
        );
        setTimeout(() => {
          // Move to "done" after another 1s, assign random category + fields
          setDocs((prev) =>
            prev.map((d) =>
              d.id === doc.id
                ? {
                    ...d,
                    status: "done" as const,
                    category:
                      CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
                    extractedFields: Math.floor(Math.random() * 8) + 3,
                  }
                : d
            )
          );
        }, 1000);
      }, 1000);
    },
    [setDocs]
  );

  // Convert a FileList into WizardDocuments and start classification
  const addFiles = useCallback(
    (files: FileList) => {
      const newDocs: WizardDocument[] = Array.from(files).map((f) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        fileName: f.name,
        fileSize: f.size,
        category: "autre" as DocCategory,
        status: "classifying" as const,
        extractedFields: 0,
      }));
      setDocs((prev) => [...prev, ...newDocs]);
      newDocs.forEach((d) => classify(d));
    },
    [setDocs, classify]
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
