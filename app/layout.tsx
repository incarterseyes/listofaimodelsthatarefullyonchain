import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
const DESCRIPTION =
  "A list of neural networks stored fully on Ethereum mainnet. Every entry has a contract address and a live check that anyone can run.";

const SITE_NAME = "listofaimodelsthatarefullyonchain.com";

export const metadata: Metadata = {
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
  title: SITE_NAME,
  description: DESCRIPTION,
  ...(SITE_URL ? { alternates: { canonical: "/" } } : {}),
  openGraph: {
    title: SITE_NAME,
    description: DESCRIPTION,
    ...(SITE_URL ? { url: SITE_URL } : {}),
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: SITE_NAME,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0c0c",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#content">
          SKIP TO CONTENT
        </a>
        {children}
      </body>
    </html>
  );
}
