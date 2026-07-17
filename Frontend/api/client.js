export function createApiClient({ baseUrl = "/api", onUnauthorized } = {}) {
    return async function api(path, options = {}) {
        const headers = new Headers(options.headers || {});
        if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
        let response;
        try {
            response = await fetch(`${baseUrl}${path}`, { ...options, headers, credentials: "include" });
        } catch {
            throw new Error("Le serveur est inaccessible. Vérifiez qu'il est bien démarré.");
        }
        if (response.status === 401 && path !== "/auth/login") {
            onUnauthorized?.();
            throw new Error("Votre session a expiré.");
        }
        let data = null;
        if (response.status !== 204) {
            const text = await response.text();
            if (text) {
                try { data = JSON.parse(text); }
                catch { data = response.ok ? text : null; }
            }
        }
        if (!response.ok) {
            const error = new Error(data?.error || `La requête a échoué (${response.status}).`);
            error.status = response.status;
            error.code = data?.code;
            throw error;
        }
        return data;
    };
}
