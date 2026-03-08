"use client";

import { useCallback, useState, useMemo, useEffect, useRef } from "react";
import { Heading } from "@/components/heading";
import { Text } from "@/components/text";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Input, InputGroup } from "@/components/input";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import {
  MOCK_PATIENTS,
  MOCK_NOTES,
  MOCK_DOCUMENTS,
  REPORT_TYPES,
  MOCK_REPORT_SECTIONS,
} from "@/lib/mock-data";
import type { PatientDocument, ReportSection } from "@/lib/mock-data";
import {
  Dropdown,
  DropdownButton,
  DropdownMenu,
  DropdownItem,
} from "@/components/dropdown";
import {
  FileUp,
  FileText,
  Sparkles,
  Download,
  Mic,
  PenLine,
  Clock,
  Search,
  FileDown,
  Loader2,
  Check,
  Paperclip,
  X,
  ImageIcon,
} from "lucide-react";
import { AIVoiceInput } from "@/components/ui/ai-voice-input";

// Find mock patient by ID (first one as fallback for now)
const patient = MOCK_PATIENTS[0];

// Filter mock data for this patient
const patientNotes = MOCK_NOTES.filter((n) => n.patientId === patient.id);
const patientDocuments = MOCK_DOCUMENTS.filter(
  (d) => d.patientId === patient.id,
);

