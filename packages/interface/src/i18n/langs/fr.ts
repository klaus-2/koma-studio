import { TranslationCatalog } from '../messages';

export const frMessages: TranslationCatalog = {
  'app.restricted.title': 'Accès restreint',
  'app.restricted.description':
    "Cette version n'est disponible que dans l'application de bureau officielle.",
  'app.restricted.publicDocs':
    'Les documents légaux restent accessibles publiquement :',
  'app.transition.loading': 'Chargement...',
  'app.transition.enterDashboard': 'Accès au tableau de bord...',
  'app.transition.updateSession': 'Mise à jour de la session...',
  'app.transition.openFeed': 'Ouverture du flux Scanlation...',
  'app.transition.openRankings': 'Ouverture du classement des modèles...',
  'settings.backToDashboard': 'Retour au tableau de bord',
  'settings.stats.version': 'version',
  'settings.app.updater.status.idle': 'Inactif',
  'settings.app.updater.status.checking': 'Vérification…',
  'settings.app.updater.status.available': 'Mise à jour disponible',
  'settings.app.updater.status.notAvailable': 'À jour',
  'settings.app.updater.status.downloading': 'Téléchargement…',
  'settings.app.updater.status.downloaded': 'Prêt à installer',
  'settings.app.updater.status.error': 'Erreur',
  'settings.app.updater.channel.stable': 'Stable (Recommandé)',
  'settings.app.updater.channel.beta':
    'Bêta (Fonctionnalités en avant-première)',
  'settings.app.updater.channel.canary': 'Canary (Instable)',
  'settings.app.updater.version': 'Version',
  'settings.app.updater.build': 'Build',
  'settings.app.updater.releaseNotes': 'Notes de version',
  'settings.app.updater.noNotes': 'Aucune note pour cette version.',
  'settings.app.updater.checkNow': 'Vérifier les mises à jour',
  'settings.app.updater.installNow': 'Redémarrer et mettre à jour',
  'settings.app.updater.desktopOnly':
    "Disponible uniquement dans l'application de bureau.",
  'settings.app.updater.autoCheck': 'Vérification automatique',
  'settings.app.updater.autoCheckDesc':
    'Vérifier les nouvelles versions au démarrage.',
  'settings.app.updater.channel': 'Canal de mise à jour',
  'settings.app.updater.channelDesc': 'Versions stables ou expérimentales.',
  'settings.app.fonts.title': 'Polices système',
  'settings.app.fonts.desc':
    'Gérer les polices pour le Typesetter et le rendu.',
  'settings.app.fonts.systemCount': '{count} polices détectées',
  'settings.app.fonts.customTitle': 'Polices personnalisées',
  'settings.app.fonts.import': 'Importer .ttf / .otf',
  'settings.app.fonts.noCustom': 'Aucune police personnalisée importée.',
  'settings.app.fonts.importSuccess': 'Police {name} importée avec succès.',
  'settings.app.fonts.importError': "Échec de l'importation de la police.",
  'settings.app.fonts.deleteConfirm':
    'Voulez-vous supprimer la police {name} ?',
  'settings.app.autosave.title':
    "Sauvegarde automatique de l'espace de travail",
  'settings.app.autosave.desc':
    'Sauvegarder automatiquement la progression du projet en local.',
  'settings.app.autosave.enabled': 'Sauvegarde automatique activée',
  'settings.app.autosave.interval': 'Intervalle (minutes)',
  'settings.app.autosave.saveNow': 'Enregistrer les paramètres',
  'settings.app.autosave.success':
    'Paramètres de sauvegarde automatique mis à jour.',
  'settings.app.autosave.error': "Échec de l'enregistrement des paramètres.",
  'settings.app.reset.title': 'Zone de danger',
  'settings.app.reset.desc':
    'Effacer les données locales et restaurer les paramètres par défaut.',
  'settings.app.reset.button': "Réinitialiser l'application",
  'settings.app.reset.confirm':
    'Cela vous déconnectera et effacera tous les préréglages et caches locaux. Voulez-vous continuer ?',
  'settings.app.reset.success': 'Application réinitialisée. Redémarrage...',
  'settings.general.profile.title': 'Profil',
  'settings.general.profile.desc':
    'Informations de votre compte et préférences globales.',
  'settings.general.profile.name': "Nom d'affichage",
  'settings.general.profile.email': 'Adresse e-mail principale',
  'settings.general.profile.verified': 'E-mail vérifié',
  'settings.general.profile.unverified': 'E-mail en attente',
  'settings.general.profile.verifyBtn': 'Vérifier maintenant',
  'settings.general.profile.sending': 'Envoi...',
  'settings.general.profile.verifySuccess': 'E-mail de vérification envoyé.',
  'settings.general.profile.verifyError': "Échec de l'envoi de l'e-mail.",
  'settings.general.profile.save': 'Enregistrer le profil',
  'settings.general.profile.success': 'Profil mis à jour avec succès.',
  'settings.general.profile.error': 'Échec de la mise à jour du profil.',
  'settings.general.travel.title': 'Jeton de déplacement',
  'settings.general.travel.desc':
    "Accédez à votre compte Studio sur d'autres appareils sans vous déconnecter.",
  'settings.general.travel.active': 'Jeton actif',
  'settings.general.travel.inactive': 'Aucun jeton actif',
  'settings.general.travel.generate': 'Générer un nouveau jeton',
  'settings.general.travel.generateDesc': 'Valide pendant {days} jours.',
  'settings.general.travel.copyAria': 'Copier le jeton',
  'settings.general.travel.revoke': 'Tout révoquer',
  'settings.general.travel.revoked': 'Jetons révoqués.',
  'settings.general.travel.success': 'Jeton généré avec succès.',
  'settings.general.travel.error': 'Échec du traitement du jeton.',
  'settings.general.language.title': 'Interface',
  'settings.general.language.desc': "Langue et thème de l'application.",
  'settings.general.language.label': 'Langue',
  'settings.general.language.system': 'Suivre le système',
  'settings.general.theme.label': 'Thème',
  'settings.general.theme.dark': 'Sombre (Par défaut)',
  'settings.general.theme.light': 'Clair',
  'settings.general.theme.amoled': 'OLED / Noir',
  'settings.presets.aio.title': 'Préréglages AIO',
  'settings.presets.aio.desc':
    'Configurer les modèles par défaut pour chaque étape et chaque langue.',
  'settings.presets.aio.active': 'Préréglage actif pour {lang}',
  'settings.presets.aio.none': 'Aucun préréglage configuré.',
  'settings.presets.aio.create': 'Nouveau préréglage',
  'settings.presets.aio.edit': 'Modifier le préréglage',
  'settings.presets.aio.delete': 'Supprimer le préréglage',
  'settings.presets.aio.name': 'Nom du préréglage',
  'settings.presets.aio.lang': 'Langue source',
  'settings.presets.aio.models': 'Configuration des modèles',
  'settings.presets.aio.save': 'Enregistrer le préréglage',
  'settings.presets.aio.success': 'Préréglage enregistré avec succès.',
  'settings.presets.aio.error': "Échec de l'enregistrement du préréglage.",
  'settings.presets.typo.title': 'Préréglages Typesetter',
  'settings.presets.typo.desc':
    'Styles de police, couleurs et bulles préconfigurés.',
  'settings.presets.render.title': 'Styles de rendu',
  'settings.presets.render.desc':
    "Configurer le rendu du texte sur l'image finale.",
  'settings.integrations.discord.title': 'Webhook Discord',
  'settings.integrations.discord.desc':
    'Notifications automatiques pour votre serveur.',
  'settings.integrations.discord.url': 'URL du webhook',
  'settings.integrations.discord.test': 'Tester la connexion',
  'settings.integrations.discord.events': 'Événements déclencheurs',
  'settings.integrations.discord.success':
    'Configuration enregistrée et test envoyé.',
  'settings.integrations.discord.error':
    "Échec de l'enregistrement ou du test du webhook.",
  'settings.integrations.discord.invalidUrl': 'URL de webhook invalide.',
  'settings.integrations.blogger.successSecure':
    "Configuration Blogger enregistrée dans le stockage sécurisé de l'application de bureau.",
  'settings.integrations.blogger.successLocal':
    'Configuration Blogger enregistrée localement.',
  'settings.integrations.blogger.saveError':
    "Échec de l'enregistrement de la configuration Blogger.",
  'settings.integrations.blogger.testError':
    'Échec de la validation de la connexion Blogger.',
  'settings.integrations.imgur.successSecure':
    "Configuration Imgur enregistrée dans le stockage sécurisé de l'application de bureau.",
  'settings.integrations.imgur.successLocal':
    'Configuration Imgur enregistrée localement.',
  'settings.integrations.imgur.saveError':
    "Échec de l'enregistrement de la configuration Imgur.",
  'settings.travel.blocked.notDesktop':
    "Disponible uniquement dans l'application de bureau authentifiée.",
  'settings.travel.blocked.noEmail':
    "L'envoi d'e-mails n'est pas configuré dans cet environnement.",
  'settings.travel.blocked.validating':
    'Validation de la configuration e-mail…',
  'settings.integrations.blogger.title': 'CDN Blogger',
  'settings.integrations.blogger.desc':
    "Hébergement d'images et publication directe.",
  'settings.integrations.imgur.desc':
    'Rotation de Client ID pour les envois anonymes.',
  'settings.theme.title': 'Apparence',
  'settings.theme.description':
    "Choisissez entre le mode sombre et clair pour l'interface.",
  'settings.theme.dark': 'Sombre',
  'settings.theme.darkDesc': 'Interface sombre par défaut',
  'settings.theme.light': 'Clair',
  'settings.theme.lightDesc': 'Interface claire',
  'settings.language.title': "Langue de l'interface",
  'settings.language.description':
    "Choisissez la langue de l'application. Sur bureau, la détection initiale utilise les langues préférées de votre système.",
  'settings.language.label': 'Langue',
  'settings.language.systemLabel': 'Détecté par le système',
  'settings.language.applied':
    'Les modifications sont appliquées immédiatement et enregistrées sur cet appareil pour les builds de développement et packagés.',
  'auth.tabs.login': 'Connexion',
  'auth.tabs.register': 'Créer un compte',
  'auth.legal.reviewDocs':
    'En continuant, veuillez consulter notre documentation légale :',
  'auth.quote.line1': 'Toute grande histoire',
  'auth.quote.line2': 'commence par',
  'auth.quote.line3': 'une seule page.',
  'auth.stats.activeScanlators': 'Utilisateurs actifs',
  'auth.stats.tools': 'Outils',
  'auth.stats.pagesProcessed': 'Pages traitées',
  'auth.toolkit.ai': 'IA et automatisation',
  'auth.toolkit.tools': 'Outils',
  'auth.toolkit.learning': 'Apprentissage',
  'auth.toolkit.aiTranslation': 'Traduction IA',
  'auth.toolkit.autoRedraw': 'Redessin automatique',
  'auth.toolkit.advancedEditor': 'Éditeur avancé',
  'auth.toolkit.proTypesetting': 'Composition Pro',
  'auth.toolkit.qualityControl': 'Contrôle qualité',
  'auth.toolkit.guides': 'Guides et tutoriels',
  'auth.toolkit.resources': 'Ressources et assets',
  'auth.community.join': 'Rejoindre la communauté',
  'auth.cover.popular': 'POPULAIRE',
  'auth.cover.new': 'NOUVEAU',
  'auth.cover.cleanRedraw': 'Nettoyage + Redessin',
  'auth.cover.translation': 'Traduction',
  'auth.cover.typography': 'Typographie',
  'auth.cover.fullEditing': 'Édition complète',
  'auth.cover.allInOne': 'AIO - Tout en un',
  'auth.cover.finalQc': 'Nettoyage final',
  'login.subtitle.credentials':
    'Connectez-vous à votre compte et reprenez là où vous vous étiez arrêté.',
  'login.subtitle.travel':
    'Autorisez temporairement cet ordinateur sans quitter le processus de connexion.',
  'login.error.completeCaptchaTravel':
    "Complétez le captcha pour finaliser l'autorisation de cet ordinateur.",
  'login.error.completeCaptcha': 'Complétez le captcha pour continuer.',
  'login.error.missingCredentials':
    "Retournez en arrière et saisissez l'adresse e-mail et le mot de passe du compte avant d'autoriser cet ordinateur.",
  'login.error.missingTravelToken':
    'Saisissez le jeton reçu par e-mail pour finaliser la connexion.',
  'login.error.generic': 'Échec de la connexion',
  'login.warning.mandatoryUpdateTitle': 'Mise à jour obligatoire disponible',
  'login.warning.mandatoryUpdateBody':
    "Installez la version {version} pour continuer à utiliser l'application.",
  'login.warning.downloadUpdate': 'Télécharger la mise à jour',
  'login.warning.downloadingUpdate': 'Téléchargement de la mise à jour...',
  'login.warning.installUpdateNow': 'Installer la mise à jour maintenant',
  'login.verification.title': 'Que faire',
  'login.verification.wait': 'Patientez {seconds} secondes.',
  'login.verification.retrySameDevice':
    'Essayez de vous reconnecter depuis le même appareil ou réseau.',
  'login.verification.avoidVpn':
    'Évitez de changer de VPN ou de réseau pendant cette période.',
  'login.email': 'E-mail',
  'login.password': 'Mot de passe',
  'login.forgotPassword': 'Mot de passe oublié',
  'login.rememberMe': 'Se souvenir de moi sur cet appareil',
  'login.travel.eyebrow': 'Point de contrôle de sécurité',
  'login.travel.title': 'Cet ordinateur nécessite une autorisation temporaire',
  'login.travel.copy':
    'Ouvrez KŌMA Studio sur votre PC principal et accédez à Paramètres > Accès de déplacement pour envoyer le code et finaliser cette connexion.',
  'login.travel.accountInUse': 'Compte utilisé : {email}',
  'login.travel.sameAccount':
    'Utilisez le même compte déjà ouvert sur votre PC principal.',
  'login.travel.emailDisabled':
    "L'envoi d'e-mails n'est pas configuré dans cet environnement.",
  'login.travel.emailEnabled':
    "Le code sera envoyé à l'adresse e-mail principale du compte.",
  'login.travel.step1': "Ouvrez l'application sur votre ordinateur principal.",
  'login.travel.step2': "Envoyez le jeton à l'adresse e-mail du compte.",
  'login.travel.step3':
    'Collez le code ci-dessous pour autoriser cet ordinateur.',
  'login.travel.tokenLabel': 'Jeton de déplacement',
  'login.travel.tokenPlaceholder': 'Collez le code reçu par e-mail',
  'login.button.authorizing': 'Autorisation...',
  'login.button.validating': 'Validation...',
  'login.button.updateRequired':
    "Mettez à jour l'application pour vous connecter",
  'login.button.retryIn': 'Réessayer dans {seconds}s',
  'login.button.authorizeComputer': 'Autoriser cet ordinateur',
  'login.button.login': 'Se connecter à mon compte',
  'login.button.changeAccount': 'Retour et changement de compte',
  'login.emailPlaceholder': 'vous@email.com',
  'login.passwordPlaceholder': '•••••••��',
  'login.warning.latestVersion': 'dernière',
  'login.newHere': 'Nouveau ici ?',
  'login.createFreeAccount': 'Créez votre compte gratuit',
  'register.subtitle':
    'Créez votre compte et commencez à explorer des milliers de titres.',
  'register.error.passwordMismatch': 'Les mots de passe ne correspondent pas.',
  'register.error.completeCaptcha':
    "Complétez le captcha pour finaliser l'inscription.",
  'register.error.acceptTerms':
    "Vous devez accepter les Conditions d'utilisation et la Politique de confidentialité pour créer un compte.",
  'register.error.generic': "Échec de l'inscription",
  'register.displayName': "Nom d'affichage",
  'register.displayNamePlaceholder': 'Comment devons-nous vous appeler ?',
  'register.password': 'Mot de passe',
  'register.passwordPlaceholder': '8 caractères minimum',
  'register.confirmPassword': 'Confirmer le mot de passe',
  'register.confirmPasswordPlaceholder':
    'Saisissez à nouveau votre mot de passe',
  'register.legalPrefix': "J'ai lu et j'accepte les",
  'register.legalSuffix':
    "Je comprends que l'inscription utilise des cookies strictement nécessaires et que les fonctionnalités telles que les rapports de bugs et les intégrations sont régies par les documents ci-dessus.",
  'register.button.creating': 'Création du compte...',
  'register.button.loginNow': 'Se connecter maintenant',
  'legal.links.terms': "Conditions d'utilisation",
  'legal.links.privacy': 'Politique de confidentialité',
  'legal.links.cookies': 'Politique de cookies',
  'legal.links.content': 'Avis de contenu',
  'transition.tips.loading': '読み込み中...',
  'transition.tips.preparing': 'Préparation de votre studio...',
  'transition.tips.opening': "Ouverture de votre espace d'édition...",
  'transition.tips.organizing': 'Organisation de vos panneaux...',
  'transition.tips.warming': 'Préchauffage des outils...',
  'transition.tips.workflow': 'Chargement de votre flux de travail...',
  'transition.ariaLabel': 'Page de chargement',
  'ranking.discover.title': 'Soyez le premier à donner votre avis',
  'ranking.discover.subtitle':
    'Modèles officiels sans avis pour le filtre actuel.',
  'ranking.discover.available': '{count} disponible(s)',
  'ranking.discover.empty': 'Tous les modèles filtrés ont déjà des avis.',
  'ranking.discover.local': 'Local',
  'ranking.discover.cloud': 'Cloud',
  'legalHub.version': 'Version',
  'legalHub.updatedAt': 'Mis à jour le',
  'register.button.create': 'Créer mon compte',
  'register.alreadyHaveAccount': 'Vous avez déjà un compte ?',
  'password.rule.minLength': '8 caractères minimum',
  'password.rule.uppercase': 'Lettre majuscule',
  'password.rule.lowercase': 'Lettre minuscule',
  'password.rule.number': 'Chiffre',
  'password.rule.special': 'Caractère spécial',
  'password.level.veryWeak': 'Très faible',
  'password.level.weak': 'Faible',
  'password.level.fair': 'Moyen',
  'password.level.good': 'Bon',
  'password.level.strong': 'Fort',
  'captcha.loadError': 'Échec du chargement du script Turnstile',
  'captcha.missingSiteKey':
    "Captcha activé, mais VITE_TURNSTILE_SITE_KEY n'est pas configuré.",
  'captcha.initError': "Échec de l'initialisation du captcha",
  'captcha.securityCheck': 'Vérification de sécurité',
  'captcha.loadScriptError': 'Échec du chargement du script Turnstile',
  'captcha.success': 'Captcha validé avec succès.',
  'forgot.title': 'Récupération du mot de passe',
  'forgot.subtitle':
    'Saisissez votre e-mail pour recevoir un lien de réinitialisation du mot de passe.',
  'forgot.success':
    'Si un compte avec cette adresse e-mail existe, vous recevrez les instructions pour réinitialiser votre mot de passe.',
  'forgot.error': 'Échec de la demande de réinitialisation du mot de passe',
  'forgot.button.sending': 'Envoi...',
  'forgot.button.send': 'Envoyer le lien de réinitialisation',
  'forgot.remembered': 'Vous vous souvenez de votre mot de passe ?',
  'forgot.backToLogin': 'Retour à la connexion',
  'reset.title': 'Nouveau mot de passe',
  'reset.subtitle': 'Définissez un mot de passe fort pour votre compte.',
  'reset.error.missingToken':
    'Le jeton de réinitialisation est manquant ou invalide.',
  'reset.error.generic': 'Échec de la réinitialisation du mot de passe',
  'reset.success':
    'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.',
  'reset.newPassword': 'Nouveau mot de passe',
  'reset.button.submitting': 'Réinitialisation...',
  'reset.button.submit': 'Réinitialiser le mot de passe',
  'verify.title': "Vérification de l'e-mail",
  'verify.subtitle.pending':
    'Confirmez votre e-mail pour débloquer toutes les fonctionnalités.',
  'verify.subtitle.done': 'Votre e-mail est déjà confirmé.',
  'verify.noEmail': 'aucun-email',
  'verify.verified': 'Vérifié',
  'verify.success':
    'E-mail de confirmation envoyé. Vérifiez votre boîte de réception.',
  'verify.error': "Échec de l'envoi de l'e-mail",
  'verify.button.sending': 'Envoi...',
  'verify.button.resend': "Renvoyer l'e-mail de vérification",
  'verify.button.alreadyConfirmed': 'E-mail déjà confirmé',
  'verify.button.backDashboard': 'Retour au tableau de bord',
  'confirm.title.verifying': "Confirmation de l'e-mail...",
  'confirm.title.success': 'E-mail confirmé !',
  'confirm.title.error': 'Échec de la confirmation',
  'confirm.subtitle.verifying': 'Nous validons votre lien de confirmation.',
  'confirm.subtitle.success':
    'Votre e-mail a été confirmé. Vous pouvez maintenant utiliser toutes les fonctionnalités.',
  'confirm.subtitle.error':
    'Le lien de confirmation est invalide ou a expiré. Veuillez demander un nouvel e-mail.',
  'confirm.status.wait': 'Veuillez patienter pendant la vérification...',
  'confirm.errorCode': "Code d'erreur :",
  'confirm.success': 'Confirmation effectuée avec succès.',
  'confirm.goDashboard': 'Aller au tableau de bord',
  'confirm.goLogin': 'Aller à la connexion',
  'banned.title': 'Accès bloqué',
  'banned.subtitle':
    "Cet accès a été suspendu par la modération de l'application.",
  'banned.reason': 'Raison',
  'banned.scope': 'Portée',
  'banned.duration': 'Durée',
  'banned.until': "Temporaire jusqu'au {value}",
  'banned.undefinedDate': 'date indéterminée',
  'banned.permanent': 'Permanent',
  'banned.policy':
    "Les liens, publications malveillantes ou comportements abusifs peuvent entraîner un bannissement permanent de l'application.",
  'banned.backToLogin': 'Retour à la connexion',
  'session.expiresIn':
    "Votre session expire dans {seconds}s en raison de l'inactivité.",
  'session.stayConnected': 'Rester connecté',
  'update.toast.availableTitle': 'Nouvelle mise à jour disponible',
  'update.toast.availableDescription':
    'La version {version} est prête à être téléchargée sur le canal {channel}.',
  'update.toast.downloadedTitle': 'Mise à jour prête',
  'update.toast.downloadedDescription':
    "Mise à jour prête. {percent}% terminé. Installez maintenant ou à la fermeture de l'application.",
  'update.toast.downloadingTitle': 'Téléchargement de la mise à jour',
  'update.toast.downloadingDescription': '{percent}% terminé.',
  'update.toast.closeAria': 'Fermer le bandeau de mise à jour',
  'update.channel.beta': 'Bêta',
  'update.channel.stable': 'Stable',
  'update.button.download': 'Télécharger',
  'update.button.details': 'Détails',
  'update.button.installNow': 'Installer maintenant',
  'update.button.installLater': 'Installer plus tard',
  'update.progress.title': 'Téléchargement de la mise à jour...',
  'update.modal.title': 'Mise à jour disponible',
  'update.modal.unknownVersion': 'inconnue',
  'update.modal.closeAria': 'Fermer la modale',
  'update.modal.mandatory':
    "Cette mise à jour est obligatoire. Téléchargez-la et installez-la pour continuer à utiliser l'application.",
  'update.modal.releaseNotes': 'Notes de version',
  'update.modal.releaseNotesEmpty':
    'Aucune note de version disponible pour cette version.',
  'update.modal.readyProgress': 'Mise à jour prête. 100% terminé.',
  'update.modal.downloadingProgress': 'Téléchargement de la mise à jour...',
  'update.modal.readyToInstall': 'Prêt à installer',
  'update.modal.installHintAuto':
    "Si vous fermez l'application maintenant, l'installation démarrera automatiquement.",
  'update.modal.installHintManual':
    "L'installation à la fermeture a été désactivée. Utilisez « Installer plus tard » pour l'activer et fermer en toute sécurité.",
  'update.modal.downloadAction': 'Télécharger la mise à jour',
  'update.modal.downloadingAction': 'Téléchargement...',
  'update.modal.installAction': 'Installer maintenant',
  'update.modal.installLaterAction': 'Installer plus tard (à la fermeture)',
  'update.modal.laterAction': 'Plus tard',
  'dropzone.invalidImageAlert':
    'Veuillez envoyer un fichier image valide (PNG/JPG).',
  'dropzone.clickOrDrag': "Cliquez ou glissez l'image ici",
  'dropzone.supports': 'Formats pris en charge : PNG et JPG',
  'actionButtons.cleaning': 'Nettoyage...',
  'actionButtons.cleanImage': "Nettoyer l'image",
  'actionButtons.downloadResult': 'Télécharger le résultat',
  'aio.model.manage': 'Modèles',
  'aio.model.noneAvailable': 'Aucun modèle disponible',
  'aio.model.device': 'Appareil',
  'aio.model.languages': 'Langues',
  'aio.model.languages.multi': 'multi',
  'aio.model.noDescription': 'Aucune description.',
  'aio.model.localStatus': 'Statut local : {value}',
  'aio.stage.detectText': 'Détecter le texte',
  'aio.stage.recognizeText': 'Reconnaître le texte',
  'aio.stage.getTranslations': 'Obtenir les traductions',
  'aio.stage.segmentText': 'Segmenter le texte',
  'aio.stage.cleanImage': "Nettoyer l'image",
  'aio.stage.tabsBarAria': 'Configuration des étapes',
  'aio.render.title': 'Texte rendu',
  'aio.render.description.manual':
    'Double-cliquez sur une zone pour modifier en ligne. Le dock contextuel apparaît près de la sélection avec le texte rendu.',
  'aio.render.description.auto':
    'Le mode automatique applique le rendu par défaut aux régions traduites.',
  'aio.render.activePage':
    'Page active : {count} bloc(s). Sélectionné(s) : {selected}.',
  'aio.render.contextualDock.visible': 'visible à la sélection',
  'aio.render.contextualDock.doubleClick':
    'double-cliquez pour commencer à éditer et afficher le dock',
  'aio.render.contextualDock.select':
    'sélectionnez une zone pour utiliser le dock',
  'aio.render.contextualDock': 'Dock contextuel : {value}',
  'aio.render.shortcut':
    "Raccourci : utilisez Maj + Molette sur l'aperçu pour faire pivoter le texte de la zone sélectionnée.",
  'aio.render.inactiveStage':
    'Cette image est à une étape antérieure au rendu. Utilisez « Avancer » pour afficher/modifier le texte rendu.',
  'aio.render.fontCatalog': 'Catalogue de polices',
  'aio.render.refreshFonts': 'Actualiser les polices',
  'aio.render.refreshingFonts': 'Actualisation...',
  'aio.render.importFont': 'Importer une police',
  'aio.render.importingFont': 'Importation...',
  'aio.render.importFontTitleDesktop':
    "Importer une police personnalisée dans l'application de bureau",
  'aio.render.importFontTitleBrowser':
    "L'importation n'est disponible que dans l'application de bureau",
  'aio.render.desktopFontsHint':
    "Les polices Windows installées et les imports personnalisés sont disponibles dans l'application de bureau.",
  'aio.render.overlayControlsHint':
    "Les contrôles de police, taille, alignement et couleur sont désormais dans le dock contextuel de l'overlay.",
  'aio.render.applyStyleAll':
    'Appliquer le style actuel à toutes les sélections',
  'aio.render.applyStyleAllTitle':
    'Appliquer le style de la sélection actuelle à toutes les sélections de toutes les images',
  'aio.region.title': 'Régions détectées',
  'aio.region.description.manual':
    "Dessinez sur l'aperçu pour ajouter de nouvelles zones. Déplacez une zone en la faisant glisser et utilisez les coins pour la redimensionner.",
  'aio.region.description.auto':
    'Passez en mode Manuel pour ajuster les zones détectées.',
  'aio.region.activePage':
    'Page active : {count} région(s). Sélectionnée(s) : {selected}.',
  'aio.region.ocr': 'OCR de la région sélectionnée : {value}',
  'aio.region.translation': 'Traduction de la région sélectionnée : {value}',
  'aio.region.notes': 'Notes de la région sélectionnée : {value}',
  'aio.region.segmentation': 'Segmentation de la région sélectionnée : {value}',
  'aio.region.noSelection': 'aucune',
  'aio.region.noRecognizedText': 'aucun texte reconnu',
  'aio.region.ocrDisabled': 'Étape OCR désactivée',
  'aio.region.noTranslation': 'aucune traduction disponible',
  'aio.region.translationDisabled': 'étape de traduction désactivée',
  'aio.region.noNotes': 'aucune note disponible',
  'aio.region.notesDisabled': 'notes désactivées',
  'aio.region.noSelectedRegion': 'aucune région sélectionnée',
  'aio.region.segmentedBoxes': '{count} zone(s) segmentée(s)',
  'aio.region.removeSelected': 'Supprimer la sélection',
  'aio.region.duplicateSelected': 'Dupliquer la sélection',
  'aio.manual.toolsHintPrimary':
    'Utilisez le dock flottant sur le canevas pour Sélectionner une zone, Nettoyer la page, et modifier la segmentation/le mode manuel.',
  'aio.manual.toolsHintSecondary':
    "Les outils sont automatiquement activés en fonction de l'étape active de l'image.",
  'aio.run.manualNoActive':
    "Sélectionnez une image active pour exécuter l'étape manuelle.",
  'aio.run.manualCurrentOnly':
    "Exécuter uniquement l'étape en cours pour l'image sélectionnée.",
  'aio.run.processing': 'Exécution {percent}%',
  'aio.run.rerunCurrent': "Relancer l'étape en cours (image active)",
  'aio.run.runCurrent': "Exécuter l'étape en cours (image active)",
  'aio.run.full':
    'Exécuter AIO (Détection + OCR + Traduction + Segmentation + Nettoyage + Rendu)',
  'aio.pipeline.textModeTitle': 'Mode texte',
  'aio.pipeline.textModeDescription':
    'Définissez comment la région sélectionnée doit être traitée lors du rendu. AUTO utilise la classification détectée.',
  'aio.pipeline.currentSelectionMode': 'Mode de la sélection actuelle',
  'aio.pipeline.currentSelectionModeAria':
    'Mode texte de la sélection actuelle',
  'aio.pipeline.autoResolved': 'AUTO résolu en {value}.',
  'aio.pipeline.currentMode': 'Mode actuel : {value}.',
  'aio.pipeline.selectPreviewBox':
    "Sélectionnez une zone dans l'aperçu pour changer le mode texte.",
  'aio.pipeline.title': 'Pipeline AIO',
  'aio.pipeline.description.auto':
    'Configurez le pipeline complet (détection, OCR, traduction, segmentation et nettoyage) avant de lancer le traitement par lot.',
  'aio.pipeline.description.manual':
    "Mode manuel : exécutez ou ignorez les étapes séquentiellement pour l'image sélectionnée.",
  'aio.pipeline.render': 'Rendu',
  'aio.pipeline.renderSubtitle': "Appliquer le texte traduit à l'image finale",
  'aio.pipeline.executeCurrentTitle':
    "Exécuter uniquement l'étape en cours pour l'image sélectionnée",
  'aio.pipeline.executingStage': "Exécution de l'étape...",
  'aio.pipeline.rerunStage': "Relancer l'étape",
  'aio.pipeline.runStage': "Exécuter l'étape",
  'aio.pipeline.skipStage': "Ignorer l'étape",
  'aio.pipeline.skipStageTitle':
    "Ignorer l'étape actuelle et débloquer la suivante",
  'aio.pipeline.rewind': 'Reculer',
  'aio.pipeline.rewindTitle': "Revenir à l'étape précédente du pipeline AIO",
  'aio.pipeline.forward': 'Avancer',
  'aio.pipeline.forwardTitle': "Passer à l'étape suivante du pipeline AIO",
  'aio.pipeline.manualImageStatus':
    "Manuel par image : « {image} » à l'étape {stage}.",
  'aio.pipeline.selectImageManual':
    'Sélectionnez une image pour démarrer le flux manuel étape par étape.',
  'aio.pipeline.currentStage': 'Étape actuelle : {label} ({current}/{total}).',
  'aio.pipeline.runToEnable':
    'Exécutez AIO pour activer le retour/avance étape par étape.',
  'aio.pipeline.manualHint':
    "Rendez le processus beaucoup plus fiable : en mode manuel, chaque étape que vous ajustez réellement est exécutée avec plus de contrôle, de révision et de précision. Seule l'image sélectionnée est traitée, et le quota n'est consommé qu'à la première exécution manuelle de chaque image (ou zéro si elle est déjà passée par l'AIO automatique).",
  'dashboard.enhance.profile.mangaScan': 'Scan Manga',
  'dashboard.enhance.profile.animeArt': 'Art Anime',
  'dashboard.enhance.profile.general': 'Général',
  'dashboard.enhance.profile.highQuality4x': 'Haute qualité 4x',
  'dashboard.emptyTip.1':
    'Si une image est trop grande et que vous obtenez des erreurs lors du nettoyage, de la traduction ou du redessin, essayez de la diviser en parties plus petites. Cela stabilise généralement le traitement.',
  'dashboard.emptyTip.2':
    'Le mode automatique accélère le flux de travail, mais pour un résultat 100% soigné, il vaut la peine de réviser en mode manuel et de corriger les derniers détails.',
  'dashboard.emptyTip.3':
    "Utilisez l'outil d'affinage pour rendre le texte plus propre, plus équilibré et conforme aux standards de la scanlation.",
  'dashboard.emptyTip.4':
    'Vous pouvez alterner les formes de bulles entre rectangulaire et elliptique pour mieux adapter le texte sur chaque page.',
  'dashboard.emptyTip.5':
    'Configurez des préréglages dans la page des paramètres pour accélérer les tâches répétitives et maintenir la cohérence entre les chapitres.',
  'dashboard.emptyTip.6':
    "Essayez différents modèles par langue. Le meilleur OCR ou traducteur pour le japonais n'est pas forcément idéal pour le coréen, le chinois ou l'anglais.",
  'dashboard.emptyTip.7':
    'Votez pour les modèles qui aident le plus votre flux de travail. Cela améliore le classement et guide les autres utilisateurs dans leurs choix.',
  'dashboard.emptyTip.8': 'Si la traduction dans le cloud est coûteuse ou instable, ajustez vos préréglages et gardez un modèle local de secours pour ne pas bloquer la production.',
  'dashboard.emptyTip.9':
    'Utilisez le Traducteur Visuel pour réviser des régions spécifiques sans avoir à relancer tout le chapitre.',
  'dashboard.emptyTip.10':
    "Dans le Typesetter, de petits ajustements manuels d'alignement, de police et d'espacement font une grande différence sur le résultat final.",
  'dashboard.emptyTip.11':
    'Quand le texte est trop serré, réduisez la quantité de texte dans la zone, affinez la traduction ou ajustez la bulle avant de trop réduire la taille de la police.',
  'dashboard.emptyTip.12':
    'Si la sortie OCR est mauvaise, essayez un autre modèle avant de tout corriger à la main. Changer de modèle résout souvent la plupart des erreurs.',
  'dashboard.emptyTip.13':
    "N'utilisez les notes de traduction que lorsqu'elles apportent vraiment de la valeur au lecteur. Moins de bruit offre une expérience de lecture plus fluide.",
  'dashboard.emptyTip.14':
    'Enregistrez des profils LLM et OCR personnalisés pour comparer rapidement les configurations sans tout reconfigurer à chaque test.',
  'dashboard.emptyTip.15':
    'Si une page échoue dans le flux AIO, exécutez les étapes séparément en Production pour trouver précisément où se situe le blocage.',
  'dashboard.aio.progress.detectText': 'détection du texte',
  'dashboard.aio.progress.recognizeText': 'reconnaissance du texte',
  'dashboard.aio.progress.getTranslations': 'traduction du texte',
  'dashboard.aio.progress.segmentText': 'segmentation du texte',
  'dashboard.aio.progress.cleanImage': "nettoyage de l'image",
  'dashboard.aio.progress.render': 'préparation du rendu',
  'dashboard.aio.subtitle.detectText':
    "Localiser les zones de texte dans l'image",
  'dashboard.aio.subtitle.recognizeText':
    'OCR pour extraire le contenu textuel',
  'dashboard.aio.subtitle.getTranslations':
    'Traduction automatique via le service/modèle sélectionné',
  'dashboard.aio.subtitle.segmentText':
    'Affiner les régions avec la segmentation (style Baka)',
  'dashboard.aio.subtitle.cleanImage':
    'Inpainting avec AOT/LaMa + masque style Baka',
  'dashboard.aio.manualStatus.locked': 'Verrouillé',
  'dashboard.aio.manualStatus.pending': 'En attente',
  'dashboard.aio.manualStatus.done': 'Terminé',
  'dashboard.aio.manualStatus.skipped': 'Ignoré',
  'dashboard.mode.underDevelopment': 'Encore en cours de développement.',
  'dashboard.nav.group.main': 'Principal',
  'dashboard.nav.group.production': 'Production',
  'dashboard.nav.group.utils': 'Utilitaires',
  'dashboard.nav.group.info': 'Informations',
  'dashboard.nav.short.aio': 'AIO',
  'dashboard.nav.short.cleaner': 'Nettoyeur/RD',
  'dashboard.nav.short.enhance': 'Améliorer',
  'dashboard.nav.subtitle.organize': 'Gérer les fichiers',
  'dashboard.nav.subtitle.aio': 'Tout en un',
  'dashboard.nav.subtitle.cleaner': 'Nettoyeur et Redessineur',
  'dashboard.nav.subtitle.typesetter': 'Typesetter',
  'dashboard.nav.subtitle.translator': 'Traducteur',
  'dashboard.nav.subtitle.raw': 'Fournisseur Raw',
  'dashboard.nav.subtitle.proofreader': 'Relecteur et CQ',
  'dashboard.nav.subtitle.stitch': 'Assembleur',
  'dashboard.nav.subtitle.split': 'Découpeur',
  'dashboard.nav.subtitle.watermark': 'Filigrane',
  'dashboard.nav.subtitle.enhance': 'Améliorateur',
  'dashboard.nav.subtitle.optimizer': 'Optimiseur de chapitre',
  'dashboard.nav.subtitle.blogger': 'Publication et hébergement',
  'dashboard.nav.subtitle.imgur': 'Hébergement anonyme',
  'dashboard.nav.subtitle.guides': 'Tutoriels',
  'dashboard.nav.subtitle.resources': 'Ressources',
  'dashboard.nav.tooltip.organize':
    'Organiser et réordonner vos images avant le traitement',
  'dashboard.nav.tooltip.aio':
    'Pipeline complet : détecter, reconnaître, traduire, segmenter, nettoyer et rendre',
  'dashboard.nav.tooltip.cleaner':
    "Nettoyer les bulles et redessiner des zones de l'image",
  'dashboard.nav.tooltip.typesetter':
    'Appliquer la typographie et styliser le texte sur les pages',
  'dashboard.nav.tooltip.translator':
    "Traduire du texte libre ou réviser l'OCR/traduction par régions d'image",
  'dashboard.nav.tooltip.raw':
    'Gérer et fournir les images brutes pour le pipeline',
  'dashboard.nav.tooltip.proofreader':
    'Réviser les traductions et vérifier la qualité finale',
  'dashboard.nav.tooltip.stitch':
    'Assembler plusieurs images en une bande continue',
  'dashboard.nav.tooltip.split':
    'Découper les longues images en parties plus petites',
  'dashboard.nav.tooltip.watermark':
    'Ajouter des filigranes aux images par lot',
  'dashboard.nav.tooltip.enhance':
    "Améliorer la qualité et la résolution de l'image",
  'dashboard.nav.tooltip.optimizer':
    "Optimiser les fichiers finaux pour le web, la lecture ou l'archivage",
  'dashboard.nav.tooltip.blogger':
    "Publier des articles sur Blogger et générer des URL d'images hébergées",
  'dashboard.nav.tooltip.imgur':
    'Envoyer des images sur Imgur avec rotation de Client ID',
  'dashboard.nav.tooltip.guides':
    "Guides d'utilisation des outils et tutoriels",
  'dashboard.nav.tooltip.resources':
    'Ressources, liens et documents de référence',
  'dashboard.mode.organize': 'Organiser',
  'dashboard.mode.aio': 'AIO — Tout en un',
  'dashboard.mode.cleaner': 'Nettoyeur / Redessineur',
  'dashboard.mode.typesetter': 'Typesetter',
  'dashboard.mode.translator': 'Traducteur',
  'dashboard.mode.raw': 'Fournisseur Raw',
  'dashboard.mode.proofreader': 'Relecteur / CQ',
  'dashboard.mode.stitch': 'Assemblage (Webtoon)',
  'dashboard.mode.split': 'Découpage intelligent',
  'dashboard.mode.watermark': 'Filigrane',
  'dashboard.mode.enhance': "Amélioration d'image",
  'dashboard.mode.optimizer': 'Optimiseur de chapitre',
  'dashboard.mode.blogger': 'CDN Blogger',
  'dashboard.mode.imgur': 'Envoi Imgur',
  'dashboard.mode.guides': 'Guides et tutoriels',
  'dashboard.mode.resources': 'Ressources et matériaux',
  'dashboard.status.modelSelected': 'Modèle sélectionné pour {stage} : {model}',
  'dashboard.status.verifyEmailRequired':
    'Confirmez votre e-mail pour effectuer cette action.',
  'dashboard.status.imagesCount': '{count} images',
  'dashboard.status.noImage': 'Aucune image',
  'dashboard.status.freeText': 'texte libre',
  'dashboard.user.defaultName': 'Utilisateur',
  'dashboard.topbar.thisTab': 'Cet onglet',
  'dashboard.aio.config.title': 'Configuration des étapes',
  'dashboard.footer.hardware.nvidia':
    'Accélération NVIDIA à performance maximale.',
  'dashboard.footer.hardware.intel':
    "Accélération Intel dédiée en cours d'utilisation.",
  'dashboard.footer.hardware.cpu': 'Exécution locale sans accélération dédiée.',
  'dashboard.footer.quickLinks': 'Liens rapides',
  'dashboard.footer.lastSave.never': 'Pas encore enregistré cette session',
  'dashboard.footer.lastSave.label': 'Dernière sauvegarde : {time}',
  'dashboard.cleaner.flow.local.title':
    'Flux structuré avec OCR, segmentation et inpainting local',
  'dashboard.cleaner.flow.ai.title':
    'Nettoyage automatique avec IA multimodale et reconstruction guidée',
  'dashboard.cleaner.flow.local.desc':
    'Utilise le détecteur local pour proposer des candidats, classe quels régions sont de véritables SFX, et ne nettoie que celles approuvées.',
  'dashboard.cleaner.flow.ai.desc':
    "Utilise la détection structurelle du projet pour guider l'IA, renforce la préservation des bulles/du dessin, et recompose les grandes images avec des jointures plus lisses.",
  'dashboard.cleaner.instructions.placeholder':
    'Ex. : mieux préserver les dégradés rouges, être plus conservateur sur les petits SFX, éviter de toucher les encadrés narratifs.',
  'dashboard.cleaner.instructions.hint.local':
    'Ces instructions sont injectées comme contexte supplémentaire après les règles de base de classification et de nettoyage des SFX.',
  'dashboard.cleaner.instructions.hint.ai':
    'Ces instructions sont injectées comme contexte supplémentaire. Les règles de base du nettoyeur IA prévalent sur toute instruction utilisateur pour préserver la logique de nettoyage.',
  'dashboard.cleaner.inspection.title': 'Inspection',
  'dashboard.cleaner.segmentation.manage': 'Gérer les modèles de segmentation',
  'dashboard.cleaner.segmentation.model': 'Modèle de segmentation',
  'dashboard.aio.gpuStages.title': 'Utilisation GPU par étape',
  'dashboard.aio.gpuStages.hint':
    "Sélectionnez quelles étapes doivent utiliser l'accélération GPU. Décochez pour forcer l'exécution CPU (utile si le GPU n'a pas assez de VRAM pour toutes les étapes).",
  'dashboard.aio.gpuStages.detect': 'Détection de texte (GPU)',
  'dashboard.aio.gpuStages.ocr': 'OCR / Reconnaissance (GPU)',
  'dashboard.aio.gpuStages.segment': 'Segmentation (GPU)',
  'dashboard.aio.gpuStages.clean': 'Nettoyage / Inpainting (GPU)',
  'dashboard.aio.gpuStages.noActiveProfile':
    'Aucun profil GPU actif n\'est actuellement confirmé. Cette section reste visible pour éviter les disparitions intermittentes ; les bascules reprennent effet dès qu\'un profil GPU devient disponible.',
  'dashboard.aio.config.loadingCatalogs': 'Chargement des catalogues locaux et cloud...',
  'dashboard.aio.preparingManual': "Préparation de l'étape manuelle AIO...",
  'dashboard.aio.preparingAuto':
    "Préparation de l'exécution automatique AIO...",
  'dashboard.aio.stopping': "Arrêt de l'exécution AIO...",
  'dashboard.aio.abortedByUser': "Exécution AIO interrompue par l'utilisateur.",
  'dashboard.aio.abortedMiniBackendRestarted':
    'Exécution AIO interrompue. Le mini-backend a redémarré.',
  'dashboard.aio.abortedMiniBackendRestartFailed':
    'Exécution AIO interrompue. Impossible de redémarrer automatiquement le mini-backend.',
  'dashboard.llm.customProfilesLoadFailed':
    'Échec du chargement des profils LLM personnalisés.',
  'dashboard.status.ready': 'Prêt à traiter les images.',
  'dashboard.workspace.pendingChanges':
    "L'espace de travail a des modifications en attente.",
  'dashboard.status.restored': 'Espace de travail restauré.',
  'dashboard.status.historyRestored':
    "Modification restaurée depuis l'historique.",
  'dashboard.status.undo': 'Espace de travail : annulation effectuée.',
  'dashboard.status.redo': 'Espace de travail : rétablissement effectué.',
  'dashboard.status.saved': 'Espace de travail enregistré localement.',
  'dashboard.status.exportCancelled':
    "Exportation de l'espace de travail annulée.",
  'dashboard.status.exportSuccess': 'Espace de travail exporté avec succès.',
  'dashboard.status.importCancelled':
    "Importation de l'espace de travail annulée.",
  'dashboard.status.importSuccess': 'Espace de travail importé avec succès.',
  'dashboard.status.importSaved':
    'Espace de travail importé et enregistré localement.',
  'dashboard.status.importNoAutosave':
    'Espace de travail importé. Sauvegarde automatique désactivée.',
  'dashboard.status.autosaveRemoved':
    'Sauvegarde automatique locale supprimée.',
  'dashboard.status.nothingToUndo': "Rien à annuler dans l'espace de travail.",
  'dashboard.status.nothingToRedo': "Rien à rétablir dans l'espace de travail.",
  'dashboard.sections.pipeline': 'Pipeline',
  'dashboard.sections.languages': 'Langues',
  'dashboard.sections.modelsConfig': 'Modèles et config.',
  'dashboard.sections.presets': 'Préréglages',
  'dashboard.sections.region': 'Région',
  'dashboard.aio.rewind': 'AIO retour : étape « {label} » ({current}/{total}).',
  'dashboard.aio.forward':
    'AIO avance : étape « {label} » ({current}/{total}).',
  'dashboard.aio.rewindImage':
    'AIO retour ({imageName}) : étape « {label} » ({current}/{total}).',
  'dashboard.aio.forwardImage':
    'AIO avance ({imageName}) : étape « {label} » ({current}/{total}).',
  'dashboard.llm.translation': 'Traduction',
  'dashboard.llm.ocr': 'OCR',
  'dashboard.aio.manualScope': 'AIO manuel',
  'dashboard.aio.autoScope': 'AIO automatique',
  'dashboard.aio.executing': 'Exécution',
  'dashboard.cleaner.selectProfile':
    'Sélectionnez un profil visuel enregistré à utiliser avec le Nettoyage IA Automatique.',
  'dashboard.cleaner.profileNotFound':
    'Profil visuel introuvable. Rechargez et réessayez.',
  'dashboard.cleaner.profileInUse':
    'Profil visuel utilisé pour le Nettoyage IA Automatique : {label}.',
  'dashboard.cleaner.invalidModel':
    'Sélectionnez un modèle valide pour le Nettoyage IA Automatique.',
  'dashboard.cleaner.profileSaved':
    'Profil visuel enregistré et sélectionné pour le Nettoyage IA Automatique : {label}.',
  'dashboard.cleaner.removeProfileSelect':
    'Sélectionnez un profil visuel enregistré à supprimer.',
  'dashboard.cleaner.customTitle':
    'IA personnalisée (Nettoyage IA Automatique)',
  'dashboard.cleaner.emptyLabel': 'Nouveau profil visuel',
  'dashboard.cleaner.namePlaceholder': 'Ex. : Gemini Image Clean',
  'dashboard.cleaner.modelPlaceholder': 'gemini-2.5-flash-image',
  'dashboard.cleaner.useLabel': 'Utiliser dans le Nettoyeur',
  'dashboard.cleaner.providerInUse':
    'Fournisseur {name} utilisé pour le Nettoyage IA Automatique.',
  'dashboard.stage.detectText.label': 'Détecter le texte',
  'dashboard.stage.detectText.short': 'Détecter',
  'dashboard.stage.recognizeText.label': 'Reconnaître le texte',
  'dashboard.stage.recognizeText.short': 'OCR',
  'dashboard.stage.getTranslations.label': 'Obtenir les traductions',
  'dashboard.stage.getTranslations.short': 'Traduire',
  'dashboard.stage.segmentText.label': 'Segmenter le texte',
  'dashboard.stage.segmentText.short': 'Segmenter',
  'dashboard.stage.cleanImage.label': "Nettoyer l'image",
  'dashboard.stage.cleanImage.short': 'Nettoyer',
  'dashboard.stage.render.label': 'Rendu',
  'dashboard.stage.render.short': 'Rendu',
  'dashboard.aio.pipeline.detect.subtitle':
    "Localiser les zones de texte dans l'image",
  'dashboard.aio.pipeline.ocr.subtitle': 'OCR pour extraire le contenu textuel',
  'dashboard.aio.pipeline.translate.subtitle':
    'Traduction automatique via le service/modèle',
  'dashboard.aio.pipeline.segment.subtitle':
    'Affiner les régions avec la segmentation',
  'dashboard.aio.pipeline.clean.subtitle': 'Inpainting avec AOT/LaMa + masque',
  'dashboard.aio.pipeline.render.subtitle':
    "Appliquer le texte traduit à l'image finale",
  'dashboard.aio.config.langHint':
    'Source → Détection/OCR/Traduction. Traduction → traduction uniquement.',
  'dashboard.aio.translation.localModelInfo':
    "Les modèles locaux sont téléchargés à la demande ; les modèles cloud/API continuent d'utiliser une clé.",
  'dashboard.translator.sameModelHint':
    "Le Traducteur utilise la même sélection de modèle que l'AIO ; relancez après avoir changé de modèle.",
  'dashboard.translator.incompatibleLocalModel':
    'Le modèle local actuel ne prend pas en charge la paire de langues du Traducteur. Choisissez un autre modèle ou utilisez le cloud.',
  'dashboard.status.modeChanged': 'Mode : {mode}',
  'dashboard.status.underDevelopment': '{mode} : {tooltip}',
  'dashboard.aio.render.hintRot': 'Raccourci : ',
  'dashboard.aio.render.hintRotSuffix': ' pour pivoter.',
  'settings.typographerLibrary.noFolder': 'Aucun dossier',
  'settings.profile.defaultUser': 'Utilisateur KŌMA',
  'register.email': 'E-mail',
  'register.emailPlaceholder': 'vous@email.com',
  'feed.sidebar.webhookPlaceholder': 'https://discord.com/api/webhooks/...',
  'feed.sidebar.webhookLabelShort': 'Webhook : ',
  'feed.moderation.scope.accountHwid': 'Compte + HWID',
  'feed.moderation.scope.full': 'Complet',
  'feed.composer.label.scanlation': 'Scanlation',
  'feed.composer.availability.hoursPlaceholder': '10',
  'feed.composer.roles.valuePlaceholder': '50.00',
  'feed.apply.contactPlaceholder': 'Discord @pseudo',
  'ranking.error.loadFailed': 'Échec du chargement des classements.',
  'ranking.error.loadDetailFailed': 'Échec du chargement des détails.',
  'ranking.error.saveReviewFailed': "Échec de l'enregistrement de l'avis.",
  'ranking.error.deleteReviewFailed': "Échec de la suppression de l'avis.",
  'ranking.error.emailVerificationRequired':
    'Confirmez votre e-mail avant de publier ou modifier des avis.',
  'dashboard.aio.translation.temperature': 'Température',
  'dashboard.aio.translation.topP': 'Top P',
  'dashboard.aio.translation.maxTokens': 'Tokens max',
  'dashboard.aio.clean.hdStrategy': 'Stratégie HD',
  'dashboard.aio.clean.hdStrategy.resize': 'Redimensionner',
  'dashboard.aio.clean.hdStrategy.crop': 'Recadrer',
  'dashboard.aio.clean.hdStrategy.original': 'Original',
  'dashboard.aio.clean.hdStrategyHint':
    "Stratégie pour les grandes images avant l'inpainting.",
  'dashboard.aio.clean.resizeLimit': 'Limite de redimensionnement',
  'dashboard.aio.clean.cropMargin': 'Marge de recadrage',
  'dashboard.aio.clean.cropTriggerSize': 'Taille de déclenchement du recadrage',
  'dashboard.aio.clean.localHardware':
    'Matériel local : {name} ({provider}{vram})',
  'dashboard.sidebar.workspace': 'Espace de travail',
  'dashboard.sidebar.hide': 'Masquer la barre latérale',
  'dashboard.sidebar.remaining': 'Restant : {count}',
  'dashboard.sidebar.resizeAria': 'Redimensionner la barre latérale gauche',
  'dashboard.sidebar.resizeTitle':
    'Glissez pour redimensionner. Double-cliquez pour restaurer.',
  'dashboard.sidebar.files': 'Fichiers ({count})',
  'dashboard.sidebar.clearAll': 'Tout effacer',
  'dashboard.sidebar.cleared': 'Liste des images effacée.',
  'dashboard.sidebar.empty': 'Aucune image',
  'dashboard.sidebar.rewindImage': 'Reculer cette image uniquement',
  'dashboard.sidebar.forwardImage': 'Avancer cette image uniquement',
  'dashboard.sidebar.rotate90': 'Rotation de 90 degrés',
  'dashboard.sidebar.moveUp': 'Monter',
  'dashboard.sidebar.moveDown': 'Descendre',
  'dashboard.sidebar.remove': 'Supprimer',
  'dashboard.sidebar.extracting':
    'Extraction des images... veuillez patienter.',
  'dashboard.sidebar.dropHere': 'Déposez ici...',
  'dashboard.sidebar.clickOrDrag': 'Glissez ou cliquez',
  'dashboard.sidebar.processingArchive': 'Traitement de ZIP/PDF/CBZ/CB7/PSD...',
  'dashboard.sidebar.stats.title': 'Statistiques locales',
  'dashboard.sidebar.stats.badge': 'Actif',
  'dashboard.sidebar.stats.daily': "Aujourd'hui",
  'dashboard.sidebar.stats.weekly': 'Cette semaine',
  'dashboard.sidebar.stats.monthly': 'Ce mois-ci',
  'dashboard.sidebar.stats.foot':
    'Activité locale récente. Les compteurs se réinitialisent automatiquement selon la période.',
  'dashboard.sidebar.stats.resetNow': 'Réinitialisation immédiate',
  'dashboard.sidebar.stats.resetInHoursMinutes':
    'Réinitialisation dans {hours}h {minutes}m',
  'dashboard.sidebar.stats.resetInHours': 'Réinitialisation dans {hours}h',
  'dashboard.sidebar.stats.resetInMinutes': 'Réinitialisation dans {minutes}m',
  'dashboard.sidebar.right.hide': 'Masquer les outils',
  'dashboard.sidebar.right.close': 'Fermer le panneau',
  'dashboard.sidebar.right.resizeAria':
    'Redimensionner la barre latérale droite',
  'dashboard.sidebar.right.resizeTitle':
    'Glissez pour redimensionner. Double-cliquez pour restaurer.',
  'dashboard.footer.runtime.downloaded': 'Package téléchargé',
  'dashboard.footer.runtime.embedded': 'Noyau intégré',
  'dashboard.footer.runtime.fallback.title': 'Fallback actif',
  'dashboard.footer.runtime.fallback.detail':
    "{requested} demandé, {active} en cours d'utilisation.",
  'dashboard.footer.runtime.tensorrt.title': 'TensorRT actif',
  'dashboard.footer.runtime.tensorrt.detail':
    'Accélération NVIDIA à performance maximale.',
  'dashboard.footer.runtime.cuda.title': 'CUDA actif',
  'dashboard.footer.runtime.cuda.detail':
    "GPU NVIDIA moderne en cours d'utilisation.",
  'dashboard.footer.runtime.legacy.label': 'Legacy',
  'dashboard.footer.runtime.legacy.title': 'CUDA Legacy actif',
  'dashboard.footer.runtime.legacy.detail':
    'Profil legacy pour les anciens GPU NVIDIA.',
  'dashboard.footer.runtime.openvino.title': 'OpenVINO actif',
  'dashboard.footer.runtime.openvino.detail':
    "Accélération Intel dédiée en cours d'utilisation.",
  'dashboard.footer.runtime.cpu.title': 'CPU actif',
  'dashboard.footer.runtime.cpu.detail':
    'Exécution locale sans accélération dédiée.',
  'dashboard.footer.workspace.saving': 'Enregistrement',
  'dashboard.footer.workspace.saved': 'Enregistré',
  'dashboard.footer.workspace.error': 'Erreur locale',
  'dashboard.footer.workspace.pending': 'En attente',
  'dashboard.footer.workspace.title': 'Espace de travail local',
  'dashboard.footer.runtime.source': 'Source : {value}',
  'dashboard.footer.runtime.remoteAvailable': 'Package distant disponible.',
  'dashboard.footer.runtime.errorReason': 'Raison : {value}',
  'dashboard.footer.bugReport.title': 'Signaler un bug',
  'dashboard.footer.bugReport.desc':
    "Signalez des bugs avec captures d'écran et journaux automatiques.",
  'dashboard.footer.discord.aria': 'Rejoindre Discord',
  'dashboard.footer.discord.title': 'Communauté Discord',
  'dashboard.footer.discord.desc':
    'Rejoignez la communauté, proposez des idées et partagez vos retours.',
  'dashboard.footer.website.aria': 'Ouvrir le site du projet',
  'dashboard.footer.website.title': 'Site du projet',
  'dashboard.footer.website.desc':
    'Accédez aux actualités, à la documentation et aux ressources du projet.',
  'bugReport.error.imgLoadFailed': "Échec du chargement de l'image.",
  'bugReport.error.canvasFailed': 'Échec du traitement du canvas.',
  'modelManager.modal.title': 'Bibliothèque de modèles',
  'modelManager.modal.aioFallback': 'AIO',
  'modelCard.recommended': 'REC',
  'modelCard.hardware.gpu': 'GPU',
  'modelCard.hardware.cpu': 'CPU',
  'modelCard.speed.ok': 'OK',
  'auth.toolkit.aiClean': 'Nettoyage IA',
  'freeProviderCard.setup': 'Configuration',
  'freeProviderCard.limits': 'Limites',
  'freeProviderCard.rateLimits': 'Limites de débit',
  'freeProviderCard.field.modelPlaceholder': 'ID du modèle (compatible OpenAI)',
  'customProvider.profileType': 'Profil IA personnalisé',
  'dashboard.cleaner.mode.assisted': 'Assisté',
  'dashboard.cleaner.mode.automaticAi': 'Nettoyage IA Automatique',
  'dashboard.cleaner.mode.aiSfx': 'IA SFX',
  'dashboard.cleaner.mode.assistedTitle':
    'Flux structuré avec OCR, segmentation et inpainting local',
  'dashboard.cleaner.mode.automaticAiTitle':
    'Nettoyage automatique avec IA multimodale et reconstruction guidée',
  'dashboard.cleaner.mode.aiSfxTitle':
    "Détecte et nettoie uniquement les SFX approuvés par l'IA",
  'dashboard.cleaner.mode.title': 'Mode',
  'dashboard.cleaner.mode.hint':
    'Le mode actuel a été conservé comme flux assisté. Le nouveau <strong>Nettoyage IA Automatique</strong> utilise une IA multimodale avec des règles strictes pour préserver le dessin, les contours et les bulles.',
  'dashboard.cleaner.pipeline.title': 'Pipeline',
  'dashboard.cleaner.pipeline.hint':
    'Flux assisté : OCR → Segmentation → Nettoyage local. Idéal pour ceux qui veulent de la prévisibilité et un ajustement fin ensuite.',
  'dashboard.cleaner.ocr.language': 'Langue (OCR)',
  'dashboard.cleaner.ocr.languageAria': "Langue source pour l'OCR",
  'dashboard.cleaner.models.button': 'Modèles',
  'dashboard.cleaner.models.none': 'Aucun modèle',
  'dashboard.cleaner.ocr.manageAria': 'Gérer les modèles OCR',
  'dashboard.cleaner.ocr.modelAria': 'Modèle OCR',
  'dashboard.cleaner.segment.title': 'Segmenter',
  'dashboard.cleaner.segment.manageAria': 'Gérer les modèles de segmentation',
  'dashboard.cleaner.segment.modelAria': 'Modèle de segmentation',
  'dashboard.cleaner.clean.title': 'Nettoyer',
  'dashboard.cleaner.clean.manageAria': 'Gérer les modèles de nettoyage',
  'dashboard.cleaner.clean.modelAria': 'Modèle de nettoyage',
  'dashboard.cleaner.settings.title': 'Nettoyage',
  'dashboard.cleaner.settings.maskDilation': 'Dilatation du masque',
  'dashboard.cleaner.settings.hdStrategy': 'Stratégie HD',
  'dashboard.cleaner.settings.resizeLimit': 'Limite de redimensionnement',
  'dashboard.cleaner.settings.cropMargin': 'Marge de recadrage',
  'dashboard.cleaner.settings.cropTrigger': 'Déclenchement du recadrage',
  'dashboard.cleaner.inspect.title': 'Inspection',
  'dashboard.cleaner.inspect.ocrBlocks': 'Blocs OCR',
  'dashboard.cleaner.inspect.segmented': 'Segmenté',
  'dashboard.cleaner.inspect.selection': 'Sélection',
  'dashboard.cleaner.inspect.none': 'aucune',
  'dashboard.cleaner.inspect.ocr': 'OCR',
  'dashboard.cleaner.inspect.segments': 'Segments',
  'dashboard.cleaner.inspect.boxesCount': '{count} zone(s)',
  'dashboard.cleaner.ai.sfxCleaner': 'Nettoyeur IA SFX',
  'dashboard.cleaner.ai.automaticClean': 'Nettoyage IA Automatique',
  'dashboard.cleaner.ai.sfxDesc':
    'Utilise le détecteur local pour proposer des candidats, classe quelles régions sont de véritables SFX, et ne nettoie que celles approuvées.',
  'dashboard.cleaner.ai.automaticDesc':
    "Utilise la détection structurelle du projet pour guider l'IA, renforce la préservation des bulles/du dessin, et recompose les grandes images avec des jointures plus lisses.",
  'dashboard.cleaner.ai.modelTitle': 'Modèle IA',
  'dashboard.cleaner.ai.manageAria': 'Gérer les modèles {value}',
  'dashboard.cleaner.ai.modelAria': 'Modèle {value}',
  'dashboard.cleaner.ai.noneAvailable': 'Aucun modèle IA disponible',
  'dashboard.cleaner.instructions.title': 'Instructions supplémentaires',
  'dashboard.cleaner.instructions.hintSfx':
    'Ces instructions sont injectées comme contexte supplémentaire après les règles de base de classification et de nettoyage des SFX.',
  'dashboard.cleaner.instructions.hintAi':
    'Ces instructions sont injectées comme contexte supplémentaire. Les règles de base du nettoyeur IA prévalent sur toute instruction utilisateur pour préserver la logique de nettoyage.',
  'dashboard.cleaner.stats.candidates': 'Candidats',
  'dashboard.cleaner.stats.sfxApproved': 'SFX appr.',
  'dashboard.cleaner.stats.redraw': 'Redessin',
  'dashboard.cleaner.action.processing': 'Traitement de {value} {percent}%',
  'dashboard.cleaner.action.runAiSfx': 'Lancer le Nettoyeur IA SFX',
  'dashboard.cleaner.action.runAutomatic': 'Lancer le Nettoyage IA Automatique',
  'dashboard.cleaner.action.runAssisted': 'Lancer le Nettoyeur Assisté',
  'dashboard.typography.circularText': 'Texte circulaire',
  'dashboard.typography.activate': 'Activer',
  'dashboard.typography.effect.aria': 'Effet de texte',
  'dashboard.typography.effect.title': 'Sélectionner un effet de texte',
  'dashboard.typography.effect.label': 'Effet',
  'dashboard.typography.effect.none': 'Aucun effet',
  'dashboard.typography.effect.panelTitle': 'Effet de texte',
  'dashboard.typography.effect.panelHint':
    'Préréglages natifs pour dialogue, impact et traînée.',
  'dashboard.typography.effect.searchPlaceholder': 'Rechercher des effets...',
  'dashboard.typography.effect.intensity': 'Intensité',
  'dashboard.typography.effect.noResults': 'Aucun effet trouvé.',
  'dashboard.aio.customAi.titleTranslation':
    'Profils IA personnalisés (Traduction)',
  'dashboard.aio.customAi.titleOcr': 'Profils IA personnalisés (OCR)',
  'dashboard.aio.customAi.newTranslation': 'Nouveau profil de traduction',
  'dashboard.aio.customAi.newOcr': 'Nouveau profil OCR',
  'dashboard.aio.customAi.placeholderTranslation':
    'Ex. : OpenRouter Manga FR-FR',
  'dashboard.aio.customAi.placeholderOcr': 'Ex. : Private Vision OCR',
  'dashboard.aio.customAi.modelPlaceholderTranslation': 'openai/gpt-4.1',
  'dashboard.aio.customAi.modelPlaceholderOcr': 'gpt-4.1-mini',
  'dashboard.aio.customAi.useTranslation': 'Utiliser pour la traduction',
  'dashboard.aio.customAi.useOcr': "Utiliser pour l'OCR",
  'dashboard.aio.customAi.loading': 'Chargement des profils personnalisés...',
  'dashboard.aio.customAi.savedProfile': 'Profil enregistré',
  'dashboard.aio.customAi.apiBase': 'Base API',
  'dashboard.aio.customAi.ollamaPreset': 'Préréglage Ollama local',
  'dashboard.aio.customAi.apiKey': 'Clé API (optionnelle)',
  'dashboard.aio.customAi.model': 'Modèle',
  'dashboard.aio.customAi.clear': 'Effacer',
  'dashboard.aio.customAi.remove': 'Supprimer',
  'dashboard.aio.customAi.save': 'Enregistrer',
  'dashboard.emptyStage.title': 'Sélectionnez ou chargez des images',
  'dashboard.emptyStage.desc':
    'Utilisez les outils de la barre supérieure pour traiter vos pages de manhwa.',
  'dashboard.emptyStage.tipTitle': 'Astuce utile',
  'dashboard.emptyStage.tipMeta': 'Change toutes les 15 secondes',
  'dashboard.enhance.title': "Amélioration d'image",
  'dashboard.enhance.localHint':
    'Modèles ONNX sur le mini-backend local. Installez-les avant le traitement.',
  'dashboard.enhance.desktopRequiredHint':
    "Nécessite l'application de bureau avec un mini-backend actif.",
  'dashboard.enhance.scale': 'Échelle',
  'dashboard.enhance.profile': 'Profil',
  'dashboard.enhance.model': 'Modèle',
  'dashboard.enhance.format': 'Format',
  'dashboard.enhance.status.title': 'Modèle',
  'dashboard.enhance.status.desktopRequired': 'Application de bureau requise',
  'dashboard.enhance.status.selectModel': 'Sélectionnez un modèle',
  'dashboard.enhance.status.ready': 'Prêt',
  'dashboard.enhance.status.notImported': 'Non importé',
  'dashboard.enhance.status.notInstalled': 'Non installé',
  'dashboard.enhance.importHint':
    'Import ONNX manuel. Convertissez les .pth avec sisr2onnx.',
  'dashboard.enhance.action.manage': 'Gérer',
  'dashboard.enhance.action.import': 'Importer',
  'dashboard.enhance.action.install': 'Installer',
  'dashboard.enhance.action.source': 'Source',
  'dashboard.enhance.selectAboveHint': 'Sélectionnez un modèle ci-dessus.',
  'dashboard.enhance.action.processing': 'Amélioration...',
  'dashboard.enhance.action.run': 'Améliorer les images',
  'dashboard.info.optimizer.desc1':
    'Optimisez le lot final avec des préréglages web, lecture ou archive en utilisant les résultats déjà générés dans le tableau de bord.',
  'dashboard.info.optimizer.desc2':
    "L'utilitaire affiche les gains par page et exporte en ZIP ou dossier local.",
  'dashboard.info.blogger.desc1':
    "Utilisez cet utilitaire pour publier sur Blogger et générer des URL d'images hébergées.",
  'dashboard.info.blogger.desc2':
    "Les identifiants et l'optimiseur sont dans Paramètres > Intégrations > CDN Blogger.",
  'dashboard.info.imgur.desc1':
    'Utilisez cet utilitaire pour des envois anonymes sur Imgur avec rotation aléatoire de Client ID.',
  'dashboard.info.imgur.desc2':
    'Les clés, le limiteur et le guide complet sont dans Paramètres > Intégrations > Envoi Imgur.',
  'dashboard.info.guides.desc1':
    'Sélectionnez un guide dans le panneau central pour lire les instructions détaillées.',
  'dashboard.info.guides.desc2':
    'Chaque guide contient des exemples pratiques et des astuces de productivité.',
  'dashboard.info.resources.desc1':
    'Explorez des ressources et matériaux utiles pour votre flux de travail de scanlation.',
  'dashboard.info.resources.desc2':
    'Polices, modèles, dictionnaires et plus encore.',
  'dashboard.render.noRecognizedText': 'Aucun texte reconnu',
  'dashboard.render.noTranslation': 'Aucune traduction disponible',
  'dashboard.render.noNotes': 'Aucune NT disponible',
  'dashboard.render.noteLabel': 'NT :',
  'dashboard.render.textLabel': 'Texte',
  'dashboard.render.aaLabel': 'AA',
  'dashboard.render.skewXLabel': 'Sx',
  'dashboard.render.skewYLabel': 'Sy',
  'renderPreview.context.title': 'Actions de la région',
  'renderPreview.context.copyRecognized': 'Copier le texte reconnu',
  'renderPreview.context.copyTranslated': 'Copier la traduction',
  'renderPreview.context.editRendered': 'Modifier le rendu',
  'renderPreview.context.editRenderedHint': 'Modifier le texte rendu',
  'renderPreview.context.manualModeHint': 'Mode manuel requis',
  'renderPreview.shape': 'Forme',
  'renderPreview.rectangular': 'Rectangulaire',
  'renderPreview.elliptic': 'Elliptique',
  'renderPreview.convertRectangular': 'Convertir en forme rectangulaire',
  'renderPreview.convertElliptic': 'Convertir en forme elliptique',
  'renderPreview.manualModeRequired': 'Mode manuel requis',
  'renderPreview.applyTypographyPreset':
    'Appliquer le préréglage typographique',
  'renderPreview.preset': 'Préréglage',
  'renderPreview.typographyPresets': 'Préréglages typographiques',
  'renderPreview.applyPreset': 'Appliquer le préréglage',
  'renderPreview.removeRegion': 'Supprimer la sélection',
  'renderPreview.textFont': 'Police du texte',
  'renderPreview.selectionShape': 'Forme de la sélection',
  'renderPreview.fontSize': 'Taille de police',
  'renderPreview.decreaseFont': 'Réduire la police',
  'renderPreview.increaseFont': 'Agrandir la police',
  'renderPreview.alignment': 'Alignement',
  'renderPreview.alignLeft': 'Aligner à gauche',
  'renderPreview.alignCenter': 'Centrer',
  'renderPreview.alignRight': 'Aligner à droite',
  'renderPreview.typographyStyle': 'Style typographique',
  'renderPreview.bold': 'Gras',
  'renderPreview.italic': 'Italique',
  'renderPreview.underline': 'Souligné',
  'renderPreview.uppercase': 'Majuscules',
  'renderPreview.textOrientation': 'Orientation du texte',
  'renderPreview.horizontal': 'Horizontal',
  'renderPreview.vertical': 'Vertical',
  'renderPreview.circular': 'Circulaire',
  'renderPreview.rotation': 'Rotation',
  'renderPreview.rotateMinus5': 'Rotation -5°',
  'renderPreview.rotatePlus5': 'Rotation +5°',
  'renderPreview.skewX': 'Inclinaison X',
  'renderPreview.skewXMinus2': 'Inclinaison X -2°',
  'renderPreview.skewXPlus2': 'Inclinaison X +2°',
  'renderPreview.skewY': 'Inclinaison Y',
  'renderPreview.skewYMinus2': 'Inclinaison Y -2°',
  'renderPreview.skewYPlus2': 'Inclinaison Y +2°',
  'renderPreview.adjustments': 'Ajustements',
  'renderPreview.refine': 'Affiner',
  'renderPreview.autoFontSize': 'Taille de police auto',
  'renderPreview.autoFit': 'Ajustement auto',
  'renderPreview.fixed': 'Fixe',
  'renderPreview.hyphenation': 'Césure',
  'renderPreview.enabled': 'Activé',
  'renderPreview.disabled': 'Désactivé',
  'renderPreview.maxSize': 'Taille max',
  'renderPreview.minSize': 'Taille min',
  'renderPreview.lineSpacing': 'Interligne',
  'renderPreview.opacity': 'Opacité',
  'renderPreview.fill': 'Remplissage',
  'renderPreview.outline': 'Contour',
  'renderPreview.shadow': 'Ombre',
  'renderPreview.shadowLayers': "Couches d'ombre",
  'renderPreview.addLayer': 'Ajouter une couche',
  'renderPreview.layerN': 'Couche {count}',
  'renderPreview.removeLayerN': 'Supprimer la couche {count}',
  'renderPreview.shadowLayerN': "Couche d'ombre {count}",
  'renderPreview.blur': 'Flou',
  'renderPreview.offsetX': 'Décalage X',
  'renderPreview.offsetY': 'Décalage Y',
  'renderPreview.radius': 'Rayon',
  'renderPreview.startAngle': 'Angle de départ',
  'renderPreview.spacing': 'Espacement',
  'renderPreview.shadowLayersCount': '{count} couche(s)',
  'renderPreview.shadowBlurSummary': 'flou {value}',
  'renderPreview.history.none': 'Aucun historique AIO pour cette image',
  'renderPreview.box.clickToEdit': 'double-cliquez pour éditer',
  'renderPreview.box.renderNotApplied': 'rendu non appliqué à cette étape',
  'renderPreview.editor.placeholder': 'Saisissez le texte final...',
  'renderPreview.editor.aria': 'Modifier le texte rendu',
  'splitter.strategy.smart': 'Auto intelligent',
  'splitter.strategy.smartHint': 'Espaces + heuristiques.',
  'splitter.strategy.advancedDesktop': 'Semi bureau',
  'splitter.strategy.advancedDesktopHint': 'Analyse locale avancée.',
  'splitter.strategy.manual': 'Manuel',
  'splitter.strategy.manualHint': 'Ajustements manuels uniquement.',
  'splitter.strategy.fixedHeight': 'Hauteur fixe',
  'splitter.strategy.fixedHeightHint': 'Segmentation par hauteur.',
  'splitter.strategy.count': 'N parties',
  'splitter.strategy.countHint': 'Division égale.',
  'dashboard.aio.autoScopeTitle': 'Traitement automatique sans intervention',
  'dashboard.aio.manualScopeTitle': 'Contrôle manuel de chaque étape',
  'detectionPreview.recognized': 'Reconnu :',
  'detectionPreview.translated': 'Traduit :',
  'detectionPreview.note': 'NT :',
  'detectionPreview.manual': 'Manuel',
  'detectionPreview.removeSelection': 'Supprimer la sélection',
  'detectionPreview.actions': 'Actions de la région',
  'detectionPreview.text': 'Texte',
  'detectionPreview.copyRecognized': 'Copier le texte reconnu',
  'detectionPreview.editRecognized': 'Modifier le texte reconnu',
  'detectionPreview.manualModeOnly': 'Disponible uniquement en mode manuel',
  'detectionPreview.copyTranslated': 'Copier la traduction',
  'detectionPreview.editTranslated': 'Modifier la traduction',
  'detectionPreview.removeRegion': 'Supprimer la région',
  'detectionPreview.editRecognizedTitle': 'Modifier le texte reconnu',
  'detectionPreview.editTranslatedTitle': 'Modifier le texte traduit',
  'detectionPreview.placeholderRecognized': 'Saisissez le texte reconnu...',
  'detectionPreview.placeholderTranslated': 'Saisissez la traduction...',
  'detectionPreview.rewind': 'Reculer cette image',
  'detectionPreview.forward': 'Avancer cette image',
  'detectionPreview.noHistory': 'Aucun historique AIO pour cette image',
  'dashboard.translator.workspace.aria': 'Mode traducteur',
  'dashboard.translator.workspace.textTitle': 'Traduire du texte libre',
  'dashboard.translator.workspace.text': 'Texte',
  'dashboard.translator.workspace.visualTitle':
    'Détecter et traduire dans les images',
  'dashboard.translator.workspace.visual': 'Visuel',
  'watermark.header.eyebrow': 'Utilitaire éditorial',
  'watermark.header.title': 'Filigrane',
  'watermark.header.badge': 'Lot',
  'watermark.panel.presets': 'Préréglages',
  'watermark.presets.builtin': 'Intégrés',
  'watermark.presets.user': 'Enregistrés',
  'watermark.action.save': 'Enregistrer',
  'watermark.action.duplicate': 'Dupliquer',
  'watermark.panel.text': 'Texte',
  'watermark.text.enable': 'Activer le texte',
  'watermark.text.content': 'Contenu',
  'watermark.text.font': 'Police',
  'watermark.text.size': 'Taille',
  'watermark.text.color': 'Couleur',
  'watermark.text.outline': 'Contour',
  'watermark.text.outlineColor': 'Couleur du contour',
  'watermark.text.opacity': 'Opacité',
  'watermark.panel.logo': 'Logo',
  'watermark.logo.enable': 'Activer',
  'watermark.logo.change': 'Changer',
  'watermark.logo.upload': 'Envoyer',
  'watermark.logo.remove': 'Supprimer',
  'watermark.logo.scale': 'Échelle %',
  'watermark.logo.opacity': 'Opacité',
  'watermark.logo.brightness': 'Luminosité',
  'watermark.logo.saturation': 'Saturation',
  'watermark.panel.distribution': 'Distribution',
  'watermark.distribution.position': 'Position',
  'watermark.distribution.rotation': 'Rotation',
  'watermark.distribution.blend': 'Fusion',
  'watermark.distribution.gapX': 'Écart X',
  'watermark.distribution.gapY': 'Écart Y',
  'watermark.distribution.padding': 'Marge intérieure',
  'watermark.distribution.baseName': 'Nom de base',
  'watermark.distribution.smartPlacement': 'Placement intelligent',
  'watermark.action.applying': 'Application...',
  'watermark.action.applyBatch': 'Appliquer au lot',
  'watermark.status.cancelRequested': 'Annulation demandée.',
  'watermark.action.cancel': 'Annuler',
  'watermark.panel.preview': 'Aperçu',
  'watermark.preview.compare': 'Comparer',
  'watermark.preview.mode': 'Aperçu',
  'watermark.preview.empty.title': 'Aucune image',
  'watermark.preview.empty.desc':
    'Importez des pages dans le panneau gauche du tableau de bord.',
  'watermark.preview.noLayer.title': 'Configurez une couche',
  'watermark.preview.noLayer.desc':
    "Activez le texte ou le logo dans la boîte à outils pour générer l'aperçu.",
  'watermark.preview.original': 'Original',
  'watermark.preview.watermark': 'Filigrane',
  'watermark.preview.compareAria': 'Comparaison avant/après',
  'watermark.preview.generating': 'Génération...',
  'watermark.panel.output': 'Sortie',
  'watermark.output.empty.title': 'Aucun résultat',
  'watermark.output.empty.desc':
    'Appliquez le lot pour générer les téléchargements.',
  'watermark.action.zip': 'ZIP',
  'watermark.action.folder': 'Dossier',
  'watermark.action.download': 'Télécharger',
  'imgur.hero.eyebrow': 'Envoi Imgur',
  'imgur.hero.title': 'Hébergement anonyme',
  'imgur.hero.desc':
    'Utilisez cet utilitaire pour des envois rapides sur Imgur avec rotation aléatoire de Client ID.',
  'imgur.status.remaining': 'Restant : {remaining}',
  'imgur.status.configure': 'Configurer',
  'imgur.alert.missingConfig': 'Configuration manquante',
  'imgur.alert.addActiveClient':
    'Ajoutez au moins un Client ID actif dans Paramètres > Intégrations.',
  'imgur.batch.title': 'Envoi par lot',
  'imgur.batch.limit': 'Limite de {limit} envois par heure (Utilisés : {used})',
  'imgur.dropzone.title': 'Déposez les images ici',
  'imgur.dropzone.desc': 'Glissez plusieurs fichiers JPG, PNG ou WEBP.',
  'imgur.toggle.imgOutput': 'Sortie en balise <img>',
  'imgur.toggle.imgOutputDesc':
    "Génère du code HTML prêt à l'emploi pour les blogs et forums.",
  'imgur.actions.select': 'Sélectionner',
  'imgur.actions.sending': 'Envoi...',
  'imgur.actions.send': 'Envoyer',
  'imgur.actions.copy': 'Copier les URL',
  'imgur.queue.title': "File d'envoi",
  'imgur.queue.items_one': '{count} élément',
  'imgur.queue.items_other': '{count} éléments',
  'imgur.queue.empty': 'La file est vide. Ajoutez des images ci-dessus.',
  'imgur.queue.altPlaceholder': 'Texte alternatif',
  'imgur.queue.urlLabel': 'URL',
  'imgur.queue.keyLabel': 'Clé',
  'imgur.queue.remove': 'Supprimer',
  'imgur.error.configLoad': 'Échec du chargement de la configuration Imgur.',
  'imgur.error.uploadFailed': "Échec de l'envoi de l'image.",
  'imgur.feedback.singleSuccess': 'Envoi effectué avec succès.',
  'imgur.feedback.multiSuccess': 'Envoi de {count} images terminé.',
  'ranking.metric.overall': 'Score global',
  'ranking.metric.quality': 'Qualité',
  'ranking.metric.speed': 'Vitesse',
  'ranking.metric.costBenefit': 'Rapport qualité-prix',
  'ranking.metric.easeOfUse': "Facilité d'utilisation",
  'ranking.trend.neutral': 'Neutre',
  'ranking.trend.points': 'pts',
  'ranking.table.title': 'Classement',
  'ranking.table.sortedBy': 'Trié par {metric} pondéré.',
  'ranking.table.modelsCount': '{count} modèles classés',
  'ranking.table.empty': 'Aucun modèle ne correspond aux filtres actuels.',
  'ranking.table.newLabel': 'Nouveau',
  'ranking.table.reviewsCount': '{count} avis',
  'ranking.table.reviewedByYou': 'Vous avez déjà donné votre avis',
  'ranking.table.viewDetails': 'Voir les détails',
  'ranking.filters.metricAria': 'Métrique de classement',
  'ranking.filters.searchPlaceholder': 'Rechercher un modèle...',
  'ranking.filters.searchAria': 'Rechercher un modèle',
  'ranking.filters.advancedAria': 'Afficher les filtres avancés',
  'ranking.filters.button': 'Filtres',
  'ranking.filters.stageLabel': 'Étape',
  'ranking.filters.sourceLabel': 'Source',
  'ranking.filters.languageLabel': 'Langue',
  'ranking.filters.minReviewsLabel': 'Avis min.',
  'ranking.filters.allStages': 'Toutes les étapes',
  'ranking.filters.allSources': 'Local + Cloud',
  'ranking.filters.onlyLocal': 'Local uniquement',
  'ranking.filters.onlyCloud': 'Cloud uniquement',
  'ranking.filters.allLanguages': 'Toutes les langues',
  'ranking.filters.reviews_one': '{count} avis',
  'ranking.filters.reviews_other': '{count} avis',
  'ranking.composer.usage.balanced': 'Équilibré',
  'ranking.composer.usage.qualityFirst': 'Qualité avant tout',
  'ranking.composer.usage.speedFirst': 'Vitesse avant tout',
  'ranking.composer.usage.lowVram': 'VRAM faible',
  'ranking.composer.usage.offlineLocal': 'Pipeline local',
  'ranking.composer.usage.cloudPipeline': 'Pipeline cloud',
  'ranking.composer.title.edit': "Modifier l'avis",
  'ranking.composer.title.new': 'Nouvel avis',
  'ranking.composer.action.close': 'Fermer',
  'ranking.composer.field.title': 'Titre',
  'ranking.composer.field.titlePlaceholder':
    'Ex. : Meilleur OCR local pour manga',
  'ranking.composer.field.context': 'Contexte',
  'ranking.composer.field.sourceLang': 'Langue source',
  'ranking.composer.field.sourceLangPlaceholder': 'ja, en, fr...',
  'ranking.composer.field.targetLang': 'Langue cible',
  'ranking.composer.field.targetLangPlaceholder': 'fr, en, pt-br...',
  'ranking.composer.field.device': 'Appareil',
  'ranking.composer.device.none': 'Non spécifié',
  'ranking.composer.field.comment': 'Commentaire',
  'ranking.composer.field.commentPlaceholder':
    "Décrivez la qualité générale, la stabilité, l'utilisation des ressources et les domaines où ce modèle apporte le plus de valeur.",
  'ranking.composer.action.reset': 'Réinitialiser',
  'ranking.composer.action.delete': 'Supprimer',
  'ranking.composer.action.save': 'Enregistrer',
  'ranking.composer.action.publish': 'Publier',
  'dashboard.specialMode.visualEmpty.title': 'Traducteur Visuel',
  'dashboard.specialMode.visualEmpty.description':
    "Importez des images pour commencer à traduire directement dans l'aperçu.",
  'dashboard.specialMode.visualEmpty.cta': 'Sélectionner des images',
  'dashboard.reviewRaw.raw.title': 'Revue des bruts',
  'dashboard.reviewRaw.raw.description':
    'Analysez la qualité des images originales et préparez le lot pour le pipeline.',
  'dashboard.reviewRaw.raw.note':
    "La validation des bruts aide l'IA à mieux comprendre le contexte visuel avant l'OCR.",
  'dashboard.reviewRaw.raw.statusReady':
    'Lot de {count} images prêt pour la validation.',
  'dashboard.reviewRaw.raw.validate': 'Valider les bruts',
  'dashboard.reviewRaw.qc.title': 'Contrôle qualité',
  'dashboard.reviewRaw.qc.descriptionAuto':
    "Le CQ automatique utilise des modèles légers pour détecter les erreurs d'édition courantes.",
  'dashboard.reviewRaw.qc.descriptionManual':
    'Le mode manuel permet une revue détaillée de chaque bulle et redessin.',
  'dashboard.reviewRaw.qc.note':
    "Activez les vérifications ci-dessous pour lancer l'analyse par lot.",
  'dashboard.reviewRaw.qc.automaticChecks': 'Vérifications automatiques',
  'dashboard.reviewRaw.qc.checks.untranslatedText': 'Texte non traduit',
  'dashboard.reviewRaw.qc.checks.emptyBubbles': 'Bulles vides',
  'dashboard.reviewRaw.qc.checks.visualArtifacts': 'Artefacts visuels',
  'dashboard.reviewRaw.qc.checks.textAlignment': 'Alignement du texte',
  'dashboard.reviewRaw.qc.checks.fontConsistency': 'Cohérence des polices',
  'dashboard.reviewRaw.qc.inProgress': 'Analyse CQ en cours...',
  'dashboard.reviewRaw.qc.run': 'Lancer le CQ',
  'common.cancel': 'Annuler',
  'common.save': 'Enregistrer',
  'common.name': 'Nom',
  'common.newName': 'Nouveau nom',
  'common.removed': 'Supprimé',
  'common.renamed': 'Renommé',
  'common.duplicated': 'Dupliqué',
  'common.saved': 'Enregistré',
  'common.failed': 'Échec',
  'common.cancelled': 'Annulé',
  'common.status': 'Statut',
  'common.configured': 'Configuré',
  'common.no': 'Non',
  'common.account': 'Compte',
  'common.format': 'Format',
  'common.exportedCount': 'Exporté : {count} éléments.',
  'modelManager.modal.verified': 'Vérifié le',
  'modelManager.modal.upToDate': 'À jour',
  'modelManager.modal.closeAria': 'Fermer la modale',
  'modelManager.modal.localModels': 'Catalogue local',
  'modelManager.modal.localDesc':
    "Installation à la demande avec vérification d'intégrité.",
  'modelManager.modal.noLocal': 'Aucun modèle local ne correspond aux filtres.',
  'modelManager.modal.cloudModels': 'Catalogue cloud',
  'modelManager.modal.cloudDesc':
    'Modèles API/Cloud. Nécessitent une connexion et vos propres clés.',
  'modelManager.modal.hideCustom': 'Masquer les personnalisés',
  'modelManager.modal.addCustom': 'Ajouter un personnalisé',
  'modelManager.modal.noCloud': 'Aucun modèle cloud ne correspond aux filtres.',
  'modelManager.modal.checking': 'Vérification...',
  'modelManager.modal.checkUpdates': 'Vérifier les mises à jour',
  'modelManager.modal.installAll': 'Installer les recommandés',
  'modelManager.modal.cancel': 'Annuler',
  'modelManager.modal.noEligible': 'Aucun modèle éligible trouvé.',
  'modelManager.modal.notEnoughSpace':
    'Espace insuffisant (nécessite {space}).',
  'resources.breadcrumb.home': 'Ressources',
  'resources.communities.title': 'Communautés et liens',
  'resources.back': 'Retour aux ressources',
  'resources.communities.desc':
    'Communautés de scanlation actives, serveurs Discord, forums et ressources pour échanger et apprendre.',
  'resources.platform.discord': 'Discord',
  'resources.platform.forum': 'Forum',
  'resources.platform.reddit': 'Reddit',
  'resources.platform.website': 'Site web',
  'resources.communities.members': '{count} membres',
  'resources.action.visit': 'Visiter',
  'resources.externalTools.title': 'Outils externes',
  'resources.externalTools.desc':
    'Logiciels et applications recommandés qui complètent KŌMA Studio dans votre flux de scanlation.',
  'resources.category.editing': 'Édition',
  'resources.category.ocr': 'OCR',
  'resources.category.translation': 'Traduction',
  'resources.category.fonts': 'Polices',
  'resources.category.hosting': 'Hébergement',
  'resources.category.utility': 'Utilitaire',
  'resources.action.open': 'Ouvrir',
  'resources.action.download': 'Télécharger',
  'resources.status.free': 'Gratuit',
  'resources.status.paid': 'Payant',
  'resources.fonts.title': 'Polices de composition',
  'resources.fonts.desc':
    'Collection de polices populaires pour la scanlation. Inclut des polices pour les dialogues, la narration, les emphases, les SFX et le texte CJK.',
  'resources.fonts.searchPlaceholder': 'Rechercher par nom, usage ou tag...',
  'resources.fonts.noResults': 'Aucune police trouvée pour « {search} »',
  'resources.license.free': 'Gratuit',
  'resources.license.openSource': 'Open Source',
  'resources.license.commercial': 'Commercial',
  'resources.license.mixed': 'Mixte',
  'resources.glossary.title': 'Glossaire de la scanlation',
  'resources.glossary.desc':
    'Termes techniques, jargon communautaire et vocabulaire essentiel pour la scanlation de manga, manhwa et manhua.',
  'resources.glossary.searchPlaceholder': 'Rechercher des termes...',
  'resources.glossary.noResults': 'Aucun terme trouvé pour « {search} »',
  'resources.glossary.related': 'Voir aussi :',
  'resources.category.general': 'Général',
  'resources.category.typesetting': 'Composition',
  'resources.category.cleaning': 'Nettoyage',
  'resources.category.technical': 'Technique',
  'resources.category.roles': 'Rôles',
  'resources.sfx.title': 'Bibliothèque SFX',
  'resources.sfx.desc':
    "Bibliothèque d'effets sonores japonais avec traductions, prononciation romaji et exemples d'utilisation dans les mangas.",
  'resources.sfx.searchPlaceholder':
    'Rechercher en japonais, romaji ou français...',
  'resources.sfx.noResults': 'Aucun SFX trouvé.',
  'resources.sfx.commonIn': 'Fréquent dans : {value}',
  'resources.category.impact': 'Impact',
  'resources.category.emotion': 'Émotion',
  'resources.category.ambient': 'Ambiance',
  'resources.category.action': 'Action',
  'resources.category.voice': 'Voix',
  'resources.category.misc': 'Divers',
  'resources.filters.all': 'Tout ({count})',
  'resources.page.tab.fonts': 'Polices',
  'resources.page.tab.sfx': 'Bibliothèque SFX',
  'resources.page.tab.glossary': 'Glossaire',
  'resources.page.tab.communities': 'Communautés',
  'resources.page.tab.tools': 'Outils',
  'resources.page.title.main': 'Centre de ',
  'resources.page.title.accent': 'ressources',
  'resources.page.subtitle':
    'Matériaux sélectionnés, communautés et outils pour votre flux de travail.',
  'resources.page.searchPlaceholder':
    'Rechercher dans toutes les catégories...',
  'resources.page.searchAria': 'Champ de recherche de ressources',
  'resources.page.clearSearch': 'Effacer la recherche',
  'resources.page.tabsAria': 'Catégories de ressources',
  'resources.category.fonts.label': 'Polices de composition',
  'resources.category.fonts.description':
    'Collection de polices populaires pour la scanlation de manga, manhwa et manhua.',
  'resources.category.sfx-library.label': 'Bibliothèque SFX',
  'resources.category.sfx-library.description':
    "Bibliothèque d'onomatopées japonaises avec traductions et exemples d'utilisation.",
  'resources.category.glossary.label': 'Glossaire de la scanlation',
  'resources.category.glossary.description':
    'Termes techniques et jargon communautaire du monde de la scanlation.',
  'resources.category.communities.label': 'Communautés',
  'resources.category.communities.description':
    'Serveurs Discord, subreddits et forums de scanlation.',
  'resources.category.tools-external.label': 'Outils externes',
  'resources.category.tools-external.description':
    'Logiciels complémentaires et outils en ligne utiles.',
  'resources.home.title': 'Centre de ressources',
  'resources.home.subtitle':
    'Matériaux sélectionnés, communautés et outils pour votre flux de travail.',
  'resources.home.itemCount': '{count} éléments',
  'dashboard.aio.result.regionsDetected': '{count} région(s) détectée(s)',
  'dashboard.aio.result.textsRecognized': '{count} texte(s) reconnu(s)',
  'dashboard.aio.result.translationsGenerated':
    '{count} traduction(s) générée(s)',
  'dashboard.aio.result.regionsSegmented': '{count} région(s) segmentée(s)',
  'dashboard.aio.result.imagesCleaned': '{count} image(s) nettoyée(s)',
  'dashboard.aio.result.blocksReady': '{count} bloc(s) prêt(s) pour le rendu',
  'dashboard.aio.result.finished': 'AIO terminé. {parts}.',
  'resources.glossary.category.general': 'Général',
  'resources.glossary.category.typesetting': 'Composition',
  'resources.glossary.category.cleaning': 'Nettoyage',
  'resources.glossary.category.translation': 'Traduction',
  'resources.glossary.category.technical': 'Technique',
  'resources.glossary.category.roles': 'Rôles',
  'resources.glossary.filterAll': 'Tout',
  'resources.glossary.results_one': 'terme trouvé',
  'resources.glossary.results_other': 'termes trouvés',
  'resources.glossary.context': 'Glossaire',
  'resources.glossary.alphaAria': 'Navigation alphabétique',
  'resources.glossary.alphaBtnAria': 'Aller à la lettre {letter}',
  'dashboard.aio.config.sourceLanguage':
    'Langue source (Détection/OCR/Traduction)',
  'dashboard.aio.config.targetLanguage': 'Langue de traduction',
  'dashboard.aio.pipeline.rewind': 'Reculer le pipeline',
  'dashboard.aio.pipeline.forward': 'Avancer le pipeline',
  'dashboard.aio.pipeline.snapshot': 'Instantané : ',
  'dashboard.aio.pipeline.image': 'Image : ',
  'dashboard.aio.pipeline.stage': 'Étape : ',
  'dashboard.aio.translation.noneSelected': 'Aucun modèle sélectionné.',
  'dashboard.aio.translation.selected': 'Sélectionné : ',
  'dashboard.aio.render.hint':
    "Les contrôles de police/couleur/alignement sont dans le dock contextuel de l'overlay. Raccourci : Maj + Molette pour pivoter.",
  'dashboard.aio.render.warning':
    "L'image est à une étape antérieure au rendu. Utilisez Avancer pour l'afficher.",
  'dashboard.aio.render.disabled':
    "Activez l'étape Rendu dans le pipeline pour configurer.",
  'dashboard.stitch.lastToNext': 'Dernière image envoyée au lot suivant.',
  'dashboard.stitch.firstFromNext':
    'Première image du lot suivant ajoutée au lot actuel.',
  'dashboard.stitch.resetPlanning':
    "Planification de l'assembleur recalculée automatiquement.",
  'dashboard.aio.customAi.syncing': 'IA personnalisée (synchronisation...)',
  'dashboard.aio.customOcr.syncing': 'OCR personnalisé (synchronisation...)',
  'dashboard.aio.customOcr.useCase':
    'Profil OCR personnalisé en attente de synchronisation locale.',
  'dashboard.aio.customAi.useCase':
    'Profil personnalisé en attente de synchronisation locale.',
  'dashboard.aio.config.languageHint':
    "La langue source est utilisée dans les étapes Détection, Reconnaissance et Traduction. La langue de traduction s'applique uniquement à la traduction.",
  'dashboard.aio.presets.title': 'Préréglages AIO par langue',
  'dashboard.aio.presets.currentLanguage': 'Langue actuelle :',
  'dashboard.aio.presets.noneActive': 'Aucun préréglage actif',
  'dashboard.aio.presets.activeSuffix': '(actif)',
  'dashboard.aio.presets.new': 'Nouveau',
  'dashboard.aio.presets.edit': 'Modifier',
  'dashboard.aio.presets.delete': 'Supprimer',
  'dashboard.aio.presets.saveCurrent': "Enregistrer l'actuel",
  'dashboard.aio.presets.openSettings':
    'Ouvrir les préréglages dans les paramètres',
  'dashboard.aio.presets.presetName': 'Nom du préréglage',
  'dashboard.aio.presets.namePlaceholder': 'Ex. : OCR JP rapide',
  'dashboard.aio.presets.description': 'Description',
  'dashboard.aio.presets.optional': 'Optionnel',
  'dashboard.aio.presets.setActiveFor': 'Définir comme préréglage actif pour',
  'dashboard.aio.presets.cancel': 'Annuler',
  'dashboard.aio.presets.update': 'Mettre à jour le préréglage',
  'dashboard.aio.presets.create': 'Créer le préréglage',
  'dashboard.aio.translation.selectedSummaryModel':
    'Sélectionné : {name}',
  'dashboard.aio.translation.selectedSummaryCustom':
    'Sélectionné : {name} (Personnalisé/Fournisseur GRATUIT)',
  'dashboard.aio.translation.selectedSummaryLegacy':
    'Sélectionné : {name} (Cloud/API/IA)',
  'dashboard.aio.translation.selectedSummaryEmpty':
    "Sélectionnez un modèle local ou cloud pour traduire dans l'AIO.",
  'dashboard.aio.translation.supportSummary':
    'Les modèles locaux sont téléchargés à la demande ; les modèles cloud/API restent disponibles via clé.',
  'dashboard.aio.translation.additionalContextPlaceholder': 'Contexte supplémentaire pour la traduction cloud...',
  'dashboard.aio.translation.notesToggle':
    'Générer et afficher les NT séparément de la traduction',
  'dashboard.aio.translation.neighborContextToggle':
    'Utiliser le contexte des images voisines dans le lot',
  'dashboard.aio.translation.multimodalToggle':
    "Envoyer l'image de la page comme contexte multimodal",
  'dashboard.aio.translation.activeConfigFor':
    'Configuration active pour : {value}.',
  'dashboard.aio.customAi.title': 'IA personnalisée',
  'dashboard.aio.customAi.loadingProfiles':
    'Chargement des profils personnalisés...',
  'dashboard.aio.customAi.savedTranslationProfile':
    'Profil de traduction enregistré',
  'dashboard.aio.customAi.newTranslationProfile':
    'Nouveau profil de traduction',
  'dashboard.aio.customAi.name': 'Nom',
  'dashboard.aio.customAi.translationNamePlaceholder':
    'Ex. : OpenRouter Manga FR-FR',
  'dashboard.aio.customAi.apiBasePlaceholder': 'https://api.example.com/v1',
  'dashboard.aio.customAi.useLocalOllama': 'Préréglage Ollama local',
  'dashboard.aio.customAi.apiKeyOptional': 'Clé API (optionnelle)',
  'dashboard.aio.customAi.apiKeyPlaceholder': 'sk-...',
  'dashboard.aio.customAi.translationModelPlaceholder': 'openai/gpt-4.1...',
  'dashboard.aio.customAi.resetTranslation': 'Effacer la traduction',
  'dashboard.aio.customAi.useSavedTranslation': 'Utiliser pour la traduction',
  'dashboard.aio.customAi.removeTranslation': 'Supprimer la traduction',
  'dashboard.aio.customAi.saveTranslation': 'Enregistrer la traduction',
  'dashboard.aio.customAi.savedOcrProfile': 'Profil OCR enregistré',
  'dashboard.aio.customAi.newOcrProfile': 'Nouveau profil OCR',
  'dashboard.aio.customAi.ocrNamePlaceholder': 'Ex. : Private Vision OCR',
  'dashboard.aio.customAi.ocrModelPlaceholder': 'gpt-4.1-mini...',
  'dashboard.aio.customAi.resetOcr': "Effacer l'OCR",
  'dashboard.aio.customAi.useSavedOcr': "Utiliser pour l'OCR",
  'dashboard.aio.customAi.removeOcr': "Supprimer l'OCR",
  'dashboard.aio.customAi.saveOcr': "Enregistrer l'OCR",
  'dashboard.aio.customAi.openAiCompatibleHint':
    'Utilisez une API compatible OpenAI.',
  'dashboard.aio.clean.maskDilation': 'Dilatation du masque',
  'bugReport.title': 'Signaler un bug',
  'bugReport.subtitle':
    "Capture d'écran + journaux automatiques + pièces jointes manuelles",
  'bugReport.close': 'Fermer',
  'bugReport.details': 'Détails',
  'bugReport.evidence': 'Preuves',
  'bugReport.machineSnapshotIncluded':
    'Inclut automatiquement un instantané technique de la machine.',
  'bugReport.field.title': 'Titre',
  'bugReport.field.description': 'Description',
  'bugReport.field.severity': 'Sévérité',
  'bugReport.field.steps': 'Étapes pour reproduire',
  'bugReport.field.expected': 'Résultat attendu',
  'bugReport.field.actual': 'Résultat obtenu',
  'bugReport.field.contact': 'Contact',
  'bugReport.placeholder.title':
    "Ex. : Erreur de traitement par lot dans l'AIO",
  'bugReport.placeholder.description': 'Décrivez le problème',
  'bugReport.placeholder.steps': '1. … 2. … 3. …',
  'bugReport.placeholder.contact': 'e-mail, Discord, @utilisateur',
  'bugReport.severity.low': 'Faible',
  'bugReport.severity.medium': 'Moyen',
  'bugReport.severity.high': 'Élevé',
  'bugReport.severity.critical': 'Critique',
  'bugReport.preparingEvidence': 'Préparation de la capture et des journaux…',
  'bugReport.dragToCrop': 'Glissez pour sélectionner un recadrage optionnel.',
  'bugReport.clearCrop': 'Effacer le recadrage',
  'bugReport.manualAttachments': 'Pièces jointes manuelles',
  'bugReport.attach': 'Joindre',
  'bugReport.attach.summary':
    'Max {count} fichiers, {size} Mo chacun. Total : {total}.',
  'bugReport.attach.maxCount': 'Max {count} pièces jointes.',
  'bugReport.attach.fileTooLarge': '{name} > {size} Mo.',
  'bugReport.attach.totalTooLarge': 'Total > {size} Mo.',
  'bugReport.attach.remove': 'Supprimer {name}',
  'bugReport.screenshotUnavailable': "Capture d'écran indisponible.",
  'bugReport.error.bridgeUnavailable': 'Bridge indisponible.',
  'bugReport.error.prepareFailed': 'Échec de la préparation du rapport de bug.',
  'bugReport.error.noScreenshot': "Aucune capture d'écran disponible.",
  'bugReport.error.fillTitleDescription':
    'Remplissez le titre et la description.',
  'bugReport.error.generic': 'Échec.',
  'bugReport.success.sent': 'Rapport envoyé.{screenshot}',
  'bugReport.success.screenshot': "Capture d'écran : {url}",
  'bugReport.legalPrefix':
    "En soumettant, vous confirmez avoir vérifié la capture d'écran, les journaux et les pièces jointes. Matériel transmis conformément aux",
  'bugReport.sending': 'Envoi…',
  'bugReport.submit': 'Envoyer le rapport',
  'dashboard.topbar.tools': 'Outils',
  'dashboard.topbar.showSidebar': 'Afficher la barre latérale',
  'dashboard.topbar.sidebar': 'Barre latérale',
  'dashboard.topbar.disableBatch': 'Désactiver le lot',
  'dashboard.topbar.enableBatch': 'Activer le lot',
  'dashboard.topbar.batchStatus': 'Lot · {count}t',
  'dashboard.topbar.threads': 'Threads',
  'dashboard.topbar.viewMode': 'Affichage',
  'dashboard.topbar.paginated': 'Paginé',
  'dashboard.topbar.longStrip': 'Bande longue',
  'dashboard.topbar.rotate90': 'Rotation 90°',
  'dashboard.topbar.selectImage': 'Sélectionnez une image',
  'dashboard.topbar.export': 'Exporter',
  'dashboard.topbar.textFile': 'Fichier texte',
  'dashboard.topbar.textPackage': 'Package texte',
  'dashboard.topbar.imagePackage': 'Package image',
  'dashboard.topbar.downloadTextAsTxt': 'Télécharge la traduction en .txt.',
  'dashboard.topbar.downloadVisualZip':
    'ZIP avec fichiers .txt OCR et traduction par image.',
  'dashboard.topbar.format': 'Format',
  'dashboard.topbar.quality': 'Qualité',
  'dashboard.topbar.package': 'Package',
  'dashboard.topbar.rawText': 'Texte brut',
  'dashboard.topbar.translated': 'Traduit',
  'dashboard.topbar.inpainted': 'Inpainté',
  'dashboard.topbar.downloadTxt': 'Télécharger le TXT',
  'dashboard.topbar.downloadZip': 'Télécharger le ZIP',
  'dashboard.topbar.downloadPackage': 'Télécharger le package',
  'dashboard.topbar.layeredPsd': 'PSD avec calques',
  'dashboard.topbar.layeredPsdHint':
    'Exporte un PSD pour Photoshop, CSP, Krita, GIMP.',
  'dashboard.topbar.compression': 'Compression',
  'dashboard.topbar.dpi': 'DPI',
  'dashboard.topbar.ocrOverlay': 'Overlay OCR',
  'dashboard.topbar.crops': 'Recadrages',
  'dashboard.topbar.rawTextLayer': 'Calque texte brut',
  'dashboard.topbar.translatedLayer': 'Calque traduit',
  'dashboard.topbar.psTextLayers': 'Calques texte PS',
  'dashboard.topbar.metadataJson': 'JSON de métadonnées',
  'dashboard.topbar.photoshopRequired':
    'Nécessite Adobe Photoshop (2025–cc2017).',
  'dashboard.topbar.generating': 'Génération…',
  'dashboard.topbar.psdWithMeta': 'PSD + Méta',
  'dashboard.topbar.exportPsd': 'Exporter le PSD',
  'dashboard.topbar.undoWorkspace': "Annuler dans l'espace de travail",
  'dashboard.topbar.undoShortcut': 'Annuler (Ctrl+Z)',
  'dashboard.topbar.redoWorkspace': "Rétablir dans l'espace de travail",
  'dashboard.topbar.redoShortcut': 'Rétablir (Ctrl+Maj+Z / Ctrl+Y)',
  'dashboard.topbar.shortcuts': 'Raccourcis',
  'dashboard.topbar.shortcutsHint': 'Raccourcis (H)',
  'dashboard.topbar.hideTools': 'Masquer les outils',
  'dashboard.topbar.showTools': 'Afficher les outils',
  'dashboard.topbar.hide': 'Masquer',
  'dashboard.topbar.profile': 'Profil',
  'dashboard.topbar.exportWorkspace': "Exporter l'espace de travail",
  'dashboard.topbar.importWorkspace': 'Importer un espace de travail',
  'dashboard.topbar.clearLocalAutosave':
    'Effacer la sauvegarde automatique locale',
  'dashboard.topbar.closeWorkspace': "Fermer l'espace de travail",
  'dashboard.topbar.replayTour': 'Rejouer la visite guidée',
  'dashboard.topbar.scanlationFeed': 'Flux Scanlation',
  'dashboard.topbar.rankings': 'Classements',
  'dashboard.topbar.logout': 'Se déconnecter',
  'settings.aioPresets.active': 'Actif',
  'settings.aioPresets.activate': 'Activer',
  'settings.aioPresets.editNamed': 'Modifier {name}',
  'settings.aioPresets.deleteNamed': 'Supprimer {name}',
  'settings.pickerPalette.title': 'Palette du sélecteur',
  'settings.pickerPalette.description':
    'Préréglages de couleurs unies et de dégradés pour les sélecteurs de remplissage.',
  'settings.pickerPalette.newPreset': 'Nouveau préréglage',
  'settings.pickerPalette.add': 'Ajouter',
  'settings.pickerPalette.reset': 'Réinitialiser',
  'settings.pickerPalette.hintPrefix':
    'Accepte les couleurs unies et les dégradés. Ex. :',
  'settings.pickerPalette.hintOr': 'ou',
  'settings.pickerPalette.solids': 'Couleurs unies',
  'settings.pickerPalette.gradients': 'Dégradés',
  'settings.modePresets.title': 'Préréglages par mode',
  'settings.modePresets.description':
    'Style de base par mode de texte. Appliqué automatiquement sur le tableau de bord.',
  'settings.modePresets.targetMode': 'Mode cible',
  'settings.modePresets.outline': 'Contour',
  'settings.modePresets.off': 'Désactivé',
  'settings.modePresets.outlineWidth': 'Épaisseur du contour',
  'settings.modePresets.ocrGradient': 'Dégradé OCR',
  'settings.modePresets.detect': 'Détecter',
  'settings.modePresets.ignore': 'Ignorer',
  'settings.modePresets.textColor': 'Couleur du texte',
  'settings.modePresets.outlineColor': 'Couleur du contour',
  'settings.modePresets.all': 'Tout',
  'settings.modePresets.mode': 'Mode',
  'settings.modePresets.save': 'Enregistrer',
  'settings.typographerLibrary.title': 'Bibliothèque Typesetter',
  'settings.typographerLibrary.description':
    'Styles globaux avec dossiers, préréglage par défaut et association par mode détecté.',
  'settings.typographerLibrary.newFolder': 'Nouveau dossier',
  'settings.typographerLibrary.defaultPreset': 'Préréglage par défaut',
  'settings.typographerLibrary.none': 'Aucun',
  'settings.typographerLibrary.edit': 'Modifier',
  'settings.typographerLibrary.new': 'Nouveau',
  'settings.typographerLibrary.presetTypographer': 'Préréglage Typesetter',
  'settings.typographerLibrary.folder': 'Dossier',
  'settings.typographerLibrary.withoutFolder': 'Sans dossier',
  'settings.typographerLibrary.descriptionPlaceholder': 'Ex. : Bulle FR-FR',
  'settings.typographerLibrary.padding': 'Marge intérieure',
  'settings.typographerLibrary.lineSpacing': 'Interligne',
  'settings.updates.title': 'Mises à jour',
  'settings.updates.currentVersion': 'Version actuelle',
  'settings.updates.newVersion': 'Nouvelle version',
  'settings.updates.status': 'Statut',
  'settings.updates.channel': 'Canal',
  'settings.updates.installOnClose': 'Installer à la fermeture',
  'settings.updates.policy': 'Politique',
  'settings.updates.mandatory': 'Obligatoire',
  'settings.updates.optional': 'Optionnel',
  'settings.updates.lastCheck': 'Dernière vérification',
  'settings.updates.downloadCompleted': 'Téléchargement terminé',
  'settings.updates.channelTitle': 'Canal de mise à jour',
  'settings.updates.stableDesc': 'Versions testées et stables',
  'settings.updates.betaDesc': 'Accès anticipé aux fonctionnalités',
  'settings.updates.installOnCloseTitle':
    "Installer la mise à jour à la fermeture de l'application",
  'settings.updates.installOnCloseDesc':
    "Lorsque le package est déjà téléchargé, l'installation démarre automatiquement à la fermeture.",
  'settings.updates.checking': 'Vérification…',
  'settings.updates.checkNow': 'Vérifier les mises à jour',
  'settings.updates.download': 'Télécharger la mise à jour',
  'settings.autosave.title': "Sauvegarde automatique de l'espace de travail",
  'settings.autosave.description':
    "Contrôle si le tableau de bord enregistre automatiquement l'espace de travail local et l'intervalle entre les sauvegardes.",
  'settings.autosave.enableTitle': 'Activer la sauvegarde automatique',
  'settings.autosave.enableDesc':
    "Lorsque cette option est activée, l'espace de travail est enregistré localement à intervalles réguliers dès qu'il y a des modifications en attente.",
  'settings.autosave.interval': 'Intervalle',
  'settings.autosave.save': 'Enregistrer la sauvegarde auto',
  'settings.shortcuts.title': 'Centre de raccourcis',
  'settings.shortcuts.description':
    "La configuration officielle des raccourcis se trouve désormais sur le tableau de bord, dans la barre supérieure. Cela évite les écarts entre l'écran principal et la page des paramètres.",
  'settings.shortcuts.whereToEdit': 'Où modifier',
  'settings.shortcuts.whereToEditDesc': 'Ouvrez le tableau de bord et utilisez',
  'settings.shortcuts.orPress': 'ou appuyez sur',
  'settings.tabs.ariaLabel': 'Onglets des paramètres',
  'settings.integrations.test': 'Tester',
  'settings.integrations.testing': 'Test en cours…',
  'settings.integrations.ok': '✓ OK',
  'settings.integrations.failed': '✗ Échec',
  'settings.integrations.saved': '✓ Enregistré',
  'settings.integrations.discord.description':
    'Notifications de traitement, erreurs et alertes de quota.',
  'settings.integrations.discord.webhookUrl': 'URL du webhook',
  'settings.integrations.discord.webhookPlaceholder':
    'https://discord.com/api/webhooks/…',
  'settings.integrations.discord.botName': 'Nom du bot',
  'settings.integrations.discord.webhookActive': 'Webhook actif',
  'settings.integrations.discord.howToSetup': 'Comment configurer',
  'settings.integrations.discord.step1': 'Dans Discord :',
  'settings.integrations.discord.step1Strong':
    'Paramètres du serveur → Intégrations → Webhooks → Nouveau webhook',
  'settings.integrations.discord.step2':
    "Copiez l'URL et collez-la dans le champ ci-dessus.",
  'dashboard.dashboardLlm.extraContextPlaceholder':
    'Contexte supplémentaire : personnages, ton, glossaire…',
  'dashboard.dashboardLlm.temperature': 'Température',
  'dashboard.dashboardLlm.topP': 'Top P',
  'dashboard.dashboardLlm.maxTokens': 'Tokens max',
  'dashboard.dashboardLlm.translationProfile': 'Profil de traduction',
  'dashboard.dashboardLlm.translationModelPlaceholder': 'gpt-4.1, claude…',
  'dashboard.dashboardLlm.apiKey': 'Clé API',
  'dashboard.dashboardLlm.apiKeyPlaceholder': 'sk-… (optionnel)',
  'dashboard.dashboardLlm.ocrProfile': 'Profil OCR',
  'dashboard.dashboardLlm.openAiCompatibleHint':
    "Compatible OpenAI. La base peut être /v1 ou l'endpoint complet. Certains acceptent une clé vide.",
  'dashboard.dashboardLlm.clear': 'Effacer',
  'dashboard.dashboardLlm.use': 'Utiliser',
  'dashboard.dashboardLlm.remove': 'Supprimer',
  'dashboard.dashboardLlm.save': 'Enregistrer',
  'dashboard.dashboardLlm.hdStrategy': 'Stratégie HD',
  'dashboard.dashboardLlm.resize': 'Redimensionner',
  'dashboard.dashboardLlm.crop': 'Recadrer',
  'dashboard.dashboardLlm.original': 'Original',
  'dashboard.dashboardLlm.hdStrategyHint':
    "Stratégie pour les grandes images avant l'inpainting.",
  'dashboard.dashboardLlm.resizeLimit': 'Limite de redimensionnement',
  'dashboard.dashboardLlm.cropMargin': 'Marge de recadrage',
  'dashboard.dashboardLlm.cropTriggerSize':
    'Taille de déclenchement du recadrage',
  'dashboard.dashboardRegion.title': 'Région',
  'dashboard.dashboardRegion.blocks': 'Blocs',
  'dashboard.dashboardRegion.selection': 'Sélection',
  'dashboard.dashboardRegion.ocr': 'OCR',
  'dashboard.dashboardRegion.translation': 'Traduction',
  'dashboard.dashboardRegion.notes': 'Notes',
  'dashboard.dashboardRegion.segments': 'Segments',
  'dashboard.dashboardRegion.disabled': 'désactivé',
  'dashboard.dashboardRegion.manualHint':
    "Dessinez sur l'aperçu pour ajouter des zones. Utilisez les coins pour redimensionner.",
  'dashboard.dashboardRegion.manualModeHint':
    'Mode manuel pour ajuster les zones.',
  'dashboard.dashboardRegion.dockHint':
    "Utilisez le dock flottant sur le canevas pour sélectionner, nettoyer et éditer. Les outils sont activés en fonction de l'étape active.",
  'dashboard.translator.workspace.ariaLabel': 'Mode traducteur',
  'dashboard.translator.sourceTitle': 'Texte source',
  'dashboard.translator.sourceDescription':
    'Collez, importez et traduisez en préservant les paragraphes et les retours à la ligne.',
  'dashboard.translator.sourcePlaceholder':
    "Collez le chapitre ou l'extrait à traduire ici…",
  'dashboard.translator.sourceAria': 'Texte source pour la traduction',
  'dashboard.translator.import': 'Importer',
  'dashboard.translator.translating': 'Traduction…',
  'dashboard.translator.translate': 'Traduire',
  'dashboard.translator.editorCleared': 'Éditeur effacé.',
  'dashboard.translator.clear': 'Effacer',
  'dashboard.translator.resultTitle': 'Résultat',
  'dashboard.translator.resultModelPrefix': 'Modèle : {value}',
  'dashboard.translator.resultPlaceholder': 'Lancez pour voir le résultat.',
  'dashboard.translator.resultFieldPlaceholder':
    'La traduction apparaîtra ici…',
  'dashboard.translator.resultPlaceholderAria': 'Résultat de la traduction',
  'dashboard.translator.editorDirty':
    'Le texte source a changé. Relancez pour mettre à jour.',
  'dashboard.translator.resultCopied': 'Résultat copié.',
  'dashboard.translator.copy': 'Copier',
  'dashboard.translator.downloadTxt': 'Télécharger le TXT',
  'dashboard.translator.modeLabel': 'Traducteur',
  'dashboard.translator.workspace.textHint':
    'Traduisez du texte libre en préservant les paragraphes et les retours à la ligne.',
  'dashboard.translator.workspace.visualHint':
    "Détectez des régions, lancez l'OCR et traduisez par zones dans les images.",
  'dashboard.translator.processing.standard': 'Standard',
  'dashboard.translator.processing.aiSfx': 'IA SFX',
  'dashboard.language.source': 'Langue source',
  'dashboard.language.target': 'Langue cible',
  'dashboard.models.title': 'Modèles',
  'dashboard.translator.ocr': 'OCR',
  'dashboard.translator.ocr.manageModels': 'Gérer les modèles OCR',
  'dashboard.translator.noneAvailable': 'Aucun modèle',
  'dashboard.translator.device': 'Appareil',
  'dashboard.translator.languages': 'Langues',
  'dashboard.translator.multi': 'multi',
  'dashboard.translator.noDescription': 'Aucune description.',
  'dashboard.translator.localStatus': 'Statut local : {value}',
  'dashboard.translator.sfx.cleanModel': 'Nettoyeur SFX',
  'dashboard.translator.sfx.hint':
    "Ex. : préférer les SFX courts et lourds, être plus conservateur lorsque l'effet est intégré dans un dessin au trait fin.",
  'dashboard.translator.llm.contextPlaceholder':
    'Contexte : glossaire, ton, personnages…',
  'dashboard.translator.llm.generateNotes': 'Générer des NT séparées',
  'dashboard.translator.llm.multimodalContext':
    'Image comme contexte multimodal',
  'dashboard.translator.llm.temperature': 'Température',
  'dashboard.translator.llm.topP': 'Top P',
  'dashboard.translator.llm.maxTokens': 'Tokens max',
  'dashboard.translator.execute.title': 'Exécuter',
  'dashboard.translator.loadImage': 'Charger',
  'dashboard.translator.detectTranslate': 'Détecter + Traduire',
  'dashboard.translator.retranslateImage': "Retraduire l'image",
  'dashboard.translator.retranslateRegion': 'Retraduire la région',
  'dashboard.translator.regionTitle': 'Région',
  'dashboard.translator.blocks': 'Blocs',
  'dashboard.translator.selection': 'Sélection',
  'dashboard.translator.translation': 'Traduction',
  'dashboard.translator.notes': 'Notes',
  'dashboard.translator.none': 'aucun',
  'dashboard.translator.charactersTranslated':
    '{count} caractère(s) traduit(s).',
  'splitter.workspace.emptyTitle': 'Chargez une image',
  'splitter.workspace.emptyDescription':
    "Utilisez la barre latérale gauche pour importer des pages. L'aperçu affiche les découpes suggérées et les segments générés.",
  'splitter.workspace.previewTitle': 'Aperçu des découpes',
  'splitter.workspace.previewDescription':
    'Double-cliquez pour ajouter une découpe. Glissez les lignes pour ajuster.',
  'splitter.workspace.previewAlt': 'Aperçu de {name}',
  'splitter.workspace.cutTitle': 'Découpe {index}',
  'splitter.workspace.hide': 'Masquer',
  'splitter.workspace.show': 'Afficher',
  'splitter.workspace.recalculate': 'Recalculer',
  'splitter.workspace.diagnostics': 'Diagnostics',
  'splitter.workspace.engine': 'Moteur',
  'splitter.workspace.cuts': 'Découpes',
  'splitter.workspace.segments': 'Segments',
  'splitter.workspace.whitespace': 'Espace blanc',
  'splitter.workspace.noWarnings': "Aucun avertissement pour l'image active.",
  'splitter.workspace.cutsTitle': 'Découpes ({count})',
  'splitter.workspace.cutCard': 'Découpe #{index}',
  'splitter.workspace.locked': 'Verrouillé',
  'splitter.workspace.unlocked': 'Déverrouillé',
  'splitter.workspace.merge': 'Fusionner',
  'splitter.workspace.segmentsTitle': 'Segments ({count})',
  'splitter.workspace.segmentAlt': 'Segment {index}',
  'splitter.workspace.segmentCard': 'Segment #{index}',
  'splitter.workspace.analyzing': 'Analyse en cours…',
  'splitter.workspace.dimensions': 'Dimensions',
  'splitter.workspace.axis': 'Axe',
  'splitter.workspace.strategy': 'Stratégie',
  'splitter.sidebar.title': 'Découpeur',
  'splitter.sidebar.recipe': 'Recette',
  'splitter.sidebar.preset': 'Préréglage',
  'splitter.sidebar.mode': 'Mode',
  'splitter.sidebar.direction': 'Direction',
  'splitter.sidebar.vertical': 'Vertical',
  'splitter.sidebar.horizontal': 'Horizontal',
  'splitter.sidebar.parts': 'Parties',
  'splitter.sidebar.targetHeight': 'Hauteur cible',
  'splitter.sidebar.minimum': 'Minimum',
  'splitter.sidebar.maximum': 'Maximum',
  'splitter.sidebar.adjustments': 'Ajustements',
  'splitter.sidebar.overlap': 'Chevauchement ({value}px)',
  'splitter.sidebar.whitespace': 'Espace blanc ({value})',
  'splitter.sidebar.noise': 'Bruit ({value})',
  'splitter.sidebar.edgeGuard': 'Protection des bords ({value}px)',
  'splitter.sidebar.protectTallBlocks': 'Protéger les blocs hauts',
  'splitter.sidebar.baseName': 'Nom de base',
  'splitter.sidebar.baseNamePlaceholder': 'koma-split',
  'splitter.sidebar.suffix': 'Suffixe',
  'splitter.sidebar.suffixPlaceholder': '{image}-partie-{index}',
  'splitter.sidebar.tokensPrefix': 'Jetons :',
  'splitter.sidebar.tokensAnd': 'et',
  'splitter.sidebar.actions': 'Actions',
  'splitter.sidebar.imagesCount': '{count} img.',
  'splitter.sidebar.activeImage': 'Active : {name}',
  'splitter.sidebar.selectImage': 'Sélectionnez une image.',
  'splitter.sidebar.reanalyze': 'Réanalyser',
  'splitter.sidebar.applyToActive': '→ Active',
  'splitter.sidebar.applyToAll': '→ Toutes',
  'splitter.sidebar.clearCuts': 'Effacer les découpes',
  'splitter.sidebar.resetRecipe': 'Réinitialiser la recette',
  'splitter.sidebar.exportActive': "Exporter l'active",
  'splitter.sidebar.exportBatch': 'Exporter le lot',
  'splitter.sidebar.directoryUnavailable': 'showDirectoryPicker indisponible.',
  'splitter.sidebar.exportToFolder': 'Exporter vers un dossier',
  'stitch.workspace.cancelled': "Rendu de l'assembleur annulé.",
  'stitch.workspace.renderingBatch': 'Rendu du lot {current}/{total}...',
  'stitch.workspace.batchReady': 'Lot {current} prêt au téléchargement.',
  'stitch.workspace.generatingZip':
    'Génération de {count} lot(s) assembleur...',
  'stitch.workspace.zipReady':
    'Archive ZIP avec {count} lot(s) générée avec succès.',
  'stitch.workspace.savingToFolder':
    'Enregistrement de {count} lot(s) dans le dossier...',
  'stitch.workspace.folderReady': 'Lots exportés vers le dossier sélectionné.',
  'stitch.workspace.folderCancelled': 'Export vers le dossier annulé.',
  'stitch.workspace.noBatchSelected': 'Aucun lot sélectionné',
  'stitch.workspace.previewEyebrow': 'Aperçu du lot',
  'stitch.workspace.batchTitle': 'Lot {current} sur {total}',
  'stitch.workspace.noBatchAvailable': 'Aucun lot disponible',
  'stitch.workspace.imagesCount': '{count} image(s)',
  'stitch.workspace.previousBatch': 'Lot précédent',
  'stitch.workspace.nextBatch': 'Lot suivant',
  'stitch.workspace.zoomOut': 'Dézoomer',
  'stitch.workspace.resetZoom': 'Réinitialiser le zoom',
  'stitch.workspace.zoomIn': 'Zoomer',
  'stitch.workspace.exporting': 'Export en cours…',
  'stitch.workspace.exportBatch': 'Exporter le lot',
  'stitch.workspace.zip': 'ZIP',
  'stitch.workspace.folder': 'Dossier',
  'stitch.workspace.cancel': 'Annuler',
  'stitch.workspace.emptyTitle': 'Aucun lot prêt',
  'stitch.workspace.emptyDescription':
    'Chargez des images dans le Tableau de bord et configurez les lots dans la barre latérale droite.',
  'stitch.workspace.generatingPreview': "Génération de l'aperçu {progress} %",
  'stitch.workspace.previewAlt': 'Aperçu du lot assemblé',
  'stitch.workspace.errorTitle': "Échec de l'assembleur",
  'stitch.workspace.planningEyebrow': 'Planification',
  'stitch.workspace.planningTitle': '{count} lot(s) planifié(s)',
  'stitch.workspace.planningSubtitle':
    'Vérifiez les lots volumineux et parcourez le plan.',
  'stitch.workspace.baseLabel': 'Base :',
  'stitch.workspace.batchCardTitle': 'Lot {index}',
  'stitch.workspace.batchCardDims': '{count} img · {width}×{height}',
  'stitch.workspace.activeBatch': 'Lot actif',
  'stitch.workspace.stats.images': 'Images',
  'stitch.workspace.stats.output': 'Sortie',
  'stitch.workspace.stats.size': 'Taille',
  'stitch.workspace.stats.preview': 'Aperçu',
  'stitch.workspace.awaiting': 'En attente',
  'stitch.workspace.toolboxTitle': 'Boîte à outils',
  'stitch.workspace.toolboxDescription':
    'Les paramètres et ajustements de limites se trouvent dans la barre latérale droite.',
  'stitch.sidebar.title': 'Assembleur',
  'stitch.sidebar.layout': 'Disposition',
  'stitch.sidebar.layoutMode': "Mode d'assemblage",
  'stitch.sidebar.vertical': 'Vertical',
  'stitch.sidebar.horizontal': 'Horizontal',
  'stitch.sidebar.strategy': 'Stratégie',
  'stitch.sidebar.fixedCount': 'Nombre fixe',
  'stitch.sidebar.targetAxis': 'Cible par axe',
  'stitch.sidebar.single': 'Tout en un',
  'stitch.sidebar.imagesPerBatch': 'Images par lot',
  'stitch.sidebar.spacing': 'Espacement ({value}px)',
  'stitch.sidebar.alignment': 'Alignement',
  'stitch.sidebar.start': 'Début',
  'stitch.sidebar.center': 'Centre',
  'stitch.sidebar.end': 'Fin',
  'stitch.sidebar.output': 'Sortie',
  'stitch.sidebar.background': 'Arrière-plan',
  'stitch.sidebar.backgroundColor': "Couleur d'arrière-plan",
  'stitch.sidebar.baseName': 'Nom de base',
  'stitch.sidebar.baseNamePlaceholder': 'koma-stitch',
  'stitch.sidebar.imagesInfo':
    "{count} image(s). L'ordre actuel définit les lots.",
  'stitch.sidebar.recalculate': 'Recalculer les lots',
  'stitch.sidebar.boundary': 'Limite',
  'stitch.sidebar.boundaryBatch': 'Lot {current}/{total} · {count} img',
  'stitch.sidebar.noBatch': 'Aucun lot',
  'stitch.sidebar.moveLastToNext': 'Dernier → suivant',
  'stitch.sidebar.pullFromNext': 'Récupérer du suivant',
  'modelManager.filters.catalog': 'Catalogue',
  'modelManager.filters.all': 'Tous',
  'modelManager.filters.local': 'Local',
  'modelManager.filters.cloud': 'Cloud',
  'modelManager.filters.language': 'Langue',
  'modelManager.filters.status': 'Statut',
  'modelManager.filters.installed': 'Installé',
  'modelManager.filters.notInstalled': 'Non installé',
  'modelManager.filters.updateAvailable': 'Mise à jour disponible',
  'modelManager.tooltip.speed.fast': 'Rapide',
  'modelManager.tooltip.speed.good': 'Bon',
  'modelManager.tooltip.speed.excellent': 'Excellent',
  'modelManager.tooltip.allLanguages': 'Toutes les langues prises en charge',
  'modelManager.tooltip.infoAria': 'Informations sur le modèle {name}',
  'modelManager.tooltip.info': 'Infos',
  'modelManager.tooltip.aioStage': 'Étape AIO',
  'modelManager.tooltip.description': 'Description',
  'modelManager.tooltip.languages': 'Langues',
  'modelManager.tooltip.speed.label': 'Vitesse',
  'modelManager.tooltip.minimum': 'Minimum',
  'modelManager.tooltip.downloadSize': 'Taille du téléchargement',
  'modelManager.tooltip.diskSpace': 'Espace disque',
  'modelManager.tooltip.version': 'Version',
  'modelManager.status.installed': 'Installé',
  'modelManager.status.updateAvailable': 'Mise à jour disponible',
  'modelManager.status.downloading': 'Téléchargement',
  'modelManager.status.queued': "En file d'attente",
  'modelManager.status.verifying': 'Vérification',
  'modelManager.status.failed': 'Échoué',
  'modelManager.status.cancelled': 'Annulé',
  'modelManager.status.incomplete': 'Incomplet',
  'modelManager.status.notInstalled': 'Non installé',
  'modelManager.actions.selected': 'Sélectionné',
  'modelManager.actions.useModel': 'Utiliser le modèle',
  'modelManager.actions.uninstall': 'Désinstaller',
  'modelManager.actions.update': 'Mettre à jour',
  'modelManager.actions.retry': 'Réessayer',
  'modelManager.actions.install': 'Installer',
  'modelManager.actions.source': 'Source',
  'modelCard.status.selected': 'Sélectionné',
  'modelCard.status.failed': 'Échoué',
  'modelCard.status.verifying': 'Vérification…',
  'modelCard.status.queued': "En file d'attente…",
  'modelCard.status.downloading': 'Téléchargement…',
  'modelCard.status.cancelled': 'Annulé',
  'modelCard.status.incomplete': 'Incomplet',
  'modelCard.status.notInstalled': 'Non installé',
  'modelCard.action.cancel': 'Annuler',
  'modelCard.action.remove': 'Supprimer',
  'modelCard.action.update': 'Mettre à jour',
  'modelCard.action.install': 'Installer',
  'modelCard.action.retry': 'Réessayer',
  'modelCard.action.active': 'Actif',
  'modelCard.action.use': 'Utiliser',
  'modelManager.stage.translate': 'Obtenir les traductions',
  'modelManager.installAll.attention': 'Attention',
  'modelManager.installAll.warning':
    'Vous êtes sur le point de télécharger TOUS les modèles de traduction.',
  'modelManager.installAll.totalSize': 'Taille totale : {size}',
  'modelManager.installAll.space': 'Espace disponible : {space}',
  'modelManager.installAll.time': 'Durée estimée : dépend de votre connexion',
  'modelManager.installAll.notEnoughSpace':
    'Espace insuffisant. Requis : {required} | Disponible : {available}',
  'modelManager.installAll.confirm':
    'Cela peut prendre beaucoup de temps et utiliser un espace disque important. Voulez-vous continuer ?',
  'modelManager.installAll.confirmDownload': 'Confirmer le téléchargement',
  'modelManager.disk.notVerified': 'Disque non vérifié',
  'modelManager.disk.free': '{space} libre',
  'modelManager.disk.models': '{installed}/{total} modèles ({size})',
  'modelManager.enhance.title': "Modèles d'amélioration",
  'modelManager.enhance.description':
    "Catalogue local exclusif pour l'améliorateur. Installez, mettez à jour, désinstallez ou importez un ONNX.",
  'modelManager.enhance.freeSpace': 'Espace libre',
  'modelManager.enhance.notChecked': 'non vérifié',
  'modelManager.enhance.closeAria':
    "Fermer la fenêtre des modèles d'amélioration",
  'modelManager.enhance.directInstall': 'Installation directe',
  'modelManager.enhance.directInstallDesc':
    'Modèles sélectionnés avec téléchargement direct ou installation gérée sur le mini-backend.',
  'modelManager.enhance.manualImport': 'Import manuel',
  'modelManager.enhance.manualImportDesc':
    'Modèles listés dans le catalogue mais chargés via un ONNX local. Utilisez la conversion externe lorsque seul le `.pth` est disponible.',
  'modelManager.enhance.importOnnxBadge': 'Import ONNX',
  'modelManager.enhance.statusLabel': 'Statut',
  'modelManager.enhance.estimatedDisk': 'Espace disque estimé',
  'modelManager.enhance.reimportOnnx': "Réimporter l'ONNX",
  'modelManager.enhance.pthHint': 'Pour les poids au format',
  'modelManager.enhance.pthHintSuffix':
    "convertissez d'abord en ONNX, puis utilisez l'import manuel.",
  'common.yes': 'Oui',
  'dashboard.organize.hint.reorder':
    'Glissez et réordonnez les fichiers dans le panneau de gauche.',
  'dashboard.organize.hint.rotate':
    'Utilisez le bouton de rotation pour corriger les pages numérisées horizontalement.',
  'guides.common.beginner': 'Débutant',
  'guides.common.intermediate': 'Intermédiaire',
  'guides.common.advanced': 'Avancé',
  'guides.home.title': 'Guides et tutoriels',
  'guides.home.description':
    'Apprenez à maîtriser chaque outil de KŌMA Studio avec des guides pas à pas, des astuces de productivité et des exemples concrets.',
  'guides.home.searchPlaceholder':
    'Rechercher des guides, raccourcis, astuces...',
  'guides.home.searchAria': 'Rechercher des guides',
  'guides.home.continueReading': 'Reprendre là où vous vous êtes arrêté',
  'guides.home.stepProgress': 'Étape {current} sur {total} · {time}',
  'guides.home.continueCta': 'Continuer →',
  'guides.home.categories': 'Catégories',
  'guides.home.guidesCountLabel': 'guide{suffix}',
  'guides.home.completedCountLabel': 'terminé{suffix}',
  'guides.home.guidesPluralSuffix': 's',
  'guides.home.saved': 'Enregistrés ({count})',
  'guides.reader.backToGuides': 'Retour aux guides',
  'guides.reader.notFound': 'Guide introuvable',
  'guides.reader.progressAria': 'Progression du guide',
  'guides.reader.stepsAria': 'Étapes du guide',
  'guides.reader.stepLabel': 'Étape {index}',
  'guides.reader.recent': 'Récents',
  'guides.reader.guides': 'Guides',
  'guides.reader.removeBookmark': 'Retirer le signet',
  'guides.reader.saveBookmark': 'Enregistrer le signet',
  'guides.reader.previous': 'Précédent',
  'guides.reader.next': 'Suivant',
  'guides.reader.completeGuide': 'Terminer le guide',
  'guides.detail.back': 'Retour',
  'guides.detail.notFound': 'Guide introuvable.',
  'guides.detail.stepsAria': 'Étapes du guide',
  'guides.detail.stepLabel': 'Étape {index}',
  'guides.detail.recent': 'Récents',
  'guides.detail.guides': 'Guides',
  'guides.detail.stepCounter': 'Étape {current} sur {total}',
  'guides.detail.previous': 'Précédent',
  'guides.detail.next': 'Suivant',
  'guides.detail.complete': 'Terminer',
  'guides.detail.completed': 'Terminé ✓',
  'guides.detail.tocAria': 'Table des matières',
  'guides.detail.inThisGuide': 'Dans ce guide',
  'guides.detail.removeFavorite': 'Retirer des favoris',
  'guides.detail.addFavorite': 'Ajouter aux favoris',
  'guides.detail.saved': 'Enregistré',
  'guides.detail.save': 'Enregistrer',
  'guides.step.copyCode': 'Copier le code',
  'guides.step.copied': 'Copié',
  'guides.step.copy': 'Copier',
  'guides.search.dialogAria': 'Rechercher des guides',
  'guides.search.placeholder': 'Rechercher des guides, raccourcis, astuces...',
  'guides.search.inputAria': 'Rechercher',
  'guides.search.close': 'Fermer la recherche',
  'guides.search.noResults': 'Aucun résultat pour « {query} »',
  'guides.search.results': 'Résultats ({count})',
  'guides.search.recent': 'Récents',
  'guides.search.navigate': 'naviguer',
  'guides.search.open': 'ouvrir',
  'guides.search.closeVerb': 'fermer',
  'guides.category.searchPlaceholder': 'Rechercher dans {category}...',
  'guides.category.searchAria': 'Rechercher dans {category}',
  'guides.category.noSearchResults': 'Aucun guide pour « {query} »',
  'guides.category.noGuides': 'Aucun guide dans cette catégorie',
  'guides.category.tryOtherTerms': "Essayez d'autres termes.",
  'guides.category.comingSoon':
    'De nouveaux guides seront ajoutés prochainement.',
  'settings.profile.title': 'Profil utilisateur',
  'settings.profile.name': 'Nom',
  'settings.profile.email': 'E-mail',
  'settings.profile.verification': 'Vérification',
  'settings.profile.accountId': 'Identifiant du compte',
  'settings.profile.environment': 'Environnement',
  'settings.profile.unspecified': 'Non spécifié',
  'settings.profile.verified': 'Vérifié',
  'settings.profile.pending': 'En attente',
  'settings.profile.sendVerification': "Envoyer l'e-mail de vérification",
  'settings.travel.destination': 'Destination du jeton',
  'settings.travel.expiry': 'Expiration du code',
  'settings.travel.temporaryAccess': 'Accès temporaire',
  'settings.travel.streamLike':
    'Fonctionnement inspiré des plateformes de streaming',
  'settings.travel.streamLikeDesc':
    "Le code est envoyé à l'adresse e-mail du compte et accorde un accès temporaire sur un autre PC.",
  'settings.travel.sendToken': 'Envoyer le jeton à mon e-mail',
  'settings.travel.destinationPrefix': 'Destination : {value}',
  'settings.travel.expirationPrefix': 'Expiration : {value}',
  'settings.travel.accessPrefix': 'Accès : {value}',
  'settings.travel.definedOnSend': "Défini à l'envoi",
  'settings.plan.day': 'jour',
  'settings.plan.days': 'jours',
  'settings.integrations.blogger.label': 'Libellé',
  'settings.integrations.blogger.labelPlaceholder': 'Blogger principal',
  'settings.integrations.blogger.blogId': 'ID du blog',
  'settings.integrations.blogger.blogIdPlaceholder': 'ID numérique',
  'settings.integrations.blogger.clientId': 'Client ID',
  'settings.integrations.blogger.clientIdPlaceholder': 'Google OAuth Client ID',
  'settings.integrations.blogger.clientSecret': 'Client Secret',
  'settings.integrations.blogger.clientSecretPlaceholder':
    'OAuth Client Secret',
  'settings.integrations.blogger.refreshToken': 'Refresh Token',
  'settings.integrations.blogger.refreshTokenPlaceholder': 'Refresh Token',
  'settings.integrations.blogger.defaultLabels': 'Libellés par défaut',
  'settings.integrations.blogger.defaultLabelsPlaceholder':
    'manga, chapitre, sortie',
  'settings.integrations.blogger.optimizer': 'Optimiseur',
  'settings.integrations.blogger.optimizerCloudinary': 'Cloudinary Fetch',
  'settings.integrations.blogger.optimizerTemplate': "Modèle d'URL",
  'settings.integrations.blogger.cloudName': 'Cloud Name',
  'settings.integrations.blogger.urlTemplate': "Modèle d'URL",
  'settings.integrations.blogger.cloudNamePlaceholder': 'my-cloud-name',
  'settings.integrations.blogger.cloudinaryTransformation':
    'Transformation Cloudinary',
  'settings.integrations.blogger.optimizerEnabled': 'Optimiseur actif',
  'settings.integrations.blogger.maxWidth': 'Largeur max.',
  'settings.integrations.blogger.maxHeight': 'Hauteur max.',
  'settings.integrations.blogger.testConnection': 'Tester la connexion',
  'settings.integrations.blogger.requestsPerDay': 'Requêtes/jour',
  'settings.integrations.blogger.requestsPerUser': 'Requêtes/utilisateur',
  'settings.integrations.blogger.credentialsGuideTitle':
    'Comment obtenir les identifiants',
  'settings.integrations.blogger.step1': 'Allez sur',
  'settings.integrations.blogger.step1Suffix':
    'créez ou sélectionnez un projet.',
  'settings.integrations.blogger.step2': "Activez l'",
  'settings.integrations.blogger.step2And': "et l'",
  'settings.integrations.blogger.step3': 'Créez un',
  'settings.integrations.blogger.webApplication': 'Application web',
  'settings.integrations.blogger.step4': 'Ajoutez',
  'settings.integrations.blogger.step4Suffix': 'aux URI de redirection.',
  'settings.integrations.blogger.step5': 'Copiez',
  'settings.integrations.blogger.step5And': 'et',
  'settings.integrations.blogger.step6':
    "Configurez l'écran de consentement OAuth. Si en mode Test, ajoutez votre e-mail.",
  'settings.integrations.blogger.step7': 'Dans le',
  'settings.integrations.blogger.step7Suffix':
    'activez vos propres identifiants et autorisez les scopes Blogger + Drive.',
  'settings.integrations.blogger.step8': 'Effectuez',
  'settings.integrations.blogger.step8Suffix': 'et copiez le',
  'settings.integrations.blogger.step9': 'Pour Cloudinary, copiez le',
  'settings.integrations.blogger.step9Suffix':
    'et configurez la transformation.',
  'settings.integrations.blogger.step10': "Trouvez l'",
  'settings.integrations.blogger.step10Suffix': "via l'URL/API Blogger.",
  'settings.integrations.blogger.step11':
    "Enregistrez tout, testez la connexion et utilisez l'utilitaire dans le tableau de bord.",
  'settings.integrations.blogger.googleQuotas': 'Quotas Google',
  'settings.integrations.blogger.oauthPlayground': 'OAuth Playground',
  'settings.integrations.blogger.cloudinaryFetch': 'Cloudinary Fetch',
  'settings.integrations.blogger.driveScopes': 'Scopes Drive',
  'settings.integrations.blogger.driveScopesGuideTitle':
    'Scopes Drive dans OAuth Playground',
  'settings.integrations.blogger.minimumPractical': 'Minimum pratique :',
  'settings.integrations.blogger.driveScopesNote':
    "Consultez la documentation officielle de l'API Drive v3 pour les scopes supplémentaires.",
  'settings.integrations.imgur.title': 'Upload Imgur',
  'settings.integrations.imgur.description':
    'Upload anonyme avec rotation de Client ID et limitation de débit conservative.',
  'settings.integrations.imgur.limitPerHour': 'Limite/heure',
  'settings.integrations.imgur.batchDelay': 'Délai entre lots (ms)',
  'settings.integrations.imgur.remaining': 'Restant',
  'settings.integrations.imgur.used': 'Utilisés : {used}/{limit}',
  'settings.integrations.imgur.reset': 'réinitialisation : {value}',
  'settings.integrations.imgur.clientIds': 'Client IDs',
  'settings.integrations.imgur.noClientIds': 'Aucun Client ID configuré.',
  'settings.integrations.imgur.clientIdPlaceholder': 'Imgur Client ID',
  'settings.integrations.imgur.quickGuideTitle': 'Guide rapide Imgur',
  'settings.integrations.imgur.step1':
    'Créez une application sur le tableau de bord développeur Imgur et copiez le',
  'settings.integrations.imgur.step2':
    "Ajoutez un ou plusieurs Client IDs. L'application en choisit un au hasard.",
  'settings.integrations.imgur.step3': 'Upload anonyme avec',
  'settings.integrations.imgur.step3Suffix': "Pas d'OAuth.",
  'settings.integrations.imgur.step4': 'Limiteur conservatif :',
  'settings.integrations.imgur.step4Suffix': 'pour éviter les blocages.',
  'settings.integrations.imgur.step5':
    'Upload séquentiel respectant le délai configuré.',
  'settings.integrations.imgur.step6':
    'Imgur ne doit pas être considéré comme un CDN garanti.',
  'settings.integrations.imgur.imageApi': 'Imgur Image API',
  'settings.integrations.imgur.uploading': 'Upload Imgur',
  'common.add': 'Ajouter',
  'common.label': 'Libellé',
  'common.original': 'Original',
  'common.quality': 'Qualité',
  'common.persistence': 'Persistance',
  'common.secureStore': 'Stockage sécurisé',
  'common.browserFallback': 'Fallback navigateur',
  'common.notAvailableShort': '—',
  'common.loading': 'Chargement',
  'common.sending': 'Envoi en cours…',
  'common.single': 'Simple',
  'common.tile': 'Mosaïque',
  'common.grid': 'Grille',
  'common.smart': 'Intelligent',
  'common.multi': 'Multiple',
  'blogger.title': 'Blogger CDN',
  'blogger.heroTitle': 'Publiez et hébergez des images sur Blogger',
  'blogger.heroDescription':
    'Mode publication pour des articles avec éditeur visuel/HTML. Mode upload pour générer des URL hébergées.',
  'blogger.ready': 'Prêt',
  'blogger.configureInSettings': 'Configurer dans les Paramètres',
  'blogger.publishTab': 'Publier',
  'blogger.uploadTab': 'Upload',
  'blogger.settings': 'Paramètres',
  'blogger.missingConfigTitle': 'Configuration manquante',
  'blogger.missingConfigBody':
    "Enregistrez les identifiants dans les Paramètres avant d'utiliser.",
  'blogger.post.title': 'Article',
  'blogger.post.description': 'Titre, libellés et publication.',
  'blogger.post.postTitle': 'Titre',
  'blogger.post.postTitlePlaceholder': "Titre de l'article",
  'blogger.post.defaultLabels': 'Libellés par défaut',
  'blogger.post.defaultLabelsPlaceholder': 'manga, chapitre',
  'blogger.post.postLabels': "Libellés de l'article",
  'blogger.post.postLabelsPlaceholder': 'critique',
  'blogger.post.publishNow': 'Publier maintenant',
  'blogger.post.draft': 'Brouillon',
  'blogger.post.publish': 'Publier',
  'blogger.post.status.draft': 'enregistré comme brouillon',
  'blogger.post.status.published': 'publié',
  'blogger.template.title': 'Nouvel article Blogger',
  'blogger.template.description':
    "Rédigez le contenu de l'article ici. Vous pouvez basculer entre visuel, HTML et aperçu.",
  'blogger.template.insertPrefix': 'Utilisez le bouton',
  'blogger.template.insertSuffix':
    'pour uploader des fichiers sur Blogger et insérer les URL hébergées dans le contenu.',
  'blogger.editor.title': 'Éditeur',
  'blogger.editor.description': 'Visuel, HTML et aperçu.',
  'blogger.editor.visual': 'Visuel',
  'blogger.editor.preview': 'Aperçu',
  'blogger.editor.h1': 'H1',
  'blogger.editor.h2': 'H2',
  'blogger.editor.bold': 'Gras',
  'blogger.editor.italic': 'Italique',
  'blogger.editor.underline': 'Souligné',
  'blogger.editor.list': 'Liste',
  'blogger.editor.numbered': 'Numérotée',
  'blogger.editor.quote': 'Citation',
  'blogger.editor.link': 'Lien',
  'blogger.editor.promptUrl': 'URL',
  'blogger.editor.insertImages': 'Insérer des images',
  'blogger.copied': 'Copié',
  'blogger.loadConfigFailed':
    'Échec du chargement de la configuration Blogger.',
  'blogger.imageInsertedSingle':
    "Image hébergée sur Blogger et insérée dans l'éditeur.",
  'blogger.imageInsertedMany':
    "{count} images hébergées sur Blogger et insérées dans l'éditeur.",
  'blogger.uploadFailed': "Échec de l'upload des images sur Blogger.",
  'blogger.batchUploadSingle':
    "Upload terminé dans un seul brouillon d'article Blogger.",
  'blogger.batchUploadMany':
    "{count} images uploadées dans un seul brouillon d'article Blogger.",
  'blogger.uploadFailedShort': "Échec de l'upload.",
  'blogger.batchUploadSuccessSingle':
    "Upload terminé dans un seul brouillon d'article Blogger.",
  'blogger.batchUploadSuccessMany':
    "{count} images uploadées dans un seul brouillon d'article Blogger.",
  'blogger.publishSuccessWithUrl': 'Article {verb} sur Blogger. URL : {url}',
  'blogger.publishSuccessWithId': "Article {verb} sur Blogger avec l'ID {id}.",
  'blogger.publishFailed': 'Échec de la publication sur Blogger.',
  'blogger.uploadSection.title': 'Upload par lot',
  'blogger.uploadSection.description':
    'Déposez des images pour générer des URL hébergées.',
  'blogger.uploadSection.dropTitle': 'Déposez des images ici',
  'blogger.uploadSection.dropDescription':
    'PNG, JPG, WebP avec prétraitement local.',
  'blogger.uploadSection.optimizedUrl': 'URL optimisée',
  'blogger.uploadSection.optimizedUrlDesc':
    "Génère une URL optimisée avant l'upload.",
  'blogger.uploadSection.exportOptimized': 'Exporter optimisé',
  'blogger.uploadSection.exportOptimizedDesc':
    "Utilise l'URL optimisée dans les actions par lot.",
  'blogger.uploadSection.outputImg': 'Sortie <img>',
  'blogger.uploadSection.outputImgDesc': "Extraits HTML au lieu d'URL.",
  'blogger.uploadSection.select': 'Sélectionner',
  'blogger.uploadSection.send': 'Envoyer',
  'blogger.uploadSection.exported': 'Exporté',
  'blogger.queue.title': "File d'attente",
  'blogger.queue.items': '{count} élément(s)',
  'blogger.queue.empty': 'Aucun fichier.',
  'blogger.queue.altText': 'Texte alternatif',
  'blogger.queue.canonical': 'Canonique',
  'blogger.queue.optimized': 'Optimisé',
  'blogger.queue.url': 'URL',
  'blogger.queue.opt': 'Opt',
  'blogger.queue.img': 'img',
  'common.remove': 'Supprimer',
  'ranking.backToDashboard': 'Retour au tableau de bord',
  'ranking.hero.title': 'Classement des modèles',
  'ranking.hero.subtitle':
    "Comparez les modèles officiels grâce aux avis réels de la communauté — qualité, vitesse, rapport qualité-prix et facilité d'utilisation.",
  'ranking.hero.globalStatsAria': 'Statistiques globales',
  'ranking.hero.models': 'Modèles',
  'ranking.hero.reviews': 'Avis',
  'ranking.hero.bestOverall': 'Meilleur global',
  'ranking.hero.costBenefit': 'Rapport qualité-prix',
  'ranking.loading': 'Mise à jour du classement…',
  'legalHub.back': 'Retour',
  'legalHub.sidebarTitle': 'Centre juridique',
  'legalHub.supportDescription':
    "Les demandes d'assistance, de confidentialité et de droits des personnes concernées doivent passer par le canal officiel indiqué dans l'application/le site web.",
  'legalHub.supportCta': "Ouvrir le canal d'assistance",
  'legalHub.noticeTitle': 'Avis important.',
  'dashboard.dashboardExecute.selectImage':
    'Sélectionnez une image à exécuter.',
  'dashboard.dashboardExecute.runCurrentStage':
    "Exécuter l'étape actuelle pour l'image.",
  'dashboard.dashboardExecute.rerunStage': "Relancer l'étape",
  'dashboard.dashboardExecute.runStage': "Exécuter l'étape",
  'dashboard.dashboardExecute.runAio': 'Exécuter AIO',
  'dashboard.dashboardExecute.stop': "Arrêter l'exécution",
  'freeProviderCard.stage.translation': 'Traduction',
  'freeProviderCard.stage.ocr': 'OCR',
  'freeProviderCard.stage.clean': 'Nettoyage',
  'freeProviderCard.badge.integrated': 'Intégré',
  'freeProviderCard.badge.catalog': 'Catalogue',
  'freeProviderCard.verifiedAt': 'vérifié le',
  'freeProviderCard.tooltip.selectedModel': 'Modèle sélectionné',
  'freeProviderCard.tooltip.notSelected': '(non sélectionné)',
  'freeProviderCard.tooltip.notDefined': '(non défini)',
  'freeProviderCard.tooltip.apiKeyConfigured': 'Configurée',
  'freeProviderCard.tooltip.apiKeyRequired': 'Requise (en attente)',
  'freeProviderCard.tooltip.apiKeyOptional': 'Optionnelle (vide)',
  'freeProviderCard.tooltip.extraFields': 'Champs supplémentaires',
  'freeProviderCard.tooltip.modelsInStage': 'Modèles dans cette étape',
  'freeProviderCard.tooltip.empty': '(vide)',
  'freeProviderCard.label.model': 'Modèle',
  'freeProviderCard.label.apiBase': 'API Base',
  'freeProviderCard.label.apiKey': 'Clé API',
  'freeProviderCard.label.required': '(requise)',
  'freeProviderCard.label.optional': '(optionnelle)',
  'freeProviderCard.placeholder.apiKey': 'Collez votre clé ici',
  'freeProviderCard.status.activeProfile': 'Profil actif :',
  'freeProviderCard.status.catalogOnlyWarning':
    'Ce fournisseur est uniquement catalogue en v1.',
  'freeProviderCard.action.save': 'Enregistrer',
  'freeProviderCard.action.use': 'Utiliser',
  'customProvider.field.name': 'Nom',
  'customProvider.field.model': 'Modèle',
  'customProvider.field.apiBase': 'API Base',
  'customProvider.field.apiKey': 'Clé API',
  'customProvider.placeholder.noKey': '(aucune clé)',
  'customProvider.placeholder.pasteKey': 'Collez votre clé ici',
  'customProvider.status.active': 'Profil actif dans le pipeline',
  'customProvider.action.cancel': 'Annuler',
  'customProvider.action.saving': 'Enregistrement...',
  'customProvider.action.save': 'Enregistrer',
  'customProvider.action.edit': 'Modifier',
  'customProvider.action.delete': 'Supprimer',
  'customProvider.badge.customProfile': 'Profil personnalisé',
  'freeProviderCard.status.integrated': 'Intégré',
  'freeProviderCard.status.catalog': 'Catalogue',
  'freeProviderCard.status.verifiedAt': 'vérifié le',
  'freeProviderCard.info.label': 'Infos',
  'freeProviderCard.info.tooltip': 'Infos sur {name}',
  'freeProviderCard.info.selectedModel': 'Modèle sélectionné :',
  'freeProviderCard.info.notSelected': '(non sélectionné)',
  'freeProviderCard.info.modelId': 'ID du modèle :',
  'freeProviderCard.info.notDefined': '(non défini)',
  'freeProviderCard.info.apiBase': 'API Base :',
  'freeProviderCard.info.apiKey': 'Clé API :',
  'freeProviderCard.info.configured': 'Configurée',
  'freeProviderCard.info.required': 'Requise (en attente)',
  'freeProviderCard.info.optional': 'Optionnelle (vide)',
  'freeProviderCard.info.extraFields': 'Champs supplémentaires :',
  'freeProviderCard.info.setup': 'Configuration :',
  'freeProviderCard.info.limits': 'Limites :',
  'freeProviderCard.info.rateLimits': 'Limites de débit :',
  'freeProviderCard.info.modelsInStage': 'Modèles dans cette étape :',
  'freeProviderCard.field.model': 'Modèle',
  'freeProviderCard.field.apiBase': 'API Base',
  'freeProviderCard.field.apiBaseTitle':
    'API Base fixe pour ce fournisseur en v1',
  'freeProviderCard.field.required': '(requise)',
  'freeProviderCard.field.optional': '(optionnelle)',
  'freeProviderCard.field.apiKeyPlaceholder': 'Collez votre clé ici',
  'freeProviderCard.status.catalogOnly':
    'Ce fournisseur est uniquement catalogue en v1.',
  'freeProviderCard.actions.save': 'Enregistrer',
  'freeProviderCard.actions.use': 'Utiliser',
  'freeProviderCard.empty': '(vide)',
  'customProvider.action.use': 'Utiliser',
  'typo.tag': 'Typographe',
  'typo.session.title': 'Session',
  'typo.session.image': 'Image :',
  'typo.session.selection': 'Sélection :',
  'typo.session.none': 'aucune',
  'typo.tools.aria': 'Outils de forme',
  'typo.tools.select': 'Sélection',
  'typo.tools.rect': 'Rectangulaire',
  'typo.tools.ellipse': 'Elliptique',
  'typo.actions.refine': 'Affiner',
  'typo.actions.toRect': '→ Rectangulaire',
  'typo.actions.toEllipse': '→ Elliptique',
  'typo.actions.duplicate': 'Dupliquer',
  'typo.actions.delete': 'Supprimer la sélection',
  'typo.presets.title': 'Préréglages',
  'typo.presets.active': 'Préréglage actif',
  'typo.presets.none': 'Aucun préréglage',
  'typo.presets.applySelection': '→ Sélection',
  'typo.presets.applyImage': '→ Image',
  'typo.snapshots.title': 'Instantanés',
  'typo.snapshots.hint':
    "Enregistrez l'état actuel pour le restaurer plus tard.",
  'typo.snapshots.placeholder': "Nom de l'instantané",
  'typo.snapshots.save': "Enregistrer l'instantané",
  'typo.snapshots.select': 'Sélectionner…',
  'typo.snapshots.restore': 'Restaurer',
  'typo.queue.title': 'File de texte',
  'typo.queue.editorPlaceholder': 'Collez les lignes, une par bulle…',
  'typo.queue.editorAria': 'Éditeur de texte de la file',
  'typo.queue.build': 'Construire la file',
  'typo.queue.import': 'Importer',
  'typo.queue.applySelected': "Appliquer l'élément",
  'typo.queue.next': 'Suivant',
  'typo.queue.clear': 'Vider',
  'typo.queue.multiBubble': 'Multi-bulles',
  'typo.queue.listAria': 'File typographique',
  'typo.queue.emptyTitle': 'La file est vide',
  'typo.queue.emptyDesc': 'Une ligne par bulle pour construire la séquence.',
  'typo.queue.statusApplied': 'Appliqué',
  'typo.queue.statusSkipped': 'Ignoré',
  'typo.queue.statusPending': 'En attente',
  'modelDetail.empty':
    'Sélectionnez un modèle dans le classement pour voir les détails et les avis.',
  'modelDetail.source.local': 'Local',
  'modelDetail.source.cloud': 'Cloud',
  'modelDetail.score.aria': 'Score global : {score}',
  'modelDetail.score.label': 'Score',
  'modelDetail.reviews.count_one': '{count} avis',
  'modelDetail.reviews.count_other': '{count} avis',
  'modelDetail.trend.up': '+{trend} pts (30j)',
  'modelDetail.trend.down': '{trend} pts (30j)',
  'modelDetail.trend.neutral': 'Tendance neutre',
  'modelDetail.metrics.quality': 'Qualité',
  'modelDetail.metrics.speed': 'Vitesse',
  'modelDetail.metrics.costBenefit': 'Rapport qualité-prix',
  'modelDetail.metrics.easeOfUse': "Facilité d'utilisation",
  'modelDetail.distro.title': 'Distribution des notes',
  'modelDetail.distro.lastReview': 'Dernier avis : {date}',
  'modelDetail.info.title': 'Contexte technique',
  'modelDetail.info.noNotes':
    'Aucune note supplémentaire enregistrée pour ce modèle.',
  'modelDetail.info.source': 'Source',
  'modelDetail.info.target': 'Cible',
  'modelDetail.actions.editReview': "Modifier l'avis",
  'modelDetail.actions.startReview': 'Évaluer le modèle',
  'modelDetail.actions.sending': 'Envoi en cours…',
  'modelDetail.actions.verifyEmail': "Vérifier l'e-mail",
  'modelDetail.warning.verifyEmail':
    'Confirmez votre e-mail pour publier ou modifier des avis.',
  'modelDetail.recentReviews.title': 'Avis récents',
  'modelDetail.recentReviews.loading': 'Chargement…',
  'modelDetail.recentReviews.empty':
    "Ce modèle n'a pas encore reçu d'avis publics.",
  'modelDetail.pagination.prev': 'Précédent',
  'modelDetail.pagination.next': 'Suivant',
  'modelDetail.usage.balanced': 'Équilibré',
  'modelDetail.usage.quality_first': 'Qualité',
  'modelDetail.usage.speed_first': 'Vitesse',
  'modelDetail.usage.low_vram': 'VRAM faible',
  'modelDetail.usage.offline_local': 'Local',
  'modelDetail.usage.cloud_pipeline': 'Cloud',
  'resources.empty.title.withQuery': 'Aucun résultat pour « {query} »',
  'resources.empty.title.noQuery': 'Aucun élément trouvé',
  'resources.empty.desc.withQuery':
    "Essayez d'autres mots ou effacez les filtres pour trouver {context}.",
  'resources.empty.desc.noQuery':
    'Ajustez les filtres pour voir les {context} disponibles.',
  'resources.fonts.license.free': 'Gratuite',
  'resources.fonts.license.openSource': 'Open Source',
  'resources.fonts.license.commercial': 'Commerciale',
  'resources.fonts.license.mixed': 'Mixte',
  'resources.fonts.context': 'polices',
  'resources.fonts.placeholder':
    'Saisissez du texte pour prévisualiser les polices...',
  'resources.fonts.results_one': 'police trouvée',
  'resources.fonts.results_other': 'polices trouvées',
  'resources.fonts.previewFallback': "J'arrive pas à y croire !",
  'resources.fonts.sizeAria': 'Aperçu à {size}px',
  'resources.sfx.category.impact': 'Impact',
  'resources.sfx.category.emotion': 'Émotion',
  'resources.sfx.category.ambient': 'Ambiance',
  'resources.sfx.category.action': 'Action',
  'resources.sfx.category.voice': 'Voix',
  'resources.sfx.category.misc': 'Divers',
  'resources.sfx.filterAria': 'Filtrer par catégorie',
  'resources.sfx.filterAll': 'Tous ({count})',
  'resources.sfx.results_one': 'effet sonore',
  'resources.sfx.results_other': 'effets sonores',
  'resources.sfx.context': 'effets sonores',
  'resources.sfx.copyAria': 'Copier « {text} »',
  'resources.communities.platform.forum': 'Forum',
  'resources.communities.results_one': 'communauté',
  'resources.communities.results_other': 'communautés',
  'resources.communities.context': 'communautés',
  'resources.communities.visitAria':
    'Visiter {name} dans un navigateur externe',
  'resources.communities.visit': 'Visiter',
  'resources.tools.category.editing': 'Édition',
  'resources.tools.category.ocr': 'OCR',
  'resources.tools.category.translation': 'Traduction',
  'resources.tools.category.fonts': 'Polices',
  'resources.tools.category.hosting': 'Hébergement',
  'resources.tools.category.utility': 'Utilitaire',
  'resources.tools.filterAll': 'Tous',
  'resources.tools.results_one': 'outil',
  'resources.tools.results_other': 'outils',
  'resources.tools.context': 'outils',
  'resources.tools.free.yes': 'Gratuit',
  'resources.tools.free.no': 'Payant',
  'resources.tools.action.open': 'Ouvrir',
  'resources.tools.action.download': 'Télécharger',
  'feed.roles.raw': 'Fournisseur Raw',
  'feed.roles.cl': 'Cleaner',
  'feed.roles.rd': 'Redrawer',
  'feed.roles.tl': 'Traducteur',
  'feed.roles.pr': 'Relecteur',
  'feed.roles.ts': 'Typesetter',
  'feed.roles.qc': 'Contrôleur qualité',
  'feed.contact.discord': 'Discord',
  'feed.contact.twitter_x': 'Twitter/X',
  'feed.contact.telegram': 'Telegram',
  'feed.contact.email': 'E-mail',
  'feed.contact.whatsapp': 'WhatsApp',
  'feed.contact.instagram': 'Instagram',
  'feed.contact.placeholder.discord':
    "https://discord.gg/... ou nom d'utilisateur",
  'feed.contact.placeholder.twitter_x':
    "nom d'utilisateur ou https://x.com/username",
  'feed.contact.placeholder.telegram': 'https://t.me/... ou @canal',
  'feed.contact.placeholder.email': 'contact@scanlation.com',
  'feed.contact.placeholder.whatsapp': '+33 6 12 34 56 78 ou lien',
  'feed.contact.placeholder.instagram':
    "nom d'utilisateur ou https://instagram.com/username",
  'feed.weekdays.seg': 'Lun',
  'feed.weekdays.ter': 'Mar',
  'feed.weekdays.qua': 'Mer',
  'feed.weekdays.qui': 'Jeu',
  'feed.weekdays.sex': 'Ven',
  'feed.weekdays.sab': 'Sam',
  'feed.weekdays.dom': 'Dim',
  'feed.report.reasons.malicious_link': 'Lien malveillant',
  'feed.report.reasons.spam': 'Spam',
  'feed.report.reasons.impersonation': "Usurpation d'identité",
  'feed.report.reasons.harassment': 'Harcèlement / abus',
  'feed.report.reasons.copyright': "Violation de droits d'auteur",
  'feed.report.reasons.other': 'Autre',
  'feed.modal.closeAria': 'Fermer la fenêtre',
  'feed.feedback.newApplication':
    'Nouvelle candidature reçue dans le Scanlation Feed.',
  'feed.error.loadFailed': 'Échec du chargement du Scanlation Feed.',
  'feed.hero.back': 'Retour au tableau de bord',
  'feed.hero.title': 'Recrutement, Vitrine et Modération',
  'feed.hero.subtitle':
    'Publiez des offres, présentez vos travaux, recevez des candidatures et signalez du contenu suspect.',
  'feed.tab.recruitment': 'Recrutement',
  'feed.tab.showcase': 'Vitrine',
  'feed.tab.moderation': 'Modération',
  'feed.actions.createPost': 'Créer {type}',
  'feed.alert.safety':
    'Utilisez uniquement des réseaux sociaux et contacts légitimes. Les publications suspectes peuvent être signalées.',
  'feed.alert.banPolicy':
    'Les publications malveillantes peuvent entraîner un bannissement permanent par compte, appareil et réseau.',
  'feed.card.recruitmentRecent': 'Recrutements récents',
  'feed.card.showcaseRecent': 'Vitrines récentes',
  'feed.card.moderationQueue': 'File de modération',
  'feed.loading': 'Chargement du fil…',
  'feed.empty.noRecruitment': 'Aucune offre de recrutement trouvée',
  'feed.empty.noShowcase': 'Aucune vitrine trouvée',
  'feed.empty.cleanQueue': 'La file est vide',
  'feed.empty.beFirst': 'Soyez le premier à publier {type} !',
  'feed.empty.noModPosts': 'Aucune publication dans la file de modération.',
  'feed.post.recruitLabel': 'Recrutement',
  'feed.post.showcaseLabel': 'Vitrine',
  'feed.post.rolePayNegotiable': 'À négocier',
  'feed.post.rolePayVolunteer': 'Bénévole',
  'feed.post.actions.apply': 'Postuler',
  'feed.post.actions.report': 'Signaler',
  'feed.post.actions.show': 'Afficher',
  'feed.post.actions.hide': 'Masquer',
  'feed.post.actions.ban': 'Bannir',
  'feed.sidebar.profileTitle': "Profil de l'auteur",
  'feed.sidebar.rulesLabel':
    "J'accepte les règles du fil. Les liens malveillants entraînent un bannissement permanent.",
  'feed.sidebar.webhookLabel': 'Notifications webhook Discord',
  'feed.sidebar.saveProfile': 'Enregistrer le profil',
  'feed.sidebar.inboxTitle': 'Boîte de réception interne',
  'feed.sidebar.yourApplications': 'Vos candidatures',
  'feed.sidebar.noApplications': 'Aucune candidature envoyée.',
  'feed.sidebar.receivedTitle': 'Reçues',
  'feed.sidebar.noReceived': 'Aucune candidature reçue.',
  'feed.sidebar.reportsTitle': 'Signalements',
  'feed.sidebar.noReports': 'Aucun signalement en attente.',
  'feed.sidebar.banTitle': 'Bannissement',
  'feed.sidebar.applyBan': 'Appliquer le bannissement',
  'feed.feedback.postPublishedRecruit': 'Recrutement publié.',
  'feed.feedback.postPublishedShowcase': 'Vitrine publiée.',
  'feed.feedback.reportSent': 'Signalement envoyé à la modération.',
  'feed.feedback.profileUpdated': 'Profil du fil mis à jour.',
  'feed.feedback.applicationSent': 'Candidature envoyée.',
  'feed.feedback.banApplied': 'Bannissement appliqué et sessions révoquées.',
  'feed.feedback.reportUpdated': 'Signalement mis à jour.',
  'feed.feedback.postStatusUpdated':
    'Publication mise à jour au statut {status}.',
  'feed.moderation.notes.resolved': 'Examiné par la modération.',
  'feed.moderation.notes.dismissed': 'Rejeté par la modération.',
  'feed.moderation.banReasonPost': 'Publication modérée : {title}',
  'feed.moderation.targetUserId': 'ID utilisateur cible',
  'feed.moderation.applyBan': 'Appliquer le bannissement',
  'feed.error.roleDuplicate': 'Vous avez déjà ajouté {role}.',
  'feed.error.valuePositive': 'La valeur doit être positive.',
  'feed.error.platformDuplicate': '{platform} déjà ajouté.',
  'feed.error.platformRequired': 'Veuillez renseigner {platform}.',
  'feed.error.saveProfileFailed': "Échec de l'enregistrement du profil.",
  'feed.error.publishFailed': 'Échec de la publication.',
  'feed.error.applyFailed': 'Échec de la candidature.',
  'feed.error.reportFailed': 'Échec du signalement.',
  'feed.error.moderatePostFailed': 'Échec de la modération de la publication.',
  'feed.error.moderateReportFailed': 'Échec de la mise à jour du signalement.',
  'feed.error.banFailed': 'Échec du bannissement.',
  'feed.composer.typeRecruit': 'recrutement',
  'feed.composer.typeShowcase': 'vitrine',
  'feed.composer.placeholder.titleRecruit': 'Ex. : Recherche de traducteurs',
  'feed.composer.placeholder.titleShowcase':
    'Ex. : Nouveau chapitre disponible',
  'feed.composer.placeholder.bodyRecruit':
    'Décrivez le projet et comment le candidat peut contribuer...',
  'feed.composer.placeholder.bodyShowcase':
    'Décrivez la sortie et les informations pertinentes...',
  'feed.composer.placeholder.scanlationName': 'Nom de la scanlation',
  'feed.composer.placeholder.workTitle': "Titre de l'œuvre",
  'feed.composer.placeholder.chapterLabel': 'Ch. 42',
  'feed.composer.placeholder.genres': 'Action, Romance, Fantasy',
  'feed.composer.placeholder.description': 'Décrivez cette sortie...',
  'feed.composer.sections.project': 'Projet',
  'feed.composer.sections.work': 'Œuvre',
  'feed.composer.sections.recruitmentSettings': 'Paramètres de recrutement',
  'feed.composer.toggle.recruiting': 'Recrutement',
  'feed.composer.toggle.recruitingDesc':
    'Votre scan accepte-t-il de nouveaux membres ?',
  'feed.composer.toggle.paidWork': 'Travail rémunéré',
  'feed.composer.toggle.paidWorkDesc':
    'Les membres recevront-ils une rémunération ?',
  'feed.composer.requirements.label': 'Exiger des candidats :',
  'feed.composer.requirements.portfolio': 'Portfolio',
  'feed.composer.requirements.experience': 'Expérience',
  'feed.composer.requirements.availability': 'Disponibilité',
  'feed.composer.requirements.contact': 'Contact',
  'feed.composer.availability.minRequired': 'Disponibilité minimale requise :',
  'feed.composer.availability.hoursPerWeek': 'Heures par semaine',
  'feed.composer.availability.daysOptional': 'Jours (optionnel)',
  'feed.composer.availability.descriptionOptional': 'Description (optionnel)',
  'feed.composer.availability.placeholder':
    "J'ai besoin de quelqu'un qui livre des chapitres chaque semaine...",
  'feed.composer.sections.roles': 'Rôles',
  'feed.composer.sections.rolesSub': '(ajoutez ceux que vous recherchez)',
  'feed.composer.roles.roleLabel': 'Rôle',
  'feed.composer.roles.valueLabel': 'Montant ($)',
  'feed.composer.roles.valueHint': '(par chapitre)',
  'feed.composer.roles.add': 'Ajouter',
  'feed.composer.roles.allAdded': 'Tous les rôles ajoutés',
  'feed.composer.roles.addBtn': 'Ajouter un rôle',
  'feed.composer.social.title': 'Réseaux sociaux',
  'feed.composer.social.sub': '(au moins un)',
  'feed.composer.social.platform': 'Plateforme',
  'feed.composer.social.user': 'Utilisateur',
  'feed.composer.social.url': 'URL/Lien',
  'feed.composer.social.allAdded': 'Toutes les plateformes ajoutées',
  'feed.composer.social.addBtn': 'Ajouter un réseau social',
  'feed.composer.sections.media': 'Médias',
  'feed.composer.media.uploading': 'Envoi en cours...',
  'feed.composer.media.uploadBtn': 'Uploader via Imgur',
  'feed.apply.title': 'Envoyer une candidature',
  'feed.apply.message': 'Message',
  'feed.apply.messagePlaceholder':
    'Présentez-vous et expliquez pourquoi vous souhaitez rejoindre...',
  'feed.apply.preferredContact': 'Contact préféré',
  'feed.apply.portfolio': 'Portfolio / liens',
  'feed.apply.portfolioPlaceholder': 'Un lien par ligne...',
  'feed.report.title': 'Signaler la publication',
  'feed.report.reason': 'Motif',
  'feed.report.details': 'Détails',
  'feed.report.detailsPlaceholder': 'Décrivez le problème...',
  'feed.report.send': 'Envoyer le signalement',
  'freeProvider.manager.titleTranslation': 'Fournisseurs GRATUITS (Traduction)',
  'freeProvider.manager.titleOcr': 'Fournisseurs GRATUITS (OCR)',
  'auth.password.hide': 'Masquer le mot de passe',
  'auth.password.show': 'Afficher le mot de passe',
  'modelManager.stage.cleanImage': "Nettoyer l'image",
  'modelManager.stage.detectText': 'Détecter le texte',
  'modelManager.stage.recognizeText': 'Reconnaître le texte',
  'modelManager.stage.segmentText': 'Segmenter le texte',
  'fillStylePopover.gradient': 'Dégradé',
  'fillStylePopover.hint.gradient':
    'Couleur unie ou dégradé dans le même sélecteur.',
  'fillStylePopover.hint.solid': 'Sélectionnez une couleur unie.',
  'klSlider.resetValue': 'Réinitialiser la valeur',
  'dashboard.aio.translation.llm.temperature': 'Température',
  'dashboard.aio.translation.llm.topP': 'Top P',
  'dashboard.aio.translation.llm.maxTokens': 'Tokens max.',
  'dashboard.enhance.modeTag': 'Amélioration',
  'dashboard.enhance.scale.2x': '2×',
  'dashboard.enhance.scale.4x': '4×',
  'optimizer.hero.title': 'Optimiseur de chapitre',
  'optimizer.hero.desc':
    "Optimisez les pages finales pour le web, la lecture ou l'archivage.",
  'optimizer.hero.pages': 'Pages',
  'optimizer.hero.savings': 'Économies',
  'optimizer.hero.saved': 'Économisé',
  'optimizer.hero.output': 'Sortie',
  'optimizer.panel.presets': 'Préréglages',
  'optimizer.panel.output': 'Sortie',
  'optimizer.panel.dimensions': 'Dimensions',
  'optimizer.panel.filters': 'Filtres',
  'optimizer.panel.preview': 'Aperçu',
  'optimizer.presets.webLight': 'Web léger',
  'optimizer.presets.webLight.desc': 'Léger pour un chargement rapide',
  'optimizer.presets.reading': 'Lecture',
  'optimizer.presets.reading.desc': 'Qualité équilibrée pour les lecteurs',
  'optimizer.presets.archive': 'Archive',
  'optimizer.presets.archive.desc': 'Sans perte pour la conservation',
  'optimizer.presets.social': 'Réseaux sociaux',
  'optimizer.presets.social.desc': 'Optimisé pour les réseaux sociaux',
  'optimizer.presets.custom': 'Personnalisé',
  'optimizer.presets.custom.desc': 'Vos propres paramètres',
  'optimizer.config.format': 'Format',
  'optimizer.config.quality': 'Qualité',
  'optimizer.config.resize': 'Redimensionner',
  'optimizer.config.trimBorders': 'Rogner les bordures',
  'optimizer.config.trimTolerance': 'Tolérance de rognage',
  'optimizer.config.maxWidth': 'Largeur max.',
  'optimizer.config.maxHeight': 'Hauteur max.',
  'optimizer.config.sharpen': 'Netteté',
  'optimizer.config.sharpenStrength': 'Intensité de la netteté',
  'optimizer.config.grayscale': 'Niveaux de gris',
  'optimizer.config.autoLevels': 'Niveaux automatiques',
  'optimizer.action.optimizing': 'Optimisation en cours...',
  'optimizer.action.folder': 'Dossier',
  'optimizer.preview.generating': "Génération de l'aperçu...",
  'optimizer.preview.before': 'Avant',
  'optimizer.preview.after': 'Après',
  'optimizer.preview.reduction': 'Réduction',
  'optimizer.preview.dimensions': 'Dimensions',
  'optimizer.preview.compare': 'Comparer',
  'optimizer.preview.original': 'Original',
  'optimizer.preview.optimized': 'Optimisé',
  'optimizer.preview.empty': "Chargez des images pour utiliser l'optimiseur.",
  'optimizer.results.title': 'Résultats',
  'optimizer.results.empty': "Lancez l'optimisation pour voir les résultats.",
  'optimizer.results.download': 'Télécharger le fichier',
  'optimizer.error.worker':
    "Worker indisponible dans l'optimiseur de chapitre.",
  'optimizer.error.failed': "L'optimiseur de chapitre a échoué.",
  'optimizer.error.preview': "Échec de l'aperçu de l'optimiseur.",
  'optimizer.config.brightness': 'Luminosité',
  'optimizer.config.contrast': 'Contraste',
  'optimizer.config.noiseReduction': 'Réduction du bruit',
  'optimizer.config.noiseReductionStrength':
    'Intensité de la réduction du bruit',
  'optimizer.config.rotation': 'Rotation',
  'optimizer.config.rotationNone': 'Aucune',
  'optimizer.config.renamePattern': 'Modèle de renommage',
  'optimizer.config.renameHint':
    "Utilisez {name} pour le nom original, {index} pour un numéro séquentiel, {ext} pour l'extension.",
  'optimizer.panel.advanced': 'Avancé',
  'optimizer.export.folderSuccess':
    "L'optimiseur de chapitre a exporté les fichiers vers le dossier sélectionné.",
  'optimizer.export.zipSuccess':
    "Archive de l'optimiseur de chapitre générée avec succès.",
  'resources.communities.platform.discord': 'Discord',
  'resources.communities.platform.reddit': 'Reddit',
  'resources.communities.platform.website': 'Site web',
  'resources.communities.platform.telegram': 'Telegram',
  'dashboard.cleaner.modeTag': 'Cleaner',
  'stitch.error.loadImage': "Échec du chargement de l'image.",
  'stitch.error.initCanvas':
    "Échec de l'initialisation du canevas de l'assembleur.",
  'stitch.error.initTempCanvas':
    "Échec de la préparation de l'image intermédiaire de l'assembleur.",
  'stitch.error.generateBlob':
    "Échec de la génération du blob de l'assembleur.",
  'stitch.error.cancelled': 'Rendu annulé.',
  'stitch.error.workerFailed':
    "Échec de l'exécution du worker de l'assembleur.",
  'stitch.error.generatePreview':
    "Échec de la génération de l'aperçu de l'assembleur.",
  'stitch.error.exportBatch': "Échec de l'export du lot de l'assembleur.",
  'stitch.error.generateZip': "Échec de la génération du ZIP de l'assembleur.",
  'stitch.error.saveFolder':
    "Échec de l'enregistrement des lots dans le dossier.",
  'dashboard.footer.runtime.fallback.label': 'Fallback',
  'watermark.blend.normal': 'Normal',
  'watermark.blend.multiply': 'Multiplier',
  'watermark.blend.screen': 'Écran',
  'watermark.blend.overlay': 'Incrustation',
  'watermark.blend.softLight': 'Lumière tamisée',
  'watermark.blend.hardLight': 'Lumière crue',
  'watermark.blend.colorDodge': 'Densité couleur -',
  'watermark.blend.colorBurn': 'Densité couleur +',
  'watermark.panel.shadow': "Couche d'ombre",
  'watermark.shadow.enable': "Activer l'ombre d'arrière-plan",
  'watermark.shadow.blur': 'Flou',
  'watermark.shadow.opacity': 'Opacité',
  'watermark.shadow.color': 'Couleur',
  'watermark.shadow.offsetY': 'Décalage Y',
  'watermark.panel.textAvoidance': 'Évitement du texte',
  'watermark.textAvoidance.enable': 'Éviter les zones de texte',
  'watermark.textAvoidance.desc':
    'Utilise la détection de texte par IA pour empêcher les filigranes de chevaucher le texte dans les images.',
  'watermark.textAvoidance.detecting': 'Détection...',
  'watermark.textAvoidance.detectCurrent': "Détecter l'actuelle",
  'watermark.textAvoidance.detectAll': 'Détecter tout',
  'watermark.textAvoidance.detected': '{{count}} zones de texte détectées.',
  'watermark.textAvoidance.detectedAll':
    "{{count}} zones de texte détectées sur l'ensemble des images.",
  'watermark.textAvoidance.failed': 'Échec de la détection du texte.',
  'watermark.textAvoidance.zonesFound': 'zones',
  'watermark.textAvoidance.showOverlay': 'Afficher les zones',
  'watermark.text.shadowBlur': "Flou de l'ombre",
  'watermark.text.shadowColor': "Couleur de l'ombre",
  'watermark.distribution.offsetX': 'Décalage X',
  'watermark.distribution.offsetY': 'Décalage Y',
  'watermark.distribution.density': 'Densité',
  'dashboard.dock.tooltip.hoverHint': "Maintenez le curseur pour voir l'aperçu",
  'dashboard.dock.config.ariaLabel': "Configuration de l'outil actif",
  'dashboard.dock.config.closeTitle': 'Fermer la configuration',
  'dashboard.dock.config.closeAriaLabel': "Fermer la configuration de l'outil",
  'dashboard.dock.areaSelection.sectionTitle': 'Sélection de zone',
  'dashboard.dock.areaSelection.shapeLabel': 'Forme de la nouvelle sélection',
  'dashboard.dock.areaSelection.optionAuto': 'Auto',
  'dashboard.dock.areaSelection.optionSquare': 'Rectangulaire',
  'dashboard.dock.areaSelection.optionRounded': 'Elliptique',
  'dashboard.dock.areaSelection.hintAuto': 'Détection automatique : {kind}.',
  'dashboard.dock.areaSelection.hintFixed':
    'Nouvelles régions créées en {mode}.',
  'dashboard.dock.areaSelection.btnDuplicate': 'Dupliquer',
  'dashboard.dock.areaSelection.btnToAuto': '→ Auto',
  'dashboard.dock.areaSelection.btnToSquare': '→ Rectangulaire',
  'dashboard.dock.areaSelection.btnToRounded': '→ Elliptique',
  'dashboard.dock.segment.brushTitle': 'Pinceau de segmentation',
  'dashboard.dock.segment.eraserTitle': 'Gomme de segmentation',
  'dashboard.dock.segment.sizeLabel': 'Taille',
  'dashboard.dock.segment.hint':
    'Ajustez le rayon pour modifier les zones segmentées.',
  'dashboard.dock.imageTool.paintTitle': 'Pinceau',
  'dashboard.dock.imageTool.eraserTitle': 'Gomme',
  'dashboard.dock.imageTool.healingTitle': 'Pinceau correcteur',
  'dashboard.dock.imageTool.sizeLabel': 'Taille',
  'dashboard.dock.imageTool.opacityLabel': 'Opacité',
  'dashboard.dock.imageTool.blurLabel': 'Flou',
  'dashboard.dock.imageTool.colorLabel': 'Couleur',
  'dashboard.dock.imageTool.colorAriaLabel': 'Couleur du pinceau',
  'dashboard.dock.magicWand.title': 'Baguette magique',
  'dashboard.dock.magicWand.toleranceLabel': 'Tolérance',
  'dashboard.dock.magicWand.healingBtnTitle':
    "Appliquer l'inpainting à la sélection de la baguette",
  'dashboard.dock.magicWand.healingBtnBusy': 'Application…',
  'dashboard.dock.magicWand.healingBtn': 'Correction',
  'dashboard.dock.magicWand.clearBtn': 'Effacer',
  'dashboard.dock.imageTool.modelHint': 'Modèle : ',
  'dashboard.dock.palette.ariaLabel': "Outils d'image manuels",
  'dashboard.dock.config.closeLabel': 'Fermer la config.',
  'dashboard.dock.config.openLabel': 'Ouvrir la config.',
  'dashboard.dock.config.badge': 'Config.',
  'dashboard.dock.config.description':
    "Ouvre le panneau contextuel de l'outil actif pour ajuster forme, taille, opacité, tolérance et autres réglages fins.",
  'dashboard.dock.config.disabledReason':
    'Activez un outil avec des paramètres modifiables pour ouvrir la configuration.',
  'dashboard.dock.divider.reg': 'Rég',
  'dashboard.dock.areaSelect.ariaLabel': 'Sélectionner une zone',
  'dashboard.dock.areaSelect.title': 'Sélectionner une zone',
  'dashboard.dock.areaSelect.description':
    "Créez, ajustez et affinez les régions de texte dans l'aperçu. Idéal pour corriger les bulles détectées avant l'OCR, la traduction ou le rendu.",
  'dashboard.dock.areaSelect.badge': 'Rég',
  'dashboard.dock.areaSelect.disabledReason':
    'Disponible dans les étapes Détection et Rendu du mode AIO manuel.',
  'dashboard.dock.clearPage.ariaLabel': 'Effacer toutes les régions',
  'dashboard.dock.clearPage.title': 'Effacer la page',
  'dashboard.dock.clearPage.description':
    "Supprime toutes les régions de cette page d'un coup pour repartir de zéro sans résidus.",
  'dashboard.dock.clearPage.badge': 'Réinit.',
  'dashboard.dock.clearPage.disabledReason':
    "Doit être en mode Détection/Rendu et avoir déjà des régions créées sur l'image active.",
  'dashboard.dock.divider.seg': 'Seg',
  'dashboard.dock.segBrush.ariaLabel': 'Pinceau de zone segmentée',
  'dashboard.dock.segBrush.title': 'Pinceau de segmentation',
  'dashboard.dock.segBrush.description':
    'Étend le masque de segmentation pour récupérer les lettres, contours ou morceaux de bulles qui ont été oubliés.',
  'dashboard.dock.segBrush.badge': 'Seg',
  'dashboard.dock.segBrush.disabledReason':
    "Disponible pendant l'étape Segmenter le texte.",
  'dashboard.dock.segEraser.ariaLabel': 'Gomme de zone segmentée',
  'dashboard.dock.segEraser.title': 'Gomme de segmentation',
  'dashboard.dock.segEraser.description':
    'Affine le masque en supprimant les sélections excédentaires, fuites et artefacts qui ne devraient pas être inclus dans le nettoyage.',
  'dashboard.dock.segEraser.badge': 'Seg',
  'dashboard.dock.segEraser.disabledReason':
    "Disponible pendant l'étape Segmenter le texte.",
  'dashboard.dock.divider.img': 'Img',
  'dashboard.dock.paint.ariaLabel': 'Pinceau',
  'dashboard.dock.paint.title': 'Pinceau',
  'dashboard.dock.paint.description':
    "Peignez sur les artefacts, défauts d'inpainting ou détails nécessitant une micro-correction directement sur l'image.",
  'dashboard.dock.paint.badge': 'Img',
  'dashboard.dock.paint.disabledReason':
    'Passez en mode manuel et sélectionnez une image active à modifier.',
  'dashboard.dock.paintEraser.ariaLabel': 'Gomme de peinture',
  'dashboard.dock.paintEraser.title': 'Gomme',
  'dashboard.dock.paintEraser.description':
    'Efface uniquement le calque de peinture manuelle pour annuler les modifications sans perdre le reste des détections et masques.',
  'dashboard.dock.paintEraser.badge': 'Img',
  'dashboard.dock.paintEraser.disabledReason':
    'Passez en mode manuel et sélectionnez une image active à modifier.',
  'dashboard.dock.wand.ariaLabel': 'Baguette magique',
  'dashboard.dock.wand.title': 'Baguette magique',
  'dashboard.dock.wand.description':
    'Sélectionne rapidement une zone contiguë par couleur/tolérance pour une correction précise ou la suppression de résidus.',
  'dashboard.dock.wand.badge': 'Img',
  'dashboard.dock.wand.disabledReason':
    'Passez en mode manuel et sélectionnez une image active à modifier.',
  'dashboard.dock.healing.ariaLabel': 'Pinceau correcteur',
  'dashboard.dock.healing.title': 'Pinceau correcteur',
  'dashboard.dock.healing.description':
    'Applique un inpainting localisé sur les défauts, bords cassés et résidus de texte tout en préservant la texture environnante de manière plus naturelle.',
  'dashboard.dock.healing.badge': 'Img',
  'dashboard.dock.healing.disabledReason':
    'Passez en mode manuel et sélectionnez une image active à modifier.',
  'dashboard.dock.clearPaint.ariaLabel': 'Effacer la peinture',
  'dashboard.dock.clearPaint.title': 'Effacer la peinture',
  'dashboard.dock.clearPaint.description':
    "Efface l'intégralité du calque de peinture manuelle de l'image active sans réinitialiser les autres corrections ni l'historique de l'étape.",
  'dashboard.dock.clearPaint.badge': 'Réinit.',
  'dashboard.dock.clearPaint.disabledReason':
    "Apparaît uniquement lorsque l'image active a déjà de la peinture manuelle appliquée.",
  'dashboard.dock.resetEdits.ariaLabel':
    'Réinitialiser toutes les modifications',
  'dashboard.dock.resetEdits.title': 'Réinitialiser les modifications',
  'dashboard.dock.resetEdits.description':
    "Ramène l'image active à l'état initial de l'étape manuelle, en supprimant peinture, correction, sélection baguette et remplacements locaux.",
  'dashboard.dock.resetEdits.badge': 'Réinit.',
  'dashboard.dock.resetEdits.disabledReason':
    "Disponible lorsque l'image active a déjà reçu une intervention manuelle.",
  'modelManager.stage.automaticAiClean': 'Nettoyage IA automatique',
  'resources.fonts.downloadLabel': 'Télécharger',
  'dashboard.sidebar.supportedFormats':
    'JPG, PNG, WEBP, ZIP, PDF, CBZ, CB7, PSD',
  'dashboard.cleaner.ocr.label': 'OCR',
  'dashboard.cleaner.ai.defaultProvider': 'Cloud / API / IA',
  'bugReport.screenshot.alt': "Capture d'écran",
  'pageTransition.loading.ariaLabel': 'Chargement',
  'watermark.text.placeholder': 'KŌMA Studio',
  'watermark.logo.alt': 'Logo',
  'dashboard.textDetection.regionActions.aria': 'Actions de la région',
  'dashboard.textDetection.manualModeRequired': 'Mode manuel requis',
  'dashboard.textDetection.removeRegion': 'Supprimer la région',
  'dashboard.renderText.rewind.title': 'Revenir en arrière sur cette image',
  'dashboard.renderText.forward.title': 'Avancer sur cette image',
  'dashboard.renderText.noHistory': 'Aucun historique AIO pour cette image',
  'dashboard.renderText.editPlaceholder': 'Saisissez le texte final...',
  'dashboard.renderText.editAria': 'Modifier le texte rendu',
  'dashboard.renderText.removeSelection.title': 'Supprimer la sélection',
  'dashboard.renderText.regionActions.aria': 'Actions de la région',
  'dashboard.pipeline.prevStep.title':
    "Revenir à l'étape précédente du pipeline AIO",
  'dashboard.pipeline.nextStep.title':
    "Passer à l'étape suivante du pipeline AIO",
  'dashboard.pipeline.runStep.title':
    "Exécuter uniquement l'étape actuelle pour l'image sélectionnée",
  'dashboard.pipeline.skipStep.title':
    "Ignorer l'étape actuelle et débloquer la suivante",
  'dashboard.typesetter.applyStyleAll.title':
    'Appliquer le style de la sélection actuelle à toutes les régions',
  'auth.error.internetRequired':
    "Un accès Internet est requis pour se connecter à l'application.",
  'auth.error.mandatoryUpdate':
    "Mise à jour obligatoire disponible. Mettez à jour l'application pour continuer.",
  'dashboard.textDetection.noTextRecognized': 'Aucun texte reconnu',
  'dashboard.textDetection.noTranslation': 'Aucune traduction disponible',
  'dashboard.textDetection.noNt': 'Aucune NT disponible',
  'dashboard.renderText.dblClickToEdit': 'double-cliquez pour modifier',
  'dashboard.renderText.renderNotApplied': 'rendu non appliqué à cette étape',
  'dashboard.status.stageLabelTranslation': 'Traduction',
  'dashboard.status.profilesPersistedDesktopSecure':
    'Profils personnalisés enregistrés sur le bureau avec stockage sécurisé.',
  'dashboard.status.profilesPersistedDesktopLocal':
    'Profils personnalisés enregistrés sur le bureau sans chiffrement natif disponible.',
  'dashboard.status.profilesPersistedBrowser':
    'Profils personnalisés enregistrés dans le navigateur local de cet appareil.',
  'dashboard.status.aioScopeManual': 'AIO manuel',
  'dashboard.status.aioScopeAuto': 'AIO automatique',
  'dashboard.status.cleanerSelectProfileFirst':
    "Sélectionnez un profil visuel enregistré pour l'utiliser avec le nettoyage IA automatique.",
  'dashboard.status.cleanerProfileNotFound':
    'Profil visuel introuvable. Rechargez et réessayez.',
  'dashboard.status.cleanerProfileInUse':
    "Profil visuel en cours d'utilisation pour le nettoyage IA automatique : {label}.",
  'dashboard.status.cleanerSelectValidModel':
    'Sélectionnez un modèle valide pour le nettoyage IA automatique.',
  'dashboard.status.cleanerProfileSaved':
    'Profil visuel enregistré et sélectionné pour le nettoyage IA automatique : {label}.',
  'dashboard.status.cleanerSelectProfileToRemove':
    'Sélectionnez un profil visuel enregistré à supprimer.',
  'dashboard.status.customProfilePendingSync':
    'Profil personnalisé en attente de synchronisation locale.',
  'dashboard.status.customProfileOcrPendingSync':
    'Profil OCR personnalisé en attente de synchronisation locale.',
  'dashboard.status.presetAppliedToSelection':
    'Préréglage « {name} » appliqué à la sélection actuelle.',
  'dashboard.status.legacyPresetNotFound':
    'Préréglage visuel hérité {modeKey} introuvable.',
  'dashboard.status.presetAppliedShort':
    'Préréglage « {name} » appliqué à la sélection.',
  'dashboard.status.presetAppliedToImage':
    "Préréglage « {name} » appliqué à l'image active.",
  'dashboard.status.typographerSelectionDuplicated':
    'Sélection dupliquée dans le typesetter.',
  'dashboard.status.autoShapeApplied': 'Forme automatique appliquée : {shape}.',
  'dashboard.status.renderStyleAppliedAll':
    'Style de rendu appliqué à toutes les sélections sur toutes les images.',
  'dashboard.status.canvasInitFailed':
    "Échec de l'initialisation du canevas de composition manuelle.",
  'dashboard.status.cleanerCanvasInitFailed':
    "Échec de l'initialisation du canevas de composition manuelle du Cleaner.",
  'dashboard.status.wandPrepFailed':
    'Échec de la préparation de la baguette magique.',
  'dashboard.status.wandSelectionUpdated':
    "Sélection de la baguette mise à jour. Utilisez la correction pour appliquer l'inpainting.",
  'dashboard.status.wandNoArea':
    "La baguette n'a pas trouvé de zone compatible pour la sélection.",
  'dashboard.status.wandExecFailed':
    "Échec de l'exécution de la baguette magique.",
  'dashboard.status.cleanerWandPrepFailed':
    'Échec de la préparation de la baguette magique du Cleaner.',
  'dashboard.status.cleanerWandSelectionUpdated':
    "Sélection de la baguette du Cleaner mise à jour. Utilisez la correction pour appliquer l'inpainting.",
  'dashboard.status.cleanerWandNoArea':
    "La baguette du Cleaner n'a pas trouvé de zone compatible pour la sélection.",
  'dashboard.status.cleanerWandExecFailed':
    "Échec de l'exécution de la baguette magique du Cleaner.",
  'dashboard.status.healingInvalidResponse':
    "Réponse invalide lors de l'application du pinceau correcteur.",
  'dashboard.status.cleanerHealingInvalidResponse':
    "Réponse invalide lors de l'application du pinceau correcteur dans le Cleaner.",
  'dashboard.status.cleanerHealingConnectFailed':
    "Le pinceau correcteur du Cleaner n'a pas pu se connecter au backend ({url}). Vérifiez que le mini-backend est actif.",
  'dashboard.status.cleanerHealingFailed':
    "Échec de l'application du pinceau correcteur dans le Cleaner.",
  'dashboard.status.wandNoSelectionForHealing':
    'Aucune sélection de baguette pour appliquer la correction.',
  'dashboard.status.renderCanvasInitFailed':
    "Échec de l'initialisation du canevas de rendu.",
  'dashboard.status.aioCompleteAdjust':
    '{message} Ajustez manuellement si nécessaire.',
  'dashboard.status.aioAborted': 'Exécution AIO annulée.',
  'dashboard.alert.importWorkspaceConfirm':
    "L'importation de cet espace de travail remplacera l'espace de travail actuel en mémoire. Voulez-vous continuer ?",
  'dashboard.alert.clearAutosaveConfirm':
    'Effacer la sauvegarde automatique locale supprime le dernier espace de travail enregistré sur ce PC pour cet utilisateur. Continuer ?',
  'dashboard.alert.closeWorkspaceConfirm':
    "Fermer l'espace de travail actuel ? Cela supprimera toutes les images chargées et la sauvegarde automatique locale. Cette action est irréversible.",
  'dashboard.status.workspacePendingChanges':
    "L'espace de travail contient des modifications en attente.",
  'dashboard.status.toolSelectArea': 'Sélectionner une zone',
  'dashboard.status.toolSegmentBrush': 'Pinceau de segmentation',
  'dashboard.status.toolSegmentEraser': 'Gomme de segmentation',
  'dashboard.alert.emailPendingTitle': 'E-mail en attente de confirmation',
  'dashboard.alert.emailPendingText':
    'Confirmez votre e-mail pour effectuer des actions de traitement.',
  'dashboard.status.typographerSession': 'Session Typesetter',
  'dashboard.status.cleanerMeta':
    'OCR : {ocrCount} • Segmenté : {segmentedCount} • Nettoyé : {cleaned}',
  'dashboard.status.metaOk': 'ok',
  'dashboard.status.metaPending': 'en attente',
  'dashboard.status.cleanerRunFirst':
    "Exécutez le Cleaner pour générer l'OCR, la segmentation et une image nettoyée.",
  'dashboard.status.translatorMeta':
    'Détection : {detected} • OCR : {ocr} • Traduction : {translated}',
  'dashboard.status.translatorRunFirst':
    'Exécutez le traducteur visuel pour détecter, reconnaître et traduire.',
  'dashboard.status.localModelDownloadHint':
    "Les modèles locaux sont téléchargés à la demande ; les modèles cloud/API continuent d'utiliser une clé.",
  'dashboard.status.selectionTextModeAria':
    'Mode texte de la sélection actuelle',
  'dashboard.status.translatorUsesAioModel':
    "Le traducteur utilise la même sélection de modèle que l'AIO ; relancez après avoir changé de modèle.",
  'dashboard.status.translatorLocalModelIncompatible':
    'Le modèle local actuel ne prend pas en charge la paire de langues du traducteur. Choisissez un autre modèle ou utilisez le cloud.',
  'dashboard.status.stitchLastMoved': 'Dernière image envoyée au lot suivant.',
  'dashboard.status.stitchFirstPulled':
    'Première image du lot suivant ajoutée au lot actuel.',
  'auth.error.generic': 'Erreur {status}',
  'auth.error.desktopBridgeUnavailable':
    "Pont d'authentification bureau indisponible.",
  'dashboard.status.modeLabel': 'Mode',
  'dashboard.status.selectedLabel': 'Sélectionné',
  'dashboard.status.selectBoxInPreview': "Sélectionnez une zone dans l'aperçu.",
  'dashboard.status.selectTranslatorModel':
    'Sélectionnez un modèle local ou cloud pour traduire dans le traducteur.',
  'dashboard.error.loadHardwareFailed':
    'Échec du chargement du matériel local.',
  'dashboard.error.healingBrushFailed':
    'Échec du pinceau correcteur : {message}',
  'dashboard.status.healingBrushApplyFailed':
    "Échec de l'application du pinceau correcteur.",
  'dashboard.error.cleanerHealingBrushFailed':
    'Échec du pinceau correcteur du Cleaner : {message}',
  'dashboard.status.aioExecutionFailed': "Échec de l'exécution AIO.",
  'dashboard.status.autosaveSaveFailed':
    'Échec de la sauvegarde automatique locale.',
  'dashboard.status.workspaceExportFailed':
    "Échec de l'export de l'espace de travail.",
  'dashboard.status.workspaceImportFailed':
    "Échec de l'import de l'espace de travail.",
  'dashboard.status.autosaveClearFailed':
    "Échec de l'effacement de la sauvegarde automatique locale.",
  'dashboard.status.noModelSelected': 'Aucun modèle sélectionné.',
  'dashboard.status.aiCleanModelSelected':
    'Modèle sélectionné pour le nettoyage IA automatique : {model}',
  'dashboard.status.selectionMode': 'Mode de sélection',
  'dashboard.status.workspaceRestored': 'Espace de travail restauré.',
  'dashboard.status.workspaceRestoredFromAutosave':
    'Espace de travail restauré depuis la sauvegarde automatique locale.',
  'dashboard.aio.skip': 'Ignorer',
  'dashboard.aio.imageLabel': 'Image :',
  'dashboard.aio.stepLabel': 'Étape :',
  'dashboard.aio.historyHint': 'Étape : {label} ({current}/{total})',
  'dashboard.typo.fontsUpdating': 'Mise à jour…',
  'dashboard.typo.updateFonts': 'Mettre à jour les polices',
  'dashboard.typo.importFontTitle': 'Importer une police personnalisée',
  'dashboard.typo.desktopOnly': 'Application bureau uniquement',
  'dashboard.typo.fontImporting': 'Importation…',
  'dashboard.typo.importFont': 'Importer une police',
  'dashboard.typo.applyStyleToAll': 'Appliquer le style à tout',
  'dashboard.typo.fontControlsHint':
    "Les contrôles de police/couleur/alignement se trouvent dans le dock contextuel de l'overlay. Raccourci :",
  'dashboard.aio.languageLabel': 'Langue :',
  'shortcuts.category.global': 'Global',
  'shortcuts.category.modes': 'Modes',
  'shortcuts.category.typesetter': 'Typesetter',
  'shortcuts.noShortcut': 'Aucun raccourci',
  'shortcuts.openShortcutModal.label': 'Ouvrir le centre des raccourcis',
  'shortcuts.openShortcutModal.description':
    'Ouvre la fenêtre de raccourcis et de configuration.',
  'shortcuts.toggleToolsPanel.label': "Afficher/masquer le panneau d'outils",
  'shortcuts.toggleToolsPanel.description':
    "Bascule la visibilité du panneau d'outils.",
  'shortcuts.rotateActiveImage.label': "Faire pivoter l'image active",
  'shortcuts.rotateActiveImage.description':
    "Fait pivoter l'image sélectionnée de 90 degrés.",
  'shortcuts.workspaceSave.label': "Sauvegarder l'espace de travail local",
  'shortcuts.workspaceSave.description':
    "Force une sauvegarde automatique locale de l'espace de travail actuel.",
  'shortcuts.workspaceUndo.label': "Annuler dans l'espace de travail",
  'shortcuts.workspaceUndo.description':
    "Annule la dernière modification dans l'espace de travail actuel.",
  'shortcuts.workspaceRedo.label': "Rétablir dans l'espace de travail",
  'shortcuts.workspaceRedo.description':
    "Rétablit la dernière modification annulée dans l'espace de travail actuel.",
  'shortcuts.zoomIn.label': 'Zoomer',
  'shortcuts.zoomIn.description':
    "Effectue un zoom avant sur l'étape actuelle.",
  'shortcuts.zoomOut.label': 'Dézoomer',
  'shortcuts.zoomOut.description':
    "Effectue un zoom arrière sur l'étape actuelle.",
  'shortcuts.setViewPaginated.label': 'Vue paginée',
  'shortcuts.setViewPaginated.description': 'Passe en vue paginée.',
  'shortcuts.setViewLongStrip.label': 'Vue en bande longue',
  'shortcuts.setViewLongStrip.description': 'Passe en vue en bande longue.',
  'shortcuts.setModeOrganize.label': 'Mode Organisation',
  'shortcuts.setModeOrganize.description': 'Passe en mode Organisation.',
  'shortcuts.setModeAio.label': 'Mode AIO',
  'shortcuts.setModeAio.description': 'Passe en mode AIO.',
  'shortcuts.setModeCleaner.label': 'Mode Cleaner / Redrawer',
  'shortcuts.setModeCleaner.description': 'Passe en mode Cleaner / Redrawer.',
  'shortcuts.setModeTypesetter.label': 'Mode Typesetter',
  'shortcuts.setModeTypesetter.description': 'Passe en mode Typesetter.',
  'shortcuts.setModeTranslator.label': 'Mode Traducteur',
  'shortcuts.setModeTranslator.description': 'Passe en mode Traducteur.',
  'shortcuts.setModeRaw.label': 'Mode Fournisseur Raw',
  'shortcuts.setModeRaw.description': 'Passe en mode Fournisseur Raw.',
  'shortcuts.setModeProofreader.label': 'Mode Relecteur / QC',
  'shortcuts.setModeProofreader.description': 'Passe en mode Relecteur / QC.',
  'shortcuts.setModeStitch.label': 'Mode Assemblage',
  'shortcuts.setModeStitch.description': 'Passe en mode Assemblage.',
  'shortcuts.setModeSplit.label': 'Mode Découpe intelligente',
  'shortcuts.setModeSplit.description': 'Passe en mode Découpe intelligente.',
  'shortcuts.setModeWatermark.label': 'Mode Filigrane',
  'shortcuts.setModeWatermark.description': 'Passe en mode Filigrane.',
  'shortcuts.setModeEnhance.label': "Mode Amélioration d'image",
  'shortcuts.setModeEnhance.description': "Passe en mode Amélioration d'image.",
  'shortcuts.setModeGuides.label': 'Mode Guides',
  'shortcuts.setModeGuides.description': 'Passe en mode Guides.',
  'shortcuts.setModeResources.label': 'Mode Ressources',
  'shortcuts.setModeResources.description': 'Passe en mode Ressources.',
  'shortcuts.applyText.label': 'Appliquer le texte',
  'shortcuts.applyText.description':
    "Applique l'élément de file sélectionné dans le Typesetter ou le rendu manuel AIO.",
  'shortcuts.nextRegion.label': 'Sélectionner la région suivante',
  'shortcuts.nextRegion.description':
    "Déplace la sélection vers la région suivante dans le Typesetter ou l'AIO manuel.",
  'shortcuts.previousRegion.label': 'Sélectionner la région précédente',
  'shortcuts.previousRegion.description':
    "Déplace la sélection vers la région précédente dans le Typesetter ou l'AIO manuel.",
  'shortcuts.toggleMultiBubble.label': 'Basculer multi-bulles',
  'shortcuts.toggleMultiBubble.description':
    "Active/désactive le regroupement multi-bulles dans le Typesetter ou l'AIO manuel.",
  'shortcuts.saveSnapshot.label': 'Enregistrer un instantané',
  'shortcuts.saveSnapshot.description':
    'Enregistre un instantané de la session Typesetter ou AIO manuel.',
  'shortcuts.detectShapes.label': 'Détecter/affiner la forme',
  'shortcuts.detectShapes.description':
    "Lance la détection ou l'affinement de la forme sélectionnée dans le Typesetter ou l'AIO manuel.",
  'shortcuts.applyActivePreset.label': 'Appliquer le préréglage actif',
  'shortcuts.applyActivePreset.description':
    'Applique le préréglage typographique actif à la région sélectionnée.',
  'shortcuts.applyLegacyPresetTextBubble.label':
    'Appliquer le préréglage hérité text_bubble',
  'shortcuts.applyLegacyPresetTextBubble.description':
    'Applique le préréglage visuel hérité text_bubble à la région sélectionnée.',
  'shortcuts.applyLegacyPresetTextFree.label':
    'Appliquer le préréglage hérité text_free',
  'shortcuts.applyLegacyPresetTextFree.description':
    'Applique le préréglage visuel hérité text_free à la région sélectionnée.',
  'shortcuts.applyLegacyPresetTextSfx.label':
    'Appliquer le préréglage hérité text_sfx',
  'shortcuts.applyLegacyPresetTextSfx.description':
    'Applique le préréglage visuel hérité text_sfx à la région sélectionnée.',
  'shortcuts.applyLegacyPresetTextNarration.label':
    'Appliquer le préréglage hérité text_narration',
  'shortcuts.applyLegacyPresetTextNarration.description':
    'Applique le préréglage visuel hérité text_narration à la région sélectionnée.',
  'shortcuts.applyLegacyPresetTextInsideBlackBubble.label':
    'Appliquer le préréglage hérité text_inside_black_bubble',
  'shortcuts.applyLegacyPresetTextInsideBlackBubble.description':
    'Applique le préréglage visuel hérité text_inside_black_bubble à la région sélectionnée.',
  'shortcuts.applyAutoShape.label': 'Appliquer la forme automatique',
  'shortcuts.applyAutoShape.description':
    'Choisit automatiquement entre elliptique et rectangulaire pour la région sélectionnée.',
  'shortcuts.convertShapeSquare.label': 'Convertir la forme en rectangulaire',
  'shortcuts.convertShapeSquare.description':
    'Convertit la région sélectionnée en forme rectangulaire.',
  'shortcuts.convertShapeRounded.label': 'Convertir la forme en elliptique',
  'shortcuts.convertShapeRounded.description':
    'Convertit la région sélectionnée en forme elliptique.',
  'shortcuts.deleteRegion.label': 'Supprimer la région sélectionnée',
  'shortcuts.deleteRegion.description':
    "Supprime la région sélectionnée dans l'AIO manuel, le Typesetter, le traducteur visuel ou le Cleaner.",
  'shortcuts.editInline.label': "Ouvrir l'édition en ligne de la région",
  'shortcuts.editInline.description':
    "Ouvre l'édition en ligne pour la région sélectionnée dans le rendu manuel.",
  'shortcuts.inlineEditorCancel.label': "Annuler l'édition en ligne",
  'shortcuts.inlineEditorCancel.description':
    "Disponible uniquement à l'intérieur de la zone de texte d'édition en ligne.",
  'shortcuts.inlineEditorSave.label': "Enregistrer l'édition en ligne",
  'shortcuts.inlineEditorSave.description':
    "Disponible uniquement à l'intérieur de la zone de texte d'édition en ligne.",
  'shortcuts.category.palette': "Palette d'outils",
  'shortcuts.duplicateRegion.label': 'Dupliquer la région sélectionnée',
  'shortcuts.duplicateRegion.description':
    "Duplique la région sélectionnée dans le Typesetter ou l'AIO manuel avec un décalage de 18 px.",
  'shortcuts.toolConfigToggle.label': 'Basculer le panneau de configuration',
  'shortcuts.toolConfigToggle.description':
    "Ouvre ou ferme le panneau de configuration de l'outil actif dans la palette.",
  'shortcuts.toolAreaSelect.label': 'Outil : Sélection de zone',
  'shortcuts.toolAreaSelect.description':
    "Active l'outil de sélection de zone dans l'AIO manuel.",
  'shortcuts.toolClearRegions.label': 'Effacer toutes les régions',
  'shortcuts.toolClearRegions.description':
    "Supprime toutes les régions de l'image active dans l'AIO manuel.",
  'shortcuts.toolSegmentBrush.label': 'Outil : Pinceau de segmentation',
  'shortcuts.toolSegmentBrush.description':
    "Active le pinceau pour l'édition manuelle du masque de segmentation.",
  'shortcuts.toolSegmentEraser.label': 'Outil : Gomme de segmentation',
  'shortcuts.toolSegmentEraser.description':
    "Active la gomme pour l'édition manuelle du masque de segmentation.",
  'shortcuts.toolPaint.label': 'Outil : Peinture',
  'shortcuts.toolPaint.description':
    "Active l'outil de peinture manuelle sur l'image.",
  'shortcuts.toolPaintEraser.label': 'Outil : Gomme de peinture',
  'shortcuts.toolPaintEraser.description':
    'Active la gomme pour effacer le calque de peinture manuelle.',
  'shortcuts.toolMagicWand.label': 'Outil : Baguette magique',
  'shortcuts.toolMagicWand.description':
    'Active la baguette magique pour la sélection par tolérance de couleur.',
  'shortcuts.toolHealingBrush.label': 'Outil : Pinceau correcteur',
  'shortcuts.toolHealingBrush.description':
    "Active le pinceau correcteur pour la restauration d'image.",
  'shortcuts.toolClearPaint.label': 'Effacer le calque de peinture',
  'shortcuts.toolClearPaint.description':
    "Supprime l'intégralité du calque de peinture manuelle de l'image active.",
  'shortcuts.toolResetEdits.label': 'Réinitialiser les modifications manuelles',
  'shortcuts.toolResetEdits.description':
    "Annule toutes les modifications manuelles sur l'image active dans le Cleaner ou l'AIO.",
  'dashboard.coachmark.stage.titleSuffix': 'scène principale',
  'dashboard.coachmark.stage.bodyWithImages':
    "Ici, vous voyez l'image active, validez le résultat visuel du mode <strong>{modeLabel}</strong> et effectuez des ajustements avec un retour immédiat.",
  'dashboard.coachmark.stage.bodyWithoutImages':
    "Lorsque vous chargez des images, cette scène devient le centre visuel du mode <strong>{modeLabel}</strong>. C'est là que le résultat apparaît en premier.",
  'dashboard.coachmark.stage.accent': 'Scène',
  'dashboard.coachmark.tools.titleSuffix': 'boîte à outils',
  'dashboard.coachmark.tools.body':
    'Utilisez la barre latérale droite pour configurer les options, préréglages et actions du mode <strong>{modeLabel}</strong>. Si quelque chose change dans le flux, ça commence généralement ici.',
  'dashboard.coachmark.tools.accent': 'Outils',
  'dashboard.coachmark.download.titleSuffix': 'export',
  'dashboard.coachmark.download.body':
    "Quand le résultat est satisfaisant, finalisez via le menu d'export pour télécharger images, packages ou PSD sans quitter le mode actuel.",
  'dashboard.coachmark.download.accent': 'Livraison',
  'dashboard.coachmark.organize.uploadTitle':
    "Organisation : commencez par l'upload",
  'dashboard.coachmark.organize.uploadBody':
    "Glissez des pages, chapitres ou packages complets ici. Le mode Organisation sert à préparer le lot avant d'entrer en production.",
  'dashboard.coachmark.organize.uploadAccent': 'Entrée',
  'dashboard.coachmark.organize.orderTitle': "Organisation : vérifiez l'ordre",
  'dashboard.coachmark.organize.orderBody':
    "Dans la barre latérale gauche, vous choisissez l'image active, réordonnez les pages, supprimez les éléments indésirables et vérifiez si le chapitre est prêt à continuer.",
  'dashboard.coachmark.organize.orderAccent': 'Lot',
  'dashboard.coachmark.aioAuto.pipelineTitle':
    'AIO Auto : laissez le pipeline tourner',
  'dashboard.coachmark.aioAuto.pipelineBody':
    'En mode automatique, vous configurez une fois et traitez le lot en séquence. Idéal pour le débit, la post-vérification et les flux de travail plus répétitifs.',
  'dashboard.coachmark.aioAuto.pipelineAccent': 'Auto',
  'dashboard.coachmark.aioAuto.stagesTitle':
    'AIO Auto : activez uniquement ce dont vous avez besoin',
  'dashboard.coachmark.aioAuto.stagesBody':
    "Activez uniquement les étapes pertinentes pour ce lot. Moins d'étapes signifie moins de coût, moins de temps et moins de risques d'erreur.",
  'dashboard.coachmark.aioAuto.stagesAccent': 'Pipeline',
  'dashboard.coachmark.aioAuto.configTitle':
    'AIO Auto : définissez modèles et langues',
  'dashboard.coachmark.aioAuto.configBody':
    "Choisissez les langues, préréglages et modèles avant de lancer. C'est la partie qui influence le plus la vitesse de traitement, la qualité et le coût.",
  'dashboard.coachmark.aioAuto.configAccent': 'Configuration',
  'dashboard.coachmark.aioManual.title':
    'AIO Manuel : travaillez étape par étape',
  'dashboard.coachmark.aioManual.body':
    "En mode manuel, vous exécutez, vérifiez et corrigez chaque étape avec plus de contrôle. C'est le mode idéal pour les finitions et les cas difficiles.",
  'dashboard.coachmark.aioManual.accent': 'Manuel',
  'dashboard.coachmark.aioManual.dockTitle':
    'AIO Manuel : utilisez le dock comme établi',
  'dashboard.coachmark.aioManual.dockBody':
    "Le dock flottant regroupe sélection, segmentation, peinture, baguette et correction. Considérez-le comme le mini panneau d'intervention rapide au-dessus de l'aperçu.",
  'dashboard.coachmark.aioManual.dockAccent': 'Dock',
  'dashboard.coachmark.typesetter.titleManual': 'Typesetter manuel',
  'dashboard.coachmark.typesetter.titleAuto': 'Typesetter automatique',
  'dashboard.coachmark.typesetter.bodyManual':
    'Le mode manuel est idéal pour les micro-ajustements de bulles, formes, polices et rythme visuel par page.',
  'dashboard.coachmark.typesetter.bodyAuto':
    'Le mode automatique accélère les brouillons et les gros lots. Faites un contrôle visuel rapide ensuite pour assurer la cohérence.',
  'dashboard.coachmark.typesetter.accentManual': 'Manuel',
  'dashboard.coachmark.typesetter.accentAuto': 'Auto',
  'dashboard.coachmark.cleaner.dockTitle':
    "Cleaner : correction locale sans quitter l'image",
  'dashboard.coachmark.cleaner.dockBody':
    'Quand le dock est visible, utilisez pinceau, gomme et correcteur pour peaufiner les détails sans perdre le contexte de la page.',
  'dashboard.coachmark.cleaner.dockAccent': 'Dock',
  'dashboard.coachmark.content.titleSuffix': 'navigation de contenu',
  'dashboard.coachmark.content.body':
    'Ce mode remplace la scène visuelle par un panneau de référence. Utilisez-le pour apprendre les flux de travail, consulter la documentation et revenir en production avec moins de friction.',
  'dashboard.coachmark.content.accent': 'Référence',
  'dashboard.coachmark.progress': 'Guide {{current}} / {{total}}',
  'dashboard.coachmark.next': 'Suivant',
  'dashboard.coachmark.prev': 'Précédent',
  'dashboard.coachmark.done': 'Compris',
  'aioModel.label.unavailable': ' (indisponible)',
  'aioModel.label.notInstalled': '(Non installé — cliquez pour installer)',
  'aioModel.label.updateAvailable': '(Mise à jour disponible)',
  'aioModel.label.installed': '(Installé)',
  'aioModel.status.selectAndInstall':
    "Sélectionnez et installez un modèle local pour l'étape « {stage} ».",
  'aioModel.status.selectValidOcr': "Sélectionnez un modèle valide pour l'OCR.",
  'aioModel.status.inRoadmap':
    'Le modèle « {name} » est encore dans la feuille de route.',
  'aioModel.status.requiresConfig':
    'Le modèle « {name} » nécessite une configuration avant utilisation.',
  'aioModel.status.installedOk': 'installé (ok)',
  'aioModel.status.installedUpdate': 'installé (mise à jour disponible)',
  'aioExec.selectAndInstallStage':
    "Sélectionnez et installez un modèle local avant d'exécuter l'étape « {stageLabel} ».",
  'aioExec.incompatibleLanguage':
    "Le modèle sélectionné n'est pas compatible avec la langue actuelle.",
  'aioExec.translationModelIncompatible':
    '« {modelName} » ne prend pas en charge la langue cible sélectionnée. Choisissez un modèle compatible ou changez la langue cible.',
  'aioExec.selectValidTranslation':
    'Sélectionnez un modèle de traduction valide pour continuer.',
  'aioExec.selectCustomOcrProfile':
    "Sélectionnez ou enregistrez un profil OCR IA personnalisé avant de lancer l'AIO.",
  'aioExec.selectCustomAiProfile':
    "Sélectionnez ou enregistrez un profil IA personnalisé avant de lancer l'AIO.",
  'aioExec.translationRequiresApiKey':
    'Ce fournisseur de traduction nécessite une clé API. Configurez la clé avant de lancer.',
  'aioManual.selectImage':
    "Sélectionnez une image pour l'exécution en mode manuel.",
  'aioManual.imageNotFound': 'Image active introuvable.',
  'aioManual.progressNotInitialized':
    "Progression manuelle non initialisée pour l'image active.",
  'aioManual.selectValidDetectModel':
    'Sélectionnez un modèle valide pour la détection de texte.',
  'aioManual.selectValidSegmentModel':
    'Sélectionnez un modèle valide pour la segmentation du texte.',
  'aioManual.selectValidCleanModel':
    "Sélectionnez un modèle valide pour le nettoyage d'image.",
  'aioManual.stageDone':
    'Mode manuel : étape « {stageLabel} » terminée pour « {fileName} ».',
  'aioManual.executionAborted': 'Exécution AIO manuelle annulée.',
  'aioManual.stageFailed': "Échec de l'exécution de l'étape « {stageLabel} ».",
  'translator.localModelIncompatible':
    "Le modèle local sélectionné n'est pas compatible avec la langue actuelle du traducteur.",
  'translator.selectValidTranslationModel':
    'Sélectionnez un modèle de traduction valide pour le traducteur.',
  'translator.selectCustomAiTranslationProfile':
    'Sélectionnez ou enregistrez un profil de traduction IA personnalisé avant de lancer.',
  'translator.localOcrModelIncompatible':
    "Le modèle OCR local sélectionné n'est pas compatible avec la langue actuelle du traducteur.",
  'translator.installCompatibleOcrModel':
    'Installez un modèle OCR compatible avant de lancer le traducteur visuel.',
  'translator.selectValidOcrModel':
    'Sélectionnez un modèle OCR valide pour le traducteur visuel.',
  'modelManager.error.diskCheckFailed':
    "Impossible de vérifier l'espace disque disponible.",
  'freeProvider.catalogOnly':
    'Le fournisseur « {name} » est disponible uniquement comme catalogue en v1.',
  'enhanceActions.connectError':
    "L'amélioration n'a pas pu se connecter au backend ({url}). Vérifiez que le mini-backend est actif.",
  'aioSingleProcessor.invalidCleanResponse':
    'Réponse invalide lors du nettoyage de « {fileName} ».',
  'cleanerActions.detectFailed':
    'Échec de la détection des régions pour « {fileName} » : {message}',
  'cleanerActions.invalidSfxResponse':
    'Réponse IA SFX du Cleaner invalide pour « {fileName} ».',
  'cleanerActions.invalidAutoCleanResponse':
    'Réponse de nettoyage IA automatique invalide pour « {fileName} ».',
  'cleanerActions.sfxDone':
    'Cleaner IA SFX terminé. {images} image(s), {candidates} candidat(s), {approved} SFX approuvé(s) et {redraw} région(s) nécessitant un redessin.',
  'cleanerActions.autoCleanDone':
    'Nettoyage IA automatique terminé. {images} image(s) traitée(s) et {detected} région(s) détectée(s).',
  'cleanerActions.assistedDone':
    'Cleaner assisté terminé. {images} image(s) nettoyée(s), {detected} région(s) détectée(s), {recognized} texte(s) reconnu(s), {segmented} région(s) segmentée(s).',
  'webhook.event.processStart.label': 'Traitement démarré',
  'webhook.event.processStart.desc': "Lorsqu'une exécution commence",
  'webhook.event.processComplete.label': 'Traitement terminé',
  'webhook.event.processComplete.desc':
    "Lorsqu'une exécution se termine avec succès",
  'webhook.event.processError.label': 'Erreurs de traitement',
  'webhook.event.processError.desc': "Lorsqu'une erreur survient",
  'webhook.event.updateAvailable.label': 'Mise à jour disponible',
  'webhook.event.updateAvailable.desc':
    "Lorsqu'une nouvelle version est disponible",
  'webhook.event.updateDownloaded.label': 'Mise à jour téléchargée',
  'webhook.event.updateDownloaded.desc':
    'Lorsque le téléchargement de la mise à jour est terminé',
  'webhook.event.updateError.label': 'Erreur de mise à jour',
  'webhook.event.updateError.desc': 'Lorsque la mise à jour échoue',
  'webhook.validation.urlRequired': "Saisissez l'URL du webhook Discord.",
  'webhook.validation.urlInvalid':
    'URL invalide. Vérifiez le format du webhook.',
  'webhook.validation.urlHttpsRequired':
    "L'URL du webhook doit utiliser HTTPS.",
  'webhook.validation.urlNotDiscord':
    'Utilisez une URL Discord officielle (discord.com).',
  'webhook.validation.urlInvalidPath':
    "Le chemin de l'URL ne correspond pas à un webhook Discord valide.",
  'typography.effect.none.label': 'Aucun effet',
  'typography.effect.none.description':
    'Texte simple, sans couches supplémentaires.',
  'typography.effect.balloon_smear.label': 'Balloon Smear',
  'typography.effect.balloon_smear.description':
    'Traînée verticale grise avec une légère oscillation latérale, inspirée du texte dramatique.',
  'typography.effect.smiles_outline.label': 'SMILES Outline',
  'typography.effect.smiles_outline.description':
    'Contour corail doux avec un cœur clair, style murmure mignon.',
  'typography.effect.ahnnn_peach.label': 'Ahnnn Peach Glow',
  'typography.effect.ahnnn_peach.description':
    'Remplissage pêche avec une lueur douce et chaude.',
  'typography.effect.silence_ink.label': 'Silence Ink',
  'typography.effect.silence_ink.description':
    'Bleu violacé avec une présence nette et une légère profondeur intérieure.',
  'typography.effect.hwa_pastel.label': 'HWA Pastel',
  'typography.effect.hwa_pastel.description':
    'Jaune clair avec un contour rose et une sensation de douceur.',
  'typography.effect.hah_pop.label': 'HAH Pop',
  'typography.effect.hah_pop.description':
    'Cœur lilas clair avec une présence pop et un relief rose.',
  'typography.effect.smooch_jelly.label': 'Smooch Jelly',
  'typography.effect.smooch_jelly.description':
    'Rose tendre avec un éclat gélatineux et une ombre sucrée.',
  'typography.effect.tremble_brush.label': 'Tremble Brush',
  'typography.effect.tremble_brush.description':
    'Coup de pinceau bleu-violet énergique avec un bord irrégulier.',
  'typography.effect.eheheh_whisper.label': 'EHEHEH Whisper',
  'typography.effect.eheheh_whisper.description':
    'Rose clair avec un contour duveteux et une lueur timide.',
  'typography.effect.hoho_ink.label': 'HOHO Ink',
  'typography.effect.hoho_ink.description':
    'Bleu foncé avec des coulures verticales et une texture sèche.',
  'typography.effect.blam_impact.label': 'BLAM Impact',
  'typography.effect.blam_impact.description':
    'Explosion jaune avec une ombre rouge décalée.',
  'typography.effect.badump_soft.label': 'BADUMP Soft',
  'typography.effect.badump_soft.description':
    'Dégradé pastel rose doux avec une aura romantique.',
  'typography.effect.thump_heavy.label': 'THUMP Heavy',
  'typography.effect.thump_heavy.description':
    'Impact noir avec une ombre lie-de-vin dure et angulaire.',
  'typography.effect.neon_woah.label': 'WOAH Neon',
  'typography.effect.neon_woah.description':
    'Texte blanc avec une lueur rose intense de surprise/brillance.',
  'typography.effect.slash_speed.label': 'SLAP Speed Slash',
  'typography.effect.slash_speed.description':
    'Typographie sombre avec une traînée diagonale agressive/flou de mouvement.',
  'typography.effect.ah_teal.label': 'Ah Teal',
  'typography.effect.ah_teal.description':
    'Aqua/sarcelle avec un contour sombre et une sensation de voix douce.',
  'typography.effect.drip_blue.label': 'DRIP Blue',
  'typography.effect.drip_blue.description':
    'Bleu clair avec une sensation liquide et un effet de gouttes.',
  'typography.effect.question_pop.label': 'Question Pop',
  'typography.effect.question_pop.description':
    'Signe de ponctuation chaud avec une ombre corail décalée.',
  'typography.effect.laugh_curve.label': 'Laugh Curve',
  'typography.effect.laugh_curve.description':
    'Cyan vif pour un rire arqué et léger.',
  'typography.effect.shake_blur.label': 'Shake Blur',
  'typography.effect.shake_blur.description':
    'Violet foncé avec vibration/flou de mouvement pour le tremblement.',
  'typography.effect.beep_outline.label': 'Beep Outline',
  'typography.effect.beep_outline.description':
    'Texte blanc avec un contour noir épais pour un SFX net et lisible.',
  'typography.effect.boom_comic.label': 'BOOM Comic',
  'typography.effect.boom_comic.description':
    'Explosion jaune/rouge de style bande dessinée classique.',
  'typography.effect.bang_chunk.label': 'BANG Chunk',
  'typography.effect.bang_chunk.description':
    'Bloc violet/bleu avec une ombre dorée épaisse décalée.',
  'typography.effect.break_glitch.label': 'BREAK Glitch',
  'typography.effect.break_glitch.description':
    'Magenta foncé avec une texture de glitch/scan cassé.',
  'typography.effect.flinch_outline.label': 'FLINCH Outline',
  'typography.effect.flinch_outline.description':
    'Noir avec un contour blanc agressif pour une réaction instantanée.',
  'typography.effect.growl_moss.label': 'Growl Moss',
  'typography.effect.growl_moss.description':
    'Vert olive sec pour un son rauque/animal.',
  'typography.effect.yawn_soft.label': 'Yawn Soft',
  'typography.effect.yawn_soft.description':
    'Vert citron avec un contour violet pour une parole paresseuse/étirée.',
  'typography.effect.scratch_noise.label': 'Scratch Noise',
  'typography.effect.scratch_noise.description':
    'Noir brut avec un aspect granuleux/bruité.',
  'typography.effect.crack_ink.label': 'Crack Ink',
  'typography.effect.crack_ink.description':
    'Coup de pinceau noir sec et tranchant pour un impact soudain.',
  'typography.effect.slap_scratch.label': 'Slap Scratch',
  'typography.effect.slap_scratch.description':
    'Gribouillage fin et traîné pour un effet de griffure/coup rapide.',
  'typography.effect.dash_edge.label': 'Dash Edge',
  'typography.effect.dash_edge.description':
    'Vert foncé avec des pointes acérées pour une coupure/entrée soudaine.',
  'typography.effect.scream_scratch.label': 'Scream Scratch',
  'typography.effect.scream_scratch.description':
    'Cri noir avec un décalage rouge brut.',
  'model.opus-mt-ja-en.description':
    'Pipeline OPUS-MT optimisé pour le contenu japonais, avec traduction anglaise et un flux secondaire pour le portugais.',
  'model.nllb-200-600m-int8.description':
    "Modèle multilingue NLLB quantifié en int8 pour réduire l'utilisation mémoire tout en maintenant une bonne qualité pour KO→EN/PT.",
  'model.opus-mt-zh-en.description':
    'Modèle OPUS-MT pour le chinois avec traduction anglaise principale et un flux secondaire pour le portugais.',
  'model.nllb-200-1.3b.description':
    'Modèle multilingue de qualité supérieure pour la traduction générale avec une large couverture linguistique.',
  'model.nllb-200-1.3b-int8-ct2.description':
    'Version quantifiée CTranslate2 de NLLB 1.3B, réduisant la VRAM avec un excellent rapport qualité-prix.',
  'model.nllb-200-3.3b.description':
    'Modèle NLLB haute capacité pour une qualité maximale dans de nombreuses langues.',
  'model.sugoi_v4_ja_en_ct2.description':
    'Traducteur local japonais→anglais avec CTranslate2 et SentencePiece, compatible avec le flux hors ligne BallonsTranslator.',
  'model.m2m100_1_2b_ct2.description':
    'Traducteur multilingue local via CTranslate2, avec une large couverture linguistique et compatibilité avec le flux hors ligne BallonsTranslator.',
  'model.font_rtdetr_v2.description':
    'Modèle local pour la détection de régions de texte dans le pipeline AIO.',
  'model.comic_text_detector.description':
    'Détecteur local basé sur le module CTD de BallonsTranslator pour les zones de texte dans les pages manga.',
  'model.manga_ocr.description':
    "Modèle OCR local pour le japonais dans l'AIO.",
  'model.meiki_ocr.description':
    'OCR local japonais spécialisé dans le texte rendu, avec des modèles ONNX horizontaux et verticaux.',
  'model.paddleocr_vl_manga.description':
    'OCR VLM local spécialisé dans le manga japonais.',
  'model.got_ocr2.description':
    'OCR multimodal local via GOT-OCR 2.0 avec runtime transformers natif.',
  'model.qwen2_5_vl_3b.description':
    'OCR multimodal local via Qwen2.5-VL-3B-Instruct.',
  'model.mangalmm.description':
    'OCR/compréhension multimodal spécialisé dans le manga basé sur Qwen2.5-VL.',
  'model.rolmocr.description':
    'OCR local robuste basé sur Qwen2.5-VL avec optimisation pour la lecture de documents.',
  'model.glm_ocr_onnx.description':
    'OCR GLM local axé sur les mises en page complexes avec runtime transformers natif.',
  'model.paddleocr.description':
    'Modèle OCR local pour les langues russes/slaves dans le pipeline AIO.',
  'model.paddleocr_latin_v5.description':
    'Modèle OCR local pour les langues latines (inclut le néerlandais) dans le pipeline AIO.',
  'model.paddleocr_ch_v5.description':
    'Modèle OCR local pour le chinois dans le pipeline AIO.',
  'model.paddleocr_en_v5.description':
    "Modèle OCR local axé sur l'anglais pour le pipeline AIO.",
  'model.easyocr.description':
    "OCR local multilingue avec installation à la demande dans le répertoire de modèles de l'application.",
  'model.pororo.description':
    'Modèle OCR local pour le coréen dans le pipeline AIO.',
  'model.baka_content_cc.description':
    "Modèle local pour la segmentation/l'affinement des régions de texte dans l'AIO.",
  'model.aot.description':
    "Modèle d'inpainting local pour le nettoyage des bulles dans l'AIO.",
  'model.lama_manga.description':
    "Modèle d'inpainting contextuel local pour les zones complexes dans l'AIO.",
  'model.opencv_lama.description':
    "Modèle d'inpainting local léger via OpenCV Zoo, conçu pour le CPU et l'exécution rapide.",
  'model.lama_fp32.description':
    'Portage ONNX recommandé de big-lama en 512x512, adapté au CPU/GPU pour un bon équilibre qualité-simplicité.',
  'model.vntl_llama3_8b_v2.description':
    'Fine-tune LLaMA3 pour VN japonais → anglais. Dataset multi-lignes reconstruit. Utilisez temp 0. (~5,7-8,5 Go GGUF).',
  'model.lfm2_350m_enjp_mt.description':
    'Traducteur bidirectionnel JA↔EN ultra-léger, 0,4B params. Q4_0 à seulement 219 Mo — idéal pour CPU et appareils edge.',
  'model.sakura_galtransl_7b_v3_7.description':
    'Traducteur JA→ZH-CN optimisé pour les visual novels. Préserve retours à la ligne, caractères de contrôle et ruby. CC-BY-NC-SA 4.0 (~4,25 Go IQ4_XS).',
  'model.sakura_1_5b_qwen2_5_v1_0.description':
    'Alternative légère à Sakura 7B avec quantification IMatrix. ~1 Go Q5KS. Idéal pour GPU de milieu de gamme ou CPU (~4 Go RAM).',
  'model.hunyuan_7b_mt_v1_0.description':
    'Traducteur multilingue Tencent — 1re place WMT25. 33 langues bidirectionnelles. Prompt : "Translate into <target_language>." (~4,2 Go Q4_K_M).',
  'model.pp_doclayout_v3.description':
    "Modèle local de détection de mise en page et de texte basé sur PP-DocLayout V3. Haute précision pour l'analyse de la mise en page.",
  'model.paddleocr_vl_1_5.description':
    "Modèle OCR VLM multilingue de haute qualité (PaddleOCR-VL 1.5). Jusqu'à 128 tokens par bloc de texte.",
  'model.waifu2x_swin_unet_art_scan_2x.description':
    'Meilleure option locale pour les pages manga/manhwa axée sur le dessin au trait et les bulles.',
  'model.waifu2x_swin_unet_art_scan_4x.description':
    'Variante 4x pour les pages manga/manhwa numérisées.',
  'model.waifu2x_swin_unet_art_2x.description':
    "Modèle 2x pour l'art numérique/anime propre.",
  'model.4xnomos2_hq_mosr.description':
    'Upscaler ONNX 4x haute qualité pour du matériel peu dégradé.',
  'model.4xspankendata.description':
    'Modèle ONNX léger comme solution de secours 4x générale.',
  'model.2x_hfa2kcompact.description':
    'Candidat compatible uniquement via import ONNX manuel/conversion externe.',
  'model.2x_digitalfilm_superultracompact.description':
    'Candidat pour import ONNX manuel.',
  'model.2x_anifilm_compact.description': 'Candidat pour import ONNX manuel.',
  'model.2xnomosuni_span_multijpg_ldl.description':
    'Candidat pour import ONNX manuel.',
  'model.realesrgan_x4plus.description': 'Candidat pour import ONNX manuel.',
  'model.4xhfa2kludvaeswinir_light.description':
    'Candidat pour import ONNX manuel.',
  'splitter.status.recipeApplied':
    "Recette du découpeur appliquée à l'image active.",
  'splitter.status.recipeRestored':
    'Recette du découpeur restaurée aux valeurs par défaut.',
  'splitter.status.exportCancelled':
    "Export du découpeur annulé par l'utilisateur.",
  'splitter.error.noSegmentsActive':
    "Aucun segment valide n'a été généré pour l'image active.",
  'splitter.error.noSegmentsBatch':
    "Aucun segment valide n'a été généré dans le lot du découpeur.",
  'aioExec.sessionUnavailable': 'Session indisponible pour utiliser les modèles cloud. Veuillez vous reconnecter.',
  'aioManual.progressionNotInitialized':
    "Progression manuelle non initialisée pour l'image active.",
  'cleanerActions.selectValidOcrModel':
    'Sélectionnez un modèle OCR valide pour le Cleaner.',
  'cleanerActions.invalidCleanResponseNamed':
    'Réponse de nettoyage invalide pour « {name} ».',
  'customLlm.selectTranslationProfile':
    'Sélectionnez un profil de traduction personnalisé enregistré à utiliser.',
  'customLlm.selectOcrProfile':
    'Sélectionnez un profil OCR personnalisé enregistré à utiliser.',
  'customLlm.profileNotFound':
    'Profil personnalisé introuvable. Rechargez et réessayez.',
  'customLlm.translationProfileActive':
    "Profil personnalisé en cours d'utilisation (traduction) : {label}.",
  'customLlm.ocrProfileActive':
    "Profil personnalisé en cours d'utilisation (OCR) : {label}.",
  'accountSync.confirmEmailSent':
    'E-mail de confirmation envoyé. Vérifiez votre boîte de réception.',
  'accountSync.confirmEmailFailed':
    "Échec de l'envoi de l'e-mail de confirmation.",
  'downloadActions.noTranslatorResults':
    'Aucun résultat du traducteur disponible au téléchargement.',
  'enhanceActions.desktopOnly':
    "L'améliorateur local est disponible uniquement dans l'application bureau.",
  'enhanceActions.selectModel':
    "Sélectionnez un modèle d'amélioration compatible.",
  'enhanceActions.done':
    'Amélioration terminée. Utilisez Télécharger pour enregistrer.',
  'freeProvider.stageNotSupported':
    'Le fournisseur ne prend pas en charge cette étape.',
  'freeProvider.activeForTranslation':
    'Fournisseur {name} utilisé pour la traduction.',
  'freeProvider.activeForOcr': "Fournisseur {name} utilisé pour l'OCR.",
  'freeProvider.activeForClean': 'Provider {name} utilisé pour le nettoyage.',
  'freeProvider.stageTranslation': 'Traduction',
  'freeProvider.stageOcr': 'OCR',
  'freeProvider.stageClean': 'Nettoyage',
  'translatorRetranslate.targetNotFound':
    'Image cible introuvable pour la retraduction.',
  'translatorRetranslate.noTextAvailable':
    'Aucun texte reconnu disponible pour la retraduction.',
  'translatorText.done':
    'Traducteur de texte terminé. Utilisez copier ou télécharger le TXT.',
  'typographer.queueApplied':
    'Texte de la file appliqué à la sélection actuelle.',
  'typographer.queueAppliedMulti':
    'Texte de la file appliqué à {{count}} bulle(s).',
  'typographer.queueCleared': 'File du Typesetter vidée.',
  'typographer.queueImported': 'Texte importé dans la file du Typesetter.',
  'aioManual.invalidCleanResponse':
    "Réponse invalide lors du nettoyage de l'image.",
  'aioStage.lang.ko': 'Coréen',
  'aioStage.lang.ja': 'Japonais',
  'aioStage.lang.fr': 'Français',
  'aioStage.lang.zh': 'Chinois',
  'aioStage.lang.zh-CN': 'Chinois simplifié',
  'aioStage.lang.zh-TW': 'Chinois traditionnel',
  'aioStage.lang.en': 'Anglais',
  'aioStage.lang.ru': 'Russe',
  'aioStage.lang.de': 'Allemand',
  'aioStage.lang.nl': 'Néerlandais',
  'aioStage.lang.es': 'Espagnol',
  'aioStage.lang.it': 'Italien',
  'aioStage.lang.tr': 'Turc',
  'aioStage.lang.pl': 'Polonais',
  'aioStage.lang.pt': 'Portugais',
  'aioStage.lang.pt-BR': 'Portugais (BR)',
  'aioStage.lang.th': 'Thaï',
  'aioStage.lang.vi': 'Vietnamien',
  'aioStage.lang.hu': 'Hongrois',
  'aioStage.lang.id': 'Indonésien',
  'aioStage.lang.fi': 'Finnois',
  'aioStage.lang.ar': 'Arabe',
  'splitter.warning.noIntermediateCuts':
    "Aucune découpe intermédiaire n'a été trouvée.",
  'splitter.warning.segmentTooSmall':
    'Un segment est plus petit que la hauteur minimale configurée.',
  'splitter.warning.segmentTooLarge':
    'Un segment est plus grand que la hauteur maximale configurée.',
  'splitter.warning.cutsNearContent':
    'Certaines découpes sont proches de zones avec du contenu.',
  'splitter.warning.nearEdge': 'Trop proche du bord.',
  'stitch.warning.dimensionTooHigh':
    'La dimension est trop élevée ; exportez en plusieurs lots pour éviter les échecs.',
  'stitch.warning.outputTooHeavy':
    'La sortie est trop volumineuse pour la visualisation et le téléchargement.',
  'stitch.warning.canvasLimit':
    'Peut dépasser les limites de canevas sécurisées dans certains environnements.',
  'stitch.warning.largeBatch':
    'Lot volumineux ; vérifiez si la coupure reste confortable pour la scanlation.',
  'resources.data.fontsTitle': 'Polices de composition',
  'resources.data.fontsDesc':
    'Collection sélectionnée de polices populaires pour la scanlation de manga, manhwa et manhua.',
  'resources.data.onomatopoeiaDesc':
    "Bibliothèque d'onomatopées japonaises avec traductions et exemples d'utilisation.",
  'resources.data.glossaryTitle': 'Glossaire de scanlation',
  'resources.data.glossaryDesc':
    'Termes techniques et jargon communautaire du monde de la scanlation.',
  'resources.data.catalogLabel': 'Catalogue',
  'aioLocalBatch.invalidBatchResponse':
    'Réponse de lot invalide : batch_report.json absent du ZIP.',
  'modelDownload.desktopOnly':
    "La gestion des modèles est disponible uniquement dans l'application bureau.",
  'settings.updates.channelBeta': 'Bêta',
  'settings.updates.channelStable': 'Stable',
  'settings.presets.aio.defaultName': 'Préréglage',
  'settings.integrations.blogger.term.googleCloudConsole':
    'Google Cloud Console',
  'settings.integrations.blogger.term.bloggerApiV3': 'Blogger API v3',
  'settings.integrations.blogger.term.googleDriveApi': 'Google Drive API',
  'settings.integrations.blogger.term.oauthClientId': 'OAuth Client ID',
  'settings.integrations.blogger.term.clientId': 'Client ID',
  'settings.integrations.blogger.term.clientSecret': 'Client Secret',
  'settings.integrations.blogger.term.oauthPlayground': 'OAuth Playground',
  'settings.integrations.blogger.term.exchangeCodeForTokens':
    'Échanger le code contre des jetons',
  'settings.integrations.blogger.term.refreshToken': 'Refresh Token',
  'settings.integrations.blogger.term.cloudName': 'cloud name',
  'settings.integrations.blogger.term.blogId': 'Blog ID',
  'settings.integrations.imgur.term.clientId': 'Client ID',
  'settings.integrations.imgur.term.rateLimit': '50 uploads/heure',
  'settings.shortcuts.topbarPath': 'Barre supérieure > Raccourcis',
  'login.warning.versionPrefix': 'v{version}',
  'password.policy.minLength':
    'Le mot de passe doit contenir au moins 12 caractères.',
  'password.policy.uppercase':
    'Le mot de passe doit contenir au moins une lettre majuscule.',
  'password.policy.lowercase':
    'Le mot de passe doit contenir au moins une lettre minuscule.',
  'password.policy.number':
    'Le mot de passe doit contenir au moins un chiffre.',
  'password.policy.special':
    'Le mot de passe doit contenir au moins un caractère spécial.',
  'auth.sfx.primary': '쾅',
  'auth.sfx.secondary': '휙',
  'auth.stats.activeScanlatorsValue': '2,4k+',
  'auth.stats.toolsValue': '50+',
  'auth.stats.pagesProcessedValue': '1M+',
  'auth.community.joinIndicator': '+',
  'resources.sfx.onomatopoeiaLabel': 'Onomatopée',
  'resources.page.shortcutCtrl': 'Ctrl',
  'resources.page.shortcutFind': 'F',
  'settings.integrations.blogger.value.requestsPerDay': '10 000',
  'settings.integrations.blogger.value.requestsPerUser': '100/100s',
  'settings.integrations.imgur.authorizationHeaderExample':
    'Authorization: Client-ID …',
  'settings.shortcuts.quickKey': 'H',
  'guides.search.keyArrowUp': '↑',
  'guides.search.keyArrowDown': '↓',
  'guides.search.keyArrowPair': '↑↓',
  'guides.search.keyEnter': '⏎',
  'guides.search.keyEscape': 'Échap',
  'settings.typographerLibrary.presetsCount_one': '{count} préréglage',
  'settings.typographerLibrary.presetsCount_other': '{count} préréglages',
  'renderPreview.iconUppercase': 'AA',
  'renderPreview.iconHorizontal': 'H',
  'renderPreview.iconVertical': 'V',
  'renderPreview.iconCircular': '◯',
  'guides.home.searchShortcut': '⌘K',
  'brand.name': 'KŌMA',
  'brand.studioSuffix': 'Studio',
  'versionBadge.stable': 'STABLE',
  'versionBadge.beta': 'BÊTA',
  'versionBadge.tooltip': 'Version {version}',
  'settings.typography.iconBold': 'G',
  'settings.typography.iconItalic': 'I',
  'settings.typography.iconUppercase': 'AA',
  'settings.downloadFormat.jpeg': 'JPEG',
  'settings.downloadFormat.png': 'PNG',
  'settings.downloadFormat.webp': 'WebP',
  'common.infoGlyph': 'i',
  'modelManager.tooltip.speed.ok': 'OK',
  'update.units.bytes': 'o',
  'update.units.kilobytes': 'Ko',
  'update.units.megabytes': 'Mo',
  'update.units.gigabytes': 'Go',
  'update.units.perSecond': '/s',
  'update.versionPrefix': 'v{version}',
  'update.toast.newVersionFallback': 'nouvelle',
  'dashboard.status.cloudSuffix': '(Cloud)',
  'dashboard.status.cloudApiSuffix': '(Cloud/API/IA)',
  'dashboard.status.pendingCustomTranslationName':
    'IA personnalisée (synchronisation...)',
  'dashboard.status.pendingCustomOcrName':
    'OCR personnalisé (synchronisation...)',
  'modelManager.tooltip.gpu': 'GPU',
  'modelManager.tooltip.vram': 'VRAM',
  'modelManager.tooltip.ram': 'RAM',
  'dashboard.tour.preview.welcome.upload': 'Charger',
  'dashboard.tour.preview.welcome.export': 'Exporter',
  'dashboard.tour.preview.upload.formats':
    'JPG · PNG · WEBP · ZIP · PDF · CBZ · CB7 · PSD',
  'dashboard.tour.preview.stageEmpty': 'Chargez des images pour commencer',
  'dashboard.tour.welcome.title':
    'Bienvenue sur le tableau de bord KŌMA Studio',
  'dashboard.tour.welcome.body':
    "Ce tour vous guide à travers le flux principal de l'application : organiser les pages, choisir les modes, configurer le pipeline AIO et exporter les résultats sans avoir à deviner où se trouve chaque fonctionnalité.",
  'dashboard.tour.sidebar.title':
    'Barre latérale : quota, fichiers et contexte du lot',
  'dashboard.tour.sidebar.body':
    "Ici, vous suivez votre forfait et votre utilisation mensuelle, choisissez l'image active, réordonnez les pages, supprimez des éléments et gardez le lot organisé avant le traitement.",
  'dashboard.tour.upload.title': 'Entrée initiale des fichiers',
  'dashboard.tour.upload.body':
    "La zone de dépôt accepte des images individuelles et des packages complets. C'est le point de départ pour glisser des chapitres, raws ou ressources à traiter dans le tableau de bord.",
  'dashboard.tour.modes.title': 'Navigation principale du tableau de bord',
  'dashboard.tour.modes.body':
    "Utilisez Organisation pour préparer le lot et AIO pour le pipeline complet. Les autres groupes de la barre supérieure ouvrent des modes spécialisés sans quitter l'espace de travail.",
  'dashboard.tour.production.title': 'Production : outils spécialisés',
  'dashboard.tour.production.body':
    'Cleaner, Typesetter, Traducteur, Raw et QC couvrent le flux de travail manuel et avancé. Considérez ce groupe comme les modes professionnels pour travailler sur une étape spécifique du chapitre.',
  'dashboard.tour.utils.title': 'Utilitaires et support',
  'dashboard.tour.utils.body':
    "Assemblage, Découpe, Filigrane et Amélioration gèrent les tâches rapides de préparation et d'export. Guides et Ressources complètent l'espace de support et de référence.",
  'dashboard.tour.submode.title': 'AIO Auto vs. Manuel',
  'dashboard.tour.submode.body':
    'Le mode auto exécute le pipeline complet en lot. Le mode manuel déverrouille chaque étape par image pour une vérification fine, un retour arrière/avant et une édition visuelle contrôlée.',
  'dashboard.tour.pipeline.title': 'Pipeline AIO',
  'dashboard.tour.pipeline.body':
    "Cette carte contrôle la séquence Détecter > OCR > Traduire > Segmenter > Nettoyer > Rendre. Vous pouvez activer ou désactiver des étapes et, en mode manuel, n'exécuter que l'étape courante.",
  'dashboard.tour.stageConfig.title': "Configuration de l'étape",
  'dashboard.tour.stageConfig.body':
    "Ici se trouvent les langues, préréglages AIO, catalogues locaux/cloud et la sélection de modèle par étape. C'est le centre de décision pour ajuster coût, qualité et vitesse.",
  'dashboard.tour.stage.withImagesTitle': 'Espace de travail et aperçu visuel',
  'dashboard.tour.stage.withImagesBody':
    "Quand des images sont chargées, cette scène devient l'aperçu principal : vous naviguez entre les pages, voyez les résultats par étape et travaillez directement sur l'image active.",
  'dashboard.tour.stage.emptyTitle': 'Scène centrale du tableau de bord',
  'dashboard.tour.stage.emptyBody':
    'Sans images, la scène affiche un état vide simple. Après le chargement, elle affiche aperçus, overlays, régions et résultats par mode.',
  'dashboard.tour.manualDock.title': 'Aperçu interactif et dock manuel',
  'dashboard.tour.manualDock.body':
    "Avec une image active en AIO manuel, le dock flottant débloque la sélection de zone, le pinceau, la gomme, la baguette, le correcteur et les ajustements contextuels sans quitter l'aperçu.",
  'dashboard.tour.download.title': 'Export et téléchargements',
  'dashboard.tour.download.body':
    "Quand l'application a des résultats prêts, ce menu regroupe les formats d'image, packages, PSD multicouches et options de métadonnées pour finaliser le flux de livraison.",
  'dashboard.tour.replay.title': 'Si vous souhaitez relancer le tour plus tard',
  'dashboard.tour.replay.body':
    "Ouvrez le menu utilisateur et utilisez <strong>Relancer le tour</strong>. L'onboarding automatique ne s'exécute qu'à la première visite de la version actuelle, mais le replay manuel est toujours disponible.",
  'dashboard.tour.progressText': 'Étape {{current}} sur {{total}}',
  'dashboard.tour.next': 'Suivant',
  'dashboard.tour.prev': 'Précédent',
  'dashboard.tour.done': 'Terminer le tour',
  'dashboard.tour.dialogLabel': 'Tour du tableau de bord',
  'dashboard.tour.close': 'Fermer le tour',
  'dashboard.tour.nextAria': "Passer à l'étape suivante",
  'dashboard.tour.prevAria': "Revenir à l'étape précédente",
  'modelManager.tooltip.rich.highlights': 'Points forts',
  'modelManager.tooltip.rich.unique': 'Particularité',
  'modelManager.tooltip.rich.bestFor': 'Idéal pour',
  'modelManager.tooltip.rich.performance': 'Performance',
  'modelManager.tooltip.rich.notes': 'Notes',
  'modelManager.tooltip.docsUrl': 'Voir la documentation',
  'modelManager.tooltip.notes': 'Notes',
  'modelManager.tooltip.highlights': 'Points forts',
  'modelManager.tooltip.bestFor': 'Idéal pour',
  'modelManager.tooltip.unique': 'Particularité',
  'modelManager.tooltip.performance': 'Performance',

  'model.tooltip.opus-mt-ja-en.highlights':
    "Traduit le japonais vers l'anglais\nLéger et rapide, fonctionne bien sans carte graphique\nBonne option pour débuter",
  'model.tooltip.opus-mt-ja-en.unique':
    "Fonctionne bien pour les textes généraux en japonais, mais n'a pas été conçu spécialement pour le manga",
  'model.tooltip.opus-mt-ja-en.bestFor':
    "Traductions rapides du japonais vers l'anglais quand vous n'avez pas de carte graphique puissante",
  'model.tooltip.opus-mt-ja-en.performance':
    "Très rapide, fonctionne sur n'importe quel ordinateur sans carte graphique",
  'model.tooltip.opus-mt-ja-en.notes':
    "Bonne option générale, mais pour le manga et l'anime, Sugoi donne de meilleurs résultats",

  'model.tooltip.nllb-200-600m-int8.highlights':
    "Traduit entre près de 200 langues\nVersion légère et optimisée\nFonctionne bien sur n'importe quel ordinateur",
  'model.tooltip.nllb-200-600m-int8.unique':
    'Un seul modèle qui traduit entre des centaines de langues — idéal quand vous avez besoin de polyvalence',
  'model.tooltip.nllb-200-600m-int8.bestFor':
    "Traduire entre des langues moins courantes ou quand vous avez besoin d'un modèle qui fonctionne pour tout",
  'model.tooltip.nllb-200-600m-int8.performance':
    'Rapide et léger, fonctionne bien même sur des ordinateurs sans carte graphique',
  'model.tooltip.nllb-200-600m-int8.notes':
    'Pas conçu pour le manga, mais fonctionne comme traducteur général pour de nombreuses langues',

  'model.tooltip.opus-mt-zh-en.highlights':
    "Traduit le chinois vers l'anglais\nLéger et rapide\nFonctionne sans carte graphique",
  'model.tooltip.opus-mt-zh-en.unique':
    'Spécialisé chinois → anglais, bon pour les manhua et le contenu chinois en général',
  'model.tooltip.opus-mt-zh-en.bestFor':
    "Traduire rapidement des manhua et du contenu chinois vers l'anglais",
  'model.tooltip.opus-mt-zh-en.performance':
    "Très rapide, fonctionne sur n'importe quel ordinateur sans carte graphique",
  'model.tooltip.opus-mt-zh-en.notes':
    'Populaire et fiable pour les traductions chinois → anglais',

  'model.tooltip.nllb-200-1.3b.highlights':
    'Traduit entre près de 200 langues\nMeilleure qualité que la version légère\nBon pour les langues moins courantes',
  'model.tooltip.nllb-200-1.3b.unique':
    'Version intermédiaire avec une meilleure qualité que la 600M, sans être aussi lourde que la 3.3B',
  'model.tooltip.nllb-200-1.3b.bestFor':
    "Quand vous avez besoin d'une meilleure qualité que la version légère, surtout pour les langues rares",
  'model.tooltip.nllb-200-1.3b.performance':
    'Nécessite une carte graphique avec au moins 4 Go de mémoire ; vitesse correcte',
  'model.tooltip.nllb-200-1.3b.notes':
    'Bon équilibre entre qualité et poids. Pas conçu pour le manga.',

  'model.tooltip.nllb-200-1.3b-int8-ct2.highlights':
    'Traduit entre près de 200 langues\nVersion optimisée qui utilise moins de mémoire\nBonne qualité avec moins de consommation',
  'model.tooltip.nllb-200-1.3b-int8-ct2.unique':
    'Même qualité que la version 1.3B mais avec moins de mémoire — meilleur rapport qualité-prix',
  'model.tooltip.nllb-200-1.3b-int8-ct2.bestFor':
    "Traduction multilingue de bonne qualité sans avoir besoin d'un ordinateur très puissant",
  'model.tooltip.nllb-200-1.3b-int8-ct2.performance':
    'Fonctionne sur CPU si nécessaire ; plus léger que la version normale 1.3B',
  'model.tooltip.nllb-200-1.3b-int8-ct2.notes':
    'Version optimisée du NLLB 1.3B — utilisez celle-ci pour économiser de la mémoire',

  'model.tooltip.nllb-200-3.3b.highlights':
    'Meilleure qualité parmi les traducteurs multilingues\nPrès de 200 langues\nIdéal quand la qualité compte plus que la vitesse',
  'model.tooltip.nllb-200-3.3b.unique':
    'La version la plus puissante et précise de la famille multilingue — meilleure traduction disponible pour les langues rares',
  'model.tooltip.nllb-200-3.3b.bestFor':
    'Quand la qualité de la traduction est plus importante que la vitesse',
  'model.tooltip.nllb-200-3.3b.performance':
    'Nécessite une bonne carte graphique avec au moins 8 Go de mémoire ; plus lent que les autres',
  'model.tooltip.nllb-200-3.3b.notes':
    'Plus lourd mais de meilleure qualité. Pas conçu pour le manga.',

  'model.tooltip.sugoi_v4_ja_en_ct2.highlights':
    "Traduit le japonais vers l'anglais\nConçu spécialement pour le manga et l'anime\nFonctionne sur n'importe quel ordinateur",
  'model.tooltip.sugoi_v4_ja_en_ct2.unique':
    "Comprend l'argot, le langage familier et les expressions typiques du manga et de l'anime mieux que les autres traducteurs",
  'model.tooltip.sugoi_v4_ja_en_ct2.bestFor':
    "Traduire le manga et l'anime du japonais vers l'anglais — le choix le plus recommandé par la communauté",
  'model.tooltip.sugoi_v4_ja_en_ct2.performance':
    'Très rapide, fonctionne bien même sans carte graphique dédiée',
  'model.tooltip.sugoi_v4_ja_en_ct2.notes':
    'Utilisez ce modèle par défaut pour les traductions japonais → anglais',

  'model.tooltip.m2m100_1_2b_ct2.highlights':
    'Traduit entre 100 langues\nCouvre le coréen, le thaï, le vietnamien et plus\nVersion optimisée pour une exécution plus rapide',
  'model.tooltip.m2m100_1_2b_ct2.unique':
    "L'un des rares modèles qui traduit bien entre les langues asiatiques comme le coréen, le thaï et le vietnamien vers l'anglais",
  'model.tooltip.m2m100_1_2b_ct2.bestFor':
    "Traduire les manhwa coréens, les manhua chinois et du contenu dans d'autres langues asiatiques vers l'anglais",
  'model.tooltip.m2m100_1_2b_ct2.performance':
    'Nécessite une carte graphique avec 4-6 Go de mémoire ; bonne vitesse avec la version optimisée',
  'model.tooltip.m2m100_1_2b_ct2.notes':
    'Bonne option pour les langues asiatiques que les autres traducteurs ne couvrent pas bien',

  'model.tooltip.vntl_llama3_8b_v2.highlights':
    "Traduit le japonais vers l'anglais\nConçu pour les visual novels et le manga\nMaintient les noms de personnages cohérents",
  'model.tooltip.vntl_llama3_8b_v2.unique':
    "Comprend le contexte de l'histoire et maintient la cohérence des noms de personnages et des termes tout au long du texte",
  'model.tooltip.vntl_llama3_8b_v2.bestFor':
    'Traduire des visual novels et des manga avec de longs dialogues où la cohérence des noms est importante',
  'model.tooltip.vntl_llama3_8b_v2.performance':
    'Nécessite une bonne carte graphique avec 6-10 Go de mémoire ; plus lent que les traducteurs simples',
  'model.tooltip.vntl_llama3_8b_v2.notes':
    'Idéal pour les projets longs où la cohérence des noms et des termes est importante',

  'model.tooltip.lfm2_350m_enjp_mt.highlights':
    "Traduit japonais ↔ anglais dans les deux sens\nUltra léger et rapide\nFonctionne sur n'importe quel ordinateur",
  'model.tooltip.lfm2_350m_enjp_mt.unique':
    "L'un des plus petits traducteurs disponibles — fonctionne même sur des ordinateurs faibles tout en donnant des résultats corrects",
  'model.tooltip.lfm2_350m_enjp_mt.bestFor':
    "Quand vous avez besoin d'une traduction rapide japonais-anglais et que vous n'avez pas de carte graphique puissante",
  'model.tooltip.lfm2_350m_enjp_mt.performance':
    "Extrêmement rapide, fonctionne sur n'importe quel ordinateur même sans carte graphique",
  'model.tooltip.lfm2_350m_enjp_mt.notes':
    'Qualité basique — bon pour des brouillons rapides, mais pas pour un résultat final',

  'model.tooltip.sakura_galtransl_7b_v3_7.highlights':
    'Traduit le japonais vers le chinois\nLe meilleur pour les galgames et le manga\nConserve le formatage et les notes spéciales',
  'model.tooltip.sakura_galtransl_7b_v3_7.unique':
    'Préserve le formatage spécial, les annotations de lecture et les sauts de ligne — essentiel pour les galgames et les manga avec du texte complexe',
  'model.tooltip.sakura_galtransl_7b_v3_7.bestFor':
    'La meilleure option pour traduire le japonais vers le chinois quand la qualité est plus importante que la vitesse',
  'model.tooltip.sakura_galtransl_7b_v3_7.performance':
    'Nécessite une carte graphique avec au moins 6 Go de mémoire ; vitesse modérée',
  'model.tooltip.sakura_galtransl_7b_v3_7.notes':
    'Meilleure traduction JP→ZH disponible. Utilisez-le quand la qualité est prioritaire.',

  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.highlights':
    'Traduit le japonais vers le chinois\nVersion légère et rapide\nBon pour les ordinateurs moins puissants',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.unique':
    'Même famille que le Sakura plus grand, mais optimisé pour fonctionner sur des ordinateurs avec moins de mémoire',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.bestFor':
    "Traduire le japonais vers le chinois quand vous n'avez pas de carte graphique puissante",
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.performance':
    'Rapide, nécessite seulement 1-2 Go de mémoire sur la carte graphique',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.notes':
    'Bonne qualité pour sa taille — idéal si le modèle plus grand est trop lourd',

  'model.tooltip.hunyuan_7b_mt_v1_0.highlights':
    'Traduit entre 36 langues\nHaute qualité primée en compétition\nUn modèle puissant pour de nombreuses langues',
  'model.tooltip.hunyuan_7b_mt_v1_0.unique':
    "L'un des traducteurs les plus primés au monde — combine plusieurs traductions pour livrer le meilleur résultat possible",
  'model.tooltip.hunyuan_7b_mt_v1_0.bestFor':
    "Quand vous avez besoin d'une traduction de haute qualité entre de nombreuses langues différentes",
  'model.tooltip.hunyuan_7b_mt_v1_0.performance':
    'Nécessite une carte graphique avec 6-8 Go de mémoire ; vitesse modérée',
  'model.tooltip.hunyuan_7b_mt_v1_0.notes':
    'Excellent pour les projets multilingues où la qualité est prioritaire',

  'model.tooltip.font_rtdetr_v2.highlights':
    "Détecte les bulles de dialogue et le texte dans les bandes dessinées\nIdentifie le texte à l'intérieur et à l'extérieur des bulles\nTout en une seule passe",
  'model.tooltip.font_rtdetr_v2.unique':
    'Le seul qui détecte les bulles, le texte dans les bulles et le texte libre sur la page en même temps',
  'model.tooltip.font_rtdetr_v2.bestFor':
    'Analyse complète des pages de BD — sépare automatiquement les dialogues du texte libre',
  'model.tooltip.font_rtdetr_v2.performance':
    'Léger et rapide, fonctionne bien sur la plupart des ordinateurs',
  'model.tooltip.font_rtdetr_v2.notes':
    'Entraîné avec du manga, webtoon, manhua et des comics occidentaux',

  'model.tooltip.comic_text_detector.highlights':
    "Détecte le texte dans les BD et le manga\nModèle original et fiable\nFonctionne rapidement sur n'importe quel ordinateur",
  'model.tooltip.comic_text_detector.unique':
    'Le détecteur classique utilisé comme base par de nombreux projets de traduction de manga',
  'model.tooltip.comic_text_detector.bestFor':
    'Détection basique et fiable du texte dans les BD — bon choix par défaut',
  'model.tooltip.comic_text_detector.performance':
    'Rapide, fonctionne bien sans carte graphique dédiée',
  'model.tooltip.comic_text_detector.notes':
    'Modèle classique testé par la communauté au fil des années',

  'model.tooltip.pp_doclayout_v3.highlights':
    "Analyse la mise en page de pages numérisées\nFonctionne même avec des pages de travers ou courbées\nIdentifie l'ordre de lecture correct",
  'model.tooltip.pp_doclayout_v3.unique':
    'Capable de comprendre des pages photographiées de travers ou numérisées de façon irrégulière — quelque chose que les autres modèles ne font pas',
  'model.tooltip.pp_doclayout_v3.bestFor':
    'Pages numérisées de façon imparfaite, photos de livres ou mises en page complexes avec un ordre de lecture difficile',
  'model.tooltip.pp_doclayout_v3.performance':
    "Robuste et fiable, fonctionne bien dans diverses conditions d'éclairage",
  'model.tooltip.pp_doclayout_v3.notes':
    'Utile quand les pages ne sont pas parfaitement numérisées',

  'model.tooltip.manga_ocr.highlights':
    'Lit le texte japonais dans le manga\nFonctionne avec le texte vertical et horizontal\nLe plus recommandé pour le manga japonais',
  'model.tooltip.manga_ocr.unique':
    'Conçu spécialement pour les défis du manga : texte vertical, furigana, polices stylisées et images de basse qualité',
  'model.tooltip.manga_ocr.bestFor':
    'Le choix par défaut pour lire le texte de manga japonais — fonctionne bien directement, sans réglages',
  'model.tooltip.manga_ocr.performance':
    'Populaire et fiable, utilisé par de nombreux projets de scanlation',
  'model.tooltip.manga_ocr.notes':
    'Meilleure option pour le manga japonais. Si vous avez besoin de vitesse, envisagez Meiki OCR.',

  'model.tooltip.meiki_ocr.highlights':
    'Lecteur de texte japonais ultra-rapide\nDétecte chaque caractère individuellement\nIdéal pour le texte horizontal',
  'model.tooltip.meiki_ocr.unique':
    'Beaucoup plus rapide que les autres lecteurs de texte japonais — parfait quand la vitesse est prioritaire',
  'model.tooltip.meiki_ocr.bestFor':
    'Quand vous devez lire du texte japonais horizontal rapidement',
  'model.tooltip.meiki_ocr.performance':
    "Extrêmement rapide, l'un des plus véloces pour le japonais",
  'model.tooltip.meiki_ocr.notes':
    'Fonctionne uniquement avec le texte horizontal — pour le texte vertical, utilisez Manga OCR',

  'model.tooltip.paddleocr_vl_manga.highlights':
    'Lecteur de texte optimisé pour le manga\nFonctionne avec le texte vertical et horizontal\nBien plus précis sur le manga que le modèle de base',
  'model.tooltip.paddleocr_vl_manga.unique':
    'Entraîné spécifiquement avec des pages de manga — comprend les polices stylisées et les bulles de dialogue mieux que les lecteurs génériques',
  'model.tooltip.paddleocr_vl_manga.bestFor':
    'Lire le texte de manga avec une haute précision, surtout quand le texte est dans des polices difficiles',
  'model.tooltip.paddleocr_vl_manga.performance':
    "Bonne précision sur le manga ; fonctionne aussi avec d'autres langues",
  'model.tooltip.paddleocr_vl_manga.notes':
    'Version spécialisée de PaddleOCR pour le manga — excellent choix pour la scanlation',

  'model.tooltip.got_ocr2.highlights':
    'Lit le texte de documents, tableaux et graphiques\nComprend les formules mathématiques et les partitions\nPolyvalent pour différents types de documents',
  'model.tooltip.got_ocr2.unique':
    'Va au-delà du texte simple — peut lire des tableaux, formules et graphiques formatés',
  'model.tooltip.got_ocr2.bestFor':
    'Lire des documents complexes avec des tableaux et du formatage — pas idéal pour le manga',
  'model.tooltip.got_ocr2.performance':
    'Léger et polyvalent, fonctionne bien pour les documents en général',
  'model.tooltip.got_ocr2.notes':
    "Multilingue mais pas optimisé pour le manga — utilisez d'autres modèles pour les BD",

  'model.tooltip.qwen2_5_vl_3b.highlights':
    "Comprend les images de façon intelligente\nVa au-delà de la lecture du texte — comprend le contenu de l'image\nMultilingue et polyvalent",
  'model.tooltip.qwen2_5_vl_3b.unique':
    "Ne se contente pas de lire le texte — comprend les panneaux de manga, décrit les scènes et extrait des informations structurées de l'image",
  'model.tooltip.qwen2_5_vl_3b.bestFor':
    "Quand vous avez besoin que le modèle comprenne le contenu de l'image, pas seulement lire le texte",
  'model.tooltip.qwen2_5_vl_3b.performance':
    'Taille modérée ; bonne vitesse sur les cartes graphiques courantes',
  'model.tooltip.qwen2_5_vl_3b.notes':
    "Multilingue. Utile pour l'analyse de panneaux et la compréhension visuelle avancée",

  'model.tooltip.mangalmm.highlights':
    "Comprend les panneaux de manga comme un lecteur humain\nIdentifie les personnages et les éléments de l'histoire\nVa au-delà de la simple lecture du texte",
  'model.tooltip.mangalmm.unique':
    'Le seul modèle conçu spécifiquement pour comprendre le manga — reconnaît les personnages, les panneaux et la narration visuelle',
  'model.tooltip.mangalmm.bestFor':
    'Analyse avancée du manga : comprendre qui parle, ce qui se passe dans les panneaux',
  'model.tooltip.mangalmm.performance':
    'Nécessite une carte graphique puissante avec 14 Go de mémoire ; encore en phase de recherche',
  'model.tooltip.mangalmm.notes':
    "Modèle expérimental — prometteur pour l'avenir de la scanlation mais pas encore mature",

  'model.tooltip.rolmocr.highlights':
    'Lecteur de texte rapide pour les documents\nFonctionne bien avec les mises en page complexes\nAlternative plus légère et rapide',
  'model.tooltip.rolmocr.unique':
    'Plus rapide et léger que les modèles similaires, tout en maintenant une bonne qualité de lecture de documents',
  'model.tooltip.rolmocr.bestFor':
    'Lire des documents avec des mises en page complexes quand la vitesse est importante',
  'model.tooltip.rolmocr.performance':
    'Rapide et efficace ; bon équilibre entre vitesse et qualité',
  'model.tooltip.rolmocr.notes':
    'Pas spécifique au manga — mieux adapté aux documents et textes généraux',

  'model.tooltip.glm_ocr_onnx.highlights':
    "Lecteur de texte compact et précis\nL'un des plus précis dans les benchmarks\nFonctionne bien sur les ordinateurs moins puissants",
  'model.tooltip.glm_ocr_onnx.unique':
    "Combine haute précision et petite taille — l'un des plus précis malgré sa légèreté",
  'model.tooltip.glm_ocr_onnx.bestFor':
    "Lire des documents avec une haute précision sans avoir besoin d'un ordinateur puissant",
  'model.tooltip.glm_ocr_onnx.performance':
    'Très léger et rapide ; fonctionne bien même sur des ordinateurs sans carte graphique puissante',
  'model.tooltip.glm_ocr_onnx.notes':
    'Supporte plusieurs langues mais le japonais est limité. Excellent pour les documents en général.',

  'model.tooltip.paddleocr.highlights':
    'Lit le texte en russe\nRapide et fiable\nBonne option pour les manhwa en russe',
  'model.tooltip.paddleocr.unique':
    "Optimisé spécifiquement pour l'alphabet cyrillique — meilleur que les lecteurs génériques pour le russe",
  'model.tooltip.paddleocr.bestFor':
    'Lire du texte russe dans les BD et le manga',
  'model.tooltip.paddleocr.performance':
    'Très rapide, fonctionne bien sur la plupart des ordinateurs',
  'model.tooltip.paddleocr.notes': 'Le meilleur choix pour le texte russe',

  'model.tooltip.paddleocr_latin_v5.highlights':
    'Lit le texte dans les langues européennes\nFrançais, allemand, espagnol, portugais et plus\nRapide et fiable',
  'model.tooltip.paddleocr_latin_v5.unique':
    'Optimisé pour les alphabets européens — fonctionne mieux que les lecteurs génériques dans ces langues',
  'model.tooltip.paddleocr_latin_v5.bestFor':
    "Lire du texte dans des langues européennes comme le français, l'allemand, l'espagnol, l'italien et le portugais",
  'model.tooltip.paddleocr_latin_v5.performance':
    "Rapide et léger, fonctionne bien sur n'importe quel ordinateur",
  'model.tooltip.paddleocr_latin_v5.notes':
    "Meilleure option pour les langues européennes avec l'alphabet latin",

  'model.tooltip.paddleocr_ch_v5.highlights':
    'Lit le texte en chinois simplifié et traditionnel\nRapide et précis\nIdéal pour les manhua',
  'model.tooltip.paddleocr_ch_v5.unique':
    'Optimisé spécifiquement pour les caractères chinois — reconnaît mieux les traits complexes et les polices variées',
  'model.tooltip.paddleocr_ch_v5.bestFor':
    'Lire le texte de manhua et tout contenu en chinois avec une haute précision',
  'model.tooltip.paddleocr_ch_v5.performance':
    'Rapide et léger, fonctionne bien sur la plupart des ordinateurs',
  'model.tooltip.paddleocr_ch_v5.notes':
    'Le meilleur choix pour le chinois. Simple et efficace.',

  'model.tooltip.paddleocr_en_v5.highlights':
    'Lit le texte en anglais\nRapide et précis\nIdéal pour les comics occidentaux',
  'model.tooltip.paddleocr_en_v5.unique':
    "Optimisé spécifiquement pour l'anglais — reconnaît mieux les polices et styles variés",
  'model.tooltip.paddleocr_en_v5.bestFor':
    'Lire du texte en anglais dans les comics occidentaux et le manga traduit',
  'model.tooltip.paddleocr_en_v5.performance':
    "Très rapide et léger, fonctionne sur n'importe quel ordinateur",
  'model.tooltip.paddleocr_en_v5.notes':
    'Le meilleur choix pour le texte en anglais',

  'model.tooltip.easyocr.highlights':
    'Lit le texte dans plus de 80 langues\nFacile à utiliser et polyvalent\nPlusieurs langues dans la même image',
  'model.tooltip.easyocr.unique':
    "L'un des plus polyvalents — peut lire de nombreuses langues différentes dans la même image",
  'model.tooltip.easyocr.bestFor':
    "Quand vous avez besoin d'un lecteur qui fonctionne pour de nombreuses langues sans changer de modèle",
  'model.tooltip.easyocr.performance':
    'Bon pour le texte propre ; a du mal avec les polices stylisées et le texte vertical',
  'model.tooltip.easyocr.notes':
    'Pas optimisé pour le manga. Utile comme option générale multilingue.',

  'model.tooltip.pororo.highlights':
    'Lit le texte coréen\nIdéal pour les manhwa coréens\nLéger et fiable',
  'model.tooltip.pororo.unique':
    "Conçu spécifiquement pour l'alphabet coréen (Hangul) — reconnaît mieux que les lecteurs génériques",
  'model.tooltip.pororo.bestFor':
    'Lire le texte de manhwa coréen — la meilleure option dédiée pour le coréen',
  'model.tooltip.pororo.performance':
    'Bonne précision pour le coréen ; léger et rapide',
  'model.tooltip.pororo.notes':
    'Coréen et anglais uniquement. Maintenu par la communauté.',

  'model.tooltip.paddleocr_vl_1_5.highlights':
    "Lecteur de texte avancé multilingue\nL'un des plus précis au monde\nFonctionne avec le japonais, le chinois, l'anglais et plus",
  'model.tooltip.paddleocr_vl_1_5.unique':
    'Capable de détecter du texte dans des formats irréguliers et polygonaux — lit le texte courbé, incliné et dans des positions difficiles',
  'model.tooltip.paddleocr_vl_1_5.bestFor':
    'Lecture de texte avancée pour les documents et les BD dans plusieurs langues',
  'model.tooltip.paddleocr_vl_1_5.performance':
    'Précis et polyvalent ; fonctionne bien sur les cartes graphiques courantes',
  'model.tooltip.paddleocr_vl_1_5.notes':
    'Multilingue incluant japonais, chinois, anglais. Base pour le fine-tuning manga.',

  'model.tooltip.aot.highlights':
    "Supprime le texte japonais du manga\nReconstruit automatiquement l'arrière-plan\nRapide et efficace",
  'model.tooltip.aot.unique':
    "Conçu spécialement pour supprimer le texte du manga — comprend le style artistique et reconstruit l'arrière-plan de façon naturelle",
  'model.tooltip.aot.bestFor':
    "Supprimer le texte japonais des panneaux de manga en reconstruisant l'arrière-plan",
  'model.tooltip.aot.performance':
    'Rapide, fonctionne bien avec ou sans carte graphique',
  'model.tooltip.aot.notes':
    'Bonne option par défaut pour le nettoyage de texte dans le manga',

  'model.tooltip.lama_manga.highlights':
    "Supprime le texte du manga et de l'anime\nFonctionne avec des images de toute taille\nGère bien les grandes zones de texte",
  'model.tooltip.lama_manga.unique':
    "Pas de limite de taille d'image — fonctionne avec des pages de toute résolution, contrairement aux autres modèles",
  'model.tooltip.lama_manga.bestFor':
    'Supprimer le texte de pages de manga de toute taille, surtout les gros blocs de texte et les bulles',
  'model.tooltip.lama_manga.performance':
    "Accepte toute taille d'image ; bonne vitesse sur la plupart des ordinateurs",
  'model.tooltip.lama_manga.notes':
    "Version améliorée de LaMa — utilisez-le quand la page est grande ou qu'il y a beaucoup de texte à supprimer",

  'model.tooltip.opencv_lama.highlights':
    'Supprime le texte des images\nVersion légère et simple\nBon pour un usage général',
  'model.tooltip.opencv_lama.unique':
    'Version officielle maintenue par OpenCV — intégration directe et fiable',
  'model.tooltip.opencv_lama.bestFor':
    "Suppression de texte basique et rapide quand vous n'avez pas besoin de la qualité maximale",
  'model.tooltip.opencv_lama.performance':
    "Léger et rapide, fonctionne sur n'importe quel ordinateur",
  'model.tooltip.opencv_lama.notes':
    'Bonne option légère pour un nettoyage de texte simple',

  'model.tooltip.lama_fp32.highlights':
    'Supprime le texte des images en haute qualité\nMeilleure qualité parmi les outils de suppression\nIdéal quand la qualité compte plus que la vitesse',
  'model.tooltip.lama_fp32.unique':
    "La version la plus fidèle et précise de LaMa — reproduit l'arrière-plan de façon plus naturelle que les versions légères",
  'model.tooltip.lama_fp32.bestFor':
    'Quand la qualité du nettoyage est plus importante que la vitesse',
  'model.tooltip.lama_fp32.performance':
    'Plus lent que les versions légères ; nécessite plus de mémoire',
  'model.tooltip.lama_fp32.notes':
    "Utilisez-le quand la qualité est prioritaire. Taille d'entrée fixe.",

  'model.tooltip.waifu2x_swin_unet_art_scan_2x.highlights':
    "Améliore les scans d'anime en 2x\nSupprime le bruit et améliore la qualité\nIdéal pour les scans de manga",
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.unique':
    "Le classique pour améliorer les scans d'anime et de manga — supprime le bruit et améliore l'image en même temps",
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.bestFor':
    'Améliorer les scans de manga basse résolution et supprimer les artefacts de compression JPEG',
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.performance':
    "Léger et rapide, fonctionne sur n'importe quel ordinateur",
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.notes':
    'Bonne option par défaut pour améliorer les scans de manga en 2x',

  'model.tooltip.waifu2x_swin_unet_art_scan_4x.highlights':
    "Améliore les scans d'anime en 4x\nSupprime le bruit et améliore la qualité\nPour quand vous avez besoin de plus de détails",
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.unique':
    'Version 4x du classique Waifu2x — améliore beaucoup plus la résolution en gardant des lignes nettes',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.bestFor':
    'Améliorer les scans de manga avec une augmentation de résolution plus importante et préserver un line art propre',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.performance':
    'Plus lent que la version 2x ; reste léger quand même',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.notes':
    'Utilisez-le quand vous avez besoin de plus de résolution que ce que le 2x offre',

  'model.tooltip.waifu2x_swin_unet_art_2x.highlights':
    "Améliore l'art d'anime en 2x\nPour de l'art déjà propre et de bonne qualité\nPréserve les détails fins",
  'model.tooltip.waifu2x_swin_unet_art_2x.unique':
    "Optimisé pour de l'art déjà propre — préserve les détails fins sans ajouter de bruit",
  'model.tooltip.waifu2x_swin_unet_art_2x.bestFor':
    "Améliorer de l'art numérique propre et du manga qui a déjà une bonne qualité d'origine",
  'model.tooltip.waifu2x_swin_unet_art_2x.performance':
    "Léger et rapide, fonctionne sur n'importe quel ordinateur",
  'model.tooltip.waifu2x_swin_unet_art_2x.notes':
    "Moins agressif que la version pour scans — utilisez-le quand l'image est déjà propre",

  'model.tooltip.4xnomos2_hq_mosr.highlights':
    'Agrandit les images en 4x avec une qualité maximale\nPréserve les détails fins et les lignes nettes\nIdéal pour les scans déjà propres',
  'model.tooltip.4xnomos2_hq_mosr.unique':
    "Axé sur la qualité — garde chaque détail de l'image originale intact",
  'model.tooltip.4xnomos2_hq_mosr.bestFor':
    'Améliorer les scans de manga qui sont déjà propres et de bonne qualité',
  'model.tooltip.4xnomos2_hq_mosr.performance':
    'Bonne vitesse ; fichier léger de seulement 16 Mo',
  'model.tooltip.4xnomos2_hq_mosr.notes':
    "Fonctionne mieux avec des images déjà propres. Si l'image a du bruit ou de la compression, nettoyez-la d'abord.",

  'model.tooltip.4xspankendata.highlights':
    'Agrandit les images en 4x de façon très rapide\nFichier minuscule de seulement 1,6 Mo\nFonctionne bien même sur les ordinateurs moins puissants',
  'model.tooltip.4xspankendata.unique':
    "Extrêmement léger — parfait quand vous avez besoin de vitesse sans occuper d'espace",
  'model.tooltip.4xspankendata.bestFor':
    "Upscale rapide de tout type d'image quand le temps est important",
  'model.tooltip.4xspankendata.performance':
    'Très rapide ; fichier de seulement 1,6 Mo — idéal pour le CPU',
  'model.tooltip.4xspankendata.notes':
    "Étonnamment petit pour la qualité qu'il délivre. Excellente option pour le traitement par lots.",

  'model.tooltip.2x_hfa2kcompact.highlights':
    "Agrandit les images en 2x avec un bon équilibre\nEntraîné sur des images d'anime moderne\nGère bien la compression et le flou",
  'model.tooltip.2x_hfa2kcompact.unique':
    "Spécialiste de l'anime — comprend le style visuel des animations modernes",
  'model.tooltip.2x_hfa2kcompact.bestFor':
    'Pages de manga/anime avec des artefacts de compression ou une qualité irrégulière',
  'model.tooltip.2x_hfa2kcompact.performance':
    'Rapide et léger ; fichier de seulement 4,6 Mo',
  'model.tooltip.2x_hfa2kcompact.notes':
    'Robuste pour les images réelles — fonctionne bien même avec des scans imparfaits.',

  'model.tooltip.2x_digitalfilm_superultracompact.highlights':
    "Agrandit les images en 2x avec une taille minimale\nIdéal quand l'espace disque est limité\nBonne qualité pour sa taille",
  'model.tooltip.2x_digitalfilm_superultracompact.unique':
    'Ultra-compact — tient partout sans sacrifier la qualité',
  'model.tooltip.2x_digitalfilm_superultracompact.bestFor':
    "Upscale léger quand vous devez économiser de l'espace ou de la mémoire",
  'model.tooltip.2x_digitalfilm_superultracompact.performance':
    'Rapide ; ~20 Mo ; peut nécessiter une conversion manuelle',
  'model.tooltip.2x_digitalfilm_superultracompact.notes':
    'Si le fichier ne se charge pas, il peut être nécessaire de convertir le format en externe.',

  'model.tooltip.2x_anifilm_compact.highlights':
    "Agrandit les images en 2x optimisé pour l'anime\nBon équilibre entre qualité et taille\nStyle visuel préservé",
  'model.tooltip.2x_anifilm_compact.unique':
    "Comprend le style visuel de l'anime et des films d'animation — conserve l'esthétique originale",
  'model.tooltip.2x_anifilm_compact.bestFor':
    'Contenu anime où vous voulez garder le rendu original sans exagération',
  'model.tooltip.2x_anifilm_compact.performance':
    'Rapide ; ~20 Mo ; peut nécessiter une conversion manuelle',
  'model.tooltip.2x_anifilm_compact.notes':
    'Si le fichier ne se charge pas, il peut être nécessaire de convertir le format en externe.',

  'model.tooltip.2xnomosuni_span_multijpg_ldl.highlights':
    'Agrandit les images en 2x avec résistance à la compression\nEntraîné pour gérer différents niveaux de qualité JPG\nRobuste pour les scans imparfaits',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.unique':
    'Spécialiste de la gestion de la compression JPG — fonctionne bien même avec des scans de basse qualité',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.bestFor':
    'Scans de manga avec compression JPG variable ou artefacts de qualité',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.performance':
    'Rapide ; ~20 Mo ; peut nécessiter une conversion manuelle',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.notes':
    'Si le fichier ne se charge pas, il peut être nécessaire de convertir le format en externe.',

  'model.tooltip.realesrgan_x4plus.highlights':
    'Agrandit les images en 4x avec une grande polyvalence\nGère bien le JPEG, le flou et le bruit\nFonctionne avec tout type de contenu',
  'model.tooltip.realesrgan_x4plus.unique':
    "Le plus polyvalent — comprend et corrige différents types de dégradation d'image",
  'model.tooltip.realesrgan_x4plus.bestFor':
    "Pages de manga avec contenu mixte ; artefacts JPEG ; l'upscaler le plus polyvalent",
  'model.tooltip.realesrgan_x4plus.performance':
    'Bonne vitesse ; un peu plus lourd que les compacts',
  'model.tooltip.realesrgan_x4plus.notes':
    "Pour de l'anime/manga pur, préférez la version anime (6B) qui est plus rapide et optimisée.",

  'model.tooltip.4xhfa2kludvaeswinir_light.highlights':
    "Agrandit les images en 4x optimisé pour l'anime\nBon équilibre entre qualité et performance\nPréserve le style visuel anime",
  'model.tooltip.4xhfa2kludvaeswinir_light.unique':
    "Combine qualité d'upscale et attention aux détails visuels de l'anime",
  'model.tooltip.4xhfa2kludvaeswinir_light.bestFor':
    "Upscale 4x de contenu anime avec une bonne qualité d'origine",
  'model.tooltip.4xhfa2kludvaeswinir_light.performance':
    'Vitesse modérée ; ~70 Mo ; peut nécessiter une conversion manuelle',
  'model.tooltip.4xhfa2kludvaeswinir_light.notes':
    'Si le fichier ne se charge pas, il peut être nécessaire de convertir le format en externe.',

  'model.tooltip.baka_content_cc.highlights':
    'Sépare le texte des bulles dans les pages de BD\nIdentifie ce qui est du texte et ce qui est une bulle\nRapide et efficace',
  'model.tooltip.baka_content_cc.unique':
    'Intégré au système de détection de texte et de bulles — fonctionne en synergie avec les autres modèles',
  'model.tooltip.baka_content_cc.bestFor':
    'Séparer le texte et les bulles dans les pages de manga pour un traitement ultérieur',
  'model.tooltip.baka_content_cc.performance':
    'Rapide et léger, ne nécessite pas de carte graphique puissante',
  'model.tooltip.baka_content_cc.notes':
    'Utilisé comme partie du pipeline de segmentation',
  'settings.tooltips.title': 'Info-bulles',
  'settings.tooltips.description':
    "Contrôlez quand les conseils contextuels apparaissent lors de l'utilisation du tableau de bord.",
  'settings.tooltips.enableTitle': 'Afficher les conseils contextuels',
  'settings.tooltips.enableDesc':
    'Affiche des conseils animés la première fois que vous utilisez chaque outil par session.',
  'dashboard.hint.healing.ariaLabel': "Conseil de l'outil Healing",
  'dashboard.hint.healing.eyebrow': 'Nouvel outil',
  'dashboard.hint.healing.body':
    "Utilisez le Healing Brush pour supprimer les défauts, les bords cassés et les résidus de texte. Peignez sur la zone à corriger et cliquez sur Appliquer pour que l'IA reconstruise la région de manière imperceptible.",
  'dashboard.hint.healing.footer':
    "Ce conseil n'apparaîtra plus durant cette session. Désactivez tous les conseils dans Paramètres → App.",
  'dashboard.aio.presets.tooltip':
    "Les préréglages enregistrent une combinaison de modèles et d'étapes par langue. Utilisez-les pour changer plus rapidement votre configuration AIO lors du changement de langue source ou de workflow.",
  'dashboard.aio.presets.tooltipAria':
    'À quoi servent les préréglages de langue',
  'dashboard.aio.cleanImage.tooltip':
    "Clean Image est l'étape de nettoyage et de retouche. Elle supprime le texte et les artefacts sélectionnés avant le passage de rendu/modification final.",
  'dashboard.aio.cleanImage.tooltipAria': 'À quoi sert Clean Image',
  'dashboard.aio.clean.maskDilation.tooltip':
    'Agrandit le masque de nettoyage avant la retouche. Augmentez-le si les bords du texte persistent ; gardez-le plus bas pour préserver les illustrations à proximité.',
  'dashboard.aio.clean.maskDilation.tooltipAria':
    'À quoi sert la dilatation du masque',
  'dashboard.dashboardLlm.hdStrategy.tooltip':
    "Définit comment les grandes images sont préparées avant le nettoyage. Resize redimensionne la page, Crop la divise en tuiles, et Original l'envoie telle quelle.",
  'dashboard.dashboardLlm.hdStrategy.tooltipAria':
    'À quoi sert la stratégie HD',
  'dashboard.dashboardLlm.cropMargin.tooltip':
    'Ajoute un espacement supplémentaire autour de chaque tuile de recadrage. Augmentez-le si les bordures perdent leur contexte ou montrent des coutures après le nettoyage.',
  'dashboard.dashboardLlm.cropMargin.tooltipAria':
    'À quoi sert la marge de recadrage',
  'dashboard.dashboardLlm.cropTriggerSize.tooltip':
    "Taille minimale de l'image qui active le tuilage de recadrage. Les images plus petites restent en un seul morceau ; les plus grandes sont divisées en tuiles.",
  'dashboard.dashboardLlm.cropTriggerSize.tooltipAria':
    'À quoi sert la taille de déclenchement du recadrage',
  'common.basicInfo': "Informations de base",
  'common.resolve': "Résoudre",
  'common.dismiss': "Rejeter",
  'common.title': "Titre",
  'common.summary': "Résumé",
  'common.summaryPlaceholder': "Écris un résumé court et clair.",
  'common.mainDescription': "Description principale",
  'common.chapter': "Chapitre",
  'common.genres': "Genres",
  'common.editorialDescription': "Description éditoriale",
  'common.removeValue': "Supprimer {value}",
  'settings.integrations.discordWebhook': "Webhook Discord",
  'discord.presence.appName': "KŌMA Studio",
  'discord.presence.button.website': "Site web",
  'discord.presence.button.download': "Télécharger",
  'discord.presence.idle.details': "Explore les outils de scanlation",
  'discord.presence.idle.state': "Inactif",
  'discord.presence.workspace.details': "Organise les pages et prépare le flux",
  'discord.presence.aio.details': "Exécute le pipeline manga de bout en bout",
  'discord.presence.mode.automatic': "Mode automatique",
  'discord.presence.mode.manual': "Mode manuel",
  'discord.presence.mode.basic': "Mode : Basique",
  'discord.presence.mode.advanced': "Mode : Avancé",
  'discord.presence.cleaner.details': "Nettoie les bulles et restaure l'illustration",
  'discord.presence.cleaner.state.basic': "Mode : Basique",
  'discord.presence.cleaner.state.advanced': "Mode : Avancé",
  'discord.presence.translator.details': "Traduit les dialogues sans perdre le ton",
  'discord.presence.translator.fileDetails': "Traduction - {fileName}",
  'discord.presence.typesetter.details': "Replace le texte final dans la page",
  'discord.presence.typesetter.fileDetails': "Édition du texte - {fileName}",
  'discord.presence.redraw.fileDetails': "Redessin - {fileName}",
  'discord.presence.raw.details': "Teste les fournisseurs et compare les sorties brutes",
  'discord.presence.proofreader.details': "Relit les pages avant la version finale",
  'discord.presence.stitch.details': "Assemble les cases en longues pages fluides",
  'discord.presence.split.details': "Découpe les doubles pages en pages propres",
  'discord.presence.watermark.details': "Appose crédits et identité visuelle",
  'discord.presence.enhance.details': "Améliore la résolution et la netteté",
  'discord.presence.optimizer.details': "Peaufine les chapitres pour l'export et la livraison",
  'discord.presence.blogger.details': "Prépare les publications de chapitres et la diffusion CDN",
  'discord.presence.imgur.details': "Envoie des lots d'images et partage les liens",
  'discord.presence.guides.details': "Découvre workflows, raccourcis et bonnes pratiques",
  'discord.presence.resources.details': "Parcourt ressources, références et aide",
  'discord.presence.batch.details': "Traite les pages les unes après les autres",
  'discord.presence.batch.fileDetails': "Traitement du lot - {fileName}",
  'discord.presence.batch.state': "{current}/{total} fichiers",
  'discord.presence.batch.label': "Mode lot",
  'discord.presence.section.working': "Travail dans {section}",
  'discord.presence.section.viewing': "Affichage de {section}",
  'discord.presence.settings.details': "Ajuste les préférences du studio",
  'discord.presence.settings.label': "Paramètres",
  'discord.presence.rankings.details': "Compare la qualité, la vitesse et le coût des modèles",
  'discord.presence.rankings.label': "Classements",
  'discord.presence.scanlationFeed.details': "Consulte les sorties et nouveautés de la communauté",
  'discord.presence.scanlationFeed.label': "Flux Scanlation",
  'discord.presence.loginRegister.details': "Se connecte et gère l'accès au compte",
  'discord.presence.loginRegister.label': "Connexion / Inscription",
  'typographer.shapeApplied': "Forme appliquée.",
  'feed.tabsAria': "Sections du flux Scanlation",
  'feed.actions.publishPost': "Publier {type}",
} as const;
