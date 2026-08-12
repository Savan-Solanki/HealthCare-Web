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
    socket = io(`${socketOrigin}/staff`, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
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
