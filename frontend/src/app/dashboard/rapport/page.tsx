"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Heading } from "@/components/heading";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import type { Canton, WizardDocument } from "@/lib/mock-data";
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
  const [canton, setCanton] = useState<Canton>(
    (user?.unsafeMetadata?.canton as Canton) || "fribourg"
  );

  // Step 0: selected report templates
  const [selectedTemplates, setSelectedTemplates] = useState<TemplateResponse[]>([]);

  // Step 1: uploaded documents + notes
  const [docs, setDocs] = useState<WizardDocument[]>([]);
  const [notes, setNotes] = useState("");

  // Step 2: parsed dossier
  const [dossierId, setDossierId] = useState<string | null>(null);
  const [dossier, setDossier] = useState<PatientDossier | null>(null);

  // Sync canton from Clerk metadata when it loads
  useEffect(() => {
    if (user?.unsafeMetadata?.canton) {
      setCanton(user.unsafeMetadata.canton as Canton);
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
          />
        )}
        {step === 2 && (
          <StepSummary
            docs={docs}
            notes={notes}
            dossierId={dossierId}
            dossier={dossier}
            onDossierChange={(id, d) => {
              setDossierId(id);
              setDossier(d);
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
