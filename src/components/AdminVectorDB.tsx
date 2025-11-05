// src/components/AdminVectorDB.tsx
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

  const indexAllCases = async () => {
    setIndexing(true);
    setStatus('idle');
    setMessage('');

    try {
      // Fetch all questions from Firestore
      const questionsRef = collection(db, 'questions');
      const snapshot = await getDocs(questionsRef);
      
      // Map to Question type
      const questions: Question[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Question));

      setProgress({ current: 0, total: questions.length });

      console.log(`📚 Starting to index ${questions.length} cases...`);

      // Index each question
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        
        console.log(`🔄 Indexing ${i + 1}/${questions.length}: ${question.title}`);
        
        await vectorDBService.indexCase(
          question.id,
          question.title,
          question.description,
          question.type,
          question.difficulty
        );

        setProgress({ current: i + 1, total: questions.length });
        
        // Rate limiting - prevent API rate limits
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      setStatus('success');
      setMessage(`✅ Successfully indexed ${questions.length} cases!`);
      console.log('✅ Indexing complete!');
    } catch (error) {
      console.error('❌ Error indexing cases:', error);
      setStatus('error');
      setMessage(`Failed to index cases: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIndexing(false);
    }
  };

  const testHealthCheck = async () => {
    setMessage('Checking Pinecone connection...');
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
      setMessage(`❌ Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Database className="w-6 h-6 text-purple-600" />
        <h3 className="text-xl font-bold text-gray-900">Vector Database Management</h3>
      </div>

      <div className="space-y-4">
        {/* Health Check */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Connection Status</h4>
          <p className="text-sm text-gray-600 mb-3">
            Test the connection to your Pinecone vector database.
          </p>
          <button
            onClick={testHealthCheck}
            disabled={indexing}
            className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Test Connection</span>
          </button>
        </div>

        {/* Indexing */}
        <div className="bg-purple-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Index All Cases</h4>
          <p className="text-sm text-gray-600 mb-3">
            This will create vector embeddings for all cases in Firestore and store them in Pinecone.
            Takes approximately 1 minute per 10 cases.
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
                <span>Start Indexing</span>
              </>
            )}
          </button>

          {/* Progress Bar */}
          {indexing && (
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`
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
              {status === 'success' && <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />}
              {status === 'error' && <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />}
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

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">ℹ️ How It Works</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Converts case titles & descriptions into vector embeddings</li>
            <li>• Stores vectors in Pinecone for fast similarity search</li>
            <li>• Enables "Similar Cases" feature for all users</li>
            <li>• Re-run indexing when adding new cases</li>
            <li>• Uses OpenAI text-embedding-3-small model (1536 dimensions)</li>
          </ul>
        </div>

        {/* Cost Info */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-semibold text-yellow-900 mb-2">💰 Cost Estimate</h4>
          <ul className="text-sm text-yellow-800 space-y-1">
            <li>• OpenAI embeddings: ~$0.01 per 10 cases</li>
            <li>• Pinecone: Free tier (up to 100K vectors)</li>
            <li>• Total: Essentially free for demo/MVP</li>
          </ul>
        </div>
      </div>
    </div>
  );
}