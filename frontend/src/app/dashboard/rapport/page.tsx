"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/button";
import { Heading, Subheading } from "@/components/heading";
import { Text } from "@/components/text";
import { Badge } from "@/components/badge";
import { Logo } from "@/components/logo";
import {
  CANTONS,
  DOC_CATEGORY_LABELS,
  DOC_CATEGORY_COLORS,
  MOCK_EXTRACTED_SECTIONS,
  MOCK_FRIBOURG_FIELDS,
  MOCK_GENEVE_FIELDS,
  type Canton,
  type DocCategory,
  type WizardDocument,
} from "@/lib/mock-data";
import clsx from "clsx";
import { renderAsync } from "docx-preview";

// ── Steps ──────────────────────────────────────────────────

const STEPS = ["Documents", "Résumé", "Compléments", "Rapport"] as const;

const CATEGORIES: DocCategory[] = [
  "dpi-smeex",
  "antecedents",
  "rapports-medicaux",
  "imagerie",
  "autre",
];

// ── Page ───────────────────────────────────────────────────

export default function RapportPage() {
  const { user } = useUser();

  // Wizard state
  const [step, setStep] = useState(0);
  const [canton, setCanton] = useState<Canton>(
    (user?.unsafeMetadata?.canton as Canton) || "fribourg"
  );

  // Step 1: documents
  const [docs, setDocs] = useState<WizardDocument[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Step 3: additional info
  const [notes, setNotes] = useState("");
  const [extraDocs, setExtraDocs] = useState<WizardDocument[]>([]);
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // Step 4: generation
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  // Which generation sub-step is active (-1 = not started)
  const [genStep, setGenStep] = useState(-1);
  const previewRef = useRef<HTMLDivElement>(null);
  // Keep the fetched docx blob in memory so we can download it directly
  const docxBlobRef = useRef<Blob | null>(null);

  // Step 4: editable report sections (initialized when generation completes)
  const [editedSections, setEditedSections] = useState<Record<string, string>>({});
  // Track which sections are collapsed (all expanded by default)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  // Whether the editable sections slide-over is visible
  const [showEditor, setShowEditor] = useState(false);

  // Sync canton from Clerk metadata
  useEffect(() => {
    if (user?.unsafeMetadata?.canton) {
      setCanton(user.unsafeMetadata.canton as Canton);
    }
  }, [user?.unsafeMetadata?.canton]);

  // Render the .docx template in-browser when entering step 4.
  // Shows the empty template first, then swaps to the filled version
  // after generation completes.
  const [docxLoading, setDocxLoading] = useState(false);
  useEffect(() => {
    if (step !== 3 || !previewRef.current) return;
    let cancelled = false;

    async function loadDocx() {
      setDocxLoading(true);
      try {
        // Pick empty or filled template based on generation state
        const suffix = generated ? "-filled" : "";
        const res = await fetch(`/templates/${canton}${suffix}.docx`);
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled || !previewRef.current) return;
        // Store blob for download
        docxBlobRef.current = blob;
        previewRef.current.innerHTML = "";
        await renderAsync(blob, previewRef.current, undefined, {
          ignoreWidth: true,
          ignoreHeight: true,
        });
      } finally {
        if (!cancelled) setDocxLoading(false);
      }
    }

    loadDocx();
    return () => { cancelled = true; };
  }, [step, canton, generated]);

  // ── File handling ──────────────────────────────────────

  const classify = useCallback(
    (doc: WizardDocument, set: React.Dispatch<React.SetStateAction<WizardDocument[]>>) => {
      setTimeout(() => {
        set((prev) => prev.map((d) => (d.id === doc.id ? { ...d, status: "extracting" } : d)));
        setTimeout(() => {
          set((prev) =>
            prev.map((d) =>
              d.id === doc.id
                ? {
                    ...d,
                    status: "done" as const,
                    category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
                    extractedFields: Math.floor(Math.random() * 8) + 3,
                  }
                : d
            )
          );
        }, 1000);
      }, 1000);
    },
    []
  );

  const addFiles = useCallback(
    (files: FileList, set: React.Dispatch<React.SetStateAction<WizardDocument[]>>) => {
      const newDocs: WizardDocument[] = Array.from(files).map((f) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        fileName: f.name,
        fileSize: f.size,
        category: "autre" as DocCategory,
        status: "classifying" as const,
        extractedFields: 0,
      }));
      set((prev) => [...prev, ...newDocs]);
      newDocs.forEach((d) => classify(d, set));
    },
    [classify]
  );

  const onDrop = useCallback(
    (e: React.DragEvent, set: React.Dispatch<React.SetStateAction<WizardDocument[]>>) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files, set);
    },
    [addFiles]
  );

  // ── Step 4: generation ─────────────────────────────────

  // Simulated generation steps with labels and durations (ms).
  // In production these map to real backend calls.
  const GEN_STEPS = [
    { label: "Extraction des données du dossier patient", duration: 2200 },
    { label: "Analyse des antécédents médicaux", duration: 1800 },
    { label: "Intégration des notes du médecin", duration: 1400 },
    { label: "Rédaction du rapport AI", duration: 2500 },
    { label: "Mise en forme du document", duration: 1000 },
  ];

  const generate = useCallback(() => {
    setGenerating(true);
    setGenStep(0);

    // Walk through each step sequentially
    let step = 0;
    const advance = () => {
      step += 1;
      if (step < GEN_STEPS.length) {
        setGenStep(step);
        setTimeout(advance, GEN_STEPS[step].duration);
      } else {
        // All steps done
        setGenStep(GEN_STEPS.length);
        setTimeout(() => {
          setGenerating(false);
          setGenerated(true);
          // Pre-fill editable fields from the active canton's template
          const fields = canton === "geneve" ? MOCK_GENEVE_FIELDS : MOCK_FRIBOURG_FIELDS;
          const initial: Record<string, string> = {};
          for (const section of fields) {
            for (const field of section.fields) {
              initial[field.id] = field.value;
            }
          }
          setEditedSections(initial);
          // Auto-open the editor panel so the doctor sees it immediately
          setShowEditor(true);
        }, 500);
      }
    };
    setTimeout(advance, GEN_STEPS[0].duration);
  }, []);

  // ── Helpers ────────────────────────────────────────────

  const fmt = (b: number) => {
    if (b < 1024) return `${b} B`;
    if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`;
    return `${(b / 1048576).toFixed(1)} MB`;
  };

  const canNext = step === 0 ? docs.some((d) => d.status === "done") : true;

  // Build a descriptive filename for downloads.
  // Format: "Rapport AI - Marie Dupont - Première demande AI - 08.03.2026.docx"
  const buildFilename = useCallback(
    (ext: string) => {
      const patient = "Marie Dupont"; // TODO: replace with real patient name
      const type = "Première demande AI"; // TODO: replace with real stade
      const date = new Date().toLocaleDateString("fr-CH", {
        day: "2-digit", month: "2-digit", year: "numeric",
      }).replace(/\//g, ".");
      return `Rapport AI - ${patient} - ${type} - ${date}.${ext}`;
    },
    [],
  );

  // Download the filled .docx by creating a temporary <a> with an object URL.
  const downloadDocx = useCallback(() => {
    const blob = docxBlobRef.current;
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildFilename("docx");
    a.click();
    URL.revokeObjectURL(url);
  }, [buildFilename]);

  // "Download PDF" — opens the browser print dialog scoped to the docx
  // preview.  The user can then choose "Save as PDF" from the print
  // destination picker (works on Chrome, Edge, Safari, Firefox).
  const downloadPdf = useCallback(() => {
    if (!previewRef.current) return;
    // Open a new window with only the rendered preview content
    const win = window.open("", "_blank");
    if (!win) return;
    // Copy all stylesheets from the current page (docx-preview injects its own)
    const styles = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"))
      .map((el) => el.outerHTML)
      .join("\n");
    win.document.write(`<!DOCTYPE html><html><head><title>${buildFilename("pdf")}</title>${styles}
      <style>@media print { body { margin: 0; } .docx-preview { box-shadow: none !important; } }</style>
      </head><body>${previewRef.current.innerHTML}</body></html>`);
    win.document.close();
    // Wait for styles/images to load, then trigger print
    win.onload = () => { win.print(); win.close(); };
  }, [buildFilename]);

  // Toggle voice dictation for the notes textarea.
  // Uses the Web Speech API (Chrome/Edge/Safari). Falls back gracefully.
  const toggleVoice = useCallback(() => {
    // Stop if already listening
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    // Check browser support — vendor-prefixed on most browsers
    const SpeechRecognition =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "fr-CH";       // Swiss French
    recognition.continuous = true;     // Keep listening until stopped
    recognition.interimResults = false; // Only final transcripts

    recognition.onresult = (e: any) => {
      // Append each recognized phrase to the existing notes
      const transcript = Array.from(e.results)
        .slice(e.resultIndex)
        .map((r: any) => r[0].transcript)
        .join("");
      setNotes((prev) => (prev ? prev + " " + transcript : transcript));
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognition.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, []);

  // ── Render ─────────────────────────────────────────────

  return (
    <>
      {/* ── Top bar: logo + stepper ── */}
      <div className="flex items-center justify-between">
        <Logo size="sm" href="/dashboard" />

        {/* Stepper — compact pills */}
        <div className="flex items-center gap-1">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center">
              <button
                type="button"
                onClick={() => setStep(i)}
                className={clsx(
                  "flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                  i === step && "bg-zinc-900 text-white",
                  i < step && "bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
                  i > step && "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                )}
              >
                <span
                  className={clsx(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                    i === step && "bg-white text-zinc-900",
                    i < step && "bg-indigo-600 text-white",
                    i > step && "border border-zinc-200"
                  )}
                >
                  {i < step ? "✓" : i + 1}
                </span>
                <span className="hidden md:inline">{label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={clsx("mx-1 h-px w-4", i < step ? "bg-indigo-300" : "bg-zinc-200")} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Page title ── */}
      <div className="mt-10">
        <Heading>Nouveau rapport AI</Heading>
        <Text className="mt-1">
          {step === 0 && "Commencez par importer les documents du patient."}
          {step === 1 && "Vérifiez les informations extraites de vos documents."}
          {step === 2 && "Ajoutez des informations complémentaires."}
          {step === 3 && "Votre rapport est prêt à être généré."}
        </Text>
      </div>

      {/* ── Step content ── */}
      <div className="mt-8">
        {/* ────────── STEP 1: Upload documents ────────── */}
        {step === 0 && (
          <div>
            {/* Canton picker — inline with label */}
            <div className="mb-6 inline-flex items-baseline gap-3 rounded-lg border border-zinc-200 px-4 py-2.5">
              <span className="text-sm font-medium text-zinc-700">Canton</span>
              <select
                value={canton}
                onChange={(e) => setCanton(e.target.value as Canton)}
                className="border-none bg-transparent p-0 text-sm font-medium text-zinc-900 focus:outline-none"
              >
                {CANTONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Drop zone — big, inviting, entire area clickable */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => { if (e.key === "Enter") fileRef.current?.click(); }}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
              onDrop={(e) => onDrop(e, setDocs)}
              className={clsx(
                "group flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all",
                docs.length > 0 ? "py-10" : "py-20",
                dragging
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-zinc-300 bg-zinc-50/50 hover:border-indigo-400 hover:bg-indigo-50/30"
              )}
            >
              {/* Upload icon */}
              <div className={clsx(
                "mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-colors",
                dragging ? "bg-indigo-100" : "bg-zinc-100 group-hover:bg-indigo-50"
              )}>
                <svg className={clsx("h-6 w-6 transition-colors", dragging ? "text-indigo-600" : "text-zinc-400 group-hover:text-indigo-500")} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-zinc-900">
                Importez le dossier patient
              </p>
              <p className="mt-1.5 max-w-xs text-center text-xs leading-5 text-zinc-500">
                Glissez-déposez ou cliquez pour parcourir.
                PDF, Word, XML, scans et images.
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.docx,.doc,.xml,.jpg,.jpeg,.png,.tiff"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files, setDocs);
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
                    <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                      {/* Status */}
                      {d.status === "classifying" && (
                        <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
                      )}
                      {d.status === "extracting" && (
                        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                      )}
                      {d.status === "done" && (
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                      )}

                      {/* Name + size */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-900">
                          {d.fileName}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {fmt(d.fileSize)}
                          {d.status === "classifying" && " — Classification..."}
                          {d.status === "extracting" && " — Extraction..."}
                          {d.status === "done" && ` — ${d.extractedFields} champs extraits`}
                        </p>
                      </div>

                      {/* Badge */}
                      {d.status === "done" && (
                        <Badge color={DOC_CATEGORY_COLORS[d.category] as any}>
                          {DOC_CATEGORY_LABELS[d.category]}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ────────── STEP 2: Summary ────────── */}
        {step === 1 && (
          <div>
            <div className="flex flex-col gap-10">
              {MOCK_EXTRACTED_SECTIONS.map((section) => (
                <div key={section.id}>
                  <Subheading>{section.title}</Subheading>
                  <div className="mt-3 grid grid-cols-1 gap-px rounded-lg border border-zinc-200 sm:grid-cols-2">
                    {section.fields.map((field, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-3 border-t border-zinc-100 px-4 py-3 first:border-t-0 sm:[&:nth-child(2)]:border-t-0"
                      >
                        <div className="min-w-0 flex-1">
                          <dt className="text-xs font-medium text-zinc-500">
                            {field.label}
                          </dt>
                          <dd className="mt-0.5 text-sm text-zinc-900">
                            {field.value}
                          </dd>
                        </div>
                        <Badge
                          color={
                            field.confidence === "high"
                              ? "green"
                              : field.confidence === "medium"
                                ? "amber"
                                : "red"
                          }
                        >
                          {field.confidence === "high"
                            ? "Fiable"
                            : field.confidence === "medium"
                              ? "Moyen"
                              : "Faible"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ────────── STEP 3: Additional info ────────── */}
        {step === 2 && (
          <div>
            {/* Extra documents */}
            <div className="mt-6">
              <Subheading>Documents supplémentaires</Subheading>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
                onDrop={(e) => onDrop(e, setExtraDocs)}
                className={clsx(
                  "mt-3 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors",
                  dragging ? "border-indigo-400 bg-indigo-50" : "border-zinc-200"
                )}
              >
                <Button outline onClick={() => fileRef.current?.click()}>
                  Ajouter des documents
                </Button>
              </div>

              {extraDocs.length > 0 && (
                <ul className="mt-3 divide-y divide-zinc-100 rounded-lg border border-zinc-200">
                  {extraDocs.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                      {d.status === "classifying" && (
                        <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
                      )}
                      {d.status === "extracting" && (
                        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                      )}
                      {d.status === "done" && (
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm text-zinc-700">
                        {d.fileName}
                      </span>
                      {d.status === "done" && (
                        <Badge color={DOC_CATEGORY_COLORS[d.category] as any}>
                          {DOC_CATEGORY_LABELS[d.category]}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Notes */}
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <Subheading>Notes complémentaires</Subheading>
                <button
                  type="button"
                  onClick={toggleVoice}
                  className={clsx(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    listening
                      ? "bg-red-50 text-red-600 hover:bg-red-100"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  )}
                >
                  {/* Microphone icon */}
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                  </svg>
                  {listening ? "Arrêter" : "Dicter"}
                </button>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observations cliniques, précisions..."
                rows={5}
                className={clsx(
                  "mt-3 block w-full rounded-lg border bg-transparent px-3 py-2 text-sm text-zinc-950 placeholder:text-zinc-500 focus:outline-none sm:text-sm/6",
                  listening
                    ? "border-red-300 ring-2 ring-red-100"
                    : "border-zinc-950/10 focus:border-zinc-950/20"
                )}
              />
            </div>
          </div>
        )}

        {/* ────────── STEP 4: Rapport ────────── */}
        {step === 3 && (
          <div>
            <div className="flex items-center justify-between">
              <div>
                <Subheading>
                  Rapport AI — {CANTONS.find((c) => c.value === canton)?.label}
                </Subheading>
                <Text>Modèle officiel du canton</Text>
              </div>
              <div className="flex gap-2">
                {!generated && (
                  <Button color="indigo" onClick={generate} disabled={generating}>
                    {generating ? "Génération..." : "Générer"}
                  </Button>
                )}
                {generated && (
                  <>
                    <Button outline onClick={downloadPdf}>
                      Télécharger PDF
                    </Button>
                    <Button color="indigo" onClick={downloadDocx}>
                      Télécharger .docx
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Generation steps */}
            {generating && (
              <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 px-5 py-4">
                <ul className="flex flex-col gap-3">
                  {GEN_STEPS.map((s, i) => {
                    const done = genStep > i;
                    const active = genStep === i;
                    return (
                      <li key={i} className="flex items-center gap-3">
                        {/* Icon: spinner → checkmark */}
                        {done ? (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600">
                            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          </span>
                        ) : active ? (
                          <span className="flex h-5 w-5 items-center justify-center">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                          </span>
                        ) : (
                          <span className="flex h-5 w-5 items-center justify-center">
                            <span className="h-2 w-2 rounded-full bg-zinc-300" />
                          </span>
                        )}
                        {/* Label */}
                        <span
                          className={clsx(
                            "text-sm transition-colors",
                            done && "text-zinc-900",
                            active && "font-medium text-indigo-700",
                            !done && !active && "text-zinc-400"
                          )}
                        >
                          {s.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Docx preview — full width */}
            <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200 bg-white">
              {docxLoading && (
                <div className="flex items-center justify-center py-32">
                  <Text>Chargement du modèle...</Text>
                </div>
              )}
              <div ref={previewRef} className="docx-preview" />
            </div>

            {/* ── Slide-over: editable report sections ── */}
            {generated && (
              <>
                {/* Backdrop */}
                {showEditor && (
                  <div
                    className="fixed inset-0 z-40 bg-black/20 transition-opacity"
                    onClick={() => setShowEditor(false)}
                  />
                )}

                {/* Toggle button — fixed on the right edge */}
                {!showEditor && (
                  <button
                    type="button"
                    onClick={() => setShowEditor(true)}
                    className="fixed right-0 top-1/2 z-50 -translate-y-1/2 rounded-l-lg bg-indigo-600 px-2 py-4 text-white shadow-lg hover:bg-indigo-700 transition-colors"
                  >
                    {/* Pencil icon */}
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                    </svg>
                  </button>
                )}

                {/* Panel */}
                <div
                  className={clsx(
                    "fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl transition-transform duration-300",
                    showEditor ? "translate-x-0" : "translate-x-full"
                  )}
                >
                  {/* Panel header */}
                  <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
                    <span className="text-sm font-semibold text-zinc-900">
                      Modifier le rapport
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowEditor(false)}
                      className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Scrollable sections list */}
                  <div className="flex-1 overflow-y-auto px-5 py-4">
                    <div className="flex flex-col gap-3">
                      {(canton === "geneve" ? MOCK_GENEVE_FIELDS : MOCK_FRIBOURG_FIELDS).map((section) => {
                        const isCollapsed = collapsedSections.has(section.id);
                        return (
                          <div
                            key={section.id}
                            className="rounded-lg border border-zinc-200"
                          >
                            {/* Section header — click to expand/collapse */}
                            <button
                              type="button"
                              onClick={() =>
                                setCollapsedSections((prev) => {
                                  const next = new Set(prev);
                                  next.has(section.id) ? next.delete(section.id) : next.add(section.id);
                                  return next;
                                })
                              }
                              className="flex w-full items-center justify-between px-4 py-3 text-left"
                            >
                              <span className="text-sm font-semibold text-zinc-900">
                                {section.title}
                              </span>
                              <svg
                                className={clsx(
                                  "h-4 w-4 text-zinc-400 transition-transform",
                                  !isCollapsed && "rotate-180"
                                )}
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={2}
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                              </svg>
                            </button>

                            {/* Collapsible body — individual labeled fields */}
                            {!isCollapsed && (
                              <div className="border-t border-zinc-100 px-4 py-3">
                                <div className="flex flex-col gap-4">
                                  {section.fields.map((field) => (
                                    <div key={field.id}>
                                      <label className="mb-1 block text-xs font-medium text-zinc-500">
                                        {field.label}
                                      </label>
                                      {field.type === "multiline" ? (
                                        <textarea
                                          value={editedSections[field.id] ?? field.value}
                                          onChange={(e) =>
                                            setEditedSections((prev) => ({
                                              ...prev,
                                              [field.id]: e.target.value,
                                            }))
                                          }
                                          rows={4}
                                          className="block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                        />
                                      ) : (
                                        <input
                                          type={field.type === "date" ? "text" : "text"}
                                          value={editedSections[field.id] ?? field.value}
                                          onChange={(e) =>
                                            setEditedSections((prev) => ({
                                              ...prev,
                                              [field.id]: e.target.value,
                                            }))
                                          }
                                          className="block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                        />
                                      )}
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-3 flex justify-end">
                                  <Button
                                    outline
                                    onClick={() => {
                                      // Simulate re-rendering the docx with updated content
                                      setDocxLoading(true);
                                      setTimeout(() => setDocxLoading(false), 800);
                                    }}
                                  >
                                    Mettre à jour
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <div className="mt-10 flex items-center justify-between">
        <div>
          {step > 0 && (
            <Button plain onClick={() => setStep((s) => s - 1)}>
              ← Retour
            </Button>
          )}
        </div>
        <div>
          {step < STEPS.length - 1 && (
            <Button
              color="indigo"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext}
            >
              Continuer →
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
