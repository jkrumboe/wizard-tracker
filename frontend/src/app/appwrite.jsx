import { Client, Account, Databases, ID } from 'appwrite';
import React from 'react';

const client = new Client();

client
    .setEndpoint('https://appwrite.jkrumboe.dev/v1')
    .setProject('687fae1e003014f4a008');

client.setEndpointRealtime('wss://appwrite.jkrumboe.dev/v1/realtime');

// const databases = new Databases(client);

// const result = await databases.listDocuments(
//   '687fb25300229a613459', // DATABASE_ID
//   '687fb267000ddb39332f', // COLLECTION_ID
//   []
// );
// console.log(result);

export { client, Account, Databases, ID };
export const account = new Account(client);
