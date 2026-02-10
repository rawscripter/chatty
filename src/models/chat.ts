import mongoose, { Schema, models, model } from "mongoose";

export interface IChatDocument extends mongoose.Document {
    type: "direct" | "group";
    name?: string;
    participants: mongoose.Types.ObjectId[];
    admins: mongoose.Types.ObjectId[];
    isPasswordProtected: boolean;
    passwordHash?: string;
    lastMessage?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const ChatSchema = new Schema<IChatDocument>(
    {
        type: {
            type: String,
            enum: ["direct", "group"],
            default: "direct",
        },
        name: {
            type: String,
            trim: true,
            maxlength: [100, "Chat name must be at most 100 characters"],
        },
        participants: [
            {
                type: Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        admins: [
            {
                type: Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        isPasswordProtected: {
            type: Boolean,
            default: false,
        },
        passwordHash: {
            type: String,
            select: false,
        },
        lastMessage: {
            type: Schema.Types.ObjectId,
            ref: "Message",
        },
    },
    {
        timestamps: true,
    }
);

ChatSchema.index({ participants: 1 });
ChatSchema.index({ updatedAt: -1 });

const Chat = models.Chat || model<IChatDocument>("Chat", ChatSchema);

export default Chat;
