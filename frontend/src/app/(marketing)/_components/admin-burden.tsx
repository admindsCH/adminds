"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";

const ADMIN_TASKS = [
  {
    label: "Rapports d'assurance invalidité",
    detail: "Formulaires cantonaux, critères de Foerster, jurisprudence",
    time: "2–3h par rapport",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    ),
  },
  {
    label: "Ordonnances et renouvellements",
    detail: "Prescriptions, suivi des posologies, renouvellements réguliers",
    time: "~30 min/jour",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
      />
    ),
  },
  {
    label: "Correspondance administrative",
    detail: "Caisses maladie, avocats, offices AI, assureurs",
    time: "~1h/jour",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
      />
    ),
  },
  {
    label: "Lettres de sortie et comptes rendus",
    detail: "Résumés cliniques, transferts, rapports d'hospitalisation",
    time: "~45 min chacune",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
      />
    ),
  },
  {
    label: "Documentation clinique administrative",
    detail: "Notes de suivi, codage CIM-10, facturation TARMED",
    time: "~1h/jour",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
  },
];

export default function AdminBurden() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <div ref={ref}>
      {/* Emotional quote */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
        className="text-center mb-12 max-w-2xl mx-auto"
      >
        <p
          className="text-xl sm:text-2xl text-zinc-600 leading-relaxed"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          &laquo;&nbsp;Le patient sort, le suivant attend, et entre les deux
          je rédige un rapport en espérant ne rien oublier.&nbsp;&raquo;
        </p>
        <p className="mt-3 text-sm text-zinc-400">
          Chaque heure passée sur l&apos;administratif est une heure en moins
          pour vos patients — et une raison de plus de rester tard au cabinet.
        </p>
      </motion.div>

      {/* Task list */}
      <div className="max-w-2xl mx-auto space-y-3">
        {ADMIN_TASKS.map((task, i) => (
          <motion.div
            key={task.label}
            initial={{ opacity: 0, y: 15 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2 + i * 0.1, duration: 0.4 }}
            className="flex items-center gap-4 rounded-xl border border-zinc-100 bg-white p-4 sm:p-5"
          >
            <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
              <svg
                className="w-5 h-5 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                {task.icon}
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-zinc-800">
                {task.label}
              </div>
              <div className="text-xs text-zinc-400 mt-0.5">{task.detail}</div>
            </div>
            <span className="text-xs font-mono text-red-400/80 shrink-0">
              {task.time}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Bottom callout */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.9 }}
        className="mt-8 max-w-2xl mx-auto rounded-xl bg-indigo-50/50 border border-indigo-100 p-5 flex items-center gap-4"
      >
        <div className="w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0">
          <svg
            className="w-5 h-5 text-indigo-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
            />
          </svg>
        </div>
        <div>
          <div
            className="text-2xl sm:text-3xl font-bold text-indigo-700"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Des heures chaque semaine
          </div>
          <div className="text-sm text-zinc-500 mt-1">
            perdues dans l&apos;administratif au lieu d&apos;être avec vos patients
          </div>
        </div>
      </motion.div>
    </div>
  );
}
