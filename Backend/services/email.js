import nodemailer from "nodemailer";

function smtpConfig() {
    const port = Number(process.env.SMTP_PORT || 587);
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) return null;
    return {
        host: process.env.SMTP_HOST,
        port,
        secure: process.env.SMTP_SECURE === "true" || port === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    };
}

export function emailDeliveryConfigured() { return Boolean(smtpConfig()); }

export async function sendReportEmail({ to, subject, text, pdf, filename, companyName, companyEmail }) {
    const config = smtpConfig();
    if (!config) throw new Error("EMAIL_NOT_CONFIGURED");
    const transporter = nodemailer.createTransport(config);
    const fromAddress = process.env.REPORT_EMAIL_FROM || process.env.SMTP_USER;
    await transporter.sendMail({
        from: { name: companyName || "Intervium", address: fromAddress },
        replyTo: companyEmail || undefined,
        to,
        subject,
        text,
        attachments: [{ filename, content: pdf, contentType: "application/pdf" }],
    });
}
