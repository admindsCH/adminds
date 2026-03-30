"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { Shield, ServerCog, Lock, Trash2 } from "lucide-react";

const PILLARS = [
  {
    icon: Trash2,
    title: "Zéro stockage patient",
    detail: "Aucun document patient n'est conservé. Traitement en mémoire, puis purge immédiate. Rien ne reste sur nos serveurs.",
    highlight: true,
  },
  {
    icon: ServerCog,
    title: "Swiss Hosting",
    detail: "Infrastructure hébergée en Suisse. Vos données ne quittent jamais le territoire. Aucun transfert vers des juridictions étrangères.",
  },
  {
    icon: Lock,
    title: "Chiffrement bout en bout",
    detail: "Données chiffrées au repos et en transit. Aucun accès tiers, aucune sous-traitance, aucun intermédiaire.",
  },
  {
    icon: Shield,
    title: "Conforme LPD & Art. 321 CP",
    detail: "Secret médical garanti par architecture, pas par une simple politique. Conforme à la loi fédérale sur la protection des données.",
  },
];

const BADGES = [
  { label: "Swiss Made", emoji: "🇨🇭" },
  { label: "Swiss Hosting", emoji: "🏔️" },
  { label: "Zéro stockage", emoji: "🗑️" },
  { label: "Conforme LPD", emoji: "⚖️" },
];

export default function SecuritySection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <div ref={ref}>
      {/* Intro */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
        className="text-center mb-14 max-w-2xl mx-auto"
      >
        <p
          className="text-xl sm:text-2xl text-zinc-700 leading-relaxed font-medium"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          On ne garde rien. Par choix, pas par obligation.
        </p>
        <p className="mt-3 text-sm text-zinc-400">
          Pas de promesses vagues. Voici exactement comment nous traitons vos données.
        </p>
      </motion.div>

      {/* Trust badges - emphasized */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="flex flex-wrap items-center justify-center gap-3 mb-12"
      >
        {BADGES.map((badge) => (
          <div
            key={badge.label}
            className="flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/50 px-5 py-2.5"
          >
            <span className="text-base">{badge.emoji}</span>
            <span className="text-sm font-semibold text-indigo-700">{badge.label}</span>
          </div>
        ))}
      </motion.div>

      {/* 4 pillars grid */}
      <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto mb-10">
        {PILLARS.map((pillar, i) => (
          <motion.div
            key={pillar.title}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
            className={`rounded-xl border p-5 sm:p-6 ${
              pillar.highlight
                ? "border-indigo-200 bg-indigo-50/30 ring-1 ring-indigo-100"
                : "border-zinc-100 bg-white"
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
              pillar.highlight
                ? "bg-indigo-100 border border-indigo-200"
                : "bg-indigo-50 border border-indigo-100"
            }`}>
              <pillar.icon className={`w-5 h-5 ${
                pillar.highlight ? "text-indigo-700" : "text-indigo-600"
              }`} />
            </div>
            <h3 className="text-sm font-semibold text-zinc-900 mb-1">
              {pillar.title}
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {pillar.detail}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Zero knowledge callout */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.8 }}
        className="max-w-3xl mx-auto rounded-2xl border border-indigo-200 bg-indigo-50/30 p-6 sm:p-8 text-center"
      >
        <div className="text-2xl sm:text-3xl font-bold text-indigo-700 mb-2" style={{ fontFamily: "var(--font-serif)" }}>
          Zéro document. Zéro trace.
        </div>
        <p className="text-sm text-zinc-500 max-w-lg mx-auto">
          Adminds est un outil à connaissance zéro. Nous ne stockons aucune donnée patient,
          aucun document, aucun rapport généré. Vos données passent, le résultat sort,
          et tout disparaît.
        </p>
      </motion.div>
    </div>
  );
}
