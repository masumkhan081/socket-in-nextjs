import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Invitation from '@/models/Invitation';
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

export async function PUT(request, { params }) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = params;
    const { status } = await request.json();

    // Connect to the database
    await connectToDatabase();

    // Find the invitation
    const invitation = await Invitation.findById(id);
    
    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Verify that the user is the recipient
    if (invitation.recipient.toString() !== user.id) {
      return NextResponse.json({ error: 'Not authorized to update this invitation' }, { status: 403 });
    }

    // Update invitation status
    invitation.status = status;
    await invitation.save();

    // Populate sender and recipient information
    await invitation.populate('sender', 'name email');
    await invitation.populate('recipient', 'name email');

    // Note: In a production app, we would emit socket events here
    // But for this demo, we'll rely on the client polling for updates
    console.log('Invitation updated:', invitation._id, status);

    return NextResponse.json({ invitation });
  } catch (error) {
    console.error('Update invitation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = params;

    // Connect to the database
    await connectToDatabase();

    // Find the invitation
    const invitation = await Invitation.findById(id);
    
    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Verify that the user is either the sender or recipient
    if (invitation.sender.toString() !== user.id && invitation.recipient.toString() !== user.id) {
      return NextResponse.json({ error: 'Not authorized to delete this invitation' }, { status: 403 });
    }

    // Delete the invitation
    await Invitation.findByIdAndDelete(id);

    // Note: In a production app, we would emit socket events here
    // But for this demo, we'll rely on the client polling for updates
    console.log('Invitation deleted:', id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete invitation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
