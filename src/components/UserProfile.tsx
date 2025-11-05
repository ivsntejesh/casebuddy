// src/components/UserProfile.tsx

import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { feedbackService } from '../lib/feedbackService';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  orderBy
} from 'firebase/firestore';
import { Answer } from '../types';
import { AIFeedback } from '../types/feedback';
import { 
  User, 
  Mail, 
  Calendar, 
  TrendingUp, 
  CheckCircle,
  Sparkles,
  BookOpen,
  Target,
  Award,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

export default function UserProfile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'answers' | 'feedback'>('overview');
  const [userAnswers, setUserAnswers] = useState<Answer[]>([]);
  const [feedbackHistory, setFeedbackHistory] = useState<AIFeedback[]>([]);
  const [stats, setStats] = useState({
    totalAnswers: 0,
    totalUpvotes: 0,
    totalFeedbacks: 0,
    averageUpvotes: 0
  });

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    if (!user) return;

    try {
      // Fetch user's answers
      const answersRef = collection(db, 'answers');
      const answersQuery = query(
        answersRef,
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const answersSnapshot = await getDocs(answersQuery);
      const answers = answersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Answer[];

      setUserAnswers(answers);

      // Fetch feedback history
      const feedbacks = await feedbackService.getUserFeedbackHistory(user.uid);
      
      // Re-parse feedback that needs it
      const parsedFeedbacks = feedbacks.map(feedback => {
        const needsReparsing = 
          (!feedback.feedback.strengths || 
           feedback.feedback.strengths.length === 0 ||
           feedback.feedback.strengths[0] === 'STRENGTHS');
        
        if (needsReparsing && feedback.feedback.content) {
          console.log('🔄 Re-parsing feedback in profile:', feedback.id);
          const reparsed = parseExistingFeedback(feedback.feedback.content);
          return {
            ...feedback,
            feedback: {
              ...feedback.feedback,
              ...reparsed
            }
          };
        }
        
        return feedback;
      });
      
      setFeedbackHistory(parsedFeedbacks);

      // Calculate stats
      const totalUpvotes = answers.reduce((sum, answer) => sum + answer.upvotes, 0);
      setStats({
        totalAnswers: answers.length,
        totalUpvotes,
        totalFeedbacks: parsedFeedbacks.length,
        averageUpvotes: answers.length > 0 ? Math.round(totalUpvotes / answers.length) : 0
      });
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to re-parse existing feedback content
  const parseExistingFeedback = (content: string) => {
    const result: any = {};

    const strengthsMatch = content.match(/(?:###\s*)?(?:1\.\s*)?STRENGTHS?\s*\*?\*?[\s\S]*?(?=(?:###\s*)?(?:2\.|###\s*2\.|$))/i);
    if (strengthsMatch) {
      result.strengths = extractBulletPoints(strengthsMatch[0]);
    }

    const improvementsMatch = content.match(/(?:###\s*)?(?:2\.\s*)?AREAS?\s+FOR\s+IMPROVEMENT[\s\S]*?(?=(?:###\s*)?(?:3\.|###\s*3\.|$))/i);
    if (improvementsMatch) {
      result.improvements = extractBulletPoints(improvementsMatch[0]);
    }

    const missingMatch = content.match(/(?:###\s*)?(?:3\.\s*)?MISSING\s+CONSIDERATIONS?[\s\S]*?(?=(?:###\s*)?(?:4\.|###\s*4\.|$))/i);
    if (missingMatch) {
      result.missing = extractBulletPoints(missingMatch[0]);
    }

    const frameworksMatch = content.match(/(?:###\s*)?(?:4\.\s*)?FRAMEWORK\s+SUGGESTIONS?[\s\S]*?$/i);
    if (frameworksMatch) {
      result.frameworks = extractBulletPoints(frameworksMatch[0]);
    }

    return result;
  };

  const extractBulletPoints = (text: string): string[] => {
    const lines = text.split('\n')
      .map(line => line.trim())
      .filter(line => {
        return line.match(/^[\*\-\•]\s+\*?\*?/) || line.match(/^\d+\.\s+/) || line.match(/^\*\*[^*]+\*\*/);
      })
      .map(line => {
        return line
          .replace(/^[\*\-\•]\s+/, '')
          .replace(/^\d+\.\s+/, '')
          .replace(/^\*\*([^*]+)\*\*:?\s*/, '$1: ')
          .replace(/\*\*/g, '')
          .trim();
      })
      .filter(line => {
        return line.length > 0 && 
               !line.match(/^(?:STRENGTHS?|AREAS?\s+FOR\s+IMPROVEMENT|MISSING\s+CONSIDERATIONS?|FRAMEWORK\s+SUGGESTIONS?)$/i);
      });
    
    return lines.length > 0 ? lines : [];
  };

  const formatDate = (date: any) => {
    if (!date) return '';
    try {
      return new Date(date.toDate ? date.toDate() : date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return '';
    }
  };

  const formatDateTime = (date: any) => {
    if (!date) return '';
    try {
      return new Date(date.toDate ? date.toDate() : date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return '';
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Profile Header */}
      <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {user?.displayName?.charAt(0) || 'U'}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {user?.displayName || 'User'}
              </h1>
              <div className="flex items-center space-x-4 text-gray-600">
                <div className="flex items-center space-x-1">
                  <Mail className="w-4 h-4" />
                  <span className="text-sm">{user?.email}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">
                    Joined {formatDate(user?.metadata?.creationTime)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-8 h-8 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.totalAnswers}</p>
          <p className="text-sm text-gray-600">Solutions Submitted</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.totalUpvotes}</p>
          <p className="text-sm text-gray-600">Total Upvotes</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <Sparkles className="w-8 h-8 text-purple-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.totalFeedbacks}</p>
          <p className="text-sm text-gray-600">AI Feedbacks</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <Award className="w-8 h-8 text-yellow-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.averageUpvotes}</p>
          <p className="text-sm text-gray-600">Avg Upvotes</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm mb-8">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4" />
                <span>Overview</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('answers')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'answers'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <BookOpen className="w-4 h-4" />
                <span>My Answers ({userAnswers.length})</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('feedback')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'feedback'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4" />
                <span>AI Feedback History ({feedbackHistory.length})</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                {userAnswers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No activity yet. Start by answering a case study!</p>
                    <a
                      href="/"
                      className="inline-block mt-4 text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Go to Today's Challenge →
                    </a>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {userAnswers.slice(0, 5).map((answer) => (
                      <div key={answer.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900 line-clamp-1">
                            Answered a case study
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatDate(answer.createdAt)} • {answer.upvotes} upvotes
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Progress</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-2">Keep Going! 🎯</h4>
                    <p className="text-sm text-blue-700">
                      You've submitted {stats.totalAnswers} solution{stats.totalAnswers !== 1 ? 's' : ''}. 
                      {stats.totalAnswers < 10 && ' Try to reach 10 solutions!'}
                    </p>
                  </div>
                  
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h4 className="font-semibold text-purple-900 mb-2">AI Insights ✨</h4>
                    <p className="text-sm text-purple-700">
                      You've received {stats.totalFeedbacks} AI feedback{stats.totalFeedbacks !== 1 ? 's' : ''}.
                      Use AI feedback to improve your case-solving skills!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Answers Tab */}
          {activeTab === 'answers' && (
            <div className="space-y-4">
              {userAnswers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>You haven't submitted any answers yet.</p>
                </div>
              ) : (
                userAnswers.map((answer) => (
                  <div key={answer.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-600">
                          {formatDate(answer.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1 text-sm text-gray-600">
                          <TrendingUp className="w-4 h-4" />
                          <span>{answer.upvotes} upvotes</span>
                        </div>
                        <a
                          href="/past-questions"
                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                        >
                          <span>View</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                    <p className="text-gray-700 line-clamp-3 text-sm">
                      {answer.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Feedback History Tab */}
          {activeTab === 'feedback' && (
            <div className="space-y-4">
              {feedbackHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Sparkles className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="mb-2">No AI feedback history yet.</p>
                  <p className="text-sm">Request AI feedback on your answers to see them here!</p>
                </div>
              ) : (
                feedbackHistory.map((feedback) => (
                  <div key={feedback.id} className="border border-purple-200 rounded-lg p-4 bg-purple-50/30">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-1">
                          {feedback.questionTitle}
                        </h4>
                        <div className="flex items-center space-x-3 text-sm text-gray-600">
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>{formatDateTime(feedback.generatedAt)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Sparkles className="w-3 h-3 text-purple-600" />
                            <span className="text-purple-600">AI Generated</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Feedback Summary */}
                    <div className="mt-4 space-y-3">
                      {feedback.feedback.strengths && feedback.feedback.strengths.length > 0 && (
                        <div className="bg-white/80 rounded-lg p-3 border border-green-200">
                          <h5 className="text-sm font-semibold text-green-900 mb-2">
                            ✓ Strengths ({feedback.feedback.strengths.length})
                          </h5>
                          <ul className="text-xs text-gray-700 space-y-1">
                            {feedback.feedback.strengths.slice(0, 2).map((strength, idx) => (
                              <li key={idx} className="line-clamp-1">• {strength}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {feedback.feedback.improvements && feedback.feedback.improvements.length > 0 && (
                        <div className="bg-white/80 rounded-lg p-3 border border-orange-200">
                          <h5 className="text-sm font-semibold text-orange-900 mb-2">
                            → Areas for Improvement ({feedback.feedback.improvements.length})
                          </h5>
                          <ul className="text-xs text-gray-700 space-y-1">
                            {feedback.feedback.improvements.slice(0, 2).map((improvement, idx) => (
                              <li key={idx} className="line-clamp-1">• {improvement}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <a
                      href="/past-questions"
                      className="inline-flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700 font-medium mt-4"
                    >
                      <span>View Full Feedback</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// import { useState, useEffect } from 'react';
// import { useAuth } from '../hooks/useAuth';
// import { db } from '../lib/firebase';
// import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
// import { Answer } from '../types';
// import { Trophy, Calendar, Target, TrendingUp, BookOpen } from 'lucide-react';

// interface UserStats {
//   questionsSolved: number;
//   totalUpvotes: number;
//   averageUpvotes: number;
//   streak: number;
// }

// export default function UserProfile() {
//   const { user } = useAuth();
//   const [userStats, setUserStats] = useState<UserStats>({
//     questionsSolved: 0,
//     totalUpvotes: 0,
//     averageUpvotes: 0,
//     streak: 0
//   });
//   const [userAnswers, setUserAnswers] = useState<Answer[]>([]);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     if (user) {
//       fetchUserStats();
//       fetchUserAnswers();
//     }
//   }, [user]);

//   const fetchUserStats = async () => {
//     if (!user) return;

//     try {
//       const answersRef = collection(db, 'answers');
//       const q = query(answersRef, where('userId', '==', user.uid));
//       const snapshot = await getDocs(q);
      
//       let totalUpvotes = 0;
//       const answers = snapshot.docs.map(doc => doc.data() as Answer);
      
//       answers.forEach(answer => {
//         totalUpvotes += answer.upvotes;
//       });

//       setUserStats({
//         questionsSolved: answers.length,
//         totalUpvotes,
//         averageUpvotes: answers.length > 0 ? Math.round(totalUpvotes / answers.length * 10) / 10 : 0,
//         streak: calculateStreak(answers)
//       });
//     } catch (error) {
//       console.error('Error fetching user stats:', error);
//     }
//   };

//   const fetchUserAnswers = async () => {
//     if (!user) return;

//     try {
//       const answersRef = collection(db, 'answers');
//       const q = query(
//         answersRef, 
//         where('userId', '==', user.uid),
//         orderBy('createdAt', 'desc')
//       );
//       const snapshot = await getDocs(q);
//       const answers = snapshot.docs.map(doc => ({
//         id: doc.id,
//         ...doc.data()
//       })) as Answer[];
      
//       setUserAnswers(answers);
//       setLoading(false);
//     } catch (error) {
//       console.error('Error fetching user answers:', error);
//       setLoading(false);
//     }
//   };

//   const calculateStreak = (answers: Answer[]): number => {
//     // Simple streak calculation - consecutive days with submissions
//     // This is a simplified version - you might want to implement more sophisticated logic
//     return Math.min(answers.length, 7); // Cap at 7 for MVP
//   };

//   const formatDate = (date: any) => {
//     if (!date) return '';
//     try {
//       return new Date(date.toDate()).toLocaleDateString();
//     } catch (error) {
//       return new Date(date).toLocaleDateString();
//     }
//   };

//   const getInitials = (name: string | null | undefined): string => {
//     if (!name) return 'U';
//     return name.split(' ')
//       .map(word => word.charAt(0))
//       .join('')
//       .toUpperCase()
//       .slice(0, 2);
//   };

//   const getRankTitle = (questionsSolved: number, totalUpvotes: number): string => {
//     if (questionsSolved >= 20 && totalUpvotes >= 50) return 'Case Master';
//     if (questionsSolved >= 10 && totalUpvotes >= 20) return 'Senior Analyst';
//     if (questionsSolved >= 5 && totalUpvotes >= 10) return 'Junior Consultant';
//     if (questionsSolved >= 1) return 'Rising Star';
//     return 'Newcomer';
//   };

//   if (loading) {
//     return (
//       <div className="text-center py-8">
//         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
//         <p className="mt-4 text-gray-600">Loading your profile...</p>
//       </div>
//     );
//   }

//   return (
//     <div className="max-w-4xl mx-auto">
//       {/* Profile Header */}
//       <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-sm p-6 mb-6 text-white">
//         <div className="flex items-center space-x-4 mb-4">
//           <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-white font-bold text-2xl">
//             {getInitials(user?.displayName)}
//           </div>
//           <div>
//             <h1 className="text-3xl font-bold">{user?.displayName || 'Anonymous User'}</h1>
//             <p className="text-blue-100 mb-2">{user?.email}</p>
//             <span className="bg-white bg-opacity-20 px-3 py-1 rounded-full text-sm font-medium">
//               {getRankTitle(userStats.questionsSolved, userStats.totalUpvotes)}
//             </span>
//           </div>
//         </div>
//       </div>

//       {/* Stats Grid */}
//       <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
//         <div className="bg-white p-6 rounded-lg shadow-sm text-center">
//           <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
//             <Target className="w-6 h-6 text-blue-600" />
//           </div>
//           <p className="text-2xl font-bold text-gray-900 mb-1">{userStats.questionsSolved}</p>
//           <p className="text-sm text-gray-600">Questions Solved</p>
//         </div>
        
//         <div className="bg-white p-6 rounded-lg shadow-sm text-center">
//           <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
//             <Trophy className="w-6 h-6 text-green-600" />
//           </div>
//           <p className="text-2xl font-bold text-gray-900 mb-1">{userStats.totalUpvotes}</p>
//           <p className="text-sm text-gray-600">Total Upvotes</p>
//         </div>
        
//         <div className="bg-white p-6 rounded-lg shadow-sm text-center">
//           <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
//             <TrendingUp className="w-6 h-6 text-purple-600" />
//           </div>
//           <p className="text-2xl font-bold text-gray-900 mb-1">{userStats.averageUpvotes}</p>
//           <p className="text-sm text-gray-600">Avg. Upvotes</p>
//         </div>
        
//         <div className="bg-white p-6 rounded-lg shadow-sm text-center">
//           <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-3">
//             <Calendar className="w-6 h-6 text-orange-600" />
//           </div>
//           <p className="text-2xl font-bold text-gray-900 mb-1">{userStats.streak}</p>
//           <p className="text-sm text-gray-600">Day Streak</p>
//         </div>
//       </div>

//       {/* Recent Answers */}
//       <div className="bg-white rounded-lg shadow-sm p-6">
//         <div className="flex items-center space-x-2 mb-6">
//           <BookOpen className="w-5 h-5 text-gray-600" />
//           <h2 className="text-xl font-bold text-gray-900">Your Recent Answers</h2>
//           <span className="text-sm text-gray-500">({userAnswers.length} total)</span>
//         </div>
        
//         {userAnswers.length === 0 ? (
//           <div className="text-center py-12">
//             <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
//               <BookOpen className="w-8 h-8 text-gray-400" />
//             </div>
//             <h3 className="text-lg font-medium text-gray-900 mb-2">No answers yet</h3>
//             <p className="text-gray-600 mb-4">Start solving cases to see your progress here!</p>
//             <a 
//               href="/" 
//               className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-200"
//             >
//               Solve Today's Case
//             </a>
//           </div>
//         ) : (
//           <div className="space-y-4">
//             {userAnswers.slice(0, 5).map((answer, index) => (
//               <div key={answer.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition duration-200">
//                 <div className="flex items-center justify-between mb-3">
//                   <div className="flex items-center space-x-2">
//                     <span className="text-sm font-medium text-gray-900">
//                       Answer #{userAnswers.length - index}
//                     </span>
//                     <span className="text-sm text-gray-500">•</span>
//                     <span className="text-sm text-gray-500">
//                       {formatDate(answer.createdAt)}
//                     </span>
//                   </div>
//                   <div className="flex items-center space-x-4">
//                     <span className="flex items-center text-sm text-gray-600">
//                       <Trophy className="w-4 h-4 mr-1" />
//                       {answer.upvotes} upvotes
//                     </span>
//                     {answer.upvotes > 5 && (
//                       <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
//                         Popular
//                       </span>
//                     )}
//                   </div>
//                 </div>
//                 <p className="text-gray-700 line-clamp-3 leading-relaxed">
//                   {answer.content}
//                 </p>
//                 {answer.content.length > 150 && (
//                   <button className="mt-2 text-blue-600 text-sm hover:text-blue-800">
//                     Read more →
//                   </button>
//                 )}
//               </div>
//             ))}
            
//             {userAnswers.length > 5 && (
//               <div className="text-center pt-4">
//                 <a 
//                   href="/past-questions" 
//                   className="text-blue-600 hover:text-blue-800 font-medium"
//                 >
//                   View all {userAnswers.length} answers →
//                 </a>
//               </div>
//             )}
//           </div>
//         )}
//       </div>

//       {/* Achievement Section */}
//       {userStats.questionsSolved > 0 && (
//         <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
//           <h2 className="text-xl font-bold text-gray-900 mb-4">Achievements</h2>
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//             {userStats.questionsSolved >= 1 && (
//               <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
//                 <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
//                   <Target className="w-5 h-5 text-white" />
//                 </div>
//                 <div>
//                   <p className="font-medium text-green-800">First Case Solved</p>
//                   <p className="text-sm text-green-600">Welcome to CaseBuddy!</p>
//                 </div>
//               </div>
//             )}
            
//             {userStats.questionsSolved >= 5 && (
//               <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
//                 <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
//                   <BookOpen className="w-5 h-5 text-white" />
//                 </div>
//                 <div>
//                   <p className="font-medium text-blue-800">Problem Solver</p>
//                   <p className="text-sm text-blue-600">Solved 5 cases</p>
//                 </div>
//               </div>
//             )}
            
//             {userStats.totalUpvotes >= 10 && (
//               <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg">
//                 <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
//                   <Trophy className="w-5 h-5 text-white" />
//                 </div>
//                 <div>
//                   <p className="font-medium text-purple-800">Community Favorite</p>
//                   <p className="text-sm text-purple-600">10+ total upvotes</p>
//                 </div>
//               </div>
//             )}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }