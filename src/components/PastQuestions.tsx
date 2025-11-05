import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { isUserAdmin } from '../lib/adminConfig';
import SimilarCases from './SimilarCases';
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  where,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { Question, Answer } from '../types';
import { geminiService } from '../lib/gemini';
import AIFeedbackModal from './AIFeedbackModal';
import { 
  Calendar, 
  MessageSquare, 
  ThumbsUp, 
  User, 
  Filter,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader,
  Bot,
  Shield
} from 'lucide-react';

interface QuestionWithAnswers extends Question {
  answers: Answer[];
  aiAnswer?: Answer;
  showAnswers: boolean;
  loadingAI: boolean;
}

export default function PastQuestions() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<QuestionWithAnswers[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [filter, setFilter] = useState<{
    type: 'all' | 'consulting' | 'product';
    difficulty: 'all' | 'easy' | 'medium' | 'hard';
  }>({
    type: 'all',
    difficulty: 'all'
  });

  // AI Feedback Modal State
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [selectedAnswerForFeedback, setSelectedAnswerForFeedback] = useState<{
    answerId: string;
    questionId: string;
    questionTitle: string;
    questionDescription: string;
    userAnswer: string;
  } | null>(null);

  useEffect(() => {
    if (user) {
      checkAdminStatus();
      fetchQuestionsAndAnswers();
    }
  }, [user]);

  const checkAdminStatus = () => {
    if (user?.email) {
      setIsAdmin(isUserAdmin(user.email));
    }
  };

  const fetchQuestionsAndAnswers = async () => {
    try {
      const questionsRef = collection(db, 'questions');
      const questionsQuery = query(questionsRef, orderBy('datePosted', 'desc'));
      const questionsSnapshot = await getDocs(questionsQuery);

      const answersRef = collection(db, 'answers');
      const answersQuery = query(answersRef, orderBy('createdAt', 'desc'));
      const answersSnapshot = await getDocs(answersQuery);

      const answersData = answersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Answer[];

      const questionsData: QuestionWithAnswers[] = questionsSnapshot.docs.map(doc => {
        const questionData = { id: doc.id, ...doc.data() } as Question;
        
        const allAnswers = answersData.filter(answer => answer.questionId === questionData.id);
        const aiAnswer = allAnswers.find(answer => answer.userId === 'ai-assistant');
        const userAnswers = allAnswers.filter(answer => answer.userId !== 'ai-assistant');
        
        return {
          ...questionData,
          answers: userAnswers,
          aiAnswer: aiAnswer,
          showAnswers: false,
          loadingAI: false
        };
      });

      setQuestions(questionsData);
    } catch (error) {
      console.error('Error fetching questions and answers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpvote = async (answerId: string, isCurrentlyUpvoted: boolean) => {
    if (!user) return;

    try {
      const answerRef = doc(db, 'answers', answerId);
      
      let currentUpvotes = 0;
      for (const question of questions) {
        const foundAnswer = question.answers.find(a => a.id === answerId);
        if (foundAnswer) {
          currentUpvotes = foundAnswer.upvotes;
          break;
        }
        if (question.aiAnswer?.id === answerId) {
          currentUpvotes = question.aiAnswer.upvotes;
          break;
        }
      }

      const newUpvotes = isCurrentlyUpvoted ? currentUpvotes - 1 : currentUpvotes + 1;
      
      if (isCurrentlyUpvoted) {
        await updateDoc(answerRef, {
          upvotedBy: arrayRemove(user.uid),
          upvotes: newUpvotes
        });
      } else {
        await updateDoc(answerRef, {
          upvotedBy: arrayUnion(user.uid),
          upvotes: newUpvotes
        });
      }

      setQuestions(prevQuestions =>
        prevQuestions.map(question => ({
          ...question,
          answers: question.answers.map(answer => {
            if (answer.id === answerId) {
              return {
                ...answer,
                upvotes: newUpvotes,
                upvotedBy: isCurrentlyUpvoted 
                  ? answer.upvotedBy.filter(id => id !== user.uid)
                  : [...answer.upvotedBy, user.uid]
              };
            }
            return answer;
          }),
          aiAnswer: question.aiAnswer?.id === answerId ? {
            ...question.aiAnswer,
            upvotes: newUpvotes,
            upvotedBy: isCurrentlyUpvoted 
              ? question.aiAnswer.upvotedBy.filter(id => id !== user.uid)
              : [...question.aiAnswer.upvotedBy, user.uid]
          } : question.aiAnswer
        }))
      );
    } catch (error) {
      console.error('Error updating upvote:', error);
    }
  };

  const toggleAnswers = (questionIndex: number) => {
    setQuestions(prev => 
      prev.map((q, index) => 
        index === questionIndex 
          ? { ...q, showAnswers: !q.showAnswers }
          : q
      )
    );
  };

  const generateAIAnswer = async (questionIndex: number) => {
    if (!isAdmin) {
      alert('Only administrators can generate AI answers.');
      return;
    }

    const question = questions[questionIndex];
    
    if (question.aiAnswer) {
      alert('AI answer already exists for this question.');
      return;
    }
    
    setQuestions(prev => 
      prev.map((q, index) => 
        index === questionIndex 
          ? { ...q, loadingAI: true }
          : q
      )
    );

    try {
      const aiResponse = await geminiService.generateCaseStudyResponse(
        question.title,
        question.description,
        question.type,
        question.difficulty
      );

      const aiAnswerRef = await addDoc(collection(db, 'answers'), {
        questionId: question.id,
        userId: 'ai-assistant',
        userDisplayName: 'AI Assistant',
        content: aiResponse.content,
        upvotes: 0,
        upvotedBy: [],
        createdAt: serverTimestamp(),
        isAIGenerated: true
      });

      const aiAnswer: Answer = {
        id: aiAnswerRef.id,
        questionId: question.id,
        userId: 'ai-assistant',
        userDisplayName: 'AI Assistant',
        content: aiResponse.content,
        upvotes: 0,
        upvotedBy: [],
        createdAt: new Date()
      };

      setQuestions(prev => 
        prev.map((q, index) => 
          index === questionIndex 
            ? { ...q, aiAnswer, loadingAI: false }
            : q
        )
      );
    } catch (error) {
      console.error('Error generating AI answer:', error);
      alert('Failed to generate AI answer. Please try again.');
      setQuestions(prev => 
        prev.map((q, index) => 
          index === questionIndex 
            ? { ...q, loadingAI: false }
            : q
        )
      );
    }
  };

  // NEW: Open AI Feedback Modal for user's own answer
  const openFeedbackModal = (
    answerId: string,
    questionId: string,
    questionTitle: string,
    questionDescription: string,
    userAnswer: string
  ) => {
    setSelectedAnswerForFeedback({
      answerId,
      questionId,
      questionTitle,
      questionDescription,
      userAnswer
    });
    setFeedbackModalOpen(true);
  };

  const closeFeedbackModal = () => {
    setFeedbackModalOpen(false);
    setSelectedAnswerForFeedback(null);
  };

  const filteredQuestions = questions.filter(question => {
    const matchesType = filter.type === 'all' || question.type === filter.type;
    const matchesDifficulty = filter.difficulty === 'all' || question.difficulty === filter.difficulty;
    return matchesType && matchesDifficulty;
  });

  const formatDate = (date: any) => {
    if (!date) return '';
    try {
      return new Date(date.toDate()).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading past questions...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Past Questions</h1>
        <p className="text-gray-600">Practice with previous case studies and learn from others</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold">Filters</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <select
              value={filter.type}
              onChange={(e) => setFilter({ ...filter, type: e.target.value as any })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="consulting">Consulting</option>
              <option value="product">Product</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
            <select
              value={filter.difficulty}
              onChange={(e) => setFilter({ ...filter, difficulty: e.target.value as any })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {filteredQuestions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Questions Found</h3>
            <p className="text-gray-600">Try adjusting your filters or check back later for new questions.</p>
          </div>
        ) : (
          filteredQuestions.map((question, index) => (
            <div key={question.id} className="bg-white rounded-lg shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{question.title}</h3>
                    <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                      {question.description}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getTypeColor(question.type)}`}>
                      {question.type.charAt(0).toUpperCase() + question.type.slice(1)}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(question.difficulty)}`}>
                      {question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}
                    </span>
                    <div className="flex items-center space-x-1 text-sm text-gray-500">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(question.datePosted)}</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => toggleAnswers(index)}
                    className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-medium transition duration-200"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>{question.answers.length} Solutions</span>
                    {question.showAnswers ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {question.showAnswers && (
                <div className="p-6">
                  {question.loadingAI && (
                    <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                      <div className="flex items-center space-x-2 mb-3">
                        <Loader className="w-5 h-5 text-purple-600 animate-spin" />
                        <Bot className="w-5 h-5 text-purple-600" />
                        <span className="font-semibold text-purple-900">AI Assistant</span>
                        <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
                          Generating...
                        </span>
                      </div>
                      <p className="text-purple-700">Generating expert analysis...</p>
                    </div>
                  )}

                  {question.aiAnswer && (
                    <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <Bot className="w-5 h-5 text-purple-600" />
                          <span className="font-semibold text-purple-900">AI Assistant</span>
                          <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
                            AI Generated
                          </span>
                        </div>
                        <button
                          onClick={() => handleUpvote(
                            question.aiAnswer!.id, 
                            question.aiAnswer!.upvotedBy.includes(user?.uid || '')
                          )}
                          className={`flex items-center space-x-1 px-3 py-1 rounded-full transition duration-200 ${
                            question.aiAnswer!.upvotedBy.includes(user?.uid || '')
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-white text-gray-600 hover:bg-purple-50'
                          }`}
                        >
                          <ThumbsUp className="w-4 h-4" />
                          <span>{question.aiAnswer.upvotes}</span>
                        </button>
                      </div>
                      <div className="prose prose-purple max-w-none">
                        <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                          {question.aiAnswer.content}
                        </p>
                      </div>
                    </div>
                  )}

                  {isAdmin && !question.aiAnswer && !question.loadingAI && (
                    <div className="mb-6 p-4 bg-white border-2 border-dashed border-purple-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Shield className="w-5 h-5 text-purple-600" />
                          <span className="font-medium text-gray-900">Admin Controls</span>
                        </div>
                        <button
                          onClick={() => generateAIAnswer(index)}
                          className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>Generate AI Analysis</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* NEW: Similar Cases Component
                  <div className="mb-6">
                    <SimilarCases
                      questionId={question.id}
                      questionTitle={question.title}
                      questionDescription={question.description}
                      questionType={question.type}
                      questionDifficulty={question.difficulty}
                    />
                  </div> */}

                  {question.answers.length > 0 ? (
                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">
                        Community Solutions ({question.answers.length})
                      </h4>
                      {question.answers
                        .sort((a, b) => b.upvotes - a.upvotes)
                        .map((answer) => {
                          const isUserAnswer = answer.userId === user?.uid;
                          
                          return (
                            <div key={answer.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                  <User className="w-4 h-4 text-gray-600" />
                                  <span className="font-medium text-gray-900">{answer.userDisplayName}</span>
                                  {isUserAnswer && (
                                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                                      Your Answer
                                    </span>
                                  )}
                                  <span className="text-sm text-gray-500">
                                    {formatDate(answer.createdAt)}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  {/* AI FEEDBACK BUTTON - Only show for user's own answer */}
                                  {isUserAnswer && (
                                    <button
                                      onClick={() => openFeedbackModal(
                                        answer.id,
                                        question.id,
                                        question.title,
                                        question.description,
                                        answer.content
                                      )}
                                      className="flex items-center space-x-1 px-3 py-1 bg-gradient-to-r from-purple-100 to-blue-100 hover:from-purple-200 hover:to-blue-200 text-purple-700 rounded-full transition duration-200 text-sm font-medium"
                                    >
                                      <Sparkles className="w-3 h-3" />
                                      <span>AI Feedback</span>
                                    </button>
                                  )}
                                  
                                  <button
                                    onClick={() => handleUpvote(
                                      answer.id, 
                                      answer.upvotedBy.includes(user?.uid || '')
                                    )}
                                    className={`flex items-center space-x-1 px-3 py-1 rounded-full transition duration-200 ${
                                      answer.upvotedBy.includes(user?.uid || '')
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-white text-gray-600 hover:bg-blue-50'
                                    }`}
                                  >
                                    <ThumbsUp className="w-4 h-4" />
                                    <span>{answer.upvotes}</span>
                                  </button>
                                </div>
                              </div>
                              <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                                {answer.content}
                              </p>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No community solutions yet.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* AI FEEDBACK MODAL */}
      {selectedAnswerForFeedback && (
        <AIFeedbackModal
          isOpen={feedbackModalOpen}
          onClose={closeFeedbackModal}
          answerId={selectedAnswerForFeedback.answerId}
          questionId={selectedAnswerForFeedback.questionId}
          questionTitle={selectedAnswerForFeedback.questionTitle}
          questionDescription={selectedAnswerForFeedback.questionDescription}
          userAnswer={selectedAnswerForFeedback.userAnswer}
        />
      )}
    </div>
  );
}


// import { useState, useEffect } from 'react';
// import { useAuth } from '../hooks/useAuth';
// import { db } from '../lib/firebase';
// import { isUserAdmin } from '../lib/adminConfig';
// import { 
//   collection, 
//   query, 
//   orderBy, 
//   getDocs, 
//   where,
//   doc,
//   updateDoc,
//   arrayUnion,
//   arrayRemove,
//   addDoc,
//   serverTimestamp
// } from 'firebase/firestore';
// import { Question, Answer } from '../types';
// import { geminiService } from '../lib/gemini';
// import { 
//   Calendar, 
//   MessageSquare, 
//   ThumbsUp, 
//   User, 
//   Filter,
//   ChevronDown,
//   ChevronUp,
//   Sparkles,
//   Loader,
//   Bot,
//   Shield
// } from 'lucide-react';

// interface QuestionWithAnswers extends Question {
//   answers: Answer[];
//   aiAnswer?: Answer;
//   showAnswers: boolean;
//   loadingAI: boolean;
// }

// export default function PastQuestions() {
//   const { user } = useAuth();
//   const [questions, setQuestions] = useState<QuestionWithAnswers[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [isAdmin, setIsAdmin] = useState(false);
//   const [filter, setFilter] = useState<{
//     type: 'all' | 'consulting' | 'product';
//     difficulty: 'all' | 'easy' | 'medium' | 'hard';
//   }>({
//     type: 'all',
//     difficulty: 'all'
//   });

//   useEffect(() => {
//   if (user) {
//     checkAdminStatus();
//     fetchQuestionsAndAnswers();
//   }
//   }, [user]);

//   const checkAdminStatus = () => {
//     if (user?.email) {
//       setIsAdmin(isUserAdmin(user.email));
//     }
//   };

//   const fetchQuestionsAndAnswers = async () => {
//     try {
//       // Fetch all questions
//       const questionsRef = collection(db, 'questions');
//       const questionsQuery = query(questionsRef, orderBy('datePosted', 'desc'));
//       const questionsSnapshot = await getDocs(questionsQuery);

//       // Fetch all answers (including AI answers)
//       const answersRef = collection(db, 'answers');
//       const answersQuery = query(answersRef, orderBy('createdAt', 'desc'));
//       const answersSnapshot = await getDocs(answersQuery);

//       const answersData = answersSnapshot.docs.map(doc => ({
//         id: doc.id,
//         ...doc.data()
//       })) as Answer[];

//       const questionsData: QuestionWithAnswers[] = questionsSnapshot.docs.map(doc => {
//         const questionData = { id: doc.id, ...doc.data() } as Question;
        
//         // Separate AI answers from user answers
//         const allAnswers = answersData.filter(answer => answer.questionId === questionData.id);
//         const aiAnswer = allAnswers.find(answer => answer.userId === 'ai-assistant');
//         const userAnswers = allAnswers.filter(answer => answer.userId !== 'ai-assistant');
        
//         return {
//           ...questionData,
//           answers: userAnswers,
//           aiAnswer: aiAnswer, // This will be undefined if no AI answer exists
//           showAnswers: false,
//           loadingAI: false
//         };
//       });

//       setQuestions(questionsData);
//     } catch (error) {
//       console.error('Error fetching questions and answers:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleUpvote = async (answerId: string, isCurrentlyUpvoted: boolean) => {
//     if (!user) return;

//     try {
//       const answerRef = doc(db, 'answers', answerId);
      
//       // Find the current answer to get the upvote count
//       let currentUpvotes = 0;
//       for (const question of questions) {
//         const foundAnswer = question.answers.find(a => a.id === answerId);
//         if (foundAnswer) {
//           currentUpvotes = foundAnswer.upvotes;
//           break;
//         }
//         if (question.aiAnswer?.id === answerId) {
//           currentUpvotes = question.aiAnswer.upvotes;
//           break;
//         }
//       }

//       const newUpvotes = isCurrentlyUpvoted ? currentUpvotes - 1 : currentUpvotes + 1;
      
//       if (isCurrentlyUpvoted) {
//         await updateDoc(answerRef, {
//           upvotedBy: arrayRemove(user.uid),
//           upvotes: newUpvotes
//         });
//       } else {
//         await updateDoc(answerRef, {
//           upvotedBy: arrayUnion(user.uid),
//           upvotes: newUpvotes
//         });
//       }

//       // Update local state
//       setQuestions(prevQuestions =>
//         prevQuestions.map(question => ({
//           ...question,
//           answers: question.answers.map(answer => {
//             if (answer.id === answerId) {
//               return {
//                 ...answer,
//                 upvotes: newUpvotes,
//                 upvotedBy: isCurrentlyUpvoted 
//                   ? answer.upvotedBy.filter(id => id !== user.uid)
//                   : [...answer.upvotedBy, user.uid]
//               };
//             }
//             return answer;
//           }),
//           aiAnswer: question.aiAnswer?.id === answerId ? {
//             ...question.aiAnswer,
//             upvotes: newUpvotes,
//             upvotedBy: isCurrentlyUpvoted 
//               ? question.aiAnswer.upvotedBy.filter(id => id !== user.uid)
//               : [...question.aiAnswer.upvotedBy, user.uid]
//           } : question.aiAnswer
//         }))
//       );
//     } catch (error) {
//       console.error('Error updating upvote:', error);
//     }
//   };

//   const toggleAnswers = (questionIndex: number) => {
//     setQuestions(prev => 
//       prev.map((q, index) => 
//         index === questionIndex 
//           ? { ...q, showAnswers: !q.showAnswers }
//           : q
//       )
//     );
//   };

//   const generateAIAnswer = async (questionIndex: number) => {
//     if (!isAdmin) {
//       alert('Only administrators can generate AI answers.');
//       return;
//     }

//     const question = questions[questionIndex];
    
//     // Check if AI answer already exists
//     if (question.aiAnswer) {
//       alert('AI answer already exists for this question.');
//       return;
//     }
    
//     setQuestions(prev => 
//       prev.map((q, index) => 
//         index === questionIndex 
//           ? { ...q, loadingAI: true }
//           : q
//       )
//     );

//     try {
//       const aiResponse = await geminiService.generateCaseStudyResponse(
//         question.title,
//         question.description,
//         question.type,
//         question.difficulty
//       );

//       // Create AI answer document
//       const aiAnswerRef = await addDoc(collection(db, 'answers'), {
//         questionId: question.id,
//         userId: 'ai-assistant',
//         userDisplayName: 'AI Assistant',
//         content: aiResponse.content,
//         upvotes: 0,
//         upvotedBy: [],
//         createdAt: serverTimestamp(),
//         isAIGenerated: true
//       });

//       const aiAnswer: Answer = {
//         id: aiAnswerRef.id,
//         questionId: question.id,
//         userId: 'ai-assistant',
//         userDisplayName: 'AI Assistant',
//         content: aiResponse.content,
//         upvotes: 0,
//         upvotedBy: [],
//         createdAt: new Date()
//       };

//       setQuestions(prev => 
//         prev.map((q, index) => 
//           index === questionIndex 
//             ? { ...q, aiAnswer, loadingAI: false }
//             : q
//         )
//       );
//     } catch (error) {
//       console.error('Error generating AI answer:', error);
//       alert('Failed to generate AI answer. Please try again.');
//       setQuestions(prev => 
//         prev.map((q, index) => 
//           index === questionIndex 
//             ? { ...q, loadingAI: false }
//             : q
//         )
//       );
//     }
//   };

//   const filteredQuestions = questions.filter(question => {
//     const matchesType = filter.type === 'all' || question.type === filter.type;
//     const matchesDifficulty = filter.difficulty === 'all' || question.difficulty === filter.difficulty;
//     return matchesType && matchesDifficulty;
//   });

//   const formatDate = (date: any) => {
//     if (!date) return '';
//     try {
//       return new Date(date.toDate()).toLocaleDateString('en-US', {
//         year: 'numeric',
//         month: 'short',
//         day: 'numeric'
//       });
//     } catch (error) {
//       return new Date(date).toLocaleDateString('en-US', {
//         year: 'numeric',
//         month: 'short',
//         day: 'numeric'
//       });
//     }
//   };

//   const getDifficultyColor = (difficulty: string) => {
//     switch (difficulty) {
//       case 'easy': return 'bg-blue-100 text-blue-800';
//       case 'medium': return 'bg-yellow-100 text-yellow-800';
//       case 'hard': return 'bg-red-100 text-red-800';
//       default: return 'bg-gray-100 text-gray-800';
//     }
//   };

//   const getTypeColor = (type: string) => {
//     switch (type) {
//       case 'consulting': return 'bg-green-100 text-green-800';
//       case 'product': return 'bg-purple-100 text-purple-800';
//       default: return 'bg-gray-100 text-gray-800';
//     }
//   };

//   if (loading) {
//     return (
//       <div className="text-center py-8">
//         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
//         <p className="text-gray-600">Loading past questions...</p>
//       </div>
//     );
//   }

//   return (
//     <div className="max-w-6xl mx-auto">
//       <div className="mb-8">
//         <h1 className="text-3xl font-bold text-gray-900 mb-2">Past Questions</h1>
//         <p className="text-gray-600">Practice with previous case studies and learn from others</p>
//       </div>

//       {/* Filters */}
//       <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
//         <div className="flex items-center space-x-2 mb-4">
//           <Filter className="w-5 h-5 text-gray-600" />
//           <h2 className="text-lg font-semibold">Filters</h2>
//         </div>
        
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//           <div>
//             <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
//             <select
//               value={filter.type}
//               onChange={(e) => setFilter({ ...filter, type: e.target.value as any })}
//               className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//             >
//               <option value="all">All Types</option>
//               <option value="consulting">Consulting</option>
//               <option value="product">Product</option>
//             </select>
//           </div>
          
//           <div>
//             <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
//             <select
//               value={filter.difficulty}
//               onChange={(e) => setFilter({ ...filter, difficulty: e.target.value as any })}
//               className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//             >
//               <option value="all">All Difficulties</option>
//               <option value="easy">Easy</option>
//               <option value="medium">Medium</option>
//               <option value="hard">Hard</option>
//             </select>
//           </div>
//         </div>
//       </div>

//       {/* Questions List */}
//       <div className="space-y-6">
//         {filteredQuestions.length === 0 ? (
//           <div className="bg-white rounded-lg shadow-sm p-8 text-center">
//             <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
//             <h3 className="text-xl font-semibold text-gray-900 mb-2">No Questions Found</h3>
//             <p className="text-gray-600">Try adjusting your filters or check back later for new questions.</p>
//           </div>
//         ) : (
//           filteredQuestions.map((question, index) => (
//             <div key={question.id} className="bg-white rounded-lg shadow-sm border border-gray-100">
//               {/* Question Header */}
//               <div className="p-6 border-b border-gray-100">
//                 <div className="flex items-start justify-between mb-4">
//                   <div className="flex-1">
//                     <h3 className="text-xl font-semibold text-gray-900 mb-2">{question.title}</h3>
//                     <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
//                       {question.description}
//                     </p>
//                   </div>
//                 </div>
                
//                 <div className="flex items-center justify-between">
//                   <div className="flex items-center space-x-3">
//                     <span className={`px-3 py-1 rounded-full text-sm font-medium ${getTypeColor(question.type)}`}>
//                       {question.type.charAt(0).toUpperCase() + question.type.slice(1)}
//                     </span>
//                     <span className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(question.difficulty)}`}>
//                       {question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}
//                     </span>
//                     <div className="flex items-center space-x-1 text-sm text-gray-500">
//                       <Calendar className="w-4 h-4" />
//                       <span>{formatDate(question.datePosted)}</span>
//                     </div>
//                   </div>
                  
//                   <button
//                     onClick={() => toggleAnswers(index)}
//                     className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-medium transition duration-200"
//                   >
//                     <MessageSquare className="w-4 h-4" />
//                     <span>{question.answers.length} Solutions</span>
//                     {question.showAnswers ? (
//                       <ChevronUp className="w-4 h-4" />
//                     ) : (
//                       <ChevronDown className="w-4 h-4" />
//                     )}
//                   </button>
//                 </div>
//               </div>

//               {/* Answers Section */}
//               {question.showAnswers && (
//                 <div className="p-6">
//                   {/* AI Answer Loading State */}
//                   {question.loadingAI && (
//                     <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
//                       <div className="flex items-center space-x-2 mb-3">
//                         <Loader className="w-5 h-5 text-purple-600 animate-spin" />
//                         <Bot className="w-5 h-5 text-purple-600" />
//                         <span className="font-semibold text-purple-900">AI Assistant</span>
//                         <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
//                           Generating...
//                         </span>
//                       </div>
//                       <p className="text-purple-700">Generating expert analysis...</p>
//                     </div>
//                   )}

//                   {/* Existing AI Answer */}
//                   {question.aiAnswer && (
//                     <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
//                       <div className="flex items-center justify-between mb-3">
//                         <div className="flex items-center space-x-2">
//                           <Bot className="w-5 h-5 text-purple-600" />
//                           <span className="font-semibold text-purple-900">AI Assistant</span>
//                           <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
//                             AI Generated
//                           </span>
//                         </div>
//                         <button
//                           onClick={() => handleUpvote(
//                             question.aiAnswer!.id, 
//                             question.aiAnswer!.upvotedBy.includes(user?.uid || '')
//                           )}
//                           className={`flex items-center space-x-1 px-3 py-1 rounded-full transition duration-200 ${
//                             question.aiAnswer!.upvotedBy.includes(user?.uid || '')
//                               ? 'bg-purple-100 text-purple-700'
//                               : 'bg-white text-gray-600 hover:bg-purple-50'
//                           }`}
//                         >
//                           <ThumbsUp className="w-4 h-4" />
//                           <span>{question.aiAnswer.upvotes}</span>
//                         </button>
//                       </div>
//                       <div className="prose prose-purple max-w-none">
//                         <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
//                           {question.aiAnswer.content}
//                         </p>
//                       </div>
//                     </div>
//                   )}

//                   {/* Admin: Generate AI Answer Button */}
//                   {isAdmin && !question.aiAnswer && !question.loadingAI && (
//                     <div className="mb-6 p-4 bg-white border-2 border-dashed border-purple-200 rounded-lg">
//                       <div className="flex items-center justify-between">
//                         <div className="flex items-center space-x-2">
//                           <Shield className="w-5 h-5 text-purple-600" />
//                           <span className="font-medium text-gray-900">Admin Controls</span>
//                         </div>
//                         <button
//                           onClick={() => generateAIAnswer(index)}
//                           className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
//                         >
//                           <Sparkles className="w-4 h-4" />
//                           <span>Generate AI Analysis</span>
//                         </button>
//                       </div>
//                     </div>
//                   )}

//                   {/* User Answers */}
//                   {question.answers.length > 0 ? (
//                     <div className="space-y-4">
//                       <h4 className="text-lg font-semibold text-gray-900 mb-4">
//                         Community Solutions ({question.answers.length})
//                       </h4>
//                       {question.answers
//                         .sort((a, b) => b.upvotes - a.upvotes)
//                         .map((answer) => (
//                         <div key={answer.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
//                           <div className="flex items-center justify-between mb-3">
//                             <div className="flex items-center space-x-2">
//                               <User className="w-4 h-4 text-gray-600" />
//                               <span className="font-medium text-gray-900">{answer.userDisplayName}</span>
//                               <span className="text-sm text-gray-500">
//                                 {formatDate(answer.createdAt)}
//                               </span>
//                             </div>
//                             <button
//                               onClick={() => handleUpvote(
//                                 answer.id, 
//                                 answer.upvotedBy.includes(user?.uid || '')
//                               )}
//                               className={`flex items-center space-x-1 px-3 py-1 rounded-full transition duration-200 ${
//                                 answer.upvotedBy.includes(user?.uid || '')
//                                   ? 'bg-blue-100 text-blue-700'
//                                   : 'bg-white text-gray-600 hover:bg-blue-50'
//                               }`}
//                             >
//                               <ThumbsUp className="w-4 h-4" />
//                               <span>{answer.upvotes}</span>
//                             </button>
//                           </div>
//                           <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
//                             {answer.content}
//                           </p>
//                         </div>
//                       ))}
//                     </div>
//                   ) : (
//                     <div className="text-center py-8 text-gray-500">
//                       <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
//                       <p>No community solutions yet.</p>
//                     </div>
//                   )}
//                 </div>
//               )}
//             </div>
//           ))
//         )}
//       </div>
//     </div>
//   );
// }