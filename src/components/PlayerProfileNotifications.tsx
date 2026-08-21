"use client";

import { useState } from "react";
import { LoaderCircle, LogOut, Save, ShieldCheck } from "lucide-react";
import BrowserPushControl from "@/components/BrowserPushControl";
import GuidePreferenceControl from "@/components/GuidePreferenceControl";
import DeviceOfflineControl from "@/components/DeviceOfflineControl";
import { useBoardSignalConnectivity } from "@/components/ConnectivityProvider";
import { isValidBoardSignalEmail } from "@/lib/boardsignal/delivery";
import type {
  BoardSignalAccount,
  BoardSignalContactMethod,
  BoardSignalNotificationPreferences,
  BoardSignalPrivacySettings,
} from "@/lib/boardsignal/account";

export default function PlayerProfileNotifications({
  account,
  uid,
  token,
  onSaved,
  onSignOut,
}: {
  account: BoardSignalAccount;
  uid: string;
  token: string;
  onSaved: () => Promise<void>;
  onSignOut: () => Promise<void> | void;
}) {
  const connectivity = useBoardSignalConnectivity();
  const [method, setMethod] = useState<BoardSignalContactMethod>(account.preferredContactMethod ?? "email");
  const [contact, setContact] = useState(account.preferredContactValue ?? "");
  const [consent, setConsent] = useState(account.betaContactConsent === true);
  const [notifications, setNotifications] = useState<BoardSignalNotificationPreferences>(account.notificationPreferences);
  const [privacy, setPrivacy] = useState<BoardSignalPrivacySettings>(account.privacy);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function notificationToggle(key: keyof Pick<BoardSignalNotificationPreferences, "deskReady" | "episodeProgress" | "blueReminder" | "universeAchievement" | "founderUpdates">, label: string) {
    return <label className="profile-toggle"><span><strong>{label}</strong><small>In-app messages{notifications.browserPush ? " and eligible browser alerts" : ""}</small></span><input type="checkbox" checked={notifications[key]} onChange={(event) => setNotifications((value) => ({ ...value, [key]: event.target.checked }))} /></label>;
  }

  const emailContactReady = method === "email" && consent && isValidBoardSignalEmail(contact);

  async function save() {
    if (!connectivity.online) { setError("Reconnect before changing account or notification settings."); return; }
    setBusy(true);
    setSaved(false);
    setError("");
    try {
      const response = await fetch("/api/boardsignal/player-room", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updatePreferences",
          privacy: { ...privacy, publicPlayerPage: true, universeCoverage: true },
          notificationPreferences: { ...notifications, email: emailContactReady ? notifications.email : false },
          contact: {
            preferredContactMethod: method,
            preferredContactValue: contact.trim(),
            betaContactConsent: consent,
          },
        }),
      });
      const body = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Profile could not be saved.");
      setSaved(true);
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Profile could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  const discordInvite = process.env.NEXT_PUBLIC_BOARDSIGNAL_DISCORD_INVITE_URL?.trim();

  return <section className="player-profile-section">
    <div className="room-section-heading"><div><p className="kicker">PROFILE / NOTIFICATIONS</p><h2>Your BoardSignal account</h2><p>Identity stays tied to your stable Chess.com player ID. Contact details are for BoardSignal account communication, not authentication.</p></div></div>
    <div className="profile-settings-grid">
      <article className="profile-settings-card"><h3>Account</h3><dl><div><dt>Chess.com username</dt><dd>{account.chessCom.canonicalUsername}</dd></div><div><dt>Founding Access</dt><dd>{account.accessTier === "founding_beta" && account.accessStatus === "active" ? "Active" : account.accessStatus}</dd></div><div><dt>OAuth status</dt><dd>{account.chessComOAuthLinkedAt ? "Linked" : "Awaiting Chess.com provider approval"}</dd></div></dl></article>

      <article className="profile-settings-card"><h3>Contact</h3><div className="profile-contact-status"><span>External contact</span><strong>{account.preferredContactMethod && account.preferredContactValue ? `${account.preferredContactMethod.charAt(0).toUpperCase()}${account.preferredContactMethod.slice(1)} · ${account.preferredContactValue}` : "Not added"}</strong></div><label>Preferred contact<select value={method} onChange={(event) => setMethod(event.target.value as BoardSignalContactMethod)}><option value="email">Email</option><option value="discord">Discord</option><option value="telegram">Telegram</option></select></label><label>Contact value<input value={contact} onChange={(event) => setContact(event.target.value)} type={method === "email" ? "email" : "text"} maxLength={160} /></label><label className="agreement-check"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I agree BoardSignal may contact me about my Founding Access account, Review availability, important product updates and BoardSignal feedback.</span></label><p className="profile-helper">External contact is optional after access. This is BoardSignal communication consent, not unrelated marketing consent. You can add or change it here later.</p></article>

      <article className="profile-settings-card"><h3>Notifications</h3>{notificationToggle("deskReady", "Review Ready")}{notificationToggle("episodeProgress", "This Week Progress")}{notificationToggle("blueReminder", "Focus Next Reminder")}{notificationToggle("universeAchievement", "Around BoardSignal Highlight")}{notificationToggle("founderUpdates", "Founder Updates")}<div className="profile-email-alerts"><p className="kicker">EMAIL ALERTS</p><label className="profile-toggle"><span><strong>Email me important BoardSignal updates</strong><small>{emailContactReady ? "Review Ready, major BoardSignal updates, feedback requests and other important eligible messages only." : "Choose Email as your preferred contact, enter a valid address and keep BoardSignal contact consent enabled first."}</small></span><input type="checkbox" checked={emailContactReady && notifications.email} disabled={!emailContactReady} onChange={(event) => setNotifications((value) => ({ ...value, email: event.target.checked }))} /></label></div></article>

      <article className="profile-settings-card"><h3>Browser</h3><BrowserPushControl idToken={token} onChanged={onSaved} /></article>

      <article className="profile-settings-card"><h3>Ask BoardSignal</h3><GuidePreferenceControl token={token} /></article>

      <article className="profile-settings-card"><h3>BoardSignal on this device</h3><DeviceOfflineControl uid={uid} onRefresh={onSaved} /></article>

      <article className="profile-settings-card"><h3>Community</h3><div className="required-participation-row"><ShieldCheck size={17} /><div><strong>Founding Access public highlights = Included</strong><p>Each completed review can contribute a safe positive or neutral highlight. Private improvement guidance, reviewed positions and progress stay private.</p></div></div>{discordInvite ? <a className="button button-outline" href={discordInvite} target="_blank" rel="noreferrer">Join the Founding Access Discord</a> : null}</article>

      <article className="profile-settings-card"><h3>Optional public controls</h3><label className="profile-toggle"><span><strong>Additional positive highlights</strong><small>Beyond the required minimal safe coverage</small></span><input type="checkbox" checked={privacy.additionalPositiveHighlights === true} onChange={(event) => setPrivacy((value) => ({ ...value, additionalPositiveHighlights: event.target.checked }))} /></label><label className="profile-toggle"><span><strong>Direct public game links</strong><small>Where a safe public item supports them</small></span><input type="checkbox" checked={privacy.publicGameLinks === true} onChange={(event) => setPrivacy((value) => ({ ...value, publicGameLinks: event.target.checked }))} /></label><label className="profile-toggle"><span><strong>Expanded public profile details</strong><small>Optional profile context beyond the minimal sports identity</small></span><input type="checkbox" checked={privacy.expandedPublicProfile === true} onChange={(event) => setPrivacy((value) => ({ ...value, expandedPublicProfile: event.target.checked }))} /></label></article>
    </div>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    {saved ? <p className="form-success" role="status">Profile saved.</p> : null}
    <div className="profile-actions"><button className="button button-lime" type="button" onClick={save} disabled={busy || !connectivity.online || (consent && !contact.trim())}>{busy ? <><LoaderCircle className="button-spinner" size={15} /> Saving</> : <><Save size={15} /> Save profile</>}</button><button className="button button-quiet" type="button" onClick={onSignOut}><LogOut size={15} /> Sign out</button></div>
  </section>;
}
