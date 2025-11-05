// src/components/SimilarCases.tsx - With caching
import { useState, useEffect } from 'react';
import { vectorDBService, SimilarCase } from '../lib/vectordb';
import { 
  Sparkles, 
  TrendingUp, 
  Users, 
  ArrowRight,
  Loader,
  AlertCircle 
} from 'lucide-react';

interface SimilarCasesProps {
  questionId: string;
  questionTitle: string;
  questionDescription: string;
  questionType: 'consulting' | 'product';
  questionDifficulty: 'easy' | 'medium' | 'hard';
}

// Cache for similar cases (in-memory)
const similarCasesCache = new Map<string, {
  data: SimilarCase[];
  timestamp: number;
}>();

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export default function SimilarCases({
  questionId,
  questionTitle,
  questionDescription,
  questionType,
  questionDifficulty,
}: SimilarCasesProps) {
  const [similarCases, setSimilarCases] = useState<SimilarCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSimilarCases();
  }, [questionId]);

  const fetchSimilarCases = async () => {
    setLoading(true);
    setError(null);

    try {
      // Check cache first
      const cached = similarCasesCache.get(questionId);
      const now = Date.now();

      if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        console.log('✅ Using cached similar cases for:', questionId);
        setSimilarCases(cached.data);
        setLoading(false);
        return;
      }

      console.log('🔍 Fetching fresh similar cases for:', questionId);
      
      // Fetch from API
      const similar = await vectorDBService.findSimilarCases(
        questionId,
        questionTitle,
        questionDescription,
        5
      );

      // Update cache
      similarCasesCache.set(questionId, {
        data: similar,
        timestamp: now,
      });

      // Also store in localStorage for persistence across sessions
      try {
        const localStorageKey = `similar_cases_${questionId}`;
        localStorage.setItem(localStorageKey, JSON.stringify({
          data: similar,
          timestamp: now,
        }));
      } catch (e) {
        console.warn('Failed to cache to localStorage:', e);
      }

      setSimilarCases(similar);
    } catch (err) {
      console.error('Error fetching similar cases:', err);
      
      // Try loading from localStorage as fallback
      try {
        const localStorageKey = `similar_cases_${questionId}`;
        const cached = localStorage.getItem(localStorageKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const now = Date.now();
          if ((now - timestamp) < CACHE_DURATION) {
            console.log('✅ Using localStorage cache as fallback');
            setSimilarCases(data);
            return;
          }
        }
      } catch (e) {
        console.warn('Failed to load from localStorage:', e);
      }
      
      setError('Failed to load similar cases. Please try again later.');
    } finally {
      setLoading(false);
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

  const getSimilarityLabel = (score: number) => {
    if (score > 0.9) return { label: 'Very Similar', color: 'text-green-600' };
    if (score > 0.8) return { label: 'Similar', color: 'text-blue-600' };
    if (score > 0.7) return { label: 'Somewhat Similar', color: 'text-yellow-600' };
    return { label: 'Related', color: 'text-gray-600' };
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Sparkles className="w-5 h-5 text-purple-600 animate-pulse" />
          <h3 className="text-lg font-semibold text-gray-900">Finding Similar Cases...</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader className="w-8 h-8 text-purple-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
        <div className="flex items-center space-x-2 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (similarCases.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">Similar Cases</h3>
        </div>
        <p className="text-gray-600 text-sm">
          No similar cases found yet. This feature learns as more cases are added!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg shadow-sm border border-purple-200 p-6">
      {/* Header */}
      <div className="flex items-center space-x-2 mb-4">
        <Sparkles className="w-5 h-5 text-purple-600" />
        <h3 className="text-lg font-semibold text-gray-900">Similar Cases</h3>
        <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full font-medium">
          AI Powered
        </span>
      </div>

      <p className="text-sm text-gray-700 mb-4">
        Students who practiced this case also found these helpful:
      </p>

      {/* Similar Cases List */}
      <div className="space-y-3">
        {similarCases.map((similarCase, index) => {
          const similarityInfo = getSimilarityLabel(similarCase.similarity);
          
          return (
            <a
              key={similarCase.questionId}
              href={`/past-questions#${similarCase.questionId}`}
              className="block bg-white rounded-lg p-4 border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all duration-200"
            >
              {/* Title and Badges */}
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-gray-900 flex-1 line-clamp-1">
                  {index + 1}. {similarCase.title}
                </h4>
                <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
              </div>

              {/* Tags */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(similarCase.type)}`}>
                  {similarCase.type.charAt(0).toUpperCase() + similarCase.type.slice(1)}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(similarCase.difficulty)}`}>
                  {similarCase.difficulty.charAt(0).toUpperCase() + similarCase.difficulty.slice(1)}
                </span>
                <span className={`text-xs font-medium ${similarityInfo.color}`}>
                  {similarityInfo.label}
                </span>
              </div>

              {/* Description Preview */}
              <p className="text-xs text-gray-600 line-clamp-2 mb-3">
                {similarCase.description}
              </p>

              {/* Stats */}
              <div className="flex items-center space-x-4 text-xs text-gray-500">
                {similarCase.totalAnswers && similarCase.totalAnswers > 0 && (
                  <div className="flex items-center space-x-1">
                    <Users className="w-3 h-3" />
                    <span>{similarCase.totalAnswers} solutions</span>
                  </div>
                )}
                {similarCase.avgUpvotes && similarCase.avgUpvotes > 0 && (
                  <div className="flex items-center space-x-1">
                    <TrendingUp className="w-3 h-3" />
                    <span>{similarCase.avgUpvotes} avg upvotes</span>
                  </div>
                )}
                <div className="flex items-center space-x-1">
                  <Sparkles className="w-3 h-3 text-purple-500" />
                  <span>{Math.round(similarCase.similarity * 100)}% match</span>
                </div>
              </div>
            </a>
          );
        })}
      </div>

      {/* Footer Note */}
      <div className="mt-4 pt-4 border-t border-purple-200">
        <p className="text-xs text-gray-600 flex items-center">
          <Sparkles className="w-3 h-3 text-purple-500 mr-1" />
          Powered by AI semantic search • Results cached for faster loading
        </p>
      </div>
    </div>
  );
}

