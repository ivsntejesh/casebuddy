// src/lib/feedbackService.ts

import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  orderBy,
  limit as firestoreLimit
} from 'firebase/firestore';
import { db } from './firebase';
import { geminiService } from './gemini';
import { isUserAdmin } from './adminConfig';
import { AIFeedback, DailyLimit, FeedbackStats } from '../types/feedback';

const DAILY_LIMIT = 3;

export class FeedbackService {
  
  // Check if feedback already exists for an answer
  async getFeedbackForAnswer(answerId: string): Promise<AIFeedback | null> {
    try {
      const feedbackRef = collection(db, 'aiFeedback');
      const q = query(feedbackRef, where('answerId', '==', answerId), firestoreLimit(1));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        return { 
          id: snapshot.docs[0].id, 
          ...data,
          generatedAt: data.generatedAt,
          createdAt: data.createdAt
        } as AIFeedback;
      }
      
      return null;
    } catch (error: any) {
      // Ignore permission errors for non-existent documents (expected behavior)
      if (error?.code === 'permission-denied') {
        console.log('No existing feedback found (permission check)');
        return null;
      }
      console.error('Error fetching feedback:', error);
      return null;
    }
  }

  // Get user's daily usage stats
  async getUserDailyStats(userId: string, userEmail: string | null): Promise<FeedbackStats> {
    try {
      // Admins have unlimited requests
      if (isUserAdmin(userEmail)) {
        return {
          totalRequests: 0,
          remainingToday: 999,
          lastRequestDate: null
        };
      }

      const today = this.getTodayDateString();
      const limitDocRef = doc(db, 'dailyLimits', `${userId}_${today}`);
      const limitDoc = await getDoc(limitDocRef);
      
      if (limitDoc.exists()) {
        const data = limitDoc.data() as DailyLimit;
        return {
          totalRequests: data.requestCount,
          remainingToday: Math.max(0, DAILY_LIMIT - data.requestCount),
          lastRequestDate: data.lastRequestAt?.toDate() || null
        };
      }
      
      return {
        totalRequests: 0,
        remainingToday: DAILY_LIMIT,
        lastRequestDate: null
      };
    } catch (error) {
      console.error('Error fetching daily stats:', error);
      return {
        totalRequests: 0,
        remainingToday: DAILY_LIMIT,
        lastRequestDate: null
      };
    }
  }

  // Check if user can request feedback
  async canRequestFeedback(userId: string, userEmail: string | null): Promise<{
    allowed: boolean;
    remaining: number;
    message?: string;
  }> {
    // Admins always allowed
    if (isUserAdmin(userEmail)) {
      return { allowed: true, remaining: 999 };
    }

    const stats = await this.getUserDailyStats(userId, userEmail);
    
    if (stats.remainingToday <= 0) {
      return {
        allowed: false,
        remaining: 0,
        message: `You've reached your daily limit of ${DAILY_LIMIT} AI feedback requests. Limit resets at midnight.`
      };
    }

    return {
      allowed: true,
      remaining: stats.remainingToday
    };
  }

  // Increment user's daily request count
  private async incrementDailyCount(userId: string): Promise<void> {
    const today = this.getTodayDateString();
    const limitDocRef = doc(db, 'dailyLimits', `${userId}_${today}`);
    
    const limitDoc = await getDoc(limitDocRef);
    
    if (limitDoc.exists()) {
      await updateDoc(limitDocRef, {
        requestCount: (limitDoc.data().requestCount || 0) + 1,
        lastRequestAt: serverTimestamp()
      });
    } else {
      await setDoc(limitDocRef, {
        userId,
        date: today,
        requestCount: 1,
        lastRequestAt: serverTimestamp()
      });
    }
  }

  // Generate and store AI feedback
  async generateFeedback(
    answerId: string,
    userId: string,
    userEmail: string | null,
    questionId: string,
    questionTitle: string,
    questionDescription: string,
    userAnswer: string
  ): Promise<AIFeedback> {
    // Check if feedback already exists
    const existingFeedback = await this.getFeedbackForAnswer(answerId);
    if (existingFeedback) {
      return existingFeedback;
    }

    // Check rate limit
    const canRequest = await this.canRequestFeedback(userId, userEmail);
    if (!canRequest.allowed) {
      throw new Error(canRequest.message || 'Rate limit exceeded');
    }

    // Validate answer length
    if (userAnswer.trim().length < 50) {
      throw new Error('Your answer is too short. Please provide a detailed response (at least 50 characters) for meaningful AI feedback.');
    }

    try {
      // Generate feedback using Gemini
      const feedbackContent = await geminiService.generateInsightsForAnswer(
        questionTitle,
        questionDescription,
        userAnswer
      );

      // Parse feedback sections
      const parsedFeedback = this.parseFeedbackContent(feedbackContent);

      // Increment daily count (only for non-admins)
      if (!isUserAdmin(userEmail)) {
        await this.incrementDailyCount(userId);
      }

      // Store feedback in Firestore
      const feedbackRef = await addDoc(collection(db, 'aiFeedback'), {
        answerId,
        userId,
        questionId,
        questionTitle,
        userAnswer,
        feedback: {
          content: feedbackContent,
          ...parsedFeedback
        },
        generatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      const newFeedback: AIFeedback = {
        id: feedbackRef.id,
        answerId,
        userId,
        questionId,
        questionTitle,
        userAnswer,
        feedback: {
          content: feedbackContent,
          ...parsedFeedback
        },
        generatedAt: new Date(),
        createdAt: new Date()
      };

      return newFeedback;
    } catch (error) {
      console.error('Error generating feedback:', error);
      throw error;
    }
  }

  // Get all feedback for a user
  async getUserFeedbackHistory(userId: string): Promise<AIFeedback[]> {
    try {
      const feedbackRef = collection(db, 'aiFeedback');
      const q = query(
        feedbackRef, 
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AIFeedback[];
    } catch (error) {
      console.error('Error fetching feedback history:', error);
      return [];
    }
  }

  // Helper: Get today's date as string (YYYY-MM-DD)
  private getTodayDateString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  // Helper: Parse feedback content into structured sections
  private parseFeedbackContent(content: string): {
    strengths?: string[];
    improvements?: string[];
    missing?: string[];
    frameworks?: string[];
  } {
    const result: any = {};

    // Extract strengths
    const strengthsMatch = content.match(/(?:1\.\s*STRENGTHS|STRENGTHS)[\s\S]*?(?=(?:\d\.|$))/i);
    if (strengthsMatch) {
      result.strengths = this.extractBulletPoints(strengthsMatch[0]);
    }

    // Extract improvements
    const improvementsMatch = content.match(/(?:2\.\s*AREAS FOR IMPROVEMENT|AREAS FOR IMPROVEMENT)[\s\S]*?(?=(?:\d\.|$))/i);
    if (improvementsMatch) {
      result.improvements = this.extractBulletPoints(improvementsMatch[0]);
    }

    // Extract missing considerations
    const missingMatch = content.match(/(?:3\.\s*MISSING CONSIDERATIONS|MISSING CONSIDERATIONS)[\s\S]*?(?=(?:\d\.|$))/i);
    if (missingMatch) {
      result.missing = this.extractBulletPoints(missingMatch[0]);
    }

    // Extract framework suggestions
    const frameworksMatch = content.match(/(?:4\.\s*FRAMEWORK SUGGESTIONS|FRAMEWORK SUGGESTIONS)[\s\S]*?$/i);
    if (frameworksMatch) {
      result.frameworks = this.extractBulletPoints(frameworksMatch[0]);
    }

    return result;
  }

  // Helper: Extract bullet points from text
  private extractBulletPoints(text: string): string[] {
    const lines = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('-') || line.startsWith('•') || line.match(/^\d+\./))
      .map(line => line.replace(/^[-•]\s*/, '').replace(/^\d+\.\s*/, ''));
    
    return lines.length > 0 ? lines : [];
  }
}

export const feedbackService = new FeedbackService();


// // src/lib/feedbackService.ts

// import { 
//   collection, 
//   query, 
//   where, 
//   getDocs, 
//   addDoc, 
//   serverTimestamp,
//   doc,
//   getDoc,
//   setDoc,
//   updateDoc,
//   orderBy,
//   limit as firestoreLimit
// } from 'firebase/firestore';
// import { db } from './firebase';
// import { geminiService } from './gemini';
// import { isUserAdmin } from './adminConfig';
// import { AIFeedback, DailyLimit, FeedbackStats } from '../types/feedback';

// const DAILY_LIMIT = 3;

// export class FeedbackService {
  
//   // Check if feedback already exists for an answer
//   async getFeedbackForAnswer(answerId: string): Promise<AIFeedback | null> {
//     try {
//       const feedbackRef = collection(db, 'aiFeedback');
//       const q = query(feedbackRef, where('answerId', '==', answerId), firestoreLimit(1));
//       const snapshot = await getDocs(q);
      
//       if (!snapshot.empty) {
//         return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as AIFeedback;
//       }
      
//       return null;
//     } catch (error) {
//       console.error('Error fetching feedback:', error);
//       return null;
//     }
//   }

//   // Get user's daily usage stats
//   async getUserDailyStats(userId: string, userEmail: string | null): Promise<FeedbackStats> {
//     try {
//       // Admins have unlimited requests
//       if (isUserAdmin(userEmail)) {
//         return {
//           totalRequests: 0,
//           remainingToday: 999,
//           lastRequestDate: null
//         };
//       }

//       const today = this.getTodayDateString();
//       const limitDocRef = doc(db, 'dailyLimits', `${userId}_${today}`);
//       const limitDoc = await getDoc(limitDocRef);
      
//       if (limitDoc.exists()) {
//         const data = limitDoc.data() as DailyLimit;
//         return {
//           totalRequests: data.requestCount,
//           remainingToday: Math.max(0, DAILY_LIMIT - data.requestCount),
//           lastRequestDate: data.lastRequestAt?.toDate() || null
//         };
//       }
      
//       return {
//         totalRequests: 0,
//         remainingToday: DAILY_LIMIT,
//         lastRequestDate: null
//       };
//     } catch (error) {
//       console.error('Error fetching daily stats:', error);
//       return {
//         totalRequests: 0,
//         remainingToday: DAILY_LIMIT,
//         lastRequestDate: null
//       };
//     }
//   }

//   // Check if user can request feedback
//   async canRequestFeedback(userId: string, userEmail: string | null): Promise<{
//     allowed: boolean;
//     remaining: number;
//     message?: string;
//   }> {
//     // Admins always allowed
//     if (isUserAdmin(userEmail)) {
//       return { allowed: true, remaining: 999 };
//     }

//     const stats = await this.getUserDailyStats(userId, userEmail);
    
//     if (stats.remainingToday <= 0) {
//       return {
//         allowed: false,
//         remaining: 0,
//         message: `You've reached your daily limit of ${DAILY_LIMIT} AI feedback requests. Limit resets at midnight.`
//       };
//     }

//     return {
//       allowed: true,
//       remaining: stats.remainingToday
//     };
//   }

//   // Increment user's daily request count
//   private async incrementDailyCount(userId: string): Promise<void> {
//     const today = this.getTodayDateString();
//     const limitDocRef = doc(db, 'dailyLimits', `${userId}_${today}`);
    
//     const limitDoc = await getDoc(limitDocRef);
    
//     if (limitDoc.exists()) {
//       await updateDoc(limitDocRef, {
//         requestCount: (limitDoc.data().requestCount || 0) + 1,
//         lastRequestAt: serverTimestamp()
//       });
//     } else {
//       await setDoc(limitDocRef, {
//         userId,
//         date: today,
//         requestCount: 1,
//         lastRequestAt: serverTimestamp()
//       });
//     }
//   }

//   // Generate and store AI feedback
//   async generateFeedback(
//     answerId: string,
//     userId: string,
//     userEmail: string | null,
//     questionId: string,
//     questionTitle: string,
//     questionDescription: string,
//     userAnswer: string
//   ): Promise<AIFeedback> {
//     // Check if feedback already exists
//     const existingFeedback = await this.getFeedbackForAnswer(answerId);
//     if (existingFeedback) {
//       return existingFeedback;
//     }

//     // Check rate limit
//     const canRequest = await this.canRequestFeedback(userId, userEmail);
//     if (!canRequest.allowed) {
//       throw new Error(canRequest.message || 'Rate limit exceeded');
//     }

//     // Validate answer length
//     if (userAnswer.trim().length < 50) {
//       throw new Error('Your answer is too short. Please provide a detailed response (at least 50 characters) for meaningful AI feedback.');
//     }

//     try {
//       // Generate feedback using Gemini
//       const feedbackContent = await geminiService.generateInsightsForAnswer(
//         questionTitle,
//         questionDescription,
//         userAnswer
//       );

//       // Parse feedback sections
//       const parsedFeedback = this.parseFeedbackContent(feedbackContent);

//       // Increment daily count (only for non-admins)
//       if (!isUserAdmin(userEmail)) {
//         await this.incrementDailyCount(userId);
//       }

//       // Store feedback in Firestore
//       const feedbackRef = await addDoc(collection(db, 'aiFeedback'), {
//         answerId,
//         userId,
//         questionId,
//         questionTitle,
//         userAnswer,
//         feedback: {
//           content: feedbackContent,
//           ...parsedFeedback
//         },
//         generatedAt: serverTimestamp(),
//         createdAt: serverTimestamp()
//       });

//       const newFeedback: AIFeedback = {
//         id: feedbackRef.id,
//         answerId,
//         userId,
//         questionId,
//         questionTitle,
//         userAnswer,
//         feedback: {
//           content: feedbackContent,
//           ...parsedFeedback
//         },
//         generatedAt: new Date(),
//         createdAt: new Date()
//       };

//       return newFeedback;
//     } catch (error) {
//       console.error('Error generating feedback:', error);
//       throw error;
//     }
//   }

//   // Get all feedback for a user
//   async getUserFeedbackHistory(userId: string): Promise<AIFeedback[]> {
//     try {
//       const feedbackRef = collection(db, 'aiFeedback');
//       const q = query(
//         feedbackRef, 
//         where('userId', '==', userId),
//         orderBy('createdAt', 'desc')
//       );
//       const snapshot = await getDocs(q);
      
//       return snapshot.docs.map(doc => ({
//         id: doc.id,
//         ...doc.data()
//       })) as AIFeedback[];
//     } catch (error) {
//       console.error('Error fetching feedback history:', error);
//       return [];
//     }
//   }

//   // Helper: Get today's date as string (YYYY-MM-DD)
//   private getTodayDateString(): string {
//     const now = new Date();
//     return now.toISOString().split('T')[0];
//   }

//   // Helper: Parse feedback content into structured sections
//   private parseFeedbackContent(content: string): {
//     strengths?: string[];
//     improvements?: string[];
//     missing?: string[];
//     frameworks?: string[];
//   } {
//     const result: any = {};

//     // Extract strengths
//     const strengthsMatch = content.match(/(?:1\.\s*STRENGTHS|STRENGTHS)[\s\S]*?(?=(?:\d\.|$))/i);
//     if (strengthsMatch) {
//       result.strengths = this.extractBulletPoints(strengthsMatch[0]);
//     }

//     // Extract improvements
//     const improvementsMatch = content.match(/(?:2\.\s*AREAS FOR IMPROVEMENT|AREAS FOR IMPROVEMENT)[\s\S]*?(?=(?:\d\.|$))/i);
//     if (improvementsMatch) {
//       result.improvements = this.extractBulletPoints(improvementsMatch[0]);
//     }

//     // Extract missing considerations
//     const missingMatch = content.match(/(?:3\.\s*MISSING CONSIDERATIONS|MISSING CONSIDERATIONS)[\s\S]*?(?=(?:\d\.|$))/i);
//     if (missingMatch) {
//       result.missing = this.extractBulletPoints(missingMatch[0]);
//     }

//     // Extract framework suggestions
//     const frameworksMatch = content.match(/(?:4\.\s*FRAMEWORK SUGGESTIONS|FRAMEWORK SUGGESTIONS)[\s\S]*?$/i);
//     if (frameworksMatch) {
//       result.frameworks = this.extractBulletPoints(frameworksMatch[0]);
//     }

//     return result;
//   }

//   // Helper: Extract bullet points from text
//   private extractBulletPoints(text: string): string[] {
//     const lines = text.split('\n')
//       .map(line => line.trim())
//       .filter(line => line.startsWith('-') || line.startsWith('•') || line.match(/^\d+\./))
//       .map(line => line.replace(/^[-•]\s*/, '').replace(/^\d+\.\s*/, ''));
    
//     return lines.length > 0 ? lines : [];
//   }
// }

// export const feedbackService = new FeedbackService();