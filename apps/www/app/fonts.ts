import localFont from "next/font/local";

// Self-hosted pixel fonts (SIL OFL 1.1, see fonts/README.md)

export const pressStart2P = localFont({
  src: "./fonts/press-start-2p/press-start-2p-latin-400-normal.woff2",
  variable: "--font-press-start-2p",
  display: "swap",
});

export const vt323 = localFont({
  src: "./fonts/vt323/vt323-latin-400-normal.woff2",
  variable: "--font-vt323",
  display: "swap",
});
