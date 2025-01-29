import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const rooms = new Map<string, Map<string, string>>();

io.on('connection', (socket) => {
  socket.on('join-room', ({ roomId, userName }: { roomId: string; userName: string }) => {
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }
    
    const room = rooms.get(roomId)!;
    room.set(socket.id, userName);

    const usersInRoom = Array.from(room.entries()).map(([id, name]) => ({
      id,
      userName: name,
    }));

    socket.to(roomId).emit('user-joined', { signal: null, callerId: socket.id });
    socket.emit('all-users', usersInRoom.filter(user => user.id !== socket.id));
  });

  socket.on('sending-signal', ({ userToSignal, callerId, signal }: { userToSignal: string; callerId: string; signal: any }) => {
    io.to(userToSignal).emit('user-joined', { signal, callerId });
  });

  socket.on('returning-signal', ({ signal, callerId }: { signal: any; callerId: string }) => {
    io.to(callerId).emit('receiving-returned-signal', { signal, id: socket.id });
  });

  socket.on('send-message', ({ roomId, message, userName }: { roomId: string; message: string; userName: string }) => {
    socket.to(roomId).emit('receive-message', { user: userName, text: message });
  });

  socket.on('screen-share', ({ roomId, stream }: { roomId: string; stream: any }) => {
    socket.to(roomId).emit('user-screen-share', {
      peerId: socket.id,
      stream
    });
  });

  socket.on('screen-share-ended', ({ roomId }: { roomId: string }) => {
    socket.to(roomId).emit('user-screen-share-ended', {
      peerId: socket.id
    });
  });

  socket.on('disconnect', () => {
    rooms.forEach((room, roomId) => {
      if (room.has(socket.id)) {
        room.delete(socket.id);
        socket.to(roomId).emit('user-left', socket.id);
      }
    });
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 