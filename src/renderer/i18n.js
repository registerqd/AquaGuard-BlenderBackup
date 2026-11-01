/* ============================================================
   AquaGuard — 多语言支持（16 种语言）
   用法：i18n.t('概览') 取当前语言译文；
        切换语言调用 i18n.set(langCode)，自动重刷静态文本。
   ============================================================ */

const LANGS = [
  { code: 'zh-CN', name: '简体中文', flag: '🇨🇳' },
  { code: 'zh-TW', name: '繁體中文', flag: '🇹🇼' },
  { code: 'en',    name: 'English',  flag: '🇬🇧' },
  { code: 'ja',    name: '日本語',    flag: '🇯🇵' },
  { code: 'ko',    name: '한국어',    flag: '🇰🇷' },
  { code: 'fr',    name: 'Français', flag: '🇫🇷' },
  { code: 'de',    name: 'Deutsch',  flag: '🇩🇪' },
  { code: 'es',    name: 'Español',  flag: '🇪🇸' },
  { code: 'pt-BR', name: 'Português',flag: '🇧🇷' },
  { code: 'ru',    name: 'Русский',  flag: '🇷🇺' },
  { code: 'it',    name: 'Italiano', flag: '🇮🇹' },
  { code: 'pl',    name: 'Polski',   flag: '🇵🇱' },
  { code: 'tr',    name: 'Türkçe',   flag: '🇹🇷' },
  { code: 'ar',    name: 'العربية',  flag: '🇸🇦' },
  { code: 'hi',    name: 'हिन्दी',    flag: '🇮🇳' },
  { code: 'id',    name: 'Indonesia',flag: '🇮🇩' }
];

