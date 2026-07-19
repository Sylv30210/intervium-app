export const SMTP_PROVIDERS = Object.freeze({
    orange: { label: "Orange", host: "smtp.orange.fr", port: 465, security: "TLS", authRequired: true, usernameIsEmail: true, help: "Utilisez le mot de passe dédié aux logiciels et applications de messagerie créé dans Espace client Orange → Connexion et sécurité." },
    free: { label: "Free", host: "smtp.free.fr", port: 587, security: "STARTTLS", authRequired: true, usernameIsEmail: true, help: "Activez l’authentification SMTP et utilisez l’adresse Free complète." },
    sfr: { label: "SFR", host: "smtp.sfr.fr", port: 465, security: "TLS", authRequired: true, usernameIsEmail: true, help: "SFR exige TLS 1.2 ou supérieur et l’adresse complète comme identifiant." },
    ovh: { label: "OVHcloud", host: "", port: 587, security: "STARTTLS", authRequired: true, usernameIsEmail: true, help: "Recopiez le serveur SMTP affiché dans le guide de configuration de votre offre (MX Plan, Email Pro ou Exchange) dans le Manager OVHcloud." },
    infomaniak: { label: "Infomaniak", host: "mail.infomaniak.com", port: 587, security: "STARTTLS", authRequired: true, usernameIsEmail: true, help: "Utilisez l’adresse complète et le mot de passe généré pour cette adresse." },
    yahoo: { label: "Yahoo", host: "smtp.mail.yahoo.com", port: 465, security: "TLS", authRequired: true, usernameIsEmail: true, help: "Créez impérativement un mot de passe d’application Yahoo." },
    proton: { label: "Proton Mail (Business)", host: "smtp.protonmail.ch", port: 587, security: "STARTTLS", authRequired: true, usernameIsEmail: false, help: "Uniquement offre Proton payante avec domaine personnalisé : générez un jeton SMTP dans Paramètres → Tous les paramètres → IMAP/SMTP → Jetons SMTP." },
    custom: { label: "Serveur SMTP personnalisé", host: "", port: 587, security: "STARTTLS", authRequired: true, usernameIsEmail: false, help: "Demandez ces paramètres à l’administrateur de votre messagerie." },
});

export function publicSmtpProviders() {
    return Object.entries(SMTP_PROVIDERS).map(([id, value]) => ({ id, ...value }));
}
