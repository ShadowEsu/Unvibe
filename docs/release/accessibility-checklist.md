# Accessibility checklist

Automated type/build tests are only a floor. Complete this keyboard and VoiceOver pass on the packaged candidate.

- Traverse every interactive control with keyboard only; focus must be visible and follow visual order.
- Open/close floating bar, widgets, companion navigation, dialogs, sign-in, and deletion without a pointer.
- Confirm buttons have meaningful accessible names, status changes announce without stealing focus, and dialogs expose name/role and restore focus.
- Confirm syntax-highlighted code remains selectable/readable as text and does not rely on color alone.
- At 200% zoom or increased text size, no essential control is clipped; widgets remain movable/recoverable.
- With Reduce Motion, animations are removed or shortened; with increased contrast/dark appearance, black/white states remain legible.
- VoiceOver reads sync/offline/auth status, form errors, comprehension choices, and destructive confirmation in context.
- Permission-denied and service-error states state what happened and the next action.

Record issues with screen, control, keyboard sequence, expected/actual behavior, OS version, and severity. WCAG conformance is not claimed by this checklist.
