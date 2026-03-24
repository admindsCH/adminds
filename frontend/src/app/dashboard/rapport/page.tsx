"use client";

import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { Heading } from "@/components/heading";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import type { WizardDocument } from "./_types";
import type { TemplateResponse } from "@/lib/api";
import type { PatientDossier } from "@/lib/schemas/classification";
import { WizardStepper, TOTAL_STEPS } from "./_components/wizard-stepper";
import { StepSelectReports } from "./_components/step-select-reports";
import { StepDocuments } from "./_components/step-documents";
import { StepSummary } from "./_components/step-summary";
import { StepGenerate } from "./_components/step-generate";

// ── Step descriptions shown below the heading ────────────

const STEP_TITLES = [
  "Sélection des rapports",
  "Documents & Notes",
  "Résumé du dossier",
  "Générer les rapports",
];

const STEP_DESCRIPTIONS = [
  "Commencez par sélectionner le(s) rapport(s) à remplir ou importez vos propres modèles.",
  "Importez les documents du dossier patient et ajoutez vos notes.",
  "Vérifiez et complétez les informations extraites de vos documents.",
  "Génération et consultation de vos rapports.",
];

// ── Page ─────────────────────────────────────────────────

export default function RapportPage() {
  const { user } = useUser();

  // Cross-step state
  const [step, setStep] = useState(0);
  const [canton, setCanton] = useState<string>(
    (user?.unsafeMetadata?.canton as string) || "fribourg"
  );

  // Step 0: selected report templates
  const [selectedTemplates, setSelectedTemplates] = useState<TemplateResponse[]>([]);

  // Step 1: uploaded documents + notes
  const [docs, setDocs] = useState<WizardDocument[]>([]);
  const [notes, setNotes] = useState("");
  // Date filter (set on Step 2, used on Step 3 for parsing)
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Step 2: parsed dossier
  const [dossierId, setDossierId] = useState<string | null>(null);
  const [dossier, setDossier] = useState<PatientDossier | null>(null);
  // Track which doc IDs were used to build the current dossier
  const parsedDocIdsRef = useRef<string | null>(null);

  // Reset dossier when documents change (added/removed) so Step 2 re-parses
  useEffect(() => {
    const doneDocIds = docs
      .filter((d) => d.status === "done")
      .map((d) => d.id)
      .sort()
      .join(",");
    // Skip on first render or when no dossier exists yet
    if (!dossier || !parsedDocIdsRef.current) return;
    if (doneDocIds !== parsedDocIdsRef.current) {
      setDossier(null);
      setDossierId(null);
      parsedDocIdsRef.current = null;
    }
  }, [docs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync canton from Clerk metadata when it loads
  useEffect(() => {
    if (user?.unsafeMetadata?.canton) {
      setCanton(user.unsafeMetadata.canton as string);
    }
  }, [user?.unsafeMetadata?.canton]);

  // Navigation guard: each step has its own "can proceed" condition
  const canNext = (() => {
    switch (step) {
      case 0: return selectedTemplates.length > 0;       // must select at least one report
      case 1: return docs.some((d) => d.status === "done"); // must have at least one classified doc
      case 2: return true;                                 // résumé is always ready
      default: return false;
    }
  })();

  return (
    <>
      {/* Top bar: logo + stepper */}
      <WizardStepper
        step={step}
        onStepChange={setStep}
      />

      {/* Page title */}
      <div className="mt-10">
        <Heading>{STEP_TITLES[step]}</Heading>
        <Text className="mt-1">{STEP_DESCRIPTIONS[step]}</Text>
      </div>

      {/* Step content */}
      <div className="mt-8">
        {step === 0 && (
          <StepSelectReports
            canton={canton}
            onCantonChange={setCanton}
            selectedTemplates={selectedTemplates}
            onSelectedTemplatesChange={setSelectedTemplates}
          />
        )}
        {step === 1 && (
          <StepDocuments
            docs={docs}
            onDocsChange={setDocs}
            notes={notes}
            onNotesChange={setNotes}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
          />
        )}
        {step === 2 && (
          <StepSummary
            docs={docs}
            notes={notes}
            dateFrom={dateFrom}
            dateTo={dateTo}
            dossierId={dossierId}
            dossier={dossier}
            onDossierChange={(id, d) => {
              setDossierId(id);
              setDossier(d);
              // Snapshot which docs were used for this dossier
              parsedDocIdsRef.current = docs
                .filter((doc) => doc.status === "done")
                .map((doc) => doc.id)
                .sort()
                .join(",");
            }}
          />
        )}
        {step === 3 && (
          <StepGenerate
            selectedTemplates={selectedTemplates}
            canton={canton}
            dossierId={dossierId}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="mt-10 flex items-center justify-between">
        <div>
          {step > 0 && (
            <Button plain onClick={() => setStep((s) => s - 1)}>
              ← Retour
            </Button>
          )}
        </div>
        <div>
          {step < TOTAL_STEPS - 1 && (
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
