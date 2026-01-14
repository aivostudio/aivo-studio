import { sendAdminReply } from '../lib/mail/send-admin-reply.js';

export default async function handler(req, res) {
  await sendAdminReply({
    to: 'harunerkezen@gmail.com',
    ticketId: 'AIVO-TEST-REPLY',
    userName: 'Harun',
    statusLabel: 'Onaylandı',
    mainMessage: 'Bu admin reply mail testidir.',
    adminNote: 'Test notu'
  });

  res.json({ ok: true });
}
