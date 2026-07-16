import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);

  return {
    metadataBase,
    title: "ICEbreaker | Digitalized Controls Hub",
    description: "A proactive controls workspace for execution, review, evidence and risk visibility.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "ICEbreaker | Digitalized Controls Hub",
      description: "See risk sooner. Act before it grows.",
      images: [{ url: "/og.png", width: 1734, height: 908, alt: "ICEbreaker — See risk sooner. Act before it grows." }],
    },
    twitter: {
      card: "summary_large_image",
      title: "ICEbreaker | Digitalized Controls Hub",
      description: "See risk sooner. Act before it grows.",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
