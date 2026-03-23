import { Logo } from "@/components/logo";
import clsx from "clsx";

// ── Constants ────────────────────────────────────────────

const STEPS = ["Rapports", "Documents & Notes", "Résumé", "Générer"] as const;

// ── Component ────────────────────────────────────────────

interface WizardStepperProps {
  step: number;
  onStepChange: (step: number) => void;
}

/**
 * Top bar with logo and step navigation pills.
 */
export function WizardStepper({
  step,
  onStepChange,
}: WizardStepperProps) {
  return (
    <div className="flex items-center justify-between">
      {/* Left: logo */}
      <div className="flex items-center gap-4">
        <Logo size="sm" href="/dashboard" />
      </div>

      {/* Right: step pills */}
      <div className="flex items-center gap-1">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center">
            <button
              type="button"
              onClick={() => onStepChange(i)}
              className={clsx(
                "flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                i === step && "bg-zinc-900 text-white",
                i < step && "bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
                i > step && "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              )}
            >
              {/* Step number / checkmark */}
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
              {/* Label — hidden on mobile */}
              <span className="hidden md:inline">{label}</span>
            </button>
            {/* Connector line between steps */}
            {i < STEPS.length - 1 && (
              <div
                className={clsx(
                  "mx-1 h-px w-4",
                  i < step ? "bg-indigo-300" : "bg-zinc-200"
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Total number of steps — exported so the page can use it for navigation bounds. */
export const TOTAL_STEPS = STEPS.length;
