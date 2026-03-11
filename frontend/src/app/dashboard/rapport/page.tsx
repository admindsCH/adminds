"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Heading } from "@/components/heading";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import type { Canton, WizardDocument } from "@/lib/mock-data";
import type { PatientDossier } from "@/lib/schemas/classification";
import { WizardStepper, TOTAL_STEPS } from "./_components/wizard-stepper";
import { StepDocuments } from "./_components/step-documents";
import { StepSummary } from "./_components/step-summary";
import { StepReport } from "./_components/step-report";

// ── Step descriptions shown below the heading ────────────

const STEP_DESCRIPTIONS = [
  "Commencez par importer les documents du dossier patient.",
  "Vérifiez et complétez les informations extraites de vos documents.",
  "Votre rapport est prêt à être généré.",
];

// ── Page ─────────────────────────────────────────────────

export default function RapportPage() {
  const { user } = useUser();

  // Cross-step state — kept here because it's used by navigation or multiple steps
  const [step, setStep] = useState(0);
  const [canton, setCanton] = useState<Canton>(
    (user?.unsafeMetadata?.canton as Canton) || "fribourg"
  );
  // docs state is lifted here so the page can compute `canNext` for step 1
  const [docs, setDocs] = useState<WizardDocument[]>([]);
  // Dossier state — set after parse-dossier, persisted server-side, passed to all steps
  const [dossierId, setDossierId] = useState<string | null>(null);
  const [dossier, setDossier] = useState<PatientDossier | null>(null);
  // Notes — psychiatrist's own observations, entered in Step 1 before AI analysis
  const [notes, setNotes] = useState("");

  // Sync canton from Clerk metadata when it loads
  useEffect(() => {
    if (user?.unsafeMetadata?.canton) {
      setCanton(user.unsafeMetadata.canton as Canton);
    }
  }, [user?.unsafeMetadata?.canton]);

  // Step 1 requires at least one classified document to proceed
  const canNext = step === 0 ? docs.some((d) => d.status === "done") : true;


  return (
    <>
      {/* Top bar: logo + canton + stepper */}
      <WizardStepper
        step={step}
        onStepChange={setStep}
        canton={canton}
        onCantonChange={setCanton}
      />

      {/* Page title */}
      <div className="mt-10">
        <Heading>Nouveau rapport AI</Heading>
        <Text className="mt-1">{STEP_DESCRIPTIONS[step]}</Text>
      </div>

      {/* Step content */}
      <div className="mt-8">
        {step === 0 && (
          <StepDocuments
            docs={docs}
            onDocsChange={setDocs}
            notes={notes}
            onNotesChange={setNotes}
          />
        )}
        {step === 1 && (
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
        {step === 2 && <StepReport canton={canton} dossierId={dossierId} />}
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
