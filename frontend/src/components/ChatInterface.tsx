// frontend/src/components/ChatInterface.tsx
import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

interface ChatMessage {
  user: string;
  ai: string;
  timestamp: string;
}

interface ChatInterfaceProps {
  isDocumentUploaded: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ isDocumentUploaded }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Clear messages when document is uploaded
  useEffect(() => {
    if (isDocumentUploaded) {
      setMessages([]);
    }
  }, [isDocumentUploaded]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim() || !isDocumentUploaded) return;

    setIsLoading(true);
    const question = inputValue.trim();
    setInputValue('');

    try {
      // Use Next.js API route instead of direct backend call
      const response = await axios.post('/api/query', {
        question : question ,
      });

      setMessages(response.data.chat_history);
    } catch (error: any) {
      console.error('Error querying document:', error);
      // Add error message to chat
      const errorMessage: ChatMessage = {
        user: question,
        ai: 'Sorry, there was an error processing your question. Please try again.',
        timestamp: new Date().toLocaleString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isDocumentUploaded) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500 text-lg">
          Please upload a PDF document to start chatting
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-96 bg-white border rounded-lg">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p>Start by asking a question about your PDF document!</p>
            <p className="text-sm mt-2">
              Try: "What is this document about?" or "Summarize the main points"
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={index} className="space-y-2">
              {/* User Message */}
              <div className="flex justify-end">
                <div className="bg-blue-600 text-white rounded-lg px-4 py-2 max-w-xs lg:max-w-md">
                  <p className="text-sm">{message.user}</p>
                </div>
              </div>
              
              {/* AI Response */}
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-800 rounded-lg px-4 py-2 max-w-xs lg:max-w-md">
                  <p className="text-sm whitespace-pre-wrap">{message.ai}</p>
                  <p className="text-xs text-gray-500 mt-1">{message.timestamp}</p>
                </div>
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-800 rounded-lg px-4 py-2">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask a question about your PDF..."
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors"
          >
            Send
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-2">
          Chat history shows last 5 messages only
        </p>
      </div>
    </div>
  );
};

export default ChatInterface;