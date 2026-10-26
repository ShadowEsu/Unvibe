/**
 * Deleting an account deletes the workspaces it owns, and a workspace delete takes every member's
 * learning data with it. So an owner of a team workspace with other members cannot delete the
 * account until those members are removed (Plan page). Nothing is deleted when this is thrown.
 */
export class TeamHasMembersError extends Error {
  constructor() {
    super('Remove the other members of your team on the Plan page, then delete your account.');
    this.name = 'TeamHasMembersError';
  }
}
