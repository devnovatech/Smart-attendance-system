import { AttendanceStatus } from '../types';

const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_NAME;
const TEMPLATE_LANGUAGE = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en_US';
const DEFAULT_COUNTRY_CODE = (process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '92').replace(/\D/g, '');

export interface AttendanceReport {
  guardianPhone: string;
  studentName: string;
  subject: string;
  date: string;
  status: AttendanceStatus;
}

export interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(ACCESS_TOKEN && PHONE_NUMBER_ID);
}

export function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  while (digits.startsWith('0')) digits = digits.slice(1);
  // If it looks like a local number (no country code prefix), prepend the default.
  if (digits.length <= 10) digits = DEFAULT_COUNTRY_CODE + digits;
  return digits;
}

export async function sendAttendanceReport(report: AttendanceReport): Promise<SendResult> {
  if (!isWhatsAppConfigured()) {
    return { ok: false, error: 'WhatsApp service not configured' };
  }

  const to = normalizePhone(report.guardianPhone);
  if (!to) return { ok: false, error: 'Invalid guardian phone number' };

  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const payload = TEMPLATE_NAME ? buildTemplatePayload(to, report) : buildTextPayload(to, report);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message?: string; code?: number };
    };

    if (!res.ok) {
      return { ok: false, error: data?.error?.message || `HTTP ${res.status}` };
    }
    return { ok: true, messageId: data?.messages?.[0]?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

function statusLabel(status: AttendanceStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function buildTemplatePayload(to: string, report: AttendanceReport) {
  return {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: TEMPLATE_NAME,
      language: { code: TEMPLATE_LANGUAGE },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: report.studentName },
            { type: 'text', text: report.subject },
            { type: 'text', text: report.date },
            { type: 'text', text: statusLabel(report.status) },
          ],
        },
      ],
    },
  };
}

function buildTextPayload(to: string, report: AttendanceReport) {
  // Plain text is only deliverable inside the 24h customer-initiated session window.
  // Used as a dev fallback when no template is configured.
  const emoji = report.status === 'present' ? '✅' : report.status === 'absent' ? '❌' : '⏰';
  const body = [
    `📋 *Attendance Report*`,
    ``,
    `Student: *${report.studentName}*`,
    `Subject: ${report.subject}`,
    `Date: ${report.date}`,
    `Status: ${emoji} ${statusLabel(report.status)}`,
    ``,
    `This is an automated message from Smart Attendance System.`,
  ].join('\n');
  return {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body },
  };
}

export async function sendBatch(
  reports: AttendanceReport[],
  concurrency = 8
): Promise<SendResult[]> {
  const results: SendResult[] = new Array(reports.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, reports.length) }, async () => {
    while (cursor < reports.length) {
      const idx = cursor++;
      results[idx] = await sendAttendanceReport(reports[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}
