// src/lib/vectordb.ts - Updated secure version
//import { Pinecone } from '@pinecone-database/pinecone';

export interface SimilarCase {
  questionId: string;
  title: string;
  description: string;
  type: string;
  difficulty: string;
  similarity: number;
  totalAnswers?: number;
  avgUpvotes?: number;
}

export class VectorDBService {
  /**
   * Find similar cases using API route (secure)
   */
  async findSimilarCases(
    questionId: string,
    title: string,
    description: string,
    topK: number = 5
  ): Promise<SimilarCase[]> {
    try {
      const response = await fetch('/api/similar-cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionId,
          title,
          description,
          topK,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      console.log(`✅ Found ${data.similarCases.length} similar cases`);
      return data.similarCases;
    } catch (error) {
      console.error('Error finding similar cases:', error);
      return [];
    }
  }

  /**
   * Index a case (admin only - use API route)
   */
  async indexCase(
    questionId: string,
    title: string,
    description: string,
    type: 'consulting' | 'product',
    difficulty: 'easy' | 'medium' | 'hard',
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const response = await fetch('/api/index-case', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionId,
          title,
          description,
          type,
          difficulty,
          metadata,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to index case: ${response.status}`);
      }

      console.log(`✅ Indexed case: ${title}`);
    } catch (error) {
      console.error('Error indexing case:', error);
      throw error;
    }
  }

  /**
   * Health check for vector DB
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch('/api/vectordb-health', {
        method: 'GET',
      });

      return response.ok;
    } catch (error) {
      console.error('❌ Pinecone health check failed:', error);
      return false;
    }
  }
}

export const vectorDBService = new VectorDBService();