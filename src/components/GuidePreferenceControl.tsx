"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import type { GuideDetailLevel, GuidePreferences, GuideTone } from "@/lib/boardsignal/guide";

const tones: GuideTone[] = ["Balanced", "Direct", "Analytical", "Sports Desk", "Encouraging"];
const details: GuideDetailLevel[] = ["Short", "Standard", "Detailed"];

export default function GuidePreferenceControl({ token }: { token: string }) {
  const [profile, setProfile] = useState<GuidePreferences>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/boardsignal/guide", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal })
      .then(async (response) => ({ response, body: await response.json() as { ok?: boolean; profile?: { preferences?: GuidePreferences }; error?: string } }))
      .then(({ response, body }) => {
        if (!response.ok || !body.ok || !body.profile?.preferences) throw new Error(body.error ?? "Ask BoardSignal preferences could not be loaded.");
        setProfile(body.profile.preferences);
      })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Ask BoardSignal preferences could not be loaded."); });
    return () => controller.abort();
  }, [token]);

  async function save() {
    if (!profile) return;
    if (!window.confirm(`Save Ask BoardSignal tone as ${profile.preferredTone} and detail as ${profile.preferredDetailLevel}?`)) return;
    setBusy(true); setError(""); setSaved(false);
    try {
      const response = await fetch("/api/boardsignal/guide", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preference", confirmed: true, preferredTone: profile.preferredTone, preferredDetailLevel: profile.preferredDetailLevel, preferredAddress: profile.preferredAddress ?? "" }),
      });
      const body = await response.json() as { ok?: boolean; preferences?: GuidePreferences; error?: string };
      if (!response.ok || !body.ok || !body.preferences) throw new Error(body.error ?? "Ask BoardSignal preferences could not be saved.");
      setProfile(body.preferences); setSaved(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Ask BoardSignal preferences could not be saved."); }
    finally { setBusy(false); }
  }

  if (!profile && !error) return <div className="guide-preference-help"><LoaderCircle className="button-spinner" size={14}/> Loading Ask BoardSignal preferences</div>;
  return <div className="guide-preference-row">
    <p className="guide-preference-help">These are explicit communication preferences, not personality labels. Ask BoardSignal never stores psychological diagnoses or manipulation scores.</p>
    {profile ? <>
      <label>Tone<select value={profile.preferredTone} onChange={(event) => setProfile((value) => value ? { ...value, preferredTone: event.target.value as GuideTone } : value)}>{tones.map((tone) => <option key={tone} value={tone}>{tone === "Sports Desk" ? "Sports coverage" : tone}</option>)}</select></label>
      <label>Detail level<select value={profile.preferredDetailLevel} onChange={(event) => setProfile((value) => value ? { ...value, preferredDetailLevel: event.target.value as GuideDetailLevel } : value)}>{details.map((detail) => <option key={detail}>{detail}</option>)}</select></label>
      <label>How should I address you? <input value={profile.preferredAddress ?? ""} maxLength={60} placeholder="Optional" onChange={(event) => setProfile((value) => value ? { ...value, preferredAddress: event.target.value } : value)} /></label>
      <button type="button" className="button button-quiet" disabled={busy} onClick={() => void save()}>{busy ? <LoaderCircle className="button-spinner" size={14}/> : <Save size={14}/>} Save Ask BoardSignal style</button>
    </> : null}
    {error ? <p className="form-error" role="alert">{error}</p> : null}{saved ? <p className="form-success" role="status">Ask BoardSignal style saved.</p> : null}
  </div>;
}
