import { describe, it, expect, beforeEach, vi } from 'vitest'
import authService from '@/shared/api/authService'

// Mock the appwrite client
vi.mock('@/shared/utils/appwrite', () => ({
  account: {
    createEmailPasswordSession: vi.fn(),
    create: vi.fn(),
    deleteSession: vi.fn(),
    get: vi.fn(),
    createJWT: vi.fn(),
    updateName: vi.fn(),
  },
  databases: {
    createDocument: vi.fn(),
    getDocument: vi.fn(),
    updateDocument: vi.fn(),
  },
  ID: {
    unique: vi.fn(() => 'unique-id-123'),
  },
}))

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('User Authentication', () => {
    it('should login with valid credentials', async () => {
      const mockSession = {
        $id: 'session123',
        userId: 'user123'
      }
      
      const mockUser = {
        $id: 'user123',
        email: 'test@example.com',
        name: 'Test User'
      }

      const { account } = await import('@/shared/utils/appwrite')
      account.createEmailPasswordSession.mockResolvedValue(mockSession)
      account.get.mockResolvedValue(mockUser)

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123'
      })

      expect(account.createEmailPasswordSession).toHaveBeenCalledWith(
        'test@example.com',
        'password123'
      )
      expect(result).toEqual(mockUser)
    })

    it('should handle login with invalid credentials', async () => {
      const { account } = await import('@/shared/utils/appwrite')
      account.createEmailPasswordSession.mockRejectedValue(
        new Error('Invalid credentials')
      )

      await expect(authService.login({
        email: 'wrong@example.com',
        password: 'wrongpassword'
      })).rejects.toThrow('Invalid credentials')
    })

    it('should register a new user', async () => {
      const mockUser = {
        $id: 'newuser123',
        email: 'newuser@example.com',
        name: 'New User'
      }

      const mockSession = {
        $id: 'session456',
        userId: 'newuser123'
      }

      const { account, databases, ID } = await import('@/shared/utils/appwrite')
      account.create.mockResolvedValue(mockUser)
      account.createEmailPasswordSession.mockResolvedValue(mockSession)
      account.get.mockResolvedValue(mockUser) // This is what register() returns
      databases.createDocument.mockResolvedValue({
        $id: 'player456',
        user_id: 'newuser123',
        display_name: 'New User'
      })

      const result = await authService.register({
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User'
      })

      expect(account.create).toHaveBeenCalledWith(
        'unique-id-123',
        'newuser@example.com',
        'password123',
        'New User'
      )
      expect(account.createEmailPasswordSession).toHaveBeenCalledWith(
        'newuser@example.com',
        'password123'
      )
      expect(account.get).toHaveBeenCalled() // This is what register actually calls
      expect(result).toEqual(mockUser)
    })

    it('should handle registration errors', async () => {
      const { account } = await import('@/shared/utils/appwrite')
      account.create.mockRejectedValue(new Error('Email already exists'))

      await expect(authService.register({
        email: 'existing@example.com',
        password: 'password123',
        name: 'Existing User'
      })).rejects.toThrow('Email already exists')
    })

    it('should logout user', async () => {
      const { account } = await import('@/shared/utils/appwrite')
      account.deleteSession.mockResolvedValue(true)

      await authService.logout()

      expect(account.deleteSession).toHaveBeenCalledWith('current')
    })

    it('should handle logout errors gracefully', async () => {
      const { account } = await import('@/shared/utils/appwrite')
      account.deleteSession.mockRejectedValue(new Error('Session not found'))

      // Should not throw error
      await expect(authService.logout()).resolves.toBeUndefined()
    })
  })

  describe('Authentication Status', () => {
    it('should check if user is authenticated', async () => {
      const mockUser = {
        $id: 'user123',
        email: 'test@example.com',
        name: 'Test User'
      }

      const { account } = await import('@/shared/utils/appwrite')
      account.get.mockResolvedValue(mockUser)

      const result = await authService.isAuthenticated()

      expect(result).toBe(true)
      expect(account.get).toHaveBeenCalled()
    })

    it('should return false when user is not authenticated', async () => {
      const { account } = await import('@/shared/utils/appwrite')
      account.get.mockRejectedValue(new Error('Unauthorized'))

      const result = await authService.isAuthenticated()

      expect(result).toBe(false)
    })

    it('should check auth status and return user data', async () => {
      const mockUser = {
        $id: 'user123',
        email: 'test@example.com',
        name: 'Test User'
      }

      const mockPlayer = {
        $id: 'player123',
        user_id: 'user123',
        display_name: 'Test Player'
      }

      const { account, databases } = await import('@/shared/utils/appwrite')
      account.get.mockResolvedValue(mockUser)
      databases.getDocument.mockResolvedValue(mockPlayer)

      const result = await authService.checkAuthStatus()

      expect(result).toEqual(mockUser) // checkAuthStatus only returns account.get()
    })

    it('should return null when auth check fails', async () => {
      const { account } = await import('@/shared/utils/appwrite')
      account.get.mockRejectedValue(new Error('Unauthorized'))

      const result = await authService.checkAuthStatus()

      expect(result).toBeNull()
    })
  })

  describe('Token Management', () => {
    it('should refresh JWT token', async () => {
      const mockUser = {
        $id: 'user123',
        email: 'test@example.com',
        name: 'Test User'
      }

      const { account } = await import('@/shared/utils/appwrite')
      account.get.mockResolvedValue(mockUser)

      const result = await authService.refreshToken()

      expect(account.get).toHaveBeenCalled()
      expect(result).toEqual(mockUser)
    })

    it('should handle token refresh errors', async () => {
      const { account } = await import('@/shared/utils/appwrite')
      account.get.mockRejectedValue(new Error('Unauthorized'))

      await expect(authService.refreshToken()).rejects.toThrow('Unauthorized')
    })
  })

  describe('Profile Management', () => {
    it('should update user profile', async () => {
      const mockUpdatedUser = {
        $id: 'user123',
        email: 'test@example.com',
        name: 'Updated Name'
      }

      const { account } = await import('@/shared/utils/appwrite')
      account.updateName.mockResolvedValue(mockUpdatedUser)

      const result = await authService.updateProfile({ name: 'Updated Name' })

      expect(account.updateName).toHaveBeenCalledWith('Updated Name')
      expect(result).toEqual(mockUpdatedUser)
    })

    it('should handle profile update errors', async () => {
      const { account } = await import('@/shared/utils/appwrite')
      account.updateName.mockRejectedValue(new Error('Invalid name'))

      await expect(authService.updateProfile({ 
        name: '' 
      })).rejects.toThrow('Invalid name')
    })
  })

  describe('Admin Authentication', () => {
    it('should handle admin login', async () => {
      const mockAdminSession = {
        $id: 'admin-session',
        userId: 'admin123'
      }

      const mockAdminUser = {
        $id: 'admin123',
        email: 'admin@example.com',
        name: 'Admin User',
        labels: ['admin']
      }

      const { account } = await import('@/shared/utils/appwrite')
      account.createEmailPasswordSession.mockResolvedValue(mockAdminSession)
      account.get.mockResolvedValue(mockAdminUser)

      const result = await authService.adminLogin({
        email: 'admin@example.com',
        password: 'adminpass'
      })

      expect(result).toEqual(mockAdminUser)
    })

    it('should handle admin logout', async () => {
      const { account } = await import('@/shared/utils/appwrite')
      account.deleteSession.mockResolvedValue(true)

      await authService.adminLogout()

      expect(account.deleteSession).toHaveBeenCalledWith('current')
    })
  })

  describe('Service Initialization', () => {
    it('should initialize service', () => {
      // Test initialization
      expect(() => authService.initialize()).not.toThrow()
    })

    it('should handle initialization errors gracefully', () => {
      // Mock a scenario where initialization might fail
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      // This should not throw even if there are issues
      expect(() => authService.initialize()).not.toThrow()
      
      consoleSpy.mockRestore()
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle network errors during login', async () => {
      const { account } = await import('@/shared/utils/appwrite')
      account.createEmailPasswordSession.mockRejectedValue(
        new Error('Network error')
      )

      await expect(authService.login({
        email: 'test@example.com',
        password: 'password123'
      })).rejects.toThrow('Network error')
    })

    it('should handle malformed user data', async () => {
      const { account } = await import('@/shared/utils/appwrite')
      account.get.mockResolvedValue(null)

      const result = await authService.checkAuthStatus()
      expect(result).toBeNull()
    })

    it('should validate input parameters', async () => {
      // Test with empty email
      await expect(authService.login({
        email: '',
        password: 'password123'
      })).rejects.toThrow()

      // Test with empty password
      await expect(authService.login({
        email: 'test@example.com',
        password: ''
      })).rejects.toThrow()
    })

    it('should handle concurrent authentication requests', async () => {
      const mockUser = {
        $id: 'user123',
        email: 'test@example.com'
      }

      const { account } = await import('@/shared/utils/appwrite')
      account.createEmailPasswordSession.mockResolvedValue({ userId: 'user123' })
      account.get.mockResolvedValue(mockUser)

      // Make multiple concurrent login requests
      const loginPromises = Array.from({ length: 3 }, () =>
        authService.login({
          email: 'test@example.com',
          password: 'password123'
        })
      )

      const results = await Promise.allSettled(loginPromises)
      
      // All should succeed or fail consistently
      const statuses = results.map(r => r.status)
      expect(statuses.every(s => s === 'fulfilled')).toBe(true)
    })
  })
})
