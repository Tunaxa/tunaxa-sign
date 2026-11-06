import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

const transporter: Transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: Number(process.env.SMTP_PORT) || 1025,
  secure: false,
  auth:
    process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
});

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: options.from || process.env.SMTP_FROM || "noreply@tunaxa.com",
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    return true;
  } catch (error) {
    console.error("[Email] Failed to send:", error);
    return false;
  }
}
