// components/CaseSolveModal.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  addDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { Answer } from '../types';
import { 
  X, 
  CheckCircle, 
  Target, 
  Clock,
  MessageSquare,
  AlertCircle,
  Eye
} from 'lucide-react';

interface CaseSolveModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionId: string;
  questionTitle: string;
  questionDescription: string;
  questionType: 'consulting' | 'product';
  questionDifficulty: 'easy' | 'medium' | 'hard';
}

export default function CaseSolveModal({
  isOpen,
  onClose,
  questionId,
  questionTitle,
  questionDescription,
  questionType,
  questionDifficulty,
}: CaseSolveModalProps) {
  const { user } = useAuth();
  const [userAnswer, setUserAnswer] = useState<Answer | null>(null);
  const [newAnswer, setNewAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [otherAnswersCount, setOtherAnswersCount] = useState(0);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      console.log('🔍 Modal opened for question:', questionId);
      setLoading(true);
      setError(null);
      setUserAnswer(null);
      setNewAnswer('');
      checkExistingAnswer();
    } else {
      // Reset when modal closes
      setUserAnswer(null);
      setNewAnswer('');
      setError(null);
    }
  }, [isOpen, questionId, user]);

  const checkExistingAnswer = async () => {
    if (!user) {
      console.log('⚠️ No user logged in');
      setLoading(false);
      return;
    }
    
    try {
      console.log('📊 Fetching data for question:', questionId);
      
      // Check if user already answered this case
      const answersRef = collection(db, 'answers');
      const userAnswerQuery = query(
        answersRef,
        where('questionId', '==', questionId),
        where('userId', '==', user.uid)
      );
      
      console.log('🔎 Querying user answer...');
      const userAnswerSnapshot = await getDocs(userAnswerQuery);

      if (!userAnswerSnapshot.empty) {
        const answerData = {
          id: userAnswerSnapshot.docs[0].id,
          ...userAnswerSnapshot.docs[0].data()
        } as Answer;
        console.log('✅ User answer found:', answerData.id);
        setUserAnswer(answerData);
      } else {
        console.log('ℹ️ No existing answer from user');
      }

      // Count all answers for this question
      const allAnswersQuery = query(answersRef, where('questionId', '==', questionId));
      console.log('🔎 Counting all answers...');
      const allAnswersSnapshot = await getDocs(allAnswersQuery);
      const count = allAnswersSnapshot.size;
      console.log(`✅ Found ${count} total answers`);
      setOtherAnswersCount(count);
      
    } catch (err) {
      console.error('❌ Error fetching answer data:', err);
      setError('Failed to load case data. Please try again.');
    } finally {
      console.log('✅ Loading complete');
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !newAnswer.trim() || submitting) return;

    setSubmitting(true);
    setError(null);
    
    try {
      console.log('📤 Submitting answer...');
      
      const docRef = await addDoc(collection(db, 'answers'), {
        questionId,
        userId: user.uid,
        userDisplayName: user.displayName || 'Anonymous',
        content: newAnswer,
        upvotes: 0,
        upvotedBy: [],
        createdAt: serverTimestamp()
      });

      const newAnswerData: Answer = {
        id: docRef.id,
        questionId,
        userId: user.uid,
        userDisplayName: user.displayName || 'Anonymous',
        content: newAnswer,
        upvotes: 0,
        upvotedBy: [],
        createdAt: new Date()
      };

      console.log('✅ Answer submitted:', docRef.id);
      
      setUserAnswer(newAnswerData);
      setNewAnswer('');
      setOtherAnswersCount(prev => prev + 1);
      
    } catch (err) {
      console.error('❌ Error submitting answer:', err);
      setError('Failed to submit answer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-blue-100 text-blue-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'consulting': return 'bg-green-100 text-green-800';
      case 'product': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-purple-500 text-white p-6 flex items-start justify-between rounded-t-2xl">
          <div className="flex-1 pr-4">
            <div className="flex items-center space-x-2 mb-3">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTypeColor(questionType)} bg-white`}>
                {questionType.charAt(0).toUpperCase() + questionType.slice(1)}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getDifficultyColor(questionDifficulty)} bg-white`}>
                {questionDifficulty.charAt(0).toUpperCase() + questionDifficulty.slice(1)}
              </span>
            </div>
            <h2 className="text-2xl font-bold mb-2">{questionTitle}</h2>
            <div className="flex items-center space-x-4 text-white/90 text-sm">
              <div className="flex items-center space-x-1">
                <MessageSquare className="w-4 h-4" />
                <span>{otherAnswersCount} solutions</span>
              </div>
              {userAnswer && (
                <div className="flex items-center space-x-1">
                  <CheckCircle className="w-4 h-4" />
                  <span>Already solved</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition duration-200 flex-shrink-0"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading case details...</p>
              <p className="text-xs text-gray-400 mt-2">Fetching your previous answers</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 font-medium mb-2">{error}</p>
              <button
                onClick={checkExistingAnswer}
                className="text-sm text-blue-600 hover:text-blue-700 underline"
              >
                Try Again
              </button>
            </div>
          ) : (
            <>
              {/* Case Description */}
              <div className="bg-gray-50 rounded-xl p-6 mb-6 border-l-4 border-blue-500">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Case Description</h3>
                <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {questionDescription}
                </p>
              </div>

              {/* User's Answer (if exists) */}
              {userAnswer ? (
                <div className="mb-6">
                  <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
                    <div className="flex items-center space-x-2 mb-4">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <h3 className="font-semibold text-green-800 text-lg">Your Solution</h3>
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                        Submitted {formatDate(userAnswer.createdAt)}
                      </span>
                    </div>
                    <p className="text-gray-800 whitespace-pre-wrap leading-relaxed mb-4">
                      {userAnswer.content}
                    </p>
                    <div className="flex items-center justify-between pt-4 border-t border-green-200">
                      <a
                        href={`/past-questions#${questionId}`}
                        className="inline-flex items-center space-x-2 text-green-700 hover:text-green-800 font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View All Solutions & AI Feedback</span>
                      </a>
                      <span className="text-sm text-green-600">
                        {userAnswer.upvotes} upvotes
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Answer Input Form */
                <div className="mb-6">
                  <div className="flex items-center space-x-2 mb-3">
                    <Target className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Your Solution</h3>
                  </div>
                  <textarea
                    value={newAnswer}
                    onChange={(e) => setNewAnswer(e.target.value)}
                    placeholder="Share your approach, framework, and solution here. Be specific about your assumptions and reasoning..."
                    className="w-full h-64 p-4 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    disabled={submitting}
                  />
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>Take your time to think through systematically</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {newAnswer.length} characters
                    </div>
                  </div>
                </div>
              )}

              {/* Info Banner */}
              {!userAnswer && otherAnswersCount > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-blue-900 font-medium">
                        {otherAnswersCount} students have already solved this case
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        Submit your answer to see community solutions and get AI feedback
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && !loading && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 rounded-b-2xl">
          <div className="flex items-center justify-between">
            {userAnswer ? (
              <>
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition duration-200"
                >
                  Close
                </button>
                <a
                  href={`/past-questions#${questionId}`}
                  className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition duration-200"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>View All Solutions</span>
                </a>
              </>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!newAnswer.trim() || submitting || loading}
                  className="flex items-center space-x-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium rounded-lg transition duration-200"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Target className="w-4 h-4" />
                      <span>Submit Solution</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}