// Tab definitions
const TABS = [
  { id: "info", label: "Informations" },
  { id: "notes", label: "Notes" },
  { id: "documents", label: "Documents" },
  { id: "rapports", label: "Rapports" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// Note input mode: text or voice
type NoteInputMode = "text" | "voice";

// Format file size from bytes to human-readable string
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

// Category labels for document list
const DOC_CATEGORY_LABELS: Record<string, string> = {
  "dpi-smeex": "DPI (SMEEX)",
  antecedents: "Antécédents",
  autre: "Autre",
};

// Category badge colors
const DOC_CATEGORY_COLORS: Record<string, string> = {
  "dpi-smeex": "indigo",
  antecedents: "amber",
  autre: "zinc",
};

// Simulated AI classification: picks a category based on file extension/name
function classifyDocument(fileName: string): PatientDocument["category"] {
  const lower = fileName.toLowerCase();
  if (lower.includes("smeex") || lower.endsWith(".xml")) return "dpi-smeex";
  if (
    lower.includes("rapport") ||
    lower.includes("bilan") ||
    lower.includes("medical")
  )
    return "antecedents";
  return "autre";
}

// Represents a file being "classified" by AI before appearing in the list
interface ClassifyingFile {
  id: string;
  fileName: string;
  fileSize: number;
  category: PatientDocument["category"] | null; // null while classifying
}

export default function PatientDetailPage() {
  const [activeTab, setActiveTab] = useState<TabId>("info");
  const [isDragging, setIsDragging] = useState(false);
  // Notes tab state
  const [noteInputMode, setNoteInputMode] = useState<NoteInputMode>("text");
  // Files attached to the current note (documents + photos)
  const [noteAttachments, setNoteAttachments] = useState<File[]>([]);
  const noteFileInputRef = useRef<HTMLInputElement>(null);
  // Search + date filter state for notes
  const [noteSearch, setNoteSearch] = useState("");
  const [noteDateFrom, setNoteDateFrom] = useState("");
  const [noteDateTo, setNoteDateTo] = useState("");
  // Search + date + category filter state for documents
  const [docSearch, setDocSearch] = useState("");
  const [docDateFrom, setDocDateFrom] = useState("");
  const [docDateTo, setDocDateTo] = useState("");
  const [docCategoryFilter, setDocCategoryFilter] = useState<
    PatientDocument["category"] | null
  >(null);
  // --- Report editor state ---
  // Which report type is being generated/edited (null = show list)
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  // Editable section contents (keyed by section id)
  const [editedSections, setEditedSections] = useState<Record<string, string>>(
    {},
  );
  // How many characters have been "streamed" so far (typewriter effect)
  const [streamedChars, setStreamedChars] = useState(0);
  // Whether generation is complete
  const [generationDone, setGenerationDone] = useState(false);
  // Ref to auto-scroll the editor during streaming
  const editorRef = useRef<HTMLDivElement>(null);

  // Get the sections for the active report
  const activeReportSections = activeReportId
    ? (MOCK_REPORT_SECTIONS[activeReportId] ?? [])
    : [];
  const activeReportType = REPORT_TYPES.find((r) => r.id === activeReportId);

  // Total character count across all sections (title + content)
  const totalChars = activeReportSections.reduce(
    (sum, s) => sum + s.title.length + s.content.length,
    0,
  );

  // Typewriter effect: increment streamed chars over time
  useEffect(() => {
    if (!activeReportId || generationDone) return;

    // Stream at ~30 chars per frame (~50ms interval = ~600 chars/sec)
    const interval = setInterval(() => {
      setStreamedChars((prev) => {
        const next = prev + 30;
        if (next >= totalChars) {
          clearInterval(interval);
          return totalChars;
        }
        return next;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [activeReportId, generationDone, totalChars]);

  // Mark generation done when all chars have been streamed
  useEffect(() => {
    if (activeReportId && streamedChars >= totalChars && totalChars > 0) {
      setGenerationDone(true);
      // Initialize editable sections with the full content
      const initial: Record<string, string> = {};
      for (const s of activeReportSections) {
        initial[s.id] = s.content;
      }
      setEditedSections(initial);
    }
  }, [streamedChars, totalChars, activeReportId, activeReportSections]);

  // Auto-scroll editor to bottom during streaming
  useEffect(() => {
    if (!generationDone && editorRef.current) {
      editorRef.current.scrollTop = editorRef.current.scrollHeight;
    }
  }, [streamedChars, generationDone]);

  // Start generating a report
  function handleGenerate(reportId: string) {
    setActiveReportId(reportId);
    setStreamedChars(0);
    setGenerationDone(false);
    setEditedSections({});
  }

  // Go back to report list
  function handleBackToList() {
    setActiveReportId(null);
    setStreamedChars(0);
    setGenerationDone(false);
    setEditedSections({});
  }

  // Get the visible text for streaming: returns the portion of each section
  // that should be visible given the current streamedChars count
  function getVisibleText(
    sections: ReportSection[],
    maxChars: number,
  ): { id: string; title: string; content: string; complete: boolean }[] {
    let remaining = maxChars;
    const result: {
      id: string;
      title: string;
      content: string;
      complete: boolean;
    }[] = [];

    for (const section of sections) {
      if (remaining <= 0) break;

      const titleLen = section.title.length;
      const contentLen = section.content.length;
      const sectionTotal = titleLen + contentLen;

      if (remaining >= sectionTotal) {
        // Full section visible
        result.push({
          id: section.id,
          title: section.title,
          content: section.content,
          complete: true,
        });
        remaining -= sectionTotal;
      } else if (remaining > titleLen) {
        // Title fully visible, content partially
        result.push({
          id: section.id,
          title: section.title,
          content: section.content.slice(0, remaining - titleLen),
          complete: false,
        });
        remaining = 0;
      } else {
        // Title partially visible
        result.push({
          id: section.id,
          title: section.title.slice(0, remaining),
          content: "",
          complete: false,
        });
        remaining = 0;
      }
    }

    return result;
  }

  // Files currently being "classified" by AI (animation)
  const [classifyingFiles, setClassifyingFiles] = useState<ClassifyingFile[]>(
    [],
  );

  // After 2s, assign a category to each classifying file (simulates AI)
  useEffect(() => {
    const pending = classifyingFiles.filter((f) => f.category === null);
    if (pending.length === 0) return;

    const timeout = setTimeout(() => {
      setClassifyingFiles((prev) =>
        prev.map((f) =>
          f.category === null
            ? { ...f, category: classifyDocument(f.fileName) }
            : f,
        ),
      );
    }, 2000);

    return () => clearTimeout(timeout);
  }, [classifyingFiles]);

  // Drag & drop handlers for the single drop zone
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    addFilesForClassification(files);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      addFilesForClassification(files);
    },
    [],
  );

  // Add dropped/selected files to the classifying queue
  function addFilesForClassification(files: File[]) {
    const newFiles: ClassifyingFile[] = files.map((f, i) => ({
      id: `classifying-${Date.now()}-${i}`,
      fileName: f.name,
      fileSize: f.size,
      category: null, // null = AI is classifying
    }));
    setClassifyingFiles((prev) => [...prev, ...newFiles]);
  }

  // Filtered notes: search by summary/content + date range
  const filteredNotes = useMemo(() => {
    let notes = patientNotes;

    if (noteSearch) {
      const q = noteSearch.toLowerCase();
      notes = notes.filter(
        (n) =>
          n.summary.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q),
      );
    }

    if (noteDateFrom) {
      notes = notes.filter((n) => n.createdAt >= noteDateFrom);
    }
    if (noteDateTo) {
      // Add a day so "to" date is inclusive
      notes = notes.filter((n) => n.createdAt <= noteDateTo + "T23:59:59");
    }

    return notes;
  }, [noteSearch, noteDateFrom, noteDateTo]);

  // Filtered documents: search by file name + date range
  const filteredDocuments = useMemo(() => {
    let docs = patientDocuments;

    if (docSearch) {
      const q = docSearch.toLowerCase();
      docs = docs.filter((d) => d.fileName.toLowerCase().includes(q));
    }

    if (docDateFrom) {
      docs = docs.filter((d) => d.uploadedAt >= docDateFrom);
    }
    if (docDateTo) {
      docs = docs.filter((d) => d.uploadedAt <= docDateTo + "T23:59:59");
    }

    if (docCategoryFilter) {
      docs = docs.filter((d) => d.category === docCategoryFilter);
    }

    return docs;
  }, [docSearch, docDateFrom, docDateTo, docCategoryFilter]);

  // === Report editor ===
  // Renders inside the existing SidebarLayout (white bg, p-10 padding, max-w-6xl).
  // No need to break out — just use the space we're given.
  if (activeReportId) {
    return (
      <div className="max-w-4xl mx-auto">
        {/* Top bar: back + report info + download */}
        <div className="flex items-center justify-between py-4 mb-8 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <Button plain onClick={handleBackToList}>
              <ArrowLeftIcon className="size-4" />
              Retour aux rapports
            </Button>
            <div className="h-5 w-px bg-zinc-200" />
            <div>
              <p className="text-sm font-medium text-zinc-900">
                {activeReportType?.name}
              </p>
              <p className="text-xs text-zinc-500">
                {patient.lastName} {patient.firstName} — {patient.avsNumber}
              </p>
            </div>
            {!generationDone ? (
              <Badge color="amber">
                <Loader2 className="size-3 animate-spin" />
                Génération en cours...
              </Badge>
            ) : (
              <Badge color="green">
                <Check className="size-3" />
                Généré
              </Badge>
            )}
          </div>

          <Dropdown>
            <DropdownButton outline disabled={!generationDone}>
              <Download data-slot="icon" />
              Télécharger
            </DropdownButton>
            <DropdownMenu anchor="bottom end">
              <DropdownItem onClick={() => console.log("Export PDF")}>
                <Download data-slot="icon" />
                Exporter en PDF
              </DropdownItem>
              <DropdownItem onClick={() => console.log("Export Word")}>
                <FileDown data-slot="icon" />
                Exporter en Word
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>

        {/* Report header */}
        <div className="mb-10 text-center">
          <h1 className="text-xl font-bold text-zinc-900">
            {activeReportType?.name}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Patient : {patient.lastName} {patient.firstName} — AVS :{" "}
            {patient.avsNumber}
          </p>
          <p className="text-sm text-zinc-500">
            Date :{" "}
            {new Date().toLocaleDateString("fr-CH", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        {/* Sections: streaming or editable */}
        <div ref={editorRef}>
          {!generationDone ? (
            <div className="space-y-8">
              {getVisibleText(activeReportSections, streamedChars).map(
                (section) => (
                  <div key={section.id}>
                    <h2 className="text-sm font-bold text-zinc-900 mb-2">
                      {section.title}
                    </h2>
                    <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line break-words">
                      {section.content}
                      {!section.complete && (
                        <span className="inline-block w-0.5 h-4 bg-indigo-500 animate-pulse ml-0.5 align-text-bottom" />
                      )}
                    </p>
                  </div>
                ),
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {activeReportSections.map((section) => (
                <div key={section.id}>
                  <h2 className="text-sm font-bold text-zinc-900 mb-2">
                    {section.title}
                  </h2>
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      const text = e.currentTarget?.innerText ?? "";
                      setEditedSections((prev) => ({
                        ...prev,
                        [section.id]: text,
                      }));
                    }}
                    className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line break-words rounded-lg border border-transparent p-3 -m-3 hover:border-zinc-200 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-colors"
                  >
                    {editedSections[section.id] ?? section.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Top bar: back + patient name + report badge */}
      <div className="mb-6">
        <Button plain href="/dashboard/patients" className="mb-4">
          <ArrowLeftIcon className="size-4" />
          Retour aux patients
        </Button>
        <div className="flex items-center gap-3">
          <Heading>
            {patient.lastName} {patient.firstName}
          </Heading>
          {patient.hasReport && (
            <Badge color="green">Rapport généré</Badge>
          )}
        </div>
        <Text className="mt-1">
          Créé le{" "}
          {new Date(patient.createdAt).toLocaleDateString("fr-CH", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </div>

      {/* Tab bar */}
      <div className="border-b border-zinc-200">
        <nav className="flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-b-2 border-indigo-500 text-indigo-600"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {/* === Informations tab === */}
        {activeTab === "info" && (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-zinc-500">Nom</dt>
                <dd className="mt-1 text-sm text-zinc-900">
                  {patient.lastName}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-zinc-500">Prénom</dt>
                <dd className="mt-1 text-sm text-zinc-900">
                  {patient.firstName}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-zinc-500">
                  Date de naissance
                </dt>
                <dd className="mt-1 text-sm text-zinc-900">
                  {new Date(patient.dateOfBirth).toLocaleDateString("fr-CH")}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-zinc-500">
                  Numéro AVS
                </dt>
                <dd className="mt-1 text-sm text-zinc-900">
                  {patient.avsNumber}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {/* === Notes tab === */}
        {activeTab === "notes" && (
          <div className="space-y-6">
            {/* Input mode toggle + input area */}
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
              {/* Toggle bar: Text vs Voice */}
              <div className="flex border-b border-zinc-100">
                <button
                  onClick={() => setNoteInputMode("text")}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                    noteInputMode === "text"
                      ? "border-b-2 border-indigo-500 text-indigo-600"
                      : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  <PenLine className="size-4" />
                  Écrire
                </button>
                <button
                  onClick={() => setNoteInputMode("voice")}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                    noteInputMode === "voice"
                      ? "border-b-2 border-indigo-500 text-indigo-600"
                      : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  <Mic className="size-4" />
                  Dicter
                </button>
              </div>

              {/* Text input mode */}
              {noteInputMode === "text" && (
                <div className="p-4">
                  <textarea
                    placeholder="Ajoutez une note..."
                    className="w-full min-h-[120px] rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
                  />

                  {/* Attached files list */}
                  {noteAttachments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {noteAttachments.map((file, i) => {
                        // Show image icon for image files, document icon otherwise
                        const isImage = file.type.startsWith("image/");
                        return (
                          <span
                            key={`${file.name}-${i}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-700"
                          >
                            {isImage ? (
                              <ImageIcon className="size-3.5 text-indigo-500 shrink-0" />
                            ) : (
                              <FileText className="size-3.5 text-zinc-400 shrink-0" />
                            )}
                            <span className="max-w-[140px] truncate">
                              {file.name}
                            </span>
                            {/* Remove button */}
                            <button
                              type="button"
                              onClick={() =>
                                setNoteAttachments((prev) =>
                                  prev.filter((_, idx) => idx !== i),
                                )
                              }
                              className="ml-0.5 rounded p-0.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200 transition-colors"
                            >
                              <X className="size-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Action bar: attach + save */}
                  <div className="mt-3 flex items-center justify-between">
                    {/* Hidden file input for attachments */}
                    <input
                      ref={noteFileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.heic,.tiff"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        setNoteAttachments((prev) => [...prev, ...files]);
                        // Reset so the same file can be re-selected
                        e.target.value = "";
                      }}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => noteFileInputRef.current?.click()}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                    >
                      <Paperclip className="size-4" />
                      Joindre un fichier
                    </button>
                    <Button color="indigo">Enregistrer la note</Button>
                  </div>
                </div>
              )}

              {/* Voice input mode */}
              {noteInputMode === "voice" && (
                <div className="p-4">
                  <AIVoiceInput
                    onStart={() => console.log("Recording started")}
                    onStop={(duration) =>
                      console.log(`Recording stopped: ${duration}s`)
                    }
                  />
                </div>
              )}
            </div>

            {/* Notes list with filters */}
            <div>
              <h3 className="text-sm font-medium text-zinc-900 mb-3 mt-2">
                Notes existantes ({filteredNotes.length})
              </h3>

              {/* Search + date filters */}
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <InputGroup>
                    <Search data-slot="icon" />
                    <Input
                      type="search"
                      placeholder="Rechercher dans les notes..."
                      value={noteSearch}
                      onChange={(e) => setNoteSearch(e.target.value)}
                    />
                  </InputGroup>
                </div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={noteDateFrom}
                    onChange={(e) => setNoteDateFrom(e.target.value)}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="date"
                    value={noteDateTo}
                    onChange={(e) => setNoteDateTo(e.target.value)}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Notes list */}
              <div className="space-y-3">
                {filteredNotes.length > 0 ? (
                  filteredNotes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          {note.type === "voice" ? (
                            <Mic className="size-4 text-indigo-500 shrink-0" />
                          ) : (
                            <PenLine className="size-4 text-zinc-400 shrink-0" />
                          )}
                          <p className="text-sm font-medium text-zinc-900">
                            {note.summary}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {note.type === "voice" && note.durationSeconds && (
                            <Badge color="indigo">
                              <Clock className="size-3" />
                              {Math.floor(note.durationSeconds / 60)}:
                              {(note.durationSeconds % 60)
                                .toString()
                                .padStart(2, "0")}
                            </Badge>
                          )}
                          <span className="text-xs text-zinc-400">
                            {new Date(note.createdAt).toLocaleDateString(
                              "fr-CH",
                              {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </span>
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
                        {note.content}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
                    <Text className="text-zinc-500">
                      Aucune note ne correspond à votre recherche.
                    </Text>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* === Documents tab === */}
        {activeTab === "documents" && (
          <div className="space-y-6">
            {/* Single unified drop zone */}
            <label
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`block cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                isDragging
                  ? "border-indigo-400 bg-indigo-50"
                  : "border-zinc-300 bg-white hover:border-indigo-300 hover:bg-indigo-50/30"
              }`}
            >
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.xml,.png,.jpg,.jpeg,.tiff"
                onChange={handleFileSelect}
                className="hidden"
              />
              <FileUp
                className={`mx-auto size-10 ${isDragging ? "text-indigo-500" : "text-zinc-400"}`}
              />
              <p className="mt-3 text-sm font-medium text-zinc-900">
                Importer des documents
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Glissez-déposez ou cliquez — DPI, rapports médicaux, formulaires
                etc. L&apos;IA classifiera automatiquement chaque document.
              </p>
            </label>

            {/* Files being classified by AI (animation) */}
            {classifyingFiles.length > 0 && (
              <div className="space-y-2">
                {classifyingFiles.map((file) => (
                  <div
                    key={file.id}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-sm transition-all duration-500 ${
                      file.category === null
                        ? "border-indigo-200 bg-indigo-50/50"
                        : "border-zinc-200 bg-white"
                    }`}
                  >
                    {/* Spinner while classifying, file icon once done */}
                    <div className="rounded-lg bg-zinc-100 p-2 shrink-0">
                      {file.category === null ? (
                        <Sparkles className="size-4 text-indigo-500 animate-pulse" />
                      ) : (
                        <FileText className="size-4 text-zinc-500" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate">
                        {file.fileName}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {file.category === null ? (
                          <span className="text-indigo-600 font-medium">
                            Classification par IA en cours...
                          </span>
                        ) : (
                          formatFileSize(file.fileSize)
                        )}
                      </p>
                    </div>

                    {/* Category badge appears after classification */}
                    {file.category !== null && (
                      <Badge
                        color={
                          (DOC_CATEGORY_COLORS[file.category] ?? "zinc") as any
                        }
                      >
                        {DOC_CATEGORY_LABELS[file.category] ?? file.category}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Existing documents with filters */}
            <div>
              <h3 className="text-sm font-medium text-zinc-900 mb-3 mt-2">
                Documents importés ({filteredDocuments.length})
              </h3>

              {/* Search + date filters */}
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <InputGroup>
                    <Search data-slot="icon" />
                    <Input
                      type="search"
                      placeholder="Rechercher un document..."
                      value={docSearch}
                      onChange={(e) => setDocSearch(e.target.value)}
                    />
                  </InputGroup>
                </div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={docDateFrom}
                    onChange={(e) => setDocDateFrom(e.target.value)}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="date"
                    value={docDateTo}
                    onChange={(e) => setDocDateTo(e.target.value)}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Category filter pills */}
              <div className="mb-4 flex gap-2">
                {[null, "dpi-smeex", "antecedents", "autre"].map((cat) => (
                  <button
                    key={cat ?? "all"}
                    onClick={() =>
                      setDocCategoryFilter(
                        cat as PatientDocument["category"] | null,
                      )
                    }
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      docCategoryFilter === cat
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                    }`}
                  >
                    {cat === null
                      ? "Tous"
                      : (DOC_CATEGORY_LABELS[cat] ?? cat)}
                  </button>
                ))}
              </div>

              {/* Document list */}
              <div className="space-y-2">
                {filteredDocuments.length > 0 ? (
                  filteredDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm"
                    >
                      <div className="rounded-lg bg-zinc-100 p-2 shrink-0">
                        <FileText className="size-4 text-zinc-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-900 truncate">
                          {doc.fileName}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {formatFileSize(doc.fileSize)} ·{" "}
                          {new Date(doc.uploadedAt).toLocaleDateString(
                            "fr-CH",
                            {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </p>
                      </div>
                      <Badge
                        color={
                          (DOC_CATEGORY_COLORS[doc.category] ?? "zinc") as any
                        }
                      >
                        {DOC_CATEGORY_LABELS[doc.category] ?? doc.category}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
                    <Text className="text-zinc-500">
                      Aucun document ne correspond à votre recherche.
                    </Text>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* === Rapports tab === */}
        {activeTab === "rapports" && !activeReportId && (
          <div className="space-y-3">
            {REPORT_TYPES.map((report) => {
              const Icon = report.icon;
              const hasSections = !!MOCK_REPORT_SECTIONS[report.id];
              return (
                <div
                  key={report.id}
                  className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                >
                  <div className="rounded-lg bg-indigo-50 p-2 shrink-0">
                    <Icon className="size-5 text-indigo-500" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900">
                      {report.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {report.description}
                    </p>
                  </div>

                  <Badge color="zinc">Non généré</Badge>

                  <div className="flex gap-2 shrink-0">
                    <Button
                      color="indigo"
                      onClick={() => handleGenerate(report.id)}
                      disabled={!hasSections}
                    >
                      <Sparkles className="size-4" />
                      Générer
                    </Button>
                    <Button outline disabled>
                      <Download className="size-4" />
                      PDF
                    </Button>
                  </div>
                </div>
              );
            })}

            <div className="pt-3">
              <Button outline className="w-full">
                <Download className="size-4" />
                Exporter tout en PDF
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
