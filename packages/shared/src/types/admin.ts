/** Admin auth types */

export interface Admin {
  id: string
  email: string
  passwordHash: string
  createdAt: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  expiresAt: string
}

export interface I18nOverrides {
  id: string
  eventSlug: string
  language: string
  overrides: Record<string, string>
  updatedAt: string
}
