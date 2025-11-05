// pages/api/embeddings.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Server-side only (no NEXT_PUBLIC_)
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required' });
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    return res.status(200).json({
      embedding: response.data[0].embedding,
    });
  } catch (error) {
    console.error('Error generating embedding:', error);
    return res.status(500).json({ error: 'Failed to generate embedding' });
  }
}