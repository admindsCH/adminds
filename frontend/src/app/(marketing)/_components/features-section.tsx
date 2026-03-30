"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import {
  FileText,
  Mic,
  LayoutDashboard,
  Upload,
  Search,
  PenTool,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const FEATURES = [
  {
    icon: Upload,
    title: "Importez tout, on trie",
    detail:
      "PDF, Word, images, scans, notes manuscrites... Glissez vos documents, Adminds les classe automatiquement par catégorie. Oui, même votre écriture.",
    span: "sm:col-span-3",
    color: "bg-indigo-600",
    mockup: (
      <div className="mt-4 flex flex-wrap gap-1.5">
        {["consultation.pdf", "bilan_psy.docx", "ordonnance.jpg", "notes.png"].map((f) => (
          <motion.div
            key={f}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 * Math.random() }}
            className="rounded-md bg-indigo-50 border border-indigo-100 px-2 py-1 text-[10px] text-indigo-600 font-mono"
          >
            {f}
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    icon: LayoutDashboard,
    title: "Dossier organisé automatiquement",
    detail:
      "Adminds structure votre dossier patient en vues intelligentes : historique, clinique, traitement, situation professionnelle, capacité de travail... Tout est extrait et organisé pour vous.",
    span: "sm:col-span-2",
    color: "bg-indigo-500",
    mockup: (
      <div className="mt-4 space-y-1">
        {["Historique", "Clinique", "Traitement", "Capacité"].map((r, i) => (
          <motion.div
            key={r}
            initial={{ width: 0 }}
            whileInView={{ width: `${70 + i * 8}%` }}
            transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
            className="h-2 rounded-full bg-gradient-to-r from-indigo-200 to-indigo-100"
          />
        ))}
      </div>
    ),
  },
  {
    icon: FileText,
    title: "Tout type de rapport",
    detail:
      "Rapport AI (assurance invalidité), attestation perte de gain, rapport d'assurance... Si c'est un formulaire que vous remplissez à 19h, Adminds le génère pour vous.",
    span: "sm:col-span-2",
    color: "bg-indigo-400",
    mockup: (
      <div className="mt-4 grid grid-cols-3 gap-1.5">
        {["Rapport AI", "Perte de gain", "Assurance"].map((t) => (
          <div key={t} className="rounded-md border border-indigo-100 bg-indigo-50/50 px-2 py-1.5 text-[10px] text-indigo-600 text-center font-medium">
            {t}
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Mic,
    title: "Dictez, on transcrit",
    detail:
      "Dictez vos notes entre deux patients. Transcription automatique en français, intégrée directement dans le dossier.",
    span: "sm:col-span-3",
    color: "bg-indigo-700",
    mockup: (
      <div className="mt-4 flex items-center gap-2">
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-3 h-3 rounded-full bg-indigo-400"
        />
        <div className="flex-1 flex gap-0.5">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              animate={{ height: [4, 8 + Math.random() * 12, 4] }}
              transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.05 }}
              className="w-1 rounded-full bg-indigo-200"
              style={{ height: 4 }}
            />
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: PenTool,
    title: "Vos templates, notre moteur",
    detail:
      "Importez vos propres modèles DOCX ou PDF. Adminds les remplit automatiquement pour vous. Formulaires cantonaux inclus.",
    span: "sm:col-span-3",
    color: "bg-indigo-500",
    mockup: (
      <div className="mt-4 space-y-1.5">
        {["Nom du patient", "Diagnostic principal", "Capacité de travail"].map((f, i) => (
          <motion.div
            key={f}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="flex items-center gap-2"
          >
            <div className="w-2 h-2 rounded-full bg-indigo-300" />
            <div className="text-[10px] text-zinc-400">{f}</div>
            <div className="flex-1 h-px bg-zinc-100" />
            <div className="text-[10px] text-indigo-600 font-medium">auto</div>
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    icon: Search,
    title: "Interrogez le dossier",
    detail:
      "\"Quels sont les diagnostics ?\" \"Capacité de travail ?\" — Fini de chercher l'info pendant 20 minutes. Posez la question, la réponse est là.",
    span: "sm:col-span-2",
    color: "bg-indigo-600",
    mockup: (
      <div className="mt-4 space-y-2">
        <div className="rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-1.5 text-[10px] text-zinc-400">
          Capacité de travail actuelle ?
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-1.5 text-[10px] text-indigo-600"
        >
          50% dans l&apos;activité habituelle, 80% dans une activité adaptée...
        </motion.div>
      </div>
    ),
  },
];

export default function FeaturesSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <div ref={ref} className="mx-auto max-w-5xl px-6">
      <div className="grid gap-3 sm:grid-cols-5">
        {FEATURES.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1 + i * 0.08, duration: 0.4 }}
            className={feature.span}
          >
            <Card className="group h-full overflow-hidden border-zinc-100 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg ${feature.color} flex items-center justify-center`}>
                    <feature.icon className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-900">
                    {feature.title}
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  {feature.detail}
                </p>
                {feature.mockup}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
