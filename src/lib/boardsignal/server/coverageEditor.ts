import "server-only";

import { getAdminDb } from "../../../utils/firebaseAdmin";

function text(value: unknown, max: number) {
  const clean = String(value ?? "").trim();
  if (clean.length > max) throw Object.assign(new Error(`Editorial text must stay under ${max} characters.`), { status: 400 });
  return clean;
}

export async function listFounderCoverage() {
  const snapshot = await getAdminDb().collection("publicCoverage").orderBy("periodEnd", "desc").limit(100).get();
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
}

export async function updateFounderCoverage(input: {
  action: "feature" | "updateEditorial" | "remove" | "setLead";
  id: string;
  featured?: boolean;
  featuredOrder?: number;
  editorialTitle?: unknown;
  editorialContext?: unknown;
}) {
  const db = getAdminDb();
  const ref = db.collection("publicCoverage").doc(input.id);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw Object.assign(new Error("That public coverage item was not found."), { status: 404 });
  if (input.action === "remove") {
    await ref.delete();
    return { removed: input.id };
  }
  if (input.action === "setLead") {
    const all = await db.collection("publicCoverage").where("homepageLead", "==", true).get();
    const batch = db.batch();
    all.docs.forEach((document) => batch.set(document.ref, { homepageLead: false }, { merge: true }));
    batch.set(ref, { homepageLead: true, featured: true, featuredAt: new Date().toISOString() }, { merge: true });
    await batch.commit();
    return { homepageLead: input.id };
  }
  if (input.action === "feature") {
    await ref.set({ featured: input.featured === true, featuredOrder: Number.isFinite(input.featuredOrder) ? Number(input.featuredOrder) : 0 }, { merge: true });
    return { featured: input.featured === true };
  }
  const editorialTitle = text(input.editorialTitle, 140);
  const editorialContext = text(input.editorialContext, 500);
  await ref.set({ editorialTitle: editorialTitle || null, editorialContext: editorialContext || null, editorialUpdatedAt: new Date().toISOString() }, { merge: true });
  return { editorialTitle, editorialContext };
}

export async function listFounderCoverageBundle() {
  const db = getAdminDb();
  const [coverage, universeEvents, shareMoments] = await Promise.all([
    listFounderCoverage(),
    db.collection("publicUniverseEvents").orderBy("publishedAt", "desc").limit(100).get().catch(() => ({ docs: [] })),
    db.collection("publicShareMoments").orderBy("periodEnd", "desc").limit(100).get().catch(() => ({ docs: [] })),
  ]);
  return {
    coverage,
    universeEvents: universeEvents.docs.map((document) => ({ id: document.id, ...document.data() })),
    shareMoments: shareMoments.docs.map((document) => ({ id: document.id, ...document.data() })),
  };
}

export async function updateFounderUniverseEvent(input: {
  action: "hide" | "restore" | "feature" | "setLead";
  id: string;
}) {
  const db = getAdminDb();
  const ref = db.collection("publicUniverseEvents").doc(input.id);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw Object.assign(new Error("That Universe event was not found."), { status: 404 });
  if (input.action === "hide") {
    await ref.set({ hidden: true, featured: false, homepageLead: false, moderatedAt: new Date().toISOString() }, { merge: true });
    return { hidden: true };
  }
  if (input.action === "restore") {
    await ref.set({ hidden: false, moderatedAt: new Date().toISOString() }, { merge: true });
    return { hidden: false };
  }
  if (input.action === "feature") {
    const featured = snapshot.data()?.featured !== true;
    await ref.set({ featured, featuredAt: featured ? new Date().toISOString() : null }, { merge: true });
    return { featured };
  }
  const leads = await db.collection("publicUniverseEvents").where("homepageLead", "==", true).get();
  const batch = db.batch();
  leads.docs.forEach((document) => batch.set(document.ref, { homepageLead: false }, { merge: true }));
  batch.set(ref, { homepageLead: true, featured: true, hidden: false, featuredAt: new Date().toISOString() }, { merge: true });
  await batch.commit();
  return { homepageLead: input.id };
}
