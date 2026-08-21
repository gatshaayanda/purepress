import type { JobFileCategory } from "./domain";

export type PurePressUploadRole = "customer" | "admin";

export interface PurePressUploadPolicy {
  category: JobFileCategory;
  maxBytes: number;
  extensions: readonly string[];
  mimeTypes: readonly string[];
  roles: readonly PurePressUploadRole[];
  requiresJob: boolean;
  customerVisibleByDefault: boolean;
  publicByDefault: false;
}

const MB = 1024 * 1024;
const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
const PDF_MIME = "application/pdf";

export const PUREPRESS_UPLOAD_POLICIES: Record<JobFileCategory, PurePressUploadPolicy> = {
  quote_artwork: {
    category: "quote_artwork",
    maxBytes: 16 * MB,
    extensions: [".jpg", ".jpeg", ".png", ".webp", ".pdf", ".ai", ".eps"],
    mimeTypes: [...IMAGE_MIMES, PDF_MIME, "application/postscript", "application/octet-stream"],
    roles: ["customer", "admin"],
    requiresJob: false,
    customerVisibleByDefault: true,
    publicByDefault: false,
  },
  customer_artwork: {
    category: "customer_artwork",
    maxBytes: 16 * MB,
    extensions: [".jpg", ".jpeg", ".png", ".webp", ".pdf", ".ai", ".eps", ".dst", ".pes"],
    mimeTypes: [...IMAGE_MIMES, PDF_MIME, "application/postscript", "application/octet-stream"],
    roles: ["customer", "admin"],
    requiresJob: true,
    customerVisibleByDefault: true,
    publicByDefault: false,
  },
  proof: {
    category: "proof",
    maxBytes: 12 * MB,
    extensions: [".jpg", ".jpeg", ".png", ".webp", ".pdf"],
    mimeTypes: [...IMAGE_MIMES, PDF_MIME],
    roles: ["admin"],
    requiresJob: true,
    customerVisibleByDefault: true,
    publicByDefault: false,
  },
  order_document: {
    category: "order_document",
    maxBytes: 12 * MB,
    extensions: [".jpg", ".jpeg", ".png", ".webp", ".pdf", ".docx"],
    mimeTypes: [...IMAGE_MIMES, PDF_MIME, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    roles: ["customer", "admin"],
    requiresJob: true,
    customerVisibleByDefault: true,
    publicByDefault: false,
  },
  order_message_attachment: {
    category: "order_message_attachment",
    maxBytes: 8 * MB,
    extensions: [".jpg", ".jpeg", ".png", ".webp", ".pdf"],
    mimeTypes: [...IMAGE_MIMES, PDF_MIME],
    roles: ["customer", "admin"],
    requiresJob: true,
    customerVisibleByDefault: true,
    publicByDefault: false,
  },
  completion_media: {
    category: "completion_media",
    maxBytes: 8 * MB,
    extensions: [".jpg", ".jpeg", ".png", ".webp"],
    mimeTypes: [...IMAGE_MIMES],
    roles: ["admin"],
    requiresJob: true,
    customerVisibleByDefault: true,
    publicByDefault: false,
  },
  public_gallery_candidate: {
    category: "public_gallery_candidate",
    maxBytes: 8 * MB,
    extensions: [".jpg", ".jpeg", ".png", ".webp"],
    mimeTypes: [...IMAGE_MIMES],
    roles: ["admin"],
    requiresJob: true,
    customerVisibleByDefault: false,
    publicByDefault: false,
  },
};

export function isPurePressUploadCategory(value: string): value is JobFileCategory {
  return value in PUREPRESS_UPLOAD_POLICIES;
}

export function validatePurePressUploadCandidate(
  category: JobFileCategory,
  file: { name: string; type?: string | null; size: number }
) {
  const policy = PUREPRESS_UPLOAD_POLICIES[category];
  if (file.size <= 0 || file.size > policy.maxBytes) {
    throw new Error(`${category} exceeds the ${Math.floor(policy.maxBytes / MB)}MB PurePress limit.`);
  }
  const lowerName = file.name.toLowerCase();
  const extensionAllowed = policy.extensions.some((extension) => lowerName.endsWith(extension));
  const mime = String(file.type ?? "").toLowerCase();
  const mimeAllowed = Boolean(mime) && policy.mimeTypes.includes(mime);
  if (!extensionAllowed || !mimeAllowed) {
    throw new Error(`${file.name} is not an allowed ${category} file type.`);
  }
  return policy;
}
