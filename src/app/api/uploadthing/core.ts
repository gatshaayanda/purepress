import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import {
  createChatUploadSessionId,
  recordBoardSignalChatAttachmentUpload,
  resolveBoardSignalChatUploadActor,
  type BoardSignalChatUploadActor,
} from "@/lib/boardsignal/server/chatAttachments";

const f = createUploadthing();

export const ourFileRouter = {
  // Legacy route retained unchanged because non-BoardSignal ChatPanel still consumes it.
  fileUploader: f({
    image: { maxFileSize: "4MB" },
    pdf: { maxFileSize: "2GB" },
  }).onUploadComplete(async ({ file }) => {
    console.log("✅ Uploaded file:", file);
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
