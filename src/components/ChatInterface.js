'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FiChevronUp, FiChevronDown } from 'react-icons/fi';

export default function ChatInterface({ selectedUser }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
    hasMore: false,
    hasRecent: false
  });
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const { user, socket } = useAuth();

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Effect for scrolling to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Save scroll position before loading more messages
  const saveScrollPosition = () => {
    if (messagesContainerRef.current) {
      return {
        scrollHeight: messagesContainerRef.current.scrollHeight,
        scrollTop: messagesContainerRef.current.scrollTop
      };
    }
    return null;
  };

  // Restore scroll position after loading more messages
  const restoreScrollPosition = (savedPosition, newHeight) => {
    if (messagesContainerRef.current && savedPosition) {
      const heightDifference = messagesContainerRef.current.scrollHeight - savedPosition.scrollHeight;
      messagesContainerRef.current.scrollTop = savedPosition.scrollTop + heightDifference;
    }
  };

  // Load more (older) messages
  const loadMoreMessages = () => {
    if (!socket || !selectedUser || loadingMore || !pagination.hasMore) return;
    
    setLoadingMore(true);
    const savedPosition = saveScrollPosition();
    
    // Request older messages
    socket.emit('load_more_messages', { 
      otherUserId: selectedUser._id,
      page: pagination.page + 1,
      limit: pagination.limit
    });
  };

  // Load recent messages
  const loadRecentMessages = () => {
    if (!socket || !selectedUser || loadingRecent || !pagination.hasRecent) return;
    
    setLoadingRecent(true);
    
    // Request most recent messages
    socket.emit('get_recent_messages', { 
      otherUserId: selectedUser._id,
      limit: pagination.limit
    });
  };

  // Effect for setting up socket listeners
  useEffect(() => {
    if (!socket || !selectedUser) return;

    // Reset state when user changes
    setMessages([]);
    setPagination({
      page: 1,
      limit: 10,
      total: 0,
      pages: 0,
      hasMore: false,
      hasRecent: false
    });

    // Request initial message history
    socket.emit('get_messages', { 
      otherUserId: selectedUser._id,
      page: 1,
      limit: 10
    });

    // Listen for message history
    const handleMessagesList = (data) => {
      setMessages(data.messages);
      setPagination(data.pagination);
      setLoading(false);
    };

    // Listen for more (older) messages
    const handleMoreMessages = (data) => {
      const savedPosition = saveScrollPosition();
      
      setMessages(prevMessages => [...data.messages, ...prevMessages]);
      setPagination(data.pagination);
      setLoadingMore(false);
      
      // Need to wait for DOM to update
      setTimeout(() => {
        restoreScrollPosition(savedPosition);
      }, 0);
    };

    // Listen for recent messages
    const handleRecentMessages = (data) => {
      setMessages(data.messages);
      setPagination(data.pagination);
      setLoadingRecent(false);
      
      // Scroll to bottom with recent messages
      setTimeout(() => {
        scrollToBottom();
      }, 0);
    };

    // Listen for new messages
    const handleNewMessage = (data) => {
      setMessages(prevMessages => [...prevMessages, data.message]);
      
      // Mark message as read
      socket.emit('mark_message_read', data.message._id);
    };

    // Listen for sent message confirmation
    const handleMessageSent = (messageObj) => {
      setMessages(prevMessages => [...prevMessages, messageObj]);
    };

    // Listen for read receipts
    const handleMessageRead = (messageId) => {
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg._id === messageId ? { ...msg, read: true } : msg
        )
      );
    };

    // Listen for errors
    const handleError = (error) => {
      console.error('Socket error:', error);
      // Could add toast notification here
    };

    // Set up listeners
    socket.on('messages_list', handleMessagesList);
    socket.on('more_messages', handleMoreMessages);
    socket.on('recent_messages', handleRecentMessages);
    socket.on('new_message', handleNewMessage);
    socket.on('message_sent', handleMessageSent);
    socket.on('message_read', handleMessageRead);
    socket.on('message_error', handleError);

    // Clean up
    return () => {
      socket.off('messages_list', handleMessagesList);
      socket.off('more_messages', handleMoreMessages);
      socket.off('recent_messages', handleRecentMessages);
      socket.off('new_message', handleNewMessage);
      socket.off('message_sent', handleMessageSent);
      socket.off('message_read', handleMessageRead);
      socket.off('message_error', handleError);
    };
  }, [socket, selectedUser]);

  // Send message
  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (!message.trim() || !socket || !selectedUser) return;
    
    setLoading(true);
    socket.emit('send_message', {
      recipientId: selectedUser._id,
      message: message.trim()
    });
    
    setMessage('');
    setLoading(false);
  };

  if (!selectedUser) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-lg">
        <p className="text-gray-500">Select a user to start chatting</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow overflow-hidden">
      {/* Chat header */}
      <div className="px-4 py-3 bg-indigo-600 text-white flex items-center">
        <div className="h-10 w-10 rounded-full bg-indigo-300 flex items-center justify-center text-indigo-800 font-semibold">
          {selectedUser.name ? selectedUser.name.charAt(0).toUpperCase() : '?'}
        </div>
        <div className="ml-3">
          <p className="font-medium">{selectedUser.name}</p>
          <p className="text-xs text-indigo-200">
            {selectedUser.isOnline ? 'Online' : 'Offline'}
          </p>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex flex-col h-full">
        {/* Load previous messages button */}
        {pagination.hasMore && (
          <button 
            onClick={loadMoreMessages}
            disabled={loadingMore}
            className="flex items-center justify-center py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
          >
            {loadingMore ? (
              <span>Loading...</span>
            ) : (
              <>
                <FiChevronUp className="mr-1" />
                <span>Load previous messages</span>
              </>
            )}
          </button>
        )}
        
        {/* Messages container */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 p-4 overflow-y-auto bg-gray-50"
        >
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">
                {loading ? 'Loading messages...' : 'No messages yet. Start the conversation!'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => {
                const isSender = msg.senderId === user.id;
                const timestamp = new Date(msg.createdAt || msg.timestamp).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                });
                
                return (
                  <div 
                    key={msg._id || msg.id} 
                    className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        isSender 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-gray-200 text-gray-800'
                      }`}
                    >
                      <p>{msg.content}</p>
                      <div className="flex justify-end items-center mt-1">
                        <span className="text-xs opacity-70">{timestamp}</span>
                        {isSender && (
                          <span className="ml-1 text-xs">
                            {msg.read ? '✓✓' : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
        
        {/* Load recent messages button */}
        {pagination.hasRecent && (
          <button 
            onClick={loadRecentMessages}
            disabled={loadingRecent}
            className="flex items-center justify-center py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
          >
            {loadingRecent ? (
              <span>Loading...</span>
            ) : (
              <>
                <FiChevronDown className="mr-1" />
                <span>Show recent messages</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Message input */}
      <form onSubmit={handleSendMessage} className="p-3 bg-white border-t">
        <div className="flex">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="flex-1 border border-gray-300 rounded-l-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Type a message..."
            disabled={loading}
          />
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-r-md"
            disabled={!message.trim() || loading}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
