import type { MetadataRoute } from "next";
import { guides } from "@/content/guides";
import { absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const latestGuide = guides.reduce((a, g) => (g.updated > a ? g.updated : a), "2026-10-21");
  return [
    { url: absoluteUrl("/"), lastModified: latestGuide, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/how-it-works"), lastModified: "2026-10-21", changeFrequency: "monthly", priority: 0.8 },
    { url: absoluteUrl("/security"), lastModified: "2026-10-21", changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/guides"), lastModified: latestGuide, changeFrequency: "weekly", priority: 0.8 },
    ...guides.map((g) => ({
      url: absoluteUrl(`/guides/${g.slug}`),
      lastModified: g.updated,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
