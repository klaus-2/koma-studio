import { TranslationCatalog } from '../messages';

export const jaMessages: TranslationCatalog = {
  'app.restricted.title': 'アクセス制限',
  'app.restricted.description':
    'このバージョンは公式デスクトップアプリでのみ利用可能です。',
  'app.restricted.publicDocs': '法的文書は引き続き公開されています：',
  'app.transition.loading': '読み込み中...',
  'app.transition.enterDashboard': 'ダッシュボードに移動中...',
  'app.transition.updateSession': 'セッションを更新中...',
  'app.transition.openFeed': 'スキャンレーションフィードを開いています...',
  'app.transition.openRankings': 'モデルランキングを開いています...',
  'app.transition.openSettings': '設定を開いています...',
  'app.session.validating': 'セッションを検証中...',
  'settings.tabs.general': '一般',
  'settings.tabs.presets': 'プリセット',
  'settings.tabs.integrations': '連携',
  'shortcutModal.title': 'ショートカットセンター',
  'shortcutModal.subtitle':
    'グローバルショートカットはダッシュボード上でのみ有効です。テキスト入力欄では動作しません。',
  'shortcutModal.hotkeyHint': 'Hキーで開く',
  'shortcutModal.close': '閉じる',
  'shortcutModal.instructionPrefix': '',
  'shortcutModal.instructionRecord': '記録',
  'shortcutModal.instructionSuffix':
    ' をクリックし、任意のキーの組み合わせを押してください。競合は自動的に検出されます。',
  'shortcutModal.searchPlaceholder':
    'ショートカット、アクション、キーを検索...',
  'shortcutModal.results_one': '{count} 件の結果',
  'shortcutModal.results_other': '{count} 件の結果',
  'shortcutModal.recording': '記録中…',
  'shortcutModal.record': '記録',
  'shortcutModal.restoreDefault': 'デフォルトに戻す',
  'shortcutModal.clearShortcut': 'ショートカットをクリア',
  'shortcutModal.conflict': '競合：「{label}」（{combo}）',
  'shortcutModal.fixedShortcuts': '固定コンテキストショートカット',
  'shortcutModal.fixed': '固定',
  'shortcutModal.noResults':
    '「{query}」に一致するショートカットが見つかりません。',
  'shortcutModal.restoreAll': 'すべて復元',
  'toolbar.modelSelect.label': '翻訳モデル',
  'toolbar.modelSelect.manage': 'モデルを管理',
  'toolbar.modelSelect.select': 'モデルを選択',
  'toolbar.modelSelect.groupLocal': '── ローカルモデル（インストール済み）──',
  'toolbar.modelSelect.groupCloud': '── クラウド / API / AI ──',
  'toolbar.modelSelect.localPrefix': '[ローカル]',
  'toolbar.modelSelect.cloudPrefix': '[クラウド]',
  'toolbar.modelSelect.updateAvailable': '（アップデートあり）',
  'toolbar.modelSelect.installedCount_one': '{count} モデルインストール済み',
  'toolbar.modelSelect.installedCount_other': '{count} モデルインストール済み',
  'toolbar.modelSelect.updates_one': '{count} 件の保留中のアップデート',
  'toolbar.modelSelect.updates_other': '{count} 件の保留中のアップデート',
  'toolbar.modelSelect.noUpdates': '保留中のアップデートはありません',
  'toolbar.modelSelect.emptyState':
    '{source} → {target} に対応するモデルがありません。',
  'toolbar.modelSelect.incompatibleWarning':
    '"{model}" は {source} → {target} をサポートしていません。互換性のあるモデルを選択するか、対象言語を変更してください。',
  'settings.tabs.app': 'アプリケーション',
  'settings.backToDashboard': 'ダッシュボードに戻る',
  'settings.stats.version': 'バージョン',
  'settings.app.updater.status.idle': '待機中',
  'settings.app.updater.status.checking': '確認中…',
  'settings.app.updater.status.available': 'アップデートあり',
  'settings.app.updater.status.notAvailable': '最新です',
  'settings.app.updater.status.downloading': 'ダウンロード中…',
  'settings.app.updater.status.downloaded': 'インストール準備完了',
  'settings.app.updater.status.error': 'エラー',
  'settings.app.updater.channel.stable': '安定版（推奨）',
  'settings.app.updater.channel.beta': 'ベータ版（先行機能）',
  'settings.app.updater.channel.canary': 'Canary（不安定）',
  'settings.app.updater.version': 'バージョン',
  'settings.app.updater.build': 'ビルド',
  'settings.app.updater.releaseNotes': 'リリースノート',
  'settings.app.updater.noNotes': 'このバージョンのノートはありません。',
  'settings.app.updater.checkNow': 'アップデートを確認',
  'settings.app.updater.installNow': '再起動してアップデート',
  'settings.app.updater.desktopOnly': 'デスクトップアプリでのみ利用可能です。',
  'settings.app.updater.autoCheck': '自動確認',
  'settings.app.updater.autoCheckDesc':
    '起動時に新しいバージョンを確認します。',
  'settings.app.updater.channel': 'アップデートチャンネル',
  'settings.app.updater.channelDesc': '安定版または実験版リリース。',
  'settings.app.fonts.title': 'システムフォント',
  'settings.app.fonts.desc':
    'タイプセッターおよびレンダリング用のフォントを管理します。',
  'settings.app.fonts.systemCount': '{count} 個のフォントを検出',
  'settings.app.fonts.customTitle': 'カスタムフォント',
  'settings.app.fonts.import': '.ttf / .otf をインポート',
  'settings.app.fonts.noCustom': 'カスタムフォントはインポートされていません。',
  'settings.app.fonts.importSuccess':
    'フォント「{name}」を正常にインポートしました。',
  'settings.app.fonts.importError': 'フォントのインポートに失敗しました。',
  'settings.app.fonts.deleteConfirm': 'フォント「{name}」を削除しますか？',
  'settings.app.autosave.title': 'ワークスペースの自動保存',
  'settings.app.autosave.desc':
    'プロジェクトの進行状況をローカルに自動保存します。',
  'settings.app.autosave.enabled': '自動保存を有効にする',
  'settings.app.autosave.interval': '間隔（分）',
  'settings.app.autosave.saveNow': '設定を保存',
  'settings.app.autosave.success': '自動保存の設定を更新しました。',
  'settings.app.autosave.error': '設定の保存に失敗しました。',
  'settings.app.reset.title': '危険な操作',
  'settings.app.reset.desc':
    'ローカルデータを消去し、デフォルト設定に戻します。',
  'settings.app.reset.button': 'アプリケーションをリセット',
  'settings.app.reset.confirm':
    'サインアウトし、すべてのローカルプリセットとキャッシュが消去されます。続行しますか？',
  'settings.app.reset.success':
    'アプリケーションをリセットしました。再起動中...',
  'settings.general.profile.title': 'プロフィール',
  'settings.general.profile.desc': 'アカウント情報とグローバル設定。',
  'settings.general.profile.name': '表示名',
  'settings.general.profile.email': 'メインメールアドレス',
  'settings.general.profile.verified': 'メール認証済み',
  'settings.general.profile.unverified': 'メール未認証',
  'settings.general.profile.verifyBtn': '今すぐ認証',
  'settings.general.profile.sending': '送信中...',
  'settings.general.profile.verifySuccess': '認証メールを送信しました。',
  'settings.general.profile.verifyError': 'メールの送信に失敗しました。',
  'settings.general.profile.save': 'プロフィールを保存',
  'settings.general.profile.success': 'プロフィールを更新しました。',
  'settings.general.profile.error': 'プロフィールの更新に失敗しました。',
  'settings.general.travel.title': 'トラベルトークン',
  'settings.general.travel.desc':
    'サインアウトせずに他のデバイスからStudioアカウントにアクセスできます。',
  'settings.general.travel.active': '有効なトークン',
  'settings.general.travel.inactive': '有効なトークンはありません',
  'settings.general.travel.generate': '新しいトークンを生成',
  'settings.general.travel.generateDesc': '{days} 日間有効です。',
  'settings.general.travel.copyAria': 'トークンをコピー',
  'settings.general.travel.revoke': 'すべて無効化',
  'settings.general.travel.revoked': 'トークンを無効化しました。',
  'settings.general.travel.success': 'トークンを正常に生成しました。',
  'settings.general.travel.error': 'トークンの処理に失敗しました。',
  'settings.general.language.title': 'インターフェース',
  'settings.general.language.desc': 'アプリの言語とテーマ。',
  'settings.general.language.label': '言語',
  'settings.general.language.system': 'システムに従う',
  'settings.general.theme.label': 'テーマ',
  'settings.general.theme.dark': 'ダーク（デフォルト）',
  'settings.general.theme.light': 'ライト',
  'settings.general.theme.amoled': 'OLED / ブラック',
  'settings.presets.aio.title': 'AIOプリセット',
  'settings.presets.aio.desc':
    '各ステージと言語のデフォルトモデルを設定します。',
  'settings.presets.aio.active': '{lang} 用のアクティブなプリセット',
  'settings.presets.aio.none': 'プリセットが設定されていません。',
  'settings.presets.aio.create': '新しいプリセット',
  'settings.presets.aio.edit': 'プリセットを編集',
  'settings.presets.aio.delete': 'プリセットを削除',
  'settings.presets.aio.name': 'プリセット名',
  'settings.presets.aio.lang': 'ソース言語',
  'settings.presets.aio.models': 'モデル設定',
  'settings.presets.aio.save': 'プリセットを保存',
  'settings.presets.aio.success': 'プリセットを正常に保存しました。',
  'settings.presets.aio.error': 'プリセットの保存に失敗しました。',
  'settings.presets.typo.title': 'タイプセッタープリセット',
  'settings.presets.typo.desc':
    '事前設定済みのフォントスタイル、色、吹き出し。',
  'settings.presets.render.title': 'レンダリングスタイル',
  'settings.presets.render.desc': '最終画像へのテキスト描画方法を設定します。',
  'settings.integrations.discord.title': 'Discord Webhook',
  'settings.integrations.discord.desc': 'サーバーへの自動通知。',
  'settings.integrations.discord.url': 'Webhook URL',
  'settings.integrations.discord.test': '接続テスト',
  'settings.integrations.discord.events': 'トリガーイベント',
  'settings.integrations.discord.success':
    '設定を保存し、テストを送信しました。',
  'settings.integrations.discord.error':
    'Webhookの保存またはテストに失敗しました。',
  'settings.integrations.discord.invalidUrl': '無効なWebhook URLです。',
  'settings.integrations.blogger.successSecure':
    'Blogger設定をデスクトップのセキュアストレージに保存しました。',
  'settings.integrations.blogger.successLocal':
    'Blogger設定をローカルに保存しました。',
  'settings.integrations.blogger.saveError':
    'Blogger設定の保存に失敗しました。',
  'settings.integrations.blogger.testError':
    'Blogger接続の検証に失敗しました。',
  'settings.integrations.imgur.successSecure':
    'Imgur設定をデスクトップのセキュアストレージに保存しました。',
  'settings.integrations.imgur.successLocal':
    'Imgur設定をローカルに保存しました。',
  'settings.integrations.imgur.saveError': 'Imgur設定の保存に失敗しました。',
  'settings.travel.blocked.notDesktop':
    '認証済みデスクトップアプリでのみ利用可能です。',
  'settings.travel.blocked.noEmail':
    'この環境ではメール送信が設定されていません。',
  'settings.travel.blocked.validating': 'メール設定を検証中…',
  'settings.integrations.blogger.title': 'Blogger CDN',
  'settings.integrations.blogger.desc': '画像ホスティングとダイレクト公開。',
  'settings.integrations.imgur.desc':
    '匿名アップロード用のクライアントIDローテーション。',
  'settings.theme.title': '外観',
  'settings.theme.description':
    'インターフェースのダークモードとライトモードを選択します。',
  'settings.theme.dark': 'ダーク',
  'settings.theme.darkDesc': 'デフォルトのダークインターフェース',
  'settings.theme.light': 'ライト',
  'settings.theme.lightDesc': 'ライトインターフェース',
  'settings.language.title': 'インターフェース言語',
  'settings.language.description':
    'アプリの言語を選択します。デスクトップ版では、初回検出時にシステムの優先言語が使用されます。',
  'settings.language.label': '言語',
  'settings.language.systemLabel': 'システム検出',
  'settings.language.applied':
    '変更は即座に適用され、開発版およびパッケージ版のこのデバイスに保存されます。',
  'auth.tabs.login': 'サインイン',
  'auth.tabs.register': 'アカウント作成',
  'auth.legal.reviewDocs': '続行する前に、以下の法的文書をご確認ください：',
  'auth.quote.line1': 'すべての物語は',
  'auth.quote.line2': 'たった一ページから',
  'auth.quote.line3': '始まる。',
  'auth.stats.activeScanlators': 'アクティブユーザー',
  'auth.stats.tools': 'ツール',
  'auth.stats.pagesProcessed': '処理済みページ',
  'auth.toolkit.ai': 'AI・自動化',
  'auth.toolkit.tools': 'ツール',
  'auth.toolkit.learning': 'ラーニング',
  'auth.toolkit.aiTranslation': 'AI翻訳',
  'auth.toolkit.autoRedraw': '自動リドロー',
  'auth.toolkit.advancedEditor': '高度なエディター',
  'auth.toolkit.proTypesetting': 'プロ仕様タイプセッティング',
  'auth.toolkit.qualityControl': '品質管理',
  'auth.toolkit.guides': 'ガイド・チュートリアル',
  'auth.toolkit.resources': 'リソース・素材',
  'auth.community.join': 'コミュニティに参加',
  'auth.cover.popular': '人気',
  'auth.cover.new': '新着',
  'auth.cover.cleanRedraw': 'クリーン＋リドロー',
  'auth.cover.translation': '翻訳',
  'auth.cover.typography': 'タイポグラフィ',
  'auth.cover.fullEditing': 'フル編集',
  'auth.cover.allInOne': 'AIO - オールインワン',
  'auth.cover.finalQc': 'クリーンアップ',
  'login.subtitle.credentials':
    'アカウントにサインインして、前回の続きから始めましょう。',
  'login.subtitle.travel':
    'サインインフローを中断せずに、このコンピューターを一時的に認証します。',
  'login.error.completeCaptchaTravel':
    'このコンピューターの認証を完了するにはキャプチャを完了してください。',
  'login.error.completeCaptcha': '続行するにはキャプチャを完了してください。',
  'login.error.missingCredentials':
    '戻ってアカウントのメールアドレスとパスワードを入力してから、このコンピューターを認証してください。',
  'login.error.missingTravelToken':
    'サインインを完了するには、メールで受信したトークンを入力してください。',
  'login.error.generic': 'サインインに失敗しました',
  'login.warning.mandatoryUpdateTitle': '必須アップデートがあります',
  'login.warning.mandatoryUpdateBody':
    'アプリを引き続き使用するには、バージョン {version} をインストールしてください。',
  'login.warning.downloadUpdate': 'アップデートをダウンロード',
  'login.warning.downloadingUpdate': 'アップデートをダウンロード中...',
  'login.warning.installUpdateNow': '今すぐアップデートをインストール',
  'login.verification.title': '対処方法',
  'login.verification.wait': '{seconds} 秒お待ちください。',
  'login.verification.retrySameDevice':
    '同じデバイスまたはネットワークから再度サインインしてください。',
  'login.verification.avoidVpn':
    'この期間中はVPNやネットワークの切り替えを避けてください。',
  'login.email': 'メールアドレス',
  'login.password': 'パスワード',
  'login.forgotPassword': 'パスワードを忘れた方',
  'login.rememberMe': 'このデバイスでログイン状態を保持',
  'login.travel.eyebrow': 'セキュリティチェック',
  'login.travel.title': 'このコンピューターには一時的な認証が必要です',
  'login.travel.copy':
    'メインPCでKŌMA Studioを開き、設定 > トラベルアクセスからコードを送信して、このサインインを完了してください。',
  'login.travel.accountInUse': '使用中のアカウント：{email}',
  'login.travel.sameAccount':
    'メインPCで既に開いている同じアカウントを使用してください。',
  'login.travel.emailDisabled': 'この環境ではメール送信が設定されていません。',
  'login.travel.emailEnabled':
    'コードはアカウントのメインメールアドレスに送信されます。',
  'login.travel.step1': 'メインコンピューターでアプリを開きます。',
  'login.travel.step2': 'アカウントのメールアドレスにトークンを送信します。',
  'login.travel.step3':
    '以下にコードを貼り付けて、このコンピューターを認証します。',
  'login.travel.tokenLabel': 'トラベルトークン',
  'login.travel.tokenPlaceholder': 'メールで受信したコードを貼り付け',
  'login.button.authorizing': '認証中...',
  'login.button.validating': '検証中...',
  'login.button.updateRequired':
    'サインインするにはアプリをアップデートしてください',
  'login.button.retryIn': '{seconds}秒後に再試行',
  'login.button.authorizeComputer': 'このコンピューターを認証',
  'login.button.login': 'アカウントにサインイン',
  'login.button.changeAccount': '戻ってアカウントを切り替え',
  'login.emailPlaceholder': 'you@email.com',
  'login.passwordPlaceholder': '••••••••',
  'login.warning.latestVersion': '最新',
  'login.newHere': '初めての方へ',
  'login.createFreeAccount': '無料アカウントを作成',
  'register.subtitle':
    'アカウントを作成して、数多くのタイトルを探索しましょう。',
  'register.error.passwordMismatch': 'パスワードが一致しません。',
  'register.error.completeCaptcha':
    '登録を完了するにはキャプチャを完了してください。',
  'register.error.acceptTerms':
    'アカウントを作成するには、利用規約とプライバシーポリシーに同意する必要があります。',
  'register.error.generic': '登録に失敗しました',
  'register.displayName': '表示名',
  'register.displayNamePlaceholder': 'お名前を入力してください',
  'register.password': 'パスワード',
  'register.passwordPlaceholder': '8文字以上',
  'register.confirmPassword': 'パスワード確認',
  'register.confirmPasswordPlaceholder': 'パスワードを再入力',
  'register.legalPrefix': '以下を読み、同意します：',
  'register.legalSuffix':
    '登録には必要最小限のCookieが使用されること、またバグ報告や連携などの機能は上記の文書に基づくことを理解しています。',
  'register.button.creating': 'アカウントを作成中...',
  'register.button.loginNow': '今すぐサインイン',
  'legal.links.terms': '利用規約',
  'legal.links.privacy': 'プライバシーポリシー',
  'legal.links.cookies': 'Cookieポリシー',
  'legal.links.content': 'コンテンツに関する注意事項',
  'transition.tips.loading': '読み込み中...',
  'transition.tips.preparing': 'スタジオを準備中...',
  'transition.tips.opening': '編集スペースを開いています...',
  'transition.tips.organizing': 'パネルを整理中...',
  'transition.tips.warming': 'ツールをウォームアップ中...',
  'transition.tips.workflow': 'ワークフローを読み込み中...',
  'transition.ariaLabel': 'ページ読み込み中',
  'ranking.discover.title': '最初のレビューを書く',
  'ranking.discover.subtitle': '現在のフィルターでレビューがない公式モデル。',
  'ranking.discover.available': '{count} 件利用可能',
  'ranking.discover.empty':
    'フィルター対象のすべてのモデルにレビューがあります。',
  'ranking.discover.local': 'ローカル',
  'ranking.discover.cloud': 'クラウド',
  'legalHub.version': 'バージョン',
  'legalHub.updatedAt': '更新日',
  'register.button.create': 'アカウントを作成',
  'register.alreadyHaveAccount': 'すでにアカウントをお持ちですか？',
  'password.rule.minLength': '8文字以上',
  'password.rule.uppercase': '大文字',
  'password.rule.lowercase': '小文字',
  'password.rule.number': '数字',
  'password.rule.special': '特殊文字',
  'password.level.veryWeak': '非常に弱い',
  'password.level.weak': '弱い',
  'password.level.fair': '普通',
  'password.level.good': '良い',
  'password.level.strong': '強い',
  'captcha.loadError': 'Turnstileスクリプトの読み込みに失敗しました',
  'captcha.missingSiteKey':
    'キャプチャは有効ですが、VITE_TURNSTILE_SITE_KEY が設定されていません。',
  'captcha.initError': 'キャプチャの初期化に失敗しました',
  'captcha.securityCheck': 'セキュリティチェック',
  'captcha.loadScriptError': 'Turnstileスクリプトの読み込みに失敗しました',
  'captcha.success': 'キャプチャの検証に成功しました。',
  'forgot.title': 'パスワードの回復',
  'forgot.subtitle':
    'パスワードリセットリンクを受信するメールアドレスを入力してください。',
  'forgot.success':
    'このメールアドレスに関連するアカウントが存在する場合、パスワードリセットの手順が送信されます。',
  'forgot.error': 'パスワードリセットのリクエストに失敗しました',
  'forgot.button.sending': '送信中...',
  'forgot.button.send': 'リセットリンクを送信',
  'forgot.remembered': 'パスワードを思い出しましたか？',
  'forgot.backToLogin': 'サインインに戻る',
  'reset.title': '新しいパスワード',
  'reset.subtitle': 'アカウント用の強力なパスワードを設定してください。',
  'reset.error.missingToken': 'リセットトークンが見つからないか無効です。',
  'reset.error.generic': 'パスワードのリセットに失敗しました',
  'reset.success': 'パスワードをリセットしました。サインインできます。',
  'reset.newPassword': '新しいパスワード',
  'reset.button.submitting': 'リセット中...',
  'reset.button.submit': 'パスワードをリセット',
  'verify.title': 'メール認証',
  'verify.subtitle.pending':
    'すべての機能を利用するにはメールアドレスを確認してください。',
  'verify.subtitle.done': 'メールアドレスは既に確認済みです。',
  'verify.noEmail': 'メールなし',
  'verify.verified': '認証済み',
  'verify.success': '確認メールを送信しました。受信トレイをご確認ください。',
  'verify.error': 'メールの送信に失敗しました',
  'verify.button.sending': '送信中...',
  'verify.button.resend': '認証メールを再送信',
  'verify.button.alreadyConfirmed': 'メールは既に確認済みです',
  'verify.button.backDashboard': 'ダッシュボードに戻る',
  'confirm.title.verifying': 'メールを確認中...',
  'confirm.title.success': 'メールが確認されました！',
  'confirm.title.error': '確認に失敗しました',
  'confirm.subtitle.verifying': '確認リンクを検証中です。',
  'confirm.subtitle.success':
    'メールアドレスが確認されました。すべての機能をご利用いただけます。',
  'confirm.subtitle.error':
    '確認リンクが無効または期限切れです。新しいメールをリクエストしてください。',
  'confirm.status.wait': '検証中です。お待ちください...',
  'confirm.errorCode': 'エラーコード：',
  'confirm.success': '確認が正常に完了しました。',
  'confirm.goDashboard': 'ダッシュボードへ',
  'confirm.goLogin': 'サインインへ',
  'banned.title': 'アクセスがブロックされました',
  'banned.subtitle':
    'このアクセスはアプリのモデレーションにより停止されました。',
  'banned.reason': '理由',
  'banned.scope': '範囲',
  'banned.duration': '期間',
  'banned.until': '{value} までの一時的な措置',
  'banned.undefinedDate': '期限未定',
  'banned.permanent': '永久',
  'banned.policy':
    'リンク、悪意のある投稿、または迷惑行為は、アプリからの永久BANの対象となる場合があります。',
  'banned.backToLogin': 'サインインに戻る',
  'session.expiresIn':
    '非アクティブのため、セッションは {seconds} 秒後に期限切れになります。',
  'session.stayConnected': '接続を維持',
  'update.toast.availableTitle': '新しいアップデートがあります',
  'update.toast.availableDescription':
    'バージョン {version} が {channel} チャンネルでダウンロード可能です。',
  'update.toast.downloadedTitle': 'アップデート準備完了',
  'update.toast.downloadedDescription':
    'アップデート準備完了。{percent}% 完了。今すぐインストールするか、アプリを閉じた際にインストールします。',
  'update.toast.downloadingTitle': 'アップデートをダウンロード中',
  'update.toast.downloadingDescription': '{percent}% 完了。',
  'update.toast.closeAria': 'アップデートバナーを閉じる',
  'update.channel.beta': 'ベータ',
  'update.channel.stable': '安定版',
  'update.button.download': 'ダウンロード',
  'update.button.details': '詳細',
  'update.button.installNow': '今すぐインストール',
  'update.button.installLater': '後でインストール',
  'update.progress.title': 'アップデートをダウンロード中...',
  'update.modal.title': 'アップデートがあります',
  'update.modal.unknownVersion': '不明',
  'update.modal.closeAria': 'モーダルを閉じる',
  'update.modal.mandatory':
    'このアップデートは必須です。アプリを引き続き使用するにはダウンロードしてインストールしてください。',
  'update.modal.releaseNotes': 'リリースノート',
  'update.modal.releaseNotesEmpty':
    'このバージョンのリリースノートはありません。',
  'update.modal.readyProgress': 'アップデート準備完了。100% 完了。',
  'update.modal.downloadingProgress': 'アップデートをダウンロード中...',
  'update.modal.readyToInstall': 'インストール準備完了',
  'update.modal.installHintAuto':
    '今アプリを閉じると、インストールが自動的に開始されます。',
  'update.modal.installHintManual':
    '閉じる際の自動インストールが無効になっています。「後でインストール」を使用して有効にし、安全に閉じてください。',
  'update.modal.downloadAction': 'アップデートをダウンロード',
  'update.modal.downloadingAction': 'ダウンロード中...',
  'update.modal.installAction': '今すぐインストール',
  'update.modal.installLaterAction': '後でインストール（終了時）',
  'update.modal.laterAction': '後で',
  'dropzone.invalidImageAlert':
    '有効な画像ファイル（PNG/JPG）をアップロードしてください。',
  'dropzone.clickOrDrag': 'クリックまたは画像をここにドラッグ',
  'dropzone.supports': 'PNGとJPGに対応',
  'actionButtons.cleaning': 'クリーニング中...',
  'actionButtons.cleanImage': '画像をクリーン',
  'actionButtons.downloadResult': '結果をダウンロード',
  'aio.model.manage': 'モデル',
  'aio.model.noneAvailable': '利用可能なモデルがありません',
  'aio.model.device': 'デバイス',
  'aio.model.languages': '言語',
  'aio.model.languages.multi': 'マルチ',
  'aio.model.noDescription': '説明なし。',
  'aio.model.localStatus': 'ローカル状態：{value}',
  'aio.stage.detectText': 'テキスト検出',
  'aio.stage.recognizeText': 'テキスト認識',
  'aio.stage.getTranslations': '翻訳を取得',
  'aio.stage.segmentText': 'テキストセグメンテーション',
  'aio.stage.cleanImage': '画像クリーニング',
  'aio.stage.tabsBarAria': 'ステージ設定',
  'aio.render.title': 'レンダリングテキスト',
  'aio.render.description.manual':
    'ボックスをダブルクリックしてインライン編集します。選択時にレンダリングテキスト付きのコンテキストドックが表示されます。',
  'aio.render.description.auto':
    '自動モードでは翻訳済み領域にデフォルトのレンダリングが適用されます。',
  'aio.render.activePage':
    'アクティブページ：{count} ブロック。選択中：{selected}。',
  'aio.render.contextualDock.visible': '選択時に表示',
  'aio.render.contextualDock.doubleClick':
    'ダブルクリックして編集を開始し、ドックを表示',
  'aio.render.contextualDock.select': 'ドックを使用するにはボックスを選択',
  'aio.render.contextualDock': 'コンテキストドック：{value}',
  'aio.render.shortcut':
    'ショートカット：プレビューでShift + スクロールを使用して、選択中のボックスのテキストを回転します。',
  'aio.render.inactiveStage':
    'この画像はレンダリング前のステージです。進むボタンを使用して、レンダリングテキストの表示・編集を行ってください。',
  'aio.render.fontCatalog': 'フォントカタログ',
  'aio.render.refreshFonts': 'フォントを更新',
  'aio.render.refreshingFonts': '更新中...',
  'aio.render.importFont': 'フォントをインポート',
  'aio.render.importingFont': 'インポート中...',
  'aio.render.importFontTitleDesktop':
    'デスクトップアプリにカスタムフォントをインポート',
  'aio.render.importFontTitleBrowser':
    'インポートはデスクトップアプリでのみ利用可能です',
  'aio.render.desktopFontsHint':
    'インストール済みのWindowsフォントとカスタムインポートはデスクトップアプリで利用可能です。',
  'aio.render.overlayControlsHint':
    'フォント、サイズ、配置、色のコントロールはオーバーレイのコンテキストドックに移動しました。',
  'aio.render.applyStyleAll': '現在のスタイルをすべての選択に適用',
  'aio.render.applyStyleAllTitle':
    '現在の選択スタイルをすべての画像のすべての選択に適用します',
  'aio.region.title': '検出された領域',
  'aio.region.description.manual':
    'プレビュー上でドラッグして新しい領域を追加します。ボックスをドラッグして移動し、角をドラッグしてリサイズします。',
  'aio.region.description.auto':
    '検出されたボックスを調整するには手動モードに切り替えてください。',
  'aio.region.activePage':
    'アクティブページ：{count} 領域。選択中：{selected}。',
  'aio.region.ocr': '選択領域のOCR：{value}',
  'aio.region.translation': '選択領域の翻訳：{value}',
  'aio.region.notes': '選択領域のメモ：{value}',
  'aio.region.segmentation': '選択領域のセグメンテーション：{value}',
  'aio.region.noSelection': 'なし',
  'aio.region.noRecognizedText': '認識されたテキストなし',
  'aio.region.ocrDisabled': 'OCRステージ無効',
  'aio.region.noTranslation': '翻訳なし',
  'aio.region.translationDisabled': '翻訳ステージ無効',
  'aio.region.noNotes': 'メモなし',
  'aio.region.notesDisabled': 'メモ無効',
  'aio.region.noSelectedRegion': '領域が選択されていません',
  'aio.region.segmentedBoxes': '{count} セグメント済みボックス',
  'aio.region.removeSelected': '選択を削除',
  'aio.region.duplicateSelected': '選択を複製',
  'aio.manual.toolsHintPrimary':
    'キャンバス上のフローティングドックで、領域選択、ページクリーン、セグメンテーション/手動編集を行えます。',
  'aio.manual.toolsHintSecondary':
    'ツールは画像のアクティブなステージに基づいて自動的に有効になります。',
  'aio.run.manualNoActive':
    '手動ステージを実行するにはアクティブな画像を選択してください。',
  'aio.run.manualCurrentOnly': '選択した画像の現在のステージのみを実行します。',
  'aio.run.processing': '実行中 {percent}%',
  'aio.run.rerunCurrent': '現在のステージを再実行（アクティブ画像）',
  'aio.run.runCurrent': '現在のステージを実行（アクティブ画像）',
  'aio.run.full':
    'AIO実行（検出 + OCR + 翻訳 + セグメント + クリーン + レンダー）',
  'aio.pipeline.textModeTitle': 'テキストモード',
  'aio.pipeline.textModeDescription':
    'レンダリング時に選択領域をどのように扱うかを定義します。AUTOは検出された分類を使用します。',
  'aio.pipeline.currentSelectionMode': '現在の選択モード',
  'aio.pipeline.currentSelectionModeAria': '現在の選択のテキストモード',
  'aio.pipeline.autoResolved': 'AUTOは {value} に解決されます。',
  'aio.pipeline.currentMode': '現在のモード：{value}。',
  'aio.pipeline.selectPreviewBox':
    'テキストモードを変更するにはプレビューでボックスを選択してください。',
  'aio.pipeline.title': 'AIOパイプライン',
  'aio.pipeline.description.auto':
    'バッチ実行前にフルパイプライン（検出、OCR、翻訳、セグメンテーション、クリーニング）を設定します。',
  'aio.pipeline.description.manual':
    '手動モード：選択した画像のステージを順番に実行またはスキップします。',
  'aio.pipeline.render': 'レンダー',
  'aio.pipeline.renderSubtitle': '翻訳テキストを最終画像に適用',
  'aio.pipeline.executeCurrentTitle': '選択した画像の現在のステージのみを実行',
  'aio.pipeline.executingStage': 'ステージを実行中...',
  'aio.pipeline.rerunStage': 'ステージを再実行',
  'aio.pipeline.runStage': 'ステージを実行',
  'aio.pipeline.skipStage': 'ステージをスキップ',
  'aio.pipeline.skipStageTitle':
    '現在のステージをスキップして次のステージを解放',
  'aio.pipeline.rewind': '戻る',
  'aio.pipeline.rewindTitle': '前のAIOパイプラインステージに戻る',
  'aio.pipeline.forward': '進む',
  'aio.pipeline.forwardTitle': '次のAIOパイプラインステージに進む',
  'aio.pipeline.manualImageStatus':
    '画像ごとの手動：「{image}」は {stage} 段階。',
  'aio.pipeline.selectImageManual':
    'ステージごとの手動フローを開始するには画像を選択してください。',
  'aio.pipeline.currentStage': '現在のステージ：{label}（{current}/{total}）。',
  'aio.pipeline.runToEnable':
    'ステージごとの戻る/進むを有効にするにはAIOを実行してください。',
  'aio.pipeline.manualHint':
    '手動モードでプロセスをより確実に：各ステージを実際に調整しながら、より細かい制御、レビュー、精度で実行できます。選択した画像のみが処理され、クォータは各画像の最初の手動実行時のみ消費されます（自動AIOを既に通過している場合はゼロ）。',
  'dashboard.enhance.profile.mangaScan': 'マンガスキャン',
  'dashboard.enhance.profile.animeArt': 'アニメアート',
  'dashboard.enhance.profile.general': '一般',
  'dashboard.enhance.profile.highQuality4x': '高品質 4x',
  'dashboard.emptyTip.1':
    '画像が大きすぎてクリーニング、翻訳、リドロー中にエラーが出る場合は、小さな部分に分割してみてください。通常、処理が安定します。',
  'dashboard.emptyTip.2':
    '自動モードはワークフローを高速化しますが、100%の仕上がりを目指すなら手動モードで確認し、最終的な細部を修正する価値があります。',
  'dashboard.emptyTip.3':
    'リファインツールを使用して、テキストをよりクリーンでバランスが取れた、スキャンレーション品質に仕上げましょう。',
  'dashboard.emptyTip.4':
    '吹き出しの形状を矩形と楕円形に切り替えて、各ページのテキストにより適したものにできます。',
  'dashboard.emptyTip.5':
    '設定ページでプリセットを設定して、繰り返し作業を高速化し、チャプター間の一貫性を保ちましょう。',
  'dashboard.emptyTip.6':
    '言語ごとに異なるモデルを試してみてください。日本語に最適なOCRや翻訳モデルが、韓国語、中国語、英語に最適とは限りません。',
  'dashboard.emptyTip.7':
    'ワークフローに最も役立つモデルに投票しましょう。ランキングが改善され、他のユーザーの選択の参考になります。',
  'dashboard.emptyTip.8': 'クラウド翻訳が高額または不安定な場合は、プリセットを調整し、ローカルのフォールバックを用意して制作が滞らないようにしましょう。',
  'dashboard.emptyTip.9':
    'ビジュアルトランスレーターを使用して、チャプター全体を再実行せずに特定の領域を確認できます。',
  'dashboard.emptyTip.10':
    'タイプセッターでは、配置、フォント、間隔の小さな手動調整が最終結果に大きな違いをもたらします。',
  'dashboard.emptyTip.11':
    'テキストが詰まりすぎる場合は、ボックス内のテキスト量を減らすか、翻訳を洗練させるか、フォントを小さくしすぎる前に吹き出しを調整してください。',
  'dashboard.emptyTip.12':
    'OCRの出力が悪い場合は、すべて手作業で修正する前に別のモデルを試してください。モデルを切り替えることで大半のエラーが解決することがよくあります。',
  'dashboard.emptyTip.13':
    '翻訳ノートは読者にとって本当に価値がある場合にのみ使用してください。ノイズが少ないほど、読みやすくなります。',
  'dashboard.emptyTip.14':
    'カスタムLLMおよびOCRプロファイルを保存して、テストごとにすべてを再設定せずにセットアップを素早く比較できます。',
  'dashboard.emptyTip.15':
    'AIOフローでページが失敗した場合は、プロダクションでステージを個別に実行して、ボトルネックの正確な場所を特定してください。',
  'dashboard.aio.progress.detectText': 'テキストを検出中',
  'dashboard.aio.progress.recognizeText': 'テキストを認識中',
  'dashboard.aio.progress.getTranslations': 'テキストを翻訳中',
  'dashboard.aio.progress.segmentText': 'テキストをセグメント中',
  'dashboard.aio.progress.cleanImage': '画像をクリーニング中',
  'dashboard.aio.progress.render': 'レンダリングを準備中',
  'dashboard.aio.subtitle.detectText': '画像内のテキスト領域を検出',
  'dashboard.aio.subtitle.recognizeText': 'OCRでテキストコンテンツを抽出',
  'dashboard.aio.subtitle.getTranslations':
    '選択したサービス/モデルによる自動翻訳',
  'dashboard.aio.subtitle.segmentText':
    'セグメンテーションで領域を精緻化（Bakaスタイル）',
  'dashboard.aio.subtitle.cleanImage':
    'AOT/LaMa + Bakaスタイルマスクによるインペインティング',
  'dashboard.aio.manualStatus.locked': 'ロック',
  'dashboard.aio.manualStatus.pending': '保留中',
  'dashboard.aio.manualStatus.done': '完了',
  'dashboard.aio.manualStatus.skipped': 'スキップ',
  'dashboard.mode.underDevelopment': 'まだ開発中です。',
  'dashboard.nav.group.main': 'メイン',
  'dashboard.nav.group.production': 'プロダクション',
  'dashboard.nav.group.utils': 'ユーティリティ',
  'dashboard.nav.group.info': '情報',
  'dashboard.nav.short.aio': 'AIO',
  'dashboard.nav.short.cleaner': 'クリーナー/RD',
  'dashboard.nav.short.enhance': 'エンハンス',
  'dashboard.nav.subtitle.organize': 'ファイル管理',
  'dashboard.nav.subtitle.aio': 'オールインワン',
  'dashboard.nav.subtitle.cleaner': 'クリーナー・リドローワー',
  'dashboard.nav.subtitle.typesetter': 'タイプセッター',
  'dashboard.nav.subtitle.translator': 'トランスレーター',
  'dashboard.nav.subtitle.raw': 'Rawプロバイダー',
  'dashboard.nav.subtitle.proofreader': '校正・QC',
  'dashboard.nav.subtitle.stitch': 'スティッチャー',
  'dashboard.nav.subtitle.split': 'スプリッター',
  'dashboard.nav.subtitle.watermark': 'ウォーターマーク',
  'dashboard.nav.subtitle.enhance': 'エンハンサー',
  'dashboard.nav.subtitle.optimizer': 'チャプターオプティマイザー',
  'dashboard.nav.subtitle.blogger': 'パブリッシャー・ホスト',
  'dashboard.nav.subtitle.imgur': '匿名ホスト',
  'dashboard.nav.subtitle.guides': 'チュートリアル',
  'dashboard.nav.subtitle.resources': 'リソース',
  'dashboard.nav.tooltip.organize': '処理前に画像を整理・並び替え',
  'dashboard.nav.tooltip.aio':
    'フルパイプライン：検出、認識、翻訳、セグメント、クリーン、レンダー',
  'dashboard.nav.tooltip.cleaner': '吹き出しのクリーンと画像領域のリドロー',
  'dashboard.nav.tooltip.typesetter':
    'ページにタイポグラフィとテキストスタイルを適用',
  'dashboard.nav.tooltip.translator':
    'フリーテキストの翻訳または画像領域ごとのOCR/翻訳のレビュー',
  'dashboard.nav.tooltip.raw': 'パイプライン用のRaw画像を管理・供給',
  'dashboard.nav.tooltip.proofreader': '翻訳のレビューと最終品質の確認',
  'dashboard.nav.tooltip.stitch': '複数の画像を連続ストリップに結合',
  'dashboard.nav.tooltip.split': '長い画像を小さなパーツに分割',
  'dashboard.nav.tooltip.watermark': '画像にウォーターマークを一括追加',
  'dashboard.nav.tooltip.enhance': '画像品質と解像度を向上',
  'dashboard.nav.tooltip.optimizer':
    'Web、閲覧、アーカイブ用に最終出力を最適化',
  'dashboard.nav.tooltip.blogger':
    'Bloggerに投稿を公開し、ホスト済み画像URLを生成',
  'dashboard.nav.tooltip.imgur':
    'クライアントIDローテーションでImgurに画像をアップロード',
  'dashboard.nav.tooltip.guides': 'ツール使用ガイドとチュートリアル',
  'dashboard.nav.tooltip.resources': 'リソース、リンク、参考資料',
  'dashboard.mode.organize': '整理',
  'dashboard.mode.aio': 'AIO — オールインワン',
  'dashboard.mode.cleaner': 'クリーナー / リドローワー',
  'dashboard.mode.typesetter': 'タイプセッター',
  'dashboard.mode.translator': 'トランスレーター',
  'dashboard.mode.raw': 'Rawプロバイダー',
  'dashboard.mode.proofreader': '校正 / QC',
  'dashboard.mode.stitch': 'スティッチ（ウェブトゥーン）',
  'dashboard.mode.split': 'スマートスプリット',
  'dashboard.mode.watermark': 'ウォーターマーク',
  'dashboard.mode.enhance': '画像エンハンス',
  'dashboard.mode.optimizer': 'チャプターオプティマイザー',
  'dashboard.mode.blogger': 'Blogger CDN',
  'dashboard.mode.imgur': 'Imgurアップロード',
  'dashboard.mode.guides': 'ガイド・チュートリアル',
  'dashboard.mode.resources': 'リソース・素材',
  'dashboard.status.modelSelected': '{stage} 用に選択されたモデル：{model}',
  'dashboard.status.verifyEmailRequired':
    'このアクションを実行するにはメールアドレスを確認してください。',
  'dashboard.status.imagesCount': '{count} 枚の画像',
  'dashboard.status.noImage': '画像なし',
  'dashboard.status.freeText': 'フリーテキスト',
  'dashboard.user.defaultName': 'ユーザー',
  'dashboard.topbar.thisTab': 'このタブ',
  'dashboard.aio.config.title': 'ステージ設定',
  'dashboard.footer.hardware.nvidia':
    '最高パフォーマンスのNVIDIAアクセラレーション。',
  'dashboard.footer.hardware.intel': '専用Intelアクセラレーションを使用中。',
  'dashboard.footer.hardware.cpu': '専用アクセラレーションなしのローカル実行。',
  'dashboard.footer.quickLinks': 'クイックリンク',
  'dashboard.footer.lastSave.never': 'このセッションではまだ保存されていません',
  'dashboard.footer.lastSave.label': '最終保存：{time}',
  'dashboard.cleaner.flow.local.title':
    'OCR、セグメンテーション、ローカルインペインティングによる構造化フロー',
  'dashboard.cleaner.flow.ai.title':
    'マルチモーダルAIとガイド付き再構築による自動クリーニング',
  'dashboard.cleaner.flow.local.desc':
    'ローカルディテクターを使用して候補を提案し、どの領域が実際のSFXかを分類し、承認されたもののみをクリーニングします。',
  'dashboard.cleaner.flow.ai.desc':
    'プロジェクトの構造検出を使用してAIをガイドし、吹き出し/アートの保持を強化し、よりスムーズなシームで大きな画像を再構成します。',
  'dashboard.cleaner.instructions.placeholder':
    '例：赤いグラデーションをより適切に保持する、小さなSFXにはより保守的に、ナレーションボックスに触れないことを優先する。',
  'dashboard.cleaner.instructions.hint.local':
    'これらの指示は、基本的なSFX分類とクリーニングルールの後に補足コンテキストとして注入されます。',
  'dashboard.cleaner.instructions.hint.ai':
    'これらの指示は補足コンテキストとして注入されます。AIクリーナーのコアルールは、クリーニングロジックを保持するためにユーザー指示より上位に残ります。',
  'dashboard.cleaner.inspection.title': 'インスペクション',
  'dashboard.cleaner.segmentation.manage': 'セグメンテーションモデルを管理',
  'dashboard.cleaner.segmentation.model': 'セグメンテーションモデル',
  'dashboard.aio.gpuStages.title': 'ステージごとのGPU使用',
  'dashboard.aio.gpuStages.hint':
    'GPUアクセラレーションを使用するステージを選択します。チェックを外すとCPU実行を強制します（GPUにすべてのステージ用の十分なVRAMがない場合に有用）。',
  'dashboard.aio.gpuStages.detect': 'テキスト検出（GPU）',
  'dashboard.aio.gpuStages.ocr': 'OCR / 認識（GPU）',
  'dashboard.aio.gpuStages.segment': 'セグメンテーション（GPU）',
  'dashboard.aio.gpuStages.clean': 'クリーニング / インペインティング（GPU）',
  'dashboard.aio.gpuStages.noActiveProfile':
    '現在、有効なGPUプロファイルはまだ確認されていません。このセクションは断続的に消えないよう表示されたままになり、GPUプロファイルが利用可能になり次第トグルが再び有効になります。',
  'dashboard.aio.config.loadingCatalogs': 'ローカルおよびクラウドカタログを読み込み中...',
  'dashboard.aio.preparingManual': 'AIO手動ステージを準備中...',
  'dashboard.aio.preparingAuto': 'AIO自動実行を準備中...',
  'dashboard.aio.stopping': 'AIO実行を停止中...',
  'dashboard.aio.abortedByUser': 'AIO実行がユーザーにより中止されました。',
  'dashboard.aio.abortedMiniBackendRestarted':
    'AIO実行が中止されました。ミニバックエンドが再起動されました。',
  'dashboard.aio.abortedMiniBackendRestartFailed':
    'AIO実行が中止されました。ミニバックエンドを自動的に再起動できませんでした。',
  'dashboard.llm.customProfilesLoadFailed':
    'カスタムLLMプロファイルの読み込みに失敗しました。',
  'dashboard.status.ready': '画像の処理準備が完了しました。',
  'dashboard.workspace.pendingChanges':
    'ワークスペースに未保存の変更があります。',
  'dashboard.status.restored': 'ワークスペースを復元しました。',
  'dashboard.status.historyRestored': '履歴から変更を復元しました。',
  'dashboard.status.undo': 'ワークスペースを元に戻しました。',
  'dashboard.status.redo': 'ワークスペースをやり直しました。',
  'dashboard.status.saved': 'ワークスペースをローカルに保存しました。',
  'dashboard.status.exportCancelled':
    'ワークスペースのエクスポートがキャンセルされました。',
  'dashboard.status.exportSuccess':
    'ワークスペースを正常にエクスポートしました。',
  'dashboard.status.importCancelled':
    'ワークスペースのインポートがキャンセルされました。',
  'dashboard.status.importSuccess':
    'ワークスペースを正常にインポートしました。',
  'dashboard.status.importSaved':
    'ワークスペースをインポートし、ローカルに保存しました。',
  'dashboard.status.importNoAutosave':
    'ワークスペースをインポートしました。自動保存は無効です。',
  'dashboard.status.autosaveRemoved': 'ローカルの自動保存を削除しました。',
  'dashboard.status.nothingToUndo':
    'ワークスペースに元に戻す操作がありません。',
  'dashboard.status.nothingToRedo':
    'ワークスペースにやり直す操作がありません。',
  'dashboard.sections.pipeline': 'パイプライン',
  'dashboard.sections.languages': '言語',
  'dashboard.sections.modelsConfig': 'モデル・設定',
  'dashboard.sections.presets': 'プリセット',
  'dashboard.sections.region': '領域',
  'dashboard.aio.rewind': 'AIO戻る：ステージ「{label}」（{current}/{total}）。',
  'dashboard.aio.forward':
    'AIO進む：ステージ「{label}」（{current}/{total}）。',
  'dashboard.aio.rewindImage':
    'AIO戻る（{imageName}）：ステージ「{label}」（{current}/{total}）。',
  'dashboard.aio.forwardImage':
    'AIO進む（{imageName}）：ステージ「{label}」（{current}/{total}）。',
  'dashboard.llm.translation': '翻訳',
  'dashboard.llm.ocr': 'OCR',
  'dashboard.aio.manualScope': 'AIO手動',
  'dashboard.aio.autoScope': 'AIO自動',
  'dashboard.aio.executing': '実行中',
  'dashboard.cleaner.selectProfile':
    '自動AIクリーンで使用する保存済みビジュアルプロファイルを選択してください。',
  'dashboard.cleaner.profileNotFound':
    'ビジュアルプロファイルが見つかりません。リロードして再試行してください。',
  'dashboard.cleaner.profileInUse':
    '自動AIクリーンで使用中のビジュアルプロファイル：{label}。',
  'dashboard.cleaner.invalidModel':
    '自動AIクリーンに有効なモデルを選択してください。',
  'dashboard.cleaner.modelRoadmap':
    'モデル「{name}」はまだロードマップに含まれています。',
  'dashboard.cleaner.modelConfigRequired':
    'モデル「{name}」は使用前に設定が必要です。',
  'dashboard.translator.sfx.invalidModel':
    'トランスレーターのAI SFXに有効なモデルを選択してください。',
  'dashboard.cleaner.profileSaved':
    'ビジュアルプロファイルを保存し、自動AIクリーンに選択しました：{label}。',
  'dashboard.cleaner.removeProfileSelect':
    '削除する保存済みビジュアルプロファイルを選択してください。',
  'dashboard.cleaner.customTitle': 'AIカスタム（自動AIクリーン）',
  'dashboard.cleaner.emptyLabel': '新しいビジュアルプロファイル',
  'dashboard.cleaner.namePlaceholder': '例：Gemini Image Clean',
  'dashboard.cleaner.modelPlaceholder': 'gemini-2.5-flash-image',
  'dashboard.cleaner.useLabel': 'クリーナーで使用',
  'dashboard.cleaner.providerInUse':
    '自動AIクリーンでプロバイダー {name} を使用中。',
  'dashboard.stage.detectText.label': 'テキスト検出',
  'dashboard.stage.detectText.short': '検出',
  'dashboard.stage.recognizeText.label': 'テキスト認識',
  'dashboard.stage.recognizeText.short': 'OCR',
  'dashboard.stage.getTranslations.label': '翻訳を取得',
  'dashboard.stage.getTranslations.short': '翻訳',
  'dashboard.stage.segmentText.label': 'テキストセグメンテーション',
  'dashboard.stage.segmentText.short': 'セグメント',
  'dashboard.stage.cleanImage.label': '画像クリーニング',
  'dashboard.stage.cleanImage.short': 'クリーン',
  'dashboard.stage.render.label': 'レンダー',
  'dashboard.stage.render.short': 'レンダー',
  'dashboard.aio.pipeline.detect.subtitle': '画像内のテキスト領域を検出',
  'dashboard.aio.pipeline.ocr.subtitle': 'OCRでテキストコンテンツを抽出',
  'dashboard.aio.pipeline.translate.subtitle': 'サービス/モデルによる自動翻訳',
  'dashboard.aio.pipeline.segment.subtitle': 'セグメンテーションで領域を精緻化',
  'dashboard.aio.pipeline.clean.subtitle':
    'AOT/LaMa + マスクによるインペインティング',
  'dashboard.aio.pipeline.render.subtitle': '翻訳テキストを最終画像に適用',
  'dashboard.aio.config.langHint': 'ソース → 検出/OCR/翻訳。翻訳 → 翻訳のみ。',
  'dashboard.aio.translation.localModelInfo':
    'ローカルモデルはオンデマンドでダウンロードされます。クラウド/APIモデルは引き続きキーを使用します。',
  'dashboard.translator.sameModelHint':
    'トランスレーターはAIOと同じモデル選択を使用します。モデルを切り替えた後に再実行してください。',
  'dashboard.translator.incompatibleLocalModel':
    '現在のローカルモデルはトランスレーターの言語ペアをサポートしていません。別のモデルを選択するか、クラウドを使用してください。',
  'dashboard.status.modeChanged': 'モード：{mode}',
  'dashboard.status.underDevelopment': '{mode}：{tooltip}',
  'dashboard.aio.render.hintRot': 'ショートカット：',
  'dashboard.aio.render.hintRotSuffix': ' で回転。',
  'settings.typographerLibrary.noFolder': 'フォルダーなし',
  'settings.profile.defaultUser': 'KŌMAユーザー',
  'register.email': 'メールアドレス',
  'register.emailPlaceholder': 'you@email.com',
  'feed.sidebar.webhookPlaceholder': 'https://discord.com/api/webhooks/...',
  'feed.sidebar.webhookLabelShort': 'Webhook：',
  'feed.moderation.scope.accountHwid': 'アカウント + HWID',
  'feed.moderation.scope.full': '完全',
  'feed.composer.label.scanlation': 'スキャンレーション',
  'feed.composer.availability.hoursPlaceholder': '10',
  'feed.composer.roles.valuePlaceholder': '50.00',
  'feed.apply.contactPlaceholder': 'Discord @ユーザー名',
  'ranking.error.loadFailed': 'ランキングの読み込みに失敗しました。',
  'ranking.error.loadDetailFailed': '詳細の読み込みに失敗しました。',
  'ranking.error.saveReviewFailed': 'レビューの保存に失敗しました。',
  'ranking.error.deleteReviewFailed': 'レビューの削除に失敗しました。',
  'ranking.error.emailVerificationRequired':
    'レビューの投稿または編集前にメールアドレスを確認してください。',
  'dashboard.aio.translation.temperature': 'Temperature',
  'dashboard.aio.translation.topP': 'Top P',
  'dashboard.aio.translation.maxTokens': '最大トークン数',
  'dashboard.aio.clean.hdStrategy': 'HD戦略',
  'dashboard.aio.clean.hdStrategy.resize': 'リサイズ',
  'dashboard.aio.clean.hdStrategy.crop': 'クロップ',
  'dashboard.aio.clean.hdStrategy.original': 'オリジナル',
  'dashboard.aio.clean.hdStrategyHint':
    'インペインティング前の大きな画像の処理戦略。',
  'dashboard.aio.clean.resizeLimit': 'リサイズ上限',
  'dashboard.aio.clean.cropMargin': 'クロップマージン',
  'dashboard.aio.clean.cropTriggerSize': 'クロップトリガーサイズ',
  'dashboard.aio.clean.localHardware':
    'ローカルハードウェア：{name}（{provider}{vram}）',
  'dashboard.sidebar.workspace': 'ワークスペース',
  'dashboard.sidebar.hide': 'サイドバーを非表示',
  'dashboard.sidebar.remaining': '残り：{count}',
  'dashboard.sidebar.resizeAria': '左サイドバーをリサイズ',
  'dashboard.sidebar.resizeTitle':
    'ドラッグしてリサイズ。ダブルクリックで復元。',
  'dashboard.sidebar.files': 'ファイル（{count}）',
  'dashboard.sidebar.clearAll': 'すべてクリア',
  'dashboard.sidebar.cleared': '画像リストをクリアしました。',
  'dashboard.sidebar.empty': '画像なし',
  'dashboard.sidebar.rewindImage': 'この画像のみ戻る',
  'dashboard.sidebar.forwardImage': 'この画像のみ進む',
  'dashboard.sidebar.rotate90': '90度回転',
  'dashboard.sidebar.moveUp': '上に移動',
  'dashboard.sidebar.moveDown': '下に移動',
  'dashboard.sidebar.remove': '削除',
  'dashboard.sidebar.extracting': '画像を抽出中... お待ちください。',
  'dashboard.sidebar.dropHere': 'ここにドロップ...',
  'dashboard.sidebar.clickOrDrag': 'ドラッグまたはクリック',
  'dashboard.sidebar.processingArchive': 'ZIP/PDF/CBZ/CB7/PSDを処理中...',
  'dashboard.sidebar.stats.title': 'ローカル統計',
  'dashboard.sidebar.stats.badge': 'アクティブ',
  'dashboard.sidebar.stats.daily': '今日',
  'dashboard.sidebar.stats.weekly': '今週',
  'dashboard.sidebar.stats.monthly': '今月',
  'dashboard.sidebar.stats.foot':
    '最近のローカル処理アクティビティです。カウンターは期間ごとに自動でリセットされます。',
  'dashboard.sidebar.stats.resetNow': '今リセット',
  'dashboard.sidebar.stats.resetInHoursMinutes':
    '{hours}時間{minutes}分でリセット',
  'dashboard.sidebar.stats.resetInHours': '{hours}時間でリセット',
  'dashboard.sidebar.stats.resetInMinutes': '{minutes}分でリセット',
  'dashboard.sidebar.right.hide': 'ツールを非表示',
  'dashboard.sidebar.right.close': 'パネルを閉じる',
  'dashboard.sidebar.right.resizeAria': '右サイドバーをリサイズ',
  'dashboard.sidebar.right.resizeTitle':
    'ドラッグしてリサイズ。ダブルクリックで復元。',
  'dashboard.footer.runtime.downloaded': 'パッケージダウンロード済み',
  'dashboard.footer.runtime.embedded': '埋め込みコア',
  'dashboard.footer.runtime.fallback.title': 'フォールバック有効',
  'dashboard.footer.runtime.fallback.detail':
    '{requested} をリクエスト、{active} を使用中。',
  'dashboard.footer.runtime.tensorrt.title': 'TensorRT有効',
  'dashboard.footer.runtime.tensorrt.detail':
    '最高パフォーマンスのNVIDIAアクセラレーション。',
  'dashboard.footer.runtime.cuda.title': 'CUDA有効',
  'dashboard.footer.runtime.cuda.detail': '最新のNVIDIA GPUを使用中。',
  'dashboard.footer.runtime.legacy.label': 'レガシー',
  'dashboard.footer.runtime.legacy.title': 'CUDAレガシー有効',
  'dashboard.footer.runtime.legacy.detail':
    '旧世代NVIDIA GPU向けのレガシープロファイル。',
  'dashboard.footer.runtime.openvino.title': 'OpenVINO有効',
  'dashboard.footer.runtime.openvino.detail':
    '専用Intelアクセラレーションを使用中。',
  'dashboard.footer.runtime.cpu.title': 'CPU有効',
  'dashboard.footer.runtime.cpu.detail':
    '専用アクセラレーションなしのローカル実行。',
  'dashboard.footer.workspace.saving': '保存中',
  'dashboard.footer.workspace.saved': '保存済み',
  'dashboard.footer.workspace.error': 'ローカルエラー',
  'dashboard.footer.workspace.pending': '保留中',
  'dashboard.footer.workspace.title': 'ローカルワークスペース',
  'dashboard.footer.runtime.source': 'ソース：{value}',
  'dashboard.footer.runtime.remoteAvailable':
    'リモートパッケージが利用可能です。',
  'dashboard.footer.runtime.errorReason': '理由：{value}',
  'dashboard.footer.bugReport.title': 'バグ報告',
  'dashboard.footer.bugReport.desc':
    'スクリーンショットとログを自動添付してバグを報告します。',
  'dashboard.footer.discord.aria': 'Discordに参加',
  'dashboard.footer.discord.title': 'Discordコミュニティ',
  'dashboard.footer.discord.desc':
    'コミュニティに参加し、アイデアを提案し、フィードバックを共有しましょう。',
  'dashboard.footer.website.aria': 'プロジェクトWebサイトを開く',
  'dashboard.footer.website.title': 'プロジェクトWebサイト',
  'dashboard.footer.website.desc':
    'ニュース、ドキュメント、プロジェクトリソースにアクセス。',
  'bugReport.error.imgLoadFailed': '画像の読み込みに失敗しました。',
  'bugReport.error.canvasFailed': 'キャンバスの処理に失敗しました。',
  'modelManager.modal.title': 'モデルライブラリ',
  'modelManager.modal.aioFallback': 'AIO',
  'modelCard.recommended': '推奨',
  'modelCard.hardware.gpu': 'GPU',
  'modelCard.hardware.cpu': 'CPU',
  'modelCard.speed.ok': 'OK',
  'auth.toolkit.aiClean': 'AIクリーン',
  'freeProviderCard.setup': 'セットアップ',
  'freeProviderCard.limits': '制限',
  'freeProviderCard.rateLimits': 'レート制限',
  'freeProviderCard.field.modelPlaceholder': 'モデルID（OpenAI互換）',
  'customProvider.profileType': 'AIカスタムプロファイル',
  'dashboard.cleaner.mode.assisted': 'アシスト',
  'dashboard.cleaner.mode.automaticAi': '自動AIクリーン',
  'dashboard.cleaner.mode.aiSfx': 'AI SFX',
  'dashboard.cleaner.mode.assistedTitle':
    'OCR、セグメンテーション、ローカルインペインティングによる構造化フロー',
  'dashboard.cleaner.mode.automaticAiTitle':
    'マルチモーダルAIとガイド付き再構築による自動クリーニング',
  'dashboard.cleaner.mode.aiSfxTitle':
    'AI承認済みのSFXのみを検出・クリーニング',
  'dashboard.cleaner.mode.title': 'モード',
  'dashboard.cleaner.mode.hint':
    '現在のモードはアシストフローとして保持されています。新しい<strong>自動AIクリーン</strong>は厳格なルールを持つマルチモーダルAIを使用し、アート、輪郭線、吹き出しを保持します。',
  'dashboard.cleaner.pipeline.title': 'パイプライン',
  'dashboard.cleaner.pipeline.hint':
    'アシストフロー：OCR → セグメンテーション → ローカルクリーニング。予測可能性と後からの微調整を求める方に最適。',
  'dashboard.cleaner.ocr.language': '言語（OCR）',
  'dashboard.cleaner.ocr.languageAria': 'OCR用のソース言語',
  'dashboard.cleaner.models.button': 'モデル',
  'dashboard.cleaner.models.none': 'モデルなし',
  'dashboard.cleaner.ocr.manageAria': 'OCRモデルを管理',
  'dashboard.cleaner.ocr.modelAria': 'OCRモデル',
  'dashboard.cleaner.segment.title': 'セグメント',
  'dashboard.cleaner.segment.manageAria': 'セグメンテーションモデルを管理',
  'dashboard.cleaner.segment.modelAria': 'セグメンテーションモデル',
  'dashboard.cleaner.clean.title': 'クリーン',
  'dashboard.cleaner.clean.manageAria': 'クリーニングモデルを管理',
  'dashboard.cleaner.clean.modelAria': 'クリーニングモデル',
  'dashboard.cleaner.settings.title': 'クリーニング',
  'dashboard.cleaner.settings.maskDilation': 'マスク膨張',
  'dashboard.cleaner.settings.hdStrategy': 'HD戦略',
  'dashboard.cleaner.settings.resizeLimit': 'リサイズ上限',
  'dashboard.cleaner.settings.cropMargin': 'クロップマージン',
  'dashboard.cleaner.settings.cropTrigger': 'クロップトリガー',
  'dashboard.cleaner.inspect.title': 'インスペクション',
  'dashboard.cleaner.inspect.ocrBlocks': 'OCRブロック',
  'dashboard.cleaner.inspect.segmented': 'セグメント済み',
  'dashboard.cleaner.inspect.selection': '選択',
  'dashboard.cleaner.inspect.none': 'なし',
  'dashboard.cleaner.inspect.ocr': 'OCR',
  'dashboard.cleaner.inspect.segments': 'セグメント',
  'dashboard.cleaner.inspect.boxesCount': '{count} ボックス',
  'dashboard.cleaner.ai.sfxCleaner': 'AI SFXクリーナー',
  'dashboard.cleaner.ai.automaticClean': '自動AIクリーン',
  'dashboard.cleaner.ai.sfxDesc':
    'ローカルディテクターを使用して候補を提案し、どの領域が実際のSFXかを分類し、承認されたもののみをクリーニングします。',
  'dashboard.cleaner.ai.automaticDesc':
    'プロジェクトの構造検出を使用してAIをガイドし、吹き出し/アートの保持を強化し、よりスムーズなシームで大きな画像を再構成します。',
  'dashboard.cleaner.ai.modelTitle': 'AIモデル',
  'dashboard.cleaner.ai.manageAria': '{value} モデルを管理',
  'dashboard.cleaner.ai.modelAria': '{value} モデル',
  'dashboard.cleaner.ai.noneAvailable': '利用可能なAIモデルがありません',
  'dashboard.cleaner.instructions.title': '追加指示',
  'dashboard.cleaner.instructions.hintSfx':
    'これらの指示は、基本的なSFX分類とクリーニングルールの後に補足コンテキストとして注入されます。',
  'dashboard.cleaner.instructions.hintAi':
    'これらの指示は補足コンテキストとして注入されます。AIクリーナーのコアルールは、クリーニングロジックを保持するためにユーザー指示より上位に残ります。',
  'dashboard.cleaner.stats.candidates': '候補',
  'dashboard.cleaner.stats.sfxApproved': 'SFX承認',
  'dashboard.cleaner.stats.redraw': 'リドロー',
  'dashboard.cleaner.action.processing': '{value} を処理中 {percent}%',
  'dashboard.cleaner.action.runAiSfx': 'AI SFXクリーナーを実行',
  'dashboard.cleaner.action.runAutomatic': '自動AIクリーンを実行',
  'dashboard.cleaner.action.runAssisted': 'アシストクリーナーを実行',
  'dashboard.typography.circularText': '円形テキスト',
  'dashboard.typography.activate': '有効化',
  'dashboard.typography.effect.aria': 'テキストエフェクト',
  'dashboard.typography.effect.title': 'テキストエフェクトを選択',
  'dashboard.typography.effect.label': 'エフェクト',
  'dashboard.typography.effect.none': 'エフェクトなし',
  'dashboard.typography.effect.panelTitle': 'テキストエフェクト',
  'dashboard.typography.effect.panelHint':
    'セリフ、インパクト、スミアのネイティブプリセット。',
  'dashboard.typography.effect.searchPlaceholder': 'エフェクトを検索...',
  'dashboard.typography.effect.intensity': '強度',
  'dashboard.typography.effect.noResults': 'エフェクトが見つかりません。',
  'dashboard.aio.customAi.titleTranslation': 'カスタムAIプロファイル（翻訳）',
  'dashboard.aio.customAi.titleOcr': 'カスタムAIプロファイル（OCR）',
  'dashboard.aio.customAi.newTranslation': '新しい翻訳プロファイル',
  'dashboard.aio.customAi.newOcr': '新しいOCRプロファイル',
  'dashboard.aio.customAi.placeholderTranslation': '例：OpenRouter Manga EN-US',
  'dashboard.aio.customAi.placeholderOcr': '例：Private Vision OCR',
  'dashboard.aio.customAi.modelPlaceholderTranslation': 'openai/gpt-4.1',
  'dashboard.aio.customAi.modelPlaceholderOcr': 'gpt-4.1-mini',
  'dashboard.aio.customAi.useTranslation': '翻訳に使用',
  'dashboard.aio.customAi.useOcr': 'OCRに使用',
  'dashboard.aio.customAi.loading': 'カスタムプロファイルを読み込み中...',
  'dashboard.aio.customAi.savedProfile': 'プロファイルを保存しました',
  'dashboard.aio.customAi.apiBase': 'APIベース',
  'dashboard.aio.customAi.ollamaPreset': 'Ollamaローカルプリセット',
  'dashboard.aio.customAi.apiKey': 'APIキー（任意）',
  'dashboard.aio.customAi.model': 'モデル',
  'dashboard.aio.customAi.clear': 'クリア',
  'dashboard.aio.customAi.remove': '削除',
  'dashboard.aio.customAi.save': '保存',
  'dashboard.emptyStage.title': '画像を選択または読み込み',
  'dashboard.emptyStage.desc':
    'トップバーのツールを使用してマンファページを処理します。',
  'dashboard.emptyStage.tipTitle': '便利なヒント',
  'dashboard.emptyStage.tipMeta': '15秒ごとに切り替え',
  'dashboard.enhance.title': '画像エンハンス',
  'dashboard.enhance.localHint':
    'ローカルミニバックエンド上のONNXモデル。処理前にインストールしてください。',
  'dashboard.enhance.desktopRequiredHint':
    'アクティブなミニバックエンドを備えたデスクトップアプリが必要です。',
  'dashboard.enhance.scale': 'スケール',
  'dashboard.enhance.profile': 'プロファイル',
  'dashboard.enhance.model': 'モデル',
  'dashboard.enhance.format': 'フォーマット',
  'dashboard.enhance.status.title': 'モデル',
  'dashboard.enhance.status.desktopRequired': 'デスクトップが必要',
  'dashboard.enhance.status.selectModel': 'モデルを選択',
  'dashboard.enhance.status.ready': '準備完了',
  'dashboard.enhance.status.notImported': '未インポート',
  'dashboard.enhance.status.notInstalled': '未インストール',
  'dashboard.enhance.importHint':
    '手動ONNXインポート。sisr2onnxを使用して.pthを変換してください。',
  'dashboard.enhance.action.manage': '管理',
  'dashboard.enhance.action.import': 'インポート',
  'dashboard.enhance.action.install': 'インストール',
  'dashboard.enhance.action.source': 'ソース',
  'dashboard.enhance.selectAboveHint': '上のモデルを選択してください。',
  'dashboard.enhance.action.processing': 'エンハンス中...',
  'dashboard.enhance.action.run': '画像をエンハンス',
  'dashboard.info.optimizer.desc1':
    'ダッシュボードで生成済みの出力を使用して、Web、閲覧、アーカイブプリセットで最終バッチを最適化します。',
  'dashboard.info.optimizer.desc2':
    'ユーティリティはページごとの削減量を表示し、ZIPまたはローカルフォルダーとしてエクスポートします。',
  'dashboard.info.blogger.desc1':
    'このユーティリティを使用してBloggerに公開し、ホスト済み画像URLを生成します。',
  'dashboard.info.blogger.desc2':
    '認証情報とオプティマイザーは設定 > 連携 > Blogger CDNにあります。',
  'dashboard.info.imgur.desc1':
    'このユーティリティを使用して、ランダムなクライアントIDローテーションで匿名Imgurアップロードを行います。',
  'dashboard.info.imgur.desc2':
    'キー、リミッター、完全ガイドは設定 > 連携 > Imgurアップロードにあります。',
  'dashboard.info.guides.desc1':
    'センターパネルでガイドを選択して、詳細な手順を確認します。',
  'dashboard.info.guides.desc2':
    '各ガイドには実践的な例と生産性向上のヒントが含まれています。',
  'dashboard.info.resources.desc1':
    'スキャンレーションワークフローに役立つリソースと素材を探索します。',
  'dashboard.info.resources.desc2': 'フォント、テンプレート、辞書など。',
  'dashboard.render.noRecognizedText': '認識されたテキストなし',
  'dashboard.render.noTranslation': '翻訳なし',
  'dashboard.render.noNotes': 'TNなし',
  'dashboard.render.noteLabel': 'TN：',
  'dashboard.render.textLabel': 'テキスト',
  'dashboard.render.aaLabel': 'AA',
  'dashboard.render.skewXLabel': 'Sx',
  'dashboard.render.skewYLabel': 'Sy',
  'renderPreview.context.title': '領域アクション',
  'renderPreview.context.copyRecognized': '認識テキストをコピー',
  'renderPreview.context.copyTranslated': '翻訳をコピー',
  'renderPreview.context.editRendered': 'レンダリングテキストを編集',
  'renderPreview.context.editRenderedHint': 'レンダリングテキストを編集',
  'renderPreview.context.manualModeHint': '手動モードが必要です',
  'renderPreview.shape': '形状',
  'renderPreview.rectangular': '矩形',
  'renderPreview.elliptic': '楕円形',
  'renderPreview.convertRectangular': '矩形に変換',
  'renderPreview.convertElliptic': '楕円形に変換',
  'renderPreview.manualModeRequired': '手動モードが必要です',
  'renderPreview.applyTypographyPreset': 'タイポグラフィプリセットを適用',
  'renderPreview.preset': 'プリセット',
  'renderPreview.typographyPresets': 'タイポグラフィプリセット',
  'renderPreview.applyPreset': 'プリセットを適用',
  'renderPreview.removeRegion': '選択を削除',
  'renderPreview.textFont': 'テキストフォント',
  'renderPreview.selectionShape': '選択形状',
  'renderPreview.fontSize': 'フォントサイズ',
  'renderPreview.decreaseFont': 'フォントを縮小',
  'renderPreview.increaseFont': 'フォントを拡大',
  'renderPreview.alignment': '配置',
  'renderPreview.alignLeft': '左揃え',
  'renderPreview.alignCenter': '中央揃え',
  'renderPreview.alignRight': '右揃え',
  'renderPreview.typographyStyle': 'タイポグラフィスタイル',
  'renderPreview.bold': '太字',
  'renderPreview.italic': '斜体',
  'renderPreview.underline': '下線',
  'renderPreview.uppercase': '大文字',
  'renderPreview.textOrientation': 'テキストの方向',
  'renderPreview.horizontal': '横書き',
  'renderPreview.vertical': '縦書き',
  'renderPreview.circular': '円形',
  'renderPreview.rotation': '回転',
  'renderPreview.rotateMinus5': '-5° 回転',
  'renderPreview.rotatePlus5': '+5° 回転',
  'renderPreview.skewX': '水平スキュー',
  'renderPreview.skewXMinus2': '水平スキュー -2°',
  'renderPreview.skewXPlus2': '水平スキュー +2°',
  'renderPreview.skewY': '垂直スキュー',
  'renderPreview.skewYMinus2': '垂直スキュー -2°',
  'renderPreview.skewYPlus2': '垂直スキュー +2°',
  'renderPreview.adjustments': '調整',
  'renderPreview.refine': 'リファイン',
  'renderPreview.autoFontSize': '自動フォントサイズ',
  'renderPreview.autoFit': '自動フィット',
  'renderPreview.fixed': '固定',
  'renderPreview.hyphenation': 'ハイフネーション',
  'renderPreview.enabled': '有効',
  'renderPreview.disabled': '無効',
  'renderPreview.maxSize': '最大サイズ',
  'renderPreview.minSize': '最小サイズ',
  'renderPreview.lineSpacing': '行間',
  'renderPreview.opacity': '不透明度',
  'renderPreview.fill': '塗り',
  'renderPreview.outline': 'アウトライン',
  'renderPreview.shadow': 'シャドウ',
  'renderPreview.shadowLayers': 'シャドウレイヤー',
  'renderPreview.addLayer': 'レイヤーを追加',
  'renderPreview.layerN': 'レイヤー {count}',
  'renderPreview.removeLayerN': 'レイヤー {count} を削除',
  'renderPreview.shadowLayerN': 'シャドウレイヤー {count}',
  'renderPreview.blur': 'ぼかし',
  'renderPreview.offsetX': 'オフセット X',
  'renderPreview.offsetY': 'オフセット Y',
  'renderPreview.radius': '半径',
  'renderPreview.startAngle': '開始角度',
  'renderPreview.spacing': '間隔',
  'renderPreview.shadowLayersCount': '{count} レイヤー',
  'renderPreview.shadowBlurSummary': 'ぼかし {value}',
  'renderPreview.history.none': 'この画像のAIO履歴はありません',
  'renderPreview.box.clickToEdit': 'ダブルクリックして編集',
  'renderPreview.box.renderNotApplied': 'このステージではレンダリング未適用',
  'renderPreview.editor.placeholder': '最終テキストを入力...',
  'renderPreview.editor.aria': 'レンダリングテキストを編集',
  'splitter.strategy.smart': '自動スマート',
  'splitter.strategy.smartHint': '余白＋ヒューリスティクス。',
  'splitter.strategy.advancedDesktop': 'セミデスクトップ',
  'splitter.strategy.advancedDesktopHint': '高度なローカル分析。',
  'splitter.strategy.manual': '手動',
  'splitter.strategy.manualHint': '手動調整のみ。',
  'splitter.strategy.fixedHeight': '固定高さ',
  'splitter.strategy.fixedHeightHint': '高さでセグメント分割。',
  'splitter.strategy.count': 'N分割',
  'splitter.strategy.countHint': '均等分割。',
  'dashboard.aio.autoScopeTitle': '介入なしの自動処理',
  'dashboard.aio.manualScopeTitle': '各ステージの手動制御',
  'detectionPreview.recognized': '認識：',
  'detectionPreview.translated': '翻訳：',
  'detectionPreview.note': 'TN：',
  'detectionPreview.manual': '手動',
  'detectionPreview.removeSelection': '選択を削除',
  'detectionPreview.actions': '領域アクション',
  'detectionPreview.text': 'テキスト',
  'detectionPreview.copyRecognized': '認識テキストをコピー',
  'detectionPreview.editRecognized': '認識テキストを編集',
  'detectionPreview.manualModeOnly': '手動モードでのみ利用可能',
  'detectionPreview.copyTranslated': '翻訳をコピー',
  'detectionPreview.editTranslated': '翻訳を編集',
  'detectionPreview.removeRegion': '領域を削除',
  'detectionPreview.editRecognizedTitle': '認識テキストを編集',
  'detectionPreview.editTranslatedTitle': '翻訳テキストを編集',
  'detectionPreview.placeholderRecognized': '認識テキストを入力...',
  'detectionPreview.placeholderTranslated': '翻訳を入力...',
  'detectionPreview.rewind': 'この画像を戻る',
  'detectionPreview.forward': 'この画像を進む',
  'detectionPreview.noHistory': 'この画像のAIO履歴はありません',
  'dashboard.translator.workspace.aria': 'トランスレーターモード',
  'dashboard.translator.workspace.textTitle': 'フリーテキストを翻訳',
  'dashboard.translator.workspace.text': 'テキスト',
  'dashboard.translator.workspace.visualTitle': '画像内の検出と翻訳',
  'dashboard.translator.workspace.visual': 'ビジュアル',
  'watermark.header.eyebrow': '編集ユーティリティ',
  'watermark.header.title': 'ウォーターマーク',
  'watermark.header.badge': 'バッチ',
  'watermark.panel.presets': 'プリセット',
  'watermark.presets.builtin': 'ビルトイン',
  'watermark.presets.user': '保存済み',
  'watermark.action.save': '保存',
  'watermark.action.duplicate': '複製',
  'watermark.panel.text': 'テキスト',
  'watermark.text.enable': 'テキストを有効化',
  'watermark.text.content': '内容',
  'watermark.text.font': 'フォント',
  'watermark.text.size': 'サイズ',
  'watermark.text.color': '色',
  'watermark.text.outline': 'アウトライン',
  'watermark.text.outlineColor': 'アウトライン色',
  'watermark.text.opacity': '不透明度',
  'watermark.panel.logo': 'ロゴ',
  'watermark.logo.enable': '有効化',
  'watermark.logo.change': '変更',
  'watermark.logo.upload': 'アップロード',
  'watermark.logo.remove': '削除',
  'watermark.logo.scale': 'スケール %',
  'watermark.logo.opacity': '不透明度',
  'watermark.logo.brightness': '明るさ',
  'watermark.logo.saturation': '彩度',
  'watermark.panel.distribution': '配置',
  'watermark.distribution.position': '位置',
  'watermark.distribution.rotation': '回転',
  'watermark.distribution.blend': 'ブレンド',
  'watermark.distribution.gapX': '間隔 X',
  'watermark.distribution.gapY': '間隔 Y',
  'watermark.distribution.padding': 'パディング',
  'watermark.distribution.baseName': 'ベース名',
  'watermark.distribution.smartPlacement': 'スマート配置',
  'watermark.action.applying': '適用中...',
  'watermark.action.applyBatch': 'バッチ適用',
  'watermark.status.cancelRequested': 'キャンセルをリクエストしました。',
  'watermark.action.cancel': 'キャンセル',
  'watermark.panel.preview': 'プレビュー',
  'watermark.preview.compare': '比較',
  'watermark.preview.mode': 'プレビュー',
  'watermark.preview.empty.title': '画像なし',
  'watermark.preview.empty.desc':
    'ダッシュボードの左パネルでページをインポートしてください。',
  'watermark.preview.noLayer.title': 'レイヤーを設定',
  'watermark.preview.noLayer.desc':
    'プレビューを生成するにはツールボックスでテキストまたはロゴを有効にしてください。',
  'watermark.preview.original': 'オリジナル',
  'watermark.preview.watermark': 'ウォーターマーク',
  'watermark.preview.compareAria': '適用前後の比較',
  'watermark.preview.generating': '生成中...',
  'watermark.panel.output': '出力',
  'watermark.output.empty.title': '結果なし',
  'watermark.output.empty.desc':
    'ダウンロードを生成するにはバッチを適用してください。',
  'watermark.action.zip': 'ZIP',
  'watermark.action.folder': 'フォルダー',
  'watermark.action.download': 'ダウンロード',
  'imgur.hero.eyebrow': 'Imgurアップロード',
  'imgur.hero.title': '匿名ホスティング',
  'imgur.hero.desc':
    'ランダムなクライアントIDローテーションで素早くImgurにアップロードできるユーティリティです。',
  'imgur.status.remaining': '残り：{remaining}',
  'imgur.status.configure': '設定',
  'imgur.alert.missingConfig': '設定が不足しています',
  'imgur.alert.addActiveClient':
    '設定 > 連携でアクティブなクライアントIDを少なくとも1つ追加してください。',
  'imgur.batch.title': 'バッチアップロード',
  'imgur.batch.limit':
    '1時間あたり {limit} アップロードまで（使用済み：{used}）',
  'imgur.dropzone.title': 'ここに画像をドロップ',
  'imgur.dropzone.desc':
    '複数のJPG、PNG、またはWEBPファイルをドラッグしてください。',
  'imgur.toggle.imgOutput': '<img>タグとして出力',
  'imgur.toggle.imgOutputDesc':
    'ブログやフォーラムですぐに使えるHTMLコードを生成します。',
  'imgur.actions.select': '選択',
  'imgur.actions.sending': '送信中...',
  'imgur.actions.send': '送信',
  'imgur.actions.copy': 'URLをコピー',
  'imgur.queue.title': 'アップロードキュー',
  'imgur.queue.items_one': '{count} 件',
  'imgur.queue.items_other': '{count} 件',
  'imgur.queue.empty': 'キューは空です。上で画像を追加してください。',
  'imgur.queue.altPlaceholder': '代替テキスト',
  'imgur.queue.urlLabel': 'URL',
  'imgur.queue.keyLabel': 'キー',
  'imgur.queue.remove': '削除',
  'imgur.error.configLoad': 'Imgur設定の読み込みに失敗しました。',
  'imgur.error.uploadFailed': '画像のアップロードに失敗しました。',
  'imgur.feedback.singleSuccess': 'アップロードが正常に完了しました。',
  'imgur.feedback.multiSuccess':
    '{count} 枚の画像のアップロードが完了しました。',
  'ranking.metric.overall': '総合スコア',
  'ranking.metric.quality': '品質',
  'ranking.metric.speed': '速度',
  'ranking.metric.costBenefit': 'コストパフォーマンス',
  'ranking.metric.easeOfUse': '使いやすさ',
  'ranking.trend.neutral': '中立',
  'ranking.trend.points': 'pts',
  'ranking.table.title': 'リーダーボード',
  'ranking.table.sortedBy': '加重 {metric} でソート。',
  'ranking.table.modelsCount': '{count} モデルがランクイン',
  'ranking.table.empty': '現在のフィルタ��に一致するモデルがありません。',
  'ranking.table.newLabel': '新着',
  'ranking.table.reviewsCount': '{count} 件のレビュー',
  'ranking.table.reviewedByYou': 'レビュー済み',
  'ranking.table.viewDetails': '詳細を表示',
  'ranking.filters.metricAria': 'ランキング指標',
  'ranking.filters.searchPlaceholder': 'モデルを検索...',
  'ranking.filters.searchAria': 'モデルを検索',
  'ranking.filters.advancedAria': '詳細フィルターを表示',
  'ranking.filters.button': 'フィルター',
  'ranking.filters.stageLabel': 'ステージ',
  'ranking.filters.sourceLabel': 'ソース',
  'ranking.filters.languageLabel': '言語',
  'ranking.filters.minReviewsLabel': '最小レビュー数',
  'ranking.filters.allStages': 'すべてのステージ',
  'ranking.filters.allSources': 'ローカル＋クラウド',
  'ranking.filters.onlyLocal': 'ローカルのみ',
  'ranking.filters.onlyCloud': 'クラウドのみ',
  'ranking.filters.allLanguages': 'すべての言語',
  'ranking.filters.reviews_one': '{count} 件のレビュー',
  'ranking.filters.reviews_other': '{count} 件のレビュー',
  'ranking.composer.usage.balanced': 'バランス型',
  'ranking.composer.usage.qualityFirst': '品質優先',
  'ranking.composer.usage.speedFirst': '速度優先',
  'ranking.composer.usage.lowVram': '低VRAM',
  'ranking.composer.usage.offlineLocal': 'ローカルパイプライン',
  'ranking.composer.usage.cloudPipeline': 'クラウドパイプライン',
  'ranking.composer.title.edit': 'レビューを編集',
  'ranking.composer.title.new': '新しいレビュー',
  'ranking.composer.action.close': '閉じる',
  'ranking.composer.field.title': 'タイトル',
  'ranking.composer.field.titlePlaceholder': '例：マンガ向け最高のローカルOCR',
  'ranking.composer.field.context': 'コンテキスト',
  'ranking.composer.field.sourceLang': 'ソース言語',
  'ranking.composer.field.sourceLangPlaceholder': 'ja, en, pt-br...',
  'ranking.composer.field.targetLang': 'ターゲット言語',
  'ranking.composer.field.targetLangPlaceholder': 'en, pt, pt-br...',
  'ranking.composer.field.device': 'デバイス',
  'ranking.composer.device.none': '未指定',
  'ranking.composer.field.comment': 'コメント',
  'ranking.composer.field.commentPlaceholder':
    '全体的な品質、安定性、リソース使用量、このモデルが最も価値を発揮する場面を記述してください。',
  'ranking.composer.action.reset': 'リセット',
  'ranking.composer.action.delete': '削除',
  'ranking.composer.action.save': '保存',
  'ranking.composer.action.publish': '公開',
  'dashboard.specialMode.visualEmpty.title': 'ビジュアルトランスレーター',
  'dashboard.specialMode.visualEmpty.description':
    'プレビューで直接翻訳を開始するには画像をインポートしてください。',
  'dashboard.specialMode.visualEmpty.cta': '画像を選択',
  'dashboard.reviewRaw.raw.title': 'Raw確認',
  'dashboard.reviewRaw.raw.description':
    '元画像の品質を分析し、パイプライン用のバッチを準備します。',
  'dashboard.reviewRaw.raw.note':
    'Rawの検証により、AIはOCR前に視覚的なコンテキストをより良く理解できます。',
  'dashboard.reviewRaw.raw.statusReady':
    '{count} 枚の画像のバッチが検証準備完了です。',
  'dashboard.reviewRaw.raw.validate': 'Rawを検証',
  'dashboard.reviewRaw.qc.title': '品質管理',
  'dashboard.reviewRaw.qc.descriptionAuto':
    '自動QCは軽量モデルを使用して一般的な編集エラーを検出します。',
  'dashboard.reviewRaw.qc.descriptionManual':
    '手動モードでは各吹き出しとリドローの詳細なレビューが可能です。',
  'dashboard.reviewRaw.qc.note':
    '以下のチェックを有効にしてバッチ分析を実行してください。',
  'dashboard.reviewRaw.qc.automaticChecks': '自動チェック',
  'dashboard.reviewRaw.qc.checks.untranslatedText': '未翻訳テキスト',
  'dashboard.reviewRaw.qc.checks.emptyBubbles': '空の吹き出し',
  'dashboard.reviewRaw.qc.checks.visualArtifacts': '視覚的アーティファクト',
  'dashboard.reviewRaw.qc.checks.textAlignment': 'テキスト配置',
  'dashboard.reviewRaw.qc.checks.fontConsistency': 'フォントの一貫性',
  'dashboard.reviewRaw.qc.inProgress': 'QC分析を実行中...',
  'dashboard.reviewRaw.qc.run': 'QCを実行',
  'common.cancel': 'キャンセル',
  'common.save': '保存',
  'common.name': '名前',
  'common.newName': '新しい名前',
  'common.removed': '削除しました',
  'common.renamed': '名前を変更しました',
  'common.duplicated': '複製しました',
  'common.saved': '保存しました',
  'common.failed': '失敗しました',
  'common.cancelled': 'キャンセルしました',
  'common.status': 'ステータス',
  'common.configured': '設定済み',
  'common.no': 'いいえ',
  'common.account': 'アカウント',
  'common.format': 'フォーマット',
  'common.exportedCount': 'エクスポート済み：{count} 件。',
  'modelManager.modal.verified': '検証日',
  'modelManager.modal.upToDate': '最新です',
  'modelManager.modal.closeAria': 'モーダルを閉じる',
  'modelManager.modal.localModels': 'ローカルカタログ',
  'modelManager.modal.localDesc': '整合性検証付きのオンデマンドインストール。',
  'modelManager.modal.noLocal':
    'フィルターに一致するローカルモデルがありません。',
  'modelManager.modal.cloudModels': 'クラウドカタログ',
  'modelManager.modal.cloudDesc':
    'API/クラウドベースのモデル。接続と独自のキーが必要です。',
  'modelManager.modal.hideCustom': 'カスタムを非表示',
  'modelManager.modal.addCustom': 'カスタムを追加',
  'modelManager.modal.noCloud':
    'フィルターに一致するクラウドモデルがありません。',
  'modelManager.modal.checking': '確認中...',
  'modelManager.modal.checkUpdates': 'アップデートを確認',
  'modelManager.modal.installAll': '推奨をインストール',
  'modelManager.modal.cancel': 'キャンセル',
  'modelManager.modal.noEligible': '対象のモデルが見つかりません。',
  'modelManager.modal.notEnoughSpace':
    '空き容量が不足しています（{space} 必要）。',
  'resources.breadcrumb.home': 'リソース',
  'resources.communities.title': 'コミュニティ・リンク',
  'resources.back': 'リソースに戻る',
  'resources.communities.desc':
    'アクティブなスキャンレーションコミュニティ、Discord、フォーラム、ネットワーキングと学習のためのリソース。',
  'resources.platform.discord': 'Discord',
  'resources.platform.forum': 'フォーラム',
  'resources.platform.reddit': 'Reddit',
  'resources.platform.website': 'Webサイト',
  'resources.communities.members': '{count} メンバー',
  'resources.action.visit': 'アクセス',
  'resources.externalTools.title': '外部ツール',
  'resources.externalTools.desc':
    'スキャンレーションワークフローでKŌMA Studioを補完する推奨ソフトウェアとアプリ。',
  'resources.category.editing': '編集',
  'resources.category.ocr': 'OCR',
  'resources.category.translation': '翻訳',
  'resources.category.fonts': 'フォント',
  'resources.category.hosting': 'ホスティング',
  'resources.category.utility': 'ユーティリティ',
  'resources.action.open': '開く',
  'resources.action.download': 'ダウンロード',
  'resources.status.free': '無料',
  'resources.status.paid': '有料',
  'resources.fonts.title': 'タイプセッティングフォント',
  'resources.fonts.desc':
    'スキャンレーションで人気のフォントを厳選したコレクション。セリフ、ナレーション、強調、SFX、CJKテキスト用フォントを含みます。',
  'resources.fonts.searchPlaceholder': '名前、用途、タグでフォントを検索...',
  'resources.fonts.noResults': '「{search}」に一致するフォントが見つかりません',
  'resources.license.free': '無料',
  'resources.license.openSource': 'オープンソース',
  'resources.license.commercial': '商用',
  'resources.license.mixed': '混合',
  'resources.glossary.title': 'スキャンレーション用語集',
  'resources.glossary.desc':
    'マンガ、マンファ、マンホアのスキャンレーションに必要な技術用語、コミュニティの俗語、基本語彙。',
  'resources.glossary.searchPlaceholder': '用語を検索...',
  'resources.glossary.noResults': '「{search}」に一致する用語が見つかりません',
  'resources.glossary.related': '関連：',
  'resources.category.general': '一般',
  'resources.category.typesetting': 'タイプセッティング',
  'resources.category.cleaning': 'クリーニング',
  'resources.category.technical': '技術',
  'resources.category.roles': '役割',
  'resources.sfx.title': 'SFXライブラリ',
  'resources.sfx.desc':
    '日本語の擬音語・擬態語ライブラリ。翻訳、ローマ字読み、マンガでの使用例を含みます。',
  'resources.sfx.searchPlaceholder': '日本語、ローマ字、または英語で検索...',
  'resources.sfx.noResults': 'SFXが見つかりません。',
  'resources.sfx.commonIn': 'よく使われるジャンル：{value}',
  'resources.category.impact': 'インパクト',
  'resources.category.emotion': '感情',
  'resources.category.ambient': '環境音',
  'resources.category.action': 'アクション',
  'resources.category.voice': '声',
  'resources.category.misc': 'その他',
  'resources.filters.all': 'すべて（{count}）',
  'resources.page.tab.fonts': 'フォント',
  'resources.page.tab.sfx': 'SFXライブラリ',
  'resources.page.tab.glossary': '用語集',
  'resources.page.tab.communities': 'コミュニティ',
  'resources.page.tab.tools': 'ツール',
  'resources.page.title.main': 'リソース',
  'resources.page.title.accent': 'センター',
  'resources.page.subtitle':
    'ワークフロー向けの厳選された素材、コミュニティ、ツール。',
  'resources.page.searchPlaceholder': 'すべてのカテゴリを横断検索...',
  'resources.page.searchAria': 'リソース検索フィールド',
  'resources.page.clearSearch': '検索をクリア',
  'resources.page.tabsAria': 'リソースカテゴリ',
  'resources.category.fonts.label': 'タイプセッティングフォント',
  'resources.category.fonts.description':
    'マンガ、マンファ、マンホアのスキャンレーション向け人気フォントの厳選コレクション。',
  'resources.category.sfx-library.label': 'SFXライブラリ',
  'resources.category.sfx-library.description':
    '日本語の擬音語ライブラリ。翻訳と使用例付き。',
  'resources.category.glossary.label': 'スキャンレーション用語集',
  'resources.category.glossary.description':
    'スキャンレーション界の技術用語とコミュニティ俗語。',
  'resources.category.communities.label': 'コミュニティ',
  'resources.category.communities.description':
    'Discordサーバー、サブレディット、スキャンレーションフォーラム。',
  'resources.category.tools-external.label': '外部ツール',
  'resources.category.tools-external.description':
    '補完的なソフトウェアと便利なオンラインツール。',
  'resources.home.title': 'リソースセンター',
  'resources.home.subtitle':
    'ワークフロー向けの厳選された素材、コミュニティ、ツール。',
  'resources.home.itemCount': '{count} 件',
  'dashboard.aio.result.regionsDetected': '{count} 領域を検出',
  'dashboard.aio.result.textsRecognized': '{count} テキストを認識',
  'dashboard.aio.result.translationsGenerated': '{count} 翻訳を生成',
  'dashboard.aio.result.regionsSegmented': '{count} 領域をセグメント化',
  'dashboard.aio.result.imagesCleaned': '{count} 画像をクリーニング',
  'dashboard.aio.result.blocksReady': '{count} ブロックがレンダー準備完了',
  'dashboard.aio.result.finished': 'AIO完了。{parts}。',
  'resources.glossary.category.general': '一般',
  'resources.glossary.category.typesetting': 'タイプセッティング',
  'resources.glossary.category.cleaning': 'クリーニング',
  'resources.glossary.category.translation': '翻訳',
  'resources.glossary.category.technical': '技術',
  'resources.glossary.category.roles': '役割',
  'resources.glossary.filterAll': 'すべて',
  'resources.glossary.results_one': '件の用語が見つかりました',
  'resources.glossary.results_other': '件の用語が見つかりました',
  'resources.glossary.context': '用語集',
  'resources.glossary.alphaAria': 'アルファベット順ナビゲーション',
  'resources.glossary.alphaBtnAria': '{letter} の項目へ移動',
  'dashboard.aio.config.sourceLanguage': 'ソース言語（検出/OCR/翻訳）',
  'dashboard.aio.config.targetLanguage': '翻訳言語',
  'dashboard.aio.pipeline.rewind': 'パイプラインを戻す',
  'dashboard.aio.pipeline.forward': 'パイプラインを進める',
  'dashboard.aio.pipeline.snapshot': 'スナップショット：',
  'dashboard.aio.pipeline.image': '画像：',
  'dashboard.aio.pipeline.stage': 'ステージ：',
  'dashboard.aio.translation.noneSelected': 'モデルが選択されていません。',
  'dashboard.aio.translation.selected': '選択中：',
  'dashboard.aio.render.hint':
    'フォント/色/配置コントロールはオーバーレイのコンテキストドックにあります。ショートカット：Shift + スクロールで回転。',
  'dashboard.aio.render.warning':
    '画像はレンダリング前のステージです。表示するには進むを使用してください。',
  'dashboard.aio.render.disabled':
    '設定するにはパイプラインでレンダーステージを有効にしてください。',
  'dashboard.stitch.lastToNext': '最後の画像を次のバッチに送信しました。',
  'dashboard.stitch.firstFromNext':
    '次のバッチの最初の画像を現在のバッチに追加しました。',
  'dashboard.stitch.resetPlanning':
    'スティッチャーの計画が自動的に再計算されました。',
  'dashboard.aio.customAi.syncing': 'カスタムAI（同期中...）',
  'dashboard.aio.customOcr.syncing': 'カスタムOCR（同期中...）',
  'dashboard.aio.customOcr.useCase':
    'カスタムOCRプロファイルはローカル同期待ちです。',
  'dashboard.aio.customAi.useCase':
    'カスタムプロファイルはローカル同期待ちです。',
  'dashboard.aio.config.languageHint':
    'ソース言語は検出、認識、翻訳ステージで使用されます。翻訳言語は翻訳のみに適用されます。',
  'dashboard.aio.presets.title': '言語別AIOプリセット',
  'dashboard.aio.presets.currentLanguage': '現在の言語：',
  'dashboard.aio.presets.noneActive': 'アクティブなプリセットなし',
  'dashboard.aio.presets.activeSuffix': '（アクティブ）',
  'dashboard.aio.presets.new': '新規',
  'dashboard.aio.presets.edit': '編集',
  'dashboard.aio.presets.delete': '削除',
  'dashboard.aio.presets.saveCurrent': '現在の設定を保存',
  'dashboard.aio.presets.openSettings': '設定でプリセットを開く',
  'dashboard.aio.presets.presetName': 'プリセット名',
  'dashboard.aio.presets.namePlaceholder': '例：高速JP OCR',
  'dashboard.aio.presets.description': '説明',
  'dashboard.aio.presets.optional': '任意',
  'dashboard.aio.presets.setActiveFor': 'アクティブプリセットとして設定：',
  'dashboard.aio.presets.cancel': 'キャンセル',
  'dashboard.aio.presets.update': 'プリセットを更新',
  'dashboard.aio.presets.create': 'プリセットを作成',
  'dashboard.aio.translation.selectedSummaryModel': '選択中：{name}',
  'dashboard.aio.translation.selectedSummaryCustom':
    '選択中：{name}（カスタム/FREEプロバイダー）',
  'dashboard.aio.translation.selectedSummaryLegacy':
    '選択中：{name}（クラウド/API/AI）',
  'dashboard.aio.translation.selectedSummaryEmpty':
    'AIOで翻訳するにはローカルまたはクラウドモデルを選択してください。',
  'dashboard.aio.translation.supportSummary':
    'ローカルモデルはオンデマンドでダウンロードされます。クラウド/APIモデルはキー経由で引き続き利用可能です。',
  'dashboard.aio.translation.additionalContextPlaceholder': 'クラウド翻訳用の追加コンテキスト...',
  'dashboard.aio.translation.notesToggle': '翻訳とは別にTNを生成・表示',
  'dashboard.aio.translation.neighborContextToggle':
    'バッチ内の隣接画像のコンテキストを使用',
  'dashboard.aio.translation.multimodalToggle':
    'ページ画像をマルチモーダルコンテキストとして送信',
  'dashboard.aio.translation.activeConfigFor': 'アクティブ設定：{value}。',
  'dashboard.aio.customAi.title': 'カスタムAI',
  'dashboard.aio.customAi.loadingProfiles':
    'カスタムプロファイルを読み込み中...',
  'dashboard.aio.customAi.savedTranslationProfile': '保存済み翻訳プロファイル',
  'dashboard.aio.customAi.newTranslationProfile': '新しい翻訳プロファイル',
  'dashboard.aio.customAi.name': '名前',
  'dashboard.aio.customAi.translationNamePlaceholder':
    '例：OpenRouter Manga EN-US',
  'dashboard.aio.customAi.apiBasePlaceholder': 'https://api.example.com/v1',
  'dashboard.aio.customAi.useLocalOllama': 'Ollamaローカルプリセット',
  'dashboard.aio.customAi.apiKeyOptional': 'APIキー（任意）',
  'dashboard.aio.customAi.apiKeyPlaceholder': 'sk-...',
  'dashboard.aio.customAi.translationModelPlaceholder': 'openai/gpt-4.1...',
  'dashboard.aio.customAi.resetTranslation': '翻訳をクリア',
  'dashboard.aio.customAi.useSavedTranslation': '翻訳に使用',
  'dashboard.aio.customAi.removeTranslation': '翻訳を削除',
  'dashboard.aio.customAi.saveTranslation': '翻訳を保存',
  'dashboard.aio.customAi.savedOcrProfile': '保存済みOCRプロファイル',
  'dashboard.aio.customAi.newOcrProfile': '新しいOCRプロファイル',
  'dashboard.aio.customAi.ocrNamePlaceholder': '例：Private Vision OCR',
  'dashboard.aio.customAi.ocrModelPlaceholder': 'gpt-4.1-mini...',
  'dashboard.aio.customAi.resetOcr': 'OCRをクリア',
  'dashboard.aio.customAi.useSavedOcr': 'OCRに使用',
  'dashboard.aio.customAi.removeOcr': 'OCRを削除',
  'dashboard.aio.customAi.saveOcr': 'OCRを保存',
  'dashboard.aio.customAi.openAiCompatibleHint': 'OpenAI互換APIを使用します。',
  'dashboard.aio.clean.maskDilation': 'マスク膨張',
  'bugReport.title': 'バグ報告',
  'bugReport.subtitle': 'スクリーンショット＋自動ログ＋手動添付',
  'bugReport.close': '閉じる',
  'bugReport.details': '詳細',
  'bugReport.evidence': '証拠',
  'bugReport.machineSnapshotIncluded':
    'マシンの技術スナップショットが自動的に含まれます。',
  'bugReport.field.title': 'タイトル',
  'bugReport.field.description': '説明',
  'bugReport.field.severity': '重要度',
  'bugReport.field.steps': '再現手順',
  'bugReport.field.expected': '期待される動作',
  'bugReport.field.actual': '実際の動作',
  'bugReport.field.contact': '連絡先',
  'bugReport.placeholder.title': '例：AIOでバッチ処理中にエラー',
  'bugReport.placeholder.description': '問題を説明してください',
  'bugReport.placeholder.steps': '1. … 2. … 3. …',
  'bugReport.placeholder.contact': 'メール、Discord、@ユーザー',
  'bugReport.severity.low': '低',
  'bugReport.severity.medium': '中',
  'bugReport.severity.high': '高',
  'bugReport.severity.critical': '緊急',
  'bugReport.preparingEvidence': 'スクリーンショットとログを準備中…',
  'bugReport.dragToCrop':
    'ドラッグして任意のトリミング範囲を選択してください。',
  'bugReport.clearCrop': 'トリミングをクリア',
  'bugReport.manualAttachments': '手動添付',
  'bugReport.attach': '添付',
  'bugReport.attach.summary':
    '最大 {count} ファイル、各 {size}MB。合計：{total}。',
  'bugReport.attach.maxCount': '最大 {count} 件の添付ファイル。',
  'bugReport.attach.fileTooLarge': '{name} が {size}MB を超えています。',
  'bugReport.attach.totalTooLarge': '合計が {size}MB を超えています。',
  'bugReport.attach.remove': '{name} を削除',
  'bugReport.screenshotUnavailable': 'スクリーンショットは利用できません。',
  'bugReport.error.bridgeUnavailable': 'ブリッジが利用できません。',
  'bugReport.error.prepareFailed': 'バグ報告の準備に失敗しました。',
  'bugReport.error.noScreenshot': 'スクリーンショットがありません。',
  'bugReport.error.fillTitleDescription': 'タイトルと説明を入力してください。',
  'bugReport.error.generic': '失敗しました。',
  'bugReport.success.sent': '報告を送信しました。{screenshot}',
  'bugReport.success.screenshot': 'スクリーンショット：{url}',
  'bugReport.legalPrefix':
    '送信することで、スクリーンショット、ログ、添付ファイルを確認済みであることを確認します。以下に基づいて素材が転送されます：',
  'bugReport.sending': '送信中…',
  'bugReport.submit': '報告を送信',
  'dashboard.topbar.tools': 'ツール',
  'dashboard.topbar.showSidebar': 'サイドバーを表示',
  'dashboard.topbar.sidebar': 'サイドバー',
  'dashboard.topbar.disableBatch': 'バッチを無効化',
  'dashboard.topbar.enableBatch': 'バッチを有効化',
  'dashboard.topbar.batchStatus': 'バッチ · {count}t',
  'dashboard.topbar.threads': 'スレッド',
  'dashboard.topbar.viewMode': '表示',
  'dashboard.topbar.paginated': 'ページ送り',
  'dashboard.topbar.longStrip': 'ロングストリップ',
  'dashboard.topbar.rotate90': '90° 回転',
  'dashboard.topbar.selectImage': '画像を選択',
  'dashboard.topbar.export': 'エクスポート',
  'dashboard.topbar.textFile': 'テキストファイル',
  'dashboard.topbar.textPackage': 'テキストパッケージ',
  'dashboard.topbar.imagePackage': '画像パッケージ',
  'dashboard.topbar.downloadTextAsTxt': '翻訳を.txtとしてダウンロード。',
  'dashboard.topbar.downloadVisualZip':
    '画像ごとのOCRと翻訳の.txtファイルを含むZIP。',
  'dashboard.topbar.format': 'フォーマット',
  'dashboard.topbar.quality': '品質',
  'dashboard.topbar.package': 'パッケージ',
  'dashboard.topbar.rawText': '原文テキスト',
  'dashboard.topbar.translated': '翻訳済み',
  'dashboard.topbar.inpainted': 'インペイント済み',
  'dashboard.topbar.downloadTxt': 'TXTをダウンロード',
  'dashboard.topbar.downloadZip': 'ZIPをダウンロード',
  'dashboard.topbar.downloadPackage': 'パッケージをダウンロード',
  'dashboard.topbar.layeredPsd': 'レイヤー付きPSD',
  'dashboard.topbar.layeredPsdHint':
    'Photoshop、CSP、Krita、GIMP向けPSDをエクスポート。',
  'dashboard.topbar.compression': '圧縮',
  'dashboard.topbar.dpi': 'DPI',
  'dashboard.topbar.ocrOverlay': 'OCRオーバーレイ',
  'dashboard.topbar.crops': 'クロップ',
  'dashboard.topbar.rawTextLayer': '原文テキストレイヤー',
  'dashboard.topbar.translatedLayer': '翻訳レイヤー',
  'dashboard.topbar.psTextLayers': 'PSテキストレイヤー',
  'dashboard.topbar.metadataJson': 'メタデータJSON',
  'dashboard.topbar.photoshopRequired':
    'Adobe Photoshop（2025〜cc2017）が必要です。',
  'dashboard.topbar.generating': '生成中…',
  'dashboard.topbar.psdWithMeta': 'PSD + メタ',
  'dashboard.topbar.exportPsd': 'PSDをエクスポート',
  'dashboard.topbar.undoWorkspace': 'ワークスペースを元に戻す',
  'dashboard.topbar.undoShortcut': '元に戻す（Ctrl+Z）',
  'dashboard.topbar.redoWorkspace': 'ワークスペースをやり直す',
  'dashboard.topbar.redoShortcut': 'やり直す（Ctrl+Shift+Z / Ctrl+Y）',
  'dashboard.topbar.shortcuts': 'ショートカット',
  'dashboard.topbar.shortcutsHint': 'ショートカット（H）',
  'dashboard.topbar.hideTools': 'ツールを非表示',
  'dashboard.topbar.showTools': 'ツールを表示',
  'dashboard.topbar.hide': '非表示',
  'dashboard.topbar.profile': 'プロフィール',
  'dashboard.topbar.exportWorkspace': 'ワークスペースをエクスポート',
  'dashboard.topbar.importWorkspace': 'ワークスペースをインポート',
  'dashboard.topbar.clearLocalAutosave': 'ローカル自動保存をクリア',
  'dashboard.topbar.closeWorkspace': 'ワークスペースを閉じる',
  'dashboard.topbar.replayTour': 'ツアーを再生',
  'dashboard.topbar.scanlationFeed': 'スキャンレーションフィード',
  'dashboard.topbar.rankings': 'ランキング',
  'dashboard.topbar.logout': 'サインアウト',
  'dashboard.topbar.brand': 'KŌMA Studio',
  'dashboard.topbar.autoManualBadge': 'A/M',
  'dashboard.topbar.zoomOut': '縮小',
  'dashboard.topbar.zoomIn': '拡大',
  'dashboard.topbar.compressionRle': 'RLE',
  'dashboard.topbar.compressionZip': 'ZIP',
  'dashboard.topbar.compressionRaw': 'RAW',
  'dashboard.topbar.navigation': 'ナビゲーション',
  'dashboard.topbar.optionPng': 'PNG',
  'dashboard.topbar.optionJpeg': 'JPEG',
  'dashboard.topbar.optionWebp': 'WEBP',
  'dashboard.topbar.optionPdf': 'PDF',
  'dashboard.topbar.optionCbz': 'CBZ',
  'dashboard.topbar.optionCb7': 'CB7',
  'dashboard.topbar.optionZip': 'ZIP',
  'renderPreview.circularText': '円形テキスト',
  'settings.aioPresets.description':
    'ソース言語別のAIO 5ステージのモデルの組み合わせ。アクティブなプリセットを選択します。',
  'settings.aioPresets.catalog': 'カタログ',
  'settings.aioPresets.syncingCatalog': 'ローカル＋クラウドモデルを同期中。',
  'settings.aioPresets.editPreset': 'プリセットを編集',
  'settings.aioPresets.newPreset': '新しいプリセット',
  'settings.aioPresets.namePlaceholder': '例：日本語 高品質',
  'settings.aioPresets.sourceLanguage': 'ソース言語',
  'settings.aioPresets.shortDescription': '簡単な説明…',
  'settings.aioPresets.select': '選択',
  'settings.aioPresets.noneRegistered': '登録済みのプリセットがありません。',
  'settings.aioPresets.createFirst': '最初に作成',
  'settings.aioPresets.presetCount': '{count} プリセット',
  'settings.aioPresets.clearActive': 'アクティブをクリア',
  'settings.aioPresets.active': 'アクティブ',
  'settings.aioPresets.activate': '有効化',
  'settings.aioPresets.editNamed': '{name} を編集',
  'settings.aioPresets.deleteNamed': '{name} を削除',
  'settings.pickerPalette.title': 'ピッカーパレット',
  'settings.pickerPalette.description':
    '塗りピッカー用��ソリッドおよびグラデーションプリセット。',
  'settings.pickerPalette.newPreset': '新しいプリセット',
  'settings.pickerPalette.add': '追加',
  'settings.pickerPalette.reset': 'リセット',
  'settings.pickerPalette.hintPrefix': 'ソリッドとグラデーションに対応。例：',
  'settings.pickerPalette.hintOr': 'または',
  'settings.pickerPalette.solids': 'ソリッド',
  'settings.pickerPalette.gradients': 'グラデーション',
  'settings.modePresets.title': 'モードプリセット',
  'settings.modePresets.description':
    'テキストモードごとのベーススタイル。ダッシュボードで自動的に適用されます。',
  'settings.modePresets.targetMode': '対象モード',
  'settings.modePresets.outline': 'アウトライン',
  'settings.modePresets.off': 'オフ',
  'settings.modePresets.outlineWidth': 'アウトライン幅',
  'settings.modePresets.ocrGradient': 'OCRグラデーション',
  'settings.modePresets.detect': '検出',
  'settings.modePresets.ignore': '無視',
  'settings.modePresets.textColor': 'テキスト色',
  'settings.modePresets.outlineColor': 'アウトライン色',
  'settings.modePresets.all': 'すべて',
  'settings.modePresets.mode': 'モード',
  'settings.modePresets.save': '保存',
  'settings.typographerLibrary.title': 'タイプセッターライブラリ',
  'settings.typographerLibrary.description':
    'フォルダー、デフォルトプリセット、検出モードによるバインディング付きのグローバルスタイル。',
  'settings.typographerLibrary.newFolder': '新しいフォルダー',
  'settings.typographerLibrary.defaultPreset': 'デフォルトプリセット',
  'settings.typographerLibrary.none': 'なし',
  'settings.typographerLibrary.edit': '編集',
  'settings.typographerLibrary.new': '新規',
  'settings.typographerLibrary.presetTypographer': 'タイプセッタープリセット',
  'settings.typographerLibrary.folder': 'フォルダー',
  'settings.typographerLibrary.withoutFolder': 'フォルダーなし',
  'settings.typographerLibrary.descriptionPlaceholder': '例：吹き出し EN-US',
  'settings.typographerLibrary.padding': 'パディング',
  'settings.typographerLibrary.lineSpacing': '行間',
  'settings.updates.title': 'アップデート',
  'settings.updates.currentVersion': '現在のバージョン',
  'settings.updates.newVersion': '新しいバージョン',
  'settings.updates.status': 'ステータス',
  'settings.updates.channel': 'チャンネル',
  'settings.updates.installOnClose': '終了時にインストール',
  'settings.updates.policy': 'ポリシー',
  'settings.updates.mandatory': '必須',
  'settings.updates.optional': '任意',
  'settings.updates.lastCheck': '最終確認',
  'settings.updates.downloadCompleted': 'ダウンロード完了',
  'settings.updates.channelTitle': 'アップデートチャンネル',
  'settings.updates.stableDesc': 'テスト済みの安定版リリース',
  'settings.updates.betaDesc': '機能への先行アクセス',
  'settings.updates.installOnCloseTitle':
    'アプリ終了時にアップデートをインストール',
  'settings.updates.installOnCloseDesc':
    'パッケージが既にダウンロード済みの場合、終了時に自動的にインストールが開始されます。',
  'settings.updates.checking': '確認中…',
  'settings.updates.checkNow': 'アップデートを確認',
  'settings.updates.download': 'アップデートをダウンロード',
  'settings.autosave.title': 'ワークスペース自動保存',
  'settings.autosave.description':
    'ダッシュボードがローカルワークスペースを自動保存するかどうかと、保存間隔を制御します。',
  'settings.autosave.enableTitle': '自動保存を有効にする',
  'settings.autosave.enableDesc':
    '有効にすると、未保存の変更がある場合、ワークスペースが定期的にローカルに保存されます。',
  'settings.autosave.interval': '間隔',
  'settings.autosave.save': '自動保存を保存',
  'settings.shortcuts.title': 'ショートカットセンター',
  'settings.shortcuts.description':
    '公式のショートカット設定はダッシュボードのトップバーに移動しました。メイン画面と設定ページ間の不一致を防ぎます。',
  'settings.shortcuts.whereToEdit': '編集場所',
  'settings.shortcuts.whereToEditDesc': 'ダッシュボードを開き、',
  'settings.shortcuts.orPress': 'を使用するか、',
  'settings.tabs.ariaLabel': '設定タブ',
  'settings.integrations.test': 'テスト',
  'settings.integrations.testing': 'テスト中…',
  'settings.integrations.ok': '✓ OK',
  'settings.integrations.failed': '✗ 失敗',
  'settings.integrations.saved': '✓ 保存済み',
  'settings.integrations.discord.description':
    '処理通知、エラー、クォータアラート。',
  'settings.integrations.discord.webhookUrl': 'Webhook URL',
  'settings.integrations.discord.webhookPlaceholder':
    'https://discord.com/api/webhooks/…',
  'settings.integrations.discord.botName': 'ボット名',
  'settings.integrations.discord.webhookActive': 'Webhookを有効にする',
  'settings.integrations.discord.howToSetup': 'セットアップ方法',
  'settings.integrations.discord.step1': 'Discordで：',
  'settings.integrations.discord.step1Strong':
    'サーバー設定 → 連携 → Webhook → 新しいWebhook',
  'settings.integrations.discord.step2':
    'URLをコピーして上のフィールドに貼り付けてください。',
  'dashboard.dashboardLlm.extraContextPlaceholder':
    '追加コンテキスト：キャラクター、トーン、用語集…',
  'dashboard.dashboardLlm.temperature': 'Temperature',
  'dashboard.dashboardLlm.topP': 'Top P',
  'dashboard.dashboardLlm.maxTokens': '最大トークン数',
  'dashboard.dashboardLlm.translationProfile': '翻訳プロファイル',
  'dashboard.dashboardLlm.translationModelPlaceholder': 'gpt-4.1, claude…',
  'dashboard.dashboardLlm.apiKey': 'APIキー',
  'dashboard.dashboardLlm.apiKeyPlaceholder': 'sk-…（任意）',
  'dashboard.dashboardLlm.ocrProfile': 'OCRプロファイル',
  'dashboard.dashboardLlm.openAiCompatibleHint':
    'OpenAI互換。ベースは/v1またはフルエンドポイント。一部は空のキーを受け入れます。',
  'dashboard.dashboardLlm.clear': 'クリア',
  'dashboard.dashboardLlm.use': '使用',
  'dashboard.dashboardLlm.remove': '削除',
  'dashboard.dashboardLlm.save': '保存',
  'dashboard.dashboardLlm.hdStrategy': 'HD戦略',
  'dashboard.dashboardLlm.resize': 'リサイズ',
  'dashboard.dashboardLlm.crop': 'クロップ',
  'dashboard.dashboardLlm.original': 'オリジナル',
  'dashboard.dashboardLlm.hdStrategyHint':
    'インペインティング前の大きな画像の処理戦略。',
  'dashboard.dashboardLlm.resizeLimit': 'リサイズ上限',
  'dashboard.dashboardLlm.cropMargin': 'クロップマージン',
  'dashboard.dashboardLlm.cropTriggerSize': 'クロップトリガーサイズ',
  'dashboard.dashboardRegion.title': '領域',
  'dashboard.dashboardRegion.blocks': 'ブロック',
  'dashboard.dashboardRegion.selection': '選択',
  'dashboard.dashboardRegion.ocr': 'OCR',
  'dashboard.dashboardRegion.translation': '翻訳',
  'dashboard.dashboardRegion.notes': 'メモ',
  'dashboard.dashboardRegion.segments': 'セグメント',
  'dashboard.dashboardRegion.disabled': '無効',
  'dashboard.dashboardRegion.manualHint':
    'プレビュー上でドラッグして領域を追加。角をドラッグしてリサイズ。',
  'dashboard.dashboardRegion.manualModeHint':
    'ボックスを調整するには手動モードへ。',
  'dashboard.dashboardRegion.dockHint':
    'キャンバス上のフローティングドックで領域選択、クリーン、編集を行えます。ツールはアクティブなステージに基づいて有効になります。',
  'dashboard.translator.workspace.ariaLabel': 'トランスレーターモード',
  'dashboard.translator.sourceTitle': 'ソーステキスト',
  'dashboard.translator.sourceDescription':
    '段落と改行を保持したまま、貼り付け、インポート、翻訳を行います。',
  'dashboard.translator.sourcePlaceholder':
    '翻訳するチャプターや抜粋をここに貼り付けてください…',
  'dashboard.translator.sourceAria': '翻訳用のソーステキスト',
  'dashboard.translator.import': 'インポート',
  'dashboard.translator.translating': '翻訳中…',
  'dashboard.translator.translate': '翻訳',
  'dashboard.translator.editorCleared': 'エディターをクリアしました。',
  'dashboard.translator.clear': 'クリア',
  'dashboard.translator.resultTitle': '結果',
  'dashboard.translator.resultModelPrefix': 'モデル：{value}',
  'dashboard.translator.resultPlaceholder': '実行して結果を表示。',
  'dashboard.translator.resultFieldPlaceholder':
    '翻訳結果がここに表示されます…',
  'dashboard.translator.resultPlaceholderAria': '翻訳結果',
  'dashboard.translator.editorDirty':
    'ソーステキストが変更されました。更新するには再実行してください。',
  'dashboard.translator.resultCopied': '結果をコピーしました。',
  'dashboard.translator.copy': 'コピー',
  'dashboard.translator.downloadTxt': 'TXTをダウンロード',
  'dashboard.translator.modeLabel': 'トランスレーター',
  'dashboard.translator.workspace.textHint':
    '段落と改行を保持してフリーテキストを翻訳します。',
  'dashboard.translator.workspace.visualHint':
    '画像内の領域を検出し、ボックスごとにOCRと翻訳を行います。',
  'dashboard.translator.processing.standard': '標準',
  'dashboard.translator.processing.aiSfx': 'AI SFX',
  'dashboard.language.source': 'ソース言語',
  'dashboard.language.target': 'ターゲット言語',
  'dashboard.models.title': 'モデル',
  'dashboard.translator.ocr': 'OCR',
  'dashboard.translator.ocr.manageModels': 'OCRモデルを管理',
  'dashboard.translator.noneAvailable': 'モデルなし',
  'dashboard.translator.device': 'デバイス',
  'dashboard.translator.languages': '言語',
  'dashboard.translator.multi': 'マルチ',
  'dashboard.translator.noDescription': '説明なし。',
  'dashboard.translator.localStatus': 'ローカル状態：{value}',
  'dashboard.translator.sfx.cleanModel': 'クリーナーSFX',
  'dashboard.translator.sfx.hint':
    '例：短くて重いSFXを優先する、エフェクトが細い線画に溶け込んでいる場合はより保守的に。',
  'dashboard.translator.llm.contextPlaceholder':
    'コンテキスト：用語集、トーン、キャラクター…',
  'dashboard.translator.llm.generateNotes': '個別のTNを生成',
  'dashboard.translator.llm.multimodalContext':
    '画像をマルチモーダルコンテキストに',
  'dashboard.translator.llm.temperature': 'Temperature',
  'dashboard.translator.llm.topP': 'Top P',
  'dashboard.translator.llm.maxTokens': '最大トークン数',
  'dashboard.translator.execute.title': '実行',
  'dashboard.translator.loadImage': '読み込み',
  'dashboard.translator.detectTranslate': '検出＋翻訳',
  'dashboard.translator.retranslateImage': '画像を再翻訳',
  'dashboard.translator.retranslateRegion': '領域を再翻訳',
  'dashboard.translator.regionTitle': '領域',
  'dashboard.translator.blocks': 'ブロック',
  'dashboard.translator.selection': '選択',
  'dashboard.translator.translation': '翻訳',
  'dashboard.translator.notes': 'メモ',
  'dashboard.translator.none': 'なし',
  'dashboard.translator.charactersTranslated': '{count} 文字を翻訳しました。',
  'splitter.workspace.emptyTitle': '画像を読み込み',
  'splitter.workspace.emptyDescription':
    '左サイドバーを使用してページをインポートします。プレビューには推奨カット位置と生成されたセグメントが表示されます。',
  'splitter.workspace.previewTitle': 'カットプレビュー',
  'splitter.workspace.previewDescription':
    'ダブルクリックでカットを追加。線をドラッグして調整。',
  'splitter.workspace.previewAlt': '{name} のプレビュー',
  'splitter.workspace.cutTitle': 'カット {index}',
  'splitter.workspace.hide': '非表示',
  'splitter.workspace.show': '表示',
  'splitter.workspace.recalculate': '再計算',
  'splitter.workspace.diagnostics': '診断',
  'splitter.workspace.engine': 'エンジン',
  'splitter.workspace.cuts': 'カット',
  'splitter.workspace.segments': 'セグメント',
  'splitter.workspace.whitespace': '余白',
  'splitter.workspace.noWarnings': 'アクティブな画像に警告はありません。',
  'splitter.workspace.cutsTitle': 'カット（{count}）',
  'splitter.workspace.cutCard': 'カット #{index}',
  'splitter.workspace.locked': 'ロック済み',
  'splitter.workspace.unlocked': 'ロック解除',
  'splitter.workspace.merge': '結合',
  'splitter.workspace.segmentsTitle': 'セグメント（{count}）',
  'splitter.workspace.segmentAlt': 'セグメント {index}',
  'splitter.workspace.segmentCard': 'セグメント #{index}',
  'splitter.workspace.analyzing': '分析中…',
  'splitter.workspace.dimensions': 'サイズ',
  'splitter.workspace.axis': '軸',
  'splitter.workspace.strategy': '戦略',
  'splitter.sidebar.title': 'スプリッター',
  'splitter.sidebar.recipe': 'レシピ',
  'splitter.sidebar.preset': 'プリセット',
  'splitter.sidebar.mode': 'モード',
  'splitter.sidebar.direction': '方向',
  'splitter.sidebar.vertical': '縦',
  'splitter.sidebar.horizontal': '横',
  'splitter.sidebar.parts': '分割数',
  'splitter.sidebar.targetHeight': '目標の高さ',
  'splitter.sidebar.minimum': '最小',
  'splitter.sidebar.maximum': '最大',
  'splitter.sidebar.adjustments': '調整',
  'splitter.sidebar.overlap': 'オーバーラップ（{value}px）',
  'splitter.sidebar.whitespace': '余白（{value}）',
  'splitter.sidebar.noise': 'ノイズ（{value}）',
  'splitter.sidebar.edgeGuard': 'エッジガード（{value}px）',
  'splitter.sidebar.protectTallBlocks': '高さのあるブロックを保護',
  'splitter.sidebar.baseName': 'ベース名',
  'splitter.sidebar.baseNamePlaceholder': 'koma-split',
  'splitter.sidebar.suffix': 'サフィックス',
  'splitter.sidebar.suffixPlaceholder': '{image}-part-{index}',
  'splitter.sidebar.tokensPrefix': 'トークン：',
  'splitter.sidebar.tokensAnd': 'と',
  'splitter.sidebar.actions': 'アクション',
  'splitter.sidebar.imagesCount': '{count} 枚',
  'splitter.sidebar.activeImage': 'アクティブ：{name}',
  'splitter.sidebar.selectImage': '画像を選択してください。',
  'splitter.sidebar.reanalyze': '再分析',
  'splitter.sidebar.applyToActive': '→ アクティブに適用',
  'splitter.sidebar.applyToAll': '→ すべてに適用',
  'splitter.sidebar.clearCuts': 'カットをクリア',
  'splitter.sidebar.resetRecipe': 'レシピをリセット',
  'splitter.sidebar.exportActive': 'アクティブをエクスポート',
  'splitter.sidebar.exportBatch': 'バッチエクスポート',
  'splitter.sidebar.directoryUnavailable':
    'showDirectoryPickerは利用できません。',
  'splitter.sidebar.exportToFolder': 'フォルダーにエクスポート',
  'stitch.workspace.cancelled':
    'スティッチャーのレンダリングがキャンセルされました。',
  'stitch.workspace.renderingBatch':
    'バッチ {current}/{total} をレンダリング中...',
  'stitch.workspace.batchReady': 'バッチ {current} がダウンロード可能です。',
  'stitch.workspace.generatingZip':
    '{count} 件のスティッチャーバッチを生成中...',
  'stitch.workspace.zipReady':
    '{count} 件のバッチを含むZIPパッケージが正常に生成されました。',
  'stitch.workspace.savingToFolder':
    '{count} 件のバッチをフォルダーに保存中...',
  'stitch.workspace.folderReady':
    'バッチを選択したフォルダーにエクスポートしました。',
  'stitch.workspace.folderCancelled':
    'フォルダーへのエクスポートがキャンセルされました。',
  'stitch.workspace.noBatchSelected': 'バッチが選択されていません',
  'stitch.workspace.previewEyebrow': 'バッチプレビュー',
  'stitch.workspace.batchTitle': 'バッチ {current} / {total}',
  'stitch.workspace.noBatchAvailable': '利用可能なバッチがありません',
  'stitch.workspace.imagesCount': '{count} 枚の画像',
  'stitch.workspace.previousBatch': '前のバッチ',
  'stitch.workspace.nextBatch': '次のバッチ',
  'stitch.workspace.zoomOut': '縮小',
  'stitch.workspace.resetZoom': 'ズームをリセット',
  'stitch.workspace.zoomIn': '拡大',
  'stitch.workspace.exporting': 'エクスポート中…',
  'stitch.workspace.exportBatch': 'バッチをエクスポート',
  'stitch.workspace.zip': 'ZIP',
  'stitch.workspace.folder': 'フォルダー',
  'stitch.workspace.cancel': 'キャンセル',
  'stitch.workspace.emptyTitle': '準備完了のバッチがありません',
  'stitch.workspace.emptyDescription':
    'ダッシュボードで画像を読み込み、右サイドバーのツールボックスでバッチを設定してください。',
  'stitch.workspace.generatingPreview': 'プレビューを生成中 {progress}%',
  'stitch.workspace.previewAlt': 'スティッチ済みバッチのプレビュー',
  'stitch.workspace.errorTitle': 'スティッチャーが失敗しました',
  'stitch.workspace.planningEyebrow': '計画',
  'stitch.workspace.planningTitle': '{count} 件のバッチが計画済み',
  'stitch.workspace.planningSubtitle':
    '大きなバッチを確認し、計画を閲覧します。',
  'stitch.workspace.baseLabel': 'ベース：',
  'stitch.workspace.batchCardTitle': 'バッチ {index}',
  'stitch.workspace.batchCardDims': '{count} 枚 · {width}×{height}',
  'stitch.workspace.activeBatch': 'アクティブなバッチ',
  'stitch.workspace.stats.images': '画像',
  'stitch.workspace.stats.output': '出力',
  'stitch.workspace.stats.size': 'サイズ',
  'stitch.workspace.stats.preview': 'プレビュー',
  'stitch.workspace.awaiting': '待機中',
  'stitch.workspace.toolboxTitle': 'ツールボックス',
  'stitch.workspace.toolboxDescription':
    '設定と境界の調整は右サイドバーにあります。',
  'stitch.sidebar.title': 'スティッチャー',
  'stitch.sidebar.layout': 'レイアウト',
  'stitch.sidebar.layoutMode': 'スティッチモード',
  'stitch.sidebar.vertical': '縦',
  'stitch.sidebar.horizontal': '横',
  'stitch.sidebar.strategy': '戦略',
  'stitch.sidebar.fixedCount': '固定枚数',
  'stitch.sidebar.targetAxis': '軸の目標値',
  'stitch.sidebar.single': 'オールインワン',
  'stitch.sidebar.imagesPerBatch': 'バッチあたりの画像数',
  'stitch.sidebar.spacing': '間隔（{value}px）',
  'stitch.sidebar.alignment': '配置',
  'stitch.sidebar.start': '先頭',
  'stitch.sidebar.center': '中央',
  'stitch.sidebar.end': '末尾',
  'stitch.sidebar.output': '出力',
  'stitch.sidebar.background': '背景',
  'stitch.sidebar.backgroundColor': '背景色',
  'stitch.sidebar.baseName': 'ベース名',
  'stitch.sidebar.baseNamePlaceholder': 'koma-stitch',
  'stitch.sidebar.imagesInfo':
    '{count} 枚の画像。現在の順序でバッチが決まります。',
  'stitch.sidebar.recalculate': 'バッチを再計算',
  'stitch.sidebar.boundary': '境界',
  'stitch.sidebar.boundaryBatch': 'バッチ {current}/{total} · {count} 枚',
  'stitch.sidebar.noBatch': 'バッチなし',
  'stitch.sidebar.moveLastToNext': '最後 → 次へ',
  'stitch.sidebar.pullFromNext': '次から取得',
  'modelManager.filters.catalog': 'カタログ',
  'modelManager.filters.all': 'すべて',
  'modelManager.filters.local': 'ローカル',
  'modelManager.filters.cloud': 'クラウド',
  'modelManager.filters.language': '言語',
  'modelManager.filters.status': 'ステータス',
  'modelManager.filters.installed': 'インストール済み',
  'modelManager.filters.notInstalled': '未インストール',
  'modelManager.filters.updateAvailable': 'アップデートあり',
  'modelManager.tooltip.speed.fast': '高速',
  'modelManager.tooltip.speed.good': '良好',
  'modelManager.tooltip.speed.excellent': '優秀',
  'modelManager.tooltip.allLanguages': 'すべての対応言語',
  'modelManager.tooltip.infoAria': '{name} のモデル情報',
  'modelManager.tooltip.info': '情報',
  'modelManager.tooltip.aioStage': 'AIOステージ',
  'modelManager.tooltip.description': '説明',
  'modelManager.tooltip.languages': '言語',
  'modelManager.tooltip.speed.label': '速度',
  'modelManager.tooltip.minimum': '最小要件',
  'modelManager.tooltip.downloadSize': 'ダウンロードサイズ',
  'modelManager.tooltip.diskSpace': 'ディスク容量',
  'modelManager.tooltip.version': 'バージョン',
  'modelManager.status.installed': 'インストール済み',
  'modelManager.status.updateAvailable': 'アップデートあり',
  'modelManager.status.downloading': 'ダウンロード中',
  'modelManager.status.queued': 'キュー待ち',
  'modelManager.status.verifying': '検証中',
  'modelManager.status.failed': '失敗',
  'modelManager.status.cancelled': 'キャンセル済み',
  'modelManager.status.incomplete': '不完全',
  'modelManager.status.notInstalled': '未インストール',
  'modelManager.actions.selected': '選択中',
  'modelManager.actions.useModel': 'モデルを使用',
  'modelManager.actions.uninstall': 'アンインストール',
  'modelManager.actions.update': 'アップデート',
  'modelManager.actions.retry': 'リトライ',
  'modelManager.actions.install': 'インストール',
  'modelManager.actions.source': 'ソース',
  'modelCard.status.selected': '選択中',
  'modelCard.status.failed': '失敗',
  'modelCard.status.verifying': '検証中…',
  'modelCard.status.queued': 'キュー待ち…',
  'modelCard.status.downloading': 'ダウンロード中…',
  'modelCard.status.cancelled': 'キャンセル済み',
  'modelCard.status.incomplete': '不完全',
  'modelCard.status.notInstalled': '未インストール',
  'modelCard.action.cancel': 'キャンセル',
  'modelCard.action.remove': '削除',
  'modelCard.action.update': 'アップデート',
  'modelCard.action.install': 'インストール',
  'modelCard.action.retry': 'リトライ',
  'modelCard.action.active': 'アクティブ',
  'modelCard.action.use': '使用',
  'modelManager.stage.translate': '翻訳を取得',
  'modelManager.installAll.attention': '注意',
  'modelManager.installAll.warning':
    'すべての翻訳モデルをダウンロードしようとしています。',
  'modelManager.installAll.totalSize': '合計サイズ：{size}',
  'modelManager.installAll.space': '空き容量：{space}',
  'modelManager.installAll.time': '推定時間：接続速度によります',
  'modelManager.installAll.notEnoughSpace':
    '空き容量が不足しています。必要：{required} ｜ 利用可能：{available}',
  'modelManager.installAll.confirm':
    '長時間かかり、大量のディスク容量を使用する場合があります。続行しますか？',
  'modelManager.installAll.confirmDownload': 'ダウンロードを確認',
  'modelManager.disk.notVerified': 'ディスク未検証',
  'modelManager.disk.free': '{space} 空き',
  'modelManager.disk.models': '{installed}/{total} モデル（{size}）',
  'modelManager.enhance.title': 'エンハンスモデル',
  'modelManager.enhance.description':
    'エンハンサー専用ローカルカタログ。インストール、アップデート、アンインストール、またはONNXのインポート。',
  'modelManager.enhance.freeSpace': '空き容量',
  'modelManager.enhance.notChecked': '未確認',
  'modelManager.enhance.closeAria': 'エンハンスモデ��モーダルを閉じる',
  'modelManager.enhance.directInstall': '直接インストール',
  'modelManager.enhance.directInstallDesc':
    'ダイレクトダウンロードまたはミニバックエンドでの管理インストールが可能な厳選モデル。',
  'modelManager.enhance.manualImport': '手動インポート',
  'modelManager.enhance.manualImportDesc':
    'カタログに掲載されているがローカルONNXで読み込むモデル。`.pth` のみの場合は外部変換を使用してください。',
  'modelManager.enhance.importOnnxBadge': 'ONNXインポート',
  'modelManager.enhance.statusLabel': 'ステータス',
  'modelManager.enhance.estimatedDisk': '推定ディスク容量',
  'modelManager.enhance.reimportOnnx': 'ONNXを再インポート',
  'modelManager.enhance.pthHint': '以下の形式のウェイトの場合：',
  'modelManager.enhance.pthHintSuffix':
    'まずONNXに変換してから手動インポートを使用してください。',
  'common.yes': 'はい',
  'dashboard.organize.hint.reorder':
    '左パネルでファイルをドラッグして並び替えます。',
  'dashboard.organize.hint.rotate':
    '回転ボタンを使用して、横向きにスキャンされたページを修正します。',
  'guides.common.beginner': '初級',
  'guides.common.intermediate': '中級',
  'guides.common.advanced': '上級',
  'guides.home.title': 'ガイド・チュートリアル',
  'guides.home.description':
    'ステップバイステップのガイド、生産性向上のヒント、実例でKŌMA Studioのすべてのツールをマスターしましょう。',
  'guides.home.searchPlaceholder': 'ガイド、ショートカット、ヒントを検索...',
  'guides.home.searchAria': 'ガイドを検索',
  'guides.home.continueReading': '前回の続きから',
  'guides.home.stepProgress': 'ステップ {current}/{total} · {time}',
  'guides.home.continueCta': '続きを読む →',
  'guides.home.categories': 'カテゴリ',
  'guides.home.guidesCountLabel': 'ガイド{suffix}',
  'guides.home.completedCountLabel': '完了{suffix}',
  'guides.home.guidesPluralSuffix': '',
  'guides.home.saved': '保存済み（{count}）',
  'guides.reader.backToGuides': 'ガイドに戻る',
  'guides.reader.notFound': 'ガイドが見つかりません',
  'guides.reader.progressAria': 'ガイドの進捗',
  'guides.reader.stepsAria': 'ガイドのステップ',
  'guides.reader.stepLabel': 'ステップ {index}',
  'guides.reader.recent': '最近',
  'guides.reader.guides': 'ガイド',
  'guides.reader.removeBookmark': 'ブックマークを削除',
  'guides.reader.saveBookmark': 'ブックマークに保存',
  'guides.reader.previous': '前へ',
  'guides.reader.next': '次へ',
  'guides.reader.completeGuide': 'ガイドを完了',
  'guides.detail.back': '戻る',
  'guides.detail.notFound': 'ガイドが見つかりません。',
  'guides.detail.stepsAria': 'ガイドのステップ',
  'guides.detail.stepLabel': 'ステップ {index}',
  'guides.detail.recent': '最近',
  'guides.detail.guides': 'ガイド',
  'guides.detail.stepCounter': 'ステップ {current}/{total}',
  'guides.detail.previous': '前へ',
  'guides.detail.next': '次へ',
  'guides.detail.complete': '完了',
  'guides.detail.completed': '完了 ✓',
  'guides.detail.tocAria': '目次',
  'guides.detail.inThisGuide': 'このガイドの内容',
  'guides.detail.removeFavorite': 'お気に入りから削除',
  'guides.detail.addFavorite': 'お気に入りに追加',
  'guides.detail.saved': '保存済み',
  'guides.detail.save': '保存',
  'guides.step.copyCode': 'コードをコピー',
  'guides.step.copied': 'コピーしました',
  'guides.step.copy': 'コピー',
  'guides.search.dialogAria': 'ガイドを検索',
  'guides.search.placeholder': 'ガイド、ショートカット、ヒントを検索...',
  'guides.search.inputAria': '検索',
  'guides.search.close': '検索を閉じる',
  'guides.search.noResults': '「{query}」の結果が見つかりません',
  'guides.search.results': '結果（{count}）',
  'guides.search.recent': '最近',
  'guides.search.navigate': 'ナビゲート',
  'guides.search.open': '開く',
  'guides.search.closeVerb': '閉じる',
  'guides.category.searchPlaceholder': '{category} 内を検索...',
  'guides.category.searchAria': '{category} 内を検索',
  'guides.category.noSearchResults': '「{query}」のガイドが見つかりません',
  'guides.category.noGuides': 'このカテゴリにはガイドがありません',
  'guides.category.tryOtherTerms': '別のキーワードをお試しください。',
  'guides.category.comingSoon': '新しいガイドが近日追加されます。',
  'guides.category.completed': '完了',
  'settings.profile.title': 'ユーザープロフィール',
  'settings.profile.name': '名前',
  'settings.profile.email': 'メールアドレス',
  'settings.profile.verification': '認証',
  'settings.profile.accountId': 'アカウントID',
  'settings.profile.environment': '環境',
  'settings.profile.unspecified': '未指定',
  'settings.profile.verified': '認証済み',
  'settings.profile.pending': '保留中',
  'settings.profile.sendVerification': '認証メールを送信',
  'settings.profile.legalCenter': '法務センター',
  'settings.travel.title': 'トラベルアクセス',
  'settings.travel.description':
    'アカウントに紐付いたプライマリデバイスを切り替えずに、セカンダリコンピューターを一時的に認証します。',
  'settings.travel.destination': 'トークンの送信先',
  'settings.travel.expiry': 'コードの有効期限',
  'settings.travel.temporaryAccess': '一時アクセス',
  'settings.travel.streamLike': 'ストリーミングプラットフォーム型フロー',
  'settings.travel.streamLikeDesc':
    'コードはアカウントのメールアドレスに送信され、別のPCで一時的なアクセスを付与します。',
  'settings.travel.sendToken': 'トークンをメールに送信',
  'settings.travel.destinationPrefix': '送信先：{value}',
  'settings.travel.expirationPrefix': '有効期限：{value}',
  'settings.travel.accessPrefix': 'アクセス：{value}',
  'settings.travel.definedOnSend': '送信時に決定',
  'settings.plan.day': '日',
  'settings.plan.days': '日',
  'settings.typography.default': 'デフォルト',
  'settings.typography.bindingsTitle': '検出モードによるバインディング',
  'settings.typography.useDefault': 'デフォルトを使用',
  'settings.integrations.blogger.description':
    '画像のストレージ/CDNと投稿の公開。',
  'settings.integrations.blogger.label': 'ラベル',
  'settings.integrations.blogger.labelPlaceholder': 'メインBlogger',
  'settings.integrations.blogger.blogId': 'ブログID',
  'settings.integrations.blogger.blogIdPlaceholder': '数値ID',
  'settings.integrations.blogger.clientId': 'クライアントID',
  'settings.integrations.blogger.clientIdPlaceholder':
    'Google OAuthクライアントID',
  'settings.integrations.blogger.clientSecret': 'クライアントシークレット',
  'settings.integrations.blogger.clientSecretPlaceholder':
    'OAuthクライアントシークレット',
  'settings.integrations.blogger.refreshToken': 'リフレッシュトークン',
  'settings.integrations.blogger.refreshTokenPlaceholder':
    'リフレッシュトークン',
  'settings.integrations.blogger.defaultLabels': 'デフォルトラベル',
  'settings.integrations.blogger.defaultLabelsPlaceholder':
    'manga, chapter, release',
  'settings.integrations.blogger.optimizer': 'オプティマイザー',
  'settings.integrations.blogger.optimizerCloudinary': 'Cloudinary Fetch',
  'settings.integrations.blogger.optimizerTemplate': 'URLテンプレート',
  'settings.integrations.blogger.cloudName': 'クラウド名',
  'settings.integrations.blogger.urlTemplate': 'URLテンプレート',
  'settings.integrations.blogger.cloudNamePlaceholder': 'my-cloud-name',
  'settings.integrations.blogger.cloudinaryTransformation':
    'Cloudinaryトランスフォーメーション',
  'settings.integrations.blogger.optimizerEnabled': 'オプティマイザー有効',
  'settings.integrations.blogger.maxWidth': '最大幅',
  'settings.integrations.blogger.maxHeight': '最大高さ',
  'settings.integrations.blogger.testConnection': '接続テスト',
  'settings.integrations.blogger.requestsPerDay': 'リクエスト/日',
  'settings.integrations.blogger.requestsPerUser': 'リクエスト/ユーザー',
  'settings.integrations.blogger.credentialsGuideTitle': '認証情報の取得方法',
  'settings.integrations.blogger.step1': '以下にアクセスし、',
  'settings.integrations.blogger.step1Suffix':
    'プロジェクトを作成または選択してください。',
  'settings.integrations.blogger.step2': '以下を有効にしてください：',
  'settings.integrations.blogger.step2And': 'および',
  'settings.integrations.blogger.step3': '以下を作成してください：',
  'settings.integrations.blogger.webApplication': 'ウェブアプリケーション',
  'settings.integrations.blogger.step4': '以下を追加してください：',
  'settings.integrations.blogger.step4Suffix': 'をリダイレクトURIに。',
  'settings.integrations.blogger.step5': '以下をコピーしてください：',
  'settings.integrations.blogger.step5And': 'および',
  'settings.integrations.blogger.step6':
    'OAuth同意画面を設定してください。テスト中の場合は、メールアドレスを追加してください。',
  'settings.integrations.blogger.step7': '以下で、',
  'settings.integrations.blogger.step7Suffix':
    '独自の認証情報を有効にし、Blogger + Driveスコープを承認してください。',
  'settings.integrations.blogger.step8': '以下を実行して、',
  'settings.integrations.blogger.step8Suffix': 'をコピーしてください。',
  'settings.integrations.blogger.step9':
    'Cloudinaryの場合、���下をコピーして、',
  'settings.integrations.blogger.step9Suffix':
    'トランスフォーメーションを設定してください。',
  'settings.integrations.blogger.step10': '以下を確認してください：',
  'settings.integrations.blogger.step10Suffix': '（BloggerのURL/API経由）。',
  'settings.integrations.blogger.step11':
    'すべてを保存し、接続をテストして、ダッシュボードのユーティリティを使用してください。',
  'settings.integrations.blogger.googleQuotas': 'Googleクォータ',
  'settings.integrations.blogger.oauthPlayground': 'OAuthプレイグラウンド',
  'settings.integrations.blogger.cloudinaryFetch': 'Cloudinary Fetch',
  'settings.integrations.blogger.driveScopes': 'Driveスコープ',
  'settings.integrations.blogger.driveScopesGuideTitle':
    'OAuthプレイグラウンドでのDriveスコープ',
  'settings.integrations.blogger.minimumPractical': '実用上の最小限：',
  'settings.integrations.blogger.driveScopesNote':
    '追加のスコープについてはDrive API v3の公式ドキュメントを参照してください。',
  'settings.integrations.imgur.title': 'Imgurアップロード',
  'settings.integrations.imgur.description':
    'クライアントIDローテーションと控えめなレート制限による匿名アップロード。',
  'settings.integrations.imgur.limitPerHour': '上限/時間',
  'settings.integrations.imgur.batchDelay': 'バッチ遅延（ms）',
  'settings.integrations.imgur.remaining': '残り',
  'settings.integrations.imgur.used': '使用済み：{used}/{limit}',
  'settings.integrations.imgur.reset': 'リセット：{value}',
  'settings.integrations.imgur.clientIds': 'クライアントID',
  'settings.integrations.imgur.noClientIds':
    'クライアントIDが設定されていません。',
  'settings.integrations.imgur.clientIdPlaceholder': 'ImgurクライアントID',
  'settings.integrations.imgur.quickGuideTitle': 'Imgurクイックガイド',
  'settings.integrations.imgur.step1':
    'Imgur開発者ダッシュボードでアプリケーションを作成し、以下をコピーしてください：',
  'settings.integrations.imgur.step2':
    '1つ以上のクライアントIDを追加します。アプリがランダムに選択します。',
  'settings.integrations.imgur.step3': '匿名アップロード：',
  'settings.integrations.imgur.step3Suffix': 'OAuthなし。',
  'settings.integrations.imgur.step4': '控えめなリミッター：',
  'settings.integrations.imgur.step4Suffix': 'ブロックを回避するため。',
  'settings.integrations.imgur.step5':
    '設定された遅延を尊重した順次アップロード。',
  'settings.integrations.imgur.step6':
    'Imgurは保証されたCDNとして扱うべきではありません。',
  'settings.integrations.imgur.imageApi': 'Imgur Image API',
  'settings.integrations.imgur.uploading': 'Imgurアップロード中',
  'common.add': '追加',
  'common.label': 'ラベル',
  'common.original': 'オリジナル',
  'common.quality': '品質',
  'common.persistence': '永続化',
  'common.secureStore': 'セキュアストア',
  'common.browserFallback': 'ブラウザフォールバック',
  'common.notAvailableShort': '—',
  'common.loading': '読み込み中',
  'common.sending': '送信中…',
  'common.single': 'シングル',
  'common.tile': 'タイル',
  'common.grid': 'グリッド',
  'common.smart': 'スマート',
  'common.multi': 'マルチ',
  'blogger.title': 'Blogger CDN',
  'blogger.heroTitle': 'Bloggerで画像を公開・ホスティング',
  'blogger.heroDescription':
    'ビジュアル/HTMLエディター付きの投稿公開モード。ホスト済みURLを生成するアップロードモード。',
  'blogger.ready': '準備完了',
  'blogger.configureInSettings': '設定で構成',
  'blogger.publishTab': '公開',
  'blogger.uploadTab': 'アップロード',
  'blogger.settings': '設定',
  'blogger.missingConfigTitle': '設定が不足しています',
  'blogger.missingConfigBody': '使用する前に設定で認証情報を保存してください。',
  'blogger.post.title': '投稿',
  'blogger.post.description': 'タイトル、ラベル、公開。',
  'blogger.post.postTitle': 'タイトル',
  'blogger.post.postTitlePlaceholder': '投稿タイトル',
  'blogger.post.defaultLabels': 'デフォルトラベル',
  'blogger.post.defaultLabelsPlaceholder': 'manga, chapter',
  'blogger.post.postLabels': '投稿ラベル',
  'blogger.post.postLabelsPlaceholder': 'review',
  'blogger.post.publishNow': '今すぐ公開',
  'blogger.post.draft': '下書き',
  'blogger.post.publish': '公開',
  'blogger.post.status.draft': '下書きとして保存',
  'blogger.post.status.published': '公開済み',
  'blogger.template.title': '新しいBlogger投稿',
  'blogger.template.description':
    'ここに投稿内容を記述します。ビジュアル、HTML、プレビューを切り替えられます。',
  'blogger.template.insertPrefix': '以下のボタンを使用して、',
  'blogger.template.insertSuffix':
    'ファイルをBloggerにアップロードし、ホスト済みURLをコンテンツに挿入します。',
  'blogger.editor.title': 'エディター',
  'blogger.editor.description': 'ビジュアル、HTML、プレビュー。',
  'blogger.editor.visual': 'ビジュアル',
  'blogger.editor.preview': 'プレビュー',
  'blogger.editor.h1': 'H1',
  'blogger.editor.h2': 'H2',
  'blogger.editor.bold': '太字',
  'blogger.editor.italic': '斜体',
  'blogger.editor.underline': '下線',
  'blogger.editor.list': 'リスト',
  'blogger.editor.numbered': '番号付き',
  'blogger.editor.quote': '引用',
  'blogger.editor.link': 'リンク',
  'blogger.editor.promptUrl': 'URL',
  'blogger.editor.insertImages': '画像を挿入',
  'blogger.copied': 'コピーしました',
  'blogger.loadConfigFailed': 'Blogger設定の読み込みに失敗しました。',
  'blogger.imageInsertedSingle':
    '画像をBloggerにホストし、エディターに挿入しました。',
  'blogger.imageInsertedMany':
    '{count} 枚の画像をBloggerにホストし、エディターに挿入しました。',
  'blogger.uploadFailed': 'Bloggerへの画像アップロードに失敗しました。',
  'blogger.batchUploadSingle':
    '1件のBlogger下書き投稿でアップロードが完了しました。',
  'blogger.batchUploadMany':
    '{count} 枚の画像を1件のBlogger下書き投稿でアップロードしました。',
  'blogger.uploadFailedShort': 'アップロードに失敗しました。',
  'blogger.batchUploadSuccessSingle':
    '1件のBlogger下書き投稿でアップロードが完了しました。',
  'blogger.batchUploadSuccessMany':
    '{count} 枚の画像を1件のBlogger下書き投稿でアップロードしました。',
  'blogger.publishSuccessWithUrl': 'Bloggerに投稿を{verb}しました。URL：{url}',
  'blogger.publishSuccessWithId': 'BloggerにID {id} で投稿を{verb}しました。',
  'blogger.publishFailed': 'Bloggerへの公開に失敗しました。',
  'blogger.uploadSection.title': 'バッチアップロード',
  'blogger.uploadSection.description':
    '画像をドロップしてホスト済みURLを生成します。',
  'blogger.uploadSection.dropTitle': 'ここに画像をドロップ',
  'blogger.uploadSection.dropDescription':
    'ローカル前処理付きのPNG、JPG、WebP。',
  'blogger.uploadSection.optimizedUrl': '最適化URL',
  'blogger.uploadSection.optimizedUrlDesc':
    'アップロード前に最適化URLを生成します。',
  'blogger.uploadSection.exportOptimized': '最適化をエクスポート',
  'blogger.uploadSection.exportOptimizedDesc':
    'バッチアクションで最適化URLを使用します。',
  'blogger.uploadSection.outputImg': '<img>出力',
  'blogger.uploadSection.outputImgDesc': 'URLの代わりにHTMLスニペットを出力。',
  'blogger.uploadSection.select': '選択',
  'blogger.uploadSection.send': '送信',
  'blogger.uploadSection.exported': 'エクスポート済み',
  'blogger.queue.title': 'キュー',
  'blogger.queue.items': '{count} 件',
  'blogger.queue.empty': 'ファイルなし。',
  'blogger.queue.altText': '代替テキスト',
  'blogger.queue.canonical': 'カノニカル',
  'blogger.queue.optimized': '最適化済み',
  'blogger.queue.url': 'URL',
  'blogger.queue.opt': '最適化',
  'blogger.queue.img': 'img',
  'common.remove': '削除',
  'ranking.backToDashboard': 'ダッシュボードに戻る',
  'ranking.hero.title': 'モデルランキング',
  'ranking.hero.subtitle':
    '公式モデルを実際のコミュニティレビューで比較 — 品質、速度、コストパフォーマンス、使いやすさ。',
  'ranking.hero.globalStatsAria': 'グローバル統計',
  'ranking.hero.models': 'モデル',
  'ranking.hero.reviews': 'レビュー',
  'ranking.hero.bestOverall': '総合ベスト',
  'ranking.hero.costBenefit': 'コスパ最優秀',
  'ranking.loading': 'ランキングを更新中…',
  'legalHub.back': '戻る',
  'legalHub.sidebarTitle': '法務センター',
  'legalHub.supportDescription':
    'サポート、プライバシー、データ主体リクエストはアプリ/Webサイトに記載された公式チャンネルをご利用ください。',
  'legalHub.supportCta': 'サポートチャンネルを開く',
  'legalHub.noticeTitle': '重要なお知らせ。',
  'dashboard.dashboardExecute.selectImage': '実行する画像を選択してください。',
  'dashboard.dashboardExecute.runCurrentStage':
    '画像の現在のステージを実行します。',
  'dashboard.dashboardExecute.rerunStage': 'ステージを再実行',
  'dashboard.dashboardExecute.runStage': 'ステージを実行',
  'dashboard.dashboardExecute.runAio': 'AIOを実行',
  'dashboard.dashboardExecute.stop': '実行を停止',
  'freeProviderCard.stage.translation': '翻訳',
  'freeProviderCard.stage.ocr': 'OCR',
  'freeProviderCard.stage.clean': 'クリーン',
  'freeProviderCard.badge.integrated': '統合済み',
  'freeProviderCard.badge.catalog': 'カタログ',
  'freeProviderCard.verifiedAt': '検証日',
  'freeProviderCard.tooltip.selectedModel': '選択中のモデル',
  'freeProviderCard.tooltip.notSelected': '（未選択）',
  'freeProviderCard.tooltip.notDefined': '（未定義）',
  'freeProviderCard.tooltip.apiKeyConfigured': '設定済み',
  'freeProviderCard.tooltip.apiKeyRequired': '必須（保留中）',
  'freeProviderCard.tooltip.apiKeyOptional': '任意（空）',
  'freeProviderCard.tooltip.extraFields': '追加フィールド',
  'freeProviderCard.tooltip.modelsInStage': 'このステージのモデル',
  'freeProviderCard.tooltip.empty': '（空）',
  'freeProviderCard.label.model': 'モデル',
  'freeProviderCard.label.apiBase': 'APIベース',
  'freeProviderCard.label.apiKey': 'APIキー',
  'freeProviderCard.label.required': '（必須）',
  'freeProviderCard.label.optional': '（任意）',
  'freeProviderCard.placeholder.apiKey': 'ここにキーを貼り付け',
  'freeProviderCard.status.activeProfile': 'アクティブプロファイル：',
  'freeProviderCard.status.catalogOnlyWarning':
    'このプロバイダーはv1ではカタログのみです。',
  'freeProviderCard.action.save': '保存',
  'freeProviderCard.action.use': '使用',
  'customProvider.field.name': '名前',
  'customProvider.field.model': 'モデル',
  'customProvider.field.apiBase': 'APIベース',
  'customProvider.field.apiKey': 'APIキー',
  'customProvider.placeholder.noKey': '（キーなし）',
  'customProvider.placeholder.pasteKey': 'ここにキーを貼り付け',
  'customProvider.status.active': 'パイプラインでアクティブなプロファイル',
  'customProvider.action.cancel': 'キャンセル',
  'customProvider.action.saving': '保存中...',
  'customProvider.action.save': '保存',
  'customProvider.action.edit': '編集',
  'customProvider.action.delete': '削除',
  'customProvider.badge.customProfile': 'カスタムプロファイル',
  'freeProviderCard.status.integrated': '統合済み',
  'freeProviderCard.status.catalog': 'カタログ',
  'freeProviderCard.status.verifiedAt': '検証日',
  'freeProviderCard.info.label': '情報',
  'freeProviderCard.info.tooltip': '{name} の情報',
  'freeProviderCard.info.selectedModel': '選択中のモデル：',
  'freeProviderCard.info.notSelected': '（未選択）',
  'freeProviderCard.info.modelId': 'モデルID：',
  'freeProviderCard.info.notDefined': '（未定義）',
  'freeProviderCard.info.apiBase': 'APIベース：',
  'freeProviderCard.info.apiKey': 'APIキー：',
  'freeProviderCard.info.configured': '設定済み',
  'freeProviderCard.info.required': '必須（保留中）',
  'freeProviderCard.info.optional': '任意（空）',
  'freeProviderCard.info.extraFields': '追加フィールド：',
  'freeProviderCard.info.setup': 'セットアップ：',
  'freeProviderCard.info.limits': '制限：',
  'freeProviderCard.info.rateLimits': 'レート制限：',
  'freeProviderCard.info.modelsInStage': 'このステージのモデル：',
  'freeProviderCard.field.model': 'モデル',
  'freeProviderCard.field.apiBase': 'APIベース',
  'freeProviderCard.field.apiBaseTitle':
    'v1におけるこのプロバイダーの固定APIベース',
  'freeProviderCard.field.required': '（必須）',
  'freeProviderCard.field.optional': '（任意）',
  'freeProviderCard.field.apiKeyPlaceholder': 'ここにキーを貼り付け',
  'freeProviderCard.status.catalogOnly':
    'このプロバイダーはv1ではカタログのみです。',
  'freeProviderCard.actions.save': '保存',
  'freeProviderCard.actions.use': '使用',
  'freeProviderCard.empty': '（空）',
  'customProvider.action.use': '使用',
  'typo.tag': 'タイポグラファー',
  'typo.session.title': 'セッション',
  'typo.session.image': '画像：',
  'typo.session.selection': '選択：',
  'typo.session.none': 'なし',
  'typo.tools.aria': '形状ツール',
  'typo.tools.select': '選択',
  'typo.tools.rect': '矩形',
  'typo.tools.ellipse': '楕円形',
  'typo.actions.refine': 'リファイン',
  'typo.actions.toRect': '→ 矩形',
  'typo.actions.toEllipse': '→ 楕円形',
  'typo.actions.duplicate': '複製',
  'typo.actions.delete': '選択を削除',
  'typo.presets.title': 'プリセット',
  'typo.presets.active': 'アクティブプリセット',
  'typo.presets.none': 'プリセットなし',
  'typo.presets.applySelection': '→ 選択に適用',
  'typo.presets.applyImage': '→ 画像に適用',
  'typo.snapshots.title': 'スナップショット',
  'typo.snapshots.hint': '現在の状態を保存して後で復元できます。',
  'typo.snapshots.placeholder': 'スナップショット名',
  'typo.snapshots.save': 'スナップショットを保存',
  'typo.snapshots.select': '選択…',
  'typo.snapshots.restore': '復元',
  'typo.queue.title': 'テキストキュー',
  'typo.queue.editorPlaceholder':
    '行を貼り付けてください（1行につき1つの吹き出し）…',
  'typo.queue.editorAria': 'キューテキストエディター',
  'typo.queue.build': 'キューを構築',
  'typo.queue.import': 'インポート',
  'typo.queue.applySelected': '項目を適用',
  'typo.queue.next': '次へ',
  'typo.queue.clear': 'クリア',
  'typo.queue.multiBubble': 'マルチバブル',
  'typo.queue.listAria': 'タイポグラフィキュー',
  'typo.queue.emptyTitle': 'キューは空です',
  'typo.queue.emptyDesc': '1行につき1つの吹き出しでシーケンスを構築します。',
  'typo.queue.statusApplied': '適用済み',
  'typo.queue.statusSkipped': 'スキップ済み',
  'typo.queue.statusPending': '保留中',
  'modelDetail.empty':
    'リーダーボードでモデルを選択して、詳細とレビューを表示します。',
  'modelDetail.source.local': 'ローカル',
  'modelDetail.source.cloud': 'クラウド',
  'modelDetail.score.aria': '総合スコア：{score}',
  'modelDetail.score.label': 'スコア',
  'modelDetail.reviews.count_one': '{count} 件のレビュー',
  'modelDetail.reviews.count_other': '{count} 件のレビュー',
  'modelDetail.trend.up': '+{trend} pts（30日）',
  'modelDetail.trend.down': '{trend} pts（30日）',
  'modelDetail.trend.neutral': 'トレンドなし',
  'modelDetail.metrics.quality': '品質',
  'modelDetail.metrics.speed': '速度',
  'modelDetail.metrics.costBenefit': 'コストパフォーマンス',
  'modelDetail.metrics.easeOfUse': '使いやすさ',
  'modelDetail.distro.title': '評価分布',
  'modelDetail.distro.lastReview': '最新レビュー：{date}',
  'modelDetail.info.title': '技術的コンテキスト',
  'modelDetail.info.noNotes': 'このモデルに追加ノートは登録されていません。',
  'modelDetail.info.source': 'ソース',
  'modelDetail.info.target': 'ターゲット',
  'modelDetail.actions.editReview': 'レビューを編集',
  'modelDetail.actions.startReview': 'モデルをレビュー',
  'modelDetail.actions.sending': '送信中…',
  'modelDetail.actions.verifyEmail': 'メールを認証',
  'modelDetail.warning.verifyEmail':
    'レビューの投稿または編集前にメールアドレスを確認してください。',
  'modelDetail.recentReviews.title': '最近のレビュー',
  'modelDetail.recentReviews.loading': '読み込み中…',
  'modelDetail.recentReviews.empty':
    'このモデルにはまだ公開レビューがありません。',
  'modelDetail.pagination.prev': '前へ',
  'modelDetail.pagination.next': '次へ',
  'modelDetail.usage.balanced': 'バランス型',
  'modelDetail.usage.quality_first': '品質優先',
  'modelDetail.usage.speed_first': '速度優先',
  'modelDetail.usage.low_vram': '低VRAM',
  'modelDetail.usage.offline_local': 'ローカル',
  'modelDetail.usage.cloud_pipeline': 'クラウド',
  'resources.empty.title.withQuery': '「{query}」の結果がありません',
  'resources.empty.title.noQuery': '項目が見つかりません',
  'resources.empty.desc.withQuery':
    '別のキーワードを試すか、フィルターをクリアして{context}を探してください。',
  'resources.empty.desc.noQuery':
    'フィルターを調整して利用可能な{context}を表示してください。',
  'resources.fonts.license.free': '無料',
  'resources.fonts.license.openSource': 'オープンソース',
  'resources.fonts.license.commercial': '商用',
  'resources.fonts.license.mixed': '混合',
  'resources.fonts.context': 'フォント',
  'resources.fonts.placeholder': 'フォントのプレビュー用にテキストを入力...',
  'resources.fonts.results_one': '件のフォントが見つかりました',
  'resources.fonts.results_other': '件のフォントが見つかりました',
  'resources.fonts.previewFallback': '信じられない！',
  'resources.fonts.sizeAria': '{size}pxでプレビュー',
  'resources.sfx.category.impact': 'インパクト',
  'resources.sfx.category.emotion': '感情',
  'resources.sfx.category.ambient': '環境音',
  'resources.sfx.category.action': 'アクション',
  'resources.sfx.category.voice': '声',
  'resources.sfx.category.misc': 'その他',
  'resources.sfx.filterAria': 'カテゴリでフィルター',
  'resources.sfx.filterAll': 'すべて（{count}）',
  'resources.sfx.results_one': '件の効果音',
  'resources.sfx.results_other': '件の効果音',
  'resources.sfx.context': '効果音',
  'resources.sfx.copyAria': '「{text}」をコピー',
  'resources.communities.platform.forum': 'フォーラム',
  'resources.communities.results_one': '件のコミュニティ',
  'resources.communities.results_other': '件のコミュニティ',
  'resources.communities.context': 'コミュニティ',
  'resources.communities.visitAria': '外部ブラウザで{name}にアクセス',
  'resources.communities.visit': 'アクセス',
  'resources.tools.category.editing': '編集',
  'resources.tools.category.ocr': 'OCR',
  'resources.tools.category.translation': '翻訳',
  'resources.tools.category.fonts': 'フォント',
  'resources.tools.category.hosting': 'ホスティング',
  'resources.tools.category.utility': 'ユーティリティ',
  'resources.tools.filterAll': 'すべて',
  'resources.tools.results_one': '件のツール',
  'resources.tools.results_other': '件のツール',
  'resources.tools.context': 'ツール',
  'resources.tools.free.yes': '無料',
  'resources.tools.free.no': '有料',
  'resources.tools.action.open': '開く',
  'resources.tools.action.download': 'ダウンロード',
  'feed.roles.raw': 'Rawプロバイダー',
  'feed.roles.cl': 'クリーナー',
  'feed.roles.rd': 'リドローワー',
  'feed.roles.tl': 'トランスレーター',
  'feed.roles.pr': '校正者',
  'feed.roles.ts': 'タイプセッター',
  'feed.roles.qc': 'クオリティチェッカー',
  'feed.contact.discord': 'Discord',
  'feed.contact.twitter_x': 'Twitter/X',
  'feed.contact.telegram': 'Telegram',
  'feed.contact.email': 'メール',
  'feed.contact.whatsapp': 'WhatsApp',
  'feed.contact.instagram': 'Instagram',
  'feed.contact.placeholder.discord': 'https://discord.gg/... またはユーザー名',
  'feed.contact.placeholder.twitter_x':
    'ユーザー名または https://x.com/username',
  'feed.contact.placeholder.telegram': 'https://t.me/... または @チャンネル',
  'feed.contact.placeholder.email': 'contact@scanlation.com',
  'feed.contact.placeholder.whatsapp': '+1 555 123-4567 またはリンク',
  'feed.contact.placeholder.instagram':
    'ユーザー名または https://instagram.com/username',
  'feed.weekdays.seg': '月',
  'feed.weekdays.ter': '火',
  'feed.weekdays.qua': '水',
  'feed.weekdays.qui': '木',
  'feed.weekdays.sex': '金',
  'feed.weekdays.sab': '土',
  'feed.weekdays.dom': '日',
  'feed.report.reasons.malicious_link': '悪意のあるリンク',
  'feed.report.reasons.spam': 'スパム',
  'feed.report.reasons.impersonation': 'なりすまし',
  'feed.report.reasons.harassment': 'ハラスメント / 悪用',
  'feed.report.reasons.copyright': '著作権侵害',
  'feed.report.reasons.other': 'その他',
  'feed.modal.closeAria': 'モーダルを閉じる',
  'feed.feedback.newApplication':
    'スキャンレーションフィードに新しい応募がありました。',
  'feed.error.loadFailed':
    'スキャンレーションフィードの読み込みに失敗しました。',
  'feed.hero.back': 'ダッシュボードに戻る',
  'feed.hero.title': '募集、ショーケース、モデレーション',
  'feed.hero.subtitle':
    '求人投稿、作品紹介、応募の受付、不審なコンテンツの報告を行えます。',
  'feed.tab.recruitment': '募集',
  'feed.tab.showcase': 'ショーケース',
  'feed.tab.moderation': 'モデレーション',
  'feed.actions.createPost': '{type}を作成',
  'feed.alert.safety':
    '正当なソーシャルメディアと連絡先のみを使用してください。不審な投稿は通報できます。',
  'feed.alert.banPolicy':
    '悪意のある投稿はアカウント、デバイス、ネットワーク単位で永久BANにつながる可能性があります。',
  'feed.card.recruitmentRecent': '最近の募集',
  'feed.card.showcaseRecent': '最近のショーケース',
  'feed.card.moderationQueue': 'モデレーションキュー',
  'feed.loading': 'フィードを読み込み中…',
  'feed.empty.noRecruitment': '募集投稿が見つかりません',
  'feed.empty.noShowcase': 'ショーケースが見つかりません',
  'feed.empty.cleanQueue': 'キューはクリーンです',
  'feed.empty.beFirst': '最初の{type}を投稿しましょう！',
  'feed.empty.noModPosts': 'モデレーションキューに投稿がありません。',
  'feed.post.recruitLabel': '募集',
  'feed.post.showcaseLabel': 'ショーケース',
  'feed.post.rolePayNegotiable': '要相談',
  'feed.post.rolePayVolunteer': 'ボランティア',
  'feed.post.actions.apply': '応募',
  'feed.post.actions.report': '通報',
  'feed.post.actions.show': '表示',
  'feed.post.actions.hide': '非表示',
  'feed.post.actions.ban': 'BAN',
  'feed.sidebar.profileTitle': '作成者プロフィール',
  'feed.sidebar.rulesLabel':
    'フィードのルールに同意します。悪意のあるリンクは永久BANの対象となります。',
  'feed.sidebar.webhookLabel': 'Discord Webhook通知',
  'feed.sidebar.saveProfile': 'プロフィールを保存',
  'feed.sidebar.inboxTitle': '内部受信箱',
  'feed.sidebar.yourApplications': '送信した応募',
  'feed.sidebar.noApplications': '送信した応募がありません。',
  'feed.sidebar.receivedTitle': '受信済み',
  'feed.sidebar.noReceived': '受信した応募がありません。',
  'feed.sidebar.reportsTitle': '通報',
  'feed.sidebar.noReports': '保留中の通報がありません。',
  'feed.sidebar.banTitle': 'BAN処理',
  'feed.sidebar.applyBan': 'BANを適用',
  'feed.feedback.postPublishedRecruit': '募集を公開しました。',
  'feed.feedback.postPublishedShowcase': 'ショーケースを公開しました。',
  'feed.feedback.reportSent': 'モデレーションに通報を送信しました。',
  'feed.feedback.profileUpdated': 'フィードプロフィールを更新しました。',
  'feed.feedback.applicationSent': '応募を送信しました。',
  'feed.feedback.banApplied': 'BANを適用し、セッションを無効化しました。',
  'feed.feedback.reportUpdated': '通報を更新しました。',
  'feed.feedback.postStatusUpdated': '投稿を {status} に更新しました。',
  'feed.moderation.notes.resolved': 'モデレーションにより確認済み。',
  'feed.moderation.notes.dismissed': 'モデレーションにより却下。',
  'feed.moderation.banReasonPost': 'モデレーション対象投稿：{title}',
  'feed.moderation.targetUserId': '対象ユーザーID',
  'feed.moderation.applyBan': 'BANを適用',
  'feed.error.roleDuplicate': '{role} は既に追加されています。',
  'feed.error.valuePositive': '値は正の数である必要があります。',
  'feed.error.platformDuplicate': '{platform} は既に追加されています。',
  'feed.error.platformRequired': '{platform} を入力してください。',
  'feed.error.saveProfileFailed': 'プロフィールの保存に失敗しました。',
  'feed.error.publishFailed': '公開に失敗しました。',
  'feed.error.applyFailed': '応募に失敗しました。',
  'feed.error.reportFailed': '通報に失敗しました。',
  'feed.error.moderatePostFailed': '投稿のモデレーションに失敗しました。',
  'feed.error.moderateReportFailed': '通報の更新に失敗しました。',
  'feed.error.banFailed': 'BANの適用に失敗しました。',
  'feed.composer.typeRecruit': '募集',
  'feed.composer.typeShowcase': 'ショーケース',
  'feed.composer.placeholder.titleRecruit': '例：翻訳者を募集中',
  'feed.composer.placeholder.titleShowcase': '例：新章が公開されました',
  'feed.composer.placeholder.bodyRecruit':
    'プロジェクトと候補者がどのように貢献できるかを説明してください...',
  'feed.composer.placeholder.bodyShowcase':
    'リリースと関連情報を記述してください...',
  'feed.composer.placeholder.scanlationName': 'スキャンレーション名',
  'feed.composer.placeholder.workTitle': '作品タイトル',
  'feed.composer.placeholder.chapterLabel': '第42話',
  'feed.composer.placeholder.genres': 'アクション, ロマンス, ファンタジー',
  'feed.composer.placeholder.description':
    'このリリースについて説明してください...',
  'feed.composer.sections.project': 'プロジェクト',
  'feed.composer.sections.work': '作品',
  'feed.composer.sections.recruitmentSettings': '募集設定',
  'feed.composer.toggle.recruiting': '募集中',
  'feed.composer.toggle.recruitingDesc':
    'スキャンは新しいメンバーを受け入れていますか？',
  'feed.composer.toggle.paidWork': '有償作業',
  'feed.composer.toggle.paidWorkDesc': 'メンバーに報酬が支払われますか？',
  'feed.composer.requirements.label': '候補者に求めるもの：',
  'feed.composer.requirements.portfolio': 'ポートフォリオ',
  'feed.composer.requirements.experience': '経験',
  'feed.composer.requirements.availability': '稼働可能時間',
  'feed.composer.requirements.contact': '連絡先',
  'feed.composer.availability.minRequired': '最低稼働可能時間：',
  'feed.composer.availability.hoursPerWeek': '週あたりの時間',
  'feed.composer.availability.daysOptional': '曜日（任意）',
  'feed.composer.availability.descriptionOptional': '説明（任意）',
  'feed.composer.availability.placeholder':
    '毎週チャプターを納品できる方を必要としています...',
  'feed.composer.sections.roles': 'ロール',
  'feed.composer.sections.rolesSub': '（募集中のロールを追加）',
  'feed.composer.roles.roleLabel': 'ロール',
  'feed.composer.roles.valueLabel': '報酬（$）',
  'feed.composer.roles.valueHint': '（チャプターごと）',
  'feed.composer.roles.add': '追加',
  'feed.composer.roles.allAdded': 'すべてのロールが追加済み',
  'feed.composer.roles.addBtn': 'ロールを追加',
  'feed.composer.social.title': 'ソーシャルメディア',
  'feed.composer.social.sub': '（少なくとも1つ）',
  'feed.composer.social.platform': 'プラットフォーム',
  'feed.composer.social.user': 'ユーザー',
  'feed.composer.social.url': 'URL/リンク',
  'feed.composer.social.allAdded': 'すべてのプラットフォームが追加済み',
  'feed.composer.social.addBtn': 'ソーシャルメディアを追加',
  'feed.composer.sections.media': 'メディア',
  'feed.composer.media.uploading': '送信中...',
  'feed.composer.media.uploadBtn': 'Imgur経由でアップロード',
  'feed.apply.title': '応募を送信',
  'feed.apply.message': 'メッセージ',
  'feed.apply.messagePlaceholder':
    '自己紹介と参加したい理由を書いてください...',
  'feed.apply.preferredContact': '希望する連絡先',
  'feed.apply.portfolio': 'ポートフォリオ / リンク',
  'feed.apply.portfolioPlaceholder': '1行に1つのリンク...',
  'feed.report.title': '投稿を通報',
  'feed.report.reason': '理由',
  'feed.report.details': '詳細',
  'feed.report.detailsPlaceholder': '問題を説明してください...',
  'feed.report.send': '通報を送信',
  'freeProvider.manager.titleTranslation': 'FREEプロバイダー（翻訳）',
  'freeProvider.manager.titleOcr': 'FREEプロバイダー（OCR）',
  'auth.password.hide': 'パスワードを非表示',
  'auth.password.show': 'パスワードを表示',
  'modelManager.stage.cleanImage': '画像クリーニング',
  'modelManager.stage.detectText': 'テキスト検出',
  'modelManager.stage.recognizeText': 'テキスト認識',
  'modelManager.stage.segmentText': 'テキストセグメンテーション',
  'fillStylePopover.gradient': 'グラデーション',
  'fillStylePopover.hint.gradient':
    '同じピッカーでソリッドまたはグラデーションを選択。',
  'fillStylePopover.hint.solid': 'ソリッドカラーを選択。',
  'klSlider.resetValue': '値をリセット',
  'dashboard.aio.translation.llm.temperature': 'Temperature',
  'dashboard.aio.translation.llm.topP': 'Top P',
  'dashboard.aio.translation.llm.maxTokens': '最大トークン数',
  'dashboard.enhance.modeTag': 'エンハンス',
  'dashboard.enhance.scale.2x': '2×',
  'dashboard.enhance.scale.4x': '4×',
  'optimizer.hero.title': 'チャプターオプティマイザー',
  'optimizer.hero.desc':
    '最終ページをWeb、閲覧、アーカイブ向けに最適化します。',
  'optimizer.hero.pages': 'ページ',
  'optimizer.hero.savings': '削減量',
  'optimizer.hero.saved': '保存済み',
  'optimizer.hero.output': '出力',
  'optimizer.panel.presets': 'プリセット',
  'optimizer.panel.output': '出力',
  'optimizer.panel.dimensions': 'サイズ',
  'optimizer.panel.filters': 'フィルター',
  'optimizer.panel.preview': 'プレビュー',
  'optimizer.presets.webLight': 'Webライト',
  'optimizer.presets.webLight.desc': '高速読み込み向けの軽量設定',
  'optimizer.presets.reading': '閲覧',
  'optimizer.presets.reading.desc': '閲覧者向けのバランスの取れた品質',
  'optimizer.presets.archive': 'アーカイブ',
  'optimizer.presets.archive.desc': '保存向けのロスレス設定',
  'optimizer.presets.social': 'ソーシャル',
  'optimizer.presets.social.desc': 'ソーシャルメディア向けに最適化',
  'optimizer.presets.custom': 'カスタム',
  'optimizer.presets.custom.desc': '独自の設定',
  'optimizer.config.format': 'フォーマット',
  'optimizer.config.quality': '品質',
  'optimizer.config.resize': 'リサイズ',
  'optimizer.config.trimBorders': '余白トリミング',
  'optimizer.config.trimTolerance': 'トリミング許容値',
  'optimizer.config.maxWidth': '最大幅',
  'optimizer.config.maxHeight': '最大高さ',
  'optimizer.config.sharpen': 'シャープ',
  'optimizer.config.sharpenStrength': 'シャープ強度',
  'optimizer.config.grayscale': 'グレースケール',
  'optimizer.config.autoLevels': '自動レベル補正',
  'optimizer.action.optimizing': '最適化中...',
  'optimizer.action.folder': 'フォルダー',
  'optimizer.preview.generating': 'プレビューを生成中...',
  'optimizer.preview.before': '変更前',
  'optimizer.preview.after': '変更後',
  'optimizer.preview.reduction': '削減率',
  'optimizer.preview.dimensions': 'サイズ',
  'optimizer.preview.compare': '比較',
  'optimizer.preview.original': 'オリジナル',
  'optimizer.preview.optimized': '最適化済み',
  'optimizer.preview.empty':
    '画像を読み込んでオプティマイザーを使用してください。',
  'optimizer.results.title': '結果',
  'optimizer.results.empty': '最適化を実行して結果を表示します。',
  'optimizer.results.download': 'ファイルをダウンロード',
  'optimizer.error.worker':
    'チャプターオプティマイザーでWorkerが利用できません。',
  'optimizer.error.failed': 'チャプターオプティマイザーが失敗しました。',
  'optimizer.error.preview': 'オプティマイザーのプレビューが失敗しました。',
  'optimizer.config.brightness': '明るさ',
  'optimizer.config.contrast': 'コントラスト',
  'optimizer.config.noiseReduction': 'ノイズ軽減',
  'optimizer.config.noiseReductionStrength': 'ノイズ軽減強度',
  'optimizer.config.rotation': '回転',
  'optimizer.config.rotationNone': 'なし',
  'optimizer.config.renamePattern': 'リネームパターン',
  'optimizer.config.renameHint':
    '{name} で元のファイル名、{index} でゼロ埋め番号、{ext} で拡張子を使用します。',
  'optimizer.panel.advanced': '詳細設定',
  'optimizer.export.folderSuccess':
    'チャプターオプティマイザーが選択したフォルダーにファイルをエクスポートしました。',
  'optimizer.export.zipSuccess':
    'チャプターオプティマイザーのパッケージが正常に生成されました。',
  'resources.communities.platform.discord': 'Discord',
  'resources.communities.platform.reddit': 'Reddit',
  'resources.communities.platform.website': 'Webサイト',
  'resources.communities.platform.telegram': 'Telegram',
  'dashboard.cleaner.modeTag': 'クリーナー',
  'stitch.error.loadImage': '画像の読み込みに失敗しました。',
  'stitch.error.initCanvas': 'スティッチャーのキャンバス初期化に失敗しました。',
  'stitch.error.initTempCanvas':
    'スティッチャーの中間画像の準備に失敗しました。',
  'stitch.error.generateBlob': 'スティッチャーのBlob生成に失敗しました。',
  'stitch.error.cancelled': 'レンダリングがキャンセルされました。',
  'stitch.error.workerFailed': 'スティッチャーのWorker実行に失敗しました。',
  'stitch.error.generatePreview':
    'スティッチャーのプレビュー生成に失敗しました。',
  'stitch.error.exportBatch':
    'スティッチャーのバッチエクスポートに失敗しました。',
  'stitch.error.generateZip': 'スティッチャーのZIP生成に失敗しました。',
  'stitch.error.saveFolder': 'バッチのフォルダーへの保存に失敗しました。',
  'dashboard.footer.runtime.fallback.label': 'フォールバック',
  'watermark.blend.normal': '通常',
  'watermark.blend.multiply': '乗算',
  'watermark.blend.screen': 'スクリーン',
  'watermark.blend.overlay': 'オーバーレイ',
  'watermark.blend.softLight': 'ソフトライト',
  'watermark.blend.hardLight': 'ハードライト',
  'watermark.blend.colorDodge': '覆い焼きカラー',
  'watermark.blend.colorBurn': '焼き込みカラー',
  'watermark.panel.shadow': 'シャドウレイヤー',
  'watermark.shadow.enable': '背景シャドウを有効化',
  'watermark.shadow.blur': 'ぼかし',
  'watermark.shadow.opacity': '不透明度',
  'watermark.shadow.color': '色',
  'watermark.shadow.offsetY': 'オフセット Y',
  'watermark.panel.textAvoidance': 'テキスト回避',
  'watermark.textAvoidance.enable': 'テキスト領域を回避',
  'watermark.textAvoidance.desc':
    'AIテキスト検出を使用して、画像内のテキストにウォーターマークが重ならないようにします。',
  'watermark.textAvoidance.detecting': '検出中...',
  'watermark.textAvoidance.detectCurrent': '現在の画像を検出',
  'watermark.textAvoidance.detectAll': 'すべて検出',
  'watermark.textAvoidance.detected':
    '{{count}} 件のテキスト領域を検出しました。',
  'watermark.textAvoidance.detectedAll':
    'すべての画像で {{count}} 件のテキスト領域を検出しました。',
  'watermark.textAvoidance.failed': 'テキスト検出に失敗しました。',
  'watermark.textAvoidance.zonesFound': 'ゾーン',
  'watermark.textAvoidance.showOverlay': 'ゾーンを表示',
  'watermark.text.shadowBlur': 'シャドウぼかし',
  'watermark.text.shadowColor': 'シャドウ色',
  'watermark.distribution.offsetX': 'オフセット X',
  'watermark.distribution.offsetY': 'オフセット Y',
  'watermark.distribution.density': '密度',
  'dashboard.dock.tooltip.hoverHint': 'カーソルを合わせてプレビューを表示',
  'dashboard.dock.config.ariaLabel': 'アクティブツール設定',
  'dashboard.dock.config.closeTitle': '設定を閉じる',
  'dashboard.dock.config.closeAriaLabel': 'ツール設定を閉じる',
  'dashboard.dock.areaSelection.sectionTitle': '領域選択',
  'dashboard.dock.areaSelection.shapeLabel': '新しい選択の形状',
  'dashboard.dock.areaSelection.optionAuto': '自動',
  'dashboard.dock.areaSelection.optionSquare': '矩形',
  'dashboard.dock.areaSelection.optionRounded': '楕円形',
  'dashboard.dock.areaSelection.hintAuto': '自動検出：{kind}。',
  'dashboard.dock.areaSelection.hintFixed':
    '新しい領域は {mode} として作成されます。',
  'dashboard.dock.areaSelection.btnDuplicate': '複製',
  'dashboard.dock.areaSelection.btnToAuto': '→ 自動',
  'dashboard.dock.areaSelection.btnToSquare': '→ 矩形',
  'dashboard.dock.areaSelection.btnToRounded': '→ 楕円形',
  'dashboard.dock.segment.brushTitle': 'セグメントブラシ',
  'dashboard.dock.segment.eraserTitle': 'セグメント消しゴム',
  'dashboard.dock.segment.sizeLabel': 'サイズ',
  'dashboard.dock.segment.hint': '半径を調整してセグメント領域を編集します。',
  'dashboard.dock.imageTool.paintTitle': 'ブラシ',
  'dashboard.dock.imageTool.eraserTitle': '消しゴム',
  'dashboard.dock.imageTool.healingTitle': '修復ブラシ',
  'dashboard.dock.imageTool.sizeLabel': 'サイズ',
  'dashboard.dock.imageTool.opacityLabel': '不透明度',
  'dashboard.dock.imageTool.blurLabel': 'ぼかし',
  'dashboard.dock.imageTool.colorLabel': '色',
  'dashboard.dock.imageTool.colorAriaLabel': 'ブラシの色',
  'dashboard.dock.magicWand.title': 'マジックワンド',
  'dashboard.dock.magicWand.toleranceLabel': '許容値',
  'dashboard.dock.magicWand.healingBtnTitle':
    'ワンド選択にインペインティングを適用',
  'dashboard.dock.magicWand.healingBtnBusy': '適用中…',
  'dashboard.dock.magicWand.healingBtn': '修復',
  'dashboard.dock.magicWand.clearBtn': 'クリア',
  'dashboard.dock.imageTool.modelHint': 'モデル：',
  'dashboard.dock.palette.ariaLabel': '手動画像ツール',
  'dashboard.dock.config.closeLabel': '設定を閉じる',
  'dashboard.dock.config.openLabel': '設定を開く',
  'dashboard.dock.config.badge': '設定',
  'dashboard.dock.config.description':
    'アクティブツールのコンテキストパネルを開き、形状、サイズ、不透明度、許容値、その他の詳細設定を調整します。',
  'dashboard.dock.config.disabledReason':
    '編集可能なパラメータを持つツールを有効にして設定を開いてください。',
  'dashboard.dock.divider.reg': '領域',
  'dashboard.dock.areaSelect.ariaLabel': '領域を選択',
  'dashboard.dock.areaSelect.title': '領域を選択',
  'dashboard.dock.areaSelect.description':
    'プレビューでテキスト領域を作成、調整、リファインします。OCR、翻訳、レンダリング前の検出済み吹き出しの修正に最適です。',
  'dashboard.dock.areaSelect.badge': '領域',
  'dashboard.dock.areaSelect.disabledReason':
    '手動AIOの検出およびレンダーステージで使用可能です。',
  'dashboard.dock.clearPage.ariaLabel': 'すべての領域をクリア',
  'dashboard.dock.clearPage.title': 'ページをクリア',
  'dashboard.dock.clearPage.description':
    'このページのすべての領域を一度に削除し、残りなしで手動マーキングをやり直せます。',
  'dashboard.dock.clearPage.badge': 'リセット',
  'dashboard.dock.clearPage.disabledReason':
    '検出/レンダーステージで、アクティブ画像に領域が作成済みである必要があります。',
  'dashboard.dock.divider.seg': 'セグ',
  'dashboard.dock.segBrush.ariaLabel': 'セグメント領域ブラシ',
  'dashboard.dock.segBrush.title': 'セグメントブラシ',
  'dashboard.dock.segBrush.description':
    'セグメンテーションマスクを拡張して、除外された文字、輪郭線、吹き出しの一部を復元します。',
  'dashboard.dock.segBrush.badge': 'セグ',
  'dashboard.dock.segBrush.disabledReason':
    'テキストセグメンテーションステージで使用可能です。',
  'dashboard.dock.segEraser.ariaLabel': 'セグメント領域消しゴム',
  'dashboard.dock.segEraser.title': 'セグメント消しゴム',
  'dashboard.dock.segEraser.description':
    '余分な選択、はみ出し、クリーニングに含めるべきでないアーティファクトを削除してマスクをリファインします。',
  'dashboard.dock.segEraser.badge': 'セグ',
  'dashboard.dock.segEraser.disabledReason':
    'テキストセグメンテーションステージで使用可能です。',
  'dashboard.dock.divider.img': '画像',
  'dashboard.dock.paint.ariaLabel': 'ペイントブラシ',
  'dashboard.dock.paint.title': 'ブラシ',
  'dashboard.dock.paint.description':
    'アーティファクト、インペインティングの欠陥、微修正が必要な詳細に直接画像上でペイントします。',
  'dashboard.dock.paint.badge': '画像',
  'dashboard.dock.paint.disabledReason':
    '手動モードに入り、編集するアクティブ画像を選択してください。',
  'dashboard.dock.paintEraser.ariaLabel': 'ペイント消しゴム',
  'dashboard.dock.paintEraser.title': '消しゴム',
  'dashboard.dock.paintEraser.description':
    '手動ペイントレイヤーのみを消去して、検出やマスクを失わずに変更を元に戻します。',
  'dashboard.dock.paintEraser.badge': '画像',
  'dashboard.dock.paintEraser.disabledReason':
    '手動モードに入り、編集するアクティブ画像を選択してください。',
  'dashboard.dock.wand.ariaLabel': 'マジックワンド',
  'dashboard.dock.wand.title': 'マジックワンド',
  'dashboard.dock.wand.description':
    '色/許容値で連続領域を素早く選択し、精密な修復や残留物の除去を行います。',
  'dashboard.dock.wand.badge': '画像',
  'dashboard.dock.wand.disabledReason':
    '手動モードに入り、編集するアクティブ画像を選択してください。',
  'dashboard.dock.healing.ariaLabel': '修復ブラシ',
  'dashboard.dock.healing.title': '修復ブラシ',
  'dashboard.dock.healing.description':
    '欠陥、破損したエッジ、テキストの残留物に局所的なインペインティングを適用し、周囲のテクスチャをより自然に保ちます。',
  'dashboard.dock.healing.badge': '画像',
  'dashboard.dock.healing.disabledReason':
    '手動モードに入り、編集するアクティブ画像を選択してください。',
  'dashboard.dock.clearPaint.ariaLabel': 'ペイントをクリア',
  'dashboard.dock.clearPaint.title': 'ペイントをクリア',
  'dashboard.dock.clearPaint.description':
    'アクティブ画像の手動ペイントレイヤー全体を消去しますが、他の修正やステージ履歴はリセットしません。',
  'dashboard.dock.clearPaint.badge': 'リセット',
  'dashboard.dock.clearPaint.disabledReason':
    'アクティブ画像に手動ペイントが適用済みの場合のみ表示されます。',
  'dashboard.dock.resetEdits.ariaLabel': 'すべての編集をリセット',
  'dashboard.dock.resetEdits.title': '編集をリセット',
  'dashboard.dock.resetEdits.description':
    'アクティブ画像を元の手動ステージ状態に戻し、ペイント、修復、ワンド選択、ローカルオーバーライドを削除します。',
  'dashboard.dock.resetEdits.badge': 'リセット',
  'dashboard.dock.resetEdits.disabledReason':
    'アクティブ画像が何らかの手動介入を受けた後に使用可能です。',
  'modelManager.stage.automaticAiClean': '自動AIクリーン',
  'resources.fonts.downloadLabel': 'ダウンロード',
  'dashboard.sidebar.supportedFormats':
    'JPG, PNG, WEBP, ZIP, PDF, CBZ, CB7, PSD',
  'dashboard.cleaner.ocr.label': 'OCR',
  'dashboard.cleaner.ai.defaultProvider': 'クラウド / API / AI',
  'bugReport.screenshot.alt': 'スクリーンショット',
  'pageTransition.loading.ariaLabel': '読み込み中',
  'watermark.text.placeholder': 'KŌMA Studio',
  'watermark.logo.alt': 'ロゴ',
  'dashboard.textDetection.regionActions.aria': '領域アクション',
  'dashboard.textDetection.manualModeRequired': '手動モードが必要です',
  'dashboard.textDetection.removeRegion': '領域を削除',
  'dashboard.renderText.rewind.title': 'この画像を戻る',
  'dashboard.renderText.forward.title': 'この画像を進む',
  'dashboard.renderText.noHistory': 'この画像のAIO履歴はありません',
  'dashboard.renderText.editPlaceholder': '最終テキストを入力...',
  'dashboard.renderText.editAria': 'レンダリングテキストを編集',
  'dashboard.renderText.removeSelection.title': '選択を削除',
  'dashboard.renderText.regionActions.aria': '領域アクション',
  'dashboard.pipeline.prevStep.title': '前のAIOパイプラインステージに戻る',
  'dashboard.pipeline.nextStep.title': '次のAIOパイプラインステージに進む',
  'dashboard.pipeline.runStep.title': '選択した画像の現在のステージのみを実行',
  'dashboard.pipeline.skipStep.title':
    '現在のステージをスキップして次のステージを解放',
  'dashboard.typesetter.applyStyleAll.title':
    '現在の選択スタイルをすべての領域に適用',
  'auth.error.internetRequired':
    'アプリにサインインするにはインターネット接続が必要です。',
  'auth.error.mandatoryUpdate':
    '必須アップデートがあります。続行するにはアプリをアップデートしてください。',
  'dashboard.textDetection.noTextRecognized': '認識されたテキストなし',
  'dashboard.textDetection.noTranslation': '翻訳なし',
  'dashboard.textDetection.noNt': 'TNなし',
  'dashboard.renderText.dblClickToEdit': 'ダブルクリックして編集',
  'dashboard.renderText.renderNotApplied': 'このステージではレンダリング未適用',
  'dashboard.status.stageLabelTranslation': '翻訳',
  'dashboard.status.profilesPersistedDesktopSecure':
    'カスタムプロファイルをデスクトップのセキュアストレージに保存しました。',
  'dashboard.status.profilesPersistedDesktopLocal':
    'カスタムプロファイルをデスクトップに保存しました（ネイティブ暗号化なし）。',
  'dashboard.status.profilesPersistedBrowser':
    'カスタムプロファイルをこのデバイスのローカルブラウザに保存しました。',
  'dashboard.status.aioScopeManual': 'AIO手動',
  'dashboard.status.aioScopeAuto': 'AIO自動',
  'dashboard.status.cleanerSelectProfileFirst':
    '自動AIクリーンで使用する保存済みビジュアルプロファイルを選択してください。',
  'dashboard.status.cleanerProfileNotFound':
    'ビジュアルプロファイルが見つかりません。リロードして再試行してください。',
  'dashboard.status.cleanerProfileInUse':
    '自動AIクリーンで使用中のビジュアルプロファイル：{label}。',
  'dashboard.status.cleanerSelectValidModel':
    '自動AIクリーンに有効なモデルを選択してください。',
  'dashboard.status.modelInRoadmap':
    'モデル「{name}」はまだロードマップに含まれています。',
  'dashboard.status.modelNeedsConfig':
    'モデル「{name}」は使用前に設定が必要です。',
  'dashboard.status.translatorSfxSelectValidModel':
    'トランスレーターのAI SFXに有効なモデルを選択してください。',
  'dashboard.status.cleanerProfileSaved':
    'ビジュアルプロファイルを保存し、自動AIクリーンに選択しました：{label}。',
  'dashboard.status.cleanerSelectProfileToRemove':
    '削除する保存済みビジュアルプロファイルを選択してください。',
  'dashboard.status.customProfilePendingSync':
    'カスタムプロファイルはローカル同期待ちです。',
  'dashboard.status.customProfileOcrPendingSync':
    'カスタムOCRプロファイルはローカル同期待ちです。',
  'dashboard.status.presetAppliedToSelection':
    'プリセット「{name}」を現在の選択に適用しました。',
  'dashboard.status.legacyPresetNotFound':
    'レガシービジュアルプリセット {modeKey} が見つかりません。',
  'dashboard.status.presetAppliedShort':
    'プリセット「{name}」を選択に適用しました。',
  'dashboard.status.presetAppliedToImage':
    'プリセット「{name}」をアクティブ画像に適用しました。',
  'dashboard.status.typographerSelectionDuplicated':
    'タイプセッターで選択を複製しました。',
  'dashboard.status.autoShapeApplied': '自動形状を適用：{shape}。',
  'dashboard.status.renderStyleAppliedAll':
    'レンダリングスタイルをすべての画像のすべての選択に適用しました。',
  'dashboard.status.canvasInitFailed':
    '手動コンポジションキャンバスの初期化に失敗しました。',
  'dashboard.status.cleanerCanvasInitFailed':
    'クリーナーの手動コンポジションキャンバスの初期化に失敗しました。',
  'dashboard.status.wandPrepFailed': 'マジックワンドの準備に失敗しました。',
  'dashboard.status.wandSelectionUpdated':
    'ワンド選択を更新しました。修復を使用してインペインティングを適用してください。',
  'dashboard.status.wandNoArea':
    'ワンドが選択に適した領域を見つけられませんでした。',
  'dashboard.status.wandExecFailed': 'マジックワンドの実行に失敗しました。',
  'dashboard.status.cleanerWandPrepFailed':
    'クリーナーのマジックワンドの準備に失敗しました。',
  'dashboard.status.cleanerWandSelectionUpdated':
    'クリーナーのワンド選択を更新しました。修復を使用してインペインティングを適用してください。',
  'dashboard.status.cleanerWandNoArea':
    'クリーナーのワンドが選択に適した領域を見つけられませんでした。',
  'dashboard.status.cleanerWandExecFailed':
    'クリーナーのマジックワンドの実行に失敗しました。',
  'dashboard.status.healingInvalidResponse':
    '修復ブラシ適用時の応答が無効です。',
  'dashboard.status.cleanerHealingInvalidResponse':
    'クリーナーの修復ブラシ適用時の応答が無効です。',
  'dashboard.status.cleanerHealingConnectFailed':
    'クリーナーの修復がバックエンド（{url}）に接続できませんでした。ミニバックエンドがアクティブか確認してください。',
  'dashboard.status.cleanerHealingFailed':
    'クリーナーの修復ブラシの適用に失敗しました。',
  'dashboard.status.wandNoSelectionForHealing':
    '修復を適用するワンド選択がありません。',
  'dashboard.status.renderCanvasInitFailed':
    'レンダーキャンバスの初期化に失敗しました。',
  'dashboard.status.aioCompleteAdjust':
    '{message} 必要に応じて手動で調整してください。',
  'dashboard.status.aioAborted': 'AIO実行が中止されました。',
  'dashboard.alert.importWorkspaceConfirm':
    'このワークスペースをインポートすると、現在のメモリ内ワークスペースが置き換えられます。続行しますか？',
  'dashboard.alert.clearAutosaveConfirm':
    'ローカル自動保存をクリアすると、このPCのこのユーザーの最後に保存されたワークスペースが削除されます。続行しますか？',
  'dashboard.alert.closeWorkspaceConfirm':
    '現在のワークスペースを閉じますか？読み込まれたすべての画像とローカル自動保存が削除されます。この操作は元に戻せません。',
  'dashboard.status.workspacePendingChanges':
    'ワークスペースに未保存の変更があります。',
  'dashboard.status.toolSelectArea': '領域選択',
  'dashboard.status.toolSegmentBrush': 'セグメントブラシ',
  'dashboard.status.toolSegmentEraser': 'セグメント消しゴム',
  'dashboard.alert.emailPendingTitle': 'メール認証が保留中です',
  'dashboard.alert.emailPendingText':
    '処理アクションを実行するにはメールアドレスを確認してください。',
  'dashboard.status.typographerSession': 'タイプセッターセッション',
  'dashboard.status.cleanerMeta':
    'OCR：{ocrCount} • セグメント済み：{segmentedCount} • クリーン済み：{cleaned}',
  'dashboard.status.metaOk': 'OK',
  'dashboard.status.metaPending': '保留中',
  'dashboard.status.cleanerRunFirst':
    'クリーナーを実行してOCR、セグメンテーション、クリーン済み画像を生成してください。',
  'dashboard.status.translatorMeta':
    '検出：{detected} • OCR：{ocr} • 翻訳：{translated}',
  'dashboard.status.translatorRunFirst':
    'ビジュアルトランスレーターを実行して検出、認識、翻訳を行ってください。',
  'dashboard.status.localModelDownloadHint':
    'ローカルモデルはオンデマンドでダウンロードされます。クラウド/APIモデルは引き続きキーを使用します。',
  'dashboard.status.selectionTextModeAria': '現在の選択のテキストモード',
  'dashboard.status.translatorUsesAioModel':
    'トランスレーターはAIOと同じモデル選択を使用します。モデルを切り替えた後に再実行してください。',
  'dashboard.status.translatorLocalModelIncompatible':
    '現在のローカルモデルはトランスレーターの言語ペアをサポートしていません。別のモデルを選択するか、クラウドを使用してください。',
  'dashboard.status.stitchLastMoved': '最後の画像を次のバッチに送信しました。',
  'dashboard.status.stitchFirstPulled':
    '次のバッチの最初の画像を現在のバッチに追加しました。',
  'auth.error.generic': 'エラー {status}',
  'auth.error.desktopBridgeUnavailable':
    'デスクトップ認証ブリッジが利用できません。',
  'dashboard.status.modeLabel': 'モード',
  'dashboard.status.selectedLabel': '選択中',
  'dashboard.status.selectBoxInPreview':
    'プレビューでボックスを選択してください。',
  'dashboard.status.selectTranslatorModel':
    'トランスレーターで翻訳するにはローカルまたはクラウドモデルを選択してください。',
  'dashboard.error.loadHardwareFailed':
    'ローカルハードウェアの読み込みに失敗しました。',
  'dashboard.error.healingBrushFailed': '修復ブラシが失敗しました：{message}',
  'dashboard.status.healingBrushApplyFailed':
    '修復ブラシの適用に失敗しました。',
  'dashboard.error.cleanerHealingBrushFailed':
    'クリーナーの修復ブラシが失敗しました：{message}',
  'dashboard.status.aioExecutionFailed': 'AIOの実行に失敗しました。',
  'dashboard.status.autosaveSaveFailed':
    'ローカル自動保存の保存に失敗しました。',
  'dashboard.status.workspaceExportFailed':
    'ワークスペースのエクスポートに失敗しました。',
  'dashboard.status.workspaceImportFailed':
    'ワークスペースのインポートに失敗しました。',
  'dashboard.status.autosaveClearFailed':
    'ローカル自動保存のクリアに失敗しました。',
  'dashboard.status.noModelSelected': 'モデルが選択されていません。',
  'dashboard.status.aiCleanModelSelected':
    '自動AIクリーンに選択されたモデル：{model}',
  'dashboard.status.selectionMode': '選択モード',
  'dashboard.status.workspaceRestored': 'ワークスペースを復元しました。',
  'dashboard.status.workspaceRestoredFromAutosave':
    'ローカル自動保存からワークスペースを復元しました。',
  'dashboard.aio.skip': 'スキップ',
  'dashboard.aio.imageLabel': '画像：',
  'dashboard.aio.stepLabel': 'ステージ：',
  'dashboard.aio.historyHint': 'ステージ：{label}（{current}/{total}）',
  'dashboard.typo.fontsUpdating': '更新中…',
  'dashboard.typo.updateFonts': 'フォントを更新',
  'dashboard.typo.importFontTitle': 'カスタムフォントをインポート',
  'dashboard.typo.desktopOnly': 'デスクトップアプリのみ',
  'dashboard.typo.fontImporting': 'インポート中…',
  'dashboard.typo.importFont': 'フォントをインポート',
  'dashboard.typo.applyStyleToAll': 'すべてにスタイルを適用',
  'dashboard.typo.fontControlsHint':
    'フォント/色/配置コントロールはオーバーレイのコンテキストドックにあります。ショートカット：',
  'dashboard.aio.languageLabel': '言語：',
  'shortcuts.category.global': 'グローバル',
  'shortcuts.category.modes': 'モード',
  'shortcuts.category.typesetter': 'タイプセッター',
  'shortcuts.noShortcut': 'ショートカットなし',
  'shortcuts.openShortcutModal.label': 'ショートカットセンターを開く',
  'shortcuts.openShortcutModal.description':
    'ショートカットと設定モーダルを開きます。',
  'shortcuts.toggleToolsPanel.label': 'ツールパネルの表示/非表示',
  'shortcuts.toggleToolsPanel.description':
    'ツールパネルの表示を切り替えます。',
  'shortcuts.rotateActiveImage.label': 'アクティブ画像を回転',
  'shortcuts.rotateActiveImage.description': '選択した画像を90度回転します。',
  'shortcuts.workspaceSave.label': 'ローカルワークスペースを保存',
  'shortcuts.workspaceSave.description':
    '現在のワークスペースのローカル自動保存を強制実行します。',
  'shortcuts.workspaceUndo.label': 'ワークスペースを元に戻す',
  'shortcuts.workspaceUndo.description':
    '現在のワークスペースの最後の変更を元に戻します。',
  'shortcuts.workspaceRedo.label': 'ワークスペースをやり直す',
  'shortcuts.workspaceRedo.description':
    '現在のワークスペースで元に戻した最後の変更をやり直します。',
  'shortcuts.zoomIn.label': '拡大',
  'shortcuts.zoomIn.description': '現在のステージを拡大します。',
  'shortcuts.zoomOut.label': '縮小',
  'shortcuts.zoomOut.description': '現在のステージを縮小します。',
  'shortcuts.setViewPaginated.label': 'ページ送り表示',
  'shortcuts.setViewPaginated.description': 'ページ送り表示に切り替えます。',
  'shortcuts.setViewLongStrip.label': 'ロングストリップ表示',
  'shortcuts.setViewLongStrip.description':
    'ロングストリップ表示に切り替えます。',
  'shortcuts.setModeOrganize.label': '整理モード',
  'shortcuts.setModeOrganize.description': '整理モードに切り替えます。',
  'shortcuts.setModeAio.label': 'AIOモード',
  'shortcuts.setModeAio.description': 'AIOモードに切り替えます。',
  'shortcuts.setModeCleaner.label': 'クリーナー / リドローワーモード',
  'shortcuts.setModeCleaner.description':
    'クリーナー / リドローワーモードに切り替えます。',
  'shortcuts.setModeTypesetter.label': 'タイプセッターモード',
  'shortcuts.setModeTypesetter.description':
    'タイプセッターモードに切り替えます。',
  'shortcuts.setModeTranslator.label': 'トランスレーターモード',
  'shortcuts.setModeTranslator.description':
    'トランスレーターモードに切り替えます。',
  'shortcuts.setModeRaw.label': 'Rawプロバイダーモード',
  'shortcuts.setModeRaw.description': 'Rawプロバイダーモードに切り替えます。',
  'shortcuts.setModeProofreader.label': '校正 / QCモード',
  'shortcuts.setModeProofreader.description': '校正 / QCモードに切り替えます。',
  'shortcuts.setModeStitch.label': 'スティッチモード',
  'shortcuts.setModeStitch.description': 'スティッチモードに切り替えます。',
  'shortcuts.setModeSplit.label': 'スマートスプリットモード',
  'shortcuts.setModeSplit.description':
    'スマートスプリットモードに切り替えます。',
  'shortcuts.setModeWatermark.label': 'ウォーターマークモード',
  'shortcuts.setModeWatermark.description':
    'ウォーターマークモードに切り替えます。',
  'shortcuts.setModeEnhance.label': '画像エンハンスモード',
  'shortcuts.setModeEnhance.description':
    '画像エンハンスモードに切り替えます。',
  'shortcuts.setModeGuides.label': 'ガイドモード',
  'shortcuts.setModeGuides.description': 'ガイドモードに切り替えます。',
  'shortcuts.setModeResources.label': 'リソースモード',
  'shortcuts.setModeResources.description': 'リソースモードに切り替えます。',
  'shortcuts.applyText.label': 'テキストを適用',
  'shortcuts.applyText.description':
    'タイプセッターまたはAIO手動レンダーで選択したキュー項目を適用します。',
  'shortcuts.nextRegion.label': '次の領域を選択',
  'shortcuts.nextRegion.description':
    'タイプセッターまたは手動AIOで選択を次の領域に移動します。',
  'shortcuts.previousRegion.label': '前の領域を選択',
  'shortcuts.previousRegion.description':
    'タイプセッターまたは手動AIOで選択を前の領域に移動します。',
  'shortcuts.toggleMultiBubble.label': 'マルチバブル切り替え',
  'shortcuts.toggleMultiBubble.description':
    'タイプセッターまたは手動AIOでマルチバブルグループを切り替えます。',
  'shortcuts.saveSnapshot.label': 'スナップショットを保存',
  'shortcuts.saveSnapshot.description':
    'タイプセッターまたは手動AIOセッションのスナップショットを保存します。',
  'shortcuts.detectShapes.label': '形状の検出/リファイン',
  'shortcuts.detectShapes.description':
    'タイプセッターまたは手動AIOで選択した形状の検出またはリファインを実行します。',
  'shortcuts.applyActivePreset.label': 'アクティブプリセットを適用',
  'shortcuts.applyActivePreset.description':
    'アクティブなタイポグラフィプリセットを選択した領域に適用します。',
  'shortcuts.applyLegacyPresetTextBubble.label':
    'Legacy text_bubbleプリセットを適用',
  'shortcuts.applyLegacyPresetTextBubble.description':
    'Legacy text_bubbleビジュアルプリセットを選択した領域に適用します。',
  'shortcuts.applyLegacyPresetTextFree.label':
    'Legacy text_freeプリセットを適用',
  'shortcuts.applyLegacyPresetTextFree.description':
    'Legacy text_freeビジュアルプリセットを選択した領域に適用します。',
  'shortcuts.applyLegacyPresetTextSfx.label': 'Legacy text_sfxプリセットを適用',
  'shortcuts.applyLegacyPresetTextSfx.description':
    'Legacy text_sfxビジュアルプリセットを選択した領域に適用します。',
  'shortcuts.applyLegacyPresetTextNarration.label':
    'Legacy text_narrationプリセットを適用',
  'shortcuts.applyLegacyPresetTextNarration.description':
    'Legacy text_narrationビジュアルプリセットを選択した領域に適用します。',
  'shortcuts.applyLegacyPresetTextInsideBlackBubble.label':
    'Legacy text_inside_black_bubbleプリセットを適用',
  'shortcuts.applyLegacyPresetTextInsideBlackBubble.description':
    'Legacy text_inside_black_bubbleビジュアルプリセットを選択した領域に適用します。',
  'shortcuts.applyAutoShape.label': '自動形状を適用',
  'shortcuts.applyAutoShape.description':
    '選択した領域に対して楕円形と矩形を自動的に選択します。',
  'shortcuts.convertShapeSquare.label': '形状を矩形に変換',
  'shortcuts.convertShapeSquare.description':
    '選択した領域を矩形に変換します。',
  'shortcuts.convertShapeRounded.label': '形状を楕円形に変換',
  'shortcuts.convertShapeRounded.description':
    '選択した領域を楕円形に変換します。',
  'shortcuts.deleteRegion.label': '選択した領域を削除',
  'shortcuts.deleteRegion.description':
    '手動AIO、タイプセッター、ビジュアルトランスレーター、またはクリーナーで選択した領域を削除します。',
  'shortcuts.editInline.label': 'インライン領域編集を開く',
  'shortcuts.editInline.description':
    '手動レンダーで選択した領域のインライン編集を開きます。',
  'shortcuts.inlineEditorCancel.label': 'インライン編集をキャンセル',
  'shortcuts.inlineEditorCancel.description':
    'インライン編集テキストエリア内でのみ使用可能です。',
  'shortcuts.inlineEditorSave.label': 'インライン編集を保存',
  'shortcuts.inlineEditorSave.description':
    'インライン編集テキストエリア内でのみ使用可能です。',
  'shortcuts.category.palette': 'ツールパレット',
  'shortcuts.duplicateRegion.label': '選択した領域を複製',
  'shortcuts.duplicateRegion.description':
    'タイプセッターまたは手動AIOで選択した領域を18pxオフセットで複製します。',
  'shortcuts.toolConfigToggle.label': '設定パネルの切り替え',
  'shortcuts.toolConfigToggle.description':
    'パレット内のアクティブツール設定パネルを開閉します。',
  'shortcuts.toolAreaSelect.label': 'ツール：領域選択',
  'shortcuts.toolAreaSelect.description':
    '手動AIOで領域選択ツールを有効にします。',
  'shortcuts.toolClearRegions.label': 'すべての領域をクリア',
  'shortcuts.toolClearRegions.description':
    '手動AIOでアクティブ画像のすべての領域を削除します。',
  'shortcuts.toolSegmentBrush.label': 'ツール：セグメントブラシ',
  'shortcuts.toolSegmentBrush.description':
    '手動セグメンテーションマスク編集用のブラシを有効にします。',
  'shortcuts.toolSegmentEraser.label': 'ツール：セグメント消しゴム',
  'shortcuts.toolSegmentEraser.description':
    '手動セグメンテーションマスク編集用の消しゴムを有効にします。',
  'shortcuts.toolPaint.label': 'ツール：ペイント',
  'shortcuts.toolPaint.description':
    '画像上の手動ペイントツールを有効にします。',
  'shortcuts.toolPaintEraser.label': 'ツール：ペイント消しゴム',
  'shortcuts.toolPaintEraser.description':
    '手動ペイントレイヤーをクリアする消しゴムを有効にします。',
  'shortcuts.toolMagicWand.label': 'ツール：マジックワンド',
  'shortcuts.toolMagicWand.description':
    '色の許容値に基づく選択のマジックワンドを有効にします。',
  'shortcuts.toolHealingBrush.label': 'ツール：修復ブラシ',
  'shortcuts.toolHealingBrush.description':
    '画像修復用の修復ブラシを有効にします。',
  'shortcuts.toolClearPaint.label': 'ペイントレイヤーをクリア',
  'shortcuts.toolClearPaint.description':
    'アクティブ画像の手動ペイントレイヤー全体を削除します。',
  'shortcuts.toolResetEdits.label': '手動編集をリセット',
  'shortcuts.toolResetEdits.description':
    'クリーナーまたはAIOでアクティブ画像のすべての手動編集を元に戻します。',
  'dashboard.coachmark.stage.titleSuffix': 'メインステージ',
  'dashboard.coachmark.stage.bodyWithImages':
    'ここでアクティブ画像を確認し、<strong>{modeLabel}</strong> モードの視覚的な結果を検証し、即座にフィードバックを得ながら調整を行います。',
  'dashboard.coachmark.stage.bodyWithoutImages':
    '画像を読み込むと、このステージが <strong>{modeLabel}</strong> モードのビジュアルセンターになります。結果が最初に表示される場所です。',
  'dashboard.coachmark.stage.accent': 'ステージ',
  'dashboard.coachmark.tools.titleSuffix': 'ツールボックス',
  'dashboard.coachmark.tools.body':
    '右サイドバーを使用して、<strong>{modeLabel}</strong> モードのオプション、プリセット、アクションを設定します。フローに変更がある場合、通常はここから始まります。',
  'dashboard.coachmark.tools.accent': 'ツール',
  'dashboard.coachmark.download.titleSuffix': 'エクスポート',
  'dashboard.coachmark.download.body':
    '結果が良好であれば、エクスポートメニューから画像、パッケージ、またはPSDをダウンロードして、現在のモードを離れずに完了します。',
  'dashboard.coachmark.download.accent': '納品',
  'dashboard.coachmark.organize.uploadTitle': '整理：アップロードから始める',
  'dashboard.coachmark.organize.uploadBody':
    'ページ、チャプ��ー、またはパッケージ全体をここにドラッグします。整理モードはプロダクションに入る前のバッチ準備のためにあります。',
  'dashboard.coachmark.organize.uploadAccent': '入力',
  'dashboard.coachmark.organize.orderTitle': '整理：順序を確認',
  'dashboard.coachmark.organize.orderBody':
    '左サイドバーでアクティブ画像を選択し、ページを並べ替え、不良アイテムを削除し、チャプターの進行準備ができているか確認します。',
  'dashboard.coachmark.organize.orderAccent': 'バッチ',
  'dashboard.coachmark.aioAuto.pipelineTitle': '自動AIO：パイプラインを実行',
  'dashboard.coachmark.aioAuto.pipelineBody':
    '自動モードでは、一度設定するとバッチを順番に処理します。スループット、事後レビュー、より定型的なワークフローに最適です。',
  'dashboard.coachmark.aioAuto.pipelineAccent': '自動',
  'dashboard.coachmark.aioAuto.stagesTitle': '自動AIO：必要なものだけ有効に',
  'dashboard.coachmark.aioAuto.stagesBody':
    'このバッチに意味のあるステージのみを有効にします。ステージが少ないほど、コスト、時間、障害ポイントが減ります。',
  'dashboard.coachmark.aioAuto.stagesAccent': 'パイプライン',
  'dashboard.coachmark.aioAuto.configTitle': '自動AIO：モデルと言語を設定',
  'dashboard.coachmark.aioAuto.configBody':
    '実行前に言語、プリセット、モデルを選択します。処理速度、品質、コストに最も影響する部分です。',
  'dashboard.coachmark.aioAuto.configAccent': 'セットアップ',
  'dashboard.coachmark.aioManual.title': '手動AIO：ステージごとに作業',
  'dashboard.coachmark.aioManual.body':
    '手動モードでは、各ステージをより細かく制御しながら実行、レビュー、修正します。仕上げや困難なケースの回復に最適なモードです。',
  'dashboard.coachmark.aioManual.accent': '手動',
  'dashboard.coachmark.aioManual.dockTitle':
    '手動AIO：ドックをワークベンチとして使用',
  'dashboard.coachmark.aioManual.dockBody':
    'フローティングドックは選択、セグメンテーション、ペイント、ワンド、修復をまとめています。プレビュー上のミニクイック介入パネルと考えてください。',
  'dashboard.coachmark.aioManual.dockAccent': 'ドック',
  'dashboard.coachmark.typesetter.titleManual': '手動タイプセッター',
  'dashboard.coachmark.typesetter.titleAuto': '自動タイプセッター',
  'dashboard.coachmark.typesetter.bodyManual':
    '手動はページごとの吹き出し、形状、フォント、視覚的リズムの微調整に最適です。',
  'dashboard.coachmark.typesetter.bodyAuto':
    '自動はドラフトや大きなバッチを高速化します。一貫性を確保するために素早い視覚的レビューでフォローアップしてください。',
  'dashboard.coachmark.typesetter.accentManual': '手動',
  'dashboard.coachmark.typesetter.accentAuto': '自動',
  'dashboard.coachmark.cleaner.dockTitle':
    'クリーナー：画像を離れずにローカル修正',
  'dashboard.coachmark.cleaner.dockBody':
    'ドックが表示されている時は、ペイント、消しゴム、修復を使用してページのコンテキストを失わずに詳細を仕上げます。',
  'dashboard.coachmark.cleaner.dockAccent': 'ドック',
  'dashboard.coachmark.content.titleSuffix': 'コンテンツナビゲーション',
  'dashboard.coachmark.content.body':
    'このモードはビ��ュアルステージを参照パネルに切り替えます。ワークフローの学習、サポート資料の確認、スムーズなプロダクション復帰に活用してください。',
  'dashboard.coachmark.content.accent': 'リファレンス',
  'dashboard.coachmark.progress': 'ガイド {{current}} / {{total}}',
  'dashboard.coachmark.next': '次へ',
  'dashboard.coachmark.prev': '前へ',
  'dashboard.coachmark.done': '了解',
  'aioModel.label.unavailable': '（利用不可）',
  'aioModel.label.notInstalled':
    '（未インストール — クリックしてインストール）',
  'aioModel.label.updateAvailable': '（アップデートあり）',
  'aioModel.label.installed': '（インストール済み）',
  'aioModel.status.selectAndInstall':
    '「{stage}」ステージ用のローカルモデルを選択してインストールしてください。',
  'aioModel.status.installBeforeUse':
    'このステージを使用する前にモデル「{name}」をインストールしてください。',
  'aioModel.status.selectValidOcr': 'OCR用の有効なモデルを選択してください。',
  'aioModel.status.inRoadmap':
    'モデル「{name}」はまだロードマップに含まれています。',
  'aioModel.status.requiresConfig':
    'モデル「{name}」は使用前に設定が必要です。',
  'aioModel.status.installedOk': 'インストール済み（OK）',
  'aioModel.status.installedUpdate': 'インストール済み（アップデートあり）',
  'aioExec.selectAndInstallStage':
    '「{stageLabel}」ステージを実行する前にローカルモデルを選択してインストールしてください。',
  'aioExec.installBeforeStage':
    '「{stageLabel}」ステージを実行する前にモデル「{name}」をインストールしてください。',
  'aioExec.selectValidOcrModel':
    'テキスト認識用の有効なモデルを選択してください。',
  'aioExec.ocrRequiresApiKey':
    'このOCRプロバイダーにはAPIキーが必要です。実行前にキーを設定してください。',
  'aioExec.installTranslationModel':
    'AIOを実行する前に互換性のある翻訳モデルをインストールしてください。',
  'aioExec.incompatibleLanguage':
    '選択したモデルは現在の言語に対応していません。',
  'aioExec.translationModelIncompatible':
    '"{modelName}" は選択された対象言語をサポートしていません。互換性のあるモデルを選択するか、対象言語を変更してください。',
  'aioExec.selectValidTranslation':
    '続行するには有効な翻訳モデルを選択してください。',
  'aioExec.selectCustomOcrProfile':
    'AIOを実行する前にカスタムAI OCRプロファイルを選択または保存してください。',
  'aioExec.selectCustomAiProfile':
    'AIOを実行する前にカスタムAIプロファイルを選択または保存してください。',
  'aioExec.translationRequiresApiKey':
    'この翻訳プロバイダーにはAPIキーが必要です。実行前にキーを設定してください。',
  'aioManual.selectImage': '手動モードで実行するには画像を選択してください。',
  'aioManual.imageNotFound': 'アクティブ画像が見つかりません。',
  'aioManual.progressNotInitialized':
    'アクティブ画像の手動進行が初期化されていません。',
  'aioManual.selectValidDetectModel':
    'テキスト検出用の有効なモデルを選択してください。',
  'aioManual.selectValidSegmentModel':
    'テキストセグメンテーション用の有効なモデルを選択してください。',
  'aioManual.selectValidCleanModel':
    '画像クリーニング用の有効なモデルを選択してください。',
  'aioManual.stageDone':
    '手動モード：「{fileName}」のステージ「{stageLabel}」が完了しました。',
  'aioManual.executionAborted': '手動AIO実行が中止されました。',
  'aioManual.stageFailed': 'ステージ「{stageLabel}」の実行に失敗しました。',
  'translator.localModelIncompatible':
    '選択したローカルモデルはトランスレーターの現在の言語に対応していません。',
  'translator.selectValidTranslationModel':
    'トランスレーター用の有効な翻訳モデルを選択してください。',
  'translator.selectCustomAiTranslationProfile':
    '実行前にカスタムAI翻訳プロファイルを選択または保存してください。',
  'translator.localOcrModelIncompatible':
    '選択したローカルOCRモデルはトランスレーターの現在の言語に対応していません。',
  'translator.installCompatibleOcrModel':
    'ビジュアルトランスレーターを実行する前に互換性のあるOCRモデルをインストールしてください。',
  'translator.selectValidOcrModel':
    'ビジュアルトランスレーター用の有効なOCRモデルを選択してください。',
  'modelManager.error.diskCheckFailed':
    '利用可能なディスク容量を確認できませんでした。',
  'updater.mandatoryUpdate':
    'このアップデートは必須です。続行するにはダウンロードしてインストールしてください。',
  'translatorVisual.noImages':
    'ビジュアルトランスレーターを使用するには少なくとも1枚の画像を読み込んでください。',
  'translatorVisual.running.aiSfx':
    'ビジュアルトランスレーター AI SFX：検出、分類、認識、翻訳、クリーニング中...',
  'translatorVisual.running.standard':
    'ビジュアルトランスレーター：検出、認識、翻訳中...',
  'translatorVisual.invalidSfxResponse':
    '「{fileName}」に対するトランスレーターのAI SFXレスポンスが無効です。',
  'translatorVisual.done.aiSfx':
    'ビジュアルトランスレーター AI SFX完了。{candidates} 候補、{approved} SFX承認、{ocr} OCR、{translations} 翻訳、{redraw} リドロー要求領域。',
  'translatorVisual.done.standard':
    'ビジュアルトランスレーター完了。{detected} 領域検出、{recognized} テキスト認識、{translations} 翻訳生成。',
  'translatorVisual.genericError':
    'ビジュアルトランスレーターの実行に失敗しました。',
  'freeProvider.catalogOnly':
    'プロバイダー「{name}」はv1ではカタログのみとして利用可能です。',
  'enhanceActions.connectError':
    'エンハンスがバックエンド（{url}）に接続できませんでした。ミニバックエンドがアクティブか確認してください。',
  'aioSingleProcessor.invalidCleanResponse':
    '「{fileName}」のクリーニング時の応答が無効です。',
  'cleanerActions.detectFailed':
    '「{fileName}」の領域検出に失敗しました：{message}',
  'cleanerActions.invalidSfxResponse':
    '「{fileName}」に対するAI SFXクリーナーのレスポンスが無効です。',
  'cleanerActions.invalidAutoCleanResponse':
    '「{fileName}」に対する自動AIクリーンのレスポンスが無効です。',
  'cleanerActions.sfxDone':
    'AI SFXクリーナー完了。{images} 画像、{candidates} 候補、{approved} SFX承認、{redraw} リドロー要求領域。',
  'cleanerActions.autoCleanDone':
    '自動AIクリーン完了。{images} 画像を処理、{detected} 領域を検出。',
  'cleanerActions.assistedDone':
    'アシストクリーナー完了。{images} 画像をクリーン、{detected} 領域検出、{recognized} テキスト認識、{segmented} 領域セグメント化。',
  'webhook.event.processStart.label': '処理開始',
  'webhook.event.processStart.desc': '実行が開始された時',
  'webhook.event.processComplete.label': '処理完了',
  'webhook.event.processComplete.desc': '実行が正常に完了した時',
  'webhook.event.processError.label': '処理エラー',
  'webhook.event.processError.desc': '障害が発生した時',
  'webhook.event.updateAvailable.label': 'アップデートあり',
  'webhook.event.updateAvailable.desc': '新しいバージョンが利用可能な時',
  'webhook.event.updateDownloaded.label': 'アップデートダウンロード済み',
  'webhook.event.updateDownloaded.desc':
    'アップデートのダウンロードが完了した時',
  'webhook.event.updateError.label': 'アップデートエラー',
  'webhook.event.updateError.desc': 'アップデーターが失敗した時',
  'webhook.validation.urlRequired': 'Discord Webhook URLを入力してください。',
  'webhook.validation.urlInvalid':
    '無効なURLです。Webhookの形式を確認してください。',
  'webhook.validation.urlHttpsRequired':
    'Webhook URLはHTTPSを使用する必要があります。',
  'webhook.validation.urlNotDiscord':
    '公式のDiscord URL（discord.com）を使用してください。',
  'webhook.validation.urlInvalidPath':
    'URLパスが有効なDiscord Webhookと一致しません。',
  'typography.effect.none.label': 'エフェクトなし',
  'typography.effect.none.description':
    'クリーンなテキスト、追加レイヤーなし。',
  'typography.effect.balloon_smear.label': 'バルーンスミア',
  'typography.effect.balloon_smear.description':
    'ドラマチックなセリフテキストに触発された、わずかな横揺れ付きの垂直グレーストリーク。',
  'typography.effect.smiles_outline.label': 'SMILESアウトライン',
  'typography.effect.smiles_outline.description':
    'ライトコア付きのソフトコーラルアウトライン、かわいいささやきスタイル。',
  'typography.effect.ahnnn_peach.label': 'Ahnnnピーチグロー',
  'typography.effect.ahnnn_peach.description':
    '暖かくソフトなグロー付きのピーチ塗り。',
  'typography.effect.silence_ink.label': 'サイレンスインク',
  'typography.effect.silence_ink.description':
    'クリーンな存在感とわずかな内部の深みを持つ紫がかったブルー。',
  'typography.effect.hwa_pastel.label': 'HWAパステル',
  'typography.effect.hwa_pastel.description':
    'ピンクのアウトラインと穏やかな質感のライトイエロー。',
  'typography.effect.hah_pop.label': 'HAHポップ',
  'typography.effect.hah_pop.description':
    'ポップな存在感とピンクのレリーフ付きのライトライラックコア。',
  'typography.effect.smooch_jelly.label': 'スムーチジェリー',
  'typography.effect.smooch_jelly.description':
    'ゼリーのような輝きと甘いシャドウ付きのソフトピンク。',
  'typography.effect.tremble_brush.label': 'トレンブルブラシ',
  'typography.effect.tremble_brush.description':
    '不規則なエッジを持つエネルギッシュなブルーバイオレットブラシ。',
  'typography.effect.eheheh_whisper.label': 'EHEHEHウィスパー',
  'typography.effect.eheheh_whisper.description':
    'ふわふわのアウトラインと恥ずかしげなグロー付きのライトピンク。',
  'typography.effect.hoho_ink.label': 'HOHOインク',
  'typography.effect.hoho_ink.description':
    '垂直のドリッピングとドライテクスチャ付きのダークブルー。',
  'typography.effect.blam_impact.label': 'BLAMインパクト',
  'typography.effect.blam_impact.description':
    'ずれた赤いシャドウ付きのイエロー爆発。',
  'typography.effect.badump_soft.label': 'BADUMPソフト',
  'typography.effect.badump_soft.description':
    'ロマンチックなオーラ付きのソフトピンクパステルグラデーション。',
  'typography.effect.thump_heavy.label': 'THUMPヘビー',
  'typography.effect.thump_heavy.description':
    '角度のついたワインカラーの硬いシャドウ付きのブラックインパクト。',
  'typography.effect.neon_woah.label': 'WOAHネオン',
  'typography.effect.neon_woah.description':
    '驚き/輝きの強烈なピンクグロー付きのホワイトテキスト。',
  'typography.effect.slash_speed.label': 'SLAPスピードスラッシュ',
  'typography.effect.slash_speed.description':
    '攻撃的な斜めストリーク/モーションブラー付きのダークタイポグラフィ。',
  'typography.effect.ah_teal.label': 'Ahティール',
  'typography.effect.ah_teal.description':
    'ダークアウトラインとソフトスピーチ感のあるアクア/ティール。',
  'typography.effect.drip_blue.label': 'DRIPブルー',
  'typography.effect.drip_blue.description':
    'リキッド感とドリップエフェクト付きのライトブルー。',
  'typography.effect.question_pop.label': 'クエスチョンポップ',
  'typography.effect.question_pop.description':
    'ずれたコーラルシャドウ付きのウォームな句読点。',
  'typography.effect.laugh_curve.label': 'ラフカーブ',
  'typography.effect.laugh_curve.description':
    'アーチ型で軽い笑い声のためのブライトシアン。',
  'typography.effect.shake_blur.label': 'シェイクブラー',
  'typography.effect.shake_blur.description':
    '震え表現のための振動/モーションブラー付きダークパープル。',
  'typography.effect.beep_outline.label': 'ビープアウトライン',
  'typography.effect.beep_outline.description':
    'クリーンで読みやすいSFX用の太いブラックアウトライン付きホワイトテキスト。',
  'typography.effect.boom_comic.label': 'BOOMコミック',
  'typography.effect.boom_comic.description':
    'クラシックなコミックスタイルのイエロー/レッド爆発。',
  'typography.effect.bang_chunk.label': 'BANGチャンク',
  'typography.effect.bang_chunk.description':
    '太いずれたゴールドシャドウ付きのパープル/ブルーブロック。',
  'typography.effect.break_glitch.label': 'BREAKグリッチ',
  'typography.effect.break_glitch.description':
    'グリッチ/壊れたスキャンテクスチャ付きのダークマゼンタ。',
  'typography.effect.flinch_outline.label': 'FLINCHアウトライン',
  'typography.effect.flinch_outline.description':
    '即座の反応のための攻撃的なホワイトアウトライン付きブラック。',
  'typography.effect.growl_moss.label': 'グロウルモス',
  'typography.effect.growl_moss.description':
    'しわがれ声/動物の音のためのドライオリーブグリーン。',
  'typography.effect.yawn_soft.label': 'ヤーンソフト',
  'typography.effect.yawn_soft.description':
    '怠惰/伸びたセリフのためのパープルアウトライン付きライムグリーン。',
  'typography.effect.scratch_noise.label': 'スクラッチノイズ',
  'typography.effect.scratch_noise.description':
    'ザラザラ/ノイジーな見た目のラフなブラック。',
  'typography.effect.crack_ink.label': 'クラックインク',
  'typography.effect.crack_ink.description':
    '突然のインパクトのためのドライでシャープなブラックブラシ。',
  'typography.effect.slap_scratch.label': 'スラップスクラッチ',
  'typography.effect.slap_scratch.description':
    '擦過/素早い一撃エフェクトのための細く引きずられたスクリブル。',
  'typography.effect.dash_edge.label': 'ダッシュエッジ',
  'typography.effect.dash_edge.description':
    '突然のカット/登場のための鋭いポイント付きダークグリーン。',
  'typography.effect.scream_scratch.label': 'スクリームスクラッチ',
  'typography.effect.scream_scratch.description':
    'ラフな赤のオフセット付きブラックスクリーム。',
  'model.opus-mt-ja-en.description':
    '日本語コンテンツに最適化されたOPUS-MTパイプライン。英語翻訳とポルトガル語への二次フローを搭載。',
  'model.nllb-200-600m-int8.description':
    'KO→EN/PTの良好な品質を維持しつつメモリ使用量を削減するint8量子化された多言語NLLBモデル。',
  'model.opus-mt-zh-en.description':
    '中国語用OPUS-MTモデル。英語翻訳を主とし、ポルトガル語への二次フローを搭載。',
  'model.nllb-200-1.3b.description':
    '幅広い言語カバレッジを持つ高品質な汎用多言語翻訳モデル。',
  'model.nllb-200-1.3b-int8-ct2.description':
    'NLLB 1.3BのCTranslate2量子化版。優れたコストパフォーマンスでVRAMを削減。',
  'model.nllb-200-3.3b.description':
    '複数言語で最高品質を実現する大容量NLLBモデル。',
  'model.sugoi_v4_ja_en_ct2.description':
    'CTranslate2とSentencePieceによるローカルJA→EN翻訳。BallonsTranslatorオフラインフローに対応。',
  'model.m2m100_1_2b_ct2.description':
    'CTranslate2による幅広い言語カバレッジのローカル多言語翻訳。BallonsTranslatorオフラインフローに対応。',
  'model.font_rtdetr_v2.description':
    'AIOパイプラインでのテキスト領域検出用ローカルモデル。',
  'model.comic_text_detector.description':
    'マンガページのテキストボックス用BallonsTranslator CTDモジュールベースのローカルディテクター。',
  'model.manga_ocr.description': 'AIOでの日本語用ローカルOCRモデル。',
  'model.meiki_ocr.description':
    'レンダリングテキストに特化したローカル日本語OCR。水平・垂直ONNXモデルを搭載。',
  'model.paddleocr_vl_manga.description':
    '日本語マンガに特化したローカルVLM OCR。',
  'model.got_ocr2.description':
    'ネイティブtransformersランタイムによるGOT-OCR 2.0経由のローカルマルチモーダルOCR。',
  'model.qwen2_5_vl_3b.description':
    'Qwen2.5-VL-3B-Instruct経由のローカルマルチモーダルOCR。',
  'model.mangalmm.description':
    'Qwen2.5-VLベースのマンガ特化マルチモーダルOCR/理解モデル。',
  'model.rolmocr.description':
    'ドキュメント読み取り最適化を備えたQwen2.5-VLベースのロバストローカルOCR。',
  'model.glm_ocr_onnx.description':
    'ネイティブtransformersランタイムによる複雑なレイアウト対応のローカルGLM OCR。',
  'model.paddleocr.description':
    'AIOパイプラインでのロシア語/スラブ語用ローカルOCRモデル。',
  'model.paddleocr_latin_v5.description':
    'AIOパイプラインでのラテン語族（オランダ語含む）用ローカルOCRモデル。',
  'model.paddleocr_ch_v5.description':
    'AIOパイプラインでの中国語用ローカルOCRモデル。',
  'model.paddleocr_en_v5.description':
    'AIOパイプラインでの英語特化ローカルOCRモデル。',
  'model.easyocr.description':
    'アプリのモデルディレクトリにオンデマンドインストール可能な多言語ローカルOCR。',
  'model.pororo.description': 'AIOパイプラインでの韓国語用ローカルOCRモデル。',
  'model.baka_content_cc.description':
    'AIOでのテキスト領域セグメンテーション/リファイン用ローカルモデル。',
  'model.aot.description':
    'AIOでの吹き出しクリーニング用ローカルインペインティングモデル。',
  'model.lama_manga.description':
    'AIOでの複雑な領域用ローカルコンテキストインペインティングモデル。',
  'model.opencv_lama.description':
    'OpenCV Zoo経由の軽量ローカルインペインティングモデル。CPUおよび高速実行向け。',
  'model.lama_fp32.description':
    '512x512のbig-lama推奨ONNXポート。品質とシンプルさのバランスにおけるCPU/GPU向け。',
  'model.vntl_llama3_8b_v2.description':
    '日本語→英語のVN向けにLLaMA3をファインチューニング。マルチライン対応でデータセットを再構築。temp 0 を使用。（約5.7～8.5GB GGUF）',
  'model.lfm2_350m_enjp_mt.description':
    '0.4Bパラメータの超軽量JA↔EN双方向翻訳器。Q4_0でわずか219MB — CPUやエッジデバイスに最適。',
  'model.sakura_galtransl_7b_v3_7.description':
    'ビジュアルノベル向けに最適化されたJA→ZH-CN翻訳器。改行、制御文字、ルビを保持。CC-BY-NC-SA 4.0（約4.25GB IQ4_XS）。',
  'model.sakura_1_5b_qwen2_5_v1_0.description':
    'IMatrix量子化を採用したSakura 7Bの軽量代替。約1GB Q5KS。ミドルレンジGPUまたはCPU（約4GB RAM）に最適。',
  'model.hunyuan_7b_mt_v1_0.description':
    'Tencentの多言語翻訳器 — WMT25で1位。33言語の双方向対応。プロンプト：「Translate into <target_language>.」（約4.2GB Q4_K_M）。',
  'model.pp_doclayout_v3.description':
    'PP-DocLayout V3ベースのローカルレイアウトおよびテキスト検出モデル。ページレイアウト分析の高精度。',
  'model.paddleocr_vl_1_5.description':
    '高品質多言語VLM OCRモデル（PaddleOCR-VL 1.5）。テキストブロックあたり最大128トークン。',
  'model.waifu2x_swin_unet_art_scan_2x.description':
    '線画と吹き出しに特化したマンガ/マンファページ向け最高のローカルオプション。',
  'model.waifu2x_swin_unet_art_scan_4x.description':
    'スキャンされたマンガ/マンファページ用の4x版。',
  'model.waifu2x_swin_unet_art_2x.description':
    'クリーンなデジタル/アニメアート用2xモデル。',
  'model.4xnomos2_hq_mosr.description':
    '最小限の劣化素材用の高品質4x ONNXアップスケーラー。',
  'model.4xspankendata.description':
    '汎用4xフォールバックとしての軽量ONNXモデル。',
  'model.2x_hfa2kcompact.description':
    '手動ONNXインポート/外部変換でのみ互換の候補。',
  'model.2x_digitalfilm_superultracompact.description':
    '手動ONNXインポート用候補。',
  'model.2x_anifilm_compact.description': '手動ONNXインポート用候補。',
  'model.2xnomosuni_span_multijpg_ldl.description':
    '手動ONNXインポート用候補。',
  'model.realesrgan_x4plus.description': '手動ONNXインポート用候補。',
  'model.4xhfa2kludvaeswinir_light.description': '手動ONNXインポート用候補。',
  'splitter.status.recipeApplied':
    'スプリッターのレシピをアクティブ画像に適用しました。',
  'splitter.status.recipeRestored':
    'スプリッターのレシピをデフォルトに復元しました。',
  'splitter.status.exportCancelled':
    'スプリッターのエクスポートがユーザーによりキャンセルされました。',
  'splitter.error.noSegmentsActive':
    'アクティブ画像に有効なセグメントが生成されませんでした。',
  'splitter.error.noSegmentsBatch':
    'スプリッターのバッチで有効なセグメントが生成されませんでした。',
  'aioExec.sessionUnavailable': 'クラウドモデルを利用するためのセッションが利用できません。再度サインインしてください。',
  'aioManual.progressionNotInitialized':
    'アクティブ画像の手動進行が初期化されていません。',
  'cleanerActions.selectValidOcrModel':
    'クリーナー用の有効なOCRモデルを選択してください。',
  'cleanerActions.invalidCleanResponseNamed':
    '「{name}」のクリーン応答が無効です。',
  'customLlm.selectTranslationProfile':
    '使用する保存済みカスタム翻訳プロファイルを選択してください。',
  'customLlm.selectOcrProfile':
    '使用する保存済みカスタムOCRプロファイルを選択してください。',
  'customLlm.profileNotFound':
    'カスタムプロファイルが見つかりません。リロードして再試行してください。',
  'customLlm.translationProfileActive':
    '使用中のカスタムプロファイル（翻訳）：{label}。',
  'customLlm.ocrProfileActive':
    '使用中のカスタムプロファイル（OCR）：{label}。',
  'accountSync.confirmEmailSent':
    '確認メールを送信しました。受信トレイをご確認ください。',
  'accountSync.confirmEmailFailed': '確認メールの送信に失敗しました。',
  'downloadActions.noTranslatorResults':
    'ダウンロード可能なトランスレーターの結果がありません。',
  'enhanceActions.desktopOnly':
    'ローカルエンハンサーはデスクトップアプリでのみ利用可能です。',
  'enhanceActions.selectModel':
    '互換性のあるエンハンスモデルを選択してください。',
  'enhanceActions.done':
    'エンハンス完了。ダウンロードを使用して保存してください。',
  'freeProvider.stageNotSupported':
    'プロバイダーはこのステージをサポートしていません。',
  'freeProvider.activeForTranslation': '翻訳でプロバイダー {name} を使用中。',
  'freeProvider.activeForOcr': 'OCRでプロバイダー {name} を使用中。',
  'freeProvider.activeForClean': 'Provider {name} がクリーニングに使用中です。',
  'freeProvider.stageTranslation': '翻訳',
  'freeProvider.stageOcr': 'OCR',
  'freeProvider.stageClean': 'クリーニング',
  'translatorRetranslate.targetNotFound':
    '再翻訳のターゲット画像が見つかりません。',
  'translatorRetranslate.noTextAvailable':
    '再翻訳に利用可能な認識テキストがありません。',
  'translatorText.done':
    'テキストトランスレーター完了。コピーまたはTXTダウンロードを使用してください。',
  'typographer.queueApplied': 'キューのテキストを現在の選択に適用しました。',
  'typographer.queueAppliedMulti':
    'キューのテキストを {{count}} つの吹き出しに適用しました。',
  'typographer.queueCleared': 'タイプセッターのキューをクリアしました。',
  'typographer.queueImported':
    'テキストをタイプセッターのキューにインポートしました。',
  'aioManual.invalidCleanResponse': '画像クリーニング時の応答が無効です。',
  'aioStage.lang.ko': '韓国語',
  'aioStage.lang.ja': '日本語',
  'aioStage.lang.fr': 'フランス語',
  'aioStage.lang.zh': '中国語',
  'aioStage.lang.zh-CN': '簡体字中国語',
  'aioStage.lang.zh-TW': '繁体字中国語',
  'aioStage.lang.en': '英語',
  'aioStage.lang.ru': 'ロシア語',
  'aioStage.lang.de': 'ドイツ語',
  'aioStage.lang.nl': 'オランダ語',
  'aioStage.lang.es': 'スペイン語',
  'aioStage.lang.it': 'イタリア語',
  'aioStage.lang.tr': 'トルコ語',
  'aioStage.lang.pl': 'ポーランド語',
  'aioStage.lang.pt': 'ポルトガル語',
  'aioStage.lang.pt-BR': 'ポルトガル語（BR）',
  'aioStage.lang.th': 'タイ語',
  'aioStage.lang.vi': 'ベトナム語',
  'aioStage.lang.hu': 'ハンガリー語',
  'aioStage.lang.id': 'インドネシア語',
  'aioStage.lang.fi': 'フィンランド語',
  'aioStage.lang.ar': 'アラビア語',
  'splitter.warning.noIntermediateCuts': '中間カットが見つかりませんでした。',
  'splitter.warning.segmentTooSmall':
    'セグメントが設定された最小高さより小さいです。',
  'splitter.warning.segmentTooLarge':
    'セグメントが設定された最大高さより大きいです。',
  'splitter.warning.cutsNearContent':
    '一部のカットがコンテンツのある領域に近いです。',
  'splitter.warning.nearEdge': 'エッジに近すぎます。',
  'stitch.warning.dimensionTooHigh':
    'サイズが大きすぎます。障害を避けるためにより多くのバッチでエクスポートしてください。',
  'stitch.warning.outputTooHeavy':
    '出力がレビューとダウンロードには重すぎます。',
  'stitch.warning.canvasLimit':
    '一部の環境で安全なキャンバス制限を超える可能性があります。',
  'stitch.warning.largeBatch':
    '大きなバッチです。スキャンレーションにとって区切りがまだ適切か確認してください。',
  'resources.data.fontsTitle': 'タイプセッティングフォント',
  'resources.data.fontsDesc':
    'マンガ、マンファ、マンホアのスキャンレーション向け人気フォントの厳選コレクション。',
  'resources.data.onomatopoeiaDesc':
    '翻訳と使用例付きの日本語擬音語ライブラリ。',
  'resources.data.glossaryTitle': 'スキャンレーション用語集',
  'resources.data.glossaryDesc':
    'スキャンレーション界の技術用語とコミュニティ俗語。',
  'resources.data.catalogLabel': 'カタログ',
  'aioLocalBatch.invalidBatchResponse':
    '無効なバッチ応答：ZIPにbatch_report.jsonが見つかりません。',
  'modelDownload.desktopOnly':
    'モデル管理はデスクトップアプリでのみ利用可能です。',
  'settings.updates.channelBeta': 'ベータ',
  'settings.updates.channelStable': '安定版',
  'settings.presets.aio.defaultName': 'プリセット',
  'settings.integrations.blogger.term.googleCloudConsole':
    'Google Cloud Console',
  'settings.integrations.blogger.term.bloggerApiV3': 'Blogger API v3',
  'settings.integrations.blogger.term.googleDriveApi': 'Google Drive API',
  'settings.integrations.blogger.term.oauthClientId': 'OAuthクライアントID',
  'settings.integrations.blogger.term.clientId': 'クライアントID',
  'settings.integrations.blogger.term.clientSecret': 'クライアントシークレット',
  'settings.integrations.blogger.term.oauthPlayground': 'OAuthプレイグラウンド',
  'settings.integrations.blogger.term.exchangeCodeForTokens':
    'コードをトークンに交換',
  'settings.integrations.blogger.term.refreshToken': 'リフレッシュトークン',
  'settings.integrations.blogger.term.cloudName': 'クラウド名',
  'settings.integrations.blogger.term.blogId': 'ブログID',
  'settings.integrations.imgur.term.clientId': 'クライアントID',
  'settings.integrations.imgur.term.rateLimit': '50アップロード/時間',
  'settings.shortcuts.topbarPath': 'トップバー > ショートカット',
  'login.warning.versionPrefix': 'v{version}',
  'password.policy.minLength': 'パスワードは12文字以上にしてください。',
  'password.policy.uppercase':
    'パスワードに大文字を少なくとも1つ含めてください。',
  'password.policy.lowercase':
    'パスワードに小文字を少なくとも1つ含めてください。',
  'password.policy.number': 'パスワードに数字を少なくとも1つ含めてください。',
  'password.policy.special':
    'パスワードに特殊文字を少なくとも1つ含めてください。',
  'auth.sfx.primary': '쾅',
  'auth.sfx.secondary': '휙',
  'auth.stats.activeScanlatorsValue': '2.4k+',
  'auth.stats.toolsValue': '50+',
  'auth.stats.pagesProcessedValue': '1M+',
  'auth.community.joinIndicator': '+',
  'resources.sfx.onomatopoeiaLabel': '擬音語',
  'resources.page.shortcutCtrl': 'Ctrl',
  'resources.page.shortcutFind': 'F',
  'settings.integrations.blogger.value.requestsPerDay': '10,000',
  'settings.integrations.blogger.value.requestsPerUser': '100/100秒',
  'settings.integrations.imgur.authorizationHeaderExample':
    'Authorization: Client-ID …',
  'settings.shortcuts.quickKey': 'H',
  'guides.search.keyArrowUp': '↑',
  'guides.search.keyArrowDown': '↓',
  'guides.search.keyArrowPair': '↑↓',
  'guides.search.keyEnter': '⏎',
  'guides.search.keyEscape': 'Esc',
  'settings.typographerLibrary.presetsCount_one': '{count} プリセット',
  'settings.typographerLibrary.presetsCount_other': '{count} プリセット',
  'renderPreview.iconUppercase': 'AA',
  'renderPreview.iconHorizontal': 'H',
  'renderPreview.iconVertical': 'V',
  'renderPreview.iconCircular': '◯',
  'guides.home.searchShortcut': '⌘K',
  'brand.name': 'KŌMA',
  'brand.studioSuffix': 'Studio',
  'versionBadge.stable': '安定版',
  'versionBadge.beta': 'ベータ',
  'versionBadge.tooltip': 'バージョン {version}',
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
  'update.units.perSecond': '/秒',
  'update.versionPrefix': 'v{version}',
  'update.toast.newVersionFallback': '新規',
  'dashboard.status.cloudSuffix': '（クラウド）',
  'dashboard.status.cloudApiSuffix': '（クラウド/API/AI）',
  'dashboard.status.pendingCustomTranslationName': 'カスタムAI（同期中...）',
  'dashboard.status.pendingCustomOcrName': 'カスタムOCR（同期中...）',
  'modelManager.tooltip.gpu': 'GPU',
  'modelManager.tooltip.vram': 'VRAM',
  'modelManager.tooltip.ram': 'RAM',
  'dashboard.tour.preview.welcome.upload': 'アップロード',
  'dashboard.tour.preview.welcome.export': 'エクスポート',
  'dashboard.tour.preview.upload.formats':
    'JPG · PNG · WEBP · ZIP · PDF · CBZ · CB7 · PSD',
  'dashboard.tour.preview.stageEmpty': '画像を読み込んで開始',
  'dashboard.tour.welcome.title': 'KŌMA Studioダッシュボードへようこそ',
  'dashboard.tour.welcome.body':
    'このツアーでは、アプリのメインフローを案内します：ページの整理、モードの選択、AIOパイプラインの設定、結果のエクスポートまで、各機能の場所を推測せずに進められます。',
  'dashboard.tour.sidebar.title':
    'サイドバー：クォータ、ファイル、バッチコンテキスト',
  'dashboard.tour.sidebar.body':
    'ここでプランと月間使用量を確認し、アクティブ画像を選択し、ページを並べ替え、アイテムを削除し、処理前にバッチを整理します。',
  'dashboard.tour.upload.title': 'ファイルの初期入力',
  'dashboard.tour.upload.body':
    'ドロップゾーンはバラの画像とフルパッケージの両方を受け付けます。チャプター、raw、アセットをドラッグしてダッシュボードの他の部分に供給する開始点です。',
  'dashboard.tour.modes.title': 'メインダッシュボードナビゲーション',
  'dashboard.tour.modes.body':
    '整理を使用してバッチを準備し、AIOでフルパイプラインを実行します。他のトップバーグループはワークスペースを離れずに専用モードを開きます。',
  'dashboard.tour.production.title': 'プロダクション：専用ツール',
  'dashboard.tour.production.body':
    'クリーナー、タイプセッター、トランスレーター、Raw、QCが手動および高度なワークフローをカバーします。このグループは特定のチャプターステージで作業するためのプロフェッショナルモードと考えてください。',
  'dashboard.tour.utils.title': 'ユーティリティとサポート',
  'dashboard.tour.utils.body':
    'スティッチ、スプリット、ウォーターマーク、エンハンスが素早い準備とエクスポートタスクを処理します。ガイドとリソースが参照用のサポートエリアを完成させます。',
  'dashboard.tour.submode.title': '自動AIO vs. 手動',
  'dashboard.tour.submode.body':
    '自動はバッチでフルパイプラインを実行します。手動は画像ごとに各ステージを解放し、詳細なレビュー、戻る/進む、制御されたビジュアル編集が可能です。',
  'dashboard.tour.pipeline.title': 'AIOパイプライン',
  'dashboard.tour.pipeline.body':
    'このカードは検出 > OCR > 翻訳 > セグメント > クリーン > レンダーのシーケンスを制御します。ステージの有効/無効を切り替え、手動モードでは現在のステージのみを実行できます。',
  'dashboard.tour.stageConfig.title': 'ステージ設定',
  'dashboard.tour.stageConfig.body':
    'ここで言語、AIOプリセット、ローカル/クラウドカタログ、ステージごとのモデル選択を見つけます。コスト、品質、速度を調整するための意思決定センターです。',
  'dashboard.tour.stage.withImagesTitle':
    'ワークスペースとビジュアルプレビュー',
  'dashboard.tour.stage.withImagesBody':
    '画像がある時、このステージがメインプレビューになります：ページをナビゲートし、ステージごとの結果を確認し、アクティブ画像で直接作業します。',
  'dashboard.tour.stage.emptyTitle': 'ダッシュボードセンターステージ',
  'dashboard.tour.stage.emptyBody':
    '画像がない場合、ステージはシンプルな空の状態を表示します。アップロード後、モードごとのプレビュー、オーバーレイ、領域、結果が表示されます。',
  'dashboard.tour.manualDock.title': 'インタラクティブプレビューと手動ドック',
  'dashboard.tour.manualDock.body':
    '手動AIOでアクティブ画像がある時、フローティングドックが領域選択、ブラシ、消しゴム、ワンド、修復、コンテキスト調整をプレビューを離れずに解放します。',
  'dashboard.tour.download.title': 'エクスポートとダウンロード',
  'dashboard.tour.download.body':
    'アプリに準備完了の出力がある時、このメニューが画像フォーマット、パッケージ、レイヤー付きPSD、メタデータオプションを集め、納品ワークフローを完了します。',
  'dashboard.tour.replay.title': '後でツアーを再生したい場合',
  'dashboard.tour.replay.body':
    'ユーザーメニューを開き、<strong>ツアーを再生</strong> を使用してください。自動オンボーディングは現在のバージョンの初回訪問時のみ実行されますが、手動の再生はいつでも利用可能です。',
  'dashboard.tour.progressText': 'ステップ {{current}} / {{total}}',
  'dashboard.tour.next': '次へ',
  'dashboard.tour.prev': '前へ',
  'dashboard.tour.done': 'ツアーを終了',
  'dashboard.tour.dialogLabel': 'ダッシュボードツアー',
  'dashboard.tour.close': 'ツアーを閉じる',
  'dashboard.tour.nextAria': '次のステップに進む',
  'dashboard.tour.prevAria': '前のステップに戻る',
  'modelManager.tooltip.rich.highlights': '特徴',
  'modelManager.tooltip.rich.unique': '独自の強み',
  'modelManager.tooltip.rich.bestFor': 'おすすめ用途',
  'modelManager.tooltip.rich.performance': 'パフォーマンス',
  'modelManager.tooltip.rich.notes': '備考',
  'modelManager.tooltip.docsUrl': 'ドキュメントを見る',
  'modelManager.tooltip.notes': '備考',
  'modelManager.tooltip.highlights': '特徴',
  'modelManager.tooltip.bestFor': 'おすすめ用途',
  'modelManager.tooltip.unique': '独自の強み',
  'modelManager.tooltip.performance': 'パフォーマンス',

  'model.tooltip.opus-mt-ja-en.highlights':
    '日本語から英語に翻訳\n軽量・高速、GPU不要で動作\n入門に最適',
  'model.tooltip.opus-mt-ja-en.unique':
    '一般的な日本語テキストには対応していますが、漫画専用に設計されたものではありません',
  'model.tooltip.opus-mt-ja-en.bestFor':
    '高性能GPUがない環境での日本語から英語への高速翻訳',
  'model.tooltip.opus-mt-ja-en.performance':
    '非常に高速、GPUなしでもどのPCでも動作',
  'model.tooltip.opus-mt-ja-en.notes':
    '汎用的には良い選択ですが、漫画やアニメにはSugoiの方がより良い結果を出します',

  'model.tooltip.nllb-200-600m-int8.highlights':
    '約200言語間の翻訳に対応\n軽量・最適化版\nどのPCでも快適に動作',
  'model.tooltip.nllb-200-600m-int8.unique':
    '1つのモデルで数���言語間の翻訳が可能 — 多言語対応が必要な場合に最適',
  'model.tooltip.nllb-200-600m-int8.bestFor':
    'マイナー言語間の翻訳や、あらゆる言語に対応する汎用モデルが必要な場合',
  'model.tooltip.nllb-200-600m-int8.performance':
    '高速・軽量、GPU��しのPCでも快適に動作',
  'model.tooltip.nllb-200-600m-int8.notes':
    '漫画専用ではあ��ませんが、多言語の汎用翻訳器として機能します',

  'model.tooltip.opus-mt-zh-en.highlights':
    '中国語から英語に翻訳\n軽量・高速\nGPU不要で動作',
  'model.tooltip.opus-mt-zh-en.unique':
    '中国語→英語に��化、漫画（マンファ）や一般的な中国語コンテンツに最適',
  'model.tooltip.opus-mt-zh-en.bestFor':
    '漫画（マンファ��や中国語コンテンツを英語に素早く翻訳',
  'model.tooltip.opus-mt-zh-en.performance':
    '非常に高速、GPU��しでもどのPCでも動作',
  'model.tooltip.opus-mt-zh-en.notes':
    '中国語→英語翻訳で広く使われている信頼性の高いモデル',

  'model.tooltip.nllb-200-1.3b.highlights':
    '約200言語間の翻訳に対応\n軽量版より高品質\nマイナー言語に最適',
  'model.tooltip.nllb-200-1.3b.unique':
    '600Mより高品質で、3.3Bほど重くない中間版',
  'model.tooltip.nllb-200-1.3b.bestFor':
    '軽量版より高い��質が必要な場合、特にマイナー言語に最適',
  'model.tooltip.nllb-200-1.3b.performance':
    '4GB以上のVRAMを持つGPUが必要；適度な速度',
  'model.tooltip.nllb-200-1.3b.notes':
    '品質とサイズの��ランスが良好。漫画専用ではありません。',

  'model.tooltip.nllb-200-1.3b-int8-ct2.highlights':
    '約200言語間の翻訳に対応\nメモリ使用量を削減した最適化版\n低リソースで高品質',
  'model.tooltip.nllb-200-1.3b-int8-ct2.unique':
    '1.3B版と同等の品質で、メモリ使用量が少ない — コストパフォーマンス最高',
  'model.tooltip.nllb-200-1.3b-int8-ct2.bestFor':
    '高性能なPCなしでも高品質な多言語翻訳',
  'model.tooltip.nllb-200-1.3b-int8-ct2.performance':
    '必要に応じてCPU��も動作；通常の1.3B版より軽量',
  'model.tooltip.nllb-200-1.3b-int8-ct2.notes':
    'NLLB 1.3Bの最適化版 — メモリを節約したい場合はこちらを使用してください',

  'model.tooltip.nllb-200-3.3b.highlights':
    '多言語翻訳モデルの中で最高品質\n約200言語対応\n速度より品質を重視する場合に最適',
  'model.tooltip.nllb-200-3.3b.unique':
    '多言語ファミリ��の中で最も強力で正確なバージョン — マイナー言語で最高の翻訳品質',
  'model.tooltip.nllb-200-3.3b.bestFor': '翻訳品質が速度より重要な場合',
  'model.tooltip.nllb-200-3.3b.performance':
    '8GB以上のVRAMを持つ高性能GPUが必要；他のモデルより低速',
  'model.tooltip.nllb-200-3.3b.notes':
    'より重いですが品質は向上。漫画専用ではありません。',

  'model.tooltip.sugoi_v4_ja_en_ct2.highlights':
    '日本語から英語��翻訳\n漫画・アニメ専用に設計\nどのPCでも動作',
  'model.tooltip.sugoi_v4_ja_en_ct2.unique':
    '漫画やアニメ特有のスラング、くだけた会話、表現を他の翻訳モデルより的確に理解',
  'model.tooltip.sugoi_v4_ja_en_ct2.bestFor':
    '漫画やアニメの日英翻訳 — コミュニティで最も推奨されている選択肢',
  'model.tooltip.sugoi_v4_ja_en_ct2.performance':
    '非常に高速、専��GPUなしでも快適に動作',
  'model.tooltip.sugoi_v4_ja_en_ct2.notes':
    '日本語→英語翻訳のデフォルトモデルとしてお使いください',

  'model.tooltip.m2m100_1_2b_ct2.highlights':
    '100言語間の翻訳に対応\n韓国語、タイ語、ベトナム語などをカバー\n高速動作のための最適化版',
  'model.tooltip.m2m100_1_2b_ct2.unique':
    '韓国語、タイ語、ベトナム語などのアジア言語を英語に的確に翻訳できる数少ないモデル',
  'model.tooltip.m2m100_1_2b_ct2.bestFor':
    '韓国のマンファ��中国のマンファ、その他のアジア言語コンテンツを英語に翻訳',
  'model.tooltip.m2m100_1_2b_ct2.performance':
    '4-6GBのVRAMを持つGPUが必要；最適化版で良好な速度',
  'model.tooltip.m2m100_1_2b_ct2.notes':
    '他の翻訳モデルが十分にカバーしていないアジア言語に最適',

  'model.tooltip.vntl_llama3_8b_v2.highlights':
    '日本語から英語に翻訳\nビジュアルノベルと漫画向けに設計\nキャラクター名の一貫性を維持',
  'model.tooltip.vntl_llama3_8b_v2.unique':
    'ストーリーの文脈を理解し、テキスト全体でキャラクター名と用語の一貫性を維持',
  'model.tooltip.vntl_llama3_8b_v2.bestFor':
    '名前の一貫性が重要な長い会話を含むビジュアルノベルや漫画の翻訳',
  'model.tooltip.vntl_llama3_8b_v2.performance':
    '6-10GBのVRAMを持つ���性能GPUが必要；シンプルな翻訳モデルより低速',
  'model.tooltip.vntl_llama3_8b_v2.notes':
    '名前と用語の一��性が重要な長期プロジェクトに最適',

  'model.tooltip.lfm2_350m_enjp_mt.highlights':
    '日本語 ↔ 英語の双方向翻訳\n超軽量・超高速\nどのPCでも動作',
  'model.tooltip.lfm2_350m_enjp_mt.unique':
    '最も小さい翻訳モデルの1つ — 低スペックPCでも���作し、それなりの結果を提供',
  'model.tooltip.lfm2_350m_enjp_mt.bestFor':
    '高性能GPUなしで日英の素早い翻訳が必要な場合',
  'model.tooltip.lfm2_350m_enjp_mt.performance':
    '非常に高速、GPU��しでもどのPCでも動作',
  'model.tooltip.lfm2_350m_enjp_mt.notes':
    '基本的な品質 — 素早い下書きには適していますが、最終成果物には不向き',

  'model.tooltip.sakura_galtransl_7b_v3_7.highlights':
    '日本語から中国��に翻訳\nギャルゲーと漫画に最適\nフォーマットと特殊注釈を保持',
  'model.tooltip.sakura_galtransl_7b_v3_7.unique':
    '特殊フォーマッ��、ルビ、改行を保持 — 複雑なテキストを含むギャルゲーや漫画に不可欠',
  'model.tooltip.sakura_galtransl_7b_v3_7.bestFor':
    '品質が速度より重要な場合の日中翻訳の最良の選択肢',
  'model.tooltip.sakura_galtransl_7b_v3_7.performance':
    '6GB以上のVRAMを持つGPUが必要；中程度の速度',
  'model.tooltip.sakura_galtransl_7b_v3_7.notes':
    '最高品質のJP→ZH翻訳。品質を最優先する場合に使用してください。',

  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.highlights':
    '日本語から中国語に翻訳\n軽量・高速版\n低スペックPCに最適',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.unique':
    '大型Sakuraと同じファミリーですが、メモリの少ないPCでも動作するよう最適化',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.bestFor':
    '高性能GPUがない環境での日中翻訳',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.performance':
    '高速、VRAMは1-2GB��み必要',
  'model.tooltip.sakura_1_5b_qwen2_5_v1_0.notes':
    'サイズの割に高��質 — 大型モデルが重すぎる場合に最適',

  'model.tooltip.hunyuan_7b_mt_v1_0.highlights':
    '36言語間の翻訳に対応\nコンペで受賞した高品質\n多言語に強力なモデル',
  'model.tooltip.hunyuan_7b_mt_v1_0.unique':
    '世界で最も多くの賞を受けた翻訳モデルの1つ — 複数の翻訳を組み合わせて最高の結果を提供',
  'model.tooltip.hunyuan_7b_mt_v1_0.bestFor':
    '多くの異なる言語間で高品質な翻訳が必要な場合',
  'model.tooltip.hunyuan_7b_mt_v1_0.performance':
    '6-8GBのVRAMを持つGPUが必要；中程度の速度',
  'model.tooltip.hunyuan_7b_mt_v1_0.notes':
    '品質を最優先する多言語プロジェクトに最適',

  'model.tooltip.font_rtdetr_v2.highlights':
    '漫画のフキダシとテキストを検出\nフキダシ内外のテキストを識別\n1回の処理ですべて完了',
  'model.tooltip.font_rtdetr_v2.unique':
    'フキダシ、フキダシ内テキスト、ページ上の自由テキストを同時に検出できる唯一のモデル',
  'model.tooltip.font_rtdetr_v2.bestFor':
    '漫画ページの包括的な分析 — セリフと自由テキストを自動的に分離',
  'model.tooltip.font_rtdetr_v2.performance':
    '軽量・高速、ほ��んどのPCで快適に動作',
  'model.tooltip.font_rtdetr_v2.notes':
    '漫画、ウェブトゥーン、マンファ、西洋コミックで学習',

  'model.tooltip.comic_text_detector.highlights':
    '漫画・コミック��テキストを検出\n実績のある信頼性の高いモデル\nどのPCでも高速動作',
  'model.tooltip.comic_text_detector.unique':
    '多くの漫画翻訳プロジェクトの基盤として使用されているクラシックな検出モデル',
  'model.tooltip.comic_text_detector.bestFor':
    '漫画の基本的で��頼性の高いテキスト検出 — 定番の選択肢',
  'model.tooltip.comic_text_detector.performance':
    '高速、専用GPUなしでも快適に動作',
  'model.tooltip.comic_text_detector.notes':
    'コミュニティで長年テストされてきたクラシックモデル',

  'model.tooltip.pp_doclayout_v3.highlights':
    'スキャンページのレイアウトを分析\n傾きや曲がったページでも対応\n正しい読み順を識別',
  'model.tooltip.pp_doclayout_v3.unique':
    '斜めに撮影されたり不規則にスキャンされたページを理解可能 — 他のモデルにはない機能',
  'model.tooltip.pp_doclayout_v3.bestFor':
    '不完全にスキャンされたページ、書籍の写真、読み順が難しい複雑なレイアウト',
  'model.tooltip.pp_doclayout_v3.performance':
    '堅牢で信頼性が高く、さまざまな照明条件で良好に動作',
  'model.tooltip.pp_doclayout_v3.notes':
    'ページが完全にデジタル化されていない場合に便利',

  'model.tooltip.manga_ocr.highlights':
    '漫画の日本語テキストを読み取り\n縦書き・横書きの両方に対応\n日本の漫画に最も推奨',
  'model.tooltip.manga_ocr.unique':
    '漫画特有の課題に特化：縦書き、ふりがな、装飾フォント、低画質画像',
  'model.tooltip.manga_ocr.bestFor':
    '日本の漫画テキ��ト読み取りの定番 — 設定不要ですぐに使える',
  'model.tooltip.manga_ocr.performance':
    '人気があり信頼��が高く、多くのスキャンレーションプロジェクトで使用',
  'model.tooltip.manga_ocr.notes':
    '日本の漫画に最適。速度が必要な場合はMeiki OCRをご検討ください。',

  'model.tooltip.meiki_ocr.highlights':
    '超高速の日本語テキストリーダー\n各文字を個別に検出\n横書きテキストに最適',
  'model.tooltip.meiki_ocr.unique':
    '他の日本語テキストリーダーよりはるかに高速 — 速度が最優先の場合に最適',
  'model.tooltip.meiki_ocr.bestFor':
    '横書きの日本語��キストを素早く読み取りたい場合',
  'model.tooltip.meiki_ocr.performance':
    '非常に高速、日��語リーダーの中でもトップクラスの速度',
  'model.tooltip.meiki_ocr.notes':
    '横書きテキストのみ対応 — 縦書きテキストにはManga OCRを使用してください',

  'model.tooltip.paddleocr_vl_manga.highlights':
    '漫画に最適化されたテキストリーダー\n縦書き・横書きの両方に対応\nベースモデルより漫画での精度が大幅に向上',
  'model.tooltip.paddleocr_vl_manga.unique':
    '漫画ページで特別に学習 — 汎用リーダーより装飾フォントやフキダシをよく理解',
  'model.tooltip.paddleocr_vl_manga.bestFor':
    '難しいフォントのテキストを含む漫画を高精度で読み取り',
  'model.tooltip.paddleocr_vl_manga.performance':
    '漫画での精度が��好；他の言語でも動作',
  'model.tooltip.paddleocr_vl_manga.notes':
    'PaddleOCRの漫画特化版 — スキャンレーションに最適な選択肢',

  'model.tooltip.got_ocr2.highlights':
    '文書、表、グラフからテキストを読み取り\n数式や楽譜も理解\n多様な文書タイプに対応',
  'model.tooltip.got_ocr2.unique':
    '単純なテキストを超えて — 表、数式、フォーマットされたグラフも読み取り可能',
  'model.tooltip.got_ocr2.bestFor':
    '表やフォーマットを含む複雑な文書の読み取り — 漫画には不向き',
  'model.tooltip.got_ocr2.performance':
    '軽量・汎用的、��般的な文書に対して良好に動作',
  'model.tooltip.got_ocr2.notes':
    '多言語対応ですが漫画には最適化されていません — コミックには他のモデルを使用してください',

  'model.tooltip.qwen2_5_vl_3b.highlights':
    '画像をインテリ��ェントに理解\nテキスト読み取りを超えて画像の内容を把握\n多言語・汎用',
  'model.tooltip.qwen2_5_vl_3b.unique':
    'テキストを読む��けでなく — 漫画のコマを理解し、シーンを説明し、画像から整理された情報を抽出',
  'model.tooltip.qwen2_5_vl_3b.bestFor':
    'モデルにテキス��だけでなく画像の内容を理解させたい場合',
  'model.tooltip.qwen2_5_vl_3b.performance':
    '中程度のサイズ��一般的なGPUで良好な速度',
  'model.tooltip.qwen2_5_vl_3b.notes':
    '多言語対応。コ��分析や高度なビジュアル理解に便利',

  'model.tooltip.mangalmm.highlights':
    '人間の読者のよ��に漫画のコマを理解\nキャラクターやストーリー要素を識別\n単なるテキスト読み取りを超越',
  'model.tooltip.mangalmm.unique':
    '漫画の理解に特化した唯一のモデル — キャラクター、コマ、ビジュアルナラティブを認識',
  'model.tooltip.mangalmm.bestFor':
    '高度な漫画分析：誰が話しているか、コマで何が起きているかの理解',
  'model.tooltip.mangalmm.performance':
    '14GBのVRAMを持つ高性能GPUが必要；まだ研究段階',
  'model.tooltip.mangalmm.notes':
    '実験的モデル — スキャンレーションの将来に有望ですがまだ成熟していません',

  'model.tooltip.rolmocr.highlights':
    '文書向けの高速テキストリーダー\n複雑なレイアウトに対応\nより軽量・高速な代替モデル',
  'model.tooltip.rolmocr.unique':
    '類似モデルより高速・軽量でありながら、文書読み取りの品質を維持',
  'model.tooltip.rolmocr.bestFor':
    '速度が重要な場合の複雑なレイアウトの文書読み取り',
  'model.tooltip.rolmocr.performance':
    '高速・効率的；��度と品質のバランスが良好',
  'model.tooltip.rolmocr.notes':
    '漫画専用ではあ��ません — 文書や一般テキストに最適',

  'model.tooltip.glm_ocr_onnx.highlights':
    'コンパクトで高精度なテキストリーダー\nベンチマークで最高クラスの精度\n低スペックPCでも快適に動作',
  'model.tooltip.glm_ocr_onnx.unique':
    '高精度と小サイズを両立 — 軽量ながら最高クラスの精度を実現',
  'model.tooltip.glm_ocr_onnx.bestFor': '高性能PCなしでも高精度な文書読み取り',
  'model.tooltip.glm_ocr_onnx.performance':
    '非常に軽量・高��；高性能GPUなしのPCでも快適に動作',
  'model.tooltip.glm_ocr_onnx.notes':
    '複数言語をサポートしていますが日本語は限定的。一般文書に最適。',

  'model.tooltip.paddleocr.highlights':
    'ロシア語テキストを読み取り\n高速・信頼性が高い\nロシア語のマンファに最適',
  'model.tooltip.paddleocr.unique':
    'キリル文字に特化して最適化 — ロシア語では汎用リーダーより優秀',
  'model.tooltip.paddleocr.bestFor': '漫画・コミックのロシア語テキスト読み取り',
  'model.tooltip.paddleocr.performance': '非常に高速、ほとんどのPCで快適に動作',
  'model.tooltip.paddleocr.notes': 'ロシア語テキス��に最適な選択肢',

  'model.tooltip.paddleocr_latin_v5.highlights':
    'ヨーロッパ言語��テキストを読み取り\nフランス語、ドイツ語、スペイン語、ポルトガル語など\n高速・信頼性が高い',
  'model.tooltip.paddleocr_latin_v5.unique':
    'ヨーロッパのア��ファベットに最適化 — これらの言語では汎用リーダーより高性能',
  'model.tooltip.paddleocr_latin_v5.bestFor':
    'フランス語、ドイツ語、スペイン語、イタリア語、ポルトガル語などのテキスト読み取り',
  'model.tooltip.paddleocr_latin_v5.performance':
    '高速・軽量、どのPCでも快適に動作',
  'model.tooltip.paddleocr_latin_v5.notes':
    'ラテンアルファベットのヨーロッパ言語に最適な選択肢',

  'model.tooltip.paddleocr_ch_v5.highlights':
    '簡体字・繁体字の中国語テキストを読み取り\n高速・高精度\nマンファ（中国漫画）に最適',
  'model.tooltip.paddleocr_ch_v5.unique':
    '中国語の文字に特化して最適化 — 複雑な画数や多様なフォントをより正確に認識',
  'model.tooltip.paddleocr_ch_v5.bestFor':
    'マンファや中国��コンテンツ全般を高精度で読み取り',
  'model.tooltip.paddleocr_ch_v5.performance':
    '高速・軽量、ほとんどのPCで快適に動作',
  'model.tooltip.paddleocr_ch_v5.notes':
    '中国語に最適な選択肢。シンプルで効率的。',

  'model.tooltip.paddleocr_en_v5.highlights':
    '英語テキストを読み取り\n高速・高精度\n西洋コミックに最適',
  'model.tooltip.paddleocr_en_v5.unique':
    '英語に特化して最適化 — 多様なフォントやスタイルをより正確に認識',
  'model.tooltip.paddleocr_en_v5.bestFor':
    '西洋コミックや翻訳済み漫画の英語テキスト読み取り',
  'model.tooltip.paddleocr_en_v5.performance':
    '非常に高速・軽��、どのPCでも動作',
  'model.tooltip.paddleocr_en_v5.notes': '英語テキストに最適な選択肢',

  'model.tooltip.easyocr.highlights':
    '80以上の言語のテキストを読み取り\n使いやすく汎用的\n同じ画像で複数言語に対応',
  'model.tooltip.easyocr.unique':
    '最も汎用的なモデルの1つ — 同じ画像内の多くの異なる言語を読み取り可能',
  'model.tooltip.easyocr.bestFor':
    'モデルを切り替��ずに多言語に対応するリーダーが必要な場合',
  'model.tooltip.easyocr.performance':
    'きれいなテキス��には良好；装飾フォントや縦書きテキストは苦手',
  'model.tooltip.easyocr.notes':
    '漫画には最適化されていません。汎用的な多言語オプションとして便利。',

  'model.tooltip.pororo.highlights':
    '韓国語テキストを読み取り\n韓国のマンファに最適\n軽量・信頼性が高い',
  'model.tooltip.pororo.unique':
    '韓国語のアルファベット（ハングル）に特化 — 汎用リーダーより高い認識精度',
  'model.tooltip.pororo.bestFor':
    '韓国のマンファ��テキスト読み取り — 韓国語専用の最良の選択肢',
  'model.tooltip.pororo.performance': '韓国語での精度��良好；軽量・高速',
  'model.tooltip.pororo.notes':
    '韓国語と英語のみ。コミュニティによってメンテナンス。',

  'model.tooltip.paddleocr_vl_1_5.highlights':
    '高度な多言語テキストリーダー\n世界で最も精度の高いモデルの1つ\n日本語、中国語、英語などに対応',
  'model.tooltip.paddleocr_vl_1_5.unique':
    '不規則な形状や多角形のテキストを検出可能 — 曲がった、傾いた、難しい位置のテキストも読み取り',
  'model.tooltip.paddleocr_vl_1_5.bestFor':
    '複数言語の文書��コミックの高度なテキスト読み取り',
  'model.tooltip.paddleocr_vl_1_5.performance':
    '高精度・汎用的��一般的なGPUで良好に動作',
  'model.tooltip.paddleocr_vl_1_5.notes':
    '日本語、中国語、英語を含む多言語対応。漫画ファインチューニングのベースモデル。',

  'model.tooltip.aot.highlights':
    '漫画から日本語テキストを除去\n背景アートを自動的に復元\n高速・効率的',
  'model.tooltip.aot.unique':
    '漫画テキスト除去に特化 — アートスタイルを理解し自然に背景を復元',
  'model.tooltip.aot.bestFor':
    '漫画のコマから日本語テキストを除去し背景アートを復元',
  'model.tooltip.aot.performance': '高速、GPUの有無に関わらず良好に動作',
  'model.tooltip.aot.notes': '漫画のテキスト��リーニングの定番',

  'model.tooltip.lama_manga.highlights':
    '漫画・アニメか��テキストを除去\nあらゆるサイズの画像に対応\n大きなテキスト領域も適切に処理',
  'model.tooltip.lama_manga.unique':
    '画像サイズの制��なし — 他のモデルと異なり、あらゆる解像度のページに対応',
  'model.tooltip.lama_manga.bestFor':
    'あらゆるサイズ��漫画ページからテキストを除去、特に大きなテキストブロックやフキダシ',
  'model.tooltip.lama_manga.performance':
    'あらゆる画像サイズに対応；ほとんどのPCで良好な速度',
  'model.tooltip.lama_manga.notes':
    'LaMaの改良版 — ページが大きい場合や除去するテキストが多い場合に使用',

  'model.tooltip.opencv_lama.highlights':
    '画像からテキストを除去\n軽量・シンプルな版\n汎用的な用途に最適',
  'model.tooltip.opencv_lama.unique':
    'OpenCV公式がメンテナンスするバージョン — 直接的で信頼性の高い統合',
  'model.tooltip.opencv_lama.bestFor':
    '最高品質が不要��場合の基本的で素早いテキスト除去',
  'model.tooltip.opencv_lama.performance': '軽量・高速、どのPCでも動作',
  'model.tooltip.opencv_lama.notes':
    'シンプルなテキストクリーニングに適した軽量オプション',

  'model.tooltip.lama_fp32.highlights':
    '高品質で画像か��テキストを除去\nテキスト除去モデル中の最高品質\n速度より品質を重視する場合に最適',
  'model.tooltip.lama_fp32.unique':
    'LaMaの最も忠実で���確なバージョン — 軽量版より自然に背景を再現',
  'model.tooltip.lama_fp32.bestFor': 'クリーニング品質が速度より重要な場合',
  'model.tooltip.lama_fp32.performance':
    '軽量版より低速；より多くのメモリが必要',
  'model.tooltip.lama_fp32.notes':
    '品質を最優先する場合に使用。入力サイズは固定。',

  'model.tooltip.waifu2x_swin_unet_art_scan_2x.highlights':
    'アニメスキャン��2倍にアップスケール\nノイズ除去と品質向上\n漫画スキャンに最適',
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.unique':
    'アニメ・漫画ス��ャン改善の定番 — ノイズ除去と画質向上を同時に実行',
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.bestFor':
    '低解像度の漫画スキャンの改善とJPEG圧縮アーティファクトの除去',
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.performance':
    '軽量・高速、ど��PCでも動作',
  'model.tooltip.waifu2x_swin_unet_art_scan_2x.notes':
    '漫画スキャンの2倍アップスケールの定番',

  'model.tooltip.waifu2x_swin_unet_art_scan_4x.highlights':
    'アニメスキャンを4倍にアップスケール\nノイズ除去と品質向上\nより高い解像度が必要な場合に',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.unique':
    'クラシックWaifu2xの4倍版 — きれいなラインを維持しながら大幅に解像度を向上',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.bestFor':
    'より大きな解像度アップでの漫画スキャン改善とクリーンな線画の保持',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.performance':
    '2倍版より低速；���れでも軽量',
  'model.tooltip.waifu2x_swin_unet_art_scan_4x.notes':
    '2倍版より高い解���度が必要な場合に使用',

  'model.tooltip.waifu2x_swin_unet_art_2x.highlights':
    'アニメアートを2倍にアップスケール\nすでにきれいで高品質なアート向け\n繊細なディテールを保持',
  'model.tooltip.waifu2x_swin_unet_art_2x.unique':
    'すでにきれいな��ートに最適化 — ノイズを追加せずに繊細なディテールを保持',
  'model.tooltip.waifu2x_swin_unet_art_2x.bestFor':
    'きれいなデジタルアートやすでに高品質な漫画の改善',
  'model.tooltip.waifu2x_swin_unet_art_2x.performance':
    '軽量・高速、どのPCでも動作',
  'model.tooltip.waifu2x_swin_unet_art_2x.notes':
    'スキャン版ほど強力ではありません — 画像がすでにきれいな場合に使用',

  'model.tooltip.4xnomos2_hq_mosr.highlights':
    '最高品質で画像を4倍に拡大\n繊細なディテールとシャープなラインを保持\nすでにきれいなスキャンに最適',
  'model.tooltip.4xnomos2_hq_mosr.unique':
    '品質に特化 — 元画像のすべてのディテールをそのまま維持',
  'model.tooltip.4xnomos2_hq_mosr.bestFor':
    'すでにきれいで高品質な漫画スキャンの改善',
  'model.tooltip.4xnomos2_hq_mosr.performance':
    '良好な速度；わずか16MBの小さなファイルサイズ',
  'model.tooltip.4xnomos2_hq_mosr.notes':
    'すでにきれいな画像で最も効果的。ノイズや圧縮がある場合は先にクリーニングしてください。',

  'model.tooltip.4xspankendata.highlights':
    '非常に高速に画像を4倍に拡大\nわずか1.6MBの極小ファイル\n低スペックPCでも快適に動作',
  'model.tooltip.4xspankendata.unique':
    '超軽量 — スペースを取らずに速度が必要な場合に最適',
  'model.tooltip.4xspankendata.bestFor':
    '時間が重要な場合のあらゆる画像の高速アップスケール',
  'model.tooltip.4xspankendata.performance':
    '非常に高速；わ��か1.6MBのファイルサイズ — CPU処理に最適',
  'model.tooltip.4xspankendata.notes':
    '品質の割に驚く��ど小さい。バッチ処理に最適なオプション。',

  'model.tooltip.2x_hfa2kcompact.highlights':
    'バランスの取れた2倍画像拡大\n現代アニメのフレームで学習\n圧縮やボケに対応',
  'model.tooltip.2x_hfa2kcompact.unique':
    'アニメのスペシャリスト — 現代アニメーションのビジュアルスタイルを理解',
  'model.tooltip.2x_hfa2kcompact.bestFor':
    '圧縮アーティファクトや不均一な品質の漫画/アニメページ',
  'model.tooltip.2x_hfa2kcompact.performance':
    '高速・軽量；わ��か4.6MBのファイルサイズ',
  'model.tooltip.2x_hfa2kcompact.notes':
    '実際の画像に対して堅牢 — 不完全なスキャンでも良好に動作。',

  'model.tooltip.2x_digitalfilm_superultracompact.highlights':
    '最小サイズで画像を2倍に拡大\nディスク容量が限られている場合に最適\nサイズの割に良好な品質',
  'model.tooltip.2x_digitalfilm_superultracompact.unique':
    '超コンパクト — 品質を犠牲にせずどこにでも収まる',
  'model.tooltip.2x_digitalfilm_superultracompact.bestFor':
    'スペースやメモリの節約が必要な場合の軽量アップスケール',
  'model.tooltip.2x_digitalfilm_superultracompact.performance':
    '高速；約20MB；手動でのフォーマット変換が必要な場合があります',
  'model.tooltip.2x_digitalfilm_superultracompact.notes':
    'ファイルが読み��めない場合、外部でフォーマットを変換する必要がある場合があります。',

  'model.tooltip.2x_anifilm_compact.highlights':
    'アニメに最適化された2倍画像拡大\n品質とサイズのバランスが良好\nビジュアルスタイルを保持',
  'model.tooltip.2x_anifilm_compact.unique':
    'アニメやアニメーション映画のビジュアルスタイルを理解 — オリジナルの美学を維持',
  'model.tooltip.2x_anifilm_compact.bestFor':
    '過度な処理をせ��にオリジナルの見た目を維持したいアニメコンテンツ',
  'model.tooltip.2x_anifilm_compact.performance':
    '高速；約20MB；手���でのフォーマット変換が必要な場合があります',
  'model.tooltip.2x_anifilm_compact.notes':
    'ファイルが読み��めない場合、外部でフォーマットを変換する必要がある場合があります。',

  'model.tooltip.2xnomosuni_span_multijpg_ldl.highlights':
    '圧縮に強い2倍画像拡大\nさまざまなJPG品質レベルに対応するよう学習\n不完全なスキャンに堅牢',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.unique':
    'JPG圧縮処理のスペシャリスト — 低品質スキャンでも良好に動作',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.bestFor':
    'さまざまなJPG圧��レベルや品質アーティファクトのある漫画スキャン',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.performance':
    '高速；約20MB；手���でのフォーマット変換が必要な場合があります',
  'model.tooltip.2xnomosuni_span_multijpg_ldl.notes':
    'ファイルが読み込めない場合、外部でフォーマットを変換する必要がある場合があります。',

  'model.tooltip.realesrgan_x4plus.highlights':
    '高い汎用性で画像を4倍に拡大\nJPEG、ボケ、ノイズに対応\nあらゆるコンテンツに対応',
  'model.tooltip.realesrgan_x4plus.unique':
    '最も汎用的 — さまざまな種類の画質劣化を理解し補正',
  'model.tooltip.realesrgan_x4plus.bestFor':
    '混合コンテンツの漫画ページ；JPEGアーティファクト；最も汎用的なアップスケーラー',
  'model.tooltip.realesrgan_x4plus.performance':
    '良好な速度；コンパクトモデルよりやや重い',
  'model.tooltip.realesrgan_x4plus.notes':
    'アニメ/漫画専用には、より高速で最適化されたアニメ版（6B）をお勧めします。',

  'model.tooltip.4xhfa2kludvaeswinir_light.highlights':
    'アニメに最適化された4倍画像拡大\n品質とパフォーマンスのバランスが良好\nアニメのビジュアルスタイルを保持',
  'model.tooltip.4xhfa2kludvaeswinir_light.unique':
    'アップスケール��質とアニメのビジュアルディテールへの配慮を両立',
  'model.tooltip.4xhfa2kludvaeswinir_light.bestFor':
    'ソース品質が良好なアニメコンテンツの4倍アップスケール',
  'model.tooltip.4xhfa2kludvaeswinir_light.performance':
    '中程度の速度；約70MB；手動でのフォーマット変換が必要な場合があります',
  'model.tooltip.4xhfa2kludvaeswinir_light.notes':
    'ファイルが読み込めない場合、外部でフォーマットを変換する必要がある場合があります。',

  'model.tooltip.baka_content_cc.highlights':
    '漫画ページのフ��ダシとテキストを分離\nテキストとフキダシを識別\n高速・効率的',
  'model.tooltip.baka_content_cc.unique':
    'テキスト・フキ��シ検出システムと統合 — 他のモデルと連携して動作',
  'model.tooltip.baka_content_cc.bestFor':
    '後続処理のために漫画ページのテキストとフキダシを分離',
  'model.tooltip.baka_content_cc.performance': '高速・軽量、高性能GPUは不要',
  'model.tooltip.baka_content_cc.notes':
    'セグメンテーションパイプラインの一部として使用',
  'settings.tooltips.title': 'ツールヒント',
  'settings.tooltips.description':
    'ダッシュボード���使用中にコンテキストヒントを表示するタイミングを制御します。',
  'settings.tooltips.enableTitle': 'コンテキストヒントを表示',
  'settings.tooltips.enableDesc':
    'セッションごと���各ツールを初めて使用する際、アニメーション付きのヒントを表示します。',
  'dashboard.hint.healing.ariaLabel': 'Healingツールのヒント',
  'dashboard.hint.healing.eyebrow': '新しいツール',
  'dashboard.hint.healing.body':
    'Healing Brushを使用して、���陥、壊れたエッジ、テキストの残留物を除去できます。修正したい領域をブラシで塗り、適用をクリックすると、AIがその領域を違和感なく再構築します。',
  'dashboard.hint.healing.footer':
    'このヒントは今回のセッションでは再表示されません。すべてのヒントは設定 → アプリから無効にできます。',
  'dashboard.aio.presets.tooltip':
    'プリセットは言語ごとにモデルとステージの組み合わせを保存します。ソース言語やワークフローを変更する際に、AIO設定を素早く切り替えるために使用してください。',
  'dashboard.aio.presets.tooltipAria': '言語プリセットは何に使われますか',
  'dashboard.aio.cleanImage.tooltip':
    'Clean Imageはクリーンアップとインペインティングのステージです。最終レンダー/編集パスの前に、テキストと選択したアーティファクトを削除します。',
  'dashboard.aio.cleanImage.tooltipAria': 'Clean Imageは何に使われますか',
  'dashboard.aio.clean.maskDilation.tooltip':
    'インペインティングの前にクリーンアップマスクを拡張します。テキストの端が残っている場合は値を上げてください。近くの作品を保つには値を低くしてください。',
  'dashboard.aio.clean.maskDilation.tooltipAria':
    'マスク拡張は何に使われますか',
  'dashboard.dashboardLlm.hdStrategy.tooltip':
    'クリーンアップ前に大きな画像をどのように準備するかを定義します。Resizeはページをスケールし、Cropはタイルに分割し、Originalはそのまま送信します。',
  'dashboard.dashboardLlm.hdStrategy.tooltipAria': 'HD戦略は何に使われますか',
  'dashboard.dashboardLlm.cropMargin.tooltip':
    '各クロップタイルの周囲に追加のパディングを追加します。境界がコンテキストを失うか、クリーンアップ後にシームが表示される場合は値を増してください。',
  'dashboard.dashboardLlm.cropMargin.tooltipAria':
    'クロップマージンは何に使われますか',
  'dashboard.dashboardLlm.cropTriggerSize.tooltip':
    'クロップタイリングをアクティブにする最小画像サイズ。小さい画像は1つのまま維持され、大きい画像はタイルに分割されます。',
  'dashboard.dashboardLlm.cropTriggerSize.tooltipAria':
    'クロップトリガーサイズは何に使われますか',
  'common.basicInfo': "基本情報",
  'common.resolve': "解決",
  'common.dismiss': "却下",
  'common.title': "タイトル",
  'common.summary': "概要",
  'common.summaryPlaceholder': "短く分かりやすい概要を書いてください。",
  'common.mainDescription': "メイン説明",
  'common.chapter': "章",
  'common.genres': "ジャンル",
  'common.editorialDescription': "編集説明",
  'common.removeValue': "{value}を削除",
  'settings.integrations.discordWebhook': "Discord Webhook",
  'discord.presence.appName': "KŌMA Studio",
  'discord.presence.button.website': "ウェブサイト",
  'discord.presence.button.download': "ダウンロード",
  'discord.presence.idle.details': "スキャンレーションツールを探索中",
  'discord.presence.idle.state': "待機中",
  'discord.presence.workspace.details': "ページを整理して作業フローを準備中",
  'discord.presence.aio.details': "マンガ処理パイプラインを一括実行中",
  'discord.presence.mode.automatic': "自動モード",
  'discord.presence.mode.manual': "手動モード",
  'discord.presence.mode.basic': "モード: 基本",
  'discord.presence.mode.advanced': "モード: 高度",
  'discord.presence.cleaner.details': "吹き出しを消してアートを復元中",
  'discord.presence.cleaner.state.basic': "モード: 基本",
  'discord.presence.cleaner.state.advanced': "モード: 高度",
  'discord.presence.translator.details': "セリフの雰囲気を保って翻訳中",
  'discord.presence.translator.fileDetails': "翻訳中 - {fileName}",
  'discord.presence.typesetter.details': "仕上げた文字をページに戻し込み中",
  'discord.presence.typesetter.fileDetails': "テキスト編集 - {fileName}",
  'discord.presence.redraw.fileDetails': "リドロー中 - {fileName}",
  'discord.presence.raw.details': "プロバイダを試して生の出力を比較中",
  'discord.presence.proofreader.details': "最終公開前のページを確認中",
  'discord.presence.stitch.details': "コマをつないで長いページにまとめ中",
  'discord.presence.split.details': "見開きをきれいな単ページに分割中",
  'discord.presence.watermark.details': "クレジットとブランド情報を追加中",
  'discord.presence.enhance.details': "ページを高精細化してアートを補正中",
  'discord.presence.optimizer.details': "章を書き出し向けに仕上げ中",
  'discord.presence.blogger.details': "章投稿と CDN 配信を準備中",
  'discord.presence.imgur.details': "画像セットをアップロードしてリンクを共有中",
  'discord.presence.guides.details': "ワークフローや近道、ベストプラクティスを学習中",
  'discord.presence.resources.details': "素材・参考資料・サポート情報を閲覧中",
  'discord.presence.batch.details': "ページを順番に処理中",
  'discord.presence.batch.fileDetails': "バッチ処理中 - {fileName}",
  'discord.presence.batch.state': "{current}/{total} ファイル",
  'discord.presence.batch.label': "バッチモード",
  'discord.presence.section.working': "{section}で作業中",
  'discord.presence.section.viewing': "{section}を表示中",
  'discord.presence.settings.details': "スタジオ設定を調整中",
  'discord.presence.settings.label': "設定",
  'discord.presence.rankings.details': "モデルの品質・速度・コストを比較中",
  'discord.presence.rankings.label': "ランキング",
  'discord.presence.scanlationFeed.details': "コミュニティの更新とリリースを確認中",
  'discord.presence.scanlationFeed.label': "スキャンレーションフィード",
  'discord.presence.loginRegister.details': "アカウントにサインインしてアクセスを管理中",
  'discord.presence.loginRegister.label': "ログイン / 登録",
  'typographer.shapeApplied': "形状を適用しました。",
  'feed.tabsAria': "Scanlation Feed のセクション",
  'feed.actions.publishPost': "{type}を公開",
} as const;
