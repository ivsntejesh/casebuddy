import { ReactNode, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, db, googleProvider } from '../lib/firebase';
import { User, LogOut, Calendar, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc,
  setDoc, 
  updateDoc, 
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, loading } = useAuth();
  const [signInError, setSignInError] = useState<string>('');
  const [isSigningIn, setIsSigningIn] = useState(false);

  const signInWithGoogle = async () => {
    setIsSigningIn(true);
    setSignInError('');
    
    try {
      console.log('Attempting Google sign-in...');
      console.log('Auth object:', auth);
      console.log('Google provider:', googleProvider);
      
      const result = await signInWithPopup(auth, googleProvider);
      console.log('Sign-in successful:', result.user.displayName);
      console.log('User:', result.user);

      // NEW: Create/update user document in Firestore
      const userRef = doc(db, 'users', result.user.uid);
      await setDoc(userRef, {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
        lastLogin: serverTimestamp(),
        createdAt: serverTimestamp(), // Will only be set on first creation
      }, { merge: true }); // merge: true prevents overwriting createdAt
      
      console.log('✅ User document created/updated in Firestore');

    } catch (error: any) {
      console.error('Detailed sign-in error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      let errorMessage = 'Sign-in failed. ';
      
      switch (error.code) {
        case 'auth/popup-blocked':
          errorMessage += 'Please allow popups for this site and try again.';
          break;
        case 'auth/popup-closed-by-user':
          errorMessage += 'Sign-in was cancelled.';
          break;
        case 'auth/unauthorized-domain':
          errorMessage += 'This domain is not authorized. Please contact support.';
          break;
        case 'auth/operation-not-allowed':
          errorMessage += 'Google sign-in is not enabled. Please contact support.';
          break;
        case 'auth/invalid-api-key':
          errorMessage += 'Invalid API configuration. Please contact support.';
          break;
        case 'auth/network-request-failed':
          errorMessage += 'Network error. Please check your connection and try again.';
          break;
        default:
          errorMessage += `Please try again. (Error: ${error.code})`;
      }
      
      setSignInError(errorMessage);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Debug: Log Firebase config (without exposing sensitive data)
  console.log('Firebase config check:', {
    hasApiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    hasAuthDomain: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading CaseBuddy...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-xl">CB</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">CaseBuddy</h1>
            <p className="text-gray-600 mb-8">Daily case practice for MBA students</p>
            
            {signInError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center space-x-2 text-red-800">
                  <AlertCircle size={16} />
                  <p className="text-sm">{signInError}</p>
                </div>
              </div>
            )}
            
            <button
              onClick={signInWithGoogle}
              disabled={isSigningIn}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center space-x-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {isSigningIn ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>
            
            <p className="mt-4 text-xs text-gray-500">
              By signing in, you agree to practice case studies and help peers learn
            </p>
            
            {/* Debug info in development */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-4 p-3 bg-gray-100 rounded text-xs text-left">
                <p className="font-semibold mb-1">Debug Info:</p>
                <p>API Key: {process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✓' : '✗'}</p>
                <p>Auth Domain: {process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'Missing'}</p>
                <p>Project ID: {process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'Missing'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-xl font-bold text-blue-600 hover:text-blue-700 transition duration-200">
                CaseBuddy
              </Link>
              <div className="hidden md:flex items-center space-x-1 text-sm text-gray-600">
                <span>Welcome back,</span>
                <span className="font-medium">{user.displayName?.split(' ')[0]}</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                href="/profile" 
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition duration-200"
                title="Profile"
              >
                <User size={20} />
              </Link>
              <Link 
                href="/past-questions" 
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition duration-200"
                title="Past Questions"
              >
                <Calendar size={20} />
              </Link>
              <button
                onClick={handleSignOut}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition duration-200"
                title="Sign Out"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}