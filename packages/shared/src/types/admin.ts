/** Admin auth types */

export interface Admin {
  id: string
  email: string
  passwordHash: string
  /** Friendly display name shown in the admin UI and audit log. */
  displayName?: string
  /** ISO timestamp of last successful login. */
  lastLoginAt?: string
  /** When set, this admin can't log in. The last enabled admin can't be
   * disabled (server enforces). */
  disabled?: boolean
  createdAt: string
  updatedAt?: string
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
