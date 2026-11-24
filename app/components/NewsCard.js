"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

function getCatStatus(item) {
  const text = `${item.title || ""} ${item.content || ""}`.toLowerCase();
  if (text.includes("adopted") || text.includes("went home")) {
    return { label: "Adopted", bg: "#dcfce7", color: "#166534", border: "#bbf7d0" };
  }
  if (item.category === "adoption" || text.includes("foster") || text.includes("indoor home")) {
    return { label: "Needs Home", bg: "#fef3c7", color: "#92400e", border: "#fde68a" };
  }
  if (text.includes("neuter") || text.includes("limp") || text.includes("recovery") || text.includes("wound")) {
    return { label: "Recovering", bg: "#fee2e2", color: "#991b1b", border: "#fecaca" };
  }
  if (item.category === "health" || text.includes("vaccin") || text.includes("deworm") || text.includes("flea")) {
    return { label: "Vet Checked", bg: "#e0e7ff", color: "#3730a3", border: "#c7d2fe" };
  }
  if (text.includes("feed") || text.includes("kibble") || text.includes("water")) {
    return { label: "Fed & Cared For", bg: "#ffedd5", color: "#9a3412", border: "#fed7aa" };
  }
  return { label: "Campus Regular", bg: "#f3f4f6", color: "#374151", border: "#e5e7eb" };
}

const QUICK_REPLIES = [
  "Spotted today",
  "Food & water refilled",
  "Looks healthy & active",
  "Interested in fostering",
];

