// pages/api/index-case.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import { isUserAdmin } from '../../lib/adminConfig';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const INDEX_NAME = 'casebuddy-cases';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // TODO: Add proper authentication check here
  // For now, we'll trust the client-side admin check
  
  const { questionId, title, description, type, difficulty, metadata } = req.body;

  if (!questionId || !title || !description) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Generate embedding
    const textToEmbed = `${title}\n\n${description}`;
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: textToEmbed,
    });

    // Store in Pinecone
    const index = pinecone.Index(INDEX_NAME);
    await index.upsert([
      {
        id: questionId,
        values: embeddingResponse.data[0].embedding,
        metadata: {
          questionId,
          title,
          description: description.substring(0, 500),
          type,
          difficulty,
          ...metadata,
        },
      },
    ]);

    return res.status(200).json({ 
      success: true,
      message: `Indexed case: ${title}` 
    });
  } catch (error) {
    console.error('Error indexing case:', error);
    return res.status(500).json({ error: 'Failed to index case' });
  }
}