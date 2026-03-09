"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Heading } from "@/components/heading";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import type { Canton, WizardDocument } from "@/lib/mock-data";
import { WizardStepper, TOTAL_STEPS } from "./_components/wizard-stepper";
import { StepDocuments } from "./_components/step-documents";
import { StepSummary } from "./_components/step-summary";
import { StepSupplements } from "./_components/step-supplements";
import { StepReport } from "./_components/step-report";

// ── Step descriptions shown below the heading ────────────

const STEP_DESCRIPTIONS = [
  "Commencez par importer les documents du patient.",
  "Vérifiez les informations extraites de vos documents.",
  "Ajoutez des informations complémentaires.",
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
        {step === 0 && <StepDocuments docs={docs} onDocsChange={setDocs} />}
        {step === 1 && <StepSummary />}
        {step === 2 && <StepSupplements />}
        {step === 3 && <StepReport canton={canton} />}
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
