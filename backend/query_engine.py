import logging
from typing import List, Dict, Tuple, Any, Optional
import re
from sentence_transformers import SentenceTransformer
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import threading
from transformers import pipeline
logger = logging.getLogger(__name__)

class QueryEngine:
    def __init__(self, model_name: str = 'all-MiniLM-L6-v2'):
        self.model_name = model_name
        self.model: Optional[SentenceTransformer] = None
        self.document_chunks: List[Dict[str, Any]] = []
        self.chunk_embeddings: Optional[np.ndarray] = None
        self._model_lock = threading.Lock()

        # Initialize models
        self._load_model()
        self.summarizer = pipeline("summarization", model="facebook/bart-large-cnn")
        self.qa_model = pipeline("question-answering", model="distilbert-base-cased-distilled-squad")

    def _load_model(self):
        try:
            logger.info(f"Loading sentence transformer model: {self.model_name}")
            self.model = SentenceTransformer(self.model_name)
            logger.info("Model loaded successfully")
        except Exception as e:
            logger.error(f"Error loading model: {str(e)}")
            raise

    def initialize_document(self, chunks: List[Dict[str, Any]]):
        try:
            self.document_chunks = chunks
            if not self.model:
                self._load_model()

            chunk_texts = [chunk['text'] for chunk in chunks]
            with self._model_lock:
                self.chunk_embeddings = self.model.encode(chunk_texts)

            logger.info("Document initialized successfully")

        except Exception as e:
            logger.error(f"Error initializing document: {str(e)}")
            raise

    # def query(self, query_text: str, top_k: int = 3) -> Tuple[str, int]:
    #     try:
    #         if not self.document_chunks or self.chunk_embeddings is None:
    #             return "No document loaded. Please upload a PDF first.", 0

    #         # Summarization
    #         if any(keyword in query_text.lower() for keyword in ["summarize", "summary", "what is this about", "overview"]):
    #             full_text = " ".join([chunk["text"] for chunk in self.document_chunks])[:3000]
    #             summary = self.summarizer(full_text, max_length=180, min_length=60, do_sample=False)[0]["summary_text"]
    #             return f"📄 Summary of the document:\n\n{summary}", 1

    #         # QA Answer
    #         relevant_chunks = self._find_relevant_chunks(query_text, top_k)
    #         if not relevant_chunks:
    #             return "I couldn't find relevant information in the document to answer your query.", 0

    #         context = " ".join(chunk['text'] for chunk in relevant_chunks)[:1500]
    #         answer_result = self.qa_model({
    #             "question": query_text,
    #             "context": context
    #         })

    #         answer = answer_result.get("answer", "").strip()
    #         if not answer or len(answer) < 3:
    #             fallback = self._generate_response(query_text, relevant_chunks)
    #             return fallback, len(relevant_chunks)

    #         return f"💡 Answer: {answer}", len(relevant_chunks)

    #     except Exception as e:
    #         logger.error(f"Error processing query: {str(e)}")
    #         return f"Error processing your query: {str(e)}", 0

    def query(self, query_text: str, top_k: int = 5) -> Tuple[str, int]:
        try:
            if not self.document_chunks or self.chunk_embeddings is None:
                return "No document loaded. Please upload a PDF first.", 0

            # Summarization check
            if any(keyword in query_text.lower() for keyword in ["summarize", "summary", "overview"]):
                full_text = " ".join([chunk["text"] for chunk in self.document_chunks])[:3000]
                summary = self.summarizer(full_text, max_length=180, min_length=60, do_sample=False)[0]["summary_text"]
                return f"📄 Summary of the document:\n\n{summary}", 1

            # Get relevant chunks
            relevant_chunks = self._find_relevant_chunks(query_text, top_k)
            if not relevant_chunks:
                return "I couldn't find relevant information in the document to answer your query.", 0

            # Try QA on each relevant chunk and choose the best answer
            best_answer = ""
            best_score = -1
            best_context = ""
            for chunk in relevant_chunks:
                context = chunk['text'][:1000]
                qa_input = {"question": query_text, "context": context}
                result = self.qa_model(qa_input)

                if result['score'] > best_score:
                    best_score = result['score']
                    best_answer = result['answer']
                    best_context = context

            # If the score is too low or answer is not meaningful, fallback
            if best_score < 0.3 or not best_answer or len(best_answer.strip()) < 3:
                fallback = self._generate_response(query_text, relevant_chunks)
                return fallback, len(relevant_chunks)

            return f"💡 Answer: {best_answer.strip()}", len(relevant_chunks)

        except Exception as e:
            logger.error(f"Error processing query: {str(e)}")
            return f"Error processing your query: {str(e)}", 0


    def _find_relevant_chunks(self, query_text: str, top_k: int) -> List[Dict[str, Any]]:
        try:
            with self._model_lock:
                query_embedding = self.model.encode([query_text])

            similarities = cosine_similarity(query_embedding, self.chunk_embeddings)[0]
            keyword_scores = self._calculate_keyword_scores(query_text)

            combined_scores = []
            for i, (sem_score, kw_score) in enumerate(zip(similarities, keyword_scores)):
                combined_score = 0.7 * sem_score + 0.3 * kw_score
                combined_scores.append((combined_score, i))

            combined_scores.sort(reverse=True, key=lambda x: x[0])

            relevant_chunks = []
            for score, idx in combined_scores[:top_k]:
                if score > 0.1:
                    chunk = self.document_chunks[idx].copy()
                    chunk['relevance_score'] = float(score)
                    chunk['semantic_score'] = float(similarities[idx])
                    chunk['keyword_score'] = float(keyword_scores[idx])
                    relevant_chunks.append(chunk)

            logger.info(f"Found {len(relevant_chunks)} relevant chunks for query")
            return relevant_chunks

        except Exception as e:
            logger.error(f"Error finding relevant chunks: {str(e)}")
            return []

    def _calculate_keyword_scores(self, query_text: str) -> List[float]:
        query_words = set(re.findall(r'\b\w+\b', query_text.lower()))
        query_words = {word for word in query_words if len(word) > 2}

        if not query_words:
            return [0.0] * len(self.document_chunks)

        scores = []
        for chunk in self.document_chunks:
            chunk_words = set(re.findall(r'\b\w+\b', chunk['text'].lower()))
            intersection = query_words.intersection(chunk_words)
            union = query_words.union(chunk_words)

            jaccard_score = len(intersection) / len(union) if union else 0.0
            phrase_boost = 0.3 if query_text.lower() in chunk['text'].lower() else 0.0
            scores.append(min(jaccard_score + phrase_boost, 1.0))

        return scores

    def _generate_response(self, query_text: str, relevant_chunks: List[Dict[str, Any]]) -> str:
        try:
            response_parts = ["Based on the document content:\n"]
            for i, chunk in enumerate(relevant_chunks):
                chunk_text = chunk['text']
                if len(chunk_text) > 800:
                    chunk_text = chunk_text[:800] + "..."
                response_parts.append(f"--- Relevant Section {i+1} ---")
                response_parts.append(chunk_text)
                response_parts.append("")

            if len(relevant_chunks) > 1:
                response_parts.append("--- Summary ---")
                response_parts.append(
                    f"The above content from {len(relevant_chunks)} sections answers your query about: '{query_text}'."
                )

            response = "\n".join(response_parts)
            if len(response) > 2000:
                response = response[:2000] + "\n\n[Response truncated for readability]"

            return response

        except Exception as e:
            logger.error(f"Error generating response: {str(e)}")
            return f"Found relevant information but encountered an error generating the response: {str(e)}"

    def clear_document(self):
        self.document_chunks = []
        self.chunk_embeddings = None
        logger.info("Document cleared from query engine")
