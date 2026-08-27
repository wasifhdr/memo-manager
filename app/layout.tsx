import type { Metadata } from "next";
import { Source_Serif_4, Fira_Sans, Fira_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const display = Source_Serif_4({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  display: "swap",
});

const sans = Fira_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
});

const mono = Fira_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Memo Manager",
    template: "%s · Memo Manager",
  },
  description: "Inter-office memo management, routing and approval.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/*
          Warm Editorial — redesign applied verbatim from the user's frozen
          design contract (D:/DESIGN.md, originally the "API Builder" app's
          approved system). Parchment surfaces, one dominant ink foreground,
          terracotta orange as the single action accent, hard-offset shadows
          (no blur — cards look like paper stacked on paper). Source Serif 4
          for display statements only; Fira Sans for everything else; Fira
          Mono for identifiers, memo numbers, and tabular figures. One
          deliberate adaptation: the design contract's mobile treatment
          ("nav collapses to brand + logout") is widened to a working ink
          drawer with the full nav, since §22 of the governing spec requires
          the app to stay usable on mobile, not just present.
        */}
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
