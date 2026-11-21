const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export default function sitemap() { return [{ url: `${site}/login`, changeFrequency: "yearly", priority: 1 }]; }
