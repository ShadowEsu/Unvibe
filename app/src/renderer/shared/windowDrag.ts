/**
 * Moving a frameless window by hand (0.1.54: the floating Island and the overlay's header). The OS drag region
 * (`-webkit-app-region: drag`) can't be used: it swallows double-clicks and hover, and the Island window never takes
 * focus. A press that travels 4 px becomes a drag; main moves the window by the pointer's travel since the press, and
 * the click that ends a drag is swallowed so it doesn't also open or toggle anything.
 */
export const DRAG_THRESHOLD_PX = 4;

/** Whether a press has travelled far enough to count as a drag rather than a click. */
export function pastDragThreshold(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX;
}

export interface WindowDragHooks {
  /** The drag began (the press passed the threshold). */
  start(): void;
  /** The pointer's travel since the press, in screen pixels. */
  move(dx: number, dy: number): void;
  end(): void;
  /** Presses on these never start a drag (buttons keep working). */
  ignore?: string;
}

/** A pointerdown handler that turns a press-and-move into a window drag. */
export function windowDragHandler(hooks: WindowDragHooks): (event: PointerEvent | React.PointerEvent) => void {
  return (down) => {
    if (down.button !== 0 || !down.isPrimary) return;
    const target = down.target as Element | null;
    if (hooks.ignore && target?.closest(hooks.ignore)) return;
    const surface = down.currentTarget as Element;
    const { pointerId, screenX: x0, screenY: y0 } = down;
    let dragging = false;
    let frame = 0;
    let travel = { dx: 0, dy: 0 };
    surface.setPointerCapture?.(pointerId);
    const flush = () => {
      frame = 0;
      hooks.move(travel.dx, travel.dy);
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      travel = { dx: event.screenX - x0, dy: event.screenY - y0 };
      if (!dragging) {
        if (!pastDragThreshold(travel.dx, travel.dy)) return;
        dragging = true;
        hooks.start();
      }
      if (!frame) frame = requestAnimationFrame(flush);
    };
    // Ends once: on release, on cancel, or when the page loses the pointer some other way (lostpointercapture: the
    // window hid, another app took the mouse). A drag that never ends would leave main holding the window still.
    let done = false;
    const finish = (event: PointerEvent) => {
      if (done || event.pointerId !== pointerId) return;
      done = true;
      for (const type of ['pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
        surface.removeEventListener(type, (type === 'pointermove' ? onMove : finish) as EventListener);
      }
      if (surface.hasPointerCapture?.(pointerId)) surface.releasePointerCapture(pointerId);
      if (!dragging) return;
      if (frame) cancelAnimationFrame(frame);
      flush();
      hooks.end();
      // The click that follows this pointerup belongs to the drag.
      const swallow = (click: Event) => { click.stopPropagation(); click.preventDefault(); };
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
    };
    surface.addEventListener('pointermove', onMove as EventListener);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) surface.addEventListener(type, finish as EventListener);
  };
}

/** The 16 px step an arrow key moves the overlay by, as a direction; other keys give null. */
export function arrowStep(key: string): { dx: number; dy: number } | null {
  switch (key) {
    case 'ArrowLeft': return { dx: -1, dy: 0 };
    case 'ArrowRight': return { dx: 1, dy: 0 };
    case 'ArrowUp': return { dx: 0, dy: -1 };
    case 'ArrowDown': return { dx: 0, dy: 1 };
    default: return null;
  }
}
