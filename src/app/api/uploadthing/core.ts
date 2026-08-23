import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import {
  createChatUploadSessionId,
  recordBoardSignalChatAttachmentUpload,
  resolveBoardSignalChatUploadActor,
  type BoardSignalChatUploadActor,
} from "@/lib/boardsignal/server/chatAttachments";
import { authorizePurePressUpload } from "@/lib/purepress/server/uploadAuthorization";
import {
  authorizeQuoteArtworkUpload,
  recordQuoteArtworkUpload,
} from "@/lib/purepress/server/quoteIntakeSessions";
import {
  isPurePressUploadCategory,
  validatePurePressUploadCandidate,
} from "@/lib/purepress/uploads";

const f = createUploadthing();

export const ourFileRouter = {
  // Legacy route retained because inherited non-PurePress screens still consume it.
  // New PurePress customer/admin code MUST use purePressUpload instead.
  fileUploader: f({
    image: { maxFileSize: "4MB" },
    pdf: { maxFileSize: "2GB" },
  }).onUploadComplete(async ({ file }) => {
    console.log("✅ Uploaded file:", file);
  }),

  purePressQuoteArtwork: f({
    image: { maxFileSize: "8MB", maxFileCount: 1, acl: "private" },
    pdf: { maxFileSize: "8MB", maxFileCount: 1, acl: "private" },
  }, { awaitServerData: true })
    .middleware(async ({ req, files }) => {
      try {
        if (files.length !== 1) throw new Error("PurePress accepts one quote artwork file per upload request.");
        const candidate = files[0];
        validatePurePressUploadCandidate("quote_artwork", {
          name: candidate.name,
          type: candidate.type,
          size: candidate.size,
        });
        const authorization = await authorizeQuoteArtworkUpload(req);
        return {
          intakeId: authorization.intakeId,
          scope: authorization.scope,
          expiresAt: authorization.expiresAt,
          originalName: candidate.name,
          mimeType: candidate.type,
          sizeBytes: candidate.size,
        };
      } catch (reason) {
        throw new UploadThingError(reason instanceof Error ? reason.message : "Quote artwork upload is not authorized.");
      }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const receipt = await recordQuoteArtworkUpload(
        { intakeId: metadata.intakeId, scope: "quote_artwork", expiresAt: metadata.expiresAt },
        { key: file.key, name: metadata.originalName, type: metadata.mimeType, size: metadata.sizeBytes },
      );
      return receipt;
    }),

  purePressUpload: f({
    blob: { maxFileSize: "16MB", maxFileCount: 1 },
  }, { awaitServerData: true })
    .middleware(async ({ req, files }) => {
      try {
        if (files.length !== 1) throw new Error("PurePress accepts one file per upload request.");
        const categoryHeader = req.headers.get("x-purepress-upload-category")?.trim() ?? "";
        if (!isPurePressUploadCategory(categoryHeader)) throw new Error("A valid PurePress upload category is required.");
        const jobId = req.headers.get("x-purepress-job-id")?.trim() ?? "";
        const candidate = files[0];
        validatePurePressUploadCandidate(categoryHeader, {
          name: candidate.name,
          type: candidate.type,
          size: candidate.size,
        });
        const actor = await authorizePurePressUpload(req, categoryHeader, jobId || undefined);
        return {
          category: categoryHeader,
          jobId,
          actorRole: actor.role,
          actorUid: actor.uid,
          customerId: actor.role === "customer" ? actor.customerId : "",
        };
      } catch (reason) {
        throw new UploadThingError(reason instanceof Error ? reason.message : "PurePress upload is not authorized.");
      }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // An upload receipt is private by default. Upload completion never creates
      // a PublicWorkMedia record or publishes customer/order media.
      return {
        category: metadata.category,
        jobId: metadata.jobId || null,
        actorRole: metadata.actorRole,
        fileKey: file.key,
        fileName: file.name,
        published: false,
      };
    }),

  boardSignalChatAttachment: f({
    image: { maxFileSize: "4MB", maxFileCount: 1 },
    pdf: { maxFileSize: "2GB", maxFileCount: 1 },
  }, { awaitServerData: true })
    .middleware(async ({ req, files }) => {
      try {
        if (files.length !== 1) throw new Error("BoardSignal messages accept one attachment at a time.");
        const candidate = files[0];
        if (String(candidate.type ?? "").toLowerCase() === "image/svg+xml") {
          throw new Error("SVG files are not supported as BoardSignal chat images.");
        }
        const actor = await resolveBoardSignalChatUploadActor(req);
        const uploadSessionId = createChatUploadSessionId();
        return {
          actorType: actor.actorType,
          actorIdentityKey: actor.identityKey,
          actorUid: actor.actorType === "player" ? actor.uid : "",
          actorPlayerId: actor.actorType === "player" ? actor.playerId : 0,
          uploadSessionId,
        };
      } catch (reason) {
        throw new UploadThingError(reason instanceof Error ? reason.message : "BoardSignal chat upload is not authorized.");
      }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const actor: BoardSignalChatUploadActor = metadata.actorType === "player"
        ? { actorType: "player", identityKey: metadata.actorIdentityKey, uid: metadata.actorUid, playerId: metadata.actorPlayerId }
        : { actorType: "founder", identityKey: "founder" };
      const receipt = await recordBoardSignalChatAttachmentUpload(actor, metadata.uploadSessionId, file);
      return { attachment: receipt.attachment, viewUrl: receipt.viewUrl };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
