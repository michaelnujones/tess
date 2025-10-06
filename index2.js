// index.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Simpan template pesan di array
const messages = [
  `BANTU RAMEIN MAS DAGET MENUNGGU 

DUELAN 3+ MIC X IKI [M1 ONLY] NEW
https://chat.whatsapp.com/Kiy9CmwI7SVF4ZFXlGiJVB

ALL 3+ GRUB BARU MIC X IKI 
50 MEM DAGET
OPEN OWN`,
  `DUELAN 3+ MIC X IKI [M1 ONLY] NEW
https://chat.whatsapp.com/Kiy9CmwI7SVF4ZFXlGiJVB

ALL 3+ GRUB BARU MIC X IKI 
50 MEM DAGET
OPEN OWN
 SAJA DANA
BANTUIN RAMEIN MASS INFO KAN SAJA DANA`,
  `


DUELAN 3+ MIC X IKI [M1 ONLY] NEW
https://chat.whatsapp.com/Kiy9CmwI7SVF4ZFXlGiJVB

ALL 3+ GRUB BARU MIC X IKI 
50 MEM DAGET🔥🔥
OPEN OWN

BANTUIN RAMEIN MASS SIAP BACK`
];

// Pilih pesan random dari array
function getRandomMessage() {
  return messages[Math.floor(Math.random() * messages.length)];
}

const client = new Client({
  authStrategy: new LocalAuth()
});

client.on('qr', qr => {
  console.log('Scan QR ini di WhatsApp:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
  console.log('Client ready!');

  //  nama grupm biar ga lupa
  const groupName = '𝗠𝟭 𝗢𝗡𝗟𝗬 𝗞𝗜𝗧𝗜𝗬 𝘅 𝗘𝗟𝗟🇻🇳';
  const chats = await client.getChats();
  const groupChat = chats.find(c => c.isGroup && c.name === groupName);

  if (!groupChat) {
    console.log(`Grup "${groupName}" tidak ditemukan.`);
    return;
  }

  console.log(`Mengirim pesan ke semua peserta di grup: ${groupChat.name}`);

  const participants = groupChat.participants;
  const sleep = ms => new Promise(res => setTimeout(res, ms));

  for (let p of participants) {
    const chatId = `${p.id.user}@c.us`;
    const message = getRandomMessage(); // pesan random

    try {
      await client.sendMessage(chatId, message);
      console.log(`Terkirim ke ${chatId}: ${message}`);
    } catch (err) {
      console.log('Gagal kirim ke', chatId, err.message);
    }

    // Delay biar lebih aman, jangan kirim terlalu cepat
    await sleep(12000 + Math.random() * 12000); // 10 detik
  }

  console.log('✅ Selesai kirim ke semua peserta.');
});

client.initialize();
