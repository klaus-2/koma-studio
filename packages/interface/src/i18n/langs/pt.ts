import { TranslationCatalog } from '../messages';

export const ptMessages: TranslationCatalog = {
  'app.restricted.title': 'Acesso restrito',
  'app.restricted.description':
    'Esta versão está disponível apenas no aplicativo desktop oficial.',
  'app.restricted.publicDocs':
    'Documentos jurídicos continuam disponíveis publicamente:',
  'app.transition.loading': 'Carregando...',
  'app.transition.enterDashboard': 'Entrando no dashboard...',
  'app.transition.updateSession': 'Atualizando sessão...',
  'app.transition.openFeed': 'Abrindo Scanlation Feed...',
  'app.transition.openRankings': 'Abrindo ranking de modelos...',
  'app.transition.openSettings': 'Abrindo configurações...',
  'app.session.validating': 'Validando sessão...',
  'settings.tabs.general': 'Geral',
  'settings.tabs.presets': 'Presets',
  'settings.tabs.integrations': 'Integrações',
  'shortcutModal.title': 'Central de Atalhos',
  'shortcutModal.subtitle':
    'Atalhos globais disparam apenas no dashboard, nunca em campos de texto.',
  'shortcutModal.hotkeyHint': 'H para abrir',
  'shortcutModal.close': 'Fechar',
  'shortcutModal.instructionPrefix': 'Clique ',
  'shortcutModal.instructionRecord': 'Gravar',
  'shortcutModal.instructionSuffix':
    ', pressione a combinação desejada. Conflitos são detectados automaticamente.',
  'shortcutModal.searchPlaceholder': 'Buscar atalhos, ações ou teclas...',
  'shortcutModal.results_one': '{count} resultado',
  'shortcutModal.results_other': '{count} resultados',
  'shortcutModal.recording': 'Gravando…',
  'shortcutModal.record': 'Gravar',
  'shortcutModal.restoreDefault': 'Restaurar padrão',
  'shortcutModal.clearShortcut': 'Limpar atalho',
  'shortcutModal.conflict': 'Conflito: "{label}" ({combo})',
  'shortcutModal.fixedShortcuts': 'Atalhos contextuais fixos',
  'shortcutModal.fixed': 'Fixo',
  'shortcutModal.noResults': 'Nenhum atalho encontrado para "{query}".',
  'shortcutModal.restoreAll': 'Restaurar tudo',
  'toolbar.modelSelect.label': 'Modelo de Tradução',
  'toolbar.modelSelect.manage': 'Gerenciar Modelos',
  'toolbar.modelSelect.select': 'Selecione um modelo',
  'toolbar.modelSelect.groupLocal': '── Modelos Locais (instalados) ──',
  'toolbar.modelSelect.groupCloud': '── Cloud/API/AI ──',
  'toolbar.modelSelect.localPrefix': '[Local]',
  'toolbar.modelSelect.cloudPrefix': '[Cloud]',
  'toolbar.modelSelect.updateAvailable': '(Update disponível)',
  'toolbar.modelSelect.installedCount_one': '{count} modelo instalado',
  'toolbar.modelSelect.installedCount_other': '{count} modelos instalados',
  'toolbar.modelSelect.updates_one': '{count} update pendente',
  'toolbar.modelSelect.updates_other': '{count} updates pendentes',
  'toolbar.modelSelect.noUpdates': 'Sem updates pendentes',
  'toolbar.modelSelect.emptyState':
    'Nenhum modelo compatível com {source} → {target}.',
  'toolbar.modelSelect.incompatibleWarning':
    '"{model}" não suporta {source} → {target}. Selecione um modelo compatível ou altere o idioma de destino.',
  'settings.tabs.app': 'Aplicativo',
  'settings.backToDashboard': 'Voltar ao Dashboard',
  'settings.stats.version': 'versão',
  'settings.app.updater.status.idle': 'Aguardando',
  'settings.app.updater.status.checking': 'Verificando…',
  'settings.app.updater.status.available': 'Update disponível',
  'settings.app.updater.status.notAvailable': 'Atualizado',
  'settings.app.updater.status.downloading': 'Baixando…',
  'settings.app.updater.status.downloaded': 'Pronta p/ instalar',
  'settings.app.updater.status.error': 'Erro',
  'settings.app.updater.channel.stable': 'Stable (Recomendado)',
  'settings.app.updater.channel.beta': 'Beta (Novidades)',
  'settings.app.updater.channel.canary': 'Canary (Instável)',
  'settings.app.updater.version': 'Versão',
  'settings.app.updater.build': 'Build',
  'settings.app.updater.releaseNotes': 'Release Notes',
  'settings.app.updater.noNotes': 'Sem notas para esta versão.',
  'settings.app.updater.checkNow': 'Check for Updates',
  'settings.app.updater.installNow': 'Reiniciar e Atualizar',
  'settings.app.updater.desktopOnly': 'Disponível apenas no app desktop.',
  'settings.app.updater.autoCheck': 'Check automático',
  'settings.app.updater.autoCheckDesc': 'Verificar novas versões ao iniciar.',
  'settings.app.updater.channel': 'Canal de atualização',
  'settings.app.updater.channelDesc': 'Versões estáveis ou experimentais.',
  'settings.app.fonts.title': 'Fontes do Sistema',
  'settings.app.fonts.desc': 'Gerencie fontes para o Tipógrafo e renderização.',
  'settings.app.fonts.systemCount': '{count} fontes detectadas',
  'settings.app.fonts.customTitle': 'Fontes Customizadas',
  'settings.app.fonts.import': 'Importar .ttf / .otf',
  'settings.app.fonts.noCustom': 'Nenhuma fonte customizada importada.',
  'settings.app.fonts.importSuccess': 'Fonte {name} importada com sucesso.',
  'settings.app.fonts.importError': 'Falha ao importar fonte.',
  'settings.app.fonts.deleteConfirm': 'Deseja remover a fonte {name}?',
  'settings.app.autosave.title': 'Auto-save do Workspace',
  'settings.app.autosave.desc':
    'Salve automaticamente o progresso do projeto localmente.',
  'settings.app.autosave.enabled': 'Auto-save ativado',
  'settings.app.autosave.interval': 'Intervalo (minutos)',
  'settings.app.autosave.saveNow': 'Salvar configurações',
  'settings.app.autosave.success': 'Configurações de auto-save atualizadas.',
  'settings.app.autosave.error': 'Falha ao salvar configurações.',
  'settings.app.reset.title': 'Zona de Perigo',
  'settings.app.reset.desc':
    'Limpar dados locais e restaurar configurações padrão.',
  'settings.app.reset.button': 'Resetar Aplicativo',
  'settings.app.reset.confirm':
    'Isso irá deslogar sua conta e limpar todos os presets e caches locais. Deseja continuar?',
  'settings.app.reset.success': 'Aplicativo resetado. Reiniciando...',
  'settings.general.profile.title': 'Perfil',
  'settings.general.profile.desc':
    'Informações da sua conta e preferências globais.',
  'settings.general.profile.name': 'Nome de exibição',
  'settings.general.profile.email': 'E-mail principal',
  'settings.general.profile.verified': 'E-mail verificado',
  'settings.general.profile.unverified': 'E-mail pendente',
  'settings.general.profile.verifyBtn': 'Verificar agora',
  'settings.general.profile.sending': 'Enviando...',
  'settings.general.profile.verifySuccess': 'E-mail de verificação enviado.',
  'settings.general.profile.verifyError': 'Falha ao enviar e-mail.',
  'settings.general.profile.save': 'Salvar perfil',
  'settings.general.profile.success': 'Perfil atualizado com sucesso.',
  'settings.general.profile.error': 'Falha ao atualizar perfil.',
  'settings.general.travel.title': 'Travel Token',
  'settings.general.travel.desc':
    'Acesse sua conta Studio em outros dispositivos sem deslogar.',
  'settings.general.travel.active': 'Token ativo',
  'settings.general.travel.inactive': 'Nenhum token ativo',
  'settings.general.travel.generate': 'Gerar novo token',
  'settings.general.travel.generateDesc': 'Válido por {days} dias.',
  'settings.general.travel.copyAria': 'Copiar token',
  'settings.general.travel.revoke': 'Revogar todos',
  'settings.general.travel.revoked': 'Tokens revogados.',
  'settings.general.travel.success': 'Token gerado com sucesso.',
  'settings.general.travel.error': 'Falha ao processar token.',
  'settings.general.language.title': 'Interface',
  'settings.general.language.desc': 'Idioma e tema do aplicativo.',
  'settings.general.language.label': 'Idioma',
  'settings.general.language.system': 'Seguir sistema',
  'settings.general.theme.label': 'Tema',
  'settings.general.theme.dark': 'Escuro (Padrão)',
  'settings.general.theme.light': 'Claro',
  'settings.general.theme.amoled': 'OLED / Preto',
  'settings.presets.aio.title': 'Presets do AIO',
  'settings.presets.aio.desc':
    'Configure modelos padrão para cada etapa e idioma.',
  'settings.presets.aio.active': 'Preset ativo para {lang}',
  'settings.presets.aio.none': 'Nenhum preset configurado.',
  'settings.presets.aio.create': 'Novo Preset',
  'settings.presets.aio.edit': 'Editar Preset',
  'settings.presets.aio.delete': 'Remover Preset',
  'settings.presets.aio.name': 'Nome do preset',
  'settings.presets.aio.lang': 'Idioma de origem',
  'settings.presets.aio.models': 'Configuração de modelos',
  'settings.presets.aio.save': 'Salvar Preset',
  'settings.presets.aio.success': 'Preset salvo com sucesso.',
  'settings.presets.aio.error': 'Falha ao salvar preset.',
  'settings.presets.typo.title': 'Presets do Tipógrafo',
  'settings.presets.typo.desc':
    'Estilos de fonte, cores e balões pré-configurados.',
  'settings.presets.render.title': 'Estilos de Renderização',
  'settings.presets.render.desc':
    'Configure como o texto é desenhado na imagem final.',
  'settings.integrations.discord.title': 'Discord Webhook',
  'settings.integrations.discord.desc':
    'Notificações automáticas para seu servidor.',
  'settings.integrations.discord.url': 'URL do Webhook',
  'settings.integrations.discord.test': 'Testar Conexão',
  'settings.integrations.discord.events': 'Eventos gatilho',
  'settings.integrations.discord.success':
    'Configuração salva e teste enviado.',
  'settings.integrations.discord.error': 'Falha ao salvar ou testar webhook.',
  'settings.integrations.discord.invalidUrl': 'URL de webhook inválida.',
  'settings.integrations.blogger.successSecure':
    'Configuração do Blogger salva no armazenamento seguro do desktop.',
  'settings.integrations.blogger.successLocal':
    'Configuração do Blogger salva localmente.',
  'settings.integrations.blogger.saveError':
    'Falha ao salvar a configuração do Blogger.',
  'settings.integrations.blogger.testError':
    'Falha ao validar a conexão com o Blogger.',
  'settings.integrations.imgur.successSecure':
    'Configuração do Imgur salva no armazenamento seguro do desktop.',
  'settings.integrations.imgur.successLocal':
    'Configuração do Imgur salva localmente.',
  'settings.integrations.imgur.saveError':
    'Falha ao salvar a configuração do Imgur.',
  'settings.travel.blocked.notDesktop':
    'Disponível apenas no app desktop autenticado.',
  'settings.travel.blocked.noEmail':
    'Envio de email não configurado neste ambiente.',
  'settings.travel.blocked.validating': 'Validando configuração de email…',
  'settings.integrations.blogger.title': 'Blogger CDN',
  'settings.integrations.blogger.desc':
    'Hospedagem de imagens e publicação direta.',
  'settings.integrations.imgur.desc':
    'Rotação de Client IDs para upload anônimo.',
  'settings.theme.title': 'Aparência',
  'settings.theme.description':
    'Escolha entre modo escuro e claro para a interface.',
  'settings.theme.dark': 'Escuro',
  'settings.theme.darkDesc': 'Interface escura padrão',
  'settings.theme.light': 'Claro',
  'settings.theme.lightDesc': 'Interface clara',
  'settings.language.title': 'Idioma da interface',
  'settings.language.description':
    'Escolha o idioma do app. No desktop, a detecção inicial usa os idiomas preferidos do sistema.',
  'settings.language.label': 'Idioma',
  'settings.language.systemLabel': 'Sistema detectado',
  'settings.language.applied':
    'A alteração é aplicada imediatamente e salva neste dispositivo para dev e build empacotado.',
  'auth.tabs.login': 'Entrar',
  'auth.tabs.register': 'Criar conta',
  'auth.legal.reviewDocs': 'Ao continuar, revise nossa documentação jurídica:',
  'auth.quote.line1': 'Cada grande história',
  'auth.quote.line2': 'começa com',
  'auth.quote.line3': 'uma página.',
  'auth.stats.activeScanlators': 'Usuários ativos',
  'auth.stats.tools': 'Ferramentas',
  'auth.stats.pagesProcessed': 'Páginas processadas',
  'auth.toolkit.ai': 'IA & Automação',
  'auth.toolkit.tools': 'Ferramentas',
  'auth.toolkit.learning': 'Aprendizado',
  'auth.toolkit.aiTranslation': 'Tradução IA',
  'auth.toolkit.autoRedraw': 'Redraw Automático',
  'auth.toolkit.advancedEditor': 'Editor Avançado',
  'auth.toolkit.proTypesetting': 'Tipografia Pro',
  'auth.toolkit.qualityControl': 'Controle de Qualidade',
  'auth.toolkit.guides': 'Guias & Tutoriais',
  'auth.toolkit.resources': 'Recursos & Assets',
  'auth.community.join': 'Junte-se à comunidade',
  'auth.cover.popular': 'POPULAR',
  'auth.cover.new': 'NOVO',
  'auth.cover.cleanRedraw': 'Clean + Redraw',
  'auth.cover.translation': 'Tradução',
  'auth.cover.typography': 'Tipografia',
  'auth.cover.fullEditing': 'Edição Completa',
  'auth.cover.allInOne': 'AIO - Tudo em Um',
  'auth.cover.finalQc': 'Limpeza',
  'login.subtitle.credentials': 'Acesse sua conta e continue de onde parou.',
  'login.subtitle.travel':
    'Autorize temporariamente este computador sem sair do fluxo de login.',
  'login.error.completeCaptchaTravel':
    'Complete o captcha para concluir a autorização deste computador.',
  'login.error.completeCaptcha': 'Complete o captcha para continuar.',
  'login.error.missingCredentials':
    'Volte e informe email e senha da conta antes de autorizar este computador.',
  'login.error.missingTravelToken':
    'Digite o token recebido por email para concluir o login.',
  'login.error.generic': 'Falha no login',
  'login.warning.mandatoryUpdateTitle': 'Atualização obrigatória disponível',
  'login.warning.mandatoryUpdateBody':
    'Instale a versão {version} para continuar usando o app.',
  'login.warning.downloadUpdate': 'Baixar update',
  'login.warning.downloadingUpdate': 'Baixando update...',
  'login.warning.installUpdateNow': 'Instalar update agora',
  'login.verification.title': 'Como proceder',
  'login.verification.wait': 'Aguardar {seconds} segundos.',
  'login.verification.retrySameDevice':
    'Tentar login novamente no mesmo dispositivo ou rede.',
  'login.verification.avoidVpn': 'Evitar trocar VPN ou rede nesse intervalo.',
  'login.email': 'Email',
  'login.password': 'Senha',
  'login.forgotPassword': 'Esqueci minha senha',
  'login.rememberMe': 'Lembrar de mim neste dispositivo',
  'login.travel.eyebrow': 'Checkpoint de segurança',
  'login.travel.title': 'Este computador precisa de autorização temporária',
  'login.travel.copy':
    'Abra o KŌMA Studio no seu PC principal e vá em Configurações > Acesso em viagem para enviar o código e concluir este login.',
  'login.travel.accountInUse': 'Conta em uso: {email}',
  'login.travel.sameAccount': 'Use a mesma conta já aberta no PC principal.',
  'login.travel.emailDisabled':
    'O envio por email não está configurado neste ambiente.',
  'login.travel.emailEnabled':
    'O código será enviado para o email da conta principal.',
  'login.travel.step1': 'Acesse o app no computador principal.',
  'login.travel.step2': 'Envie o token para o email da conta.',
  'login.travel.step3': 'Cole o código abaixo para autorizar este computador.',
  'login.travel.tokenLabel': 'Token de viagem',
  'login.travel.tokenPlaceholder': 'Cole o código recebido por email',
  'login.button.authorizing': 'Autorizando...',
  'login.button.validating': 'Validando...',
  'login.button.updateRequired': 'Atualize o app para entrar',
  'login.button.retryIn': 'Tente novamente em {seconds}s',
  'login.button.authorizeComputer': 'Autorizar este computador',
  'login.button.login': 'Entrar na minha conta',
  'login.button.changeAccount': 'Voltar e trocar conta',
  'login.emailPlaceholder': 'seu@email.com',
  'login.passwordPlaceholder': '••••••••',
  'login.warning.latestVersion': 'mais recente',
  'login.newHere': 'Novo por aqui?',
  'login.createFreeAccount': 'Crie sua conta grátis',
  'register.subtitle':
    'Crie sua conta e comece a explorar milhares de títulos.',
  'register.error.passwordMismatch': 'As senhas não coincidem.',
  'register.error.completeCaptcha':
    'Complete o captcha para concluir o registro.',
  'register.error.acceptTerms':
    'Você precisa aceitar os Termos de Uso e a Política de Privacidade para criar a conta.',
  'register.error.generic': 'Falha no registro',
  'register.displayName': 'Nome de exibição',
  'register.displayNamePlaceholder': 'Como quer ser chamado?',
  'register.password': 'Senha',
  'register.passwordPlaceholder': 'Mínimo 8 caracteres',
  'register.confirmPassword': 'Confirmar senha',
  'register.confirmPasswordPlaceholder': 'Repita sua senha',
  'register.legalPrefix': 'Li e aceito os',
  'register.legalSuffix':
    'Entendo que o cadastro usa cookies estritamente necessários e que recursos como bug report e integrações seguem os documentos acima.',
  'register.button.creating': 'Criando conta...',
  'register.button.loginNow': 'Entrar agora',
  'legal.links.terms': 'Termos de Uso',
  'legal.links.privacy': 'Política de Privacidade',
  'legal.links.cookies': 'Política de Cookies',
  'legal.links.content': 'Avisos de Conteúdo',
  'transition.tips.loading': '読み込み中...',
  'transition.tips.preparing': 'Preparando seu estúdio...',
  'transition.tips.opening': 'Abrindo seu espaço de edição...',
  'transition.tips.organizing': 'Organizando seus painéis...',
  'transition.tips.warming': 'Aquecendo as ferramentas...',
  'transition.tips.workflow': 'Carregando seu fluxo de trabalho...',
  'transition.ariaLabel': 'Carregando pagina',
  'ranking.discover.title': 'Seja o primeiro a avaliar',
  'ranking.discover.subtitle': 'Modelos oficiais sem reviews no filtro atual.',
  'ranking.discover.available': '{count} disponíveis',
  'ranking.discover.empty': 'Todos os modelos filtrados já possuem reviews.',
  'ranking.discover.local': 'Local',
  'ranking.discover.cloud': 'Nuvem',
  'legalHub.version': 'Versão',
  'legalHub.updatedAt': 'Atualizado em',
  'register.button.create': 'Criar minha conta',
  'register.alreadyHaveAccount': 'Já possui conta?',
  'password.rule.minLength': 'Mínimo 8 caracteres',
  'password.rule.uppercase': 'Letra maiúscula',
  'password.rule.lowercase': 'Letra minúscula',
  'password.rule.number': 'Número',
  'password.rule.special': 'Caractere especial',
  'password.level.veryWeak': 'Muito fraca',
  'password.level.weak': 'Fraca',
  'password.level.fair': 'Razoável',
  'password.level.good': 'Boa',
  'password.level.strong': 'Forte',
  'captcha.loadError': 'Falha ao carregar script do Turnstile',
  'captcha.missingSiteKey':
    'Captcha habilitado, mas VITE_TURNSTILE_SITE_KEY não está configurada.',
  'captcha.initError': 'Falha ao inicializar captcha',
  'captcha.securityCheck': 'Verificação de segurança',
  'captcha.loadScriptError': 'Falha ao carregar script do Turnstile',
  'captcha.success': 'Captcha validado com sucesso.',
  'forgot.title': 'Recuperar senha',
  'forgot.subtitle': 'Informe seu email para receber o link de redefinição.',
  'forgot.success':
    'Se existir uma conta com este email, você receberá as instruções para redefinir a senha.',
  'forgot.error': 'Falha ao solicitar redefinição',
  'forgot.button.sending': 'Enviando...',
  'forgot.button.send': 'Enviar link de redefinição',
  'forgot.remembered': 'Lembrou sua senha?',
  'forgot.backToLogin': 'Voltar ao login',
  'reset.title': 'Nova senha',
  'reset.subtitle': 'Defina uma senha forte para sua conta.',
  'reset.error.missingToken': 'Token de redefinição ausente ou inválido.',
  'reset.error.generic': 'Falha ao redefinir senha',
  'reset.success': 'Senha redefinida com sucesso. Você já pode entrar.',
  'reset.newPassword': 'Nova senha',
  'reset.button.submitting': 'Redefinindo...',
  'reset.button.submit': 'Redefinir senha',
  'verify.title': 'Verificação de email',
  'verify.subtitle.pending':
    'Confirme seu email para liberar todas as funcionalidades.',
  'verify.subtitle.done': 'Seu email já está confirmado.',
  'verify.noEmail': 'sem-email',
  'verify.verified': 'Verificado',
  'verify.success':
    'Email de confirmação enviado. Verifique sua caixa de entrada.',
  'verify.error': 'Falha ao enviar email',
  'verify.button.sending': 'Enviando...',
  'verify.button.resend': 'Reenviar email de verificação',
  'verify.button.alreadyConfirmed': 'Email já confirmado',
  'verify.button.backDashboard': 'Voltar ao dashboard',
  'confirm.title.verifying': 'Confirmando email...',
  'confirm.title.success': 'Email confirmado!',
  'confirm.title.error': 'Falha na confirmação',
  'confirm.subtitle.verifying': 'Estamos validando seu link de confirmação.',
  'confirm.subtitle.success':
    'Seu email foi confirmado. Agora você pode usar todas as funcionalidades.',
  'confirm.subtitle.error':
    'O link de confirmação é inválido ou expirou. Solicite um novo email.',
  'confirm.status.wait': 'Aguarde enquanto verificamos...',
  'confirm.errorCode': 'Código de erro:',
  'confirm.success': 'Confirmação concluída com sucesso.',
  'confirm.goDashboard': 'Ir para o dashboard',
  'confirm.goLogin': 'Ir para login',
  'banned.title': 'Acesso bloqueado',
  'banned.subtitle':
    'Este acesso foi interrompido pela moderação do aplicativo.',
  'banned.reason': 'Motivo',
  'banned.scope': 'Escopo',
  'banned.duration': 'Duração',
  'banned.until': 'Temporário até {value}',
  'banned.undefinedDate': 'data indefinida',
  'banned.permanent': 'Permanente',
  'banned.policy':
    'Links, postagens maliciosas ou comportamento abusivo podem levar a banimento permanente do app.',
  'banned.backToLogin': 'Voltar ao login',
  'session.expiresIn': 'Sua sessão expira em {seconds}s por inatividade.',
  'session.stayConnected': 'Continuar conectado',
  'update.toast.availableTitle': 'Nova atualização disponível',
  'update.toast.availableDescription':
    'Versão {version} pronta para download no canal {channel}.',
  'update.toast.downloadedTitle': 'Atualização pronta',
  'update.toast.downloadedDescription':
    'Atualização pronta. {percent}% concluído. Instale agora ou ao fechar o app.',
  'update.toast.downloadingTitle': 'Baixando atualização',
  'update.toast.downloadingDescription': '{percent}% concluído.',
  'update.toast.closeAria': 'Fechar banner de atualização',
  'update.channel.beta': 'Beta',
  'update.channel.stable': 'Stable',
  'update.button.download': 'Baixar',
  'update.button.details': 'Detalhes',
  'update.button.installNow': 'Instalar agora',
  'update.button.installLater': 'Instalar depois',
  'update.progress.title': 'Baixando atualização...',
  'update.modal.title': 'Atualização disponível',
  'update.modal.unknownVersion': 'desconhecida',
  'update.modal.closeAria': 'Fechar modal',
  'update.modal.mandatory':
    'Esta atualização é obrigatória. Baixe e instale para continuar usando o aplicativo.',
  'update.modal.releaseNotes': 'Release Notes',
  'update.modal.releaseNotesEmpty':
    'Sem release notes disponíveis para esta versão.',
  'update.modal.readyProgress': 'Atualização pronta. 100% concluído.',
  'update.modal.downloadingProgress': 'Baixando atualização...',
  'update.modal.readyToInstall': 'Pronto para instalar',
  'update.modal.installHintAuto':
    'Se fechar o app agora, a instalação será iniciada automaticamente.',
  'update.modal.installHintManual':
    'Instalação ao fechar estava desativada. Use "Instalar depois" para ativar e fechar com segurança.',
  'update.modal.downloadAction': 'Baixar Atualização',
  'update.modal.downloadingAction': 'Baixando...',
  'update.modal.installAction': 'Instalar agora',
  'update.modal.installLaterAction': 'Instalar depois (ao fechar)',
  'update.modal.laterAction': 'Depois',
  'dropzone.invalidImageAlert': 'Envie um arquivo de imagem válido (PNG/JPG).',
  'dropzone.clickOrDrag': 'Clique ou arraste a imagem aqui',
  'dropzone.supports': 'Compatível com PNG e JPG',
  'actionButtons.cleaning': 'Limpando...',
  'actionButtons.cleanImage': 'Limpar imagem',
  'actionButtons.downloadResult': 'Baixar resultado',
  'aio.model.manage': 'Modelos',
  'aio.model.noneAvailable': 'Nenhum modelo disponível',
  'aio.model.device': 'Dispositivo',
  'aio.model.languages': 'Idiomas',
  'aio.model.languages.multi': 'multi',
  'aio.model.noDescription': 'Sem descrição.',
  'aio.model.localStatus': 'Status local: {value}',
  'aio.stage.detectText': 'Detectar Texto',
  'aio.stage.recognizeText': 'Reconhecer Texto',
  'aio.stage.getTranslations': 'Obter Traduções',
  'aio.stage.segmentText': 'Segmentar Texto',
  'aio.stage.cleanImage': 'Limpar Imagem',
  'aio.stage.tabsBarAria': 'Configuração por etapa',
  'aio.render.title': 'Texto Renderizado',
  'aio.render.description.manual':
    'Duplo clique na caixa para editar inline. A dock contextual aparece perto da seleção com texto renderizado.',
  'aio.render.description.auto':
    'Modo automático aplica render padrão nas regiões traduzidas.',
  'aio.render.activePage':
    'Página ativa: {count} bloco(s). Selecionada: {selected}.',
  'aio.render.contextualDock.visible': 'visível ao selecionar',
  'aio.render.contextualDock.doubleClick':
    'duplo clique para iniciar edição e exibir dock',
  'aio.render.contextualDock.select': 'selecione uma caixa para usar a dock',
  'aio.render.contextualDock': 'Dock contextual: {value}',
  'aio.render.shortcut':
    'Atalho: use Shift + Scroll no preview para rotacionar o texto da caixa selecionada.',
  'aio.render.inactiveStage':
    'Esta imagem está em etapa anterior ao Render. Use forward para visualizar/editar o texto renderizado.',
  'aio.render.fontCatalog': 'Catálogo de Fontes',
  'aio.render.refreshFonts': 'Atualizar Fontes',
  'aio.render.refreshingFonts': 'Atualizando...',
  'aio.render.importFont': 'Importar Fonte',
  'aio.render.importingFont': 'Importando...',
  'aio.render.importFontTitleDesktop':
    'Importar fonte personalizada para o app desktop',
  'aio.render.importFontTitleBrowser':
    'Importação disponível apenas no app desktop',
  'aio.render.desktopFontsHint':
    'Fontes instaladas do Windows e importação personalizada ficam disponíveis no app desktop.',
  'aio.render.overlayControlsHint':
    'Os controles de fonte, tamanho, alinhamento e cor agora ficam na dock contextual do overlay.',
  'aio.render.applyStyleAll': 'Aplicar Estilo Atual em Todas as Seleções',
  'aio.render.applyStyleAllTitle':
    'Aplicar o estilo da seleção atual em todas as seleções de todas as imagens',
  'aio.region.title': 'Regiões Detectadas',
  'aio.region.description.manual':
    'Arraste no preview para adicionar novas áreas. Arraste uma caixa para mover e use os cantos para redimensionar.',
  'aio.region.description.auto':
    'Troque para modo Manual para ajustar caixas detectadas.',
  'aio.region.activePage':
    'Página ativa: {count} região(ões). Selecionada: {selected}.',
  'aio.region.ocr': 'OCR da região selecionada: {value}',
  'aio.region.translation': 'Tradução da região selecionada: {value}',
  'aio.region.notes': 'Notas da região selecionada: {value}',
  'aio.region.segmentation': 'Segmentação da região selecionada: {value}',
  'aio.region.noSelection': 'nenhuma',
  'aio.region.noRecognizedText': 'sem texto reconhecido',
  'aio.region.ocrDisabled': 'etapa OCR desativada',
  'aio.region.noTranslation': 'sem tradução disponível',
  'aio.region.translationDisabled': 'etapa de tradução desativada',
  'aio.region.noNotes': 'sem notas disponíveis',
  'aio.region.notesDisabled': 'notas desativadas',
  'aio.region.noSelectedRegion': 'nenhuma região selecionada',
  'aio.region.segmentedBoxes': '{count} caixa(s) segmentada(s)',
  'aio.region.removeSelected': 'Remover Selecionada',
  'aio.region.duplicateSelected': 'Duplicar Selecionada',
  'aio.manual.toolsHintPrimary':
    'Use o dock flutuante no canvas para Selecionar Área, Limpar Página e editar segmentação/manual.',
  'aio.manual.toolsHintSecondary':
    'As ferramentas são habilitadas automaticamente conforme a etapa ativa da imagem.',
  'aio.run.manualNoActive':
    'Selecione uma imagem ativa para executar a etapa manual.',
  'aio.run.manualCurrentOnly':
    'Executar somente a etapa atual da imagem selecionada.',
  'aio.run.processing': 'Executando {percent}%',
  'aio.run.rerunCurrent': 'Reexecutar etapa atual (imagem ativa)',
  'aio.run.runCurrent': 'Executar etapa atual (imagem ativa)',
  'aio.run.full':
    'Executar AIO (Detectar + OCR + Traduzir + Segmentar + Limpar + Render)',
  'aio.pipeline.textModeTitle': 'Modo do Texto',
  'aio.pipeline.textModeDescription':
    'Defina como a região selecionada deve ser tratada no render. AUTO usa a classificação detectada.',
  'aio.pipeline.currentSelectionMode': 'Modo da Seleção Atual',
  'aio.pipeline.currentSelectionModeAria': 'Modo do texto da seleção atual',
  'aio.pipeline.autoResolved': 'AUTO resolve para {value}.',
  'aio.pipeline.currentMode': 'Modo atual: {value}.',
  'aio.pipeline.selectPreviewBox':
    'Selecione uma caixa no preview para alterar o modo do texto.',
  'aio.pipeline.title': 'Pipeline AIO',
  'aio.pipeline.description.auto':
    'Configure the full pipeline (detection, OCR, translation, segmentation, and cleaning) before running the batch.',
  'aio.pipeline.description.manual':
    'Modo manual: execute ou pule etapas em sequência para a imagem selecionada.',
  'aio.pipeline.render': 'Renderizar',
  'aio.pipeline.renderSubtitle': 'Aplicar texto traduzido na imagem final',
  'aio.pipeline.executeCurrentTitle':
    'Executar somente a etapa atual para a imagem selecionada',
  'aio.pipeline.executingStage': 'Executando etapa...',
  'aio.pipeline.rerunStage': 'Reexecutar etapa',
  'aio.pipeline.runStage': 'Executar etapa',
  'aio.pipeline.skipStage': 'Pular etapa',
  'aio.pipeline.skipStageTitle': 'Pular etapa atual e liberar a próxima',
  'aio.pipeline.rewind': 'Rewind',
  'aio.pipeline.rewindTitle': 'Voltar para a etapa anterior do pipeline AIO',
  'aio.pipeline.forward': 'Forward',
  'aio.pipeline.forwardTitle': 'Avançar para a próxima etapa do pipeline AIO',
  'aio.pipeline.manualImageStatus': 'Manual por imagem: "{image}" em {stage}.',
  'aio.pipeline.selectImageManual':
    'Selecione uma imagem para iniciar o fluxo manual por etapa.',
  'aio.pipeline.currentStage': 'Etapa atual: {label} ({current}/{total}).',
  'aio.pipeline.runToEnable':
    'Execute o AIO para habilitar rewind/forward por etapa.',
  'aio.pipeline.manualHint':
    'Torne o processo muito mais confiável: no modo manual, cada etapa que você realmente ajusta é executada com mais controle, revisão e precisão. Apenas a imagem selecionada é processada, e a quota só é consumida na primeira execução manual de cada imagem (ou zero se ela já tiver passado pelo AIO automático).',
  'dashboard.enhance.profile.mangaScan': 'Manga Scan',
  'dashboard.enhance.profile.animeArt': 'Anime Art',
  'dashboard.enhance.profile.general': 'Geral',
  'dashboard.enhance.profile.highQuality4x': 'Alta qualidade 4x',
  'dashboard.emptyTip.1':
    'Se uma imagem for muito grande e houver erros na limpeza, tradução ou redraw, tente dividir em partes menores. Isso costuma estabilizar o processamento.',
  'dashboard.emptyTip.2':
    'O modo automático acelera o fluxo, mas para resultado 100% caprichado vale revisar no modo manual e corrigir os detalhes finais.',
  'dashboard.emptyTip.3':
    'Use a ferramenta de refinar para deixar o texto mais bonito, equilibrado e dentro dos padrões de scanlation.',
  'dashboard.emptyTip.4':
    'Você pode alternar o shape dos balões entre rectangular e elliptic para encaixar melhor o texto em cada página.',
  'dashboard.emptyTip.5':
    'Configure presets na página de configurações para agilizar tarefas repetitivas e manter consistência entre capítulos.',
  'dashboard.emptyTip.6':
    'Teste modelos diferentes por idioma. O melhor OCR ou tradutor para japonês pode não ser o ideal para coreano, chinês ou inglês.',
  'dashboard.emptyTip.7':
    'Vote nos modelos que mais ajudam seu fluxo. Isso melhora o ranking e orienta outros usuários na escolha.',
  'dashboard.emptyTip.8': 'Se a tradução na nuvem estiver cara ou instável, ajuste os presets e mantenha um fallback local para não travar a produção.',
  'dashboard.emptyTip.9':
    'Use o Tradutor visual para revisar regiões específicas sem precisar rerodar o capítulo inteiro.',
  'dashboard.emptyTip.10':
    'No Tipógrafo, pequenos ajustes manuais de alinhamento, fonte e espaçamento fazem muita diferença no resultado final.',
  'dashboard.emptyTip.11':
    'Quando o texto sair apertado, reduza a quantidade de texto na caixa, refine a tradução ou ajuste o balão antes de diminuir demais a fonte.',
  'dashboard.emptyTip.12':
    'Se o OCR vier ruim, vale testar outro modelo antes de corrigir tudo na mão. Muitas vezes a troca do modelo resolve a maior parte dos erros.',
  'dashboard.emptyTip.13':
    'Use notas de tradução só quando realmente agregarem para o leitor. Menos ruído deixa a leitura mais limpa.',
  'dashboard.emptyTip.14':
    'Salve perfis custom de LLM e OCR para comparar setups rapidamente sem reconfigurar tudo a cada teste.',
  'dashboard.emptyTip.15':
    'Se uma página falhar no fluxo AIO, rode as etapas separadas em Produção para descobrir exatamente onde está o gargalo.',
  'dashboard.aio.progress.detectText': 'detectando texto',
  'dashboard.aio.progress.recognizeText': 'reconhecendo texto',
  'dashboard.aio.progress.getTranslations': 'traduzindo texto',
  'dashboard.aio.progress.segmentText': 'segmentando texto',
  'dashboard.aio.progress.cleanImage': 'limpando imagem',
  'dashboard.aio.progress.render': 'preparando render',
  'dashboard.aio.subtitle.detectText': 'Localizar áreas de texto na imagem',
  'dashboard.aio.subtitle.recognizeText': 'OCR para extrair o conteúdo textual',
  'dashboard.aio.subtitle.getTranslations':
    'Tradução automática por serviço/modelo selecionado',
  'dashboard.aio.subtitle.segmentText':
    'Refinar regiões com segmentação (estilo Baka)',
  'dashboard.aio.subtitle.cleanImage':
    'Inpainting com AOT/LaMa + máscara estilo Baka',
  'dashboard.aio.manualStatus.locked': 'Bloqueada',
  'dashboard.aio.manualStatus.pending': 'Pendente',
  'dashboard.aio.manualStatus.done': 'Concluída',
  'dashboard.aio.manualStatus.skipped': 'Pulada',
  'dashboard.mode.underDevelopment': 'Ainda está em desenvolvimento.',
  'dashboard.nav.group.main': 'Principal',
  'dashboard.nav.group.production': 'Produção',
  'dashboard.nav.group.utils': 'Utilitários',
  'dashboard.nav.group.info': 'Informações',
  'dashboard.nav.short.aio': 'AIO',
  'dashboard.nav.short.cleaner': 'Limpador/RD',
  'dashboard.nav.short.enhance': 'Melhorar',
  'dashboard.nav.subtitle.organize': 'Gerenciar arquivos',
  'dashboard.nav.subtitle.aio': 'Tudo em Um',
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
  'dashboard.nav.subtitle.guides': 'Tutoriais',
  'dashboard.nav.subtitle.resources': 'Materiais',
  'dashboard.nav.tooltip.organize':
    'Organize e reordene suas imagens antes do processamento',
  'dashboard.nav.tooltip.aio':
    'Pipeline completo: detectar, reconhecer, traduzir, segmentar, limpar e renderizar',
  'dashboard.nav.tooltip.cleaner': 'Limpar balões e redesenhar áreas da imagem',
  'dashboard.nav.tooltip.typesetter':
    'Aplicar tipografia e estilizar textos nas páginas',
  'dashboard.nav.tooltip.translator':
    'Traduzir texto livre ou revisar OCR/tradução por regiões em imagens',
  'dashboard.nav.tooltip.raw':
    'Gerenciar e fornecer imagens raw para o pipeline',
  'dashboard.nav.tooltip.proofreader':
    'Revisar traduções e verificar qualidade final',
  'dashboard.nav.tooltip.stitch': 'Unir múltiplas imagens em uma tira contínua',
  'dashboard.nav.tooltip.split': 'Dividir imagens longas em partes menores',
  'dashboard.nav.tooltip.watermark':
    "Adicionar marca d'água em lote nas imagens",
  'dashboard.nav.tooltip.enhance': 'Melhorar qualidade e resolução das imagens',
  'dashboard.nav.tooltip.optimizer':
    'Otimizar saídas finais para web, leitura ou arquivo',
  'dashboard.nav.tooltip.blogger':
    'Publicar posts no Blogger e gerar URLs hospedadas para imagens',
  'dashboard.nav.tooltip.imgur':
    'Enviar imagens para o Imgur com rotação de Client IDs',
  'dashboard.nav.tooltip.guides': 'Guias e tutoriais de uso da ferramenta',
  'dashboard.nav.tooltip.resources': 'Recursos, links e materiais de apoio',
  'dashboard.mode.organize': 'Organizar',
  'dashboard.mode.aio': 'AIO — Tudo em Um',
  'dashboard.mode.cleaner': 'Limpador / Redesenhador',
  'dashboard.mode.typesetter': 'Tipógrafo',
  'dashboard.mode.translator': 'Tradutor',
  'dashboard.mode.raw': 'Provedor Raw',
  'dashboard.mode.proofreader': 'Revisor / QC',
  'dashboard.mode.stitch': 'Costurar (Webtoon)',
  'dashboard.mode.split': 'Divisão Inteligente',
  'dashboard.mode.watermark': "Marca d'Água",
  'dashboard.mode.enhance': 'Melhorar Imagem',
  'dashboard.mode.optimizer': 'Chapter Optimizer',
  'dashboard.mode.blogger': 'Blogger CDN',
  'dashboard.mode.imgur': 'Imgur Upload',
  'dashboard.mode.guides': 'Guias & Tutoriais',
  'dashboard.mode.resources': 'Recursos & Materiais',
  'dashboard.status.modelSelected': 'Modelo selecionado para {stage}: {model}',
  'dashboard.status.verifyEmailRequired':
    'Confirme seu email para executar esta ação.',
  'dashboard.status.imagesCount': '{count} imagens',
  'dashboard.status.noImage': 'Sem imagem',
  'dashboard.status.freeText': 'texto-livre',
  'dashboard.user.defaultName': 'Usuário',
  'dashboard.topbar.thisTab': 'Esta aba',
  'dashboard.aio.config.title': 'Configuração das Etapas',
  'dashboard.footer.hardware.nvidia':
    'Aceleração NVIDIA de máxima performance.',
  'dashboard.footer.hardware.intel': 'Aceleração Intel dedicada em uso.',
  'dashboard.footer.hardware.cpu': 'Execução local sem aceleração dedicada.',
  'dashboard.footer.quickLinks': 'Links rápidos',
  'dashboard.footer.lastSave.never': 'Ainda não salvo nesta sessão',
  'dashboard.footer.lastSave.label': 'Último save: {time}',
  'dashboard.cleaner.flow.local.title':
    'Fluxo estruturado com OCR, segmentação e inpainting local',
  'dashboard.cleaner.flow.ai.title':
    'Limpeza automática com IA multimodal e reconstrução guiada',
  'dashboard.cleaner.flow.local.desc':
    'Usa o detector local para propor candidatos, classifica quais regiões são SFX reais e limpa somente as aprovadas.',
  'dashboard.cleaner.flow.ai.desc':
    'Usa detecção estrutural do projeto para orientar a IA, reforça a preservação de balões/arte e recompõe imagens grandes com junções mais suaves.',
  'dashboard.cleaner.instructions.placeholder':
    'Ex.: preserve melhor gradientes vermelhos, seja mais conservador em SFX pequenos, priorize não tocar nas caixas narrativas.',
  'dashboard.cleaner.instructions.hint.local':
    'Essas instruções entram como contexto complementar após as regras-base de classificação e limpeza SFX.',
  'dashboard.cleaner.instructions.hint.ai':
    'Essas instruções entram como contexto complementar. As regras centrais do cleaner AI continuam acima de qualquer instrução do usuário para não quebrar a lógica da limpeza.',
  'dashboard.cleaner.inspection.title': 'Inspeção',
  'dashboard.cleaner.segmentation.manage': 'Gerenciar modelos de segmentação',
  'dashboard.cleaner.segmentation.model': 'Modelo de segmentação',
  'dashboard.aio.gpuStages.title': 'Uso de GPU por Etapa',
  'dashboard.aio.gpuStages.hint':
    'Selecione quais etapas devem usar aceleração GPU. Desmarque para forçar execução em CPU (útil se a GPU não tem VRAM suficiente para todas as etapas).',
  'dashboard.aio.gpuStages.detect': 'Detecção de texto (GPU)',
  'dashboard.aio.gpuStages.ocr': 'OCR / Reconhecimento (GPU)',
  'dashboard.aio.gpuStages.segment': 'Segmentação (GPU)',
  'dashboard.aio.gpuStages.clean': 'Limpeza / Inpainting (GPU)',
  'dashboard.aio.gpuStages.noActiveProfile':
    'Nenhum perfil GPU ativo foi confirmado agora. Esta seção permanece visível para evitar sumiços intermitentes; os toggles voltam a ter efeito assim que um perfil GPU estiver disponível.',
  'dashboard.aio.config.loadingCatalogs': 'Carregando catálogos local e na nuvem...',
  'dashboard.aio.preparingManual': 'Preparando etapa manual do AIO...',
  'dashboard.aio.preparingAuto': 'Preparando execução automática do AIO...',
  'dashboard.aio.stopping': 'Interrompendo execução do AIO...',
  'dashboard.aio.abortedByUser': 'Execução do AIO interrompida pelo usuário.',
  'dashboard.aio.abortedMiniBackendRestarted':
    'Execução do AIO interrompida. Mini-backend reiniciado.',
  'dashboard.aio.abortedMiniBackendRestartFailed':
    'Execução do AIO interrompida. Não foi possível reiniciar o mini-backend automaticamente.',
  'dashboard.llm.customProfilesLoadFailed':
    'Falha ao carregar perfis custom de LLM.',
  'dashboard.status.ready': 'Pronto para processar imagens.',
  'dashboard.workspace.pendingChanges': 'Workspace com alterações pendentes.',
  'dashboard.status.restored': 'Workspace restaurado.',
  'dashboard.status.historyRestored': 'Alteração restaurada do histórico.',
  'dashboard.status.undo': 'Workspace desfeito.',
  'dashboard.status.redo': 'Workspace refeito.',
  'dashboard.status.saved': 'Workspace salvo localmente.',
  'dashboard.status.exportCancelled': 'Exportação de workspace cancelada.',
  'dashboard.status.exportSuccess': 'Workspace exportado com sucesso.',
  'dashboard.status.importCancelled': 'Importação de workspace cancelada.',
  'dashboard.status.importSuccess': 'Workspace importado com sucesso.',
  'dashboard.status.importSaved': 'Workspace importado e salvo localmente.',
  'dashboard.status.importNoAutosave':
    'Workspace importado. Autosave automático desativado.',
  'dashboard.status.autosaveRemoved': 'Autosave local removido.',
  'dashboard.status.nothingToUndo': 'Nada para desfazer no workspace.',
  'dashboard.status.nothingToRedo': 'Nada para refazer no workspace.',
  'dashboard.sections.pipeline': 'Pipeline',
  'dashboard.sections.languages': 'Idiomas',
  'dashboard.sections.modelsConfig': 'Modelos & Config',
  'dashboard.sections.presets': 'Presets',
  'dashboard.sections.region': 'Região',
  'dashboard.aio.rewind': 'AIO rewind: etapa "{label}" ({current}/{total}).',
  'dashboard.aio.forward': 'AIO forward: etapa "{label}" ({current}/{total}).',
  'dashboard.aio.rewindImage':
    'AIO rewind ({imageName}): etapa "{label}" ({current}/{total}).',
  'dashboard.aio.forwardImage':
    'AIO forward ({imageName}): etapa "{label}" ({current}/{total}).',
  'dashboard.llm.translation': 'Tradução',
  'dashboard.llm.ocr': 'OCR',
  'dashboard.aio.manualScope': 'AIO manual',
  'dashboard.aio.autoScope': 'AIO automático',
  'dashboard.aio.executing': 'Executando',
  'dashboard.cleaner.selectProfile':
    'Selecione um perfil visual já salvo para usar no Automatic AI Clean.',
  'dashboard.cleaner.profileNotFound':
    'Perfil visual não encontrado. Recarregue e tente novamente.',
  'dashboard.cleaner.profileInUse':
    'Perfil visual em uso no Automatic AI Clean: {label}.',
  'dashboard.cleaner.invalidModel':
    'Selecione um modelo válido para o Automatic AI Clean.',
  'dashboard.cleaner.modelRoadmap': 'O modelo "{name}" ainda está em roadmap.',
  'dashboard.cleaner.modelConfigRequired':
    'O modelo "{name}" requer configuração antes do uso.',
  'dashboard.translator.sfx.invalidModel':
    'Selecione um modelo válido para o AI SFX do Tradutor.',
  'dashboard.cleaner.profileSaved':
    'Perfil visual salvo e selecionado para o Automatic AI Clean: {label}.',
  'dashboard.cleaner.removeProfileSelect':
    'Selecione um perfil visual salvo para remover.',
  'dashboard.cleaner.customTitle': 'AI Custom (Automatic AI Clean)',
  'dashboard.cleaner.emptyLabel': 'Novo perfil visual',
  'dashboard.cleaner.namePlaceholder': 'Ex.: Gemini Image Clean',
  'dashboard.cleaner.modelPlaceholder': 'gemini-2.5-flash-image',
  'dashboard.cleaner.useLabel': 'Usar no Cleaner',
  'dashboard.cleaner.providerInUse':
    'Provider {name} em uso no Automatic AI Clean.',
  'dashboard.stage.detectText.label': 'Detectar Texto',
  'dashboard.stage.detectText.short': 'Detectar',
  'dashboard.stage.recognizeText.label': 'Reconhecer Texto',
  'dashboard.stage.recognizeText.short': 'OCR',
  'dashboard.stage.getTranslations.label': 'Obter Traduções',
  'dashboard.stage.getTranslations.short': 'Traduzir',
  'dashboard.stage.segmentText.label': 'Segmentar Texto',
  'dashboard.stage.segmentText.short': 'Segmentar',
  'dashboard.stage.cleanImage.label': 'Limpar Imagem',
  'dashboard.stage.cleanImage.short': 'Limpar',
  'dashboard.stage.render.label': 'Renderizar',
  'dashboard.stage.render.short': 'Render',
  'dashboard.aio.pipeline.detect.subtitle':
    'Localizar áreas de texto na imagem',
  'dashboard.aio.pipeline.ocr.subtitle': 'OCR para extrair o conteúdo textual',
  'dashboard.aio.pipeline.translate.subtitle':
    'Tradução automática por serviço/modelo',
  'dashboard.aio.pipeline.segment.subtitle': 'Refinar regiões com segmentação',
  'dashboard.aio.pipeline.clean.subtitle': 'Inpainting com AOT/LaMa + máscara',
  'dashboard.aio.pipeline.render.subtitle':
    'Aplicar texto traduzido na imagem final',
  'dashboard.aio.config.langHint':
    'Original → Detectar/OCR/Traduzir. Tradução → somente tradução.',
  'dashboard.aio.translation.localModelInfo':
    'Modelos locais são baixados sob demanda; cloud/API continuam por chave.',
  'dashboard.translator.sameModelHint':
    'O Tradutor usa a mesma seleção de modelo do AIO; execute novamente após trocar o modelo.',
  'dashboard.translator.incompatibleLocalModel':
    'O modelo local atual não suporta o par de idiomas do Tradutor. Escolha outro modelo ou use cloud.',
  'dashboard.status.modeChanged': 'Modo: {mode}',
  'dashboard.status.underDevelopment': '{mode}: {tooltip}',
  'dashboard.aio.render.hintRot': 'Atalho: ',
  'dashboard.aio.render.hintRotSuffix': ' para rotacionar.',
  'settings.typographerLibrary.noFolder': 'Sem pasta',
  'settings.profile.defaultUser': 'Usuário KŌMA',
  'register.email': 'Email',
  'register.emailPlaceholder': 'seu@email.com',
  'feed.sidebar.webhookPlaceholder': 'https://discord.com/api/webhooks/...',
  'feed.sidebar.webhookLabelShort': 'Webhook: ',
  'feed.moderation.scope.accountHwid': 'Conta + HWID',
  'feed.moderation.scope.full': 'Full',
  'feed.composer.label.scanlation': 'Scanlation',
  'feed.composer.availability.hoursPlaceholder': '10',
  'feed.composer.roles.valuePlaceholder': '50.00',
  'feed.apply.contactPlaceholder': 'Discord @usuario',
  'ranking.error.loadFailed': 'Falha ao carregar ranking.',
  'ranking.error.loadDetailFailed': 'Falha ao carregar detalhes.',
  'ranking.error.saveReviewFailed': 'Falha ao salvar review.',
  'ranking.error.deleteReviewFailed': 'Falha ao excluir review.',
  'ranking.error.emailVerificationRequired':
    'Confirme seu email antes de publicar ou editar reviews.',
  'dashboard.aio.translation.temperature': 'Temperatura',
  'dashboard.aio.translation.topP': 'Top P',
  'dashboard.aio.translation.maxTokens': 'Tokens Máximos',
  'dashboard.aio.clean.hdStrategy': 'Estratégia HD',
  'dashboard.aio.clean.hdStrategy.resize': 'Redimensionar',
  'dashboard.aio.clean.hdStrategy.crop': 'Recortar',
  'dashboard.aio.clean.hdStrategy.original': 'Original',
  'dashboard.aio.clean.hdStrategyHint':
    'Estratégia para imagens grandes antes do inpainting.',
  'dashboard.aio.clean.resizeLimit': 'Limite de Redimensionamento',
  'dashboard.aio.clean.cropMargin': 'Margem de Recorte',
  'dashboard.aio.clean.cropTriggerSize': 'Tamanho de Gatilho de Recorte',
  'dashboard.aio.clean.localHardware':
    'Hardware local: {name} ({provider}{vram})',
  'dashboard.sidebar.workspace': 'Área de Trabalho',
  'dashboard.sidebar.hide': 'Ocultar sidebar',
  'dashboard.sidebar.remaining': 'Restantes: {count}',
  'dashboard.sidebar.resizeAria': 'Redimensionar sidebar esquerda',
  'dashboard.sidebar.resizeTitle':
    'Arraste para redimensionar. Duplo clique para restaurar.',
  'dashboard.sidebar.files': 'Arquivos ({count})',
  'dashboard.sidebar.clearAll': 'Limpar tudo',
  'dashboard.sidebar.cleared': 'Lista de imagens limpa.',
  'dashboard.sidebar.empty': 'Nenhuma imagem',
  'dashboard.sidebar.rewindImage': 'Rewind somente desta imagem',
  'dashboard.sidebar.forwardImage': 'Forward somente desta imagem',
  'dashboard.sidebar.rotate90': 'Rotacionar 90 graus',
  'dashboard.sidebar.moveUp': 'Mover para cima',
  'dashboard.sidebar.moveDown': 'Mover para baixo',
  'dashboard.sidebar.remove': 'Remover',
  'dashboard.sidebar.extracting': 'Extraindo imagens... aguarde.',
  'dashboard.sidebar.dropHere': 'Solte aqui...',
  'dashboard.sidebar.clickOrDrag': 'Arraste ou clique',
  'dashboard.sidebar.processingArchive': 'Processando ZIP/PDF/CBZ/CB7/PSD...',
  'dashboard.sidebar.stats.title': 'Estatísticas locais',
  'dashboard.sidebar.stats.badge': 'Ativo',
  'dashboard.sidebar.stats.daily': 'Hoje',
  'dashboard.sidebar.stats.weekly': 'Esta semana',
  'dashboard.sidebar.stats.monthly': 'Este mês',
  'dashboard.sidebar.stats.foot':
    'Atividade local recente. Os contadores resetam automaticamente por período.',
  'dashboard.sidebar.stats.resetNow': 'Reseta agora',
  'dashboard.sidebar.stats.resetInHoursMinutes':
    'Reseta em {hours}h {minutes}m',
  'dashboard.sidebar.stats.resetInHours': 'Reseta em {hours}h',
  'dashboard.sidebar.stats.resetInMinutes': 'Reseta em {minutes}m',
  'dashboard.sidebar.right.hide': 'Ocultar ferramentas',
  'dashboard.sidebar.right.close': 'Fechar painel',
  'dashboard.sidebar.right.resizeAria': 'Redimensionar sidebar direita',
  'dashboard.sidebar.right.resizeTitle':
    'Arraste para redimensionar. Duplo clique para restaurar.',
  'dashboard.footer.runtime.downloaded': 'Pacote baixado',
  'dashboard.footer.runtime.embedded': 'Core embutido',
  'dashboard.footer.runtime.fallback.title': 'Fallback ativo',
  'dashboard.footer.runtime.fallback.detail':
    '{requested} solicitado, {active} em uso.',
  'dashboard.footer.runtime.tensorrt.title': 'TensorRT ativo',
  'dashboard.footer.runtime.tensorrt.detail':
    'Aceleração NVIDIA de máxima performance.',
  'dashboard.footer.runtime.cuda.title': 'CUDA ativo',
  'dashboard.footer.runtime.cuda.detail': 'GPU NVIDIA moderna em uso.',
  'dashboard.footer.runtime.legacy.label': 'Legacy',
  'dashboard.footer.runtime.legacy.title': 'CUDA Legacy ativo',
  'dashboard.footer.runtime.legacy.detail':
    'Perfil legado para GPUs NVIDIA antigas.',
  'dashboard.footer.runtime.openvino.title': 'OpenVINO ativo',
  'dashboard.footer.runtime.openvino.detail':
    'Aceleração Intel dedicada em uso.',
  'dashboard.footer.runtime.cpu.title': 'CPU ativa',
  'dashboard.footer.runtime.cpu.detail':
    'Execução local sem aceleração dedicada.',
  'dashboard.footer.workspace.saving': 'Salvando',
  'dashboard.footer.workspace.saved': 'Salvo',
  'dashboard.footer.workspace.error': 'Erro local',
  'dashboard.footer.workspace.pending': 'Pendente',
  'dashboard.footer.workspace.title': 'Workspace local',
  'dashboard.footer.runtime.source': 'Origem: {value}',
  'dashboard.footer.runtime.remoteAvailable': 'Pacote remoto disponível.',
  'dashboard.footer.runtime.errorReason': 'Motivo: {value}',
  'dashboard.footer.bugReport.title': 'Reportar bug',
  'dashboard.footer.bugReport.desc':
    'Reporte bugs com screenshot e logs automáticos.',
  'dashboard.footer.discord.aria': 'Entrar no Discord',
  'dashboard.footer.discord.title': 'Comunidade no Discord',
  'dashboard.footer.discord.desc':
    'Junte-se à comunidade, sugira ideias e compartilhe feedback.',
  'dashboard.footer.website.aria': 'Abrir website do projeto',
  'dashboard.footer.website.title': 'Website do projeto',
  'dashboard.footer.website.desc':
    'Acesse novidades, docs e recursos do projeto.',
  'bugReport.error.imgLoadFailed': 'Falha ao carregar imagem.',
  'bugReport.error.canvasFailed': 'Falha no processamento do canvas.',
  'modelManager.modal.title': 'Model Vault',
  'modelManager.modal.aioFallback': 'AIO',
  'modelCard.recommended': 'REC',
  'modelCard.hardware.gpu': 'GPU',
  'modelCard.hardware.cpu': 'CPU',
  'modelCard.speed.ok': 'OK',
  'auth.toolkit.aiClean': 'Limpeza IA',
  'freeProviderCard.setup': 'Setup',
  'freeProviderCard.limits': 'Limites',
  'freeProviderCard.rateLimits': 'Rate limits',
  'freeProviderCard.field.modelPlaceholder': 'Model ID (OpenAI-compatible)',
  'customProvider.profileType': 'Perfil AI Custom',
  'dashboard.cleaner.mode.assisted': 'Assistido',
  'dashboard.cleaner.mode.automaticAi': 'Automatic AI Clean',
  'dashboard.cleaner.mode.aiSfx': 'AI SFX',
  'dashboard.cleaner.mode.assistedTitle':
    'Fluxo estruturado com OCR, segmentação e inpainting local',
  'dashboard.cleaner.mode.automaticAiTitle':
    'Limpeza automática com IA multimodal e reconstrução guiada',
  'dashboard.cleaner.mode.aiSfxTitle':
    'Detecta e limpa apenas SFX aprovados por IA',
  'dashboard.cleaner.mode.title': 'Modo',
  'dashboard.cleaner.mode.hint':
    'O modo atual foi mantido como fluxo assistido. O novo <strong>Automatic AI Clean</strong> usa IA multimodal com regras rígidas para preservar arte, contornos e balões.',
  'dashboard.cleaner.pipeline.title': 'Pipeline',
  'dashboard.cleaner.pipeline.hint':
    'Fluxo assistido: OCR → Segmentação → Limpeza local. Ideal para quem quer previsibilidade e ajustes finos depois.',
  'dashboard.cleaner.ocr.language': 'Idioma (OCR)',
  'dashboard.cleaner.ocr.languageAria': 'Idioma original para OCR',
  'dashboard.cleaner.models.button': 'Modelos',
  'dashboard.cleaner.models.none': 'Nenhum modelo',
  'dashboard.cleaner.ocr.manageAria': 'Gerenciar modelos de OCR',
  'dashboard.cleaner.ocr.modelAria': 'Modelo de OCR',
  'dashboard.cleaner.segment.title': 'Segmentar',
  'dashboard.cleaner.segment.manageAria': 'Gerenciar modelos de segmentação',
  'dashboard.cleaner.segment.modelAria': 'Modelo de segmentação',
  'dashboard.cleaner.clean.title': 'Limpar',
  'dashboard.cleaner.clean.manageAria': 'Gerenciar modelos de limpeza',
  'dashboard.cleaner.clean.modelAria': 'Modelo de limpeza',
  'dashboard.cleaner.settings.title': 'Limpeza',
  'dashboard.cleaner.settings.maskDilation': 'Mask Dilation',
  'dashboard.cleaner.settings.hdStrategy': 'HD Strategy',
  'dashboard.cleaner.settings.resizeLimit': 'Resize Limit',
  'dashboard.cleaner.settings.cropMargin': 'Crop Margin',
  'dashboard.cleaner.settings.cropTrigger': 'Crop Trigger',
  'dashboard.cleaner.inspect.title': 'Inspeção',
  'dashboard.cleaner.inspect.ocrBlocks': 'OCR Blocos',
  'dashboard.cleaner.inspect.segmented': 'Segmentados',
  'dashboard.cleaner.inspect.selection': 'Seleção',
  'dashboard.cleaner.inspect.none': 'nenhuma',
  'dashboard.cleaner.inspect.ocr': 'OCR',
  'dashboard.cleaner.inspect.segments': 'Segmentos',
  'dashboard.cleaner.inspect.boxesCount': '{count} caixa(s)',
  'dashboard.cleaner.ai.sfxCleaner': 'AI SFX Cleaner',
  'dashboard.cleaner.ai.automaticClean': 'Automatic AI Clean',
  'dashboard.cleaner.ai.sfxDesc':
    'Usa o detector local para propor candidatos, classifica quais regiões são SFX reais e limpa somente as aprovadas.',
  'dashboard.cleaner.ai.automaticDesc':
    'Usa detecção estrutural do projeto para orientar a IA, reforça a preservação de balões/arte e recompõe imagens grandes com junções mais suaves.',
  'dashboard.cleaner.ai.modelTitle': 'Modelo AI',
  'dashboard.cleaner.ai.manageAria': 'Gerenciar modelos do {value}',
  'dashboard.cleaner.ai.modelAria': 'Modelo do {value}',
  'dashboard.cleaner.ai.noneAvailable': 'Nenhum modelo AI disponível',
  'dashboard.cleaner.instructions.title': 'Instruções adicionais',
  'dashboard.cleaner.instructions.hintSfx':
    'Essas instruções entram como contexto complementar após as regras-base de classificação e limpeza SFX.',
  'dashboard.cleaner.instructions.hintAi':
    'Essas instruções entram como contexto complementar. As regras centrais do cleaner AI continuam acima de qualquer instrução do usuário para não quebrar a lógica da limpeza.',
  'dashboard.cleaner.stats.candidates': 'Candidatas',
  'dashboard.cleaner.stats.sfxApproved': 'SFX aprov.',
  'dashboard.cleaner.stats.redraw': 'Redraw',
  'dashboard.cleaner.action.processing': 'Processando {value} {percent}%',
  'dashboard.cleaner.action.runAiSfx': 'Executar AI SFX Cleaner',
  'dashboard.cleaner.action.runAutomatic': 'Executar Automatic AI Clean',
  'dashboard.cleaner.action.runAssisted': 'Executar Cleaner Assistido',
  'dashboard.typography.circularText': 'Texto Circular',
  'dashboard.typography.activate': 'Ativar',
  'dashboard.typography.effect.aria': 'Efeito do texto',
  'dashboard.typography.effect.title': 'Selecionar efeito do texto',
  'dashboard.typography.effect.label': 'Efeito',
  'dashboard.typography.effect.none': 'Sem efeito',
  'dashboard.typography.effect.panelTitle': 'Efeito do texto',
  'dashboard.typography.effect.panelHint':
    'Presets nativos para fala, impacto e smear.',
  'dashboard.typography.effect.searchPlaceholder': 'Buscar efeitos...',
  'dashboard.typography.effect.intensity': 'Agressividade',
  'dashboard.typography.effect.noResults': 'Nenhum efeito encontrado.',
  'dashboard.aio.customAi.titleTranslation': 'Custom AI Profiles (Tradução)',
  'dashboard.aio.customAi.titleOcr': 'Custom AI Profiles (OCR)',
  'dashboard.aio.customAi.newTranslation': 'Novo perfil de tradução',
  'dashboard.aio.customAi.newOcr': 'Novo perfil de OCR',
  'dashboard.aio.customAi.placeholderTranslation':
    'Ex.: OpenRouter Manga PT-BR',
  'dashboard.aio.customAi.placeholderOcr': 'Ex.: OCR Vision Privado',
  'dashboard.aio.customAi.modelPlaceholderTranslation': 'openai/gpt-4.1',
  'dashboard.aio.customAi.modelPlaceholderOcr': 'gpt-4.1-mini',
  'dashboard.aio.customAi.useTranslation': 'Usar Tradução',
  'dashboard.aio.customAi.useOcr': 'Usar OCR',
  'dashboard.aio.customAi.loading': 'Carregando perfis custom...',
  'dashboard.aio.customAi.savedProfile': 'Perfil salvo',
  'dashboard.aio.customAi.apiBase': 'API Base',
  'dashboard.aio.customAi.ollamaPreset': 'Preset Ollama Local',
  'dashboard.aio.customAi.apiKey': 'API Key (opcional)',
  'dashboard.aio.customAi.model': 'Model',
  'dashboard.aio.customAi.clear': 'Limpar',
  'dashboard.aio.customAi.remove': 'Remover',
  'dashboard.aio.customAi.save': 'Salvar',
  'dashboard.emptyStage.title': 'Selecione ou carregue imagens',
  'dashboard.emptyStage.desc':
    'Use as ferramentas na barra superior para processar suas páginas de manhwa.',
  'dashboard.emptyStage.tipTitle': 'Dica útil',
  'dashboard.emptyStage.tipMeta': 'Alternando a cada 15 segundos',
  'dashboard.enhance.title': 'Melhorar Imagem',
  'dashboard.enhance.localHint':
    'Modelos ONNX no mini-backend local. Instale antes de processar.',
  'dashboard.enhance.desktopRequiredHint':
    'Requer app desktop com mini-backend ativo.',
  'dashboard.enhance.scale': 'Escala',
  'dashboard.enhance.profile': 'Perfil',
  'dashboard.enhance.model': 'Modelo',
  'dashboard.enhance.format': 'Formato',
  'dashboard.enhance.status.title': 'Modelo',
  'dashboard.enhance.status.desktopRequired': 'Desktop obrigatório',
  'dashboard.enhance.status.selectModel': 'Selecione um modelo',
  'dashboard.enhance.status.ready': 'Pronto',
  'dashboard.enhance.status.notImported': 'Não importado',
  'dashboard.enhance.status.notInstalled': 'Não instalado',
  'dashboard.enhance.importHint':
    'Importação manual de ONNX. Converta .pth no sisr2onnx.',
  'dashboard.enhance.action.manage': 'Gerenciar',
  'dashboard.enhance.action.import': 'Importar',
  'dashboard.enhance.action.install': 'Instalar',
  'dashboard.enhance.action.source': 'Fonte',
  'dashboard.enhance.selectAboveHint': 'Selecione um modelo acima.',
  'dashboard.enhance.action.processing': 'Melhorando...',
  'dashboard.enhance.action.run': 'Melhorar Imagens',
  'dashboard.info.optimizer.desc1':
    'Otimize o lote final com presets de web, leitura ou arquivo usando as saídas já geradas no dashboard.',
  'dashboard.info.optimizer.desc2':
    'Outilitário mostra economia por página e exporta ZIP ou pasta local.',
  'dashboard.info.blogger.desc1':
    'Use este utilitário para publicar no Blogger e gerar URLs hospedadas para imagens.',
  'dashboard.info.blogger.desc2':
    'As credenciais e o optimizer ficam em Settings > Integrações > Blogger CDN.',
  'dashboard.info.imgur.desc1':
    'Use este utilitário para fazer upload anônimo no Imgur com rotação aleatória das Client IDs configuradas.',
  'dashboard.info.imgur.desc2':
    'As chaves, o limiter e o guia completo ficam em Settings > Integrações > Imgur Upload.',
  'dashboard.info.guides.desc1':
    'Selecione um guia no painel central para ler as instruções detalhadas.',
  'dashboard.info.guides.desc2':
    'Cada guia contém exemplos práticos e dicas de produtividade.',
  'dashboard.info.resources.desc1':
    'Explore recursos e materiais úteis para seu fluxo de trabalho de scanlation.',
  'dashboard.info.resources.desc2':
    'Fontes, templates, dicionários e muito mais.',
  'dashboard.render.noRecognizedText': 'Sem texto reconhecido',
  'dashboard.render.noTranslation': 'Sem tradução disponível',
  'dashboard.render.noNotes': 'Sem NT disponível',
  'dashboard.render.noteLabel': 'NT:',
  'dashboard.render.textLabel': 'Texto',
  'dashboard.render.aaLabel': 'AA',
  'dashboard.render.skewXLabel': 'Sx',
  'dashboard.render.skewYLabel': 'Sy',
  'renderPreview.context.title': 'Ações da região',
  'renderPreview.context.copyRecognized': 'Copiar reconhecido',
  'renderPreview.context.copyTranslated': 'Copiar tradução',
  'renderPreview.context.editRendered': 'Editar renderizado',
  'renderPreview.context.editRenderedHint': 'Editar texto renderizado',
  'renderPreview.context.manualModeHint': 'Modo manual necessário',
  'renderPreview.shape': 'Forma',
  'renderPreview.rectangular': 'Retangular',
  'renderPreview.elliptic': 'Elíptico',
  'renderPreview.convertRectangular': 'Converter para forma retangular',
  'renderPreview.convertElliptic': 'Converter para forma elíptica',
  'renderPreview.manualModeRequired': 'Modo manual necessário',
  'renderPreview.applyTypographyPreset': 'Aplicar preset de tipografia',
  'renderPreview.preset': 'Preset',
  'renderPreview.typographyPresets': 'Presets de tipografia',
  'renderPreview.applyPreset': 'Aplicar Preset',
  'renderPreview.removeRegion': 'Remover Seleção',
  'renderPreview.textFont': 'Fonte do texto',
  'renderPreview.selectionShape': 'Forma da seleção',
  'renderPreview.fontSize': 'Tamanho da fonte',
  'renderPreview.decreaseFont': 'Diminuir fonte',
  'renderPreview.increaseFont': 'Aumentar fonte',
  'renderPreview.alignment': 'Alinhamento',
  'renderPreview.alignLeft': 'Alinhar à esquerda',
  'renderPreview.alignCenter': 'Centralizar',
  'renderPreview.alignRight': 'Alinhar à direita',
  'renderPreview.typographyStyle': 'Estilo de tipografia',
  'renderPreview.bold': 'Negrito',
  'renderPreview.italic': 'Itálico',
  'renderPreview.underline': 'Sublinhado',
  'renderPreview.uppercase': 'Maiúsculas',
  'renderPreview.textOrientation': 'Orientação do texto',
  'renderPreview.horizontal': 'Horizontal',
  'renderPreview.vertical': 'Vertical',
  'renderPreview.circular': 'Circular',
  'renderPreview.rotation': 'Rotação',
  'renderPreview.rotateMinus5': 'Girar -5°',
  'renderPreview.rotatePlus5': 'Girar +5°',
  'renderPreview.skewX': 'Inclinação X',
  'renderPreview.skewXMinus2': 'Inclinação X -2°',
  'renderPreview.skewXPlus2': 'Inclinação X +2°',
  'renderPreview.skewY': 'Inclinação Y',
  'renderPreview.skewYMinus2': 'Inclinação Y -2°',
  'renderPreview.skewYPlus2': 'Inclinação Y +2°',
  'renderPreview.adjustments': 'Ajustes',
  'renderPreview.refine': 'Refinar',
  'renderPreview.autoFontSize': 'Auto Font Size',
  'renderPreview.autoFit': 'Auto-ajuste',
  'renderPreview.fixed': 'Fixo',
  'renderPreview.hyphenation': 'Hifenização',
  'renderPreview.enabled': 'Ativado',
  'renderPreview.disabled': 'Desativado',
  'renderPreview.maxSize': 'Tam. Máximo',
  'renderPreview.minSize': 'Tam. Mínimo',
  'renderPreview.lineSpacing': 'Espaçamento entre linhas',
  'renderPreview.opacity': 'Opacidade',
  'renderPreview.fill': 'Preenchimento',
  'renderPreview.outline': 'Contorno',
  'renderPreview.shadow': 'Sombra',
  'renderPreview.shadowLayers': 'Camadas de Sombra',
  'renderPreview.addLayer': 'Adicionar Camada',
  'renderPreview.layerN': 'Camada {count}',
  'renderPreview.removeLayerN': 'Remover camada {count}',
  'renderPreview.shadowLayerN': 'Sombra Camada {count}',
  'renderPreview.blur': 'Desfoque',
  'renderPreview.offsetX': 'Deslocamento X',
  'renderPreview.offsetY': 'Deslocamento Y',
  'renderPreview.radius': 'Raio',
  'renderPreview.startAngle': 'Ângulo Inicial',
  'renderPreview.spacing': 'Espaçamento',
  'renderPreview.shadowLayersCount': '{count} camada(s)',
  'renderPreview.shadowBlurSummary': 'blur {value}',
  'renderPreview.history.none': 'Sem histórico AIO para esta imagem',
  'renderPreview.box.clickToEdit': 'duplo clique para editar',
  'renderPreview.box.renderNotApplied': 'render não aplicado nesta etapa',
  'renderPreview.editor.placeholder': 'Digite o texto final...',
  'renderPreview.editor.aria': 'Editar texto renderizado',
  'splitter.strategy.smart': 'Auto Smart',
  'splitter.strategy.smartHint': 'Whitespace + heurística.',
  'splitter.strategy.advancedDesktop': 'Semi Desktop',
  'splitter.strategy.advancedDesktopHint': 'Análise local avançada.',
  'splitter.strategy.manual': 'Manual',
  'splitter.strategy.manualHint': 'Só ajustes manuais.',
  'splitter.strategy.fixedHeight': 'Altura fixa',
  'splitter.strategy.fixedHeightHint': 'Segmenta por altura.',
  'splitter.strategy.count': 'N partes',
  'splitter.strategy.countHint': 'Divisão igualitária.',
  'dashboard.aio.autoScopeTitle': 'Processamento automático sem intervenção',
  'dashboard.aio.manualScopeTitle': 'Controle manual de cada etapa',
  'detectionPreview.recognized': 'Reconhecido:',
  'detectionPreview.translated': 'Traduzido:',
  'detectionPreview.note': 'NT:',
  'detectionPreview.manual': 'Manual',
  'detectionPreview.removeSelection': 'Remover seleção',
  'detectionPreview.actions': 'Ações da região',
  'detectionPreview.text': 'Texto',
  'detectionPreview.copyRecognized': 'Copiar reconhecido',
  'detectionPreview.editRecognized': 'Editar reconhecido',
  'detectionPreview.manualModeOnly': 'Disponível apenas no modo manual',
  'detectionPreview.copyTranslated': 'Copiar tradução',
  'detectionPreview.editTranslated': 'Editar tradução',
  'detectionPreview.removeRegion': 'Remover região',
  'detectionPreview.editRecognizedTitle': 'Editar texto reconhecido',
  'detectionPreview.editTranslatedTitle': 'Editar texto traduzido',
  'detectionPreview.placeholderRecognized': 'Digite o texto reconhecido...',
  'detectionPreview.placeholderTranslated': 'Digite a tradução...',
  'detectionPreview.rewind': 'Rewind desta imagem',
  'detectionPreview.forward': 'Forward desta imagem',
  'detectionPreview.noHistory': 'Sem histórico AIO para esta imagem',
  'dashboard.translator.workspace.aria': 'Modo do Tradutor',
  'dashboard.translator.workspace.textTitle': 'Traduzir texto livre',
  'dashboard.translator.workspace.text': 'Texto',
  'dashboard.translator.workspace.visualTitle':
    'Detectar e traduzir em imagens',
  'dashboard.translator.workspace.visual': 'Visual',
  'watermark.header.eyebrow': 'Editorial Utility',
  'watermark.header.title': "Marca d'Água",
  'watermark.header.badge': 'Batch',
  'watermark.panel.presets': 'Presets',
  'watermark.presets.builtin': 'Pronto',
  'watermark.presets.user': 'Salvo',
  'watermark.action.save': 'Salvar',
  'watermark.action.duplicate': 'Duplicar',
  'watermark.panel.text': 'Texto',
  'watermark.text.enable': 'Ativar texto',
  'watermark.text.content': 'Conteúdo',
  'watermark.text.font': 'Fonte',
  'watermark.text.size': 'Tamanho',
  'watermark.text.color': 'Cor',
  'watermark.text.outline': 'Outline',
  'watermark.text.outlineColor': 'Cor outline',
  'watermark.text.opacity': 'Opacidade',
  'watermark.panel.logo': 'Logo',
  'watermark.logo.enable': 'Ativar',
  'watermark.logo.change': 'Trocar',
  'watermark.logo.upload': 'Enviar',
  'watermark.logo.remove': 'Remover',
  'watermark.logo.scale': 'Escala %',
  'watermark.logo.opacity': 'Opacidade',
  'watermark.logo.brightness': 'Brilho',
  'watermark.logo.saturation': 'Saturação',
  'watermark.panel.distribution': 'Distribuição',
  'watermark.distribution.position': 'Posição',
  'watermark.distribution.rotation': 'Rotação',
  'watermark.distribution.blend': 'Blend',
  'watermark.distribution.gapX': 'Gap X',
  'watermark.distribution.gapY': 'Gap Y',
  'watermark.distribution.padding': 'Padding',
  'watermark.distribution.baseName': 'Nome base',
  'watermark.distribution.smartPlacement': 'Smart Placement',
  'watermark.action.applying': 'Aplicando...',
  'watermark.action.applyBatch': 'Aplicar em Lote',
  'watermark.status.cancelRequested': 'Cancelamento solicitado.',
  'watermark.action.cancel': 'Cancelar',
  'watermark.panel.preview': 'Preview',
  'watermark.preview.compare': 'Compare',
  'watermark.preview.mode': 'Preview',
  'watermark.preview.empty.title': 'Sem imagens',
  'watermark.preview.empty.desc':
    'Importe páginas no painel esquerdo do dashboard.',
  'watermark.preview.noLayer.title': 'Configure uma camada',
  'watermark.preview.noLayer.desc':
    'Ative texto ou logo na toolbox para gerar o preview.',
  'watermark.preview.original': 'Original',
  'watermark.preview.watermark': 'Watermark',
  'watermark.preview.compareAria': 'Comparação antes/depois',
  'watermark.preview.generating': 'Gerando...',
  'watermark.panel.output': 'Saída',
  'watermark.output.empty.title': 'Sem resultados',
  'watermark.output.empty.desc': 'Aplique o lote para gerar downloads.',
  'watermark.action.zip': 'ZIP',
  'watermark.action.folder': 'Pasta',
  'watermark.action.download': 'Baixar',
  'imgur.hero.eyebrow': 'Imgur Upload',
  'imgur.hero.title': 'Hospedagem anônima',
  'imgur.hero.desc':
    'Use este utilitário para fazer upload rápido no Imgur com rotação aleatória de Client IDs.',
  'imgur.status.remaining': 'Restantes: {remaining}',
  'imgur.status.configure': 'Configurar',
  'imgur.alert.missingConfig': 'Configuração ausente',
  'imgur.alert.addActiveClient':
    'Adicione pelo menos um Client ID ativo em Settings > Integrações.',
  'imgur.batch.title': 'Upload em Lote',
  'imgur.batch.limit': 'Limite de {limit} uploads por hora (Usado: {used})',
  'imgur.dropzone.title': 'Solte as imagens aqui',
  'imgur.dropzone.desc': 'Arraste múltiplos arquivos JPG, PNG ou WEBP.',
  'imgur.toggle.imgOutput': 'Saída como tag <img>',
  'imgur.toggle.imgOutputDesc': 'Gera código HTML pronto para blogs e fóruns.',
  'imgur.actions.select': 'Selecionar',
  'imgur.actions.sending': 'Enviando...',
  'imgur.actions.send': 'Enviar',
  'imgur.actions.copy': 'Copiar URLs',
  'imgur.queue.title': 'Fila de Upload',
  'imgur.queue.items_one': '{count} item',
  'imgur.queue.items_other': '{count} itens',
  'imgur.queue.empty': 'Fila vazia. Adicione imagens acima.',
  'imgur.queue.altPlaceholder': 'Alt text',
  'imgur.queue.urlLabel': 'URL',
  'imgur.queue.keyLabel': 'Key',
  'imgur.queue.remove': 'Remover',
  'imgur.error.configLoad': 'Falha ao carregar configuração do Imgur.',
  'imgur.error.uploadFailed': 'Falha no upload das imagens.',
  'imgur.feedback.singleSuccess': 'Upload concluído com sucesso.',
  'imgur.feedback.multiSuccess': 'Upload de {count} imagens concluído.',
  'ranking.metric.overall': 'Score geral',
  'ranking.metric.quality': 'Qualidade',
  'ranking.metric.speed': 'Velocidade',
  'ranking.metric.costBenefit': 'Custo-benefício',
  'ranking.metric.easeOfUse': 'Facilidade',
  'ranking.trend.neutral': 'Neutro',
  'ranking.trend.points': 'pts',
  'ranking.table.title': 'Leaderboard',
  'ranking.table.sortedBy': 'Ordenado por {metric} ponderado.',
  'ranking.table.modelsCount': '{count} modelos ranqueados',
  'ranking.table.empty': 'Nenhum modelo atende aos filtros atuais.',
  'ranking.table.newLabel': 'Novo',
  'ranking.table.reviewsCount': '{count} reviews',
  'ranking.table.reviewedByYou': 'Você já avaliou',
  'ranking.table.viewDetails': 'Ver detalhes',
  'ranking.filters.metricAria': 'Métrica do ranking',
  'ranking.filters.searchPlaceholder': 'Buscar modelo...',
  'ranking.filters.searchAria': 'Buscar modelo',
  'ranking.filters.advancedAria': 'Exibir filtros avançados',
  'ranking.filters.button': 'Filtros',
  'ranking.filters.stageLabel': 'Estágio',
  'ranking.filters.sourceLabel': 'Origem',
  'ranking.filters.languageLabel': 'Idioma',
  'ranking.filters.minReviewsLabel': 'Mín. reviews',
  'ranking.filters.allStages': 'Todos estágios',
  'ranking.filters.allSources': 'Local + Cloud',
  'ranking.filters.onlyLocal': 'Somente local',
  'ranking.filters.onlyCloud': 'Somente cloud',
  'ranking.filters.allLanguages': 'Todos idiomas',
  'ranking.filters.reviews_one': '{count} review',
  'ranking.filters.reviews_other': '{count} reviews',
  'ranking.composer.usage.balanced': 'Equilibrado',
  'ranking.composer.usage.qualityFirst': 'Qualidade primeiro',
  'ranking.composer.usage.speedFirst': 'Velocidade primeiro',
  'ranking.composer.usage.lowVram': 'Baixa VRAM',
  'ranking.composer.usage.offlineLocal': 'Pipeline local',
  'ranking.composer.usage.cloudPipeline': 'Pipeline cloud',
  'ranking.composer.title.edit': 'Editar avaliação',
  'ranking.composer.title.new': 'Nova avaliação',
  'ranking.composer.action.close': 'Fechar',
  'ranking.composer.field.title': 'Título',
  'ranking.composer.field.titlePlaceholder': 'Ex.: Melhor OCR local para manga',
  'ranking.composer.field.context': 'Contexto',
  'ranking.composer.field.sourceLang': 'Idioma origem',
  'ranking.composer.field.sourceLangPlaceholder': 'ja, en, pt-br...',
  'ranking.composer.field.targetLang': 'Idioma destino',
  'ranking.composer.field.targetLangPlaceholder': 'en, pt, pt-br...',
  'ranking.composer.field.device': 'Dispositivo',
  'ranking.composer.device.none': 'Não informado',
  'ranking.composer.field.comment': 'Comentário',
  'ranking.composer.field.commentPlaceholder':
    'Descreva qualidade final, estabilidade, consumo e onde esse modelo entrega mais valor.',
  'ranking.composer.action.reset': 'Resetar',
  'ranking.composer.action.delete': 'Excluir',
  'ranking.composer.action.save': 'Salvar',
  'ranking.composer.action.publish': 'Publicar',
  'dashboard.specialMode.visualEmpty.title': 'Tradutor Visual',
  'dashboard.specialMode.visualEmpty.description':
    'Importe imagens para começar a traduzir diretamente no preview.',
  'dashboard.specialMode.visualEmpty.cta': 'Selecionar Imagens',
  'dashboard.reviewRaw.raw.title': 'Revisão de Raw',
  'dashboard.reviewRaw.raw.description':
    'Analise a qualidade das imagens originais e prepare o lote para o pipeline.',
  'dashboard.reviewRaw.raw.note':
    'A validação de raw ajuda a IA a entender melhor o contexto visual antes do OCR.',
  'dashboard.reviewRaw.raw.statusReady':
    'Lote de {count} imagens pronto para validação.',
  'dashboard.reviewRaw.raw.validate': 'Validar Raw',
  'dashboard.reviewRaw.qc.title': 'Quality Control',
  'dashboard.reviewRaw.qc.descriptionAuto':
    'QC automático usa modelos leves para detectar erros comuns de edição.',
  'dashboard.reviewRaw.qc.descriptionManual':
    'Modo manual permite revisão detalhada de cada balão e redraw.',
  'dashboard.reviewRaw.qc.note':
    'Ative os checks abaixo para rodar a análise em lote.',
  'dashboard.reviewRaw.qc.automaticChecks': 'Verificações Automáticas',
  'dashboard.reviewRaw.qc.checks.untranslatedText': 'Texto não traduzido',
  'dashboard.reviewRaw.qc.checks.emptyBubbles': 'Balões vazios',
  'dashboard.reviewRaw.qc.checks.visualArtifacts': 'Artefatos visuais',
  'dashboard.reviewRaw.qc.checks.textAlignment': 'Alinhamento de texto',
  'dashboard.reviewRaw.qc.checks.fontConsistency': 'Consistência de fontes',
  'dashboard.reviewRaw.qc.inProgress': 'Análise de QC em andamento...',
  'dashboard.reviewRaw.qc.run': 'Executar QC',
  'common.cancel': 'Cancelar',
  'common.save': 'Salvar',
  'common.name': 'Nome',
  'common.newName': 'Novo nome',
  'common.removed': 'Removido',
  'common.renamed': 'Renomeado',
  'common.duplicated': 'Duplicado',
  'common.saved': 'Salvo',
  'common.failed': 'Falha',
  'common.cancelled': 'Cancelado',
  'common.status': 'Status',
  'common.configured': 'Configurado',
  'common.no': 'Não',
  'common.account': 'Conta',
  'common.format': 'Formato',
  'common.exportedCount': 'Exportado: {count} itens.',
  'modelManager.modal.verified': 'Verificado em',
  'modelManager.modal.upToDate': 'Atualizado',
  'modelManager.modal.closeAria': 'Fechar modal',
  'modelManager.modal.localModels': 'Catálogo Local',
  'modelManager.modal.localDesc':
    'Instalação on-demand com verificação de integridade.',
  'modelManager.modal.noLocal': 'Nenhum modelo local corresponde aos filtros.',
  'modelManager.modal.cloudModels': 'Catálogo Cloud',
  'modelManager.modal.cloudDesc':
    'Modelos baseados em API/Nuvem. Requerem conexão e chaves próprias.',
  'modelManager.modal.hideCustom': 'Ocultar Custom',
  'modelManager.modal.addCustom': 'Adicionar Custom',
  'modelManager.modal.noCloud': 'Nenhum modelo cloud corresponde aos filtros.',
  'modelManager.modal.checking': 'Verificando...',
  'modelManager.modal.checkUpdates': 'Check for Updates',
  'modelManager.modal.installAll': 'Instalar Recomendados',
  'modelManager.modal.cancel': 'Cancelar',
  'modelManager.modal.noEligible': 'Nenhum modelo elegível encontrado.',
  'modelManager.modal.notEnoughSpace':
    'Espaço insuficiente (precisa de {space}).',
  'resources.breadcrumb.home': 'Recursos',
  'resources.communities.title': 'Comunidades & Links',
  'resources.back': 'Voltar para Recursos',
  'resources.communities.desc':
    'Comunidades ativas de scanlation, Discords, fóruns e recursos para networking e aprendizado.',
  'resources.platform.discord': 'Discord',
  'resources.platform.forum': 'Fórum',
  'resources.platform.reddit': 'Reddit',
  'resources.platform.website': 'Website',
  'resources.communities.members': '{count} membros',
  'resources.action.visit': 'Visitar',
  'resources.externalTools.title': 'Ferramentas Externas',
  'resources.externalTools.desc':
    'Software e apps recomendados que complementam o KŌMA Studio no seu fluxo de trabalho de scanlation.',
  'resources.category.editing': 'Edição',
  'resources.category.ocr': 'OCR',
  'resources.category.translation': 'Tradução',
  'resources.category.fonts': 'Fontes',
  'resources.category.hosting': 'Hosting',
  'resources.category.utility': 'Utilidade',
  'resources.action.open': 'Abrir',
  'resources.action.download': 'Download',
  'resources.status.free': 'Grátis',
  'resources.status.paid': 'Pago',
  'resources.fonts.title': 'Fontes para Typesetting',
  'resources.fonts.desc':
    'Coleção curada de fontes populares para scanlation. Inclui fontes para diálogo, narração, ênfase, SFX e texto CJK.',
  'resources.fonts.searchPlaceholder': 'Buscar fontes por nome, uso ou tag...',
  'resources.fonts.noResults': 'Nenhuma fonte encontrada para "{search}"',
  'resources.license.free': 'Gratuita',
  'resources.license.openSource': 'Open Source',
  'resources.license.commercial': 'Comercial',
  'resources.license.mixed': 'Mista',
  'resources.glossary.title': 'Glossário de Scanlation',
  'resources.glossary.desc':
    'Termos técnicos, jargão da comunidade e vocabulário essencial para scanlation de mangás, manhwa e manhua.',
  'resources.glossary.searchPlaceholder': 'Buscar termos...',
  'resources.glossary.noResults': 'Nenhum termo encontrado para "{search}"',
  'resources.glossary.related': 'Relacionados:',
  'resources.category.general': 'Geral',
  'resources.category.typesetting': 'Typesetting',
  'resources.category.cleaning': 'Cleaning',
  'resources.category.technical': 'Técnico',
  'resources.category.roles': 'Funções',
  'resources.sfx.title': 'SFX Library',
  'resources.sfx.desc':
    'Biblioteca de efeitos sonoros japoneses com traduções, pronúncia em romaji e exemplos de uso em mangá.',
  'resources.sfx.searchPlaceholder': 'Buscar por japonês, romaji ou inglês...',
  'resources.sfx.noResults': 'Nenhum SFX encontrado.',
  'resources.sfx.commonIn': 'Comum em: {value}',
  'resources.category.impact': 'Impacto',
  'resources.category.emotion': 'Emoção',
  'resources.category.ambient': 'Ambiente',
  'resources.category.action': 'Ação',
  'resources.category.voice': 'Voz',
  'resources.category.misc': 'Outros',
  'resources.filters.all': 'Todos ({count})',
  'resources.page.tab.fonts': 'Fontes',
  'resources.page.tab.sfx': 'Biblioteca SFX',
  'resources.page.tab.glossary': 'Glossário',
  'resources.page.tab.communities': 'Comunidades',
  'resources.page.tab.tools': 'Ferramentas',
  'resources.page.title.main': 'Central de ',
  'resources.page.title.accent': 'Recursos',
  'resources.page.subtitle':
    'Materiais selecionados, comunidades e ferramentas para o seu workflow.',
  'resources.page.searchPlaceholder': 'Pesquise em todas as categorias...',
  'resources.page.searchAria': 'Campo de busca de recursos',
  'resources.page.clearSearch': 'Limpar busca',
  'resources.page.tabsAria': 'Categorias de recursos',
  'resources.category.fonts.label': 'Fontes para Typesetting',
  'resources.category.fonts.description':
    'Coleção curada de fontes populares para scanlation de mangá, manhwa e manhua.',
  'resources.category.sfx-library.label': 'SFX Library',
  'resources.category.sfx-library.description':
    'Biblioteca de onomatopeias japonesas com traduções e exemplos de uso.',
  'resources.category.glossary.label': 'Glossário de Scanlation',
  'resources.category.glossary.description':
    'Termos técnicos e jargão da comunidade de scanlation.',
  'resources.category.communities.label': 'Comunidades',
  'resources.category.communities.description':
    'Servidores Discord, subreddits e fóruns de scanlation.',
  'resources.category.tools-external.label': 'Ferramentas Externas',
  'resources.category.tools-external.description':
    'Softwares complementares e ferramentas online úteis.',
  'resources.home.title': 'Central de Recursos',
  'resources.home.subtitle':
    'Materiais selecionados, comunidades e ferramentas para o seu workflow.',
  'resources.home.itemCount': '{count} itens',
  'dashboard.aio.result.regionsDetected': '{count} região(ões) detectada(s)',
  'dashboard.aio.result.textsRecognized': '{count} texto(s) reconhecido(s)',
  'dashboard.aio.result.translationsGenerated':
    '{count} tradução(ões) gerada(s)',
  'dashboard.aio.result.regionsSegmented': '{count} região(ões) segmentada(s)',
  'dashboard.aio.result.imagesCleaned': '{count} imagem(ns) limpa(s)',
  'dashboard.aio.result.blocksReady': '{count} bloco(s) pronto(s) para render',
  'dashboard.aio.result.finished': 'AIO concluído. {parts}.',
  'resources.glossary.category.general': 'Geral',
  'resources.glossary.category.typesetting': 'Typesetting',
  'resources.glossary.category.cleaning': 'Cleaning',
  'resources.glossary.category.translation': 'Tradução',
  'resources.glossary.category.technical': 'Técnico',
  'resources.glossary.category.roles': 'Funções',
  'resources.glossary.filterAll': 'Todos',
  'resources.glossary.results_one': 'termo encontrado',
  'resources.glossary.results_other': 'termos encontrados',
  'resources.glossary.context': 'Glossário',
  'resources.glossary.alphaAria': 'Navegação alfabética',
  'resources.glossary.alphaBtnAria': 'Ir para letra {letter}',
  'dashboard.aio.config.sourceLanguage':
    'Idioma Original (Detectar/OCR/Traduzir)',
  'dashboard.aio.config.targetLanguage': 'Idioma de Tradução',
  'dashboard.aio.pipeline.rewind': 'Rewind pipeline',
  'dashboard.aio.pipeline.forward': 'Forward pipeline',
  'dashboard.aio.pipeline.snapshot': 'Snapshot: ',
  'dashboard.aio.pipeline.image': 'Imagem: ',
  'dashboard.aio.pipeline.stage': 'Etapa: ',
  'dashboard.aio.translation.noneSelected': 'Nenhum modelo selecionado.',
  'dashboard.aio.translation.selected': 'Selecionado: ',
  'dashboard.aio.render.hint':
    'Controles de fonte/cor/alinhamento ficam na dock contextual do overlay. Atalho: Shift + Scroll para rotacionar.',
  'dashboard.aio.render.warning':
    'Imagem em etapa anterior ao Render. Use Forward para visualizar.',
  'dashboard.aio.render.disabled':
    'Ative a etapa Render no pipeline para configurar.',
  'dashboard.stitch.lastToNext': 'Última imagem enviada para o próximo lote.',
  'dashboard.stitch.firstFromNext':
    'Primeira imagem do próximo lote adicionada ao lote atual.',
  'dashboard.stitch.resetPlanning':
    'Planejamento do Stitcher recalculado automaticamente.',
  'dashboard.aio.customAi.syncing': 'Custom AI (sincronizando...)',
  'dashboard.aio.customOcr.syncing': 'Custom OCR (sincronizando...)',
  'dashboard.aio.customOcr.useCase':
    'Perfil custom OCR aguardando sincronização local.',
  'dashboard.aio.customAi.useCase':
    'Perfil custom aguardando sincronização local.',
  'dashboard.aio.config.languageHint':
    'O idioma original é usado nas etapas Detectar, Reconhecer e Traduzir. O idioma de tradução é aplicado apenas na tradução.',
  'dashboard.aio.presets.title': 'Presets AIO por idioma',
  'dashboard.aio.presets.currentLanguage': 'Idioma atual:',
  'dashboard.aio.presets.noneActive': 'Sem preset ativo',
  'dashboard.aio.presets.activeSuffix': '(ativo)',
  'dashboard.aio.presets.new': 'Novo',
  'dashboard.aio.presets.edit': 'Editar',
  'dashboard.aio.presets.delete': 'Excluir',
  'dashboard.aio.presets.saveCurrent': 'Salvar atual',
  'dashboard.aio.presets.openSettings': 'Abrir Presets no Settings',
  'dashboard.aio.presets.presetName': 'Nome do preset',
  'dashboard.aio.presets.namePlaceholder': 'Ex.: OCR JP rápido',
  'dashboard.aio.presets.description': 'Descrição',
  'dashboard.aio.presets.optional': 'Opcional',
  'dashboard.aio.presets.setActiveFor': 'Definir como preset ativo para',
  'dashboard.aio.presets.cancel': 'Cancelar',
  'dashboard.aio.presets.update': 'Atualizar preset',
  'dashboard.aio.presets.create': 'Criar preset',
  'dashboard.aio.translation.selectedSummaryModel':
    'Selecionado: {name}',
  'dashboard.aio.translation.selectedSummaryCustom':
    'Selecionado: {name} (Custom/FREE Provider)',
  'dashboard.aio.translation.selectedSummaryLegacy':
    'Selecionado: {name} (Cloud/API/AI)',
  'dashboard.aio.translation.selectedSummaryEmpty':
    'Selecione um modelo local ou cloud para traduzir no AIO.',
  'dashboard.aio.translation.supportSummary':
    'Modelos locais são baixados sob demanda; modelos cloud/API continuam disponíveis por chave.',
  'dashboard.aio.translation.additionalContextPlaceholder': 'Contexto extra para tradução na nuvem...',
  'dashboard.aio.translation.notesToggle':
    'Gerar e exibir NT separadas da tradução',
  'dashboard.aio.translation.neighborContextToggle':
    'Usar contexto de imagens vizinhas no lote',
  'dashboard.aio.translation.multimodalToggle':
    'Enviar a imagem da página como contexto multimodal',
  'dashboard.aio.translation.activeConfigFor':
    'Configuração ativa para: {value}.',
  'dashboard.aio.customAi.title': 'Custom AI',
  'dashboard.aio.customAi.loadingProfiles': 'Carregando perfis custom...',
  'dashboard.aio.customAi.savedTranslationProfile': 'Perfil salvo de Tradução',
  'dashboard.aio.customAi.newTranslationProfile': 'Novo perfil de tradução',
  'dashboard.aio.customAi.name': 'Nome',
  'dashboard.aio.customAi.translationNamePlaceholder':
    'Ex.: OpenRouter Manga PT-BR',
  'dashboard.aio.customAi.apiBasePlaceholder': 'https://api.example.com/v1',
  'dashboard.aio.customAi.useLocalOllama': 'Preset Ollama Local',
  'dashboard.aio.customAi.apiKeyOptional': 'API Key (opcional)',
  'dashboard.aio.customAi.apiKeyPlaceholder': 'sk-...',
  'dashboard.aio.customAi.translationModelPlaceholder': 'openai/gpt-4.1...',
  'dashboard.aio.customAi.resetTranslation': 'Limpar Tradução',
  'dashboard.aio.customAi.useSavedTranslation': 'Usar Tradução',
  'dashboard.aio.customAi.removeTranslation': 'Remover Tradução',
  'dashboard.aio.customAi.saveTranslation': 'Salvar Tradução',
  'dashboard.aio.customAi.savedOcrProfile': 'Perfil salvo de OCR',
  'dashboard.aio.customAi.newOcrProfile': 'Novo perfil de OCR',
  'dashboard.aio.customAi.ocrNamePlaceholder': 'Ex.: OCR Vision Privado',
  'dashboard.aio.customAi.ocrModelPlaceholder': 'gpt-4.1-mini...',
  'dashboard.aio.customAi.resetOcr': 'Limpar OCR',
  'dashboard.aio.customAi.useSavedOcr': 'Usar OCR',
  'dashboard.aio.customAi.removeOcr': 'Remover OCR',
  'dashboard.aio.customAi.saveOcr': 'Salvar OCR',
  'dashboard.aio.customAi.openAiCompatibleHint':
    'Use uma API OpenAI-compatible.',
  'dashboard.aio.clean.maskDilation': 'Mask Dilation',
  'bugReport.title': 'Reportar Bug',
  'bugReport.subtitle': 'Screenshot + logs automáticos + anexos manuais',
  'bugReport.close': 'Fechar',
  'bugReport.details': 'Detalhes',
  'bugReport.evidence': 'Evidências',
  'bugReport.machineSnapshotIncluded':
    'Inclui snapshot técnico da máquina automaticamente.',
  'bugReport.field.title': 'Título',
  'bugReport.field.description': 'Descrição',
  'bugReport.field.severity': 'Severidade',
  'bugReport.field.steps': 'Passos para reproduzir',
  'bugReport.field.expected': 'Esperado',
  'bugReport.field.actual': 'Obtido',
  'bugReport.field.contact': 'Contato',
  'bugReport.placeholder.title': 'Ex.: Erro ao processar lote no AIO',
  'bugReport.placeholder.description': 'Descreva o problema',
  'bugReport.placeholder.steps': '1. … 2. … 3. …',
  'bugReport.placeholder.contact': 'email, Discord, @user',
  'bugReport.severity.low': 'Baixa',
  'bugReport.severity.medium': 'Média',
  'bugReport.severity.high': 'Alta',
  'bugReport.severity.critical': 'Crítica',
  'bugReport.preparingEvidence': 'Preparando screenshot e logs…',
  'bugReport.dragToCrop': 'Arraste para selecionar recorte opcional.',
  'bugReport.clearCrop': 'Limpar recorte',
  'bugReport.manualAttachments': 'Anexos manuais',
  'bugReport.attach': 'Anexar',
  'bugReport.attach.summary':
    'Máx {count} arquivos, {size}MB cada. Total: {total}.',
  'bugReport.attach.maxCount': 'Máx {count} anexos.',
  'bugReport.attach.fileTooLarge': '{name} > {size}MB.',
  'bugReport.attach.totalTooLarge': 'Total > {size}MB.',
  'bugReport.attach.remove': 'Remover {name}',
  'bugReport.screenshotUnavailable': 'Screenshot indisponível.',
  'bugReport.error.bridgeUnavailable': 'Bridge indisponível.',
  'bugReport.error.prepareFailed': 'Falha ao preparar bug report.',
  'bugReport.error.noScreenshot': 'Nenhum screenshot disponível.',
  'bugReport.error.fillTitleDescription': 'Preencha título e descrição.',
  'bugReport.error.generic': 'Falha.',
  'bugReport.success.sent': 'Report enviado.{screenshot}',
  'bugReport.success.screenshot': 'Screenshot: {url}',
  'bugReport.legalPrefix':
    'Ao enviar, você confirma que revisou screenshot, logs e anexos. Material encaminhado conforme',
  'bugReport.sending': 'Enviando…',
  'bugReport.submit': 'Enviar report',
  'dashboard.topbar.tools': 'Ferramentas',
  'dashboard.topbar.showSidebar': 'Mostrar sidebar',
  'dashboard.topbar.sidebar': 'Sidebar',
  'dashboard.topbar.disableBatch': 'Desativar batch',
  'dashboard.topbar.enableBatch': 'Ativar batch',
  'dashboard.topbar.batchStatus': 'Batch · {count}t',
  'dashboard.topbar.threads': 'Threads',
  'dashboard.topbar.viewMode': 'Visualização',
  'dashboard.topbar.paginated': 'Paginado',
  'dashboard.topbar.longStrip': 'Tira longa',
  'dashboard.topbar.rotate90': 'Rotacionar 90°',
  'dashboard.topbar.selectImage': 'Selecione uma imagem',
  'dashboard.topbar.export': 'Exportação',
  'dashboard.topbar.textFile': 'Arquivo de Texto',
  'dashboard.topbar.textPackage': 'Pacote de Textos',
  'dashboard.topbar.imagePackage': 'Pacote de Imagens',
  'dashboard.topbar.downloadTextAsTxt': 'Baixa a tradução como .txt.',
  'dashboard.topbar.downloadVisualZip':
    'ZIP com .txt de OCR e tradução por imagem.',
  'dashboard.topbar.format': 'Formato',
  'dashboard.topbar.quality': 'Qualidade',
  'dashboard.topbar.package': 'Pacote',
  'dashboard.topbar.rawText': 'Raw Text',
  'dashboard.topbar.translated': 'Translated',
  'dashboard.topbar.inpainted': 'Inpainted',
  'dashboard.topbar.downloadTxt': 'Baixar TXT',
  'dashboard.topbar.downloadZip': 'Baixar ZIP',
  'dashboard.topbar.downloadPackage': 'Baixar Pacote',
  'dashboard.topbar.layeredPsd': 'PSD em Camadas',
  'dashboard.topbar.layeredPsdHint':
    'Exporta PSD para Photoshop, CSP, Krita, GIMP.',
  'dashboard.topbar.compression': 'Compressão',
  'dashboard.topbar.dpi': 'DPI',
  'dashboard.topbar.ocrOverlay': 'OCR Overlay',
  'dashboard.topbar.crops': 'Crops',
  'dashboard.topbar.rawTextLayer': 'Raw text layer',
  'dashboard.topbar.translatedLayer': 'Translated layer',
  'dashboard.topbar.psTextLayers': 'PS Text layers',
  'dashboard.topbar.metadataJson': 'Metadata JSON',
  'dashboard.topbar.photoshopRequired': 'Requer Adobe Photoshop (2025–cc2017).',
  'dashboard.topbar.generating': 'Gerando…',
  'dashboard.topbar.psdWithMeta': 'PSD + Meta',
  'dashboard.topbar.exportPsd': 'Exportar PSD',
  'dashboard.topbar.undoWorkspace': 'Desfazer workspace',
  'dashboard.topbar.undoShortcut': 'Desfazer (Ctrl+Z)',
  'dashboard.topbar.redoWorkspace': 'Refazer workspace',
  'dashboard.topbar.redoShortcut': 'Refazer (Ctrl+Shift+Z / Ctrl+Y)',
  'dashboard.topbar.shortcuts': 'Atalhos',
  'dashboard.topbar.shortcutsHint': 'Atalhos (H)',
  'dashboard.topbar.hideTools': 'Ocultar ferramentas',
  'dashboard.topbar.showTools': 'Mostrar ferramentas',
  'dashboard.topbar.hide': 'Ocultar',
  'dashboard.topbar.profile': 'Perfil',
  'dashboard.topbar.exportWorkspace': 'Exportar workspace',
  'dashboard.topbar.importWorkspace': 'Importar workspace',
  'dashboard.topbar.clearLocalAutosave': 'Limpar autosave local',
  'dashboard.topbar.closeWorkspace': 'Fechar workspace',
  'dashboard.topbar.replayTour': 'Rever tour',
  'dashboard.topbar.scanlationFeed': 'Scanlation Feed',
  'dashboard.topbar.rankings': 'Rankings',
  'dashboard.topbar.logout': 'Sair',
  'dashboard.topbar.brand': 'KŌMA Studio',
  'dashboard.topbar.autoManualBadge': 'A/M',
  'dashboard.topbar.zoomOut': 'Diminuir zoom',
  'dashboard.topbar.zoomIn': 'Aumentar zoom',
  'dashboard.topbar.compressionRle': 'RLE',
  'dashboard.topbar.compressionZip': 'ZIP',
  'dashboard.topbar.compressionRaw': 'RAW',
  'dashboard.topbar.navigation': 'Navegação',
  'dashboard.topbar.optionPng': 'PNG',
  'dashboard.topbar.optionJpeg': 'JPEG',
  'dashboard.topbar.optionWebp': 'WEBP',
  'dashboard.topbar.optionPdf': 'PDF',
  'dashboard.topbar.optionCbz': 'CBZ',
  'dashboard.topbar.optionCb7': 'CB7',
  'dashboard.topbar.optionZip': 'ZIP',
  'renderPreview.circularText': 'Circular Text',
  'settings.aioPresets.description':
    'Combinações de modelos para as 5 etapas do AIO por idioma de origem. Escolha qual preset fica ativo.',
  'settings.aioPresets.catalog': 'Catálogo',
  'settings.aioPresets.syncingCatalog': 'Sincronizando modelos local + nuvem.',
  'settings.aioPresets.editPreset': 'Editar Preset',
  'settings.aioPresets.newPreset': 'Novo Preset',
  'settings.aioPresets.namePlaceholder': 'Ex: Japonês HQ',
  'settings.aioPresets.sourceLanguage': 'Idioma de origem',
  'settings.aioPresets.shortDescription': 'Breve descrição…',
  'settings.aioPresets.select': 'Selecione',
  'settings.aioPresets.noneRegistered': 'Nenhum preset cadastrado.',
  'settings.aioPresets.createFirst': 'Criar primeiro',
  'settings.aioPresets.presetCount': '{count} preset(s)',
  'settings.aioPresets.clearActive': 'Limpar ativo',
  'settings.aioPresets.active': 'Ativo',
  'settings.aioPresets.activate': 'Ativar',
  'settings.aioPresets.editNamed': 'Editar {name}',
  'settings.aioPresets.deleteNamed': 'Excluir {name}',
  'settings.pickerPalette.title': 'Paleta do Picker',
  'settings.pickerPalette.description':
    'Presets sólidos e gradients para os pickers de preenchimento.',
  'settings.pickerPalette.newPreset': 'Novo preset',
  'settings.pickerPalette.add': 'Adicionar',
  'settings.pickerPalette.reset': 'Reset',
  'settings.pickerPalette.hintPrefix': 'Aceita sólidos e gradients. Ex.:',
  'settings.pickerPalette.hintOr': 'ou',
  'settings.pickerPalette.solids': 'Sólidos',
  'settings.pickerPalette.gradients': 'Gradients',
  'settings.modePresets.title': 'Presets de Modo',
  'settings.modePresets.description':
    'Estilo base por modo de texto. Aplicados automaticamente no dashboard.',
  'settings.modePresets.targetMode': 'Modo alvo',
  'settings.modePresets.outline': 'Contorno',
  'settings.modePresets.off': 'Off',
  'settings.modePresets.outlineWidth': 'Largura contorno',
  'settings.modePresets.ocrGradient': 'Gradient OCR',
  'settings.modePresets.detect': 'Detectar',
  'settings.modePresets.ignore': 'Ignorar',
  'settings.modePresets.textColor': 'Cor Texto',
  'settings.modePresets.outlineColor': 'Cor Contorno',
  'settings.modePresets.all': 'Todos',
  'settings.modePresets.mode': 'Modo',
  'settings.modePresets.save': 'Salvar',
  'settings.typographerLibrary.title': 'Biblioteca do Tipógrafo',
  'settings.typographerLibrary.description':
    'Estilos globais com pastas, preset padrão e binding por modo detectado.',
  'settings.typographerLibrary.newFolder': 'Nova pasta',
  'settings.typographerLibrary.defaultPreset': 'Preset padrão',
  'settings.typographerLibrary.none': 'Nenhum',
  'settings.typographerLibrary.edit': 'Editar',
  'settings.typographerLibrary.new': 'Novo',
  'settings.typographerLibrary.presetTypographer': 'Preset Tipógrafo',
  'settings.typographerLibrary.folder': 'Pasta',
  'settings.typographerLibrary.withoutFolder': 'Sem pasta',
  'settings.typographerLibrary.descriptionPlaceholder': 'Ex.: Balão PT-BR',
  'settings.typographerLibrary.padding': 'Padding',
  'settings.typographerLibrary.lineSpacing': 'Line spacing',
  'settings.updates.title': 'Atualizações',
  'settings.updates.currentVersion': 'Versão atual',
  'settings.updates.newVersion': 'Nova versão',
  'settings.updates.status': 'Status',
  'settings.updates.channel': 'Canal',
  'settings.updates.installOnClose': 'Instalar ao fechar',
  'settings.updates.policy': 'Política',
  'settings.updates.mandatory': 'Obrigatório',
  'settings.updates.optional': 'Opcional',
  'settings.updates.lastCheck': 'Última verificação',
  'settings.updates.downloadCompleted': 'Download concluído',
  'settings.updates.channelTitle': 'Canal de atualização',
  'settings.updates.stableDesc': 'Versões testadas e estáveis',
  'settings.updates.betaDesc': 'Acesso antecipado a features',
  'settings.updates.installOnCloseTitle': 'Instalar update ao fechar o app',
  'settings.updates.installOnCloseDesc':
    'Quando o pacote já estiver baixado, a instalação será iniciada automaticamente ao sair.',
  'settings.updates.checking': 'Verificando…',
  'settings.updates.checkNow': 'Verificar atualizações',
  'settings.updates.download': 'Baixar atualização',
  'settings.autosave.title': 'Autosave do Workspace',
  'settings.autosave.description':
    'Controla se o dashboard salva automaticamente o workspace local e qual intervalo usar entre os saves.',
  'settings.autosave.enableTitle': 'Ativar autosave automático',
  'settings.autosave.enableDesc':
    'Quando ativado, o workspace é salvo localmente em intervalos regulares sempre que houver alterações pendentes.',
  'settings.autosave.interval': 'Intervalo',
  'settings.autosave.save': 'Salvar autosave',
  'settings.shortcuts.title': 'Central de Atalhos',
  'settings.shortcuts.description':
    'A configuração oficial dos atalhos agora fica no dashboard, na Topbar. Isso evita divergência entre a tela principal e a página de configurações.',
  'settings.shortcuts.whereToEdit': 'Onde editar',
  'settings.shortcuts.whereToEditDesc': 'Abra o dashboard e use',
  'settings.shortcuts.orPress': 'ou pressione',
  'settings.tabs.ariaLabel': 'Abas de configurações',
  'settings.integrations.test': 'Testar',
  'settings.integrations.testing': 'Testando…',
  'settings.integrations.ok': '✓ OK',
  'settings.integrations.failed': '✗ Falha',
  'settings.integrations.saved': '✓ Salvo',
  'settings.integrations.discord.description':
    'Notificações de processamento, erros e alertas de quota.',
  'settings.integrations.discord.webhookUrl': 'Webhook URL',
  'settings.integrations.discord.webhookPlaceholder':
    'https://discord.com/api/webhooks/…',
  'settings.integrations.discord.botName': 'Nome do Bot',
  'settings.integrations.discord.webhookActive': 'Webhook ativo',
  'settings.integrations.discord.howToSetup': 'Como configurar',
  'settings.integrations.discord.step1': 'No Discord:',
  'settings.integrations.discord.step1Strong':
    'Configurações do Servidor → Integrações → Webhooks → Novo Webhook',
  'settings.integrations.discord.step2': 'Copie a URL e cole no campo acima.',
  'dashboard.dashboardLlm.extraContextPlaceholder':
    'Contexto extra: personagens, tom, glossário…',
  'dashboard.dashboardLlm.temperature': 'Temperature',
  'dashboard.dashboardLlm.topP': 'Top P',
  'dashboard.dashboardLlm.maxTokens': 'Max Tokens',
  'dashboard.dashboardLlm.translationProfile': 'Perfil de Tradução',
  'dashboard.dashboardLlm.translationModelPlaceholder': 'gpt-4.1, claude…',
  'dashboard.dashboardLlm.apiKey': 'API Key',
  'dashboard.dashboardLlm.apiKeyPlaceholder': 'sk-… (opcional)',
  'dashboard.dashboardLlm.ocrProfile': 'Perfil de OCR',
  'dashboard.dashboardLlm.openAiCompatibleHint':
    'OpenAI-compatible. Base pode ser /v1 ou endpoint completo. Alguns aceitam chave vazia.',
  'dashboard.dashboardLlm.clear': 'Limpar',
  'dashboard.dashboardLlm.use': 'Usar',
  'dashboard.dashboardLlm.remove': 'Remover',
  'dashboard.dashboardLlm.save': 'Salvar',
  'dashboard.dashboardLlm.hdStrategy': 'HD Strategy',
  'dashboard.dashboardLlm.resize': 'Resize',
  'dashboard.dashboardLlm.crop': 'Crop',
  'dashboard.dashboardLlm.original': 'Original',
  'dashboard.dashboardLlm.hdStrategyHint':
    'Estratégia para imagens grandes antes do inpainting.',
  'dashboard.dashboardLlm.resizeLimit': 'Resize Limit',
  'dashboard.dashboardLlm.cropMargin': 'Crop Margin',
  'dashboard.dashboardLlm.cropTriggerSize': 'Crop Trigger Size',
  'dashboard.dashboardRegion.title': 'Região',
  'dashboard.dashboardRegion.blocks': 'Blocos',
  'dashboard.dashboardRegion.selection': 'Seleção',
  'dashboard.dashboardRegion.ocr': 'OCR',
  'dashboard.dashboardRegion.translation': 'Tradução',
  'dashboard.dashboardRegion.notes': 'Notas',
  'dashboard.dashboardRegion.segments': 'Segmentos',
  'dashboard.dashboardRegion.disabled': 'desativado',
  'dashboard.dashboardRegion.manualHint':
    'Arraste no preview para adicionar áreas. Use cantos para redimensionar.',
  'dashboard.dashboardRegion.manualModeHint':
    'Modo Manual para ajustar caixas.',
  'dashboard.dashboardRegion.dockHint':
    'Use o dock flutuante no canvas para selecionar área, limpar e editar. Ferramentas habilitadas conforme a etapa ativa.',
  'dashboard.translator.workspace.ariaLabel': 'Modo do tradutor',
  'dashboard.translator.sourceTitle': 'Texto Fonte',
  'dashboard.translator.sourceDescription':
    'Cole, importe e traduza preservando parágrafos e quebras.',
  'dashboard.translator.sourcePlaceholder':
    'Cole aqui o capítulo ou trecho para traduzir…',
  'dashboard.translator.sourceAria': 'Texto fonte para tradução',
  'dashboard.translator.import': 'Importar',
  'dashboard.translator.translating': 'Traduzindo…',
  'dashboard.translator.translate': 'Traduzir',
  'dashboard.translator.editorCleared': 'Editor limpo.',
  'dashboard.translator.clear': 'Limpar',
  'dashboard.translator.resultTitle': 'Resultado',
  'dashboard.translator.resultModelPrefix': 'Modelo: {value}',
  'dashboard.translator.resultPlaceholder': 'Execute para ver o resultado.',
  'dashboard.translator.resultFieldPlaceholder': 'A tradução aparecerá aqui…',
  'dashboard.translator.resultPlaceholderAria': 'Resultado da tradução',
  'dashboard.translator.editorDirty':
    'Texto fonte alterado. Re-execute para atualizar.',
  'dashboard.translator.resultCopied': 'Resultado copiado.',
  'dashboard.translator.copy': 'Copiar',
  'dashboard.translator.downloadTxt': 'Baixar TXT',
  'dashboard.translator.modeLabel': 'Tradutor',
  'dashboard.translator.workspace.textHint':
    'Traduza texto livre preservando parágrafos e quebras.',
  'dashboard.translator.workspace.visualHint':
    'Detecte regiões, OCR e traduza por boxes nas imagens.',
  'dashboard.translator.processing.standard': 'Standard',
  'dashboard.translator.processing.aiSfx': 'AI SFX',
  'dashboard.language.source': 'Idioma origem',
  'dashboard.language.target': 'Idioma destino',
  'dashboard.models.title': 'Modelos',
  'dashboard.translator.ocr': 'OCR',
  'dashboard.translator.ocr.manageModels': 'Gerenciar modelos de OCR',
  'dashboard.translator.noneAvailable': 'Nenhum modelo',
  'dashboard.translator.device': 'Device',
  'dashboard.translator.languages': 'Idiomas',
  'dashboard.translator.multi': 'multi',
  'dashboard.translator.noDescription': 'Sem descrição.',
  'dashboard.translator.localStatus': 'Status local: {value}',
  'dashboard.translator.sfx.cleanModel': 'Cleaner SFX',
  'dashboard.translator.sfx.hint':
    'Ex.: prefira SFX curtos e pesados, seja mais conservador quando o efeito estiver misturado em line art fina.',
  'dashboard.translator.llm.contextPlaceholder':
    'Contexto: glossário, tom, personagens…',
  'dashboard.translator.llm.generateNotes': 'Gerar NT separadas',
  'dashboard.translator.llm.multimodalContext':
    'Imagem como contexto multimodal',
  'dashboard.translator.llm.temperature': 'Temperature',
  'dashboard.translator.llm.topP': 'Top P',
  'dashboard.translator.llm.maxTokens': 'Max Tokens',
  'dashboard.translator.execute.title': 'Executar',
  'dashboard.translator.loadImage': 'Carregar',
  'dashboard.translator.detectTranslate': 'Detectar + Traduzir',
  'dashboard.translator.retranslateImage': 'Retraduzir imagem',
  'dashboard.translator.retranslateRegion': 'Retraduzir região',
  'dashboard.translator.regionTitle': 'Região',
  'dashboard.translator.blocks': 'Blocos',
  'dashboard.translator.selection': 'Seleção',
  'dashboard.translator.translation': 'Tradução',
  'dashboard.translator.notes': 'Notas',
  'dashboard.translator.none': 'nenhuma',
  'dashboard.translator.charactersTranslated':
    '{count} caractere(s) traduzido(s).',
  'splitter.workspace.emptyTitle': 'Carregue uma imagem',
  'splitter.workspace.emptyDescription':
    'Use a sidebar esquerda para importar páginas. O preview mostra cortes sugeridos e segmentos gerados.',
  'splitter.workspace.previewTitle': 'Preview de cortes',
  'splitter.workspace.previewDescription':
    'Duplo clique para adicionar corte. Arraste as linhas para ajustar.',
  'splitter.workspace.previewAlt': 'Preview de {name}',
  'splitter.workspace.cutTitle': 'Corte {index}',
  'splitter.workspace.hide': 'Ocultar',
  'splitter.workspace.show': 'Mostrar',
  'splitter.workspace.recalculate': 'Recalcular',
  'splitter.workspace.diagnostics': 'Diagnóstico',
  'splitter.workspace.engine': 'Engine',
  'splitter.workspace.cuts': 'Cortes',
  'splitter.workspace.segments': 'Segmentos',
  'splitter.workspace.whitespace': 'Whitespace',
  'splitter.workspace.noWarnings': 'Sem alertas para a imagem ativa.',
  'splitter.workspace.cutsTitle': 'Cortes ({count})',
  'splitter.workspace.cutCard': 'Corte #{index}',
  'splitter.workspace.locked': 'Travado',
  'splitter.workspace.unlocked': 'Livre',
  'splitter.workspace.merge': 'Merge',
  'splitter.workspace.segmentsTitle': 'Segmentos ({count})',
  'splitter.workspace.segmentAlt': 'Segmento {index}',
  'splitter.workspace.segmentCard': 'Segmento #{index}',
  'splitter.workspace.analyzing': 'Analisando…',
  'splitter.workspace.dimensions': 'Dimensões',
  'splitter.workspace.axis': 'Eixo',
  'splitter.workspace.strategy': 'Estratégia',
  'splitter.sidebar.title': 'Splitter',
  'splitter.sidebar.recipe': 'Recipe',
  'splitter.sidebar.preset': 'Preset',
  'splitter.sidebar.mode': 'Modo',
  'splitter.sidebar.direction': 'Direção',
  'splitter.sidebar.vertical': 'Vertical',
  'splitter.sidebar.horizontal': 'Horizontal',
  'splitter.sidebar.parts': 'Partes',
  'splitter.sidebar.targetHeight': 'Altura alvo',
  'splitter.sidebar.minimum': 'Mínimo',
  'splitter.sidebar.maximum': 'Máximo',
  'splitter.sidebar.adjustments': 'Ajustes',
  'splitter.sidebar.overlap': 'Overlap ({value}px)',
  'splitter.sidebar.whitespace': 'Whitespace ({value})',
  'splitter.sidebar.noise': 'Noise ({value})',
  'splitter.sidebar.edgeGuard': 'Edge Guard ({value}px)',
  'splitter.sidebar.protectTallBlocks': 'Proteger blocos altos',
  'splitter.sidebar.baseName': 'Nome base',
  'splitter.sidebar.baseNamePlaceholder': 'koma-split',
  'splitter.sidebar.suffix': 'Sufixo',
  'splitter.sidebar.suffixPlaceholder': '{image}-part-{index}',
  'splitter.sidebar.tokensPrefix': 'Tokens:',
  'splitter.sidebar.tokensAnd': 'e',
  'splitter.sidebar.actions': 'Ações',
  'splitter.sidebar.imagesCount': '{count} img.',
  'splitter.sidebar.activeImage': 'Ativa: {name}',
  'splitter.sidebar.selectImage': 'Selecione uma imagem.',
  'splitter.sidebar.reanalyze': 'Reanalisar',
  'splitter.sidebar.applyToActive': '→ Ativa',
  'splitter.sidebar.applyToAll': '→ Todas',
  'splitter.sidebar.clearCuts': 'Limpar cortes',
  'splitter.sidebar.resetRecipe': 'Resetar recipe',
  'splitter.sidebar.exportActive': 'Exportar ativa',
  'splitter.sidebar.exportBatch': 'Exportar lote',
  'splitter.sidebar.directoryUnavailable': 'showDirectoryPicker indisponível.',
  'splitter.sidebar.exportToFolder': 'Exportar para pasta',
  'stitch.workspace.cancelled': 'Renderização do Stitcher cancelada.',
  'stitch.workspace.renderingBatch': 'Renderizando lote {current}/{total}...',
  'stitch.workspace.batchReady': 'Lote {current} pronto para download.',
  'stitch.workspace.generatingZip': 'Gerando {count} lote(s) do Stitcher...',
  'stitch.workspace.zipReady':
    'Pacote ZIP com {count} lote(s) gerado com sucesso.',
  'stitch.workspace.savingToFolder': 'Salvando {count} lote(s) em pasta...',
  'stitch.workspace.folderReady': 'Lotes exportados na pasta selecionada.',
  'stitch.workspace.folderCancelled': 'Exportação em pasta cancelada.',
  'stitch.workspace.noBatchSelected': 'Sem lote selecionado',
  'stitch.workspace.previewEyebrow': 'Preview do Lote',
  'stitch.workspace.batchTitle': 'Lote {current} de {total}',
  'stitch.workspace.noBatchAvailable': 'Nenhum lote disponível',
  'stitch.workspace.imagesCount': '{count} imagem(ns)',
  'stitch.workspace.previousBatch': 'Lote anterior',
  'stitch.workspace.nextBatch': 'Próximo lote',
  'stitch.workspace.zoomOut': 'Reduzir zoom',
  'stitch.workspace.resetZoom': 'Resetar zoom',
  'stitch.workspace.zoomIn': 'Aumentar zoom',
  'stitch.workspace.exporting': 'Exportando…',
  'stitch.workspace.exportBatch': 'Exportar lote',
  'stitch.workspace.zip': 'ZIP',
  'stitch.workspace.folder': 'Pasta',
  'stitch.workspace.cancel': 'Cancelar',
  'stitch.workspace.emptyTitle': 'Nenhum lote pronto',
  'stitch.workspace.emptyDescription':
    'Carregue imagens no Dashboard e configure os lotes na caixa de ferramentas da sidebar direita.',
  'stitch.workspace.generatingPreview': 'Gerando preview {progress}%',
  'stitch.workspace.previewAlt': 'Preview do lote costurado',
  'stitch.workspace.errorTitle': 'Falha no Stitcher',
  'stitch.workspace.planningEyebrow': 'Planejamento',
  'stitch.workspace.planningTitle': '{count} lote(s) planejado(s)',
  'stitch.workspace.planningSubtitle':
    'Revise lotes pesados e navegue pelo planejamento.',
  'stitch.workspace.baseLabel': 'Base:',
  'stitch.workspace.batchCardTitle': 'Lote {index}',
  'stitch.workspace.batchCardDims': '{count} img · {width}×{height}',
  'stitch.workspace.activeBatch': 'Lote ativo',
  'stitch.workspace.stats.images': 'Imagens',
  'stitch.workspace.stats.output': 'Saída',
  'stitch.workspace.stats.size': 'Tamanho',
  'stitch.workspace.stats.preview': 'Preview',
  'stitch.workspace.awaiting': 'Aguardando',
  'stitch.workspace.toolboxTitle': 'Caixa de ferramentas',
  'stitch.workspace.toolboxDescription':
    'As configurações e ajustes de fronteira ficam na sidebar direita.',
  'stitch.sidebar.title': 'Stitcher',
  'stitch.sidebar.layout': 'Layout',
  'stitch.sidebar.layoutMode': 'Modo de costura',
  'stitch.sidebar.vertical': 'Vertical',
  'stitch.sidebar.horizontal': 'Horizontal',
  'stitch.sidebar.strategy': 'Estratégia',
  'stitch.sidebar.fixedCount': 'Quantidade fixa',
  'stitch.sidebar.targetAxis': 'Meta por eixo',
  'stitch.sidebar.single': 'Tudo em um',
  'stitch.sidebar.imagesPerBatch': 'Imagens por lote',
  'stitch.sidebar.spacing': 'Espaçamento ({value}px)',
  'stitch.sidebar.alignment': 'Alinhamento',
  'stitch.sidebar.start': 'Start',
  'stitch.sidebar.center': 'Center',
  'stitch.sidebar.end': 'End',
  'stitch.sidebar.output': 'Saída',
  'stitch.sidebar.background': 'Fundo',
  'stitch.sidebar.backgroundColor': 'Cor de fundo',
  'stitch.sidebar.baseName': 'Nome base',
  'stitch.sidebar.baseNamePlaceholder': 'koma-stitch',
  'stitch.sidebar.imagesInfo':
    '{count} imagem(ns). A ordem atual define os lotes.',
  'stitch.sidebar.recalculate': 'Recalcular lotes',
  'stitch.sidebar.boundary': 'Fronteira',
  'stitch.sidebar.boundaryBatch': 'Lote {current}/{total} · {count} img',
  'stitch.sidebar.noBatch': 'Nenhum lote',
  'stitch.sidebar.moveLastToNext': 'Última → próximo',
  'stitch.sidebar.pullFromNext': 'Puxar do próximo',
  'modelManager.filters.catalog': 'Catálogo',
  'modelManager.filters.all': 'Todos',
  'modelManager.filters.local': 'Local',
  'modelManager.filters.cloud': 'Cloud',
  'modelManager.filters.language': 'Idioma',
  'modelManager.filters.status': 'Status',
  'modelManager.filters.installed': 'Instalados',
  'modelManager.filters.notInstalled': 'Não instalados',
  'modelManager.filters.updateAvailable': 'Update disponível',
  'modelManager.tooltip.speed.fast': 'Rápida',
  'modelManager.tooltip.speed.good': 'Boa',
  'modelManager.tooltip.speed.excellent': 'Excelente',
  'modelManager.tooltip.allLanguages': 'Todos os idiomas suportados',
  'modelManager.tooltip.infoAria': 'Informações do modelo {name}',
  'modelManager.tooltip.info': 'Info',
  'modelManager.tooltip.aioStage': 'Etapa AIO',
  'modelManager.tooltip.description': 'Descrição',
  'modelManager.tooltip.languages': 'Idiomas',
  'modelManager.tooltip.speed.label': 'Velocidade',
  'modelManager.tooltip.minimum': 'Mínimo',
  'modelManager.tooltip.downloadSize': 'Tamanho download',
  'modelManager.tooltip.diskSpace': 'Espaço em disco',
  'modelManager.tooltip.version': 'Versão',
  'modelManager.status.installed': 'Instalado',
  'modelManager.status.updateAvailable': 'Update disponível',
  'modelManager.status.downloading': 'Baixando',
  'modelManager.status.queued': 'Na fila',
  'modelManager.status.verifying': 'Verificando',
  'modelManager.status.failed': 'Falhou',
  'modelManager.status.cancelled': 'Cancelado',
  'modelManager.status.incomplete': 'Incompleto',
  'modelManager.status.notInstalled': 'Não instalado',
  'modelManager.actions.selected': 'Selecionado',
  'modelManager.actions.useModel': 'Usar modelo',
  'modelManager.actions.uninstall': 'Desinstalar',
  'modelManager.actions.update': 'Atualizar',
  'modelManager.actions.retry': 'Tentar novamente',
  'modelManager.actions.install': 'Instalar',
  'modelManager.actions.source': 'Fonte',
  'modelCard.status.selected': 'Selecionado',
  'modelCard.status.failed': 'Falha',
  'modelCard.status.verifying': 'Verificando…',
  'modelCard.status.queued': 'Na fila…',
  'modelCard.status.downloading': 'Baixando…',
  'modelCard.status.cancelled': 'Cancelado',
  'modelCard.status.incomplete': 'Incompleto',
  'modelCard.status.notInstalled': 'Não instalado',
  'modelCard.action.cancel': 'Cancelar',
  'modelCard.action.remove': 'Remover',
  'modelCard.action.update': 'Update',
  'modelCard.action.install': 'Instalar',
  'modelCard.action.retry': 'Retry',
  'modelCard.action.active': 'Ativo',
  'modelCard.action.use': 'Usar',
  'modelManager.stage.translate': 'Obter Traduções',
  'modelManager.installAll.attention': 'Atenção',
  'modelManager.installAll.warning':
    'Você está prestes a baixar TODOS os modelos de tradução.',
  'modelManager.installAll.totalSize': 'Tamanho total: {size}',
  'modelManager.installAll.space': 'Espaço disponível: {space}',
  'modelManager.installAll.time': 'Tempo estimado: depende da sua conexão',
  'modelManager.installAll.notEnoughSpace':
    'Espaço insuficiente. Necessário: {required} | Disponível: {available}',
  'modelManager.installAll.confirm':
    'Isso pode levar bastante tempo e ocupar espaço significativo. Deseja continuar?',
  'modelManager.installAll.confirmDownload': 'Confirmar Download',
  'modelManager.disk.notVerified': 'Disco não verificado',
  'modelManager.disk.free': '{space} livre',
  'modelManager.disk.models': '{installed}/{total} modelos ({size})',
  'modelManager.enhance.title': 'Modelos de Melhorar',
  'modelManager.enhance.description':
    'Catálogo local exclusivo do enhancer. Instale, atualize, desinstale ou importe um ONNX.',
  'modelManager.enhance.freeSpace': 'Espaço livre',
  'modelManager.enhance.notChecked': 'não verificado',
  'modelManager.enhance.closeAria': 'Fechar modal de modelos de melhorar',
  'modelManager.enhance.directInstall': 'Instalação direta',
  'modelManager.enhance.directInstallDesc':
    'Modelos curados com download direto ou instalação gerenciada no mini-backend.',
  'modelManager.enhance.manualImport': 'Importação manual',
  'modelManager.enhance.manualImportDesc':
    'Modelos exibidos no catálogo, mas que entram por ONNX local. Use conversão externa quando só houver `.pth`.',
  'modelManager.enhance.importOnnxBadge': 'Importação ONNX',
  'modelManager.enhance.statusLabel': 'Status',
  'modelManager.enhance.estimatedDisk': 'Disco estimado',
  'modelManager.enhance.reimportOnnx': 'Reimportar ONNX',
  'modelManager.enhance.pthHint': 'Para pesos em',
  'modelManager.enhance.pthHintSuffix':
    'converta primeiro para ONNX e depois use a importação manual.',
  'common.yes': 'Sim',
  'dashboard.organize.hint.reorder':
    'Arraste e reordene os arquivos no painel esquerdo.',
  'dashboard.organize.hint.rotate':
    'Use o botão de rotação para corrigir páginas escaneadas na horizontal.',
  'guides.common.beginner': 'Iniciante',
  'guides.common.intermediate': 'Intermediário',
  'guides.common.advanced': 'Avançado',
  'guides.home.title': 'Guias & Tutoriais',
  'guides.home.description':
    'Aprenda a dominar cada ferramenta do KŌMA Studio com guias passo a passo, dicas de produtividade e exemplos reais.',
  'guides.home.searchPlaceholder': 'Buscar guias, atalhos, dicas...',
  'guides.home.searchAria': 'Buscar guias',
  'guides.home.continueReading': 'Continue onde parou',
  'guides.home.stepProgress': 'Passo {current} de {total} · {time}',
  'guides.home.continueCta': 'Continuar →',
  'guides.home.categories': 'Categorias',
  'guides.home.guidesCountLabel': 'guia{suffix}',
  'guides.home.completedCountLabel': 'concluído{suffix}',
  'guides.home.guidesPluralSuffix': 's',
  'guides.home.saved': 'Salvos ({count})',
  'guides.reader.backToGuides': 'Voltar para Guias',
  'guides.reader.notFound': 'Guia não encontrado',
  'guides.reader.progressAria': 'Progresso do guia',
  'guides.reader.stepsAria': 'Passos do guia',
  'guides.reader.stepLabel': 'Passo {index}',
  'guides.reader.recent': 'Recentes',
  'guides.reader.guides': 'Guias',
  'guides.reader.removeBookmark': 'Remover bookmark',
  'guides.reader.saveBookmark': 'Salvar bookmark',
  'guides.reader.previous': 'Anterior',
  'guides.reader.next': 'Próximo',
  'guides.reader.completeGuide': 'Concluir Guia',
  'guides.detail.back': 'Voltar',
  'guides.detail.notFound': 'Guia não encontrado.',
  'guides.detail.stepsAria': 'Passos do guia',
  'guides.detail.stepLabel': 'Passo {index}',
  'guides.detail.recent': 'Recentes',
  'guides.detail.guides': 'Guias',
  'guides.detail.stepCounter': 'Passo {current} de {total}',
  'guides.detail.previous': 'Anterior',
  'guides.detail.next': 'Próximo',
  'guides.detail.complete': 'Concluir',
  'guides.detail.completed': 'Concluído ✓',
  'guides.detail.tocAria': 'Índice',
  'guides.detail.inThisGuide': 'Neste guia',
  'guides.detail.removeFavorite': 'Remover favorito',
  'guides.detail.addFavorite': 'Adicionar favorito',
  'guides.detail.saved': 'Salvo',
  'guides.detail.save': 'Salvar',
  'guides.step.copyCode': 'Copiar código',
  'guides.step.copied': 'Copiado',
  'guides.step.copy': 'Copiar',
  'guides.search.dialogAria': 'Buscar guias',
  'guides.search.placeholder': 'Buscar guias, atalhos, dicas...',
  'guides.search.inputAria': 'Buscar',
  'guides.search.close': 'Fechar busca',
  'guides.search.noResults': 'Nenhum resultado para "{query}"',
  'guides.search.results': 'Resultados ({count})',
  'guides.search.recent': 'Recentes',
  'guides.search.navigate': 'navegar',
  'guides.search.open': 'abrir',
  'guides.search.closeVerb': 'fechar',
  'guides.category.searchPlaceholder': 'Buscar em {category}...',
  'guides.category.searchAria': 'Buscar em {category}',
  'guides.category.noSearchResults': 'Nenhum guia para "{query}"',
  'guides.category.noGuides': 'Nenhum guia nesta categoria',
  'guides.category.tryOtherTerms': 'Tente outros termos.',
  'guides.category.comingSoon': 'Novos guias serão adicionados em breve.',
  'guides.category.completed': 'Concluído',
  'settings.profile.title': 'Perfil do Usuário',
  'settings.profile.name': 'Nome',
  'settings.profile.email': 'Email',
  'settings.profile.verification': 'Verificação',
  'settings.profile.accountId': 'ID da conta',
  'settings.profile.environment': 'Ambiente',
  'settings.profile.unspecified': 'Não informado',
  'settings.profile.verified': 'Verificado',
  'settings.profile.pending': 'Pendente',
  'settings.profile.sendVerification': 'Enviar email de verificação',
  'settings.profile.legalCenter': 'Central jurídica',
  'settings.travel.title': 'Acesso em Viagem',
  'settings.travel.description':
    'Autorize temporariamente um computador secundário sem trocar o dispositivo principal vinculado à conta.',
  'settings.travel.destination': 'Destino do token',
  'settings.travel.expiry': 'Validade do código',
  'settings.travel.temporaryAccess': 'Acesso temporário',
  'settings.travel.streamLike': 'Fluxo inspirado em plataformas de streaming',
  'settings.travel.streamLikeDesc':
    'O código é enviado para o email da conta e libera acesso temporário em outro PC.',
  'settings.travel.sendToken': 'Enviar token para meu email',
  'settings.travel.destinationPrefix': 'Destino: {value}',
  'settings.travel.expirationPrefix': 'Expira: {value}',
  'settings.travel.accessPrefix': 'Acesso: {value}',
  'settings.travel.definedOnSend': 'Definido no envio',
  'settings.plan.day': 'dia',
  'settings.plan.days': 'dias',
  'settings.typography.default': 'Padrão',
  'settings.typography.bindingsTitle': 'Bindings por modo detectado',
  'settings.typography.useDefault': 'Usar padrão',
  'settings.integrations.blogger.description':
    'Storage/CDN para imagens e publicação de posts.',
  'settings.integrations.blogger.label': 'Label',
  'settings.integrations.blogger.labelPlaceholder': 'Blogger principal',
  'settings.integrations.blogger.blogId': 'Blog ID',
  'settings.integrations.blogger.blogIdPlaceholder': 'ID numérico',
  'settings.integrations.blogger.clientId': 'Client ID',
  'settings.integrations.blogger.clientIdPlaceholder': 'Google OAuth Client ID',
  'settings.integrations.blogger.clientSecret': 'Client Secret',
  'settings.integrations.blogger.clientSecretPlaceholder':
    'OAuth Client Secret',
  'settings.integrations.blogger.refreshToken': 'Refresh Token',
  'settings.integrations.blogger.refreshTokenPlaceholder': 'Refresh Token',
  'settings.integrations.blogger.defaultLabels': 'Labels padrão',
  'settings.integrations.blogger.defaultLabelsPlaceholder':
    'manga, chapter, release',
  'settings.integrations.blogger.optimizer': 'Optimizer',
  'settings.integrations.blogger.optimizerCloudinary': 'Cloudinary Fetch',
  'settings.integrations.blogger.optimizerTemplate': 'Template URL',
  'settings.integrations.blogger.cloudName': 'Cloud Name',
  'settings.integrations.blogger.urlTemplate': 'URL Template',
  'settings.integrations.blogger.cloudNamePlaceholder': 'meu-cloud-name',
  'settings.integrations.blogger.cloudinaryTransformation':
    'Cloudinary transformation',
  'settings.integrations.blogger.optimizerEnabled': 'Optimizer ativo',
  'settings.integrations.blogger.maxWidth': 'Max Width',
  'settings.integrations.blogger.maxHeight': 'Max Height',
  'settings.integrations.blogger.testConnection': 'Testar conexão',
  'settings.integrations.blogger.requestsPerDay': 'Requests/dia',
  'settings.integrations.blogger.requestsPerUser': 'Requests/user',
  'settings.integrations.blogger.credentialsGuideTitle':
    'Como obter credenciais',
  'settings.integrations.blogger.step1': 'Acesse',
  'settings.integrations.blogger.step1Suffix': 'crie ou selecione um projeto.',
  'settings.integrations.blogger.step2': 'Ative a',
  'settings.integrations.blogger.step2And': 'e a',
  'settings.integrations.blogger.step3': 'Crie um',
  'settings.integrations.blogger.webApplication': 'Web application',
  'settings.integrations.blogger.step4': 'Adicione',
  'settings.integrations.blogger.step4Suffix': 'em Redirect URIs.',
  'settings.integrations.blogger.step5': 'Copie',
  'settings.integrations.blogger.step5And': 'e',
  'settings.integrations.blogger.step6':
    'Configure a OAuth consent screen. Se em Testing, adicione seu email.',
  'settings.integrations.blogger.step7': 'No',
  'settings.integrations.blogger.step7Suffix':
    'ative seus próprios credentials e autorize escopos do Blogger + Drive.',
  'settings.integrations.blogger.step8': 'Faça',
  'settings.integrations.blogger.step8Suffix': 'e copie o',
  'settings.integrations.blogger.step9': 'Para Cloudinary, copie o',
  'settings.integrations.blogger.step9Suffix': 'e configure a transformação.',
  'settings.integrations.blogger.step10': 'Descubra o',
  'settings.integrations.blogger.step10Suffix': 'via URL/API do Blogger.',
  'settings.integrations.blogger.step11':
    'Salve tudo, teste a conexão e use o utilitário no dashboard.',
  'settings.integrations.blogger.googleQuotas': 'Google Quotas',
  'settings.integrations.blogger.oauthPlayground': 'OAuth Playground',
  'settings.integrations.blogger.cloudinaryFetch': 'Cloudinary Fetch',
  'settings.integrations.blogger.driveScopes': 'Drive Scopes',
  'settings.integrations.blogger.driveScopesGuideTitle':
    'Escopos do Drive no OAuth Playground',
  'settings.integrations.blogger.minimumPractical': 'Mínimo prático:',
  'settings.integrations.blogger.driveScopesNote':
    'Consulte outros escopos na documentação oficial do Drive API v3.',
  'settings.integrations.imgur.title': 'Imgur Upload',
  'settings.integrations.imgur.description':
    'Upload anônimo com rotação de Client IDs e rate limit conservador.',
  'settings.integrations.imgur.limitPerHour': 'Limite/hora',
  'settings.integrations.imgur.batchDelay': 'Delay batch (ms)',
  'settings.integrations.imgur.remaining': 'Restante',
  'settings.integrations.imgur.used': 'Usadas: {used}/{limit}',
  'settings.integrations.imgur.reset': 'reset: {value}',
  'settings.integrations.imgur.clientIds': 'Client IDs',
  'settings.integrations.imgur.noClientIds': 'Nenhuma Client ID configurada.',
  'settings.integrations.imgur.clientIdPlaceholder': 'Imgur Client ID',
  'settings.integrations.imgur.quickGuideTitle': 'Guia rápido do Imgur',
  'settings.integrations.imgur.step1':
    'Crie uma aplicação no painel de developers do Imgur e copie a',
  'settings.integrations.imgur.step2':
    'Adicione uma ou mais Client IDs. O app escolhe aleatoriamente.',
  'settings.integrations.imgur.step3': 'Upload anônimo com',
  'settings.integrations.imgur.step3Suffix': 'Sem OAuth.',
  'settings.integrations.imgur.step4': 'Limiter conservador:',
  'settings.integrations.imgur.step4Suffix': 'para evitar bloqueios.',
  'settings.integrations.imgur.step5':
    'Envio sequencial respeitando o delay configurado.',
  'settings.integrations.imgur.step6':
    'Imgur não deve ser tratado como CDN garantido.',
  'settings.integrations.imgur.imageApi': 'Imgur Image API',
  'settings.integrations.imgur.uploading': 'Imgur Uploading',
  'common.add': 'Adicionar',
  'common.label': 'Label',
  'common.original': 'Original',
  'common.quality': 'Qualidade',
  'common.persistence': 'Persistência',
  'common.secureStore': 'Secure store',
  'common.browserFallback': 'Browser fallback',
  'common.notAvailableShort': '—',
  'common.loading': 'Carregando',
  'common.sending': 'Enviando…',
  'common.single': 'Único',
  'common.tile': 'Ladrilho',
  'common.grid': 'Grade',
  'common.smart': 'Inteligente',
  'common.multi': 'Multi',
  'blogger.title': 'Blogger CDN',
  'blogger.heroTitle': 'Publicar e hospedar imagens no Blogger',
  'blogger.heroDescription':
    'Modo Publicar para posts com editor visual/HTML. Modo Upload para gerar URLs hospedadas.',
  'blogger.ready': 'Pronto',
  'blogger.configureInSettings': 'Configure em Settings',
  'blogger.publishTab': 'Publicar',
  'blogger.uploadTab': 'Upload',
  'blogger.settings': 'Settings',
  'blogger.missingConfigTitle': 'Configuração ausente',
  'blogger.missingConfigBody': 'Salve credenciais em Settings antes de usar.',
  'blogger.post.title': 'Post',
  'blogger.post.description': 'Título, labels e publicação.',
  'blogger.post.postTitle': 'Título',
  'blogger.post.postTitlePlaceholder': 'Título do post',
  'blogger.post.defaultLabels': 'Labels padrão',
  'blogger.post.defaultLabelsPlaceholder': 'manga, chapter',
  'blogger.post.postLabels': 'Labels do post',
  'blogger.post.postLabelsPlaceholder': 'review',
  'blogger.post.publishNow': 'Publicar agora',
  'blogger.post.draft': 'Rascunho',
  'blogger.post.publish': 'Publicar',
  'blogger.post.status.draft': 'salvo como rascunho',
  'blogger.post.status.published': 'publicado',
  'blogger.template.title': 'Novo post do Blogger',
  'blogger.template.description':
    'Escreva aqui o conteúdo do post. Você pode alternar entre visual, HTML e preview.',
  'blogger.template.insertPrefix': 'Use o botão',
  'blogger.template.insertSuffix':
    'para enviar arquivos ao Blogger e colocar as URLs hospedadas no conteúdo.',
  'blogger.editor.title': 'Editor',
  'blogger.editor.description': 'Visual, HTML e preview.',
  'blogger.editor.visual': 'Visual',
  'blogger.editor.preview': 'Preview',
  'blogger.editor.h1': 'H1',
  'blogger.editor.h2': 'H2',
  'blogger.editor.bold': 'Bold',
  'blogger.editor.italic': 'Italic',
  'blogger.editor.underline': 'Underline',
  'blogger.editor.list': 'List',
  'blogger.editor.numbered': 'Numbered',
  'blogger.editor.quote': 'Quote',
  'blogger.editor.link': 'Link',
  'blogger.editor.promptUrl': 'URL',
  'blogger.editor.insertImages': 'Inserir imagens',
  'blogger.copied': 'Copiado',
  'blogger.loadConfigFailed': 'Falha ao carregar a configuração do Blogger.',
  'blogger.imageInsertedSingle':
    'Imagem hospedada no Blogger e inserida no editor.',
  'blogger.imageInsertedMany':
    '{count} imagens hospedadas no Blogger e inseridas no editor.',
  'blogger.uploadFailed': 'Falha ao enviar imagens para o Blogger.',
  'blogger.batchUploadSingle':
    'Upload concluído em uma única postagem draft do Blogger.',
  'blogger.batchUploadMany':
    '{count} imagens enviadas em uma única postagem draft do Blogger.',
  'blogger.uploadFailedShort': 'Falha no upload.',
  'blogger.batchUploadSuccessSingle':
    'Upload concluído em uma única postagem draft do Blogger.',
  'blogger.batchUploadSuccessMany':
    '{count} imagens enviadas em uma única postagem draft do Blogger.',
  'blogger.publishSuccessWithUrl': 'Post {verb} no Blogger. URL: {url}',
  'blogger.publishSuccessWithId': 'Post {verb} no Blogger com ID {id}.',
  'blogger.publishFailed': 'Falha ao publicar no Blogger.',
  'blogger.uploadSection.title': 'Upload em lote',
  'blogger.uploadSection.description':
    'Arraste imagens para gerar URLs hospedadas.',
  'blogger.uploadSection.dropTitle': 'Solte imagens aqui',
  'blogger.uploadSection.dropDescription':
    'PNG, JPG, WebP com preprocess local.',
  'blogger.uploadSection.optimizedUrl': 'URL optimized',
  'blogger.uploadSection.optimizedUrlDesc':
    'Gera URL otimizada antes do upload.',
  'blogger.uploadSection.exportOptimized': 'Exportar optimized',
  'blogger.uploadSection.exportOptimizedDesc':
    'Usa URL otimizada nas ações em lote.',
  'blogger.uploadSection.outputImg': 'Saída <img>',
  'blogger.uploadSection.outputImgDesc': 'Snippets HTML em vez de URLs.',
  'blogger.uploadSection.select': 'Selecionar',
  'blogger.uploadSection.send': 'Enviar',
  'blogger.uploadSection.exported': 'Exportado',
  'blogger.queue.title': 'Fila',
  'blogger.queue.items': '{count} item(ns)',
  'blogger.queue.empty': 'Nenhum arquivo.',
  'blogger.queue.altText': 'Alt text',
  'blogger.queue.canonical': 'Canonical',
  'blogger.queue.optimized': 'Optimized',
  'blogger.queue.url': 'URL',
  'blogger.queue.opt': 'Opt',
  'blogger.queue.img': 'img',
  'common.remove': 'Remover',
  'ranking.backToDashboard': 'Voltar ao Dashboard',
  'ranking.hero.title': 'Ranking de Modelos',
  'ranking.hero.subtitle':
    'Compare modelos oficiais com avaliações reais da comunidade — qualidade, velocidade, custo-benefício e facilidade.',
  'ranking.hero.globalStatsAria': 'Estatísticas globais',
  'ranking.hero.models': 'Modelos',
  'ranking.hero.reviews': 'Reviews',
  'ranking.hero.bestOverall': 'Melhor geral',
  'ranking.hero.costBenefit': 'Custo-benefício',
  'ranking.loading': 'Atualizando ranking…',
  'legalHub.back': 'Voltar',
  'legalHub.sidebarTitle': 'Central jurídica',
  'legalHub.supportDescription':
    'Solicitações de suporte, privacidade e direitos do titular devem usar o canal oficial informado no app/site.',
  'legalHub.supportCta': 'Abrir canal de suporte',
  'legalHub.noticeTitle': 'Aviso importante.',
  'dashboard.dashboardExecute.selectImage':
    'Selecione uma imagem para executar.',
  'dashboard.dashboardExecute.runCurrentStage':
    'Executar a etapa atual da imagem.',
  'dashboard.dashboardExecute.rerunStage': 'Reexecutar Etapa',
  'dashboard.dashboardExecute.runStage': 'Executar Etapa',
  'dashboard.dashboardExecute.runAio': 'Executar AIO',
  'dashboard.dashboardExecute.stop': 'Parar execução',
  'freeProviderCard.stage.translation': 'Tradução',
  'freeProviderCard.stage.ocr': 'OCR',
  'freeProviderCard.stage.clean': 'Limpeza',
  'freeProviderCard.badge.integrated': 'Integrado',
  'freeProviderCard.badge.catalog': 'Catálogo',
  'freeProviderCard.verifiedAt': 'verificado em',
  'freeProviderCard.tooltip.selectedModel': 'Modelo selecionado',
  'freeProviderCard.tooltip.notSelected': '(não selecionado)',
  'freeProviderCard.tooltip.notDefined': '(não definido)',
  'freeProviderCard.tooltip.apiKeyConfigured': 'Configurada',
  'freeProviderCard.tooltip.apiKeyRequired': 'Obrigatória (pendente)',
  'freeProviderCard.tooltip.apiKeyOptional': 'Opcional (vazia)',
  'freeProviderCard.tooltip.extraFields': 'Campos extras',
  'freeProviderCard.tooltip.modelsInStage': 'Modelos nesta etapa',
  'freeProviderCard.tooltip.empty': '(vazio)',
  'freeProviderCard.label.model': 'Modelo',
  'freeProviderCard.label.apiBase': 'API Base',
  'freeProviderCard.label.apiKey': 'API Key',
  'freeProviderCard.label.required': '(obrigatório)',
  'freeProviderCard.label.optional': '(opcional)',
  'freeProviderCard.placeholder.apiKey': 'Cole sua key aqui',
  'freeProviderCard.status.activeProfile': 'Perfil ativo:',
  'freeProviderCard.status.catalogOnlyWarning':
    'Este provedor está apenas no catálogo no v1.',
  'freeProviderCard.action.save': 'Salvar',
  'freeProviderCard.action.use': 'Usar',
  'customProvider.field.name': 'Nome',
  'customProvider.field.model': 'Model',
  'customProvider.field.apiBase': 'API Base',
  'customProvider.field.apiKey': 'API Key',
  'customProvider.placeholder.noKey': '(sem key)',
  'customProvider.placeholder.pasteKey': 'Cole sua key aqui',
  'customProvider.status.active': 'Perfil ativo no pipeline',
  'customProvider.action.cancel': 'Cancelar',
  'customProvider.action.saving': 'Salvando...',
  'customProvider.action.save': 'Salvar',
  'customProvider.action.edit': 'Editar',
  'customProvider.action.delete': 'Deletar',
  'customProvider.badge.customProfile': 'Perfil Personalizado',
  'freeProviderCard.status.integrated': 'Integrado',
  'freeProviderCard.status.catalog': 'Catálogo',
  'freeProviderCard.status.verifiedAt': 'verificado em',
  'freeProviderCard.info.label': 'Info',
  'freeProviderCard.info.tooltip': 'Informações {name}',
  'freeProviderCard.info.selectedModel': 'Modelo selecionado:',
  'freeProviderCard.info.notSelected': '(não selecionado)',
  'freeProviderCard.info.modelId': 'Model ID:',
  'freeProviderCard.info.notDefined': '(não definido)',
  'freeProviderCard.info.apiBase': 'API Base:',
  'freeProviderCard.info.apiKey': 'API Key:',
  'freeProviderCard.info.configured': 'Configurada',
  'freeProviderCard.info.required': 'Obrigatória (pendente)',
  'freeProviderCard.info.optional': 'Opcional (vazia)',
  'freeProviderCard.info.extraFields': 'Campos extras:',
  'freeProviderCard.info.setup': 'Setup:',
  'freeProviderCard.info.limits': 'Limites:',
  'freeProviderCard.info.rateLimits': 'Rate Limits:',
  'freeProviderCard.info.modelsInStage': 'Modelos nesta etapa:',
  'freeProviderCard.field.model': 'Modelo',
  'freeProviderCard.field.apiBase': 'API Base',
  'freeProviderCard.field.apiBaseTitle':
    'API Base fixa para este provider no v1',
  'freeProviderCard.field.required': '(obrigatório)',
  'freeProviderCard.field.optional': '(opcional)',
  'freeProviderCard.field.apiKeyPlaceholder': 'Cole sua key aqui',
  'freeProviderCard.status.catalogOnly':
    'Este provedor está apenas no catálogo no v1.',
  'freeProviderCard.actions.save': 'Salvar',
  'freeProviderCard.actions.use': 'Usar',
  'freeProviderCard.empty': '(vazio)',
  'customProvider.action.use': 'Usar',
  'typo.tag': 'Typographer',
  'typo.session.title': 'Session',
  'typo.session.image': 'Image:',
  'typo.session.selection': 'Selection:',
  'typo.session.none': 'none',
  'typo.tools.aria': 'Shape tools',
  'typo.tools.select': 'Select',
  'typo.tools.rect': 'Rectangular',
  'typo.tools.ellipse': 'Elliptic',
  'typo.actions.refine': 'Refine',
  'typo.actions.toRect': '→ Rectangular',
  'typo.actions.toEllipse': '→ Elliptic',
  'typo.actions.duplicate': 'Duplicate',
  'typo.actions.delete': 'Remove selection',
  'typo.presets.title': 'Presets',
  'typo.presets.active': 'Active preset',
  'typo.presets.none': 'No preset',
  'typo.presets.applySelection': '→ Selection',
  'typo.presets.applyImage': '→ Image',
  'typo.snapshots.title': 'Snapshots',
  'typo.snapshots.hint': 'Save the current state to restore later.',
  'typo.snapshots.placeholder': 'Snapshot name',
  'typo.snapshots.save': 'Salvar snapshot',
  'typo.snapshots.select': 'Selecionar…',
  'typo.snapshots.restore': 'Restaurar',
  'typo.queue.title': 'Fila de Texto',
  'typo.queue.editorPlaceholder': 'Cole as falas, uma por linha…',
  'typo.queue.editorAria': 'Editor de texto da fila',
  'typo.queue.build': 'Construir fila',
  'typo.queue.import': 'Importar',
  'typo.queue.applySelected': 'Aplicar item',
  'typo.queue.next': 'Próximo',
  'typo.queue.clear': 'Limpar',
  'typo.queue.multiBubble': 'Multi-bubble',
  'typo.queue.listAria': 'Fila tipográfica',
  'typo.queue.emptyTitle': 'Fila vazia',
  'typo.queue.emptyDesc': 'Uma linha por balão para montar a sequência.',
  'typo.queue.statusApplied': 'Aplicado',
  'typo.queue.statusSkipped': 'Pulado',
  'typo.queue.statusPending': 'Pendente',
  'modelDetail.empty':
    'Select a model on the leaderboard to see details and reviews.',
  'modelDetail.source.local': 'Local',
  'modelDetail.source.cloud': 'Cloud',
  'modelDetail.score.aria': 'Overall score: {score}',
  'modelDetail.score.label': 'Score',
  'modelDetail.reviews.count_one': '{count} review',
  'modelDetail.reviews.count_other': '{count} reviews',
  'modelDetail.trend.up': '+{trend} pts (30d)',
  'modelDetail.trend.down': '{trend} pts (30d)',
  'modelDetail.trend.neutral': 'Neutral trend',
  'modelDetail.metrics.quality': 'Quality',
  'modelDetail.metrics.speed': 'Speed',
  'modelDetail.metrics.costBenefit': 'Cost-benefit',
  'modelDetail.metrics.easeOfUse': 'Ease of Use',
  'modelDetail.distro.title': 'Rating distribution',
  'modelDetail.distro.lastReview': 'Last review: {date}',
  'modelDetail.info.title': 'Technical context',
  'modelDetail.info.noNotes': 'No extra notes registered for this model.',
  'modelDetail.info.source': 'Source',
  'modelDetail.info.target': 'Target',
  'modelDetail.actions.editReview': 'Edit review',
  'modelDetail.actions.startReview': 'Review model',
  'modelDetail.actions.sending': 'Sending…',
  'modelDetail.actions.verifyEmail': 'Verify email',
  'modelDetail.warning.verifyEmail':
    'Confirm your email to publish or edit reviews.',
  'modelDetail.recentReviews.title': 'Recent reviews',
  'modelDetail.recentReviews.loading': 'Loading…',
  'modelDetail.recentReviews.empty':
    'This model has not received public reviews yet.',
  'modelDetail.pagination.prev': 'Previous',
  'modelDetail.pagination.next': 'Next',
  'modelDetail.usage.balanced': 'Balanced',
  'modelDetail.usage.quality_first': 'Quality',
  'modelDetail.usage.speed_first': 'Speed',
  'modelDetail.usage.low_vram': 'Low VRAM',
  'modelDetail.usage.offline_local': 'Local',
  'modelDetail.usage.cloud_pipeline': 'Cloud',
  'resources.empty.title.withQuery': 'Nenhum resultado para "{query}"',
  'resources.empty.title.noQuery': 'Nenhum item encontrado',
  'resources.empty.desc.withQuery':
    'Tente palavras diferentes ou limpe os filtros para encontrar {context}.',
  'resources.empty.desc.noQuery':
    'Ajuste os filtros para ver {context} disponíveis.',
  'resources.fonts.license.free': 'Gratuita',
  'resources.fonts.license.openSource': 'Open Source',
  'resources.fonts.license.commercial': 'Comercial',
  'resources.fonts.license.mixed': 'Mista',
  'resources.fonts.context': 'fontes',
  'resources.fonts.placeholder': 'Digite um texto para testar nas fontes...',
  'resources.fonts.results_one': 'fonte encontrada',
  'resources.fonts.results_other': 'fontes encontradas',
  'resources.fonts.previewFallback': 'Não acredito nisso!',
  'resources.fonts.sizeAria': 'Preview em {size}px',
  'resources.sfx.category.impact': 'Impacto',
  'resources.sfx.category.emotion': 'Emoção',
  'resources.sfx.category.ambient': 'Ambiente',
  'resources.sfx.category.action': 'Ação',
  'resources.sfx.category.voice': 'Voz',
  'resources.sfx.category.misc': 'Outros',
  'resources.sfx.filterAria': 'Filtrar por categoria',
  'resources.sfx.filterAll': 'Todos ({count})',
  'resources.sfx.results_one': 'efeito sonoro',
  'resources.sfx.results_other': 'efeitos sonoros',
  'resources.sfx.context': 'efeitos sonoros',
  'resources.sfx.copyAria': 'Copiar "{text}"',
  'resources.communities.platform.forum': 'Fórum',
  'resources.communities.results_one': 'comunidade',
  'resources.communities.results_other': 'comunidades',
  'resources.communities.context': 'comunidades',
  'resources.communities.visitAria': 'Visitar {name} em navegador externo',
  'resources.communities.visit': 'Visitar',
  'resources.tools.category.editing': 'Edição',
  'resources.tools.category.ocr': 'OCR',
  'resources.tools.category.translation': 'Tradução',
  'resources.tools.category.fonts': 'Fontes',
  'resources.tools.category.hosting': 'Hosting',
  'resources.tools.category.utility': 'Utilidade',
  'resources.tools.filterAll': 'Todas',
  'resources.tools.results_one': 'ferramenta',
  'resources.tools.results_other': 'ferramentas',
  'resources.tools.context': 'ferramentas',
  'resources.tools.free.yes': 'Grátis',
  'resources.tools.free.no': 'Pago',
  'resources.tools.action.open': 'Abrir',
  'resources.tools.action.download': 'Download',
  'feed.roles.raw': 'Raw Provider',
  'feed.roles.cl': 'Cleaner',
  'feed.roles.rd': 'Redrawer',
  'feed.roles.tl': 'Translator',
  'feed.roles.pr': 'Proofreader',
  'feed.roles.ts': 'Typesetter',
  'feed.roles.qc': 'Quality Checker',
  'feed.contact.discord': 'Discord',
  'feed.contact.twitter_x': 'Twitter/X',
  'feed.contact.telegram': 'Telegram',
  'feed.contact.email': 'E-mail',
  'feed.contact.whatsapp': 'WhatsApp',
  'feed.contact.instagram': 'Instagram',
  'feed.contact.placeholder.discord': 'https://discord.gg/... or username',
  'feed.contact.placeholder.twitter_x': 'username or https://x.com/username',
  'feed.contact.placeholder.telegram': 'https://t.me/... or @channel',
  'feed.contact.placeholder.email': 'contact@scanlation.com',
  'feed.contact.placeholder.whatsapp': '+55 11 99999-0000 or link',
  'feed.contact.placeholder.instagram':
    'username or https://instagram.com/username',
  'feed.weekdays.seg': 'Mon',
  'feed.weekdays.ter': 'Tue',
  'feed.weekdays.qua': 'Wed',
  'feed.weekdays.qui': 'Thu',
  'feed.weekdays.sex': 'Fri',
  'feed.weekdays.sab': 'Sat',
  'feed.weekdays.dom': 'Sun',
  'feed.report.reasons.malicious_link': 'Malicious link',
  'feed.report.reasons.spam': 'Spam',
  'feed.report.reasons.impersonation': 'Impersonation',
  'feed.report.reasons.harassment': 'Harassment / abuse',
  'feed.report.reasons.copyright': 'Copyright violation',
  'feed.report.reasons.other': 'Other',
  'feed.modal.closeAria': 'Close modal',
  'feed.feedback.newApplication':
    'New application received in Scanlation Feed.',
  'feed.error.loadFailed': 'Failed to load Scanlation Feed.',
  'feed.hero.back': 'Back to Dashboard',
  'feed.hero.title': 'Recruitment, Showcase & Moderation',
  'feed.hero.subtitle':
    'Post jobs, showcase works, receive applications and report suspicious content.',
  'feed.tab.recruitment': 'Recruitment',
  'feed.tab.showcase': 'Showcase',
  'feed.tab.moderation': 'Moderation',
  'feed.actions.createPost': 'Create {type}',
  'feed.alert.safety':
    'Use only legitimate social media and contacts. Suspicious posts can be reported.',
  'feed.alert.banPolicy':
    'Malicious posts can lead to a permanent ban per account, device, and network.',
  'feed.card.recruitmentRecent': 'Recent recruitments',
  'feed.card.showcaseRecent': 'Recent showcases',
  'feed.card.moderationQueue': 'Moderation queue',
  'feed.loading': 'Loading feed…',
  'feed.empty.noRecruitment': 'No recruitment posts found',
  'feed.empty.noShowcase': 'No showcases found',
  'feed.empty.cleanQueue': 'Queue is clean',
  'feed.empty.beFirst': 'Be the first to post {type}!',
  'feed.empty.noModPosts': 'No posts in moderation queue.',
  'feed.post.recruitLabel': 'Recruit',
  'feed.post.showcaseLabel': 'Showcase',
  'feed.post.rolePayNegotiable': 'To be negotiated',
  'feed.post.rolePayVolunteer': 'Volunteer',
  'feed.post.actions.apply': 'Apply',
  'feed.post.actions.report': 'Report',
  'feed.post.actions.show': 'Show',
  'feed.post.actions.hide': 'Hide',
  'feed.post.actions.ban': 'Ban',
  'feed.sidebar.profileTitle': 'Author profile',
  'feed.sidebar.rulesLabel':
    'I accept the feed rules. Malicious links result in a permanent ban.',
  'feed.sidebar.webhookLabel': 'Discord webhook notifications',
  'feed.sidebar.saveProfile': 'Save profile',
  'feed.sidebar.inboxTitle': 'Internal inbox',
  'feed.sidebar.yourApplications': 'Your applications',
  'feed.sidebar.noApplications': 'No applications sent.',
  'feed.sidebar.receivedTitle': 'Received',
  'feed.sidebar.noReceived': 'No applications received.',
  'feed.sidebar.reportsTitle': 'Reports',
  'feed.sidebar.noReports': 'No pending reports.',
  'feed.sidebar.banTitle': 'Banning',
  'feed.sidebar.applyBan': 'Aplicar ban',
  'feed.feedback.postPublishedRecruit': 'Recrutamento publicado.',
  'feed.feedback.postPublishedShowcase': 'Divulgação publicada.',
  'feed.feedback.reportSent': 'Report enviado para a moderação.',
  'feed.feedback.profileUpdated': 'Perfil do feed atualizado.',
  'feed.feedback.applicationSent': 'Candidatura enviada.',
  'feed.feedback.banApplied': 'Ban aplicado e sessões revogadas.',
  'feed.feedback.reportUpdated': 'Report atualizado.',
  'feed.feedback.postStatusUpdated': 'Post atualizado para {status}.',
  'feed.moderation.notes.resolved': 'Revisado pela moderação.',
  'feed.moderation.notes.dismissed': 'Descartado pela moderação.',
  'feed.moderation.banReasonPost': 'Postagem moderada: {title}',
  'feed.moderation.targetUserId': 'User ID alvo',
  'feed.moderation.applyBan': 'Aplicar ban',
  'feed.error.roleDuplicate': 'Você já adicionou {role}.',
  'feed.error.valuePositive': 'Valor deve ser positivo.',
  'feed.error.platformDuplicate': 'Já adicionou {platform}.',
  'feed.error.platformRequired': 'Informe {platform}.',
  'feed.error.saveProfileFailed': 'Falha ao salvar perfil.',
  'feed.error.publishFailed': 'Falha ao publicar.',
  'feed.error.applyFailed': 'Falha ao candidatar.',
  'feed.error.reportFailed': 'Falha ao reportar.',
  'feed.error.moderatePostFailed': 'Falha ao moderar post.',
  'feed.error.moderateReportFailed': 'Falha ao atualizar report.',
  'feed.error.banFailed': 'Falha ao aplicar ban.',
  'feed.composer.typeRecruit': 'recrutamento',
  'feed.composer.typeShowcase': 'showcase',
  'feed.composer.placeholder.titleRecruit': 'Ex: Looking for translators',
  'feed.composer.placeholder.titleShowcase': 'Ex: New chapter available',
  'feed.composer.placeholder.bodyRecruit':
    'Explain the project and how the candidate can help...',
  'feed.composer.placeholder.bodyShowcase':
    'Describe the release and relevant info...',
  'feed.composer.placeholder.scanlationName': 'Scanlation name',
  'feed.composer.placeholder.workTitle': 'Work title',
  'feed.composer.placeholder.chapterLabel': 'Ch. 42',
  'feed.composer.placeholder.genres': 'Action, Romance, Fantasy',
  'feed.composer.placeholder.description': 'Describe this release...',
  'feed.composer.sections.project': 'Project',
  'feed.composer.sections.work': 'Work',
  'feed.composer.sections.recruitmentSettings': 'Recruitment settings',
  'feed.composer.toggle.recruiting': 'Recruiting',
  'feed.composer.toggle.recruitingDesc': 'Is your scan accepting new members?',
  'feed.composer.toggle.paidWork': 'Paid Work',
  'feed.composer.toggle.paidWorkDesc': 'Will members receive payment?',
  'feed.composer.requirements.label': 'Require from candidates:',
  'feed.composer.requirements.portfolio': 'Portfolio',
  'feed.composer.requirements.experience': 'Experience',
  'feed.composer.requirements.availability': 'Availability',
  'feed.composer.requirements.contact': 'Contact',
  'feed.composer.availability.minRequired': 'Minimum availability required:',
  'feed.composer.availability.hoursPerWeek': 'Hours per week',
  'feed.composer.availability.daysOptional': 'Days (optional)',
  'feed.composer.availability.descriptionOptional': 'Description (optional)',
  'feed.composer.availability.placeholder':
    'I need someone who delivers chapters every week...',
  'feed.composer.sections.roles': 'Roles',
  'feed.composer.sections.rolesSub': '(add those you are looking for)',
  'feed.composer.roles.roleLabel': 'Role',
  'feed.composer.roles.valueLabel': 'Value (R$)',
  'feed.composer.roles.valueHint': '(per chapter)',
  'feed.composer.roles.add': 'Add',
  'feed.composer.roles.allAdded': 'All roles added',
  'feed.composer.roles.addBtn': 'Add role',
  'feed.composer.social.title': 'Social media',
  'feed.composer.social.sub': '(at least one)',
  'feed.composer.social.platform': 'Platform',
  'feed.composer.social.user': 'User',
  'feed.composer.social.url': 'URL/Link',
  'feed.composer.social.allAdded': 'All platforms added',
  'feed.composer.social.addBtn': 'Add social media',
  'feed.composer.sections.media': 'Media',
  'feed.composer.media.uploading': 'Sending...',
  'feed.composer.media.uploadBtn': 'Upload via Imgur',
  'feed.apply.title': 'Send application',
  'feed.apply.message': 'Message',
  'feed.apply.messagePlaceholder':
    'Introduce yourself and say why you want to join...',
  'feed.apply.preferredContact': 'Preferred contact',
  'feed.apply.portfolio': 'Portfolio / links',
  'feed.apply.portfolioPlaceholder': 'One link per line...',
  'feed.report.title': 'Report post',
  'feed.report.reason': 'Reason',
  'feed.report.details': 'Details',
  'feed.report.detailsPlaceholder': 'Descreva o problema...',
  'feed.report.send': 'Enviar denúncia',
  'freeProvider.manager.titleTranslation': 'FREE Providers (Tradução)',
  'freeProvider.manager.titleOcr': 'FREE Providers (OCR)',
  'auth.password.hide': 'Ocultar senha',
  'auth.password.show': 'Mostrar senha',
  'modelManager.stage.cleanImage': 'Limpar Imagem',
  'modelManager.stage.detectText': 'Detectar Texto',
  'modelManager.stage.recognizeText': 'Reconhecer Texto',
  'modelManager.stage.segmentText': 'Segmentar Texto',
  'fillStylePopover.gradient': 'Gradient',
  'fillStylePopover.hint.gradient': 'Solid ou gradient no mesmo seletor.',
  'fillStylePopover.hint.solid': 'Selecione uma cor sólida.',
  'klSlider.resetValue': 'Resetar valor',
  'dashboard.aio.translation.llm.temperature': 'Temperature',
  'dashboard.aio.translation.llm.topP': 'Top P',
  'dashboard.aio.translation.llm.maxTokens': 'Max Tokens',
  'dashboard.enhance.modeTag': 'Enhance',
  'dashboard.enhance.scale.2x': '2×',
  'dashboard.enhance.scale.4x': '4×',
  'optimizer.hero.title': 'Otimizador de Capítulos',
  'optimizer.hero.desc':
    'Otimize páginas finais para web, leitura ou arquivamento.',
  'optimizer.hero.pages': 'Páginas',
  'optimizer.hero.savings': 'Economia',
  'optimizer.hero.saved': 'Economizado',
  'optimizer.hero.output': 'Saída',
  'optimizer.panel.presets': 'Predefinições',
  'optimizer.panel.output': 'Saída',
  'optimizer.panel.dimensions': 'Dimensões',
  'optimizer.panel.filters': 'Filtros',
  'optimizer.panel.preview': 'Pré-visualização',
  'optimizer.presets.webLight': 'Web Leve',
  'optimizer.presets.webLight.desc': 'Leve para carregamento rápido',
  'optimizer.presets.reading': 'Leitura',
  'optimizer.presets.reading.desc': 'Qualidade equilibrada para leitores',
  'optimizer.presets.archive': 'Arquivo',
  'optimizer.presets.archive.desc': 'Sem perdas para preservação',
  'optimizer.presets.social': 'Social',
  'optimizer.presets.social.desc': 'Otimizado para redes sociais',
  'optimizer.presets.custom': 'Personalizado',
  'optimizer.presets.custom.desc': 'Suas próprias configurações',
  'optimizer.config.format': 'Formato',
  'optimizer.config.quality': 'Qualidade',
  'optimizer.config.resize': 'Redimensionar',
  'optimizer.config.trimBorders': 'Cortar bordas',
  'optimizer.config.trimTolerance': 'Tolerância de corte',
  'optimizer.config.maxWidth': 'Largura máxima',
  'optimizer.config.maxHeight': 'Altura máxima',
  'optimizer.config.sharpen': 'Nitidez',
  'optimizer.config.sharpenStrength': 'Intensidade da nitidez',
  'optimizer.config.grayscale': 'Escala de cinza',
  'optimizer.config.autoLevels': 'Níveis automáticos',
  'optimizer.action.optimizing': 'Otimizando...',
  'optimizer.action.folder': 'Pasta',
  'optimizer.preview.generating': 'Gerando pré-visualização...',
  'optimizer.preview.before': 'Antes',
  'optimizer.preview.after': 'Depois',
  'optimizer.preview.reduction': 'Redução',
  'optimizer.preview.dimensions': 'Dimensões',
  'optimizer.preview.compare': 'Comparar',
  'optimizer.preview.original': 'Original',
  'optimizer.preview.optimized': 'Otimizado',
  'optimizer.preview.empty': 'Carregue imagens para usar o otimizador.',
  'optimizer.results.title': 'Resultados',
  'optimizer.results.empty': 'Execute a otimização para ver os resultados.',
  'optimizer.results.download': 'Baixar arquivo',
  'optimizer.error.worker': 'Worker indisponível no Otimizador de Capítulos.',
  'optimizer.error.failed': 'O Otimizador de Capítulos falhou.',
  'optimizer.error.preview': 'Falha na pré-visualização do otimizador.',
  'optimizer.config.brightness': 'Brilho',
  'optimizer.config.contrast': 'Contraste',
  'optimizer.config.noiseReduction': 'Redução de ruído',
  'optimizer.config.noiseReductionStrength': 'Intensidade da redução de ruído',
  'optimizer.config.rotation': 'Rotação',
  'optimizer.config.rotationNone': 'Nenhum',
  'optimizer.config.renamePattern': 'Padrão de renomeação',
  'optimizer.config.renameHint':
    'Use {name} para o nome original, {index} para número com preenchimento, {ext} para a extensão.',
  'optimizer.panel.advanced': 'Avançado',
  'optimizer.export.folderSuccess':
    'O Otimizador de Capítulos exportou os arquivos para a pasta selecionada.',
  'optimizer.export.zipSuccess':
    'Pacote do Otimizador de Capítulos gerado com sucesso.',
  'resources.communities.platform.discord': 'Discord',
  'resources.communities.platform.reddit': 'Reddit',
  'resources.communities.platform.website': 'Website',
  'resources.communities.platform.telegram': 'Telegram',
  'dashboard.cleaner.modeTag': 'Cleaner',
  'stitch.error.loadImage': 'Falha ao carregar imagem.',
  'stitch.error.initCanvas': 'Falha ao iniciar canvas do Stitcher.',
  'stitch.error.initTempCanvas':
    'Falha ao preparar imagem intermediária do Stitcher.',
  'stitch.error.generateBlob': 'Falha ao gerar blob do Stitcher.',
  'stitch.error.cancelled': 'Renderização cancelada.',
  'stitch.error.workerFailed': 'Falha ao executar worker do Stitcher.',
  'stitch.error.generatePreview': 'Falha ao gerar preview do Stitcher.',
  'stitch.error.exportBatch': 'Falha ao exportar lote do Stitcher.',
  'stitch.error.generateZip': 'Falha ao gerar ZIP do Stitcher.',
  'stitch.error.saveFolder': 'Falha ao salvar lotes na pasta.',
  'dashboard.footer.runtime.fallback.label': 'Alternativo',
  'watermark.blend.normal': 'Normal',
  'watermark.blend.multiply': 'Multiplicar',
  'watermark.blend.screen': 'Tela',
  'watermark.blend.overlay': 'Sobreposição',
  'watermark.blend.softLight': 'Luz Suave',
  'watermark.blend.hardLight': 'Luz Dura',
  'watermark.blend.colorDodge': 'Subexposição de Cor',
  'watermark.blend.colorBurn': 'Superexposição de Cor',
  'watermark.panel.shadow': 'Camada de Sombra',
  'watermark.shadow.enable': 'Ativar sombra de fundo',
  'watermark.shadow.blur': 'Desfoque',
  'watermark.shadow.opacity': 'Opacidade',
  'watermark.shadow.color': 'Cor',
  'watermark.shadow.offsetY': 'Deslocamento Y',
  'watermark.panel.textAvoidance': 'Evitar Texto',
  'watermark.textAvoidance.enable': 'Evitar regiões de texto',
  'watermark.textAvoidance.desc':
    "Usa detecção de texto por IA para evitar que marcas d'água sobreponham textos nas imagens.",
  'watermark.textAvoidance.detecting': 'Detectando...',
  'watermark.textAvoidance.detectCurrent': 'Detectar Atual',
  'watermark.textAvoidance.detectAll': 'Detectar Todas',
  'watermark.textAvoidance.detected': '{{count}} regiões de texto detectadas.',
  'watermark.textAvoidance.detectedAll':
    '{{count}} regiões de texto detectadas em todas as imagens.',
  'watermark.textAvoidance.failed': 'Falha na detecção de texto.',
  'watermark.textAvoidance.zonesFound': 'zonas',
  'watermark.textAvoidance.showOverlay': 'Mostrar zonas',
  'watermark.text.shadowBlur': 'Desfoque sombra',
  'watermark.text.shadowColor': 'Cor da sombra',
  'watermark.distribution.offsetX': 'Deslocamento X',
  'watermark.distribution.offsetY': 'Deslocamento Y',
  'watermark.distribution.density': 'Densidade',
  'dashboard.dock.tooltip.hoverHint': 'Segure o cursor para ver o preview',
  'dashboard.dock.config.ariaLabel': 'Configuração da ferramenta ativa',
  'dashboard.dock.config.closeTitle': 'Fechar configuração',
  'dashboard.dock.config.closeAriaLabel': 'Fechar configuração da ferramenta',
  'dashboard.dock.areaSelection.sectionTitle': 'Seleção de Área',
  'dashboard.dock.areaSelection.shapeLabel': 'Shape da nova seleção',
  'dashboard.dock.areaSelection.optionAuto': 'Auto',
  'dashboard.dock.areaSelection.optionSquare': 'Rectangular',
  'dashboard.dock.areaSelection.optionRounded': 'Elliptic',
  'dashboard.dock.areaSelection.hintAuto': 'Auto detecta: {kind}.',
  'dashboard.dock.areaSelection.hintFixed':
    'Novas regiões criadas como {mode}.',
  'dashboard.dock.areaSelection.btnDuplicate': 'Duplicar',
  'dashboard.dock.areaSelection.btnToAuto': '→ Auto',
  'dashboard.dock.areaSelection.btnToSquare': '→ Rectangular',
  'dashboard.dock.areaSelection.btnToRounded': '→ Elliptic',
  'dashboard.dock.segment.brushTitle': 'Pincel Segmentado',
  'dashboard.dock.segment.eraserTitle': 'Borracha Segmentada',
  'dashboard.dock.segment.sizeLabel': 'Tamanho',
  'dashboard.dock.segment.hint': 'Ajuste o raio para editar áreas segmentadas.',
  'dashboard.dock.imageTool.paintTitle': 'Pincel',
  'dashboard.dock.imageTool.eraserTitle': 'Borracha',
  'dashboard.dock.imageTool.healingTitle': 'Healing Brush',
  'dashboard.dock.imageTool.sizeLabel': 'Tamanho',
  'dashboard.dock.imageTool.opacityLabel': 'Opacidade',
  'dashboard.dock.imageTool.blurLabel': 'Blur',
  'dashboard.dock.imageTool.colorLabel': 'Cor',
  'dashboard.dock.imageTool.colorAriaLabel': 'Cor do pincel',
  'dashboard.dock.magicWand.title': 'Varinha Mágica',
  'dashboard.dock.magicWand.toleranceLabel': 'Tolerância',
  'dashboard.dock.magicWand.healingBtnTitle':
    'Aplicar inpainting na seleção da varinha',
  'dashboard.dock.magicWand.healingBtnBusy': 'Aplicando…',
  'dashboard.dock.magicWand.healingBtn': 'Healing',
  'dashboard.dock.magicWand.clearBtn': 'Limpar',
  'dashboard.dock.imageTool.modelHint': 'Modelo: ',
  'dashboard.dock.palette.ariaLabel': 'Ferramentas manuais de imagem',
  'dashboard.dock.config.closeLabel': 'Fechar config',
  'dashboard.dock.config.openLabel': 'Abrir config',
  'dashboard.dock.config.badge': 'Config',
  'dashboard.dock.config.description':
    'Abre o painel contextual da ferramenta ativa para ajustar shape, tamanho, opacidade, tolerância e outros controles finos.',
  'dashboard.dock.config.disabledReason':
    'Ative uma ferramenta com parâmetros editáveis para abrir a configuração.',
  'dashboard.dock.divider.reg': 'Reg',
  'dashboard.dock.areaSelect.ariaLabel': 'Selecionar área',
  'dashboard.dock.areaSelect.title': 'Selecionar área',
  'dashboard.dock.areaSelect.description':
    'Crie, ajuste e refine regiões de texto no preview. Ideal para corrigir bolhas detectadas antes de OCR, tradução ou render.',
  'dashboard.dock.areaSelect.badge': 'Reg',
  'dashboard.dock.areaSelect.disabledReason':
    'Disponível nas etapas Detectar e Render do AIO manual.',
  'dashboard.dock.clearPage.ariaLabel': 'Limpar todas as regiões',
  'dashboard.dock.clearPage.title': 'Limpar página',
  'dashboard.dock.clearPage.description':
    'Remove todas as regiões dessa página de uma vez para recomeçar a marcação manual sem resíduos.',
  'dashboard.dock.clearPage.badge': 'Reset',
  'dashboard.dock.clearPage.disabledReason':
    'Precisa estar em Detectar/Render e já ter regiões criadas na imagem ativa.',
  'dashboard.dock.divider.seg': 'Seg',
  'dashboard.dock.segBrush.ariaLabel': 'Pincel de área segmentada',
  'dashboard.dock.segBrush.title': 'Pincel segmentado',
  'dashboard.dock.segBrush.description':
    'Expande a máscara de segmentação para recuperar letras, contornos ou pedaços de balão que ficaram de fora.',
  'dashboard.dock.segBrush.badge': 'Seg',
  'dashboard.dock.segBrush.disabledReason':
    'Disponível durante a etapa Segmentar Texto.',
  'dashboard.dock.segEraser.ariaLabel': 'Borracha de área segmentada',
  'dashboard.dock.segEraser.title': 'Borracha segmentada',
  'dashboard.dock.segEraser.description':
    'Refina a máscara removendo excesso de seleção, vazamentos e sujeiras que não devem entrar na limpeza.',
  'dashboard.dock.segEraser.badge': 'Seg',
  'dashboard.dock.segEraser.disabledReason':
    'Disponível durante a etapa Segmentar Texto.',
  'dashboard.dock.divider.img': 'Img',
  'dashboard.dock.paint.ariaLabel': 'Pincel de pintura',
  'dashboard.dock.paint.title': 'Pincel',
  'dashboard.dock.paint.description':
    'Pinte por cima de artefatos, falhas de inpaint ou detalhes que precisam de microcorreção diretamente sobre a imagem.',
  'dashboard.dock.paint.badge': 'Img',
  'dashboard.dock.paint.disabledReason':
    'Entre no modo manual e selecione uma imagem ativa para editar.',
  'dashboard.dock.paintEraser.ariaLabel': 'Borracha de pintura',
  'dashboard.dock.paintEraser.title': 'Borracha',
  'dashboard.dock.paintEraser.description':
    'Apaga apenas o layer de pintura manual para voltar atrás sem perder o restante das detecções e máscaras.',
  'dashboard.dock.paintEraser.badge': 'Img',
  'dashboard.dock.paintEraser.disabledReason':
    'Entre no modo manual e selecione uma imagem ativa para editar.',
  'dashboard.dock.wand.ariaLabel': 'Varinha mágica',
  'dashboard.dock.wand.title': 'Varinha mágica',
  'dashboard.dock.wand.description':
    'Seleciona rapidamente uma área contínua por cor/tolerância para depois aplicar healing ou remover sobras com precisão.',
  'dashboard.dock.wand.badge': 'Img',
  'dashboard.dock.wand.disabledReason':
    'Entre no modo manual e selecione uma imagem ativa para editar.',
  'dashboard.dock.healing.ariaLabel': 'Healing Brush',
  'dashboard.dock.healing.title': 'Healing Brush',
  'dashboard.dock.healing.description':
    'Passa inpainting localizado sobre defeitos, bordas quebradas e restos de texto mantendo a textura ao redor mais natural.',
  'dashboard.dock.healing.badge': 'Img',
  'dashboard.dock.healing.disabledReason':
    'Entre no modo manual e selecione uma imagem ativa para editar.',
  'dashboard.dock.clearPaint.ariaLabel': 'Limpar pintura',
  'dashboard.dock.clearPaint.title': 'Limpar pintura',
  'dashboard.dock.clearPaint.description':
    'Apaga toda a camada de pintura manual da imagem ativa sem zerar outras correções ou histórico do estágio.',
  'dashboard.dock.clearPaint.badge': 'Reset',
  'dashboard.dock.clearPaint.disabledReason':
    'Só aparece quando a imagem ativa já tem pintura manual aplicada.',
  'dashboard.dock.resetEdits.ariaLabel': 'Resetar todas as edições',
  'dashboard.dock.resetEdits.title': 'Resetar edição',
  'dashboard.dock.resetEdits.description':
    'Volta a imagem ativa ao estado original do estágio manual, removendo pintura, healing, seleção da varinha e overrides locais.',
  'dashboard.dock.resetEdits.badge': 'Reset',
  'dashboard.dock.resetEdits.disabledReason':
    'Disponível quando a imagem ativa já recebeu alguma intervenção manual.',
  'modelManager.stage.automaticAiClean': 'Limpeza Automática IA',
  'resources.fonts.downloadLabel': 'Download',
  'dashboard.sidebar.supportedFormats':
    'JPG, PNG, WEBP, ZIP, PDF, CBZ, CB7, PSD',
  'dashboard.cleaner.ocr.label': 'OCR',
  'dashboard.cleaner.ai.defaultProvider': 'Cloud / API / IA',
  'bugReport.screenshot.alt': 'Captura de tela',
  'pageTransition.loading.ariaLabel': 'Carregando',
  'watermark.text.placeholder': 'KŌMA Studio',
  'watermark.logo.alt': 'Logo',
  'dashboard.textDetection.regionActions.aria': 'Ações da região',
  'dashboard.textDetection.manualModeRequired': 'Modo manual necessário',
  'dashboard.textDetection.removeRegion': 'Remover região',
  'dashboard.renderText.rewind.title': 'Rewind desta imagem',
  'dashboard.renderText.forward.title': 'Forward desta imagem',
  'dashboard.renderText.noHistory': 'Sem histórico AIO para esta imagem',
  'dashboard.renderText.editPlaceholder': 'Digite o texto final...',
  'dashboard.renderText.editAria': 'Editar texto renderizado',
  'dashboard.renderText.removeSelection.title': 'Remover seleção',
  'dashboard.renderText.regionActions.aria': 'Ações da região',
  'dashboard.pipeline.prevStep.title':
    'Voltar para a etapa anterior do pipeline AIO',
  'dashboard.pipeline.nextStep.title':
    'Avançar para a próxima etapa do pipeline AIO',
  'dashboard.pipeline.runStep.title':
    'Executar somente a etapa atual para a imagem selecionada',
  'dashboard.pipeline.skipStep.title': 'Pular etapa atual e liberar a próxima',
  'dashboard.typesetter.applyStyleAll.title':
    'Aplicar estilo da seleção atual em todas as regiões',
  'auth.error.internetRequired':
    'É necessário acesso à internet para entrar no app.',
  'runtime.status.noRuntimeInstalled':
    'O runtime local de IA não está instalado. Instale-o em Configurações → Runtime para habilitar os recursos de IA/OCR.',
  'auth.error.mandatoryUpdate':
    'Atualização obrigatória disponível. Atualize o aplicativo para continuar.',
  'dashboard.textDetection.noTextRecognized': 'Sem texto reconhecido',
  'dashboard.textDetection.noTranslation': 'Sem tradução disponível',
  'dashboard.textDetection.noNt': 'Sem NT disponível',
  'dashboard.renderText.dblClickToEdit': 'duplo clique para editar',
  'dashboard.renderText.renderNotApplied': 'render não aplicado nesta etapa',
  'dashboard.status.stageLabelTranslation': 'Tradução',
  'dashboard.status.profilesPersistedDesktopSecure':
    'Perfis custom salvos no desktop com armazenamento protegido.',
  'dashboard.status.profilesPersistedDesktopLocal':
    'Perfis custom salvos no desktop sem criptografia nativa disponível.',
  'dashboard.status.profilesPersistedBrowser':
    'Perfis custom salvos no navegador local deste dispositivo.',
  'dashboard.status.aioScopeManual': 'AIO manual',
  'dashboard.status.aioScopeAuto': 'AIO automático',
  'dashboard.status.cleanerSelectProfileFirst':
    'Selecione um perfil visual já salvo para usar no Automatic AI Clean.',
  'dashboard.status.cleanerProfileNotFound':
    'Perfil visual não encontrado. Recarregue e tente novamente.',
  'dashboard.status.cleanerProfileInUse':
    'Perfil visual em uso no Automatic AI Clean: {label}.',
  'dashboard.status.cleanerSelectValidModel':
    'Selecione um modelo válido para o Automatic AI Clean.',
  'dashboard.status.modelInRoadmap': 'O modelo "{name}" ainda está em roadmap.',
  'dashboard.status.modelNeedsConfig':
    'O modelo "{name}" requer configuração antes do uso.',
  'dashboard.status.translatorSfxSelectValidModel':
    'Selecione um modelo válido para o AI SFX do Tradutor.',
  'dashboard.status.cleanerProfileSaved':
    'Perfil visual salvo e selecionado para o Automatic AI Clean: {label}.',
  'dashboard.status.cleanerSelectProfileToRemove':
    'Selecione um perfil visual salvo para remover.',
  'dashboard.status.customProfilePendingSync':
    'Perfil custom aguardando sincronização local.',
  'dashboard.status.customProfileOcrPendingSync':
    'Perfil custom OCR aguardando sincronização local.',
  'dashboard.status.presetAppliedToSelection':
    'Preset "{name}" aplicado à seleção atual.',
  'dashboard.status.legacyPresetNotFound':
    'Preset visual Legacy {modeKey} não encontrado.',
  'dashboard.status.presetAppliedShort': 'Preset "{name}" aplicado à seleção.',
  'dashboard.status.presetAppliedToImage':
    'Preset "{name}" aplicado à imagem ativa.',
  'dashboard.status.typographerSelectionDuplicated':
    'Seleção duplicada no Tipógrafo.',
  'dashboard.status.autoShapeApplied': 'Shape automático aplicado: {shape}.',
  'dashboard.status.renderStyleAppliedAll':
    'Estilo de render aplicado em todas as seleções de todas as imagens.',
  'dashboard.status.canvasInitFailed':
    'Falha ao iniciar canvas de composição manual.',
  'dashboard.status.cleanerCanvasInitFailed':
    'Falha ao iniciar canvas de composição manual do Cleaner.',
  'dashboard.status.wandPrepFailed': 'Falha ao preparar varinha mágica.',
  'dashboard.status.wandSelectionUpdated':
    'Seleção da varinha atualizada. Use Healing para aplicar inpainting.',
  'dashboard.status.wandNoArea':
    'A varinha não encontrou uma área compatível para seleção.',
  'dashboard.status.wandExecFailed': 'Falha ao executar varinha mágica.',
  'dashboard.status.cleanerWandPrepFailed':
    'Falha ao preparar varinha mágica do Cleaner.',
  'dashboard.status.cleanerWandSelectionUpdated':
    'Seleção da varinha do Cleaner atualizada. Use Healing para aplicar inpainting.',
  'dashboard.status.cleanerWandNoArea':
    'A varinha do Cleaner não encontrou uma área compatível para seleção.',
  'dashboard.status.cleanerWandExecFailed':
    'Falha ao executar varinha mágica do Cleaner.',
  'dashboard.status.healingInvalidResponse':
    'Resposta inválida ao aplicar Healing Brush.',
  'dashboard.status.cleanerHealingInvalidResponse':
    'Resposta inválida ao aplicar Healing Brush no Cleaner.',
  'dashboard.status.cleanerHealingConnectFailed':
    'Healing do Cleaner falhou ao conectar com o backend ({url}). Verifique se o mini-backend está ativo.',
  'dashboard.status.cleanerHealingFailed':
    'Falha ao aplicar Healing Brush no Cleaner.',
  'dashboard.status.wandNoSelectionForHealing':
    'Nenhuma seleção da varinha para aplicar healing.',
  'dashboard.status.renderCanvasInitFailed':
    'Falha ao iniciar canvas de renderização.',
  'dashboard.status.aioCompleteAdjust':
    '{message} Ajuste manualmente se necessário.',
  'dashboard.status.aioAborted': 'Execução do AIO interrompida.',
  'dashboard.alert.importWorkspaceConfirm':
    'Importar este workspace vai substituir o workspace atual em memória. Deseja continuar?',
  'dashboard.alert.clearAutosaveConfirm':
    'Limpar o autosave local remove o último workspace salvo neste PC para este usuário. Continuar?',
  'dashboard.alert.closeWorkspaceConfirm':
    'Fechar o workspace atual? Isso irá remover todas as imagens carregadas e o autosave local. Esta ação não pode ser desfeita.',
  'dashboard.status.workspacePendingChanges':
    'Workspace com alterações pendentes.',
  'dashboard.status.toolSelectArea': 'Selecionar Área',
  'dashboard.status.toolSegmentBrush': 'Pincel de Segmentação',
  'dashboard.status.toolSegmentEraser': 'Borracha de Segmentação',
  'dashboard.alert.emailPendingTitle': 'Email pendente de confirmação',
  'dashboard.alert.emailPendingText':
    'Confirme seu email para executar ações de processamento.',
  'dashboard.status.typographerSession': 'Sessão do Tipógrafo',
  'dashboard.status.cleanerMeta':
    'OCR: {ocrCount} • Segmentadas: {segmentedCount} • Limpa: {cleaned}',
  'dashboard.status.metaOk': 'ok',
  'dashboard.status.metaPending': 'pendente',
  'dashboard.status.cleanerRunFirst':
    'Execute o Cleaner para gerar OCR, segmentação e imagem limpa.',
  'dashboard.status.translatorMeta':
    'Detect: {detected} • OCR: {ocr} • Tradução: {translated}',
  'dashboard.status.translatorRunFirst':
    'Execute o Tradutor visual para detectar, reconhecer e traduzir.',
  'dashboard.status.localModelDownloadHint':
    'Modelos locais são baixados sob demanda; cloud/API continuam por chave.',
  'dashboard.status.selectionTextModeAria': 'Modo do texto da seleção atual',
  'dashboard.status.translatorUsesAioModel':
    'O Tradutor usa a mesma seleção de modelo do AIO; execute novamente após trocar o modelo.',
  'dashboard.status.translatorLocalModelIncompatible':
    'O modelo local atual não suporta o par de idiomas do Tradutor. Escolha outro modelo ou use cloud.',
  'dashboard.status.stitchLastMoved':
    'Última imagem enviada para o próximo lote.',
  'dashboard.status.stitchFirstPulled':
    'Primeira imagem do próximo lote adicionada ao lote atual.',
  'auth.error.generic': 'Erro {status}',
  'auth.error.desktopBridgeUnavailable':
    'Bridge de autenticação desktop indisponível.',
  'dashboard.status.modeLabel': 'Modo',
  'dashboard.status.selectedLabel': 'Selecionado',
  'dashboard.status.selectBoxInPreview': 'Selecione uma caixa no preview.',
  'dashboard.status.selectTranslatorModel':
    'Selecione um modelo local ou cloud para traduzir no Tradutor.',
  'dashboard.error.loadHardwareFailed': 'Falha ao carregar hardware local.',
  'dashboard.error.healingBrushFailed': 'Falha no Healing Brush: {message}',
  'dashboard.status.healingBrushApplyFailed': 'Falha ao aplicar Healing Brush.',
  'dashboard.error.cleanerHealingBrushFailed':
    'Falha no Healing Brush do Cleaner: {message}',
  'dashboard.status.aioExecutionFailed': 'Falha ao executar AIO.',
  'dashboard.status.autosaveSaveFailed': 'Falha ao salvar autosave local.',
  'dashboard.status.workspaceExportFailed': 'Falha ao exportar workspace.',
  'dashboard.status.workspaceImportFailed': 'Falha ao importar workspace.',
  'dashboard.status.autosaveClearFailed': 'Falha ao limpar autosave local.',
  'dashboard.status.noModelSelected': 'Nenhum modelo selecionado.',
  'dashboard.status.aiCleanModelSelected':
    'Modelo selecionado para Automatic AI Clean: {model}',
  'dashboard.status.selectionMode': 'Modo da Seleção',
  'dashboard.status.workspaceRestored': 'Workspace restaurado.',
  'dashboard.status.workspaceRestoredFromAutosave':
    'Workspace restaurado do autosave local.',
  'dashboard.aio.skip': 'Pular',
  'dashboard.aio.imageLabel': 'Imagem:',
  'dashboard.aio.stepLabel': 'Etapa:',
  'dashboard.aio.historyHint': 'Etapa: {label} ({current}/{total})',
  'dashboard.typo.fontsUpdating': 'Atualizando…',
  'dashboard.typo.updateFonts': 'Atualizar Fontes',
  'dashboard.typo.importFontTitle': 'Importar fonte personalizada',
  'dashboard.typo.desktopOnly': 'Apenas no app desktop',
  'dashboard.typo.fontImporting': 'Importando…',
  'dashboard.typo.importFont': 'Importar Fonte',
  'dashboard.typo.applyStyleToAll': 'Aplicar Estilo a Todas',
  'dashboard.typo.fontControlsHint':
    'Controles de fonte/cor/alinhamento ficam na dock contextual do overlay. Atalho:',
  'dashboard.aio.languageLabel': 'Idioma:',
  'shortcuts.category.global': 'Globais',
  'shortcuts.category.modes': 'Modos',
  'shortcuts.category.typesetter': 'Tipógrafo',
  'shortcuts.noShortcut': 'Sem atalho',
  'shortcuts.openShortcutModal.label': 'Abrir central de atalhos',
  'shortcuts.openShortcutModal.description':
    'Abre o modal de atalhos e configuração.',
  'shortcuts.toggleToolsPanel.label': 'Mostrar/ocultar painel de ferramentas',
  'shortcuts.toggleToolsPanel.description':
    'Alterna a visibilidade do painel de ferramentas.',
  'shortcuts.rotateActiveImage.label': 'Rotacionar imagem ativa',
  'shortcuts.rotateActiveImage.description':
    'Rotaciona a imagem selecionada em 90 graus.',
  'shortcuts.workspaceSave.label': 'Salvar workspace local',
  'shortcuts.workspaceSave.description':
    'Força o autosave local do workspace atual.',
  'shortcuts.workspaceUndo.label': 'Desfazer workspace',
  'shortcuts.workspaceUndo.description':
    'Desfaz a última alteração de trabalho do workspace atual.',
  'shortcuts.workspaceRedo.label': 'Refazer workspace',
  'shortcuts.workspaceRedo.description':
    'Refaz a última alteração desfeita do workspace atual.',
  'shortcuts.zoomIn.label': 'Aumentar zoom',
  'shortcuts.zoomIn.description': 'Aumenta o zoom do palco atual.',
  'shortcuts.zoomOut.label': 'Diminuir zoom',
  'shortcuts.zoomOut.description': 'Diminui o zoom do palco atual.',
  'shortcuts.setViewPaginated.label': 'Visualização paginada',
  'shortcuts.setViewPaginated.description':
    'Alterna para a visualização paginada.',
  'shortcuts.setViewLongStrip.label': 'Visualização tira longa',
  'shortcuts.setViewLongStrip.description':
    'Alterna para a visualização de tira longa.',
  'shortcuts.setModeOrganize.label': 'Modo Organizar',
  'shortcuts.setModeOrganize.description': 'Troca para o modo Organizar.',
  'shortcuts.setModeAio.label': 'Modo AIO',
  'shortcuts.setModeAio.description': 'Troca para o modo AIO.',
  'shortcuts.setModeCleaner.label': 'Modo Limpador / Redesenhador',
  'shortcuts.setModeCleaner.description':
    'Troca para o modo Limpador / Redesenhador.',
  'shortcuts.setModeTypesetter.label': 'Modo Tipógrafo',
  'shortcuts.setModeTypesetter.description': 'Troca para o modo Tipógrafo.',
  'shortcuts.setModeTranslator.label': 'Modo Tradutor',
  'shortcuts.setModeTranslator.description': 'Troca para o modo Tradutor.',
  'shortcuts.setModeRaw.label': 'Modo Provedor Raw',
  'shortcuts.setModeRaw.description': 'Troca para o modo Provedor Raw.',
  'shortcuts.setModeProofreader.label': 'Modo Revisor / QC',
  'shortcuts.setModeProofreader.description': 'Troca para o modo Revisor / QC.',
  'shortcuts.setModeStitch.label': 'Modo Costurar',
  'shortcuts.setModeStitch.description': 'Troca para o modo Costurar.',
  'shortcuts.setModeSplit.label': 'Modo Divisão Inteligente',
  'shortcuts.setModeSplit.description':
    'Troca para o modo Divisão Inteligente.',
  'shortcuts.setModeWatermark.label': "Modo Marca d'Água",
  'shortcuts.setModeWatermark.description': "Troca para o modo Marca d'Água.",
  'shortcuts.setModeEnhance.label': 'Modo Melhorar Imagem',
  'shortcuts.setModeEnhance.description': 'Troca para o modo Melhorar Imagem.',
  'shortcuts.setModeGuides.label': 'Modo Guias',
  'shortcuts.setModeGuides.description': 'Troca para o modo Guias.',
  'shortcuts.setModeResources.label': 'Modo Recursos',
  'shortcuts.setModeResources.description': 'Troca para o modo Recursos.',
  'shortcuts.applyText.label': 'Aplicar texto',
  'shortcuts.applyText.description':
    'Aplica o item selecionado da fila no Tipógrafo ou no render manual do AIO.',
  'shortcuts.nextRegion.label': 'Selecionar próxima região',
  'shortcuts.nextRegion.description':
    'Move a seleção para a próxima região no Tipógrafo ou no AIO manual.',
  'shortcuts.previousRegion.label': 'Selecionar região anterior',
  'shortcuts.previousRegion.description':
    'Move a seleção para a região anterior no Tipógrafo ou no AIO manual.',
  'shortcuts.toggleMultiBubble.label': 'Alternar multi-bubble',
  'shortcuts.toggleMultiBubble.description':
    'Alterna o agrupamento multi-bubble no Tipógrafo ou no AIO manual.',
  'shortcuts.saveSnapshot.label': 'Salvar snapshot',
  'shortcuts.saveSnapshot.description':
    'Salva um snapshot da sessão do Tipógrafo ou do AIO manual.',
  'shortcuts.detectShapes.label': 'Detectar/refinar shape',
  'shortcuts.detectShapes.description':
    'Executa a detecção ou o refinamento da shape selecionada no Tipógrafo ou no AIO manual.',
  'shortcuts.applyActivePreset.label': 'Aplicar preset ativo',
  'shortcuts.applyActivePreset.description':
    'Aplica o preset tipográfico ativo na região selecionada.',
  'shortcuts.applyLegacyPresetTextBubble.label':
    'Aplicar preset Legacy text_bubble',
  'shortcuts.applyLegacyPresetTextBubble.description':
    'Aplica o preset visual Legacy text_bubble na região selecionada.',
  'shortcuts.applyLegacyPresetTextFree.label':
    'Aplicar preset Legacy text_free',
  'shortcuts.applyLegacyPresetTextFree.description':
    'Aplica o preset visual Legacy text_free na região selecionada.',
  'shortcuts.applyLegacyPresetTextSfx.label': 'Aplicar preset Legacy text_sfx',
  'shortcuts.applyLegacyPresetTextSfx.description':
    'Aplica o preset visual Legacy text_sfx na região selecionada.',
  'shortcuts.applyLegacyPresetTextNarration.label':
    'Aplicar preset Legacy text_narration',
  'shortcuts.applyLegacyPresetTextNarration.description':
    'Aplica o preset visual Legacy text_narration na região selecionada.',
  'shortcuts.applyLegacyPresetTextInsideBlackBubble.label':
    'Aplicar preset Legacy text_inside_black_bubble',
  'shortcuts.applyLegacyPresetTextInsideBlackBubble.description':
    'Aplica o preset visual Legacy text_inside_black_bubble na região selecionada.',
  'shortcuts.applyAutoShape.label': 'Aplicar shape automático',
  'shortcuts.applyAutoShape.description':
    'Escolhe automaticamente entre elliptic e rectangular para a região selecionada.',
  'shortcuts.convertShapeSquare.label': 'Converter shape para rectangular',
  'shortcuts.convertShapeSquare.description':
    'Converte a região selecionada para shape rectangular.',
  'shortcuts.convertShapeRounded.label': 'Converter shape para elliptic',
  'shortcuts.convertShapeRounded.description':
    'Converte a região selecionada para shape elliptic.',
  'shortcuts.deleteRegion.label': 'Remover região selecionada',
  'shortcuts.deleteRegion.description':
    'Remove a região selecionada no AIO manual, Tipógrafo, Tradutor visual ou Cleaner.',
  'shortcuts.editInline.label': 'Abrir edição inline da região',
  'shortcuts.editInline.description':
    'Abre a edição inline da região selecionada no render manual.',
  'shortcuts.inlineEditorCancel.label': 'Cancelar edição inline',
  'shortcuts.inlineEditorCancel.description':
    'Disponível apenas dentro da textarea de edição inline.',
  'shortcuts.inlineEditorSave.label': 'Salvar edição inline',
  'shortcuts.inlineEditorSave.description':
    'Disponível apenas dentro da textarea de edição inline.',
  'shortcuts.category.palette': 'Paleta de Ferramentas',
  'shortcuts.duplicateRegion.label': 'Duplicar região selecionada',
  'shortcuts.duplicateRegion.description':
    'Duplica a região selecionada no Tipógrafo ou AIO manual com offset de 18px.',
  'shortcuts.toolConfigToggle.label': 'Alternar painel de configuração',
  'shortcuts.toolConfigToggle.description':
    'Abre ou fecha o painel de configuração da ferramenta ativa na paleta.',
  'shortcuts.toolAreaSelect.label': 'Ferramenta: Seleção de área',
  'shortcuts.toolAreaSelect.description':
    'Ativa a ferramenta de seleção de área no AIO manual.',
  'shortcuts.toolClearRegions.label': 'Limpar todas as regiões',
  'shortcuts.toolClearRegions.description':
    'Remove todas as regiões da imagem ativa no AIO manual.',
  'shortcuts.toolSegmentBrush.label': 'Ferramenta: Pincel de segmento',
  'shortcuts.toolSegmentBrush.description':
    'Ativa o pincel para edição manual de máscara de segmentação.',
  'shortcuts.toolSegmentEraser.label': 'Ferramenta: Borracha de segmento',
  'shortcuts.toolSegmentEraser.description':
    'Ativa a borracha para edição manual de máscara de segmentação.',
  'shortcuts.toolPaint.label': 'Ferramenta: Pintura',
  'shortcuts.toolPaint.description':
    'Ativa a ferramenta de pintura manual sobre a imagem.',
  'shortcuts.toolPaintEraser.label': 'Ferramenta: Borracha de pintura',
  'shortcuts.toolPaintEraser.description':
    'Ativa a borracha para apagar a camada de pintura manual.',
  'shortcuts.toolMagicWand.label': 'Ferramenta: Varinha mágica',
  'shortcuts.toolMagicWand.description':
    'Ativa a varinha mágica para seleção por tolerância de cor.',
  'shortcuts.toolHealingBrush.label': 'Ferramenta: Pincel de correção',
  'shortcuts.toolHealingBrush.description':
    'Ativa o pincel de correção (healing brush) para restauração de imagem.',
  'shortcuts.toolClearPaint.label': 'Limpar camada de pintura',
  'shortcuts.toolClearPaint.description':
    'Remove toda a camada de pintura manual da imagem ativa.',
  'shortcuts.toolResetEdits.label': 'Redefinir edições manuais',
  'shortcuts.toolResetEdits.description':
    'Desfaz todas as edições manuais da imagem ativa no Cleaner ou AIO.',
  'dashboard.coachmark.stage.titleSuffix': 'palco principal',
  'dashboard.coachmark.stage.bodyWithImages':
    'Aqui você vê a imagem ativa, valida o resultado visual do modo <strong>{modeLabel}</strong> e faz ajustes com feedback imediato.',
  'dashboard.coachmark.stage.bodyWithoutImages':
    'Quando você carregar imagens, este palco vira o centro visual do modo <strong>{modeLabel}</strong>. É onde o resultado aparece primeiro.',
  'dashboard.coachmark.stage.accent': 'Palco',
  'dashboard.coachmark.tools.titleSuffix': 'caixa de ferramentas',
  'dashboard.coachmark.tools.body':
    'Use a sidebar direita para configurar opções, presets e ações do modo <strong>{modeLabel}</strong>. Se algo muda no fluxo, normalmente começa aqui.',
  'dashboard.coachmark.tools.accent': 'Ferramentas',
  'dashboard.coachmark.download.titleSuffix': 'exportação',
  'dashboard.coachmark.download.body':
    'Quando o resultado estiver do jeito certo, finalize pelo menu de exportação para baixar imagens, pacotes ou PSDs sem sair do modo atual.',
  'dashboard.coachmark.download.accent': 'Entrega',
  'dashboard.coachmark.organize.uploadTitle': 'Organizar: comece pelo upload',
  'dashboard.coachmark.organize.uploadBody':
    'Arraste páginas, capítulos ou pacotes inteiros aqui. O modo Organizar existe para preparar o lote antes de entrar na produção.',
  'dashboard.coachmark.organize.uploadAccent': 'Entrada',
  'dashboard.coachmark.organize.orderTitle': 'Organizar: revise a ordem',
  'dashboard.coachmark.organize.orderBody':
    'Na sidebar esquerda você escolhe a imagem ativa, reordena páginas, remove itens ruins e confere se o capítulo está pronto para seguir.',
  'dashboard.coachmark.organize.orderAccent': 'Lote',
  'dashboard.coachmark.aioAuto.pipelineTitle':
    'AIO automático: deixe o pipeline correr',
  'dashboard.coachmark.aioAuto.pipelineBody':
    'No automático, você configura uma vez e processa o lote em sequência. Ideal para throughput, revisão posterior e fluxos mais repetitivos.',
  'dashboard.coachmark.aioAuto.pipelineAccent': 'Auto',
  'dashboard.coachmark.aioAuto.stagesTitle':
    'AIO automático: ligue só o necessário',
  'dashboard.coachmark.aioAuto.stagesBody':
    'Ative apenas as etapas que fazem sentido para esse lote. Menos etapas significa menos custo, menos tempo e menos pontos de falha.',
  'dashboard.coachmark.aioAuto.stagesAccent': 'Pipeline',
  'dashboard.coachmark.aioAuto.configTitle':
    'AIO automático: defina modelos e idiomas',
  'dashboard.coachmark.aioAuto.configBody':
    'Escolha idiomas, presets e modelos antes de rodar. Essa é a parte que mais influencia velocidade, qualidade e custo do processamento.',
  'dashboard.coachmark.aioAuto.configAccent': 'Setup',
  'dashboard.coachmark.aioManual.title': 'AIO manual: trabalhe etapa por etapa',
  'dashboard.coachmark.aioManual.body':
    'No manual, você executa, revisa e corrige cada estágio com mais controle. É o modo ideal para acabamento fino e recuperação de casos difíceis.',
  'dashboard.coachmark.aioManual.accent': 'Manual',
  'dashboard.coachmark.aioManual.dockTitle':
    'AIO manual: use a dock como sua bancada',
  'dashboard.coachmark.aioManual.dockBody':
    'A dock flutuante reúne seleção, segmentação, pintura, varinha e healing. Pense nela como o mini painel de intervenção rápida em cima do preview.',
  'dashboard.coachmark.aioManual.dockAccent': 'Dock',
  'dashboard.coachmark.typesetter.titleManual': 'Tipógrafo manual',
  'dashboard.coachmark.typesetter.titleAuto': 'Tipógrafo automático',
  'dashboard.coachmark.typesetter.bodyManual':
    'O manual é melhor para microajustes de balão, shape, fonte e ritmo visual por página.',
  'dashboard.coachmark.typesetter.bodyAuto':
    'O automático acelera rascunhos e lotes grandes. Use depois uma revisão visual rápida para garantir consistência.',
  'dashboard.coachmark.typesetter.accentManual': 'Manual',
  'dashboard.coachmark.typesetter.accentAuto': 'Auto',
  'dashboard.coachmark.cleaner.dockTitle':
    'Cleaner: correção local sem sair da imagem',
  'dashboard.coachmark.cleaner.dockBody':
    'Quando a dock estiver visível, use pintura, borracha e healing para fechar detalhes sem perder o contexto da página.',
  'dashboard.coachmark.cleaner.dockAccent': 'Dock',
  'dashboard.coachmark.content.titleSuffix': 'navegação de conteúdo',
  'dashboard.coachmark.content.body':
    'Esse modo troca o palco visual por um painel de consulta. Use-o para aprender fluxos, revisar material de apoio e voltar para a produção com menos atrito.',
  'dashboard.coachmark.content.accent': 'Consulta',
  'dashboard.coachmark.progress': 'Guia {{current}} / {{total}}',
  'dashboard.coachmark.next': 'Próximo',
  'dashboard.coachmark.prev': 'Anterior',
  'dashboard.coachmark.done': 'Entendi',
  'aioModel.label.unavailable': ' (indisponível)',
  'aioModel.label.notInstalled': '(Não instalado — clique para instalar)',
  'aioModel.label.updateAvailable': '(Update disponível)',
  'aioModel.label.installed': '(Instalado)',
  'aioModel.status.selectAndInstall':
    'Selecione e instale um modelo local para a etapa "{stage}".',
  'aioModel.status.installBeforeUse':
    'Instale o modelo "{name}" antes de usar esta etapa.',
  'aioModel.status.selectValidOcr': 'Selecione um modelo válido para OCR.',
  'aioModel.status.inRoadmap': 'O modelo "{name}" ainda está em roadmap.',
  'aioModel.status.requiresConfig':
    'O modelo "{name}" requer configuração antes do uso.',
  'aioModel.status.installedOk': 'instalado (ok)',
  'aioModel.status.installedUpdate': 'instalado (update disponível)',
  'aioExec.selectAndInstallStage':
    'Selecione e instale um modelo local antes de executar a etapa "{stageLabel}".',
  'aioExec.installBeforeStage':
    'Instale o modelo "{name}" antes de executar a etapa "{stageLabel}".',
  'aioExec.selectValidOcrModel':
    'Selecione um modelo válido para Reconhecer Texto.',
  'aioExec.ocrRequiresApiKey':
    'Este provider OCR exige API key. Configure a key antes de executar.',
  'aioExec.installTranslationModel':
    'Instale um modelo de tradução compatível antes de executar o AIO.',
  'aioExec.incompatibleLanguage':
    'O modelo selecionado não é compatível com o idioma atual.',
  'aioExec.translationModelIncompatible':
    '"{modelName}" não suporta o idioma de destino selecionado. Escolha um modelo compatível ou altere o idioma de destino.',
  'aioExec.selectValidTranslation':
    'Selecione um modelo de tradução válido para continuar.',
  'aioExec.selectCustomOcrProfile':
    'Selecione ou salve um perfil de Custom AI OCR antes de executar o AIO.',
  'aioExec.selectCustomAiProfile':
    'Selecione ou salve um perfil de Custom AI antes de executar o AIO.',
  'aioExec.translationRequiresApiKey':
    'Este provider de tradução exige API key. Configure a key antes de executar.',
  'aioManual.selectImage': 'Selecione uma imagem para executar no modo manual.',
  'aioManual.imageNotFound': 'Imagem ativa não encontrada.',
  'aioManual.progressNotInitialized':
    'Progressão manual não inicializada para a imagem ativa.',
  'aioManual.selectValidDetectModel':
    'Selecione um modelo válido para Detectar Texto.',
  'aioManual.selectValidSegmentModel':
    'Selecione um modelo válido para Segmentar Texto.',
  'aioManual.selectValidCleanModel':
    'Selecione um modelo válido para Limpar Imagem.',
  'aioManual.stageDone':
    'Modo manual: etapa "{stageLabel}" executada para "{fileName}".',
  'aioManual.executionAborted': 'Execução manual do AIO interrompida.',
  'aioManual.stageFailed': 'Falha ao executar a etapa "{stageLabel}".',
  'translator.localModelIncompatible':
    'O modelo local selecionado não é compatível com o idioma atual do Tradutor.',
  'translator.selectValidTranslationModel':
    'Selecione um modelo válido de tradução para o Tradutor.',
  'translator.selectCustomAiTranslationProfile':
    'Selecione ou salve um perfil de Custom AI de tradução antes de executar.',
  'translator.localOcrModelIncompatible':
    'O modelo OCR local selecionado não é compatível com o idioma atual do Tradutor.',
  'translator.installCompatibleOcrModel':
    'Instale um modelo OCR compatível antes de executar o Tradutor visual.',
  'translator.selectValidOcrModel':
    'Selecione um modelo válido de OCR para o Tradutor visual.',
  'modelManager.error.diskCheckFailed':
    'Não foi possível verificar o espaço em disco.',
  'modelManager.downloadError.network':
    'O download falhou por um problema de conexão. Verifique sua internet e tente novamente.',
  'modelManager.downloadError.disk_full':
    'Não há espaço em disco suficiente para instalar este modelo. Libere espaço e tente novamente.',
  'modelManager.downloadError.checksum_mismatch':
    'O arquivo baixado está corrompido. Nós o removemos — tente baixar novamente.',
  'modelManager.downloadError.rate_limited':
    'O servidor de modelos está limitando requisições agora. Aguarde um instante e tente novamente.',
  'modelManager.downloadError.cancelled': 'Download cancelado.',
  'modelManager.downloadError.unknown':
    'Algo deu errado ao instalar o modelo. Tente novamente.',
  'updater.mandatoryUpdate':
    'Esta atualização é obrigatória. Baixe e instale para continuar.',
  'translatorVisual.noImages':
    'Carregue ao menos uma imagem para usar o Tradutor visual.',
  'translatorVisual.running.aiSfx':
    'Tradutor visual AI SFX: detectando, classificando, reconhecendo, traduzindo e limpando...',
  'translatorVisual.running.standard':
    'Tradutor visual: detectando, reconhecendo e traduzindo...',
  'translatorVisual.invalidSfxResponse':
    'Resposta inválida do AI SFX do Tradutor para "{fileName}".',
  'translatorVisual.done.aiSfx':
    'Tradutor visual AI SFX concluído. {candidates} candidata(s), {approved} SFX aprovado(s), {ocr} OCR(s), {translations} tradução(ões) e {redraw} região(ões) pedindo redraw.',
  'translatorVisual.done.standard':
    'Tradutor visual concluído. {detected} região(ões) detectada(s), {recognized} texto(s) reconhecido(s), {translations} tradução(ões) gerada(s).',
  'translatorVisual.genericError': 'Falha ao executar o Tradutor visual.',
  'freeProvider.catalogOnly':
    'O provider "{name}" está disponível apenas como catálogo no v1.',
  'enhanceActions.connectError':
    'Melhorar falhou ao conectar com o backend ({url}). Verifique se o mini-backend está ativo.',
  'aioSingleProcessor.invalidCleanResponse':
    'Resposta inválida na limpeza de "{fileName}".',
  'cleanerActions.detectFailed':
    'Falha ao detectar regiões para "{fileName}": {message}',
  'cleanerActions.invalidSfxResponse':
    'Resposta inválida do AI SFX Cleaner para "{fileName}".',
  'cleanerActions.invalidAutoCleanResponse':
    'Resposta inválida do Automatic AI Clean para "{fileName}".',
  'cleanerActions.sfxDone':
    'AI SFX Cleaner concluído. {images} imagem(ns), {candidates} candidata(s), {approved} SFX aprovado(s) e {redraw} região(ões) pedindo redraw.',
  'cleanerActions.autoCleanDone':
    'Automatic AI Clean concluído. {images} imagem(ns) processada(s) e {detected} região(ões) detectada(s).',
  'cleanerActions.assistedDone':
    'Cleaner Assistido concluído. {images} imagem(ns) limpa(s), {detected} região(ões) detectada(s), {recognized} texto(s) reconhecido(s), {segmented} região(ões) segmentada(s).',
  'webhook.event.processStart.label': 'Processamento iniciado',
  'webhook.event.processStart.desc': 'Quando uma execução começar',
  'webhook.event.processComplete.label': 'Processamento concluído',
  'webhook.event.processComplete.desc':
    'Quando uma execução terminar com sucesso',
  'webhook.event.processError.label': 'Erros de processamento',
  'webhook.event.processError.desc': 'Quando ocorrer uma falha',
  'webhook.event.updateAvailable.label': 'Atualização disponível',
  'webhook.event.updateAvailable.desc': 'Quando houver nova versão disponível',
  'webhook.event.updateDownloaded.label': 'Atualização baixada',
  'webhook.event.updateDownloaded.desc':
    'Quando o download da atualização terminar',
  'webhook.event.updateError.label': 'Erro de atualização',
  'webhook.event.updateError.desc': 'Quando ocorrer falha no updater',
  'webhook.validation.urlRequired': 'Informe a URL do webhook do Discord.',
  'webhook.validation.urlInvalid':
    'URL inválida. Verifique o formato do webhook.',
  'webhook.validation.urlHttpsRequired': 'A URL do webhook deve usar HTTPS.',
  'webhook.validation.urlNotDiscord':
    'Use uma URL oficial do Discord (discord.com).',
  'webhook.validation.urlInvalidPath':
    'O caminho da URL não corresponde a um webhook válido do Discord.',
  'typography.effect.none.label': 'Sem efeito',
  'typography.effect.none.description': 'Texto limpo, sem camadas extras.',
  'typography.effect.balloon_smear.label': 'Balão Smear',
  'typography.effect.balloon_smear.description':
    'Rastro vertical cinza com leve oscilação lateral, inspirado em texto de fala dramática.',
  'typography.effect.smiles_outline.label': 'SMILES Outline',
  'typography.effect.smiles_outline.description':
    'Contorno suave coral com miolo claro, estilo sussurro fofo.',
  'typography.effect.ahnnn_peach.label': 'Ahnnn Peach Glow',
  'typography.effect.ahnnn_peach.description':
    'Preenchimento pêssego com glow quente e macio.',
  'typography.effect.silence_ink.label': 'Silence Ink',
  'typography.effect.silence_ink.description':
    'Azul arroxeado com presença limpa e ligeiro depth interno.',
  'typography.effect.hwa_pastel.label': 'HWA Pastel',
  'typography.effect.hwa_pastel.description':
    'Amarelo claro com outline rosado e sensação leve.',
  'typography.effect.hah_pop.label': 'HAH Pop',
  'typography.effect.hah_pop.description':
    'Miolo lilás claro com presença pop e relevo rosa.',
  'typography.effect.smooch_jelly.label': 'Smooch Jelly',
  'typography.effect.smooch_jelly.description':
    'Rosa macio com brilho gelatinoso e sombra doce.',
  'typography.effect.tremble_brush.label': 'Tremble Brush',
  'typography.effect.tremble_brush.description':
    'Pincel energético azul-violeta com borda irregular.',
  'typography.effect.eheheh_whisper.label': 'EHEHEH Whisper',
  'typography.effect.eheheh_whisper.description':
    'Rosa claro com contorno fofo e glow tímido.',
  'typography.effect.hoho_ink.label': 'HOHO Ink',
  'typography.effect.hoho_ink.description':
    'Azul escuro com dripping vertical e textura seca.',
  'typography.effect.blam_impact.label': 'BLAM Impact',
  'typography.effect.blam_impact.description':
    'Explosão amarela com sombra vermelha deslocada.',
  'typography.effect.badump_soft.label': 'BADUMP Soft',
  'typography.effect.badump_soft.description':
    'Degradê pastel rosado e macio, com aura romântica.',
  'typography.effect.thump_heavy.label': 'THUMP Heavy',
  'typography.effect.thump_heavy.description':
    'Impacto preto com sombra vinho dura e inclinada.',
  'typography.effect.neon_woah.label': 'WOAH Neon',
  'typography.effect.neon_woah.description':
    'Texto branco com glow rosa intenso de surpresa/brilho.',
  'typography.effect.slash_speed.label': 'SLAP Speed Slash',
  'typography.effect.slash_speed.description':
    'Tipografia escura com arrasto diagonal/motion blur agressivo.',
  'typography.effect.ah_teal.label': 'Ah Teal',
  'typography.effect.ah_teal.description':
    'Aqua/teal com outline escuro e sensação leve de fala suave.',
  'typography.effect.drip_blue.label': 'DRIP Blue',
  'typography.effect.drip_blue.description':
    'Azul claro com sensação líquida e caimento/drip.',
  'typography.effect.question_pop.label': 'Question Pop',
  'typography.effect.question_pop.description':
    'Sinal de pontuação quente com sombra coral deslocada.',
  'typography.effect.laugh_curve.label': 'Laugh Curve',
  'typography.effect.laugh_curve.description':
    'Ciano brilhante para risada arqueada e leve.',
  'typography.effect.shake_blur.label': 'Shake Blur',
  'typography.effect.shake_blur.description':
    'Roxo escuro com vibração/motion blur para tremor.',
  'typography.effect.beep_outline.label': 'Beep Outline',
  'typography.effect.beep_outline.description':
    'Texto branco com outline preto grosso para SFX limpo e legível.',
  'typography.effect.boom_comic.label': 'BOOM Comic',
  'typography.effect.boom_comic.description':
    'Explosão amarela/vermelha de quadrinho clássico.',
  'typography.effect.bang_chunk.label': 'BANG Chunk',
  'typography.effect.bang_chunk.description':
    'Bloco roxo/azul com sombra dourada grossa deslocada.',
  'typography.effect.break_glitch.label': 'BREAK Glitch',
  'typography.effect.break_glitch.description':
    'Magenta escuro com textura de falha/scan quebrado.',
  'typography.effect.flinch_outline.label': 'FLINCH Outline',
  'typography.effect.flinch_outline.description':
    'Preto com contorno branco bem agressivo para reação instantânea.',
  'typography.effect.growl_moss.label': 'Growl Moss',
  'typography.effect.growl_moss.description':
    'Verde oliva seco para som rouco/animal.',
  'typography.effect.yawn_soft.label': 'Yawn Soft',
  'typography.effect.yawn_soft.description':
    'Verde-limão com outline roxo para fala mole/esticada.',
  'typography.effect.scratch_noise.label': 'Scratch Noise',
  'typography.effect.scratch_noise.description':
    'Preto áspero com aparência granulada/ruidosa.',
  'typography.effect.crack_ink.label': 'Crack Ink',
  'typography.effect.crack_ink.description':
    'Brush preto seco e cortante para impacto súbito.',
  'typography.effect.slap_scratch.label': 'Slap Scratch',
  'typography.effect.slap_scratch.description':
    'Rabisco fino e arrastado para efeito de raspão/ataque rápido.',
  'typography.effect.dash_edge.label': 'Dash Edge',
  'typography.effect.dash_edge.description':
    'Verde escuro pontudo para golpe/entrada brusca.',
  'typography.effect.scream_scratch.label': 'Scream Scratch',
  'typography.effect.scream_scratch.description':
    'Grito preto com offset vermelho áspero.',
  'model.opus-mt-ja-en.description':
    'Pipeline OPUS-MT otimizado para conteúdo japonês, com tradução para inglês e fluxo secundário para português.',
  'model.nllb-200-600m-int8.description':
    'Modelo multilíngue NLLB quantizado em int8 para reduzir consumo de memória mantendo boa qualidade para KO→EN/PT.',
  'model.opus-mt-zh-en.description':
    'Modelo OPUS-MT para chinês com tradução principal para inglês e fluxo para português.',
  'model.nllb-200-1.3b.description':
    'Modelo multilíngue de maior qualidade para tradução geral em larga cobertura de idiomas.',
  'model.nllb-200-1.3b-int8-ct2.description':
    'Versão quantizada em CTranslate2 do NLLB 1.3B, reduzindo VRAM com ótima relação custo-benefício.',
  'model.nllb-200-3.3b.description':
    'Modelo NLLB de alta capacidade para máxima qualidade em múltiplos idiomas.',
  'model.sugoi_v4_ja_en_ct2.description':
    'Tradutor local japonês→inglês com CTranslate2 e SentencePiece, compatível com o fluxo offline do BallonsTranslator.',
  'model.m2m100_1_2b_ct2.description':
    'Tradutor local multilíngue via CTranslate2, com cobertura ampla de idiomas e compatibilidade com o fluxo offline do BallonsTranslator.',
  'model.font_rtdetr_v2.description':
    'Modelo local para detecção de regiões de texto no pipeline AIO.',
  'model.comic_text_detector.description':
    'Detector local baseado no módulo CTD do BallonsTranslator para caixas de texto em páginas de manga.',
  'model.manga_ocr.description': 'Modelo OCR local para japonês no AIO.',
  'model.meiki_ocr.description':
    'OCR japonês local especializado em texto renderizado, com modelos horizontal e vertical em ONNX.',
  'model.paddleocr_vl_manga.description':
    'OCR local VLM especializado em manga japonesa.',
  'model.got_ocr2.description':
    'OCR local multimodal via GOT-OCR 2.0 com runtime nativo em transformers.',
  'model.qwen2_5_vl_3b.description':
    'OCR local multimodal via Qwen2.5-VL-3B-Instruct.',
  'model.mangalmm.description':
    'OCR/entendimento multimodal especializado em manga com base Qwen2.5-VL.',
  'model.rolmocr.description':
    'OCR local robusto com base Qwen2.5-VL e otimização para leitura de documentos.',
  'model.glm_ocr_onnx.description':
    'OCR local GLM com foco em layout complexo e runtime nativo em transformers.',
  'model.paddleocr.description':
    'Modelo OCR local para russo/eslavo (eslav) no pipeline AIO.',
  'model.paddleocr_latin_v5.description':
    'Modelo OCR local para idiomas latinos (inclui Dutch) no pipeline AIO.',
  'model.paddleocr_ch_v5.description':
    'Modelo OCR local para chinês no pipeline AIO.',
  'model.paddleocr_en_v5.description':
    'Modelo OCR local focado em inglês para o pipeline AIO.',
  'model.easyocr.description':
    'OCR local multi-idioma com instalação sob demanda no diretório de modelos do app.',
  'model.pororo.description': 'Modelo OCR local para coreano no pipeline AIO.',
  'model.baka_content_cc.description':
    'Modelo local para segmentação/refino das regiões de texto no AIO.',
  'model.aot.description':
    'Modelo local de inpainting para limpeza de balões no AIO.',
  'model.lama_manga.description':
    'Modelo local de inpainting contextual para áreas complexas no AIO.',
  'model.opencv_lama.description':
    'Modelo local leve de inpainting via OpenCV Zoo, pensado para CPU e execução rápida.',
  'model.lama_fp32.description':
    'Port ONNX recomendado do big-lama em 512x512, indicado para CPU/GPU quando se busca equilíbrio entre qualidade e simplicidade.',
  'model.vntl_llama3_8b_v2.description':
    'Fine-tune LLaMA3 para VN japonês → inglês. Dataset reconstruído com suporte multi-linha. Use temp 0. (~5.7-8.5GB GGUF).',
  'model.lfm2_350m_enjp_mt.description':
    'Tradutor bidirecional JA↔EN ultra-leve de 0.4B params. Q4_0 com apenas 219MB — ideal para CPU e edge devices.',
  'model.sakura_galtransl_7b_v3_7.description':
    'Tradutor JA→ZH-CN otimizado para visual novels. Preserva quebras de linha, controle chars e ruby. CC-BY-NC-SA 4.0 (~4.25GB IQ4_XS).',
  'model.sakura_1_5b_qwen2_5_v1_0.description':
    'Alternativa leve ao Sakura 7B com quantização IMatrix. ~1GB Q5KS. Ideal para GPUs mid-range ou CPU (~4GB RAM).',
  'model.hunyuan_7b_mt_v1_0.description':
    'Tradutor multilíngue da Tencent — 1º lugar WMT25. 33 idiomas bidirecionais. Prompt: "Translate into <target_language>." (~4.2GB Q4_K_M).',
  'model.pp_doclayout_v3.description':
    'Modelo local de detecção de layout e texto baseado em PP-DocLayout V3. Alta precisão para análise de layout de página.',
  'model.paddleocr_vl_1_5.description':
    'OCR VLM multilíngue de alta qualidade (PaddleOCR-VL 1.5). Até 128 tokens por bloco de texto.',
  'model.waifu2x_swin_unet_art_scan_2x.description':
    'Melhor opção local para páginas de mangá/manhwa com foco em lineart e balões.',
  'model.waifu2x_swin_unet_art_scan_4x.description':
    'Variante 4x para páginas escaneadas de mangá/manhwa.',
  'model.waifu2x_swin_unet_art_2x.description':
    'Modelo 2x para arte digital/anime limpa.',
  'model.4xnomos2_hq_mosr.description':
    'Upscaler 4x ONNX de alta qualidade para material pouco degradado.',
  'model.4xspankendata.description':
    'Modelo ONNX leve como fallback geral de 4x.',
  'model.2x_hfa2kcompact.description':
    'Candidato compatível apenas via importação ONNX manual/conversão externa.',
  'model.2x_digitalfilm_superultracompact.description':
    'Candidato para importação manual de ONNX.',
  'model.2x_anifilm_compact.description':
    'Candidato para importação manual de ONNX.',
  'model.2xnomosuni_span_multijpg_ldl.description':
    'Candidato para importação manual de ONNX.',
  'model.realesrgan_x4plus.description':
    'Candidato para importação manual de ONNX.',
  'model.4xhfa2kludvaeswinir_light.description':
    'Candidato para importação manual de ONNX.',
  'splitter.status.recipeApplied':
    'Recipe do Splitter aplicada à imagem ativa.',
  'splitter.status.recipeRestored':
    'Recipe do Splitter restaurada para o padrão.',
  'splitter.status.exportCancelled':
    'Exportação do Splitter cancelada pelo usuário.',
  'splitter.error.noSegmentsActive':
    'Nenhum segmento válido foi gerado para a imagem ativa.',
  'splitter.error.noSegmentsBatch':
    'Nenhum segmento válido foi gerado no lote do Splitter.',
  'aioExec.sessionUnavailable': 'Sessão indisponível para usar modelos na nuvem. Faça login novamente.',
  'aioManual.progressionNotInitialized':
    'Progressão manual não inicializada para a imagem ativa.',
  'cleanerActions.selectValidOcrModel':
    'Selecione um modelo válido para OCR no Cleaner.',
  'cleanerActions.invalidCleanResponseNamed':
    'Resposta de limpeza inválida para "{name}".',
  'customLlm.selectTranslationProfile':
    'Selecione um perfil custom salvo de tradução para usar.',
  'customLlm.selectOcrProfile':
    'Selecione um perfil custom salvo de OCR para usar.',
  'customLlm.profileNotFound':
    'Perfil custom não encontrado. Recarregue e tente novamente.',
  'customLlm.translationProfileActive':
    'Perfil custom em uso (tradução): {label}.',
  'customLlm.ocrProfileActive': 'Perfil custom em uso (OCR): {label}.',
  'accountSync.confirmEmailSent':
    'Email de confirmação enviado. Verifique sua caixa de entrada.',
  'accountSync.confirmEmailFailed': 'Falha ao enviar email de confirmação.',
  'downloadActions.noTranslatorResults':
    'Nenhum resultado do Tradutor disponível para download.',
  'enhanceActions.desktopOnly':
    'O enhancer local está disponível apenas no app desktop.',
  'enhanceActions.selectModel': 'Selecione um modelo de melhoria compatível.',
  'enhanceActions.done': 'Melhoria concluída. Use Baixar para salvar.',
  'freeProvider.stageNotSupported': 'Provider não suporta esta etapa.',
  'freeProvider.activeForTranslation': 'Provider {name} em uso para tradução.',
  'freeProvider.activeForOcr': 'Provider {name} em uso para OCR.',
  'freeProvider.activeForClean': 'Provider {name} em uso para limpeza.',
  'freeProvider.stageTranslation': 'Tradução',
  'freeProvider.stageOcr': 'OCR',
  'freeProvider.stageClean': 'Limpeza',
  'translatorRetranslate.targetNotFound':
    'Imagem alvo não encontrada para retradução.',
  'translatorRetranslate.noTextAvailable':
    'Nenhum texto reconhecido disponível para retradução.',
  'translatorText.done': 'Tradutor texto concluído. Use copiar ou baixar TXT.',
  'typographer.queueApplied': 'Texto da fila aplicado à seleção atual.',
  'typographer.queueAppliedMulti':
    'Texto da fila aplicado a {{count}} bubble(s).',
  'typographer.queueCleared': 'Fila do Tipógrafo limpa.',
  'typographer.queueImported': 'Texto importado para a fila do Tipógrafo.',
  'aioManual.invalidCleanResponse': 'Resposta inválida ao limpar imagem.',
  'aioStage.lang.ko': 'Coreano',
  'aioStage.lang.ja': 'Japonês',
  'aioStage.lang.fr': 'Francês',
  'aioStage.lang.zh': 'Chinês',
  'aioStage.lang.zh-CN': 'Chinês Simplificado',
  'aioStage.lang.zh-TW': 'Chinês Tradicional',
  'aioStage.lang.en': 'Inglês',
  'aioStage.lang.ru': 'Russo',
  'aioStage.lang.de': 'Alemão',
  'aioStage.lang.nl': 'Holandês',
  'aioStage.lang.es': 'Espanhol',
  'aioStage.lang.it': 'Italiano',
  'aioStage.lang.tr': 'Turco',
  'aioStage.lang.pl': 'Polonês',
  'aioStage.lang.pt': 'Português',
  'aioStage.lang.pt-BR': 'Português (BR)',
  'aioStage.lang.th': 'Tailandês',
  'aioStage.lang.vi': 'Vietnamita',
  'aioStage.lang.hu': 'Húngaro',
  'aioStage.lang.id': 'Indonésio',
  'aioStage.lang.fi': 'Finlandês',
  'aioStage.lang.ar': 'Árabe',
  'splitter.warning.noIntermediateCuts':
    'Nenhum corte intermediário foi encontrado.',
  'splitter.warning.segmentTooSmall':
    'Há segmento menor que a altura mínima configurada.',
  'splitter.warning.segmentTooLarge':
    'Há segmento maior que a altura máxima configurada.',
  'splitter.warning.cutsNearContent':
    'Alguns cortes ficaram próximos de áreas com conteúdo.',
  'splitter.warning.nearEdge': 'Muito próximo da borda.',
  'stitch.warning.dimensionTooHigh':
    'Dimensão muito alta; exporte em mais lotes para evitar falhas.',
  'stitch.warning.outputTooHeavy':
    'Saída muito pesada para revisão e download.',
  'stitch.warning.canvasLimit':
    'Pode exceder limites seguros de canvas em alguns ambientes.',
  'stitch.warning.largeBatch':
    'Lote grande; revise se a quebra continua confortável para scanlation.',
  'resources.data.fontsTitle': 'Fontes para Typesetting',
  'resources.data.fontsDesc':
    'Coleção curada de fontes populares para scanlation de mangá, manhwa e manhua.',
  'resources.data.onomatopoeiaDesc':
    'Biblioteca de onomatopeias japonesas com traduções e exemplos de uso.',
  'resources.data.glossaryTitle': 'Glossário de Scanlation',
  'resources.data.glossaryDesc':
    'Termos técnicos e jargão da comunidade de scanlation.',
  'resources.data.catalogLabel': 'Catálogo',
  'aioLocalBatch.invalidBatchResponse':
    'Resposta batch inválida: batch_report.json ausente no ZIP.',
  'modelDownload.desktopOnly':
    'Gerenciamento de modelos disponível apenas no app desktop.',
  'settings.updates.channelBeta': 'Beta',
  'settings.updates.channelStable': 'Stable',
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
    'Exchange code for tokens',
  'settings.integrations.blogger.term.refreshToken': 'Refresh Token',
  'settings.integrations.blogger.term.cloudName': 'cloud name',
  'settings.integrations.blogger.term.blogId': 'Blog ID',
  'settings.integrations.imgur.term.clientId': 'Client ID',
  'settings.integrations.imgur.term.rateLimit': '50 uploads/hora',
  'settings.shortcuts.topbarPath': 'Topbar > Atalhos',
  'login.warning.versionPrefix': 'v{version}',
  'password.policy.minLength': 'Senha deve conter no minimo 12 caracteres.',
  'password.policy.uppercase':
    'Senha deve conter ao menos uma letra maiuscula.',
  'password.policy.lowercase':
    'Senha deve conter ao menos uma letra minuscula.',
  'password.policy.number': 'Senha deve conter ao menos um numero.',
  'password.policy.special': 'Senha deve conter ao menos um simbolo especial.',
  'auth.sfx.primary': '쾅',
  'auth.sfx.secondary': '휙',
  'auth.stats.activeScanlatorsValue': '2.4k+',
  'auth.stats.toolsValue': '50+',
  'auth.stats.pagesProcessedValue': '1M+',
  'auth.community.joinIndicator': '+',
  'resources.sfx.onomatopoeiaLabel': 'Onomatopeias',
  'resources.page.shortcutCtrl': 'Ctrl',
  'resources.page.shortcutFind': 'F',
  'settings.integrations.blogger.value.requestsPerDay': '10,000',
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
  'settings.typographerLibrary.presetsCount_other': '{count} presets',
  'renderPreview.iconUppercase': 'AA',
  'renderPreview.iconHorizontal': 'H',
  'renderPreview.iconVertical': 'V',
  'renderPreview.iconCircular': '◯',
  'guides.home.searchShortcut': '⌘K',
  'brand.name': 'KŌMA',
  'brand.studioSuffix': 'Studio',
  'versionBadge.stable': 'ESTÁVEL',
  'versionBadge.beta': 'BETA',
  'versionBadge.tooltip': 'Versão {version}',
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
  'update.toast.newVersionFallback': 'nova',
  'dashboard.status.cloudSuffix': '(Cloud)',
  'dashboard.status.cloudApiSuffix': '(Cloud/API/AI)',
  'dashboard.status.pendingCustomTranslationName':
    'Custom AI (sincronizando...)',
  'dashboard.status.pendingCustomOcrName': 'Custom OCR (sincronizando...)',
  'modelManager.tooltip.gpu': 'GPU',
  'modelManager.tooltip.vram': 'VRAM',
  'modelManager.tooltip.ram': 'RAM',
  'dashboard.tour.preview.welcome.upload': 'Upload',
  'dashboard.tour.preview.welcome.export': 'Export',
  'dashboard.tour.preview.upload.formats':
    'JPG · PNG · WEBP · ZIP · PDF · CBZ · CB7 · PSD',
  'dashboard.tour.preview.stageEmpty': 'Carregue imagens para começar',
  'dashboard.tour.welcome.title': 'Bem-vindo ao Dashboard do KŌMA Studio',
  'dashboard.tour.welcome.body':
    'Este tour apresenta o fluxo principal do app: organizar páginas, escolher modos, configurar o pipeline AIO e exportar resultados sem precisar adivinhar onde cada recurso fica.',
  'dashboard.tour.sidebar.title': 'Sidebar: quota, arquivos e contexto do lote',
  'dashboard.tour.sidebar.body':
    'Aqui você acompanha plano e uso mensal, escolhe a imagem ativa, reordena páginas, remove itens e mantém o lote organizado antes de processar.',
  'dashboard.tour.upload.title': 'Entrada inicial de arquivos',
  'dashboard.tour.upload.body':
    'O dropzone aceita imagens soltas e pacotes completos. É o ponto de partida para arrastar capítulos, raws ou assets e alimentar o restante do dashboard.',
  'dashboard.tour.modes.title': 'Navegação principal do Dashboard',
  'dashboard.tour.modes.body':
    'Use Organizar para preparar o lote e AIO para o pipeline completo. Os outros grupos da topbar abrem modos especializados sem sair do workspace.',
  'dashboard.tour.production.title': 'Produção: ferramentas especializadas',
  'dashboard.tour.production.body':
    'Cleaner, Tipógrafo, Tradutor, Raw e QC cobrem o fluxo manual e avançado. Pense nesse grupo como os modos profissionais para trabalhar uma etapa específica do capítulo.',
  'dashboard.tour.utils.title': 'Utilitários e apoio',
  'dashboard.tour.utils.body':
    'Costurar, Dividir, Marca d’Água e Melhorar resolvem tarefas rápidas de preparação e exportação. Guias e Recursos completam a área de apoio para consulta.',
  'dashboard.tour.submode.title': 'AIO automático vs. manual',
  'dashboard.tour.submode.body':
    'Automático roda o pipeline completo em lote. Manual libera cada etapa por imagem para revisão fina, rewind/forward e edição visual controlada.',
  'dashboard.tour.pipeline.title': 'Pipeline AIO',
  'dashboard.tour.pipeline.body':
    'Este card controla a sequência Detectar > OCR > Traduzir > Segmentar > Limpar > Render. Você pode ligar ou desligar etapas e, no manual, executar só a etapa atual.',
  'dashboard.tour.stageConfig.title': 'Configuração das etapas',
  'dashboard.tour.stageConfig.body':
    'Aqui ficam idiomas, presets AIO, catálogos locais/cloud e seleção de modelos por etapa. É o centro de decisão para ajustar custo, qualidade e velocidade.',
  'dashboard.tour.stage.withImagesTitle': 'Palco de trabalho e preview visual',
  'dashboard.tour.stage.withImagesBody':
    'Quando há imagens, este palco vira o preview principal: você navega páginas, vê resultados por etapa e trabalha em cima da imagem ativa.',
  'dashboard.tour.stage.emptyTitle': 'Palco central do dashboard',
  'dashboard.tour.stage.emptyBody':
    'Sem imagens, o palco mostra um estado vazio simples. Depois do upload, ele passa a exibir previews, overlays, regiões e resultados por modo.',
  'dashboard.tour.manualDock.title': 'Preview interativo e dock manual',
  'dashboard.tour.manualDock.body':
    'Com uma imagem ativa no AIO manual, a dock flutuante libera seleção de área, pincel, borracha, varinha, healing e ajustes contextuais sem sair do preview.',
  'dashboard.tour.download.title': 'Exportação e downloads',
  'dashboard.tour.download.body':
    'Quando o app já tem saídas prontas, este menu reúne formatos de imagem, pacote, PSD em camadas e opções de metadata para fechar o fluxo de entrega.',
  'dashboard.tour.replay.title': 'Se quiser rever o tour depois',
  'dashboard.tour.replay.body':
    'Abra o menu do usuário e use <strong>Rever tour</strong>. O onboarding automático roda só na primeira visita da versão atual, mas o replay manual fica sempre disponível.',
  'dashboard.tour.progressText': 'Passo {{current}} de {{total}}',
  'dashboard.tour.next': 'Próximo',
  'dashboard.tour.prev': 'Anterior',
  'dashboard.tour.done': 'Concluir tour',
  'dashboard.tour.dialogLabel': 'Tour do Dashboard',
  'dashboard.tour.close': 'Fechar tour',
  'dashboard.tour.nextAria': 'Ir para o próximo passo',
  'dashboard.tour.prevAria': 'Voltar para o passo anterior',
  'modelManager.tooltip.rich.highlights': 'Destaques',
  'modelManager.tooltip.rich.unique': 'Diferencial',
  'modelManager.tooltip.rich.bestFor': 'Ideal para',
  'modelManager.tooltip.rich.performance': 'Performance',
  'modelManager.tooltip.rich.notes': 'Notas',
  'modelManager.tooltip.docsUrl': 'Ver documentação',
  'modelManager.tooltip.notes': 'Notas',
  'modelManager.tooltip.highlights': 'Destaques',
  'modelManager.tooltip.bestFor': 'Ideal para',
  'modelManager.tooltip.unique': 'Diferencial',
  'modelManager.tooltip.performance': 'Performance',

  'model.tooltip.opus-mt-ja-en.highlights':
    'Traduz japonês para inglês\nLeve e rápido, roda bem sem placa de vídeo\nBoa opção para começar',
  'model.tooltip.opus-mt-ja-en.unique':
    'Funciona bem para textos gerais em japonês, mas não foi feito especialmente para mangá',
  'model.tooltip.opus-mt-ja-en.bestFor':
    'Traduções rápidas do japonês para inglês quando você não tem placa de vídeo potente',
  'model.tooltip.opus-mt-ja-en.performance':
    'Muito rápido, funciona em qualquer computador sem precisar de placa de vídeo',
  'model.tooltip.opus-mt-ja-en.notes':
    'Boa opção geral, mas para mangá e anime o Sugoi dá resultados melhores',

  'model.tooltip.nllb-200-600m-int8.highlights':
    'Traduz entre quase 200 idiomas\nVersão leve e otimizada\nRoda bem em qualquer computador',
  'model.tooltip.nllb-200-600m-int8.unique':
    'Um único modelo que traduz entre centenas de idiomas — ideal quando você precisa de versatilidade',
  'model.tooltip.nllb-200-600m-int8.bestFor':
    'Traduzir entre idiomas menos comuns ou quando você precisa de um modelo que funcione para tudo',
  'model.tooltip.nllb-200-600m-int8.performance':
    'Rápido e leve, roda bem mesmo em computadores sem placa de vídeo',
  'model.tooltip.nllb-200-600m-int8.notes':
    'Não foi feito para mangá, mas funciona como tradutor geral para muitos idiomas',

  'model.tooltip.opus-mt-zh-en.highlights':
    'Traduz chinês para inglês\nLeve e rápido\nRoda sem placa de vídeo',
  'model.tooltip.opus-mt-zh-en.unique':
    'Focado em chinês → inglês, bom para manhua e conteúdo chinês geral',
  'model.tooltip.opus-mt-zh-en.bestFor':
    'Traduzir manhua e conteúdo chinês para inglês de forma rápida',
  'model.tooltip.opus-mt-zh-en.performance':
    'Muito rápido, funciona em qualquer computador sem placa de vídeo',
  'model.tooltip.opus-mt-zh-en.notes':
    'Popular e confiável para traduções chinês → inglês',

  'model.tooltip.nllb-200-1.3b.highlights':
    'Traduz entre quase 200 idiomas\nMelhor qualidade que a versão leve\nBoa para idiomas menos comuns',
  'model.tooltip.nllb-200-1.3b.unique':
    'Versão intermediária com mais qualidade que a 600M, mas sem ser tão pesada quanto a 3.3B',
  'model.tooltip.nllb-200-1.3b.bestFor':
    'Quando você precisa de melhor qualidade que a versão leve, especialmente para idiomas raros',
  'model.tooltip.nllb-200-1.3b.performance':
    'Precisa de placa de vídeo com pelo menos 4GB de memória; velocidade razoável',
  'model.tooltip.nllb-200-1.3b.notes':
    'Equilíbrio bom entre qualidade e peso. Não foi feito para mangá.',

  'model.tooltip.nllb-200-1.3b-int8-ct2.highlights':
    'Traduz entre quase 200 idiomas\nVersão otimizada que usa menos memória\nBoa qualidade com menos consumo',
  'model.tooltip.nllb-200-1.3b-int8-ct2.unique':
    'Mesma qualidade da versão 1.3B mas usando menos memória — melhor custo-benefício',
  'model.tooltip.nllb-200-1.3b-int8-ct2.bestFor':
    'Tradução multilíngue com boa qualidade sem precisar de computador muito potente',
  'model.tooltip.nllb-200-1.3b-int8-ct2.performance':
    'Roda em CPU se necessário; mais leve que a versão normal 1.3B',
  'model.tooltip.nllb-200-1.3b-int8-ct2.notes':
    'Versão otimizada do NLLB 1.3B — use esta se quiser economia de memória',

  'model.tooltip.nllb-200-3.3b.highlights':
    'Melhor qualidade entre os tradutores multilíngues\nQuase 200 idiomas\nIdeal quando qualidade importa mais que velocidade',
  'model.tooltip.nllb-200-3.3b.unique':
    'A versão mais potente e precisa da família multilíngue — melhor tradução disponível para idiomas raros',
  'model.tooltip.nllb-200-3.3b.bestFor':
    'Quando a qualidade da tradução é mais importante que a velocidade',
  'model.tooltip.nllb-200-3.3b.performance':
    'Precisa de placa de vídeo boa com pelo menos 8GB de memória; mais lento que os outros',
  'model.tooltip.nllb-200-3.3b.notes':
    'Mais pesado mas com melhor qualidade. Não foi feito para mangá.',

  'model.tooltip.sugoi_v4_ja_en_ct2.highlights':
    'Traduz japonês para inglês\nFeito especialmente para mangá e anime\nFunciona em qualquer computador',
  'model.tooltip.sugoi_v4_ja_en_ct2.unique':
    'Entende gírias, fala casual e expressões típicas de mangá e anime melhor que outros tradutores',
  'model.tooltip.sugoi_v4_ja_en_ct2.bestFor':
    'Traduzir mangá e anime do japonês para inglês — é a escolha mais recomendada pela comunidade',
  'model.tooltip.sugoi_v4_ja_en_ct2.performance':
    'Muito rápido, funciona bem mesmo sem placa de vídeo dedicada',
  'model.tooltip.sugoi_v4_ja_en_ct2.notes':
    'Use este modelo como padrão para traduções japonês → inglês',

  'model.tooltip.m2m100_1_2b_ct2.highlights':
    'Traduz entre 100 idiomas\nCobre coreano, tailandês, vietnamita e mais\nVersão otimizada para rodar mais rápido',
  'model.tooltip.m2m100_1_2b_ct2.unique':
    'Um dos poucos modelos que traduz bem entre idiomas asiáticos como coreano, tailandês e vietnamita para inglês',
  'model.tooltip.m2m100_1_2b_ct2.bestFor':
    'Traduzir manhwa coreano, manhua chinês e conteúdo em outros idiomas asiáticos para inglês',
  'model.tooltip.m2m100_1_2b_ct2.performance':
    'Precisa de placa de vídeo com 4-6GB de memória; velocidade boa com a versão otimizada',
  'model.tooltip.m2m100_1_2b_ct2.notes':
    'Boa opção para idiomas asiáticos que outros tradutores não cobrem bem',

  'model.tooltip.vntl_llama3_8b_v2.highlights':
    'Traduz japonês para inglês\nFeito para visual novels e mangá\nMantém nomes de personagens consistentes',
  'model.tooltip.vntl_llama3_8b_v2.unique':
    'Entende o contexto da história e mantém consistência nos nomes de personagens e termos ao longo do texto',
  'model.tooltip.vntl_llama3_8b_v2.bestFor':
    'Traduzir visual novels e mangá com diálogos longos onde a consistência dos nomes importa',
  'model.tooltip.vntl_llama3_8b_v2.performance':
    'Precisa de placa de vídeo boa com 6-10GB de memória; mais lento que tradutores simples',
  'model.tooltip.vntl_llama3_8b_v2.notes':
    'Ideal para projetos longos onde consistência de nomes e termos é importante',

  'model.tooltip.lfm2_350m_enjp_mt.highlights':
    'Traduz japonês ↔ inglês nos dois sentidos\nUltra leve e rápido\nRoda em qualquer computador',
  'model.tooltip.lfm2_350m_enjp_mt.unique':
    'Um dos menores tradutores disponíveis — funciona até em computadores fracos e ainda assim dá resultados decentes',
  'model.tooltip.lfm2_350m_enjp_mt.bestFor':
    'Quando você precisa de tradução rápida japonês-inglês e não tem placa de vídeo potente',
  'model.tooltip.lfm2_350m_enjp_mt.performance':
    'Extremamente rápido, roda em qualquer computador mesmo sem placa de vídeo',
  'model.tooltip.lfm2_350m_enjp_mt.notes':
    'Qualidade básica — bom para rascunhos rápidos, mas não para resultado final',

  'model.tooltip.sakura_galtransl_7b_v3_7.highlights':
    'Traduz japonês para chinês\nO melhor para galgames e mangá\nMantém formatação e notas especiais',
  'model.tooltip.sakura_galtransl_7b_v3_7.unique':
    'Preserva formatação especial, notas de leitura e quebras de linha — essencial para galgames e mangá com texto complexo',
  'model.tooltip.sakura_galtransl_7b_v3_7.bestFor':
    'A melhor opção para traduzir japonês para chinês quando qualidade é mais importante que velocidade',
  'model.tooltip.sakura_galtransl_7b_v3_7.performance':
    'Precisa de placa de vídeo com pelo menos 6GB de memória; velocidade moderada',
  'model.tooltip.sakura_galtransl_7b_v3_7.notes':
    'Melhor tradução JP→ZH disponível. Use quando qualidade for prioridade.',

  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.highlights':
    'Traduz japonês para chinês\nVersão leve e rápida\nBoa para computadores mais fracos',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.unique':
    'Mesma família do Sakura maior, mas otimizado para rodar em computadores com menos memória',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.bestFor':
    'Traduzir japonês para chinês quando você não tem placa de vídeo potente',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.performance':
    'Rápido, precisa de apenas 1-2GB de memória na placa de vídeo',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.notes':
    'Boa qualidade para o tamanho — ideal se o modelo maior for pesado demais',

  'model.tooltip.hunyuan_7b_mt_v1_0.highlights':
    'Traduz entre 36 idiomas\nAlta qualidade premiada em competições\nUm modelo forte para muitos idiomas',
  'model.tooltip.hunyuan_7b_mt_v1_0.unique':
    'Um dos tradutores mais premiados do mundo — combina múltiplas traduções para entregar o melhor resultado possível',
  'model.tooltip.hunyuan_7b_mt_v1_0.bestFor':
    'Quando você precisa de tradução de alta qualidade entre muitos idiomas diferentes',
  'model.tooltip.hunyuan_7b_mt_v1_0.performance':
    'Precisa de placa de vídeo com 6-8GB de memória; velocidade moderada',
  'model.tooltip.hunyuan_7b_mt_v1_0.notes':
    'Excelente para projetos multilíngues onde qualidade é prioridade',

  'model.tooltip.font_rtdetr_v2.highlights':
    'Detecta balões de fala e texto em quadrinhos\nIdentifica texto dentro e fora dos balões\nTudo em uma única passagem',
  'model.tooltip.font_rtdetr_v2.unique':
    'O único que detecta balões, texto dentro dos balões e texto solto na página ao mesmo tempo',
  'model.tooltip.font_rtdetr_v2.bestFor':
    'Análise completa de páginas de quadrinhos — separa diálogos de texto solto automaticamente',
  'model.tooltip.font_rtdetr_v2.performance':
    'Leve e rápido, roda bem na maioria dos computadores',
  'model.tooltip.font_rtdetr_v2.notes':
    'Treinado com mangá, webtoon, manhua e quadrinhos ocidentais',

  'model.tooltip.comic_text_detector.highlights':
    'Detecta texto em quadrinhos e mangá\nModelo original e confiável\nRoda rápido em qualquer computador',
  'model.tooltip.comic_text_detector.unique':
    'O detector clássico usado como base por muitos projetos de tradução de mangá',
  'model.tooltip.comic_text_detector.bestFor':
    'Detecção básica e confiável de texto em quadrinhos — boa escolha padrão',
  'model.tooltip.comic_text_detector.performance':
    'Rápido, roda bem sem placa de vídeo dedicada',
  'model.tooltip.comic_text_detector.notes':
    'Modelo clássico e testado pela comunidade ao longo dos anos',

  'model.tooltip.pp_doclayout_v3.highlights':
    'Analisa o layout de páginas escaneadas\nFunciona mesmo com páginas tortas ou curvas\nIdentifica a ordem correta de leitura',
  'model.tooltip.pp_doclayout_v3.unique':
    'Consegue entender páginas que foram fotografadas tortas ou escaneadas de forma irregular — algo que outros modelos não fazem',
  'model.tooltip.pp_doclayout_v3.bestFor':
    'Páginas escaneadas de forma imperfeita, fotos de livros ou layouts complexos com ordem de leitura difícil',
  'model.tooltip.pp_doclayout_v3.performance':
    'Robusto e confiável, funciona bem em diversas condições de iluminação',
  'model.tooltip.pp_doclayout_v3.notes':
    'Útil quando as páginas não estão perfeitamente digitalizadas',

  'model.tooltip.manga_ocr.highlights':
    'Lê texto japonês em mangá\nFunciona com texto vertical e horizontal\nO mais recomendado para mangá japonês',
  'model.tooltip.manga_ocr.unique':
    'Feito especialmente para os desafios do mangá: texto vertical, furigana, fontes estilizadas e imagens de baixa qualidade',
  'model.tooltip.manga_ocr.bestFor':
    'A escolha padrão para ler texto de mangá japonês — funciona bem direto, sem ajustes',
  'model.tooltip.manga_ocr.performance':
    'Popular e confiável, usado por muitos projetos de scanlation',
  'model.tooltip.manga_ocr.notes':
    'Melhor opção para mangá japonês. Se precisar de velocidade, considere o Meiki OCR.',

  'model.tooltip.meiki_ocr.highlights':
    'Leitor de texto japonês ultra-rápido\nDetecta cada caractere individualmente\nIdeal para texto horizontal',
  'model.tooltip.meiki_ocr.unique':
    'Muito mais rápido que outros leitores de texto japonês — perfeito quando velocidade é prioridade',
  'model.tooltip.meiki_ocr.bestFor':
    'Quando você precisa ler texto japonês horizontal rapidamente',
  'model.tooltip.meiki_ocr.performance':
    'Extremamente rápido, um dos mais velozes para japonês',
  'model.tooltip.meiki_ocr.notes':
    'Só funciona com texto horizontal — para texto vertical use o Manga OCR',

  'model.tooltip.paddleocr_vl_manga.highlights':
    'Leitor de texto otimizado para mangá\nFunciona com texto vertical e horizontal\nMuito mais preciso em mangá que o modelo base',
  'model.tooltip.paddleocr_vl_manga.unique':
    'Treinado especificamente com páginas de mangá — entende fontes estilizadas e balões de fala melhor que leitores genéricos',
  'model.tooltip.paddleocr_vl_manga.bestFor':
    'Ler texto de mangá com alta precisão, especialmente quando o texto está em fontes difíceis',
  'model.tooltip.paddleocr_vl_manga.performance':
    'Boa precisão em mangá; também funciona com outros idiomas',
  'model.tooltip.paddleocr_vl_manga.notes':
    'Versão especializada do PaddleOCR para mangá — excelente escolha para scanlation',

  'model.tooltip.got_ocr2.highlights':
    'Lê texto de documentos, tabelas e gráficos\nEntende fórmulas matemáticas e partituras\nVersátil para vários tipos de documento',
  'model.tooltip.got_ocr2.unique':
    'Vai além de texto simples — consegue ler tabelas, fórmulas e gráficos formatados',
  'model.tooltip.got_ocr2.bestFor':
    'Ler documentos complexos com tabelas e formatação — não é o ideal para mangá',
  'model.tooltip.got_ocr2.performance':
    'Leve e versátil, funciona bem para documentos em geral',
  'model.tooltip.got_ocr2.notes':
    'Multilíngue mas não otimizado para mangá — use outros modelos para quadrinhos',

  'model.tooltip.qwen2_5_vl_3b.highlights':
    'Entende imagens de forma inteligente\nVai além de ler texto — compreende o que está na imagem\nMultilíngue e versátil',
  'model.tooltip.qwen2_5_vl_3b.unique':
    'Não apenas lê texto — entende painéis de mangá, descreve cenas e extrai informações organizadas da imagem',
  'model.tooltip.qwen2_5_vl_3b.bestFor':
    'Quando você precisa que o modelo entenda o conteúdo da imagem, não apenas leia o texto',
  'model.tooltip.qwen2_5_vl_3b.performance':
    'Tamanho moderado; boa velocidade em placas de vídeo comuns',
  'model.tooltip.qwen2_5_vl_3b.notes':
    'Multilíngue. Útil para análise de painéis e compreensão visual avançada',

  'model.tooltip.mangalmm.highlights':
    'Entende painéis de mangá como um leitor humano\nIdentifica personagens e elementos da história\nVai além de apenas ler texto',
  'model.tooltip.mangalmm.unique':
    'O único modelo feito especificamente para entender mangá — reconhece personagens, painéis e narrativa visual',
  'model.tooltip.mangalmm.bestFor':
    'Análise avançada de mangá: entender quem está falando, o que está acontecendo nos painéis',
  'model.tooltip.mangalmm.performance':
    'Precisa de placa de vídeo potente com 14GB de memória; ainda em fase de pesquisa',
  'model.tooltip.mangalmm.notes':
    'Modelo experimental — promissor para o futuro da scanlation mas ainda não está maduro',

  'model.tooltip.rolmocr.highlights':
    'Leitor de texto rápido para documentos\nFunciona bem com layouts complexos\nSubstituto mais leve e veloz',
  'model.tooltip.rolmocr.unique':
    'Mais rápido e leve que modelos similares, mantendo boa qualidade na leitura de documentos',
  'model.tooltip.rolmocr.bestFor':
    'Ler documentos com layouts complexos quando velocidade é importante',
  'model.tooltip.rolmocr.performance':
    'Rápido e eficiente; bom equilíbrio entre velocidade e qualidade',
  'model.tooltip.rolmocr.notes':
    'Não específico para mangá — melhor para documentos e textos gerais',

  'model.tooltip.glm_ocr_onnx.highlights':
    'Leitor de texto compacto e preciso\nUm dos mais precisos em benchmarks\nRoda bem em computadores mais fracos',
  'model.tooltip.glm_ocr_onnx.unique':
    'Combina alta precisão com tamanho pequeno — um dos mais precisos mesmo sendo leve',
  'model.tooltip.glm_ocr_onnx.bestFor':
    'Ler documentos com alta precisão sem precisar de computador potente',
  'model.tooltip.glm_ocr_onnx.performance':
    'Muito leve e rápido; roda bem mesmo em computadores sem placa de vídeo forte',
  'model.tooltip.glm_ocr_onnx.notes':
    'Suporta vários idiomas mas japonês é limitado. Ótimo para documentos em geral.',

  'model.tooltip.paddleocr.highlights':
    'Lê texto em russo\nRápido e confiável\nBoa opção para manhwa russo',
  'model.tooltip.paddleocr.unique':
    'Otimizado especificamente para o alfabeto cirílico — melhor que leitores genéricos para russo',
  'model.tooltip.paddleocr.bestFor': 'Ler texto russo em quadrinhos e mangá',
  'model.tooltip.paddleocr.performance':
    'Muito rápido, roda bem na maioria dos computadores',
  'model.tooltip.paddleocr.notes': 'A melhor escolha para texto russo',

  'model.tooltip.paddleocr_latin_v5.highlights':
    'Lê texto em idiomas europeus\nFrancês, alemão, espanhol, português e mais\nRápido e confiável',
  'model.tooltip.paddleocr_latin_v5.unique':
    'Otimizado para alfabetos europeus — funciona melhor que leitores genéricos nesses idiomas',
  'model.tooltip.paddleocr_latin_v5.bestFor':
    'Ler texto em idiomas europeus como francês, alemão, espanhol, italiano e português',
  'model.tooltip.paddleocr_latin_v5.performance':
    'Rápido e leve, roda bem em qualquer computador',
  'model.tooltip.paddleocr_latin_v5.notes':
    'Melhor opção para idiomas europeus com alfabeto latino',

  'model.tooltip.paddleocr_ch_v5.highlights':
    'Lê texto em chinês simplificado e tradicional\nRápido e preciso\nIdeal para manhua',
  'model.tooltip.paddleocr_ch_v5.unique':
    'Otimizado especificamente para caracteres chineses — reconhece melhor os traços complexos e fontes variadas',
  'model.tooltip.paddleocr_ch_v5.bestFor':
    'Ler texto de manhua e qualquer conteúdo em chinês com alta precisão',
  'model.tooltip.paddleocr_ch_v5.performance':
    'Rápido e leve, roda bem na maioria dos computadores',
  'model.tooltip.paddleocr_ch_v5.notes':
    'A melhor escolha para chinês. Simples e eficiente.',

  'model.tooltip.paddleocr_en_v5.highlights':
    'Lê texto em inglês\nRápido e preciso\nIdeal para quadrinhos ocidentais',
  'model.tooltip.paddleocr_en_v5.unique':
    'Otimizado especificamente para inglês — reconhece melhor fontes e estilos variados',
  'model.tooltip.paddleocr_en_v5.bestFor':
    'Ler texto em inglês de quadrinhos ocidentais e mangá traduzido',
  'model.tooltip.paddleocr_en_v5.performance':
    'Muito rápido e leve, roda em qualquer computador',
  'model.tooltip.paddleocr_en_v5.notes':
    'A melhor escolha para texto em inglês',

  'model.tooltip.easyocr.highlights':
    'Lê texto em mais de 80 idiomas\nFácil de usar e versátil\nVários idiomas na mesma imagem',
  'model.tooltip.easyocr.unique':
    'Um dos mais versáteis — consegue ler muitos idiomas diferentes na mesma imagem',
  'model.tooltip.easyocr.bestFor':
    'Quando você precisa de um leitor que funcione para muitos idiomas sem trocar de modelo',
  'model.tooltip.easyocr.performance':
    'Bom para texto limpo; tem dificuldade com fontes estilizadas e texto vertical',
  'model.tooltip.easyocr.notes':
    'Não otimizado para mangá. Útil como opção geral multilíngue.',

  'model.tooltip.pororo.highlights':
    'Lê texto coreano\nIdeal para manhwa coreano\nLeve e confiável',
  'model.tooltip.pororo.unique':
    'Feito especificamente para o alfabeto coreano (Hangul) — reconhece melhor que leitores genéricos',
  'model.tooltip.pororo.bestFor':
    'Ler texto de manhwa coreano — a melhor opção dedicada para coreano',
  'model.tooltip.pororo.performance':
    'Boa precisão para coreano; leve e rápido',
  'model.tooltip.pororo.notes':
    'Coreano e inglês apenas. Mantido pela comunidade.',

  'model.tooltip.paddleocr_vl_1_5.highlights':
    'Leitor de texto avançado multilíngue\nUm dos mais precisos do mundo\nFunciona com japonês, chinês, inglês e mais',
  'model.tooltip.paddleocr_vl_1_5.unique':
    'Consegue detectar texto em formatos irregulares e poligonais — lê texto curvo, inclinado e em posições difíceis',
  'model.tooltip.paddleocr_vl_1_5.bestFor':
    'Leitura de texto avançada para documentos e quadrinhos em vários idiomas',
  'model.tooltip.paddleocr_vl_1_5.performance':
    'Preciso e versátil; roda bem em placas de vídeo comuns',
  'model.tooltip.paddleocr_vl_1_5.notes':
    'Multilíngue incluindo japonês, chinês, inglês. Base para o fine-tune de mangá.',

  'model.tooltip.aot.highlights':
    'Remove texto japonês de mangá\nReconstrói a arte de fundo automaticamente\nRápido e eficiente',
  'model.tooltip.aot.unique':
    'Feito especialmente para remover texto de mangá — entende o estilo artístico e reconstrói o fundo de forma natural',
  'model.tooltip.aot.bestFor':
    'Remover texto japonês de painéis de mangá reconstruindo a arte de fundo',
  'model.tooltip.aot.performance':
    'Rápido, funciona bem com ou sem placa de vídeo',
  'model.tooltip.aot.notes': 'Boa opção padrão para limpeza de texto em mangá',

  'model.tooltip.lama_manga.highlights':
    'Remove texto de mangá e anime\nFunciona com imagens de qualquer tamanho\nLida bem com áreas grandes de texto',
  'model.tooltip.lama_manga.unique':
    'Não tem limite de tamanho de imagem — funciona com páginas de qualquer resolução, ao contrário de outros modelos',
  'model.tooltip.lama_manga.bestFor':
    'Remover texto de páginas de mangá de qualquer tamanho, especialmente blocos grandes de texto e balões',
  'model.tooltip.lama_manga.performance':
    'Aceita qualquer tamanho de imagem; velocidade boa na maioria dos computadores',
  'model.tooltip.lama_manga.notes':
    'Versão melhorada do LaMa — use quando a página for grande ou tiver muito texto para remover',

  'model.tooltip.opencv_lama.highlights':
    'Remove texto de imagens\nVersão leve e simples\nBoa para uso geral',
  'model.tooltip.opencv_lama.unique':
    'Versão oficial e mantida pelo OpenCV — integração direta e confiável',
  'model.tooltip.opencv_lama.bestFor':
    'Remoção de texto básica e rápida quando você não precisa da máxima qualidade',
  'model.tooltip.opencv_lama.performance':
    'Leve e rápido, roda em qualquer computador',
  'model.tooltip.opencv_lama.notes':
    'Boa opção leve para limpeza simples de texto',

  'model.tooltip.lama_fp32.highlights':
    'Remove texto de imagens com alta qualidade\nMelhor qualidade entre os removedores\nIdeal quando qualidade importa mais que velocidade',
  'model.tooltip.lama_fp32.unique':
    'A versão mais fiel e precisa do LaMa — reproduz o fundo de forma mais natural que as versões leves',
  'model.tooltip.lama_fp32.bestFor':
    'Quando a qualidade da limpeza é mais importante que a velocidade',
  'model.tooltip.lama_fp32.performance':
    'Mais lento que as versões leves; precisa de mais memória',
  'model.tooltip.lama_fp32.notes':
    'Use quando qualidade for prioridade. Tamanho fixo de entrada.',

  'model.tooltip.waifu2x_swin_unet_art_scan_2x.highlights':
    'Melhora scans de anime em 2x\nRemove ruído e melhora qualidade\nIdeal para scans de mangá',
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.unique':
    'O clássico para melhorar scans de anime e mangá — remove ruído e melhora a imagem ao mesmo tempo',
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.bestFor':
    'Melhorar scans de mangá de baixa resolução e remover artefatos de compressão JPEG',
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.performance':
    'Leve e rápido, roda em qualquer computador',
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.notes':
    'Boa opção padrão para melhorar scans de mangá em 2x',

  'model.tooltip.waifu2x_swin_unet_art_scan_4x.highlights':
    'Melhora scans de anime em 4x\nRemove ruído e melhora qualidade\nPara quando precisa de mais detalhe',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.unique':
    'Versão 4x do clássico Waifu2x — melhora muito mais a resolução mantendo linhas limpas',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.bestFor':
    'Melhorar scans de mangá com aumento maior de resolução e preservar line art limpo',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.performance':
    'Mais lento que a versão 2x; leve mesmo assim',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.notes':
    'Use quando precisar de mais resolução que o 2x oferece',

  'model.tooltip.waifu2x_swin_unet_art_2x.highlights':
    'Melhora arte de anime em 2x\nPara arte já limpa e de boa qualidade\nPreserva detalhes finos',
  'model.tooltip.waifu2x_swin_unet_art_2x.unique':
    'Otimizado para arte que já está limpa — preserva detalhes finos sem adicionar ruído',
  'model.tooltip.waifu2x_swin_unet_art_2x.bestFor':
    'Melhorar arte digital limpa e mangá que já tem boa qualidade de origem',
  'model.tooltip.waifu2x_swin_unet_art_2x.performance':
    'Leve e rápido, roda em qualquer computador',
  'model.tooltip.waifu2x_swin_unet_art_2x.notes':
    'Menos agressivo que a versão para scans — use quando a imagem já estiver limpa',

  'model.tooltip.4xnomos2_hq_mosr.highlights':
    'Amplia imagens em 4x com qualidade máxima\nPreserva detalhes finos e linhas nítidas\nIdeal para scans já limpos',
  'model.tooltip.4xnomos2_hq_mosr.unique':
    'Focado em qualidade — mantém cada detalhe da imagem original intacto',
  'model.tooltip.4xnomos2_hq_mosr.bestFor':
    'Melhorar scans de mangá que já estão limpos e com boa qualidade',
  'model.tooltip.4xnomos2_hq_mosr.performance':
    'Boa velocidade; arquivo pequeno de apenas 16MB',
  'model.tooltip.4xnomos2_hq_mosr.notes':
    'Funciona melhor com imagens já limpas. Se a imagem tiver ruído ou compressão, limpe antes.',

  'model.tooltip.4xspankendata.highlights':
    'Amplia imagens em 4x de forma muito rápida\nArquivo minúsculo de apenas 1,6MB\nRoda bem mesmo em computadores mais fracos',
  'model.tooltip.4xspankendata.unique':
    'Extremamente leve — perfeito quando você precisa de velocidade sem ocupar espaço',
  'model.tooltip.4xspankendata.bestFor':
    'Upscale rápido de qualquer tipo de imagem quando tempo é importante',
  'model.tooltip.4xspankendata.performance':
    'Muito rápido; arquivo de apenas 1,6MB — ideal para CPU',
  'model.tooltip.4xspankendata.notes':
    'Surpreendentemente pequeno para a qualidade que entrega. Ótima opção para processamento em lote.',

  'model.tooltip.2x_hfa2kcompact.highlights':
    'Amplia imagens em 2x com bom equilíbrio\nTreinado em frames de anime moderno\nLida bem com compressão e borrões',
  'model.tooltip.2x_hfa2kcompact.unique':
    'Especialista em anime — entende o estilo visual de animações modernas',
  'model.tooltip.2x_hfa2kcompact.bestFor':
    'Páginas de mangá/anime com artefatos de compressão ou qualidade irregular',
  'model.tooltip.2x_hfa2kcompact.performance':
    'Rápido e leve; arquivo de apenas 4,6MB',
  'model.tooltip.2x_hfa2kcompact.notes':
    'Robusto para imagens do mundo real — funciona bem mesmo com scans imperfeitos.',

  'model.tooltip.2x_digitalfilm_superultracompact.highlights':
    'Amplia imagens em 2x com tamanho mínimo\nIdeal quando espaço em disco é limitado\nBoa qualidade para o tamanho',
  'model.tooltip.2x_digitalfilm_superultracompact.unique':
    'Ultra-compacto — cabe em qualquer lugar sem sacrificar qualidade',
  'model.tooltip.2x_digitalfilm_superultracompact.bestFor':
    'Upscale leve quando você precisa economizar espaço ou memória',
  'model.tooltip.2x_digitalfilm_superultracompact.performance':
    'Rápido; ~20MB; pode precisar de conversão manual',
  'model.tooltip.2x_digitalfilm_superultracompact.notes':
    'Se o arquivo não carregar, pode ser necessário converter o formato externamente.',

  'model.tooltip.2x_anifilm_compact.highlights':
    'Amplia imagens em 2x otimizado para anime\nBom equilíbrio entre qualidade e tamanho\nEstilo visual preservado',
  'model.tooltip.2x_anifilm_compact.unique':
    'Entende o estilo visual de anime e filmes animados — mantém a estética original',
  'model.tooltip.2x_anifilm_compact.bestFor':
    'Conteúdo anime onde você quer manter o visual original sem exageros',
  'model.tooltip.2x_anifilm_compact.performance':
    'Rápido; ~20MB; pode precisar de conversão manual',
  'model.tooltip.2x_anifilm_compact.notes':
    'Se o arquivo não carregar, pode ser necessário converter o formato externamente.',

  'model.tooltip.2xnomosuni_span_multijpg_ldl.highlights':
    'Amplia imagens em 2x com resistência a compressão\nTreinado para lidar com diferentes níveis de qualidade JPG\nRobusto para scans imperfeitos',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.unique':
    'Especialista em lidar com compressão JPG — funciona bem mesmo com scans de baixa qualidade',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.bestFor':
    'Scans de mangá com compressão JPG variada ou artefatos de qualidade',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.performance':
    'Rápido; ~20MB; pode precisar de conversão manual',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.notes':
    'Se o arquivo não carregar, pode ser necessário converter o formato externamente.',

  'model.tooltip.realesrgan_x4plus.highlights':
    'Amplia imagens em 4x com alta versatilidade\nLida bem com JPEG, borrões e ruído\nFunciona com qualquer tipo de conteúdo',
  'model.tooltip.realesrgan_x4plus.unique':
    'O mais versátil — entende e corrige diversos tipos de degradação de imagem',
  'model.tooltip.realesrgan_x4plus.bestFor':
    'Páginas de mangá com conteúdo misto; artefatos JPEG; o upscaler mais versátil',
  'model.tooltip.realesrgan_x4plus.performance':
    'Boa velocidade; um pouco mais pesado que os compactos',
  'model.tooltip.realesrgan_x4plus.notes':
    'Para anime/mangá puro, prefira a versão anime (6B) que é mais rápida e otimizada.',

  'model.tooltip.4xhfa2kludvaeswinir_light.highlights':
    'Amplia imagens em 4x otimizado para anime\nBom equilíbrio entre qualidade e performance\nPreserva o estilo visual de anime',
  'model.tooltip.4xhfa2kludvaeswinir_light.unique':
    'Combina qualidade de upscale com atenção aos detalhes visuais do anime',
  'model.tooltip.4xhfa2kludvaeswinir_light.bestFor':
    'Upscale 4x de conteúdo anime com boa qualidade de origem',
  'model.tooltip.4xhfa2kludvaeswinir_light.performance':
    'Velocidade moderada; ~70MB; pode precisar de conversão manual',
  'model.tooltip.4xhfa2kludvaeswinir_light.notes':
    'Se o arquivo não carregar, pode ser necessário converter o formato externamente.',

  'model.tooltip.baka_content_cc.highlights':
    'Separa texto de balões em páginas de quadrinhos\nIdentifica o que é texto e o que é balão\nRápido e eficiente',
  'model.tooltip.baka_content_cc.unique':
    'Integrado com o sistema de detecção de texto e balões — trabalha em conjunto com outros modelos',
  'model.tooltip.baka_content_cc.bestFor':
    'Separar texto e balões em páginas de mangá para processamento posterior',
  'model.tooltip.baka_content_cc.performance':
    'Rápido e leve, não precisa de placa de vídeo potente',
  'model.tooltip.baka_content_cc.notes':
    'Usado como parte do pipeline de segmentação',
  'settings.tooltips.title': 'Dicas de Ferramentas',
  'settings.tooltips.description':
    'Controle quando dicas contextuais aparecem durante o uso do dashboard.',
  'settings.tooltips.enableTitle': 'Mostrar dicas contextuais',
  'settings.tooltips.enableDesc':
    'Exibe dicas animadas na primeira vez que você usa cada ferramenta por sessão.',
  'dashboard.hint.healing.ariaLabel': 'Dica da ferramenta Healing',
  'dashboard.hint.healing.eyebrow': 'Nova ferramenta',
  'dashboard.hint.healing.body':
    'Use o Healing Brush para remover defeitos, bordas quebradas e restos de texto. Pinte sobre a área que deseja corrigir e clique em Aplicar para a IA reconstruir a região de forma imperceptível.',
  'dashboard.hint.healing.footer':
    'Esta dica não aparecerá novamente nesta sessão. Desative todas as dicas em Configurações → App.',
  'dashboard.aio.presets.tooltip':
    'As predefinições salvam uma combinação por idioma de modelos e etapas. Use‑as para trocar sua configuração do AIO mais rapidamente ao mudar o idioma de origem ou o fluxo de trabalho.',
  'dashboard.aio.presets.tooltipAria':
    'Para que servem as predefinições de idioma',
  'dashboard.aio.cleanImage.tooltip':
    'Clean Image é a etapa de limpeza e pintura interna. Remove texto e artefatos selecionados antes da passagem final de renderização/edição.',
  'dashboard.aio.cleanImage.tooltipAria': 'Para que serve o Clean Image',
  'dashboard.aio.clean.maskDilation.tooltip':
    'Expande a máscara de limpeza antes da pintura interna. Aumente se as bordas do texto permanecerem; mantenha menor para preservar o artwork próximo.',
  'dashboard.aio.clean.maskDilation.tooltipAria':
    'Para que serve a dilatação da máscara',
  'dashboard.dashboardLlm.hdStrategy.tooltip':
    'Define como imagens grandes são preparadas antes da limpeza. Resize dimensiona a página, Crop divide‑a em blocos e Original envia‑as como estão.',
  'dashboard.dashboardLlm.hdStrategy.tooltipAria':
    'Para que serve a estratégia HD',
  'dashboard.dashboardLlm.cropMargin.tooltip':
    'Adiciona preenchimento extra ao redor de cada bloco de recorte. Aumente se as bordas perderem contexto ou apresentarem costuras após a limpeza.',
  'dashboard.dashboardLlm.cropMargin.tooltipAria':
    'Para que serve a margem de recorte',
  'dashboard.dashboardLlm.cropTriggerSize.tooltip':
    'Tamanho mínimo da imagem que ativa a divisão em blocos. Imagens menores permanecem como uma única peça; as maiores são divididas em blocos.',
  'dashboard.dashboardLlm.cropTriggerSize.tooltipAria':
    'Para que serve o tamanho de disparo do recorte',
  'common.basicInfo': "Informações básicas",
  'common.resolve': "Resolver",
  'common.dismiss': "Dispensar",
  'common.title': "Título",
  'common.summary': "Resumo",
  'common.summaryPlaceholder': "Escreva um resumo curto e claro.",
  'common.mainDescription': "Descrição principal",
  'common.chapter': "Capítulo",
  'common.genres': "Gêneros",
  'common.editorialDescription': "Descrição editorial",
  'common.removeValue': "Remover {value}",
  'settings.integrations.discordWebhook': "Webhook do Discord",
  'discord.presence.appName': "KŌMA Studio",
  'discord.presence.button.website': "Site",
  'discord.presence.button.download': "Download",
  'discord.presence.idle.details': "Explorando ferramentas de scanlation",
  'discord.presence.idle.state': "Idle",
  'discord.presence.workspace.details': "Organizando páginas e preparando o fluxo",
  'discord.presence.aio.details': "Executando o pipeline completo do mangá",
  'discord.presence.mode.automatic': "Modo Automático",
  'discord.presence.mode.manual': "Modo Manual",
  'discord.presence.mode.basic': "Modo: Básico",
  'discord.presence.mode.advanced': "Modo: Avançado",
  'discord.presence.cleaner.details': "Limpando balões e restaurando a arte",
  'discord.presence.cleaner.state.basic': "Modo: Básico",
  'discord.presence.cleaner.state.advanced': "Modo: Avançado",
  'discord.presence.translator.details': "Traduzindo falas sem perder o tom",
  'discord.presence.translator.fileDetails': "Traduzindo - {fileName}",
  'discord.presence.typesetter.details': "Reposicionando o texto final na página",
  'discord.presence.typesetter.fileDetails': "Editando texto - {fileName}",
  'discord.presence.redraw.fileDetails': "Redesenhando - {fileName}",
  'discord.presence.raw.details': "Testando providers e comparando gerações brutas",
  'discord.presence.proofreader.details': "Revisando páginas antes da versão final",
  'discord.presence.stitch.details': "Unindo painéis em páginas longas contínuas",
  'discord.presence.split.details': "Separando spreads em cortes limpos de página",
  'discord.presence.watermark.details': "Aplicando créditos e identidade nas páginas",
  'discord.presence.enhance.details': "Ampliando páginas e refinando a arte",
  'discord.presence.optimizer.details': "Polindo capítulos para exportação e entrega",
  'discord.presence.blogger.details': "Preparando posts de capítulos e entrega via CDN",
  'discord.presence.imgur.details': "Enviando conjuntos de imagens e compartilhando links",
  'discord.presence.guides.details': "Aprendendo fluxos, atalhos e boas práticas",
  'discord.presence.resources.details': "Explorando assets, referências e material de apoio",
  'discord.presence.batch.details': "Processando páginas em sequência",
  'discord.presence.batch.fileDetails': "Processando lote - {fileName}",
  'discord.presence.batch.state': "{current}/{total} arquivos",
  'discord.presence.batch.label': "Modo em Lote",
  'discord.presence.section.working': "Trabalhando em {section}",
  'discord.presence.section.viewing': "Visualizando {section}",
  'discord.presence.settings.details': "Ajustando as preferências do estúdio",
  'discord.presence.settings.label': "Configurações",
  'discord.presence.rankings.details': "Comparando qualidade, velocidade e custo dos modelos",
  'discord.presence.rankings.label': "Rankings",
  'discord.presence.scanlationFeed.details': "Acompanhando lançamentos e novidades da comunidade",
  'discord.presence.scanlationFeed.label': "Feed de Scanlation",
  'discord.presence.loginRegister.details': "Entrando e gerenciando o acesso da conta",
  'discord.presence.loginRegister.label': "Login / Cadastro",
  'typographer.shapeApplied': "Forma aplicada.",
  'feed.tabsAria': "Seções do Scanlation Feed",
  'feed.actions.publishPost': "Publicar {type}",
  // — keys added during the monorepo consolidation phase —
  'aioPreset.autoDescription': 'Preset gerado automaticamente',
  'common.automatic': 'Automático',
  'common.close': 'Fechar',
  'common.collapse': 'Recolher',
  'common.delete': 'Excluir',
  'common.duplicate': 'Duplicar',
  'common.edit': 'Editar',
  'common.expand': 'Expandir',
  'common.manual': 'Manual',
  'dashboard.topbar.close': 'Fechar menu',
  'dashboard.translator.noTranslation': 'Sem tradução disponível',
  'dashboard.translator.processing.loading': 'Traduzindo…',
  'detectionPreview.noNt': 'Sem NT',
  'detectionPreview.noTextRecognized': 'Nenhum texto reconhecido',
  'detectionPreview.noTranslation': 'Sem tradução disponível',
  'guides.step.checkAria': 'Verificar {{label}}',
  'modelManager.enhance.importOnnx': 'Importar ONNX',
  'modelManager.error.modelNotFound': 'Modelo não encontrado',
  'renderFontCatalog.loadFailed': 'Falha ao carregar fontes de renderização',
  'settings.typographerLibrary.emptyFolder': 'Nenhum preset nesta pasta ainda',
  'settings.typographerLibrary.noParent': 'Sem pasta pai',
  'settings.typographerLibrary.parentFolder': 'Pasta pai',
  'translatorRetranslate.regionRetranslated': 'Região retraduzida',
  'watermark.autoSuggestionHint': 'Sugerido automaticamente pelo nome do arquivo',
  "watermark.presets.defaultName": "Preset de marca d'água",
  "watermark.status.appliedCount": "Marca d'água aplicada em {{count}} região(ões)",
  "watermark.status.configureLayer": "Configure a camada de marca d'água para continuar",
  'watermark.status.noResults': 'Nenhuma região correspondeu aos filtros atuais',

} as const;
