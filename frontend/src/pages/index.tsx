import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, MessageCircle, Zap, Shield, Clock, Database, Upload, Send, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';

// Type definitions
interface DocumentStatus {
  documentLoaded: boolean;
  currentDocument: string | null;
  chatMessages: number;
  readyForQueries: boolean;
  documentSize?: number;
  processingTime?: number;
  chunks?: number;
}

interface AppStats {
  totalUploads: number;
  totalQueries: number;
  averageResponseTime: number;
  uptime?: number;
  activeUsers?: number;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'system' | 'error';
  content: string;
  timestamp: string;
  sources?: string[];
  processingTime?: number;
}

interface FileUploadProps {
  onFileUploaded: (filename: string, stats: any) => void;
  onError: (error: string) => void;
  onUploadStart: () => void;
  onUploadEnd: () => void;
  disabled?: boolean;
}

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => Promise<void>;
  isLoading: boolean;
  disabled: boolean;
}

// File Upload Component
const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileUploaded, 
  onError, 
  onUploadStart, 
  onUploadEnd, 
  disabled = false 
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setUploadStatus('idle');
      onError('');
    } else {
      onError('Please select a valid PDF file');
      setFile(null);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
      setUploadStatus('idle');
      onError('');
    } else {
      onError('Please drop a valid PDF file');
    }
  };

  const uploadFile = async () => {
    if (!file) return;

    setUploadStatus('uploading');
    setUploadProgress(0);
    setUploadMessage('Processing your document...');
    onUploadStart();

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setUploadStatus('success');
        setUploadProgress(100);
        setUploadMessage(`Successfully processed ${file.name}`);
        onFileUploaded(file.name, {
          chunks: result.chunks_created,
          size: file.size,
          processingTime: result.processing_time
        });
      } else {
        throw new Error(result.detail || 'Upload failed');
      }
    } catch (error: any) {
      setUploadStatus('error');
      const errorMessage = error?.message || 'Unknown error occurred';
      setUploadMessage(`Upload failed: ${errorMessage}`);
      onError(errorMessage);
    } finally {
      onUploadEnd();
    }
  };

  const resetUpload = () => {
    setFile(null);
    setUploadStatus('idle');
    setUploadProgress(0);
    setUploadMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
          <Upload className="w-6 h-6 text-blue-600" />
          Upload Document
        </h2>
        {uploadStatus === 'success' && (
          <button
            onClick={resetUpload}
            className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Upload new document"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
          uploadStatus === 'success' 
            ? 'border-green-300 bg-green-50' 
            : disabled
            ? 'border-gray-200 bg-gray-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
        }`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {uploadStatus === 'success' ? (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle className="w-12 h-12 text-green-500" />
            <div>
              <p className="font-semibold text-green-700">Document Ready!</p>
              <p className="text-sm text-gray-600">{file?.name}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-gray-100 rounded-full">
              <FileText className={`w-8 h-8 ${disabled ? 'text-gray-400' : 'text-gray-500'}`} />
            </div>
            <div>
              <p className={`font-semibold mb-2 ${disabled ? 'text-gray-500' : 'text-gray-700'}`}>
                Upload your PDF document
              </p>
              <p className="text-sm text-gray-500 mb-4">Drag and drop or click to select</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
                disabled={disabled}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={uploadStatus === 'uploading' || disabled}
              >
                Choose File
              </button>
            </div>
          </div>
        )}
      </div>

      {uploadMessage && (
        <div className="mt-4">
          <div className={`p-4 rounded-lg border ${
            uploadStatus === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800'
              : uploadStatus === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            <div className="flex items-center gap-2">
              {uploadStatus === 'uploading' && <Loader2 className="w-4 h-4 animate-spin" />}
              {uploadStatus === 'success' && <CheckCircle className="w-4 h-4" />}
              {uploadStatus === 'error' && <AlertCircle className="w-4 h-4" />}
              <span className="font-medium">{uploadMessage}</span>
            </div>
            {uploadStatus === 'uploading' && (
              <div className="mt-2 bg-white bg-opacity-50 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {file && uploadStatus !== 'success' && (
        <div className="mt-6">
          <button
            onClick={uploadFile}
            disabled={uploadStatus === 'uploading' || disabled}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
          >
            {uploadStatus === 'uploading' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Process Document
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

// Chat Interface Component
const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isLoading, disabled }) => {
  const [currentQuestion, setCurrentQuestion] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!currentQuestion.trim() || isLoading || disabled) return;
    
    await onSendMessage(currentQuestion);
    setCurrentQuestion('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 flex flex-col h-[600px]">
      <div className="flex items-center gap-2 mb-6">
        <MessageCircle className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-semibold text-gray-800">Chat with Document</h2>
        {messages.length > 0 && (
          <span className="ml-auto text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {messages.length} messages
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>
                {disabled 
                  ? 'Please upload a PDF document to start chatting' 
                  : 'Ask questions about your document...'
                }
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.type === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] p-4 rounded-lg ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : message.type === 'system'
                      ? 'bg-green-100 text-green-800 border border-green-200'
                      : message.type === 'error'
                      ? 'bg-red-100 text-red-800 border border-red-200'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-300">
                      <p className="text-xs text-gray-600">
                        Sources: {message.sources.join(', ')}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs opacity-70">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </p>
                    {message.processingTime && (
                      <p className="text-xs opacity-70">
                        {message.processingTime}ms
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-800 p-4 rounded-lg flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={currentQuestion}
          onChange={(e) => setCurrentQuestion(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask a question about your PDF..."
          disabled={disabled || isLoading}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          onClick={handleSendMessage}
          disabled={!currentQuestion.trim() || disabled || isLoading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
};

// Status Bar Component
const StatusBar: React.FC<{ documentStatus: DocumentStatus; appStats: AppStats }> = ({ 
  documentStatus, 
  appStats 
}) => (
  <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${documentStatus.documentLoaded ? 'bg-green-100' : 'bg-gray-100'}`}>
          <FileText className={`w-5 h-5 ${documentStatus.documentLoaded ? 'text-green-600' : 'text-gray-400'}`} />
        </div>
        <div>
          <p className="text-sm text-gray-500">Document</p>
          <p className="font-semibold">
            {documentStatus.documentLoaded ? 'Loaded' : 'None'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <MessageCircle className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <p className="text-sm text-gray-500">Messages</p>
          <p className="font-semibold">{documentStatus.chatMessages}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-100 rounded-lg">
          <Database className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <p className="text-sm text-gray-500">Uploads</p>
          <p className="font-semibold">{appStats.totalUploads}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="p-2 bg-orange-100 rounded-lg">
          <Zap className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <p className="text-sm text-gray-500">Queries</p>
          <p className="font-semibold">{appStats.totalQueries}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="p-2 bg-red-100 rounded-lg">
          <Clock className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <p className="text-sm text-gray-500">Avg Response</p>
          <p className="font-semibold">{appStats.averageResponseTime}ms</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${documentStatus.readyForQueries ? 'bg-green-100' : 'bg-gray-100'}`}>
          <Shield className={`w-5 h-5 ${documentStatus.readyForQueries ? 'text-green-600' : 'text-gray-400'}`} />
        </div>
        <div>
          <p className="text-sm text-gray-500">Status</p>
          <p className="font-semibold">
            {documentStatus.readyForQueries ? 'Ready' : 'Waiting'}
          </p>
        </div>
      </div>
    </div>
  </div>
);

// Main Home Component
export default function Home() {
  const [documentStatus, setDocumentStatus] = useState<DocumentStatus>({
    documentLoaded: false,
    currentDocument: null,
    chatMessages: 0,
    readyForQueries: false
  });
  
  const [appStats, setAppStats] = useState<AppStats>({
    totalUploads: 0,
    totalQueries: 0,
    averageResponseTime: 0
  });
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  // Check document status periodically
  const checkDocumentStatus = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8000/document-status');
      if (response.ok) {
        const status = await response.json();
        setDocumentStatus({
          documentLoaded: status.document_loaded,
          currentDocument: status.current_document,
          chatMessages: status.chat_messages,
          readyForQueries: status.ready_for_queries,
          chunks: status.chunks,
          documentSize: status.document_size,
          processingTime: status.processing_time
        });
      }
    } catch (error) {
      console.error('Error checking document status:', error);
    }
  }, []);

  useEffect(() => {
    checkDocumentStatus();
    const interval = setInterval(checkDocumentStatus, 10000);
    return () => clearInterval(interval);
  }, [checkDocumentStatus]);

  const handleDocumentUploaded = useCallback((filename: string, stats: any) => {
    setDocumentStatus(prev => ({
      ...prev,
      documentLoaded: true,
      currentDocument: filename,
      readyForQueries: true,
      chatMessages: 0,
      chunks: stats.chunks,
      documentSize: stats.size,
      processingTime: stats.processingTime
    }));
    
    setAppStats(prev => ({
      ...prev,
      totalUploads: prev.totalUploads + 1
    }));
    
    // Add system message
    const systemMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'system',
      content: `Document "${filename}" has been uploaded and processed successfully! ${stats.chunks} chunks created. Ready for questions.`,
      timestamp: new Date().toISOString()
    };
    
    setChatMessages([systemMessage]);
    setError(null);
  }, []);

  const handleSendMessage = useCallback(async (question: string) => {
    if (!documentStatus.readyForQueries) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: question,
      timestamp: new Date().toISOString()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    const startTime = Date.now();

    try {
      const response = await fetch('http://localhost:8000/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query: question  // Changed from 'question' to 'query' to match backend
        }),
      });

      const result = await response.json();
      const processingTime = Date.now() - startTime;

      if (response.ok) {
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'ai',
          content: result.response,  // Changed from 'answer' to 'response' to match backend
          timestamp: new Date().toISOString(),
          sources: result.sources || [],
          processingTime
        };
        
        setChatMessages(prev => [...prev, aiMessage]);
        
        // Update stats
        setAppStats(prev => ({
          ...prev,
          totalQueries: prev.totalQueries + 1,
          averageResponseTime: Math.round((prev.averageResponseTime * (prev.totalQueries - 1) + processingTime) / prev.totalQueries)
        }));
        
        setDocumentStatus(prev => ({
          ...prev,
          chatMessages: prev.chatMessages + 2
        }));
      } else {
        throw new Error(result.detail || 'Query failed');
      }
    } catch (error: any) {
      console.error('Error details:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'error',
        content: `Sorry, I couldn't process your question: ${error?.message || 'Unknown error occurred'}`,
        timestamp: new Date().toISOString()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [documentStatus.readyForQueries]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-blue-600 rounded-xl shadow-lg">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-800">PDF Chat Application</h1>
          </div>
          <p className="text-gray-600 text-lg">Upload a PDF document and ask questions about its content using AI</p>
        </div>

        {/* Status Bar */}
        <StatusBar documentStatus={documentStatus} appStats={appStats} />

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-600 hover:text-red-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-8">
          <FileUpload
            onFileUploaded={handleDocumentUploaded}
            onError={setError}
            onUploadStart={() => setIsUploadingFile(true)}
            onUploadEnd={() => setIsUploadingFile(false)}
            disabled={isUploadingFile}
          />
          
          <ChatInterface
            messages={chatMessages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            disabled={!documentStatus.readyForQueries}
          />
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500">
          <p className="text-sm">
            Built with Next.js, FastAPI, and Sentence Transformers • 
            {documentStatus.currentDocument && (
              <span className="ml-2 text-blue-600 font-medium">
                Current: {documentStatus.currentDocument}
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}