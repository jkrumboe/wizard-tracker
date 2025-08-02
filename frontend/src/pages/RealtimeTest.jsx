import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { subscribeToOnlineStatus, getOnlineStatus, updateOnlineStatus, databases, CONFIG_DATABASE_ID, ONLINE_COLLECTION_ID, createInitialStatusDocument } from '@/shared/utils/appwrite';

const RealtimeTest = () => {
  const [status, setStatus] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeTest = async () => {
      // Get initial status
      const result = await getOnlineStatus();
      if (result.success) {
        setStatus(result.document);
        addLog(`Initial status loaded: ${result.document.status}`);
      } else {
        addLog(`Error loading status: ${result.error}`);
      }
      setLoading(false);

      // Subscribe to realtime updates
      const unsubscribe = subscribeToOnlineStatus((update) => {
        addLog(`🔄 Realtime update received:`);
        addLog(`   Type: ${update.type}`);
        addLog(`   Document ID: ${update.data?.$id}`);
        addLog(`   Status: ${update.data?.status}`);
        addLog(`   Updated At: ${update.data?.$updatedAt}`);
        addLog(`   Full payload: ${JSON.stringify(update.data, null, 2)}`);
        setStatus(update.data);
      });
      
      setSubscription(unsubscribe);
    };

    initializeTest();

    // Cleanup subscription on unmount
    return () => {
      if (subscription) {
        subscription();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const debugDatabaseAccess = async () => {
    addLog('🔍 Testing database access...');
    try {
      // Test database access
      const response = await databases.listDocuments(CONFIG_DATABASE_ID, ONLINE_COLLECTION_ID);
      addLog(`✅ Database accessible. Found ${response.documents.length} documents`);
      if (response.documents.length > 0) {
        addLog(`📄 First document: ${JSON.stringify(response.documents[0], null, 2)}`);
      }
    } catch (error) {
      addLog(`❌ Database access failed: ${error.message}`);
      if (error.message.includes('404')) {
        addLog('💡 This likely means the database or collection does not exist');
      }
    }
  };

  const createTestDocument = async () => {
    addLog('📝 Creating test document...');
    const result = await createInitialStatusDocument();
    if (result.success) {
      addLog(`✅ Document created successfully: ${result.document.$id}`);
      setStatus(result.document);
    } else {
      addLog(`❌ Failed to create document: ${result.error}`);
    }
  };

  const toggleStatus = async () => {
    if (!status) return;
    
    const newStatus = !status.status;
    addLog(`Updating status to: ${newStatus}`);
    
    const result = await updateOnlineStatus(status.$id, newStatus);
    if (result.success) {
      addLog(`Status updated successfully to: ${newStatus}`);
    } else {
      addLog(`Error updating status: ${result.error}`);
    }
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading realtime test...</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1>🚀 Appwrite Realtime Test</h1>
        <Link 
          to="/" 
          style={{
            padding: '8px 16px',
            backgroundColor: '#6c757d',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        >
          ← Back to Home
        </Link>
      </div>
      
      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '8px', backgroundColor: '#fff3cd' }}>
        <h2>🔧 Debug Tools</h2>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <button 
            onClick={debugDatabaseAccess}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Test Database Access
          </button>
          <button 
            onClick={createTestDocument}
            style={{
              padding: '8px 16px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Create Status Document
          </button>
        </div>
        <p style={{ fontSize: '14px', color: '#856404', margin: 0 }}>
          Use these tools if the status is not loading. First test database access, then create a document if needed.
        </p>
      </div>
      
      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h2>Current Status</h2>
        <p><strong>Database ID:</strong> 688cfb4b002d001bc2e5</p>
        <p><strong>Collection ID:</strong> 688cfb57002021464526</p>
        <p><strong>Document ID:</strong> {status?.$id || 'Not loaded'}</p>
        <p><strong>Status:</strong> 
          <span style={{ 
            color: status?.status ? 'green' : 'red', 
            fontWeight: 'bold',
            marginLeft: '10px'
          }}>
            {status?.status ? 'ONLINE' : 'OFFLINE'}
          </span>
        </p>
        <p><strong>Last Updated:</strong> {status?.$updatedAt ? new Date(status.$updatedAt).toLocaleString() : 'N/A'}</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={toggleStatus}
          disabled={!status}
          style={{
            padding: '10px 20px',
            backgroundColor: status?.status ? '#ef4444' : '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: status ? 'pointer' : 'not-allowed',
            fontSize: '16px'
          }}
        >
          {status?.status ? 'Set Offline' : 'Set Online'}
        </button>
      </div>

      <div style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
        <h3>Realtime Logs</h3>
        <div style={{ 
          height: '300px', 
          overflowY: 'auto', 
          fontFamily: 'monospace', 
          fontSize: '14px',
          backgroundColor: 'black',
          color: 'green',
          padding: '10px',
          borderRadius: '4px'
        }}>
          {logs.map((log, index) => (
            <div key={index}>{log}</div>
          ))}
          {logs.length === 0 && <div>No logs yet...</div>}
        </div>
      </div>

      <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
        <p>💡 <strong>How to test:</strong></p>
        <ul>
          <li>Click the toggle button to change the status</li>
          <li>Open this page in multiple browser tabs to see realtime updates</li>
          <li>Watch the logs for realtime events</li>
          <li>Check the admin dashboard to see the status changes</li>
        </ul>
      </div>
    </div>
  );
};

export default RealtimeTest;
