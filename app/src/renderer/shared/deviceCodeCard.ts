import { useEffect, useMemo } from 'react';

export interface CardDeviceCode {
  /** Main handed this card its code. A card that already closed drops it at once (Security SHOULD-2 on #354). */
  arrived(userCode: string): void;
  /** Main reported the sign-in finished or failed: it has stopped polling, so there is nothing to drop. */
  ended(): void;
}

/**
 * The device code a sign-in card is waiting on. When the card closes with its code still waiting, it is dropped, so
 * approving that code later in a browser signs nobody in (Security NIT, 0.1.55). So is a code that arrives after the
 * card closed (the code can take seconds on a cold server).
 */
export function createCardDeviceCode(drop: (userCode: string) => void): CardDeviceCode & { opened(): void; closed(): void } {
  let waiting = '';
  let isClosed = false;
  return {
    opened() {
      isClosed = false;
    },
    closed() {
      isClosed = true;
      if (waiting) drop(waiting);
      waiting = '';
    },
    arrived(userCode) {
      if (isClosed) drop(userCode);
      else waiting = userCode;
    },
    ended() {
      waiting = '';
    },
  };
}

/** A sign-in card's device code, dropped in main when the card closes. Closing the whole window is main's to handle: a destroyed page runs no cleanup. */
export function useDeviceCodeDroppedOnClose(): CardDeviceCode {
  const card = useMemo(() => createCardDeviceCode((userCode) => void window.unvibe.cancelDeviceAuth(userCode)), []);
  useEffect(() => {
    card.opened();
    return () => card.closed();
  }, [card]);
  return card;
}
