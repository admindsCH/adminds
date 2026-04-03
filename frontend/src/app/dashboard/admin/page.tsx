"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { Heading, Subheading } from "@/components/heading";
import { Text } from "@/components/text";
import { Badge } from "@/components/badge";
import { apiGet } from "@/lib/api";

// ── Types ────────────────────────────────────────────────

interface DailyActivity {
  date: string;
  count: number;
}

interface TimeSpent {
  total_minutes: number;
  today_minutes: number;
  week_minutes: number;
}

interface UserSummary {
  user_id: string;
  last_seen: string;
  total_events: number;
  event_counts: Record<string, number>;
  daily_activity: DailyActivity[];
  current_streak: number;
  best_streak: number;
  days_active_30: number;
  time_spent: TimeSpent;
}

interface RawEvent {
  id: number;
  user_id: string;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface UserProfile {
  email: string;
  name: string;
}

// ── Helpers ──────────────────────────────────────────────

const ADMIN_IDS = new Set([
  "user_3Af5l4EYpIW94urqgVbtX9dQUNK",
  "user_3AfGjH8PKMVnlv5gyDnMKVKAoG1",
  "user_3AepyhdzQBxM9XXIu4SFUsuLeeL",
]);

const EVENT_LABELS: Record<string, string> = {
  page_visit: "Visite page",
  step_completed: "Étape complétée",
  documents_classified: "Documents classifiés",
  patient_data_loaded: "Dossier patient chargé",
  dossier_edited: "Dossier modifié",
  report_generated: "Rapport généré",
  field_values_edited: "Champs modifiés",
  field_regenerated: "Champ régénéré",
  template_uploaded: "Template importé",
  templates_listed: "Templates consultés",
};

const EVENT_COLORS: Record<string, "green" | "blue" | "indigo" | "amber" | "purple" | "zinc" | "emerald" | "sky" | "rose" | "teal"> = {
  page_visit: "zinc",
  step_completed: "blue",
  documents_classified: "sky",
  patient_data_loaded: "emerald",
  dossier_edited: "amber",
  report_generated: "green",
  field_values_edited: "purple",
  field_regenerated: "indigo",
  template_uploaded: "teal",
  templates_listed: "zinc",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
}

// ── Heatmap (last 30 days) ───────────────────────────────

function Heatmap30({ daily }: { daily: DailyActivity[] }) {
  const days: { date: string; count: number }[] = [];
  const today = new Date();
  const map = new Map(daily.map((d) => [d.date, d.count]));

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, count: map.get(key) ?? 0 });
  }

  const max = Math.max(...days.map((d) => d.count), 1);

  return (
    <div className="flex gap-[2px]">
      {days.map((d) => {
        const intensity = d.count === 0 ? 0 : Math.ceil((d.count / max) * 4);
        const colors = [
          "bg-zinc-100",
          "bg-indigo-200",
          "bg-indigo-300",
          "bg-indigo-400",
          "bg-indigo-600",
        ];
        return (
          <div
            key={d.date}
            className={`h-3 w-3 rounded-sm ${colors[intensity]}`}
            title={`${d.date}: ${d.count} événement${d.count !== 1 ? "s" : ""}`}
          />
        );
      })}
    </div>
  );
}

// ── (sparkline removed — engagement is now inline in user rows) ──

// ── Field changes panel ──────────────────────────────────

interface FieldChange {
  field_id: string;
  old: string;
  new: string;
}

interface FieldChangeEvent {
  id: number;
  event_type: "field_values_edited" | "field_regenerated";
  created_at: string;
  metadata: {
    dossier_id?: string;
    template_id?: string;
    field_id?: string;
    instruction?: string;
    old?: string;
    new?: string;
    changes?: FieldChange[];
  };
}