export default function NewsCard({
  item,
  canEdit,
  canDelete,
  canDeleteComment,
  isSaved,
  onToggleSave,
  onCommentCountChange,
  onDelete,
}) {
  const [comments, setComments] = useState([]);
  const [showComments, setShowComments] = useState(false);
  const [showAdoptForm, setShowAdoptForm] = useState(false);
  const [adoptContact, setAdoptContact] = useState("");
  const [adoptNote, setAdoptNote] = useState("");
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [posting, setPosting] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [commentNotice, setCommentNotice] = useState("");

  const [cuteCount, setCuteCount] = useState(0);
  const [cuteActive, setCuteActive] = useState(false);
  const [helpfulCount, setHelpfulCount] = useState(0);
  const [helpfulActive, setHelpfulActive] = useState(false);

  const status = getCatStatus(item);

  useEffect(() => {
    const cCount = Number(localStorage.getItem(`cp_cute_${item.id}`) || 0);
    const cDone = localStorage.getItem(`cp_cute_done_${item.id}`) === "1";
    const hCount = Number(localStorage.getItem(`cp_help_${item.id}`) || 0);
    const hDone = localStorage.getItem(`cp_help_done_${item.id}`) === "1";
    setCuteCount(cCount);
    setCuteActive(cDone);
    setHelpfulCount(hCount);
    setHelpfulActive(hDone);
  }, [item.id]);

  const toggleCute = () => {
    const nextActive = !cuteActive;
    const nextCount = nextActive ? cuteCount + 1 : Math.max(0, cuteCount - 1);
    setCuteActive(nextActive);
    setCuteCount(nextCount);
    localStorage.setItem(`cp_cute_${item.id}`, String(nextCount));
    localStorage.setItem(`cp_cute_done_${item.id}`, nextActive ? "1" : "0");
  };

  const toggleHelpful = () => {
    const nextActive = !helpfulActive;
    const nextCount = nextActive ? helpfulCount + 1 : Math.max(0, helpfulCount - 1);
    setHelpfulActive(nextActive);
    setHelpfulCount(nextCount);
    localStorage.setItem(`cp_help_${item.id}`, String(nextCount));
    localStorage.setItem(`cp_help_done_${item.id}`, nextActive ? "1" : "0");
  };

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/news/${item.id}/comments`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setComments(data);
          if (onCommentCountChange) onCommentCountChange(item.id, data.length);
        }
      }
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [item.id]);

  const submitCommentPayload = async (textToSend) => {
    if (!textToSend.trim() || posting) return false;
    setPosting(true);
    setCommentError("");
    setCommentNotice("");
    try {
      const res = await fetch(`/api/news/${item.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment_text: textToSend.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCommentError(data.message || "Could not post update.");
        return false;
      }
      setShowComments(true);
      await fetchComments();
      return true;
    } finally {
      setPosting(false);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    const ok = await submitCommentPayload(commentText);
    if (ok) setCommentText("");
  };

  const handleAdoptSubmit = async (e) => {
    e.preventDefault();
    if (!adoptContact.trim()) return;
    const formatted = `[Adoption Inquiry] Contact: ${adoptContact.trim()}${
      adoptNote.trim() ? ` — ${adoptNote.trim()}` : ""
    }`;
    const ok = await submitCommentPayload(formatted);
    if (ok) {
      setAdoptContact("");
      setAdoptNote("");
      setShowAdoptForm(false);
      setCommentNotice("Adoption inquiry posted to thread.");
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm("Delete this comment?")) return;
    setCommentNotice("");
    const res = await fetch(
      `/api/news/${item.id}/comments?commentId=${commentId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setCommentNotice("Comment removed.");
      await fetchComments();
    }
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
    <article className="news-card">
      <div className="news-photo">
        <span className={`badge badge-${item.category}`}>{item.category}</span>

        <button
          type="button"
          onClick={() => onToggleSave(item.id)}
          aria-label={isSaved ? "Remove bookmark" : "Save cat report"}
          title={isSaved ? "Saved in your list" : "Save to follow"}
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            zIndex: 2,
            background: isSaved ? "#ea580c" : "rgba(255, 255, 255, 0.92)",
            color: isSaved ? "#ffffff" : "#431407",
            border: "1px solid rgba(234, 88, 12, 0.25)",
            borderRadius: "999px",
            padding: "4px 10px",
            fontSize: "0.75rem",
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          {isSaved ? "Saved" : "Save"}
        </button>

        {item.image ? (
          <img
            src={item.image}
            alt={item.title}
            style={{ objectFit: "cover", objectPosition: "center 20%" }}
          />
        ) : (
          <div
            className="news-placeholder"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              color: "#9a3412",
            }}
          >
            <svg width="42" height="42" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.65 }}>
              <path d="M16 24L12 10l12 8a20 20 0 0 1 16 0l12-8-4 14a18 18 0 0 1 4 12c0 10-9 18-20 18S12 46 12 36a18 18 0 0 1 4-12z" />
              <circle cx="25" cy="34" r="2" fill="currentColor" />
              <circle cx="39" cy="34" r="2" fill="currentColor" />
              <path d="M29 40l3 2 3-2" />
            </svg>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.03em", opacity: 0.7 }}>
              Field Note
            </span>
          </div>
        )}
      </div>

      <div className="news-body">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
            marginBottom: "4px",
          }}
        >
          {item.created_at && (
            <p className="news-date" style={{ margin: 0 }}>
              Posted {formatDate(item.created_at)}
            </p>
          )}
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 600,
              padding: "2px 9px",
              borderRadius: "999px",
              backgroundColor: status.bg,
              color: status.color,
              border: `1px solid ${status.border}`,
            }}
          >
            {status.label}
          </span>
        </div>

        <h3>{item.title}</h3>
        <p>{item.content}</p>

        {/* Subtle Reaction Pills */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            flexWrap: "wrap",
            marginBottom: "10px",
          }}
        >
          <button
            type="button"
            onClick={toggleCute}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "4px 10px",
              borderRadius: "999px",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
              border: cuteActive ? "1px solid #fb923c" : "1px solid #fed7aa",
              background: cuteActive ? "#ffedd5" : "#fffaf5",
              color: cuteActive ? "#c2410c" : "#7c2d12",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill={cuteActive ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            Adorable{cuteCount > 0 ? ` · ${cuteCount}` : ""}
          </button>

          <button
            type="button"
            onClick={toggleHelpful}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "4px 10px",
              borderRadius: "999px",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
              border: helpfulActive ? "1px solid #fb923c" : "1px solid #fed7aa",
              background: helpfulActive ? "#ffedd5" : "#fffaf5",
              color: helpfulActive ? "#c2410c" : "#7c2d12",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Helpful{helpfulCount > 0 ? ` · ${helpfulCount}` : ""}
          </button>
        </div>

        <div className="news-actions">
          <button
            type="button"
            className="btn-small comment-toggle"
            onClick={() => setShowComments((prev) => !prev)}
            style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {comments.length} {comments.length === 1 ? "Comment" : "Comments"}
          </button>

          {item.category === "adoption" && status.label !== "Adopted" && (
            <button
              type="button"
              className="btn-small"
              onClick={() => setShowAdoptForm((prev) => !prev)}
              style={{
                background: "#ea580c",
                color: "#ffffff",
                borderColor: "#ea580c",
              }}
            >
              {showAdoptForm ? "Close Inquiry" : "Inquire to Adopt"}
            </button>
          )}

          {canEdit && (
            <Link href={`/news/${item.id}/edit`} className="btn-small">
              Edit
            </Link>
          )}

          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="btn-small btn-danger"
            >
              Delete
            </button>
          )}
        </div>

        {showAdoptForm && (
          <form
            onSubmit={handleAdoptSubmit}
            style={{
              marginTop: "10px",
              padding: "10px 12px",
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              borderRadius: "10px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#9a3412" }}>
              Adoption & Foster Interest
            </span>
            <input
              type="text"
              value={adoptContact}
              onChange={(e) => setAdoptContact(e.target.value)}
              placeholder="Your LINE ID, phone, or university email"
              required
              style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid #fdba74", fontSize: "0.85rem" }}
            />
            <input
              type="text"
              value={adoptNote}
              onChange={(e) => setAdoptNote(e.target.value)}
              placeholder="Short note (e.g. pet-friendly condo, foster dates)"
              style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid #fdba74", fontSize: "0.85rem" }}
            />
            <button
              type="submit"
              disabled={posting}
              className="btn-small"
              style={{ alignSelf: "flex-start", background: "#ea580c", color: "#fff", borderColor: "#ea580c" }}
            >
              {posting ? "Sending..." : "Send Inquiry"}
            </button>
          </form>
        )}

        {showComments && (
          <div className="comments-box">
            {commentNotice && <p className="banner-success">{commentNotice}</p>}

            {loadingComments ? (
              <p className="comments-empty">Loading comments...</p>
            ) : comments.length === 0 ? (
              <p className="comments-empty">No updates yet. Add the first note below.</p>
            ) : (
              <div className="comments-list">
                {comments.map((c) => (
                  <div key={c.id} className="comment-item">
                    <div className="comment-meta">
                      <div>
                        <strong>{c.author_name}</strong>{" "}
                        <span className="role">{c.author_role}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span className="comment-date">{formatDate(c.created_at)}</span>
                        {canDeleteComment && (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(c.id)}
                            className="btn-small btn-danger"
                            style={{ padding: "2px 8px", fontSize: "0.75rem" }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="comment-text">{c.comment_text}</p>
                  </div>
                ))}
              </div>
            )}

            {/* One-tap quick reply chips */}
            <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginTop: "8px", marginBottom: "6px" }}>
              {QUICK_REPLIES.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCommentText(preset)}
                  style={{
                    fontSize: "0.72rem",
                    padding: "3px 8px",
                    borderRadius: "999px",
                    border: "1px solid #fed7aa",
                    background: "#fffaf5",
                    color: "#9a3412",
                    cursor: "pointer",
                  }}
                >
                  + {preset}
                </button>
              ))}
            </div>

            <form onSubmit={handleCommentSubmit} className="comment-form">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Share a feeding, health, or location update..."
                required
              />
              <button type="submit" disabled={posting}>
                {posting ? "..." : "Post"}
              </button>
            </form>
            {commentError && <p className="error">{commentError}</p>}
          </div>
        )}
      </div>
    </article>
  );
}