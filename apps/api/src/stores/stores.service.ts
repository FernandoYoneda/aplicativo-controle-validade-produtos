import { Injectable } from '@nestjs/common';
import type { Store } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
}
