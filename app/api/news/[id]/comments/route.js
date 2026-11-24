import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export async function GET(request, { params }) {
  const { id } = await params;
  const [rows] = await pool.query(
    "SELECT * FROM comments WHERE news_id = ? ORDER BY created_at ASC",
    [id]
  );
  return NextResponse.json(rows);
}

export async function POST(request, { params }) {
  const { user, error } = await requirePermission(request, "news:read");
  if (error) return error;

  const { id } = await params;
  const { comment_text } = await request.json();

  if (!comment_text || !comment_text.trim()) {
    return NextResponse.json(
      { status: "error", message: "Comment cannot be empty" },
      { status: 400 }
    );
  }

  await pool.query(
    "INSERT INTO comments (news_id, user_id, author_name, author_role, comment_text) VALUES (?, ?, ?, ?, ?)",
    [id, user.id, user.fullname, user.role, comment_text.trim()]
  );

  return NextResponse.json({ status: "ok" }, { status: 201 });
}

export async function DELETE(request) {
  const { user, error } = await requirePermission(request, "news:delete");
  if (error) return error;

  if (user.role !== "admin") {
    return NextResponse.json(
      { status: "error", message: "Only admin can delete comments" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const commentId = searchParams.get("commentId");

  if (!commentId) {
    return NextResponse.json(
      { status: "error", message: "Missing commentId" },
      { status: 400 }
    );
  }

  await pool.query("DELETE FROM comments WHERE id = ?", [commentId]);
  return NextResponse.json({ status: "ok" });
}