/* 字典：键为中文原文，值为各语言译文 */
const DICT = {
  '青羽守护': {
    'zh-CN':'青羽守护','zh-TW':'青羽守護',en:'AquaGuard',ja:'アクアガード',ko:'아쿠아가드',
    fr:'AquaGuard',de:'AquaGuard',es:'AquaGuard','pt-BR':'AquaGuard',ru:'AquaGuard',
    it:'AquaGuard',pl:'AquaGuard',tr:'AquaGuard',ar:'أكوا جارد',hi:'एक्वागार्ड',id:'AquaGuard'
  },
  'Blender 自动存档看门狗': {
    'zh-CN':'Blender 自动存档看门狗','zh-TW':'Blender 自動存檔看門狗',en:'Blender autosave watchdog',
    ja:'Blender 自動保存ウォッチドッグ',ko:'Blender 자동 저장 워치독',fr:'Chien de garde de sauvegarde Blender',
    de:'Blender-Autospeicher-Wachhund',es:'Vigilante de autoguardado de Blender','pt-BR':'Cão de guarda de salvamento automático do Blender',
    ru:'Сторож автосохранения Blender',it:'Watchdog autosalvataggio Blender',pl:'Watchdog autozapisu Blender',
    tr:'Blender otomatik kayıt bekçisi',ar:'حارس الحفظ التلقائي لبلندر',hi:'ब्लेंडर ऑटोसेव वॉचडॉग',id:'Watchdog simpan otomatis Blender'
  },
  '看门狗未启动': {
    'zh-CN':'看门狗未启动','zh-TW':'看門狗未啟動',en:'Watchdog stopped',ja:'ウォッチドッグ停止中',ko:'워치독 중지됨',
    fr:'Chien de garde arrêté',de:'Wachhund gestoppt',es:'Vigilante detenido','pt-BR':'Cão de guarda parado',
    ru:'Сторож остановлен',it:'Watchdog fermo',pl:'Watchdog zatrzymany',tr:'Bekçi durduruldu',
    ar:'الحارس متوقف',hi:'वॉचडॉग बंद',id:'Watchdog berhenti'
  },
  '看门狗运行中': {
    'zh-CN':'看门狗运行中','zh-TW':'看門狗運行中',en:'Watchdog running',ja:'ウォッチドッグ稼働中',ko:'워치독 실행 중',
    fr:'Chien de garde actif',de:'Wachhund läuft',es:'Vigilante en ejecución','pt-BR':'Cão de guarda ativo',
    ru:'Сторож работает',it:'Watchdog attivo',pl:'Watchdog działa',tr:'Bekçi çalışıyor',
    ar:'الحارس يعمل',hi:'वॉचडॉग चालू',id:'Watchdog berjalan'
  },
  'Blender 未连接': {
    'zh-CN':'Blender 未连接','zh-TW':'Blender 未連接',en:'Blender disconnected',ja:'Blender 未接続',ko:'Blender 연결 안 됨',
    fr:'Blender déconnecté',de:'Blender nicht verbunden',es:'Blender desconectado','pt-BR':'Blender desconectado',
    ru:'Blender не подключён',it:'Blender disconnesso',pl:'Blender niepołączony',tr:'Blender bağlı değil',
    ar:'بلندر غير متصل',hi:'ब्लेंडर कनेक्ट नहीं',id:'Blender terputus'
  },
  'Blender 已连接': {
    'zh-CN':'Blender 已连接','zh-TW':'Blender 已連接',en:'Blender connected',ja:'Blender 接続済み',ko:'Blender 연결됨',
    fr:'Blender connecté',de:'Blender verbunden',es:'Blender conectado','pt-BR':'Blender conectado',
    ru:'Blender подключён',it:'Blender connesso',pl:'Blender połączony',tr:'Blender bağlı',
    ar:'بلندر متصل',hi:'ब्लेंडर कनेक्ट है',id:'Blender terhubung'
  },
  '工作台': {
    'zh-CN':'工作台','zh-TW':'工作台',en:'Workspace',ja:'ワークスペース',ko:'작업대',
    fr:'Espace de travail',de:'Arbeitsbereich',es:'Área de trabajo','pt-BR':'Área de trabalho',
    ru:'Рабочая область',it:'Area di lavoro',pl:'Obszar roboczy',tr:'Çalışma alanı',
    ar:'مساحة العمل',hi:'वर्कस्पेस',id:'Ruang kerja'
  },
  '系统': {
    'zh-CN':'系统','zh-TW':'系統',en:'System',ja:'システム',ko:'시스템',
    fr:'Système',de:'System',es:'Sistema','pt-BR':'Sistema',ru:'Система',
    it:'Sistema',pl:'System',tr:'Sistem',ar:'النظام',hi:'सिस्टम',id:'Sistem'
  },
  '概览': {
    'zh-CN':'概览','zh-TW':'概覽',en:'Overview',ja:'概要',ko:'개요',
    fr:'Aperçu',de:'Übersicht',es:'Resumen','pt-BR':'Visão geral',ru:'Обзор',
    it:'Panoramica',pl:'Przegląd',tr:'Genel bakış',ar:'نظرة عامة',hi:'अवलोकन',id:'Ikhtisar'
  },
  '快照': {
    'zh-CN':'快照','zh-TW':'快照',en:'Snapshots',ja:'スナップショット',ko:'스냅샷',
    fr:'Instantanés',de:'Schnappschüsse',es:'Instantáneas','pt-BR':'Instantâneos',
    ru:'Снимки',it:'Istantanee',pl:'Migawki',tr:'Anlık görüntüler',
    ar:'لقطات',hi:'स्नैपशॉट',id:'Cuplikan'
  },
  'Blender 插件': {
    'zh-CN':'Blender 插件','zh-TW':'Blender 外掛',en:'Blender Add-on',ja:'Blender アドオン',ko:'Blender 애드온',
    fr:'Extension Blender',de:'Blender-Add-on',es:'Complemento de Blender','pt-BR':'Complemento do Blender',
    ru:'Дополнение Blender',it:'Componente aggiuntivo Blender',pl:'Dodatek Blender',tr:'Blender eklentisi',
    ar:'إضافة بلندر',hi:'ब्लेंडर ऐड-ऑन',id:'Add-on Blender'
  },
  '设置': {
    'zh-CN':'设置','zh-TW':'設定',en:'Settings',ja:'設定',ko:'설정',
    fr:'Paramètres',de:'Einstellungen',es:'Ajustes','pt-BR':'Configurações',ru:'Настройки',
    it:'Impostazioni',pl:'Ustawienia',tr:'Ayarlar',ar:'الإعدادات',hi:'सेटिंग्स',id:'Pengaturan'
  },
  '日志': {
    'zh-CN':'日志','zh-TW':'日誌',en:'Logs',ja:'ログ',ko:'로그',
    fr:'Journaux',de:'Protokolle',es:'Registros','pt-BR':'Registros',ru:'Журналы',
    it:'Registro',pl:'Dzienniki',tr:'Günlükler',ar:'السجلات',hi:'लॉग',id:'Log'
  },
  '关于': {
    'zh-CN':'关于','zh-TW':'關於',en:'About',ja:'情報',ko:'정보',
    fr:'À propos',de:'Über',es:'Acerca de','pt-BR':'Sobre',ru:'О программе',
    it:'Informazioni',pl:'O programie',tr:'Hakkında',ar:'حول',hi:'परिचय',id:'Tentang'
  },
  '立即存档': {
    'zh-CN':'立即存档','zh-TW':'立即存檔',en:'Snapshot now',ja:'今すぐ保存',ko:'지금 저장',
    fr:'Enregistrer maintenant',de:'Jetzt sichern',es:'Guardar ahora','pt-BR':'Salvar agora',
    ru:'Сохранить сейчас',it:'Salva ora',pl:'Zapisz teraz',tr:'Şimdi kaydet',
    ar:'حفظ الآن',hi:'अभी सहेजें',id:'Simpan sekarang'
  },
  '停止看门狗': {
    'zh-CN':'停止看门狗','zh-TW':'停止看門狗',en:'Stop watchdog',ja:'ウォッチドッグ停止',ko:'워치독 중지',
    fr:'Arrêter le chien de garde',de:'Wachhund stoppen',es:'Detener vigilante','pt-BR':'Parar cão de guarda',
    ru:'Остановить сторож',it:'Ferma watchdog',pl:'Zatrzymaj watchdog',tr:'Bekçiyi durdur',
    ar:'إيقاف الحارس',hi:'वॉचडॉग रोकें',id:'Hentikan watchdog'
  },
  '启动看门狗': {
    'zh-CN':'启动看门狗','zh-TW':'啟動看門狗',en:'Start watchdog',ja:'ウォッチドッグ起動',ko:'워치독 시작',
    fr:'Démarrer le chien de garde',de:'Wachhund starten',es:'Iniciar vigilante','pt-BR':'Iniciar cão de guarda',
    ru:'Запустить сторож',it:'Avvia watchdog',pl:'Uruchom watchdog',tr:'Bekçiyi başlat',
    ar:'بدء الحارس',hi:'वॉचडॉग शुरू करें',id:'Mulai watchdog'
  },
  '看门狗': {
    'zh-CN':'看门狗','zh-TW':'看門狗',en:'Watchdog',ja:'ウォッチドッグ',ko:'워치독',
    fr:'Chien de garde',de:'Wachhund',es:'Vigilante','pt-BR':'Cão de guarda',ru:'Сторож',
    it:'Watchdog',pl:'Watchdog',tr:'Bekçi',ar:'الحارس',hi:'वॉचडॉग',id:'Watchdog'
  },
  'Blender 连接': {
    'zh-CN':'Blender 连接','zh-TW':'Blender 連接',en:'Blender link',ja:'Blender 接続',ko:'Blender 연결',
    fr:'Liaison Blender',de:'Blender-Verbindung',es:'Conexión Blender','pt-BR':'Conexão Blender',
    ru:'Связь с Blender',it:'Connessione Blender',pl:'Połączenie Blender',tr:'Blender bağlantısı',
    ar:'اتصال بلندر',hi:'ब्लेंडर लिंक',id:'Koneksi Blender'
  },
  '存档节奏': {
    'zh-CN':'存档节奏','zh-TW':'存檔節奏',en:'Snapshot cadence',ja:'保存間隔',ko:'저장 주기',
    fr:'Rythme des instantanés',de:'Sicherungsrhythmus',es:'Ritmo de guardado','pt-BR':'Ritmo de salvamento',
    ru:'Частота снимков',it:'Cadenza istantanee',pl:'Rytm migawek',tr:'Anlık görüntü ritmi',
    ar:'إيقاع اللقطات',hi:'स्नैपशॉट गति',id:'Irama cuplikan'
  },
  '最近快照': {
    'zh-CN':'最近快照','zh-TW':'最近快照',en:'Latest snapshot',ja:'最新スナップショット',ko:'최근 스냅샷',
    fr:'Dernier instantané',de:'Letzter Schnappschuss',es:'Última instantánea','pt-BR':'Último instantâneo',
    ru:'Последний снимок',it:'Ultima istantanea',pl:'Ostatnia migawka',tr:'Son anlık görüntü',
    ar:'أحدث لقطة',hi:'नवीनतम स्नैपशॉट',id:'Cuplikan terbaru'
  },
  '心跳监测': {
    'zh-CN':'心跳监测','zh-TW':'心跳監測',en:'Heartbeat monitor',ja:'ハートビート監視',ko:'하트비트 감시',
    fr:'Surveillance du battement',de:'Heartbeat-Überwachung',es:'Monitor de latido','pt-BR':'Monitor de batimento',
    ru:'Монитор пульса',it:'Monitor battito',pl:'Monitor pulsu',tr:'Kalp atışı izleme',
    ar:'مراقبة النبض',hi:'हार्टबीट निगरानी',id:'Pemantau detak'
  },
  '打开快照文件夹': {
    'zh-CN':'打开快照文件夹','zh-TW':'開啟快照資料夾',en:'Open snapshot folder',ja:'スナップショットフォルダを開く',ko:'스냅샷 폴더 열기',
    fr:'Ouvrir le dossier des instantanés',de:'Schnappschussordner öffnen',es:'Abrir carpeta de instantáneas','pt-BR':'Abrir pasta de instantâneos',
    ru:'Открыть папку снимков',it:'Apri cartella istantanee',pl:'Otwórz folder migawek',tr:'Anlık görüntü klasörünü aç',
    ar:'فتح مجلد اللقطات',hi:'स्नैपशॉट फ़ोल्डर खोलें',id:'Buka folder cuplikan'
  },
  '刷新': {
    'zh-CN':'刷新','zh-TW':'重新整理',en:'Refresh',ja:'更新',ko:'새로고침',
    fr:'Actualiser',de:'Aktualisieren',es:'Actualizar','pt-BR':'Atualizar',ru:'Обновить',
    it:'Aggiorna',pl:'Odśwież',tr:'Yenile',ar:'تحديث',hi:'रीफ़्रेश',id:'Segarkan'
  },
  '打开恢复文件夹': {
    'zh-CN':'打开恢复文件夹','zh-TW':'開啟復原資料夾',en:'Open recovery folder',ja:'復元フォルダを開く',ko:'복구 폴더 열기',
    fr:'Ouvrir le dossier de récupération',de:'Wiederherstellungsordner öffnen',es:'Abrir carpeta de recuperación','pt-BR':'Abrir pasta de recuperação',
    ru:'Открыть папку восстановления',it:'Apri cartella ripristino',pl:'Otwórz folder odzyskiwania',tr:'Kurtarma klasörünü aç',
    ar:'فتح مجلد الاستعادة',hi:'रिकवरी फ़ोल्डर खोलें',id:'Buka folder pemulihan'
  },
  '导出插件文件': {
    'zh-CN':'导出插件文件','zh-TW':'匯出外掛檔案',en:'Export add-on file',ja:'アドオンファイルを書き出す',ko:'애드온 파일 내보내기',
    fr:"Exporter le fichier d'extension",de:'Add-on-Datei exportieren',es:'Exportar archivo de complemento','pt-BR':'Exportar arquivo do complemento',
    ru:'Экспортировать файл дополнения',it:'Esporta file componente',pl:'Eksportuj plik dodatku',tr:'Eklenti dosyasını dışa aktar',
    ar:'تصدير ملف الإضافة',hi:'ऐड-ऑन फ़ाइल निर्यात करें',id:'Ekspor file add-on'
  },
  '一键安装到 Blender': {
    'zh-CN':'一键安装到 Blender','zh-TW':'一鍵安裝到 Blender',en:'Install to Blender',ja:'Blender にインストール',ko:'Blender에 설치',
    fr:'Installer dans Blender',de:'In Blender installieren',es:'Instalar en Blender','pt-BR':'Instalar no Blender',
    ru:'Установить в Blender',it:'Installa in Blender',pl:'Zainstaluj w Blenderze',tr:"Blender'a kur",
    ar:'التثبيت في بلندر',hi:'ब्लेंडर में इंस्टॉल करें',id:'Instal ke Blender'
  },
  '保存设置': {
    'zh-CN':'保存设置','zh-TW':'儲存設定',en:'Save settings',ja:'設定を保存',ko:'설정 저장',
    fr:'Enregistrer les paramètres',de:'Einstellungen speichern',es:'Guardar ajustes','pt-BR':'Salvar configurações',
    ru:'Сохранить настройки',it:'Salva impostazioni',pl:'Zapisz ustawienia',tr:'Ayarları kaydet',
    ar:'حفظ الإعدادات',hi:'सेटिंग्स सहेजें',id:'Simpan pengaturan'
  },
  '开机自动启动': {
    'zh-CN':'开机自动启动','zh-TW':'開機自動啟動',en:'Launch at startup',ja:'スタートアップで起動',ko:'시작 시 자동 실행',
    fr:'Lancer au démarrage',de:'Beim Start ausführen',es:'Iniciar al arrancar','pt-BR':'Iniciar com o sistema',
    ru:'Запускать при старте',it:'Avvia all\'avvio',pl:'Uruchamiaj przy starcie',tr:'Açılışta başlat',
    ar:'التشغيل عند بدء النظام',hi:'स्टार्टअप पर लॉन्च',id:'Jalankan saat mulai'
  },
  '通信端口': {
    'zh-CN':'通信端口','zh-TW':'通訊埠',en:'Port',ja:'通信ポート',ko:'통신 포트',
    fr:'Port',de:'Port',es:'Puerto','pt-BR':'Porta',ru:'Порт',
    it:'Porta',pl:'Port',tr:'Port',ar:'المنفذ',hi:'पोर्ट',id:'Port'
  },
  '备份目录': {
    'zh-CN':'备份目录','zh-TW':'備份目錄',en:'Backup folder',ja:'バックアップ先',ko:'백업 폴더',
    fr:'Dossier de sauvegarde',de:'Sicherungsordner',es:'Carpeta de copia','pt-BR':'Pasta de backup',
    ru:'Папка резервных копий',it:'Cartella di backup',pl:'Folder kopii',tr:'Yedek klasörü',
    ar:'مجلد النسخ الاحتياطي',hi:'बैकअप फ़ोल्डर',id:'Folder cadangan'
  },
  '打开备份目录': {
    'zh-CN':'打开备份目录','zh-TW':'開啟備份目錄',en:'Open backup folder',ja:'バックアップ先を開く',ko:'백업 폴더 열기',
    fr:'Ouvrir le dossier de sauvegarde',de:'Sicherungsordner öffnen',es:'Abrir carpeta de copia','pt-BR':'Abrir pasta de backup',
    ru:'Открыть папку копий',it:'Apri cartella di backup',pl:'Otwórz folder kopii',tr:'Yedek klasörünü aç',
    ar:'فتح مجلد النسخ الاحتياطي',hi:'बैकअप फ़ोल्डर खोलें',id:'Buka folder cadangan'
  },
  '外观': {
    'zh-CN':'外观','zh-TW':'外觀',en:'Appearance',ja:'外観',ko:'모양',
    fr:'Apparence',de:'Darstellung',es:'Apariencia','pt-BR':'Aparência',ru:'Внешний вид',
    it:'Aspetto',pl:'Wygląd',tr:'Görünüm',ar:'المظهر',hi:'रूप',id:'Tampilan'
  },
  '主题配色': {
    'zh-CN':'主题配色','zh-TW':'主題配色',en:'Theme',ja:'テーマ',ko:'테마',
    fr:'Thème',de:'Design',es:'Tema','pt-BR':'Tema',ru:'Тема',
    it:'Tema',pl:'Motyw',tr:'Tema',ar:'السمة',hi:'थीम',id:'Tema'
  },
  '界面语言': {
    'zh-CN':'界面语言','zh-TW':'介面語言',en:'Language',ja:'言語',ko:'언어',
    fr:'Langue',de:'Sprache',es:'Idioma','pt-BR':'Idioma',ru:'Язык',
    it:'Lingua',pl:'Język',tr:'Dil',ar:'اللغة',hi:'भाषा',id:'Bahasa'
  }
};

