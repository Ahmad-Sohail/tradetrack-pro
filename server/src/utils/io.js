let io = null;
export const setIo = (i) => { io = i; };
export const emitTo = (room, event, payload) => { if (io) io.to(room).emit(event, payload); };