// // src/components/SimilarCases.tsx - OPTIMIZED VERSION
// import { useState, useEffect } from 'react';
// import { vectorDBService, SimilarCase } from '../lib/vectordb';
// import { 
//   Sparkles, 
//   TrendingUp, 
//   Users, 
//   ArrowRight,
//   Loader,
//   AlertCircle 
// } from 'lucide-react';

// interface SimilarCasesProps {
//   questionId: string;
//   questionTitle: string;
//   questionDescription: string;
//   questionType: 'consulting' | 'product';
//   questionDifficulty: 'easy' | 'medium' | 'hard';
// }

// // In-memory cache (survives during session)
// const similarCasesCache = new Map<string, SimilarCase[]>();

// export default function SimilarCases({
//   questionId,
//   questionTitle,
//   questionDescription,
//   questionType,
//   questionDifficulty,
// }: SimilarCasesProps) {
//   const [similarCases, setSimilarCases] = useState<SimilarCase[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     fetchSimilarCases();
//   }, [questionId]);

//   const fetchSimilarCases = async () => {
//     // Check cache first
//     const cached = similarCasesCache.get(questionId);
//     if (cached) {
//       console.log('✅ Using cached similar cases for', questionId);
//       setSimilarCases(cached);
//       setLoading(false);
//       return;
//     }

//     setLoading(true);
//     setError(null);

//     try {
//       const similar = await vectorDBService.findSimilarCases(
//         questionId,
//         questionTitle,
//         questionDescription,
//         5
//       );

//       // Cache the results
//       similarCasesCache.set(questionId, similar);
//       setSimilarCases(similar);
//     } catch (err: any) {
//       console.error('Error fetching similar cases:', err);
      
//       // Better error messages
//       if (err.message?.includes('embedding')) {
//         setError('Failed to analyze case similarity. Please try again.');
//       } else if (err.message?.includes('index')) {
//         setError('Vector database not initialized. Please contact admin.');
//       } else {
//         setError('Failed to load similar cases. Please try again later.');
//       }
//     } finally {
//       setLoading(false);
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

//   const getSimilarityLabel = (score: number) => {
//     if (score > 0.9) return { label: 'Very Similar', color: 'text-green-600' };
//     if (score > 0.8) return { label: 'Similar', color: 'text-blue-600' };
//     if (score > 0.7) return { label: 'Somewhat Similar', color: 'text-yellow-600' };
//     return { label: 'Related', color: 'text-gray-600' };
//   };

