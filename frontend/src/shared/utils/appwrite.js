import { Client, Account, Databases, ID } from "appwrite";

const client = new Client()
    .setEndpoint(import.meta.env.VITE_APPWRITE_PUBLIC_ENDPOINT)
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

const databases = new Databases(client);
const account = new Account(client);

// Database and Collection IDs
const CONFIG_DATABASE_ID = '688cfb4b002d001bc2e5';
const ONLINE_COLLECTION_ID = '688cfb57002021464526';

// Subscribe to realtime updates for online status
const subscribeToOnlineStatus = (callback) => {
    const unsubscribe = client.subscribe(
        `databases.${CONFIG_DATABASE_ID}.collections.${ONLINE_COLLECTION_ID}.documents`,
        (response) => {
            console.log('Realtime update:', response);
            
            if (response.events && response.events.length > 0) {
                const event = response.events[0];
                const eventType = event.split('.').pop(); // get 'create', 'update', 'delete'
                
                callback({
                    type: eventType,
                    data: response.payload,
                    status: response.payload?.status
                });
            }
        }
    );
    
    return unsubscribe;
};

// Get the current online status document
const getOnlineStatus = async () => {
    try {
        const response = await databases.listDocuments(CONFIG_DATABASE_ID, ONLINE_COLLECTION_ID);
        if (response.documents.length > 0) {
            return {
                success: true,
                document: response.documents[0]
            };
        } else {
            return {
                success: false,
                error: 'No status document found'
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
};

// Update online status
const updateOnlineStatus = async (documentId, status) => {
    try {
        const result = await databases.updateDocument(
            CONFIG_DATABASE_ID,
            ONLINE_COLLECTION_ID,
            documentId,
            { status }
        );
        return {
            success: true,
            document: result
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
};

// Create initial status document
const createInitialStatusDocument = async () => {
    try {
        const result = await databases.createDocument(
            CONFIG_DATABASE_ID,
            ONLINE_COLLECTION_ID,
            ID.unique(),
            { status: true }
        );
        return {
            success: true,
            document: result
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
};

export { 
    client, 
    account, 
    databases, 
    ID,
    CONFIG_DATABASE_ID,
    ONLINE_COLLECTION_ID,
    subscribeToOnlineStatus,
    getOnlineStatus,
    updateOnlineStatus,
    createInitialStatusDocument
};
