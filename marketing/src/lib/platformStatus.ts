export type Platform = 'mac' | 'windows';

export interface PlatformStatus {
  availability: 'paused';
  label: string;
  detail: string;
}

/** The sole public source of platform availability. Update this only after release health passes. */
export const PLATFORM_STATUS: Record<Platform, PlatformStatus> = {
  mac: {
    availability: 'paused',
    label: 'Mac public download paused',
    detail: 'A Developer ID signed and notarized Mac build is in preparation. Join the product updates list for the verified release.',
  },
  windows: {
    availability: 'paused',
    label: 'Windows preview paused',
    detail: 'Windows sign-in reliability is under active repair. We will reopen access after a clean-machine sign-in test passes.',
  },
};