function FieldChangesPanel({ userId, label, onClose }: { userId: string; label: string; onClose: () => void }) {
  const [events, setEvents] = useState<FieldChangeEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiGet<RawEvent[]>(`/api/admin/analytics/events/${userId}`)
      .then((all) => {
        const fieldEvents = all.filter(
          (e) => e.event_type === "field_values_edited" || e.event_type === "field_regenerated"
        ) as unknown as FieldChangeEvent[];
        setEvents(fieldEvents);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="mt-6 rounded-lg border border-purple-200 bg-purple-50/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <Subheading level={3}>
          Modifications de champs — <span className="text-sm">{label}</span>
        </Subheading>
        <button onClick={onClose} className="text-sm text-zinc-500 hover:text-zinc-700">
          Fermer
        </button>
      </div>

      {loading ? (
        <Text>Chargement...</Text>
      ) : events.length === 0 ? (
        <Text>Aucune modification de champ enregistrée.</Text>
      ) : (
        <div className="space-y-4 max-h-[32rem] overflow-y-auto">
          {events.map((evt) => (
            <div key={evt.id} className="rounded-lg border border-zinc-200 bg-white p-4">
              {/* Header row */}
              <div className="flex items-center gap-3 mb-3">
                <Badge color={evt.event_type === "field_regenerated" ? "indigo" : "purple"}>
                  {evt.event_type === "field_regenerated" ? "Régénéré" : "Modifié manuellement"}
                </Badge>
                <span className="text-xs text-zinc-400">{formatDate(evt.created_at)}</span>
              </div>

              {/* Single field regeneration */}
              {evt.event_type === "field_regenerated" && evt.metadata.old !== undefined && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-zinc-500">
                    Champ : <span className="font-mono">{evt.metadata.field_id}</span>
                  </div>
                  {evt.metadata.instruction && (
                    <div className="text-xs text-indigo-600">
                      Instruction : &laquo; {evt.metadata.instruction} &raquo;
                    </div>
                  )}
                  <DiffRow oldVal={evt.metadata.old ?? ""} newVal={evt.metadata.new ?? ""} />
                </div>
              )}

              {/* Batch field edits */}
              {evt.event_type === "field_values_edited" && evt.metadata.changes && evt.metadata.changes.length > 0 && (
                <div className="space-y-3">
                  {evt.metadata.changes.map((ch, i) => (
                    <div key={i} className="space-y-1">
                      <div className="text-xs font-medium text-zinc-500">
                        Champ : <span className="font-mono">{ch.field_id}</span>
                      </div>
                      <DiffRow oldVal={ch.old} newVal={ch.new} />
                    </div>
                  ))}
                </div>
              )}

              {/* Batch edit with no changes recorded (legacy events before diff tracking) */}
              {evt.event_type === "field_values_edited" && (!evt.metadata.changes || evt.metadata.changes.length === 0) && (
                <Text>Pas de détail de diff disponible pour cet événement.</Text>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DiffRow({ oldVal, newVal }: { oldVal: string; newVal: string }) {
  // Truncate long values for display
  const maxLen = 300;
  const truncate = (s: string) => (s.length > maxLen ? s.slice(0, maxLen) + "..." : s);

  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div className="rounded-md bg-red-50 border border-red-200 p-2.5">
        <div className="text-[10px] font-medium uppercase tracking-wide text-red-400 mb-1">Avant</div>
        <div className="text-red-800 whitespace-pre-wrap break-words">{truncate(oldVal) || <span className="italic text-red-300">(vide)</span>}</div>
      </div>
      <div className="rounded-md bg-green-50 border border-green-200 p-2.5">
        <div className="text-[10px] font-medium uppercase tracking-wide text-green-400 mb-1">Apres</div>
        <div className="text-green-800 whitespace-pre-wrap break-words">{truncate(newVal) || <span className="italic text-green-300">(vide)</span>}</div>
      </div>
    </div>
  );
}

// ── User event history panel ─────────────────────────────

function UserEventHistory({ userId, label, onClose }: { userId: string; label: string; onClose: () => void }) {
  const [events, setEvents] = useState<RawEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiGet<RawEvent[]>(`/api/admin/analytics/events/${userId}`)
      .then((all) => setEvents(all.filter((e) => e.event_type !== "heartbeat")))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-6">
      <div className="flex items-center justify-between mb-4">
        <Subheading level={3}>
          Historique — <span className="text-sm">{label}</span>
        </Subheading>
        <button onClick={onClose} className="text-sm text-zinc-500 hover:text-zinc-700">
          Fermer
        </button>
      </div>

      {loading ? (
        <Text>Chargement...</Text>
      ) : events.length === 0 ? (
        <Text>Aucun événement.</Text>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-zinc-50">
              <tr className="text-left text-zinc-500">
                <th className="pb-2 pr-4 font-medium">Date</th>
                <th className="pb-2 pr-4 font-medium">Événement</th>
                <th className="pb-2 font-medium">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {events.map((evt) => (
                <tr key={evt.id} className="text-zinc-700">
                  <td className="py-2 pr-4 whitespace-nowrap text-zinc-500">
                    {formatDate(evt.created_at)}
                  </td>
                  <td className="py-2 pr-4">
                    <Badge color={EVENT_COLORS[evt.event_type] ?? "zinc"}>
                      {EVENT_LABELS[evt.event_type] ?? evt.event_type}
                    </Badge>
                  </td>
                  <td className="py-2 font-mono text-xs text-zinc-400">
                    {Object.keys(evt.metadata).length > 0
                      ? JSON.stringify(evt.metadata)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const { user } = useUser();
  const [summaries, setSummaries] = useState<UserSummary[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [fieldChangesUser, setFieldChangesUser] = useState<string | null>(null);
  const [historyUser, setHistoryUser] = useState<string | null>(null);

  const isAdmin = user?.id && ADMIN_IDS.has(user.id);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<UserSummary[]>("/api/admin/analytics/summary");
      setSummaries(data);

      // Resolve user IDs to emails via Clerk
      const ids = data.map((s) => s.user_id).join(",");
      if (ids) {
        const profiles = await fetch(`/api/admin/users?ids=${ids}`).then((r) => r.json());
        setUserProfiles(profiles);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin, fetchData]);

  if (!user) return <Text>Chargement...</Text>;
  if (!isAdmin) {
    return (
      <div className="text-center py-20">
        <Heading>Accès refusé</Heading>
        <Text className="mt-2">Cette page est réservée aux administrateurs.</Text>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <Heading>Monitoring Utilisateurs</Heading>
          <Text className="mt-1">Activité et engagement de vos utilisateurs.</Text>
        </div>
        <button
          onClick={fetchData}
          className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200"
        >
          Rafraîchir
        </button>
      </div>

      {loading ? (
        <div className="mt-10 text-center">
          <Text>Chargement des données...</Text>
        </div>
      ) : error ? (
        <div className="mt-10 text-center">
          <Text className="text-red-600">{error}</Text>
        </div>
      ) : summaries.length === 0 ? (
        <div className="mt-10 text-center">
          <Text>Aucune donnée d'activité pour l'instant.</Text>
        </div>
      ) : (
        <>
          {/* Stats cards */}
          <div className="mt-8 grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-zinc-200 p-4">
              <Text>Utilisateurs actifs</Text>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">{summaries.length}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 p-4">
              <Text>Événements totaux</Text>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {summaries.reduce((sum, s) => sum + s.total_events, 0)}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 p-4">
              <Text>Rapports générés</Text>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {summaries.reduce((sum, s) => sum + (s.event_counts.report_generated ?? 0), 0)}
              </p>
            </div>
          </div>

          {/* User table */}
          <div className="mt-8">
            <Subheading>Par utilisateur</Subheading>
            <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50">
                  <tr className="text-left text-zinc-500">
                    <th className="px-4 py-3 font-medium">Utilisateur</th>
                    <th className="px-4 py-3 font-medium">Dernière activité</th>
                    <th className="px-4 py-3 font-medium text-center">Streak</th>
                    <th className="px-4 py-3 font-medium text-center">Rapports</th>
                    <th className="px-4 py-3 font-medium text-center">Dossiers</th>
                    <th className="px-4 py-3 font-medium text-center">Modifs champs</th>
                    <th className="px-4 py-3 font-medium text-center">Temps</th>
                    <th className="px-4 py-3 font-medium text-center">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((s) => {
                    const isExpanded = selectedUser === s.user_id;
                    return (
                      <tr
                        key={s.user_id}
                        className="cursor-pointer hover:bg-zinc-50 transition-colors border-b border-zinc-100"
                        onClick={() => {
                          setSelectedUser(isExpanded ? null : s.user_id);
                          setFieldChangesUser(null);
                        }}
                      >
                        {/* Main row content in a single full-width cell using inner grid */}
                        <td colSpan={8} className="p-0">
                          <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto_auto] items-center">
                            {/* Utilisateur */}
                            <div className="px-4 py-3">
                              <div>
                                <span className="text-sm text-zinc-900">
                                  {userProfiles[s.user_id]?.email ?? s.user_id.slice(0, 20) + "..."}
                                </span>
                                {userProfiles[s.user_id]?.name && userProfiles[s.user_id].name !== "—" && (
                                  <span className="ml-2 text-xs text-zinc-400">
                                    {userProfiles[s.user_id].name}
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Dernière activité */}
                            <div className="px-4 py-3 text-zinc-500 text-sm">{timeAgo(s.last_seen)}</div>
                            {/* Streak */}
                            <div className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {s.current_streak > 0 && (
                                  <span className={s.current_streak >= 7 ? "text-lg" : s.current_streak >= 3 ? "text-base" : "text-sm"}>
                                    🔥
                                  </span>
                                )}
                                <span className="text-sm font-semibold text-zinc-900">{s.current_streak}j</span>
                              </div>
                            </div>
                            {/* Rapports */}
                            <div className="px-4 py-3 text-center">
                              <Badge color="green">{s.event_counts.report_generated ?? 0}</Badge>
                            </div>
                            {/* Dossiers */}
                            <div className="px-4 py-3 text-center">
                              <Badge color="emerald">{s.event_counts.patient_data_loaded ?? 0}</Badge>
                            </div>
                            {/* Modifs champs */}
                            <div className="px-4 py-3 text-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFieldChangesUser(fieldChangesUser === s.user_id ? null : s.user_id);
                                  setSelectedUser(null);
                                }}
                                className="inline-flex"
                                title="Voir les modifications de champs"
                              >
                                <Badge color="purple">
                                  {(s.event_counts.field_values_edited ?? 0) +
                                    (s.event_counts.field_regenerated ?? 0)}
                                </Badge>
                              </button>
                            </div>
                            {/* Temps */}
                            <div className="px-4 py-3 text-center text-sm text-zinc-500">
                              {formatMinutes(s.time_spent.total_minutes)}
                            </div>
                            {/* Total */}
                            <div className="px-4 py-3 text-center text-sm font-medium text-zinc-700">
                              {s.total_events}
                            </div>
                          </div>

                          {/* Expanded engagement row */}
                          {isExpanded && (
                            <div className="border-t border-zinc-100 bg-zinc-50/50 px-4 py-3">
                              <div className="flex items-center gap-8">
                                {/* Streak details */}
                                <div className="flex items-center gap-4">
                                  <div className="text-center">
                                    <p className="text-lg font-bold text-zinc-900">{s.current_streak}</p>
                                    <p className="text-[10px] uppercase tracking-wide text-zinc-400">Streak actuel</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-lg font-bold text-zinc-900">{s.best_streak}</p>
                                    <p className="text-[10px] uppercase tracking-wide text-zinc-400">Meilleur</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-lg font-bold text-zinc-900">{s.days_active_30}<span className="text-xs font-normal text-zinc-400">/30</span></p>
                                    <p className="text-[10px] uppercase tracking-wide text-zinc-400">Jours actifs</p>
                                  </div>
                                </div>

                                {/* Divider */}
                                <div className="h-10 w-px bg-zinc-200" />

                                {/* Time spent */}
                                <div className="flex items-center gap-4">
                                  <div className="text-center">
                                    <p className="text-sm font-semibold text-zinc-700">{formatMinutes(s.time_spent.today_minutes)}</p>
                                    <p className="text-[10px] uppercase tracking-wide text-zinc-400">Aujourd&apos;hui</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-sm font-semibold text-zinc-700">{formatMinutes(s.time_spent.week_minutes)}</p>
                                    <p className="text-[10px] uppercase tracking-wide text-zinc-400">Cette semaine</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-sm font-semibold text-zinc-700">{formatMinutes(s.time_spent.total_minutes)}</p>
                                    <p className="text-[10px] uppercase tracking-wide text-zinc-400">Total</p>
                                  </div>
                                </div>

                                {/* Divider */}
                                <div className="h-10 w-px bg-zinc-200" />

                                {/* Heatmap */}
                                <div>
                                  <Heatmap30 daily={s.daily_activity} />
                                  <p className="mt-1 text-[10px] text-zinc-300">30 derniers jours</p>
                                </div>

                                {/* Spacer + history button */}
                                <div className="ml-auto">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setHistoryUser(historyUser === s.user_id ? null : s.user_id);
                                      setFieldChangesUser(null);
                                    }}
                                    className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200"
                                  >
                                    Voir historique
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Event history detail */}
          {historyUser && (
            <UserEventHistory
              userId={historyUser}
              label={userProfiles[historyUser]?.email ?? historyUser}
              onClose={() => setHistoryUser(null)}
            />
          )}

          {/* Field changes detail */}
          {fieldChangesUser && (
            <FieldChangesPanel
              userId={fieldChangesUser}
              label={userProfiles[fieldChangesUser]?.email ?? fieldChangesUser}
              onClose={() => setFieldChangesUser(null)}
            />
          )}
        </>
      )}
    </>
  );
}
