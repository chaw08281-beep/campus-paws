"use client";

import { useState, useEffect } from "react";

function preview(text) {
  const value = String(text || "");
  return value.length > 90 ? value.slice(0, 90) + "..." : value;
}

export default function NotificationBar({ user, onOpenPost }) {
  const [items, setItems] = useState([]);
  const [seenId, setSeenId] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const userId = user ? user.id : null;
  const storageKey = userId ? `cp_notif_seen_${userId}` : "";

  useEffect(() => {
    if (!storageKey) return;
    try {
      const stored = Number(localStorage.getItem(storageKey) || 0);
      setSeenId(Number.isFinite(stored) ? stored : 0);
    } catch {
      setSeenId(0);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    const load = () => {
      fetch("/api/notifications")
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (active && Array.isArray(data)) setItems(data);
        })
        .catch(() => {});
    };

    load();
    const timer = setInterval(load, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [userId]);

  if (!userId) return null;

  const unread = items.filter((item) => item.id > seenId);
  if (unread.length === 0) return null;

  const latest = unread[0];

  const markAllRead = () => {
    const maxId = Math.max(...items.map((item) => item.id), seenId);
    setSeenId(maxId);
    setExpanded(false);
    try {
      localStorage.setItem(storageKey, String(maxId));
    } catch {}
  };

  const openPost = (title) => {
    if (onOpenPost) onOpenPost(title);
    setTimeout(() => {
      const list = document.querySelector(".news-list");
      if (list) list.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  };

  const formatDate = (value) => {
    if (!value) return "";
    return new Date(value).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <section
      style={{
        background: "#fff7ed",
        border: "1px solid #fdba74",
        borderLeft: "5px solid #ea580c",
        borderRadius: "14px",
        padding: "12px 16px",
        marginBottom: "16px",
        boxShadow: "0 6px 20px rgba(234, 88, 12, 0.10)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flex: 1,
            minWidth: "220px",
          }}
        >
          <span
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "999px",
              background: "#ea580c",
              color: "#ffffff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </span>
          <div>
            <strong style={{ color: "#7c2d12" }}>
              {unread.length} new {unread.length === 1 ? "mention" : "mentions"} for you
            </strong>
            <div style={{ fontSize: "0.85rem", color: "#431407" }}>
              {latest.author_name + " on " + latest.post_title + ": " + preview(latest.comment_text)}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button type="button" className="btn-small" onClick={() => openPost(latest.post_title)}>
            View post
          </button>
          <button type="button" className="btn-small" onClick={() => setExpanded((prev) => !prev)}>
            {expanded ? "Hide" : "Show all"}
          </button>
          <button type="button" className="btn-small" onClick={markAllRead}>
            Mark as read
          </button>
        </div>
      </div>

      {expanded && (
        <div
          style={{
            marginTop: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {unread.map((item) => (
            <div
              key={item.id}
              style={{
                background: "#ffffff",
                border: "1px solid #ffedd5",
                borderRadius: "10px",
                padding: "8px 12px",
                fontSize: "0.85rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                <strong style={{ color: "#9a3412" }}>{item.author_name}</strong>
                <span style={{ opacity: 0.7 }}>{formatDate(item.created_at)}</span>
              </div>
              <div style={{ color: "#374151", margin: "2px 0 6px" }}>{item.comment_text}</div>
              <button type="button" className="btn-small" onClick={() => openPost(item.post_title)}>
                Open: {item.post_title}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
