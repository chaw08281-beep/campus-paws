"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import NewsCard from "@/app/components/NewsCard";
import NotificationBar from "@/app/components/NotificationBar";
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
