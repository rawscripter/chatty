import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const ADULT_OTP = "x";
const ADULT_COOKIE_NAME = "adult_gifs_unlocked";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const otp = typeof body?.otp === "string" ? body.otp : "";

    if (otp !== ADULT_OTP) {
      return NextResponse.json({ ok: false, error: "INVALID_OTP" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });

    // Session cookie: unlock lasts until browser session ends.
    // (No expires/maxAge)
    res.cookies.set({
      name: ADULT_COOKIE_NAME,
      value: "1",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    return res;
  } catch (error) {
    console.error("Adult unlock error:", error);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
