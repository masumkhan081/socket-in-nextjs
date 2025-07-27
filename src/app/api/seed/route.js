import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import User from '@/models/User';
import { demoUsers } from '@/data/demoUsers';

export async function GET() {
  try {
    // Connect to the database
    await connectToDatabase();

    // Check if users already exist
    const count = await User.countDocuments();
    
    if (count > 0) {
      return NextResponse.json({ 
        message: 'Database already seeded', 
        count 
      });
    }

    // Use demo users from data file
    const users = demoUsers.map(({ name, email, password }) => ({ name, email, password }));

    // Insert users
    await User.insertMany(users);

    return NextResponse.json({ 
      success: true, 
      message: 'Database seeded successfully',
      count: users.length
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
