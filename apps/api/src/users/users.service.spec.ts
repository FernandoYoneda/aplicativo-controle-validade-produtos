import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  const prismaServiceMock = {
    user: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should find a user by normalized login or email', async () => {
    prismaServiceMock.user.findFirst.mockResolvedValue(null);

    await service.findByLoginOrEmail(' ADMIN@VALIDADE.LOCAL ');

    expect(prismaServiceMock.user.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { login: 'admin@validade.local' },
          { email: 'admin@validade.local' },
        ],
      },
    });
  });

  it('should find only an active user by id', async () => {
    prismaServiceMock.user.findFirst.mockResolvedValue(null);

    await service.findActiveById('user-id');

    expect(prismaServiceMock.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'user-id',
        isActive: true,
      },
    });
  });

  it('should update the last login date', async () => {
    const currentDate = new Date('2026-08-10T12:00:00.000Z');

    jest.useFakeTimers();
    jest.setSystemTime(currentDate);
    prismaServiceMock.user.update.mockResolvedValue({});

    try {
      await service.updateLastLoginAt('user-id');

      expect(prismaServiceMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: {
          lastLoginAt: currentDate,
        },
      });
    } finally {
      jest.useRealTimers();
    }
  });
});
