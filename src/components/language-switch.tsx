import { useEffect, useState } from "react";

export type Lang = "ar" | "en" | "fr" | "tr";

const LANGS: { code: Lang; label: string }[] = [
  { code: "ar", label: "العربية" },
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "tr", label: "TR" },
];

export function getLang(): Lang {
  if (typeof window === "undefined") return "ar";
  return (localStorage.getItem("polone_lang") as Lang) || "ar";
}

export function useLang(): Lang {
  const [lang, setLang] = useState<Lang>("ar");
  useEffect(() => {
    setLang(getLang());
    const onStorage = () => setLang(getLang());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return lang;
}

export function LanguageSwitch({ className = "" }: { className?: string }) {
  const [current, setCurrent] = useState<Lang>("ar");
  useEffect(() => { setCurrent(getLang()); }, []);

  const pick = (l: Lang) => {
    localStorage.setItem("polone_lang", l);
    document.documentElement.lang = l;
    document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
    setCurrent(l);
    window.location.reload();
  };

  return (
    <div className={`inline-flex gap-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-md p-1 ${className}`}>
      {LANGS.map(l => (
        <button
          key={l.code}
          onClick={() => pick(l.code)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition ${
            current === l.code ? "bg-white/15 text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

export const T: Record<string, Record<Lang, string>> = {
  nav_login: { ar: "دخول", en: "Login", fr: "Connexion", tr: "Giriş" },
  nav_signup: { ar: "إنشاء حساب", en: "Sign up", fr: "S'inscrire", tr: "Kayıt ol" },
  hero_badge: {
    ar: "منصة عالمية • عقود إلكترونية مربحة",
    en: "Global platform • Profitable e-contracts",
    fr: "Plateforme mondiale • Contrats électroniques rentables",
    tr: "Küresel platform • Karlı e-sözleşmeler",
  },
  hero_title_2: {
    ar: "عقود إلكترونية مربحة.",
    en: "Profitable electronic contracts.",
    fr: "Contrats électroniques rentables.",
    tr: "Karlı elektronik sözleşmeler.",
  },
  hero_desc: {
    ar: "منصة عالمية تدعم الإيداع والسحب الفوري، وتعمل مع كل المحافظ الإلكترونية، مع نظام باقات واضح وإدارة آمنة للرصيد والطلبات.",
    en: "A global platform with instant deposits & withdrawals, supporting all e-wallets, with a clear package system and secure balance management.",
    fr: "Une plateforme mondiale avec dépôts et retraits instantanés, prenant en charge tous les portefeuilles électroniques.",
    tr: "Anında para yatırma ve çekme ile tüm e-cüzdanları destekleyen küresel bir platform.",
  },
  cta_start: { ar: "ابدأ الآن", en: "Get started", fr: "Commencer", tr: "Başla" },
  cta_have: { ar: "لدي حساب", en: "I have an account", fr: "J'ai un compte", tr: "Hesabım var" },
  f1_t: { ar: "عقود إلكترونية", en: "E-contracts", fr: "Contrats électroniques", tr: "E-sözleşmeler" },
  f1_d: { ar: "باقات يومية حسب الاشتراك", en: "Daily packages by subscription", fr: "Forfaits journaliers par abonnement", tr: "Aboneliğe göre günlük paketler" },
  f2_t: { ar: "منصة عالمية", en: "Global platform", fr: "Plateforme mondiale", tr: "Küresel platform" },
  f2_d: {
    ar: "معتمدة من أكثر الشركات العالمية للربح الثابت",
    en: "Endorsed by leading global firms for stable returns",
    fr: "Recommandée par les principales entreprises mondiales pour des gains stables",
    tr: "Sabit kazanç için önde gelen küresel şirketler tarafından onaylanmıştır",
  },
  f3_t: { ar: "كل المحافظ الإلكترونية", en: "All e-wallets", fr: "Tous les portefeuilles", tr: "Tüm e-cüzdanlar" },
  f3_d: { ar: "إيداع وسحب وتحويل داخلي", en: "Deposit, withdraw & internal transfer", fr: "Dépôt, retrait et transfert", tr: "Yatırma, çekme ve transfer" },
  f4_t: { ar: "إيداع وسحب فوري", en: "Instant deposit & withdrawal", fr: "Dépôt & retrait instantanés", tr: "Anında yatırma ve çekme" },
  f4_d: { ar: "طلبات منظّمة ومراجعة آمنة", en: "Organized requests & safe review", fr: "Demandes organisées et revue sécurisée", tr: "Düzenli talepler ve güvenli inceleme" },
  packages_title: { ar: "باقات الاستثمار", en: "Investment packages", fr: "Forfaits d'investissement", tr: "Yatırım paketleri" },
  packages_sub: {
    ar: "منصة عالمية • سحب وإيداع فوري • تدعم جميع المحافظ الإلكترونية",
    en: "Global platform • Instant deposit/withdrawal • All e-wallets supported",
    fr: "Plateforme mondiale • Dépôt/retrait instantané • Tous les portefeuilles",
    tr: "Küresel platform • Anında yatırma/çekme • Tüm cüzdanlar",
  },
  pkg_daily: { ar: "يومياً", en: "daily", fr: "par jour", tr: "günlük" },
  pkg_best: { ar: "الأكثر ربحاً", en: "Top earner", fr: "Le plus rentable", tr: "En kârlı" },
  pkg_1: { ar: "الباقة 1", en: "Package 1", fr: "Forfait 1", tr: "Paket 1" },
  pkg_2: { ar: "الباقة 2", en: "Package 2", fr: "Forfait 2", tr: "Paket 2" },
  pkg_3: { ar: "الباقة 3", en: "Package 3", fr: "Forfait 3", tr: "Paket 3" },
  pkg_4: { ar: "الباقة 4", en: "Package 4", fr: "Forfait 4", tr: "Paket 4" },
};

export function t(key: keyof typeof T, lang: Lang): string {
  return T[key]?.[lang] ?? T[key]?.ar ?? key;
}
