import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  where,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { Question, Answer } from '../types';
import { Calendar, Clock, CheckCircle, Circle, ChevronUp, Send } from 'lucide-react';

export default function PastQuestions() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userAnswers, setUserAnswers] = useState<{[key: string]: Answer}>({});
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [questionAnswers, setQuestionAnswers] = useState<Answer[]>([]);
  const [newAnswer, setNewAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPastQuestions();
      fetchUserAnswers();
    }
  }, [user]);

  const fetchPastQuestions = async () => {
    try {
      const questionsRef = collection(db, 'questions');
      const q = query(questionsRef, orderBy('datePosted', 'desc'));
      const snapshot = await getDocs(q);
      
      const questionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Question[];
      
      setQuestions(questionsData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching past questions:', error);
      setLoading(false);
    }
  };

  const fetchUserAnswers = async () => {
    if (!user) return;

    try {
      const answersRef = collection(db, 'answers');
      const q = query(answersRef, where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      
      const answersMap: {[key: string]: Answer} = {};
      snapshot.docs.forEach(doc => {
        const answer = { id: doc.id, ...doc.data() } as Answer;
        answersMap[answer.questionId] = answer;
      });
      
      setUserAnswers(answersMap);
    } catch (error) {
      console.error('Error fetching user answers:', error);
    }
  };

  const fetchQuestionAnswers = async (questionId: string) => {
    try {
      const answersRef = collection(db, 'answers');
      const q = query(
        answersRef,
        where('questionId', '==', questionId),
        orderBy('upvotes', 'desc')
      );
      const snapshot = await getDocs(q);
      
      const answers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Answer[];
      
      setQuestionAnswers(answers);
    } catch (error) {
      console.error('Error fetching question answers:', error);
    }
  };

  const handleQuestionClick = async (question: Question) => {
    setSelectedQuestion(question);
    await fetchQuestionAnswers(question.id);
  };

  const submitAnswer = async () => {
    if (!newAnswer.trim() || !selectedQuestion || !user || submitting) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'answers'), {
        questionId: selectedQuestion.id,
        userId: user.uid,
        userDisplayName: user.displayName || 'Anonymous',
        content: newAnswer,
        upvotes: 0,
        upvotedBy: [],
        createdAt: serverTimestamp()
      });

      setNewAnswer('');
      await fetchUserAnswers();
      await fetchQuestionAnswers(selectedQuestion.id);
    } catch (error) {
      console.error('Error submitting answer:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleUpvote = async (answerId: string, currentUpvotes: number, upvotedBy: string[]) => {
    if (!user) return;

    try {
      const answerRef = doc(db, 'answers', answerId);
      const hasUpvoted = upvotedBy.includes(user.uid);

      if (hasUpvoted) {
        // Remove upvote
        await updateDoc(answerRef, {
          upvotes: currentUpvotes - 1,
          upvotedBy: arrayRemove(user.uid)
        });
      } else {
        // Add upvote
        await updateDoc(answerRef, {
          upvotes: currentUpvotes + 1,
          upvotedBy: arrayUnion(user.uid)
        });
      }

      await fetchQuestionAnswers(selectedQuestion!.id);
    } catch (error) {
      console.error('Error toggling upvote:', error);
    }
  };

  const formatDate = (date: any) => {
    if (!date) return '';
    try {
      return new Date(date.toDate()).toLocaleDateString();
    } catch (error) {
      return new Date(date).toLocaleDateString();
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

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading past questions...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Past Questions</h1>
        <p className="text-gray-600 mt-2">Practice with previous case questions and compare solutions</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Questions List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm p-4 sticky top-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">All Questions</h2>
              <span className="text-sm text-gray-500">({questions.length})</span>
            </div>
            
            {questions.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No questions available yet.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {questions.map((question) => {
                  const hasAnswered = userAnswers[question.id];
                  const isSelected = selectedQuestion?.id === question.id;
                  
                  return (
                    <button
                      key={question.id}
                      onClick={() => handleQuestionClick(question)}
                      className={`w-full text-left p-3 rounded-lg transition duration-200 ${
                        isSelected
                          ? 'bg-blue-50 border-blue-200 border'
                          : 'hover:bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${getTypeColor(question.type)}`}>
                            {question.type}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${getDifficultyColor(question.difficulty)}`}>
                            {question.difficulty}
                          </span>
                        </div>
                        {hasAnswered ? (
                          <CheckCircle size={16} className="text-green-500" />
                        ) : (
                          <Circle size={16} className="text-gray-400" />
                        )}
                      </div>
                      
                      <h3 className="font-medium text-sm mb-2 line-clamp-2">{question.title}</h3>
                      
                      <div className="flex items-center text-xs text-gray-500">
                        <Calendar size={12} className="mr-1" />
                        {formatDate(question.datePosted)}
                      </div>
                      
                      {question.isActive && (
                        <div className="mt-1">
                          <span className="inline-block bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">
                            Today's Question
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Question Detail */}
        <div className="lg:col-span-2">
          {selectedQuestion ? (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-3">{selectedQuestion.title}</h2>
                  <div className="flex items-center space-x-2 mb-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getTypeColor(selectedQuestion.type)}`}>
                      {selectedQuestion.type}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(selectedQuestion.difficulty)}`}>
                      {selectedQuestion.difficulty}
                    </span>
                    {selectedQuestion.isActive && (
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                        Active Today
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <p className="text-gray-700 mb-6 whitespace-pre-wrap leading-relaxed">
                {selectedQuestion.description}
              </p>

              {/* Answer Section */}
              {!userAnswers[selectedQuestion.id] ? (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-3">Your Answer</h3>
                  <textarea
                    value={newAnswer}
                    onChange={(e) => setNewAnswer(e.target.value)}
                    placeholder="Write your solution here... Be specific with your approach, assumptions, and calculations."
                    className="w-full h-40 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    disabled={submitting}
                  />
                  <button
                    onClick={submitAnswer}
                    disabled={!newAnswer.trim() || submitting}
                    className="mt-3 flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
                  >
                    <Send size={16} />
                    <span>{submitting ? 'Submitting...' : 'Submit Answer'}</span>
                  </button>
                </div>
              ) : (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-3">Your Answer</h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-gray-700 whitespace-pre-wrap mb-3">
                      {userAnswers[selectedQuestion.id].content}
                    </p>
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>Submitted on {formatDate(userAnswers[selectedQuestion.id].createdAt)}</span>
                      <div className="flex items-center space-x-1">
                        <ChevronUp size={16} />
                        <span>{userAnswers[selectedQuestion.id].upvotes} upvotes</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* All Answers */}
              {userAnswers[selectedQuestion.id] && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">All Solutions</h3>
                    <span className="text-sm text-gray-500">({questionAnswers.length} solutions)</span>
                  </div>
                  
                  {questionAnswers.length === 0 ? (
                    <div className="text-center py-8">
                      <Clock size={48} className="text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No solutions yet. Be the first to solve this case!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {questionAnswers.map((answer, index) => (
                        <div key={answer.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center space-x-2 mb-1">
                                <p className="font-medium text-gray-900">{answer.userDisplayName}</p>
                                {index === 0 && questionAnswers.length > 1 && (
                                  <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                                    Top Solution
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500">{formatDate(answer.createdAt)}</p>
                            </div>
                            <button
                              onClick={() => toggleUpvote(answer.id, answer.upvotes, answer.upvotedBy)}
                              className={`flex items-center space-x-1 px-3 py-1 rounded-full transition duration-200 ${
                                answer.upvotedBy.includes(user?.uid || '') 
                                  ? 'bg-blue-100 text-blue-600' 
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                              disabled={answer.userId === user?.uid}
                            >
                              <ChevronUp size={16} />
                              <span>{answer.upvotes}</span>
                            </button>
                          </div>
                          <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {answer.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <Clock size={48} className="text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Question</h3>
              <p className="text-gray-600">
                Choose a question from the list to view details and submit your solution.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}