import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { Question, Answer } from '../types';
import { 
  Clock, 
  BookOpen, 
  TrendingUp, 
  Users, 
  CheckCircle,
  ArrowRight,
  Target
} from 'lucide-react';

export default function HomePage() {
  const { user } = useAuth();
  const [todaysQuestion, setTodaysQuestion] = useState<Question | null>(null);
  const [userAnswer, setUserAnswer] = useState<Answer | null>(null);
  const [newAnswer, setNewAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState({
    totalQuestions: 0,
    totalUsers: 0,
    answersToday: 0
  });

  useEffect(() => {
    if (user) {
      fetchTodaysQuestion();
      fetchStats();
    }
  }, [user]);

  const fetchTodaysQuestion = async () => {
    try {
      console.log('🔍 Starting to fetch today\'s question...');
      console.log('🔍 User:', user?.uid);
      
      // Get today's active question
      const questionsRef = collection(db, 'questions');
      console.log('🔍 Questions collection reference created');
      
      const q = query(questionsRef, where('isActive', '==', true), limit(1));
      console.log('🔍 Query created for isActive = true');
      
      const snapshot = await getDocs(q);
      console.log('🔍 Snapshot received, empty?', snapshot.empty);
      console.log('🔍 Number of docs found:', snapshot.size);
      
      if (!snapshot.empty) {
        const questionData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Question;
        console.log('🔍 Question data found:', questionData);
        setTodaysQuestion(questionData);
        
        // Check if user has already answered
        const answersRef = collection(db, 'answers');
        const answerQuery = query(
          answersRef, 
          where('questionId', '==', questionData.id),
          where('userId', '==', user?.uid)
        );
        const answerSnapshot = await getDocs(answerQuery);
        
        if (!answerSnapshot.empty) {
          const answerData = { id: answerSnapshot.docs[0].id, ...answerSnapshot.docs[0].data() } as Answer;
          console.log('🔍 User answer found:', answerData);
          setUserAnswer(answerData);
        }
      } else {
        console.log('❌ No active questions found in Firestore');
        
        // Let's also try to get ALL questions to see what's in the collection
        const allQuestionsSnapshot = await getDocs(collection(db, 'questions'));
        console.log('🔍 All questions in collection:', allQuestionsSnapshot.size);
        allQuestionsSnapshot.forEach(doc => {
          console.log('🔍 Question doc:', doc.id, doc.data());
        });
      }
    } catch (error) {
      console.error('❌ Error fetching today\'s question:', error);
      if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
        console.error('❌ Error details:', (error as { code?: any; message?: any }).code, (error as { code?: any; message?: any }).message);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Get total questions count
      const questionsSnapshot = await getDocs(collection(db, 'questions'));
      
      // Get total answers today (simplified - you might want to add date filtering)
      const answersSnapshot = await getDocs(collection(db, 'answers'));
      
      setStats({
        totalQuestions: questionsSnapshot.size,
        totalUsers: 50, // Placeholder - you'd need to track this differently
        answersToday: answersSnapshot.size
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const submitAnswer = async () => {
    if (!newAnswer.trim() || !todaysQuestion || !user || submitting) return;

    setSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, 'answers'), {
        questionId: todaysQuestion.id,
        userId: user.uid,
        userDisplayName: user.displayName || 'Anonymous',
        content: newAnswer,
        upvotes: 0,
        upvotedBy: [],
        createdAt: serverTimestamp()
      });

      setUserAnswer({
        id: docRef.id,
        questionId: todaysQuestion.id,
        userId: user.uid,
        userDisplayName: user.displayName || 'Anonymous',
        content: newAnswer,
        upvotes: 0,
        upvotedBy: [],
        createdAt: new Date()
      });

      setNewAnswer('');
    } catch (error) {
      console.error('Error submitting answer:', error);
    } finally {
      setSubmitting(false);
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading today's challenge...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user?.displayName?.split(' ')[0]}!
        </h1>
        <p className="text-gray-600">
          Ready to tackle today's case challenge?
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalQuestions}</p>
              <p className="text-sm text-gray-600">Total Cases</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}+</p>
              <p className="text-sm text-gray-600">Active Students</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.answersToday}</p>
              <p className="text-sm text-gray-600">Solutions Shared</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Today's Question */}
        <div className="lg:col-span-2">
          {todaysQuestion ? (
            <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-bold px-4 py-2 rounded-full shadow-sm">
                    🔥 Today's Challenge
                  </span>
                  <Clock className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex space-x-2">
                  <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getTypeColor(todaysQuestion.type)}`}>
                    {todaysQuestion.type.charAt(0).toUpperCase() + todaysQuestion.type.slice(1)}
                  </span>
                  <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getDifficultyColor(todaysQuestion.difficulty)}`}>
                    {todaysQuestion.difficulty.charAt(0).toUpperCase() + todaysQuestion.difficulty.slice(1)}
                  </span>
                </div>
              </div>

              <h2 className="text-3xl font-bold mb-6 text-gray-900">{todaysQuestion.title}</h2>
              
              <div className="bg-gray-50 rounded-xl p-6 mb-8 border-l-4 border-blue-500">
                <p className="text-gray-800 leading-relaxed whitespace-pre-wrap text-lg">
                  {todaysQuestion.description}
                </p>
              </div>

              {userAnswer ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <h3 className="font-semibold text-green-800">Your Solution Submitted</h3>
                  </div>
                  <p className="text-green-700 mb-3 whitespace-pre-wrap">
                    {userAnswer.content}
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-600">
                      Submitted on {formatDate(userAnswer.createdAt)}
                    </span>
                    <span className="text-green-600">
                      {userAnswer.upvotes} upvotes
                    </span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-green-200">
                    <a 
                      href="/past-questions" 
                      className="inline-flex items-center text-green-700 hover:text-green-800 font-medium"
                    >
                      View all solutions <ArrowRight className="w-4 h-4 ml-1" />
                    </a>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Your Solution</h3>
                  <textarea
                    value={newAnswer}
                    onChange={(e) => setNewAnswer(e.target.value)}
                    placeholder="Share your approach, framework, and solution here. Be specific about your assumptions and reasoning..."
                    className="w-full h-48 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    disabled={submitting}
                  />
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-600">
                      Take your time to think through the problem systematically.
                    </p>
                    <button
                      onClick={submitAnswer}
                      disabled={!newAnswer.trim() || submitting}
                      className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-medium py-2 px-6 rounded-lg transition duration-200"
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
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Active Case Today</h3>
              <p className="text-gray-600 mb-4">
                Check back tomorrow for a new challenge, or practice with past questions.
              </p>
              <a 
                href="/past-questions"
                className="inline-flex items-center bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
              >
                Practice Past Cases <ArrowRight className="w-4 h-4 ml-2" />
              </a>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <a 
                href="/past-questions"
                className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition duration-200"
              >
                <div className="flex items-center space-x-3">
                  <BookOpen className="w-5 h-5 text-gray-600" />
                  <span className="font-medium">Past Questions</span>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </a>
              
              <a 
                href="/profile"
                className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition duration-200"
              >
                <div className="flex items-center space-x-3">
                  <Target className="w-5 h-5 text-gray-600" />
                  <span className="font-medium">My Progress</span>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </a>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">Case Interview Tips</h3>
            <ul className="text-sm text-blue-800 space-y-2">
              <li>• Structure your approach clearly</li>
              <li>• State your assumptions</li>
              <li>• Show your calculations</li>
              <li>• Consider multiple perspectives</li>
              <li>• Provide actionable recommendations</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}


// import { useState, useEffect } from 'react';
// import { useAuth } from '../hooks/useAuth';
// import { db } from '../lib/firebase';
// import { 
//   collection, 
//   query, 
//   where, 
//   getDocs, 
//   addDoc, 
//   serverTimestamp,
//   orderBy,
//   limit
// } from 'firebase/firestore';
// import { Question, Answer } from '../types';
// import { 
//   Clock, 
//   BookOpen, 
//   TrendingUp, 
//   Users, 
//   CheckCircle,
//   ArrowRight,
//   Target
// } from 'lucide-react';

// export default function HomePage() {
//   const { user } = useAuth();
//   const [todaysQuestion, setTodaysQuestion] = useState<Question | null>(null);
//   const [userAnswer, setUserAnswer] = useState<Answer | null>(null);
//   const [newAnswer, setNewAnswer] = useState('');
//   const [loading, setLoading] = useState(true);
//   const [submitting, setSubmitting] = useState(false);
//   const [stats, setStats] = useState({
//     totalQuestions: 0,
//     totalUsers: 0,
//     answersToday: 0
//   });

//   useEffect(() => {
//     if (user) {
//       fetchTodaysQuestion();
//       fetchStats();
//     }
//   }, [user]);

//   const fetchTodaysQuestion = async () => {
//     try {
//       // Get today's active question
//       const questionsRef = collection(db, 'questions');
//       const q = query(questionsRef, where('isActive', '==', true), limit(1));
//       const snapshot = await getDocs(q);
      
//       if (!snapshot.empty) {
//         const questionData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Question;
//         setTodaysQuestion(questionData);
        
//         // Check if user has already answered
//         const answersRef = collection(db, 'answers');
//         const answerQuery = query(
//           answersRef, 
//           where('questionId', '==', questionData.id),
//           where('userId', '==', user?.uid)
//         );
//         const answerSnapshot = await getDocs(answerQuery);
        
//         if (!answerSnapshot.empty) {
//           setUserAnswer({ id: answerSnapshot.docs[0].id, ...answerSnapshot.docs[0].data() } as Answer);
//         }
//       }
//     } catch (error) {
//       console.error('Error fetching today\'s question:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const fetchStats = async () => {
//     try {
//       // Get total questions count
//       const questionsSnapshot = await getDocs(collection(db, 'questions'));
      
//       // Get total answers today (simplified - you might want to add date filtering)
//       const answersSnapshot = await getDocs(collection(db, 'answers'));
      
//       setStats({
//         totalQuestions: questionsSnapshot.size,
//         totalUsers: 50, // Placeholder - you'd need to track this differently
//         answersToday: answersSnapshot.size
//       });
//     } catch (error) {
//       console.error('Error fetching stats:', error);
//     }
//   };

//   const submitAnswer = async () => {
//     if (!newAnswer.trim() || !todaysQuestion || !user || submitting) return;

//     setSubmitting(true);
//     try {
//       const docRef = await addDoc(collection(db, 'answers'), {
//         questionId: todaysQuestion.id,
//         userId: user.uid,
//         userDisplayName: user.displayName || 'Anonymous',
//         content: newAnswer,
//         upvotes: 0,
//         upvotedBy: [],
//         createdAt: serverTimestamp()
//       });

//       setUserAnswer({
//         id: docRef.id,
//         questionId: todaysQuestion.id,
//         userId: user.uid,
//         userDisplayName: user.displayName || 'Anonymous',
//         content: newAnswer,
//         upvotes: 0,
//         upvotedBy: [],
//         createdAt: new Date()
//       });

//       setNewAnswer('');
//     } catch (error) {
//       console.error('Error submitting answer:', error);
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const formatDate = (date: any) => {
//     if (!date) return '';
//     try {
//       return new Date(date.toDate()).toLocaleDateString();
//     } catch (error) {
//       return new Date(date).toLocaleDateString();
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
//         <p className="text-gray-600">Loading today's challenge...</p>
//       </div>
//     );
//   }

//   return (
//     <div className="max-w-6xl mx-auto">
//       {/* Welcome Header */}
//       <div className="mb-8">
//         <h1 className="text-3xl font-bold text-gray-900 mb-2">
//           Welcome back, {user?.displayName?.split(' ')[0]}!
//         </h1>
//         <p className="text-gray-600">
//           Ready to tackle today's case challenge?
//         </p>
//       </div>

//       {/* Stats Row */}
//       <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
//         <div className="bg-white p-6 rounded-lg shadow-sm">
//           <div className="flex items-center">
//             <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
//               <BookOpen className="w-6 h-6 text-blue-600" />
//             </div>
//             <div>
//               <p className="text-2xl font-bold text-gray-900">{stats.totalQuestions}</p>
//               <p className="text-sm text-gray-600">Total Cases</p>
//             </div>
//           </div>
//         </div>

//         <div className="bg-white p-6 rounded-lg shadow-sm">
//           <div className="flex items-center">
//             <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
//               <Users className="w-6 h-6 text-green-600" />
//             </div>
//             <div>
//               <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}+</p>
//               <p className="text-sm text-gray-600">Active Students</p>
//             </div>
//           </div>
//         </div>

//         <div className="bg-white p-6 rounded-lg shadow-sm">
//           <div className="flex items-center">
//             <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
//               <TrendingUp className="w-6 h-6 text-purple-600" />
//             </div>
//             <div>
//               <p className="text-2xl font-bold text-gray-900">{stats.answersToday}</p>
//               <p className="text-sm text-gray-600">Solutions Shared</p>
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* Main Content */}
//       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
//         {/* Today's Question */}
//         <div className="lg:col-span-2">
//           {todaysQuestion ? (
//             <div className="bg-white rounded-lg shadow-sm p-6">
//               <div className="flex items-center justify-between mb-4">
//                 <div className="flex items-center space-x-2">
//                   <span className="bg-orange-100 text-orange-800 text-sm font-medium px-3 py-1 rounded-full">
//                     Today's Challenge
//                   </span>
//                   <Clock className="w-4 h-4 text-gray-400" />
//                 </div>
//                 <div className="flex space-x-2">
//                   <span className={`px-3 py-1 rounded-full text-sm font-medium ${getTypeColor(todaysQuestion.type)}`}>
//                     {todaysQuestion.type}
//                   </span>
//                   <span className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(todaysQuestion.difficulty)}`}>
//                     {todaysQuestion.difficulty}
//                   </span>
//                 </div>
//               </div>

//               <h2 className="text-2xl font-bold mb-4">{todaysQuestion.title}</h2>
              
//               <div className="prose prose-gray max-w-none mb-6">
//                 <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
//                   {todaysQuestion.description}
//                 </p>
//               </div>

//               {userAnswer ? (
//                 <div className="bg-green-50 border border-green-200 rounded-lg p-4">
//                   <div className="flex items-center space-x-2 mb-3">
//                     <CheckCircle className="w-5 h-5 text-green-600" />
//                     <h3 className="font-semibold text-green-800">Your Solution Submitted</h3>
//                   </div>
//                   <p className="text-green-700 mb-3 whitespace-pre-wrap">
//                     {userAnswer.content}
//                   </p>
//                   <div className="flex items-center justify-between text-sm">
//                     <span className="text-green-600">
//                       Submitted on {formatDate(userAnswer.createdAt)}
//                     </span>
//                     <span className="text-green-600">
//                       {userAnswer.upvotes} upvotes
//                     </span>
//                   </div>
//                   <div className="mt-4 pt-4 border-t border-green-200">
//                     <a 
//                       href="/past-questions" 
//                       className="inline-flex items-center text-green-700 hover:text-green-800 font-medium"
//                     >
//                       View all solutions <ArrowRight className="w-4 h-4 ml-1" />
//                     </a>
//                   </div>
//                 </div>
//               ) : (
//                 <div>
//                   <h3 className="text-lg font-semibold mb-3">Your Solution</h3>
//                   <textarea
//                     value={newAnswer}
//                     onChange={(e) => setNewAnswer(e.target.value)}
//                     placeholder="Share your approach, framework, and solution here. Be specific about your assumptions and reasoning..."
//                     className="w-full h-48 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
//                     disabled={submitting}
//                   />
//                   <div className="flex items-center justify-between mt-4">
//                     <p className="text-sm text-gray-600">
//                       Take your time to think through the problem systematically.
//                     </p>
//                     <button
//                       onClick={submitAnswer}
//                       disabled={!newAnswer.trim() || submitting}
//                       className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-medium py-2 px-6 rounded-lg transition duration-200"
//                     >
//                       {submitting ? (
//                         <>
//                           <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
//                           <span>Submitting...</span>
//                         </>
//                       ) : (
//                         <>
//                           <Target className="w-4 h-4" />
//                           <span>Submit Solution</span>
//                         </>
//                       )}
//                     </button>
//                   </div>
//                 </div>
//               )}
//             </div>
//           ) : (
//             <div className="bg-white rounded-lg shadow-sm p-8 text-center">
//               <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
//               <h3 className="text-xl font-semibold text-gray-900 mb-2">No Active Case Today</h3>
//               <p className="text-gray-600 mb-4">
//                 Check back tomorrow for a new challenge, or practice with past questions.
//               </p>
//               <a 
//                 href="/past-questions"
//                 className="inline-flex items-center bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
//               >
//                 Practice Past Cases <ArrowRight className="w-4 h-4 ml-2" />
//               </a>
//             </div>
//           )}
//         </div>

//         {/* Sidebar */}
//         <div className="space-y-6">
//           {/* Quick Actions */}
//           <div className="bg-white rounded-lg shadow-sm p-6">
//             <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
//             <div className="space-y-3">
//               <a 
//                 href="/past-questions"
//                 className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition duration-200"
//               >
//                 <div className="flex items-center space-x-3">
//                   <BookOpen className="w-5 h-5 text-gray-600" />
//                   <span className="font-medium">Past Questions</span>
//                 </div>
//                 <ArrowRight className="w-4 h-4 text-gray-400" />
//               </a>
              
//               <a 
//                 href="/profile"
//                 className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition duration-200"
//               >
//                 <div className="flex items-center space-x-3">
//                   <Target className="w-5 h-5 text-gray-600" />
//                   <span className="font-medium">My Progress</span>
//                 </div>
//                 <ArrowRight className="w-4 h-4 text-gray-400" />
//               </a>
//             </div>
//           </div>

//           {/* Tips */}
//           <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
//             <h3 className="text-lg font-semibold text-blue-900 mb-3">Case Interview Tips</h3>
//             <ul className="text-sm text-blue-800 space-y-2">
//               <li>• Structure your approach clearly</li>
//               <li>• State your assumptions</li>
//               <li>• Show your calculations</li>
//               <li>• Consider multiple perspectives</li>
//               <li>• Provide actionable recommendations</li>
//             </ul>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }