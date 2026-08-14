import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Store } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateStoreDto } from './dto/create-store.dto';
import type { UpdateStoreDto } from './dto/update-store.dto';

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Store[]> {
    return this.prisma.store.findMany({
      orderBy: {
        code: 'asc',
      },
    });
  }

  async create(createStoreDto: CreateStoreDto): Promise<Store> {
    const existingStore = await this.prisma.store.findUnique({
      where: {
        code: createStoreDto.code,
      },
    });

    if (existingStore) {
      throw new ConflictException('Já existe uma loja com este código.');
    }

    return this.prisma.store.create({
      data: {
        code: createStoreDto.code,
        name: createStoreDto.name,
      },
    });
  }

  async update(id: string, updateStoreDto: UpdateStoreDto): Promise<Store> {
    const hasChanges =
      updateStoreDto.code !== undefined ||
      updateStoreDto.name !== undefined ||
      updateStoreDto.isActive !== undefined;

    if (!hasChanges) {
      throw new BadRequestException(
        'Informe ao menos um campo para atualização.',
      );
    }

    const store = await this.prisma.store.findUnique({
      where: {
        id,
      },
    });

    if (!store) {
      throw new NotFoundException('Loja não encontrada.');
    }

    if (
      updateStoreDto.code !== undefined &&
      updateStoreDto.code !== store.code
    ) {
      const storeWithSameCode = await this.prisma.store.findUnique({
        where: {
          code: updateStoreDto.code,
        },
      });

      if (storeWithSameCode) {
        throw new ConflictException('Já existe uma loja com este código.');
      }
    }

    return this.prisma.store.update({
      where: {
        id,
      },
      data: {
        code: updateStoreDto.code,
        name: updateStoreDto.name,
        isActive: updateStoreDto.isActive,
      },
    });
  }
}
