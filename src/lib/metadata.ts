import type { Metadata } from "next";

import { publicEnvironment } from "@/lib/env";

export function pageMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  const { siteUrl } = publicEnvironment();
  return {
    title,
    description,
    alternates: { canonical: new URL(path, siteUrl).toString() },
    openGraph: { title, description, url: new URL(path, siteUrl).toString() },
  };
}
