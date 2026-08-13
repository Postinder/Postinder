import bcryptjs from 'bcryptjs'
import { UnauthorizedException, ForbiddenException } from '../../../../shared/exceptions/AppException'
import { UserRepository } from '../../infrastructure/repositories/UserRepository'
import { JwtProvider } from '../../infrastructure/JwtProvider'
import { LoginDTO } from '../dtos/LoginDTO'
import { TokenResponseDTO } from '../dtos/TokenResponseDTO'
import { env } from '../../../../config/environment'
import { isAdminRefreshToken, isClientRefreshToken } from '../../domain/AuthToken'

export class AuthService {
  constructor(
    private jwtProvider: JwtProvider,
    private userRepository: UserRepository,
  ) {}

  async loginAdmin(dto: LoginDTO): Promise<TokenResponseDTO> {
    const user = await this.userRepository.findByEmail(dto.email)
    if (!user || !user.password_hash) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const valid = await bcryptjs.compare(dto.password, user.password_hash)
    if (!valid) throw new UnauthorizedException('Invalid credentials')

    return this.buildAdminTokens(user)
  }

  async loginClient(dto: LoginDTO): Promise<TokenResponseDTO> {
    const client = await this.userRepository.findClientByEmail(dto.email)
    if (!client) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const valid = await bcryptjs.compare(dto.password, client.password_hash)
    if (!valid) throw new UnauthorizedException('Invalid credentials')

    await this.userRepository.updateClientLastAccess(client.id).catch(() => {})

    return this.buildClientTokens(client)
  }

  async refreshToken(refreshToken: string): Promise<TokenResponseDTO> {
    try {
      const decoded = this.jwtProvider.verify(refreshToken)

      if (isAdminRefreshToken(decoded)) {
        const user = await this.userRepository.findByEmail(decoded.email)
        if (!user || user.id !== decoded.userId) {
          throw new UnauthorizedException('User not found')
        }
        return this.buildAdminTokens(user)
      }

      if (isClientRefreshToken(decoded)) {
        const client = await this.userRepository.findClientById(decoded.clientId)
        if (!client) throw new UnauthorizedException('Client not found')
        return this.buildClientTokens(client)
      }

      throw new UnauthorizedException('Invalid token payload')
    } catch {
      throw new UnauthorizedException('Token refresh failed')
    }
  }

  private buildAdminTokens(user: any): TokenResponseDTO {
    const role = String(user.role || '').trim().toLowerCase()
    const accessToken = this.jwtProvider.sign(
      { userId: user.id, email: user.email, companyId: user.company_id ?? null, role, permissions: user.permissions || [], type: 'admin' },
      `${env.JWT_EXPIRY_MINUTES}m`,
    )
    const refreshToken = this.jwtProvider.sign(
      { userId: user.id, email: user.email, type: 'refresh', context: 'admin' },
      `${env.JWT_REFRESH_EXPIRY_DAYS}d`,
    )
    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name, role, permissions: user.permissions || [], type: 'admin' },
    }
  }

  private buildClientTokens(client: any): TokenResponseDTO {
    const accessToken = this.jwtProvider.sign(
      { clientId: client.id, email: client.email, companyId: client.company_id ?? null, type: 'client' },
      `${env.JWT_EXPIRY_MINUTES}m`,
    )
    const refreshToken = this.jwtProvider.sign(
      { clientId: client.id, type: 'refresh', context: 'client' },
      `${env.JWT_REFRESH_EXPIRY_DAYS}d`,
    )
    return {
      accessToken,
      refreshToken,
      user: { id: client.id, email: client.email, name: client.name, type: 'client' },
    }
  }
}
