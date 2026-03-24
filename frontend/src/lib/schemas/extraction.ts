/** Extracted information organized by section — output of the AI extraction pipeline. */
export interface ExtractedSection {
  id: string;
  title: string;
  icon: string; // emoji for visual distinction
  fields: ExtractedField[];
}

export interface ExtractedField {
  label: string;
  value: string;
  source: string; // which document it came from
  confidence: "high" | "medium" | "low";
}
