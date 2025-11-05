// src/types/feedback.ts

export interface AIFeedback {
  id: string;
  answerId: string;
  userId: string;
  questionId: string;
  questionTitle: string;
  userAnswer: string;
  feedback: {
    content: string;
    strengths?: string[];
    improvements?: string[];
    missing?: string[];
    frameworks?: string[];
  };
  generatedAt: any; // Firebase Timestamp
  createdAt: any; // Firebase Timestamp
}

export interface DailyLimit {
  userId: string;
  date: string; // Format: YYYY-MM-DD
  requestCount: number;
  lastRequestAt: any; // Firebase Timestamp
}

export interface FeedbackStats {
  totalRequests: number;
  remainingToday: number;
  lastRequestDate: Date | null;
}