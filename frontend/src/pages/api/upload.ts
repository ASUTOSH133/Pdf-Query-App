// frontend/src/pages/api/upload.ts
import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';

// Disable default body parser to handle file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse the multipart form data
    const form = formidable({
      uploadDir: './uploads',
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
    });

    const [fields, files] = await form.parse(req);
    const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!uploadedFile) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate file type
    if (!uploadedFile.originalFilename?.endsWith('.pdf')) {
      // Clean up uploaded file
      fs.unlinkSync(uploadedFile.filepath);
      return res.status(400).json({ error: 'Only PDF files are allowed' });
    }

    // Forward the file to the Python backend
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(uploadedFile.filepath);
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    formData.append('file', blob, uploadedFile.originalFilename);

    const response = await fetch('http://localhost:8000/upload', {
      method: 'POST',
      body: formData,
    });

    // Clean up the temporary file
    fs.unlinkSync(uploadedFile.filepath);

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json(errorData);
    }

    const result = await response.json();
    return res.status(200).json(result);

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}