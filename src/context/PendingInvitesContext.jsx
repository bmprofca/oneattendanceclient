import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';

import apiCall from '../utils/api';
import usePermissionAccess from '../hooks/usePermissionAccess';

const PendingInvitesContext = createContext({
  pendingInviteCount: 0,
  refreshPendingInviteCount: async () => {},
});

export function PendingInvitesProvider({ children }) {
  const { pathname } = useLocation();
  const { checkPageAccess } = usePermissionAccess();
  const canReadInvites = checkPageAccess('myInvites').allowed;
  const [pendingInviteCount, setPendingInviteCount] = useState(0);

  const refreshPendingInviteCount = useCallback(async () => {
    if (!canReadInvites) {
      setPendingInviteCount(0);
      return;
    }

    try {
      const response = await apiCall('/company/invites/my/pending-count', 'GET');
      if (!response.ok) {
        return;
      }
      const result = await response.json();
      if (result.success) {
        const count = Number(result.data?.count ?? 0);
        setPendingInviteCount(Number.isFinite(count) ? Math.max(0, count) : 0);
      }
    } catch {
      // Keep the last known count if a refresh fails.
    }
  }, [canReadInvites]);

  useEffect(() => {
    if (!canReadInvites) {
      setPendingInviteCount(0);
      return;
    }
    if (pathname === '/home' || pathname === '/my-invites') {
      refreshPendingInviteCount();
    }
  }, [canReadInvites, pathname, refreshPendingInviteCount]);

  const value = useMemo(
    () => ({ pendingInviteCount, refreshPendingInviteCount }),
    [pendingInviteCount, refreshPendingInviteCount],
  );

  return (
    <PendingInvitesContext.Provider value={value}>
      {children}
    </PendingInvitesContext.Provider>
  );
}

export function usePendingInvites() {
  return useContext(PendingInvitesContext);
}