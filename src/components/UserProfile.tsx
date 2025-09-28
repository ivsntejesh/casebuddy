import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Answer } from '../types';
import { Trophy, Calendar, Target, TrendingUp, BookOpen } from 'lucide-react';

interface UserStats {
  questionsSolved: number;
  totalUpvotes: number;
  averageUpvotes: number;
  streak: number;
}

export default function UserProfile() {
  const { user } = useAuth();
  const [userStats, setUserStats] = useState<UserStats>({
    questionsSolved: 0,
    totalUpvotes: 0,
    averageUpvotes: 0,
    streak: 0
  });
  const [userAnswers, setUserAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserStats();
      fetchUserAnswers();
    }
  }, [user]);

  const fetchUserStats = async () => {
    if (!user) return;

    try {
      const answersRef = collection(db, 'answers');
      const q = query(answersRef, where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      
      let totalUpvotes = 0;
      const answers = snapshot.docs.map(doc => doc.data() as Answer);
      
      answers.forEach(answer => {
        totalUpvotes += answer.upvotes;
      });

      setUserStats({
        questionsSolved: answers.length,
        totalUpvotes,
        averageUpvotes: answers.length > 0 ? Math.round(totalUpvotes / answers.length * 10) / 10 : 0,
        streak: calculateStreak(answers)
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  const fetchUserAnswers = async () => {
    if (!user) return;

    try {
      const answersRef = collection(db, 'answers');
      const q = query(
        answersRef, 
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const answers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Answer[];
      
      setUserAnswers(answers);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching user answers:', error);
      setLoading(false);
    }
  };

  const calculateStreak = (answers: Answer[]): number => {
    // Simple streak calculation - consecutive days with submissions
    // This is a simplified version - you might want to implement more sophisticated logic
    return Math.min(answers.length, 7); // Cap at 7 for MVP
  };

  const formatDate = (date: any) => {
    if (!date) return '';
    try {
      return new Date(date.toDate()).toLocaleDateString();
    } catch (error) {
      return new Date(date).toLocaleDateString();
    }
  };

  const getInitials = (name: string | null | undefined): string => {
    if (!name) return 'U';
    return name.split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRankTitle = (questionsSolved: number, totalUpvotes: number): string => {
    if (questionsSolved >= 20 && totalUpvotes >= 50) return 'Case Master';
    if (questionsSolved >= 10 && totalUpvotes >= 20) return 'Senior Analyst';
    if (questionsSolved >= 5 && totalUpvotes >= 10) return 'Junior Consultant';
    if (questionsSolved >= 1) return 'Rising Star';
    return 'Newcomer';
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-sm p-6 mb-6 text-white">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-white font-bold text-2xl">
            {getInitials(user?.displayName)}
          </div>
          <div>
            <h1 className="text-3xl font-bold">{user?.displayName || 'Anonymous User'}</h1>
            <p className="text-blue-100 mb-2">{user?.email}</p>
            <span className="bg-white bg-opacity-20 px-3 py-1 rounded-full text-sm font-medium">
              {getRankTitle(userStats.questionsSolved, userStats.totalUpvotes)}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-sm text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
            <Target className="w-6 h-6 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">{userStats.questionsSolved}</p>
          <p className="text-sm text-gray-600">Questions Solved</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm text-center">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
            <Trophy className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">{userStats.totalUpvotes}</p>
          <p className="text-sm text-gray-600">Total Upvotes</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm text-center">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
            <TrendingUp className="w-6 h-6 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">{userStats.averageUpvotes}</p>
          <p className="text-sm text-gray-600">Avg. Upvotes</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm text-center">
          <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-3">
            <Calendar className="w-6 h-6 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">{userStats.streak}</p>
          <p className="text-sm text-gray-600">Day Streak</p>
        </div>
      </div>

      {/* Recent Answers */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center space-x-2 mb-6">
          <BookOpen className="w-5 h-5 text-gray-600" />
          <h2 className="text-xl font-bold text-gray-900">Your Recent Answers</h2>
          <span className="text-sm text-gray-500">({userAnswers.length} total)</span>
        </div>
        
        {userAnswers.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No answers yet</h3>
            <p className="text-gray-600 mb-4">Start solving cases to see your progress here!</p>
            <a 
              href="/" 
              className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-200"
            >
              Solve Today's Case
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {userAnswers.slice(0, 5).map((answer, index) => (
              <div key={answer.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition duration-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-900">
                      Answer #{userAnswers.length - index}
                    </span>
                    <span className="text-sm text-gray-500">•</span>
                    <span className="text-sm text-gray-500">
                      {formatDate(answer.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="flex items-center text-sm text-gray-600">
                      <Trophy className="w-4 h-4 mr-1" />
                      {answer.upvotes} upvotes
                    </span>
                    {answer.upvotes > 5 && (
                      <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                        Popular
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-gray-700 line-clamp-3 leading-relaxed">
                  {answer.content}
                </p>
                {answer.content.length > 150 && (
                  <button className="mt-2 text-blue-600 text-sm hover:text-blue-800">
                    Read more →
                  </button>
                )}
              </div>
            ))}
            
            {userAnswers.length > 5 && (
              <div className="text-center pt-4">
                <a 
                  href="/past-questions" 
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  View all {userAnswers.length} answers →
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Achievement Section */}
      {userStats.questionsSolved > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Achievements</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userStats.questionsSolved >= 1 && (
              <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-green-800">First Case Solved</p>
                  <p className="text-sm text-green-600">Welcome to CaseBuddy!</p>
                </div>
              </div>
            )}
            
            {userStats.questionsSolved >= 5 && (
              <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-blue-800">Problem Solver</p>
                  <p className="text-sm text-blue-600">Solved 5 cases</p>
                </div>
              </div>
            )}
            
            {userStats.totalUpvotes >= 10 && (
              <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg">
                <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-purple-800">Community Favorite</p>
                  <p className="text-sm text-purple-600">10+ total upvotes</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}