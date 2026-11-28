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
  const [commentCounts, setCommentCounts] =
