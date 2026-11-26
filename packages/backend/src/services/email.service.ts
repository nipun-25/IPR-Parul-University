
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { BackendEnv } from '../config/env.config.js';
import { logger } from '../config/logger.config.js';

export class EmailService {
    private readonly transporter: Transporter;
    private readonly sender: string;

    constructor(env: BackendEnv) {
        this.sender = env.SMTP_USER;

        this.transporter = nodemailer.createTransport({
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            secure: env.SMTP_PORT === 465,
            auth: {
                user: env.SMTP_USER,
                pass: env.SMTP_PASSWORD
            }
        });
    }

    async verifyConnection(): Promise<void> {
        await this.transporter.verify();
        logger.info('Email SMTP connection verified successfully');
    }

    async sendEmail(
        to: string,
        subject: string,
        text: string,
        html?: string
    ): Promise<void> {
        try {
            await this.transporter.sendMail({
                from: this.sender,
                to,
                subject,
                text,
                ...(html ? { html } : {})
            });

            logger.info({ recipient: to }, 'Email sent successfully');
        } catch (error) {
            logger.error({ err: error }, 'Failed to send email');
            throw new Error('EMAIL_DELIVERY_FAILED');
        }
    }
}
