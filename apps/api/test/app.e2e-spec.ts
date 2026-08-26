import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { UserRole } from '../generated/prisma/enums';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface LoginBody {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: UserBody;
}

interface UserBody {
  id: string;
  name: string;
  email: string;
  login: string;
  role: 'ADMIN' | 'STORE_USER';
  storeId: string | null;
  isActive: boolean;
}

interface StoreBody {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

interface ProductBody {
  id: string;
  code: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  isActive: boolean;
}

interface ProductPageBody {
  items: ProductBody[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  summary: {
    totalProducts: number;
    activeProducts: number;
    inactiveProducts: number;
  };
}

interface ProductImportBody {
  summary: {
    totalRows: number;
    duplicateRows: number;
    excludedProducts: number;
    importableProducts: number;
  };
  importedProducts?: number;
}

interface ExpirationBody {
  id: string;
  batchNumber: string | null;
  expirationDate: string;
  quantity: number;
  notes: string | null;
  isActive: boolean;
  storeProduct: {
    store: StoreBody;
    product: ProductBody;
  };
}

interface ExpirationPageBody {
  items: ExpirationBody[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  summary: {
    totalRecords: number;
    expiredRecords: number;
    upcomingRecords: number;
    inactiveRecords: number;
  };
}

describe('API (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication<App>;
  let prisma: PrismaService;

  const key = Date.now().toString(36).slice(-6).toLowerCase();
  const storeCodeA = `E2EA${key}`.toUpperCase();
  const storeCodeB = `E2EB${key}`.toUpperCase();
  const productCode = `E2EP${key}`.toUpperCase();
  const updatedProductCode = `E2EU${key}`.toUpperCase();
  const importedProductCode = Date.now().toString().slice(-10);
  const barcode = `789${Date.now().toString().slice(-10)}`;
  const adminLogin = `e2e.admin.${key}`;
  const userLoginA = `e2e.store.a.${key}`;
  const userLoginB = `e2e.store.b.${key}`;
  const password = 'E2e-Teste-2026!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    await prisma.user.create({
      data: {
        name: 'Administrador E2E',
        email: `${adminLogin}@validade.local`,
        login: adminLogin,
        passwordHash,
        role: UserRole.ADMIN,
      },
    });
  });

  afterAll(async () => {
    if (!prisma) return;

    try {
      await prisma.productLot.deleteMany({
        where: {
          storeProduct: {
            product: { code: { in: [productCode, updatedProductCode] } },
          },
        },
      });
      await prisma.storeProduct.deleteMany({
        where: {
          OR: [
            {
              product: { code: { in: [productCode, updatedProductCode] } },
            },
            { store: { code: { in: [storeCodeA, storeCodeB] } } },
          ],
        },
      });
      await prisma.user.deleteMany({
        where: { login: { in: [adminLogin, userLoginA, userLoginB] } },
      });
      await prisma.product.deleteMany({
        where: {
          code: {
            in: [productCode, updatedProductCode, importedProductCode],
          },
        },
      });
      await prisma.store.deleteMany({
        where: { code: { in: [storeCodeA, storeCodeB] } },
      });
    } finally {
      await app.close();
    }
  });

  it('returns the health response', async () => {
    await request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('protects every administrative resource', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
    await request(app.getHttpServer()).get('/stores').expect(401);
    await request(app.getHttpServer()).get('/users').expect(401);
    await request(app.getHttpServer()).get('/products').expect(401);
    await request(app.getHttpServer()).get('/products/page').expect(401);
    await request(app.getHttpServer()).get('/products/search').expect(401);
    await request(app.getHttpServer()).get('/expirations').expect(401);
    await request(app.getHttpServer()).get('/expirations/page').expect(401);
  });

  it('covers the administrator and store-user journeys', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: adminLogin, password: 'senha-incorreta' })
      .expect(401);

    const adminLoginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: `  ${adminLogin.toUpperCase()}  `, password })
      .expect(200);
    const adminSession = adminLoginResponse.body as LoginBody;
    const adminToken = adminSession.accessToken;

    expect(adminSession.tokenType).toBe('Bearer');
    expect(adminSession.expiresIn).toBeGreaterThan(0);
    expect(adminSession.accessToken.length).toBeGreaterThan(0);
    expect(adminSession.user.login).toBe(adminLogin);
    expect(adminSession.user.role).toBe('ADMIN');
    expect(adminSession.user.storeId).toBeNull();

    const meResponse = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((meResponse.body as UserBody).id).toBe(adminSession.user.id);

    await request(app.getHttpServer())
      .post('/stores')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'inválido', name: 'Loja inválida', extra: true })
      .expect(400);

    const storeAResponse = await request(app.getHttpServer())
      .post('/stores')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `  ${storeCodeA.toLowerCase()}  `, name: '  Loja E2E A  ' })
      .expect(201);
    const storeA = storeAResponse.body as StoreBody;
    expect(storeA).toEqual(
      expect.objectContaining({
        code: storeCodeA,
        name: 'Loja E2E A',
        isActive: true,
      }),
    );

    const storeBResponse = await request(app.getHttpServer())
      .post('/stores')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: storeCodeB.toLowerCase(), name: 'Loja E2E B' })
      .expect(201);
    const storeB = storeBResponse.body as StoreBody;

    const storesResponse = await request(app.getHttpServer())
      .get('/stores')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const stores = storesResponse.body as StoreBody[];
    expect(stores.some(({ id }) => id === storeA.id)).toBe(true);
    expect(stores.some(({ id }) => id === storeB.id)).toBe(true);

    const storeUpdateResponse = await request(app.getHttpServer())
      .patch(`/stores/${storeA.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '  Loja E2E A Atualizada  ' })
      .expect(200);
    expect((storeUpdateResponse.body as StoreBody).name).toBe(
      'Loja E2E A Atualizada',
    );

    const userAResponse = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: '  Usuário E2E A  ',
        email: `  ${userLoginA.toUpperCase()}@VALIDADE.LOCAL  `,
        login: `  ${userLoginA.toUpperCase()}  `,
        password,
        storeId: storeA.id,
      })
      .expect(201);
    const userA = userAResponse.body as UserBody;
    expect(userA).toEqual(
      expect.objectContaining({
        name: 'Usuário E2E A',
        email: `${userLoginA}@validade.local`,
        login: userLoginA,
        role: 'STORE_USER',
        storeId: storeA.id,
        isActive: true,
      }),
    );
    expect(userA).not.toHaveProperty('passwordHash');

    const userBResponse = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Usuário E2E B',
        email: `${userLoginB}@validade.local`,
        login: userLoginB,
        password,
        storeId: storeB.id,
      })
      .expect(201);
    const userB = userBResponse.body as UserBody;

    const usersResponse = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const users = usersResponse.body as UserBody[];
    expect(users.some(({ id }) => id === userA.id)).toBe(true);
    expect(users.some(({ id }) => id === userB.id)).toBe(true);

    const productResponse = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `  ${productCode.toLowerCase()}  `,
        barcode: `  ${barcode}  `,
        name: '  Produto E2E Temporário  ',
        brand: '  CasaBella E2E  ',
        category: '  Testes automatizados  ',
      })
      .expect(201);
    const product = productResponse.body as ProductBody;
    expect(product).toEqual(
      expect.objectContaining({
        code: productCode,
        barcode,
        name: 'Produto E2E Temporário',
        brand: 'CasaBella E2E',
        category: 'Testes automatizados',
        isActive: true,
      }),
    );

    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: productCode, name: 'Produto duplicado' })
      .expect(409);

    const productsResponse = await request(app.getHttpServer())
      .get('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      (productsResponse.body as ProductBody[]).some(
        ({ id }) => id === product.id,
      ),
    ).toBe(true);

    const productPageResponse = await request(app.getHttpServer())
      .get('/products/page')
      .query({ page: 1, pageSize: 1, search: productCode.toLowerCase() })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const productPage = productPageResponse.body as ProductPageBody;
    expect(productPage.items).toHaveLength(1);
    expect(productPage.items[0]?.id).toBe(product.id);
    expect(productPage.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 1,
        totalItems: 1,
        totalPages: 1,
      }),
    );
    expect(productPage.summary.totalProducts).toBeGreaterThanOrEqual(1);

    const adminProductSearchResponse = await request(app.getHttpServer())
      .get('/products/search')
      .query({ search: productCode.toLowerCase(), limit: 20 })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      (adminProductSearchResponse.body as ProductBody[]).map(({ id }) => id),
    ).toContain(product.id);

    const importFile = Buffer.from(
      [
        'Quebra 1;Estoque',
        `${importedProductCode} - Produto importado E2E;2`,
        `${importedProductCode} - Produto importado E2E;4`,
        '99999999 - SACOLA OPERACIONAL;1',
      ].join('\n'),
      'utf8',
    );
    const importPreviewResponse = await request(app.getHttpServer())
      .post('/products/import/preview')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', importFile, {
        filename: 'produtos-e2e.csv',
        contentType: 'text/csv',
      })
      .expect(201);
    const importPreview = importPreviewResponse.body as ProductImportBody;
    expect(importPreview.summary).toEqual(
      expect.objectContaining({
        totalRows: 3,
        duplicateRows: 1,
        excludedProducts: 1,
        importableProducts: 1,
      }),
    );

    const importResponse = await request(app.getHttpServer())
      .post('/products/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', importFile, {
        filename: 'produtos-e2e.csv',
        contentType: 'text/csv',
      })
      .expect(201);
    expect((importResponse.body as ProductImportBody).importedProducts).toBe(1);

    const loginAResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: userLoginA, password })
      .expect(200);
    const sessionA = loginAResponse.body as LoginBody;
    expect(sessionA.user.storeId).toBe(storeA.id);

    const loginBResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: userLoginB, password })
      .expect(200);
    const sessionB = loginBResponse.body as LoginBody;
    expect(sessionB.user.storeId).toBe(storeB.id);

    const tokenA = sessionA.accessToken;
    const tokenB = sessionB.accessToken;

    await request(app.getHttpServer())
      .get('/products')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const storeProductSearchResponse = await request(app.getHttpServer())
      .get('/products/search')
      .query({ search: productCode, limit: 20 })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(
      (storeProductSearchResponse.body as ProductBody[]).map(({ id }) => id),
    ).toContain(product.id);
    await request(app.getHttpServer())
      .get('/products/page')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);
    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ code: `NO${key}`.toUpperCase(), name: 'Sem permissão' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/products/import/preview')
      .set('Authorization', `Bearer ${tokenA}`)
      .attach('file', importFile, {
        filename: 'produtos-e2e.csv',
        contentType: 'text/csv',
      })
      .expect(403);
    await request(app.getHttpServer())
      .get('/stores')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/expirations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productId: product.id,
        expirationDate: '2030-09-30',
        quantity: 2,
      })
      .expect(400);
    await request(app.getHttpServer())
      .post('/expirations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productId: product.id,
        storeId: storeA.id,
        expirationDate: '30/09/2030',
        quantity: 0,
      })
      .expect(400);

    const expirationAResponse = await request(app.getHttpServer())
      .post('/expirations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productId: product.id,
        storeId: storeA.id,
        batchNumber: '  LOTE-E2E-ADMIN  ',
        expirationDate: '2030-09-30',
        quantity: '5',
        notes: '  Criado pelo administrador  ',
      })
      .expect(201);
    const expirationA = expirationAResponse.body as ExpirationBody;
    expect(expirationA).toEqual(
      expect.objectContaining({
        batchNumber: 'LOTE-E2E-ADMIN',
        expirationDate: '2030-09-30T00:00:00.000Z',
        quantity: 5,
        notes: 'Criado pelo administrador',
        isActive: true,
      }),
    );
    expect(expirationA.storeProduct.store.id).toBe(storeA.id);

    await request(app.getHttpServer())
      .post('/expirations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        productId: product.id,
        storeId: storeB.id,
        expirationDate: '2031-01-10',
        quantity: 1,
      })
      .expect(403);

    const ownAResponse = await request(app.getHttpServer())
      .post('/expirations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        productId: product.id,
        batchNumber: '  LOTE-E2E-A  ',
        expirationDate: '2031-01-10',
        quantity: 3,
      })
      .expect(201);
    const ownA = ownAResponse.body as ExpirationBody;
    expect(ownA.storeProduct.store.id).toBe(storeA.id);

    const ownBResponse = await request(app.getHttpServer())
      .post('/expirations')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        productId: product.id,
        batchNumber: 'LOTE-E2E-B',
        expirationDate: '2032-02-20',
        quantity: 7,
      })
      .expect(201);
    const ownB = ownBResponse.body as ExpirationBody;
    expect(ownB.storeProduct.store.id).toBe(storeB.id);

    const listAResponse = await request(app.getHttpServer())
      .get('/expirations')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const listA = listAResponse.body as ExpirationBody[];
    expect(listA).toHaveLength(2);
    expect(
      listA.every(({ storeProduct }) => storeProduct.store.id === storeA.id),
    ).toBe(true);

    const pageAResponse = await request(app.getHttpServer())
      .get('/expirations/page')
      .query({
        page: 1,
        pageSize: 1,
        search: 'lote-e2e-admin',
        status: 'all',
      })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const pageA = pageAResponse.body as ExpirationPageBody;
    expect(pageA.items).toHaveLength(1);
    expect(pageA.items[0]?.id).toBe(expirationA.id);
    expect(pageA.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 1,
        totalItems: 1,
        totalPages: 1,
      }),
    );
    expect(pageA.summary.totalRecords).toBe(2);

    await request(app.getHttpServer())
      .get('/expirations/page')
      .query({ storeId: storeB.id })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);

    const listBResponse = await request(app.getHttpServer())
      .get('/expirations')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    const listB = listBResponse.body as ExpirationBody[];
    expect(listB).toHaveLength(1);
    expect(listB[0].id).toBe(ownB.id);

    await request(app.getHttpServer())
      .patch(`/expirations/${expirationA.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ quantity: 99 })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/expirations/${expirationA.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .patch('/expirations/identificador-invalido')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ quantity: 1 })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/expirations/${randomUUID()}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ quantity: 1 })
      .expect(404);

    const expirationUpdateResponse = await request(app.getHttpServer())
      .patch(`/expirations/${expirationA.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        batchNumber: '   ',
        expirationDate: '2033-03-15',
        quantity: '9',
        notes: '   ',
        isActive: false,
      })
      .expect(200);
    const updatedExpiration = expirationUpdateResponse.body as ExpirationBody;
    expect(updatedExpiration).toEqual(
      expect.objectContaining({
        batchNumber: null,
        expirationDate: '2033-03-15T00:00:00.000Z',
        quantity: 9,
        notes: null,
        isActive: false,
      }),
    );
    expect(updatedExpiration.storeProduct.store.id).toBe(storeA.id);

    const adminListResponse = await request(app.getHttpServer())
      .get('/expirations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const adminList = adminListResponse.body as ExpirationBody[];
    expect(adminList.map(({ id }) => id)).toEqual(
      expect.arrayContaining([expirationA.id, ownA.id, ownB.id]),
    );

    const adminPageResponse = await request(app.getHttpServer())
      .get('/expirations/page')
      .query({
        page: 1,
        pageSize: 25,
        search: productCode,
        status: 'all',
        storeId: storeB.id,
      })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const adminPage = adminPageResponse.body as ExpirationPageBody;
    expect(adminPage.items.map(({ id }) => id)).toEqual([ownB.id]);
    expect(adminPage.summary.totalRecords).toBe(1);

    const productUpdateResponse = await request(app.getHttpServer())
      .patch(`/products/${product.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: updatedProductCode.toLowerCase(),
        barcode: '   ',
        name: '  Produto E2E Atualizado  ',
        brand: '   ',
        category: '  Qualidade  ',
        isActive: false,
      })
      .expect(200);
    const updatedProduct = productUpdateResponse.body as ProductBody;
    expect(updatedProduct).toEqual(
      expect.objectContaining({
        code: updatedProductCode,
        barcode: null,
        name: 'Produto E2E Atualizado',
        brand: null,
        category: 'Qualidade',
        isActive: false,
      }),
    );

    const userUpdateResponse = await request(app.getHttpServer())
      .patch(`/users/${userA.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '  Usuário E2E A Atualizado  ', isActive: false })
      .expect(200);
    const updatedUser = userUpdateResponse.body as UserBody;
    expect(updatedUser.name).toBe('Usuário E2E A Atualizado');
    expect(updatedUser.isActive).toBe(false);
  });
});
