const socketsByUser = new Map();

export function addSocket(userId, socketId) {
  const key = String(userId);
  if (!socketsByUser.has(key)) socketsByUser.set(key, new Set());
  socketsByUser.get(key).add(socketId);
}

export function removeSocket(userId, socketId) {
  const key = String(userId);
  const sockets = socketsByUser.get(key);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) socketsByUser.delete(key);
}

export function onlineUserIds() {
  return [...socketsByUser.keys()];
}

export function socketIdsFor(userId) {
  return [...(socketsByUser.get(String(userId)) || [])];
}
