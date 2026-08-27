import { Server } from 'socket.io';

let io = null;

export function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    },
  });

  io.on('connection', (socket) => {
    socket.on('join_user', (userId) => {
      if (userId) {
        socket.join(`user:${userId}`);
      }
    });
  });

  return io;
}

export function getIo() {
  return io;
}

export function emitEvent(event, data = {}) {
  if (io) {
    io.emit(event, { ...data, timestamp: Date.now() });
  }
}

export function emitToUser(userId, event, data = {}) {
  if (io && userId) {
    io.to(`user:${userId}`).emit(event, { ...data, timestamp: Date.now() });
  }
}
