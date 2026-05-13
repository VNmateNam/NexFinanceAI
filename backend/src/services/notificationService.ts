/**
 * Notification Service
 * Email via Resend — FREE 3,000/month
 * SMS via Twilio — trial credit
 *
 * FROM EMAIL FIX:
 * Resend requires a verified domain for custom from addresses.
 * Set RESEND_FROM_EMAIL in Railway env vars to your verified address.
 * If not set, falls back to onboarding@resend.dev (works for testing,
 * sends to your Resend account email only).
 *
 * To use a custom from address:
 * 1. Go to resend.com → Domains → Add Domain
 * 2. Add your domain (e.g. yourdomain.com) and verify DNS records
 * 3. Set RESEND_FROM_EMAIL=alerts@yourdomain.com in Railway
 *
 * Alternative: use resend.dev subdomain which is pre-verified:
 * Set RESEND_FROM_EMAIL=NexusAI <onboarding@resend.dev>
 */

import { Resend } from 'resend';
import twilio from 'twilio';
import { logger } from './logger';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const twilioClient = (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

// Use env var for from address — defaults to Resend's pre-verified test address
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

export async function sendEmailAlert(params: {
  to: string;
  subject: string;
  assetName: string;
  symbol: string;
  condition: string;
  targetValue: number;
  currentPrice: number;
  sentiment?: string;
}): Promise<boolean> {
  if (!resend) {
    logger.warn('Resend not configured — skipping email alert');
    return false;
  }

  const { to, subject, assetName, symbol, condition, targetValue, currentPrice } = params;
  const direction = currentPrice >= targetValue ? '📈' : '📉';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0b0f;font-family:'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <div style="display:flex;align-items:center;margin-bottom:28px">
      <span style="color:#f5c842;font-size:22px;font-weight:800;letter-spacing:-0.5px">⚡ NexusAI</span>
    </div>
    <div style="background:#111217;border:1px solid #ffffff22;border-radius:16px;padding:28px;margin-bottom:20px">
      <div style="font-size:12px;font-weight:700;letter-spacing:1px;color:#6b7280;text-transform:uppercase;margin-bottom:8px">
        Price Alert Triggered
      </div>
      <div style="font-size:26px;font-weight:800;color:#f0f0f5;margin-bottom:4px">
        ${direction} ${assetName}
      </div>
      <div style="font-size:13px;color:#9ca3af;margin-bottom:20px;font-family:monospace">${symbol}</div>
      <div style="background:#1e1f28;border-radius:10px;padding:16px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:13px;color:#9ca3af">Current Price</span>
          <span style="font-size:16px;font-weight:700;color:#f5c842;font-family:monospace">$${currentPrice.toLocaleString()}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:13px;color:#9ca3af">Your Target</span>
          <span style="font-size:14px;font-weight:600;color:#f0f0f5;font-family:monospace">$${targetValue.toLocaleString()}</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="font-size:13px;color:#9ca3af">Condition</span>
          <span style="font-size:13px;color:#f0f0f5">${condition}</span>
        </div>
      </div>
    </div>
    <div style="text-align:center;margin-bottom:24px">
      <a href="${process.env.FRONTEND_URL || 'https://nex-finance-ai.vercel.app'}/alerts"
         style="display:inline-block;background:#f5c842;color:#0a0b0f;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none">
        View Dashboard →
      </a>
    </div>
    <div style="text-align:center;font-size:12px;color:#6b7280">
      You received this because you set a price alert on NexusAI.
    </div>
  </div>
</body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    if (error) {
      logger.error(`Resend error sending to ${to}:`, error);
      return false;
    }
    logger.info(`✅ Email alert sent to ${to}`);
    return true;
  } catch (err) {
    logger.error('Email send failed:', err);
    return false;
  }
}

export async function sendSMSAlert(params: {
  to: string;
  assetName: string;
  symbol: string;
  condition: string;
  currentPrice: number;
  targetValue: number;
}): Promise<boolean> {
  if (!twilioClient) {
    logger.warn('Twilio not configured — skipping SMS alert');
    return false;
  }

  const { to, assetName, symbol, condition, currentPrice, targetValue } = params;
  const body = `⚡ NexusAI Alert: ${assetName} (${symbol})\n${condition}\nTarget: $${targetValue.toLocaleString()}\nCurrent: $${currentPrice.toLocaleString()}\n\n${process.env.FRONTEND_URL || 'https://nex-finance-ai.vercel.app'}/alerts`;

  try {
    await twilioClient.messages.create({
      body,
      from: process.env.TWILIO_PHONE!,
      to,
    });
    logger.info(`✅ SMS alert sent to ${to}`);
    return true;
  } catch (err) {
    logger.error('SMS send failed:', err);
    return false;
  }
}
