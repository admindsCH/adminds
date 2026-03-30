import Hero from "./_components/hero";
import AdminBurden from "./_components/admin-burden";
import TimeComparison from "./_components/time-comparison";
import ReportMockup from "./_components/report-mockup";
import FeaturesSection from "./_components/features-section";
import SecuritySection from "./_components/security-section";
import TeamShowcase from "./_components/team-showcase";
import FaqSection from "./_components/faq-section";
import CalendlyEmbed from "./_components/calendly-embed";
import MobileNav from "./_components/mobile-nav";
import { Logo } from "@/components/logo";

const NAV_LINKS = [
  { href: "#probleme", label: "Le problème" },
  { href: "#fonctionnalites", label: "Comment ça marche" },
  { href: "#securite", label: "Sécurité" },
  { href: "#equipe", label: "L'équipe" },
  { href: "#demo", label: "Accès bêta" },
];

function SectionDivider() {
  return (
    <div className="flex justify-center py-6 sm:py-8">
      <div className="w-px h-16 bg-gradient-to-b from-transparent via-indigo-200 to-transparent" />
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      {/* ─── Header ─── */}
      <header className="fixed top-0 z-50 w-full border-b border-zinc-100/50 bg-white/70 backdrop-blur-xl">
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
          <div className="flex items-center gap-4">
            <a
              href="/sign-in"
              className="hidden sm:block text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              Se connecter
            </a>
            <a
              href="#demo"
              className="hidden md:block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              Demander un accès
            </a>
            <MobileNav links={NAV_LINKS} />
          </div>
        </div>
      </header>

      {/* ─── 1. Hero ─── */}
      <Hero />

      <SectionDivider />

      {/* ─── 2. Le problème ─── */}
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
              Vous n&apos;avez pas fait médecine{" "}
              <span className="text-zinc-400">pour remplir des formulaires.</span>
            </h2>
            <p className="mt-5 text-lg text-zinc-500 max-w-2xl mx-auto leading-relaxed">
              Entre deux patients, entre deux cafés, entre deux soupirs —
              l&apos;administratif grignote votre temps, votre énergie, et parfois
              la qualité de vos rapports.
            </p>
          </div>
          <AdminBurden />
        </div>
      </section>

      <SectionDivider />

      {/* ─── 3. Comment ça marche + Fonctionnalités ─── */}
      <section id="fonctionnalites" className="py-20 sm:py-28 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-3">
              Comment ça marche
            </div>
            <h2
              className="text-3xl sm:text-4xl font-normal tracking-tight text-zinc-900"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Importez. Générez. Signez.
            </h2>
            <p className="mt-4 text-zinc-500 max-w-2xl mx-auto leading-relaxed">
              Votre dossier patient entre dans Adminds. Un rapport conforme en sort.
              Tout ce qui se passe entre les deux, c&apos;est notre problème.
            </p>
          </div>
          <TimeComparison />

          {/* Features grid — below the comparison */}
          <div className="mt-20">
            <div className="text-center mb-12">
              <h3
                className="text-2xl sm:text-3xl font-normal tracking-tight text-zinc-900"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                Tout ce que vous faites à 19h,{" "}
                <span className="text-zinc-400">fait en 10 minutes.</span>
              </h3>
              <p className="mt-4 text-zinc-500 max-w-2xl mx-auto leading-relaxed">
                Rapport AI, attestation perte de gain, rapport d&apos;assurance...
                Si c&apos;est un formulaire que vous remplissez après les consultations,
                Adminds le génère pour vous.
              </p>
            </div>
          </div>
        </div>
        <FeaturesSection />
      </section>

      <SectionDivider />

      {/* ─── 4. Exemple concret ─── */}
      <section id="exemple" className="py-20 sm:py-28 px-6 bg-zinc-50/50">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-3">
              Un exemple concret
            </div>
            <h2
              className="text-3xl sm:text-4xl font-normal tracking-tight text-zinc-900"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Ce rapport qui vous prend 2 heures ?{" "}
              <span className="text-zinc-400">Il est prêt.</span>
            </h2>
            <p className="mt-4 text-zinc-500 max-w-2xl mx-auto leading-relaxed">
              Le rapport d&apos;assurance invalidité est le document le plus lourd
              à rédiger. Importez le dossier, et l&apos;IA remplit chaque section
              du formulaire cantonal — Foerster, CIM-10, jurisprudence fédérale.
              Vous relisez, vous ajustez, vous signez.
            </p>
          </div>
          <ReportMockup />
        </div>
      </section>

      <SectionDivider />

      {/* ─── 5. Sécurité ─── */}
      <section id="securite" className="py-20 sm:py-28 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-3">
              Sécurité & confidentialité
            </div>
            <h2
              className="text-3xl sm:text-4xl font-normal tracking-tight text-zinc-900"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Vos données restent en Suisse.{" "}
              <span className="text-zinc-400">Et nulle part ailleurs.</span>
            </h2>
          </div>
          <SecuritySection />
        </div>
      </section>

      <SectionDivider />

      {/* ─── 8. L'équipe ─── */}
      <section id="equipe" className="py-20 sm:py-28 px-6 bg-zinc-50/50">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-3">
              L&apos;équipe
            </div>
            <h2
              className="text-3xl sm:text-4xl font-normal tracking-tight text-zinc-900"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Construits par ceux qui ont vu{" "}
              <span className="text-zinc-400">le problème de près.</span>
            </h2>
            <p className="mt-4 text-zinc-500 max-w-2xl mx-auto leading-relaxed">
              HealthTech et intelligence artificielle médicale — on a conçu
              Adminds en passant du temps dans les cabinets, pas dans un bureau.
            </p>
          </div>
          <TeamShowcase />
        </div>
      </section>

      <SectionDivider />

      {/* ─── 9. FAQ ─── */}
      <section className="py-20 sm:py-28 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-3">
              Questions fréquentes
            </div>
            <h2
              className="text-3xl sm:text-4xl font-normal tracking-tight text-zinc-900"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Les questions qu&apos;on nous pose{" "}
              <span className="text-zinc-400">entre deux consultations.</span>
            </h2>
          </div>
          <FaqSection />
        </div>
      </section>

      <SectionDivider />

      {/* ─── 10. Accès bêta ─── */}
      <section id="demo" className="py-20 sm:py-28 px-6 bg-zinc-50/50">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-3">
              Bêta ouverte
            </div>
            <h2
              className="text-3xl sm:text-4xl font-normal tracking-tight text-zinc-900"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Curieux ? On vous montre{" "}
              <span className="text-zinc-400">avec vos propres dossiers.</span>
            </h2>
            <p className="mt-4 text-zinc-500 max-w-2xl mx-auto leading-relaxed">
              Adminds est en bêta ouverte pour les psychiatres en Suisse romande.
              Réservez 20 minutes — on génère un vrai rapport à partir de votre
              dossier, en direct. Vous jugez sur pièce.
            </p>
          </div>
          <CalendlyEmbed />
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-zinc-100 py-8 px-6">
        <div className="mx-auto max-w-5xl flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Logo size="sm" href="/" />
              <span className="text-sm text-zinc-400">
                &copy; {new Date().getFullYear()}
              </span>
            </div>
            <div className="flex gap-6">
              <a href="/privacy" className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
                Confidentialité
              </a>
              <a href="/terms" className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
                Conditions
              </a>
              <a href="mailto:contact@adminds.ch" className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
                Contact
              </a>
            </div>
          </div>
          {/* Trust footer */}
          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-zinc-400 pt-3 border-t border-zinc-50">
            <span className="flex items-center gap-1">🇨🇭 Swiss Made</span>
            <span className="text-zinc-200">·</span>
            <span>Swiss Hosting</span>
            <span className="text-zinc-200">·</span>
            <span>Zéro stockage patient</span>
            <span className="text-zinc-200">·</span>
            <span>Conforme LPD</span>
            <span className="text-zinc-200">·</span>
            <span>Art. 321 CP</span>
          </div>
        </div>
      </footer>
    </>
  );
}
