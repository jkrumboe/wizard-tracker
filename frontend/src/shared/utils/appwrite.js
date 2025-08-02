import { Client, Account, Databases, ID } from "appwrite";

const client = new Client()
    .setEndpoint(import.meta.env.VITE_APPWRITE_PUBLIC_ENDPOINT)
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

const databases = new Databases(client);
const account = new Account(client);

// Database and Collection IDs
const CONFIG_DATABASE_ID = '688cfb4b002d001bc2e5';
const ONLINE_COLLECTION_ID = '688cfb57002021464526';

client.subscribe('databases.688cfb4b002d001bc2e5.collections.688cfb57002021464526', response => {
    // Callback will be executed on changes for documents A and all files.
    console.log('Realtime update:', response);
    console.log(response);
});


export { 
    client, 
    account, 
    databases, 
    ID,
    CONFIG_DATABASE_ID,
    ONLINE_COLLECTION_ID
};
