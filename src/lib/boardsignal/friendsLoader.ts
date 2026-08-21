/**
 * Keeps the Friends initial overview fetch tied to authentication identity only.
 * Parent render/callback identity changes must never create another initial load.
 */
export function shouldRunInitialFriendsLoad(previousToken: string | undefined, token: string) {
  return Boolean(token) && previousToken !== token;
}