//   if (loading) {
//     return (
//       <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
//         <div className="flex items-center space-x-2 mb-4">
//           <Sparkles className="w-5 h-5 text-purple-600 animate-pulse" />
//           <h3 className="text-lg font-semibold text-gray-900">Finding Similar Cases...</h3>
//         </div>
//         <div className="flex items-center justify-center py-8">
//           <Loader className="w-8 h-8 text-purple-500 animate-spin" />
//         </div>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
//         <div className="flex items-start space-x-2 text-red-600">
//           <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
//           <div>
//             <p className="text-sm font-medium">{error}</p>
//             <button
//               onClick={fetchSimilarCases}
//               className="text-xs text-red-700 hover:text-red-800 underline mt-1"
//             >
//               Try again
//             </button>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   if (similarCases.length === 0) {
//     return null; // Don't show anything if no similar cases
//   }

//   return (
//     <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg shadow-sm border border-purple-200 p-6">
//       {/* Header */}
//       <div className="flex items-center space-x-2 mb-4">
//         <Sparkles className="w-5 h-5 text-purple-600" />
//         <h3 className="text-lg font-semibold text-gray-900">Similar Cases</h3>
//         <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full font-medium">
//           AI Powered
//         </span>
//       </div>

//       <p className="text-sm text-gray-700 mb-4">
//         Students who practiced this case also found these helpful:
//       </p>

//       {/* Similar Cases List */}
//       <div className="space-y-3">
//         {similarCases.map((similarCase, index) => {
//           const similarityInfo = getSimilarityLabel(similarCase.similarity);
          
//           return (
//             <a
//               key={similarCase.questionId}
//               href={`/past-questions#${similarCase.questionId}`}
//               className="block bg-white rounded-lg p-4 border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all duration-200"
//             >
//               {/* Title and Badges */}
//               <div className="flex items-start justify-between mb-2">
//                 <h4 className="font-semibold text-gray-900 flex-1 line-clamp-1">
//                   {index + 1}. {similarCase.title}
//                 </h4>
//                 <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
//               </div>

//               {/* Tags */}
//               <div className="flex flex-wrap items-center gap-2 mb-2">
//                 <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(similarCase.type)}`}>
//                   {similarCase.type.charAt(0).toUpperCase() + similarCase.type.slice(1)}
//                 </span>
//                 <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(similarCase.difficulty)}`}>
//                   {similarCase.difficulty.charAt(0).toUpperCase() + similarCase.difficulty.slice(1)}
//                 </span>
//                 <span className={`text-xs font-medium ${similarityInfo.color}`}>
//                   {similarityInfo.label}
//                 </span>
//               </div>

//               {/* Description Preview */}
//               <p className="text-xs text-gray-600 line-clamp-2 mb-3">
//                 {similarCase.description}
//               </p>

//               {/* Stats */}
//               <div className="flex items-center space-x-4 text-xs text-gray-500">
//                 {similarCase.totalAnswers && similarCase.totalAnswers > 0 && (
//                   <div className="flex items-center space-x-1">
//                     <Users className="w-3 h-3" />
//                     <span>{similarCase.totalAnswers} solutions</span>
//                   </div>
//                 )}
//                 {similarCase.avgUpvotes && similarCase.avgUpvotes > 0 && (
//                   <div className="flex items-center space-x-1">
//                     <TrendingUp className="w-3 h-3" />
//                     <span>{similarCase.avgUpvotes} avg upvotes</span>
//                   </div>
//                 )}
//                 <div className="flex items-center space-x-1">
//                   <Sparkles className="w-3 h-3 text-purple-500" />
//                   <span>{Math.round(similarCase.similarity * 100)}% match</span>
//                 </div>
//               </div>
//             </a>
//           );
//         })}
//       </div>

//       {/* Footer Note */}
//       <div className="mt-4 pt-4 border-t border-purple-200">
//         <p className="text-xs text-gray-600 flex items-center">
//           <Sparkles className="w-3 h-3 text-purple-500 mr-1" />
//           Powered by AI semantic search • Results based on case content similarity
//         </p>
//       </div>
//     </div>
//   );
// }