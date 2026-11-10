/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";
import Swal from "sweetalert2";
import { useAuth, API_URL } from "./AuthContext";
import { useNotificationStream } from "../hooks/useNotificationStream";

// Holds the logged-in user's notifications for the whole app, so the header
// badge and the dashboard always show the same live data.

const NotificationsContext = createContext(null);

const initialState = { items: [], unread: 0, connected: false };

// All the ways the notification list can change, in one place
function reducer(state, action) {
  switch (action.type) {
    case "loaded":
      return { ...state, items: action.items, unread: action.items.filter((n) => !n.read).length };
    case "received": {
      // Ignore duplicates (a list refresh can overlap with a live message)
      if (state.items.some((n) => n.id === action.item.id)) return state;
      return { ...state, items: [action.item, ...state.items], unread: state.unread + 1 };
    }
    case "allRead":
      return { ...state, items: state.items.map((n) => ({ ...n, read: true })), unread: 0 };
    case "connection":
      return { ...state, connected: action.connected };
    case "reset":
      return initialState;
    default:
      return state;
  }
}

// Small pop-up in the corner when something new arrives
const toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 4000,
  timerProgressBar: true,
});

export function NotificationsProvider({ children }) {
  const { token } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);

  // Live messages from the server
  useNotificationStream(
    token,
    (item) => {
      dispatch({ type: "received", item });
      toast.fire({ icon: "info", title: `${item.fromName} liked your post`, text: item.postTitle });
    },
    (connected) => dispatch({ type: "connection", connected })
  );

  // Load the saved history when the user logs in, and again whenever the live
  // connection comes back (so nothing is missed while it was down)
  useEffect(() => {
    if (!token) {
      dispatch({ type: "reset" });
      return;
    }

    const controller = new AbortController();

    async function loadHistory() {
      try {
        const res = await fetch(`${API_URL}/api/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        dispatch({ type: "loaded", items: data.notifications });
      } catch {
        // network error or aborted - the live stream will still deliver new ones
      }
    }

    loadHistory();
    return () => controller.abort();
  }, [token, state.connected]);

  // Mark everything as read: update the screen first, then tell the server
  const markAllRead = useCallback(async () => {
    dispatch({ type: "allRead" });
    try {
      await fetch(`${API_URL}/api/notifications/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // not critical - they will show as unread again after a refresh
    }
  }, [token]);

  const value = useMemo(() => ({ ...state, markAllRead }), [state, markAllRead]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
