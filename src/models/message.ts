import mongoose, { Schema, models, model } from "mongoose";

export interface IMessageDocument extends mongoose.Document {
    chat: mongoose.Types.ObjectId;
    sender: mongoose.Types.ObjectId;
    content: string;
    type: "text" | "image" | "gif" | "system";
    imageUrl?: string;
    cloudinaryPublicId?: string;
    gifCategory?: "kissing" | "hug" | "romance";
    isViewOnce: boolean;
    viewOnceViewed: boolean;
    viewedBy: { user: mongoose.Types.ObjectId; viewedAt: Date }[];
    readBy: { user: mongoose.Types.ObjectId; readAt: Date }[];
    selfDestructAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const MessageSchema = new Schema<IMessageDocument>(
    {
        chat: {
            type: Schema.Types.ObjectId,
            ref: "Chat",
            required: true,
            index: true,
        },
        sender: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        content: {
            type: String,
            default: "",
            maxlength: [5000, "Message must be at most 5000 characters"],
        },
        type: {
            type: String,
            enum: ["text", "image", "gif", "system"],
            default: "text",
        },
        imageUrl: String,
        cloudinaryPublicId: String,
        gifCategory: {
            type: String,
            enum: ["kissing", "hug", "romance"],
        },
        isViewOnce: {
            type: Boolean,
            default: false,
        },
        viewOnceViewed: {
            type: Boolean,
            default: false,
        },
        viewedBy: [
            {
                user: { type: Schema.Types.ObjectId, ref: "User" },
                viewedAt: { type: Date, default: Date.now },
            },
        ],
        readBy: [
            {
                user: { type: Schema.Types.ObjectId, ref: "User" },
                readAt: { type: Date, default: Date.now },
            },
        ],
        selfDestructAt: {
            type: Date,
            index: { expires: 0 },
        },
    },
    {
        timestamps: true,
    }
);

MessageSchema.index({ chat: 1, createdAt: -1 });

const Message = models.Message || model<IMessageDocument>("Message", MessageSchema);

export default Message;
