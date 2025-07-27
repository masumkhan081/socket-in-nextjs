// Load environment variables from .env files
require('dotenv').config();

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// We'll initialize socket.io after the app is prepared
let io;

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });
  
  // Start the server
  server.listen(3000, (err) => {
    if (err) throw err;
    console.log('> Ready on http://localhost:3000');
    
    // Initialize socket.io with a simple implementation
    const { Server } = require('socket.io');
    io = new Server(server, {
      cors: {
        origin: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      }
    });
    
    // Simple authentication middleware
    io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      try {
        // In a real app, you'd verify the JWT here
        // For now, we'll just accept any token
        socket.user = { id: 'user-id', email: 'user@example.com' };
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });
    
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
  });
});
