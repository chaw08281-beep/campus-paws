import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

const TYPES = ["adorable", "helpful"];

async function getReactionState(newsId, userId) {
  const [countRows] = await pool.query(
    "SELECT type, COUNT(*) AS total FROM reactions WHERE news_id = ? GROUP BY type",
    [newsId]
  );
  const [mineRows] = await pool.query(
    "SELECT type FROM reactions WHERE news_id = ? AND user_id = ?",
    [newsId, userId]
  );

  const state = { adorable: 0, helpful: 0, mine: mineRows.map((row) => row.type) };
  for (const row of countRows) {
    if (TYPES.includes(row.type)) state[row.type] = Number(row.total);
  }
  return state;
}

export async function GET(request) {
  const { user, error } = await requirePermission(request, "news:read");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const newsId = searchParams.get("news_id");
  if (!newsId) {
    return NextResponse.json(
      { status: "error", message: "Missing news_id" },
      { status: 400 }
    );
  }

  const state = await getReactionState(newsId, user.id);
  return NextResponse.json(state);
}

export async function POST(request) {
  const { user, error } = await requirePermission(request, "news:read");
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const newsId = body.news_id;
  const type = body.type;

  if (!newsId || !TYPES.includes(type)) {
    return NextResponse.json(
      { status: "error", message: "Invalid reaction" },
      { status: 400 }
    );
  }

  const [existing] = await pool.query(
    "SELECT 1 FROM reactions WHERE news_id = ? AND user_id = ? AND type = ?",
    [newsId, user.id, type]
  );

  if (existing.length > 0) {
    await pool.query(
      "DELETE FROM reactions WHERE news_id = ? AND user_id = ? AND type = ?",
      [newsId, user.id, type]
    );
  } else {
    await pool.query(
      "INSERT INTO reactions (news_id, user_id, type) VALUES (?, ?, ?)",
      [newsId, user.id, type]
    );
  }

  const state = await getReactionState(newsId, user.id);
  return NextResponse.json(state);
}
