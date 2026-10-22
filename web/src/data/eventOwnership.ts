/**
 * Event ids are client-generated and globally unique (events.id is the primary key). A write that
 * names an id another account already owns is refused as a whole, never re-assigned.
 */
export class EventOwnershipError extends Error {
  constructor(readonly eventIds: string[]) {
    super('Some events belong to a different account.');
    this.name = 'EventOwnershipError';
  }
}
