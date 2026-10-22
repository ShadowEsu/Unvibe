/** Team workspaces one person can own. Keep in lockstep with create_team_workspace (20261022133000_cap_team_workspaces_per_owner.sql). */
export const MAX_TEAM_WORKSPACES_PER_OWNER = 10;

/** The exception create_team_workspace raises at the cap. */
export const TEAM_WORKSPACE_LIMIT_MESSAGE = 'Team workspace limit reached';

/** The owner already has MAX_TEAM_WORKSPACES_PER_OWNER team workspaces; enforced in SQL under a per-owner lock and mirrored by the memory store. */
export class TeamWorkspaceLimitError extends Error {
  constructor() {
    super(TEAM_WORKSPACE_LIMIT_MESSAGE);
    this.name = 'TeamWorkspaceLimitError';
  }
}

/** The 409 answer for an owner at the cap. */
export function teamWorkspaceLimitResponse(): Response {
  return Response.json({
    error: 'team_workspace_limit',
    message: `You already own ${MAX_TEAM_WORKSPACES_PER_OWNER} team workspaces, the most one account can have.`,
  }, { status: 409 });
}
