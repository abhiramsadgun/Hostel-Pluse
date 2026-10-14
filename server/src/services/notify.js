const nodemailer = require('nodemailer');
const db = require('../db');

// Configurable Nodemailer transporter
let transporter = null;

function getTransporter() {
  if (!transporter) {
    if (process.env.EMAIL_HOST && process.env.EMAIL_USER) {
      transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587', 10),
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });
    }
  }
  return transporter;
}

/**
 * Dispatch cross-channel notification
 * @param {Object} params
 * @param {number} params.userId - Recipient user_id
 * @param {string} params.title - Alert title
 * @param {string} params.message - Alert body
 * @param {string} [params.type='info'] - 'info' | 'approval' | 'food' | 'alert' | 'complaint' | 'system'
 * @param {Object} [params.metadata={}] - Structured data
 * @param {string} [params.email] - Optional direct recipient email
 * @param {string} [params.phone] - Optional direct recipient phone for SMS
 */
async function notify({ userId, title, message, type = 'info', link, metadata = {}, email, phone }) {
  try {
    const combinedMeta = { ...metadata };
    if (link) combinedMeta.link = link;

    // 1. In-App Notification (Database Table)
    const dbResult = await db.query(
      `INSERT INTO notifications (user_id, title, message, type, is_read, metadata, created_at)
       VALUES ($1, $2, $3, $4, FALSE, $5, CURRENT_TIMESTAMP)
       RETURNING *`,
      [userId, title, message, type, JSON.stringify(combinedMeta)]
    );

    const notificationRecord = dbResult.rows[0];

    // 2. Fetch User Email & Phone if not provided
    let recipientEmail = email;
    let recipientPhone = phone;

    if ((!recipientEmail || !recipientPhone) && userId) {
      const userRes = await db.query('SELECT email, phone FROM users WHERE id = $1', [userId]);
      if (userRes.rows.length > 0) {
        recipientEmail = recipientEmail || userRes.rows[0].email;
        recipientPhone = recipientPhone || userRes.rows[0].phone;
      }
    }

    // 3. Email Delivery (Non-blocking)
    if (recipientEmail) {
      deliverEmail({
        to: recipientEmail,
        subject: `[HostelPulse] ${title}`,
        text: message,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #1e293b; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="background-color: #3b82f6; padding: 12px 16px; border-radius: 6px; color: white; margin-bottom: 16px;">
              <h2 style="margin: 0; font-size: 18px;">HostelPulse Alert</h2>
            </div>
            <h3 style="margin-top: 0; color: #0f172a;">${title}</h3>
            <p style="font-size: 15px; line-height: 1.5; color: #334155;">${message}</p>
            <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
              This is an automated notification from HostelPulse Hostel Management System.
            </div>
          </div>
        `,
      }).catch(err => {
        console.warn(`[NOTIFY-EMAIL] Simulated/Skipped delivery to ${recipientEmail}:`, err.message);
      });
    }

    // 4. SMS Delivery (Stub to console log)
    if (recipientPhone) {
      console.log(`[SMS-STUB] [To: ${recipientPhone}] [Type: ${type}] ${title} - ${message}`);
    }

    return notificationRecord;
  } catch (err) {
    console.error('[NOTIFY] Error dispatching notification:', err);
    throw err;
  }
}

async function deliverEmail({ to, subject, text, html }) {
  const mailer = getTransporter();
  const mailFrom = process.env.EMAIL_FROM || '"HostelPulse" <noreply@hostelpulse.edu>';

  if (mailer) {
    return mailer.sendMail({
      from: mailFrom,
      to,
      subject,
      text,
      html,
    });
  } else {
    // Development console log for mock delivery
    console.log(`[EMAIL-MOCK] From: ${mailFrom} | To: ${to} | Subject: ${subject}`);
    return { mockSent: true };
  }
}

module.exports = {
  notify,
  deliverEmail,
};
