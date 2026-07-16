/** Mock responses are available for local development; configured paid providers require a session. */
export function aiRequestRequiresSession(providerIsMock: boolean): boolean {
  return !providerIsMock;
}
