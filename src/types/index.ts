export interface User {
  uid: string;
  email: string;
  displayName: string;
  questionsSolved: number;
  totalUpvotes: number;
  createdAt: Date;
}

export interface Question {
  id: string;
  title: string;
  description: string;
  type: 'consulting' | 'product';
  difficulty: 'easy' | 'medium' | 'hard';
  datePosted: any; // Firebase timestamp
  isActive: boolean;
}

export interface Answer {
  id: string;
  questionId: string;
  userId: string;
  userDisplayName: string;
  content: string;
  upvotes: number;
  upvotedBy: string[];
  createdAt: any; // Firebase timestamp
}