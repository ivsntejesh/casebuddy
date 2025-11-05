// pages/api/similar-cases.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!, // Server-side only
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

  const { questionId, title, description, topK = 5 } = req.body;

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
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Query Pinecone
    const index = pinecone.Index(INDEX_NAME);
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: topK + 1,
      includeMetadata: true,
    });

    // Filter and format results
    const similarCases = queryResponse.matches
      .filter((match: any) => match.id !== questionId)
      .slice(0, topK)
      .map((match: any) => ({
        questionId: match.metadata.questionId,
        title: match.metadata.title,
        description: match.metadata.description,
        type: match.metadata.type,
        difficulty: match.metadata.difficulty,
        similarity: match.score,
        totalAnswers: match.metadata.totalAnswers || 0,
        avgUpvotes: match.metadata.avgUpvotes || 0,
      }));

    return res.status(200).json({ similarCases });
  } catch (error) {
    console.error('Error finding similar cases:', error);
    return res.status(500).json({ error: 'Failed to find similar cases' });
  }
}