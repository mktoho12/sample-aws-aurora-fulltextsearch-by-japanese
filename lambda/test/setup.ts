import 'reflect-metadata'
import { vi } from 'vitest'

// Mock middy modules
vi.mock('@middy/core')
vi.mock('@middy/http-cors')
vi.mock('@middy/http-error-handler')
vi.mock('@middy/http-json-body-parser')

// Set test timeout
vi.setConfig({ testTimeout: 30000 })