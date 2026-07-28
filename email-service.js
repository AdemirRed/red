require('dotenv').config();

const nodemailer = require('nodemailer');

// Configuração do email usando Zoho
// Para usar email real, configure as variáveis de ambiente:
//   EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS
// Ou edite diretamente abaixo com uma "App Password" do Zoho
const emailConfig = {
    host: process.env.EMAIL_HOST || 'smtp.zoho.eu',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.EMAIL_USER || 'ademir@explorarlocais.com.br',
        pass: process.env.EMAIL_PASS || '!!@@Au154466!!@@'
    },
    tls: {
        rejectUnauthorized: false
    }
};

const EMAIL_ENABLED = !!(emailConfig.auth.user && emailConfig.auth.pass);

// Criar transportador
let transporter;
if (EMAIL_ENABLED) {
    try {
        transporter = nodemailer.createTransport(emailConfig);
        console.log('📧 Transportador de email criado - verificando credenciais...');
        
        transporter.verify(function(error, success) {
            if (error) {
                console.log('⚠️  Email SMTP falhou:', error.message);
                console.log('📋 Códigos de recuperação serão exibidos no terminal');
            } else {
                console.log('✅ Servidor de email pronto para enviar mensagens');
            }
        });
    } catch (error) {
        console.error('⚠️  Erro ao criar transportador:', error.message);
        transporter = null;
    }
} else {
    console.log('📋 Email não configurado - códigos de recuperação serão exibidos no terminal');
    console.log('   Para ativar email, defina EMAIL_USER e EMAIL_PASS nas variáveis de ambiente');
    transporter = null;
}

/**
 * Enviar email de recuperação de senha com código
 */
async function sendPasswordResetEmail(email, code, username) {
    try {
        const mailOptions = {
            from: '"CloudShare Pro" <ademir@explorarlocais.com.br>',
            to: email,
            subject: '🔐 Código de Recuperação de Senha - CloudShare Pro',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .code-box { background: white; border: 2px dashed #667eea; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0; }
        .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; font-family: 'Courier New', monospace; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Recuperação de Senha</h1>
            <p>CloudShare Pro</p>
        </div>
        <div class="content">
            <p>Olá <strong>${username}</strong>,</p>
            
            <p>Recebemos uma solicitação para redefinir a senha da sua conta no CloudShare Pro.</p>
            
            <p>Use o código abaixo para completar a recuperação de senha:</p>
            
            <div class="code-box">
                <div class="code">${code}</div>
                <p style="color: #666; font-size: 14px; margin-top: 10px;">Código de verificação</p>
            </div>
            
            <div class="warning">
                <strong>⚠️ Importante:</strong>
                <ul style="margin: 10px 0;">
                    <li>Este código expira em <strong>10 minutos</strong></li>
                    <li>Use-o apenas uma vez</li>
                    <li>Não compartilhe com ninguém</li>
                </ul>
            </div>
            
            <p>Se você não solicitou a recuperação de senha, ignore este email. Sua senha permanecerá segura.</p>
            
            <p>Para completar a recuperação, volte ao CloudShare Pro e digite o código acima.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="http://localhost:3000" class="button">Acessar CloudShare Pro</a>
            </div>
            
            <div class="footer">
                <p>CloudShare Pro - Sistema Profissional de Gerenciamento de Arquivos</p>
                <p>Este é um email automático, por favor não responda.</p>
                <p>© 2026 CloudShare Pro. Todos os direitos reservados.</p>
            </div>
        </div>
    </div>
</body>
</html>
            `,
            text: `
CloudShare Pro - Recuperação de Senha

Olá ${username},

Recebemos uma solicitação para redefinir a senha da sua conta.

Código de verificação: ${code}

Este código expira em 10 minutos e pode ser usado apenas uma vez.

Se você não solicitou esta recuperação, ignore este email.

Para completar a recuperação, volte ao CloudShare Pro e digite o código acima.

---
CloudShare Pro
Este é um email automático, por favor não responda.
            `
        };

        if (!transporter) {
            console.log('📋 Email não configurado - código exibido apenas no terminal');
            return { success: false, error: 'Email não configurado' };
        }

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email enviado:', info.messageId);
        return { success: true, messageId: info.messageId };
        
    } catch (error) {
        console.error('❌ Erro ao enviar email:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Testar configuração de email
 */
async function testEmailConfig() {
    if (!transporter) {
        console.log('📋 Email não configurado');
        return false;
    }
    try {
        const testMail = {
            from: `"CloudShare Pro" <${emailConfig.auth.user}>`,
            to: emailConfig.auth.user,
            subject: 'Teste de Configuração - CloudShare Pro',
            text: 'Este é um email de teste para verificar a configuração do sistema de email do CloudShare Pro.',
            html: '<p>Este é um email de teste para verificar a configuração do sistema de email do CloudShare Pro.</p>'
        };
        
        const info = await transporter.sendMail(testMail);
        console.log('✅ Email de teste enviado:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Erro no teste de email:', error);
        return false;
    }
}

module.exports = {
    sendPasswordResetEmail,
    testEmailConfig,
    transporter,
    EMAIL_ENABLED
};
