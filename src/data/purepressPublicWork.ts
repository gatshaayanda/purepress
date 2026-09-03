export type PurePressWorkCategory =
  | "Corporate Branding"
  | "School Embroidery"
  | "Team & Sportswear"
  | "Gifts & Promotional Items"
  | "Custom Embroidery"
  | "Production / Behind the Scenes"
  | "Custom Apparel";

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
  projectSlug?: string;
  projectTitle?: string;
  safePublic: boolean;
  published: boolean;
};

export type PurePressPublicWorkProject = {
  slug: string;
  title: string;
  descriptor: string;
  tagline?: string;
  summary: string;
  serviceLabels: readonly string[];
};

export type PublishedPurePressWorkProject = PurePressPublicWorkProject & {
  media: readonly PurePressPublicWorkMedia[];
};

export const PUREPRESS_PUBLIC_WORK_ROOT = "/purepress/work/";

// Only deliberately selected PurePress marketing media belongs in this list.
// Private customer artwork, proofs and order uploads are never sourced from here.
export const PUREPRESS_PUBLIC_WORK_MEDIA: readonly PurePressPublicWorkMedia[] = [
  {
    id: "undead-clowns-1126-lifestyle-night",
    mediaType: "image",
    src: "/purepress/work/undead-clowns/517249943_122243173868236996_5137224945184354231_n.jpg",
    width: 1072,
    height: 1080,
    alt: "Person wearing a black Undead Clowns T-shirt with neon-green 11:26 artwork.",
    caption: "11:26 front artwork",
    category: "Custom Apparel",
    serviceType: "T-shirt printing",
    projectSlug: "undead-clowns",
    projectTitle: "Undead Clowns",
    featured: true,
    safePublic: true,
    published: true,
  },
  {
    id: "undead-clowns-1126-front-doorway",
    mediaType: "image",
    src: "/purepress/work/undead-clowns/480664801_122206920278236996_7564913933503809481_n.jpg",
    width: 810,
    height: 1080,
    alt: "Person wearing a black Undead Clowns T-shirt with neon-green 11:26 front artwork.",
    caption: "Finished black T-shirt",
    category: "Custom Apparel",
    serviceType: "T-shirt printing",
    projectSlug: "undead-clowns",
    projectTitle: "Undead Clowns",
    safePublic: true,
    published: true,
  },
  {
    id: "undead-clowns-white-shirt-colourways",
    mediaType: "image",
    src: "/purepress/work/undead-clowns/481073524_122207278370236996_6576208299597570553_n.jpg",
    width: 960,
    height: 1280,
    alt: "Two people wearing white Undead Clowns T-shirts with different front graphics.",
    caption: "Alternative white T-shirt graphics",
    category: "Custom Apparel",
    serviceType: "T-shirt printing",
    projectSlug: "undead-clowns",
    projectTitle: "Undead Clowns",
    safePublic: true,
    published: true,
  },
  {
    id: "undead-clowns-black-shirt-back",
    mediaType: "image",
    src: "/purepress/work/undead-clowns/481101057_122206920212236996_5790004406237105420_n.jpg",
    width: 810,
    height: 1080,
    alt: "Back view of a black Undead Clowns T-shirt with a large green and white graphic.",
    caption: "Back artwork",
    category: "Custom Apparel",
    serviceType: "T-shirt printing",
    projectSlug: "undead-clowns",
    projectTitle: "Undead Clowns",
    safePublic: true,
    published: true,
  },
  {
    id: "undead-clowns-packaged-1126",
    mediaType: "image",
    src: "/purepress/work/undead-clowns/476368462_122203937420236996_4069152081315385529_n.jpg",
    width: 720,
    height: 1280,
    alt: "Packaged black Undead Clowns T-shirts showing 11:26 artwork in white and neon green.",
    caption: "Packaged finished garments",
    category: "Custom Apparel",
    serviceType: "T-shirt printing",
    projectSlug: "undead-clowns",
    projectTitle: "Undead Clowns",
    safePublic: true,
    published: true,
  },
  {
    id: "undead-clowns-love-front-back-mockup",
    mediaType: "image",
    src: "/purepress/work/undead-clowns/484052776_122214518552236996_1028290599553373740_n.jpg",
    width: 1010,
    height: 1600,
    alt: "Front and back mockup of a white Undead Clowns T-shirt with red, black and white love-themed artwork.",
    caption: "Front-and-back artwork view",
    category: "Custom Apparel",
    serviceType: "T-shirt printing",
    projectSlug: "undead-clowns",
    projectTitle: "Undead Clowns",
    safePublic: true,
    published: true,
  },
  {
    id: "undead-clowns-love-lifestyle-doorway",
    mediaType: "image",
    src: "/purepress/work/undead-clowns/484018037_122214518516236996_3818219106123181917_n.jpg",
    width: 960,
    height: 1280,
    alt: "Person wearing a white Undead Clowns T-shirt with red and black front artwork.",
    caption: "White T-shirt front artwork",
    category: "Custom Apparel",
    serviceType: "T-shirt printing",
    projectSlug: "undead-clowns",
    projectTitle: "Undead Clowns",
    safePublic: true,
    published: true,
  },
  {
    id: "undead-clowns-love-lifestyle-seated",
    mediaType: "image",
    src: "/purepress/work/undead-clowns/486331889_122216996420236996_6831188377772918574_n.jpg",
    width: 960,
    height: 1280,
    alt: "Person seated outdoors wearing a white Undead Clowns T-shirt with red and black artwork.",
    caption: "Finished garment in wear",
    category: "Custom Apparel",
    serviceType: "T-shirt printing",
    projectSlug: "undead-clowns",
    projectTitle: "Undead Clowns",
    safePublic: true,
    published: true,
  },
];

export const PUREPRESS_PUBLIC_WORK_PROJECTS: readonly PurePressPublicWorkProject[] = [
  {
    slug: "undead-clowns",
    title: "Undead Clowns",
    descriptor: "Custom apparel",
    tagline: "FASHION FORWARD, ALWAYS.",
    summary:
      "A selection of branded T-shirts produced for Undead Clowns, shown across finished garments, lifestyle photography and front-and-back artwork.",
    serviceLabels: [
      "CUSTOM APPAREL",
      "T-SHIRT PRINTING",
      "FRONT + BACK ARTWORK",
    ],
  },
];

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

export function getPublishedPurePressWorkProjects(): PublishedPurePressWorkProject[] {
  const publishedMedia = getPublishedPurePressWorkMedia();

  return PUREPRESS_PUBLIC_WORK_PROJECTS.map((project) => ({
    ...project,
    media: publishedMedia.filter((item) => item.projectSlug === project.slug),
  })).filter((project) => project.media.length > 0);
}
