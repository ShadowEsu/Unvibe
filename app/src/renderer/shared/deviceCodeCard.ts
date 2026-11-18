import { useEffect, useMemo } from 'react';

export interface CardDeviceCode {
  /** Continue with Google was pressed: main is asking the server for a code. */
  starting(): void;
  /** Main handed this card its code. A card that already closed drops it at once (Security SHOULD-2 on #354). */
  arrived(userCode: string): void;
  /** The start failed, or main reported the sign-in finished or failed: there is nothing left to drop. */
  ended(): void;
}

export interface CardDeviceCodeDrops {
  /** Drop this card's code in main. */
  drop(userCode: string): void;
  /** Main is still asking the server for this card's code: neither open the browser nor poll once it comes (lead N2). */
  dropStart(): void;
}

/**
 * The device code a sign-in card is waiting on. When the card closes with its code still waiting, it is dropped, so
 * approving that code later in a browser signs nobody in (Security NIT, 0.1.55). A card that closes while the code is
 * still being made (seconds on a cold server) drops the start, and a code that arrives after the close anyway is
 * dropped at once.
 */
export function createCardDeviceCode(drops: CardDeviceCodeDrops): CardDeviceCode & { opened(): void; closed(): void } {
  let waiting = '';
  let asking = false;
  let isClosed = false;
  return {
    opened() {
      isClosed = false;
    },
    closed() {
      isClosed = true;
      if (waiting) drops.drop(waiting);
      else if (asking) drops.dropStart();
      waiting = '';
      asking = false;
    },
    starting() {
      asking = true;
    },
    arrived(userCode) {
      asking = false;
      if (isClosed) drops.drop(userCode);
      else waiting = userCode;
    },
    ended() {
      waiting = '';
      asking = false;
    },
  };
}

/** A sign-in card's device code, dropped in main when the card closes. Closing the whole window is main's to handle: a destroyed page runs no cleanup. */
export function useDeviceCodeDroppedOnClose(): CardDeviceCode {
  const card = useMemo(() => createCardDeviceCode({
    drop: (userCode) => void window.unvibe.cancelDeviceAuth(userCode),
    dropStart: () => void window.unvibe.cancelDeviceStart(),
  }), []);
  useEffect(() => {
    card.opened();
    return () => card.closed();
  }, [card]);
  return card;
}
