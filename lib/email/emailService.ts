import nodemailer from 'nodemailer';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

interface ManagerCredentials {
  name: string;
  email: string;
  password: string;
  loginUrl: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    const config: EmailConfig = {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER || 'batrbekk@gmail.com',
        pass: process.env.EMAIL_PASS || 'yoja sxoy hrbq prae'
      }
    };

    this.transporter = nodemailer.createTransport(config);
  }

  async sendManagerCredentials(credentials: ManagerCredentials): Promise<boolean> {
    try {
      const htmlContent = this.generateManagerCredentialsHTML(credentials);

      const mailOptions = {
        from: `"Система управления вендинговыми автоматами" <${process.env.EMAIL_USER}>`,
        to: credentials.email,
        subject: 'Ваши авторизационные данные для системы управления вендинговыми автоматами',
        html: htmlContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email отправлен:', result.messageId);
      return true;
    } catch (error) {
      console.error('Ошибка отправки email:', error);
      return false;
    }
  }

  private generateManagerCredentialsHTML(credentials: ManagerCredentials): string {
    return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Авторизационные данные</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
        }
        .container {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
        }
        .header {
            background: #f9fafb;
            border-bottom: 1px solid #e5e7eb;
            padding: 24px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 20px;
            font-weight: 600;
            color: #111827;
        }
        .content {
            padding: 32px 24px;
        }
        .welcome {
            font-size: 16px;
            margin-bottom: 16px;
            color: #374151;
        }
        .credentials-section {
            margin: 24px 0;
        }
        .credential-item {
            margin-bottom: 16px;
        }
        .credential-label {
            font-weight: 500;
            color: #374151;
            margin-bottom: 4px;
            display: block;
        }
        .credential-value {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            background: #f3f4f6;
            border: 1px solid #d1d5db;
            color: #111827;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 14px;
            display: inline-block;
            min-width: 200px;
        }
        .password-warning {
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 6px;
            padding: 12px 16px;
            margin: 20px 0;
            color: #991b1b;
            font-size: 14px;
        }
        .login-button {
            display: inline-block;
            background: #111827;
            color: white;
            text-decoration: none;
            padding: 10px 20px;
            border-radius: 6px;
            font-weight: 500;
            margin: 20px 0;
            text-align: center;
            font-size: 14px;
        }
        .login-button:hover {
            background: #374151;
        }
        .footer {
            background: #f9fafb;
            border-top: 1px solid #e5e7eb;
            padding: 20px 24px;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
        }
        .instruction {
            color: #6b7280;
            font-size: 14px;
            margin-bottom: 16px;
        }
        .security-note {
            color: #6b7280;
            font-size: 12px;
            margin-top: 20px;
            padding-top: 16px;
            border-top: 1px solid #e5e7eb;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Авторизационные данные</h1>
        </div>
        
        <div class="content">
            <div class="welcome">
                Здравствуйте, <strong>${credentials.name}</strong>!
            </div>
            
            <div class="instruction">
                Для доступа к системе управления вендинговыми автоматами используйте следующие данные:
            </div>
            
            <div class="credentials-section">
                <div class="credential-item">
                    <span class="credential-label">Email:</span>
                    <div class="credential-value">${credentials.email}</div>
                </div>
                <div class="credential-item">
                    <span class="credential-label">Пароль:</span>
                    <div class="credential-value">${credentials.password}</div>
                </div>
            </div>
            
            <div class="password-warning">
                <strong>Важно:</strong> Сохраните эти данные в безопасном месте. Рекомендуется изменить пароль при первом входе в систему.
            </div>
            
            <div style="text-align: center;">
                <a href="${credentials.loginUrl}" class="login-button">
                    Войти в систему
                </a>
            </div>
            
            <div class="security-note">
                Если вы не запрашивали доступ к системе, проигнорируйте это письмо.
            </div>
        </div>
        
        <div class="footer">
            <p>Это письмо отправлено автоматически. Пожалуйста, не отвечайте на него.</p>
            <p>© 2024 Система управления вендинговыми автоматами</p>
        </div>
    </div>
</body>
</html>
    `;
  }
}

export const emailService = new EmailService();
