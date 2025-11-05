// pages/api/vectordb-health.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const INDEX_NAME = 'casebuddy-cases';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const index = pinecone.Index(INDEX_NAME);
    const stats = await index.describeIndexStats();
    
    return res.status(200).json({
      healthy: true,
      stats: {
        totalVectorCount: stats.totalRecordCount,
        dimension: stats.dimension,
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return res.status(500).json({
      healthy: false,
      error: 'Failed to connect to vector database',
    });
  }
}