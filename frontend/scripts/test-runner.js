#!/usr/bin/env node

import { spawn } from 'child_process'
import { existsSync } from 'fs'

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(code)
      } else {
        reject(new Error(`Command failed with exit code ${code}`))
      }
    })

    proc.on('error', reject)
  })
}

async function runTests() {
  const args = globalThis.process.argv.slice(2)
  const testType = args[0] || 'all'

  log(`🧪 Running ${testType} tests...`, colors.cyan)

  try {
    switch (testType) {
      case 'unit':
        log('📋 Running unit tests...', colors.blue)
        await runCommand('npm', ['run', 'test:run'])
        break

      case 'integration':
        log('🔗 Running integration tests...', colors.blue)
        await runCommand('npx', ['vitest', 'run', 'src/tests/integration'])
        break

      case 'e2e':
        log('🌐 Running E2E tests...', colors.blue)
        if (!existsSync('playwright.config.js')) {
          log('❌ Playwright not configured. Install with: npm install -D @playwright/test', colors.red)
          globalThis.process.exit(1)
        }
        await runCommand('npx', ['playwright', 'test'])
        break

      case 'watch':
        log('👀 Running tests in watch mode...', colors.blue)
        await runCommand('npm', ['run', 'test:watch'])
        break

      case 'coverage':
        log('📊 Running tests with coverage...', colors.blue)
        await runCommand('npm', ['run', 'test:coverage'])
        break

      case 'ui':
        log('🎨 Opening test UI...', colors.blue)
        await runCommand('npm', ['run', 'test:ui'])
        break

      case 'all':
        log('🎯 Running all test suites...', colors.magenta)
        
        // Run unit tests
        log('1/3 📋 Unit tests...', colors.blue)
        await runCommand('npm', ['run', 'test:run'])
        
        // Run integration tests
        log('2/3 🔗 Integration tests...', colors.blue)
        await runCommand('npx', ['vitest', 'run', 'src/tests/integration'])
        
        // Run E2E tests if configured
        if (existsSync('playwright.config.js')) {
          log('3/3 🌐 E2E tests...', colors.blue)
          await runCommand('npx', ['playwright', 'test'])
        } else {
          log('⚠️  Skipping E2E tests (Playwright not configured)', colors.yellow)
        }
        break

      case 'lint':
        log('🔍 Running linter...', colors.blue)
        await runCommand('npm', ['run', 'lint'])
        break

      case 'fix':
        log('🔧 Running linter with auto-fix...', colors.blue)
        await runCommand('npm', ['run', 'lint:fix'])
        break

      case 'ci':
        log('🤖 Running CI test suite...', colors.magenta)
        
        // Lint first
        log('1/4 🔍 Linting...', colors.blue)
        await runCommand('npm', ['run', 'lint'])
        
        // Unit tests with coverage
        log('2/4 📋 Unit tests with coverage...', colors.blue)
        await runCommand('npm', ['run', 'test:coverage'])
        
        // Integration tests
        log('3/4 🔗 Integration tests...', colors.blue)
        await runCommand('npx', ['vitest', 'run', 'src/tests/integration'])
        
        // E2E tests if configured
        if (existsSync('playwright.config.js')) {
          log('4/4 🌐 E2E tests...', colors.blue)
          await runCommand('npx', ['playwright', 'test'])
        } else {
          log('⚠️  Skipping E2E tests (Playwright not configured)', colors.yellow)
        }
        break

      default:
        log(`❌ Unknown test type: ${testType}`, colors.red)
        log('Available options:', colors.yellow)
        log('  unit         - Run unit tests', colors.reset)
        log('  integration  - Run integration tests', colors.reset)
        log('  e2e          - Run E2E tests', colors.reset)
        log('  watch        - Run tests in watch mode', colors.reset)
        log('  coverage     - Run tests with coverage', colors.reset)
        log('  ui           - Open test UI', colors.reset)
        log('  all          - Run all test suites', colors.reset)
        log('  lint         - Run linter', colors.reset)
        log('  fix          - Run linter with auto-fix', colors.reset)
        log('  ci           - Run full CI test suite', colors.reset)
        globalThis.process.exit(1)
    }

    log(`✅ ${testType} tests completed successfully!`, colors.green)

  } catch (error) {
    log(`❌ Tests failed: ${error.message}`, colors.red)
    globalThis.process.exit(1)
  }
}

// Handle process signals
globalThis.process.on('SIGINT', () => {
  log('\n⏹️  Test run interrupted', colors.yellow)
  globalThis.process.exit(0)
})

globalThis.process.on('SIGTERM', () => {
  log('\n⏹️  Test run terminated', colors.yellow)
  globalThis.process.exit(0)
})

runTests()
