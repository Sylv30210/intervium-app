function encoded(value) {
    return encodeURIComponent(String(value ?? ""));
}

export function companyLogoSourceUrl() {
    return "/api/uploads/company-logo/source";
}

export function photoSourceUrl(photoId) {
    return `/api/uploads/photo/${encoded(photoId)}/source`;
}

export function signatureSourceUrl(interventionId) {
    return `/api/uploads/signature/${encoded(interventionId)}/source`;
}

export function reportSignatureSourceUrl(interventionId, sectionKey) {
    return `/api/uploads/signature-field/${encoded(interventionId)}/${encoded(sectionKey)}/source`;
}

export function userSignatureSourceUrl(userId) {
    return `/api/uploads/user-signature/${encoded(userId)}/source`;
}
