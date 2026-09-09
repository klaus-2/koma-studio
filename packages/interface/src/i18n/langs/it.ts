import { TranslationCatalog } from '../messages';

export const itMessages: TranslationCatalog = {
  'app.restricted.title': 'Accesso limitato',
  'app.restricted.description':
    "Questa versione è disponibile solo nell'app desktop ufficiale.",
  'app.restricted.publicDocs':
    'I documenti legali restano pubblicamente accessibili:',
  'app.transition.loading': 'Caricamento...',
  'app.transition.enterDashboard': 'Accesso alla dashboard...',
  'app.transition.updateSession': 'Aggiornamento sessione...',
  'app.transition.openFeed': 'Apertura Feed Scanlation...',
  'app.transition.openRankings': 'Apertura classifiche modelli...',
  'app.transition.openSettings': 'Apertura impostazioni...',
  'app.session.validating': 'Validazione sessione...',
  'settings.tabs.general': 'Generali',
  'settings.tabs.presets': 'Preset',
  'settings.tabs.integrations': 'Integrazioni',
  'shortcutModal.title': 'Centro scorciatoie',
  'shortcutModal.subtitle':
    'Le scorciatoie globali funzionano solo nella dashboard, mai nei campi di testo.',
  'shortcutModal.hotkeyHint': 'H per aprire',
  'shortcutModal.close': 'Chiudi',
  'shortcutModal.instructionPrefix': 'Clicca ',
  'shortcutModal.instructionRecord': 'Registra',
  'shortcutModal.instructionSuffix':
    ', poi premi la combinazione di tasti desiderata. I conflitti vengono rilevati automaticamente.',
  'shortcutModal.searchPlaceholder': 'Cerca scorciatoie, azioni o tasti...',
  'shortcutModal.results_one': '{count} risultato',
  'shortcutModal.results_other': '{count} risultati',
  'shortcutModal.recording': 'Registrazione…',
  'shortcutModal.record': 'Registra',
  'shortcutModal.restoreDefault': 'Ripristina predefinito',
  'shortcutModal.clearShortcut': 'Cancella scorciatoia',
  'shortcutModal.conflict': 'Conflitto: "{label}" ({combo})',
  'shortcutModal.fixedShortcuts': 'Scorciatoie contestuali fisse',
  'shortcutModal.fixed': 'Fissa',
  'shortcutModal.noResults': 'Nessuna scorciatoia trovata per "{query}".',
  'shortcutModal.restoreAll': 'Ripristina tutte',
  'toolbar.modelSelect.label': 'Modello di traduzione',
  'toolbar.modelSelect.manage': 'Gestisci modelli',
  'toolbar.modelSelect.select': 'Seleziona un modello',
  'toolbar.modelSelect.groupLocal': '── Modelli locali (installati) ──',
  'toolbar.modelSelect.groupCloud': '── Cloud/API/AI ──',
  'toolbar.modelSelect.localPrefix': '[Locale]',
  'toolbar.modelSelect.cloudPrefix': '[Cloud]',
  'toolbar.modelSelect.updateAvailable': '(Aggiornamento disponibile)',
  'toolbar.modelSelect.installedCount_one': '{count} modello installato',
  'toolbar.modelSelect.installedCount_other': '{count} modelli installati',
  'toolbar.modelSelect.updates_one': '{count} aggiornamento in sospeso',
  'toolbar.modelSelect.updates_other': '{count} aggiornamenti in sospeso',
  'toolbar.modelSelect.noUpdates': 'Nessun aggiornamento in sospeso',
  'toolbar.modelSelect.emptyState':
    'Nessun modello compatibile con {source} → {target}.',
  'toolbar.modelSelect.incompatibleWarning':
    '"{model}" non supporta {source} → {target}. Seleziona un modello compatibile o cambia la lingua di destinazione.',
  'settings.tabs.app': 'Applicazione',
  'settings.backToDashboard': 'Torna alla dashboard',
  'settings.stats.version': 'versione',
  'settings.app.updater.status.idle': 'Inattivo',
  'settings.app.updater.status.checking': 'Verifica in corso…',
  'settings.app.updater.status.available': 'Aggiornamento disponibile',
  'settings.app.updater.status.notAvailable': 'Aggiornato',
  'settings.app.updater.status.downloading': 'Download in corso…',
  'settings.app.updater.status.downloaded': "Pronto per l'installazione",
  'settings.app.updater.status.error': 'Errore',
  'settings.app.updater.channel.stable': 'Stabile (Consigliato)',
  'settings.app.updater.channel.beta': 'Beta (Funzionalità in anteprima)',
  'settings.app.updater.channel.canary': 'Canary (Instabile)',
  'settings.app.updater.version': 'Versione',
  'settings.app.updater.build': 'Build',
  'settings.app.updater.releaseNotes': 'Note di rilascio',
  'settings.app.updater.noNotes': 'Nessuna nota per questa versione.',
  'settings.app.updater.checkNow': 'Controlla aggiornamenti',
  'settings.app.updater.installNow': 'Riavvia e aggiorna',
  'settings.app.updater.desktopOnly': "Disponibile solo nell'app desktop.",
  'settings.app.updater.autoCheck': 'Controllo automatico',
  'settings.app.updater.autoCheckDesc': "Controlla nuove versioni all'avvio.",
  'settings.app.updater.channel': 'Canale di aggiornamento',
  'settings.app.updater.channelDesc': 'Rilasci stabili o sperimentali.',
  'settings.app.fonts.title': 'Font di sistema',
  'settings.app.fonts.desc':
    'Gestisci i font per il Typesetter e il rendering.',
  'settings.app.fonts.systemCount': '{count} font rilevati',
  'settings.app.fonts.customTitle': 'Font personalizzati',
  'settings.app.fonts.import': 'Importa .ttf / .otf',
  'settings.app.fonts.noCustom': 'Nessun font personalizzato importato.',
  'settings.app.fonts.importSuccess': 'Font {name} importato correttamente.',
  'settings.app.fonts.importError': 'Impossibile importare il font.',
  'settings.app.fonts.deleteConfirm': 'Vuoi rimuovere il font {name}?',
  'settings.app.autosave.title': 'Salvataggio automatico workspace',
  'settings.app.autosave.desc':
    'Salva automaticamente i progressi del progetto in locale.',
  'settings.app.autosave.enabled': 'Salvataggio automatico attivo',
  'settings.app.autosave.interval': 'Intervallo (minuti)',
  'settings.app.autosave.saveNow': 'Salva impostazioni',
  'settings.app.autosave.success':
    'Impostazioni di salvataggio automatico aggiornate.',
  'settings.app.autosave.error': 'Impossibile salvare le impostazioni.',
  'settings.app.reset.title': 'Zona pericolosa',
  'settings.app.reset.desc':
    'Cancella i dati locali e ripristina le impostazioni predefinite.',
  'settings.app.reset.button': 'Reimposta applicazione',
  'settings.app.reset.confirm':
    'Verrai disconnesso e tutti i preset e le cache locali verranno cancellati. Vuoi continuare?',
  'settings.app.reset.success': 'Applicazione reimpostata. Riavvio in corso...',
  'settings.general.profile.title': 'Profilo',
  'settings.general.profile.desc':
    'Le informazioni del tuo account e le preferenze globali.',
  'settings.general.profile.name': 'Nome visualizzato',
  'settings.general.profile.email': 'Email principale',
  'settings.general.profile.verified': 'Email verificata',
  'settings.general.profile.unverified': 'Email in attesa',
  'settings.general.profile.verifyBtn': 'Verifica ora',
  'settings.general.profile.sending': 'Invio in corso...',
  'settings.general.profile.verifySuccess': 'Email di verifica inviata.',
  'settings.general.profile.verifyError': "Impossibile inviare l'email.",
  'settings.general.profile.save': 'Salva profilo',
  'settings.general.profile.success': 'Profilo aggiornato correttamente.',
  'settings.general.profile.error': 'Impossibile aggiornare il profilo.',
  'settings.general.travel.title': 'Token di viaggio',
  'settings.general.travel.desc':
    'Accedi al tuo account Studio su altri dispositivi senza disconnetterti.',
  'settings.general.travel.active': 'Token attivo',
  'settings.general.travel.inactive': 'Nessun token attivo',
  'settings.general.travel.generate': 'Genera nuovo token',
  'settings.general.travel.generateDesc': 'Valido per {days} giorni.',
  'settings.general.travel.copyAria': 'Copia token',
  'settings.general.travel.revoke': 'Revoca tutti',
  'settings.general.travel.revoked': 'Token revocati.',
  'settings.general.travel.success': 'Token generato correttamente.',
  'settings.general.travel.error': 'Impossibile elaborare il token.',
  'settings.general.language.title': 'Interfaccia',
  'settings.general.language.desc': "Lingua e tema dell'app.",
  'settings.general.language.label': 'Lingua',
  'settings.general.language.system': 'Segui il sistema',
  'settings.general.theme.label': 'Tema',
  'settings.general.theme.dark': 'Scuro (Predefinito)',
  'settings.general.theme.light': 'Chiaro',
  'settings.general.theme.amoled': 'OLED / Nero',
  'settings.presets.aio.title': 'Preset AIO',
  'settings.presets.aio.desc':
    'Configura i modelli predefiniti per ogni fase e lingua.',
  'settings.presets.aio.active': 'Preset attivo per {lang}',
  'settings.presets.aio.none': 'Nessun preset configurato.',
  'settings.presets.aio.create': 'Nuovo preset',
  'settings.presets.aio.edit': 'Modifica preset',
  'settings.presets.aio.delete': 'Rimuovi preset',
  'settings.presets.aio.name': 'Nome preset',
  'settings.presets.aio.lang': 'Lingua di origine',
  'settings.presets.aio.models': 'Configurazione modelli',
  'settings.presets.aio.save': 'Salva preset',
  'settings.presets.aio.success': 'Preset salvato correttamente.',
  'settings.presets.aio.error': 'Impossibile salvare il preset.',
  'settings.presets.typo.title': 'Preset Typesetter',
  'settings.presets.typo.desc': 'Stili font, colori e fumetti preconfigurati.',
  'settings.presets.render.title': 'Stili di rendering',
  'settings.presets.render.desc':
    "Configura come il testo viene disegnato sull'immagine finale.",
  'settings.integrations.discord.title': 'Webhook Discord',
  'settings.integrations.discord.desc':
    'Notifiche automatiche per il tuo server.',
  'settings.integrations.discord.url': 'URL Webhook',
  'settings.integrations.discord.test': 'Testa connessione',
  'settings.integrations.discord.events': 'Eventi trigger',
  'settings.integrations.discord.success':
    'Configurazione salvata e test inviato.',
  'settings.integrations.discord.error':
    'Impossibile salvare o testare il webhook.',
  'settings.integrations.discord.invalidUrl': 'URL webhook non valido.',
  'settings.integrations.blogger.successSecure':
    "Configurazione Blogger salvata nell'archivio sicuro desktop.",
  'settings.integrations.blogger.successLocal':
    'Configurazione Blogger salvata in locale.',
  'settings.integrations.blogger.saveError':
    'Impossibile salvare la configurazione Blogger.',
  'settings.integrations.blogger.testError':
    'Impossibile validare la connessione Blogger.',
  'settings.integrations.imgur.successSecure':
    "Configurazione Imgur salvata nell'archivio sicuro desktop.",
  'settings.integrations.imgur.successLocal':
    'Configurazione Imgur salvata in locale.',
  'settings.integrations.imgur.saveError':
    'Impossibile salvare la configurazione Imgur.',
  'settings.travel.blocked.notDesktop':
    "Disponibile solo nell'app desktop autenticata.",
  'settings.travel.blocked.noEmail':
    "L'invio email non è configurato in questo ambiente.",
  'settings.travel.blocked.validating': 'Validazione configurazione email…',
  'settings.integrations.blogger.title': 'Blogger CDN',
  'settings.integrations.blogger.desc':
    'Hosting immagini e pubblicazione diretta.',
  'settings.integrations.imgur.desc': 'Rotazione Client ID per upload anonimi.',
  'settings.theme.title': 'Aspetto',
  'settings.theme.description':
    "Scegli tra modalità scura e chiara per l'interfaccia.",
  'settings.theme.dark': 'Scuro',
  'settings.theme.darkDesc': 'Interfaccia scura predefinita',
  'settings.theme.light': 'Chiaro',
  'settings.theme.lightDesc': 'Interfaccia chiara',
  'settings.language.title': "Lingua dell'interfaccia",
  'settings.language.description':
    "Scegli la lingua dell'app. Su desktop, il rilevamento iniziale usa le lingue preferite del sistema.",
  'settings.language.label': 'Lingua',
  'settings.language.systemLabel': 'Rilevato dal sistema',
  'settings.language.applied':
    'Le modifiche vengono applicate immediatamente e salvate su questo dispositivo per le build di sviluppo e pacchettizzate.',
  'auth.tabs.login': 'Accedi',
  'auth.tabs.register': 'Crea account',
  'auth.legal.reviewDocs':
    'Continuando, ti invitiamo a consultare la nostra documentazione legale:',
  'auth.quote.line1': 'Ogni grande storia',
  'auth.quote.line2': 'inizia con',
  'auth.quote.line3': 'una singola pagina.',
  'auth.stats.activeScanlators': 'Utenti attivi',
  'auth.stats.tools': 'Strumenti',
  'auth.stats.pagesProcessed': 'Pagine elaborate',
  'auth.toolkit.ai': 'IA e automazione',
  'auth.toolkit.tools': 'Strumenti',
  'auth.toolkit.learning': 'Apprendimento',
  'auth.toolkit.aiTranslation': 'Traduzione IA',
  'auth.toolkit.autoRedraw': 'Ridisegno automatico',
  'auth.toolkit.advancedEditor': 'Editor avanzato',
  'auth.toolkit.proTypesetting': 'Impaginazione Pro',
  'auth.toolkit.qualityControl': 'Controllo qualità',
  'auth.toolkit.guides': 'Guide e tutorial',
  'auth.toolkit.resources': 'Risorse e materiali',
  'auth.community.join': 'Unisciti alla community',
  'auth.cover.popular': 'POPOLARE',
  'auth.cover.new': 'NOVITÀ',
  'auth.cover.cleanRedraw': 'Pulizia + Ridisegno',
  'auth.cover.translation': 'Traduzione',
  'auth.cover.typography': 'Tipografia',
  'auth.cover.fullEditing': 'Editing completo',
  'auth.cover.allInOne': 'AIO - Tutto in uno',
  'auth.cover.finalQc': 'Pulizia finale',
  'login.subtitle.credentials':
    'Accedi al tuo account e riprendi da dove avevi lasciato.',
  'login.subtitle.travel':
    'Autorizza temporaneamente questo computer senza uscire dal flusso di accesso.',
  'login.error.completeCaptchaTravel':
    "Completa il captcha per terminare l'autorizzazione di questo computer.",
  'login.error.completeCaptcha': 'Completa il captcha per continuare.',
  'login.error.missingCredentials':
    "Torna indietro e inserisci email e password dell'account prima di autorizzare questo computer.",
  'login.error.missingTravelToken':
    "Inserisci il token ricevuto via email per completare l'accesso.",
  'login.error.generic': 'Accesso non riuscito',
  'login.warning.mandatoryUpdateTitle':
    'Aggiornamento obbligatorio disponibile',
  'login.warning.mandatoryUpdateBody':
    "Installa la versione {version} per continuare a usare l'app.",
  'login.warning.downloadUpdate': 'Scarica aggiornamento',
  'login.warning.downloadingUpdate': 'Download aggiornamento in corso...',
  'login.warning.installUpdateNow': 'Installa aggiornamento ora',
  'login.verification.title': 'Cosa fare',
  'login.verification.wait': 'Attendi {seconds} secondi.',
  'login.verification.retrySameDevice':
    'Prova ad accedere di nuovo dallo stesso dispositivo o dalla stessa rete.',
  'login.verification.avoidVpn':
    'Evita di cambiare VPN o rete durante questo periodo.',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.forgotPassword': 'Password dimenticata',
  'login.rememberMe': 'Ricordami su questo dispositivo',
  'login.travel.eyebrow': 'Controllo di sicurezza',
  'login.travel.title': "Questo computer richiede un'autorizzazione temporanea",
  'login.travel.copy':
    "Apri KŌMA Studio sul tuo PC principale e vai su Impostazioni > Accesso di viaggio per inviare il codice e completare l'accesso.",
  'login.travel.accountInUse': 'Account in uso: {email}',
  'login.travel.sameAccount':
    'Usa lo stesso account già aperto sul tuo PC principale.',
  'login.travel.emailDisabled':
    "L'invio email non è configurato in questo ambiente.",
  'login.travel.emailEnabled':
    "Il codice verrà inviato all'email principale dell'account.",
  'login.travel.step1': "Apri l'app sul tuo computer principale.",
  'login.travel.step2': "Invia il token all'email dell'account.",
  'login.travel.step3':
    'Incolla il codice qui sotto per autorizzare questo computer.',
  'login.travel.tokenLabel': 'Token di viaggio',
  'login.travel.tokenPlaceholder': 'Incolla il codice ricevuto via email',
  'login.button.authorizing': 'Autorizzazione in corso...',
  'login.button.validating': 'Validazione in corso...',
  'login.button.updateRequired': "Aggiorna l'app per accedere",
  'login.button.retryIn': 'Riprova tra {seconds}s',
  'login.button.authorizeComputer': 'Autorizza questo computer',
  'login.button.login': 'Accedi al mio account',
  'login.button.changeAccount': 'Torna indietro e cambia account',
  'login.emailPlaceholder': 'tu@email.com',
  'login.passwordPlaceholder': '••••••••',
  'login.warning.latestVersion': 'più recente',
  'login.newHere': 'Sei nuovo?',
  'login.createFreeAccount': 'Crea il tuo account gratuito',
  'register.subtitle':
    'Crea il tuo account e inizia a esplorare migliaia di titoli.',
  'register.error.passwordMismatch': 'Le password non corrispondono.',
  'register.error.completeCaptcha':
    'Completa il captcha per terminare la registrazione.',
  'register.error.acceptTerms':
    "Devi accettare i Termini di servizio e l'Informativa sulla privacy per creare un account.",
  'register.error.generic': 'Registrazione non riuscita',
  'register.displayName': 'Nome visualizzato',
  'register.displayNamePlaceholder': 'Come dovremmo chiamarti?',
  'register.password': 'Password',
  'register.passwordPlaceholder': 'Almeno 8 caratteri',
  'register.confirmPassword': 'Conferma password',
  'register.confirmPasswordPlaceholder': 'Reinserisci la password',
  'register.legalPrefix': 'Ho letto e accetto i',
  'register.legalSuffix':
    'Comprendo che la registrazione utilizza cookie strettamente necessari e che funzionalità come segnalazione bug e integrazioni sono regolate dai documenti sopra indicati.',
  'register.button.creating': 'Creazione account...',
  'register.button.loginNow': 'Accedi ora',
  'legal.links.terms': 'Termini di servizio',
  'legal.links.privacy': 'Informativa sulla privacy',
  'legal.links.cookies': 'Politica dei cookie',
  'legal.links.content': 'Avvisi sui contenuti',
  'transition.tips.loading': '読み込み中...',
  'transition.tips.preparing': 'Preparazione del tuo studio...',
  'transition.tips.opening': 'Apertura dello spazio di editing...',
  'transition.tips.organizing': 'Organizzazione dei pannelli...',
  'transition.tips.warming': 'Riscaldamento degli strumenti...',
  'transition.tips.workflow': 'Caricamento del flusso di lavoro...',
  'transition.ariaLabel': 'Pagina in caricamento',
  'ranking.discover.title': 'Sii il primo a recensire',
  'ranking.discover.subtitle':
    'Modelli ufficiali senza recensioni con il filtro attuale.',
  'ranking.discover.available': '{count} disponibili',
  'ranking.discover.empty': 'Tutti i modelli filtrati hanno già recensioni.',
  'ranking.discover.local': 'Locale',
  'ranking.discover.cloud': 'Cloud',
  'legalHub.version': 'Versione',
  'legalHub.updatedAt': 'Aggiornato il',
  'register.button.create': 'Crea il mio account',
  'register.alreadyHaveAccount': 'Hai già un account?',
  'password.rule.minLength': 'Almeno 8 caratteri',
  'password.rule.uppercase': 'Lettera maiuscola',
  'password.rule.lowercase': 'Lettera minuscola',
  'password.rule.number': 'Numero',
  'password.rule.special': 'Carattere speciale',
  'password.level.veryWeak': 'Molto debole',
  'password.level.weak': 'Debole',
  'password.level.fair': 'Discreta',
  'password.level.good': 'Buona',
  'password.level.strong': 'Forte',
  'captcha.loadError': 'Impossibile caricare lo script Turnstile',
  'captcha.missingSiteKey':
    'Captcha abilitato, ma VITE_TURNSTILE_SITE_KEY non è configurato.',
  'captcha.initError': 'Impossibile inizializzare il captcha',
  'captcha.securityCheck': 'Controllo di sicurezza',
  'captcha.loadScriptError': 'Impossibile caricare lo script Turnstile',
  'captcha.success': 'Captcha validato correttamente.',
  'forgot.title': 'Recupero password',
  'forgot.subtitle':
    'Inserisci la tua email per ricevere un link di reimpostazione password.',
  'forgot.success':
    'Se esiste un account con questa email, riceverai le istruzioni per reimpostare la password.',
  'forgot.error': 'Impossibile richiedere la reimpostazione della password',
  'forgot.button.sending': 'Invio in corso...',
  'forgot.button.send': 'Invia link di reimpostazione',
  'forgot.remembered': 'Ricordi la tua password?',
  'forgot.backToLogin': "Torna all'accesso",
  'reset.title': 'Nuova password',
  'reset.subtitle': 'Imposta una password sicura per il tuo account.',
  'reset.error.missingToken':
    'Il token di reimpostazione è mancante o non valido.',
  'reset.error.generic': 'Impossibile reimpostare la password',
  'reset.success': 'Password reimpostata correttamente. Ora puoi accedere.',
  'reset.newPassword': 'Nuova password',
  'reset.button.submitting': 'Reimpostazione in corso...',
  'reset.button.submit': 'Reimposta password',
  'verify.title': 'Verifica email',
  'verify.subtitle.pending':
    'Conferma la tua email per sbloccare tutte le funzionalità.',
  'verify.subtitle.done': 'La tua email è già stata confermata.',
  'verify.noEmail': 'nessuna-email',
  'verify.verified': 'Verificata',
  'verify.success':
    'Email di conferma inviata. Controlla la tua casella di posta.',
  'verify.error': "Impossibile inviare l'email",
  'verify.button.sending': 'Invio in corso...',
  'verify.button.resend': 'Reinvia email di verifica',
  'verify.button.alreadyConfirmed': 'Email già confermata',
  'verify.button.backDashboard': 'Torna alla dashboard',
  'confirm.title.verifying': 'Conferma email in corso...',
  'confirm.title.success': 'Email confermata!',
  'confirm.title.error': 'Conferma non riuscita',
  'confirm.subtitle.verifying': 'Stiamo validando il tuo link di conferma.',
  'confirm.subtitle.success':
    'La tua email è stata confermata. Ora puoi usare tutte le funzionalità.',
  'confirm.subtitle.error':
    'Il link di conferma non è valido o è scaduto. Richiedi una nuova email.',
  'confirm.status.wait': 'Attendere la verifica in corso...',
  'confirm.errorCode': 'Codice errore:',
  'confirm.success': 'Conferma completata correttamente.',
  'confirm.goDashboard': 'Vai alla dashboard',
  'confirm.goLogin': "Vai all'accesso",
  'banned.title': 'Accesso bloccato',
  'banned.subtitle':
    "Questo accesso è stato sospeso dalla moderazione dell'app.",
  'banned.reason': 'Motivo',
  'banned.scope': 'Ambito',
  'banned.duration': 'Durata',
  'banned.until': 'Temporaneo fino al {value}',
  'banned.undefinedDate': 'data indefinita',
  'banned.permanent': 'Permanente',
  'banned.policy':
    "Link, post malevoli o comportamenti abusivi possono comportare un ban permanente dall'app.",
  'banned.backToLogin': "Torna all'accesso",
  'session.expiresIn': 'La tua sessione scade tra {seconds}s per inattività.',
  'session.stayConnected': 'Resta connesso',
  'update.toast.availableTitle': 'Nuovo aggiornamento disponibile',
  'update.toast.availableDescription':
    'La versione {version} è pronta per il download sul canale {channel}.',
  'update.toast.downloadedTitle': 'Aggiornamento pronto',
  'update.toast.downloadedDescription':
    "Aggiornamento pronto. {percent}% completato. Installa ora o alla chiusura dell'app.",
  'update.toast.downloadingTitle': 'Download aggiornamento',
  'update.toast.downloadingDescription': '{percent}% completato.',
  'update.toast.closeAria': 'Chiudi banner aggiornamento',
  'update.channel.beta': 'Beta',
  'update.channel.stable': 'Stabile',
  'update.button.download': 'Scarica',
  'update.button.details': 'Dettagli',
  'update.button.installNow': 'Installa ora',
  'update.button.installLater': 'Installa dopo',
  'update.progress.title': 'Download aggiornamento in corso...',
  'update.modal.title': 'Aggiornamento disponibile',
  'update.modal.unknownVersion': 'sconosciuta',
  'update.modal.closeAria': 'Chiudi finestra',
  'update.modal.mandatory':
    "Questo aggiornamento è obbligatorio. Scaricalo e installalo per continuare a usare l'app.",
  'update.modal.releaseNotes': 'Note di rilascio',
  'update.modal.releaseNotesEmpty':
    'Nessuna nota di rilascio disponibile per questa versione.',
  'update.modal.readyProgress': 'Aggiornamento pronto. 100% completato.',
  'update.modal.downloadingProgress': 'Download aggiornamento in corso...',
  'update.modal.readyToInstall': "Pronto per l'installazione",
  'update.modal.installHintAuto':
    "Se chiudi l'app ora, l'installazione partirà automaticamente.",
  'update.modal.installHintManual':
    'L\'installazione alla chiusura è stata disabilitata. Usa "Installa dopo" per riattivarla e chiudere in sicurezza.',
  'update.modal.downloadAction': 'Scarica aggiornamento',
  'update.modal.downloadingAction': 'Download in corso...',
  'update.modal.installAction': 'Installa ora',
  'update.modal.installLaterAction': 'Installa dopo (alla chiusura)',
  'update.modal.laterAction': 'Più tardi',
  'dropzone.invalidImageAlert': 'Carica un file immagine valido (PNG/JPG).',
  'dropzone.clickOrDrag': "Clicca o trascina l'immagine qui",
  'dropzone.supports': 'Supporta PNG e JPG',
  'actionButtons.cleaning': 'Pulizia in corso...',
  'actionButtons.cleanImage': 'Pulisci immagine',
  'actionButtons.downloadResult': 'Scarica risultato',
  'aio.model.manage': 'Modelli',
  'aio.model.noneAvailable': 'Nessun modello disponibile',
  'aio.model.device': 'Dispositivo',
  'aio.model.languages': 'Lingue',
  'aio.model.languages.multi': 'multi',
  'aio.model.noDescription': 'Nessuna descrizione.',
  'aio.model.localStatus': 'Stato locale: {value}',
  'aio.stage.detectText': 'Rileva testo',
  'aio.stage.recognizeText': 'Riconosci testo',
  'aio.stage.getTranslations': 'Ottieni traduzioni',
  'aio.stage.segmentText': 'Segmenta testo',
  'aio.stage.cleanImage': 'Pulisci immagine',
  'aio.stage.tabsBarAria': 'Configurazione fasi',
  'aio.render.title': 'Testo renderizzato',
  'aio.render.description.manual':
    'Fai doppio clic su un riquadro per modificarlo inline. Il dock contestuale appare vicino alla selezione con il testo renderizzato.',
  'aio.render.description.auto':
    'La modalità automatica applica il rendering predefinito alle regioni tradotte.',
  'aio.render.activePage':
    'Pagina attiva: {count} blocco/i. Selezionati: {selected}.',
  'aio.render.contextualDock.visible': 'visibile alla selezione',
  'aio.render.contextualDock.doubleClick':
    'doppio clic per iniziare la modifica e mostrare il dock',
  'aio.render.contextualDock.select': 'seleziona un riquadro per usare il dock',
  'aio.render.contextualDock': 'Dock contestuale: {value}',
  'aio.render.shortcut':
    "Scorciatoia: usa Shift + Scroll sull'anteprima per ruotare il testo del riquadro selezionato.",
  'aio.render.inactiveStage':
    'Questa immagine è a una fase precedente al Render. Usa avanti per visualizzare/modificare il testo renderizzato.',
  'aio.render.fontCatalog': 'Catalogo font',
  'aio.render.refreshFonts': 'Aggiorna font',
  'aio.render.refreshingFonts': 'Aggiornamento...',
  'aio.render.importFont': 'Importa font',
  'aio.render.importingFont': 'Importazione...',
  'aio.render.importFontTitleDesktop':
    "Importa font personalizzato nell'app desktop",
  'aio.render.importFontTitleBrowser':
    "L'importazione è disponibile solo nell'app desktop",
  'aio.render.desktopFontsHint':
    "I font di Windows installati e le importazioni personalizzate sono disponibili nell'app desktop.",
  'aio.render.overlayControlsHint':
    'I controlli di font, dimensione, allineamento e colore sono ora nel dock contestuale sovrapposto.',
  'aio.render.applyStyleAll': 'Applica lo stile attuale a tutte le selezioni',
  'aio.render.applyStyleAllTitle':
    'Applica lo stile della selezione attuale a tutte le selezioni su tutte le immagini',
  'aio.region.title': 'Regioni rilevate',
  'aio.region.description.manual':
    "Trascina sull'anteprima per aggiungere nuove aree. Trascina un riquadro per spostarlo e usa gli angoli per ridimensionarlo.",
  'aio.region.description.auto':
    'Passa alla modalità manuale per regolare i riquadri rilevati.',
  'aio.region.activePage':
    'Pagina attiva: {count} regione/i. Selezionate: {selected}.',
  'aio.region.ocr': 'OCR della regione selezionata: {value}',
  'aio.region.translation': 'Traduzione della regione selezionata: {value}',
  'aio.region.notes': 'Note della regione selezionata: {value}',
  'aio.region.segmentation': 'Segmentazione della regione selezionata: {value}',
  'aio.region.noSelection': 'nessuna',
  'aio.region.noRecognizedText': 'nessun testo riconosciuto',
  'aio.region.ocrDisabled': 'Fase OCR disabilitata',
  'aio.region.noTranslation': 'nessuna traduzione disponibile',
  'aio.region.translationDisabled': 'fase traduzione disabilitata',
  'aio.region.noNotes': 'nessuna nota disponibile',
  'aio.region.notesDisabled': 'note disabilitate',
  'aio.region.noSelectedRegion': 'nessuna regione selezionata',
  'aio.region.segmentedBoxes': '{count} riquadro/i segmentato/i',
  'aio.region.removeSelected': 'Rimuovi selezionati',
  'aio.region.duplicateSelected': 'Duplica selezionati',
  'aio.manual.toolsHintPrimary':
    'Usa il dock flottante sul canvas per Seleziona area, Pulisci pagina e modifica segmentazione/manuale.',
  'aio.manual.toolsHintSecondary':
    "Gli strumenti vengono abilitati automaticamente in base alla fase attiva dell'immagine.",
  'aio.run.manualNoActive':
    "Seleziona un'immagine attiva per eseguire la fase manuale.",
  'aio.run.manualCurrentOnly':
    "Esegui solo la fase corrente per l'immagine selezionata.",
  'aio.run.processing': 'Esecuzione {percent}%',
  'aio.run.rerunCurrent': 'Riesegui fase corrente (immagine attiva)',
  'aio.run.runCurrent': 'Esegui fase corrente (immagine attiva)',
  'aio.run.full':
    'Esegui AIO (Rileva + OCR + Traduci + Segmenta + Pulisci + Renderizza)',
  'aio.pipeline.textModeTitle': 'Modalità testo',
  'aio.pipeline.textModeDescription':
    'Definisci come la regione selezionata deve essere trattata durante il rendering. AUTO usa la classificazione rilevata.',
  'aio.pipeline.currentSelectionMode': 'Modalità selezione attuale',
  'aio.pipeline.currentSelectionModeAria':
    'Modalità testo della selezione attuale',
  'aio.pipeline.autoResolved': 'AUTO viene risolto come {value}.',
  'aio.pipeline.currentMode': 'Modalità attuale: {value}.',
  'aio.pipeline.selectPreviewBox':
    "Seleziona un riquadro nell'anteprima per cambiare la modalità testo.",
  'aio.pipeline.title': 'Pipeline AIO',
  'aio.pipeline.description.auto':
    "Configura l'intera pipeline (rilevamento, OCR, traduzione, segmentazione e pulizia) prima di eseguire il batch.",
  'aio.pipeline.description.manual':
    "Modalità manuale: esegui o salta le fasi sequenzialmente per l'immagine selezionata.",
  'aio.pipeline.render': 'Renderizza',
  'aio.pipeline.renderSubtitle':
    "Applica il testo tradotto all'immagine finale",
  'aio.pipeline.executeCurrentTitle':
    "Esegui solo la fase corrente per l'immagine selezionata",
  'aio.pipeline.executingStage': 'Esecuzione fase...',
  'aio.pipeline.rerunStage': 'Riesegui fase',
  'aio.pipeline.runStage': 'Esegui fase',
  'aio.pipeline.skipStage': 'Salta fase',
  'aio.pipeline.skipStageTitle':
    'Salta la fase corrente e sblocca la successiva',
  'aio.pipeline.rewind': 'Indietro',
  'aio.pipeline.rewindTitle': 'Torna alla fase precedente della pipeline AIO',
  'aio.pipeline.forward': 'Avanti',
  'aio.pipeline.forwardTitle': 'Avanza alla fase successiva della pipeline AIO',
  'aio.pipeline.manualImageStatus':
    'Manuale per immagine: "{image}" alla fase {stage}.',
  'aio.pipeline.selectImageManual':
    "Seleziona un'immagine per iniziare il flusso manuale fase per fase.",
  'aio.pipeline.currentStage': 'Fase attuale: {label} ({current}/{total}).',
  'aio.pipeline.runToEnable':
    'Esegui AIO per abilitare indietro/avanti fase per fase.',
  'aio.pipeline.manualHint':
    "Rendi il processo molto più affidabile: in modalità manuale, ogni fase che modifichi effettivamente viene eseguita con più controllo, revisione e precisione. Viene elaborata solo l'immagine selezionata, e la quota viene consumata solo alla prima esecuzione manuale di ogni immagine (o zero se è già passata per l'AIO automatico).",
  'dashboard.enhance.profile.mangaScan': 'Scan manga',
  'dashboard.enhance.profile.animeArt': 'Arte anime',
  'dashboard.enhance.profile.general': 'Generale',
  'dashboard.enhance.profile.highQuality4x': 'Alta qualità 4x',
  'dashboard.emptyTip.1':
    "Se un'immagine è troppo grande e ricevi errori durante pulizia, traduzione o ridisegno, prova a dividerla in parti più piccole. Di solito questo stabilizza l'elaborazione.",
  'dashboard.emptyTip.2':
    'La modalità automatica velocizza il flusso di lavoro, ma per un risultato perfetto al 100% vale la pena rivedere in modalità manuale e correggere i dettagli finali.',
  'dashboard.emptyTip.3':
    "Usa lo strumento di rifinitura per rendere il testo più pulito, bilanciato e all'altezza degli standard di scanlation.",
  'dashboard.emptyTip.4':
    'Puoi cambiare la forma dei fumetti tra rettangolare ed ellittica per adattare meglio il testo su ogni pagina.',
  'dashboard.emptyTip.5':
    'Configura i preset nella pagina impostazioni per velocizzare le attività ripetitive e mantenere la coerenza tra i capitoli.',
  'dashboard.emptyTip.6':
    'Prova modelli diversi per ogni lingua. Il miglior OCR o traduttore per il giapponese potrebbe non essere ideale per coreano, cinese o inglese.',
  'dashboard.emptyTip.7':
    'Vota i modelli che aiutano di più il tuo flusso di lavoro. Questo migliora la classifica e guida altri utenti nelle loro scelte.',
  'dashboard.emptyTip.8': 'Se la traduzione cloud è costosa o instabile, regola i tuoi preset e mantieni un fallback locale per non bloccare la produzione.',
  'dashboard.emptyTip.9':
    "Usa il Traduttore visuale per rivedere regioni specifiche senza dover rieseguire l'intero capitolo.",
  'dashboard.emptyTip.10':
    'Nel Typesetter, piccole regolazioni manuali di allineamento, font e spaziatura fanno una grande differenza nel risultato finale.',
  'dashboard.emptyTip.11':
    'Quando il testo risulta troppo compresso, riduci la quantità di testo nel riquadro, affina la traduzione o regola il fumetto prima di ridurre troppo il font.',
  'dashboard.emptyTip.12':
    "Se l'output OCR è scadente, prova un modello diverso prima di correggere tutto a mano. Cambiare modello spesso risolve la maggior parte degli errori.",
  'dashboard.emptyTip.13':
    "Usa le note di traduzione solo quando aggiungono davvero valore per il lettore. Meno rumore rende l'esperienza di lettura più pulita.",
  'dashboard.emptyTip.14':
    'Salva profili LLM e OCR personalizzati per confrontare rapidamente le configurazioni senza riconfigurare tutto ad ogni test.',
  'dashboard.emptyTip.15':
    'Se una pagina fallisce nel flusso AIO, esegui le fasi separatamente in Produzione per trovare esattamente dove si trova il collo di bottiglia.',
  'dashboard.aio.progress.detectText': 'rilevamento testo',
  'dashboard.aio.progress.recognizeText': 'riconoscimento testo',
  'dashboard.aio.progress.getTranslations': 'traduzione testo',
  'dashboard.aio.progress.segmentText': 'segmentazione testo',
  'dashboard.aio.progress.cleanImage': 'pulizia immagine',
  'dashboard.aio.progress.render': 'preparazione rendering',
  'dashboard.aio.subtitle.detectText':
    "Localizza le aree di testo nell'immagine",
  'dashboard.aio.subtitle.recognizeText':
    'OCR per estrarre il contenuto testuale',
  'dashboard.aio.subtitle.getTranslations':
    'Traduzione automatica tramite il servizio/modello selezionato',
  'dashboard.aio.subtitle.segmentText':
    'Affina le regioni con segmentazione (stile Baka)',
  'dashboard.aio.subtitle.cleanImage':
    'Inpainting con AOT/LaMa + maschera stile Baka',
  'dashboard.aio.manualStatus.locked': 'Bloccata',
  'dashboard.aio.manualStatus.pending': 'In attesa',
  'dashboard.aio.manualStatus.done': 'Completata',
  'dashboard.aio.manualStatus.skipped': 'Saltata',
  'dashboard.mode.underDevelopment': 'Ancora in fase di sviluppo.',
  'dashboard.nav.group.main': 'Principale',
  'dashboard.nav.group.production': 'Produzione',
  'dashboard.nav.group.utils': 'Utilità',
  'dashboard.nav.group.info': 'Informazioni',
  'dashboard.nav.short.aio': 'AIO',
  'dashboard.nav.short.cleaner': 'Cleaner/RD',
  'dashboard.nav.short.enhance': 'Migliora',
  'dashboard.nav.subtitle.organize': 'Gestisci file',
  'dashboard.nav.subtitle.aio': 'Tutto in uno',
  'dashboard.nav.subtitle.cleaner': 'Pulizia e ridisegno',
  'dashboard.nav.subtitle.typesetter': 'Typesetter',
  'dashboard.nav.subtitle.translator': 'Traduttore',
  'dashboard.nav.subtitle.raw': 'Fornitore raw',
  'dashboard.nav.subtitle.proofreader': 'Revisore e QC',
  'dashboard.nav.subtitle.stitch': 'Unione',
  'dashboard.nav.subtitle.split': 'Divisione',
  'dashboard.nav.subtitle.watermark': 'Filigrana',
  'dashboard.nav.subtitle.enhance': 'Miglioramento',
  'dashboard.nav.subtitle.optimizer': 'Ottimizzatore capitoli',
  'dashboard.nav.subtitle.blogger': 'Pubblicazione e hosting',
  'dashboard.nav.subtitle.imgur': 'Hosting anonimo',
  'dashboard.nav.subtitle.guides': 'Tutorial',
  'dashboard.nav.subtitle.resources': 'Risorse',
  'dashboard.nav.tooltip.organize':
    "Organizza e riordina le immagini prima dell'elaborazione",
  'dashboard.nav.tooltip.aio':
    'Pipeline completa: rileva, riconosci, traduci, segmenta, pulisci e renderizza',
  'dashboard.nav.tooltip.cleaner':
    "Pulisci fumetti e ridisegna aree dell'immagine",
  'dashboard.nav.tooltip.typesetter':
    'Applica tipografia e stile al testo sulle pagine',
  'dashboard.nav.tooltip.translator':
    "Traduci testo libero o rivedi OCR/traduzione per regioni dell'immagine",
  'dashboard.nav.tooltip.raw':
    'Gestisci e fornisci immagini raw per la pipeline',
  'dashboard.nav.tooltip.proofreader':
    'Rivedi le traduzioni e verifica la qualità finale',
  'dashboard.nav.tooltip.stitch':
    'Unisci più immagini in una striscia continua',
  'dashboard.nav.tooltip.split': 'Dividi immagini lunghe in parti più piccole',
  'dashboard.nav.tooltip.watermark':
    'Aggiungi filigrane in batch alle immagini',
  'dashboard.nav.tooltip.enhance':
    'Migliora la qualità e la risoluzione delle immagini',
  'dashboard.nav.tooltip.optimizer':
    'Ottimizza i file finali per web, lettura o archiviazione',
  'dashboard.nav.tooltip.blogger':
    'Pubblica post su Blogger e genera URL di immagini ospitate',
  'dashboard.nav.tooltip.imgur':
    'Carica immagini su Imgur con rotazione Client ID',
  'dashboard.nav.tooltip.guides': "Guide e tutorial sull'uso degli strumenti",
  'dashboard.nav.tooltip.resources': 'Risorse, link e materiali di riferimento',
  'dashboard.mode.organize': 'Organizza',
  'dashboard.mode.aio': 'AIO — Tutto in uno',
  'dashboard.mode.cleaner': 'Cleaner / Ridisegnatore',
  'dashboard.mode.typesetter': 'Typesetter',
  'dashboard.mode.translator': 'Traduttore',
  'dashboard.mode.raw': 'Fornitore raw',
  'dashboard.mode.proofreader': 'Revisore / QC',
  'dashboard.mode.stitch': 'Unione (Webtoon)',
  'dashboard.mode.split': 'Divisione intelligente',
  'dashboard.mode.watermark': 'Filigrana',
  'dashboard.mode.enhance': 'Migliora immagine',
  'dashboard.mode.optimizer': 'Ottimizzatore capitoli',
  'dashboard.mode.blogger': 'Blogger CDN',
  'dashboard.mode.imgur': 'Upload Imgur',
  'dashboard.mode.guides': 'Guide e tutorial',
  'dashboard.mode.resources': 'Risorse e materiali',
  'dashboard.status.modelSelected': 'Modello selezionato per {stage}: {model}',
  'dashboard.status.verifyEmailRequired':
    'Conferma la tua email per eseguire questa azione.',
  'dashboard.status.imagesCount': '{count} immagini',
  'dashboard.status.noImage': 'Nessuna immagine',
  'dashboard.status.freeText': 'testo libero',
  'dashboard.user.defaultName': 'Utente',
  'dashboard.topbar.thisTab': 'Questa scheda',
  'dashboard.aio.config.title': 'Configurazione fasi',
  'dashboard.footer.hardware.nvidia':
    'Accelerazione NVIDIA a prestazioni massime.',
  'dashboard.footer.hardware.intel': 'Accelerazione Intel dedicata in uso.',
  'dashboard.footer.hardware.cpu':
    'Esecuzione locale senza accelerazione dedicata.',
  'dashboard.footer.quickLinks': 'Link rapidi',
  'dashboard.footer.lastSave.never': 'Nessun salvataggio in questa sessione',
  'dashboard.footer.lastSave.label': 'Ultimo salvataggio: {time}',
  'dashboard.cleaner.flow.local.title':
    'Flusso strutturato con OCR, segmentazione e inpainting locale',
  'dashboard.cleaner.flow.ai.title':
    'Pulizia automatica con IA multimodale e ricostruzione guidata',
  'dashboard.cleaner.flow.local.desc':
    'Usa il rilevatore locale per proporre candidati, classifica quali regioni sono veri SFX e pulisce solo quelli approvati.',
  'dashboard.cleaner.flow.ai.desc':
    "Usa il rilevamento strutturale del progetto per guidare l'IA, rafforza la preservazione di fumetti/arte e ricompone le immagini grandi con giunture più uniformi.",
  'dashboard.cleaner.instructions.placeholder':
    'Es.: preserva meglio i gradienti rossi, sii più conservativo sugli SFX piccoli, dai priorità a non toccare i riquadri narrativi.',
  'dashboard.cleaner.instructions.hint.local':
    'Queste istruzioni vengono iniettate come contesto supplementare dopo le regole base di classificazione e pulizia SFX.',
  'dashboard.cleaner.instructions.hint.ai':
    'Queste istruzioni vengono iniettate come contesto supplementare. Le regole principali del cleaner IA restano al di sopra di qualsiasi istruzione utente per preservare la logica di pulizia.',
  'dashboard.cleaner.inspection.title': 'Ispezione',
  'dashboard.cleaner.segmentation.manage': 'Gestisci modelli di segmentazione',
  'dashboard.cleaner.segmentation.model': 'Modello di segmentazione',
  'dashboard.aio.gpuStages.title': 'Uso GPU per fase',
  'dashboard.aio.gpuStages.hint':
    "Seleziona quali fasi devono usare l'accelerazione GPU. Deseleziona per forzare l'esecuzione su CPU (utile se la GPU non ha abbastanza VRAM per tutte le fasi).",
  'dashboard.aio.gpuStages.detect': 'Rilevamento testo (GPU)',
  'dashboard.aio.gpuStages.ocr': 'OCR / Riconoscimento (GPU)',
  'dashboard.aio.gpuStages.segment': 'Segmentazione (GPU)',
  'dashboard.aio.gpuStages.clean': 'Pulizia / Inpainting (GPU)',
  'dashboard.aio.gpuStages.noActiveProfile':
    'Al momento non è confermato alcun profilo GPU attivo. Questa sezione resta visibile per evitare sparizioni intermittenti; i toggle tornano ad avere effetto non appena è disponibile un profilo GPU.',
  'dashboard.aio.config.loadingCatalogs': 'Caricamento cataloghi locali e cloud...',
  'dashboard.aio.preparingManual': 'Preparazione fase manuale AIO...',
  'dashboard.aio.preparingAuto': 'Preparazione esecuzione automatica AIO...',
  'dashboard.aio.stopping': 'Arresto esecuzione AIO...',
  'dashboard.aio.abortedByUser': "Esecuzione AIO interrotta dall'utente.",
  'dashboard.aio.abortedMiniBackendRestarted':
    'Esecuzione AIO interrotta. Mini-backend riavviato.',
  'dashboard.aio.abortedMiniBackendRestartFailed':
    'Esecuzione AIO interrotta. Impossibile riavviare automaticamente il mini-backend.',
  'dashboard.llm.customProfilesLoadFailed':
    'Impossibile caricare i profili LLM personalizzati.',
  'dashboard.status.ready': 'Pronto per elaborare le immagini.',
  'dashboard.workspace.pendingChanges': 'Il workspace ha modifiche in sospeso.',
  'dashboard.status.restored': 'Workspace ripristinato.',
  'dashboard.status.historyRestored': 'Modifica ripristinata dalla cronologia.',
  'dashboard.status.undo': 'Workspace annullato.',
  'dashboard.status.redo': 'Workspace ripristinato.',
  'dashboard.status.saved': 'Workspace salvato localmente.',
  'dashboard.status.exportCancelled': 'Esportazione workspace annullata.',
  'dashboard.status.exportSuccess': 'Workspace esportato correttamente.',
  'dashboard.status.importCancelled': 'Importazione workspace annullata.',
  'dashboard.status.importSuccess': 'Workspace importato correttamente.',
  'dashboard.status.importSaved': 'Workspace importato e salvato localmente.',
  'dashboard.status.importNoAutosave':
    'Workspace importato. Salvataggio automatico disabilitato.',
  'dashboard.status.autosaveRemoved': 'Salvataggio automatico locale rimosso.',
  'dashboard.status.nothingToUndo': 'Niente da annullare nel workspace.',
  'dashboard.status.nothingToRedo': 'Niente da ripristinare nel workspace.',
  'dashboard.sections.pipeline': 'Pipeline',
  'dashboard.sections.languages': 'Lingue',
  'dashboard.sections.modelsConfig': 'Modelli e configurazione',
  'dashboard.sections.presets': 'Preset',
  'dashboard.sections.region': 'Regione',
  'dashboard.aio.rewind': 'AIO indietro: fase "{label}" ({current}/{total}).',
  'dashboard.aio.forward': 'AIO avanti: fase "{label}" ({current}/{total}).',
  'dashboard.aio.rewindImage':
    'AIO indietro ({imageName}): fase "{label}" ({current}/{total}).',
  'dashboard.aio.forwardImage':
    'AIO avanti ({imageName}): fase "{label}" ({current}/{total}).',
  'dashboard.llm.translation': 'Traduzione',
  'dashboard.llm.ocr': 'OCR',
  'dashboard.aio.manualScope': 'AIO manuale',
  'dashboard.aio.autoScope': 'AIO automatico',
  'dashboard.aio.executing': 'In esecuzione',
  'dashboard.cleaner.selectProfile':
    'Seleziona un profilo visuale salvato da usare con la pulizia automatica IA.',
  'dashboard.cleaner.profileNotFound':
    'Profilo visuale non trovato. Ricarica e riprova.',
  'dashboard.cleaner.profileInUse':
    'Profilo visuale in uso per la pulizia automatica IA: {label}.',
  'dashboard.cleaner.invalidModel':
    'Seleziona un modello valido per la pulizia automatica IA.',
  'dashboard.cleaner.modelRoadmap':
    'Il modello "{name}" è ancora nella roadmap.',
  'dashboard.cleaner.modelConfigRequired':
    'Il modello "{name}" richiede configurazione prima dell\'uso.',
  'dashboard.translator.sfx.invalidModel':
    "Seleziona un modello valido per l'IA SFX del Traduttore.",
  'dashboard.cleaner.profileSaved':
    'Profilo visuale salvato e selezionato per la pulizia automatica IA: {label}.',
  'dashboard.cleaner.removeProfileSelect':
    'Seleziona un profilo visuale salvato da rimuovere.',
  'dashboard.cleaner.customTitle': 'IA personalizzata (Pulizia automatica IA)',
  'dashboard.cleaner.emptyLabel': 'Nuovo profilo visuale',
  'dashboard.cleaner.namePlaceholder': 'Es.: Gemini Image Clean',
  'dashboard.cleaner.modelPlaceholder': 'gemini-2.5-flash-image',
  'dashboard.cleaner.useLabel': 'Usa nel Cleaner',
  'dashboard.cleaner.providerInUse':
    'Provider {name} in uso per la pulizia automatica IA.',
  'dashboard.stage.detectText.label': 'Rileva testo',
  'dashboard.stage.detectText.short': 'Rileva',
  'dashboard.stage.recognizeText.label': 'Riconosci testo',
  'dashboard.stage.recognizeText.short': 'OCR',
  'dashboard.stage.getTranslations.label': 'Ottieni traduzioni',
  'dashboard.stage.getTranslations.short': 'Traduci',
  'dashboard.stage.segmentText.label': 'Segmenta testo',
  'dashboard.stage.segmentText.short': 'Segmenta',
  'dashboard.stage.cleanImage.label': 'Pulisci immagine',
  'dashboard.stage.cleanImage.short': 'Pulisci',
  'dashboard.stage.render.label': 'Renderizza',
  'dashboard.stage.render.short': 'Render',
  'dashboard.aio.pipeline.detect.subtitle':
    "Localizza le aree di testo nell'immagine",
  'dashboard.aio.pipeline.ocr.subtitle':
    'OCR per estrarre il contenuto testuale',
  'dashboard.aio.pipeline.translate.subtitle':
    'Traduzione automatica tramite servizio/modello',
  'dashboard.aio.pipeline.segment.subtitle':
    'Affina le regioni con segmentazione',
  'dashboard.aio.pipeline.clean.subtitle': 'Inpainting con AOT/LaMa + maschera',
  'dashboard.aio.pipeline.render.subtitle':
    "Applica il testo tradotto all'immagine finale",
  'dashboard.aio.config.langHint':
    'Origine → Rileva/OCR/Traduci. Traduzione → solo traduzione.',
  'dashboard.aio.translation.localModelInfo':
    'I modelli locali vengono scaricati su richiesta; i modelli cloud/API continuano a usare una chiave.',
  'dashboard.translator.sameModelHint':
    'Il Traduttore usa la stessa selezione di modello di AIO; riesegui dopo aver cambiato modello.',
  'dashboard.translator.incompatibleLocalModel':
    'Il modello locale attuale non supporta la coppia di lingue del Traduttore. Scegli un altro modello o usa il cloud.',
  'dashboard.status.modeChanged': 'Modalità: {mode}',
  'dashboard.status.underDevelopment': '{mode}: {tooltip}',
  'dashboard.aio.render.hintRot': 'Scorciatoia: ',
  'dashboard.aio.render.hintRotSuffix': ' per ruotare.',
  'settings.typographerLibrary.noFolder': 'Nessuna cartella',
  'settings.profile.defaultUser': 'Utente KŌMA',
  'register.email': 'Email',
  'register.emailPlaceholder': 'tu@email.com',
  'feed.sidebar.webhookPlaceholder': 'https://discord.com/api/webhooks/...',
  'feed.sidebar.webhookLabelShort': 'Webhook: ',
  'feed.moderation.scope.accountHwid': 'Account + HWID',
  'feed.moderation.scope.full': 'Completo',
  'feed.composer.label.scanlation': 'Scanlation',
  'feed.composer.availability.hoursPlaceholder': '10',
  'feed.composer.roles.valuePlaceholder': '50,00',
  'feed.apply.contactPlaceholder': 'Discord @nomeutente',
  'ranking.error.loadFailed': 'Impossibile caricare le classifiche.',
  'ranking.error.loadDetailFailed': 'Impossibile caricare i dettagli.',
  'ranking.error.saveReviewFailed': 'Impossibile salvare la recensione.',
  'ranking.error.deleteReviewFailed': 'Impossibile eliminare la recensione.',
  'ranking.error.emailVerificationRequired':
    'Conferma la tua email prima di pubblicare o modificare recensioni.',
  'dashboard.aio.translation.temperature': 'Temperatura',
  'dashboard.aio.translation.topP': 'Top P',
  'dashboard.aio.translation.maxTokens': 'Token massimi',
  'dashboard.aio.clean.hdStrategy': 'Strategia HD',
  'dashboard.aio.clean.hdStrategy.resize': 'Ridimensiona',
  'dashboard.aio.clean.hdStrategy.crop': 'Ritaglia',
  'dashboard.aio.clean.hdStrategy.original': 'Originale',
  'dashboard.aio.clean.hdStrategyHint':
    "Strategia per immagini grandi prima dell'inpainting.",
  'dashboard.aio.clean.resizeLimit': 'Limite ridimensionamento',
  'dashboard.aio.clean.cropMargin': 'Margine ritaglio',
  'dashboard.aio.clean.cropTriggerSize': 'Dimensione attivazione ritaglio',
  'dashboard.aio.clean.localHardware':
    'Hardware locale: {name} ({provider}{vram})',
  'dashboard.sidebar.workspace': 'Workspace',
  'dashboard.sidebar.hide': 'Nascondi barra laterale',
  'dashboard.sidebar.remaining': 'Rimanenti: {count}',
  'dashboard.sidebar.resizeAria': 'Ridimensiona barra laterale sinistra',
  'dashboard.sidebar.resizeTitle':
    'Trascina per ridimensionare. Doppio clic per ripristinare.',
  'dashboard.sidebar.files': 'File ({count})',
  'dashboard.sidebar.clearAll': 'Cancella tutto',
  'dashboard.sidebar.cleared': 'Elenco immagini cancellato.',
  'dashboard.sidebar.empty': 'Nessuna immagine',
  'dashboard.sidebar.rewindImage': 'Riporta indietro solo questa immagine',
  'dashboard.sidebar.forwardImage': 'Porta avanti solo questa immagine',
  'dashboard.sidebar.rotate90': 'Ruota di 90 gradi',
  'dashboard.sidebar.moveUp': 'Sposta su',
  'dashboard.sidebar.moveDown': 'Sposta giù',
  'dashboard.sidebar.remove': 'Rimuovi',
  'dashboard.sidebar.extracting': 'Estrazione immagini... attendere.',
  'dashboard.sidebar.dropHere': 'Rilascia qui...',
  'dashboard.sidebar.clickOrDrag': 'Trascina o clicca',
  'dashboard.sidebar.processingArchive': 'Elaborazione ZIP/PDF/CBZ/CB7/PSD...',
  'dashboard.sidebar.stats.title': 'Statistiche locali',
  'dashboard.sidebar.stats.badge': 'Attivo',
  'dashboard.sidebar.stats.daily': 'Oggi',
  'dashboard.sidebar.stats.weekly': 'Questa settimana',
  'dashboard.sidebar.stats.monthly': 'Questo mese',
  'dashboard.sidebar.stats.foot':
    'Attività locale recente. I contatori si azzerano automaticamente in base al periodo.',
  'dashboard.sidebar.stats.resetNow': 'Si azzera ora',
  'dashboard.sidebar.stats.resetInHoursMinutes':
    'Si azzera tra {hours}h {minutes}m',
  'dashboard.sidebar.stats.resetInHours': 'Si azzera tra {hours}h',
  'dashboard.sidebar.stats.resetInMinutes': 'Si azzera tra {minutes}m',
  'dashboard.sidebar.right.hide': 'Nascondi strumenti',
  'dashboard.sidebar.right.close': 'Chiudi pannello',
  'dashboard.sidebar.right.resizeAria': 'Ridimensiona barra laterale destra',
  'dashboard.sidebar.right.resizeTitle':
    'Trascina per ridimensionare. Doppio clic per ripristinare.',
  'dashboard.footer.runtime.downloaded': 'Pacchetto scaricato',
  'dashboard.footer.runtime.embedded': 'Core integrato',
  'dashboard.footer.runtime.fallback.title': 'Fallback attivo',
  'dashboard.footer.runtime.fallback.detail':
    '{requested} richiesto, {active} in uso.',
  'dashboard.footer.runtime.tensorrt.title': 'TensorRT attivo',
  'dashboard.footer.runtime.tensorrt.detail':
    'Accelerazione NVIDIA a prestazioni massime.',
  'dashboard.footer.runtime.cuda.title': 'CUDA attivo',
  'dashboard.footer.runtime.cuda.detail': 'GPU NVIDIA moderna in uso.',
  'dashboard.footer.runtime.legacy.label': 'Legacy',
  'dashboard.footer.runtime.legacy.title': 'CUDA Legacy attivo',
  'dashboard.footer.runtime.legacy.detail':
    'Profilo legacy per GPU NVIDIA più vecchie.',
  'dashboard.footer.runtime.openvino.title': 'OpenVINO attivo',
  'dashboard.footer.runtime.openvino.detail':
    'Accelerazione Intel dedicata in uso.',
  'dashboard.footer.runtime.cpu.title': 'CPU attivo',
  'dashboard.footer.runtime.cpu.detail':
    'Esecuzione locale senza accelerazione dedicata.',
  'dashboard.footer.workspace.saving': 'Salvataggio',
  'dashboard.footer.workspace.saved': 'Salvato',
  'dashboard.footer.workspace.error': 'Errore locale',
  'dashboard.footer.workspace.pending': 'In attesa',
  'dashboard.footer.workspace.title': 'Workspace locale',
  'dashboard.footer.runtime.source': 'Origine: {value}',
  'dashboard.footer.runtime.remoteAvailable': 'Pacchetto remoto disponibile.',
  'dashboard.footer.runtime.errorReason': 'Motivo: {value}',
  'dashboard.footer.bugReport.title': 'Segnala bug',
  'dashboard.footer.bugReport.desc':
    'Segnala bug con screenshot automatici e log.',
  'dashboard.footer.discord.aria': 'Unisciti a Discord',
  'dashboard.footer.discord.title': 'Community Discord',
  'dashboard.footer.discord.desc':
    'Unisciti alla community, suggerisci idee e condividi feedback.',
  'dashboard.footer.website.aria': 'Apri sito web del progetto',
  'dashboard.footer.website.title': 'Sito web del progetto',
  'dashboard.footer.website.desc':
    'Accedi a notizie, documentazione e risorse del progetto.',
  'bugReport.error.imgLoadFailed': "Impossibile caricare l'immagine.",
  'bugReport.error.canvasFailed': 'Elaborazione canvas non riuscita.',
  'modelManager.modal.title': 'Archivio modelli',
  'modelManager.modal.aioFallback': 'AIO',
  'modelCard.recommended': 'CONS',
  'modelCard.hardware.gpu': 'GPU',
  'modelCard.hardware.cpu': 'CPU',
  'modelCard.speed.ok': 'OK',
  'auth.toolkit.aiClean': 'Pulizia IA',
  'freeProviderCard.setup': 'Configurazione',
  'freeProviderCard.limits': 'Limiti',
  'freeProviderCard.rateLimits': 'Limiti di frequenza',
  'freeProviderCard.field.modelPlaceholder': 'ID modello (compatibile OpenAI)',
  'customProvider.profileType': 'Profilo IA personalizzato',
  'dashboard.cleaner.mode.assisted': 'Assistito',
  'dashboard.cleaner.mode.automaticAi': 'Pulizia automatica IA',
  'dashboard.cleaner.mode.aiSfx': 'IA SFX',
  'dashboard.cleaner.mode.assistedTitle':
    'Flusso strutturato con OCR, segmentazione e inpainting locale',
  'dashboard.cleaner.mode.automaticAiTitle':
    'Pulizia automatica con IA multimodale e ricostruzione guidata',
  'dashboard.cleaner.mode.aiSfxTitle':
    "Rileva e pulisce solo gli SFX approvati dall'IA",
  'dashboard.cleaner.mode.title': 'Modalità',
  'dashboard.cleaner.mode.hint':
    "La modalità attuale è stata mantenuta come flusso assistito. La nuova <strong>Pulizia automatica IA</strong> usa l'IA multimodale con regole rigide per preservare arte, contorni e fumetti.",
  'dashboard.cleaner.pipeline.title': 'Pipeline',
  'dashboard.cleaner.pipeline.hint':
    'Flusso assistito: OCR → Segmentazione → Pulizia locale. Ideale per chi desidera prevedibilità e possibilità di regolazione successiva.',
  'dashboard.cleaner.ocr.language': 'Lingua (OCR)',
  'dashboard.cleaner.ocr.languageAria': "Lingua di origine per l'OCR",
  'dashboard.cleaner.models.button': 'Modelli',
  'dashboard.cleaner.models.none': 'Nessun modello',
  'dashboard.cleaner.ocr.manageAria': 'Gestisci modelli OCR',
  'dashboard.cleaner.ocr.modelAria': 'Modello OCR',
  'dashboard.cleaner.segment.title': 'Segmenta',
  'dashboard.cleaner.segment.manageAria': 'Gestisci modelli di segmentazione',
  'dashboard.cleaner.segment.modelAria': 'Modello di segmentazione',
  'dashboard.cleaner.clean.title': 'Pulisci',
  'dashboard.cleaner.clean.manageAria': 'Gestisci modelli di pulizia',
  'dashboard.cleaner.clean.modelAria': 'Modello di pulizia',
  'dashboard.cleaner.settings.title': 'Pulizia',
  'dashboard.cleaner.settings.maskDilation': 'Dilatazione maschera',
  'dashboard.cleaner.settings.hdStrategy': 'Strategia HD',
  'dashboard.cleaner.settings.resizeLimit': 'Limite ridimensionamento',
  'dashboard.cleaner.settings.cropMargin': 'Margine ritaglio',
  'dashboard.cleaner.settings.cropTrigger': 'Attivazione ritaglio',
  'dashboard.cleaner.inspect.title': 'Ispezione',
  'dashboard.cleaner.inspect.ocrBlocks': 'Blocchi OCR',
  'dashboard.cleaner.inspect.segmented': 'Segmentati',
  'dashboard.cleaner.inspect.selection': 'Selezione',
  'dashboard.cleaner.inspect.none': 'nessuno',
  'dashboard.cleaner.inspect.ocr': 'OCR',
  'dashboard.cleaner.inspect.segments': 'Segmenti',
  'dashboard.cleaner.inspect.boxesCount': '{count} riquadro/i',
  'dashboard.cleaner.ai.sfxCleaner': 'Cleaner IA SFX',
  'dashboard.cleaner.ai.automaticClean': 'Pulizia automatica IA',
  'dashboard.cleaner.ai.sfxDesc':
    'Usa il rilevatore locale per proporre candidati, classifica quali regioni sono veri SFX e pulisce solo quelli approvati.',
  'dashboard.cleaner.ai.automaticDesc':
    "Usa il rilevamento strutturale del progetto per guidare l'IA, rafforza la preservazione di fumetti/arte e ricompone le immagini grandi con giunture più uniformi.",
  'dashboard.cleaner.ai.modelTitle': 'Modello IA',
  'dashboard.cleaner.ai.manageAria': 'Gestisci modelli {value}',
  'dashboard.cleaner.ai.modelAria': 'Modello {value}',
  'dashboard.cleaner.ai.noneAvailable': 'Nessun modello IA disponibile',
  'dashboard.cleaner.instructions.title': 'Istruzioni aggiuntive',
  'dashboard.cleaner.instructions.hintSfx':
    'Queste istruzioni vengono iniettate come contesto supplementare dopo le regole base di classificazione e pulizia SFX.',
  'dashboard.cleaner.instructions.hintAi':
    'Queste istruzioni vengono iniettate come contesto supplementare. Le regole principali del cleaner IA restano al di sopra di qualsiasi istruzione utente per preservare la logica di pulizia.',
  'dashboard.cleaner.stats.candidates': 'Candidati',
  'dashboard.cleaner.stats.sfxApproved': 'SFX appr.',
  'dashboard.cleaner.stats.redraw': 'Ridisegno',
  'dashboard.cleaner.action.processing': 'Elaborazione {value} {percent}%',
  'dashboard.cleaner.action.runAiSfx': 'Esegui Cleaner IA SFX',
  'dashboard.cleaner.action.runAutomatic': 'Esegui pulizia automatica IA',
  'dashboard.cleaner.action.runAssisted': 'Esegui Cleaner assistito',
  'dashboard.typography.circularText': 'Testo circolare',
  'dashboard.typography.activate': 'Attiva',
  'dashboard.typography.effect.aria': 'Effetto testo',
  'dashboard.typography.effect.title': 'Seleziona effetto testo',
  'dashboard.typography.effect.label': 'Effetto',
  'dashboard.typography.effect.none': 'Nessun effetto',
  'dashboard.typography.effect.panelTitle': 'Effetto testo',
  'dashboard.typography.effect.panelHint':
    'Preset nativi per dialogo, impatto e sfumatura.',
  'dashboard.typography.effect.searchPlaceholder': 'Cerca effetti...',
  'dashboard.typography.effect.intensity': 'Intensità',
  'dashboard.typography.effect.noResults': 'Nessun effetto trovato.',
  'dashboard.aio.customAi.titleTranslation':
    'Profili IA personalizzati (Traduzione)',
  'dashboard.aio.customAi.titleOcr': 'Profili IA personalizzati (OCR)',
  'dashboard.aio.customAi.newTranslation': 'Nuovo profilo traduzione',
  'dashboard.aio.customAi.newOcr': 'Nuovo profilo OCR',
  'dashboard.aio.customAi.placeholderTranslation':
    'Es.: OpenRouter Manga IT-IT',
  'dashboard.aio.customAi.placeholderOcr': 'Es.: Private Vision OCR',
  'dashboard.aio.customAi.modelPlaceholderTranslation': 'openai/gpt-4.1',
  'dashboard.aio.customAi.modelPlaceholderOcr': 'gpt-4.1-mini',
  'dashboard.aio.customAi.useTranslation': 'Usa traduzione',
  'dashboard.aio.customAi.useOcr': 'Usa OCR',
  'dashboard.aio.customAi.loading': 'Caricamento profili personalizzati...',
  'dashboard.aio.customAi.savedProfile': 'Profilo salvato',
  'dashboard.aio.customAi.apiBase': 'API Base',
  'dashboard.aio.customAi.ollamaPreset': 'Preset locale Ollama',
  'dashboard.aio.customAi.apiKey': 'Chiave API (opzionale)',
  'dashboard.aio.customAi.model': 'Modello',
  'dashboard.aio.customAi.clear': 'Cancella',
  'dashboard.aio.customAi.remove': 'Rimuovi',
  'dashboard.aio.customAi.save': 'Salva',
  'dashboard.emptyStage.title': 'Seleziona o carica immagini',
  'dashboard.emptyStage.desc':
    'Usa gli strumenti nella barra superiore per elaborare le tue pagine manhwa.',
  'dashboard.emptyStage.tipTitle': 'Suggerimento utile',
  'dashboard.emptyStage.tipMeta': 'Ciclo ogni 15 secondi',
  'dashboard.enhance.title': 'Migliora immagine',
  'dashboard.enhance.localHint':
    "Modelli ONNX sul mini-backend locale. Installa prima dell'elaborazione.",
  'dashboard.enhance.desktopRequiredHint':
    "Richiede l'app desktop con un mini-backend attivo.",
  'dashboard.enhance.scale': 'Scala',
  'dashboard.enhance.profile': 'Profilo',
  'dashboard.enhance.model': 'Modello',
  'dashboard.enhance.format': 'Formato',
  'dashboard.enhance.status.title': 'Modello',
  'dashboard.enhance.status.desktopRequired': 'Desktop richiesto',
  'dashboard.enhance.status.selectModel': 'Seleziona un modello',
  'dashboard.enhance.status.ready': 'Pronto',
  'dashboard.enhance.status.notImported': 'Non importato',
  'dashboard.enhance.status.notInstalled': 'Non installato',
  'dashboard.enhance.importHint':
    'Importazione ONNX manuale. Converti .pth con sisr2onnx.',
  'dashboard.enhance.action.manage': 'Gestisci',
  'dashboard.enhance.action.import': 'Importa',
  'dashboard.enhance.action.install': 'Installa',
  'dashboard.enhance.action.source': 'Origine',
  'dashboard.enhance.selectAboveHint': 'Seleziona un modello sopra.',
  'dashboard.enhance.action.processing': 'Miglioramento in corso...',
  'dashboard.enhance.action.run': 'Migliora immagini',
  'dashboard.info.optimizer.desc1':
    'Ottimizza il batch finale con preset per web, lettura o archiviazione usando gli output già generati nella dashboard.',
  'dashboard.info.optimizer.desc2':
    "L'utilità mostra il risparmio per pagina ed esporta come ZIP o cartella locale.",
  'dashboard.info.blogger.desc1':
    'Usa questa utilità per pubblicare su Blogger e generare URL di immagini ospitate.',
  'dashboard.info.blogger.desc2':
    "Le credenziali e l'ottimizzatore sono in Impostazioni > Integrazioni > Blogger CDN.",
  'dashboard.info.imgur.desc1':
    'Usa questa utilità per upload anonimi su Imgur con rotazione casuale del Client ID.',
  'dashboard.info.imgur.desc2':
    'Chiavi, limitatore e guida completa sono in Impostazioni > Integrazioni > Upload Imgur.',
  'dashboard.info.guides.desc1':
    'Seleziona una guida nel pannello centrale per leggere le istruzioni dettagliate.',
  'dashboard.info.guides.desc2':
    'Ogni guida contiene esempi pratici e suggerimenti per la produttività.',
  'dashboard.info.resources.desc1':
    'Esplora risorse e materiali utili per il tuo flusso di lavoro di scanlation.',
  'dashboard.info.resources.desc2': 'Font, template, dizionari e altro.',
  'dashboard.render.noRecognizedText': 'Nessun testo riconosciuto',
  'dashboard.render.noTranslation': 'Nessuna traduzione disponibile',
  'dashboard.render.noNotes': 'Nessuna TN disponibile',
  'dashboard.render.noteLabel': 'TN:',
  'dashboard.render.textLabel': 'Testo',
  'dashboard.render.aaLabel': 'AA',
  'dashboard.render.skewXLabel': 'Sx',
  'dashboard.render.skewYLabel': 'Sy',
  'renderPreview.context.title': 'Azioni regione',
  'renderPreview.context.copyRecognized': 'Copia riconosciuto',
  'renderPreview.context.copyTranslated': 'Copia traduzione',
  'renderPreview.context.editRendered': 'Modifica renderizzato',
  'renderPreview.context.editRenderedHint': 'Modifica testo renderizzato',
  'renderPreview.context.manualModeHint': 'Richiede la modalità manuale',
  'renderPreview.shape': 'Forma',
  'renderPreview.rectangular': 'Rettangolare',
  'renderPreview.elliptic': 'Ellittica',
  'renderPreview.convertRectangular': 'Converti in forma rettangolare',
  'renderPreview.convertElliptic': 'Converti in forma ellittica',
  'renderPreview.manualModeRequired': 'Richiede la modalità manuale',
  'renderPreview.applyTypographyPreset': 'Applica preset tipografico',
  'renderPreview.preset': 'Preset',
  'renderPreview.typographyPresets': 'Preset tipografici',
  'renderPreview.applyPreset': 'Applica preset',
  'renderPreview.removeRegion': 'Rimuovi selezione',
  'renderPreview.textFont': 'Font testo',
  'renderPreview.selectionShape': 'Forma selezione',
  'renderPreview.fontSize': 'Dimensione font',
  'renderPreview.decreaseFont': 'Riduci font',
  'renderPreview.increaseFont': 'Aumenta font',
  'renderPreview.alignment': 'Allineamento',
  'renderPreview.alignLeft': 'Allinea a sinistra',
  'renderPreview.alignCenter': 'Centra',
  'renderPreview.alignRight': 'Allinea a destra',
  'renderPreview.typographyStyle': 'Stile tipografico',
  'renderPreview.bold': 'Grassetto',
  'renderPreview.italic': 'Corsivo',
  'renderPreview.underline': 'Sottolineato',
  'renderPreview.uppercase': 'Maiuscolo',
  'renderPreview.textOrientation': 'Orientamento testo',
  'renderPreview.horizontal': 'Orizzontale',
  'renderPreview.vertical': 'Verticale',
  'renderPreview.circular': 'Circolare',
  'renderPreview.rotation': 'Rotazione',
  'renderPreview.rotateMinus5': 'Ruota -5°',
  'renderPreview.rotatePlus5': 'Ruota +5°',
  'renderPreview.skewX': 'Inclinazione X',
  'renderPreview.skewXMinus2': 'Inclinazione X -2°',
  'renderPreview.skewXPlus2': 'Inclinazione X +2°',
  'renderPreview.skewY': 'Inclinazione Y',
  'renderPreview.skewYMinus2': 'Inclinazione Y -2°',
  'renderPreview.skewYPlus2': 'Inclinazione Y +2°',
  'renderPreview.adjustments': 'Regolazioni',
  'renderPreview.refine': 'Affina',
  'renderPreview.autoFontSize': 'Dimensione font automatica',
  'renderPreview.autoFit': 'Adattamento automatico',
  'renderPreview.fixed': 'Fisso',
  'renderPreview.hyphenation': 'Sillabazione',
  'renderPreview.enabled': 'Attiva',
  'renderPreview.disabled': 'Disattiva',
  'renderPreview.maxSize': 'Dimensione massima',
  'renderPreview.minSize': 'Dimensione minima',
  'renderPreview.lineSpacing': 'Interlinea',
  'renderPreview.opacity': 'Opacità',
  'renderPreview.fill': 'Riempimento',
  'renderPreview.outline': 'Contorno',
  'renderPreview.shadow': 'Ombra',
  'renderPreview.shadowLayers': 'Livelli ombra',
  'renderPreview.addLayer': 'Aggiungi livello',
  'renderPreview.layerN': 'Livello {count}',
  'renderPreview.removeLayerN': 'Rimuovi livello {count}',
  'renderPreview.shadowLayerN': 'Livello ombra {count}',
  'renderPreview.blur': 'Sfocatura',
  'renderPreview.offsetX': 'Offset X',
  'renderPreview.offsetY': 'Offset Y',
  'renderPreview.radius': 'Raggio',
  'renderPreview.startAngle': 'Angolo iniziale',
  'renderPreview.spacing': 'Spaziatura',
  'renderPreview.shadowLayersCount': '{count} livello/i',
  'renderPreview.shadowBlurSummary': 'sfocatura {value}',
  'renderPreview.history.none': 'Nessuno storico AIO per questa immagine',
  'renderPreview.box.clickToEdit': 'doppio clic per modificare',
  'renderPreview.box.renderNotApplied': 'render non applicato in questa fase',
  'renderPreview.editor.placeholder': 'Digita il testo finale...',
  'renderPreview.editor.aria': 'Modifica testo renderizzato',
  'splitter.strategy.smart': 'Smart automatico',
  'splitter.strategy.smartHint': 'Spazi bianchi + euristiche.',
  'splitter.strategy.advancedDesktop': 'Semi Desktop',
  'splitter.strategy.advancedDesktopHint': 'Analisi locale avanzata.',
  'splitter.strategy.manual': 'Manuale',
  'splitter.strategy.manualHint': 'Solo regolazioni manuali.',
  'splitter.strategy.fixedHeight': 'Altezza fissa',
  'splitter.strategy.fixedHeightHint': 'Segmenta per altezza.',
  'splitter.strategy.count': 'N parti',
  'splitter.strategy.countHint': 'Divisione uguale.',
  'dashboard.aio.autoScopeTitle': 'Elaborazione automatica senza intervento',
  'dashboard.aio.manualScopeTitle': 'Controllo manuale di ogni fase',
  'detectionPreview.recognized': 'Riconosciuto:',
  'detectionPreview.translated': 'Tradotto:',
  'detectionPreview.note': 'TN:',
  'detectionPreview.manual': 'Manuale',
  'detectionPreview.removeSelection': 'Rimuovi selezione',
  'detectionPreview.actions': 'Azioni regione',
  'detectionPreview.text': 'Testo',
  'detectionPreview.copyRecognized': 'Copia riconosciuto',
  'detectionPreview.editRecognized': 'Modifica riconosciuto',
  'detectionPreview.manualModeOnly': 'Disponibile solo in modalità manuale',
  'detectionPreview.copyTranslated': 'Copia traduzione',
  'detectionPreview.editTranslated': 'Modifica traduzione',
  'detectionPreview.removeRegion': 'Rimuovi regione',
  'detectionPreview.editRecognizedTitle': 'Modifica testo riconosciuto',
  'detectionPreview.editTranslatedTitle': 'Modifica testo tradotto',
  'detectionPreview.placeholderRecognized': 'Digita il testo riconosciuto...',
  'detectionPreview.placeholderTranslated': 'Digita la traduzione...',
  'detectionPreview.rewind': 'Riporta indietro questa immagine',
  'detectionPreview.forward': 'Porta avanti questa immagine',
  'detectionPreview.noHistory': 'Nessuno storico AIO per questa immagine',
  'dashboard.translator.workspace.aria': 'Modalità traduttore',
  'dashboard.translator.workspace.textTitle': 'Traduci testo libero',
  'dashboard.translator.workspace.text': 'Testo',
  'dashboard.translator.workspace.visualTitle':
    'Rileva e traduci nelle immagini',
  'dashboard.translator.workspace.visual': 'Visuale',
  'watermark.header.eyebrow': 'Utilità editoriale',
  'watermark.header.title': 'Filigrana',
  'watermark.header.badge': 'Batch',
  'watermark.panel.presets': 'Preset',
  'watermark.presets.builtin': 'Integrati',
  'watermark.presets.user': 'Salvati',
  'watermark.action.save': 'Salva',
  'watermark.action.duplicate': 'Duplica',
  'watermark.panel.text': 'Testo',
  'watermark.text.enable': 'Abilita testo',
  'watermark.text.content': 'Contenuto',
  'watermark.text.font': 'Font',
  'watermark.text.size': 'Dimensione',
  'watermark.text.color': 'Colore',
  'watermark.text.outline': 'Contorno',
  'watermark.text.outlineColor': 'Colore contorno',
  'watermark.text.opacity': 'Opacità',
  'watermark.panel.logo': 'Logo',
  'watermark.logo.enable': 'Abilita',
  'watermark.logo.change': 'Cambia',
  'watermark.logo.upload': 'Carica',
  'watermark.logo.remove': 'Rimuovi',
  'watermark.logo.scale': 'Scala %',
  'watermark.logo.opacity': 'Opacità',
  'watermark.logo.brightness': 'Luminosità',
  'watermark.logo.saturation': 'Saturazione',
  'watermark.panel.distribution': 'Distribuzione',
  'watermark.distribution.position': 'Posizione',
  'watermark.distribution.rotation': 'Rotazione',
  'watermark.distribution.blend': 'Fusione',
  'watermark.distribution.gapX': 'Gap X',
  'watermark.distribution.gapY': 'Gap Y',
  'watermark.distribution.padding': 'Padding',
  'watermark.distribution.baseName': 'Nome base',
  'watermark.distribution.smartPlacement': 'Posizionamento intelligente',
  'watermark.action.applying': 'Applicazione...',
  'watermark.action.applyBatch': 'Applica batch',
  'watermark.status.cancelRequested': 'Annullamento richiesto.',
  'watermark.action.cancel': 'Annulla',
  'watermark.panel.preview': 'Anteprima',
  'watermark.preview.compare': 'Confronta',
  'watermark.preview.mode': 'Anteprima',
  'watermark.preview.empty.title': 'Nessuna immagine',
  'watermark.preview.empty.desc':
    'Importa le pagine nel pannello sinistro della dashboard.',
  'watermark.preview.noLayer.title': 'Configura un livello',
  'watermark.preview.noLayer.desc':
    "Abilita testo o logo nella toolbox per generare l'anteprima.",
  'watermark.preview.original': 'Originale',
  'watermark.preview.watermark': 'Filigrana',
  'watermark.preview.compareAria': 'Confronto prima/dopo',
  'watermark.preview.generating': 'Generazione...',
  'watermark.panel.output': 'Output',
  'watermark.output.empty.title': 'Nessun risultato',
  'watermark.output.empty.desc': 'Applica il batch per generare i download.',
  'watermark.action.zip': 'ZIP',
  'watermark.action.folder': 'Cartella',
  'watermark.action.download': 'Scarica',
  'imgur.hero.eyebrow': 'Upload Imgur',
  'imgur.hero.title': 'Hosting anonimo',
  'imgur.hero.desc':
    'Usa questa utilità per upload rapidi su Imgur con rotazione casuale del Client ID.',
  'imgur.status.remaining': 'Rimanenti: {remaining}',
  'imgur.status.configure': 'Configura',
  'imgur.alert.missingConfig': 'Configurazione mancante',
  'imgur.alert.addActiveClient':
    'Aggiungi almeno un Client ID attivo in Impostazioni > Integrazioni.',
  'imgur.batch.title': 'Upload batch',
  'imgur.batch.limit': "Limite di {limit} upload all'ora (Usati: {used})",
  'imgur.dropzone.title': 'Trascina le immagini qui',
  'imgur.dropzone.desc': 'Trascina più file JPG, PNG o WEBP.',
  'imgur.toggle.imgOutput': 'Output come tag <img>',
  'imgur.toggle.imgOutputDesc':
    "Genera codice HTML pronto all'uso per blog e forum.",
  'imgur.actions.select': 'Seleziona',
  'imgur.actions.sending': 'Invio in corso...',
  'imgur.actions.send': 'Invia',
  'imgur.actions.copy': 'Copia URL',
  'imgur.queue.title': 'Coda upload',
  'imgur.queue.items_one': '{count} elemento',
  'imgur.queue.items_other': '{count} elementi',
  'imgur.queue.empty': 'La coda è vuota. Aggiungi immagini sopra.',
  'imgur.queue.altPlaceholder': 'Testo alternativo',
  'imgur.queue.urlLabel': 'URL',
  'imgur.queue.keyLabel': 'Chiave',
  'imgur.queue.remove': 'Rimuovi',
  'imgur.error.configLoad': 'Impossibile caricare la configurazione Imgur.',
  'imgur.error.uploadFailed': 'Upload immagine non riuscito.',
  'imgur.feedback.singleSuccess': 'Upload completato correttamente.',
  'imgur.feedback.multiSuccess': 'Upload di {count} immagini completato.',
  'ranking.metric.overall': 'Punteggio complessivo',
  'ranking.metric.quality': 'Qualità',
  'ranking.metric.speed': 'Velocità',
  'ranking.metric.costBenefit': 'Rapporto qualità-prezzo',
  'ranking.metric.easeOfUse': "Facilità d'uso",
  'ranking.trend.neutral': 'Neutro',
  'ranking.trend.points': 'pt',
  'ranking.table.title': 'Classifica',
  'ranking.table.sortedBy': 'Ordinata per {metric} ponderato.',
  'ranking.table.modelsCount': '{count} modelli classificati',
  'ranking.table.empty': 'Nessun modello corrisponde ai filtri attuali.',
  'ranking.table.newLabel': 'Nuovo',
  'ranking.table.reviewsCount': '{count} recensioni',
  'ranking.table.reviewedByYou': 'Hai già recensito',
  'ranking.table.viewDetails': 'Vedi dettagli',
  'ranking.filters.metricAria': 'Metrica classifica',
  'ranking.filters.searchPlaceholder': 'Cerca modello...',
  'ranking.filters.searchAria': 'Cerca modello',
  'ranking.filters.advancedAria': 'Mostra filtri avanzati',
  'ranking.filters.button': 'Filtri',
  'ranking.filters.stageLabel': 'Fase',
  'ranking.filters.sourceLabel': 'Origine',
  'ranking.filters.languageLabel': 'Lingua',
  'ranking.filters.minReviewsLabel': 'Recensioni min.',
  'ranking.filters.allStages': 'Tutte le fasi',
  'ranking.filters.allSources': 'Locale + Cloud',
  'ranking.filters.onlyLocal': 'Solo locale',
  'ranking.filters.onlyCloud': 'Solo cloud',
  'ranking.filters.allLanguages': 'Tutte le lingue',
  'ranking.filters.reviews_one': '{count} recensione',
  'ranking.filters.reviews_other': '{count} recensioni',
  'ranking.composer.usage.balanced': 'Bilanciato',
  'ranking.composer.usage.qualityFirst': 'Prima la qualità',
  'ranking.composer.usage.speedFirst': 'Prima la velocità',
  'ranking.composer.usage.lowVram': 'VRAM limitata',
  'ranking.composer.usage.offlineLocal': 'Pipeline locale',
  'ranking.composer.usage.cloudPipeline': 'Pipeline cloud',
  'ranking.composer.title.edit': 'Modifica recensione',
  'ranking.composer.title.new': 'Nuova recensione',
  'ranking.composer.action.close': 'Chiudi',
  'ranking.composer.field.title': 'Titolo',
  'ranking.composer.field.titlePlaceholder':
    'Es.: Miglior OCR locale per manga',
  'ranking.composer.field.context': 'Contesto',
  'ranking.composer.field.sourceLang': 'Lingua di origine',
  'ranking.composer.field.sourceLangPlaceholder': 'ja, en, it...',
  'ranking.composer.field.targetLang': 'Lingua di destinazione',
  'ranking.composer.field.targetLangPlaceholder': 'it, en, pt-br...',
  'ranking.composer.field.device': 'Dispositivo',
  'ranking.composer.device.none': 'Non specificato',
  'ranking.composer.field.comment': 'Commento',
  'ranking.composer.field.commentPlaceholder':
    "Descrivi la qualità complessiva, la stabilità, l'uso delle risorse e dove questo modello offre il maggior valore.",
  'ranking.composer.action.reset': 'Reimposta',
  'ranking.composer.action.delete': 'Elimina',
  'ranking.composer.action.save': 'Salva',
  'ranking.composer.action.publish': 'Pubblica',
  'dashboard.specialMode.visualEmpty.title': 'Traduttore visuale',
  'dashboard.specialMode.visualEmpty.description':
    "Importa immagini per iniziare a tradurre direttamente nell'anteprima.",
  'dashboard.specialMode.visualEmpty.cta': 'Seleziona immagini',
  'dashboard.reviewRaw.raw.title': 'Revisione raw',
  'dashboard.reviewRaw.raw.description':
    'Analizza la qualità delle immagini originali e prepara il batch per la pipeline.',
  'dashboard.reviewRaw.raw.note':
    "La validazione raw aiuta l'IA a comprendere meglio il contesto visivo prima dell'OCR.",
  'dashboard.reviewRaw.raw.statusReady':
    'Batch di {count} immagini pronto per la validazione.',
  'dashboard.reviewRaw.raw.validate': 'Valida raw',
  'dashboard.reviewRaw.qc.title': 'Controllo qualità',
  'dashboard.reviewRaw.qc.descriptionAuto':
    'Il QC automatico usa modelli leggeri per rilevare errori di editing comuni.',
  'dashboard.reviewRaw.qc.descriptionManual':
    'La modalità manuale consente una revisione dettagliata di ogni fumetto e ridisegno.',
  'dashboard.reviewRaw.qc.note':
    "Abilita i controlli sottostanti per eseguire l'analisi batch.",
  'dashboard.reviewRaw.qc.automaticChecks': 'Controlli automatici',
  'dashboard.reviewRaw.qc.checks.untranslatedText': 'Testo non tradotto',
  'dashboard.reviewRaw.qc.checks.emptyBubbles': 'Fumetti vuoti',
  'dashboard.reviewRaw.qc.checks.visualArtifacts': 'Artefatti visivi',
  'dashboard.reviewRaw.qc.checks.textAlignment': 'Allineamento testo',
  'dashboard.reviewRaw.qc.checks.fontConsistency': 'Coerenza font',
  'dashboard.reviewRaw.qc.inProgress': 'Analisi QC in corso...',
  'dashboard.reviewRaw.qc.run': 'Esegui QC',
  'common.cancel': 'Annulla',
  'common.save': 'Salva',
  'common.name': 'Nome',
  'common.newName': 'Nuovo nome',
  'common.removed': 'Rimosso',
  'common.renamed': 'Rinominato',
  'common.duplicated': 'Duplicato',
  'common.saved': 'Salvato',
  'common.failed': 'Non riuscito',
  'common.cancelled': 'Annullato',
  'common.status': 'Stato',
  'common.configured': 'Configurato',
  'common.no': 'No',
  'common.account': 'Account',
  'common.format': 'Formato',
  'common.exportedCount': 'Esportati: {count} elementi.',
  'modelManager.modal.verified': 'Verificato il',
  'modelManager.modal.upToDate': 'Aggiornato',
  'modelManager.modal.closeAria': 'Chiudi finestra',
  'modelManager.modal.localModels': 'Catalogo locale',
  'modelManager.modal.localDesc':
    'Installazione su richiesta con verifica di integrità.',
  'modelManager.modal.noLocal': 'Nessun modello locale corrisponde ai filtri.',
  'modelManager.modal.cloudModels': 'Catalogo cloud',
  'modelManager.modal.cloudDesc':
    'Modelli basati su API/Cloud. Richiedono connessione e chiavi proprie.',
  'modelManager.modal.hideCustom': 'Nascondi personalizzati',
  'modelManager.modal.addCustom': 'Aggiungi personalizzato',
  'modelManager.modal.noCloud': 'Nessun modello cloud corrisponde ai filtri.',
  'modelManager.modal.checking': 'Verifica in corso...',
  'modelManager.modal.checkUpdates': 'Controlla aggiornamenti',
  'modelManager.modal.installAll': 'Installa consigliati',
  'modelManager.modal.cancel': 'Annulla',
  'modelManager.modal.noEligible': 'Nessun modello idoneo trovato.',
  'modelManager.modal.notEnoughSpace':
    'Spazio insufficiente (necessari {space}).',
  'resources.breadcrumb.home': 'Risorse',
  'resources.communities.title': 'Community e link',
  'resources.back': 'Torna alle risorse',
  'resources.communities.desc':
    'Community di scanlation attive, Discord, forum e risorse per networking e apprendimento.',
  'resources.platform.discord': 'Discord',
  'resources.platform.forum': 'Forum',
  'resources.platform.reddit': 'Reddit',
  'resources.platform.website': 'Sito web',
  'resources.communities.members': '{count} membri',
  'resources.action.visit': 'Visita',
  'resources.externalTools.title': 'Strumenti esterni',
  'resources.externalTools.desc':
    'Software e app consigliati che integrano KŌMA Studio nel tuo flusso di lavoro di scanlation.',
  'resources.category.editing': 'Editing',
  'resources.category.ocr': 'OCR',
  'resources.category.translation': 'Traduzione',
  'resources.category.fonts': 'Font',
  'resources.category.hosting': 'Hosting',
  'resources.category.utility': 'Utilità',
  'resources.action.open': 'Apri',
  'resources.action.download': 'Scarica',
  'resources.status.free': 'Gratuito',
  'resources.status.paid': 'A pagamento',
  'resources.fonts.title': 'Font per impaginazione',
  'resources.fonts.desc':
    'Collezione curata di font popolari per scanlation. Include font per dialoghi, narrazione, enfasi, SFX e testo CJK.',
  'resources.fonts.searchPlaceholder': 'Cerca font per nome, uso o tag...',
  'resources.fonts.noResults': 'Nessun font trovato per "{search}"',
  'resources.license.free': 'Gratuito',
  'resources.license.openSource': 'Open Source',
  'resources.license.commercial': 'Commerciale',
  'resources.license.mixed': 'Mista',
  'resources.glossary.title': 'Glossario scanlation',
  'resources.glossary.desc':
    'Termini tecnici, gergo della community e vocabolario essenziale per la scanlation di manga, manhwa e manhua.',
  'resources.glossary.searchPlaceholder': 'Cerca termini...',
  'resources.glossary.noResults': 'Nessun termine trovato per "{search}"',
  'resources.glossary.related': 'Correlati:',
  'resources.category.general': 'Generale',
  'resources.category.typesetting': 'Impaginazione',
  'resources.category.cleaning': 'Pulizia',
  'resources.category.technical': 'Tecnico',
  'resources.category.roles': 'Ruoli',
  'resources.sfx.title': 'Libreria SFX',
  'resources.sfx.desc':
    'Libreria di effetti sonori giapponesi con traduzioni, pronuncia romaji ed esempi di utilizzo nei manga.',
  'resources.sfx.searchPlaceholder':
    'Cerca per giapponese, romaji o italiano...',
  'resources.sfx.noResults': 'Nessun SFX trovato.',
  'resources.sfx.commonIn': 'Comune in: {value}',
  'resources.category.impact': 'Impatto',
  'resources.category.emotion': 'Emozione',
  'resources.category.ambient': 'Ambientale',
  'resources.category.action': 'Azione',
  'resources.category.voice': 'Voce',
  'resources.category.misc': 'Varie',
  'resources.filters.all': 'Tutti ({count})',
  'resources.page.tab.fonts': 'Font',
  'resources.page.tab.sfx': 'Libreria SFX',
  'resources.page.tab.glossary': 'Glossario',
  'resources.page.tab.communities': 'Community',
  'resources.page.tab.tools': 'Strumenti',
  'resources.page.title.main': 'Centro ',
  'resources.page.title.accent': 'risorse',
  'resources.page.subtitle':
    'Materiali curati, community e strumenti per il tuo flusso di lavoro.',
  'resources.page.searchPlaceholder': 'Cerca in tutte le categorie...',
  'resources.page.searchAria': 'Campo di ricerca risorse',
  'resources.page.clearSearch': 'Cancella ricerca',
  'resources.page.tabsAria': 'Categorie risorse',
  'resources.category.fonts.label': 'Font per impaginazione',
  'resources.category.fonts.description':
    'Collezione curata di font popolari per la scanlation di manga, manhwa e manhua.',
  'resources.category.sfx-library.label': 'Libreria SFX',
  'resources.category.sfx-library.description':
    "Libreria di onomatopee giapponesi con traduzioni ed esempi d'uso.",
  'resources.category.glossary.label': 'Glossario scanlation',
  'resources.category.glossary.description':
    'Termini tecnici e gergo della community dal mondo della scanlation.',
  'resources.category.communities.label': 'Community',
  'resources.category.communities.description':
    'Server Discord, subreddit e forum di scanlation.',
  'resources.category.tools-external.label': 'Strumenti esterni',
  'resources.category.tools-external.description':
    'Software complementari e strumenti online utili.',
  'resources.home.title': 'Centro risorse',
  'resources.home.subtitle':
    'Materiali curati, community e strumenti per il tuo flusso di lavoro.',
  'resources.home.itemCount': '{count} elementi',
  'dashboard.aio.result.regionsDetected': '{count} regione/i rilevata/e',
  'dashboard.aio.result.textsRecognized': '{count} testo/i riconosciuto/i',
  'dashboard.aio.result.translationsGenerated':
    '{count} traduzione/i generata/e',
  'dashboard.aio.result.regionsSegmented': '{count} regione/i segmentata/e',
  'dashboard.aio.result.imagesCleaned': '{count} immagine/i pulita/e',
  'dashboard.aio.result.blocksReady':
    '{count} blocco/i pronto/i per il rendering',
  'dashboard.aio.result.finished': 'AIO completato. {parts}.',
  'resources.glossary.category.general': 'Generale',
  'resources.glossary.category.typesetting': 'Impaginazione',
  'resources.glossary.category.cleaning': 'Pulizia',
  'resources.glossary.category.translation': 'Traduzione',
  'resources.glossary.category.technical': 'Tecnico',
  'resources.glossary.category.roles': 'Ruoli',
  'resources.glossary.filterAll': 'Tutti',
  'resources.glossary.results_one': 'termine trovato',
  'resources.glossary.results_other': 'termini trovati',
  'resources.glossary.context': 'Glossario',
  'resources.glossary.alphaAria': 'Navigazione alfabetica',
  'resources.glossary.alphaBtnAria': 'Vai alla lettera {letter}',
  'dashboard.aio.config.sourceLanguage':
    'Lingua di origine (Rileva/OCR/Traduci)',
  'dashboard.aio.config.targetLanguage': 'Lingua di traduzione',
  'dashboard.aio.pipeline.rewind': 'Riavvolgi pipeline',
  'dashboard.aio.pipeline.forward': 'Avanza pipeline',
  'dashboard.aio.pipeline.snapshot': 'Snapshot: ',
  'dashboard.aio.pipeline.image': 'Immagine: ',
  'dashboard.aio.pipeline.stage': 'Fase: ',
  'dashboard.aio.translation.noneSelected': 'Nessun modello selezionato.',
  'dashboard.aio.translation.selected': 'Selezionato: ',
  'dashboard.aio.render.hint':
    'I controlli di font/colore/allineamento sono nel dock contestuale sovrapposto. Scorciatoia: Shift + Scroll per ruotare.',
  'dashboard.aio.render.warning':
    "L'immagine è a una fase precedente al Render. Usa Avanti per visualizzarla.",
  'dashboard.aio.render.disabled':
    'Abilita la fase Render nella pipeline per configurare.',
  'dashboard.stitch.lastToNext': 'Ultima immagine inviata al batch successivo.',
  'dashboard.stitch.firstFromNext':
    'Prima immagine del batch successivo aggiunta al batch corrente.',
  'dashboard.stitch.resetPlanning':
    'Pianificazione Stitcher ricalcolata automaticamente.',
  'dashboard.aio.customAi.syncing': 'IA personalizzata (sincronizzazione...)',
  'dashboard.aio.customOcr.syncing': 'OCR personalizzato (sincronizzazione...)',
  'dashboard.aio.customOcr.useCase':
    'Profilo OCR personalizzato in attesa di sincronizzazione locale.',
  'dashboard.aio.customAi.useCase':
    'Profilo personalizzato in attesa di sincronizzazione locale.',
  'dashboard.aio.config.languageHint':
    'La lingua di origine viene usata nelle fasi Rileva, Riconosci e Traduci. La lingua di traduzione si applica solo alla traduzione.',
  'dashboard.aio.presets.title': 'Preset AIO per lingua',
  'dashboard.aio.presets.currentLanguage': 'Lingua attuale:',
  'dashboard.aio.presets.noneActive': 'Nessun preset attivo',
  'dashboard.aio.presets.activeSuffix': '(attivo)',
  'dashboard.aio.presets.new': 'Nuovo',
  'dashboard.aio.presets.edit': 'Modifica',
  'dashboard.aio.presets.delete': 'Elimina',
  'dashboard.aio.presets.saveCurrent': 'Salva attuale',
  'dashboard.aio.presets.openSettings': 'Apri preset nelle impostazioni',
  'dashboard.aio.presets.presetName': 'Nome preset',
  'dashboard.aio.presets.namePlaceholder': 'Es.: OCR JP veloce',
  'dashboard.aio.presets.description': 'Descrizione',
  'dashboard.aio.presets.optional': 'Opzionale',
  'dashboard.aio.presets.setActiveFor': 'Imposta come preset attivo per',
  'dashboard.aio.presets.cancel': 'Annulla',
  'dashboard.aio.presets.update': 'Aggiorna preset',
  'dashboard.aio.presets.create': 'Crea preset',
  'dashboard.aio.translation.selectedSummaryModel':
    'Selezionato: {name}',
  'dashboard.aio.translation.selectedSummaryCustom':
    'Selezionato: {name} (Provider personalizzato/FREE)',
  'dashboard.aio.translation.selectedSummaryLegacy':
    'Selezionato: {name} (Cloud/API/AI)',
  'dashboard.aio.translation.selectedSummaryEmpty':
    'Seleziona un modello locale o cloud per tradurre in AIO.',
  'dashboard.aio.translation.supportSummary':
    'I modelli locali vengono scaricati su richiesta; i modelli cloud/API restano disponibili tramite chiave.',
  'dashboard.aio.translation.additionalContextPlaceholder': 'Contesto aggiuntivo per la traduzione cloud...',
  'dashboard.aio.translation.notesToggle':
    'Genera e mostra le TN separatamente dalla traduzione',
  'dashboard.aio.translation.neighborContextToggle':
    'Usa il contesto delle immagini adiacenti nel batch',
  'dashboard.aio.translation.multimodalToggle':
    "Invia l'immagine della pagina come contesto multimodale",
  'dashboard.aio.translation.activeConfigFor':
    'Configurazione attiva per: {value}.',
  'dashboard.aio.customAi.title': 'IA personalizzata',
  'dashboard.aio.customAi.loadingProfiles':
    'Caricamento profili personalizzati...',
  'dashboard.aio.customAi.savedTranslationProfile':
    'Profilo traduzione salvato',
  'dashboard.aio.customAi.newTranslationProfile': 'Nuovo profilo traduzione',
  'dashboard.aio.customAi.name': 'Nome',
  'dashboard.aio.customAi.translationNamePlaceholder':
    'Es.: OpenRouter Manga IT-IT',
  'dashboard.aio.customAi.apiBasePlaceholder': 'https://api.example.com/v1',
  'dashboard.aio.customAi.useLocalOllama': 'Preset locale Ollama',
  'dashboard.aio.customAi.apiKeyOptional': 'Chiave API (opzionale)',
  'dashboard.aio.customAi.apiKeyPlaceholder': 'sk-...',
  'dashboard.aio.customAi.translationModelPlaceholder': 'openai/gpt-4.1...',
  'dashboard.aio.customAi.resetTranslation': 'Cancella traduzione',
  'dashboard.aio.customAi.useSavedTranslation': 'Usa traduzione',
  'dashboard.aio.customAi.removeTranslation': 'Rimuovi traduzione',
  'dashboard.aio.customAi.saveTranslation': 'Salva traduzione',
  'dashboard.aio.customAi.savedOcrProfile': 'Profilo OCR salvato',
  'dashboard.aio.customAi.newOcrProfile': 'Nuovo profilo OCR',
  'dashboard.aio.customAi.ocrNamePlaceholder': 'Es.: Private Vision OCR',
  'dashboard.aio.customAi.ocrModelPlaceholder': 'gpt-4.1-mini...',
  'dashboard.aio.customAi.resetOcr': 'Cancella OCR',
  'dashboard.aio.customAi.useSavedOcr': 'Usa OCR',
  'dashboard.aio.customAi.removeOcr': 'Rimuovi OCR',
  'dashboard.aio.customAi.saveOcr': 'Salva OCR',
  'dashboard.aio.customAi.openAiCompatibleHint':
    "Usa un'API compatibile con OpenAI.",
  'dashboard.aio.clean.maskDilation': 'Dilatazione maschera',
  'bugReport.title': 'Segnala bug',
  'bugReport.subtitle': 'Screenshot + log automatici + allegati manuali',
  'bugReport.close': 'Chiudi',
  'bugReport.details': 'Dettagli',
  'bugReport.evidence': 'Prove',
  'bugReport.machineSnapshotIncluded':
    'Include automaticamente uno snapshot tecnico della macchina.',
  'bugReport.field.title': 'Titolo',
  'bugReport.field.description': 'Descrizione',
  'bugReport.field.severity': 'Gravità',
  'bugReport.field.steps': 'Passaggi per riprodurre',
  'bugReport.field.expected': 'Risultato atteso',
  'bugReport.field.actual': 'Risultato effettivo',
  'bugReport.field.contact': 'Contatto',
  'bugReport.placeholder.title':
    "Es.: Errore durante l'elaborazione batch in AIO",
  'bugReport.placeholder.description': 'Descrivi il problema',
  'bugReport.placeholder.steps': '1. … 2. … 3. …',
  'bugReport.placeholder.contact': 'email, Discord, @utente',
  'bugReport.severity.low': 'Bassa',
  'bugReport.severity.medium': 'Media',
  'bugReport.severity.high': 'Alta',
  'bugReport.severity.critical': 'Critica',
  'bugReport.preparingEvidence': 'Preparazione screenshot e log…',
  'bugReport.dragToCrop': 'Trascina per selezionare un ritaglio opzionale.',
  'bugReport.clearCrop': 'Cancella ritaglio',
  'bugReport.manualAttachments': 'Allegati manuali',
  'bugReport.attach': 'Allega',
  'bugReport.attach.summary':
    'Max {count} file, {size}MB ciascuno. Totale: {total}.',
  'bugReport.attach.maxCount': 'Massimo {count} allegati.',
  'bugReport.attach.fileTooLarge': '{name} > {size}MB.',
  'bugReport.attach.totalTooLarge': 'Totale > {size}MB.',
  'bugReport.attach.remove': 'Rimuovi {name}',
  'bugReport.screenshotUnavailable': 'Screenshot non disponibile.',
  'bugReport.error.bridgeUnavailable': 'Bridge non disponibile.',
  'bugReport.error.prepareFailed': 'Impossibile preparare la segnalazione bug.',
  'bugReport.error.noScreenshot': 'Nessun screenshot disponibile.',
  'bugReport.error.fillTitleDescription': 'Compila titolo e descrizione.',
  'bugReport.error.generic': 'Non riuscito.',
  'bugReport.success.sent': 'Segnalazione inviata.{screenshot}',
  'bugReport.success.screenshot': 'Screenshot: {url}',
  'bugReport.legalPrefix':
    'Inviando, confermi di aver verificato screenshot, log e allegati. Materiale inoltrato secondo',
  'bugReport.sending': 'Invio in corso…',
  'bugReport.submit': 'Invia segnalazione',
  'dashboard.topbar.tools': 'Strumenti',
  'dashboard.topbar.showSidebar': 'Mostra barra laterale',
  'dashboard.topbar.sidebar': 'Barra laterale',
  'dashboard.topbar.disableBatch': 'Disabilita batch',
  'dashboard.topbar.enableBatch': 'Abilita batch',
  'dashboard.topbar.batchStatus': 'Batch · {count}t',
  'dashboard.topbar.threads': 'Thread',
  'dashboard.topbar.viewMode': 'Vista',
  'dashboard.topbar.paginated': 'Paginata',
  'dashboard.topbar.longStrip': 'Striscia lunga',
  'dashboard.topbar.rotate90': 'Ruota 90°',
  'dashboard.topbar.selectImage': "Seleziona un'immagine",
  'dashboard.topbar.export': 'Esporta',
  'dashboard.topbar.textFile': 'File di testo',
  'dashboard.topbar.textPackage': 'Pacchetto testo',
  'dashboard.topbar.imagePackage': 'Pacchetto immagini',
  'dashboard.topbar.downloadTextAsTxt': 'Scarica la traduzione come .txt.',
  'dashboard.topbar.downloadVisualZip':
    'ZIP con file .txt di OCR e traduzione per ogni immagine.',
  'dashboard.topbar.format': 'Formato',
  'dashboard.topbar.quality': 'Qualità',
  'dashboard.topbar.package': 'Pacchetto',
  'dashboard.topbar.rawText': 'Testo originale',
  'dashboard.topbar.translated': 'Tradotto',
  'dashboard.topbar.inpainted': 'Inpainted',
  'dashboard.topbar.downloadTxt': 'Scarica TXT',
  'dashboard.topbar.downloadZip': 'Scarica ZIP',
  'dashboard.topbar.downloadPackage': 'Scarica pacchetto',
  'dashboard.topbar.layeredPsd': 'PSD a livelli',
  'dashboard.topbar.layeredPsdHint':
    'Esporta PSD per Photoshop, CSP, Krita, GIMP.',
  'dashboard.topbar.compression': 'Compressione',
  'dashboard.topbar.dpi': 'DPI',
  'dashboard.topbar.ocrOverlay': 'Overlay OCR',
  'dashboard.topbar.crops': 'Ritagli',
  'dashboard.topbar.rawTextLayer': 'Livello testo originale',
  'dashboard.topbar.translatedLayer': 'Livello tradotto',
  'dashboard.topbar.psTextLayers': 'Livelli testo PS',
  'dashboard.topbar.metadataJson': 'Metadati JSON',
  'dashboard.topbar.photoshopRequired':
    'Richiede Adobe Photoshop (2025–cc2017).',
  'dashboard.topbar.generating': 'Generazione…',
  'dashboard.topbar.psdWithMeta': 'PSD + Meta',
  'dashboard.topbar.exportPsd': 'Esporta PSD',
  'dashboard.topbar.undoWorkspace': 'Annulla workspace',
  'dashboard.topbar.undoShortcut': 'Annulla (Ctrl+Z)',
  'dashboard.topbar.redoWorkspace': 'Ripristina workspace',
  'dashboard.topbar.redoShortcut': 'Ripristina (Ctrl+Shift+Z / Ctrl+Y)',
  'dashboard.topbar.shortcuts': 'Scorciatoie',
  'dashboard.topbar.shortcutsHint': 'Scorciatoie (H)',
  'dashboard.topbar.hideTools': 'Nascondi strumenti',
  'dashboard.topbar.showTools': 'Mostra strumenti',
  'dashboard.topbar.hide': 'Nascondi',
  'dashboard.topbar.profile': 'Profilo',
  'dashboard.topbar.exportWorkspace': 'Esporta workspace',
  'dashboard.topbar.importWorkspace': 'Importa workspace',
  'dashboard.topbar.clearLocalAutosave':
    'Cancella salvataggio automatico locale',
  'dashboard.topbar.closeWorkspace': 'Chiudi workspace',
  'dashboard.topbar.replayTour': 'Rivedi il tour',
  'dashboard.topbar.scanlationFeed': 'Feed Scanlation',
  'dashboard.topbar.rankings': 'Classifiche',
  'dashboard.topbar.logout': 'Disconnetti',
  'dashboard.topbar.brand': 'KŌMA Studio',
  'dashboard.topbar.autoManualBadge': 'A/M',
  'dashboard.topbar.zoomOut': 'Riduci zoom',
  'dashboard.topbar.zoomIn': 'Aumenta zoom',
  'dashboard.topbar.compressionRle': 'RLE',
  'dashboard.topbar.compressionZip': 'ZIP',
  'dashboard.topbar.compressionRaw': 'RAW',
  'dashboard.topbar.navigation': 'Navigazione',
  'dashboard.topbar.optionPng': 'PNG',
  'dashboard.topbar.optionJpeg': 'JPEG',
  'dashboard.topbar.optionWebp': 'WEBP',
  'dashboard.topbar.optionPdf': 'PDF',
  'dashboard.topbar.optionCbz': 'CBZ',
  'dashboard.topbar.optionCb7': 'CB7',
  'dashboard.topbar.optionZip': 'ZIP',
  'renderPreview.circularText': 'Testo circolare',
  'settings.aioPresets.description':
    'Combinazioni di modelli per le 5 fasi AIO per lingua di origine. Scegli quale preset è attivo.',
  'settings.aioPresets.catalog': 'Catalogo',
  'settings.aioPresets.syncingCatalog': 'Sincronizzazione modelli locali + cloud.',
  'settings.aioPresets.editPreset': 'Modifica preset',
  'settings.aioPresets.newPreset': 'Nuovo preset',
  'settings.aioPresets.namePlaceholder': 'Es.: Giapponese HQ',
  'settings.aioPresets.sourceLanguage': 'Lingua di origine',
  'settings.aioPresets.shortDescription': 'Breve descrizione…',
  'settings.aioPresets.select': 'Seleziona',
  'settings.aioPresets.noneRegistered': 'Nessun preset registrato.',
  'settings.aioPresets.createFirst': 'Crea il primo',
  'settings.aioPresets.presetCount': '{count} preset',
  'settings.aioPresets.clearActive': 'Rimuovi attivo',
  'settings.aioPresets.active': 'Attivo',
  'settings.aioPresets.activate': 'Attiva',
  'settings.aioPresets.editNamed': 'Modifica {name}',
  'settings.aioPresets.deleteNamed': 'Elimina {name}',
  'settings.pickerPalette.title': 'Tavolozza selettore',
  'settings.pickerPalette.description':
    'Preset a tinta unita e sfumature per i selettori di riempimento.',
  'settings.pickerPalette.newPreset': 'Nuovo preset',
  'settings.pickerPalette.add': 'Aggiungi',
  'settings.pickerPalette.reset': 'Reimposta',
  'settings.pickerPalette.hintPrefix': 'Accetta tinte unite e sfumature. Es.:',
  'settings.pickerPalette.hintOr': 'o',
  'settings.pickerPalette.solids': 'Tinte unite',
  'settings.pickerPalette.gradients': 'Sfumature',
  'settings.modePresets.title': 'Preset per modalità',
  'settings.modePresets.description':
    'Stile base per modalità testo. Applicato automaticamente nella dashboard.',
  'settings.modePresets.targetMode': 'Modalità target',
  'settings.modePresets.outline': 'Contorno',
  'settings.modePresets.off': 'Off',
  'settings.modePresets.outlineWidth': 'Spessore contorno',
  'settings.modePresets.ocrGradient': 'Gradiente OCR',
  'settings.modePresets.detect': 'Rileva',
  'settings.modePresets.ignore': 'Ignora',
  'settings.modePresets.textColor': 'Colore testo',
  'settings.modePresets.outlineColor': 'Colore contorno',
  'settings.modePresets.all': 'Tutti',
  'settings.modePresets.mode': 'Modalità',
  'settings.modePresets.save': 'Salva',
  'settings.typographerLibrary.title': 'Libreria Typesetter',
  'settings.typographerLibrary.description':
    'Stili globali con cartelle, preset predefinito e associazione per modalità rilevata.',
  'settings.typographerLibrary.newFolder': 'Nuova cartella',
  'settings.typographerLibrary.defaultPreset': 'Preset predefinito',
  'settings.typographerLibrary.none': 'Nessuno',
  'settings.typographerLibrary.edit': 'Modifica',
  'settings.typographerLibrary.new': 'Nuovo',
  'settings.typographerLibrary.presetTypographer': 'Preset Typesetter',
  'settings.typographerLibrary.folder': 'Cartella',
  'settings.typographerLibrary.withoutFolder': 'Nessuna cartella',
  'settings.typographerLibrary.descriptionPlaceholder': 'Es.: Fumetto IT-IT',
  'settings.typographerLibrary.padding': 'Padding',
  'settings.typographerLibrary.lineSpacing': 'Interlinea',
  'settings.updates.title': 'Aggiornamenti',
  'settings.updates.currentVersion': 'Versione attuale',
  'settings.updates.newVersion': 'Nuova versione',
  'settings.updates.status': 'Stato',
  'settings.updates.channel': 'Canale',
  'settings.updates.installOnClose': 'Installa alla chiusura',
  'settings.updates.policy': 'Criterio',
  'settings.updates.mandatory': 'Obbligatorio',
  'settings.updates.optional': 'Opzionale',
  'settings.updates.lastCheck': 'Ultimo controllo',
  'settings.updates.downloadCompleted': 'Download completato',
  'settings.updates.channelTitle': 'Canale di aggiornamento',
  'settings.updates.stableDesc': 'Rilasci testati e stabili',
  'settings.updates.betaDesc': 'Accesso anticipato alle funzionalità',
  'settings.updates.installOnCloseTitle':
    "Installa aggiornamento alla chiusura dell'app",
  'settings.updates.installOnCloseDesc':
    "Quando il pacchetto è già scaricato, l'installazione partirà automaticamente all'uscita.",
  'settings.updates.checking': 'Verifica in corso…',
  'settings.updates.checkNow': 'Controlla aggiornamenti',
  'settings.updates.download': 'Scarica aggiornamento',
  'settings.autosave.title': 'Salvataggio automatico workspace',
  'settings.autosave.description':
    "Controlla se la dashboard salva automaticamente il workspace locale e l'intervallo tra i salvataggi.",
  'settings.autosave.enableTitle': 'Abilita salvataggio automatico',
  'settings.autosave.enableDesc':
    'Quando abilitato, il workspace viene salvato localmente a intervalli regolari ogni volta che ci sono modifiche in sospeso.',
  'settings.autosave.interval': 'Intervallo',
  'settings.autosave.save': 'Salva impostazioni autosave',
  'settings.shortcuts.title': 'Centro scorciatoie',
  'settings.shortcuts.description':
    'La configurazione ufficiale delle scorciatoie è ora nella dashboard, nella barra superiore. Questo evita discrepanze tra la schermata principale e la pagina impostazioni.',
  'settings.shortcuts.whereToEdit': 'Dove modificare',
  'settings.shortcuts.whereToEditDesc': 'Apri la dashboard e usa',
  'settings.shortcuts.orPress': 'o premi',
  'settings.tabs.ariaLabel': 'Schede impostazioni',
  'settings.integrations.test': 'Testa',
  'settings.integrations.testing': 'Test in corso…',
  'settings.integrations.ok': '✓ OK',
  'settings.integrations.failed': '✗ Non riuscito',
  'settings.integrations.saved': '✓ Salvato',
  'settings.integrations.discord.description':
    'Notifiche di elaborazione, errori e avvisi quota.',
  'settings.integrations.discord.webhookUrl': 'URL Webhook',
  'settings.integrations.discord.webhookPlaceholder':
    'https://discord.com/api/webhooks/…',
  'settings.integrations.discord.botName': 'Nome bot',
  'settings.integrations.discord.webhookActive': 'Webhook attivo',
  'settings.integrations.discord.howToSetup': 'Come configurare',
  'settings.integrations.discord.step1': 'In Discord:',
  'settings.integrations.discord.step1Strong':
    'Impostazioni server → Integrazioni → Webhook → Nuovo Webhook',
  'settings.integrations.discord.step2':
    "Copia l'URL e incollalo nel campo sopra.",
  'dashboard.dashboardLlm.extraContextPlaceholder':
    'Contesto aggiuntivo: personaggi, tono, glossario…',
  'dashboard.dashboardLlm.temperature': 'Temperatura',
  'dashboard.dashboardLlm.topP': 'Top P',
  'dashboard.dashboardLlm.maxTokens': 'Token massimi',
  'dashboard.dashboardLlm.translationProfile': 'Profilo traduzione',
  'dashboard.dashboardLlm.translationModelPlaceholder': 'gpt-4.1, claude…',
  'dashboard.dashboardLlm.apiKey': 'Chiave API',
  'dashboard.dashboardLlm.apiKeyPlaceholder': 'sk-… (opzionale)',
  'dashboard.dashboardLlm.ocrProfile': 'Profilo OCR',
  'dashboard.dashboardLlm.openAiCompatibleHint':
    "Compatibile con OpenAI. La base può essere /v1 o l'endpoint completo. Alcuni accettano una chiave vuota.",
  'dashboard.dashboardLlm.clear': 'Cancella',
  'dashboard.dashboardLlm.use': 'Usa',
  'dashboard.dashboardLlm.remove': 'Rimuovi',
  'dashboard.dashboardLlm.save': 'Salva',
  'dashboard.dashboardLlm.hdStrategy': 'Strategia HD',
  'dashboard.dashboardLlm.resize': 'Ridimensiona',
  'dashboard.dashboardLlm.crop': 'Ritaglia',
  'dashboard.dashboardLlm.original': 'Originale',
  'dashboard.dashboardLlm.hdStrategyHint':
    "Strategia per immagini grandi prima dell'inpainting.",
  'dashboard.dashboardLlm.resizeLimit': 'Limite ridimensionamento',
  'dashboard.dashboardLlm.cropMargin': 'Margine ritaglio',
  'dashboard.dashboardLlm.cropTriggerSize': 'Dimensione attivazione ritaglio',
  'dashboard.dashboardRegion.title': 'Regione',
  'dashboard.dashboardRegion.blocks': 'Blocchi',
  'dashboard.dashboardRegion.selection': 'Selezione',
  'dashboard.dashboardRegion.ocr': 'OCR',
  'dashboard.dashboardRegion.translation': 'Traduzione',
  'dashboard.dashboardRegion.notes': 'Note',
  'dashboard.dashboardRegion.segments': 'Segmenti',
  'dashboard.dashboardRegion.disabled': 'disabilitato',
  'dashboard.dashboardRegion.manualHint':
    "Trascina sull'anteprima per aggiungere aree. Usa gli angoli per ridimensionare.",
  'dashboard.dashboardRegion.manualModeHint':
    'Modalità manuale per regolare i riquadri.',
  'dashboard.dashboardRegion.dockHint':
    'Usa il dock flottante sul canvas per selezionare area, pulire e modificare. Gli strumenti sono abilitati in base alla fase attiva.',
  'dashboard.translator.workspace.ariaLabel': 'Modalità traduttore',
  'dashboard.translator.sourceTitle': 'Testo di origine',
  'dashboard.translator.sourceDescription':
    'Incolla, importa e traduci preservando paragrafi e interruzioni di riga.',
  'dashboard.translator.sourcePlaceholder':
    "Incolla qui il capitolo o l'estratto da tradurre…",
  'dashboard.translator.sourceAria': 'Testo di origine per la traduzione',
  'dashboard.translator.import': 'Importa',
  'dashboard.translator.translating': 'Traduzione in corso…',
  'dashboard.translator.translate': 'Traduci',
  'dashboard.translator.editorCleared': 'Editor cancellato.',
  'dashboard.translator.clear': 'Cancella',
  'dashboard.translator.resultTitle': 'Risultato',
  'dashboard.translator.resultModelPrefix': 'Modello: {value}',
  'dashboard.translator.resultPlaceholder':
    'Esegui per visualizzare il risultato.',
  'dashboard.translator.resultFieldPlaceholder': 'La traduzione apparirà qui…',
  'dashboard.translator.resultPlaceholderAria': 'Risultato traduzione',
  'dashboard.translator.editorDirty':
    'Testo di origine modificato. Riesegui per aggiornare.',
  'dashboard.translator.resultCopied': 'Risultato copiato.',
  'dashboard.translator.copy': 'Copia',
  'dashboard.translator.downloadTxt': 'Scarica TXT',
  'dashboard.translator.modeLabel': 'Traduttore',
  'dashboard.translator.workspace.textHint':
    'Traduci testo libero preservando paragrafi e interruzioni di riga.',
  'dashboard.translator.workspace.visualHint':
    'Rileva regioni, OCR e traduci per riquadri nelle immagini.',
  'dashboard.translator.processing.standard': 'Standard',
  'dashboard.translator.processing.aiSfx': 'IA SFX',
  'dashboard.language.source': 'Lingua di origine',
  'dashboard.language.target': 'Lingua di destinazione',
  'dashboard.models.title': 'Modelli',
  'dashboard.translator.ocr': 'OCR',
  'dashboard.translator.ocr.manageModels': 'Gestisci modelli OCR',
  'dashboard.translator.noneAvailable': 'Nessun modello',
  'dashboard.translator.device': 'Dispositivo',
  'dashboard.translator.languages': 'Lingue',
  'dashboard.translator.multi': 'multi',
  'dashboard.translator.noDescription': 'Nessuna descrizione.',
  'dashboard.translator.localStatus': 'Stato locale: {value}',
  'dashboard.translator.sfx.cleanModel': 'Cleaner SFX',
  'dashboard.translator.sfx.hint':
    "Es.: preferisci SFX brevi e pesanti, sii più conservativo quando l'effetto si fonde con il tratto fine.",
  'dashboard.translator.llm.contextPlaceholder':
    'Contesto: glossario, tono, personaggi…',
  'dashboard.translator.llm.generateNotes': 'Genera TN separate',
  'dashboard.translator.llm.multimodalContext':
    'Immagine come contesto multimodale',
  'dashboard.translator.llm.temperature': 'Temperatura',
  'dashboard.translator.llm.topP': 'Top P',
  'dashboard.translator.llm.maxTokens': 'Token massimi',
  'dashboard.translator.execute.title': 'Esegui',
  'dashboard.translator.loadImage': 'Carica',
  'dashboard.translator.detectTranslate': 'Rileva + Traduci',
  'dashboard.translator.retranslateImage': 'Ritraduci immagine',
  'dashboard.translator.retranslateRegion': 'Ritraduci regione',
  'dashboard.translator.regionTitle': 'Regione',
  'dashboard.translator.blocks': 'Blocchi',
  'dashboard.translator.selection': 'Selezione',
  'dashboard.translator.translation': 'Traduzione',
  'dashboard.translator.notes': 'Note',
  'dashboard.translator.none': 'nessuno',
  'dashboard.translator.charactersTranslated':
    '{count} carattere/i tradotto/i.',
  'splitter.workspace.emptyTitle': "Carica un'immagine",
  'splitter.workspace.emptyDescription':
    "Usa la barra laterale sinistra per importare le pagine. L'anteprima mostra i tagli suggeriti e i segmenti generati.",
  'splitter.workspace.previewTitle': 'Anteprima taglio',
  'splitter.workspace.previewDescription':
    'Doppio clic per aggiungere un taglio. Trascina le linee per regolare.',
  'splitter.workspace.previewAlt': 'Anteprima di {name}',
  'splitter.workspace.cutTitle': 'Taglio {index}',
  'splitter.workspace.hide': 'Nascondi',
  'splitter.workspace.show': 'Mostra',
  'splitter.workspace.recalculate': 'Ricalcola',
  'splitter.workspace.diagnostics': 'Diagnostica',
  'splitter.workspace.engine': 'Motore',
  'splitter.workspace.cuts': 'Tagli',
  'splitter.workspace.segments': 'Segmenti',
  'splitter.workspace.whitespace': 'Spazi bianchi',
  'splitter.workspace.noWarnings': "Nessun avviso per l'immagine attiva.",
  'splitter.workspace.cutsTitle': 'Tagli ({count})',
  'splitter.workspace.cutCard': 'Taglio #{index}',
  'splitter.workspace.locked': 'Bloccato',
  'splitter.workspace.unlocked': 'Sbloccato',
  'splitter.workspace.merge': 'Unisci',
  'splitter.workspace.segmentsTitle': 'Segmenti ({count})',
  'splitter.workspace.segmentAlt': 'Segmento {index}',
  'splitter.workspace.segmentCard': 'Segmento #{index}',
  'splitter.workspace.analyzing': 'Analisi in corso…',
  'splitter.workspace.dimensions': 'Dimensioni',
  'splitter.workspace.axis': 'Asse',
  'splitter.workspace.strategy': 'Strategia',
  'splitter.sidebar.title': 'Divisore',
  'splitter.sidebar.recipe': 'Ricetta',
  'splitter.sidebar.preset': 'Preset',
  'splitter.sidebar.mode': 'Modalità',
  'splitter.sidebar.direction': 'Direzione',
  'splitter.sidebar.vertical': 'Verticale',
  'splitter.sidebar.horizontal': 'Orizzontale',
  'splitter.sidebar.parts': 'Parti',
  'splitter.sidebar.targetHeight': 'Altezza obiettivo',
  'splitter.sidebar.minimum': 'Minimo',
  'splitter.sidebar.maximum': 'Massimo',
  'splitter.sidebar.adjustments': 'Regolazioni',
  'splitter.sidebar.overlap': 'Sovrapposizione ({value}px)',
  'splitter.sidebar.whitespace': 'Spazi bianchi ({value})',
  'splitter.sidebar.noise': 'Rumore ({value})',
  'splitter.sidebar.edgeGuard': 'Protezione bordi ({value}px)',
  'splitter.sidebar.protectTallBlocks': 'Proteggi blocchi alti',
  'splitter.sidebar.baseName': 'Nome base',
  'splitter.sidebar.baseNamePlaceholder': 'koma-split',
  'splitter.sidebar.suffix': 'Suffisso',
  'splitter.sidebar.suffixPlaceholder': '{image}-part-{index}',
  'splitter.sidebar.tokensPrefix': 'Token:',
  'splitter.sidebar.tokensAnd': 'e',
  'splitter.sidebar.actions': 'Azioni',
  'splitter.sidebar.imagesCount': '{count} imm.',
  'splitter.sidebar.activeImage': 'Attiva: {name}',
  'splitter.sidebar.selectImage': "Seleziona un'immagine.",
  'splitter.sidebar.reanalyze': 'Rianalizza',
  'splitter.sidebar.applyToActive': '→ Attiva',
  'splitter.sidebar.applyToAll': '→ Tutte',
  'splitter.sidebar.clearCuts': 'Cancella tagli',
  'splitter.sidebar.resetRecipe': 'Reimposta ricetta',
  'splitter.sidebar.exportActive': 'Esporta attiva',
  'splitter.sidebar.exportBatch': 'Esporta batch',
  'splitter.sidebar.directoryUnavailable':
    'showDirectoryPicker non disponibile.',
  'splitter.sidebar.exportToFolder': 'Esporta in cartella',
  'stitch.workspace.cancelled': 'Rendering Stitcher annullato.',
  'stitch.workspace.renderingBatch': 'Rendering batch {current}/{total}...',
  'stitch.workspace.batchReady': 'Batch {current} pronto per il download.',
  'stitch.workspace.generatingZip': 'Generazione di {count} batch Stitcher...',
  'stitch.workspace.zipReady':
    'Pacchetto ZIP con {count} batch generato correttamente.',
  'stitch.workspace.savingToFolder':
    'Salvataggio di {count} batch nella cartella...',
  'stitch.workspace.folderReady': 'Batch esportati nella cartella selezionata.',
  'stitch.workspace.folderCancelled': 'Esportazione in cartella annullata.',
  'stitch.workspace.noBatchSelected': 'Nessun batch selezionato',
  'stitch.workspace.previewEyebrow': 'Anteprima batch',
  'stitch.workspace.batchTitle': 'Batch {current} di {total}',
  'stitch.workspace.noBatchAvailable': 'Nessun batch disponibile',
  'stitch.workspace.imagesCount': '{count} immagine/i',
  'stitch.workspace.previousBatch': 'Batch precedente',
  'stitch.workspace.nextBatch': 'Batch successivo',
  'stitch.workspace.zoomOut': 'Riduci zoom',
  'stitch.workspace.resetZoom': 'Reimposta zoom',
  'stitch.workspace.zoomIn': 'Aumenta zoom',
  'stitch.workspace.exporting': 'Esportazione…',
  'stitch.workspace.exportBatch': 'Esporta batch',
  'stitch.workspace.zip': 'ZIP',
  'stitch.workspace.folder': 'Cartella',
  'stitch.workspace.cancel': 'Annulla',
  'stitch.workspace.emptyTitle': 'Nessun batch pronto',
  'stitch.workspace.emptyDescription':
    'Carica le immagini nella dashboard e configura i batch nella toolbox della barra laterale destra.',
  'stitch.workspace.generatingPreview': 'Generazione anteprima {progress}%',
  'stitch.workspace.previewAlt': 'Anteprima batch unito',
  'stitch.workspace.errorTitle': 'Stitcher non riuscito',
  'stitch.workspace.planningEyebrow': 'Pianificazione',
  'stitch.workspace.planningTitle': '{count} batch pianificato/i',
  'stitch.workspace.planningSubtitle':
    'Rivedi i batch pesanti e scorri il piano.',
  'stitch.workspace.baseLabel': 'Base:',
  'stitch.workspace.batchCardTitle': 'Batch {index}',
  'stitch.workspace.batchCardDims': '{count} imm. · {width}×{height}',
  'stitch.workspace.activeBatch': 'Batch attivo',
  'stitch.workspace.stats.images': 'Immagini',
  'stitch.workspace.stats.output': 'Output',
  'stitch.workspace.stats.size': 'Dimensione',
  'stitch.workspace.stats.preview': 'Anteprima',
  'stitch.workspace.awaiting': 'In attesa',
  'stitch.workspace.toolboxTitle': 'Toolbox',
  'stitch.workspace.toolboxDescription':
    'Impostazioni e regolazioni dei confini sono nella barra laterale destra.',
  'stitch.sidebar.title': 'Stitcher',
  'stitch.sidebar.layout': 'Layout',
  'stitch.sidebar.layoutMode': 'Modalità unione',
  'stitch.sidebar.vertical': 'Verticale',
  'stitch.sidebar.horizontal': 'Orizzontale',
  'stitch.sidebar.strategy': 'Strategia',
  'stitch.sidebar.fixedCount': 'Numero fisso',
  'stitch.sidebar.targetAxis': 'Obiettivo per asse',
  'stitch.sidebar.single': 'Tutto in uno',
  'stitch.sidebar.imagesPerBatch': 'Immagini per batch',
  'stitch.sidebar.spacing': 'Spaziatura ({value}px)',
  'stitch.sidebar.alignment': 'Allineamento',
  'stitch.sidebar.start': 'Inizio',
  'stitch.sidebar.center': 'Centro',
  'stitch.sidebar.end': 'Fine',
  'stitch.sidebar.output': 'Output',
  'stitch.sidebar.background': 'Sfondo',
  'stitch.sidebar.backgroundColor': 'Colore sfondo',
  'stitch.sidebar.baseName': 'Nome base',
  'stitch.sidebar.baseNamePlaceholder': 'koma-stitch',
  'stitch.sidebar.imagesInfo':
    "{count} immagine/i. L'ordine attuale definisce i batch.",
  'stitch.sidebar.recalculate': 'Ricalcola batch',
  'stitch.sidebar.boundary': 'Confine',
  'stitch.sidebar.boundaryBatch': 'Batch {current}/{total} · {count} imm.',
  'stitch.sidebar.noBatch': 'Nessun batch',
  'stitch.sidebar.moveLastToNext': 'Ultima → successivo',
  'stitch.sidebar.pullFromNext': 'Prendi dal successivo',
  'modelManager.filters.catalog': 'Catalogo',
  'modelManager.filters.all': 'Tutti',
  'modelManager.filters.local': 'Locale',
  'modelManager.filters.cloud': 'Cloud',
  'modelManager.filters.language': 'Lingua',
  'modelManager.filters.status': 'Stato',
  'modelManager.filters.installed': 'Installato',
  'modelManager.filters.notInstalled': 'Non installato',
  'modelManager.filters.updateAvailable': 'Aggiornamento disponibile',
  'modelManager.tooltip.speed.fast': 'Veloce',
  'modelManager.tooltip.speed.good': 'Buono',
  'modelManager.tooltip.speed.excellent': 'Eccellente',
  'modelManager.tooltip.allLanguages': 'Tutte le lingue supportate',
  'modelManager.tooltip.infoAria': 'Info modello per {name}',
  'modelManager.tooltip.info': 'Info',
  'modelManager.tooltip.aioStage': 'Fase AIO',
  'modelManager.tooltip.description': 'Descrizione',
  'modelManager.tooltip.languages': 'Lingue',
  'modelManager.tooltip.speed.label': 'Velocità',
  'modelManager.tooltip.minimum': 'Minimo',
  'modelManager.tooltip.downloadSize': 'Dimensione download',
  'modelManager.tooltip.diskSpace': 'Spazio su disco',
  'modelManager.tooltip.version': 'Versione',
  'modelManager.status.installed': 'Installato',
  'modelManager.status.updateAvailable': 'Aggiornamento disponibile',
  'modelManager.status.downloading': 'Download in corso',
  'modelManager.status.queued': 'In coda',
  'modelManager.status.verifying': 'Verifica in corso',
  'modelManager.status.failed': 'Non riuscito',
  'modelManager.status.cancelled': 'Annullato',
  'modelManager.status.incomplete': 'Incompleto',
  'modelManager.status.notInstalled': 'Non installato',
  'modelManager.actions.selected': 'Selezionato',
  'modelManager.actions.useModel': 'Usa modello',
  'modelManager.actions.uninstall': 'Disinstalla',
  'modelManager.actions.update': 'Aggiorna',
  'modelManager.actions.retry': 'Riprova',
  'modelManager.actions.install': 'Installa',
  'modelManager.actions.source': 'Origine',
  'modelCard.status.selected': 'Selezionato',
  'modelCard.status.failed': 'Non riuscito',
  'modelCard.status.verifying': 'Verifica…',
  'modelCard.status.queued': 'In coda…',
  'modelCard.status.downloading': 'Download…',
  'modelCard.status.cancelled': 'Annullato',
  'modelCard.status.incomplete': 'Incompleto',
  'modelCard.status.notInstalled': 'Non installato',
  'modelCard.action.cancel': 'Annulla',
  'modelCard.action.remove': 'Rimuovi',
  'modelCard.action.update': 'Aggiorna',
  'modelCard.action.install': 'Installa',
  'modelCard.action.retry': 'Riprova',
  'modelCard.action.active': 'Attivo',
  'modelCard.action.use': 'Usa',
  'modelManager.stage.translate': 'Ottieni traduzioni',
  'modelManager.installAll.attention': 'Attenzione',
  'modelManager.installAll.warning':
    'Stai per scaricare TUTTI i modelli di traduzione.',
  'modelManager.installAll.totalSize': 'Dimensione totale: {size}',
  'modelManager.installAll.space': 'Spazio disponibile: {space}',
  'modelManager.installAll.time': 'Tempo stimato: dipende dalla connessione',
  'modelManager.installAll.notEnoughSpace':
    'Spazio insufficiente. Richiesto: {required} | Disponibile: {available}',
  'modelManager.installAll.confirm':
    'Questa operazione potrebbe richiedere molto tempo e occupare spazio significativo su disco. Vuoi continuare?',
  'modelManager.installAll.confirmDownload': 'Conferma download',
  'modelManager.disk.notVerified': 'Disco non verificato',
  'modelManager.disk.free': '{space} liberi',
  'modelManager.disk.models': '{installed}/{total} modelli ({size})',
  'modelManager.enhance.freeSpace': 'Spazio libero',
  'modelManager.enhance.notChecked': 'non verificato',
  'modelManager.enhance.closeAria': 'Chiudi finestra modelli enhance',
  'modelManager.enhance.directInstall': 'Installazione diretta',
  'modelManager.enhance.directInstallDesc':
    'Modelli curati con download diretto o installazione gestita sul mini-backend.',
  'modelManager.enhance.manualImport': 'Importazione manuale',
  'modelManager.enhance.manualImportDesc':
    'Modelli elencati nel catalogo ma caricati tramite ONNX locale. Usa la conversione esterna quando è disponibile solo `.pth`.',
  'modelManager.enhance.importOnnxBadge': 'Importa ONNX',
  'modelManager.enhance.statusLabel': 'Stato',
  'modelManager.enhance.estimatedDisk': 'Disco stimato',
  'modelManager.enhance.reimportOnnx': 'Reimporta ONNX',
  'modelManager.enhance.pthHint': 'Per i pesi in',
  'modelManager.enhance.pthHintSuffix':
    "converti prima in ONNX e poi usa l'importazione manuale.",
  'common.yes': 'Sì',
  'dashboard.organize.hint.reorder':
    'Trascina e riordina i file nel pannello sinistro.',
  'dashboard.organize.hint.rotate':
    'Usa il pulsante di rotazione per correggere le pagine scansionate orizzontalmente.',
  'guides.common.beginner': 'Principiante',
  'guides.common.intermediate': 'Intermedio',
  'guides.common.advanced': 'Avanzato',
  'guides.home.title': 'Guide e tutorial',
  'guides.home.description':
    'Impara a padroneggiare ogni strumento di KŌMA Studio con guide passo passo, suggerimenti di produttività ed esempi reali.',
  'guides.home.searchPlaceholder': 'Cerca guide, scorciatoie, suggerimenti...',
  'guides.home.searchAria': 'Cerca guide',
  'guides.home.continueReading': 'Riprendi da dove avevi lasciato',
  'guides.home.stepProgress': 'Passo {current} di {total} · {time}',
  'guides.home.continueCta': 'Continua →',
  'guides.home.categories': 'Categorie',
  'guides.home.guidesCountLabel': 'guid{suffix}',
  'guides.home.completedCountLabel': 'completat{suffix}',
  'guides.home.guidesPluralSuffix': 'e',
  'guides.home.saved': 'Salvate ({count})',
  'guides.reader.backToGuides': 'Torna alle guide',
  'guides.reader.notFound': 'Guida non trovata',
  'guides.reader.progressAria': 'Progresso guida',
  'guides.reader.stepsAria': 'Passi della guida',
  'guides.reader.stepLabel': 'Passo {index}',
  'guides.reader.recent': 'Recenti',
  'guides.reader.guides': 'Guide',
  'guides.reader.removeBookmark': 'Rimuovi segnalibro',
  'guides.reader.saveBookmark': 'Salva segnalibro',
  'guides.reader.previous': 'Precedente',
  'guides.reader.next': 'Successivo',
  'guides.reader.completeGuide': 'Completa guida',
  'guides.detail.back': 'Indietro',
  'guides.detail.notFound': 'Guida non trovata.',
  'guides.detail.stepsAria': 'Passi della guida',
  'guides.detail.stepLabel': 'Passo {index}',
  'guides.detail.recent': 'Recenti',
  'guides.detail.guides': 'Guide',
  'guides.detail.stepCounter': 'Passo {current} di {total}',
  'guides.detail.previous': 'Precedente',
  'guides.detail.next': 'Successivo',
  'guides.detail.complete': 'Completa',
  'guides.detail.completed': 'Completata ✓',
  'guides.detail.tocAria': 'Indice dei contenuti',
  'guides.detail.inThisGuide': 'In questa guida',
  'guides.detail.removeFavorite': 'Rimuovi dai preferiti',
  'guides.detail.addFavorite': 'Aggiungi ai preferiti',
  'guides.detail.saved': 'Salvata',
  'guides.detail.save': 'Salva',
  'guides.step.copyCode': 'Copia codice',
  'guides.step.copied': 'Copiato',
  'guides.step.copy': 'Copia',
  'guides.search.dialogAria': 'Cerca guide',
  'guides.search.placeholder': 'Cerca guide, scorciatoie, suggerimenti...',
  'guides.search.inputAria': 'Cerca',
  'guides.search.close': 'Chiudi ricerca',
  'guides.search.noResults': 'Nessun risultato per "{query}"',
  'guides.search.results': 'Risultati ({count})',
  'guides.search.recent': 'Recenti',
  'guides.search.navigate': 'naviga',
  'guides.search.open': 'apri',
  'guides.search.closeVerb': 'chiudi',
  'guides.category.searchPlaceholder': 'Cerca in {category}...',
  'guides.category.searchAria': 'Cerca in {category}',
  'guides.category.noSearchResults': 'Nessuna guida per "{query}"',
  'guides.category.noGuides': 'Nessuna guida in questa categoria',
  'guides.category.tryOtherTerms': 'Prova con termini diversi.',
  'guides.category.comingSoon': 'Nuove guide saranno aggiunte presto.',
  'guides.category.completed': 'Completata',
  'settings.travel.destination': 'Destinazione token',
  'settings.travel.expiry': 'Scadenza codice',
  'settings.travel.temporaryAccess': 'Accesso temporaneo',
  'settings.travel.streamLike': 'Flusso ispirato alle piattaforme di streaming',
  'settings.travel.streamLikeDesc':
    "Il codice viene inviato all'email dell'account e concede accesso temporaneo su un altro PC.",
  'settings.travel.sendToken': 'Invia token alla mia email',
  'settings.travel.destinationPrefix': 'Destinazione: {value}',
  'settings.travel.expirationPrefix': 'Scadenza: {value}',
  'settings.travel.accessPrefix': 'Accesso: {value}',
  'settings.travel.definedOnSend': "Definito all'invio",
  'settings.plan.day': 'giorno',
  'settings.plan.days': 'giorni',
  'settings.typography.default': 'Predefinito',
  'settings.typography.bindingsTitle': 'Associazioni per modalità rilevata',
  'settings.typography.useDefault': 'Usa predefinito',
  'settings.integrations.blogger.description':
    'Storage/CDN per immagini e pubblicazione post.',
  'settings.integrations.blogger.label': 'Etichetta',
  'settings.integrations.blogger.labelPlaceholder': 'Blogger principale',
  'settings.integrations.blogger.blogId': 'ID Blog',
  'settings.integrations.blogger.blogIdPlaceholder': 'ID numerico',
  'settings.integrations.blogger.clientId': 'Client ID',
  'settings.integrations.blogger.clientIdPlaceholder': 'Google OAuth Client ID',
  'settings.integrations.blogger.clientSecret': 'Client Secret',
  'settings.integrations.blogger.clientSecretPlaceholder':
    'OAuth Client Secret',
  'settings.integrations.blogger.refreshToken': 'Refresh Token',
  'settings.integrations.blogger.refreshTokenPlaceholder': 'Refresh Token',
  'settings.integrations.blogger.defaultLabels': 'Etichette predefinite',
  'settings.integrations.blogger.defaultLabelsPlaceholder':
    'manga, capitolo, release',
  'settings.integrations.blogger.optimizer': 'Ottimizzatore',
  'settings.integrations.blogger.optimizerCloudinary': 'Cloudinary Fetch',
  'settings.integrations.blogger.optimizerTemplate': 'Template URL',
  'settings.integrations.blogger.cloudName': 'Cloud Name',
  'settings.integrations.blogger.urlTemplate': 'Template URL',
  'settings.integrations.blogger.cloudNamePlaceholder': 'my-cloud-name',
  'settings.integrations.blogger.cloudinaryTransformation':
    'Trasformazione Cloudinary',
  'settings.integrations.blogger.optimizerEnabled': 'Ottimizzatore attivo',
  'settings.integrations.blogger.maxWidth': 'Larghezza massima',
  'settings.integrations.blogger.maxHeight': 'Altezza massima',
  'settings.integrations.blogger.testConnection': 'Testa connessione',
  'settings.integrations.blogger.requestsPerDay': 'Richieste/giorno',
  'settings.integrations.blogger.requestsPerUser': 'Richieste/utente',
  'settings.integrations.blogger.credentialsGuideTitle':
    'Come ottenere le credenziali',
  'settings.integrations.blogger.step1': 'Vai su',
  'settings.integrations.blogger.step1Suffix': 'crea o seleziona un progetto.',
  'settings.integrations.blogger.step2': 'Abilita la',
  'settings.integrations.blogger.step2And': 'e la',
  'settings.integrations.blogger.step3': 'Crea una',
  'settings.integrations.blogger.webApplication': 'Applicazione web',
  'settings.integrations.blogger.step4': 'Aggiungi',
  'settings.integrations.blogger.step4Suffix': 'ai Redirect URI.',
  'settings.integrations.blogger.step5': 'Copia',
  'settings.integrations.blogger.step5And': 'e',
  'settings.integrations.blogger.step6':
    'Configura la schermata di consenso OAuth. Se in fase di test, aggiungi la tua email.',
  'settings.integrations.blogger.step7': "Nell'",
  'settings.integrations.blogger.step7Suffix':
    'abilita le tue credenziali e autorizza gli scope Blogger + Drive.',
  'settings.integrations.blogger.step8': 'Esegui',
  'settings.integrations.blogger.step8Suffix': 'e copia il',
  'settings.integrations.blogger.step9': 'Per Cloudinary, copia il',
  'settings.integrations.blogger.step9Suffix': 'e configura la trasformazione.',
  'settings.integrations.blogger.step10': "Trova l'",
  'settings.integrations.blogger.step10Suffix': "tramite l'URL/API di Blogger.",
  'settings.integrations.blogger.step11':
    "Salva tutto, testa la connessione e usa l'utilità nella dashboard.",
  'settings.integrations.blogger.googleQuotas': 'Quote Google',
  'settings.integrations.blogger.oauthPlayground': 'OAuth Playground',
  'settings.integrations.blogger.cloudinaryFetch': 'Cloudinary Fetch',
  'settings.integrations.blogger.driveScopes': 'Scope Drive',
  'settings.integrations.blogger.driveScopesGuideTitle':
    'Scope Drive in OAuth Playground',
  'settings.integrations.blogger.minimumPractical': 'Minimo pratico:',
  'settings.integrations.blogger.driveScopesNote':
    "Consulta la documentazione ufficiale dell'API Drive v3 per scope aggiuntivi.",
  'settings.integrations.imgur.title': 'Upload Imgur',
  'settings.integrations.imgur.description':
    'Upload anonimo con rotazione Client ID e rate limiting conservativo.',
  'settings.integrations.imgur.limitPerHour': 'Limite/ora',
  'settings.integrations.imgur.batchDelay': 'Ritardo batch (ms)',
  'settings.integrations.imgur.remaining': 'Rimanenti',
  'settings.integrations.imgur.used': 'Usati: {used}/{limit}',
  'settings.integrations.imgur.reset': 'reset: {value}',
  'settings.integrations.imgur.clientIds': 'Client ID',
  'settings.integrations.imgur.noClientIds': 'Nessun Client ID configurato.',
  'settings.integrations.imgur.clientIdPlaceholder': 'Client ID Imgur',
  'settings.integrations.imgur.quickGuideTitle': 'Guida rapida Imgur',
  'settings.integrations.imgur.step1':
    "Crea un'applicazione nella dashboard sviluppatori Imgur e copia il",
  'settings.integrations.imgur.step2':
    "Aggiungi uno o più Client ID. L'app ne sceglie uno a caso.",
  'settings.integrations.imgur.step3': 'Upload anonimo con',
  'settings.integrations.imgur.step3Suffix': 'Nessun OAuth.',
  'settings.integrations.imgur.step4': 'Limitatore conservativo:',
  'settings.integrations.imgur.step4Suffix': 'per evitare blocchi.',
  'settings.integrations.imgur.step5':
    'Upload sequenziale rispettando il ritardo configurato.',
  'settings.integrations.imgur.step6':
    'Imgur non dovrebbe essere considerato un CDN garantito.',
  'settings.integrations.imgur.imageApi': 'API Immagini Imgur',
  'settings.integrations.imgur.uploading': 'Upload Imgur',
  'common.add': 'Aggiungi',
  'common.label': 'Etichetta',
  'common.original': 'Originale',
  'common.quality': 'Qualità',
  'common.persistence': 'Persistenza',
  'common.secureStore': 'Archivio sicuro',
  'common.browserFallback': 'Fallback browser',
  'common.notAvailableShort': '—',
  'common.loading': 'Caricamento',
  'common.sending': 'Invio in corso…',
  'common.single': 'Singolo',
  'common.tile': 'Affiancato',
  'common.grid': 'Griglia',
  'common.smart': 'Smart',
  'common.multi': 'Multi',
  'blogger.title': 'Blogger CDN',
  'blogger.heroTitle': 'Pubblica e ospita immagini su Blogger',
  'blogger.heroDescription':
    'Modalità pubblicazione per post con editor visuale/HTML. Modalità upload per generare URL ospitati.',
  'blogger.ready': 'Pronto',
  'blogger.configureInSettings': 'Configura nelle impostazioni',
  'blogger.publishTab': 'Pubblica',
  'blogger.uploadTab': 'Upload',
  'blogger.settings': 'Impostazioni',
  'blogger.missingConfigTitle': 'Configurazione mancante',
  'blogger.missingConfigBody':
    "Salva le credenziali nelle impostazioni prima dell'uso.",
  'blogger.post.title': 'Post',
  'blogger.post.description': 'Titolo, etichette e pubblicazione.',
  'blogger.post.postTitle': 'Titolo',
  'blogger.post.postTitlePlaceholder': 'Titolo del post',
  'blogger.post.defaultLabels': 'Etichette predefinite',
  'blogger.post.defaultLabelsPlaceholder': 'manga, capitolo',
  'blogger.post.postLabels': 'Etichette post',
  'blogger.post.postLabelsPlaceholder': 'recensione',
  'blogger.post.publishNow': 'Pubblica ora',
  'blogger.post.draft': 'Bozza',
  'blogger.post.publish': 'Pubblica',
  'blogger.post.status.draft': 'salvato come bozza',
  'blogger.post.status.published': 'pubblicato',
  'blogger.template.title': 'Nuovo post Blogger',
  'blogger.template.description':
    'Scrivi il contenuto del post qui. Puoi alternare tra visuale, HTML e anteprima.',
  'blogger.template.insertPrefix': 'Usa il pulsante',
  'blogger.template.insertSuffix':
    'per caricare file su Blogger e inserire gli URL ospitati nel contenuto.',
  'blogger.editor.title': 'Editor',
  'blogger.editor.description': 'Visuale, HTML e anteprima.',
  'blogger.editor.visual': 'Visuale',
  'blogger.editor.preview': 'Anteprima',
  'blogger.editor.h1': 'H1',
  'blogger.editor.h2': 'H2',
  'blogger.editor.bold': 'Grassetto',
  'blogger.editor.italic': 'Corsivo',
  'blogger.editor.underline': 'Sottolineato',
  'blogger.editor.list': 'Elenco',
  'blogger.editor.numbered': 'Numerato',
  'blogger.editor.quote': 'Citazione',
  'blogger.editor.link': 'Link',
  'blogger.editor.promptUrl': 'URL',
  'blogger.editor.insertImages': 'Inserisci immagini',
  'blogger.copied': 'Copiato',
  'blogger.loadConfigFailed': 'Impossibile caricare la configurazione Blogger.',
  'blogger.imageInsertedSingle':
    "Immagine ospitata su Blogger e inserita nell'editor.",
  'blogger.imageInsertedMany':
    "{count} immagini ospitate su Blogger e inserite nell'editor.",
  'blogger.uploadFailed': 'Impossibile caricare le immagini su Blogger.',
  'blogger.batchUploadSingle':
    'Upload completato in un singolo post bozza Blogger.',
  'blogger.batchUploadMany':
    '{count} immagini caricate in un singolo post bozza Blogger.',
  'blogger.uploadFailedShort': 'Upload non riuscito.',
  'blogger.batchUploadSuccessSingle':
    'Upload completato in un singolo post bozza Blogger.',
  'blogger.batchUploadSuccessMany':
    '{count} immagini caricate in un singolo post bozza Blogger.',
  'blogger.publishSuccessWithUrl': 'Post {verb} su Blogger. URL: {url}',
  'blogger.publishSuccessWithId': 'Post {verb} su Blogger con ID {id}.',
  'blogger.publishFailed': 'Impossibile pubblicare su Blogger.',
  'blogger.uploadSection.title': 'Upload batch',
  'blogger.uploadSection.description':
    'Trascina le immagini per generare URL ospitati.',
  'blogger.uploadSection.dropTitle': 'Trascina le immagini qui',
  'blogger.uploadSection.dropDescription':
    'PNG, JPG, WebP con pre-elaborazione locale.',
  'blogger.uploadSection.optimizedUrl': 'URL ottimizzato',
  'blogger.uploadSection.optimizedUrlDesc':
    "Genera un URL ottimizzato prima dell'upload.",
  'blogger.uploadSection.exportOptimized': 'Esporta ottimizzato',
  'blogger.uploadSection.exportOptimizedDesc':
    'Usa URL ottimizzato nelle azioni batch.',
  'blogger.uploadSection.outputImg': 'Output <img>',
  'blogger.uploadSection.outputImgDesc': 'Snippet HTML invece degli URL.',
  'blogger.uploadSection.select': 'Seleziona',
  'blogger.uploadSection.send': 'Invia',
  'blogger.uploadSection.exported': 'Esportato',
  'blogger.queue.title': 'Coda',
  'blogger.queue.items': '{count} elemento/i',
  'blogger.queue.empty': 'Nessun file.',
  'blogger.queue.altText': 'Testo alternativo',
  'blogger.queue.canonical': 'Canonico',
  'blogger.queue.optimized': 'Ottimizzato',
  'blogger.queue.url': 'URL',
  'blogger.queue.opt': 'Ott',
  'blogger.queue.img': 'img',
  'common.remove': 'Rimuovi',
  'ranking.backToDashboard': 'Torna alla dashboard',
  'ranking.hero.title': 'Classifica modelli',
  'ranking.hero.subtitle':
    "Confronta i modelli ufficiali con recensioni reali della community — qualità, velocità, rapporto qualità-prezzo e facilità d'uso.",
  'ranking.hero.globalStatsAria': 'Statistiche globali',
  'ranking.hero.models': 'Modelli',
  'ranking.hero.reviews': 'Recensioni',
  'ranking.hero.bestOverall': 'Migliore complessivo',
  'ranking.hero.costBenefit': 'Qualità-prezzo',
  'ranking.loading': 'Aggiornamento classifica…',
  'legalHub.back': 'Indietro',
  'legalHub.sidebarTitle': 'Centro legale',
  'legalHub.supportDescription':
    "Supporto, privacy e richieste relative ai dati personali devono utilizzare il canale ufficiale indicato nell'app/sito web.",
  'legalHub.supportCta': 'Apri canale di supporto',
  'legalHub.noticeTitle': 'Avviso importante.',
  'dashboard.dashboardExecute.selectImage':
    "Seleziona un'immagine per eseguire.",
  'dashboard.dashboardExecute.runCurrentStage':
    "Esegui la fase corrente per l'immagine.",
  'dashboard.dashboardExecute.rerunStage': 'Riesegui fase',
  'dashboard.dashboardExecute.runStage': 'Esegui fase',
  'dashboard.dashboardExecute.runAio': 'Esegui AIO',
  'dashboard.dashboardExecute.stop': 'Ferma esecuzione',
  'freeProviderCard.stage.translation': 'Traduzione',
  'freeProviderCard.stage.ocr': 'OCR',
  'freeProviderCard.stage.clean': 'Pulizia',
  'freeProviderCard.badge.integrated': 'Integrato',
  'freeProviderCard.badge.catalog': 'Catalogo',
  'freeProviderCard.verifiedAt': 'verificato il',
  'freeProviderCard.tooltip.selectedModel': 'Modello selezionato',
  'freeProviderCard.tooltip.notSelected': '(non selezionato)',
  'freeProviderCard.tooltip.notDefined': '(non definito)',
  'freeProviderCard.tooltip.apiKeyConfigured': 'Configurata',
  'freeProviderCard.tooltip.apiKeyRequired': 'Richiesta (in attesa)',
  'freeProviderCard.tooltip.apiKeyOptional': 'Opzionale (vuota)',
  'freeProviderCard.tooltip.extraFields': 'Campi aggiuntivi',
  'freeProviderCard.tooltip.modelsInStage': 'Modelli in questa fase',
  'freeProviderCard.tooltip.empty': '(vuoto)',
  'freeProviderCard.label.model': 'Modello',
  'freeProviderCard.label.apiBase': 'API Base',
  'freeProviderCard.label.apiKey': 'Chiave API',
  'freeProviderCard.label.required': '(obbligatoria)',
  'freeProviderCard.label.optional': '(opzionale)',
  'freeProviderCard.placeholder.apiKey': 'Incolla la tua chiave qui',
  'freeProviderCard.status.activeProfile': 'Profilo attivo:',
  'freeProviderCard.status.catalogOnlyWarning':
    'Questo provider è solo catalogo nella v1.',
  'freeProviderCard.action.save': 'Salva',
  'freeProviderCard.action.use': 'Usa',
  'customProvider.field.name': 'Nome',
  'customProvider.field.model': 'Modello',
  'customProvider.field.apiBase': 'API Base',
  'customProvider.field.apiKey': 'Chiave API',
  'customProvider.placeholder.noKey': '(nessuna chiave)',
  'customProvider.placeholder.pasteKey': 'Incolla la tua chiave qui',
  'customProvider.status.active': 'Profilo attivo nella pipeline',
  'customProvider.action.cancel': 'Annulla',
  'customProvider.action.saving': 'Salvataggio...',
  'customProvider.action.save': 'Salva',
  'customProvider.action.edit': 'Modifica',
  'customProvider.action.delete': 'Elimina',
  'customProvider.badge.customProfile': 'Profilo personalizzato',
  'freeProviderCard.status.integrated': 'Integrato',
  'freeProviderCard.status.catalog': 'Catalogo',
  'freeProviderCard.status.verifiedAt': 'verificato il',
  'freeProviderCard.info.label': 'Info',
  'freeProviderCard.info.tooltip': 'Info {name}',
  'freeProviderCard.info.selectedModel': 'Modello selezionato:',
  'freeProviderCard.info.notSelected': '(non selezionato)',
  'freeProviderCard.info.modelId': 'ID modello:',
  'freeProviderCard.info.notDefined': '(non definito)',
  'freeProviderCard.info.apiBase': 'API Base:',
  'freeProviderCard.info.apiKey': 'Chiave API:',
  'freeProviderCard.info.configured': 'Configurata',
  'freeProviderCard.info.required': 'Richiesta (in attesa)',
  'freeProviderCard.info.optional': 'Opzionale (vuota)',
  'freeProviderCard.info.extraFields': 'Campi aggiuntivi:',
  'freeProviderCard.info.setup': 'Configurazione:',
  'freeProviderCard.info.limits': 'Limiti:',
  'freeProviderCard.info.rateLimits': 'Limiti di frequenza:',
  'freeProviderCard.info.modelsInStage': 'Modelli in questa fase:',
  'freeProviderCard.field.model': 'Modello',
  'freeProviderCard.field.apiBase': 'API Base',
  'freeProviderCard.field.apiBaseTitle':
    'API Base fissa per questo provider nella v1',
  'freeProviderCard.field.required': '(obbligatoria)',
  'freeProviderCard.field.optional': '(opzionale)',
  'freeProviderCard.field.apiKeyPlaceholder': 'Incolla la tua chiave qui',
  'freeProviderCard.status.catalogOnly':
    'Questo provider è solo catalogo nella v1.',
  'freeProviderCard.actions.save': 'Salva',
  'freeProviderCard.actions.use': 'Usa',
  'freeProviderCard.empty': '(vuoto)',
  'customProvider.action.use': 'Usa',
  'typo.tag': 'Typesetter',
  'typo.session.title': 'Sessione',
  'typo.session.image': 'Immagine:',
  'typo.session.selection': 'Selezione:',
  'typo.session.none': 'nessuna',
  'typo.tools.aria': 'Strumenti forma',
  'typo.tools.select': 'Seleziona',
  'typo.tools.rect': 'Rettangolare',
  'typo.tools.ellipse': 'Ellittica',
  'typo.actions.refine': 'Affina',
  'typo.actions.toRect': '→ Rettangolare',
  'typo.actions.toEllipse': '→ Ellittica',
  'typo.actions.duplicate': 'Duplica',
  'typo.actions.delete': 'Rimuovi selezione',
  'typo.presets.title': 'Preset',
  'typo.presets.active': 'Preset attivo',
  'typo.presets.none': 'Nessun preset',
  'typo.presets.applySelection': '→ Selezione',
  'typo.presets.applyImage': '→ Immagine',
  'typo.snapshots.title': 'Snapshot',
  'typo.snapshots.hint': 'Salva lo stato attuale per ripristinarlo in seguito.',
  'typo.snapshots.placeholder': 'Nome snapshot',
  'typo.snapshots.save': 'Salva snapshot',
  'typo.snapshots.select': 'Seleziona…',
  'typo.snapshots.restore': 'Ripristina',
  'typo.queue.title': 'Coda testo',
  'typo.queue.editorPlaceholder': 'Incolla le righe, una per fumetto…',
  'typo.queue.editorAria': 'Editor testo coda',
  'typo.queue.build': 'Crea coda',
  'typo.queue.import': 'Importa',
  'typo.queue.applySelected': 'Applica elemento',
  'typo.queue.next': 'Successivo',
  'typo.queue.clear': 'Cancella',
  'typo.queue.multiBubble': 'Multi-fumetto',
  'typo.queue.listAria': 'Coda tipografica',
  'typo.queue.emptyTitle': 'La coda è vuota',
  'typo.queue.emptyDesc': 'Una riga per fumetto per creare la sequenza.',
  'typo.queue.statusApplied': 'Applicato',
  'typo.queue.statusSkipped': 'Saltato',
  'typo.queue.statusPending': 'In attesa',
  'modelDetail.empty':
    'Seleziona un modello nella classifica per vedere dettagli e recensioni.',
  'modelDetail.source.local': 'Locale',
  'modelDetail.source.cloud': 'Cloud',
  'modelDetail.score.aria': 'Punteggio complessivo: {score}',
  'modelDetail.score.label': 'Punteggio',
  'modelDetail.reviews.count_one': '{count} recensione',
  'modelDetail.reviews.count_other': '{count} recensioni',
  'modelDetail.trend.up': '+{trend} pt (30g)',
  'modelDetail.trend.down': '{trend} pt (30g)',
  'modelDetail.trend.neutral': 'Tendenza neutra',
  'modelDetail.metrics.quality': 'Qualità',
  'modelDetail.metrics.speed': 'Velocità',
  'modelDetail.metrics.costBenefit': 'Qualità-prezzo',
  'modelDetail.metrics.easeOfUse': "Facilità d'uso",
  'modelDetail.distro.title': 'Distribuzione valutazioni',
  'modelDetail.distro.lastReview': 'Ultima recensione: {date}',
  'modelDetail.info.title': 'Contesto tecnico',
  'modelDetail.info.noNotes':
    'Nessuna nota aggiuntiva registrata per questo modello.',
  'modelDetail.info.source': 'Origine',
  'modelDetail.info.target': 'Destinazione',
  'modelDetail.actions.editReview': 'Modifica recensione',
  'modelDetail.actions.startReview': 'Recensisci modello',
  'modelDetail.actions.sending': 'Invio in corso…',
  'modelDetail.actions.verifyEmail': 'Verifica email',
  'modelDetail.warning.verifyEmail':
    'Conferma la tua email per pubblicare o modificare recensioni.',
  'modelDetail.recentReviews.title': 'Recensioni recenti',
  'modelDetail.recentReviews.loading': 'Caricamento…',
  'modelDetail.recentReviews.empty':
    'Questo modello non ha ancora ricevuto recensioni pubbliche.',
  'modelDetail.pagination.prev': 'Precedente',
  'modelDetail.pagination.next': 'Successivo',
  'modelDetail.usage.balanced': 'Bilanciato',
  'modelDetail.usage.quality_first': 'Qualità',
  'modelDetail.usage.speed_first': 'Velocità',
  'modelDetail.usage.low_vram': 'VRAM limitata',
  'modelDetail.usage.offline_local': 'Locale',
  'modelDetail.usage.cloud_pipeline': 'Cloud',
  'resources.empty.title.withQuery': 'Nessun risultato per "{query}"',
  'resources.empty.title.noQuery': 'Nessun elemento trovato',
  'resources.empty.desc.withQuery':
    'Prova con parole diverse o cancella i filtri per trovare {context}.',
  'resources.empty.desc.noQuery':
    'Regola i filtri per visualizzare {context} disponibili.',
  'resources.fonts.license.free': 'Gratuito',
  'resources.fonts.license.openSource': 'Open Source',
  'resources.fonts.license.commercial': 'Commerciale',
  'resources.fonts.license.mixed': 'Mista',
  'resources.fonts.context': 'font',
  'resources.fonts.placeholder': "Digita del testo per l'anteprima dei font...",
  'resources.fonts.results_one': 'font trovato',
  'resources.fonts.results_other': 'font trovati',
  'resources.fonts.previewFallback': 'Non ci posso credere!',
  'resources.fonts.sizeAria': 'Anteprima a {size}px',
  'resources.sfx.category.impact': 'Impatto',
  'resources.sfx.category.emotion': 'Emozione',
  'resources.sfx.category.ambient': 'Ambientale',
  'resources.sfx.category.action': 'Azione',
  'resources.sfx.category.voice': 'Voce',
  'resources.sfx.category.misc': 'Varie',
  'resources.sfx.filterAria': 'Filtra per categoria',
  'resources.sfx.filterAll': 'Tutti ({count})',
  'resources.sfx.results_one': 'effetto sonoro',
  'resources.sfx.results_other': 'effetti sonori',
  'resources.sfx.context': 'effetti sonori',
  'resources.sfx.copyAria': 'Copia "{text}"',
  'resources.communities.platform.forum': 'Forum',
  'resources.communities.results_one': 'community',
  'resources.communities.results_other': 'community',
  'resources.communities.context': 'community',
  'resources.communities.visitAria': 'Visita {name} in un browser esterno',
  'resources.communities.visit': 'Visita',
  'resources.tools.category.editing': 'Editing',
  'resources.tools.category.ocr': 'OCR',
  'resources.tools.category.translation': 'Traduzione',
  'resources.tools.category.fonts': 'Font',
  'resources.tools.category.hosting': 'Hosting',
  'resources.tools.category.utility': 'Utilità',
  'resources.tools.filterAll': 'Tutti',
  'resources.tools.results_one': 'strumento',
  'resources.tools.results_other': 'strumenti',
  'resources.tools.context': 'strumenti',
  'resources.tools.free.yes': 'Gratuito',
  'resources.tools.free.no': 'A pagamento',
  'resources.tools.action.open': 'Apri',
  'resources.tools.action.download': 'Scarica',
  'feed.roles.raw': 'Fornitore raw',
  'feed.roles.cl': 'Cleaner',
  'feed.roles.rd': 'Ridisegnatore',
  'feed.roles.tl': 'Traduttore',
  'feed.roles.pr': 'Revisore',
  'feed.roles.ts': 'Typesetter',
  'feed.roles.qc': 'Controllo qualità',
  'feed.contact.discord': 'Discord',
  'feed.contact.twitter_x': 'Twitter/X',
  'feed.contact.telegram': 'Telegram',
  'feed.contact.email': 'Email',
  'feed.contact.whatsapp': 'WhatsApp',
  'feed.contact.instagram': 'Instagram',
  'feed.contact.placeholder.discord': 'https://discord.gg/... o nome utente',
  'feed.contact.placeholder.twitter_x':
    'nome utente o https://x.com/nomeutente',
  'feed.contact.placeholder.telegram': 'https://t.me/... o @canale',
  'feed.contact.placeholder.email': 'contatto@scanlation.com',
  'feed.contact.placeholder.whatsapp': '+39 555 123-4567 o link',
  'feed.contact.placeholder.instagram':
    'nome utente o https://instagram.com/nomeutente',
  'feed.weekdays.seg': 'Lun',
  'feed.weekdays.ter': 'Mar',
  'feed.weekdays.qua': 'Mer',
  'feed.weekdays.qui': 'Gio',
  'feed.weekdays.sex': 'Ven',
  'feed.weekdays.sab': 'Sab',
  'feed.weekdays.dom': 'Dom',
  'feed.report.reasons.malicious_link': 'Link malevolo',
  'feed.report.reasons.spam': 'Spam',
  'feed.report.reasons.impersonation': 'Impersonificazione',
  'feed.report.reasons.harassment': 'Molestie / abuso',
  'feed.report.reasons.copyright': 'Violazione di copyright',
  'feed.report.reasons.other': 'Altro',
  'feed.modal.closeAria': 'Chiudi finestra',
  'feed.feedback.newApplication':
    'Nuova candidatura ricevuta nel Feed Scanlation.',
  'feed.error.loadFailed': 'Impossibile caricare il Feed Scanlation.',
  'feed.hero.back': 'Torna alla dashboard',
  'feed.hero.title': 'Reclutamento, Vetrina e Moderazione',
  'feed.hero.subtitle':
    'Pubblica annunci di lavoro, mostra le tue opere, ricevi candidature e segnala contenuti sospetti.',
  'feed.tab.recruitment': 'Reclutamento',
  'feed.tab.showcase': 'Vetrina',
  'feed.tab.moderation': 'Moderazione',
  'feed.actions.createPost': 'Crea {type}',
  'feed.alert.safety':
    'Usa solo social media e contatti legittimi. I post sospetti possono essere segnalati.',
  'feed.alert.banPolicy':
    'I post malevoli possono portare a un ban permanente per account, dispositivo e rete.',
  'feed.card.recruitmentRecent': 'Reclutamenti recenti',
  'feed.card.showcaseRecent': 'Vetrine recenti',
  'feed.card.moderationQueue': 'Coda di moderazione',
  'feed.loading': 'Caricamento feed…',
  'feed.empty.noRecruitment': 'Nessun annuncio di reclutamento trovato',
  'feed.empty.noShowcase': 'Nessuna vetrina trovata',
  'feed.empty.cleanQueue': 'La coda è vuota',
  'feed.empty.beFirst': 'Sii il primo a pubblicare un {type}!',
  'feed.empty.noModPosts': 'Nessun post nella coda di moderazione.',
  'feed.post.recruitLabel': 'Reclutamento',
  'feed.post.showcaseLabel': 'Vetrina',
  'feed.post.rolePayNegotiable': 'Da concordare',
  'feed.post.rolePayVolunteer': 'Volontario',
  'feed.post.actions.apply': 'Candidati',
  'feed.post.actions.report': 'Segnala',
  'feed.post.actions.show': 'Mostra',
  'feed.post.actions.hide': 'Nascondi',
  'feed.post.actions.ban': 'Banna',
  'feed.sidebar.profileTitle': 'Profilo autore',
  'feed.sidebar.rulesLabel':
    'Accetto le regole del feed. I link malevoli comportano un ban permanente.',
  'feed.sidebar.webhookLabel': 'Notifiche webhook Discord',
  'feed.sidebar.saveProfile': 'Salva profilo',
  'feed.sidebar.inboxTitle': 'Posta interna',
  'feed.sidebar.yourApplications': 'Le tue candidature',
  'feed.sidebar.noApplications': 'Nessuna candidatura inviata.',
  'feed.sidebar.receivedTitle': 'Ricevute',
  'feed.sidebar.noReceived': 'Nessuna candidatura ricevuta.',
  'feed.sidebar.reportsTitle': 'Segnalazioni',
  'feed.sidebar.noReports': 'Nessuna segnalazione in sospeso.',
  'feed.sidebar.banTitle': 'Ban',
  'feed.sidebar.applyBan': 'Applica ban',
  'feed.feedback.postPublishedRecruit': 'Reclutamento pubblicato.',
  'feed.feedback.postPublishedShowcase': 'Vetrina pubblicata.',
  'feed.feedback.reportSent': 'Segnalazione inviata alla moderazione.',
  'feed.feedback.profileUpdated': 'Profilo feed aggiornato.',
  'feed.feedback.applicationSent': 'Candidatura inviata.',
  'feed.feedback.banApplied': 'Ban applicato e sessioni revocate.',
  'feed.feedback.reportUpdated': 'Segnalazione aggiornata.',
  'feed.feedback.postStatusUpdated': 'Post aggiornato a {status}.',
  'feed.moderation.notes.resolved': 'Rivisto dalla moderazione.',
  'feed.moderation.notes.dismissed': 'Respinto dalla moderazione.',
  'feed.moderation.banReasonPost': 'Post moderato: {title}',
  'feed.moderation.targetUserId': 'ID utente destinatario',
  'feed.moderation.applyBan': 'Applica ban',
  'feed.error.roleDuplicate': 'Hai già aggiunto {role}.',
  'feed.error.valuePositive': 'Il valore deve essere positivo.',
  'feed.error.platformDuplicate': '{platform} già aggiunto.',
  'feed.error.platformRequired': 'Inserisci {platform}.',
  'feed.error.saveProfileFailed': 'Impossibile salvare il profilo.',
  'feed.error.publishFailed': 'Impossibile pubblicare.',
  'feed.error.applyFailed': 'Impossibile candidarsi.',
  'feed.error.reportFailed': 'Impossibile segnalare.',
  'feed.error.moderatePostFailed': 'Impossibile moderare il post.',
  'feed.error.moderateReportFailed': 'Impossibile aggiornare la segnalazione.',
  'feed.error.banFailed': 'Impossibile applicare il ban.',
  'feed.composer.typeRecruit': 'reclutamento',
  'feed.composer.typeShowcase': 'vetrina',
  'feed.composer.placeholder.titleRecruit': 'Es.: Cerchiamo traduttori',
  'feed.composer.placeholder.titleShowcase': 'Es.: Nuovo capitolo disponibile',
  'feed.composer.placeholder.bodyRecruit':
    'Spiega il progetto e come il candidato può contribuire...',
  'feed.composer.placeholder.bodyShowcase':
    'Descrivi la release e le informazioni rilevanti...',
  'feed.composer.placeholder.scanlationName': 'Nome scanlation',
  'feed.composer.placeholder.workTitle': "Titolo dell'opera",
  'feed.composer.placeholder.chapterLabel': 'Cap. 42',
  'feed.composer.placeholder.genres': 'Azione, Romantico, Fantasy',
  'feed.composer.placeholder.description': 'Descrivi questa release...',
  'feed.composer.sections.project': 'Progetto',
  'feed.composer.sections.work': 'Opera',
  'feed.composer.sections.recruitmentSettings': 'Impostazioni reclutamento',
  'feed.composer.toggle.recruiting': 'Reclutamento',
  'feed.composer.toggle.recruitingDesc': 'La tua scan accetta nuovi membri?',
  'feed.composer.toggle.paidWork': 'Lavoro retribuito',
  'feed.composer.toggle.paidWorkDesc': 'I membri riceveranno un compenso?',
  'feed.composer.requirements.label': 'Richiedi ai candidati:',
  'feed.composer.requirements.portfolio': 'Portfolio',
  'feed.composer.requirements.experience': 'Esperienza',
  'feed.composer.requirements.availability': 'Disponibilità',
  'feed.composer.requirements.contact': 'Contatto',
  'feed.composer.availability.minRequired': 'Disponibilità minima richiesta:',
  'feed.composer.availability.hoursPerWeek': 'Ore alla settimana',
  'feed.composer.availability.daysOptional': 'Giorni (opzionale)',
  'feed.composer.availability.descriptionOptional': 'Descrizione (opzionale)',
  'feed.composer.availability.placeholder':
    'Ho bisogno di qualcuno che consegni capitoli ogni settimana...',
  'feed.composer.sections.roles': 'Ruoli',
  'feed.composer.sections.rolesSub': '(aggiungi quelli che cerchi)',
  'feed.composer.roles.roleLabel': 'Ruolo',
  'feed.composer.roles.valueLabel': 'Valore (€)',
  'feed.composer.roles.valueHint': '(per capitolo)',
  'feed.composer.roles.add': 'Aggiungi',
  'feed.composer.roles.allAdded': 'Tutti i ruoli aggiunti',
  'feed.composer.roles.addBtn': 'Aggiungi ruolo',
  'feed.composer.social.title': 'Social media',
  'feed.composer.social.sub': '(almeno uno)',
  'feed.composer.social.platform': 'Piattaforma',
  'feed.composer.social.user': 'Utente',
  'feed.composer.social.url': 'URL/Link',
  'feed.composer.social.allAdded': 'Tutte le piattaforme aggiunte',
  'feed.composer.social.addBtn': 'Aggiungi social media',
  'feed.composer.sections.media': 'Media',
  'feed.composer.media.uploading': 'Invio in corso...',
  'feed.composer.media.uploadBtn': 'Carica tramite Imgur',
  'feed.apply.title': 'Invia candidatura',
  'feed.apply.message': 'Messaggio',
  'feed.apply.messagePlaceholder': 'Presentati e spiega perché vuoi unirti...',
  'feed.apply.preferredContact': 'Contatto preferito',
  'feed.apply.portfolio': 'Portfolio / link',
  'feed.apply.portfolioPlaceholder': 'Un link per riga...',
  'feed.report.title': 'Segnala post',
  'feed.report.reason': 'Motivo',
  'feed.report.details': 'Dettagli',
  'feed.report.detailsPlaceholder': 'Descrivi il problema...',
  'feed.report.send': 'Invia segnalazione',
  'freeProvider.manager.titleTranslation': 'Provider FREE (Traduzione)',
  'freeProvider.manager.titleOcr': 'Provider FREE (OCR)',
  'auth.password.hide': 'Nascondi password',
  'auth.password.show': 'Mostra password',
  'modelManager.stage.cleanImage': 'Pulisci immagine',
  'modelManager.stage.detectText': 'Rileva testo',
  'modelManager.stage.recognizeText': 'Riconosci testo',
  'modelManager.stage.segmentText': 'Segmenta Testo',
  'fillStylePopover.gradient': 'Gradiente',
  'fillStylePopover.hint.gradient':
    'Tinta unita o gradiente nello stesso selettore.',
  'fillStylePopover.hint.solid': 'Seleziona un colore pieno.',
  'klSlider.resetValue': 'Reimposta valore',
  'dashboard.aio.translation.llm.temperature': 'Temperatura',
  'dashboard.aio.translation.llm.topP': 'Top P',
  'dashboard.aio.translation.llm.maxTokens': 'Token massimi',
  'dashboard.enhance.modeTag': 'Migliora',
  'dashboard.enhance.scale.2x': '2×',
  'dashboard.enhance.scale.4x': '4×',
  'optimizer.hero.title': 'Ottimizzatore Capitolo',
  'optimizer.hero.desc':
    "Ottimizza le pagine finali per il web, la lettura o l'archiviazione.",
  'optimizer.hero.pages': 'Pagine',
  'optimizer.hero.savings': 'Risparmio',
  'optimizer.hero.saved': 'Risparmiato',
  'optimizer.hero.output': 'Output',
  'optimizer.panel.presets': 'Preset',
  'optimizer.panel.output': 'Output',
  'optimizer.panel.dimensions': 'Dimensioni',
  'optimizer.panel.filters': 'Filtri',
  'optimizer.panel.preview': 'Anteprima',
  'optimizer.presets.webLight': 'Web Leggero',
  'optimizer.presets.webLight.desc': 'Leggero per un caricamento rapido',
  'optimizer.presets.reading': 'Lettura',
  'optimizer.presets.reading.desc': 'Qualità bilanciata per i lettori',
  'optimizer.presets.archive': 'Archivio',
  'optimizer.presets.archive.desc': 'Senza perdita per la conservazione',
  'optimizer.presets.social': 'Social',
  'optimizer.presets.social.desc': 'Ottimizzato per i social media',
  'optimizer.presets.custom': 'Personalizzato',
  'optimizer.presets.custom.desc': 'Le tue impostazioni personalizzate',
  'optimizer.config.format': 'Formato',
  'optimizer.config.quality': 'Qualità',
  'optimizer.config.resize': 'Ridimensiona',
  'optimizer.config.trimBorders': 'Ritaglia bordi',
  'optimizer.config.trimTolerance': 'Tolleranza ritaglio',
  'optimizer.config.maxWidth': 'Larghezza massima',
  'optimizer.config.maxHeight': 'Altezza massima',
  'optimizer.config.sharpen': 'Nitidezza',
  'optimizer.config.sharpenStrength': 'Intensità nitidezza',
  'optimizer.config.grayscale': 'Scala di grigi',
  'optimizer.config.autoLevels': 'Livelli automatici',
  'optimizer.action.optimizing': 'Ottimizzazione in corso...',
  'optimizer.action.folder': 'Cartella',
  'optimizer.preview.generating': 'Generazione anteprima...',
  'optimizer.preview.before': 'Prima',
  'optimizer.preview.after': 'Dopo',
  'optimizer.preview.reduction': 'Riduzione',
  'optimizer.preview.dimensions': 'Dimensioni',
  'optimizer.preview.compare': 'Confronta',
  'optimizer.preview.original': 'Originale',
  'optimizer.preview.optimized': 'Ottimizzato',
  'optimizer.preview.empty': "Carica immagini per utilizzare l'ottimizzatore.",
  'optimizer.results.title': 'Risultati',
  'optimizer.results.empty':
    "Esegui l'ottimizzazione per visualizzare i risultati.",
  'optimizer.results.download': 'Scarica file',
  'optimizer.error.worker':
    "Worker non disponibile nell'Ottimizzatore Capitolo.",
  'optimizer.error.failed':
    "L'Ottimizzatore Capitolo ha riscontrato un errore.",
  'optimizer.error.preview': "Anteprima dell'ottimizzatore non riuscita.",
  'optimizer.config.brightness': 'Luminosità',
  'optimizer.config.contrast': 'Contrasto',
  'optimizer.config.noiseReduction': 'Riduzione rumore',
  'optimizer.config.noiseReductionStrength': 'Intensità riduzione rumore',
  'optimizer.config.rotation': 'Rotazione',
  'optimizer.config.rotationNone': 'Nessuna',
  'optimizer.config.renamePattern': 'Schema rinomina',
  'optimizer.config.renameHint':
    "Usa {name} per il nome originale, {index} per un numero progressivo, {ext} per l'estensione.",
  'optimizer.panel.advanced': 'Avanzate',
  'optimizer.export.folderSuccess':
    "L'Ottimizzatore Capitolo ha esportato i file nella cartella selezionata.",
  'optimizer.export.zipSuccess':
    'Pacchetto Ottimizzatore Capitolo generato con successo.',
  'resources.communities.platform.discord': 'Discord',
  'resources.communities.platform.reddit': 'Reddit',
  'resources.communities.platform.website': 'Sito web',
  'resources.communities.platform.telegram': 'Telegram',
  'dashboard.cleaner.modeTag': 'Pulizia',
  'stitch.error.loadImage': "Impossibile caricare l'immagine.",
  'stitch.error.initCanvas':
    'Impossibile inizializzare il canvas dello Stitcher.',
  'stitch.error.initTempCanvas':
    "Impossibile preparare l'immagine intermedia dello Stitcher.",
  'stitch.error.generateBlob': 'Impossibile generare il blob dello Stitcher.',
  'stitch.error.cancelled': 'Rendering annullato.',
  'stitch.error.workerFailed': 'Impossibile eseguire il worker dello Stitcher.',
  'stitch.error.generatePreview':
    "Impossibile generare l'anteprima dello Stitcher.",
  'stitch.error.exportBatch': 'Impossibile esportare il batch dello Stitcher.',
  'stitch.error.generateZip': 'Impossibile generare lo ZIP dello Stitcher.',
  'stitch.error.saveFolder': 'Impossibile salvare i batch nella cartella.',
  'dashboard.footer.runtime.fallback.label': 'Fallback',
  'watermark.blend.normal': 'Normale',
  'watermark.blend.multiply': 'Moltiplica',
  'watermark.blend.screen': 'Schermo',
  'watermark.blend.overlay': 'Sovrapponi',
  'watermark.blend.softLight': 'Luce soffusa',
  'watermark.blend.hardLight': 'Luce intensa',
  'watermark.blend.colorDodge': 'Scherma colore',
  'watermark.blend.colorBurn': 'Brucia colore',
  'watermark.panel.shadow': 'Livello ombra',
  'watermark.shadow.enable': 'Abilita ombra di sfondo',
  'watermark.shadow.blur': 'Sfocatura',
  'watermark.shadow.opacity': 'Opacità',
  'watermark.shadow.color': 'Colore',
  'watermark.shadow.offsetY': 'Offset Y',
  'watermark.panel.textAvoidance': 'Evitamento testo',
  'watermark.textAvoidance.enable': 'Evita aree di testo',
  'watermark.textAvoidance.desc':
    'Utilizza il rilevamento testo basato su IA per impedire che i watermark si sovrappongano al testo nelle immagini.',
  'watermark.textAvoidance.detecting': 'Rilevamento...',
  'watermark.textAvoidance.detectCurrent': 'Rileva corrente',
  'watermark.textAvoidance.detectAll': 'Rileva tutto',
  'watermark.textAvoidance.detected': '{{count}} aree di testo rilevate.',
  'watermark.textAvoidance.detectedAll':
    '{{count}} aree di testo rilevate in tutte le immagini.',
  'watermark.textAvoidance.failed': 'Rilevamento testo non riuscito.',
  'watermark.textAvoidance.zonesFound': 'zone',
  'watermark.textAvoidance.showOverlay': 'Mostra zone',
  'watermark.text.shadowBlur': 'Sfocatura ombra',
  'watermark.text.shadowColor': 'Colore ombra',
  'watermark.distribution.offsetX': 'Offset X',
  'watermark.distribution.offsetY': 'Offset Y',
  'watermark.distribution.density': 'Densità',
  'dashboard.dock.tooltip.hoverHint': "Tieni il cursore per vedere l'anteprima",
  'dashboard.dock.config.ariaLabel': 'Configurazione strumento attivo',
  'dashboard.dock.config.closeTitle': 'Chiudi configurazione',
  'dashboard.dock.config.closeAriaLabel': 'Chiudi configurazione strumento',
  'dashboard.dock.areaSelection.sectionTitle': 'Selezione area',
  'dashboard.dock.areaSelection.shapeLabel': 'Forma nuova selezione',
  'dashboard.dock.areaSelection.optionAuto': 'Auto',
  'dashboard.dock.areaSelection.optionSquare': 'Rettangolare',
  'dashboard.dock.areaSelection.optionRounded': 'Ellittica',
  'dashboard.dock.areaSelection.hintAuto': 'Rilevamento automatico: {kind}.',
  'dashboard.dock.areaSelection.hintFixed': 'Nuove regioni create come {mode}.',
  'dashboard.dock.areaSelection.btnDuplicate': 'Duplica',
  'dashboard.dock.areaSelection.btnToAuto': '→ Auto',
  'dashboard.dock.areaSelection.btnToSquare': '→ Rettangolare',
  'dashboard.dock.areaSelection.btnToRounded': '→ Ellittica',
  'dashboard.dock.segment.brushTitle': 'Pennello segmentazione',
  'dashboard.dock.segment.eraserTitle': 'Gomma segmentazione',
  'dashboard.dock.segment.sizeLabel': 'Dimensione',
  'dashboard.dock.segment.hint':
    'Regola il raggio per modificare le aree segmentate.',
  'dashboard.dock.imageTool.paintTitle': 'Pennello',
  'dashboard.dock.imageTool.eraserTitle': 'Gomma',
  'dashboard.dock.imageTool.healingTitle': 'Pennello correttivo',
  'dashboard.dock.imageTool.sizeLabel': 'Dimensione',
  'dashboard.dock.imageTool.opacityLabel': 'Opacità',
  'dashboard.dock.imageTool.blurLabel': 'Sfocatura',
  'dashboard.dock.imageTool.colorLabel': 'Colore',
  'dashboard.dock.imageTool.colorAriaLabel': 'Colore pennello',
  'dashboard.dock.magicWand.title': 'Bacchetta magica',
  'dashboard.dock.magicWand.toleranceLabel': 'Tolleranza',
  'dashboard.dock.magicWand.healingBtnTitle':
    'Applica inpainting alla selezione della bacchetta',
  'dashboard.dock.magicWand.healingBtnBusy': 'Applicazione…',
  'dashboard.dock.magicWand.healingBtn': 'Correttivo',
  'dashboard.dock.magicWand.clearBtn': 'Cancella',
  'dashboard.dock.imageTool.modelHint': 'Modello: ',
  'dashboard.dock.palette.ariaLabel': 'Strumenti immagine manuali',
  'dashboard.dock.config.closeLabel': 'Chiudi configurazione',
  'dashboard.dock.config.openLabel': 'Apri configurazione',
  'dashboard.dock.config.badge': 'Config',
  'dashboard.dock.config.description':
    'Apre il pannello contestuale dello strumento attivo per regolare forma, dimensione, opacità, tolleranza e altri controlli avanzati.',
  'dashboard.dock.config.disabledReason':
    'Attiva uno strumento con parametri modificabili per aprire la configurazione.',
  'dashboard.dock.divider.reg': 'Reg',
  'dashboard.dock.areaSelect.ariaLabel': 'Seleziona area',
  'dashboard.dock.areaSelect.title': 'Seleziona area',
  'dashboard.dock.areaSelect.description':
    "Crea, regola e rifinisci le regioni di testo nell'anteprima. Ideale per correggere le bolle rilevate prima dell'OCR, traduzione o rendering.",
  'dashboard.dock.areaSelect.badge': 'Reg',
  'dashboard.dock.areaSelect.disabledReason':
    "Disponibile nelle fasi Rileva e Rendering dell'AIO manuale.",
  'dashboard.dock.clearPage.ariaLabel': 'Cancella tutte le regioni',
  'dashboard.dock.clearPage.title': 'Cancella pagina',
  'dashboard.dock.clearPage.description':
    'Rimuove tutte le regioni su questa pagina in una volta, così puoi ricominciare la marcatura manuale senza residui.',
  'dashboard.dock.clearPage.badge': 'Reset',
  'dashboard.dock.clearPage.disabledReason':
    "Devi essere in Rileva/Rendering e avere già regioni create sull'immagine attiva.",
  'dashboard.dock.divider.seg': 'Seg',
  'dashboard.dock.segBrush.ariaLabel': 'Pennello area segmentata',
  'dashboard.dock.segBrush.title': 'Pennello segmentazione',
  'dashboard.dock.segBrush.description':
    'Espande la maschera di segmentazione per recuperare lettere, contorni o pezzi di fumetto esclusi.',
  'dashboard.dock.segBrush.badge': 'Seg',
  'dashboard.dock.segBrush.disabledReason':
    'Disponibile durante la fase Segmenta Testo.',
  'dashboard.dock.segEraser.ariaLabel': 'Gomma area segmentata',
  'dashboard.dock.segEraser.title': 'Gomma segmentazione',
  'dashboard.dock.segEraser.description':
    'Rifinisce la maschera rimuovendo selezioni in eccesso, sbavature e artefatti che non dovrebbero essere inclusi nella pulizia.',
  'dashboard.dock.segEraser.badge': 'Seg',
  'dashboard.dock.segEraser.disabledReason':
    'Disponibile durante la fase Segmenta Testo.',
  'dashboard.dock.divider.img': 'Img',
  'dashboard.dock.paint.ariaLabel': 'Pennello pittura',
  'dashboard.dock.paint.title': 'Pennello',
  'dashboard.dock.paint.description':
    "Dipingi sopra artefatti, difetti di inpainting o dettagli che richiedono micro-correzione direttamente sull'immagine.",
  'dashboard.dock.paint.badge': 'Img',
  'dashboard.dock.paint.disabledReason':
    "Entra in modalità manuale e seleziona un'immagine attiva da modificare.",
  'dashboard.dock.paintEraser.ariaLabel': 'Gomma pittura',
  'dashboard.dock.paintEraser.title': 'Gomma',
  'dashboard.dock.paintEraser.description':
    'Cancella solo il livello di pittura manuale per annullare le modifiche senza perdere il resto dei rilevamenti e delle maschere.',
  'dashboard.dock.paintEraser.badge': 'Img',
  'dashboard.dock.paintEraser.disabledReason':
    "Entra in modalità manuale e seleziona un'immagine attiva da modificare.",
  'dashboard.dock.wand.ariaLabel': 'Bacchetta magica',
  'dashboard.dock.wand.title': 'Bacchetta magica',
  'dashboard.dock.wand.description':
    "Seleziona rapidamente un'area contigua per colore/tolleranza per una correzione precisa o rimozione di residui.",
  'dashboard.dock.wand.badge': 'Img',
  'dashboard.dock.wand.disabledReason':
    "Entra in modalità manuale e seleziona un'immagine attiva da modificare.",
  'dashboard.dock.healing.ariaLabel': 'Pennello correttivo',
  'dashboard.dock.healing.title': 'Pennello correttivo',
  'dashboard.dock.healing.description':
    'Applica inpainting localizzato su difetti, bordi rotti e residui di testo mantenendo una texture circostante più naturale.',
  'dashboard.dock.healing.badge': 'Img',
  'dashboard.dock.healing.disabledReason':
    "Entra in modalità manuale e seleziona un'immagine attiva da modificare.",
  'dashboard.dock.clearPaint.ariaLabel': 'Cancella pittura',
  'dashboard.dock.clearPaint.title': 'Cancella pittura',
  'dashboard.dock.clearPaint.description':
    "Cancella l'intero livello di pittura manuale dall'immagine attiva senza reimpostare altre correzioni o la cronologia della fase.",
  'dashboard.dock.clearPaint.badge': 'Reset',
  'dashboard.dock.clearPaint.disabledReason':
    "Visibile solo quando l'immagine attiva ha già pittura manuale applicata.",
  'dashboard.dock.resetEdits.ariaLabel': 'Reimposta tutte le modifiche',
  'dashboard.dock.resetEdits.title': 'Reimposta modifiche',
  'dashboard.dock.resetEdits.description':
    "Riporta l'immagine attiva allo stato originale della fase manuale, rimuovendo pittura, correzione, selezione bacchetta e sovrascritture locali.",
  'dashboard.dock.resetEdits.badge': 'Reset',
  'dashboard.dock.resetEdits.disabledReason':
    "Disponibile quando l'immagine attiva ha già ricevuto qualche intervento manuale.",
  'modelManager.stage.automaticAiClean': 'Pulizia AI Automatica',
  'resources.fonts.downloadLabel': 'Scarica',
  'dashboard.sidebar.supportedFormats':
    'JPG, PNG, WEBP, ZIP, PDF, CBZ, CB7, PSD',
  'dashboard.cleaner.ocr.label': 'OCR',
  'dashboard.cleaner.ai.defaultProvider': 'Cloud / API / AI',
  'bugReport.screenshot.alt': 'Screenshot',
  'pageTransition.loading.ariaLabel': 'Caricamento',
  'watermark.text.placeholder': 'KŌMA Studio',
  'watermark.logo.alt': 'Logo',
  'dashboard.textDetection.regionActions.aria': 'Azioni regione',
  'dashboard.textDetection.manualModeRequired': 'Modalità manuale richiesta',
  'dashboard.textDetection.removeRegion': 'Rimuovi regione',
  'dashboard.renderText.rewind.title': 'Riavvolgi questa immagine',
  'dashboard.renderText.forward.title': 'Avanza questa immagine',
  'dashboard.renderText.noHistory':
    'Nessuna cronologia AIO per questa immagine',
  'dashboard.renderText.editPlaceholder': 'Digita il testo finale...',
  'dashboard.renderText.editAria': 'Modifica testo renderizzato',
  'dashboard.renderText.removeSelection.title': 'Rimuovi selezione',
  'dashboard.renderText.regionActions.aria': 'Azioni regione',
  'dashboard.pipeline.prevStep.title':
    'Torna alla fase precedente della pipeline AIO',
  'dashboard.pipeline.nextStep.title':
    'Avanza alla fase successiva della pipeline AIO',
  'dashboard.pipeline.runStep.title':
    "Esegui solo la fase corrente per l'immagine selezionata",
  'dashboard.pipeline.skipStep.title':
    'Salta la fase corrente e sblocca la successiva',
  'dashboard.typesetter.applyStyleAll.title':
    'Applica lo stile della selezione corrente a tutte le regioni',
  'auth.error.internetRequired':
    "È necessario l'accesso a Internet per accedere all'app.",
  'auth.error.mandatoryUpdate':
    "Aggiornamento obbligatorio disponibile. Aggiorna l'app per continuare.",
  'dashboard.textDetection.noTextRecognized': 'Nessun testo riconosciuto',
  'dashboard.textDetection.noTranslation': 'Nessuna traduzione disponibile',
  'dashboard.textDetection.noNt': 'Nessuna NT disponibile',
  'dashboard.renderText.dblClickToEdit': 'doppio clic per modificare',
  'dashboard.renderText.renderNotApplied':
    'rendering non applicato in questa fase',
  'dashboard.status.stageLabelTranslation': 'Traduzione',
  'dashboard.status.profilesPersistedDesktopSecure':
    'Profili personalizzati salvati sul desktop con archiviazione sicura.',
  'dashboard.status.profilesPersistedDesktopLocal':
    'Profili personalizzati salvati sul desktop senza crittografia nativa disponibile.',
  'dashboard.status.profilesPersistedBrowser':
    'Profili personalizzati salvati nel browser locale di questo dispositivo.',
  'dashboard.status.aioScopeManual': 'AIO manuale',
  'dashboard.status.aioScopeAuto': 'AIO automatico',
  'dashboard.status.cleanerSelectProfileFirst':
    'Seleziona un profilo visivo salvato da utilizzare con la Pulizia AI Automatica.',
  'dashboard.status.cleanerProfileNotFound':
    'Profilo visivo non trovato. Ricarica e riprova.',
  'dashboard.status.cleanerProfileInUse':
    'Profilo visivo in uso per la Pulizia AI Automatica: {label}.',
  'dashboard.status.cleanerSelectValidModel':
    'Seleziona un modello valido per la Pulizia AI Automatica.',
  'dashboard.status.modelInRoadmap':
    'Il modello "{name}" è ancora nella roadmap.',
  'dashboard.status.modelNeedsConfig':
    'Il modello "{name}" richiede configurazione prima dell\'uso.',
  'dashboard.status.translatorSfxSelectValidModel':
    "Seleziona un modello valido per l'AI SFX del Traduttore.",
  'dashboard.status.cleanerProfileSaved':
    'Profilo visivo salvato e selezionato per la Pulizia AI Automatica: {label}.',
  'dashboard.status.cleanerSelectProfileToRemove':
    'Seleziona un profilo visivo salvato da rimuovere.',
  'dashboard.status.customProfilePendingSync':
    'Profilo personalizzato in attesa di sincronizzazione locale.',
  'dashboard.status.customProfileOcrPendingSync':
    'Profilo OCR personalizzato in attesa di sincronizzazione locale.',
  'dashboard.status.presetAppliedToSelection':
    'Preset "{name}" applicato alla selezione corrente.',
  'dashboard.status.legacyPresetNotFound':
    'Preset visivo legacy {modeKey} non trovato.',
  'dashboard.status.presetAppliedShort':
    'Preset "{name}" applicato alla selezione.',
  'dashboard.status.presetAppliedToImage':
    'Preset "{name}" applicato all\'immagine attiva.',
  'dashboard.status.typographerSelectionDuplicated':
    'Selezione duplicata nel Compositore.',
  'dashboard.status.autoShapeApplied': 'Forma automatica applicata: {shape}.',
  'dashboard.status.renderStyleAppliedAll':
    'Stile di rendering applicato a tutte le selezioni in tutte le immagini.',
  'dashboard.status.canvasInitFailed':
    'Impossibile inizializzare il canvas di composizione manuale.',
  'dashboard.status.cleanerCanvasInitFailed':
    'Impossibile inizializzare il canvas di composizione manuale del Pulitore.',
  'dashboard.status.wandPrepFailed':
    'Impossibile preparare la bacchetta magica.',
  'dashboard.status.wandSelectionUpdated':
    "Selezione bacchetta aggiornata. Usa Correttivo per applicare l'inpainting.",
  'dashboard.status.wandNoArea':
    "La bacchetta non ha trovato un'area compatibile per la selezione.",
  'dashboard.status.wandExecFailed':
    'Impossibile eseguire la bacchetta magica.',
  'dashboard.status.cleanerWandPrepFailed':
    'Impossibile preparare la bacchetta magica del Pulitore.',
  'dashboard.status.cleanerWandSelectionUpdated':
    "Selezione bacchetta del Pulitore aggiornata. Usa Correttivo per applicare l'inpainting.",
  'dashboard.status.cleanerWandNoArea':
    "La bacchetta del Pulitore non ha trovato un'area compatibile per la selezione.",
  'dashboard.status.cleanerWandExecFailed':
    'Impossibile eseguire la bacchetta magica del Pulitore.',
  'dashboard.status.healingInvalidResponse':
    "Risposta non valida durante l'applicazione del Pennello correttivo.",
  'dashboard.status.cleanerHealingInvalidResponse':
    "Risposta non valida durante l'applicazione del Pennello correttivo nel Pulitore.",
  'dashboard.status.cleanerHealingConnectFailed':
    'Connessione del Correttivo del Pulitore al backend ({url}) non riuscita. Verifica che il mini-backend sia attivo.',
  'dashboard.status.cleanerHealingFailed':
    'Impossibile applicare il Pennello correttivo nel Pulitore.',
  'dashboard.status.wandNoSelectionForHealing':
    'Nessuna selezione bacchetta su cui applicare la correzione.',
  'dashboard.status.renderCanvasInitFailed':
    'Impossibile inizializzare il canvas di rendering.',
  'dashboard.status.aioCompleteAdjust':
    '{message} Regola manualmente se necessario.',
  'dashboard.status.aioAborted': 'Esecuzione AIO interrotta.',
  'dashboard.alert.importWorkspaceConfirm':
    "L'importazione di questo spazio di lavoro sostituirà quello attualmente in memoria. Vuoi continuare?",
  'dashboard.alert.clearAutosaveConfirm':
    "La cancellazione del salvataggio automatico locale rimuove l'ultimo spazio di lavoro salvato su questo PC per questo utente. Continuare?",
  'dashboard.alert.closeWorkspaceConfirm':
    "Chiudere lo spazio di lavoro corrente? Questa operazione rimuoverà tutte le immagini caricate e il salvataggio automatico locale. L'azione non può essere annullata.",
  'dashboard.status.workspacePendingChanges':
    'Lo spazio di lavoro ha modifiche in sospeso.',
  'dashboard.status.toolSelectArea': 'Seleziona area',
  'dashboard.status.toolSegmentBrush': 'Pennello segmentazione',
  'dashboard.status.toolSegmentEraser': 'Gomma segmentazione',
  'dashboard.alert.emailPendingTitle': 'Email in attesa di conferma',
  'dashboard.alert.emailPendingText':
    'Conferma la tua email per eseguire azioni di elaborazione.',
  'dashboard.status.typographerSession': 'Sessione Compositore',
  'dashboard.status.cleanerMeta':
    'OCR: {ocrCount} • Segmentati: {segmentedCount} • Puliti: {cleaned}',
  'dashboard.status.metaOk': 'ok',
  'dashboard.status.metaPending': 'in sospeso',
  'dashboard.status.cleanerRunFirst':
    "Esegui il Pulitore per generare OCR, segmentazione e un'immagine pulita.",
  'dashboard.status.translatorMeta':
    'Rilevamento: {detected} • OCR: {ocr} • Traduzione: {translated}',
  'dashboard.status.translatorRunFirst':
    'Esegui il Traduttore Visivo per rilevare, riconoscere e tradurre.',
  'dashboard.status.localModelDownloadHint':
    'I modelli locali vengono scaricati su richiesta; i modelli cloud/API continuano a utilizzare una chiave.',
  'dashboard.status.selectionTextModeAria':
    'Modalità testo della selezione corrente',
  'dashboard.status.translatorUsesAioModel':
    "Il Traduttore utilizza la stessa selezione modello dell'AIO; esegui di nuovo dopo aver cambiato modello.",
  'dashboard.status.translatorLocalModelIncompatible':
    'Il modello locale corrente non supporta la coppia linguistica del Traduttore. Scegli un altro modello o usa il cloud.',
  'dashboard.status.stitchLastMoved':
    'Ultima immagine spostata al batch successivo.',
  'dashboard.status.stitchFirstPulled':
    'Prima immagine del batch successivo aggiunta al batch corrente.',
  'auth.error.generic': 'Errore {status}',
  'auth.error.desktopBridgeUnavailable':
    'Bridge di autenticazione desktop non disponibile.',
  'dashboard.status.modeLabel': 'Modalità',
  'dashboard.status.selectedLabel': 'Selezionato',
  'dashboard.status.selectBoxInPreview':
    "Seleziona un riquadro nell'anteprima.",
  'dashboard.status.selectTranslatorModel':
    'Seleziona un modello locale o cloud per tradurre nel Traduttore.',
  'dashboard.error.loadHardwareFailed':
    "Impossibile caricare l'hardware locale.",
  'dashboard.error.healingBrushFailed':
    'Pennello correttivo non riuscito: {message}',
  'dashboard.status.healingBrushApplyFailed':
    'Impossibile applicare il Pennello correttivo.',
  'dashboard.error.cleanerHealingBrushFailed':
    'Pennello correttivo del Pulitore non riuscito: {message}',
  'dashboard.status.aioExecutionFailed': "Impossibile eseguire l'AIO.",
  'dashboard.status.autosaveSaveFailed':
    'Impossibile effettuare il salvataggio automatico locale.',
  'dashboard.status.workspaceExportFailed':
    'Impossibile esportare lo spazio di lavoro.',
  'dashboard.status.workspaceImportFailed':
    'Impossibile importare lo spazio di lavoro.',
  'dashboard.status.autosaveClearFailed':
    'Impossibile cancellare il salvataggio automatico locale.',
  'dashboard.status.noModelSelected': 'Nessun modello selezionato.',
  'dashboard.status.aiCleanModelSelected':
    'Modello selezionato per la Pulizia AI Automatica: {model}',
  'dashboard.status.selectionMode': 'Modalità selezione',
  'dashboard.status.workspaceRestored': 'Spazio di lavoro ripristinato.',
  'dashboard.status.workspaceRestoredFromAutosave':
    'Spazio di lavoro ripristinato dal salvataggio automatico locale.',
  'dashboard.aio.skip': 'Salta',
  'dashboard.aio.imageLabel': 'Immagine:',
  'dashboard.aio.stepLabel': 'Fase:',
  'dashboard.aio.historyHint': 'Fase: {label} ({current}/{total})',
  'dashboard.typo.fontsUpdating': 'Aggiornamento…',
  'dashboard.typo.updateFonts': 'Aggiorna font',
  'dashboard.typo.importFontTitle': 'Importa font personalizzato',
  'dashboard.typo.desktopOnly': 'Solo app desktop',
  'dashboard.typo.fontImporting': 'Importazione…',
  'dashboard.typo.importFont': 'Importa font',
  'dashboard.typo.applyStyleToAll': 'Applica stile a tutti',
  'dashboard.typo.fontControlsHint':
    "I controlli per font/colore/allineamento si trovano nella barra contestuale dell'overlay. Scorciatoia:",
  'dashboard.aio.languageLabel': 'Lingua:',
  'shortcuts.category.global': 'Globale',
  'shortcuts.category.modes': 'Modalità',
  'shortcuts.category.typesetter': 'Compositore',
  'shortcuts.noShortcut': 'Nessuna scorciatoia',
  'shortcuts.openShortcutModal.label': 'Apri centro scorciatoie',
  'shortcuts.openShortcutModal.description':
    'Apre la finestra di scorciatoie e configurazione.',
  'shortcuts.toggleToolsPanel.label': 'Mostra/nascondi pannello strumenti',
  'shortcuts.toggleToolsPanel.description':
    'Alterna la visibilità del pannello strumenti.',
  'shortcuts.rotateActiveImage.label': 'Ruota immagine attiva',
  'shortcuts.rotateActiveImage.description':
    "Ruota l'immagine selezionata di 90 gradi.",
  'shortcuts.workspaceSave.label': 'Salva spazio di lavoro locale',
  'shortcuts.workspaceSave.description':
    'Forza un salvataggio automatico locale dello spazio di lavoro corrente.',
  'shortcuts.workspaceUndo.label': 'Annulla spazio di lavoro',
  'shortcuts.workspaceUndo.description':
    "Annulla l'ultima modifica nello spazio di lavoro corrente.",
  'shortcuts.workspaceRedo.label': 'Ripristina spazio di lavoro',
  'shortcuts.workspaceRedo.description':
    "Ripristina l'ultima modifica annullata nello spazio di lavoro corrente.",
  'shortcuts.zoomIn.label': 'Zoom avanti',
  'shortcuts.zoomIn.description': 'Ingrandisce la vista corrente.',
  'shortcuts.zoomOut.label': 'Zoom indietro',
  'shortcuts.zoomOut.description': 'Riduce la vista corrente.',
  'shortcuts.setViewPaginated.label': 'Vista paginata',
  'shortcuts.setViewPaginated.description': 'Passa alla vista paginata.',
  'shortcuts.setViewLongStrip.label': 'Vista a striscia lunga',
  'shortcuts.setViewLongStrip.description':
    'Passa alla vista a striscia lunga.',
  'shortcuts.setModeOrganize.label': 'Modalità Organizza',
  'shortcuts.setModeOrganize.description': 'Passa alla modalità Organizza.',
  'shortcuts.setModeAio.label': 'Modalità AIO',
  'shortcuts.setModeAio.description': 'Passa alla modalità AIO.',
  'shortcuts.setModeCleaner.label': 'Modalità Pulitore / Ridisegnatore',
  'shortcuts.setModeCleaner.description':
    'Passa alla modalità Pulitore / Ridisegnatore.',
  'shortcuts.setModeTypesetter.label': 'Modalità Compositore',
  'shortcuts.setModeTypesetter.description': 'Passa alla modalità Compositore.',
  'shortcuts.setModeTranslator.label': 'Modalità Traduttore',
  'shortcuts.setModeTranslator.description': 'Passa alla modalità Traduttore.',
  'shortcuts.setModeRaw.label': 'Modalità Provider Raw',
  'shortcuts.setModeRaw.description': 'Passa alla modalità Provider Raw.',
  'shortcuts.setModeProofreader.label': 'Modalità Revisore / QC',
  'shortcuts.setModeProofreader.description':
    'Passa alla modalità Revisore / QC.',
  'shortcuts.setModeStitch.label': 'Modalità Unione',
  'shortcuts.setModeStitch.description': 'Passa alla modalità Unione.',
  'shortcuts.setModeSplit.label': 'Modalità Divisione Intelligente',
  'shortcuts.setModeSplit.description':
    'Passa alla modalità Divisione Intelligente.',
  'shortcuts.setModeWatermark.label': 'Modalità Watermark',
  'shortcuts.setModeWatermark.description': 'Passa alla modalità Watermark.',
  'shortcuts.setModeEnhance.label': 'Modalità Migliora Immagine',
  'shortcuts.setModeEnhance.description':
    'Passa alla modalità Migliora Immagine.',
  'shortcuts.setModeGuides.label': 'Modalità Guide',
  'shortcuts.setModeGuides.description': 'Passa alla modalità Guide.',
  'shortcuts.setModeResources.label': 'Modalità Risorse',
  'shortcuts.setModeResources.description': 'Passa alla modalità Risorse.',
  'shortcuts.applyText.label': 'Applica testo',
  'shortcuts.applyText.description':
    "Applica l'elemento selezionato dalla coda nel Compositore o nel rendering manuale AIO.",
  'shortcuts.nextRegion.label': 'Seleziona regione successiva',
  'shortcuts.nextRegion.description':
    'Sposta la selezione alla regione successiva nel Compositore o AIO manuale.',
  'shortcuts.previousRegion.label': 'Seleziona regione precedente',
  'shortcuts.previousRegion.description':
    'Sposta la selezione alla regione precedente nel Compositore o AIO manuale.',
  'shortcuts.toggleMultiBubble.label': 'Attiva/disattiva multi-fumetto',
  'shortcuts.toggleMultiBubble.description':
    'Attiva/disattiva il raggruppamento multi-fumetto nel Compositore o AIO manuale.',
  'shortcuts.saveSnapshot.label': 'Salva snapshot',
  'shortcuts.saveSnapshot.description':
    'Salva uno snapshot della sessione del Compositore o AIO manuale.',
  'shortcuts.detectShapes.label': 'Rileva/rifinisci forma',
  'shortcuts.detectShapes.description':
    'Esegue il rilevamento o la rifinitura della forma selezionata nel Compositore o AIO manuale.',
  'shortcuts.applyActivePreset.label': 'Applica preset attivo',
  'shortcuts.applyActivePreset.description':
    'Applica il preset tipografico attivo alla regione selezionata.',
  'shortcuts.applyLegacyPresetTextBubble.label':
    'Applica preset Legacy text_bubble',
  'shortcuts.applyLegacyPresetTextBubble.description':
    'Applica il preset visivo Legacy text_bubble alla regione selezionata.',
  'shortcuts.applyLegacyPresetTextFree.label':
    'Applica preset Legacy text_free',
  'shortcuts.applyLegacyPresetTextFree.description':
    'Applica il preset visivo Legacy text_free alla regione selezionata.',
  'shortcuts.applyLegacyPresetTextSfx.label': 'Applica preset Legacy text_sfx',
  'shortcuts.applyLegacyPresetTextSfx.description':
    'Applica il preset visivo Legacy text_sfx alla regione selezionata.',
  'shortcuts.applyLegacyPresetTextNarration.label':
    'Applica preset Legacy text_narration',
  'shortcuts.applyLegacyPresetTextNarration.description':
    'Applica il preset visivo Legacy text_narration alla regione selezionata.',
  'shortcuts.applyLegacyPresetTextInsideBlackBubble.label':
    'Applica preset Legacy text_inside_black_bubble',
  'shortcuts.applyLegacyPresetTextInsideBlackBubble.description':
    'Applica il preset visivo Legacy text_inside_black_bubble alla regione selezionata.',
  'shortcuts.applyAutoShape.label': 'Applica forma automatica',
  'shortcuts.applyAutoShape.description':
    'Sceglie automaticamente tra ellittica e rettangolare per la regione selezionata.',
  'shortcuts.convertShapeSquare.label': 'Converti forma in rettangolare',
  'shortcuts.convertShapeSquare.description':
    'Converte la regione selezionata in forma rettangolare.',
  'shortcuts.convertShapeRounded.label': 'Converti forma in ellittica',
  'shortcuts.convertShapeRounded.description':
    'Converte la regione selezionata in forma ellittica.',
  'shortcuts.deleteRegion.label': 'Rimuovi regione selezionata',
  'shortcuts.deleteRegion.description':
    "Rimuove la regione selezionata nell'AIO manuale, Compositore, Traduttore Visivo o Pulitore.",
  'shortcuts.editInline.label': 'Apri modifica inline regione',
  'shortcuts.editInline.description':
    'Apre la modifica inline per la regione selezionata nel rendering manuale.',
  'shortcuts.inlineEditorCancel.label': 'Annulla modifica inline',
  'shortcuts.inlineEditorCancel.description':
    "Disponibile solo all'interno dell'area di testo per la modifica inline.",
  'shortcuts.inlineEditorSave.label': 'Salva modifica inline',
  'shortcuts.inlineEditorSave.description':
    "Disponibile solo all'interno dell'area di testo per la modifica inline.",
  'shortcuts.category.palette': 'Tavolozza strumenti',
  'shortcuts.duplicateRegion.label': 'Duplica regione selezionata',
  'shortcuts.duplicateRegion.description':
    'Duplica la regione selezionata nel Compositore o AIO manuale con un offset di 18px.',
  'shortcuts.toolConfigToggle.label':
    'Attiva/disattiva pannello configurazione',
  'shortcuts.toolConfigToggle.description':
    'Apre o chiude il pannello di configurazione dello strumento attivo nella tavolozza.',
  'shortcuts.toolAreaSelect.label': 'Strumento: Selezione area',
  'shortcuts.toolAreaSelect.description':
    "Attiva lo strumento di selezione area nell'AIO manuale.",
  'shortcuts.toolClearRegions.label': 'Cancella tutte le regioni',
  'shortcuts.toolClearRegions.description':
    "Rimuove tutte le regioni dall'immagine attiva nell'AIO manuale.",
  'shortcuts.toolSegmentBrush.label': 'Strumento: Pennello segmentazione',
  'shortcuts.toolSegmentBrush.description':
    'Attiva il pennello per la modifica manuale della maschera di segmentazione.',
  'shortcuts.toolSegmentEraser.label': 'Strumento: Gomma segmentazione',
  'shortcuts.toolSegmentEraser.description':
    'Attiva la gomma per la modifica manuale della maschera di segmentazione.',
  'shortcuts.toolPaint.label': 'Strumento: Pittura',
  'shortcuts.toolPaint.description':
    "Attiva lo strumento di pittura manuale sull'immagine.",
  'shortcuts.toolPaintEraser.label': 'Strumento: Gomma pittura',
  'shortcuts.toolPaintEraser.description':
    'Attiva la gomma per cancellare il livello di pittura manuale.',
  'shortcuts.toolMagicWand.label': 'Strumento: Bacchetta magica',
  'shortcuts.toolMagicWand.description':
    'Attiva la bacchetta magica per la selezione basata su tolleranza colore.',
  'shortcuts.toolHealingBrush.label': 'Strumento: Pennello correttivo',
  'shortcuts.toolHealingBrush.description':
    "Attiva il pennello correttivo per il restauro dell'immagine.",
  'shortcuts.toolClearPaint.label': 'Cancella livello pittura',
  'shortcuts.toolClearPaint.description':
    "Rimuove l'intero livello di pittura manuale dall'immagine attiva.",
  'shortcuts.toolResetEdits.label': 'Reimposta modifiche manuali',
  'shortcuts.toolResetEdits.description':
    "Annulla tutte le modifiche manuali sull'immagine attiva nel Pulitore o AIO.",
  'dashboard.coachmark.stage.titleSuffix': 'area di lavoro principale',
  'dashboard.coachmark.stage.bodyWithImages':
    "Qui vedi l'immagine attiva, verifichi il risultato visivo della modalità <strong>{modeLabel}</strong> e apporti modifiche con feedback immediato.",
  'dashboard.coachmark.stage.bodyWithoutImages':
    "Quando carichi le immagini, quest'area diventa il centro visivo della modalità <strong>{modeLabel}</strong>. È qui che il risultato appare per primo.",
  'dashboard.coachmark.stage.accent': 'Area',
  'dashboard.coachmark.tools.titleSuffix': 'strumenti',
  'dashboard.coachmark.tools.body':
    'Usa la barra laterale destra per configurare opzioni, preset e azioni per la modalità <strong>{modeLabel}</strong>. Se qualcosa cambia nel flusso, di solito parte da qui.',
  'dashboard.coachmark.tools.accent': 'Strumenti',
  'dashboard.coachmark.download.titleSuffix': 'esportazione',
  'dashboard.coachmark.download.body':
    'Quando il risultato è corretto, finalizza tramite il menu di esportazione per scaricare immagini, pacchetti o PSD senza uscire dalla modalità corrente.',
  'dashboard.coachmark.download.accent': 'Consegna',
  'dashboard.coachmark.organize.uploadTitle':
    'Organizza: inizia con il caricamento',
  'dashboard.coachmark.organize.uploadBody':
    'Trascina pagine, capitoli o interi pacchetti qui. La modalità Organizza serve a preparare il batch prima di entrare in produzione.',
  'dashboard.coachmark.organize.uploadAccent': 'Input',
  'dashboard.coachmark.organize.orderTitle': "Organizza: controlla l'ordine",
  'dashboard.coachmark.organize.orderBody':
    "Nella barra laterale sinistra scegli l'immagine attiva, riordini le pagine, rimuovi elementi indesiderati e verifichi se il capitolo è pronto per procedere.",
  'dashboard.coachmark.organize.orderAccent': 'Batch',
  'dashboard.coachmark.aioAuto.pipelineTitle':
    'AIO Automatico: lascia la pipeline lavorare',
  'dashboard.coachmark.aioAuto.pipelineBody':
    'In modalità automatica, configuri una volta ed elabori il batch in sequenza. Ideale per la produttività, la revisione post-elaborazione e i flussi di lavoro più ripetitivi.',
  'dashboard.coachmark.aioAuto.pipelineAccent': 'Auto',
  'dashboard.coachmark.aioAuto.stagesTitle':
    'AIO Automatico: abilita solo ciò che serve',
  'dashboard.coachmark.aioAuto.stagesBody':
    'Abilita solo le fasi che hanno senso per questo batch. Meno fasi significa meno costi, meno tempo e meno punti di errore.',
  'dashboard.coachmark.aioAuto.stagesAccent': 'Pipeline',
  'dashboard.coachmark.aioAuto.configTitle':
    'AIO Automatico: imposta modelli e lingue',
  'dashboard.coachmark.aioAuto.configBody':
    "Scegli lingue, preset e modelli prima di eseguire. Questa è la parte che influenza di più velocità, qualità e costo dell'elaborazione.",
  'dashboard.coachmark.aioAuto.configAccent': 'Configurazione',
  'dashboard.coachmark.aioManual.title': 'AIO Manuale: lavora fase per fase',
  'dashboard.coachmark.aioManual.body':
    'In modalità manuale, esegui, rivedi e correggi ogni fase con maggiore controllo. È la modalità ideale per rifiniture precise e recupero di casi difficili.',
  'dashboard.coachmark.aioManual.accent': 'Manuale',
  'dashboard.coachmark.aioManual.dockTitle':
    'AIO Manuale: usa la dock come banco di lavoro',
  'dashboard.coachmark.aioManual.dockBody':
    "La dock mobile riunisce selezione, segmentazione, pittura, bacchetta e correzione. Pensala come il mini-pannello di intervento rapido sopra l'anteprima.",
  'dashboard.coachmark.aioManual.dockAccent': 'Dock',
  'dashboard.coachmark.typesetter.titleManual': 'Compositore Manuale',
  'dashboard.coachmark.typesetter.titleAuto': 'Compositore Automatico',
  'dashboard.coachmark.typesetter.bodyManual':
    'La modalità manuale è ideale per micro-regolazioni su fumetti, forme, font e ritmo visivo per pagina.',
  'dashboard.coachmark.typesetter.bodyAuto':
    'La modalità automatica accelera le bozze e i batch grandi. Completa con una rapida revisione visiva per garantire la coerenza.',
  'dashboard.coachmark.typesetter.accentManual': 'Manuale',
  'dashboard.coachmark.typesetter.accentAuto': 'Auto',
  'dashboard.coachmark.cleaner.dockTitle':
    "Pulitore: correzione locale senza uscire dall'immagine",
  'dashboard.coachmark.cleaner.dockBody':
    'Quando la dock è visibile, usa pennello, gomma e correttivo per rifinire i dettagli senza perdere il contesto della pagina.',
  'dashboard.coachmark.cleaner.dockAccent': 'Dock',
  'dashboard.coachmark.content.titleSuffix': 'navigazione contenuti',
  'dashboard.coachmark.content.body':
    "Questa modalità sostituisce l'area visiva con un pannello di riferimento. Usala per imparare i flussi di lavoro, consultare materiale di supporto e tornare alla produzione con meno attrito.",
  'dashboard.coachmark.content.accent': 'Riferimento',
  'dashboard.coachmark.progress': 'Guida {{current}} / {{total}}',
  'dashboard.coachmark.next': 'Avanti',
  'dashboard.coachmark.prev': 'Indietro',
  'dashboard.coachmark.done': 'Capito',
  'aioModel.label.unavailable': ' (non disponibile)',
  'aioModel.label.notInstalled': '(Non installato — clicca per installare)',
  'aioModel.label.updateAvailable': '(Aggiornamento disponibile)',
  'aioModel.label.installed': '(Installato)',
  'aioModel.status.selectAndInstall':
    'Seleziona e installa un modello locale per la fase "{stage}".',
  'aioModel.status.installBeforeUse':
    'Installa il modello "{name}" prima di utilizzare questa fase.',
  'aioModel.status.selectValidOcr': "Seleziona un modello valido per l'OCR.",
  'aioModel.status.inRoadmap': 'Il modello "{name}" è ancora nella roadmap.',
  'aioModel.status.requiresConfig':
    'Il modello "{name}" richiede configurazione prima dell\'uso.',
  'aioModel.status.installedOk': 'installato (ok)',
  'aioModel.status.installedUpdate': 'installato (aggiornamento disponibile)',
  'aioExec.selectAndInstallStage':
    'Seleziona e installa un modello locale prima di eseguire la fase "{stageLabel}".',
  'aioExec.installBeforeStage':
    'Installa il modello "{name}" prima di eseguire la fase "{stageLabel}".',
  'aioExec.selectValidOcrModel':
    'Seleziona un modello valido per il Riconoscimento Testo.',
  'aioExec.ocrRequiresApiKey':
    'Questo provider OCR richiede una chiave API. Configura la chiave prima di eseguire.',
  'aioExec.installTranslationModel':
    "Installa un modello di traduzione compatibile prima di eseguire l'AIO.",
  'aioExec.incompatibleLanguage':
    'Il modello selezionato non è compatibile con la lingua corrente.',
  'aioExec.translationModelIncompatible':
    '"{modelName}" non supporta la lingua di destinazione selezionata. Scegli un modello compatibile o cambia la lingua di destinazione.',
  'aioExec.selectValidTranslation':
    'Seleziona un modello di traduzione valido per continuare.',
  'aioExec.selectCustomOcrProfile':
    "Seleziona o salva un profilo OCR AI personalizzato prima di eseguire l'AIO.",
  'aioExec.selectCustomAiProfile':
    "Seleziona o salva un profilo AI personalizzato prima di eseguire l'AIO.",
  'aioExec.translationRequiresApiKey':
    'Questo provider di traduzione richiede una chiave API. Configura la chiave prima di eseguire.',
  'aioManual.selectImage':
    "Seleziona un'immagine da eseguire in modalità manuale.",
  'aioManual.imageNotFound': 'Immagine attiva non trovata.',
  'aioManual.progressNotInitialized':
    "Progressione manuale non inizializzata per l'immagine attiva.",
  'aioManual.selectValidDetectModel':
    'Seleziona un modello valido per il Rilevamento Testo.',
  'aioManual.selectValidSegmentModel':
    'Seleziona un modello valido per la Segmentazione Testo.',
  'aioManual.selectValidCleanModel':
    'Seleziona un modello valido per la Pulizia Immagine.',
  'aioManual.stageDone':
    'Modalità manuale: fase "{stageLabel}" completata per "{fileName}".',
  'aioManual.executionAborted': 'Esecuzione AIO manuale interrotta.',
  'aioManual.stageFailed': 'Impossibile eseguire la fase "{stageLabel}".',
  'translator.localModelIncompatible':
    'Il modello locale selezionato non è compatibile con la lingua corrente del Traduttore.',
  'translator.selectValidTranslationModel':
    'Seleziona un modello di traduzione valido per il Traduttore.',
  'translator.selectCustomAiTranslationProfile':
    'Seleziona o salva un profilo di traduzione AI personalizzato prima di eseguire.',
  'translator.localOcrModelIncompatible':
    'Il modello OCR locale selezionato non è compatibile con la lingua corrente del Traduttore.',
  'translator.installCompatibleOcrModel':
    'Installa un modello OCR compatibile prima di eseguire il Traduttore Visivo.',
  'translator.selectValidOcrModel':
    'Seleziona un modello OCR valido per il Traduttore Visivo.',
  'modelManager.error.diskCheckFailed':
    'Impossibile verificare lo spazio su disco disponibile.',
  'translatorVisual.running.aiSfx':
    'Traduttore Visivo AI SFX: rilevamento, classificazione, riconoscimento, traduzione e pulizia...',
  'translatorVisual.running.standard':
    'Traduttore Visivo: rilevamento, riconoscimento e traduzione...',
  'translatorVisual.invalidSfxResponse':
    'Risposta AI SFX non valida dal Traduttore per "{fileName}".',
  'translatorVisual.done.aiSfx':
    'Traduttore Visivo AI SFX completato. {candidates} candidato/i, {approved} SFX approvati, {ocr} OCR, {translations} traduzione/i e {redraw} regione/i con richiesta di ridisegno.',
  'translatorVisual.done.standard':
    'Traduttore Visivo completato. {detected} regione/i rilevata/e, {recognized} testo/i riconosciuto/i, {translations} traduzione/i generata/e.',
  'translatorVisual.genericError': 'Impossibile eseguire il Traduttore Visivo.',
  'freeProvider.catalogOnly':
    'Il provider "{name}" è disponibile solo come catalogo nella v1.',
  'enhanceActions.connectError':
    'Miglioramento: connessione al backend ({url}) non riuscita. Verifica che il mini-backend sia attivo.',
  'aioSingleProcessor.invalidCleanResponse':
    'Risposta non valida durante la pulizia di "{fileName}".',
  'cleanerActions.detectFailed':
    'Impossibile rilevare le regioni per "{fileName}": {message}',
  'cleanerActions.invalidSfxResponse':
    'Risposta AI SFX Pulitore non valida per "{fileName}".',
  'cleanerActions.invalidAutoCleanResponse':
    'Risposta Pulizia AI Automatica non valida per "{fileName}".',
  'cleanerActions.sfxDone':
    'AI SFX Pulitore completato. {images} immagine/i, {candidates} candidato/i, {approved} SFX approvati e {redraw} regione/i con richiesta di ridisegno.',
  'cleanerActions.autoCleanDone':
    'Pulizia AI Automatica completata. {images} immagine/i elaborate e {detected} regione/i rilevata/e.',
  'cleanerActions.assistedDone':
    'Pulizia Assistita completata. {images} immagine/i pulite, {detected} regione/i rilevata/e, {recognized} testo/i riconosciuto/i, {segmented} regione/i segmentata/e.',
  'webhook.event.processStart.label': 'Elaborazione avviata',
  'webhook.event.processStart.desc': "Quando un'esecuzione inizia",
  'webhook.event.processComplete.label': 'Elaborazione completata',
  'webhook.event.processComplete.desc':
    "Quando un'esecuzione termina con successo",
  'webhook.event.processError.label': 'Errori di elaborazione',
  'webhook.event.processError.desc': 'Quando si verifica un errore',
  'webhook.event.updateAvailable.label': 'Aggiornamento disponibile',
  'webhook.event.updateAvailable.desc':
    'Quando è disponibile una nuova versione',
  'webhook.event.updateDownloaded.label': 'Aggiornamento scaricato',
  'webhook.event.updateDownloaded.desc':
    "Quando il download dell'aggiornamento è completato",
  'webhook.event.updateError.label': 'Errore aggiornamento',
  'webhook.event.updateError.desc':
    "Quando l'aggiornamento automatico non riesce",
  'webhook.validation.urlRequired': "Inserisci l'URL del webhook Discord.",
  'webhook.validation.urlInvalid':
    'URL non valido. Verifica il formato del webhook.',
  'webhook.validation.urlHttpsRequired':
    "L'URL del webhook deve utilizzare HTTPS.",
  'webhook.validation.urlNotDiscord':
    'Usa un URL ufficiale di Discord (discord.com).',
  'webhook.validation.urlInvalidPath':
    "Il percorso dell'URL non corrisponde a un webhook Discord valido.",
  'typography.effect.none.label': 'Nessun effetto',
  'typography.effect.none.description':
    'Testo pulito, senza livelli aggiuntivi.',
  'typography.effect.balloon_smear.label': 'Strisciata Fumetto',
  'typography.effect.balloon_smear.description':
    'Striscia grigia verticale con leggero ondeggiamento laterale, ispirata al testo drammatico dei dialoghi.',
  'typography.effect.smiles_outline.label': 'Contorno SMILES',
  'typography.effect.smiles_outline.description':
    'Contorno corallo morbido con nucleo chiaro, stile sussurro delicato.',
  'typography.effect.ahnnn_peach.label': 'Bagliore Pesca Ahnnn',
  'typography.effect.ahnnn_peach.description':
    'Riempimento pesca con un bagliore caldo e morbido.',
  'typography.effect.silence_ink.label': 'Inchiostro Silenzio',
  'typography.effect.silence_ink.description':
    'Blu violaceo con una presenza pulita e leggera profondità interna.',
  'typography.effect.hwa_pastel.label': 'HWA Pastello',
  'typography.effect.hwa_pastel.description':
    'Giallo chiaro con contorno rosa e una sensazione delicata.',
  'typography.effect.hah_pop.label': 'HAH Pop',
  'typography.effect.hah_pop.description':
    'Nucleo lilla chiaro con presenza pop e rilievo rosa.',
  'typography.effect.smooch_jelly.label': 'Bacio Gelatina',
  'typography.effect.smooch_jelly.description':
    "Rosa tenue con una lucentezza gelatinosa e un'ombra dolce.",
  'typography.effect.tremble_brush.label': 'Pennello Tremolio',
  'typography.effect.tremble_brush.description':
    'Pennello blu-viola energico con bordo irregolare.',
  'typography.effect.eheheh_whisper.label': 'Sussurro EHEHEH',
  'typography.effect.eheheh_whisper.description':
    'Rosa chiaro con contorno soffice e un bagliore timido.',
  'typography.effect.hoho_ink.label': 'Inchiostro HOHO',
  'typography.effect.hoho_ink.description':
    'Blu scuro con colature verticali e una texture secca.',
  'typography.effect.blam_impact.label': 'Impatto BLAM',
  'typography.effect.blam_impact.description':
    "Esplosione gialla con un'ombra rossa spostata.",
  'typography.effect.badump_soft.label': 'BADUMP Morbido',
  'typography.effect.badump_soft.description':
    "Gradiente pastello rosa tenue con un'aura romantica.",
  'typography.effect.thump_heavy.label': 'THUMP Pesante',
  'typography.effect.thump_heavy.description':
    "Impatto nero con un'ombra angolata color vino, dura.",
  'typography.effect.neon_woah.label': 'WOAH Neon',
  'typography.effect.neon_woah.description':
    'Testo bianco con un intenso bagliore rosa di sorpresa/brillantezza.',
  'typography.effect.slash_speed.label': 'SLAP Fendente Veloce',
  'typography.effect.slash_speed.description':
    'Tipografia scura con una striscia diagonale aggressiva/sfocatura di movimento.',
  'typography.effect.ah_teal.label': 'Ah Verde Acqua',
  'typography.effect.ah_teal.description':
    'Acqua/verde acqua con contorno scuro e una sensazione gentile da discorso sommesso.',
  'typography.effect.drip_blue.label': 'Goccia Blu',
  'typography.effect.drip_blue.description':
    'Azzurro chiaro con una sensazione liquida e effetto goccia.',
  'typography.effect.question_pop.label': 'Domanda Pop',
  'typography.effect.question_pop.description':
    "Segno di punteggiatura caldo con un'ombra corallo spostata.",
  'typography.effect.laugh_curve.label': 'Risata Curva',
  'typography.effect.laugh_curve.description':
    'Ciano brillante per una risata arcuata e leggera.',
  'typography.effect.shake_blur.label': 'Tremolio Sfocato',
  'typography.effect.shake_blur.description':
    'Viola scuro con vibrazione/sfocatura di movimento per il tremolio.',
  'typography.effect.beep_outline.label': 'Contorno Beep',
  'typography.effect.beep_outline.description':
    'Testo bianco con spesso contorno nero per SFX puliti e leggibili.',
  'typography.effect.boom_comic.label': 'BOOM Fumetto',
  'typography.effect.boom_comic.description':
    'Esplosione classica giallo/rosso in stile fumetto.',
  'typography.effect.bang_chunk.label': 'BANG Blocco',
  'typography.effect.bang_chunk.description':
    'Blocco viola/blu con una spessa ombra dorata spostata.',
  'typography.effect.break_glitch.label': 'BREAK Glitch',
  'typography.effect.break_glitch.description':
    'Magenta scuro con una texture glitch/scansione rotta.',
  'typography.effect.flinch_outline.label': 'FLINCH Contorno',
  'typography.effect.flinch_outline.description':
    'Nero con un contorno bianco aggressivo per una reazione istantanea.',
  'typography.effect.growl_moss.label': 'Ringhio Muschio',
  'typography.effect.growl_moss.description':
    'Verde oliva secco per un suono rauco/animale.',
  'typography.effect.yawn_soft.label': 'Sbadiglio Morbido',
  'typography.effect.yawn_soft.description':
    'Verde lime con contorno viola per un discorso pigro/stiracchiato.',
  'typography.effect.scratch_noise.label': 'Graffio Rumore',
  'typography.effect.scratch_noise.description':
    'Nero ruvido con aspetto granuloso/rumoroso.',
  'typography.effect.crack_ink.label': 'Schiocco Inchiostro',
  'typography.effect.crack_ink.description':
    'Pennello nero secco e netto per un impatto improvviso.',
  'typography.effect.slap_scratch.label': 'Schiaffo Graffio',
  'typography.effect.slap_scratch.description':
    'Scarabocchio sottile e trascinato per un effetto graffio/colpo rapido.',
  'typography.effect.dash_edge.label': 'Spigolo Scatto',
  'typography.effect.dash_edge.description':
    'Verde scuro con punte affilate per un taglio/ingresso improvviso.',
  'typography.effect.scream_scratch.label': 'Urlo Graffio',
  'typography.effect.scream_scratch.description':
    'Urlo nero con un offset rosso ruvido.',
  'model.opus-mt-ja-en.description':
    'Pipeline OPUS-MT ottimizzata per contenuti giapponesi, con traduzione in inglese e un flusso secondario per il portoghese.',
  'model.nllb-200-600m-int8.description':
    "Modello multilingue NLLB quantizzato a int8 per ridurre l'uso di memoria mantenendo una buona qualità per KO→EN/PT.",
  'model.opus-mt-zh-en.description':
    'Modello OPUS-MT per il cinese con traduzione primaria in inglese e un flusso secondario per il portoghese.',
  'model.nllb-200-1.3b.description':
    'Modello multilingue di qualità superiore per la traduzione generale con ampia copertura linguistica.',
  'model.nllb-200-1.3b-int8-ct2.description':
    'Versione quantizzata CTranslate2 di NLLB 1.3B, che riduce la VRAM con un eccellente rapporto qualità-prezzo.',
  'model.nllb-200-3.3b.description':
    'Modello NLLB ad alta capacità per la massima qualità su più lingue.',
  'model.sugoi_v4_ja_en_ct2.description':
    'Traduttore locale giapponese→inglese con CTranslate2 e SentencePiece, compatibile con il flusso offline di BallonsTranslator.',
  'model.m2m100_1_2b_ct2.description':
    'Traduttore multilingue locale via CTranslate2, con ampia copertura linguistica e compatibilità con il flusso offline di BallonsTranslator.',
  'model.font_rtdetr_v2.description':
    'Modello locale per il rilevamento delle regioni di testo nella pipeline AIO.',
  'model.comic_text_detector.description':
    'Rilevatore locale basato sul modulo CTD di BallonsTranslator per riquadri di testo nelle pagine manga.',
  'model.manga_ocr.description':
    "Modello OCR locale per il giapponese nell'AIO.",
  'model.meiki_ocr.description':
    'OCR locale giapponese specializzato in testo renderizzato, con modelli ONNX orizzontali e verticali.',
  'model.paddleocr_vl_manga.description':
    'OCR VLM locale specializzato in manga giapponese.',
  'model.got_ocr2.description':
    'OCR multimodale locale tramite GOT-OCR 2.0 con runtime transformers nativo.',
  'model.qwen2_5_vl_3b.description':
    'OCR multimodale locale tramite Qwen2.5-VL-3B-Instruct.',
  'model.mangalmm.description':
    'OCR/comprensione multimodale specializzato in manga basato su Qwen2.5-VL.',
  'model.rolmocr.description':
    'OCR locale robusto basato su Qwen2.5-VL con ottimizzazione per la lettura di documenti.',
  'model.glm_ocr_onnx.description':
    'OCR locale GLM focalizzato su layout complessi con runtime transformers nativo.',
  'model.paddleocr.description':
    'Modello OCR locale per lingue russe/slave nella pipeline AIO.',
  'model.paddleocr_latin_v5.description':
    "Modello OCR locale per lingue latine (include l'olandese) nella pipeline AIO.",
  'model.paddleocr_ch_v5.description':
    'Modello OCR locale per il cinese nella pipeline AIO.',
  'model.paddleocr_en_v5.description':
    "Modello OCR locale focalizzato sull'inglese per la pipeline AIO.",
  'model.easyocr.description':
    "OCR locale multilingue con installazione su richiesta nella directory modelli dell'app.",
  'model.pororo.description':
    'Modello OCR locale per il coreano nella pipeline AIO.',
  'model.baka_content_cc.description':
    "Modello locale per la segmentazione/rifinitura delle regioni di testo nell'AIO.",
  'model.aot.description':
    "Modello di inpainting locale per la pulizia dei fumetti nell'AIO.",
  'model.lama_manga.description':
    "Modello di inpainting contestuale locale per aree complesse nell'AIO.",
  'model.opencv_lama.description':
    'Modello di inpainting locale leggero tramite OpenCV Zoo, progettato per CPU e esecuzione rapida.',
  'model.lama_fp32.description':
    'Porting ONNX consigliato di big-lama a 512x512, adatto per CPU/GPU bilanciando qualità e semplicità.',
  'model.vntl_llama3_8b_v2.description':
    'Fine-tuning LLaMA3 per VN giapponesi → inglese. Dataset multi-riga ricostruito. Usare temp 0. (~5.7-8.5GB GGUF).',
  'model.lfm2_350m_enjp_mt.description':
    'Traduttore bidirezionale JA↔EN ultra-leggero, 0.4B parametri. Q4_0 a soli 219MB — ideale per CPU e dispositivi edge.',
  'model.sakura_galtransl_7b_v3_7.description':
    'Traduttore JA→ZH-CN ottimizzato per visual novel. Preserva a capo, caratteri di controllo e ruby. CC-BY-NC-SA 4.0 (~4.25GB IQ4_XS).',
  'model.sakura_1_5b_qwen2_5_v1_0.description':
    'Alternativa leggera a Sakura 7B con quantizzazione IMatrix. ~1GB Q5KS. Ideale per GPU di fascia media o CPU (~4GB RAM).',
  'model.hunyuan_7b_mt_v1_0.description':
    'Traduttore multilingue Tencent — 1° posto WMT25. 33 lingue bidirezionali. Prompt: "Translate into <target_language>." (~4.2GB Q4_K_M).',
  'model.pp_doclayout_v3.description':
    "Modello locale di rilevamento layout e testo basato su PP-DocLayout V3. Alta precisione per l'analisi del layout di pagina.",
  'model.paddleocr_vl_1_5.description':
    'Modello OCR VLM multilingue di alta qualità (PaddleOCR-VL 1.5). Fino a 128 token per blocco di testo.',
  'model.waifu2x_swin_unet_art_scan_2x.description':
    'Miglior opzione locale per pagine manga/manhwa focalizzata su lineart e fumetti.',
  'model.waifu2x_swin_unet_art_scan_4x.description':
    'Variante 4x per pagine manga/manhwa scannerizzate.',
  'model.waifu2x_swin_unet_art_2x.description':
    'Modello 2x per arte digitale/anime pulita.',
  'model.4xnomos2_hq_mosr.description':
    'Upscaler ONNX 4x di alta qualità per materiale minimamente degradato.',
  'model.4xspankendata.description':
    'Modello ONNX leggero come fallback generico 4x.',
  'model.2x_hfa2kcompact.description':
    'Candidato compatibile solo tramite importazione manuale ONNX/conversione esterna.',
  'model.2x_digitalfilm_superultracompact.description':
    'Candidato per importazione manuale ONNX.',
  'model.2x_anifilm_compact.description':
    'Candidato per importazione manuale ONNX.',
  'model.2xnomosuni_span_multijpg_ldl.description':
    'Candidato per importazione manuale ONNX.',
  'model.realesrgan_x4plus.description':
    'Candidato per importazione manuale ONNX.',
  'model.4xhfa2kludvaeswinir_light.description':
    'Candidato per importazione manuale ONNX.',
  'splitter.status.recipeApplied':
    "Ricetta Divisore applicata all'immagine attiva.",
  'splitter.status.recipeRestored':
    'Ricetta Divisore ripristinata ai valori predefiniti.',
  'splitter.status.exportCancelled':
    "Esportazione Divisore annullata dall'utente.",
  'splitter.error.noSegmentsActive':
    "Nessun segmento valido generato per l'immagine attiva.",
  'splitter.error.noSegmentsBatch':
    'Nessun segmento valido generato nel batch del Divisore.',
  'aioExec.sessionUnavailable': "Sessione non disponibile per usare i modelli cloud. Effettua nuovamente l'accesso.",
  'aioManual.progressionNotInitialized':
    "Progressione manuale non inizializzata per l'immagine attiva.",
  'cleanerActions.selectValidOcrModel':
    'Seleziona un modello OCR valido per il Pulitore.',
  'cleanerActions.invalidCleanResponseNamed':
    'Risposta di pulizia non valida per "{name}".',
  'customLlm.selectTranslationProfile':
    'Seleziona un profilo di traduzione personalizzato salvato da utilizzare.',
  'customLlm.selectOcrProfile':
    'Seleziona un profilo OCR personalizzato salvato da utilizzare.',
  'customLlm.profileNotFound':
    'Profilo personalizzato non trovato. Ricarica e riprova.',
  'customLlm.translationProfileActive':
    'Profilo personalizzato in uso (traduzione): {label}.',
  'customLlm.ocrProfileActive': 'Profilo personalizzato in uso (OCR): {label}.',
  'accountSync.confirmEmailSent':
    'Email di conferma inviata. Controlla la tua posta in arrivo.',
  'accountSync.confirmEmailFailed': "Impossibile inviare l'email di conferma.",
  'downloadActions.noTranslatorResults':
    'Nessun risultato del Traduttore disponibile per il download.',
  'enhanceActions.desktopOnly':
    "Il miglioramento locale è disponibile solo nell'app desktop.",
  'enhanceActions.selectModel':
    'Seleziona un modello di miglioramento compatibile.',
  'enhanceActions.done': 'Miglioramento completato. Usa Download per salvare.',
  'freeProvider.stageNotSupported': 'Il provider non supporta questa fase.',
  'freeProvider.activeForTranslation':
    'Provider {name} in uso per la traduzione.',
  'freeProvider.activeForOcr': "Provider {name} in uso per l'OCR.",
  'freeProvider.activeForClean': 'Provider {name} in uso per la pulizia.',
  'freeProvider.stageTranslation': 'Traduzione',
  'freeProvider.stageOcr': 'OCR',
  'freeProvider.stageClean': 'Pulizia',
  'translatorRetranslate.targetNotFound':
    'Immagine di destinazione non trovata per la ritraduzione.',
  'translatorRetranslate.noTextAvailable':
    'Nessun testo riconosciuto disponibile per la ritraduzione.',
  'translatorText.done':
    'Traduttore Testuale completato. Usa copia o scarica TXT.',
  'typographer.queueApplied':
    'Testo dalla coda applicato alla selezione corrente.',
  'typographer.queueAppliedMulti':
    'Testo dalla coda applicato a {{count}} fumetto/i.',
  'typographer.queueCleared': 'Coda del Compositore svuotata.',
  'typographer.queueImported': 'Testo importato nella coda del Compositore.',
  'aioManual.invalidCleanResponse':
    "Risposta non valida durante la pulizia dell'immagine.",
  'aioStage.lang.ko': 'Coreano',
  'aioStage.lang.ja': 'Giapponese',
  'aioStage.lang.fr': 'Francese',
  'aioStage.lang.zh': 'Cinese',
  'aioStage.lang.zh-CN': 'Cinese semplificato',
  'aioStage.lang.zh-TW': 'Cinese tradizionale',
  'aioStage.lang.en': 'Inglese',
  'aioStage.lang.ru': 'Russo',
  'aioStage.lang.de': 'Tedesco',
  'aioStage.lang.nl': 'Olandese',
  'aioStage.lang.es': 'Spagnolo',
  'aioStage.lang.it': 'Italiano',
  'aioStage.lang.tr': 'Turco',
  'aioStage.lang.pl': 'Polacco',
  'aioStage.lang.pt': 'Portoghese',
  'aioStage.lang.pt-BR': 'Portoghese (BR)',
  'aioStage.lang.th': 'Tailandese',
  'aioStage.lang.vi': 'Vietnamita',
  'aioStage.lang.hu': 'Ungherese',
  'aioStage.lang.id': 'Indonesiano',
  'aioStage.lang.fi': 'Finlandese',
  'aioStage.lang.ar': 'Arabo',
  'splitter.warning.noIntermediateCuts': 'Nessun taglio intermedio trovato.',
  'splitter.warning.segmentTooSmall':
    "Un segmento è più piccolo dell'altezza minima configurata.",
  'splitter.warning.segmentTooLarge':
    "Un segmento è più grande dell'altezza massima configurata.",
  'splitter.warning.cutsNearContent':
    'Alcuni tagli sono vicini ad aree con contenuto.',
  'splitter.warning.nearEdge': 'Troppo vicino al bordo.',
  'stitch.warning.dimensionTooHigh':
    'La dimensione è troppo elevata; esporta in più batch per evitare errori.',
  'stitch.warning.outputTooHeavy':
    "L'output è troppo pesante per la revisione e il download.",
  'stitch.warning.canvasLimit':
    'Potrebbe superare i limiti sicuri del canvas in alcuni ambienti.',
  'stitch.warning.largeBatch':
    "Batch grande; verifica se l'interruzione è ancora confortevole per la scanlation.",
  'resources.data.fontsTitle': 'Font per la composizione',
  'resources.data.fontsDesc':
    'Collezione curata di font popolari per la scanlation di manga, manhwa e manhua.',
  'resources.data.onomatopoeiaDesc':
    "Libreria di onomatopee giapponesi con traduzioni ed esempi d'uso.",
  'resources.data.glossaryTitle': 'Glossario Scanlation',
  'resources.data.glossaryDesc':
    'Termini tecnici e gergo della community dal mondo della scanlation.',
  'resources.data.catalogLabel': 'Catalogo',
  'aioLocalBatch.invalidBatchResponse':
    'Risposta batch non valida: batch_report.json mancante dallo ZIP.',
  'modelDownload.desktopOnly':
    "La gestione dei modelli è disponibile solo nell'app desktop.",
  'settings.updates.channelBeta': 'Beta',
  'settings.updates.channelStable': 'Stabile',
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
    'Scambia codice per token',
  'settings.integrations.blogger.term.refreshToken': 'Refresh Token',
  'settings.integrations.blogger.term.cloudName': 'cloud name',
  'settings.integrations.blogger.term.blogId': 'Blog ID',
  'settings.integrations.imgur.term.clientId': 'Client ID',
  'settings.integrations.imgur.term.rateLimit': '50 caricamenti/ora',
  'settings.shortcuts.topbarPath': 'Barra superiore > Scorciatoie',
  'login.warning.versionPrefix': 'v{version}',
  'password.policy.minLength':
    'La password deve contenere almeno 12 caratteri.',
  'password.policy.uppercase':
    'La password deve contenere almeno una lettera maiuscola.',
  'password.policy.lowercase':
    'La password deve contenere almeno una lettera minuscola.',
  'password.policy.number': 'La password deve contenere almeno un numero.',
  'password.policy.special':
    'La password deve contenere almeno un carattere speciale.',
  'auth.sfx.primary': '쾅',
  'auth.sfx.secondary': '휙',
  'auth.stats.activeScanlatorsValue': '2.4k+',
  'auth.stats.toolsValue': '50+',
  'auth.stats.pagesProcessedValue': '1M+',
  'auth.community.joinIndicator': '+',
  'resources.sfx.onomatopoeiaLabel': 'Onomatopea',
  'resources.page.shortcutCtrl': 'Ctrl',
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
  'settings.typographerLibrary.presetsCount_one': '{count} preset',
  'settings.typographerLibrary.presetsCount_other': '{count} preset',
  'renderPreview.iconUppercase': 'AA',
  'renderPreview.iconHorizontal': 'O',
  'renderPreview.iconVertical': 'V',
  'renderPreview.iconCircular': '◯',
  'guides.home.searchShortcut': '⌘K',
  'brand.name': 'KŌMA',
  'brand.studioSuffix': 'Studio',
  'versionBadge.stable': 'STABILE',
  'versionBadge.beta': 'BETA',
  'versionBadge.tooltip': 'Versione {version}',
  'settings.typography.iconBold': 'G',
  'settings.typography.iconItalic': 'C',
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
  'update.toast.newVersionFallback': 'nuova',
  'dashboard.status.cloudSuffix': '(Cloud)',
  'dashboard.status.cloudApiSuffix': '(Cloud/API/AI)',
  'dashboard.status.pendingCustomTranslationName':
    'AI Personalizzata (sincronizzazione...)',
  'dashboard.status.pendingCustomOcrName':
    'OCR Personalizzato (sincronizzazione...)',
  'modelManager.tooltip.gpu': 'GPU',
  'modelManager.tooltip.vram': 'VRAM',
  'modelManager.tooltip.ram': 'RAM',
  'dashboard.tour.preview.welcome.upload': 'Carica',
  'dashboard.tour.preview.welcome.export': 'Esporta',
  'dashboard.tour.preview.upload.formats':
    'JPG · PNG · WEBP · ZIP · PDF · CBZ · CB7 · PSD',
  'dashboard.tour.preview.stageEmpty': 'Carica immagini per iniziare',
  'dashboard.tour.welcome.title': 'Benvenuto nella Dashboard di KŌMA Studio',
  'dashboard.tour.welcome.body':
    "Questo tour ti guida attraverso il flusso principale dell'app: organizzazione delle pagine, scelta delle modalità, configurazione della pipeline AIO ed esportazione dei risultati, senza dover indovinare dove si trova ogni funzione.",
  'dashboard.tour.sidebar.title':
    'Barra laterale: quota, file e contesto batch',
  'dashboard.tour.sidebar.body':
    "Qui monitori il tuo piano e l'utilizzo mensile, scegli l'immagine attiva, riordini le pagine, rimuovi elementi e mantieni il batch organizzato prima dell'elaborazione.",
  'dashboard.tour.upload.title': 'Caricamento iniziale dei file',
  'dashboard.tour.upload.body':
    'La zona di rilascio accetta sia immagini singole che pacchetti completi. È il punto di partenza per trascinare capitoli, raw o risorse da utilizzare nel resto della dashboard.',
  'dashboard.tour.modes.title': 'Navigazione principale della Dashboard',
  'dashboard.tour.modes.body':
    'Usa Organizza per preparare il batch e AIO per la pipeline completa. Gli altri gruppi nella barra superiore aprono modalità specializzate senza uscire dallo spazio di lavoro.',
  'dashboard.tour.production.title': 'Produzione: strumenti specializzati',
  'dashboard.tour.production.body':
    'Pulitore, Compositore, Traduttore, Raw e QC coprono il flusso di lavoro manuale e avanzato. Pensa a questo gruppo come alle modalità professionali per lavorare su una fase specifica del capitolo.',
  'dashboard.tour.utils.title': 'Utilità e supporto',
  'dashboard.tour.utils.body':
    "Unione, Divisione, Watermark e Migliora gestiscono le attività rapide di preparazione ed esportazione. Guide e Risorse completano l'area di supporto per la consultazione.",
  'dashboard.tour.submode.title': 'AIO Automatico vs. manuale',
  'dashboard.tour.submode.body':
    "Automatico esegue l'intera pipeline in batch. Manuale sblocca ogni fase per immagine per una revisione dettagliata, riavvolgimento/avanzamento e modifica visiva controllata.",
  'dashboard.tour.pipeline.title': 'Pipeline AIO',
  'dashboard.tour.pipeline.body':
    'Questa scheda controlla la sequenza Rileva > OCR > Traduci > Segmenta > Pulisci > Rendering. Puoi abilitare o disabilitare le fasi e, in modalità manuale, eseguire solo la fase corrente.',
  'dashboard.tour.stageConfig.title': 'Configurazione della fase',
  'dashboard.tour.stageConfig.body':
    'Qui trovi lingue, preset AIO, cataloghi locali/cloud e selezione del modello per fase. È il centro decisionale per regolare costi, qualità e velocità.',
  'dashboard.tour.stage.withImagesTitle': 'Spazio di lavoro e anteprima visiva',
  'dashboard.tour.stage.withImagesBody':
    "Quando ci sono immagini, quest'area diventa l'anteprima principale: navighi le pagine, vedi i risultati per fase e lavori direttamente sull'immagine attiva.",
  'dashboard.tour.stage.emptyTitle': 'Area centrale della Dashboard',
  'dashboard.tour.stage.emptyBody':
    "Senza immagini, l'area mostra uno stato vuoto semplice. Dopo il caricamento, visualizza anteprime, overlay, regioni e risultati per modalità.",
  'dashboard.tour.manualDock.title': 'Anteprima interattiva e dock manuale',
  'dashboard.tour.manualDock.body':
    "Con un'immagine attiva nell'AIO manuale, la dock mobile sblocca selezione area, pennello, gomma, bacchetta, correzione e regolazioni contestuali senza uscire dall'anteprima.",
  'dashboard.tour.download.title': 'Esportazione e download',
  'dashboard.tour.download.body':
    "Quando l'app ha output pronti, questo menu raccoglie formati immagine, pacchetti, PSD con livelli e opzioni metadati per concludere il flusso di consegna.",
  'dashboard.tour.replay.title': 'Se vuoi ripetere il tour più tardi',
  'dashboard.tour.replay.body':
    "Apri il menu utente e usa <strong>Ripeti il tour</strong>. L'onboarding automatico viene eseguito solo alla prima visita della versione corrente, ma la ripetizione manuale è sempre disponibile.",
  'dashboard.tour.progressText': 'Passo {{current}} di {{total}}',
  'dashboard.tour.next': 'Avanti',
  'dashboard.tour.prev': 'Indietro',
  'dashboard.tour.done': 'Termina tour',
  'dashboard.tour.dialogLabel': 'Tour della Dashboard',
  'dashboard.tour.close': 'Chiudi tour',
  'dashboard.tour.nextAria': 'Vai al passo successivo',
  'dashboard.tour.prevAria': 'Torna al passo precedente',
  'modelManager.tooltip.rich.highlights': 'Punti di forza',
  'modelManager.tooltip.rich.unique': 'Caratteristica distintiva',
  'modelManager.tooltip.rich.bestFor': 'Ideale per',
  'modelManager.tooltip.rich.performance': 'Prestazioni',
  'modelManager.tooltip.rich.notes': 'Note',
  'modelManager.tooltip.docsUrl': 'Vedi documentazione',
  'modelManager.tooltip.notes': 'Note',
  'modelManager.tooltip.highlights': 'Punti di forza',
  'modelManager.tooltip.bestFor': 'Ideale per',
  'modelManager.tooltip.unique': 'Caratteristica distintiva',
  'modelManager.tooltip.performance': 'Prestazioni',

  'model.tooltip.opus-mt-ja-en.highlights':
    "Traduce dal giapponese all'inglese\nLeggero e veloce, funziona bene senza scheda video\nBuona opzione per iniziare",
  'model.tooltip.opus-mt-ja-en.unique':
    'Funziona bene per testi generici in giapponese, ma non è stato progettato specificamente per i manga',
  'model.tooltip.opus-mt-ja-en.bestFor':
    "Traduzioni rapide dal giapponese all'inglese quando non si dispone di una scheda video potente",
  'model.tooltip.opus-mt-ja-en.performance':
    'Molto veloce, funziona su qualsiasi computer senza bisogno di scheda video',
  'model.tooltip.opus-mt-ja-en.notes':
    'Buona opzione generale, ma per manga e anime Sugoi offre risultati migliori',

  'model.tooltip.nllb-200-600m-int8.highlights':
    'Traduce tra quasi 200 lingue\nVersione leggera e ottimizzata\nFunziona bene su qualsiasi computer',
  'model.tooltip.nllb-200-600m-int8.unique':
    'Un unico modello che traduce tra centinaia di lingue — ideale quando serve versatilità',
  'model.tooltip.nllb-200-600m-int8.bestFor':
    'Tradurre tra lingue meno comuni o quando serve un modello che funzioni per tutto',
  'model.tooltip.nllb-200-600m-int8.performance':
    'Veloce e leggero, funziona bene anche su computer senza scheda video',
  'model.tooltip.nllb-200-600m-int8.notes':
    'Non è stato progettato per i manga, ma funziona come traduttore generico per molte lingue',

  'model.tooltip.opus-mt-zh-en.highlights':
    "Traduce dal cinese all'inglese\nLeggero e veloce\nFunziona senza scheda video",
  'model.tooltip.opus-mt-zh-en.unique':
    'Specializzato in cinese → inglese, buono per manhua e contenuti cinesi in generale',
  'model.tooltip.opus-mt-zh-en.bestFor':
    'Tradurre manhua e contenuti cinesi in inglese in modo rapido',
  'model.tooltip.opus-mt-zh-en.performance':
    'Molto veloce, funziona su qualsiasi computer senza scheda video',
  'model.tooltip.opus-mt-zh-en.notes':
    'Popolare e affidabile per traduzioni cinese → inglese',

  'model.tooltip.nllb-200-1.3b.highlights':
    'Traduce tra quasi 200 lingue\nQualità migliore rispetto alla versione leggera\nBuono per lingue meno comuni',
  'model.tooltip.nllb-200-1.3b.unique':
    'Versione intermedia con qualità superiore alla 600M, ma senza essere pesante come la 3.3B',
  'model.tooltip.nllb-200-1.3b.bestFor':
    'Quando serve una qualità migliore rispetto alla versione leggera, specialmente per lingue rare',
  'model.tooltip.nllb-200-1.3b.performance':
    'Richiede una scheda video con almeno 4GB di memoria; velocità accettabile',
  'model.tooltip.nllb-200-1.3b.notes':
    'Buon equilibrio tra qualità e peso. Non è stato progettato per i manga.',

  'model.tooltip.nllb-200-1.3b-int8-ct2.highlights':
    'Traduce tra quasi 200 lingue\nVersione ottimizzata che usa meno memoria\nBuona qualità con minor consumo',
  'model.tooltip.nllb-200-1.3b-int8-ct2.unique':
    'Stessa qualità della versione 1.3B ma con minor consumo di memoria — miglior rapporto qualità-prestazioni',
  'model.tooltip.nllb-200-1.3b-int8-ct2.bestFor':
    'Traduzione multilingue di buona qualità senza bisogno di un computer molto potente',
  'model.tooltip.nllb-200-1.3b-int8-ct2.performance':
    'Funziona su CPU se necessario; più leggero della versione standard 1.3B',
  'model.tooltip.nllb-200-1.3b-int8-ct2.notes':
    'Versione ottimizzata di NLLB 1.3B — usala se vuoi risparmiare memoria',

  'model.tooltip.nllb-200-3.3b.highlights':
    'Migliore qualità tra i traduttori multilingue\nQuasi 200 lingue\nIdeale quando la qualità conta più della velocità',
  'model.tooltip.nllb-200-3.3b.unique':
    'La versione più potente e precisa della famiglia multilingue — migliore traduzione disponibile per lingue rare',
  'model.tooltip.nllb-200-3.3b.bestFor':
    'Quando la qualità della traduzione è più importante della velocità',
  'model.tooltip.nllb-200-3.3b.performance':
    'Richiede una buona scheda video con almeno 8GB di memoria; più lento degli altri',
  'model.tooltip.nllb-200-3.3b.notes':
    'Più pesante ma con qualità migliore. Non è stato progettato per i manga.',

  'model.tooltip.sugoi_v4_ja_en_ct2.highlights':
    "Traduce dal giapponese all'inglese\nProgettato appositamente per manga e anime\nFunziona su qualsiasi computer",
  'model.tooltip.sugoi_v4_ja_en_ct2.unique':
    'Comprende slang, linguaggio colloquiale ed espressioni tipiche di manga e anime meglio di altri traduttori',
  'model.tooltip.sugoi_v4_ja_en_ct2.bestFor':
    "Tradurre manga e anime dal giapponese all'inglese — la scelta più raccomandata dalla community",
  'model.tooltip.sugoi_v4_ja_en_ct2.performance':
    'Molto veloce, funziona bene anche senza scheda video dedicata',
  'model.tooltip.sugoi_v4_ja_en_ct2.notes':
    'Usa questo modello come predefinito per traduzioni giapponese → inglese',

  'model.tooltip.m2m100_1_2b_ct2.highlights':
    'Traduce tra 100 lingue\nCopre coreano, thailandese, vietnamita e altro\nVersione ottimizzata per maggiore velocità',
  'model.tooltip.m2m100_1_2b_ct2.unique':
    "Uno dei pochi modelli che traduce bene tra lingue asiatiche come coreano, thailandese e vietnamita verso l'inglese",
  'model.tooltip.m2m100_1_2b_ct2.bestFor':
    'Tradurre manhwa coreani, manhua cinesi e contenuti in altre lingue asiatiche in inglese',
  'model.tooltip.m2m100_1_2b_ct2.performance':
    'Richiede una scheda video con 4-6GB di memoria; buona velocità con la versione ottimizzata',
  'model.tooltip.m2m100_1_2b_ct2.notes':
    'Buona opzione per lingue asiatiche che altri traduttori non coprono bene',

  'model.tooltip.vntl_llama3_8b_v2.highlights':
    "Traduce dal giapponese all'inglese\nProgettato per visual novel e manga\nMantiene i nomi dei personaggi coerenti",
  'model.tooltip.vntl_llama3_8b_v2.unique':
    'Comprende il contesto della storia e mantiene la coerenza nei nomi dei personaggi e nei termini lungo tutto il testo',
  'model.tooltip.vntl_llama3_8b_v2.bestFor':
    'Tradurre visual novel e manga con dialoghi lunghi dove la coerenza dei nomi è importante',
  'model.tooltip.vntl_llama3_8b_v2.performance':
    'Richiede una buona scheda video con 6-10GB di memoria; più lento dei traduttori semplici',
  'model.tooltip.vntl_llama3_8b_v2.notes':
    'Ideale per progetti lunghi dove la coerenza di nomi e termini è importante',

  'model.tooltip.lfm2_350m_enjp_mt.highlights':
    'Traduce giapponese ↔ inglese in entrambe le direzioni\nUltra leggero e veloce\nFunziona su qualsiasi computer',
  'model.tooltip.lfm2_350m_enjp_mt.unique':
    'Uno dei traduttori più piccoli disponibili — funziona anche su computer poco potenti offrendo comunque risultati discreti',
  'model.tooltip.lfm2_350m_enjp_mt.bestFor':
    'Quando serve una traduzione rapida giapponese-inglese e non si dispone di una scheda video potente',
  'model.tooltip.lfm2_350m_enjp_mt.performance':
    'Estremamente veloce, funziona su qualsiasi computer anche senza scheda video',
  'model.tooltip.lfm2_350m_enjp_mt.notes':
    'Qualità di base — buono per bozze rapide, ma non per il risultato finale',

  'model.tooltip.sakura_galtransl_7b_v3_7.highlights':
    'Traduce dal giapponese al cinese\nIl migliore per galgame e manga\nMantiene formattazione e note speciali',
  'model.tooltip.sakura_galtransl_7b_v3_7.unique':
    'Preserva formattazione speciale, note di lettura e interruzioni di riga — essenziale per galgame e manga con testo complesso',
  'model.tooltip.sakura_galtransl_7b_v3_7.bestFor':
    'La migliore opzione per tradurre dal giapponese al cinese quando la qualità è più importante della velocità',
  'model.tooltip.sakura_galtransl_7b_v3_7.performance':
    'Richiede una scheda video con almeno 6GB di memoria; velocità moderata',
  'model.tooltip.sakura_galtransl_7b_v3_7.notes':
    'Migliore traduzione JP→ZH disponibile. Da usare quando la qualità è la priorità.',

  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.highlights':
    'Traduce dal giapponese al cinese\nVersione leggera e veloce\nBuono per computer meno potenti',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.unique':
    'Stessa famiglia del Sakura più grande, ma ottimizzato per funzionare su computer con meno memoria',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.bestFor':
    'Tradurre dal giapponese al cinese quando non si dispone di una scheda video potente',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.performance':
    'Veloce, richiede solo 1-2GB di memoria sulla scheda video',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.notes':
    'Buona qualità per le dimensioni — ideale se il modello più grande è troppo pesante',

  'model.tooltip.hunyuan_7b_mt_v1_0.highlights':
    'Traduce tra 36 lingue\nAlta qualità, premiato in competizioni\nUn modello potente per molte lingue',
  'model.tooltip.hunyuan_7b_mt_v1_0.unique':
    'Uno dei traduttori più premiati al mondo — combina traduzioni multiple per offrire il miglior risultato possibile',
  'model.tooltip.hunyuan_7b_mt_v1_0.bestFor':
    'Quando serve una traduzione di alta qualità tra molte lingue diverse',
  'model.tooltip.hunyuan_7b_mt_v1_0.performance':
    'Richiede una scheda video con 6-8GB di memoria; velocità moderata',
  'model.tooltip.hunyuan_7b_mt_v1_0.notes':
    'Eccellente per progetti multilingue dove la qualità è la priorità',

  'model.tooltip.font_rtdetr_v2.highlights':
    "Rileva balloon e testo nei fumetti\nIdentifica il testo dentro e fuori dai balloon\nTutto in un'unica passata",
  'model.tooltip.font_rtdetr_v2.unique':
    "L'unico che rileva balloon, testo dentro i balloon e testo libero sulla pagina contemporaneamente",
  'model.tooltip.font_rtdetr_v2.bestFor':
    'Analisi completa di pagine di fumetti — separa automaticamente i dialoghi dal testo libero',
  'model.tooltip.font_rtdetr_v2.performance':
    'Leggero e veloce, funziona bene sulla maggior parte dei computer',
  'model.tooltip.font_rtdetr_v2.notes':
    'Addestrato su manga, webtoon, manhua e fumetti occidentali',

  'model.tooltip.comic_text_detector.highlights':
    'Rileva il testo nei fumetti e nei manga\nModello originale e affidabile\nVeloce su qualsiasi computer',
  'model.tooltip.comic_text_detector.unique':
    'Il rilevatore classico usato come base da molti progetti di traduzione manga',
  'model.tooltip.comic_text_detector.bestFor':
    'Rilevamento del testo nei fumetti, affidabile e di base — una buona scelta predefinita',
  'model.tooltip.comic_text_detector.performance':
    'Veloce, funziona bene senza scheda video dedicata',
  'model.tooltip.comic_text_detector.notes':
    'Modello classico testato dalla community nel corso degli anni',

  'model.tooltip.pp_doclayout_v3.highlights':
    'Analizza il layout di pagine scansionate\nFunziona anche con pagine storte o curve\nIdentifica il corretto ordine di lettura',
  'model.tooltip.pp_doclayout_v3.unique':
    'Riesce a comprendere pagine fotografate storte o scansionate in modo irregolare — cosa che altri modelli non fanno',
  'model.tooltip.pp_doclayout_v3.bestFor':
    'Pagine scansionate in modo imperfetto, foto di libri o layout complessi con ordine di lettura difficile',
  'model.tooltip.pp_doclayout_v3.performance':
    'Robusto e affidabile, funziona bene in diverse condizioni di illuminazione',
  'model.tooltip.pp_doclayout_v3.notes':
    'Utile quando le pagine non sono perfettamente digitalizzate',

  'model.tooltip.manga_ocr.highlights':
    'Legge il testo giapponese nei manga\nFunziona con testo verticale e orizzontale\nIl più raccomandato per i manga giapponesi',
  'model.tooltip.manga_ocr.unique':
    'Progettato appositamente per le sfide del manga: testo verticale, furigana, font stilizzati e immagini di bassa qualità',
  'model.tooltip.manga_ocr.bestFor':
    'La scelta predefinita per leggere il testo dei manga giapponesi — funziona bene subito, senza regolazioni',
  'model.tooltip.manga_ocr.performance':
    'Popolare e affidabile, usato da molti progetti di scanlation',
  'model.tooltip.manga_ocr.notes':
    'Migliore opzione per i manga giapponesi. Se serve velocità, considera Meiki OCR.',

  'model.tooltip.meiki_ocr.highlights':
    'Lettore di testo giapponese ultra-veloce\nRileva ogni carattere individualmente\nIdeale per testo orizzontale',
  'model.tooltip.meiki_ocr.unique':
    'Molto più veloce di altri lettori di testo giapponese — perfetto quando la velocità è la priorità',
  'model.tooltip.meiki_ocr.bestFor':
    'Quando serve leggere testo giapponese orizzontale rapidamente',
  'model.tooltip.meiki_ocr.performance':
    'Estremamente veloce, uno dei più rapidi per il giapponese',
  'model.tooltip.meiki_ocr.notes':
    'Funziona solo con testo orizzontale — per il testo verticale usa Manga OCR',

  'model.tooltip.paddleocr_vl_manga.highlights':
    'Lettore di testo ottimizzato per manga\nFunziona con testo verticale e orizzontale\nMolto più preciso sui manga rispetto al modello base',
  'model.tooltip.paddleocr_vl_manga.unique':
    'Addestrato specificamente su pagine di manga — comprende font stilizzati e balloon meglio dei lettori generici',
  'model.tooltip.paddleocr_vl_manga.bestFor':
    'Leggere il testo dei manga con alta precisione, specialmente quando il testo usa font difficili',
  'model.tooltip.paddleocr_vl_manga.performance':
    'Buona precisione sui manga; funziona anche con altre lingue',
  'model.tooltip.paddleocr_vl_manga.notes':
    'Versione specializzata di PaddleOCR per manga — eccellente scelta per la scanlation',

  'model.tooltip.got_ocr2.highlights':
    'Legge testo da documenti, tabelle e grafici\nComprende formule matematiche e spartiti\nVersatile per vari tipi di documenti',
  'model.tooltip.got_ocr2.unique':
    'Va oltre il semplice testo — riesce a leggere tabelle, formule e grafici formattati',
  'model.tooltip.got_ocr2.bestFor':
    "Leggere documenti complessi con tabelle e formattazione — non è l'ideale per i manga",
  'model.tooltip.got_ocr2.performance':
    'Leggero e versatile, funziona bene per i documenti in generale',
  'model.tooltip.got_ocr2.notes':
    'Multilingue ma non ottimizzato per i manga — usa altri modelli per i fumetti',

  'model.tooltip.qwen2_5_vl_3b.highlights':
    "Comprende le immagini in modo intelligente\nVa oltre la lettura del testo — capisce cosa c'è nell'immagine\nMultilingue e versatile",
  'model.tooltip.qwen2_5_vl_3b.unique':
    "Non si limita a leggere il testo — comprende i pannelli dei manga, descrive le scene ed estrae informazioni organizzate dall'immagine",
  'model.tooltip.qwen2_5_vl_3b.bestFor':
    "Quando serve che il modello comprenda il contenuto dell'immagine, non solo che legga il testo",
  'model.tooltip.qwen2_5_vl_3b.performance':
    'Dimensioni moderate; buona velocità su schede video comuni',
  'model.tooltip.qwen2_5_vl_3b.notes':
    "Multilingue. Utile per l'analisi dei pannelli e la comprensione visiva avanzata",

  'model.tooltip.mangalmm.highlights':
    'Comprende i pannelli dei manga come un lettore umano\nIdentifica personaggi ed elementi della storia\nVa oltre la semplice lettura del testo',
  'model.tooltip.mangalmm.unique':
    "L'unico modello progettato specificamente per comprendere i manga — riconosce personaggi, pannelli e narrativa visiva",
  'model.tooltip.mangalmm.bestFor':
    'Analisi avanzata dei manga: capire chi sta parlando, cosa sta succedendo nei pannelli',
  'model.tooltip.mangalmm.performance':
    'Richiede una scheda video potente con 14GB di memoria; ancora in fase di ricerca',
  'model.tooltip.mangalmm.notes':
    'Modello sperimentale — promettente per il futuro della scanlation ma non ancora maturo',

  'model.tooltip.rolmocr.highlights':
    'Lettore di testo veloce per documenti\nFunziona bene con layout complessi\nAlternativa più leggera e veloce',
  'model.tooltip.rolmocr.unique':
    'Più veloce e leggero di modelli simili, mantenendo una buona qualità nella lettura dei documenti',
  'model.tooltip.rolmocr.bestFor':
    'Leggere documenti con layout complessi quando la velocità è importante',
  'model.tooltip.rolmocr.performance':
    'Veloce ed efficiente; buon equilibrio tra velocità e qualità',
  'model.tooltip.rolmocr.notes':
    'Non specifico per i manga — migliore per documenti e testi generici',

  'model.tooltip.glm_ocr_onnx.highlights':
    'Lettore di testo compatto e preciso\nUno dei più precisi nei benchmark\nFunziona bene su computer meno potenti',
  'model.tooltip.glm_ocr_onnx.unique':
    'Combina alta precisione con dimensioni ridotte — uno dei più precisi pur essendo leggero',
  'model.tooltip.glm_ocr_onnx.bestFor':
    'Leggere documenti con alta precisione senza bisogno di un computer potente',
  'model.tooltip.glm_ocr_onnx.performance':
    'Molto leggero e veloce; funziona bene anche su computer senza scheda video potente',
  'model.tooltip.glm_ocr_onnx.notes':
    'Supporta diverse lingue ma il giapponese è limitato. Ottimo per documenti in generale.',

  'model.tooltip.paddleocr.highlights':
    'Legge testo in russo\nVeloce e affidabile\nBuona opzione per manhwa in russo',
  'model.tooltip.paddleocr.unique':
    "Ottimizzato specificamente per l'alfabeto cirillico — migliore dei lettori generici per il russo",
  'model.tooltip.paddleocr.bestFor':
    'Leggere testo russo nei fumetti e nei manga',
  'model.tooltip.paddleocr.performance':
    'Molto veloce, funziona bene sulla maggior parte dei computer',
  'model.tooltip.paddleocr.notes': 'La scelta migliore per il testo in russo',

  'model.tooltip.paddleocr_latin_v5.highlights':
    'Legge testo in lingue europee\nFrancese, tedesco, spagnolo, portoghese e altre\nVeloce e affidabile',
  'model.tooltip.paddleocr_latin_v5.unique':
    'Ottimizzato per gli alfabeti europei — funziona meglio dei lettori generici per queste lingue',
  'model.tooltip.paddleocr_latin_v5.bestFor':
    'Leggere testo in lingue europee come francese, tedesco, spagnolo, italiano e portoghese',
  'model.tooltip.paddleocr_latin_v5.performance':
    'Veloce e leggero, funziona bene su qualsiasi computer',
  'model.tooltip.paddleocr_latin_v5.notes':
    'Migliore opzione per lingue europee con alfabeto latino',

  'model.tooltip.paddleocr_ch_v5.highlights':
    'Legge testo in cinese semplificato e tradizionale\nVeloce e preciso\nIdeale per i manhua',
  'model.tooltip.paddleocr_ch_v5.unique':
    'Ottimizzato specificamente per i caratteri cinesi — riconosce meglio i tratti complessi e i font variati',
  'model.tooltip.paddleocr_ch_v5.bestFor':
    'Leggere testo di manhua e qualsiasi contenuto in cinese con alta precisione',
  'model.tooltip.paddleocr_ch_v5.performance':
    'Veloce e leggero, funziona bene sulla maggior parte dei computer',
  'model.tooltip.paddleocr_ch_v5.notes':
    'La scelta migliore per il cinese. Semplice ed efficiente.',

  'model.tooltip.paddleocr_en_v5.highlights':
    'Legge testo in inglese\nVeloce e preciso\nIdeale per i fumetti occidentali',
  'model.tooltip.paddleocr_en_v5.unique':
    "Ottimizzato specificamente per l'inglese — riconosce meglio font e stili variati",
  'model.tooltip.paddleocr_en_v5.bestFor':
    'Leggere testo in inglese da fumetti occidentali e manga tradotti',
  'model.tooltip.paddleocr_en_v5.performance':
    'Molto veloce e leggero, funziona su qualsiasi computer',
  'model.tooltip.paddleocr_en_v5.notes':
    'La scelta migliore per il testo in inglese',

  'model.tooltip.easyocr.highlights':
    'Legge testo in più di 80 lingue\nFacile da usare e versatile\nPiù lingue nella stessa immagine',
  'model.tooltip.easyocr.unique':
    'Uno dei più versatili — riesce a leggere molte lingue diverse nella stessa immagine',
  'model.tooltip.easyocr.bestFor':
    'Quando serve un lettore che funzioni per molte lingue senza cambiare modello',
  'model.tooltip.easyocr.performance':
    'Buono per testo pulito; ha difficoltà con font stilizzati e testo verticale',
  'model.tooltip.easyocr.notes':
    'Non ottimizzato per i manga. Utile come opzione generica multilingue.',

  'model.tooltip.pororo.highlights':
    'Legge testo coreano\nIdeale per i manhwa coreani\nLeggero e affidabile',
  'model.tooltip.pororo.unique':
    "Progettato specificamente per l'alfabeto coreano (Hangul) — riconosce meglio dei lettori generici",
  'model.tooltip.pororo.bestFor':
    'Leggere testo di manhwa coreani — la migliore opzione dedicata per il coreano',
  'model.tooltip.pororo.performance':
    'Buona precisione per il coreano; leggero e veloce',
  'model.tooltip.pororo.notes':
    'Solo coreano e inglese. Mantenuto dalla community.',

  'model.tooltip.paddleocr_vl_1_5.highlights':
    'Lettore di testo avanzato multilingue\nUno dei più precisi al mondo\nFunziona con giapponese, cinese, inglese e altro',
  'model.tooltip.paddleocr_vl_1_5.unique':
    'Riesce a rilevare testo in formati irregolari e poligonali — legge testo curvo, inclinato e in posizioni difficili',
  'model.tooltip.paddleocr_vl_1_5.bestFor':
    'Lettura avanzata del testo per documenti e fumetti in diverse lingue',
  'model.tooltip.paddleocr_vl_1_5.performance':
    'Preciso e versatile; funziona bene su schede video comuni',
  'model.tooltip.paddleocr_vl_1_5.notes':
    'Multilingue, include giapponese, cinese, inglese. Base per il fine-tuning su manga.',

  'model.tooltip.aot.highlights':
    'Rimuove il testo giapponese dai manga\nRicostruisce automaticamente lo sfondo\nVeloce ed efficiente',
  'model.tooltip.aot.unique':
    'Progettato appositamente per rimuovere il testo dai manga — comprende lo stile artistico e ricostruisce lo sfondo in modo naturale',
  'model.tooltip.aot.bestFor':
    'Rimuovere il testo giapponese dai pannelli dei manga ricostruendo lo sfondo',
  'model.tooltip.aot.performance':
    'Veloce, funziona bene con o senza scheda video',
  'model.tooltip.aot.notes':
    'Buona opzione predefinita per la pulizia del testo nei manga',

  'model.tooltip.lama_manga.highlights':
    'Rimuove il testo da manga e anime\nFunziona con immagini di qualsiasi dimensione\nGestisce bene aree di testo estese',
  'model.tooltip.lama_manga.unique':
    "Nessun limite di dimensione dell'immagine — funziona con pagine di qualsiasi risoluzione, a differenza di altri modelli",
  'model.tooltip.lama_manga.bestFor':
    'Rimuovere il testo da pagine di manga di qualsiasi dimensione, specialmente blocchi grandi di testo e balloon',
  'model.tooltip.lama_manga.performance':
    'Accetta qualsiasi dimensione di immagine; buona velocità sulla maggior parte dei computer',
  'model.tooltip.lama_manga.notes':
    "Versione migliorata di LaMa — da usare quando la pagina è grande o c'è molto testo da rimuovere",

  'model.tooltip.opencv_lama.highlights':
    'Rimuove il testo dalle immagini\nVersione leggera e semplice\nBuono per uso generale',
  'model.tooltip.opencv_lama.unique':
    'Versione ufficiale mantenuta da OpenCV — integrazione diretta e affidabile',
  'model.tooltip.opencv_lama.bestFor':
    'Rimozione del testo semplice e veloce quando non serve la massima qualità',
  'model.tooltip.opencv_lama.performance':
    'Leggero e veloce, funziona su qualsiasi computer',
  'model.tooltip.opencv_lama.notes':
    'Buona opzione leggera per la pulizia semplice del testo',

  'model.tooltip.lama_fp32.highlights':
    'Rimuove il testo dalle immagini con alta qualità\nMigliore qualità tra gli strumenti di rimozione\nIdeale quando la qualità conta più della velocità',
  'model.tooltip.lama_fp32.unique':
    'La versione più fedele e precisa di LaMa — riproduce lo sfondo in modo più naturale rispetto alle versioni leggere',
  'model.tooltip.lama_fp32.bestFor':
    'Quando la qualità della pulizia è più importante della velocità',
  'model.tooltip.lama_fp32.performance':
    'Più lento delle versioni leggere; richiede più memoria',
  'model.tooltip.lama_fp32.notes':
    'Da usare quando la qualità è la priorità. Dimensione di input fissa.',

  'model.tooltip.waifu2x_swin_unet_art_scan_2x.highlights':
    'Migliora le scansioni anime in 2x\nRimuove il rumore e migliora la qualità\nIdeale per scansioni di manga',
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.unique':
    "Il classico per migliorare scansioni di anime e manga — rimuove il rumore e migliora l'immagine contemporaneamente",
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.bestFor':
    'Migliorare scansioni di manga a bassa risoluzione e rimuovere artefatti di compressione JPEG',
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.performance':
    'Leggero e veloce, funziona su qualsiasi computer',
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.notes':
    'Buona opzione predefinita per migliorare scansioni di manga in 2x',

  'model.tooltip.waifu2x_swin_unet_art_scan_4x.highlights':
    'Migliora le scansioni anime in 4x\nRimuove il rumore e migliora la qualità\nPer quando serve più dettaglio',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.unique':
    'Versione 4x del classico Waifu2x — migliora molto di più la risoluzione mantenendo le linee pulite',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.bestFor':
    'Migliorare scansioni di manga con un aumento maggiore di risoluzione preservando il line art pulito',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.performance':
    'Più lento della versione 2x; comunque leggero',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.notes':
    'Da usare quando serve più risoluzione di quella offerta dal 2x',

  'model.tooltip.waifu2x_swin_unet_art_2x.highlights':
    "Migliora l'arte anime in 2x\nPer arte già pulita e di buona qualità\nPreserva i dettagli fini",
  'model.tooltip.waifu2x_swin_unet_art_2x.unique':
    'Ottimizzato per arte già pulita — preserva i dettagli fini senza aggiungere rumore',
  'model.tooltip.waifu2x_swin_unet_art_2x.bestFor':
    'Migliorare arte digitale pulita e manga che hanno già una buona qualità di origine',
  'model.tooltip.waifu2x_swin_unet_art_2x.performance':
    'Leggero e veloce, funziona su qualsiasi computer',
  'model.tooltip.waifu2x_swin_unet_art_2x.notes':
    "Meno aggressivo della versione per scansioni — da usare quando l'immagine è già pulita",

  'model.tooltip.4xnomos2_hq_mosr.highlights':
    'Ingrandisce le immagini in 4x con qualità massima\nPreserva dettagli fini e linee nitide\nIdeale per scansioni già pulite',
  'model.tooltip.4xnomos2_hq_mosr.unique':
    "Focalizzato sulla qualità — mantiene ogni dettaglio dell'immagine originale intatto",
  'model.tooltip.4xnomos2_hq_mosr.bestFor':
    'Migliorare scansioni di manga già pulite e di buona qualità',
  'model.tooltip.4xnomos2_hq_mosr.performance':
    'Buona velocità; file piccolo di soli 16MB',
  'model.tooltip.4xnomos2_hq_mosr.notes':
    "Funziona meglio con immagini già pulite. Se l'immagine ha rumore o compressione, puliscila prima.",

  'model.tooltip.4xspankendata.highlights':
    'Ingrandisce le immagini in 4x in modo molto veloce\nFile minuscolo di soli 1,6MB\nFunziona bene anche su computer meno potenti',
  'model.tooltip.4xspankendata.unique':
    'Estremamente leggero — perfetto quando serve velocità senza occupare spazio',
  'model.tooltip.4xspankendata.bestFor':
    'Upscaling rapido di qualsiasi tipo di immagine quando il tempo è importante',
  'model.tooltip.4xspankendata.performance':
    'Molto veloce; file di soli 1,6MB — ideale per CPU',
  'model.tooltip.4xspankendata.notes':
    "Sorprendentemente piccolo per la qualità che offre. Ottima opzione per l'elaborazione in batch.",

  'model.tooltip.2x_hfa2kcompact.highlights':
    'Ingrandisce le immagini in 2x con buon equilibrio\nAddestrato su frame di anime moderni\nGestisce bene compressione e sfocature',
  'model.tooltip.2x_hfa2kcompact.unique':
    'Specialista di anime — comprende lo stile visivo delle animazioni moderne',
  'model.tooltip.2x_hfa2kcompact.bestFor':
    'Pagine di manga/anime con artefatti di compressione o qualità irregolare',
  'model.tooltip.2x_hfa2kcompact.performance':
    'Veloce e leggero; file di soli 4,6MB',
  'model.tooltip.2x_hfa2kcompact.notes':
    'Robusto per immagini reali — funziona bene anche con scansioni imperfette.',

  'model.tooltip.2x_digitalfilm_superultracompact.highlights':
    'Ingrandisce le immagini in 2x con dimensioni minime\nIdeale quando lo spazio su disco è limitato\nBuona qualità per le dimensioni',
  'model.tooltip.2x_digitalfilm_superultracompact.unique':
    'Ultra-compatto — sta ovunque senza sacrificare la qualità',
  'model.tooltip.2x_digitalfilm_superultracompact.bestFor':
    'Upscaling leggero quando serve risparmiare spazio o memoria',
  'model.tooltip.2x_digitalfilm_superultracompact.performance':
    'Veloce; ~20MB; potrebbe richiedere conversione manuale del formato',
  'model.tooltip.2x_digitalfilm_superultracompact.notes':
    'Se il file non si carica, potrebbe essere necessario convertire il formato esternamente.',

  'model.tooltip.2x_anifilm_compact.highlights':
    'Ingrandisce le immagini in 2x ottimizzato per anime\nBuon equilibrio tra qualità e dimensioni\nStile visivo preservato',
  'model.tooltip.2x_anifilm_compact.unique':
    "Comprende lo stile visivo di anime e film d'animazione — mantiene l'estetica originale",
  'model.tooltip.2x_anifilm_compact.bestFor':
    'Contenuti anime dove si vuole mantenere il look originale senza esagerare',
  'model.tooltip.2x_anifilm_compact.performance':
    'Veloce; ~20MB; potrebbe richiedere conversione manuale del formato',
  'model.tooltip.2x_anifilm_compact.notes':
    'Se il file non si carica, potrebbe essere necessario convertire il formato esternamente.',

  'model.tooltip.2xnomosuni_span_multijpg_ldl.highlights':
    'Ingrandisce le immagini in 2x con resistenza alla compressione\nAddestrato per gestire diversi livelli di qualità JPG\nRobusto per scansioni imperfette',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.unique':
    'Specialista nella gestione della compressione JPG — funziona bene anche con scansioni di bassa qualità',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.bestFor':
    'Scansioni di manga con compressione JPG variabile o artefatti di qualità',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.performance':
    'Veloce; ~20MB; potrebbe richiedere conversione manuale del formato',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.notes':
    'Se il file non si carica, potrebbe essere necessario convertire il formato esternamente.',

  'model.tooltip.realesrgan_x4plus.highlights':
    'Ingrandisce le immagini in 4x con alta versatilità\nGestisce bene JPEG, sfocature e rumore\nFunziona con qualsiasi tipo di contenuto',
  'model.tooltip.realesrgan_x4plus.unique':
    "Il più versatile — comprende e corregge diversi tipi di degradazione dell'immagine",
  'model.tooltip.realesrgan_x4plus.bestFor':
    "Pagine di manga con contenuto misto; artefatti JPEG; l'upscaler più versatile",
  'model.tooltip.realesrgan_x4plus.performance':
    'Buona velocità; leggermente più pesante dei compatti',
  'model.tooltip.realesrgan_x4plus.notes':
    'Per anime/manga puri, preferisci la versione anime (6B) che è più veloce e ottimizzata.',

  'model.tooltip.4xhfa2kludvaeswinir_light.highlights':
    'Ingrandisce le immagini in 4x ottimizzato per anime\nBuon equilibrio tra qualità e prestazioni\nPreserva lo stile visivo anime',
  'model.tooltip.4xhfa2kludvaeswinir_light.unique':
    "Combina qualità di upscaling con attenzione ai dettagli visivi dell'anime",
  'model.tooltip.4xhfa2kludvaeswinir_light.bestFor':
    'Upscaling 4x di contenuti anime con buona qualità di origine',
  'model.tooltip.4xhfa2kludvaeswinir_light.performance':
    'Velocità moderata; ~70MB; potrebbe richiedere conversione manuale del formato',
  'model.tooltip.4xhfa2kludvaeswinir_light.notes':
    'Se il file non si carica, potrebbe essere necessario convertire il formato esternamente.',

  'model.tooltip.baka_content_cc.highlights':
    'Separa il testo dai balloon nelle pagine di fumetti\nIdentifica cosa è testo e cosa è balloon\nVeloce ed efficiente',
  'model.tooltip.baka_content_cc.unique':
    'Integrato con il sistema di rilevamento di testo e balloon — lavora in sinergia con altri modelli',
  'model.tooltip.baka_content_cc.bestFor':
    "Separare testo e balloon nelle pagine di manga per l'elaborazione successiva",
  'model.tooltip.baka_content_cc.performance':
    'Veloce e leggero, non richiede una scheda video potente',
  'model.tooltip.baka_content_cc.notes':
    'Usato come parte della pipeline di segmentazione',
  'settings.tooltips.title': 'Suggerimenti',
  'settings.tooltips.description':
    "Controlla quando i suggerimenti contestuali vengono visualizzati durante l'uso della dashboard.",
  'settings.tooltips.enableTitle': 'Mostra suggerimenti contestuali',
  'settings.tooltips.enableDesc':
    'Mostra suggerimenti animati la prima volta che utilizzi ogni strumento per sessione.',
  'dashboard.hint.healing.ariaLabel': 'Suggerimento dello strumento Healing',
  'dashboard.hint.healing.eyebrow': 'Nuovo strumento',
  'dashboard.hint.healing.body':
    "Usa il Healing Brush per rimuovere difetti, bordi spezzati e residui di testo. Dipingi sull'area da correggere e clicca su Applica per far ricostruire all'IA la regione in modo impercettibile.",
  'dashboard.hint.healing.footer':
    'Questo suggerimento non verrà più mostrato in questa sessione. Disattiva tutti i suggerimenti in Impostazioni → App.',
  'dashboard.aio.presets.tooltip':
    'I preset salvano una combinazione per lingua di modelli e fasi. Usali per cambiare più rapidamente la configurazione AIO quando modifichi la lingua di origine o il flusso di lavoro.',
  'dashboard.aio.presets.tooltipAria': 'A cosa servono i preset di lingua',
  'dashboard.aio.cleanImage.tooltip':
    'Clean Image è la fase di pulizia e inpainting. Rimuove il testo e gli artefatti selezionati prima del passaggio finale di rendering/modifica.',
  'dashboard.aio.cleanImage.tooltipAria': 'A cosa serve Clean Image',
  'dashboard.aio.clean.maskDilation.tooltip':
    "Espande la maschera di pulizia prima dell'inpainting. Aumentala se i bordi del testo rimangono; mantienila più bassa per preservare le opere vicine.",
  'dashboard.aio.clean.maskDilation.tooltipAria':
    'A cosa serve la dilatazione della maschera',
  'dashboard.dashboardLlm.hdStrategy.tooltip':
    "Definisce come vengono preparate le immagini grandi prima della pulizia. Resize scala la pagina, Crop la divide in riquadri e Original la invia così com'è.",
  'dashboard.dashboardLlm.hdStrategy.tooltipAria':
    'A cosa serve la strategia HD',
  'dashboard.dashboardLlm.cropMargin.tooltip':
    'Aggiunge spaziatura extra attorno a ogni riquadro di ritaglio. Aumentala se i bordi perdono contesto o mostrano giunture dopo la pulizia.',
  'dashboard.dashboardLlm.cropMargin.tooltipAria':
    'A cosa serve il margine di ritaglio',
  'dashboard.dashboardLlm.cropTriggerSize.tooltip':
    "Dimensione minima dell'immagine che attiva la suddivisione in riquadri. Le immagini più piccole rimangono come un unico pezzo; quelle più grandi vengono suddivise.",
  'dashboard.dashboardLlm.cropTriggerSize.tooltipAria':
    'A cosa serve la dimensione di attivazione del ritaglio',
  'common.basicInfo': "Informazioni di base",
  'common.resolve': "Risolvi",
  'common.dismiss': "Ignora",
  'common.title': "Titolo",
  'common.summary': "Riepilogo",
  'common.summaryPlaceholder': "Scrivi un riepilogo breve e chiaro.",
  'common.mainDescription': "Descrizione principale",
  'common.chapter': "Capitolo",
  'common.genres': "Generi",
  'common.editorialDescription': "Descrizione editoriale",
  'common.removeValue': "Rimuovi {value}",
  'settings.integrations.discordWebhook': "Webhook Discord",
  'discord.presence.appName': "KŌMA Studio",
  'discord.presence.button.website': "Sito web",
  'discord.presence.button.download': "Scarica",
  'discord.presence.idle.details': "Esplora gli strumenti di scanlation",
  'discord.presence.idle.state': "Inattivo",
  'discord.presence.workspace.details': "Organizza le pagine e prepara il flusso",
  'discord.presence.aio.details': "Esegue la pipeline completa del manga",
  'discord.presence.mode.automatic': "Modalità automatica",
  'discord.presence.mode.manual': "Modalità manuale",
  'discord.presence.mode.basic': "Modalità: Base",
  'discord.presence.mode.advanced': "Modalità: Avanzata",
  'discord.presence.cleaner.details': "Pulisce balloon e ripristina l'arte",
  'discord.presence.cleaner.state.basic': "Modalità: Base",
  'discord.presence.cleaner.state.advanced': "Modalità: Avanzata",
  'discord.presence.translator.details': "Traduce i dialoghi mantenendo il tono",
  'discord.presence.translator.fileDetails': "Traduzione - {fileName}",
  'discord.presence.typesetter.details': "Riposiziona il testo finale nella pagina",
  'discord.presence.typesetter.fileDetails': "Modifica testo - {fileName}",
  'discord.presence.redraw.fileDetails': "Ridisegno - {fileName}",
  'discord.presence.raw.details': "Testa i provider e confronta gli output grezzi",
  'discord.presence.proofreader.details': "Rivede le pagine prima del rilascio finale",
  'discord.presence.stitch.details': "Unisce i pannelli in lunghe pagine continue",
  'discord.presence.split.details': "Separa le doppie pagine in tagli puliti",
  'discord.presence.watermark.details': "Applica crediti e identità alle pagine",
  'discord.presence.enhance.details': "Aumenta la risoluzione e rifinisce l'arte",
  'discord.presence.optimizer.details': "Ottimizza i capitoli per export e consegna",
  'discord.presence.blogger.details': "Prepara i post dei capitoli e la consegna CDN",
  'discord.presence.imgur.details': "Carica set di immagini e condivide i link",
  'discord.presence.guides.details': "Impara flussi, scorciatoie e buone pratiche",
  'discord.presence.resources.details': "Esplora risorse, riferimenti e materiale di supporto",
  'discord.presence.batch.details': "Elabora le pagine una dopo l'altra",
  'discord.presence.batch.fileDetails': "Elaborazione batch - {fileName}",
  'discord.presence.batch.state': "{current}/{total} file",
  'discord.presence.batch.label': "Modalità batch",
  'discord.presence.section.working': "Al lavoro in {section}",
  'discord.presence.section.viewing': "Visualizzazione di {section}",
  'discord.presence.settings.details': "Regola le preferenze dello studio",
  'discord.presence.settings.label': "Impostazioni",
  'discord.presence.rankings.details': "Confronta qualità, velocità e costo dei modelli",
  'discord.presence.rankings.label': "Classifiche",
  'discord.presence.scanlationFeed.details': "Controlla uscite e novità della community",
  'discord.presence.scanlationFeed.label': "Feed Scanlation",
  'discord.presence.loginRegister.details': "Accede e gestisce l'accesso all'account",
  'discord.presence.loginRegister.label': "Accesso / Registrazione",
  'typographer.shapeApplied': "Forma applicata.",
  'feed.tabsAria': "Sezioni del Feed Scanlation",
  'feed.actions.publishPost': "Pubblica {type}",
} as const;
