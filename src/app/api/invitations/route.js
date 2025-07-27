import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Invitation from '@/models/Invitation';
import User from '@/models/User';
import { verifyToken } from '@/lib/auth';
import { getIO } from '@/lib/socket';

// Middleware to verify authentication
async function authenticate(request) {
  const token = request.headers.get('authorization')?.split(' ')[1];
  
  if (!token) {
    return null;
  }

  const decoded = verifyToken(token);
  return decoded;
}

export async function GET(request) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Extract and verify token
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    // Get query parameters
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    
    // Connect to the database
    await connectToDatabase();

    // Build query
    const query = {
      $or: [
        { sender: decoded.id },
        { recipient: decoded.id }
      ]
    };
    
    // Add status filter if provided
    if (status) {
      query.status = status;
    }

    // Find invitations based on query
    const invitations = await Invitation.find(query)
      .populate('sender', 'name email isOnline')
      .populate('recipient', 'name email isOnline')
      .sort({ createdAt: -1 });

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error('Error fetching invitations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { recipientEmail } = await request.json();

    // Connect to the database
    await connectToDatabase();

    // Find recipient user
    const recipient = await User.findOne({ email: recipientEmail });
    if (!recipient) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
    }

    // Check if invitation already exists
    const existingInvitation = await Invitation.findOne({
      sender: user.id,
      recipient: recipient._id,
      status: 'pending'
    });

    if (existingInvitation) {
      return NextResponse.json({ error: 'Invitation already sent' }, { status: 400 });
    }

    // Create new invitation
    const invitation = new Invitation({
      sender: user.id,
      recipient: recipient._id,
      recipientEmail,
      status: 'pending'
    });

    await invitation.save();

    // Populate the sender and recipient fields
    await invitation.populate('sender', 'name email');
    await invitation.populate('recipient', 'name email');

    // Emit real-time invitation event to recipient
    try {
      const io = getIO();
      io.emit('new_invitation', {
        _id: invitation._id,
        sender: invitation.sender,
        recipient: invitation.recipient,
        status: invitation.status,
        createdAt: invitation.createdAt
      });
      console.log('Real-time invitation event emitted:', invitation._id);
    } catch (socketError) {
      console.log('Socket not available, invitation saved to DB only');
    }

    return NextResponse.json({ invitation });
  } catch (error) {
    console.error('Create invitation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
