"use client";

import { useEffect, useRef, useState } from "react";
import { Apple, Monitor } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { track } from "@/lib/analytics";
import {
  DOWNLOAD_ASSETS,
  DOWNLOAD_VERSION,
  trackedDownloadPath,
  type DownloadPlatform,
} from "@/lib/downloads";
import { durations, easing } from "@/lib/motion";
import { cn } from "@/lib/utils";

function detectPreferred(): DownloadPlatform {
  if (typeof navigator === "undefined") return "mac";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("windows")) return "windows";
  return "mac";
}

function useCountUp(target: number, duration = 1500) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const animated = useRef(false);

  useEffect(() => {
    if (!inView || animated.current || target <= 0) return;
    animated.current = true;
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, target, duration]);

  return { count, ref };
}

export function Download() {
  const [preferred, setPreferred] = useState<DownloadPlatform>("mac");
  const [stats, setStats] = useState<{
    mac: number;
    windows: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    setPreferred(detectPreferred());
    void fetch("/api/download/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.total === "number") {
          setStats({
            mac: Number(data.mac) || 0,
            windows: Number(data.windows) || 0,
            total: Number(data.total) || 0,
          });
        }
      })
      .catch(() => {
        /* ignore */
      });
  }, []);

  const onDownload = (platform: DownloadPlatform, source: string) => {
    track("download_clicked", { platform, source, version: DOWNLOAD_VERSION });
    track(platform === "mac" ? "download_mac" : "download_windows", {
      source,
      version: DOWNLOAD_VERSION,
    });
  };

  const totalCount = useCountUp(stats?.total ?? 0);

  return (
    <section id="download" className="container-page py-20 sm:py-28">
      <div className="mx-auto max-w-3xl text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-pill border border-primary/20 bg-primary-soft px-3.5 py-1 text-fluid-sm font-medium tracking-wide text-primary">
          Free download · v{DOWNLOAD_VERSION}
        </span>
        <h2 className="mt-4 text-balance text-fluid-3xl font-semibold tracking-tight text-fg">
          Download Unvibe free
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-fluid-lg leading-relaxed text-fg-muted">
          The desktop learning layer for AI-written code. Completely free for Mac
          and Windows — no account required to install.
        </p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: durations.standardSlow, ease: easing.emphatic }}
          className="mx-auto mt-10 max-w-md"
        >
          <a
            href={trackedDownloadPath(preferred)}
            onClick={() => onDownload(preferred, "primary")}
            className="btn-magnetic flex h-[3.75rem] w-full items-center justify-center gap-2.5 rounded-pill bg-primary px-8 text-fluid-base font-semibold text-on-primary shadow-soft transition-colors hover:bg-primary-strong"
          >
            {preferred === "mac" ? (
              <Apple className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Monitor className="h-5 w-5" aria-hidden="true" />
            )}
            Download for {DOWNLOAD_ASSETS[preferred].label} — Free
          </a>
          <p className="mt-3 text-fluid-sm text-fg-faint">
            {DOWNLOAD_ASSETS[preferred].arch} · {DOWNLOAD_ASSETS[preferred].hint}
          </p>
        </motion.div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {(Object.keys(DOWNLOAD_ASSETS) as DownloadPlatform[]).map(
            (platform) => {
              const asset = DOWNLOAD_ASSETS[platform];
              const Icon = platform === "mac" ? Apple : Monitor;
              const count =
                platform === "mac" ? stats?.mac : stats?.windows;
              const isPreferred = platform === preferred;
              return (
                <motion.a
                  key={platform}
                  href={trackedDownloadPath(platform)}
                  onClick={() => onDownload(platform, "card")}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: durations.standardSlow,
                    ease: easing.emphatic,
                    delay: platform === "mac" ? 0 : 0.1,
                  }}
                  className={cn(
                    "card-hover group rounded-card border bg-surface p-6 text-left transition-colors",
                    isPreferred
                      ? "border-primary/40 shadow-soft"
                      : "border-line hover:border-line-strong hover:bg-surface-2"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-bg">
                      <Icon className="h-5 w-5 text-fg" aria-hidden="true" />
                    </div>
                    {typeof count === "number" && count > 0 ? (
                      <span className="rounded-pill border border-line bg-bg px-3 py-1 text-[0.72rem] text-fg-faint">
                        {count.toLocaleString()} downloads
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-5 text-fluid-xl font-semibold tracking-tight text-fg">
                    Download for {asset.label}
                  </h3>
                  <p className="mt-2 text-fluid-sm text-fg-muted">
                    {asset.arch}. {asset.hint}.
                  </p>
                  <p className="mt-5 text-fluid-sm font-medium text-primary group-hover:underline">
                    Get the free installer →
                  </p>
                </motion.a>
              );
            }
          )}
        </div>

        <div ref={totalCount.ref} className="mt-10">
          {stats && stats.total > 0 ? (
            <p className="text-fluid-lg font-semibold text-fg">
              {totalCount.count.toLocaleString()} free downloads and counting
            </p>
          ) : (
            <p className="text-fluid-sm text-fg-faint">
              Unsigned beta: on Mac, right-click → Open the first time. On Windows,
              choose More info → Run anyway if SmartScreen appears.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
