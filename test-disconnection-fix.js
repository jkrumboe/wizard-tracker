#!/usr/bin/env node

/**
 * Test script to verify the disconnection issue fix
 * This script tests the complete flow of:
 * 1. User login
 * 2. Room creation  
 * 3. Game room connection
 * 4. Verifying the room stays connected (no immediate disconnection)
 */

const { Client } = require('colyseus.js');

const API_BASE = 'http://localhost:5055';
const WS_URL = 'ws://localhost:5055';

class DisconnectionFixTest {
  constructor() {
    this.client = new Client(WS_URL);
    this.testResults = [];
  }

  async log(message, success = null) {
    const timestamp = new Date().toISOString();
    const status = success === null ? 'INFO' : (success ? '✅ PASS' : '❌ FAIL');
    const logMessage = `[${timestamp}] ${status}: ${message}`;
    console.log(logMessage);
    
    if (success !== null) {
      this.testResults.push({ message, success, timestamp });
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async testLogin() {
    try {
      this.log('Testing user login...');
      
      const loginData = {
        username: 'testuser',
        password: 'testpass123'
      };

      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });

      if (!response.ok) {
        throw new Error(`Login failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.user && result.user.player_id) {
        this.log(`Login successful for user ID: ${result.user.player_id}`, true);
        return result.user;
      } else {
        throw new Error('Invalid login response structure');
      }
    } catch (error) {
      this.log(`Login failed: ${error.message}`, false);
      throw error;
    }
  }

  async testRoomCreation(user) {
    try {
      this.log('Testing room creation via API...');
      
      const roomData = {
        roomName: `Test Room ${Date.now()}`,
        maxPlayers: 4,
        isPrivate: false,
        gameMode: 'classic',
        settings: {
          maxRounds: 10,
          hostId: String(user.player_id),
          hostName: user.username
        }
      };

      const response = await fetch(`${API_BASE}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roomData)
      });

      if (!response.ok) {
        throw new Error(`Room creation failed: ${response.statusText}`);
      }

      const room = await response.json();
      
      if (room.roomId) {
        this.log(`Room created with ID: ${room.roomId}`, true);
        return room;
      } else {
        throw new Error('Invalid room creation response');
      }
    } catch (error) {
      this.log(`Room creation failed: ${error.message}`, false);
      throw error;
    }
  }

  async testColyseusRoomCreation(user, dbRoom) {
    try {
      this.log('Testing Colyseus room creation...');
      
      const options = {
        dbRoomId: dbRoom.roomId,
        roomName: dbRoom.roomName,
        maxPlayers: dbRoom.maxPlayers,
        gameMode: 'classic',
        maxRounds: 10,
        isPublic: !dbRoom.isPrivate,
        hostId: String(user.player_id),
        playerId: user.player_id,
        playerName: user.username
      };
      
      // Create Colyseus room
      const room = await this.client.create('wizard_game', options);
      
      this.log(`Colyseus room created: ${room.sessionId}`, true);
      return room;
    } catch (error) {
      this.log(`Colyseus room creation failed: ${error.message}`, false);
      throw error;
    }
  }

  async testRoomStability(room, testDurationMs = 10000) {
    try {
      this.log(`Testing room stability for ${testDurationMs/1000} seconds...`);
      
      let isConnected = true;
      let disconnectReason = null;
      let stateUpdateCount = 0;
      
      // Set up event listeners
      room.onStateChange(() => {
        stateUpdateCount++;
      });
      
      room.onLeave((code) => {
        isConnected = false;
        disconnectReason = `Left with code: ${code}`;
      });
      
      room.onError((code, message) => {
        isConnected = false;
        disconnectReason = `Error ${code}: ${message}`;
      });
      
      // Wait for the test duration
      await this.sleep(testDurationMs);
      
      if (isConnected) {
        this.log(`Room remained connected for ${testDurationMs/1000} seconds (${stateUpdateCount} state updates)`, true);
        return true;
      } else {
        this.log(`Room disconnected: ${disconnectReason}`, false);
        return false;
      }
    } catch (error) {
      this.log(`Room stability test failed: ${error.message}`, false);
      return false;
    }
  }

  async testRoomCleanup(room) {
    try {
      this.log('Testing room cleanup...');
      
      if (room && room.connection && room.connection.readyState === WebSocket.OPEN) {
        room.leave();
        await this.sleep(1000); // Wait for leave to process
        this.log('Room left successfully', true);
      } else {
        this.log('Room was already disconnected', true);
      }
    } catch (error) {
      this.log(`Room cleanup failed: ${error.message}`, false);
    }
  }

  async runCompleteTest() {
    this.log('🚀 Starting disconnection fix verification test...');
    
    let user = null;
    let dbRoom = null;
    let colyseusRoom = null;
    
    try {
      // Test 1: Login
      user = await this.testLogin();
      
      // Test 2: Create room via API
      dbRoom = await this.testRoomCreation(user);
      
      // Test 3: Create Colyseus room
      colyseusRoom = await this.testColyseusRoomCreation(user, dbRoom);
      
      // Test 4: Test room stability (the main test for disconnection fix)
      const isStable = await this.testRoomStability(colyseusRoom, 15000); // 15 seconds
      
      // Test 5: Clean up
      await this.testRoomCleanup(colyseusRoom);
      
      // Summary
      this.printTestSummary();
      
      return isStable;
      
    } catch (error) {
      this.log(`Test suite failed: ${error.message}`, false);
      
      // Cleanup on error
      if (colyseusRoom) {
        await this.testRoomCleanup(colyseusRoom);
      }
      
      this.printTestSummary();
      return false;
    }
  }

  printTestSummary() {
    this.log('\n' + '='.repeat(60));
    this.log('TEST SUMMARY');
    this.log('='.repeat(60));
    
    const passed = this.testResults.filter(t => t.success).length;
    const failed = this.testResults.filter(t => !t.success).length;
    const total = this.testResults.length;
    
    this.log(`Total Tests: ${total}`);
    this.log(`Passed: ${passed}`);
    this.log(`Failed: ${failed}`);
    this.log(`Success Rate: ${((passed/total)*100).toFixed(1)}%`);
    
    if (failed > 0) {
      this.log('\nFAILED TESTS:');
      this.testResults
        .filter(t => !t.success)
        .forEach(t => this.log(`  • ${t.message}`));
    }
    
    this.log('='.repeat(60));
    
    if (failed === 0) {
      this.log('🎉 ALL TESTS PASSED! Disconnection issue appears to be fixed.');
    } else {
      this.log('⚠️  Some tests failed. Please review the issues above.');
    }
  }
}

// Run the test
async function main() {
  const tester = new DisconnectionFixTest();
  
  try {
    const success = await tester.runCompleteTest();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('Test runner failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = DisconnectionFixTest;
