import bcryptjs from 'bcryptjs'
import { UnauthorizedException, ForbiddenException, NotFoundException } from '../../../shared/exceptions/AppException'
import { supabase } from '../../../shared/database/supabase'
import { JwtProvider } from '../../infrastructure/JwtProvider'
import { LoginDTO, TokenResponseDTO } from '../dtos'
import { env } from '../../../config/environment'

export class AuthService {
  constructor(private jwtProvider: JwtProvider) {}

  async loginAdmin(dto: LoginDTO): Promise<TokenResponseDTO> {
    if (dto.userType !== 'admin') {
      throw new ForbiddenException('Invalid user type')
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', dto.email)
      .eq('is_active', true)
      .single()

    if (error || !user) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const passwordValid = await bcryptjs.compare(dto.password, user.password_hash)
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials')
    }

    return this.generateTokens(user, 'admin')
  }

  async loginClient(dto: LoginDTO): Promise<TokenResponseDTO> {
    if (dto.userType !== 'client') {
      throw new ForbiddenException('Invalid user type')
    }

    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('email', dto.email)
      .eq('is_active', true)
      .single()

    if (error || !client) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const passwordValid = await bcryptjs.compare(dto.password, client.password_hash)
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials')
    }

    return this.generateClientTokens(client)
  }

  private generateTokens(user: any, type: string): TokenResponseDTO {
    const accessToken = this.jwtProvider.sign(
      { userId: user.id, email: user.email, companyId: user.company_id, role: user.role, type },
      `${env.JWT_EXPIRY_MINUTES}m`,
    )

    const refreshToken = this.jwtProvider.sign(
      { userId: user.id, type: 'refresh' },
      `${env.JWT_REFRESH_EXPIRY_DAYS}d`,
    )

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        type,
      },
    }
  }

  private generateClientTokens(client: any): TokenResponseDTO {
    const accessToken = this.jwtProvider.sign(
      { clientId: client.id, email: client.email, companyId: client.company_id, type: 'client' },
      `${env.JWT_EXPIRY_MINUTES}m`,
    )

    const refreshToken = this.jwtProvider.sign(
      { clientId: client.id, type: 'refresh' },
      `${env.JWT_REFRESH_EXPIRY_DAYS}d`,
    )

    return {
      accessToken,
      refreshToken,
      user: {
        id: client.id,
        email: client.email,
        name: client.name,
        type: 'client',
      },
    }
  }
}
