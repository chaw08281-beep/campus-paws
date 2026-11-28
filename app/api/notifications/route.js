import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export async function GET(request) {
  const { user, error } = await requirePermission(request, "news:read");
  if (error) return error;

  if (user.role !== "admin") {
    return NextResponse.json([]);
  }

  const [rows] = await pool.query(
    `SELECT c.id, c.news_id, c.author_name, c.comment_text, c.created_at, n.title AS post_title
     FROM comments c
     INNER JOIN news n ON n.id = c.news_id
     WHERE LOWER(c.comment_text) LIKE '%@admin%'
       AND (c.user_id IS NULL OR c.user_id <> ?)
     ORDER BY c.id DESC
     LIMIT 20`,
    [user.id]
  );

  return NextResponse.json(rows);
}
