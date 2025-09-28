import HomePage from '../components/HomePage';

export default function Home() {
  return <HomePage />;
}

// import { useAuth } from '../hooks/useAuth';

// export default function Home() {
//   const { user } = useAuth();

//   return (
//     <div className="max-w-4xl mx-auto">
//       <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
//         <h1 className="text-2xl font-bold text-gray-900 mb-4">
//           Welcome to CaseBuddy! 👋
//         </h1>
//         <p className="text-gray-700 mb-4">
//           Hello {user?.displayName}! Your daily case practice platform is ready.
//         </p>
//         <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
//           <h2 className="font-semibold text-blue-900 mb-2">Next Steps:</h2>
//           <ol className="list-decimal list-inside text-blue-800 space-y-1">
//             <li>Add sample questions to Firebase</li>
//             <li>Test the complete functionality</li>
//             <li>Deploy to production</li>
//           </ol>
//         </div>
//       </div>
//     </div>
//   );
// }