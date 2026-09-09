import { TranslationCatalog } from '../messages';

export const hiMessages: TranslationCatalog = {
  'app.restricted.title': 'Akses Dibatasi',
  'app.restricted.description':
    'Versi ini hanya tersedia di aplikasi desktop resmi.',
  'app.restricted.publicDocs': 'Dokumen hukum tetap tersedia untuk umum:',
  'app.transition.loading': 'Memuat...',
  'app.transition.enterDashboard': 'Memasuki dasbor...',
  'app.transition.updateSession': 'Memperbarui sesi...',
  'app.transition.openFeed': 'Membuka Feed Scanlation...',
  'app.transition.openRankings': 'Membuka peringkat model...',
  'app.transition.openSettings': 'Membuka pengaturan...',
  'app.session.validating': 'Memvalidasi sesi...',
  'settings.tabs.general': 'Umum',
  'settings.tabs.presets': 'Preset',
  'settings.tabs.integrations': 'Integrasi',
  'shortcutModal.title': 'Pusat Pintasan',
  'shortcutModal.subtitle':
    'Pintasan global hanya aktif di dasbor, tidak di kolom teks.',
  'shortcutModal.hotkeyHint': 'H untuk membuka',
  'shortcutModal.close': 'Tutup',
  'shortcutModal.instructionPrefix': 'Klik ',
  'shortcutModal.instructionRecord': 'Rekam',
  'shortcutModal.instructionSuffix':
    ', lalu tekan kombinasi tombol yang diinginkan. Konflik akan terdeteksi secara otomatis.',
  'shortcutModal.searchPlaceholder': 'Cari pintasan, aksi, atau tombol...',
  'shortcutModal.results_one': '{count} hasil',
  'shortcutModal.results_other': '{count} hasil',
  'shortcutModal.recording': 'Merekam…',
  'shortcutModal.record': 'Rekam',
  'shortcutModal.restoreDefault': 'Kembalikan ke default',
  'shortcutModal.clearShortcut': 'Hapus pintasan',
  'shortcutModal.conflict': 'Konflik: "{label}" ({combo})',
  'shortcutModal.fixedShortcuts': 'Pintasan kontekstual tetap',
  'shortcutModal.fixed': 'Tetap',
  'shortcutModal.noResults': 'Tidak ada pintasan ditemukan untuk "{query}".',
  'shortcutModal.restoreAll': 'Kembalikan semua',
  'toolbar.modelSelect.label': 'Model Terjemahan',
  'toolbar.modelSelect.manage': 'Kelola Model',
  'toolbar.modelSelect.select': 'Pilih model',
  'toolbar.modelSelect.groupLocal': '── Model Lokal (terinstal) ──',
  'toolbar.modelSelect.groupCloud': '── Cloud/API/AI ──',
  'toolbar.modelSelect.localPrefix': '[Lokal]',
  'toolbar.modelSelect.cloudPrefix': '[Cloud]',
  'toolbar.modelSelect.updateAvailable': '(Pembaruan tersedia)',
  'toolbar.modelSelect.installedCount_one': '{count} model terinstal',
  'toolbar.modelSelect.installedCount_other': '{count} model terinstal',
  'toolbar.modelSelect.updates_one': '{count} pembaruan tertunda',
  'toolbar.modelSelect.updates_other': '{count} pembaruan tertunda',
  'toolbar.modelSelect.noUpdates': 'Tidak ada pembaruan tertunda',
  'toolbar.modelSelect.emptyState':
    'Tidak ada model yang kompatibel dengan {source} → {target}.',
  'toolbar.modelSelect.incompatibleWarning':
    '"{model}" tidak mendukung {source} → {target}. Pilih model yang kompatibel atau ubah bahasa target.',
  'settings.tabs.app': 'Aplikasi',
  'settings.backToDashboard': 'Kembali ke Dasbor',
  'settings.stats.version': 'versi',
  'settings.app.updater.status.idle': 'Menganggur',
  'settings.app.updater.status.checking': 'Memeriksa…',
  'settings.app.updater.status.available': 'Pembaruan tersedia',
  'settings.app.updater.status.notAvailable': 'Sudah terbaru',
  'settings.app.updater.status.downloading': 'Mengunduh…',
  'settings.app.updater.status.downloaded': 'Siap diinstal',
  'settings.app.updater.status.error': 'Error',
  'settings.app.updater.channel.stable': 'Stabil (Direkomendasikan)',
  'settings.app.updater.channel.beta': 'Beta (Fitur awal)',
  'settings.app.updater.channel.canary': 'Canary (Tidak stabil)',
  'settings.app.updater.version': 'Versi',
  'settings.app.updater.build': 'Build',
  'settings.app.updater.releaseNotes': 'Catatan Rilis',
  'settings.app.updater.noNotes': 'Tidak ada catatan untuk versi ini.',
  'settings.app.updater.checkNow': 'Periksa Pembaruan',
  'settings.app.updater.installNow': 'Mulai Ulang dan Perbarui',
  'settings.app.updater.desktopOnly': 'Hanya tersedia di aplikasi desktop.',
  'settings.app.updater.autoCheck': 'Periksa otomatis',
  'settings.app.updater.autoCheckDesc':
    'Periksa versi baru saat aplikasi dibuka.',
  'settings.app.updater.channel': 'Kanal pembaruan',
  'settings.app.updater.channelDesc': 'Rilis stabil atau eksperimental.',
  'settings.app.fonts.title': 'Font Sistem',
  'settings.app.fonts.desc': 'Kelola font untuk Typesetter dan rendering.',
  'settings.app.fonts.systemCount': '{count} font terdeteksi',
  'settings.app.fonts.customTitle': 'Font Kustom',
  'settings.app.fonts.import': 'Impor .ttf / .otf',
  'settings.app.fonts.noCustom': 'Tidak ada font kustom yang diimpor.',
  'settings.app.fonts.importSuccess': 'Font {name} berhasil diimpor.',
  'settings.app.fonts.importError': 'Gagal mengimpor font.',
  'settings.app.fonts.deleteConfirm':
    'Apakah Anda ingin menghapus font {name}?',
  'settings.app.autosave.title': 'Simpan Otomatis Workspace',
  'settings.app.autosave.desc':
    'Simpan kemajuan proyek secara otomatis di lokal.',
  'settings.app.autosave.enabled': 'Simpan otomatis diaktifkan',
  'settings.app.autosave.interval': 'Interval (menit)',
  'settings.app.autosave.saveNow': 'Simpan pengaturan',
  'settings.app.autosave.success': 'Pengaturan simpan otomatis diperbarui.',
  'settings.app.autosave.error': 'Gagal menyimpan pengaturan.',
  'settings.app.reset.title': 'Zona Berbahaya',
  'settings.app.reset.desc':
    'Hapus data lokal dan kembalikan pengaturan default.',
  'settings.app.reset.button': 'Reset Aplikasi',
  'settings.app.reset.confirm':
    'Ini akan mengeluarkan Anda dan menghapus semua preset serta cache lokal. Apakah Anda ingin melanjutkan?',
  'settings.app.reset.success': 'Aplikasi direset. Memulai ulang...',
  'settings.general.profile.title': 'Profil',
  'settings.general.profile.desc': 'Informasi akun dan preferensi global Anda.',
  'settings.general.profile.name': 'Nama tampilan',
  'settings.general.profile.email': 'Email utama',
  'settings.general.profile.verified': 'Email terverifikasi',
  'settings.general.profile.unverified': 'Email menunggu verifikasi',
  'settings.general.profile.verifyBtn': 'Verifikasi sekarang',
  'settings.general.profile.sending': 'Mengirim...',
  'settings.general.profile.verifySuccess': 'Email verifikasi terkirim.',
  'settings.general.profile.verifyError': 'Gagal mengirim email.',
  'settings.general.profile.save': 'Simpan profil',
  'settings.general.profile.success': 'Profil berhasil diperbarui.',
  'settings.general.profile.error': 'Gagal memperbarui profil.',
  'settings.general.travel.title': 'Token Perjalanan',
  'settings.general.travel.desc':
    'Akses akun Studio Anda di perangkat lain tanpa keluar.',
  'settings.general.travel.active': 'Token aktif',
  'settings.general.travel.inactive': 'Tidak ada token aktif',
  'settings.general.travel.generate': 'Buat token baru',
  'settings.general.travel.generateDesc': 'Berlaku selama {days} hari.',
  'settings.general.travel.copyAria': 'Salin token',
  'settings.general.travel.revoke': 'Cabut semua',
  'settings.general.travel.revoked': 'Token dicabut.',
  'settings.general.travel.success': 'Token berhasil dibuat.',
  'settings.general.travel.error': 'Gagal memproses token.',
  'settings.general.language.title': 'Antarmuka',
  'settings.general.language.desc': 'Bahasa dan tema aplikasi.',
  'settings.general.language.label': 'Bahasa',
  'settings.general.language.system': 'Ikuti sistem',
  'settings.general.theme.label': 'Tema',
  'settings.general.theme.dark': 'Gelap (Default)',
  'settings.general.theme.light': 'Terang',
  'settings.general.theme.amoled': 'OLED / Hitam',
  'settings.presets.aio.title': 'Preset AIO',
  'settings.presets.aio.desc':
    'Konfigurasikan model default untuk setiap tahap dan bahasa.',
  'settings.presets.aio.active': 'Preset aktif untuk {lang}',
  'settings.presets.aio.none': 'Belum ada preset yang dikonfigurasi.',
  'settings.presets.aio.create': 'Preset Baru',
  'settings.presets.aio.edit': 'Edit Preset',
  'settings.presets.aio.delete': 'Hapus Preset',
  'settings.presets.aio.name': 'Nama preset',
  'settings.presets.aio.lang': 'Bahasa sumber',
  'settings.presets.aio.models': 'Konfigurasi model',
  'settings.presets.aio.save': 'Simpan Preset',
  'settings.presets.aio.success': 'Preset berhasil disimpan.',
  'settings.presets.aio.error': 'Gagal menyimpan preset.',
  'settings.presets.typo.title': 'Preset Typesetter',
  'settings.presets.typo.desc':
    'Gaya font, warna, dan balon yang sudah dikonfigurasi.',
  'settings.presets.render.title': 'Gaya Rendering',
  'settings.presets.render.desc':
    'Konfigurasikan cara teks digambar pada gambar akhir.',
  'settings.integrations.discord.title': 'Webhook Discord',
  'settings.integrations.discord.desc':
    'Notifikasi otomatis untuk server Anda.',
  'settings.integrations.discord.url': 'URL Webhook',
  'settings.integrations.discord.test': 'Tes Koneksi',
  'settings.integrations.discord.events': 'Event pemicu',
  'settings.integrations.discord.success':
    'Konfigurasi disimpan dan tes terkirim.',
  'settings.integrations.discord.error':
    'Gagal menyimpan atau menguji webhook.',
  'settings.integrations.discord.invalidUrl': 'URL webhook tidak valid.',
  'settings.integrations.blogger.successSecure':
    'Konfigurasi Blogger disimpan ke penyimpanan aman desktop.',
  'settings.integrations.blogger.successLocal':
    'Konfigurasi Blogger disimpan secara lokal.',
  'settings.integrations.blogger.saveError':
    'Gagal menyimpan konfigurasi Blogger.',
  'settings.integrations.blogger.testError':
    'Gagal memvalidasi koneksi Blogger.',
  'settings.integrations.imgur.successSecure':
    'Konfigurasi Imgur disimpan ke penyimpanan aman desktop.',
  'settings.integrations.imgur.successLocal':
    'Konfigurasi Imgur disimpan secara lokal.',
  'settings.integrations.imgur.saveError': 'Gagal menyimpan konfigurasi Imgur.',
  'settings.travel.blocked.notDesktop':
    'Hanya tersedia di aplikasi desktop yang terautentikasi.',
  'settings.travel.blocked.noEmail':
    'Pengiriman email tidak dikonfigurasi di lingkungan ini.',
  'settings.travel.blocked.validating': 'Memvalidasi konfigurasi email…',
  'settings.integrations.blogger.title': 'CDN Blogger',
  'settings.integrations.blogger.desc':
    'Hosting gambar dan publikasi langsung.',
  'settings.integrations.imgur.desc': 'Rotasi Client ID untuk unggahan anonim.',
  'settings.theme.title': 'Tampilan',
  'settings.theme.description':
    'Pilih antara mode gelap dan terang untuk antarmuka.',
  'settings.theme.dark': 'Gelap',
  'settings.theme.darkDesc': 'Antarmuka gelap default',
  'settings.theme.light': 'Terang',
  'settings.theme.lightDesc': 'Antarmuka terang',
  'settings.language.title': 'Bahasa antarmuka',
  'settings.language.description':
    'Pilih bahasa aplikasi. Di desktop, deteksi awal menggunakan bahasa pilihan sistem Anda.',
  'settings.language.label': 'Bahasa',
  'settings.language.systemLabel': 'Terdeteksi dari sistem',
  'settings.language.applied':
    'Perubahan langsung diterapkan dan disimpan di perangkat ini untuk build dev maupun packaged.',
  'auth.tabs.login': 'Masuk',
  'auth.tabs.register': 'Buat Akun',
  'auth.legal.reviewDocs':
    'Dengan melanjutkan, harap tinjau dokumentasi hukum kami:',
  'auth.quote.line1': 'Setiap kisah hebat',
  'auth.quote.line2': 'dimulai dengan',
  'auth.quote.line3': 'satu halaman.',
  'auth.stats.activeScanlators': 'Pengguna aktif',
  'auth.stats.tools': 'Alat',
  'auth.stats.pagesProcessed': 'Halaman diproses',
  'auth.toolkit.ai': 'AI & Otomasi',
  'auth.toolkit.tools': 'Alat',
  'auth.toolkit.learning': 'Pembelajaran',
  'auth.toolkit.aiTranslation': 'Terjemahan AI',
  'auth.toolkit.autoRedraw': 'Redraw Otomatis',
  'auth.toolkit.advancedEditor': 'Editor Lanjutan',
  'auth.toolkit.proTypesetting': 'Typesetting Pro',
  'auth.toolkit.qualityControl': 'Kontrol Kualitas',
  'auth.toolkit.guides': 'Panduan & Tutorial',
  'auth.toolkit.resources': 'Sumber Daya & Aset',
  'auth.community.join': 'Bergabung dengan komunitas',
  'auth.cover.popular': 'POPULER',
  'auth.cover.new': 'BARU',
  'auth.cover.cleanRedraw': 'Clean + Redraw',
  'auth.cover.translation': 'Terjemahan',
  'auth.cover.typography': 'Tipografi',
  'auth.cover.fullEditing': 'Editing Penuh',
  'auth.cover.allInOne': 'AIO - All in One',
  'auth.cover.finalQc': 'Pembersihan',
  'login.subtitle.credentials':
    'Masuk ke akun Anda dan lanjutkan dari terakhir kali.',
  'login.subtitle.travel':
    'Otorisasi sementara komputer ini tanpa meninggalkan alur masuk.',
  'login.error.completeCaptchaTravel':
    'Selesaikan captcha untuk menyelesaikan otorisasi komputer ini.',
  'login.error.completeCaptcha': 'Selesaikan captcha untuk melanjutkan.',
  'login.error.missingCredentials':
    'Kembali dan masukkan email serta kata sandi akun sebelum mengotorisasi komputer ini.',
  'login.error.missingTravelToken':
    'Masukkan token yang diterima melalui email untuk menyelesaikan proses masuk.',
  'login.error.generic': 'Gagal masuk',
  'login.warning.mandatoryUpdateTitle': 'Pembaruan wajib tersedia',
  'login.warning.mandatoryUpdateBody':
    'Instal versi {version} untuk terus menggunakan aplikasi.',
  'login.warning.downloadUpdate': 'Unduh pembaruan',
  'login.warning.downloadingUpdate': 'Mengunduh pembaruan...',
  'login.warning.installUpdateNow': 'Instal pembaruan sekarang',
  'login.verification.title': 'Yang harus dilakukan',
  'login.verification.wait': 'Tunggu {seconds} detik.',
  'login.verification.retrySameDevice':
    'Coba masuk lagi dari perangkat atau jaringan yang sama.',
  'login.verification.avoidVpn':
    'Hindari berganti VPN atau jaringan selama periode ini.',
  'login.email': 'Email',
  'login.password': 'Kata Sandi',
  'login.forgotPassword': 'Lupa kata sandi',
  'login.rememberMe': 'Ingat saya di perangkat ini',
  'login.travel.eyebrow': 'Pemeriksaan keamanan',
  'login.travel.title': 'Komputer ini memerlukan otorisasi sementara',
  'login.travel.copy':
    'Buka KŌMA Studio di PC utama Anda dan buka Pengaturan > Akses Perjalanan untuk mengirim kode dan menyelesaikan proses masuk ini.',
  'login.travel.accountInUse': 'Akun yang digunakan: {email}',
  'login.travel.sameAccount':
    'Gunakan akun yang sama yang sudah terbuka di PC utama Anda.',
  'login.travel.emailDisabled':
    'Pengiriman email tidak dikonfigurasi di lingkungan ini.',
  'login.travel.emailEnabled': 'Kode akan dikirim ke email utama akun.',
  'login.travel.step1': 'Buka aplikasi di komputer utama Anda.',
  'login.travel.step2': 'Kirim token ke email akun.',
  'login.travel.step3':
    'Tempel kode di bawah untuk mengotorisasi komputer ini.',
  'login.travel.tokenLabel': 'Token perjalanan',
  'login.travel.tokenPlaceholder': 'Tempel kode yang diterima melalui email',
  'login.button.authorizing': 'Mengotorisasi...',
  'login.button.validating': 'Memvalidasi...',
  'login.button.updateRequired': 'Perbarui aplikasi untuk masuk',
  'login.button.retryIn': 'Coba lagi dalam {seconds}d',
  'login.button.authorizeComputer': 'Otorisasi komputer ini',
  'login.button.login': 'Masuk ke akun saya',
  'login.button.changeAccount': 'Kembali dan ganti akun',
  'login.emailPlaceholder': 'anda@email.com',
  'login.passwordPlaceholder': '••••••••',
  'login.warning.latestVersion': 'terbaru',
  'login.newHere': 'Baru di sini?',
  'login.createFreeAccount': 'Buat akun gratis Anda',
  'register.subtitle': 'Buat akun Anda dan mulai jelajahi ribuan judul.',
  'register.error.passwordMismatch': 'Kata sandi tidak cocok.',
  'register.error.completeCaptcha':
    'Selesaikan captcha untuk menyelesaikan pendaftaran.',
  'register.error.acceptTerms':
    'Anda harus menerima Ketentuan Layanan dan Kebijakan Privasi untuk membuat akun.',
  'register.error.generic': 'Pendaftaran gagal',
  'register.displayName': 'Nama tampilan',
  'register.displayNamePlaceholder': 'Apa nama panggilan Anda?',
  'register.password': 'Kata Sandi',
  'register.passwordPlaceholder': 'Minimal 8 karakter',
  'register.confirmPassword': 'Konfirmasi kata sandi',
  'register.confirmPasswordPlaceholder': 'Masukkan ulang kata sandi Anda',
  'register.legalPrefix': 'Saya telah membaca dan menerima',
  'register.legalSuffix':
    'Saya memahami bahwa pendaftaran menggunakan cookie yang sangat diperlukan dan bahwa fitur seperti laporan bug dan integrasi diatur oleh dokumen di atas.',
  'register.button.creating': 'Membuat akun...',
  'register.button.loginNow': 'Masuk sekarang',
  'legal.links.terms': 'Ketentuan Layanan',
  'legal.links.privacy': 'Kebijakan Privasi',
  'legal.links.cookies': 'Kebijakan Cookie',
  'legal.links.content': 'Pemberitahuan Konten',
  'transition.tips.loading': '読み込み中...',
  'transition.tips.preparing': 'Menyiapkan studio Anda...',
  'transition.tips.opening': 'Membuka ruang editing Anda...',
  'transition.tips.organizing': 'Mengatur panel Anda...',
  'transition.tips.warming': 'Memanaskan alat-alat...',
  'transition.tips.workflow': 'Memuat alur kerja Anda...',
  'transition.ariaLabel': 'Halaman pemuatan',
  'ranking.discover.title': 'Jadilah yang pertama mengulas',
  'ranking.discover.subtitle':
    'Model resmi tanpa ulasan berdasarkan filter saat ini.',
  'ranking.discover.available': '{count} tersedia',
  'ranking.discover.empty': 'Semua model yang difilter sudah memiliki ulasan.',
  'ranking.discover.local': 'Lokal',
  'ranking.discover.cloud': 'Cloud',
  'legalHub.version': 'Versi',
  'legalHub.updatedAt': 'Diperbarui pada',
  'register.button.create': 'Buat akun saya',
  'register.alreadyHaveAccount': 'Sudah punya akun?',
  'password.rule.minLength': 'Minimal 8 karakter',
  'password.rule.uppercase': 'Huruf kapital',
  'password.rule.lowercase': 'Huruf kecil',
  'password.rule.number': 'Angka',
  'password.rule.special': 'Karakter spesial',
  'password.level.veryWeak': 'Sangat lemah',
  'password.level.weak': 'Lemah',
  'password.level.fair': 'Cukup',
  'password.level.good': 'Bagus',
  'password.level.strong': 'Kuat',
  'captcha.loadError': 'Gagal memuat skrip Turnstile',
  'captcha.missingSiteKey':
    'Captcha diaktifkan, tetapi VITE_TURNSTILE_SITE_KEY belum dikonfigurasi.',
  'captcha.initError': 'Gagal menginisialisasi captcha',
  'captcha.securityCheck': 'Pemeriksaan keamanan',
  'captcha.loadScriptError': 'Gagal memuat skrip Turnstile',
  'captcha.success': 'Captcha berhasil divalidasi.',
  'forgot.title': 'Pulihkan kata sandi',
  'forgot.subtitle':
    'Masukkan email Anda untuk menerima tautan reset kata sandi.',
  'forgot.success':
    'Jika akun dengan email ini ada, Anda akan menerima instruksi untuk mereset kata sandi Anda.',
  'forgot.error': 'Gagal meminta reset kata sandi',
  'forgot.button.sending': 'Mengirim...',
  'forgot.button.send': 'Kirim tautan reset',
  'forgot.remembered': 'Ingat kata sandi Anda?',
  'forgot.backToLogin': 'Kembali ke halaman masuk',
  'reset.title': 'Kata sandi baru',
  'reset.subtitle': 'Tetapkan kata sandi yang kuat untuk akun Anda.',
  'reset.error.missingToken': 'Token reset tidak ada atau tidak valid.',
  'reset.error.generic': 'Gagal mereset kata sandi',
  'reset.success': 'Kata sandi berhasil direset. Anda sekarang bisa masuk.',
  'reset.newPassword': 'Kata sandi baru',
  'reset.button.submitting': 'Mereset...',
  'reset.button.submit': 'Reset kata sandi',
  'verify.title': 'Verifikasi email',
  'verify.subtitle.pending': 'Konfirmasi email Anda untuk membuka semua fitur.',
  'verify.subtitle.done': 'Email Anda sudah dikonfirmasi.',
  'verify.noEmail': 'tanpa-email',
  'verify.verified': 'Terverifikasi',
  'verify.success': 'Email konfirmasi terkirim. Periksa kotak masuk Anda.',
  'verify.error': 'Gagal mengirim email',
  'verify.button.sending': 'Mengirim...',
  'verify.button.resend': 'Kirim ulang email verifikasi',
  'verify.button.alreadyConfirmed': 'Email sudah dikonfirmasi',
  'verify.button.backDashboard': 'Kembali ke dasbor',
  'confirm.title.verifying': 'Mengonfirmasi email...',
  'confirm.title.success': 'Email dikonfirmasi!',
  'confirm.title.error': 'Konfirmasi gagal',
  'confirm.subtitle.verifying':
    'Kami sedang memvalidasi tautan konfirmasi Anda.',
  'confirm.subtitle.success':
    'Email Anda telah dikonfirmasi. Anda sekarang dapat menggunakan semua fitur.',
  'confirm.subtitle.error':
    'Tautan konfirmasi tidak valid atau sudah kedaluwarsa. Silakan minta email baru.',
  'confirm.status.wait': 'Harap tunggu sementara kami memverifikasi...',
  'confirm.errorCode': 'Kode error:',
  'confirm.success': 'Konfirmasi berhasil diselesaikan.',
  'confirm.goDashboard': 'Buka dasbor',
  'confirm.goLogin': 'Buka halaman masuk',
  'banned.title': 'Akses diblokir',
  'banned.subtitle': 'Akses ini ditangguhkan oleh moderasi aplikasi.',
  'banned.reason': 'Alasan',
  'banned.scope': 'Cakupan',
  'banned.duration': 'Durasi',
  'banned.until': 'Sementara hingga {value}',
  'banned.undefinedDate': 'tanggal tidak ditentukan',
  'banned.permanent': 'Permanen',
  'banned.policy':
    'Tautan, postingan berbahaya, atau perilaku kasar dapat mengakibatkan pemblokiran permanen dari aplikasi.',
  'banned.backToLogin': 'Kembali ke halaman masuk',
  'session.expiresIn':
    'Sesi Anda akan berakhir dalam {seconds}d karena tidak aktif.',
  'session.stayConnected': 'Tetap terhubung',
  'update.toast.availableTitle': 'Pembaruan baru tersedia',
  'update.toast.availableDescription':
    'Versi {version} siap diunduh di kanal {channel}.',
  'update.toast.downloadedTitle': 'Pembaruan siap',
  'update.toast.downloadedDescription':
    'Pembaruan siap. {percent}% selesai. Instal sekarang atau saat Anda menutup aplikasi.',
  'update.toast.downloadingTitle': 'Mengunduh pembaruan',
  'update.toast.downloadingDescription': '{percent}% selesai.',
  'update.toast.closeAria': 'Tutup banner pembaruan',
  'update.channel.beta': 'Beta',
  'update.channel.stable': 'Stabil',
  'update.button.download': 'Unduh',
  'update.button.details': 'Detail',
  'update.button.installNow': 'Instal sekarang',
  'update.button.installLater': 'Instal nanti',
  'update.progress.title': 'Mengunduh pembaruan...',
  'update.modal.title': 'Pembaruan tersedia',
  'update.modal.unknownVersion': 'tidak diketahui',
  'update.modal.closeAria': 'Tutup modal',
  'update.modal.mandatory':
    'Pembaruan ini wajib. Unduh dan instal untuk terus menggunakan aplikasi.',
  'update.modal.releaseNotes': 'Catatan Rilis',
  'update.modal.releaseNotesEmpty': 'Tidak ada catatan rilis untuk versi ini.',
  'update.modal.readyProgress': 'Pembaruan siap. 100% selesai.',
  'update.modal.downloadingProgress': 'Mengunduh pembaruan...',
  'update.modal.readyToInstall': 'Siap diinstal',
  'update.modal.installHintAuto':
    'Jika Anda menutup aplikasi sekarang, instalasi akan dimulai secara otomatis.',
  'update.modal.installHintManual':
    'Instal saat ditutup dinonaktifkan. Gunakan "Instal nanti" untuk mengaktifkannya dan menutup dengan aman.',
  'update.modal.downloadAction': 'Unduh Pembaruan',
  'update.modal.downloadingAction': 'Mengunduh...',
  'update.modal.installAction': 'Instal sekarang',
  'update.modal.installLaterAction': 'Instal nanti (saat ditutup)',
  'update.modal.laterAction': 'Nanti',
  'dropzone.invalidImageAlert':
    'Harap unggah file gambar yang valid (PNG/JPG).',
  'dropzone.clickOrDrag': 'Klik atau seret gambar ke sini',
  'dropzone.supports': 'Mendukung PNG dan JPG',
  'actionButtons.cleaning': 'Membersihkan...',
  'actionButtons.cleanImage': 'Bersihkan gambar',
  'actionButtons.downloadResult': 'Unduh hasil',
  'aio.model.manage': 'Model',
  'aio.model.noneAvailable': 'Tidak ada model tersedia',
  'aio.model.device': 'Perangkat',
  'aio.model.languages': 'Bahasa',
  'aio.model.languages.multi': 'multi',
  'aio.model.noDescription': 'Tidak ada deskripsi.',
  'aio.model.localStatus': 'Status lokal: {value}',
  'aio.stage.detectText': 'Deteksi Teks',
  'aio.stage.recognizeText': 'Kenali Teks',
  'aio.stage.getTranslations': 'Dapatkan Terjemahan',
  'aio.stage.segmentText': 'Segmentasi Teks',
  'aio.stage.cleanImage': 'Bersihkan Gambar',
  'aio.stage.tabsBarAria': 'Konfigurasi tahap',
  'aio.render.title': 'Teks Ter-render',
  'aio.render.description.manual':
    'Klik dua kali kotak untuk mengedit langsung. Dock kontekstual muncul di dekat pilihan dengan teks ter-render.',
  'aio.render.description.auto':
    'Mode otomatis menerapkan rendering default ke area yang diterjemahkan.',
  'aio.render.activePage': 'Halaman aktif: {count} blok. Terpilih: {selected}.',
  'aio.render.contextualDock.visible': 'terlihat saat dipilih',
  'aio.render.contextualDock.doubleClick':
    'klik dua kali untuk mulai mengedit dan menampilkan dock',
  'aio.render.contextualDock.select': 'pilih kotak untuk menggunakan dock',
  'aio.render.contextualDock': 'Dock kontekstual: {value}',
  'aio.render.shortcut':
    'Pintasan: gunakan Shift + Scroll pada pratinjau untuk memutar teks kotak yang dipilih.',
  'aio.render.inactiveStage':
    'Gambar ini berada pada tahap sebelum Render. Gunakan maju untuk melihat/mengedit teks ter-render.',
  'aio.render.fontCatalog': 'Katalog Font',
  'aio.render.refreshFonts': 'Segarkan Font',
  'aio.render.refreshingFonts': 'Menyegarkan...',
  'aio.render.importFont': 'Impor Font',
  'aio.render.importingFont': 'Mengimpor...',
  'aio.render.importFontTitleDesktop': 'Impor font kustom ke aplikasi desktop',
  'aio.render.importFontTitleBrowser':
    'Impor hanya tersedia di aplikasi desktop',
  'aio.render.desktopFontsHint':
    'Font Windows yang terinstal dan impor kustom tersedia di aplikasi desktop.',
  'aio.render.overlayControlsHint':
    'Kontrol font, ukuran, perataan, dan warna kini ada di dock kontekstual overlay.',
  'aio.render.applyStyleAll': 'Terapkan Gaya Saat Ini ke Semua Pilihan',
  'aio.render.applyStyleAllTitle':
    'Terapkan gaya pilihan saat ini ke semua pilihan di semua gambar',
  'aio.region.title': 'Area Terdeteksi',
  'aio.region.description.manual':
    'Seret pada pratinjau untuk menambah area baru. Seret kotak untuk memindahkannya dan gunakan sudut untuk mengubah ukuran.',
  'aio.region.description.auto':
    'Beralih ke mode Manual untuk menyesuaikan kotak yang terdeteksi.',
  'aio.region.activePage': 'Halaman aktif: {count} area. Terpilih: {selected}.',
  'aio.region.ocr': 'OCR area terpilih: {value}',
  'aio.region.translation': 'Terjemahan area terpilih: {value}',
  'aio.region.notes': 'Catatan area terpilih: {value}',
  'aio.region.segmentation': 'Segmentasi area terpilih: {value}',
  'aio.region.noSelection': 'tidak ada',
  'aio.region.noRecognizedText': 'tidak ada teks yang dikenali',
  'aio.region.ocrDisabled': 'Tahap OCR dinonaktifkan',
  'aio.region.noTranslation': 'tidak ada terjemahan tersedia',
  'aio.region.translationDisabled': 'tahap terjemahan dinonaktifkan',
  'aio.region.noNotes': 'tidak ada catatan tersedia',
  'aio.region.notesDisabled': 'catatan dinonaktifkan',
  'aio.region.noSelectedRegion': 'tidak ada area terpilih',
  'aio.region.segmentedBoxes': '{count} kotak tersegmentasi',
  'aio.region.removeSelected': 'Hapus Terpilih',
  'aio.region.duplicateSelected': 'Duplikat Terpilih',
  'aio.manual.toolsHintPrimary':
    'Gunakan dock mengambang di kanvas untuk Pilih Area, Bersihkan Halaman, dan edit segmentasi/manual.',
  'aio.manual.toolsHintSecondary':
    'Alat diaktifkan secara otomatis berdasarkan tahap aktif gambar.',
  'aio.run.manualNoActive':
    'Pilih gambar aktif untuk menjalankan tahap manual.',
  'aio.run.manualCurrentOnly':
    'Jalankan hanya tahap saat ini untuk gambar terpilih.',
  'aio.run.processing': 'Memproses {percent}%',
  'aio.run.rerunCurrent': 'Jalankan ulang tahap saat ini (gambar aktif)',
  'aio.run.runCurrent': 'Jalankan tahap saat ini (gambar aktif)',
  'aio.run.full':
    'Jalankan AIO (Deteksi + OCR + Terjemahan + Segmentasi + Bersihkan + Render)',
  'aio.pipeline.textModeTitle': 'Mode Teks',
  'aio.pipeline.textModeDescription':
    'Tentukan bagaimana area terpilih diperlakukan saat render. AUTO menggunakan klasifikasi yang terdeteksi.',
  'aio.pipeline.currentSelectionMode': 'Mode Pilihan Saat Ini',
  'aio.pipeline.currentSelectionModeAria': 'Mode teks dari pilihan saat ini',
  'aio.pipeline.autoResolved': 'AUTO diselesaikan ke {value}.',
  'aio.pipeline.currentMode': 'Mode saat ini: {value}.',
  'aio.pipeline.selectPreviewBox':
    'Pilih kotak di pratinjau untuk mengubah mode teks.',
  'aio.pipeline.title': 'Pipeline AIO',
  'aio.pipeline.description.auto':
    'Konfigurasikan pipeline lengkap (deteksi, OCR, terjemahan, segmentasi, dan pembersihan) sebelum menjalankan batch.',
  'aio.pipeline.description.manual':
    'Mode manual: jalankan atau lewati tahap secara berurutan untuk gambar terpilih.',
  'aio.pipeline.render': 'Render',
  'aio.pipeline.renderSubtitle': 'Terapkan teks terjemahan ke gambar akhir',
  'aio.pipeline.executeCurrentTitle':
    'Jalankan hanya tahap saat ini untuk gambar terpilih',
  'aio.pipeline.executingStage': 'Menjalankan tahap...',
  'aio.pipeline.rerunStage': 'Jalankan ulang tahap',
  'aio.pipeline.runStage': 'Jalankan tahap',
  'aio.pipeline.skipStage': 'Lewati tahap',
  'aio.pipeline.skipStageTitle':
    'Lewati tahap saat ini dan buka tahap berikutnya',
  'aio.pipeline.rewind': 'Mundur',
  'aio.pipeline.rewindTitle': 'Kembali ke tahap pipeline AIO sebelumnya',
  'aio.pipeline.forward': 'Maju',
  'aio.pipeline.forwardTitle': 'Lanjut ke tahap pipeline AIO berikutnya',
  'aio.pipeline.manualImageStatus': 'Manual per gambar: "{image}" di {stage}.',
  'aio.pipeline.selectImageManual':
    'Pilih gambar untuk memulai alur manual tahap demi tahap.',
  'aio.pipeline.currentStage': 'Tahap saat ini: {label} ({current}/{total}).',
  'aio.pipeline.runToEnable':
    'Jalankan AIO untuk mengaktifkan mundur/maju tahap demi tahap.',
  'aio.pipeline.manualHint':
    'Buat prosesnya jauh lebih andal: dalam mode manual, setiap tahap yang Anda sesuaikan dijalankan dengan kontrol, tinjauan, dan presisi lebih. Hanya gambar terpilih yang diproses, dan kuota hanya digunakan pada proses manual pertama setiap gambar (atau nol jika sudah melewati AIO otomatis).',
  'dashboard.enhance.profile.mangaScan': 'Pindaian Manga',
  'dashboard.enhance.profile.animeArt': 'Seni Anime',
  'dashboard.enhance.profile.general': 'Umum',
  'dashboard.enhance.profile.highQuality4x': 'Kualitas tinggi 4x',
  'dashboard.emptyTip.1':
    'Jika gambar terlalu besar dan Anda mengalami error saat pembersihan, terjemahan, atau redraw, coba bagi menjadi bagian yang lebih kecil. Ini biasanya menstabilkan pemrosesan.',
  'dashboard.emptyTip.2':
    'Mode otomatis mempercepat alur kerja, tetapi untuk hasil yang 100% sempurna, ada baiknya meninjau dalam mode manual dan memperbaiki detail akhir.',
  'dashboard.emptyTip.3':
    'Gunakan alat refine untuk membuat teks lebih bersih, lebih seimbang, dan sesuai standar scanlation.',
  'dashboard.emptyTip.4':
    'Anda dapat mengganti bentuk balon antara persegi panjang dan elips agar lebih sesuai dengan teks di setiap halaman.',
  'dashboard.emptyTip.5':
    'Atur preset di halaman pengaturan untuk mempercepat tugas berulang dan menjaga konsistensi antar chapter.',
  'dashboard.emptyTip.6':
    'Coba model berbeda untuk setiap bahasa. OCR atau translator terbaik untuk Jepang mungkin tidak ideal untuk Korea, Mandarin, atau Inggris.',
  'dashboard.emptyTip.7':
    'Vote untuk model yang paling membantu alur kerja Anda. Ini meningkatkan peringkat dan membantu pengguna lain dalam memilih.',
  'dashboard.emptyTip.8': 'Jika terjemahan cloud mahal atau tidak stabil, sesuaikan preset Anda dan siapkan fallback lokal agar produksi tidak terhenti.',
  'dashboard.emptyTip.9':
    'Gunakan Visual Translator untuk meninjau area tertentu tanpa harus menjalankan ulang seluruh chapter.',
  'dashboard.emptyTip.10':
    'Di Typesetter, penyesuaian manual kecil pada perataan, font, dan spasi membuat perbedaan besar pada hasil akhir.',
  'dashboard.emptyTip.11':
    'Jika teks terasa terlalu rapat, kurangi jumlah teks dalam kotak, perbaiki terjemahan, atau sesuaikan balon sebelum memperkecil font terlalu banyak.',
  'dashboard.emptyTip.12':
    'Jika output OCR buruk, coba model lain sebelum memperbaiki semuanya secara manual. Mengganti model sering kali menyelesaikan sebagian besar error.',
  'dashboard.emptyTip.13':
    'Gunakan catatan terjemahan hanya jika benar-benar memberi nilai tambah bagi pembaca. Lebih sedikit gangguan membuat pengalaman membaca lebih bersih.',
  'dashboard.emptyTip.14':
    'Simpan profil LLM dan OCR kustom untuk membandingkan pengaturan dengan cepat tanpa mengonfigurasi ulang semuanya untuk setiap tes.',
  'dashboard.emptyTip.15':
    'Jika halaman gagal dalam alur AIO, jalankan tahap secara terpisah di Production untuk menemukan titik masalahnya.',
  'dashboard.aio.progress.detectText': 'mendeteksi teks',
  'dashboard.aio.progress.recognizeText': 'mengenali teks',
  'dashboard.aio.progress.getTranslations': 'menerjemahkan teks',
  'dashboard.aio.progress.segmentText': 'mensegmentasi teks',
  'dashboard.aio.progress.cleanImage': 'membersihkan gambar',
  'dashboard.aio.progress.render': 'menyiapkan render',
  'dashboard.aio.subtitle.detectText': 'Mencari area teks pada gambar',
  'dashboard.aio.subtitle.recognizeText': 'OCR untuk mengekstrak konten teks',
  'dashboard.aio.subtitle.getTranslations':
    'Terjemahan otomatis melalui layanan/model yang dipilih',
  'dashboard.aio.subtitle.segmentText':
    'Perbaiki area dengan segmentasi (gaya Baka)',
  'dashboard.aio.subtitle.cleanImage':
    'Inpainting dengan AOT/LaMa + mask gaya Baka',
  'dashboard.aio.manualStatus.locked': 'Terkunci',
  'dashboard.aio.manualStatus.pending': 'Menunggu',
  'dashboard.aio.manualStatus.done': 'Selesai',
  'dashboard.aio.manualStatus.skipped': 'Dilewati',
  'dashboard.mode.underDevelopment': 'Masih dalam pengembangan.',
  'dashboard.nav.group.main': 'Utama',
  'dashboard.nav.group.production': 'Produksi',
  'dashboard.nav.group.utils': 'Utilitas',
  'dashboard.nav.group.info': 'Informasi',
  'dashboard.nav.short.aio': 'AIO',
  'dashboard.nav.short.cleaner': 'Cleaner/RD',
  'dashboard.nav.short.enhance': 'Enhance',
  'dashboard.nav.subtitle.organize': 'Kelola file',
  'dashboard.nav.subtitle.aio': 'All in One',
  'dashboard.nav.subtitle.cleaner': 'Cleaner & Redrawer',
  'dashboard.nav.subtitle.typesetter': 'Typesetter',
  'dashboard.nav.subtitle.translator': 'Translator',
  'dashboard.nav.subtitle.raw': 'Raw Provider',
  'dashboard.nav.subtitle.proofreader': 'Proofreader & QC',
  'dashboard.nav.subtitle.stitch': 'Stitcher',
  'dashboard.nav.subtitle.split': 'Splitter',
  'dashboard.nav.subtitle.watermark': 'Watermark',
  'dashboard.nav.subtitle.enhance': 'Enhancer',
  'dashboard.nav.subtitle.optimizer': 'Chapter Optimizer',
  'dashboard.nav.subtitle.blogger': 'Publisher & Host',
  'dashboard.nav.subtitle.imgur': 'Anonymous Host',
  'dashboard.nav.subtitle.guides': 'Tutorial',
  'dashboard.nav.subtitle.resources': 'Sumber Daya',
  'dashboard.nav.tooltip.organize':
    'Atur dan urutkan ulang gambar Anda sebelum diproses',
  'dashboard.nav.tooltip.aio':
    'Pipeline lengkap: deteksi, kenali, terjemahkan, segmentasi, bersihkan, dan render',
  'dashboard.nav.tooltip.cleaner': 'Bersihkan balon dan redraw area gambar',
  'dashboard.nav.tooltip.typesetter':
    'Terapkan tipografi dan gaya teks pada halaman',
  'dashboard.nav.tooltip.translator':
    'Terjemahkan teks bebas atau tinjau OCR/terjemahan per area gambar',
  'dashboard.nav.tooltip.raw': 'Kelola dan suplai gambar mentah untuk pipeline',
  'dashboard.nav.tooltip.proofreader':
    'Tinjau terjemahan dan verifikasi kualitas akhir',
  'dashboard.nav.tooltip.stitch':
    'Gabungkan beberapa gambar menjadi strip berkelanjutan',
  'dashboard.nav.tooltip.split':
    'Bagi gambar panjang menjadi bagian yang lebih kecil',
  'dashboard.nav.tooltip.watermark':
    'Tambahkan watermark ke gambar secara massal',
  'dashboard.nav.tooltip.enhance': 'Tingkatkan kualitas dan resolusi gambar',
  'dashboard.nav.tooltip.optimizer':
    'Optimalkan output akhir untuk web, pembacaan, atau pengarsipan',
  'dashboard.nav.tooltip.blogger':
    'Publikasikan postingan ke Blogger dan buat URL gambar yang di-hosting',
  'dashboard.nav.tooltip.imgur':
    'Unggah gambar ke Imgur dengan rotasi Client ID',
  'dashboard.nav.tooltip.guides': 'Panduan penggunaan alat dan tutorial',
  'dashboard.nav.tooltip.resources':
    'Sumber daya, tautan, dan materi referensi',
  'dashboard.mode.organize': 'Atur',
  'dashboard.mode.aio': 'AIO — All in One',
  'dashboard.mode.cleaner': 'Cleaner / Redrawer',
  'dashboard.mode.typesetter': 'Typesetter',
  'dashboard.mode.translator': 'Translator',
  'dashboard.mode.raw': 'Raw Provider',
  'dashboard.mode.proofreader': 'Proofreader / QC',
  'dashboard.mode.stitch': 'Stitch (Webtoon)',
  'dashboard.mode.split': 'Smart Split',
  'dashboard.mode.watermark': 'Watermark',
  'dashboard.mode.enhance': 'Enhance Gambar',
  'dashboard.mode.optimizer': 'Chapter Optimizer',
  'dashboard.mode.blogger': 'CDN Blogger',
  'dashboard.mode.imgur': 'Unggah Imgur',
  'dashboard.mode.guides': 'Panduan & Tutorial',
  'dashboard.mode.resources': 'Sumber Daya & Materi',
  'dashboard.status.modelSelected': 'Model dipilih untuk {stage}: {model}',
  'dashboard.status.verifyEmailRequired':
    'Konfirmasi email Anda untuk melakukan tindakan ini.',
  'dashboard.status.imagesCount': '{count} gambar',
  'dashboard.status.noImage': 'Tidak ada gambar',
  'dashboard.status.freeText': 'teks-bebas',
  'dashboard.user.defaultName': 'Pengguna',
  'dashboard.topbar.thisTab': 'Tab ini',
  'dashboard.aio.config.title': 'Konfigurasi Tahap',
  'dashboard.footer.hardware.nvidia': 'Akselerasi NVIDIA performa maksimum.',
  'dashboard.footer.hardware.intel': 'Akselerasi khusus Intel digunakan.',
  'dashboard.footer.hardware.cpu': 'Eksekusi lokal tanpa akselerasi khusus.',
  'dashboard.footer.quickLinks': 'Tautan cepat',
  'dashboard.footer.lastSave.never': 'Belum disimpan di sesi ini',
  'dashboard.footer.lastSave.label': 'Terakhir disimpan: {time}',
  'dashboard.cleaner.flow.local.title':
    'Alur terstruktur dengan OCR, segmentasi, dan inpainting lokal',
  'dashboard.cleaner.flow.ai.title':
    'Pembersihan otomatis dengan AI multimodal dan rekonstruksi terpandu',
  'dashboard.cleaner.flow.local.desc':
    'Menggunakan detektor lokal untuk mengajukan kandidat, mengklasifikasikan area mana yang benar-benar SFX, dan hanya membersihkan yang disetujui.',
  'dashboard.cleaner.flow.ai.desc':
    'Menggunakan deteksi struktural proyek untuk memandu AI, memperkuat pelestarian balon/seni, dan merekomposisi gambar besar dengan sambungan yang lebih halus.',
  'dashboard.cleaner.instructions.placeholder':
    'Cth.: pertahankan gradien merah lebih baik, lebih konservatif pada SFX kecil, prioritaskan untuk tidak menyentuh kotak naratif.',
  'dashboard.cleaner.instructions.hint.local':
    'Instruksi ini dimasukkan sebagai konteks tambahan setelah aturan klasifikasi dan pembersihan SFX dasar.',
  'dashboard.cleaner.instructions.hint.ai':
    'Instruksi ini dimasukkan sebagai konteks tambahan. Aturan inti AI cleaner tetap di atas instruksi pengguna untuk menjaga logika pembersihan.',
  'dashboard.cleaner.inspection.title': 'Inspeksi',
  'dashboard.cleaner.segmentation.manage': 'Kelola model segmentasi',
  'dashboard.cleaner.segmentation.model': 'Model segmentasi',
  'dashboard.aio.gpuStages.title': 'Penggunaan GPU per Tahap',
  'dashboard.aio.gpuStages.hint':
    'Pilih tahap mana yang harus menggunakan akselerasi GPU. Hapus centang untuk memaksa eksekusi CPU (berguna jika GPU tidak memiliki cukup VRAM untuk semua tahap).',
  'dashboard.aio.gpuStages.detect': 'Deteksi teks (GPU)',
  'dashboard.aio.gpuStages.ocr': 'OCR / Pengenalan (GPU)',
  'dashboard.aio.gpuStages.segment': 'Segmentasi (GPU)',
  'dashboard.aio.gpuStages.clean': 'Pembersihan / Inpainting (GPU)',
  'dashboard.aio.gpuStages.noActiveProfile':
    'Belum ada profil GPU aktif yang terkonfirmasi saat ini. Bagian ini tetap terlihat untuk mencegah hilang-muncul; toggle akan kembali berlaku begitu profil GPU tersedia.',
  'dashboard.aio.config.loadingCatalogs': 'Memuat katalog lokal dan cloud...',
  'dashboard.aio.preparingManual': 'Menyiapkan tahap manual AIO...',
  'dashboard.aio.preparingAuto': 'Menyiapkan proses otomatis AIO...',
  'dashboard.aio.stopping': 'Menghentikan proses AIO...',
  'dashboard.aio.abortedByUser': 'Proses AIO dibatalkan oleh pengguna.',
  'dashboard.aio.abortedMiniBackendRestarted':
    'Proses AIO dibatalkan. Mini-backend dimulai ulang.',
  'dashboard.aio.abortedMiniBackendRestartFailed':
    'Proses AIO dibatalkan. Tidak dapat memulai ulang mini-backend secara otomatis.',
  'dashboard.llm.customProfilesLoadFailed': 'Gagal memuat profil LLM kustom.',
  'dashboard.status.ready': 'Siap memproses gambar.',
  'dashboard.workspace.pendingChanges':
    'Workspace memiliki perubahan yang tertunda.',
  'dashboard.status.restored': 'Workspace dipulihkan.',
  'dashboard.status.historyRestored': 'Perubahan dipulihkan dari riwayat.',
  'dashboard.status.undo': 'Workspace di-undo.',
  'dashboard.status.redo': 'Workspace di-redo.',
  'dashboard.status.saved': 'Workspace disimpan secara lokal.',
  'dashboard.status.exportCancelled': 'Ekspor workspace dibatalkan.',
  'dashboard.status.exportSuccess': 'Workspace berhasil diekspor.',
  'dashboard.status.importCancelled': 'Impor workspace dibatalkan.',
  'dashboard.status.importSuccess': 'Workspace berhasil diimpor.',
  'dashboard.status.importSaved':
    'Workspace diimpor dan disimpan secara lokal.',
  'dashboard.status.importNoAutosave':
    'Workspace diimpor. Simpan otomatis dinonaktifkan.',
  'dashboard.status.autosaveRemoved': 'Simpan otomatis lokal dihapus.',
  'dashboard.status.nothingToUndo': 'Tidak ada yang bisa di-undo di workspace.',
  'dashboard.status.nothingToRedo': 'Tidak ada yang bisa di-redo di workspace.',
  'dashboard.sections.pipeline': 'Pipeline',
  'dashboard.sections.languages': 'Bahasa',
  'dashboard.sections.modelsConfig': 'Model & Konfigurasi',
  'dashboard.sections.presets': 'Preset',
  'dashboard.sections.region': 'Area',
  'dashboard.aio.rewind': 'AIO mundur: tahap "{label}" ({current}/{total}).',
  'dashboard.aio.forward': 'AIO maju: tahap "{label}" ({current}/{total}).',
  'dashboard.aio.rewindImage':
    'AIO mundur ({imageName}): tahap "{label}" ({current}/{total}).',
  'dashboard.aio.forwardImage':
    'AIO maju ({imageName}): tahap "{label}" ({current}/{total}).',
  'dashboard.llm.translation': 'Terjemahan',
  'dashboard.llm.ocr': 'OCR',
  'dashboard.aio.manualScope': 'AIO manual',
  'dashboard.aio.autoScope': 'AIO otomatis',
  'dashboard.aio.executing': 'Memproses',
  'dashboard.cleaner.selectProfile':
    'Pilih profil visual tersimpan untuk digunakan dengan Pembersihan AI Otomatis.',
  'dashboard.cleaner.profileNotFound':
    'Profil visual tidak ditemukan. Muat ulang dan coba lagi.',
  'dashboard.cleaner.profileInUse':
    'Profil visual yang digunakan untuk Pembersihan AI Otomatis: {label}.',
  'dashboard.cleaner.invalidModel':
    'Pilih model yang valid untuk Pembersihan AI Otomatis.',
  'dashboard.cleaner.modelRoadmap': 'Model "{name}" masih dalam roadmap.',
  'dashboard.cleaner.modelConfigRequired':
    'Model "{name}" memerlukan konfigurasi sebelum digunakan.',
  'dashboard.translator.sfx.invalidModel':
    'Pilih model yang valid untuk AI SFX Translator.',
  'dashboard.cleaner.profileSaved':
    'Profil visual disimpan dan dipilih untuk Pembersihan AI Otomatis: {label}.',
  'dashboard.cleaner.removeProfileSelect':
    'Pilih profil visual tersimpan untuk dihapus.',
  'dashboard.cleaner.customTitle': 'AI Kustom (Pembersihan AI Otomatis)',
  'dashboard.cleaner.emptyLabel': 'Profil visual baru',
  'dashboard.cleaner.namePlaceholder': 'Cth.: Gemini Image Clean',
  'dashboard.cleaner.modelPlaceholder': 'gemini-2.5-flash-image',
  'dashboard.cleaner.useLabel': 'Gunakan di Cleaner',
  'dashboard.cleaner.providerInUse':
    'Provider {name} digunakan untuk Pembersihan AI Otomatis.',
  'dashboard.stage.detectText.label': 'Deteksi Teks',
  'dashboard.stage.detectText.short': 'Deteksi',
  'dashboard.stage.recognizeText.label': 'Kenali Teks',
  'dashboard.stage.recognizeText.short': 'OCR',
  'dashboard.stage.getTranslations.label': 'Dapatkan Terjemahan',
  'dashboard.stage.getTranslations.short': 'Terjemahkan',
  'dashboard.stage.segmentText.label': 'Segmentasi Teks',
  'dashboard.stage.segmentText.short': 'Segmentasi',
  'dashboard.stage.cleanImage.label': 'Bersihkan Gambar',
  'dashboard.stage.cleanImage.short': 'Bersihkan',
  'dashboard.stage.render.label': 'Render',
  'dashboard.stage.render.short': 'Render',
  'dashboard.aio.pipeline.detect.subtitle': 'Mencari area teks pada gambar',
  'dashboard.aio.pipeline.ocr.subtitle': 'OCR untuk mengekstrak konten teks',
  'dashboard.aio.pipeline.translate.subtitle':
    'Terjemahan otomatis melalui layanan/model',
  'dashboard.aio.pipeline.segment.subtitle': 'Perbaiki area dengan segmentasi',
  'dashboard.aio.pipeline.clean.subtitle': 'Inpainting dengan AOT/LaMa + mask',
  'dashboard.aio.pipeline.render.subtitle':
    'Terapkan teks terjemahan ke gambar akhir',
  'dashboard.aio.config.langHint':
    'Sumber → Deteksi/OCR/Terjemahkan. Terjemahan → hanya terjemahan.',
  'dashboard.aio.translation.localModelInfo':
    'Model lokal diunduh sesuai kebutuhan; model cloud/API tetap menggunakan kunci.',
  'dashboard.translator.sameModelHint':
    'Translator menggunakan pemilihan model yang sama dengan AIO; jalankan ulang setelah mengganti model.',
  'dashboard.translator.incompatibleLocalModel':
    'Model lokal saat ini tidak mendukung pasangan bahasa Translator. Pilih model lain atau gunakan cloud.',
  'dashboard.status.modeChanged': 'Mode: {mode}',
  'dashboard.status.underDevelopment': '{mode}: {tooltip}',
  'dashboard.aio.render.hintRot': 'Pintasan: ',
  'dashboard.aio.render.hintRotSuffix': ' untuk memutar.',
  'settings.typographerLibrary.noFolder': 'Tidak ada folder',
  'settings.profile.defaultUser': 'Pengguna KŌMA',
  'register.email': 'Email',
  'register.emailPlaceholder': 'anda@email.com',
  'feed.sidebar.webhookPlaceholder': 'https://discord.com/api/webhooks/...',
  'feed.sidebar.webhookLabelShort': 'Webhook: ',
  'feed.moderation.scope.accountHwid': 'Akun + HWID',
  'feed.moderation.scope.full': 'Penuh',
  'feed.composer.label.scanlation': 'Scanlation',
  'feed.composer.availability.hoursPlaceholder': '10',
  'feed.composer.roles.valuePlaceholder': '50.00',
  'feed.apply.contactPlaceholder': 'Discord @username',
  'ranking.error.loadFailed': 'Gagal memuat peringkat.',
  'ranking.error.loadDetailFailed': 'Gagal memuat detail.',
  'ranking.error.saveReviewFailed': 'Gagal menyimpan ulasan.',
  'ranking.error.deleteReviewFailed': 'Gagal menghapus ulasan.',
  'ranking.error.emailVerificationRequired':
    'Konfirmasi email Anda sebelum menerbitkan atau mengedit ulasan.',
  'dashboard.aio.translation.temperature': 'Temperature',
  'dashboard.aio.translation.topP': 'Top P',
  'dashboard.aio.translation.maxTokens': 'Max Token',
  'dashboard.aio.clean.hdStrategy': 'Strategi HD',
  'dashboard.aio.clean.hdStrategy.resize': 'Ubah Ukuran',
  'dashboard.aio.clean.hdStrategy.crop': 'Potong',
  'dashboard.aio.clean.hdStrategy.original': 'Asli',
  'dashboard.aio.clean.hdStrategyHint':
    'Strategi untuk gambar besar sebelum inpainting.',
  'dashboard.aio.clean.resizeLimit': 'Batas Ukuran',
  'dashboard.aio.clean.cropMargin': 'Margin Potong',
  'dashboard.aio.clean.cropTriggerSize': 'Ukuran Pemicu Potong',
  'dashboard.aio.clean.localHardware':
    'Hardware lokal: {name} ({provider}{vram})',
  'dashboard.sidebar.workspace': 'Workspace',
  'dashboard.sidebar.hide': 'Sembunyikan sidebar',
  'dashboard.sidebar.remaining': 'Tersisa: {count}',
  'dashboard.sidebar.resizeAria': 'Ubah ukuran sidebar kiri',
  'dashboard.sidebar.resizeTitle':
    'Seret untuk mengubah ukuran. Klik dua kali untuk mengembalikan.',
  'dashboard.sidebar.files': 'File ({count})',
  'dashboard.sidebar.clearAll': 'Hapus semua',
  'dashboard.sidebar.cleared': 'Daftar gambar dihapus.',
  'dashboard.sidebar.empty': 'Tidak ada gambar',
  'dashboard.sidebar.rewindImage': 'Mundurkan gambar ini saja',
  'dashboard.sidebar.forwardImage': 'Majukan gambar ini saja',
  'dashboard.sidebar.rotate90': 'Putar 90 derajat',
  'dashboard.sidebar.moveUp': 'Pindah ke atas',
  'dashboard.sidebar.moveDown': 'Pindah ke bawah',
  'dashboard.sidebar.remove': 'Hapus',
  'dashboard.sidebar.extracting': 'Mengekstrak gambar... harap tunggu.',
  'dashboard.sidebar.dropHere': 'Letakkan di sini...',
  'dashboard.sidebar.clickOrDrag': 'Seret atau klik',
  'dashboard.sidebar.processingArchive': 'Memproses ZIP/PDF/CBZ/CB7/PSD...',
  'dashboard.sidebar.stats.title': 'Statistik lokal',
  'dashboard.sidebar.stats.badge': 'Aktif',
  'dashboard.sidebar.stats.daily': 'Hari ini',
  'dashboard.sidebar.stats.weekly': 'Minggu ini',
  'dashboard.sidebar.stats.monthly': 'Bulan ini',
  'dashboard.sidebar.stats.foot':
    'Aktivitas pemrosesan lokal terbaru. Penghitung direset otomatis sesuai periode.',
  'dashboard.sidebar.stats.resetNow': 'Reset sekarang',
  'dashboard.sidebar.stats.resetInHoursMinutes':
    'Reset dalam {hours}j {minutes}m',
  'dashboard.sidebar.stats.resetInHours': 'Reset dalam {hours}j',
  'dashboard.sidebar.stats.resetInMinutes': 'Reset dalam {minutes}m',
  'dashboard.sidebar.right.hide': 'Sembunyikan alat',
  'dashboard.sidebar.right.close': 'Tutup panel',
  'dashboard.sidebar.right.resizeAria': 'Ubah ukuran sidebar kanan',
  'dashboard.sidebar.right.resizeTitle':
    'Seret untuk mengubah ukuran. Klik dua kali untuk mengembalikan.',
  'dashboard.footer.runtime.downloaded': 'Paket terunduh',
  'dashboard.footer.runtime.embedded': 'Core tertanam',
  'dashboard.footer.runtime.fallback.title': 'Fallback aktif',
  'dashboard.footer.runtime.fallback.detail':
    '{requested} diminta, {active} digunakan.',
  'dashboard.footer.runtime.tensorrt.title': 'TensorRT aktif',
  'dashboard.footer.runtime.tensorrt.detail':
    'Akselerasi NVIDIA performa maksimum.',
  'dashboard.footer.runtime.cuda.title': 'CUDA aktif',
  'dashboard.footer.runtime.cuda.detail': 'GPU NVIDIA modern digunakan.',
  'dashboard.footer.runtime.legacy.label': 'Legacy',
  'dashboard.footer.runtime.legacy.title': 'CUDA Legacy aktif',
  'dashboard.footer.runtime.legacy.detail':
    'Profil legacy untuk GPU NVIDIA lama.',
  'dashboard.footer.runtime.openvino.title': 'OpenVINO aktif',
  'dashboard.footer.runtime.openvino.detail':
    'Akselerasi khusus Intel digunakan.',
  'dashboard.footer.runtime.cpu.title': 'CPU aktif',
  'dashboard.footer.runtime.cpu.detail':
    'Eksekusi lokal tanpa akselerasi khusus.',
  'dashboard.footer.workspace.saving': 'Menyimpan',
  'dashboard.footer.workspace.saved': 'Tersimpan',
  'dashboard.footer.workspace.error': 'Error lokal',
  'dashboard.footer.workspace.pending': 'Tertunda',
  'dashboard.footer.workspace.title': 'Workspace lokal',
  'dashboard.footer.runtime.source': 'Sumber: {value}',
  'dashboard.footer.runtime.remoteAvailable': 'Paket remote tersedia.',
  'dashboard.footer.runtime.errorReason': 'Alasan: {value}',
  'dashboard.footer.bugReport.title': 'Laporkan bug',
  'dashboard.footer.bugReport.desc':
    'Laporkan bug dengan tangkapan layar dan log otomatis.',
  'dashboard.footer.discord.aria': 'Bergabung di Discord',
  'dashboard.footer.discord.title': 'Komunitas Discord',
  'dashboard.footer.discord.desc':
    'Bergabung dengan komunitas, sarankan ide, dan bagikan masukan.',
  'dashboard.footer.website.aria': 'Buka situs web proyek',
  'dashboard.footer.website.title': 'Situs web proyek',
  'dashboard.footer.website.desc':
    'Akses berita, dokumentasi, dan sumber daya proyek.',
  'bugReport.error.imgLoadFailed': 'Gagal memuat gambar.',
  'bugReport.error.canvasFailed': 'Pemrosesan kanvas gagal.',
  'modelManager.modal.title': 'Vault Model',
  'modelManager.modal.aioFallback': 'AIO',
  'modelCard.recommended': 'REC',
  'modelCard.hardware.gpu': 'GPU',
  'modelCard.hardware.cpu': 'CPU',
  'modelCard.speed.ok': 'OK',
  'auth.toolkit.aiClean': 'AI Clean',
  'freeProviderCard.setup': 'Pengaturan',
  'freeProviderCard.limits': 'Batas',
  'freeProviderCard.rateLimits': 'Batas laju',
  'freeProviderCard.field.modelPlaceholder': 'ID Model (kompatibel OpenAI)',
  'customProvider.profileType': 'Profil AI Kustom',
  'dashboard.cleaner.mode.assisted': 'Terbimbing',
  'dashboard.cleaner.mode.automaticAi': 'Pembersihan AI Otomatis',
  'dashboard.cleaner.mode.aiSfx': 'AI SFX',
  'dashboard.cleaner.mode.assistedTitle':
    'Alur terstruktur dengan OCR, segmentasi, dan inpainting lokal',
  'dashboard.cleaner.mode.automaticAiTitle':
    'Pembersihan otomatis dengan AI multimodal dan rekonstruksi terpandu',
  'dashboard.cleaner.mode.aiSfxTitle':
    'Mendeteksi dan membersihkan hanya SFX yang disetujui AI',
  'dashboard.cleaner.mode.title': 'Mode',
  'dashboard.cleaner.mode.hint':
    'Mode saat ini dipertahankan sebagai alur terbimbing. <strong>Pembersihan AI Otomatis</strong> baru menggunakan AI multimodal dengan aturan ketat untuk mempertahankan seni, garis, dan balon.',
  'dashboard.cleaner.pipeline.title': 'Pipeline',
  'dashboard.cleaner.pipeline.hint':
    'Alur terbimbing: OCR → Segmentasi → Pembersihan lokal. Ideal bagi yang menginginkan prediktabilitas dan penyempurnaan setelahnya.',
  'dashboard.cleaner.ocr.language': 'Bahasa (OCR)',
  'dashboard.cleaner.ocr.languageAria': 'Bahasa sumber untuk OCR',
  'dashboard.cleaner.models.button': 'Model',
  'dashboard.cleaner.models.none': 'Tidak ada model',
  'dashboard.cleaner.ocr.manageAria': 'Kelola model OCR',
  'dashboard.cleaner.ocr.modelAria': 'Model OCR',
  'dashboard.cleaner.segment.title': 'Segmentasi',
  'dashboard.cleaner.segment.manageAria': 'Kelola model segmentasi',
  'dashboard.cleaner.segment.modelAria': 'Model segmentasi',
  'dashboard.cleaner.clean.title': 'Bersihkan',
  'dashboard.cleaner.clean.manageAria': 'Kelola model pembersihan',
  'dashboard.cleaner.clean.modelAria': 'Model pembersihan',
  'dashboard.cleaner.settings.title': 'Pembersihan',
  'dashboard.cleaner.settings.maskDilation': 'Dilatasi Mask',
  'dashboard.cleaner.settings.hdStrategy': 'Strategi HD',
  'dashboard.cleaner.settings.resizeLimit': 'Batas Ukuran',
  'dashboard.cleaner.settings.cropMargin': 'Margin Potong',
  'dashboard.cleaner.settings.cropTrigger': 'Pemicu Potong',
  'dashboard.cleaner.inspect.title': 'Inspeksi',
  'dashboard.cleaner.inspect.ocrBlocks': 'Blok OCR',
  'dashboard.cleaner.inspect.segmented': 'Tersegmentasi',
  'dashboard.cleaner.inspect.selection': 'Pilihan',
  'dashboard.cleaner.inspect.none': 'tidak ada',
  'dashboard.cleaner.inspect.ocr': 'OCR',
  'dashboard.cleaner.inspect.segments': 'Segmen',
  'dashboard.cleaner.inspect.boxesCount': '{count} kotak',
  'dashboard.cleaner.ai.sfxCleaner': 'AI SFX Cleaner',
  'dashboard.cleaner.ai.automaticClean': 'Pembersihan AI Otomatis',
  'dashboard.cleaner.ai.sfxDesc':
    'Menggunakan detektor lokal untuk mengajukan kandidat, mengklasifikasikan area mana yang benar-benar SFX, dan hanya membersihkan yang disetujui.',
  'dashboard.cleaner.ai.automaticDesc':
    'Menggunakan deteksi struktural proyek untuk memandu AI, memperkuat pelestarian balon/seni, dan merekomposisi gambar besar dengan sambungan yang lebih halus.',
  'dashboard.cleaner.ai.modelTitle': 'Model AI',
  'dashboard.cleaner.ai.manageAria': 'Kelola model {value}',
  'dashboard.cleaner.ai.modelAria': 'Model {value}',
  'dashboard.cleaner.ai.noneAvailable': 'Tidak ada model AI tersedia',
  'dashboard.cleaner.instructions.title': 'Instruksi tambahan',
  'dashboard.cleaner.instructions.hintSfx':
    'Instruksi ini dimasukkan sebagai konteks tambahan setelah aturan klasifikasi dan pembersihan SFX dasar.',
  'dashboard.cleaner.instructions.hintAi':
    'Instruksi ini dimasukkan sebagai konteks tambahan. Aturan inti AI cleaner tetap di atas instruksi pengguna untuk menjaga logika pembersihan.',
  'dashboard.cleaner.stats.candidates': 'Kandidat',
  'dashboard.cleaner.stats.sfxApproved': 'SFX disetujui',
  'dashboard.cleaner.stats.redraw': 'Redraw',
  'dashboard.cleaner.action.processing': 'Memproses {value} {percent}%',
  'dashboard.cleaner.action.runAiSfx': 'Jalankan AI SFX Cleaner',
  'dashboard.cleaner.action.runAutomatic': 'Jalankan Pembersihan AI Otomatis',
  'dashboard.cleaner.action.runAssisted': 'Jalankan Cleaner Terbimbing',
  'dashboard.typography.circularText': 'Teks Melingkar',
  'dashboard.typography.activate': 'Aktifkan',
  'dashboard.typography.effect.aria': 'Efek teks',
  'dashboard.typography.effect.title': 'Pilih efek teks',
  'dashboard.typography.effect.label': 'Efek',
  'dashboard.typography.effect.none': 'Tanpa efek',
  'dashboard.typography.effect.panelTitle': 'Efek teks',
  'dashboard.typography.effect.panelHint':
    'Preset bawaan untuk dialog, dampak, dan smear.',
  'dashboard.typography.effect.searchPlaceholder': 'Cari efek...',
  'dashboard.typography.effect.intensity': 'Intensitas',
  'dashboard.typography.effect.noResults': 'Tidak ada efek ditemukan.',
  'dashboard.aio.customAi.titleTranslation': 'Profil AI Kustom (Terjemahan)',
  'dashboard.aio.customAi.titleOcr': 'Profil AI Kustom (OCR)',
  'dashboard.aio.customAi.newTranslation': 'Profil terjemahan baru',
  'dashboard.aio.customAi.newOcr': 'Profil OCR baru',
  'dashboard.aio.customAi.placeholderTranslation':
    'Cth.: OpenRouter Manga EN-US',
  'dashboard.aio.customAi.placeholderOcr': 'Cth.: Private Vision OCR',
  'dashboard.aio.customAi.modelPlaceholderTranslation': 'openai/gpt-4.1',
  'dashboard.aio.customAi.modelPlaceholderOcr': 'gpt-4.1-mini',
  'dashboard.aio.customAi.useTranslation': 'Gunakan Terjemahan',
  'dashboard.aio.customAi.useOcr': 'Gunakan OCR',
  'dashboard.aio.customAi.loading': 'Memuat profil kustom...',
  'dashboard.aio.customAi.savedProfile': 'Profil disimpan',
  'dashboard.aio.customAi.apiBase': 'API Base',
  'dashboard.aio.customAi.ollamaPreset': 'Preset Lokal Ollama',
  'dashboard.aio.customAi.apiKey': 'API Key (opsional)',
  'dashboard.aio.customAi.model': 'Model',
  'dashboard.aio.customAi.clear': 'Hapus',
  'dashboard.aio.customAi.remove': 'Hapus',
  'dashboard.aio.customAi.save': 'Simpan',
  'dashboard.emptyStage.title': 'Pilih atau muat gambar',
  'dashboard.emptyStage.desc':
    'Gunakan alat di bilah atas untuk memproses halaman manhwa Anda.',
  'dashboard.emptyStage.tipTitle': 'Tips berguna',
  'dashboard.emptyStage.tipMeta': 'Berganti setiap 15 detik',
  'dashboard.enhance.title': 'Enhance Gambar',
  'dashboard.enhance.localHint':
    'Model ONNX pada mini-backend lokal. Instal sebelum memproses.',
  'dashboard.enhance.desktopRequiredHint':
    'Memerlukan aplikasi desktop dengan mini-backend aktif.',
  'dashboard.enhance.scale': 'Skala',
  'dashboard.enhance.profile': 'Profil',
  'dashboard.enhance.model': 'Model',
  'dashboard.enhance.format': 'Format',
  'dashboard.enhance.status.title': 'Model',
  'dashboard.enhance.status.desktopRequired': 'Diperlukan desktop',
  'dashboard.enhance.status.selectModel': 'Pilih model',
  'dashboard.enhance.status.ready': 'Siap',
  'dashboard.enhance.status.notImported': 'Belum diimpor',
  'dashboard.enhance.status.notInstalled': 'Belum terinstal',
  'dashboard.enhance.importHint':
    'Impor ONNX manual. Konversi .pth menggunakan sisr2onnx.',
  'dashboard.enhance.action.manage': 'Kelola',
  'dashboard.enhance.action.import': 'Impor',
  'dashboard.enhance.action.install': 'Instal',
  'dashboard.enhance.action.source': 'Sumber',
  'dashboard.enhance.selectAboveHint': 'Pilih model di atas.',
  'dashboard.enhance.action.processing': 'Meningkatkan...',
  'dashboard.enhance.action.run': 'Enhance Gambar',
  'dashboard.info.optimizer.desc1':
    'Optimalkan batch akhir dengan preset web, pembacaan, atau arsip menggunakan output yang sudah dihasilkan di dasbor.',
  'dashboard.info.optimizer.desc2':
    'Utilitas ini menampilkan penghematan per halaman dan mengekspor sebagai ZIP atau folder lokal.',
  'dashboard.info.blogger.desc1':
    'Gunakan utilitas ini untuk mempublikasikan ke Blogger dan membuat URL gambar yang di-hosting.',
  'dashboard.info.blogger.desc2':
    'Kredensial dan optimizer ada di Pengaturan > Integrasi > CDN Blogger.',
  'dashboard.info.imgur.desc1':
    'Gunakan utilitas ini untuk unggahan anonim Imgur dengan rotasi Client ID acak.',
  'dashboard.info.imgur.desc2':
    'Kunci, pembatas, dan panduan lengkap ada di Pengaturan > Integrasi > Unggah Imgur.',
  'dashboard.info.guides.desc1':
    'Pilih panduan di panel tengah untuk membaca instruksi detail.',
  'dashboard.info.guides.desc2':
    'Setiap panduan berisi contoh praktis dan tips produktivitas.',
  'dashboard.info.resources.desc1':
    'Jelajahi sumber daya dan materi yang berguna untuk alur kerja scanlation Anda.',
  'dashboard.info.resources.desc2': 'Font, template, kamus, dan lainnya.',
  'dashboard.render.noRecognizedText': 'Tidak ada teks yang dikenali',
  'dashboard.render.noTranslation': 'Tidak ada terjemahan tersedia',
  'dashboard.render.noNotes': 'Tidak ada TN tersedia',
  'dashboard.render.noteLabel': 'TN:',
  'dashboard.render.textLabel': 'Teks',
  'dashboard.render.aaLabel': 'AA',
  'dashboard.render.skewXLabel': 'Sx',
  'dashboard.render.skewYLabel': 'Sy',
  'renderPreview.context.title': 'Aksi area',
  'renderPreview.context.copyRecognized': 'Salin teks dikenali',
  'renderPreview.context.copyTranslated': 'Salin terjemahan',
  'renderPreview.context.editRendered': 'Edit render',
  'renderPreview.context.editRenderedHint': 'Edit teks ter-render',
  'renderPreview.context.manualModeHint': 'Memerlukan mode manual',
  'renderPreview.shape': 'Bentuk',
  'renderPreview.rectangular': 'Persegi panjang',
  'renderPreview.elliptic': 'Elips',
  'renderPreview.convertRectangular': 'Ubah ke bentuk persegi panjang',
  'renderPreview.convertElliptic': 'Ubah ke bentuk elips',
  'renderPreview.manualModeRequired': 'Memerlukan mode manual',
  'renderPreview.applyTypographyPreset': 'Terapkan preset tipografi',
  'renderPreview.preset': 'Preset',
  'renderPreview.typographyPresets': 'Preset tipografi',
  'renderPreview.applyPreset': 'Terapkan Preset',
  'renderPreview.removeRegion': 'Hapus Pilihan',
  'renderPreview.textFont': 'Font teks',
  'renderPreview.selectionShape': 'Bentuk pilihan',
  'renderPreview.fontSize': 'Ukuran font',
  'renderPreview.decreaseFont': 'Perkecil font',
  'renderPreview.increaseFont': 'Perbesar font',
  'renderPreview.alignment': 'Perataan',
  'renderPreview.alignLeft': 'Rata kiri',
  'renderPreview.alignCenter': 'Tengah',
  'renderPreview.alignRight': 'Rata kanan',
  'renderPreview.typographyStyle': 'Gaya tipografi',
  'renderPreview.bold': 'Tebal',
  'renderPreview.italic': 'Miring',
  'renderPreview.underline': 'Garis bawah',
  'renderPreview.uppercase': 'Huruf kapital',
  'renderPreview.textOrientation': 'Orientasi teks',
  'renderPreview.horizontal': 'Horizontal',
  'renderPreview.vertical': 'Vertikal',
  'renderPreview.circular': 'Melingkar',
  'renderPreview.rotation': 'Rotasi',
  'renderPreview.rotateMinus5': 'Putar -5°',
  'renderPreview.rotatePlus5': 'Putar +5°',
  'renderPreview.skewX': 'Kemiringan X',
  'renderPreview.skewXMinus2': 'Kemiringan X -2°',
  'renderPreview.skewXPlus2': 'Kemiringan X +2°',
  'renderPreview.skewY': 'Kemiringan Y',
  'renderPreview.skewYMinus2': 'Kemiringan Y -2°',
  'renderPreview.skewYPlus2': 'Kemiringan Y +2°',
  'renderPreview.adjustments': 'Penyesuaian',
  'renderPreview.refine': 'Perbaiki',
  'renderPreview.autoFontSize': 'Ukuran Font Otomatis',
  'renderPreview.autoFit': 'Sesuaikan otomatis',
  'renderPreview.fixed': 'Tetap',
  'renderPreview.hyphenation': 'Pemenggalan kata',
  'renderPreview.enabled': 'Aktif',
  'renderPreview.disabled': 'Nonaktif',
  'renderPreview.maxSize': 'Ukuran Maks',
  'renderPreview.minSize': 'Ukuran Min',
  'renderPreview.lineSpacing': 'Spasi baris',
  'renderPreview.opacity': 'Opasitas',
  'renderPreview.fill': 'Isian',
  'renderPreview.outline': 'Garis tepi',
  'renderPreview.shadow': 'Bayangan',
  'renderPreview.shadowLayers': 'Lapisan Bayangan',
  'renderPreview.addLayer': 'Tambah Lapisan',
  'renderPreview.layerN': 'Lapisan {count}',
  'renderPreview.removeLayerN': 'Hapus lapisan {count}',
  'renderPreview.shadowLayerN': 'Lapisan Bayangan {count}',
  'renderPreview.blur': 'Blur',
  'renderPreview.offsetX': 'Offset X',
  'renderPreview.offsetY': 'Offset Y',
  'renderPreview.radius': 'Radius',
  'renderPreview.startAngle': 'Sudut Awal',
  'renderPreview.spacing': 'Spasi',
  'renderPreview.shadowLayersCount': '{count} lapisan',
  'renderPreview.shadowBlurSummary': 'blur {value}',
  'renderPreview.history.none': 'Tidak ada riwayat AIO untuk gambar ini',
  'renderPreview.box.clickToEdit': 'klik dua kali untuk mengedit',
  'renderPreview.box.renderNotApplied':
    'render belum diterapkan pada tahap ini',
  'renderPreview.editor.placeholder': 'Ketik teks akhir...',
  'renderPreview.editor.aria': 'Edit teks ter-render',
  'splitter.strategy.smart': 'Smart Otomatis',
  'splitter.strategy.smartHint': 'Ruang kosong + heuristik.',
  'splitter.strategy.advancedDesktop': 'Semi Desktop',
  'splitter.strategy.advancedDesktopHint': 'Analisis lokal lanjutan.',
  'splitter.strategy.manual': 'Manual',
  'splitter.strategy.manualHint': 'Penyesuaian manual saja.',
  'splitter.strategy.fixedHeight': 'Tinggi tetap',
  'splitter.strategy.fixedHeightHint': 'Segmentasi berdasarkan tinggi.',
  'splitter.strategy.count': 'N bagian',
  'splitter.strategy.countHint': 'Pembagian rata.',
  'dashboard.aio.autoScopeTitle': 'Pemrosesan otomatis tanpa intervensi',
  'dashboard.aio.manualScopeTitle': 'Kontrol manual setiap tahap',
  'detectionPreview.recognized': 'Dikenali:',
  'detectionPreview.translated': 'Diterjemahkan:',
  'detectionPreview.note': 'TN:',
  'detectionPreview.manual': 'Manual',
  'detectionPreview.removeSelection': 'Hapus pilihan',
  'detectionPreview.actions': 'Aksi area',
  'detectionPreview.text': 'Teks',
  'detectionPreview.copyRecognized': 'Salin teks dikenali',
  'detectionPreview.editRecognized': 'Edit teks dikenali',
  'detectionPreview.manualModeOnly': 'Hanya tersedia dalam mode manual',
  'detectionPreview.copyTranslated': 'Salin terjemahan',
  'detectionPreview.editTranslated': 'Edit terjemahan',
  'detectionPreview.removeRegion': 'Hapus area',
  'detectionPreview.editRecognizedTitle': 'Edit teks yang dikenali',
  'detectionPreview.editTranslatedTitle': 'Edit teks terjemahan',
  'detectionPreview.placeholderRecognized': 'Ketik teks yang dikenali...',
  'detectionPreview.placeholderTranslated': 'Ketik terjemahan...',
  'detectionPreview.rewind': 'Mundurkan gambar ini',
  'detectionPreview.forward': 'Majukan gambar ini',
  'detectionPreview.noHistory': 'Tidak ada riwayat AIO untuk gambar ini',
  'dashboard.translator.workspace.aria': 'Mode translator',
  'dashboard.translator.workspace.textTitle': 'Terjemahkan teks bebas',
  'dashboard.translator.workspace.text': 'Teks',
  'dashboard.translator.workspace.visualTitle':
    'Deteksi dan terjemahkan dalam gambar',
  'dashboard.translator.workspace.visual': 'Visual',
  'watermark.header.eyebrow': 'Utilitas Editorial',
  'watermark.header.title': 'Watermark',
  'watermark.header.badge': 'Batch',
  'watermark.panel.presets': 'Preset',
  'watermark.presets.builtin': 'Bawaan',
  'watermark.presets.user': 'Tersimpan',
  'watermark.action.save': 'Simpan',
  'watermark.action.duplicate': 'Duplikat',
  'watermark.panel.text': 'Teks',
  'watermark.text.enable': 'Aktifkan teks',
  'watermark.text.content': 'Konten',
  'watermark.text.font': 'Font',
  'watermark.text.size': 'Ukuran',
  'watermark.text.color': 'Warna',
  'watermark.text.outline': 'Garis tepi',
  'watermark.text.outlineColor': 'Warna garis tepi',
  'watermark.text.opacity': 'Opasitas',
  'watermark.panel.logo': 'Logo',
  'watermark.logo.enable': 'Aktifkan',
  'watermark.logo.change': 'Ganti',
  'watermark.logo.upload': 'Unggah',
  'watermark.logo.remove': 'Hapus',
  'watermark.logo.scale': 'Skala %',
  'watermark.logo.opacity': 'Opasitas',
  'watermark.logo.brightness': 'Kecerahan',
  'watermark.logo.saturation': 'Saturasi',
  'watermark.panel.distribution': 'Distribusi',
  'watermark.distribution.position': 'Posisi',
  'watermark.distribution.rotation': 'Rotasi',
  'watermark.distribution.blend': 'Blend',
  'watermark.distribution.gapX': 'Jarak X',
  'watermark.distribution.gapY': 'Jarak Y',
  'watermark.distribution.padding': 'Padding',
  'watermark.distribution.baseName': 'Nama dasar',
  'watermark.distribution.smartPlacement': 'Penempatan Cerdas',
  'watermark.action.applying': 'Menerapkan...',
  'watermark.action.applyBatch': 'Terapkan Batch',
  'watermark.status.cancelRequested': 'Pembatalan diminta.',
  'watermark.action.cancel': 'Batal',
  'watermark.panel.preview': 'Pratinjau',
  'watermark.preview.compare': 'Bandingkan',
  'watermark.preview.mode': 'Pratinjau',
  'watermark.preview.empty.title': 'Tidak ada gambar',
  'watermark.preview.empty.desc': 'Impor halaman di panel kiri dasbor.',
  'watermark.preview.noLayer.title': 'Atur lapisan',
  'watermark.preview.noLayer.desc':
    'Aktifkan teks atau logo di toolbox untuk menghasilkan pratinjau.',
  'watermark.preview.original': 'Asli',
  'watermark.preview.watermark': 'Watermark',
  'watermark.preview.compareAria': 'Perbandingan sebelum/sesudah',
  'watermark.preview.generating': 'Menghasilkan...',
  'watermark.panel.output': 'Output',
  'watermark.output.empty.title': 'Tidak ada hasil',
  'watermark.output.empty.desc': 'Terapkan batch untuk menghasilkan unduhan.',
  'watermark.action.zip': 'ZIP',
  'watermark.action.folder': 'Folder',
  'watermark.action.download': 'Unduh',
  'imgur.hero.eyebrow': 'Unggah Imgur',
  'imgur.hero.title': 'Hosting anonim',
  'imgur.hero.desc':
    'Gunakan utilitas ini untuk unggahan cepat Imgur dengan rotasi Client ID acak.',
  'imgur.status.remaining': 'Tersisa: {remaining}',
  'imgur.status.configure': 'Konfigurasi',
  'imgur.alert.missingConfig': 'Konfigurasi tidak ditemukan',
  'imgur.alert.addActiveClient':
    'Tambahkan minimal satu Client ID aktif di Pengaturan > Integrasi.',
  'imgur.batch.title': 'Unggah Batch',
  'imgur.batch.limit': 'Batas {limit} unggahan per jam (Digunakan: {used})',
  'imgur.dropzone.title': 'Letakkan gambar di sini',
  'imgur.dropzone.desc': 'Seret beberapa file JPG, PNG, atau WEBP.',
  'imgur.toggle.imgOutput': 'Output sebagai tag <img>',
  'imgur.toggle.imgOutputDesc':
    'Menghasilkan kode HTML siap pakai untuk blog dan forum.',
  'imgur.actions.select': 'Pilih',
  'imgur.actions.sending': 'Mengirim...',
  'imgur.actions.send': 'Kirim',
  'imgur.actions.copy': 'Salin URL',
  'imgur.queue.title': 'Antrean Unggahan',
  'imgur.queue.items_one': '{count} item',
  'imgur.queue.items_other': '{count} item',
  'imgur.queue.empty': 'Antrean kosong. Tambahkan gambar di atas.',
  'imgur.queue.altPlaceholder': 'Teks alternatif',
  'imgur.queue.urlLabel': 'URL',
  'imgur.queue.keyLabel': 'Kunci',
  'imgur.queue.remove': 'Hapus',
  'imgur.error.configLoad': 'Gagal memuat konfigurasi Imgur.',
  'imgur.error.uploadFailed': 'Gagal mengunggah gambar.',
  'imgur.feedback.singleSuccess': 'Unggahan berhasil diselesaikan.',
  'imgur.feedback.multiSuccess': 'Unggahan {count} gambar selesai.',
  'ranking.metric.overall': 'Skor keseluruhan',
  'ranking.metric.quality': 'Kualitas',
  'ranking.metric.speed': 'Kecepatan',
  'ranking.metric.costBenefit': 'Efektivitas biaya',
  'ranking.metric.easeOfUse': 'Kemudahan penggunaan',
  'ranking.trend.neutral': 'Netral',
  'ranking.trend.points': 'poin',
  'ranking.table.title': 'Papan Peringkat',
  'ranking.table.sortedBy': 'Diurutkan berdasarkan {metric} tertimbang.',
  'ranking.table.modelsCount': '{count} model diperingkatkan',
  'ranking.table.empty': 'Tidak ada model yang sesuai dengan filter saat ini.',
  'ranking.table.newLabel': 'Baru',
  'ranking.table.reviewsCount': '{count} ulasan',
  'ranking.table.reviewedByYou': 'Anda sudah mengulas',
  'ranking.table.viewDetails': 'Lihat detail',
  'ranking.filters.metricAria': 'Metrik peringkat',
  'ranking.filters.searchPlaceholder': 'Cari model...',
  'ranking.filters.searchAria': 'Cari model',
  'ranking.filters.advancedAria': 'Tampilkan filter lanjutan',
  'ranking.filters.button': 'Filter',
  'ranking.filters.stageLabel': 'Tahap',
  'ranking.filters.sourceLabel': 'Sumber',
  'ranking.filters.languageLabel': 'Bahasa',
  'ranking.filters.minReviewsLabel': 'Min. ulasan',
  'ranking.filters.allStages': 'Semua tahap',
  'ranking.filters.allSources': 'Lokal + Cloud',
  'ranking.filters.onlyLocal': 'Hanya lokal',
  'ranking.filters.onlyCloud': 'Hanya cloud',
  'ranking.filters.allLanguages': 'Semua bahasa',
  'ranking.filters.reviews_one': '{count} ulasan',
  'ranking.filters.reviews_other': '{count} ulasan',
  'ranking.composer.usage.balanced': 'Seimbang',
  'ranking.composer.usage.qualityFirst': 'Utamakan kualitas',
  'ranking.composer.usage.speedFirst': 'Utamakan kecepatan',
  'ranking.composer.usage.lowVram': 'VRAM rendah',
  'ranking.composer.usage.offlineLocal': 'Pipeline lokal',
  'ranking.composer.usage.cloudPipeline': 'Pipeline cloud',
  'ranking.composer.title.edit': 'Edit ulasan',
  'ranking.composer.title.new': 'Ulasan baru',
  'ranking.composer.action.close': 'Tutup',
  'ranking.composer.field.title': 'Judul',
  'ranking.composer.field.titlePlaceholder':
    'Cth.: OCR lokal terbaik untuk manga',
  'ranking.composer.field.context': 'Konteks',
  'ranking.composer.field.sourceLang': 'Bahasa sumber',
  'ranking.composer.field.sourceLangPlaceholder': 'ja, en, id...',
  'ranking.composer.field.targetLang': 'Bahasa target',
  'ranking.composer.field.targetLangPlaceholder': 'en, id, pt-br...',
  'ranking.composer.field.device': 'Perangkat',
  'ranking.composer.device.none': 'Tidak ditentukan',
  'ranking.composer.field.comment': 'Komentar',
  'ranking.composer.field.commentPlaceholder':
    'Jelaskan kualitas keseluruhan, stabilitas, penggunaan sumber daya, dan di mana model ini memberikan nilai terbaik.',
  'ranking.composer.action.reset': 'Reset',
  'ranking.composer.action.delete': 'Hapus',
  'ranking.composer.action.save': 'Simpan',
  'ranking.composer.action.publish': 'Terbitkan',
  'dashboard.specialMode.visualEmpty.title': 'Visual Translator',
  'dashboard.specialMode.visualEmpty.description':
    'Impor gambar untuk mulai menerjemahkan langsung di pratinjau.',
  'dashboard.specialMode.visualEmpty.cta': 'Pilih Gambar',
  'dashboard.reviewRaw.raw.title': 'Tinjauan Raw',
  'dashboard.reviewRaw.raw.description':
    'Analisis kualitas gambar asli dan siapkan batch untuk pipeline.',
  'dashboard.reviewRaw.raw.note':
    'Validasi raw membantu AI lebih memahami konteks visual sebelum OCR.',
  'dashboard.reviewRaw.raw.statusReady':
    'Batch {count} gambar siap untuk validasi.',
  'dashboard.reviewRaw.raw.validate': 'Validasi Raw',
  'dashboard.reviewRaw.qc.title': 'Kontrol Kualitas',
  'dashboard.reviewRaw.qc.descriptionAuto':
    'QC otomatis menggunakan model ringan untuk mendeteksi kesalahan editing umum.',
  'dashboard.reviewRaw.qc.descriptionManual':
    'Mode manual memungkinkan tinjauan detail setiap balon dan redraw.',
  'dashboard.reviewRaw.qc.note':
    'Aktifkan pemeriksaan di bawah untuk menjalankan analisis batch.',
  'dashboard.reviewRaw.qc.automaticChecks': 'Pemeriksaan Otomatis',
  'dashboard.reviewRaw.qc.checks.untranslatedText': 'Teks belum diterjemahkan',
  'dashboard.reviewRaw.qc.checks.emptyBubbles': 'Balon kosong',
  'dashboard.reviewRaw.qc.checks.visualArtifacts': 'Artefak visual',
  'dashboard.reviewRaw.qc.checks.textAlignment': 'Perataan teks',
  'dashboard.reviewRaw.qc.checks.fontConsistency': 'Konsistensi font',
  'dashboard.reviewRaw.qc.inProgress': 'Analisis QC sedang berlangsung...',
  'dashboard.reviewRaw.qc.run': 'Jalankan QC',
  'common.cancel': 'Batal',
  'common.save': 'Simpan',
  'common.name': 'Nama',
  'common.newName': 'Nama baru',
  'common.removed': 'Dihapus',
  'common.renamed': 'Diganti nama',
  'common.duplicated': 'Diduplikat',
  'common.saved': 'Disimpan',
  'common.failed': 'Gagal',
  'common.cancelled': 'Dibatalkan',
  'common.status': 'Status',
  'common.configured': 'Dikonfigurasi',
  'common.no': 'Tidak',
  'common.account': 'Akun',
  'common.format': 'Format',
  'common.exportedCount': 'Diekspor: {count} item.',
  'modelManager.modal.verified': 'Diverifikasi pada',
  'modelManager.modal.upToDate': 'Sudah terbaru',
  'modelManager.modal.closeAria': 'Tutup modal',
  'modelManager.modal.localModels': 'Katalog Lokal',
  'modelManager.modal.localDesc':
    'Instalasi sesuai kebutuhan dengan verifikasi integritas.',
  'modelManager.modal.noLocal': 'Tidak ada model lokal yang sesuai filter.',
  'modelManager.modal.cloudModels': 'Katalog Cloud',
  'modelManager.modal.cloudDesc':
    'Model berbasis API/Cloud. Memerlukan koneksi dan kunci Anda sendiri.',
  'modelManager.modal.hideCustom': 'Sembunyikan Kustom',
  'modelManager.modal.addCustom': 'Tambah Kustom',
  'modelManager.modal.noCloud': 'Tidak ada model cloud yang sesuai filter.',
  'modelManager.modal.checking': 'Memeriksa...',
  'modelManager.modal.checkUpdates': 'Periksa Pembaruan',
  'modelManager.modal.installAll': 'Instal yang Direkomendasikan',
  'modelManager.modal.cancel': 'Batal',
  'modelManager.modal.noEligible': 'Tidak ada model yang memenuhi syarat.',
  'modelManager.modal.notEnoughSpace': 'Ruang tidak cukup (butuh {space}).',
  'resources.breadcrumb.home': 'Sumber Daya',
  'resources.communities.title': 'Komunitas & Tautan',
  'resources.back': 'Kembali ke Sumber Daya',
  'resources.communities.desc':
    'Komunitas scanlation aktif, Discord, forum, dan sumber daya untuk jaringan dan pembelajaran.',
  'resources.platform.discord': 'Discord',
  'resources.platform.forum': 'Forum',
  'resources.platform.reddit': 'Reddit',
  'resources.platform.website': 'Situs Web',
  'resources.communities.members': '{count} anggota',
  'resources.action.visit': 'Kunjungi',
  'resources.externalTools.title': 'Alat Eksternal',
  'resources.externalTools.desc':
    'Software dan aplikasi yang direkomendasikan untuk melengkapi KŌMA Studio dalam alur kerja scanlation Anda.',
  'resources.category.editing': 'Editing',
  'resources.category.ocr': 'OCR',
  'resources.category.translation': 'Terjemahan',
  'resources.category.fonts': 'Font',
  'resources.category.hosting': 'Hosting',
  'resources.category.utility': 'Utilitas',
  'resources.action.open': 'Buka',
  'resources.action.download': 'Unduh',
  'resources.status.free': 'Gratis',
  'resources.status.paid': 'Berbayar',
  'resources.fonts.title': 'Font Typesetting',
  'resources.fonts.desc':
    'Koleksi font scanlation populer yang dikurasi. Termasuk font untuk dialog, narasi, penekanan, SFX, dan teks CJK.',
  'resources.fonts.searchPlaceholder':
    'Cari font berdasarkan nama, penggunaan, atau tag...',
  'resources.fonts.noResults': 'Tidak ada font ditemukan untuk "{search}"',
  'resources.license.free': 'Gratis',
  'resources.license.openSource': 'Open Source',
  'resources.license.commercial': 'Komersial',
  'resources.license.mixed': 'Campuran',
  'resources.glossary.title': 'Glosarium Scanlation',
  'resources.glossary.desc':
    'Istilah teknis, jargon komunitas, dan kosakata penting untuk scanlation manga, manhwa, dan manhua.',
  'resources.glossary.searchPlaceholder': 'Cari istilah...',
  'resources.glossary.noResults':
    'Tidak ada istilah ditemukan untuk "{search}"',
  'resources.glossary.related': 'Terkait:',
  'resources.category.general': 'Umum',
  'resources.category.typesetting': 'Typesetting',
  'resources.category.cleaning': 'Pembersihan',
  'resources.category.technical': 'Teknis',
  'resources.category.roles': 'Peran',
  'resources.sfx.title': 'Pustaka SFX',
  'resources.sfx.desc':
    'Pustaka efek suara Jepang dengan terjemahan, pelafalan romaji, dan contoh penggunaan manga.',
  'resources.sfx.searchPlaceholder':
    'Cari berdasarkan Jepang, romaji, atau Indonesia...',
  'resources.sfx.noResults': 'Tidak ada SFX ditemukan.',
  'resources.sfx.commonIn': 'Umum di: {value}',
  'resources.category.impact': 'Dampak',
  'resources.category.emotion': 'Emosi',
  'resources.category.ambient': 'Ambien',
  'resources.category.action': 'Aksi',
  'resources.category.voice': 'Suara',
  'resources.category.misc': 'Lain-lain',
  'resources.filters.all': 'Semua ({count})',
  'resources.page.tab.fonts': 'Font',
  'resources.page.tab.sfx': 'Pustaka SFX',
  'resources.page.tab.glossary': 'Glosarium',
  'resources.page.tab.communities': 'Komunitas',
  'resources.page.tab.tools': 'Alat',
  'resources.page.title.main': 'Pusat ',
  'resources.page.title.accent': 'Sumber Daya',
  'resources.page.subtitle':
    'Materi, komunitas, dan alat yang dikurasi untuk alur kerja Anda.',
  'resources.page.searchPlaceholder': 'Cari di semua kategori...',
  'resources.page.searchAria': 'Kolom pencarian sumber daya',
  'resources.page.clearSearch': 'Hapus pencarian',
  'resources.page.tabsAria': 'Kategori sumber daya',
  'resources.category.fonts.label': 'Font Typesetting',
  'resources.category.fonts.description':
    'Koleksi font populer yang dikurasi untuk scanlation manga, manhwa, dan manhua.',
  'resources.category.sfx-library.label': 'Pustaka SFX',
  'resources.category.sfx-library.description':
    'Pustaka onomatope Jepang dengan terjemahan dan contoh penggunaan.',
  'resources.category.glossary.label': 'Glosarium Scanlation',
  'resources.category.glossary.description':
    'Istilah teknis dan jargon komunitas dari dunia scanlation.',
  'resources.category.communities.label': 'Komunitas',
  'resources.category.communities.description':
    'Server Discord, subreddit, dan forum scanlation.',
  'resources.category.tools-external.label': 'Alat Eksternal',
  'resources.category.tools-external.description':
    'Software pelengkap dan alat online yang berguna.',
  'resources.home.title': 'Pusat Sumber Daya',
  'resources.home.subtitle':
    'Materi, komunitas, dan alat yang dikurasi untuk alur kerja Anda.',
  'resources.home.itemCount': '{count} item',
  'dashboard.aio.result.regionsDetected': '{count} area terdeteksi',
  'dashboard.aio.result.textsRecognized': '{count} teks dikenali',
  'dashboard.aio.result.translationsGenerated': '{count} terjemahan dihasilkan',
  'dashboard.aio.result.regionsSegmented': '{count} area tersegmentasi',
  'dashboard.aio.result.imagesCleaned': '{count} gambar dibersihkan',
  'dashboard.aio.result.blocksReady': '{count} blok siap untuk render',
  'dashboard.aio.result.finished': 'AIO selesai. {parts}.',
  'resources.glossary.category.general': 'Umum',
  'resources.glossary.category.typesetting': 'Typesetting',
  'resources.glossary.category.cleaning': 'Pembersihan',
  'resources.glossary.category.translation': 'Terjemahan',
  'resources.glossary.category.technical': 'Teknis',
  'resources.glossary.category.roles': 'Peran',
  'resources.glossary.filterAll': 'Semua',
  'resources.glossary.results_one': 'istilah ditemukan',
  'resources.glossary.results_other': 'istilah ditemukan',
  'resources.glossary.context': 'Glosarium',
  'resources.glossary.alphaAria': 'Navigasi alfabet',
  'resources.glossary.alphaBtnAria': 'Ke huruf {letter}',
  'dashboard.aio.config.sourceLanguage':
    'Bahasa Sumber (Deteksi/OCR/Terjemahan)',
  'dashboard.aio.config.targetLanguage': 'Bahasa Terjemahan',
  'dashboard.aio.pipeline.rewind': 'Mundurkan pipeline',
  'dashboard.aio.pipeline.forward': 'Majukan pipeline',
  'dashboard.aio.pipeline.snapshot': 'Snapshot: ',
  'dashboard.aio.pipeline.image': 'Gambar: ',
  'dashboard.aio.pipeline.stage': 'Tahap: ',
  'dashboard.aio.translation.noneSelected': 'Tidak ada model dipilih.',
  'dashboard.aio.translation.selected': 'Dipilih: ',
  'dashboard.aio.render.hint':
    'Kontrol font/warna/perataan ada di dock kontekstual overlay. Pintasan: Shift + Scroll untuk memutar.',
  'dashboard.aio.render.warning':
    'Gambar berada pada tahap sebelum Render. Gunakan Maju untuk melihat.',
  'dashboard.aio.render.disabled':
    'Aktifkan tahap Render di pipeline untuk mengonfigurasi.',
  'dashboard.stitch.lastToNext': 'Gambar terakhir dikirim ke batch berikutnya.',
  'dashboard.stitch.firstFromNext':
    'Gambar pertama dari batch berikutnya ditambahkan ke batch saat ini.',
  'dashboard.stitch.resetPlanning':
    'Perencanaan stitcher dihitung ulang secara otomatis.',
  'dashboard.aio.customAi.syncing': 'AI Kustom (menyinkronkan...)',
  'dashboard.aio.customOcr.syncing': 'OCR Kustom (menyinkronkan...)',
  'dashboard.aio.customOcr.useCase':
    'Profil OCR kustom menunggu sinkronisasi lokal.',
  'dashboard.aio.customAi.useCase':
    'Profil kustom menunggu sinkronisasi lokal.',
  'dashboard.aio.config.languageHint':
    'Bahasa sumber digunakan pada tahap Deteksi, Kenali, dan Terjemahkan. Bahasa terjemahan hanya berlaku untuk terjemahan.',
  'dashboard.aio.presets.title': 'Preset AIO berdasarkan bahasa',
  'dashboard.aio.presets.currentLanguage': 'Bahasa saat ini:',
  'dashboard.aio.presets.noneActive': 'Tidak ada preset aktif',
  'dashboard.aio.presets.activeSuffix': '(aktif)',
  'dashboard.aio.presets.new': 'Baru',
  'dashboard.aio.presets.edit': 'Edit',
  'dashboard.aio.presets.delete': 'Hapus',
  'dashboard.aio.presets.saveCurrent': 'Simpan saat ini',
  'dashboard.aio.presets.openSettings': 'Buka Preset di Pengaturan',
  'dashboard.aio.presets.presetName': 'Nama preset',
  'dashboard.aio.presets.namePlaceholder': 'Cth.: OCR JP Cepat',
  'dashboard.aio.presets.description': 'Deskripsi',
  'dashboard.aio.presets.optional': 'Opsional',
  'dashboard.aio.presets.setActiveFor': 'Tetapkan sebagai preset aktif untuk',
  'dashboard.aio.presets.cancel': 'Batal',
  'dashboard.aio.presets.update': 'Perbarui preset',
  'dashboard.aio.presets.create': 'Buat preset',
  'dashboard.aio.translation.selectedSummaryModel': 'Dipilih: {name}',
  'dashboard.aio.translation.selectedSummaryCustom':
    'Dipilih: {name} (Provider Kustom/GRATIS)',
  'dashboard.aio.translation.selectedSummaryLegacy':
    'Dipilih: {name} (Cloud/API/AI)',
  'dashboard.aio.translation.selectedSummaryEmpty':
    'Pilih model lokal atau cloud untuk menerjemahkan di AIO.',
  'dashboard.aio.translation.supportSummary':
    'Model lokal diunduh sesuai kebutuhan; model cloud/API tetap tersedia via kunci.',
  'dashboard.aio.translation.additionalContextPlaceholder': 'Konteks tambahan untuk terjemahan cloud...',
  'dashboard.aio.translation.notesToggle':
    'Hasilkan dan tampilkan TN terpisah dari terjemahan',
  'dashboard.aio.translation.neighborContextToggle':
    'Gunakan konteks dari gambar bersebelahan dalam batch',
  'dashboard.aio.translation.multimodalToggle':
    'Kirim gambar halaman sebagai konteks multimodal',
  'dashboard.aio.translation.activeConfigFor':
    'Konfigurasi aktif untuk: {value}.',
  'dashboard.aio.customAi.title': 'AI Kustom',
  'dashboard.aio.customAi.loadingProfiles': 'Memuat profil kustom...',
  'dashboard.aio.customAi.savedTranslationProfile':
    'Profil Terjemahan tersimpan',
  'dashboard.aio.customAi.newTranslationProfile': 'Profil terjemahan baru',
  'dashboard.aio.customAi.name': 'Nama',
  'dashboard.aio.customAi.translationNamePlaceholder':
    'Cth.: OpenRouter Manga EN-US',
  'dashboard.aio.customAi.apiBasePlaceholder': 'https://api.example.com/v1',
  'dashboard.aio.customAi.useLocalOllama': 'Preset Lokal Ollama',
  'dashboard.aio.customAi.apiKeyOptional': 'API Key (opsional)',
  'dashboard.aio.customAi.apiKeyPlaceholder': 'sk-...',
  'dashboard.aio.customAi.translationModelPlaceholder': 'openai/gpt-4.1...',
  'dashboard.aio.customAi.resetTranslation': 'Hapus Terjemahan',
  'dashboard.aio.customAi.useSavedTranslation': 'Gunakan Terjemahan',
  'dashboard.aio.customAi.removeTranslation': 'Hapus Terjemahan',
  'dashboard.aio.customAi.saveTranslation': 'Simpan Terjemahan',
  'dashboard.aio.customAi.savedOcrProfile': 'Profil OCR tersimpan',
  'dashboard.aio.customAi.newOcrProfile': 'Profil OCR baru',
  'dashboard.aio.customAi.ocrNamePlaceholder': 'Cth.: Private Vision OCR',
  'dashboard.aio.customAi.ocrModelPlaceholder': 'gpt-4.1-mini...',
  'dashboard.aio.customAi.resetOcr': 'Hapus OCR',
  'dashboard.aio.customAi.useSavedOcr': 'Gunakan OCR',
  'dashboard.aio.customAi.removeOcr': 'Hapus OCR',
  'dashboard.aio.customAi.saveOcr': 'Simpan OCR',
  'dashboard.aio.customAi.openAiCompatibleHint':
    'Gunakan API yang kompatibel dengan OpenAI.',
  'dashboard.aio.clean.maskDilation': 'Dilatasi Mask',
  'bugReport.title': 'Laporkan Bug',
  'bugReport.subtitle': 'Tangkapan layar + log otomatis + lampiran manual',
  'bugReport.close': 'Tutup',
  'bugReport.details': 'Detail',
  'bugReport.evidence': 'Bukti',
  'bugReport.machineSnapshotIncluded':
    'Secara otomatis menyertakan snapshot teknis mesin.',
  'bugReport.field.title': 'Judul',
  'bugReport.field.description': 'Deskripsi',
  'bugReport.field.severity': 'Tingkat keparahan',
  'bugReport.field.steps': 'Langkah untuk mereproduksi',
  'bugReport.field.expected': 'Yang diharapkan',
  'bugReport.field.actual': 'Yang terjadi',
  'bugReport.field.contact': 'Kontak',
  'bugReport.placeholder.title': 'Cth.: Error memproses batch di AIO',
  'bugReport.placeholder.description': 'Jelaskan masalahnya',
  'bugReport.placeholder.steps': '1. … 2. … 3. …',
  'bugReport.placeholder.contact': 'email, Discord, @user',
  'bugReport.severity.low': 'Rendah',
  'bugReport.severity.medium': 'Sedang',
  'bugReport.severity.high': 'Tinggi',
  'bugReport.severity.critical': 'Kritis',
  'bugReport.preparingEvidence': 'Menyiapkan tangkapan layar dan log…',
  'bugReport.dragToCrop': 'Seret untuk memilih area potong opsional.',
  'bugReport.clearCrop': 'Hapus potongan',
  'bugReport.manualAttachments': 'Lampiran manual',
  'bugReport.attach': 'Lampirkan',
  'bugReport.attach.summary':
    'Maks {count} file, {size}MB per file. Total: {total}.',
  'bugReport.attach.maxCount': 'Maks {count} lampiran.',
  'bugReport.attach.fileTooLarge': '{name} > {size}MB.',
  'bugReport.attach.totalTooLarge': 'Total > {size}MB.',
  'bugReport.attach.remove': 'Hapus {name}',
  'bugReport.screenshotUnavailable': 'Tangkapan layar tidak tersedia.',
  'bugReport.error.bridgeUnavailable': 'Bridge tidak tersedia.',
  'bugReport.error.prepareFailed': 'Gagal menyiapkan laporan bug.',
  'bugReport.error.noScreenshot': 'Tidak ada tangkapan layar tersedia.',
  'bugReport.error.fillTitleDescription': 'Isi judul dan deskripsi.',
  'bugReport.error.generic': 'Gagal.',
  'bugReport.success.sent': 'Laporan terkirim.{screenshot}',
  'bugReport.success.screenshot': 'Tangkapan layar: {url}',
  'bugReport.legalPrefix':
    'Dengan mengirim, Anda mengonfirmasi bahwa Anda telah meninjau tangkapan layar, log, dan lampiran. Materi diteruskan sesuai',
  'bugReport.sending': 'Mengirim…',
  'bugReport.submit': 'Kirim laporan',
  'dashboard.topbar.tools': 'Alat',
  'dashboard.topbar.showSidebar': 'Tampilkan sidebar',
  'dashboard.topbar.sidebar': 'Sidebar',
  'dashboard.topbar.disableBatch': 'Nonaktifkan batch',
  'dashboard.topbar.enableBatch': 'Aktifkan batch',
  'dashboard.topbar.batchStatus': 'Batch · {count}t',
  'dashboard.topbar.threads': 'Thread',
  'dashboard.topbar.viewMode': 'Tampilan',
  'dashboard.topbar.paginated': 'Berpaginasi',
  'dashboard.topbar.longStrip': 'Strip panjang',
  'dashboard.topbar.rotate90': 'Putar 90°',
  'dashboard.topbar.selectImage': 'Pilih gambar',
  'dashboard.topbar.export': 'Ekspor',
  'dashboard.topbar.textFile': 'File Teks',
  'dashboard.topbar.textPackage': 'Paket Teks',
  'dashboard.topbar.imagePackage': 'Paket Gambar',
  'dashboard.topbar.downloadTextAsTxt': 'Unduh terjemahan sebagai .txt.',
  'dashboard.topbar.downloadVisualZip':
    'ZIP dengan file .txt OCR dan terjemahan per gambar.',
  'dashboard.topbar.format': 'Format',
  'dashboard.topbar.quality': 'Kualitas',
  'dashboard.topbar.package': 'Paket',
  'dashboard.topbar.rawText': 'Teks Mentah',
  'dashboard.topbar.translated': 'Diterjemahkan',
  'dashboard.topbar.inpainted': 'Inpainted',
  'dashboard.topbar.downloadTxt': 'Unduh TXT',
  'dashboard.topbar.downloadZip': 'Unduh ZIP',
  'dashboard.topbar.downloadPackage': 'Unduh Paket',
  'dashboard.topbar.layeredPsd': 'PSD Berlapis',
  'dashboard.topbar.layeredPsdHint':
    'Ekspor PSD untuk Photoshop, CSP, Krita, GIMP.',
  'dashboard.topbar.compression': 'Kompresi',
  'dashboard.topbar.dpi': 'DPI',
  'dashboard.topbar.ocrOverlay': 'Overlay OCR',
  'dashboard.topbar.crops': 'Potongan',
  'dashboard.topbar.rawTextLayer': 'Lapisan teks mentah',
  'dashboard.topbar.translatedLayer': 'Lapisan terjemahan',
  'dashboard.topbar.psTextLayers': 'Lapisan teks PS',
  'dashboard.topbar.metadataJson': 'Metadata JSON',
  'dashboard.topbar.photoshopRequired':
    'Memerlukan Adobe Photoshop (2025–cc2017).',
  'dashboard.topbar.generating': 'Menghasilkan…',
  'dashboard.topbar.psdWithMeta': 'PSD + Meta',
  'dashboard.topbar.exportPsd': 'Ekspor PSD',
  'dashboard.topbar.undoWorkspace': 'Undo workspace',
  'dashboard.topbar.undoShortcut': 'Undo (Ctrl+Z)',
  'dashboard.topbar.redoWorkspace': 'Redo workspace',
  'dashboard.topbar.redoShortcut': 'Redo (Ctrl+Shift+Z / Ctrl+Y)',
  'dashboard.topbar.shortcuts': 'Pintasan',
  'dashboard.topbar.shortcutsHint': 'Pintasan (H)',
  'dashboard.topbar.hideTools': 'Sembunyikan alat',
  'dashboard.topbar.showTools': 'Tampilkan alat',
  'dashboard.topbar.hide': 'Sembunyikan',
  'dashboard.topbar.profile': 'Profil',
  'dashboard.topbar.exportWorkspace': 'Ekspor workspace',
  'dashboard.topbar.importWorkspace': 'Impor workspace',
  'dashboard.topbar.clearLocalAutosave': 'Hapus simpan otomatis lokal',
  'dashboard.topbar.closeWorkspace': 'Tutup workspace',
  'dashboard.topbar.replayTour': 'Putar ulang tur',
  'dashboard.topbar.scanlationFeed': 'Feed Scanlation',
  'dashboard.topbar.rankings': 'Peringkat',
  'dashboard.topbar.logout': 'Keluar',
  'dashboard.topbar.brand': 'KŌMA Studio',
  'dashboard.topbar.autoManualBadge': 'A/M',
  'dashboard.topbar.zoomOut': 'Perkecil',
  'dashboard.topbar.zoomIn': 'Perbesar',
  'dashboard.topbar.compressionRle': 'RLE',
  'dashboard.topbar.compressionZip': 'ZIP',
  'dashboard.topbar.compressionRaw': 'RAW',
  'dashboard.topbar.navigation': 'Navigasi',
  'dashboard.topbar.optionPng': 'PNG',
  'dashboard.topbar.optionJpeg': 'JPEG',
  'dashboard.topbar.optionWebp': 'WEBP',
  'dashboard.topbar.optionPdf': 'PDF',
  'dashboard.topbar.optionCbz': 'CBZ',
  'dashboard.topbar.optionCb7': 'CB7',
  'dashboard.topbar.optionZip': 'ZIP',
  'renderPreview.circularText': 'Teks Melingkar',
  'settings.aioPresets.description':
    'Kombinasi model untuk 5 tahap AIO berdasarkan bahasa sumber. Pilih preset mana yang aktif.',
  'settings.aioPresets.catalog': 'Katalog',
  'settings.aioPresets.syncingCatalog': 'Menyinkronkan model lokal + cloud.',
  'settings.aioPresets.editPreset': 'Edit Preset',
  'settings.aioPresets.newPreset': 'Preset Baru',
  'settings.aioPresets.namePlaceholder': 'Cth.: Japanese HQ',
  'settings.aioPresets.sourceLanguage': 'Bahasa sumber',
  'settings.aioPresets.shortDescription': 'Deskripsi singkat…',
  'settings.aioPresets.select': 'Pilih',
  'settings.aioPresets.noneRegistered': 'Belum ada preset terdaftar.',
  'settings.aioPresets.createFirst': 'Buat yang pertama',
  'settings.aioPresets.presetCount': '{count} preset',
  'settings.aioPresets.clearActive': 'Hapus aktif',
  'settings.aioPresets.active': 'Aktif',
  'settings.aioPresets.activate': 'Aktifkan',
  'settings.aioPresets.editNamed': 'Edit {name}',
  'settings.aioPresets.deleteNamed': 'Hapus {name}',
  'settings.pickerPalette.title': 'Palet Pemilih',
  'settings.pickerPalette.description':
    'Preset warna solid dan gradien untuk pemilih isian.',
  'settings.pickerPalette.newPreset': 'Preset baru',
  'settings.pickerPalette.add': 'Tambah',
  'settings.pickerPalette.reset': 'Reset',
  'settings.pickerPalette.hintPrefix': 'Menerima solid dan gradien. Cth.:',
  'settings.pickerPalette.hintOr': 'atau',
  'settings.pickerPalette.solids': 'Solid',
  'settings.pickerPalette.gradients': 'Gradien',
  'settings.modePresets.title': 'Preset Mode',
  'settings.modePresets.description':
    'Gaya dasar per mode teks. Diterapkan secara otomatis di dasbor.',
  'settings.modePresets.targetMode': 'Mode target',
  'settings.modePresets.outline': 'Garis tepi',
  'settings.modePresets.off': 'Mati',
  'settings.modePresets.outlineWidth': 'Lebar garis tepi',
  'settings.modePresets.ocrGradient': 'Gradien OCR',
  'settings.modePresets.detect': 'Deteksi',
  'settings.modePresets.ignore': 'Abaikan',
  'settings.modePresets.textColor': 'Warna Teks',
  'settings.modePresets.outlineColor': 'Warna Garis Tepi',
  'settings.modePresets.all': 'Semua',
  'settings.modePresets.mode': 'Mode',
  'settings.modePresets.save': 'Simpan',
  'settings.typographerLibrary.title': 'Pustaka Typesetter',
  'settings.typographerLibrary.description':
    'Gaya global dengan folder, preset default, dan pengikatan berdasarkan mode terdeteksi.',
  'settings.typographerLibrary.newFolder': 'Folder baru',
  'settings.typographerLibrary.defaultPreset': 'Preset default',
  'settings.typographerLibrary.none': 'Tidak ada',
  'settings.typographerLibrary.edit': 'Edit',
  'settings.typographerLibrary.new': 'Baru',
  'settings.typographerLibrary.presetTypographer': 'Preset Typesetter',
  'settings.typographerLibrary.folder': 'Folder',
  'settings.typographerLibrary.withoutFolder': 'Tanpa folder',
  'settings.typographerLibrary.descriptionPlaceholder': 'Cth.: Balon EN-US',
  'settings.typographerLibrary.padding': 'Padding',
  'settings.typographerLibrary.lineSpacing': 'Spasi baris',
  'settings.updates.title': 'Pembaruan',
  'settings.updates.currentVersion': 'Versi saat ini',
  'settings.updates.newVersion': 'Versi baru',
  'settings.updates.status': 'Status',
  'settings.updates.channel': 'Kanal',
  'settings.updates.installOnClose': 'Instal saat ditutup',
  'settings.updates.policy': 'Kebijakan',
  'settings.updates.mandatory': 'Wajib',
  'settings.updates.optional': 'Opsional',
  'settings.updates.lastCheck': 'Pemeriksaan terakhir',
  'settings.updates.downloadCompleted': 'Unduhan selesai',
  'settings.updates.channelTitle': 'Kanal pembaruan',
  'settings.updates.stableDesc': 'Rilis yang sudah diuji dan stabil',
  'settings.updates.betaDesc': 'Akses awal ke fitur',
  'settings.updates.installOnCloseTitle':
    'Instal pembaruan saat menutup aplikasi',
  'settings.updates.installOnCloseDesc':
    'Jika paket sudah diunduh, instalasi akan dimulai secara otomatis saat keluar.',
  'settings.updates.checking': 'Memeriksa…',
  'settings.updates.checkNow': 'Periksa pembaruan',
  'settings.updates.download': 'Unduh pembaruan',
  'settings.autosave.title': 'Simpan Otomatis Workspace',
  'settings.autosave.description':
    'Mengontrol apakah dasbor secara otomatis menyimpan workspace lokal dan interval antara penyimpanan.',
  'settings.autosave.enableTitle': 'Aktifkan simpan otomatis',
  'settings.autosave.enableDesc':
    'Jika diaktifkan, workspace akan disimpan secara lokal pada interval reguler setiap kali ada perubahan yang tertunda.',
  'settings.autosave.interval': 'Interval',
  'settings.autosave.save': 'Simpan pengaturan',
  'settings.shortcuts.title': 'Pusat Pintasan',
  'settings.shortcuts.description':
    'Konfigurasi pintasan resmi kini ada di dasbor, di Topbar. Ini mencegah ketidaksesuaian antara layar utama dan halaman pengaturan.',
  'settings.shortcuts.whereToEdit': 'Tempat mengedit',
  'settings.shortcuts.whereToEditDesc': 'Buka dasbor dan gunakan',
  'settings.shortcuts.orPress': 'atau tekan',
  'settings.tabs.ariaLabel': 'Tab pengaturan',
  'settings.integrations.test': 'Tes',
  'settings.integrations.testing': 'Mengetes…',
  'settings.integrations.ok': '✓ OK',
  'settings.integrations.failed': '✗ Gagal',
  'settings.integrations.saved': '✓ Tersimpan',
  'settings.integrations.discord.description':
    'Notifikasi pemrosesan, error, dan peringatan kuota.',
  'settings.integrations.discord.webhookUrl': 'URL Webhook',
  'settings.integrations.discord.webhookPlaceholder':
    'https://discord.com/api/webhooks/…',
  'settings.integrations.discord.botName': 'Nama Bot',
  'settings.integrations.discord.webhookActive': 'Webhook aktif',
  'settings.integrations.discord.howToSetup': 'Cara mengatur',
  'settings.integrations.discord.step1': 'Di Discord:',
  'settings.integrations.discord.step1Strong':
    'Pengaturan Server → Integrasi → Webhook → Webhook Baru',
  'settings.integrations.discord.step2':
    'Salin URL dan tempel di kolom di atas.',
  'dashboard.dashboardLlm.extraContextPlaceholder':
    'Konteks tambahan: karakter, nada, glosarium…',
  'dashboard.dashboardLlm.temperature': 'Temperature',
  'dashboard.dashboardLlm.topP': 'Top P',
  'dashboard.dashboardLlm.maxTokens': 'Max Token',
  'dashboard.dashboardLlm.translationProfile': 'Profil Terjemahan',
  'dashboard.dashboardLlm.translationModelPlaceholder': 'gpt-4.1, claude…',
  'dashboard.dashboardLlm.apiKey': 'API Key',
  'dashboard.dashboardLlm.apiKeyPlaceholder': 'sk-… (opsional)',
  'dashboard.dashboardLlm.ocrProfile': 'Profil OCR',
  'dashboard.dashboardLlm.openAiCompatibleHint':
    'Kompatibel dengan OpenAI. Base bisa /v1 atau endpoint lengkap. Beberapa menerima kunci kosong.',
  'dashboard.dashboardLlm.clear': 'Hapus',
  'dashboard.dashboardLlm.use': 'Gunakan',
  'dashboard.dashboardLlm.remove': 'Hapus',
  'dashboard.dashboardLlm.save': 'Simpan',
  'dashboard.dashboardLlm.hdStrategy': 'Strategi HD',
  'dashboard.dashboardLlm.resize': 'Ubah Ukuran',
  'dashboard.dashboardLlm.crop': 'Potong',
  'dashboard.dashboardLlm.original': 'Asli',
  'dashboard.dashboardLlm.hdStrategyHint':
    'Strategi untuk gambar besar sebelum inpainting.',
  'dashboard.dashboardLlm.resizeLimit': 'Batas Ukuran',
  'dashboard.dashboardLlm.cropMargin': 'Margin Potong',
  'dashboard.dashboardLlm.cropTriggerSize': 'Ukuran Pemicu Potong',
  'dashboard.dashboardRegion.title': 'Area',
  'dashboard.dashboardRegion.blocks': 'Blok',
  'dashboard.dashboardRegion.selection': 'Pilihan',
  'dashboard.dashboardRegion.ocr': 'OCR',
  'dashboard.dashboardRegion.translation': 'Terjemahan',
  'dashboard.dashboardRegion.notes': 'Catatan',
  'dashboard.dashboardRegion.segments': 'Segmen',
  'dashboard.dashboardRegion.disabled': 'dinonaktifkan',
  'dashboard.dashboardRegion.manualHint':
    'Seret pada pratinjau untuk menambah area. Gunakan sudut untuk mengubah ukuran.',
  'dashboard.dashboardRegion.manualModeHint':
    'Mode manual untuk menyesuaikan kotak.',
  'dashboard.dashboardRegion.dockHint':
    'Gunakan dock mengambang di kanvas untuk memilih area, membersihkan, dan mengedit. Alat diaktifkan berdasarkan tahap aktif.',
  'dashboard.translator.workspace.ariaLabel': 'Mode translator',
  'dashboard.translator.sourceTitle': 'Teks Sumber',
  'dashboard.translator.sourceDescription':
    'Tempel, impor, dan terjemahkan dengan mempertahankan paragraf dan pemisah baris.',
  'dashboard.translator.sourcePlaceholder':
    'Tempel chapter atau kutipan untuk diterjemahkan di sini…',
  'dashboard.translator.sourceAria': 'Teks sumber untuk terjemahan',
  'dashboard.translator.import': 'Impor',
  'dashboard.translator.translating': 'Menerjemahkan…',
  'dashboard.translator.translate': 'Terjemahkan',
  'dashboard.translator.editorCleared': 'Editor dihapus.',
  'dashboard.translator.clear': 'Hapus',
  'dashboard.translator.resultTitle': 'Hasil',
  'dashboard.translator.resultModelPrefix': 'Model: {value}',
  'dashboard.translator.resultPlaceholder': 'Jalankan untuk melihat hasil.',
  'dashboard.translator.resultFieldPlaceholder':
    'Terjemahan akan muncul di sini…',
  'dashboard.translator.resultPlaceholderAria': 'Hasil terjemahan',
  'dashboard.translator.editorDirty':
    'Teks sumber berubah. Jalankan ulang untuk memperbarui.',
  'dashboard.translator.resultCopied': 'Hasil disalin.',
  'dashboard.translator.copy': 'Salin',
  'dashboard.translator.downloadTxt': 'Unduh TXT',
  'dashboard.translator.modeLabel': 'Translator',
  'dashboard.translator.workspace.textHint':
    'Terjemahkan teks bebas dengan mempertahankan paragraf dan pemisah baris.',
  'dashboard.translator.workspace.visualHint':
    'Deteksi area, OCR, dan terjemahkan per kotak dalam gambar.',
  'dashboard.translator.processing.standard': 'Standar',
  'dashboard.translator.processing.aiSfx': 'AI SFX',
  'dashboard.language.source': 'Bahasa sumber',
  'dashboard.language.target': 'Bahasa target',
  'dashboard.models.title': 'Model',
  'dashboard.translator.ocr': 'OCR',
  'dashboard.translator.ocr.manageModels': 'Kelola model OCR',
  'dashboard.translator.noneAvailable': 'Tidak ada model',
  'dashboard.translator.device': 'Perangkat',
  'dashboard.translator.languages': 'Bahasa',
  'dashboard.translator.multi': 'multi',
  'dashboard.translator.noDescription': 'Tidak ada deskripsi.',
  'dashboard.translator.localStatus': 'Status lokal: {value}',
  'dashboard.translator.sfx.cleanModel': 'Cleaner SFX',
  'dashboard.translator.sfx.hint':
    'Cth.: utamakan SFX pendek dan tebal, lebih konservatif jika efek menyatu dengan garis halus.',
  'dashboard.translator.llm.contextPlaceholder':
    'Konteks: glosarium, nada, karakter…',
  'dashboard.translator.llm.generateNotes': 'Hasilkan TN terpisah',
  'dashboard.translator.llm.multimodalContext':
    'Gambar sebagai konteks multimodal',
  'dashboard.translator.llm.temperature': 'Temperature',
  'dashboard.translator.llm.topP': 'Top P',
  'dashboard.translator.llm.maxTokens': 'Max Token',
  'dashboard.translator.execute.title': 'Jalankan',
  'dashboard.translator.loadImage': 'Muat',
  'dashboard.translator.detectTranslate': 'Deteksi + Terjemahkan',
  'dashboard.translator.retranslateImage': 'Terjemahkan ulang gambar',
  'dashboard.translator.retranslateRegion': 'Terjemahkan ulang area',
  'dashboard.translator.regionTitle': 'Area',
  'dashboard.translator.blocks': 'Blok',
  'dashboard.translator.selection': 'Pilihan',
  'dashboard.translator.translation': 'Terjemahan',
  'dashboard.translator.notes': 'Catatan',
  'dashboard.translator.none': 'tidak ada',
  'dashboard.translator.charactersTranslated':
    '{count} karakter diterjemahkan.',
  'splitter.workspace.emptyTitle': 'Muat gambar',
  'splitter.workspace.emptyDescription':
    'Gunakan sidebar kiri untuk mengimpor halaman. Pratinjau menampilkan potongan yang disarankan dan segmen yang dihasilkan.',
  'splitter.workspace.previewTitle': 'Pratinjau potongan',
  'splitter.workspace.previewDescription':
    'Klik dua kali untuk menambah potongan. Seret garis untuk menyesuaikan.',
  'splitter.workspace.previewAlt': 'Pratinjau {name}',
  'splitter.workspace.cutTitle': 'Potongan {index}',
  'splitter.workspace.hide': 'Sembunyikan',
  'splitter.workspace.show': 'Tampilkan',
  'splitter.workspace.recalculate': 'Hitung Ulang',
  'splitter.workspace.diagnostics': 'Diagnostik',
  'splitter.workspace.engine': 'Mesin',
  'splitter.workspace.cuts': 'Potongan',
  'splitter.workspace.segments': 'Segmen',
  'splitter.workspace.whitespace': 'Spasi Kosong',
  'splitter.workspace.noWarnings': 'Tidak ada peringatan untuk gambar aktif.',
  'splitter.workspace.cutsTitle': 'Potongan ({count})',
  'splitter.workspace.cutCard': 'Potongan #{index}',
  'splitter.workspace.locked': 'Terkunci',
  'splitter.workspace.unlocked': 'Tidak Terkunci',
  'splitter.workspace.merge': 'Gabungkan',
  'splitter.workspace.segmentsTitle': 'Segmen ({count})',
  'splitter.workspace.segmentAlt': 'Segmen {index}',
  'splitter.workspace.segmentCard': 'Segmen #{index}',
  'splitter.workspace.analyzing': 'Menganalisis…',
  'splitter.workspace.dimensions': 'Dimensi',
  'splitter.workspace.axis': 'Sumbu',
  'splitter.workspace.strategy': 'Strategi',
  'splitter.sidebar.title': 'Pemotong',
  'splitter.sidebar.recipe': 'Resep',
  'splitter.sidebar.preset': 'Preset',
  'splitter.sidebar.mode': 'Mode',
  'splitter.sidebar.direction': 'Arah',
  'splitter.sidebar.vertical': 'Vertikal',
  'splitter.sidebar.horizontal': 'Horizontal',
  'splitter.sidebar.parts': 'Bagian',
  'splitter.sidebar.targetHeight': 'Tinggi target',
  'splitter.sidebar.minimum': 'Minimum',
  'splitter.sidebar.maximum': 'Maksimum',
  'splitter.sidebar.adjustments': 'Penyesuaian',
  'splitter.sidebar.overlap': 'Tumpang Tindih ({value}px)',
  'splitter.sidebar.whitespace': 'Spasi Kosong ({value})',
  'splitter.sidebar.noise': 'Noise ({value})',
  'splitter.sidebar.edgeGuard': 'Pelindung Tepi ({value}px)',
  'splitter.sidebar.protectTallBlocks': 'Lindungi blok tinggi',
  'splitter.sidebar.baseName': 'Nama dasar',
  'splitter.sidebar.baseNamePlaceholder': 'koma-split',
  'splitter.sidebar.suffix': 'Sufiks',
  'splitter.sidebar.suffixPlaceholder': '{image}-part-{index}',
  'splitter.sidebar.tokensPrefix': 'Token:',
  'splitter.sidebar.tokensAnd': 'dan',
  'splitter.sidebar.actions': 'Tindakan',
  'splitter.sidebar.imagesCount': '{count} gbr.',
  'splitter.sidebar.activeImage': 'Aktif: {name}',
  'splitter.sidebar.selectImage': 'Pilih gambar.',
  'splitter.sidebar.reanalyze': 'Analisis Ulang',
  'splitter.sidebar.applyToActive': '→ Aktif',
  'splitter.sidebar.applyToAll': '→ Semua',
  'splitter.sidebar.clearCuts': 'Hapus potongan',
  'splitter.sidebar.resetRecipe': 'Reset resep',
  'splitter.sidebar.exportActive': 'Ekspor aktif',
  'splitter.sidebar.exportBatch': 'Ekspor batch',
  'splitter.sidebar.directoryUnavailable':
    'showDirectoryPicker tidak tersedia.',
  'splitter.sidebar.exportToFolder': 'Ekspor ke folder',
  'stitch.workspace.cancelled': 'Rendering Stitcher dibatalkan.',
  'stitch.workspace.renderingBatch': 'Merender batch {current}/{total}...',
  'stitch.workspace.batchReady': 'Batch {current} siap diunduh.',
  'stitch.workspace.generatingZip': 'Membuat {count} batch Stitcher...',
  'stitch.workspace.zipReady':
    'Paket ZIP dengan {count} batch berhasil dibuat.',
  'stitch.workspace.savingToFolder': 'Menyimpan {count} batch ke folder...',
  'stitch.workspace.folderReady': 'Batch diekspor ke folder yang dipilih.',
  'stitch.workspace.folderCancelled': 'Ekspor ke folder dibatalkan.',
  'stitch.workspace.noBatchSelected': 'Tidak ada batch dipilih',
  'stitch.workspace.previewEyebrow': 'Pratinjau Batch',
  'stitch.workspace.batchTitle': 'Batch {current} dari {total}',
  'stitch.workspace.noBatchAvailable': 'Tidak ada batch tersedia',
  'stitch.workspace.imagesCount': '{count} gambar',
  'stitch.workspace.previousBatch': 'Batch sebelumnya',
  'stitch.workspace.nextBatch': 'Batch berikutnya',
  'stitch.workspace.zoomOut': 'Perkecil',
  'stitch.workspace.resetZoom': 'Reset zoom',
  'stitch.workspace.zoomIn': 'Perbesar',
  'stitch.workspace.exporting': 'Mengekspor…',
  'stitch.workspace.exportBatch': 'Ekspor batch',
  'stitch.workspace.zip': 'ZIP',
  'stitch.workspace.folder': 'Folder',
  'stitch.workspace.cancel': 'Batal',
  'stitch.workspace.emptyTitle': 'Belum ada batch',
  'stitch.workspace.emptyDescription':
    'Muat gambar di Dashboard dan konfigurasikan batch di kotak alat sidebar kanan.',
  'stitch.workspace.generatingPreview': 'Membuat pratinjau {progress}%',
  'stitch.workspace.previewAlt': 'Pratinjau batch yang digabung',
  'stitch.workspace.errorTitle': 'Stitcher Gagal',
  'stitch.workspace.planningEyebrow': 'Perencanaan',
  'stitch.workspace.planningTitle': '{count} batch direncanakan',
  'stitch.workspace.planningSubtitle':
    'Tinjau batch besar dan telusuri rencana.',
  'stitch.workspace.baseLabel': 'Dasar:',
  'stitch.workspace.batchCardTitle': 'Batch {index}',
  'stitch.workspace.batchCardDims': '{count} gbr · {width}×{height}',
  'stitch.workspace.activeBatch': 'Batch aktif',
  'stitch.workspace.stats.images': 'Gambar',
  'stitch.workspace.stats.output': 'Output',
  'stitch.workspace.stats.size': 'Ukuran',
  'stitch.workspace.stats.preview': 'Pratinjau',
  'stitch.workspace.awaiting': 'Menunggu',
  'stitch.workspace.toolboxTitle': 'Kotak Alat',
  'stitch.workspace.toolboxDescription':
    'Pengaturan dan penyesuaian batas ada di sidebar kanan.',
  'stitch.sidebar.title': 'Penggabung',
  'stitch.sidebar.layout': 'Tata Letak',
  'stitch.sidebar.layoutMode': 'Mode gabung',
  'stitch.sidebar.vertical': 'Vertikal',
  'stitch.sidebar.horizontal': 'Horizontal',
  'stitch.sidebar.strategy': 'Strategi',
  'stitch.sidebar.fixedCount': 'Jumlah tetap',
  'stitch.sidebar.targetAxis': 'Target berdasarkan sumbu',
  'stitch.sidebar.single': 'Semua dalam satu',
  'stitch.sidebar.imagesPerBatch': 'Gambar per batch',
  'stitch.sidebar.spacing': 'Jarak ({value}px)',
  'stitch.sidebar.alignment': 'Perataan',
  'stitch.sidebar.start': 'Awal',
  'stitch.sidebar.center': 'Tengah',
  'stitch.sidebar.end': 'Akhir',
  'stitch.sidebar.output': 'Output',
  'stitch.sidebar.background': 'Latar Belakang',
  'stitch.sidebar.backgroundColor': 'Warna latar belakang',
  'stitch.sidebar.baseName': 'Nama dasar',
  'stitch.sidebar.baseNamePlaceholder': 'koma-stitch',
  'stitch.sidebar.imagesInfo':
    '{count} gambar. Urutan saat ini menentukan batch.',
  'stitch.sidebar.recalculate': 'Hitung ulang batch',
  'stitch.sidebar.boundary': 'Batas',
  'stitch.sidebar.boundaryBatch': 'Batch {current}/{total} · {count} gbr',
  'stitch.sidebar.noBatch': 'Tidak ada batch',
  'stitch.sidebar.moveLastToNext': 'Terakhir → berikutnya',
  'stitch.sidebar.pullFromNext': 'Tarik dari berikutnya',
  'modelManager.filters.catalog': 'Katalog',
  'modelManager.filters.all': 'Semua',
  'modelManager.filters.local': 'Lokal',
  'modelManager.filters.cloud': 'Cloud',
  'modelManager.filters.language': 'Bahasa',
  'modelManager.filters.status': 'Status',
  'modelManager.filters.installed': 'Terinstal',
  'modelManager.filters.notInstalled': 'Belum terinstal',
  'modelManager.filters.updateAvailable': 'Pembaruan tersedia',
  'modelManager.tooltip.speed.fast': 'Cepat',
  'modelManager.tooltip.speed.good': 'Baik',
  'modelManager.tooltip.speed.excellent': 'Sangat Baik',
  'modelManager.tooltip.allLanguages': 'Semua bahasa yang didukung',
  'modelManager.tooltip.infoAria': 'Info model untuk {name}',
  'modelManager.tooltip.info': 'Info',
  'modelManager.tooltip.aioStage': 'Tahap AIO',
  'modelManager.tooltip.description': 'Deskripsi',
  'modelManager.tooltip.languages': 'Bahasa',
  'modelManager.tooltip.speed.label': 'Kecepatan',
  'modelManager.tooltip.minimum': 'Minimum',
  'modelManager.tooltip.downloadSize': 'Ukuran unduhan',
  'modelManager.tooltip.diskSpace': 'Ruang disk',
  'modelManager.tooltip.version': 'Versi',
  'modelManager.status.installed': 'Terinstal',
  'modelManager.status.updateAvailable': 'Pembaruan tersedia',
  'modelManager.status.downloading': 'Mengunduh',
  'modelManager.status.queued': 'Dalam antrean',
  'modelManager.status.verifying': 'Memverifikasi',
  'modelManager.status.failed': 'Gagal',
  'modelManager.status.cancelled': 'Dibatalkan',
  'modelManager.status.incomplete': 'Tidak lengkap',
  'modelManager.status.notInstalled': 'Belum terinstal',
  'modelManager.actions.selected': 'Dipilih',
  'modelManager.actions.useModel': 'Gunakan model',
  'modelManager.actions.uninstall': 'Hapus instalasi',
  'modelManager.actions.update': 'Perbarui',
  'modelManager.actions.retry': 'Coba lagi',
  'modelManager.actions.install': 'Instal',
  'modelManager.actions.source': 'Sumber',
  'modelCard.status.selected': 'Dipilih',
  'modelCard.status.failed': 'Gagal',
  'modelCard.status.verifying': 'Memverifikasi…',
  'modelCard.status.queued': 'Dalam antrean…',
  'modelCard.status.downloading': 'Mengunduh…',
  'modelCard.status.cancelled': 'Dibatalkan',
  'modelCard.status.incomplete': 'Tidak lengkap',
  'modelCard.status.notInstalled': 'Belum terinstal',
  'modelCard.action.cancel': 'Batal',
  'modelCard.action.remove': 'Hapus',
  'modelCard.action.update': 'Perbarui',
  'modelCard.action.install': 'Instal',
  'modelCard.action.retry': 'Coba lagi',
  'modelCard.action.active': 'Aktif',
  'modelCard.action.use': 'Gunakan',
  'modelManager.stage.translate': 'Dapatkan Terjemahan',
  'modelManager.installAll.attention': 'Perhatian',
  'modelManager.installAll.warning':
    'Anda akan mengunduh SEMUA model terjemahan.',
  'modelManager.installAll.totalSize': 'Total ukuran: {size}',
  'modelManager.installAll.space': 'Ruang tersedia: {space}',
  'modelManager.installAll.time': 'Estimasi waktu: tergantung koneksi Anda',
  'modelManager.installAll.notEnoughSpace':
    'Ruang tidak cukup. Diperlukan: {required} | Tersedia: {available}',
  'modelManager.installAll.confirm':
    'Ini mungkin memakan waktu lama dan menggunakan ruang disk yang signifikan. Apakah Anda ingin melanjutkan?',
  'modelManager.installAll.confirmDownload': 'Konfirmasi Unduhan',
  'modelManager.disk.notVerified': 'Disk belum diverifikasi',
  'modelManager.disk.free': '{space} tersedia',
  'modelManager.disk.models': '{installed}/{total} model ({size})',
  'modelManager.enhance.title': 'Model Peningkatan',
  'modelManager.enhance.description':
    'Katalog lokal eksklusif untuk enhancer. Instal, perbarui, hapus instalasi, atau impor ONNX.',
  'modelManager.enhance.freeSpace': 'Ruang kosong',
  'modelManager.enhance.notChecked': 'belum diperiksa',
  'modelManager.enhance.closeAria': 'Tutup modal model peningkatan',
  'modelManager.enhance.directInstall': 'Instal langsung',
  'modelManager.enhance.directInstallDesc':
    'Model terkurasi dengan unduhan langsung atau instalasi terkelola di mini-backend.',
  'modelManager.enhance.manualImport': 'Impor manual',
  'modelManager.enhance.manualImportDesc':
    'Model yang terdaftar di katalog tetapi dimuat melalui ONNX lokal. Gunakan konversi eksternal jika hanya `.pth` yang tersedia.',
  'modelManager.enhance.importOnnxBadge': 'Impor ONNX',
  'modelManager.enhance.statusLabel': 'Status',
  'modelManager.enhance.estimatedDisk': 'Estimasi disk',
  'modelManager.enhance.reimportOnnx': 'Impor Ulang ONNX',
  'modelManager.enhance.pthHint': 'Untuk bobot dalam',
  'modelManager.enhance.pthHintSuffix':
    'konversi ke ONNX terlebih dahulu lalu gunakan impor manual.',
  'common.yes': 'Ya',
  'dashboard.organize.hint.reorder':
    'Seret dan susun ulang file di panel kiri.',
  'dashboard.organize.hint.rotate':
    'Gunakan tombol rotasi untuk memperbaiki halaman yang dipindai secara horizontal.',
  'guides.common.beginner': 'Pemula',
  'guides.common.intermediate': 'Menengah',
  'guides.common.advanced': 'Lanjutan',
  'guides.home.title': 'Panduan & Tutorial',
  'guides.home.description':
    'Pelajari cara menguasai setiap alat di KŌMA Studio dengan panduan langkah demi langkah, tips produktivitas, dan contoh nyata.',
  'guides.home.searchPlaceholder': 'Cari panduan, pintasan, tips...',
  'guides.home.searchAria': 'Cari panduan',
  'guides.home.continueReading': 'Lanjutkan dari terakhir dibaca',
  'guides.home.stepProgress': 'Langkah {current} dari {total} · {time}',
  'guides.home.continueCta': 'Lanjutkan →',
  'guides.home.categories': 'Kategori',
  'guides.home.guidesCountLabel': 'panduan{suffix}',
  'guides.home.completedCountLabel': 'selesai{suffix}',
  'guides.home.guidesPluralSuffix': '',
  'guides.home.saved': 'Disimpan ({count})',
  'guides.reader.backToGuides': 'Kembali ke Panduan',
  'guides.reader.notFound': 'Panduan tidak ditemukan',
  'guides.reader.progressAria': 'Progres panduan',
  'guides.reader.stepsAria': 'Langkah-langkah panduan',
  'guides.reader.stepLabel': 'Langkah {index}',
  'guides.reader.recent': 'Terbaru',
  'guides.reader.guides': 'Panduan',
  'guides.reader.removeBookmark': 'Hapus penanda',
  'guides.reader.saveBookmark': 'Simpan penanda',
  'guides.reader.previous': 'Sebelumnya',
  'guides.reader.next': 'Berikutnya',
  'guides.reader.completeGuide': 'Selesaikan Panduan',
  'guides.detail.back': 'Kembali',
  'guides.detail.notFound': 'Panduan tidak ditemukan.',
  'guides.detail.stepsAria': 'Langkah-langkah panduan',
  'guides.detail.stepLabel': 'Langkah {index}',
  'guides.detail.recent': 'Terbaru',
  'guides.detail.guides': 'Panduan',
  'guides.detail.stepCounter': 'Langkah {current} dari {total}',
  'guides.detail.previous': 'Sebelumnya',
  'guides.detail.next': 'Berikutnya',
  'guides.detail.complete': 'Selesai',
  'guides.detail.completed': 'Selesai ✓',
  'guides.detail.tocAria': 'Daftar isi',
  'guides.detail.inThisGuide': 'Dalam panduan ini',
  'guides.detail.removeFavorite': 'Hapus favorit',
  'guides.detail.addFavorite': 'Tambah favorit',
  'guides.detail.saved': 'Disimpan',
  'guides.detail.save': 'Simpan',
  'guides.step.copyCode': 'Salin kode',
  'guides.step.copied': 'Disalin',
  'guides.step.copy': 'Salin',
  'guides.search.dialogAria': 'Cari panduan',
  'guides.search.placeholder': 'Cari panduan, pintasan, tips...',
  'guides.search.inputAria': 'Cari',
  'guides.search.close': 'Tutup pencarian',
  'guides.search.noResults': 'Tidak ada hasil untuk "{query}"',
  'guides.search.results': 'Hasil ({count})',
  'guides.search.recent': 'Terbaru',
  'guides.search.navigate': 'navigasi',
  'guides.search.open': 'buka',
  'guides.search.closeVerb': 'tutup',
  'guides.category.searchPlaceholder': 'Cari di {category}...',
  'guides.category.searchAria': 'Cari di {category}',
  'guides.category.noSearchResults': 'Tidak ada panduan untuk "{query}"',
  'guides.category.noGuides': 'Tidak ada panduan di kategori ini',
  'guides.category.tryOtherTerms': 'Coba kata kunci lain.',
  'guides.category.comingSoon': 'Panduan baru akan segera ditambahkan.',
  'guides.category.completed': 'Selesai',
  'settings.profile.title': 'Profil Pengguna',
  'settings.profile.name': 'Nama',
  'settings.profile.email': 'Email',
  'settings.profile.verification': 'Verifikasi',
  'settings.profile.accountId': 'ID Akun',
  'settings.profile.environment': 'Lingkungan',
  'settings.profile.unspecified': 'Tidak ditentukan',
  'settings.profile.verified': 'Terverifikasi',
  'settings.profile.pending': 'Menunggu',
  'settings.profile.sendVerification': 'Kirim email verifikasi',
  'settings.profile.legalCenter': 'Pusat hukum',
  'settings.travel.title': 'Akses Perjalanan',
  'settings.travel.description':
    'Otorisasi sementara komputer sekunder tanpa mengganti perangkat utama yang terhubung ke akun.',
  'settings.travel.destination': 'Tujuan token',
  'settings.travel.expiry': 'Masa berlaku kode',
  'settings.travel.temporaryAccess': 'Akses sementara',
  'settings.travel.streamLike': 'Alur terinspirasi platform streaming',
  'settings.travel.streamLikeDesc':
    'Kode dikirim ke email akun dan memberikan akses sementara di PC lain.',
  'settings.travel.sendToken': 'Kirim token ke email saya',
  'settings.travel.destinationPrefix': 'Tujuan: {value}',
  'settings.travel.expirationPrefix': 'Kedaluwarsa: {value}',
  'settings.travel.accessPrefix': 'Akses: {value}',
  'settings.travel.definedOnSend': 'Ditentukan saat pengiriman',
  'settings.plan.day': 'hari',
  'settings.plan.days': 'hari',
  'settings.typography.default': 'Default',
  'settings.typography.bindingsTitle': 'Binding berdasarkan mode terdeteksi',
  'settings.typography.useDefault': 'Gunakan default',
  'settings.integrations.blogger.description':
    'Penyimpanan/CDN untuk gambar dan penerbitan pos.',
  'settings.integrations.blogger.label': 'Label',
  'settings.integrations.blogger.labelPlaceholder': 'Blogger Utama',
  'settings.integrations.blogger.blogId': 'Blog ID',
  'settings.integrations.blogger.blogIdPlaceholder': 'ID Numerik',
  'settings.integrations.blogger.clientId': 'Client ID',
  'settings.integrations.blogger.clientIdPlaceholder': 'Google OAuth Client ID',
  'settings.integrations.blogger.clientSecret': 'Client Secret',
  'settings.integrations.blogger.clientSecretPlaceholder':
    'OAuth Client Secret',
  'settings.integrations.blogger.refreshToken': 'Refresh Token',
  'settings.integrations.blogger.refreshTokenPlaceholder': 'Refresh Token',
  'settings.integrations.blogger.defaultLabels': 'Label default',
  'settings.integrations.blogger.defaultLabelsPlaceholder':
    'manga, chapter, release',
  'settings.integrations.blogger.optimizer': 'Pengoptimal',
  'settings.integrations.blogger.optimizerCloudinary': 'Cloudinary Fetch',
  'settings.integrations.blogger.optimizerTemplate': 'Template URL',
  'settings.integrations.blogger.cloudName': 'Cloud Name',
  'settings.integrations.blogger.urlTemplate': 'Template URL',
  'settings.integrations.blogger.cloudNamePlaceholder': 'my-cloud-name',
  'settings.integrations.blogger.cloudinaryTransformation':
    'Transformasi Cloudinary',
  'settings.integrations.blogger.optimizerEnabled': 'Pengoptimal aktif',
  'settings.integrations.blogger.maxWidth': 'Lebar Maks',
  'settings.integrations.blogger.maxHeight': 'Tinggi Maks',
  'settings.integrations.blogger.testConnection': 'Tes koneksi',
  'settings.integrations.blogger.requestsPerDay': 'Permintaan/hari',
  'settings.integrations.blogger.requestsPerUser': 'Permintaan/pengguna',
  'settings.integrations.blogger.credentialsGuideTitle':
    'Cara mendapatkan kredensial',
  'settings.integrations.blogger.step1': 'Buka',
  'settings.integrations.blogger.step1Suffix': 'buat atau pilih proyek.',
  'settings.integrations.blogger.step2': 'Aktifkan',
  'settings.integrations.blogger.step2And': 'dan',
  'settings.integrations.blogger.step3': 'Buat',
  'settings.integrations.blogger.webApplication': 'Aplikasi web',
  'settings.integrations.blogger.step4': 'Tambahkan',
  'settings.integrations.blogger.step4Suffix': 'ke Redirect URI.',
  'settings.integrations.blogger.step5': 'Salin',
  'settings.integrations.blogger.step5And': 'dan',
  'settings.integrations.blogger.step6':
    'Konfigurasi layar persetujuan OAuth. Jika dalam mode Testing, tambahkan email Anda.',
  'settings.integrations.blogger.step7': 'Di',
  'settings.integrations.blogger.step7Suffix':
    'aktifkan kredensial Anda sendiri dan otorisasi scope Blogger + Drive.',
  'settings.integrations.blogger.step8': 'Lakukan',
  'settings.integrations.blogger.step8Suffix': 'dan salin',
  'settings.integrations.blogger.step9': 'Untuk Cloudinary, salin',
  'settings.integrations.blogger.step9Suffix':
    'dan konfigurasi transformasinya.',
  'settings.integrations.blogger.step10': 'Temukan',
  'settings.integrations.blogger.step10Suffix': 'melalui URL/API Blogger.',
  'settings.integrations.blogger.step11':
    'Simpan semuanya, tes koneksi, dan gunakan utilitas di dashboard.',
  'settings.integrations.blogger.googleQuotas': 'Kuota Google',
  'settings.integrations.blogger.oauthPlayground': 'OAuth Playground',
  'settings.integrations.blogger.cloudinaryFetch': 'Cloudinary Fetch',
  'settings.integrations.blogger.driveScopes': 'Scope Drive',
  'settings.integrations.blogger.driveScopesGuideTitle':
    'Scope Drive di OAuth Playground',
  'settings.integrations.blogger.minimumPractical': 'Minimum praktis:',
  'settings.integrations.blogger.driveScopesNote':
    'Periksa dokumentasi resmi Drive API v3 untuk scope tambahan.',
  'settings.integrations.imgur.title': 'Upload Imgur',
  'settings.integrations.imgur.description':
    'Upload anonim dengan rotasi Client ID dan pembatasan rate konservatif.',
  'settings.integrations.imgur.limitPerHour': 'Batas/jam',
  'settings.integrations.imgur.batchDelay': 'Delay batch (ms)',
  'settings.integrations.imgur.remaining': 'Tersisa',
  'settings.integrations.imgur.used': 'Terpakai: {used}/{limit}',
  'settings.integrations.imgur.reset': 'reset: {value}',
  'settings.integrations.imgur.clientIds': 'Client ID',
  'settings.integrations.imgur.noClientIds':
    'Belum ada Client ID dikonfigurasi.',
  'settings.integrations.imgur.clientIdPlaceholder': 'Imgur Client ID',
  'settings.integrations.imgur.quickGuideTitle': 'Panduan cepat Imgur',
  'settings.integrations.imgur.step1':
    'Buat aplikasi di dashboard developer Imgur dan salin',
  'settings.integrations.imgur.step2':
    'Tambahkan satu atau lebih Client ID. Aplikasi akan memilih secara acak.',
  'settings.integrations.imgur.step3': 'Upload anonim dengan',
  'settings.integrations.imgur.step3Suffix': 'Tanpa OAuth.',
  'settings.integrations.imgur.step4': 'Pembatas konservatif:',
  'settings.integrations.imgur.step4Suffix': 'untuk menghindari pemblokiran.',
  'settings.integrations.imgur.step5':
    'Upload berurutan sesuai delay yang dikonfigurasi.',
  'settings.integrations.imgur.step6':
    'Imgur tidak boleh dianggap sebagai CDN yang dijamin.',
  'settings.integrations.imgur.imageApi': 'Imgur Image API',
  'settings.integrations.imgur.uploading': 'Imgur Mengunggah',
  'common.add': 'Tambah',
  'common.label': 'Label',
  'common.original': 'Asli',
  'common.quality': 'Kualitas',
  'common.persistence': 'Persistensi',
  'common.secureStore': 'Penyimpanan aman',
  'common.browserFallback': 'Fallback browser',
  'common.notAvailableShort': '—',
  'common.loading': 'Memuat',
  'common.sending': 'Mengirim…',
  'common.single': 'Tunggal',
  'common.tile': 'Ubin',
  'common.grid': 'Grid',
  'common.smart': 'Cerdas',
  'common.multi': 'Multi',
  'blogger.title': 'Blogger CDN',
  'blogger.heroTitle': 'Publikasi dan hosting gambar di Blogger',
  'blogger.heroDescription':
    'Mode publikasi untuk pos dengan editor visual/HTML. Mode upload untuk menghasilkan URL yang dihosting.',
  'blogger.ready': 'Siap',
  'blogger.configureInSettings': 'Konfigurasi di Pengaturan',
  'blogger.publishTab': 'Publikasi',
  'blogger.uploadTab': 'Upload',
  'blogger.settings': 'Pengaturan',
  'blogger.missingConfigTitle': 'Konfigurasi belum lengkap',
  'blogger.missingConfigBody':
    'Simpan kredensial di Pengaturan sebelum menggunakan.',
  'blogger.post.title': 'Pos',
  'blogger.post.description': 'Judul, label, dan penerbitan.',
  'blogger.post.postTitle': 'Judul',
  'blogger.post.postTitlePlaceholder': 'Judul pos',
  'blogger.post.defaultLabels': 'Label default',
  'blogger.post.defaultLabelsPlaceholder': 'manga, chapter',
  'blogger.post.postLabels': 'Label pos',
  'blogger.post.postLabelsPlaceholder': 'review',
  'blogger.post.publishNow': 'Terbitkan sekarang',
  'blogger.post.draft': 'Draf',
  'blogger.post.publish': 'Terbitkan',
  'blogger.post.status.draft': 'disimpan sebagai draf',
  'blogger.post.status.published': 'diterbitkan',
  'blogger.template.title': 'Pos Blogger baru',
  'blogger.template.description':
    'Tulis konten pos di sini. Anda bisa beralih antara visual, HTML, dan pratinjau.',
  'blogger.template.insertPrefix': 'Gunakan tombol',
  'blogger.template.insertSuffix':
    'untuk mengunggah file ke Blogger dan menyisipkan URL yang dihosting ke dalam konten.',
  'blogger.editor.title': 'Editor',
  'blogger.editor.description': 'Visual, HTML, dan pratinjau.',
  'blogger.editor.visual': 'Visual',
  'blogger.editor.preview': 'Pratinjau',
  'blogger.editor.h1': 'H1',
  'blogger.editor.h2': 'H2',
  'blogger.editor.bold': 'Tebal',
  'blogger.editor.italic': 'Miring',
  'blogger.editor.underline': 'Garis Bawah',
  'blogger.editor.list': 'Daftar',
  'blogger.editor.numbered': 'Bernomor',
  'blogger.editor.quote': 'Kutipan',
  'blogger.editor.link': 'Tautan',
  'blogger.editor.promptUrl': 'URL',
  'blogger.editor.insertImages': 'Sisipkan gambar',
  'blogger.copied': 'Disalin',
  'blogger.loadConfigFailed': 'Gagal memuat konfigurasi Blogger.',
  'blogger.imageInsertedSingle':
    'Gambar dihosting di Blogger dan disisipkan ke editor.',
  'blogger.imageInsertedMany':
    '{count} gambar dihosting di Blogger dan disisipkan ke editor.',
  'blogger.uploadFailed': 'Gagal mengunggah gambar ke Blogger.',
  'blogger.batchUploadSingle': 'Upload selesai dalam satu pos draf Blogger.',
  'blogger.batchUploadMany':
    '{count} gambar diunggah dalam satu pos draf Blogger.',
  'blogger.uploadFailedShort': 'Upload gagal.',
  'blogger.batchUploadSuccessSingle':
    'Upload selesai dalam satu pos draf Blogger.',
  'blogger.batchUploadSuccessMany':
    '{count} gambar diunggah dalam satu pos draf Blogger.',
  'blogger.publishSuccessWithUrl': 'Pos {verb} di Blogger. URL: {url}',
  'blogger.publishSuccessWithId': 'Pos {verb} di Blogger dengan ID {id}.',
  'blogger.publishFailed': 'Gagal menerbitkan di Blogger.',
  'blogger.uploadSection.title': 'Upload batch',
  'blogger.uploadSection.description':
    'Letakkan gambar untuk menghasilkan URL yang dihosting.',
  'blogger.uploadSection.dropTitle': 'Letakkan gambar di sini',
  'blogger.uploadSection.dropDescription':
    'PNG, JPG, WebP dengan pra-pemrosesan lokal.',
  'blogger.uploadSection.optimizedUrl': 'URL Teroptimasi',
  'blogger.uploadSection.optimizedUrlDesc':
    'Menghasilkan URL teroptimasi sebelum mengunggah.',
  'blogger.uploadSection.exportOptimized': 'Ekspor teroptimasi',
  'blogger.uploadSection.exportOptimizedDesc':
    'Menggunakan URL teroptimasi pada tindakan batch.',
  'blogger.uploadSection.outputImg': 'Output <img>',
  'blogger.uploadSection.outputImgDesc': 'Snippet HTML alih-alih URL.',
  'blogger.uploadSection.select': 'Pilih',
  'blogger.uploadSection.send': 'Kirim',
  'blogger.uploadSection.exported': 'Diekspor',
  'blogger.queue.title': 'Antrean',
  'blogger.queue.items': '{count} item',
  'blogger.queue.empty': 'Tidak ada file.',
  'blogger.queue.altText': 'Teks alt',
  'blogger.queue.canonical': 'Kanonikal',
  'blogger.queue.optimized': 'Teroptimasi',
  'blogger.queue.url': 'URL',
  'blogger.queue.opt': 'Opt',
  'blogger.queue.img': 'img',
  'common.remove': 'Hapus',
  'ranking.backToDashboard': 'Kembali ke Dashboard',
  'ranking.hero.title': 'Peringkat Model',
  'ranking.hero.subtitle':
    'Bandingkan model resmi dengan ulasan nyata dari komunitas — kualitas, kecepatan, efektivitas biaya, dan kemudahan penggunaan.',
  'ranking.hero.globalStatsAria': 'Statistik global',
  'ranking.hero.models': 'Model',
  'ranking.hero.reviews': 'Ulasan',
  'ranking.hero.bestOverall': 'Terbaik keseluruhan',
  'ranking.hero.costBenefit': 'Hemat biaya',
  'ranking.loading': 'Memperbarui peringkat…',
  'legalHub.back': 'Kembali',
  'legalHub.sidebarTitle': 'Pusat hukum',
  'legalHub.supportDescription':
    'Dukungan, privasi, dan permintaan subjek data harus menggunakan saluran resmi yang tercantum di aplikasi/situs web.',
  'legalHub.supportCta': 'Buka saluran dukungan',
  'legalHub.noticeTitle': 'Pemberitahuan penting.',
  'dashboard.dashboardExecute.selectImage': 'Pilih gambar untuk dieksekusi.',
  'dashboard.dashboardExecute.runCurrentStage':
    'Jalankan tahap saat ini untuk gambar.',
  'dashboard.dashboardExecute.rerunStage': 'Jalankan Ulang Tahap',
  'dashboard.dashboardExecute.runStage': 'Jalankan Tahap',
  'dashboard.dashboardExecute.runAio': 'Jalankan AIO',
  'dashboard.dashboardExecute.stop': 'Hentikan eksekusi',
  'freeProviderCard.stage.translation': 'Terjemahan',
  'freeProviderCard.stage.ocr': 'OCR',
  'freeProviderCard.stage.clean': 'सफाई',
  'freeProviderCard.badge.integrated': 'Terintegrasi',
  'freeProviderCard.badge.catalog': 'Katalog',
  'freeProviderCard.verifiedAt': 'diverifikasi pada',
  'freeProviderCard.tooltip.selectedModel': 'Model yang dipilih',
  'freeProviderCard.tooltip.notSelected': '(belum dipilih)',
  'freeProviderCard.tooltip.notDefined': '(belum ditentukan)',
  'freeProviderCard.tooltip.apiKeyConfigured': 'Dikonfigurasi',
  'freeProviderCard.tooltip.apiKeyRequired': 'Diperlukan (tertunda)',
  'freeProviderCard.tooltip.apiKeyOptional': 'Opsional (kosong)',
  'freeProviderCard.tooltip.extraFields': 'Field tambahan',
  'freeProviderCard.tooltip.modelsInStage': 'Model dalam tahap ini',
  'freeProviderCard.tooltip.empty': '(kosong)',
  'freeProviderCard.label.model': 'Model',
  'freeProviderCard.label.apiBase': 'API Base',
  'freeProviderCard.label.apiKey': 'API Key',
  'freeProviderCard.label.required': '(wajib)',
  'freeProviderCard.label.optional': '(opsional)',
  'freeProviderCard.placeholder.apiKey': 'Tempel kunci Anda di sini',
  'freeProviderCard.status.activeProfile': 'Profil aktif:',
  'freeProviderCard.status.catalogOnlyWarning':
    'Penyedia ini hanya katalog di v1.',
  'freeProviderCard.action.save': 'Simpan',
  'freeProviderCard.action.use': 'Gunakan',
  'customProvider.field.name': 'Nama',
  'customProvider.field.model': 'Model',
  'customProvider.field.apiBase': 'API Base',
  'customProvider.field.apiKey': 'API Key',
  'customProvider.placeholder.noKey': '(tanpa kunci)',
  'customProvider.placeholder.pasteKey': 'Tempel kunci Anda di sini',
  'customProvider.status.active': 'Profil aktif dalam pipeline',
  'customProvider.action.cancel': 'Batal',
  'customProvider.action.saving': 'Menyimpan...',
  'customProvider.action.save': 'Simpan',
  'customProvider.action.edit': 'Edit',
  'customProvider.action.delete': 'Hapus',
  'customProvider.badge.customProfile': 'Profil Kustom',
  'freeProviderCard.status.integrated': 'Terintegrasi',
  'freeProviderCard.status.catalog': 'Katalog',
  'freeProviderCard.status.verifiedAt': 'diverifikasi pada',
  'freeProviderCard.info.label': 'Info',
  'freeProviderCard.info.tooltip': 'Info {name}',
  'freeProviderCard.info.selectedModel': 'Model yang dipilih:',
  'freeProviderCard.info.notSelected': '(belum dipilih)',
  'freeProviderCard.info.modelId': 'ID Model:',
  'freeProviderCard.info.notDefined': '(belum ditentukan)',
  'freeProviderCard.info.apiBase': 'API Base:',
  'freeProviderCard.info.apiKey': 'API Key:',
  'freeProviderCard.info.configured': 'Dikonfigurasi',
  'freeProviderCard.info.required': 'Diperlukan (tertunda)',
  'freeProviderCard.info.optional': 'Opsional (kosong)',
  'freeProviderCard.info.extraFields': 'Field tambahan:',
  'freeProviderCard.info.setup': 'Pengaturan:',
  'freeProviderCard.info.limits': 'Batas:',
  'freeProviderCard.info.rateLimits': 'Batas Rate:',
  'freeProviderCard.info.modelsInStage': 'Model dalam tahap ini:',
  'freeProviderCard.field.model': 'Model',
  'freeProviderCard.field.apiBase': 'API Base',
  'freeProviderCard.field.apiBaseTitle':
    'API Base tetap untuk penyedia ini di v1',
  'freeProviderCard.field.required': '(wajib)',
  'freeProviderCard.field.optional': '(opsional)',
  'freeProviderCard.field.apiKeyPlaceholder': 'Tempel kunci Anda di sini',
  'freeProviderCard.status.catalogOnly': 'Penyedia ini hanya katalog di v1.',
  'freeProviderCard.actions.save': 'Simpan',
  'freeProviderCard.actions.use': 'Gunakan',
  'freeProviderCard.empty': '(kosong)',
  'customProvider.action.use': 'Gunakan',
  'typo.tag': 'Tipografer',
  'typo.session.title': 'Sesi',
  'typo.session.image': 'Gambar:',
  'typo.session.selection': 'Seleksi:',
  'typo.session.none': 'tidak ada',
  'typo.tools.aria': 'Alat bentuk',
  'typo.tools.select': 'Pilih',
  'typo.tools.rect': 'Persegi Panjang',
  'typo.tools.ellipse': 'Elips',
  'typo.actions.refine': 'Perhalus',
  'typo.actions.toRect': '→ Persegi Panjang',
  'typo.actions.toEllipse': '→ Elips',
  'typo.actions.duplicate': 'Duplikat',
  'typo.actions.delete': 'Hapus seleksi',
  'typo.presets.title': 'Preset',
  'typo.presets.active': 'Preset aktif',
  'typo.presets.none': 'Tanpa preset',
  'typo.presets.applySelection': '→ Seleksi',
  'typo.presets.applyImage': '→ Gambar',
  'typo.snapshots.title': 'Snapshot',
  'typo.snapshots.hint': 'Simpan kondisi saat ini untuk dipulihkan nanti.',
  'typo.snapshots.placeholder': 'Nama snapshot',
  'typo.snapshots.save': 'Simpan snapshot',
  'typo.snapshots.select': 'Pilih…',
  'typo.snapshots.restore': 'Pulihkan',
  'typo.queue.title': 'Antrean Teks',
  'typo.queue.editorPlaceholder': 'Tempel baris teks, satu per balon…',
  'typo.queue.editorAria': 'Editor teks antrean',
  'typo.queue.build': 'Buat antrean',
  'typo.queue.import': 'Impor',
  'typo.queue.applySelected': 'Terapkan item',
  'typo.queue.next': 'Berikutnya',
  'typo.queue.clear': 'Bersihkan',
  'typo.queue.multiBubble': 'Multi-balon',
  'typo.queue.listAria': 'Antrean tipografi',
  'typo.queue.emptyTitle': 'Antrean kosong',
  'typo.queue.emptyDesc': 'Satu baris per balon untuk membangun urutan.',
  'typo.queue.statusApplied': 'Diterapkan',
  'typo.queue.statusSkipped': 'Dilewati',
  'typo.queue.statusPending': 'Menunggu',
  'modelDetail.empty':
    'Pilih model di papan peringkat untuk melihat detail dan ulasan.',
  'modelDetail.source.local': 'Lokal',
  'modelDetail.source.cloud': 'Cloud',
  'modelDetail.score.aria': 'Skor keseluruhan: {score}',
  'modelDetail.score.label': 'Skor',
  'modelDetail.reviews.count_one': '{count} ulasan',
  'modelDetail.reviews.count_other': '{count} ulasan',
  'modelDetail.trend.up': '+{trend} poin (30h)',
  'modelDetail.trend.down': '{trend} poin (30h)',
  'modelDetail.trend.neutral': 'Tren netral',
  'modelDetail.metrics.quality': 'Kualitas',
  'modelDetail.metrics.speed': 'Kecepatan',
  'modelDetail.metrics.costBenefit': 'Efektivitas Biaya',
  'modelDetail.metrics.easeOfUse': 'Kemudahan Penggunaan',
  'modelDetail.distro.title': 'Distribusi rating',
  'modelDetail.distro.lastReview': 'Ulasan terakhir: {date}',
  'modelDetail.info.title': 'Konteks teknis',
  'modelDetail.info.noNotes': 'Tidak ada catatan tambahan untuk model ini.',
  'modelDetail.info.source': 'Sumber',
  'modelDetail.info.target': 'Target',
  'modelDetail.actions.editReview': 'Edit ulasan',
  'modelDetail.actions.startReview': 'Ulas model',
  'modelDetail.actions.sending': 'Mengirim…',
  'modelDetail.actions.verifyEmail': 'Verifikasi email',
  'modelDetail.warning.verifyEmail':
    'Konfirmasi email Anda untuk menerbitkan atau mengedit ulasan.',
  'modelDetail.recentReviews.title': 'Ulasan terbaru',
  'modelDetail.recentReviews.loading': 'Memuat…',
  'modelDetail.recentReviews.empty': 'Model ini belum menerima ulasan publik.',
  'modelDetail.pagination.prev': 'Sebelumnya',
  'modelDetail.pagination.next': 'Berikutnya',
  'modelDetail.usage.balanced': 'Seimbang',
  'modelDetail.usage.quality_first': 'Kualitas',
  'modelDetail.usage.speed_first': 'Kecepatan',
  'modelDetail.usage.low_vram': 'VRAM Rendah',
  'modelDetail.usage.offline_local': 'Lokal',
  'modelDetail.usage.cloud_pipeline': 'Cloud',
  'resources.empty.title.withQuery': 'Tidak ada hasil untuk "{query}"',
  'resources.empty.title.noQuery': 'Tidak ada item ditemukan',
  'resources.empty.desc.withQuery':
    'Coba kata lain atau hapus filter untuk menemukan {context}.',
  'resources.empty.desc.noQuery':
    'Sesuaikan filter untuk melihat {context} yang tersedia.',
  'resources.fonts.license.free': 'Gratis',
  'resources.fonts.license.openSource': 'Sumber Terbuka',
  'resources.fonts.license.commercial': 'Komersial',
  'resources.fonts.license.mixed': 'Campuran',
  'resources.fonts.context': 'font',
  'resources.fonts.placeholder': 'Ketik teks untuk pratinjau pada font...',
  'resources.fonts.results_one': 'font ditemukan',
  'resources.fonts.results_other': 'font ditemukan',
  'resources.fonts.previewFallback': 'Tidak bisa dipercaya!',
  'resources.fonts.sizeAria': 'Pratinjau pada {size}px',
  'resources.sfx.category.impact': 'Dampak',
  'resources.sfx.category.emotion': 'Emosi',
  'resources.sfx.category.ambient': 'Ambien',
  'resources.sfx.category.action': 'Aksi',
  'resources.sfx.category.voice': 'Suara',
  'resources.sfx.category.misc': 'Lainnya',
  'resources.sfx.filterAria': 'Filter berdasarkan kategori',
  'resources.sfx.filterAll': 'Semua ({count})',
  'resources.sfx.results_one': 'efek suara',
  'resources.sfx.results_other': 'efek suara',
  'resources.sfx.context': 'efek suara',
  'resources.sfx.copyAria': 'Salin "{text}"',
  'resources.communities.platform.forum': 'Forum',
  'resources.communities.results_one': 'komunitas',
  'resources.communities.results_other': 'komunitas',
  'resources.communities.context': 'komunitas',
  'resources.communities.visitAria': 'Kunjungi {name} di browser eksternal',
  'resources.communities.visit': 'Kunjungi',
  'resources.tools.category.editing': 'Penyuntingan',
  'resources.tools.category.ocr': 'OCR',
  'resources.tools.category.translation': 'Terjemahan',
  'resources.tools.category.fonts': 'Font',
  'resources.tools.category.hosting': 'Hosting',
  'resources.tools.category.utility': 'Utilitas',
  'resources.tools.filterAll': 'Semua',
  'resources.tools.results_one': 'alat',
  'resources.tools.results_other': 'alat',
  'resources.tools.context': 'alat',
  'resources.tools.free.yes': 'Gratis',
  'resources.tools.free.no': 'Berbayar',
  'resources.tools.action.open': 'Buka',
  'resources.tools.action.download': 'Unduh',
  'feed.roles.raw': 'Penyedia Raw',
  'feed.roles.cl': 'Cleaner',
  'feed.roles.rd': 'Redrawer',
  'feed.roles.tl': 'Penerjemah',
  'feed.roles.pr': 'Proofreader',
  'feed.roles.ts': 'Typesetter',
  'feed.roles.qc': 'Quality Checker',
  'feed.contact.discord': 'Discord',
  'feed.contact.twitter_x': 'Twitter/X',
  'feed.contact.telegram': 'Telegram',
  'feed.contact.email': 'Email',
  'feed.contact.whatsapp': 'WhatsApp',
  'feed.contact.instagram': 'Instagram',
  'feed.contact.placeholder.discord': 'https://discord.gg/... atau username',
  'feed.contact.placeholder.twitter_x': 'username atau https://x.com/username',
  'feed.contact.placeholder.telegram': 'https://t.me/... atau @channel',
  'feed.contact.placeholder.email': 'kontak@scanlation.com',
  'feed.contact.placeholder.whatsapp': '+62 812 3456-7890 atau tautan',
  'feed.contact.placeholder.instagram':
    'username atau https://instagram.com/username',
  'feed.weekdays.seg': 'Sen',
  'feed.weekdays.ter': 'Sel',
  'feed.weekdays.qua': 'Rab',
  'feed.weekdays.qui': 'Kam',
  'feed.weekdays.sex': 'Jum',
  'feed.weekdays.sab': 'Sab',
  'feed.weekdays.dom': 'Min',
  'feed.report.reasons.malicious_link': 'Tautan berbahaya',
  'feed.report.reasons.spam': 'Spam',
  'feed.report.reasons.impersonation': 'Penyamaran identitas',
  'feed.report.reasons.harassment': 'Pelecehan / penyalahgunaan',
  'feed.report.reasons.copyright': 'Pelanggaran hak cipta',
  'feed.report.reasons.other': 'Lainnya',
  'feed.modal.closeAria': 'Tutup modal',
  'feed.feedback.newApplication': 'Lamaran baru diterima di Scanlation Feed.',
  'feed.error.loadFailed': 'Gagal memuat Scanlation Feed.',
  'feed.hero.back': 'Kembali ke Dashboard',
  'feed.hero.title': 'Rekrutmen, Showcase & Moderasi',
  'feed.hero.subtitle':
    'Pasang lowongan, pamerkan karya, terima lamaran, dan laporkan konten mencurigakan.',
  'feed.tab.recruitment': 'Rekrutmen',
  'feed.tab.showcase': 'Showcase',
  'feed.tab.moderation': 'Moderasi',
  'feed.actions.createPost': 'Buat {type}',
  'feed.alert.safety':
    'Gunakan hanya media sosial dan kontak yang sah. Pos mencurigakan dapat dilaporkan.',
  'feed.alert.banPolicy':
    'Pos berbahaya dapat mengakibatkan larangan permanen per akun, perangkat, dan jaringan.',
  'feed.card.recruitmentRecent': 'Rekrutmen terbaru',
  'feed.card.showcaseRecent': 'Showcase terbaru',
  'feed.card.moderationQueue': 'Antrean moderasi',
  'feed.loading': 'Memuat feed…',
  'feed.empty.noRecruitment': 'Tidak ada pos rekrutmen ditemukan',
  'feed.empty.noShowcase': 'Tidak ada showcase ditemukan',
  'feed.empty.cleanQueue': 'Antrean bersih',
  'feed.empty.beFirst': 'Jadilah yang pertama memposting {type}!',
  'feed.empty.noModPosts': 'Tidak ada pos dalam antrean moderasi.',
  'feed.post.recruitLabel': 'Rekrut',
  'feed.post.showcaseLabel': 'Showcase',
  'feed.post.rolePayNegotiable': 'Dapat dinegosiasikan',
  'feed.post.rolePayVolunteer': 'Sukarelawan',
  'feed.post.actions.apply': 'Lamar',
  'feed.post.actions.report': 'Laporkan',
  'feed.post.actions.show': 'Tampilkan',
  'feed.post.actions.hide': 'Sembunyikan',
  'feed.post.actions.ban': 'Blokir',
  'feed.sidebar.profileTitle': 'Profil penulis',
  'feed.sidebar.rulesLabel':
    'Saya menerima aturan feed. Tautan berbahaya mengakibatkan larangan permanen.',
  'feed.sidebar.webhookLabel': 'Notifikasi webhook Discord',
  'feed.sidebar.saveProfile': 'Simpan profil',
  'feed.sidebar.inboxTitle': 'Kotak masuk internal',
  'feed.sidebar.yourApplications': 'Lamaran Anda',
  'feed.sidebar.noApplications': 'Belum ada lamaran dikirim.',
  'feed.sidebar.receivedTitle': 'Diterima',
  'feed.sidebar.noReceived': 'Belum ada lamaran diterima.',
  'feed.sidebar.reportsTitle': 'Laporan',
  'feed.sidebar.noReports': 'Tidak ada laporan tertunda.',
  'feed.sidebar.banTitle': 'Pemblokiran',
  'feed.sidebar.applyBan': 'Terapkan blokir',
  'feed.feedback.postPublishedRecruit': 'Rekrutmen diterbitkan.',
  'feed.feedback.postPublishedShowcase': 'Showcase diterbitkan.',
  'feed.feedback.reportSent': 'Laporan dikirim ke moderasi.',
  'feed.feedback.profileUpdated': 'Profil feed diperbarui.',
  'feed.feedback.applicationSent': 'Lamaran dikirim.',
  'feed.feedback.banApplied': 'Blokir diterapkan dan sesi dicabut.',
  'feed.feedback.reportUpdated': 'Laporan diperbarui.',
  'feed.feedback.postStatusUpdated': 'Pos diperbarui ke {status}.',
  'feed.moderation.notes.resolved': 'Ditinjau oleh moderasi.',
  'feed.moderation.notes.dismissed': 'Ditolak oleh moderasi.',
  'feed.moderation.banReasonPost': 'Pos dimoderasi: {title}',
  'feed.moderation.targetUserId': 'ID Pengguna Target',
  'feed.moderation.applyBan': 'Terapkan blokir',
  'feed.error.roleDuplicate': 'Anda sudah menambahkan {role}.',
  'feed.error.valuePositive': 'Nilai harus positif.',
  'feed.error.platformDuplicate': 'Sudah ditambahkan {platform}.',
  'feed.error.platformRequired': 'Harap berikan {platform}.',
  'feed.error.saveProfileFailed': 'Gagal menyimpan profil.',
  'feed.error.publishFailed': 'Gagal menerbitkan.',
  'feed.error.applyFailed': 'Gagal melamar.',
  'feed.error.reportFailed': 'Gagal melaporkan.',
  'feed.error.moderatePostFailed': 'Gagal memoderasi pos.',
  'feed.error.moderateReportFailed': 'Gagal memperbarui laporan.',
  'feed.error.banFailed': 'Gagal menerapkan blokir.',
  'feed.composer.typeRecruit': 'rekrutmen',
  'feed.composer.typeShowcase': 'showcase',
  'feed.composer.placeholder.titleRecruit': 'Contoh: Mencari penerjemah',
  'feed.composer.placeholder.titleShowcase': 'Contoh: Chapter baru tersedia',
  'feed.composer.placeholder.bodyRecruit':
    'Jelaskan proyek dan bagaimana kandidat bisa membantu...',
  'feed.composer.placeholder.bodyShowcase':
    'Deskripsikan rilis dan info yang relevan...',
  'feed.composer.placeholder.scanlationName': 'Nama scanlation',
  'feed.composer.placeholder.workTitle': 'Judul karya',
  'feed.composer.placeholder.chapterLabel': 'Ch. 42',
  'feed.composer.placeholder.genres': 'Aksi, Romansa, Fantasi',
  'feed.composer.placeholder.description': 'Deskripsikan rilis ini...',
  'feed.composer.sections.project': 'Proyek',
  'feed.composer.sections.work': 'Karya',
  'feed.composer.sections.recruitmentSettings': 'Pengaturan rekrutmen',
  'feed.composer.toggle.recruiting': 'Merekrut',
  'feed.composer.toggle.recruitingDesc':
    'Apakah scan Anda menerima anggota baru?',
  'feed.composer.toggle.paidWork': 'Pekerjaan Berbayar',
  'feed.composer.toggle.paidWorkDesc':
    'Apakah anggota akan menerima pembayaran?',
  'feed.composer.requirements.label': 'Persyaratan untuk kandidat:',
  'feed.composer.requirements.portfolio': 'Portofolio',
  'feed.composer.requirements.experience': 'Pengalaman',
  'feed.composer.requirements.availability': 'Ketersediaan',
  'feed.composer.requirements.contact': 'Kontak',
  'feed.composer.availability.minRequired':
    'Ketersediaan minimum yang diperlukan:',
  'feed.composer.availability.hoursPerWeek': 'Jam per minggu',
  'feed.composer.availability.daysOptional': 'Hari (opsional)',
  'feed.composer.availability.descriptionOptional': 'Deskripsi (opsional)',
  'feed.composer.availability.placeholder':
    'Saya membutuhkan seseorang yang bisa mengerjakan chapter setiap minggu...',
  'feed.composer.sections.roles': 'Peran',
  'feed.composer.sections.rolesSub': '(tambahkan yang Anda cari)',
  'feed.composer.roles.roleLabel': 'Peran',
  'feed.composer.roles.valueLabel': 'Nilai ($)',
  'feed.composer.roles.valueHint': '(per chapter)',
  'feed.composer.roles.add': 'Tambah',
  'feed.composer.roles.allAdded': 'Semua peran ditambahkan',
  'feed.composer.roles.addBtn': 'Tambah peran',
  'feed.composer.social.title': 'Media sosial',
  'feed.composer.social.sub': '(minimal satu)',
  'feed.composer.social.platform': 'Platform',
  'feed.composer.social.user': 'Pengguna',
  'feed.composer.social.url': 'URL/Tautan',
  'feed.composer.social.allAdded': 'Semua platform ditambahkan',
  'feed.composer.social.addBtn': 'Tambah media sosial',
  'feed.composer.sections.media': 'Media',
  'feed.composer.media.uploading': 'Mengirim...',
  'feed.composer.media.uploadBtn': 'Upload via Imgur',
  'feed.apply.title': 'Kirim lamaran',
  'feed.apply.message': 'Pesan',
  'feed.apply.messagePlaceholder':
    'Perkenalkan diri Anda dan jelaskan mengapa Anda ingin bergabung...',
  'feed.apply.preferredContact': 'Kontak yang disukai',
  'feed.apply.portfolio': 'Portofolio / tautan',
  'feed.apply.portfolioPlaceholder': 'Satu tautan per baris...',
  'feed.report.title': 'Laporkan pos',
  'feed.report.reason': 'Alasan',
  'feed.report.details': 'Detail',
  'feed.report.detailsPlaceholder': 'Deskripsikan masalahnya...',
  'feed.report.send': 'Kirim laporan',
  'freeProvider.manager.titleTranslation': 'Penyedia GRATIS (Terjemahan)',
  'freeProvider.manager.titleOcr': 'Penyedia GRATIS (OCR)',
  'auth.password.hide': 'Sembunyikan kata sandi',
  'auth.password.show': 'Tampilkan kata sandi',
  'modelManager.stage.cleanImage': 'Bersihkan Gambar',
  'modelManager.stage.detectText': 'Deteksi Teks',
  'modelManager.stage.recognizeText': 'Kenali Teks',
  'modelManager.stage.segmentText': 'Segmentasi Teks',
  'fillStylePopover.gradient': 'Gradien',
  'fillStylePopover.hint.gradient': 'Solid atau gradien dalam satu picker.',
  'fillStylePopover.hint.solid': 'Pilih warna solid.',
  'klSlider.resetValue': 'Reset nilai',
  'dashboard.aio.translation.llm.temperature': 'Temperature',
  'dashboard.aio.translation.llm.topP': 'Top P',
  'dashboard.aio.translation.llm.maxTokens': 'Max Token',
  'dashboard.enhance.modeTag': 'Peningkatan',
  'dashboard.enhance.scale.2x': '2×',
  'dashboard.enhance.scale.4x': '4×',
  'optimizer.hero.title': 'Pengoptimal Chapter',
  'optimizer.hero.desc':
    'Optimalkan halaman akhir untuk web, pembacaan, atau arsip.',
  'optimizer.hero.pages': 'Halaman',
  'optimizer.hero.savings': 'Penghematan',
  'optimizer.hero.saved': 'Disimpan',
  'optimizer.hero.output': 'Output',
  'optimizer.panel.presets': 'Preset',
  'optimizer.panel.output': 'Output',
  'optimizer.panel.dimensions': 'Dimensi',
  'optimizer.panel.filters': 'Filter',
  'optimizer.panel.preview': 'Pratinjau',
  'optimizer.presets.webLight': 'Web Ringan',
  'optimizer.presets.webLight.desc': 'Ringan untuk pemuatan cepat',
  'optimizer.presets.reading': 'Pembacaan',
  'optimizer.presets.reading.desc': 'Kualitas seimbang untuk pembaca',
  'optimizer.presets.archive': 'Arsip',
  'optimizer.presets.archive.desc': 'Lossless untuk pelestarian',
  'optimizer.presets.social': 'Sosial',
  'optimizer.presets.social.desc': 'Dioptimalkan untuk media sosial',
  'optimizer.presets.custom': 'Kustom',
  'optimizer.presets.custom.desc': 'Pengaturan Anda sendiri',
  'optimizer.config.format': 'Format',
  'optimizer.config.quality': 'Kualitas',
  'optimizer.config.resize': 'Ubah ukuran',
  'optimizer.config.trimBorders': 'Potong tepi',
  'optimizer.config.trimTolerance': 'Toleransi pemotongan',
  'optimizer.config.maxWidth': 'Lebar maks',
  'optimizer.config.maxHeight': 'Tinggi maks',
  'optimizer.config.sharpen': 'Tajamkan',
  'optimizer.config.sharpenStrength': 'Kekuatan ketajaman',
  'optimizer.config.grayscale': 'Skala abu-abu',
  'optimizer.config.autoLevels': 'Level otomatis',
  'optimizer.action.optimizing': 'Mengoptimalkan...',
  'optimizer.action.folder': 'Folder',
  'optimizer.preview.generating': 'Membuat pratinjau...',
  'optimizer.preview.before': 'Sebelum',
  'optimizer.preview.after': 'Sesudah',
  'optimizer.preview.reduction': 'Pengurangan',
  'optimizer.preview.dimensions': 'Dimensi',
  'optimizer.preview.compare': 'Bandingkan',
  'optimizer.preview.original': 'Asli',
  'optimizer.preview.optimized': 'Teroptimasi',
  'optimizer.preview.empty': 'Muat gambar untuk menggunakan pengoptimal.',
  'optimizer.results.title': 'Hasil',
  'optimizer.results.empty': 'Jalankan optimasi untuk melihat hasilnya.',
  'optimizer.results.download': 'Unduh file',
  'optimizer.error.worker': 'Worker tidak tersedia di Pengoptimal Chapter.',
  'optimizer.error.failed': 'Pengoptimal Chapter gagal.',
  'optimizer.error.preview': 'Pratinjau pengoptimal gagal.',
  'optimizer.config.brightness': 'Kecerahan',
  'optimizer.config.contrast': 'Kontras',
  'optimizer.config.noiseReduction': 'Pengurangan noise',
  'optimizer.config.noiseReductionStrength': 'Kekuatan pengurangan noise',
  'optimizer.config.rotation': 'Rotasi',
  'optimizer.config.rotationNone': 'Tidak ada',
  'optimizer.config.renamePattern': 'Pola penamaan ulang',
  'optimizer.config.renameHint':
    'Gunakan {name} untuk nama asli, {index} untuk nomor berurut, {ext} untuk ekstensi.',
  'optimizer.panel.advanced': 'Lanjutan',
  'optimizer.export.folderSuccess':
    'Pengoptimal Chapter mengekspor file ke folder yang dipilih.',
  'optimizer.export.zipSuccess': 'Paket Pengoptimal Chapter berhasil dibuat.',
  'resources.communities.platform.discord': 'Discord',
  'resources.communities.platform.reddit': 'Reddit',
  'resources.communities.platform.website': 'Situs Web',
  'resources.communities.platform.telegram': 'Telegram',
  'dashboard.cleaner.modeTag': 'Cleaner',
  'stitch.error.loadImage': 'Gagal memuat gambar.',
  'stitch.error.initCanvas': 'Gagal menginisialisasi kanvas Stitcher.',
  'stitch.error.initTempCanvas': 'Gagal menyiapkan gambar perantara Stitcher.',
  'stitch.error.generateBlob': 'Gagal membuat blob Stitcher.',
  'stitch.error.cancelled': 'Rendering dibatalkan.',
  'stitch.error.workerFailed': 'Gagal menjalankan worker Stitcher.',
  'stitch.error.generatePreview': 'Gagal membuat pratinjau Stitcher.',
  'stitch.error.exportBatch': 'Gagal mengekspor batch Stitcher.',
  'stitch.error.generateZip': 'Gagal membuat ZIP Stitcher.',
  'stitch.error.saveFolder': 'Gagal menyimpan batch ke folder.',
  'dashboard.footer.runtime.fallback.label': 'Fallback',
  'watermark.blend.normal': 'Normal',
  'watermark.blend.multiply': 'Multiply',
  'watermark.blend.screen': 'Screen',
  'watermark.blend.overlay': 'Overlay',
  'watermark.blend.softLight': 'Soft Light',
  'watermark.blend.hardLight': 'Hard Light',
  'watermark.blend.colorDodge': 'Color Dodge',
  'watermark.blend.colorBurn': 'Color Burn',
  'watermark.panel.shadow': 'Lapisan Bayangan',
  'watermark.shadow.enable': 'Aktifkan bayangan latar',
  'watermark.shadow.blur': 'Blur',
  'watermark.shadow.opacity': 'Opasitas',
  'watermark.shadow.color': 'Warna',
  'watermark.shadow.offsetY': 'Offset Y',
  'watermark.panel.textAvoidance': 'Penghindaran Teks',
  'watermark.textAvoidance.enable': 'Hindari area teks',
  'watermark.textAvoidance.desc':
    'Menggunakan deteksi teks AI untuk mencegah watermark menutupi teks pada gambar.',
  'watermark.textAvoidance.detecting': 'Mendeteksi...',
  'watermark.textAvoidance.detectCurrent': 'Deteksi Saat Ini',
  'watermark.textAvoidance.detectAll': 'Deteksi Semua',
  'watermark.textAvoidance.detected': '{{count}} area teks terdeteksi.',
  'watermark.textAvoidance.detectedAll':
    '{{count}} area teks terdeteksi di semua gambar.',
  'watermark.textAvoidance.failed': 'Deteksi teks gagal.',
  'watermark.textAvoidance.zonesFound': 'zona',
  'watermark.textAvoidance.showOverlay': 'Tampilkan zona',
  'watermark.text.shadowBlur': 'Blur bayangan',
  'watermark.text.shadowColor': 'Warna bayangan',
  'watermark.distribution.offsetX': 'Offset X',
  'watermark.distribution.offsetY': 'Offset Y',
  'watermark.distribution.density': 'Kepadatan',
  'dashboard.dock.tooltip.hoverHint': 'Tahan kursor untuk melihat pratinjau',
  'dashboard.dock.config.ariaLabel': 'Konfigurasi alat aktif',
  'dashboard.dock.config.closeTitle': 'Tutup konfigurasi',
  'dashboard.dock.config.closeAriaLabel': 'Tutup konfigurasi alat',
  'dashboard.dock.areaSelection.sectionTitle': 'Seleksi Area',
  'dashboard.dock.areaSelection.shapeLabel': 'Bentuk seleksi baru',
  'dashboard.dock.areaSelection.optionAuto': 'Otomatis',
  'dashboard.dock.areaSelection.optionSquare': 'Persegi Panjang',
  'dashboard.dock.areaSelection.optionRounded': 'Elips',
  'dashboard.dock.areaSelection.hintAuto': 'Deteksi otomatis: {kind}.',
  'dashboard.dock.areaSelection.hintFixed': 'Area baru dibuat sebagai {mode}.',
  'dashboard.dock.areaSelection.btnDuplicate': 'Duplikat',
  'dashboard.dock.areaSelection.btnToAuto': '→ Otomatis',
  'dashboard.dock.areaSelection.btnToSquare': '→ Persegi Panjang',
  'dashboard.dock.areaSelection.btnToRounded': '→ Elips',
  'dashboard.dock.segment.brushTitle': 'Kuas Segmen',
  'dashboard.dock.segment.eraserTitle': 'Penghapus Segmen',
  'dashboard.dock.segment.sizeLabel': 'Ukuran',
  'dashboard.dock.segment.hint':
    'Sesuaikan radius untuk mengedit area tersegmentasi.',
  'dashboard.dock.imageTool.paintTitle': 'Kuas',
  'dashboard.dock.imageTool.eraserTitle': 'Penghapus',
  'dashboard.dock.imageTool.healingTitle': 'Kuas Perbaikan',
  'dashboard.dock.imageTool.sizeLabel': 'Ukuran',
  'dashboard.dock.imageTool.opacityLabel': 'Opasitas',
  'dashboard.dock.imageTool.blurLabel': 'Blur',
  'dashboard.dock.imageTool.colorLabel': 'Warna',
  'dashboard.dock.imageTool.colorAriaLabel': 'Warna kuas',
  'dashboard.dock.magicWand.title': 'Tongkat Ajaib',
  'dashboard.dock.magicWand.toleranceLabel': 'Toleransi',
  'dashboard.dock.magicWand.healingBtnTitle':
    'Terapkan inpainting pada seleksi tongkat',
  'dashboard.dock.magicWand.healingBtnBusy': 'Menerapkan…',
  'dashboard.dock.magicWand.healingBtn': 'Perbaikan',
  'dashboard.dock.magicWand.clearBtn': 'Bersihkan',
  'dashboard.dock.imageTool.modelHint': 'Model: ',
  'dashboard.dock.palette.ariaLabel': 'Alat gambar manual',
  'dashboard.dock.config.closeLabel': 'Tutup konfigurasi',
  'dashboard.dock.config.openLabel': 'Buka konfigurasi',
  'dashboard.dock.config.badge': 'Konfigurasi',
  'dashboard.dock.config.description':
    'Membuka panel kontekstual alat aktif untuk menyesuaikan bentuk, ukuran, opasitas, toleransi, dan kontrol lainnya.',
  'dashboard.dock.config.disabledReason':
    'Aktifkan alat dengan parameter yang dapat diedit untuk membuka konfigurasi.',
  'dashboard.dock.divider.reg': 'Reg',
  'dashboard.dock.areaSelect.ariaLabel': 'Pilih area',
  'dashboard.dock.areaSelect.title': 'Pilih area',
  'dashboard.dock.areaSelect.description':
    'Buat, sesuaikan, dan perhalus area teks di pratinjau. Ideal untuk memperbaiki balon yang terdeteksi sebelum OCR, terjemahan, atau render.',
  'dashboard.dock.areaSelect.badge': 'Reg',
  'dashboard.dock.areaSelect.disabledReason':
    'Tersedia di tahap Deteksi dan Render pada AIO manual.',
  'dashboard.dock.clearPage.ariaLabel': 'Hapus semua area',
  'dashboard.dock.clearPage.title': 'Bersihkan halaman',
  'dashboard.dock.clearPage.description':
    'Menghapus semua area di halaman ini sekaligus agar Anda bisa memulai ulang penandaan manual tanpa sisa.',
  'dashboard.dock.clearPage.badge': 'Reset',
  'dashboard.dock.clearPage.disabledReason':
    'Harus berada di tahap Deteksi/Render dan sudah memiliki area yang dibuat pada gambar aktif.',
  'dashboard.dock.divider.seg': 'Seg',
  'dashboard.dock.segBrush.ariaLabel': 'Kuas area tersegmentasi',
  'dashboard.dock.segBrush.title': 'Kuas segmen',
  'dashboard.dock.segBrush.description':
    'Memperluas mask segmentasi untuk memulihkan huruf, garis tepi, atau bagian balon yang terlewat.',
  'dashboard.dock.segBrush.badge': 'Seg',
  'dashboard.dock.segBrush.disabledReason':
    'Tersedia selama tahap Segmentasi Teks.',
  'dashboard.dock.segEraser.ariaLabel': 'Penghapus area tersegmentasi',
  'dashboard.dock.segEraser.title': 'Penghapus segmen',
  'dashboard.dock.segEraser.description':
    'Memperhalus mask dengan menghapus seleksi berlebih, kebocoran, dan artefak yang tidak perlu disertakan dalam pembersihan.',
  'dashboard.dock.segEraser.badge': 'Seg',
  'dashboard.dock.segEraser.disabledReason':
    'Tersedia selama tahap Segmentasi Teks.',
  'dashboard.dock.divider.img': 'Img',
  'dashboard.dock.paint.ariaLabel': 'Kuas cat',
  'dashboard.dock.paint.title': 'Kuas',
  'dashboard.dock.paint.description':
    'Cat di atas artefak, perbaiki cacat, atau detail yang perlu koreksi mikro langsung pada gambar.',
  'dashboard.dock.paint.badge': 'Img',
  'dashboard.dock.paint.disabledReason':
    'Masuk ke mode manual dan pilih gambar aktif untuk diedit.',
  'dashboard.dock.paintEraser.ariaLabel': 'Penghapus cat',
  'dashboard.dock.paintEraser.title': 'Penghapus',
  'dashboard.dock.paintEraser.description':
    'Menghapus hanya lapisan cat manual untuk membatalkan perubahan tanpa kehilangan deteksi dan mask lainnya.',
  'dashboard.dock.paintEraser.badge': 'Img',
  'dashboard.dock.paintEraser.disabledReason':
    'Masuk ke mode manual dan pilih gambar aktif untuk diedit.',
  'dashboard.dock.wand.ariaLabel': 'Tongkat ajaib',
  'dashboard.dock.wand.title': 'Tongkat ajaib',
  'dashboard.dock.wand.description':
    'Memilih area berdekatan berdasarkan warna/toleransi secara cepat untuk perbaikan presisi atau penghapusan sisa.',
  'dashboard.dock.wand.badge': 'Img',
  'dashboard.dock.wand.disabledReason':
    'Masuk ke mode manual dan pilih gambar aktif untuk diedit.',
  'dashboard.dock.healing.ariaLabel': 'Kuas Perbaikan',
  'dashboard.dock.healing.title': 'Kuas Perbaikan',
  'dashboard.dock.healing.description':
    'Menerapkan inpainting lokal pada cacat, tepi rusak, dan sisa teks sambil menjaga tekstur sekitar lebih alami.',
  'dashboard.dock.healing.badge': 'Img',
  'dashboard.dock.healing.disabledReason':
    'Masuk ke mode manual dan pilih gambar aktif untuk diedit.',
  'dashboard.dock.clearPaint.ariaLabel': 'Hapus cat',
  'dashboard.dock.clearPaint.title': 'Hapus cat',
  'dashboard.dock.clearPaint.description':
    'Menghapus seluruh lapisan cat manual dari gambar aktif tanpa mereset koreksi lain atau riwayat tahap.',
  'dashboard.dock.clearPaint.badge': 'Reset',
  'dashboard.dock.clearPaint.disabledReason':
    'Hanya muncul ketika gambar aktif sudah memiliki cat manual yang diterapkan.',
  'dashboard.dock.resetEdits.ariaLabel': 'Reset semua editan',
  'dashboard.dock.resetEdits.title': 'Reset editan',
  'dashboard.dock.resetEdits.description':
    'Mengembalikan gambar aktif ke kondisi awal tahap manual, menghapus cat, perbaikan, seleksi tongkat, dan override lokal.',
  'dashboard.dock.resetEdits.badge': 'Reset',
  'dashboard.dock.resetEdits.disabledReason':
    'Tersedia ketika gambar aktif sudah menerima intervensi manual.',
  'modelManager.stage.automaticAiClean': 'Pembersihan AI Otomatis',
  'resources.fonts.downloadLabel': 'Unduh',
  'dashboard.sidebar.supportedFormats':
    'JPG, PNG, WEBP, ZIP, PDF, CBZ, CB7, PSD',
  'dashboard.cleaner.ocr.label': 'OCR',
  'dashboard.cleaner.ai.defaultProvider': 'Cloud / API / AI',
  'bugReport.screenshot.alt': 'Tangkapan layar',
  'pageTransition.loading.ariaLabel': 'Memuat',
  'watermark.text.placeholder': 'KŌMA Studio',
  'watermark.logo.alt': 'Logo',
  'dashboard.textDetection.regionActions.aria': 'Tindakan area',
  'dashboard.textDetection.manualModeRequired': 'Mode manual diperlukan',
  'dashboard.textDetection.removeRegion': 'Hapus area',
  'dashboard.renderText.rewind.title': 'Mundurkan gambar ini',
  'dashboard.renderText.forward.title': 'Majukan gambar ini',
  'dashboard.renderText.noHistory': 'Tidak ada riwayat AIO untuk gambar ini',
  'dashboard.renderText.editPlaceholder': 'Ketik teks akhir...',
  'dashboard.renderText.editAria': 'Edit teks yang dirender',
  'dashboard.renderText.removeSelection.title': 'Hapus seleksi',
  'dashboard.renderText.regionActions.aria': 'Tindakan area',
  'dashboard.pipeline.prevStep.title':
    'Kembali ke tahap pipeline AIO sebelumnya',
  'dashboard.pipeline.nextStep.title': 'Maju ke tahap pipeline AIO berikutnya',
  'dashboard.pipeline.runStep.title':
    'Jalankan hanya tahap saat ini untuk gambar yang dipilih',
  'dashboard.pipeline.skipStep.title':
    'Lewati tahap saat ini dan buka tahap berikutnya',
  'dashboard.typesetter.applyStyleAll.title':
    'Terapkan gaya seleksi saat ini ke semua area',
  'auth.error.internetRequired':
    'Akses internet diperlukan untuk masuk ke aplikasi.',
  'auth.error.mandatoryUpdate':
    'Pembaruan wajib tersedia. Perbarui aplikasi untuk melanjutkan.',
  'dashboard.textDetection.noTextRecognized': 'Tidak ada teks yang dikenali',
  'dashboard.textDetection.noTranslation': 'Tidak ada terjemahan tersedia',
  'dashboard.textDetection.noNt': 'Tidak ada TN tersedia',
  'dashboard.renderText.dblClickToEdit': 'klik dua kali untuk mengedit',
  'dashboard.renderText.renderNotApplied':
    'render belum diterapkan pada tahap ini',
  'dashboard.status.stageLabelTranslation': 'Terjemahan',
  'dashboard.status.profilesPersistedDesktopSecure':
    'Profil kustom disimpan di desktop dengan penyimpanan aman.',
  'dashboard.status.profilesPersistedDesktopLocal':
    'Profil kustom disimpan di desktop tanpa enkripsi native tersedia.',
  'dashboard.status.profilesPersistedBrowser':
    'Profil kustom disimpan di browser lokal perangkat ini.',
  'dashboard.status.aioScopeManual': 'AIO manual',
  'dashboard.status.aioScopeAuto': 'AIO otomatis',
  'dashboard.status.cleanerSelectProfileFirst':
    'Pilih profil visual tersimpan untuk digunakan dengan Pembersihan AI Otomatis.',
  'dashboard.status.cleanerProfileNotFound':
    'Profil visual tidak ditemukan. Muat ulang dan coba lagi.',
  'dashboard.status.cleanerProfileInUse':
    'Profil visual digunakan untuk Pembersihan AI Otomatis: {label}.',
  'dashboard.status.cleanerSelectValidModel':
    'Pilih model yang valid untuk Pembersihan AI Otomatis.',
  'dashboard.status.modelInRoadmap': 'Model "{name}" masih dalam roadmap.',
  'dashboard.status.modelNeedsConfig':
    'Model "{name}" memerlukan konfigurasi sebelum digunakan.',
  'dashboard.status.translatorSfxSelectValidModel':
    'Pilih model yang valid untuk AI SFX Penerjemah.',
  'dashboard.status.cleanerProfileSaved':
    'Profil visual disimpan dan dipilih untuk Pembersihan AI Otomatis: {label}.',
  'dashboard.status.cleanerSelectProfileToRemove':
    'Pilih profil visual tersimpan untuk dihapus.',
  'dashboard.status.customProfilePendingSync':
    'Profil kustom menunggu sinkronisasi lokal.',
  'dashboard.status.customProfileOcrPendingSync':
    'Profil OCR kustom menunggu sinkronisasi lokal.',
  'dashboard.status.presetAppliedToSelection':
    'Preset "{name}" diterapkan pada seleksi saat ini.',
  'dashboard.status.legacyPresetNotFound':
    'Preset visual lama {modeKey} tidak ditemukan.',
  'dashboard.status.presetAppliedShort':
    'Preset "{name}" diterapkan pada seleksi.',
  'dashboard.status.presetAppliedToImage':
    'Preset "{name}" diterapkan pada gambar aktif.',
  'dashboard.status.typographerSelectionDuplicated':
    'Seleksi diduplikasi di Typesetter.',
  'dashboard.status.autoShapeApplied': 'Bentuk otomatis diterapkan: {shape}.',
  'dashboard.status.renderStyleAppliedAll':
    'Gaya render diterapkan ke semua seleksi di semua gambar.',
  'dashboard.status.canvasInitFailed':
    'Gagal menginisialisasi kanvas komposisi manual.',
  'dashboard.status.cleanerCanvasInitFailed':
    'Gagal menginisialisasi kanvas komposisi manual Cleaner.',
  'dashboard.status.wandPrepFailed': 'Gagal menyiapkan tongkat ajaib.',
  'dashboard.status.wandSelectionUpdated':
    'Seleksi tongkat diperbarui. Gunakan Perbaikan untuk menerapkan inpainting.',
  'dashboard.status.wandNoArea':
    'Tongkat tidak menemukan area yang kompatibel untuk seleksi.',
  'dashboard.status.wandExecFailed': 'Gagal menjalankan tongkat ajaib.',
  'dashboard.status.cleanerWandPrepFailed':
    'Gagal menyiapkan tongkat ajaib Cleaner.',
  'dashboard.status.cleanerWandSelectionUpdated':
    'Seleksi tongkat Cleaner diperbarui. Gunakan Perbaikan untuk menerapkan inpainting.',
  'dashboard.status.cleanerWandNoArea':
    'Tongkat Cleaner tidak menemukan area yang kompatibel untuk seleksi.',
  'dashboard.status.cleanerWandExecFailed':
    'Gagal menjalankan tongkat ajaib Cleaner.',
  'dashboard.status.healingInvalidResponse':
    'Respons tidak valid saat menerapkan Kuas Perbaikan.',
  'dashboard.status.cleanerHealingInvalidResponse':
    'Respons tidak valid saat menerapkan Kuas Perbaikan di Cleaner.',
  'dashboard.status.cleanerHealingConnectFailed':
    'Kuas Perbaikan Cleaner gagal terhubung ke backend ({url}). Pastikan mini-backend aktif.',
  'dashboard.status.cleanerHealingFailed':
    'Gagal menerapkan Kuas Perbaikan di Cleaner.',
  'dashboard.status.wandNoSelectionForHealing':
    'Tidak ada seleksi tongkat untuk menerapkan perbaikan.',
  'dashboard.status.renderCanvasInitFailed':
    'Gagal menginisialisasi kanvas render.',
  'dashboard.status.aioCompleteAdjust':
    '{message} Sesuaikan secara manual jika diperlukan.',
  'dashboard.status.aioAborted': 'Proses AIO dibatalkan.',
  'dashboard.alert.importWorkspaceConfirm':
    'Mengimpor workspace ini akan menggantikan workspace yang ada di memori. Apakah Anda ingin melanjutkan?',
  'dashboard.alert.clearAutosaveConfirm':
    'Menghapus autosave lokal akan menghapus workspace terakhir yang disimpan di PC ini untuk pengguna ini. Lanjutkan?',
  'dashboard.alert.closeWorkspaceConfirm':
    'Tutup workspace saat ini? Ini akan menghapus semua gambar yang dimuat dan autosave lokal. Tindakan ini tidak dapat dibatalkan.',
  'dashboard.status.workspacePendingChanges':
    'Workspace memiliki perubahan tertunda.',
  'dashboard.status.toolSelectArea': 'Pilih Area',
  'dashboard.status.toolSegmentBrush': 'Kuas Segmen',
  'dashboard.status.toolSegmentEraser': 'Penghapus Segmen',
  'dashboard.alert.emailPendingTitle': 'Email menunggu konfirmasi',
  'dashboard.alert.emailPendingText':
    'Konfirmasi email Anda untuk melakukan tindakan pemrosesan.',
  'dashboard.status.typographerSession': 'Sesi Typesetter',
  'dashboard.status.cleanerMeta':
    'OCR: {ocrCount} • Tersegmentasi: {segmentedCount} • Dibersihkan: {cleaned}',
  'dashboard.status.metaOk': 'ok',
  'dashboard.status.metaPending': 'tertunda',
  'dashboard.status.cleanerRunFirst':
    'Jalankan Cleaner untuk menghasilkan OCR, segmentasi, dan gambar yang dibersihkan.',
  'dashboard.status.translatorMeta':
    'Deteksi: {detected} • OCR: {ocr} • Terjemahan: {translated}',
  'dashboard.status.translatorRunFirst':
    'Jalankan Penerjemah Visual untuk mendeteksi, mengenali, dan menerjemahkan.',
  'dashboard.status.localModelDownloadHint':
    'Model lokal diunduh sesuai kebutuhan; model cloud/API tetap menggunakan kunci.',
  'dashboard.status.selectionTextModeAria': 'Mode teks dari seleksi saat ini',
  'dashboard.status.translatorUsesAioModel':
    'Penerjemah menggunakan pilihan model yang sama dengan AIO; jalankan lagi setelah mengganti model.',
  'dashboard.status.translatorLocalModelIncompatible':
    'Model lokal saat ini tidak mendukung pasangan bahasa Penerjemah. Pilih model lain atau gunakan cloud.',
  'dashboard.status.stitchLastMoved':
    'Gambar terakhir dikirim ke batch berikutnya.',
  'dashboard.status.stitchFirstPulled':
    'Gambar pertama dari batch berikutnya ditambahkan ke batch saat ini.',
  'auth.error.generic': 'Error {status}',
  'auth.error.desktopBridgeUnavailable':
    'Jembatan autentikasi desktop tidak tersedia.',
  'dashboard.status.modeLabel': 'Mode',
  'dashboard.status.selectedLabel': 'Dipilih',
  'dashboard.status.selectBoxInPreview': 'Pilih kotak di pratinjau.',
  'dashboard.status.selectTranslatorModel':
    'Pilih model lokal atau cloud untuk menerjemahkan di Penerjemah.',
  'dashboard.error.loadHardwareFailed': 'Gagal memuat perangkat keras lokal.',
  'dashboard.error.healingBrushFailed': 'Kuas Perbaikan gagal: {message}',
  'dashboard.status.healingBrushApplyFailed':
    'Gagal menerapkan Kuas Perbaikan.',
  'dashboard.error.cleanerHealingBrushFailed':
    'Kuas Perbaikan Cleaner gagal: {message}',
  'dashboard.status.aioExecutionFailed': 'Gagal menjalankan AIO.',
  'dashboard.status.autosaveSaveFailed': 'Gagal menyimpan autosave lokal.',
  'dashboard.status.workspaceExportFailed': 'Gagal mengekspor workspace.',
  'dashboard.status.workspaceImportFailed': 'Gagal mengimpor workspace.',
  'dashboard.status.autosaveClearFailed': 'Gagal menghapus autosave lokal.',
  'dashboard.status.noModelSelected': 'Tidak ada model yang dipilih.',
  'dashboard.status.aiCleanModelSelected':
    'Model dipilih untuk Pembersihan AI Otomatis: {model}',
  'dashboard.status.selectionMode': 'Mode Seleksi',
  'dashboard.status.workspaceRestored': 'Workspace dipulihkan.',
  'dashboard.status.workspaceRestoredFromAutosave':
    'Workspace dipulihkan dari autosave lokal.',
  'dashboard.aio.skip': 'Lewati',
  'dashboard.aio.imageLabel': 'Gambar:',
  'dashboard.aio.stepLabel': 'Tahap:',
  'dashboard.aio.historyHint': 'Tahap: {label} ({current}/{total})',
  'dashboard.typo.fontsUpdating': 'Memperbarui…',
  'dashboard.typo.updateFonts': 'Perbarui Font',
  'dashboard.typo.importFontTitle': 'Impor font kustom',
  'dashboard.typo.desktopOnly': 'Hanya aplikasi desktop',
  'dashboard.typo.fontImporting': 'Mengimpor…',
  'dashboard.typo.importFont': 'Impor Font',
  'dashboard.typo.applyStyleToAll': 'Terapkan Gaya ke Semua',
  'dashboard.typo.fontControlsHint':
    'Kontrol font/warna/perataan ada di dock kontekstual overlay. Pintasan:',
  'dashboard.aio.languageLabel': 'Bahasa:',
  'shortcuts.category.global': 'Global',
  'shortcuts.category.modes': 'Mode',
  'shortcuts.category.typesetter': 'Typesetter',
  'shortcuts.noShortcut': 'Tidak ada pintasan',
  'shortcuts.openShortcutModal.label': 'Buka pusat pintasan',
  'shortcuts.openShortcutModal.description':
    'Membuka modal pintasan dan konfigurasi.',
  'shortcuts.toggleToolsPanel.label': 'Tampilkan/sembunyikan panel alat',
  'shortcuts.toggleToolsPanel.description': 'Mengubah visibilitas panel alat.',
  'shortcuts.rotateActiveImage.label': 'Putar gambar aktif',
  'shortcuts.rotateActiveImage.description':
    'Memutar gambar yang dipilih sebesar 90 derajat.',
  'shortcuts.workspaceSave.label': 'Simpan workspace lokal',
  'shortcuts.workspaceSave.description':
    'Memaksakan autosave lokal workspace saat ini.',
  'shortcuts.workspaceUndo.label': 'Urungkan workspace',
  'shortcuts.workspaceUndo.description':
    'Mengurungkan perubahan terakhir di workspace saat ini.',
  'shortcuts.workspaceRedo.label': 'Ulangi workspace',
  'shortcuts.workspaceRedo.description':
    'Mengulangi perubahan terakhir yang diurungkan di workspace saat ini.',
  'shortcuts.zoomIn.label': 'Perbesar',
  'shortcuts.zoomIn.description': 'Memperbesar tampilan tahap saat ini.',
  'shortcuts.zoomOut.label': 'Perkecil',
  'shortcuts.zoomOut.description': 'Memperkecil tampilan tahap saat ini.',
  'shortcuts.setViewPaginated.label': 'Tampilan halaman',
  'shortcuts.setViewPaginated.description': 'Beralih ke tampilan halaman.',
  'shortcuts.setViewLongStrip.label': 'Tampilan strip panjang',
  'shortcuts.setViewLongStrip.description':
    'Beralih ke tampilan strip panjang.',
  'shortcuts.setModeOrganize.label': 'Mode Atur',
  'shortcuts.setModeOrganize.description': 'Beralih ke mode Atur.',
  'shortcuts.setModeAio.label': 'Mode AIO',
  'shortcuts.setModeAio.description': 'Beralih ke mode AIO.',
  'shortcuts.setModeCleaner.label': 'Mode Cleaner / Redrawer',
  'shortcuts.setModeCleaner.description': 'Beralih ke mode Cleaner / Redrawer.',
  'shortcuts.setModeTypesetter.label': 'Mode Typesetter',
  'shortcuts.setModeTypesetter.description': 'Beralih ke mode Typesetter.',
  'shortcuts.setModeTranslator.label': 'Mode Penerjemah',
  'shortcuts.setModeTranslator.description': 'Beralih ke mode Penerjemah.',
  'shortcuts.setModeRaw.label': 'Mode Penyedia Raw',
  'shortcuts.setModeRaw.description': 'Beralih ke mode Penyedia Raw.',
  'shortcuts.setModeProofreader.label': 'Mode Proofreader / QC',
  'shortcuts.setModeProofreader.description':
    'Beralih ke mode Proofreader / QC.',
  'shortcuts.setModeStitch.label': 'Mode Gabung',
  'shortcuts.setModeStitch.description': 'Beralih ke mode Gabung.',
  'shortcuts.setModeSplit.label': 'Mode Potong Cerdas',
  'shortcuts.setModeSplit.description': 'Beralih ke mode Potong Cerdas.',
  'shortcuts.setModeWatermark.label': 'Mode Watermark',
  'shortcuts.setModeWatermark.description': 'Beralih ke mode Watermark.',
  'shortcuts.setModeEnhance.label': 'Mode Tingkatkan Gambar',
  'shortcuts.setModeEnhance.description': 'Beralih ke mode Tingkatkan Gambar.',
  'shortcuts.setModeGuides.label': 'Mode Panduan',
  'shortcuts.setModeGuides.description': 'Beralih ke mode Panduan.',
  'shortcuts.setModeResources.label': 'Mode Sumber Daya',
  'shortcuts.setModeResources.description': 'Beralih ke mode Sumber Daya.',
  'shortcuts.applyText.label': 'Terapkan teks',
  'shortcuts.applyText.description':
    'Menerapkan item antrean yang dipilih di Typesetter atau render manual AIO.',
  'shortcuts.nextRegion.label': 'Pilih area berikutnya',
  'shortcuts.nextRegion.description':
    'Memindahkan seleksi ke area berikutnya di Typesetter atau AIO manual.',
  'shortcuts.previousRegion.label': 'Pilih area sebelumnya',
  'shortcuts.previousRegion.description':
    'Memindahkan seleksi ke area sebelumnya di Typesetter atau AIO manual.',
  'shortcuts.toggleMultiBubble.label': 'Alihkan multi-balon',
  'shortcuts.toggleMultiBubble.description':
    'Mengalihkan pengelompokan multi-balon di Typesetter atau AIO manual.',
  'shortcuts.saveSnapshot.label': 'Simpan snapshot',
  'shortcuts.saveSnapshot.description':
    'Menyimpan snapshot sesi Typesetter atau AIO manual.',
  'shortcuts.detectShapes.label': 'Deteksi/perhalus bentuk',
  'shortcuts.detectShapes.description':
    'Menjalankan deteksi atau perhalus bentuk yang dipilih di Typesetter atau AIO manual.',
  'shortcuts.applyActivePreset.label': 'Terapkan preset aktif',
  'shortcuts.applyActivePreset.description':
    'Menerapkan preset tipografi aktif ke area yang dipilih.',
  'shortcuts.applyLegacyPresetTextBubble.label':
    'Terapkan preset Legacy text_bubble',
  'shortcuts.applyLegacyPresetTextBubble.description':
    'Menerapkan preset visual Legacy text_bubble ke area yang dipilih.',
  'shortcuts.applyLegacyPresetTextFree.label':
    'Terapkan preset Legacy text_free',
  'shortcuts.applyLegacyPresetTextFree.description':
    'Menerapkan preset visual Legacy text_free ke area yang dipilih.',
  'shortcuts.applyLegacyPresetTextSfx.label': 'Terapkan preset Legacy text_sfx',
  'shortcuts.applyLegacyPresetTextSfx.description':
    'Menerapkan preset visual Legacy text_sfx ke area yang dipilih.',
  'shortcuts.applyLegacyPresetTextNarration.label':
    'Terapkan preset Legacy text_narration',
  'shortcuts.applyLegacyPresetTextNarration.description':
    'Menerapkan preset visual Legacy text_narration ke area yang dipilih.',
  'shortcuts.applyLegacyPresetTextInsideBlackBubble.label':
    'Terapkan preset Legacy text_inside_black_bubble',
  'shortcuts.applyLegacyPresetTextInsideBlackBubble.description':
    'Menerapkan preset visual Legacy text_inside_black_bubble ke area yang dipilih.',
  'shortcuts.applyAutoShape.label': 'Terapkan bentuk otomatis',
  'shortcuts.applyAutoShape.description':
    'Secara otomatis memilih antara elips dan persegi panjang untuk area yang dipilih.',
  'shortcuts.convertShapeSquare.label': 'Ubah bentuk ke persegi panjang',
  'shortcuts.convertShapeSquare.description':
    'Mengubah area yang dipilih menjadi bentuk persegi panjang.',
  'shortcuts.convertShapeRounded.label': 'Ubah bentuk ke elips',
  'shortcuts.convertShapeRounded.description':
    'Mengubah area yang dipilih menjadi bentuk elips.',
  'shortcuts.deleteRegion.label': 'Hapus area yang dipilih',
  'shortcuts.deleteRegion.description':
    'Menghapus area yang dipilih di AIO manual, Typesetter, Penerjemah Visual, atau Cleaner.',
  'shortcuts.editInline.label': 'Buka pengeditan inline area',
  'shortcuts.editInline.description':
    'Membuka pengeditan inline untuk area yang dipilih dalam render manual.',
  'shortcuts.inlineEditorCancel.label': 'Batalkan pengeditan inline',
  'shortcuts.inlineEditorCancel.description':
    'Hanya tersedia di dalam textarea pengeditan inline.',
  'shortcuts.inlineEditorSave.label': 'Simpan pengeditan inline',
  'shortcuts.inlineEditorSave.description':
    'Hanya tersedia di dalam textarea pengeditan inline.',
  'shortcuts.category.palette': 'Palet Alat',
  'shortcuts.duplicateRegion.label': 'Duplikat area yang dipilih',
  'shortcuts.duplicateRegion.description':
    'Menduplikat area yang dipilih di Typesetter atau AIO manual dengan offset 18px.',
  'shortcuts.toolConfigToggle.label': 'Alihkan panel konfigurasi',
  'shortcuts.toolConfigToggle.description':
    'Membuka atau menutup panel konfigurasi alat aktif di palet.',
  'shortcuts.toolAreaSelect.label': 'Alat: Seleksi area',
  'shortcuts.toolAreaSelect.description':
    'Mengaktifkan alat seleksi area di AIO manual.',
  'shortcuts.toolClearRegions.label': 'Hapus semua area',
  'shortcuts.toolClearRegions.description':
    'Menghapus semua area dari gambar aktif di AIO manual.',
  'shortcuts.toolSegmentBrush.label': 'Alat: Kuas segmen',
  'shortcuts.toolSegmentBrush.description':
    'Mengaktifkan kuas untuk pengeditan mask segmentasi manual.',
  'shortcuts.toolSegmentEraser.label': 'Alat: Penghapus segmen',
  'shortcuts.toolSegmentEraser.description':
    'Mengaktifkan penghapus untuk pengeditan mask segmentasi manual.',
  'shortcuts.toolPaint.label': 'Alat: Cat',
  'shortcuts.toolPaint.description':
    'Mengaktifkan alat cat manual pada gambar.',
  'shortcuts.toolPaintEraser.label': 'Alat: Penghapus cat',
  'shortcuts.toolPaintEraser.description':
    'Mengaktifkan penghapus untuk menghapus lapisan cat manual.',
  'shortcuts.toolMagicWand.label': 'Alat: Tongkat ajaib',
  'shortcuts.toolMagicWand.description':
    'Mengaktifkan tongkat ajaib untuk seleksi berbasis toleransi warna.',
  'shortcuts.toolHealingBrush.label': 'Alat: Kuas perbaikan',
  'shortcuts.toolHealingBrush.description':
    'Mengaktifkan kuas perbaikan untuk restorasi gambar.',
  'shortcuts.toolClearPaint.label': 'Hapus lapisan cat',
  'shortcuts.toolClearPaint.description':
    'Menghapus seluruh lapisan cat manual dari gambar aktif.',
  'shortcuts.toolResetEdits.label': 'Reset editan manual',
  'shortcuts.toolResetEdits.description':
    'Mengurungkan semua editan manual pada gambar aktif di Cleaner atau AIO.',
  'dashboard.coachmark.stage.titleSuffix': 'tahap utama',
  'dashboard.coachmark.stage.bodyWithImages':
    'Di sini Anda melihat gambar aktif, memvalidasi hasil visual dari mode <strong>{modeLabel}</strong>, dan melakukan penyesuaian dengan umpan balik langsung.',
  'dashboard.coachmark.stage.bodyWithoutImages':
    'Saat Anda memuat gambar, tahap ini menjadi pusat visual dari mode <strong>{modeLabel}</strong>. Di sinilah hasilnya muncul pertama kali.',
  'dashboard.coachmark.stage.accent': 'Tahap',
  'dashboard.coachmark.tools.titleSuffix': 'kotak alat',
  'dashboard.coachmark.tools.body':
    'Gunakan sidebar kanan untuk mengonfigurasi opsi, preset, dan tindakan untuk mode <strong>{modeLabel}</strong>. Jika ada perubahan dalam alur kerja, biasanya dimulai dari sini.',
  'dashboard.coachmark.tools.accent': 'Alat',
  'dashboard.coachmark.download.titleSuffix': 'ekspor',
  'dashboard.coachmark.download.body':
    'Ketika hasilnya sudah benar, selesaikan melalui menu ekspor untuk mengunduh gambar, paket, atau PSD tanpa meninggalkan mode saat ini.',
  'dashboard.coachmark.download.accent': 'Pengiriman',
  'dashboard.coachmark.organize.uploadTitle': 'Atur: mulai dengan upload',
  'dashboard.coachmark.organize.uploadBody':
    'Seret halaman, chapter, atau paket lengkap ke sini. Mode Atur ada untuk menyiapkan batch sebelum masuk ke produksi.',
  'dashboard.coachmark.organize.uploadAccent': 'Input',
  'dashboard.coachmark.organize.orderTitle': 'Atur: tinjau urutan',
  'dashboard.coachmark.organize.orderBody':
    'Di sidebar kiri Anda memilih gambar aktif, menyusun ulang halaman, menghapus item buruk, dan memeriksa apakah chapter siap untuk dilanjutkan.',
  'dashboard.coachmark.organize.orderAccent': 'Batch',
  'dashboard.coachmark.aioAuto.pipelineTitle':
    'AIO Otomatis: biarkan pipeline berjalan',
  'dashboard.coachmark.aioAuto.pipelineBody':
    'Dalam mode otomatis, Anda mengonfigurasi sekali dan memproses batch secara berurutan. Ideal untuk throughput, tinjauan pasca, dan alur kerja yang lebih repetitif.',
  'dashboard.coachmark.aioAuto.pipelineAccent': 'Otomatis',
  'dashboard.coachmark.aioAuto.stagesTitle':
    'AIO Otomatis: aktifkan hanya yang Anda butuhkan',
  'dashboard.coachmark.aioAuto.stagesBody':
    'Aktifkan hanya tahap yang masuk akal untuk batch ini. Lebih sedikit tahap berarti lebih sedikit biaya, lebih sedikit waktu, dan lebih sedikit titik kegagalan.',
  'dashboard.coachmark.aioAuto.stagesAccent': 'Pipeline',
  'dashboard.coachmark.aioAuto.configTitle':
    'AIO Otomatis: atur model dan bahasa',
  'dashboard.coachmark.aioAuto.configBody':
    'Pilih bahasa, preset, dan model sebelum menjalankan. Ini adalah bagian yang paling memengaruhi kecepatan, kualitas, dan biaya pemrosesan.',
  'dashboard.coachmark.aioAuto.configAccent': 'Pengaturan',
  'dashboard.coachmark.aioManual.title':
    'AIO Manual: kerjakan tahap demi tahap',
  'dashboard.coachmark.aioManual.body':
    'Dalam mode manual, Anda menjalankan, meninjau, dan memperbaiki setiap tahap dengan kontrol lebih. Ini adalah mode ideal untuk finishing halus dan memulihkan kasus yang sulit.',
  'dashboard.coachmark.aioManual.accent': 'Manual',
  'dashboard.coachmark.aioManual.dockTitle':
    'AIO Manual: gunakan dock sebagai meja kerja Anda',
  'dashboard.coachmark.aioManual.dockBody':
    'Dock mengambang menggabungkan seleksi, segmentasi, cat, tongkat, dan perbaikan. Anggap sebagai panel intervensi cepat mini di atas pratinjau.',
  'dashboard.coachmark.aioManual.dockAccent': 'Dock',
  'dashboard.coachmark.typesetter.titleManual': 'Typesetter Manual',
  'dashboard.coachmark.typesetter.titleAuto': 'Typesetter Otomatis',
  'dashboard.coachmark.typesetter.bodyManual':
    'Manual paling baik untuk penyesuaian mikro pada balon, bentuk, font, dan ritme visual per halaman.',
  'dashboard.coachmark.typesetter.bodyAuto':
    'Otomatis mempercepat draf dan batch besar. Lanjutkan dengan tinjauan visual cepat untuk memastikan konsistensi.',
  'dashboard.coachmark.typesetter.accentManual': 'Manual',
  'dashboard.coachmark.typesetter.accentAuto': 'Otomatis',
  'dashboard.coachmark.cleaner.dockTitle':
    'Cleaner: koreksi lokal tanpa meninggalkan gambar',
  'dashboard.coachmark.cleaner.dockBody':
    'Saat dock terlihat, gunakan cat, penghapus, dan perbaikan untuk menyempurnakan detail tanpa kehilangan konteks halaman.',
  'dashboard.coachmark.cleaner.dockAccent': 'Dock',
  'dashboard.coachmark.content.titleSuffix': 'navigasi konten',
  'dashboard.coachmark.content.body':
    'Mode ini mengganti tahap visual dengan panel referensi. Gunakan untuk mempelajari alur kerja, meninjau materi pendukung, dan kembali ke produksi dengan lebih lancar.',
  'dashboard.coachmark.content.accent': 'Referensi',
  'dashboard.coachmark.progress': 'Panduan {{current}} / {{total}}',
  'dashboard.coachmark.next': 'Berikutnya',
  'dashboard.coachmark.prev': 'Sebelumnya',
  'dashboard.coachmark.done': 'Mengerti',
  'aioModel.label.unavailable': ' (tidak tersedia)',
  'aioModel.label.notInstalled': '(Belum terinstal — klik untuk menginstal)',
  'aioModel.label.updateAvailable': '(Pembaruan tersedia)',
  'aioModel.label.installed': '(Terinstal)',
  'aioModel.status.selectAndInstall':
    'Pilih dan instal model lokal untuk tahap "{stage}".',
  'aioModel.status.installBeforeUse':
    'Instal model "{name}" sebelum menggunakan tahap ini.',
  'aioModel.status.selectValidOcr': 'Pilih model yang valid untuk OCR.',
  'aioModel.status.inRoadmap': 'Model "{name}" masih dalam roadmap.',
  'aioModel.status.requiresConfig':
    'Model "{name}" memerlukan konfigurasi sebelum digunakan.',
  'aioModel.status.installedOk': 'terinstal (ok)',
  'aioModel.status.installedUpdate': 'terinstal (pembaruan tersedia)',
  'aioExec.selectAndInstallStage':
    'Pilih dan instal model lokal sebelum menjalankan tahap "{stageLabel}".',
  'aioExec.installBeforeStage':
    'Instal model "{name}" sebelum menjalankan tahap "{stageLabel}".',
  'aioExec.selectValidOcrModel': 'Pilih model yang valid untuk Kenali Teks.',
  'aioExec.ocrRequiresApiKey':
    'Penyedia OCR ini memerlukan API key. Konfigurasi kunci sebelum menjalankan.',
  'aioExec.installTranslationModel':
    'Instal model terjemahan yang kompatibel sebelum menjalankan AIO.',
  'aioExec.incompatibleLanguage':
    'Model yang dipilih tidak kompatibel dengan bahasa saat ini.',
  'aioExec.translationModelIncompatible':
    '"{modelName}" tidak mendukung bahasa target yang dipilih. Pilih model yang kompatibel atau ubah bahasa target.',
  'aioExec.selectValidTranslation':
    'Pilih model terjemahan yang valid untuk melanjutkan.',
  'aioExec.selectCustomOcrProfile':
    'Pilih atau simpan profil OCR Custom AI sebelum menjalankan AIO.',
  'aioExec.selectCustomAiProfile':
    'Pilih atau simpan profil Custom AI sebelum menjalankan AIO.',
  'aioExec.translationRequiresApiKey':
    'Penyedia terjemahan ini memerlukan API key. Konfigurasi kunci sebelum menjalankan.',
  'aioManual.selectImage': 'Pilih gambar untuk dijalankan dalam mode manual.',
  'aioManual.imageNotFound': 'Gambar aktif tidak ditemukan.',
  'aioManual.progressNotInitialized':
    'Progresi manual belum diinisialisasi untuk gambar aktif.',
  'aioManual.selectValidDetectModel':
    'Pilih model yang valid untuk Deteksi Teks.',
  'aioManual.selectValidSegmentModel':
    'Pilih model yang valid untuk Segmentasi Teks.',
  'aioManual.selectValidCleanModel':
    'Pilih model yang valid untuk Bersihkan Gambar.',
  'aioManual.stageDone':
    'Mode manual: tahap "{stageLabel}" selesai untuk "{fileName}".',
  'aioManual.executionAborted': 'Proses AIO manual dibatalkan.',
  'aioManual.stageFailed': 'Gagal menjalankan tahap "{stageLabel}".',
  'translator.localModelIncompatible':
    'Model lokal yang dipilih tidak kompatibel dengan bahasa Penerjemah saat ini.',
  'translator.selectValidTranslationModel':
    'Pilih model terjemahan yang valid untuk Penerjemah.',
  'translator.selectCustomAiTranslationProfile':
    'Pilih atau simpan profil terjemahan Custom AI sebelum menjalankan.',
  'translator.localOcrModelIncompatible':
    'Model OCR lokal yang dipilih tidak kompatibel dengan bahasa Penerjemah saat ini.',
  'translator.installCompatibleOcrModel':
    'Instal model OCR yang kompatibel sebelum menjalankan Penerjemah Visual.',
  'translator.selectValidOcrModel':
    'Pilih model OCR yang valid untuk Penerjemah Visual.',
  'modelManager.error.diskCheckFailed':
    'Tidak dapat memeriksa ruang disk yang tersedia.',
  'updater.mandatoryUpdate':
    'Pembaruan ini wajib. Unduh dan instal untuk melanjutkan.',
  'translatorVisual.noImages':
    'Muat setidaknya satu gambar untuk menggunakan Penerjemah Visual.',
  'translatorVisual.running.aiSfx':
    'Penerjemah Visual AI SFX: mendeteksi, mengklasifikasi, mengenali, menerjemahkan, dan membersihkan...',
  'translatorVisual.running.standard':
    'Penerjemah Visual: mendeteksi, mengenali, dan menerjemahkan...',
  'translatorVisual.invalidSfxResponse':
    'Respons AI SFX tidak valid dari Penerjemah untuk "{fileName}".',
  'translatorVisual.done.aiSfx':
    'Penerjemah Visual AI SFX selesai. {candidates} kandidat, {approved} SFX disetujui, {ocr} OCR, {translations} terjemahan, dan {redraw} area meminta redraw.',
  'translatorVisual.done.standard':
    'Penerjemah Visual selesai. {detected} area terdeteksi, {recognized} teks dikenali, {translations} terjemahan dihasilkan.',
  'translatorVisual.genericError': 'Gagal menjalankan Penerjemah Visual.',
  'freeProvider.catalogOnly':
    'Penyedia "{name}" tersedia sebagai katalog saja di v1.',
  'enhanceActions.connectError':
    'Peningkatan gagal terhubung ke backend ({url}). Pastikan mini-backend aktif.',
  'aioSingleProcessor.invalidCleanResponse':
    'Respons tidak valid saat membersihkan "{fileName}".',
  'cleanerActions.detectFailed':
    'Gagal mendeteksi area untuk "{fileName}": {message}',
  'cleanerActions.invalidSfxResponse':
    'Respons AI SFX Cleaner tidak valid untuk "{fileName}".',
  'cleanerActions.invalidAutoCleanResponse':
    'Respons Pembersihan AI Otomatis tidak valid untuk "{fileName}".',
  'cleanerActions.sfxDone':
    'AI SFX Cleaner selesai. {images} gambar, {candidates} kandidat, {approved} SFX disetujui, dan {redraw} area meminta redraw.',
  'cleanerActions.autoCleanDone':
    'Pembersihan AI Otomatis selesai. {images} gambar diproses dan {detected} area terdeteksi.',
  'cleanerActions.assistedDone':
    'Cleaner Terasistens selesai. {images} gambar dibersihkan, {detected} area terdeteksi, {recognized} teks dikenali, {segmented} area tersegmentasi.',
  'webhook.event.processStart.label': 'Pemrosesan dimulai',
  'webhook.event.processStart.desc': 'Saat proses dimulai',
  'webhook.event.processComplete.label': 'Pemrosesan selesai',
  'webhook.event.processComplete.desc': 'Saat proses selesai dengan sukses',
  'webhook.event.processError.label': 'Error pemrosesan',
  'webhook.event.processError.desc': 'Saat terjadi kegagalan',
  'webhook.event.updateAvailable.label': 'Pembaruan tersedia',
  'webhook.event.updateAvailable.desc': 'Saat versi baru tersedia',
  'webhook.event.updateDownloaded.label': 'Pembaruan terunduh',
  'webhook.event.updateDownloaded.desc': 'Saat unduhan pembaruan selesai',
  'webhook.event.updateError.label': 'Error pembaruan',
  'webhook.event.updateError.desc': 'Saat updater gagal',
  'webhook.validation.urlRequired': 'Masukkan URL webhook Discord.',
  'webhook.validation.urlInvalid': 'URL tidak valid. Periksa format webhook.',
  'webhook.validation.urlHttpsRequired': 'URL webhook harus menggunakan HTTPS.',
  'webhook.validation.urlNotDiscord':
    'Gunakan URL resmi Discord (discord.com).',
  'webhook.validation.urlInvalidPath':
    'Path URL tidak sesuai dengan webhook Discord yang valid.',
  'typography.effect.none.label': 'Tanpa efek',
  'typography.effect.none.description': 'Teks bersih, tanpa lapisan tambahan.',
  'typography.effect.balloon_smear.label': 'Balloon Smear',
  'typography.effect.balloon_smear.description':
    'Goresan abu-abu vertikal dengan sedikit goyangan lateral, terinspirasi dari teks ucapan dramatis.',
  'typography.effect.smiles_outline.label': 'SMILES Outline',
  'typography.effect.smiles_outline.description':
    'Garis luar koral lembut dengan inti terang, gaya bisikan manis.',
  'typography.effect.ahnnn_peach.label': 'Ahnnn Peach Glow',
  'typography.effect.ahnnn_peach.description':
    'Isian persik dengan cahaya hangat dan lembut.',
  'typography.effect.silence_ink.label': 'Silence Ink',
  'typography.effect.silence_ink.description':
    'Biru keunguan dengan kehadiran bersih dan sedikit kedalaman dalam.',
  'typography.effect.hwa_pastel.label': 'HWA Pastel',
  'typography.effect.hwa_pastel.description':
    'Kuning muda dengan garis luar merah muda dan nuansa lembut.',
  'typography.effect.hah_pop.label': 'HAH Pop',
  'typography.effect.hah_pop.description':
    'Inti lilac muda dengan kehadiran pop dan relief merah muda.',
  'typography.effect.smooch_jelly.label': 'Smooch Jelly',
  'typography.effect.smooch_jelly.description':
    'Merah muda lembut dengan kilau seperti jeli dan bayangan manis.',
  'typography.effect.tremble_brush.label': 'Tremble Brush',
  'typography.effect.tremble_brush.description':
    'Kuas biru-ungu energik dengan tepi tidak beraturan.',
  'typography.effect.eheheh_whisper.label': 'EHEHEH Whisper',
  'typography.effect.eheheh_whisper.description':
    'Merah muda muda dengan garis luar halus dan cahaya malu-malu.',
  'typography.effect.hoho_ink.label': 'HOHO Ink',
  'typography.effect.hoho_ink.description':
    'Biru tua dengan tetesan vertikal dan tekstur kering.',
  'typography.effect.blam_impact.label': 'BLAM Impact',
  'typography.effect.blam_impact.description':
    'Ledakan kuning dengan bayangan merah tergeser.',
  'typography.effect.badump_soft.label': 'BADUMP Soft',
  'typography.effect.badump_soft.description':
    'Gradien pastel merah muda lembut dengan aura romantis.',
  'typography.effect.thump_heavy.label': 'THUMP Heavy',
  'typography.effect.thump_heavy.description':
    'Dampak hitam dengan bayangan warna anggur keras bersudut.',
  'typography.effect.neon_woah.label': 'WOAH Neon',
  'typography.effect.neon_woah.description':
    'Teks putih dengan cahaya merah muda intens penuh kejutan/kemilau.',
  'typography.effect.slash_speed.label': 'SLAP Speed Slash',
  'typography.effect.slash_speed.description':
    'Tipografi gelap dengan goresan diagonal agresif/motion blur.',
  'typography.effect.ah_teal.label': 'Ah Teal',
  'typography.effect.ah_teal.description':
    'Aqua/teal dengan garis luar gelap dan nuansa ucapan lembut.',
  'typography.effect.drip_blue.label': 'DRIP Blue',
  'typography.effect.drip_blue.description':
    'Biru muda dengan nuansa cair dan efek tetesan.',
  'typography.effect.question_pop.label': 'Question Pop',
  'typography.effect.question_pop.description':
    'Tanda baca hangat dengan bayangan koral tergeser.',
  'typography.effect.laugh_curve.label': 'Laugh Curve',
  'typography.effect.laugh_curve.description':
    'Cyan cerah untuk tawa melengkung dan ringan.',
  'typography.effect.shake_blur.label': 'Shake Blur',
  'typography.effect.shake_blur.description':
    'Ungu tua dengan getaran/motion blur untuk efek gemetar.',
  'typography.effect.beep_outline.label': 'Beep Outline',
  'typography.effect.beep_outline.description':
    'Teks putih dengan garis luar hitam tebal untuk SFX yang bersih dan terbaca.',
  'typography.effect.boom_comic.label': 'BOOM Comic',
  'typography.effect.boom_comic.description':
    'Ledakan kuning/merah gaya komik klasik.',
  'typography.effect.bang_chunk.label': 'BANG Chunk',
  'typography.effect.bang_chunk.description':
    'Blok ungu/biru dengan bayangan emas tebal tergeser.',
  'typography.effect.break_glitch.label': 'BREAK Glitch',
  'typography.effect.break_glitch.description':
    'Magenta gelap dengan tekstur glitch/scan rusak.',
  'typography.effect.flinch_outline.label': 'FLINCH Outline',
  'typography.effect.flinch_outline.description':
    'Hitam dengan garis luar putih agresif untuk reaksi instan.',
  'typography.effect.growl_moss.label': 'Growl Moss',
  'typography.effect.growl_moss.description':
    'Hijau zaitun kering untuk suara serak/hewan.',
  'typography.effect.yawn_soft.label': 'Yawn Soft',
  'typography.effect.yawn_soft.description':
    'Hijau limau dengan garis luar ungu untuk ucapan malas/teregang.',
  'typography.effect.scratch_noise.label': 'Scratch Noise',
  'typography.effect.scratch_noise.description':
    'Hitam kasar dengan tampilan berpasir/berisik.',
  'typography.effect.crack_ink.label': 'Crack Ink',
  'typography.effect.crack_ink.description':
    'Kuas hitam kering dan tajam untuk dampak mendadak.',
  'typography.effect.slap_scratch.label': 'Slap Scratch',
  'typography.effect.slap_scratch.description':
    'Coretan tipis terseret untuk efek goresan/serangan cepat.',
  'typography.effect.dash_edge.label': 'Dash Edge',
  'typography.effect.dash_edge.description':
    'Hijau tua dengan ujung tajam untuk potongan/kemunculan mendadak.',
  'typography.effect.scream_scratch.label': 'Scream Scratch',
  'typography.effect.scream_scratch.description':
    'Teriakan hitam dengan offset merah kasar.',
  'model.opus-mt-ja-en.description':
    'Pipeline OPUS-MT yang dioptimalkan untuk konten Jepang, dengan terjemahan Inggris dan alur sekunder untuk Portugis.',
  'model.nllb-200-600m-int8.description':
    'Model NLLB multibahasa yang dikuantisasi ke int8 untuk mengurangi penggunaan memori dengan tetap menjaga kualitas baik untuk KO→EN/PT.',
  'model.opus-mt-zh-en.description':
    'Model OPUS-MT untuk Mandarin dengan terjemahan utama Inggris dan alur sekunder untuk Portugis.',
  'model.nllb-200-1.3b.description':
    'Model multibahasa berkualitas lebih tinggi untuk terjemahan umum dengan cakupan bahasa luas.',
  'model.nllb-200-1.3b-int8-ct2.description':
    'Versi CTranslate2 terkuantisasi dari NLLB 1.3B, mengurangi VRAM dengan efektivitas biaya sangat baik.',
  'model.nllb-200-3.3b.description':
    'Model NLLB berkapasitas tinggi untuk kualitas maksimal di berbagai bahasa.',
  'model.sugoi_v4_ja_en_ct2.description':
    'Penerjemah lokal Jepang→Inggris dengan CTranslate2 dan SentencePiece, kompatibel dengan alur offline BallonsTranslator.',
  'model.m2m100_1_2b_ct2.description':
    'Penerjemah multibahasa lokal via CTranslate2, dengan cakupan bahasa luas dan kompatibilitas dengan alur offline BallonsTranslator.',
  'model.font_rtdetr_v2.description':
    'Model lokal untuk deteksi area teks di pipeline AIO.',
  'model.comic_text_detector.description':
    'Detektor lokal berbasis modul CTD BallonsTranslator untuk kotak teks di halaman manga.',
  'model.manga_ocr.description': 'Model OCR lokal untuk bahasa Jepang di AIO.',
  'model.meiki_ocr.description':
    'OCR Jepang lokal yang dikhususkan untuk teks yang dirender, dengan model ONNX horizontal dan vertikal.',
  'model.paddleocr_vl_manga.description':
    'OCR VLM lokal yang dikhususkan untuk manga Jepang.',
  'model.got_ocr2.description':
    'OCR multimodal lokal via GOT-OCR 2.0 dengan runtime transformers native.',
  'model.qwen2_5_vl_3b.description':
    'OCR multimodal lokal via Qwen2.5-VL-3B-Instruct.',
  'model.mangalmm.description':
    'OCR/pemahaman multimodal yang dikhususkan untuk manga berbasis Qwen2.5-VL.',
  'model.rolmocr.description':
    'OCR lokal yang tangguh berbasis Qwen2.5-VL dengan optimasi untuk pembacaan dokumen.',
  'model.glm_ocr_onnx.description':
    'OCR GLM lokal yang fokus pada tata letak kompleks dengan runtime transformers native.',
  'model.paddleocr.description':
    'Model OCR lokal untuk bahasa Rusia/Slavik di pipeline AIO.',
  'model.paddleocr_latin_v5.description':
    'Model OCR lokal untuk bahasa Latin (termasuk Belanda) di pipeline AIO.',
  'model.paddleocr_ch_v5.description':
    'Model OCR lokal untuk bahasa Mandarin di pipeline AIO.',
  'model.paddleocr_en_v5.description':
    'Model OCR lokal yang fokus pada bahasa Inggris untuk pipeline AIO.',
  'model.easyocr.description':
    'OCR lokal multibahasa dengan instalasi sesuai kebutuhan di direktori model aplikasi.',
  'model.pororo.description':
    'Model OCR lokal untuk bahasa Korea di pipeline AIO.',
  'model.baka_content_cc.description':
    'Model lokal untuk segmentasi/perhalus area teks di AIO.',
  'model.aot.description':
    'Model inpainting lokal untuk pembersihan balon di AIO.',
  'model.lama_manga.description':
    'Model inpainting kontekstual lokal untuk area kompleks di AIO.',
  'model.opencv_lama.description':
    'Model inpainting lokal ringan via OpenCV Zoo, dirancang untuk CPU dan eksekusi cepat.',
  'model.lama_fp32.description':
    'Port ONNX yang direkomendasikan dari big-lama di 512x512, cocok untuk CPU/GPU saat menyeimbangkan kualitas dan kesederhanaan.',
  'model.vntl_llama3_8b_v2.description':
    'Fine-tune LLaMA3 untuk VN Jepang → Inggris. Dataset multi-baris yang dibangun ulang. Gunakan temp 0. (~5.7-8.5GB GGUF).',
  'model.lfm2_350m_enjp_mt.description':
    'Penerjemah dua arah JA↔EN ultra-ringan, 0.4B parameter. Q4_0 hanya 219MB — ideal untuk CPU dan perangkat edge.',
  'model.sakura_galtransl_7b_v3_7.description':
    'Penerjemah JA→ZH-CN yang dioptimalkan untuk visual novel. Mempertahankan linebreak, karakter kontrol, dan ruby. CC-BY-NC-SA 4.0 (~4.25GB IQ4_XS).',
  'model.sakura_1_5b_qwen2_5_v1_0.description':
    'Alternatif ringan untuk Sakura 7B dengan kuantisasi IMatrix. ~1GB Q5KS. Ideal untuk GPU menengah atau CPU (~4GB RAM).',
  'model.hunyuan_7b_mt_v1_0.description':
    'Penerjemah multibahasa Tencent — peringkat 1 WMT25. 33 bahasa dua arah. Prompt: "Translate into <target_language>." (~4.2GB Q4_K_M).',
  'model.pp_doclayout_v3.description':
    'Model deteksi tata letak dan teks lokal berbasis PP-DocLayout V3. Akurasi tinggi untuk analisis tata letak halaman.',
  'model.paddleocr_vl_1_5.description':
    'Model VLM OCR multibahasa berkualitas tinggi (PaddleOCR-VL 1.5). Hingga 128 token per blok teks.',
  'model.waifu2x_swin_unet_art_scan_2x.description':
    'Opsi lokal terbaik untuk halaman manga/manhwa yang fokus pada lineart dan balon.',
  'model.waifu2x_swin_unet_art_scan_4x.description':
    'Varian 4x untuk halaman manga/manhwa yang dipindai.',
  'model.waifu2x_swin_unet_art_2x.description':
    'Model 2x untuk seni digital/anime yang bersih.',
  'model.4xnomos2_hq_mosr.description':
    'Upscaler ONNX 4x berkualitas tinggi untuk materi yang sedikit terdegradasi.',
  'model.4xspankendata.description':
    'Model ONNX ringan sebagai fallback umum 4x.',
  'model.2x_hfa2kcompact.description':
    'Kandidat yang kompatibel hanya melalui impor ONNX manual/konversi eksternal.',
  'model.2x_digitalfilm_superultracompact.description':
    'Kandidat untuk impor ONNX manual.',
  'model.2x_anifilm_compact.description': 'Kandidat untuk impor ONNX manual.',
  'model.2xnomosuni_span_multijpg_ldl.description':
    'Kandidat untuk impor ONNX manual.',
  'model.realesrgan_x4plus.description': 'Kandidat untuk impor ONNX manual.',
  'model.4xhfa2kludvaeswinir_light.description':
    'Kandidat untuk impor ONNX manual.',
  'splitter.status.recipeApplied':
    'Resep Splitter diterapkan pada gambar aktif.',
  'splitter.status.recipeRestored': 'Resep Splitter dikembalikan ke default.',
  'splitter.status.exportCancelled':
    'Ekspor Splitter dibatalkan oleh pengguna.',
  'splitter.error.noSegmentsActive':
    'Tidak ada segmen yang valid dihasilkan untuk gambar aktif.',
  'splitter.error.noSegmentsBatch':
    'Tidak ada segmen yang valid dihasilkan dalam batch Splitter.',
  'aioExec.sessionUnavailable': 'Sesi tidak tersedia untuk menggunakan model cloud. Silakan masuk lagi.',
  'aioManual.progressionNotInitialized':
    'Progresi manual belum diinisialisasi untuk gambar aktif.',
  'cleanerActions.selectValidOcrModel':
    'Pilih model OCR yang valid untuk Cleaner.',
  'cleanerActions.invalidCleanResponseNamed':
    'Respons pembersihan tidak valid untuk "{name}".',
  'customLlm.selectTranslationProfile':
    'Pilih profil terjemahan kustom tersimpan untuk digunakan.',
  'customLlm.selectOcrProfile':
    'Pilih profil OCR kustom tersimpan untuk digunakan.',
  'customLlm.profileNotFound':
    'Profil kustom tidak ditemukan. Muat ulang dan coba lagi.',
  'customLlm.translationProfileActive':
    'Profil kustom digunakan (terjemahan): {label}.',
  'customLlm.ocrProfileActive': 'Profil kustom digunakan (OCR): {label}.',
  'accountSync.confirmEmailSent':
    'Email konfirmasi terkirim. Periksa kotak masuk Anda.',
  'accountSync.confirmEmailFailed': 'Gagal mengirim email konfirmasi.',
  'downloadActions.noTranslatorResults':
    'Tidak ada hasil Penerjemah yang tersedia untuk diunduh.',
  'enhanceActions.desktopOnly':
    'Enhancer lokal hanya tersedia di aplikasi desktop.',
  'enhanceActions.selectModel': 'Pilih model peningkatan yang kompatibel.',
  'enhanceActions.done': 'Peningkatan selesai. Gunakan Unduh untuk menyimpan.',
  'freeProvider.stageNotSupported': 'Penyedia tidak mendukung tahap ini.',
  'freeProvider.activeForTranslation':
    'Penyedia {name} digunakan untuk terjemahan.',
  'freeProvider.activeForOcr': 'Penyedia {name} digunakan untuk OCR.',
  'freeProvider.activeForClean': 'Provider {name} सफाई के लिए उपयोग में है।',
  'freeProvider.stageTranslation': 'Terjemahan',
  'freeProvider.stageOcr': 'OCR',
  'freeProvider.stageClean': 'सफाई',
  'translatorRetranslate.targetNotFound':
    'Gambar target tidak ditemukan untuk terjemahan ulang.',
  'translatorRetranslate.noTextAvailable':
    'Tidak ada teks yang dikenali tersedia untuk terjemahan ulang.',
  'translatorText.done':
    'Penerjemah Teks selesai. Gunakan salin atau unduh TXT.',
  'typographer.queueApplied': 'Teks antrean diterapkan pada seleksi saat ini.',
  'typographer.queueAppliedMulti':
    'Teks antrean diterapkan pada {{count}} balon.',
  'typographer.queueCleared': 'Antrean Typesetter dihapus.',
  'typographer.queueImported': 'Teks diimpor ke antrean Typesetter.',
  'aioManual.invalidCleanResponse':
    'Respons tidak valid saat membersihkan gambar.',
  'aioStage.lang.ko': 'Korea',
  'aioStage.lang.ja': 'Jepang',
  'aioStage.lang.fr': 'Prancis',
  'aioStage.lang.zh': 'Mandarin',
  'aioStage.lang.zh-CN': 'Mandarin Sederhana',
  'aioStage.lang.zh-TW': 'Mandarin Tradisional',
  'aioStage.lang.en': 'Inggris',
  'aioStage.lang.ru': 'Rusia',
  'aioStage.lang.de': 'Jerman',
  'aioStage.lang.nl': 'Belanda',
  'aioStage.lang.es': 'Spanyol',
  'aioStage.lang.it': 'Italia',
  'aioStage.lang.tr': 'Turki',
  'aioStage.lang.pl': 'Polandia',
  'aioStage.lang.pt': 'Portugis',
  'aioStage.lang.pt-BR': 'Portugis (BR)',
  'aioStage.lang.th': 'Thai',
  'aioStage.lang.vi': 'Vietnam',
  'aioStage.lang.hu': 'Hungaria',
  'aioStage.lang.id': 'Indonesia',
  'aioStage.lang.fi': 'Finlandia',
  'aioStage.lang.ar': 'Arab',
  'splitter.warning.noIntermediateCuts': 'Tidak ditemukan potongan perantara.',
  'splitter.warning.segmentTooSmall':
    'Segmen lebih kecil dari tinggi minimum yang dikonfigurasi.',
  'splitter.warning.segmentTooLarge':
    'Segmen lebih besar dari tinggi maksimum yang dikonfigurasi.',
  'splitter.warning.cutsNearContent':
    'Beberapa potongan dekat dengan area yang memiliki konten.',
  'splitter.warning.nearEdge': 'Terlalu dekat dengan tepi.',
  'stitch.warning.dimensionTooHigh':
    'Dimensi terlalu tinggi; ekspor dalam lebih banyak batch untuk menghindari kegagalan.',
  'stitch.warning.outputTooHeavy':
    'Output terlalu besar untuk ditinjau dan diunduh.',
  'stitch.warning.canvasLimit':
    'Mungkin melebihi batas kanvas aman di beberapa lingkungan.',
  'stitch.warning.largeBatch':
    'Batch besar; periksa apakah pemisahan masih nyaman untuk scanlation.',
  'resources.data.fontsTitle': 'Font Typesetting',
  'resources.data.fontsDesc':
    'Koleksi font populer terkurasi untuk scanlation manga, manhwa, dan manhua.',
  'resources.data.onomatopoeiaDesc':
    'Pustaka onomatope Jepang dengan terjemahan dan contoh penggunaan.',
  'resources.data.glossaryTitle': 'Glosarium Scanlation',
  'resources.data.glossaryDesc':
    'Istilah teknis dan jargon komunitas dari dunia scanlation.',
  'resources.data.catalogLabel': 'Katalog',
  'aioLocalBatch.invalidBatchResponse':
    'Respons batch tidak valid: batch_report.json tidak ditemukan dalam ZIP.',
  'modelDownload.desktopOnly':
    'Manajemen model hanya tersedia di aplikasi desktop.',
  'settings.updates.channelBeta': 'Beta',
  'settings.updates.channelStable': 'Stabil',
  'settings.presets.aio.defaultName': 'Preset',
  'settings.integrations.blogger.term.googleCloudConsole':
    'Google Cloud Console',
  'settings.integrations.blogger.term.bloggerApiV3': 'Blogger API v3',
  'settings.integrations.blogger.term.googleDriveApi': 'Google Drive API',
  'settings.integrations.blogger.term.oauthClientId': 'OAuth Client ID',
  'settings.integrations.blogger.term.clientId': 'Client ID',
  'settings.integrations.blogger.term.clientSecret': 'Client Secret',
  'settings.integrations.blogger.term.oauthPlayground': 'OAuth Playground',
  'settings.integrations.blogger.term.exchangeCodeForTokens':
    'Tukar kode untuk token',
  'settings.integrations.blogger.term.refreshToken': 'Refresh Token',
  'settings.integrations.blogger.term.cloudName': 'cloud name',
  'settings.integrations.blogger.term.blogId': 'Blog ID',
  'settings.integrations.imgur.term.clientId': 'Client ID',
  'settings.integrations.imgur.term.rateLimit': '50 upload/jam',
  'settings.shortcuts.topbarPath': 'Topbar > Pintasan',
  'login.warning.versionPrefix': 'v{version}',
  'password.policy.minLength':
    'Kata sandi harus mengandung minimal 12 karakter.',
  'password.policy.uppercase':
    'Kata sandi harus mengandung minimal satu huruf kapital.',
  'password.policy.lowercase':
    'Kata sandi harus mengandung minimal satu huruf kecil.',
  'password.policy.number': 'Kata sandi harus mengandung minimal satu angka.',
  'password.policy.special':
    'Kata sandi harus mengandung minimal satu karakter khusus.',
  'auth.sfx.primary': '쾅',
  'auth.sfx.secondary': '휙',
  'auth.stats.activeScanlatorsValue': '2.4k+',
  'auth.stats.toolsValue': '50+',
  'auth.stats.pagesProcessedValue': '1M+',
  'auth.community.joinIndicator': '+',
  'resources.sfx.onomatopoeiaLabel': 'Onomatope',
  'resources.page.shortcutCtrl': 'Ctrl',
  'resources.page.shortcutFind': 'F',
  'settings.integrations.blogger.value.requestsPerDay': '10.000',
  'settings.integrations.blogger.value.requestsPerUser': '100/100d',
  'settings.integrations.imgur.authorizationHeaderExample':
    'Authorization: Client-ID …',
  'settings.shortcuts.quickKey': 'H',
  'guides.search.keyArrowUp': '↑',
  'guides.search.keyArrowDown': '↓',
  'guides.search.keyArrowPair': '↑↓',
  'guides.search.keyEnter': '⏎',
  'guides.search.keyEscape': 'Esc',
  'settings.typographerLibrary.presetsCount_one': '{count} preset',
  'settings.typographerLibrary.presetsCount_other': '{count} preset',
  'renderPreview.iconUppercase': 'AA',
  'renderPreview.iconHorizontal': 'H',
  'renderPreview.iconVertical': 'V',
  'renderPreview.iconCircular': '◯',
  'guides.home.searchShortcut': '⌘K',
  'brand.name': 'KŌMA',
  'brand.studioSuffix': 'Studio',
  'versionBadge.stable': 'स्थिर',
  'versionBadge.beta': 'बीटा',
  'versionBadge.tooltip': 'संस्करण {version}',
  'settings.typography.iconBold': 'B',
  'settings.typography.iconItalic': 'I',
  'settings.typography.iconUppercase': 'AA',
  'settings.downloadFormat.jpeg': 'JPEG',
  'settings.downloadFormat.png': 'PNG',
  'settings.downloadFormat.webp': 'WebP',
  'common.infoGlyph': 'i',
  'modelManager.tooltip.speed.ok': 'OK',
  'update.units.bytes': 'B',
  'update.units.kilobytes': 'KB',
  'update.units.megabytes': 'MB',
  'update.units.gigabytes': 'GB',
  'update.units.perSecond': '/d',
  'update.versionPrefix': 'v{version}',
  'update.toast.newVersionFallback': 'baru',
  'dashboard.status.cloudSuffix': '(Cloud)',
  'dashboard.status.cloudApiSuffix': '(Cloud/API/AI)',
  'dashboard.status.pendingCustomTranslationName':
    'Custom AI (menyinkronkan...)',
  'dashboard.status.pendingCustomOcrName': 'Custom OCR (menyinkronkan...)',
  'modelManager.tooltip.gpu': 'GPU',
  'modelManager.tooltip.vram': 'VRAM',
  'modelManager.tooltip.ram': 'RAM',
  'dashboard.tour.preview.welcome.upload': 'Upload',
  'dashboard.tour.preview.welcome.export': 'Ekspor',
  'dashboard.tour.preview.upload.formats':
    'JPG · PNG · WEBP · ZIP · PDF · CBZ · CB7 · PSD',
  'dashboard.tour.preview.stageEmpty': 'Muat gambar untuk memulai',
  'dashboard.tour.welcome.title': 'Selamat datang di Dashboard KŌMA Studio',
  'dashboard.tour.welcome.body':
    'Tur ini memandu Anda melalui alur utama aplikasi: mengatur halaman, memilih mode, mengonfigurasi pipeline AIO, dan mengekspor hasil tanpa harus menebak di mana setiap fitur berada.',
  'dashboard.tour.sidebar.title': 'Sidebar: kuota, file, dan konteks batch',
  'dashboard.tour.sidebar.body':
    'Di sini Anda melacak paket dan penggunaan bulanan, memilih gambar aktif, menyusun ulang halaman, menghapus item, dan menjaga batch tetap terorganisir sebelum pemrosesan.',
  'dashboard.tour.upload.title': 'Input file awal',
  'dashboard.tour.upload.body':
    'Zona drop menerima gambar lepas dan paket lengkap. Ini adalah titik awal untuk menyeret chapter, raw, atau aset untuk memberi isi ke seluruh dashboard.',
  'dashboard.tour.modes.title': 'Navigasi utama Dashboard',
  'dashboard.tour.modes.body':
    'Gunakan Atur untuk menyiapkan batch dan AIO untuk pipeline lengkap. Grup topbar lainnya membuka mode khusus tanpa meninggalkan workspace.',
  'dashboard.tour.production.title': 'Produksi: alat khusus',
  'dashboard.tour.production.body':
    'Cleaner, Typesetter, Penerjemah, Raw, dan QC mencakup alur kerja manual dan lanjutan. Anggap grup ini sebagai mode profesional untuk mengerjakan tahap chapter tertentu.',
  'dashboard.tour.utils.title': 'Utilitas dan dukungan',
  'dashboard.tour.utils.body':
    'Gabung, Potong, Watermark, dan Tingkatkan menangani tugas persiapan dan ekspor cepat. Panduan dan Sumber Daya melengkapi area dukungan untuk referensi.',
  'dashboard.tour.submode.title': 'AIO Otomatis vs. manual',
  'dashboard.tour.submode.body':
    'Otomatis menjalankan pipeline lengkap secara batch. Manual membuka setiap tahap per gambar untuk tinjauan halus, mundur/maju, dan pengeditan visual terkontrol.',
  'dashboard.tour.pipeline.title': 'Pipeline AIO',
  'dashboard.tour.pipeline.body':
    'Kartu ini mengontrol urutan Deteksi > OCR > Terjemahkan > Segmentasi > Bersihkan > Render. Anda dapat mengaktifkan atau menonaktifkan tahap dan, dalam mode manual, menjalankan hanya tahap saat ini.',
  'dashboard.tour.stageConfig.title': 'Konfigurasi tahap',
  'dashboard.tour.stageConfig.body':
    'Di sini Anda menemukan bahasa, preset AIO, katalog lokal/cloud, dan pemilihan model per tahap. Ini adalah pusat keputusan untuk menyesuaikan biaya, kualitas, dan kecepatan.',
  'dashboard.tour.stage.withImagesTitle': 'Workspace dan pratinjau visual',
  'dashboard.tour.stage.withImagesBody':
    'Saat ada gambar, tahap ini menjadi pratinjau utama: Anda menavigasi halaman, melihat hasil per tahap, dan bekerja langsung pada gambar aktif.',
  'dashboard.tour.stage.emptyTitle': 'Tahap utama Dashboard',
  'dashboard.tour.stage.emptyBody':
    'Tanpa gambar, tahap menampilkan status kosong sederhana. Setelah mengunggah, tahap menampilkan pratinjau, overlay, area, dan hasil per mode.',
  'dashboard.tour.manualDock.title': 'Pratinjau interaktif dan dock manual',
  'dashboard.tour.manualDock.body':
    'Dengan gambar aktif di AIO manual, dock mengambang membuka seleksi area, kuas, penghapus, tongkat, perbaikan, dan penyesuaian kontekstual tanpa meninggalkan pratinjau.',
  'dashboard.tour.download.title': 'Ekspor dan unduhan',
  'dashboard.tour.download.body':
    'Saat aplikasi memiliki output yang siap, menu ini mengumpulkan format gambar, paket, PSD berlapis, dan opsi metadata untuk menyelesaikan alur kerja pengiriman.',
  'dashboard.tour.replay.title': 'Jika Anda ingin mengulang tur nanti',
  'dashboard.tour.replay.body':
    'Buka menu pengguna dan gunakan <strong>Putar ulang tur</strong>. Onboarding otomatis hanya berjalan pada kunjungan pertama versi saat ini, tetapi putar ulang manual selalu tersedia.',
  'dashboard.tour.progressText': 'Langkah {{current}} dari {{total}}',
  'dashboard.tour.next': 'Berikutnya',
  'dashboard.tour.prev': 'Sebelumnya',
  'dashboard.tour.done': 'Selesaikan tur',
  'dashboard.tour.dialogLabel': 'Tur Dashboard',
  'dashboard.tour.close': 'Tutup tur',
  'dashboard.tour.nextAria': 'Lanjut ke langkah berikutnya',
  'dashboard.tour.prevAria': 'Kembali ke langkah sebelumnya',
  'modelManager.tooltip.rich.highlights': 'Keunggulan',
  'modelManager.tooltip.rich.unique': 'Keistimewaan',
  'modelManager.tooltip.rich.bestFor': 'Cocok untuk',
  'modelManager.tooltip.rich.performance': 'Performa',
  'modelManager.tooltip.rich.notes': 'Catatan',
  'modelManager.tooltip.docsUrl': 'Lihat dokumentasi',
  'modelManager.tooltip.notes': 'Catatan',
  'modelManager.tooltip.highlights': 'Keunggulan',
  'modelManager.tooltip.bestFor': 'Cocok untuk',
  'modelManager.tooltip.unique': 'Keistimewaan',
  'modelManager.tooltip.performance': 'Performa',

  'model.tooltip.opus-mt-ja-en.highlights':
    'Menerjemahkan Jepang ke Inggris\nRingan dan cepat, berjalan baik tanpa GPU\nPilihan bagus untuk memulai',
  'model.tooltip.opus-mt-ja-en.unique':
    'Bekerja baik untuk teks umum bahasa Jepang, tapi tidak dirancang khusus untuk manga',
  'model.tooltip.opus-mt-ja-en.bestFor':
    'Terjemahan cepat dari Jepang ke Inggris saat tidak punya GPU yang kuat',
  'model.tooltip.opus-mt-ja-en.performance':
    'Sangat cepat, berjalan di komputer manapun tanpa perlu GPU',
  'model.tooltip.opus-mt-ja-en.notes':
    'Pilihan umum yang bagus, tapi untuk manga dan anime Sugoi memberikan hasil lebih baik',

  'model.tooltip.nllb-200-600m-int8.highlights':
    'Menerjemahkan antara hampir 200 bahasa\nVersi ringan dan dioptimalkan\nBerjalan baik di komputer manapun',
  'model.tooltip.nllb-200-600m-int8.unique':
    'Satu model yang menerjemahkan antara ratusan bahasa — ideal saat butuh fleksibilitas',
  'model.tooltip.nllb-200-600m-int8.bestFor':
    'Menerjemahkan antara bahasa yang jarang atau saat butuh model yang bisa untuk semua bahasa',
  'model.tooltip.nllb-200-600m-int8.performance':
    'Cepat dan ringan, berjalan baik bahkan di komputer tanpa GPU',
  'model.tooltip.nllb-200-600m-int8.notes':
    'Tidak dirancang untuk manga, tapi berfungsi sebagai penerjemah umum untuk banyak bahasa',

  'model.tooltip.opus-mt-zh-en.highlights':
    'Menerjemahkan Mandarin ke Inggris\nRingan dan cepat\nBerjalan tanpa GPU',
  'model.tooltip.opus-mt-zh-en.unique':
    'Fokus pada Mandarin → Inggris, bagus untuk manhua dan konten Mandarin umum',
  'model.tooltip.opus-mt-zh-en.bestFor':
    'Menerjemahkan manhua dan konten Mandarin ke Inggris dengan cepat',
  'model.tooltip.opus-mt-zh-en.performance':
    'Sangat cepat, berjalan di komputer manapun tanpa GPU',
  'model.tooltip.opus-mt-zh-en.notes':
    'Populer dan andal untuk terjemahan Mandarin → Inggris',

  'model.tooltip.nllb-200-1.3b.highlights':
    'Menerjemahkan antara hampir 200 bahasa\nKualitas lebih baik dari versi ringan\nBagus untuk bahasa yang jarang',
  'model.tooltip.nllb-200-1.3b.unique':
    'Versi menengah dengan kualitas lebih baik dari 600M, tapi tidak seberat 3.3B',
  'model.tooltip.nllb-200-1.3b.bestFor':
    'Saat butuh kualitas lebih baik dari versi ringan, terutama untuk bahasa langka',
  'model.tooltip.nllb-200-1.3b.performance':
    'Butuh GPU dengan minimal 4GB VRAM; kecepatan cukup baik',
  'model.tooltip.nllb-200-1.3b.notes':
    'Keseimbangan bagus antara kualitas dan ukuran. Tidak dirancang untuk manga.',

  'model.tooltip.nllb-200-1.3b-int8-ct2.highlights':
    'Menerjemahkan antara hampir 200 bahasa\nVersi dioptimalkan yang lebih hemat memori\nKualitas bagus dengan konsumsi lebih rendah',
  'model.tooltip.nllb-200-1.3b-int8-ct2.unique':
    'Kualitas sama dengan versi 1.3B tapi lebih hemat memori — nilai terbaik untuk performa',
  'model.tooltip.nllb-200-1.3b-int8-ct2.bestFor':
    'Terjemahan multibahasa berkualitas baik tanpa perlu komputer yang sangat kuat',
  'model.tooltip.nllb-200-1.3b-int8-ct2.performance':
    'Bisa berjalan di CPU jika perlu; lebih ringan dari versi standar 1.3B',
  'model.tooltip.nllb-200-1.3b-int8-ct2.notes':
    'Versi optimasi dari NLLB 1.3B — gunakan ini jika ingin menghemat memori',

  'model.tooltip.nllb-200-3.3b.highlights':
    'Kualitas terbaik di antara penerjemah multibahasa\nHampir 200 bahasa\nIdeal saat kualitas lebih penting dari kecepatan',
  'model.tooltip.nllb-200-3.3b.unique':
    'Versi paling kuat dan akurat dari keluarga multibahasa — terjemahan terbaik yang tersedia untuk bahasa langka',
  'model.tooltip.nllb-200-3.3b.bestFor':
    'Saat kualitas terjemahan lebih penting dari kecepatan',
  'model.tooltip.nllb-200-3.3b.performance':
    'Butuh GPU bagus dengan minimal 8GB VRAM; lebih lambat dari yang lain',
  'model.tooltip.nllb-200-3.3b.notes':
    'Lebih berat tapi kualitas lebih baik. Tidak dirancang untuk manga.',

  'model.tooltip.sugoi_v4_ja_en_ct2.highlights':
    'Menerjemahkan Jepang ke Inggris\nDirancang khusus untuk manga dan anime\nBerjalan di komputer manapun',
  'model.tooltip.sugoi_v4_ja_en_ct2.unique':
    'Memahami slang, bahasa kasual, dan ekspresi khas manga dan anime lebih baik dari penerjemah lain',
  'model.tooltip.sugoi_v4_ja_en_ct2.bestFor':
    'Menerjemahkan manga dan anime dari Jepang ke Inggris — pilihan paling direkomendasikan oleh komunitas',
  'model.tooltip.sugoi_v4_ja_en_ct2.performance':
    'Sangat cepat, berjalan baik bahkan tanpa GPU dedicated',
  'model.tooltip.sugoi_v4_ja_en_ct2.notes':
    'Gunakan model ini sebagai default untuk terjemahan Jepang → Inggris',

  'model.tooltip.m2m100_1_2b_ct2.highlights':
    'Menerjemahkan antara 100 bahasa\nMencakup Korea, Thailand, Vietnam, dan lainnya\nVersi dioptimalkan untuk kecepatan lebih tinggi',
  'model.tooltip.m2m100_1_2b_ct2.unique':
    'Salah satu dari sedikit model yang menerjemahkan dengan baik antara bahasa Asia seperti Korea, Thailand, dan Vietnam ke Inggris',
  'model.tooltip.m2m100_1_2b_ct2.bestFor':
    'Menerjemahkan manhwa Korea, manhua Mandarin, dan konten bahasa Asia lainnya ke Inggris',
  'model.tooltip.m2m100_1_2b_ct2.performance':
    'Butuh GPU dengan 4-6GB VRAM; kecepatan bagus dengan versi yang dioptimalkan',
  'model.tooltip.m2m100_1_2b_ct2.notes':
    'Pilihan bagus untuk bahasa Asia yang tidak dicakup dengan baik oleh penerjemah lain',

  'model.tooltip.vntl_llama3_8b_v2.highlights':
    'Menerjemahkan Jepang ke Inggris\nDirancang untuk visual novel dan manga\nMenjaga konsistensi nama karakter',
  'model.tooltip.vntl_llama3_8b_v2.unique':
    'Memahami konteks cerita dan menjaga konsistensi nama karakter dan istilah di seluruh teks',
  'model.tooltip.vntl_llama3_8b_v2.bestFor':
    'Menerjemahkan visual novel dan manga dengan dialog panjang di mana konsistensi nama penting',
  'model.tooltip.vntl_llama3_8b_v2.performance':
    'Butuh GPU bagus dengan 6-10GB VRAM; lebih lambat dari penerjemah sederhana',
  'model.tooltip.vntl_llama3_8b_v2.notes':
    'Ideal untuk proyek panjang di mana konsistensi nama dan istilah penting',

  'model.tooltip.lfm2_350m_enjp_mt.highlights':
    'Menerjemahkan Jepang ↔ Inggris dua arah\nSangat ringan dan cepat\nBerjalan di komputer manapun',
  'model.tooltip.lfm2_350m_enjp_mt.unique':
    'Salah satu penerjemah terkecil yang tersedia — berjalan bahkan di komputer spesifikasi rendah dan tetap memberikan hasil yang layak',
  'model.tooltip.lfm2_350m_enjp_mt.bestFor':
    'Saat butuh terjemahan cepat Jepang-Inggris dan tidak punya GPU yang kuat',
  'model.tooltip.lfm2_350m_enjp_mt.performance':
    'Sangat cepat, berjalan di komputer manapun bahkan tanpa GPU',
  'model.tooltip.lfm2_350m_enjp_mt.notes':
    'Kualitas dasar — bagus untuk draf cepat, tapi tidak untuk hasil akhir',

  'model.tooltip.sakura_galtransl_7b_v3_7.highlights':
    'Menerjemahkan Jepang ke Mandarin\nTerbaik untuk galgame dan manga\nMempertahankan format dan catatan khusus',
  'model.tooltip.sakura_galtransl_7b_v3_7.unique':
    'Mempertahankan format khusus, catatan baca, dan jeda baris — penting untuk galgame dan manga dengan teks kompleks',
  'model.tooltip.sakura_galtransl_7b_v3_7.bestFor':
    'Pilihan terbaik untuk menerjemahkan Jepang ke Mandarin saat kualitas lebih penting dari kecepatan',
  'model.tooltip.sakura_galtransl_7b_v3_7.performance':
    'Butuh GPU dengan minimal 6GB VRAM; kecepatan sedang',
  'model.tooltip.sakura_galtransl_7b_v3_7.notes':
    'Terjemahan JP→ZH terbaik yang tersedia. Gunakan saat kualitas menjadi prioritas.',

  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.highlights':
    'Menerjemahkan Jepang ke Mandarin\nVersi ringan dan cepat\nBagus untuk komputer spesifikasi rendah',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.unique':
    'Keluarga yang sama dengan Sakura yang lebih besar, tapi dioptimalkan untuk berjalan di komputer dengan memori lebih sedikit',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.bestFor':
    'Menerjemahkan Jepang ke Mandarin saat tidak punya GPU yang kuat',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.performance':
    'Cepat, hanya butuh 1-2GB VRAM',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.notes':
    'Kualitas bagus untuk ukurannya — ideal jika model yang lebih besar terlalu berat',

  'model.tooltip.hunyuan_7b_mt_v1_0.highlights':
    'Menerjemahkan antara 36 bahasa\nKualitas tinggi, pemenang kompetisi\nModel kuat untuk banyak bahasa',
  'model.tooltip.hunyuan_7b_mt_v1_0.unique':
    'Salah satu penerjemah paling banyak memenangkan penghargaan di dunia — menggabungkan beberapa terjemahan untuk memberikan hasil terbaik',
  'model.tooltip.hunyuan_7b_mt_v1_0.bestFor':
    'Saat butuh terjemahan berkualitas tinggi antara banyak bahasa berbeda',
  'model.tooltip.hunyuan_7b_mt_v1_0.performance':
    'Butuh GPU dengan 6-8GB VRAM; kecepatan sedang',
  'model.tooltip.hunyuan_7b_mt_v1_0.notes':
    'Sangat baik untuk proyek multibahasa di mana kualitas menjadi prioritas',

  'model.tooltip.font_rtdetr_v2.highlights':
    'Mendeteksi balon bicara dan teks di komik\nMengidentifikasi teks di dalam dan di luar balon\nSemua dalam satu proses',
  'model.tooltip.font_rtdetr_v2.unique':
    'Satu-satunya yang mendeteksi balon, teks di dalam balon, dan teks bebas di halaman secara bersamaan',
  'model.tooltip.font_rtdetr_v2.bestFor':
    'Analisis lengkap halaman komik — memisahkan dialog dari teks bebas secara otomatis',
  'model.tooltip.font_rtdetr_v2.performance':
    'Ringan dan cepat, berjalan baik di kebanyakan komputer',
  'model.tooltip.font_rtdetr_v2.notes':
    'Dilatih dengan manga, webtoon, manhua, dan komik Barat',

  'model.tooltip.comic_text_detector.highlights':
    'Mendeteksi teks di komik dan manga\nModel original dan andal\nBerjalan cepat di komputer manapun',
  'model.tooltip.comic_text_detector.unique':
    'Detektor klasik yang digunakan sebagai dasar oleh banyak proyek terjemahan manga',
  'model.tooltip.comic_text_detector.bestFor':
    'Deteksi teks dasar dan andal di komik — pilihan default yang bagus',
  'model.tooltip.comic_text_detector.performance':
    'Cepat, berjalan baik tanpa GPU dedicated',
  'model.tooltip.comic_text_detector.notes':
    'Model klasik yang telah diuji oleh komunitas selama bertahun-tahun',

  'model.tooltip.pp_doclayout_v3.highlights':
    'Menganalisis tata letak halaman yang dipindai\nBerfungsi bahkan dengan halaman miring atau melengkung\nMengidentifikasi urutan baca yang benar',
  'model.tooltip.pp_doclayout_v3.unique':
    'Mampu memahami halaman yang difoto miring atau dipindai secara tidak teratur — sesuatu yang model lain tidak bisa lakukan',
  'model.tooltip.pp_doclayout_v3.bestFor':
    'Halaman yang dipindai tidak sempurna, foto buku, atau tata letak kompleks dengan urutan baca yang sulit',
  'model.tooltip.pp_doclayout_v3.performance':
    'Tangguh dan andal, berfungsi baik dalam berbagai kondisi pencahayaan',
  'model.tooltip.pp_doclayout_v3.notes':
    'Berguna saat halaman tidak dipindai dengan sempurna',

  'model.tooltip.manga_ocr.highlights':
    'Membaca teks Jepang di manga\nBerfungsi dengan teks vertikal dan horizontal\nPaling direkomendasikan untuk manga Jepang',
  'model.tooltip.manga_ocr.unique':
    'Dirancang khusus untuk tantangan manga: teks vertikal, furigana, font bergaya, dan gambar kualitas rendah',
  'model.tooltip.manga_ocr.bestFor':
    'Pilihan default untuk membaca teks manga Jepang — langsung berfungsi baik tanpa perlu pengaturan',
  'model.tooltip.manga_ocr.performance':
    'Populer dan andal, digunakan oleh banyak proyek scanlation',
  'model.tooltip.manga_ocr.notes':
    'Pilihan terbaik untuk manga Jepang. Jika butuh kecepatan, pertimbangkan Meiki OCR.',

  'model.tooltip.meiki_ocr.highlights':
    'Pembaca teks Jepang sangat cepat\nMendeteksi setiap karakter secara individual\nIdeal untuk teks horizontal',
  'model.tooltip.meiki_ocr.unique':
    'Jauh lebih cepat dari pembaca teks Jepang lainnya — sempurna saat kecepatan menjadi prioritas',
  'model.tooltip.meiki_ocr.bestFor':
    'Saat perlu membaca teks Jepang horizontal dengan cepat',
  'model.tooltip.meiki_ocr.performance':
    'Sangat cepat, salah satu yang tercepat untuk bahasa Jepang',
  'model.tooltip.meiki_ocr.notes':
    'Hanya berfungsi untuk teks horizontal — untuk teks vertikal gunakan Manga OCR',

  'model.tooltip.paddleocr_vl_manga.highlights':
    'Pembaca teks yang dioptimalkan untuk manga\nBerfungsi dengan teks vertikal dan horizontal\nJauh lebih akurat di manga dibanding model dasar',
  'model.tooltip.paddleocr_vl_manga.unique':
    'Dilatih khusus dengan halaman manga — memahami font bergaya dan balon bicara lebih baik dari pembaca generik',
  'model.tooltip.paddleocr_vl_manga.bestFor':
    'Membaca teks manga dengan akurasi tinggi, terutama saat teks menggunakan font yang sulit',
  'model.tooltip.paddleocr_vl_manga.performance':
    'Akurasi bagus di manga; juga berfungsi dengan bahasa lain',
  'model.tooltip.paddleocr_vl_manga.notes':
    'Versi khusus PaddleOCR untuk manga — pilihan sangat baik untuk scanlation',

  'model.tooltip.got_ocr2.highlights':
    'Membaca teks dari dokumen, tabel, dan grafik\nMemahami rumus matematika dan partitur musik\nSerbaguna untuk berbagai jenis dokumen',
  'model.tooltip.got_ocr2.unique':
    'Melampaui teks sederhana — mampu membaca tabel, rumus, dan grafik yang diformat',
  'model.tooltip.got_ocr2.bestFor':
    'Membaca dokumen kompleks dengan tabel dan format — tidak ideal untuk manga',
  'model.tooltip.got_ocr2.performance':
    'Ringan dan serbaguna, berfungsi baik untuk dokumen secara umum',
  'model.tooltip.got_ocr2.notes':
    'Multibahasa tapi tidak dioptimalkan untuk manga — gunakan model lain untuk komik',

  'model.tooltip.qwen2_5_vl_3b.highlights':
    'Memahami gambar secara cerdas\nMelampaui membaca teks — memahami isi gambar\nMultibahasa dan serbaguna',
  'model.tooltip.qwen2_5_vl_3b.unique':
    'Tidak hanya membaca teks — memahami panel manga, mendeskripsikan adegan, dan mengekstrak informasi terorganisir dari gambar',
  'model.tooltip.qwen2_5_vl_3b.bestFor':
    'Saat model perlu memahami konten gambar, bukan hanya membaca teks',
  'model.tooltip.qwen2_5_vl_3b.performance':
    'Ukuran sedang; kecepatan bagus di GPU umum',
  'model.tooltip.qwen2_5_vl_3b.notes':
    'Multibahasa. Berguna untuk analisis panel dan pemahaman visual tingkat lanjut',

  'model.tooltip.mangalmm.highlights':
    'Memahami panel manga seperti pembaca manusia\nMengidentifikasi karakter dan elemen cerita\nMelampaui sekadar membaca teks',
  'model.tooltip.mangalmm.unique':
    'Satu-satunya model yang dirancang khusus untuk memahami manga — mengenali karakter, panel, dan narasi visual',
  'model.tooltip.mangalmm.bestFor':
    'Analisis manga tingkat lanjut: memahami siapa yang berbicara, apa yang terjadi di panel',
  'model.tooltip.mangalmm.performance':
    'Butuh GPU kuat dengan 14GB VRAM; masih dalam tahap riset',
  'model.tooltip.mangalmm.notes':
    'Model eksperimental — menjanjikan untuk masa depan scanlation tapi belum matang',

  'model.tooltip.rolmocr.highlights':
    'Pembaca teks cepat untuk dokumen\nBerfungsi baik dengan tata letak kompleks\nAlternatif yang lebih ringan dan cepat',
  'model.tooltip.rolmocr.unique':
    'Lebih cepat dan ringan dari model serupa, sambil menjaga kualitas pembacaan dokumen yang baik',
  'model.tooltip.rolmocr.bestFor':
    'Membaca dokumen dengan tata letak kompleks saat kecepatan penting',
  'model.tooltip.rolmocr.performance':
    'Cepat dan efisien; keseimbangan bagus antara kecepatan dan kualitas',
  'model.tooltip.rolmocr.notes':
    'Tidak khusus untuk manga — lebih baik untuk dokumen dan teks umum',

  'model.tooltip.glm_ocr_onnx.highlights':
    'Pembaca teks kompak dan akurat\nSalah satu yang paling akurat dalam benchmark\nBerjalan baik di komputer spesifikasi rendah',
  'model.tooltip.glm_ocr_onnx.unique':
    'Menggabungkan akurasi tinggi dengan ukuran kecil — salah satu yang paling akurat meski ringan',
  'model.tooltip.glm_ocr_onnx.bestFor':
    'Membaca dokumen dengan akurasi tinggi tanpa perlu komputer yang kuat',
  'model.tooltip.glm_ocr_onnx.performance':
    'Sangat ringan dan cepat; berjalan baik bahkan di komputer tanpa GPU kuat',
  'model.tooltip.glm_ocr_onnx.notes':
    'Mendukung beberapa bahasa tapi Jepang terbatas. Sangat bagus untuk dokumen secara umum.',

  'model.tooltip.paddleocr.highlights':
    'Membaca teks bahasa Rusia\nCepat dan andal\nPilihan bagus untuk manhwa berbahasa Rusia',
  'model.tooltip.paddleocr.unique':
    'Dioptimalkan khusus untuk alfabet Kiril — lebih baik dari pembaca generik untuk bahasa Rusia',
  'model.tooltip.paddleocr.bestFor': 'Membaca teks Rusia di komik dan manga',
  'model.tooltip.paddleocr.performance':
    'Sangat cepat, berjalan baik di kebanyakan komputer',
  'model.tooltip.paddleocr.notes': 'Pilihan terbaik untuk teks bahasa Rusia',

  'model.tooltip.paddleocr_latin_v5.highlights':
    'Membaca teks dalam bahasa Eropa\nPrancis, Jerman, Spanyol, Portugis, dan lainnya\nCepat dan andal',
  'model.tooltip.paddleocr_latin_v5.unique':
    'Dioptimalkan untuk alfabet Eropa — berfungsi lebih baik dari pembaca generik untuk bahasa-bahasa ini',
  'model.tooltip.paddleocr_latin_v5.bestFor':
    'Membaca teks dalam bahasa Eropa seperti Prancis, Jerman, Spanyol, Italia, dan Portugis',
  'model.tooltip.paddleocr_latin_v5.performance':
    'Cepat dan ringan, berjalan baik di komputer manapun',
  'model.tooltip.paddleocr_latin_v5.notes':
    'Pilihan terbaik untuk bahasa Eropa dengan alfabet Latin',

  'model.tooltip.paddleocr_ch_v5.highlights':
    'Membaca teks Mandarin Sederhana dan Tradisional\nCepat dan akurat\nIdeal untuk manhua',
  'model.tooltip.paddleocr_ch_v5.unique':
    'Dioptimalkan khusus untuk karakter Mandarin — lebih baik mengenali guratan kompleks dan font beragam',
  'model.tooltip.paddleocr_ch_v5.bestFor':
    'Membaca teks manhua dan konten Mandarin apa pun dengan akurasi tinggi',
  'model.tooltip.paddleocr_ch_v5.performance':
    'Cepat dan ringan, berjalan baik di kebanyakan komputer',
  'model.tooltip.paddleocr_ch_v5.notes':
    'Pilihan terbaik untuk bahasa Mandarin. Simpel dan efisien.',

  'model.tooltip.paddleocr_en_v5.highlights':
    'Membaca teks bahasa Inggris\nCepat dan akurat\nIdeal untuk komik Barat',
  'model.tooltip.paddleocr_en_v5.unique':
    'Dioptimalkan khusus untuk bahasa Inggris — lebih baik mengenali font dan gaya beragam',
  'model.tooltip.paddleocr_en_v5.bestFor':
    'Membaca teks Inggris dari komik Barat dan manga yang sudah diterjemahkan',
  'model.tooltip.paddleocr_en_v5.performance':
    'Sangat cepat dan ringan, berjalan di komputer manapun',
  'model.tooltip.paddleocr_en_v5.notes':
    'Pilihan terbaik untuk teks bahasa Inggris',

  'model.tooltip.easyocr.highlights':
    'Membaca teks dalam lebih dari 80 bahasa\nMudah digunakan dan serbaguna\nBeberapa bahasa dalam satu gambar',
  'model.tooltip.easyocr.unique':
    'Salah satu yang paling serbaguna — mampu membaca banyak bahasa berbeda dalam satu gambar',
  'model.tooltip.easyocr.bestFor':
    'Saat butuh pembaca yang berfungsi untuk banyak bahasa tanpa mengganti model',
  'model.tooltip.easyocr.performance':
    'Bagus untuk teks bersih; kesulitan dengan font bergaya dan teks vertikal',
  'model.tooltip.easyocr.notes':
    'Tidak dioptimalkan untuk manga. Berguna sebagai opsi multibahasa umum.',

  'model.tooltip.pororo.highlights':
    'Membaca teks Korea\nIdeal untuk manhwa Korea\nRingan dan andal',
  'model.tooltip.pororo.unique':
    'Dirancang khusus untuk alfabet Korea (Hangul) — mengenali lebih baik dari pembaca generik',
  'model.tooltip.pororo.bestFor':
    'Membaca teks manhwa Korea — pilihan dedicated terbaik untuk bahasa Korea',
  'model.tooltip.pororo.performance':
    'Akurasi bagus untuk Korea; ringan dan cepat',
  'model.tooltip.pororo.notes':
    'Hanya Korea dan Inggris. Dikelola oleh komunitas.',

  'model.tooltip.paddleocr_vl_1_5.highlights':
    'Pembaca teks multibahasa tingkat lanjut\nSalah satu yang paling akurat di dunia\nBerfungsi dengan Jepang, Mandarin, Inggris, dan lainnya',
  'model.tooltip.paddleocr_vl_1_5.unique':
    'Mampu mendeteksi teks dalam format tidak beraturan dan poligonal — membaca teks melengkung, miring, dan di posisi sulit',
  'model.tooltip.paddleocr_vl_1_5.bestFor':
    'Pembacaan teks tingkat lanjut untuk dokumen dan komik dalam berbagai bahasa',
  'model.tooltip.paddleocr_vl_1_5.performance':
    'Akurat dan serbaguna; berjalan baik di GPU umum',
  'model.tooltip.paddleocr_vl_1_5.notes':
    'Multibahasa termasuk Jepang, Mandarin, Inggris. Dasar untuk fine-tune manga.',

  'model.tooltip.aot.highlights':
    'Menghapus teks Jepang dari manga\nMerekonstruksi seni latar belakang secara otomatis\nCepat dan efisien',
  'model.tooltip.aot.unique':
    'Dirancang khusus untuk menghapus teks dari manga — memahami gaya seni dan merekonstruksi latar belakang secara alami',
  'model.tooltip.aot.bestFor':
    'Menghapus teks Jepang dari panel manga sambil merekonstruksi seni latar belakang',
  'model.tooltip.aot.performance':
    'Cepat, berfungsi baik dengan atau tanpa GPU',
  'model.tooltip.aot.notes':
    'Pilihan default yang bagus untuk membersihkan teks di manga',

  'model.tooltip.lama_manga.highlights':
    'Menghapus teks dari manga dan anime\nBerfungsi dengan gambar ukuran apa pun\nMenangani area teks besar dengan baik',
  'model.tooltip.lama_manga.unique':
    'Tidak ada batasan ukuran gambar — berfungsi dengan halaman resolusi apa pun, tidak seperti model lain',
  'model.tooltip.lama_manga.bestFor':
    'Menghapus teks dari halaman manga ukuran apa pun, terutama blok teks besar dan balon bicara',
  'model.tooltip.lama_manga.performance':
    'Menerima ukuran gambar apa pun; kecepatan bagus di kebanyakan komputer',
  'model.tooltip.lama_manga.notes':
    'Versi perbaikan dari LaMa — gunakan saat halaman besar atau banyak teks yang perlu dihapus',

  'model.tooltip.opencv_lama.highlights':
    'Menghapus teks dari gambar\nVersi ringan dan sederhana\nBagus untuk penggunaan umum',
  'model.tooltip.opencv_lama.unique':
    'Versi resmi yang dikelola oleh OpenCV — integrasi langsung dan andal',
  'model.tooltip.opencv_lama.bestFor':
    'Penghapusan teks dasar dan cepat saat tidak membutuhkan kualitas tertinggi',
  'model.tooltip.opencv_lama.performance':
    'Ringan dan cepat, berjalan di komputer manapun',
  'model.tooltip.opencv_lama.notes':
    'Pilihan ringan yang bagus untuk pembersihan teks sederhana',

  'model.tooltip.lama_fp32.highlights':
    'Menghapus teks dari gambar dengan kualitas tinggi\nKualitas terbaik di antara penghapus teks\nIdeal saat kualitas lebih penting dari kecepatan',
  'model.tooltip.lama_fp32.unique':
    'Versi LaMa yang paling setia dan akurat — merekonstruksi latar belakang lebih alami dari versi ringan',
  'model.tooltip.lama_fp32.bestFor':
    'Saat kualitas pembersihan lebih penting dari kecepatan',
  'model.tooltip.lama_fp32.performance':
    'Lebih lambat dari versi ringan; butuh lebih banyak memori',
  'model.tooltip.lama_fp32.notes':
    'Gunakan saat kualitas menjadi prioritas. Ukuran input tetap.',

  'model.tooltip.waifu2x_swin_unet_art_scan_2x.highlights':
    'Meningkatkan scan anime 2x\nMenghapus noise dan meningkatkan kualitas\nIdeal untuk scan manga',
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.unique':
    'Model klasik untuk meningkatkan scan anime dan manga — menghapus noise dan memperbaiki gambar sekaligus',
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.bestFor':
    'Meningkatkan scan manga resolusi rendah dan menghapus artefak kompresi JPEG',
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.performance':
    'Ringan dan cepat, berjalan di komputer manapun',
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.notes':
    'Pilihan default yang bagus untuk meningkatkan scan manga 2x',

  'model.tooltip.waifu2x_swin_unet_art_scan_4x.highlights':
    'Meningkatkan scan anime 4x\nMenghapus noise dan meningkatkan kualitas\nUntuk saat butuh lebih banyak detail',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.unique':
    'Versi 4x dari Waifu2x klasik — meningkatkan resolusi jauh lebih besar sambil menjaga garis tetap bersih',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.bestFor':
    'Meningkatkan scan manga dengan peningkatan resolusi lebih besar dan mempertahankan line art yang bersih',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.performance':
    'Lebih lambat dari versi 2x; tetap ringan',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.notes':
    'Gunakan saat butuh resolusi lebih tinggi dari yang ditawarkan versi 2x',

  'model.tooltip.waifu2x_swin_unet_art_2x.highlights':
    'Meningkatkan seni anime 2x\nUntuk seni yang sudah bersih dan berkualitas baik\nMempertahankan detail halus',
  'model.tooltip.waifu2x_swin_unet_art_2x.unique':
    'Dioptimalkan untuk seni yang sudah bersih — mempertahankan detail halus tanpa menambah noise',
  'model.tooltip.waifu2x_swin_unet_art_2x.bestFor':
    'Meningkatkan seni digital bersih dan manga yang sudah berkualitas baik dari sumbernya',
  'model.tooltip.waifu2x_swin_unet_art_2x.performance':
    'Ringan dan cepat, berjalan di komputer manapun',
  'model.tooltip.waifu2x_swin_unet_art_2x.notes':
    'Kurang agresif dibanding versi untuk scan — gunakan saat gambar sudah bersih',

  'model.tooltip.4xnomos2_hq_mosr.highlights':
    'Memperbesar gambar 4x dengan kualitas maksimal\nMempertahankan detail halus dan garis tajam\nIdeal untuk scan yang sudah bersih',
  'model.tooltip.4xnomos2_hq_mosr.unique':
    'Fokus pada kualitas — menjaga setiap detail gambar asli tetap utuh',
  'model.tooltip.4xnomos2_hq_mosr.bestFor':
    'Meningkatkan scan manga yang sudah bersih dan berkualitas baik',
  'model.tooltip.4xnomos2_hq_mosr.performance':
    'Kecepatan bagus; ukuran file kecil hanya 16MB',
  'model.tooltip.4xnomos2_hq_mosr.notes':
    'Berfungsi terbaik dengan gambar yang sudah bersih. Jika gambar ada noise atau kompresi, bersihkan dulu.',

  'model.tooltip.4xspankendata.highlights':
    'Memperbesar gambar 4x dengan sangat cepat\nUkuran file sangat kecil hanya 1,6MB\nBerjalan baik bahkan di komputer spesifikasi rendah',
  'model.tooltip.4xspankendata.unique':
    'Sangat ringan — sempurna saat butuh kecepatan tanpa memakan ruang',
  'model.tooltip.4xspankendata.bestFor':
    'Upscale cepat semua jenis gambar saat waktu sangat penting',
  'model.tooltip.4xspankendata.performance':
    'Sangat cepat; ukuran file hanya 1,6MB — ideal untuk CPU',
  'model.tooltip.4xspankendata.notes':
    'Ukurannya sangat kecil untuk kualitas yang dihasilkan. Pilihan bagus untuk pemrosesan batch.',

  'model.tooltip.2x_hfa2kcompact.highlights':
    'Memperbesar gambar 2x dengan keseimbangan yang baik\nDilatih pada frame anime modern\nMenangani kompresi dan blur dengan baik',
  'model.tooltip.2x_hfa2kcompact.unique':
    'Spesialis anime — memahami gaya visual animasi modern',
  'model.tooltip.2x_hfa2kcompact.bestFor':
    'Halaman manga/anime dengan artefak kompresi atau kualitas tidak merata',
  'model.tooltip.2x_hfa2kcompact.performance':
    'Cepat dan ringan; ukuran file hanya 4,6MB',
  'model.tooltip.2x_hfa2kcompact.notes':
    'Tangguh untuk gambar dunia nyata — berfungsi baik bahkan dengan scan yang tidak sempurna.',

  'model.tooltip.2x_digitalfilm_superultracompact.highlights':
    'Memperbesar gambar 2x dengan ukuran minimal\nIdeal saat ruang disk terbatas\nKualitas bagus untuk ukurannya',
  'model.tooltip.2x_digitalfilm_superultracompact.unique':
    'Ultra-kompak — muat di mana saja tanpa mengorbankan kualitas',
  'model.tooltip.2x_digitalfilm_superultracompact.bestFor':
    'Upscale ringan saat perlu menghemat ruang atau memori',
  'model.tooltip.2x_digitalfilm_superultracompact.performance':
    'Cepat; ~20MB; mungkin perlu konversi format manual',
  'model.tooltip.2x_digitalfilm_superultracompact.notes':
    'Jika file tidak bisa dimuat, mungkin perlu mengkonversi formatnya secara eksternal.',

  'model.tooltip.2x_anifilm_compact.highlights':
    'Memperbesar gambar 2x dioptimalkan untuk anime\nKeseimbangan bagus antara kualitas dan ukuran\nGaya visual dipertahankan',
  'model.tooltip.2x_anifilm_compact.unique':
    'Memahami gaya visual anime dan film animasi — menjaga estetika asli',
  'model.tooltip.2x_anifilm_compact.bestFor':
    'Konten anime di mana Anda ingin menjaga tampilan asli tanpa berlebihan',
  'model.tooltip.2x_anifilm_compact.performance':
    'Cepat; ~20MB; mungkin perlu konversi format manual',
  'model.tooltip.2x_anifilm_compact.notes':
    'Jika file tidak bisa dimuat, mungkin perlu mengkonversi formatnya secara eksternal.',

  'model.tooltip.2xnomosuni_span_multijpg_ldl.highlights':
    'Memperbesar gambar 2x dengan ketahanan terhadap kompresi\nDilatih untuk menangani berbagai level kualitas JPG\nTangguh untuk scan yang tidak sempurna',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.unique':
    'Spesialis menangani kompresi JPG — berfungsi baik bahkan dengan scan kualitas rendah',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.bestFor':
    'Scan manga dengan kompresi JPG beragam atau artefak kualitas',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.performance':
    'Cepat; ~20MB; mungkin perlu konversi format manual',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.notes':
    'Jika file tidak bisa dimuat, mungkin perlu mengkonversi formatnya secara eksternal.',

  'model.tooltip.realesrgan_x4plus.highlights':
    'Memperbesar gambar 4x dengan fleksibilitas tinggi\nMenangani JPEG, blur, dan noise dengan baik\nBerfungsi dengan semua jenis konten',
  'model.tooltip.realesrgan_x4plus.unique':
    'Paling serbaguna — memahami dan memperbaiki berbagai jenis degradasi gambar',
  'model.tooltip.realesrgan_x4plus.bestFor':
    'Halaman manga dengan konten campuran; artefak JPEG; upscaler paling serbaguna',
  'model.tooltip.realesrgan_x4plus.performance':
    'Kecepatan bagus; sedikit lebih berat dari yang kompak',
  'model.tooltip.realesrgan_x4plus.notes':
    'Untuk anime/manga murni, pilih versi anime (6B) yang lebih cepat dan dioptimalkan.',

  'model.tooltip.4xhfa2kludvaeswinir_light.highlights':
    'Memperbesar gambar 4x dioptimalkan untuk anime\nKeseimbangan bagus antara kualitas dan performa\nMempertahankan gaya visual anime',
  'model.tooltip.4xhfa2kludvaeswinir_light.unique':
    'Menggabungkan kualitas upscale dengan perhatian pada detail visual anime',
  'model.tooltip.4xhfa2kludvaeswinir_light.bestFor':
    'Upscale 4x konten anime dengan kualitas sumber yang bagus',
  'model.tooltip.4xhfa2kludvaeswinir_light.performance':
    'Kecepatan sedang; ~70MB; mungkin perlu konversi format manual',
  'model.tooltip.4xhfa2kludvaeswinir_light.notes':
    'Jika file tidak bisa dimuat, mungkin perlu mengkonversi formatnya secara eksternal.',

  'model.tooltip.baka_content_cc.highlights':
    'Memisahkan teks dari balon di halaman komik\nMengidentifikasi mana yang teks dan mana yang balon\nCepat dan efisien',
  'model.tooltip.baka_content_cc.unique':
    'Terintegrasi dengan sistem deteksi teks dan balon — bekerja bersama model lain',
  'model.tooltip.baka_content_cc.bestFor':
    'Memisahkan teks dan balon di halaman manga untuk pemrosesan selanjutnya',
  'model.tooltip.baka_content_cc.performance':
    'Cepat dan ringan, tidak perlu GPU yang kuat',
  'model.tooltip.baka_content_cc.notes':
    'Digunakan sebagai bagian dari pipeline segmentasi',
  'settings.tooltips.title': 'Tooltip',
  'settings.tooltips.description':
    'Atur kapan tips kontekstual muncul saat menggunakan dasbor.',
  'settings.tooltips.enableTitle': 'Tampilkan tips kontekstual',
  'settings.tooltips.enableDesc':
    'Menampilkan tips animasi saat pertama kali Anda menggunakan setiap alat per sesi.',
  'dashboard.hint.healing.ariaLabel': 'Tips alat Healing',
  'dashboard.hint.healing.eyebrow': 'Alat baru',
  'dashboard.hint.healing.body':
    'Gunakan Healing Brush untuk menghapus cacat, tepi yang rusak, dan sisa teks. Sapukan pada area yang ingin diperbaiki dan klik Terapkan agar AI merekonstruksi area tersebut secara mulus.',
  'dashboard.hint.healing.footer':
    'Tips ini tidak akan muncul lagi di sesi ini. Nonaktifkan semua tips di Pengaturan → Aplikasi.',
  'dashboard.aio.presets.tooltip':
    'Preset menyimpan kombinasi model dan tahap per bahasa. Gunakan untuk beralih pengaturan AIO lebih cepat saat mengganti bahasa sumber atau alur kerja.',
  'dashboard.aio.presets.tooltipAria': 'Untuk apa preset bahasa digunakan',
  'dashboard.aio.cleanImage.tooltip':
    'Clean Image adalah tahap pembersihan dan pewarnaan ulang. Ini menghapus teks dan artefak yang dipilih sebelum proses render/edit terakhir.',
  'dashboard.aio.cleanImage.tooltipAria': 'Untuk apa Clean Image digunakan',
  'dashboard.aio.clean.maskDilation.tooltip':
    'Memperluas masker pembersihan sebelum pewarnaan ulang. Naikkan nilainya jika tepi teks masih tersisa; pertahankan lebih rendah untuk menjaga karya seni terdekat.',
  'dashboard.aio.clean.maskDilation.tooltipAria':
    'Untuk apa dilatasi masker digunakan',
  'dashboard.dashboardLlm.hdStrategy.tooltip':
    'Menentukan bagaimana gambar besar disiapkan sebelum pembersihan. Resize menskalakan halaman, Crop membaginya menjadi ubin, dan Original mengirim apa adanya.',
  'dashboard.dashboardLlm.hdStrategy.tooltipAria':
    'Untuk apa strategi HD digunakan',
  'dashboard.dashboardLlm.cropMargin.tooltip':
    'Menambahkan padding ekstra di sekitar setiap ubin potong. Naikkan jika tepi kehilangan konteks atau menunjukkan sambungan setelah pembersihan.',
  'dashboard.dashboardLlm.cropMargin.tooltipAria':
    'Untuk apa margin potong digunakan',
  'dashboard.dashboardLlm.cropTriggerSize.tooltip':
    'Ukuran gambar minimum yang mengaktifkan pemotongan ubin. Gambar yang lebih kecil tetap sebagai satu bagian; yang lebih besar dibagi menjadi ubin.',
  'dashboard.dashboardLlm.cropTriggerSize.tooltipAria':
    'Untuk apa ukuran pemicu potong digunakan',
  'common.basicInfo': "मूल जानकारी",
  'common.resolve': "समाधान करें",
  'common.dismiss': "खारिज करें",
  'common.title': "शीर्षक",
  'common.summary': "सारांश",
  'common.summaryPlaceholder': "एक छोटा और स्पष्ट सारांश लिखें।",
  'common.mainDescription': "मुख्य विवरण",
  'common.chapter': "अध्याय",
  'common.genres': "शैलियाँ",
  'common.editorialDescription': "संपादकीय विवरण",
  'common.removeValue': "{value} हटाएँ",
  'settings.integrations.discordWebhook': "Discord Webhook",
  'discord.presence.appName': "KŌMA Studio",
  'discord.presence.button.website': "वेबसाइट",
  'discord.presence.button.download': "डाउनलोड",
  'discord.presence.idle.details': "स्कैनलेशन टूल्स देख रहे हैं",
  'discord.presence.idle.state': "निष्क्रिय",
  'discord.presence.workspace.details': "पेजों को व्यवस्थित कर रहे हैं और वर्कफ़्लो तैयार कर रहे हैं",
  'discord.presence.aio.details': "पूरे मंगा पाइपलाइन को चला रहे हैं",
  'discord.presence.mode.automatic': "स्वचालित मोड",
  'discord.presence.mode.manual': "मैनुअल मोड",
  'discord.presence.mode.basic': "मोड: बेसिक",
  'discord.presence.mode.advanced': "मोड: एडवांस्ड",
  'discord.presence.cleaner.details': "बबल्स साफ कर रहे हैं और आर्ट बहाल कर रहे हैं",
  'discord.presence.cleaner.state.basic': "मोड: बेसिक",
  'discord.presence.cleaner.state.advanced': "मोड: एडवांस्ड",
  'discord.presence.translator.details': "संवादों का भाव बनाए रखते हुए अनुवाद कर रहे हैं",
  'discord.presence.translator.fileDetails': "अनुवाद किया जा रहा है - {fileName}",
  'discord.presence.typesetter.details': "अंतिम टेक्स्ट को वापस पेज पर बिठा रहे हैं",
  'discord.presence.typesetter.fileDetails': "टेक्स्ट संपादित किया जा रहा है - {fileName}",
  'discord.presence.redraw.fileDetails': "रीड्रॉ किया जा रहा है - {fileName}",
  'discord.presence.raw.details': "providers को टेस्ट कर रहे हैं और raw outputs की तुलना कर रहे हैं",
  'discord.presence.proofreader.details': "अंतिम रिलीज़ से पहले पेजों की समीक्षा कर रहे हैं",
  'discord.presence.stitch.details': "पैनलों को जोड़कर लंबी सतत पेज बना रहे हैं",
  'discord.presence.split.details': "spreads को साफ़ single pages में बाँट रहे हैं",
  'discord.presence.watermark.details': "पेजों पर credits और branding जोड़ रहे हैं",
  'discord.presence.enhance.details': "पेजों को upscale कर रहे हैं और आर्ट को refine कर रहे हैं",
  'discord.presence.optimizer.details': "export और delivery के लिए chapters को polish कर रहे हैं",
  'discord.presence.blogger.details': "chapter posts और CDN delivery तैयार कर रहे हैं",
  'discord.presence.imgur.details': "image sets upload कर रहे हैं और links share कर रहे हैं",
  'discord.presence.guides.details': "workflows, shortcuts और best practices सीख रहे हैं",
  'discord.presence.resources.details': "assets, references और support material देख रहे हैं",
  'discord.presence.batch.details': "पेजों को एक-एक करके प्रोसेस कर रहे हैं",
  'discord.presence.batch.fileDetails': "बैच प्रोसेस किया जा रहा है - {fileName}",
  'discord.presence.batch.state': "{current}/{total} फ़ाइलें",
  'discord.presence.batch.label': "बैच मोड",
  'discord.presence.section.working': "{section} में काम कर रहे हैं",
  'discord.presence.section.viewing': "{section} देख रहे हैं",
  'discord.presence.settings.details': "स्टूडियो की प्राथमिकताएँ समायोजित कर रहे हैं",
  'discord.presence.settings.label': "सेटिंग्स",
  'discord.presence.rankings.details': "मॉडल की गुणवत्ता, गति और लागत की तुलना कर रहे हैं",
  'discord.presence.rankings.label': "रैंकिंग्स",
  'discord.presence.scanlationFeed.details': "कम्युनिटी रिलीज़ और अपडेट देख रहे हैं",
  'discord.presence.scanlationFeed.label': "स्कैनलेशन फ़ीड",
  'discord.presence.loginRegister.details': "साइन इन कर रहे हैं और अकाउंट एक्सेस संभाल रहे हैं",
  'discord.presence.loginRegister.label': "लॉगिन / रजिस्टर",
  'typographer.shapeApplied': "आकार लागू किया गया।",
  'feed.tabsAria': "स्कैनलेशन फ़ीड अनुभाग",
  'feed.actions.publishPost': "{type} प्रकाशित करें",
} as const;
