import { generateReactHelpers } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";

// ✅ Only these 2 are valid and available:
export const {
  uploadFiles,
  useUploadThing,
} = generateReactHelpers<OurFileRouter>();
