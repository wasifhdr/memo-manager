import type { Metadata } from "next";
import { Source_Serif_4, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const serif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

const sans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
      className={`${serif.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/*
          THESIS: the memo IS the interface — routing state reads like the routing
          slip stapled to a real paper file, not a SaaS status widget.
          OWN-WORLD: cool paper-white ground, graphite ink, one stamp-ink blue
          accent; status = green/amber/crimson/slate pill badges, priority = a
          disjoint violet/magenta tag family, so the two never share a hue.
          Source Serif 4 for the document itself, IBM Plex Sans for chrome,
          IBM Plex Mono (tabular figures) for memo numbers, dates, reference IDs.
          STORY: whoever opens a memo sees, in order, what happened, what is
          happening, and who is responsible next — on a phone as readily as a desk.
          FIRST VIEWPORT: the memo detail page's workflow rail — completed steps
          struck quiet, the current step raised with the responsible name and
          required action, future steps ghosted — is the surface every other
          screen is built to match.
          FORM: brief-pinned during design approval (§9 of the approved design
          spec); executed directly, no concept tournament — Operate-mode B2B
          tool, no image generation available.
          FINISH: unreviewed and undocumented is unfinished; this build ends
          with the finish review, the verdict, DESIGN.md, and every shipping
          raster carrying its provenance.
        */}
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
