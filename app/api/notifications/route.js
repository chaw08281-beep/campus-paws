import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (char) => "\\" + char);
}

export async function GET(request) {
  const { user, error } = await requirePermission(request, "news:read");
  if (error) return error;

  const nameTag = "%@" + escapeLike(String(user.fullname || "").trim().toLowerCase()) + "%";
  const roleTag = "%@" + escapeLike(String(user.role || "").trim().toLowerCase()) + "%";

  if (!user.fullname && !user.role) {
    return NextResponse.json([]);
  }

  const [rows] = await pool.query(
    `SELECT c.id, c.news_id, c.author_name, c.comment_text, c.created_at, n.title AS post_title
     FROM comments c
     INNER JOIN news n ON n.id = c.news_id
     WHERE (c.user_id IS NULL OR c.user_id <> ?)
       AND (LOWER(c.comment_text) LIKE ? OR LOWER(c.comment_text) LIKE ?)
     ORDER BY c.id DESC
     LIMIT 20`,
    [user.id, nameTag, roleTag]
  );

  return NextResponse.json(rows);
}
