const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** FNV-1a over the state's JSON, for comparing runs. Not collision-proof, and not for security. */
export function hashState(state: unknown): string {
  const text = JSON.stringify(state);
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), FNV_PRIME);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
