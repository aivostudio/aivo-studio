import fs from 'fs';
import path from 'path';
import sendMail from './mailer.js';

export async function sendAdminReply({
  to,
  ticketId,
  userName,
  statusLabel,
  mainMessage,
  adminNote
}) {
  const tplPath = path.join(
    process.cwd(),
    'lib/mail/templates/admin-reply.html'
  );

  let html = fs.readFileSync(tplPath, 'utf8');

  html = html
    .replace(/{{TICKET_ID}}/g, ticketId)
    .replace(/{{USER_NAME}}/g, userName)
    .replace(/{{STATUS_LABEL}}/g, statusLabel)
    .replace(/{{MAIN_MESSAGE}}/g, mainMessage)
    .replace(/{{ADMIN_NOTE}}/g, adminNote || '-')
    .replace(/{{UPDATED_AT}}/g, new Date().toLocaleString('tr-TR'))
    .replace(/{{YEAR}}/g, new Date().getFullYear());

  await sendMail({
    to,
    subject: `Re: [#${ticketId}] Destek Yanıtı`,
    html,
    replyTo: 'info@aivo.tr'
  });
}
