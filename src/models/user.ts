import mongoose, { Schema, models, model } from "mongoose";

export interface IUserPrivacySettings {
    intimateModeEnabled: boolean;
    hideNotificationPreviews: boolean;
    appLockEnabled: boolean;
    inactivityLockEnabled: boolean;
}

export interface IUserDocument extends mongoose.Document {
    name: string;
    email: string;
    password: string;
    avatar?: string;
    isOnline: boolean;
    lastSeen: Date;
    privacy: IUserPrivacySettings;
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema<IUserDocument>(
    {
        name: {
            type: String,
            required: [true, "Name is required"],
            trim: true,
            minlength: [2, "Name must be at least 2 characters"],
            maxlength: [50, "Name must be at most 50 characters"],
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
        },
        password: {
            type: String,
            required: [true, "Password is required"],
            minlength: [6, "Password must be at least 6 characters"],
            select: false,
        },
        avatar: {
            type: String,
            default: "",
        },
        isOnline: {
            type: Boolean,
            default: false,
        },
        lastSeen: {
            type: Date,
            default: Date.now,
        },
        privacy: {
            intimateModeEnabled: {
                type: Boolean,
                default: false,
            },
            hideNotificationPreviews: {
                type: Boolean,
                default: true,
            },
            appLockEnabled: {
                type: Boolean,
                default: false,
            },
            inactivityLockEnabled: {
                type: Boolean,
                default: false,
            },
        },
    },
    {
        timestamps: true,
    }
);

UserSchema.index({ email: 1 });
UserSchema.index({ name: "text", email: "text" });

const User = models.User || model<IUserDocument>("User", UserSchema);

export default User;
