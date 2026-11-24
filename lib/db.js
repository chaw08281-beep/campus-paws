import mysql from "mysql2/promise";

const useSsl =
  process.env.DB_SSL === "true" || process.env.NODE_ENV === "production";

export const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 4000),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "campus_paws",
  waitForConnections: true,
  connectionLimit: 10,
  ...(useSsl
    ? {
        ssl: {
          rejectUnauthorized: false,
        },
      }
    : {}),
});