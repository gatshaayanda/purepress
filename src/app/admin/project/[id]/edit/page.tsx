"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, FormEvent } from "react";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import {
  ArrowLeft,
  ClipboardList,
  ExternalLink,
  FileUp,
  FolderKanban,
  Loader2,
  Pencil,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

import { firestore } from "@/utils/firebaseConfig";
import { uploadFiles } from "@/utils/uploadthing";
import AdminHubLoader from "@/components/AdminHubLoader";

export default function EditProjectPage() {
  const router = useRouter();
  const params = useParams() as { id?: string };
  const id = params.id!;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const [file, setFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    client_name: "",
    client_email: "",
    client_phone: "",
    client_type: "individual",
    business_name: "",
    city_town: "",
    request_type: "quote",
    cover_type: "",
    product_interest: "",
    industry: "",
    current_insurer: "",
    policy_number: "",
    risk_items: "",
    support_summary: "",
    required_documents: "",
    portal_access: false,
    status: "new inquiry",
    admin_notes: "",
    progress_update: "",
    resource_link: "",
    documentUrl: "",
    documentName: "",
    documentType: "",
  });

  useEffect(() => {
    if (!id) {
      router.replace("/admin/project");
      return;
    }

    (async () => {
      try {
        const snap = await getDoc(doc(firestore, "projects", id));
        if (!snap.exists()) throw new Error("Client case not found.");

        const data = snap.data() as Record<string, any>;

        setForm({
          client_name: data.client_name || "",
          client_email: data.client_email || "",
          client_phone: data.client_phone || "",
          client_type: data.client_type || "individual",
          business_name: data.business_name || data.business || "",
          city_town: data.city_town || data.city || "",
          request_type: data.request_type || "quote",
          cover_type: data.cover_type || "",
          product_interest: data.product_interest || "",
          industry: data.industry || "",
          current_insurer: data.current_insurer || "",
          policy_number: data.policy_number || "",
          risk_items: data.risk_items || "",
          support_summary: data.support_summary || "",
          required_documents: data.required_documents || "",
          portal_access: !!(data.portal_access || data.admin_panel),
          status: data.status || "new inquiry",
          admin_notes: data.admin_notes || "",
          progress_update: data.progress_update || "",
          resource_link: data.resource_link || "",
          documentUrl: data.documentUrl || "",
          documentName: data.documentName || "",
          documentType: data.documentType || "",
        });
      } catch (e: any) {
        setError(e?.message || "Failed to load client case.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  const handleChange = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleRemoveDocument = () => {
    setFile(null);
    setForm((prev) => ({
      ...prev,
      documentUrl: "",
      documentName: "",
      documentType: "",
    }));
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      let documentUrl = form.documentUrl;
      let documentName = form.documentName;
      let documentType = form.documentType;

      if (file) {
        const uploaded = await uploadFiles("fileUploader" as any, {
          files: [file],
        });

        documentUrl = uploaded?.[0]?.url || "";
        documentName = file.name;
        documentType = file.type;

        if (!documentUrl) {
          throw new Error("File uploaded, but no file URL was returned.");
        }
      }

      await updateDoc(doc(firestore, "projects", id), {
        client_name: form.client_name.trim(),
        client_email: form.client_email.trim(),
        client_phone: form.client_phone.trim(),
        client_type: form.client_type,
        business_name: form.business_name.trim(),
        business: form.business_name.trim(),
        city_town: form.city_town.trim(),
        request_type: form.request_type,
        cover_type: form.cover_type,
        product_interest: form.product_interest.trim(),
        industry: form.industry.trim(),
        current_insurer: form.current_insurer.trim(),
        policy_number: form.policy_number.trim(),
        risk_items: form.risk_items.trim(),
        support_summary: form.support_summary.trim(),
        required_documents: form.required_documents.trim(),
        portal_access: form.portal_access,
        admin_panel: form.portal_access,
        status: form.status,
        admin_notes: form.admin_notes.trim(),
        progress_update: form.progress_update.trim(),
        resource_link: form.resource_link.trim(),

        documentUrl,
        documentName,
        documentType,

        admin_id: "admin",
        updatedAt: serverTimestamp(),
      });

      router.push("/admin/project");
    } catch (e: any) {
      setError(e?.message || "Failed to update client case.");
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = window.confirm("Are you sure you want to delete this client case?");
    if (!ok) return;

    setError("");
    setDeleting(true);

    try {
      const res = await fetch(`/api/project/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({
          error: "Delete failed",
        }));
        throw new Error(msg || "Delete failed");
      }

      router.push("/admin/project");
    } catch (e: any) {
      setError(e?.message || "Failed to delete client case.");
      setDeleting(false);
    }
  };

  if (loading) return <AdminHubLoader />;

  const hasSavedDocument = !!form.documentUrl;
  const selectedFileName = file?.name || form.documentName || "Attached file";

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="section-shell">
        <div className="container">
          <div className="mx-auto max-w-5xl">
            <div className="mb-5">
              <Link
                href="/admin/project"
                prefetch={false}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand-primary-strong)] transition hover:opacity-80"
              >
                <ArrowLeft size={16} />
                Back to Client Cases
              </Link>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="card-elevated overflow-hidden">
                <div className="bg-[linear-gradient(180deg,#fffefb_0%,#f7f1e4_100%)] p-6 md:p-10">
                  <div className="eyebrow">
                    <Pencil size={15} />
                    Sparkle Legacy • Edit Client Case
                  </div>

                  <h1 className="max-w-[13ch]">
                    Update this insurance servicing record.
                  </h1>

                  <p className="mt-4 max-w-[62ch] text-base leading-8 text-[var(--text-secondary)]">
                    Edit the client details, request type, cover information,
                    servicing notes, uploaded files, and progress update while
                    keeping the record operational and client-safe.
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4">
                      <p className="text-sm font-extrabold text-[var(--text-primary)]">
                        Client-facing field
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                        The progress update may be shown to the client later, so
                        keep it clear, calm, and professional.
                      </p>
                    </div>

                    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4">
                      <p className="text-sm font-extrabold text-[var(--text-primary)]">
                        File support
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                        PDFs and images can be uploaded through UploadThing and
                        saved directly to this case.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card-outline-gold self-start">
                <div className="card-inner md:p-8">
                  <div className="eyebrow mb-0">
                    <ShieldCheck size={15} />
                    Edit checklist
                  </div>

                  <h2 className="mt-2 text-2xl">Before saving</h2>

                  <ul className="mt-5 space-y-3">
                    {[
                      "Keep the client email and phone accurate.",
                      "Make sure the request type and cover type are correct.",
                      "Update required documents based on the actual case.",
                      "Attach the latest supporting PDF or image where needed.",
                      "Keep progress updates concise and client-safe.",
                    ].map((item) => (
                      <li
                        key={item}
                        className="flex gap-2 text-sm leading-7 text-[var(--text-secondary)]"
                      >
                        <FolderKanban
                          size={16}
                          className="mt-[5px] shrink-0 text-[var(--brand-primary-strong)]"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  {error ? (
                    <div className="mt-6 rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <section className="mt-8">
              <form onSubmit={handleUpdate} className="card-outline-gold">
                <div className="card-inner space-y-5 md:p-8">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field
                      label="Client Name"
                      value={form.client_name}
                      onChange={(v) => handleChange("client_name", v)}
                      required
                      placeholder="Client Name"
                    />

                    <Field
                      label="Client Email"
                      type="email"
                      value={form.client_email}
                      onChange={(v) => handleChange("client_email", v)}
                      required
                      placeholder="Client Email"
                    />

                    <Field
                      label="Client Phone"
                      value={form.client_phone}
                      onChange={(v) => handleChange("client_phone", v)}
                      placeholder="Client Phone"
                    />

                    <div>
                      <label className="text-sm font-semibold text-[var(--text-primary)]">
                        Client Type
                      </label>
                      <select
                        value={form.client_type}
                        onChange={(e) => handleChange("client_type", e.target.value)}
                        className="input mt-2"
                      >
                        <option value="individual">Individual</option>
                        <option value="business">Business</option>
                      </select>
                    </div>

                    <Field
                      label="Business Name"
                      value={form.business_name}
                      onChange={(v) => handleChange("business_name", v)}
                      placeholder="Business Name (if applicable)"
                    />

                    <Field
                      label="City / Town"
                      value={form.city_town}
                      onChange={(v) => handleChange("city_town", v)}
                      placeholder="City / Town"
                    />

                    <div>
                      <label className="text-sm font-semibold text-[var(--text-primary)]">
                        Request Type
                      </label>
                      <select
                        value={form.request_type}
                        onChange={(e) => handleChange("request_type", e.target.value)}
                        className="input mt-2"
                      >
                        <option value="quote">Quote Request</option>
                        <option value="claim">Claim Support</option>
                        <option value="policy-service">Policy Servicing</option>
                        <option value="renewal">Renewal / Review</option>
                        <option value="general-support">General Support</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-[var(--text-primary)]">
                        Cover Type
                      </label>
                      <select
                        value={form.cover_type}
                        onChange={(e) => handleChange("cover_type", e.target.value)}
                        className="input mt-2"
                      >
                        <option value="">Select Cover Type</option>
                        <option value="short-term">Short-Term</option>
                        <option value="long-term">Long-Term</option>
                        <option value="business">Business / SME</option>
                        <option value="retirement">Retirement / Planning</option>
                      </select>
                    </div>
                  </div>

                  <Field
                    label="Product / Policy Interest"
                    value={form.product_interest}
                    onChange={(v) => handleChange("product_interest", v)}
                    placeholder="Motor, Home, Funeral, Life, Liability, Crop, etc."
                  />

                  <Field
                    label="Industry"
                    value={form.industry}
                    onChange={(v) => handleChange("industry", v)}
                    placeholder="Industry (if business case)"
                  />

                  <Field
                    label="Current Insurer"
                    value={form.current_insurer}
                    onChange={(v) => handleChange("current_insurer", v)}
                    placeholder="Current insurer (optional)"
                  />

                  <Field
                    label="Policy Number"
                    value={form.policy_number}
                    onChange={(v) => handleChange("policy_number", v)}
                    placeholder="Policy number (if applicable)"
                  />

                  <TextAreaField
                    label="Risk Items / What Needs Cover"
                    value={form.risk_items}
                    onChange={(v) => handleChange("risk_items", v)}
                    placeholder="Vehicle, home, stock, staff, family cover, funeral members, etc."
                  />

                  <TextAreaField
                    label="Support Summary"
                    value={form.support_summary}
                    onChange={(v) => handleChange("support_summary", v)}
                    placeholder="What does the client need help with?"
                  />

                  <TextAreaField
                    label="Required Documents"
                    value={form.required_documents}
                    onChange={(v) => handleChange("required_documents", v)}
                    placeholder="ID, Omang, photos, quotes, claim forms, police report, etc."
                  />

                  <div>
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                      <FileUp size={16} />
                      Case File
                      <span className="font-normal text-[var(--text-muted)]">
                        (optional PDF/image)
                      </span>
                    </label>

                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="input mt-2"
                    />

                    <p className="mt-2 text-xs leading-6 text-[var(--text-muted)]">
                      Upload a new file to replace the current saved file. Remove
                      the file if the case should not keep an attachment.
                    </p>

                    {file || hasSavedDocument ? (
                      <div className="mt-3 rounded-[1rem] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate text-sm text-[var(--text-secondary)]">
                            {selectedFileName}
                          </span>

                          <button
                            type="button"
                            onClick={handleRemoveDocument}
                            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                          >
                            <X size={14} />
                            Remove
                          </button>
                        </div>

                        {hasSavedDocument && !file ? (
                          <a
                            href={form.documentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[var(--brand-primary-strong)] transition hover:opacity-80"
                          >
                            <ExternalLink size={15} />
                            Open saved file
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <Field
                    label="Shared Resource Link"
                    value={form.resource_link}
                    onChange={(v) => handleChange("resource_link", v)}
                    placeholder="Google Docs / Sheets / File Link (optional)"
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-semibold text-[var(--text-primary)]">
                        Status
                      </label>
                      <select
                        value={form.status}
                        onChange={(e) => handleChange("status", e.target.value)}
                        className="input mt-2"
                      >
                        <option value="new inquiry">New Inquiry</option>
                        <option value="documents pending">Documents Pending</option>
                        <option value="quote in progress">Quote In Progress</option>
                        <option value="submitted to insurer">Submitted to Insurer</option>
                        <option value="policy active">Policy Active</option>
                        <option value="claim in progress">Claim In Progress</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>

                    <label className="flex items-center gap-3 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] self-end">
                      <input
                        type="checkbox"
                        checked={form.portal_access}
                        onChange={(e) =>
                          handleChange("portal_access", e.target.checked)
                        }
                      />
                      Client should have portal access
                    </label>
                  </div>

                  <TextAreaField
                    label="Admin Notes (internal only)"
                    value={form.admin_notes}
                    onChange={(v) => handleChange("admin_notes", v)}
                    placeholder="Internal servicing notes"
                  />

                  <TextAreaField
                    label="Progress Update"
                    value={form.progress_update}
                    onChange={(v) => handleChange("progress_update", v)}
                    placeholder="Client-facing progress update"
                  />

                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <button
                      type="submit"
                      disabled={saving || deleting}
                      className="btn btn-primary"
                    >
                      {saving ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Pencil size={18} />
                      )}
                      {saving ? "Updating..." : "Update Client Case"}
                    </button>

                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={saving || deleting}
                      className="btn btn-outline"
                    >
                      {deleting ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Trash2 size={18} />
                      )}
                      {deleting ? "Deleting..." : "Delete"}
                    </button>

                    <button
                      type="button"
                      onClick={() => router.push("/admin/project")}
                      className="btn btn-ghost"
                      disabled={saving || deleting}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            </section>

            <div className="mt-8 frame-gold p-5 text-sm leading-7 text-[var(--text-secondary)]">
              <b className="text-[var(--text-primary)]">Admin note:</b> this
              page updates a real insurance client case, not a generic web
              project record.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-[var(--text-primary)]">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="input mt-2"
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-[var(--text-primary)]">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input mt-2 min-h-[110px] resize-y rounded-[1.25rem]"
      />
    </div>
  );
}