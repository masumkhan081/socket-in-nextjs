import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Message from '@/models/Message';
import User from '@/models/User';
import { verifyToken } from '@/lib/auth';
import { getIO } from '@/lib/socket';

// Connect to database
connectDB();

// GET messages with pagination
export async function GET(request) {
  try {
    // Verify authentication
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.userId;
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const otherUserId = searchParams.get('otherUserId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    if (!otherUserId) {
      return NextResponse.json({ error: 'otherUserId is required' }, { status: 400 });
    }

    // Calculate skip value for pagination
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

    // Return messages in chronological order for display
    return NextResponse.json({
      messages: messages.reverse(), // Reverse to get chronological order
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit),
        hasMore: skip + limit < totalCount
      }
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

// POST a new message
export async function POST(request) {
  try {
    // Verify authentication
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.userId;
    
    // Get message data
    const data = await request.json();
    const { recipientId, content } = data;
    
    if (!recipientId || !content) {
      return NextResponse.json({ error: 'recipientId and content are required' }, { status: 400 });
    }

    // Create new message
    const message = await Message.create({
      senderId: userId,
      recipientId,
      content,
      read: false,
      createdAt: new Date()
    });

    // Populate sender information for real-time event
    await message.populate('senderId', 'name email');
    
    // Emit real-time message event to recipient
    try {
      const io = getIO();
      io.emit('new_message', {
        _id: message._id,
        content: message.content,
        sender: message.senderId,
        recipient: recipientId,
        timestamp: message.createdAt,
        read: message.read
      });
    } catch (socketError) {
      console.log('Socket not available, message saved to DB only');
    }

    return NextResponse.json({ message });
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 });
  }
}
