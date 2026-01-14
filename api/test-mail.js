import { sendAdminReply } from '../lib/mail/send-admin-reply.js';

export default async function handler(req, res) {
  // GERÇEK SİMÜLASYON (formdan gelmiş gibi)
  const name = 'Test Kullanıcı';
  const email = 'harunerkezen@gmail.com';
  const ticketId = 'AIVO-TEST-REAL-001';

  await sendAdminReply({
    to: email,              // mail kime gidecek
    ticketId: ticketId,     // ticket numarası
    userName: name,         // 👈 KİM YAZDIYSA O
    statusLabel: 'Yanıtlandı',
    mainMessage: 'Bu mail, admin reply sisteminin gerçek testidir.',
    adminNote: 'Test amaçlı gönderildi'
  });

  res.status(200).json({ ok: true });
}
