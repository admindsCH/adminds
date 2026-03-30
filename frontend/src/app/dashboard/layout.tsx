"use client";

import { useState } from "react";
import { UserButton, useAuth, useUser } from "@clerk/nextjs";
import { setTokenGetter } from "@/lib/api";

// ── Doctor Profile Form (rendered inside Clerk modal) ───

function DoctorProfileForm() {
  const { user } = useUser();
  const meta = user?.unsafeMetadata ?? {};

  const [specialty, setSpecialty] = useState((meta.specialty as string) ?? "Psychiatre");
  const [cabinetName, setCabinetName] = useState((meta.cabinet_name as string) ?? "");
  const [cabinetAddress, setCabinetAddress] = useState((meta.cabinet_address as string) ?? "");
  const [cabinetNpa, setCabinetNpa] = useState((meta.cabinet_npa as string) ?? "");
  const [cabinetCity, setCabinetCity] = useState((meta.cabinet_city as string) ?? "");
  const [canton, setCanton] = useState((meta.canton as string) ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    try {
      await user.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          specialty,
          cabinet_name: cabinetName,
          cabinet_address: cabinetAddress,
          cabinet_npa: cabinetNpa,
          cabinet_city: cabinetCity,
          canton,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const labelClass = "block text-sm font-medium text-zinc-700 mb-1";
  const inputClass = "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400";
  const selectClass = inputClass;

  return (
    <div className="space-y-5 px-1 py-2">
      <div>
        <h3 className="text-base font-semibold text-zinc-900">Profil médical</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Ces informations apparaissent sur vos rapports générés.
        </p>
      </div>

      <div>
        <label className={labelClass}>Spécialité</label>
        <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} className={selectClass}>
          <option value="Psychiatre">Psychiatre</option>
          <option value="Psychiatre et psychothérapeute">Psychiatre et psychothérapeute</option>
        </select>
      </div>

      <div className="border-t border-zinc-200 pt-4">
        <h4 className="text-sm font-medium text-zinc-900 mb-3">Adresse du cabinet</h4>

        <div className="space-y-3">
          <div>
            <label className={labelClass}>Nom du cabinet</label>
            <input value={cabinetName} onChange={(e) => setCabinetName(e.target.value)} placeholder="Cabinet de psychiatrie Dr Dupont" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Rue et numéro</label>
            <input value={cabinetAddress} onChange={(e) => setCabinetAddress(e.target.value)} placeholder="Rue de Lausanne 12" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>NPA</label>
              <input value={cabinetNpa} onChange={(e) => setCabinetNpa(e.target.value)} placeholder="1700" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Localité</label>
              <input value={cabinetCity} onChange={(e) => setCabinetCity(e.target.value)} placeholder="Fribourg" className={inputClass} />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-200 pt-4">
        <label className={labelClass}>Canton</label>
        <p className="text-xs text-zinc-400 mb-2">Détermine les directives appliquées lors de la génération du rapport.</p>
        <select value={canton} onChange={(e) => setCanton(e.target.value)} className={selectClass}>
          <option value="">Sélectionner un canton</option>
          <option value="AG">Argovie (AG)</option>
          <option value="AI">Appenzell Rhodes-Intérieures (AI)</option>
          <option value="AR">Appenzell Rhodes-Extérieures (AR)</option>
          <option value="BE">Berne (BE)</option>
          <option value="BL">Bâle-Campagne (BL)</option>
          <option value="BS">Bâle-Ville (BS)</option>
          <option value="FR">Fribourg (FR)</option>
          <option value="GE">Genève (GE)</option>
          <option value="GL">Glaris (GL)</option>
          <option value="GR">Grisons (GR)</option>
          <option value="JU">Jura (JU)</option>
          <option value="LU">Lucerne (LU)</option>
          <option value="NE">Neuchâtel (NE)</option>
          <option value="NW">Nidwald (NW)</option>
          <option value="OW">Obwald (OW)</option>
          <option value="SG">Saint-Gall (SG)</option>
          <option value="SH">Schaffhouse (SH)</option>
          <option value="SO">Soleure (SO)</option>
          <option value="SZ">Schwyz (SZ)</option>
          <option value="TG">Thurgovie (TG)</option>
          <option value="TI">Tessin (TI)</option>
          <option value="UR">Uri (UR)</option>
          <option value="VD">Vaud (VD)</option>
          <option value="VS">Valais (VS)</option>
          <option value="ZG">Zoug (ZG)</option>
          <option value="ZH">Zurich (ZH)</option>
        </select>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        {saved && <span className="text-sm text-green-600">Enregistré</span>}
      </div>
    </div>
  );
}

// ── Layout ──────────────────────────────────────────────

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useUser();
  const { getToken } = useAuth();
  const displayName = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : "Mon compte";

  // Wire Clerk token into all API calls — set eagerly (not in useEffect)
  // so it's available before child component effects fire.
  setTokenGetter(() => getToken());

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100 p-2">
      <div className="flex flex-1 flex-col rounded-lg bg-white shadow-xs ring-1 ring-zinc-950/5">
        {/* Account — top bar */}
        <div className="border-b border-zinc-950/5 px-6 py-4 lg:px-10">
          <div className="flex items-center gap-3">
            <UserButton
              appearance={{ elements: { avatarBox: "size-8" } }}
            >
              <UserButton.UserProfilePage
                label="Profil médical"
                labelIcon={
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                }
                url="profil-medical"
              >
                <DoctorProfileForm />
              </UserButton.UserProfilePage>
            </UserButton>
            <span className="text-sm text-zinc-500">{displayName}</span>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 p-6 lg:p-10">
          <div className="mx-auto max-w-5xl">{children}</div>
        </div>
      </div>
    </div>
  );
}
