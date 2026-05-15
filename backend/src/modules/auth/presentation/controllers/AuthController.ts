import { Request, Response } from 'express'
import { loginSchema } from '../../application/dtos/LoginDTO'
import { AuthService } from '../../application/services/AuthService'

export class AuthController {
  constructor(private authService: AuthService) {}

  async login(req: Request, res: Response) {
    const dto = loginSchema.parse(req.body)

    const result =
      dto.userType === 'admin'
        ? await this.authService.loginAdmin(dto)
        : await this.authService.loginClient(dto)

    res.json(result)
  }

  async loginClientByToken(req: Request, res: Response) {
    const slug = String(req.body.token || req.body.slug || req.query.token || '').trim()
    if (!slug) {
      return res.status(400).json({ error: 'Approval token required' })
    }

    const result = await this.authService.loginClientByToken(slug)
    res.json(result)
  }

  logout(req: Request, res: Response) {
    res.json({ message: 'Logged out successfully' })
  }

  async refresh(req: Request, res: Response) {
    const { refreshToken } = req.body
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' })
    }
    const result = await this.authService.refreshToken(refreshToken)
    res.json(result)
  }
}
