# Backend API Implementation for Username Updates

This document describes how to implement the backend API endpoint that will handle username updates using Appwrite's Users API.

## Required Backend Endpoint

### PATCH /api/users/{userId}/name

This endpoint should be implemented in your backend server to handle username updates using Appwrite's Users API with proper API keys.

#### Node.js Express Example:

```javascript
const express = require('express');
const { Client, Users } = require('node-appwrite');

const router = express.Router();

// Initialize Appwrite client with server-side credentials
const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT) // Your API Endpoint
    .setProject(process.env.APPWRITE_PROJECT_ID) // Your project ID
    .setKey(process.env.APPWRITE_API_KEY); // Your secret API key

const users = new Users(client);

// PATCH /api/users/:userId/name
router.patch('/users/:userId/name', async (req, res) => {
    try {
        const { userId } = req.params;
        const { name } = req.body;

        // Validate input
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({
                error: 'Name is required and must be a non-empty string'
            });
        }

        if (name.length > 128) {
            return res.status(400).json({
                error: 'Name must be 128 characters or less'
            });
        }

        // Optional: Add authentication middleware to verify the user
        // can update this profile (e.g., only allow users to update their own profile)
        
        // Update user name using Appwrite Users API
        const result = await users.updateName(userId, name.trim());

        res.json({
            success: true,
            message: 'Username updated successfully',
            user: result
        });

    } catch (error) {
        console.error('Error updating username:', error);
        
        // Handle specific Appwrite errors
        if (error.code === 404) {
            return res.status(404).json({
                error: 'User not found'
            });
        }
        
        if (error.code === 400) {
            return res.status(400).json({
                error: error.message || 'Invalid request'
            });
        }

        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

module.exports = router;
```

#### Environment Variables Required:

```env
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your_project_id_here
APPWRITE_API_KEY=your_secret_api_key_here
```

#### Usage in Express App:

```javascript
const express = require('express');
const cors = require('cors');
const userRoutes = require('./routes/users');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', userRoutes);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
```

## Frontend Configuration

Update your frontend environment variables:

```env
VITE_API_BASE_URL=http://localhost:8000
```

## Security Considerations

1. **Authentication**: Add middleware to verify that users can only update their own profiles
2. **Rate Limiting**: Implement rate limiting to prevent abuse
3. **Input Validation**: Sanitize and validate all user inputs
4. **CORS**: Configure CORS properly for your frontend domain
5. **API Key Security**: Keep your Appwrite API key secure and never expose it in frontend code

## Alternative Implementation

If you prefer to keep using Appwrite's account service (client-side), you can continue using the current implementation. The Users API is primarily for administrative operations and user management from the server side.

The frontend will automatically fall back to the account service if the backend endpoint is not available.
