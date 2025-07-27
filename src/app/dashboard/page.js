'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function Dashboard() {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [invitations, setInvitations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);

  const router = useRouter();
  const { user, logout, getToken, socket } = useAuth();

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    // Fetch invitations
    fetchInvitations();
    
    // Fetch users
    fetchUsers();
  }, [user]);

  // Fetch invitations
  useEffect(() => {
    if (user) {
      fetchInvitations();
    }
  }, [user]);

  // Socket event listeners
  useEffect(() => {
    if (socket) {
      // Listen for new invitations
      socket.on('new_invitation', (data) => {
        console.log('New invitation received:', data);

        // Add to notifications
        setNotifications(prev => [
          {
            id: Date.now(),
            type: 'new_invitation',
            message: `${data.invitation.sender.name} sent you an invitation`,
            data: data.invitation
          },
          ...prev
        ]);

        // Refresh invitations list
        fetchInvitations();
      });

      // Listen for invitation updates
      socket.on('invitation_updated', (data) => {
        console.log('Invitation updated:', data);

        // Add to notifications
        setNotifications(prev => [
          {
            id: Date.now(),
            type: 'invitation_updated',
            message: `${data.updatedBy.name} ${data.status} your invitation`,
            data
          },
          ...prev
        ]);

        // Refresh invitations list
        fetchInvitations();
      });

      // Clean up on unmount
      return () => {
        socket.off('new_invitation');
        socket.off('invitation_updated');
      };
    }
  }, [socket]);

  // Fetch invitations
  const fetchInvitations = async () => {
    try {
      const token = getToken();
      const response = await fetch('/api/invitations', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch invitations');
      }

      const data = await response.json();
      setInvitations(data.invitations || []);
    } catch (error) {
      console.error('Error fetching invitations:', error);
    }
  };

  // Fetch users
  const fetchUsers = async () => {
    try {
      const token = getToken();

      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleSendInvitation = async (e) => {
    e.preventDefault();
    setError('');

    try {
      setLoading(true);
      const token = getToken();

      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ recipientEmail })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send invitation');
      }

      // Clear input
      setRecipientEmail('');

      // Refresh invitations list
      fetchInvitations();
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInvitationResponse = async (id, status) => {
    try {
      const token = getToken();

      const response = await fetch(`/api/invitations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        throw new Error('Failed to update invitation');
      }

      // Refresh invitations list
      fetchInvitations();
    } catch (error) {
      console.error('Error updating invitation:', error);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!user) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <div className="flex items-center">
            <span className="mr-4">Welcome, {user.name}</span>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Send Invitation Form */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Send Invitation</h2>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSendInvitation}>
              <div className="mb-4">
                <label htmlFor="recipientEmail" className="block text-sm font-medium text-gray-700 mb-1">
                  Recipient Email
                </label>
                <input
                  id="recipientEmail"
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Enter email address"
                  required
                />
              </div>
              <div className="flex justify-between items-center">
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded"
                  disabled={loading}
                >
                  {loading ? 'Sending...' : 'Send Invitation'}
                </button>

                <div className="flex items-center">
                  <label htmlFor="userSelect" className="mr-2 text-sm font-medium text-gray-700">Quick select:</label>
                  <select 
                    id="userSelect" 
                    className="border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3"
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    value=""
                  >
                    <option value="">Select a user</option>
                    {users.filter(u => user && u._id !== user.id).map(u => (
                      <option key={u._id} value={u.email}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                </div>
              </div>

            </form>
          </div>

          {/* Real-time Notifications */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Real-time Notifications</h2>

            {notifications.length === 0 ? (
              <p className="text-gray-500">No new notifications</p>
            ) : (
              <ul className="space-y-3">
                {notifications.map((notification) => (
                  <li key={notification.id} className="bg-blue-50 p-3 rounded border-l-4 border-blue-500">
                    <p>{notification.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date().toLocaleTimeString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Invitations List */}
          <div className="bg-white p-6 rounded-lg shadow md:col-span-2">
            <h2 className="text-xl font-semibold mb-4">Invitations</h2>

            {invitations.length === 0 ? (
              <p className="text-gray-500">No invitations yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        From/To
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {invitations.map((invitation) => {
                      const isSender = invitation.sender._id === user.id;
                      const otherUser = isSender ? invitation.recipient : invitation.sender;

                      return (
                        <tr key={invitation._id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isSender ? `To: ${otherUser.name}` : `From: ${otherUser.name}`}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {otherUser.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                              ${invitation.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                invitation.status === 'accepted' ? 'bg-green-100 text-green-800' :
                                  'bg-red-100 text-red-800'}`}>
                              {invitation.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {new Date(invitation.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {!isSender && invitation.status === 'pending' && (
                              <div className="space-x-2">
                                <button
                                  onClick={() => handleInvitationResponse(invitation._id, 'accepted')}
                                  className="text-green-600 hover:text-green-900"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={() => handleInvitationResponse(invitation._id, 'rejected')}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
