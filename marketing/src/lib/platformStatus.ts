export type Platform = "mac" | "windows";

export interface PlatformStatus {
  availability: "unsigned_beta";
  label: string;
  detail: string;
}

/** The sole public source of platform availability. Both downloads are clearly labelled beta builds until platform signing is complete. */
export const PLATFORM_STATUS: Record<Platform, PlatformStatus> = {
  mac: {
    availability: "unsigned_beta",
    label: "Mac public beta",
    detail: "Apple-silicon beta DMG. Developer ID signing and notarization are in progress; download only from this page and use macOS's normal identified-developer confirmation flow.",
  },
  windows: {
    availability: "unsigned_beta",
    label: "Windows public beta",
    detail: "Windows x64 portable beta. Authenticode signing and a clean-machine sign-in check are in progress; download only from this page and keep Windows security protections enabled.",
  },
};
