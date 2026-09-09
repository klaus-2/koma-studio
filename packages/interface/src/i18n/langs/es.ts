import { TranslationCatalog } from '../messages';

export const esMessages: TranslationCatalog = {
  'app.restricted.title': 'Acceso restringido',
  'app.restricted.description':
    'Esta versión solo está disponible en la aplicación de escritorio oficial.',
  'app.restricted.publicDocs':
    'Los documentos legales siguen disponibles públicamente:',
  'app.transition.loading': 'Cargando...',
  'app.transition.enterDashboard': 'Entrando al panel...',
  'app.transition.updateSession': 'Actualizando sesión...',
  'app.transition.openFeed': 'Abriendo el Feed de Scanlation...',
  'app.transition.openRankings': 'Abriendo rankings de modelos...',
  'app.transition.openSettings': 'Abriendo ajustes...',
  'app.session.validating': 'Validando sesión...',
  'settings.tabs.general': 'General',
  'settings.tabs.presets': 'Preajustes',
  'settings.tabs.integrations': 'Integraciones',
  'shortcutModal.title': 'Centro de atajos',
  'shortcutModal.subtitle':
    'Los atajos globales solo se activan en el panel, nunca en campos de texto.',
  'shortcutModal.hotkeyHint': 'H para abrir',
  'shortcutModal.close': 'Cerrar',
  'shortcutModal.instructionPrefix': 'Haz clic en ',
  'shortcutModal.instructionRecord': 'Grabar',
  'shortcutModal.instructionSuffix':
    ', luego presiona la combinación de teclas deseada. Los conflictos se detectan automáticamente.',
  'shortcutModal.searchPlaceholder': 'Buscar atajos, acciones o teclas...',
  'shortcutModal.results_one': '{count} resultado',
  'shortcutModal.results_other': '{count} resultados',
  'shortcutModal.recording': 'Grabando…',
  'shortcutModal.record': 'Grabar',
  'shortcutModal.restoreDefault': 'Restaurar predeterminado',
  'shortcutModal.clearShortcut': 'Borrar atajo',
  'shortcutModal.conflict': 'Conflicto: "{label}" ({combo})',
  'shortcutModal.fixedShortcuts': 'Atajos contextuales fijos',
  'shortcutModal.fixed': 'Fijo',
  'shortcutModal.noResults': 'No se encontraron atajos para "{query}".',
  'shortcutModal.restoreAll': 'Restaurar todos',
  'toolbar.modelSelect.label': 'Modelo de traducción',
  'toolbar.modelSelect.manage': 'Gestionar modelos',
  'toolbar.modelSelect.select': 'Selecciona un modelo',
  'toolbar.modelSelect.groupLocal': '── Modelos locales (instalados) ──',
  'toolbar.modelSelect.groupCloud': '── Nube/API/IA ──',
  'toolbar.modelSelect.localPrefix': '[Local]',
  'toolbar.modelSelect.cloudPrefix': '[Nube]',
  'toolbar.modelSelect.updateAvailable': '(Actualización disponible)',
  'toolbar.modelSelect.installedCount_one': '{count} modelo instalado',
  'toolbar.modelSelect.installedCount_other': '{count} modelos instalados',
  'toolbar.modelSelect.updates_one': '{count} actualización pendiente',
  'toolbar.modelSelect.updates_other': '{count} actualizaciones pendientes',
  'toolbar.modelSelect.noUpdates': 'Sin actualizaciones pendientes',
  'toolbar.modelSelect.emptyState':
    'No hay modelos compatibles con {source} → {target}.',
  'toolbar.modelSelect.incompatibleWarning':
    '"{model}" no admite {source} → {target}. Selecciona un modelo compatible o cambia el idioma de destino.',
  'settings.tabs.app': 'Aplicación',
  'settings.backToDashboard': 'Volver al panel',
  'settings.stats.version': 'versión',
  'settings.app.updater.status.idle': 'Inactivo',
  'settings.app.updater.status.checking': 'Comprobando…',
  'settings.app.updater.status.available': 'Actualización disponible',
  'settings.app.updater.status.notAvailable': 'Al día',
  'settings.app.updater.status.downloading': 'Descargando…',
  'settings.app.updater.status.downloaded': 'Listo para instalar',
  'settings.app.updater.status.error': 'Error',
  'settings.app.updater.channel.stable': 'Estable (Recomendado)',
  'settings.app.updater.channel.beta': 'Beta (Funciones anticipadas)',
  'settings.app.updater.channel.canary': 'Canary (Inestable)',
  'settings.app.updater.version': 'Versión',
  'settings.app.updater.build': 'Compilación',
  'settings.app.updater.releaseNotes': 'Notas de la versión',
  'settings.app.updater.noNotes': 'No hay notas para esta versión.',
  'settings.app.updater.checkNow': 'Buscar actualizaciones',
  'settings.app.updater.installNow': 'Reiniciar y actualizar',
  'settings.app.updater.desktopOnly':
    'Disponible solo en la aplicación de escritorio.',
  'settings.app.updater.autoCheck': 'Comprobación automática',
  'settings.app.updater.autoCheckDesc': 'Buscar nuevas versiones al iniciar.',
  'settings.app.updater.channel': 'Canal de actualización',
  'settings.app.updater.channelDesc': 'Versiones estables o experimentales.',
  'settings.app.fonts.title': 'Fuentes del sistema',
  'settings.app.fonts.desc':
    'Gestiona las fuentes para el Tipógrafo y el renderizado.',
  'settings.app.fonts.systemCount': '{count} fuentes detectadas',
  'settings.app.fonts.customTitle': 'Fuentes personalizadas',
  'settings.app.fonts.import': 'Importar .ttf / .otf',
  'settings.app.fonts.noCustom': 'No se han importado fuentes personalizadas.',
  'settings.app.fonts.importSuccess': 'Fuente {name} importada correctamente.',
  'settings.app.fonts.importError': 'Error al importar la fuente.',
  'settings.app.fonts.deleteConfirm': '¿Deseas eliminar la fuente {name}?',
  'settings.app.autosave.title': 'Autoguardado del espacio de trabajo',
  'settings.app.autosave.desc':
    'Guardar automáticamente el progreso del proyecto de forma local.',
  'settings.app.autosave.enabled': 'Autoguardado activado',
  'settings.app.autosave.interval': 'Intervalo (minutos)',
  'settings.app.autosave.saveNow': 'Guardar ajustes',
  'settings.app.autosave.success': 'Ajustes de autoguardado actualizados.',
  'settings.app.autosave.error': 'Error al guardar los ajustes.',
  'settings.app.reset.title': 'Zona de peligro',
  'settings.app.reset.desc':
    'Borrar datos locales y restaurar ajustes predeterminados.',
  'settings.app.reset.button': 'Restablecer aplicación',
  'settings.app.reset.confirm':
    'Esto cerrará tu sesión y eliminará todos los preajustes y cachés locales. ¿Deseas continuar?',
  'settings.app.reset.success': 'Aplicación restablecida. Reiniciando...',
  'settings.general.profile.title': 'Perfil',
  'settings.general.profile.desc':
    'Tu información de cuenta y preferencias globales.',
  'settings.general.profile.name': 'Nombre para mostrar',
  'settings.general.profile.email': 'Correo principal',
  'settings.general.profile.verified': 'Correo verificado',
  'settings.general.profile.unverified': 'Correo pendiente',
  'settings.general.profile.verifyBtn': 'Verificar ahora',
  'settings.general.profile.sending': 'Enviando...',
  'settings.general.profile.verifySuccess': 'Correo de verificación enviado.',
  'settings.general.profile.verifyError': 'Error al enviar el correo.',
  'settings.general.profile.save': 'Guardar perfil',
  'settings.general.profile.success': 'Perfil actualizado correctamente.',
  'settings.general.profile.error': 'Error al actualizar el perfil.',
  'settings.general.travel.title': 'Token de viaje',
  'settings.general.travel.desc':
    'Accede a tu cuenta Studio en otros dispositivos sin cerrar sesión.',
  'settings.general.travel.active': 'Token activo',
  'settings.general.travel.inactive': 'Sin token activo',
  'settings.general.travel.generate': 'Generar nuevo token',
  'settings.general.travel.generateDesc': 'Válido por {days} días.',
  'settings.general.travel.copyAria': 'Copiar token',
  'settings.general.travel.revoke': 'Revocar todos',
  'settings.general.travel.revoked': 'Tokens revocados.',
  'settings.general.travel.success': 'Token generado correctamente.',
  'settings.general.travel.error': 'Error al procesar el token.',
  'settings.general.language.title': 'Interfaz',
  'settings.general.language.desc': 'Idioma y tema de la aplicación.',
  'settings.general.language.label': 'Idioma',
  'settings.general.language.system': 'Seguir sistema',
  'settings.general.theme.label': 'Tema',
  'settings.general.theme.dark': 'Oscuro (Predeterminado)',
  'settings.general.theme.light': 'Claro',
  'settings.general.theme.amoled': 'OLED / Negro',
  'settings.presets.aio.title': 'Preajustes AIO',
  'settings.presets.aio.desc':
    'Configura los modelos predeterminados para cada etapa e idioma.',
  'settings.presets.aio.active': 'Preajuste activo para {lang}',
  'settings.presets.aio.none': 'No hay preajustes configurados.',
  'settings.presets.aio.create': 'Nuevo preajuste',
  'settings.presets.aio.edit': 'Editar preajuste',
  'settings.presets.aio.delete': 'Eliminar preajuste',
  'settings.presets.aio.name': 'Nombre del preajuste',
  'settings.presets.aio.lang': 'Idioma de origen',
  'settings.presets.aio.models': 'Configuración de modelos',
  'settings.presets.aio.save': 'Guardar preajuste',
  'settings.presets.aio.success': 'Preajuste guardado correctamente.',
  'settings.presets.aio.error': 'Error al guardar el preajuste.',
  'settings.presets.typo.title': 'Preajustes del Tipógrafo',
  'settings.presets.typo.desc':
    'Estilos de fuente, colores y globos preconfigurados.',
  'settings.presets.render.title': 'Estilos de renderizado',
  'settings.presets.render.desc':
    'Configura cómo se dibuja el texto en la imagen final.',
  'settings.integrations.discord.title': 'Webhook de Discord',
  'settings.integrations.discord.desc':
    'Notificaciones automáticas para tu servidor.',
  'settings.integrations.discord.url': 'URL del webhook',
  'settings.integrations.discord.test': 'Probar conexión',
  'settings.integrations.discord.events': 'Eventos de activación',
  'settings.integrations.discord.success':
    'Configuración guardada y prueba enviada.',
  'settings.integrations.discord.error':
    'Error al guardar o probar el webhook.',
  'settings.integrations.discord.invalidUrl': 'URL del webhook no válida.',
  'settings.integrations.blogger.successSecure':
    'Configuración de Blogger guardada en el almacenamiento seguro del escritorio.',
  'settings.integrations.blogger.successLocal':
    'Configuración de Blogger guardada localmente.',
  'settings.integrations.blogger.saveError':
    'Error al guardar la configuración de Blogger.',
  'settings.integrations.blogger.testError':
    'Error al validar la conexión con Blogger.',
  'settings.integrations.imgur.successSecure':
    'Configuración de Imgur guardada en el almacenamiento seguro del escritorio.',
  'settings.integrations.imgur.successLocal':
    'Configuración de Imgur guardada localmente.',
  'settings.integrations.imgur.saveError':
    'Error al guardar la configuración de Imgur.',
  'settings.travel.blocked.notDesktop':
    'Disponible solo en la aplicación de escritorio autenticada.',
  'settings.travel.blocked.noEmail':
    'El envío de correos no está configurado en este entorno.',
  'settings.travel.blocked.validating': 'Validando configuración de correo…',
  'settings.integrations.blogger.title': 'CDN de Blogger',
  'settings.integrations.blogger.desc':
    'Alojamiento de imágenes y publicación directa.',
  'settings.integrations.imgur.desc':
    'Rotación de Client ID para subidas anónimas.',
  'settings.theme.title': 'Apariencia',
  'settings.theme.description':
    'Elige entre el modo oscuro y claro para la interfaz.',
  'settings.theme.dark': 'Oscuro',
  'settings.theme.darkDesc': 'Interfaz oscura predeterminada',
  'settings.theme.light': 'Claro',
  'settings.theme.lightDesc': 'Interfaz clara',
  'settings.language.title': 'Idioma de la interfaz',
  'settings.language.description':
    'Elige el idioma de la aplicación. En escritorio, la detección inicial usa los idiomas preferidos de tu sistema.',
  'settings.language.label': 'Idioma',
  'settings.language.systemLabel': 'Detectado del sistema',
  'settings.language.applied':
    'Los cambios se aplican de inmediato y se guardan en este dispositivo para compilaciones de desarrollo y empaquetadas.',
  'auth.tabs.login': 'Iniciar sesión',
  'auth.tabs.register': 'Crear cuenta',
  'auth.legal.reviewDocs': 'Al continuar, revisa nuestra documentación legal:',
  'auth.quote.line1': 'Toda gran historia',
  'auth.quote.line2': 'comienza con',
  'auth.quote.line3': 'una sola página.',
  'auth.stats.activeScanlators': 'Usuarios activos',
  'auth.stats.tools': 'Herramientas',
  'auth.stats.pagesProcessed': 'Páginas procesadas',
  'auth.toolkit.ai': 'IA y Automatización',
  'auth.toolkit.tools': 'Herramientas',
  'auth.toolkit.learning': 'Aprendizaje',
  'auth.toolkit.aiTranslation': 'Traducción IA',
  'auth.toolkit.autoRedraw': 'Redibujo automático',
  'auth.toolkit.advancedEditor': 'Editor avanzado',
  'auth.toolkit.proTypesetting': 'Tipografía profesional',
  'auth.toolkit.qualityControl': 'Control de calidad',
  'auth.toolkit.guides': 'Guías y tutoriales',
  'auth.toolkit.resources': 'Recursos y materiales',
  'auth.community.join': 'Únete a la comunidad',
  'auth.cover.popular': 'POPULAR',
  'auth.cover.new': 'NUEVO',
  'auth.cover.cleanRedraw': 'Limpieza + Redibujo',
  'auth.cover.translation': 'Traducción',
  'auth.cover.typography': 'Tipografía',
  'auth.cover.fullEditing': 'Edición completa',
  'auth.cover.allInOne': 'AIO - Todo en uno',
  'auth.cover.finalQc': 'Limpieza final',
  'login.subtitle.credentials':
    'Inicia sesión en tu cuenta y retoma donde lo dejaste.',
  'login.subtitle.travel':
    'Autoriza temporalmente este equipo sin salir del flujo de inicio de sesión.',
  'login.error.completeCaptchaTravel':
    'Completa el captcha para finalizar la autorización de este equipo.',
  'login.error.completeCaptcha': 'Completa el captcha para continuar.',
  'login.error.missingCredentials':
    'Vuelve atrás e introduce el correo y la contraseña de la cuenta antes de autorizar este equipo.',
  'login.error.missingTravelToken':
    'Introduce el token recibido por correo para completar el inicio de sesión.',
  'login.error.generic': 'Error al iniciar sesión',
  'login.warning.mandatoryUpdateTitle': 'Actualización obligatoria disponible',
  'login.warning.mandatoryUpdateBody':
    'Instala la versión {version} para seguir usando la aplicación.',
  'login.warning.downloadUpdate': 'Descargar actualización',
  'login.warning.downloadingUpdate': 'Descargando actualización...',
  'login.warning.installUpdateNow': 'Instalar actualización ahora',
  'login.verification.title': 'Qué hacer',
  'login.verification.wait': 'Espera {seconds} segundos.',
  'login.verification.retrySameDevice':
    'Intenta iniciar sesión de nuevo desde el mismo dispositivo o red.',
  'login.verification.avoidVpn':
    'Evita cambiar de VPN o red durante este período.',
  'login.email': 'Correo electrónico',
  'login.password': 'Contraseña',
  'login.forgotPassword': 'Olvidé mi contraseña',
  'login.rememberMe': 'Recordarme en este dispositivo',
  'login.travel.eyebrow': 'Punto de seguridad',
  'login.travel.title': 'Este equipo necesita autorización temporal',
  'login.travel.copy':
    'Abre KŌMA Studio en tu PC principal y ve a Ajustes > Acceso de viaje para enviar el código y completar este inicio de sesión.',
  'login.travel.accountInUse': 'Cuenta en uso: {email}',
  'login.travel.sameAccount':
    'Usa la misma cuenta que ya tienes abierta en tu PC principal.',
  'login.travel.emailDisabled':
    'El envío de correos no está configurado en este entorno.',
  'login.travel.emailEnabled':
    'El código se enviará al correo principal de la cuenta.',
  'login.travel.step1': 'Abre la aplicación en tu equipo principal.',
  'login.travel.step2': 'Envía el token al correo de la cuenta.',
  'login.travel.step3':
    'Pega el código a continuación para autorizar este equipo.',
  'login.travel.tokenLabel': 'Token de viaje',
  'login.travel.tokenPlaceholder': 'Pega el código recibido por correo',
  'login.button.authorizing': 'Autorizando...',
  'login.button.validating': 'Validando...',
  'login.button.updateRequired': 'Actualiza la app para iniciar sesión',
  'login.button.retryIn': 'Reintentar en {seconds}s',
  'login.button.authorizeComputer': 'Autorizar este equipo',
  'login.button.login': 'Iniciar sesión en mi cuenta',
  'login.button.changeAccount': 'Volver y cambiar de cuenta',
  'login.emailPlaceholder': 'tu@correo.com',
  'login.passwordPlaceholder': '••••••••',
  'login.warning.latestVersion': 'última',
  'login.newHere': '¿Eres nuevo?',
  'login.createFreeAccount': 'Crea tu cuenta gratuita',
  'register.subtitle': 'Crea tu cuenta y comienza a explorar miles de títulos.',
  'register.error.passwordMismatch': 'Las contraseñas no coinciden.',
  'register.error.completeCaptcha':
    'Completa el captcha para finalizar el registro.',
  'register.error.acceptTerms':
    'Debes aceptar los Términos de servicio y la Política de privacidad para crear una cuenta.',
  'register.error.generic': 'Error en el registro',
  'register.displayName': 'Nombre para mostrar',
  'register.displayNamePlaceholder': '¿Cómo quieres que te llamemos?',
  'register.password': 'Contraseña',
  'register.passwordPlaceholder': 'Al menos 8 caracteres',
  'register.confirmPassword': 'Confirmar contraseña',
  'register.confirmPasswordPlaceholder': 'Vuelve a introducir tu contraseña',
  'register.legalPrefix': 'He leído y acepto los',
  'register.legalSuffix':
    'Entiendo que el registro utiliza cookies estrictamente necesarias y que funciones como reportes de errores e integraciones se rigen por los documentos anteriores.',
  'register.button.creating': 'Creando cuenta...',
  'register.button.loginNow': 'Iniciar sesión ahora',
  'legal.links.terms': 'Términos de servicio',
  'legal.links.privacy': 'Política de privacidad',
  'legal.links.cookies': 'Política de cookies',
  'legal.links.content': 'Avisos de contenido',
  'transition.tips.loading': '読み込み中...',
  'transition.tips.preparing': 'Preparando tu estudio...',
  'transition.tips.opening': 'Abriendo tu espacio de edición...',
  'transition.tips.organizing': 'Organizando tus paneles...',
  'transition.tips.warming': 'Calentando las herramientas...',
  'transition.tips.workflow': 'Cargando tu flujo de trabajo...',
  'transition.ariaLabel': 'Página de carga',
  'ranking.discover.title': 'Sé el primero en reseñar',
  'ranking.discover.subtitle':
    'Modelos oficiales sin reseñas bajo el filtro actual.',
  'ranking.discover.available': '{count} disponibles',
  'ranking.discover.empty': 'Todos los modelos filtrados ya tienen reseñas.',
  'ranking.discover.local': 'Local',
  'ranking.discover.cloud': 'Nube',
  'legalHub.version': 'Versión',
  'legalHub.updatedAt': 'Actualizado el',
  'register.button.create': 'Crear mi cuenta',
  'register.alreadyHaveAccount': '¿Ya tienes una cuenta?',
  'password.rule.minLength': 'Al menos 8 caracteres',
  'password.rule.uppercase': 'Letra mayúscula',
  'password.rule.lowercase': 'Letra minúscula',
  'password.rule.number': 'Número',
  'password.rule.special': 'Carácter especial',
  'password.level.veryWeak': 'Muy débil',
  'password.level.weak': 'Débil',
  'password.level.fair': 'Aceptable',
  'password.level.good': 'Buena',
  'password.level.strong': 'Fuerte',
  'captcha.loadError': 'Error al cargar el script de Turnstile',
  'captcha.missingSiteKey':
    'Captcha habilitado, pero VITE_TURNSTILE_SITE_KEY no está configurado.',
  'captcha.initError': 'Error al inicializar el captcha',
  'captcha.securityCheck': 'Verificación de seguridad',
  'captcha.loadScriptError': 'Error al cargar el script de Turnstile',
  'captcha.success': 'Captcha validado correctamente.',
  'forgot.title': 'Recuperar contraseña',
  'forgot.subtitle':
    'Introduce tu correo para recibir un enlace de restablecimiento.',
  'forgot.success':
    'Si existe una cuenta con este correo, recibirás instrucciones para restablecer tu contraseña.',
  'forgot.error': 'Error al solicitar el restablecimiento de contraseña',
  'forgot.button.sending': 'Enviando...',
  'forgot.button.send': 'Enviar enlace de restablecimiento',
  'forgot.remembered': '¿Recuerdas tu contraseña?',
  'forgot.backToLogin': 'Volver a iniciar sesión',
  'reset.title': 'Nueva contraseña',
  'reset.subtitle': 'Establece una contraseña segura para tu cuenta.',
  'reset.error.missingToken':
    'El token de restablecimiento falta o no es válido.',
  'reset.error.generic': 'Error al restablecer la contraseña',
  'reset.success':
    'Contraseña restablecida correctamente. Ya puedes iniciar sesión.',
  'reset.newPassword': 'Nueva contraseña',
  'reset.button.submitting': 'Restableciendo...',
  'reset.button.submit': 'Restablecer contraseña',
  'verify.title': 'Verificación de correo',
  'verify.subtitle.pending':
    'Confirma tu correo para desbloquear todas las funciones.',
  'verify.subtitle.done': 'Tu correo ya está confirmado.',
  'verify.noEmail': 'sin-correo',
  'verify.verified': 'Verificado',
  'verify.success':
    'Correo de confirmación enviado. Revisa tu bandeja de entrada.',
  'verify.error': 'Error al enviar el correo',
  'verify.button.sending': 'Enviando...',
  'verify.button.resend': 'Reenviar correo de verificación',
  'verify.button.alreadyConfirmed': 'Correo ya confirmado',
  'verify.button.backDashboard': 'Volver al panel',
  'confirm.title.verifying': 'Confirmando correo...',
  'confirm.title.success': '¡Correo confirmado!',
  'confirm.title.error': 'Error en la confirmación',
  'confirm.subtitle.verifying': 'Estamos validando tu enlace de confirmación.',
  'confirm.subtitle.success':
    'Tu correo ha sido confirmado. Ya puedes usar todas las funciones.',
  'confirm.subtitle.error':
    'El enlace de confirmación no es válido o ha expirado. Solicita un nuevo correo.',
  'confirm.status.wait': 'Espera mientras verificamos...',
  'confirm.errorCode': 'Código de error:',
  'confirm.success': 'Confirmación completada correctamente.',
  'confirm.goDashboard': 'Ir al panel',
  'confirm.goLogin': 'Ir a iniciar sesión',
  'banned.title': 'Acceso bloqueado',
  'banned.subtitle':
    'Este acceso fue suspendido por la moderación de la aplicación.',
  'banned.reason': 'Motivo',
  'banned.scope': 'Alcance',
  'banned.duration': 'Duración',
  'banned.until': 'Temporal hasta {value}',
  'banned.undefinedDate': 'fecha indefinida',
  'banned.permanent': 'Permanente',
  'banned.policy':
    'Los enlaces, publicaciones maliciosas o comportamiento abusivo pueden resultar en una prohibición permanente de la aplicación.',
  'banned.backToLogin': 'Volver a iniciar sesión',
  'session.expiresIn': 'Tu sesión expira en {seconds}s por inactividad.',
  'session.stayConnected': 'Mantener conexión',
  'update.toast.availableTitle': 'Nueva actualización disponible',
  'update.toast.availableDescription':
    'La versión {version} está lista para descargar en el canal {channel}.',
  'update.toast.downloadedTitle': 'Actualización lista',
  'update.toast.downloadedDescription':
    'Actualización lista. {percent}% completado. Instala ahora o al cerrar la aplicación.',
  'update.toast.downloadingTitle': 'Descargando actualización',
  'update.toast.downloadingDescription': '{percent}% completado.',
  'update.toast.closeAria': 'Cerrar banner de actualización',
  'update.channel.beta': 'Beta',
  'update.channel.stable': 'Estable',
  'update.button.download': 'Descargar',
  'update.button.details': 'Detalles',
  'update.button.installNow': 'Instalar ahora',
  'update.button.installLater': 'Instalar después',
  'update.progress.title': 'Descargando actualización...',
  'update.modal.title': 'Actualización disponible',
  'update.modal.unknownVersion': 'desconocida',
  'update.modal.closeAria': 'Cerrar modal',
  'update.modal.mandatory':
    'Esta actualización es obligatoria. Descárgala e instálala para seguir usando la aplicación.',
  'update.modal.releaseNotes': 'Notas de la versión',
  'update.modal.releaseNotesEmpty':
    'No hay notas de versión disponibles para esta versión.',
  'update.modal.readyProgress': 'Actualización lista. 100% completado.',
  'update.modal.downloadingProgress': 'Descargando actualización...',
  'update.modal.readyToInstall': 'Listo para instalar',
  'update.modal.installHintAuto':
    'Si cierras la aplicación ahora, la instalación comenzará automáticamente.',
  'update.modal.installHintManual':
    'La instalación al cerrar está desactivada. Usa "Instalar después" para activarla y cerrar de forma segura.',
  'update.modal.downloadAction': 'Descargar actualización',
  'update.modal.downloadingAction': 'Descargando...',
  'update.modal.installAction': 'Instalar ahora',
  'update.modal.installLaterAction': 'Instalar después (al cerrar)',
  'update.modal.laterAction': 'Más tarde',
  'dropzone.invalidImageAlert': 'Sube un archivo de imagen válido (PNG/JPG).',
  'dropzone.clickOrDrag': 'Haz clic o arrastra la imagen aquí',
  'dropzone.supports': 'Compatible con PNG y JPG',
  'actionButtons.cleaning': 'Limpiando...',
  'actionButtons.cleanImage': 'Limpiar imagen',
  'actionButtons.downloadResult': 'Descargar resultado',
  'aio.model.manage': 'Modelos',
  'aio.model.noneAvailable': 'No hay modelos disponibles',
  'aio.model.device': 'Dispositivo',
  'aio.model.languages': 'Idiomas',
  'aio.model.languages.multi': 'multi',
  'aio.model.noDescription': 'Sin descripción.',
  'aio.model.localStatus': 'Estado local: {value}',
  'aio.stage.detectText': 'Detectar texto',
  'aio.stage.recognizeText': 'Reconocer texto',
  'aio.stage.getTranslations': 'Obtener traducciones',
  'aio.stage.segmentText': 'Segmentar texto',
  'aio.stage.cleanImage': 'Limpiar imagen',
  'aio.stage.tabsBarAria': 'Configuración de etapas',
  'aio.render.title': 'Texto renderizado',
  'aio.render.description.manual':
    'Haz doble clic en un cuadro para editar en línea. El dock contextual aparece cerca de la selección con el texto renderizado.',
  'aio.render.description.auto':
    'El modo automático aplica el renderizado predeterminado a las regiones traducidas.',
  'aio.render.activePage':
    'Página activa: {count} bloque(s). Seleccionados: {selected}.',
  'aio.render.contextualDock.visible': 'visible al seleccionar',
  'aio.render.contextualDock.doubleClick':
    'haz doble clic para empezar a editar y mostrar el dock',
  'aio.render.contextualDock.select': 'selecciona un cuadro para usar el dock',
  'aio.render.contextualDock': 'Dock contextual: {value}',
  'aio.render.shortcut':
    'Atajo: usa Shift + Scroll en la vista previa para rotar el texto del cuadro seleccionado.',
  'aio.render.inactiveStage':
    'Esta imagen está en una etapa anterior a Renderizar. Avanza para ver/editar el texto renderizado.',
  'aio.render.fontCatalog': 'Catálogo de fuentes',
  'aio.render.refreshFonts': 'Actualizar fuentes',
  'aio.render.refreshingFonts': 'Actualizando...',
  'aio.render.importFont': 'Importar fuente',
  'aio.render.importingFont': 'Importando...',
  'aio.render.importFontTitleDesktop':
    'Importar fuente personalizada en la aplicación de escritorio',
  'aio.render.importFontTitleBrowser':
    'La importación solo está disponible en la aplicación de escritorio',
  'aio.render.desktopFontsHint':
    'Las fuentes de Windows instaladas y las importaciones personalizadas están disponibles en la aplicación de escritorio.',
  'aio.render.overlayControlsHint':
    'Los controles de fuente, tamaño, alineación y color ahora están en el dock contextual del overlay.',
  'aio.render.applyStyleAll': 'Aplicar estilo actual a todas las selecciones',
  'aio.render.applyStyleAllTitle':
    'Aplicar el estilo de la selección actual a todas las selecciones en todas las imágenes',
  'aio.region.title': 'Regiones detectadas',
  'aio.region.description.manual':
    'Arrastra en la vista previa para añadir nuevas áreas. Arrastra un cuadro para moverlo y usa las esquinas para redimensionar.',
  'aio.region.description.auto':
    'Cambia al modo Manual para ajustar los cuadros detectados.',
  'aio.region.activePage':
    'Página activa: {count} región(es). Seleccionadas: {selected}.',
  'aio.region.ocr': 'OCR de la región seleccionada: {value}',
  'aio.region.translation': 'Traducción de la región seleccionada: {value}',
  'aio.region.notes': 'Notas de la región seleccionada: {value}',
  'aio.region.segmentation': 'Segmentación de la región seleccionada: {value}',
  'aio.region.noSelection': 'ninguna',
  'aio.region.noRecognizedText': 'sin texto reconocido',
  'aio.region.ocrDisabled': 'Etapa de OCR desactivada',
  'aio.region.noTranslation': 'sin traducción disponible',
  'aio.region.translationDisabled': 'etapa de traducción desactivada',
  'aio.region.noNotes': 'sin notas disponibles',
  'aio.region.notesDisabled': 'notas desactivadas',
  'aio.region.noSelectedRegion': 'sin región seleccionada',
  'aio.region.segmentedBoxes': '{count} cuadro(s) segmentado(s)',
  'aio.region.removeSelected': 'Eliminar seleccionados',
  'aio.region.duplicateSelected': 'Duplicar seleccionados',
  'aio.manual.toolsHintPrimary':
    'Usa el dock flotante del lienzo para Seleccionar área, Limpiar página y editar segmentación/manual.',
  'aio.manual.toolsHintSecondary':
    'Las herramientas se activan automáticamente según la etapa activa de la imagen.',
  'aio.run.manualNoActive':
    'Selecciona una imagen activa para ejecutar la etapa manual.',
  'aio.run.manualCurrentOnly':
    'Ejecutar solo la etapa actual para la imagen seleccionada.',
  'aio.run.processing': 'Ejecutando {percent}%',
  'aio.run.rerunCurrent': 'Re-ejecutar etapa actual (imagen activa)',
  'aio.run.runCurrent': 'Ejecutar etapa actual (imagen activa)',
  'aio.run.full':
    'Ejecutar AIO (Detectar + OCR + Traducir + Segmentar + Limpiar + Renderizar)',
  'aio.pipeline.textModeTitle': 'Modo de texto',
  'aio.pipeline.textModeDescription':
    'Define cómo se debe tratar la región seleccionada durante el renderizado. AUTO usa la clasificación detectada.',
  'aio.pipeline.currentSelectionMode': 'Modo de la selección actual',
  'aio.pipeline.currentSelectionModeAria':
    'Modo de texto de la selección actual',
  'aio.pipeline.autoResolved': 'AUTO se resuelve como {value}.',
  'aio.pipeline.currentMode': 'Modo actual: {value}.',
  'aio.pipeline.selectPreviewBox':
    'Selecciona un cuadro en la vista previa para cambiar el modo de texto.',
  'aio.pipeline.title': 'Pipeline AIO',
  'aio.pipeline.description.auto':
    'Configura el pipeline completo (detección, OCR, traducción, segmentación y limpieza) antes de ejecutar el lote.',
  'aio.pipeline.description.manual':
    'Modo manual: ejecuta u omite etapas secuencialmente para la imagen seleccionada.',
  'aio.pipeline.render': 'Renderizar',
  'aio.pipeline.renderSubtitle': 'Aplicar el texto traducido a la imagen final',
  'aio.pipeline.executeCurrentTitle':
    'Ejecutar solo la etapa actual para la imagen seleccionada',
  'aio.pipeline.executingStage': 'Ejecutando etapa...',
  'aio.pipeline.rerunStage': 'Re-ejecutar etapa',
  'aio.pipeline.runStage': 'Ejecutar etapa',
  'aio.pipeline.skipStage': 'Omitir etapa',
  'aio.pipeline.skipStageTitle':
    'Omitir la etapa actual y desbloquear la siguiente',
  'aio.pipeline.rewind': 'Retroceder',
  'aio.pipeline.rewindTitle': 'Volver a la etapa anterior del pipeline AIO',
  'aio.pipeline.forward': 'Avanzar',
  'aio.pipeline.forwardTitle': 'Avanzar a la siguiente etapa del pipeline AIO',
  'aio.pipeline.manualImageStatus': 'Manual por imagen: "{image}" en {stage}.',
  'aio.pipeline.selectImageManual':
    'Selecciona una imagen para iniciar el flujo manual etapa por etapa.',
  'aio.pipeline.currentStage': 'Etapa actual: {label} ({current}/{total}).',
  'aio.pipeline.runToEnable':
    'Ejecuta AIO para habilitar el avance/retroceso por etapas.',
  'aio.pipeline.manualHint':
    'Haz el proceso mucho más confiable: en modo manual, cada etapa que ajustas se ejecuta con más control, revisión y precisión. Solo se procesa la imagen seleccionada y la cuota solo se consume en la primera ejecución manual de cada imagen (o cero si ya pasó por el AIO automático).',
  'dashboard.enhance.profile.mangaScan': 'Escaneo de manga',
  'dashboard.enhance.profile.animeArt': 'Arte anime',
  'dashboard.enhance.profile.general': 'General',
  'dashboard.enhance.profile.highQuality4x': 'Alta calidad 4x',
  'dashboard.emptyTip.1':
    'Si una imagen es demasiado grande y obtienes errores durante la limpieza, traducción o redibujo, intenta dividirla en partes más pequeñas. Esto suele estabilizar el procesamiento.',
  'dashboard.emptyTip.2':
    'El modo automático acelera el flujo de trabajo, pero para un resultado 100% pulido vale la pena revisar en modo manual y corregir los detalles finales.',
  'dashboard.emptyTip.3':
    'Usa la herramienta de refinamiento para hacer el texto más limpio, equilibrado y al nivel de estándares de scanlation.',
  'dashboard.emptyTip.4':
    'Puedes cambiar las formas de los globos entre rectangular y elíptico para ajustar mejor el texto en cada página.',
  'dashboard.emptyTip.5':
    'Configura preajustes en la página de ajustes para acelerar tareas repetitivas y mantener la consistencia entre capítulos.',
  'dashboard.emptyTip.6':
    'Prueba diferentes modelos por idioma. El mejor OCR o traductor para japonés puede no ser ideal para coreano, chino o inglés.',
  'dashboard.emptyTip.7':
    'Vota por los modelos que más ayuden a tu flujo de trabajo. Esto mejora el ranking y guía a otros usuarios en sus elecciones.',
  'dashboard.emptyTip.8': 'Si la traducción en la nube es costosa o inestable, ajusta tus preajustes y mantén un respaldo local para que la producción no se detenga.',
  'dashboard.emptyTip.9':
    'Usa el Traductor Visual para revisar regiones específicas sin tener que re-ejecutar todo el capítulo.',
  'dashboard.emptyTip.10':
    'En el Tipógrafo, pequeños ajustes manuales de alineación, fuente y espaciado hacen una gran diferencia en el resultado final.',
  'dashboard.emptyTip.11':
    'Cuando el texto queda demasiado apretado, reduce la cantidad de texto en el cuadro, refina la traducción o ajusta el globo antes de reducir demasiado la fuente.',
  'dashboard.emptyTip.12':
    'Si la salida del OCR es mala, prueba un modelo diferente antes de corregir todo a mano. Cambiar de modelo suele resolver la mayoría de los errores.',
  'dashboard.emptyTip.13':
    'Usa notas de traducción solo cuando realmente aporten valor al lector. Menos ruido mejora la experiencia de lectura.',
  'dashboard.emptyTip.14':
    'Guarda perfiles personalizados de LLM y OCR para comparar configuraciones rápidamente sin reconfigurar todo en cada prueba.',
  'dashboard.emptyTip.15':
    'Si una página falla en el flujo AIO, ejecuta las etapas por separado en Producción para encontrar exactamente dónde está el cuello de botella.',
  'dashboard.aio.progress.detectText': 'detectando texto',
  'dashboard.aio.progress.recognizeText': 'reconociendo texto',
  'dashboard.aio.progress.getTranslations': 'traduciendo texto',
  'dashboard.aio.progress.segmentText': 'segmentando texto',
  'dashboard.aio.progress.cleanImage': 'limpiando imagen',
  'dashboard.aio.progress.render': 'preparando renderizado',
  'dashboard.aio.subtitle.detectText': 'Localizar áreas de texto en la imagen',
  'dashboard.aio.subtitle.recognizeText': 'OCR para extraer contenido textual',
  'dashboard.aio.subtitle.getTranslations':
    'Traducción automática mediante el servicio/modelo seleccionado',
  'dashboard.aio.subtitle.segmentText':
    'Refinar regiones con segmentación (estilo Baka)',
  'dashboard.aio.subtitle.cleanImage':
    'Inpainting con AOT/LaMa + máscara estilo Baka',
  'dashboard.aio.manualStatus.locked': 'Bloqueada',
  'dashboard.aio.manualStatus.pending': 'Pendiente',
  'dashboard.aio.manualStatus.done': 'Completada',
  'dashboard.aio.manualStatus.skipped': 'Omitida',
  'dashboard.mode.underDevelopment': 'Aún en desarrollo.',
  'dashboard.nav.group.main': 'Principal',
  'dashboard.nav.group.production': 'Producción',
  'dashboard.nav.group.utils': 'Utilidades',
  'dashboard.nav.group.info': 'Información',
  'dashboard.nav.short.aio': 'AIO',
  'dashboard.nav.short.cleaner': 'Limpiador/RD',
  'dashboard.nav.short.enhance': 'Mejorar',
  'dashboard.nav.subtitle.organize': 'Gestionar archivos',
  'dashboard.nav.subtitle.aio': 'Todo en uno',
  'dashboard.nav.subtitle.cleaner': 'Limpiador y Redibujador',
  'dashboard.nav.subtitle.typesetter': 'Tipógrafo',
  'dashboard.nav.subtitle.translator': 'Traductor',
  'dashboard.nav.subtitle.raw': 'Proveedor de raws',
  'dashboard.nav.subtitle.proofreader': 'Corrector y QC',
  'dashboard.nav.subtitle.stitch': 'Unidor',
  'dashboard.nav.subtitle.split': 'Divisor',
  'dashboard.nav.subtitle.watermark': 'Marca de agua',
  'dashboard.nav.subtitle.enhance': 'Mejorador',
  'dashboard.nav.subtitle.optimizer': 'Optimizador de capítulos',
  'dashboard.nav.subtitle.blogger': 'Publicador y Host',
  'dashboard.nav.subtitle.imgur': 'Host anónimo',
  'dashboard.nav.subtitle.guides': 'Tutoriales',
  'dashboard.nav.subtitle.resources': 'Recursos',
  'dashboard.nav.tooltip.organize':
    'Organiza y reordena tus imágenes antes de procesarlas',
  'dashboard.nav.tooltip.aio':
    'Pipeline completo: detectar, reconocer, traducir, segmentar, limpiar y renderizar',
  'dashboard.nav.tooltip.cleaner':
    'Limpia globos y redibuja áreas de la imagen',
  'dashboard.nav.tooltip.typesetter':
    'Aplica tipografía y estiliza el texto en las páginas',
  'dashboard.nav.tooltip.translator':
    'Traduce texto libre o revisa OCR/traducción por regiones de imagen',
  'dashboard.nav.tooltip.raw':
    'Gestiona y suministra imágenes raw para el pipeline',
  'dashboard.nav.tooltip.proofreader':
    'Revisa traducciones y verifica la calidad final',
  'dashboard.nav.tooltip.stitch': 'Une múltiples imágenes en una tira continua',
  'dashboard.nav.tooltip.split':
    'Divide imágenes largas en partes más pequeñas',
  'dashboard.nav.tooltip.watermark':
    'Añade marcas de agua a imágenes por lotes',
  'dashboard.nav.tooltip.enhance':
    'Mejora la calidad y resolución de las imágenes',
  'dashboard.nav.tooltip.optimizer':
    'Optimiza las salidas finales para web, lectura o archivo',
  'dashboard.nav.tooltip.blogger':
    'Publica en Blogger y genera URLs de imágenes alojadas',
  'dashboard.nav.tooltip.imgur':
    'Sube imágenes a Imgur con rotación de Client ID',
  'dashboard.nav.tooltip.guides': 'Guías de uso de herramientas y tutoriales',
  'dashboard.nav.tooltip.resources':
    'Recursos, enlaces y materiales de referencia',
  'dashboard.mode.organize': 'Organizar',
  'dashboard.mode.aio': 'AIO — Todo en uno',
  'dashboard.mode.cleaner': 'Limpiador / Redibujador',
  'dashboard.mode.typesetter': 'Tipógrafo',
  'dashboard.mode.translator': 'Traductor',
  'dashboard.mode.raw': 'Proveedor de raws',
  'dashboard.mode.proofreader': 'Corrector / QC',
  'dashboard.mode.stitch': 'Unir (Webtoon)',
  'dashboard.mode.split': 'División inteligente',
  'dashboard.mode.watermark': 'Marca de agua',
  'dashboard.mode.enhance': 'Mejorar imagen',
  'dashboard.mode.optimizer': 'Optimizador de capítulos',
  'dashboard.mode.blogger': 'CDN de Blogger',
  'dashboard.mode.imgur': 'Subida a Imgur',
  'dashboard.mode.guides': 'Guías y tutoriales',
  'dashboard.mode.resources': 'Recursos y materiales',
  'dashboard.status.modelSelected': 'Modelo seleccionado para {stage}: {model}',
  'dashboard.status.verifyEmailRequired':
    'Confirma tu correo para realizar esta acción.',
  'dashboard.status.imagesCount': '{count} imágenes',
  'dashboard.status.noImage': 'Sin imagen',
  'dashboard.status.freeText': 'texto-libre',
  'dashboard.user.defaultName': 'Usuario',
  'dashboard.topbar.thisTab': 'Esta pestaña',
  'dashboard.aio.config.title': 'Configuración de etapas',
  'dashboard.footer.hardware.nvidia':
    'Aceleración NVIDIA de máximo rendimiento.',
  'dashboard.footer.hardware.intel': 'Aceleración dedicada Intel en uso.',
  'dashboard.footer.hardware.cpu': 'Ejecución local sin aceleración dedicada.',
  'dashboard.footer.quickLinks': 'Enlaces rápidos',
  'dashboard.footer.lastSave.never': 'Aún no se ha guardado en esta sesión',
  'dashboard.footer.lastSave.label': 'Último guardado: {time}',
  'dashboard.cleaner.flow.local.title':
    'Flujo estructurado con OCR, segmentación e inpainting local',
  'dashboard.cleaner.flow.ai.title':
    'Limpieza automática con IA multimodal y reconstrucción guiada',
  'dashboard.cleaner.flow.local.desc':
    'Usa el detector local para proponer candidatos, clasifica qué regiones son SFX reales y limpia solo las aprobadas.',
  'dashboard.cleaner.flow.ai.desc':
    'Usa la detección estructural del proyecto para guiar la IA, refuerza la preservación de globos/arte y recompone imágenes grandes con costuras más suaves.',
  'dashboard.cleaner.instructions.placeholder':
    'Ej.: preservar mejor los degradados rojos, ser más conservador con SFX pequeños, priorizar no tocar los cuadros narrativos.',
  'dashboard.cleaner.instructions.hint.local':
    'Estas instrucciones se inyectan como contexto complementario tras las reglas base de clasificación y limpieza de SFX.',
  'dashboard.cleaner.instructions.hint.ai':
    'Estas instrucciones se inyectan como contexto complementario. Las reglas principales del limpiador IA permanecen por encima de cualquier instrucción del usuario para preservar la lógica de limpieza.',
  'dashboard.cleaner.inspection.title': 'Inspección',
  'dashboard.cleaner.segmentation.manage': 'Gestionar modelos de segmentación',
  'dashboard.cleaner.segmentation.model': 'Modelo de segmentación',
  'dashboard.aio.gpuStages.title': 'Uso de GPU por etapa',
  'dashboard.aio.gpuStages.hint':
    'Selecciona qué etapas deben usar aceleración GPU. Desmarca para forzar la ejecución en CPU (útil si la GPU no tiene suficiente VRAM para todas las etapas).',
  'dashboard.aio.gpuStages.detect': 'Detección de texto (GPU)',
  'dashboard.aio.gpuStages.ocr': 'OCR / Reconocimiento (GPU)',
  'dashboard.aio.gpuStages.segment': 'Segmentación (GPU)',
  'dashboard.aio.gpuStages.clean': 'Limpieza / Inpainting (GPU)',
  'dashboard.aio.gpuStages.noActiveProfile':
    'Todavía no se confirmó ningún perfil de GPU activo. Esta sección permanece visible para evitar parpadeos intermitentes; los toggles vuelven a surtir efecto en cuanto haya un perfil de GPU disponible.',
  'dashboard.aio.config.loadingCatalogs': 'Cargando catálogos locales y en la nube...',
  'dashboard.aio.preparingManual': 'Preparando etapa manual de AIO...',
  'dashboard.aio.preparingAuto': 'Preparando ejecución automática de AIO...',
  'dashboard.aio.stopping': 'Deteniendo ejecución de AIO...',
  'dashboard.aio.abortedByUser': 'Ejecución de AIO cancelada por el usuario.',
  'dashboard.aio.abortedMiniBackendRestarted':
    'Ejecución de AIO cancelada. Mini-backend reiniciado.',
  'dashboard.aio.abortedMiniBackendRestartFailed':
    'Ejecución de AIO cancelada. No se pudo reiniciar el mini-backend automáticamente.',
  'dashboard.llm.customProfilesLoadFailed':
    'Error al cargar los perfiles personalizados de LLM.',
  'dashboard.status.ready': 'Listo para procesar imágenes.',
  'dashboard.workspace.pendingChanges':
    'El espacio de trabajo tiene cambios pendientes.',
  'dashboard.status.restored': 'Espacio de trabajo restaurado.',
  'dashboard.status.historyRestored': 'Cambio restaurado del historial.',
  'dashboard.status.undo': 'Espacio de trabajo deshecho.',
  'dashboard.status.redo': 'Espacio de trabajo rehecho.',
  'dashboard.status.saved': 'Espacio de trabajo guardado localmente.',
  'dashboard.status.exportCancelled':
    'Exportación del espacio de trabajo cancelada.',
  'dashboard.status.exportSuccess':
    'Espacio de trabajo exportado correctamente.',
  'dashboard.status.importCancelled':
    'Importación del espacio de trabajo cancelada.',
  'dashboard.status.importSuccess':
    'Espacio de trabajo importado correctamente.',
  'dashboard.status.importSaved':
    'Espacio de trabajo importado y guardado localmente.',
  'dashboard.status.importNoAutosave':
    'Espacio de trabajo importado. Autoguardado automático desactivado.',
  'dashboard.status.autosaveRemoved': 'Autoguardado local eliminado.',
  'dashboard.status.nothingToUndo':
    'No hay nada que deshacer en el espacio de trabajo.',
  'dashboard.status.nothingToRedo':
    'No hay nada que rehacer en el espacio de trabajo.',
  'dashboard.sections.pipeline': 'Pipeline',
  'dashboard.sections.languages': 'Idiomas',
  'dashboard.sections.modelsConfig': 'Modelos y configuración',
  'dashboard.sections.presets': 'Preajustes',
  'dashboard.sections.region': 'Región',
  'dashboard.aio.rewind':
    'AIO retroceder: etapa "{label}" ({current}/{total}).',
  'dashboard.aio.forward': 'AIO avanzar: etapa "{label}" ({current}/{total}).',
  'dashboard.aio.rewindImage':
    'AIO retroceder ({imageName}): etapa "{label}" ({current}/{total}).',
  'dashboard.aio.forwardImage':
    'AIO avanzar ({imageName}): etapa "{label}" ({current}/{total}).',
  'dashboard.llm.translation': 'Traducción',
  'dashboard.llm.ocr': 'OCR',
  'dashboard.aio.manualScope': 'AIO manual',
  'dashboard.aio.autoScope': 'AIO automático',
  'dashboard.aio.executing': 'Ejecutando',
  'dashboard.cleaner.selectProfile':
    'Selecciona un perfil visual guardado para usar con la Limpieza automática con IA.',
  'dashboard.cleaner.profileNotFound':
    'Perfil visual no encontrado. Recarga e intenta de nuevo.',
  'dashboard.cleaner.profileInUse':
    'Perfil visual en uso para Limpieza automática con IA: {label}.',
  'dashboard.cleaner.invalidModel':
    'Selecciona un modelo válido para la Limpieza automática con IA.',
  'dashboard.cleaner.modelRoadmap':
    'El modelo "{name}" aún está en el roadmap.',
  'dashboard.cleaner.modelConfigRequired':
    'El modelo "{name}" requiere configuración antes de usarse.',
  'dashboard.translator.sfx.invalidModel':
    'Selecciona un modelo válido para el SFX con IA del Traductor.',
  'dashboard.cleaner.profileSaved':
    'Perfil visual guardado y seleccionado para Limpieza automática con IA: {label}.',
  'dashboard.cleaner.removeProfileSelect':
    'Selecciona un perfil visual guardado para eliminar.',
  'dashboard.cleaner.customTitle':
    'IA Personalizada (Limpieza automática con IA)',
  'dashboard.cleaner.emptyLabel': 'Nuevo perfil visual',
  'dashboard.cleaner.namePlaceholder': 'Ej.: Gemini Image Clean',
  'dashboard.cleaner.modelPlaceholder': 'gemini-2.5-flash-image',
  'dashboard.cleaner.useLabel': 'Usar en el Limpiador',
  'dashboard.cleaner.providerInUse':
    'Proveedor {name} en uso para Limpieza automática con IA.',
  'dashboard.stage.detectText.label': 'Detectar texto',
  'dashboard.stage.detectText.short': 'Detectar',
  'dashboard.stage.recognizeText.label': 'Reconocer texto',
  'dashboard.stage.recognizeText.short': 'OCR',
  'dashboard.stage.getTranslations.label': 'Obtener traducciones',
  'dashboard.stage.getTranslations.short': 'Traducir',
  'dashboard.stage.segmentText.label': 'Segmentar texto',
  'dashboard.stage.segmentText.short': 'Segmentar',
  'dashboard.stage.cleanImage.label': 'Limpiar imagen',
  'dashboard.stage.cleanImage.short': 'Limpiar',
  'dashboard.stage.render.label': 'Renderizar',
  'dashboard.stage.render.short': 'Renderizar',
  'dashboard.aio.pipeline.detect.subtitle':
    'Localizar áreas de texto en la imagen',
  'dashboard.aio.pipeline.ocr.subtitle': 'OCR para extraer contenido textual',
  'dashboard.aio.pipeline.translate.subtitle':
    'Traducción automática mediante servicio/modelo',
  'dashboard.aio.pipeline.segment.subtitle':
    'Refinar regiones con segmentación',
  'dashboard.aio.pipeline.clean.subtitle': 'Inpainting con AOT/LaMa + máscara',
  'dashboard.aio.pipeline.render.subtitle':
    'Aplicar el texto traducido a la imagen final',
  'dashboard.aio.config.langHint':
    'Origen → Detectar/OCR/Traducir. Traducción → solo traducción.',
  'dashboard.aio.translation.localModelInfo':
    'Los modelos locales se descargan bajo demanda; los modelos nube/API siguen usando una clave.',
  'dashboard.translator.sameModelHint':
    'El Traductor usa la misma selección de modelo que AIO; ejecuta de nuevo tras cambiar el modelo.',
  'dashboard.translator.incompatibleLocalModel':
    'El modelo local actual no admite el par de idiomas del Traductor. Elige otro modelo o usa la nube.',
  'dashboard.status.modeChanged': 'Modo: {mode}',
  'dashboard.status.underDevelopment': '{mode}: {tooltip}',
  'dashboard.aio.render.hintRot': 'Atajo: ',
  'dashboard.aio.render.hintRotSuffix': ' para rotar.',
  'settings.typographerLibrary.noFolder': 'Sin carpeta',
  'settings.profile.defaultUser': 'Usuario KŌMA',
  'register.email': 'Correo electrónico',
  'register.emailPlaceholder': 'tu@correo.com',
  'feed.sidebar.webhookPlaceholder': 'https://discord.com/api/webhooks/...',
  'feed.sidebar.webhookLabelShort': 'Webhook: ',
  'feed.moderation.scope.accountHwid': 'Cuenta + HWID',
  'feed.moderation.scope.full': 'Completo',
  'feed.composer.label.scanlation': 'Scanlation',
  'feed.composer.availability.hoursPlaceholder': '10',
  'feed.composer.roles.valuePlaceholder': '50.00',
  'feed.apply.contactPlaceholder': 'Discord @usuario',
  'ranking.error.loadFailed': 'Error al cargar los rankings.',
  'ranking.error.loadDetailFailed': 'Error al cargar los detalles.',
  'ranking.error.saveReviewFailed': 'Error al guardar la reseña.',
  'ranking.error.deleteReviewFailed': 'Error al eliminar la reseña.',
  'ranking.error.emailVerificationRequired':
    'Confirma tu correo antes de publicar o editar reseñas.',
  'dashboard.aio.translation.temperature': 'Temperatura',
  'dashboard.aio.translation.topP': 'Top P',
  'dashboard.aio.translation.maxTokens': 'Tokens máximos',
  'dashboard.aio.clean.hdStrategy': 'Estrategia HD',
  'dashboard.aio.clean.hdStrategy.resize': 'Redimensionar',
  'dashboard.aio.clean.hdStrategy.crop': 'Recortar',
  'dashboard.aio.clean.hdStrategy.original': 'Original',
  'dashboard.aio.clean.hdStrategyHint':
    'Estrategia para imágenes grandes antes del inpainting.',
  'dashboard.aio.clean.resizeLimit': 'Límite de redimensionado',
  'dashboard.aio.clean.cropMargin': 'Margen de recorte',
  'dashboard.aio.clean.cropTriggerSize': 'Tamaño de activación de recorte',
  'dashboard.aio.clean.localHardware':
    'Hardware local: {name} ({provider}{vram})',
  'dashboard.sidebar.workspace': 'Espacio de trabajo',
  'dashboard.sidebar.hide': 'Ocultar barra lateral',
  'dashboard.sidebar.remaining': 'Restante: {count}',
  'dashboard.sidebar.resizeAria': 'Redimensionar barra lateral izquierda',
  'dashboard.sidebar.resizeTitle':
    'Arrastra para redimensionar. Doble clic para restaurar.',
  'dashboard.sidebar.files': 'Archivos ({count})',
  'dashboard.sidebar.clearAll': 'Borrar todos',
  'dashboard.sidebar.cleared': 'Lista de imágenes borrada.',
  'dashboard.sidebar.empty': 'Sin imágenes',
  'dashboard.sidebar.rewindImage': 'Retroceder solo esta imagen',
  'dashboard.sidebar.forwardImage': 'Avanzar solo esta imagen',
  'dashboard.sidebar.rotate90': 'Rotar 90 grados',
  'dashboard.sidebar.moveUp': 'Mover arriba',
  'dashboard.sidebar.moveDown': 'Mover abajo',
  'dashboard.sidebar.remove': 'Eliminar',
  'dashboard.sidebar.extracting': 'Extrayendo imágenes... por favor espera.',
  'dashboard.sidebar.dropHere': 'Suelta aquí...',
  'dashboard.sidebar.clickOrDrag': 'Arrastra o haz clic',
  'dashboard.sidebar.processingArchive': 'Procesando ZIP/PDF/CBZ/CB7/PSD...',
  'dashboard.sidebar.stats.title': 'Estadísticas locales',
  'dashboard.sidebar.stats.badge': 'Activo',
  'dashboard.sidebar.stats.daily': 'Hoy',
  'dashboard.sidebar.stats.weekly': 'Esta semana',
  'dashboard.sidebar.stats.monthly': 'Este mes',
  'dashboard.sidebar.stats.foot':
    'Actividad local reciente. Los contadores se reinician automáticamente según el período.',
  'dashboard.sidebar.stats.resetNow': 'Se reinicia ahora',
  'dashboard.sidebar.stats.resetInHoursMinutes':
    'Se reinicia en {hours}h {minutes}m',
  'dashboard.sidebar.stats.resetInHours': 'Se reinicia en {hours}h',
  'dashboard.sidebar.stats.resetInMinutes': 'Se reinicia en {minutes}m',
  'dashboard.sidebar.right.hide': 'Ocultar herramientas',
  'dashboard.sidebar.right.close': 'Cerrar panel',
  'dashboard.sidebar.right.resizeAria': 'Redimensionar barra lateral derecha',
  'dashboard.sidebar.right.resizeTitle':
    'Arrastra para redimensionar. Doble clic para restaurar.',
  'dashboard.footer.runtime.downloaded': 'Paquete descargado',
  'dashboard.footer.runtime.embedded': 'Núcleo integrado',
  'dashboard.footer.runtime.fallback.title': 'Fallback activo',
  'dashboard.footer.runtime.fallback.detail':
    '{requested} solicitado, {active} en uso.',
  'dashboard.footer.runtime.tensorrt.title': 'TensorRT activo',
  'dashboard.footer.runtime.tensorrt.detail':
    'Aceleración NVIDIA de máximo rendimiento.',
  'dashboard.footer.runtime.cuda.title': 'CUDA activo',
  'dashboard.footer.runtime.cuda.detail': 'GPU NVIDIA moderna en uso.',
  'dashboard.footer.runtime.legacy.label': 'Legacy',
  'dashboard.footer.runtime.legacy.title': 'CUDA Legacy activo',
  'dashboard.footer.runtime.legacy.detail':
    'Perfil legacy para GPUs NVIDIA antiguas.',
  'dashboard.footer.runtime.openvino.title': 'OpenVINO activo',
  'dashboard.footer.runtime.openvino.detail':
    'Aceleración dedicada Intel en uso.',
  'dashboard.footer.runtime.cpu.title': 'CPU activo',
  'dashboard.footer.runtime.cpu.detail':
    'Ejecución local sin aceleración dedicada.',
  'dashboard.footer.workspace.saving': 'Guardando',
  'dashboard.footer.workspace.saved': 'Guardado',
  'dashboard.footer.workspace.error': 'Error local',
  'dashboard.footer.workspace.pending': 'Pendiente',
  'dashboard.footer.workspace.title': 'Espacio de trabajo local',
  'dashboard.footer.runtime.source': 'Origen: {value}',
  'dashboard.footer.runtime.remoteAvailable': 'Paquete remoto disponible.',
  'dashboard.footer.runtime.errorReason': 'Motivo: {value}',
  'dashboard.footer.bugReport.title': 'Reportar error',
  'dashboard.footer.bugReport.desc':
    'Reporta errores con capturas de pantalla y registros automáticos.',
  'dashboard.footer.discord.aria': 'Unirse a Discord',
  'dashboard.footer.discord.title': 'Comunidad de Discord',
  'dashboard.footer.discord.desc':
    'Únete a la comunidad, sugiere ideas y comparte comentarios.',
  'dashboard.footer.website.aria': 'Abrir sitio web del proyecto',
  'dashboard.footer.website.title': 'Sitio web del proyecto',
  'dashboard.footer.website.desc':
    'Accede a noticias, documentación y recursos del proyecto.',
  'bugReport.error.imgLoadFailed': 'Error al cargar la imagen.',
  'bugReport.error.canvasFailed': 'Error en el procesamiento del canvas.',
  'modelManager.modal.title': 'Bóveda de modelos',
  'modelManager.modal.aioFallback': 'AIO',
  'modelCard.recommended': 'REC',
  'modelCard.hardware.gpu': 'GPU',
  'modelCard.hardware.cpu': 'CPU',
  'modelCard.speed.ok': 'OK',
  'auth.toolkit.aiClean': 'Limpieza IA',
  'freeProviderCard.setup': 'Configuración',
  'freeProviderCard.limits': 'Límites',
  'freeProviderCard.rateLimits': 'Límites de velocidad',
  'freeProviderCard.field.modelPlaceholder':
    'ID del modelo (compatible con OpenAI)',
  'customProvider.profileType': 'Perfil de IA personalizado',
  'dashboard.cleaner.mode.assisted': 'Asistido',
  'dashboard.cleaner.mode.automaticAi': 'Limpieza automática con IA',
  'dashboard.cleaner.mode.aiSfx': 'SFX con IA',
  'dashboard.cleaner.mode.assistedTitle':
    'Flujo estructurado con OCR, segmentación e inpainting local',
  'dashboard.cleaner.mode.automaticAiTitle':
    'Limpieza automática con IA multimodal y reconstrucción guiada',
  'dashboard.cleaner.mode.aiSfxTitle':
    'Detecta y limpia solo SFX aprobados por la IA',
  'dashboard.cleaner.mode.title': 'Modo',
  'dashboard.cleaner.mode.hint':
    'El modo actual se mantuvo como un flujo asistido. La nueva <strong>Limpieza automática con IA</strong> usa IA multimodal con reglas estrictas para preservar arte, contornos y globos.',
  'dashboard.cleaner.pipeline.title': 'Pipeline',
  'dashboard.cleaner.pipeline.hint':
    'Flujo asistido: OCR → Segmentación → Limpieza local. Ideal para quienes buscan previsibilidad y ajuste fino posterior.',
  'dashboard.cleaner.ocr.language': 'Idioma (OCR)',
  'dashboard.cleaner.ocr.languageAria': 'Idioma de origen para OCR',
  'dashboard.cleaner.models.button': 'Modelos',
  'dashboard.cleaner.models.none': 'Sin modelos',
  'dashboard.cleaner.ocr.manageAria': 'Gestionar modelos de OCR',
  'dashboard.cleaner.ocr.modelAria': 'Modelo de OCR',
  'dashboard.cleaner.segment.title': 'Segmentar',
  'dashboard.cleaner.segment.manageAria': 'Gestionar modelos de segmentación',
  'dashboard.cleaner.segment.modelAria': 'Modelo de segmentación',
  'dashboard.cleaner.clean.title': 'Limpiar',
  'dashboard.cleaner.clean.manageAria': 'Gestionar modelos de limpieza',
  'dashboard.cleaner.clean.modelAria': 'Modelo de limpieza',
  'dashboard.cleaner.settings.title': 'Limpieza',
  'dashboard.cleaner.settings.maskDilation': 'Dilatación de máscara',
  'dashboard.cleaner.settings.hdStrategy': 'Estrategia HD',
  'dashboard.cleaner.settings.resizeLimit': 'Límite de redimensionado',
  'dashboard.cleaner.settings.cropMargin': 'Margen de recorte',
  'dashboard.cleaner.settings.cropTrigger': 'Activación de recorte',
  'dashboard.cleaner.inspect.title': 'Inspección',
  'dashboard.cleaner.inspect.ocrBlocks': 'Bloques OCR',
  'dashboard.cleaner.inspect.segmented': 'Segmentado',
  'dashboard.cleaner.inspect.selection': 'Selección',
  'dashboard.cleaner.inspect.none': 'ninguno',
  'dashboard.cleaner.inspect.ocr': 'OCR',
  'dashboard.cleaner.inspect.segments': 'Segmentos',
  'dashboard.cleaner.inspect.boxesCount': '{count} cuadro(s)',
  'dashboard.cleaner.ai.sfxCleaner': 'Limpiador de SFX con IA',
  'dashboard.cleaner.ai.automaticClean': 'Limpieza automática con IA',
  'dashboard.cleaner.ai.sfxDesc':
    'Usa el detector local para proponer candidatos, clasifica qué regiones son SFX reales y limpia solo las aprobadas.',
  'dashboard.cleaner.ai.automaticDesc':
    'Usa la detección estructural del proyecto para guiar la IA, refuerza la preservación de globos/arte y recompone imágenes grandes con costuras más suaves.',
  'dashboard.cleaner.ai.modelTitle': 'Modelo de IA',
  'dashboard.cleaner.ai.manageAria': 'Gestionar modelos de {value}',
  'dashboard.cleaner.ai.modelAria': 'Modelo de {value}',
  'dashboard.cleaner.ai.noneAvailable': 'No hay modelos de IA disponibles',
  'dashboard.cleaner.instructions.title': 'Instrucciones adicionales',
  'dashboard.cleaner.instructions.hintSfx':
    'Estas instrucciones se inyectan como contexto complementario tras las reglas base de clasificación y limpieza de SFX.',
  'dashboard.cleaner.instructions.hintAi':
    'Estas instrucciones se inyectan como contexto complementario. Las reglas principales del limpiador IA permanecen por encima de cualquier instrucción del usuario para preservar la lógica de limpieza.',
  'dashboard.cleaner.stats.candidates': 'Candidatos',
  'dashboard.cleaner.stats.sfxApproved': 'SFX aprob.',
  'dashboard.cleaner.stats.redraw': 'Redibujo',
  'dashboard.cleaner.action.processing': 'Procesando {value} {percent}%',
  'dashboard.cleaner.action.runAiSfx': 'Ejecutar Limpiador de SFX con IA',
  'dashboard.cleaner.action.runAutomatic':
    'Ejecutar Limpieza automática con IA',
  'dashboard.cleaner.action.runAssisted': 'Ejecutar Limpiador asistido',
  'dashboard.typography.circularText': 'Texto circular',
  'dashboard.typography.activate': 'Activar',
  'dashboard.typography.effect.aria': 'Efecto de texto',
  'dashboard.typography.effect.title': 'Seleccionar efecto de texto',
  'dashboard.typography.effect.label': 'Efecto',
  'dashboard.typography.effect.none': 'Sin efecto',
  'dashboard.typography.effect.panelTitle': 'Efecto de texto',
  'dashboard.typography.effect.panelHint':
    'Preajustes nativos para diálogo, impacto y difuminado.',
  'dashboard.typography.effect.searchPlaceholder': 'Buscar efectos...',
  'dashboard.typography.effect.intensity': 'Intensidad',
  'dashboard.typography.effect.noResults': 'No se encontraron efectos.',
  'dashboard.aio.customAi.titleTranslation':
    'Perfiles de IA personalizados (Traducción)',
  'dashboard.aio.customAi.titleOcr': 'Perfiles de IA personalizados (OCR)',
  'dashboard.aio.customAi.newTranslation': 'Nuevo perfil de traducción',
  'dashboard.aio.customAi.newOcr': 'Nuevo perfil de OCR',
  'dashboard.aio.customAi.placeholderTranslation':
    'Ej.: OpenRouter Manga EN-US',
  'dashboard.aio.customAi.placeholderOcr': 'Ej.: Private Vision OCR',
  'dashboard.aio.customAi.modelPlaceholderTranslation': 'openai/gpt-4.1',
  'dashboard.aio.customAi.modelPlaceholderOcr': 'gpt-4.1-mini',
  'dashboard.aio.customAi.useTranslation': 'Usar traducción',
  'dashboard.aio.customAi.useOcr': 'Usar OCR',
  'dashboard.aio.customAi.loading': 'Cargando perfiles personalizados...',
  'dashboard.aio.customAi.savedProfile': 'Perfil guardado',
  'dashboard.aio.customAi.apiBase': 'Base de API',
  'dashboard.aio.customAi.ollamaPreset': 'Preajuste local Ollama',
  'dashboard.aio.customAi.apiKey': 'Clave de API (opcional)',
  'dashboard.aio.customAi.model': 'Modelo',
  'dashboard.aio.customAi.clear': 'Limpiar',
  'dashboard.aio.customAi.remove': 'Eliminar',
  'dashboard.aio.customAi.save': 'Guardar',
  'dashboard.emptyStage.title': 'Selecciona o carga imágenes',
  'dashboard.emptyStage.desc':
    'Usa las herramientas de la barra superior para procesar tus páginas de manhwa.',
  'dashboard.emptyStage.tipTitle': 'Consejo útil',
  'dashboard.emptyStage.tipMeta': 'Rotando cada 15 segundos',
  'dashboard.enhance.title': 'Mejorar imagen',
  'dashboard.enhance.localHint':
    'Modelos ONNX en el mini-backend local. Instálalos antes de procesar.',
  'dashboard.enhance.desktopRequiredHint':
    'Requiere la aplicación de escritorio con un mini-backend activo.',
  'dashboard.enhance.scale': 'Escala',
  'dashboard.enhance.profile': 'Perfil',
  'dashboard.enhance.model': 'Modelo',
  'dashboard.enhance.format': 'Formato',
  'dashboard.enhance.status.title': 'Modelo',
  'dashboard.enhance.status.desktopRequired': 'Escritorio requerido',
  'dashboard.enhance.status.selectModel': 'Selecciona un modelo',
  'dashboard.enhance.status.ready': 'Listo',
  'dashboard.enhance.status.notImported': 'No importado',
  'dashboard.enhance.status.notInstalled': 'No instalado',
  'dashboard.enhance.importHint':
    'Importación manual de ONNX. Convierte .pth usando sisr2onnx.',
  'dashboard.enhance.action.manage': 'Gestionar',
  'dashboard.enhance.action.import': 'Importar',
  'dashboard.enhance.action.install': 'Instalar',
  'dashboard.enhance.action.source': 'Origen',
  'dashboard.enhance.selectAboveHint': 'Selecciona un modelo arriba.',
  'dashboard.enhance.action.processing': 'Mejorando...',
  'dashboard.enhance.action.run': 'Mejorar imágenes',
  'dashboard.info.optimizer.desc1':
    'Optimiza el lote final con preajustes web, lectura o archivo usando las salidas ya generadas en el panel.',
  'dashboard.info.optimizer.desc2':
    'La utilidad muestra el ahorro por página y exporta como ZIP o carpeta local.',
  'dashboard.info.blogger.desc1':
    'Usa esta utilidad para publicar en Blogger y generar URLs de imágenes alojadas.',
  'dashboard.info.blogger.desc2':
    'Las credenciales y el optimizador están en Ajustes > Integraciones > CDN de Blogger.',
  'dashboard.info.imgur.desc1':
    'Usa esta utilidad para subidas anónimas a Imgur con rotación aleatoria de Client ID.',
  'dashboard.info.imgur.desc2':
    'Las claves, el limitador y la guía completa están en Ajustes > Integraciones > Subida a Imgur.',
  'dashboard.info.guides.desc1':
    'Selecciona una guía en el panel central para leer instrucciones detalladas.',
  'dashboard.info.guides.desc2':
    'Cada guía contiene ejemplos prácticos y consejos de productividad.',
  'dashboard.info.resources.desc1':
    'Explora recursos y materiales útiles para tu flujo de trabajo de scanlation.',
  'dashboard.info.resources.desc2': 'Fuentes, plantillas, diccionarios y más.',
  'dashboard.render.noRecognizedText': 'Sin texto reconocido',
  'dashboard.render.noTranslation': 'Sin traducción disponible',
  'dashboard.render.noNotes': 'Sin NT disponible',
  'dashboard.render.noteLabel': 'NT:',
  'dashboard.render.textLabel': 'Texto',
  'dashboard.render.aaLabel': 'AA',
  'dashboard.render.skewXLabel': 'Sx',
  'dashboard.render.skewYLabel': 'Sy',
  'renderPreview.context.title': 'Acciones de región',
  'renderPreview.context.copyRecognized': 'Copiar reconocido',
  'renderPreview.context.copyTranslated': 'Copiar traducción',
  'renderPreview.context.editRendered': 'Editar renderizado',
  'renderPreview.context.editRenderedHint': 'Editar texto renderizado',
  'renderPreview.context.manualModeHint': 'Requiere modo manual',
  'renderPreview.shape': 'Forma',
  'renderPreview.rectangular': 'Rectangular',
  'renderPreview.elliptic': 'Elíptico',
  'renderPreview.convertRectangular': 'Convertir a forma rectangular',
  'renderPreview.convertElliptic': 'Convertir a forma elíptica',
  'renderPreview.manualModeRequired': 'Requiere modo manual',
  'renderPreview.applyTypographyPreset': 'Aplicar preajuste de tipografía',
  'renderPreview.preset': 'Preajuste',
  'renderPreview.typographyPresets': 'Preajustes de tipografía',
  'renderPreview.applyPreset': 'Aplicar preajuste',
  'renderPreview.removeRegion': 'Eliminar selección',
  'renderPreview.textFont': 'Fuente de texto',
  'renderPreview.selectionShape': 'Forma de selección',
  'renderPreview.fontSize': 'Tamaño de fuente',
  'renderPreview.decreaseFont': 'Reducir fuente',
  'renderPreview.increaseFont': 'Aumentar fuente',
  'renderPreview.alignment': 'Alineación',
  'renderPreview.alignLeft': 'Alinear a la izquierda',
  'renderPreview.alignCenter': 'Centrar',
  'renderPreview.alignRight': 'Alinear a la derecha',
  'renderPreview.typographyStyle': 'Estilo de tipografía',
  'renderPreview.bold': 'Negrita',
  'renderPreview.italic': 'Cursiva',
  'renderPreview.underline': 'Subrayado',
  'renderPreview.uppercase': 'Mayúsculas',
  'renderPreview.textOrientation': 'Orientación del texto',
  'renderPreview.horizontal': 'Horizontal',
  'renderPreview.vertical': 'Vertical',
  'renderPreview.circular': 'Circular',
  'renderPreview.rotation': 'Rotación',
  'renderPreview.rotateMinus5': 'Rotar -5°',
  'renderPreview.rotatePlus5': 'Rotar +5°',
  'renderPreview.skewX': 'Inclinación X',
  'renderPreview.skewXMinus2': 'Inclinación X -2°',
  'renderPreview.skewXPlus2': 'Inclinación X +2°',
  'renderPreview.skewY': 'Inclinación Y',
  'renderPreview.skewYMinus2': 'Inclinación Y -2°',
  'renderPreview.skewYPlus2': 'Inclinación Y +2°',
  'renderPreview.adjustments': 'Ajustes',
  'renderPreview.refine': 'Refinar',
  'renderPreview.autoFontSize': 'Tamaño de fuente automático',
  'renderPreview.autoFit': 'Autoajuste',
  'renderPreview.fixed': 'Fijo',
  'renderPreview.hyphenation': 'Guiones',
  'renderPreview.enabled': 'Activado',
  'renderPreview.disabled': 'Desactivado',
  'renderPreview.maxSize': 'Tamaño máximo',
  'renderPreview.minSize': 'Tamaño mínimo',
  'renderPreview.lineSpacing': 'Interlineado',
  'renderPreview.opacity': 'Opacidad',
  'renderPreview.fill': 'Relleno',
  'renderPreview.outline': 'Contorno',
  'renderPreview.shadow': 'Sombra',
  'renderPreview.shadowLayers': 'Capas de sombra',
  'renderPreview.addLayer': 'Añadir capa',
  'renderPreview.layerN': 'Capa {count}',
  'renderPreview.removeLayerN': 'Eliminar capa {count}',
  'renderPreview.shadowLayerN': 'Capa de sombra {count}',
  'renderPreview.blur': 'Desenfoque',
  'renderPreview.offsetX': 'Desplazamiento X',
  'renderPreview.offsetY': 'Desplazamiento Y',
  'renderPreview.radius': 'Radio',
  'renderPreview.startAngle': 'Ángulo inicial',
  'renderPreview.spacing': 'Espaciado',
  'renderPreview.shadowLayersCount': '{count} capa(s)',
  'renderPreview.shadowBlurSummary': 'desenfoque {value}',
  'renderPreview.history.none': 'Sin historial AIO para esta imagen',
  'renderPreview.box.clickToEdit': 'doble clic para editar',
  'renderPreview.box.renderNotApplied': 'renderizado no aplicado en esta etapa',
  'renderPreview.editor.placeholder': 'Escribe el texto final...',
  'renderPreview.editor.aria': 'Editar texto renderizado',
  'splitter.strategy.smart': 'Inteligente automático',
  'splitter.strategy.smartHint': 'Espacios en blanco + heurísticas.',
  'splitter.strategy.advancedDesktop': 'Semi escritorio',
  'splitter.strategy.advancedDesktopHint': 'Análisis local avanzado.',
  'splitter.strategy.manual': 'Manual',
  'splitter.strategy.manualHint': 'Solo ajustes manuales.',
  'splitter.strategy.fixedHeight': 'Altura fija',
  'splitter.strategy.fixedHeightHint': 'Segmenta por altura.',
  'splitter.strategy.count': 'N partes',
  'splitter.strategy.countHint': 'División equitativa.',
  'dashboard.aio.autoScopeTitle': 'Procesamiento automático sin intervención',
  'dashboard.aio.manualScopeTitle': 'Control manual de cada etapa',
  'detectionPreview.recognized': 'Reconocido:',
  'detectionPreview.translated': 'Traducido:',
  'detectionPreview.note': 'NT:',
  'detectionPreview.manual': 'Manual',
  'detectionPreview.removeSelection': 'Eliminar selección',
  'detectionPreview.actions': 'Acciones de región',
  'detectionPreview.text': 'Texto',
  'detectionPreview.copyRecognized': 'Copiar reconocido',
  'detectionPreview.editRecognized': 'Editar reconocido',
  'detectionPreview.manualModeOnly': 'Disponible solo en modo manual',
  'detectionPreview.copyTranslated': 'Copiar traducción',
  'detectionPreview.editTranslated': 'Editar traducción',
  'detectionPreview.removeRegion': 'Eliminar región',
  'detectionPreview.editRecognizedTitle': 'Editar texto reconocido',
  'detectionPreview.editTranslatedTitle': 'Editar texto traducido',
  'detectionPreview.placeholderRecognized': 'Escribe el texto reconocido...',
  'detectionPreview.placeholderTranslated': 'Escribe la traducción...',
  'detectionPreview.rewind': 'Retroceder esta imagen',
  'detectionPreview.forward': 'Avanzar esta imagen',
  'detectionPreview.noHistory': 'Sin historial AIO para esta imagen',
  'dashboard.translator.workspace.aria': 'Modo traductor',
  'dashboard.translator.workspace.textTitle': 'Traducir texto libre',
  'dashboard.translator.workspace.text': 'Texto',
  'dashboard.translator.workspace.visualTitle':
    'Detectar y traducir en imágenes',
  'dashboard.translator.workspace.visual': 'Visual',
  'watermark.header.eyebrow': 'Utilidad editorial',
  'watermark.header.title': 'Marca de agua',
  'watermark.header.badge': 'Lote',
  'watermark.panel.presets': 'Preajustes',
  'watermark.presets.builtin': 'Integrados',
  'watermark.presets.user': 'Guardados',
  'watermark.action.save': 'Guardar',
  'watermark.action.duplicate': 'Duplicar',
  'watermark.panel.text': 'Texto',
  'watermark.text.enable': 'Activar texto',
  'watermark.text.content': 'Contenido',
  'watermark.text.font': 'Fuente',
  'watermark.text.size': 'Tamaño',
  'watermark.text.color': 'Color',
  'watermark.text.outline': 'Contorno',
  'watermark.text.outlineColor': 'Color del contorno',
  'watermark.text.opacity': 'Opacidad',
  'watermark.panel.logo': 'Logo',
  'watermark.logo.enable': 'Activar',
  'watermark.logo.change': 'Cambiar',
  'watermark.logo.upload': 'Subir',
  'watermark.logo.remove': 'Eliminar',
  'watermark.logo.scale': 'Escala %',
  'watermark.logo.opacity': 'Opacidad',
  'watermark.logo.brightness': 'Brillo',
  'watermark.logo.saturation': 'Saturación',
  'watermark.panel.distribution': 'Distribución',
  'watermark.distribution.position': 'Posición',
  'watermark.distribution.rotation': 'Rotación',
  'watermark.distribution.blend': 'Mezcla',
  'watermark.distribution.gapX': 'Espacio X',
  'watermark.distribution.gapY': 'Espacio Y',
  'watermark.distribution.padding': 'Relleno',
  'watermark.distribution.baseName': 'Nombre base',
  'watermark.distribution.smartPlacement': 'Colocación inteligente',
  'watermark.action.applying': 'Aplicando...',
  'watermark.action.applyBatch': 'Aplicar lote',
  'watermark.status.cancelRequested': 'Cancelación solicitada.',
  'watermark.action.cancel': 'Cancelar',
  'watermark.panel.preview': 'Vista previa',
  'watermark.preview.compare': 'Comparar',
  'watermark.preview.mode': 'Vista previa',
  'watermark.preview.empty.title': 'Sin imágenes',
  'watermark.preview.empty.desc':
    'Importa páginas en el panel izquierdo del panel principal.',
  'watermark.preview.noLayer.title': 'Configura una capa',
  'watermark.preview.noLayer.desc':
    'Activa texto o logo en la caja de herramientas para generar la vista previa.',
  'watermark.preview.original': 'Original',
  'watermark.preview.watermark': 'Marca de agua',
  'watermark.preview.compareAria': 'Comparación antes/después',
  'watermark.preview.generating': 'Generando...',
  'watermark.panel.output': 'Salida',
  'watermark.output.empty.title': 'Sin resultados',
  'watermark.output.empty.desc': 'Aplica el lote para generar las descargas.',
  'watermark.action.zip': 'ZIP',
  'watermark.action.folder': 'Carpeta',
  'watermark.action.download': 'Descargar',
  'imgur.hero.eyebrow': 'Subida a Imgur',
  'imgur.hero.title': 'Alojamiento anónimo',
  'imgur.hero.desc':
    'Usa esta utilidad para subidas rápidas a Imgur con rotación aleatoria de Client ID.',
  'imgur.status.remaining': 'Restante: {remaining}',
  'imgur.status.configure': 'Configurar',
  'imgur.alert.missingConfig': 'Configuración incompleta',
  'imgur.alert.addActiveClient':
    'Añade al menos un Client ID activo en Ajustes > Integraciones.',
  'imgur.batch.title': 'Subida por lotes',
  'imgur.batch.limit': 'Límite de {limit} subidas por hora (Usadas: {used})',
  'imgur.dropzone.title': 'Suelta las imágenes aquí',
  'imgur.dropzone.desc': 'Arrastra múltiples archivos JPG, PNG o WEBP.',
  'imgur.toggle.imgOutput': 'Salida como etiqueta <img>',
  'imgur.toggle.imgOutputDesc':
    'Genera código HTML listo para usar en blogs y foros.',
  'imgur.actions.select': 'Seleccionar',
  'imgur.actions.sending': 'Enviando...',
  'imgur.actions.send': 'Enviar',
  'imgur.actions.copy': 'Copiar URLs',
  'imgur.queue.title': 'Cola de subida',
  'imgur.queue.items_one': '{count} elemento',
  'imgur.queue.items_other': '{count} elementos',
  'imgur.queue.empty': 'La cola está vacía. Añade imágenes arriba.',
  'imgur.queue.altPlaceholder': 'Texto alternativo',
  'imgur.queue.urlLabel': 'URL',
  'imgur.queue.keyLabel': 'Clave',
  'imgur.queue.remove': 'Eliminar',
  'imgur.error.configLoad': 'Error al cargar la configuración de Imgur.',
  'imgur.error.uploadFailed': 'Error al subir la imagen.',
  'imgur.feedback.singleSuccess': 'Subida completada correctamente.',
  'imgur.feedback.multiSuccess': 'Subida de {count} imágenes completada.',
  'ranking.metric.overall': 'Puntuación general',
  'ranking.metric.quality': 'Calidad',
  'ranking.metric.speed': 'Velocidad',
  'ranking.metric.costBenefit': 'Relación calidad-precio',
  'ranking.metric.easeOfUse': 'Facilidad de uso',
  'ranking.trend.neutral': 'Neutral',
  'ranking.trend.points': 'pts',
  'ranking.table.title': 'Clasificación',
  'ranking.table.sortedBy': 'Ordenado por {metric} ponderado.',
  'ranking.table.modelsCount': '{count} modelos clasificados',
  'ranking.table.empty': 'Ningún modelo coincide con los filtros actuales.',
  'ranking.table.newLabel': 'Nuevo',
  'ranking.table.reviewsCount': '{count} reseñas',
  'ranking.table.reviewedByYou': 'Ya has reseñado',
  'ranking.table.viewDetails': 'Ver detalles',
  'ranking.filters.metricAria': 'Métrica del ranking',
  'ranking.filters.searchPlaceholder': 'Buscar modelo...',
  'ranking.filters.searchAria': 'Buscar modelo',
  'ranking.filters.advancedAria': 'Mostrar filtros avanzados',
  'ranking.filters.button': 'Filtros',
  'ranking.filters.stageLabel': 'Etapa',
  'ranking.filters.sourceLabel': 'Origen',
  'ranking.filters.languageLabel': 'Idioma',
  'ranking.filters.minReviewsLabel': 'Reseñas mín.',
  'ranking.filters.allStages': 'Todas las etapas',
  'ranking.filters.allSources': 'Local + Nube',
  'ranking.filters.onlyLocal': 'Solo local',
  'ranking.filters.onlyCloud': 'Solo nube',
  'ranking.filters.allLanguages': 'Todos los idiomas',
  'ranking.filters.reviews_one': '{count} reseña',
  'ranking.filters.reviews_other': '{count} reseñas',
  'ranking.composer.usage.balanced': 'Equilibrado',
  'ranking.composer.usage.qualityFirst': 'Calidad primero',
  'ranking.composer.usage.speedFirst': 'Velocidad primero',
  'ranking.composer.usage.lowVram': 'VRAM baja',
  'ranking.composer.usage.offlineLocal': 'Pipeline local',
  'ranking.composer.usage.cloudPipeline': 'Pipeline en la nube',
  'ranking.composer.title.edit': 'Editar reseña',
  'ranking.composer.title.new': 'Nueva reseña',
  'ranking.composer.action.close': 'Cerrar',
  'ranking.composer.field.title': 'Título',
  'ranking.composer.field.titlePlaceholder': 'Ej.: Mejor OCR local para manga',
  'ranking.composer.field.context': 'Contexto',
  'ranking.composer.field.sourceLang': 'Idioma de origen',
  'ranking.composer.field.sourceLangPlaceholder': 'ja, en, pt-br...',
  'ranking.composer.field.targetLang': 'Idioma de destino',
  'ranking.composer.field.targetLangPlaceholder': 'en, pt, pt-br...',
  'ranking.composer.field.device': 'Dispositivo',
  'ranking.composer.device.none': 'No especificado',
  'ranking.composer.field.comment': 'Comentario',
  'ranking.composer.field.commentPlaceholder':
    'Describe la calidad general, estabilidad, uso de recursos y dónde este modelo aporta más valor.',
  'ranking.composer.action.reset': 'Restablecer',
  'ranking.composer.action.delete': 'Eliminar',
  'ranking.composer.action.save': 'Guardar',
  'ranking.composer.action.publish': 'Publicar',
  'dashboard.specialMode.visualEmpty.title': 'Traductor visual',
  'dashboard.specialMode.visualEmpty.description':
    'Importa imágenes para comenzar a traducir directamente en la vista previa.',
  'dashboard.specialMode.visualEmpty.cta': 'Seleccionar imágenes',
  'dashboard.reviewRaw.raw.title': 'Revisión de raws',
  'dashboard.reviewRaw.raw.description':
    'Analiza la calidad de las imágenes originales y prepara el lote para el pipeline.',
  'dashboard.reviewRaw.raw.note':
    'La validación de raws ayuda a la IA a entender mejor el contexto visual antes del OCR.',
  'dashboard.reviewRaw.raw.statusReady':
    'Lote de {count} imágenes listo para validación.',
  'dashboard.reviewRaw.raw.validate': 'Validar raws',
  'dashboard.reviewRaw.qc.title': 'Control de calidad',
  'dashboard.reviewRaw.qc.descriptionAuto':
    'El QC automático usa modelos ligeros para detectar errores de edición comunes.',
  'dashboard.reviewRaw.qc.descriptionManual':
    'El modo manual permite una revisión detallada de cada globo y redibujo.',
  'dashboard.reviewRaw.qc.note':
    'Activa las comprobaciones de abajo para ejecutar el análisis por lotes.',
  'dashboard.reviewRaw.qc.automaticChecks': 'Comprobaciones automáticas',
  'dashboard.reviewRaw.qc.checks.untranslatedText': 'Texto sin traducir',
  'dashboard.reviewRaw.qc.checks.emptyBubbles': 'Globos vacíos',
  'dashboard.reviewRaw.qc.checks.visualArtifacts': 'Artefactos visuales',
  'dashboard.reviewRaw.qc.checks.textAlignment': 'Alineación de texto',
  'dashboard.reviewRaw.qc.checks.fontConsistency': 'Consistencia de fuentes',
  'dashboard.reviewRaw.qc.inProgress': 'Análisis de QC en progreso...',
  'dashboard.reviewRaw.qc.run': 'Ejecutar QC',
  'common.cancel': 'Cancelar',
  'common.save': 'Guardar',
  'common.name': 'Nombre',
  'common.newName': 'Nuevo nombre',
  'common.removed': 'Eliminado',
  'common.renamed': 'Renombrado',
  'common.duplicated': 'Duplicado',
  'common.saved': 'Guardado',
  'common.failed': 'Error',
  'common.cancelled': 'Cancelado',
  'common.status': 'Estado',
  'common.configured': 'Configurado',
  'common.no': 'No',
  'common.account': 'Cuenta',
  'common.format': 'Formato',
  'common.exportedCount': 'Exportados: {count} elementos.',
  'modelManager.modal.verified': 'Verificado el',
  'modelManager.modal.upToDate': 'Al día',
  'modelManager.modal.closeAria': 'Cerrar modal',
  'modelManager.modal.localModels': 'Catálogo local',
  'modelManager.modal.localDesc':
    'Instalación bajo demanda con verificación de integridad.',
  'modelManager.modal.noLocal': 'Ningún modelo local coincide con los filtros.',
  'modelManager.modal.cloudModels': 'Catálogo en la nube',
  'modelManager.modal.cloudDesc':
    'Modelos basados en API/Nube. Requieren conexión y tus propias claves.',
  'modelManager.modal.hideCustom': 'Ocultar personalizados',
  'modelManager.modal.addCustom': 'Añadir personalizado',
  'modelManager.modal.noCloud':
    'Ningún modelo en la nube coincide con los filtros.',
  'modelManager.modal.checking': 'Comprobando...',
  'modelManager.modal.checkUpdates': 'Buscar actualizaciones',
  'modelManager.modal.installAll': 'Instalar recomendados',
  'modelManager.modal.cancel': 'Cancelar',
  'modelManager.modal.noEligible': 'No se encontraron modelos elegibles.',
  'modelManager.modal.notEnoughSpace':
    'Espacio insuficiente (necesita {space}).',
  'resources.breadcrumb.home': 'Recursos',
  'resources.communities.title': 'Comunidades y enlaces',
  'resources.back': 'Volver a Recursos',
  'resources.communities.desc':
    'Comunidades activas de scanlation, servidores de Discord, foros y recursos para hacer contactos y aprender.',
  'resources.platform.discord': 'Discord',
  'resources.platform.forum': 'Foro',
  'resources.platform.reddit': 'Reddit',
  'resources.platform.website': 'Sitio web',
  'resources.communities.members': '{count} miembros',
  'resources.action.visit': 'Visitar',
  'resources.externalTools.title': 'Herramientas externas',
  'resources.externalTools.desc':
    'Software y aplicaciones recomendados que complementan KŌMA Studio en tu flujo de trabajo de scanlation.',
  'resources.category.editing': 'Edición',
  'resources.category.ocr': 'OCR',
  'resources.category.translation': 'Traducción',
  'resources.category.fonts': 'Fuentes',
  'resources.category.hosting': 'Alojamiento',
  'resources.category.utility': 'Utilidades',
  'resources.action.open': 'Abrir',
  'resources.action.download': 'Descargar',
  'resources.status.free': 'Gratis',
  'resources.status.paid': 'De pago',
  'resources.fonts.title': 'Fuentes para tipografía',
  'resources.fonts.desc':
    'Colección curada de fuentes populares para scanlation. Incluye fuentes para diálogos, narración, énfasis, SFX y texto CJK.',
  'resources.fonts.searchPlaceholder':
    'Buscar fuentes por nombre, uso o etiqueta...',
  'resources.fonts.noResults': 'No se encontraron fuentes para "{search}"',
  'resources.license.free': 'Gratis',
  'resources.license.openSource': 'Código abierto',
  'resources.license.commercial': 'Comercial',
  'resources.license.mixed': 'Mixta',
  'resources.glossary.title': 'Glosario de scanlation',
  'resources.glossary.desc':
    'Términos técnicos, jerga de la comunidad y vocabulario esencial para scanlation de manga, manhwa y manhua.',
  'resources.glossary.searchPlaceholder': 'Buscar términos...',
  'resources.glossary.noResults': 'No se encontraron términos para "{search}"',
  'resources.glossary.related': 'Relacionados:',
  'resources.category.general': 'General',
  'resources.category.typesetting': 'Tipografía',
  'resources.category.cleaning': 'Limpieza',
  'resources.category.technical': 'Técnico',
  'resources.category.roles': 'Roles',
  'resources.sfx.title': 'Biblioteca de SFX',
  'resources.sfx.desc':
    'Biblioteca de efectos de sonido japoneses con traducciones, pronunciación romaji y ejemplos de uso en manga.',
  'resources.sfx.searchPlaceholder': 'Buscar por japonés, romaji o español...',
  'resources.sfx.noResults': 'No se encontraron SFX.',
  'resources.sfx.commonIn': 'Común en: {value}',
  'resources.category.impact': 'Impacto',
  'resources.category.emotion': 'Emoción',
  'resources.category.ambient': 'Ambiente',
  'resources.category.action': 'Acción',
  'resources.category.voice': 'Voz',
  'resources.category.misc': 'Varios',
  'resources.filters.all': 'Todos ({count})',
  'resources.page.tab.fonts': 'Fuentes',
  'resources.page.tab.sfx': 'Biblioteca de SFX',
  'resources.page.tab.glossary': 'Glosario',
  'resources.page.tab.communities': 'Comunidades',
  'resources.page.tab.tools': 'Herramientas',
  'resources.page.title.main': 'Centro de ',
  'resources.page.title.accent': 'recursos',
  'resources.page.subtitle':
    'Materiales curados, comunidades y herramientas para tu flujo de trabajo.',
  'resources.page.searchPlaceholder': 'Buscar en todas las categorías...',
  'resources.page.searchAria': 'Campo de búsqueda de recursos',
  'resources.page.clearSearch': 'Limpiar búsqueda',
  'resources.page.tabsAria': 'Categorías de recursos',
  'resources.category.fonts.label': 'Fuentes para tipografía',
  'resources.category.fonts.description':
    'Colección curada de fuentes populares para scanlation de manga, manhwa y manhua.',
  'resources.category.sfx-library.label': 'Biblioteca de SFX',
  'resources.category.sfx-library.description':
    'Biblioteca de onomatopeyas japonesas con traducciones y ejemplos de uso.',
  'resources.category.glossary.label': 'Glosario de scanlation',
  'resources.category.glossary.description':
    'Términos técnicos y jerga de la comunidad del mundo del scanlation.',
  'resources.category.communities.label': 'Comunidades',
  'resources.category.communities.description':
    'Servidores de Discord, subreddits y foros de scanlation.',
  'resources.category.tools-external.label': 'Herramientas externas',
  'resources.category.tools-external.description':
    'Software complementario y herramientas en línea útiles.',
  'resources.home.title': 'Centro de recursos',
  'resources.home.subtitle':
    'Materiales curados, comunidades y herramientas para tu flujo de trabajo.',
  'resources.home.itemCount': '{count} elementos',
  'dashboard.aio.result.regionsDetected': '{count} región(es) detectada(s)',
  'dashboard.aio.result.textsRecognized': '{count} texto(s) reconocido(s)',
  'dashboard.aio.result.translationsGenerated':
    '{count} traducción(es) generada(s)',
  'dashboard.aio.result.regionsSegmented': '{count} región(es) segmentada(s)',
  'dashboard.aio.result.imagesCleaned': '{count} imagen(es) limpiada(s)',
  'dashboard.aio.result.blocksReady':
    '{count} bloque(s) listo(s) para renderizar',
  'dashboard.aio.result.finished': 'AIO completo. {parts}.',
  'resources.glossary.category.general': 'General',
  'resources.glossary.category.typesetting': 'Tipografía',
  'resources.glossary.category.cleaning': 'Limpieza',
  'resources.glossary.category.translation': 'Traducción',
  'resources.glossary.category.technical': 'Técnico',
  'resources.glossary.category.roles': 'Roles',
  'resources.glossary.filterAll': 'Todos',
  'resources.glossary.results_one': 'término encontrado',
  'resources.glossary.results_other': 'términos encontrados',
  'resources.glossary.context': 'Glosario',
  'resources.glossary.alphaAria': 'Navegación alfabética',
  'resources.glossary.alphaBtnAria': 'Ir a la letra {letter}',
  'dashboard.aio.config.sourceLanguage':
    'Idioma de origen (Detectar/OCR/Traducir)',
  'dashboard.aio.config.targetLanguage': 'Idioma de traducción',
  'dashboard.aio.pipeline.rewind': 'Retroceder pipeline',
  'dashboard.aio.pipeline.forward': 'Avanzar pipeline',
  'dashboard.aio.pipeline.snapshot': 'Instantánea: ',
  'dashboard.aio.pipeline.image': 'Imagen: ',
  'dashboard.aio.pipeline.stage': 'Etapa: ',
  'dashboard.aio.translation.noneSelected': 'Ningún modelo seleccionado.',
  'dashboard.aio.translation.selected': 'Seleccionado: ',
  'dashboard.aio.render.hint':
    'Los controles de fuente/color/alineación están en el dock contextual del overlay. Atajo: Shift + Scroll para rotar.',
  'dashboard.aio.render.warning':
    'La imagen está en una etapa anterior a Renderizar. Usa Avanzar para verla.',
  'dashboard.aio.render.disabled':
    'Activa la etapa de Renderizar en el pipeline para configurar.',
  'dashboard.stitch.lastToNext': 'Última imagen enviada al siguiente lote.',
  'dashboard.stitch.firstFromNext':
    'Primera imagen del siguiente lote añadida al lote actual.',
  'dashboard.stitch.resetPlanning':
    'Planificación del unidor recalculada automáticamente.',
  'dashboard.aio.customAi.syncing': 'IA personalizada (sincronizando...)',
  'dashboard.aio.customOcr.syncing': 'OCR personalizado (sincronizando...)',
  'dashboard.aio.customOcr.useCase':
    'Perfil de OCR personalizado esperando sincronización local.',
  'dashboard.aio.customAi.useCase':
    'Perfil personalizado esperando sincronización local.',
  'dashboard.aio.config.languageHint':
    'El idioma de origen se usa en las etapas de Detectar, Reconocer y Traducir. El idioma de traducción se aplica solo a la traducción.',
  'dashboard.aio.presets.title': 'Preajustes AIO por idioma',
  'dashboard.aio.presets.currentLanguage': 'Idioma actual:',
  'dashboard.aio.presets.noneActive': 'Sin preajuste activo',
  'dashboard.aio.presets.activeSuffix': '(activo)',
  'dashboard.aio.presets.new': 'Nuevo',
  'dashboard.aio.presets.edit': 'Editar',
  'dashboard.aio.presets.delete': 'Eliminar',
  'dashboard.aio.presets.saveCurrent': 'Guardar actual',
  'dashboard.aio.presets.openSettings': 'Abrir preajustes en Ajustes',
  'dashboard.aio.presets.presetName': 'Nombre del preajuste',
  'dashboard.aio.presets.namePlaceholder': 'Ej.: OCR JP rápido',
  'dashboard.aio.presets.description': 'Descripción',
  'dashboard.aio.presets.optional': 'Opcional',
  'dashboard.aio.presets.setActiveFor': 'Establecer como preajuste activo para',
  'dashboard.aio.presets.cancel': 'Cancelar',
  'dashboard.aio.presets.update': 'Actualizar preajuste',
  'dashboard.aio.presets.create': 'Crear preajuste',
  'dashboard.aio.translation.selectedSummaryModel':
    'Seleccionado: {name}',
  'dashboard.aio.translation.selectedSummaryCustom':
    'Seleccionado: {name} (Personalizado/Proveedor FREE)',
  'dashboard.aio.translation.selectedSummaryLegacy':
    'Seleccionado: {name} (Nube/API/IA)',
  'dashboard.aio.translation.selectedSummaryEmpty':
    'Selecciona un modelo local o en la nube para traducir en AIO.',
  'dashboard.aio.translation.supportSummary':
    'Los modelos locales se descargan bajo demanda; los modelos nube/API permanecen disponibles vía clave.',
  'dashboard.aio.translation.additionalContextPlaceholder': 'Contexto adicional para la traducción en la nube...',
  'dashboard.aio.translation.notesToggle':
    'Generar y mostrar NT separadas de la traducción',
  'dashboard.aio.translation.neighborContextToggle':
    'Usar contexto de imágenes vecinas en el lote',
  'dashboard.aio.translation.multimodalToggle':
    'Enviar la imagen de la página como contexto multimodal',
  'dashboard.aio.translation.activeConfigFor':
    'Configuración activa para: {value}.',
  'dashboard.aio.customAi.title': 'IA personalizada',
  'dashboard.aio.customAi.loadingProfiles':
    'Cargando perfiles personalizados...',
  'dashboard.aio.customAi.savedTranslationProfile':
    'Perfil de traducción guardado',
  'dashboard.aio.customAi.newTranslationProfile': 'Nuevo perfil de traducción',
  'dashboard.aio.customAi.name': 'Nombre',
  'dashboard.aio.customAi.translationNamePlaceholder':
    'Ej.: OpenRouter Manga EN-US',
  'dashboard.aio.customAi.apiBasePlaceholder': 'https://api.example.com/v1',
  'dashboard.aio.customAi.useLocalOllama': 'Preajuste local Ollama',
  'dashboard.aio.customAi.apiKeyOptional': 'Clave de API (opcional)',
  'dashboard.aio.customAi.apiKeyPlaceholder': 'sk-...',
  'dashboard.aio.customAi.translationModelPlaceholder': 'openai/gpt-4.1...',
  'dashboard.aio.customAi.resetTranslation': 'Limpiar traducción',
  'dashboard.aio.customAi.useSavedTranslation': 'Usar traducción',
  'dashboard.aio.customAi.removeTranslation': 'Eliminar traducción',
  'dashboard.aio.customAi.saveTranslation': 'Guardar traducción',
  'dashboard.aio.customAi.savedOcrProfile': 'Perfil de OCR guardado',
  'dashboard.aio.customAi.newOcrProfile': 'Nuevo perfil de OCR',
  'dashboard.aio.customAi.ocrNamePlaceholder': 'Ej.: Private Vision OCR',
  'dashboard.aio.customAi.ocrModelPlaceholder': 'gpt-4.1-mini...',
  'dashboard.aio.customAi.resetOcr': 'Limpiar OCR',
  'dashboard.aio.customAi.useSavedOcr': 'Usar OCR',
  'dashboard.aio.customAi.removeOcr': 'Eliminar OCR',
  'dashboard.aio.customAi.saveOcr': 'Guardar OCR',
  'dashboard.aio.customAi.openAiCompatibleHint':
    'Usa una API compatible con OpenAI.',
  'dashboard.aio.clean.maskDilation': 'Dilatación de máscara',
  'bugReport.title': 'Reportar error',
  'bugReport.subtitle':
    'Captura de pantalla + registros automáticos + archivos adjuntos manuales',
  'bugReport.close': 'Cerrar',
  'bugReport.details': 'Detalles',
  'bugReport.evidence': 'Evidencia',
  'bugReport.machineSnapshotIncluded':
    'Incluye automáticamente una instantánea técnica del equipo.',
  'bugReport.field.title': 'Título',
  'bugReport.field.description': 'Descripción',
  'bugReport.field.severity': 'Gravedad',
  'bugReport.field.steps': 'Pasos para reproducir',
  'bugReport.field.expected': 'Esperado',
  'bugReport.field.actual': 'Resultado real',
  'bugReport.field.contact': 'Contacto',
  'bugReport.placeholder.title': 'Ej.: Error al procesar lote en AIO',
  'bugReport.placeholder.description': 'Describe el problema',
  'bugReport.placeholder.steps': '1. … 2. … 3. …',
  'bugReport.placeholder.contact': 'correo, Discord, @usuario',
  'bugReport.severity.low': 'Baja',
  'bugReport.severity.medium': 'Media',
  'bugReport.severity.high': 'Alta',
  'bugReport.severity.critical': 'Crítica',
  'bugReport.preparingEvidence': 'Preparando captura de pantalla y registros…',
  'bugReport.dragToCrop': 'Arrastra para seleccionar un recorte opcional.',
  'bugReport.clearCrop': 'Borrar recorte',
  'bugReport.manualAttachments': 'Archivos adjuntos manuales',
  'bugReport.attach': 'Adjuntar',
  'bugReport.attach.summary':
    'Máx. {count} archivos, {size}MB cada uno. Total: {total}.',
  'bugReport.attach.maxCount': 'Máx. {count} archivos adjuntos.',
  'bugReport.attach.fileTooLarge': '{name} > {size}MB.',
  'bugReport.attach.totalTooLarge': 'Total > {size}MB.',
  'bugReport.attach.remove': 'Eliminar {name}',
  'bugReport.screenshotUnavailable': 'Captura de pantalla no disponible.',
  'bugReport.error.bridgeUnavailable': 'Bridge no disponible.',
  'bugReport.error.prepareFailed': 'Error al preparar el reporte de error.',
  'bugReport.error.noScreenshot': 'No hay captura de pantalla disponible.',
  'bugReport.error.fillTitleDescription':
    'Completa el título y la descripción.',
  'bugReport.error.generic': 'Error.',
  'bugReport.success.sent': 'Reporte enviado.{screenshot}',
  'bugReport.success.screenshot': 'Captura de pantalla: {url}',
  'bugReport.legalPrefix':
    'Al enviar, confirmas que has revisado la captura de pantalla, los registros y los archivos adjuntos. Material enviado según',
  'bugReport.sending': 'Enviando…',
  'bugReport.submit': 'Enviar reporte',
  'dashboard.topbar.tools': 'Herramientas',
  'dashboard.topbar.showSidebar': 'Mostrar barra lateral',
  'dashboard.topbar.sidebar': 'Barra lateral',
  'dashboard.topbar.disableBatch': 'Desactivar lote',
  'dashboard.topbar.enableBatch': 'Activar lote',
  'dashboard.topbar.batchStatus': 'Lote · {count}h',
  'dashboard.topbar.threads': 'Hilos',
  'dashboard.topbar.viewMode': 'Vista',
  'dashboard.topbar.paginated': 'Paginado',
  'dashboard.topbar.longStrip': 'Tira larga',
  'dashboard.topbar.rotate90': 'Rotar 90°',
  'dashboard.topbar.selectImage': 'Selecciona una imagen',
  'dashboard.topbar.export': 'Exportar',
  'dashboard.topbar.textFile': 'Archivo de texto',
  'dashboard.topbar.textPackage': 'Paquete de texto',
  'dashboard.topbar.imagePackage': 'Paquete de imágenes',
  'dashboard.topbar.downloadTextAsTxt': 'Descarga la traducción como .txt.',
  'dashboard.topbar.downloadVisualZip':
    'ZIP con archivos .txt de OCR y traducción por imagen.',
  'dashboard.topbar.format': 'Formato',
  'dashboard.topbar.quality': 'Calidad',
  'dashboard.topbar.package': 'Paquete',
  'dashboard.topbar.rawText': 'Texto original',
  'dashboard.topbar.translated': 'Traducido',
  'dashboard.topbar.inpainted': 'Limpiado',
  'dashboard.topbar.downloadTxt': 'Descargar TXT',
  'dashboard.topbar.downloadZip': 'Descargar ZIP',
  'dashboard.topbar.downloadPackage': 'Descargar paquete',
  'dashboard.topbar.layeredPsd': 'PSD con capas',
  'dashboard.topbar.layeredPsdHint':
    'Exporta PSD para Photoshop, CSP, Krita, GIMP.',
  'dashboard.topbar.compression': 'Compresión',
  'dashboard.topbar.dpi': 'DPI',
  'dashboard.topbar.ocrOverlay': 'Capa de OCR',
  'dashboard.topbar.crops': 'Recortes',
  'dashboard.topbar.rawTextLayer': 'Capa de texto original',
  'dashboard.topbar.translatedLayer': 'Capa traducida',
  'dashboard.topbar.psTextLayers': 'Capas de texto PS',
  'dashboard.topbar.metadataJson': 'Metadatos JSON',
  'dashboard.topbar.photoshopRequired':
    'Requiere Adobe Photoshop (2025–cc2017).',
  'dashboard.topbar.generating': 'Generando…',
  'dashboard.topbar.psdWithMeta': 'PSD + Meta',
  'dashboard.topbar.exportPsd': 'Exportar PSD',
  'dashboard.topbar.undoWorkspace': 'Deshacer espacio de trabajo',
  'dashboard.topbar.undoShortcut': 'Deshacer (Ctrl+Z)',
  'dashboard.topbar.redoWorkspace': 'Rehacer espacio de trabajo',
  'dashboard.topbar.redoShortcut': 'Rehacer (Ctrl+Shift+Z / Ctrl+Y)',
  'dashboard.topbar.shortcuts': 'Atajos',
  'dashboard.topbar.shortcutsHint': 'Atajos (H)',
  'dashboard.topbar.hideTools': 'Ocultar herramientas',
  'dashboard.topbar.showTools': 'Mostrar herramientas',
  'dashboard.topbar.hide': 'Ocultar',
  'dashboard.topbar.profile': 'Perfil',
  'dashboard.topbar.exportWorkspace': 'Exportar espacio de trabajo',
  'dashboard.topbar.importWorkspace': 'Importar espacio de trabajo',
  'dashboard.topbar.clearLocalAutosave': 'Borrar autoguardado local',
  'dashboard.topbar.closeWorkspace': 'Cerrar espacio de trabajo',
  'dashboard.topbar.replayTour': 'Repetir recorrido',
  'dashboard.topbar.scanlationFeed': 'Feed de Scanlation',
  'dashboard.topbar.rankings': 'Rankings',
  'dashboard.topbar.logout': 'Cerrar sesión',
  'dashboard.topbar.brand': 'KŌMA Studio',
  'dashboard.topbar.autoManualBadge': 'A/M',
  'dashboard.topbar.zoomOut': 'Alejar',
  'dashboard.topbar.zoomIn': 'Acercar',
  'dashboard.topbar.compressionRle': 'RLE',
  'dashboard.topbar.compressionZip': 'ZIP',
  'dashboard.topbar.compressionRaw': 'RAW',
  'dashboard.topbar.navigation': 'Navegación',
  'dashboard.topbar.optionPng': 'PNG',
  'dashboard.topbar.optionJpeg': 'JPEG',
  'dashboard.topbar.optionWebp': 'WEBP',
  'dashboard.topbar.optionPdf': 'PDF',
  'dashboard.topbar.optionCbz': 'CBZ',
  'dashboard.topbar.optionCb7': 'CB7',
  'dashboard.topbar.optionZip': 'ZIP',
  'renderPreview.circularText': 'Texto circular',
  'settings.aioPresets.description':
    'Combinaciones de modelos para las 5 etapas AIO por idioma de origen. Elige qué preajuste está activo.',
  'settings.aioPresets.catalog': 'Catálogo',
  'settings.aioPresets.syncingCatalog': 'Sincronizando modelos locales + en la nube.',
  'settings.aioPresets.editPreset': 'Editar preajuste',
  'settings.aioPresets.newPreset': 'Nuevo preajuste',
  'settings.aioPresets.namePlaceholder': 'Ej.: Japonés HQ',
  'settings.aioPresets.sourceLanguage': 'Idioma de origen',
  'settings.aioPresets.shortDescription': 'Descripción breve…',
  'settings.aioPresets.select': 'Seleccionar',
  'settings.aioPresets.noneRegistered': 'No hay preajustes registrados.',
  'settings.aioPresets.createFirst': 'Crear primero',
  'settings.aioPresets.presetCount': '{count} preajuste(s)',
  'settings.aioPresets.clearActive': 'Desactivar activo',
  'settings.aioPresets.active': 'Activo',
  'settings.aioPresets.activate': 'Activar',
  'settings.aioPresets.editNamed': 'Editar {name}',
  'settings.aioPresets.deleteNamed': 'Eliminar {name}',
  'settings.pickerPalette.title': 'Paleta del selector',
  'settings.pickerPalette.description':
    'Preajustes de colores sólidos y degradados para los selectores de relleno.',
  'settings.pickerPalette.newPreset': 'Nuevo preajuste',
  'settings.pickerPalette.add': 'Añadir',
  'settings.pickerPalette.reset': 'Restablecer',
  'settings.pickerPalette.hintPrefix': 'Acepta sólidos y degradados. Ej.:',
  'settings.pickerPalette.hintOr': 'o',
  'settings.pickerPalette.solids': 'Sólidos',
  'settings.pickerPalette.gradients': 'Degradados',
  'settings.modePresets.title': 'Preajustes de modo',
  'settings.modePresets.description':
    'Estilo base por modo de texto. Se aplica automáticamente en el panel.',
  'settings.modePresets.targetMode': 'Modo objetivo',
  'settings.modePresets.outline': 'Contorno',
  'settings.modePresets.off': 'Desactivado',
  'settings.modePresets.outlineWidth': 'Ancho del contorno',
  'settings.modePresets.ocrGradient': 'Degradado OCR',
  'settings.modePresets.detect': 'Detectar',
  'settings.modePresets.ignore': 'Ignorar',
  'settings.modePresets.textColor': 'Color del texto',
  'settings.modePresets.outlineColor': 'Color del contorno',
  'settings.modePresets.all': 'Todos',
  'settings.modePresets.mode': 'Modo',
  'settings.modePresets.save': 'Guardar',
  'settings.typographerLibrary.title': 'Biblioteca del Tipógrafo',
  'settings.typographerLibrary.description':
    'Estilos globales con carpetas, preajuste predeterminado y vinculación por modo detectado.',
  'settings.typographerLibrary.newFolder': 'Nueva carpeta',
  'settings.typographerLibrary.defaultPreset': 'Preajuste predeterminado',
  'settings.typographerLibrary.none': 'Ninguno',
  'settings.typographerLibrary.edit': 'Editar',
  'settings.typographerLibrary.new': 'Nuevo',
  'settings.typographerLibrary.presetTypographer': 'Preajuste del Tipógrafo',
  'settings.typographerLibrary.folder': 'Carpeta',
  'settings.typographerLibrary.withoutFolder': 'Sin carpeta',
  'settings.typographerLibrary.descriptionPlaceholder': 'Ej.: Globo EN-US',
  'settings.typographerLibrary.padding': 'Relleno',
  'settings.typographerLibrary.lineSpacing': 'Interlineado',
  'settings.updates.title': 'Actualizaciones',
  'settings.updates.currentVersion': 'Versión actual',
  'settings.updates.newVersion': 'Nueva versión',
  'settings.updates.status': 'Estado',
  'settings.updates.channel': 'Canal',
  'settings.updates.installOnClose': 'Instalar al cerrar',
  'settings.updates.policy': 'Política',
  'settings.updates.mandatory': 'Obligatoria',
  'settings.updates.optional': 'Opcional',
  'settings.updates.lastCheck': 'Última comprobación',
  'settings.updates.downloadCompleted': 'Descarga completada',
  'settings.updates.channelTitle': 'Canal de actualización',
  'settings.updates.stableDesc': 'Versiones probadas y estables',
  'settings.updates.betaDesc': 'Acceso anticipado a funciones',
  'settings.updates.installOnCloseTitle':
    'Instalar actualización al cerrar la app',
  'settings.updates.installOnCloseDesc':
    'Cuando el paquete ya está descargado, la instalación comenzará automáticamente al salir.',
  'settings.updates.checking': 'Comprobando…',
  'settings.updates.checkNow': 'Buscar actualizaciones',
  'settings.updates.download': 'Descargar actualización',
  'settings.autosave.title': 'Autoguardado del espacio de trabajo',
  'settings.autosave.description':
    'Controla si el panel guarda automáticamente el espacio de trabajo local y el intervalo entre guardados.',
  'settings.autosave.enableTitle': 'Activar autoguardado automático',
  'settings.autosave.enableDesc':
    'Cuando está activado, el espacio de trabajo se guarda localmente a intervalos regulares siempre que haya cambios pendientes.',
  'settings.autosave.interval': 'Intervalo',
  'settings.autosave.save': 'Guardar autoguardado',
  'settings.shortcuts.title': 'Centro de atajos',
  'settings.shortcuts.description':
    'La configuración oficial de atajos está ahora en el panel, en la barra superior. Esto evita discrepancias entre la pantalla principal y la página de ajustes.',
  'settings.shortcuts.whereToEdit': 'Dónde editar',
  'settings.shortcuts.whereToEditDesc': 'Abre el panel y usa',
  'settings.shortcuts.orPress': 'o presiona',
  'settings.tabs.ariaLabel': 'Pestañas de ajustes',
  'settings.integrations.test': 'Probar',
  'settings.integrations.testing': 'Probando…',
  'settings.integrations.ok': '✓ OK',
  'settings.integrations.failed': '✗ Error',
  'settings.integrations.saved': '✓ Guardado',
  'settings.integrations.discord.description':
    'Notificaciones de procesamiento, errores y alertas de cuota.',
  'settings.integrations.discord.webhookUrl': 'URL del webhook',
  'settings.integrations.discord.webhookPlaceholder':
    'https://discord.com/api/webhooks/…',
  'settings.integrations.discord.botName': 'Nombre del bot',
  'settings.integrations.discord.webhookActive': 'Webhook activo',
  'settings.integrations.discord.howToSetup': 'Cómo configurar',
  'settings.integrations.discord.step1': 'En Discord:',
  'settings.integrations.discord.step1Strong':
    'Ajustes del servidor → Integraciones → Webhooks → Nuevo Webhook',
  'settings.integrations.discord.step2':
    'Copia la URL y pégala en el campo de arriba.',
  'dashboard.dashboardLlm.extraContextPlaceholder':
    'Contexto extra: personajes, tono, glosario…',
  'dashboard.dashboardLlm.temperature': 'Temperatura',
  'dashboard.dashboardLlm.topP': 'Top P',
  'dashboard.dashboardLlm.maxTokens': 'Tokens máximos',
  'dashboard.dashboardLlm.translationProfile': 'Perfil de traducción',
  'dashboard.dashboardLlm.translationModelPlaceholder': 'gpt-4.1, claude…',
  'dashboard.dashboardLlm.apiKey': 'Clave de API',
  'dashboard.dashboardLlm.apiKeyPlaceholder': 'sk-… (opcional)',
  'dashboard.dashboardLlm.ocrProfile': 'Perfil de OCR',
  'dashboard.dashboardLlm.openAiCompatibleHint':
    'Compatible con OpenAI. La base puede ser /v1 o el endpoint completo. Algunos aceptan clave vacía.',
  'dashboard.dashboardLlm.clear': 'Limpiar',
  'dashboard.dashboardLlm.use': 'Usar',
  'dashboard.dashboardLlm.remove': 'Eliminar',
  'dashboard.dashboardLlm.save': 'Guardar',
  'dashboard.dashboardLlm.hdStrategy': 'Estrategia HD',
  'dashboard.dashboardLlm.resize': 'Redimensionar',
  'dashboard.dashboardLlm.crop': 'Recortar',
  'dashboard.dashboardLlm.original': 'Original',
  'dashboard.dashboardLlm.hdStrategyHint':
    'Estrategia para imágenes grandes antes del inpainting.',
  'dashboard.dashboardLlm.resizeLimit': 'Límite de redimensionado',
  'dashboard.dashboardLlm.cropMargin': 'Margen de recorte',
  'dashboard.dashboardLlm.cropTriggerSize': 'Tamaño de activación de recorte',
  'dashboard.dashboardRegion.title': 'Región',
  'dashboard.dashboardRegion.blocks': 'Bloques',
  'dashboard.dashboardRegion.selection': 'Selección',
  'dashboard.dashboardRegion.ocr': 'OCR',
  'dashboard.dashboardRegion.translation': 'Traducción',
  'dashboard.dashboardRegion.notes': 'Notas',
  'dashboard.dashboardRegion.segments': 'Segmentos',
  'dashboard.dashboardRegion.disabled': 'desactivado',
  'dashboard.dashboardRegion.manualHint':
    'Arrastra en la vista previa para añadir áreas. Usa las esquinas para redimensionar.',
  'dashboard.dashboardRegion.manualModeHint':
    'Modo manual para ajustar cuadros.',
  'dashboard.dashboardRegion.dockHint':
    'Usa el dock flotante del lienzo para seleccionar área, limpiar y editar. Las herramientas se activan según la etapa activa.',
  'dashboard.translator.workspace.ariaLabel': 'Modo traductor',
  'dashboard.translator.sourceTitle': 'Texto de origen',
  'dashboard.translator.sourceDescription':
    'Pega, importa y traduce conservando párrafos y saltos de línea.',
  'dashboard.translator.sourcePlaceholder':
    'Pega el capítulo o fragmento a traducir aquí…',
  'dashboard.translator.sourceAria': 'Texto de origen para traducción',
  'dashboard.translator.import': 'Importar',
  'dashboard.translator.translating': 'Traduciendo…',
  'dashboard.translator.translate': 'Traducir',
  'dashboard.translator.editorCleared': 'Editor limpiado.',
  'dashboard.translator.clear': 'Limpiar',
  'dashboard.translator.resultTitle': 'Resultado',
  'dashboard.translator.resultModelPrefix': 'Modelo: {value}',
  'dashboard.translator.resultPlaceholder': 'Ejecuta para ver el resultado.',
  'dashboard.translator.resultFieldPlaceholder':
    'La traducción aparecerá aquí…',
  'dashboard.translator.resultPlaceholderAria': 'Resultado de la traducción',
  'dashboard.translator.editorDirty':
    'El texto de origen cambió. Re-ejecuta para actualizar.',
  'dashboard.translator.resultCopied': 'Resultado copiado.',
  'dashboard.translator.copy': 'Copiar',
  'dashboard.translator.downloadTxt': 'Descargar TXT',
  'dashboard.translator.modeLabel': 'Traductor',
  'dashboard.translator.workspace.textHint':
    'Traduce texto libre conservando párrafos y saltos de línea.',
  'dashboard.translator.workspace.visualHint':
    'Detecta regiones, OCR y traduce por cuadros en imágenes.',
  'dashboard.translator.processing.standard': 'Estándar',
  'dashboard.translator.processing.aiSfx': 'SFX con IA',
  'dashboard.language.source': 'Idioma de origen',
  'dashboard.language.target': 'Idioma de destino',
  'dashboard.models.title': 'Modelos',
  'dashboard.translator.ocr': 'OCR',
  'dashboard.translator.ocr.manageModels': 'Gestionar modelos de OCR',
  'dashboard.translator.noneAvailable': 'Sin modelos',
  'dashboard.translator.device': 'Dispositivo',
  'dashboard.translator.languages': 'Idiomas',
  'dashboard.translator.multi': 'multi',
  'dashboard.translator.noDescription': 'Sin descripción.',
  'dashboard.translator.localStatus': 'Estado local: {value}',
  'dashboard.translator.sfx.cleanModel': 'Limpiador SFX',
  'dashboard.translator.sfx.hint':
    'Ej.: preferir SFX cortos y pesados, ser más conservador cuando el efecto se mezcla con trazos finos.',
  'dashboard.translator.llm.contextPlaceholder':
    'Contexto: glosario, tono, personajes…',
  'dashboard.translator.llm.generateNotes': 'Generar NT separadas',
  'dashboard.translator.llm.multimodalContext':
    'Imagen como contexto multimodal',
  'dashboard.translator.llm.temperature': 'Temperatura',
  'dashboard.translator.llm.topP': 'Top P',
  'dashboard.translator.llm.maxTokens': 'Tokens máximos',
  'dashboard.translator.execute.title': 'Ejecutar',
  'dashboard.translator.loadImage': 'Cargar',
  'dashboard.translator.detectTranslate': 'Detectar + Traducir',
  'dashboard.translator.retranslateImage': 'Re-traducir imagen',
  'dashboard.translator.retranslateRegion': 'Re-traducir región',
  'dashboard.translator.regionTitle': 'Región',
  'dashboard.translator.blocks': 'Bloques',
  'dashboard.translator.selection': 'Selección',
  'dashboard.translator.translation': 'Traducción',
  'dashboard.translator.notes': 'Notas',
  'dashboard.translator.none': 'ninguno',
  'dashboard.translator.charactersTranslated':
    '{count} carácter(es) traducido(s).',
  'splitter.workspace.emptyTitle': 'Carga una imagen',
  'splitter.workspace.emptyDescription':
    'Usa la barra lateral izquierda para importar páginas. La vista previa muestra los cortes sugeridos y los segmentos generados.',
  'splitter.workspace.previewTitle': 'Vista previa del corte',
  'splitter.workspace.previewDescription':
    'Haz doble clic para añadir un corte. Arrastra las líneas para ajustar.',
  'splitter.workspace.previewAlt': 'Vista previa de {name}',
  'splitter.workspace.cutTitle': 'Corte {index}',
  'splitter.workspace.hide': 'Ocultar',
  'splitter.workspace.show': 'Mostrar',
  'splitter.workspace.recalculate': 'Recalcular',
  'splitter.workspace.diagnostics': 'Diagnósticos',
  'splitter.workspace.engine': 'Motor',
  'splitter.workspace.cuts': 'Cortes',
  'splitter.workspace.segments': 'Segmentos',
  'splitter.workspace.whitespace': 'Espacio en blanco',
  'splitter.workspace.noWarnings': 'Sin advertencias para la imagen activa.',
  'splitter.workspace.cutsTitle': 'Cortes ({count})',
  'splitter.workspace.cutCard': 'Corte #{index}',
  'splitter.workspace.locked': 'Bloqueado',
  'splitter.workspace.unlocked': 'Desbloqueado',
  'splitter.workspace.merge': 'Fusionar',
  'splitter.workspace.segmentsTitle': 'Segmentos ({count})',
  'splitter.workspace.segmentAlt': 'Segmento {index}',
  'splitter.workspace.segmentCard': 'Segmento #{index}',
  'splitter.workspace.analyzing': 'Analizando…',
  'splitter.workspace.dimensions': 'Dimensiones',
  'splitter.workspace.axis': 'Eje',
  'splitter.workspace.strategy': 'Estrategia',
  'splitter.sidebar.title': 'Divisor',
  'splitter.sidebar.recipe': 'Receta',
  'splitter.sidebar.preset': 'Preajuste',
  'splitter.sidebar.mode': 'Modo',
  'splitter.sidebar.direction': 'Dirección',
  'splitter.sidebar.vertical': 'Vertical',
  'splitter.sidebar.horizontal': 'Horizontal',
  'splitter.sidebar.parts': 'Partes',
  'splitter.sidebar.targetHeight': 'Altura objetivo',
  'splitter.sidebar.minimum': 'Mínimo',
  'splitter.sidebar.maximum': 'Máximo',
  'splitter.sidebar.adjustments': 'Ajustes',
  'splitter.sidebar.overlap': 'Superposición ({value}px)',
  'splitter.sidebar.whitespace': 'Espacio en blanco ({value})',
  'splitter.sidebar.noise': 'Ruido ({value})',
  'splitter.sidebar.edgeGuard': 'Protección de bordes ({value}px)',
  'splitter.sidebar.protectTallBlocks': 'Proteger bloques altos',
  'splitter.sidebar.baseName': 'Nombre base',
  'splitter.sidebar.baseNamePlaceholder': 'koma-split',
  'splitter.sidebar.suffix': 'Sufijo',
  'splitter.sidebar.suffixPlaceholder': '{image}-parte-{index}',
  'splitter.sidebar.tokensPrefix': 'Tokens:',
  'splitter.sidebar.tokensAnd': 'y',
  'splitter.sidebar.actions': 'Acciones',
  'splitter.sidebar.imagesCount': '{count} img.',
  'splitter.sidebar.activeImage': 'Activa: {name}',
  'splitter.sidebar.selectImage': 'Selecciona una imagen.',
  'splitter.sidebar.reanalyze': 'Reanalizar',
  'splitter.sidebar.applyToActive': '→ Activa',
  'splitter.sidebar.applyToAll': '→ Todas',
  'splitter.sidebar.clearCuts': 'Borrar cortes',
  'splitter.sidebar.resetRecipe': 'Restablecer receta',
  'splitter.sidebar.exportActive': 'Exportar activa',
  'splitter.sidebar.exportBatch': 'Exportar lote',
  'splitter.sidebar.directoryUnavailable': 'showDirectoryPicker no disponible.',
  'splitter.sidebar.exportToFolder': 'Exportar a carpeta',
  'stitch.workspace.cancelled': 'Renderizado del unidor cancelado.',
  'stitch.workspace.renderingBatch': 'Renderizando lote {current}/{total}...',
  'stitch.workspace.batchReady': 'Lote {current} listo para descargar.',
  'stitch.workspace.generatingZip': 'Generando {count} lote(s) del Unidor...',
  'stitch.workspace.zipReady':
    'Paquete ZIP con {count} lote(s) generado correctamente.',
  'stitch.workspace.savingToFolder': 'Guardando {count} lote(s) en carpeta...',
  'stitch.workspace.folderReady': 'Lotes exportados a la carpeta seleccionada.',
  'stitch.workspace.folderCancelled': 'Exportación a carpeta cancelada.',
  'stitch.workspace.noBatchSelected': 'Ningún lote seleccionado',
  'stitch.workspace.previewEyebrow': 'Vista previa del lote',
  'stitch.workspace.batchTitle': 'Lote {current} de {total}',
  'stitch.workspace.noBatchAvailable': 'No hay lotes disponibles',
  'stitch.workspace.imagesCount': '{count} imagen(es)',
  'stitch.workspace.previousBatch': 'Lote anterior',
  'stitch.workspace.nextBatch': 'Lote siguiente',
  'stitch.workspace.zoomOut': 'Alejar',
  'stitch.workspace.resetZoom': 'Restablecer zoom',
  'stitch.workspace.zoomIn': 'Acercar',
  'stitch.workspace.exporting': 'Exportando…',
  'stitch.workspace.exportBatch': 'Exportar lote',
  'stitch.workspace.zip': 'ZIP',
  'stitch.workspace.folder': 'Carpeta',
  'stitch.workspace.cancel': 'Cancelar',
  'stitch.workspace.emptyTitle': 'Ningún lote listo',
  'stitch.workspace.emptyDescription':
    'Carga imágenes en el Panel y configura los lotes en la caja de herramientas de la barra lateral derecha.',
  'stitch.workspace.generatingPreview': 'Generando vista previa {progress}%',
  'stitch.workspace.previewAlt': 'Vista previa del lote unido',
  'stitch.workspace.errorTitle': 'Error en el Unidor',
  'stitch.workspace.planningEyebrow': 'Planificación',
  'stitch.workspace.planningTitle': '{count} lote(s) planificado(s)',
  'stitch.workspace.planningSubtitle':
    'Revisa los lotes pesados y navega por el plan.',
  'stitch.workspace.baseLabel': 'Base:',
  'stitch.workspace.batchCardTitle': 'Lote {index}',
  'stitch.workspace.batchCardDims': '{count} img · {width}×{height}',
  'stitch.workspace.activeBatch': 'Lote activo',
  'stitch.workspace.stats.images': 'Imágenes',
  'stitch.workspace.stats.output': 'Salida',
  'stitch.workspace.stats.size': 'Tamaño',
  'stitch.workspace.stats.preview': 'Vista previa',
  'stitch.workspace.awaiting': 'En espera',
  'stitch.workspace.toolboxTitle': 'Caja de herramientas',
  'stitch.workspace.toolboxDescription':
    'Los ajustes y las modificaciones de límites están en la barra lateral derecha.',
  'stitch.sidebar.title': 'Unidor',
  'stitch.sidebar.layout': 'Diseño',
  'stitch.sidebar.layoutMode': 'Modo de unión',
  'stitch.sidebar.vertical': 'Vertical',
  'stitch.sidebar.horizontal': 'Horizontal',
  'stitch.sidebar.strategy': 'Estrategia',
  'stitch.sidebar.fixedCount': 'Cantidad fija',
  'stitch.sidebar.targetAxis': 'Objetivo por eje',
  'stitch.sidebar.single': 'Todo en uno',
  'stitch.sidebar.imagesPerBatch': 'Imágenes por lote',
  'stitch.sidebar.spacing': 'Espaciado ({value}px)',
  'stitch.sidebar.alignment': 'Alineación',
  'stitch.sidebar.start': 'Inicio',
  'stitch.sidebar.center': 'Centro',
  'stitch.sidebar.end': 'Final',
  'stitch.sidebar.output': 'Salida',
  'stitch.sidebar.background': 'Fondo',
  'stitch.sidebar.backgroundColor': 'Color de fondo',
  'stitch.sidebar.baseName': 'Nombre base',
  'stitch.sidebar.baseNamePlaceholder': 'koma-stitch',
  'stitch.sidebar.imagesInfo':
    '{count} imagen(es). El orden actual define los lotes.',
  'stitch.sidebar.recalculate': 'Recalcular lotes',
  'stitch.sidebar.boundary': 'Límite',
  'stitch.sidebar.boundaryBatch': 'Lote {current}/{total} · {count} img',
  'stitch.sidebar.noBatch': 'Sin lote',
  'stitch.sidebar.moveLastToNext': 'Última → siguiente',
  'stitch.sidebar.pullFromNext': 'Traer del siguiente',
  'modelManager.filters.catalog': 'Catálogo',
  'modelManager.filters.all': 'Todos',
  'modelManager.filters.local': 'Local',
  'modelManager.filters.cloud': 'Nube',
  'modelManager.filters.language': 'Idioma',
  'modelManager.filters.status': 'Estado',
  'modelManager.filters.installed': 'Instalado',
  'modelManager.filters.notInstalled': 'No instalado',
  'modelManager.filters.updateAvailable': 'Actualización disponible',
  'modelManager.tooltip.speed.fast': 'Rápido',
  'modelManager.tooltip.speed.good': 'Bueno',
  'modelManager.tooltip.speed.excellent': 'Excelente',
  'modelManager.tooltip.allLanguages': 'Todos los idiomas admitidos',
  'modelManager.tooltip.infoAria': 'Información del modelo {name}',
  'modelManager.tooltip.info': 'Info',
  'modelManager.tooltip.aioStage': 'Etapa AIO',
  'modelManager.tooltip.description': 'Descripción',
  'modelManager.tooltip.languages': 'Idiomas',
  'modelManager.tooltip.speed.label': 'Velocidad',
  'modelManager.tooltip.minimum': 'Mínimo',
  'modelManager.tooltip.downloadSize': 'Tamaño de descarga',
  'modelManager.tooltip.diskSpace': 'Espacio en disco',
  'modelManager.tooltip.version': 'Versión',
  'modelManager.status.installed': 'Instalado',
  'modelManager.status.updateAvailable': 'Actualización disponible',
  'modelManager.status.downloading': 'Descargando',
  'modelManager.status.queued': 'En cola',
  'modelManager.status.verifying': 'Verificando',
  'modelManager.status.failed': 'Error',
  'modelManager.status.cancelled': 'Cancelado',
  'modelManager.status.incomplete': 'Incompleto',
  'modelManager.status.notInstalled': 'No instalado',
  'modelManager.actions.selected': 'Seleccionado',
  'modelManager.actions.useModel': 'Usar modelo',
  'modelManager.actions.uninstall': 'Desinstalar',
  'modelManager.actions.update': 'Actualizar',
  'modelManager.actions.retry': 'Reintentar',
  'modelManager.actions.install': 'Instalar',
  'modelManager.actions.source': 'Origen',
  'modelCard.status.selected': 'Seleccionado',
  'modelCard.status.failed': 'Error',
  'modelCard.status.verifying': 'Verificando…',
  'modelCard.status.queued': 'En cola…',
  'modelCard.status.downloading': 'Descargando…',
  'modelCard.status.cancelled': 'Cancelado',
  'modelCard.status.incomplete': 'Incompleto',
  'modelCard.status.notInstalled': 'No instalado',
  'modelCard.action.cancel': 'Cancelar',
  'modelCard.action.remove': 'Eliminar',
  'modelCard.action.update': 'Actualizar',
  'modelCard.action.install': 'Instalar',
  'modelCard.action.retry': 'Reintentar',
  'modelCard.action.active': 'Activo',
  'modelCard.action.use': 'Usar',
  'modelManager.stage.translate': 'Obtener traducciones',
  'modelManager.installAll.attention': 'Atención',
  'modelManager.installAll.warning':
    'Estás a punto de descargar TODOS los modelos de traducción.',
  'modelManager.installAll.totalSize': 'Tamaño total: {size}',
  'modelManager.installAll.space': 'Espacio disponible: {space}',
  'modelManager.installAll.time': 'Tiempo estimado: depende de tu conexión',
  'modelManager.installAll.notEnoughSpace':
    'Espacio insuficiente. Requerido: {required} | Disponible: {available}',
  'modelManager.installAll.confirm':
    'Esto puede tardar mucho tiempo y usar un espacio considerable en disco. ¿Deseas continuar?',
  'modelManager.installAll.confirmDownload': 'Confirmar descarga',
  'modelManager.disk.notVerified': 'Disco no verificado',
  'modelManager.disk.free': '{space} libres',
  'modelManager.disk.models': '{installed}/{total} modelos ({size})',
  'modelManager.enhance.title': 'Modelos de mejora',
  'modelManager.enhance.description':
    'Catálogo local exclusivo para el mejorador. Instala, actualiza, desinstala o importa un ONNX.',
  'modelManager.enhance.freeSpace': 'Espacio libre',
  'modelManager.enhance.notChecked': 'no verificado',
  'modelManager.enhance.closeAria': 'Cerrar modal de modelos de mejora',
  'modelManager.enhance.directInstall': 'Instalación directa',
  'modelManager.enhance.directInstallDesc':
    'Modelos curados con descarga directa o instalación gestionada en el mini-backend.',
  'modelManager.enhance.manualImport': 'Importación manual',
  'modelManager.enhance.manualImportDesc':
    'Modelos listados en el catálogo pero cargados vía ONNX local. Usa conversión externa cuando solo `.pth` esté disponible.',
  'modelManager.enhance.importOnnxBadge': 'Importar ONNX',
  'modelManager.enhance.statusLabel': 'Estado',
  'modelManager.enhance.estimatedDisk': 'Disco estimado',
  'modelManager.enhance.reimportOnnx': 'Reimportar ONNX',
  'modelManager.enhance.pthHint': 'Para pesos en',
  'modelManager.enhance.pthHintSuffix':
    'convierte a ONNX primero y luego usa la importación manual.',
  'common.yes': 'Sí',
  'dashboard.organize.hint.reorder':
    'Arrastra y reordena los archivos en el panel izquierdo.',
  'dashboard.organize.hint.rotate':
    'Usa el botón de rotación para corregir páginas escaneadas horizontalmente.',
  'guides.common.beginner': 'Principiante',
  'guides.common.intermediate': 'Intermedio',
  'guides.common.advanced': 'Avanzado',
  'guides.home.title': 'Guías y tutoriales',
  'guides.home.description':
    'Aprende a dominar cada herramienta de KŌMA Studio con guías paso a paso, consejos de productividad y ejemplos reales.',
  'guides.home.searchPlaceholder': 'Buscar guías, atajos, consejos...',
  'guides.home.searchAria': 'Buscar guías',
  'guides.home.continueReading': 'Continúa donde lo dejaste',
  'guides.home.stepProgress': 'Paso {current} de {total} · {time}',
  'guides.home.continueCta': 'Continuar →',
  'guides.home.categories': 'Categorías',
  'guides.home.guidesCountLabel': 'guía{suffix}',
  'guides.home.completedCountLabel': 'completada{suffix}',
  'guides.home.guidesPluralSuffix': 's',
  'guides.home.saved': 'Guardadas ({count})',
  'guides.reader.backToGuides': 'Volver a Guías',
  'guides.reader.notFound': 'Guía no encontrada',
  'guides.reader.progressAria': 'Progreso de la guía',
  'guides.reader.stepsAria': 'Pasos de la guía',
  'guides.reader.stepLabel': 'Paso {index}',
  'guides.reader.recent': 'Recientes',
  'guides.reader.guides': 'Guías',
  'guides.reader.removeBookmark': 'Quitar marcador',
  'guides.reader.saveBookmark': 'Guardar marcador',
  'guides.reader.previous': 'Anterior',
  'guides.reader.next': 'Siguiente',
  'guides.reader.completeGuide': 'Completar guía',
  'guides.detail.back': 'Volver',
  'guides.detail.notFound': 'Guía no encontrada.',
  'guides.detail.stepsAria': 'Pasos de la guía',
  'guides.detail.stepLabel': 'Paso {index}',
  'guides.detail.recent': 'Recientes',
  'guides.detail.guides': 'Guías',
  'guides.detail.stepCounter': 'Paso {current} de {total}',
  'guides.detail.previous': 'Anterior',
  'guides.detail.next': 'Siguiente',
  'guides.detail.complete': 'Completar',
  'guides.detail.completed': 'Completada ✓',
  'guides.detail.tocAria': 'Tabla de contenidos',
  'guides.detail.inThisGuide': 'En esta guía',
  'guides.detail.removeFavorite': 'Quitar favorito',
  'guides.detail.addFavorite': 'Añadir favorito',
  'guides.detail.saved': 'Guardada',
  'guides.detail.save': 'Guardar',
  'guides.step.copyCode': 'Copiar código',
  'guides.step.copied': 'Copiado',
  'guides.step.copy': 'Copiar',
  'guides.search.dialogAria': 'Buscar guías',
  'guides.search.placeholder': 'Buscar guías, atajos, consejos...',
  'guides.search.inputAria': 'Buscar',
  'guides.search.close': 'Cerrar búsqueda',
  'guides.search.noResults': 'Sin resultados para "{query}"',
  'guides.search.results': 'Resultados ({count})',
  'guides.search.recent': 'Recientes',
  'guides.search.navigate': 'navegar',
  'guides.search.open': 'abrir',
  'guides.search.closeVerb': 'cerrar',
  'guides.category.searchPlaceholder': 'Buscar en {category}...',
  'guides.category.searchAria': 'Buscar en {category}',
  'guides.category.noSearchResults': 'No hay guías para "{query}"',
  'guides.category.noGuides': 'No hay guías en esta categoría',
  'guides.category.tryOtherTerms': 'Prueba con otros términos.',
  'guides.category.comingSoon': 'Se añadirán nuevas guías pronto.',
  'guides.category.completed': 'Completada',
  'settings.profile.title': 'Perfil de usuario',
  'settings.profile.name': 'Nombre',
  'settings.profile.email': 'Correo electrónico',
  'settings.profile.verification': 'Verificación',
  'settings.profile.accountId': 'ID de cuenta',
  'settings.profile.environment': 'Entorno',
  'settings.profile.unspecified': 'No especificado',
  'settings.profile.verified': 'Verificado',
  'settings.profile.pending': 'Pendiente',
  'settings.profile.sendVerification': 'Enviar correo de verificación',
  'settings.profile.legalCenter': 'Centro legal',
  'settings.travel.title': 'Acceso de viaje',
  'settings.travel.description':
    'Autoriza temporalmente un equipo secundario sin cambiar el dispositivo principal vinculado a la cuenta.',
  'settings.travel.destination': 'Destino del token',
  'settings.travel.expiry': 'Expiración del código',
  'settings.travel.temporaryAccess': 'Acceso temporal',
  'settings.travel.streamLike': 'Flujo inspirado en plataformas de streaming',
  'settings.travel.streamLikeDesc':
    'El código se envía al correo de la cuenta y otorga acceso temporal en otro PC.',
  'settings.travel.sendToken': 'Enviar token a mi correo',
  'settings.travel.destinationPrefix': 'Destino: {value}',
  'settings.travel.expirationPrefix': 'Expira: {value}',
  'settings.travel.accessPrefix': 'Acceso: {value}',
  'settings.travel.definedOnSend': 'Definido al enviar',
  'settings.plan.day': 'día',
  'settings.plan.days': 'días',
  'settings.typography.default': 'Predeterminado',
  'settings.typography.bindingsTitle': 'Vinculaciones por modo detectado',
  'settings.typography.useDefault': 'Usar predeterminado',
  'settings.integrations.blogger.description':
    'Almacenamiento/CDN para imágenes y publicación de entradas.',
  'settings.integrations.blogger.label': 'Etiqueta',
  'settings.integrations.blogger.labelPlaceholder': 'Blogger principal',
  'settings.integrations.blogger.blogId': 'ID del blog',
  'settings.integrations.blogger.blogIdPlaceholder': 'ID numérico',
  'settings.integrations.blogger.clientId': 'Client ID',
  'settings.integrations.blogger.clientIdPlaceholder':
    'Client ID de Google OAuth',
  'settings.integrations.blogger.clientSecret': 'Client Secret',
  'settings.integrations.blogger.clientSecretPlaceholder':
    'Client Secret de OAuth',
  'settings.integrations.blogger.refreshToken': 'Refresh Token',
  'settings.integrations.blogger.refreshTokenPlaceholder': 'Refresh Token',
  'settings.integrations.blogger.defaultLabels': 'Etiquetas predeterminadas',
  'settings.integrations.blogger.defaultLabelsPlaceholder':
    'manga, capítulo, lanzamiento',
  'settings.integrations.blogger.optimizer': 'Optimizador',
  'settings.integrations.blogger.optimizerCloudinary': 'Cloudinary Fetch',
  'settings.integrations.blogger.optimizerTemplate': 'Plantilla de URL',
  'settings.integrations.blogger.cloudName': 'Cloud Name',
  'settings.integrations.blogger.urlTemplate': 'Plantilla de URL',
  'settings.integrations.blogger.cloudNamePlaceholder': 'mi-cloud-name',
  'settings.integrations.blogger.cloudinaryTransformation':
    'Transformación de Cloudinary',
  'settings.integrations.blogger.optimizerEnabled': 'Optimizador activo',
  'settings.integrations.blogger.maxWidth': 'Ancho máximo',
  'settings.integrations.blogger.maxHeight': 'Alto máximo',
  'settings.integrations.blogger.testConnection': 'Probar conexión',
  'settings.integrations.blogger.requestsPerDay': 'Solicitudes/día',
  'settings.integrations.blogger.requestsPerUser': 'Solicitudes/usuario',
  'settings.integrations.blogger.credentialsGuideTitle':
    'Cómo obtener las credenciales',
  'settings.integrations.blogger.step1': 'Ve a',
  'settings.integrations.blogger.step1Suffix': 'crea o selecciona un proyecto.',
  'settings.integrations.blogger.step2': 'Habilita la',
  'settings.integrations.blogger.step2And': 'y la',
  'settings.integrations.blogger.step3': 'Crea una',
  'settings.integrations.blogger.webApplication': 'Aplicación web',
  'settings.integrations.blogger.step4': 'Añade',
  'settings.integrations.blogger.step4Suffix': 'a los URIs de redirección.',
  'settings.integrations.blogger.step5': 'Copia',
  'settings.integrations.blogger.step5And': 'y',
  'settings.integrations.blogger.step6':
    'Configura la pantalla de consentimiento OAuth. Si está en Pruebas, añade tu correo.',
  'settings.integrations.blogger.step7': 'En el',
  'settings.integrations.blogger.step7Suffix':
    'habilita tus propias credenciales y autoriza los alcances de Blogger + Drive.',
  'settings.integrations.blogger.step8': 'Realiza',
  'settings.integrations.blogger.step8Suffix': 'y copia el',
  'settings.integrations.blogger.step9': 'Para Cloudinary, copia el',
  'settings.integrations.blogger.step9Suffix': 'y configura la transformación.',
  'settings.integrations.blogger.step10': 'Busca el',
  'settings.integrations.blogger.step10Suffix': 'vía la URL/API de Blogger.',
  'settings.integrations.blogger.step11':
    'Guarda todo, prueba la conexión y usa la utilidad en el panel.',
  'settings.integrations.blogger.googleQuotas': 'Cuotas de Google',
  'settings.integrations.blogger.oauthPlayground': 'OAuth Playground',
  'settings.integrations.blogger.cloudinaryFetch': 'Cloudinary Fetch',
  'settings.integrations.blogger.driveScopes': 'Alcances de Drive',
  'settings.integrations.blogger.driveScopesGuideTitle':
    'Alcances de Drive en OAuth Playground',
  'settings.integrations.blogger.minimumPractical': 'Mínimo práctico:',
  'settings.integrations.blogger.driveScopesNote':
    'Consulta la documentación oficial de la API de Drive v3 para alcances adicionales.',
  'settings.integrations.imgur.title': 'Subida a Imgur',
  'settings.integrations.imgur.description':
    'Subida anónima con rotación de Client ID y limitación de velocidad conservadora.',
  'settings.integrations.imgur.limitPerHour': 'Límite/hora',
  'settings.integrations.imgur.batchDelay': 'Retraso entre lotes (ms)',
  'settings.integrations.imgur.remaining': 'Restante',
  'settings.integrations.imgur.used': 'Usado: {used}/{limit}',
  'settings.integrations.imgur.reset': 'reinicio: {value}',
  'settings.integrations.imgur.clientIds': 'Client IDs',
  'settings.integrations.imgur.noClientIds': 'No hay Client IDs configurados.',
  'settings.integrations.imgur.clientIdPlaceholder': 'Client ID de Imgur',
  'settings.integrations.imgur.quickGuideTitle': 'Guía rápida de Imgur',
  'settings.integrations.imgur.step1':
    'Crea una aplicación en el panel de desarrolladores de Imgur y copia el',
  'settings.integrations.imgur.step2':
    'Añade uno o más Client IDs. La app elige uno al azar.',
  'settings.integrations.imgur.step3': 'Subida anónima con',
  'settings.integrations.imgur.step3Suffix': 'Sin OAuth.',
  'settings.integrations.imgur.step4': 'Limitador conservador:',
  'settings.integrations.imgur.step4Suffix': 'para evitar bloqueos.',
  'settings.integrations.imgur.step5':
    'Subida secuencial respetando el retraso configurado.',
  'settings.integrations.imgur.step6':
    'Imgur no debe tratarse como un CDN garantizado.',
  'settings.integrations.imgur.imageApi': 'API de imágenes de Imgur',
  'settings.integrations.imgur.uploading': 'Subiendo a Imgur',
  'common.add': 'Añadir',
  'common.label': 'Etiqueta',
  'common.original': 'Original',
  'common.quality': 'Calidad',
  'common.persistence': 'Persistencia',
  'common.secureStore': 'Almacenamiento seguro',
  'common.browserFallback': 'Respaldo del navegador',
  'common.notAvailableShort': '—',
  'common.loading': 'Cargando',
  'common.sending': 'Enviando…',
  'common.single': 'Individual',
  'common.tile': 'Mosaico',
  'common.grid': 'Cuadrícula',
  'common.smart': 'Inteligente',
  'common.multi': 'Múltiple',
  'blogger.title': 'CDN de Blogger',
  'blogger.heroTitle': 'Publica y aloja imágenes en Blogger',
  'blogger.heroDescription':
    'Modo publicación para entradas con editor visual/HTML. Modo subida para generar URLs alojadas.',
  'blogger.ready': 'Listo',
  'blogger.configureInSettings': 'Configurar en Ajustes',
  'blogger.publishTab': 'Publicar',
  'blogger.uploadTab': 'Subir',
  'blogger.settings': 'Ajustes',
  'blogger.missingConfigTitle': 'Configuración incompleta',
  'blogger.missingConfigBody':
    'Guarda las credenciales en Ajustes antes de usar.',
  'blogger.post.title': 'Entrada',
  'blogger.post.description': 'Título, etiquetas y publicación.',
  'blogger.post.postTitle': 'Título',
  'blogger.post.postTitlePlaceholder': 'Título de la entrada',
  'blogger.post.defaultLabels': 'Etiquetas predeterminadas',
  'blogger.post.defaultLabelsPlaceholder': 'manga, capítulo',
  'blogger.post.postLabels': 'Etiquetas de la entrada',
  'blogger.post.postLabelsPlaceholder': 'reseña',
  'blogger.post.publishNow': 'Publicar ahora',
  'blogger.post.draft': 'Borrador',
  'blogger.post.publish': 'Publicar',
  'blogger.post.status.draft': 'guardado como borrador',
  'blogger.post.status.published': 'publicado',
  'blogger.template.title': 'Nueva entrada de Blogger',
  'blogger.template.description':
    'Escribe el contenido de la entrada aquí. Puedes alternar entre visual, HTML y vista previa.',
  'blogger.template.insertPrefix': 'Usa el botón',
  'blogger.template.insertSuffix':
    'para subir archivos a Blogger e insertar las URLs alojadas en el contenido.',
  'blogger.editor.title': 'Editor',
  'blogger.editor.description': 'Visual, HTML y vista previa.',
  'blogger.editor.visual': 'Visual',
  'blogger.editor.preview': 'Vista previa',
  'blogger.editor.h1': 'H1',
  'blogger.editor.h2': 'H2',
  'blogger.editor.bold': 'Negrita',
  'blogger.editor.italic': 'Cursiva',
  'blogger.editor.underline': 'Subrayado',
  'blogger.editor.list': 'Lista',
  'blogger.editor.numbered': 'Numerada',
  'blogger.editor.quote': 'Cita',
  'blogger.editor.link': 'Enlace',
  'blogger.editor.promptUrl': 'URL',
  'blogger.editor.insertImages': 'Insertar imágenes',
  'blogger.copied': 'Copiado',
  'blogger.loadConfigFailed': 'Error al cargar la configuración de Blogger.',
  'blogger.imageInsertedSingle':
    'Imagen alojada en Blogger e insertada en el editor.',
  'blogger.imageInsertedMany':
    '{count} imágenes alojadas en Blogger e insertadas en el editor.',
  'blogger.uploadFailed': 'Error al subir imágenes a Blogger.',
  'blogger.batchUploadSingle':
    'Subida completada en una sola entrada borrador de Blogger.',
  'blogger.batchUploadMany':
    '{count} imágenes subidas en una sola entrada borrador de Blogger.',
  'blogger.uploadFailedShort': 'Error en la subida.',
  'blogger.batchUploadSuccessSingle':
    'Subida completada en una sola entrada borrador de Blogger.',
  'blogger.batchUploadSuccessMany':
    '{count} imágenes subidas en una sola entrada borrador de Blogger.',
  'blogger.publishSuccessWithUrl': 'Entrada {verb} en Blogger. URL: {url}',
  'blogger.publishSuccessWithId': 'Entrada {verb} en Blogger con ID {id}.',
  'blogger.publishFailed': 'Error al publicar en Blogger.',
  'blogger.uploadSection.title': 'Subida por lotes',
  'blogger.uploadSection.description':
    'Suelta imágenes para generar URLs alojadas.',
  'blogger.uploadSection.dropTitle': 'Suelta las imágenes aquí',
  'blogger.uploadSection.dropDescription':
    'PNG, JPG, WebP con preprocesamiento local.',
  'blogger.uploadSection.optimizedUrl': 'URL optimizada',
  'blogger.uploadSection.optimizedUrlDesc':
    'Genera una URL optimizada antes de subir.',
  'blogger.uploadSection.exportOptimized': 'Exportar optimizada',
  'blogger.uploadSection.exportOptimizedDesc':
    'Usa la URL optimizada en las acciones por lotes.',
  'blogger.uploadSection.outputImg': 'Salida <img>',
  'blogger.uploadSection.outputImgDesc': 'Fragmentos HTML en lugar de URLs.',
  'blogger.uploadSection.select': 'Seleccionar',
  'blogger.uploadSection.send': 'Enviar',
  'blogger.uploadSection.exported': 'Exportado',
  'blogger.queue.title': 'Cola',
  'blogger.queue.items': '{count} elemento(s)',
  'blogger.queue.empty': 'Sin archivos.',
  'blogger.queue.altText': 'Texto alternativo',
  'blogger.queue.canonical': 'Canónica',
  'blogger.queue.optimized': 'Optimizada',
  'blogger.queue.url': 'URL',
  'blogger.queue.opt': 'Opt',
  'blogger.queue.img': 'img',
  'common.remove': 'Eliminar',
  'ranking.backToDashboard': 'Volver al panel',
  'ranking.hero.title': 'Ranking de modelos',
  'ranking.hero.subtitle':
    'Compara modelos oficiales con reseñas reales de la comunidad: calidad, velocidad, relación calidad-precio y facilidad de uso.',
  'ranking.hero.globalStatsAria': 'Estadísticas globales',
  'ranking.hero.models': 'Modelos',
  'ranking.hero.reviews': 'Reseñas',
  'ranking.hero.bestOverall': 'Mejor general',
  'ranking.hero.costBenefit': 'Mejor relación calidad-precio',
  'ranking.loading': 'Actualizando ranking…',
  'legalHub.back': 'Volver',
  'legalHub.sidebarTitle': 'Centro legal',
  'legalHub.supportDescription':
    'Las solicitudes de soporte, privacidad y derechos de datos deben usar el canal oficial indicado en la aplicación/sitio web.',
  'legalHub.supportCta': 'Abrir canal de soporte',
  'legalHub.noticeTitle': 'Aviso importante.',
  'dashboard.dashboardExecute.selectImage':
    'Selecciona una imagen para ejecutar.',
  'dashboard.dashboardExecute.runCurrentStage':
    'Ejecutar la etapa actual para la imagen.',
  'dashboard.dashboardExecute.rerunStage': 'Re-ejecutar etapa',
  'dashboard.dashboardExecute.runStage': 'Ejecutar etapa',
  'dashboard.dashboardExecute.runAio': 'Ejecutar AIO',
  'dashboard.dashboardExecute.stop': 'Detener ejecución',
  'freeProviderCard.stage.translation': 'Traducción',
  'freeProviderCard.stage.ocr': 'OCR',
  'freeProviderCard.stage.clean': 'Limpieza',
  'freeProviderCard.badge.integrated': 'Integrado',
  'freeProviderCard.badge.catalog': 'Catálogo',
  'freeProviderCard.verifiedAt': 'verificado el',
  'freeProviderCard.tooltip.selectedModel': 'Modelo seleccionado',
  'freeProviderCard.tooltip.notSelected': '(no seleccionado)',
  'freeProviderCard.tooltip.notDefined': '(no definido)',
  'freeProviderCard.tooltip.apiKeyConfigured': 'Configurada',
  'freeProviderCard.tooltip.apiKeyRequired': 'Requerida (pendiente)',
  'freeProviderCard.tooltip.apiKeyOptional': 'Opcional (vacía)',
  'freeProviderCard.tooltip.extraFields': 'Campos adicionales',
  'freeProviderCard.tooltip.modelsInStage': 'Modelos en esta etapa',
  'freeProviderCard.tooltip.empty': '(vacío)',
  'freeProviderCard.label.model': 'Modelo',
  'freeProviderCard.label.apiBase': 'Base de API',
  'freeProviderCard.label.apiKey': 'Clave de API',
  'freeProviderCard.label.required': '(requerida)',
  'freeProviderCard.label.optional': '(opcional)',
  'freeProviderCard.placeholder.apiKey': 'Pega tu clave aquí',
  'freeProviderCard.status.activeProfile': 'Perfil activo:',
  'freeProviderCard.status.catalogOnlyWarning':
    'Este proveedor es solo catálogo en v1.',
  'freeProviderCard.action.save': 'Guardar',
  'freeProviderCard.action.use': 'Usar',
  'customProvider.field.name': 'Nombre',
  'customProvider.field.model': 'Modelo',
  'customProvider.field.apiBase': 'Base de API',
  'customProvider.field.apiKey': 'Clave de API',
  'customProvider.placeholder.noKey': '(sin clave)',
  'customProvider.placeholder.pasteKey': 'Pega tu clave aquí',
  'customProvider.status.active': 'Perfil activo en el pipeline',
  'customProvider.action.cancel': 'Cancelar',
  'customProvider.action.saving': 'Guardando...',
  'customProvider.action.save': 'Guardar',
  'customProvider.action.edit': 'Editar',
  'customProvider.action.delete': 'Eliminar',
  'customProvider.badge.customProfile': 'Perfil personalizado',
  'freeProviderCard.status.integrated': 'Integrado',
  'freeProviderCard.status.catalog': 'Catálogo',
  'freeProviderCard.status.verifiedAt': 'verificado el',
  'freeProviderCard.info.label': 'Info',
  'freeProviderCard.info.tooltip': 'Info de {name}',
  'freeProviderCard.info.selectedModel': 'Modelo seleccionado:',
  'freeProviderCard.info.notSelected': '(no seleccionado)',
  'freeProviderCard.info.modelId': 'ID del modelo:',
  'freeProviderCard.info.notDefined': '(no definido)',
  'freeProviderCard.info.apiBase': 'Base de API:',
  'freeProviderCard.info.apiKey': 'Clave de API:',
  'freeProviderCard.info.configured': 'Configurada',
  'freeProviderCard.info.required': 'Requerida (pendiente)',
  'freeProviderCard.info.optional': 'Opcional (vacía)',
  'freeProviderCard.info.extraFields': 'Campos adicionales:',
  'freeProviderCard.info.setup': 'Configuración:',
  'freeProviderCard.info.limits': 'Límites:',
  'freeProviderCard.info.rateLimits': 'Límites de velocidad:',
  'freeProviderCard.info.modelsInStage': 'Modelos en esta etapa:',
  'freeProviderCard.field.model': 'Modelo',
  'freeProviderCard.field.apiBase': 'Base de API',
  'freeProviderCard.field.apiBaseTitle':
    'Base de API fija para este proveedor en v1',
  'freeProviderCard.field.required': '(requerida)',
  'freeProviderCard.field.optional': '(opcional)',
  'freeProviderCard.field.apiKeyPlaceholder': 'Pega tu clave aquí',
  'freeProviderCard.status.catalogOnly':
    'Este proveedor es solo catálogo en v1.',
  'freeProviderCard.actions.save': 'Guardar',
  'freeProviderCard.actions.use': 'Usar',
  'freeProviderCard.empty': '(vacío)',
  'customProvider.action.use': 'Usar',
  'typo.tag': 'Tipógrafo',
  'typo.session.title': 'Sesión',
  'typo.session.image': 'Imagen:',
  'typo.session.selection': 'Selección:',
  'typo.session.none': 'ninguna',
  'typo.tools.aria': 'Herramientas de forma',
  'typo.tools.select': 'Seleccionar',
  'typo.tools.rect': 'Rectangular',
  'typo.tools.ellipse': 'Elíptico',
  'typo.actions.refine': 'Refinar',
  'typo.actions.toRect': '→ Rectangular',
  'typo.actions.toEllipse': '→ Elíptico',
  'typo.actions.duplicate': 'Duplicar',
  'typo.actions.delete': 'Eliminar selección',
  'typo.presets.title': 'Preajustes',
  'typo.presets.active': 'Preajuste activo',
  'typo.presets.none': 'Sin preajuste',
  'typo.presets.applySelection': '→ Selección',
  'typo.presets.applyImage': '→ Imagen',
  'typo.snapshots.title': 'Instantáneas',
  'typo.snapshots.hint': 'Guarda el estado actual para restaurarlo después.',
  'typo.snapshots.placeholder': 'Nombre de la instantánea',
  'typo.snapshots.save': 'Guardar instantánea',
  'typo.snapshots.select': 'Seleccionar…',
  'typo.snapshots.restore': 'Restaurar',
  'typo.queue.title': 'Cola de texto',
  'typo.queue.editorPlaceholder': 'Pega las líneas, una por globo…',
  'typo.queue.editorAria': 'Editor de texto de la cola',
  'typo.queue.build': 'Crear cola',
  'typo.queue.import': 'Importar',
  'typo.queue.applySelected': 'Aplicar elemento',
  'typo.queue.next': 'Siguiente',
  'typo.queue.clear': 'Limpiar',
  'typo.queue.multiBubble': 'Multi-globo',
  'typo.queue.listAria': 'Cola tipográfica',
  'typo.queue.emptyTitle': 'La cola está vacía',
  'typo.queue.emptyDesc': 'Una línea por globo para crear la secuencia.',
  'typo.queue.statusApplied': 'Aplicado',
  'typo.queue.statusSkipped': 'Omitido',
  'typo.queue.statusPending': 'Pendiente',
  'modelDetail.empty':
    'Selecciona un modelo en la clasificación para ver detalles y reseñas.',
  'modelDetail.source.local': 'Local',
  'modelDetail.source.cloud': 'Nube',
  'modelDetail.score.aria': 'Puntuación general: {score}',
  'modelDetail.score.label': 'Puntuación',
  'modelDetail.reviews.count_one': '{count} reseña',
  'modelDetail.reviews.count_other': '{count} reseñas',
  'modelDetail.trend.up': '+{trend} pts (30d)',
  'modelDetail.trend.down': '{trend} pts (30d)',
  'modelDetail.trend.neutral': 'Tendencia neutral',
  'modelDetail.metrics.quality': 'Calidad',
  'modelDetail.metrics.speed': 'Velocidad',
  'modelDetail.metrics.costBenefit': 'Relación calidad-precio',
  'modelDetail.metrics.easeOfUse': 'Facilidad de uso',
  'modelDetail.distro.title': 'Distribución de puntuaciones',
  'modelDetail.distro.lastReview': 'Última reseña: {date}',
  'modelDetail.info.title': 'Contexto técnico',
  'modelDetail.info.noNotes':
    'Sin notas adicionales registradas para este modelo.',
  'modelDetail.info.source': 'Origen',
  'modelDetail.info.target': 'Destino',
  'modelDetail.actions.editReview': 'Editar reseña',
  'modelDetail.actions.startReview': 'Reseñar modelo',
  'modelDetail.actions.sending': 'Enviando…',
  'modelDetail.actions.verifyEmail': 'Verificar correo',
  'modelDetail.warning.verifyEmail':
    'Confirma tu correo para publicar o editar reseñas.',
  'modelDetail.recentReviews.title': 'Reseñas recientes',
  'modelDetail.recentReviews.loading': 'Cargando…',
  'modelDetail.recentReviews.empty':
    'Este modelo aún no ha recibido reseñas públicas.',
  'modelDetail.pagination.prev': 'Anterior',
  'modelDetail.pagination.next': 'Siguiente',
  'modelDetail.usage.balanced': 'Equilibrado',
  'modelDetail.usage.quality_first': 'Calidad',
  'modelDetail.usage.speed_first': 'Velocidad',
  'modelDetail.usage.low_vram': 'VRAM baja',
  'modelDetail.usage.offline_local': 'Local',
  'modelDetail.usage.cloud_pipeline': 'Nube',
  'resources.empty.title.withQuery': 'Sin resultados para "{query}"',
  'resources.empty.title.noQuery': 'No se encontraron elementos',
  'resources.empty.desc.withQuery':
    'Prueba con otras palabras o limpia los filtros para encontrar {context}.',
  'resources.empty.desc.noQuery':
    'Ajusta los filtros para ver {context} disponibles.',
  'resources.fonts.license.free': 'Gratis',
  'resources.fonts.license.openSource': 'Código abierto',
  'resources.fonts.license.commercial': 'Comercial',
  'resources.fonts.license.mixed': 'Mixta',
  'resources.fonts.context': 'fuentes',
  'resources.fonts.placeholder':
    'Escribe un texto para previsualizar en las fuentes...',
  'resources.fonts.results_one': 'fuente encontrada',
  'resources.fonts.results_other': 'fuentes encontradas',
  'resources.fonts.previewFallback': '¡No puedo creerlo!',
  'resources.fonts.sizeAria': 'Vista previa a {size}px',
  'resources.sfx.category.impact': 'Impacto',
  'resources.sfx.category.emotion': 'Emoción',
  'resources.sfx.category.ambient': 'Ambiente',
  'resources.sfx.category.action': 'Acción',
  'resources.sfx.category.voice': 'Voz',
  'resources.sfx.category.misc': 'Varios',
  'resources.sfx.filterAria': 'Filtrar por categoría',
  'resources.sfx.filterAll': 'Todos ({count})',
  'resources.sfx.results_one': 'efecto de sonido',
  'resources.sfx.results_other': 'efectos de sonido',
  'resources.sfx.context': 'efectos de sonido',
  'resources.sfx.copyAria': 'Copiar "{text}"',
  'resources.communities.platform.forum': 'Foro',
  'resources.communities.results_one': 'comunidad',
  'resources.communities.results_other': 'comunidades',
  'resources.communities.context': 'comunidades',
  'resources.communities.visitAria': 'Visitar {name} en un navegador externo',
  'resources.communities.visit': 'Visitar',
  'resources.tools.category.editing': 'Edición',
  'resources.tools.category.ocr': 'OCR',
  'resources.tools.category.translation': 'Traducción',
  'resources.tools.category.fonts': 'Fuentes',
  'resources.tools.category.hosting': 'Alojamiento',
  'resources.tools.category.utility': 'Utilidades',
  'resources.tools.filterAll': 'Todos',
  'resources.tools.results_one': 'herramienta',
  'resources.tools.results_other': 'herramientas',
  'resources.tools.context': 'herramientas',
  'resources.tools.free.yes': 'Gratis',
  'resources.tools.free.no': 'De pago',
  'resources.tools.action.open': 'Abrir',
  'resources.tools.action.download': 'Descargar',
  'feed.roles.raw': 'Proveedor de raws',
  'feed.roles.cl': 'Limpiador',
  'feed.roles.rd': 'Redibujador',
  'feed.roles.tl': 'Traductor',
  'feed.roles.pr': 'Corrector',
  'feed.roles.ts': 'Tipógrafo',
  'feed.roles.qc': 'Control de calidad',
  'feed.contact.discord': 'Discord',
  'feed.contact.twitter_x': 'Twitter/X',
  'feed.contact.telegram': 'Telegram',
  'feed.contact.email': 'Correo electrónico',
  'feed.contact.whatsapp': 'WhatsApp',
  'feed.contact.instagram': 'Instagram',
  'feed.contact.placeholder.discord':
    'https://discord.gg/... o nombre de usuario',
  'feed.contact.placeholder.twitter_x':
    'nombre de usuario o https://x.com/usuario',
  'feed.contact.placeholder.telegram': 'https://t.me/... o @canal',
  'feed.contact.placeholder.email': 'contacto@scanlation.com',
  'feed.contact.placeholder.whatsapp': '+1 555 123-4567 o enlace',
  'feed.contact.placeholder.instagram':
    'nombre de usuario o https://instagram.com/usuario',
  'feed.weekdays.seg': 'Lun',
  'feed.weekdays.ter': 'Mar',
  'feed.weekdays.qua': 'Mié',
  'feed.weekdays.qui': 'Jue',
  'feed.weekdays.sex': 'Vie',
  'feed.weekdays.sab': 'Sáb',
  'feed.weekdays.dom': 'Dom',
  'feed.report.reasons.malicious_link': 'Enlace malicioso',
  'feed.report.reasons.spam': 'Spam',
  'feed.report.reasons.impersonation': 'Suplantación de identidad',
  'feed.report.reasons.harassment': 'Acoso / abuso',
  'feed.report.reasons.copyright': 'Violación de derechos de autor',
  'feed.report.reasons.other': 'Otro',
  'feed.modal.closeAria': 'Cerrar modal',
  'feed.feedback.newApplication':
    'Nueva solicitud recibida en el Feed de Scanlation.',
  'feed.error.loadFailed': 'Error al cargar el Feed de Scanlation.',
  'feed.hero.back': 'Volver al panel',
  'feed.hero.title': 'Reclutamiento, Escaparate y Moderación',
  'feed.hero.subtitle':
    'Publica ofertas, muestra trabajos, recibe solicitudes y reporta contenido sospechoso.',
  'feed.tab.recruitment': 'Reclutamiento',
  'feed.tab.showcase': 'Escaparate',
  'feed.tab.moderation': 'Moderación',
  'feed.actions.createPost': 'Crear {type}',
  'feed.alert.safety':
    'Usa solo redes sociales y contactos legítimos. Las publicaciones sospechosas pueden ser reportadas.',
  'feed.alert.banPolicy':
    'Las publicaciones maliciosas pueden resultar en una prohibición permanente por cuenta, dispositivo y red.',
  'feed.card.recruitmentRecent': 'Reclutamientos recientes',
  'feed.card.showcaseRecent': 'Escaparates recientes',
  'feed.card.moderationQueue': 'Cola de moderación',
  'feed.loading': 'Cargando feed…',
  'feed.empty.noRecruitment':
    'No se encontraron publicaciones de reclutamiento',
  'feed.empty.noShowcase': 'No se encontraron escaparates',
  'feed.empty.cleanQueue': 'La cola está limpia',
  'feed.empty.beFirst': '¡Sé el primero en publicar {type}!',
  'feed.empty.noModPosts': 'No hay publicaciones en la cola de moderación.',
  'feed.post.recruitLabel': 'Reclutamiento',
  'feed.post.showcaseLabel': 'Escaparate',
  'feed.post.rolePayNegotiable': 'A negociar',
  'feed.post.rolePayVolunteer': 'Voluntario',
  'feed.post.actions.apply': 'Postularse',
  'feed.post.actions.report': 'Reportar',
  'feed.post.actions.show': 'Mostrar',
  'feed.post.actions.hide': 'Ocultar',
  'feed.post.actions.ban': 'Prohibir',
  'feed.sidebar.profileTitle': 'Perfil del autor',
  'feed.sidebar.rulesLabel':
    'Acepto las reglas del feed. Los enlaces maliciosos resultan en una prohibición permanente.',
  'feed.sidebar.webhookLabel': 'Notificaciones por webhook de Discord',
  'feed.sidebar.saveProfile': 'Guardar perfil',
  'feed.sidebar.inboxTitle': 'Bandeja de entrada interna',
  'feed.sidebar.yourApplications': 'Tus solicitudes',
  'feed.sidebar.noApplications': 'No se han enviado solicitudes.',
  'feed.sidebar.receivedTitle': 'Recibidas',
  'feed.sidebar.noReceived': 'No se han recibido solicitudes.',
  'feed.sidebar.reportsTitle': 'Reportes',
  'feed.sidebar.noReports': 'No hay reportes pendientes.',
  'feed.sidebar.banTitle': 'Prohibición',
  'feed.sidebar.applyBan': 'Aplicar prohibición',
  'feed.feedback.postPublishedRecruit': 'Reclutamiento publicado.',
  'feed.feedback.postPublishedShowcase': 'Escaparate publicado.',
  'feed.feedback.reportSent': 'Reporte enviado a moderación.',
  'feed.feedback.profileUpdated': 'Perfil del feed actualizado.',
  'feed.feedback.applicationSent': 'Solicitud enviada.',
  'feed.feedback.banApplied': 'Prohibición aplicada y sesiones revocadas.',
  'feed.feedback.reportUpdated': 'Reporte actualizado.',
  'feed.feedback.postStatusUpdated': 'Publicación actualizada a {status}.',
  'feed.moderation.notes.resolved': 'Revisado por moderación.',
  'feed.moderation.notes.dismissed': 'Desestimado por moderación.',
  'feed.moderation.banReasonPost': 'Publicación moderada: {title}',
  'feed.moderation.targetUserId': 'ID de usuario objetivo',
  'feed.moderation.applyBan': 'Aplicar prohibición',
  'feed.error.roleDuplicate': 'Ya añadiste {role}.',
  'feed.error.valuePositive': 'El valor debe ser positivo.',
  'feed.error.platformDuplicate': 'Ya se añadió {platform}.',
  'feed.error.platformRequired': 'Proporciona {platform}.',
  'feed.error.saveProfileFailed': 'Error al guardar el perfil.',
  'feed.error.publishFailed': 'Error al publicar.',
  'feed.error.applyFailed': 'Error al postularse.',
  'feed.error.reportFailed': 'Error al reportar.',
  'feed.error.moderatePostFailed': 'Error al moderar la publicación.',
  'feed.error.moderateReportFailed': 'Error al actualizar el reporte.',
  'feed.error.banFailed': 'Error al aplicar la prohibición.',
  'feed.composer.typeRecruit': 'reclutamiento',
  'feed.composer.typeShowcase': 'escaparate',
  'feed.composer.placeholder.titleRecruit': 'Ej.: Buscando traductores',
  'feed.composer.placeholder.titleShowcase': 'Ej.: Nuevo capítulo disponible',
  'feed.composer.placeholder.bodyRecruit':
    'Explica el proyecto y cómo puede ayudar el candidato...',
  'feed.composer.placeholder.bodyShowcase':
    'Describe el lanzamiento e información relevante...',
  'feed.composer.placeholder.scanlationName': 'Nombre del grupo de scanlation',
  'feed.composer.placeholder.workTitle': 'Título de la obra',
  'feed.composer.placeholder.chapterLabel': 'Cap. 42',
  'feed.composer.placeholder.genres': 'Acción, Romance, Fantasía',
  'feed.composer.placeholder.description': 'Describe este lanzamiento...',
  'feed.composer.sections.project': 'Proyecto',
  'feed.composer.sections.work': 'Obra',
  'feed.composer.sections.recruitmentSettings': 'Ajustes de reclutamiento',
  'feed.composer.toggle.recruiting': 'Reclutando',
  'feed.composer.toggle.recruitingDesc': '¿Tu grupo acepta nuevos miembros?',
  'feed.composer.toggle.paidWork': 'Trabajo remunerado',
  'feed.composer.toggle.paidWorkDesc': '¿Los miembros recibirán pago?',
  'feed.composer.requirements.label': 'Requisitos para candidatos:',
  'feed.composer.requirements.portfolio': 'Portafolio',
  'feed.composer.requirements.experience': 'Experiencia',
  'feed.composer.requirements.availability': 'Disponibilidad',
  'feed.composer.requirements.contact': 'Contacto',
  'feed.composer.availability.minRequired': 'Disponibilidad mínima requerida:',
  'feed.composer.availability.hoursPerWeek': 'Horas por semana',
  'feed.composer.availability.daysOptional': 'Días (opcional)',
  'feed.composer.availability.descriptionOptional': 'Descripción (opcional)',
  'feed.composer.availability.placeholder':
    'Necesito a alguien que entregue capítulos cada semana...',
  'feed.composer.sections.roles': 'Roles',
  'feed.composer.sections.rolesSub': '(añade los que estés buscando)',
  'feed.composer.roles.roleLabel': 'Rol',
  'feed.composer.roles.valueLabel': 'Valor ($)',
  'feed.composer.roles.valueHint': '(por capítulo)',
  'feed.composer.roles.add': 'Añadir',
  'feed.composer.roles.allAdded': 'Todos los roles añadidos',
  'feed.composer.roles.addBtn': 'Añadir rol',
  'feed.composer.social.title': 'Redes sociales',
  'feed.composer.social.sub': '(al menos una)',
  'feed.composer.social.platform': 'Plataforma',
  'feed.composer.social.user': 'Usuario',
  'feed.composer.social.url': 'URL/Enlace',
  'feed.composer.social.allAdded': 'Todas las plataformas añadidas',
  'feed.composer.social.addBtn': 'Añadir red social',
  'feed.composer.sections.media': 'Multimedia',
  'feed.composer.media.uploading': 'Enviando...',
  'feed.composer.media.uploadBtn': 'Subir vía Imgur',
  'feed.apply.title': 'Enviar solicitud',
  'feed.apply.message': 'Mensaje',
  'feed.apply.messagePlaceholder': 'Preséntate y di por qué quieres unirte...',
  'feed.apply.preferredContact': 'Contacto preferido',
  'feed.apply.portfolio': 'Portafolio / enlaces',
  'feed.apply.portfolioPlaceholder': 'Un enlace por línea...',
  'feed.report.title': 'Reportar publicación',
  'feed.report.reason': 'Motivo',
  'feed.report.details': 'Detalles',
  'feed.report.detailsPlaceholder': 'Describe el problema...',
  'feed.report.send': 'Enviar reporte',
  'freeProvider.manager.titleTranslation': 'Proveedores FREE (Traducción)',
  'freeProvider.manager.titleOcr': 'Proveedores FREE (OCR)',
  'auth.password.hide': 'Ocultar contraseña',
  'auth.password.show': 'Mostrar contraseña',
  'modelManager.stage.cleanImage': 'Limpiar imagen',
  'modelManager.stage.detectText': 'Detectar texto',
  'modelManager.stage.recognizeText': 'Reconocer texto',
  'modelManager.stage.segmentText': 'Segmentar texto',
  'fillStylePopover.gradient': 'Degradado',
  'fillStylePopover.hint.gradient': 'Sólido o degradado en el mismo selector.',
  'fillStylePopover.hint.solid': 'Selecciona un color sólido.',
  'klSlider.resetValue': 'Restablecer valor',
  'dashboard.aio.translation.llm.temperature': 'Temperatura',
  'dashboard.aio.translation.llm.topP': 'Top P',
  'dashboard.aio.translation.llm.maxTokens': 'Tokens máximos',
  'dashboard.enhance.modeTag': 'Mejorar',
  'dashboard.enhance.scale.2x': '2×',
  'dashboard.enhance.scale.4x': '4×',
  'optimizer.hero.title': 'Optimizador de capítulos',
  'optimizer.hero.desc':
    'Optimiza las páginas finales para web, lectura o archivo.',
  'optimizer.hero.pages': 'Páginas',
  'optimizer.hero.savings': 'Ahorro',
  'optimizer.hero.saved': 'Guardado',
  'optimizer.hero.output': 'Salida',
  'optimizer.panel.presets': 'Preajustes',
  'optimizer.panel.output': 'Salida',
  'optimizer.panel.dimensions': 'Dimensiones',
  'optimizer.panel.filters': 'Filtros',
  'optimizer.panel.preview': 'Vista previa',
  'optimizer.presets.webLight': 'Web ligera',
  'optimizer.presets.webLight.desc': 'Ligero para carga rápida',
  'optimizer.presets.reading': 'Lectura',
  'optimizer.presets.reading.desc': 'Calidad equilibrada para lectores',
  'optimizer.presets.archive': 'Archivo',
  'optimizer.presets.archive.desc': 'Sin pérdida para preservación',
  'optimizer.presets.social': 'Social',
  'optimizer.presets.social.desc': 'Optimizado para redes sociales',
  'optimizer.presets.custom': 'Personalizado',
  'optimizer.presets.custom.desc': 'Tu propia configuración',
  'optimizer.config.format': 'Formato',
  'optimizer.config.quality': 'Calidad',
  'optimizer.config.resize': 'Redimensionar',
  'optimizer.config.trimBorders': 'Recortar bordes',
  'optimizer.config.trimTolerance': 'Tolerancia de recorte',
  'optimizer.config.maxWidth': 'Ancho máximo',
  'optimizer.config.maxHeight': 'Alto máximo',
  'optimizer.config.sharpen': 'Nitidez',
  'optimizer.config.sharpenStrength': 'Intensidad de nitidez',
  'optimizer.config.grayscale': 'Escala de grises',
  'optimizer.config.autoLevels': 'Niveles automáticos',
  'optimizer.action.optimizing': 'Optimizando...',
  'optimizer.action.folder': 'Carpeta',
  'optimizer.preview.generating': 'Generando vista previa...',
  'optimizer.preview.before': 'Antes',
  'optimizer.preview.after': 'Después',
  'optimizer.preview.reduction': 'Reducción',
  'optimizer.preview.dimensions': 'Dimensiones',
  'optimizer.preview.compare': 'Comparar',
  'optimizer.preview.original': 'Original',
  'optimizer.preview.optimized': 'Optimizado',
  'optimizer.preview.empty': 'Carga imágenes para usar el optimizador.',
  'optimizer.results.title': 'Resultados',
  'optimizer.results.empty': 'Ejecuta la optimización para ver los resultados.',
  'optimizer.results.download': 'Descargar archivo',
  'optimizer.error.worker':
    'Worker no disponible en el Optimizador de capítulos.',
  'optimizer.error.failed': 'El Optimizador de capítulos falló.',
  'optimizer.error.preview': 'La vista previa del optimizador falló.',
  'optimizer.config.brightness': 'Brillo',
  'optimizer.config.contrast': 'Contraste',
  'optimizer.config.noiseReduction': 'Reducción de ruido',
  'optimizer.config.noiseReductionStrength': 'Intensidad de reducción de ruido',
  'optimizer.config.rotation': 'Rotación',
  'optimizer.config.rotationNone': 'Ninguna',
  'optimizer.config.renamePattern': 'Patrón de renombrado',
  'optimizer.config.renameHint':
    'Usa {name} para el nombre original, {index} para un número con ceros, {ext} para la extensión.',
  'optimizer.panel.advanced': 'Avanzado',
  'optimizer.export.folderSuccess':
    'El Optimizador de capítulos exportó los archivos a la carpeta seleccionada.',
  'optimizer.export.zipSuccess':
    'Paquete del Optimizador de capítulos generado correctamente.',
  'resources.communities.platform.discord': 'Discord',
  'resources.communities.platform.reddit': 'Reddit',
  'resources.communities.platform.website': 'Sitio web',
  'resources.communities.platform.telegram': 'Telegram',
  'dashboard.cleaner.modeTag': 'Limpiador',
  'stitch.error.loadImage': 'Error al cargar la imagen.',
  'stitch.error.initCanvas': 'Error al inicializar el canvas del Unidor.',
  'stitch.error.initTempCanvas':
    'Error al preparar la imagen intermedia del Unidor.',
  'stitch.error.generateBlob': 'Error al generar el blob del Unidor.',
  'stitch.error.cancelled': 'Renderizado cancelado.',
  'stitch.error.workerFailed': 'Error al ejecutar el worker del Unidor.',
  'stitch.error.generatePreview':
    'Error al generar la vista previa del Unidor.',
  'stitch.error.exportBatch': 'Error al exportar el lote del Unidor.',
  'stitch.error.generateZip': 'Error al generar el ZIP del Unidor.',
  'stitch.error.saveFolder': 'Error al guardar los lotes en la carpeta.',
  'dashboard.footer.runtime.fallback.label': 'Fallback',
  'watermark.blend.normal': 'Normal',
  'watermark.blend.multiply': 'Multiplicar',
  'watermark.blend.screen': 'Pantalla',
  'watermark.blend.overlay': 'Superponer',
  'watermark.blend.softLight': 'Luz suave',
  'watermark.blend.hardLight': 'Luz fuerte',
  'watermark.blend.colorDodge': 'Sobreexponer color',
  'watermark.blend.colorBurn': 'Subexponer color',
  'watermark.panel.shadow': 'Capa de sombra',
  'watermark.shadow.enable': 'Activar sombra de fondo',
  'watermark.shadow.blur': 'Desenfoque',
  'watermark.shadow.opacity': 'Opacidad',
  'watermark.shadow.color': 'Color',
  'watermark.shadow.offsetY': 'Desplazamiento Y',
  'watermark.panel.textAvoidance': 'Evasión de texto',
  'watermark.textAvoidance.enable': 'Evitar regiones de texto',
  'watermark.textAvoidance.desc':
    'Usa detección de texto con IA para evitar que las marcas de agua se superpongan al texto en las imágenes.',
  'watermark.textAvoidance.detecting': 'Detectando...',
  'watermark.textAvoidance.detectCurrent': 'Detectar actual',
  'watermark.textAvoidance.detectAll': 'Detectar todas',
  'watermark.textAvoidance.detected': '{{count}} regiones de texto detectadas.',
  'watermark.textAvoidance.detectedAll':
    '{{count}} regiones de texto detectadas en todas las imágenes.',
  'watermark.textAvoidance.failed': 'La detección de texto falló.',
  'watermark.textAvoidance.zonesFound': 'zonas',
  'watermark.textAvoidance.showOverlay': 'Mostrar zonas',
  'watermark.text.shadowBlur': 'Desenfoque de sombra',
  'watermark.text.shadowColor': 'Color de sombra',
  'watermark.distribution.offsetX': 'Desplazamiento X',
  'watermark.distribution.offsetY': 'Desplazamiento Y',
  'watermark.distribution.density': 'Densidad',
  'dashboard.dock.tooltip.hoverHint':
    'Mantén el cursor para ver la vista previa',
  'dashboard.dock.config.ariaLabel': 'Configuración de la herramienta activa',
  'dashboard.dock.config.closeTitle': 'Cerrar configuración',
  'dashboard.dock.config.closeAriaLabel': 'Cerrar configuración de herramienta',
  'dashboard.dock.areaSelection.sectionTitle': 'Selección de área',
  'dashboard.dock.areaSelection.shapeLabel': 'Forma de nueva selección',
  'dashboard.dock.areaSelection.optionAuto': 'Auto',
  'dashboard.dock.areaSelection.optionSquare': 'Rectangular',
  'dashboard.dock.areaSelection.optionRounded': 'Elíptico',
  'dashboard.dock.areaSelection.hintAuto': 'Auto detecta: {kind}.',
  'dashboard.dock.areaSelection.hintFixed':
    'Nuevas regiones creadas como {mode}.',
  'dashboard.dock.areaSelection.btnDuplicate': 'Duplicar',
  'dashboard.dock.areaSelection.btnToAuto': '→ Auto',
  'dashboard.dock.areaSelection.btnToSquare': '→ Rectangular',
  'dashboard.dock.areaSelection.btnToRounded': '→ Elíptico',
  'dashboard.dock.segment.brushTitle': 'Pincel de segmentación',
  'dashboard.dock.segment.eraserTitle': 'Borrador de segmentación',
  'dashboard.dock.segment.sizeLabel': 'Tamaño',
  'dashboard.dock.segment.hint':
    'Ajusta el radio para editar las áreas segmentadas.',
  'dashboard.dock.imageTool.paintTitle': 'Pincel',
  'dashboard.dock.imageTool.eraserTitle': 'Borrador',
  'dashboard.dock.imageTool.healingTitle': 'Pincel corrector',
  'dashboard.dock.imageTool.sizeLabel': 'Tamaño',
  'dashboard.dock.imageTool.opacityLabel': 'Opacidad',
  'dashboard.dock.imageTool.blurLabel': 'Desenfoque',
  'dashboard.dock.imageTool.colorLabel': 'Color',
  'dashboard.dock.imageTool.colorAriaLabel': 'Color del pincel',
  'dashboard.dock.magicWand.title': 'Varita mágica',
  'dashboard.dock.magicWand.toleranceLabel': 'Tolerancia',
  'dashboard.dock.magicWand.healingBtnTitle':
    'Aplicar inpainting a la selección de la varita',
  'dashboard.dock.magicWand.healingBtnBusy': 'Aplicando…',
  'dashboard.dock.magicWand.healingBtn': 'Corrección',
  'dashboard.dock.magicWand.clearBtn': 'Limpiar',
  'dashboard.dock.imageTool.modelHint': 'Modelo: ',
  'dashboard.dock.palette.ariaLabel': 'Herramientas manuales de imagen',
  'dashboard.dock.config.closeLabel': 'Cerrar config',
  'dashboard.dock.config.openLabel': 'Abrir config',
  'dashboard.dock.config.badge': 'Config',
  'dashboard.dock.config.description':
    'Abre el panel contextual de la herramienta activa para ajustar forma, tamaño, opacidad, tolerancia y otros controles finos.',
  'dashboard.dock.config.disabledReason':
    'Activa una herramienta con parámetros editables para abrir la configuración.',
  'dashboard.dock.divider.reg': 'Reg',
  'dashboard.dock.areaSelect.ariaLabel': 'Seleccionar área',
  'dashboard.dock.areaSelect.title': 'Seleccionar área',
  'dashboard.dock.areaSelect.description':
    'Crea, ajusta y refina regiones de texto en la vista previa. Ideal para corregir globos detectados antes del OCR, traducción o renderizado.',
  'dashboard.dock.areaSelect.badge': 'Reg',
  'dashboard.dock.areaSelect.disabledReason':
    'Disponible en las etapas de Detectar y Renderizar del AIO manual.',
  'dashboard.dock.clearPage.ariaLabel': 'Borrar todas las regiones',
  'dashboard.dock.clearPage.title': 'Limpiar página',
  'dashboard.dock.clearPage.description':
    'Elimina todas las regiones de esta página de una vez para reiniciar el marcado manual sin restos.',
  'dashboard.dock.clearPage.badge': 'Reset',
  'dashboard.dock.clearPage.disabledReason':
    'Debe estar en Detectar/Renderizar y ya tener regiones creadas en la imagen activa.',
  'dashboard.dock.divider.seg': 'Seg',
  'dashboard.dock.segBrush.ariaLabel': 'Pincel de área segmentada',
  'dashboard.dock.segBrush.title': 'Pincel de segmentación',
  'dashboard.dock.segBrush.description':
    'Expande la máscara de segmentación para recuperar letras, contornos o piezas de globos que quedaron fuera.',
  'dashboard.dock.segBrush.badge': 'Seg',
  'dashboard.dock.segBrush.disabledReason':
    'Disponible durante la etapa de Segmentar texto.',
  'dashboard.dock.segEraser.ariaLabel': 'Borrador de área segmentada',
  'dashboard.dock.segEraser.title': 'Borrador de segmentación',
  'dashboard.dock.segEraser.description':
    'Refina la máscara eliminando exceso de selección, fugas y artefactos que no deberían incluirse en la limpieza.',
  'dashboard.dock.segEraser.badge': 'Seg',
  'dashboard.dock.segEraser.disabledReason':
    'Disponible durante la etapa de Segmentar texto.',
  'dashboard.dock.divider.img': 'Img',
  'dashboard.dock.paint.ariaLabel': 'Pincel de pintura',
  'dashboard.dock.paint.title': 'Pincel',
  'dashboard.dock.paint.description':
    'Pinta sobre artefactos, defectos de inpainting o detalles que necesitan micro-corrección directamente en la imagen.',
  'dashboard.dock.paint.badge': 'Img',
  'dashboard.dock.paint.disabledReason':
    'Entra en modo manual y selecciona una imagen activa para editar.',
  'dashboard.dock.paintEraser.ariaLabel': 'Borrador de pintura',
  'dashboard.dock.paintEraser.title': 'Borrador',
  'dashboard.dock.paintEraser.description':
    'Borra solo la capa de pintura manual para deshacer cambios sin perder el resto de las detecciones y máscaras.',
  'dashboard.dock.paintEraser.badge': 'Img',
  'dashboard.dock.paintEraser.disabledReason':
    'Entra en modo manual y selecciona una imagen activa para editar.',
  'dashboard.dock.wand.ariaLabel': 'Varita mágica',
  'dashboard.dock.wand.title': 'Varita mágica',
  'dashboard.dock.wand.description':
    'Selecciona rápidamente un área contigua por color/tolerancia para corrección precisa o eliminación de restos.',
  'dashboard.dock.wand.badge': 'Img',
  'dashboard.dock.wand.disabledReason':
    'Entra en modo manual y selecciona una imagen activa para editar.',
  'dashboard.dock.healing.ariaLabel': 'Pincel corrector',
  'dashboard.dock.healing.title': 'Pincel corrector',
  'dashboard.dock.healing.description':
    'Aplica inpainting localizado sobre defectos, bordes rotos y restos de texto manteniendo la textura circundante más natural.',
  'dashboard.dock.healing.badge': 'Img',
  'dashboard.dock.healing.disabledReason':
    'Entra en modo manual y selecciona una imagen activa para editar.',
  'dashboard.dock.clearPaint.ariaLabel': 'Borrar pintura',
  'dashboard.dock.clearPaint.title': 'Borrar pintura',
  'dashboard.dock.clearPaint.description':
    'Borra toda la capa de pintura manual de la imagen activa sin restablecer otras correcciones ni el historial de etapas.',
  'dashboard.dock.clearPaint.badge': 'Reset',
  'dashboard.dock.clearPaint.disabledReason':
    'Solo aparece cuando la imagen activa ya tiene pintura manual aplicada.',
  'dashboard.dock.resetEdits.ariaLabel': 'Restablecer todas las ediciones',
  'dashboard.dock.resetEdits.title': 'Restablecer ediciones',
  'dashboard.dock.resetEdits.description':
    'Devuelve la imagen activa al estado original de la etapa manual, eliminando pintura, corrección, selección de varita y sobrecargas locales.',
  'dashboard.dock.resetEdits.badge': 'Reset',
  'dashboard.dock.resetEdits.disabledReason':
    'Disponible cuando la imagen activa ya ha recibido alguna intervención manual.',
  'modelManager.stage.automaticAiClean': 'Limpieza automática con IA',
  'resources.fonts.downloadLabel': 'Descargar',
  'dashboard.sidebar.supportedFormats':
    'JPG, PNG, WEBP, ZIP, PDF, CBZ, CB7, PSD',
  'dashboard.cleaner.ocr.label': 'OCR',
  'dashboard.cleaner.ai.defaultProvider': 'Nube / API / IA',
  'bugReport.screenshot.alt': 'Captura de pantalla',
  'pageTransition.loading.ariaLabel': 'Cargando',
  'watermark.text.placeholder': 'KŌMA Studio',
  'watermark.logo.alt': 'Logo',
  'dashboard.textDetection.regionActions.aria': 'Acciones de región',
  'dashboard.textDetection.manualModeRequired': 'Requiere modo manual',
  'dashboard.textDetection.removeRegion': 'Eliminar región',
  'dashboard.renderText.rewind.title': 'Retroceder esta imagen',
  'dashboard.renderText.forward.title': 'Avanzar esta imagen',
  'dashboard.renderText.noHistory': 'Sin historial AIO para esta imagen',
  'dashboard.renderText.editPlaceholder': 'Escribe el texto final...',
  'dashboard.renderText.editAria': 'Editar texto renderizado',
  'dashboard.renderText.removeSelection.title': 'Eliminar selección',
  'dashboard.renderText.regionActions.aria': 'Acciones de región',
  'dashboard.pipeline.prevStep.title':
    'Volver a la etapa anterior del pipeline AIO',
  'dashboard.pipeline.nextStep.title':
    'Avanzar a la siguiente etapa del pipeline AIO',
  'dashboard.pipeline.runStep.title':
    'Ejecutar solo la etapa actual para la imagen seleccionada',
  'dashboard.pipeline.skipStep.title':
    'Omitir la etapa actual y desbloquear la siguiente',
  'dashboard.typesetter.applyStyleAll.title':
    'Aplicar el estilo de la selección actual a todas las regiones',
  'auth.error.internetRequired':
    'Se requiere acceso a Internet para iniciar sesión en la aplicación.',
  'auth.error.mandatoryUpdate':
    'Actualización obligatoria disponible. Actualiza la aplicación para continuar.',
  'dashboard.textDetection.noTextRecognized': 'Sin texto reconocido',
  'dashboard.textDetection.noTranslation': 'Sin traducción disponible',
  'dashboard.textDetection.noNt': 'Sin NT disponible',
  'dashboard.renderText.dblClickToEdit': 'doble clic para editar',
  'dashboard.renderText.renderNotApplied':
    'renderizado no aplicado en esta etapa',
  'dashboard.status.stageLabelTranslation': 'Traducción',
  'dashboard.status.profilesPersistedDesktopSecure':
    'Perfiles personalizados guardados en escritorio con almacenamiento seguro.',
  'dashboard.status.profilesPersistedDesktopLocal':
    'Perfiles personalizados guardados en escritorio sin cifrado nativo disponible.',
  'dashboard.status.profilesPersistedBrowser':
    'Perfiles personalizados guardados en el navegador local de este dispositivo.',
  'dashboard.status.aioScopeManual': 'AIO manual',
  'dashboard.status.aioScopeAuto': 'AIO automático',
  'dashboard.status.cleanerSelectProfileFirst':
    'Selecciona un perfil visual guardado para usar con la Limpieza automática con IA.',
  'dashboard.status.cleanerProfileNotFound':
    'Perfil visual no encontrado. Recarga e intenta de nuevo.',
  'dashboard.status.cleanerProfileInUse':
    'Perfil visual en uso para Limpieza automática con IA: {label}.',
  'dashboard.status.cleanerSelectValidModel':
    'Selecciona un modelo válido para la Limpieza automática con IA.',
  'dashboard.status.modelInRoadmap':
    'El modelo "{name}" aún está en el roadmap.',
  'dashboard.status.modelNeedsConfig':
    'El modelo "{name}" requiere configuración antes de usarse.',
  'dashboard.status.translatorSfxSelectValidModel':
    'Selecciona un modelo válido para el SFX con IA del Traductor.',
  'dashboard.status.cleanerProfileSaved':
    'Perfil visual guardado y seleccionado para Limpieza automática con IA: {label}.',
  'dashboard.status.cleanerSelectProfileToRemove':
    'Selecciona un perfil visual guardado para eliminar.',
  'dashboard.status.customProfilePendingSync':
    'Perfil personalizado esperando sincronización local.',
  'dashboard.status.customProfileOcrPendingSync':
    'Perfil de OCR personalizado esperando sincronización local.',
  'dashboard.status.presetAppliedToSelection':
    'Preajuste "{name}" aplicado a la selección actual.',
  'dashboard.status.legacyPresetNotFound':
    'Preajuste visual legacy {modeKey} no encontrado.',
  'dashboard.status.presetAppliedShort':
    'Preajuste "{name}" aplicado a la selección.',
  'dashboard.status.presetAppliedToImage':
    'Preajuste "{name}" aplicado a la imagen activa.',
  'dashboard.status.typographerSelectionDuplicated':
    'Selección duplicada en el Tipógrafo.',
  'dashboard.status.autoShapeApplied': 'Forma automática aplicada: {shape}.',
  'dashboard.status.renderStyleAppliedAll':
    'Estilo de renderizado aplicado a todas las selecciones en todas las imágenes.',
  'dashboard.status.canvasInitFailed':
    'Error al inicializar el canvas de composición manual.',
  'dashboard.status.cleanerCanvasInitFailed':
    'Error al inicializar el canvas de composición manual del Limpiador.',
  'dashboard.status.wandPrepFailed': 'Error al preparar la varita mágica.',
  'dashboard.status.wandSelectionUpdated':
    'Selección de varita actualizada. Usa Corrección para aplicar inpainting.',
  'dashboard.status.wandNoArea':
    'La varita no encontró un área compatible para la selección.',
  'dashboard.status.wandExecFailed': 'Error al ejecutar la varita mágica.',
  'dashboard.status.cleanerWandPrepFailed':
    'Error al preparar la varita mágica del Limpiador.',
  'dashboard.status.cleanerWandSelectionUpdated':
    'Selección de varita del Limpiador actualizada. Usa Corrección para aplicar inpainting.',
  'dashboard.status.cleanerWandNoArea':
    'La varita del Limpiador no encontró un área compatible para la selección.',
  'dashboard.status.cleanerWandExecFailed':
    'Error al ejecutar la varita mágica del Limpiador.',
  'dashboard.status.healingInvalidResponse':
    'Respuesta no válida al aplicar el Pincel corrector.',
  'dashboard.status.cleanerHealingInvalidResponse':
    'Respuesta no válida al aplicar el Pincel corrector en el Limpiador.',
  'dashboard.status.cleanerHealingConnectFailed':
    'El Pincel corrector del Limpiador no pudo conectarse al backend ({url}). Verifica que el mini-backend esté activo.',
  'dashboard.status.cleanerHealingFailed':
    'Error al aplicar el Pincel corrector en el Limpiador.',
  'dashboard.status.wandNoSelectionForHealing':
    'No hay selección de varita para aplicar corrección.',
  'dashboard.status.renderCanvasInitFailed':
    'Error al inicializar el canvas de renderizado.',
  'dashboard.status.aioCompleteAdjust':
    '{message} Ajusta manualmente si es necesario.',
  'dashboard.status.aioAborted': 'Ejecución de AIO cancelada.',
  'dashboard.alert.importWorkspaceConfirm':
    'Importar este espacio de trabajo reemplazará el actual en memoria. ¿Deseas continuar?',
  'dashboard.alert.clearAutosaveConfirm':
    'Borrar el autoguardado local elimina el último espacio de trabajo guardado en este PC para este usuario. ¿Continuar?',
  'dashboard.alert.closeWorkspaceConfirm':
    '¿Cerrar el espacio de trabajo actual? Esto eliminará todas las imágenes cargadas y el autoguardado local. Esta acción no se puede deshacer.',
  'dashboard.status.workspacePendingChanges':
    'El espacio de trabajo tiene cambios pendientes.',
  'dashboard.status.toolSelectArea': 'Seleccionar área',
  'dashboard.status.toolSegmentBrush': 'Pincel de segmentación',
  'dashboard.status.toolSegmentEraser': 'Borrador de segmentación',
  'dashboard.alert.emailPendingTitle': 'Correo pendiente de confirmación',
  'dashboard.alert.emailPendingText':
    'Confirma tu correo para realizar acciones de procesamiento.',
  'dashboard.status.typographerSession': 'Sesión del Tipógrafo',
  'dashboard.status.cleanerMeta':
    'OCR: {ocrCount} • Segmentado: {segmentedCount} • Limpiado: {cleaned}',
  'dashboard.status.metaOk': 'ok',
  'dashboard.status.metaPending': 'pendiente',
  'dashboard.status.cleanerRunFirst':
    'Ejecuta el Limpiador para generar OCR, segmentación e imagen limpia.',
  'dashboard.status.translatorMeta':
    'Detectar: {detected} • OCR: {ocr} • Traducción: {translated}',
  'dashboard.status.translatorRunFirst':
    'Ejecuta el Traductor Visual para detectar, reconocer y traducir.',
  'dashboard.status.localModelDownloadHint':
    'Los modelos locales se descargan bajo demanda; los modelos nube/API siguen usando una clave.',
  'dashboard.status.selectionTextModeAria':
    'Modo de texto de la selección actual',
  'dashboard.status.translatorUsesAioModel':
    'El Traductor usa la misma selección de modelo que AIO; ejecuta de nuevo tras cambiar el modelo.',
  'dashboard.status.translatorLocalModelIncompatible':
    'El modelo local actual no admite el par de idiomas del Traductor. Elige otro modelo o usa la nube.',
  'dashboard.status.stitchLastMoved':
    'Última imagen enviada al siguiente lote.',
  'dashboard.status.stitchFirstPulled':
    'Primera imagen del siguiente lote añadida al lote actual.',
  'auth.error.generic': 'Error {status}',
  'auth.error.desktopBridgeUnavailable':
    'Puente de autenticación de escritorio no disponible.',
  'dashboard.status.modeLabel': 'Modo',
  'dashboard.status.selectedLabel': 'Seleccionado',
  'dashboard.status.selectBoxInPreview':
    'Selecciona un cuadro en la vista previa.',
  'dashboard.status.selectTranslatorModel':
    'Selecciona un modelo local o en la nube para traducir en el Traductor.',
  'dashboard.error.loadHardwareFailed': 'Error al cargar el hardware local.',
  'dashboard.error.healingBrushFailed':
    'Error en el Pincel corrector: {message}',
  'dashboard.status.healingBrushApplyFailed':
    'Error al aplicar el Pincel corrector.',
  'dashboard.error.cleanerHealingBrushFailed':
    'Error en el Pincel corrector del Limpiador: {message}',
  'dashboard.status.aioExecutionFailed': 'Error al ejecutar AIO.',
  'dashboard.status.autosaveSaveFailed':
    'Error al guardar el autoguardado local.',
  'dashboard.status.workspaceExportFailed':
    'Error al exportar el espacio de trabajo.',
  'dashboard.status.workspaceImportFailed':
    'Error al importar el espacio de trabajo.',
  'dashboard.status.autosaveClearFailed':
    'Error al borrar el autoguardado local.',
  'dashboard.status.noModelSelected': 'Ningún modelo seleccionado.',
  'dashboard.status.aiCleanModelSelected':
    'Modelo seleccionado para Limpieza automática con IA: {model}',
  'dashboard.status.selectionMode': 'Modo de selección',
  'dashboard.status.workspaceRestored': 'Espacio de trabajo restaurado.',
  'dashboard.status.workspaceRestoredFromAutosave':
    'Espacio de trabajo restaurado desde el autoguardado local.',
  'dashboard.aio.skip': 'Omitir',
  'dashboard.aio.imageLabel': 'Imagen:',
  'dashboard.aio.stepLabel': 'Etapa:',
  'dashboard.aio.historyHint': 'Etapa: {label} ({current}/{total})',
  'dashboard.typo.fontsUpdating': 'Actualizando…',
  'dashboard.typo.updateFonts': 'Actualizar fuentes',
  'dashboard.typo.importFontTitle': 'Importar fuente personalizada',
  'dashboard.typo.desktopOnly': 'Solo aplicación de escritorio',
  'dashboard.typo.fontImporting': 'Importando…',
  'dashboard.typo.importFont': 'Importar fuente',
  'dashboard.typo.applyStyleToAll': 'Aplicar estilo a todos',
  'dashboard.typo.fontControlsHint':
    'Los controles de fuente/color/alineación están en el dock contextual del overlay. Atajo:',
  'dashboard.aio.languageLabel': 'Idioma:',
  'shortcuts.category.global': 'Global',
  'shortcuts.category.modes': 'Modos',
  'shortcuts.category.typesetter': 'Tipógrafo',
  'shortcuts.noShortcut': 'Sin atajo',
  'shortcuts.openShortcutModal.label': 'Abrir centro de atajos',
  'shortcuts.openShortcutModal.description':
    'Abre el modal de atajos y configuración.',
  'shortcuts.toggleToolsPanel.label': 'Mostrar/ocultar panel de herramientas',
  'shortcuts.toggleToolsPanel.description':
    'Alterna la visibilidad del panel de herramientas.',
  'shortcuts.rotateActiveImage.label': 'Rotar imagen activa',
  'shortcuts.rotateActiveImage.description':
    'Rota la imagen seleccionada 90 grados.',
  'shortcuts.workspaceSave.label': 'Guardar espacio de trabajo local',
  'shortcuts.workspaceSave.description':
    'Fuerza un autoguardado local del espacio de trabajo actual.',
  'shortcuts.workspaceUndo.label': 'Deshacer espacio de trabajo',
  'shortcuts.workspaceUndo.description':
    'Deshace el último cambio en el espacio de trabajo actual.',
  'shortcuts.workspaceRedo.label': 'Rehacer espacio de trabajo',
  'shortcuts.workspaceRedo.description':
    'Rehace el último cambio deshecho en el espacio de trabajo actual.',
  'shortcuts.zoomIn.label': 'Acercar',
  'shortcuts.zoomIn.description': 'Acerca la vista en la etapa actual.',
  'shortcuts.zoomOut.label': 'Alejar',
  'shortcuts.zoomOut.description': 'Aleja la vista en la etapa actual.',
  'shortcuts.setViewPaginated.label': 'Vista paginada',
  'shortcuts.setViewPaginated.description': 'Cambia a vista paginada.',
  'shortcuts.setViewLongStrip.label': 'Vista de tira larga',
  'shortcuts.setViewLongStrip.description': 'Cambia a vista de tira larga.',
  'shortcuts.setModeOrganize.label': 'Modo Organizar',
  'shortcuts.setModeOrganize.description': 'Cambia al modo Organizar.',
  'shortcuts.setModeAio.label': 'Modo AIO',
  'shortcuts.setModeAio.description': 'Cambia al modo AIO.',
  'shortcuts.setModeCleaner.label': 'Modo Limpiador / Redibujador',
  'shortcuts.setModeCleaner.description':
    'Cambia al modo Limpiador / Redibujador.',
  'shortcuts.setModeTypesetter.label': 'Modo Tipógrafo',
  'shortcuts.setModeTypesetter.description': 'Cambia al modo Tipógrafo.',
  'shortcuts.setModeTranslator.label': 'Modo Traductor',
  'shortcuts.setModeTranslator.description': 'Cambia al modo Traductor.',
  'shortcuts.setModeRaw.label': 'Modo Proveedor de raws',
  'shortcuts.setModeRaw.description': 'Cambia al modo Proveedor de raws.',
  'shortcuts.setModeProofreader.label': 'Modo Corrector / QC',
  'shortcuts.setModeProofreader.description': 'Cambia al modo Corrector / QC.',
  'shortcuts.setModeStitch.label': 'Modo Unir',
  'shortcuts.setModeStitch.description': 'Cambia al modo Unir.',
  'shortcuts.setModeSplit.label': 'Modo División inteligente',
  'shortcuts.setModeSplit.description': 'Cambia al modo División inteligente.',
  'shortcuts.setModeWatermark.label': 'Modo Marca de agua',
  'shortcuts.setModeWatermark.description': 'Cambia al modo Marca de agua.',
  'shortcuts.setModeEnhance.label': 'Modo Mejorar imagen',
  'shortcuts.setModeEnhance.description': 'Cambia al modo Mejorar imagen.',
  'shortcuts.setModeGuides.label': 'Modo Guías',
  'shortcuts.setModeGuides.description': 'Cambia al modo Guías.',
  'shortcuts.setModeResources.label': 'Modo Recursos',
  'shortcuts.setModeResources.description': 'Cambia al modo Recursos.',
  'shortcuts.applyText.label': 'Aplicar texto',
  'shortcuts.applyText.description':
    'Aplica el elemento seleccionado de la cola en el Tipógrafo o renderizado manual de AIO.',
  'shortcuts.nextRegion.label': 'Seleccionar siguiente región',
  'shortcuts.nextRegion.description':
    'Mueve la selección a la siguiente región en el Tipógrafo o AIO manual.',
  'shortcuts.previousRegion.label': 'Seleccionar región anterior',
  'shortcuts.previousRegion.description':
    'Mueve la selección a la región anterior en el Tipógrafo o AIO manual.',
  'shortcuts.toggleMultiBubble.label': 'Alternar multi-globo',
  'shortcuts.toggleMultiBubble.description':
    'Alterna la agrupación multi-globo en el Tipógrafo o AIO manual.',
  'shortcuts.saveSnapshot.label': 'Guardar instantánea',
  'shortcuts.saveSnapshot.description':
    'Guarda una instantánea de la sesión del Tipógrafo o AIO manual.',
  'shortcuts.detectShapes.label': 'Detectar/refinar forma',
  'shortcuts.detectShapes.description':
    'Ejecuta detección o refinamiento de la forma seleccionada en el Tipógrafo o AIO manual.',
  'shortcuts.applyActivePreset.label': 'Aplicar preajuste activo',
  'shortcuts.applyActivePreset.description':
    'Aplica el preajuste de tipografía activo a la región seleccionada.',
  'shortcuts.applyLegacyPresetTextBubble.label':
    'Aplicar preajuste Legacy text_bubble',
  'shortcuts.applyLegacyPresetTextBubble.description':
    'Aplica el preajuste visual Legacy text_bubble a la región seleccionada.',
  'shortcuts.applyLegacyPresetTextFree.label':
    'Aplicar preajuste Legacy text_free',
  'shortcuts.applyLegacyPresetTextFree.description':
    'Aplica el preajuste visual Legacy text_free a la región seleccionada.',
  'shortcuts.applyLegacyPresetTextSfx.label':
    'Aplicar preajuste Legacy text_sfx',
  'shortcuts.applyLegacyPresetTextSfx.description':
    'Aplica el preajuste visual Legacy text_sfx a la región seleccionada.',
  'shortcuts.applyLegacyPresetTextNarration.label':
    'Aplicar preajuste Legacy text_narration',
  'shortcuts.applyLegacyPresetTextNarration.description':
    'Aplica el preajuste visual Legacy text_narration a la región seleccionada.',
  'shortcuts.applyLegacyPresetTextInsideBlackBubble.label':
    'Aplicar preajuste Legacy text_inside_black_bubble',
  'shortcuts.applyLegacyPresetTextInsideBlackBubble.description':
    'Aplica el preajuste visual Legacy text_inside_black_bubble a la región seleccionada.',
  'shortcuts.applyAutoShape.label': 'Aplicar forma automática',
  'shortcuts.applyAutoShape.description':
    'Elige automáticamente entre elíptico y rectangular para la región seleccionada.',
  'shortcuts.convertShapeSquare.label': 'Convertir forma a rectangular',
  'shortcuts.convertShapeSquare.description':
    'Convierte la región seleccionada a forma rectangular.',
  'shortcuts.convertShapeRounded.label': 'Convertir forma a elíptico',
  'shortcuts.convertShapeRounded.description':
    'Convierte la región seleccionada a forma elíptica.',
  'shortcuts.deleteRegion.label': 'Eliminar región seleccionada',
  'shortcuts.deleteRegion.description':
    'Elimina la región seleccionada en AIO manual, Tipógrafo, Traductor Visual o Limpiador.',
  'shortcuts.editInline.label': 'Abrir edición en línea de región',
  'shortcuts.editInline.description':
    'Abre la edición en línea para la región seleccionada en el renderizado manual.',
  'shortcuts.inlineEditorCancel.label': 'Cancelar edición en línea',
  'shortcuts.inlineEditorCancel.description':
    'Disponible solo dentro del área de texto de edición en línea.',
  'shortcuts.inlineEditorSave.label': 'Guardar edición en línea',
  'shortcuts.inlineEditorSave.description':
    'Disponible solo dentro del área de texto de edición en línea.',
  'shortcuts.category.palette': 'Paleta de herramientas',
  'shortcuts.duplicateRegion.label': 'Duplicar región seleccionada',
  'shortcuts.duplicateRegion.description':
    'Duplica la región seleccionada en el Tipógrafo o AIO manual con un desplazamiento de 18px.',
  'shortcuts.toolConfigToggle.label': 'Alternar panel de configuración',
  'shortcuts.toolConfigToggle.description':
    'Abre o cierra el panel de configuración de la herramienta activa en la paleta.',
  'shortcuts.toolAreaSelect.label': 'Herramienta: Selección de área',
  'shortcuts.toolAreaSelect.description':
    'Activa la herramienta de selección de área en AIO manual.',
  'shortcuts.toolClearRegions.label': 'Borrar todas las regiones',
  'shortcuts.toolClearRegions.description':
    'Elimina todas las regiones de la imagen activa en AIO manual.',
  'shortcuts.toolSegmentBrush.label': 'Herramienta: Pincel de segmentación',
  'shortcuts.toolSegmentBrush.description':
    'Activa el pincel para edición manual de máscara de segmentación.',
  'shortcuts.toolSegmentEraser.label': 'Herramienta: Borrador de segmentación',
  'shortcuts.toolSegmentEraser.description':
    'Activa el borrador para edición manual de máscara de segmentación.',
  'shortcuts.toolPaint.label': 'Herramienta: Pintar',
  'shortcuts.toolPaint.description':
    'Activa la herramienta de pintura manual sobre la imagen.',
  'shortcuts.toolPaintEraser.label': 'Herramienta: Borrador de pintura',
  'shortcuts.toolPaintEraser.description':
    'Activa el borrador para limpiar la capa de pintura manual.',
  'shortcuts.toolMagicWand.label': 'Herramienta: Varita mágica',
  'shortcuts.toolMagicWand.description':
    'Activa la varita mágica para selección basada en tolerancia de color.',
  'shortcuts.toolHealingBrush.label': 'Herramienta: Pincel corrector',
  'shortcuts.toolHealingBrush.description':
    'Activa el pincel corrector para restauración de imagen.',
  'shortcuts.toolClearPaint.label': 'Borrar capa de pintura',
  'shortcuts.toolClearPaint.description':
    'Elimina toda la capa de pintura manual de la imagen activa.',
  'shortcuts.toolResetEdits.label': 'Restablecer ediciones manuales',
  'shortcuts.toolResetEdits.description':
    'Deshace todas las ediciones manuales en la imagen activa del Limpiador o AIO.',
  'dashboard.coachmark.stage.titleSuffix': 'escenario principal',
  'dashboard.coachmark.stage.bodyWithImages':
    'Aquí ves la imagen activa, validas el resultado visual del modo <strong>{modeLabel}</strong> y haces ajustes con retroalimentación inmediata.',
  'dashboard.coachmark.stage.bodyWithoutImages':
    'Cuando cargues imágenes, este escenario se convierte en el centro visual del modo <strong>{modeLabel}</strong>. Es donde el resultado aparece primero.',
  'dashboard.coachmark.stage.accent': 'Escenario',
  'dashboard.coachmark.tools.titleSuffix': 'caja de herramientas',
  'dashboard.coachmark.tools.body':
    'Usa la barra lateral derecha para configurar opciones, preajustes y acciones del modo <strong>{modeLabel}</strong>. Si algo cambia en el flujo, generalmente empieza aquí.',
  'dashboard.coachmark.tools.accent': 'Herramientas',
  'dashboard.coachmark.download.titleSuffix': 'exportación',
  'dashboard.coachmark.download.body':
    'Cuando el resultado esté correcto, finaliza a través del menú de exportación para descargar imágenes, paquetes o PSDs sin salir del modo actual.',
  'dashboard.coachmark.download.accent': 'Entrega',
  'dashboard.coachmark.organize.uploadTitle':
    'Organizar: comienza con la carga',
  'dashboard.coachmark.organize.uploadBody':
    'Arrastra páginas, capítulos o paquetes completos aquí. El modo Organizar existe para preparar el lote antes de entrar en producción.',
  'dashboard.coachmark.organize.uploadAccent': 'Entrada',
  'dashboard.coachmark.organize.orderTitle': 'Organizar: revisa el orden',
  'dashboard.coachmark.organize.orderBody':
    'En la barra lateral izquierda eliges la imagen activa, reordenas páginas, eliminas elementos malos y verificas si el capítulo está listo para continuar.',
  'dashboard.coachmark.organize.orderAccent': 'Lote',
  'dashboard.coachmark.aioAuto.pipelineTitle':
    'AIO automático: deja correr el pipeline',
  'dashboard.coachmark.aioAuto.pipelineBody':
    'En modo automático, configuras una vez y procesas el lote en secuencia. Ideal para rendimiento, revisión posterior y flujos de trabajo más repetitivos.',
  'dashboard.coachmark.aioAuto.pipelineAccent': 'Auto',
  'dashboard.coachmark.aioAuto.stagesTitle':
    'AIO automático: activa solo lo que necesitas',
  'dashboard.coachmark.aioAuto.stagesBody':
    'Activa solo las etapas que tengan sentido para este lote. Menos etapas significa menos coste, menos tiempo y menos puntos de fallo.',
  'dashboard.coachmark.aioAuto.stagesAccent': 'Pipeline',
  'dashboard.coachmark.aioAuto.configTitle':
    'AIO automático: configura modelos e idiomas',
  'dashboard.coachmark.aioAuto.configBody':
    'Elige idiomas, preajustes y modelos antes de ejecutar. Esta es la parte que más influye en la velocidad, calidad y coste del procesamiento.',
  'dashboard.coachmark.aioAuto.configAccent': 'Configuración',
  'dashboard.coachmark.aioManual.title': 'AIO manual: trabaja etapa por etapa',
  'dashboard.coachmark.aioManual.body':
    'En modo manual, ejecutas, revisas y corriges cada etapa con más control. Es el modo ideal para acabados finos y recuperar casos difíciles.',
  'dashboard.coachmark.aioManual.accent': 'Manual',
  'dashboard.coachmark.aioManual.dockTitle':
    'AIO manual: usa el dock como tu banco de trabajo',
  'dashboard.coachmark.aioManual.dockBody':
    'El dock flotante reúne selección, segmentación, pintura, varita y corrección. Piensa en él como el mini panel de intervención rápida sobre la vista previa.',
  'dashboard.coachmark.aioManual.dockAccent': 'Dock',
  'dashboard.coachmark.typesetter.titleManual': 'Tipógrafo manual',
  'dashboard.coachmark.typesetter.titleAuto': 'Tipógrafo automático',
  'dashboard.coachmark.typesetter.bodyManual':
    'El manual es mejor para micro-ajustes de globos, formas, fuentes y ritmo visual por página.',
  'dashboard.coachmark.typesetter.bodyAuto':
    'El automático acelera borradores y lotes grandes. Haz un seguimiento con una revisión visual rápida para asegurar la consistencia.',
  'dashboard.coachmark.typesetter.accentManual': 'Manual',
  'dashboard.coachmark.typesetter.accentAuto': 'Auto',
  'dashboard.coachmark.cleaner.dockTitle':
    'Limpiador: corrección local sin salir de la imagen',
  'dashboard.coachmark.cleaner.dockBody':
    'Cuando el dock está visible, usa pincel, borrador y corrector para cerrar detalles sin perder el contexto de la página.',
  'dashboard.coachmark.cleaner.dockAccent': 'Dock',
  'dashboard.coachmark.content.titleSuffix': 'navegación de contenido',
  'dashboard.coachmark.content.body':
    'Este modo cambia el escenario visual por un panel de referencia. Úsalo para aprender flujos de trabajo, revisar material de apoyo y volver a producción con menos fricción.',
  'dashboard.coachmark.content.accent': 'Referencia',
  'dashboard.coachmark.progress': 'Guía {{current}} / {{total}}',
  'dashboard.coachmark.next': 'Siguiente',
  'dashboard.coachmark.prev': 'Anterior',
  'dashboard.coachmark.done': 'Entendido',
  'aioModel.label.unavailable': ' (no disponible)',
  'aioModel.label.notInstalled': '(No instalado — clic para instalar)',
  'aioModel.label.updateAvailable': '(Actualización disponible)',
  'aioModel.label.installed': '(Instalado)',
  'aioModel.status.selectAndInstall':
    'Selecciona e instala un modelo local para la etapa "{stage}".',
  'aioModel.status.installBeforeUse':
    'Instala el modelo "{name}" antes de usar esta etapa.',
  'aioModel.status.selectValidOcr': 'Selecciona un modelo válido para OCR.',
  'aioModel.status.inRoadmap': 'El modelo "{name}" aún está en el roadmap.',
  'aioModel.status.requiresConfig':
    'El modelo "{name}" requiere configuración antes de usarse.',
  'aioModel.status.installedOk': 'instalado (ok)',
  'aioModel.status.installedUpdate': 'instalado (actualización disponible)',
  'aioExec.selectAndInstallStage':
    'Selecciona e instala un modelo local antes de ejecutar la etapa "{stageLabel}".',
  'aioExec.installBeforeStage':
    'Instala el modelo "{name}" antes de ejecutar la etapa "{stageLabel}".',
  'aioExec.selectValidOcrModel':
    'Selecciona un modelo válido para Reconocer texto.',
  'aioExec.ocrRequiresApiKey':
    'Este proveedor de OCR requiere una clave de API. Configura la clave antes de ejecutar.',
  'aioExec.installTranslationModel':
    'Instala un modelo de traducción compatible antes de ejecutar AIO.',
  'aioExec.incompatibleLanguage':
    'El modelo seleccionado no es compatible con el idioma actual.',
  'aioExec.translationModelIncompatible':
    '"{modelName}" no admite el idioma de destino seleccionado. Elige un modelo compatible o cambia el idioma de destino.',
  'aioExec.selectValidTranslation':
    'Selecciona un modelo de traducción válido para continuar.',
  'aioExec.selectCustomOcrProfile':
    'Selecciona o guarda un perfil de OCR de IA personalizado antes de ejecutar AIO.',
  'aioExec.selectCustomAiProfile':
    'Selecciona o guarda un perfil de IA personalizado antes de ejecutar AIO.',
  'aioExec.translationRequiresApiKey':
    'Este proveedor de traducción requiere una clave de API. Configura la clave antes de ejecutar.',
  'aioManual.selectImage':
    'Selecciona una imagen para ejecutar en modo manual.',
  'aioManual.imageNotFound': 'Imagen activa no encontrada.',
  'aioManual.progressNotInitialized':
    'Progresión manual no inicializada para la imagen activa.',
  'aioManual.selectValidDetectModel':
    'Selecciona un modelo válido para Detectar texto.',
  'aioManual.selectValidSegmentModel':
    'Selecciona un modelo válido para Segmentar texto.',
  'aioManual.selectValidCleanModel':
    'Selecciona un modelo válido para Limpiar imagen.',
  'aioManual.stageDone':
    'Modo manual: etapa "{stageLabel}" completada para "{fileName}".',
  'aioManual.executionAborted': 'Ejecución de AIO manual cancelada.',
  'aioManual.stageFailed': 'Error al ejecutar la etapa "{stageLabel}".',
  'translator.localModelIncompatible':
    'El modelo local seleccionado no es compatible con el idioma actual del Traductor.',
  'translator.selectValidTranslationModel':
    'Selecciona un modelo de traducción válido para el Traductor.',
  'translator.selectCustomAiTranslationProfile':
    'Selecciona o guarda un perfil de traducción de IA personalizado antes de ejecutar.',
  'translator.localOcrModelIncompatible':
    'El modelo local de OCR seleccionado no es compatible con el idioma actual del Traductor.',
  'translator.installCompatibleOcrModel':
    'Instala un modelo de OCR compatible antes de ejecutar el Traductor Visual.',
  'translator.selectValidOcrModel':
    'Selecciona un modelo de OCR válido para el Traductor Visual.',
  'modelManager.error.diskCheckFailed':
    'No se pudo verificar el espacio disponible en disco.',
  'updater.mandatoryUpdate':
    'Esta actualización es obligatoria. Descárgala e instálala para continuar.',
  'translatorVisual.noImages':
    'Carga al menos una imagen para usar el Traductor Visual.',
  'translatorVisual.running.aiSfx':
    'Traductor Visual SFX con IA: detectando, clasificando, reconociendo, traduciendo y limpiando...',
  'translatorVisual.running.standard':
    'Traductor Visual: detectando, reconociendo y traduciendo...',
  'translatorVisual.invalidSfxResponse':
    'Respuesta de SFX con IA no válida del Traductor para "{fileName}".',
  'translatorVisual.done.aiSfx':
    'Traductor Visual SFX con IA completo. {candidates} candidato(s), {approved} SFX aprobados, {ocr} OCR(s), {translations} traducción(es) y {redraw} región(es) solicitando redibujo.',
  'translatorVisual.done.standard':
    'Traductor Visual completo. {detected} región(es) detectada(s), {recognized} texto(s) reconocido(s), {translations} traducción(es) generada(s).',
  'translatorVisual.genericError': 'Error al ejecutar el Traductor Visual.',
  'freeProvider.catalogOnly':
    'El proveedor "{name}" está disponible solo como catálogo en v1.',
  'enhanceActions.connectError':
    'Mejorar no pudo conectarse al backend ({url}). Verifica que el mini-backend esté activo.',
  'aioSingleProcessor.invalidCleanResponse':
    'Respuesta no válida al limpiar "{fileName}".',
  'cleanerActions.detectFailed':
    'Error al detectar regiones para "{fileName}": {message}',
  'cleanerActions.invalidSfxResponse':
    'Respuesta no válida del Limpiador de SFX con IA para "{fileName}".',
  'cleanerActions.invalidAutoCleanResponse':
    'Respuesta no válida de la Limpieza automática con IA para "{fileName}".',
  'cleanerActions.sfxDone':
    'Limpiador de SFX con IA completo. {images} imagen(es), {candidates} candidato(s), {approved} SFX aprobados y {redraw} región(es) solicitando redibujo.',
  'cleanerActions.autoCleanDone':
    'Limpieza automática con IA completa. {images} imagen(es) procesada(s) y {detected} región(es) detectada(s).',
  'cleanerActions.assistedDone':
    'Limpiador asistido completo. {images} imagen(es) limpiada(s), {detected} región(es) detectada(s), {recognized} texto(s) reconocido(s), {segmented} región(es) segmentada(s).',
  'webhook.event.processStart.label': 'Procesamiento iniciado',
  'webhook.event.processStart.desc': 'Cuando una ejecución comienza',
  'webhook.event.processComplete.label': 'Procesamiento completado',
  'webhook.event.processComplete.desc':
    'Cuando una ejecución finaliza correctamente',
  'webhook.event.processError.label': 'Errores de procesamiento',
  'webhook.event.processError.desc': 'Cuando ocurre un fallo',
  'webhook.event.updateAvailable.label': 'Actualización disponible',
  'webhook.event.updateAvailable.desc':
    'Cuando hay una nueva versión disponible',
  'webhook.event.updateDownloaded.label': 'Actualización descargada',
  'webhook.event.updateDownloaded.desc':
    'Cuando la descarga de la actualización finaliza',
  'webhook.event.updateError.label': 'Error de actualización',
  'webhook.event.updateError.desc': 'Cuando el actualizador falla',
  'webhook.validation.urlRequired': 'Introduce la URL del webhook de Discord.',
  'webhook.validation.urlInvalid':
    'URL no válida. Verifica el formato del webhook.',
  'webhook.validation.urlHttpsRequired': 'La URL del webhook debe usar HTTPS.',
  'webhook.validation.urlNotDiscord':
    'Usa una URL oficial de Discord (discord.com).',
  'webhook.validation.urlInvalidPath':
    'La ruta de la URL no coincide con un webhook de Discord válido.',
  'typography.effect.none.label': 'Sin efecto',
  'typography.effect.none.description': 'Texto limpio, sin capas adicionales.',
  'typography.effect.balloon_smear.label': 'Balloon Smear',
  'typography.effect.balloon_smear.description':
    'Trazo gris vertical con ligero bamboleo lateral, inspirado en texto de diálogo dramático.',
  'typography.effect.smiles_outline.label': 'SMILES Outline',
  'typography.effect.smiles_outline.description':
    'Contorno coral suave con un núcleo claro, estilo susurro tierno.',
  'typography.effect.ahnnn_peach.label': 'Ahnnn Peach Glow',
  'typography.effect.ahnnn_peach.description':
    'Relleno melocotón con un brillo cálido y suave.',
  'typography.effect.silence_ink.label': 'Silence Ink',
  'typography.effect.silence_ink.description':
    'Azul violáceo con presencia limpia y ligera profundidad interior.',
  'typography.effect.hwa_pastel.label': 'HWA Pastel',
  'typography.effect.hwa_pastel.description':
    'Amarillo claro con contorno rosa y sensación delicada.',
  'typography.effect.hah_pop.label': 'HAH Pop',
  'typography.effect.hah_pop.description':
    'Núcleo lila claro con presencia pop y relieve rosa.',
  'typography.effect.smooch_jelly.label': 'Smooch Jelly',
  'typography.effect.smooch_jelly.description':
    'Rosa suave con brillo tipo gelatina y sombra dulce.',
  'typography.effect.tremble_brush.label': 'Tremble Brush',
  'typography.effect.tremble_brush.description':
    'Pincel azul-violeta enérgico con borde irregular.',
  'typography.effect.eheheh_whisper.label': 'EHEHEH Whisper',
  'typography.effect.eheheh_whisper.description':
    'Rosa claro con contorno esponjoso y brillo tímido.',
  'typography.effect.hoho_ink.label': 'HOHO Ink',
  'typography.effect.hoho_ink.description':
    'Azul oscuro con goteo vertical y textura seca.',
  'typography.effect.blam_impact.label': 'BLAM Impact',
  'typography.effect.blam_impact.description':
    'Explosión amarilla con sombra roja desplazada.',
  'typography.effect.badump_soft.label': 'BADUMP Soft',
  'typography.effect.badump_soft.description':
    'Degradado pastel rosa suave con aura romántica.',
  'typography.effect.thump_heavy.label': 'THUMP Heavy',
  'typography.effect.thump_heavy.description':
    'Impacto negro con sombra color vino fuerte y angular.',
  'typography.effect.neon_woah.label': 'WOAH Neon',
  'typography.effect.neon_woah.description':
    'Texto blanco con brillo rosa intenso de sorpresa/brillantez.',
  'typography.effect.slash_speed.label': 'SLAP Speed Slash',
  'typography.effect.slash_speed.description':
    'Tipografía oscura con trazo diagonal agresivo/desenfoque de movimiento.',
  'typography.effect.ah_teal.label': 'Ah Teal',
  'typography.effect.ah_teal.description':
    'Aqua/teal con contorno oscuro y sensación suave de habla gentil.',
  'typography.effect.drip_blue.label': 'DRIP Blue',
  'typography.effect.drip_blue.description':
    'Azul claro con sensación líquida y efecto de goteo.',
  'typography.effect.question_pop.label': 'Question Pop',
  'typography.effect.question_pop.description':
    'Signo de puntuación cálido con sombra coral desplazada.',
  'typography.effect.laugh_curve.label': 'Laugh Curve',
  'typography.effect.laugh_curve.description':
    'Cian brillante para una risa arqueada y ligera.',
  'typography.effect.shake_blur.label': 'Shake Blur',
  'typography.effect.shake_blur.description':
    'Púrpura oscuro con vibración/desenfoque de movimiento para temblor.',
  'typography.effect.beep_outline.label': 'Beep Outline',
  'typography.effect.beep_outline.description':
    'Texto blanco con contorno negro grueso para SFX limpio y legible.',
  'typography.effect.boom_comic.label': 'BOOM Comic',
  'typography.effect.boom_comic.description':
    'Explosión amarillo/rojo de estilo cómic clásico.',
  'typography.effect.bang_chunk.label': 'BANG Chunk',
  'typography.effect.bang_chunk.description':
    'Bloque púrpura/azul con sombra dorada gruesa desplazada.',
  'typography.effect.break_glitch.label': 'BREAK Glitch',
  'typography.effect.break_glitch.description':
    'Magenta oscuro con textura de glitch/escaneo roto.',
  'typography.effect.flinch_outline.label': 'FLINCH Outline',
  'typography.effect.flinch_outline.description':
    'Negro con contorno blanco agresivo para reacción instantánea.',
  'typography.effect.growl_moss.label': 'Growl Moss',
  'typography.effect.growl_moss.description':
    'Verde oliva seco para un sonido ronco/animal.',
  'typography.effect.yawn_soft.label': 'Yawn Soft',
  'typography.effect.yawn_soft.description':
    'Verde lima con contorno púrpura para un habla perezosa/estirada.',
  'typography.effect.scratch_noise.label': 'Scratch Noise',
  'typography.effect.scratch_noise.description':
    'Negro áspero con apariencia granulada/ruidosa.',
  'typography.effect.crack_ink.label': 'Crack Ink',
  'typography.effect.crack_ink.description':
    'Pincel negro seco y afilado para un impacto repentino.',
  'typography.effect.slap_scratch.label': 'Slap Scratch',
  'typography.effect.slap_scratch.description':
    'Garabato delgado y arrastrado para efecto de raspón/golpe rápido.',
  'typography.effect.dash_edge.label': 'Dash Edge',
  'typography.effect.dash_edge.description':
    'Verde oscuro con puntas afiladas para un corte/entrada repentina.',
  'typography.effect.scream_scratch.label': 'Scream Scratch',
  'typography.effect.scream_scratch.description':
    'Grito negro con desplazamiento rojo áspero.',
  'model.opus-mt-ja-en.description':
    'Pipeline OPUS-MT optimizado para contenido japonés, con traducción al inglés y un flujo secundario para portugués.',
  'model.nllb-200-600m-int8.description':
    'Modelo multilingüe NLLB cuantizado a int8 para reducir el uso de memoria manteniendo buena calidad para KO→EN/PT.',
  'model.opus-mt-zh-en.description':
    'Modelo OPUS-MT para chino con traducción principal al inglés y un flujo secundario para portugués.',
  'model.nllb-200-1.3b.description':
    'Modelo multilingüe de mayor calidad para traducción general con amplia cobertura de idiomas.',
  'model.nllb-200-1.3b-int8-ct2.description':
    'Versión cuantizada CTranslate2 de NLLB 1.3B, reduce VRAM con excelente relación calidad-precio.',
  'model.nllb-200-3.3b.description':
    'Modelo NLLB de alta capacidad para máxima calidad en múltiples idiomas.',
  'model.sugoi_v4_ja_en_ct2.description':
    'Traductor local japonés→inglés con CTranslate2 y SentencePiece, compatible con el flujo offline de BallonsTranslator.',
  'model.m2m100_1_2b_ct2.description':
    'Traductor multilingüe local vía CTranslate2, con amplia cobertura de idiomas y compatibilidad con el flujo offline de BallonsTranslator.',
  'model.font_rtdetr_v2.description':
    'Modelo local para detección de regiones de texto en el pipeline AIO.',
  'model.comic_text_detector.description':
    'Detector local basado en el módulo CTD de BallonsTranslator para cuadros de texto en páginas de manga.',
  'model.manga_ocr.description': 'Modelo local de OCR para japonés en AIO.',
  'model.meiki_ocr.description':
    'OCR local japonés especializado en texto renderizado, con modelos ONNX horizontal y vertical.',
  'model.paddleocr_vl_manga.description':
    'OCR VLM local especializado en manga japonés.',
  'model.got_ocr2.description':
    'OCR multimodal local vía GOT-OCR 2.0 con runtime de transformers nativo.',
  'model.qwen2_5_vl_3b.description':
    'OCR multimodal local vía Qwen2.5-VL-3B-Instruct.',
  'model.mangalmm.description':
    'OCR/comprensión multimodal especializado en manga basado en Qwen2.5-VL.',
  'model.rolmocr.description':
    'OCR local robusto basado en Qwen2.5-VL con optimización para lectura de documentos.',
  'model.glm_ocr_onnx.description':
    'OCR local GLM enfocado en diseños complejos con runtime de transformers nativo.',
  'model.paddleocr.description':
    'Modelo local de OCR para idiomas rusos/eslavos en el pipeline AIO.',
  'model.paddleocr_latin_v5.description':
    'Modelo local de OCR para idiomas latinos (incluye neerlandés) en el pipeline AIO.',
  'model.paddleocr_ch_v5.description':
    'Modelo local de OCR para chino en el pipeline AIO.',
  'model.paddleocr_en_v5.description':
    'Modelo local de OCR enfocado en inglés para el pipeline AIO.',
  'model.easyocr.description':
    'OCR local multi-idioma con instalación bajo demanda en el directorio de modelos de la app.',
  'model.pororo.description':
    'Modelo local de OCR para coreano en el pipeline AIO.',
  'model.baka_content_cc.description':
    'Modelo local para segmentación/refinamiento de regiones de texto en AIO.',
  'model.aot.description':
    'Modelo local de inpainting para limpieza de globos en AIO.',
  'model.lama_manga.description':
    'Modelo local de inpainting contextual para áreas complejas en AIO.',
  'model.opencv_lama.description':
    'Modelo local ligero de inpainting vía OpenCV Zoo, diseñado para CPU y ejecución rápida.',
  'model.lama_fp32.description':
    'Puerto ONNX recomendado de big-lama a 512x512, adecuado para CPU/GPU equilibrando calidad y simplicidad.',
  'model.vntl_llama3_8b_v2.description':
    'Fine-tune de LLaMA3 para VN japonés → inglés. Dataset multi-línea reconstruido. Usar temp 0. (~5.7-8.5GB GGUF).',
  'model.lfm2_350m_enjp_mt.description':
    'Traductor ultraligero bidireccional JA↔EN, 0.4B parámetros. Q4_0 con solo 219MB — ideal para CPU y dispositivos de borde.',
  'model.sakura_galtransl_7b_v3_7.description':
    'Traductor JA→ZH-CN optimizado para novelas visuales. Preserva saltos de línea, caracteres de control y ruby. CC-BY-NC-SA 4.0 (~4.25GB IQ4_XS).',
  'model.sakura_1_5b_qwen2_5_v1_0.description':
    'Alternativa ligera a Sakura 7B con cuantización IMatrix. ~1GB Q5KS. Ideal para GPUs de gama media o CPU (~4GB RAM).',
  'model.hunyuan_7b_mt_v1_0.description':
    'Traductor multilingüe de Tencent — 1er lugar WMT25. 33 idiomas bidireccional. Prompt: "Translate into <idioma_destino>." (~4.2GB Q4_K_M).',
  'model.pp_doclayout_v3.description':
    'Modelo local de detección de diseño y texto basado en PP-DocLayout V3. Alta precisión para análisis de diseño de página.',
  'model.paddleocr_vl_1_5.description':
    'Modelo VLM OCR multilingüe de alta calidad (PaddleOCR-VL 1.5). Hasta 128 tokens por bloque de texto.',
  'model.waifu2x_swin_unet_art_scan_2x.description':
    'Mejor opción local para páginas de manga/manhwa enfocada en trazos y globos.',
  'model.waifu2x_swin_unet_art_scan_4x.description':
    'Variante 4x para páginas escaneadas de manga/manhwa.',
  'model.waifu2x_swin_unet_art_2x.description':
    'Modelo 2x para arte digital/anime limpio.',
  'model.4xnomos2_hq_mosr.description':
    'Escalador ONNX 4x de alta calidad para material con degradación mínima.',
  'model.4xspankendata.description':
    'Modelo ONNX ligero como respaldo general 4x.',
  'model.2x_hfa2kcompact.description':
    'Candidato compatible solo vía importación manual de ONNX/conversión externa.',
  'model.2x_digitalfilm_superultracompact.description':
    'Candidato para importación manual de ONNX.',
  'model.2x_anifilm_compact.description':
    'Candidato para importación manual de ONNX.',
  'model.2xnomosuni_span_multijpg_ldl.description':
    'Candidato para importación manual de ONNX.',
  'model.realesrgan_x4plus.description':
    'Candidato para importación manual de ONNX.',
  'model.4xhfa2kludvaeswinir_light.description':
    'Candidato para importación manual de ONNX.',
  'splitter.status.recipeApplied':
    'Receta del Divisor aplicada a la imagen activa.',
  'splitter.status.recipeRestored':
    'Receta del Divisor restaurada a valores predeterminados.',
  'splitter.status.exportCancelled':
    'Exportación del Divisor cancelada por el usuario.',
  'splitter.error.noSegmentsActive':
    'No se generaron segmentos válidos para la imagen activa.',
  'splitter.error.noSegmentsBatch':
    'No se generaron segmentos válidos en el lote del Divisor.',
  'aioExec.sessionUnavailable': 'Sesión no disponible para usar modelos en la nube. Inicia sesión de nuevo.',
  'aioManual.progressionNotInitialized':
    'Progresión manual no inicializada para la imagen activa.',
  'cleanerActions.selectValidOcrModel':
    'Selecciona un modelo de OCR válido para el Limpiador.',
  'cleanerActions.invalidCleanResponseNamed':
    'Respuesta de limpieza no válida para "{name}".',
  'customLlm.selectTranslationProfile':
    'Selecciona un perfil de traducción personalizado guardado para usar.',
  'customLlm.selectOcrProfile':
    'Selecciona un perfil de OCR personalizado guardado para usar.',
  'customLlm.profileNotFound':
    'Perfil personalizado no encontrado. Recarga e intenta de nuevo.',
  'customLlm.translationProfileActive':
    'Perfil personalizado en uso (traducción): {label}.',
  'customLlm.ocrProfileActive': 'Perfil personalizado en uso (OCR): {label}.',
  'accountSync.confirmEmailSent':
    'Correo de confirmación enviado. Revisa tu bandeja de entrada.',
  'accountSync.confirmEmailFailed':
    'Error al enviar el correo de confirmación.',
  'downloadActions.noTranslatorResults':
    'No hay resultados del Traductor disponibles para descargar.',
  'enhanceActions.desktopOnly':
    'El mejorador local solo está disponible en la aplicación de escritorio.',
  'enhanceActions.selectModel': 'Selecciona un modelo de mejora compatible.',
  'enhanceActions.done': 'Mejora completada. Usa Descargar para guardar.',
  'freeProvider.stageNotSupported': 'El proveedor no admite esta etapa.',
  'freeProvider.activeForTranslation':
    'Proveedor {name} en uso para traducción.',
  'freeProvider.activeForOcr': 'Proveedor {name} en uso para OCR.',
  'freeProvider.activeForClean': 'Provider {name} en uso para limpieza.',
  'freeProvider.stageTranslation': 'Traducción',
  'freeProvider.stageOcr': 'OCR',
  'freeProvider.stageClean': 'Limpieza',
  'translatorRetranslate.targetNotFound':
    'Imagen objetivo no encontrada para re-traducción.',
  'translatorRetranslate.noTextAvailable':
    'No hay texto reconocido disponible para re-traducción.',
  'translatorText.done':
    'Traductor de texto completo. Usa copiar o descargar TXT.',
  'typographer.queueApplied':
    'Texto de la cola aplicado a la selección actual.',
  'typographer.queueAppliedMulti':
    'Texto de la cola aplicado a {{count}} globo(s).',
  'typographer.queueCleared': 'Cola del Tipógrafo limpiada.',
  'typographer.queueImported': 'Texto importado a la cola del Tipógrafo.',
  'aioManual.invalidCleanResponse': 'Respuesta no válida al limpiar la imagen.',
  'aioStage.lang.ko': 'Coreano',
  'aioStage.lang.ja': 'Japonés',
  'aioStage.lang.fr': 'Francés',
  'aioStage.lang.zh': 'Chino',
  'aioStage.lang.zh-CN': 'Chino simplificado',
  'aioStage.lang.zh-TW': 'Chino tradicional',
  'aioStage.lang.en': 'Inglés',
  'aioStage.lang.ru': 'Ruso',
  'aioStage.lang.de': 'Alemán',
  'aioStage.lang.nl': 'Neerlandés',
  'aioStage.lang.es': 'Español',
  'aioStage.lang.it': 'Italiano',
  'aioStage.lang.tr': 'Turco',
  'aioStage.lang.pl': 'Polaco',
  'aioStage.lang.pt': 'Portugués',
  'aioStage.lang.pt-BR': 'Portugués (BR)',
  'aioStage.lang.th': 'Tailandés',
  'aioStage.lang.vi': 'Vietnamita',
  'aioStage.lang.hu': 'Húngaro',
  'aioStage.lang.id': 'Indonesio',
  'aioStage.lang.fi': 'Finés',
  'aioStage.lang.ar': 'Árabe',
  'splitter.warning.noIntermediateCuts':
    'No se encontraron cortes intermedios.',
  'splitter.warning.segmentTooSmall':
    'Un segmento es menor que la altura mínima configurada.',
  'splitter.warning.segmentTooLarge':
    'Un segmento es mayor que la altura máxima configurada.',
  'splitter.warning.cutsNearContent':
    'Algunos cortes están cerca de áreas con contenido.',
  'splitter.warning.nearEdge': 'Demasiado cerca del borde.',
  'stitch.warning.dimensionTooHigh':
    'La dimensión es demasiado alta; exporta en más lotes para evitar fallos.',
  'stitch.warning.outputTooHeavy':
    'La salida es demasiado pesada para revisión y descarga.',
  'stitch.warning.canvasLimit':
    'Puede exceder los límites seguros del canvas en algunos entornos.',
  'stitch.warning.largeBatch':
    'Lote grande; verifica si la división sigue siendo cómoda para scanlation.',
  'resources.data.fontsTitle': 'Fuentes para tipografía',
  'resources.data.fontsDesc':
    'Colección curada de fuentes populares para scanlation de manga, manhwa y manhua.',
  'resources.data.onomatopoeiaDesc':
    'Biblioteca de onomatopeyas japonesas con traducciones y ejemplos de uso.',
  'resources.data.glossaryTitle': 'Glosario de scanlation',
  'resources.data.glossaryDesc':
    'Términos técnicos y jerga de la comunidad del mundo del scanlation.',
  'resources.data.catalogLabel': 'Catálogo',
  'aioLocalBatch.invalidBatchResponse':
    'Respuesta de lote no válida: batch_report.json falta en el ZIP.',
  'modelDownload.desktopOnly':
    'La gestión de modelos solo está disponible en la aplicación de escritorio.',
  'settings.updates.channelBeta': 'Beta',
  'settings.updates.channelStable': 'Estable',
  'settings.presets.aio.defaultName': 'Preajuste',
  'settings.integrations.blogger.term.googleCloudConsole':
    'Google Cloud Console',
  'settings.integrations.blogger.term.bloggerApiV3': 'Blogger API v3',
  'settings.integrations.blogger.term.googleDriveApi': 'Google Drive API',
  'settings.integrations.blogger.term.oauthClientId': 'OAuth Client ID',
  'settings.integrations.blogger.term.clientId': 'Client ID',
  'settings.integrations.blogger.term.clientSecret': 'Client Secret',
  'settings.integrations.blogger.term.oauthPlayground': 'OAuth Playground',
  'settings.integrations.blogger.term.exchangeCodeForTokens':
    'Intercambiar código por tokens',
  'settings.integrations.blogger.term.refreshToken': 'Refresh Token',
  'settings.integrations.blogger.term.cloudName': 'cloud name',
  'settings.integrations.blogger.term.blogId': 'Blog ID',
  'settings.integrations.imgur.term.clientId': 'Client ID',
  'settings.integrations.imgur.term.rateLimit': '50 subidas/hora',
  'settings.shortcuts.topbarPath': 'Barra superior > Atajos',
  'login.warning.versionPrefix': 'v{version}',
  'password.policy.minLength':
    'La contraseña debe contener al menos 12 caracteres.',
  'password.policy.uppercase':
    'La contraseña debe contener al menos una letra mayúscula.',
  'password.policy.lowercase':
    'La contraseña debe contener al menos una letra minúscula.',
  'password.policy.number': 'La contraseña debe contener al menos un número.',
  'password.policy.special':
    'La contraseña debe contener al menos un carácter especial.',
  'auth.sfx.primary': '쾅',
  'auth.sfx.secondary': '휙',
  'auth.stats.activeScanlatorsValue': '2.4k+',
  'auth.stats.toolsValue': '50+',
  'auth.stats.pagesProcessedValue': '1M+',
  'auth.community.joinIndicator': '+',
  'resources.sfx.onomatopoeiaLabel': 'Onomatopeya',
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
  'settings.typographerLibrary.presetsCount_one': '{count} preajuste',
  'settings.typographerLibrary.presetsCount_other': '{count} preajustes',
  'renderPreview.iconUppercase': 'AA',
  'renderPreview.iconHorizontal': 'H',
  'renderPreview.iconVertical': 'V',
  'renderPreview.iconCircular': '◯',
  'guides.home.searchShortcut': '⌘K',
  'brand.name': 'KŌMA',
  'brand.studioSuffix': 'Studio',
  'versionBadge.stable': 'ESTABLE',
  'versionBadge.beta': 'BETA',
  'versionBadge.tooltip': 'Versión {version}',
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
  'update.units.perSecond': '/s',
  'update.versionPrefix': 'v{version}',
  'update.toast.newVersionFallback': 'nueva',
  'dashboard.status.cloudSuffix': '(Nube)',
  'dashboard.status.cloudApiSuffix': '(Nube/API/IA)',
  'dashboard.status.pendingCustomTranslationName':
    'IA personalizada (sincronizando...)',
  'dashboard.status.pendingCustomOcrName':
    'OCR personalizado (sincronizando...)',
  'modelManager.tooltip.gpu': 'GPU',
  'modelManager.tooltip.vram': 'VRAM',
  'modelManager.tooltip.ram': 'RAM',
  'dashboard.tour.preview.welcome.upload': 'Subir',
  'dashboard.tour.preview.welcome.export': 'Exportar',
  'dashboard.tour.preview.upload.formats':
    'JPG · PNG · WEBP · ZIP · PDF · CBZ · CB7 · PSD',
  'dashboard.tour.preview.stageEmpty': 'Carga imágenes para comenzar',
  'dashboard.tour.welcome.title': 'Bienvenido al Panel de KŌMA Studio',
  'dashboard.tour.welcome.body':
    'Este recorrido te guía por el flujo principal de la app: organizar páginas, elegir modos, configurar el pipeline AIO y exportar resultados sin tener que adivinar dónde está cada función.',
  'dashboard.tour.sidebar.title':
    'Barra lateral: cuota, archivos y contexto del lote',
  'dashboard.tour.sidebar.body':
    'Aquí sigues tu plan y uso mensual, eliges la imagen activa, reordenas páginas, eliminas elementos y mantienes el lote organizado antes de procesar.',
  'dashboard.tour.upload.title': 'Entrada inicial de archivos',
  'dashboard.tour.upload.body':
    'La zona de carga acepta imágenes sueltas y paquetes completos. Es el punto de partida para arrastrar capítulos, raws o recursos para alimentar el resto del panel.',
  'dashboard.tour.modes.title': 'Navegación principal del Panel',
  'dashboard.tour.modes.body':
    'Usa Organizar para preparar el lote y AIO para el pipeline completo. Los demás grupos de la barra superior abren modos especializados sin salir del espacio de trabajo.',
  'dashboard.tour.production.title': 'Producción: herramientas especializadas',
  'dashboard.tour.production.body':
    'Limpiador, Tipógrafo, Traductor, Raw y QC cubren el flujo manual y avanzado. Piensa en este grupo como los modos profesionales para trabajar en una etapa específica del capítulo.',
  'dashboard.tour.utils.title': 'Utilidades y soporte',
  'dashboard.tour.utils.body':
    'Unir, Dividir, Marca de agua y Mejorar manejan tareas rápidas de preparación y exportación. Guías y Recursos completan el área de soporte como referencia.',
  'dashboard.tour.submode.title': 'AIO automático vs. manual',
  'dashboard.tour.submode.body':
    'El automático ejecuta el pipeline completo en lote. El manual desbloquea cada etapa por imagen para revisión detallada, retroceso/avance y edición visual controlada.',
  'dashboard.tour.pipeline.title': 'Pipeline AIO',
  'dashboard.tour.pipeline.body':
    'Esta tarjeta controla la secuencia Detectar > OCR > Traducir > Segmentar > Limpiar > Renderizar. Puedes activar o desactivar etapas y, en modo manual, ejecutar solo la etapa actual.',
  'dashboard.tour.stageConfig.title': 'Configuración de etapas',
  'dashboard.tour.stageConfig.body':
    'Aquí encuentras idiomas, preajustes AIO, catálogos locales/nube y selección de modelo por etapa. Es el centro de decisiones para ajustar coste, calidad y velocidad.',
  'dashboard.tour.stage.withImagesTitle':
    'Espacio de trabajo y vista previa visual',
  'dashboard.tour.stage.withImagesBody':
    'Cuando hay imágenes, este escenario se convierte en la vista previa principal: navegas páginas, ves resultados por etapa y trabajas directamente en la imagen activa.',
  'dashboard.tour.stage.emptyTitle': 'Escenario central del Panel',
  'dashboard.tour.stage.emptyBody':
    'Sin imágenes, el escenario muestra un estado vacío simple. Después de subir, muestra vistas previas, overlays, regiones y resultados por modo.',
  'dashboard.tour.manualDock.title': 'Vista previa interactiva y dock manual',
  'dashboard.tour.manualDock.body':
    'Con una imagen activa en AIO manual, el dock flotante desbloquea selección de área, pincel, borrador, varita, corrección y ajustes contextuales sin salir de la vista previa.',
  'dashboard.tour.download.title': 'Exportación y descargas',
  'dashboard.tour.download.body':
    'Cuando la app tiene salidas listas, este menú reúne formatos de imagen, paquetes, PSDs con capas y opciones de metadatos para cerrar el flujo de entrega.',
  'dashboard.tour.replay.title': 'Si quieres repetir el recorrido después',
  'dashboard.tour.replay.body':
    'Abre el menú de usuario y usa <strong>Repetir recorrido</strong>. El onboarding automático se ejecuta solo en la primera visita de la versión actual, pero la repetición manual siempre está disponible.',
  'dashboard.tour.progressText': 'Paso {{current}} de {{total}}',
  'dashboard.tour.next': 'Siguiente',
  'dashboard.tour.prev': 'Anterior',
  'dashboard.tour.done': 'Finalizar recorrido',
  'dashboard.tour.dialogLabel': 'Recorrido del Panel',
  'dashboard.tour.close': 'Cerrar recorrido',
  'dashboard.tour.nextAria': 'Ir al siguiente paso',
  'dashboard.tour.prevAria': 'Volver al paso anterior',
  'modelManager.tooltip.rich.highlights': 'Destacados',
  'modelManager.tooltip.rich.unique': 'Diferencial',
  'modelManager.tooltip.rich.bestFor': 'Ideal para',
  'modelManager.tooltip.rich.performance': 'Rendimiento',
  'modelManager.tooltip.rich.notes': 'Notas',
  'modelManager.tooltip.docsUrl': 'Ver documentación',
  'modelManager.tooltip.notes': 'Notas',
  'modelManager.tooltip.highlights': 'Destacados',
  'modelManager.tooltip.bestFor': 'Ideal para',
  'modelManager.tooltip.unique': 'Diferencial',
  'modelManager.tooltip.performance': 'Rendimiento',

  'model.tooltip.opus-mt-ja-en.highlights':
    'Traduce japonés a inglés\nLigero y rápido, funciona bien sin tarjeta gráfica\nBuena opción para empezar',
  'model.tooltip.opus-mt-ja-en.unique':
    'Funciona bien para textos generales en japonés, pero no fue diseñado especialmente para manga',
  'model.tooltip.opus-mt-ja-en.bestFor':
    'Traducciones rápidas del japonés al inglés cuando no tienes una tarjeta gráfica potente',
  'model.tooltip.opus-mt-ja-en.performance':
    'Muy rápido, funciona en cualquier computadora sin necesidad de tarjeta gráfica',
  'model.tooltip.opus-mt-ja-en.notes':
    'Buena opción general, pero para manga y anime Sugoi da mejores resultados',

  'model.tooltip.nllb-200-600m-int8.highlights':
    'Traduce entre casi 200 idiomas\nVersión ligera y optimizada\nFunciona bien en cualquier computadora',
  'model.tooltip.nllb-200-600m-int8.unique':
    'Un solo modelo que traduce entre cientos de idiomas — ideal cuando necesitas versatilidad',
  'model.tooltip.nllb-200-600m-int8.bestFor':
    'Traducir entre idiomas menos comunes o cuando necesitas un modelo que funcione para todo',
  'model.tooltip.nllb-200-600m-int8.performance':
    'Rápido y ligero, funciona bien incluso en computadoras sin tarjeta gráfica',
  'model.tooltip.nllb-200-600m-int8.notes':
    'No fue diseñado para manga, pero funciona como traductor general para muchos idiomas',

  'model.tooltip.opus-mt-zh-en.highlights':
    'Traduce chino a inglés\nLigero y rápido\nFunciona sin tarjeta gráfica',
  'model.tooltip.opus-mt-zh-en.unique':
    'Enfocado en chino → inglés, bueno para manhua y contenido chino en general',
  'model.tooltip.opus-mt-zh-en.bestFor':
    'Traducir manhua y contenido chino al inglés de forma rápida',
  'model.tooltip.opus-mt-zh-en.performance':
    'Muy rápido, funciona en cualquier computadora sin tarjeta gráfica',
  'model.tooltip.opus-mt-zh-en.notes':
    'Popular y confiable para traducciones chino → inglés',

  'model.tooltip.nllb-200-1.3b.highlights':
    'Traduce entre casi 200 idiomas\nMejor calidad que la versión ligera\nBueno para idiomas menos comunes',
  'model.tooltip.nllb-200-1.3b.unique':
    'Versión intermedia con más calidad que la 600M, pero sin ser tan pesada como la 3.3B',
  'model.tooltip.nllb-200-1.3b.bestFor':
    'Cuando necesitas mejor calidad que la versión ligera, especialmente para idiomas poco comunes',
  'model.tooltip.nllb-200-1.3b.performance':
    'Necesita tarjeta gráfica con al menos 4 GB de memoria; velocidad razonable',
  'model.tooltip.nllb-200-1.3b.notes':
    'Buen equilibrio entre calidad y peso. No fue diseñado para manga.',

  'model.tooltip.nllb-200-1.3b-int8-ct2.highlights':
    'Traduce entre casi 200 idiomas\nVersión optimizada que usa menos memoria\nBuena calidad con menor consumo',
  'model.tooltip.nllb-200-1.3b-int8-ct2.unique':
    'Misma calidad que la versión 1.3B pero usando menos memoria — mejor relación calidad-precio',
  'model.tooltip.nllb-200-1.3b-int8-ct2.bestFor':
    'Traducción multilingüe con buena calidad sin necesitar una computadora muy potente',
  'model.tooltip.nllb-200-1.3b-int8-ct2.performance':
    'Funciona en CPU si es necesario; más ligero que la versión normal 1.3B',
  'model.tooltip.nllb-200-1.3b-int8-ct2.notes':
    'Versión optimizada del NLLB 1.3B — usa esta si quieres ahorrar memoria',

  'model.tooltip.nllb-200-3.3b.highlights':
    'Mejor calidad entre los traductores multilingües\nCasi 200 idiomas\nIdeal cuando la calidad importa más que la velocidad',
  'model.tooltip.nllb-200-3.3b.unique':
    'La versión más potente y precisa de la familia multilingüe — mejor traducción disponible para idiomas poco comunes',
  'model.tooltip.nllb-200-3.3b.bestFor':
    'Cuando la calidad de la traducción es más importante que la velocidad',
  'model.tooltip.nllb-200-3.3b.performance':
    'Necesita una buena tarjeta gráfica con al menos 8 GB de memoria; más lento que los otros',
  'model.tooltip.nllb-200-3.3b.notes':
    'Más pesado pero con mejor calidad. No fue diseñado para manga.',

  'model.tooltip.sugoi_v4_ja_en_ct2.highlights':
    'Traduce japonés a inglés\nDiseñado especialmente para manga y anime\nFunciona en cualquier computadora',
  'model.tooltip.sugoi_v4_ja_en_ct2.unique':
    'Entiende jerga, habla casual y expresiones típicas de manga y anime mejor que otros traductores',
  'model.tooltip.sugoi_v4_ja_en_ct2.bestFor':
    'Traducir manga y anime del japonés al inglés — es la opción más recomendada por la comunidad',
  'model.tooltip.sugoi_v4_ja_en_ct2.performance':
    'Muy rápido, funciona bien incluso sin tarjeta gráfica dedicada',
  'model.tooltip.sugoi_v4_ja_en_ct2.notes':
    'Usa este modelo como predeterminado para traducciones japonés → inglés',

  'model.tooltip.m2m100_1_2b_ct2.highlights':
    'Traduce entre 100 idiomas\nCubre coreano, tailandés, vietnamita y más\nVersión optimizada para mayor velocidad',
  'model.tooltip.m2m100_1_2b_ct2.unique':
    'Uno de los pocos modelos que traduce bien entre idiomas asiáticos como coreano, tailandés y vietnamita al inglés',
  'model.tooltip.m2m100_1_2b_ct2.bestFor':
    'Traducir manhwa coreano, manhua chino y contenido en otros idiomas asiáticos al inglés',
  'model.tooltip.m2m100_1_2b_ct2.performance':
    'Necesita tarjeta gráfica con 4-6 GB de memoria; buena velocidad con la versión optimizada',
  'model.tooltip.m2m100_1_2b_ct2.notes':
    'Buena opción para idiomas asiáticos que otros traductores no cubren bien',

  'model.tooltip.vntl_llama3_8b_v2.highlights':
    'Traduce japonés a inglés\nDiseñado para novelas visuales y manga\nMantiene los nombres de personajes consistentes',
  'model.tooltip.vntl_llama3_8b_v2.unique':
    'Entiende el contexto de la historia y mantiene consistencia en los nombres de personajes y términos a lo largo del texto',
  'model.tooltip.vntl_llama3_8b_v2.bestFor':
    'Traducir novelas visuales y manga con diálogos largos donde la consistencia de nombres importa',
  'model.tooltip.vntl_llama3_8b_v2.performance':
    'Necesita una buena tarjeta gráfica con 6-10 GB de memoria; más lento que traductores simples',
  'model.tooltip.vntl_llama3_8b_v2.notes':
    'Ideal para proyectos largos donde la consistencia de nombres y términos es importante',

  'model.tooltip.lfm2_350m_enjp_mt.highlights':
    'Traduce japonés ↔ inglés en ambas direcciones\nUltra ligero y rápido\nFunciona en cualquier computadora',
  'model.tooltip.lfm2_350m_enjp_mt.unique':
    'Uno de los traductores más pequeños disponibles — funciona hasta en computadoras débiles y aun así da resultados decentes',
  'model.tooltip.lfm2_350m_enjp_mt.bestFor':
    'Cuando necesitas una traducción rápida japonés-inglés y no tienes tarjeta gráfica potente',
  'model.tooltip.lfm2_350m_enjp_mt.performance':
    'Extremadamente rápido, funciona en cualquier computadora incluso sin tarjeta gráfica',
  'model.tooltip.lfm2_350m_enjp_mt.notes':
    'Calidad básica — bueno para borradores rápidos, pero no para el resultado final',

  'model.tooltip.sakura_galtransl_7b_v3_7.highlights':
    'Traduce japonés a chino\nEl mejor para galgames y manga\nMantiene formato y notas especiales',
  'model.tooltip.sakura_galtransl_7b_v3_7.unique':
    'Preserva formato especial, notas de lectura y saltos de línea — esencial para galgames y manga con texto complejo',
  'model.tooltip.sakura_galtransl_7b_v3_7.bestFor':
    'La mejor opción para traducir japonés a chino cuando la calidad es más importante que la velocidad',
  'model.tooltip.sakura_galtransl_7b_v3_7.performance':
    'Necesita tarjeta gráfica con al menos 6 GB de memoria; velocidad moderada',
  'model.tooltip.sakura_galtransl_7b_v3_7.notes':
    'Mejor traducción JP→ZH disponible. Úsalo cuando la calidad sea prioridad.',

  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.highlights':
    'Traduce japonés a chino\nVersión ligera y rápida\nBueno para computadoras menos potentes',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.unique':
    'Misma familia que el Sakura mayor, pero optimizado para funcionar en computadoras con menos memoria',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.bestFor':
    'Traducir japonés a chino cuando no tienes tarjeta gráfica potente',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.performance':
    'Rápido, necesita solo 1-2 GB de memoria en la tarjeta gráfica',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.notes':
    'Buena calidad para su tamaño — ideal si el modelo mayor es demasiado pesado',

  'model.tooltip.hunyuan_7b_mt_v1_0.highlights':
    'Traduce entre 36 idiomas\nAlta calidad premiada en competiciones\nUn modelo potente para muchos idiomas',
  'model.tooltip.hunyuan_7b_mt_v1_0.unique':
    'Uno de los traductores más premiados del mundo — combina múltiples traducciones para entregar el mejor resultado posible',
  'model.tooltip.hunyuan_7b_mt_v1_0.bestFor':
    'Cuando necesitas traducción de alta calidad entre muchos idiomas diferentes',
  'model.tooltip.hunyuan_7b_mt_v1_0.performance':
    'Necesita tarjeta gráfica con 6-8 GB de memoria; velocidad moderada',
  'model.tooltip.hunyuan_7b_mt_v1_0.notes':
    'Excelente para proyectos multilingües donde la calidad es prioridad',

  'model.tooltip.font_rtdetr_v2.highlights':
    'Detecta globos de diálogo y texto en cómics\nIdentifica texto dentro y fuera de los globos\nTodo en una sola pasada',
  'model.tooltip.font_rtdetr_v2.unique':
    'El único que detecta globos, texto dentro de los globos y texto suelto en la página al mismo tiempo',
  'model.tooltip.font_rtdetr_v2.bestFor':
    'Análisis completo de páginas de cómics — separa diálogos del texto suelto automáticamente',
  'model.tooltip.font_rtdetr_v2.performance':
    'Ligero y rápido, funciona bien en la mayoría de computadoras',
  'model.tooltip.font_rtdetr_v2.notes':
    'Entrenado con manga, webtoon, manhua y cómics occidentales',

  'model.tooltip.comic_text_detector.highlights':
    'Detecta texto en cómics y manga\nModelo original y confiable\nFunciona rápido en cualquier computadora',
  'model.tooltip.comic_text_detector.unique':
    'El detector clásico usado como base por muchos proyectos de traducción de manga',
  'model.tooltip.comic_text_detector.bestFor':
    'Detección básica y confiable de texto en cómics — buena opción predeterminada',
  'model.tooltip.comic_text_detector.performance':
    'Rápido, funciona bien sin tarjeta gráfica dedicada',
  'model.tooltip.comic_text_detector.notes':
    'Modelo clásico probado por la comunidad a lo largo de los años',

  'model.tooltip.pp_doclayout_v3.highlights':
    'Analiza el diseño de páginas escaneadas\nFunciona incluso con páginas torcidas o curvas\nIdentifica el orden correcto de lectura',
  'model.tooltip.pp_doclayout_v3.unique':
    'Puede entender páginas fotografiadas torcidas o escaneadas de forma irregular — algo que otros modelos no hacen',
  'model.tooltip.pp_doclayout_v3.bestFor':
    'Páginas escaneadas de forma imperfecta, fotos de libros o diseños complejos con orden de lectura difícil',
  'model.tooltip.pp_doclayout_v3.performance':
    'Robusto y confiable, funciona bien en diversas condiciones de iluminación',
  'model.tooltip.pp_doclayout_v3.notes':
    'Útil cuando las páginas no están perfectamente digitalizadas',

  'model.tooltip.manga_ocr.highlights':
    'Lee texto japonés en manga\nFunciona con texto vertical y horizontal\nEl más recomendado para manga japonés',
  'model.tooltip.manga_ocr.unique':
    'Diseñado especialmente para los desafíos del manga: texto vertical, furigana, fuentes estilizadas e imágenes de baja calidad',
  'model.tooltip.manga_ocr.bestFor':
    'La opción predeterminada para leer texto de manga japonés — funciona bien de entrada, sin ajustes',
  'model.tooltip.manga_ocr.performance':
    'Popular y confiable, usado por muchos proyectos de scanlation',
  'model.tooltip.manga_ocr.notes':
    'Mejor opción para manga japonés. Si necesitas velocidad, considera Meiki OCR.',

  'model.tooltip.meiki_ocr.highlights':
    'Lector de texto japonés ultra rápido\nDetecta cada carácter individualmente\nIdeal para texto horizontal',
  'model.tooltip.meiki_ocr.unique':
    'Mucho más rápido que otros lectores de texto japonés — perfecto cuando la velocidad es prioridad',
  'model.tooltip.meiki_ocr.bestFor':
    'Cuando necesitas leer texto japonés horizontal rápidamente',
  'model.tooltip.meiki_ocr.performance':
    'Extremadamente rápido, uno de los más veloces para japonés',
  'model.tooltip.meiki_ocr.notes':
    'Solo funciona con texto horizontal — para texto vertical usa Manga OCR',

  'model.tooltip.paddleocr_vl_manga.highlights':
    'Lector de texto optimizado para manga\nFunciona con texto vertical y horizontal\nMucho más preciso en manga que el modelo base',
  'model.tooltip.paddleocr_vl_manga.unique':
    'Entrenado específicamente con páginas de manga — entiende fuentes estilizadas y globos de diálogo mejor que lectores genéricos',
  'model.tooltip.paddleocr_vl_manga.bestFor':
    'Leer texto de manga con alta precisión, especialmente cuando el texto está en fuentes difíciles',
  'model.tooltip.paddleocr_vl_manga.performance':
    'Buena precisión en manga; también funciona con otros idiomas',
  'model.tooltip.paddleocr_vl_manga.notes':
    'Versión especializada de PaddleOCR para manga — excelente opción para scanlation',

  'model.tooltip.got_ocr2.highlights':
    'Lee texto de documentos, tablas y gráficos\nEntiende fórmulas matemáticas y partituras\nVersátil para varios tipos de documento',
  'model.tooltip.got_ocr2.unique':
    'Va más allá del texto simple — puede leer tablas, fórmulas y gráficos formateados',
  'model.tooltip.got_ocr2.bestFor':
    'Leer documentos complejos con tablas y formato — no es lo ideal para manga',
  'model.tooltip.got_ocr2.performance':
    'Ligero y versátil, funciona bien para documentos en general',
  'model.tooltip.got_ocr2.notes':
    'Multilingüe pero no optimizado para manga — usa otros modelos para cómics',

  'model.tooltip.qwen2_5_vl_3b.highlights':
    'Entiende imágenes de forma inteligente\nVa más allá de leer texto — comprende el contenido de la imagen\nMultilingüe y versátil',
  'model.tooltip.qwen2_5_vl_3b.unique':
    'No solo lee texto — entiende paneles de manga, describe escenas y extrae información organizada de la imagen',
  'model.tooltip.qwen2_5_vl_3b.bestFor':
    'Cuando necesitas que el modelo entienda el contenido de la imagen, no solo lea el texto',
  'model.tooltip.qwen2_5_vl_3b.performance':
    'Tamaño moderado; buena velocidad en tarjetas gráficas comunes',
  'model.tooltip.qwen2_5_vl_3b.notes':
    'Multilingüe. Útil para análisis de paneles y comprensión visual avanzada',

  'model.tooltip.mangalmm.highlights':
    'Entiende paneles de manga como un lector humano\nIdentifica personajes y elementos de la historia\nVa más allá de solo leer texto',
  'model.tooltip.mangalmm.unique':
    'El único modelo hecho específicamente para entender manga — reconoce personajes, paneles y narrativa visual',
  'model.tooltip.mangalmm.bestFor':
    'Análisis avanzado de manga: entender quién está hablando, qué está pasando en los paneles',
  'model.tooltip.mangalmm.performance':
    'Necesita tarjeta gráfica potente con 14 GB de memoria; aún en fase de investigación',
  'model.tooltip.mangalmm.notes':
    'Modelo experimental — prometedor para el futuro del scanlation pero aún no está maduro',

  'model.tooltip.rolmocr.highlights':
    'Lector de texto rápido para documentos\nFunciona bien con diseños complejos\nAlternativa más ligera y veloz',
  'model.tooltip.rolmocr.unique':
    'Más rápido y ligero que modelos similares, manteniendo buena calidad en la lectura de documentos',
  'model.tooltip.rolmocr.bestFor':
    'Leer documentos con diseños complejos cuando la velocidad es importante',
  'model.tooltip.rolmocr.performance':
    'Rápido y eficiente; buen equilibrio entre velocidad y calidad',
  'model.tooltip.rolmocr.notes':
    'No específico para manga — mejor para documentos y textos generales',

  'model.tooltip.glm_ocr_onnx.highlights':
    'Lector de texto compacto y preciso\nUno de los más precisos en benchmarks\nFunciona bien en computadoras menos potentes',
  'model.tooltip.glm_ocr_onnx.unique':
    'Combina alta precisión con tamaño pequeño — uno de los más precisos a pesar de ser ligero',
  'model.tooltip.glm_ocr_onnx.bestFor':
    'Leer documentos con alta precisión sin necesitar una computadora potente',
  'model.tooltip.glm_ocr_onnx.performance':
    'Muy ligero y rápido; funciona bien incluso en computadoras sin tarjeta gráfica potente',
  'model.tooltip.glm_ocr_onnx.notes':
    'Soporta varios idiomas pero el japonés es limitado. Excelente para documentos en general.',

  'model.tooltip.paddleocr.highlights':
    'Lee texto en ruso\nRápido y confiable\nBuena opción para manhwa en ruso',
  'model.tooltip.paddleocr.unique':
    'Optimizado específicamente para el alfabeto cirílico — mejor que lectores genéricos para ruso',
  'model.tooltip.paddleocr.bestFor': 'Leer texto ruso en cómics y manga',
  'model.tooltip.paddleocr.performance':
    'Muy rápido, funciona bien en la mayoría de computadoras',
  'model.tooltip.paddleocr.notes': 'La mejor opción para texto en ruso',

  'model.tooltip.paddleocr_latin_v5.highlights':
    'Lee texto en idiomas europeos\nFrancés, alemán, español, portugués y más\nRápido y confiable',
  'model.tooltip.paddleocr_latin_v5.unique':
    'Optimizado para alfabetos europeos — funciona mejor que lectores genéricos en estos idiomas',
  'model.tooltip.paddleocr_latin_v5.bestFor':
    'Leer texto en idiomas europeos como francés, alemán, español, italiano y portugués',
  'model.tooltip.paddleocr_latin_v5.performance':
    'Rápido y ligero, funciona bien en cualquier computadora',
  'model.tooltip.paddleocr_latin_v5.notes':
    'Mejor opción para idiomas europeos con alfabeto latino',

  'model.tooltip.paddleocr_ch_v5.highlights':
    'Lee texto en chino simplificado y tradicional\nRápido y preciso\nIdeal para manhua',
  'model.tooltip.paddleocr_ch_v5.unique':
    'Optimizado específicamente para caracteres chinos — reconoce mejor los trazos complejos y fuentes variadas',
  'model.tooltip.paddleocr_ch_v5.bestFor':
    'Leer texto de manhua y cualquier contenido en chino con alta precisión',
  'model.tooltip.paddleocr_ch_v5.performance':
    'Rápido y ligero, funciona bien en la mayoría de computadoras',
  'model.tooltip.paddleocr_ch_v5.notes':
    'La mejor opción para chino. Simple y eficiente.',

  'model.tooltip.paddleocr_en_v5.highlights':
    'Lee texto en inglés\nRápido y preciso\nIdeal para cómics occidentales',
  'model.tooltip.paddleocr_en_v5.unique':
    'Optimizado específicamente para inglés — reconoce mejor fuentes y estilos variados',
  'model.tooltip.paddleocr_en_v5.bestFor':
    'Leer texto en inglés de cómics occidentales y manga traducido',
  'model.tooltip.paddleocr_en_v5.performance':
    'Muy rápido y ligero, funciona en cualquier computadora',
  'model.tooltip.paddleocr_en_v5.notes': 'La mejor opción para texto en inglés',

  'model.tooltip.easyocr.highlights':
    'Lee texto en más de 80 idiomas\nFácil de usar y versátil\nVarios idiomas en la misma imagen',
  'model.tooltip.easyocr.unique':
    'Uno de los más versátiles — puede leer muchos idiomas diferentes en la misma imagen',
  'model.tooltip.easyocr.bestFor':
    'Cuando necesitas un lector que funcione para muchos idiomas sin cambiar de modelo',
  'model.tooltip.easyocr.performance':
    'Bueno para texto limpio; tiene dificultad con fuentes estilizadas y texto vertical',
  'model.tooltip.easyocr.notes':
    'No optimizado para manga. Útil como opción general multilingüe.',

  'model.tooltip.pororo.highlights':
    'Lee texto coreano\nIdeal para manhwa coreano\nLigero y confiable',
  'model.tooltip.pororo.unique':
    'Diseñado específicamente para el alfabeto coreano (Hangul) — reconoce mejor que lectores genéricos',
  'model.tooltip.pororo.bestFor':
    'Leer texto de manhwa coreano — la mejor opción dedicada para coreano',
  'model.tooltip.pororo.performance':
    'Buena precisión para coreano; ligero y rápido',
  'model.tooltip.pororo.notes':
    'Solo coreano e inglés. Mantenido por la comunidad.',

  'model.tooltip.paddleocr_vl_1_5.highlights':
    'Lector de texto avanzado multilingüe\nUno de los más precisos del mundo\nFunciona con japonés, chino, inglés y más',
  'model.tooltip.paddleocr_vl_1_5.unique':
    'Puede detectar texto en formatos irregulares y poligonales — lee texto curvo, inclinado y en posiciones difíciles',
  'model.tooltip.paddleocr_vl_1_5.bestFor':
    'Lectura de texto avanzada para documentos y cómics en varios idiomas',
  'model.tooltip.paddleocr_vl_1_5.performance':
    'Preciso y versátil; funciona bien en tarjetas gráficas comunes',
  'model.tooltip.paddleocr_vl_1_5.notes':
    'Multilingüe incluyendo japonés, chino, inglés. Base para el fine-tune de manga.',

  'model.tooltip.aot.highlights':
    'Elimina texto japonés del manga\nReconstruye el arte de fondo automáticamente\nRápido y eficiente',
  'model.tooltip.aot.unique':
    'Diseñado especialmente para eliminar texto de manga — entiende el estilo artístico y reconstruye el fondo de forma natural',
  'model.tooltip.aot.bestFor':
    'Eliminar texto japonés de paneles de manga reconstruyendo el arte de fondo',
  'model.tooltip.aot.performance':
    'Rápido, funciona bien con o sin tarjeta gráfica',
  'model.tooltip.aot.notes':
    'Buena opción predeterminada para limpieza de texto en manga',

  'model.tooltip.lama_manga.highlights':
    'Elimina texto de manga y anime\nFunciona con imágenes de cualquier tamaño\nManeja bien áreas grandes de texto',
  'model.tooltip.lama_manga.unique':
    'Sin límite de tamaño de imagen — funciona con páginas de cualquier resolución, a diferencia de otros modelos',
  'model.tooltip.lama_manga.bestFor':
    'Eliminar texto de páginas de manga de cualquier tamaño, especialmente bloques grandes de texto y globos',
  'model.tooltip.lama_manga.performance':
    'Acepta cualquier tamaño de imagen; buena velocidad en la mayoría de computadoras',
  'model.tooltip.lama_manga.notes':
    'Versión mejorada de LaMa — úsalo cuando la página sea grande o tenga mucho texto para eliminar',

  'model.tooltip.opencv_lama.highlights':
    'Elimina texto de imágenes\nVersión ligera y simple\nBueno para uso general',
  'model.tooltip.opencv_lama.unique':
    'Versión oficial mantenida por OpenCV — integración directa y confiable',
  'model.tooltip.opencv_lama.bestFor':
    'Eliminación de texto básica y rápida cuando no necesitas la máxima calidad',
  'model.tooltip.opencv_lama.performance':
    'Ligero y rápido, funciona en cualquier computadora',
  'model.tooltip.opencv_lama.notes':
    'Buena opción ligera para limpieza simple de texto',

  'model.tooltip.lama_fp32.highlights':
    'Elimina texto de imágenes con alta calidad\nMejor calidad entre los eliminadores\nIdeal cuando la calidad importa más que la velocidad',
  'model.tooltip.lama_fp32.unique':
    'La versión más fiel y precisa de LaMa — reproduce el fondo de forma más natural que las versiones ligeras',
  'model.tooltip.lama_fp32.bestFor':
    'Cuando la calidad de la limpieza es más importante que la velocidad',
  'model.tooltip.lama_fp32.performance':
    'Más lento que las versiones ligeras; necesita más memoria',
  'model.tooltip.lama_fp32.notes':
    'Úsalo cuando la calidad sea prioridad. Tamaño de entrada fijo.',

  'model.tooltip.waifu2x_swin_unet_art_scan_2x.highlights':
    'Mejora escaneos de anime en 2x\nElimina ruido y mejora la calidad\nIdeal para escaneos de manga',
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.unique':
    'El clásico para mejorar escaneos de anime y manga — elimina ruido y mejora la imagen al mismo tiempo',
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.bestFor':
    'Mejorar escaneos de manga de baja resolución y eliminar artefactos de compresión JPEG',
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.performance':
    'Ligero y rápido, funciona en cualquier computadora',
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.notes':
    'Buena opción predeterminada para mejorar escaneos de manga en 2x',

  'model.tooltip.waifu2x_swin_unet_art_scan_4x.highlights':
    'Mejora escaneos de anime en 4x\nElimina ruido y mejora la calidad\nPara cuando necesitas más detalle',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.unique':
    'Versión 4x del clásico Waifu2x — mejora mucho más la resolución manteniendo líneas limpias',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.bestFor':
    'Mejorar escaneos de manga con mayor aumento de resolución y preservar el line art limpio',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.performance':
    'Más lento que la versión 2x; ligero de todos modos',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.notes':
    'Úsalo cuando necesites más resolución de la que ofrece el 2x',

  'model.tooltip.waifu2x_swin_unet_art_2x.highlights':
    'Mejora arte de anime en 2x\nPara arte ya limpio y de buena calidad\nPreserva detalles finos',
  'model.tooltip.waifu2x_swin_unet_art_2x.unique':
    'Optimizado para arte que ya está limpio — preserva detalles finos sin añadir ruido',
  'model.tooltip.waifu2x_swin_unet_art_2x.bestFor':
    'Mejorar arte digital limpio y manga que ya tiene buena calidad de origen',
  'model.tooltip.waifu2x_swin_unet_art_2x.performance':
    'Ligero y rápido, funciona en cualquier computadora',
  'model.tooltip.waifu2x_swin_unet_art_2x.notes':
    'Menos agresivo que la versión para escaneos — úsalo cuando la imagen ya esté limpia',

  'model.tooltip.4xnomos2_hq_mosr.highlights':
    'Amplía imágenes en 4x con calidad máxima\nPreserva detalles finos y líneas nítidas\nIdeal para escaneos ya limpios',
  'model.tooltip.4xnomos2_hq_mosr.unique':
    'Enfocado en calidad — mantiene cada detalle de la imagen original intacto',
  'model.tooltip.4xnomos2_hq_mosr.bestFor':
    'Mejorar escaneos de manga que ya están limpios y con buena calidad',
  'model.tooltip.4xnomos2_hq_mosr.performance':
    'Buena velocidad; archivo pequeño de solo 16 MB',
  'model.tooltip.4xnomos2_hq_mosr.notes':
    'Funciona mejor con imágenes ya limpias. Si la imagen tiene ruido o compresión, límpiala antes.',

  'model.tooltip.4xspankendata.highlights':
    'Amplía imágenes en 4x de forma muy rápida\nArchivo diminuto de solo 1,6 MB\nFunciona bien incluso en computadoras menos potentes',
  'model.tooltip.4xspankendata.unique':
    'Extremadamente ligero — perfecto cuando necesitas velocidad sin ocupar espacio',
  'model.tooltip.4xspankendata.bestFor':
    'Upscale rápido de cualquier tipo de imagen cuando el tiempo es importante',
  'model.tooltip.4xspankendata.performance':
    'Muy rápido; archivo de solo 1,6 MB — ideal para CPU',
  'model.tooltip.4xspankendata.notes':
    'Sorprendentemente pequeño para la calidad que entrega. Excelente opción para procesamiento por lotes.',

  'model.tooltip.2x_hfa2kcompact.highlights':
    'Amplía imágenes en 2x con buen equilibrio\nEntrenado con fotogramas de anime moderno\nManeja bien la compresión y el desenfoque',
  'model.tooltip.2x_hfa2kcompact.unique':
    'Especialista en anime — entiende el estilo visual de animaciones modernas',
  'model.tooltip.2x_hfa2kcompact.bestFor':
    'Páginas de manga/anime con artefactos de compresión o calidad irregular',
  'model.tooltip.2x_hfa2kcompact.performance':
    'Rápido y ligero; archivo de solo 4,6 MB',
  'model.tooltip.2x_hfa2kcompact.notes':
    'Robusto para imágenes del mundo real — funciona bien incluso con escaneos imperfectos.',

  'model.tooltip.2x_digitalfilm_superultracompact.highlights':
    'Amplía imágenes en 2x con tamaño mínimo\nIdeal cuando el espacio en disco es limitado\nBuena calidad para su tamaño',
  'model.tooltip.2x_digitalfilm_superultracompact.unique':
    'Ultra compacto — cabe en cualquier lugar sin sacrificar calidad',
  'model.tooltip.2x_digitalfilm_superultracompact.bestFor':
    'Upscale ligero cuando necesitas ahorrar espacio o memoria',
  'model.tooltip.2x_digitalfilm_superultracompact.performance':
    'Rápido; ~20 MB; puede necesitar conversión manual',
  'model.tooltip.2x_digitalfilm_superultracompact.notes':
    'Si el archivo no carga, puede ser necesario convertir el formato externamente.',

  'model.tooltip.2x_anifilm_compact.highlights':
    'Amplía imágenes en 2x optimizado para anime\nBuen equilibrio entre calidad y tamaño\nEstilo visual preservado',
  'model.tooltip.2x_anifilm_compact.unique':
    'Entiende el estilo visual de anime y películas animadas — mantiene la estética original',
  'model.tooltip.2x_anifilm_compact.bestFor':
    'Contenido anime donde quieres mantener el aspecto original sin exageraciones',
  'model.tooltip.2x_anifilm_compact.performance':
    'Rápido; ~20 MB; puede necesitar conversión manual',
  'model.tooltip.2x_anifilm_compact.notes':
    'Si el archivo no carga, puede ser necesario convertir el formato externamente.',

  'model.tooltip.2xnomosuni_span_multijpg_ldl.highlights':
    'Amplía imágenes en 2x con resistencia a la compresión\nEntrenado para manejar diferentes niveles de calidad JPG\nRobusto para escaneos imperfectos',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.unique':
    'Especialista en manejar compresión JPG — funciona bien incluso con escaneos de baja calidad',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.bestFor':
    'Escaneos de manga con compresión JPG variada o artefactos de calidad',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.performance':
    'Rápido; ~20 MB; puede necesitar conversión manual',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.notes':
    'Si el archivo no carga, puede ser necesario convertir el formato externamente.',

  'model.tooltip.realesrgan_x4plus.highlights':
    'Amplía imágenes en 4x con alta versatilidad\nManeja bien JPEG, desenfoque y ruido\nFunciona con cualquier tipo de contenido',
  'model.tooltip.realesrgan_x4plus.unique':
    'El más versátil — entiende y corrige diversos tipos de degradación de imagen',
  'model.tooltip.realesrgan_x4plus.bestFor':
    'Páginas de manga con contenido mixto; artefactos JPEG; el upscaler más versátil',
  'model.tooltip.realesrgan_x4plus.performance':
    'Buena velocidad; un poco más pesado que los compactos',
  'model.tooltip.realesrgan_x4plus.notes':
    'Para anime/manga puro, prefiere la versión anime (6B) que es más rápida y optimizada.',

  'model.tooltip.4xhfa2kludvaeswinir_light.highlights':
    'Amplía imágenes en 4x optimizado para anime\nBuen equilibrio entre calidad y rendimiento\nPreserva el estilo visual de anime',
  'model.tooltip.4xhfa2kludvaeswinir_light.unique':
    'Combina calidad de upscale con atención a los detalles visuales del anime',
  'model.tooltip.4xhfa2kludvaeswinir_light.bestFor':
    'Upscale 4x de contenido anime con buena calidad de origen',
  'model.tooltip.4xhfa2kludvaeswinir_light.performance':
    'Velocidad moderada; ~70 MB; puede necesitar conversión manual',
  'model.tooltip.4xhfa2kludvaeswinir_light.notes':
    'Si el archivo no carga, puede ser necesario convertir el formato externamente.',

  'model.tooltip.baka_content_cc.highlights':
    'Separa texto de globos en páginas de cómics\nIdentifica qué es texto y qué es globo\nRápido y eficiente',
  'model.tooltip.baka_content_cc.unique':
    'Integrado con el sistema de detección de texto y globos — trabaja en conjunto con otros modelos',
  'model.tooltip.baka_content_cc.bestFor':
    'Separar texto y globos en páginas de manga para procesamiento posterior',
  'model.tooltip.baka_content_cc.performance':
    'Rápido y ligero, no necesita tarjeta gráfica potente',
  'model.tooltip.baka_content_cc.notes':
    'Usado como parte del pipeline de segmentación',
  'settings.tooltips.title': 'Consejos emergentes',
  'settings.tooltips.description':
    'Controla cuándo aparecen los consejos contextuales durante el uso del panel de control.',
  'settings.tooltips.enableTitle': 'Mostrar consejos contextuales',
  'settings.tooltips.enableDesc':
    'Muestra consejos animados la primera vez que usas cada herramienta por sesión.',
  'dashboard.hint.healing.ariaLabel': 'Consejo de la herramienta Healing',
  'dashboard.hint.healing.eyebrow': 'Nueva herramienta',
  'dashboard.hint.healing.body':
    'Usa el Healing Brush para eliminar defectos, bordes rotos y restos de texto. Pinta sobre el área que deseas corregir y haz clic en Aplicar para que la IA reconstruya la región de forma imperceptible.',
  'dashboard.hint.healing.footer':
    'Este consejo no volverá a aparecer en esta sesión. Desactiva todos los consejos en Configuración → App.',
  'dashboard.aio.presets.tooltip':
    'Los ajustes preestablecidos guardan una combinación por idioma de modelos y etapas. Úsalos para cambiar tu configuración de AIO más rápido al cambiar el idioma de origen o el flujo de trabajo.',
  'dashboard.aio.presets.tooltipAria':
    'Para qué se usan los ajustes preestablecidos de idioma',
  'dashboard.aio.cleanImage.tooltip':
    'Clean Image es la etapa de limpieza y restauración (inpainting). Elimina texto y artefactos seleccionados antes del paso final de renderizado/edición.',
  'dashboard.aio.cleanImage.tooltipAria': 'Para qué se usa Clean Image',
  'dashboard.aio.clean.maskDilation.tooltip':
    'Amplía la máscara de limpieza antes del inpainting. Auméntala si los bordes del texto permanecen; mantenla más baja para preservar el arte cercano.',
  'dashboard.aio.clean.maskDilation.tooltipAria':
    'Para qué se usa la dilatación de máscara',
  'dashboard.dashboardLlm.hdStrategy.tooltip':
    'Define cómo se preparan las imágenes grandes antes de la limpieza. Resize escala la página, Crop la divide en mosaicos y Original la envía tal cual.',
  'dashboard.dashboardLlm.hdStrategy.tooltipAria':
    'Para qué se usa la estrategia HD',
  'dashboard.dashboardLlm.cropMargin.tooltip':
    'Añade relleno adicional alrededor de cada mosaico de recorte. Auméntalo si los bordes pierden contexto o muestran costuras después de la limpieza.',
  'dashboard.dashboardLlm.cropMargin.tooltipAria':
    'Para qué se usa el margen de recorte',
  'dashboard.dashboardLlm.cropTriggerSize.tooltip':
    'Tamaño mínimo de imagen que activa la división en mosaicos. Las imágenes más pequeñas permanecen como una sola pieza; las más grandes se dividen en mosaicos.',
  'dashboard.dashboardLlm.cropTriggerSize.tooltipAria':
    'Para qué se usa el tamaño de activación del recorte',
  'common.basicInfo': "Información básica",
  'common.resolve': "Resolver",
  'common.dismiss': "Descartar",
  'common.title': "Título",
  'common.summary': "Resumen",
  'common.summaryPlaceholder': "Escribe un resumen breve y claro.",
  'common.mainDescription': "Descripción principal",
  'common.chapter': "Capítulo",
  'common.genres': "Géneros",
  'common.editorialDescription': "Descripción editorial",
  'common.removeValue': "Eliminar {value}",
  'settings.integrations.discordWebhook': "Webhook de Discord",
  'discord.presence.appName': "KŌMA Studio",
  'discord.presence.button.website': "Sitio web",
  'discord.presence.button.download': "Descargar",
  'discord.presence.idle.details': "Explorando herramientas de scanlation",
  'discord.presence.idle.state': "Inactivo",
  'discord.presence.workspace.details': "Organizando páginas y preparando el flujo",
  'discord.presence.aio.details': "Ejecutando el pipeline completo del manga",
  'discord.presence.mode.automatic': "Modo automático",
  'discord.presence.mode.manual': "Modo manual",
  'discord.presence.mode.basic': "Modo: Básico",
  'discord.presence.mode.advanced': "Modo: Avanzado",
  'discord.presence.cleaner.details': "Limpiando globos y restaurando el arte",
  'discord.presence.cleaner.state.basic': "Modo: Básico",
  'discord.presence.cleaner.state.advanced': "Modo: Avanzado",
  'discord.presence.translator.details': "Traduciendo diálogos sin perder el tono",
  'discord.presence.translator.fileDetails': "Traduciendo - {fileName}",
  'discord.presence.typesetter.details': "Colocando el texto final en la página",
  'discord.presence.typesetter.fileDetails': "Editando texto - {fileName}",
  'discord.presence.redraw.fileDetails': "Redibujando - {fileName}",
  'discord.presence.raw.details': "Probando proveedores y comparando salidas en bruto",
  'discord.presence.proofreader.details': "Revisando páginas antes del lanzamiento final",
  'discord.presence.stitch.details': "Uniendo paneles en páginas largas continuas",
  'discord.presence.split.details': "Separando dobles páginas en cortes limpios",
  'discord.presence.watermark.details': "Aplicando créditos e identidad a las páginas",
  'discord.presence.enhance.details': "Mejorando resolución y nitidez del arte",
  'discord.presence.optimizer.details': "Puliendo capítulos para exportación y entrega",
  'discord.presence.blogger.details': "Preparando publicaciones de capítulos y entrega por CDN",
  'discord.presence.imgur.details': "Subiendo lotes de imágenes y compartiendo enlaces",
  'discord.presence.guides.details': "Aprendiendo flujos, atajos y buenas prácticas",
  'discord.presence.resources.details': "Explorando recursos, referencias y material de apoyo",
  'discord.presence.batch.details': "Procesando páginas una tras otra",
  'discord.presence.batch.fileDetails': "Procesando lote - {fileName}",
  'discord.presence.batch.state': "{current}/{total} archivos",
  'discord.presence.batch.label': "Modo por lotes",
  'discord.presence.section.working': "Trabajando en {section}",
  'discord.presence.section.viewing': "Viendo {section}",
  'discord.presence.settings.details': "Ajustando las preferencias del estudio",
  'discord.presence.settings.label': "Configuración",
  'discord.presence.rankings.details': "Comparando calidad, velocidad y costo de modelos",
  'discord.presence.rankings.label': "Clasificaciones",
  'discord.presence.scanlationFeed.details': "Revisando lanzamientos y novedades de la comunidad",
  'discord.presence.scanlationFeed.label': "Feed de Scanlation",
  'discord.presence.loginRegister.details': "Iniciando sesión y gestionando el acceso a la cuenta",
  'discord.presence.loginRegister.label': "Iniciar sesión / Registrarse",
  'typographer.shapeApplied': "Forma aplicada.",
  'feed.tabsAria': "Secciones del Feed de Scanlation",
  'feed.actions.publishPost': "Publicar {type}",
} as const;
