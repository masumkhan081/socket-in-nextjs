import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Invitation from '@/models/Invitation';
import User from '@/models/User';
import { verifyToken } from '@/lib/auth';

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
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Connect to the database
    await connectToDatabase();

    // Get invitations for the user (either as sender or recipient)
    const invitations = await Invitation.find({
      $or: [
        { sender: user.id },
        { recipient: user.id }
      ]
    })
    .populate('sender', 'name email')
    .populate('recipient', 'name email')
    .sort({ createdAt: -1 });

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error('Get invitations error:', error);
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

    // Populate sender information for the response
    await invitation.populate('sender', 'name email');
    await invitation.populate('recipient', 'name email');

    // Note: In a production app, we would emit socket events here
    // But for this demo, we'll rely on the client polling for new invitations
    console.log('New invitation created:', invitation._id);

    return NextResponse.json({ invitation });
  } catch (error) {
    console.error('Create invitation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
