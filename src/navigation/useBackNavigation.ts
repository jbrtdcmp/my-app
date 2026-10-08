import { useCallback } from 'react';
import { isPathInRoleTree, type AppRole } from './roleRoutes';

export function useBackNavigation(role: AppRole, fallbackPath: string, onFallback: () => void) {
  return useCallback(() => {
    const state = window.history.state as { role?: AppRole; previousPath?: string } | null;
    if (state?.role === role && state.previousPath && isPathInRoleTree(role, state.previousPath)) {
      window.history.back();
      return;
    }
    window.history.replaceState({ role, routePath: fallbackPath }, '', fallbackPath);
    onFallback();
  }, [fallbackPath, onFallback, role]);
}
