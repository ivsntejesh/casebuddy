// src/components/AIFeedbackModal.tsx

import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { feedbackService } from '../lib/feedbackService';
import { AIFeedback } from '../types/feedback';
import { 
  X,
  Sparkles, 
  Loader, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  Lightbulb,
  Target,
  BookOpen
} from 'lucide-react';

interface AIFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  answerId: string;
  questionId: string;
  questionTitle: string;
  questionDescription: string;
  userAnswer: string;
}

export default function AIFeedbackModal({
  isOpen,
  onClose,
  answerId,
  questionId,
  questionTitle,
  questionDescription,
  userAnswer
}: AIFeedbackModalProps) {
  const { user } = useAuth();
  const [feedback, setFeedback] = useState<AIFeedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number>(3);

  useEffect(() => {
    if (isOpen) {
      checkExistingFeedback();
      fetchRemainingRequests();
    }
  }, [isOpen, answerId]);

  const checkExistingFeedback = async () => {
    try {
      const existingFeedback = await feedbackService.getFeedbackForAnswer(answerId);
      
      if (existingFeedback) {
        // Check if the feedback needs re-parsing
        const needsReparsing = 
          (!existingFeedback.feedback.strengths || 
           existingFeedback.feedback.strengths.length === 0 ||
           existingFeedback.feedback.strengths[0] === 'STRENGTHS');
        
        if (needsReparsing && existingFeedback.feedback.content) {
          console.log('🔄 Re-parsing existing feedback content in modal...');
          const reparsed = parseExistingFeedback(existingFeedback.feedback.content);
          existingFeedback.feedback = {
            ...existingFeedback.feedback,
            ...reparsed
          };
        }
        
        setFeedback(existingFeedback);
      }
    } catch (error) {
      console.error('Error checking existing feedback:', error);
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

  const fetchRemainingRequests = async () => {
    if (!user) return;
    const stats = await feedbackService.getUserDailyStats(user.uid, user.email);
    setRemaining(stats.remainingToday);
  };

  const handleRequestFeedback = async () => {
    if (!user || loading) return;

    // Check answer length
    if (userAnswer.trim().length < 50) {
      setError('⚠️ Your solution seems quite brief. AI feedback works best with detailed responses including your approach, assumptions, and reasoning (at least 50 characters).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const newFeedback = await feedbackService.generateFeedback(
        answerId,
        user.uid,
        user.email,
        questionId,
        questionTitle,
        questionDescription,
        userAnswer
      );

      setFeedback(newFeedback);
      await fetchRemainingRequests();
    } catch (err) {
      console.error('Error generating feedback:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-500 to-blue-500 text-white p-6 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <Sparkles className="w-6 h-6" />
            <h2 className="text-2xl font-bold">AI Feedback</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition duration-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Your Answer Preview */}
          <div className="mb-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Your Answer:</h3>
            <p className="text-sm text-gray-600 line-clamp-3">{userAnswer}</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800">{error}</p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <Loader className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Analyzing Your Solution...
              </h3>
              <p className="text-gray-600 text-sm">
                Our AI is carefully reviewing your approach. This may take 20-30 seconds.
              </p>
            </div>
          )}

          {/* Feedback Display */}
          {feedback && !loading && (
            <div className="space-y-4">
              {/* Strengths Section */}
              {feedback.feedback.strengths && feedback.feedback.strengths.length > 0 && (
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center space-x-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <h4 className="font-semibold text-green-900">Strengths</h4>
                  </div>
                  <ul className="space-y-2">
                    {feedback.feedback.strengths.map((strength, index) => (
                      <li key={index} className="text-sm text-gray-700 flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Areas for Improvement */}
              {feedback.feedback.improvements && feedback.feedback.improvements.length > 0 && (
                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                  <div className="flex items-center space-x-2 mb-3">
                    <TrendingUp className="w-5 h-5 text-orange-600" />
                    <h4 className="font-semibold text-orange-900">Areas for Improvement</h4>
                  </div>
                  <ul className="space-y-2">
                    {feedback.feedback.improvements.map((improvement, index) => (
                      <li key={index} className="text-sm text-gray-700 flex items-start">
                        <span className="text-orange-500 mr-2">→</span>
                        <span>{improvement}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missing Considerations */}
              {feedback.feedback.missing && feedback.feedback.missing.length > 0 && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center space-x-2 mb-3">
                    <Lightbulb className="w-5 h-5 text-blue-600" />
                    <h4 className="font-semibold text-blue-900">Missing Considerations</h4>
                  </div>
                  <ul className="space-y-2">
                    {feedback.feedback.missing.map((missing, index) => (
                      <li key={index} className="text-sm text-gray-700 flex items-start">
                        <span className="text-blue-500 mr-2">•</span>
                        <span>{missing}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Framework Suggestions */}
              {feedback.feedback.frameworks && feedback.feedback.frameworks.length > 0 && (
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <div className="flex items-center space-x-2 mb-3">
                    <BookOpen className="w-5 h-5 text-purple-600" />
                    <h4 className="font-semibold text-purple-900">Framework Suggestions</h4>
                  </div>
                  <ul className="space-y-2">
                    {feedback.feedback.frameworks.map((framework, index) => (
                      <li key={index} className="text-sm text-gray-700 flex items-start">
                        <span className="text-purple-500 mr-2">📊</span>
                        <span>{framework}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Full Feedback (if structured parsing didn't work) */}
              {(!feedback.feedback.strengths || feedback.feedback.strengths.length === 0) && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="prose prose-sm max-w-none">
                    <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {feedback.feedback.content}
                    </p>
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-500 text-center pt-4 border-t border-gray-200">
                Generated {new Date(feedback.generatedAt?.toDate?.() || feedback.generatedAt).toLocaleString()}
              </div>
            </div>
          )}

          {/* Request Feedback Button */}
          {!feedback && !loading && (
            <div className="text-center py-8">
              <Sparkles className="w-16 h-16 text-purple-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Ready for AI Feedback?
              </h3>
              <p className="text-gray-600 mb-6 text-sm">
                Get personalized insights on your approach and areas for improvement.
              </p>
              
              <button
                onClick={handleRequestFeedback}
                disabled={remaining <= 0}
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium py-3 px-8 rounded-lg transition duration-200 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-5 h-5" />
                <span>Generate Feedback</span>
              </button>

              <p className="text-xs text-gray-500 mt-4">
                {remaining > 0 ? (
                  <>
                    <Target className="w-3 h-3 inline mr-1" />
                    {remaining} {remaining === 1 ? 'request' : 'requests'} remaining today
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3 inline mr-1" />
                    Daily limit reached. Resets at midnight.
                  </>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}