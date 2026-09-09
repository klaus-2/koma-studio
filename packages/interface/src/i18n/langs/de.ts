import { TranslationCatalog } from '../messages';

export const deMessages: TranslationCatalog = {
  'app.restricted.title': 'Eingeschränkter Zugriff',
  'app.restricted.description':
    'Diese Version ist nur in der offiziellen Desktop-App verfügbar.',
  'app.restricted.publicDocs':
    'Rechtliche Dokumente bleiben öffentlich zugänglich:',
  'app.transition.loading': 'Wird geladen...',
  'app.transition.enterDashboard': 'Dashboard wird geöffnet...',
  'app.transition.updateSession': 'Sitzung wird aktualisiert...',
  'app.transition.openFeed': 'Scanlation-Feed wird geöffnet...',
  'app.transition.openRankings': 'Modell-Rankings werden geöffnet...',
  'app.transition.openSettings': 'Einstellungen werden geöffnet...',
  'app.session.validating': 'Sitzung wird überprüft...',
  'settings.tabs.general': 'Allgemein',
  'settings.tabs.presets': 'Vorlagen',
  'settings.tabs.integrations': 'Integrationen',
  'shortcutModal.title': 'Tastenkürzel-Center',
  'shortcutModal.subtitle':
    'Globale Tastenkürzel werden nur im Dashboard ausgelöst, niemals in Textfeldern.',
  'shortcutModal.hotkeyHint': 'H zum Öffnen',
  'shortcutModal.close': 'Schließen',
  'shortcutModal.instructionPrefix': 'Klicke auf ',
  'shortcutModal.instructionRecord': 'Aufnehmen',
  'shortcutModal.instructionSuffix':
    ' und drücke dann die gewünschte Tastenkombination. Konflikte werden automatisch erkannt.',
  'shortcutModal.searchPlaceholder':
    'Tastenkürzel, Aktionen oder Tasten suchen...',
  'shortcutModal.results_one': '{count} Ergebnis',
  'shortcutModal.results_other': '{count} Ergebnisse',
  'shortcutModal.recording': 'Aufnahme…',
  'shortcutModal.record': 'Aufnehmen',
  'shortcutModal.restoreDefault': 'Standard wiederherstellen',
  'shortcutModal.clearShortcut': 'Tastenkürzel entfernen',
  'shortcutModal.conflict': 'Konflikt: „{label}" ({combo})',
  'shortcutModal.fixedShortcuts': 'Feste kontextbezogene Tastenkürzel',
  'shortcutModal.fixed': 'Fest',
  'shortcutModal.noResults': 'Keine Tastenkürzel für „{query}" gefunden.',
  'shortcutModal.restoreAll': 'Alle wiederherstellen',
  'toolbar.modelSelect.label': 'Übersetzungsmodell',
  'toolbar.modelSelect.manage': 'Modelle verwalten',
  'toolbar.modelSelect.select': 'Modell auswählen',
  'toolbar.modelSelect.groupLocal': '── Lokale Modelle (installiert) ──',
  'toolbar.modelSelect.groupCloud': '── Cloud/API/KI ──',
  'toolbar.modelSelect.localPrefix': '[Lokal]',
  'toolbar.modelSelect.cloudPrefix': '[Cloud]',
  'toolbar.modelSelect.updateAvailable': '(Update verfügbar)',
  'toolbar.modelSelect.installedCount_one': '{count} Modell installiert',
  'toolbar.modelSelect.installedCount_other': '{count} Modelle installiert',
  'toolbar.modelSelect.updates_one': '{count} ausstehendes Update',
  'toolbar.modelSelect.updates_other': '{count} ausstehende Updates',
  'toolbar.modelSelect.noUpdates': 'Keine ausstehenden Updates',
  'toolbar.modelSelect.emptyState':
    'Keine kompatiblen Modelle für {source} → {target}.',
  'toolbar.modelSelect.incompatibleWarning':
    '„{model}" unterstützt {source} → {target} nicht. Wähle ein kompatibles Modell oder ändere die Zielsprache.',
  'settings.tabs.app': 'Anwendung',
  'settings.backToDashboard': 'Zurück zum Dashboard',
  'settings.stats.version': 'Version',
  'settings.app.updater.status.idle': 'Bereit',
  'settings.app.updater.status.checking': 'Wird geprüft…',
  'settings.app.updater.status.available': 'Update verfügbar',
  'settings.app.updater.status.notAvailable': 'Auf dem neuesten Stand',
  'settings.app.updater.status.downloading': 'Wird heruntergeladen…',
  'settings.app.updater.status.downloaded': 'Bereit zur Installation',
  'settings.app.updater.status.error': 'Fehler',
  'settings.app.updater.channel.stable': 'Stabil (Empfohlen)',
  'settings.app.updater.channel.beta': 'Beta (Frühe Funktionen)',
  'settings.app.updater.channel.canary': 'Canary (Instabil)',
  'settings.app.updater.version': 'Version',
  'settings.app.updater.build': 'Build',
  'settings.app.updater.releaseNotes': 'Versionshinweise',
  'settings.app.updater.noNotes': 'Keine Hinweise für diese Version.',
  'settings.app.updater.checkNow': 'Jetzt nach Updates suchen',
  'settings.app.updater.installNow': 'Neu starten und aktualisieren',
  'settings.app.updater.desktopOnly': 'Nur in der Desktop-App verfügbar.',
  'settings.app.updater.autoCheck': 'Automatisch prüfen',
  'settings.app.updater.autoCheckDesc':
    'Beim Start nach neuen Versionen suchen.',
  'settings.app.updater.channel': 'Update-Kanal',
  'settings.app.updater.channelDesc': 'Stabile oder experimentelle Versionen.',
  'settings.app.fonts.title': 'Systemschriften',
  'settings.app.fonts.desc':
    'Schriften für den Typesetter und das Rendering verwalten.',
  'settings.app.fonts.systemCount': '{count} Schriften erkannt',
  'settings.app.fonts.customTitle': 'Benutzerdefinierte Schriften',
  'settings.app.fonts.import': '.ttf / .otf importieren',
  'settings.app.fonts.noCustom':
    'Keine benutzerdefinierten Schriften importiert.',
  'settings.app.fonts.importSuccess': 'Schrift {name} erfolgreich importiert.',
  'settings.app.fonts.importError': 'Schrift konnte nicht importiert werden.',
  'settings.app.fonts.deleteConfirm':
    'Möchtest du die Schrift {name} entfernen?',
  'settings.app.autosave.title': 'Automatisches Speichern des Arbeitsbereichs',
  'settings.app.autosave.desc':
    'Projektfortschritt automatisch lokal speichern.',
  'settings.app.autosave.enabled': 'Automatisches Speichern aktiviert',
  'settings.app.autosave.interval': 'Intervall (Minuten)',
  'settings.app.autosave.saveNow': 'Einstellungen speichern',
  'settings.app.autosave.success':
    'Einstellungen für automatisches Speichern aktualisiert.',
  'settings.app.autosave.error':
    'Einstellungen konnten nicht gespeichert werden.',
  'settings.app.reset.title': 'Gefahrenzone',
  'settings.app.reset.desc':
    'Lokale Daten löschen und Standardeinstellungen wiederherstellen.',
  'settings.app.reset.button': 'Anwendung zurücksetzen',
  'settings.app.reset.confirm':
    'Dadurch wirst du abgemeldet und alle lokalen Vorlagen und Caches werden gelöscht. Möchtest du fortfahren?',
  'settings.app.reset.success':
    'Anwendung zurückgesetzt. Wird neu gestartet...',
  'settings.general.profile.title': 'Profil',
  'settings.general.profile.desc':
    'Deine Kontoinformationen und globalen Einstellungen.',
  'settings.general.profile.name': 'Anzeigename',
  'settings.general.profile.email': 'Primäre E-Mail',
  'settings.general.profile.verified': 'E-Mail bestätigt',
  'settings.general.profile.unverified': 'E-Mail ausstehend',
  'settings.general.profile.verifyBtn': 'Jetzt bestätigen',
  'settings.general.profile.sending': 'Wird gesendet...',
  'settings.general.profile.verifySuccess': 'Bestätigungs-E-Mail gesendet.',
  'settings.general.profile.verifyError':
    'E-Mail konnte nicht gesendet werden.',
  'settings.general.profile.save': 'Profil speichern',
  'settings.general.profile.success': 'Profil erfolgreich aktualisiert.',
  'settings.general.profile.error': 'Profil konnte nicht aktualisiert werden.',
  'settings.general.travel.title': 'Reise-Token',
  'settings.general.travel.desc':
    'Greife auf dein Studio-Konto auf anderen Geräten zu, ohne dich abzumelden.',
  'settings.general.travel.active': 'Aktiver Token',
  'settings.general.travel.inactive': 'Kein aktiver Token',
  'settings.general.travel.generate': 'Neuen Token generieren',
  'settings.general.travel.generateDesc': 'Gültig für {days} Tage.',
  'settings.general.travel.copyAria': 'Token kopieren',
  'settings.general.travel.revoke': 'Alle widerrufen',
  'settings.general.travel.revoked': 'Tokens widerrufen.',
  'settings.general.travel.success': 'Token erfolgreich generiert.',
  'settings.general.travel.error': 'Token konnte nicht verarbeitet werden.',
  'settings.general.language.title': 'Benutzeroberfläche',
  'settings.general.language.desc': 'App-Sprache und Design.',
  'settings.general.language.label': 'Sprache',
  'settings.general.language.system': 'Systemeinstellung übernehmen',
  'settings.general.theme.label': 'Design',
  'settings.general.theme.dark': 'Dunkel (Standard)',
  'settings.general.theme.light': 'Hell',
  'settings.general.theme.amoled': 'OLED / Schwarz',
  'settings.presets.aio.title': 'AIO-Vorlagen',
  'settings.presets.aio.desc':
    'Standardmodelle für jede Phase und Sprache konfigurieren.',
  'settings.presets.aio.active': 'Aktive Vorlage für {lang}',
  'settings.presets.aio.none': 'Keine Vorlagen konfiguriert.',
  'settings.presets.aio.create': 'Neue Vorlage',
  'settings.presets.aio.edit': 'Vorlage bearbeiten',
  'settings.presets.aio.delete': 'Vorlage entfernen',
  'settings.presets.aio.name': 'Name der Vorlage',
  'settings.presets.aio.lang': 'Quellsprache',
  'settings.presets.aio.models': 'Modellkonfiguration',
  'settings.presets.aio.save': 'Vorlage speichern',
  'settings.presets.aio.success': 'Vorlage erfolgreich gespeichert.',
  'settings.presets.aio.error': 'Vorlage konnte nicht gespeichert werden.',
  'settings.presets.typo.title': 'Typesetter-Vorlagen',
  'settings.presets.typo.desc':
    'Vorkonfigurierte Schriftstile, Farben und Sprechblasen.',
  'settings.presets.render.title': 'Rendering-Stile',
  'settings.presets.render.desc':
    'Konfiguriere, wie Text auf dem finalen Bild dargestellt wird.',
  'settings.integrations.discord.title': 'Discord-Webhook',
  'settings.integrations.discord.desc':
    'Automatische Benachrichtigungen für deinen Server.',
  'settings.integrations.discord.url': 'Webhook-URL',
  'settings.integrations.discord.test': 'Verbindung testen',
  'settings.integrations.discord.events': 'Auslösende Ereignisse',
  'settings.integrations.discord.success':
    'Konfiguration gespeichert und Test gesendet.',
  'settings.integrations.discord.error':
    'Webhook konnte nicht gespeichert oder getestet werden.',
  'settings.integrations.discord.invalidUrl': 'Ungültige Webhook-URL.',
  'settings.integrations.blogger.successSecure':
    'Blogger-Konfiguration im sicheren Desktop-Speicher gespeichert.',
  'settings.integrations.blogger.successLocal':
    'Blogger-Konfiguration lokal gespeichert.',
  'settings.integrations.blogger.saveError':
    'Blogger-Konfiguration konnte nicht gespeichert werden.',
  'settings.integrations.blogger.testError':
    'Blogger-Verbindung konnte nicht überprüft werden.',
  'settings.integrations.imgur.successSecure':
    'Imgur-Konfiguration im sicheren Desktop-Speicher gespeichert.',
  'settings.integrations.imgur.successLocal':
    'Imgur-Konfiguration lokal gespeichert.',
  'settings.integrations.imgur.saveError':
    'Imgur-Konfiguration konnte nicht gespeichert werden.',
  'settings.travel.blocked.notDesktop':
    'Nur in der authentifizierten Desktop-App verfügbar.',
  'settings.travel.blocked.noEmail':
    'E-Mail-Versand ist in dieser Umgebung nicht konfiguriert.',
  'settings.travel.blocked.validating': 'E-Mail-Konfiguration wird überprüft…',
  'settings.integrations.blogger.title': 'Blogger-CDN',
  'settings.integrations.blogger.desc':
    'Bild-Hosting und direkte Veröffentlichung.',
  'settings.integrations.imgur.desc': 'Client-ID-Rotation für anonyme Uploads.',
  'settings.theme.title': 'Erscheinungsbild',
  'settings.theme.description':
    'Wähle zwischen dem dunklen und hellen Modus für die Benutzeroberfläche.',
  'settings.theme.dark': 'Dunkel',
  'settings.theme.darkDesc': 'Standard-Dunkeldesign',
  'settings.theme.light': 'Hell',
  'settings.theme.lightDesc': 'Helles Design',
  'settings.language.title': 'Sprache der Benutzeroberfläche',
  'settings.language.description':
    'Wähle die App-Sprache. Auf dem Desktop wird die Sprache deines Systems bei der Ersteinrichtung automatisch erkannt.',
  'settings.language.label': 'Sprache',
  'settings.language.systemLabel': 'Systemerkennung',
  'settings.language.applied':
    'Änderungen werden sofort übernommen und auf diesem Gerät für Entwicklungs- und gepackte Builds gespeichert.',
  'auth.tabs.login': 'Anmelden',
  'auth.tabs.register': 'Konto erstellen',
  'auth.legal.reviewDocs':
    'Bevor du fortfährst, lies bitte unsere rechtlichen Dokumente:',
  'auth.quote.line1': 'Jede großartige Geschichte',
  'auth.quote.line2': 'beginnt mit',
  'auth.quote.line3': 'einer einzelnen Seite.',
  'auth.stats.activeScanlators': 'Aktive Nutzer',
  'auth.stats.tools': 'Werkzeuge',
  'auth.stats.pagesProcessed': 'Verarbeitete Seiten',
  'auth.toolkit.ai': 'KI & Automatisierung',
  'auth.toolkit.tools': 'Werkzeuge',
  'auth.toolkit.learning': 'Lernen',
  'auth.toolkit.aiTranslation': 'KI-Übersetzung',
  'auth.toolkit.autoRedraw': 'Automatisches Neuzeichnen',
  'auth.toolkit.advancedEditor': 'Erweiterter Editor',
  'auth.toolkit.proTypesetting': 'Profi-Typesetting',
  'auth.toolkit.qualityControl': 'Qualitätskontrolle',
  'auth.toolkit.guides': 'Anleitungen & Tutorials',
  'auth.toolkit.resources': 'Ressourcen & Assets',
  'auth.community.join': 'Tritt der Community bei',
  'auth.cover.popular': 'BELIEBT',
  'auth.cover.new': 'NEU',
  'auth.cover.cleanRedraw': 'Bereinigen + Neuzeichnen',
  'auth.cover.translation': 'Übersetzung',
  'auth.cover.typography': 'Typografie',
  'auth.cover.fullEditing': 'Vollständige Bearbeitung',
  'auth.cover.allInOne': 'AIO – Alles in Einem',
  'auth.cover.finalQc': 'Bereinigung',
  'login.subtitle.credentials':
    'Melde dich bei deinem Konto an und mach dort weiter, wo du aufgehört hast.',
  'login.subtitle.travel':
    'Autorisiere diesen Computer vorübergehend, ohne den Anmeldevorgang zu verlassen.',
  'login.error.completeCaptchaTravel':
    'Schließe das Captcha ab, um die Autorisierung dieses Computers abzuschließen.',
  'login.error.completeCaptcha': 'Schließe das Captcha ab, um fortzufahren.',
  'login.error.missingCredentials':
    'Gehe zurück und gib die Konto-E-Mail und das Passwort ein, bevor du diesen Computer autorisierst.',
  'login.error.missingTravelToken':
    'Gib den per E-Mail erhaltenen Token ein, um die Anmeldung abzuschließen.',
  'login.error.generic': 'Anmeldung fehlgeschlagen',
  'login.warning.mandatoryUpdateTitle': 'Pflichtupdate verfügbar',
  'login.warning.mandatoryUpdateBody':
    'Installiere Version {version}, um die App weiterhin nutzen zu können.',
  'login.warning.downloadUpdate': 'Update herunterladen',
  'login.warning.downloadingUpdate': 'Update wird heruntergeladen...',
  'login.warning.installUpdateNow': 'Update jetzt installieren',
  'login.verification.title': 'Was zu tun ist',
  'login.verification.wait': 'Warte {seconds} Sekunden.',
  'login.verification.retrySameDevice':
    'Versuche, dich erneut vom selben Gerät oder Netzwerk aus anzumelden.',
  'login.verification.avoidVpn':
    'Vermeide es, während dieses Zeitraums VPNs oder Netzwerke zu wechseln.',
  'login.email': 'E-Mail',
  'login.password': 'Passwort',
  'login.forgotPassword': 'Passwort vergessen',
  'login.rememberMe': 'Auf diesem Gerät angemeldet bleiben',
  'login.travel.eyebrow': 'Sicherheitsprüfung',
  'login.travel.title':
    'Dieser Computer benötigt eine vorübergehende Autorisierung',
  'login.travel.copy':
    'Öffne KŌMA Studio auf deinem Haupt-PC und gehe zu Einstellungen > Reise-Zugang, um den Code zu senden und diese Anmeldung abzuschließen.',
  'login.travel.accountInUse': 'Verwendetes Konto: {email}',
  'login.travel.sameAccount':
    'Verwende dasselbe Konto, das bereits auf deinem Haupt-PC geöffnet ist.',
  'login.travel.emailDisabled':
    'E-Mail-Versand ist in dieser Umgebung nicht konfiguriert.',
  'login.travel.emailEnabled':
    'Der Code wird an die primäre E-Mail-Adresse des Kontos gesendet.',
  'login.travel.step1': 'Öffne die App auf deinem Hauptcomputer.',
  'login.travel.step2': 'Sende den Token an die Konto-E-Mail.',
  'login.travel.step3':
    'Füge den Code unten ein, um diesen Computer zu autorisieren.',
  'login.travel.tokenLabel': 'Reise-Token',
  'login.travel.tokenPlaceholder': 'Per E-Mail erhaltenen Code einfügen',
  'login.button.authorizing': 'Wird autorisiert...',
  'login.button.validating': 'Wird überprüft...',
  'login.button.updateRequired': 'App aktualisieren, um sich anzumelden',
  'login.button.retryIn': 'Erneut versuchen in {seconds}s',
  'login.button.authorizeComputer': 'Diesen Computer autorisieren',
  'login.button.login': 'Bei meinem Konto anmelden',
  'login.button.changeAccount': 'Zurück und Konto wechseln',
  'login.emailPlaceholder': 'du@email.com',
  'login.passwordPlaceholder': '•••••••��',
  'login.warning.latestVersion': 'aktuell',
  'login.newHere': 'Neu hier?',
  'login.createFreeAccount': 'Erstelle dein kostenloses Konto',
  'register.subtitle':
    'Erstelle dein Konto und beginne, Tausende von Titeln zu entdecken.',
  'register.error.passwordMismatch': 'Passwörter stimmen nicht überein.',
  'register.error.completeCaptcha':
    'Schließe das Captcha ab, um die Registrierung abzuschließen.',
  'register.error.acceptTerms':
    'Du musst die Nutzungsbedingungen und die Datenschutzerklärung akzeptieren, um ein Konto zu erstellen.',
  'register.error.generic': 'Registrierung fehlgeschlagen',
  'register.displayName': 'Anzeigename',
  'register.displayNamePlaceholder': 'Wie sollen wir dich nennen?',
  'register.password': 'Passwort',
  'register.passwordPlaceholder': 'Mindestens 8 Zeichen',
  'register.confirmPassword': 'Passwort bestätigen',
  'register.confirmPasswordPlaceholder': 'Passwort erneut eingeben',
  'register.legalPrefix': 'Ich habe gelesen und akzeptiere die',
  'register.legalSuffix':
    'Ich verstehe, dass bei der Registrierung ausschließlich technisch notwendige Cookies verwendet werden und dass Funktionen wie Fehlerberichte und Integrationen durch die oben genannten Dokumente geregelt sind.',
  'register.button.creating': 'Konto wird erstellt...',
  'register.button.loginNow': 'Jetzt anmelden',
  'legal.links.terms': 'Nutzungsbedingungen',
  'legal.links.privacy': 'Datenschutzerklärung',
  'legal.links.cookies': 'Cookie-Richtlinie',
  'legal.links.content': 'Inhaltshinweise',
  'transition.tips.loading': '読み込み中...',
  'transition.tips.preparing': 'Dein Studio wird vorbereitet...',
  'transition.tips.opening': 'Dein Arbeitsbereich wird geöffnet...',
  'transition.tips.organizing': 'Deine Panels werden organisiert...',
  'transition.tips.warming': 'Die Werkzeuge werden aufgewärmt...',
  'transition.tips.workflow': 'Dein Workflow wird geladen...',
  'transition.ariaLabel': 'Seite wird geladen',
  'ranking.discover.title': 'Sei der Erste, der bewertet',
  'ranking.discover.subtitle':
    'Offizielle Modelle ohne Bewertungen unter dem aktuellen Filter.',
  'ranking.discover.available': '{count} verfügbar',
  'ranking.discover.empty':
    'Alle gefilterten Modelle haben bereits Bewertungen.',
  'ranking.discover.local': 'Lokal',
  'ranking.discover.cloud': 'Cloud',
  'legalHub.version': 'Version',
  'legalHub.updatedAt': 'Aktualisiert am',
  'register.button.create': 'Mein Konto erstellen',
  'register.alreadyHaveAccount': 'Bereits ein Konto?',
  'password.rule.minLength': 'Mindestens 8 Zeichen',
  'password.rule.uppercase': 'Großbuchstabe',
  'password.rule.lowercase': 'Kleinbuchstabe',
  'password.rule.number': 'Zahl',
  'password.rule.special': 'Sonderzeichen',
  'password.level.veryWeak': 'Sehr schwach',
  'password.level.weak': 'Schwach',
  'password.level.fair': 'Ausreichend',
  'password.level.good': 'Gut',
  'password.level.strong': 'Stark',
  'captcha.loadError': 'Turnstile-Skript konnte nicht geladen werden',
  'captcha.missingSiteKey':
    'Captcha aktiviert, aber VITE_TURNSTILE_SITE_KEY ist nicht konfiguriert.',
  'captcha.initError': 'Captcha konnte nicht initialisiert werden',
  'captcha.securityCheck': 'Sicherheitsprüfung',
  'captcha.loadScriptError': 'Turnstile-Skript konnte nicht geladen werden',
  'captcha.success': 'Captcha erfolgreich überprüft.',
  'forgot.title': 'Passwort wiederherstellen',
  'forgot.subtitle':
    'Gib deine E-Mail-Adresse ein, um einen Link zur Passwortzurücksetzung zu erhalten.',
  'forgot.success':
    'Falls ein Konto mit dieser E-Mail existiert, erhältst du Anweisungen zum Zurücksetzen deines Passworts.',
  'forgot.error': 'Passwortzurücksetzung konnte nicht angefordert werden',
  'forgot.button.sending': 'Wird gesendet...',
  'forgot.button.send': 'Link zum Zurücksetzen senden',
  'forgot.remembered': 'Erinnerst du dich an dein Passwort?',
  'forgot.backToLogin': 'Zurück zur Anmeldung',
  'reset.title': 'Neues Passwort',
  'reset.subtitle': 'Lege ein sicheres Passwort für dein Konto fest.',
  'reset.error.missingToken':
    'Der Zurücksetzungs-Token fehlt oder ist ungültig.',
  'reset.error.generic': 'Passwort konnte nicht zurückgesetzt werden',
  'reset.success':
    'Passwort erfolgreich zurückgesetzt. Du kannst dich jetzt anmelden.',
  'reset.newPassword': 'Neues Passwort',
  'reset.button.submitting': 'Wird zurückgesetzt...',
  'reset.button.submit': 'Passwort zurücksetzen',
  'verify.title': 'E-Mail-Bestätigung',
  'verify.subtitle.pending':
    'Bestätige deine E-Mail, um alle Funktionen freizuschalten.',
  'verify.subtitle.done': 'Deine E-Mail ist bereits bestätigt.',
  'verify.noEmail': 'keine-E-Mail',
  'verify.verified': 'Bestätigt',
  'verify.success': 'Bestätigungs-E-Mail gesendet. Prüfe deinen Posteingang.',
  'verify.error': 'E-Mail konnte nicht gesendet werden',
  'verify.button.sending': 'Wird gesendet...',
  'verify.button.resend': 'Bestätigungs-E-Mail erneut senden',
  'verify.button.alreadyConfirmed': 'E-Mail bereits bestätigt',
  'verify.button.backDashboard': 'Zurück zum Dashboard',
  'confirm.title.verifying': 'E-Mail wird bestätigt...',
  'confirm.title.success': 'E-Mail bestätigt!',
  'confirm.title.error': 'Bestätigung fehlgeschlagen',
  'confirm.subtitle.verifying': 'Wir überprüfen deinen Bestätigungslink.',
  'confirm.subtitle.success':
    'Deine E-Mail wurde bestätigt. Du kannst jetzt alle Funktionen nutzen.',
  'confirm.subtitle.error':
    'Der Bestätigungslink ist ungültig oder abgelaufen. Bitte fordere eine neue E-Mail an.',
  'confirm.status.wait': 'Bitte warte, während wir überprüfen...',
  'confirm.errorCode': 'Fehlercode:',
  'confirm.success': 'Bestätigung erfolgreich abgeschlossen.',
  'confirm.goDashboard': 'Zum Dashboard',
  'confirm.goLogin': 'Zur Anmeldung',
  'banned.title': 'Zugriff gesperrt',
  'banned.subtitle': 'Dieser Zugriff wurde durch die App-Moderation gesperrt.',
  'banned.reason': 'Grund',
  'banned.scope': 'Umfang',
  'banned.duration': 'Dauer',
  'banned.until': 'Vorübergehend bis {value}',
  'banned.undefinedDate': 'unbestimmtes Datum',
  'banned.permanent': 'Dauerhaft',
  'banned.policy':
    'Links, schädliche Beiträge oder missbräuchliches Verhalten können zu einer dauerhaften Sperrung der App führen.',
  'banned.backToLogin': 'Zurück zur Anmeldung',
  'session.expiresIn':
    'Deine Sitzung läuft in {seconds}s wegen Inaktivität ab.',
  'session.stayConnected': 'Verbunden bleiben',
  'update.toast.availableTitle': 'Neues Update verfügbar',
  'update.toast.availableDescription':
    'Version {version} steht auf dem Kanal {channel} zum Download bereit.',
  'update.toast.downloadedTitle': 'Update bereit',
  'update.toast.downloadedDescription':
    'Update bereit. {percent}% abgeschlossen. Jetzt installieren oder beim Schließen der App.',
  'update.toast.downloadingTitle': 'Update wird heruntergeladen',
  'update.toast.downloadingDescription': '{percent}% abgeschlossen.',
  'update.toast.closeAria': 'Update-Banner schließen',
  'update.channel.beta': 'Beta',
  'update.channel.stable': 'Stabil',
  'update.button.download': 'Herunterladen',
  'update.button.details': 'Details',
  'update.button.installNow': 'Jetzt installieren',
  'update.button.installLater': 'Später installieren',
  'update.progress.title': 'Update wird heruntergeladen...',
  'update.modal.title': 'Update verfügbar',
  'update.modal.unknownVersion': 'unbekannt',
  'update.modal.closeAria': 'Dialog schließen',
  'update.modal.mandatory':
    'Dieses Update ist erforderlich. Lade es herunter und installiere es, um die App weiterhin nutzen zu können.',
  'update.modal.releaseNotes': 'Versionshinweise',
  'update.modal.releaseNotesEmpty':
    'Keine Versionshinweise für diese Version verfügbar.',
  'update.modal.readyProgress': 'Update bereit. 100% abgeschlossen.',
  'update.modal.downloadingProgress': 'Update wird heruntergeladen...',
  'update.modal.readyToInstall': 'Bereit zur Installation',
  'update.modal.installHintAuto':
    'Wenn du die App jetzt schließt, wird die Installation automatisch gestartet.',
  'update.modal.installHintManual':
    'Installation beim Schließen wurde deaktiviert. Verwende „Später installieren", um es zu aktivieren und sicher zu schließen.',
  'update.modal.downloadAction': 'Update herunterladen',
  'update.modal.downloadingAction': 'Wird heruntergeladen...',
  'update.modal.installAction': 'Jetzt installieren',
  'update.modal.installLaterAction': 'Später installieren (beim Schließen)',
  'update.modal.laterAction': 'Später',
  'dropzone.invalidImageAlert':
    'Bitte lade eine gültige Bilddatei hoch (PNG/JPG).',
  'dropzone.clickOrDrag': 'Klicke oder ziehe das Bild hierher',
  'dropzone.supports': 'Unterstützt PNG und JPG',
  'actionButtons.cleaning': 'Wird bereinigt...',
  'actionButtons.cleanImage': 'Bild bereinigen',
  'actionButtons.downloadResult': 'Ergebnis herunterladen',
  'aio.model.manage': 'Modelle',
  'aio.model.noneAvailable': 'Keine Modelle verfügbar',
  'aio.model.device': 'Gerät',
  'aio.model.languages': 'Sprachen',
  'aio.model.languages.multi': 'multi',
  'aio.model.noDescription': 'Keine Beschreibung.',
  'aio.model.localStatus': 'Lokaler Status: {value}',
  'aio.stage.detectText': 'Text erkennen',
  'aio.stage.recognizeText': 'Text lesen',
  'aio.stage.getTranslations': 'Übersetzungen abrufen',
  'aio.stage.segmentText': 'Text segmentieren',
  'aio.stage.cleanImage': 'Bild bereinigen',
  'aio.stage.tabsBarAria': 'Phasenkonfiguration',
  'aio.render.title': 'Gerenderter Text',
  'aio.render.description.manual':
    'Doppelklicke auf eine Box, um inline zu bearbeiten. Das kontextbezogene Dock erscheint nahe der Auswahl mit dem gerenderten Text.',
  'aio.render.description.auto':
    'Der automatische Modus wendet Standard-Rendering auf übersetzte Bereiche an.',
  'aio.render.activePage':
    'Aktive Seite: {count} Block/Blöcke. Ausgewählt: {selected}.',
  'aio.render.contextualDock.visible': 'bei Auswahl sichtbar',
  'aio.render.contextualDock.doubleClick':
    'Doppelklick, um die Bearbeitung zu starten und das Dock anzuzeigen',
  'aio.render.contextualDock.select':
    'Wähle eine Box, um das Dock zu verwenden',
  'aio.render.contextualDock': 'Kontextbezogenes Dock: {value}',
  'aio.render.shortcut':
    'Tipp: Verwende Umschalt + Scrollen in der Vorschau, um den Text der ausgewählten Box zu drehen.',
  'aio.render.inactiveStage':
    'Dieses Bild befindet sich in einer Phase vor dem Rendering. Verwende „Vorwärts", um den gerenderten Text anzuzeigen/bearbeiten.',
  'aio.render.fontCatalog': 'Schriftenkatalog',
  'aio.render.refreshFonts': 'Schriften aktualisieren',
  'aio.render.refreshingFonts': 'Wird aktualisiert...',
  'aio.render.importFont': 'Schrift importieren',
  'aio.render.importingFont': 'Wird importiert...',
  'aio.render.importFontTitleDesktop':
    'Benutzerdefinierte Schrift in die Desktop-App importieren',
  'aio.render.importFontTitleBrowser':
    'Import ist nur in der Desktop-App verfügbar',
  'aio.render.desktopFontsHint':
    'Installierte Windows-Schriften und benutzerdefinierte Importe sind in der Desktop-App verfügbar.',
  'aio.render.overlayControlsHint':
    'Schrift-, Größen-, Ausrichtungs- und Farbsteuerungen befinden sich jetzt im kontextbezogenen Overlay-Dock.',
  'aio.render.applyStyleAll': 'Aktuellen Stil auf alle Auswahlen anwenden',
  'aio.render.applyStyleAllTitle':
    'Den aktuellen Auswahlstil auf alle Auswahlen in allen Bildern anwenden',
  'aio.region.title': 'Erkannte Bereiche',
  'aio.region.description.manual':
    'Ziehe in der Vorschau, um neue Bereiche hinzuzufügen. Ziehe eine Box, um sie zu verschieben, und verwende die Ecken zum Ändern der Größe.',
  'aio.region.description.auto':
    'Wechsle in den manuellen Modus, um erkannte Boxen anzupassen.',
  'aio.region.activePage':
    'Aktive Seite: {count} Bereich(e). Ausgewählt: {selected}.',
  'aio.region.ocr': 'OCR des ausgewählten Bereichs: {value}',
  'aio.region.translation': 'Übersetzung des ausgewählten Bereichs: {value}',
  'aio.region.notes': 'Notizen des ausgewählten Bereichs: {value}',
  'aio.region.segmentation': 'Segmentierung des ausgewählten Bereichs: {value}',
  'aio.region.noSelection': 'keine',
  'aio.region.noRecognizedText': 'kein erkannter Text',
  'aio.region.ocrDisabled': 'OCR-Phase deaktiviert',
  'aio.region.noTranslation': 'keine Übersetzung verfügbar',
  'aio.region.translationDisabled': 'Übersetzungsphase deaktiviert',
  'aio.region.noNotes': 'keine Notizen verfügbar',
  'aio.region.notesDisabled': 'Notizen deaktiviert',
  'aio.region.noSelectedRegion': 'kein Bereich ausgewählt',
  'aio.region.segmentedBoxes': '{count} segmentierte Box(en)',
  'aio.region.removeSelected': 'Ausgewählte entfernen',
  'aio.region.duplicateSelected': 'Ausgewählte duplizieren',
  'aio.manual.toolsHintPrimary':
    'Verwende das schwebende Dock auf der Leinwand für Bereich auswählen, Seite bereinigen und Segmentierung/manuell bearbeiten.',
  'aio.manual.toolsHintSecondary':
    'Werkzeuge werden automatisch basierend auf der aktiven Phase des Bildes aktiviert.',
  'aio.run.manualNoActive':
    'Wähle ein aktives Bild aus, um die manuelle Phase auszuführen.',
  'aio.run.manualCurrentOnly':
    'Nur die aktuelle Phase für das ausgewählte Bild ausführen.',
  'aio.run.processing': 'Wird ausgeführt {percent}%',
  'aio.run.rerunCurrent': 'Aktuelle Phase erneut ausführen (aktives Bild)',
  'aio.run.runCurrent': 'Aktuelle Phase ausführen (aktives Bild)',
  'aio.run.full':
    'AIO ausführen (Erkennen + OCR + Übersetzen + Segmentieren + Bereinigen + Rendern)',
  'aio.pipeline.textModeTitle': 'Textmodus',
  'aio.pipeline.textModeDescription':
    'Lege fest, wie der ausgewählte Bereich beim Rendering behandelt werden soll. AUTO verwendet die erkannte Klassifizierung.',
  'aio.pipeline.currentSelectionMode': 'Aktueller Auswahlmodus',
  'aio.pipeline.currentSelectionModeAria': 'Textmodus der aktuellen Auswahl',
  'aio.pipeline.autoResolved': 'AUTO wird aufgelöst zu {value}.',
  'aio.pipeline.currentMode': 'Aktueller Modus: {value}.',
  'aio.pipeline.selectPreviewBox':
    'Wähle eine Box in der Vorschau, um den Textmodus zu ändern.',
  'aio.pipeline.title': 'AIO-Pipeline',
  'aio.pipeline.description.auto':
    'Konfiguriere die vollständige Pipeline (Erkennung, OCR, Übersetzung, Segmentierung und Bereinigung), bevor du den Stapel ausführst.',
  'aio.pipeline.description.manual':
    'Manueller Modus: Phasen für das ausgewählte Bild einzeln ausführen oder überspringen.',
  'aio.pipeline.render': 'Rendern',
  'aio.pipeline.renderSubtitle':
    'Übersetzten Text auf das finale Bild anwenden',
  'aio.pipeline.executeCurrentTitle':
    'Nur die aktuelle Phase für das ausgewählte Bild ausführen',
  'aio.pipeline.executingStage': 'Phase wird ausgeführt...',
  'aio.pipeline.rerunStage': 'Phase erneut ausführen',
  'aio.pipeline.runStage': 'Phase ausführen',
  'aio.pipeline.skipStage': 'Phase überspringen',
  'aio.pipeline.skipStageTitle':
    'Die aktuelle Phase überspringen und die nächste freischalten',
  'aio.pipeline.rewind': 'Zurück',
  'aio.pipeline.rewindTitle': 'Zur vorherigen AIO-Pipeline-Phase zurückkehren',
  'aio.pipeline.forward': 'Vorwärts',
  'aio.pipeline.forwardTitle': 'Zur nächsten AIO-Pipeline-Phase vorrücken',
  'aio.pipeline.manualImageStatus': 'Manuell pro Bild: „{image}" bei {stage}.',
  'aio.pipeline.selectImageManual':
    'Wähle ein Bild, um den manuellen Phase-für-Phase-Ablauf zu starten.',
  'aio.pipeline.currentStage': 'Aktuelle Phase: {label} ({current}/{total}).',
  'aio.pipeline.runToEnable':
    'AIO ausführen, um das phasenweise Zurück/Vorwärts zu aktivieren.',
  'aio.pipeline.manualHint':
    'Mache den Prozess wesentlich zuverlässiger: Im manuellen Modus wird jede Phase, die du tatsächlich anpasst, mit mehr Kontrolle, Überprüfung und Präzision ausgeführt. Nur das ausgewählte Bild wird verarbeitet, und das Kontingent wird nur beim ersten manuellen Durchlauf jedes Bildes verbraucht (oder null, wenn es bereits den automatischen AIO-Durchlauf hatte).',
  'dashboard.enhance.profile.mangaScan': 'Manga-Scan',
  'dashboard.enhance.profile.animeArt': 'Anime-Kunst',
  'dashboard.enhance.profile.general': 'Allgemein',
  'dashboard.enhance.profile.highQuality4x': 'Hohe Qualität 4x',
  'dashboard.emptyTip.1':
    'Wenn ein Bild zu groß ist und du Fehler bei der Bereinigung, Übersetzung oder beim Neuzeichnen erhältst, versuche es in kleinere Teile aufzuteilen. Das stabilisiert in der Regel die Verarbeitung.',
  'dashboard.emptyTip.2':
    'Der automatische Modus beschleunigt den Workflow, aber für ein 100% ausgefeiltes Ergebnis lohnt es sich, im manuellen Modus zu überprüfen und die letzten Details zu korrigieren.',
  'dashboard.emptyTip.3':
    'Verwende das Verfeinerungswerkzeug, um Text sauberer, ausgewogener und auf Scanlation-Niveau zu bringen.',
  'dashboard.emptyTip.4':
    'Du kannst Sprechblasenformen zwischen rechteckig und elliptisch wechseln, um den Text besser an jede Seite anzupassen.',
  'dashboard.emptyTip.5':
    'Richte Vorlagen auf der Einstellungsseite ein, um wiederkehrende Aufgaben zu beschleunigen und Konsistenz über Kapitel hinweg zu gewährleisten.',
  'dashboard.emptyTip.6':
    'Probiere verschiedene Modelle pro Sprache aus. Das beste OCR- oder Übersetzungsmodell für Japanisch ist möglicherweise nicht ideal für Koreanisch, Chinesisch oder Englisch.',
  'dashboard.emptyTip.7':
    'Stimme für die Modelle ab, die deinen Workflow am meisten unterstützen. Das verbessert das Ranking und hilft anderen Nutzern bei ihrer Wahl.',
  'dashboard.emptyTip.8': 'Wenn Cloud-Übersetzung zu teuer oder instabil ist, passe deine Vorlagen an und halte ein lokales Fallback bereit, damit die Produktion nicht ins Stocken gerät.',
  'dashboard.emptyTip.9':
    'Verwende den visuellen Übersetzer, um bestimmte Bereiche zu überprüfen, ohne das gesamte Kapitel erneut durchlaufen zu müssen.',
  'dashboard.emptyTip.10':
    'Im Typesetter machen kleine manuelle Anpassungen an Ausrichtung, Schrift und Abstand einen großen Unterschied im Endergebnis.',
  'dashboard.emptyTip.11':
    'Wenn der Text zu eng wird, reduziere die Textmenge in der Box, verfeinere die Übersetzung oder passe die Sprechblase an, bevor du die Schriftgröße zu stark verkleinerst.',
  'dashboard.emptyTip.12':
    'Wenn die OCR-Ausgabe schlecht ist, probiere ein anderes Modell aus, bevor du alles von Hand korrigierst. Ein Modellwechsel löst oft die meisten Fehler.',
  'dashboard.emptyTip.13':
    'Verwende Übersetzungsanmerkungen nur, wenn sie wirklich einen Mehrwert für den Leser bieten. Weniger Rauschen sorgt für ein saubereres Leseerlebnis.',
  'dashboard.emptyTip.14':
    'Speichere benutzerdefinierte LLM- und OCR-Profile, um Konfigurationen schnell zu vergleichen, ohne für jeden Test alles neu einzurichten.',
  'dashboard.emptyTip.15':
    'Wenn eine Seite im AIO-Ablauf fehlschlägt, führe die Phasen einzeln in der Produktion aus, um genau zu finden, wo der Engpass liegt.',
  'dashboard.aio.progress.detectText': 'Text wird erkannt',
  'dashboard.aio.progress.recognizeText': 'Text wird gelesen',
  'dashboard.aio.progress.getTranslations': 'Text wird übersetzt',
  'dashboard.aio.progress.segmentText': 'Text wird segmentiert',
  'dashboard.aio.progress.cleanImage': 'Bild wird bereinigt',
  'dashboard.aio.progress.render': 'Rendering wird vorbereitet',
  'dashboard.aio.subtitle.detectText': 'Textbereiche im Bild lokalisieren',
  'dashboard.aio.subtitle.recognizeText': 'OCR zum Extrahieren des Textinhalts',
  'dashboard.aio.subtitle.getTranslations':
    'Automatische Übersetzung über den ausgewählten Dienst/das Modell',
  'dashboard.aio.subtitle.segmentText':
    'Bereiche mit Segmentierung verfeinern (Baka-Stil)',
  'dashboard.aio.subtitle.cleanImage':
    'Inpainting mit AOT/LaMa + Baka-Stil-Maske',
  'dashboard.aio.manualStatus.locked': 'Gesperrt',
  'dashboard.aio.manualStatus.pending': 'Ausstehend',
  'dashboard.aio.manualStatus.done': 'Erledigt',
  'dashboard.aio.manualStatus.skipped': 'Übersprungen',
  'dashboard.mode.underDevelopment': 'Noch in Entwicklung.',
  'dashboard.nav.group.main': 'Hauptbereich',
  'dashboard.nav.group.production': 'Produktion',
  'dashboard.nav.group.utils': 'Hilfsmittel',
  'dashboard.nav.group.info': 'Informationen',
  'dashboard.nav.short.aio': 'AIO',
  'dashboard.nav.short.cleaner': 'Cleaner/RD',
  'dashboard.nav.short.enhance': 'Verbessern',
  'dashboard.nav.subtitle.organize': 'Dateien verwalten',
  'dashboard.nav.subtitle.aio': 'Alles in Einem',
  'dashboard.nav.subtitle.cleaner': 'Cleaner & Redrawer',
  'dashboard.nav.subtitle.typesetter': 'Typesetter',
  'dashboard.nav.subtitle.translator': 'Übersetzer',
  'dashboard.nav.subtitle.raw': 'Raw-Anbieter',
  'dashboard.nav.subtitle.proofreader': 'Korrekturleser & QC',
  'dashboard.nav.subtitle.stitch': 'Zusammenfügen',
  'dashboard.nav.subtitle.split': 'Teilen',
  'dashboard.nav.subtitle.watermark': 'Wasserzeichen',
  'dashboard.nav.subtitle.enhance': 'Bildverbesserung',
  'dashboard.nav.subtitle.optimizer': 'Kapitel-Optimierer',
  'dashboard.nav.subtitle.blogger': 'Veröffentlichen & Hosting',
  'dashboard.nav.subtitle.imgur': 'Anonymes Hosting',
  'dashboard.nav.subtitle.guides': 'Anleitungen',
  'dashboard.nav.subtitle.resources': 'Ressourcen',
  'dashboard.nav.tooltip.organize':
    'Bilder vor der Verarbeitung organisieren und neu ordnen',
  'dashboard.nav.tooltip.aio':
    'Vollständige Pipeline: Erkennen, Lesen, Übersetzen, Segmentieren, Bereinigen und Rendern',
  'dashboard.nav.tooltip.cleaner':
    'Sprechblasen bereinigen und Bildbereiche neuzeichnen',
  'dashboard.nav.tooltip.typesetter':
    'Typografie und Textstile auf Seiten anwenden',
  'dashboard.nav.tooltip.translator':
    'Freitext übersetzen oder OCR/Übersetzung nach Bildbereichen überprüfen',
  'dashboard.nav.tooltip.raw':
    'Raw-Bilder für die Pipeline verwalten und bereitstellen',
  'dashboard.nav.tooltip.proofreader':
    'Übersetzungen überprüfen und Endqualität sicherstellen',
  'dashboard.nav.tooltip.stitch':
    'Mehrere Bilder zu einem durchgehenden Streifen zusammenfügen',
  'dashboard.nav.tooltip.split': 'Lange Bilder in kleinere Teile aufteilen',
  'dashboard.nav.tooltip.watermark':
    'Wasserzeichen stapelweise auf Bilder anwenden',
  'dashboard.nav.tooltip.enhance': 'Bildqualität und Auflösung verbessern',
  'dashboard.nav.tooltip.optimizer':
    'Endausgaben für Web, Lesen oder Archivierung optimieren',
  'dashboard.nav.tooltip.blogger':
    'Beiträge auf Blogger veröffentlichen und gehostete Bild-URLs generieren',
  'dashboard.nav.tooltip.imgur':
    'Bilder mit Client-ID-Rotation auf Imgur hochladen',
  'dashboard.nav.tooltip.guides':
    'Anleitungen und Tutorials zur Werkzeugnutzung',
  'dashboard.nav.tooltip.resources':
    'Ressourcen, Links und Referenzmaterialien',
  'dashboard.mode.organize': 'Organisieren',
  'dashboard.mode.aio': 'AIO – Alles in Einem',
  'dashboard.mode.cleaner': 'Cleaner / Redrawer',
  'dashboard.mode.typesetter': 'Typesetter',
  'dashboard.mode.translator': 'Übersetzer',
  'dashboard.mode.raw': 'Raw-Anbieter',
  'dashboard.mode.proofreader': 'Korrekturleser / QC',
  'dashboard.mode.stitch': 'Zusammenfügen (Webtoon)',
  'dashboard.mode.split': 'Intelligentes Teilen',
  'dashboard.mode.watermark': 'Wasserzeichen',
  'dashboard.mode.enhance': 'Bild verbessern',
  'dashboard.mode.optimizer': 'Kapitel-Optimierer',
  'dashboard.mode.blogger': 'Blogger-CDN',
  'dashboard.mode.imgur': 'Imgur-Upload',
  'dashboard.mode.guides': 'Anleitungen & Tutorials',
  'dashboard.mode.resources': 'Ressourcen & Materialien',
  'dashboard.status.modelSelected': 'Modell für {stage} ausgewählt: {model}',
  'dashboard.status.verifyEmailRequired':
    'Bestätige deine E-Mail, um diese Aktion auszuführen.',
  'dashboard.status.imagesCount': '{count} Bilder',
  'dashboard.status.noImage': 'Kein Bild',
  'dashboard.status.freeText': 'Freitext',
  'dashboard.user.defaultName': 'Benutzer',
  'dashboard.topbar.thisTab': 'Dieser Tab',
  'dashboard.aio.config.title': 'Phasenkonfiguration',
  'dashboard.footer.hardware.nvidia':
    'NVIDIA-Beschleunigung mit maximaler Leistung.',
  'dashboard.footer.hardware.intel': 'Dedizierte Intel-Beschleunigung aktiv.',
  'dashboard.footer.hardware.cpu':
    'Lokale Ausführung ohne dedizierte Beschleunigung.',
  'dashboard.footer.quickLinks': 'Schnelllinks',
  'dashboard.footer.lastSave.never': 'In dieser Sitzung noch nicht gespeichert',
  'dashboard.footer.lastSave.label': 'Letzte Speicherung: {time}',
  'dashboard.cleaner.flow.local.title':
    'Strukturierter Ablauf mit OCR, Segmentierung und lokalem Inpainting',
  'dashboard.cleaner.flow.ai.title':
    'Automatische Bereinigung mit multimodaler KI und geführter Rekonstruktion',
  'dashboard.cleaner.flow.local.desc':
    'Verwendet den lokalen Detektor, um Kandidaten vorzuschlagen, klassifiziert, welche Bereiche echte SFX sind, und bereinigt nur die genehmigten.',
  'dashboard.cleaner.flow.ai.desc':
    'Verwendet die strukturelle Erkennung des Projekts zur Steuerung der KI, verstärkt die Erhaltung von Sprechblasen/Kunst und setzt große Bilder mit glatteren Übergängen zusammen.',
  'dashboard.cleaner.instructions.placeholder':
    'Z.B.: Rote Verläufe besser erhalten, bei kleinen SFX konservativer sein, narrative Boxen nicht verändern.',
  'dashboard.cleaner.instructions.hint.local':
    'Diese Anweisungen werden als ergänzender Kontext nach den grundlegenden SFX-Klassifizierungs- und Bereinigungsregeln eingefügt.',
  'dashboard.cleaner.instructions.hint.ai':
    'Diese Anweisungen werden als ergänzender Kontext eingefügt. Die Kernregeln des KI-Cleaners bleiben über jeder Benutzeranweisung, um die Bereinigungslogik zu bewahren.',
  'dashboard.cleaner.inspection.title': 'Inspektion',
  'dashboard.cleaner.segmentation.manage': 'Segmentierungsmodelle verwalten',
  'dashboard.cleaner.segmentation.model': 'Segmentierungsmodell',
  'dashboard.aio.gpuStages.title': 'GPU-Nutzung pro Phase',
  'dashboard.aio.gpuStages.hint':
    'Wähle aus, welche Phasen GPU-Beschleunigung verwenden sollen. Deaktiviere, um CPU-Ausführung zu erzwingen (nützlich, wenn die GPU nicht genügend VRAM für alle Phasen hat).',
  'dashboard.aio.gpuStages.detect': 'Texterkennung (GPU)',
  'dashboard.aio.gpuStages.ocr': 'OCR / Erkennung (GPU)',
  'dashboard.aio.gpuStages.segment': 'Segmentierung (GPU)',
  'dashboard.aio.gpuStages.clean': 'Bereinigung / Inpainting (GPU)',
  'dashboard.aio.gpuStages.noActiveProfile':
    'Derzeit ist kein aktives GPU-Profil bestätigt. Dieser Abschnitt bleibt sichtbar, damit er nicht flackert oder verschwindet; die Schalter wirken wieder, sobald ein GPU-Profil verfügbar ist.',
  'dashboard.aio.config.loadingCatalogs': 'Lokale und Cloud-Kataloge werden geladen...',
  'dashboard.aio.preparingManual': 'Manuelle AIO-Phase wird vorbereitet...',
  'dashboard.aio.preparingAuto':
    'Automatischer AIO-Durchlauf wird vorbereitet...',
  'dashboard.aio.stopping': 'AIO-Durchlauf wird gestoppt...',
  'dashboard.aio.abortedByUser': 'AIO-Durchlauf vom Benutzer abgebrochen.',
  'dashboard.aio.abortedMiniBackendRestarted':
    'AIO-Durchlauf abgebrochen. Mini-Backend wurde neu gestartet.',
  'dashboard.aio.abortedMiniBackendRestartFailed':
    'AIO-Durchlauf abgebrochen. Das Mini-Backend konnte nicht automatisch neu gestartet werden.',
  'dashboard.llm.customProfilesLoadFailed':
    'Benutzerdefinierte LLM-Profile konnten nicht geladen werden.',
  'dashboard.status.ready': 'Bereit zur Bildverarbeitung.',
  'dashboard.workspace.pendingChanges':
    'Der Arbeitsbereich hat ungespeicherte Änderungen.',
  'dashboard.status.restored': 'Arbeitsbereich wiederhergestellt.',
  'dashboard.status.historyRestored':
    'Änderung aus dem Verlauf wiederhergestellt.',
  'dashboard.status.undo': 'Arbeitsbereich rückgängig gemacht.',
  'dashboard.status.redo': 'Arbeitsbereich wiederhergestellt.',
  'dashboard.status.saved': 'Arbeitsbereich lokal gespeichert.',
  'dashboard.status.exportCancelled': 'Export des Arbeitsbereichs abgebrochen.',
  'dashboard.status.exportSuccess': 'Arbeitsbereich erfolgreich exportiert.',
  'dashboard.status.importCancelled': 'Import des Arbeitsbereichs abgebrochen.',
  'dashboard.status.importSuccess': 'Arbeitsbereich erfolgreich importiert.',
  'dashboard.status.importSaved':
    'Arbeitsbereich importiert und lokal gespeichert.',
  'dashboard.status.importNoAutosave':
    'Arbeitsbereich importiert. Automatisches Speichern deaktiviert.',
  'dashboard.status.autosaveRemoved':
    'Lokales automatisches Speichern entfernt.',
  'dashboard.status.nothingToUndo':
    'Nichts zum Rückgängigmachen im Arbeitsbereich.',
  'dashboard.status.nothingToRedo':
    'Nichts zum Wiederherstellen im Arbeitsbereich.',
  'dashboard.sections.pipeline': 'Pipeline',
  'dashboard.sections.languages': 'Sprachen',
  'dashboard.sections.modelsConfig': 'Modelle & Konfiguration',
  'dashboard.sections.presets': 'Vorlagen',
  'dashboard.sections.region': 'Bereich',
  'dashboard.aio.rewind': 'AIO zurück: Phase „{label}" ({current}/{total}).',
  'dashboard.aio.forward': 'AIO vorwärts: Phase „{label}" ({current}/{total}).',
  'dashboard.aio.rewindImage':
    'AIO zurück ({imageName}): Phase „{label}" ({current}/{total}).',
  'dashboard.aio.forwardImage':
    'AIO vorwärts ({imageName}): Phase „{label}" ({current}/{total}).',
  'dashboard.llm.translation': 'Übersetzung',
  'dashboard.llm.ocr': 'OCR',
  'dashboard.aio.manualScope': 'AIO manuell',
  'dashboard.aio.autoScope': 'AIO automatisch',
  'dashboard.aio.executing': 'Wird ausgeführt',
  'dashboard.cleaner.selectProfile':
    'Wähle ein gespeichertes visuelles Profil für die automatische KI-Bereinigung.',
  'dashboard.cleaner.profileNotFound':
    'Visuelles Profil nicht gefunden. Neu laden und erneut versuchen.',
  'dashboard.cleaner.profileInUse':
    'Visuelles Profil für die automatische KI-Bereinigung aktiv: {label}.',
  'dashboard.cleaner.invalidModel':
    'Wähle ein gültiges Modell für die automatische KI-Bereinigung.',
  'dashboard.cleaner.modelRoadmap':
    'Das Modell „{name}" befindet sich noch in der Roadmap.',
  'dashboard.cleaner.modelConfigRequired':
    'Das Modell „{name}" erfordert vor der Nutzung eine Konfiguration.',
  'dashboard.translator.sfx.invalidModel':
    'Wähle ein gültiges Modell für die KI-SFX des Übersetzers.',
  'dashboard.cleaner.profileSaved':
    'Visuelles Profil gespeichert und für die automatische KI-Bereinigung ausgewählt: {label}.',
  'dashboard.cleaner.removeProfileSelect':
    'Wähle ein gespeichertes visuelles Profil zum Entfernen.',
  'dashboard.cleaner.customTitle':
    'KI Benutzerdefiniert (Automatische KI-Bereinigung)',
  'dashboard.cleaner.emptyLabel': 'Neues visuelles Profil',
  'dashboard.cleaner.namePlaceholder': 'Z.B.: Gemini Image Clean',
  'dashboard.cleaner.modelPlaceholder': 'gemini-2.5-flash-image',
  'dashboard.cleaner.useLabel': 'Im Cleaner verwenden',
  'dashboard.cleaner.providerInUse':
    'Anbieter {name} für die automatische KI-Bereinigung aktiv.',
  'dashboard.stage.detectText.label': 'Text erkennen',
  'dashboard.stage.detectText.short': 'Erkennen',
  'dashboard.stage.recognizeText.label': 'Text lesen',
  'dashboard.stage.recognizeText.short': 'OCR',
  'dashboard.stage.getTranslations.label': 'Übersetzungen abrufen',
  'dashboard.stage.getTranslations.short': 'Übersetzen',
  'dashboard.stage.segmentText.label': 'Text segmentieren',
  'dashboard.stage.segmentText.short': 'Segmentieren',
  'dashboard.stage.cleanImage.label': 'Bild bereinigen',
  'dashboard.stage.cleanImage.short': 'Bereinigen',
  'dashboard.stage.render.label': 'Rendern',
  'dashboard.stage.render.short': 'Rendern',
  'dashboard.aio.pipeline.detect.subtitle': 'Textbereiche im Bild lokalisieren',
  'dashboard.aio.pipeline.ocr.subtitle': 'OCR zum Extrahieren des Textinhalts',
  'dashboard.aio.pipeline.translate.subtitle':
    'Automatische Übersetzung über Dienst/Modell',
  'dashboard.aio.pipeline.segment.subtitle':
    'Bereiche mit Segmentierung verfeinern',
  'dashboard.aio.pipeline.clean.subtitle': 'Inpainting mit AOT/LaMa + Maske',
  'dashboard.aio.pipeline.render.subtitle':
    'Übersetzten Text auf das finale Bild anwenden',
  'dashboard.aio.config.langHint':
    'Quelle → Erkennen/OCR/Übersetzen. Übersetzung → nur Übersetzung.',
  'dashboard.aio.translation.localModelInfo':
    'Lokale Modelle werden bei Bedarf heruntergeladen; Cloud-/API-Modelle verwenden weiterhin einen Schlüssel.',
  'dashboard.translator.sameModelHint':
    'Der Übersetzer verwendet dieselbe Modellauswahl wie AIO; nach dem Modellwechsel erneut ausführen.',
  'dashboard.translator.incompatibleLocalModel':
    'Das aktuelle lokale Modell unterstützt das Sprachpaar des Übersetzers nicht. Wähle ein anderes Modell oder verwende Cloud.',
  'dashboard.status.modeChanged': 'Modus: {mode}',
  'dashboard.status.underDevelopment': '{mode}: {tooltip}',
  'dashboard.aio.render.hintRot': 'Tastenkürzel: ',
  'dashboard.aio.render.hintRotSuffix': ' zum Drehen.',
  'settings.typographerLibrary.noFolder': 'Kein Ordner',
  'settings.profile.defaultUser': 'KŌMA-Benutzer',
  'register.email': 'E-Mail',
  'register.emailPlaceholder': 'du@email.com',
  'feed.sidebar.webhookPlaceholder': 'https://discord.com/api/webhooks/...',
  'feed.sidebar.webhookLabelShort': 'Webhook: ',
  'feed.moderation.scope.accountHwid': 'Konto + HWID',
  'feed.moderation.scope.full': 'Vollständig',
  'feed.composer.label.scanlation': 'Scanlation',
  'feed.composer.availability.hoursPlaceholder': '10',
  'feed.composer.roles.valuePlaceholder': '50,00',
  'feed.apply.contactPlaceholder': 'Discord @Benutzername',
  'ranking.error.loadFailed': 'Rankings konnten nicht geladen werden.',
  'ranking.error.loadDetailFailed': 'Details konnten nicht geladen werden.',
  'ranking.error.saveReviewFailed':
    'Bewertung konnte nicht gespeichert werden.',
  'ranking.error.deleteReviewFailed': 'Bewertung konnte nicht gelöscht werden.',
  'ranking.error.emailVerificationRequired':
    'Bestätige deine E-Mail, bevor du Bewertungen veröffentlichst oder bearbeitest.',
  'dashboard.aio.translation.temperature': 'Temperatur',
  'dashboard.aio.translation.topP': 'Top P',
  'dashboard.aio.translation.maxTokens': 'Max. Tokens',
  'dashboard.aio.clean.hdStrategy': 'HD-Strategie',
  'dashboard.aio.clean.hdStrategy.resize': 'Skalieren',
  'dashboard.aio.clean.hdStrategy.crop': 'Zuschneiden',
  'dashboard.aio.clean.hdStrategy.original': 'Original',
  'dashboard.aio.clean.hdStrategyHint':
    'Strategie für große Bilder vor dem Inpainting.',
  'dashboard.aio.clean.resizeLimit': 'Skalierungslimit',
  'dashboard.aio.clean.cropMargin': 'Zuschneiderand',
  'dashboard.aio.clean.cropTriggerSize': 'Zuschneide-Auslösegröße',
  'dashboard.aio.clean.localHardware':
    'Lokale Hardware: {name} ({provider}{vram})',
  'dashboard.sidebar.workspace': 'Arbeitsbereich',
  'dashboard.sidebar.hide': 'Seitenleiste ausblenden',
  'dashboard.sidebar.remaining': 'Verbleibend: {count}',
  'dashboard.sidebar.resizeAria': 'Linke Seitenleiste vergrößern/verkleinern',
  'dashboard.sidebar.resizeTitle':
    'Ziehen zum Ändern der Größe. Doppelklick zum Zurücksetzen.',
  'dashboard.sidebar.files': 'Dateien ({count})',
  'dashboard.sidebar.clearAll': 'Alle entfernen',
  'dashboard.sidebar.cleared': 'Bildliste geleert.',
  'dashboard.sidebar.empty': 'Keine Bilder',
  'dashboard.sidebar.rewindImage': 'Nur dieses Bild zurücksetzen',
  'dashboard.sidebar.forwardImage': 'Nur dieses Bild vorspulen',
  'dashboard.sidebar.rotate90': 'Um 90 Grad drehen',
  'dashboard.sidebar.moveUp': 'Nach oben verschieben',
  'dashboard.sidebar.moveDown': 'Nach unten verschieben',
  'dashboard.sidebar.remove': 'Entfernen',
  'dashboard.sidebar.extracting': 'Bilder werden extrahiert... bitte warten.',
  'dashboard.sidebar.dropHere': 'Hier ablegen...',
  'dashboard.sidebar.clickOrDrag': 'Ziehen oder klicken',
  'dashboard.sidebar.processingArchive':
    'ZIP/PDF/CBZ/CB7/PSD wird verarbeitet...',
  'dashboard.sidebar.stats.title': 'Lokale Statistiken',
  'dashboard.sidebar.stats.badge': 'Aktiv',
  'dashboard.sidebar.stats.daily': 'Heute',
  'dashboard.sidebar.stats.weekly': 'Diese Woche',
  'dashboard.sidebar.stats.monthly': 'Dieser Monat',
  'dashboard.sidebar.stats.foot':
    'Letzte lokale Verarbeitungsaktivität. Die Zähler werden automatisch pro Zeitraum zurückgesetzt.',
  'dashboard.sidebar.stats.resetNow': 'Setzt jetzt zurück',
  'dashboard.sidebar.stats.resetInHoursMinutes':
    'Setzt in {hours}h {minutes}m zurück',
  'dashboard.sidebar.stats.resetInHours': 'Setzt in {hours}h zurück',
  'dashboard.sidebar.stats.resetInMinutes': 'Setzt in {minutes}m zurück',
  'dashboard.sidebar.right.hide': 'Werkzeuge ausblenden',
  'dashboard.sidebar.right.close': 'Panel schließen',
  'dashboard.sidebar.right.resizeAria':
    'Rechte Seitenleiste vergrößern/verkleinern',
  'dashboard.sidebar.right.resizeTitle':
    'Ziehen zum Ändern der Größe. Doppelklick zum Zurücksetzen.',
  'dashboard.footer.runtime.downloaded': 'Paket heruntergeladen',
  'dashboard.footer.runtime.embedded': 'Eingebetteter Kern',
  'dashboard.footer.runtime.fallback.title': 'Fallback aktiv',
  'dashboard.footer.runtime.fallback.detail':
    '{requested} angefordert, {active} in Verwendung.',
  'dashboard.footer.runtime.tensorrt.title': 'TensorRT aktiv',
  'dashboard.footer.runtime.tensorrt.detail':
    'NVIDIA-Beschleunigung mit maximaler Leistung.',
  'dashboard.footer.runtime.cuda.title': 'CUDA aktiv',
  'dashboard.footer.runtime.cuda.detail': 'Moderne NVIDIA-GPU in Verwendung.',
  'dashboard.footer.runtime.legacy.label': 'Legacy',
  'dashboard.footer.runtime.legacy.title': 'CUDA Legacy aktiv',
  'dashboard.footer.runtime.legacy.detail':
    'Legacy-Profil für ältere NVIDIA-GPUs.',
  'dashboard.footer.runtime.openvino.title': 'OpenVINO aktiv',
  'dashboard.footer.runtime.openvino.detail':
    'Dedizierte Intel-Beschleunigung in Verwendung.',
  'dashboard.footer.runtime.cpu.title': 'CPU aktiv',
  'dashboard.footer.runtime.cpu.detail':
    'Lokale Ausführung ohne dedizierte Beschleunigung.',
  'dashboard.footer.workspace.saving': 'Wird gespeichert',
  'dashboard.footer.workspace.saved': 'Gespeichert',
  'dashboard.footer.workspace.error': 'Lokaler Fehler',
  'dashboard.footer.workspace.pending': 'Ausstehend',
  'dashboard.footer.workspace.title': 'Lokaler Arbeitsbereich',
  'dashboard.footer.runtime.source': 'Quelle: {value}',
  'dashboard.footer.runtime.remoteAvailable': 'Remote-Paket verfügbar.',
  'dashboard.footer.runtime.errorReason': 'Grund: {value}',
  'dashboard.footer.bugReport.title': 'Fehler melden',
  'dashboard.footer.bugReport.desc':
    'Fehler mit automatischen Screenshots und Protokollen melden.',
  'dashboard.footer.discord.aria': 'Discord beitreten',
  'dashboard.footer.discord.title': 'Discord-Community',
  'dashboard.footer.discord.desc':
    'Tritt der Community bei, schlage Ideen vor und teile Feedback.',
  'dashboard.footer.website.aria': 'Projekt-Website öffnen',
  'dashboard.footer.website.title': 'Projekt-Website',
  'dashboard.footer.website.desc':
    'Neuigkeiten, Dokumentation und Projekt-Ressourcen aufrufen.',
  'bugReport.error.imgLoadFailed': 'Bild konnte nicht geladen werden.',
  'bugReport.error.canvasFailed': 'Canvas-Verarbeitung fehlgeschlagen.',
  'modelManager.modal.title': 'Modell-Verwaltung',
  'modelManager.modal.aioFallback': 'AIO',
  'modelCard.recommended': 'EMPF',
  'modelCard.hardware.gpu': 'GPU',
  'modelCard.hardware.cpu': 'CPU',
  'modelCard.speed.ok': 'OK',
  'auth.toolkit.aiClean': 'KI-Bereinigung',
  'freeProviderCard.setup': 'Einrichtung',
  'freeProviderCard.limits': 'Limits',
  'freeProviderCard.rateLimits': 'Ratenlimits',
  'freeProviderCard.field.modelPlaceholder': 'Modell-ID (OpenAI-kompatibel)',
  'customProvider.profileType': 'Benutzerdefiniertes KI-Profil',
  'dashboard.cleaner.mode.assisted': 'Assistiert',
  'dashboard.cleaner.mode.automaticAi': 'Automatische KI-Bereinigung',
  'dashboard.cleaner.mode.aiSfx': 'KI-SFX',
  'dashboard.cleaner.mode.assistedTitle':
    'Strukturierter Ablauf mit OCR, Segmentierung und lokalem Inpainting',
  'dashboard.cleaner.mode.automaticAiTitle':
    'Automatische Bereinigung mit multimodaler KI und geführter Rekonstruktion',
  'dashboard.cleaner.mode.aiSfxTitle':
    'Erkennt und bereinigt nur KI-bestätigte SFX',
  'dashboard.cleaner.mode.title': 'Modus',
  'dashboard.cleaner.mode.hint':
    'Der aktuelle Modus wurde als assistierter Ablauf beibehalten. Die neue <strong>Automatische KI-Bereinigung</strong> verwendet multimodale KI mit strengen Regeln zur Erhaltung von Kunst, Konturen und Sprechblasen.',
  'dashboard.cleaner.pipeline.title': 'Pipeline',
  'dashboard.cleaner.pipeline.hint':
    'Assistierter Ablauf: OCR → Segmentierung → Lokale Bereinigung. Ideal für alle, die Vorhersehbarkeit und anschließende Feinabstimmung wünschen.',
  'dashboard.cleaner.ocr.language': 'Sprache (OCR)',
  'dashboard.cleaner.ocr.languageAria': 'Quellsprache für OCR',
  'dashboard.cleaner.models.button': 'Modelle',
  'dashboard.cleaner.models.none': 'Keine Modelle',
  'dashboard.cleaner.ocr.manageAria': 'OCR-Modelle verwalten',
  'dashboard.cleaner.ocr.modelAria': 'OCR-Modell',
  'dashboard.cleaner.segment.title': 'Segmentieren',
  'dashboard.cleaner.segment.manageAria': 'Segmentierungsmodelle verwalten',
  'dashboard.cleaner.segment.modelAria': 'Segmentierungsmodell',
  'dashboard.cleaner.clean.title': 'Bereinigen',
  'dashboard.cleaner.clean.manageAria': 'Bereinigungsmodelle verwalten',
  'dashboard.cleaner.clean.modelAria': 'Bereinigungsmodell',
  'dashboard.cleaner.settings.title': 'Bereinigung',
  'dashboard.cleaner.settings.maskDilation': 'Maskenerweiterung',
  'dashboard.cleaner.settings.hdStrategy': 'HD-Strategie',
  'dashboard.cleaner.settings.resizeLimit': 'Skalierungslimit',
  'dashboard.cleaner.settings.cropMargin': 'Zuschneiderand',
  'dashboard.cleaner.settings.cropTrigger': 'Zuschneide-Auslöser',
  'dashboard.cleaner.inspect.title': 'Inspektion',
  'dashboard.cleaner.inspect.ocrBlocks': 'OCR-Blöcke',
  'dashboard.cleaner.inspect.segmented': 'Segmentiert',
  'dashboard.cleaner.inspect.selection': 'Auswahl',
  'dashboard.cleaner.inspect.none': 'keine',
  'dashboard.cleaner.inspect.ocr': 'OCR',
  'dashboard.cleaner.inspect.segments': 'Segmente',
  'dashboard.cleaner.inspect.boxesCount': '{count} Box(en)',
  'dashboard.cleaner.ai.sfxCleaner': 'KI-SFX-Cleaner',
  'dashboard.cleaner.ai.automaticClean': 'Automatische KI-Bereinigung',
  'dashboard.cleaner.ai.sfxDesc':
    'Verwendet den lokalen Detektor, um Kandidaten vorzuschlagen, klassifiziert, welche Bereiche echte SFX sind, und bereinigt nur die genehmigten.',
  'dashboard.cleaner.ai.automaticDesc':
    'Verwendet die strukturelle Erkennung des Projekts zur Steuerung der KI, verstärkt die Erhaltung von Sprechblasen/Kunst und setzt große Bilder mit glatteren Übergängen zusammen.',
  'dashboard.cleaner.ai.modelTitle': 'KI-Modell',
  'dashboard.cleaner.ai.manageAria': '{value}-Modelle verwalten',
  'dashboard.cleaner.ai.modelAria': '{value}-Modell',
  'dashboard.cleaner.ai.noneAvailable': 'Keine KI-Modelle verfügbar',
  'dashboard.cleaner.instructions.title': 'Zusätzliche Anweisungen',
  'dashboard.cleaner.instructions.hintSfx':
    'Diese Anweisungen werden als ergänzender Kontext nach den grundlegenden SFX-Klassifizierungs- und Bereinigungsregeln eingefügt.',
  'dashboard.cleaner.instructions.hintAi':
    'Diese Anweisungen werden als ergänzender Kontext eingefügt. Die Kernregeln des KI-Cleaners bleiben über jeder Benutzeranweisung, um die Bereinigungslogik zu bewahren.',
  'dashboard.cleaner.stats.candidates': 'Kandidaten',
  'dashboard.cleaner.stats.sfxApproved': 'SFX gen.',
  'dashboard.cleaner.stats.redraw': 'Neuzeichnen',
  'dashboard.cleaner.action.processing': 'Verarbeitung {value} {percent}%',
  'dashboard.cleaner.action.runAiSfx': 'KI-SFX-Cleaner ausführen',
  'dashboard.cleaner.action.runAutomatic':
    'Automatische KI-Bereinigung ausführen',
  'dashboard.cleaner.action.runAssisted': 'Assistierten Cleaner ausführen',
  'dashboard.typography.circularText': 'Kreistext',
  'dashboard.typography.activate': 'Aktivieren',
  'dashboard.typography.effect.aria': 'Texteffekt',
  'dashboard.typography.effect.title': 'Texteffekt auswählen',
  'dashboard.typography.effect.label': 'Effekt',
  'dashboard.typography.effect.none': 'Kein Effekt',
  'dashboard.typography.effect.panelTitle': 'Texteffekt',
  'dashboard.typography.effect.panelHint':
    'Native Vorlagen für Sprache, Wirkung und Verwischung.',
  'dashboard.typography.effect.searchPlaceholder': 'Effekte suchen...',
  'dashboard.typography.effect.intensity': 'Intensität',
  'dashboard.typography.effect.noResults': 'Keine Effekte gefunden.',
  'dashboard.aio.customAi.titleTranslation':
    'Benutzerdefinierte KI-Profile (Übersetzung)',
  'dashboard.aio.customAi.titleOcr': 'Benutzerdefinierte KI-Profile (OCR)',
  'dashboard.aio.customAi.newTranslation': 'Neues Übersetzungsprofil',
  'dashboard.aio.customAi.newOcr': 'Neues OCR-Profil',
  'dashboard.aio.customAi.placeholderTranslation':
    'Z.B.: OpenRouter Manga DE-DE',
  'dashboard.aio.customAi.placeholderOcr': 'Z.B.: Privates Vision-OCR',
  'dashboard.aio.customAi.modelPlaceholderTranslation': 'openai/gpt-4.1',
  'dashboard.aio.customAi.modelPlaceholderOcr': 'gpt-4.1-mini',
  'dashboard.aio.customAi.useTranslation': 'Übersetzung verwenden',
  'dashboard.aio.customAi.useOcr': 'OCR verwenden',
  'dashboard.aio.customAi.loading':
    'Benutzerdefinierte Profile werden geladen...',
  'dashboard.aio.customAi.savedProfile': 'Profil gespeichert',
  'dashboard.aio.customAi.apiBase': 'API-Basis',
  'dashboard.aio.customAi.ollamaPreset': 'Ollama lokale Vorlage',
  'dashboard.aio.customAi.apiKey': 'API-Schlüssel (optional)',
  'dashboard.aio.customAi.model': 'Modell',
  'dashboard.aio.customAi.clear': 'Leeren',
  'dashboard.aio.customAi.remove': 'Entfernen',
  'dashboard.aio.customAi.save': 'Speichern',
  'dashboard.emptyStage.title': 'Bilder auswählen oder laden',
  'dashboard.emptyStage.desc':
    'Verwende die Werkzeuge in der oberen Leiste, um deine Manhwa-Seiten zu verarbeiten.',
  'dashboard.emptyStage.tipTitle': 'Nützlicher Tipp',
  'dashboard.emptyStage.tipMeta': 'Wechselt alle 15 Sekunden',
  'dashboard.enhance.title': 'Bild verbessern',
  'dashboard.enhance.localHint':
    'ONNX-Modelle auf dem lokalen Mini-Backend. Vor der Verarbeitung installieren.',
  'dashboard.enhance.desktopRequiredHint':
    'Erfordert die Desktop-App mit einem aktiven Mini-Backend.',
  'dashboard.enhance.scale': 'Skalierung',
  'dashboard.enhance.profile': 'Profil',
  'dashboard.enhance.model': 'Modell',
  'dashboard.enhance.format': 'Format',
  'dashboard.enhance.status.title': 'Modell',
  'dashboard.enhance.status.desktopRequired': 'Desktop erforderlich',
  'dashboard.enhance.status.selectModel': 'Modell auswählen',
  'dashboard.enhance.status.ready': 'Bereit',
  'dashboard.enhance.status.notImported': 'Nicht importiert',
  'dashboard.enhance.status.notInstalled': 'Nicht installiert',
  'dashboard.enhance.importHint':
    'Manueller ONNX-Import. .pth mit sisr2onnx konvertieren.',
  'dashboard.enhance.action.manage': 'Verwalten',
  'dashboard.enhance.action.import': 'Importieren',
  'dashboard.enhance.action.install': 'Installieren',
  'dashboard.enhance.action.source': 'Quelle',
  'dashboard.enhance.selectAboveHint': 'Wähle oben ein Modell aus.',
  'dashboard.enhance.action.processing': 'Wird verbessert...',
  'dashboard.enhance.action.run': 'Bilder verbessern',
  'dashboard.info.optimizer.desc1':
    'Optimiere den finalen Stapel mit Web-, Lese- oder Archivvorlagen anhand der bereits im Dashboard erzeugten Ausgaben.',
  'dashboard.info.optimizer.desc2':
    'Das Hilfsmittel zeigt Einsparungen pro Seite und exportiert als ZIP oder lokalen Ordner.',
  'dashboard.info.blogger.desc1':
    'Verwende dieses Hilfsmittel, um auf Blogger zu veröffentlichen und gehostete Bild-URLs zu generieren.',
  'dashboard.info.blogger.desc2':
    'Anmeldedaten und der Optimierer befinden sich unter Einstellungen > Integrationen > Blogger-CDN.',
  'dashboard.info.imgur.desc1':
    'Verwende dieses Hilfsmittel für anonyme Imgur-Uploads mit zufälliger Client-ID-Rotation.',
  'dashboard.info.imgur.desc2':
    'Schlüssel, Limiter und die vollständige Anleitung befinden sich unter Einstellungen > Integrationen > Imgur-Upload.',
  'dashboard.info.guides.desc1':
    'Wähle eine Anleitung im mittleren Bereich, um detaillierte Anweisungen zu lesen.',
  'dashboard.info.guides.desc2':
    'Jede Anleitung enthält praktische Beispiele und Produktivitätstipps.',
  'dashboard.info.resources.desc1':
    'Entdecke nützliche Ressourcen und Materialien für deinen Scanlation-Workflow.',
  'dashboard.info.resources.desc2':
    'Schriften, Vorlagen, Wörterbücher und mehr.',
  'dashboard.render.noRecognizedText': 'Kein erkannter Text',
  'dashboard.render.noTranslation': 'Keine Übersetzung verfügbar',
  'dashboard.render.noNotes': 'Keine TN verfügbar',
  'dashboard.render.noteLabel': 'TN:',
  'dashboard.render.textLabel': 'Text',
  'dashboard.render.aaLabel': 'AA',
  'dashboard.render.skewXLabel': 'Sx',
  'dashboard.render.skewYLabel': 'Sy',
  'renderPreview.context.title': 'Bereichsaktionen',
  'renderPreview.context.copyRecognized': 'Erkannten Text kopieren',
  'renderPreview.context.copyTranslated': 'Übersetzung kopieren',
  'renderPreview.context.editRendered': 'Gerenderten Text bearbeiten',
  'renderPreview.context.editRenderedHint': 'Gerenderten Text bearbeiten',
  'renderPreview.context.manualModeHint': 'Manueller Modus erforderlich',
  'renderPreview.shape': 'Form',
  'renderPreview.rectangular': 'Rechteckig',
  'renderPreview.elliptic': 'Elliptisch',
  'renderPreview.convertRectangular': 'In rechteckige Form umwandeln',
  'renderPreview.convertElliptic': 'In elliptische Form umwandeln',
  'renderPreview.manualModeRequired': 'Manueller Modus erforderlich',
  'renderPreview.applyTypographyPreset': 'Typografie-Vorlage anwenden',
  'renderPreview.preset': 'Vorlage',
  'renderPreview.typographyPresets': 'Typografie-Vorlagen',
  'renderPreview.applyPreset': 'Vorlage anwenden',
  'renderPreview.removeRegion': 'Auswahl entfernen',
  'renderPreview.textFont': 'Textschrift',
  'renderPreview.selectionShape': 'Auswahlform',
  'renderPreview.fontSize': 'Schriftgröße',
  'renderPreview.decreaseFont': 'Schrift verkleinern',
  'renderPreview.increaseFont': 'Schrift vergrößern',
  'renderPreview.alignment': 'Ausrichtung',
  'renderPreview.alignLeft': 'Linksbündig',
  'renderPreview.alignCenter': 'Zentriert',
  'renderPreview.alignRight': 'Rechtsbündig',
  'renderPreview.typographyStyle': 'Typografiestil',
  'renderPreview.bold': 'Fett',
  'renderPreview.italic': 'Kursiv',
  'renderPreview.underline': 'Unterstrichen',
  'renderPreview.uppercase': 'Großbuchstaben',
  'renderPreview.textOrientation': 'Textausrichtung',
  'renderPreview.horizontal': 'Horizontal',
  'renderPreview.vertical': 'Vertikal',
  'renderPreview.circular': 'Kreisförmig',
  'renderPreview.rotation': 'Drehung',
  'renderPreview.rotateMinus5': '−5° drehen',
  'renderPreview.rotatePlus5': '+5° drehen',
  'renderPreview.skewX': 'Neigung X',
  'renderPreview.skewXMinus2': 'Neigung X −2°',
  'renderPreview.skewXPlus2': 'Neigung X +2°',
  'renderPreview.skewY': 'Neigung Y',
  'renderPreview.skewYMinus2': 'Neigung Y −2°',
  'renderPreview.skewYPlus2': 'Neigung Y +2°',
  'renderPreview.adjustments': 'Anpassungen',
  'renderPreview.refine': 'Verfeinern',
  'renderPreview.autoFontSize': 'Automatische Schriftgröße',
  'renderPreview.autoFit': 'Automatisch anpassen',
  'renderPreview.fixed': 'Fest',
  'renderPreview.hyphenation': 'Silbentrennung',
  'renderPreview.enabled': 'Aktiviert',
  'renderPreview.disabled': 'Deaktiviert',
  'renderPreview.maxSize': 'Max. Größe',
  'renderPreview.minSize': 'Min. Größe',
  'renderPreview.lineSpacing': 'Zeilenabstand',
  'renderPreview.opacity': 'Deckkraft',
  'renderPreview.fill': 'Füllung',
  'renderPreview.outline': 'Kontur',
  'renderPreview.shadow': 'Schatten',
  'renderPreview.shadowLayers': 'Schattenebenen',
  'renderPreview.addLayer': 'Ebene hinzufügen',
  'renderPreview.layerN': 'Ebene {count}',
  'renderPreview.removeLayerN': 'Ebene {count} entfernen',
  'renderPreview.shadowLayerN': 'Schattenebene {count}',
  'renderPreview.blur': 'Weichzeichnung',
  'renderPreview.offsetX': 'Versatz X',
  'renderPreview.offsetY': 'Versatz Y',
  'renderPreview.radius': 'Radius',
  'renderPreview.startAngle': 'Startwinkel',
  'renderPreview.spacing': 'Abstand',
  'renderPreview.shadowLayersCount': '{count} Ebene(n)',
  'renderPreview.shadowBlurSummary': 'Weichzeichnung {value}',
  'renderPreview.history.none': 'Kein AIO-Verlauf für dieses Bild',
  'renderPreview.box.clickToEdit': 'Doppelklick zum Bearbeiten',
  'renderPreview.box.renderNotApplied':
    'Rendering in dieser Phase nicht angewandt',
  'renderPreview.editor.placeholder': 'Endgültigen Text eingeben...',
  'renderPreview.editor.aria': 'Gerenderten Text bearbeiten',
  'splitter.strategy.smart': 'Auto Smart',
  'splitter.strategy.smartHint': 'Leerraum + Heuristik.',
  'splitter.strategy.advancedDesktop': 'Semi Desktop',
  'splitter.strategy.advancedDesktopHint': 'Erweiterte lokale Analyse.',
  'splitter.strategy.manual': 'Manuell',
  'splitter.strategy.manualHint': 'Nur manuelle Anpassungen.',
  'splitter.strategy.fixedHeight': 'Feste Höhe',
  'splitter.strategy.fixedHeightHint': 'Segmentierung nach Höhe.',
  'splitter.strategy.count': 'N Teile',
  'splitter.strategy.countHint': 'Gleichmäßige Aufteilung.',
  'dashboard.aio.autoScopeTitle': 'Automatische Verarbeitung ohne Eingriff',
  'dashboard.aio.manualScopeTitle': 'Manuelle Steuerung jeder Phase',
  'detectionPreview.recognized': 'Erkannt:',
  'detectionPreview.translated': 'Übersetzt:',
  'detectionPreview.note': 'TN:',
  'detectionPreview.manual': 'Manuell',
  'detectionPreview.removeSelection': 'Auswahl entfernen',
  'detectionPreview.actions': 'Bereichsaktionen',
  'detectionPreview.text': 'Text',
  'detectionPreview.copyRecognized': 'Erkannten Text kopieren',
  'detectionPreview.editRecognized': 'Erkannten Text bearbeiten',
  'detectionPreview.manualModeOnly': 'Nur im manuellen Modus verfügbar',
  'detectionPreview.copyTranslated': 'Übersetzung kopieren',
  'detectionPreview.editTranslated': 'Übersetzung bearbeiten',
  'detectionPreview.removeRegion': 'Bereich entfernen',
  'detectionPreview.editRecognizedTitle': 'Erkannten Text bearbeiten',
  'detectionPreview.editTranslatedTitle': 'Übersetzten Text bearbeiten',
  'detectionPreview.placeholderRecognized': 'Erkannten Text eingeben...',
  'detectionPreview.placeholderTranslated': 'Übersetzung eingeben...',
  'detectionPreview.rewind': 'Dieses Bild zurückspulen',
  'detectionPreview.forward': 'Dieses Bild vorspulen',
  'detectionPreview.noHistory': 'Kein AIO-Verlauf für dieses Bild',
  'dashboard.translator.workspace.aria': 'Übersetzer-Modus',
  'dashboard.translator.workspace.textTitle': 'Freitext übersetzen',
  'dashboard.translator.workspace.text': 'Text',
  'dashboard.translator.workspace.visualTitle':
    'In Bildern erkennen und übersetzen',
  'dashboard.translator.workspace.visual': 'Visuell',
  'watermark.header.eyebrow': 'Redaktionelles Hilfsmittel',
  'watermark.header.title': 'Wasserzeichen',
  'watermark.header.badge': 'Stapel',
  'watermark.panel.presets': 'Vorlagen',
  'watermark.presets.builtin': 'Integriert',
  'watermark.presets.user': 'Gespeichert',
  'watermark.action.save': 'Speichern',
  'watermark.action.duplicate': 'Duplizieren',
  'watermark.panel.text': 'Text',
  'watermark.text.enable': 'Text aktivieren',
  'watermark.text.content': 'Inhalt',
  'watermark.text.font': 'Schrift',
  'watermark.text.size': 'Größe',
  'watermark.text.color': 'Farbe',
  'watermark.text.outline': 'Kontur',
  'watermark.text.outlineColor': 'Konturfarbe',
  'watermark.text.opacity': 'Deckkraft',
  'watermark.panel.logo': 'Logo',
  'watermark.logo.enable': 'Aktivieren',
  'watermark.logo.change': 'Ändern',
  'watermark.logo.upload': 'Hochladen',
  'watermark.logo.remove': 'Entfernen',
  'watermark.logo.scale': 'Skalierung %',
  'watermark.logo.opacity': 'Deckkraft',
  'watermark.logo.brightness': 'Helligkeit',
  'watermark.logo.saturation': 'Sättigung',
  'watermark.panel.distribution': 'Verteilung',
  'watermark.distribution.position': 'Position',
  'watermark.distribution.rotation': 'Drehung',
  'watermark.distribution.blend': 'Mischmodus',
  'watermark.distribution.gapX': 'Abstand X',
  'watermark.distribution.gapY': 'Abstand Y',
  'watermark.distribution.padding': 'Innenabstand',
  'watermark.distribution.baseName': 'Basisname',
  'watermark.distribution.smartPlacement': 'Intelligente Platzierung',
  'watermark.action.applying': 'Wird angewandt...',
  'watermark.action.applyBatch': 'Stapel anwenden',
  'watermark.status.cancelRequested': 'Abbruch angefordert.',
  'watermark.action.cancel': 'Abbrechen',
  'watermark.panel.preview': 'Vorschau',
  'watermark.preview.compare': 'Vergleichen',
  'watermark.preview.mode': 'Vorschau',
  'watermark.preview.empty.title': 'Keine Bilder',
  'watermark.preview.empty.desc':
    'Importiere Seiten im linken Bereich des Dashboards.',
  'watermark.preview.noLayer.title': 'Ebene einrichten',
  'watermark.preview.noLayer.desc':
    'Aktiviere Text oder Logo in der Werkzeugleiste, um die Vorschau zu erzeugen.',
  'watermark.preview.original': 'Original',
  'watermark.preview.watermark': 'Wasserzeichen',
  'watermark.preview.compareAria': 'Vorher/Nachher-Vergleich',
  'watermark.preview.generating': 'Wird generiert...',
  'watermark.panel.output': 'Ausgabe',
  'watermark.output.empty.title': 'Keine Ergebnisse',
  'watermark.output.empty.desc':
    'Wende den Stapel an, um Downloads zu generieren.',
  'watermark.action.zip': 'ZIP',
  'watermark.action.folder': 'Ordner',
  'watermark.action.download': 'Herunterladen',
  'imgur.hero.eyebrow': 'Imgur-Upload',
  'imgur.hero.title': 'Anonymes Hosting',
  'imgur.hero.desc':
    'Verwende dieses Hilfsmittel für schnelle Imgur-Uploads mit zufälliger Client-ID-Rotation.',
  'imgur.status.remaining': 'Verbleibend: {remaining}',
  'imgur.status.configure': 'Konfigurieren',
  'imgur.alert.missingConfig': 'Fehlende Konfiguration',
  'imgur.alert.addActiveClient':
    'Füge mindestens eine aktive Client-ID unter Einstellungen > Integrationen hinzu.',
  'imgur.batch.title': 'Stapel-Upload',
  'imgur.batch.limit':
    'Limit von {limit} Uploads pro Stunde (Verwendet: {used})',
  'imgur.dropzone.title': 'Bilder hierher ziehen',
  'imgur.dropzone.desc': 'Ziehe mehrere JPG-, PNG- oder WEBP-Dateien.',
  'imgur.toggle.imgOutput': 'Ausgabe als <img>-Tag',
  'imgur.toggle.imgOutputDesc':
    'Erzeugt fertigen HTML-Code für Blogs und Foren.',
  'imgur.actions.select': 'Auswählen',
  'imgur.actions.sending': 'Wird gesendet...',
  'imgur.actions.send': 'Senden',
  'imgur.actions.copy': 'URLs kopieren',
  'imgur.queue.title': 'Upload-Warteschlange',
  'imgur.queue.items_one': '{count} Element',
  'imgur.queue.items_other': '{count} Elemente',
  'imgur.queue.empty': 'Warteschlange ist leer. Füge oben Bilder hinzu.',
  'imgur.queue.altPlaceholder': 'Alternativtext',
  'imgur.queue.urlLabel': 'URL',
  'imgur.queue.keyLabel': 'Schlüssel',
  'imgur.queue.remove': 'Entfernen',
  'imgur.error.configLoad': 'Imgur-Konfiguration konnte nicht geladen werden.',
  'imgur.error.uploadFailed': 'Bild-Upload fehlgeschlagen.',
  'imgur.feedback.singleSuccess': 'Upload erfolgreich abgeschlossen.',
  'imgur.feedback.multiSuccess': 'Upload von {count} Bildern abgeschlossen.',
  'ranking.metric.overall': 'Gesamtbewertung',
  'ranking.metric.quality': 'Qualität',
  'ranking.metric.speed': 'Geschwindigkeit',
  'ranking.metric.costBenefit': 'Preis-Leistung',
  'ranking.metric.easeOfUse': 'Benutzerfreundlichkeit',
  'ranking.trend.neutral': 'Neutral',
  'ranking.trend.points': 'Pkt.',
  'ranking.table.title': 'Bestenliste',
  'ranking.table.sortedBy': 'Sortiert nach gewichteter {metric}.',
  'ranking.table.modelsCount': '{count} bewertete Modelle',
  'ranking.table.empty': 'Keine Modelle entsprechen den aktuellen Filtern.',
  'ranking.table.newLabel': 'Neu',
  'ranking.table.reviewsCount': '{count} Bewertungen',
  'ranking.table.reviewedByYou': 'Bereits bewertet',
  'ranking.table.viewDetails': 'Details anzeigen',
  'ranking.filters.metricAria': 'Ranking-Metrik',
  'ranking.filters.searchPlaceholder': 'Modell suchen...',
  'ranking.filters.searchAria': 'Modell suchen',
  'ranking.filters.advancedAria': 'Erweiterte Filter anzeigen',
  'ranking.filters.button': 'Filter',
  'ranking.filters.stageLabel': 'Phase',
  'ranking.filters.sourceLabel': 'Quelle',
  'ranking.filters.languageLabel': 'Sprache',
  'ranking.filters.minReviewsLabel': 'Min. Bewertungen',
  'ranking.filters.allStages': 'Alle Phasen',
  'ranking.filters.allSources': 'Lokal + Cloud',
  'ranking.filters.onlyLocal': 'Nur lokal',
  'ranking.filters.onlyCloud': 'Nur Cloud',
  'ranking.filters.allLanguages': 'Alle Sprachen',
  'ranking.filters.reviews_one': '{count} Bewertung',
  'ranking.filters.reviews_other': '{count} Bewertungen',
  'ranking.composer.usage.balanced': 'Ausgewogen',
  'ranking.composer.usage.qualityFirst': 'Qualität zuerst',
  'ranking.composer.usage.speedFirst': 'Geschwindigkeit zuerst',
  'ranking.composer.usage.lowVram': 'Wenig VRAM',
  'ranking.composer.usage.offlineLocal': 'Lokale Pipeline',
  'ranking.composer.usage.cloudPipeline': 'Cloud-Pipeline',
  'ranking.composer.title.edit': 'Bewertung bearbeiten',
  'ranking.composer.title.new': 'Neue Bewertung',
  'ranking.composer.action.close': 'Schließen',
  'ranking.composer.field.title': 'Titel',
  'ranking.composer.field.titlePlaceholder':
    'Z.B.: Bestes lokales OCR für Manga',
  'ranking.composer.field.context': 'Kontext',
  'ranking.composer.field.sourceLang': 'Quellsprache',
  'ranking.composer.field.sourceLangPlaceholder': 'ja, en, de...',
  'ranking.composer.field.targetLang': 'Zielsprache',
  'ranking.composer.field.targetLangPlaceholder': 'en, de, pt-br...',
  'ranking.composer.field.device': 'Gerät',
  'ranking.composer.device.none': 'Nicht angegeben',
  'ranking.composer.field.comment': 'Kommentar',
  'ranking.composer.field.commentPlaceholder':
    'Beschreibe die Gesamtqualität, Stabilität, Ressourcennutzung und wo dieses Modell den größten Mehrwert bietet.',
  'ranking.composer.action.reset': 'Zurücksetzen',
  'ranking.composer.action.delete': 'Löschen',
  'ranking.composer.action.save': 'Speichern',
  'ranking.composer.action.publish': 'Veröffentlichen',
  'dashboard.specialMode.visualEmpty.title': 'Visueller Übersetzer',
  'dashboard.specialMode.visualEmpty.description':
    'Importiere Bilder, um direkt in der Vorschau mit dem Übersetzen zu beginnen.',
  'dashboard.specialMode.visualEmpty.cta': 'Bilder auswählen',
  'dashboard.reviewRaw.raw.title': 'Raw-Überprüfung',
  'dashboard.reviewRaw.raw.description':
    'Analysiere die Qualität der Originalbilder und bereite den Stapel für die Pipeline vor.',
  'dashboard.reviewRaw.raw.note':
    'Die Raw-Überprüfung hilft der KI, den visuellen Kontext vor dem OCR besser zu verstehen.',
  'dashboard.reviewRaw.raw.statusReady':
    'Stapel von {count} Bildern bereit zur Überprüfung.',
  'dashboard.reviewRaw.raw.validate': 'Raw überprüfen',
  'dashboard.reviewRaw.qc.title': 'Qualitätskontrolle',
  'dashboard.reviewRaw.qc.descriptionAuto':
    'Die automatische QC verwendet leichtgewichtige Modelle, um häufige Bearbeitungsfehler zu erkennen.',
  'dashboard.reviewRaw.qc.descriptionManual':
    'Der manuelle Modus ermöglicht eine detaillierte Überprüfung jeder Sprechblase und Neuzeichnung.',
  'dashboard.reviewRaw.qc.note':
    'Aktiviere die folgenden Prüfungen, um die Stapelanalyse auszuführen.',
  'dashboard.reviewRaw.qc.automaticChecks': 'Automatische Prüfungen',
  'dashboard.reviewRaw.qc.checks.untranslatedText': 'Unübersetzter Text',
  'dashboard.reviewRaw.qc.checks.emptyBubbles': 'Leere Sprechblasen',
  'dashboard.reviewRaw.qc.checks.visualArtifacts': 'Visuelle Artefakte',
  'dashboard.reviewRaw.qc.checks.textAlignment': 'Textausrichtung',
  'dashboard.reviewRaw.qc.checks.fontConsistency': 'Schriftkonsistenz',
  'dashboard.reviewRaw.qc.inProgress': 'QC-Analyse wird durchgeführt...',
  'dashboard.reviewRaw.qc.run': 'QC ausführen',
  'common.cancel': 'Abbrechen',
  'common.save': 'Speichern',
  'common.name': 'Name',
  'common.newName': 'Neuer Name',
  'common.removed': 'Entfernt',
  'common.renamed': 'Umbenannt',
  'common.duplicated': 'Dupliziert',
  'common.saved': 'Gespeichert',
  'common.failed': 'Fehlgeschlagen',
  'common.cancelled': 'Abgebrochen',
  'common.status': 'Status',
  'common.configured': 'Konfiguriert',
  'common.no': 'Nein',
  'common.account': 'Konto',
  'common.format': 'Format',
  'common.exportedCount': 'Exportiert: {count} Elemente.',
  'modelManager.modal.verified': 'Verifiziert am',
  'modelManager.modal.upToDate': 'Auf dem neuesten Stand',
  'modelManager.modal.closeAria': 'Dialog schließen',
  'modelManager.modal.localModels': 'Lokaler Katalog',
  'modelManager.modal.localDesc':
    'Installation bei Bedarf mit Integritätsprüfung.',
  'modelManager.modal.noLocal':
    'Keine lokalen Modelle entsprechen den Filtern.',
  'modelManager.modal.cloudModels': 'Cloud-Katalog',
  'modelManager.modal.cloudDesc':
    'API-/Cloud-basierte Modelle. Erfordern eine Verbindung und eigene Schlüssel.',
  'modelManager.modal.hideCustom': 'Benutzerdefinierte ausblenden',
  'modelManager.modal.addCustom': 'Benutzerdefiniertes hinzufügen',
  'modelManager.modal.noCloud': 'Keine Cloud-Modelle entsprechen den Filtern.',
  'modelManager.modal.checking': 'Wird geprüft...',
  'modelManager.modal.checkUpdates': 'Nach Updates suchen',
  'modelManager.modal.installAll': 'Empfohlene installieren',
  'modelManager.modal.cancel': 'Abbrechen',
  'modelManager.modal.noEligible': 'Keine geeigneten Modelle gefunden.',
  'modelManager.modal.notEnoughSpace':
    'Nicht genügend Speicherplatz (benötigt {space}).',
  'resources.breadcrumb.home': 'Ressourcen',
  'resources.communities.title': 'Communities & Links',
  'resources.back': 'Zurück zu Ressourcen',
  'resources.communities.desc':
    'Aktive Scanlation-Communities, Discord-Server, Foren und Ressourcen für Vernetzung und Lernen.',
  'resources.platform.discord': 'Discord',
  'resources.platform.forum': 'Forum',
  'resources.platform.reddit': 'Reddit',
  'resources.platform.website': 'Website',
  'resources.communities.members': '{count} Mitglieder',
  'resources.action.visit': 'Besuchen',
  'resources.externalTools.title': 'Externe Werkzeuge',
  'resources.externalTools.desc':
    'Empfohlene Software und Apps, die KŌMA Studio in deinem Scanlation-Workflow ergänzen.',
  'resources.category.editing': 'Bearbeitung',
  'resources.category.ocr': 'OCR',
  'resources.category.translation': 'Übersetzung',
  'resources.category.fonts': 'Schriften',
  'resources.category.hosting': 'Hosting',
  'resources.category.utility': 'Hilfsmittel',
  'resources.action.open': 'Öffnen',
  'resources.action.download': 'Herunterladen',
  'resources.status.free': 'Kostenlos',
  'resources.status.paid': 'Kostenpflichtig',
  'resources.fonts.title': 'Typesetting-Schriften',
  'resources.fonts.desc':
    'Kuratierte Sammlung beliebter Scanlation-Schriften. Enthält Schriften für Dialog, Erzählung, Hervorhebung, SFX und CJK-Text.',
  'resources.fonts.searchPlaceholder':
    'Schriften nach Name, Verwendung oder Tag suchen...',
  'resources.fonts.noResults': 'Keine Schriften für „{search}" gefunden',
  'resources.license.free': 'Kostenlos',
  'resources.license.openSource': 'Open Source',
  'resources.license.commercial': 'Kommerziell',
  'resources.license.mixed': 'Gemischt',
  'resources.glossary.title': 'Scanlation-Glossar',
  'resources.glossary.desc':
    'Fachbegriffe, Community-Jargon und unverzichtbares Vokabular für die Scanlation von Manga, Manhwa und Manhua.',
  'resources.glossary.searchPlaceholder': 'Begriffe suchen...',
  'resources.glossary.noResults': 'Keine Begriffe für „{search}" gefunden',
  'resources.glossary.related': 'Verwandt:',
  'resources.category.general': 'Allgemein',
  'resources.category.typesetting': 'Typesetting',
  'resources.category.cleaning': 'Bereinigung',
  'resources.category.technical': 'Technisch',
  'resources.category.roles': 'Rollen',
  'resources.sfx.title': 'SFX-Bibliothek',
  'resources.sfx.desc':
    'Bibliothek japanischer Soundeffekte mit Übersetzungen, Romaji-Aussprache und Manga-Anwendungsbeispielen.',
  'resources.sfx.searchPlaceholder':
    'Nach Japanisch, Romaji oder Deutsch suchen...',
  'resources.sfx.noResults': 'Keine SFX gefunden.',
  'resources.sfx.commonIn': 'Häufig in: {value}',
  'resources.category.impact': 'Wirkung',
  'resources.category.emotion': 'Emotion',
  'resources.category.ambient': 'Umgebung',
  'resources.category.action': 'Aktion',
  'resources.category.voice': 'Stimme',
  'resources.category.misc': 'Sonstiges',
  'resources.filters.all': 'Alle ({count})',
  'resources.page.tab.fonts': 'Schriften',
  'resources.page.tab.sfx': 'SFX-Bibliothek',
  'resources.page.tab.glossary': 'Glossar',
  'resources.page.tab.communities': 'Communities',
  'resources.page.tab.tools': 'Werkzeuge',
  'resources.page.title.main': 'Ressourcen-',
  'resources.page.title.accent': 'Center',
  'resources.page.subtitle':
    'Kuratierte Materialien, Communities und Werkzeuge für deinen Workflow.',
  'resources.page.searchPlaceholder': 'Alle Kategorien durchsuchen...',
  'resources.page.searchAria': 'Ressourcen-Suchfeld',
  'resources.page.clearSearch': 'Suche leeren',
  'resources.page.tabsAria': 'Ressourcen-Kategorien',
  'resources.category.fonts.label': 'Typesetting-Schriften',
  'resources.category.fonts.description':
    'Kuratierte Sammlung beliebter Schriften für die Scanlation von Manga, Manhwa und Manhua.',
  'resources.category.sfx-library.label': 'SFX-Bibliothek',
  'resources.category.sfx-library.description':
    'Bibliothek japanischer Lautmalereien mit Übersetzungen und Anwendungsbeispielen.',
  'resources.category.glossary.label': 'Scanlation-Glossar',
  'resources.category.glossary.description':
    'Fachbegriffe und Community-Jargon aus der Scanlation-Welt.',
  'resources.category.communities.label': 'Communities',
  'resources.category.communities.description':
    'Discord-Server, Subreddits und Scanlation-Foren.',
  'resources.category.tools-external.label': 'Externe Werkzeuge',
  'resources.category.tools-external.description':
    'Ergänzende Software und nützliche Online-Tools.',
  'resources.home.title': 'Ressourcen-Center',
  'resources.home.subtitle':
    'Kuratierte Materialien, Communities und Werkzeuge für deinen Workflow.',
  'resources.home.itemCount': '{count} Einträge',
  'dashboard.aio.result.regionsDetected': '{count} Bereich(e) erkannt',
  'dashboard.aio.result.textsRecognized': '{count} Text(e) erkannt',
  'dashboard.aio.result.translationsGenerated':
    '{count} Übersetzung(en) generiert',
  'dashboard.aio.result.regionsSegmented': '{count} Bereich(e) segmentiert',
  'dashboard.aio.result.imagesCleaned': '{count} Bild(er) bereinigt',
  'dashboard.aio.result.blocksReady': '{count} Block/Blöcke bereit zum Rendern',
  'dashboard.aio.result.finished': 'AIO abgeschlossen. {parts}.',
  'resources.glossary.category.general': 'Allgemein',
  'resources.glossary.category.typesetting': 'Typesetting',
  'resources.glossary.category.cleaning': 'Bereinigung',
  'resources.glossary.category.translation': 'Übersetzung',
  'resources.glossary.category.technical': 'Technisch',
  'resources.glossary.category.roles': 'Rollen',
  'resources.glossary.filterAll': 'Alle',
  'resources.glossary.results_one': 'Begriff gefunden',
  'resources.glossary.results_other': 'Begriffe gefunden',
  'resources.glossary.context': 'Glossar',
  'resources.glossary.alphaAria': 'Alphabetische Navigation',
  'resources.glossary.alphaBtnAria': 'Zum Buchstaben {letter} springen',
  'dashboard.aio.config.sourceLanguage':
    'Quellsprache (Erkennen/OCR/Übersetzen)',
  'dashboard.aio.config.targetLanguage': 'Übersetzungssprache',
  'dashboard.aio.pipeline.rewind': 'Pipeline zurückspulen',
  'dashboard.aio.pipeline.forward': 'Pipeline vorspulen',
  'dashboard.aio.pipeline.snapshot': 'Snapshot: ',
  'dashboard.aio.pipeline.image': 'Bild: ',
  'dashboard.aio.pipeline.stage': 'Phase: ',
  'dashboard.aio.translation.noneSelected': 'Kein Modell ausgewählt.',
  'dashboard.aio.translation.selected': 'Ausgewählt: ',
  'dashboard.aio.render.hint':
    'Schrift-/Farb-/Ausrichtungssteuerungen befinden sich im kontextbezogenen Overlay-Dock. Tastenkürzel: Umschalt + Scrollen zum Drehen.',
  'dashboard.aio.render.warning':
    'Bild befindet sich in einer Phase vor dem Rendering. Verwende „Vorwärts", um es anzuzeigen.',
  'dashboard.aio.render.disabled':
    'Aktiviere die Rendering-Phase in der Pipeline, um sie zu konfigurieren.',
  'dashboard.stitch.lastToNext':
    'Letztes Bild an den nächsten Stapel gesendet.',
  'dashboard.stitch.firstFromNext':
    'Erstes Bild des nächsten Stapels zum aktuellen Stapel hinzugefügt.',
  'dashboard.stitch.resetPlanning':
    'Stitcher-Planung automatisch neu berechnet.',
  'dashboard.aio.customAi.syncing':
    'Benutzerdefinierte KI (wird synchronisiert...)',
  'dashboard.aio.customOcr.syncing':
    'Benutzerdefiniertes OCR (wird synchronisiert...)',
  'dashboard.aio.customOcr.useCase':
    'Benutzerdefiniertes OCR-Profil wartet auf lokale Synchronisierung.',
  'dashboard.aio.customAi.useCase':
    'Benutzerdefiniertes Profil wartet auf lokale Synchronisierung.',
  'dashboard.aio.config.languageHint':
    'Die Quellsprache wird in den Phasen Erkennen, Lesen und Übersetzen verwendet. Die Übersetzungssprache gilt nur für die Übersetzung.',
  'dashboard.aio.presets.title': 'AIO-Vorlagen nach Sprache',
  'dashboard.aio.presets.currentLanguage': 'Aktuelle Sprache:',
  'dashboard.aio.presets.noneActive': 'Keine aktive Vorlage',
  'dashboard.aio.presets.activeSuffix': '(aktiv)',
  'dashboard.aio.presets.new': 'Neu',
  'dashboard.aio.presets.edit': 'Bearbeiten',
  'dashboard.aio.presets.delete': 'Löschen',
  'dashboard.aio.presets.saveCurrent': 'Aktuelle speichern',
  'dashboard.aio.presets.openSettings': 'Vorlagen in den Einstellungen öffnen',
  'dashboard.aio.presets.presetName': 'Name der Vorlage',
  'dashboard.aio.presets.namePlaceholder': 'Z.B.: Schnelles JP-OCR',
  'dashboard.aio.presets.description': 'Beschreibung',
  'dashboard.aio.presets.optional': 'Optional',
  'dashboard.aio.presets.setActiveFor': 'Als aktive Vorlage festlegen für',
  'dashboard.aio.presets.cancel': 'Abbrechen',
  'dashboard.aio.presets.update': 'Vorlage aktualisieren',
  'dashboard.aio.presets.create': 'Vorlage erstellen',
  'dashboard.aio.translation.selectedSummaryModel':
    'Ausgewählt: {name}',
  'dashboard.aio.translation.selectedSummaryCustom':
    'Ausgewählt: {name} (Benutzerdefiniert/FREE-Anbieter)',
  'dashboard.aio.translation.selectedSummaryLegacy':
    'Ausgewählt: {name} (Cloud/API/KI)',
  'dashboard.aio.translation.selectedSummaryEmpty':
    'Wähle ein lokales oder Cloud-Modell für die AIO-Übersetzung aus.',
  'dashboard.aio.translation.supportSummary':
    'Lokale Modelle werden bei Bedarf heruntergeladen; Cloud-/API-Modelle bleiben über Schlüssel verfügbar.',
  'dashboard.aio.translation.additionalContextPlaceholder': 'Zusätzlicher Kontext für Cloud-Übersetzung...',
  'dashboard.aio.translation.notesToggle':
    'TNs separat von der Übersetzung generieren und anzeigen',
  'dashboard.aio.translation.neighborContextToggle':
    'Kontext aus benachbarten Bildern im Stapel verwenden',
  'dashboard.aio.translation.multimodalToggle':
    'Seitenbild als multimodalen Kontext senden',
  'dashboard.aio.translation.activeConfigFor':
    'Aktive Konfiguration für: {value}.',
  'dashboard.aio.customAi.title': 'Benutzerdefinierte KI',
  'dashboard.aio.customAi.loadingProfiles':
    'Benutzerdefinierte Profile werden geladen...',
  'dashboard.aio.customAi.savedTranslationProfile':
    'Gespeichertes Übersetzungsprofil',
  'dashboard.aio.customAi.newTranslationProfile': 'Neues Übersetzungsprofil',
  'dashboard.aio.customAi.name': 'Name',
  'dashboard.aio.customAi.translationNamePlaceholder':
    'Z.B.: OpenRouter Manga DE-DE',
  'dashboard.aio.customAi.apiBasePlaceholder': 'https://api.example.com/v1',
  'dashboard.aio.customAi.useLocalOllama': 'Ollama lokale Vorlage',
  'dashboard.aio.customAi.apiKeyOptional': 'API-Schlüssel (optional)',
  'dashboard.aio.customAi.apiKeyPlaceholder': 'sk-...',
  'dashboard.aio.customAi.translationModelPlaceholder': 'openai/gpt-4.1...',
  'dashboard.aio.customAi.resetTranslation': 'Übersetzung leeren',
  'dashboard.aio.customAi.useSavedTranslation': 'Übersetzung verwenden',
  'dashboard.aio.customAi.removeTranslation': 'Übersetzung entfernen',
  'dashboard.aio.customAi.saveTranslation': 'Übersetzung speichern',
  'dashboard.aio.customAi.savedOcrProfile': 'Gespeichertes OCR-Profil',
  'dashboard.aio.customAi.newOcrProfile': 'Neues OCR-Profil',
  'dashboard.aio.customAi.ocrNamePlaceholder': 'Z.B.: Privates Vision-OCR',
  'dashboard.aio.customAi.ocrModelPlaceholder': 'gpt-4.1-mini...',
  'dashboard.aio.customAi.resetOcr': 'OCR leeren',
  'dashboard.aio.customAi.useSavedOcr': 'OCR verwenden',
  'dashboard.aio.customAi.removeOcr': 'OCR entfernen',
  'dashboard.aio.customAi.saveOcr': 'OCR speichern',
  'dashboard.aio.customAi.openAiCompatibleHint':
    'Verwende eine OpenAI-kompatible API.',
  'dashboard.aio.clean.maskDilation': 'Maskenerweiterung',
  'bugReport.title': 'Fehler melden',
  'bugReport.subtitle':
    'Screenshot + automatische Protokolle + manuelle Anhänge',
  'bugReport.close': 'Schließen',
  'bugReport.details': 'Details',
  'bugReport.evidence': 'Nachweise',
  'bugReport.machineSnapshotIncluded':
    'Enthält automatisch einen technischen Snapshot des Systems.',
  'bugReport.field.title': 'Titel',
  'bugReport.field.description': 'Beschreibung',
  'bugReport.field.severity': 'Schweregrad',
  'bugReport.field.steps': 'Schritte zum Reproduzieren',
  'bugReport.field.expected': 'Erwartet',
  'bugReport.field.actual': 'Tatsächlich',
  'bugReport.field.contact': 'Kontakt',
  'bugReport.placeholder.title': 'Z.B.: Fehler bei Stapelverarbeitung im AIO',
  'bugReport.placeholder.description': 'Beschreibe das Problem',
  'bugReport.placeholder.steps': '1. … 2. … 3. …',
  'bugReport.placeholder.contact': 'E-Mail, Discord, @Benutzer',
  'bugReport.severity.low': 'Niedrig',
  'bugReport.severity.medium': 'Mittel',
  'bugReport.severity.high': 'Hoch',
  'bugReport.severity.critical': 'Kritisch',
  'bugReport.preparingEvidence':
    'Screenshot und Protokolle werden vorbereitet…',
  'bugReport.dragToCrop': 'Ziehen, um einen optionalen Ausschnitt auszuwählen.',
  'bugReport.clearCrop': 'Ausschnitt entfernen',
  'bugReport.manualAttachments': 'Manuelle Anhänge',
  'bugReport.attach': 'Anhängen',
  'bugReport.attach.summary':
    'Max. {count} Dateien, je {size} MB. Gesamt: {total}.',
  'bugReport.attach.maxCount': 'Max. {count} Anhänge.',
  'bugReport.attach.fileTooLarge': '{name} > {size} MB.',
  'bugReport.attach.totalTooLarge': 'Gesamt > {size} MB.',
  'bugReport.attach.remove': '{name} entfernen',
  'bugReport.screenshotUnavailable': 'Screenshot nicht verfügbar.',
  'bugReport.error.bridgeUnavailable': 'Bridge nicht verfügbar.',
  'bugReport.error.prepareFailed':
    'Fehlerbericht konnte nicht vorbereitet werden.',
  'bugReport.error.noScreenshot': 'Kein Screenshot verfügbar.',
  'bugReport.error.fillTitleDescription': 'Titel und Beschreibung ausfüllen.',
  'bugReport.error.generic': 'Fehlgeschlagen.',
  'bugReport.success.sent': 'Bericht gesendet.{screenshot}',
  'bugReport.success.screenshot': 'Screenshot: {url}',
  'bugReport.legalPrefix':
    'Mit dem Absenden bestätigst du, dass du den Screenshot, die Protokolle und Anhänge überprüft hast. Material wird weitergeleitet gemäß',
  'bugReport.sending': 'Wird gesendet…',
  'bugReport.submit': 'Bericht absenden',
  'dashboard.topbar.tools': 'Werkzeuge',
  'dashboard.topbar.showSidebar': 'Seitenleiste anzeigen',
  'dashboard.topbar.sidebar': 'Seitenleiste',
  'dashboard.topbar.disableBatch': 'Stapelverarbeitung deaktivieren',
  'dashboard.topbar.enableBatch': 'Stapelverarbeitung aktivieren',
  'dashboard.topbar.batchStatus': 'Stapel · {count}t',
  'dashboard.topbar.threads': 'Threads',
  'dashboard.topbar.viewMode': 'Ansicht',
  'dashboard.topbar.paginated': 'Seitenweise',
  'dashboard.topbar.longStrip': 'Langer Streifen',
  'dashboard.topbar.rotate90': '90° drehen',
  'dashboard.topbar.selectImage': 'Bild auswählen',
  'dashboard.topbar.export': 'Exportieren',
  'dashboard.topbar.textFile': 'Textdatei',
  'dashboard.topbar.textPackage': 'Textpaket',
  'dashboard.topbar.imagePackage': 'Bildpaket',
  'dashboard.topbar.downloadTextAsTxt':
    'Lädt die Übersetzung als .txt herunter.',
  'dashboard.topbar.downloadVisualZip':
    'ZIP mit OCR- und Übersetzungs-.txt-Dateien pro Bild.',
  'dashboard.topbar.format': 'Format',
  'dashboard.topbar.quality': 'Qualität',
  'dashboard.topbar.package': 'Paket',
  'dashboard.topbar.rawText': 'Rohtext',
  'dashboard.topbar.translated': 'Übersetzt',
  'dashboard.topbar.inpainted': 'Inpainted',
  'dashboard.topbar.downloadTxt': 'TXT herunterladen',
  'dashboard.topbar.downloadZip': 'ZIP herunterladen',
  'dashboard.topbar.downloadPackage': 'Paket herunterladen',
  'dashboard.topbar.layeredPsd': 'PSD mit Ebenen',
  'dashboard.topbar.layeredPsdHint':
    'Exportiert PSD für Photoshop, CSP, Krita, GIMP.',
  'dashboard.topbar.compression': 'Komprimierung',
  'dashboard.topbar.dpi': 'DPI',
  'dashboard.topbar.ocrOverlay': 'OCR-Overlay',
  'dashboard.topbar.crops': 'Ausschnitte',
  'dashboard.topbar.rawTextLayer': 'Rohtextebene',
  'dashboard.topbar.translatedLayer': 'Übersetzungsebene',
  'dashboard.topbar.psTextLayers': 'PS-Textebenen',
  'dashboard.topbar.metadataJson': 'Metadaten-JSON',
  'dashboard.topbar.photoshopRequired':
    'Erfordert Adobe Photoshop (2025–cc2017).',
  'dashboard.topbar.generating': 'Wird generiert…',
  'dashboard.topbar.psdWithMeta': 'PSD + Meta',
  'dashboard.topbar.exportPsd': 'PSD exportieren',
  'dashboard.topbar.undoWorkspace': 'Arbeitsbereich rückgängig machen',
  'dashboard.topbar.undoShortcut': 'Rückgängig (Strg+Z)',
  'dashboard.topbar.redoWorkspace': 'Arbeitsbereich wiederherstellen',
  'dashboard.topbar.redoShortcut':
    'Wiederherstellen (Strg+Umschalt+Z / Strg+Y)',
  'dashboard.topbar.shortcuts': 'Tastenkürzel',
  'dashboard.topbar.shortcutsHint': 'Tastenkürzel (H)',
  'dashboard.topbar.hideTools': 'Werkzeuge ausblenden',
  'dashboard.topbar.showTools': 'Werkzeuge anzeigen',
  'dashboard.topbar.hide': 'Ausblenden',
  'dashboard.topbar.profile': 'Profil',
  'dashboard.topbar.exportWorkspace': 'Arbeitsbereich exportieren',
  'dashboard.topbar.importWorkspace': 'Arbeitsbereich importieren',
  'dashboard.topbar.clearLocalAutosave':
    'Lokale automatische Speicherung löschen',
  'dashboard.topbar.closeWorkspace': 'Arbeitsbereich schließen',
  'dashboard.topbar.replayTour': 'Tour erneut abspielen',
  'dashboard.topbar.scanlationFeed': 'Scanlation-Feed',
  'dashboard.topbar.rankings': 'Rankings',
  'dashboard.topbar.logout': 'Abmelden',
  'dashboard.topbar.brand': 'KŌMA Studio',
  'dashboard.topbar.autoManualBadge': 'A/M',
  'dashboard.topbar.zoomOut': 'Herauszoomen',
  'dashboard.topbar.zoomIn': 'Hineinzoomen',
  'dashboard.topbar.compressionRle': 'RLE',
  'dashboard.topbar.compressionZip': 'ZIP',
  'dashboard.topbar.compressionRaw': 'RAW',
  'dashboard.topbar.navigation': 'Navigation',
  'dashboard.topbar.optionPng': 'PNG',
  'dashboard.topbar.optionJpeg': 'JPEG',
  'dashboard.topbar.optionWebp': 'WEBP',
  'dashboard.topbar.optionPdf': 'PDF',
  'dashboard.topbar.optionCbz': 'CBZ',
  'dashboard.topbar.optionCb7': 'CB7',
  'dashboard.topbar.optionZip': 'ZIP',
  'renderPreview.circularText': 'Kreistext',
  'settings.aioPresets.description':
    'Modellkombinationen für die 5 AIO-Phasen nach Quellsprache. Wähle aus, welche Vorlage aktiv ist.',
  'settings.aioPresets.catalog': 'Katalog',
  'settings.aioPresets.syncingCatalog': 'Lokale + Cloud-Modelle werden synchronisiert.',
  'settings.aioPresets.editPreset': 'Vorlage bearbeiten',
  'settings.aioPresets.newPreset': 'Neue Vorlage',
  'settings.aioPresets.namePlaceholder': 'Z.B.: Japanisch HQ',
  'settings.aioPresets.sourceLanguage': 'Quellsprache',
  'settings.aioPresets.shortDescription': 'Kurze Beschreibung…',
  'settings.aioPresets.select': 'Auswählen',
  'settings.aioPresets.noneRegistered': 'Keine Vorlagen registriert.',
  'settings.aioPresets.createFirst': 'Erste erstellen',
  'settings.aioPresets.presetCount': '{count} Vorlage(n)',
  'settings.aioPresets.clearActive': 'Aktive deaktivieren',
  'settings.aioPresets.active': 'Aktiv',
  'settings.aioPresets.activate': 'Aktivieren',
  'settings.aioPresets.editNamed': '{name} bearbeiten',
  'settings.aioPresets.deleteNamed': '{name} löschen',
  'settings.pickerPalette.title': 'Farbpalette',
  'settings.pickerPalette.description':
    'Vorlagen für einfarbige und Verlaufsfarben in den Füllungswählern.',
  'settings.pickerPalette.newPreset': 'Neue Vorlage',
  'settings.pickerPalette.add': 'Hinzufügen',
  'settings.pickerPalette.reset': 'Zurücksetzen',
  'settings.pickerPalette.hintPrefix':
    'Akzeptiert einfarbige und Verläufe. Z.B.:',
  'settings.pickerPalette.hintOr': 'oder',
  'settings.pickerPalette.solids': 'Einfarbig',
  'settings.pickerPalette.gradients': 'Verläufe',
  'settings.modePresets.title': 'Modus-Vorlagen',
  'settings.modePresets.description':
    'Basisstil pro Textmodus. Wird automatisch im Dashboard angewandt.',
  'settings.modePresets.targetMode': 'Zielmodus',
  'settings.modePresets.outline': 'Kontur',
  'settings.modePresets.off': 'Aus',
  'settings.modePresets.outlineWidth': 'Konturbreite',
  'settings.modePresets.ocrGradient': 'OCR-Verlauf',
  'settings.modePresets.detect': 'Erkennen',
  'settings.modePresets.ignore': 'Ignorieren',
  'settings.modePresets.textColor': 'Textfarbe',
  'settings.modePresets.outlineColor': 'Konturfarbe',
  'settings.modePresets.all': 'Alle',
  'settings.modePresets.mode': 'Modus',
  'settings.modePresets.save': 'Speichern',
  'settings.typographerLibrary.title': 'Typesetter-Bibliothek',
  'settings.typographerLibrary.description':
    'Globale Stile mit Ordnern, Standardvorlage und Bindung nach erkanntem Modus.',
  'settings.typographerLibrary.newFolder': 'Neuer Ordner',
  'settings.typographerLibrary.defaultPreset': 'Standardvorlage',
  'settings.typographerLibrary.none': 'Keine',
  'settings.typographerLibrary.edit': 'Bearbeiten',
  'settings.typographerLibrary.new': 'Neu',
  'settings.typographerLibrary.presetTypographer': 'Typesetter-Vorlage',
  'settings.typographerLibrary.folder': 'Ordner',
  'settings.typographerLibrary.withoutFolder': 'Kein Ordner',
  'settings.typographerLibrary.descriptionPlaceholder':
    'Z.B.: Sprechblase DE-DE',
  'settings.typographerLibrary.padding': 'Innenabstand',
  'settings.typographerLibrary.lineSpacing': 'Zeilenabstand',
  'settings.updates.title': 'Updates',
  'settings.updates.currentVersion': 'Aktuelle Version',
  'settings.updates.newVersion': 'Neue Version',
  'settings.updates.status': 'Status',
  'settings.updates.channel': 'Kanal',
  'settings.updates.installOnClose': 'Beim Schließen installieren',
  'settings.updates.policy': 'Richtlinie',
  'settings.updates.mandatory': 'Pflicht',
  'settings.updates.optional': 'Optional',
  'settings.updates.lastCheck': 'Letzte Prüfung',
  'settings.updates.downloadCompleted': 'Download abgeschlossen',
  'settings.updates.channelTitle': 'Update-Kanal',
  'settings.updates.stableDesc': 'Getestete und stabile Veröffentlichungen',
  'settings.updates.betaDesc': 'Frühzeitiger Zugriff auf Funktionen',
  'settings.updates.installOnCloseTitle':
    'Update beim Schließen der App installieren',
  'settings.updates.installOnCloseDesc':
    'Wenn das Paket bereits heruntergeladen ist, wird die Installation beim Beenden automatisch gestartet.',
  'settings.updates.checking': 'Wird geprüft…',
  'settings.updates.checkNow': 'Jetzt nach Updates suchen',
  'settings.updates.download': 'Update herunterladen',
  'settings.autosave.title': 'Automatische Arbeitsbereichssicherung',
  'settings.autosave.description':
    'Legt fest, ob das Dashboard den lokalen Arbeitsbereich automatisch speichert und in welchem Intervall.',
  'settings.autosave.enableTitle': 'Automatische Sicherung aktivieren',
  'settings.autosave.enableDesc':
    'Wenn aktiviert, wird der Arbeitsbereich in regelmäßigen Abständen lokal gespeichert, sobald ungespeicherte Änderungen vorliegen.',
  'settings.autosave.interval': 'Intervall',
  'settings.autosave.save': 'Autosave speichern',
  'settings.shortcuts.title': 'Tastenkürzel-Center',
  'settings.shortcuts.description':
    'Die offizielle Tastenkürzel-Konfiguration befindet sich jetzt im Dashboard in der oberen Leiste. Dadurch werden Abweichungen zwischen dem Hauptbildschirm und der Einstellungsseite vermieden.',
  'settings.shortcuts.whereToEdit': 'Wo bearbeiten',
  'settings.shortcuts.whereToEditDesc': 'Öffne das Dashboard und verwende',
  'settings.shortcuts.orPress': 'oder drücke',
  'settings.tabs.ariaLabel': 'Einstellungs-Tabs',
  'settings.integrations.test': 'Testen',
  'settings.integrations.testing': 'Wird getestet…',
  'settings.integrations.ok': '✓ OK',
  'settings.integrations.failed': '✗ Fehlgeschlagen',
  'settings.integrations.saved': '✓ Gespeichert',
  'settings.integrations.discord.description':
    'Verarbeitungsbenachrichtigungen, Fehler und Kontingent-Warnungen.',
  'settings.integrations.discord.webhookUrl': 'Webhook-URL',
  'settings.integrations.discord.webhookPlaceholder':
    'https://discord.com/api/webhooks/…',
  'settings.integrations.discord.botName': 'Bot-Name',
  'settings.integrations.discord.webhookActive': 'Webhook aktiv',
  'settings.integrations.discord.howToSetup': 'Einrichtung',
  'settings.integrations.discord.step1': 'In Discord:',
  'settings.integrations.discord.step1Strong':
    'Servereinstellungen → Integrationen → Webhooks → Neuer Webhook',
  'settings.integrations.discord.step2':
    'Kopiere die URL und füge sie im obigen Feld ein.',
  'dashboard.dashboardLlm.extraContextPlaceholder':
    'Zusätzlicher Kontext: Charaktere, Tonfall, Glossar…',
  'dashboard.dashboardLlm.temperature': 'Temperatur',
  'dashboard.dashboardLlm.topP': 'Top P',
  'dashboard.dashboardLlm.maxTokens': 'Max. Tokens',
  'dashboard.dashboardLlm.translationProfile': 'Übersetzungsprofil',
  'dashboard.dashboardLlm.translationModelPlaceholder': 'gpt-4.1, claude…',
  'dashboard.dashboardLlm.apiKey': 'API-Schlüssel',
  'dashboard.dashboardLlm.apiKeyPlaceholder': 'sk-… (optional)',
  'dashboard.dashboardLlm.ocrProfile': 'OCR-Profil',
  'dashboard.dashboardLlm.openAiCompatibleHint':
    'OpenAI-kompatibel. Basis kann /v1 oder der vollständige Endpunkt sein. Manche akzeptieren einen leeren Schlüssel.',
  'dashboard.dashboardLlm.clear': 'Leeren',
  'dashboard.dashboardLlm.use': 'Verwenden',
  'dashboard.dashboardLlm.remove': 'Entfernen',
  'dashboard.dashboardLlm.save': 'Speichern',
  'dashboard.dashboardLlm.hdStrategy': 'HD-Strategie',
  'dashboard.dashboardLlm.resize': 'Skalieren',
  'dashboard.dashboardLlm.crop': 'Zuschneiden',
  'dashboard.dashboardLlm.original': 'Original',
  'dashboard.dashboardLlm.hdStrategyHint':
    'Strategie für große Bilder vor dem Inpainting.',
  'dashboard.dashboardLlm.resizeLimit': 'Skalierungslimit',
  'dashboard.dashboardLlm.cropMargin': 'Zuschneiderand',
  'dashboard.dashboardLlm.cropTriggerSize': 'Zuschneide-Auslösegröße',
  'dashboard.dashboardRegion.title': 'Bereich',
  'dashboard.dashboardRegion.blocks': 'Blöcke',
  'dashboard.dashboardRegion.selection': 'Auswahl',
  'dashboard.dashboardRegion.ocr': 'OCR',
  'dashboard.dashboardRegion.translation': 'Übersetzung',
  'dashboard.dashboardRegion.notes': 'Notizen',
  'dashboard.dashboardRegion.segments': 'Segmente',
  'dashboard.dashboardRegion.disabled': 'deaktiviert',
  'dashboard.dashboardRegion.manualHint':
    'Ziehe in der Vorschau, um Bereiche hinzuzufügen. Verwende die Ecken zum Ändern der Größe.',
  'dashboard.dashboardRegion.manualModeHint':
    'Manueller Modus zum Anpassen der Boxen.',
  'dashboard.dashboardRegion.dockHint':
    'Verwende das schwebende Dock auf der Leinwand für Bereich auswählen, Bereinigen und Bearbeiten. Werkzeuge werden basierend auf der aktiven Phase aktiviert.',
  'dashboard.translator.workspace.ariaLabel': 'Übersetzer-Modus',
  'dashboard.translator.sourceTitle': 'Quelltext',
  'dashboard.translator.sourceDescription':
    'Einfügen, importieren und übersetzen unter Beibehaltung von Absätzen und Zeilenumbrüchen.',
  'dashboard.translator.sourcePlaceholder':
    'Füge hier das Kapitel oder den Textauszug zum Übersetzen ein…',
  'dashboard.translator.sourceAria': 'Quelltext für Übersetzung',
  'dashboard.translator.import': 'Importieren',
  'dashboard.translator.translating': 'Wird übersetzt…',
  'dashboard.translator.translate': 'Übersetzen',
  'dashboard.translator.editorCleared': 'Editor geleert.',
  'dashboard.translator.clear': 'Leeren',
  'dashboard.translator.resultTitle': 'Ergebnis',
  'dashboard.translator.resultModelPrefix': 'Modell: {value}',
  'dashboard.translator.resultPlaceholder':
    'Ausführen, um das Ergebnis zu sehen.',
  'dashboard.translator.resultFieldPlaceholder':
    'Die Übersetzung wird hier angezeigt…',
  'dashboard.translator.resultPlaceholderAria': 'Übersetzungsergebnis',
  'dashboard.translator.editorDirty':
    'Quelltext geändert. Erneut ausführen, um zu aktualisieren.',
  'dashboard.translator.resultCopied': 'Ergebnis kopiert.',
  'dashboard.translator.copy': 'Kopieren',
  'dashboard.translator.downloadTxt': 'TXT herunterladen',
  'dashboard.translator.modeLabel': 'Übersetzer',
  'dashboard.translator.workspace.textHint':
    'Freitext übersetzen unter Beibehaltung von Absätzen und Zeilenumbrüchen.',
  'dashboard.translator.workspace.visualHint':
    'Bereiche erkennen, OCR und Boxen in Bildern übersetzen.',
  'dashboard.translator.processing.standard': 'Standard',
  'dashboard.translator.processing.aiSfx': 'KI-SFX',
  'dashboard.language.source': 'Quellsprache',
  'dashboard.language.target': 'Zielsprache',
  'dashboard.models.title': 'Modelle',
  'dashboard.translator.ocr': 'OCR',
  'dashboard.translator.ocr.manageModels': 'OCR-Modelle verwalten',
  'dashboard.translator.noneAvailable': 'Keine Modelle',
  'dashboard.translator.device': 'Gerät',
  'dashboard.translator.languages': 'Sprachen',
  'dashboard.translator.multi': 'multi',
  'dashboard.translator.noDescription': 'Keine Beschreibung.',
  'dashboard.translator.localStatus': 'Lokaler Status: {value}',
  'dashboard.translator.sfx.cleanModel': 'Cleaner-SFX',
  'dashboard.translator.sfx.hint':
    'Z.B.: kurze und kräftige SFX bevorzugen, bei Effekten in feiner Linienarbeit konservativer sein.',
  'dashboard.translator.llm.contextPlaceholder':
    'Kontext: Glossar, Tonfall, Charaktere…',
  'dashboard.translator.llm.generateNotes': 'Separate TNs generieren',
  'dashboard.translator.llm.multimodalContext': 'Bild als multimodaler Kontext',
  'dashboard.translator.llm.temperature': 'Temperatur',
  'dashboard.translator.llm.topP': 'Top P',
  'dashboard.translator.llm.maxTokens': 'Max. Tokens',
  'dashboard.translator.execute.title': 'Ausführen',
  'dashboard.translator.loadImage': 'Laden',
  'dashboard.translator.detectTranslate': 'Erkennen + Übersetzen',
  'dashboard.translator.retranslateImage': 'Bild neu übersetzen',
  'dashboard.translator.retranslateRegion': 'Bereich neu übersetzen',
  'dashboard.translator.regionTitle': 'Bereich',
  'dashboard.translator.blocks': 'Blöcke',
  'dashboard.translator.selection': 'Auswahl',
  'dashboard.translator.translation': 'Übersetzung',
  'dashboard.translator.notes': 'Notizen',
  'dashboard.translator.none': 'keine',
  'dashboard.translator.charactersTranslated': '{count} Zeichen übersetzt.',
  'splitter.workspace.emptyTitle': 'Bild laden',
  'splitter.workspace.emptyDescription':
    'Verwende die linke Seitenleiste, um Seiten zu importieren. Die Vorschau zeigt vorgeschlagene Schnitte und generierte Segmente.',
  'splitter.workspace.previewTitle': 'Schnittvorschau',
  'splitter.workspace.previewDescription':
    'Doppelklicke, um einen Schnitt hinzuzufügen. Ziehe die Linien zum Anpassen.',
  'splitter.workspace.previewAlt': 'Vorschau von {name}',
  'splitter.workspace.cutTitle': 'Schnitt {index}',
  'splitter.workspace.hide': 'Ausblenden',
  'splitter.workspace.show': 'Anzeigen',
  'splitter.workspace.recalculate': 'Neu berechnen',
  'splitter.workspace.diagnostics': 'Diagnose',
  'splitter.workspace.engine': 'Engine',
  'splitter.workspace.cuts': 'Schnitte',
  'splitter.workspace.segments': 'Segmente',
  'splitter.workspace.whitespace': 'Leerraum',
  'splitter.workspace.noWarnings': 'Keine Warnungen für das aktive Bild.',
  'splitter.workspace.cutsTitle': 'Schnitte ({count})',
  'splitter.workspace.cutCard': 'Schnitt #{index}',
  'splitter.workspace.locked': 'Gesperrt',
  'splitter.workspace.unlocked': 'Entsperrt',
  'splitter.workspace.merge': 'Zusammenführen',
  'splitter.workspace.segmentsTitle': 'Segmente ({count})',
  'splitter.workspace.segmentAlt': 'Segment {index}',
  'splitter.workspace.segmentCard': 'Segment #{index}',
  'splitter.workspace.analyzing': 'Wird analysiert…',
  'splitter.workspace.dimensions': 'Abmessungen',
  'splitter.workspace.axis': 'Achse',
  'splitter.workspace.strategy': 'Strategie',
  'splitter.sidebar.title': 'Splitter',
  'splitter.sidebar.recipe': 'Rezept',
  'splitter.sidebar.preset': 'Vorlage',
  'splitter.sidebar.mode': 'Modus',
  'splitter.sidebar.direction': 'Richtung',
  'splitter.sidebar.vertical': 'Vertikal',
  'splitter.sidebar.horizontal': 'Horizontal',
  'splitter.sidebar.parts': 'Teile',
  'splitter.sidebar.targetHeight': 'Zielhöhe',
  'splitter.sidebar.minimum': 'Minimum',
  'splitter.sidebar.maximum': 'Maximum',
  'splitter.sidebar.adjustments': 'Anpassungen',
  'splitter.sidebar.overlap': 'Überlappung ({value}px)',
  'splitter.sidebar.whitespace': 'Leerraum ({value})',
  'splitter.sidebar.noise': 'Rauschen ({value})',
  'splitter.sidebar.edgeGuard': 'Randschutz ({value}px)',
  'splitter.sidebar.protectTallBlocks': 'Hohe Blöcke schützen',
  'splitter.sidebar.baseName': 'Basisname',
  'splitter.sidebar.baseNamePlaceholder': 'koma-split',
  'splitter.sidebar.suffix': 'Suffix',
  'splitter.sidebar.suffixPlaceholder': '{image}-teil-{index}',
  'splitter.sidebar.tokensPrefix': 'Tokens:',
  'splitter.sidebar.tokensAnd': 'und',
  'splitter.sidebar.actions': 'Aktionen',
  'splitter.sidebar.imagesCount': '{count} Bild(er)',
  'splitter.sidebar.activeImage': 'Aktiv: {name}',
  'splitter.sidebar.selectImage': 'Bild auswählen.',
  'splitter.sidebar.reanalyze': 'Erneut analysieren',
  'splitter.sidebar.applyToActive': '→ Aktives',
  'splitter.sidebar.applyToAll': '→ Alle',
  'splitter.sidebar.clearCuts': 'Schnitte entfernen',
  'splitter.sidebar.resetRecipe': 'Rezept zurücksetzen',
  'splitter.sidebar.exportActive': 'Aktives exportieren',
  'splitter.sidebar.exportBatch': 'Stapel exportieren',
  'splitter.sidebar.directoryUnavailable':
    'showDirectoryPicker nicht verfügbar.',
  'splitter.sidebar.exportToFolder': 'In Ordner exportieren',
  'stitch.workspace.cancelled': 'Stitcher-Rendering abgebrochen.',
  'stitch.workspace.renderingBatch':
    'Stapel {current}/{total} wird gerendert...',
  'stitch.workspace.batchReady': 'Stapel {current} bereit zum Herunterladen.',
  'stitch.workspace.generatingZip':
    '{count} Stitcher-Stapel werden generiert...',
  'stitch.workspace.zipReady':
    'ZIP-Paket mit {count} Stapel(n) erfolgreich generiert.',
  'stitch.workspace.savingToFolder':
    '{count} Stapel werden in Ordner gespeichert...',
  'stitch.workspace.folderReady':
    'Stapel in den ausgewählten Ordner exportiert.',
  'stitch.workspace.folderCancelled': 'Ordner-Export abgebrochen.',
  'stitch.workspace.noBatchSelected': 'Kein Stapel ausgewählt',
  'stitch.workspace.previewEyebrow': 'Stapelvorschau',
  'stitch.workspace.batchTitle': 'Stapel {current} von {total}',
  'stitch.workspace.noBatchAvailable': 'Kein Stapel verfügbar',
  'stitch.workspace.imagesCount': '{count} Bild(er)',
  'stitch.workspace.previousBatch': 'Vorheriger Stapel',
  'stitch.workspace.nextBatch': 'Nächster Stapel',
  'stitch.workspace.zoomOut': 'Herauszoomen',
  'stitch.workspace.resetZoom': 'Zoom zurücksetzen',
  'stitch.workspace.zoomIn': 'Hineinzoomen',
  'stitch.workspace.exporting': 'Wird exportiert…',
  'stitch.workspace.exportBatch': 'Stapel exportieren',
  'stitch.workspace.zip': 'ZIP',
  'stitch.workspace.folder': 'Ordner',
  'stitch.workspace.cancel': 'Abbrechen',
  'stitch.workspace.emptyTitle': 'Kein Stapel bereit',
  'stitch.workspace.emptyDescription':
    'Lade Bilder im Dashboard und konfiguriere Stapel in der rechten Seitenleiste.',
  'stitch.workspace.generatingPreview': 'Vorschau wird generiert {progress}%',
  'stitch.workspace.previewAlt': 'Vorschau des zusammengefügten Stapels',
  'stitch.workspace.errorTitle': 'Stitcher fehlgeschlagen',
  'stitch.workspace.planningEyebrow': 'Planung',
  'stitch.workspace.planningTitle': '{count} Stapel geplant',
  'stitch.workspace.planningSubtitle':
    'Überprüfe umfangreiche Stapel und durchsuche den Plan.',
  'stitch.workspace.baseLabel': 'Basis:',
  'stitch.workspace.batchCardTitle': 'Stapel {index}',
  'stitch.workspace.batchCardDims': '{count} Bild(er) · {width}×{height}',
  'stitch.workspace.activeBatch': 'Aktiver Stapel',
  'stitch.workspace.stats.images': 'Bilder',
  'stitch.workspace.stats.output': 'Ausgabe',
  'stitch.workspace.stats.size': 'Größe',
  'stitch.workspace.stats.preview': 'Vorschau',
  'stitch.workspace.awaiting': 'Ausstehend',
  'stitch.workspace.toolboxTitle': 'Werkzeugkasten',
  'stitch.workspace.toolboxDescription':
    'Einstellungen und Grenzanpassungen befinden sich in der rechten Seitenleiste.',
  'stitch.sidebar.title': 'Stitcher',
  'stitch.sidebar.layout': 'Layout',
  'stitch.sidebar.layoutMode': 'Zusammenfügemodus',
  'stitch.sidebar.vertical': 'Vertikal',
  'stitch.sidebar.horizontal': 'Horizontal',
  'stitch.sidebar.strategy': 'Strategie',
  'stitch.sidebar.fixedCount': 'Feste Anzahl',
  'stitch.sidebar.targetAxis': 'Ziel nach Achse',
  'stitch.sidebar.single': 'Alles in einem',
  'stitch.sidebar.imagesPerBatch': 'Bilder pro Stapel',
  'stitch.sidebar.spacing': 'Abstand ({value}px)',
  'stitch.sidebar.alignment': 'Ausrichtung',
  'stitch.sidebar.start': 'Anfang',
  'stitch.sidebar.center': 'Mitte',
  'stitch.sidebar.end': 'Ende',
  'stitch.sidebar.output': 'Ausgabe',
  'stitch.sidebar.background': 'Hintergrund',
  'stitch.sidebar.backgroundColor': 'Hintergrundfarbe',
  'stitch.sidebar.baseName': 'Basisname',
  'stitch.sidebar.baseNamePlaceholder': 'koma-stitch',
  'stitch.sidebar.imagesInfo':
    '{count} Bild(er). Die aktuelle Reihenfolge bestimmt die Stapel.',
  'stitch.sidebar.recalculate': 'Stapel neu berechnen',
  'stitch.sidebar.boundary': 'Grenze',
  'stitch.sidebar.boundaryBatch': 'Stapel {current}/{total} · {count} Bild(er)',
  'stitch.sidebar.noBatch': 'Kein Stapel',
  'stitch.sidebar.moveLastToNext': 'Letztes → nächster',
  'stitch.sidebar.pullFromNext': 'Vom nächsten holen',
  'modelManager.filters.catalog': 'Katalog',
  'modelManager.filters.all': 'Alle',
  'modelManager.filters.local': 'Lokal',
  'modelManager.filters.cloud': 'Cloud',
  'modelManager.filters.language': 'Sprache',
  'modelManager.filters.status': 'Status',
  'modelManager.filters.installed': 'Installiert',
  'modelManager.filters.notInstalled': 'Nicht installiert',
  'modelManager.filters.updateAvailable': 'Update verfügbar',
  'modelManager.tooltip.speed.fast': 'Schnell',
  'modelManager.tooltip.speed.good': 'Gut',
  'modelManager.tooltip.speed.excellent': 'Ausgezeichnet',
  'modelManager.tooltip.allLanguages': 'Alle unterstützten Sprachen',
  'modelManager.tooltip.infoAria': 'Modellinformationen für {name}',
  'modelManager.tooltip.info': 'Info',
  'modelManager.tooltip.aioStage': 'AIO-Phase',
  'modelManager.tooltip.description': 'Beschreibung',
  'modelManager.tooltip.languages': 'Sprachen',
  'modelManager.tooltip.speed.label': 'Geschwindigkeit',
  'modelManager.tooltip.minimum': 'Minimum',
  'modelManager.tooltip.downloadSize': 'Downloadgröße',
  'modelManager.tooltip.diskSpace': 'Speicherplatz',
  'modelManager.tooltip.version': 'Version',
  'modelManager.status.installed': 'Installiert',
  'modelManager.status.updateAvailable': 'Update verfügbar',
  'modelManager.status.downloading': 'Wird heruntergeladen',
  'modelManager.status.queued': 'In Warteschlange',
  'modelManager.status.verifying': 'Wird überprüft',
  'modelManager.status.failed': 'Fehlgeschlagen',
  'modelManager.status.cancelled': 'Abgebrochen',
  'modelManager.status.incomplete': 'Unvollständig',
  'modelManager.status.notInstalled': 'Nicht installiert',
  'modelManager.actions.selected': 'Ausgewählt',
  'modelManager.actions.useModel': 'Modell verwenden',
  'modelManager.actions.uninstall': 'Deinstallieren',
  'modelManager.actions.update': 'Aktualisieren',
  'modelManager.actions.retry': 'Erneut versuchen',
  'modelManager.actions.install': 'Installieren',
  'modelManager.actions.source': 'Quelle',
  'modelCard.status.selected': 'Ausgewählt',
  'modelCard.status.failed': 'Fehlgeschlagen',
  'modelCard.status.verifying': 'Wird überprüft…',
  'modelCard.status.queued': 'In Warteschlange…',
  'modelCard.status.downloading': 'Wird heruntergeladen…',
  'modelCard.status.cancelled': 'Abgebrochen',
  'modelCard.status.incomplete': 'Unvollständig',
  'modelCard.status.notInstalled': 'Nicht installiert',
  'modelCard.action.cancel': 'Abbrechen',
  'modelCard.action.remove': 'Entfernen',
  'modelCard.action.update': 'Aktualisieren',
  'modelCard.action.install': 'Installieren',
  'modelCard.action.retry': 'Erneut versuchen',
  'modelCard.action.active': 'Aktiv',
  'modelCard.action.use': 'Verwenden',
  'modelManager.stage.translate': 'Übersetzungen abrufen',
  'modelManager.installAll.attention': 'Achtung',
  'modelManager.installAll.warning':
    'Du bist dabei, ALLE Übersetzungsmodelle herunterzuladen.',
  'modelManager.installAll.totalSize': 'Gesamtgröße: {size}',
  'modelManager.installAll.space': 'Verfügbarer Speicher: {space}',
  'modelManager.installAll.time':
    'Geschätzte Dauer: abhängig von deiner Verbindung',
  'modelManager.installAll.notEnoughSpace':
    'Nicht genügend Speicherplatz. Benötigt: {required} | Verfügbar: {available}',
  'modelManager.installAll.confirm':
    'Dies kann lange dauern und erheblichen Speicherplatz beanspruchen. Möchtest du fortfahren?',
  'modelManager.installAll.confirmDownload': 'Download bestätigen',
  'modelManager.disk.notVerified': 'Speicherplatz nicht geprüft',
  'modelManager.disk.free': '{space} frei',
  'modelManager.disk.models': '{installed}/{total} Modelle ({size})',
  'modelManager.enhance.title': 'Verbesserungsmodelle',
  'modelManager.enhance.description':
    'Exklusiver lokaler Katalog für den Enhancer. Installieren, aktualisieren, deinstallieren oder ein ONNX importieren.',
  'modelManager.enhance.freeSpace': 'Freier Speicher',
  'modelManager.enhance.notChecked': 'nicht geprüft',
  'modelManager.enhance.closeAria': 'Dialog für Verbesserungsmodelle schließen',
  'modelManager.enhance.directInstall': 'Direktinstallation',
  'modelManager.enhance.directInstallDesc':
    'Kuratierte Modelle mit direktem Download oder verwalteter Installation auf dem Mini-Backend.',
  'modelManager.enhance.manualImport': 'Manueller Import',
  'modelManager.enhance.manualImportDesc':
    'Im Katalog gelistete Modelle, die über lokales ONNX geladen werden. Externe Konvertierung verwenden, wenn nur `.pth` verfügbar ist.',
  'modelManager.enhance.importOnnxBadge': 'ONNX-Import',
  'modelManager.enhance.statusLabel': 'Status',
  'modelManager.enhance.estimatedDisk': 'Geschätzter Speicher',
  'modelManager.enhance.reimportOnnx': 'ONNX erneut importieren',
  'modelManager.enhance.pthHint': 'Für Gewichte in',
  'modelManager.enhance.pthHintSuffix':
    'zuerst in ONNX konvertieren und dann den manuellen Import verwenden.',
  'common.yes': 'Ja',
  'dashboard.organize.hint.reorder':
    'Dateien im linken Bereich ziehen und neu ordnen.',
  'dashboard.organize.hint.rotate':
    'Verwende die Drehschaltfläche, um horizontal gescannte Seiten zu korrigieren.',
  'guides.common.beginner': 'Einsteiger',
  'guides.common.intermediate': 'Fortgeschritten',
  'guides.common.advanced': 'Experte',
  'guides.home.title': 'Anleitungen & Tutorials',
  'guides.home.description':
    'Lerne mit Schritt-für-Schritt-Anleitungen, Produktivitätstipps und praxisnahen Beispielen jedes Werkzeug in KŌMA Studio zu beherrschen.',
  'guides.home.searchPlaceholder': 'Anleitungen, Tastenkürzel, Tipps suchen...',
  'guides.home.searchAria': 'Anleitungen durchsuchen',
  'guides.home.continueReading': 'Dort weiterlesen, wo du aufgehört hast',
  'guides.home.stepProgress': 'Schritt {current} von {total} · {time}',
  'guides.home.continueCta': 'Weiter →',
  'guides.home.categories': 'Kategorien',
  'guides.home.guidesCountLabel': 'Anleitung{suffix}',
  'guides.home.completedCountLabel': 'abgeschlossen{suffix}',
  'guides.home.guidesPluralSuffix': 'en',
  'guides.home.saved': 'Gespeichert ({count})',
  'guides.reader.backToGuides': 'Zurück zu Anleitungen',
  'guides.reader.notFound': 'Anleitung nicht gefunden',
  'guides.reader.progressAria': 'Anleitungsfortschritt',
  'guides.reader.stepsAria': 'Anleitungsschritte',
  'guides.reader.stepLabel': 'Schritt {index}',
  'guides.reader.recent': 'Zuletzt',
  'guides.reader.guides': 'Anleitungen',
  'guides.reader.removeBookmark': 'Lesezeichen entfernen',
  'guides.reader.saveBookmark': 'Lesezeichen setzen',
  'guides.reader.previous': 'Zurück',
  'guides.reader.next': 'Weiter',
  'guides.reader.completeGuide': 'Anleitung abschließen',
  'guides.detail.back': 'Zurück',
  'guides.detail.notFound': 'Anleitung nicht gefunden.',
  'guides.detail.stepsAria': 'Anleitungsschritte',
  'guides.detail.stepLabel': 'Schritt {index}',
  'guides.detail.recent': 'Zuletzt',
  'guides.detail.guides': 'Anleitungen',
  'guides.detail.stepCounter': 'Schritt {current} von {total}',
  'guides.detail.previous': 'Zurück',
  'guides.detail.next': 'Weiter',
  'guides.detail.complete': 'Abschließen',
  'guides.detail.completed': 'Abgeschlossen ✓',
  'guides.detail.tocAria': 'Inhaltsverzeichnis',
  'guides.detail.inThisGuide': 'In dieser Anleitung',
  'guides.detail.removeFavorite': 'Favorit entfernen',
  'guides.detail.addFavorite': 'Als Favorit hinzufügen',
  'guides.detail.saved': 'Gespeichert',
  'guides.detail.save': 'Speichern',
  'guides.step.copyCode': 'Code kopieren',
  'guides.step.copied': 'Kopiert',
  'guides.step.copy': 'Kopieren',
  'guides.search.dialogAria': 'Anleitungen durchsuchen',
  'guides.search.placeholder': 'Anleitungen, Tastenkürzel, Tipps suchen...',
  'guides.search.inputAria': 'Suche',
  'guides.search.close': 'Suche schließen',
  'guides.search.noResults': 'Keine Ergebnisse für „{query}"',
  'guides.search.results': 'Ergebnisse ({count})',
  'guides.search.recent': 'Zuletzt',
  'guides.search.navigate': 'navigieren',
  'guides.search.open': 'öffnen',
  'guides.search.closeVerb': 'schließen',
  'guides.category.searchPlaceholder': 'In {category} suchen...',
  'guides.category.searchAria': 'In {category} suchen',
  'guides.category.noSearchResults': 'Keine Anleitungen für „{query}"',
  'guides.category.noGuides': 'Keine Anleitungen in dieser Kategorie',
  'guides.category.tryOtherTerms': 'Versuche andere Suchbegriffe.',
  'guides.category.comingSoon': 'Neue Anleitungen werden bald hinzugefügt.',
  'guides.category.completed': 'Abgeschlossen',
  'settings.profile.title': 'Benutzerprofil',
  'settings.profile.name': 'Name',
  'settings.profile.email': 'E-Mail',
  'settings.profile.verification': 'Verifizierung',
  'settings.profile.accountId': 'Konto-ID',
  'settings.profile.environment': 'Umgebung',
  'settings.profile.unspecified': 'Nicht angegeben',
  'settings.profile.verified': 'Verifiziert',
  'settings.profile.pending': 'Ausstehend',
  'settings.profile.sendVerification': 'Bestätigungs-E-Mail senden',
  'settings.profile.legalCenter': 'Rechtszentrum',
  'settings.travel.title': 'Reise-Zugang',
  'settings.travel.description':
    'Autorisiere vorübergehend einen zweiten Computer, ohne das mit dem Konto verknüpfte Hauptgerät zu wechseln.',
  'settings.travel.destination': 'Token-Ziel',
  'settings.travel.expiry': 'Code-Ablauf',
  'settings.travel.temporaryAccess': 'Vorübergehender Zugang',
  'settings.travel.streamLike': 'Von Streaming-Plattformen inspirierter Ablauf',
  'settings.travel.streamLikeDesc':
    'Der Code wird an die Konto-E-Mail gesendet und gewährt vorübergehenden Zugang auf einem anderen PC.',
  'settings.travel.sendToken': 'Token an meine E-Mail senden',
  'settings.travel.destinationPrefix': 'Ziel: {value}',
  'settings.travel.expirationPrefix': 'Ablauf: {value}',
  'settings.travel.accessPrefix': 'Zugang: {value}',
  'settings.travel.definedOnSend': 'Wird beim Senden festgelegt',
  'settings.plan.day': 'Tag',
  'settings.plan.days': 'Tage',
  'settings.typography.default': 'Standard',
  'settings.typography.bindingsTitle': 'Bindungen nach erkanntem Modus',
  'settings.typography.useDefault': 'Standard verwenden',
  'settings.integrations.blogger.description':
    'Speicher/CDN für Bilder und Beitragsveröffentlichung.',
  'settings.integrations.blogger.label': 'Bezeichnung',
  'settings.integrations.blogger.labelPlaceholder': 'Haupt-Blogger',
  'settings.integrations.blogger.blogId': 'Blog-ID',
  'settings.integrations.blogger.blogIdPlaceholder': 'Numerische ID',
  'settings.integrations.blogger.clientId': 'Client-ID',
  'settings.integrations.blogger.clientIdPlaceholder': 'Google OAuth Client-ID',
  'settings.integrations.blogger.clientSecret': 'Client-Secret',
  'settings.integrations.blogger.clientSecretPlaceholder':
    'OAuth Client-Secret',
  'settings.integrations.blogger.refreshToken': 'Refresh-Token',
  'settings.integrations.blogger.refreshTokenPlaceholder': 'Refresh-Token',
  'settings.integrations.blogger.defaultLabels': 'Standard-Labels',
  'settings.integrations.blogger.defaultLabelsPlaceholder':
    'manga, kapitel, release',
  'settings.integrations.blogger.optimizer': 'Optimierer',
  'settings.integrations.blogger.optimizerCloudinary': 'Cloudinary Fetch',
  'settings.integrations.blogger.optimizerTemplate': 'URL-Vorlage',
  'settings.integrations.blogger.cloudName': 'Cloud-Name',
  'settings.integrations.blogger.urlTemplate': 'URL-Vorlage',
  'settings.integrations.blogger.cloudNamePlaceholder': 'mein-cloud-name',
  'settings.integrations.blogger.cloudinaryTransformation':
    'Cloudinary-Transformation',
  'settings.integrations.blogger.optimizerEnabled': 'Optimierer aktiv',
  'settings.integrations.blogger.maxWidth': 'Max. Breite',
  'settings.integrations.blogger.maxHeight': 'Max. Höhe',
  'settings.integrations.blogger.testConnection': 'Verbindung testen',
  'settings.integrations.blogger.requestsPerDay': 'Anfragen/Tag',
  'settings.integrations.blogger.requestsPerUser': 'Anfragen/Benutzer',
  'settings.integrations.blogger.credentialsGuideTitle':
    'So erhältst du die Anmeldedaten',
  'settings.integrations.blogger.step1': 'Gehe zu',
  'settings.integrations.blogger.step1Suffix':
    'Erstelle oder wähle ein Projekt.',
  'settings.integrations.blogger.step2': 'Aktiviere die',
  'settings.integrations.blogger.step2And': 'und die',
  'settings.integrations.blogger.step3': 'Erstelle eine',
  'settings.integrations.blogger.webApplication': 'Webanwendung',
  'settings.integrations.blogger.step4': 'Füge',
  'settings.integrations.blogger.step4Suffix':
    'zu den Weiterleitungs-URIs hinzu.',
  'settings.integrations.blogger.step5': 'Kopiere',
  'settings.integrations.blogger.step5And': 'und',
  'settings.integrations.blogger.step6':
    'Konfiguriere den OAuth-Zustimmungsbildschirm. Im Testmodus füge deine E-Mail hinzu.',
  'settings.integrations.blogger.step7': 'Im',
  'settings.integrations.blogger.step7Suffix':
    'aktiviere deine eigenen Anmeldedaten und autorisiere die Blogger- und Drive-Scopes.',
  'settings.integrations.blogger.step8': 'Führe',
  'settings.integrations.blogger.step8Suffix': 'durch und kopiere den',
  'settings.integrations.blogger.step9': 'Für Cloudinary kopiere den',
  'settings.integrations.blogger.step9Suffix':
    'und konfiguriere die Transformation.',
  'settings.integrations.blogger.step10': 'Finde die',
  'settings.integrations.blogger.step10Suffix': 'über die Blogger-URL/API.',
  'settings.integrations.blogger.step11':
    'Alles speichern, Verbindung testen und das Hilfsmittel im Dashboard verwenden.',
  'settings.integrations.blogger.googleQuotas': 'Google-Kontingente',
  'settings.integrations.blogger.oauthPlayground': 'OAuth Playground',
  'settings.integrations.blogger.cloudinaryFetch': 'Cloudinary Fetch',
  'settings.integrations.blogger.driveScopes': 'Drive-Scopes',
  'settings.integrations.blogger.driveScopesGuideTitle':
    'Drive-Scopes im OAuth Playground',
  'settings.integrations.blogger.minimumPractical': 'Praktisches Minimum:',
  'settings.integrations.blogger.driveScopesNote':
    'Weitere Scopes findest du in der offiziellen Drive API v3-Dokumentation.',
  'settings.integrations.imgur.title': 'Imgur-Upload',
  'settings.integrations.imgur.description':
    'Anonymer Upload mit Client-ID-Rotation und konservativem Rate-Limiting.',
  'settings.integrations.imgur.limitPerHour': 'Limit/Stunde',
  'settings.integrations.imgur.batchDelay': 'Stapelverzögerung (ms)',
  'settings.integrations.imgur.remaining': 'Verbleibend',
  'settings.integrations.imgur.used': 'Verwendet: {used}/{limit}',
  'settings.integrations.imgur.reset': 'Zurücksetzung: {value}',
  'settings.integrations.imgur.clientIds': 'Client-IDs',
  'settings.integrations.imgur.noClientIds': 'Keine Client-IDs konfiguriert.',
  'settings.integrations.imgur.clientIdPlaceholder': 'Imgur Client-ID',
  'settings.integrations.imgur.quickGuideTitle': 'Imgur-Kurzanleitung',
  'settings.integrations.imgur.step1':
    'Erstelle eine Anwendung im Imgur-Entwickler-Dashboard und kopiere die',
  'settings.integrations.imgur.step2':
    'Füge eine oder mehrere Client-IDs hinzu. Die App wählt zufällig eine aus.',
  'settings.integrations.imgur.step3': 'Anonymer Upload mit',
  'settings.integrations.imgur.step3Suffix': 'Kein OAuth.',
  'settings.integrations.imgur.step4': 'Konservativer Limiter:',
  'settings.integrations.imgur.step4Suffix': 'um Sperrungen zu vermeiden.',
  'settings.integrations.imgur.step5':
    'Sequenzieller Upload unter Einhaltung der konfigurierten Verzögerung.',
  'settings.integrations.imgur.step6':
    'Imgur sollte nicht als garantiertes CDN betrachtet werden.',
  'settings.integrations.imgur.imageApi': 'Imgur Image API',
  'settings.integrations.imgur.uploading': 'Imgur wird hochgeladen',
  'common.add': 'Hinzufügen',
  'common.label': 'Bezeichnung',
  'common.original': 'Original',
  'common.quality': 'Qualität',
  'common.persistence': 'Persistenz',
  'common.secureStore': 'Sicherer Speicher',
  'common.browserFallback': 'Browser-Fallback',
  'common.notAvailableShort': '—',
  'common.loading': 'Wird geladen',
  'common.sending': 'Wird gesendet…',
  'common.single': 'Einzeln',
  'common.tile': 'Kachel',
  'common.grid': 'Raster',
  'common.smart': 'Smart',
  'common.multi': 'Multi',
  'blogger.title': 'Blogger-CDN',
  'blogger.heroTitle': 'Bilder auf Blogger veröffentlichen und hosten',
  'blogger.heroDescription':
    'Veröffentlichungsmodus für Beiträge mit visuellem/HTML-Editor. Upload-Modus zum Generieren gehosteter URLs.',
  'blogger.ready': 'Bereit',
  'blogger.configureInSettings': 'In Einstellungen konfigurieren',
  'blogger.publishTab': 'Veröffentlichen',
  'blogger.uploadTab': 'Hochladen',
  'blogger.settings': 'Einstellungen',
  'blogger.missingConfigTitle': 'Fehlende Konfiguration',
  'blogger.missingConfigBody':
    'Speichere die Anmeldedaten in den Einstellungen, bevor du fortfährst.',
  'blogger.post.title': 'Beitrag',
  'blogger.post.description': 'Titel, Labels und Veröffentlichung.',
  'blogger.post.postTitle': 'Titel',
  'blogger.post.postTitlePlaceholder': 'Beitragstitel',
  'blogger.post.defaultLabels': 'Standard-Labels',
  'blogger.post.defaultLabelsPlaceholder': 'manga, kapitel',
  'blogger.post.postLabels': 'Beitrags-Labels',
  'blogger.post.postLabelsPlaceholder': 'rezension',
  'blogger.post.publishNow': 'Jetzt veröffentlichen',
  'blogger.post.draft': 'Entwurf',
  'blogger.post.publish': 'Veröffentlichen',
  'blogger.post.status.draft': 'als Entwurf gespeichert',
  'blogger.post.status.published': 'veröffentlicht',
  'blogger.template.title': 'Neuer Blogger-Beitrag',
  'blogger.template.description':
    'Schreibe hier den Beitragsinhalt. Du kannst zwischen visuell, HTML und Vorschau wechseln.',
  'blogger.template.insertPrefix': 'Verwende die',
  'blogger.template.insertSuffix':
    '-Schaltfläche, um Dateien auf Blogger hochzuladen und die gehosteten URLs in den Inhalt einzufügen.',
  'blogger.editor.title': 'Editor',
  'blogger.editor.description': 'Visuell, HTML und Vorschau.',
  'blogger.editor.visual': 'Visuell',
  'blogger.editor.preview': 'Vorschau',
  'blogger.editor.h1': 'H1',
  'blogger.editor.h2': 'H2',
  'blogger.editor.bold': 'Fett',
  'blogger.editor.italic': 'Kursiv',
  'blogger.editor.underline': 'Unterstrichen',
  'blogger.editor.list': 'Liste',
  'blogger.editor.numbered': 'Nummeriert',
  'blogger.editor.quote': 'Zitat',
  'blogger.editor.link': 'Link',
  'blogger.editor.promptUrl': 'URL',
  'blogger.editor.insertImages': 'Bilder einfügen',
  'blogger.copied': 'Kopiert',
  'blogger.loadConfigFailed':
    'Blogger-Konfiguration konnte nicht geladen werden.',
  'blogger.imageInsertedSingle':
    'Bild auf Blogger gehostet und in den Editor eingefügt.',
  'blogger.imageInsertedMany':
    '{count} Bilder auf Blogger gehostet und in den Editor eingefügt.',
  'blogger.uploadFailed':
    'Bilder konnten nicht auf Blogger hochgeladen werden.',
  'blogger.batchUploadSingle':
    'Upload in einem einzelnen Blogger-Entwurfsbeitrag abgeschlossen.',
  'blogger.batchUploadMany':
    '{count} Bilder in einem einzelnen Blogger-Entwurfsbeitrag hochgeladen.',
  'blogger.uploadFailedShort': 'Upload fehlgeschlagen.',
  'blogger.batchUploadSuccessSingle':
    'Upload in einem einzelnen Blogger-Entwurfsbeitrag abgeschlossen.',
  'blogger.batchUploadSuccessMany':
    '{count} Bilder in einem einzelnen Blogger-Entwurfsbeitrag hochgeladen.',
  'blogger.publishSuccessWithUrl': 'Beitrag {verb} auf Blogger. URL: {url}',
  'blogger.publishSuccessWithId': 'Beitrag {verb} auf Blogger mit ID {id}.',
  'blogger.publishFailed': 'Veröffentlichung auf Blogger fehlgeschlagen.',
  'blogger.uploadSection.title': 'Stapel-Upload',
  'blogger.uploadSection.description':
    'Bilder ablegen, um gehostete URLs zu generieren.',
  'blogger.uploadSection.dropTitle': 'Bilder hierher ziehen',
  'blogger.uploadSection.dropDescription':
    'PNG, JPG, WebP mit lokaler Vorverarbeitung.',
  'blogger.uploadSection.optimizedUrl': 'Optimierte URL',
  'blogger.uploadSection.optimizedUrlDesc':
    'Generiert vor dem Hochladen eine optimierte URL.',
  'blogger.uploadSection.exportOptimized': 'Optimierte exportieren',
  'blogger.uploadSection.exportOptimizedDesc':
    'Verwendet optimierte URL in Stapelaktionen.',
  'blogger.uploadSection.outputImg': 'Ausgabe <img>',
  'blogger.uploadSection.outputImgDesc': 'HTML-Snippets statt URLs.',
  'blogger.uploadSection.select': 'Auswählen',
  'blogger.uploadSection.send': 'Senden',
  'blogger.uploadSection.exported': 'Exportiert',
  'blogger.queue.title': 'Warteschlange',
  'blogger.queue.items': '{count} Element(e)',
  'blogger.queue.empty': 'Keine Dateien.',
  'blogger.queue.altText': 'Alternativtext',
  'blogger.queue.canonical': 'Kanonisch',
  'blogger.queue.optimized': 'Optimiert',
  'blogger.queue.url': 'URL',
  'blogger.queue.opt': 'Opt.',
  'blogger.queue.img': 'img',
  'common.remove': 'Entfernen',
  'ranking.backToDashboard': 'Zurück zum Dashboard',
  'ranking.hero.title': 'Modell-Ranking',
  'ranking.hero.subtitle':
    'Vergleiche offizielle Modelle mit echten Community-Bewertungen — Qualität, Geschwindigkeit, Preis-Leistung und Benutzerfreundlichkeit.',
  'ranking.hero.globalStatsAria': 'Globale Statistiken',
  'ranking.hero.models': 'Modelle',
  'ranking.hero.reviews': 'Bewertungen',
  'ranking.hero.bestOverall': 'Beste Gesamtbewertung',
  'ranking.hero.costBenefit': 'Preis-Leistung',
  'ranking.loading': 'Ranking wird aktualisiert…',
  'legalHub.back': 'Zurück',
  'legalHub.sidebarTitle': 'Rechtszentrum',
  'legalHub.supportDescription':
    'Support-, Datenschutz- und Betroffenenrechtsanfragen sollten über den offiziellen Kanal erfolgen, der in der App/Website aufgeführt ist.',
  'legalHub.supportCta': 'Support-Kanal öffnen',
  'legalHub.noticeTitle': 'Wichtiger Hinweis.',
  'dashboard.dashboardExecute.selectImage': 'Wähle ein Bild zum Ausführen.',
  'dashboard.dashboardExecute.runCurrentStage':
    'Aktuelle Phase für das Bild ausführen.',
  'dashboard.dashboardExecute.rerunStage': 'Phase erneut ausführen',
  'dashboard.dashboardExecute.runStage': 'Phase ausführen',
  'dashboard.dashboardExecute.runAio': 'AIO ausführen',
  'dashboard.dashboardExecute.stop': 'Ausführung stoppen',
  'freeProviderCard.stage.translation': 'Übersetzung',
  'freeProviderCard.stage.ocr': 'OCR',
  'freeProviderCard.stage.clean': 'Bereinigung',
  'freeProviderCard.badge.integrated': 'Integriert',
  'freeProviderCard.badge.catalog': 'Katalog',
  'freeProviderCard.verifiedAt': 'verifiziert am',
  'freeProviderCard.tooltip.selectedModel': 'Ausgewähltes Modell',
  'freeProviderCard.tooltip.notSelected': '(nicht ausgewählt)',
  'freeProviderCard.tooltip.notDefined': '(nicht definiert)',
  'freeProviderCard.tooltip.apiKeyConfigured': 'Konfiguriert',
  'freeProviderCard.tooltip.apiKeyRequired': 'Erforderlich (ausstehend)',
  'freeProviderCard.tooltip.apiKeyOptional': 'Optional (leer)',
  'freeProviderCard.tooltip.extraFields': 'Zusätzliche Felder',
  'freeProviderCard.tooltip.modelsInStage': 'Modelle in dieser Phase',
  'freeProviderCard.tooltip.empty': '(leer)',
  'freeProviderCard.label.model': 'Modell',
  'freeProviderCard.label.apiBase': 'API-Basis',
  'freeProviderCard.label.apiKey': 'API-Schlüssel',
  'freeProviderCard.label.required': '(erforderlich)',
  'freeProviderCard.label.optional': '(optional)',
  'freeProviderCard.placeholder.apiKey': 'Schlüssel hier einfügen',
  'freeProviderCard.status.activeProfile': 'Aktives Profil:',
  'freeProviderCard.status.catalogOnlyWarning':
    'Dieser Anbieter ist in v1 nur als Katalog verfügbar.',
  'freeProviderCard.action.save': 'Speichern',
  'freeProviderCard.action.use': 'Verwenden',
  'customProvider.field.name': 'Name',
  'customProvider.field.model': 'Modell',
  'customProvider.field.apiBase': 'API-Basis',
  'customProvider.field.apiKey': 'API-Schlüssel',
  'customProvider.placeholder.noKey': '(kein Schlüssel)',
  'customProvider.placeholder.pasteKey': 'Schlüssel hier einfügen',
  'customProvider.status.active': 'Aktives Profil in der Pipeline',
  'customProvider.action.cancel': 'Abbrechen',
  'customProvider.action.saving': 'Wird gespeichert...',
  'customProvider.action.save': 'Speichern',
  'customProvider.action.edit': 'Bearbeiten',
  'customProvider.action.delete': 'Löschen',
  'customProvider.badge.customProfile': 'Benutzerdefiniertes Profil',
  'freeProviderCard.status.integrated': 'Integriert',
  'freeProviderCard.status.catalog': 'Katalog',
  'freeProviderCard.status.verifiedAt': 'verifiziert am',
  'freeProviderCard.info.label': 'Info',
  'freeProviderCard.info.tooltip': '{name}-Info',
  'freeProviderCard.info.selectedModel': 'Ausgewähltes Modell:',
  'freeProviderCard.info.notSelected': '(nicht ausgewählt)',
  'freeProviderCard.info.modelId': 'Modell-ID:',
  'freeProviderCard.info.notDefined': '(nicht definiert)',
  'freeProviderCard.info.apiBase': 'API-Basis:',
  'freeProviderCard.info.apiKey': 'API-Schlüssel:',
  'freeProviderCard.info.configured': 'Konfiguriert',
  'freeProviderCard.info.required': 'Erforderlich (ausstehend)',
  'freeProviderCard.info.optional': 'Optional (leer)',
  'freeProviderCard.info.extraFields': 'Zusätzliche Felder:',
  'freeProviderCard.info.setup': 'Einrichtung:',
  'freeProviderCard.info.limits': 'Limits:',
  'freeProviderCard.info.rateLimits': 'Ratenlimits:',
  'freeProviderCard.info.modelsInStage': 'Modelle in dieser Phase:',
  'freeProviderCard.field.model': 'Modell',
  'freeProviderCard.field.apiBase': 'API-Basis',
  'freeProviderCard.field.apiBaseTitle':
    'Feste API-Basis für diesen Anbieter in v1',
  'freeProviderCard.field.required': '(erforderlich)',
  'freeProviderCard.field.optional': '(optional)',
  'freeProviderCard.field.apiKeyPlaceholder': 'Schlüssel hier einfügen',
  'freeProviderCard.status.catalogOnly':
    'Dieser Anbieter ist in v1 nur als Katalog verfügbar.',
  'freeProviderCard.actions.save': 'Speichern',
  'freeProviderCard.actions.use': 'Verwenden',
  'freeProviderCard.empty': '(leer)',
  'customProvider.action.use': 'Verwenden',
  'typo.tag': 'Typesetter',
  'typo.session.title': 'Sitzung',
  'typo.session.image': 'Bild:',
  'typo.session.selection': 'Auswahl:',
  'typo.session.none': 'keine',
  'typo.tools.aria': 'Formwerkzeuge',
  'typo.tools.select': 'Auswählen',
  'typo.tools.rect': 'Rechteckig',
  'typo.tools.ellipse': 'Elliptisch',
  'typo.actions.refine': 'Verfeinern',
  'typo.actions.toRect': '→ Rechteckig',
  'typo.actions.toEllipse': '→ Elliptisch',
  'typo.actions.duplicate': 'Duplizieren',
  'typo.actions.delete': 'Auswahl entfernen',
  'typo.presets.title': 'Vorlagen',
  'typo.presets.active': 'Aktive Vorlage',
  'typo.presets.none': 'Keine Vorlage',
  'typo.presets.applySelection': '→ Auswahl',
  'typo.presets.applyImage': '→ Bild',
  'typo.snapshots.title': 'Schnappschüsse',
  'typo.snapshots.hint':
    'Aktuellen Zustand speichern, um ihn später wiederherzustellen.',
  'typo.snapshots.placeholder': 'Name des Schnappschusses',
  'typo.snapshots.save': 'Schnappschuss speichern',
  'typo.snapshots.select': 'Auswählen…',
  'typo.snapshots.restore': 'Wiederherstellen',
  'typo.queue.title': 'Text-Warteschlange',
  'typo.queue.editorPlaceholder': 'Zeilen einfügen, eine pro Sprechblase…',
  'typo.queue.editorAria': 'Text-Editor für Warteschlange',
  'typo.queue.build': 'Warteschlange erstellen',
  'typo.queue.import': 'Importieren',
  'typo.queue.applySelected': 'Element anwenden',
  'typo.queue.next': 'Nächstes',
  'typo.queue.clear': 'Leeren',
  'typo.queue.multiBubble': 'Multi-Sprechblase',
  'typo.queue.listAria': 'Typografische Warteschlange',
  'typo.queue.emptyTitle': 'Warteschlange ist leer',
  'typo.queue.emptyDesc':
    'Eine Zeile pro Sprechblase, um die Reihenfolge aufzubauen.',
  'typo.queue.statusApplied': 'Angewandt',
  'typo.queue.statusSkipped': 'Übersprungen',
  'typo.queue.statusPending': 'Ausstehend',
  'modelDetail.empty':
    'Wähle ein Modell in der Bestenliste aus, um Details und Bewertungen zu sehen.',
  'modelDetail.source.local': 'Lokal',
  'modelDetail.source.cloud': 'Cloud',
  'modelDetail.score.aria': 'Gesamtbewertung: {score}',
  'modelDetail.score.label': 'Bewertung',
  'modelDetail.reviews.count_one': '{count} Bewertung',
  'modelDetail.reviews.count_other': '{count} Bewertungen',
  'modelDetail.trend.up': '+{trend} Pkt. (30T)',
  'modelDetail.trend.down': '{trend} Pkt. (30T)',
  'modelDetail.trend.neutral': 'Neutraler Trend',
  'modelDetail.metrics.quality': 'Qualität',
  'modelDetail.metrics.speed': 'Geschwindigkeit',
  'modelDetail.metrics.costBenefit': 'Preis-Leistung',
  'modelDetail.metrics.easeOfUse': 'Benutzerfreundlichkeit',
  'modelDetail.distro.title': 'Bewertungsverteilung',
  'modelDetail.distro.lastReview': 'Letzte Bewertung: {date}',
  'modelDetail.info.title': 'Technischer Kontext',
  'modelDetail.info.noNotes':
    'Keine zusätzlichen Hinweise für dieses Modell registriert.',
  'modelDetail.info.source': 'Quelle',
  'modelDetail.info.target': 'Ziel',
  'modelDetail.actions.editReview': 'Bewertung bearbeiten',
  'modelDetail.actions.startReview': 'Modell bewerten',
  'modelDetail.actions.sending': 'Wird gesendet…',
  'modelDetail.actions.verifyEmail': 'E-Mail bestätigen',
  'modelDetail.warning.verifyEmail':
    'Bestätige deine E-Mail, um Bewertungen zu veröffentlichen oder zu bearbeiten.',
  'modelDetail.recentReviews.title': 'Aktuelle Bewertungen',
  'modelDetail.recentReviews.loading': 'Wird geladen…',
  'modelDetail.recentReviews.empty':
    'Dieses Modell hat noch keine öffentlichen Bewertungen erhalten.',
  'modelDetail.pagination.prev': 'Zurück',
  'modelDetail.pagination.next': 'Weiter',
  'modelDetail.usage.balanced': 'Ausgewogen',
  'modelDetail.usage.quality_first': 'Qualität',
  'modelDetail.usage.speed_first': 'Geschwindigkeit',
  'modelDetail.usage.low_vram': 'Wenig VRAM',
  'modelDetail.usage.offline_local': 'Lokal',
  'modelDetail.usage.cloud_pipeline': 'Cloud',
  'resources.empty.title.withQuery': 'Keine Ergebnisse für „{query}"',
  'resources.empty.title.noQuery': 'Keine Einträge gefunden',
  'resources.empty.desc.withQuery':
    'Versuche andere Suchbegriffe oder lösche die Filter, um {context} zu finden.',
  'resources.empty.desc.noQuery':
    'Passe die Filter an, um verfügbare {context} zu sehen.',
  'resources.fonts.license.free': 'Kostenlos',
  'resources.fonts.license.openSource': 'Open Source',
  'resources.fonts.license.commercial': 'Kommerziell',
  'resources.fonts.license.mixed': 'Gemischt',
  'resources.fonts.context': 'Schriften',
  'resources.fonts.placeholder': 'Text eingeben, um Schriften vorzuschauen...',
  'resources.fonts.results_one': 'Schrift gefunden',
  'resources.fonts.results_other': 'Schriften gefunden',
  'resources.fonts.previewFallback': 'Das glaube ich nicht!',
  'resources.fonts.sizeAria': 'Vorschau bei {size}px',
  'resources.sfx.category.impact': 'Wirkung',
  'resources.sfx.category.emotion': 'Emotion',
  'resources.sfx.category.ambient': 'Umgebung',
  'resources.sfx.category.action': 'Aktion',
  'resources.sfx.category.voice': 'Stimme',
  'resources.sfx.category.misc': 'Sonstiges',
  'resources.sfx.filterAria': 'Nach Kategorie filtern',
  'resources.sfx.filterAll': 'Alle ({count})',
  'resources.sfx.results_one': 'Soundeffekt',
  'resources.sfx.results_other': 'Soundeffekte',
  'resources.sfx.context': 'Soundeffekte',
  'resources.sfx.copyAria': '„{text}" kopieren',
  'resources.communities.platform.forum': 'Forum',
  'resources.communities.results_one': 'Community',
  'resources.communities.results_other': 'Communities',
  'resources.communities.context': 'Communities',
  'resources.communities.visitAria': '{name} im externen Browser besuchen',
  'resources.communities.visit': 'Besuchen',
  'resources.tools.category.editing': 'Bearbeitung',
  'resources.tools.category.ocr': 'OCR',
  'resources.tools.category.translation': 'Übersetzung',
  'resources.tools.category.fonts': 'Schriften',
  'resources.tools.category.hosting': 'Hosting',
  'resources.tools.category.utility': 'Hilfsmittel',
  'resources.tools.filterAll': 'Alle',
  'resources.tools.results_one': 'Werkzeug',
  'resources.tools.results_other': 'Werkzeuge',
  'resources.tools.context': 'Werkzeuge',
  'resources.tools.free.yes': 'Kostenlos',
  'resources.tools.free.no': 'Kostenpflichtig',
  'resources.tools.action.open': 'Öffnen',
  'resources.tools.action.download': 'Herunterladen',
  'feed.roles.raw': 'Raw-Anbieter',
  'feed.roles.cl': 'Cleaner',
  'feed.roles.rd': 'Redrawer',
  'feed.roles.tl': 'Übersetzer',
  'feed.roles.pr': 'Korrekturleser',
  'feed.roles.ts': 'Typesetter',
  'feed.roles.qc': 'Qualitätsprüfer',
  'feed.contact.discord': 'Discord',
  'feed.contact.twitter_x': 'Twitter/X',
  'feed.contact.telegram': 'Telegram',
  'feed.contact.email': 'E-Mail',
  'feed.contact.whatsapp': 'WhatsApp',
  'feed.contact.instagram': 'Instagram',
  'feed.contact.placeholder.discord':
    'https://discord.gg/... oder Benutzername',
  'feed.contact.placeholder.twitter_x':
    'Benutzername oder https://x.com/benutzername',
  'feed.contact.placeholder.telegram': 'https://t.me/... oder @Kanal',
  'feed.contact.placeholder.email': 'kontakt@scanlation.com',
  'feed.contact.placeholder.whatsapp': '+49 123 4567890 oder Link',
  'feed.contact.placeholder.instagram':
    'Benutzername oder https://instagram.com/benutzername',
  'feed.weekdays.seg': 'Mo',
  'feed.weekdays.ter': 'Di',
  'feed.weekdays.qua': 'Mi',
  'feed.weekdays.qui': 'Do',
  'feed.weekdays.sex': 'Fr',
  'feed.weekdays.sab': 'Sa',
  'feed.weekdays.dom': 'So',
  'feed.report.reasons.malicious_link': 'Schädlicher Link',
  'feed.report.reasons.spam': 'Spam',
  'feed.report.reasons.impersonation': 'Identitätsdiebstahl',
  'feed.report.reasons.harassment': 'Belästigung / Missbrauch',
  'feed.report.reasons.copyright': 'Urheberrechtsverletzung',
  'feed.report.reasons.other': 'Sonstiges',
  'feed.modal.closeAria': 'Dialog schließen',
  'feed.feedback.newApplication':
    'Neue Bewerbung im Scanlation-Feed eingegangen.',
  'feed.error.loadFailed': 'Scanlation-Feed konnte nicht geladen werden.',
  'feed.hero.back': 'Zurück zum Dashboard',
  'feed.hero.title': 'Rekrutierung, Showcase & Moderation',
  'feed.hero.subtitle':
    'Stelle Stellenangebote ein, präsentiere Werke, empfange Bewerbungen und melde verdächtige Inhalte.',
  'feed.tab.recruitment': 'Rekrutierung',
  'feed.tab.showcase': 'Showcase',
  'feed.tab.moderation': 'Moderation',
  'feed.actions.createPost': '{type} erstellen',
  'feed.alert.safety':
    'Verwende nur legitime soziale Medien und Kontakte. Verdächtige Beiträge können gemeldet werden.',
  'feed.alert.banPolicy':
    'Schädliche Beiträge können zu einer dauerhaften Sperrung pro Konto, Gerät und Netzwerk führen.',
  'feed.card.recruitmentRecent': 'Aktuelle Rekrutierungen',
  'feed.card.showcaseRecent': 'Aktuelle Showcases',
  'feed.card.moderationQueue': 'Moderationswarteschlange',
  'feed.loading': 'Feed wird geladen…',
  'feed.empty.noRecruitment': 'Keine Rekrutierungsbeiträge gefunden',
  'feed.empty.noShowcase': 'Keine Showcases gefunden',
  'feed.empty.cleanQueue': 'Warteschlange ist leer',
  'feed.empty.beFirst': 'Sei der Erste, der {type} postet!',
  'feed.empty.noModPosts': 'Keine Beiträge in der Moderationswarteschlange.',
  'feed.post.recruitLabel': 'Rekrutieren',
  'feed.post.showcaseLabel': 'Showcase',
  'feed.post.rolePayNegotiable': 'Verhandlungsbasis',
  'feed.post.rolePayVolunteer': 'Ehrenamtlich',
  'feed.post.actions.apply': 'Bewerben',
  'feed.post.actions.report': 'Melden',
  'feed.post.actions.show': 'Anzeigen',
  'feed.post.actions.hide': 'Ausblenden',
  'feed.post.actions.ban': 'Sperren',
  'feed.sidebar.profileTitle': 'Autorenprofil',
  'feed.sidebar.rulesLabel':
    'Ich akzeptiere die Feed-Regeln. Schädliche Links führen zu einer dauerhaften Sperrung.',
  'feed.sidebar.webhookLabel': 'Discord-Webhook-Benachrichtigungen',
  'feed.sidebar.saveProfile': 'Profil speichern',
  'feed.sidebar.inboxTitle': 'Interner Posteingang',
  'feed.sidebar.yourApplications': 'Deine Bewerbungen',
  'feed.sidebar.noApplications': 'Keine Bewerbungen gesendet.',
  'feed.sidebar.receivedTitle': 'Empfangen',
  'feed.sidebar.noReceived': 'Keine Bewerbungen empfangen.',
  'feed.sidebar.reportsTitle': 'Meldungen',
  'feed.sidebar.noReports': 'Keine ausstehenden Meldungen.',
  'feed.sidebar.banTitle': 'Sperrung',
  'feed.sidebar.applyBan': 'Sperrung anwenden',
  'feed.feedback.postPublishedRecruit': 'Rekrutierung veröffentlicht.',
  'feed.feedback.postPublishedShowcase': 'Showcase veröffentlicht.',
  'feed.feedback.reportSent': 'Meldung an die Moderation gesendet.',
  'feed.feedback.profileUpdated': 'Feed-Profil aktualisiert.',
  'feed.feedback.applicationSent': 'Bewerbung gesendet.',
  'feed.feedback.banApplied': 'Sperrung angewandt und Sitzungen widerrufen.',
  'feed.feedback.reportUpdated': 'Meldung aktualisiert.',
  'feed.feedback.postStatusUpdated': 'Beitrag auf {status} aktualisiert.',
  'feed.moderation.notes.resolved': 'Von der Moderation überprüft.',
  'feed.moderation.notes.dismissed': 'Von der Moderation abgewiesen.',
  'feed.moderation.banReasonPost': 'Moderierter Beitrag: {title}',
  'feed.moderation.targetUserId': 'Ziel-Benutzer-ID',
  'feed.moderation.applyBan': 'Sperrung anwenden',
  'feed.error.roleDuplicate': 'Du hast {role} bereits hinzugefügt.',
  'feed.error.valuePositive': 'Der Wert muss positiv sein.',
  'feed.error.platformDuplicate': '{platform} bereits hinzugefügt.',
  'feed.error.platformRequired': 'Bitte gib {platform} an.',
  'feed.error.saveProfileFailed': 'Profil konnte nicht gespeichert werden.',
  'feed.error.publishFailed': 'Veröffentlichung fehlgeschlagen.',
  'feed.error.applyFailed': 'Bewerbung fehlgeschlagen.',
  'feed.error.reportFailed': 'Meldung fehlgeschlagen.',
  'feed.error.moderatePostFailed': 'Beitrag konnte nicht moderiert werden.',
  'feed.error.moderateReportFailed':
    'Meldung konnte nicht aktualisiert werden.',
  'feed.error.banFailed': 'Sperrung konnte nicht angewandt werden.',
  'feed.composer.typeRecruit': 'Rekrutierung',
  'feed.composer.typeShowcase': 'Showcase',
  'feed.composer.placeholder.titleRecruit': 'Z.B.: Suche Übersetzer',
  'feed.composer.placeholder.titleShowcase': 'Z.B.: Neues Kapitel verfügbar',
  'feed.composer.placeholder.bodyRecruit':
    'Beschreibe das Projekt und wie der Kandidat helfen kann...',
  'feed.composer.placeholder.bodyShowcase':
    'Beschreibe die Veröffentlichung und relevante Informationen...',
  'feed.composer.placeholder.scanlationName': 'Name der Scanlation',
  'feed.composer.placeholder.workTitle': 'Werktitel',
  'feed.composer.placeholder.chapterLabel': 'Kap. 42',
  'feed.composer.placeholder.genres': 'Action, Romantik, Fantasy',
  'feed.composer.placeholder.description':
    'Beschreibe diese Veröffentlichung...',
  'feed.composer.sections.project': 'Projekt',
  'feed.composer.sections.work': 'Werk',
  'feed.composer.sections.recruitmentSettings': 'Rekrutierungseinstellungen',
  'feed.composer.toggle.recruiting': 'Rekrutierung',
  'feed.composer.toggle.recruitingDesc':
    'Nimmt deine Scan neue Mitglieder auf?',
  'feed.composer.toggle.paidWork': 'Bezahlte Arbeit',
  'feed.composer.toggle.paidWorkDesc': 'Werden Mitglieder bezahlt?',
  'feed.composer.requirements.label': 'Von Kandidaten verlangen:',
  'feed.composer.requirements.portfolio': 'Portfolio',
  'feed.composer.requirements.experience': 'Erfahrung',
  'feed.composer.requirements.availability': 'Verfügbarkeit',
  'feed.composer.requirements.contact': 'Kontakt',
  'feed.composer.availability.minRequired':
    'Mindestens erforderliche Verfügbarkeit:',
  'feed.composer.availability.hoursPerWeek': 'Stunden pro Woche',
  'feed.composer.availability.daysOptional': 'Tage (optional)',
  'feed.composer.availability.descriptionOptional': 'Beschreibung (optional)',
  'feed.composer.availability.placeholder':
    'Ich brauche jemanden, der jede Woche Kapitel liefert...',
  'feed.composer.sections.roles': 'Rollen',
  'feed.composer.sections.rolesSub': '(füge die gesuchten hinzu)',
  'feed.composer.roles.roleLabel': 'Rolle',
  'feed.composer.roles.valueLabel': 'Wert (€)',
  'feed.composer.roles.valueHint': '(pro Kapitel)',
  'feed.composer.roles.add': 'Hinzufügen',
  'feed.composer.roles.allAdded': 'Alle Rollen hinzugefügt',
  'feed.composer.roles.addBtn': 'Rolle hinzufügen',
  'feed.composer.social.title': 'Soziale Medien',
  'feed.composer.social.sub': '(mindestens eines)',
  'feed.composer.social.platform': 'Plattform',
  'feed.composer.social.user': 'Benutzer',
  'feed.composer.social.url': 'URL/Link',
  'feed.composer.social.allAdded': 'Alle Plattformen hinzugefügt',
  'feed.composer.social.addBtn': 'Soziales Medium hinzufügen',
  'feed.composer.sections.media': 'Medien',
  'feed.composer.media.uploading': 'Wird gesendet...',
  'feed.composer.media.uploadBtn': 'Über Imgur hochladen',
  'feed.apply.title': 'Bewerbung senden',
  'feed.apply.message': 'Nachricht',
  'feed.apply.messagePlaceholder':
    'Stelle dich vor und erkläre, warum du beitreten möchtest...',
  'feed.apply.preferredContact': 'Bevorzugter Kontakt',
  'feed.apply.portfolio': 'Portfolio / Links',
  'feed.apply.portfolioPlaceholder': 'Ein Link pro Zeile...',
  'feed.report.title': 'Beitrag melden',
  'feed.report.reason': 'Grund',
  'feed.report.details': 'Details',
  'feed.report.detailsPlaceholder': 'Beschreibe das Problem...',
  'feed.report.send': 'Meldung absenden',
  'freeProvider.manager.titleTranslation': 'FREE-Anbieter (Übersetzung)',
  'freeProvider.manager.titleOcr': 'FREE-Anbieter (OCR)',
  'auth.password.hide': 'Passwort verbergen',
  'auth.password.show': 'Passwort anzeigen',
  'modelManager.stage.cleanImage': 'Bild bereinigen',
  'modelManager.stage.detectText': 'Text erkennen',
  'modelManager.stage.recognizeText': 'Text lesen',
  'modelManager.stage.segmentText': 'Text segmentieren',
  'fillStylePopover.gradient': 'Verlauf',
  'fillStylePopover.hint.gradient': 'Einfarbig oder Verlauf im selben Picker.',
  'fillStylePopover.hint.solid': 'Wähle eine einfarbige Farbe.',
  'klSlider.resetValue': 'Wert zurücksetzen',
  'dashboard.aio.translation.llm.temperature': 'Temperatur',
  'dashboard.aio.translation.llm.topP': 'Top P',
  'dashboard.aio.translation.llm.maxTokens': 'Max. Tokens',
  'dashboard.enhance.modeTag': 'Verbessern',
  'dashboard.enhance.scale.2x': '2×',
  'dashboard.enhance.scale.4x': '4×',
  'optimizer.hero.title': 'Kapitel-Optimierer',
  'optimizer.hero.desc':
    'Fertige Seiten für Web, Lesen oder Archivierung optimieren.',
  'optimizer.hero.pages': 'Seiten',
  'optimizer.hero.savings': 'Einsparungen',
  'optimizer.hero.saved': 'Gespart',
  'optimizer.hero.output': 'Ausgabe',
  'optimizer.panel.presets': 'Vorlagen',
  'optimizer.panel.output': 'Ausgabe',
  'optimizer.panel.dimensions': 'Abmessungen',
  'optimizer.panel.filters': 'Filter',
  'optimizer.panel.preview': 'Vorschau',
  'optimizer.presets.webLight': 'Web Light',
  'optimizer.presets.webLight.desc': 'Leichtgewichtig für schnelles Laden',
  'optimizer.presets.reading': 'Lesen',
  'optimizer.presets.reading.desc': 'Ausgewogene Qualität für Leser',
  'optimizer.presets.archive': 'Archiv',
  'optimizer.presets.archive.desc': 'Verlustfrei zur Aufbewahrung',
  'optimizer.presets.social': 'Social Media',
  'optimizer.presets.social.desc': 'Optimiert für soziale Medien',
  'optimizer.presets.custom': 'Benutzerdefiniert',
  'optimizer.presets.custom.desc': 'Eigene Einstellungen',
  'optimizer.config.format': 'Format',
  'optimizer.config.quality': 'Qualität',
  'optimizer.config.resize': 'Skalieren',
  'optimizer.config.trimBorders': 'Ränder beschneiden',
  'optimizer.config.trimTolerance': 'Beschneidungstoleranz',
  'optimizer.config.maxWidth': 'Max. Breite',
  'optimizer.config.maxHeight': 'Max. Höhe',
  'optimizer.config.sharpen': 'Schärfen',
  'optimizer.config.sharpenStrength': 'Schärfestärke',
  'optimizer.config.grayscale': 'Graustufen',
  'optimizer.config.autoLevels': 'Automatische Tonwertkorrektur',
  'optimizer.action.optimizing': 'Wird optimiert...',
  'optimizer.action.folder': 'Ordner',
  'optimizer.preview.generating': 'Vorschau wird generiert...',
  'optimizer.preview.before': 'Vorher',
  'optimizer.preview.after': 'Nachher',
  'optimizer.preview.reduction': 'Reduktion',
  'optimizer.preview.dimensions': 'Abmessungen',
  'optimizer.preview.compare': 'Vergleichen',
  'optimizer.preview.original': 'Original',
  'optimizer.preview.optimized': 'Optimiert',
  'optimizer.preview.empty': 'Lade Bilder, um den Optimierer zu verwenden.',
  'optimizer.results.title': 'Ergebnisse',
  'optimizer.results.empty':
    'Führe die Optimierung aus, um die Ergebnisse zu sehen.',
  'optimizer.results.download': 'Datei herunterladen',
  'optimizer.error.worker': 'Worker im Kapitel-Optimierer nicht verfügbar.',
  'optimizer.error.failed': 'Der Kapitel-Optimierer ist fehlgeschlagen.',
  'optimizer.error.preview': 'Optimierer-Vorschau fehlgeschlagen.',
  'optimizer.config.brightness': 'Helligkeit',
  'optimizer.config.contrast': 'Kontrast',
  'optimizer.config.noiseReduction': 'Rauschunterdrückung',
  'optimizer.config.noiseReductionStrength': 'Rauschunterdrückungsstärke',
  'optimizer.config.rotation': 'Drehung',
  'optimizer.config.rotationNone': 'Keine',
  'optimizer.config.renamePattern': 'Umbenennungsmuster',
  'optimizer.config.renameHint':
    'Verwende {name} für den Originalnamen, {index} für eine aufgefüllte Nummer, {ext} für die Erweiterung.',
  'optimizer.panel.advanced': 'Erweitert',
  'optimizer.export.folderSuccess':
    'Der Kapitel-Optimierer hat Dateien in den ausgewählten Ordner exportiert.',
  'optimizer.export.zipSuccess':
    'Kapitel-Optimierer-Paket erfolgreich generiert.',
  'resources.communities.platform.discord': 'Discord',
  'resources.communities.platform.reddit': 'Reddit',
  'resources.communities.platform.website': 'Website',
  'resources.communities.platform.telegram': 'Telegram',
  'dashboard.cleaner.modeTag': 'Cleaner',
  'stitch.error.loadImage': 'Bild konnte nicht geladen werden.',
  'stitch.error.initCanvas':
    'Stitcher-Canvas konnte nicht initialisiert werden.',
  'stitch.error.initTempCanvas':
    'Stitcher-Zwischenbild konnte nicht vorbereitet werden.',
  'stitch.error.generateBlob': 'Stitcher-Blob konnte nicht generiert werden.',
  'stitch.error.cancelled': 'Rendering abgebrochen.',
  'stitch.error.workerFailed':
    'Stitcher-Worker konnte nicht ausgeführt werden.',
  'stitch.error.generatePreview':
    'Stitcher-Vorschau konnte nicht generiert werden.',
  'stitch.error.exportBatch': 'Stitcher-Stapel konnte nicht exportiert werden.',
  'stitch.error.generateZip': 'Stitcher-ZIP konnte nicht generiert werden.',
  'stitch.error.saveFolder':
    'Stapel konnten nicht im Ordner gespeichert werden.',
  'dashboard.footer.runtime.fallback.label': 'Fallback',
  'watermark.blend.normal': 'Normal',
  'watermark.blend.multiply': 'Multiplizieren',
  'watermark.blend.screen': 'Negativ multiplizieren',
  'watermark.blend.overlay': 'Ineinanderkopieren',
  'watermark.blend.softLight': 'Weiches Licht',
  'watermark.blend.hardLight': 'Hartes Licht',
  'watermark.blend.colorDodge': 'Farbig abwedeln',
  'watermark.blend.colorBurn': 'Farbig nachbelichten',
  'watermark.panel.shadow': 'Schattenebene',
  'watermark.shadow.enable': 'Hintergrundschatten aktivieren',
  'watermark.shadow.blur': 'Weichzeichnung',
  'watermark.shadow.opacity': 'Deckkraft',
  'watermark.shadow.color': 'Farbe',
  'watermark.shadow.offsetY': 'Versatz Y',
  'watermark.panel.textAvoidance': 'Textvermeidung',
  'watermark.textAvoidance.enable': 'Textbereiche vermeiden',
  'watermark.textAvoidance.desc':
    'Verwendet KI-Texterkennung, um zu verhindern, dass Wasserzeichen Text in Bildern überlagern.',
  'watermark.textAvoidance.detecting': 'Wird erkannt...',
  'watermark.textAvoidance.detectCurrent': 'Aktuelles erkennen',
  'watermark.textAvoidance.detectAll': 'Alle erkennen',
  'watermark.textAvoidance.detected': '{{count}} Textbereiche erkannt.',
  'watermark.textAvoidance.detectedAll':
    '{{count}} Textbereiche in allen Bildern erkannt.',
  'watermark.textAvoidance.failed': 'Texterkennung fehlgeschlagen.',
  'watermark.textAvoidance.zonesFound': 'Zonen',
  'watermark.textAvoidance.showOverlay': 'Zonen anzeigen',
  'watermark.text.shadowBlur': 'Schattenweichzeichnung',
  'watermark.text.shadowColor': 'Schattenfarbe',
  'watermark.distribution.offsetX': 'Versatz X',
  'watermark.distribution.offsetY': 'Versatz Y',
  'watermark.distribution.density': 'Dichte',
  'dashboard.dock.tooltip.hoverHint':
    'Cursor gedrückt halten, um die Vorschau zu sehen',
  'dashboard.dock.config.ariaLabel': 'Konfiguration des aktiven Werkzeugs',
  'dashboard.dock.config.closeTitle': 'Konfiguration schließen',
  'dashboard.dock.config.closeAriaLabel': 'Werkzeugkonfiguration schließen',
  'dashboard.dock.areaSelection.sectionTitle': 'Bereichsauswahl',
  'dashboard.dock.areaSelection.shapeLabel': 'Neue Auswahlform',
  'dashboard.dock.areaSelection.optionAuto': 'Auto',
  'dashboard.dock.areaSelection.optionSquare': 'Rechteckig',
  'dashboard.dock.areaSelection.optionRounded': 'Elliptisch',
  'dashboard.dock.areaSelection.hintAuto': 'Auto erkennt: {kind}.',
  'dashboard.dock.areaSelection.hintFixed':
    'Neue Bereiche werden als {mode} erstellt.',
  'dashboard.dock.areaSelection.btnDuplicate': 'Duplizieren',
  'dashboard.dock.areaSelection.btnToAuto': '→ Auto',
  'dashboard.dock.areaSelection.btnToSquare': '→ Rechteckig',
  'dashboard.dock.areaSelection.btnToRounded': '→ Elliptisch',
  'dashboard.dock.segment.brushTitle': 'Segmentpinsel',
  'dashboard.dock.segment.eraserTitle': 'Segmentradierer',
  'dashboard.dock.segment.sizeLabel': 'Größe',
  'dashboard.dock.segment.hint':
    'Radius anpassen, um segmentierte Bereiche zu bearbeiten.',
  'dashboard.dock.imageTool.paintTitle': 'Pinsel',
  'dashboard.dock.imageTool.eraserTitle': 'Radierer',
  'dashboard.dock.imageTool.healingTitle': 'Reparaturpinsel',
  'dashboard.dock.imageTool.sizeLabel': 'Größe',
  'dashboard.dock.imageTool.opacityLabel': 'Deckkraft',
  'dashboard.dock.imageTool.blurLabel': 'Weichzeichnung',
  'dashboard.dock.imageTool.colorLabel': 'Farbe',
  'dashboard.dock.imageTool.colorAriaLabel': 'Pinselfarbe',
  'dashboard.dock.magicWand.title': 'Zauberstab',
  'dashboard.dock.magicWand.toleranceLabel': 'Toleranz',
  'dashboard.dock.magicWand.healingBtnTitle':
    'Inpainting auf die Zauberstab-Auswahl anwenden',
  'dashboard.dock.magicWand.healingBtnBusy': 'Wird angewandt…',
  'dashboard.dock.magicWand.healingBtn': 'Reparatur',
  'dashboard.dock.magicWand.clearBtn': 'Leeren',
  'dashboard.dock.imageTool.modelHint': 'Modell: ',
  'dashboard.dock.palette.ariaLabel': 'Manuelle Bildwerkzeuge',
  'dashboard.dock.config.closeLabel': 'Konfiguration schließen',
  'dashboard.dock.config.openLabel': 'Konfiguration öffnen',
  'dashboard.dock.config.badge': 'Konfig.',
  'dashboard.dock.config.description':
    'Öffnet das kontextbezogene Panel des aktiven Werkzeugs, um Form, Größe, Deckkraft, Toleranz und weitere Feinsteuerungen anzupassen.',
  'dashboard.dock.config.disabledReason':
    'Aktiviere ein Werkzeug mit editierbaren Parametern, um die Konfiguration zu öffnen.',
  'dashboard.dock.divider.reg': 'Reg',
  'dashboard.dock.areaSelect.ariaLabel': 'Bereich auswählen',
  'dashboard.dock.areaSelect.title': 'Bereich auswählen',
  'dashboard.dock.areaSelect.description':
    'Erstelle, passe an und verfeinere Textbereiche in der Vorschau. Ideal zum Korrigieren erkannter Sprechblasen vor OCR, Übersetzung oder Rendering.',
  'dashboard.dock.areaSelect.badge': 'Reg',
  'dashboard.dock.areaSelect.disabledReason':
    'Verfügbar in den Phasen Erkennen und Rendern des manuellen AIO.',
  'dashboard.dock.clearPage.ariaLabel': 'Alle Bereiche entfernen',
  'dashboard.dock.clearPage.title': 'Seite leeren',
  'dashboard.dock.clearPage.description':
    'Entfernt alle Bereiche auf dieser Seite auf einmal, damit du die manuelle Markierung ohne Rückstände neu beginnen kannst.',
  'dashboard.dock.clearPage.badge': 'Reset',
  'dashboard.dock.clearPage.disabledReason':
    'Muss in der Phase Erkennen/Rendern sein und es müssen bereits Bereiche auf dem aktiven Bild erstellt worden sein.',
  'dashboard.dock.divider.seg': 'Seg',
  'dashboard.dock.segBrush.ariaLabel': 'Pinsel für segmentierte Bereiche',
  'dashboard.dock.segBrush.title': 'Segmentpinsel',
  'dashboard.dock.segBrush.description':
    'Erweitert die Segmentierungsmaske, um Buchstaben, Konturen oder Sprechblasenteile wiederherzustellen, die ausgelassen wurden.',
  'dashboard.dock.segBrush.badge': 'Seg',
  'dashboard.dock.segBrush.disabledReason':
    'Verfügbar in der Phase „Text segmentieren".',
  'dashboard.dock.segEraser.ariaLabel': 'Radierer für segmentierte Bereiche',
  'dashboard.dock.segEraser.title': 'Segmentradierer',
  'dashboard.dock.segEraser.description':
    'Verfeinert die Maske, indem überschüssige Auswahl, Überläufer und Artefakte entfernt werden, die nicht in die Bereinigung aufgenommen werden sollten.',
  'dashboard.dock.segEraser.badge': 'Seg',
  'dashboard.dock.segEraser.disabledReason':
    'Verfügbar in der Phase „Text segmentieren".',
  'dashboard.dock.divider.img': 'Bild',
  'dashboard.dock.paint.ariaLabel': 'Malpinsel',
  'dashboard.dock.paint.title': 'Pinsel',
  'dashboard.dock.paint.description':
    'Male über Artefakte, Inpainting-Fehler oder Details, die Mikrokorrekturen direkt auf dem Bild benötigen.',
  'dashboard.dock.paint.badge': 'Bild',
  'dashboard.dock.paint.disabledReason':
    'Wechsle in den manuellen Modus und wähle ein aktives Bild zum Bearbeiten.',
  'dashboard.dock.paintEraser.ariaLabel': 'Malradierer',
  'dashboard.dock.paintEraser.title': 'Radierer',
  'dashboard.dock.paintEraser.description':
    'Löscht nur die manuelle Malebene, um Änderungen rückgängig zu machen, ohne die übrigen Erkennungen und Masken zu verlieren.',
  'dashboard.dock.paintEraser.badge': 'Bild',
  'dashboard.dock.paintEraser.disabledReason':
    'Wechsle in den manuellen Modus und wähle ein aktives Bild zum Bearbeiten.',
  'dashboard.dock.wand.ariaLabel': 'Zauberstab',
  'dashboard.dock.wand.title': 'Zauberstab',
  'dashboard.dock.wand.description':
    'Wählt schnell einen zusammenhängenden Bereich nach Farbe/Toleranz für präzise Reparatur oder Restentfernung aus.',
  'dashboard.dock.wand.badge': 'Bild',
  'dashboard.dock.wand.disabledReason':
    'Wechsle in den manuellen Modus und wähle ein aktives Bild zum Bearbeiten.',
  'dashboard.dock.healing.ariaLabel': 'Reparaturpinsel',
  'dashboard.dock.healing.title': 'Reparaturpinsel',
  'dashboard.dock.healing.description':
    'Wendet lokalisiertes Inpainting über Defekte, abgebrochene Kanten und Textreste an, während die umgebende Textur natürlicher erhalten bleibt.',
  'dashboard.dock.healing.badge': 'Bild',
  'dashboard.dock.healing.disabledReason':
    'Wechsle in den manuellen Modus und wähle ein aktives Bild zum Bearbeiten.',
  'dashboard.dock.clearPaint.ariaLabel': 'Malebene leeren',
  'dashboard.dock.clearPaint.title': 'Malebene leeren',
  'dashboard.dock.clearPaint.description':
    'Löscht die gesamte manuelle Malebene vom aktiven Bild, ohne andere Korrekturen oder den Phasenverlauf zurückzusetzen.',
  'dashboard.dock.clearPaint.badge': 'Reset',
  'dashboard.dock.clearPaint.disabledReason':
    'Erscheint nur, wenn auf dem aktiven Bild bereits manuell gemalt wurde.',
  'dashboard.dock.resetEdits.ariaLabel': 'Alle Bearbeitungen zurücksetzen',
  'dashboard.dock.resetEdits.title': 'Bearbeitungen zurücksetzen',
  'dashboard.dock.resetEdits.description':
    'Setzt das aktive Bild auf den ursprünglichen manuellen Phasenzustand zurück und entfernt Malerei, Reparatur, Zauberstab-Auswahl und lokale Überschreibungen.',
  'dashboard.dock.resetEdits.badge': 'Reset',
  'dashboard.dock.resetEdits.disabledReason':
    'Verfügbar, wenn das aktive Bild bereits manuelle Eingriffe erhalten hat.',
  'modelManager.stage.automaticAiClean': 'Automatische KI-Bereinigung',
  'resources.fonts.downloadLabel': 'Herunterladen',
  'dashboard.sidebar.supportedFormats':
    'JPG, PNG, WEBP, ZIP, PDF, CBZ, CB7, PSD',
  'dashboard.cleaner.ocr.label': 'OCR',
  'dashboard.cleaner.ai.defaultProvider': 'Cloud / API / KI',
  'bugReport.screenshot.alt': 'Screenshot',
  'pageTransition.loading.ariaLabel': 'Wird geladen',
  'watermark.text.placeholder': 'KŌMA Studio',
  'watermark.logo.alt': 'Logo',
  'dashboard.textDetection.regionActions.aria': 'Bereichsaktionen',
  'dashboard.textDetection.manualModeRequired': 'Manueller Modus erforderlich',
  'dashboard.textDetection.removeRegion': 'Bereich entfernen',
  'dashboard.renderText.rewind.title': 'Dieses Bild zurückspulen',
  'dashboard.renderText.forward.title': 'Dieses Bild vorspulen',
  'dashboard.renderText.noHistory': 'Kein AIO-Verlauf für dieses Bild',
  'dashboard.renderText.editPlaceholder': 'Endgültigen Text eingeben...',
  'dashboard.renderText.editAria': 'Gerenderten Text bearbeiten',
  'dashboard.renderText.removeSelection.title': 'Auswahl entfernen',
  'dashboard.renderText.regionActions.aria': 'Bereichsaktionen',
  'dashboard.pipeline.prevStep.title':
    'Zur vorherigen AIO-Pipeline-Phase zurückkehren',
  'dashboard.pipeline.nextStep.title':
    'Zur nächsten AIO-Pipeline-Phase vorrücken',
  'dashboard.pipeline.runStep.title':
    'Nur die aktuelle Phase für das ausgewählte Bild ausführen',
  'dashboard.pipeline.skipStep.title':
    'Die aktuelle Phase überspringen und die nächste freischalten',
  'dashboard.typesetter.applyStyleAll.title':
    'Den aktuellen Auswahlstil auf alle Bereiche anwenden',
  'auth.error.internetRequired':
    'Internetzugang ist erforderlich, um sich bei der App anzumelden.',
  'auth.error.mandatoryUpdate':
    'Pflichtupdate verfügbar. Aktualisiere die App, um fortzufahren.',
  'dashboard.textDetection.noTextRecognized': 'Kein erkannter Text',
  'dashboard.textDetection.noTranslation': 'Keine Übersetzung verfügbar',
  'dashboard.textDetection.noNt': 'Keine TN verfügbar',
  'dashboard.renderText.dblClickToEdit': 'Doppelklick zum Bearbeiten',
  'dashboard.renderText.renderNotApplied':
    'Rendering in dieser Phase nicht angewandt',
  'dashboard.status.stageLabelTranslation': 'Übersetzung',
  'dashboard.status.profilesPersistedDesktopSecure':
    'Benutzerdefinierte Profile auf dem Desktop mit sicherem Speicher gespeichert.',
  'dashboard.status.profilesPersistedDesktopLocal':
    'Benutzerdefinierte Profile auf dem Desktop ohne native Verschlüsselung gespeichert.',
  'dashboard.status.profilesPersistedBrowser':
    'Benutzerdefinierte Profile im lokalen Browser dieses Geräts gespeichert.',
  'dashboard.status.aioScopeManual': 'AIO manuell',
  'dashboard.status.aioScopeAuto': 'AIO automatisch',
  'dashboard.status.cleanerSelectProfileFirst':
    'Wähle ein gespeichertes visuelles Profil für die automatische KI-Bereinigung.',
  'dashboard.status.cleanerProfileNotFound':
    'Visuelles Profil nicht gefunden. Neu laden und erneut versuchen.',
  'dashboard.status.cleanerProfileInUse':
    'Visuelles Profil für die automatische KI-Bereinigung aktiv: {label}.',
  'dashboard.status.cleanerSelectValidModel':
    'Wähle ein gültiges Modell für die automatische KI-Bereinigung.',
  'dashboard.status.modelInRoadmap':
    'Das Modell „{name}" befindet sich noch in der Roadmap.',
  'dashboard.status.modelNeedsConfig':
    'Das Modell „{name}" erfordert vor der Nutzung eine Konfiguration.',
  'dashboard.status.translatorSfxSelectValidModel':
    'Wähle ein gültiges Modell für die KI-SFX des Übersetzers.',
  'dashboard.status.cleanerProfileSaved':
    'Visuelles Profil gespeichert und für die automatische KI-Bereinigung ausgewählt: {label}.',
  'dashboard.status.cleanerSelectProfileToRemove':
    'Wähle ein gespeichertes visuelles Profil zum Entfernen.',
  'dashboard.status.customProfilePendingSync':
    'Benutzerdefiniertes Profil wartet auf lokale Synchronisierung.',
  'dashboard.status.customProfileOcrPendingSync':
    'Benutzerdefiniertes OCR-Profil wartet auf lokale Synchronisierung.',
  'dashboard.status.presetAppliedToSelection':
    'Vorlage „{name}" auf die aktuelle Auswahl angewandt.',
  'dashboard.status.legacyPresetNotFound':
    'Legacy-Vorlage {modeKey} nicht gefunden.',
  'dashboard.status.presetAppliedShort':
    'Vorlage „{name}" auf die Auswahl angewandt.',
  'dashboard.status.presetAppliedToImage':
    'Vorlage „{name}" auf das aktive Bild angewandt.',
  'dashboard.status.typographerSelectionDuplicated':
    'Auswahl im Typesetter dupliziert.',
  'dashboard.status.autoShapeApplied': 'Automatische Form angewandt: {shape}.',
  'dashboard.status.renderStyleAppliedAll':
    'Rendering-Stil auf alle Auswahlen in allen Bildern angewandt.',
  'dashboard.status.canvasInitFailed':
    'Manuelle Kompositions-Canvas konnte nicht initialisiert werden.',
  'dashboard.status.cleanerCanvasInitFailed':
    'Cleaner-Canvas für manuelle Komposition konnte nicht initialisiert werden.',
  'dashboard.status.wandPrepFailed':
    'Zauberstab konnte nicht vorbereitet werden.',
  'dashboard.status.wandSelectionUpdated':
    'Zauberstab-Auswahl aktualisiert. Verwende Reparatur, um Inpainting anzuwenden.',
  'dashboard.status.wandNoArea':
    'Der Zauberstab hat keinen kompatiblen Bereich zur Auswahl gefunden.',
  'dashboard.status.wandExecFailed':
    'Zauberstab konnte nicht ausgeführt werden.',
  'dashboard.status.cleanerWandPrepFailed':
    'Cleaner-Zauberstab konnte nicht vorbereitet werden.',
  'dashboard.status.cleanerWandSelectionUpdated':
    'Cleaner-Zauberstab-Auswahl aktualisiert. Verwende Reparatur, um Inpainting anzuwenden.',
  'dashboard.status.cleanerWandNoArea':
    'Der Cleaner-Zauberstab hat keinen kompatiblen Bereich zur Auswahl gefunden.',
  'dashboard.status.cleanerWandExecFailed':
    'Cleaner-Zauberstab konnte nicht ausgeführt werden.',
  'dashboard.status.healingInvalidResponse':
    'Ungültige Antwort beim Anwenden des Reparaturpinsels.',
  'dashboard.status.cleanerHealingInvalidResponse':
    'Ungültige Antwort beim Anwenden des Reparaturpinsels im Cleaner.',
  'dashboard.status.cleanerHealingConnectFailed':
    'Cleaner-Reparatur konnte keine Verbindung zum Backend herstellen ({url}). Prüfe, ob das Mini-Backend aktiv ist.',
  'dashboard.status.cleanerHealingFailed':
    'Reparaturpinsel im Cleaner konnte nicht angewandt werden.',
  'dashboard.status.wandNoSelectionForHealing':
    'Keine Zauberstab-Auswahl zum Anwenden der Reparatur vorhanden.',
  'dashboard.status.renderCanvasInitFailed':
    'Rendering-Canvas konnte nicht initialisiert werden.',
  'dashboard.status.aioCompleteAdjust':
    '{message} Bei Bedarf manuell anpassen.',
  'dashboard.status.aioAborted': 'AIO-Durchlauf abgebrochen.',
  'dashboard.alert.importWorkspaceConfirm':
    'Das Importieren dieses Arbeitsbereichs ersetzt den aktuellen Arbeitsbereich im Speicher. Möchtest du fortfahren?',
  'dashboard.alert.clearAutosaveConfirm':
    'Das Löschen der lokalen automatischen Speicherung entfernt den zuletzt gespeicherten Arbeitsbereich auf diesem PC für diesen Benutzer. Fortfahren?',
  'dashboard.alert.closeWorkspaceConfirm':
    'Aktuellen Arbeitsbereich schließen? Dadurch werden alle geladenen Bilder und die lokale automatische Speicherung entfernt. Diese Aktion kann nicht rückgängig gemacht werden.',
  'dashboard.status.workspacePendingChanges':
    'Der Arbeitsbereich hat ungespeicherte Änderungen.',
  'dashboard.status.toolSelectArea': 'Bereich auswählen',
  'dashboard.status.toolSegmentBrush': 'Segmentpinsel',
  'dashboard.status.toolSegmentEraser': 'Segmentradierer',
  'dashboard.alert.emailPendingTitle': 'E-Mail-Bestätigung ausstehend',
  'dashboard.alert.emailPendingText':
    'Bestätige deine E-Mail, um Verarbeitungsaktionen durchzuführen.',
  'dashboard.status.typographerSession': 'Typesetter-Sitzung',
  'dashboard.status.cleanerMeta':
    'OCR: {ocrCount} • Segmentiert: {segmentedCount} • Bereinigt: {cleaned}',
  'dashboard.status.metaOk': 'ok',
  'dashboard.status.metaPending': 'ausstehend',
  'dashboard.status.cleanerRunFirst':
    'Führe den Cleaner aus, um OCR, Segmentierung und ein bereinigtes Bild zu generieren.',
  'dashboard.status.translatorMeta':
    'Erkennung: {detected} • OCR: {ocr} • Übersetzung: {translated}',
  'dashboard.status.translatorRunFirst':
    'Führe den visuellen Übersetzer aus, um zu erkennen, zu lesen und zu übersetzen.',
  'dashboard.status.localModelDownloadHint':
    'Lokale Modelle werden bei Bedarf heruntergeladen; Cloud-/API-Modelle verwenden weiterhin einen Schlüssel.',
  'dashboard.status.selectionTextModeAria': 'Textmodus der aktuellen Auswahl',
  'dashboard.status.translatorUsesAioModel':
    'Der Übersetzer verwendet dieselbe Modellauswahl wie AIO; nach dem Modellwechsel erneut ausführen.',
  'dashboard.status.translatorLocalModelIncompatible':
    'Das aktuelle lokale Modell unterstützt das Sprachpaar des Übersetzers nicht. Wähle ein anderes Modell oder verwende Cloud.',
  'dashboard.status.stitchLastMoved':
    'Letztes Bild an den nächsten Stapel gesendet.',
  'dashboard.status.stitchFirstPulled':
    'Erstes Bild des nächsten Stapels zum aktuellen Stapel hinzugefügt.',
  'auth.error.generic': 'Fehler {status}',
  'auth.error.desktopBridgeUnavailable':
    'Desktop-Authentifizierungsbrücke nicht verfügbar.',
  'dashboard.status.modeLabel': 'Modus',
  'dashboard.status.selectedLabel': 'Ausgewählt',
  'dashboard.status.selectBoxInPreview': 'Wähle eine Box in der Vorschau.',
  'dashboard.status.selectTranslatorModel':
    'Wähle ein lokales oder Cloud-Modell für die Übersetzung im Übersetzer.',
  'dashboard.error.loadHardwareFailed':
    'Lokale Hardware konnte nicht geladen werden.',
  'dashboard.error.healingBrushFailed':
    'Reparaturpinsel fehlgeschlagen: {message}',
  'dashboard.status.healingBrushApplyFailed':
    'Reparaturpinsel konnte nicht angewandt werden.',
  'dashboard.error.cleanerHealingBrushFailed':
    'Cleaner-Reparaturpinsel fehlgeschlagen: {message}',
  'dashboard.status.aioExecutionFailed': 'AIO konnte nicht ausgeführt werden.',
  'dashboard.status.autosaveSaveFailed':
    'Lokale automatische Speicherung konnte nicht gespeichert werden.',
  'dashboard.status.workspaceExportFailed':
    'Arbeitsbereich konnte nicht exportiert werden.',
  'dashboard.status.workspaceImportFailed':
    'Arbeitsbereich konnte nicht importiert werden.',
  'dashboard.status.autosaveClearFailed':
    'Lokale automatische Speicherung konnte nicht gelöscht werden.',
  'dashboard.status.noModelSelected': 'Kein Modell ausgewählt.',
  'dashboard.status.aiCleanModelSelected':
    'Modell für automatische KI-Bereinigung ausgewählt: {model}',
  'dashboard.status.selectionMode': 'Auswahlmodus',
  'dashboard.status.workspaceRestored': 'Arbeitsbereich wiederhergestellt.',
  'dashboard.status.workspaceRestoredFromAutosave':
    'Arbeitsbereich aus lokaler automatischer Speicherung wiederhergestellt.',
  'dashboard.aio.skip': 'Überspringen',
  'dashboard.aio.imageLabel': 'Bild:',
  'dashboard.aio.stepLabel': 'Phase:',
  'dashboard.aio.historyHint': 'Phase: {label} ({current}/{total})',
  'dashboard.typo.fontsUpdating': 'Wird aktualisiert…',
  'dashboard.typo.updateFonts': 'Schriften aktualisieren',
  'dashboard.typo.importFontTitle': 'Benutzerdefinierte Schrift importieren',
  'dashboard.typo.desktopOnly': 'Nur in der Desktop-App',
  'dashboard.typo.fontImporting': 'Wird importiert…',
  'dashboard.typo.importFont': 'Schrift importieren',
  'dashboard.typo.applyStyleToAll': 'Stil auf alle anwenden',
  'dashboard.typo.fontControlsHint':
    'Schrift-/Farb-/Ausrichtungssteuerungen befinden sich im kontextbezogenen Overlay-Dock. Tastenkürzel:',
  'dashboard.aio.languageLabel': 'Sprache:',
  'shortcuts.category.global': 'Global',
  'shortcuts.category.modes': 'Modi',
  'shortcuts.category.typesetter': 'Typesetter',
  'shortcuts.noShortcut': 'Kein Tastenkürzel',
  'shortcuts.openShortcutModal.label': 'Tastenkürzel-Center öffnen',
  'shortcuts.openShortcutModal.description':
    'Öffnet das Tastenkürzel- und Konfigurations-Modal.',
  'shortcuts.toggleToolsPanel.label': 'Werkzeugbereich ein-/ausblenden',
  'shortcuts.toggleToolsPanel.description':
    'Schaltet die Sichtbarkeit des Werkzeugbereichs um.',
  'shortcuts.rotateActiveImage.label': 'Aktives Bild drehen',
  'shortcuts.rotateActiveImage.description':
    'Dreht das ausgewählte Bild um 90 Grad.',
  'shortcuts.workspaceSave.label': 'Lokalen Arbeitsbereich speichern',
  'shortcuts.workspaceSave.description':
    'Erzwingt eine lokale automatische Speicherung des aktuellen Arbeitsbereichs.',
  'shortcuts.workspaceUndo.label': 'Arbeitsbereich rückgängig machen',
  'shortcuts.workspaceUndo.description':
    'Macht die letzte Änderung im aktuellen Arbeitsbereich rückgängig.',
  'shortcuts.workspaceRedo.label': 'Arbeitsbereich wiederherstellen',
  'shortcuts.workspaceRedo.description':
    'Stellt die zuletzt rückgängig gemachte Änderung im aktuellen Arbeitsbereich wieder her.',
  'shortcuts.zoomIn.label': 'Hineinzoomen',
  'shortcuts.zoomIn.description': 'Zoomt in die aktuelle Ansicht hinein.',
  'shortcuts.zoomOut.label': 'Herauszoomen',
  'shortcuts.zoomOut.description': 'Zoomt aus der aktuellen Ansicht heraus.',
  'shortcuts.setViewPaginated.label': 'Seitenweise Ansicht',
  'shortcuts.setViewPaginated.description':
    'Wechselt zur seitenweisen Ansicht.',
  'shortcuts.setViewLongStrip.label': 'Langer-Streifen-Ansicht',
  'shortcuts.setViewLongStrip.description':
    'Wechselt zur Langer-Streifen-Ansicht.',
  'shortcuts.setModeOrganize.label': 'Organisieren-Modus',
  'shortcuts.setModeOrganize.description': 'Wechselt zum Organisieren-Modus.',
  'shortcuts.setModeAio.label': 'AIO-Modus',
  'shortcuts.setModeAio.description': 'Wechselt zum AIO-Modus.',
  'shortcuts.setModeCleaner.label': 'Cleaner-/Redrawer-Modus',
  'shortcuts.setModeCleaner.description':
    'Wechselt zum Cleaner-/Redrawer-Modus.',
  'shortcuts.setModeTypesetter.label': 'Typesetter-Modus',
  'shortcuts.setModeTypesetter.description': 'Wechselt zum Typesetter-Modus.',
  'shortcuts.setModeTranslator.label': 'Übersetzer-Modus',
  'shortcuts.setModeTranslator.description': 'Wechselt zum Übersetzer-Modus.',
  'shortcuts.setModeRaw.label': 'Raw-Anbieter-Modus',
  'shortcuts.setModeRaw.description': 'Wechselt zum Raw-Anbieter-Modus.',
  'shortcuts.setModeProofreader.label': 'Korrekturleser-/QC-Modus',
  'shortcuts.setModeProofreader.description':
    'Wechselt zum Korrekturleser-/QC-Modus.',
  'shortcuts.setModeStitch.label': 'Zusammenfügen-Modus',
  'shortcuts.setModeStitch.description': 'Wechselt zum Zusammenfügen-Modus.',
  'shortcuts.setModeSplit.label': 'Intelligentes-Teilen-Modus',
  'shortcuts.setModeSplit.description':
    'Wechselt zum Intelligentes-Teilen-Modus.',
  'shortcuts.setModeWatermark.label': 'Wasserzeichen-Modus',
  'shortcuts.setModeWatermark.description': 'Wechselt zum Wasserzeichen-Modus.',
  'shortcuts.setModeEnhance.label': 'Bildverbesserung-Modus',
  'shortcuts.setModeEnhance.description':
    'Wechselt zum Bildverbesserung-Modus.',
  'shortcuts.setModeGuides.label': 'Anleitungen-Modus',
  'shortcuts.setModeGuides.description': 'Wechselt zum Anleitungen-Modus.',
  'shortcuts.setModeResources.label': 'Ressourcen-Modus',
  'shortcuts.setModeResources.description': 'Wechselt zum Ressourcen-Modus.',
  'shortcuts.applyText.label': 'Text anwenden',
  'shortcuts.applyText.description':
    'Wendet das ausgewählte Warteschlangenelement im Typesetter oder manuellen AIO-Rendering an.',
  'shortcuts.nextRegion.label': 'Nächsten Bereich auswählen',
  'shortcuts.nextRegion.description':
    'Verschiebt die Auswahl zum nächsten Bereich im Typesetter oder manuellen AIO.',
  'shortcuts.previousRegion.label': 'Vorherigen Bereich auswählen',
  'shortcuts.previousRegion.description':
    'Verschiebt die Auswahl zum vorherigen Bereich im Typesetter oder manuellen AIO.',
  'shortcuts.toggleMultiBubble.label': 'Multi-Sprechblase umschalten',
  'shortcuts.toggleMultiBubble.description':
    'Schaltet die Multi-Sprechblasen-Gruppierung im Typesetter oder manuellen AIO um.',
  'shortcuts.saveSnapshot.label': 'Schnappschuss speichern',
  'shortcuts.saveSnapshot.description':
    'Speichert einen Schnappschuss der Typesetter- oder manuellen AIO-Sitzung.',
  'shortcuts.detectShapes.label': 'Form erkennen/verfeinern',
  'shortcuts.detectShapes.description':
    'Führt Erkennung oder Verfeinerung der ausgewählten Form im Typesetter oder manuellen AIO aus.',
  'shortcuts.applyActivePreset.label': 'Aktive Vorlage anwenden',
  'shortcuts.applyActivePreset.description':
    'Wendet die aktive Typografie-Vorlage auf den ausgewählten Bereich an.',
  'shortcuts.applyLegacyPresetTextBubble.label':
    'Legacy-Vorlage text_bubble anwenden',
  'shortcuts.applyLegacyPresetTextBubble.description':
    'Wendet die Legacy-Vorlage text_bubble auf den ausgewählten Bereich an.',
  'shortcuts.applyLegacyPresetTextFree.label':
    'Legacy-Vorlage text_free anwenden',
  'shortcuts.applyLegacyPresetTextFree.description':
    'Wendet die Legacy-Vorlage text_free auf den ausgewählten Bereich an.',
  'shortcuts.applyLegacyPresetTextSfx.label':
    'Legacy-Vorlage text_sfx anwenden',
  'shortcuts.applyLegacyPresetTextSfx.description':
    'Wendet die Legacy-Vorlage text_sfx auf den ausgewählten Bereich an.',
  'shortcuts.applyLegacyPresetTextNarration.label':
    'Legacy-Vorlage text_narration anwenden',
  'shortcuts.applyLegacyPresetTextNarration.description':
    'Wendet die Legacy-Vorlage text_narration auf den ausgewählten Bereich an.',
  'shortcuts.applyLegacyPresetTextInsideBlackBubble.label':
    'Legacy-Vorlage text_inside_black_bubble anwenden',
  'shortcuts.applyLegacyPresetTextInsideBlackBubble.description':
    'Wendet die Legacy-Vorlage text_inside_black_bubble auf den ausgewählten Bereich an.',
  'shortcuts.applyAutoShape.label': 'Automatische Form anwenden',
  'shortcuts.applyAutoShape.description':
    'Wählt automatisch zwischen elliptisch und rechteckig für den ausgewählten Bereich.',
  'shortcuts.convertShapeSquare.label': 'Form in Rechteck umwandeln',
  'shortcuts.convertShapeSquare.description':
    'Wandelt den ausgewählten Bereich in eine rechteckige Form um.',
  'shortcuts.convertShapeRounded.label': 'Form in Ellipse umwandeln',
  'shortcuts.convertShapeRounded.description':
    'Wandelt den ausgewählten Bereich in eine elliptische Form um.',
  'shortcuts.deleteRegion.label': 'Ausgewählten Bereich entfernen',
  'shortcuts.deleteRegion.description':
    'Entfernt den ausgewählten Bereich im manuellen AIO, Typesetter, visuellen Übersetzer oder Cleaner.',
  'shortcuts.editInline.label': 'Inline-Bearbeitung des Bereichs öffnen',
  'shortcuts.editInline.description':
    'Öffnet die Inline-Bearbeitung für den ausgewählten Bereich im manuellen Rendering.',
  'shortcuts.inlineEditorCancel.label': 'Inline-Bearbeitung abbrechen',
  'shortcuts.inlineEditorCancel.description':
    'Nur innerhalb des Inline-Bearbeitungstextfelds verfügbar.',
  'shortcuts.inlineEditorSave.label': 'Inline-Bearbeitung speichern',
  'shortcuts.inlineEditorSave.description':
    'Nur innerhalb des Inline-Bearbeitungstextfelds verfügbar.',
  'shortcuts.category.palette': 'Werkzeugpalette',
  'shortcuts.duplicateRegion.label': 'Ausgewählten Bereich duplizieren',
  'shortcuts.duplicateRegion.description':
    'Dupliziert den ausgewählten Bereich im Typesetter oder manuellen AIO mit 18px Versatz.',
  'shortcuts.toolConfigToggle.label': 'Konfigurationspanel umschalten',
  'shortcuts.toolConfigToggle.description':
    'Öffnet oder schließt das Konfigurationspanel des aktiven Werkzeugs in der Palette.',
  'shortcuts.toolAreaSelect.label': 'Werkzeug: Bereichsauswahl',
  'shortcuts.toolAreaSelect.description':
    'Aktiviert das Bereichsauswahlwerkzeug im manuellen AIO.',
  'shortcuts.toolClearRegions.label': 'Alle Bereiche entfernen',
  'shortcuts.toolClearRegions.description':
    'Entfernt alle Bereiche vom aktiven Bild im manuellen AIO.',
  'shortcuts.toolSegmentBrush.label': 'Werkzeug: Segmentpinsel',
  'shortcuts.toolSegmentBrush.description':
    'Aktiviert den Pinsel für die manuelle Bearbeitung der Segmentierungsmaske.',
  'shortcuts.toolSegmentEraser.label': 'Werkzeug: Segmentradierer',
  'shortcuts.toolSegmentEraser.description':
    'Aktiviert den Radierer für die manuelle Bearbeitung der Segmentierungsmaske.',
  'shortcuts.toolPaint.label': 'Werkzeug: Malen',
  'shortcuts.toolPaint.description':
    'Aktiviert das manuelle Malwerkzeug auf dem Bild.',
  'shortcuts.toolPaintEraser.label': 'Werkzeug: Malradierer',
  'shortcuts.toolPaintEraser.description':
    'Aktiviert den Radierer zum Löschen der manuellen Malebene.',
  'shortcuts.toolMagicWand.label': 'Werkzeug: Zauberstab',
  'shortcuts.toolMagicWand.description':
    'Aktiviert den Zauberstab für farbtoleranzbasierte Auswahl.',
  'shortcuts.toolHealingBrush.label': 'Werkzeug: Reparaturpinsel',
  'shortcuts.toolHealingBrush.description':
    'Aktiviert den Reparaturpinsel zur Bildwiederherstellung.',
  'shortcuts.toolClearPaint.label': 'Malebene leeren',
  'shortcuts.toolClearPaint.description':
    'Entfernt die gesamte manuelle Malebene vom aktiven Bild.',
  'shortcuts.toolResetEdits.label': 'Manuelle Bearbeitungen zurücksetzen',
  'shortcuts.toolResetEdits.description':
    'Macht alle manuellen Bearbeitungen am aktiven Bild im Cleaner oder AIO rückgängig.',
  'dashboard.coachmark.stage.titleSuffix': 'Hauptansicht',
  'dashboard.coachmark.stage.bodyWithImages':
    'Hier siehst du das aktive Bild, überprüfst das visuelle Ergebnis des Modus <strong>{modeLabel}</strong> und nimmst Anpassungen mit sofortigem Feedback vor.',
  'dashboard.coachmark.stage.bodyWithoutImages':
    'Wenn du Bilder lädst, wird diese Ansicht zum visuellen Zentrum des Modus <strong>{modeLabel}</strong>. Hier erscheint das Ergebnis zuerst.',
  'dashboard.coachmark.stage.accent': 'Ansicht',
  'dashboard.coachmark.tools.titleSuffix': 'Werkzeugkasten',
  'dashboard.coachmark.tools.body':
    'Verwende die rechte Seitenleiste, um Optionen, Vorlagen und Aktionen für den Modus <strong>{modeLabel}</strong> zu konfigurieren. Wenn sich etwas im Ablauf ändert, beginnt es normalerweise hier.',
  'dashboard.coachmark.tools.accent': 'Werkzeuge',
  'dashboard.coachmark.download.titleSuffix': 'Export',
  'dashboard.coachmark.download.body':
    'Wenn das Ergebnis passt, schließe über das Exportmenü ab, um Bilder, Pakete oder PSDs herunterzuladen, ohne den aktuellen Modus zu verlassen.',
  'dashboard.coachmark.download.accent': 'Lieferung',
  'dashboard.coachmark.organize.uploadTitle':
    'Organisieren: mit Upload beginnen',
  'dashboard.coachmark.organize.uploadBody':
    'Ziehe Seiten, Kapitel oder ganze Pakete hierher. Der Organisieren-Modus dient dazu, den Stapel vorzubereiten, bevor du in die Produktion wechselst.',
  'dashboard.coachmark.organize.uploadAccent': 'Eingabe',
  'dashboard.coachmark.organize.orderTitle':
    'Organisieren: Reihenfolge überprüfen',
  'dashboard.coachmark.organize.orderBody':
    'In der linken Seitenleiste wählst du das aktive Bild, ordnest Seiten neu, entfernst fehlerhafte Elemente und prüfst, ob das Kapitel bereit ist fortzufahren.',
  'dashboard.coachmark.organize.orderAccent': 'Stapel',
  'dashboard.coachmark.aioAuto.pipelineTitle':
    'Auto-AIO: die Pipeline laufen lassen',
  'dashboard.coachmark.aioAuto.pipelineBody':
    'Im automatischen Modus konfigurierst du einmal und verarbeitest den Stapel der Reihe nach. Ideal für Durchsatz, Nachbearbeitung und repetitivere Workflows.',
  'dashboard.coachmark.aioAuto.pipelineAccent': 'Auto',
  'dashboard.coachmark.aioAuto.stagesTitle':
    'Auto-AIO: nur aktivieren, was du brauchst',
  'dashboard.coachmark.aioAuto.stagesBody':
    'Aktiviere nur die Phasen, die für diesen Stapel sinnvoll sind. Weniger Phasen bedeuten weniger Kosten, weniger Zeit und weniger Fehlerquellen.',
  'dashboard.coachmark.aioAuto.stagesAccent': 'Pipeline',
  'dashboard.coachmark.aioAuto.configTitle':
    'Auto-AIO: Modelle und Sprachen festlegen',
  'dashboard.coachmark.aioAuto.configBody':
    'Wähle Sprachen, Vorlagen und Modelle vor dem Ausführen. Dieser Teil beeinflusst Verarbeitungsgeschwindigkeit, Qualität und Kosten am meisten.',
  'dashboard.coachmark.aioAuto.configAccent': 'Einrichtung',
  'dashboard.coachmark.aioManual.title':
    'Manuelles AIO: Phase für Phase arbeiten',
  'dashboard.coachmark.aioManual.body':
    'Im manuellen Modus führst du jede Phase mit mehr Kontrolle aus, überprüfst und korrigierst sie. Der ideale Modus für Feinschliff und schwierige Fälle.',
  'dashboard.coachmark.aioManual.accent': 'Manuell',
  'dashboard.coachmark.aioManual.dockTitle':
    'Manuelles AIO: das Dock als Werkbank nutzen',
  'dashboard.coachmark.aioManual.dockBody':
    'Das schwebende Dock vereint Auswahl, Segmentierung, Malerei, Zauberstab und Reparatur. Betrachte es als das Mini-Schnelleingriffspanel über der Vorschau.',
  'dashboard.coachmark.aioManual.dockAccent': 'Dock',
  'dashboard.coachmark.typesetter.titleManual': 'Manueller Typesetter',
  'dashboard.coachmark.typesetter.titleAuto': 'Automatischer Typesetter',
  'dashboard.coachmark.typesetter.bodyManual':
    'Manuell ist am besten für Feinjustierungen an Sprechblasen, Formen, Schriften und visuellem Rhythmus pro Seite.',
  'dashboard.coachmark.typesetter.bodyAuto':
    'Auto beschleunigt Entwürfe und große Stapel. Folge mit einer schnellen visuellen Überprüfung, um Konsistenz sicherzustellen.',
  'dashboard.coachmark.typesetter.accentManual': 'Manuell',
  'dashboard.coachmark.typesetter.accentAuto': 'Auto',
  'dashboard.coachmark.cleaner.dockTitle':
    'Cleaner: lokale Korrektur, ohne das Bild zu verlassen',
  'dashboard.coachmark.cleaner.dockBody':
    'Wenn das Dock sichtbar ist, verwende Pinsel, Radierer und Reparatur, um Details zu schließen, ohne den Seitenkontext zu verlieren.',
  'dashboard.coachmark.cleaner.dockAccent': 'Dock',
  'dashboard.coachmark.content.titleSuffix': 'Inhaltsnavigation',
  'dashboard.coachmark.content.body':
    'Dieser Modus tauscht die visuelle Ansicht gegen ein Referenzpanel. Nutze ihn, um Workflows zu lernen, Supportmaterial zu überprüfen und mit weniger Aufwand zur Produktion zurückzukehren.',
  'dashboard.coachmark.content.accent': 'Referenz',
  'dashboard.coachmark.progress': 'Hinweis {{current}} / {{total}}',
  'dashboard.coachmark.next': 'Weiter',
  'dashboard.coachmark.prev': 'Zurück',
  'dashboard.coachmark.done': 'Verstanden',
  'aioModel.label.unavailable': ' (nicht verfügbar)',
  'aioModel.label.notInstalled':
    '(Nicht installiert — klicken zum Installieren)',
  'aioModel.label.updateAvailable': '(Update verfügbar)',
  'aioModel.label.installed': '(Installiert)',
  'aioModel.status.selectAndInstall':
    'Wähle und installiere ein lokales Modell für die Phase „{stage}".',
  'aioModel.status.installBeforeUse':
    'Installiere das Modell „{name}", bevor du diese Phase verwendest.',
  'aioModel.status.selectValidOcr': 'Wähle ein gültiges Modell für OCR.',
  'aioModel.status.inRoadmap':
    'Das Modell „{name}" befindet sich noch in der Roadmap.',
  'aioModel.status.requiresConfig':
    'Das Modell „{name}" erfordert vor der Nutzung eine Konfiguration.',
  'aioModel.status.installedOk': 'installiert (ok)',
  'aioModel.status.installedUpdate': 'installiert (Update verfügbar)',
  'aioExec.selectAndInstallStage':
    'Wähle und installiere ein lokales Modell, bevor du die Phase „{stageLabel}" ausführst.',
  'aioExec.installBeforeStage':
    'Installiere das Modell „{name}", bevor du die Phase „{stageLabel}" ausführst.',
  'aioExec.selectValidOcrModel': 'Wähle ein gültiges Modell für Text lesen.',
  'aioExec.ocrRequiresApiKey':
    'Dieser OCR-Anbieter erfordert einen API-Schlüssel. Konfiguriere den Schlüssel vor dem Ausführen.',
  'aioExec.installTranslationModel':
    'Installiere ein kompatibles Übersetzungsmodell, bevor du AIO ausführst.',
  'aioExec.incompatibleLanguage':
    'Das ausgewählte Modell ist nicht mit der aktuellen Sprache kompatibel.',
  'aioExec.translationModelIncompatible':
    '„{modelName}" unterstützt die ausgewählte Zielsprache nicht. Wähle ein kompatibles Modell oder ändere die Zielsprache.',
  'aioExec.selectValidTranslation':
    'Wähle ein gültiges Übersetzungsmodell, um fortzufahren.',
  'aioExec.selectCustomOcrProfile':
    'Wähle oder speichere ein benutzerdefiniertes KI-OCR-Profil, bevor du AIO ausführst.',
  'aioExec.selectCustomAiProfile':
    'Wähle oder speichere ein benutzerdefiniertes KI-Profil, bevor du AIO ausführst.',
  'aioExec.translationRequiresApiKey':
    'Dieser Übersetzungsanbieter erfordert einen API-Schlüssel. Konfiguriere den Schlüssel vor dem Ausführen.',
  'aioManual.selectImage': 'Wähle ein Bild, um im manuellen Modus auszuführen.',
  'aioManual.imageNotFound': 'Aktives Bild nicht gefunden.',
  'aioManual.progressNotInitialized':
    'Manuelle Progression für das aktive Bild nicht initialisiert.',
  'aioManual.selectValidDetectModel':
    'Wähle ein gültiges Modell für Text erkennen.',
  'aioManual.selectValidSegmentModel':
    'Wähle ein gültiges Modell für Text segmentieren.',
  'aioManual.selectValidCleanModel':
    'Wähle ein gültiges Modell für Bild bereinigen.',
  'aioManual.stageDone':
    'Manueller Modus: Phase „{stageLabel}" für „{fileName}" abgeschlossen.',
  'aioManual.executionAborted': 'Manueller AIO-Durchlauf abgebrochen.',
  'aioManual.stageFailed':
    'Phase „{stageLabel}" konnte nicht ausgeführt werden.',
  'translator.localModelIncompatible':
    'Das ausgewählte lokale Modell ist nicht mit der aktuellen Sprache des Übersetzers kompatibel.',
  'translator.selectValidTranslationModel':
    'Wähle ein gültiges Übersetzungsmodell für den Übersetzer.',
  'translator.selectCustomAiTranslationProfile':
    'Wähle oder speichere ein benutzerdefiniertes KI-Übersetzungsprofil vor dem Ausführen.',
  'translator.localOcrModelIncompatible':
    'Das ausgewählte lokale OCR-Modell ist nicht mit der aktuellen Sprache des Übersetzers kompatibel.',
  'translator.installCompatibleOcrModel':
    'Installiere ein kompatibles OCR-Modell, bevor du den visuellen Übersetzer ausführst.',
  'translator.selectValidOcrModel':
    'Wähle ein gültiges OCR-Modell für den visuellen Übersetzer.',
  'modelManager.error.diskCheckFailed':
    'Verfügbarer Speicherplatz konnte nicht überprüft werden.',
  'updater.mandatoryUpdate':
    'Dieses Update ist erforderlich. Lade es herunter und installiere es, um fortzufahren.',
  'translatorVisual.noImages':
    'Lade mindestens ein Bild, um den visuellen Übersetzer zu verwenden.',
  'translatorVisual.running.aiSfx':
    'Visueller Übersetzer KI-SFX: Erkennung, Klassifizierung, Lesung, Übersetzung und Bereinigung...',
  'translatorVisual.running.standard':
    'Visueller Übersetzer: Erkennung, Lesung und Übersetzung...',
  'translatorVisual.invalidSfxResponse':
    'Ungültige KI-SFX-Antwort vom Übersetzer für „{fileName}".',
  'translatorVisual.done.aiSfx':
    'Visueller Übersetzer KI-SFX abgeschlossen. {candidates} Kandidat(en), {approved} SFX genehmigt, {ocr} OCR(s), {translations} Übersetzung(en) und {redraw} Bereich(e) mit Neuzeichnungsanforderung.',
  'translatorVisual.done.standard':
    'Visueller Übersetzer abgeschlossen. {detected} Bereich(e) erkannt, {recognized} Text(e) gelesen, {translations} Übersetzung(en) generiert.',
  'translatorVisual.genericError':
    'Visueller Übersetzer konnte nicht ausgeführt werden.',
  'freeProvider.catalogOnly':
    'Der Anbieter „{name}" ist in v1 nur als Katalog verfügbar.',
  'enhanceActions.connectError':
    'Bildverbesserung konnte keine Verbindung zum Backend herstellen ({url}). Prüfe, ob das Mini-Backend aktiv ist.',
  'aioSingleProcessor.invalidCleanResponse':
    'Ungültige Antwort beim Bereinigen von „{fileName}".',
  'cleanerActions.detectFailed':
    'Bereiche für „{fileName}" konnten nicht erkannt werden: {message}',
  'cleanerActions.invalidSfxResponse':
    'Ungültige KI-SFX-Cleaner-Antwort für „{fileName}".',
  'cleanerActions.invalidAutoCleanResponse':
    'Ungültige Antwort der automatischen KI-Bereinigung für „{fileName}".',
  'cleanerActions.sfxDone':
    'KI-SFX-Cleaner abgeschlossen. {images} Bild(er), {candidates} Kandidat(en), {approved} SFX genehmigt und {redraw} Bereich(e) mit Neuzeichnungsanforderung.',
  'cleanerActions.autoCleanDone':
    'Automatische KI-Bereinigung abgeschlossen. {images} Bild(er) verarbeitet und {detected} Bereich(e) erkannt.',
  'cleanerActions.assistedDone':
    'Assistierter Cleaner abgeschlossen. {images} Bild(er) bereinigt, {detected} Bereich(e) erkannt, {recognized} Text(e) gelesen, {segmented} Bereich(e) segmentiert.',
  'webhook.event.processStart.label': 'Verarbeitung gestartet',
  'webhook.event.processStart.desc': 'Wenn ein Durchlauf beginnt',
  'webhook.event.processComplete.label': 'Verarbeitung abgeschlossen',
  'webhook.event.processComplete.desc':
    'Wenn ein Durchlauf erfolgreich abgeschlossen wird',
  'webhook.event.processError.label': 'Verarbeitungsfehler',
  'webhook.event.processError.desc': 'Wenn ein Fehler auftritt',
  'webhook.event.updateAvailable.label': 'Update verfügbar',
  'webhook.event.updateAvailable.desc': 'Wenn eine neue Version verfügbar ist',
  'webhook.event.updateDownloaded.label': 'Update heruntergeladen',
  'webhook.event.updateDownloaded.desc':
    'Wenn der Update-Download abgeschlossen ist',
  'webhook.event.updateError.label': 'Update-Fehler',
  'webhook.event.updateError.desc': 'Wenn der Updater fehlschlägt',
  'webhook.validation.urlRequired': 'Gib die Discord-Webhook-URL ein.',
  'webhook.validation.urlInvalid': 'Ungültige URL. Prüfe das Webhook-Format.',
  'webhook.validation.urlHttpsRequired':
    'Die Webhook-URL muss HTTPS verwenden.',
  'webhook.validation.urlNotDiscord':
    'Verwende eine offizielle Discord-URL (discord.com).',
  'webhook.validation.urlInvalidPath':
    'Der URL-Pfad entspricht keinem gültigen Discord-Webhook.',
  'typography.effect.none.label': 'Kein Effekt',
  'typography.effect.none.description':
    'Klarer Text, keine zusätzlichen Ebenen.',
  'typography.effect.balloon_smear.label': 'Balloon Smear',
  'typography.effect.balloon_smear.description':
    'Vertikaler grauer Streifen mit leichtem seitlichem Wackeln, inspiriert von dramatischem Sprechtext.',
  'typography.effect.smiles_outline.label': 'SMILES Outline',
  'typography.effect.smiles_outline.description':
    'Sanfte korallfarbene Kontur mit hellem Kern, süßer Flüsterstil.',
  'typography.effect.ahnnn_peach.label': 'Ahnnn Peach Glow',
  'typography.effect.ahnnn_peach.description':
    'Pfirsichfarbene Füllung mit warmem, sanftem Leuchten.',
  'typography.effect.silence_ink.label': 'Silence Ink',
  'typography.effect.silence_ink.description':
    'Violettblau mit sauberer Präsenz und leichter innerer Tiefe.',
  'typography.effect.hwa_pastel.label': 'HWA Pastel',
  'typography.effect.hwa_pastel.description':
    'Hellgelb mit rosa Kontur und sanftem Gefühl.',
  'typography.effect.hah_pop.label': 'HAH Pop',
  'typography.effect.hah_pop.description':
    'Heller Fliederkern mit Pop-Präsenz und rosa Relief.',
  'typography.effect.smooch_jelly.label': 'Smooch Jelly',
  'typography.effect.smooch_jelly.description':
    'Zartrosa mit geleeartigen Glanz und süßem Schatten.',
  'typography.effect.tremble_brush.label': 'Tremble Brush',
  'typography.effect.tremble_brush.description':
    'Energetischer blau-violetter Pinsel mit unregelmäßiger Kante.',
  'typography.effect.eheheh_whisper.label': 'EHEHEH Whisper',
  'typography.effect.eheheh_whisper.description':
    'Hellrosa mit flauschiger Kontur und schüchternem Leuchten.',
  'typography.effect.hoho_ink.label': 'HOHO Ink',
  'typography.effect.hoho_ink.description':
    'Dunkelblau mit vertikalem Tropfen und trockener Textur.',
  'typography.effect.blam_impact.label': 'BLAM Impact',
  'typography.effect.blam_impact.description':
    'Gelbe Explosion mit versetztem rotem Schatten.',
  'typography.effect.badump_soft.label': 'BADUMP Soft',
  'typography.effect.badump_soft.description':
    'Sanfter rosa Pastell-Verlauf mit romantischer Aura.',
  'typography.effect.thump_heavy.label': 'THUMP Heavy',
  'typography.effect.thump_heavy.description':
    'Schwarzer Einschlag mit hartem, schrägen weinfarbenen Schatten.',
  'typography.effect.neon_woah.label': 'WOAH Neon',
  'typography.effect.neon_woah.description':
    'Weißer Text mit intensivem rosa Leuchten für Überraschung/Brillanz.',
  'typography.effect.slash_speed.label': 'SLAP Speed Slash',
  'typography.effect.slash_speed.description':
    'Dunkle Typografie mit aggressivem diagonalen Streifen/Bewegungsunschärfe.',
  'typography.effect.ah_teal.label': 'Ah Teal',
  'typography.effect.ah_teal.description':
    'Aqua/Türkis mit dunkler Kontur und sanftem Sprachgefühl.',
  'typography.effect.drip_blue.label': 'DRIP Blue',
  'typography.effect.drip_blue.description':
    'Hellblau mit flüssigem Gefühl und Tropfeffekt.',
  'typography.effect.question_pop.label': 'Question Pop',
  'typography.effect.question_pop.description':
    'Warmes Satzzeichen mit versetztem korallfarbenem Schatten.',
  'typography.effect.laugh_curve.label': 'Laugh Curve',
  'typography.effect.laugh_curve.description':
    'Leuchtend Cyan für ein gebogenes und leichtes Lachen.',
  'typography.effect.shake_blur.label': 'Shake Blur',
  'typography.effect.shake_blur.description':
    'Dunkellila mit Vibrations-/Bewegungsunschärfe für Zittern.',
  'typography.effect.beep_outline.label': 'Beep Outline',
  'typography.effect.beep_outline.description':
    'Weißer Text mit dicker schwarzer Kontur für saubere, lesbare SFX.',
  'typography.effect.boom_comic.label': 'BOOM Comic',
  'typography.effect.boom_comic.description':
    'Klassische Comic-Stil gelb/rote Explosion.',
  'typography.effect.bang_chunk.label': 'BANG Chunk',
  'typography.effect.bang_chunk.description':
    'Lila/blauer Block mit dickem versetzten goldenen Schatten.',
  'typography.effect.break_glitch.label': 'BREAK Glitch',
  'typography.effect.break_glitch.description':
    'Dunkles Magenta mit Glitch-/Brokenscan-Textur.',
  'typography.effect.flinch_outline.label': 'FLINCH Outline',
  'typography.effect.flinch_outline.description':
    'Schwarz mit aggressiver weißer Kontur für sofortige Reaktion.',
  'typography.effect.growl_moss.label': 'Growl Moss',
  'typography.effect.growl_moss.description':
    'Trockenes Olivgrün für ein heiseres/tierisches Geräusch.',
  'typography.effect.yawn_soft.label': 'Yawn Soft',
  'typography.effect.yawn_soft.description':
    'Limettengrün mit violetter Kontur für müde/gedehnte Sprache.',
  'typography.effect.scratch_noise.label': 'Scratch Noise',
  'typography.effect.scratch_noise.description':
    'Raues Schwarz mit körnigem/verrauschtem Erscheinungsbild.',
  'typography.effect.crack_ink.label': 'Crack Ink',
  'typography.effect.crack_ink.description':
    'Trockener, scharfer schwarzer Pinsel für plötzlichen Einschlag.',
  'typography.effect.slap_scratch.label': 'Slap Scratch',
  'typography.effect.slap_scratch.description':
    'Dünner, gezogener Kritzel für einen Kratz-/Schnellschlageffekt.',
  'typography.effect.dash_edge.label': 'Dash Edge',
  'typography.effect.dash_edge.description':
    'Dunkelgrün mit scharfen Spitzen für einen plötzlichen Schnitt/Eintritt.',
  'typography.effect.scream_scratch.label': 'Scream Scratch',
  'typography.effect.scream_scratch.description':
    'Schwarzer Schrei mit rauem rotem Versatz.',
  'model.opus-mt-ja-en.description':
    'OPUS-MT-Pipeline optimiert für japanische Inhalte, mit englischer Übersetzung und sekundärem Fluss für Portugiesisch.',
  'model.nllb-200-600m-int8.description':
    'Multilinguales NLLB-Modell, auf int8 quantisiert, um Speicherverbrauch zu reduzieren und gleichzeitig gute Qualität für KO→EN/PT beizubehalten.',
  'model.opus-mt-zh-en.description':
    'OPUS-MT-Modell für Chinesisch mit primärer englischer Übersetzung und sekundärem Fluss für Portugiesisch.',
  'model.nllb-200-1.3b.description':
    'Multilinguales Modell höherer Qualität für allgemeine Übersetzung mit breiter Sprachabdeckung.',
  'model.nllb-200-1.3b-int8-ct2.description':
    'CTranslate2-quantisierte Version von NLLB 1.3B, reduziert VRAM bei hervorragendem Preis-Leistungs-Verhältnis.',
  'model.nllb-200-3.3b.description':
    'NLLB-Modell mit hoher Kapazität für maximale Qualität in mehreren Sprachen.',
  'model.sugoi_v4_ja_en_ct2.description':
    'Lokaler Japanisch→Englisch-Übersetzer mit CTranslate2 und SentencePiece, kompatibel mit dem BallonsTranslator-Offline-Fluss.',
  'model.m2m100_1_2b_ct2.description':
    'Lokaler multilingualer Übersetzer über CTranslate2, mit breiter Sprachabdeckung und Kompatibilität mit dem BallonsTranslator-Offline-Fluss.',
  'model.font_rtdetr_v2.description':
    'Lokales Modell zur Erkennung von Textbereichen in der AIO-Pipeline.',
  'model.comic_text_detector.description':
    'Lokaler Detektor basierend auf dem BallonsTranslator-CTD-Modul für Textboxen auf Manga-Seiten.',
  'model.manga_ocr.description': 'Lokales OCR-Modell für Japanisch im AIO.',
  'model.meiki_ocr.description':
    'Lokales japanisches OCR spezialisiert auf gerenderten Text, mit horizontalen und vertikalen ONNX-Modellen.',
  'model.paddleocr_vl_manga.description':
    'Lokales VLM-OCR spezialisiert auf japanische Manga.',
  'model.got_ocr2.description':
    'Lokales multimodales OCR über GOT-OCR 2.0 mit nativer Transformers-Laufzeit.',
  'model.qwen2_5_vl_3b.description':
    'Lokales multimodales OCR über Qwen2.5-VL-3B-Instruct.',
  'model.mangalmm.description':
    'Multimodales OCR/Verständnis spezialisiert auf Manga, basierend auf Qwen2.5-VL.',
  'model.rolmocr.description':
    'Robustes lokales OCR basierend auf Qwen2.5-VL mit Optimierung für Dokumentenlesung.',
  'model.glm_ocr_onnx.description':
    'Lokales GLM-OCR für komplexe Layouts mit nativer Transformers-Laufzeit.',
  'model.paddleocr.description':
    'Lokales OCR-Modell für russische/slawische Sprachen in der AIO-Pipeline.',
  'model.paddleocr_latin_v5.description':
    'Lokales OCR-Modell für lateinische Sprachen (inkl. Niederländisch) in der AIO-Pipeline.',
  'model.paddleocr_ch_v5.description':
    'Lokales OCR-Modell für Chinesisch in der AIO-Pipeline.',
  'model.paddleocr_en_v5.description':
    'Lokales OCR-Modell mit Fokus auf Englisch für die AIO-Pipeline.',
  'model.easyocr.description':
    'Mehrsprachiges lokales OCR mit Installation bei Bedarf im App-Modellverzeichnis.',
  'model.pororo.description':
    'Lokales OCR-Modell für Koreanisch in der AIO-Pipeline.',
  'model.baka_content_cc.description':
    'Lokales Modell zur Segmentierung/Verfeinerung von Textbereichen im AIO.',
  'model.aot.description':
    'Lokales Inpainting-Modell zur Sprechblasenbereinigung im AIO.',
  'model.lama_manga.description':
    'Lokales kontextuelles Inpainting-Modell für komplexe Bereiche im AIO.',
  'model.opencv_lama.description':
    'Leichtgewichtiges lokales Inpainting-Modell über OpenCV Zoo, ausgelegt für CPU und schnelle Ausführung.',
  'model.lama_fp32.description':
    'Empfohlener ONNX-Port von big-lama bei 512x512, geeignet für CPU/GPU als Ausgleich zwischen Qualität und Einfachheit.',
  'model.vntl_llama3_8b_v2.description':
    'LLaMA3-Feinabstimmung für japanische VN → Englisch. Neuaufgebauter mehrzeiliger Datensatz. Verwende Temperatur 0. (~5,7–8,5 GB GGUF).',
  'model.lfm2_350m_enjp_mt.description':
    'Ultra-leichter bidirektionaler JA↔EN-Übersetzer, 0,4B Parameter. Q4_0 bei nur 219 MB — ideal für CPU und Edge-Geräte.',
  'model.sakura_galtransl_7b_v3_7.description':
    'JA→ZH-CN-Übersetzer optimiert für Visual Novels. Bewahrt Zeilenumbrüche, Steuerzeichen und Ruby. CC-BY-NC-SA 4.0 (~4,25 GB IQ4_XS).',
  'model.sakura_1_5b_qwen2_5_v1_0.description':
    'Leichtgewichtige Alternative zu Sakura 7B mit IMatrix-Quantisierung. ~1 GB Q5KS. Ideal für Mittelklasse-GPUs oder CPU (~4 GB RAM).',
  'model.hunyuan_7b_mt_v1_0.description':
    'Tencent multilingualer Übersetzer — 1. Platz WMT25. 33 Sprachen bidirektional. Prompt: „Translate into <target_language>." (~4,2 GB Q4_K_M).',
  'model.pp_doclayout_v3.description':
    'Lokales Layout- und Texterkennungsmodell basierend auf PP-DocLayout V3. Hohe Genauigkeit für Seitenlayoutanalyse.',
  'model.paddleocr_vl_1_5.description':
    'Hochwertiges multilinguales VLM-OCR-Modell (PaddleOCR-VL 1.5). Bis zu 128 Tokens pro Textblock.',
  'model.waifu2x_swin_unet_art_scan_2x.description':
    'Beste lokale Option für Manga/Manhwa-Seiten mit Fokus auf Linienführung und Sprechblasen.',
  'model.waifu2x_swin_unet_art_scan_4x.description':
    '4x-Variante für gescannte Manga/Manhwa-Seiten.',
  'model.waifu2x_swin_unet_art_2x.description':
    '2x-Modell für saubere digitale/Anime-Kunst.',
  'model.4xnomos2_hq_mosr.description':
    'Hochwertiger 4x-ONNX-Upscaler für minimal degradiertes Material.',
  'model.4xspankendata.description':
    'Leichtgewichtiges ONNX-Modell als allgemeiner 4x-Fallback.',
  'model.2x_hfa2kcompact.description':
    'Kandidat nur über manuellen ONNX-Import/externe Konvertierung kompatibel.',
  'model.2x_digitalfilm_superultracompact.description':
    'Kandidat für manuellen ONNX-Import.',
  'model.2x_anifilm_compact.description': 'Kandidat für manuellen ONNX-Import.',
  'model.2xnomosuni_span_multijpg_ldl.description':
    'Kandidat für manuellen ONNX-Import.',
  'model.realesrgan_x4plus.description': 'Kandidat für manuellen ONNX-Import.',
  'model.4xhfa2kludvaeswinir_light.description':
    'Kandidat für manuellen ONNX-Import.',
  'splitter.status.recipeApplied':
    'Splitter-Rezept auf das aktive Bild angewandt.',
  'splitter.status.recipeRestored':
    'Splitter-Rezept auf Standard zurückgesetzt.',
  'splitter.status.exportCancelled':
    'Splitter-Export vom Benutzer abgebrochen.',
  'splitter.error.noSegmentsActive':
    'Keine gültigen Segmente für das aktive Bild generiert.',
  'splitter.error.noSegmentsBatch':
    'Keine gültigen Segmente im Splitter-Stapel generiert.',
  'aioExec.sessionUnavailable': 'Sitzung für die Nutzung von Cloud-Modellen nicht verfügbar. Bitte erneut anmelden.',
  'aioManual.progressionNotInitialized':
    'Manuelle Progression für das aktive Bild nicht initialisiert.',
  'cleanerActions.selectValidOcrModel':
    'Wähle ein gültiges OCR-Modell für den Cleaner.',
  'cleanerActions.invalidCleanResponseNamed':
    'Ungültige Bereinigungsantwort für „{name}".',
  'customLlm.selectTranslationProfile':
    'Wähle ein gespeichertes benutzerdefiniertes Übersetzungsprofil zur Verwendung.',
  'customLlm.selectOcrProfile':
    'Wähle ein gespeichertes benutzerdefiniertes OCR-Profil zur Verwendung.',
  'customLlm.profileNotFound':
    'Benutzerdefiniertes Profil nicht gefunden. Neu laden und erneut versuchen.',
  'customLlm.translationProfileActive':
    'Benutzerdefiniertes Profil in Verwendung (Übersetzung): {label}.',
  'customLlm.ocrProfileActive':
    'Benutzerdefiniertes Profil in Verwendung (OCR): {label}.',
  'accountSync.confirmEmailSent':
    'Bestätigungs-E-Mail gesendet. Prüfe deinen Posteingang.',
  'accountSync.confirmEmailFailed':
    'Bestätigungs-E-Mail konnte nicht gesendet werden.',
  'downloadActions.noTranslatorResults':
    'Keine Übersetzer-Ergebnisse zum Herunterladen verfügbar.',
  'enhanceActions.desktopOnly':
    'Der lokale Enhancer ist nur in der Desktop-App verfügbar.',
  'enhanceActions.selectModel': 'Wähle ein kompatibles Verbesserungsmodell.',
  'enhanceActions.done':
    'Verbesserung abgeschlossen. Verwende Download zum Speichern.',
  'freeProvider.stageNotSupported': 'Anbieter unterstützt diese Phase nicht.',
  'freeProvider.activeForTranslation': 'Anbieter {name} für Übersetzung aktiv.',
  'freeProvider.activeForOcr': 'Anbieter {name} für OCR aktiv.',
  'freeProvider.activeForClean':
    'Provider {name} wird für die Bereinigung verwendet.',
  'freeProvider.stageTranslation': 'Übersetzung',
  'freeProvider.stageOcr': 'OCR',
  'freeProvider.stageClean': 'Bereinigung',
  'translatorRetranslate.targetNotFound':
    'Zielbild für erneute Übersetzung nicht gefunden.',
  'translatorRetranslate.noTextAvailable':
    'Kein erkannter Text für erneute Übersetzung verfügbar.',
  'translatorText.done':
    'Text-Übersetzer abgeschlossen. Verwende Kopieren oder TXT herunterladen.',
  'typographer.queueApplied':
    'Warteschlangentext auf die aktuelle Auswahl angewandt.',
  'typographer.queueAppliedMulti':
    'Warteschlangentext auf {{count}} Sprechblase(n) angewandt.',
  'typographer.queueCleared': 'Typesetter-Warteschlange geleert.',
  'typographer.queueImported':
    'Text in die Typesetter-Warteschlange importiert.',
  'aioManual.invalidCleanResponse':
    'Ungültige Antwort beim Bereinigen des Bildes.',
  'aioStage.lang.ko': 'Koreanisch',
  'aioStage.lang.ja': 'Japanisch',
  'aioStage.lang.fr': 'Französisch',
  'aioStage.lang.zh': 'Chinesisch',
  'aioStage.lang.zh-CN': 'Vereinfachtes Chinesisch',
  'aioStage.lang.zh-TW': 'Traditionelles Chinesisch',
  'aioStage.lang.en': 'Englisch',
  'aioStage.lang.ru': 'Russisch',
  'aioStage.lang.de': 'Deutsch',
  'aioStage.lang.nl': 'Niederländisch',
  'aioStage.lang.es': 'Spanisch',
  'aioStage.lang.it': 'Italienisch',
  'aioStage.lang.tr': 'Türkisch',
  'aioStage.lang.pl': 'Polnisch',
  'aioStage.lang.pt': 'Portugiesisch',
  'aioStage.lang.pt-BR': 'Portugiesisch (BR)',
  'aioStage.lang.th': 'Thailändisch',
  'aioStage.lang.vi': 'Vietnamesisch',
  'aioStage.lang.hu': 'Ungarisch',
  'aioStage.lang.id': 'Indonesisch',
  'aioStage.lang.fi': 'Finnisch',
  'aioStage.lang.ar': 'Arabisch',
  'splitter.warning.noIntermediateCuts': 'Keine Zwischenschnitte gefunden.',
  'splitter.warning.segmentTooSmall':
    'Ein Segment ist kleiner als die konfigurierte Mindesthöhe.',
  'splitter.warning.segmentTooLarge':
    'Ein Segment ist größer als die konfigurierte Maximalhöhe.',
  'splitter.warning.cutsNearContent':
    'Einige Schnitte befinden sich in der Nähe von Bereichen mit Inhalt.',
  'splitter.warning.nearEdge': 'Zu nah am Rand.',
  'stitch.warning.dimensionTooHigh':
    'Abmessung zu groß; in mehr Stapeln exportieren, um Fehler zu vermeiden.',
  'stitch.warning.outputTooHeavy':
    'Ausgabe zu groß für Überprüfung und Download.',
  'stitch.warning.canvasLimit':
    'Kann sichere Canvas-Limits in einigen Umgebungen überschreiten.',
  'stitch.warning.largeBatch':
    'Großer Stapel; prüfe, ob die Aufteilung für die Scanlation noch komfortabel ist.',
  'resources.data.fontsTitle': 'Typesetting-Schriften',
  'resources.data.fontsDesc':
    'Kuratierte Sammlung beliebter Schriften für die Scanlation von Manga, Manhwa und Manhua.',
  'resources.data.onomatopoeiaDesc':
    'Bibliothek japanischer Lautmalereien mit Übersetzungen und Anwendungsbeispielen.',
  'resources.data.glossaryTitle': 'Scanlation-Glossar',
  'resources.data.glossaryDesc':
    'Fachbegriffe und Community-Jargon aus der Scanlation-Welt.',
  'resources.data.catalogLabel': 'Katalog',
  'aioLocalBatch.invalidBatchResponse':
    'Ungültige Stapelantwort: batch_report.json fehlt im ZIP.',
  'modelDownload.desktopOnly':
    'Modellverwaltung ist nur in der Desktop-App verfügbar.',
  'settings.updates.channelBeta': 'Beta',
  'settings.updates.channelStable': 'Stabil',
  'settings.presets.aio.defaultName': 'Vorlage',
  'settings.integrations.blogger.term.googleCloudConsole':
    'Google Cloud Console',
  'settings.integrations.blogger.term.bloggerApiV3': 'Blogger API v3',
  'settings.integrations.blogger.term.googleDriveApi': 'Google Drive API',
  'settings.integrations.blogger.term.oauthClientId': 'OAuth-Client-ID',
  'settings.integrations.blogger.term.clientId': 'Client-ID',
  'settings.integrations.blogger.term.clientSecret': 'Client-Secret',
  'settings.integrations.blogger.term.oauthPlayground': 'OAuth Playground',
  'settings.integrations.blogger.term.exchangeCodeForTokens':
    'Code gegen Token tauschen',
  'settings.integrations.blogger.term.refreshToken': 'Refresh-Token',
  'settings.integrations.blogger.term.cloudName': 'Cloud-Name',
  'settings.integrations.blogger.term.blogId': 'Blog-ID',
  'settings.integrations.imgur.term.clientId': 'Client-ID',
  'settings.integrations.imgur.term.rateLimit': '50 Uploads/Stunde',
  'settings.shortcuts.topbarPath': 'Obere Leiste > Tastenkürzel',
  'login.warning.versionPrefix': 'v{version}',
  'password.policy.minLength':
    'Das Passwort muss mindestens 12 Zeichen enthalten.',
  'password.policy.uppercase':
    'Das Passwort muss mindestens einen Großbuchstaben enthalten.',
  'password.policy.lowercase':
    'Das Passwort muss mindestens einen Kleinbuchstaben enthalten.',
  'password.policy.number': 'Das Passwort muss mindestens eine Zahl enthalten.',
  'password.policy.special':
    'Das Passwort muss mindestens ein Sonderzeichen enthalten.',
  'auth.sfx.primary': '쾅',
  'auth.sfx.secondary': '휙',
  'auth.stats.activeScanlatorsValue': '2.4k+',
  'auth.stats.toolsValue': '50+',
  'auth.stats.pagesProcessedValue': '1M+',
  'auth.community.joinIndicator': '+',
  'resources.sfx.onomatopoeiaLabel': 'Lautmalerei',
  'resources.page.shortcutCtrl': 'Strg',
  'resources.page.shortcutFind': 'F',
  'settings.integrations.blogger.value.requestsPerDay': '10.000',
  'settings.integrations.blogger.value.requestsPerUser': '100/100s',
  'settings.integrations.imgur.authorizationHeaderExample':
    'Authorization: Client-ID …',
  'settings.shortcuts.quickKey': 'H',
  'guides.search.keyArrowUp': '↑',
  'guides.search.keyArrowDown': '↓',
  'guides.search.keyArrowPair': '↑↓',
  'guides.search.keyEnter': '⏎',
  'guides.search.keyEscape': 'Esc',
  'settings.typographerLibrary.presetsCount_one': '{count} Vorlage',
  'settings.typographerLibrary.presetsCount_other': '{count} Vorlagen',
  'renderPreview.iconUppercase': 'AA',
  'renderPreview.iconHorizontal': 'H',
  'renderPreview.iconVertical': 'V',
  'renderPreview.iconCircular': '◯',
  'guides.home.searchShortcut': '⌘K',
  'brand.name': 'KŌMA',
  'brand.studioSuffix': 'Studio',
  'versionBadge.stable': 'STABIL',
  'versionBadge.beta': 'BETA',
  'versionBadge.tooltip': 'Version {version}',
  'settings.typography.iconBold': 'F',
  'settings.typography.iconItalic': 'K',
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
  'update.units.perSecond': '/s',
  'update.versionPrefix': 'v{version}',
  'update.toast.newVersionFallback': 'neu',
  'dashboard.status.cloudSuffix': '(Cloud)',
  'dashboard.status.cloudApiSuffix': '(Cloud/API/KI)',
  'dashboard.status.pendingCustomTranslationName':
    'Benutzerdefinierte KI (wird synchronisiert...)',
  'dashboard.status.pendingCustomOcrName':
    'Benutzerdefiniertes OCR (wird synchronisiert...)',
  'modelManager.tooltip.gpu': 'GPU',
  'modelManager.tooltip.vram': 'VRAM',
  'modelManager.tooltip.ram': 'RAM',
  'dashboard.tour.preview.welcome.upload': 'Hochladen',
  'dashboard.tour.preview.welcome.export': 'Exportieren',
  'dashboard.tour.preview.upload.formats':
    'JPG · PNG · WEBP · ZIP · PDF · CBZ · CB7 · PSD',
  'dashboard.tour.preview.stageEmpty': 'Bilder laden, um loszulegen',
  'dashboard.tour.welcome.title': 'Willkommen im KŌMA Studio Dashboard',
  'dashboard.tour.welcome.body':
    'Diese Tour führt dich durch den Hauptablauf der App: Seiten organisieren, Modi wählen, die AIO-Pipeline konfigurieren und Ergebnisse exportieren, ohne raten zu müssen, wo welche Funktion ist.',
  'dashboard.tour.sidebar.title':
    'Seitenleiste: Kontingent, Dateien und Stapelkontext',
  'dashboard.tour.sidebar.body':
    'Hier verfolgst du deinen Tarif und die monatliche Nutzung, wählst das aktive Bild, ordnest Seiten neu, entfernst Elemente und hältst den Stapel vor der Verarbeitung organisiert.',
  'dashboard.tour.upload.title': 'Erster Dateieingang',
  'dashboard.tour.upload.body':
    'Die Drop-Zone akzeptiert einzelne Bilder und vollständige Pakete. Sie ist der Ausgangspunkt zum Ziehen von Kapiteln, Raws oder Assets für den Rest des Dashboards.',
  'dashboard.tour.modes.title': 'Hauptnavigation des Dashboards',
  'dashboard.tour.modes.body':
    'Verwende Organisieren, um den Stapel vorzubereiten, und AIO für die vollständige Pipeline. Die anderen Gruppen in der oberen Leiste öffnen spezialisierte Modi, ohne den Arbeitsbereich zu verlassen.',
  'dashboard.tour.production.title': 'Produktion: spezialisierte Werkzeuge',
  'dashboard.tour.production.body':
    'Cleaner, Typesetter, Übersetzer, Raw und QC decken den manuellen und erweiterten Workflow ab. Betrachte diese Gruppe als die professionellen Modi für die Arbeit an einer bestimmten Kapitelphase.',
  'dashboard.tour.utils.title': 'Hilfsmittel und Support',
  'dashboard.tour.utils.body':
    'Zusammenfügen, Teilen, Wasserzeichen und Verbessern übernehmen schnelle Vorbereitungs- und Exportaufgaben. Anleitungen und Ressourcen vervollständigen den Supportbereich als Referenz.',
  'dashboard.tour.submode.title': 'Auto-AIO vs. manuell',
  'dashboard.tour.submode.body':
    'Auto führt die vollständige Pipeline im Stapel aus. Manuell schaltet jede Phase pro Bild für feine Überprüfung, Zurück/Vorwärts und kontrollierte visuelle Bearbeitung frei.',
  'dashboard.tour.pipeline.title': 'AIO-Pipeline',
  'dashboard.tour.pipeline.body':
    'Diese Karte steuert die Erkennen > OCR > Übersetzen > Segmentieren > Bereinigen > Rendern-Sequenz. Du kannst Phasen aktivieren oder deaktivieren und im manuellen Modus nur die aktuelle Phase ausführen.',
  'dashboard.tour.stageConfig.title': 'Phasenkonfiguration',
  'dashboard.tour.stageConfig.body':
    'Hier findest du Sprachen, AIO-Vorlagen, lokale/Cloud-Kataloge und die Modellauswahl pro Phase. Es ist das Entscheidungszentrum zur Anpassung von Kosten, Qualität und Geschwindigkeit.',
  'dashboard.tour.stage.withImagesTitle':
    'Arbeitsbereich und visuelle Vorschau',
  'dashboard.tour.stage.withImagesBody':
    'Mit Bildern wird diese Ansicht zur Hauptvorschau: Du navigierst Seiten, siehst Ergebnisse pro Phase und arbeitest direkt am aktiven Bild.',
  'dashboard.tour.stage.emptyTitle': 'Dashboard-Zentrum',
  'dashboard.tour.stage.emptyBody':
    'Ohne Bilder zeigt die Ansicht einen einfachen leeren Zustand. Nach dem Hochladen werden Vorschauen, Overlays, Bereiche und Ergebnisse pro Modus angezeigt.',
  'dashboard.tour.manualDock.title': 'Interaktive Vorschau und manuelles Dock',
  'dashboard.tour.manualDock.body':
    'Mit einem aktiven Bild im manuellen AIO schaltet das schwebende Dock Bereichsauswahl, Pinsel, Radierer, Zauberstab, Reparatur und kontextbezogene Anpassungen frei, ohne die Vorschau zu verlassen.',
  'dashboard.tour.download.title': 'Export und Downloads',
  'dashboard.tour.download.body':
    'Wenn die App fertige Ausgaben hat, sammelt dieses Menü Bildformate, Pakete, PSD-Dateien mit Ebenen und Metadatenoptionen, um den Lieferworkflow abzuschließen.',
  'dashboard.tour.replay.title':
    'Wenn du die Tour später erneut abspielen möchtest',
  'dashboard.tour.replay.body':
    'Öffne das Benutzermenü und verwende <strong>Tour erneut abspielen</strong>. Das automatische Onboarding läuft nur beim ersten Besuch der aktuellen Version, aber die manuelle Wiederholung ist jederzeit verfügbar.',
  'dashboard.tour.progressText': 'Schritt {{current}} von {{total}}',
  'dashboard.tour.next': 'Weiter',
  'dashboard.tour.prev': 'Zurück',
  'dashboard.tour.done': 'Tour abschließen',
  'dashboard.tour.dialogLabel': 'Dashboard-Tour',
  'dashboard.tour.close': 'Tour schließen',
  'dashboard.tour.nextAria': 'Zum nächsten Schritt',
  'dashboard.tour.prevAria': 'Zum vorherigen Schritt zurück',
  'modelManager.tooltip.rich.highlights': 'Highlights',
  'modelManager.tooltip.rich.unique': 'Besonderheit',
  'modelManager.tooltip.rich.bestFor': 'Ideal für',
  'modelManager.tooltip.rich.performance': 'Leistung',
  'modelManager.tooltip.rich.notes': 'Hinweise',
  'modelManager.tooltip.docsUrl': 'Dokumentation anzeigen',
  'modelManager.tooltip.notes': 'Hinweise',
  'modelManager.tooltip.highlights': 'Highlights',
  'modelManager.tooltip.bestFor': 'Ideal für',
  'modelManager.tooltip.unique': 'Besonderheit',
  'modelManager.tooltip.performance': 'Leistung',

  'model.tooltip.opus-mt-ja-en.highlights':
    'Übersetzt Japanisch nach Englisch\nLeicht und schnell, läuft gut ohne Grafikkarte\nGuter Einstieg',
  'model.tooltip.opus-mt-ja-en.unique':
    'Funktioniert gut für allgemeine japanische Texte, wurde aber nicht speziell für Manga entwickelt',
  'model.tooltip.opus-mt-ja-en.bestFor':
    'Schnelle Übersetzungen von Japanisch nach Englisch, wenn keine leistungsstarke Grafikkarte vorhanden ist',
  'model.tooltip.opus-mt-ja-en.performance':
    'Sehr schnell, läuft auf jedem Computer ohne Grafikkarte',
  'model.tooltip.opus-mt-ja-en.notes':
    'Gute allgemeine Option, aber für Manga und Anime liefert Sugoi bessere Ergebnisse',

  'model.tooltip.nllb-200-600m-int8.highlights':
    'Übersetzt zwischen fast 200 Sprachen\nLeichte und optimierte Version\nLäuft gut auf jedem Computer',
  'model.tooltip.nllb-200-600m-int8.unique':
    'Ein einzelnes Modell, das zwischen Hunderten von Sprachen übersetzt — ideal wenn Vielseitigkeit gefragt ist',
  'model.tooltip.nllb-200-600m-int8.bestFor':
    'Übersetzen zwischen selteneren Sprachen oder wenn ein Allround-Modell benötigt wird',
  'model.tooltip.nllb-200-600m-int8.performance':
    'Schnell und leicht, läuft gut auch auf Computern ohne Grafikkarte',
  'model.tooltip.nllb-200-600m-int8.notes':
    'Nicht für Manga gemacht, funktioniert aber als allgemeiner Übersetzer für viele Sprachen',

  'model.tooltip.opus-mt-zh-en.highlights':
    'Übersetzt Chinesisch nach Englisch\nLeicht und schnell\nLäuft ohne Grafikkarte',
  'model.tooltip.opus-mt-zh-en.unique':
    'Fokussiert auf Chinesisch → Englisch, gut für Manhua und allgemeine chinesische Inhalte',
  'model.tooltip.opus-mt-zh-en.bestFor':
    'Schnelles Übersetzen von Manhua und chinesischen Inhalten ins Englische',
  'model.tooltip.opus-mt-zh-en.performance':
    'Sehr schnell, läuft auf jedem Computer ohne Grafikkarte',
  'model.tooltip.opus-mt-zh-en.notes':
    'Beliebt und zuverlässig für Übersetzungen Chinesisch → Englisch',

  'model.tooltip.nllb-200-1.3b.highlights':
    'Übersetzt zwischen fast 200 Sprachen\nBessere Qualität als die leichte Version\nGut für seltenere Sprachen',
  'model.tooltip.nllb-200-1.3b.unique':
    'Mittlere Version mit besserer Qualität als die 600M, aber nicht so schwer wie die 3.3B',
  'model.tooltip.nllb-200-1.3b.bestFor':
    'Wenn bessere Qualität als die leichte Version benötigt wird, besonders für seltene Sprachen',
  'model.tooltip.nllb-200-1.3b.performance':
    'Benötigt eine Grafikkarte mit mindestens 4 GB Speicher; akzeptable Geschwindigkeit',
  'model.tooltip.nllb-200-1.3b.notes':
    'Gute Balance zwischen Qualität und Größe. Nicht für Manga gemacht.',

  'model.tooltip.nllb-200-1.3b-int8-ct2.highlights':
    'Übersetzt zwischen fast 200 Sprachen\nOptimierte Version mit weniger Speicherverbrauch\nGute Qualität bei geringerem Verbrauch',
  'model.tooltip.nllb-200-1.3b-int8-ct2.unique':
    'Gleiche Qualität wie die 1.3B-Version, aber mit weniger Speicherverbrauch — bestes Preis-Leistungs-Verhältnis',
  'model.tooltip.nllb-200-1.3b-int8-ct2.bestFor':
    'Mehrsprachige Übersetzung in guter Qualität ohne einen sehr leistungsstarken Computer',
  'model.tooltip.nllb-200-1.3b-int8-ct2.performance':
    'Läuft bei Bedarf auf der CPU; leichter als die normale 1.3B-Version',
  'model.tooltip.nllb-200-1.3b-int8-ct2.notes':
    'Optimierte Version von NLLB 1.3B — verwende diese, um Speicher zu sparen',

  'model.tooltip.nllb-200-3.3b.highlights':
    'Beste Qualität unter den mehrsprachigen Übersetzern\nFast 200 Sprachen\nIdeal wenn Qualität wichtiger ist als Geschwindigkeit',
  'model.tooltip.nllb-200-3.3b.unique':
    'Die leistungsstärkste und genaueste Version der mehrsprachigen Familie — beste verfügbare Übersetzung für seltene Sprachen',
  'model.tooltip.nllb-200-3.3b.bestFor':
    'Wenn die Übersetzungsqualität wichtiger ist als die Geschwindigkeit',
  'model.tooltip.nllb-200-3.3b.performance':
    'Benötigt eine gute Grafikkarte mit mindestens 8 GB Speicher; langsamer als die anderen',
  'model.tooltip.nllb-200-3.3b.notes':
    'Schwerer, aber mit besserer Qualität. Nicht für Manga gemacht.',

  'model.tooltip.sugoi_v4_ja_en_ct2.highlights':
    'Übersetzt Japanisch nach Englisch\nSpeziell für Manga und Anime entwickelt\nFunktioniert auf jedem Computer',
  'model.tooltip.sugoi_v4_ja_en_ct2.unique':
    'Versteht Slang, Umgangssprache und typische Manga- und Anime-Ausdrücke besser als andere Übersetzer',
  'model.tooltip.sugoi_v4_ja_en_ct2.bestFor':
    'Manga und Anime von Japanisch nach Englisch übersetzen — die von der Community meistempfohlene Wahl',
  'model.tooltip.sugoi_v4_ja_en_ct2.performance':
    'Sehr schnell, funktioniert gut auch ohne dedizierte Grafikkarte',
  'model.tooltip.sugoi_v4_ja_en_ct2.notes':
    'Verwende dieses Modell als Standard für Übersetzungen Japanisch → Englisch',

  'model.tooltip.m2m100_1_2b_ct2.highlights':
    'Übersetzt zwischen 100 Sprachen\nDeckt Koreanisch, Thailändisch, Vietnamesisch und mehr ab\nOptimierte Version für schnellere Ausführung',
  'model.tooltip.m2m100_1_2b_ct2.unique':
    'Eines der wenigen Modelle, das gut zwischen asiatischen Sprachen wie Koreanisch, Thailändisch und Vietnamesisch ins Englische übersetzt',
  'model.tooltip.m2m100_1_2b_ct2.bestFor':
    'Koreanische Manhwa, chinesische Manhua und Inhalte in anderen asiatischen Sprachen ins Englische übersetzen',
  'model.tooltip.m2m100_1_2b_ct2.performance':
    'Benötigt eine Grafikkarte mit 4–6 GB Speicher; gute Geschwindigkeit mit der optimierten Version',
  'model.tooltip.m2m100_1_2b_ct2.notes':
    'Gute Option für asiatische Sprachen, die andere Übersetzer nicht gut abdecken',

  'model.tooltip.vntl_llama3_8b_v2.highlights':
    'Übersetzt Japanisch nach Englisch\nEntwickelt für Visual Novels und Manga\nHält Charakternamen konsistent',
  'model.tooltip.vntl_llama3_8b_v2.unique':
    'Versteht den Kontext der Geschichte und hält Charakternamen und Begriffe im gesamten Text konsistent',
  'model.tooltip.vntl_llama3_8b_v2.bestFor':
    'Visual Novels und Manga mit langen Dialogen übersetzen, wo Namenskonsistenz wichtig ist',
  'model.tooltip.vntl_llama3_8b_v2.performance':
    'Benötigt eine gute Grafikkarte mit 6–10 GB Speicher; langsamer als einfache Übersetzer',
  'model.tooltip.vntl_llama3_8b_v2.notes':
    'Ideal für lange Projekte, bei denen Konsistenz von Namen und Begriffen wichtig ist',

  'model.tooltip.lfm2_350m_enjp_mt.highlights':
    'Übersetzt Japanisch ↔ Englisch in beide Richtungen\nUltra-leicht und schnell\nLäuft auf jedem Computer',
  'model.tooltip.lfm2_350m_enjp_mt.unique':
    'Einer der kleinsten verfügbaren Übersetzer — funktioniert selbst auf schwachen Computern und liefert dennoch brauchbare Ergebnisse',
  'model.tooltip.lfm2_350m_enjp_mt.bestFor':
    'Wenn eine schnelle Japanisch-Englisch-Übersetzung benötigt wird und keine leistungsstarke Grafikkarte vorhanden ist',
  'model.tooltip.lfm2_350m_enjp_mt.performance':
    'Extrem schnell, läuft auf jedem Computer auch ohne Grafikkarte',
  'model.tooltip.lfm2_350m_enjp_mt.notes':
    'Grundlegende Qualität — gut für schnelle Entwürfe, aber nicht für das Endergebnis',

  'model.tooltip.sakura_galtransl_7b_v3_7.highlights':
    'Übersetzt Japanisch nach Chinesisch\nDas beste für Galgames und Manga\nBehält Formatierung und spezielle Anmerkungen bei',
  'model.tooltip.sakura_galtransl_7b_v3_7.unique':
    'Bewahrt spezielle Formatierung, Leseanmerkungen und Zeilenumbrüche — unverzichtbar für Galgames und Manga mit komplexem Text',
  'model.tooltip.sakura_galtransl_7b_v3_7.bestFor':
    'Die beste Option für Übersetzungen Japanisch nach Chinesisch, wenn Qualität wichtiger ist als Geschwindigkeit',
  'model.tooltip.sakura_galtransl_7b_v3_7.performance':
    'Benötigt eine Grafikkarte mit mindestens 6 GB Speicher; moderate Geschwindigkeit',
  'model.tooltip.sakura_galtransl_7b_v3_7.notes':
    'Beste verfügbare Übersetzung JP→ZH. Verwende es, wenn Qualität Priorität hat.',

  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.highlights':
    'Übersetzt Japanisch nach Chinesisch\nLeichte und schnelle Version\nGut für schwächere Computer',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.unique':
    'Gleiche Familie wie das größere Sakura, aber optimiert für Computer mit weniger Speicher',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.bestFor':
    'Japanisch nach Chinesisch übersetzen, wenn keine leistungsstarke Grafikkarte vorhanden ist',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.performance':
    'Schnell, benötigt nur 1–2 GB Grafikspeicher',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.notes':
    'Gute Qualität für die Größe — ideal, wenn das größere Modell zu schwer ist',

  'model.tooltip.hunyuan_7b_mt_v1_0.highlights':
    'Übersetzt zwischen 36 Sprachen\nHohe, in Wettbewerben ausgezeichnete Qualität\nEin starkes Modell für viele Sprachen',
  'model.tooltip.hunyuan_7b_mt_v1_0.unique':
    'Einer der meistausgezeichneten Übersetzer der Welt — kombiniert mehrere Übersetzungen für das bestmögliche Ergebnis',
  'model.tooltip.hunyuan_7b_mt_v1_0.bestFor':
    'Wenn hochwertige Übersetzungen zwischen vielen verschiedenen Sprachen benötigt werden',
  'model.tooltip.hunyuan_7b_mt_v1_0.performance':
    'Benötigt eine Grafikkarte mit 6–8 GB Speicher; moderate Geschwindigkeit',
  'model.tooltip.hunyuan_7b_mt_v1_0.notes':
    'Hervorragend für mehrsprachige Projekte, bei denen Qualität Priorität hat',

  'model.tooltip.font_rtdetr_v2.highlights':
    'Erkennt Sprechblasen und Text in Comics\nIdentifiziert Text innerhalb und außerhalb von Sprechblasen\nAlles in einem einzigen Durchlauf',
  'model.tooltip.font_rtdetr_v2.unique':
    'Das einzige Modell, das Sprechblasen, Text in Sprechblasen und freien Text auf der Seite gleichzeitig erkennt',
  'model.tooltip.font_rtdetr_v2.bestFor':
    'Vollständige Analyse von Comic-Seiten — trennt Dialoge automatisch von freiem Text',
  'model.tooltip.font_rtdetr_v2.performance':
    'Leicht und schnell, läuft gut auf den meisten Computern',
  'model.tooltip.font_rtdetr_v2.notes':
    'Trainiert mit Manga, Webtoon, Manhua und westlichen Comics',

  'model.tooltip.comic_text_detector.highlights':
    'Erkennt Text in Comics und Manga\nOriginales und zuverlässiges Modell\nLäuft schnell auf jedem Computer',
  'model.tooltip.comic_text_detector.unique':
    'Der klassische Detektor, der als Basis für viele Manga-Übersetzungsprojekte dient',
  'model.tooltip.comic_text_detector.bestFor':
    'Grundlegende und zuverlässige Texterkennung in Comics — gute Standardwahl',
  'model.tooltip.comic_text_detector.performance':
    'Schnell, läuft gut ohne dedizierte Grafikkarte',
  'model.tooltip.comic_text_detector.notes':
    'Klassisches, von der Community über Jahre getestetes Modell',

  'model.tooltip.pp_doclayout_v3.highlights':
    'Analysiert das Layout gescannter Seiten\nFunktioniert auch bei schiefen oder gewölbten Seiten\nErkennt die korrekte Lesereihenfolge',
  'model.tooltip.pp_doclayout_v3.unique':
    'Kann schief fotografierte oder ungleichmäßig gescannte Seiten verstehen — etwas, das andere Modelle nicht können',
  'model.tooltip.pp_doclayout_v3.bestFor':
    'Unvollkommen gescannte Seiten, Buchfotos oder komplexe Layouts mit schwieriger Lesereihenfolge',
  'model.tooltip.pp_doclayout_v3.performance':
    'Robust und zuverlässig, funktioniert gut bei verschiedenen Lichtverhältnissen',
  'model.tooltip.pp_doclayout_v3.notes':
    'Nützlich, wenn Seiten nicht perfekt digitalisiert sind',

  'model.tooltip.manga_ocr.highlights':
    'Liest japanischen Text in Manga\nFunktioniert mit vertikalem und horizontalem Text\nDie meistempfohlene Wahl für japanischen Manga',
  'model.tooltip.manga_ocr.unique':
    'Speziell entwickelt für die Herausforderungen von Manga: vertikaler Text, Furigana, stilisierte Schriften und Bilder in niedriger Qualität',
  'model.tooltip.manga_ocr.bestFor':
    'Die Standardwahl zum Lesen von japanischem Manga-Text — funktioniert sofort ohne Anpassungen',
  'model.tooltip.manga_ocr.performance':
    'Beliebt und zuverlässig, wird von vielen Scanlation-Projekten verwendet',
  'model.tooltip.manga_ocr.notes':
    'Beste Option für japanischen Manga. Wenn Geschwindigkeit gefragt ist, Meiki OCR in Betracht ziehen.',

  'model.tooltip.meiki_ocr.highlights':
    'Ultra-schneller japanischer Textleser\nErkennt jedes Zeichen einzeln\nIdeal für horizontalen Text',
  'model.tooltip.meiki_ocr.unique':
    'Viel schneller als andere japanische Textleser — perfekt wenn Geschwindigkeit Priorität hat',
  'model.tooltip.meiki_ocr.bestFor':
    'Wenn japanischer horizontaler Text schnell gelesen werden muss',
  'model.tooltip.meiki_ocr.performance':
    'Extrem schnell, einer der schnellsten für Japanisch',
  'model.tooltip.meiki_ocr.notes':
    'Funktioniert nur mit horizontalem Text — für vertikalen Text Manga OCR verwenden',

  'model.tooltip.paddleocr_vl_manga.highlights':
    'Für Manga optimierter Textleser\nFunktioniert mit vertikalem und horizontalem Text\nDeutlich genauer bei Manga als das Basismodell',
  'model.tooltip.paddleocr_vl_manga.unique':
    'Speziell mit Manga-Seiten trainiert — versteht stilisierte Schriften und Sprechblasen besser als generische Leser',
  'model.tooltip.paddleocr_vl_manga.bestFor':
    'Manga-Text mit hoher Genauigkeit lesen, besonders bei schwierigen Schriftarten',
  'model.tooltip.paddleocr_vl_manga.performance':
    'Gute Genauigkeit bei Manga; funktioniert auch mit anderen Sprachen',
  'model.tooltip.paddleocr_vl_manga.notes':
    'Spezialisierte Version von PaddleOCR für Manga — ausgezeichnete Wahl für Scanlation',

  'model.tooltip.got_ocr2.highlights':
    'Liest Text aus Dokumenten, Tabellen und Diagrammen\nVersteht mathematische Formeln und Partituren\nVielseitig für verschiedene Dokumenttypen',
  'model.tooltip.got_ocr2.unique':
    'Geht über einfachen Text hinaus — kann Tabellen, Formeln und formatierte Diagramme lesen',
  'model.tooltip.got_ocr2.bestFor':
    'Komplexe Dokumente mit Tabellen und Formatierung lesen — nicht ideal für Manga',
  'model.tooltip.got_ocr2.performance':
    'Leicht und vielseitig, funktioniert gut für Dokumente im Allgemeinen',
  'model.tooltip.got_ocr2.notes':
    'Mehrsprachig, aber nicht für Manga optimiert — für Comics andere Modelle verwenden',

  'model.tooltip.qwen2_5_vl_3b.highlights':
    'Versteht Bilder intelligent\nGeht über Textlesen hinaus — erfasst den Bildinhalt\nMehrsprachig und vielseitig',
  'model.tooltip.qwen2_5_vl_3b.unique':
    'Liest nicht nur Text — versteht Manga-Panels, beschreibt Szenen und extrahiert strukturierte Informationen aus dem Bild',
  'model.tooltip.qwen2_5_vl_3b.bestFor':
    'Wenn das Modell den Bildinhalt verstehen soll, nicht nur den Text lesen',
  'model.tooltip.qwen2_5_vl_3b.performance':
    'Mittlere Größe; gute Geschwindigkeit auf gängigen Grafikkarten',
  'model.tooltip.qwen2_5_vl_3b.notes':
    'Mehrsprachig. Nützlich für Panel-Analyse und fortgeschrittenes visuelles Verständnis',

  'model.tooltip.mangalmm.highlights':
    'Versteht Manga-Panels wie ein menschlicher Leser\nErkennt Charaktere und Handlungselemente\nGeht über reines Textlesen hinaus',
  'model.tooltip.mangalmm.unique':
    'Das einzige Modell, das speziell für das Verstehen von Manga entwickelt wurde — erkennt Charaktere, Panels und visuelle Erzählung',
  'model.tooltip.mangalmm.bestFor':
    'Fortgeschrittene Manga-Analyse: verstehen wer spricht und was in den Panels passiert',
  'model.tooltip.mangalmm.performance':
    'Benötigt eine leistungsstarke Grafikkarte mit 14 GB Speicher; noch in der Forschungsphase',
  'model.tooltip.mangalmm.notes':
    'Experimentelles Modell — vielversprechend für die Zukunft der Scanlation, aber noch nicht ausgereift',

  'model.tooltip.rolmocr.highlights':
    'Schneller Textleser für Dokumente\nFunktioniert gut mit komplexen Layouts\nLeichtere und schnellere Alternative',
  'model.tooltip.rolmocr.unique':
    'Schneller und leichter als ähnliche Modelle bei guter Lesequalität für Dokumente',
  'model.tooltip.rolmocr.bestFor':
    'Dokumente mit komplexen Layouts lesen, wenn Geschwindigkeit wichtig ist',
  'model.tooltip.rolmocr.performance':
    'Schnell und effizient; gute Balance zwischen Geschwindigkeit und Qualität',
  'model.tooltip.rolmocr.notes':
    'Nicht speziell für Manga — besser für Dokumente und allgemeine Texte',

  'model.tooltip.glm_ocr_onnx.highlights':
    'Kompakter und präziser Textleser\nEiner der genauesten in Benchmarks\nLäuft gut auf schwächeren Computern',
  'model.tooltip.glm_ocr_onnx.unique':
    'Vereint hohe Genauigkeit mit kleiner Größe — einer der genauesten trotz geringem Gewicht',
  'model.tooltip.glm_ocr_onnx.bestFor':
    'Dokumente mit hoher Genauigkeit lesen ohne einen leistungsstarken Computer zu benötigen',
  'model.tooltip.glm_ocr_onnx.performance':
    'Sehr leicht und schnell; läuft gut auch auf Computern ohne starke Grafikkarte',
  'model.tooltip.glm_ocr_onnx.notes':
    'Unterstützt mehrere Sprachen, aber Japanisch ist eingeschränkt. Hervorragend für Dokumente im Allgemeinen.',

  'model.tooltip.paddleocr.highlights':
    'Liest russischen Text\nSchnell und zuverlässig\nGute Option für russische Manhwa',
  'model.tooltip.paddleocr.unique':
    'Speziell für das kyrillische Alphabet optimiert — besser als generische Leser für Russisch',
  'model.tooltip.paddleocr.bestFor':
    'Russischen Text in Comics und Manga lesen',
  'model.tooltip.paddleocr.performance':
    'Sehr schnell, läuft gut auf den meisten Computern',
  'model.tooltip.paddleocr.notes': 'Die beste Wahl für russischen Text',

  'model.tooltip.paddleocr_latin_v5.highlights':
    'Liest Text in europäischen Sprachen\nFranzösisch, Deutsch, Spanisch, Portugiesisch und mehr\nSchnell und zuverlässig',
  'model.tooltip.paddleocr_latin_v5.unique':
    'Für europäische Alphabete optimiert — funktioniert besser als generische Leser in diesen Sprachen',
  'model.tooltip.paddleocr_latin_v5.bestFor':
    'Text in europäischen Sprachen wie Französisch, Deutsch, Spanisch, Italienisch und Portugiesisch lesen',
  'model.tooltip.paddleocr_latin_v5.performance':
    'Schnell und leicht, läuft gut auf jedem Computer',
  'model.tooltip.paddleocr_latin_v5.notes':
    'Beste Option für europäische Sprachen mit lateinischem Alphabet',

  'model.tooltip.paddleocr_ch_v5.highlights':
    'Liest vereinfachten und traditionellen chinesischen Text\nSchnell und präzise\nIdeal für Manhua',
  'model.tooltip.paddleocr_ch_v5.unique':
    'Speziell für chinesische Schriftzeichen optimiert — erkennt komplexe Striche und verschiedene Schriftarten besser',
  'model.tooltip.paddleocr_ch_v5.bestFor':
    'Manhua-Text und alle chinesischen Inhalte mit hoher Genauigkeit lesen',
  'model.tooltip.paddleocr_ch_v5.performance':
    'Schnell und leicht, läuft gut auf den meisten Computern',
  'model.tooltip.paddleocr_ch_v5.notes':
    'Die beste Wahl für Chinesisch. Einfach und effizient.',

  'model.tooltip.paddleocr_en_v5.highlights':
    'Liest englischen Text\nSchnell und präzise\nIdeal für westliche Comics',
  'model.tooltip.paddleocr_en_v5.unique':
    'Speziell für Englisch optimiert — erkennt verschiedene Schriften und Stile besser',
  'model.tooltip.paddleocr_en_v5.bestFor':
    'Englischen Text aus westlichen Comics und übersetztem Manga lesen',
  'model.tooltip.paddleocr_en_v5.performance':
    'Sehr schnell und leicht, läuft auf jedem Computer',
  'model.tooltip.paddleocr_en_v5.notes': 'Die beste Wahl für englischen Text',

  'model.tooltip.easyocr.highlights':
    'Liest Text in über 80 Sprachen\nEinfach zu bedienen und vielseitig\nMehrere Sprachen im selben Bild',
  'model.tooltip.easyocr.unique':
    'Einer der vielseitigsten — kann viele verschiedene Sprachen im selben Bild lesen',
  'model.tooltip.easyocr.bestFor':
    'Wenn ein Leser benötigt wird, der für viele Sprachen funktioniert, ohne das Modell zu wechseln',
  'model.tooltip.easyocr.performance':
    'Gut für sauberen Text; Schwierigkeiten mit stilisierten Schriften und vertikalem Text',
  'model.tooltip.easyocr.notes':
    'Nicht für Manga optimiert. Nützlich als allgemeine mehrsprachige Option.',

  'model.tooltip.pororo.highlights':
    'Liest koreanischen Text\nIdeal für koreanische Manhwa\nLeicht und zuverlässig',
  'model.tooltip.pororo.unique':
    'Speziell für das koreanische Alphabet (Hangul) entwickelt — erkennt besser als generische Leser',
  'model.tooltip.pororo.bestFor':
    'Koreanischen Manhwa-Text lesen — die beste dedizierte Option für Koreanisch',
  'model.tooltip.pororo.performance':
    'Gute Genauigkeit für Koreanisch; leicht und schnell',
  'model.tooltip.pororo.notes':
    'Nur Koreanisch und Englisch. Von der Community gepflegt.',

  'model.tooltip.paddleocr_vl_1_5.highlights':
    'Fortgeschrittener mehrsprachiger Textleser\nEiner der genauesten der Welt\nFunktioniert mit Japanisch, Chinesisch, Englisch und mehr',
  'model.tooltip.paddleocr_vl_1_5.unique':
    'Kann Text in unregelmäßigen und polygonalen Formen erkennen — liest gekrümmten, geneigten und schwer positionierten Text',
  'model.tooltip.paddleocr_vl_1_5.bestFor':
    'Fortgeschrittene Texterkennung für Dokumente und Comics in mehreren Sprachen',
  'model.tooltip.paddleocr_vl_1_5.performance':
    'Präzise und vielseitig; läuft gut auf gängigen Grafikkarten',
  'model.tooltip.paddleocr_vl_1_5.notes':
    'Mehrsprachig einschließlich Japanisch, Chinesisch, Englisch. Basis für das Manga-Fine-Tuning.',

  'model.tooltip.aot.highlights':
    'Entfernt japanischen Text aus Manga\nRekonstruiert die Hintergrundkunst automatisch\nSchnell und effizient',
  'model.tooltip.aot.unique':
    'Speziell für das Entfernen von Text aus Manga entwickelt — versteht den Kunststil und rekonstruiert den Hintergrund natürlich',
  'model.tooltip.aot.bestFor':
    'Japanischen Text aus Manga-Panels entfernen und die Hintergrundkunst rekonstruieren',
  'model.tooltip.aot.performance':
    'Schnell, funktioniert gut mit oder ohne Grafikkarte',
  'model.tooltip.aot.notes': 'Gute Standardoption für Textbereinigung in Manga',

  'model.tooltip.lama_manga.highlights':
    'Entfernt Text aus Manga und Anime\nFunktioniert mit Bildern jeder Größe\nKommt gut mit großen Textbereichen zurecht',
  'model.tooltip.lama_manga.unique':
    'Keine Bildgrößenbeschränkung — funktioniert mit Seiten jeder Auflösung, im Gegensatz zu anderen Modellen',
  'model.tooltip.lama_manga.bestFor':
    'Text von Manga-Seiten jeder Größe entfernen, besonders bei großen Textblöcken und Sprechblasen',
  'model.tooltip.lama_manga.performance':
    'Akzeptiert jede Bildgröße; gute Geschwindigkeit auf den meisten Computern',
  'model.tooltip.lama_manga.notes':
    'Verbesserte Version von LaMa — verwende es bei großen Seiten oder viel zu entfernendem Text',

  'model.tooltip.opencv_lama.highlights':
    'Entfernt Text aus Bildern\nLeichte und einfache Version\nGut für allgemeinen Gebrauch',
  'model.tooltip.opencv_lama.unique':
    'Offizielle, von OpenCV gepflegte Version — direkte und zuverlässige Integration',
  'model.tooltip.opencv_lama.bestFor':
    'Einfache und schnelle Textentfernung, wenn maximale Qualität nicht benötigt wird',
  'model.tooltip.opencv_lama.performance':
    'Leicht und schnell, läuft auf jedem Computer',
  'model.tooltip.opencv_lama.notes':
    'Gute leichte Option für einfache Textbereinigung',

  'model.tooltip.lama_fp32.highlights':
    'Entfernt Text aus Bildern in hoher Qualität\nBeste Qualität unter den Text-Entfernern\nIdeal wenn Qualität wichtiger ist als Geschwindigkeit',
  'model.tooltip.lama_fp32.unique':
    'Die genaueste und originalgetreueste Version von LaMa — rekonstruiert den Hintergrund natürlicher als die leichten Versionen',
  'model.tooltip.lama_fp32.bestFor':
    'Wenn die Bereinigungsqualität wichtiger ist als die Geschwindigkeit',
  'model.tooltip.lama_fp32.performance':
    'Langsamer als die leichten Versionen; benötigt mehr Speicher',
  'model.tooltip.lama_fp32.notes':
    'Verwende es, wenn Qualität Priorität hat. Feste Eingabegröße.',

  'model.tooltip.waifu2x_swin_unet_art_scan_2x.highlights':
    'Verbessert Anime-Scans um 2x\nEntfernt Rauschen und verbessert die Qualität\nIdeal für Manga-Scans',
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.unique':
    'Der Klassiker zum Verbessern von Anime- und Manga-Scans — entfernt Rauschen und verbessert das Bild gleichzeitig',
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.bestFor':
    'Niedrigauflösende Manga-Scans verbessern und JPEG-Kompressionsartefakte entfernen',
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.performance':
    'Leicht und schnell, läuft auf jedem Computer',
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.notes':
    'Gute Standardoption zum Verbessern von Manga-Scans um 2x',

  'model.tooltip.waifu2x_swin_unet_art_scan_4x.highlights':
    'Verbessert Anime-Scans um 4x\nEntfernt Rauschen und verbessert die Qualität\nFür mehr Detailtiefe',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.unique':
    '4x-Version des klassischen Waifu2x — deutlich höhere Auflösung bei sauberen Linien',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.bestFor':
    'Manga-Scans mit größerer Auflösungssteigerung verbessern und saubere Line Art bewahren',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.performance':
    'Langsamer als die 2x-Version; trotzdem leicht',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.notes':
    'Verwende es, wenn mehr Auflösung benötigt wird als 2x bietet',

  'model.tooltip.waifu2x_swin_unet_art_2x.highlights':
    'Verbessert Anime-Art um 2x\nFür bereits saubere Kunst in guter Qualität\nBewahrt feine Details',
  'model.tooltip.waifu2x_swin_unet_art_2x.unique':
    'Optimiert für bereits saubere Kunst — bewahrt feine Details ohne Rauschen hinzuzufügen',
  'model.tooltip.waifu2x_swin_unet_art_2x.bestFor':
    'Saubere digitale Kunst und Manga verbessern, die bereits gute Ausgangsqualität haben',
  'model.tooltip.waifu2x_swin_unet_art_2x.performance':
    'Leicht und schnell, läuft auf jedem Computer',
  'model.tooltip.waifu2x_swin_unet_art_2x.notes':
    'Weniger aggressiv als die Scan-Version — verwende es, wenn das Bild bereits sauber ist',

  'model.tooltip.4xnomos2_hq_mosr.highlights':
    'Vergrößert Bilder um 4x in maximaler Qualität\nBewahrt feine Details und scharfe Linien\nIdeal für bereits saubere Scans',
  'model.tooltip.4xnomos2_hq_mosr.unique':
    'Fokus auf Qualität — hält jedes Detail des Originalbildes intakt',
  'model.tooltip.4xnomos2_hq_mosr.bestFor':
    'Manga-Scans verbessern, die bereits sauber und in guter Qualität sind',
  'model.tooltip.4xnomos2_hq_mosr.performance':
    'Gute Geschwindigkeit; kleine Dateigröße von nur 16 MB',
  'model.tooltip.4xnomos2_hq_mosr.notes':
    'Funktioniert am besten mit bereits sauberen Bildern. Bei Rauschen oder Kompression vorher bereinigen.',

  'model.tooltip.4xspankendata.highlights':
    'Vergrößert Bilder um 4x sehr schnell\nWinzige Dateigröße von nur 1,6 MB\nLäuft gut auch auf schwächeren Computern',
  'model.tooltip.4xspankendata.unique':
    'Extrem leicht — perfekt wenn Geschwindigkeit ohne Speicherverbrauch benötigt wird',
  'model.tooltip.4xspankendata.bestFor':
    'Schnelles Upscaling jeder Art von Bild, wenn Zeit wichtig ist',
  'model.tooltip.4xspankendata.performance':
    'Sehr schnell; Datei nur 1,6 MB — ideal für CPU',
  'model.tooltip.4xspankendata.notes':
    'Überraschend klein für die gelieferte Qualität. Hervorragende Option für Stapelverarbeitung.',

  'model.tooltip.2x_hfa2kcompact.highlights':
    'Vergrößert Bilder um 2x mit guter Balance\nTrainiert mit modernen Anime-Frames\nKommt gut mit Kompression und Unschärfe zurecht',
  'model.tooltip.2x_hfa2kcompact.unique':
    'Anime-Spezialist — versteht den visuellen Stil moderner Animationen',
  'model.tooltip.2x_hfa2kcompact.bestFor':
    'Manga-/Anime-Seiten mit Kompressionsartefakten oder ungleichmäßiger Qualität',
  'model.tooltip.2x_hfa2kcompact.performance':
    'Schnell und leicht; Datei nur 4,6 MB',
  'model.tooltip.2x_hfa2kcompact.notes':
    'Robust für reale Bilder — funktioniert gut auch bei imperfekten Scans.',

  'model.tooltip.2x_digitalfilm_superultracompact.highlights':
    'Vergrößert Bilder um 2x bei minimaler Größe\nIdeal bei begrenztem Speicherplatz\nGute Qualität für die Größe',
  'model.tooltip.2x_digitalfilm_superultracompact.unique':
    'Ultra-kompakt — passt überall hin ohne Qualitätsverlust',
  'model.tooltip.2x_digitalfilm_superultracompact.bestFor':
    'Leichtes Upscaling, wenn Speicherplatz oder Arbeitsspeicher gespart werden muss',
  'model.tooltip.2x_digitalfilm_superultracompact.performance':
    'Schnell; ~20 MB; manuelle Formatkonvertierung eventuell nötig',
  'model.tooltip.2x_digitalfilm_superultracompact.notes':
    'Falls die Datei nicht lädt, muss das Format möglicherweise extern konvertiert werden.',

  'model.tooltip.2x_anifilm_compact.highlights':
    'Vergrößert Bilder um 2x, optimiert für Anime\nGute Balance zwischen Qualität und Größe\nVisueller Stil bleibt erhalten',
  'model.tooltip.2x_anifilm_compact.unique':
    'Versteht den visuellen Stil von Anime und Animationsfilmen — bewahrt die originale Ästhetik',
  'model.tooltip.2x_anifilm_compact.bestFor':
    'Anime-Inhalte, bei denen das originale Aussehen ohne Übertreibung beibehalten werden soll',
  'model.tooltip.2x_anifilm_compact.performance':
    'Schnell; ~20 MB; manuelle Formatkonvertierung eventuell nötig',
  'model.tooltip.2x_anifilm_compact.notes':
    'Falls die Datei nicht lädt, muss das Format möglicherweise extern konvertiert werden.',

  'model.tooltip.2xnomosuni_span_multijpg_ldl.highlights':
    'Vergrößert Bilder um 2x mit Kompressionsresistenz\nTrainiert für verschiedene JPG-Qualitätsstufen\nRobust für imperfekte Scans',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.unique':
    'Spezialist für JPG-Kompression — funktioniert gut auch bei niedrigqualitativen Scans',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.bestFor':
    'Manga-Scans mit variierender JPG-Kompression oder Qualitätsartefakten',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.performance':
    'Schnell; ~20 MB; manuelle Formatkonvertierung eventuell nötig',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.notes':
    'Falls die Datei nicht lädt, muss das Format möglicherweise extern konvertiert werden.',

  'model.tooltip.realesrgan_x4plus.highlights':
    'Vergrößert Bilder um 4x mit hoher Vielseitigkeit\nKommt gut mit JPEG, Unschärfe und Rauschen zurecht\nFunktioniert mit jedem Inhaltstyp',
  'model.tooltip.realesrgan_x4plus.unique':
    'Der vielseitigste — erkennt und korrigiert verschiedene Arten von Bildverschlechterung',
  'model.tooltip.realesrgan_x4plus.bestFor':
    'Manga-Seiten mit gemischtem Inhalt; JPEG-Artefakte; der vielseitigste Upscaler',
  'model.tooltip.realesrgan_x4plus.performance':
    'Gute Geschwindigkeit; etwas schwerer als die kompakten Modelle',
  'model.tooltip.realesrgan_x4plus.notes':
    'Für reines Anime/Manga die Anime-Version (6B) bevorzugen, die schneller und optimierter ist.',

  'model.tooltip.4xhfa2kludvaeswinir_light.highlights':
    'Vergrößert Bilder um 4x, optimiert für Anime\nGute Balance zwischen Qualität und Leistung\nBewahrt den visuellen Anime-Stil',
  'model.tooltip.4xhfa2kludvaeswinir_light.unique':
    'Vereint Upscale-Qualität mit Aufmerksamkeit für visuelle Anime-Details',
  'model.tooltip.4xhfa2kludvaeswinir_light.bestFor':
    '4x-Upscaling von Anime-Inhalten mit guter Ausgangsqualität',
  'model.tooltip.4xhfa2kludvaeswinir_light.performance':
    'Moderate Geschwindigkeit; ~70 MB; manuelle Formatkonvertierung eventuell nötig',
  'model.tooltip.4xhfa2kludvaeswinir_light.notes':
    'Falls die Datei nicht lädt, muss das Format möglicherweise extern konvertiert werden.',

  'model.tooltip.baka_content_cc.highlights':
    'Trennt Text von Sprechblasen in Comic-Seiten\nIdentifiziert was Text und was Sprechblase ist\nSchnell und effizient',
  'model.tooltip.baka_content_cc.unique':
    'In das Text- und Sprechblasen-Erkennungssystem integriert — arbeitet mit anderen Modellen zusammen',
  'model.tooltip.baka_content_cc.bestFor':
    'Text und Sprechblasen in Manga-Seiten für die Weiterverarbeitung trennen',
  'model.tooltip.baka_content_cc.performance':
    'Schnell und leicht, benötigt keine leistungsstarke Grafikkarte',
  'model.tooltip.baka_content_cc.notes':
    'Wird als Teil der Segmentierungs-Pipeline verwendet',
  'settings.tooltips.title': 'Tooltipps',
  'settings.tooltips.description':
    'Legen Sie fest, wann kontextbezogene Hinweise während der Nutzung des Dashboards angezeigt werden.',
  'settings.tooltips.enableTitle': 'Kontextbezogene Hinweise anzeigen',
  'settings.tooltips.enableDesc':
    'Zeigt animierte Hinweise an, wenn Sie ein Werkzeug in einer Sitzung zum ersten Mal verwenden.',
  'dashboard.hint.healing.ariaLabel': 'Hinweis zum Healing-Werkzeug',
  'dashboard.hint.healing.eyebrow': 'Neues Werkzeug',
  'dashboard.hint.healing.body':
    'Verwenden Sie den Healing Brush, um Defekte, gebrochene Kanten und Textreste zu entfernen. Malen Sie über den zu korrigierenden Bereich und klicken Sie auf Anwenden, damit die KI die Region nahtlos rekonstruiert.',
  'dashboard.hint.healing.footer':
    'Dieser Hinweis wird in dieser Sitzung nicht erneut angezeigt. Deaktivieren Sie alle Hinweise unter Einstellungen → App.',
  'dashboard.aio.presets.tooltip':
    'Voreinstellungen speichern eine sprachspezifische Kombination von Modellen und Stufen. Verwenden Sie sie, um Ihre AIO-Konfiguration beim Wechseln der Quellsprache oder des Workflows schneller zu ändern.',
  'dashboard.aio.presets.tooltipAria':
    'Wofür werden Sprach‑Voreinstellungen verwendet',
  'dashboard.aio.cleanImage.tooltip':
    'Clean Image ist die Bereinigungs- und Inpainting‑Phase. Sie entfernt Text und ausgewählte Artefakte vor dem endgültigen Render‑/Bearbeitungspass.',
  'dashboard.aio.cleanImage.tooltipAria': 'Wofür wird Clean Image verwendet',
  'dashboard.aio.clean.maskDilation.tooltip':
    'Erweitert die Bereinigungsmaske vor dem Inpainting. Erhöhen Sie den Wert, wenn Textkanten noch vorhanden sind; halten Sie ihn niedriger, um benachbarte Grafiken zu erhalten.',
  'dashboard.aio.clean.maskDilation.tooltipAria':
    'Wofür wird die Maskenerweiterung verwendet',
  'dashboard.dashboardLlm.hdStrategy.tooltip':
    'Legt fest, wie große Bilder vor der Bereinigung vorbereitet werden. Resize skaliert die Seite, Crop teilt sie in Kacheln auf, und Original sendet sie unverändert.',
  'dashboard.dashboardLlm.hdStrategy.tooltipAria':
    'Wofür wird die HD‑Strategie verwendet',
  'dashboard.dashboardLlm.cropMargin.tooltip':
    'Fügt zusätzlichen Abstand um jede Zuschnitt‑Kachel hinzu. Erhöhen Sie ihn, wenn Rahmen Kontext verlieren oder nach der Bereinigung Nahtstellen sichtbar werden.',
  'dashboard.dashboardLlm.cropMargin.tooltipAria':
    'Wofür wird der Zuschnitt‑Rand verwendet',
  'dashboard.dashboardLlm.cropTriggerSize.tooltip':
    'Minimale Bildgröße, die das Zuschnitt‑Kachelsystem aktiviert. Kleinere Bilder bleiben als ein Stück; größere werden in Kacheln aufgeteilt.',
  'dashboard.dashboardLlm.cropTriggerSize.tooltipAria':
    'Wofür wird die Zuschnitt‑Auslösegröße verwendet',
  'common.basicInfo': "Grundinformationen",
  'common.resolve': "Lösen",
  'common.dismiss': "Verwerfen",
  'common.title': "Titel",
  'common.summary': "Zusammenfassung",
  'common.summaryPlaceholder': "Schreibe eine kurze, klare Zusammenfassung.",
  'common.mainDescription': "Hauptbeschreibung",
  'common.chapter': "Kapitel",
  'common.genres': "Genres",
  'common.editorialDescription': "Redaktionelle Beschreibung",
  'common.removeValue': "{value} entfernen",
  'settings.integrations.discordWebhook': "Discord-Webhook",
  'discord.presence.appName': "KŌMA Studio",
  'discord.presence.button.website': "Website",
  'discord.presence.button.download': "Download",
  'discord.presence.idle.details': "Erkundet Scanlation-Werkzeuge",
  'discord.presence.idle.state': "Leerlauf",
  'discord.presence.workspace.details': "Ordnet Seiten und bereitet den Workflow vor",
  'discord.presence.aio.details': "Führt die komplette Manga-Pipeline aus",
  'discord.presence.mode.automatic': "Automatischer Modus",
  'discord.presence.mode.manual': "Manueller Modus",
  'discord.presence.mode.basic': "Modus: Einfach",
  'discord.presence.mode.advanced': "Modus: Erweitert",
  'discord.presence.cleaner.details': "Bereinigt Sprechblasen und restauriert die Grafik",
  'discord.presence.cleaner.state.basic': "Modus: Einfach",
  'discord.presence.cleaner.state.advanced': "Modus: Erweitert",
  'discord.presence.translator.details': "Übersetzt Dialoge und bewahrt den Ton",
  'discord.presence.translator.fileDetails': "Übersetze - {fileName}",
  'discord.presence.typesetter.details': "Setzt den finalen Text zurück in die Seite",
  'discord.presence.typesetter.fileDetails': "Text bearbeiten - {fileName}",
  'discord.presence.redraw.fileDetails': "Neu zeichnen - {fileName}",
  'discord.presence.raw.details': "Testet Provider und vergleicht Roh-Ausgaben",
  'discord.presence.proofreader.details': "Prüft Seiten vor der finalen Veröffentlichung",
  'discord.presence.stitch.details': "Verbindet Panels zu nahtlosen Langseiten",
  'discord.presence.split.details': "Trennt Doppelseiten in saubere Seitenschnitte",
  'discord.presence.watermark.details': "Markiert Seiten mit Credits und Branding",
  'discord.presence.enhance.details': "Skaliert Seiten hoch und schärft die Grafik",
  'discord.presence.optimizer.details': "Bereitet Kapitel für Export und Auslieferung auf",
  'discord.presence.blogger.details': "Bereitet Kapitelposts und CDN-Auslieferung vor",
  'discord.presence.imgur.details': "Lädt Bildersätze hoch und teilt Links",
  'discord.presence.guides.details': "Lernt Workflows, Shortcuts und Best Practices",
  'discord.presence.resources.details': "Durchsucht Assets, Referenzen und Hilfsmaterial",
  'discord.presence.batch.details': "Verarbeitet Seiten nacheinander",
  'discord.presence.batch.fileDetails': "Stapel wird verarbeitet - {fileName}",
  'discord.presence.batch.state': "{current}/{total} Dateien",
  'discord.presence.batch.label': "Stapelmodus",
  'discord.presence.section.working': "Arbeitet in {section}",
  'discord.presence.section.viewing': "Ansicht: {section}",
  'discord.presence.settings.details': "Passt die Studio-Einstellungen an",
  'discord.presence.settings.label': "Einstellungen",
  'discord.presence.rankings.details': "Vergleicht Modellqualität, Tempo und Kosten",
  'discord.presence.rankings.label': "Rankings",
  'discord.presence.scanlationFeed.details': "Prüft Community-Releases und Neuigkeiten",
  'discord.presence.scanlationFeed.label': "Scanlation-Feed",
  'discord.presence.loginRegister.details': "Meldet sich an und verwaltet den Kontozugang",
  'discord.presence.loginRegister.label': "Anmelden / Registrieren",
  'typographer.shapeApplied': "Form angewendet.",
  'feed.tabsAria': "Bereiche des Scanlation-Feeds",
  'feed.actions.publishPost': "{type} veröffentlichen",
} as const;
