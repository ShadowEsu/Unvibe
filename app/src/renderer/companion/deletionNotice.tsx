/**
 * The service's note after a confirmed account deletion (for example, a record it will finish removing
 * later). Rendered as a text node, so markup in the message shows as text and never runs.
 */
export function DeletionNotice({ message }: { message: string }) {
  if (!message) return null;
  return <p className="login__card-copy" role="status">{message}</p>;
}
