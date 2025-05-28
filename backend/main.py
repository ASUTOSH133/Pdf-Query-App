"""
PDF Chat Application - Main FastAPI Server
Clean, well-structured backend with proper error handling and documentation
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn
import os
import tempfile
import logging
from typing import List, Dict, Any, Optional
import asyncio
from datetime import datetime

# Import our custom modules
from pdf_processor import PDFProcessor
from query_engine import QueryEngine

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="PDF Chat Application",
    description="Upload PDF documents and chat with their content using AI",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Pydantic models for request/response validation
class ChatMessage(BaseModel):
    query: str
    timestamp: Optional[datetime] = None

class ChatResponse(BaseModel):
    response: str
    timestamp: datetime
    chunks_used: int
    processing_time: float

class UploadResponse(BaseModel):
    message: str
    filename: str
    chunks_created: int
    file_size: int
    processing_time: float

# Global instances
pdf_processor = PDFProcessor()
query_engine = QueryEngine()

# In-memory storage for chat history (last 5 messages)
chat_history: List[Dict[str, Any]] = []
current_document: Optional[str] = None

# Configuration
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {'.pdf'}
MAX_CHAT_HISTORY = 5

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "PDF Chat Application API",
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "services": {
            "pdf_processor": "ready",
            "query_engine": "ready",
            "document_loaded": current_document is not None
        },
        "chat_history_count": len(chat_history),
        "timestamp": datetime.now().isoformat()
    }

@app.post("/upload", response_model=UploadResponse)
async def upload_pdf(file: UploadFile = File(...)):
    """
    Upload and process a PDF document
    
    Args:
        file: PDF file to upload and process
        
    Returns:
        UploadResponse with processing details
        
    Raises:
        HTTPException: If file validation fails or processing errors occur
    """
    start_time = datetime.now()
    
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file provided"
            )
        
        # Check file extension
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PDF files are allowed"
            )
        
        # Read file content
        content = await file.read()
        file_size = len(content)
        
        # Check file size
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size ({file_size} bytes) exceeds maximum allowed size ({MAX_FILE_SIZE} bytes)"
            )
        
        # Process PDF with temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        try:
            # Extract text and create embeddings
            logger.info(f"Processing PDF: {file.filename}")
            chunks = pdf_processor.extract_text_chunks(temp_file_path)
            
            if not chunks:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Could not extract text from PDF. The file might be corrupted or contain only images."
                )
            
            # Initialize query engine with document chunks
            query_engine.initialize_document(chunks)
            
            # Update global state
            global current_document, chat_history
            current_document = file.filename
            chat_history.clear()  # Clear previous chat history
            
            processing_time = (datetime.now() - start_time).total_seconds()
            
            logger.info(f"Successfully processed {file.filename}: {len(chunks)} chunks created")
            
            return UploadResponse(
                message=f"Successfully processed {file.filename}",
                filename=file.filename,
                chunks_created=len(chunks),
                file_size=file_size,
                processing_time=processing_time
            )
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing PDF {file.filename}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing PDF: {str(e)}"
        )

@app.post("/query", response_model=ChatResponse)
async def query_document(message: ChatMessage):
    """
    Query the uploaded document
    
    Args:
        message: ChatMessage containing the user's query
        
    Returns:
        ChatResponse with the answer and metadata
        
    Raises:
        HTTPException: If no document is loaded or query processing fails
    """
    start_time = datetime.now()
    
    try:
        # Check if document is loaded
        if current_document is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No document loaded. Please upload a PDF first."
            )
        
        # Validate query
        query = message.query.strip()
        if not query:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Query cannot be empty"
            )
        
        if len(query) > 1000:  # Reasonable limit
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Query is too long (maximum 1000 characters)"
            )
        
        # Process query
        logger.info(f"Processing query: {query[:50]}...")
        response, chunks_used = query_engine.query(query)
        
        processing_time = (datetime.now() - start_time).total_seconds()
        timestamp = datetime.now()
        
        # Update chat history
        chat_entry = {
            "query": query,
            "response": response,
            "timestamp": timestamp.isoformat(),
            "chunks_used": chunks_used
        }
        
        chat_history.append(chat_entry)
        
        # Keep only last N messages
        if len(chat_history) > MAX_CHAT_HISTORY:
            chat_history.pop(0)
        
        logger.info(f"Query processed successfully in {processing_time:.2f}s")
        
        return ChatResponse(
            response=response,
            timestamp=timestamp,
            chunks_used=chunks_used,
            processing_time=processing_time
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing query: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing query: {str(e)}"
        )

@app.get("/chat-history")
async def get_chat_history():
    """Get the current chat history"""
    return {
        "history": chat_history,
        "document": current_document,
        "total_messages": len(chat_history)
    }

@app.delete("/chat-history")
async def clear_chat_history():
    """Clear the chat history"""
    global chat_history
    chat_history.clear()
    return {"message": "Chat history cleared"}

@app.get("/document-status")
async def get_document_status():
    """Get current document status"""
    return {
        "document_loaded": current_document is not None,
        "current_document": current_document,
        "chat_messages": len(chat_history),
        "ready_for_queries": current_document is not None
    }

# Error handlers
@app.exception_handler(404)
async def not_found_handler(request, exc):
    return JSONResponse(
        status_code=404,
        content={"detail": "Endpoint not found"}
    )

@app.exception_handler(500)
async def internal_error_handler(request, exc):
    logger.error(f"Internal server error: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

if __name__ == "__main__":
    logger.info("Starting PDF Chat Application Server...")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )