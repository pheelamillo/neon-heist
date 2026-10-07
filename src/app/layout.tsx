import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Neon Heist — Pick a vault. Grab the loot.",
  description: "Three interactive 3D vaults. Four quick rounds. Play against the computer or invite 2–8 friends. Biggest loot wins.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body>{children}</body></html>;
}
