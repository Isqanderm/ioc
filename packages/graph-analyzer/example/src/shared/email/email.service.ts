import { Injectable, Inject } from 'nexus-ioc';
import { ConfigService } from '../../core/config/config.service';
import { LoggerService } from '../../core/logger/logger.service';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
  }>;
}

export interface EmailTemplate {
  name: string;
  subject: string;
  variables: Record<string, unknown>;
}

@Injectable()
export class EmailService {
  constructor(
    @Inject(ConfigService) private configService: ConfigService,
    @Inject(LoggerService) private logger: LoggerService
  ) {
    const emailConfig = this.configService.get('email');
    this.logger.info(`Email service initialized (SMTP: ${emailConfig.host}:${emailConfig.port})`, 'EmailService');
  }

  async send(options: EmailOptions): Promise<boolean> {
    const recipients = Array.isArray(options.to) ? options.to.join(', ') : options.to;
    
    this.logger.info(`Sending email to ${recipients}: ${options.subject}`, 'EmailService');

    // Simulate email sending
    try {
      // In real app: use nodemailer or similar
      this.logger.debug(`Email sent successfully to ${recipients}`, 'EmailService');
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${recipients}`, error.message, 'EmailService');
      return false;
    }
  }

  async sendTemplate(to: string | string[], template: EmailTemplate): Promise<boolean> {
    this.logger.info(`Sending template email: ${template.name}`, 'EmailService');

    // Simulate template rendering
    const html = this.renderTemplate(template);

    return this.send({
      to,
      subject: template.subject,
      html
    });
  }

  private renderTemplate(template: EmailTemplate): string {
    // Simulate template rendering
    let html = `<h1>${template.subject}</h1>`;
    
    for (const [key, value] of Object.entries(template.variables)) {
      html += `<p><strong>${key}:</strong> ${value}</p>`;
    }

    return html;
  }

  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    return this.sendTemplate(email, {
      name: 'welcome',
      subject: 'Welcome to our platform!',
      variables: { name }
    });
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    return this.sendTemplate(email, {
      name: 'password-reset',
      subject: 'Password Reset Request',
      variables: { resetToken, email }
    });
  }
}

