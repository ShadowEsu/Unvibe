import Link from "next/link";
import { cn } from "@/lib/utils";

interface JoinWaitlistLinkProps {
  href: string;
  platform?: "mac" | "windows";
  size?: "hero" | "nav";
  className?: string;
  onClick?: () => void;
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.35 12.55c-.03-2.28 1.86-3.37 1.94-3.42-1.06-1.55-2.7-1.76-3.28-1.78-1.4-.14-2.73.82-3.44.82-.71 0-1.81-.8-2.98-.78-1.53.02-2.94.89-3.73 2.26-1.59 2.76-.41 6.85 1.14 9.09.76 1.1 1.66 2.33 2.84 2.29 1.14-.05 1.57-.74 2.95-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.27 1.23-2.5 1.25-2.56-.03-.01-2.39-.92-2.43-3.67zM14.4 6.48c.63-.76 1.05-1.82.93-2.88-1.08.04-2.38.72-3.15 1.62-.69.8-1.29 2.08-1.13 3.11 1.2.09 2.43-.61 3.35-1.85z"
      />
    </svg>
  );
}

function WindowsMark() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 5.4 11.2 4.2v7.4H3V5.4zm8.8-.4 9.2-1.3v9.1h-9.2V5zM3 13.2h8.2V20L3 18.8v-5.6zm8.8 0h9.2V21l-9.2-1.3v-6.5z"
      />
    </svg>
  );
}

export function JoinWaitlistLink({
  href,
  platform,
  size = "hero",
  className,
  onClick,
}: JoinWaitlistLinkProps) {
  const tone = platform === "windows" ? "win" : "mac";
  const label =
    platform === "mac"
      ? "Waitlist for Mac"
      : platform === "windows"
        ? "Waitlist for Windows"
        : "Join waitlist";

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "paper-join",
        tone === "win" ? "paper-join--win" : "paper-join--mac",
        size === "nav" && "paper-join--nav",
        className,
      )}
    >
      {platform === "mac" ? <AppleMark /> : null}
      {platform === "windows" ? <WindowsMark /> : null}
      <span className="paper-join__label">{label}</span>
    </Link>
  );
}

export function JoinWaitlistRow({ href }: { href: string }) {
  return (
    <div className="paper-join-row">
      <JoinWaitlistLink href={href} platform="mac" />
      <JoinWaitlistLink href={href} platform="windows" />
    </div>
  );
}
