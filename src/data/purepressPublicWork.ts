export type PurePressWorkCategory =
  | "Corporate Branding"
  | "School Embroidery"
  | "Team & Sportswear"
  | "Gifts & Promotional Items"
  | "Custom Embroidery"
  | "Production / Behind the Scenes";

export type PurePressPublicWorkMedia = {
  id: string;
  mediaType: "image" | "video";
  src: string;
  width: number;
  height: number;
  alt: string;
  caption?: string;
  category: PurePressWorkCategory;
  serviceType: string;
  description?: string;
  featured?: boolean;
  poster?: string;
  safePublic: boolean;
  published: boolean;
};

export const PUREPRESS_PUBLIC_WORK_ROOT = "/purepress/work/";

// Only deliberately selected PurePress marketing media belongs in this list.
// Private customer artwork, proofs and order uploads are never sourced from here.
export const PUREPRESS_PUBLIC_WORK_MEDIA: readonly PurePressPublicWorkMedia[] = [];

export function getPublishedPurePressWorkMedia() {
  return PUREPRESS_PUBLIC_WORK_MEDIA.filter(
    (item) =>
      item.safePublic === true &&
      item.published === true &&
      item.src.startsWith(PUREPRESS_PUBLIC_WORK_ROOT) &&
      (item.poster === undefined ||
        item.poster.startsWith(PUREPRESS_PUBLIC_WORK_ROOT)),
  );
}
