// Load environment variables from .env files
require('dotenv').config();

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');
const mongoose = require('mongoose');

// Import models
const Message = require('./src/models/Message');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// We'll initialize socket.io after the app is prepared
let io;

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Connect to the database
connectDB();

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
      
      // Handle private messages
      socket.on('send_message', async (data) => {
        try {
          const { recipientId, message } = data;
          const recipientSocketId = connectedUsers.get(recipientId);
          
          // Create and save message to database
          const newMessage = new Message({
            senderId: userId,
            recipientId: recipientId,
            content: message,
            read: false,
            createdAt: new Date()
          });
          
          const savedMessage = await newMessage.save();
          const messageObj = savedMessage.toObject();
          
          // Send to recipient if online
          if (recipientSocketId) {
            io.to(recipientSocketId).emit('new_message', {
              message: messageObj,
              from: socket.user
            });
          }
          
          // Send confirmation back to sender
          socket.emit('message_sent', messageObj);
        } catch (error) {
          console.error('Error saving message:', error);
          socket.emit('message_error', { error: 'Failed to send message' });
        }
      });
      
      // Handle message read status
      socket.on('mark_message_read', async (messageId) => {
        try {
          const message = await Message.findByIdAndUpdate(
            messageId,
            { read: true },
            { new: true }
          );
          
          if (message) {
            const senderSocketId = connectedUsers.get(message.senderId.toString());
            if (senderSocketId) {
              io.to(senderSocketId).emit('message_read', messageId);
            }
          }
        } catch (error) {
          console.error('Error marking message as read:', error);
        }
      });
      
      // Handle get messages request with pagination
      socket.on('get_messages', async (data) => {
        try {
          const { otherUserId, page = 1, limit = 10 } = data;
          const skip = (page - 1) * limit;
          
          // Query messages between the two users
          const messages = await Message.find({
            $or: [
              { senderId: userId, recipientId: otherUserId },
              { senderId: otherUserId, recipientId: userId }
            ]
          })
            .sort({ createdAt: -1 }) // Sort by newest first
            .skip(skip)
            .limit(limit)
            .lean();
          
          // Get total count for pagination info
          const totalCount = await Message.countDocuments({
            $or: [
              { senderId: userId, recipientId: otherUserId },
              { senderId: otherUserId, recipientId: userId }
            ]
          });
          
          // Mark unread messages as read
          await Message.updateMany(
            { recipientId: userId, senderId: otherUserId, read: false },
            { $set: { read: true } }
          );
          
          // Send messages and pagination info
          socket.emit('messages_list', {
            messages: messages.reverse(), // Reverse to get chronological order
            pagination: {
              total: totalCount,
              page: parseInt(page),
              limit: parseInt(limit),
              pages: Math.ceil(totalCount / limit),
              hasMore: skip + limit < totalCount,
              hasRecent: page > 1
            }
          });
          
          // Notify sender that messages were read
          messages.forEach(msg => {
            if (msg.senderId.toString() === otherUserId && !msg.read) {
              const senderSocketId = connectedUsers.get(otherUserId);
              if (senderSocketId) {
                io.to(senderSocketId).emit('message_read', msg._id);
              }
            }
          });
        } catch (error) {
          console.error('Error fetching messages:', error);
          socket.emit('message_error', { error: 'Failed to fetch messages' });
        }
      });
      
      // Handle load more messages (previous messages)
      socket.on('load_more_messages', async (data) => {
        try {
          const { otherUserId, page, limit = 10 } = data;
          const skip = (page - 1) * limit;
          
          // Query older messages
          const messages = await Message.find({
            $or: [
              { senderId: userId, recipientId: otherUserId },
              { senderId: otherUserId, recipientId: userId }
            ]
          })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
          
          const totalCount = await Message.countDocuments({
            $or: [
              { senderId: userId, recipientId: otherUserId },
              { senderId: otherUserId, recipientId: userId }
            ]
          });
          
          socket.emit('more_messages', {
            messages: messages.reverse(),
            pagination: {
              total: totalCount,
              page: parseInt(page),
              limit: parseInt(limit),
              pages: Math.ceil(totalCount / limit),
              hasMore: skip + limit < totalCount,
              hasRecent: page > 1
            }
          });
        } catch (error) {
          console.error('Error loading more messages:', error);
          socket.emit('message_error', { error: 'Failed to load more messages' });
        }
      });
      
      // Handle get recent messages
      socket.on('get_recent_messages', async (data) => {
        try {
          const { otherUserId, limit = 10 } = data;
          
          // Query the most recent messages
          const messages = await Message.find({
            $or: [
              { senderId: userId, recipientId: otherUserId },
              { senderId: otherUserId, recipientId: userId }
            ]
          })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
          
          socket.emit('recent_messages', {
            messages: messages.reverse(),
            pagination: {
              page: 1,
              limit: parseInt(limit),
              hasRecent: false
            }
          });
        } catch (error) {
          console.error('Error fetching recent messages:', error);
          socket.emit('message_error', { error: 'Failed to fetch recent messages' });
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
