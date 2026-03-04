import Image from "next/image";
import ReportMockup from "./_components/report-mockup";
import AdminBurden from "./_components/admin-burden";
import CalendlyEmbed from "./_components/calendly-embed";
import { Logo } from "@/components/logo";

const NAV_LINKS = [
  { href: "#probleme", label: "Le problème" },
  { href: "#exemple", label: "Un exemple" },
  { href: "#equipe", label: "L'équipe" },
  { href: "#participer", label: "Participer" },
];

function ThreadConnector({
  step,
  className = "",
}: {
  step: number;
  className?: string;
}) {
  return (
    <div className={`relative flex flex-col items-center py-3 sm:py-4 ${className}`}>
      <div className="w-px h-16 sm:h-20 bg-gradient-to-b from-transparent to-indigo-200" />
      <div className="relative z-10 w-7 h-7 rounded-full bg-white border-2 border-indigo-200 flex items-center justify-center shadow-sm">
        <span className="text-[10px] font-bold text-indigo-500">{step}</span>
      </div>
      <div className="w-px h-16 sm:h-20 bg-gradient-to-b from-indigo-200 to-transparent" />
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-100 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Logo size="md" href="/" />
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <a
            href="#participer"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Réserver un appel
          </a>
        </div>
      </header>

      {/* 1. Hero — The call */}
      <section className="pt-20 sm:pt-28 pb-16 sm:pb-24 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-100 bg-indigo-50 mb-8">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-xs text-indigo-600 font-medium">
                Accès privé — Nous cherchons des psychiatres co-créateurs
              </span>
            </div>
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight leading-[1.1] text-zinc-900"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Psychiatres, aidez-nous à
              <br />
              <span className="gradient-text">réinventer votre quotidien.</span>
            </h1>
            <p className="mt-6 text-base sm:text-lg text-zinc-500 max-w-2xl mx-auto leading-relaxed">
              Rapports AI, ordonnances, correspondance… vous passez
              trop de temps sur l&apos;administratif. Partagez votre expérience
              et participez à la création d&apos;un outil pensé pour vous.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="#participer"
                className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-indigo-200 text-center"
              >
                Réserver un appel de 20 min
              </a>
              <a
                href="#probleme"
                className="w-full sm:w-auto px-6 py-3 border border-zinc-200 text-zinc-700 rounded-xl text-sm font-semibold hover:bg-zinc-50 transition-colors text-center"
              >
                En savoir plus
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Thread: hero → problem */}
      <ThreadConnector step={1} />

      {/* 2. Le problème — admin burden */}
      <section id="probleme" className="py-20 sm:py-28 px-6 bg-zinc-50/50">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-3">
              Le problème
            </div>
            <h2
              className="text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-zinc-900"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Votre énergie mérite mieux{" "}
              <span className="text-zinc-400">que l&apos;administratif.</span>
            </h2>
            <p className="mt-5 text-lg text-zinc-500 max-w-2xl mx-auto leading-relaxed">
              Chaque tâche
              administrative demande une énergie et une concentration
              que vous n&apos;avez plus. La charge mentale s&apos;accumule.
            </p>
          </div>
          <AdminBurden />
        </div>
      </section>

      {/* Thread: problem → example */}
      <ThreadConnector step={2} />

      {/* 3. Exemple — Report mockup */}
      <section id="exemple" className="pb-20 sm:pb-28 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-3">
              Un exemple concret
            </div>
            <h2
              className="text-3xl sm:text-4xl font-normal tracking-tight text-zinc-900"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Le rapport AI,{" "}
              <span className="text-zinc-400">en quelques minutes.</span>
            </h2>
            <p className="mt-4 text-zinc-500 max-w-2xl mx-auto leading-relaxed">
              Le rapport d&apos;assurance invalidité est l&apos;un des documents
              les plus lourds à rédiger. Importez votre dossier, laissez l&apos;IA
              structurer le rapport, relisez et soumettez.
            </p>
          </div>
          <ReportMockup />
        </div>
      </section>

      {/* Thread: example → team */}
      <ThreadConnector step={3} />

      {/* 4. L'équipe — Who are we */}
      <section id="equipe" className="py-20 sm:py-28 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-3">
              L&apos;équipe
            </div>
            <h2
              className="text-3xl sm:text-4xl font-normal tracking-tight text-zinc-900"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Qui sommes-nous<span className="text-zinc-400">&nbsp;?</span>
            </h2>
            <p className="mt-4 text-zinc-500 max-w-2xl mx-auto leading-relaxed">
              Une équipe à l&apos;intersection de la santé et de la technologie,
              déterminée à simplifier le quotidien des médecins.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-10 max-w-3xl mx-auto">
            {/* Chiara */}
            <div className="flex flex-col items-center text-center">
              <div className="w-36 h-36 rounded-full overflow-hidden mb-5 ring-2 ring-indigo-100 ring-offset-4">
                <Image
                  src="/chiara.png"
                  alt="Chiara"
                  width={144}
                  height={144}
                  className="w-full h-full object-cover grayscale"
                />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900">Chiara</h3>
              <p className="text-sm font-medium text-indigo-600 mb-3">Product Manager</p>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Product Manager dans une scale-up HealthTech européenne de premier plan.
                Elle a passé des années à concevoir des outils numériques pour les
                professionnels de santé et comprend intimement leurs contraintes
                au quotidien.
              </p>
            </div>
            {/* Valentin */}
            <div className="flex flex-col items-center text-center">
              <div className="w-36 h-36 rounded-full overflow-hidden mb-5 ring-2 ring-indigo-100 ring-offset-4">
                <Image
                  src="/valentin2.png"
                  alt="Valentin"
                  width={288}
                  height={288}
                  className="w-full h-full object-cover object-center grayscale"
                />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900">Valentin</h3>
              <p className="text-sm font-medium text-indigo-600 mb-3">Ingénieur IA</p>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Ingénieur en intelligence artificielle spécialisé dans le développement
                de solutions IA pour le secteur médical. Il conçoit des systèmes
                qui transforment des processus cliniques complexes en workflows
                simples, fiables et conformes aux exigences réglementaires.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Thread: team → participate */}
      <ThreadConnector step={4} className="bg-zinc-50/50" />

      {/* 5. Participer — Calendly CTA */}
      <section id="participer" className="pt-10 sm:pt-14 pb-20 sm:pb-28 px-6 bg-zinc-50/50">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2
              className="text-3xl sm:text-4xl font-normal tracking-tight text-zinc-900"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Construisons ensemble l'outil{" "}
              <span className="text-zinc-400">qui vous manque.</span>
            </h2>
            <p className="mt-4 text-zinc-500 max-w-2xl mx-auto leading-relaxed">
              Nous sélectionnons 15 psychiatres en Suisse romande pour co-créer Adminds.
              Réservez un appel de 15-20 minutes pour partager votre
              expérience quotidienne de l&apos;administratif.
              Vos retours façonneront directement le produit.
            </p>
          </div>
          <CalendlyEmbed />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-100 py-8 px-6">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Logo size="sm" href="/" />
            <span className="text-sm text-zinc-400">
              &copy; {new Date().getFullYear()}
            </span>
          </div>
          <div className="flex gap-6">
            <a
              href="/privacy"
              className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              Confidentialité
            </a>
            <a
              href="/terms"
              className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              Conditions
            </a>
            <a
              href="mailto:contact@adminds.ch"
              className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
