import { UserRole } from './UserRole'

export class User {
  constructor(
    public id: string,
    public email: string,
    public name: string,
    public role: UserRole,
    public companyId: string,
    public passwordHash: string,
    public isActive: boolean,
    public createdAt: Date,
  ) {}

  static create(data: {
    id: string
    email: string
    name: string
    role: UserRole
    companyId: string
    passwordHash: string
    isActive?: boolean
    createdAt?: Date
  }): User {
    if (!data.email || !data.email.includes('@')) {
      throw new Error('Invalid email format')
    }

    if (!Object.values(UserRole).includes(data.role)) {
      throw new Error('Invalid role')
    }

    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Name is required and must not be empty')
    }

    return new User(
      data.id,
      data.email,
      data.name,
      data.role,
      data.companyId,
      data.passwordHash,
      data.isActive ?? true,
      data.createdAt ?? new Date(),
    )
  }

  getIsActive(): boolean {
    return this.isActive
  }
}
