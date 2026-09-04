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
    id: "production-floor-machine-wide",
    mediaType: "video",
    src: "/purepress/work/production/VID-20260903-WA0042.mp4",
    width: 368,
    height: 496,
    alt: "PurePress multi-head embroidery machines working on garments in the workshop.",
    caption: "The workshop in motion",
    category: "Production / Behind the Scenes",
    serviceType: "Machine embroidery",
    description: "A short workshop view with embroidery machines running on active garment work.",
    projectSlug: "inside-the-workshop",
    projectTitle: "Inside the Workshop",
    safePublic: true,
    published: true,
  },
  {
    id: "production-floor-full-process",
    mediaType: "video",
    src: "/purepress/work/production/VID-20260903-WA0049.mp4",
    width: 640,
    height: 360,
    alt: "PurePress operator preparing an orange garment and running it through the embroidery process.",
    caption: "From setup to machine embroidery",
    category: "Production / Behind the Scenes",
    serviceType: "Embroidery production",
    description: "A longer workshop sequence showing garment preparation, machine setup and embroidery production.",
    featured: true,
    projectSlug: "inside-the-workshop",
    projectTitle: "Inside the Workshop",
    safePublic: true,
    published: true,
  },
  {
    id: "production-floor-stitch-black",
    mediaType: "video",
    src: "/purepress/work/production/VID-20260903-WA0043.mp4",
    width: 360,
    height: 642,
    alt: "Close-up of an embroidery machine stitching lettering onto a dark garment.",
    caption: "Stitching in progress",
    category: "Production / Behind the Scenes",
    serviceType: "Machine embroidery",
    projectSlug: "inside-the-workshop",
    projectTitle: "Inside the Workshop",
    safePublic: true,
    published: true,
  },
  {
    id: "production-floor-stitch-blue",
    mediaType: "video",
    src: "/purepress/work/production/VID-20260903-WA0044.mp4",
    width: 368,
    height: 496,
    alt: "Close-up of a PurePress embroidery machine stitching a white logo onto blue fabric held in a hoop.",
    caption: "Logo embroidery in motion",
    category: "Production / Behind the Scenes",
    serviceType: "Machine embroidery",
    projectSlug: "inside-the-workshop",
    projectTitle: "Inside the Workshop",
    safePublic: true,
    published: true,
  },
  {
    id: "production-floor-radiation-therapist",
    mediaType: "image",
    src: "/purepress/work/production/IMG-20260903-WA0035.jpg",
    width: 810,
    height: 1080,
    alt: "Stack of green work garments branded with the words Radiation Therapist.",
    caption: "Named workwear batch",
    category: "Corporate Branding",
    serviceType: "Branded workwear",
    projectSlug: "inside-the-workshop",
    projectTitle: "Inside the Workshop",
    safePublic: true,
    published: true,
  },
  {
    id: "production-floor-school-knitwear",
    mediaType: "image",
    src: "/purepress/work/production/IMG-20260903-WA0036.jpg",
    width: 720,
    height: 960,
    alt: "School knitwear with embroidered Molefi Secondary School crests and yellow trim.",
    caption: "School crest embroidery",
    category: "School Embroidery",
    serviceType: "School uniform embroidery",
    projectSlug: "inside-the-workshop",
    projectTitle: "Inside the Workshop",
    safePublic: true,
    published: true,
  },
  {
    id: "production-floor-security-workwear",
    mediaType: "image",
    src: "/purepress/work/production/IMG-20260903-WA0037.jpg",
    width: 809,
    height: 1080,
    alt: "Dark safety workwear branded LSC Risk and Security Solutions with orange reflective trim.",
    caption: "Branded safety workwear",
    category: "Corporate Branding",
    serviceType: "Branded workwear",
    projectSlug: "inside-the-workshop",
    projectTitle: "Inside the Workshop",
    safePublic: true,
    published: true,
  },
  {
    id: "production-floor-white-logo-detail",
    mediaType: "image",
    src: "/purepress/work/production/IMG-20260903-WA0038.jpg",
    width: 810,
    height: 1080,
    alt: "Close-up of a black and blue embroidered emblem on white fabric.",
    caption: "Detailed logo embroidery",
    category: "Custom Embroidery",
    serviceType: "Logo embroidery",
    projectSlug: "inside-the-workshop",
    projectTitle: "Inside the Workshop",
    safePublic: true,
    published: true,
  },
  {
    id: "production-floor-orange-polos",
    mediaType: "image",
    src: "/purepress/work/production/IMG-20260903-WA0039.jpg",
    width: 720,
    height: 960,
    alt: "Finished orange polo shirts with a multicolour embroidered organisational crest.",
    caption: "Finished branded polos",
    category: "Corporate Branding",
    serviceType: "Polo embroidery",
    projectSlug: "inside-the-workshop",
    projectTitle: "Inside the Workshop",
    safePublic: true,
    published: true,
  },
  {
    id: "production-floor-coffin-badge",
    mediaType: "image",
    src: "/purepress/work/production/IMG-20260903-WA0040.jpg",
    width: 810,
    height: 1080,
    alt: "Close-up of a circular dark-and-gold embroidered badge with a coffin motif.",
    caption: "Dense custom badge detail",
    category: "Custom Embroidery",
    serviceType: "Custom badge embroidery",
    projectSlug: "inside-the-workshop",
    projectTitle: "Inside the Workshop",
    safePublic: true,
    published: true,
  },
  {
    id: "production-floor-irvines-polos",
    mediaType: "image",
    src: "/purepress/work/production/IMG-20260903-WA0041.jpg",
    width: 810,
    height: 1080,
    alt: "Stack of grey polo shirts embroidered with blue and yellow Irvines branding.",
    caption: "Branded polo batch",
    category: "Corporate Branding",
    serviceType: "Polo embroidery",
    projectSlug: "inside-the-workshop",
    projectTitle: "Inside the Workshop",
    safePublic: true,
    published: true,
  },
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
    slug: "inside-the-workshop",
    title: "Inside the Workshop",
    descriptor: "Embroidery in motion",
    tagline: "REAL WORK. REAL GARMENTS. REAL STITCHES.",
    summary:
      "Step inside PurePress: machines running, garments being prepared and branding taking shape stitch by stitch before the finished pieces leave the floor.",
    serviceLabels: [
      "MACHINE EMBROIDERY",
      "BRANDED WORKWEAR",
      "SCHOOL + TEAM KIT",
    ],
  },
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
