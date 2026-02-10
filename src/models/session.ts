import mongoose, { Schema, models, model } from "mongoose";

export interface ISessionDocument extends mongoose.Document {
    user: mongoose.Types.ObjectId;
    expires: Date;
    ipAddress?: string;
    userAgent?: string;
    lastActive: Date;
    createdAt: Date;
    updatedAt: Date;
}

const SessionSchema = new Schema<ISessionDocument>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        expires: {
            type: Date,
            required: true,
        },
        ipAddress: {
            type: String,
        },
        userAgent: {
            type: String,
        },
        lastActive: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

// Index for easy lookup by user
SessionSchema.index({ user: 1 });

// Index for auto-cleanup of expired sessions using MongoDB TTL
SessionSchema.index({ expires: 1 }, { expireAfterSeconds: 0 });

const Session = models.Session || model<ISessionDocument>("Session", SessionSchema);

export default Session;
