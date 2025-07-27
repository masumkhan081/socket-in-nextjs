import { Server } from 'socket.io';
import { socketAuthMiddleware } from './auth';

let io;

export function initSocket(server) {
  if (io) return io;
  
  io = new Server(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Apply authentication middleware
  io.use(socketAuthMiddleware);

  // Store connected users with their socket IDs
  const connectedUsers = new Map();

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    
    console.log(`User connected: ${userId}`);
    
    // Store user connection
    connectedUsers.set(userId, socket.id);
    
    // Update user's online status
    socket.broadcast.emit('user_status_change', { userId, isOnline: true });
    
    // Handle invitation events
    socket.on('send_invitation', (data) => {
      const { recipientId } = data;
      const recipientSocketId = connectedUsers.get(recipientId);
      
      if (recipientSocketId) {
        // If recipient is online, send real-time notification
        io.to(recipientSocketId).emit('new_invitation', {
          from: socket.user,
          invitation: data
        });
      }
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${userId}`);
      
      // Remove from connected users
      connectedUsers.delete(userId);
      
      // Update user's online status
      socket.broadcast.emit('user_status_change', { userId, isOnline: false });
    });
  });

  return io;
}

export function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized. You must call initSocket first.');
  }
  return io;
}
