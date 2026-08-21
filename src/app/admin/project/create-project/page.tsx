"use client";

import Link from "next/link";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import {
  ArrowLeft,
  FileUp,
  FolderPlus,
  Loader2,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

import { firestore } from "@/utils/firebaseConfig";
import { uploadFiles } from "@/utils/uploadthing";

export default function CreateProjectPage() {
  const router = useRouter();

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
  });

  const [initialFile, setInitialFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChange = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const clearForm = () => {
    setForm({
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
    });

    setInitialFile(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage("");
    setSuccess(false);
    setSaving(true);

    try {
      let uploadedFileUrl = "";
      let uploadedFileName = "";
      let uploadedFileType = "";

      if (initialFile) {
        const uploaded = await uploadFiles("fileUploader" as any, {
          files: [initialFile],
        });

        uploadedFileUrl = uploaded?.[0]?.url || "";
        uploadedFileName = initialFile.name;
        uploadedFileType = initialFile.type;

        if (!uploadedFileUrl) {
          throw new Error("File uploaded, but no file URL was returned.");
        }
      }

const newCaseRef = await addDoc(collection(firestore, "projects"), {
  ...form,

  // Compatibility with older project/client pages
  business: form.business_name,
  admin_panel: form.portal_access,

  // Uploaded document support
  documentUrl: uploadedFileUrl,
  documentName: uploadedFileName,
  documentType: uploadedFileType,

  // Admin ownership/security-rule compatibility
  admin_id: "admin",

  // Timestamp compatibility
  created_at: serverTimestamp(),
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

setMessage("Client case created successfully.");
setSuccess(true);
clearForm();

router.push(`/admin/project/${newCaseRef.id}`);
    } catch (err: any) {
      setMessage(`Error: ${err?.message || "Failed to create client case."}`);
      setSuccess(false);
      setSaving(false);
    }
  };

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
                    <FolderPlus size={15} />
                    Sparkle Legacy • New Client Case
                  </div>

                  <h1 className="max-w-[13ch]">
                    Create a new insurance client servicing record.
                  </h1>

                  <p className="mt-4 max-w-[62ch] text-base leading-8 text-[var(--text-secondary)]">
                    Use this form to capture a real insurance inquiry, quote
                    request, policy servicing matter, or claim support case for
                    Sparkle Legacy.
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4">
                      <p className="text-sm font-extrabold text-[var(--text-primary)]">
                        Best use
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                        Create one clean record per client case so follow-up,
                        document tracking, and servicing status stay organized.
                      </p>
                    </div>

                    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white/80 p-4">
                      <p className="text-sm font-extrabold text-[var(--text-primary)]">
                        Client-facing note
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                        The progress update may be shown to the client later, so
                        keep it clear, calm, and professional.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card-outline-gold self-start">
                <div className="card-inner md:p-8">
                  <div className="eyebrow mb-0">
                    <ShieldCheck size={15} />
                    Intake reminder
                  </div>

                  <h2 className="mt-2 text-2xl">Before creating</h2>

                  <ul className="mt-5 space-y-3">
                    {[
                      "Make sure the client email and phone are correct.",
                      "Capture whether this is a quote, claim, or servicing request.",
                      "Use cover type and product fields clearly.",
                      "Upload supporting PDFs/images where available.",
                      "Keep internal notes separate from client-facing progress updates.",
                    ].map((item) => (
                      <li
                        key={item}
                        className="flex gap-2 text-sm leading-7 text-[var(--text-secondary)]"
                      >
                        <Sparkles
                          size={16}
                          className="mt-[5px] shrink-0 text-[var(--brand-primary-strong)]"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <section className="mt-8">
              <form onSubmit={handleSubmit} className="card-outline-gold">
                <div className="card-inner space-y-5 md:p-8">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field
                      label="Client Full Name"
                      value={form.client_name}
                      onChange={(v) => handleChange("client_name", v)}
                      required
                      placeholder="Client Full Name"
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
                        onChange={(e) =>
                          handleChange("client_type", e.target.value)
                        }
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
                        onChange={(e) =>
                          handleChange("request_type", e.target.value)
                        }
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
                        onChange={(e) =>
                          handleChange("cover_type", e.target.value)
                        }
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
                      Initial Case File
                      <span className="font-normal text-[var(--text-muted)]">
                        (optional PDF/image)
                      </span>
                    </label>

                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) =>
                        setInitialFile(e.target.files?.[0] || null)
                      }
                      className="input mt-2"
                    />

                    <p className="mt-2 text-xs leading-6 text-[var(--text-muted)]">
                      Upload a supporting PDF or image if the client already
                      sent one. The file URL will be saved with the case.
                    </p>

                    {initialFile ? (
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-[1rem] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                        <span className="min-w-0 truncate text-sm text-[var(--text-secondary)]">
                          {initialFile.name}
                        </span>

                        <button
                          type="button"
                          onClick={() => setInitialFile(null)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                        >
                          <X size={14} />
                          Remove
                        </button>
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
                        <option value="submitted to insurer">
                          Submitted to Insurer
                        </option>
                        <option value="policy active">Policy Active</option>
                        <option value="claim in progress">
                          Claim In Progress
                        </option>
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
                    label="Admin Notes (Internal Only)"
                    value={form.admin_notes}
                    onChange={(v) => handleChange("admin_notes", v)}
                    placeholder="Internal servicing notes"
                  />

                  <TextAreaField
                    label="Progress Update (Client will see this)"
                    value={form.progress_update}
                    onChange={(v) => handleChange("progress_update", v)}
                    placeholder="Client-facing update"
                  />

                  {message ? (
                    <div
                      className={`rounded-[1rem] px-4 py-3 text-sm ${
                        success
                          ? "border border-green-200 bg-green-50 text-green-700"
                          : "border border-red-200 bg-red-50 text-red-700"
                      }`}
                    >
                      {message}
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="submit"
                      disabled={saving}
                      className="btn btn-primary"
                    >
                      {saving ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <FolderPlus size={18} />
                      )}
                      {saving ? "Submitting..." : "Create Client Case"}
                    </button>

                    <button
                      type="button"
                      onClick={() => router.back()}
                      className="btn btn-outline"
                      disabled={saving}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            </section>
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
        className="input mt-2 min-h-[120px] resize-y rounded-[1.25rem]"
      />
    </div>
  );
}