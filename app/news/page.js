"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import NewsCard from "@/app/components/NewsCard";
import { can } from "@/lib/rbac";

const CATEGORIES = ["sighting", "health", "adoption"];

// Compress uploaded image in browser so it loads fast and fits cleanly in MySQL + Vercel
function compressImageFile(file, maxWidth = 800, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Could not read image file."));
      img.src = event.target.result;
    };
    reader.onerror = () => reject(new Error("Could not load file."));
    reader.readAsDataURL(file);
  });
}

export default function NewsPage() {
  const [user, setUser] = useState(null);
  const [news, setNews] = useState([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("sighting");
  const [content, setContent] = useState("");
  const [image, setImage] = useState("");
  const [fileName, setFileName] = useState("");
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  const [filter, setFilter] = useState("all");
  const [savedIds, setSavedIds] = useState([]);
  const [commentCounts, setCommentCounts] = useState({});
  const [userComments, setUserComments] = useState([]);
  const [showProfile, setShowProfile] = useState(false);
  const [sortBy, setSortBy] = useState("featured");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const loadNews = () => {
    fetch("/api/news")
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setNews(data);
        } else {
          window.location.href = "/login";
        }
      });
  };

  useEffect(() => {
    fetch("/api/me")
      .then((response) => response.json())
      .then((data) => setUser(data));
    loadNews();

    try {
      const stored = JSON.parse(localStorage.getItem("cp_saved_cats") || "[]");
      if (Array.isArray(stored)) setSavedIds(stored);
    } catch {
      setSavedIds([]);
    }
  }, []);

  useEffect(() => {
    if (!user || news.length === 0) return;
    let active = true;

    Promise.all(
      news.map(async (post) => {
        try {
          const res = await fetch(`/api/news/${post.id}/comments`);
          if (!res.ok) return [];
          const rows = await res.json();
          if (!Array.isArray(rows)) return [];
          return rows
            .filter(
              (c) =>
                (user.id && c.user_id === user.id) ||
                (user.fullname &&
                  c.author_name &&
                  c.author_name.toLowerCase() === user.fullname.toLowerCase())
            )
            .map((c) => ({
              ...c,
              postTitle: post.title,
              postId: post.id,
            }));
        } catch {
          return [];
        }
      })
    ).then((nested) => {
      if (active) {
        setUserComments(nested.flat());
      }
    });

    return () => {
      active = false;
    };
  }, [user, news, commentCounts]);

  const toggleSaveCat = (id) => {
    setSavedIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id];
      localStorage.setItem("cp_saved_cats", JSON.stringify(next));
      return next;
    });
  };

  const handleCommentCountChange = (id, count) => {
    setCommentCounts((prev) =>
      prev[id] === count ? prev : { ...prev, [id]: count }
    );
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please select a valid image file (JPG, PNG, or WebP).");
      return;
    }

    setErrorMsg("");
    setProcessingPhoto(true);
    try {
      const compressed = await compressImageFile(file);
      setImage(compressed);
      setFileName(file.name);
    } catch {
      setErrorMsg("Could not process that photo. Please try another image.");
    } finally {
      setProcessingPhoto(false);
    }
  };

  const clearSelectedPhoto = () => {
    setImage("");
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setStatusMsg("");
    setErrorMsg("");

    const res = await fetch("/api/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        category,
        content,
        image: image || null,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErrorMsg(data.message || "Could not add report.");
      return;
    }

    setTitle("");
    setCategory("sighting");
    setContent("");
    clearSelectedPhoto();
    setShowForm(false);
    setStatusMsg("Report published. Thank you for looking out for campus cats.");
    loadNews();
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this report?")) return;
    await fetch(`/api/news/${id}`, { method: "DELETE" });
    loadNews();
  };

  if (!user) {
    return <p>Loading...</p>;
  }

  const authoredPosts = news.filter((item) => {
    const authorField =
      item.author_name || item.fullname || item.created_by_name || "";
    return (
      (user.id && item.user_id === user.id) ||
      (user.fullname &&
        authorField &&
        String(authorField).toLowerCase() === user.fullname.toLowerCase())
    );
  });

  const savedPosts = news.filter((item) => savedIds.includes(item.id));

  const photoCount = news.filter(
    (item) => item.image && String(item.image).trim() !== ""
  ).length;

  const query = search.trim().toLowerCase();
  const shown = news
    .filter((item) => {
      const matchesCategory = filter === "all" || item.category === filter;
      const matchesSearch =
        !query ||
        item.title?.toLowerCase().includes(query) ||
        item.content?.toLowerCase().includes(query) ||
        item.category?.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
      if (sortBy === "discussed") {
        const diff = (commentCounts[b.id] || 0) - (commentCounts[a.id] || 0);
        if (diff !== 0) return diff;
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
      const aHasPhoto = a.image && String(a.image).trim() !== "" ? 0 : 1;
      const bHasPhoto = b.image && String(b.image).trim() !== "" ? 0 : 1;
      if (aHasPhoto !== bHasPhoto) return aHasPhoto - bHasPhoto;
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

  return (
    <div className="page">
      <div className="topbar">
        <Link href="/dashboard">← Dashboard</Link>

        <button
          type="button"
          onClick={() => setShowProfile((prev) => !prev)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: showProfile ? "#ffedd5" : "#fffaf5",
            border: "1px solid #fed7aa",
            borderRadius: "999px",
            padding: "4px 12px 4px 5px",
            cursor: "pointer",
            color: "#431407",
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "999px",
              background: "#ea580c",
              color: "#ffffff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 24L12 10l12 8a20 20 0 0 1 16 0l12-8-4 14a18 18 0 0 1 4 12c0 10-9 18-20 18S12 46 12 36a18 18 0 0 1 4-12z" />
              <circle cx="25" cy="34" r="2.2" fill="currentColor" />
              <circle cx="39" cy="34" r="2.2" fill="currentColor" />
            </svg>
          </span>
          <span>{user.fullname}</span>
          <span className="role">{user.role}</span>
        </button>
      </div>

      {showProfile && (
        <section
          style={{
            background: "#fffaf5",
            border: "1px solid #fed7aa",
            borderRadius: "16px",
            padding: "18px 20px",
            marginBottom: "18px",
            boxShadow: "0 6px 20px rgba(234, 88, 12, 0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              paddingBottom: "14px",
              borderBottom: "1px solid #ffedd5",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "16px",
                  background: "linear-gradient(135deg, #fb923c, #ea580c)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(234, 88, 12, 0.25)",
                }}
              >
                <svg width="28" height="28" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 24L12 10l12 8a20 20 0 0 1 16 0l12-8-4 14a18 18 0 0 1 4 12c0 10-9 18-20 18S12 46 12 36a18 18 0 0 1 4-12z" />
                  <circle cx="25" cy="34" r="2.5" fill="currentColor" />
                  <circle cx="39" cy="34" r="2.5" fill="currentColor" />
                  <path d="M29 40l3 2 3-2" />
                </svg>
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0, color: "#431407" }}>{user.fullname}</h3>
                  <span className="role">{user.role}</span>
                </div>
                <p style={{ margin: "3px 0 0", fontSize: "0.84rem", color: "#9a3412" }}>
                  Campus Paws Member · {savedIds.length} Saved Cats · {userComments.length} Notes Posted
                </p>
              </div>
            </div>

            <button
              type="button"
              className="btn-small"
              onClick={() => setShowProfile(false)}
            >
              Close
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "16px",
              marginTop: "14px",
            }}
          >
            <div>
              <h4 style={{ margin: "0 0 8px", fontSize: "0.9rem", color: "#7c2d12" }}>
                Your Posted Reports ({authoredPosts.length})
              </h4>
              {authoredPosts.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.83rem", opacity: 0.75 }}>
                  No posts linked to {user.fullname} yet. Use <strong>+ Add Report</strong> to share a sighting or care update.
                </p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.85rem" }}>
                  {authoredPosts.map((p) => (
                    <li key={p.id} style={{ marginBottom: "4px" }}>
                      <strong>{p.title}</strong>{" "}
                      <span style={{ opacity: 0.7 }}>({p.category})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h4 style={{ margin: "0 0 8px", fontSize: "0.9rem", color: "#7c2d12" }}>
                Your Recent Comments ({userComments.length})
              </h4>
              {userComments.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.83rem", opacity: 0.75 }}>
                  You haven&apos;t commented on any threads yet.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {userComments.slice(0, 4).map((c) => (
                    <div
                      key={c.id}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #ffedd5",
                        borderRadius: "10px",
                        padding: "7px 10px",
                        fontSize: "0.82rem",
                      }}
                    >
                      <div style={{ fontWeight: 600, color: "#9a3412" }}>
                        On: {c.postTitle}
                      </div>
                      <div style={{ color: "#374151" }}>{c.comment_text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {savedPosts.length > 0 && (
            <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid #ffedd5" }}>
              <h4 style={{ margin: "0 0 8px", fontSize: "0.9rem", color: "#7c2d12" }}>
                Bookmarked Cats ({savedPosts.length})
              </h4>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {savedPosts.map((sp) => (
                  <span
                    key={sp.id}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #fed7aa",
                      borderRadius: "999px",
                      padding: "4px 11px",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "#431407",
                    }}
                  >
                    {sp.title}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <header className="hero">
        <h1>Campus Paws</h1>
        <p>Stray cats on campus: sightings, health updates and adoptions.</p>
        <div className="stats">
          <div><strong>{news.length}</strong><span>Reports</span></div>
          <div><strong>{photoCount}</strong><span>With Photos</span></div>
          {CATEGORIES.map((name) => (
            <div key={name}>
              <strong>{news.filter((item) => item.category === name).length}</strong>
              <span>{name}</span>
            </div>
          ))}
        </div>
      </header>

      <div className="toolbar-row" style={{ marginBottom: "16px" }}>
        <div className="filters">
          {["all", ...CATEGORIES].map((name) => (
            <button
              key={name}
              type="button"
              className={`chip ${filter === name ? "active" : ""}`}
              onClick={() => setFilter(name)}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="toolbar-actions">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort reports"
            style={{
              padding: "8px 12px",
              borderRadius: "999px",
              border: "1px solid #fed7aa",
              background: "#ffffff",
              fontSize: "0.85rem",
              color: "#431407",
              cursor: "pointer",
            }}
          >
            <option value="featured">Sort: Photo First</option>
            <option value="newest">Sort: Newest Date</option>
            <option value="discussed">Sort: Most Active</option>
          </select>

          <input
            type="search"
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cat or place..."
          />

          {can(user.role, "news:create") && (
            <button
              type="button"
              onClick={() => setShowForm((prev) => !prev)}
            >
              {showForm ? "Close Form" : "+ Add Report"}
            </button>
          )}
        </div>
      </div>

      {statusMsg && <p className="banner-success">{statusMsg}</p>}
      {errorMsg && <p className="error">{errorMsg}</p>}

      {can(user.role, "news:create") && showForm && (
        <form onSubmit={handleCreate} className="news-form">
          <h3>New Campus Cat Report</h3>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Cat name or place (e.g. Toro near Building 3)"
            required
          />
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {CATEGORIES.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <div
            style={{
              border: "1.5px dashed #fdba74",
              borderRadius: "12px",
              padding: "12px 14px",
              background: "#fffaf5",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  color: "#9a3412",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span>
                  {processingPhoto
                    ? "Preparing photo..."
                    : fileName
                    ? `Selected: ${fileName}`
                    : "Upload Cat Photo from Computer (Optional)"}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
              </label>

              {image && (
                <button
                  type="button"
                  onClick={clearSelectedPhoto}
                  className="btn-small btn-danger"
                >
                  Remove Photo
                </button>
              )}
            </div>

            {image && (
              <img
                src={image}
                alt="Selected cat preview"
                style={{
                  width: "140px",
                  height: "96px",
                  objectFit: "cover",
                  borderRadius: "10px",
                  border: "1px solid #fed7aa",
                }}
              />
            )}
          </div>

          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="What did you see? Health, behavior, feeding..."
            rows={3}
            required
          />
          <button type="submit" disabled={processingPhoto}>
            {processingPhoto ? "Preparing..." : "Submit report"}
          </button>
        </form>
      )}

      {shown.length === 0 && <p className="empty">No matching reports found.</p>}

      <div className="news-list">
        {shown.map((item) => (
          <NewsCard
            key={item.id}
            item={item}
            canEdit={can(user.role, "news:update")}
            canDelete={can(user.role, "news:delete")}
            canDeleteComment={user.role === "admin"}
            isSaved={savedIds.includes(item.id)}
            onToggleSave={toggleSaveCat}
            onCommentCountChange={handleCommentCountChange}
            onDelete={handleDelete}
          />
        ))}
      </div>

      <p className="footer">Campus Paws — Community Cat Care Network</p>
    </div>
  );
}
