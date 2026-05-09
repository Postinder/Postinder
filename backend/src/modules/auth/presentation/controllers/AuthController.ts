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

  logout(req: Request, res: Response) {
    res.json({ message: 'Logged out successfully' })
  }
}
