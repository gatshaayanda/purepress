import type { BoardSignalChatAttachment, BoardSignalChatAttachmentView } from "./chatAttachments";

export type BoardSignalFriendMessage = {
  id: string;
  threadId: string;
  senderUid: string;
  senderPlayerId: number;
  recipientUid: string;
  recipientPlayerId: number;
  body: string;
  createdAt: string;
  attachment?: BoardSignalChatAttachment;
};

export type BoardSignalFriendMessageView = Omit<BoardSignalFriendMessage, "attachment"> & {
  attachment?: BoardSignalChatAttachmentView;
};

export type BoardSignalFriendConversationView = {
  thread: {
    id: string;
    participantUids: [string, string];
    participantPlayerIds: [number, number];
  };
  friend: {
    uid: string;
    playerId: number;
    canonicalUsername: string;
  };
  messages: BoardSignalFriendMessageView[];
};
