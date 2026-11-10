import { useEffect, useRef } from "react";
import { API_URL } from "../context/AuthContext";

// Custom hook: keeps a live Server-Sent Events (SSE) connection to the backend.
//
// Why fetch() and not the built-in EventSource?
// EventSource cannot send an "Authorization" header, so the JWT would have to
// go in the URL (where it ends up in logs and history). fetch() lets us keep
// the token in a header and still read the stream chunk by chunk.
//
// onNotification(notification) runs for every notification pushed by the server.
// onStatus(true | false) tells the caller whether the connection is open.
// If the connection drops, it reconnects automatically (waiting a little longer each time).

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function useNotificationStream(token, onNotification, onStatus) {
  // Keep the newest callbacks in refs so the connection is not restarted
  // every time the parent component re-renders.
  const notificationRef = useRef(onNotification);
  const statusRef = useRef(onStatus);

  useEffect(() => {
    notificationRef.current = onNotification;
    statusRef.current = onStatus;
  });

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();

    async function connect() {
      let delay = 2000;

      while (!controller.signal.aborted) {
        try {
          const res = await fetch(`${API_URL}/api/notifications/stream`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });

          // Expired / invalid token: reconnecting will not help
          if (res.status === 401) return;
          if (!res.ok || !res.body) throw new Error("Stream failed");

          statusRef.current?.(true);
          delay = 2000; // connected fine - reset the back-off

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // SSE messages are separated by a blank line
            const messages = buffer.split("\n\n");
            buffer = messages.pop(); // last piece may be incomplete

            for (const message of messages) {
              let eventName = "message";
              let data = "";

              for (const line of message.split("\n")) {
                if (line.startsWith("event:")) eventName = line.slice(6).trim();
                else if (line.startsWith("data:")) data += line.slice(5).trim();
                // lines starting with ":" are heartbeat comments - ignore
              }

              if (eventName === "notification" && data) {
                notificationRef.current?.(JSON.parse(data));
              }
            }
          }
        } catch {
          if (controller.signal.aborted) return;
        }

        statusRef.current?.(false);
        await wait(delay);
        delay = Math.min(delay * 2, 15000);
      }
    }

    connect();

    // Cleanup: logging out (token -> null) or leaving the app closes the stream
    return () => controller.abort();
  }, [token]);
}
