import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Prisma } from '../../generated/prisma/client';
import {
  ExpirationEmailDeliveryStatus,
  ExpirationEmailNotificationType,
  ProductLotWriteOffReason,
  UserRole,
} from '../../generated/prisma/enums';
import type { ExpirationWriteOffRecord } from '../expirations/expiration-write-off.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  EmailGatewayService,
  type EmailMessage,
} from './email-gateway.service';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const notificationExpirationSelect = {
  id: true,
  batchNumber: true,
  expirationDate: true,
  quantity: true,
  storeProduct: {
    select: {
      store: { select: { id: true, code: true, name: true } },
      product: { select: { code: true, name: true } },
    },
  },
} satisfies Prisma.ProductLotSelect;

type NotificationExpiration = Prisma.ProductLotGetPayload<{
  select: typeof notificationExpirationSelect;
}>;

interface Recipient {
  name: string;
  email: string;
}

interface DeliveryRequest {
  notificationType: ExpirationEmailNotificationType;
  fingerprint: string;
  recipient: Recipient;
  subject: string;
  productLotId?: string;
  writeOffId?: string;
  message: EmailMessage;
}

@Injectable()
export class ExpirationNotificationsService {
  private readonly logger = new Logger(ExpirationNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailGateway: EmailGatewayService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM, {
    timeZone: 'America/Sao_Paulo',
  })
  async handleDailyExpirationAlerts(): Promise<void> {
    const sent = await this.sendExpirationAlerts();

    if (sent > 0) {
      this.logger.log(`${sent} alerta(s) de validade enviado(s).`);
    }
  }

  async sendExpirationAlerts(referenceDate = new Date()): Promise<number> {
    if (!this.emailGateway.isEnabled()) {
      return 0;
    }

    const today = this.getSaoPauloDate(referenceDate);
    const upcomingLimit = new Date(today);
    upcomingLimit.setUTCDate(upcomingLimit.getUTCDate() + 30);
    const expirations = await this.prisma.productLot.findMany({
      where: {
        isActive: true,
        quantity: { gt: 0 },
        expirationDate: { lte: upcomingLimit },
        storeProduct: {
          isActive: true,
          store: { isActive: true },
          product: { isActive: true },
        },
      },
      select: notificationExpirationSelect,
      orderBy: [{ expirationDate: 'asc' }, { createdAt: 'asc' }],
    });
    let sent = 0;

    for (const expiration of expirations) {
      const recipients = await this.findExpirationRecipients(
        expiration.storeProduct.store.id,
      );

      for (const recipient of recipients) {
        const request = this.createExpirationDelivery(
          expiration,
          recipient,
          today,
        );

        if (await this.deliver(request)) {
          sent += 1;
        }
      }
    }

    return sent;
  }

