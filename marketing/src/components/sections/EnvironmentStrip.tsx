"use client";

import { cn } from "@/lib/utils";

/*
  Marquee of the environments Unvibe is meant to sit beside. Because Unvibe works from
  what you select on your Mac rather than integrating into one editor, these are labelled
  honestly as "Targeted" (validated in early testing) or "Planned" — never presented as
  finished integrations.
*/

interface Env {
  name: string;
  status: "Targeted" | "Planned";
}

const envs: Env[] = [
  { name: "Cursor", status: "Targeted" },
  { name: "VS Code", status: "Targeted" },
  { name: "Terminal", status: "Targeted" },
  { name: "Claude Code", status: "Targeted" },
  { name: "GitHub", status: "Planned" },
  { name: "Zed", status: "Planned" },
  { name: "JetBrains", status: "Planned" },
  { name: "Xcode", status: "Planned" },
  { name: "Neovim", status: "Planned" },
];

function Pill({ env }: { env: Env }) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap rounded-pill border border-line bg-surface px-4 py-2">
      <span className="text-fluid-sm font-medium text-fg">{env.name}</span>
      <span
        className={cn(
          "rounded-pill px-1.5 py-0.5 text-[0.62rem] uppercase tracking-wide",
          env.status === "Targeted"
            ? "bg-primary-soft text-primary"
            : "bg-surface-2 text-fg-faint"
        )}
      >
        {env.status}
      </span>
    </div>
  );
}

export function EnvironmentStrip() {
  return (
    <section
      aria-label="Environments Unvibe works alongside"
      className="border-y border-line bg-surface-2/40 py-8"
    >
      <p className="container-page mb-6 text-center text-fluid-sm text-fg-faint">
        Built to sit beside the tools you already use
      </p>

      {/* Marquee on wider screens; pauses on hover and focus-within. */}
      <div className="group mask-fade-x hidden overflow-hidden sm:block">
        <div className="flex w-max gap-3 animate-marquee group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused] motion-reduce:animate-none motion-reduce:justify-center">
          {[...envs, ...envs].map((env, i) => (
            <Pill key={`${env.name}-${i}`} env={env} />
          ))}
        </div>
      </div>

      {/* Grid on mobile. */}
      <div className="container-page grid grid-cols-2 gap-2 sm:hidden">
        {envs.map((env) => (
          <Pill key={env.name} env={env} />
        ))}
      </div>
    </section>
  );
}
