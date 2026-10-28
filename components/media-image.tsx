"use client";
import { useState, type ImgHTMLAttributes } from "react";
export function MediaImage({ src, alt = "", className, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [failedSrc, setFailedSrc] = useState<ImgHTMLAttributes<HTMLImageElement>["src"]>();
  if (!src || failedSrc === src) return <span role="img" aria-label={alt || "Изображение недоступно"} className={`media-unavailable ${className || ""}`}>Изображение недоступно</span>;
  return <img {...props} src={src} alt={alt} className={className} onError={() => setFailedSrc(src)} />;
}
