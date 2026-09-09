// --- NETWORK & URL HELPERS ---

function resolveSafeUrl(url) {
    if (typeof url !== 'string') return url;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('ws://') || url.startsWith('wss://') || url.startsWith('data:')) {
        return url;
    }
    return url.startsWith('/') ? url : ('/' + url);
}