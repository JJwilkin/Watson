import type { Route } from "./+types/home";
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import PlaidLink from "../components/PlaidLink";
import TransactionGraph from "../components/TransactionGraph";

interface PlaidAccountData {
  id: string;
  institutionId: string;
  accountName: string;
  // Add other fields you need
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Home - React Router App" },
    { name: "description", content: "Welcome to the home page!" },
  ];
}

export default function Home() {
  const navigate = useNavigate();
  // const [userEmail, setUserEmail] = useState("");
  const location = useLocation();
  const { userEmail, userId } = location.state || {};
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [plaidAccount, setPlaidAccount] = useState<PlaidAccountData | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = sessionStorage.getItem('token');
      
      if (!token) {
        navigate("/login");
        return;
      }
      
      // Get user email from localStorage
      // const email = localStorage.getItem("userEmail");
      // if (email) {
      //   setUserEmail(email);
      // }
      
      // Example of how to make an authenticated request
      // Uncomment if you have a protected endpoint that requires JWT
      /*
      try {
        const response = await fetch('http://localhost:3002/api/user-data', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setUserData(data);
        } else if (response.status === 401) {
          // Token expired or invalid
          handleLogout();
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
      */
      
      setLoading(false);
    };
    
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    const checkPlaidAccount = async () => {
      try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`http://localhost:3002/retrieve-plaid-user?userId=${userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            setPlaidAccount(data[0]);
          }
        }
      } catch (error) {
        console.error('Error checking Plaid account:', error);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      checkPlaidAccount();
    }
  }, [userId]);

  const handleLogout = () => {
    // Clear storage
    sessionStorage.removeItem('token');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userEmail');
    // Redirect to login
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-100">
        <div className="text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-3xl font-bold text-indigo-400">Welcome to Your Dashboard</h1>
              {/* {plaidAccount && (
                <button
                  onClick={() => {}} // This will be handled by the PlaidLink component
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors duration-200 shadow-md flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Connect Another Account
                </button>
              )} */}
            </div>
            
            <div className="border-t border-gray-700 pt-4 mb-6">
              <p className="text-xl">
                Logged in as: <span className="font-semibold text-indigo-300">{userEmail} {userId}</span>
              </p>
            </div>
            
            {loading ? (
              <div className="bg-gray-700 rounded-lg p-4 mt-6">
                <div className="flex items-center justify-center">
                  <svg className="animate-spin h-8 w-8 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              </div>
            ) : plaidAccount ? (
              <div className="bg-gray-700 rounded-lg p-4 mt-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-indigo-300">Your Financial Overview</h2>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-300">Connected Account: <span className="text-indigo-300"></span></span>
                    <PlaidLink userId={userId} userEmail={userEmail}>
                      <button
                        className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors duration-200 shadow-md"
                        title="Connect Another Account"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </PlaidLink>
                  </div>
                </div>
                <div className="border-t border-gray-600 pt-4">
                  <div className="bg-gray-800 rounded-lg p-6 mt-4">
                    <TransactionGraph userId={userId} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-700 rounded-lg p-4 mt-6">
                <h2 className="text-xl font-bold mb-4 text-indigo-300">Connect Your Bank Account</h2>
                <PlaidLink userId={userId} userEmail={userEmail}/>
              </div>
            )}

            <div className="bg-gray-700 rounded-lg p-4 mt-6">
              <h2 className="text-xl font-bold mb-2 text-indigo-300">Your Account</h2>
              <p className="mb-4 text-gray-300">
                Thank you for logging in. This is a secure area of the application.
              </p>
            </div>
          </div>
          
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors duration-200 shadow-md"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
