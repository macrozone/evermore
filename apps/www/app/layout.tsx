import { formatPageTitle, getGameInfo } from "@evermore/core";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { pressStart2P, vt323 } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: formatPageTitle(),
  description: getGameInfo().description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${pressStart2P.variable} ${vt323.variable}`}>
      <body>{children}</body>
    </html>
  );
}
