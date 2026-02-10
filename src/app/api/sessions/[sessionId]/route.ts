import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Session from "@/models/session";

export async function DELETE(
    req: Request,
    { params }: { params: { sessionId: string } }
) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { sessionId } = params;

        if (!sessionId) {
            return NextResponse.json(
                { success: false, error: "Session ID required" },
                { status: 400 }
            );
        }

        await dbConnect();

        // Ensure the session belongs to the current user
        const result = await Session.findOneAndDelete({
            _id: sessionId,
            user: session.user.id,
        });

        if (!result) {
            return NextResponse.json(
                { success: false, error: "Session not found or already deleted" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Session revoked successfully",
        });
    } catch (error) {
        console.error("Delete session error:", error);
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
