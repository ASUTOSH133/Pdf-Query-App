// frontend/src/pages/api/query.ts
import { NextApiRequest, NextApiResponse } from 'next';

interface QueryRequest {
  question: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { question }: QueryRequest = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question cannot be empty' });
    }

    // Forward the query to the Python backend
    const response = await fetch('http://localhost:8000/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question: question.trim() }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json(errorData);
    }

    const result = await response.json();
    return res.status(200).json(result);

  } catch (error) {
    console.error('Query error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}