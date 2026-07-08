import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: "website" | "product" | "article";
  jsonLd?: object;
}

const BASE_TITLE = "Geem.pk";
const BASE_DESCRIPTION = "Pakistan's trusted store for PTA-approved smartphones, spy cameras, Lawmate surveillance equipment and GPS trackers. Nationwide delivery.";

function setMeta(name: string, content: string, property = false) {
  const attr = property ? "property" : "name";
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setJsonLd(id: string, data: object) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function removeJsonLd(id: string) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

export function useSEO({ title, description, keywords, image, url, type = "website", jsonLd }: SEOProps) {
  useEffect(() => {
    const fullTitle = title ? `${title} — ${BASE_TITLE}` : `${BASE_TITLE} — Mobiles, Spy Cameras & Surveillance Pakistan`;
    const desc = description ?? BASE_DESCRIPTION;

    document.title = fullTitle;
    setMeta("description", desc);
    if (keywords) setMeta("keywords", keywords);

    setMeta("og:title", fullTitle, true);
    setMeta("og:description", desc, true);
    setMeta("og:type", type, true);
    if (url) setMeta("og:url", url, true);
    if (image) setMeta("og:image", image, true);

    setMeta("twitter:title", fullTitle, true);
    setMeta("twitter:description", desc, true);
    if (image) setMeta("twitter:image", image, true);

    if (jsonLd) {
      setJsonLd("page-json-ld", jsonLd);
    } else {
      removeJsonLd("page-json-ld");
    }

    return () => {
      removeJsonLd("page-json-ld");
    };
  }, [title, description, keywords, image, url, type, jsonLd]);
}