const THEMES = [
  { id: 'cyan',    name: '青碧', nameEn: 'Aqua' },
  { id: 'violet',  name: '幽紫', nameEn: 'Violet' },
  { id: 'amber',   name: '暖橙', nameEn: 'Amber' },
  { id: 'forest',  name: '松绿', nameEn: 'Forest' },
  { id: 'rose',    name: '玫红', nameEn: 'Rose' },
  { id: 'ocean',   name: '深海', nameEn: 'Ocean' },
  { id: 'graphite',name: '石墨', nameEn: 'Graphite' }
];

const i18n = (() => {
  let current = 'zh-CN';
  const originalText = new WeakMap(); // 记录原始中文文本，便于还原

  function t(key) {
    const entry = DICT[key];
    if (!entry) return key;
    return entry[current] || entry['zh-CN'] || key;
  }

  function walk(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach((node) => {
      const raw = node.nodeValue;
      const key = raw.trim();
      if (!key) return;
      if (!DICT[key]) return;
      if (!originalText.has(node)) originalText.set(node, raw);
      const lead = raw.match(/^\s*/)[0];
      const tail = raw.match(/\s*$/)[0];
      node.nodeValue = lead + t(key) + tail;
    });
    // 处理 placeholder / title 属性
    root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      el.getAttribute('data-i18n-attr').split(',').forEach((attr) => {
        const a = attr.trim();
        const v = el.getAttribute(a);
        if (!v) return;
        const key = v.trim();
        if (!DICT[key]) return;
        el.setAttribute(a, t(key));
      });
    });
  }

  function set(lang) {
    if (!LANGS.some((l) => l.code === lang)) return;
    current = lang;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    walk(document.body);
    document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang } }));
  }

  function get() { return current; }

  return { t, set, get, LANGS, THEMES };
})();

if (typeof window !== 'undefined') {
  window.i18n = i18n;
}
