const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const { Server } = require("socket.io");
const qrcode = require("qrcode");
const { Client, LocalAuth } = require("whatsapp-web.js");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "bot-wa-secret",
    resave: false,
    saveUninitialized: true,
  })
);

let client;
let qrReady = false;
let qrData = "";
let isAuthenticated = false;
let isSending = false;

// ================= LOGIN SYSTEM =================
const ACCOUNTS_FILE = path.join(__dirname, "accounts.json");



// Tambahkan baris ini 👇
const accountsFile = path.join(__dirname, "accounts.json");

// Fungsi untuk memuat data akun
function loadAccounts() {
  if (!fs.existsSync(accountsFile)) {
    fs.writeFileSync(
      accountsFile,
      JSON.stringify([
        {
          username: "admin",
          password: "123456",
          devices: []
        }
      ], null, 2)
    );
  }

  const data = JSON.parse(fs.readFileSync(accountsFile));
  return Array.isArray(data) ? data : data.accounts || [];
}



function saveAccounts(data) {
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(data, null, 2));
}

app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const accounts = loadAccounts();

  const user = accounts.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) {
    return res.render("login", { error: "Username atau password salah!" });
  }

  // Cek jumlah perangkat aktif
  if (!user.devices) user.devices = [];

  const deviceId = req.sessionID;

  if (!user.devices.includes(deviceId)) {
    if (user.devices.length >= 2) {
      return res.render("login", {
        error: "Akun ini sudah digunakan di 2 perangkat!",
      });
    }
    user.devices.push(deviceId);
    saveAccounts(accounts);
  }

  req.session.user = username;
  res.redirect("/");
});

app.get("/logout", (req, res) => {
  const username = req.session.user;
  if (username) {
    const accounts = loadAccounts();
    const user = accounts.find((u) => u.username === username);
    if (user) {
      user.devices = user.devices.filter((id) => id !== req.sessionID);
      saveAccounts(accounts);
    }
  }
  req.session.destroy(() => res.redirect("/login"));
});

// Middleware proteksi login
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

// ================= ROUTES BOT =================
app.get("/", requireLogin, (req, res) => {
  res.render("index");
});

app.post("/set", requireLogin, (req, res) => {
  const { grupName, jumlahPesan } = req.body;
  req.session.grupName = grupName;
  req.session.jumlahPesan = parseInt(jumlahPesan);
  res.redirect("/pesan");
});

app.get("/pesan", requireLogin, (req, res) => {
  const { jumlahPesan } = req.session;
  if (!jumlahPesan) return res.redirect("/");
  res.render("pesan", { jumlahPesan });
});

app.post("/simpan-pesan", requireLogin, (req, res) => {
  const { jumlahPesan } = req.session;
  req.session.pesanList = [];
  for (let i = 1; i <= jumlahPesan; i++) {
    req.session.pesanList.push(req.body[`pesan${i}`]);
  }
  res.redirect("/qr");
});

app.get("/qr", requireLogin, (req, res) => {
  if (!req.session.pesanList) return res.redirect("/");
  res.render("qr");
});

app.get("/hasil", requireLogin, (req, res) => {
  if (!req.session.pesanList || !isAuthenticated) return res.redirect("/");
  res.render("hasil", {
    grupName: req.session.grupName,
    pesanList: req.session.pesanList,
  });
});

// ================= SOCKET.IO =================
io.on("connection", (socket) => {
  console.log("✅ Browser connected");

  if (qrReady && qrData) socket.emit("qr", qrData);
  if (isAuthenticated) socket.emit("ready");

  socket.on("start-bot", async () => {
    if (client) return;

    client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: { headless: true },
    });

    client.on("qr", async (qr) => {
      qrReady = true;
      qrData = await qrcode.toDataURL(qr);
      io.emit("qr", qrData);
    });

    client.on("ready", () => {
      qrReady = false;
      isAuthenticated = true;
      console.log("✅ WhatsApp siap!");
      io.emit("ready");
    });

    client.initialize();
  });

  socket.on("start-send", async (sessionData) => {
    if (!isAuthenticated || isSending) return;
    isSending = true;

    const { grupName, pesanList } = sessionData;
    const jumlahPesan = pesanList.length;

    try {
      const chats = await client.getChats();
      const grup = chats.find((c) => c.name === grupName);

      if (!grup) {
        io.emit("error", "❌ Grup tidak ditemukan di akun WhatsApp Anda.");
        isSending = false;
        return;
      }

      console.log("📣 Mengirim pesan ke grup:", grupName);

      for (const p of grup.participants) {
        const nomor = p.id._serialized;
        const randomMsg = pesanList[Math.floor(Math.random() * jumlahPesan)];

        try {
          await client.sendMessage(nomor, randomMsg);
          io.emit("sent", nomor);
          console.log("Terkirim ke:", nomor);
        } catch (err) {
          console.log("Gagal kirim ke", nomor, err.message);
        }

        await new Promise((r) => setTimeout(r, 10000)); // delay 10 detik
      }

      io.emit("done");
      console.log("✅ Semua pesan terkirim!");
    } catch (err) {
      io.emit("error", "Terjadi kesalahan: " + err.message);
    } finally {
      isSending = false;
    }
  });
});

server.listen(3000, () => {
  console.log("🚀 Server jalan di http://localhost:3000");
});
