import type { LegalContentBundle } from "./legalContent.types";

export const legalContentKo: LegalContentBundle = {
  releaseDate: "2026년 4월 13일",
  documents: {
    terms: {
      eyebrow: "서비스 약관",
      title: "KŌMA Studio 서비스 약관",
      summary: "KŌMA Studio 접근, 선택형 연동, 커뮤니티 영역, 데스크톱 및 웹 연계 기능 사용을 규율하는 규칙입니다.",
      highlights: [
        "KŌMA Studio는 데스크톱 앱과 웹 인증, 업데이트, 지원, 선택형 원격 서비스를 함께 제공합니다.",
        "사용자가 업로드하거나 게시하는 파일, 프롬프트, 링크, 자료의 권리와 적법성은 계속해서 사용자 책임입니다.",
        "기능, 연동, 보안 통제는 법률, 제공업체, 남용 방지 요구사항의 변경에 따라 달라질 수 있습니다.",
      ],
      sections: [
        { title: "1. 서비스 범위", paragraphs: ["KŌMA Studio는 cleaning, redraw, OCR, 번역, 식자, 워크플로 자동화, 보조 게시 등 scanlation 생산성을 위한 기능을 제공합니다. 일부 기능은 기기에서 완전히 실행되며, 다른 기능은 계정, 지원, 업데이트, 관리형 서비스 또는 사용자가 활성화한 연동을 위해 원격 인프라에 의존합니다.", "서비스는 시간이 지나면서 변경될 수 있습니다. 제품 운영, 법규 준수 또는 인프라 무결성을 위해 기능, 제공업체, 사용량 한도, 모델 카탈로그, 보안 요구사항 또는 호환성 규칙을 추가, 변경, 교체 또는 중단할 수 있습니다."] },
        { title: "2. 계정, 자격 및 보안", paragraphs: ["정확한 등록 정보를 제공해야 하며, 계정 자격 증명을 안전하게 보관하고, 적용 법률에 따라 구속력 있는 계약을 체결할 수 있는 경우에만 서비스를 이용해야 합니다. 이 서비스는 보호자 동의 없이 온라인 서비스를 이용할 수 있는 최소 연령에 미달하는 아동을 대상으로 하지 않습니다.", "계정, 연동 및 플랫폼을 보호하기 위해 이메일 인증, 신뢰 기기 확인, travel token 흐름, CAPTCHA, 속도 제한, 필수 앱 업데이트, 세션 검토, 임시 제한 등 합리적인 보안 조치를 요구할 수 있습니다."], bullets: ["법률이 달리 정하지 않는 한 계정에서 발생하는 활동은 사용자 책임입니다.", "자격 증명 공유, 사용량 한도 우회, 기술적 제한 우회, 사기 또는 남용의 자동화는 금지됩니다.", "보안 위험, 미납, 불법 행위 또는 본 문서의 중대한 위반이 확인되면 접근을 중지하거나 종료할 수 있습니다."] },
        { title: "3. 사용자 콘텐츠, 권리 및 허용된 사용", paragraphs: ["콘텐츠의 소유권은 사용자에게 남아 있습니다. 다만 KŌMA Studio는 요청된 기능 실행, 보안 유지, 지원 제공을 위해 필요한 범위에서 해당 콘텐츠를 호스팅, 전송, 캐시, 변환, 표시 또는 처리할 수 있는 제한적 권한을 부여받습니다.", "서비스에서 사용하는 이미지, 텍스트, 프롬프트, 로그, 첨부파일, 링크를 전송, 처리, 게시 또는 공유하는 데 필요한 권리, 라이선스, 승인 및 적법한 근거를 보유하고 있음을 진술합니다. KŌMA Studio는 제3자 저작물에 대한 권리를 부여하지 않으며, 사용자의 권리 체인을 검증하지 않습니다."], bullets: ["저작권, 상표, 개인정보, 기밀성, 인격권 또는 플랫폼 보안을 침해하기 위해 서비스를 사용해서는 안 됩니다.", "악성코드, 피싱, 불법 자료, 오해를 유발하는 모집 게시물 또는 남용적 커뮤니티 콘텐츠를 업로드해서는 안 됩니다.", "법적, 보안상, 평판상 또는 운영상 위험을 초래하는 콘텐츠는 삭제, 숨김, 차단 또는 신고될 수 있습니다."] },
        { title: "4. 제3자 서비스 및 연동", paragraphs: ["Blogger, Imgur, Discord webhook, BYOK AI provider 및 기타 커넥터 기능은 사용자가 명시적으로 활성화한 경우에만 작동합니다. 이러한 흐름을 실행하면 KŌMA Studio는 요청된 작업을 완료하는 데 필요한 선택된 콘텐츠, 자격 증명, 메타데이터 및 기술 지시를 전송할 수 있습니다.", "제3자 서비스는 각자의 약관, 개인정보 처리방침, 보관 규칙, 제한 및 가용성 기준에 따라 운영됩니다. 사용자가 연결한 제공업체 또는 사용자가 설정한 자격 증명으로 인해 발생하는 서비스 중단, 정책 변경, 계정 제한, 데이터 처리 또는 손해에 대해 당사는 책임지지 않습니다."] },
        { title: "5. 가용성, 책임 및 업데이트", paragraphs: ["서비스는 가용성과 지속적인 업데이트를 전제로 제공됩니다. 법률이 허용하는 최대 범위에서 KŌMA Studio는 간접 손해, 이익 손실, 편집 지연, 외부 게시 실패, 제공업체 장애 또는 사용자의 불법적이거나 무단된 서비스 사용으로 인해 발생한 손해에 대해 책임지지 않습니다.", "본 약관의 어떤 내용도 포기할 수 없는 소비자 권리 또는 개인정보 권리를 배제하지 않습니다. 제품, 법률, 제공업체 또는 위험 프로필이 변경되면 본 약관과 관련 고지를 업데이트할 수 있습니다. 현재 버전은 Legal Center에 게시되며, 계속 사용하려면 재동의가 필요할 수 있습니다."] },
      ],
    },
    privacy: {
      eyebrow: "개인정보 처리방침",
      title: "KŌMA Studio 개인정보 처리방침",
      summary: "KŌMA Studio가 계정, 지원, 보안, 연동 및 커뮤니티 기능과 관련된 개인정보를 어떻게 수집, 사용, 공유, 보관 및 보호하는지 설명합니다.",
      highlights: [
        "여기에 설명된 처리에 대해 KŌMA Studio는 일반적으로 controller로 동작하며, 제3자가 자체 목적을 위해 independent controller로 처리하는 경우는 예외입니다.",
        "우리는 서비스 운영, 사용자 보호 및 법적 의무 이행을 위해 account, device, support, moderation 및 integration 데이터를 처리합니다.",
        "현재 제품에서는 광고용 cookies를 사용하지 않으며 개인정보를 판매하지 않습니다.",
      ],
      sections: [
        { title: "1. 적용 범위와 controller 역할", paragraphs: ["이 정책은 KŌMA Studio 데스크톱 앱, 웹 인증 흐름, 지원 운영, bug report 흐름, 커뮤니티 영역 및 연결된 서비스에 적용됩니다. 여기서 설명하는 처리에 대해서는 KŌMA Studio가 controller로 동작하지만, 다른 제공업체가 처리 목적과 수단을 독립적으로 결정하는 경우는 예외입니다.", "이메일 제공업체, 사용자가 연결한 AI 서비스, 외부 게시 플랫폼 및 인프라 파트너는 활동에 따라 processor 또는 independent controller로 동작할 수 있습니다. 그들의 자체 법적 문서도 그들이 자체 목적을 위해 처리하는 데이터에 적용됩니다."] },
        { title: "2. 개인정보 범주", paragraphs: ["표시 이름, 이메일, 인증 상태, 계정 식별자, 세션 기록, 로그인 시도, 신뢰 기기 식별자, 보안 관련 IP 신호, 기기 또는 앱 진단 정보 등 서비스 접근 보호와 운영에 필요한 등록 및 계정 데이터를 수집할 수 있습니다.", "또한 지원 요청과 bug reports, 커뮤니티 게시물과 moderation 기록, integration 설정, webhook 목적지, provider 식별자 및 사용자가 제품을 통해 전송하는 파일, 스크린샷, 프롬프트, 로그, 첨부파일, 메타데이터를 처리할 수 있습니다."] },
        { title: "3. 처리 목적과 법적 근거", paragraphs: ["우리는 계정 생성 및 관리, 세션 인증, 업데이트 전달, 지원 응답, 버그 조사, 커뮤니티 영역 운영, 남용 방지, 인프라 보호, 법적 의무 이행, 약관 집행 및 보안 사건 해결을 위해 개인정보를 처리합니다.", "상황에 따라 주요 법적 근거는 계약 이행, 서비스의 보안과 신뢰성에 대한 정당한 이익, 법적 의무 준수, 그리고 bug reports, 자발적 integrations, BYOK 연결 또는 optional communications 같은 선택 기능에 대한 동의 또는 명시적 사용자 행위입니다. 사용자가 EEA, 영국, 브라질 또는 유사한 관할에 있는 경우 아래에 설명된 추가적인 법적 권리를 가질 수 있습니다."] },
        { title: "4. 공유, 국제 이전 및 제3자", paragraphs: ["우리는 서비스 운영, 사용자 지시 이행, 법 준수, 사기 방지 또는 권리 보호를 위해 필요한 경우에만 개인정보를 공유합니다. 일반적인 수신자에는 hosting 및 database providers, transactional email providers, support tools, Blogger, Imgur, Discord webhook 같은 optional integrations 및 사용자가 연결한 AI services가 포함될 수 있습니다.", "이들 제공업체는 여러 국가에서 운영될 수 있으므로 개인정보가 국외로 이전될 수 있습니다. 필요한 경우 이전과 위험에 상응하는 계약적, 조직적, 기술적 보호조치를 적용하되, 일부 제공업체는 자체 법적 프레임워크와 정책에 따라 데이터를 처리한다는 점을 전제로 합니다."] },
        { title: "5. 보관, 보안 및 미성년자", paragraphs: ["우리는 서비스 제공, 사기 방지, 보안 모니터링, 사건 분석, 법적 방어 및 규제 준수 등 이 정책에서 설명한 목적을 달성하는 데 필요한 기간 동안만 개인정보를 보관합니다. 데이터 범주별 보관기간은 다를 수 있으며, 법률상 보관이 필요한 기록은 즉시 삭제할 수 없을 수 있습니다.", "비밀번호 해싱, 세션 통제, 단기 토큰, webhook 검증, 감사 로그, 속도 제한, 접근 통제 및 보안 검토 등의 조치를 통해 무단 접근과 남용의 위험을 줄입니다. 어떤 시스템도 완전히 안전하지 않으므로 불필요한 민감정보 전송은 피해야 합니다. 이 서비스는 적용되는 디지털 동의 연령 미만의 아동을 대상으로 하지 않습니다."] },
        { title: "6. 이용자 권리와 연락 방법", paragraphs: ["적용 법률에 따라 이용자는 접근, 처리 확인, 정정, 가능한 경우 데이터 이동권, 삭제, 익명화, 이의 제기, 처리 제한, 동의 철회 및 수신자, 보관기간, 보호조치, 자동화된 결정에 관한 정보 제공을 요청할 수 있습니다. 요청 처리 전에 합리적인 신원 확인을 요구할 수 있으며, 책임성 확보를 위해 요청과 응답에 대한 최소한의 기록을 보관할 수 있습니다.", "개인정보, personal data, cookies 또는 법적 고지와 관련된 요청은 공식 지원 채널 {supportUrl}을 통해 제출해야 합니다. 가능한 경우 GDPR의 1개월 기준 기간을 포함하여 적용 법률이 요구하는 기한 내에 응답하도록 노력합니다."] },
      ],
    },
    cookies: {
      eyebrow: "쿠키 정책",
      title: "KŌMA Studio 쿠키 정책",
      summary: "KŌMA Studio가 인증, 보안 및 제품 운영을 위해 cookies, local storage 및 관련 기술을 어떻게 사용하는지 설명합니다.",
      highlights: [
        "현재 제품은 사용자 인증과 보안 유지를 위해 strictly necessary cookies와 local storage에 주로 의존합니다.",
        "데스크톱 앱은 브라우저 cookies뿐 아니라 Electron과 앱 저장소를 통해서도 일부 데이터를 로컬에 보관합니다.",
        "향후 KŌMA Studio가 analytics, 광고 또는 strictly necessary가 아닌 cookie 기반 personalization을 도입할 경우, 그 사용이 표준화되기 전에 본 정책과 관련 controls를 업데이트합니다.",
      ],
      sections: [
        { title: "1. 사용되는 기술", paragraphs: ["KŌMA Studio는 HttpOnly cookies, session cookies, browser storage, desktop app storage, remembered-email preferences, device identifiers 및 유사한 기술을 사용하여 로그인 유지, 세션 보호, 제품 상태 기억, 인증, 복구 및 업데이트 흐름을 지원할 수 있습니다."] },
        { title: "2. strictly necessary cookies", paragraphs: ["strictly necessary cookies는 인증, 세션 연속성, 사기 방지, 남용 탐지, 계정 복구, 보안 확인 및 보호 영역 접근을 위해 사용됩니다. 이러한 기술은 사용자가 요청한 서비스를 제공하기 위해 필요하며 현재 제품에서 광고 목적으로 사용되지 않습니다."], bullets: ["세션 설정 및 제어된 만료.", "로그인 및 계정 복구 중 보안·반남용 검증.", "보호된 계정 상태를 유지해야 할 때 접근의 연속성 보장."] },
        { title: "3. 로컬 저장소와 데스크톱 지속성", paragraphs: ["KŌMA Studio는 인터페이스 상태, 선택 언어, 기억된 이메일, presets, 업데이트 채널 선택 또는 워크플로 편의 설정과 같은 비민감 설정을 로컬에 저장할 수 있습니다. 기능상 필요하고 가능하다면 정보를 기기에 유지하도록 설계된 경우 integration 설정이나 token도 로컬에 저장될 수 있습니다."] },
        { title: "4. 이러한 기술의 관리", paragraphs: ["브라우저를 통해 cookies와 local storage를 삭제하거나, 옵션이 제공되는 경우 앱에서 로그아웃하고 로컬 상태를 재설정할 수 있습니다. strictly necessary 기술을 차단하거나 삭제하면 로그인, 계정 복구 또는 보호 영역의 정상 작동이 어려워질 수 있습니다."] },
      ],
    },
    content: {
      eyebrow: "사용 및 콘텐츠 정책",
      title: "KŌMA Studio 사용 및 콘텐츠 정책",
      summary: "업로드 파일, 커뮤니티 콘텐츠, bug reports, 외부 게시, moderation 및 KŌMA Studio 기능의 적법한 사용에 관한 규칙입니다.",
      highlights: [
        "필요한 권리나 법적 허가가 있는 경우에만 콘텐츠를 처리하거나 게시해야 합니다.",
        "커뮤니티 및 게시 기능은 법적 위험, 남용 또는 보안 위험이 발생하는 경우 moderation, restriction 또는 removal의 대상이 될 수 있습니다.",
        "사용자가 해당 흐름을 실행하면 bug reports 및 optional integrations가 screenshots, logs, attachments 또는 selected files를 third-party services로 전송할 수 있습니다.",
      ],
      sections: [
        { title: "1. 콘텐츠에 대한 권리와 허가", paragraphs: ["editing, OCR, translation, redraw, typesetting 및 publishing 도구는 제3자 저작물에 대한 권리를 부여하지 않습니다. 콘텐츠 사용이 자신의 관할에서 적법한지, 그리고 필요한 licenses, permissions, consents 또는 기타 legal basis를 보유하는지 확인할 책임은 전적으로 사용자에게 있습니다."] },
        { title: "2. 커뮤니티 영역과 moderation", paragraphs: ["Scanlation Feed와 같은 커뮤니티 공간에 제출된 posts, profiles, attachments, applications 및 reports는 자동화 시스템과 사람 moderators에 의해 검토될 수 있습니다. 오해의 소지가 있거나 abusive, unlawful, infringing, unsafe 또는 플랫폼 무결성과 양립하지 않는 것으로 보이는 콘텐츠는 숨김, 라벨링, 삭제, 제한 또는 상위 검토될 수 있습니다."], bullets: ["phishing, malware, spam, impersonation 또는 fraudulent recruitment offers를 게시하지 마십시오.", "법적 근거 없이 third-party personal data를 공개하지 마십시오.", "community areas를 abuse, harassment 또는 infringement를 조정하는 데 사용하지 마십시오."] },
        { title: "3. 외부 게시, AI 제공자 및 연동", paragraphs: ["Blogger, Imgur, Discord webhook, AI providers, uploads 또는 기타 외부 connectors를 사용할 때, 사용자는 요청된 작업을 완료하는 데 필요한 files, prompts, outputs, metadata 및 technical instructions를 전송하도록 KŌMA Studio에 지시하게 됩니다. 전송을 시작하기 전에 목적지, 대상 및 권한이 적절한지 확인하는 책임은 사용자에게 있습니다."] },
        { title: "4. bug reports와 진단 정보", paragraphs: ["bug report 흐름에는 현재 screenshot, attachments, selected logs, environment diagnostics, account context 및 문제 조사에 도움이 되는 technical details가 포함될 수 있습니다. 전송 전에 모든 자료를 검토하십시오. 흐름이 Discord webhook 또는 Imgur 같은 서비스를 사용하는 경우 선택된 자료가 해당 서비스로 전송되어 신고가 처리됩니다."] },
        { title: "5. 집행 조치", paragraphs: ["손해 방지, 법 준수, 남용 조사, 유효한 신고 대응, 사용자 보호 또는 서비스 무결성 유지를 위해 합리적으로 필요하다고 판단되면, 당사는 어떤 feature, file, integration 또는 account에 대한 접근도 제한, 정지, 제거 또는 종료할 수 있습니다. 반복적이거나 심각한 위반은 영구 제한으로 이어질 수 있습니다."] },
      ],
    },
  },
};
