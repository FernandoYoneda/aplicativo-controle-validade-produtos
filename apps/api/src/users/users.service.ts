import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type { Prisma, User } from '../../generated/prisma/client';
import { UserRole } from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  login: true,
  role: true,
  storeId: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  store: {
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
    },
  },
} satisfies Prisma.UserSelect;

export type StoreUserResponse = Prisma.UserGetPayload<{
  select: typeof publicUserSelect;
}>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByLoginOrEmail(identifier: string): Promise<User | null> {
    const normalizedIdentifier = identifier.trim().toLowerCase();

    return this.prisma.user.findFirst({
      where: {
        OR: [{ login: normalizedIdentifier }, { email: normalizedIdentifier }],
      },
    });
  }

  findActiveById(id: string): Promise<User | null> {
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

  findAllStoreUsers(): Promise<StoreUserResponse[]> {
    return this.prisma.user.findMany({
      where: {
        role: UserRole.STORE_USER,
      },
      orderBy: [{ storeId: 'asc' }, { name: 'asc' }],
      select: publicUserSelect,
    });
  }

  async createStoreUser(
    createUserDto: CreateUserDto,
  ): Promise<StoreUserResponse> {
    await this.ensureActiveStore(createUserDto.storeId);
    await this.ensureUniqueCredentials(
      createUserDto.email,
      createUserDto.login,
    );

    const passwordHash = await this.hashPassword(createUserDto.password);

    return this.prisma.user.create({
      data: {
        name: createUserDto.name,
        email: createUserDto.email,
        login: createUserDto.login,
        passwordHash,
        role: UserRole.STORE_USER,
        storeId: createUserDto.storeId,
      },
      select: publicUserSelect,
    });
  }

  async updateStoreUser(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<StoreUserResponse> {
    const hasUpdates = Object.values(updateUserDto).some(
      (value) => value !== undefined,
    );

    if (!hasUpdates) {
      throw new BadRequestException(
        'Informe pelo menos um campo para atualização.',
      );
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        id,
        role: UserRole.STORE_USER,
      },
      select: {
        id: true,
      },
    });

    if (!existingUser) {
      throw new NotFoundException('Usuário da loja não encontrado.');
    }

    if (updateUserDto.storeId !== undefined) {
      await this.ensureActiveStore(updateUserDto.storeId);
    }

    if (
      updateUserDto.email !== undefined ||
      updateUserDto.login !== undefined
    ) {
      await this.ensureUniqueCredentials(
        updateUserDto.email,
        updateUserDto.login,
        id,
      );
    }

    const data: Prisma.UserUncheckedUpdateInput = {};

    if (updateUserDto.name !== undefined) {
      data.name = updateUserDto.name;
    }

    if (updateUserDto.email !== undefined) {
      data.email = updateUserDto.email;
    }

    if (updateUserDto.login !== undefined) {
      data.login = updateUserDto.login;
    }

    if (updateUserDto.storeId !== undefined) {
      data.storeId = updateUserDto.storeId;
    }

    if (updateUserDto.isActive !== undefined) {
      data.isActive = updateUserDto.isActive;
    }

    if (updateUserDto.password !== undefined) {
      data.passwordHash = await this.hashPassword(updateUserDto.password);
    }

    return this.prisma.user.update({
      where: {
        id,
      },
      data,
      select: publicUserSelect,
    });
  }

  private async ensureActiveStore(storeId: string): Promise<void> {
    const store = await this.prisma.store.findFirst({
      where: {
        id: storeId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!store) {
      throw new BadRequestException('Loja não encontrada ou inativa.');
    }
  }

  private async ensureUniqueCredentials(
    email?: string,
    login?: string,
    excludedUserId?: string,
  ): Promise<void> {
    const identifiers: Prisma.UserWhereInput[] = [];

    if (email !== undefined) {
      identifiers.push({ email });
    }

    if (login !== undefined) {
      identifiers.push({ login });
    }

    if (identifiers.length === 0) {
      return;
    }

    const duplicatedUser = await this.prisma.user.findFirst({
      where: {
        ...(excludedUserId
          ? {
              id: {
                not: excludedUserId,
              },
            }
          : {}),
        OR: identifiers,
      },
      select: {
        id: true,
      },
    });

    if (duplicatedUser) {
      throw new ConflictException('E-mail ou login já cadastrado.');
    }
  }

  private hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }
}
