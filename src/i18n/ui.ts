export const locales = ['en', 'fr'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

// Prefix for non-default locales, matching astro.config.mjs (prefixDefaultLocale: false).
export function localePath(lang: Locale, path: string): string {
  const clean = path === '/' ? '' : path;
  return lang === defaultLocale ? `/${clean}`.replace(/\/+/g, '/') : `/${lang}${clean}`;
}

export const ui = {
  en: {
    nav: {
      services: 'Services',
      work: 'Work',
      products: 'Products',
      for: 'For You',
      pricing: 'Pricing',
      notes: 'Notes',
      contact: 'Contact',
      startProject: 'Start a project',
    },
    footer: {
      tagline:
        'Embedded, RTOS, and embedded Linux systems for UAV/UGV platforms — sensor integration, autonomy software, and security compliance.',
      navigate: 'Navigate',
      company: 'Company',
      elsewhere: 'Elsewhere',
      contact: 'Contact',
      workWithUs: 'Work With Us',
      freeConsult: 'Free Consultation',
      privacy: 'Privacy',
      rights: 'all rights reserved.',
      privacyPolicy: 'Privacy Policy',
      terms: 'Terms of Service',
      accessibility: 'Accessibility',
    },
    langSwitch: 'FR',
  },
  fr: {
    nav: {
      services: 'Services',
      work: 'Réalisations',
      products: 'Produits',
      for: 'Pour vous',
      pricing: 'Tarifs',
      notes: 'Notes',
      contact: 'Contact',
      startProject: 'Démarrer un projet',
    },
    footer: {
      tagline:
        "Systèmes embarqués, RTOS et Linux embarqué pour plateformes UAV/UGV — intégration capteurs, logiciels d'autonomie et conformité sécurité.",
      navigate: 'Navigation',
      company: 'Entreprise',
      elsewhere: 'Ailleurs',
      contact: 'Contact',
      workWithUs: 'Travailler avec nous',
      freeConsult: 'Consultation gratuite',
      privacy: 'Confidentialité',
      rights: 'tous droits réservés.',
      privacyPolicy: 'Politique de confidentialité',
      terms: "Conditions d'utilisation",
      accessibility: 'Accessibilité',
    },
    langSwitch: 'EN',
  },
} as const;

export function t(lang: Locale) {
  return ui[lang];
}
