// AppwriteStatus.js
import React, { useEffect, useState } from 'react';
import { client, Databases } from './appwrite.jsx';

function AppwriteStatus() {
  const [isOnline, setIsOnline] = useState(null);

  useEffect(() => {
    const databases = new Databases(client);

    async function fetchStatus() {
      try {
        const result = await databases.listDocuments(
          '687fb25300229a613459', // DATABASE_ID
          '687fb267000ddb39332f', // COLLECTION_ID
          []
        );
        console.log(result);
        setIsOnline(result); // assumes 'online' is a boolean attribute
        console.log('isOnline', isOnline)
      } catch (err) {
        console.error("Failed to get status:", err);
        setIsOnline(false); // safe fallback
      }
    }

    fetchStatus();
  }, []);

  if (isOnline === null) return <div>Loading status...</div>;
  return <div>Online mode is <strong>{isOnline ? 'ON' : 'OFF'}</strong></div>;
}

export default AppwriteStatus;
