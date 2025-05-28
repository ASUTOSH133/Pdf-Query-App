"""
PDF Processing Module
Handles PDF text extraction and chunking with improved error handling
"""

import pdfplumber
import re
import logging
from typing import List, Dict, Optional, Tuple
import os
from pathlib import Path

logger = logging.getLogger(__name__)

class PDFProcessor:
    """
    Enhanced PDF processor with better text extraction and chunking
    """
    
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        """
        Initialize PDF processor
        
        Args:
            chunk_size: Maximum characters per chunk
            chunk_overlap: Overlap between consecutive chunks
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        
    def extract_text_chunks(self, pdf_path: str) -> List[Dict[str, any]]:
        """
        Extract text from PDF and split into chunks
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            List of text chunks with metadata
            
        Raises:
            Exception: If PDF processing fails
        """
        try:
            # Validate file exists
            if not os.path.exists(pdf_path):
                raise FileNotFoundError(f"PDF file not found: {pdf_path}")
            
            # Extract text from PDF
            full_text = self._extract_full_text(pdf_path)
            
            if not full_text.strip():
                raise ValueError("No text content found in PDF")
            
            # Clean and preprocess text
            cleaned_text = self._clean_text(full_text)
            
            # Split into chunks
            chunks = self._create_chunks(cleaned_text)
            
            # Add metadata to chunks
            chunks_with_metadata = []
            for i, chunk in enumerate(chunks):
                chunks_with_metadata.append({
                    'text': chunk,
                    'chunk_id': i,
                    'length': len(chunk),
                    'source': Path(pdf_path).name
                })
            
            logger.info(f"Successfully extracted {len(chunks_with_metadata)} chunks from {Path(pdf_path).name}")
            return chunks_with_metadata
            
        except Exception as e:
            logger.error(f"Error processing PDF {pdf_path}: {str(e)}")
            raise
    
    def _extract_full_text(self, pdf_path: str) -> str:
        """
        Extract all text from PDF using pdfplumber
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            Complete text content from PDF
        """
        full_text = ""
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                logger.info(f"Processing PDF with {len(pdf.pages)} pages")
                
                for page_num, page in enumerate(pdf.pages, 1):
                    try:
                        # Extract text from page
                        page_text = page.extract_text()
                        
                        if page_text:
                            # Add page separator
                            full_text += f"\n--- Page {page_num} ---\n"
                            full_text += page_text + "\n"
                        else:
                            logger.warning(f"No text found on page {page_num}")
                            
                    except Exception as e:
                        logger.warning(f"Error processing page {page_num}: {str(e)}")
                        continue
                        
        except Exception as e:
            logger.error(f"Error opening PDF file: {str(e)}")
            raise
        
        return full_text
    
    def _clean_text(self, text: str) -> str:
        """
        Clean and normalize extracted text
        
        Args:
            text: Raw text from PDF
            
        Returns:
            Cleaned and normalized text
        """
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove page separators for cleaner chunking
        text = re.sub(r'\n--- Page \d+ ---\n', '\n\n', text)
        
        # Fix common PDF extraction issues
        text = re.sub(r'([a-z])([A-Z])', r'\1 \2', text)  # Add space between joined words
        text = re.sub(r'(\w)-\n(\w)', r'\1\2', text)  # Fix hyphenated words across lines
        text = re.sub(r'\n+', '\n', text)  # Remove excessive newlines
        
        # Remove extra spaces
        text = re.sub(r' +', ' ', text)
        
        return text.strip()
    
    def _create_chunks(self, text: str) -> List[str]:
        """
        Split text into overlapping chunks
        
        Args:
            text: Cleaned text to chunk
            
        Returns:
            List of text chunks
        """
        if len(text) <= self.chunk_size:
            return [text]
        
        chunks = []
        start = 0
        
        while start < len(text):
            # Calculate end position
            end = start + self.chunk_size
            
            # If this is not the last chunk, try to break at sentence boundary
            if end < len(text):
                # Look for sentence endings within the last 200 characters
                search_start = max(end - 200, start)
                sentence_endings = [
                    text.rfind('.', search_start, end),
                    text.rfind('!', search_start, end),
                    text.rfind('?', search_start, end),
                    text.rfind('\n', search_start, end)
                ]
                
                best_end = max([pos for pos in sentence_endings if pos > search_start], default=end)
                if best_end > search_start:
                    end = best_end + 1
            
            # Extract chunk
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            
            # Calculate next start position with overlap
            if end >= len(text):
                break
                
            start = end - self.chunk_overlap
            
            # Ensure we don't go backwards
            if start <= 0:
                start = end
        
        return chunks
    
    def get_document_info(self, pdf_path: str) -> Dict[str, any]:
        """
        Get metadata information about the PDF
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            Dictionary with PDF metadata
        """
        try:
            with pdfplumber.open(pdf_path) as pdf:
                return {
                    'filename': Path(pdf_path).name,
                    'page_count': len(pdf.pages),
                    'file_size': os.path.getsize(pdf_path),
                    'metadata': pdf.metadata if hasattr(pdf, 'metadata') else {}
                }
        except Exception as e:
            logger.error(f"Error getting PDF info: {str(e)}")
            return {
                'filename': Path(pdf_path).name,
                'error': str(e)
            }