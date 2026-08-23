"use client";

import Image from "next/image";
import { Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

const apps = [
  { name: "Cursor", detail: "Select + ⌘U", src: "/tools/cursor.svg" },
  { name: "VS Code", detail: "Select + ⌘U", src: "/tools/vscode.svg" },
  { name: "JetBrains", detail: "Testing", src: "/tools/jetbrains.svg" },
  { name: "Claude Code", detail: "Workflow context", src: "/tools/claude.svg" },
  { name: "GitHub", detail: "Project context", src: "/tools/github.svg" },
] as const;

export function BrandLogos({ className }: { className?: string }) {
  return (
    <section
      className={cn("app-marquee", className)}
      aria-label="Apps and workflows Unvibe works beside"
    >
      <p>WORKS BESIDE THE TOOLS YOU ALREADY USE</p>
      <div className="app-marquee__viewport">
        <div className="app-marquee__track">
          {[0, 1].map((copy) => (
            <div className="app-marquee__group" aria-hidden={copy === 1} key={copy}>
              {apps.map((app) => (
                <div className="app-marquee__item" key={`${copy}-${app.name}`}>
                  <Image src={app.src} alt="" width={34} height={34} />
                  <span><strong>{app.name}</strong><small>{app.detail}</small></span>
                </div>
              ))}
              <div className="app-marquee__item">
                <Terminal size={31} aria-hidden="true" />
                <span><strong>Terminal</strong><small>Workflow context</small></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
