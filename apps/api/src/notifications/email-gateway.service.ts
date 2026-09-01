import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

@Injectable()
export class EmailGatewayService {
  private readonly enabled: boolean;
  private readonly from: string | null;
  private readonly transporter: Transporter | null;

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.getBoolean('MAIL_ENABLED', false);

    if (!this.enabled) {
      this.from = null;
      this.transporter = null;
      return;
    }

    const host = this.configService.getOrThrow<string>('SMTP_HOST');
    const port = this.getNumber('SMTP_PORT', 587);
    const secure = this.getBoolean('SMTP_SECURE', port === 465);
    const user = this.configService.get<string>('SMTP_USER')?.trim();
    const password = this.configService.get<string>('SMTP_PASSWORD');

    this.from = this.configService.getOrThrow<string>('MAIL_FROM');
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && password ? { user, pass: password } : undefined,
    });
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async send(message: EmailMessage): Promise<void> {
    if (!this.transporter || !this.from) {
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }

  private getBoolean(key: string, fallback: boolean): boolean {
    const value = this.configService.get<string>(key);

    if (value === undefined) {
      return fallback;
    }

    return value.trim().toLowerCase() === 'true';
  }

  private getNumber(key: string, fallback: number): number {
    const value = Number(this.configService.get<string>(key));

    return Number.isInteger(value) && value > 0 ? value : fallback;
  }
}
