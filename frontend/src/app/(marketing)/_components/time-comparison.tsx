"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";

const WITHOUT_STEPS = [
  {
    label: "Parcourir le dossier patient complet",
    detail: "Relire des dizaines de pages de notes, bilans, courriers",
    time: "30 min",
  },
  {
    label: "Comprendre les questions du formulaire cantonal",
    detail: "Interpréter chaque question, vérifier les exigences",
    time: "15 min",
  },
  {
    label: "Rédiger chaque réponse manuellement",
    detail: "Formuler un texte conforme pour chaque section",
    time: "45–60 min",
  },
  {
    label: "Vérifier la conformité juridique",
    detail: "Critères de Foerster, indicateurs structurés, jurisprudence",
    time: "15–20 min",
  },
  {
    label: "Reformater et finaliser",
    detail: "Mise en page, codes CIM, formatage du document",
    time: "15 min",
  },
];

const WITH_STEPS = [
  {
    label: "Importer le dossier patient",
    detail: "Glisser-déposer les documents du patient",
    time: "1 min",
  },
  {
    label: "Génération automatique du rapport",
    detail: "L'IA remplit chaque section du formulaire cantonal",
    time: "2–3 min",
  },
  {
    label: "Relire et valider",
    detail: "Vérifier le rapport, ajuster si nécessaire",
    time: "5–7 min",
  },
];

export default function TimeComparison() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <div ref={ref}>
      {/* Emotional framing */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
        className="text-center mb-12 max-w-2xl mx-auto"
      >
        <p className="text-lg sm:text-xl text-zinc-600 leading-relaxed" style={{ fontFamily: "var(--font-serif)" }}>
          &laquo;&nbsp;Le rapport ou le patient — il faut choisir,
          et ce n&apos;est jamais le rapport qui gagne.&nbsp;&raquo;
        </p>
        <p className="mt-3 text-sm text-zinc-400">
          Chaque heure passée sur l&apos;administratif est une heure en moins
          pour vos patients. Adminds vous rend ce temps.
        </p>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
        {/* WITHOUT Adminds */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 sm:p-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-900">Actuellement</div>
              <div className="text-xs text-red-500 font-medium">2–3 heures par rapport</div>
            </div>
          </div>
          <p className="text-xs text-zinc-400 mb-6">
            Du temps pris sur vos consultations, vos pauses, votre vie.
          </p>

          <div className="space-y-3">
            {WITHOUT_STEPS.map((step, i) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, x: -10 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.3 + i * 0.1, duration: 0.3 }}
                className="flex gap-3"
              >
                <div className="w-5 h-5 rounded-full bg-red-50 border border-red-100 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[9px] font-bold text-red-400">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-zinc-700">{step.label}</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">{step.detail}</div>
                </div>
                <span className="text-[11px] font-mono text-red-400/70 shrink-0 mt-0.5">{step.time}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* WITH Adminds */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-6 sm:p-8 relative"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-900">Avec Adminds</div>
              <div className="text-xs text-indigo-600 font-medium">~10 minutes par rapport</div>
            </div>
          </div>
          <p className="text-xs text-zinc-400 mb-6">
            Du temps retrouvé pour ce qui compte : vos patients.
          </p>

          <div className="space-y-3">
            {WITH_STEPS.map((step, i) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, x: -10 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.5 + i * 0.15, duration: 0.3 }}
                className="flex gap-3"
              >
                <div className="w-5 h-5 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[9px] font-bold text-indigo-600">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-zinc-700">{step.label}</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">{step.detail}</div>
                </div>
                <span className="text-[11px] font-mono text-indigo-500 shrink-0 mt-0.5">{step.time}</span>
              </motion.div>
            ))}
          </div>

          {/* Time given back — emphasized */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 1.2 }}
            className="mt-6 pt-5 border-t border-indigo-100 flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </div>
            <div>
              <div className="text-xl font-bold text-indigo-600" style={{ fontFamily: "var(--font-serif)" }}>
                ~2h30 retrouvées par rapport
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                Pour vos patients, pas pour l&apos;administratif
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
