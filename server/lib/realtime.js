let ioRef = null;

export function bindIo(io) {
  ioRef = io;
}

export function emitToUser(userId, event, payload) {
  ioRef?.to(`user:${userId}`).emit(event, payload);
}

export function emitToUsers(userIds, event, payload) {
  for (const userId of userIds || []) emitToUser(userId, event, payload);
}
