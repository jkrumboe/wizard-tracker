import '@testing-library/jest-dom'
import { vi, beforeAll, afterAll, beforeEach } from 'vitest'

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock environment variables
vi.stubGlobal('import.meta', {
  env: {
    VITE_APPWRITE_PROJECT_ID: 'test-project-id',
    VITE_APPWRITE_PUBLIC_ENDPOINT: 'https://test-endpoint.example.com/v1',
    VITE_APPWRITE_DATABASE_ID: 'test-database-id',
    VITE_APPWRITE_GAMES_COLLECTION_ID: 'test-games-collection-id',
    VITE_APP_VERSION: '1.0.0-test',
  }
})

// Mock localStorage
const storage = {}
const localStorageMock = {
  getItem: vi.fn(key => storage[key] || null),
  setItem: vi.fn((key, value) => {
    storage[key] = value.toString()
  }),
  removeItem: vi.fn(key => {
    delete storage[key]
  }),
  clear: vi.fn(() => {
    Object.keys(storage).forEach(key => delete storage[key])
  }),
}
vi.stubGlobal('localStorage', localStorageMock)

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
vi.stubGlobal('sessionStorage', sessionStorageMock)

// Mock window.location
delete window.location
window.location = {
  href: 'http://localhost:3000',
  origin: 'http://localhost:3000',
  pathname: '/',
  search: '',
  hash: '',
  assign: vi.fn(),
  reload: vi.fn(),
  replace: vi.fn(),
}

// Mock window.history
window.history = {
  pushState: vi.fn(),
  replaceState: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  go: vi.fn(),
}

// Mock ResizeObserver
globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
globalThis.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock fetch
globalThis.fetch = vi.fn()

// Mock console methods in tests to reduce noise
const originalError = console.error
beforeAll(() => {
  console.error = vi.fn()
  console.warn = vi.fn()
})

afterAll(() => {
  console.error = originalError
})

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
  localStorageMock.getItem.mockClear()
  localStorageMock.setItem.mockClear()
  localStorageMock.removeItem.mockClear()
  localStorageMock.clear.mockClear()
})
