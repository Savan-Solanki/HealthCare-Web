import { io, Socket } from 'socket.io-client';
import { getSocketOrigin } from './api-url';

let socket: Socket | null = null;

export const getSocket = (): Socket | null => {
  if (typeof window === 'undefined') return null;

  const token = sessionStorage.getItem('access_token');
  if (!token) {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    return null;
  }

  if (!socket) {
    const socketOrigin = getSocketOrigin();

    // Browsers on HTTPS pages (e.g. Vercel) block unencrypted WebSocket connections to http:// IP hosts due to TLS policies.
    // Prevent TLS error console spam by skipping socket initialization when accessing an HTTP backend from HTTPS.
    if (typeof window !== 'undefined' && window.location?.protocol === 'https:' && socketOrigin.startsWith('http://')) {
      console.log('[Socket] Realtime WebSockets disabled on HTTPS browser for unencrypted HTTP backend origin.');
      return null;
    }

    socket = io(`${socketOrigin}/staff`, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 3,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected to staff websocket namespace.');
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected from staff websocket:', reason);
      if (reason === 'io server disconnect') {
        // Redirect or reconnect
        socket?.connect();
      }
    });
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
export default getSocket;
