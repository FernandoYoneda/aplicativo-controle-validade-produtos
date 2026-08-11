import { Injectable } from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByLoginOrEmail(identifier: string): Promise<User | null> {
    const normalizedIdentifier = identifier.trim().toLowerCase();

    return this.prisma.user.findFirst({
      where: {
        OR: [{ login: normalizedIdentifier }, { email: normalizedIdentifier }],
      },
    });
  }

  async findActiveById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        id,
        isActive: true,
      },
    });
  }

  async updateLastLoginAt(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        lastLoginAt: new Date(),
      },
    });
  }
}
