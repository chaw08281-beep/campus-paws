import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";
import { signToken } from "@/lib/auth";

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { status: "error", message: "email and password are required" },
        { status: 400 }
      );
    }

    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json(
        { status: "error", message: "Invalid email or password" },
        { status: 401 }
      );
    }

    const token = await signToken({
      id: user.id,
      email: user.email,
      fullname: user.fullname,
      role: user.role,
    });

    const response = NextResponse.json({ status: "ok" });

    response.cookies.set("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60,
    });

    return response;
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        message: `${err.code || "ERR"}: ${err.message}`,
      },
      { status: 500 }
    );
  }
}