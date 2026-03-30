"use client";

import { motion, type Variants } from "motion/react";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { Logo } from "@/components/logo";

type Point = { x: number; y: number };

interface WaveConfig {
  offset: number;
  amplitude: number;
  frequency: number;
  color: string;
  opacity: number;
}

const highlightPills = [
  "100% Suisse",
  "Données chiffrées",
  "Conforme LPD",
] as const;

const heroStats: { label: string; value: string }[] = [
  { label: "Temps moyen par rapport", value: "~10 min" },
  { label: "Conformité juridique", value: "100%" },
  { label: "Données stockées", value: "Zéro" },
];

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, staggerChildren: 0.12 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

const statsVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.6, ease: "easeOut", staggerChildren: 0.08 },
  },
};

export default function Hero() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<Point>({ x: 0, y: 0 });
  const targetMouseRef = useRef<Point>({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    let animationId: number;
    let time = 0;

    const wavePalette: WaveConfig[] = [
      { offset: 0, amplitude: 70, frequency: 0.003, color: "rgba(99, 102, 241, 0.8)", opacity: 0.45 },
      { offset: Math.PI / 2, amplitude: 90, frequency: 0.0026, color: "rgba(129, 140, 248, 0.7)", opacity: 0.35 },
      { offset: Math.PI, amplitude: 60, frequency: 0.0034, color: "rgba(165, 180, 252, 0.65)", opacity: 0.3 },
      { offset: Math.PI * 1.5, amplitude: 80, frequency: 0.0022, color: "rgba(199, 210, 254, 0.4)", opacity: 0.25 },
      { offset: Math.PI * 2, amplitude: 55, frequency: 0.004, color: "rgba(224, 231, 255, 0.3)", opacity: 0.2 },
    ];

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mouseInfluence = prefersReducedMotion ? 10 : 70;
    const influenceRadius = prefersReducedMotion ? 160 : 320;
    const smoothing = prefersReducedMotion ? 0.04 : 0.1;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const recenterMouse = () => {
      const centerPoint = { x: canvas.width / 2, y: canvas.height / 2 };
      mouseRef.current = centerPoint;
      targetMouseRef.current = centerPoint;
    };

    const handleResize = () => { resizeCanvas(); recenterMouse(); };
    const handleMouseMove = (e: MouseEvent) => { targetMouseRef.current = { x: e.clientX, y: e.clientY }; };
    const handleMouseLeave = () => { recenterMouse(); };

    resizeCanvas();
    recenterMouse();

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    const drawWave = (wave: WaveConfig) => {
      ctx.save();
      ctx.beginPath();

      for (let x = 0; x <= canvas.width; x += 4) {
        const dx = x - mouseRef.current.x;
        const dy = canvas.height / 2 - mouseRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const influence = Math.max(0, 1 - distance / influenceRadius);
        const mouseEffect = influence * mouseInfluence * Math.sin(time * 0.001 + x * 0.01 + wave.offset);

        const y =
          canvas.height / 2 +
          Math.sin(x * wave.frequency + time * 0.002 + wave.offset) * wave.amplitude +
          Math.sin(x * wave.frequency * 0.4 + time * 0.003) * (wave.amplitude * 0.45) +
          mouseEffect;

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = wave.color;
      ctx.globalAlpha = wave.opacity;
      ctx.shadowBlur = 35;
      ctx.shadowColor = wave.color;
      ctx.stroke();
      ctx.restore();
    };

    const animate = () => {
      time += 1;
      mouseRef.current.x += (targetMouseRef.current.x - mouseRef.current.x) * smoothing;
      mouseRef.current.y += (targetMouseRef.current.y - mouseRef.current.y) * smoothing;

      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, "#ffffff");
      gradient.addColorStop(1, "#f8fafc");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      wavePalette.forEach(drawWave);
      animationId = window.requestAnimationFrame(animate);
    };

    animationId = window.requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <section className="relative isolate flex min-h-screen w-full items-center justify-center overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      />

      {/* Subtle glow blobs */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-indigo-100/30 blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full bg-indigo-50/20 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-6 py-24 text-center md:px-8 lg:px-12">
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full">
          {/* Badge */}
          <motion.div
            variants={itemVariants}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-indigo-600 backdrop-blur-sm"
          >
            <span className="text-sm" aria-hidden="true">🇨🇭</span>
            Conçu et hébergé en Suisse
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={itemVariants}
            className="mb-6 text-4xl font-normal tracking-tight text-zinc-900 md:text-6xl lg:text-7xl"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Vos rapports médicaux,{" "}
            <span className="gradient-text">prêts avant votre café.</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={itemVariants}
            className="mx-auto mb-10 max-w-3xl text-lg text-zinc-500 md:text-xl leading-relaxed"
          >
            Importez votre dossier patient, choisissez votre formulaire —
            rapport AI, attestation, assurance — et recevez un document
            conforme aux exigences cantonales. Prêt à relire. Zéro donnée stockée.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={itemVariants}
            className="mb-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <a
              href="#demo"
              className="group inline-flex items-center gap-2 rounded-full bg-indigo-600 px-8 py-3 text-sm font-semibold uppercase tracking-[0.15em] text-white shadow-lg shadow-indigo-200 transition-colors hover:bg-indigo-500"
            >
              Demander un accès
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </a>
            <a
              href="#probleme"
              className="rounded-full border border-zinc-200 bg-white/60 px-8 py-3 text-sm font-semibold text-zinc-700 backdrop-blur-sm transition-all hover:border-zinc-300 hover:bg-white/80"
            >
              Voir comment ça marche
            </a>
          </motion.div>

          {/* Trust pills */}
          <motion.ul
            variants={itemVariants}
            className="mb-12 flex flex-wrap items-center justify-center gap-3 text-xs uppercase tracking-[0.2em] text-zinc-500"
          >
            {highlightPills.map((pill) => (
              <li
                key={pill}
                className="rounded-full border border-zinc-200 bg-white/60 px-4 py-2 backdrop-blur-sm"
              >
                {pill}
              </li>
            ))}
          </motion.ul>

          {/* Stats — floating feature items */}
          <motion.div
            variants={statsVariants}
            className="flex flex-wrap items-center justify-center gap-6 sm:gap-10"
          >
            {heroStats.map((stat) => (
              <motion.div
                key={stat.label}
                variants={itemVariants}
                className="group flex items-center gap-3 transition-all duration-300 hover:scale-105"
              >
                {/* Glowing dot */}
                <div className="relative">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 group-hover:animate-pulse" />
                  <div className="absolute -inset-1 bg-indigo-400/30 rounded-full blur-sm opacity-70 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-semibold text-zinc-900">
                    {stat.value}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                    {stat.label}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
