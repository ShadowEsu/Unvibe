import { useEffect, useRef } from 'react';

/**
 * The device code a sign-in card is waiting on. When the card closes with its code still waiting, main drops it, so
 * approving that code later in a browser signs nobody in (Security NIT, 0.1.55). Set it when main hands the code over;
 * clear it when main reports the sign-in finished or failed (main has stopped polling then).
 */
export function useDeviceCodeDroppedOnClose(): { current: string } {
  const waiting = useRef('');
  useEffect(() => () => {
    if (waiting.current) void window.unvibe.cancelDeviceAuth(waiting.current);
  }, []);
  return waiting;
}
