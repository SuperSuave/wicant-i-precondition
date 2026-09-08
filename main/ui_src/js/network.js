(function () {
    function resolveSafeUrl(url) {
        if (typeof url !== 'string') return url;
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('ws://') || url.startsWith('wss://') || url.startsWith('data:')) {
            return url;
        }
        const clean = url.startsWith('/') ? url : ('/' + url);
        if (window.location.protocol === 'blob:' || window.location.protocol === 'file:' || !window.location.host) {
            const base = (window.location.origin && window.location.origin !== 'null' && window.location.origin.startsWith('http'))
                ? window.location.origin
                : 'https://wican.local';
            return base + clean;
        }
        return clean;
    }

    const origXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        const safe = resolveSafeUrl(url);
        return origXhrOpen.call(this, method, safe, ...rest);
    };

    const origFetch = window.fetch;
    window.fetch = function (input, init) {
        if (typeof input === 'string') {
            input = resolveSafeUrl(input);
        }
        return origFetch.call(this, input, init);
    };
})();