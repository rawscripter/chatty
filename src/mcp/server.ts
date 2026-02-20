#!/usr/bin/env node

/*
  Chatty MCP (local stdio)

  Run:
    npm install
    CHATTY_MCP_USER_ID=<mongoUserId> npm run mcp:chatty

  This MCP server talks directly to Chatty's MongoDB via existing models.
  It does NOT trigger Pusher events or send push notifications.
*/

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import dbConnect from "@/lib/db";
import Chat from "@/models/chat";
import Message from "@/models/message";
import User from "@/models/user";

function requireUserId(explicit?: string) {
  const userId = explicit || process.env.CHATTY_MCP_USER_ID;
  if (!userId) {
    throw new Error(
      "Missing userId. Pass userId in the tool args or set CHATTY_MCP_USER_ID env var."
    );
  }
  return String(userId);
}

async function unreadTotalForUser(userId: string) {
  const chats = await Chat.find({ participants: userId }).select("_id").lean();
  const ids = chats.map((c: any) => c._id);
  if (ids.length === 0) return 0;

  return Message.countDocuments({
    chat: { $in: ids },
    sender: { $ne: userId },
    "readBy.user": { $ne: userId },
  });
}

const server = new Server(
  { name: "chatty-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_chats",
        description: "List chats for a user (most recently updated first).",
        inputSchema: {
          type: "object",
          properties: {
            userId: { type: "string", description: "MongoDB user id (optional if CHATTY_MCP_USER_ID is set)." },
            limit: { type: "number", default: 50 },
          },
        },
      },
      {
        name: "search_users",
        description: "Search users by name/email (case-insensitive substring).",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            limit: { type: "number", default: 20 },
          },
          required: ["query"],
        },
      },
      {
        name: "create_chat",
        description: "Create a direct or group chat.",
        inputSchema: {
          type: "object",
          properties: {
            userId: { type: "string", description: "Creator user id (optional if CHATTY_MCP_USER_ID is set)." },
            type: { type: "string", enum: ["direct", "group"], default: "direct" },
            participantIds: { type: "array", items: { type: "string" } },
            name: { type: "string", description: "Group name (required for group)." },
            password: { type: "string", description: "Optional password for protected chat." },
          },
          required: ["participantIds"],
        },
      },
      {
        name: "get_messages",
        description: "Get latest messages in a chat (newest last).",
        inputSchema: {
          type: "object",
          properties: {
            chatId: { type: "string" },
            limit: { type: "number", default: 50 },
            before: { type: "string", description: "ISO date string; return messages created before this (optional)." },
          },
          required: ["chatId"],
        },
      },
      {
        name: "send_message",
        description: "Send a message in a chat (DB write only; does not trigger realtime/push).",
        inputSchema: {
          type: "object",
          properties: {
            chatId: { type: "string" },
            senderId: { type: "string", description: "MongoDB user id of sender (optional if CHATTY_MCP_USER_ID is set)." },
            type: { type: "string", enum: ["text", "image", "gif"], default: "text" },
            content: { type: "string" },
            imageUrl: { type: "string" },
            cloudinaryPublicId: { type: "string" },
            gifCategory: { type: "string" },
            isViewOnce: { type: "boolean", default: false },
            selfDestructMinutes: { type: "number" },
            replyTo: { type: "string" },
          },
          required: ["chatId", "content"],
        },
      },
      {
        name: "mark_read",
        description: "Mark one or more messages as read by a user.",
        inputSchema: {
          type: "object",
          properties: {
            chatId: { type: "string" },
            userId: { type: "string", description: "Reader user id (optional if CHATTY_MCP_USER_ID is set)." },
            messageIds: { type: "array", items: { type: "string" } },
          },
          required: ["chatId", "messageIds"],
        },
      },
      {
        name: "get_unread_total",
        description: "Get total unread messages for a user across all chats.",
        inputSchema: {
          type: "object",
          properties: {
            userId: { type: "string", description: "MongoDB user id (optional if CHATTY_MCP_USER_ID is set)." },
          },
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  const args = (req.params.arguments || {}) as any;

  await dbConnect();

  try {
    switch (name) {
      case "list_chats": {
        const userId = requireUserId(args.userId);
        const limit = typeof args.limit === "number" ? args.limit : 50;

        const chats = await Chat.find({ participants: userId })
          .populate("participants", "name email avatar isOnline lastSeen")
          .populate("lastMessage")
          .sort({ updatedAt: -1 })
          .limit(limit)
          .lean();

        return { content: [{ type: "text", text: JSON.stringify({ success: true, data: chats }, null, 2) }] };
      }

      case "search_users": {
        const q = String(args.query || "").trim();
        const limit = typeof args.limit === "number" ? args.limit : 20;
        const users = await User.find({
          $or: [
            { name: { $regex: q, $options: "i" } },
            { email: { $regex: q, $options: "i" } },
          ],
        })
          .select("_id name email avatar isOnline lastSeen")
          .limit(limit)
          .lean();

        return { content: [{ type: "text", text: JSON.stringify({ success: true, data: users }, null, 2) }] };
      }

      case "create_chat": {
        const userId = requireUserId(args.userId);
        const type = args.type === "group" ? "group" : "direct";
        const participantIds: string[] = Array.isArray(args.participantIds) ? args.participantIds.map(String) : [];
        const nameStr = typeof args.name === "string" ? args.name.trim() : "";

        if (participantIds.length === 0) throw new Error("participantIds is required");

        const allParticipants = Array.from(new Set([userId, ...participantIds]));

        if (type === "direct" && allParticipants.length !== 2) {
          throw new Error("Direct chat requires exactly one recipient (2 participants total). ");
        }
        if (type === "group" && !nameStr) {
          throw new Error("Group chat requires name.");
        }

        // If direct, reuse existing if present
        if (type === "direct") {
          const existing = await Chat.findOne({
            type: "direct",
            participants: { $all: allParticipants, $size: 2 },
          })
            .populate("participants", "name email avatar isOnline lastSeen")
            .populate("lastMessage")
            .lean();
          if (existing) {
            return { content: [{ type: "text", text: JSON.stringify({ success: true, data: existing, reused: true }, null, 2) }] };
          }
        }

        const chatData: Record<string, any> = {
          type,
          participants: allParticipants,
          admins: [userId],
        };
        if (type === "group") chatData.name = nameStr;

        const password = typeof args.password === "string" ? args.password.trim() : "";
        if (password) {
          // Match the API behavior (bcrypt hash).
          const bcrypt = await import("bcryptjs");
          chatData.isPasswordProtected = true;
          chatData.passwordHash = await bcrypt.default.hash(password, 12);
        }

        const chat = await Chat.create(chatData);
        const populated = await Chat.findById(chat._id)
          .populate("participants", "name email avatar isOnline lastSeen")
          .populate("lastMessage")
          .lean();

        return { content: [{ type: "text", text: JSON.stringify({ success: true, data: populated }, null, 2) }] };
      }

      case "get_messages": {
        const chatId = String(args.chatId);
        const limit = typeof args.limit === "number" ? args.limit : 50;
        const before = typeof args.before === "string" ? new Date(args.before) : null;

        const query: any = { chat: chatId };
        if (before && !Number.isNaN(before.getTime())) {
          query.createdAt = { $lt: before };
        }

        const messages = await Message.find(query)
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate("sender", "name email avatar")
          .populate({ path: "replyTo", select: "content type sender", populate: { path: "sender", select: "name" }, strictPopulate: false })
          .lean();

        // Return oldest->newest
        const ordered = messages.slice().reverse();
        return { content: [{ type: "text", text: JSON.stringify({ success: true, data: ordered }, null, 2) }] };
      }

      case "send_message": {
        const chatId = String(args.chatId);
        const senderId = requireUserId(args.senderId);
        const type = args.type === "image" || args.type === "gif" ? args.type : "text";
        const content = String(args.content ?? "");

        const selfDestructMinutes = typeof args.selfDestructMinutes === "number" ? args.selfDestructMinutes : undefined;

        const messageData: Record<string, any> = {
          chat: chatId,
          sender: senderId,
          type,
          content,
          isViewOnce: Boolean(args.isViewOnce ?? false),
        };

        if (typeof args.imageUrl === "string") messageData.imageUrl = args.imageUrl;
        if (typeof args.cloudinaryPublicId === "string") messageData.cloudinaryPublicId = args.cloudinaryPublicId;
        if (typeof args.gifCategory === "string") messageData.gifCategory = args.gifCategory;
        if (typeof args.replyTo === "string") messageData.replyTo = args.replyTo;
        if (selfDestructMinutes && selfDestructMinutes > 0) {
          messageData.selfDestructAt = new Date(Date.now() + selfDestructMinutes * 60 * 1000);
        }

        const message = await Message.create(messageData);
        await Chat.findByIdAndUpdate(chatId, { lastMessage: message._id });

        const populated = await Message.findById(message._id)
          .populate("sender", "name email avatar")
          .populate({ path: "replyTo", select: "content type sender", populate: { path: "sender", select: "name" }, strictPopulate: false })
          .lean();

        return { content: [{ type: "text", text: JSON.stringify({ success: true, data: populated }, null, 2) }] };
      }

      case "mark_read": {
        const chatId = String(args.chatId);
        const userId = requireUserId(args.userId);
        const messageIds: string[] = Array.isArray(args.messageIds) ? args.messageIds.map(String) : [];
        if (messageIds.length === 0) throw new Error("messageIds is required");

        const now = new Date();

        // Add read receipt for each message if not already present.
        await Message.updateMany(
          {
            _id: { $in: messageIds },
            chat: chatId,
            "readBy.user": { $ne: userId },
          },
          { $push: { readBy: { user: userId, readAt: now } } }
        );

        const unreadTotal = await unreadTotalForUser(userId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, data: { marked: messageIds.length, unreadTotal } }, null, 2),
            },
          ],
        };
      }

      case "get_unread_total": {
        const userId = requireUserId(args.userId);
        const unreadTotal = await unreadTotalForUser(userId);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, data: { unreadTotal } }, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err: any) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: false, error: String(err?.message || err) }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error("Chatty MCP failed to start:", e);
  process.exit(1);
});
