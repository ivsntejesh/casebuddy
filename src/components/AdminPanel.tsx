// src/components/AdminPanel.tsx - Complete code with Cloud Functions support

import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { vectorDBService } from '../lib/vectordb';
import AdminVectorDB from './AdminVectorDB';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { Question } from '../types';
import { 
  Plus, 
  Save, 
  Eye, 
  EyeOff, 
  Calendar,
  BookOpen,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Loader
} from 'lucide-react';

export default function AdminPanel() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  // Form state
  const [newQuestion, setNewQuestion] = useState({
    title: '',
    description: '',
    type: 'consulting' as 'consulting' | 'product',
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    isActive: false
  });

  // Check if user is admin
  const isAdmin = user?.email === 'ithatejesh@gmail.com' || 
                  user?.email === 'ivsntejesh@gmail.com' ||
                  process.env.NODE_ENV === 'development';

  useEffect(() => {
    if (isAdmin) {
      fetchAllQuestions();
    }
  }, [isAdmin]);

  const fetchAllQuestions = async () => {
    try {
      const questionsRef = collection(db, 'questions');
      const q = query(questionsRef, orderBy('datePosted', 'desc'));
      const snapshot = await getDocs(q);
      
      const questionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Question[];
      
      setQuestions(questionsData);
    } catch (error) {
      console.error('Error fetching questions:', error);
      setMessage({ type: 'error', text: 'Failed to load questions' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!newQuestion.title.trim() || !newQuestion.description.trim()) {
    setMessage({ type: 'error', text: 'Please fill in all required fields' });
    return;
  }

  setSaving(true);
  setMessage(null);

  try {
    // If setting this question as active, deactivate all others
    if (newQuestion.isActive) {
      const activeQuestions = questions.filter(q => q.isActive);
      for (const question of activeQuestions) {
        await updateDoc(doc(db, 'questions', question.id), { isActive: false });
      }
    }

    // Add question to Firestore
    const docRef = await addDoc(collection(db, 'questions'), {
      ...newQuestion,
      datePosted: serverTimestamp(),
      createdBy: user?.uid
    });

    console.log('✅ Question created with ID:', docRef.id);

    // 🆕 AUTO-INDEX: Add to vector database
    try {
      console.log('🔄 Auto-indexing case to vector database...');
      
      await vectorDBService.indexCase(
        docRef.id,
        newQuestion.title,
        newQuestion.description,
        newQuestion.type,
        newQuestion.difficulty
      );
      
      console.log('✅ Case indexed successfully!');
      setMessage({ 
        type: 'success', 
        text: '✅ Question added and indexed for similar case recommendations!' 
      });
    } catch (indexError) {
      console.error('⚠️ Failed to index case:', indexError);
      setMessage({ 
        type: 'success', 
        text: '✅ Question added! (Note: Vector indexing failed - similar cases may not show immediately)' 
      });
    }

    setNewQuestion({
      title: '',
      description: '',
      type: 'consulting',
      difficulty: 'medium',
      isActive: false
    });

    // Refresh questions list
    fetchAllQuestions();
  } catch (error) {
    console.error('Error adding question:', error);
    setMessage({ type: 'error', text: 'Failed to add question. Please try again.' });
  } finally {
    setSaving(false);
  }
};

  const toggleQuestionActive = async (questionId: string, currentActiveState: boolean) => {
    try {
      if (!currentActiveState) {
        // If activating this question, deactivate all others
        const activeQuestions = questions.filter(q => q.isActive && q.id !== questionId);
        for (const question of activeQuestions) {
          await updateDoc(doc(db, 'questions', question.id), { isActive: false });
        }
      }

      await updateDoc(doc(db, 'questions', questionId), { 
        isActive: !currentActiveState 
      });

      // Update local state
      setQuestions(questions.map(q => 
        q.id === questionId 
          ? { ...q, isActive: !currentActiveState }
          : { ...q, isActive: currentActiveState ? q.isActive : false }
      ));

      setMessage({ 
        type: 'success', 
        text: `Question ${!currentActiveState ? 'activated' : 'deactivated'} successfully!` 
      });
    } catch (error) {
      console.error('Error updating question:', error);
      setMessage({ type: 'error', text: 'Failed to update question status' });
    }
  };

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

  // Hide message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-900 mb-2">Access Denied</h2>
          <p className="text-red-700">You don't have permission to access the admin panel.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading admin panel...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Panel</h1>
        <p className="text-gray-600">Manage case study questions and content</p>
      </div>

      {/* Vector DB Management */}
      <div className="mb-8">
        <AdminVectorDB />
      </div>

      {/* Status Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center space-x-2 ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Add New Question Form */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center space-x-2 mb-6">
            <Plus className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold">Add New Question</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Question Title *
              </label>
              <input
                type="text"
                value={newQuestion.title}
                onChange={(e) => setNewQuestion({ ...newQuestion, title: e.target.value })}
                placeholder="e.g., Market Entry Strategy for Electric Vehicles"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Question Description *
              </label>
              <textarea
                value={newQuestion.description}
                onChange={(e) => setNewQuestion({ ...newQuestion, description: e.target.value })}
                placeholder="Provide the full case study description, including context, data, and specific questions to address..."
                className="w-full h-48 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type
                </label>
                <select
                  value={newQuestion.type}
                  onChange={(e) => setNewQuestion({ ...newQuestion, type: e.target.value as 'consulting' | 'product' })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="consulting">Consulting</option>
                  <option value="product">Product</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Difficulty
                </label>
                <select
                  value={newQuestion.difficulty}
                  onChange={(e) => setNewQuestion({ ...newQuestion, difficulty: e.target.value as 'easy' | 'medium' | 'hard' })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>

            <div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newQuestion.isActive}
                  onChange={(e) => setNewQuestion({ ...newQuestion, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Set as today's active question
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Only one question can be active at a time. This will deactivate other active questions.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center space-x-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition duration-200"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Adding Question...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Add Question</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Existing Questions */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center space-x-2 mb-6">
            <BookOpen className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-semibold">All Questions ({questions.length})</h2>
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {questions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No questions added yet</p>
            ) : (
              questions.map((question) => (
                <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-medium text-gray-900 line-clamp-2">
                      {question.title}
                    </h3>
                    <button
                      onClick={() => toggleQuestionActive(question.id, question.isActive)}
                      className={`ml-2 p-1 rounded-full transition duration-200 ${
                        question.isActive
                          ? 'bg-green-100 text-green-600 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                      title={question.isActive ? 'Deactivate question' : 'Activate question'}
                    >
                      {question.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                  
                  <p className="text-sm text-gray-600 line-clamp-3 mb-3">
                    {question.description}
                  </p>
                  
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(question.type)}`}>
                        {question.type}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(question.difficulty)}`}>
                        {question.difficulty}
                      </span>
                      {question.isActive && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                      <Calendar size={12} />
                      <span>{formatDate(question.datePosted)}</span>
                    </div>
                  </div>

                  {/* NEW: Vector Indexing Status
                  <div className="flex items-center space-x-2 pt-2 border-t border-gray-100">
                    {question.vectorIndexed ? (
                      <span className="flex items-center space-x-1 text-xs text-green-600">
                        <CheckCircle size={12} />
                        <span>Indexed for Similar Cases</span>
                      </span>
                    ) : question.vectorIndexError ? (
                      <button
                        onClick={() => reindexQuestion(question.id)}
                        className="flex items-center space-x-1 text-xs text-red-600 hover:text-red-700 hover:underline"
                        title={question.vectorIndexError}
                      >
                        <AlertCircle size={12} />
                        <span>Index Failed - Click to Retry</span>
                      </button>
                    ) : (
                      <span className="flex items-center space-x-1 text-xs text-yellow-600">
                        <Loader size={12} className="animate-spin" />
                        <span>Auto-indexing in progress...</span>
                      </span>
                    )}
                  </div> */}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}