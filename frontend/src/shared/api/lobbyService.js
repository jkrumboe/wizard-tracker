import { databases, account, ID, client } from '@/shared/utils/appwrite';
import { Query } from 'appwrite';

// Database and Collection IDs - using existing database
const LOBBY_DATABASE_ID = '688cfb4b002d001bc2e5'; // Using existing database
const ROOMS_COLLECTION_ID = 'game_rooms';
const ROOM_MEMBERS_COLLECTION_ID = 'room_members';

class LobbyService {
  /**
   * Create a new game room
   */
  async createRoom(roomData) {
    try {
      const user = await account.get();
      
      const room = await databases.createDocument(
        LOBBY_DATABASE_ID,
        ROOMS_COLLECTION_ID,
        ID.unique(),
        {
          room_id: ID.unique(),
          room_name: roomData.name,
          host_id: user.$id,
          host_name: user.name,
          max_players: roomData.maxPlayers || 6,
          current_players: 1,
          game_settings: JSON.stringify(roomData.gameSettings || {
            rounds: 10,
            mode: 'standard',
            difficulty: 'normal'
          }),
          status: 'waiting'
          // Using automatic $createdAt instead of manual created_at
        }
      );

      // Add host as first member
      await this.joinRoom(room.room_id, user);

      return {
        success: true,
        room: room
      };
    } catch (error) {
      console.error('Error creating room:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all available rooms
   */
  async getRooms() {
    try {
      const response = await databases.listDocuments(
        LOBBY_DATABASE_ID,
        ROOMS_COLLECTION_ID,
        [
          // Only show waiting rooms
          Query.equal('status', 'waiting'),
          Query.orderDesc('$createdAt'), // Using automatic $createdAt
          Query.limit(50)
        ]
      );

      return {
        success: true,
        rooms: response.documents
      };
    } catch (error) {
      console.error('Error fetching rooms:', error);
      
      // If collections don't exist, return empty array with helpful message
      if (error.message.includes('Collection not found') || error.message.includes('Database not found')) {
        console.warn('⚠️  Lobby collections not set up yet. Please create game_rooms and room_members collections in Appwrite.');
        return {
          success: true,
          rooms: []
        };
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Join a room
   */
  async joinRoom(roomId, user = null) {
    try {
      if (!user) {
        user = await account.get();
      }

      // Check if room exists and has space
      const room = await this.getRoom(roomId);
      if (!room.success) {
        return { success: false, error: 'Room not found' };
      }

      if (room.room.current_players >= room.room.max_players) {
        return { success: false, error: 'Room is full' };
      }

      // Check if user is already in the room
      const existingMember = await this.getRoomMember(roomId, user.$id);
      if (existingMember.success) {
        return { success: true, message: 'Already in room' };
      }

      // Add user to room members
      await databases.createDocument(
        LOBBY_DATABASE_ID,
        ROOM_MEMBERS_COLLECTION_ID,
        ID.unique(),
        {
          room_id: roomId,
          user_id: user.$id,
          user_name: user.name,
          joined_at: new Date().toISOString(), // Required by collection schema
          is_ready: false
        }
      );

      // Update room player count
      await databases.updateDocument(
        LOBBY_DATABASE_ID,
        ROOMS_COLLECTION_ID,
        room.room.$id,
        {
          current_players: room.room.current_players + 1
          // Using automatic $updatedAt instead of manual updated_at
        }
      );

      return {
        success: true,
        message: 'Joined room successfully'
      };
    } catch (error) {
      console.error('Error joining room:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Leave a room
   */
  async leaveRoom(roomId) {
    try {
      const user = await account.get();
      
      // Find and remove user from room members
      const memberResponse = await databases.listDocuments(
        LOBBY_DATABASE_ID,
        ROOM_MEMBERS_COLLECTION_ID,
        [
          Query.equal('room_id', roomId),
          Query.equal('user_id', user.$id)
        ]
      );

      if (memberResponse.documents.length === 0) {
        return { success: false, error: 'Not in this room' };
      }

      const member = memberResponse.documents[0];
      await databases.deleteDocument(
        LOBBY_DATABASE_ID,
        ROOM_MEMBERS_COLLECTION_ID,
        member.$id
      );

      // Update room player count
      const room = await this.getRoom(roomId);
      if (room.success) {
        const newPlayerCount = room.room.current_players - 1;
        
        if (newPlayerCount === 0) {
          // Delete empty room
          await databases.deleteDocument(
            LOBBY_DATABASE_ID,
            ROOMS_COLLECTION_ID,
            room.room.$id
          );
        } else {
          await databases.updateDocument(
            LOBBY_DATABASE_ID,
            ROOMS_COLLECTION_ID,
            room.room.$id,
            {
              current_players: newPlayerCount
              // Using automatic $updatedAt instead of manual updated_at
            }
          );
        }
      }

      return {
        success: true,
        message: 'Left room successfully'
      };
    } catch (error) {
      console.error('Error leaving room:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get room details
   */
  async getRoom(roomId) {
    try {
      const response = await databases.listDocuments(
        LOBBY_DATABASE_ID,
        ROOMS_COLLECTION_ID,
        [Query.equal('room_id', roomId)]
      );

      if (response.documents.length === 0) {
        return { success: false, error: 'Room not found' };
      }

      return {
        success: true,
        room: response.documents[0]
      };
    } catch (error) {
      console.error('Error fetching room:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get room members
   */
  async getRoomMembers(roomId) {
    try {
      const response = await databases.listDocuments(
        LOBBY_DATABASE_ID,
        ROOM_MEMBERS_COLLECTION_ID,
        [
          Query.equal('room_id', roomId),
          Query.orderAsc('joined_at')
        ]
      );

      return {
        success: true,
        members: response.documents
      };
    } catch (error) {
      console.error('Error fetching room members:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get specific room member
   */
  async getRoomMember(roomId, userId) {
    try {
      const response = await databases.listDocuments(
        LOBBY_DATABASE_ID,
        ROOM_MEMBERS_COLLECTION_ID,
        [
          Query.equal('room_id', roomId),
          Query.equal('user_id', userId)
        ]
      );

      if (response.documents.length === 0) {
        return { success: false, error: 'Member not found' };
      }

      return {
        success: true,
        member: response.documents[0]
      };
    } catch (error) {
      console.error('Error fetching room member:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Toggle ready status
   */
  async toggleReady(roomId) {
    try {
      const user = await account.get();
      const memberResponse = await this.getRoomMember(roomId, user.$id);
      
      if (!memberResponse.success) {
        return { success: false, error: 'Not in this room' };
      }

      const member = memberResponse.member;
      await databases.updateDocument(
        LOBBY_DATABASE_ID,
        ROOM_MEMBERS_COLLECTION_ID,
        member.$id,
        {
          is_ready: !member.is_ready
        }
      );

      return {
        success: true,
        isReady: !member.is_ready
      };
    } catch (error) {
      console.error('Error toggling ready status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Start game (host only)
   */
  async startGame(roomId) {
    try {
      const user = await account.get();
      const room = await this.getRoom(roomId);
      
      if (!room.success) {
        return { success: false, error: 'Room not found' };
      }

      if (room.room.host_id !== user.$id) {
        return { success: false, error: 'Only the host can start the game' };
      }

      // Check if all players are ready
      const members = await this.getRoomMembers(roomId);
      if (!members.success) {
        return { success: false, error: 'Could not fetch room members' };
      }

      const allReady = members.members.every(member => member.is_ready);
      if (!allReady) {
        return { success: false, error: 'Not all players are ready' };
      }

      // Update room status
      await databases.updateDocument(
        LOBBY_DATABASE_ID,
        ROOMS_COLLECTION_ID,
        room.room.$id,
        {
          status: 'starting'
          // Using automatic $updatedAt instead of manual updated_at
        }
      );

      return {
        success: true,
        message: 'Game starting...'
      };
    } catch (error) {
      console.error('Error starting game:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Subscribe to room updates
   */
  subscribeToRoom(roomId, callback) {
    const unsubscribe = client.subscribe(
      [
        `databases.${LOBBY_DATABASE_ID}.collections.${ROOMS_COLLECTION_ID}.documents`,
        `databases.${LOBBY_DATABASE_ID}.collections.${ROOM_MEMBERS_COLLECTION_ID}.documents`
      ],
      (response) => {
        // Filter for this specific room to avoid unnecessary updates
        if (response.payload && (
          response.payload.room_id === roomId ||
          response.payload.$id === roomId
        )) {
          callback(response);
        }
      }
    );

    return unsubscribe;
  }

  /**
   * Subscribe to lobby (all rooms) updates
   */
  subscribeToLobby(callback) {
    const unsubscribe = client.subscribe(
      [
        `databases.${LOBBY_DATABASE_ID}.collections.${ROOMS_COLLECTION_ID}.documents`,
        `databases.${LOBBY_DATABASE_ID}.collections.${ROOM_MEMBERS_COLLECTION_ID}.documents`
      ],
      (response) => {
        // Call callback for any room or member change
        callback(response);
      }
    );

    return unsubscribe;
  }
}

export const lobbyService = new LobbyService();
export default lobbyService;
