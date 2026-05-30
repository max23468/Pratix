import { APP_VERSION } from "@/lib/version";

export const DEFAULT_DESCRIPTION =
  "Pratix è il gestionale per avvocati freelance che seguono pratiche di recupero crediti: committenti, clienti, controparti, attività e fatturazione.";
const SITE_URL = "https://pratix.vercel.app";
export const OG_IMAGE_URL = `${SITE_URL}/og-image.jpg`;
export const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Pratix",
      url: SITE_URL,
      logo: `${SITE_URL}/app-icon-512.png`,
      sameAs: [],
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: "Pratix",
      url: SITE_URL,
      description: DEFAULT_DESCRIPTION,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "it-IT",
      softwareVersion: APP_VERSION,
      publisher: {
        "@id": `${SITE_URL}/#organization`,
      },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
        category: "Fase iniziale gratuita",
      },
    },
  ],
};
