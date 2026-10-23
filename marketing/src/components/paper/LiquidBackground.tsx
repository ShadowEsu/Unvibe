import { MotionInView } from "@/components/paper/MotionInView";

/**
 * Slow-moving blurred colour blobs in the dusk palette, behind a card. Pure CSS (no WebGL),
 * so it costs one composited layer; frozen for reduced motion and lite devices, paused off-screen.
 */
export function LiquidBackground() {
  return (
    <MotionInView className="liquid" aria-hidden="true">
      <i className="liquid__blob liquid__blob--a" />
      <i className="liquid__blob liquid__blob--b" />
      <i className="liquid__blob liquid__blob--c" />
    </MotionInView>
  );
}
