/**
 * @fileoverview API Client for Offline Sync
 * Provides axios instance configured for the offline sync system
 */

import axios from 'axios';
import { API_BASE_URL } from './config.js';

/**
 * Create axios instance for sync operations
 */
export const syncApiClient = axios.create({
  baseURL: API_BASE_URL || '',
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Add request interceptor to include auth token
 */
syncApiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Add response interceptor for error handling
 */
syncApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle specific error cases
    if (error.response) {
      // Server responded with error status
      console.error('API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      // Request made but no response (likely offline)
      console.warn('No response from server, likely offline');
    } else {
      // Something else happened
      console.error('Request error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default syncApiClient;