  async notifyWriteOff(writeOff: ExpirationWriteOffRecord): Promise<number> {
    if (!this.emailGateway.isEnabled()) {
      return 0;
    }

    const administrators = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN, isActive: true },
      select: { name: true, email: true },
      orderBy: { name: 'asc' },
    });
    const notificationType = this.getWriteOffNotificationType(writeOff.reason);
    const reasonLabel = this.getWriteOffReasonLabel(writeOff.reason);
    const product = writeOff.productLot.storeProduct.product;
    const store = writeOff.productLot.storeProduct.store;
    const subject = `[Validade] Baixa por ${reasonLabel.toLowerCase()}: ${product.code} — ${product.name}`;
    let sent = 0;

    for (const recipient of this.uniqueRecipients(administrators)) {
      const text = [
        `Olá, ${recipient.name}.`,
        '',
        `Foi registrada uma baixa por ${reasonLabel.toLowerCase()}.`,
        `Produto: ${product.code} — ${product.name}`,
        `Loja: ${store.code} — ${store.name}`,
        `Quantidade baixada: ${writeOff.quantity}`,
        `Saldo: ${writeOff.previousQuantity} → ${writeOff.remainingQuantity}`,
        `Responsável: ${writeOff.performedBy.name}`,
        writeOff.notes ? `Observação: ${writeOff.notes}` : '',
      ]
        .filter(Boolean)
        .join('\n');
      const html = this.toHtml(text);

      if (
        await this.deliver({
          notificationType,
          fingerprint: `write-off:${writeOff.id}:${recipient.email.toLowerCase()}`,
          recipient,
          subject,
          writeOffId: writeOff.id,
          productLotId: writeOff.productLot.id,
          message: { to: recipient.email, subject, text, html },
        })
      ) {
        sent += 1;
      }
    }

    return sent;
  }

  private async findExpirationRecipients(
    storeId: string,
  ): Promise<Recipient[]> {
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        OR: [{ role: UserRole.ADMIN }, { role: UserRole.STORE_USER, storeId }],
      },
      select: { name: true, email: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    return this.uniqueRecipients(users);
  }

  private createExpirationDelivery(
    expiration: NotificationExpiration,
    recipient: Recipient,
    today: Date,
  ): DeliveryRequest {
    const days = Math.round(
      (expiration.expirationDate.getTime() - today.getTime()) /
        MILLISECONDS_PER_DAY,
    );
    const expired = days < 0;
    const notificationType = expired
      ? ExpirationEmailNotificationType.EXPIRATION_EXPIRED
      : ExpirationEmailNotificationType.EXPIRATION_NEXT_30_DAYS;
    const situation = expired
      ? `está vencido há ${Math.abs(days)} dia(s)`
      : days === 0
        ? 'vence hoje'
        : `vence em ${days} dia(s)`;
    const product = expiration.storeProduct.product;
    const store = expiration.storeProduct.store;
    const subject = `[Validade] ${product.code} — ${product.name} ${situation}`;
    const text = [
      `Olá, ${recipient.name}.`,
      '',
      `O produto ${product.code} — ${product.name} ${situation}.`,
      `Loja: ${store.code} — ${store.name}`,
      `Validade: ${this.formatDate(expiration.expirationDate)}`,
      `Lote: ${expiration.batchNumber ?? 'não informado'}`,
      `Quantidade: ${expiration.quantity}`,
      '',
      'Acesse o sistema para consultar o registro ou realizar a baixa.',
    ].join('\n');

    return {
      notificationType,
      fingerprint: `expiration:${notificationType}:${expiration.id}:${recipient.email.toLowerCase()}`,
      recipient,
      subject,
      productLotId: expiration.id,
      message: {
        to: recipient.email,
        subject,
        text,
        html: this.toHtml(text),
      },
    };
  }

  private async deliver(request: DeliveryRequest): Promise<boolean> {
    let deliveryId: string;

    try {
      const existing = await this.prisma.expirationEmailDelivery.findUnique({
        where: { fingerprint: request.fingerprint },
        select: { id: true, status: true },
      });

      if (
        existing?.status === ExpirationEmailDeliveryStatus.SENT ||
        existing?.status === ExpirationEmailDeliveryStatus.PENDING
      ) {
        return false;
      }

      if (existing) {
        const delivery = await this.prisma.expirationEmailDelivery.update({
          where: { id: existing.id },
          data: {
            status: ExpirationEmailDeliveryStatus.PENDING,
            errorMessage: null,
          },
          select: { id: true },
        });
        deliveryId = delivery.id;
      } else {
        const delivery = await this.prisma.expirationEmailDelivery.create({
          data: {
            notificationType: request.notificationType,
            fingerprint: request.fingerprint,
            recipientName: request.recipient.name,
            recipientEmail: request.recipient.email,
            subject: request.subject,
            productLotId: request.productLotId,
            writeOffId: request.writeOffId,
          },
          select: { id: true },
        });
        deliveryId = delivery.id;
      }
    } catch (error: unknown) {
      if (this.hasPrismaErrorCode(error, 'P2002')) {
        return false;
      }

      this.logger.error('Não foi possível reservar o envio do e-mail.', error);
      return false;
    }

    try {
      await this.emailGateway.send(request.message);
      await this.prisma.expirationEmailDelivery.update({
        where: { id: deliveryId },
        data: {
          status: ExpirationEmailDeliveryStatus.SENT,
          sentAt: new Date(),
          errorMessage: null,
        },
      });
      return true;
    } catch (error: unknown) {
      const errorMessage = this.getErrorMessage(error).slice(0, 1000);
      await this.prisma.expirationEmailDelivery.update({
        where: { id: deliveryId },
        data: {
          status: ExpirationEmailDeliveryStatus.FAILED,
          errorMessage,
        },
      });
      this.logger.error(
        `Falha ao enviar e-mail para ${request.recipient.email}: ${errorMessage}`,
      );
      return false;
    }
  }

  private getWriteOffNotificationType(
    reason: ProductLotWriteOffReason,
  ): ExpirationEmailNotificationType {
    const types: Record<
      ProductLotWriteOffReason,
      ExpirationEmailNotificationType
    > = {
      [ProductLotWriteOffReason.SOLD]:
        ExpirationEmailNotificationType.WRITE_OFF_SOLD,
      [ProductLotWriteOffReason.EXPIRED]:
        ExpirationEmailNotificationType.WRITE_OFF_EXPIRED,
      [ProductLotWriteOffReason.DISCARDED]:
        ExpirationEmailNotificationType.WRITE_OFF_DISCARDED,
    };

    return types[reason];
  }

  private getWriteOffReasonLabel(reason: ProductLotWriteOffReason): string {
    const labels: Record<ProductLotWriteOffReason, string> = {
      [ProductLotWriteOffReason.SOLD]: 'Vendido',
      [ProductLotWriteOffReason.EXPIRED]: 'Vencido',
      [ProductLotWriteOffReason.DISCARDED]: 'Descartado',
    };

    return labels[reason];
  }

  private uniqueRecipients(recipients: Recipient[]): Recipient[] {
    const unique = new Map<string, Recipient>();

    for (const recipient of recipients) {
      unique.set(recipient.email.trim().toLowerCase(), recipient);
    }

    return [...unique.values()];
  }

  private getSaoPauloDate(referenceDate: Date): Date {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(referenceDate);
    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );

    return new Date(
      Date.UTC(
        Number(values.year),
        Number(values.month) - 1,
        Number(values.day),
      ),
    );
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date);
  }

  private toHtml(text: string): string {
    const escaped = text
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');

    return `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#173f45">${escaped.replaceAll('\n', '<br>')}</div>`;
  }

  private hasPrismaErrorCode(error: unknown, code: string): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === code
    );
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error
      ? error.message
      : 'Erro desconhecido no envio de e-mail.';
  }
}
