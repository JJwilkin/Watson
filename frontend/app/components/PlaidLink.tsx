import { useCallback, useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';

interface PlaidLinkProps {
  userEmail: string;
  userId: string;
}

export default function PlaidLink({ userEmail, userId }: PlaidLinkProps) {
  const [linkToken, setLinkToken] = useState(null);

  useEffect(() => {
    const getLinkToken = async () => {
      const token = sessionStorage.getItem('token'); // Get the JWT token
      const response = await fetch('http://localhost:3002/create-link-token', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const { link_token } = await response.json();
      setLinkToken(link_token);
    };
    getLinkToken();
  }, []);

  const onSuccess = useCallback(async (public_token: string) => {
    const token = sessionStorage.getItem('token');
    const response = await fetch('http://localhost:3002/exchange-save-token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        public_token,
        userId,
      }),
    });
    const res = await response.json();
    console.log(res)
    // Handle the response accordingly
  }, [userId]); // Add userEmail to dependency array

  const config = {
    token: linkToken,
    onSuccess,
  };

  const { open, ready } = usePlaidLink(config);

  if (!ready) {
    return <div>Loading...</div>;
  }

  return (
    <button 
      onClick={() => open()} 
      disabled={!ready}
      className={`
        flex items-center justify-center
        px-6 py-3
        bg-indigo-600 
        hover:bg-indigo-700 
        text-white 
        font-medium 
        rounded-lg 
        shadow-md 
        transition-colors 
        duration-200
        ${!ready ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'}
      `}
    >
      {!ready ? (
        <span className="inline-flex items-center">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading...
        </span>
      ) : (
        <span className="inline-flex items-center">
          <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10.5 2a2 2 0 011.6.8l5.8 7.8c.4.5.4 1.2 0 1.7-.3.4-.8.7-1.4.7h-.8v3c0 1.1-.9 2-2 2h-7.4c-1.1 0-2-.9-2-2v-3h-.8c-.6 0-1.1-.3-1.4-.7-.4-.5-.4-1.2 0-1.7l5.8-7.8c.4-.5 1-.8 1.6-.8zm-3.5 9v5h2v-3h2v3h2v-5h-6z" clipRule="evenodd"/>
          </svg>
          +
        </span>
      )}
    </button>
  );
} 