// src/lib/userService.ts ts file

import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  serverTimestamp,
  collection,
  getDocs
} from 'firebase/firestore';
import { db } from './firebase';
import { User as FirebaseUser } from 'firebase/auth';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: any;
  lastLoginAt: any;
  
  // Analytics & Engagement
  totalAnswers: number;
  totalUpvotes: number;
  totalFeedbacks: number;
  lastActiveDate: string; // YYYY-MM-DD
  
  // Communication Preferences
  emailNotifications: boolean;
  weeklyDigest: boolean;
  marketingEmails: boolean;
  
  // Metadata
  provider: string; // 'google', 'email', etc.
  isAdmin: boolean;
}

export class UserService {
  
  /**
   * Create or update user document in Firestore
   * Called on every login to keep data fresh
   */
  async createOrUpdateUser(firebaseUser: FirebaseUser): Promise<UserProfile> {
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userRef);
      
      const today = new Date().toISOString().split('T')[0];
      
      if (userDoc.exists()) {
        // User exists - update last login and name/photo if changed
        const existingData = userDoc.data() as UserProfile;
        
        const updates: any = {
          lastLoginAt: serverTimestamp(),
          lastActiveDate: today,
        };
        
        // Update name/photo if changed
        if (firebaseUser.displayName && firebaseUser.displayName !== existingData.displayName) {
          updates.displayName = firebaseUser.displayName;
        }
        
        if (firebaseUser.photoURL && firebaseUser.photoURL !== existingData.photoURL) {
          updates.photoURL = firebaseUser.photoURL;
        }
        
        await updateDoc(userRef, updates);
        
        console.log('✅ Updated user:', firebaseUser.email);
        
        return {
          ...existingData,
          ...updates,
          lastLoginAt: new Date(),
        };
        
      } else {
        // New user - create full profile
        const newUserData: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || 'Anonymous',
          photoURL: firebaseUser.photoURL || undefined,
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
          
          // Initialize stats
          totalAnswers: 0,
          totalUpvotes: 0,
          totalFeedbacks: 0,
          lastActiveDate: today,
          
          // Default communication preferences
          emailNotifications: true,
          weeklyDigest: true,
          marketingEmails: false,
          
          // Metadata
          provider: firebaseUser.providerData[0]?.providerId || 'unknown',
          isAdmin: false, // Set manually for admins
        };
        
        await setDoc(userRef, newUserData);
        
        console.log('✅ Created new user:', firebaseUser.email);
        
        return {
          ...newUserData,
          createdAt: new Date(),
          lastLoginAt: new Date(),
        };
      }
      
    } catch (error) {
      console.error('❌ Error creating/updating user:', error);
      throw error;
    }
  }
  
  /**
   * Get user profile by UID
   */
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const userRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        return userDoc.data() as UserProfile;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }
  
  /**
   * Update user stats (called when user submits answer, gets upvotes, etc.)
   */
  async updateUserStats(
    uid: string,
    updates: {
      totalAnswers?: number;
      totalUpvotes?: number;
      totalFeedbacks?: number;
    }
  ): Promise<void> {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        ...updates,
        lastActiveDate: new Date().toISOString().split('T')[0],
      });
      
      console.log('✅ Updated user stats for', uid);
    } catch (error) {
      console.error('Error updating user stats:', error);
    }
  }
  
  /**
   * Update user preferences
   */
  async updateUserPreferences(
    uid: string,
    preferences: {
      emailNotifications?: boolean;
      weeklyDigest?: boolean;
      marketingEmails?: boolean;
    }
  ): Promise<void> {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, preferences);
      
      console.log('✅ Updated user preferences');
    } catch (error) {
      console.error('Error updating preferences:', error);
      throw error;
    }
  }
  
  /**
   * Get all users (admin only)
   * Returns email list for communications
   */
  async getAllUsers(): Promise<{ uid: string; email: string; displayName: string }[]> {
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      
      return snapshot.docs.map(doc => {
        const data = doc.data() as UserProfile;
        return {
          uid: data.uid,
          email: data.email,
          displayName: data.displayName,
        };
      });
    } catch (error) {
      console.error('Error fetching all users:', error);
      return [];
    }
  }
  
  /**
   * Get users who want to receive specific types of emails
   */
  async getUsersByEmailPreference(
    preferenceType: 'emailNotifications' | 'weeklyDigest' | 'marketingEmails'
  ): Promise<string[]> {
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      
      return snapshot.docs
        .map(doc => doc.data() as UserProfile)
        .filter(user => user[preferenceType] === true)
        .map(user => user.email);
      
    } catch (error) {
      console.error('Error fetching users by preference:', error);
      return [];
    }
  }
  
  /**
   * Get active users (logged in within last N days)
   */
  async getActiveUsers(daysAgo: number = 30): Promise<UserProfile[]> {
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
      const cutoffString = cutoffDate.toISOString().split('T')[0];
      
      return snapshot.docs
        .map(doc => doc.data() as UserProfile)
        .filter(user => user.lastActiveDate >= cutoffString);
        
    } catch (error) {
      console.error('Error fetching active users:', error);
      return [];
    }
  }
}

export const userService = new UserService();