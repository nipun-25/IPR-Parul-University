import 'dotenv/config';
import { getEnv } from '../config/env.config.js';
import { EmailService } from '../services/email.service.js';

async function testEmailConnection(): Promise<void> {
    try {
        const emailService = new EmailService(getEnv());

        await emailService.verifyConnection();

        console.log('SUCCESS: Gmail SMTP connection verified.');
    } catch {
        console.error(
            'FAILED: Gmail SMTP connection could not be verified. Check your SMTP configuration.'
        );

        process.exitCode = 1;
    }
}

void testEmailConnection();