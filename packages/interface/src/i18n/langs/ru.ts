import { TranslationCatalog } from '../messages';

export const ruMessages: TranslationCatalog = {
  'app.restricted.title': 'Ограниченный доступ',
  'app.restricted.description':
    'Эта версия доступна только в официальном настольном приложении.',
  'app.restricted.publicDocs': 'Юридические документы остаются общедоступными:',
  'app.transition.loading': 'Загрузка...',
  'app.transition.enterDashboard': 'Вход в панель управления...',
  'app.transition.updateSession': 'Обновление сессии...',
  'app.transition.openFeed': 'Открытие ленты сканлейта...',
  'app.transition.openRankings': 'Открытие рейтингов моделей...',
  'app.transition.openSettings': 'Открытие настроек...',
  'app.session.validating': 'Проверка сессии...',
  'settings.tabs.general': 'Общие',
  'settings.tabs.presets': 'Пресеты',
  'settings.tabs.integrations': 'Интеграции',
  'shortcutModal.title': 'Центр горячих клавиш',
  'shortcutModal.subtitle':
    'Глобальные горячие клавиши срабатывают только на панели управления, но не в текстовых полях.',
  'shortcutModal.hotkeyHint': 'H для открытия',
  'shortcutModal.close': 'Закрыть',
  'shortcutModal.instructionPrefix': 'Нажмите ',
  'shortcutModal.instructionRecord': 'Записать',
  'shortcutModal.instructionSuffix':
    ', затем нажмите нужную комбинацию клавиш. Конфликты определяются автоматически.',
  'shortcutModal.searchPlaceholder':
    'Поиск горячих клавиш, действий или кнопок...',
  'shortcutModal.results_one': '{count} результат',
  'shortcutModal.results_other': '{count} результатов',
  'shortcutModal.recording': 'Запись…',
  'shortcutModal.record': 'Записать',
  'shortcutModal.restoreDefault': 'Восстановить по умолчанию',
  'shortcutModal.clearShortcut': 'Очистить горячую клавишу',
  'shortcutModal.conflict': 'Конфликт: «{label}» ({combo})',
  'shortcutModal.fixedShortcuts': 'Фиксированные контекстные горячие клавиши',
  'shortcutModal.fixed': 'Фиксированная',
  'shortcutModal.noResults': 'Горячие клавиши по запросу «{query}» не найдены.',
  'shortcutModal.restoreAll': 'Восстановить все',
  'toolbar.modelSelect.label': 'Модель перевода',
  'toolbar.modelSelect.manage': 'Управление моделями',
  'toolbar.modelSelect.select': 'Выберите модель',
  'toolbar.modelSelect.groupLocal': '── Локальные модели (установлены) ──',
  'toolbar.modelSelect.groupCloud': '── Облако/API/ИИ ──',
  'toolbar.modelSelect.localPrefix': '[Локальная]',
  'toolbar.modelSelect.cloudPrefix': '[Облако]',
  'toolbar.modelSelect.updateAvailable': '(Доступно обновление)',
  'toolbar.modelSelect.installedCount_one': '{count} модель установлена',
  'toolbar.modelSelect.installedCount_other': '{count} моделей установлено',
  'toolbar.modelSelect.updates_one': '{count} ожидающее обновление',
  'toolbar.modelSelect.updates_other': '{count} ожидающих обновлений',
  'toolbar.modelSelect.noUpdates': 'Нет ожидающих обновлений',
  'toolbar.modelSelect.emptyState':
    'Нет моделей, совместимых с {source} → {target}.',
  'toolbar.modelSelect.incompatibleWarning':
    '«{model}» не поддерживает {source} → {target}. Выберите совместимую модель или измените целевой язык.',
  'settings.tabs.app': 'Приложение',
  'settings.backToDashboard': 'Вернуться на панель управления',
  'settings.stats.version': 'версия',
  'settings.app.updater.status.idle': 'Ожидание',
  'settings.app.updater.status.checking': 'Проверка…',
  'settings.app.updater.status.available': 'Доступно обновление',
  'settings.app.updater.status.notAvailable': 'Актуальная версия',
  'settings.app.updater.status.downloading': 'Скачивание…',
  'settings.app.updater.status.downloaded': 'Готово к установке',
  'settings.app.updater.status.error': 'Ошибка',
  'settings.app.updater.channel.stable': 'Стабильный (Рекомендуется)',
  'settings.app.updater.channel.beta': 'Бета (Ранние функции)',
  'settings.app.updater.channel.canary': 'Canary (Нестабильный)',
  'settings.app.updater.version': 'Версия',
  'settings.app.updater.build': 'Сборка',
  'settings.app.updater.releaseNotes': 'Примечания к выпуску',
  'settings.app.updater.noNotes': 'Нет примечаний для этой версии.',
  'settings.app.updater.checkNow': 'Проверить обновления',
  'settings.app.updater.installNow': 'Перезапусти��ь и обновить',
  'settings.app.updater.desktopOnly':
    'Доступно только в настольном приложении.',
  'settings.app.updater.autoCheck': 'Автопроверка',
  'settings.app.updater.autoCheckDesc':
    'Проверять наличие новых версий при запуске.',
  'settings.app.updater.channel': 'Канал обновлений',
  'settings.app.updater.channelDesc':
    'Стабильные или экспериментальные выпуски.',
  'settings.app.fonts.title': 'Системные шрифты',
  'settings.app.fonts.desc':
    'Управление шрифтами для набора текста и рендеринга.',
  'settings.app.fonts.systemCount': 'Обнаружено шрифтов: {count}',
  'settings.app.fonts.customTitle': 'Пользовательские шрифты',
  'settings.app.fonts.import': 'Импорт .ttf / .otf',
  'settings.app.fonts.noCustom': 'Пользовательские шрифты не импортированы.',
  'settings.app.fonts.importSuccess': 'Шрифт {name} успешно импортирован.',
  'settings.app.fonts.importError': 'Не удалось импортировать шрифт.',
  'settings.app.fonts.deleteConfirm': 'Вы хотите удалить шрифт {name}?',
  'settings.app.autosave.title': 'Автосохране��ие рабочей области',
  'settings.app.autosave.desc':
    'Автоматическое сохранение прогресса проекта локально.',
  'settings.app.autosave.enabled': 'Автосохранение включено',
  'settings.app.autosave.interval': 'Интервал (минуты)',
  'settings.app.autosave.saveNow': 'Сохранить настройки',
  'settings.app.autosave.success': 'Настройки автосохранения обновлены.',
  'settings.app.autosave.error': 'Не удалось сохранить настройки.',
  'settings.app.reset.title': 'Опасная зона',
  'settings.app.reset.desc':
    'Очистить локальные данные и восстановить настройки по умолчанию.',
  'settings.app.reset.button': 'Сбросить приложение',
  'settings.app.reset.confirm':
    'Вы будете разлогинены, все локальные пресеты и кеш будут удалены. Продолжить?',
  'settings.app.reset.success': 'Приложение сброшено. Перезапуск...',
  'settings.general.profile.title': 'Профиль',
  'settings.general.profile.desc':
    'Информация об аккаунте и глобальные настройки.',
  'settings.general.profile.name': 'Отображаемое имя',
  'settings.general.profile.email': 'Основная почта',
  'settings.general.profile.verified': 'Почта подтверждена',
  'settings.general.profile.unverified': 'Почта не подтверждена',
  'settings.general.profile.verifyBtn': 'Подтвердить сейчас',
  'settings.general.profile.sending': 'Отправка...',
  'settings.general.profile.verifySuccess':
    'Письмо для подтверждения отправлено.',
  'settings.general.profile.verifyError': 'Не удалось отправить письмо.',
  'settings.general.profile.save': 'Сохранить профиль',
  'settings.general.profile.success': 'Профиль успешно обновлён.',
  'settings.general.profile.error': 'Не удалось обновить профиль.',
  'settings.general.travel.title': 'Токен доступа',
  'settings.general.travel.desc':
    'Получите доступ к аккаунту Studio на других устройствах без выхода из аккаунта.',
  'settings.general.travel.active': 'Активный токен',
  'settings.general.travel.inactive': 'Нет активного токена',
  'settings.general.travel.generate': 'Сгенерировать новый токен',
  'settings.general.travel.generateDesc': 'Действителен {days} дней.',
  'settings.general.travel.copyAria': 'Скопировать токен',
  'settings.general.travel.revoke': 'Отозвать все',
  'settings.general.travel.revoked': 'Токены отозваны.',
  'settings.general.travel.success': 'Токен успешно сгенерирован.',
  'settings.general.travel.error': 'Не удалось обработать токен.',
  'settings.general.language.title': 'Интерфейс',
  'settings.general.language.desc': 'Язык приложения и тема.',
  'settings.general.language.label': 'Язык',
  'settings.general.language.system': 'Как в системе',
  'settings.general.theme.label': 'Тема',
  'settings.general.theme.dark': 'Тёмная (По умолчанию)',
  'settings.general.theme.light': 'Светлая',
  'settings.general.theme.amoled': 'OLED / Чёрная',
  'settings.presets.aio.title': 'Пресеты AIO',
  'settings.presets.aio.desc':
    'Настройте модели по умолчанию для каждого этапа и языка.',
  'settings.presets.aio.active': 'Активный пресет для {lang}',
  'settings.presets.aio.none': 'Пресеты не настроены.',
  'settings.presets.aio.create': 'Новый пресет',
  'settings.presets.aio.edit': 'Редактировать пресет',
  'settings.presets.aio.delete': 'Удалить пресет',
  'settings.presets.aio.name': 'Имя пресета',
  'settings.presets.aio.lang': 'Язык оригинала',
  'settings.presets.aio.models': 'Конфигурация моделей',
  'settings.presets.aio.save': 'Сохранить пресет',
  'settings.presets.aio.success': 'Пресет успешно сохранён.',
  'settings.presets.aio.error': 'Не удалось сохранить пресет.',
  'settings.presets.typo.title': 'Пресеты типографики',
  'settings.presets.typo.desc':
    'Предустановленные стили шрифтов, цвета и баллоны.',
  'settings.presets.render.title': 'Стили рендеринга',
  'settings.presets.render.desc':
    'Настройте, как текст отображается на финальном изображении.',
  'settings.integrations.discord.title': 'Вебхук Discord',
  'settings.integrations.discord.desc':
    'Автоматические уведомления для вашего сервера.',
  'settings.integrations.discord.url': 'URL вебхука',
  'settings.integrations.discord.test': 'Проверить соединение',
  'settings.integrations.discord.events': 'Триггерные события',
  'settings.integrations.discord.success':
    'Конфигурация сохранена, тест отправлен.',
  'settings.integrations.discord.error':
    'Не удалось сохранить или протестировать вебхук.',
  'settings.integrations.discord.invalidUrl': 'Недействительный URL вебхука.',
  'settings.integrations.blogger.successSecure':
    'Конфигурация Blogger сохранена в защищённом хранилище.',
  'settings.integrations.blogger.successLocal':
    'Конфигураци�� Blogger сохранена локально.',
  'settings.integrations.blogger.saveError':
    'Не удалось сохранить конфигурацию Blogger.',
  'settings.integrations.blogger.testError':
    'Не удалось проверить подключение к Blogger.',
  'settings.integrations.imgur.successSecure':
    'Конфигурация Imgur сохранена в защищённом хранилище.',
  'settings.integrations.imgur.successLocal':
    'Конфигурация Imgur сохранена локально.',
  'settings.integrations.imgur.saveError':
    'Не удалось сохранить конфигурацию Imgur.',
  'settings.travel.blocked.notDesktop':
    'Доступно только в авторизованном настольном приложении.',
  'settings.travel.blocked.noEmail':
    'Отправка писем не настроена в этом окружении.',
  'settings.travel.blocked.validating': 'Проверка конфигурации почты…',
  'settings.integrations.blogger.title': 'Blogger CDN',
  'settings.integrations.blogger.desc':
    'Хостинг изображений и прямая публикация.',
  'settings.integrations.imgur.desc':
    'Ротация Client ID для анонимной загрузки.',
  'settings.theme.title': 'Внешний вид',
  'settings.theme.description': 'Выберите тёмную или светлую т��му интерфейса.',
  'settings.theme.dark': 'Тёмная',
  'settings.theme.darkDesc': 'Тёмный интерфейс по умолчанию',
  'settings.theme.light': 'Светлая',
  'settings.theme.lightDesc': 'Светлый интерфейс',
  'settings.language.title': 'Язык интерфейса',
  'settings.language.description':
    'Выберите язык приложения. На настольной версии начальное определение использует системные языковые настройки.',
  'settings.language.label': 'Язык',
  'settings.language.systemLabel': 'Определён системой',
  'settings.language.applied':
    'Изменения применяются немедленно и сохраняются на этом устройстве для dev- и packaged-сборок.',
  'auth.tabs.login': 'Вход',
  'auth.tabs.register': 'Регистрация',
  'auth.legal.reviewDocs':
    'Продолжая, ознакомьтесь с нашей юридической документацией:',
  'auth.quote.line1': 'Каждая великая история',
  'auth.quote.line2': 'начинается',
  'auth.quote.line3': 'с одной страницы.',
  'auth.stats.activeScanlators': 'Активных пользователей',
  'auth.stats.tools': 'Инструменты',
  'auth.stats.pagesProcessed': 'Обработано страниц',
  'auth.toolkit.ai': 'ИИ и автоматизация',
  'auth.toolkit.tools': 'Инструменты',
  'auth.toolkit.learning': 'Обучение',
  'auth.toolkit.aiTranslation': 'ИИ-перевод',
  'auth.toolkit.autoRedraw': 'Автоперерисовка',
  'auth.toolkit.advancedEditor': 'Продвинутый редактор',
  'auth.toolkit.proTypesetting': 'Профессиональная вёрстка',
  'auth.toolkit.qualityControl': 'Контроль качества',
  'auth.toolkit.guides': 'Руководства и обучение',
  'auth.toolkit.resources': 'Ресурсы и материалы',
  'auth.community.join': 'Присоединиться к сообществу',
  'auth.cover.popular': 'ПОПУЛЯРНОЕ',
  'auth.cover.new': 'НОВОЕ',
  'auth.cover.cleanRedraw': 'Очистка + Перерисовка',
  'auth.cover.translation': 'Перевод',
  'auth.cover.typography': 'Типографика',
  'auth.cover.fullEditing': 'Полное редактирование',
  'auth.cover.allInOne': 'AIO — Всё в одном',
  'auth.cover.finalQc': 'Финальная очистка',
  'login.subtitle.credentials':
    'Войдите в аккаунт и продолжите с того места, где остановились.',
  'login.subtitle.travel':
    'Временно авторизуйте этот компьютер, не покидая процесс входа.',
  'login.error.completeCaptchaTravel':
    'Пройдите капчу, чтобы завершить авторизацию компьютера.',
  'login.error.completeCaptcha': 'Пройдите капчу, чтобы продолжить.',
  'login.error.missingCredentials':
    'Вернитесь и введите email и пароль аккаунта перед авторизацией компьютера.',
  'login.error.missingTravelToken':
    'Введите токен, полученный по почте, для завершения входа.',
  'login.error.generic': 'Ошибка входа',
  'login.warning.mandatoryUpdateTitle': 'Доступно обязательное обновление',
  'login.warning.mandatoryUpdateBody':
    'Установите версию {version}, чтобы продолжить использование приложения.',
  'login.warning.downloadUpdate': 'Скачать обновление',
  'login.warning.downloadingUpdate': 'Скачивание обновления...',
  'login.warning.installUpdateNow': 'Установить обновление сейчас',
  'login.verification.title': 'Что делать',
  'login.verification.wait': 'Подождите {seconds} секунд.',
  'login.verification.retrySameDevice':
    'Попробуйте войти снова с того же устройства или сети.',
  'login.verification.avoidVpn':
    'Избегайте переключения VPN или сетей в этот период.',
  'login.email': 'Электронная почта',
  'login.password': 'Пароль',
  'login.forgotPassword': 'Забыли пароль',
  'login.rememberMe': 'Запомнить меня на этом устройстве',
  'login.travel.eyebrow': 'Проверка безопасности',
  'login.travel.title': 'Этот компьютер требует временной авторизации',
  'login.travel.copy':
    'Откройте KŌMA Studio на основном ПК и перейдите в Настройки > Токен доступа, чтобы отправить код и завершить вход.',
  'login.travel.accountInUse': 'Используемый аккаунт: {email}',
  'login.travel.sameAccount':
    'Используйте тот же аккаунт, который открыт на вашем основном ПК.',
  'login.travel.emailDisabled': 'Отправка писем не настроена в этом окружении.',
  'login.travel.emailEnabled':
    'Код будет отправлен на основную почту аккаунта.',
  'login.travel.step1': 'Откройте приложение на основном компьютере.',
  'login.travel.step2': 'Отправьте токен на почту аккаунта.',
  'login.travel.step3': 'Вставьте код ниже для авторизации этого компьютера.',
  'login.travel.tokenLabel': 'Токен доступа',
  'login.travel.tokenPlaceholder': 'Вставьте код, полученный по почте',
  'login.button.authorizing': 'Авторизация...',
  'login.button.validating': 'Проверка...',
  'login.button.updateRequired': 'Обновите приложение для входа',
  'login.button.retryIn': 'Повторить через {seconds} с',
  'login.button.authorizeComputer': 'Авторизовать этот компьютер',
  'login.button.login': 'Войти в аккаунт',
  'login.button.changeAccount': 'Назад и сменить аккаунт',
  'login.emailPlaceholder': 'you@email.com',
  'login.passwordPlaceholder': '••••••••',
  'login.warning.latestVersion': 'последняя',
  'login.newHere': 'Впервые здесь?',
  'login.createFreeAccount': 'Создайте бесплатный аккаунт',
  'register.subtitle': 'Создайте аккаунт и начните исследовать тысячи тайтлов.',
  'register.error.passwordMismatch': 'Пароли не совпадают.',
  'register.error.completeCaptcha':
    'Пройдите капчу, чтобы завершить регистрацию.',
  'register.error.acceptTerms':
    'Для создания аккаунта необходимо принять Условия использования и Политику конфиденциальности.',
  'register.error.generic': 'Ошибка регистрации',
  'register.displayName': 'Отображаемое имя',
  'register.displayNamePlaceholder': 'Как вас называть?',
  'register.password': 'Пароль',
  'register.passwordPlaceholder': 'Не менее 8 символов',
  'register.confirmPassword': 'Подтверждение пароля',
  'register.confirmPasswordPlaceholder': 'Введите пароль ещё раз',
  'register.legalPrefix': 'Я прочитал(а) и принимаю',
  'register.legalSuffix':
    'Я понимаю, что при регистрации используются строго необходимые cookie, а такие функции, как отчёты об ошибках и интеграции, регулируются указанными документами.',
  'register.button.creating': 'Создание аккаунта...',
  'register.button.loginNow': 'Войти сейчас',
  'legal.links.terms': 'Условия использования',
  'legal.links.privacy': 'Политика конфиденциальности',
  'legal.links.cookies': 'Политика cookie',
  'legal.links.content': 'Уведомления о контенте',
  'transition.tips.loading': '読み込み中...',
  'transition.tips.preparing': 'Подготовка вашей студии...',
  'transition.tips.opening': 'Открытие рабочего пространства...',
  'transition.tips.organizing': 'Упорядочивание панелей...',
  'transition.tips.warming': 'Прогрев инструментов...',
  'transition.tips.workflow': 'Загрузка рабочего процесса...',
  'transition.ariaLabel': 'Загрузка страницы',
  'ranking.discover.title': 'Оставьте отзыв первым',
  'ranking.discover.subtitle':
    'Официальные модели без отзывов при текущем фильтре.',
  'ranking.discover.available': '{count} доступно',
  'ranking.discover.empty': 'Все отфильтрованные модели уже имеют отзывы.',
  'ranking.discover.local': 'Локальная',
  'ranking.discover.cloud': 'Облако',
  'legalHub.version': 'Версия',
  'legalHub.updatedAt': 'Обновлено',
  'register.button.create': 'Создать аккаунт',
  'register.alreadyHaveAccount': 'Уже есть аккаунт?',
  'password.rule.minLength': 'Не менее 8 символов',
  'password.rule.uppercase': 'Заглавная буква',
  'password.rule.lowercase': 'Строчная буква',
  'password.rule.number': 'Цифра',
  'password.rule.special': 'Специальный символ',
  'password.level.veryWeak': 'Очень слабый',
  'password.level.weak': 'Слабый',
  'password.level.fair': 'Средний',
  'password.level.good': 'Хороший',
  'password.level.strong': 'Надёжный',
  'captcha.loadError': 'Не удалось загрузить скрипт Turnstile',
  'captcha.missingSiteKey':
    'Капча включена, но VITE_TURNSTILE_SITE_KEY не настроен.',
  'captcha.initError': 'Не удалось инициализировать капчу',
  'captcha.securityCheck': 'Проверка безопасности',
  'captcha.loadScriptError': 'Не удалось загрузить скрипт Turnstile',
  'captcha.success': 'Капча успешно пройдена.',
  'forgot.title': 'Восстановление пароля',
  'forgot.subtitle':
    'Введите вашу почту, чтобы получить ссылку для сброса пароля.',
  'forgot.success':
    'Если аккаунт с такой почтой существует, вы получите инструкции по сбросу пароля.',
  'forgot.error': 'Не удалось запросить сброс пароля',
  'forgot.button.sending': 'Отправка...',
  'forgot.button.send': 'Отправить ссылку для сброса',
  'forgot.remembered': 'Вспомнили пароль?',
  'forgot.backToLogin': 'Вернуться ко входу',
  'reset.title': 'Новый пароль',
  'reset.subtitle': 'Установите надёжный пароль для вашего аккаунта.',
  'reset.error.missingToken': 'Токен сброса отсутствует или недействителен.',
  'reset.error.generic': 'Не удалось сбросить пароль',
  'reset.success': 'Пароль успешно сброшен. Теперь вы можете войти.',
  'reset.newPassword': 'Новый пароль',
  'reset.button.submitting': 'Сброс...',
  'reset.button.submit': 'Сбросить пароль',
  'verify.title': 'Подтверждение почты',
  'verify.subtitle.pending':
    'Подтвердите почту, чтобы разблокировать все функции.',
  'verify.subtitle.done': 'Ваша почта уже подтверждена.',
  'verify.noEmail': 'нет почты',
  'verify.verified': 'Подтверждена',
  'verify.success': 'Письмо для подтверждения отправлено. Проверьте входящие.',
  'verify.error': 'Не удалось отправить письмо',
  'verify.button.sending': 'Отправка...',
  'verify.button.resend': 'Отправить письмо повторно',
  'verify.button.alreadyConfirmed': 'Почта уже подтверждена',
  'verify.button.backDashboard': 'Вернуться на панель управления',
  'confirm.title.verifying': 'Подтверждение почты...',
  'confirm.title.success': 'Почта подтверждена!',
  'confirm.title.error': 'Ошибка подтверждения',
  'confirm.subtitle.verifying': 'Мы проверяем вашу ссылку для подтверждения.',
  'confirm.subtitle.success':
    'Ваша почта подтверждена. Теперь вы можете использовать все функции.',
  'confirm.subtitle.error':
    'Ссылка для подтверждения недействительна или истекла. Пожалуйста, запросите новое письмо.',
  'confirm.status.wait': 'Пожалуйста, подождите, идёт проверка...',
  'confirm.errorCode': 'Код ошибки:',
  'confirm.success': 'Подтверждение успешно завершено.',
  'confirm.goDashboard': 'Перейти к панели управления',
  'confirm.goLogin': 'Перейти ко входу',
  'banned.title': 'Доступ заблокирован',
  'banned.subtitle': 'Этот доступ был приостановлен модерацией приложения.',
  'banned.reason': 'Причина',
  'banned.scope': 'Область',
  'banned.duration': 'Длительность',
  'banned.until': 'Временно до {value}',
  'banned.undefinedDate': 'неопределённая дата',
  'banned.permanent': 'Постоянная',
  'banned.policy':
    'Ссылки, вредоносные публикации или оскорбительное поведение могут привести к постоянной блокировке в приложении.',
  'banned.backToLogin': 'Вернуться ко входу',
  'session.expiresIn':
    'Ваша сессия истекает через {seconds} с из-за неактивности.',
  'session.stayConnected': 'Остаться в системе',
  'update.toast.availableTitle': 'Доступно новое обновление',
  'update.toast.availableDescription':
    'Версия {version} готова к скачиванию на канале {channel}.',
  'update.toast.downloadedTitle': 'Обновление готово',
  'update.toast.downloadedDescription':
    'Обновление готово. {percent}% загружено. Установите сейчас или при закрытии приложения.',
  'update.toast.downloadingTitle': 'Скачивание обновления',
  'update.toast.downloadingDescription': '{percent}% загружено.',
  'update.toast.closeAria': 'Закрыть баннер обновления',
  'update.channel.beta': 'Бета',
  'update.channel.stable': 'Стабильный',
  'update.button.download': 'Скачать',
  'update.button.details': 'Подробности',
  'update.button.installNow': 'Установить сейчас',
  'update.button.installLater': 'Установить позже',
  'update.progress.title': 'Скачивание обновления...',
  'update.modal.title': 'Доступно обновление',
  'update.modal.unknownVersion': 'неизвестная',
  'update.modal.closeAria': 'Закрыть окно',
  'update.modal.mandatory':
    'Это обязательное обновление. Скачайте и установите его, чтобы продолжить использование приложения.',
  'update.modal.releaseNotes': 'Примечания к выпуску',
  'update.modal.releaseNotesEmpty': 'Нет примечаний к выпуску для этой версии.',
  'update.modal.readyProgress': 'Обновление готово. 100% загружено.',
  'update.modal.downloadingProgress': 'Скачивание обновления...',
  'update.modal.readyToInstall': 'Готово к установке',
  'update.modal.installHintAuto':
    'Если вы сейчас закроете приложение, установка начнётся автоматически.',
  'update.modal.installHintManual':
    'Установка при закрытии отключена. Нажмите «Установить позже», чтобы включить и безопасно закрыть.',
  'update.modal.downloadAction': 'Скачать обновление',
  'update.modal.downloadingAction': 'Скачивание...',
  'update.modal.installAction': 'Установить сейчас',
  'update.modal.installLaterAction': 'Установить позже (при закрытии)',
  'update.modal.laterAction': 'Позже',
  'dropzone.invalidImageAlert':
    'Пожалуйста, загрузите допустимый файл изображения (PNG/JPG).',
  'dropzone.clickOrDrag': 'Нажмите или перетащите изображение сюда',
  'dropzone.supports': 'Поддерживаются PNG и JPG',
  'actionButtons.cleaning': 'Очистка...',
  'actionButtons.cleanImage': 'Очистить изображение',
  'actionButtons.downloadResult': 'Скачать результат',
  'aio.model.manage': 'Модели',
  'aio.model.noneAvailable': 'Нет доступных моделей',
  'aio.model.device': 'Устройство',
  'aio.model.languages': 'Языки',
  'aio.model.languages.multi': 'мульти',
  'aio.model.noDescription': 'Нет описания.',
  'aio.model.localStatus': 'Локальный статус: {value}',
  'aio.stage.detectText': 'Обнаружение текста',
  'aio.stage.recognizeText': 'Распознавание текста',
  'aio.stage.getTranslations': 'Получение переводов',
  'aio.stage.segmentText': 'Сегментация текста',
  'aio.stage.cleanImage': 'Очистка изображения',
  'aio.stage.tabsBarAria': 'Настройка этапов',
  'aio.render.title': 'Отрисованный текст',
  'aio.render.description.manual':
    'Дважды кликните по блоку для редактирования. Контекстная панель появится рядом с выделением с отрисованным текстом.',
  'aio.render.description.auto':
    'Автоматический режим применяет рендеринг по умолчанию к переведённым областям.',
  'aio.render.activePage':
    'Активная страница: {count} блок(ов). Выбрано: {selected}.',
  'aio.render.contextualDock.visible': 'отображается при выделении',
  'aio.render.contextualDock.doubleClick':
    'дважды кликните для начала редактирования и отображения панели',
  'aio.render.contextualDock.select': 'выберите блок для использования панели',
  'aio.render.contextualDock': 'Контекстная панель: {value}',
  'aio.render.shortcut':
    'Горячая клавиша: используйте Shift + Прокрутку на превью для вращения текста выбранного блока.',
  'aio.render.inactiveStage':
    'Это изображение находится на этапе до рендеринга. Перейдите вперёд для просмотра/редактирования отрисованного текста.',
  'aio.render.fontCatalog': 'Каталог шрифтов',
  'aio.render.refreshFonts': 'Обновить шрифты',
  'aio.render.refreshingFonts': 'Обновление...',
  'aio.render.importFont': 'Импортировать шрифт',
  'aio.render.importingFont': 'Импорт...',
  'aio.render.importFontTitleDesktop':
    'Импорт пользовательского шрифта в настольное приложение',
  'aio.render.importFontTitleBrowser':
    'Импорт доступен только в настольном приложении',
  'aio.render.desktopFontsHint':
    'Установленные шрифты Windows и пользовательские импорты доступны в настольном приложении.',
  'aio.render.overlayControlsHint':
    'Элементы управления шрифтом, размером, выравниванием и цветом теперь находятся в контекстной панели наложения.',
  'aio.render.applyStyleAll': 'Применить текущий стиль ко всем выделениям',
  'aio.render.applyStyleAllTitle':
    'Применить стиль текущего выделения ко всем выделениям на всех изображениях',
  'aio.region.title': 'Обнаруженные области',
  'aio.region.description.manual':
    'Перетащите на превью, чтобы добавить новые области. Перетащите блок для перемещения и используйте углы для изменения размера.',
  'aio.region.description.auto':
    'Переключитесь в ручной режим для коррекции обнаруженных блоков.',
  'aio.region.activePage':
    'Активная страница: {count} область(ей). Выбрано: {selected}.',
  'aio.region.ocr': 'OCR выбранной области: {value}',
  'aio.region.translation': 'Перевод выбранной области: {value}',
  'aio.region.notes': 'Заметки выбранной области: {value}',
  'aio.region.segmentation': 'Сегментация выбранной области: {value}',
  'aio.region.noSelection': 'нет',
  'aio.region.noRecognizedText': 'текст не распознан',
  'aio.region.ocrDisabled': 'Этап OCR отключён',
  'aio.region.noTranslation': 'перевод недоступен',
  'aio.region.translationDisabled': 'этап перевода отключён',
  'aio.region.noNotes': 'заметки недоступны',
  'aio.region.notesDisabled': 'заметки отключены',
  'aio.region.noSelectedRegion': 'область не выбрана',
  'aio.region.segmentedBoxes': '{count} сегментированных блоков',
  'aio.region.removeSelected': 'Удалить выбранное',
  'aio.region.duplicateSelected': 'Дублировать выбранное',
  'aio.manual.toolsHintPrimary':
    'Используйте плавающую панель на холсте для выбора области, очистки страницы и редактирования сегментации/ручного режима.',
  'aio.manual.toolsHintSecondary':
    'Инструменты автоматически активируются в зависимости от текущего этапа изображения.',
  'aio.run.manualNoActive':
    'Выберите активное изображение для запуска ручного этапа.',
  'aio.run.manualCurrentOnly':
    'Запустить только текущий этап для выбранного изображения.',
  'aio.run.processing': 'Выполнение {percent}%',
  'aio.run.rerunCurrent': 'Перезапустить текущий этап (активное изображение)',
  'aio.run.runCurrent': 'Запустить текущий этап (активное изображение)',
  'aio.run.full':
    'Запустить AIO (Обнаружение + OCR + Перевод + Сегментация + Очистка + Рендер)',
  'aio.pipeline.textModeTitle': 'Режим текста',
  'aio.pipeline.textModeDescription':
    'Определите, как выбранная область должна обрабатываться при рендеринге. АВТО использует определённую классификацию.',
  'aio.pipeline.currentSelectionMode': 'Режим текущего выделения',
  'aio.pipeline.currentSelectionModeAria': 'Текстовый режим текущего выделения',
  'aio.pipeline.autoResolved': 'АВТО определяется как {value}.',
  'aio.pipeline.currentMode': 'Текущий режим: {value}.',
  'aio.pipeline.selectPreviewBox':
    'Выберите блок на превью, чтобы изменить режим текста.',
  'aio.pipeline.title': 'Конвейер AIO',
  'aio.pipeline.description.auto':
    'Настройте полный конвейер (обнаружение, OCR, перевод, сегментация и очистка) перед запуском пакетной обработки.',
  'aio.pipeline.description.manual':
    'Ручной режим: запускайте или пропускайте этапы последовательно для выбранного изображения.',
  'aio.pipeline.render': 'Рендер',
  'aio.pipeline.renderSubtitle':
    'Применить переведённый текст к финальному изображению',
  'aio.pipeline.executeCurrentTitle':
    'Запустить только текущий этап для выбранного изображения',
  'aio.pipeline.executingStage': 'Выполнение этапа...',
  'aio.pipeline.rerunStage': 'Перезапустить этап',
  'aio.pipeline.runStage': 'Запустить этап',
  'aio.pipeline.skipStage': 'Пропустить этап',
  'aio.pipeline.skipStageTitle':
    'Пропустить текущий этап и разблокировать следующий',
  'aio.pipeline.rewind': 'Назад',
  'aio.pipeline.rewindTitle': 'Вернуться к предыдущему этапу конвейера AIO',
  'aio.pipeline.forward': 'Вперёд',
  'aio.pipeline.forwardTitle': 'Перейти к следующему этапу конвейера AIO',
  'aio.pipeline.manualImageStatus': 'Ручной режим: «{image}» на этапе {stage}.',
  'aio.pipeline.selectImageManual':
    'Выберите изображение для начала поэтапной ручной обработки.',
  'aio.pipeline.currentStage': 'Текущий этап: {label} ({current}/{total}).',
  'aio.pipeline.runToEnable':
    'Запустите AIO для включения поэтапной навигации назад/вперёд.',
  'aio.pipeline.manualHint':
    'Сделайте процесс намного надёжнее: в ручном режиме каждый настраиваемый этап выполняется с большим контролем, проверкой и точностью. Обрабатывается только выбранное изображение, и квота расходуется только при первом ручном запуске каждого изображения (или нулевая, если оно уже прошло через автоматический AIO).',
  'dashboard.enhance.profile.mangaScan': 'Скан манги',
  'dashboard.enhance.profile.animeArt': 'Аниме-арт',
  'dashboard.enhance.profile.general': 'Общий',
  'dashboard.enhance.profile.highQuality4x': 'Высокое качество 4x',
  'dashboard.emptyTip.1':
    'Если изображение слишком большое и возникают ошибки при очистке, переводе или перерисовке, попробуйте разделить его на части. Обычно это стабилизирует обработку.',
  'dashboard.emptyTip.2':
    'Автоматический режим ускоряет работу, но для идеального результата стоит проверить в ручном режиме и исправить финальные детали.',
  'dashboard.emptyTip.3':
    'Используйте инструмент доработки, чтобы сделать текст чище, сбалансированнее и соответствующим стандартам сканлейта.',
  'dashboard.emptyTip.4':
    'Вы можете переключать форму баллонов между прямоугольной и эллиптической для лучшего размещения текста на каждой странице.',
  'dashboard.emptyTip.5':
    'Настройте пресеты на странице настроек, чтобы ускорить повторяющиеся задачи и сохранить единообразие между главами.',
  'dashboard.emptyTip.6':
    'Пробуйте разные модели для разных языков. Лучший OCR или переводчик для японского может не подойти для корейского, китайского или английского.',
  'dashboard.emptyTip.7':
    'Голосуйте за модели, которые больше всего помогают вашему рабочему процессу. Это улучшает рейтинг и помогает другим пользователям с выбором.',
  'dashboard.emptyTip.8': 'Если облачный перевод дорог или нестабилен, настройте пресеты и держите локальную модель в резерве, чтобы работа не останавливалась.',
  'dashboard.emptyTip.9':
    'Используйте Визуальный переводчик для проверки отдельных областей без повторного запуска всей главы.',
  'dashboard.emptyTip.10':
    'В Наборщике небольшие ручные корректировки выравнивания, шрифта и интервалов значительно улучшают финальный результат.',
  'dashboard.emptyTip.11':
    'Когда текст получается слишком сжатым, уменьшите объём текста в блоке, доработайте перевод или скорректируйте баллон, прежде чем сильно уменьшать шрифт.',
  'dashboard.emptyTip.12':
    'Если результат OCR плохой, попробуйте другую модель, прежде чем исправлять всё вручную. Смена модели часто решает большинство ошибок.',
  'dashboard.emptyTip.13':
    'Используйте примечания к переводу только тогда, когда они действительно полезны для читателя. Меньше шума — чище чтение.',
  'dashboard.emptyTip.14':
    'Сохраняйте пользовательские профили LLM и OCR для быстрого сравнения настроек без перенастройки при каждом тесте.',
  'dashboard.emptyTip.15':
    'Если страница не проходит через AIO, запустите этапы отдельно в режиме Производства, чтобы точно найти узкое место.',
  'dashboard.aio.progress.detectText': 'обнаружение текста',
  'dashboard.aio.progress.recognizeText': 'распознавание текста',
  'dashboard.aio.progress.getTranslations': 'перевод текста',
  'dashboard.aio.progress.segmentText': 'сегментация текста',
  'dashboard.aio.progress.cleanImage': 'очистка изображения',
  'dashboard.aio.progress.render': 'подготовка рендера',
  'dashboard.aio.subtitle.detectText':
    'Обнаружение текстовых областей на изображении',
  'dashboard.aio.subtitle.recognizeText':
    'OCR для извлечения текстового содержимого',
  'dashboard.aio.subtitle.getTranslations':
    'Автоматический перевод через выбранный сервис/модель',
  'dashboard.aio.subtitle.segmentText':
    'Уточнение областей с помощью сегментации (стиль Baka)',
  'dashboard.aio.subtitle.cleanImage':
    'Инпейнтинг с AOT/LaMa + маска в стиле Baka',
  'dashboard.aio.manualStatus.locked': 'Заблокирован',
  'dashboard.aio.manualStatus.pending': 'Ожидание',
  'dashboard.aio.manualStatus.done': 'Выполнен',
  'dashboard.aio.manualStatus.skipped': 'Пропущен',
  'dashboard.mode.underDevelopment': 'В разработке.',
  'dashboard.nav.group.main': 'Основное',
  'dashboard.nav.group.production': 'Производство',
  'dashboard.nav.group.utils': 'Утилиты',
  'dashboard.nav.group.info': 'Информация',
  'dashboard.nav.short.aio': 'AIO',
  'dashboard.nav.short.cleaner': 'Очистка/ПР',
  'dashboard.nav.short.enhance': 'Улучшение',
  'dashboard.nav.subtitle.organize': 'Управление файлами',
  'dashboard.nav.subtitle.aio': 'Всё в одном',
  'dashboard.nav.subtitle.cleaner': 'Очистка и перерисовка',
  'dashboard.nav.subtitle.typesetter': 'Наборщик',
  'dashboard.nav.subtitle.translator': 'Переводчик',
  'dashboard.nav.subtitle.raw': 'Поставщик исходников',
  'dashboard.nav.subtitle.proofreader': 'Редактура и контроль качества',
  'dashboard.nav.subtitle.stitch': 'Склейщик',
  'dashboard.nav.subtitle.split': 'Разделитель',
  'dashboard.nav.subtitle.watermark': 'Водяной знак',
  'dashboard.nav.subtitle.enhance': 'Улучшение',
  'dashboard.nav.subtitle.optimizer': 'Оптимизатор глав',
  'dashboard.nav.subtitle.blogger': 'Публикация и хостинг',
  'dashboard.nav.subtitle.imgur': 'Анонимный хостинг',
  'dashboard.nav.subtitle.guides': 'Руководства',
  'dashboard.nav.subtitle.resources': 'Ресурсы',
  'dashboard.nav.tooltip.organize':
    'Упорядочить и переставить изображения перед обработкой',
  'dashboard.nav.tooltip.aio':
    'Полный конвейер: обнаружение, распознавание, перевод, сегментация, очистка и рендер',
  'dashboard.nav.tooltip.cleaner':
    'Очистить баллоны и перерисовать области изображения',
  'dashboard.nav.tooltip.typesetter':
    'Применить типографику и стилизовать текст на страницах',
  'dashboard.nav.tooltip.translator':
    'Перевести текст или проверить OCR/перевод по областям изображения',
  'dashboard.nav.tooltip.raw':
    'Управление и предоставление исходных изображений для конвейера',
  'dashboard.nav.tooltip.proofreader':
    'Проверить переводы и качество финального результата',
  'dashboard.nav.tooltip.stitch':
    'Склеить несколько изображений в непрерывную ленту',
  'dashboard.nav.tooltip.split': 'Разделить длинные изображения на части',
  'dashboard.nav.tooltip.watermark':
    'Пакетное добавление водяных знаков на изображения',
  'dashboard.nav.tooltip.enhance': 'Улучшить качество и разрешение изображений',
  'dashboard.nav.tooltip.optimizer':
    'Оптимизировать финальные файлы для веба, чтения или архивирования',
  'dashboard.nav.tooltip.blogger':
    'Публикация постов в Blogger и генерация URL размещённых изображений',
  'dashboard.nav.tooltip.imgur':
    'Загрузка изображений на Imgur с ротацией Client ID',
  'dashboard.nav.tooltip.guides':
    'Руководства и обучающие материалы по инструментам',
  'dashboard.nav.tooltip.resources': 'Ресурсы, ссылки и справочные материалы',
  'dashboard.mode.organize': 'Организация',
  'dashboard.mode.aio': 'AIO — Всё в одном',
  'dashboard.mode.cleaner': 'Очистка / Перерисовка',
  'dashboard.mode.typesetter': 'Наборщик',
  'dashboard.mode.translator': 'Переводчик',
  'dashboard.mode.raw': 'Поставщик исходников',
  'dashboard.mode.proofreader': 'Редактура / КК',
  'dashboard.mode.stitch': 'Склейка (Вебтун)',
  'dashboard.mode.split': 'Умное разделение',
  'dashboard.mode.watermark': 'Водяной знак',
  'dashboard.mode.enhance': 'Улучшение изображения',
  'dashboard.mode.optimizer': 'Оптимизатор глав',
  'dashboard.mode.blogger': 'Blogger CDN',
  'dashboard.mode.imgur': 'Загрузка на Imgur',
  'dashboard.mode.guides': 'Руководства и обучение',
  'dashboard.mode.resources': 'Ресурсы и материалы',
  'dashboard.status.modelSelected': 'Модель выбрана для {stage}: {model}',
  'dashboard.status.verifyEmailRequired':
    'Подтвердите почту для выполнения этого действия.',
  'dashboard.status.imagesCount': '{count} изображений',
  'dashboard.status.noImage': 'Нет изображения',
  'dashboard.status.freeText': 'свободный текст',
  'dashboard.user.defaultName': 'Пользователь',
  'dashboard.topbar.thisTab': 'Эта вкладка',
  'dashboard.aio.config.title': 'Настройка этапов',
  'dashboard.footer.hardware.nvidia':
    'Максимальная производительность — ускорение NVIDIA.',
  'dashboard.footer.hardware.intel': 'Используется выделенное ускорение Intel.',
  'dashboard.footer.hardware.cpu':
    'Локальное выполнение без выделенного ускорения.',
  'dashboard.footer.quickLinks': 'Быстрые ссылки',
  'dashboard.footer.lastSave.never': 'Ещё не сохранено в этой сессии',
  'dashboard.footer.lastSave.label': 'Последнее сохранение: {time}',
  'dashboard.cleaner.flow.local.title':
    'Структурированный процесс с OCR, сегментацией и локальным инпейнтингом',
  'dashboard.cleaner.flow.ai.title':
    'Автоматичес��ая очистка с мультимодальным ИИ и управляемой реконструкцией',
  'dashboard.cleaner.flow.local.desc':
    'Использует локальный детектор для предложения кандидатов, классифицирует реальные SFX и очищает только одобренные.',
  'dashboard.cleaner.flow.ai.desc':
    'Использует структурное обнаружение проекта для управления ИИ, усиливает сохранение баллонов/рис��нка и компонует большие изображения с более плавными переходами.',
  'dashboard.cleaner.instructions.placeholder':
    'Например: лучше сохранять красные градиенты, быть осторожнее с мелкими SFX, не трогать повествовательные рамки.',
  'dashboard.cleaner.instructions.hint.local':
    'Эти инструкции добавляются как дополнительный контекст после базовых правил классификации и очистки SFX.',
  'dashboard.cleaner.instructions.hint.ai':
    'Эти инструкции добавляются как дополнительный контекст. Основные правила ИИ-очистки остаются приоритетнее любых пользовательских инструкций для сохранения логики очистки.',
  'dashboard.cleaner.inspection.title': 'Инспекция',
  'dashboard.cleaner.segmentation.manage': 'Управление моделями сегментации',
  'dashboard.cleaner.segmentation.model': 'Модель сегментации',
  'dashboard.aio.gpuStages.title': 'Использование GPU по этапам',
  'dashboard.aio.gpuStages.hint':
    'Выберите, какие этапы должны использовать ускорение GPU. Снимите флажок для принудительного выполнения на CPU (полезно, если GPU не хватает VRAM для всех этапов).',
  'dashboard.aio.gpuStages.detect': 'Обнаружение текста (GPU)',
  'dashboard.aio.gpuStages.ocr': 'OCR / Распознавание (GPU)',
  'dashboard.aio.gpuStages.segment': 'Сегментация (GPU)',
  'dashboard.aio.gpuStages.clean': 'Очистка / Инпейнтинг (GPU)',
  'dashboard.aio.gpuStages.noActiveProfile':
    'Сейчас не подтвержден ни один активный профиль GPU. Этот раздел остается видимым, чтобы не возникало мерцания или исчезновения; переключатели снова начнут действовать, как только профиль GPU станет доступен.',
  'dashboard.aio.config.loadingCatalogs': 'Загрузка локального и облачного каталогов...',
  'dashboard.aio.preparingManual': 'Подготовка ручного этапа AIO...',
  'dashboard.aio.preparingAuto': 'Подготовка автоматического запуска AIO...',
  'dashboard.aio.stopping': 'Остановка AIO...',
  'dashboard.aio.abortedByUser': 'Запуск AIO прерван пользователем.',
  'dashboard.aio.abortedMiniBackendRestarted':
    'Запуск AIO прерван. Мини-бэкенд перезапущен.',
  'dashboard.aio.abortedMiniBackendRestartFailed':
    'Запуск AIO прерван. Не удалось автоматически перезапустить мини-бэкенд.',
  'dashboard.llm.customProfilesLoadFailed':
    'Не удалось загрузить пользовательские профили LLM.',
  'dashboard.status.ready': 'Готово к обработке изображений.',
  'dashboard.workspace.pendingChanges':
    'Рабочая область содержит несохранённые изменения.',
  'dashboard.status.restored': 'Рабочая область восстановлена.',
  'dashboard.status.historyRestored': 'Изменение восстановлено из истории.',
  'dashboard.status.undo': 'Отмена действия в рабочей области.',
  'dashboard.status.redo': 'Повтор действия в рабочей области.',
  'dashboard.status.saved': 'Рабочая область сохранена локально.',
  'dashboard.status.exportCancelled': 'Экспорт рабочей области отменён.',
  'dashboard.status.exportSuccess': 'Рабочая область успешно экспортирована.',
  'dashboard.status.importCancelled': 'Импорт рабочей области отменён.',
  'dashboard.status.importSuccess': 'Рабочая область успешно импортирована.',
  'dashboard.status.importSaved':
    'Рабочая область импортирована и сохранена локально.',
  'dashboard.status.importNoAutosave':
    'Рабочая область импортирована. Автоматическое сохранение отключено.',
  'dashboard.status.autosaveRemoved': 'Локальное автосохранение удалено.',
  'dashboard.status.nothingToUndo': 'Нечего отменять в рабочей области.',
  'dashboard.status.nothingToRedo': 'Нечего повторять в рабочей области.',
  'dashboard.sections.pipeline': 'Конвейер',
  'dashboard.sections.languages': 'Языки',
  'dashboard.sections.modelsConfig': 'Модели и конфигурация',
  'dashboard.sections.presets': 'Пресеты',
  'dashboard.sections.region': 'Область',
  'dashboard.aio.rewind': 'AIO назад: этап «{label}» ({current}/{total}).',
  'dashboard.aio.forward': 'AIO вперёд: этап «{label}» ({current}/{total}).',
  'dashboard.aio.rewindImage':
    'AIO назад ({imageName}): этап «{label}» ({current}/{total}).',
  'dashboard.aio.forwardImage':
    'AIO вперёд ({imageName}): этап «{label}» ({current}/{total}).',
  'dashboard.llm.translation': 'Перевод',
  'dashboard.llm.ocr': 'OCR',
  'dashboard.aio.manualScope': 'AIO ручной',
  'dashboard.aio.autoScope': 'AIO автоматический',
  'dashboard.aio.executing': 'Выполнение',
  'dashboard.cleaner.selectProfile':
    'Выберите сохранённый визуальный профиль для автоматической ИИ-очистки.',
  'dashboard.cleaner.profileNotFound':
    'Визуальный профиль не найден. Перезагрузите и попробуйте снова.',
  'dashboard.cleaner.profileInUse':
    'Визуальный профиль для автоматической ИИ-очистки: {label}.',
  'dashboard.cleaner.invalidModel':
    'Выберите допустимую модель для автоматической ИИ-очистки.',
  'dashboard.cleaner.modelRoadmap':
    'Модель «{name}» находится в планах разработки.',
  'dashboard.cleaner.modelConfigRequired':
    'Модель «{name}» требует настройки перед использованием.',
  'dashboard.translator.sfx.invalidModel':
    'Выберите допустимую модель для ИИ SFX переводчика.',
  'dashboard.cleaner.profileSaved':
    'Визуальный профиль сохранён и выбран для автоматической ИИ-очистки: {label}.',
  'dashboard.cleaner.removeProfileSelect':
    'Выберите сохранённый визуальный профиль для удаления.',
  'dashboard.cleaner.customTitle':
    'Пользовательский ИИ (Автоматическая ИИ-очистка)',
  'dashboard.cleaner.emptyLabel': 'Новый визуальный профиль',
  'dashboard.cleaner.namePlaceholder': 'Например: Gemini Image Clean',
  'dashboard.cleaner.modelPlaceholder': 'gemini-2.5-flash-image',
  'dashboard.cleaner.useLabel': 'Использовать в очистке',
  'dashboard.cleaner.providerInUse':
    'Провайдер {name} используется для автоматической ИИ-очистки.',
  'dashboard.stage.detectText.label': 'Обнаружение текста',
  'dashboard.stage.detectText.short': 'Обнаружение',
  'dashboard.stage.recognizeText.label': 'Распознавание текста',
  'dashboard.stage.recognizeText.short': 'OCR',
  'dashboard.stage.getTranslations.label': 'Получение переводов',
  'dashboard.stage.getTranslations.short': 'Перевод',
  'dashboard.stage.segmentText.label': 'Сегментация текста',
  'dashboard.stage.segmentText.short': 'Сегментация',
  'dashboard.stage.cleanImage.label': 'Очистка изображения',
  'dashboard.stage.cleanImage.short': 'Очистка',
  'dashboard.stage.render.label': 'Рендер',
  'dashboard.stage.render.short': 'Рендер',
  'dashboard.aio.pipeline.detect.subtitle':
    'Обнаружение текстовых областей на изображении',
  'dashboard.aio.pipeline.ocr.subtitle':
    'OCR для извлечения текстового содержимого',
  'dashboard.aio.pipeline.translate.subtitle':
    'Автоматический перевод через сервис/модель',
  'dashboard.aio.pipeline.segment.subtitle':
    'Уточнение областей с помощью сегментации',
  'dashboard.aio.pipeline.clean.subtitle': 'Инпейнтинг с AOT/LaMa + маска',
  'dashboard.aio.pipeline.render.subtitle':
    'Применение переведённого текста к финальному изображению',
  'dashboard.aio.config.langHint':
    'Исходный → Обнаружение/OCR/Перевод. Целевой → только перевод.',
  'dashboard.aio.translation.localModelInfo':
    'Локальные модели загружаются по запросу; облачные/API-модели продолжают использовать ключ.',
  'dashboard.translator.sameModelHint':
    'Переводчик использует тот же выбор модели, что и AIO; запустите заново после смены модели.',
  'dashboard.translator.incompatibleLocalModel':
    'Текущая локальная модель не поддерживает языковую пару Переводчика. Выберите другую модель или используйте облако.',
  'dashboard.status.modeChanged': 'Режим: {mode}',
  'dashboard.status.underDevelopment': '{mode}: {tooltip}',
  'dashboard.aio.render.hintRot': 'Горячая клавиша: ',
  'dashboard.aio.render.hintRotSuffix': ' для вращения.',
  'settings.typographerLibrary.noFolder': 'Нет папки',
  'settings.profile.defaultUser': 'Пользователь KŌMA',
  'register.email': 'Электронная почта',
  'register.emailPlaceholder': 'you@email.com',
  'feed.sidebar.webhookPlaceholder': 'https://discord.com/api/webhooks/...',
  'feed.sidebar.webhookLabelShort': 'Вебхук: ',
  'feed.moderation.scope.accountHwid': 'Аккаунт + HWID',
  'feed.moderation.scope.full': 'Полная',
  'feed.composer.label.scanlation': 'Сканлейт',
  'feed.composer.availability.hoursPlaceholder': '10',
  'feed.composer.roles.valuePlaceholder': '50.00',
  'feed.apply.contactPlaceholder': 'Discord @username',
  'ranking.error.loadFailed': 'Не удалось загрузить рейтинги.',
  'ranking.error.loadDetailFailed': 'Не удалось загрузить подробности.',
  'ranking.error.saveReviewFailed': 'Не удалось сохранить отзыв.',
  'ranking.error.deleteReviewFailed': 'Не удалось удалить отзыв.',
  'ranking.error.emailVerificationRequired':
    'Подтвердите почту перед публикацией или редактированием отзывов.',
  'dashboard.aio.translation.temperature': 'Температура',
  'dashboard.aio.translation.topP': 'Top P',
  'dashboard.aio.translation.maxTokens': 'Макс. токенов',
  'dashboard.aio.clean.hdStrategy': 'Стратегия HD',
  'dashboard.aio.clean.hdStrategy.resize': 'Масштабирование',
  'dashboard.aio.clean.hdStrategy.crop': 'Обрезка',
  'dashboard.aio.clean.hdStrategy.original': 'Оригинал',
  'dashboard.aio.clean.hdStrategyHint':
    'Стратегия обработки больших изображений перед инпейнтингом.',
  'dashboard.aio.clean.resizeLimit': 'Лимит масштабирования',
  'dashboard.aio.clean.cropMargin': 'Отступ обрезки',
  'dashboard.aio.clean.cropTriggerSize': 'Порог активации обрезки',
  'dashboard.aio.clean.localHardware':
    'Локальное оборудование: {name} ({provider}{vram})',
  'dashboard.sidebar.workspace': 'Рабочая область',
  'dashboard.sidebar.hide': 'Скрыть боковую панель',
  'dashboard.sidebar.remaining': 'Осталось: {count}',
  'dashboard.sidebar.resizeAria': 'Изменить размер левой панели',
  'dashboard.sidebar.resizeTitle':
    'Перетащите для изменения размера. Дважды кликните для сброса.',
  'dashboard.sidebar.files': 'Файлы ({count})',
  'dashboard.sidebar.clearAll': 'Очистить всё',
  'dashboard.sidebar.cleared': 'Список изображений очищен.',
  'dashboard.sidebar.empty': 'Нет изображений',
  'dashboard.sidebar.rewindImage': 'Вернуть только это изображение',
  'dashboard.sidebar.forwardImage': 'Продвинуть только это изображение',
  'dashboard.sidebar.rotate90': 'Повернуть на 90 градусов',
  'dashboard.sidebar.moveUp': 'Переместить вверх',
  'dashboard.sidebar.moveDown': 'Переместить вниз',
  'dashboard.sidebar.remove': 'Удалить',
  'dashboard.sidebar.extracting': 'Извлечение изображений... подождите.',
  'dashboard.sidebar.dropHere': 'Перетащите сюда...',
  'dashboard.sidebar.clickOrDrag': 'Перетащите или нажмите',
  'dashboard.sidebar.processingArchive': 'Обработка ZIP/PDF/CBZ/CB7/PSD...',
  'dashboard.sidebar.stats.title': 'Локальная статистика',
  'dashboard.sidebar.stats.badge': 'Активно',
  'dashboard.sidebar.stats.daily': 'Сегодня',
  'dashboard.sidebar.stats.weekly': 'Эта неделя',
  'dashboard.sidebar.stats.monthly': 'Этот месяц',
  'dashboard.sidebar.stats.foot':
    'Недавняя локальная активность обработки. Счётчики автоматически сбрасываются по периоду.',
  'dashboard.sidebar.stats.resetNow': 'Сбрасывается сейчас',
  'dashboard.sidebar.stats.resetInHoursMinutes':
    'Сброс через {hours}ч {minutes}м',
  'dashboard.sidebar.stats.resetInHours': 'Сброс через {hours}ч',
  'dashboard.sidebar.stats.resetInMinutes': 'Сброс через {minutes}м',
  'dashboard.sidebar.right.hide': 'Скрыть инструменты',
  'dashboard.sidebar.right.close': 'Закрыть панель',
  'dashboard.sidebar.right.resizeAria': 'Изменить размер правой панели',
  'dashboard.sidebar.right.resizeTitle':
    'Перетащите для изменения размера. Дважды кликните для сброса.',
  'dashboard.footer.runtime.downloaded': 'Пакет загружен',
  'dashboard.footer.runtime.embedded': 'Встроенное ядро',
  'dashboard.footer.runtime.fallback.title': 'Резервный режим активен',
  'dashboard.footer.runtime.fallback.detail':
    'Запрошен {requested}, используется {active}.',
  'dashboard.footer.runtime.tensorrt.title': 'TensorRT активен',
  'dashboard.footer.runtime.tensorrt.detail':
    'Максимальная производительность — ускорение NVIDIA.',
  'dashboard.footer.runtime.cuda.title': 'CUDA активна',
  'dashboard.footer.runtime.cuda.detail':
    'Используется современный GPU NVIDIA.',
  'dashboard.footer.runtime.legacy.label': 'Устаревший',
  'dashboard.footer.runtime.legacy.title': 'CUDA Legacy активна',
  'dashboard.footer.runtime.legacy.detail':
    'Профиль совместимости для старых GPU NVIDIA.',
  'dashboard.footer.runtime.openvino.title': 'OpenVINO активен',
  'dashboard.footer.runtime.openvino.detail':
    'Используется выделенное ускорение Intel.',
  'dashboard.footer.runtime.cpu.title': 'CPU активен',
  'dashboard.footer.runtime.cpu.detail':
    'Локальное выполнение без выделенного ускорения.',
  'dashboard.footer.workspace.saving': 'Сохранение',
  'dashboard.footer.workspace.saved': 'Сохранено',
  'dashboard.footer.workspace.error': 'Локальная ошибка',
  'dashboard.footer.workspace.pending': 'Ожидание',
  'dashboard.footer.workspace.title': 'Локальная рабочая область',
  'dashboard.footer.runtime.source': 'Источник: {value}',
  'dashboard.footer.runtime.remoteAvailable': 'Доступен удалённый пакет.',
  'dashboard.footer.runtime.errorReason': 'Причина: {value}',
  'dashboard.footer.bugReport.title': 'Сообщить об ошибке',
  'dashboard.footer.bugReport.desc':
    'Отправьте отчёт об ошибке с автоматическими скриншотами и логами.',
  'dashboard.footer.discord.aria': 'Присоединиться к Discord',
  'dashboard.footer.discord.title': 'Сообщество Discord',
  'dashboard.footer.discord.desc':
    'Присоединяйтесь к сообществу, предлагайте идеи и делитесь отзывами.',
  'dashboard.footer.website.aria': 'Открыть сайт проекта',
  'dashboard.footer.website.title': 'Сайт проекта',
  'dashboard.footer.website.desc': 'Новости, документация и ресурсы проекта.',
  'bugReport.error.imgLoadFailed': 'Не удалось загрузить изображение.',
  'bugReport.error.canvasFailed': 'Ошибка обработки холста.',
  'modelManager.modal.title': 'Хранилище моделей',
  'modelManager.modal.aioFallback': 'AIO',
  'modelCard.recommended': 'РЕК',
  'modelCard.hardware.gpu': 'GPU',
  'modelCard.hardware.cpu': 'CPU',
  'modelCard.speed.ok': 'ОК',
  'auth.toolkit.aiClean': 'ИИ-очистка',
  'freeProviderCard.setup': 'Настройка',
  'freeProviderCard.limits': 'Лимиты',
  'freeProviderCard.rateLimits': 'Ограничения запросов',
  'freeProviderCard.field.modelPlaceholder': 'ID модели (совместимый с OpenAI)',
  'customProvider.profileType': 'Пользовательский профиль ИИ',
  'dashboard.cleaner.mode.assisted': 'Ассистированный',
  'dashboard.cleaner.mode.automaticAi': 'Автоматическая ИИ-очистка',
  'dashboard.cleaner.mode.aiSfx': 'ИИ SFX',
  'dashboard.cleaner.mode.assistedTitle':
    'Структурированный процесс с OCR, сегментацией и локальным инпейнтингом',
  'dashboard.cleaner.mode.automaticAiTitle':
    'Автоматическая очистка с мультимодальным ИИ и управляемой реконструкцией',
  'dashboard.cleaner.mode.aiSfxTitle':
    'Обнаружение и очистка только одобренных ИИ SFX',
  'dashboard.cleaner.mode.title': 'Режим',
  'dashboard.cleaner.mode.hint':
    'Текущий режим сохранён как ассистированный процесс. Новая <strong>Автоматическая ИИ-очистка</strong> использует мультимодальный ИИ со строгими правилами сохранения рисунка, контуров и баллонов.',
  'dashboard.cleaner.pipeline.title': 'Конвейер',
  'dashboard.cleaner.pipeline.hint':
    'Ассистированный процесс: OCR → Сегментация → Локальная очистка. Идеально для тех, кто хочет предсказуемости и тонкой настройки.',
  'dashboard.cleaner.ocr.language': 'Язык (OCR)',
  'dashboard.cleaner.ocr.languageAria': 'Исходный язык для OCR',
  'dashboard.cleaner.models.button': 'Модели',
  'dashboard.cleaner.models.none': 'Нет моделей',
  'dashboard.cleaner.ocr.manageAria': 'Управление моделями OCR',
  'dashboard.cleaner.ocr.modelAria': 'Модель OCR',
  'dashboard.cleaner.segment.title': 'Сегментация',
  'dashboard.cleaner.segment.manageAria': 'Управление моделями сегментации',
  'dashboard.cleaner.segment.modelAria': 'Модель сегментации',
  'dashboard.cleaner.clean.title': 'Очистка',
  'dashboard.cleaner.clean.manageAria': 'Управление моделями очистки',
  'dashboard.cleaner.clean.modelAria': 'Модель очистки',
  'dashboard.cleaner.settings.title': 'Очистка',
  'dashboard.cleaner.settings.maskDilation': 'Расширение маски',
  'dashboard.cleaner.settings.hdStrategy': 'Стратегия HD',
  'dashboard.cleaner.settings.resizeLimit': 'Лимит масштабирования',
  'dashboard.cleaner.settings.cropMargin': 'Отступ обрезки',
  'dashboard.cleaner.settings.cropTrigger': 'Порог обрезки',
  'dashboard.cleaner.inspect.title': 'Инспекция',
  'dashboard.cleaner.inspect.ocrBlocks': 'Блоки OCR',
  'dashboard.cleaner.inspect.segmented': 'Сегментировано',
  'dashboard.cleaner.inspect.selection': 'Выделение',
  'dashboard.cleaner.inspect.none': 'нет',
  'dashboard.cleaner.inspect.ocr': 'OCR',
  'dashboard.cleaner.inspect.segments': 'Сегменты',
  'dashboard.cleaner.inspect.boxesCount': '{count} блок(ов)',
  'dashboard.cleaner.ai.sfxCleaner': 'ИИ-очистка SFX',
  'dashboard.cleaner.ai.automaticClean': 'Автоматическая ИИ-очистка',
  'dashboard.cleaner.ai.sfxDesc':
    'Использует локальный детектор для предложения кандидатов, классифицирует реальные SFX и очищает только одобренные.',
  'dashboard.cleaner.ai.automaticDesc':
    'Использует структурное обнаружение проекта для управления ИИ, усиливает сохранение баллонов/рисунка и компонует большие изображения с более плавными переходами.',
  'dashboard.cleaner.ai.modelTitle': 'Модель ИИ',
  'dashboard.cleaner.ai.manageAria': 'Управление моделями {value}',
  'dashboard.cleaner.ai.modelAria': 'Модель {value}',
  'dashboard.cleaner.ai.noneAvailable': 'Нет доступных моделей ИИ',
  'dashboard.cleaner.instructions.title': 'Дополнительные инструкции',
  'dashboard.cleaner.instructions.hintSfx':
    'Эти инструкции добавляются как дополнительный контекст после базовых правил классификации и очистки SFX.',
  'dashboard.cleaner.instructions.hintAi':
    'Эти инструкции добавляются как дополнительный контекст. Основные правила ИИ-очистки остаются приоритетнее любых пользовательских инструкций для сохранения логики очистки.',
  'dashboard.cleaner.stats.candidates': 'Кандидаты',
  'dashboard.cleaner.stats.sfxApproved': 'SFX одобр.',
  'dashboard.cleaner.stats.redraw': 'Перерисовка',
  'dashboard.cleaner.action.processing': 'Обработка {value} {percent}%',
  'dashboard.cleaner.action.runAiSfx': 'Запустить ИИ-очистку SFX',
  'dashboard.cleaner.action.runAutomatic':
    'Запустить автоматическую ИИ-очистку',
  'dashboard.cleaner.action.runAssisted': 'Запустить ассистированную очистку',
  'dashboard.typography.circularText': 'Круговой текст',
  'dashboard.typography.activate': 'Активировать',
  'dashboard.typography.effect.aria': 'Текстовый эффект',
  'dashboard.typography.effect.title': 'Выбрать текстовый эффект',
  'dashboard.typography.effect.label': 'Эффект',
  'dashboard.typography.effect.none': 'Без эффекта',
  'dashboard.typography.effect.panelTitle': 'Текстовый эффект',
  'dashboard.typography.effect.panelHint':
    'Встроенные пресеты для речи, ударений и размытия.',
  'dashboard.typography.effect.searchPlaceholder': 'Поиск эффектов...',
  'dashboard.typography.effect.intensity': 'Интенсивность',
  'dashboard.typography.effect.noResults': 'Эффекты не найдены.',
  'dashboard.aio.customAi.titleTranslation':
    'Пользовательские профили ИИ (Перевод)',
  'dashboard.aio.customAi.titleOcr': 'Пользовател��ские профили ИИ (OCR)',
  'dashboard.aio.customAi.newTranslation': 'Новый профиль перевода',
  'dashboard.aio.customAi.newOcr': 'Новый профиль OCR',
  'dashboard.aio.customAi.placeholderTranslation':
    'Например: OpenRouter Manga EN-US',
  'dashboard.aio.customAi.placeholderOcr': 'Например: Private Vision OCR',
  'dashboard.aio.customAi.modelPlaceholderTranslation': 'openai/gpt-4.1',
  'dashboard.aio.customAi.modelPlaceholderOcr': 'gpt-4.1-mini',
  'dashboard.aio.customAi.useTranslation': 'Использоват�� перевод',
  'dashboard.aio.customAi.useOcr': 'Использовать OCR',
  'dashboard.aio.customAi.loading': 'Загрузка пользовательских профилей...',
  'dashboard.aio.customAi.savedProfile': 'Профиль сохранён',
  'dashboard.aio.customAi.apiBase': 'Базовый URL API',
  'dashboard.aio.customAi.ollamaPreset': 'Локальный пресет Ollama',
  'dashboard.aio.customAi.apiKey': 'API-ключ (необязатель��о)',
  'dashboard.aio.customAi.model': 'Модель',
  'dashboard.aio.customAi.clear': 'Очистить',
  'dashboard.aio.customAi.remove': 'Удалить',
  'dashboard.aio.customAi.save': 'Сохранить',
  'dashboard.emptyStage.title': 'Выберите или загрузите изображения',
  'dashboard.emptyStage.desc':
    'Используйте инструменты в верхней панели для обработки страниц манхвы.',
  'dashboard.emptyStage.tipTitle': 'Полезный совет',
  'dashboard.emptyStage.tipMeta': 'Сменяется каждые 15 секунд',
  'dashboard.enhance.title': 'Улучшение изображения',
  'dashboard.enhance.localHint':
    'ONNX-модели на локальном мини-бэкенде. Установите перед обработкой.',
  'dashboard.enhance.desktopRequiredHint':
    'Требуется настольное приложение с активным мини-бэкендом.',
  'dashboard.enhance.scale': 'Масштаб',
  'dashboard.enhance.profile': 'Профиль',
  'dashboard.enhance.model': 'Модель',
  'dashboard.enhance.format': 'Формат',
  'dashboard.enhance.status.title': 'Модель',
  'dashboard.enhance.status.desktopRequired': 'Требуется настольное приложение',
  'dashboard.enhance.status.selectModel': 'Выберите модель',
  'dashboard.enhance.status.ready': 'Готово',
  'dashboard.enhance.status.notImported': 'Не импортирована',
  'dashboard.enhance.status.notInstalled': 'Не установлена',
  'dashboard.enhance.importHint':
    'Ручной импорт ONNX. Конвертируйте .pth с помощью sisr2onnx.',
  'dashboard.enhance.action.manage': 'Управление',
  'dashboard.enhance.action.import': 'Импорт',
  'dashboard.enhance.action.install': 'Установить',
  'dashboard.enhance.action.source': 'Источник',
  'dashboard.enhance.selectAboveHint': 'Выберите модель выше.',
  'dashboard.enhance.action.processing': 'Улучшение...',
  'dashboard.enhance.action.run': 'Улучшить изображения',
  'dashboard.info.optimizer.desc1':
    'Оптимизируй��е финальный пакет с пресетами для веба, чтения или архивирования, используя уже сгенерированные результаты.',
  'dashboard.info.optimizer.desc2':
    'Утилита показывает экономию по каждой странице и экспортирует в ZIP или локальную папку.',
  'dashboard.info.blogger.desc1':
    'Используйте эту утилиту для публикации в Blogger и генерации URL размещённых изображений.',
  'dashboard.info.blogger.desc2':
    'Учётные данные и оптимизатор находятся в Настройки > Интеграции > Blogger CDN.',
  'dashboard.info.imgur.desc1':
    'Используйте эту утилиту для анонимной загрузки на Imgur с ротацией Client ID.',
  'dashboard.info.imgur.desc2':
    'Ключи, лимитер и полное руководство находятся в Настройки > Интеграции > Загрузка на Imgur.',
  'dashboard.info.guides.desc1':
    'Выберите руководство на центральной панели для чтения подробных инструкций.',
  'dashboard.info.guides.desc2':
    'Каждое руководство содержит практические примеры и советы по продуктивности.',
  'dashboard.info.resources.desc1':
    'Изучите полезные ресурсы и материалы для вашего рабочего процесса сканлейта.',
  'dashboard.info.resources.desc2': 'Шрифты, шаблоны, словари и многое другое.',
  'dashboard.render.noRecognizedText': 'Текст не распознан',
  'dashboard.render.noTranslation': 'Перевод недоступен',
  'dashboard.render.noNotes': 'Примечания недоступны',
  'dashboard.render.noteLabel': 'ПП:',
  'dashboard.render.textLabel': 'Текст',
  'dashboard.render.aaLabel': 'АА',
  'dashboard.render.skewXLabel': 'Нx',
  'dashboard.render.skewYLabel': 'Нy',
  'renderPreview.context.title': 'Действия с областью',
  'renderPreview.context.copyRecognized': 'Копировать распознанное',
  'renderPreview.context.copyTranslated': 'Копировать перевод',
  'renderPreview.context.editRendered': 'Редактировать отрисовку',
  'renderPreview.context.editRenderedHint': 'Редактировать отрисованный текст',
  'renderPreview.context.manualModeHint': 'Требуется ручной режим',
  'renderPreview.shape': 'Форма',
  'renderPreview.rectangular': 'Прямоугольная',
  'renderPreview.elliptic': 'Эллиптическая',
  'renderPreview.convertRectangular': 'Преобразовать в прямоугольную форму',
  'renderPreview.convertElliptic': 'Преобразовать в эллиптическую форму',
  'renderPreview.manualModeRequired': 'Требуется ручной режим',
  'renderPreview.applyTypographyPreset': 'Применить пресет типографики',
  'renderPreview.preset': 'Пресет',
  'renderPreview.typographyPresets': 'Пресеты типографики',
  'renderPreview.applyPreset': 'Применить пресет',
  'renderPreview.removeRegion': 'Удалить выделение',
  'renderPreview.textFont': 'Шрифт текста',
  'renderPreview.selectionShape': 'Форма выделения',
  'renderPreview.fontSize': 'Размер шрифта',
  'renderPreview.decreaseFont': 'Уменьшить шрифт',
  'renderPreview.increaseFont': 'Увеличить шрифт',
  'renderPreview.alignment': 'Выравнивани��',
  'renderPreview.alignLeft': 'По левому краю',
  'renderPreview.alignCenter': 'По центру',
  'renderPreview.alignRight': 'По правому краю',
  'renderPreview.typographyStyle': 'Стиль типографики',
  'renderPreview.bold': 'Жирный',
  'renderPreview.italic': 'Курсив',
  'renderPreview.underline': 'Подчёркнутый',
  'renderPreview.uppercase': 'Заглавные',
  'renderPreview.textOrientation': 'Ориентация текста',
  'renderPreview.horizontal': 'Горизонталь��ая',
  'renderPreview.vertical': 'Вертикальна��',
  'renderPreview.circular': 'Круговая',
  'renderPreview.rotation': 'Вращение',
  'renderPreview.rotateMinus5': 'Повернуть -5°',
  'renderPreview.rotatePlus5': 'Повернуть +5°',
  'renderPreview.skewX': 'Наклон X',
  'renderPreview.skewXMinus2': 'Наклон X -2°',
  'renderPreview.skewXPlus2': 'Наклон X +2°',
  'renderPreview.skewY': 'Наклон Y',
  'renderPreview.skewYMinus2': 'Наклон Y -2°',
  'renderPreview.skewYPlus2': 'Наклон Y +2°',
  'renderPreview.adjustments': 'Корректировки',
  'renderPreview.refine': 'Доработка',
  'renderPreview.autoFontSize': 'Автоподбор шрифта',
  'renderPreview.autoFit': 'Автоподгонк��',
  'renderPreview.fixed': 'Фиксированн��й',
  'renderPreview.hyphenation': 'Перенос слов',
  'renderPreview.enabled': 'Включён',
  'renderPreview.disabled': 'Отключён',
  'renderPreview.maxSize': 'Макс. размер',
  'renderPreview.minSize': 'Мин. размер',
  'renderPreview.lineSpacing': 'Межстрочный интервал',
  'renderPreview.opacity': 'Прозрачность',
  'renderPreview.fill': 'Заливка',
  'renderPreview.outline': 'Обводка',
  'renderPreview.shadow': 'Тень',
  'renderPreview.shadowLayers': 'Слои тени',
  'renderPreview.addLayer': 'Добавить слой',
  'renderPreview.layerN': 'Слой {count}',
  'renderPreview.removeLayerN': 'Удалить слой {count}',
  'renderPreview.shadowLayerN': 'Слой тени {count}',
  'renderPreview.blur': 'Размытие',
  'renderPreview.offsetX': 'Смещение X',
  'renderPreview.offsetY': 'Смещение Y',
  'renderPreview.radius': 'Радиус',
  'renderPreview.startAngle': 'Начальный угол',
  'renderPreview.spacing': 'Интервал',
  'renderPreview.shadowLayersCount': '{count} слой(ёв)',
  'renderPreview.shadowBlurSummary': 'размытие {value}',
  'renderPreview.history.none': 'Нет истории AIO для этого изображения',
  'renderPreview.box.clickToEdit': 'дважды кликните для редактирования',
  'renderPreview.box.renderNotApplied': 'рендер не применён на этом этапе',
  'renderPreview.editor.placeholder': 'Введите финальный текст...',
  'renderPreview.editor.aria': 'Редактирова��ие отрисованного текста',
  'splitter.strategy.smart': 'Авто (умный)',
  'splitter.strategy.smartHint': 'Пробелы + эвристики.',
  'splitter.strategy.advancedDesktop': 'Полу-настольный',
  'splitter.strategy.advancedDesktopHint': 'Расширенный локальный анализ.',
  'splitter.strategy.manual': 'Ручной',
  'splitter.strategy.manualHint': 'Только ручные корректировки.',
  'splitter.strategy.fixedHeight': 'Фиксированная высота',
  'splitter.strategy.fixedHeightHint': 'Разделение по высоте.',
  'splitter.strategy.count': 'N частей',
  'splitter.strategy.countHint': 'Равномерное деление.',
  'dashboard.aio.autoScopeTitle': 'Автоматичес��ая обработка без вмешательства',
  'dashboard.aio.manualScopeTitle': 'Ручное управление каждым этапом',
  'detectionPreview.recognized': 'Распознано:',
  'detectionPreview.translated': 'Переведено:',
  'detectionPreview.note': 'ПП:',
  'detectionPreview.manual': 'Ручной',
  'detectionPreview.removeSelection': 'Удалить выделение',
  'detectionPreview.actions': 'Действия с областью',
  'detectionPreview.text': 'Текст',
  'detectionPreview.copyRecognized': 'Копировать распознанное',
  'detectionPreview.editRecognized': 'Редактировать распознанное',
  'detectionPreview.manualModeOnly': 'Доступно только в ручном режиме',
  'detectionPreview.copyTranslated': 'Копировать перевод',
  'detectionPreview.editTranslated': 'Редактирова��ь перевод',
  'detectionPreview.removeRegion': 'Удалить область',
  'detectionPreview.editRecognizedTitle': 'Редактировать распознанный текст',
  'detectionPreview.editTranslatedTitle': 'Редактировать переведённый текст',
  'detectionPreview.placeholderRecognized': 'Введите распознанный текст...',
  'detectionPreview.placeholderTranslated': 'Введите перевод...',
  'detectionPreview.rewind': 'Вернуть это изображение',
  'detectionPreview.forward': 'Продвинуть это изображение',
  'detectionPreview.noHistory': 'Нет истории AIO для этого изображения',
  'dashboard.translator.workspace.aria': 'Режим переводчика',
  'dashboard.translator.workspace.textTitle': 'Перевести свободный текст',
  'dashboard.translator.workspace.text': 'Текст',
  'dashboard.translator.workspace.visualTitle':
    'Обнаружение и перевод на изображениях',
  'dashboard.translator.workspace.visual': 'Визуальный',
  'watermark.header.eyebrow': 'Утилита редактирования',
  'watermark.header.title': 'Водяной знак',
  'watermark.header.badge': 'Пакетный',
  'watermark.panel.presets': 'Пресеты',
  'watermark.presets.builtin': 'Встроенные',
  'watermark.presets.user': 'Сохранённые',
  'watermark.action.save': 'Сохранить',
  'watermark.action.duplicate': 'Дублировать',
  'watermark.panel.text': 'Текст',
  'watermark.text.enable': 'Включить текст',
  'watermark.text.content': 'Содержимое',
  'watermark.text.font': 'Шрифт',
  'watermark.text.size': 'Размер',
  'watermark.text.color': 'Цвет',
  'watermark.text.outline': 'Обводка',
  'watermark.text.outlineColor': 'Цвет обводки',
  'watermark.text.opacity': 'Прозрачность',
  'watermark.panel.logo': 'Логотип',
  'watermark.logo.enable': 'Включить',
  'watermark.logo.change': 'Изменить',
  'watermark.logo.upload': 'Загрузить',
  'watermark.logo.remove': 'Удалить',
  'watermark.logo.scale': 'Масштаб %',
  'watermark.logo.opacity': 'Прозрачность',
  'watermark.logo.brightness': 'Яркость',
  'watermark.logo.saturation': 'Насыщенност��',
  'watermark.panel.distribution': 'Расположение',
  'watermark.distribution.position': 'Позиция',
  'watermark.distribution.rotation': 'Вращение',
  'watermark.distribution.blend': 'Наложение',
  'watermark.distribution.gapX': 'Отступ X',
  'watermark.distribution.gapY': 'Отступ Y',
  'watermark.distribution.padding': 'Поля',
  'watermark.distribution.baseName': 'Базовое имя',
  'watermark.distribution.smartPlacement': 'Умное размещение',
  'watermark.action.applying': 'Применение...',
  'watermark.action.applyBatch': 'Применить пакетно',
  'watermark.status.cancelRequested': 'Запрошена отмена.',
  'watermark.action.cancel': 'Отмена',
  'watermark.panel.preview': 'Предпросмотр',
  'watermark.preview.compare': 'Сравнение',
  'watermark.preview.mode': 'Предпросмотр',
  'watermark.preview.empty.title': 'Нет изображений',
  'watermark.preview.empty.desc': 'Импортируйте страницы в левой панели.',
  'watermark.preview.noLayer.title': 'Настройте слой',
  'watermark.preview.noLayer.desc':
    'Включите текст или логотип в панели инструментов для генерации предпросмотра.',
  'watermark.preview.original': 'Оригинал',
  'watermark.preview.watermark': 'Водяной знак',
  'watermark.preview.compareAria': 'Сравнение до/после',
  'watermark.preview.generating': 'Генерация...',
  'watermark.panel.output': 'Результат',
  'watermark.output.empty.title': 'Нет результатов',
  'watermark.output.empty.desc':
    'Примените пакетную обработку для генерации загрузок.',
  'watermark.action.zip': 'ZIP',
  'watermark.action.folder': 'Папка',
  'watermark.action.download': 'Скачать',
  'imgur.hero.eyebrow': 'Загрузка на Imgur',
  'imgur.hero.title': 'Анонимный хостинг',
  'imgur.hero.desc':
    'Используйте эту утилиту для быстрой загрузки на Imgur с ротацией Client ID.',
  'imgur.status.remaining': 'Осталось: {remaining}',
  'imgur.status.configure': 'Настроить',
  'imgur.alert.missingConfig': 'Конфигураци�� отсутствует',
  'imgur.alert.addActiveClient':
    'Добавьте хотя бы один активный Client ID в Настройки > Интеграции.',
  'imgur.batch.title': 'Пакетная загрузка',
  'imgur.batch.limit': 'Лимит {limit} загрузок в час (Использован��: {used})',
  'imgur.dropzone.title': 'Перетащите изображения сюда',
  'imgur.dropzone.desc': 'Перетащите несколько файлов JPG, PNG или WEBP.',
  'imgur.toggle.imgOutput': 'Вывод в виде тега <img>',
  'imgur.toggle.imgOutputDesc':
    'Генерирует готовый HTML-код для блогов и форумов.',
  'imgur.actions.select': 'Выбрать',
  'imgur.actions.sending': 'Отправка...',
  'imgur.actions.send': 'Отправить',
  'imgur.actions.copy': 'Копировать URL',
  'imgur.queue.title': 'Очередь загрузки',
  'imgur.queue.items_one': '{count} элемент',
  'imgur.queue.items_other': '{count} элементов',
  'imgur.queue.empty': 'Очередь пуста. Добавьте изображения выше.',
  'imgur.queue.altPlaceholder': 'Альтернативный текст',
  'imgur.queue.urlLabel': 'URL',
  'imgur.queue.keyLabel': 'Ключ',
  'imgur.queue.remove': 'Удалить',
  'imgur.error.configLoad': 'Не удалось загрузить конфигурацию Imgur.',
  'imgur.error.uploadFailed': 'Не удалось загрузить изображение.',
  'imgur.feedback.singleSuccess': 'Загрузка выполнена успешно.',
  'imgur.feedback.multiSuccess': 'Загрузка {count} изображений завершена.',
  'ranking.metric.overall': 'Общая оценка',
  'ranking.metric.quality': 'Качество',
  'ranking.metric.speed': 'Скорость',
  'ranking.metric.costBenefit': 'Соотношение цена/качество',
  'ranking.metric.easeOfUse': 'Простота использования',
  'ranking.trend.neutral': 'Нейтрально',
  'ranking.trend.points': 'б.',
  'ranking.table.title': 'Рейтинг',
  'ranking.table.sortedBy':
    'Отсортировано по взвешенному показателю «{metric}».',
  'ranking.table.modelsCount': '{count} моделей в рейтинге',
  'ranking.table.empty': 'Нет моделей, соответствующих текущим фильтрам.',
  'ranking.table.newLabel': 'Новая',
  'ranking.table.reviewsCount': '{count} отзывов',
  'ranking.table.reviewedByYou': 'Вы уже оставили отзыв',
  'ranking.table.viewDetails': 'Подробности',
  'ranking.filters.metricAria': 'Метрика рейтинга',
  'ranking.filters.searchPlaceholder': 'Поиск модели...',
  'ranking.filters.searchAria': 'Поиск модели',
  'ranking.filters.advancedAria': 'Показать расширенные фильтры',
  'ranking.filters.button': 'Фильтры',
  'ranking.filters.stageLabel': 'Этап',
  'ranking.filters.sourceLabel': 'Источник',
  'ranking.filters.languageLabel': 'Язык',
  'ranking.filters.minReviewsLabel': 'Мин. отзывов',
  'ranking.filters.allStages': 'Все этапы',
  'ranking.filters.allSources': 'Локальные + Облако',
  'ranking.filters.onlyLocal': 'Только локальные',
  'ranking.filters.onlyCloud': 'Только облако',
  'ranking.filters.allLanguages': 'Все языки',
  'ranking.filters.reviews_one': '{count} отзыв',
  'ranking.filters.reviews_other': '{count} отзывов',
  'ranking.composer.usage.balanced': 'Сбалансированный',
  'ranking.composer.usage.qualityFirst': 'Качество прежде всего',
  'ranking.composer.usage.speedFirst': 'Скорость прежде всего',
  'ranking.composer.usage.lowVram': 'Мало VRAM',
  'ranking.composer.usage.offlineLocal': 'Локальный конвейер',
  'ranking.composer.usage.cloudPipeline': 'Облачный конвейер',
  'ranking.composer.title.edit': 'Редактирова��ь отзыв',
  'ranking.composer.title.new': 'Новый отзыв',
  'ranking.composer.action.close': 'Закрыть',
  'ranking.composer.field.title': 'Заголовок',
  'ranking.composer.field.titlePlaceholder':
    'Например: Лучший локальный OCR для манги',
  'ranking.composer.field.context': 'Контекст',
  'ranking.composer.field.sourceLang': 'Исходный язык',
  'ranking.composer.field.sourceLangPlaceholder': 'ja, en, pt-br...',
  'ranking.composer.field.targetLang': 'Целевой язык',
  'ranking.composer.field.targetLangPlaceholder': 'en, pt, pt-br...',
  'ranking.composer.field.device': 'Устройство',
  'ranking.composer.device.none': 'Не указано',
  'ranking.composer.field.comment': 'Комментарий',
  'ranking.composer.field.commentPlaceholder':
    'Опишите общее качество, стабильность, потребление ресурсов и где эта модель наиболее полезна.',
  'ranking.composer.action.reset': 'Сбросить',
  'ranking.composer.action.delete': 'Удалить',
  'ranking.composer.action.save': 'Сохранить',
  'ranking.composer.action.publish': 'Опубликовать',
  'dashboard.specialMode.visualEmpty.title': 'Визуальный переводчик',
  'dashboard.specialMode.visualEmpty.description':
    'Импортируйт�� изображения, чтобы начать перевод прямо на превью.',
  'dashboard.specialMode.visualEmpty.cta': 'Выбрать изображения',
  'dashboard.reviewRaw.raw.title': 'Проверка исходников',
  'dashboard.reviewRaw.raw.description':
    'Анализ качества оригинальных изображений и подготовка пакета для конвейера.',
  'dashboard.reviewRaw.raw.note':
    'Проверка исходников помогает ИИ лучше понять визуальный контекст перед OCR.',
  'dashboard.reviewRaw.raw.statusReady':
    'Пакет из {count} изображений готов к проверке.',
  'dashboard.reviewRaw.raw.validate': 'Проверить исходники',
  'dashboard.reviewRaw.qc.title': 'Контроль качества',
  'dashboard.reviewRaw.qc.descriptionAuto':
    'Автоматический КК использует лёгкие модели для обнаружения типичных ошибок редактирования.',
  'dashboard.reviewRaw.qc.descriptionManual':
    'Ручной режим позволяет детально проверить каждый баллон и перерисовку.',
  'dashboard.reviewRaw.qc.note':
    'Включите проверки ниже для запуска пакетного анализа.',
  'dashboard.reviewRaw.qc.automaticChecks': 'Автоматические проверки',
  'dashboard.reviewRaw.qc.checks.untranslatedText': 'Непереведённый текст',
  'dashboard.reviewRaw.qc.checks.emptyBubbles': 'Пустые баллоны',
  'dashboard.reviewRaw.qc.checks.visualArtifacts': 'Визуальные артефакты',
  'dashboard.reviewRaw.qc.checks.textAlignment': 'Выравнивание текста',
  'dashboard.reviewRaw.qc.checks.fontConsistency': 'Единообразие шрифтов',
  'dashboard.reviewRaw.qc.inProgress': 'Анализ КК выполняется...',
  'dashboard.reviewRaw.qc.run': 'Запустить КК',
  'common.cancel': 'Отмена',
  'common.save': 'Сохранить',
  'common.name': 'Имя',
  'common.newName': 'Новое имя',
  'common.removed': 'Удалено',
  'common.renamed': 'Переименовано',
  'common.duplicated': 'Дублировано',
  'common.saved': 'Сохранено',
  'common.failed': 'Ошибка',
  'common.cancelled': 'Отменено',
  'common.status': 'Статус',
  'common.configured': 'Настроено',
  'common.no': 'Нет',
  'common.account': 'Аккаунт',
  'common.format': 'Формат',
  'common.exportedCount': 'Экспортировано: {count} элементов.',
  'modelManager.modal.verified': 'Проверено',
  'modelManager.modal.upToDate': 'Актуальна',
  'modelManager.modal.closeAria': 'Закрыть окно',
  'modelManager.modal.localModels': 'Локальный каталог',
  'modelManager.modal.localDesc':
    'Установка по запросу с проверкой целостности.',
  'modelManager.modal.noLocal':
    'Нет локальных моделей, соответствующих фильтрам.',
  'modelManager.modal.cloudModels': 'Облачный каталог',
  'modelManager.modal.cloudDesc':
    'Модели на базе API/облака. Требуют подключения и собственных ключей.',
  'modelManager.modal.hideCustom': 'Скрыть пользовательские',
  'modelManager.modal.addCustom': 'Добавить пользовательскую',
  'modelManager.modal.noCloud':
    'Нет облачных моделей, соответствующих фильтрам.',
  'modelManager.modal.checking': 'Проверка...',
  'modelManager.modal.checkUpdates': 'Проверить обновления',
  'modelManager.modal.installAll': 'Установить рекомендуемые',
  'modelManager.modal.cancel': 'Отмена',
  'modelManager.modal.noEligible': 'Подходящие модели не найдены.',
  'modelManager.modal.notEnoughSpace':
    'Недостаточно места (необходимо {space}).',
  'resources.breadcrumb.home': 'Ресурсы',
  'resources.communities.title': 'Сообщества и ссылки',
  'resources.back': 'Назад к ресурсам',
  'resources.communities.desc':
    'Активные сообщества сканлейта, Discord-серверы, форумы и ресурсы для общения и обучения.',
  'resources.platform.discord': 'Discord',
  'resources.platform.forum': 'Форум',
  'resources.platform.reddit': 'Reddit',
  'resources.platform.website': 'Веб-сайт',
  'resources.communities.members': '{count} участников',
  'resources.action.visit': 'Перейти',
  'resources.externalTools.title': 'Внешние инструменты',
  'resources.externalTools.desc':
    'Рекомендуемые программы и приложения, дополняющие KŌMA Studio в вашем рабочем процессе сканлейта.',
  'resources.category.editing': 'Редактирова��ие',
  'resources.category.ocr': 'OCR',
  'resources.category.translation': 'Перевод',
  'resources.category.fonts': 'Шрифты',
  'resources.category.hosting': 'Хостинг',
  'resources.category.utility': 'Утилиты',
  'resources.action.open': 'Открыть',
  'resources.action.download': 'Скачать',
  'resources.status.free': 'Бесплатно',
  'resources.status.paid': 'Платно',
  'resources.fonts.title': 'Шрифты для набора',
  'resources.fonts.desc':
    'Подборка популярных шрифтов для сканлейта. Включает шрифты для диалогов, повествования, акцентов, SFX и CJK-текста.',
  'resources.fonts.searchPlaceholder':
    'Поиск шрифтов по имени, назначению или тегу...',
  'resources.fonts.noResults': 'Шрифты по запросу «{search}» не найдены',
  'resources.license.free': 'Бесплатная',
  'resources.license.openSource': 'Открытый код',
  'resources.license.commercial': 'Коммерческая',
  'resources.license.mixed': 'Смешанная',
  'resources.glossary.title': 'Глоссарий сканлейта',
  'resources.glossary.desc':
    'Технические термины, жаргон сообщества и основная лексика для сканлейта манги, манхвы и маньхуа.',
  'resources.glossary.searchPlaceholder': 'Поиск терминов...',
  'resources.glossary.noResults': 'Термины по запросу «{search}» не найдены',
  'resources.glossary.related': 'Связанные:',
  'resources.category.general': 'Общее',
  'resources.category.typesetting': 'Набор текста',
  'resources.category.cleaning': 'Очистка',
  'resources.category.technical': 'Техническое',
  'resources.category.roles': 'Роли',
  'resources.sfx.title': 'Библиотека SFX',
  'resources.sfx.desc':
    'Библиотека японских звуковых эффектов с переводами, произношением ромадзи и примерами использования в манге.',
  'resources.sfx.searchPlaceholder':
    'Поиск по японскому, ромадзи или английскому...',
  'resources.sfx.noResults': 'SFX не найдены.',
  'resources.sfx.commonIn': 'Часто встречается в: {value}',
  'resources.category.impact': 'Удары',
  'resources.category.emotion': 'Эмоции',
  'resources.category.ambient': 'Фон',
  'resources.category.action': 'Действие',
  'resources.category.voice': 'Голос',
  'resources.category.misc': 'Разное',
  'resources.filters.all': 'Все ({count})',
  'resources.page.tab.fonts': 'Шрифты',
  'resources.page.tab.sfx': 'Библиотека SFX',
  'resources.page.tab.glossary': 'Глоссарий',
  'resources.page.tab.communities': 'Сообщества',
  'resources.page.tab.tools': 'Инструменты',
  'resources.page.title.main': 'Центр ',
  'resources.page.title.accent': 'ресурсов',
  'resources.page.subtitle':
    'Подборки материалов, сообщества и инструменты для вашего рабочего процесса.',
  'resources.page.searchPlaceholder': 'Поиск по всем категориям...',
  'resources.page.searchAria': 'Поле поиска ресурсов',
  'resources.page.clearSearch': 'Очистить поиск',
  'resources.page.tabsAria': 'Категории ресурсов',
  'resources.category.fonts.label': 'Шрифты для набора',
  'resources.category.fonts.description':
    'Подборка популярных шрифтов для сканлейта манги, манхвы и маньхуа.',
  'resources.category.sfx-library.label': 'Библиотека SFX',
  'resources.category.sfx-library.description':
    'Библиотека японских ономатопей с переводами и примерами использования.',
  'resources.category.glossary.label': 'Глоссарий сканлейта',
  'resources.category.glossary.description':
    'Технические термины и жаргон сообщества из мира сканлейта.',
  'resources.category.communities.label': 'Сообщества',
  'resources.category.communities.description':
    'Discord-серверы, сабреддиты и форумы сканлейта.',
  'resources.category.tools-external.label': 'Внешние инструменты',
  'resources.category.tools-external.description':
    'Дополнительные программы и полезные онлайн-инструменты.',
  'resources.home.title': 'Центр ресурсов',
  'resources.home.subtitle':
    'Подборки материалов, сообщества и инструменты для вашего рабочего процесса.',
  'resources.home.itemCount': '{count} элементов',
  'dashboard.aio.result.regionsDetected': '{count} область(ей) обнаружено',
  'dashboard.aio.result.textsRecognized': '{count} текст(ов) распознано',
  'dashboard.aio.result.translationsGenerated':
    '{count} перевод(ов) сгенерировано',
  'dashboard.aio.result.regionsSegmented': '{count} область(ей) сегментировано',
  'dashboard.aio.result.imagesCleaned': '{count} изображение(��) очищено',
  'dashboard.aio.result.blocksReady': '{count} блок(ов) готово к рендеру',
  'dashboard.aio.result.finished': 'AIO завершён. {parts}.',
  'resources.glossary.category.general': 'Общее',
  'resources.glossary.category.typesetting': 'Набор текста',
  'resources.glossary.category.cleaning': 'Очистка',
  'resources.glossary.category.translation': 'Перевод',
  'resources.glossary.category.technical': 'Техническое',
  'resources.glossary.category.roles': 'Роли',
  'resources.glossary.filterAll': 'Все',
  'resources.glossary.results_one': 'термин найден',
  'resources.glossary.results_other': 'терминов найдено',
  'resources.glossary.context': 'Глоссарий',
  'resources.glossary.alphaAria': 'Алфавитная навигация',
  'resources.glossary.alphaBtnAria': 'Перейти к букве {letter}',
  'dashboard.aio.config.sourceLanguage':
    'Исходный язык (Обнаружение/OCR/Перевод)',
  'dashboard.aio.config.targetLanguage': 'Язык перевода',
  'dashboard.aio.pipeline.rewind': 'Вернуть конвейер',
  'dashboard.aio.pipeline.forward': 'Продвинуть конвейер',
  'dashboard.aio.pipeline.snapshot': 'Снимок: ',
  'dashboard.aio.pipeline.image': 'Изображение: ',
  'dashboard.aio.pipeline.stage': 'Этап: ',
  'dashboard.aio.translation.noneSelected': 'Модель не выбрана.',
  'dashboard.aio.translation.selected': 'Выбрана: ',
  'dashboard.aio.render.hint':
    'Элементы управления шрифтом/цветом/выравниванием находятся в контекстной панели наложения. Горячая клавиша: Shift + Прокрутка для вращения.',
  'dashboard.aio.render.warning':
    'Изображение на этапе до рендера. Используйте «Вперёд» для просмотра.',
  'dashboard.aio.render.disabled':
    'Включите этап рендера в конвейере для настройки.',
  'dashboard.stitch.lastToNext':
    'Последнее изображение отправлено в следующий пакет.',
  'dashboard.stitch.firstFromNext':
    'Первое изображение из следующего пакета добавлено в текущий.',
  'dashboard.stitch.resetPlanning':
    'Планирование склейщика автоматически пересчитано.',
  'dashboard.aio.customAi.syncing': 'Пользовательский ИИ (синхронизация...)',
  'dashboard.aio.customOcr.syncing': 'Пользовател��ский OCR (синхронизация...)',
  'dashboard.aio.customOcr.useCase':
    'Пользовательский профиль OCR ожидает локальной синхронизации.',
  'dashboard.aio.customAi.useCase':
    'Пользовательский профиль ожидает локальной синхронизации.',
  'dashboard.aio.config.languageHint':
    'Исходный язык используется на этапах обнаружения, распознавания и перевода. Язык перевода применяется только при переводе.',
  'dashboard.aio.presets.title': 'Пресеты AIO по языкам',
  'dashboard.aio.presets.currentLanguage': 'Текущий язык:',
  'dashboard.aio.presets.noneActive': 'Нет активного пресета',
  'dashboard.aio.presets.activeSuffix': '(активный)',
  'dashboard.aio.presets.new': 'Новый',
  'dashboard.aio.presets.edit': 'Редактировать',
  'dashboard.aio.presets.delete': 'Удалить',
  'dashboard.aio.presets.saveCurrent': 'Сохранить текущий',
  'dashboard.aio.presets.openSettings': 'Открыть пресеты в настройках',
  'dashboard.aio.presets.presetName': 'Имя пресета',
  'dashboard.aio.presets.namePlaceholder': 'Например: Быстрый JP OCR',
  'dashboard.aio.presets.description': 'Описание',
  'dashboard.aio.presets.optional': 'Необязательно',
  'dashboard.aio.presets.setActiveFor': 'Установить как активный пресет для',
  'dashboard.aio.presets.cancel': 'Отмена',
  'dashboard.aio.presets.update': 'Обновить пресет',
  'dashboard.aio.presets.create': 'Создать пресет',
  'dashboard.aio.translation.selectedSummaryModel': 'Выбрана: {name}',
  'dashboard.aio.translation.selectedSummaryCustom':
    'Выбрана: {name} (Пользовательский/FREE провайдер)',
  'dashboard.aio.translation.selectedSummaryLegacy':
    'Выбрана: {name} (Облако/API/ИИ)',
  'dashboard.aio.translation.selectedSummaryEmpty':
    'Выберите локальную или облачную модель для перевода в AIO.',
  'dashboard.aio.translation.supportSummary':
    'Локальные модели загружаются по запросу; облачные/API-модели остаются доступными по ключу.',
  'dashboard.aio.translation.additionalContextPlaceholder': 'Дополнительный контекст для облачного перевода...',
  'dashboard.aio.translation.notesToggle':
    'Генерировать и отображать ПП отдельно от перевода',
  'dashboard.aio.translation.neighborContextToggle':
    'Использовать контекст соседних изображений в пакете',
  'dashboard.aio.translation.multimodalToggle':
    'Отправлять изображение страницы как мультимодальный контекст',
  'dashboard.aio.translation.activeConfigFor':
    'Активная конфигурация для: {value}.',
  'dashboard.aio.customAi.title': 'Пользовательский ИИ',
  'dashboard.aio.customAi.loadingProfiles':
    'Загрузка пользовательских профилей...',
  'dashboard.aio.customAi.savedTranslationProfile':
    'Сохранённый профиль перевода',
  'dashboard.aio.customAi.newTranslationProfile': 'Новый профиль перевода',
  'dashboard.aio.customAi.name': 'Имя',
  'dashboard.aio.customAi.translationNamePlaceholder':
    'Например: OpenRouter Manga EN-US',
  'dashboard.aio.customAi.apiBasePlaceholder': 'https://api.example.com/v1',
  'dashboard.aio.customAi.useLocalOllama': 'Локальный пресет Ollama',
  'dashboard.aio.customAi.apiKeyOptional': 'API-ключ (необязательно)',
  'dashboard.aio.customAi.apiKeyPlaceholder': 'sk-...',
  'dashboard.aio.customAi.translationModelPlaceholder': 'openai/gpt-4.1...',
  'dashboard.aio.customAi.resetTranslation': 'Очистить перевод',
  'dashboard.aio.customAi.useSavedTranslation': 'Использовать перевод',
  'dashboard.aio.customAi.removeTranslation': 'Удалить перевод',
  'dashboard.aio.customAi.saveTranslation': 'Сохранить перевод',
  'dashboard.aio.customAi.savedOcrProfile': 'Сохранённый профиль OCR',
  'dashboard.aio.customAi.newOcrProfile': 'Новый профиль OCR',
  'dashboard.aio.customAi.ocrNamePlaceholder': 'Например: Private Vision OCR',
  'dashboard.aio.customAi.ocrModelPlaceholder': 'gpt-4.1-mini...',
  'dashboard.aio.customAi.resetOcr': 'Очистить OCR',
  'dashboard.aio.customAi.useSavedOcr': 'Использовать OCR',
  'dashboard.aio.customAi.removeOcr': 'Удалить OCR',
  'dashboard.aio.customAi.saveOcr': 'Сохранить OCR',
  'dashboard.aio.customAi.openAiCompatibleHint':
    'Используйте API, совместимый с OpenAI.',
  'dashboard.aio.clean.maskDilation': 'Расширение маски',
  'bugReport.title': 'Сообщить об ошибке',
  'bugReport.subtitle': 'Скриншот + автоматические логи + ручные вложения',
  'bugReport.close': 'Закрыть',
  'bugReport.details': 'Подробности',
  'bugReport.evidence': 'Доказательства',
  'bugReport.machineSnapshotIncluded':
    'Автоматичес��и включается техническая информация об устройстве.',
  'bugReport.field.title': 'Заголовок',
  'bugReport.field.description': 'Описание',
  'bugReport.field.severity': 'Критичность',
  'bugReport.field.steps': 'Шаги воспроизведения',
  'bugReport.field.expected': 'Ожидаемое',
  'bugReport.field.actual': 'Фактическое',
  'bugReport.field.contact': 'Контакт',
  'bugReport.placeholder.title': 'Например: Ошибка обработки пакета в AIO',
  'bugReport.placeholder.description': 'Опишите проблему',
  'bugReport.placeholder.steps': '1. … 2. … 3. …',
  'bugReport.placeholder.contact': 'email, Discord, @user',
  'bugReport.severity.low': 'Низкая',
  'bugReport.severity.medium': 'Средняя',
  'bugReport.severity.high': 'Высокая',
  'bugReport.severity.critical': 'Критическая',
  'bugReport.preparingEvidence': 'Подготовка скриншота и логов…',
  'bugReport.dragToCrop':
    'Перетащите для выбора необязательной области обрезки.',
  'bugReport.clearCrop': 'Сбросить обрезку',
  'bugReport.manualAttachments': 'Ручные вложения',
  'bugReport.attach': 'Прикрепить',
  'bugReport.attach.summary':
    'Макс. {count} файлов, {size} МБ каждый. Всего: {total}.',
  'bugReport.attach.maxCount': 'Максимум {count} вложений.',
  'bugReport.attach.fileTooLarge': '{name} > {size} МБ.',
  'bugReport.attach.totalTooLarge': 'Всего > {size} МБ.',
  'bugReport.attach.remove': 'Удалить {name}',
  'bugReport.screenshotUnavailable': 'Скриншот недоступен.',
  'bugReport.error.bridgeUnavailable': 'Мост недоступен.',
  'bugReport.error.prepareFailed': 'Не удалось подготовить отчёт об ошибке.',
  'bugReport.error.noScreenshot': 'Скриншот отсутствует.',
  'bugReport.error.fillTitleDescription': 'Заполните заголовок и описание.',
  'bugReport.error.generic': 'Ошибка.',
  'bugReport.success.sent': 'Отчёт отправлен.{screenshot}',
  'bugReport.success.screenshot': 'Скриншот: {url}',
  'bugReport.legalPrefix':
    'Отправляя, вы подтверждаете, что проверили скриншот, логи и вложения. Материалы пересылаются в соответствии с',
  'bugReport.sending': 'Отправка…',
  'bugReport.submit': 'Отправить отчёт',
  'dashboard.topbar.tools': 'Инструменты',
  'dashboard.topbar.showSidebar': 'Показать боковую панель',
  'dashboard.topbar.sidebar': 'Боковая панель',
  'dashboard.topbar.disableBatch': 'Отключить пакет',
  'dashboard.topbar.enableBatch': 'Включить пакет',
  'dashboard.topbar.batchStatus': 'Пакет · {count}п',
  'dashboard.topbar.threads': 'Потоки',
  'dashboard.topbar.viewMode': 'Вид',
  'dashboard.topbar.paginated': 'Постраничный',
  'dashboard.topbar.longStrip': 'Длинная лента',
  'dashboard.topbar.rotate90': 'Повернуть 90°',
  'dashboard.topbar.selectImage': 'Выберите изображение',
  'dashboard.topbar.export': 'Экспорт',
  'dashboard.topbar.textFile': 'Текстовый файл',
  'dashboard.topbar.textPackage': 'Текстовый пакет',
  'dashboard.topbar.imagePackage': 'Пакет изображений',
  'dashboard.topbar.downloadTextAsTxt': 'Скачивает перевод в формате .txt.',
  'dashboard.topbar.downloadVisualZip':
    'ZIP с файлами OCR и перевода .txt для каждого изображения.',
  'dashboard.topbar.format': 'Формат',
  'dashboard.topbar.quality': 'Качество',
  'dashboard.topbar.package': 'Пакет',
  'dashboard.topbar.rawText': 'Исходный текст',
  'dashboard.topbar.translated': 'Переведённый',
  'dashboard.topbar.inpainted': 'Очищенный',
  'dashboard.topbar.downloadTxt': 'Скачать TXT',
  'dashboard.topbar.downloadZip': 'Скачать ZIP',
  'dashboard.topbar.downloadPackage': 'Скачать пакет',
  'dashboard.topbar.layeredPsd': 'Многослойный PSD',
  'dashboard.topbar.layeredPsdHint':
    'Экспорт PSD для Photoshop, CSP, Krita, GIMP.',
  'dashboard.topbar.compression': 'Сжатие',
  'dashboard.topbar.dpi': 'DPI',
  'dashboard.topbar.ocrOverlay': 'Наложение OCR',
  'dashboard.topbar.crops': 'Обрезки',
  'dashboard.topbar.rawTextLayer': 'Слой исходного текста',
  'dashboard.topbar.translatedLayer': 'Слой перевода',
  'dashboard.topbar.psTextLayers': 'Текстовые слои PS',
  'dashboard.topbar.metadataJson': 'Метаданные JSON',
  'dashboard.topbar.photoshopRequired':
    'Требуется Adobe Photoshop (2025–cc2017).',
  'dashboard.topbar.generating': 'Генерация…',
  'dashboard.topbar.psdWithMeta': 'PSD + Мета',
  'dashboard.topbar.exportPsd': 'Экспорт PSD',
  'dashboard.topbar.undoWorkspace': 'Отменить действие',
  'dashboard.topbar.undoShortcut': 'Отменить (Ctrl+Z)',
  'dashboard.topbar.redoWorkspace': 'Повторить действие',
  'dashboard.topbar.redoShortcut': 'Повторить (Ctrl+Shift+Z / Ctrl+Y)',
  'dashboard.topbar.shortcuts': 'Горячие клавиши',
  'dashboard.topbar.shortcutsHint': 'Горячие клавиши (H)',
  'dashboard.topbar.hideTools': 'Скрыть инструменты',
  'dashboard.topbar.showTools': 'Показать инструменты',
  'dashboard.topbar.hide': 'Скрыть',
  'dashboard.topbar.profile': 'Профиль',
  'dashboard.topbar.exportWorkspace': 'Экспортировать рабочую область',
  'dashboard.topbar.importWorkspace': 'Импортировать рабочую область',
  'dashboard.topbar.clearLocalAutosave': 'Очистить локальное автосохранение',
  'dashboard.topbar.closeWorkspace': 'Закрыть рабочую область',
  'dashboard.topbar.replayTour': 'Повторить обучение',
  'dashboard.topbar.scanlationFeed': 'Лента сканлейта',
  'dashboard.topbar.rankings': 'Рейтинги',
  'dashboard.topbar.logout': 'Выйти',
  'dashboard.topbar.brand': 'KŌMA Studio',
  'dashboard.topbar.autoManualBadge': 'А/Р',
  'dashboard.topbar.zoomOut': 'Уменьшить',
  'dashboard.topbar.zoomIn': 'Увеличить',
  'dashboard.topbar.compressionRle': 'RLE',
  'dashboard.topbar.compressionZip': 'ZIP',
  'dashboard.topbar.compressionRaw': 'RAW',
  'dashboard.topbar.navigation': 'Навигация',
  'dashboard.topbar.optionPng': 'PNG',
  'dashboard.topbar.optionJpeg': 'JPEG',
  'dashboard.topbar.optionWebp': 'WEBP',
  'dashboard.topbar.optionPdf': 'PDF',
  'dashboard.topbar.optionCbz': 'CBZ',
  'dashboard.topbar.optionCb7': 'CB7',
  'dashboard.topbar.optionZip': 'ZIP',
  'renderPreview.circularText': 'Круговой текст',
  'settings.aioPresets.description':
    'Комбинации моделей для 5 этапов AIO по исходному языку. Выберите, какой пресет активен.',
  'settings.aioPresets.catalog': 'Каталог',
  'settings.aioPresets.syncingCatalog': 'Синхронизация локальных + облачных моделей.',
  'settings.aioPresets.editPreset': 'Редактировать пресет',
  'settings.aioPresets.newPreset': 'Новый пресет',
  'settings.aioPresets.namePlaceholder': 'Например: Японский HQ',
  'settings.aioPresets.sourceLanguage': 'Исходный язык',
  'settings.aioPresets.shortDescription': 'Краткое описание…',
  'settings.aioPresets.select': 'Выбрать',
  'settings.aioPresets.noneRegistered': 'Пресеты не зарегистрированы.',
  'settings.aioPresets.createFirst': 'Создать первый',
  'settings.aioPresets.presetCount': '{count} пресет(ов)',
  'settings.aioPresets.clearActive': 'Сбросить активный',
  'settings.aioPresets.active': 'Активный',
  'settings.aioPresets.activate': 'Активировать',
  'settings.aioPresets.editNamed': 'Редактировать {name}',
  'settings.aioPresets.deleteNamed': 'Удалить {name}',
  'settings.pickerPalette.title': 'Палитра выбора',
  'settings.pickerPalette.description':
    'Пресеты сплошных цветов и градиентов для палитр заливки.',
  'settings.pickerPalette.newPreset': 'Новый пресет',
  'settings.pickerPalette.add': 'Добавить',
  'settings.pickerPalette.reset': 'Сбросить',
  'settings.pickerPalette.hintPrefix':
    'Принимает сплошные цвета и градиенты. Например:',
  'settings.pickerPalette.hintOr': 'или',
  'settings.pickerPalette.solids': 'Сплошные',
  'settings.pickerPalette.gradients': 'Градиенты',
  'settings.modePresets.title': 'Пресеты режимов',
  'settings.modePresets.description':
    'Базовый стиль для каждого текстового режима. Автоматически применяется на панели управления.',
  'settings.modePresets.targetMode': 'Целевой режим',
  'settings.modePresets.outline': 'Обводка',
  'settings.modePresets.off': 'Выкл',
  'settings.modePresets.outlineWidth': 'Толщина обводки',
  'settings.modePresets.ocrGradient': 'Градиент OCR',
  'settings.modePresets.detect': 'Определять',
  'settings.modePresets.ignore': 'Игнорировать',
  'settings.modePresets.textColor': 'Цвет текста',
  'settings.modePresets.outlineColor': 'Цвет обводки',
  'settings.modePresets.all': 'Все',
  'settings.modePresets.mode': 'Режим',
  'settings.modePresets.save': 'Сохранить',
  'settings.typographerLibrary.title': 'Библиотека наборщика',
  'settings.typographerLibrary.description':
    'Глобальные стили с папками, пресетом по умолчанию и привязкой по обнаруженному режиму.',
  'settings.typographerLibrary.newFolder': 'Новая папка',
  'settings.typographerLibrary.defaultPreset': 'Пресет по умолчанию',
  'settings.typographerLibrary.none': 'Нет',
  'settings.typographerLibrary.edit': 'Редактировать',
  'settings.typographerLibrary.new': 'Новый',
  'settings.typographerLibrary.presetTypographer': 'Пресет наборщика',
  'settings.typographerLibrary.folder': 'Папка',
  'settings.typographerLibrary.withoutFolder': 'Без папки',
  'settings.typographerLibrary.descriptionPlaceholder':
    'Например: Баллон EN-US',
  'settings.typographerLibrary.padding': 'Отступы',
  'settings.typographerLibrary.lineSpacing': 'Межстрочный интервал',
  'settings.updates.title': 'Обновления',
  'settings.updates.currentVersion': 'Текущая версия',
  'settings.updates.newVersion': 'Новая версия',
  'settings.updates.status': 'Статус',
  'settings.updates.channel': 'Канал',
  'settings.updates.installOnClose': 'Установить при закрытии',
  'settings.updates.policy': 'Политика',
  'settings.updates.mandatory': 'Обязательное',
  'settings.updates.optional': 'Необязательное',
  'settings.updates.lastCheck': 'Последняя проверка',
  'settings.updates.downloadCompleted': 'Загрузка завершена',
  'settings.updates.channelTitle': 'Канал обновлений',
  'settings.updates.stableDesc': 'Протестированные и стабильные выпуски',
  'settings.updates.betaDesc': 'Ранний доступ к функциям',
  'settings.updates.installOnCloseTitle':
    'Установить обновление при закрытии приложения',
  'settings.updates.installOnCloseDesc':
    'Когда пакет уже скачан, установка начнётся автоматически при выходе.',
  'settings.updates.checking': 'Проверка…',
  'settings.updates.checkNow': 'Проверить обновления',
  'settings.updates.download': 'Скачать обновление',
  'settings.autosave.title': 'Автосохранение рабочей области',
  'settings.autosave.description':
    'Управляет автоматическим сохранением локальной рабочей области и интервалом между сохранениями.',
  'settings.autosave.enableTitle': 'Включить автоматическое сохранение',
  'settings.autosave.enableDesc':
    'При включении рабочая область сохраняется локально через заданные интервалы при наличии несохранённых изменений.',
  'settings.autosave.interval': 'Интервал',
  'settings.autosave.save': 'Сохранить автосохранение',
  'settings.shortcuts.title': 'Центр горячих клавиш',
  'settings.shortcuts.description':
    'Официальная настройка горячих клавиш теперь находится на панели управления, в верхней панели. Это предотвращает расхождения между главным экраном и страницей настроек.',
  'settings.shortcuts.whereToEdit': 'Где редактировать',
  'settings.shortcuts.whereToEditDesc':
    'Откройте панель управления и используйте',
  'settings.shortcuts.orPress': 'или нажмите',
  'settings.tabs.ariaLabel': 'Вкладки настроек',
  'settings.integrations.test': 'Тест',
  'settings.integrations.testing': 'Тестирование…',
  'settings.integrations.ok': '✓ OK',
  'settings.integrations.failed': '✗ Ошибка',
  'settings.integrations.saved': '✓ Сохранено',
  'settings.integrations.discord.description':
    'Уведомления об обработке, ошибках и квотах.',
  'settings.integrations.discord.webhookUrl': 'URL вебхука',
  'settings.integrations.discord.webhookPlaceholder':
    'https://discord.com/api/webhooks/…',
  'settings.integrations.discord.botName': 'Имя бота',
  'settings.integrations.discord.webhookActive': 'Вебхук активен',
  'settings.integrations.discord.howToSetup': 'Как настроить',
  'settings.integrations.discord.step1': 'В Discord:',
  'settings.integrations.discord.step1Strong':
    'Настройки сервера → Интеграции → Вебхуки → Новый вебхук',
  'settings.integrations.discord.step2':
    'Скопируйте URL и вставьте в поле выше.',
  'dashboard.dashboardLlm.extraContextPlaceholder':
    'Доп. контекст: персонажи, тон, глоссарий…',
  'dashboard.dashboardLlm.temperature': 'Температура',
  'dashboard.dashboardLlm.topP': 'Top P',
  'dashboard.dashboardLlm.maxTokens': 'Макс. токенов',
  'dashboard.dashboardLlm.translationProfile': 'Профиль перевода',
  'dashboard.dashboardLlm.translationModelPlaceholder': 'gpt-4.1, claude…',
  'dashboard.dashboardLlm.apiKey': 'API-ключ',
  'dashboard.dashboardLlm.apiKeyPlaceholder': 'sk-… (необязательно)',
  'dashboard.dashboardLlm.ocrProfile': 'Профиль OCR',
  'dashboard.dashboardLlm.openAiCompatibleHint':
    'Совместим с OpenAI. Base может быть /v1 или полным эндпоинтом. Некоторые принимают пустой ключ.',
  'dashboard.dashboardLlm.clear': 'Очистить',
  'dashboard.dashboardLlm.use': 'Использовать',
  'dashboard.dashboardLlm.remove': 'Удалить',
  'dashboard.dashboardLlm.save': 'Сохранить',
  'dashboard.dashboardLlm.hdStrategy': 'Стратегия HD',
  'dashboard.dashboardLlm.resize': 'Масштабирование',
  'dashboard.dashboardLlm.crop': 'Обрезка',
  'dashboard.dashboardLlm.original': 'Оригинал',
  'dashboard.dashboardLlm.hdStrategyHint':
    'Стратегия обработки больших изображений перед инпейнтингом.',
  'dashboard.dashboardLlm.resizeLimit': 'Лимит масштабирования',
  'dashboard.dashboardLlm.cropMargin': 'Отступ обрезки',
  'dashboard.dashboardLlm.cropTriggerSize': 'Порог активации обрезки',
  'dashboard.dashboardRegion.title': 'Область',
  'dashboard.dashboardRegion.blocks': 'Блоки',
  'dashboard.dashboardRegion.selection': 'Выделение',
  'dashboard.dashboardRegion.ocr': 'OCR',
  'dashboard.dashboardRegion.translation': 'Перевод',
  'dashboard.dashboardRegion.notes': 'Заметки',
  'dashboard.dashboardRegion.segments': 'Сегменты',
  'dashboard.dashboardRegion.disabled': 'отключено',
  'dashboard.dashboardRegion.manualHint':
    'Перетащите на превью для добавления областей. Используйте углы для изменения размера.',
  'dashboard.dashboardRegion.manualModeHint':
    'Ручной режим для корректировки блоков.',
  'dashboard.dashboardRegion.dockHint':
    'Используйте плавающую панель на холсте для выбора области, очистки и редактирования. Инструменты включаются в зависимости от активного этапа.',
  'dashboard.translator.workspace.ariaLabel': 'Режим переводчика',
  'dashboard.translator.sourceTitle': 'Исходный текст',
  'dashboard.translator.sourceDescription':
    'Вставьте, импортируйте и переведите с сохранением абзацев и переносов строк.',
  'dashboard.translator.sourcePlaceholder':
    'Вставьте сюда главу или отрывок для перевода…',
  'dashboard.translator.sourceAria': 'Исходный текст для перевода',
  'dashboard.translator.import': 'Импорт',
  'dashboard.translator.translating': 'Перевод…',
  'dashboard.translator.translate': 'Перевести',
  'dashboard.translator.editorCleared': 'Редактор очищен.',
  'dashboard.translator.clear': 'Очистить',
  'dashboard.translator.resultTitle': 'Результат',
  'dashboard.translator.resultModelPrefix': 'Модель: {value}',
  'dashboard.translator.resultPlaceholder':
    'Запустите для просмотра результата.',
  'dashboard.translator.resultFieldPlaceholder': 'Перевод появится здесь…',
  'dashboard.translator.resultPlaceholderAria': 'Результат перевода',
  'dashboard.translator.editorDirty':
    'Исходный текст изменён. Запустите повторно для обновления.',
  'dashboard.translator.resultCopied': 'Результат скопирован.',
  'dashboard.translator.copy': 'Копировать',
  'dashboard.translator.downloadTxt': 'Скачать TXT',
  'dashboard.translator.modeLabel': 'Переводчик',
  'dashboard.translator.workspace.textHint':
    'Переводите свободный текст с сохранением абзацев и переносов строк.',
  'dashboard.translator.workspace.visualHint':
    'Обнаруживайте области, распознавайте и переводите блоки на изображениях.',
  'dashboard.translator.processing.standard': 'Стандартный',
  'dashboard.translator.processing.aiSfx': 'ИИ SFX',
  'dashboard.language.source': 'Исходный язык',
  'dashboard.language.target': 'Целевой язык',
  'dashboard.models.title': 'Модели',
  'dashboard.translator.ocr': 'OCR',
  'dashboard.translator.ocr.manageModels': 'Управление моделями OCR',
  'dashboard.translator.noneAvailable': 'Нет моделей',
  'dashboard.translator.device': 'Устройство',
  'dashboard.translator.languages': 'Языки',
  'dashboard.translator.multi': 'мульти',
  'dashboard.translator.noDescription': 'Нет описания.',
  'dashboard.translator.localStatus': 'Локальный статус: {value}',
  'dashboard.translator.sfx.cleanModel': 'SFX-очистка',
  'dashboard.translator.sfx.hint':
    'Например: предпочитать короткие и ударные SFX, быть осторожнее, когда эффект вплетён в тонкую штриховку.',
  'dashboard.translator.llm.contextPlaceholder':
    'Контекст: глоссарий, тон, персонажи…',
  'dashboard.translator.llm.generateNotes': 'Генерировать отдельные ПП',
  'dashboard.translator.llm.multimodalContext':
    'Изображение как мультимодальный контекст',
  'dashboard.translator.llm.temperature': 'Температура',
  'dashboard.translator.llm.topP': 'Top P',
  'dashboard.translator.llm.maxTokens': 'Макс. токенов',
  'dashboard.translator.execute.title': 'Запуск',
  'dashboard.translator.loadImage': 'Загрузить',
  'dashboard.translator.detectTranslate': 'Обнаружить + Перевести',
  'dashboard.translator.retranslateImage': 'Переперевести изображение',
  'dashboard.translator.retranslateRegion': 'Переперевести область',
  'dashboard.translator.regionTitle': 'Область',
  'dashboard.translator.blocks': 'Блоки',
  'dashboard.translator.selection': 'Выделение',
  'dashboard.translator.translation': 'Перевод',
  'dashboard.translator.notes': 'Заметки',
  'dashboard.translator.none': 'нет',
  'dashboard.translator.charactersTranslated': '{count} символ(ов) переведено.',
  'splitter.workspace.emptyTitle': 'Загрузите изображение',
  'splitter.workspace.emptyDescription':
    'Используйте левую панель для импорта страниц. Превью показывает предлагаемые разрезы и сгенерированные сегменты.',
  'splitter.workspace.previewTitle': 'Предпросмотр разрезов',
  'splitter.workspace.previewDescription':
    'Дважды кликните, чтобы добавить разрез. Перетащите линии для корректировки.',
  'splitter.workspace.previewAlt': 'Предпросмотр {name}',
  'splitter.workspace.cutTitle': 'Разрез {index}',
  'splitter.workspace.hide': 'Скрыть',
  'splitter.workspace.show': 'Показать',
  'splitter.workspace.recalculate': 'Пересчитать',
  'splitter.workspace.diagnostics': 'Диагностика',
  'splitter.workspace.engine': 'Движок',
  'splitter.workspace.cuts': 'Разрезы',
  'splitter.workspace.segments': 'Сегменты',
  'splitter.workspace.whitespace': 'Пробелы',
  'splitter.workspace.noWarnings':
    'Нет предупреждений для активного изображения.',
  'splitter.workspace.cutsTitle': 'Разрезы ({count})',
  'splitter.workspace.cutCard': 'Разрез #{index}',
  'splitter.workspace.locked': 'Заблокирован',
  'splitter.workspace.unlocked': 'Разблокирован',
  'splitter.workspace.merge': 'Объединить',
  'splitter.workspace.segmentsTitle': 'Сегменты ({count})',
  'splitter.workspace.segmentAlt': 'Сегмент {index}',
  'splitter.workspace.segmentCard': 'Сегмент #{index}',
  'splitter.workspace.analyzing': 'Анализ…',
  'splitter.workspace.dimensions': 'Размеры',
  'splitter.workspace.axis': 'Ось',
  'splitter.workspace.strategy': 'Стратегия',
  'splitter.sidebar.title': 'Разделитель',
  'splitter.sidebar.recipe': 'Рецепт',
  'splitter.sidebar.preset': 'Пресет',
  'splitter.sidebar.mode': 'Режим',
  'splitter.sidebar.direction': 'Направление',
  'splitter.sidebar.vertical': 'Вертикальное',
  'splitter.sidebar.horizontal': 'Горизонтальное',
  'splitter.sidebar.parts': 'Части',
  'splitter.sidebar.targetHeight': 'Целевая высота',
  'splitter.sidebar.minimum': 'Минимум',
  'splitter.sidebar.maximum': 'Максимум',
  'splitter.sidebar.adjustments': 'Корректировки',
  'splitter.sidebar.overlap': 'Перекрытие ({value}px)',
  'splitter.sidebar.whitespace': 'Пробелы ({value})',
  'splitter.sidebar.noise': 'Шум ({value})',
  'splitter.sidebar.edgeGuard': 'Защита краёв ({value}px)',
  'splitter.sidebar.protectTallBlocks': 'Защитить высокие блоки',
  'splitter.sidebar.baseName': 'Базовое имя',
  'splitter.sidebar.baseNamePlaceholder': 'koma-split',
  'splitter.sidebar.suffix': 'Суффикс',
  'splitter.sidebar.suffixPlaceholder': '{image}-part-{index}',
  'splitter.sidebar.tokensPrefix': 'Токены:',
  'splitter.sidebar.tokensAnd': 'и',
  'splitter.sidebar.actions': 'Действия',
  'splitter.sidebar.imagesCount': '{count} изобр.',
  'splitter.sidebar.activeImage': 'Активное: {name}',
  'splitter.sidebar.selectImage': 'Выберите изображение.',
  'splitter.sidebar.reanalyze': 'Переанализировать',
  'splitter.sidebar.applyToActive': '→ Активное',
  'splitter.sidebar.applyToAll': '→ Все',
  'splitter.sidebar.clearCuts': 'Очистить разрезы',
  'splitter.sidebar.resetRecipe': 'Сбросить рецепт',
  'splitter.sidebar.exportActive': 'Экспорт активного',
  'splitter.sidebar.exportBatch': 'Экспорт пакета',
  'splitter.sidebar.directoryUnavailable': 'showDirectoryPicker недоступен.',
  'splitter.sidebar.exportToFolder': 'Экспорт в папку',
  'stitch.workspace.cancelled': 'Рендеринг склейщика отменён.',
  'stitch.workspace.renderingBatch': 'Рендеринг пакета {current}/{total}...',
  'stitch.workspace.batchReady': 'Пакет {current} готов к скачиванию.',
  'stitch.workspace.generatingZip': 'Генерация {count} пакета(ов) склейщика...',
  'stitch.workspace.zipReady':
    'ZIP-архив с {count} пакетом(ами) успешно сгенерирован.',
  'stitch.workspace.savingToFolder': 'Сохранение {count} пакета(ов) в папку...',
  'stitch.workspace.folderReady': 'Пакеты экспортированы в выбранную папку.',
  'stitch.workspace.folderCancelled': 'Экспорт в папку отменён.',
  'stitch.workspace.noBatchSelected': 'Пакет не выбран',
  'stitch.workspace.previewEyebrow': 'Предпросмотр пакета',
  'stitch.workspace.batchTitle': 'Пакет {current} из {total}',
  'stitch.workspace.noBatchAvailable': 'Нет доступных пакетов',
  'stitch.workspace.imagesCount': '{count} изображение(��)',
  'stitch.workspace.previousBatch': 'Предыдущий пакет',
  'stitch.workspace.nextBatch': 'Следующий пакет',
  'stitch.workspace.zoomOut': 'Уменьшить',
  'stitch.workspace.resetZoom': 'Сбросить масштаб',
  'stitch.workspace.zoomIn': 'Увеличить',
  'stitch.workspace.exporting': 'Экспорт…',
  'stitch.workspace.exportBatch': 'Экспорт пакета',
  'stitch.workspace.zip': 'ZIP',
  'stitch.workspace.folder': 'Папка',
  'stitch.workspace.cancel': 'Отмена',
  'stitch.workspace.emptyTitle': 'Нет готового пакета',
  'stitch.workspace.emptyDescription':
    'Загрузите изображения и настройте пакеты в правой панели инструментов.',
  'stitch.workspace.generatingPreview': 'Генерация предпросмотра {progress}%',
  'stitch.workspace.previewAlt': 'Предпросмотр склеенного пакета',
  'stitch.workspace.errorTitle': 'Ошибка склейщика',
  'stitch.workspace.planningEyebrow': 'Планировани��',
  'stitch.workspace.planningTitle': '{count} пакет(ов) запланировано',
  'stitch.workspace.planningSubtitle':
    'Проверьте тяжёлые пакеты и просмотрите план.',
  'stitch.workspace.baseLabel': 'Основа:',
  'stitch.workspace.batchCardTitle': 'Пакет {index}',
  'stitch.workspace.batchCardDims': '{count} изобр. · {width}×{height}',
  'stitch.workspace.activeBatch': 'Активный пакет',
  'stitch.workspace.stats.images': 'Изображения',
  'stitch.workspace.stats.output': 'Результат',
  'stitch.workspace.stats.size': 'Размер',
  'stitch.workspace.stats.preview': 'Предпросмотр',
  'stitch.workspace.awaiting': 'Ожидание',
  'stitch.workspace.toolboxTitle': 'Панель инструментов',
  'stitch.workspace.toolboxDescription':
    'Настройки и корректировка границ находятся в правой панели.',
  'stitch.sidebar.title': 'Склейщик',
  'stitch.sidebar.layout': 'Макет',
  'stitch.sidebar.layoutMode': 'Режим склейки',
  'stitch.sidebar.vertical': 'Вертикальный',
  'stitch.sidebar.horizontal': 'Горизонтальный',
  'stitch.sidebar.strategy': 'Стратегия',
  'stitch.sidebar.fixedCount': 'Фиксированное количество',
  'stitch.sidebar.targetAxis': 'По оси',
  'stitch.sidebar.single': 'Всё в одном',
  'stitch.sidebar.imagesPerBatch': 'Изображений в пакете',
  'stitch.sidebar.spacing': 'Интервал ({value}px)',
  'stitch.sidebar.alignment': 'Выравнивание',
  'stitch.sidebar.start': 'Начало',
  'stitch.sidebar.center': 'Центр',
  'stitch.sidebar.end': 'Конец',
  'stitch.sidebar.output': 'Результат',
  'stitch.sidebar.background': 'Фон',
  'stitch.sidebar.backgroundColor': 'Цвет фона',
  'stitch.sidebar.baseName': 'Базовое имя',
  'stitch.sidebar.baseNamePlaceholder': 'koma-stitch',
  'stitch.sidebar.imagesInfo':
    '{count} изображение(й). Текущий порядок определяет пакеты.',
  'stitch.sidebar.recalculate': 'Пересчитать пакеты',
  'stitch.sidebar.boundary': 'Граница',
  'stitch.sidebar.boundaryBatch': 'Пакет {current}/{total} · {count} изобр.',
  'stitch.sidebar.noBatch': 'Нет пакета',
  'stitch.sidebar.moveLastToNext': 'Последнее → следующий',
  'stitch.sidebar.pullFromNext': 'Взять из следующего',
  'modelManager.filters.catalog': 'Каталог',
  'modelManager.filters.all': 'Все',
  'modelManager.filters.local': 'Локальные',
  'modelManager.filters.cloud': 'Облако',
  'modelManager.filters.language': 'Язык',
  'modelManager.filters.status': 'Статус',
  'modelManager.filters.installed': 'Установлена',
  'modelManager.filters.notInstalled': 'Не установлена',
  'modelManager.filters.updateAvailable': 'Доступно обновление',
  'modelManager.tooltip.speed.fast': 'Быстрая',
  'modelManager.tooltip.speed.good': 'Хорошая',
  'modelManager.tooltip.speed.excellent': 'Отличная',
  'modelManager.tooltip.allLanguages': 'Все поддерживаемые языки',
  'modelManager.tooltip.infoAria': 'Информация о модели {name}',
  'modelManager.tooltip.info': 'Информация',
  'modelManager.tooltip.aioStage': 'Этап AIO',
  'modelManager.tooltip.description': 'Описание',
  'modelManager.tooltip.languages': 'Языки',
  'modelManager.tooltip.speed.label': 'Скорость',
  'modelManager.tooltip.minimum': 'Минимум',
  'modelManager.tooltip.downloadSize': 'Размер загрузки',
  'modelManager.tooltip.diskSpace': 'Место на диске',
  'modelManager.tooltip.version': 'Версия',
  'modelManager.status.installed': 'Установлена',
  'modelManager.status.updateAvailable': 'Доступно обновление',
  'modelManager.status.downloading': 'Скачивание',
  'modelManager.status.queued': 'В очереди',
  'modelManager.status.verifying': 'Проверка',
  'modelManager.status.failed': 'Ошибка',
  'modelManager.status.cancelled': 'Отменено',
  'modelManager.status.incomplete': 'Не завершено',
  'modelManager.status.notInstalled': 'Не установлена',
  'modelManager.actions.selected': 'Выбрана',
  'modelManager.actions.useModel': 'Использовать модель',
  'modelManager.actions.uninstall': 'Удалить',
  'modelManager.actions.update': 'Обновить',
  'modelManager.actions.retry': 'Повторить',
  'modelManager.actions.install': 'Установить',
  'modelManager.actions.source': 'Источник',
  'modelCard.status.selected': 'Выбрана',
  'modelCard.status.failed': 'Ошибка',
  'modelCard.status.verifying': 'Проверка…',
  'modelCard.status.queued': 'В очереди…',
  'modelCard.status.downloading': 'Скачивание…',
  'modelCard.status.cancelled': 'Отменено',
  'modelCard.status.incomplete': 'Не завершено',
  'modelCard.status.notInstalled': 'Не установлена',
  'modelCard.action.cancel': 'Отмена',
  'modelCard.action.remove': 'Удалить',
  'modelCard.action.update': 'Обновить',
  'modelCard.action.install': 'Установить',
  'modelCard.action.retry': 'Повторить',
  'modelCard.action.active': 'Активна',
  'modelCard.action.use': 'Использовать',
  'modelManager.stage.translate': 'Получение переводов',
  'modelManager.installAll.attention': 'Внимание',
  'modelManager.installAll.warning':
    'Вы собираетесь скачать ВСЕ модели перевода.',
  'modelManager.installAll.totalSize': 'Общий размер: {size}',
  'modelManager.installAll.space': 'Доступное место: {space}',
  'modelManager.installAll.time':
    'Ориентировочное время: зависит от вашего подключения',
  'modelManager.installAll.notEnoughSpace':
    'Недостаточно места. Требуется: {required} | Доступно: {available}',
  'modelManager.installAll.confirm':
    'Это может занять много времени и использовать значительное количество дискового пространства. Продолжить?',
  'modelManager.installAll.confirmDownload': 'Подтвердить загрузку',
  'modelManager.disk.notVerified': 'Диск не проверен',
  'modelManager.disk.free': '{space} свободно',
  'modelManager.disk.models': '{installed}/{total} моделей ({size})',
  'modelManager.enhance.title': 'Модели улучшения',
  'modelManager.enhance.description':
    'Эксклюзивный локальный каталог для улучшения. Установка, обновление, удаление или импорт ONNX.',
  'modelManager.enhance.freeSpace': 'Свободное место',
  'modelManager.enhance.notChecked': 'не проверено',
  'modelManager.enhance.closeAria': 'Закрыть окно моделей улучшения',
  'modelManager.enhance.directInstall': 'Прямая установка',
  'modelManager.enhance.directInstallDesc':
    'Подобранные модели с прямой загрузкой или управляемой установкой на мини-бэкенде.',
  'modelManager.enhance.manualImport': 'Ручной импорт',
  'modelManager.enhance.manualImportDesc':
    'Модели из каталога, загружаемые через локальный ONNX. Используйте внешнюю конвертацию, если доступен только `.pth`.',
  'modelManager.enhance.importOnnxBadge': 'Импорт ONNX',
  'modelManager.enhance.statusLabel': 'Статус',
  'modelManager.enhance.estimatedDisk': 'Ориентировочный объём',
  'modelManager.enhance.reimportOnnx': 'Переимпортировать ONNX',
  'modelManager.enhance.pthHint': 'Для весов в формате',
  'modelManager.enhance.pthHintSuffix':
    'сначала конвертируйте в ONNX, затем используйте ручной импорт.',
  'common.yes': 'Да',
  'dashboard.organize.hint.reorder':
    'Перетаскивайте и меняйте порядок файлов в левой панели.',
  'dashboard.organize.hint.rotate':
    'Используйте кнопку вращения для исправления горизонтально отсканированных страниц.',
  'guides.common.beginner': 'Начинающий',
  'guides.common.intermediate': 'Средний',
  'guides.common.advanced': 'Продвинутый',
  'guides.home.title': 'Руководства и обучение',
  'guides.home.description':
    'Научитесь мастерски владеть каждым инструментом KŌMA Studio с пошаговыми руководствами, советами по продуктивности и реальными примерами.',
  'guides.home.searchPlaceholder':
    'Поиск руководств, горячих клавиш, советов...',
  'guides.home.searchAria': 'Поиск руководств',
  'guides.home.continueReading': 'Продолжить с того места, где остановились',
  'guides.home.stepProgress': 'Шаг {current} из {total} · {time}',
  'guides.home.continueCta': 'Продолжить →',
  'guides.home.categories': 'Категории',
  'guides.home.guidesCountLabel': 'руководств{suffix}',
  'guides.home.completedCountLabel': 'завершено{suffix}',
  'guides.home.guidesPluralSuffix': '',
  'guides.home.saved': 'Сохранённые ({count})',
  'guides.reader.backToGuides': 'Назад к руководствам',
  'guides.reader.notFound': 'Руководство не найдено',
  'guides.reader.progressAria': 'Прогресс руководства',
  'guides.reader.stepsAria': 'Шаги руководства',
  'guides.reader.stepLabel': 'Шаг {index}',
  'guides.reader.recent': 'Недавние',
  'guides.reader.guides': 'Руководства',
  'guides.reader.removeBookmark': 'Удалить закладку',
  'guides.reader.saveBookmark': 'Сохранить закладку',
  'guides.reader.previous': 'Назад',
  'guides.reader.next': 'Далее',
  'guides.reader.completeGuide': 'Завершить руководство',
  'guides.detail.back': 'Назад',
  'guides.detail.notFound': 'Руководство не найдено.',
  'guides.detail.stepsAria': 'Шаги руководства',
  'guides.detail.stepLabel': 'Шаг {index}',
  'guides.detail.recent': 'Недавние',
  'guides.detail.guides': 'Руководства',
  'guides.detail.stepCounter': 'Шаг {current} из {total}',
  'guides.detail.previous': 'Назад',
  'guides.detail.next': 'Далее',
  'guides.detail.complete': 'Завершить',
  'guides.detail.completed': 'Завершено ✓',
  'guides.detail.tocAria': 'Содержание',
  'guides.detail.inThisGuide': 'В этом руководстве',
  'guides.detail.removeFavorite': 'Удалить из избранного',
  'guides.detail.addFavorite': 'Добавить в избранное',
  'guides.detail.saved': 'Сохранено',
  'guides.detail.save': 'Сохранить',
  'guides.step.copyCode': 'Копировать код',
  'guides.step.copied': 'Скопировано',
  'guides.step.copy': 'Копировать',
  'guides.search.dialogAria': 'Поиск руководств',
  'guides.search.placeholder': 'Поиск руководств, горячих клавиш, советов...',
  'guides.search.inputAria': 'Поиск',
  'guides.search.close': 'Закрыть поиск',
  'guides.search.noResults': 'Нет результатов по запросу «{query}»',
  'guides.search.results': 'Результаты ({count})',
  'guides.search.recent': 'Недавние',
  'guides.search.navigate': 'навигация',
  'guides.search.open': 'открыть',
  'guides.search.closeVerb': 'закрыть',
  'guides.category.searchPlaceholder': 'Поиск в «{category}»...',
  'guides.category.searchAria': 'Поиск в «{category}»',
  'guides.category.noSearchResults':
    'Руководства по запросу «{query}» не найдены',
  'guides.category.noGuides': 'В этой категории нет руководств',
  'guides.category.tryOtherTerms': 'Попробуйте другие поисковые запросы.',
  'guides.category.comingSoon':
    'Новые руководства будут добавлены в ближайшее время.',
  'guides.category.completed': 'Завершено',
  'settings.profile.title': 'Профиль пользователя',
  'settings.profile.name': 'Имя',
  'settings.profile.email': 'Электронная почта',
  'settings.profile.verification': 'Верификация',
  'settings.profile.accountId': 'ID аккаунта',
  'settings.profile.environment': 'Окружение',
  'settings.profile.unspecified': 'Не указано',
  'settings.profile.verified': 'Подтверждена',
  'settings.profile.pending': 'Ожидание',
  'settings.profile.sendVerification': 'Отправить письмо для верификации',
  'settings.profile.legalCenter': 'Юридический центр',
  'settings.travel.title': 'Удалённый доступ',
  'settings.travel.description':
    'Временно авторизуйте дополнительный компьютер без переключения основного устройства, привязанного к аккаунту.',
  'settings.travel.destination': 'Получатель токена',
  'settings.travel.expiry': 'Срок действия кода',
  'settings.travel.temporaryAccess': 'Временный доступ',
  'settings.travel.streamLike':
    'Процесс, вдохновлённый стриминговыми платформами',
  'settings.travel.streamLikeDesc':
    'Код отправляется на почту аккаунта и предоставляет временный доступ на другом ПК.',
  'settings.travel.sendToken': 'Отправить токен на мою почту',
  'settings.travel.destinationPrefix': 'Получатель: {value}',
  'settings.travel.expirationPrefix': 'Истекает: {value}',
  'settings.travel.accessPrefix': 'Доступ: {value}',
  'settings.travel.definedOnSend': 'Определяется при отправке',
  'settings.plan.day': 'день',
  'settings.plan.days': 'дней',
  'settings.typography.default': 'По умолчанию',
  'settings.typography.bindingsTitle': 'Привязки по обнаруженному режиму',
  'settings.typography.useDefault': 'Использовать по умолчанию',
  'settings.integrations.blogger.description':
    'Хранилище/CDN для изображений и публикация постов.',
  'settings.integrations.blogger.label': 'Метка',
  'settings.integrations.blogger.labelPlaceholder': 'Основной Blogger',
  'settings.integrations.blogger.blogId': 'ID блога',
  'settings.integrations.blogger.blogIdPlaceholder': 'Числовой ID',
  'settings.integrations.blogger.clientId': 'Client ID',
  'settings.integrations.blogger.clientIdPlaceholder': 'Google OAuth Client ID',
  'settings.integrations.blogger.clientSecret': 'Client Secret',
  'settings.integrations.blogger.clientSecretPlaceholder':
    'OAuth Client Secret',
  'settings.integrations.blogger.refreshToken': 'Refresh Token',
  'settings.integrations.blogger.refreshTokenPlaceholder': 'Refresh Token',
  'settings.integrations.blogger.defaultLabels': 'Метки по умолчанию',
  'settings.integrations.blogger.defaultLabelsPlaceholder':
    'manga, chapter, release',
  'settings.integrations.blogger.optimizer': 'Оптимизатор',
  'settings.integrations.blogger.optimizerCloudinary': 'Cloudinary Fetch',
  'settings.integrations.blogger.optimizerTemplate': 'Шаблон URL',
  'settings.integrations.blogger.cloudName': 'Cloud Name',
  'settings.integrations.blogger.urlTemplate': 'Шаблон URL',
  'settings.integrations.blogger.cloudNamePlaceholder': 'my-cloud-name',
  'settings.integrations.blogger.cloudinaryTransformation':
    'Трансформация Cloudinary',
  'settings.integrations.blogger.optimizerEnabled': 'Оптимизатор активен',
  'settings.integrations.blogger.maxWidth': 'Макс. ширина',
  'settings.integrations.blogger.maxHeight': 'Макс. высота',
  'settings.integrations.blogger.testConnection': 'Проверить соединение',
  'settings.integrations.blogger.requestsPerDay': 'Запросов/день',
  'settings.integrations.blogger.requestsPerUser': 'Запросов/пользователь',
  'settings.integrations.blogger.credentialsGuideTitle':
    'Как получить учётные данные',
  'settings.integrations.blogger.step1': 'Перейдите в',
  'settings.integrations.blogger.step1Suffix': 'создайте или выберите проект.',
  'settings.integrations.blogger.step2': 'Включите',
  'settings.integrations.blogger.step2And': 'и',
  'settings.integrations.blogger.step3': 'Создайте',
  'settings.integrations.blogger.webApplication': 'Веб-приложение',
  'settings.integrations.blogger.step4': 'Добавьте',
  'settings.integrations.blogger.step4Suffix': 'в URI перенаправления.',
  'settings.integrations.blogger.step5': 'Скопируйте',
  'settings.integrations.blogger.step5And': 'и',
  'settings.integrations.blogger.step6':
    'Настройте экран согласия OAuth. Если в режиме тестирования, добавьте свою почту.',
  'settings.integrations.blogger.step7': 'В',
  'settings.integrations.blogger.step7Suffix':
    'включите собственные учётные данные и авторизуйте области Blogger + Drive.',
  'settings.integrations.blogger.step8': 'Выполните',
  'settings.integrations.blogger.step8Suffix': 'и скопируйте',
  'settings.integrations.blogger.step9': 'Для Cloudinary скопируйте',
  'settings.integrations.blogger.step9Suffix': 'и настройте трансформацию.',
  'settings.integrations.blogger.step10': 'Найдите',
  'settings.integrations.blogger.step10Suffix': 'через URL/API Blogger.',
  'settings.integrations.blogger.step11':
    'Сохраните всё, проверьте соединение и используйте утилиту на панели управления.',
  'settings.integrations.blogger.googleQuotas': 'Квоты Google',
  'settings.integrations.blogger.oauthPlayground': 'OAuth Playground',
  'settings.integrations.blogger.cloudinaryFetch': 'Cloudinary Fetch',
  'settings.integrations.blogger.driveScopes': 'Области Drive',
  'settings.integrations.blogger.driveScopesGuideTitle':
    'Области Drive в OAuth Playground',
  'settings.integrations.blogger.minimumPractical': 'Практический минимум:',
  'settings.integrations.blogger.driveScopesNote':
    'Ознакомьтесь с официальной документацией Drive API v3 для дополнительных областей.',
  'settings.integrations.imgur.title': 'Загрузка на Imgur',
  'settings.integrations.imgur.description':
    'Анонимная загрузка с ротацией Client ID и консервативным ограничением запросов.',
  'settings.integrations.imgur.limitPerHour': 'Лимит/час',
  'settings.integrations.imgur.batchDelay': 'Задержка пакета (мс)',
  'settings.integrations.imgur.remaining': 'Осталось',
  'settings.integrations.imgur.used': 'Использовано: {used}/{limit}',
  'settings.integrations.imgur.reset': 'сброс: {value}',
  'settings.integrations.imgur.clientIds': 'Client ID',
  'settings.integrations.imgur.noClientIds': 'Client ID не настроены.',
  'settings.integrations.imgur.clientIdPlaceholder': 'Imgur Client ID',
  'settings.integrations.imgur.quickGuideTitle': 'Краткое руководство по Imgur',
  'settings.integrations.imgur.step1':
    'Создайте приложение на панели разработчика Imgur и скопируйте',
  'settings.integrations.imgur.step2':
    'Добавьте один или несколько Client ID. Приложение выбирает случайный.',
  'settings.integrations.imgur.step3': 'Анонимная загрузка с',
  'settings.integrations.imgur.step3Suffix': 'Без OAuth.',
  'settings.integrations.imgur.step4': 'Консервативный лимитер:',
  'settings.integrations.imgur.step4Suffix': 'для избежания блокировок.',
  'settings.integrations.imgur.step5':
    'Последовательная загрузка с учётом настроенной задержки.',
  'settings.integrations.imgur.step6':
    'Imgur не следует рассматривать как гарантированный CDN.',
  'settings.integrations.imgur.imageApi': 'Imgur Image API',
  'settings.integrations.imgur.uploading': 'Загрузка на Imgur',
  'common.add': 'Добавить',
  'common.label': 'Метка',
  'common.original': 'Оригинал',
  'common.quality': 'Качество',
  'common.persistence': 'Хранение',
  'common.secureStore': 'Защищённое хранилище',
  'common.browserFallback': 'Резервное хранилище браузера',
  'common.notAvailableShort': '—',
  'common.loading': 'Загрузка',
  'common.sending': 'Отправка…',
  'common.single': 'Одиночный',
  'common.tile': 'Плитка',
  'common.grid': 'Сетка',
  'common.smart': 'Умный',
  'common.multi': 'Мульти',
  'blogger.title': 'Blogger CDN',
  'blogger.heroTitle': 'Публикация и хостинг изображений на Blogger',
  'blogger.heroDescription':
    'Режим публикации для постов с визуальным/HTML-редактором. Режим загрузки для генерации размещённых URL.',
  'blogger.ready': 'Готово',
  'blogger.configureInSettings': 'Настроить в настройках',
  'blogger.publishTab': 'Публикация',
  'blogger.uploadTab': 'Загрузка',
  'blogger.settings': 'Настройки',
  'blogger.missingConfigTitle': 'Конфигурация отсутствует',
  'blogger.missingConfigBody':
    'Сохраните учётные данные в настройках перед использованием.',
  'blogger.post.title': 'Пост',
  'blogger.post.description': 'Заголовок, метки и публикация.',
  'blogger.post.postTitle': 'Заголовок',
  'blogger.post.postTitlePlaceholder': 'Заголовок поста',
  'blogger.post.defaultLabels': 'Метки по умолчанию',
  'blogger.post.defaultLabelsPlaceholder': 'manga, chapter',
  'blogger.post.postLabels': 'Метки поста',
  'blogger.post.postLabelsPlaceholder': 'review',
  'blogger.post.publishNow': 'Опубликовать сейчас',
  'blogger.post.draft': 'Черновик',
  'blogger.post.publish': 'Опубликовать',
  'blogger.post.status.draft': 'сохранён как черновик',
  'blogger.post.status.published': 'опубликован',
  'blogger.template.title': 'Новый пост Blogger',
  'blogger.template.description':
    'Напишите содержимое поста. Можно переключаться между визуальным, HTML и предпросмотром.',
  'blogger.template.insertPrefix': 'Используйте кнопку',
  'blogger.template.insertSuffix':
    'для загрузки файлов в Blogger и вставки размещённых URL в содержимое.',
  'blogger.editor.title': 'Редактор',
  'blogger.editor.description': 'Визуальный, HTML и предпросмотр.',
  'blogger.editor.visual': 'Визуальный',
  'blogger.editor.preview': 'Предпросмотр',
  'blogger.editor.h1': 'H1',
  'blogger.editor.h2': 'H2',
  'blogger.editor.bold': 'Жирный',
  'blogger.editor.italic': 'Курсив',
  'blogger.editor.underline': 'Подчёркнутый',
  'blogger.editor.list': 'Список',
  'blogger.editor.numbered': 'Нумерованный',
  'blogger.editor.quote': 'Цитата',
  'blogger.editor.link': 'Ссылка',
  'blogger.editor.promptUrl': 'URL',
  'blogger.editor.insertImages': 'Вставить изображения',
  'blogger.copied': 'Скопировано',
  'blogger.loadConfigFailed': 'Не удалось загрузить конфигурацию Blogger.',
  'blogger.imageInsertedSingle':
    'Изображение размещено на Blogger и вставлено в редактор.',
  'blogger.imageInsertedMany':
    '{count} изображений размещено на Blogger и вставлено в редактор.',
  'blogger.uploadFailed': 'Не удалось загрузить изображения на Blogger.',
  'blogger.batchUploadSingle': 'Загрузка завершена в одном черновике Blogger.',
  'blogger.batchUploadMany':
    '{count} изображений загружено в одном черновике Blogger.',
  'blogger.uploadFailedShort': 'Загрузка не удалась.',
  'blogger.batchUploadSuccessSingle':
    'Загрузка завершена в одном черновике Blogger.',
  'blogger.batchUploadSuccessMany':
    '{count} изображений загружено в одном черновике Blogger.',
  'blogger.publishSuccessWithUrl': 'Пост {verb} на Blogger. URL: {url}',
  'blogger.publishSuccessWithId': 'Пост {verb} на Blogger с ID {id}.',
  'blogger.publishFailed': 'Не удалось опубликовать на Blogger.',
  'blogger.uploadSection.title': 'Пакетная загрузка',
  'blogger.uploadSection.description':
    'Перетащите изображения для генерации размещённых URL.',
  'blogger.uploadSection.dropTitle': 'Перетащите изображения сюда',
  'blogger.uploadSection.dropDescription':
    'PNG, JPG, WebP с локальной предобработкой.',
  'blogger.uploadSection.optimizedUrl': 'Оптимизированный URL',
  'blogger.uploadSection.optimizedUrlDesc':
    'Генерирует оптимизированный URL перед загрузкой.',
  'blogger.uploadSection.exportOptimized': 'Экспорт оптимизированных',
  'blogger.uploadSection.exportOptimizedDesc':
    'Использует оптимизированный URL в пакетных действиях.',
  'blogger.uploadSection.outputImg': 'Вывод <img>',
  'blogger.uploadSection.outputImgDesc': 'HTML-фрагменты вместо URL.',
  'blogger.uploadSection.select': 'Выбрать',
  'blogger.uploadSection.send': 'Отправить',
  'blogger.uploadSection.exported': 'Экспортировано',
  'blogger.queue.title': 'Очередь',
  'blogger.queue.items': '{count} элемент(ов)',
  'blogger.queue.empty': 'Нет файлов.',
  'blogger.queue.altText': 'Альтернативный текст',
  'blogger.queue.canonical': 'Канонически��',
  'blogger.queue.optimized': 'Оптимизированный',
  'blogger.queue.url': 'URL',
  'blogger.queue.opt': 'Опт',
  'blogger.queue.img': 'img',
  'common.remove': 'Удалить',
  'ranking.backToDashboard': 'Вернуться на панель управления',
  'ranking.hero.title': 'Рейтинг моделей',
  'ranking.hero.subtitle':
    'Сравните официальные модели с реальными отзывами сообщества — качество, скорость, соотношение цена/качество и простота использования.',
  'ranking.hero.globalStatsAria': 'Глобальная статистика',
  'ranking.hero.models': 'Модели',
  'ranking.hero.reviews': 'Отзывы',
  'ranking.hero.bestOverall': 'Лучшая общая',
  'ranking.hero.costBenefit': 'Выгодная',
  'ranking.loading': 'Обновление рейтинга…',
  'legalHub.back': 'Назад',
  'legalHub.sidebarTitle': 'Юридический центр',
  'legalHub.supportDescription':
    'Обращения по вопросам поддержки, конфиденциальности и запросов субъектов данных следует направлять через официальный канал, указанный в приложении/на сайте.',
  'legalHub.supportCta': 'Открыть канал поддержки',
  'legalHub.noticeTitle': 'Важное уведомление.',
  'dashboard.dashboardExecute.selectImage':
    'Выберите изображение для выполнения.',
  'dashboard.dashboardExecute.runCurrentStage':
    'Запустить текущий этап для изображения.',
  'dashboard.dashboardExecute.rerunStage': 'Перезапустить этап',
  'dashboard.dashboardExecute.runStage': 'Запустить этап',
  'dashboard.dashboardExecute.runAio': 'Запустить AIO',
  'dashboard.dashboardExecute.stop': 'Остановить выполнение',
  'freeProviderCard.stage.translation': 'Перевод',
  'freeProviderCard.stage.ocr': 'OCR',
  'freeProviderCard.stage.clean': 'Очистка',
  'freeProviderCard.badge.integrated': 'Интегрированный',
  'freeProviderCard.badge.catalog': 'Каталог',
  'freeProviderCard.verifiedAt': 'проверено',
  'freeProviderCard.tooltip.selectedModel': 'Выбранная модель',
  'freeProviderCard.tooltip.notSelected': '(не выбрана)',
  'freeProviderCard.tooltip.notDefined': '(не задана)',
  'freeProviderCard.tooltip.apiKeyConfigured': 'Настроен',
  'freeProviderCard.tooltip.apiKeyRequired': 'Требуется (ожидание)',
  'freeProviderCard.tooltip.apiKeyOptional': 'Необязательный (пусто)',
  'freeProviderCard.tooltip.extraFields': 'Дополнительные поля',
  'freeProviderCard.tooltip.modelsInStage': 'Модели на этом этапе',
  'freeProviderCard.tooltip.empty': '(пусто)',
  'freeProviderCard.label.model': 'Модель',
  'freeProviderCard.label.apiBase': 'Базовый URL API',
  'freeProviderCard.label.apiKey': 'API-ключ',
  'freeProviderCard.label.required': '(обязательно)',
  'freeProviderCard.label.optional': '(необязательно)',
  'freeProviderCard.placeholder.apiKey': 'Вставьте ваш ключ сюда',
  'freeProviderCard.status.activeProfile': 'Активный профиль:',
  'freeProviderCard.status.catalogOnlyWarning':
    'Этот провайдер доступен только в каталоге в v1.',
  'freeProviderCard.action.save': 'Сохранить',
  'freeProviderCard.action.use': 'Использовать',
  'customProvider.field.name': 'Имя',
  'customProvider.field.model': 'Модель',
  'customProvider.field.apiBase': 'Базовый URL API',
  'customProvider.field.apiKey': 'API-ключ',
  'customProvider.placeholder.noKey': '(без ключа)',
  'customProvider.placeholder.pasteKey': 'Вставьте ваш ключ сюда',
  'customProvider.status.active': 'Активный профиль в конвейере',
  'customProvider.action.cancel': 'Отмена',
  'customProvider.action.saving': 'Сохранение...',
  'customProvider.action.save': 'Сохранить',
  'customProvider.action.edit': 'Редактировать',
  'customProvider.action.delete': 'Удалить',
  'customProvider.badge.customProfile': 'Пользовательский профиль',
  'freeProviderCard.status.integrated': 'Интегрированный',
  'freeProviderCard.status.catalog': 'Каталог',
  'freeProviderCard.status.verifiedAt': 'проверено',
  'freeProviderCard.info.label': 'Информация',
  'freeProviderCard.info.tooltip': 'Информация о {name}',
  'freeProviderCard.info.selectedModel': 'Выбранная модель:',
  'freeProviderCard.info.notSelected': '(не выбрана)',
  'freeProviderCard.info.modelId': 'ID модели:',
  'freeProviderCard.info.notDefined': '(не задан)',
  'freeProviderCard.info.apiBase': 'Базовый URL API:',
  'freeProviderCard.info.apiKey': 'API-ключ:',
  'freeProviderCard.info.configured': 'Настроен',
  'freeProviderCard.info.required': 'Требуется (ожидание)',
  'freeProviderCard.info.optional': 'Необязательный (пусто)',
  'freeProviderCard.info.extraFields': 'Дополнительные поля:',
  'freeProviderCard.info.setup': 'Настройка:',
  'freeProviderCard.info.limits': 'Лимиты:',
  'freeProviderCard.info.rateLimits': 'Ограничения запросов:',
  'freeProviderCard.info.modelsInStage': 'Модели на этом этапе:',
  'freeProviderCard.field.model': 'Модель',
  'freeProviderCard.field.apiBase': 'Базовый URL API',
  'freeProviderCard.field.apiBaseTitle':
    'Фиксированн��й базовый URL API для этого провайдера в v1',
  'freeProviderCard.field.required': '(обязательно)',
  'freeProviderCard.field.optional': '(необязательно)',
  'freeProviderCard.field.apiKeyPlaceholder': 'Вставьте ваш ключ сюда',
  'freeProviderCard.status.catalogOnly':
    'Этот провайдер доступен только в каталоге в v1.',
  'freeProviderCard.actions.save': 'Сохранить',
  'freeProviderCard.actions.use': 'Использовать',
  'freeProviderCard.empty': '(пусто)',
  'customProvider.action.use': 'Использовать',
  'typo.tag': 'Наборщик',
  'typo.session.title': 'Сессия',
  'typo.session.image': 'Изображение:',
  'typo.session.selection': 'Выделение:',
  'typo.session.none': 'нет',
  'typo.tools.aria': 'Инструменты формы',
  'typo.tools.select': 'Выбор',
  'typo.tools.rect': 'Прямоугольная',
  'typo.tools.ellipse': 'Эллиптическая',
  'typo.actions.refine': 'Доработка',
  'typo.actions.toRect': '→ Прямоугольная',
  'typo.actions.toEllipse': '→ Эллиптическая',
  'typo.actions.duplicate': 'Дублировать',
  'typo.actions.delete': 'Удалить выделение',
  'typo.presets.title': 'Пресеты',
  'typo.presets.active': 'Активный пресет',
  'typo.presets.none': 'Нет пресета',
  'typo.presets.applySelection': '→ Выделение',
  'typo.presets.applyImage': '→ Изображение',
  'typo.snapshots.title': 'Снимки',
  'typo.snapshots.hint':
    'Сохраните текущее состояние для восстановления позже.',
  'typo.snapshots.placeholder': 'Имя снимка',
  'typo.snapshots.save': 'Сохранить снимок',
  'typo.snapshots.select': 'Выбрать…',
  'typo.snapshots.restore': 'Восстановить',
  'typo.queue.title': 'Очередь текста',
  'typo.queue.editorPlaceholder': 'Вставьте строки, по одной на баллон…',
  'typo.queue.editorAria': 'Редактор текста очереди',
  'typo.queue.build': 'Собрать очередь',
  'typo.queue.import': 'Импорт',
  'typo.queue.applySelected': 'Применить элемент',
  'typo.queue.next': 'Далее',
  'typo.queue.clear': 'Очистить',
  'typo.queue.multiBubble': 'Мульти-баллон',
  'typo.queue.listAria': 'Типографическая очередь',
  'typo.queue.emptyTitle': 'Очередь пуста',
  'typo.queue.emptyDesc':
    'Одна строка на баллон для построения последовательности.',
  'typo.queue.statusApplied': 'Применено',
  'typo.queue.statusSkipped': 'Пропущено',
  'typo.queue.statusPending': 'Ожидание',
  'modelDetail.empty':
    'Выберите модель в рейтинге, чтобы увидеть подробности и отзывы.',
  'modelDetail.source.local': 'Локальная',
  'modelDetail.source.cloud': 'Облако',
  'modelDetail.score.aria': 'Общая оценка: {score}',
  'modelDetail.score.label': 'Оценка',
  'modelDetail.reviews.count_one': '{count} отзыв',
  'modelDetail.reviews.count_other': '{count} отзывов',
  'modelDetail.trend.up': '+{trend} б. (30д)',
  'modelDetail.trend.down': '{trend} б. (30д)',
  'modelDetail.trend.neutral': 'Нейтральный тренд',
  'modelDetail.metrics.quality': 'Качество',
  'modelDetail.metrics.speed': 'Скорость',
  'modelDetail.metrics.costBenefit': 'Цена/качество',
  'modelDetail.metrics.easeOfUse': 'Простота использования',
  'modelDetail.distro.title': 'Распределение оценок',
  'modelDetail.distro.lastReview': 'Последний отзыв: {date}',
  'modelDetail.info.title': 'Технический контекст',
  'modelDetail.info.noNotes': 'Нет дополнительных заметок для этой модели.',
  'modelDetail.info.source': 'Исходный',
  'modelDetail.info.target': 'Целевой',
  'modelDetail.actions.editReview': 'Редактировать отзыв',
  'modelDetail.actions.startReview': 'Оставить отзыв',
  'modelDetail.actions.sending': 'Отправка…',
  'modelDetail.actions.verifyEmail': 'Подтвердить почту',
  'modelDetail.warning.verifyEmail':
    'Подтвердите почту, чтобы публиковать или редактировать отзывы.',
  'modelDetail.recentReviews.title': 'Последние отзывы',
  'modelDetail.recentReviews.loading': 'Загрузка…',
  'modelDetail.recentReviews.empty':
    'Эта модель ещё не получила публичных отзывов.',
  'modelDetail.pagination.prev': 'Назад',
  'modelDetail.pagination.next': 'Далее',
  'modelDetail.usage.balanced': 'Сбалансиров��нный',
  'modelDetail.usage.quality_first': 'Качество',
  'modelDetail.usage.speed_first': 'Скорость',
  'modelDetail.usage.low_vram': 'Мало VRAM',
  'modelDetail.usage.offline_local': 'Локальный',
  'modelDetail.usage.cloud_pipeline': 'Облако',
  'resources.empty.title.withQuery': 'Нет результатов по запросу «{query}»',
  'resources.empty.title.noQuery': 'Элементы не найдены',
  'resources.empty.desc.withQuery':
    'Попробуйте другие слова или сбросьте фильтры для поиска {context}.',
  'resources.empty.desc.noQuery':
    'Настройте фильтры для просмотра доступных {context}.',
  'resources.fonts.license.free': 'Бесплатная',
  'resources.fonts.license.openSource': 'Открытый код',
  'resources.fonts.license.commercial': 'Коммерческая',
  'resources.fonts.license.mixed': 'Смешанная',
  'resources.fonts.context': 'шрифтов',
  'resources.fonts.placeholder': 'Введите текст для предпросмотра шрифтов...',
  'resources.fonts.results_one': 'шрифт найден',
  'resources.fonts.results_other': 'шрифтов найдено',
  'resources.fonts.previewFallback': 'Не могу поверить!',
  'resources.fonts.sizeAria': 'Предпросмотр при {size}px',
  'resources.sfx.category.impact': 'Удары',
  'resources.sfx.category.emotion': 'Эмоции',
  'resources.sfx.category.ambient': 'Фон',
  'resources.sfx.category.action': 'Действие',
  'resources.sfx.category.voice': 'Голос',
  'resources.sfx.category.misc': 'Разное',
  'resources.sfx.filterAria': 'Фильтр по категории',
  'resources.sfx.filterAll': 'Все ({count})',
  'resources.sfx.results_one': 'звуковой эффект',
  'resources.sfx.results_other': 'звуковых эффектов',
  'resources.sfx.context': 'звуковых эффектов',
  'resources.sfx.copyAria': 'Копировать «{text}»',
  'resources.communities.platform.forum': 'Форум',
  'resources.communities.results_one': 'сообщество',
  'resources.communities.results_other': 'сообществ',
  'resources.communities.context': 'сообществ',
  'resources.communities.visitAria': 'Посетить {name} во внешнем браузере',
  'resources.communities.visit': 'Перейти',
  'resources.tools.category.editing': 'Редактирование',
  'resources.tools.category.ocr': 'OCR',
  'resources.tools.category.translation': 'Перевод',
  'resources.tools.category.fonts': 'Шрифты',
  'resources.tools.category.hosting': 'Хостинг',
  'resources.tools.category.utility': 'Утилиты',
  'resources.tools.filterAll': 'Все',
  'resources.tools.results_one': 'инструмент',
  'resources.tools.results_other': 'инструментов',
  'resources.tools.context': 'инструментов',
  'resources.tools.free.yes': 'Бесплатно',
  'resources.tools.free.no': 'Платно',
  'resources.tools.action.open': 'Открыть',
  'resources.tools.action.download': 'Скачать',
  'feed.roles.raw': 'Поставщик исходников',
  'feed.roles.cl': 'Клинер',
  'feed.roles.rd': 'Перерисовщик',
  'feed.roles.tl': 'Переводчик',
  'feed.roles.pr': 'Редактор',
  'feed.roles.ts': 'Наборщик',
  'feed.roles.qc': 'Контролёр качества',
  'feed.contact.discord': 'Discord',
  'feed.contact.twitter_x': 'Twitter/X',
  'feed.contact.telegram': 'Telegram',
  'feed.contact.email': 'Электронная почта',
  'feed.contact.whatsapp': 'WhatsApp',
  'feed.contact.instagram': 'Instagram',
  'feed.contact.placeholder.discord':
    'https://discord.gg/... или имя пользователя',
  'feed.contact.placeholder.twitter_x':
    'имя пользователя или https://x.com/username',
  'feed.contact.placeholder.telegram': 'https://t.me/... или @канал',
  'feed.contact.placeholder.email': 'contact@scanlation.com',
  'feed.contact.placeholder.whatsapp': '+1 555 123-4567 или ссылка',
  'feed.contact.placeholder.instagram':
    'имя пользователя или https://instagram.com/username',
  'feed.weekdays.seg': 'Пн',
  'feed.weekdays.ter': 'Вт',
  'feed.weekdays.qua': 'Ср',
  'feed.weekdays.qui': 'Чт',
  'feed.weekdays.sex': 'Пт',
  'feed.weekdays.sab': 'Сб',
  'feed.weekdays.dom': 'Вс',
  'feed.report.reasons.malicious_link': 'Вредоносная ссылка',
  'feed.report.reasons.spam': 'Спам',
  'feed.report.reasons.impersonation': 'Выдача себя за другого',
  'feed.report.reasons.harassment': 'Оскорбления / злоупотребление',
  'feed.report.reasons.copyright': 'Нарушение авторских прав',
  'feed.report.reasons.other': 'Другое',
  'feed.modal.closeAria': 'Закрыть окно',
  'feed.feedback.newApplication': 'Новая заявка получена в ленте сканлейта.',
  'feed.error.loadFailed': 'Не удалось загрузить ленту сканлейта.',
  'feed.hero.back': 'Вернуться на панель управления',
  'feed.hero.title': 'Набор, витрина и модерация',
  'feed.hero.subtitle':
    'Публикуйте вакансии, показывайте работы, получайте заявки и сообщайте о подозрительном контенте.',
  'feed.tab.recruitment': 'Набор',
  'feed.tab.showcase': 'Витрина',
  'feed.tab.moderation': 'Модерация',
  'feed.actions.createPost': 'Создать {type}',
  'feed.alert.safety':
    'Используйте только легитимные социальные сети и контакты. О подозрительных публикациях можно сообщить.',
  'feed.alert.banPolicy':
    'Вредоносные публикации могут привести к постоянной блокировке аккаунта, устройства и сети.',
  'feed.card.recruitmentRecent': 'Последние объявления о наборе',
  'feed.card.showcaseRecent': 'Последние витрины',
  'feed.card.moderationQueue': 'Очередь модерации',
  'feed.loading': 'Загрузка ленты…',
  'feed.empty.noRecruitment': 'Объявления о наборе не найдены',
  'feed.empty.noShowcase': 'Витрины не найдены',
  'feed.empty.cleanQueue': 'Очередь пуста',
  'feed.empty.beFirst': 'Будьте первым, кто опубликует {type}!',
  'feed.empty.noModPosts': 'Нет публикаций в очереди модерации.',
  'feed.post.recruitLabel': 'Набор',
  'feed.post.showcaseLabel': 'Витрина',
  'feed.post.rolePayNegotiable': 'По договорённости',
  'feed.post.rolePayVolunteer': 'Волонтёрств��',
  'feed.post.actions.apply': 'Откликнуться',
  'feed.post.actions.report': 'Пожаловаться',
  'feed.post.actions.show': 'Показать',
  'feed.post.actions.hide': 'Скрыть',
  'feed.post.actions.ban': 'Заблокировать',
  'feed.sidebar.profileTitle': 'Профиль автора',
  'feed.sidebar.rulesLabel':
    'Я принимаю правила ленты. Вредоносные ссылки приводят к постоянной блокировке.',
  'feed.sidebar.webhookLabel': 'Уведомления через вебхук Discord',
  'feed.sidebar.saveProfile': 'Сохранить профиль',
  'feed.sidebar.inboxTitle': 'Внутренние сообщения',
  'feed.sidebar.yourApplications': 'Ваши заявки',
  'feed.sidebar.noApplications': 'Отправленны�� заявок нет.',
  'feed.sidebar.receivedTitle': 'Полученные',
  'feed.sidebar.noReceived': 'Полученных заявок нет.',
  'feed.sidebar.reportsTitle': 'Жалобы',
  'feed.sidebar.noReports': 'Ожидающих жалоб нет.',
  'feed.sidebar.banTitle': 'Блокировка',
  'feed.sidebar.applyBan': 'Применить блокировку',
  'feed.feedback.postPublishedRecruit': 'Объявление о наборе опубликовано.',
  'feed.feedback.postPublishedShowcase': 'Витрина опубликована.',
  'feed.feedback.reportSent': 'Жалоба отправлена на модерацию.',
  'feed.feedback.profileUpdated': 'Профиль ленты обновлён.',
  'feed.feedback.applicationSent': 'Заявка отправлена.',
  'feed.feedback.banApplied': 'Блокировка применена, сессии аннулированы.',
  'feed.feedback.reportUpdated': 'Жалоба обновлена.',
  'feed.feedback.postStatusUpdated':
    'Публикация обновлена до статуса {status}.',
  'feed.moderation.notes.resolved': 'Рассмотрено модерацией.',
  'feed.moderation.notes.dismissed': 'Отклонено модерацией.',
  'feed.moderation.banReasonPost': 'Модерируемая публикация: {title}',
  'feed.moderation.targetUserId': 'ID целевого пользователя',
  'feed.moderation.applyBan': 'Применить блокировку',
  'feed.error.roleDuplicate': 'Вы уже добавили роль «{role}».',
  'feed.error.valuePositive': 'Значение должно быть положительным.',
  'feed.error.platformDuplicate': 'Платформа «{platform}» уже добавлена.',
  'feed.error.platformRequired': 'Пожалуйста, укажите {platform}.',
  'feed.error.saveProfileFailed': 'Не удалось сохранить профиль.',
  'feed.error.publishFailed': 'Не удалось опубликовать.',
  'feed.error.applyFailed': 'Не удалось подать заявку.',
  'feed.error.reportFailed': 'Не удалось отправить жалобу.',
  'feed.error.moderatePostFailed': 'Не удалось модерировать публикацию.',
  'feed.error.moderateReportFailed': 'Не удалось обновить жалобу.',
  'feed.error.banFailed': 'Не удалось применить блокировку.',
  'feed.composer.typeRecruit': 'набор',
  'feed.composer.typeShowcase': 'витрина',
  'feed.composer.placeholder.titleRecruit': 'Например: Ищем переводчиков',
  'feed.composer.placeholder.titleShowcase': 'Например: Новая глава доступна',
  'feed.composer.placeholder.bodyRecruit':
    'Расскажите о проекте и чем кандидат может помочь...',
  'feed.composer.placeholder.bodyShowcase':
    'Опишите релиз и важную информацию...',
  'feed.composer.placeholder.scanlationName': 'Название команды',
  'feed.composer.placeholder.workTitle': 'Название произведения',
  'feed.composer.placeholder.chapterLabel': 'Гл. 42',
  'feed.composer.placeholder.genres': 'Экшен, Романтика, Фэнтези',
  'feed.composer.placeholder.description': 'Опишите этот релиз...',
  'feed.composer.sections.project': 'Проект',
  'feed.composer.sections.work': 'Произведение',
  'feed.composer.sections.recruitmentSettings': 'Настройки набора',
  'feed.composer.toggle.recruiting': 'Набор открыт',
  'feed.composer.toggle.recruitingDesc':
    'Ваша команда принимает новых участников?',
  'feed.composer.toggle.paidWork': 'Оплачиваемая работа',
  'feed.composer.toggle.paidWorkDesc': 'Участники будут получать оплату?',
  'feed.composer.requirements.label': 'Требования к кандидатам:',
  'feed.composer.requirements.portfolio': 'Портфолио',
  'feed.composer.requirements.experience': 'Опыт',
  'feed.composer.requirements.availability': 'Доступность',
  'feed.composer.requirements.contact': 'Контакт',
  'feed.composer.availability.minRequired': 'Минимальная доступность:',
  'feed.composer.availability.hoursPerWeek': 'Часов в неделю',
  'feed.composer.availability.daysOptional': 'Дни (необязательно)',
  'feed.composer.availability.descriptionOptional': 'Описание (необязательно)',
  'feed.composer.availability.placeholder':
    'Мне нужен человек, который сдаёт главы каждую неделю...',
  'feed.composer.sections.roles': 'Роли',
  'feed.composer.sections.rolesSub': '(добавьте те, которые ищете)',
  'feed.composer.roles.roleLabel': 'Роль',
  'feed.composer.roles.valueLabel': 'Стоимость ($)',
  'feed.composer.roles.valueHint': '(за главу)',
  'feed.composer.roles.add': 'Добавить',
  'feed.composer.roles.allAdded': 'Все роли добавлены',
  'feed.composer.roles.addBtn': 'Добавить роль',
  'feed.composer.social.title': 'Социальные сети',
  'feed.composer.social.sub': '(минимум одна)',
  'feed.composer.social.platform': 'Платформа',
  'feed.composer.social.user': 'Пользователь',
  'feed.composer.social.url': 'URL/Ссылка',
  'feed.composer.social.allAdded': 'Все платформы добавлены',
  'feed.composer.social.addBtn': 'Добавить соц. сеть',
  'feed.composer.sections.media': 'Медиа',
  'feed.composer.media.uploading': 'Отправка...',
  'feed.composer.media.uploadBtn': 'Загрузить через Imgur',
  'feed.apply.title': 'Отправить заявку',
  'feed.apply.message': 'Сообщение',
  'feed.apply.messagePlaceholder':
    'Представьтесь и расскажите, почему хотите присоединиться...',
  'feed.apply.preferredContact': 'Предпочтительный контакт',
  'feed.apply.portfolio': 'Портфолио / ссылки',
  'feed.apply.portfolioPlaceholder': 'По одной ссылке на строку...',
  'feed.report.title': 'Пожаловаться на публикацию',
  'feed.report.reason': 'Причина',
  'feed.report.details': 'Подробности',
  'feed.report.detailsPlaceholder': 'Опишите проблему...',
  'feed.report.send': 'Отправить жалобу',
  'freeProvider.manager.titleTranslation': 'FREE-провайдеры (Перевод)',
  'freeProvider.manager.titleOcr': 'FREE-провайдеры (OCR)',
  'auth.password.hide': 'Скрыть пароль',
  'auth.password.show': 'Показать пароль',
  'modelManager.stage.cleanImage': 'Очистка изображения',
  'modelManager.stage.detectText': 'Обнаружение текста',
  'modelManager.stage.recognizeText': 'Распознавание текста',
  'modelManager.stage.segmentText': 'Сегментация текста',
  'fillStylePopover.gradient': 'Градиент',
  'fillStylePopover.hint.gradient':
    'Сплошной цвет или градиент в одном окне выбора.',
  'fillStylePopover.hint.solid': 'Выберите сплошной цвет.',
  'klSlider.resetValue': 'Сбросить значение',
  'dashboard.aio.translation.llm.temperature': 'Температура',
  'dashboard.aio.translation.llm.topP': 'Top P',
  'dashboard.aio.translation.llm.maxTokens': 'Макс. токенов',
  'dashboard.enhance.modeTag': 'Улучшение',
  'dashboard.enhance.scale.2x': '2×',
  'dashboard.enhance.scale.4x': '4×',
  'optimizer.hero.title': 'Оптимизатор глав',
  'optimizer.hero.desc':
    'Оптимизация финальных страниц для веба, чтения или архивирования.',
  'optimizer.hero.pages': 'Страницы',
  'optimizer.hero.savings': 'Экономия',
  'optimizer.hero.saved': 'Сохранено',
  'optimizer.hero.output': 'Результат',
  'optimizer.panel.presets': 'Пресеты',
  'optimizer.panel.output': 'Результат',
  'optimizer.panel.dimensions': 'Размеры',
  'optimizer.panel.filters': 'Фильтры',
  'optimizer.panel.preview': 'Предпросмотр',
  'optimizer.presets.webLight': 'Лёгкий веб',
  'optimizer.presets.webLight.desc': 'Лёгкий формат для быстрой загрузки',
  'optimizer.presets.reading': 'Чтение',
  'optimizer.presets.reading.desc': 'Сбалансированное качество для читателей',
  'optimizer.presets.archive': 'Архив',
  'optimizer.presets.archive.desc': 'Без потерь для хранения',
  'optimizer.presets.social': 'Соцсети',
  'optimizer.presets.social.desc': 'Оптимизировано для социальных сетей',
  'optimizer.presets.custom': 'Пользовательский',
  'optimizer.presets.custom.desc': 'Ваши собственные настройки',
  'optimizer.config.format': 'Формат',
  'optimizer.config.quality': 'Качество',
  'optimizer.config.resize': 'Масштабирование',
  'optimizer.config.trimBorders': 'Обрезка полей',
  'optimizer.config.trimTolerance': 'Допуск обрезки',
  'optimizer.config.maxWidth': 'Макс. ширина',
  'optimizer.config.maxHeight': 'Макс. высота',
  'optimizer.config.sharpen': 'Резкость',
  'optimizer.config.sharpenStrength': 'Сила резкости',
  'optimizer.config.grayscale': 'Оттенки серого',
  'optimizer.config.autoLevels': 'Автоуровни',
  'optimizer.action.optimizing': 'Оптимизация...',
  'optimizer.action.folder': 'Папка',
  'optimizer.preview.generating': 'Генерация предпросмотра...',
  'optimizer.preview.before': 'До',
  'optimizer.preview.after': 'После',
  'optimizer.preview.reduction': 'Уменьшение',
  'optimizer.preview.dimensions': 'Размеры',
  'optimizer.preview.compare': 'Сравнение',
  'optimizer.preview.original': 'Оригинал',
  'optimizer.preview.optimized': 'Оптимизированный',
  'optimizer.preview.empty':
    'Загрузите изображения для использования оптимизатора.',
  'optimizer.results.title': 'Результаты',
  'optimizer.results.empty': 'Запустите оптимизацию для просмотра результатов.',
  'optimizer.results.download': 'Скачать файл',
  'optimizer.error.worker': 'Воркер недоступен в оптимизаторе глав.',
  'optimizer.error.failed': 'Оптимизатор глав завершился с ошибкой.',
  'optimizer.error.preview': 'Предпросмотр оптимизатора не удался.',
  'optimizer.config.brightness': 'Яркость',
  'optimizer.config.contrast': 'Контраст',
  'optimizer.config.noiseReduction': 'Шумоподавление',
  'optimizer.config.noiseReductionStrength': 'Сила шумоподавления',
  'optimizer.config.rotation': 'Вращение',
  'optimizer.config.rotationNone': 'Нет',
  'optimizer.config.renamePattern': 'Шаблон переименования',
  'optimizer.config.renameHint':
    'Используйте {name} для исходного имени, {index} для номера с нулями, {ext} для расширения.',
  'optimizer.panel.advanced': 'Дополнительно',
  'optimizer.export.folderSuccess':
    'Оптимизатор глав экспортировал файлы в выбранную папку.',
  'optimizer.export.zipSuccess':
    'Пакет оптимизатора глав успешно сгенерирован.',
  'resources.communities.platform.discord': 'Discord',
  'resources.communities.platform.reddit': 'Reddit',
  'resources.communities.platform.website': 'Веб-сайт',
  'resources.communities.platform.telegram': 'Telegram',
  'dashboard.cleaner.modeTag': 'Клинер',
  'stitch.error.loadImage': 'Не удалось загрузить изображение.',
  'stitch.error.initCanvas': 'Не удалось инициализировать холст склейщика.',
  'stitch.error.initTempCanvas':
    'Не удалось подготовить промежуточное изображение склейщика.',
  'stitch.error.generateBlob': 'Не удалось сгенерировать blob склейщика.',
  'stitch.error.cancelled': 'Рендеринг отменён.',
  'stitch.error.workerFailed': 'Не удалось запустить воркер склейщика.',
  'stitch.error.generatePreview':
    'Не удалось сгенерировать предпросмотр склейщика.',
  'stitch.error.exportBatch': 'Не удалось экспортировать пакет склейщика.',
  'stitch.error.generateZip': 'Не удалось сгенерировать ZIP склейщика.',
  'stitch.error.saveFolder': 'Не удалось сохранить пакеты в папку.',
  'dashboard.footer.runtime.fallback.label': 'Резервный',
  'watermark.blend.normal': 'Нормальный',
  'watermark.blend.multiply': 'Умножение',
  'watermark.blend.screen': 'Экран',
  'watermark.blend.overlay': 'Наложение',
  'watermark.blend.softLight': 'Мягкий свет',
  'watermark.blend.hardLight': 'Жёсткий свет',
  'watermark.blend.colorDodge': 'Осветление',
  'watermark.blend.colorBurn': 'Затемнение',
  'watermark.panel.shadow': 'Слой тени',
  'watermark.shadow.enable': 'Включить фоновую тень',
  'watermark.shadow.blur': 'Размытие',
  'watermark.shadow.opacity': 'Прозрачность',
  'watermark.shadow.color': 'Цвет',
  'watermark.shadow.offsetY': 'Смещение Y',
  'watermark.panel.textAvoidance': 'Избегание текста',
  'watermark.textAvoidance.enable': 'Избегать текстовых областей',
  'watermark.textAvoidance.desc':
    'Использует ИИ-обнаружение текста для предотвращения наложения водяных знаков на текст в изображениях.',
  'watermark.textAvoidance.detecting': 'Обнаружение...',
  'watermark.textAvoidance.detectCurrent': 'Обнаружить текущее',
  'watermark.textAvoidance.detectAll': 'Обнаружить все',
  'watermark.textAvoidance.detected':
    '{{count}} текстовых областей обнаружено.',
  'watermark.textAvoidance.detectedAll':
    '{{count}} текстовых областей обнаружено на всех изображениях.',
  'watermark.textAvoidance.failed': 'Обнаружение текста не удалось.',
  'watermark.textAvoidance.zonesFound': 'зон',
  'watermark.textAvoidance.showOverlay': 'Показать зоны',
  'watermark.text.shadowBlur': 'Размытие тени',
  'watermark.text.shadowColor': 'Цвет тени',
  'watermark.distribution.offsetX': 'Смещение X',
  'watermark.distribution.offsetY': 'Смещение Y',
  'watermark.distribution.density': 'Плотность',
  'dashboard.dock.tooltip.hoverHint': 'Задержите курсор для предпросмотра',
  'dashboard.dock.config.ariaLabel': 'Конфигурация активного инструмента',
  'dashboard.dock.config.closeTitle': 'Закрыть конфигурацию',
  'dashboard.dock.config.closeAriaLabel': 'Закрыть конфигурацию инструмента',
  'dashboard.dock.areaSelection.sectionTitle': 'Выбор области',
  'dashboard.dock.areaSelection.shapeLabel': 'Форма нового выделения',
  'dashboard.dock.areaSelection.optionAuto': 'Авто',
  'dashboard.dock.areaSelection.optionSquare': 'Прямоугольная',
  'dashboard.dock.areaSelection.optionRounded': 'Эллиптическая',
  'dashboard.dock.areaSelection.hintAuto': 'Авто определяет: {kind}.',
  'dashboard.dock.areaSelection.hintFixed':
    'Новые области создаются как {mode}.',
  'dashboard.dock.areaSelection.btnDuplicate': 'Дублировать',
  'dashboard.dock.areaSelection.btnToAuto': '→ Авто',
  'dashboard.dock.areaSelection.btnToSquare': '→ Прямоугольная',
  'dashboard.dock.areaSelection.btnToRounded': '→ Эллиптическая',
  'dashboard.dock.segment.brushTitle': 'Кисть сегментации',
  'dashboard.dock.segment.eraserTitle': 'Ластик сегментации',
  'dashboard.dock.segment.sizeLabel': 'Размер',
  'dashboard.dock.segment.hint':
    'Настройте радиус для редактирования сегментированных областей.',
  'dashboard.dock.imageTool.paintTitle': 'Кисть',
  'dashboard.dock.imageTool.eraserTitle': 'Ластик',
  'dashboard.dock.imageTool.healingTitle': 'Восстанавливающая кисть',
  'dashboard.dock.imageTool.sizeLabel': 'Размер',
  'dashboard.dock.imageTool.opacityLabel': 'Прозрачность',
  'dashboard.dock.imageTool.blurLabel': 'Размытие',
  'dashboard.dock.imageTool.colorLabel': 'Цвет',
  'dashboard.dock.imageTool.colorAriaLabel': 'Цвет кисти',
  'dashboard.dock.magicWand.title': 'Волшебная палочка',
  'dashboard.dock.magicWand.toleranceLabel': 'Допуск',
  'dashboard.dock.magicWand.healingBtnTitle':
    'Применить инпейнтинг к выделению палочкой',
  'dashboard.dock.magicWand.healingBtnBusy': 'Применение…',
  'dashboard.dock.magicWand.healingBtn': 'Восстановление',
  'dashboard.dock.magicWand.clearBtn': 'Очистить',
  'dashboard.dock.imageTool.modelHint': 'Модель: ',
  'dashboard.dock.palette.ariaLabel': 'Ручные инструменты изображения',
  'dashboard.dock.config.closeLabel': 'Закрыть конфигурацию',
  'dashboard.dock.config.openLabel': 'Открыть конфигурацию',
  'dashboard.dock.config.badge': 'Настройки',
  'dashboard.dock.config.description':
    'Открывает контекстную панель активного инструмента для настройки формы, размера, прозрачности, допуска и других параметров.',
  'dashboard.dock.config.disabledReason':
    'Активируйте инструмент с редактируемыми параметрами, чтобы открыть конфигурацию.',
  'dashboard.dock.divider.reg': 'Обл',
  'dashboard.dock.areaSelect.ariaLabel': 'Выбрать область',
  'dashboard.dock.areaSelect.title': 'Выбор области',
  'dashboard.dock.areaSelect.description':
    'Создавайте, корректируйте и уточняйте текстовые области на превью. Идеально для исправления обнаруженных баллонов перед OCR, переводом или рендером.',
  'dashboard.dock.areaSelect.badge': 'Обл',
  'dashboard.dock.areaSelect.disabledReason':
    'Доступно на этапах обнаружения и рендера ручного AIO.',
  'dashboard.dock.clearPage.ariaLabel': 'Очистить все области',
  'dashboard.dock.clearPage.title': 'Очистить страницу',
  'dashboard.dock.clearPage.description':
    'Удаляет все области на этой странице, чтобы можно было начать ручную разметку заново без остатков.',
  'dashboard.dock.clearPage.badge': 'Сброс',
  'dashboard.dock.clearPage.disabledReason':
    'Необходимо находиться на этапе обнаружения/рендера и иметь созданные области на активном изображении.',
  'dashboard.dock.divider.seg': 'Сег',
  'dashboard.dock.segBrush.ariaLabel': 'Кисть сегментированной области',
  'dashboard.dock.segBrush.title': 'Кисть сегментации',
  'dashboard.dock.segBrush.description':
    'Расширяет маску сегментации для восстановления букв, контуров или частей баллонов, которые были пропущены.',
  'dashboard.dock.segBrush.badge': 'Сег',
  'dashboard.dock.segBrush.disabledReason':
    'Доступно на этапе сегментации текста.',
  'dashboard.dock.segEraser.ariaLabel': 'Ластик сегментированной области',
  'dashboard.dock.segEraser.title': 'Ластик сегментации',
  'dashboard.dock.segEraser.description':
    'Уточняет маску, удаляя лишнее выделение, утечки и артефакты, которые не должны быть включены в очистку.',
  'dashboard.dock.segEraser.badge': 'Сег',
  'dashboard.dock.segEraser.disabledReason':
    'Доступно на этапе сегментации текста.',
  'dashboard.dock.divider.img': 'Изо',
  'dashboard.dock.paint.ariaLabel': 'Кисть рисования',
  'dashboard.dock.paint.title': 'Кисть',
  'dashboard.dock.paint.description':
    'Закрашивайте артефакты, дефекты инпейнтинга или детали, требующие микрокоррекции, прямо на изображении.',
  'dashboard.dock.paint.badge': 'Изо',
  'dashboard.dock.paint.disabledReason':
    'Войдите в ручной режим и выберите активное изображение для редактирования.',
  'dashboard.dock.paintEraser.ariaLabel': 'Ластик рисования',
  'dashboard.dock.paintEraser.title': 'Ластик',
  'dashboard.dock.paintEraser.description':
    'Стирает только слой ручного рисования, чтобы отменить изменения без потери остальных обнаружений и масок.',
  'dashboard.dock.paintEraser.badge': 'Изо',
  'dashboard.dock.paintEraser.disabledReason':
    'Войдите в ручной режим и выберите активное изображение для редактирования.',
  'dashboard.dock.wand.ariaLabel': 'Волшебная палочка',
  'dashboard.dock.wand.title': 'Волшебная палочка',
  'dashboard.dock.wand.description':
    'Быстро выделяет смежную область по цвету/допуску для точного восстановления или удаления остатков.',
  'dashboard.dock.wand.badge': 'Изо',
  'dashboard.dock.wand.disabledReason':
    'Войдите в ручной режим и выберите активное изображение для редактирования.',
  'dashboard.dock.healing.ariaLabel': 'Восстанавливающая кисть',
  'dashboard.dock.healing.title': 'Восстанавливающая кисть',
  'dashboard.dock.healing.description':
    'Применяет локальный инпейнтинг поверх дефектов, сломанных краёв и остатков текста, сохраняя более естественную окружающую текстуру.',
  'dashboard.dock.healing.badge': 'Изо',
  'dashboard.dock.healing.disabledReason':
    'Войдите в ручной режим и выберите активное изображение для редактирования.',
  'dashboard.dock.clearPaint.ariaLabel': 'Очистить рисование',
  'dashboard.dock.clearPaint.title': 'Очистить рисование',
  'dashboard.dock.clearPaint.description':
    'Стирает весь слой ручного рисования с активного изображения без сброса других коррекций или истории этапов.',
  'dashboard.dock.clearPaint.badge': 'Сброс',
  'dashboard.dock.clearPaint.disabledReason':
    'Появляется только когда на активном изображении уже есть ручное рисование.',
  'dashboard.dock.resetEdits.ariaLabel': 'Сбросить все правки',
  'dashboard.dock.resetEdits.title': 'Сбросить правки',
  'dashboard.dock.resetEdits.description':
    'Возвращает активное изображение к исходному состоянию ручного этапа, удаляя рисование, восстановление, выделение палочкой и локальные переопределения.',
  'dashboard.dock.resetEdits.badge': 'Сброс',
  'dashboard.dock.resetEdits.disabledReason':
    'Доступно, когда активное изображение уже подвергалось ручному вмешательству.',
  'modelManager.stage.automaticAiClean': 'Автоматичес��ая ИИ-очистка',
  'resources.fonts.downloadLabel': 'Скачать',
  'dashboard.sidebar.supportedFormats':
    'JPG, PNG, WEBP, ZIP, PDF, CBZ, CB7, PSD',
  'dashboard.cleaner.ocr.label': 'OCR',
  'dashboard.cleaner.ai.defaultProvider': 'Облако / API / ИИ',
  'bugReport.screenshot.alt': 'Скриншот',
  'pageTransition.loading.ariaLabel': 'Загрузка',
  'watermark.text.placeholder': 'KŌMA Studio',
  'watermark.logo.alt': 'Логотип',
  'dashboard.textDetection.regionActions.aria': 'Действия с областью',
  'dashboard.textDetection.manualModeRequired': 'Требуется ручной режим',
  'dashboard.textDetection.removeRegion': 'Удалить область',
  'dashboard.renderText.rewind.title': 'Вернуть это изображение',
  'dashboard.renderText.forward.title': 'Продвинуть это изображение',
  'dashboard.renderText.noHistory': 'Нет истории AIO для этого изображения',
  'dashboard.renderText.editPlaceholder': 'Введите финальный текст...',
  'dashboard.renderText.editAria': 'Редактирование отрисованного текста',
  'dashboard.renderText.removeSelection.title': 'Удалить выделение',
  'dashboard.renderText.regionActions.aria': 'Действия с областью',
  'dashboard.pipeline.prevStep.title':
    'Вернуться к предыдущему этапу конвейера AIO',
  'dashboard.pipeline.nextStep.title':
    'Перейти к следующему этапу конвейера AIO',
  'dashboard.pipeline.runStep.title':
    'Запустить только текущий этап для выбранного изображения',
  'dashboard.pipeline.skipStep.title':
    'Пропустить текущий этап и разблокировать следующий',
  'dashboard.typesetter.applyStyleAll.title':
    'Применить стиль текущего выделения ко всем областям',
  'auth.error.internetRequired':
    'Для входа в приложение требуется доступ к интернету.',
  'auth.error.mandatoryUpdate':
    'Доступно обязательное обновление. Обновите приложение, чтобы продолжить.',
  'dashboard.textDetection.noTextRecognized': 'Текст не распознан',
  'dashboard.textDetection.noTranslation': 'Перевод недоступен',
  'dashboard.textDetection.noNt': 'Примечания недоступны',
  'dashboard.renderText.dblClickToEdit': 'дважды кликните для редактирования',
  'dashboard.renderText.renderNotApplied': 'рендер не применён на этом этапе',
  'dashboard.status.stageLabelTranslation': 'Перевод',
  'dashboard.status.profilesPersistedDesktopSecure':
    'Пользовательские профили сохранены на рабочем столе в защищённом хранилище.',
  'dashboard.status.profilesPersistedDesktopLocal':
    'Пользовательские профили сохранены на рабочем столе без встроенного шифрования.',
  'dashboard.status.profilesPersistedBrowser':
    'Пользовательские профили сохранены в локальном хранилище браузера этого устройства.',
  'dashboard.status.aioScopeManual': 'AIO ручной',
  'dashboard.status.aioScopeAuto': 'AIO автоматический',
  'dashboard.status.cleanerSelectProfileFirst':
    'Выберите сохранённый визуальный профиль для автоматической ИИ-очистки.',
  'dashboard.status.cleanerProfileNotFound':
    'Визуальный профиль не найден. Перезагрузите и попробуйте снова.',
  'dashboard.status.cleanerProfileInUse':
    'Визуальный профиль для автоматической ИИ-очистки: {label}.',
  'dashboard.status.cleanerSelectValidModel':
    'Выберите допустимую модель для автоматической ИИ-очистки.',
  'dashboard.status.modelInRoadmap':
    'Модель «{name}» находится в планах разработки.',
  'dashboard.status.modelNeedsConfig':
    'Модель «{name}» требует настройки перед использованием.',
  'dashboard.status.translatorSfxSelectValidModel':
    'Выберите допустимую модель для ИИ SFX переводчика.',
  'dashboard.status.cleanerProfileSaved':
    'Визуальный профиль сохранён и выбран для автоматической ИИ-очистки: {label}.',
  'dashboard.status.cleanerSelectProfileToRemove':
    'Выберите сохранённый визуальный профиль для удаления.',
  'dashboard.status.customProfilePendingSync':
    'Пользовательский профиль ожидает локальной синхронизации.',
  'dashboard.status.customProfileOcrPendingSync':
    'Пользовательский профиль OCR ожидает локальной синхронизации.',
  'dashboard.status.presetAppliedToSelection':
    'Пресет «{name}» применён к текущему выделению.',
  'dashboard.status.legacyPresetNotFound':
    'Устаревший визуальный пресет {modeKey} не найден.',
  'dashboard.status.presetAppliedShort':
    'Пресет «{name}» применён к выделению.',
  'dashboard.status.presetAppliedToImage':
    'Пресет «{name}» применён к активному изображению.',
  'dashboard.status.typographerSelectionDuplicated':
    'Выделение дублировано в наборщике.',
  'dashboard.status.autoShapeApplied': 'Автоформа применена: {shape}.',
  'dashboard.status.renderStyleAppliedAll':
    'Стиль рендера применён ко всем выделениям на всех изображениях.',
  'dashboard.status.canvasInitFailed':
    'Не удалось инициализировать холст ручной композиции.',
  'dashboard.status.cleanerCanvasInitFailed':
    'Не удалось инициализировать холст ручной композиции клинера.',
  'dashboard.status.wandPrepFailed':
    'Не удалось подготовить волшебную палочку.',
  'dashboard.status.wandSelectionUpdated':
    'Выделение палочкой обновлено. Используйте «Восстановление» для инпейнтинга.',
  'dashboard.status.wandNoArea':
    'Палочка не нашла совместимую область для выделения.',
  'dashboard.status.wandExecFailed': 'Не удалось выполнить волшебную палочку.',
  'dashboard.status.cleanerWandPrepFailed':
    'Не удалось подготовить волшебную палочку клинера.',
  'dashboard.status.cleanerWandSelectionUpdated':
    'Выделение палочкой клинера обновлено. Используйте «Восстановление» для инпейнтинга.',
  'dashboard.status.cleanerWandNoArea':
    'Палочка клинера не нашла совместимую область для выделения.',
  'dashboard.status.cleanerWandExecFailed':
    'Не удалось выполнить волшебную палочку клинера.',
  'dashboard.status.healingInvalidResponse':
    'Недопустимый ответ при применении восстанавливающей кисти.',
  'dashboard.status.cleanerHealingInvalidResponse':
    'Недопустимый ответ при применении восстанавливающей кисти в клинере.',
  'dashboard.status.cleanerHealingConnectFailed':
    'Восстановление клинера не смогло подключиться к бэкенду ({url}). Проверьте, что мини-бэкенд активен.',
  'dashboard.status.cleanerHealingFailed':
    'Не удалось применить восстанавливающую кисть в клинере.',
  'dashboard.status.wandNoSelectionForHealing':
    'Нет выделения палочкой для применения восстановления.',
  'dashboard.status.renderCanvasInitFailed':
    'Не удалось инициализировать холст рендера.',
  'dashboard.status.aioCompleteAdjust':
    '{message} При необходимости скорректируйте вручную.',
  'dashboard.status.aioAborted': 'Запуск AIO прерван.',
  'dashboard.alert.importWorkspaceConfirm':
    'Импорт этой рабочей области заменит текущую в памяти. Продолжить?',
  'dashboard.alert.clearAutosaveConfirm':
    'Очистка локального автосохранения удалит последнюю сохранённую рабочую область на этом ПК для этого пользователя. Продолжить?',
  'dashboard.alert.closeWorkspaceConfirm':
    'Закрыть текущую рабочую область? Все загруженные изображения и локальное автосохранение будут удалены. Это действие нельзя отменить.',
  'dashboard.status.workspacePendingChanges':
    'Рабочая область содержит несохранённые изменения.',
  'dashboard.status.toolSelectArea': 'Выбор области',
  'dashboard.status.toolSegmentBrush': 'Кисть сегментации',
  'dashboard.status.toolSegmentEraser': 'Ластик сегментации',
  'dashboard.alert.emailPendingTitle': 'Почта ожидает подтверждения',
  'dashboard.alert.emailPendingText':
    'Подтвердите почту для выполнения операций обработки.',
  'dashboard.status.typographerSession': 'Сессия наборщика',
  'dashboard.status.cleanerMeta':
    'OCR: {ocrCount} • Сегментировано: {segmentedCount} • Очищено: {cleaned}',
  'dashboard.status.metaOk': 'ок',
  'dashboard.status.metaPending': 'ожидание',
  'dashboard.status.cleanerRunFirst':
    'Запустите клинер для генерации OCR, сегментации и очищенного изображения.',
  'dashboard.status.translatorMeta':
    'Обнаружение: {detected} • OCR: {ocr} • Перевод: {translated}',
  'dashboard.status.translatorRunFirst':
    'Запустите визуальный переводчик для обнаружения, распознавания и перевода.',
  'dashboard.status.localModelDownloadHint':
    'Локальные модели загружаются по запросу; облачные/API-модели продолжают использовать ключ.',
  'dashboard.status.selectionTextModeAria':
    'Текстовый режим текущего выделения',
  'dashboard.status.translatorUsesAioModel':
    'Переводчик использует тот же выбор модели, что и AIO; запустите заново после смены модели.',
  'dashboard.status.translatorLocalModelIncompatible':
    'Текущая локальная модель не поддерживает языковую пару переводчика. Выберите другую модель или используйте облако.',
  'dashboard.status.stitchLastMoved':
    'Последнее изображение отправлено в следующий пакет.',
  'dashboard.status.stitchFirstPulled':
    'Первое изображение из следующего пакета добавлено в текущий.',
  'auth.error.generic': 'Ошибка {status}',
  'auth.error.desktopBridgeUnavailable':
    'Мост аутентификации настольного приложения недоступен.',
  'dashboard.status.modeLabel': 'Режим',
  'dashboard.status.selectedLabel': 'Выбрано',
  'dashboard.status.selectBoxInPreview': 'Выберите блок на превью.',
  'dashboard.status.selectTranslatorModel':
    'Выберите локальную или облачную модель для перевода в переводчике.',
  'dashboard.error.loadHardwareFailed':
    'Не удалось загрузить информацию о локальном оборудовании.',
  'dashboard.error.healingBrushFailed':
    'Ошибка восстанавливающей кисти: {message}',
  'dashboard.status.healingBrushApplyFailed':
    'Не удалось применить восстанавливающую кисть.',
  'dashboard.error.cleanerHealingBrushFailed':
    'Ошибка восстанавливающей кисти клинера: {message}',
  'dashboard.status.aioExecutionFailed': 'Не удалось запустить AIO.',
  'dashboard.status.autosaveSaveFailed':
    'Не удалось сохранить локальное автосохранение.',
  'dashboard.status.workspaceExportFailed':
    'Не удалось экспортировать рабочую область.',
  'dashboard.status.workspaceImportFailed':
    'Не удалось импортировать рабочую область.',
  'dashboard.status.autosaveClearFailed':
    'Не удалось очистить локальное автосохранение.',
  'dashboard.status.noModelSelected': 'Модель не выбрана.',
  'dashboard.status.aiCleanModelSelected':
    'Модель выбрана для автоматической ИИ-очистки: {model}',
  'dashboard.status.selectionMode': 'Режим выделения',
  'dashboard.status.workspaceRestored': 'Рабочая область восстановлена.',
  'dashboard.status.workspaceRestoredFromAutosave':
    'Рабочая область восстановлена из локального автосохранения.',
  'dashboard.aio.skip': 'Пропустить',
  'dashboard.aio.imageLabel': 'Изображение:',
  'dashboard.aio.stepLabel': 'Этап:',
  'dashboard.aio.historyHint': 'Этап: {label} ({current}/{total})',
  'dashboard.typo.fontsUpdating': 'Обновление…',
  'dashboard.typo.updateFonts': 'Обновить шрифты',
  'dashboard.typo.importFontTitle': 'Импорт пользовательского шрифта',
  'dashboard.typo.desktopOnly': 'Только настольное приложение',
  'dashboard.typo.fontImporting': 'Импорт…',
  'dashboard.typo.importFont': 'Импортировать шрифт',
  'dashboard.typo.applyStyleToAll': 'Применить стиль ко всем',
  'dashboard.typo.fontControlsHint':
    'Элементы управления шрифтом/цвет��м/выравниванием находятся в контекстной панели наложения. Горячая клавиша:',
  'dashboard.aio.languageLabel': 'Язык:',
  'shortcuts.category.global': 'Глобальные',
  'shortcuts.category.modes': 'Режимы',
  'shortcuts.category.typesetter': 'Наборщик',
  'shortcuts.noShortcut': 'Нет горячей клавиши',
  'shortcuts.openShortcutModal.label': 'Открыть центр горячих клавиш',
  'shortcuts.openShortcutModal.description':
    'Открывает окно горячих клавиш и настроек.',
  'shortcuts.toggleToolsPanel.label': 'Показать/скрыть панель инструментов',
  'shortcuts.toggleToolsPanel.description':
    'Переключает видимость панели инструментов.',
  'shortcuts.rotateActiveImage.label': 'Повернуть активное изображение',
  'shortcuts.rotateActiveImage.description':
    'Поворачивает выбранное изображение на 90 градусов.',
  'shortcuts.workspaceSave.label': 'Сохранить локальную рабочую область',
  'shortcuts.workspaceSave.description':
    'Принудительно сохраняет текущую рабочую область локально.',
  'shortcuts.workspaceUndo.label': 'Отменить действие',
  'shortcuts.workspaceUndo.description':
    'Отменяет последнее изменение в текущей рабочей области.',
  'shortcuts.workspaceRedo.label': 'Повторить действие',
  'shortcuts.workspaceRedo.description':
    'Повторяет последнее отменённое изменение в текущей рабочей области.',
  'shortcuts.zoomIn.label': 'Увеличить',
  'shortcuts.zoomIn.description': 'Увеличивает масштаб текущего этапа.',
  'shortcuts.zoomOut.label': 'Уменьшить',
  'shortcuts.zoomOut.description': 'Уменьшает масштаб текущего этапа.',
  'shortcuts.setViewPaginated.label': 'Постраничный вид',
  'shortcuts.setViewPaginated.description': 'Переключает на постраничный вид.',
  'shortcuts.setViewLongStrip.label': 'Вид длинной ленты',
  'shortcuts.setViewLongStrip.description': 'Переключает на вид длинной ленты.',
  'shortcuts.setModeOrganize.label': 'Режим организации',
  'shortcuts.setModeOrganize.description': 'Переключает в режим организации.',
  'shortcuts.setModeAio.label': 'Режим AIO',
  'shortcuts.setModeAio.description': 'Переключает в режим AIO.',
  'shortcuts.setModeCleaner.label': 'Режим очистки / перерисовки',
  'shortcuts.setModeCleaner.description':
    'Переключает в режим очистки / перерисовки.',
  'shortcuts.setModeTypesetter.label': 'Режим наборщика',
  'shortcuts.setModeTypesetter.description': 'Переключает в режим наборщика.',
  'shortcuts.setModeTranslator.label': 'Режим переводчика',
  'shortcuts.setModeTranslator.description': 'Переключает в режим переводчика.',
  'shortcuts.setModeRaw.label': 'Режим поставщика исходников',
  'shortcuts.setModeRaw.description':
    'Переключает в режим поставщика исходников.',
  'shortcuts.setModeProofreader.label': 'Режим редактуры / КК',
  'shortcuts.setModeProofreader.description':
    'Переключает в режим редактуры / КК.',
  'shortcuts.setModeStitch.label': 'Режим склейки',
  'shortcuts.setModeStitch.description': 'Переключает в режим склейки.',
  'shortcuts.setModeSplit.label': 'Режим умного разделения',
  'shortcuts.setModeSplit.description':
    'Переключает в режим умного разделения.',
  'shortcuts.setModeWatermark.label': 'Режим водяного знака',
  'shortcuts.setModeWatermark.description':
    'Переключает в режим водяного знака.',
  'shortcuts.setModeEnhance.label': 'Режим улучшения изображения',
  'shortcuts.setModeEnhance.description':
    'Переключает в режим улучшения изображения.',
  'shortcuts.setModeGuides.label': 'Режим руководств',
  'shortcuts.setModeGuides.description': 'Переключает в режим руководств.',
  'shortcuts.setModeResources.label': 'Режим ресурсов',
  'shortcuts.setModeResources.description': 'Переключает в режим ресурсов.',
  'shortcuts.applyText.label': 'Применить текст',
  'shortcuts.applyText.description':
    'Применяет выбранный элемент очереди в наборщике или ручном рендере AIO.',
  'shortcuts.nextRegion.label': 'Выбрать следующую область',
  'shortcuts.nextRegion.description':
    'Перемещает выделение на следующую область в наборщике или ручном AIO.',
  'shortcuts.previousRegion.label': 'Выбрать предыдущую область',
  'shortcuts.previousRegion.description':
    'Перемещает выделение на предыдущую область в наборщике или ручном AIO.',
  'shortcuts.toggleMultiBubble.label': 'Переключить мульти-баллон',
  'shortcuts.toggleMultiBubble.description':
    'Переключает группировку мульти-баллонов в наборщике или ручном AIO.',
  'shortcuts.saveSnapshot.label': 'Сохранить снимок',
  'shortcuts.saveSnapshot.description':
    'Сохраняет снимок сессии наборщика или ручного AIO.',
  'shortcuts.detectShapes.label': 'Обнаружить/уточнить форму',
  'shortcuts.detectShapes.description':
    'Запускает обнаружение или уточнение выбранной формы в наборщике или ручном AIO.',
  'shortcuts.applyActivePreset.label': 'Применить активный пресет',
  'shortcuts.applyActivePreset.description':
    'Применяет активный пресет типографики к выбранной области.',
  'shortcuts.applyLegacyPresetTextBubble.label':
    'Применить устаревший пресет text_bubble',
  'shortcuts.applyLegacyPresetTextBubble.description':
    'Применяет устаревший визуальный пресет text_bubble к выбранной области.',
  'shortcuts.applyLegacyPresetTextFree.label':
    'Применить устаревший пресет text_free',
  'shortcuts.applyLegacyPresetTextFree.description':
    'Применяет устаревший визуальный пресет text_free к выбранной области.',
  'shortcuts.applyLegacyPresetTextSfx.label':
    'Применить устаревший пресет text_sfx',
  'shortcuts.applyLegacyPresetTextSfx.description':
    'Применяет устаревший визуальный пресет text_sfx к выбранной области.',
  'shortcuts.applyLegacyPresetTextNarration.label':
    'Применить устаревший пресет text_narration',
  'shortcuts.applyLegacyPresetTextNarration.description':
    'Применяет устаревший визуальный пресет text_narration к выбранной области.',
  'shortcuts.applyLegacyPresetTextInsideBlackBubble.label':
    'Применить устаревший пресет text_inside_black_bubble',
  'shortcuts.applyLegacyPresetTextInsideBlackBubble.description':
    'Применяет устаревший визуальный пресет text_inside_black_bubble к выбранной области.',
  'shortcuts.applyAutoShape.label': 'Применить автоформу',
  'shortcuts.applyAutoShape.description':
    'Автоматически выбирает между эллиптической и прямоугольной формой для выбранной области.',
  'shortcuts.convertShapeSquare.label': 'Преобразовать форму в прямоугольную',
  'shortcuts.convertShapeSquare.description':
    'Преобразует выбранную область в прямоугольную форму.',
  'shortcuts.convertShapeRounded.label': 'Преобразовать форму в эллиптическую',
  'shortcuts.convertShapeRounded.description':
    'Преобразует выбранную область в эллиптическую форму.',
  'shortcuts.deleteRegion.label': 'Удалить выбранную область',
  'shortcuts.deleteRegion.description':
    'Удаляет выбранную область в ручном AIO, наборщике, визуальном переводчике или клинере.',
  'shortcuts.editInline.label': 'Открыть встроенное редактирование области',
  'shortcuts.editInline.description':
    'Открывает встроенное редактирование для выбранной области в ручном рендере.',
  'shortcuts.inlineEditorCancel.label': 'Отменить встроенное редактирование',
  'shortcuts.inlineEditorCancel.description':
    'Доступно только внутри поля встроенного редактирования.',
  'shortcuts.inlineEditorSave.label': 'Сохранить встроенное редактирование',
  'shortcuts.inlineEditorSave.description':
    'Доступно только внутри поля встроенного редактирования.',
  'shortcuts.category.palette': 'Палитра инструментов',
  'shortcuts.duplicateRegion.label': 'Дублировать выбранную область',
  'shortcuts.duplicateRegion.description':
    'Дублирует выбранную область в наборщике или ручном AIO со смещением 18px.',
  'shortcuts.toolConfigToggle.label': 'Переключить панель конфигурации',
  'shortcuts.toolConfigToggle.description':
    'Открывает или закрывает панель конфигурации активного инструмента в палитре.',
  'shortcuts.toolAreaSelect.label': 'Инструмент: Выбор области',
  'shortcuts.toolAreaSelect.description':
    'Активирует инструмент выбора области в ручном AIO.',
  'shortcuts.toolClearRegions.label': 'Очистить все области',
  'shortcuts.toolClearRegions.description':
    'Удаляет все области с активного изображения в ручном AIO.',
  'shortcuts.toolSegmentBrush.label': 'Инструмент: Кисть сегментации',
  'shortcuts.toolSegmentBrush.description':
    'Активирует кисть для ручного редактирования маски сегментации.',
  'shortcuts.toolSegmentEraser.label': 'Инструмент: Ластик сегментации',
  'shortcuts.toolSegmentEraser.description':
    'Активирует ластик для ручного редактирования маски сегментации.',
  'shortcuts.toolPaint.label': 'Инструмент: Кисть',
  'shortcuts.toolPaint.description':
    'Активирует инструмент ручного рисования на изображении.',
  'shortcuts.toolPaintEraser.label': 'Инструмент: Ластик рисования',
  'shortcuts.toolPaintEraser.description':
    'Активирует ластик для очистки слоя ручного рисования.',
  'shortcuts.toolMagicWand.label': 'Инструмент: Волшебная палочка',
  'shortcuts.toolMagicWand.description':
    'Активирует волшебную палочку для выделения по цветовому допуску.',
  'shortcuts.toolHealingBrush.label': 'Инструмент: Восстанавливающая кисть',
  'shortcuts.toolHealingBrush.description':
    'Активирует восстанавливающую кисть для реставрации изображения.',
  'shortcuts.toolClearPaint.label': 'Очистить слой рисования',
  'shortcuts.toolClearPaint.description':
    'Удаляет весь слой ручного рисования с активного изображения.',
  'shortcuts.toolResetEdits.label': 'Сбросить ручные правки',
  'shortcuts.toolResetEdits.description':
    'Отменяет все ручные правки на активном изображении в клинере или AIO.',
  'dashboard.coachmark.stage.titleSuffix': 'основной этап',
  'dashboard.coachmark.stage.bodyWithImages':
    'Здесь вы видите активное изображение, проверяете визуальный результат режима <strong>{modeLabel}</strong> и вносите коррективы с мгновенной обратной связью.',
  'dashboard.coachmark.stage.bodyWithoutImages':
    'Когда вы загрузите изображения, этот этап станет визуальным центром режима <strong>{modeLabel}</strong>. Именно здесь результат появляется первым.',
  'dashboard.coachmark.stage.accent': 'Этап',
  'dashboard.coachmark.tools.titleSuffix': 'панель инструментов',
  'dashboard.coachmark.tools.body':
    'Используйте правую панель для настройки параметров, пресетов и действий режима <strong>{modeLabel}</strong>. Если что-то меняется в процессе, обычно это начинается здесь.',
  'dashboard.coachmark.tools.accent': 'Инструменты',
  'dashboard.coachmark.download.titleSuffix': 'экспорт',
  'dashboard.coachmark.download.body':
    'Когда результат вас устроит, завершите через меню экспорта — скачайте изображения, пакеты или PSD, не покидая текущий режим.',
  'dashboard.coachmark.download.accent': 'Доставка',
  'dashboard.coachmark.organize.uploadTitle': 'Организация: начните с загрузки',
  'dashboard.coachmark.organize.uploadBody':
    'Перетащите сюда страницы, главы или целые пакеты. Режим организации нужен для подготовки пакета перед производством.',
  'dashboard.coachmark.organize.uploadAccent': 'Вход',
  'dashboard.coachmark.organize.orderTitle': 'Организация: проверьте порядок',
  'dashboard.coachmark.organize.orderBody':
    'В левой панели вы выбираете активное изображение, меняете порядок страниц, удаляете некачественные элементы и проверяете готовность главы к обработке.',
  'dashboard.coachmark.organize.orderAccent': 'Пакет',
  'dashboard.coachmark.aioAuto.pipelineTitle':
    'Автоматический AIO: запустите конвейер',
  'dashboard.coachmark.aioAuto.pipelineBody':
    'В автоматическом режиме вы настраиваете один раз и обрабатываете пакет последовательно. Идеально для потока, пост-проверки и более повторяющихся рабочих процессов.',
  'dashboard.coachmark.aioAuto.pipelineAccent': 'Авто',
  'dashboard.coachmark.aioAuto.stagesTitle':
    'Автоматический AIO: включайте только нужное',
  'dashboard.coachmark.aioAuto.stagesBody':
    'Включайте только те этапы, которые имеют смысл для этого пакета. Меньше этапов — меньше затрат, времени и точек отказа.',
  'dashboard.coachmark.aioAuto.stagesAccent': 'Конвейер',
  'dashboard.coachmark.aioAuto.configTitle':
    'Автоматический AIO: настройте модели и языки',
  'dashboard.coachmark.aioAuto.configBody':
    'Выберите языки, пресеты и модели перед запуском. Именно эта часть больше всего влияет на скорость, качество и стоимость обработки.',
  'dashboard.coachmark.aioAuto.configAccent': 'Настройка',
  'dashboard.coachmark.aioManual.title': 'Ручной AIO: работайте поэтапно',
  'dashboard.coachmark.aioManual.body':
    'В ручном режиме вы запускаете, проверяете и исправляете каждый этап с большим контролем. Идеальный режим для тонкой доработки и сложных случаев.',
  'dashboard.coachmark.aioManual.accent': 'Ручной',
  'dashboard.coachmark.aioManual.dockTitle':
    'Ручной AIO: используйте док как верстак',
  'dashboard.coachmark.aioManual.dockBody':
    'Плавающий док объединяет выделение, сегментацию, кисть, палочку и восстановление. Считайте его мини-панелью быстрого вмешательства поверх превью.',
  'dashboard.coachmark.aioManual.dockAccent': 'Док',
  'dashboard.coachmark.typesetter.titleManual': 'Ручной наборщик',
  'dashboard.coachmark.typesetter.titleAuto': 'Автоматический наборщик',
  'dashboard.coachmark.typesetter.bodyManual':
    'Ручной режим лучше всего подходит для микрокоррекций баллонов, форм, шрифтов и визуального ритма на каждой странице.',
  'dashboard.coachmark.typesetter.bodyAuto':
    'Автоматический режим ускоряет черновики и большие пакеты. Выполните быструю визуальную проверку для обеспечения единообразия.',
  'dashboard.coachmark.typesetter.accentManual': 'Ручной',
  'dashboard.coachmark.typesetter.accentAuto': 'Авто',
  'dashboard.coachmark.cleaner.dockTitle':
    'Клинер: локальная коррекция без ухода с изображения',
  'dashboard.coachmark.cleaner.dockBody':
    'Когда док виден, используйте кисть, ластик и восстановление для доработки деталей без потери контекста страницы.',
  'dashboard.coachmark.cleaner.dockAccent': 'Док',
  'dashboard.coachmark.content.titleSuffix': 'навигация по контенту',
  'dashboard.coachmark.content.body':
    'Этот режим заменяет визуальный этап справочной панелью. Используйте его для изучения рабочих процессов, просмотра справочных материалов и возврата к производству с меньшими затруднениями.',
  'dashboard.coachmark.content.accent': 'Справка',
  'dashboard.coachmark.progress': 'Подсказка {{current}} / {{total}}',
  'dashboard.coachmark.next': 'Далее',
  'dashboard.coachmark.prev': 'Назад',
  'dashboard.coachmark.done': 'Понятно',
  'aioModel.label.unavailable': ' (недоступна)',
  'aioModel.label.notInstalled': '(Не установлена — нажмите для установки)',
  'aioModel.label.updateAvailable': '(Доступно обновление)',
  'aioModel.label.installed': '(Установлена)',
  'aioModel.status.selectAndInstall':
    'Выберите и установите локальную модель для этапа «{stage}».',
  'aioModel.status.installBeforeUse':
    'Установите модель «{name}» перед использованием этого этапа.',
  'aioModel.status.selectValidOcr': 'Выберите допустимую модель для OCR.',
  'aioModel.status.inRoadmap': 'Модель «{name}» находится в планах разработки.',
  'aioModel.status.requiresConfig':
    'Модель «{name}» требует настройки перед использованием.',
  'aioModel.status.installedOk': 'установлена (ок)',
  'aioModel.status.installedUpdate': 'установлена (доступно обновление)',
  'aioExec.selectAndInstallStage':
    'Выберите и установите локальную модель перед запуском этапа «{stageLabel}».',
  'aioExec.installBeforeStage':
    'Установите модель «{name}» перед запуском этапа «{stageLabel}».',
  'aioExec.selectValidOcrModel':
    'Выберите допустимую модель для распознавания текста.',
  'aioExec.ocrRequiresApiKey':
    'Этот OCR-провайдер требует API-ключ. Настройте ключ перед запуском.',
  'aioExec.installTranslationModel':
    'Установите совместимую модель перевода перед запуском AIO.',
  'aioExec.incompatibleLanguage':
    'Выбранная модель несовместима с текущим языком.',
  'aioExec.translationModelIncompatible':
    '«{modelName}» не поддерживает выбранный целевой язык. Выберите совместимую модель или измените целевой язык.',
  'aioExec.selectValidTranslation':
    'Выберите допустимую модель перевода для продолжения.',
  'aioExec.selectCustomOcrProfile':
    'Выберите или сохраните пользовательский профиль OCR перед запуском AIO.',
  'aioExec.selectCustomAiProfile':
    'Выберите или сохраните пользовательский профиль ИИ перед запуском AIO.',
  'aioExec.translationRequiresApiKey':
    'Этот провайдер перевода требует API-ключ. Настройте ключ перед запуском.',
  'aioManual.selectImage': 'Выберите изображение для запуска в ручном режиме.',
  'aioManual.imageNotFound': 'Активное изображение не найдено.',
  'aioManual.progressNotInitialized':
    'Ручная последовательность не инициализирована для активного изображения.',
  'aioManual.selectValidDetectModel':
    'Выберите допустимую модель для обнаружения текста.',
  'aioManual.selectValidSegmentModel':
    'Выберите допустимую модель для сегментации текста.',
  'aioManual.selectValidCleanModel':
    'Выберите допустимую модель для очистки изображения.',
  'aioManual.stageDone':
    'Ручной режим: этап «{stageLabel}» завершён для «{fileName}».',
  'aioManual.executionAborted': 'Запуск ручного AIO прерван.',
  'aioManual.stageFailed': 'Не удалось выполнить этап «{stageLabel}».',
  'translator.localModelIncompatible':
    'Выбранная локальная модель несовместима с текущим языком переводчика.',
  'translator.selectValidTranslationModel':
    'Выберите допустимую модель перевода для переводчика.',
  'translator.selectCustomAiTranslationProfile':
    'Выберите или сохраните пользовательский профиль перевода ИИ перед запуском.',
  'translator.localOcrModelIncompatible':
    'Выбранная локальная модель OCR несовместима с текущим языком переводчика.',
  'translator.installCompatibleOcrModel':
    'Установите совместимую модель OCR перед запуском визуального переводчика.',
  'translator.selectValidOcrModel':
    'Выберите допустимую модель OCR для визуального переводчика.',
  'modelManager.error.diskCheckFailed':
    'Не удалось проверить доступное место на диске.',
  'updater.mandatoryUpdate':
    'Это обновление обязательно. Скачайте и установите его для продолжения.',
  'translatorVisual.noImages':
    'Загрузите хотя бы одно изображение для использования визуального переводчика.',
  'translatorVisual.running.aiSfx':
    'Визуальный переводчик ИИ SFX: обнаружение, классификация, распознавание, перевод и очистка...',
  'translatorVisual.running.standard':
    'Визуальный переводчик: обнаружение, распознавание и перевод...',
  'translatorVisual.invalidSfxResponse':
    'Недопустимый ответ ИИ SFX от переводчика для «{fileName}».',
  'translatorVisual.done.aiSfx':
    'Визуальный переводчик ИИ SFX завершён. {candidates} кандидат(ов), {approved} SFX одобрено, {ocr} OCR, {translations} перевод(ов) и {redraw} область(ей) для перерисовки.',
  'translatorVisual.done.standard':
    'Визуальный переводчик завершён. {detected} область(ей) обнаружено, {recognized} текст(ов) распознано, {translations} перевод(ов) сгенерировано.',
  'translatorVisual.genericError':
    'Не удалось запустить визуальный переводчик.',
  'freeProvider.catalogOnly':
    'Провайдер «{name}» доступен только в каталоге в v1.',
  'enhanceActions.connectError':
    'Улучшение не смогло подключиться к бэкенду ({url}). Проверьте, что мини-бэкенд активен.',
  'aioSingleProcessor.invalidCleanResponse':
    'Недопустимый ответ при очистке «{fileName}».',
  'cleanerActions.detectFailed':
    'Не удалось обнаружить области для «{fileName}»: {message}',
  'cleanerActions.invalidSfxResponse':
    'Недопустимый ответ ИИ SFX-клинера для «{fileName}».',
  'cleanerActions.invalidAutoCleanResponse':
    'Недопустимый ответ автоматической ИИ-очистки для «{fileName}».',
  'cleanerActions.sfxDone':
    'ИИ SFX-клинер завершён. {images} изображение(й), {candidates} кандидат(ов), {approved} SFX одобрено и {redraw} область(ей) для перерисовки.',
  'cleanerActions.autoCleanDone':
    'Автоматическая ИИ-очистка завершена. {images} изображение(й) обработано и {detected} область(ей) обнаружено.',
  'cleanerActions.assistedDone':
    'Ассистированная очистка завершена. {images} изображение(й) очищено, {detected} область(ей) обнаружено, {recognized} текст(ов) распознано, {segmented} область(ей) сегментировано.',
  'webhook.event.processStart.label': 'Обработка начата',
  'webhook.event.processStart.desc': 'Когда запускается обработка',
  'webhook.event.processComplete.label': 'Обработка завершена',
  'webhook.event.processComplete.desc': 'Когда обработка завершается успешно',
  'webhook.event.processError.label': 'Ошибки обработки',
  'webhook.event.processError.desc': 'Когда возникает сбой',
  'webhook.event.updateAvailable.label': 'Доступно обновление',
  'webhook.event.updateAvailable.desc': 'Когда доступна новая версия',
  'webhook.event.updateDownloaded.label': 'Обновление загружено',
  'webhook.event.updateDownloaded.desc': 'Когда загрузка обновления завершена',
  'webhook.event.updateError.label': 'Ошибка обновления',
  'webhook.event.updateError.desc': 'Когда обновление завершается с ошибкой',
  'webhook.validation.urlRequired': 'Введите URL вебхука Discord.',
  'webhook.validation.urlInvalid':
    'Недействительный URL. Проверьте формат вебхука.',
  'webhook.validation.urlHttpsRequired':
    'URL вебхука должен использовать HTTPS.',
  'webhook.validation.urlNotDiscord':
    'Используйте официальный URL Discord (discord.com).',
  'webhook.validation.urlInvalidPath':
    'Путь URL не соответствует допустимому вебхуку Discord.',
  'typography.effect.none.label': 'Без эффекта',
  'typography.effect.none.description':
    'Чистый текст, без дополнительных слоёв.',
  'typography.effect.balloon_smear.label': 'Размазанный баллон',
  'typography.effect.balloon_smear.description':
    'Вертикальная серая полоса с лёгким боковым покачиванием, вдохновлённая драматической речью.',
  'typography.effect.smiles_outline.label': 'Контур SMILES',
  'typography.effect.smiles_outline.description':
    'Мягкий коралловый контур со светлым ядром, стиль нежного шёпота.',
  'typography.effect.ahnnn_peach.label': 'Персиковое свечение Ahnnn',
  'typography.effect.ahnnn_peach.description':
    'Персиковая заливка с тёплым мягким свечением.',
  'typography.effect.silence_ink.label': 'Чернила тишины',
  'typography.effect.silence_ink.description':
    'Пурпурно-синий с чистым присутствием и лёгкой внутренней глубиной.',
  'typography.effect.hwa_pastel.label': 'Пастель HWA',
  'typography.effect.hwa_pastel.description':
    'Светло-жёлтый с розовым контуром и нежным ощущением.',
  'typography.effect.hah_pop.label': 'Поп HAH',
  'typography.effect.hah_pop.description':
    'Светлое сиреневое ядро с ярким присутствием и розовым рельефом.',
  'typography.effect.smooch_jelly.label': 'Желе Smooch',
  'typography.effect.smooch_jelly.description':
    'Нежный розовый с желеобразным блеском и сладкой тенью.',
  'typography.effect.tremble_brush.label': 'Дрожащая кисть',
  'typography.effect.tremble_brush.description':
    'Энергичная сине-фиолетовая кисть с неровным краем.',
  'typography.effect.eheheh_whisper.label': 'Шёпот EHEHEH',
  'typography.effect.eheheh_whisper.description':
    'Светло-розовый с пушистым контуром и застенчивым свечением.',
  'typography.effect.hoho_ink.label': 'Чернила HOHO',
  'typography.effect.hoho_ink.description':
    'Тёмно-синий с вертикальными подтёками и сухой текстурой.',
  'typography.effect.blam_impact.label': 'Удар BLAM',
  'typography.effect.blam_impact.description':
    'Жёлтый взрыв со смещённой красной тенью.',
  'typography.effect.badump_soft.label': 'Мягкий BADUMP',
  'typography.effect.badump_soft.description':
    'Мягкий розово-пасте��ьный градиент с романтической аурой.',
  'typography.effect.thump_heavy.label': 'Тяжёлый THUMP',
  'typography.effect.thump_heavy.description':
    'Чёрный удар с жёсткой угловой тенью винного цвета.',
  'typography.effect.neon_woah.label': 'Неон WOAH',
  'typography.effect.neon_woah.description':
    'Белый текст с интенсивным розовым свечением удивления/блеска.',
  'typography.effect.slash_speed.label': 'Скоростной SLAP',
  'typography.effect.slash_speed.description':
    'Тёмная типографика с агрессивной диагональной полосой/размытием движения.',
  'typography.effect.ah_teal.label': 'Бирюзовый Ah',
  'typography.effect.ah_teal.description':
    'Аква/бирюза с тёмным контуром и нежным ощущением тихой речи.',
  'typography.effect.drip_blue.label': 'Капли DRIP Blue',
  'typography.effect.drip_blue.description':
    'Светло-голубой с жидким ощущением и эффектом капель.',
  'typography.effect.question_pop.label': 'Поп-вопрос',
  'typography.effect.question_pop.description':
    'Тёплый знак пунктуации со смещённой коралловой тенью.',
  'typography.effect.laugh_curve.label': 'Кривая смеха',
  'typography.effect.laugh_curve.description':
    'Яркий голубой для дугообразного и лёгкого смеха.',
  'typography.effect.shake_blur.label': 'Дрожащее размытие',
  'typography.effect.shake_blur.description':
    'Тёмно-фиолетовый с вибрацией/размытием движения для дрожи.',
  'typography.effect.beep_outline.label': 'Контур Beep',
  'typography.effect.beep_outline.description':
    'Белый текст с толстым чёрным контуром для чистых, читаемых SFX.',
  'typography.effect.boom_comic.label': 'Комикс BOOM',
  'typography.effect.boom_comic.description':
    'Классический жёлто-красный взрыв в стиле комиксов.',
  'typography.effect.bang_chunk.label': 'Блок BANG',
  'typography.effect.bang_chunk.description':
    'Пурпурно-синий блок с толстой смещённой золотой тенью.',
  'typography.effect.break_glitch.label': 'Глитч BREAK',
  'typography.effect.break_glitch.description':
    'Тёмная маджента с глитч-текстурой/сломанного скана.',
  'typography.effect.flinch_outline.label': 'Контур FLINCH',
  'typography.effect.flinch_outline.description':
    'Чёрный с агрессивным белым контуром для мгновенной реакции.',
  'typography.effect.growl_moss.label': 'Мох Growl',
  'typography.effect.growl_moss.description':
    'Сухой оливково-зелёный для хриплого/звериного звука.',
  'typography.effect.yawn_soft.label': 'Мягкий Yawn',
  'typography.effect.yawn_soft.description':
    'Лаймово-зелёный с фиолетовым контуром для ленивой/растянутой речи.',
  'typography.effect.scratch_noise.label': 'Шум Scratch',
  'typography.effect.scratch_noise.description':
    'Грубый чёрный с зернистым/шу��ным видом.',
  'typography.effect.crack_ink.label': 'Чернила Crack',
  'typography.effect.crack_ink.description':
    'Сухая, резкая чёрная кисть для внезапного удара.',
  'typography.effect.slap_scratch.label': 'Царапина Slap',
  'typography.effect.slap_scratch.description':
    'Тонкая растянутая линия для эффекта скрежета/быстрого удара.',
  'typography.effect.dash_edge.label': 'Край Dash',
  'typography.effect.dash_edge.description':
    'Тёмно-зелёный с острыми точками для резкого входа/удара.',
  'typography.effect.scream_scratch.label': 'Крик Scream',
  'typography.effect.scream_scratch.description':
    'Чёрный крик с грубым красным смещением.',
  'model.opus-mt-ja-en.description':
    'Конвейер OPUS-MT, опти��изированный для японского контента, с переводом на английский и вторичным потоком на португальский.',
  'model.nllb-200-600m-int8.description':
    'Мультиязычная модель NLLB, квантованная до int8 для снижения потребления памяти при сохранении хорошего качества для KO→EN/PT.',
  'model.opus-mt-zh-en.description':
    'Модель OPUS-MT для китайского с основным переводом на английский и вторичным потоком на португальский.',
  'model.nllb-200-1.3b.description':
    'Мультиязычная модель повышенного качества для общего перевода с широким охватом языков.',
  'model.nllb-200-1.3b-int8-ct2.description':
    'Квантованная версия NLLB 1.3B на CTranslate2, снижающая VRAM при отличном соотношении цена/качество.',
  'model.nllb-200-3.3b.description':
    'Высокоёмкая модель NLLB для максимального качества перевода на множество языков.',
  'model.sugoi_v4_ja_en_ct2.description':
    'Локальный переводчик с японского на английский на CTranslate2 и SentencePiece, совместимый с офлайн-потоком BallonsTranslator.',
  'model.m2m100_1_2b_ct2.description':
    'Локальный мультиязычный переводчик через CTranslate2, с широким охватом языков и совместимостью с офлайн-потоком BallonsTranslator.',
  'model.font_rtdetr_v2.description':
    'Локальная модель обнаружения текстовых областей в конвейере AIO.',
  'model.comic_text_detector.description':
    'Локальный детектор на базе модуля CTD BallonsTranslator для текстовых блоков на страницах манги.',
  'model.manga_ocr.description':
    'Локальная модель OCR для японского языка в AIO.',
  'model.meiki_ocr.description':
    'Локальный японский OCR, специализированный на отрисованном тексте, с горизонтальными и вертикальными ONNX-моделями.',
  'model.paddleocr_vl_manga.description':
    'Локальный VLM OCR, специализированный на японской манге.',
  'model.got_ocr2.description':
    'Локальный мультимодальный OCR через GOT-OCR 2.0 с нативной средой выполнения трансформеров.',
  'model.qwen2_5_vl_3b.description':
    'Локальный мультимодальный OCR через Qwen2.5-VL-3B-Instruct.',
  'model.mangalmm.description':
    'Мультимодальный OCR/понимание, специализированный на манге, на базе Qwen2.5-VL.',
  'model.rolmocr.description':
    'Надёжный локальный OCR на базе Qwen2.5-VL с оптимизацией для чтения документов.',
  'model.glm_ocr_onnx.description':
    'Локальный GLM OCR для сложных макетов с нативной средой выполнения трансформеров.',
  'model.paddleocr.description':
    'Локальная модель OCR для русского/славянских языков в конвейере AIO.',
  'model.paddleocr_latin_v5.description':
    'Локальная модель OCR для латинских языков (включая нидерландский) в конвейере AIO.',
  'model.paddleocr_ch_v5.description':
    'Локальная модель OCR для китайского языка в конвейере AIO.',
  'model.paddleocr_en_v5.description':
    'Локальная модель OCR, ориентированная на английский, для конвейера AIO.',
  'model.easyocr.description':
    'Мультиязычный локальный OCR с установкой по запросу в каталоге моделей приложения.',
  'model.pororo.description':
    'Локальная модель OCR для корейского языка в конвейере AIO.',
  'model.baka_content_cc.description':
    'Локальная модель для сегментации/уточнения текстовых областей в AIO.',
  'model.aot.description':
    'Локальная модель инпейнтинга для очистки баллонов в AIO.',
  'model.lama_manga.description':
    'Локальная модель контекстного инпейнтинга для сложных областей в AIO.',
  'model.opencv_lama.description':
    'Лёгкая локальная модель инпейнтинга через OpenCV Zoo, предназначенная для CPU и быстрого выполнения.',
  'model.lama_fp32.description':
    'Рекомендуемый ONNX-порт big-lama 512x512, подходящий для CPU/GPU при балансе качества и простоты.',
  'model.vntl_llama3_8b_v2.description':
    'Дообученная LLaMA3 для японских VN → английский. Перестроенный многострочный набор данных. Используйте temp 0. (~5.7–8.5 ГБ GGUF).',
  'model.lfm2_350m_enjp_mt.description':
    'Сверхлёгкий двунаправленный переводчик JA↔EN, 0.4B параметров. Q4_0 всего 219 МБ — идеален для CPU и маломощных устройств.',
  'model.sakura_galtransl_7b_v3_7.description':
    'Переводчик JA→ZH-CN, оптимизированный для визуальных новелл. Сохраняет переносы, управляющие символы и руби. CC-BY-NC-SA 4.0 (~4.25 ГБ IQ4_XS).',
  'model.sakura_1_5b_qwen2_5_v1_0.description':
    'Лёгкая альтернатива Sakura 7B с IMatrix-квантованием. ~1 ГБ Q5KS. Идеально для среднего GPU или CPU (~4 ГБ ОЗУ).',
  'model.hunyuan_7b_mt_v1_0.description':
    'Мультиязычный переводчик Tencent — 1-е место WMT25. 33 языка двунаправленно. Промпт: "Translate into <target_language>." (~4.2 ГБ Q4_K_M).',
  'model.pp_doclayout_v3.description':
    'Локальная модель обнаружения макета и текста на базе PP-DocLayout V3. Высокая точность для анализа макетов страниц.',
  'model.paddleocr_vl_1_5.description':
    'Высококачественная мультиязычная модель VLM OCR (PaddleOCR-VL 1.5). До 128 токенов на текстовый блок.',
  'model.waifu2x_swin_unet_art_scan_2x.description':
    'Лучший локальный вариант для страниц манги/манхвы с фокусом на лайнарт и баллоны.',
  'model.waifu2x_swin_unet_art_scan_4x.description':
    'Вариант 4x для сканированных страниц манги/манхвы.',
  'model.waifu2x_swin_unet_art_2x.description':
    'Модель 2x для чистого цифрового/аниме-арта.',
  'model.4xnomos2_hq_mosr.description':
    'Высококачественный ONNX-апскейлер 4x для минимально деградированного материала.',
  'model.4xspankendata.description':
    'Лёгкая ONNX-модель как универсальный резервный апскейлер 4x.',
  'model.2x_hfa2kcompact.description':
    'Кандидат, совместимый только через ручной импорт ONNX/внешнюю конвертацию.',
  'model.2x_digitalfilm_superultracompact.description':
    'Кандидат для ручного импорта ONNX.',
  'model.2x_anifilm_compact.description': 'Кандидат для ручного импорта ONNX.',
  'model.2xnomosuni_span_multijpg_ldl.description':
    'Кандидат для ручного импорта ONNX.',
  'model.realesrgan_x4plus.description': 'Кандидат для ручного импорта ONNX.',
  'model.4xhfa2kludvaeswinir_light.description':
    'Кандидат для ручного импорта ONNX.',
  'splitter.status.recipeApplied':
    'Рецепт разделителя применён к активному изображению.',
  'splitter.status.recipeRestored':
    'Рецепт разделителя восстановлен по умолчанию.',
  'splitter.status.exportCancelled':
    'Экспорт разделителя отменён пользователем.',
  'splitter.error.noSegmentsActive':
    'Не сгенерировано допустимых сегментов для активного изображения.',
  'splitter.error.noSegmentsBatch':
    'Не сгенерировано допустимых сегментов в пакете разделителя.',
  'aioExec.sessionUnavailable': 'Сессия недоступна для использования облачных моделей. Пожалуйста, войдите снова.',
  'aioManual.progressionNotInitialized':
    'Ручная последовательность не инициализирована для активного изображения.',
  'cleanerActions.selectValidOcrModel':
    'Выберите допустимую модель OCR для клинера.',
  'cleanerActions.invalidCleanResponseNamed':
    'Недопустимый ответ очистки для «{name}».',
  'customLlm.selectTranslationProfile':
    'Выберите сохранённый пользовательский профиль перевода.',
  'customLlm.selectOcrProfile':
    'Выберите сохранённый пользовательский профиль OCR.',
  'customLlm.profileNotFound':
    'Пользовательский профиль не найден. Перезагрузите и попробуйте снова.',
  'customLlm.translationProfileActive':
    'Пользовательский профиль используется (перевод): {label}.',
  'customLlm.ocrProfileActive':
    'Пользовательский профиль используется (OCR): {label}.',
  'accountSync.confirmEmailSent':
    'Письмо для подтверждения отправлено. Проверьте входящие.',
  'accountSync.confirmEmailFailed':
    'Не удалось отправить письмо для подтверждения.',
  'downloadActions.noTranslatorResults':
    'Нет результатов переводчика для скачивания.',
  'enhanceActions.desktopOnly':
    'Локальное улучшение доступно только в настольном приложении.',
  'enhanceActions.selectModel': 'Выберите совместимую модель улучшения.',
  'enhanceActions.done':
    'Улучшение завершено. Используйте «Скачать» для сохранения.',
  'freeProvider.stageNotSupported': 'Провайдер не поддерживает этот этап.',
  'freeProvider.activeForTranslation':
    'Провайдер {name} используется для перевода.',
  'freeProvider.activeForOcr': 'Провайдер {name} используется для OCR.',
  'freeProvider.activeForClean': 'Provider {name} используется для очистки.',
  'freeProvider.stageTranslation': 'Перевод',
  'freeProvider.stageOcr': 'OCR',
  'freeProvider.stageClean': 'Очистка',
  'translatorRetranslate.targetNotFound':
    'Целевое изображение не найдено для повторного перевода.',
  'translatorRetranslate.noTextAvailable':
    'Нет распознанного текста для повторного перевода.',
  'translatorText.done':
    'Текстовый переводчик завершён. Используйте копирование или скачивание TXT.',
  'typographer.queueApplied': 'Текст очереди применён к текущему выделению.',
  'typographer.queueAppliedMulti':
    'Текст очереди применён к {{count}} баллону(ам).',
  'typographer.queueCleared': 'Очередь наборщика очищена.',
  'typographer.queueImported': 'Текст импортирован в очередь наборщика.',
  'aioManual.invalidCleanResponse':
    'Недопустимый ответ при очистке изображения.',
  'aioStage.lang.ko': 'Корейский',
  'aioStage.lang.ja': 'Японский',
  'aioStage.lang.fr': 'Французский',
  'aioStage.lang.zh': 'Китайский',
  'aioStage.lang.zh-CN': 'Упрощённый китайский',
  'aioStage.lang.zh-TW': 'Традиционный китайский',
  'aioStage.lang.en': 'Английский',
  'aioStage.lang.ru': 'Русский',
  'aioStage.lang.de': 'Немецкий',
  'aioStage.lang.nl': 'Нидерландский',
  'aioStage.lang.es': 'Испанский',
  'aioStage.lang.it': 'Итальянский',
  'aioStage.lang.tr': 'Турецкий',
  'aioStage.lang.pl': 'Польский',
  'aioStage.lang.pt': 'Португальский',
  'aioStage.lang.pt-BR': 'Португальский (Бразилия)',
  'aioStage.lang.th': 'Тайский',
  'aioStage.lang.vi': 'Вьетнамский',
  'aioStage.lang.hu': 'Венгерский',
  'aioStage.lang.id': 'Индонезийский',
  'aioStage.lang.fi': 'Финский',
  'aioStage.lang.ar': 'Арабский',
  'splitter.warning.noIntermediateCuts': 'Промежуточные разрезы не найдены.',
  'splitter.warning.segmentTooSmall':
    'Сегмент меньше настроенной минимальной высоты.',
  'splitter.warning.segmentTooLarge':
    'Сегмент больше настроенной максимальной высоты.',
  'splitter.warning.cutsNearContent':
    'Некоторые разрезы находятся вблизи областей с содержимым.',
  'splitter.warning.nearEdge': 'Слишком близко к краю.',
  'stitch.warning.dimensionTooHigh':
    'Размер слишком велик; экспортируйте в большем количестве пакетов, чтобы избежать сбоев.',
  'stitch.warning.outputTooHeavy':
    'Результат слишком тяжёлый для предпросмотра и скачивания.',
  'stitch.warning.canvasLimit':
    'Может превысить безопасные лимиты холста в некоторых окружениях.',
  'stitch.warning.largeBatch':
    'Большой пакет; проверьте, удобен ли разрыв для сканлейта.',
  'resources.data.fontsTitle': 'Шрифты для набора',
  'resources.data.fontsDesc':
    'Подборка популярных шрифтов для сканлейта манги, манхвы и маньхуа.',
  'resources.data.onomatopoeiaDesc':
    'Библиотека японских ономатопей с переводами и примерами использования.',
  'resources.data.glossaryTitle': 'Глоссарий сканлейта',
  'resources.data.glossaryDesc':
    'Технические термины и жаргон сообщества из мира сканлейта.',
  'resources.data.catalogLabel': 'Каталог',
  'aioLocalBatch.invalidBatchResponse':
    'Недопустимый ответ пакета: batch_report.json отсутствует в ZIP.',
  'modelDownload.desktopOnly':
    'Управление моделями доступно только в настольном приложении.',
  'settings.updates.channelBeta': 'Бета',
  'settings.updates.channelStable': 'Стабильный',
  'settings.presets.aio.defaultName': 'Пресет',
  'settings.integrations.blogger.term.googleCloudConsole':
    'Google Cloud Console',
  'settings.integrations.blogger.term.bloggerApiV3': 'Blogger API v3',
  'settings.integrations.blogger.term.googleDriveApi': 'Google Drive API',
  'settings.integrations.blogger.term.oauthClientId': 'OAuth Client ID',
  'settings.integrations.blogger.term.clientId': 'Client ID',
  'settings.integrations.blogger.term.clientSecret': 'Client Secret',
  'settings.integrations.blogger.term.oauthPlayground': 'OAuth Playground',
  'settings.integrations.blogger.term.exchangeCodeForTokens':
    'Обменять код на токены',
  'settings.integrations.blogger.term.refreshToken': 'Refresh Token',
  'settings.integrations.blogger.term.cloudName': 'cloud name',
  'settings.integrations.blogger.term.blogId': 'Blog ID',
  'settings.integrations.imgur.term.clientId': 'Client ID',
  'settings.integrations.imgur.term.rateLimit': '50 загрузок/час',
  'settings.shortcuts.topbarPath': 'Верхняя панель > Горячие клавиши',
  'login.warning.versionPrefix': 'v{version}',
  'password.policy.minLength': 'Пароль должен содержать не менее 12 символов.',
  'password.policy.uppercase':
    'Пароль должен содержать хотя бы одну заглавную букву.',
  'password.policy.lowercase':
    'Пароль должен содержать хотя бы одну строчную букву.',
  'password.policy.number': 'Пароль должен содержать хотя бы одну цифру.',
  'password.policy.special':
    'Пароль должен содержать хотя бы один специальный символ.',
  'auth.sfx.primary': '쾅',
  'auth.sfx.secondary': '휙',
  'auth.stats.activeScanlatorsValue': '2.4k+',
  'auth.stats.toolsValue': '50+',
  'auth.stats.pagesProcessedValue': '1M+',
  'auth.community.joinIndicator': '+',
  'resources.sfx.onomatopoeiaLabel': 'Ономатопея',
  'resources.page.shortcutCtrl': 'Ctrl',
  'resources.page.shortcutFind': 'F',
  'settings.integrations.blogger.value.requestsPerDay': '10 000',
  'settings.integrations.blogger.value.requestsPerUser': '100/100с',
  'settings.integrations.imgur.authorizationHeaderExample':
    'Authorization: Client-ID …',
  'settings.shortcuts.quickKey': 'H',
  'guides.search.keyArrowUp': '↑',
  'guides.search.keyArrowDown': '↓',
  'guides.search.keyArrowPair': '↑↓',
  'guides.search.keyEnter': '⏎',
  'guides.search.keyEscape': 'Esc',
  'settings.typographerLibrary.presetsCount_one': '{count} пресет',
  'settings.typographerLibrary.presetsCount_other': '{count} пресетов',
  'renderPreview.iconUppercase': 'AA',
  'renderPreview.iconHorizontal': 'Г',
  'renderPreview.iconVertical': 'В',
  'renderPreview.iconCircular': '◯',
  'guides.home.searchShortcut': '⌘K',
  'brand.name': 'KŌMA',
  'brand.studioSuffix': 'Studio',
  'versionBadge.stable': 'СТАБИЛЬНАЯ',
  'versionBadge.beta': 'БЕТА',
  'versionBadge.tooltip': 'Версия {version}',
  'settings.typography.iconBold': 'Ж',
  'settings.typography.iconItalic': 'К',
  'settings.typography.iconUppercase': 'AA',
  'settings.downloadFormat.jpeg': 'JPEG',
  'settings.downloadFormat.png': 'PNG',
  'settings.downloadFormat.webp': 'WebP',
  'common.infoGlyph': 'i',
  'modelManager.tooltip.speed.ok': 'ОК',
  'update.units.bytes': 'Б',
  'update.units.kilobytes': 'КБ',
  'update.units.megabytes': 'МБ',
  'update.units.gigabytes': 'ГБ',
  'update.units.perSecond': '/с',
  'update.versionPrefix': 'v{version}',
  'update.toast.newVersionFallback': 'новая',
  'dashboard.status.cloudSuffix': '(Облако)',
  'dashboard.status.cloudApiSuffix': '(Облако/API/ИИ)',
  'dashboard.status.pendingCustomTranslationName':
    'Пользовательский ИИ (синхронизац��я...)',
  'dashboard.status.pendingCustomOcrName':
    'Пользовательский OCR (синхронизация...)',
  'modelManager.tooltip.gpu': 'GPU',
  'modelManager.tooltip.vram': 'VRAM',
  'modelManager.tooltip.ram': 'ОЗУ',
  'dashboard.tour.preview.welcome.upload': 'Загрузить',
  'dashboard.tour.preview.welcome.export': 'Экспорт',
  'dashboard.tour.preview.upload.formats':
    'JPG · PNG · WEBP · ZIP · PDF · CBZ · CB7 · PSD',
  'dashboard.tour.preview.stageEmpty':
    'Загрузите изображения для начала работы',
  'dashboard.tour.welcome.title':
    'Добро пожаловать на панель управления KŌMA Studio',
  'dashboard.tour.welcome.body':
    'Этот тур проведёт вас по основному рабочему процессу: организация страниц, выбор режимов, настройка конвейера AIO и экспорт результатов без необходимости угадывать, где находится каждая функция.',
  'dashboard.tour.sidebar.title':
    'Боковая панель: квота, файлы и контекст пакета',
  'dashboard.tour.sidebar.body':
    'Здесь вы отслеживаете тариф и ежемесячное использование, выбираете активное изображение, меняете порядок страниц, удаляете элементы и поддерживаете порядок в пакете перед обработкой.',
  'dashboard.tour.upload.title': 'Начальный ввод файлов',
  'dashboard.tour.upload.body':
    'Область загрузки принимает отдельные изображения и полные пакеты. Это отправная точка для перетаскивания глав, исходников или ресурсов для остальных инструментов.',
  'dashboard.tour.modes.title': 'Основная навигация панели',
  'dashboard.tour.modes.body':
    'Используйте «Организацию» для подготовки пакета и AIO для полного конвейера. Другие группы верхней панели открывают специализированные режимы, не покидая рабочую область.',
  'dashboard.tour.production.title':
    'Производство: специализированные инструменты',
  'dashboard.tour.production.body':
    'Клинер, наборщик, переводчик, поставщик исходников и КК покрывают ручной и продвинутый рабочий процесс. Считайте эту группу профессиональными режимами для работы на конкретном этапе главы.',
  'dashboard.tour.utils.title': 'Утилиты и поддержка',
  'dashboard.tour.utils.body':
    'Склейка, разделение, водяные знаки и улучшение обрабатывают быструю подготовку и экспорт. Руководства и ресурсы дополняют область поддержки для справки.',
  'dashboard.tour.submode.title': 'Автоматический AIO vs. ручной',
  'dashboard.tour.submode.body':
    'Автоматический запускает полный конвейер пакетно. Ручной разблокирует каждый этап для каждого изображения для детальной проверки, навигации назад/вперёд и контролируемого визуального редактирования.',
  'dashboard.tour.pipeline.title': 'Конвейер AIO',
  'dashboard.tour.pipeline.body':
    'Эта карточка управляет последовательностью Обнаружение > OCR > Перевод > Сегментация > Очистка > Рендер. Вы можете включать или отключать этапы и в ручном режиме запускать только текущий этап.',
  'dashboard.tour.stageConfig.title': 'Настройка этапов',
  'dashboard.tour.stageConfig.body':
    'Здесь вы найдёте языки, пресеты AIO, локальные/облачные каталоги и выбор модели для каждого этапа. Это центр принятия решений для настройки стоимости, качества и скорости.',
  'dashboard.tour.stage.withImagesTitle':
    'Рабочая область и визуальный предпросмотр',
  'dashboard.tour.stage.withImagesBody':
    'При наличии изображений этот этап становится основным предпросмотром: вы перемещаетесь по страницам, видите результаты по этапам и работаете непосредственно с активным изображением.',
  'dashboard.tour.stage.emptyTitle': 'Центральный этап панели управления',
  'dashboard.tour.stage.emptyBody':
    'Без изображений этап показывает простое пустое состояние. После загрузки здесь отображаются предпросмотры, наложения, области и результаты по режимам.',
  'dashboard.tour.manualDock.title': 'Интерактивн��й предпросмотр и ручной док',
  'dashboard.tour.manualDock.body':
    'С активным изображением в ручном AIO плавающий док разблокирует выбор области, кисть, ластик, палочку, восстановление и контекстные настройки без выхода из предпросмотра.',
  'dashboard.tour.download.title': 'Экспорт и скачивание',
  'dashboard.tour.download.body':
    'Когда у приложения есть готовые результаты, это меню собирает форматы изображений, пакеты, многослойные PSD и варианты метаданных для завершения рабочего процесса доставки.',
  'dashboard.tour.replay.title': 'Если хотите повторить тур позже',
  'dashboard.tour.replay.body':
    'Откройте меню пользователя и используйте <strong>Повторить обучение</strong>. Автоматический онбординг запускается только при первом посещении текущей версии, но ручной повтор всегда доступен.',
  'dashboard.tour.progressText': 'Шаг {{current}} из {{total}}',
  'dashboard.tour.next': 'Далее',
  'dashboard.tour.prev': 'Назад',
  'dashboard.tour.done': 'Завершить тур',
  'dashboard.tour.dialogLabel': 'Тур по панели управления',
  'dashboard.tour.close': 'Закрыть тур',
  'dashboard.tour.nextAria': 'Перейти к следующему шагу',
  'dashboard.tour.prevAria': 'Вернуться к предыдущему шагу',
  'modelManager.tooltip.rich.highlights': 'Особенности',
  'modelManager.tooltip.rich.unique': 'Уникальная функция',
  'modelManager.tooltip.rich.bestFor': 'Лучше всего для',
  'modelManager.tooltip.rich.performance': 'Производительность',
  'modelManager.tooltip.rich.notes': 'Заметки',
  'modelManager.tooltip.docsUrl': 'Посмотреть документацию',
  'modelManager.tooltip.notes': 'Заметки',
  'modelManager.tooltip.highlights': 'Особенности',
  'modelManager.tooltip.bestFor': 'Лучше всего для',
  'modelManager.tooltip.unique': 'Уникальная функция',
  'modelManager.tooltip.performance': 'Производительность',

  'model.tooltip.opus-mt-ja-en.highlights':
    'Переводит с японского на английский\nЛёгкая и быстрая, хорошо работает без GPU\nХороший вариант для начала',
  'model.tooltip.opus-mt-ja-en.unique':
    'Хорошо работает с общим японским текстом, но не была специально разработана для манги',
  'model.tooltip.opus-mt-ja-en.bestFor':
    'Быстрый перевод с японского на английский, когда нет мощного GPU',
  'model.tooltip.opus-mt-ja-en.performance':
    'Очень быстрая, работает на любом компьютере без GPU',
  'model.tooltip.opus-mt-ja-en.notes':
    'Хороший общий вариант, но для манги и аниме Sugoi даёт лучшие результаты',

  'model.tooltip.nllb-200-600m-int8.highlights':
    'Переводит между почти 200 языками\nЛёгкая и оптимизированная версия\nХорошо работает на любом компьютере',
  'model.tooltip.nllb-200-600m-int8.unique':
    'Одна модель переводит между сотнями языков — идеальна, когда нужна универсальность',
  'model.tooltip.nllb-200-600m-int8.bestFor':
    'Перевод между редкими языками или когда нужна модель, работающая для всего',
  'model.tooltip.nllb-200-600m-int8.performance':
    'Быстрая и лёгкая, хорошо работает даже на компьютерах без GPU',
  'model.tooltip.nllb-200-600m-int8.notes':
    'Не разработана для манги, но работает как универсальный переводчик для множества языков',

  'model.tooltip.opus-mt-zh-en.highlights':
    'Переводит с китайского на английский\nЛёгкая и быстрая\nРаботает без GPU',
  'model.tooltip.opus-mt-zh-en.unique':
    'Ориентирована на китайский → английский, хороша для маньхуа и общего китайского контента',
  'model.tooltip.opus-mt-zh-en.bestFor':
    'Быстрый перевод маньхуа и китайского контента на английский',
  'model.tooltip.opus-mt-zh-en.performance':
    'Очень быстрая, работает на любом компьютере без GPU',
  'model.tooltip.opus-mt-zh-en.notes':
    'Популярная и надёжная для переводов китайский → английский',

  'model.tooltip.nllb-200-1.3b.highlights':
    'Переводит между почти 200 языками\nЛучшее качество, чем у лёгкой версии\nХороша для редких языков',
  'model.tooltip.nllb-200-1.3b.unique':
    'Средняя версия с лучшим качеством, чем 600M, но не такая тяжёлая, как 3.3B',
  'model.tooltip.nllb-200-1.3b.bestFor':
    'Когда нужно лучшее качество, чем у лёгкой версии, особенно для редких языков',
  'model.tooltip.nllb-200-1.3b.performance':
    'Требует GPU с минимум 4 ГБ VRAM; приемлемая скорость',
  'model.tooltip.nllb-200-1.3b.notes':
    'Хороший баланс между качеством и размером. Не разработана для манги.',

  'model.tooltip.nllb-200-1.3b-int8-ct2.highlights':
    'Переводит между почти 200 языками\nОптимизированная версия с меньшим потреблением памяти\nХорошее качество при низком потреблении ресурсов',
  'model.tooltip.nllb-200-1.3b-int8-ct2.unique':
    'То же качество, что и у версии 1.3B, но с меньшим потреблением памяти — лучшее соотношение цена/качество',
  'model.tooltip.nllb-200-1.3b-int8-ct2.bestFor':
    'Мультиязычный перевод хорошего качества без мощного компьютера',
  'model.tooltip.nllb-200-1.3b-int8-ct2.performance':
    'Работает на CPU при необходимости; легче стандартной версии 1.3B',
  'model.tooltip.nllb-200-1.3b-int8-ct2.notes':
    'Оптимизированная версия NLLB 1.3B — используйте, если хотите сэкономить память',

  'model.tooltip.nllb-200-3.3b.highlights':
    'Лучшее качество среди мультиязычных переводчиков\nПочти 200 языков\nИдеальна, когда качество важнее скорости',
  'model.tooltip.nllb-200-3.3b.unique':
    'Самая мощная и точная версия мультиязычного семейства — лучший доступный перевод для редких языков',
  'model.tooltip.nllb-200-3.3b.bestFor':
    'Когда качество перевода важнее скорости',
  'model.tooltip.nllb-200-3.3b.performance':
    'Требует хороший GPU с минимум 8 ГБ VRAM; медленнее других',
  'model.tooltip.nllb-200-3.3b.notes':
    'Тяжелее, но с лучшим качеством. Не разработана для манги.',

  'model.tooltip.sugoi_v4_ja_en_ct2.highlights':
    'Переводит с японского на английский\nСпециально разработана для манги и аниме\nРаботает на любом компьютере',
  'model.tooltip.sugoi_v4_ja_en_ct2.unique':
    'Лучше понимает сленг, разговорную речь и типичные выражения манги/аниме, чем другие переводчики',
  'model.tooltip.sugoi_v4_ja_en_ct2.bestFor':
    'Перевод манги и аниме с японского на английский — самый рекомендуемый выбор сообщества',
  'model.tooltip.sugoi_v4_ja_en_ct2.performance':
    'Очень быстрая, хорошо работает даже без выделенного GPU',
  'model.tooltip.sugoi_v4_ja_en_ct2.notes':
    'Используйте эту модель по умолчанию для переводов японский → английский',

  'model.tooltip.m2m100_1_2b_ct2.highlights':
    'Переводит между 100 языками\nОхватывает корейский, тайский, вьетнамский и другие\nОптимизированная версия для лучшей производительности',
  'model.tooltip.m2m100_1_2b_ct2.unique':
    'Одна из немногих моделей, которая хорошо переводит между азиатскими языками — корейский, тайский, вьетнамский на английский',
  'model.tooltip.m2m100_1_2b_ct2.bestFor':
    'Перевод корейской манхвы, китайской маньхуа и контента на других азиатских языках на английский',
  'model.tooltip.m2m100_1_2b_ct2.performance':
    'Требует GPU с 4–6 ГБ VRAM; хорошая скорость с оптимизированной версией',
  'model.tooltip.m2m100_1_2b_ct2.notes':
    'Хороший вариант для азиатских языков, которые другие переводчики не охватывают хорошо',

  'model.tooltip.vntl_llama3_8b_v2.highlights':
    'Переводит с японского на английский\nРазработана для визуальных новелл и манги\nСохраняет единообразие имён персонажей',
  'model.tooltip.vntl_llama3_8b_v2.unique':
    'Понимает контекст истории и поддерживает единообразие имён персонажей и терминов по всему тексту',
  'model.tooltip.vntl_llama3_8b_v2.bestFor':
    'Перевод визуальных новелл и манги с длинными диалогами, где важно единообразие имён',
  'model.tooltip.vntl_llama3_8b_v2.performance':
    'Требует хороший GPU с 6–10 ГБ VRAM; медленнее простых переводчиков',
  'model.tooltip.vntl_llama3_8b_v2.notes':
    'Идеальна для длинных проектов, где важно единообразие имён и терминов',

  'model.tooltip.lfm2_350m_enjp_mt.highlights':
    'Переводит японский ↔ английский в обоих направлениях\nСверхлёгкая и быстрая\nРаботает на любом компьютере',
  'model.tooltip.lfm2_350m_enjp_mt.unique':
    'Один из самых маленьких доступных переводчиков — работает даже на слабых компьютерах и всё равно даёт приемлемые результаты',
  'model.tooltip.lfm2_350m_enjp_mt.bestFor':
    'Когда нужен быстрый перевод японский-английский без мощного GPU',
  'model.tooltip.lfm2_350m_enjp_mt.performance':
    'Чрезвычайно быстрая, работает на любом компьютере даже без GPU',
  'model.tooltip.lfm2_350m_enjp_mt.notes':
    'Базовое качество — хороша для быстрых черновиков, но не для финального результата',

  'model.tooltip.sakura_galtransl_7b_v3_7.highlights':
    'Переводит с японского на китайский\nЛучшая для гальге и манги\nСохраняет форматирование и специальные примечания',
  'model.tooltip.sakura_galtransl_7b_v3_7.unique':
    'Сохраняет специальное форматирование, примечания к чтению и переносы строк — необходимо для гальге и манги со сложным текстом',
  'model.tooltip.sakura_galtransl_7b_v3_7.bestFor':
    'Лучший вариант для перевода с японского на китайский, когда качество важнее скорости',
  'model.tooltip.sakura_galtransl_7b_v3_7.performance':
    'Требует GPU с минимум 6 ГБ VRAM; умеренная скорость',
  'model.tooltip.sakura_galtransl_7b_v3_7.notes':
    'Лучший перевод JP→ZH. Используйте, когда качество приоритетно.',

  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.highlights':
    'Переводит с японского на китайский\nЛёгкая и быстрая версия\nХороша для менее мощных компьютеров',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.unique':
    'Та же семья, что и большая Sakura, но оптимизирована для работы на компьютерах с меньшим объёмом памяти',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.bestFor':
    'Перевод с японского на китайский, когда нет мощного GPU',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.performance':
    'Быстрая, требует всего 1–2 ГБ VRAM',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.notes':
    'Хорошее качество для своего размера — идеальна, если большая модель слишком тяжёлая',

  'model.tooltip.hunyuan_7b_mt_v1_0.highlights':
    'Переводит между 36 языками\nВысокое качество, отмеченное наградами\nМощная модель для многих языков',
  'model.tooltip.hunyuan_7b_mt_v1_0.unique':
    'Один из самых награждённых переводчиков в мире — комбинирует множество переводов для лучшего результата',
  'model.tooltip.hunyuan_7b_mt_v1_0.bestFor':
    'Когда нужен высококачественный перевод между множеством разных языков',
  'model.tooltip.hunyuan_7b_mt_v1_0.performance':
    'Требует GPU с 6–8 ГБ VRAM; умеренная скорость',
  'model.tooltip.hunyuan_7b_mt_v1_0.notes':
    'Отлично подходит для мультиязычных проектов, где качество приоритетно',

  'model.tooltip.font_rtdetr_v2.highlights':
    'Обнаруживает баллоны и текст в комиксах\nИдентифицирует текст внутри и снаружи баллонов\nВсё за один проход',
  'model.tooltip.font_rtdetr_v2.unique':
    'Единственная модель, которая обнаруживает баллоны, текст внутри баллонов и свободный текст на странице одновременно',
  'model.tooltip.font_rtdetr_v2.bestFor':
    'Полный анализ страницы комикса — автоматически разделяет диалоги от свободного текста',
  'model.tooltip.font_rtdetr_v2.performance':
    'Лёгкая и быстрая, хорошо работает на большинстве компьютеров',
  'model.tooltip.font_rtdetr_v2.notes':
    'Обучена на манге, вебтунах, маньхуа и западных комиксах',

  'model.tooltip.comic_text_detector.highlights':
    'Обнаруживает текст в комиксах и манге\nОригинальная и надёжная модель\nБыстро работает на любом компьютере',
  'model.tooltip.comic_text_detector.unique':
    'Классический детектор, используемый как основа многими проектами перевода манги',
  'model.tooltip.comic_text_detector.bestFor':
    'Базовое и надёжное обнаружение текста в комиксах — хороший выбор по умолчанию',
  'model.tooltip.comic_text_detector.performance':
    'Быстрая, хорошо работает без выделенного GPU',
  'model.tooltip.comic_text_detector.notes':
    'Классическая модель, проверенная сообществом на протяжении многих лет',

  'model.tooltip.pp_doclayout_v3.highlights':
    'Анализирует макет сканированных страниц\nРаботает даже с наклонёнными или искривлёнными страницами\nОпределяет правильный порядок чтения',
  'model.tooltip.pp_doclayout_v3.unique':
    'Может понять страницы, сфотографированные под углом или отсканированные неровно — то, что другие модели не умеют',
  'model.tooltip.pp_doclayout_v3.bestFor':
    'Несовершенно отсканированные страницы, фото книг или сложные макеты с трудным порядком чтения',
  'model.tooltip.pp_doclayout_v3.performance':
    'Надёжная и стабильная, хорошо работает при различных условиях освещения',
  'model.tooltip.pp_doclayout_v3.notes':
    'Полезна, когда страницы не идеально оцифрованы',

  'model.tooltip.manga_ocr.highlights':
    'Читает японский текст в манге\nРаботает с вертикальным и горизонтальным текстом\nСамая рекомендуемая для японской манги',
  'model.tooltip.manga_ocr.unique':
    'Специально разработана для задач манги: вертикальный текст, фуригана, стилизованные шрифты и изображения низкого качества',
  'model.tooltip.manga_ocr.bestFor':
    'Выбор по умолчанию для чтения японского текста манги — работает хорошо сразу, без настройки',
  'model.tooltip.manga_ocr.performance':
    'Популярная и надёжная, используется многими проектами сканлейта',
  'model.tooltip.manga_ocr.notes':
    'Лучший вариант для японской манги. Если нужна скорость, рассмотрите Meiki OCR.',

  'model.tooltip.meiki_ocr.highlights':
    'Сверхбыстрое чтение японского текста\nОбнаруживает каждый символ по отдельности\nИдеальна для горизонтального текста',
  'model.tooltip.meiki_ocr.unique':
    'Намного быстрее других читателей японского текста — идеальна, когда скорость приоритетна',
  'model.tooltip.meiki_ocr.bestFor':
    'Когда нужно быстро прочитать горизонтальный японский текст',
  'model.tooltip.meiki_ocr.performance':
    'Чрезвычайно быстрая, одна из самых быстрых для японского',
  'model.tooltip.meiki_ocr.notes':
    'Работает только с горизонтальным текстом — для вертикального используйте Manga OCR',

  'model.tooltip.paddleocr_vl_manga.highlights':
    'Читатель текста, оптимизированный для манги\nРаботает с вертикальным и горизонтальным текстом\nГораздо точнее на манге, чем базовая модель',
  'model.tooltip.paddleocr_vl_manga.unique':
    'Специально обучена на страницах манги — лучше понимает стилизованные шрифты и баллоны, чем универсальные читатели',
  'model.tooltip.paddleocr_vl_manga.bestFor':
    'Чтение текста манги с высокой точностью, особенно когда текст использует сложные шрифты',
  'model.tooltip.paddleocr_vl_manga.performance':
    'Хорошая точность на манге; также работает с другими языками',
  'model.tooltip.paddleocr_vl_manga.notes':
    'Специализированная версия PaddleOCR для манги — отличный выбор для сканлейта',

  'model.tooltip.got_ocr2.highlights':
    'Читает текст из документов, таблиц и графиков\nПонимает математические формулы и ноты\nУниверсальна для различных типов документов',
  'model.tooltip.got_ocr2.unique':
    'Выходит за рамки простого текста — умеет читать таблицы, формулы и форматированные графики',
  'model.tooltip.got_ocr2.bestFor':
    'Чтение сложных документов с таблицами и форматированием — не идеальна для манги',
  'model.tooltip.got_ocr2.performance':
    'Лёгкая и универсальная, хорошо работает для документов в целом',
  'model.tooltip.got_ocr2.notes':
    'Мультиязычная, но не оптимизирована для манги — для комиксов используйте другие модели',

  'model.tooltip.qwen2_5_vl_3b.highlights':
    'Умно понимает изображения\nВыходит за рамки чтения текста — понимает, что на изображении\nМультиязычная и универсальная',
  'model.tooltip.qwen2_5_vl_3b.unique':
    'Не просто читает текст — понимает панели манги, описывает сцены и извлекает организованную информацию из изображения',
  'model.tooltip.qwen2_5_vl_3b.bestFor':
    'Когда нужно, чтобы модель понимала содержимое изображения, а не просто читала текст',
  'model.tooltip.qwen2_5_vl_3b.performance':
    'Средний размер; хорошая скорость на обычных GPU',
  'model.tooltip.qwen2_5_vl_3b.notes':
    'Мультиязычная. Полезна для анализа панелей и продвинутого визуального понимания',

  'model.tooltip.mangalmm.highlights':
    'Понимает панели манги как человек-читатель\nИдентифицирует персонажей и сюжетные элементы\nВыходит за рамки простого чтения текста',
  'model.tooltip.mangalmm.unique':
    'Единственная модель, специально разработанная для понимания манги — распознаёт персонажей, панели и визуальное повествование',
  'model.tooltip.mangalmm.bestFor':
    'Продвинутый анализ манги: понимание, кто говорит, что происходит на панелях',
  'model.tooltip.mangalmm.performance':
    'Требует мощный GPU с 14 ГБ VRAM; ещё в стадии исследования',
  'model.tooltip.mangalmm.notes':
    'Экспериментальная модель — перспективна для будущего сканлейта, но пока не зрелая',

  'model.tooltip.rolmocr.highlights':
    'Быстрый читатель текста для документов\nХорошо работает со сложными макетами\nЛёгкая и быстрая альтернатива',
  'model.tooltip.rolmocr.unique':
    'Быстрее и легче аналогичных моделей при сохранении хорошего качества чтения документов',
  'model.tooltip.rolmocr.bestFor':
    'Чтение документов со сложными макетами, когда важна скорость',
  'model.tooltip.rolmocr.performance':
    'Быстрая и эффективная; хороший баланс между скоростью и качеством',
  'model.tooltip.rolmocr.notes':
    'Не специализирована для манги — лучше для документов и общего текста',

  'model.tooltip.glm_ocr_onnx.highlights':
    'Компактный и точный читатель текста\nОдин из самых точных в бенчмарках\nХорошо работает на менее мощных компьютерах',
  'model.tooltip.glm_ocr_onnx.unique':
    'Сочетает высокую точность с малым размером — один из самых точных, будучи при этом лёгким',
  'model.tooltip.glm_ocr_onnx.bestFor':
    'Чтение документов с высокой точностью без мощного компьютера',
  'model.tooltip.glm_ocr_onnx.performance':
    'Очень лёгкая и быстрая; хорошо работает даже на компьютерах без мощного GPU',
  'model.tooltip.glm_ocr_onnx.notes':
    'Поддерживает множество языков, но японский ограничен. Отлична для документов в целом.',

  'model.tooltip.paddleocr.highlights':
    'Читает русский текст\nБыстрая и надёжная\nХо��оший вариант для русской манхвы',
  'model.tooltip.paddleocr.unique':
    'Специально оптимизирована для кириллицы — лучше универсальных читателей для русского',
  'model.tooltip.paddleocr.bestFor':
    'Чтение русского текста в комиксах и манге',
  'model.tooltip.paddleocr.performance':
    'Очень быстрая, хорошо работает на большинстве компьютеров',
  'model.tooltip.paddleocr.notes': 'Лучший выбор для русского текста',

  'model.tooltip.paddleocr_latin_v5.highlights':
    'Читает текст на европейских языках\nФранцузский, немецкий, испанский, португальский и другие\nБыстрая и надёжная',
  'model.tooltip.paddleocr_latin_v5.unique':
    'Оптимизирована для европейских алфавитов — работает лучше универсальных читателей для этих языков',
  'model.tooltip.paddleocr_latin_v5.bestFor':
    'Чтение текста на европейских языках: французский, немецкий, испанский, итальянский, португальский',
  'model.tooltip.paddleocr_latin_v5.performance':
    'Быстрая и лёгкая, работает на любом компьютере',
  'model.tooltip.paddleocr_latin_v5.notes':
    'Лучший вариант для европейских языков с латиницей',

  'model.tooltip.paddleocr_ch_v5.highlights':
    'Читает упрощённый и традиционный китайский текст\nБыстрая и точная\nИдеальна для маньхуа',
  'model.tooltip.paddleocr_ch_v5.unique':
    'Специально оптимизирована для китайских иероглифов — лучше распознаёт сложные штрихи и разнообразные шрифты',
  'model.tooltip.paddleocr_ch_v5.bestFor':
    'Чтение текста маньхуа и любого китайского контента с высокой точностью',
  'model.tooltip.paddleocr_ch_v5.performance':
    'Быстрая и лёгкая, хорошо работает на большинстве компьютеров',
  'model.tooltip.paddleocr_ch_v5.notes':
    'Лучший выбор для китайского. Проста и эффективна.',

  'model.tooltip.paddleocr_en_v5.highlights':
    'Читает английский текст\nБыстрая и точная\nИдеальна для западных комиксов',
  'model.tooltip.paddleocr_en_v5.unique':
    'Специально оптимизирована для английского — лучше распознаёт разнообразные шрифты и стили',
  'model.tooltip.paddleocr_en_v5.bestFor':
    'Чтение английского текста из западных комиксов и переведённой манги',
  'model.tooltip.paddleocr_en_v5.performance':
    'Очень быстрая и лёгкая, работает на любом компьютере',
  'model.tooltip.paddleocr_en_v5.notes': 'Лучший выбор для английского текста',

  'model.tooltip.easyocr.highlights':
    'Читает текст на более чем 80 языках\nПроста в использовании и универсальна\nНесколько языков на одном изображении',
  'model.tooltip.easyocr.unique':
    'Одна из самых универсальных — может читать множество языков на одном изображении',
  'model.tooltip.easyocr.bestFor':
    'Когда нужен читатель для многих языков без переключения моделей',
  'model.tooltip.easyocr.performance':
    'Хороша для чистого текста; затрудняется со стилизованными шрифтами и вертикальным текстом',
  'model.tooltip.easyocr.notes':
    'Не оптимизирована для манги. Полезна как универсальный мультиязычный вариант.',

  'model.tooltip.pororo.highlights':
    'Читает корейский текст\nИдеальна для корейской манхвы\nЛёгкая и надёжная',
  'model.tooltip.pororo.unique':
    'Специально разработана для корейского алфавита (хангыль) — лучше распознаёт, чем универсальные читатели',
  'model.tooltip.pororo.bestFor':
    'Чтение текста корейской манхвы — лучший специализированный вариант для корейского',
  'model.tooltip.pororo.performance':
    'Хорошая точность для корейского; лёгкая и быстрая',
  'model.tooltip.pororo.notes':
    'Только корейский и английский. Поддерживается сообществом.',

  'model.tooltip.paddleocr_vl_1_5.highlights':
    'Продвинутый мультиязычный читатель текста\nОдин из самых точных в мире\nРаботает с японским, китайским, английским и другими',
  'model.tooltip.paddleocr_vl_1_5.unique':
    'Может обнаруживать текст неправильной и полигональной формы — читает изогнутый, наклонённый и неудобно расположенный текст',
  'model.tooltip.paddleocr_vl_1_5.bestFor':
    'Продвинутое чтение текста для документов и комиксов на множестве языков',
  'model.tooltip.paddleocr_vl_1_5.performance':
    'Точная и универсальная; хорошо работает на обычных GPU',
  'model.tooltip.paddleocr_vl_1_5.notes':
    'Мультиязычная, включая японский, китайский, английский. Основа для дообучения на манге.',

  'model.tooltip.aot.highlights':
    'Удаляет японский текст из манги\nАвтоматически восстанавливает фоновый рисунок\nБыстрая и эффективная',
  'model.tooltip.aot.unique':
    'Специально разработана для удаления текста из манги — понимает художественный стиль и естественно восстанавливает фон',
  'model.tooltip.aot.bestFor':
    'Удаление японского текста из панелей манги с восстановлением фонового рисунка',
  'model.tooltip.aot.performance': 'Быстрая, хорошо работает с GPU и без',
  'model.tooltip.aot.notes':
    'Хороший вариант по умолчанию для очистки текста в манге',

  'model.tooltip.lama_manga.highlights':
    'Удаляет текст из манги и аниме\nРаботает с изображениями любого размера\nХорошо справляется с большими текстовыми областями',
  'model.tooltip.lama_manga.unique':
    'Нет ограничений по размеру изображения — работает со страницами любого разрешения, в отличие от других моделей',
  'model.tooltip.lama_manga.bestFor':
    'Удаление текста со страниц манги любого размера, особенно крупных текстовых блоков и баллонов',
  'model.tooltip.lama_manga.performance':
    'Принимает любой размер изображения; хорошая скорость на большинстве компьютеров',
  'model.tooltip.lama_manga.notes':
    'Улучшенная версия LaMa — используйте, когда страница большая или содержит много текста для удаления',

  'model.tooltip.opencv_lama.highlights':
    'Удаляет текст с изображений\nЛёгкая и простая версия\nХороша для общего использования',
  'model.tooltip.opencv_lama.unique':
    'Официальная версия, поддерживаемая OpenCV — прямая и надёжная интеграция',
  'model.tooltip.opencv_lama.bestFor':
    'Базовое и быстрое удаление текста, когда не нужно наивысшее качество',
  'model.tooltip.opencv_lama.performance':
    'Лёгкая и быстрая, работает на любом компьютере',
  'model.tooltip.opencv_lama.notes':
    'Хороший лёгкий вариант для простой очистки текста',

  'model.tooltip.lama_fp32.highlights':
    'Удаляет текст с изображений с высоким качеством\nЛучшее качество среди средств удаления текста\nИдеальна, когда качество важнее скорости',
  'model.tooltip.lama_fp32.unique':
    'Самая точная и верная версия LaMa — воспроизводит фон более естественно, чем лёгкие версии',
  'model.tooltip.lama_fp32.bestFor': 'Когда качество очистки важнее скорости',
  'model.tooltip.lama_fp32.performance':
    'Медленнее лёгких версий; требует больше памяти',
  'model.tooltip.lama_fp32.notes':
    'Используйте, когда качество приоритетно. Фиксированный размер ввода.',

  'model.tooltip.waifu2x_swin_unet_art_scan_2x.highlights':
    'Увеличивает аниме-сканы в 2 раза\nУдаляет шум и улучшает качество\nИдеальна для сканов манги',
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.unique':
    'Классика для улучшения сканов аниме и манги — удаляет шум и улучшает изображение одновременно',
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.bestFor':
    'Улучшение сканов манги низкого разрешения и удаление артефактов JPEG-сжатия',
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.performance':
    'Лёгкая и быстрая, работает на любом компьютере',
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.notes':
    'Хороший вариант по умолчанию для увеличения сканов манги в 2 раза',

  'model.tooltip.waifu2x_swin_unet_art_scan_4x.highlights':
    'Увеличивает аниме-сканы в 4 раза\nУдаляет шум и улучшает качество\nДля случаев, когда нужно больше деталей',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.unique':
    'Версия 4x классического Waifu2x — значительно повышает разрешение, сохраняя чистые линии',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.bestFor':
    'Улучшение сканов манги с большим увеличением разрешения при сохранении чистого лайнарта',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.performance':
    'Медленнее версии 2x; по-прежнему лёгкая',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.notes':
    'Используйте, когда нужно большее разрешение, чем предлагает версия 2x',

  'model.tooltip.waifu2x_swin_unet_art_2x.highlights':
    'Увеличивает аниме-арт в 2 раза\nДля уже чистого, качественного арта\nСохраняет мелкие детали',
  'model.tooltip.waifu2x_swin_unet_art_2x.unique':
    'Оптимизирована для уже чистого арта — сохраняет мелкие детали без добавления шума',
  'model.tooltip.waifu2x_swin_unet_art_2x.bestFor':
    'Улучшение чистого цифрового арта и манги, уже имеющей хорошее качество исходника',
  'model.tooltip.waifu2x_swin_unet_art_2x.performance':
    'Лёгкая и быстрая, работает на любом компьютере',
  'model.tooltip.waifu2x_swin_unet_art_2x.notes':
    'Менее агрессивна, чем версия для сканов — используйте, когда изображение уже чистое',

  'model.tooltip.4xnomos2_hq_mosr.highlights':
    'Увеличивает изображения в 4 раза с максимальным качеством\nСохраняет мелкие детали и чёткие линии\nИдеальна для уже чистых сканов',
  'model.tooltip.4xnomos2_hq_mosr.unique':
    'Ориентирована на качество — сохраняет каждую деталь оригинального изображения',
  'model.tooltip.4xnomos2_hq_mosr.bestFor':
    'Улучшение уже чистых и качественных сканов манги',
  'model.tooltip.4xnomos2_hq_mosr.performance':
    'Хорошая скорость; маленький размер файла всего 16 МБ',
  'model.tooltip.4xnomos2_hq_mosr.notes':
    'Лучше всего работает с уже чистыми изображениями. Если изображение шумное или сжатое, сначала очистите.',

  'model.tooltip.4xspankendata.highlights':
    'Увеличивает изображения в 4 раза очень быстро\nКрошечный размер файла всего 1.6 МБ\nХорошо работает даже на слабых компьютерах',
  'model.tooltip.4xspankendata.unique':
    'Чрезвычайно лёгкая — идеальна, когда нужна скорость без занятия места',
  'model.tooltip.4xspankendata.bestFor':
    'Быстрое увеличение любого типа изображений, когда время важно',
  'model.tooltip.4xspankendata.performance':
    'Очень быстрая; размер файла всего 1.6 МБ — идеальна для CPU',
  'model.tooltip.4xspankendata.notes':
    'Удивительно маленькая для качества, которое выдаёт. Отличный вариант для пакетной обработки.',

  'model.tooltip.2x_hfa2kcompact.highlights':
    'Увеличивает изображения в 2 раза с хорошим балансом\nОбучена на современных аниме-кадрах\nХорошо справляется со сжатием и размытием',
  'model.tooltip.2x_hfa2kcompact.unique':
    'Специалист по аниме — понимает визуальный стиль современных анимаций',
  'model.tooltip.2x_hfa2kcompact.bestFor':
    'Страницы манги/аниме с артефактами сжатия или неоднородным качеством',
  'model.tooltip.2x_hfa2kcompact.performance':
    'Быстрая и лёгкая; размер файла всего 4.6 МБ',
  'model.tooltip.2x_hfa2kcompact.notes':
    'Надёжна для реальных изображений — хорошо работает даже с несовершенными сканами.',

  'model.tooltip.2x_digitalfilm_superultracompact.highlights':
    'Увеличивает изображения в 2 раза с минимальным размером\nИдеальна при ограниченном дисковом пространстве\nХорошее качество для своего размера',
  'model.tooltip.2x_digitalfilm_superultracompact.unique':
    'Ультракомпактная — помещается где угодно без потери качества',
  'model.tooltip.2x_digitalfilm_superultracompact.bestFor':
    'Лёгкое увеличение, когда нужно сэкономить место или память',
  'model.tooltip.2x_digitalfilm_superultracompact.performance':
    'Быстрая; ~20 МБ; может потребоваться ручная конвертация формата',
  'model.tooltip.2x_digitalfilm_superultracompact.notes':
    'Если файл не загружается, может потребоваться внешняя конвертация формата.',

  'model.tooltip.2x_anifilm_compact.highlights':
    'Увеличивает изображения в 2 раза, оптимизировано для аниме\nХороший баланс между качеством и размером\nВизуальный стиль сохранён',
  'model.tooltip.2x_anifilm_compact.unique':
    'Понимает визуальный стиль аниме и анимационных фильмов — сохраняет оригинальную эстетику',
  'model.tooltip.2x_anifilm_compact.bestFor':
    'Аниме-контент, где хотите сохранить оригинальный вид без перебора',
  'model.tooltip.2x_anifilm_compact.performance':
    'Быстрая; ~20 МБ; может потребоваться ручная конвертация формата',
  'model.tooltip.2x_anifilm_compact.notes':
    'Если файл не загружается, может потребоваться внешняя конвертация формата.',

  'model.tooltip.2xnomosuni_span_multijpg_ldl.highlights':
    'Увеличивает изображения в 2 раза с устойчивостью к сжатию\nОбучена для разных уровней качества JPG\nНадёжна для несовершенных сканов',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.unique':
    'Специалист по JPEG-сжатию — хорошо работает даже со сканами низкого качества',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.bestFor':
    'Сканы манги с различным JPEG-сжатием или артефактами качества',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.performance':
    'Быстрая; ~20 МБ; может потребоваться ручная конвертация формата',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.notes':
    'Если файл не загружается, может потребоваться внешняя конвертация формата.',

  'model.tooltip.realesrgan_x4plus.highlights':
    'Увеличивает изображения в 4 раза с высокой универсальностью\nХорошо справляется с JPEG, размытием и шумом\nРаботает с любым типом контента',
  'model.tooltip.realesrgan_x4plus.unique':
    'Самая универсальная — понимает и исправляет различные типы деградации изображения',
  'model.tooltip.realesrgan_x4plus.bestFor':
    'Страницы манги со смешанным контентом; артефакты JPEG; самый универсальный апскейлер',
  'model.tooltip.realesrgan_x4plus.performance':
    'Хорошая скорость; немного тяжелее компактных',
  'model.tooltip.realesrgan_x4plus.notes':
    'Для чистых аниме/манги предпочтите аниме-версию (6B), которая быстрее и оптимизированнее.',

  'model.tooltip.4xhfa2kludvaeswinir_light.highlights':
    'Увеличивает изображения в 4 раза, оптимизировано для аниме\nХороший баланс между качеством и производительностью\nСохраняет визуальный стиль аниме',
  'model.tooltip.4xhfa2kludvaeswinir_light.unique':
    'Сочетает качество увеличения с вниманием к визуальным деталям аниме',
  'model.tooltip.4xhfa2kludvaeswinir_light.bestFor':
    'Увеличение аниме-контента в 4 раза с хорошим качеством исходника',
  'model.tooltip.4xhfa2kludvaeswinir_light.performance':
    'Умеренная скорость; ~70 МБ; может потребоваться ручная конвертация формата',
  'model.tooltip.4xhfa2kludvaeswinir_light.notes':
    'Если файл не загружается, может потребоваться внешняя конвертация формата.',

  'model.tooltip.baka_content_cc.highlights':
    'Разделяет текст и баллоны на страницах комиксов\nОпределяет, что является текстом, а что баллоном\nБыстрая и эффективная',
  'model.tooltip.baka_content_cc.unique':
    'Интегрирована с системой обнаружения текста и баллонов — работает совместно с другими моделями',
  'model.tooltip.baka_content_cc.bestFor':
    'Разделение текста и баллонов на страницах манги для дальнейшей обработки',
  'model.tooltip.baka_content_cc.performance':
    'Быстрая и лёгкая, не требует мощного GPU',
  'model.tooltip.baka_content_cc.notes':
    'Используется как часть конвейера сегментации',
  'settings.tooltips.title': 'Подсказки',
  'settings.tooltips.description':
    'Управляйте, когда контекстные подсказки появляются при использовании панели управления.',
  'settings.tooltips.enableTitle': 'Показывать контекстные подсказки',
  'settings.tooltips.enableDesc':
    'Отображает анимированные подсказки при первом использовании каждого инструмента за сессию.',
  'dashboard.hint.healing.ariaLabel': 'Подсказка по инструменту восстановления',
  'dashboard.hint.healing.eyebrow': 'Новый инструмент',
  'dashboard.hint.healing.body':
    'Используйте восстанавливающую кисть для удаления дефектов, сломанных краёв и остатков текста. Закрасьте область, которую хотите исправить, и нажмите «Применить», чтобы ИИ плавно восстановил область.',
  'dashboard.hint.healing.footer':
    'Эта подсказка больше не появится в этой сессии. Отключите все подсказки в Настройки → Приложение.',
  'dashboard.aio.presets.tooltip':
    'Предустановки сохраняют комбинацию моделей и этапов для каждого языка. Используйте их для быстрого переключения настроек AIO при изменении исходного языка или рабочего процесса.',
  'dashboard.aio.presets.tooltipAria': 'Назначение языковых предустановок',
  'dashboard.aio.cleanImage.tooltip':
    'Clean Image — этап очистки и заполнения. Он удаляет текст и выбранные артефакты перед финальной отрисовкой/редактированием.',
  'dashboard.aio.cleanImage.tooltipAria': 'Назначение этапа Clean Image',
  'dashboard.aio.clean.maskDilation.tooltip':
    'Расширяет маску очистки перед заполнением. Увеличьте значение, если остаются края текста; оставьте меньше, чтобы сохранить близкие элементы изображения.',
  'dashboard.aio.clean.maskDilation.tooltipAria': 'Назначение расширения маски',
  'dashboard.dashboardLlm.hdStrategy.tooltip':
    'Определяет способ подготовки больших изображений перед очисткой. Resize масштабирует страницу, Crop разбивает на фрагменты, Original отправляет как есть.',
  'dashboard.dashboardLlm.hdStrategy.tooltipAria': 'Назначение стратегии HD',
  'dashboard.dashboardLlm.cropMargin.tooltip':
    'Добавляет дополнительный отступ вокруг каждого фрагмента. Увеличьте его, если границы теряют контекст или появляются швы после очистки.',
  'dashboard.dashboardLlm.cropMargin.tooltipAria':
    'Назначение отступа фрагмента',
  'dashboard.dashboardLlm.cropTriggerSize.tooltip':
    'Минимальный размер изображения, при котором активируется разбиение на фрагменты. Меньшие изображения остаются одним куском; большие разбиваются на фрагменты.',
  'dashboard.dashboardLlm.cropTriggerSize.tooltipAria':
    'Назначение порога размера фрагмента',
  'common.basicInfo': "Основная информация",
  'common.resolve': "Решить",
  'common.dismiss': "Отклонить",
  'common.title': "Заголовок",
  'common.summary': "Краткое описание",
  'common.summaryPlaceholder': "Напишите короткое и понятное описание.",
  'common.mainDescription': "Основное описание",
  'common.chapter': "Глава",
  'common.genres': "Жанры",
  'common.editorialDescription': "Редакционное описание",
  'common.removeValue': "Удалить {value}",
  'settings.integrations.discordWebhook': "Discord Webhook",
  'discord.presence.appName': "KŌMA Studio",
  'discord.presence.button.website': "Сайт",
  'discord.presence.button.download': "Скачать",
  'discord.presence.idle.details': "Изучает инструменты scanlation",
  'discord.presence.idle.state': "Ожидание",
  'discord.presence.workspace.details': "Упорядочивает страницы и готовит процесс",
  'discord.presence.aio.details': "Запускает полный конвейер обработки манги",
  'discord.presence.mode.automatic': "Автоматический режим",
  'discord.presence.mode.manual': "Ручной режим",
  'discord.presence.mode.basic': "Режим: Базовый",
  'discord.presence.mode.advanced': "Режим: Продвинутый",
  'discord.presence.cleaner.details': "Очищает баблы и восстанавливает рисунок",
  'discord.presence.cleaner.state.basic': "Режим: Базовый",
  'discord.presence.cleaner.state.advanced': "Режим: Продвинутый",
  'discord.presence.translator.details': "Переводит реплики, сохраняя тон",
  'discord.presence.translator.fileDetails': "Перевод - {fileName}",
  'discord.presence.typesetter.details': "Возвращает финальный текст на страницу",
  'discord.presence.typesetter.fileDetails': "Редактирование текста - {fileName}",
  'discord.presence.redraw.fileDetails': "Перерисовка - {fileName}",
  'discord.presence.raw.details': "Тестирует провайдеров и сравнивает сырые результаты",
  'discord.presence.proofreader.details': "Проверяет страницы перед финальным релизом",
  'discord.presence.stitch.details': "Склеивает панели в длинные цельные страницы",
  'discord.presence.split.details': "Разделяет развороты на аккуратные страницы",
  'discord.presence.watermark.details': "Добавляет кредиты и фирменные метки",
  'discord.presence.enhance.details': "Улучшает разрешение и чёткость арта",
  'discord.presence.optimizer.details': "Доводит главы до экспорта и публикации",
  'discord.presence.blogger.details': "Готовит публикации глав и CDN-доставку",
  'discord.presence.imgur.details': "Загружает наборы изображений и делится ссылками",
  'discord.presence.guides.details': "Изучает процессы, горячие клавиши и практики",
  'discord.presence.resources.details': "Просматривает ресурсы, референсы и материалы помощи",
  'discord.presence.batch.details': "Обрабатывает страницы одну за другой",
  'discord.presence.batch.fileDetails': "Обработка пакета - {fileName}",
  'discord.presence.batch.state': "{current}/{total} файлов",
  'discord.presence.batch.label': "Пакетный режим",
  'discord.presence.section.working': "Работа в разделе {section}",
  'discord.presence.section.viewing': "Просмотр раздела {section}",
  'discord.presence.settings.details': "Настраивает параметры студии",
  'discord.presence.settings.label': "Настройки",
  'discord.presence.rankings.details': "Сравнивает качество, скорость и стоимость моделей",
  'discord.presence.rankings.label': "Рейтинги",
  'discord.presence.scanlationFeed.details': "Просматривает релизы и новости сообщества",
  'discord.presence.scanlationFeed.label': "Лента сканлейта",
  'discord.presence.loginRegister.details': "Входит и управляет доступом к аккаунту",
  'discord.presence.loginRegister.label': "Вход / Регистрация",
  'typographer.shapeApplied': "Форма применена.",
  'feed.tabsAria': "Разделы Scanlation Feed",
  'feed.actions.publishPost': "Опубликовать {type}",
} as const;
