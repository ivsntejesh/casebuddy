// src/components/AdminVectorDB.tsx - Client-Side Version (Option 1)

import { useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { vectorDBService } from '../lib/vectordb';
import { Question } from '../types';
import { Database, RefreshCw, CheckCircle, AlertCircle, Loader } from 'lucide-react';

export default function AdminVectorDB() {
  const [indexing, setIndexing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // Batch index all cases (Client-Side)
  const indexAllCases = async () => {
    if (!confirm('This will index ALL questions. This may take a few minutes. Continue?')) {
      return;
    }

    setIndexing(true);
    setStatus('idle');
    setMessage('Starting indexing...');

    try {
      // Fetch all questions from Firestore
      const questionsRef = collection(db, 'questions');
      const snapshot = await getDocs(questionsRef);
      
      const questions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Question));

      setProgress({ current: 0, total: questions.length });

      let successCount = 0;
      let failCount = 0;

      // Index each question
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        
        try {
          await vectorDBService.indexCase(
            question.id,
            question.title,
            question.description,
            question.type,
            question.difficulty
          );

          successCount++;
          setProgress({ current: i + 1, total: questions.length });
          
          // Rate limiting - wait 300ms between requests
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          console.error(`Failed to index ${question.id}:`, error);
          failCount++;
        }
      }

      setStatus('success');
      setMessage(`✅ Indexing complete! ${successCount} successful, ${failCount} failed out of ${questions.length} total.`);
    } catch (error) {
      console.error('Error indexing cases:', error);
      setStatus('error');
      setMessage('❌ Indexing failed. Check console for details.');
    } finally {
      setIndexing(false);
    }
  };

  // Health check for vector DB
  const testHealthCheck = async () => {
    setMessage('Checking vector database connection...');
    setStatus('idle');
    
    try {
      const isHealthy = await vectorDBService.healthCheck();
      
      if (isHealthy) {
        setStatus('success');
        setMessage('✅ Vector DB is connected and healthy!');
      } else {
        setStatus('error');
        setMessage('❌ Failed to connect to Vector DB. Check your API keys.');
      }
    } catch (error) {
      setStatus('error');
      setMessage('❌ Connection test failed');
    }
  };

  // Get indexing statistics
  const getIndexingStats = async () => {
    setMessage('Fetching statistics...');
    setStatus('idle');
    
    try {
      const questionsSnapshot = await getDocs(collection(db, 'questions'));
      const total = questionsSnapshot.size;

      setStatus('success');
      setMessage(`📊 Total questions in database: ${total}`);
    } catch (error) {
      console.error('Stats error:', error);
      setStatus('error');
      setMessage('❌ Failed to fetch stats');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Database className="w-6 h-6 text-purple-600" />
        <h3 className="text-xl font-bold text-gray-900">Vector Database Management</h3>
        <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full font-medium">
          Client-Side
        </span>
      </div>

      <div className="space-y-4">
        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">ℹ️ How It Works</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Converts case titles & descriptions into vector embeddings</li>
            <li>• Stores vectors in Pinecone for fast similarity search</li>
            <li>• Enables "Similar Cases" feature for all users</li>
            <li>• New questions are indexed automatically when created</li>
          </ul>
        </div>

        {/* Health Check */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Connection Status</h4>
          <button
            onClick={testHealthCheck}
            disabled={indexing}
            className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Test Connection</span>
          </button>
        </div>

        {/* Statistics */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Database Statistics</h4>
          <button
            onClick={getIndexingStats}
            disabled={indexing}
            className="flex items-center space-x-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-400 text-gray-700 font-medium py-2 px-4 rounded-lg transition duration-200"
          >
            <Database className="w-4 h-4" />
            <span>Get Stats</span>
          </button>
        </div>

        {/* Batch Indexing */}
        <div className="bg-purple-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Batch Index All Cases</h4>
          <p className="text-sm text-gray-600 mb-3">
            Index all questions in the database. Takes ~1 minute per 10 cases.
            Use this if you have unindexed questions or want to re-index everything.
          </p>
          
          <button
            onClick={indexAllCases}
            disabled={indexing}
            className="flex items-center space-x-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
          >
            {indexing ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                <span>Indexing... {progress.current}/{progress.total}</span>
              </>
            ) : (
              <>
                <Database className="w-4 h-4" />
                <span>Start Batch Indexing</span>
              </>
            )}
          </button>

          {/* Progress Bar */}
          {indexing && progress.total > 0 && (
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${(progress.current / progress.total) * 100}%`
                  }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Indexing case {progress.current} of {progress.total}...
              </p>
            </div>
          )}
        </div>

        {/* Status Message */}
        {message && (
          <div className={`rounded-lg p-4 ${
            status === 'success' ? 'bg-green-50 border border-green-200' :
            status === 'error' ? 'bg-red-50 border border-red-200' :
            'bg-blue-50 border border-blue-200'
          }`}>
            <div className="flex items-start space-x-2">
              {status === 'success' && <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />}
              {status === 'error' && <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />}
              {status === 'idle' && <Loader className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />}
              <p className={`text-sm ${
                status === 'success' ? 'text-green-800' :
                status === 'error' ? 'text-red-800' :
                'text-blue-800'
              }`}>
                {message}
              </p>
            </div>
          </div>
        )}

        {/* Usage Notes */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-semibold text-yellow-900 mb-2">📝 Usage Notes</h4>
          <ul className="text-sm text-yellow-800 space-y-1">
            <li>• New questions are automatically indexed when created</li>
            <li>• Use "Batch Index All" if you have existing unindexed questions</li>
            <li>• Batch indexing may take several minutes for many questions</li>
            <li>• Don't close the browser while batch indexing is in progress</li>
          </ul>
        </div>
      </div>
    </div>
  );
}