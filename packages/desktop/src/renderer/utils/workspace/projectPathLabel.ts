/**
 * Last two path segments (parent/current) of a workspace path, e.g.
 * "Sudda_Working/GameClient". Falls back to the last segment (or the raw path)
 * when fewer than two segments are present. Used to disambiguate folders that
 * share the same leaf name in pickers and the project list.
 */
export const getParentAndCurrentDir = (path: string): string => {
  const parts = path.split(/[\\/]+/).filter(Boolean);
  return parts.slice(-2).join('/') || path;
};
