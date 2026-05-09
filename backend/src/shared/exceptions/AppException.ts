export class AppException extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
  ) {
    super(message)
    this.name = 'AppException'
  }
}

export class NotFoundException extends AppException {
  constructor(message: string = 'Not found') {
    super(message, 404, 'NOT_FOUND')
  }
}

export class BadRequestException extends AppException {
  constructor(message: string = 'Bad request') {
    super(message, 400, 'BAD_REQUEST')
  }
}

export class UnauthorizedException extends AppException {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED')
  }
}

export class ForbiddenException extends AppException {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN')
  }
}
