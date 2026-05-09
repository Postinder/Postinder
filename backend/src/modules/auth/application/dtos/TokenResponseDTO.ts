export interface TokenResponseDTO {
  accessToken: string
  refreshToken: string
  user: {
    id: string
    email: string
    name: string
    role?: string
    type: 'admin' | 'client'
  }
}
