/**
 * A checkout intent could not be created because one is already open: one pending intent per
 * workspace, and one pending Teams intent per owner across workspaces. Enforced by unique indexes
 * on checkout_intents (and mirrored by the memory store), so parallel requests cannot both win.
 */
export class CheckoutPendingError extends Error {
  constructor() {
    super('A checkout is already open.');
    this.name = 'CheckoutPendingError';
  }
}
