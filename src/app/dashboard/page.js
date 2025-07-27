// Polished and fixed Dashboard component
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ChatInterface from '@/components/ChatInterface';
import dynamic from 'next/dynamic';

const FiSearch = dynamic(() => import('react-icons/fi').then(mod => mod.FiSearch), { ssr: false });
const FiUserPlus = dynamic(() => import('react-icons/fi').then(mod => mod.FiUserPlus), { ssr: false });
const FiCheck = dynamic(() => import('react-icons/fi').then(mod => mod.FiCheck), { ssr: false });
const FiX = dynamic(() => import('react-icons/fi').then(mod => mod.FiX), { ssr: false });
const FiMessageSquare = dynamic(() => import('react-icons/fi').then(mod => mod.FiMessageSquare), { ssr: false });
const FiBell = dynamic(() => import('react-icons/fi').then(mod => mod.FiBell), { ssr: false });

export default function Dashboard() {
  const [invitations, setInvitations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [viewMode, setViewMode] = useState('chat');
  const [pendingInvites, setPendingInvites] = useState([]);
  const [recipientEmail, setRecipientEmail] = useState('');
  const chatContainerRef = useRef(null);
  const router = useRouter();
  const { user, logout, getToken, socket, loading: authLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!authLoading) {
      // More robust check for hot reload scenarios
      const hasStoredToken = localStorage.getItem('token');
      const hasStoredUser = localStorage.getItem('user');
      
      if (!hasStoredToken || !hasStoredUser) {
        router.push('/login');
        return;
      }
      
      // If we have stored data but user is null (hot reload), wait a bit
      if (!user && hasStoredToken && hasStoredUser) {
        console.log('Waiting for user data to load after hot reload...');
        return;
      }
      
      fetchInvitations();
      fetchUsers();
    }
  }, [user, authLoading, isAuthenticated, router]);

  useEffect(() => {
    setFilteredUsers(
      searchTerm
        ? users.filter(u =>
          u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.email.toLowerCase().includes(searchTerm.toLowerCase())
        )
        : users
    );
  }, [searchTerm, users]);

  useEffect(() => {
    setPendingInvites(
      invitations.filter(inv => inv.status === 'pending').map(inv => inv.recipient._id || inv.recipient)
    );
  }, [invitations]);

  useEffect(() => {
    if (user) fetchInvitations();
  }, [user]);

  useEffect(() => {
    if (!socket) return;

    const handleEvents = {
      new_invitation: data => {
        notify('invitation', `${data.sender.name} sent you an invitation`, data);
        fetchInvitations();
      },
      invitation_updated: data => {
        notify(
          data.status === 'accepted' ? 'success' : 'info',
          `${data.updatedBy.name} ${data.status} your invitation`,
          data
        );
        fetchInvitations();
      },
      new_message: data => {
        setMessages(prev => [...prev, data]);
        if (!selectedUser || selectedUser._id !== data.sender._id) {
          notify('message', `New message from ${data.sender.name}`, data);
        }
      },
      user_status_change: data => {
        if (isUserConnected(data.userId)) {
          notify('info', `${data.name} is now ${data.status}`, data);
        }
      }
    };

    for (let [event, handler] of Object.entries(handleEvents)) {
      socket.on(event, handler);
    }

    return () => {
      for (let event of Object.keys(handleEvents)) {
        socket.off(event);
      }
    };
  }, [socket, selectedUser]);

  // Close notifications dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showNotifications && !event.target.closest('.notifications-dropdown')) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  // Fetch messages when selectedUser changes
  useEffect(() => {
    if (!selectedUser || !user) return;
    
    const fetchMessages = async () => {
      try {
        const token = getToken();
        const res = await fetch(`/api/messages?userId=${selectedUser._id}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error('Error fetching messages:', err);
      }
    };
    
    fetchMessages();
  }, [selectedUser, user, getToken]);

  const notify = (type, message, data = {}) => {
    setNotifications(prev => [
      { id: Date.now(), type, message, read: false, data },
      ...prev
    ]);
    setUnreadNotifications(prev => prev + 1);
  };

  const fetchInvitations = async () => {
    try {
      const token = getToken();
      const res = await fetch('/api/invitations', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch invitations');
      setInvitations(data.invitations || []);
    } catch (err) {
      console.error('Error fetching invitations:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = getToken();
      const res = await fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch users');
      setUsers(data.users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const handleSendInvitation = async e => {
    e.preventDefault();
    const recipient = users.find(u => u.email === recipientEmail);
    if (!recipient) return setError('User not found with this email');
    if (pendingInvites.includes(recipient._id)) return setError('Invitation already sent');

    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ recipientId: recipient._id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send invitation');
      notify('success', 'Invitation sent successfully');
      fetchInvitations();
    } catch (err) {
      setError(err.message);
      notify('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // Helper functions for UI - defined early to avoid reference errors
  const isConnected = userId => {
    if (!user || !user.id) return false;
    return invitations.some(inv =>
      inv.status === 'accepted' &&
      ((inv.sender._id === userId && inv.recipient._id === user.id) ||
        (inv.recipient._id === userId && inv.sender._id === user.id))
    );
  };

  const hasPendingInvitation = userId => {
    if (!user || !user.id) return false;
    return invitations.some(inv =>
      inv.status === 'pending' &&
      ((inv.sender._id === user.id && inv.recipient._id === userId) ||
        (inv.recipient._id === user.id && inv.sender._id === userId))
    );
  };

  const sendInvitation = async (userId) => {
    try {
      const token = getToken();
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ recipientId: userId })
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to send invitation');
      }
      
      fetchInvitations();
      notify('success', 'Invitation sent successfully');
    } catch (err) {
      console.error('Error sending invitation:', err);
      notify('error', err.message || 'Failed to send invitation');
    }
  };

  const acceptInvitation = async (invitationId) => {
    try {
      const token = getToken();
      const res = await fetch(`/api/invitations/${invitationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'accepted' })
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to accept invitation');
      }
      
      fetchInvitations();
      notify('success', 'Invitation accepted');
    } catch (err) {
      console.error('Error accepting invitation:', err);
      notify('error', err.message || 'Failed to accept invitation');
    }
  };

  const rejectInvitation = async (invitationId) => {
    try {
      const token = getToken();
      const res = await fetch(`/api/invitations/${invitationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'rejected' })
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to reject invitation');
      }
      
      fetchInvitations();
      notify('success', 'Invitation rejected');
    } catch (err) {
      console.error('Error rejecting invitation:', err);
      notify('error', err.message || 'Failed to reject invitation');
    }
  };

  const disconnectUser = async (userId) => {
    if (!user || !user.id) return;
    try {
      const token = getToken();
      const invitation = invitations.find(inv =>
        inv.status === 'accepted' &&
        ((inv.sender._id === userId && inv.recipient._id === user.id) ||
          (inv.recipient._id === userId && inv.sender._id === user.id))
      );
      
      if (!invitation) return;
      
      const res = await fetch(`/api/invitations/${invitation._id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to disconnect user');
      }
      
      fetchInvitations();
      notify('success', 'User disconnected');
    } catch (err) {
      console.error('Error disconnecting user:', err);
      notify('error', err.message || 'Failed to disconnect user');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser) return;
    
    try {
      const token = getToken();
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          recipientId: selectedUser._id,
          content: newMessage.trim()
        })
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to send message');
      }
      
      setNewMessage('');
      // Message will be added via socket event
    } catch (err) {
      console.error('Error sending message:', err);
      notify('error', err.message || 'Failed to send message');
    }
  };

  // Legacy helper functions for compatibility
  const isInvitationPending = userId => pendingInvites.includes(userId);

  const isUserConnected = userId => {
    if (!user || !user.id) return false;
    return invitations.some(inv =>
      inv.status === 'accepted' &&
      ((inv.sender._id === userId && inv.recipient._id === user.id) ||
        (inv.recipient._id === userId && inv.sender._id === user.id))
    );
  };

  const getInvitationId = userId => {
    if (!user || !user.id) return null;
    const inv = invitations.find(inv =>
      (inv.sender._id === userId && inv.recipient._id === user.id) ||
      (inv.recipient._id === userId && inv.sender._id === user.id)
    );
    return inv ? inv._id : null;
  };

  // Get connected users
  const connectedUsers = users.filter(u => isConnected(u._id));

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Check authentication more robustly for hot reload
  const hasStoredToken = localStorage.getItem('token');
  const hasStoredUser = localStorage.getItem('user');
  
  if (!hasStoredToken || !hasStoredUser) {
    return null; // Will redirect in useEffect
  }
  
  // During hot reload, user might be null but we have stored data
  if (!user && hasStoredToken && hasStoredUser) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Restoring session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Socket In NextJs</h1>
          <div className="flex items-center space-x-4">
            <span className="text-gray-700">Welcome, {user.name}</span>
            
            {/* Notifications */}
            <div className="relative notifications-dropdown">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5-5V9a6 6 0 10-12 0v3l-5 5h5m7 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadNotifications}
                  </span>
                )}
              </button>
              
              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                  <div className="py-1">
                    <div className="px-4 py-2 text-sm font-medium text-gray-900 border-b border-gray-200">
                      Notifications
                      {unreadNotifications > 0 && (
                        <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">
                          {unreadNotifications}
                        </span>
                      )}
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map((notification, index) => (
                          <div key={index} className="px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100">
                            {notification.message}
                            <div className="text-xs text-gray-500 mt-1">
                              {new Date(notification.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          No notifications
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Users, Invitations, Connected */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs */}
            <div className="bg-white shadow rounded-lg">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex">
                  <button
                    onClick={() => setActiveTab('users')}
                    className={`py-2 px-4 border-b-2 font-medium text-sm ${
                      activeTab === 'users'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Users
                  </button>
                  <button
                    onClick={() => setActiveTab('invitations')}
                    className={`py-2 px-4 border-b-2 font-medium text-sm ${
                      activeTab === 'invitations'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Invitations
                    {invitations.filter(inv => inv.status === 'pending').length > 0 && (
                      <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">
                        {invitations.filter(inv => inv.status === 'pending').length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('connected')}
                    className={`py-2 px-4 border-b-2 font-medium text-sm ${
                      activeTab === 'connected'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Connected
                  </button>
                </nav>
              </div>

              <div className="p-6">
                {/* Users Tab */}
                {activeTab === 'users' && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium text-gray-900">All Users</h3>
                      <div className="flex items-center space-x-4">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          />
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredUsers.map((u) => (
                            <tr key={u._id}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  onClick={() => {
                                    setSelectedUser(u);
                                    setShowProfile(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                >
                                  {u.name}
                                </button>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.email}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  u.isOnline ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {u.isOnline ? 'Online' : 'Offline'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                {u._id !== user.id && !isConnected(u._id) && !hasPendingInvitation(u._id) && (
                                  <button
                                    onClick={() => sendInvitation(u._id)}
                                    className="text-blue-600 hover:text-blue-900"
                                  >
                                    Send Invitation
                                  </button>
                                )}
                                {hasPendingInvitation(u._id) && (
                                  <span className="text-yellow-600">Invitation Sent</span>
                                )}
                                {isConnected(u._id) && (
                                  <button
                                    onClick={() => disconnectUser(u._id)}
                                    className="text-red-600 hover:text-red-900"
                                  >
                                    Disconnect
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Invitations Tab */}
                {activeTab === 'invitations' && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Invitations</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From/To</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {invitations.map((invitation) => (
                            <tr key={invitation._id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {user && invitation.sender._id === user.id ? invitation.recipient.name : invitation.sender.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {user && invitation.sender._id === user.id ? 'Sent' : 'Received'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  invitation.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                  invitation.status === 'accepted' ? 'bg-green-100 text-green-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {invitation.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                {invitation.status === 'pending' && user && invitation.recipient._id === user.id && (
                                  <div className="space-x-2">
                                    <button
                                      onClick={() => acceptInvitation(invitation._id)}
                                      className="text-green-600 hover:text-green-900"
                                    >
                                      Accept
                                    </button>
                                    <button
                                      onClick={() => rejectInvitation(invitation._id)}
                                      className="text-red-600 hover:text-red-900"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Connected Tab */}
                {activeTab === 'connected' && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Connected Users</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {connectedUsers.map((u) => (
                            <tr key={u._id}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  onClick={() => {
                                    setSelectedUser(u);
                                    setShowProfile(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                >
                                  {u.name}
                                </button>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.email}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  u.isOnline ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {u.isOnline ? 'Online' : 'Offline'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="space-x-2">
                                  <button
                                    onClick={() => {
                                      setSelectedUser(u);
                                      setShowProfile(false);
                                    }}
                                    className="text-blue-600 hover:text-blue-900"
                                  >
                                    Chat
                                  </button>
                                  <button
                                    onClick={() => disconnectUser(u._id)}
                                    className="text-red-600 hover:text-red-900"
                                  >
                                    Disconnect
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Chat/Profile */}
          <div className="bg-white shadow rounded-lg h-fit">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  {selectedUser ? (
                    showProfile ? `${selectedUser.name}'s Profile` : `Chat with ${selectedUser.name}`
                  ) : 'Select a user'}
                </h3>
                {selectedUser && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setShowProfile(false)}
                      className={`px-3 py-1 text-sm rounded ${
                        !showProfile ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      Chat
                    </button>
                    <button
                      onClick={() => setShowProfile(true)}
                      className={`px-3 py-1 text-sm rounded ${
                        showProfile ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      Profile
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4">
              {!selectedUser ? (
                <p className="text-gray-500 text-center py-8">Select a user to start chatting or view their profile</p>
              ) : showProfile ? (
                /* Profile View */
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-white text-2xl font-bold">
                        {selectedUser.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <h4 className="text-xl font-semibold text-gray-900">{selectedUser.name}</h4>
                    <p className="text-gray-600">{selectedUser.email}</p>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-2 ${
                      selectedUser.isOnline ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedUser.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div className="border-t pt-4">
                    <h5 className="font-medium text-gray-900 mb-2">User Information</h5>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Member since:</span> {new Date(selectedUser.createdAt).toLocaleDateString()}</div>
                      <div><span className="font-medium">User ID:</span> {selectedUser._id}</div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Chat View */
                <div className="h-96 flex flex-col">
                  <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-2 mb-4 p-2 border rounded">
                    {messages.map((msg, index) => {
                      const senderId = typeof msg.sender === 'object' ? msg.sender._id : msg.sender;
                      const isOwnMessage = senderId === user.id;
                      
                      return (
                        <div key={index} className={`flex ${
                          isOwnMessage ? 'justify-end' : 'justify-start'
                        }`}>
                          <div className={`max-w-xs px-3 py-2 rounded-lg ${
                            isOwnMessage 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-gray-200 text-gray-800'
                          }`}>
                            <p className="text-sm">{msg.content}</p>
                            <p className="text-xs opacity-75 mt-1">
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="Type a message..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={sendMessage}
                      className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
