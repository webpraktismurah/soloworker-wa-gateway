const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcodeTerminal = require('qrcode-terminal');

const app = express();
app.use(express.json());

// Izinkan CORS agar cPanel mas bro bisa akses ke server ini
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    next();
});

// Penampung status QR Code terbaru
let latestQRCode = "Sedang menyiapkan WhatsApp Client, mohon tunggu...";
let isConnected = false;

// Inisialisasi WhatsApp Client dengan fitur simpan session otomatis
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

// 1. EVENT JIKA BUTUH SCAN QR CODE
client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
    // Tampilkan QR Code berupa teks di logs Render
    qrcodeTerminal.generate(qr, { small: true });
    // Simpan teks QR agar bisa dilihat lewat browser nanti
    latestQRCode = qr;
    isConnected = false;
});

// 2. EVENT JIKA SUKSES TERHUBUNG
client.on('ready', () => {
    console.log('WhatsApp Client is READY, Mas Bro!');
    latestQRCode = "CONNECTED";
    isConnected = true;
});

client.on('authenticated', () => {
    console.log('Autentikasi Berhasil!');
});

client.on('auth_failure', (msg) => {
    console.error('Autentikasi Gagal:', msg);
});

client.on('disconnected', (reason) => {
    console.log('WhatsApp Terputus:', reason);
    latestQRCode = "DISCONNECTED";
    isConnected = false;
    client.initialize(); // Coba hubungkan ulang otomatis
});

// ===================================================
// URL ENDPOINT UNTUK MENAMPILKAN QR / STATUS DI BROWSER
// ===================================================
app.get('/', (req, res) => {
    if (isConnected) {
        res.send("<h1>Status Gateway: ✅ TERHUBUNG (READY)!</h1><p>Server cloud Render siap menerima broadcast, Mas Bro.</p>");
    } else if (latestQRCode === "Sedang menyiapkan WhatsApp Client, mohon tunggu...") {
        res.send(`<h1>${latestQRCode}</h1><p>Silakan refresh halaman ini dalam 10-20 detik.</p>`);
    } else {
        // Tampilkan halaman sederhana untuk scan QR Code menggunakan Google Charts API gratisan
        res.send(`
            <div style="text-align:center; font-family:sans-serif; margin-top:50px;">
                <h2>Silakan Scan QR Code Ini via WhatsApp HP Mas Bro:</h2>
                <div style="margin:20px 0;">
                    <img src="https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=${encodeURIComponent(latestQRCode)}&choe=UTF-8" alt="QR Code WA" style="border:5px solid #333; padding:10px; border-radius:10px;" />
                </div>
                <p style="color:#666;">Buka WA di HP -> Perangkat Tertaut -> Tautkan Perangkat</p>
                <p><i>Setelah di-scan, halaman ini akan berubah jadi TERHUBUNG saat mas bro refresh kembali.</i></p>
            </div>
        `);
    }
});

// ===================================================
// URL ENDPOINT API UNTUK DITEMBAK OLEH CPANEL (BROADCAST)
// ===================================================
app.post('/send-message', async (req, res) => {
    const { nomor_wa, pesan } = req.body;

    if (!isConnected) {
        return res.status(500).json({ status: "error", message: "Gateway belum terhubung ke WhatsApp HP mas bro!" });
    }

    if (!nomor_wa || !pesan) {
        return res.status(400).json({ status: "error", message: "Parameter nomor_wa atau pesan kurang mas bro!" });
    }

    try {
        // Format nomor agar sesuai standar whatsapp-web.js (contoh: 628xxx@c.us)
        let formattedNumber = nomor_wa.replace(/[^0-9]/g, ''); // bersihkan karakter non-angka
        
        if (formattedNumber.startsWith('0')) {
            formattedNumber = '62' + formattedNumber.substr(1);
        }
        
        if (!formattedNumber.endsWith('@c.us')) {
            formattedNumber = `${formattedNumber}@c.us`;
        }

        // Eksekusi kirim pesan asli dari engine cloud!
        await client.sendMessage(formattedNumber, pesan);
        
        res.json({ status: "success", message: "Pesan berhasil terkirim lewat gateway gratisan!" });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Gagal kirim pesan: " + error.message });
    }
});

// Jalankan Server Port bawaan Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server WA Gateway berjalan gagah di port ${PORT}`);
});

// Nyalakan engine WhatsApp client
client.initialize();
