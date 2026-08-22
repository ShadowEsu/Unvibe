"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";
import { formatBytes, type ReleasePlatformAssets } from "@/lib/releases";
import { track } from "@/lib/analytics";

type DetectedOs = "mac-arm" | "mac-intel" | "windows" | "unknown";

/**
 * Best-effort platform guess used only to highlight a default button — both mac
 * downloads are always offered since the user agent cannot reliably tell Apple
 * Silicon apart from Intel Macs.
 */
function detectOs(): DetectedOs {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "windows";
  if (/Mac/i.test(ua)) return "mac-arm";
  return "unknown";
}

interface DownloadButtonsProps {
  assets: ReleasePlatformAssets;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function DownloadButtons({ assets, size = "lg", className }: DownloadButtonsProps) {
  const [detected, setDetected] = useState<DetectedOs>("unknown");

  useEffect(() => {
    setDetected(detectOs());
  }, []);

  const options: Array<{
    key: string;
    label: string;
    asset: (typeof assets)["macArm64"];
    recommended: boolean;
  }> = [
    {
      key: "mac-arm",
      label: "macOS (Apple Silicon)",
      asset: assets.macArm64,
      recommended: detected === "mac-arm",
    },
    {
      key: "mac-intel",
      label: "macOS (Intel)",
      asset: assets.macIntel,
      recommended: detected === "mac-intel",
    },
    {
      key: "windows",
      label: "Windows",
      asset: assets.windowsInstaller ?? assets.windowsPortable,
      recommended: detected === "windows",
    },
  ].filter((o) => o.asset);

  if (options.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-3", className)}>
      {options.map((option) => (
        <Button
          key={option.key}
          href={option.asset!.url}
          size={size}
          variant={option.recommended ? "primary" : "secondary"}
          onClick={() => track("release_download_clicked", { platform: option.key })}
        >
          <Download size={16} aria-hidden="true" />
          {option.label}
          {option.asset!.sizeBytes > 0 && (
            <span className="text-fg-faint">({formatBytes(option.asset!.sizeBytes)})</span>
          )}
        </Button>
      ))}
    </div>
  );
}
