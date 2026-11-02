(async () => {
    "use strict";

    const CONFIG = {
        NAME: "TOMST",
        VERSION: "v1.0.0",
        CREATOR: "Pratyush",
        THEME: "#7f1d1d",
        SUCCESS: "#EF4444",
        WARN: "#F59E0B",
        ERR: "#EF4444",
        MAX_LOG_ITEMS: 80,
    };

    const _c = CONFIG.CREATOR;
    const _sum = _c.split('').reduce((a, b) => a + b.charCodeAt(0), 0); 

    function _unlock(arr) {
        let res = '';
        for (let i = 0; i < arr.length; i++) {
            res += String.fromCharCode(arr[i] ^ _c.charCodeAt(i % _c.length));
        }
        return res;
    }

    const _guard = Symbol.for(_unlock([36, 29, 12, 7, 13, 91, 3, 17, 126, 19, 2, 0, 16, 3, 22]));
    const _LIVE_KEY = '__TOMST_LIVE__';
    if (globalThis[_LIVE_KEY]) {
        try { globalThis[_LIVE_KEY].kill(); } catch (e) {}
        globalThis[_LIVE_KEY] = null;
    }
    globalThis[_guard] = true;

    // ── live-theaming: convert hardcoded red literals to CSS variables ──
    function _themify(css) {
        const pct = (a) => Math.max(2, Math.min(100, Math.round(parseFloat(a) * 100)));
        return css
            .replace(/rgba\(\s*255,\s*45,\s*70,\s*([\d.]+)\s*\)/g, (m, a) => `color-mix(in srgb, var(--ta, #ff2d46) ${pct(a)}%, transparent)`)
            .replace(/rgba\(\s*255,\s*90,\s*110,\s*([\d.]+)\s*\)/g, (m, a) => `color-mix(in srgb, var(--tas, #ff5a6e) ${pct(a)}%, transparent)`)
            .replace(/rgba\(\s*229,\s*24,\s*58,\s*([\d.]+)\s*\)/g, (m, a) => `color-mix(in srgb, var(--ta, #e5183a) ${pct(a)}%, transparent)`)
            .replace(/#ff2d46/gi, 'var(--ta, #ff2d46)')
            .replace(/#ff5a6e/gi, 'var(--tas, #ff5a6e)')
            .replace(/#e5183a/gi, 'var(--ta, #e5183a)')
            .replace(/#c31430/gi, 'var(--ta2, #c31430)')
            .replace(/#8f1024/gi, 'var(--ta3, #8f1024)')
            .replace(/#7c0e20/gi, 'var(--ta3, #8f1024)')
            .replace(/#6e0b1a/gi, 'var(--ta3, #8f1024)')
            .replace(/#4a0c18/gi, 'var(--tad, #4a0c18)')
            .replace(/#7f1d1d/gi, 'var(--tath, #7f1d1d)')
            // accent-only gradients take their angle from --tadir so the picker can steer direction
            .replace(/linear-gradient\(\s*(\d+)deg,\s*(var\(--ta[^)]*\))\s*,\s*(var\(--ta[^)]*\))\s*\)/g,
                (m, deg, c1, c2) => `linear-gradient(var(--tadir, ${deg}deg), ${c1}, ${c2})`);
    }
    function _hexMix(hex, other, w) {
        const p = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
        const A = p(hex), B = p(other);
        return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * w).toString(16).padStart(2, '0')).join('');
    }

    // ── quest chime: synthesizes tiny WAVs in memory (no external files), one per event kind ──
    const QuestChime = (() => {
        const played = new Set();
        const cache = {};
        const SOUNDS = {
            done:  [[1046.5, 0.00, 0.14, 0.50], [1318.5, 0.10, 0.14, 0.50], [1568.0, 0.20, 0.26, 0.55]],
            claim: [[783.99, 0.00, 0.12, 0.50], [1046.5, 0.09, 0.30, 0.60]],
        };
        function encodeWav(notes) {
            const sr = 44100;
            const total = Math.ceil((Math.max(...notes.map(n => n[1] + n[2])) + 0.05) * sr);
            const mix = new Float32Array(total);
            for (const [f, t0, dur, g] of notes) {
                const s0 = Math.floor(t0 * sr), s1 = Math.min(total, Math.ceil((t0 + dur) * sr));
                for (let i = s0; i < s1; i++) {
                    const t = (i - s0) / sr;
                    const env = Math.min(1, t / 0.006) * Math.exp(-t * 6);
                    mix[i] += Math.sin(2 * Math.PI * f * t) * env * g;
                }
            }
            const pcm = new Int16Array(total);
            for (let i = 0; i < total; i++) pcm[i] = Math.round(Math.max(-1, Math.min(1, mix[i])) * 32767);
            const buf = new ArrayBuffer(44 + pcm.length * 2);
            const v = new DataView(buf);
            const wstr = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
            wstr(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); wstr(8, 'WAVE');
            wstr(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
            v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
            wstr(36, 'data'); v.setUint32(40, pcm.length * 2, true);
            new Int16Array(buf, 44).set(pcm);
            let bin = '';
            const bytes = new Uint8Array(buf);
            for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
            return 'data:audio/wav;base64,' + btoa(bin);
        }
        return {
            play(id, kind) {
                if (!RUNTIME.playSound) return;
                const key = id + '::' + kind;
                if (played.has(key)) return;
                played.add(key);
                try {
                    if (!cache[kind]) cache[kind] = encodeWav(SOUNDS[kind] || SOUNDS.done);
                    const a = new Audio(cache[kind]);
                    a.volume = 0.55;
                    a.play().catch(() => {});
                } catch (e) {}
            },
        };
    })();

    
    const _QS   = _unlock([1, 7, 4, 7, 13, 38, 7, 7, 34, 23]); 
    const _QSS  = _unlock([1, 7, 4, 7, 13, 6, 32, 28, 63, 0, 4]); 
    const _RGS  = _unlock([2, 7, 15, 26, 16, 27, 20, 47, 49, 31, 4, 39, 13, 26, 1, 13]); 
    const _EP_Q = _unlock([33, 7, 4, 7, 13, 6]); 
    const _EP_E = _unlock([53, 28, 19, 27, 21, 25]); 
    const _EP_C = _unlock([51, 30, 0, 29, 20, 88, 1, 13, 39, 19, 19, 16]); 
    const _EP_V = _unlock([38, 27, 5, 17, 22, 88, 3, 26, 63, 21, 19, 17, 10, 6]); 

    
    let _req = null;
    try {
        if (typeof webpackChunkdiscord_app !== 'undefined') {
            webpackChunkdiscord_app.push([[Symbol()], {}, (r) => { if (_req === null) _req = r; }]);
            webpackChunkdiscord_app.pop();
        }
    } catch (e) {}

    const DRIFT = _sum / 864; 
    const _verify = () => (_c.length === 8 && _sum === 864);
    

    const SEED_A = (CONFIG.CREATOR.charCodeAt(0) ^ 66) | (CONFIG.CREATOR.charCodeAt(CONFIG.CREATOR.length - 1) ^ 88);
    const SEED_B = (CONFIG.CREATOR.charCodeAt(2) ^ 76) & 7;
    const SEED_C = CONFIG.CREATOR.length & 3;
    const SEED_D = (CONFIG.CREATOR.charCodeAt(4) || 66) % 5;

    const _H = (_c.length === 8 && _sum === 864) ? (() => { let _h_ = 0; const _s_ = CONFIG.CREATOR + CONFIG.NAME + CONFIG.VERSION; for (let _i_ = 0; _i_ < _s_.length; _i_++) { _h_ = ((_h_ << 7) - _h_ + _s_.charCodeAt(_i_)) >>> 0; _h_ ^= (_h_ >>> 9); _h_ = (_h_ * 0x9e3779b9) >>> 0; } return _h_; })() : (_c.length > 0 ? null : 0);
    const _T = _H !== null ? (_H >>> 8) ^ (_H << 13) ^ (_H << 21) : _c.length;
    const _K = _H !== null ? ((_H * 0x9e3779b9) >>> 0) ^ _T : (_sum & 0xFF) + 1;
    const _seeds = [];
    for (let _si = 0; _si < 200; _si++) {
        let _sv = _si;
        const _st = String(_si) + CONFIG.CREATOR + CONFIG.NAME + CONFIG.VERSION + String(_H === null ? _si : _H);
        for (let _sj = 0; _sj < _st.length; _sj++) {
            _sv = ((_sv << 7) - _sv + _st.charCodeAt(_sj)) >>> 0;
            _sv ^= (_sv >>> 9);
            _sv = (_sv * 0x9e3779b9) >>> 0;
        }
        _seeds.push(_sv & 0xFFFF);
    }

    function mulberry32(a) {
        let _v = (_c.length === 8 && _sum === 864) ? 1 : 0;
        return function() {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            var t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            t = (t ^ ((_H & 0x7fffffff) || (_T & 0x7fffffff)));
            return (((t ^ t >>> 14) >>> 0) / 4294967296) * _v;
        };
    }
    const rng = mulberry32(_H >>> 1);

    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const rnd = (min, max) => Math.floor(rng() * (max - min + 1)) + min;
    const gaussRandom = (mean, std) => {
        let u = 1 - rng(), v = rng();
        return Math.max(0, mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v));
    };
    const lognormalRandom = (mu, sigma) => Math.exp(gaussRandom(mu, sigma));
    const randomPID = () => {
  const base = ((Date.now() >> 4) ^ Math.floor(rng() * 65535)) & 0x7FFF;
  return base === 0 ? 1 : base; // never return 0
};

    const TIMING = {
        video: { mu: (1.8 + rng() * 0.2) * DRIFT + (_seeds[100] % 100) * 0.001, sigma: 0.25 + rng() * 0.15 + (_seeds[101] % 50) * 0.001 },
        enroll: { mean: rnd(800, 1200) * DRIFT + (_seeds[102] % 30), std: rnd(200, 400) + (_seeds[103] % 10) },
        claim: { min: rnd(15000, 30000) * (DRIFT + (_K & 1) * 0.01) + (_seeds[104] % 500), max: rnd(30000, 45000) * (DRIFT + (_K >> 1 & 1) * 0.01) + (_seeds[105] % 500), extra: { prob: 0.1 + rng() * 0.1 + (_seeds[106] % 20) * 0.001, min: rnd(60000, 120000) + (_seeds[107] % 1000), max: rnd(180000, 360000) + (_seeds[108] % 2000) } },
        pause: { prob: 0.1 + rng() * 0.1 + (_seeds[110] % 20) * 0.001, mean: rnd(3000, 6000) + (_seeds[111] % 100), std: rnd(1500, 2500) + (_seeds[112] % 50) },
        abandon: { fails: rnd(2, 3) + (_seeds[115] & 1), prob: 0.6 + rng() * 0.2 + (_seeds[116] % 20) * 0.001 },
        captcha: { prob: 0.2 + rng() * 0.15 + (_seeds[118] % 20) * 0.001, delayMin: (_H & 0xFF) * rnd(60000, 90000) / 0xED + (_seeds[119] % 500), delayMax: rnd(150000, 240000) + (_seeds[120] % 1000) }
    };

    const RUNTIME = {
        running: true,
        sequenceActive: false,
        cleanups: new Set(),
        autoEnroll: true,
        autoClaim: true,
        playSound: true,
        stealthRPC: true,
        fp: true,
        tasks: new Map(),
        navPinned: false,
        lastHumanActivity: 0,
    };

    let _tomInjected = false;
    if (_tomInjected) return;
    _tomInjected = true;

    const Storage = (() => {
        const mem = new Map();
        return {
            save(k, v) { mem.set(k, v); },
            load(k) { return mem.get(k) || null; },
            remove(k) { mem.delete(k); }
        };
    })();            // ── developer discord: copy their handle ──
    const DEV_HANDLE = 'primo.cmd';
    function copyDevHandle() {
        let ok = false;
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(DEV_HANDLE)
                    .then(() => { try { Logger.log('[Discord] Copied username: ' + DEV_HANDLE, 'success'); } catch (e) {} })
                    .catch(() => {});
                ok = true;
            }
        } catch (e) {}
        if (!ok) {
            try {
                const ta = document.createElement('textarea');
                ta.value = DEV_HANDLE;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
                try { Logger.log('[Discord] Copied username: ' + DEV_HANDLE, 'success'); } catch (e) {}
            } catch (e) {}
        }
    }

    const _loadPersisted = () => {
        const s = Storage.load('settings');
        if (s) {
            if (typeof s.autoEnroll === 'boolean') RUNTIME.autoEnroll = s.autoEnroll;
            if (typeof s.autoClaim === 'boolean') RUNTIME.autoClaim = s.autoClaim;
            if (typeof s.playSound === 'boolean') RUNTIME.playSound = s.playSound;
            if (typeof s.stealthRPC === 'boolean') RUNTIME.stealthRPC = s.stealthRPC;
            if (typeof s.fp === 'boolean') RUNTIME.fp = s.fp;
            if (typeof s.hidden === 'boolean') RUNTIME.hidden = s.hidden;
            if (typeof s.navPinned === 'boolean') RUNTIME.navPinned = s.navPinned;
        }
    };
    const _saveSettings = () => Storage.save('settings', {
        autoEnroll: RUNTIME.autoEnroll,
        autoClaim: RUNTIME.autoClaim,
        playSound: RUNTIME.playSound,
        stealthRPC: RUNTIME.stealthRPC,
        fp: RUNTIME.fp,
        hidden: !!RUNTIME.hidden,
        navPinned: !!RUNTIME.navPinned,
    });

    const findTaskCfg = (c) => {
        if (!c) return null;
        const known = c.taskConfigV2 ?? c.taskConfig;
        if (known && known.tasks && Object.keys(known.tasks).length) return known;
        for (const k of Object.keys(c)) {
            const v = c[k];
            if (v && typeof v === 'object' && v.tasks && Object.keys(v.tasks).length) return v;
        }
        return null;
    };

    const EPLearn = (() => {
        let base = null;
        const known = {};
        const learn = (url) => {
            try {
                const m = String(url || '').match(/\/quests\/[^/]+\/([a-z-]+)$/);
                if (!m) return;
                const suffix = m[1];
                if (suffix === 'heartbeat' && !base) base = url.replace(/\/[^/]+\/[a-z-]+$/, '/{id}');
                known[suffix] = url.replace(/\/[^/]+\/[a-z-]+$/, '/{id}/' + suffix);
            } catch (e) {}
        };
        const resolve = (suffix, fallback) => (known[suffix] || (base ? base + '/' + suffix : null)) || fallback;
        return {
            learn,
            resolve,
            attach(api) {
                if (!api || api.__tomEP) return;
                try {
                    api.__tomEP = true;
                    const orig = api.post.bind(api);
                    api.post = async (opts) => {
                        try { if (opts && opts.url) learn(opts.url); } catch (e) {}
                        return orig(opts);
                    };
                } catch (e) {}
            }
        };
    })();

    const humanActivityListener = () => { RUNTIME.lastHumanActivity = Date.now(); };
    window.addEventListener('mousemove', humanActivityListener, { passive: true });
    window.addEventListener('keydown', humanActivityListener, { passive: true });
    // ── orb particles: glass/red fall cycle + periodic rocket launch, looping forever ──
    const OrbRain = (() => {
        let cv = null, ctx = null, raf = 0, parts = [], el = null, lastT = 0, acc = 0, rainAcc = 0;
        const ensure = () => {
            if (cv) return;
            cv = document.createElement('canvas');
            cv.id = 'tom-orb-rain';
            cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999995;display:none;';
            document.body.appendChild(cv);
            ctx = cv.getContext('2d');
            const fit = () => { if (cv) { cv.width = Math.max(1, window.innerWidth); cv.height = Math.max(1, window.innerHeight); } };
            fit();
            window.addEventListener('resize', fit);
        };
        const push = (p) => { if (parts.length < 48) parts.push(p); };
        const spawnFall = () => {
            if (!el || !el.isConnected) return;
            const r = el.getBoundingClientRect();
            if (!r.width) return;
            const kind = rng() < 0.35 ? 'glass' : 'ember';
            push({
                kind,
                x: r.left + r.width / 2 + (rng() * 2 - 1) * r.width * 0.32,
                y: r.top + r.height * (0.3 + rng() * 0.4),
                vx: (rng() * 2 - 1) * 0.25,
                vy: kind === 'glass' ? 26 + rng() * 60 : 50 + rng() * 100,
                life: 0,
                max: 1.3 + rng() * 1.6,
                size: kind === 'glass' ? 1.5 + rng() * 2.2 : 1 + rng() * 2.6,
                spin: (rng() * 2 - 1) * 3,
            });
        };
        const frame = (t) => {
            raf = requestAnimationFrame(frame);
            const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
            lastT = t;
            if (!ctx) return;
            rainAcc += dt;
            while (rainAcc > 0.18) { rainAcc -= 0.18; spawnFall(); }
            ctx.clearRect(0, 0, cv.width, cv.height);
            ctx.globalCompositeOperation = 'lighter';
            for (let i = parts.length - 1; i >= 0; i--) {
                const p = parts[i];
                p.life += dt;
                p.vy += 70 * dt;
                p.x += p.vx * dt * 60;
                p.y += p.vy * dt;
                const a = Math.max(0, 1 - p.life / p.max);
                if (a <= 0) { parts.splice(i, 1); continue; }
                if (p.kind === 'glass') {
                    const tw = 0.55 + 0.45 * Math.sin(p.life * 22 + p.spin * 7);
                    const s = p.size;
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y - s * 1.6);
                    ctx.lineTo(p.x + s, p.y);
                    ctx.lineTo(p.x, p.y + s * 1.6);
                    ctx.lineTo(p.x - s, p.y);
                    ctx.closePath();
                    ctx.fillStyle = `rgba(235,240,255,${0.28 * a * tw})`;
                    ctx.fill();
                    ctx.strokeStyle = `rgba(255,255,255,${0.5 * a * tw})`;
                    ctx.lineWidth = 0.7;
                    ctx.stroke();
                } else {
                    ctx.beginPath();
                    ctx.shadowColor = 'rgba(255,45,70,0.9)';
                    ctx.shadowBlur = 4 * a + 1;
                    ctx.fillStyle = `rgba(255,110,130,${0.55 * a})`;
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        };
        const start = (orb) => {
            if (orb) el = orb;
            ensure();
            cv.style.display = 'block';
            lastT = performance.now();
            acc = 0; rainAcc = 0;
            if (!raf) raf = requestAnimationFrame(frame);
        };
        const stop = () => {
            if (raf) { cancelAnimationFrame(raf); raf = 0; }
            if (ctx) ctx.clearRect(0, 0, cv.width, cv.height);
            if (cv) cv.style.display = 'none';
            parts = [];
        };
        return { start, stop };
    })();

    const ErrorHandler = {
        
        RETRYABLE: new Set([429, 500, 408, 502, 503, 504]),
        CLIENT: new Set([400, 403, 404, 409, 410]),
        classify(e) {
            const s = e?.status ?? e?.statusCode;
            return { retryable: this.RETRYABLE.has(s), client: this.CLIENT.has(s), status: s, msg: e?.message ?? e?.body?.message ?? `HTTP ${s}` };
        },
        isSkippable(e) { return e?.status === 404 || e?.status === 403 || e?.status === 410; }
    };

    function hookModules() {
        try {
            if (typeof webpackChunkdiscord_app === 'undefined') return null;
            let req;
            webpackChunkdiscord_app.push([[Symbol()], {}, (r) => {
                if (typeof req === 'undefined' || Object.keys(r.c).length > Object.keys(req.c).length) req = r;
            }]);
            webpackChunkdiscord_app.pop();
            if (!req) return null;
            const m = Object.values(req.c);

            const findStore = name => {
                for (const mod of m) {
                    const exp = mod?.exports;
                    if (!exp || typeof exp !== 'object') continue;
                    for (const k of Object.keys(exp)) {
                        const p = exp[k];
                        if (p && typeof p === 'object' && p.__proto__?.constructor?.displayName === name) return p;
                    }
                }
            };
            const findDispatcher = () => {
                for (const mod of m) {
                    const exp = mod?.exports;
                    if (!exp || typeof exp !== 'object') continue;
                    for (const k of Object.keys(exp)) {
                        const p = exp[k];
                        if (p && p._subscriptions && typeof p.subscribe === 'function') return p;
                    }
                }
            };
            const findAPI = () => {
                for (const mod of m) {
                    const exp = mod?.exports;
                    if (!exp || typeof exp !== 'object') continue;
                    for (const k of Object.keys(exp)) {
                        const p = exp[k];
                        if (p && typeof p.get === 'function' && typeof p.post === 'function' && typeof p.del === 'function' && !p._dispatcher) return p;
                    }
                }
            };
            
            const findRouter = () => {
                const isRouter = obj => {
                    if (!obj || typeof obj !== 'object') return false;
                    try {
                        if (typeof obj.transitionTo !== 'function') return false;
                        return typeof obj.back === 'function' || typeof obj.replace === 'function'
                            || typeof obj.go === 'function' || typeof obj.goBack === 'function'
                            || typeof obj.push === 'function';
                    } catch(e) {
                        return false;
                    }
                };
                for (const mod of m) {
                    const exp = mod?.exports;
                    if (!exp || typeof exp !== 'object') continue;
                    try { if (isRouter(exp)) return exp; } catch(e) {}
                    try { if (isRouter(exp.Z)) return exp.Z; } catch(e) {}
                    try { if (isRouter(exp.default)) return exp.default; } catch(e) {}
                    try {
                        for (const k of Object.keys(exp)) {
                            try { if (isRouter(exp[k])) return exp[k]; } catch(e) {}
                        }
                    } catch(e) {}
                }
                return null;
            };

            const Q = findStore(_QS) || findStore(_QSS);
            const R = findStore(_RGS) || findStore('RunningGameStore');
            const D = findDispatcher();
            const A = findAPI();
            const Router = findRouter();

            
            if (!Q || !R || !D || !A) {
                return { 
                    QuestStore: { quests: new Map() }, 
                    RunStore: { getRunningGames: () => [], getGameForPID: () => null }, 
                    Dispatcher: { dispatch: () => {}, subscribe: () => {}, unsubscribe: () => {} }, 
                    API: { 
                        get: async () => { await sleep(800); return { body: [] }; }, 
                        post: async () => { await sleep(1200); return { body: {} }; } 
                    }, 
                    Router 
                };
            }
            return { QuestStore: Q, RunStore: R, Dispatcher: D, API: A, Router };
        } catch (e) { return null; }
    }

    function findModsViaVencord() {
        if (typeof Vencord === 'undefined') return null;
        try {
            const w = Vencord.Webpack;
            const qStores = w.findAll(m => { try { return m?.quests instanceof Map } catch(e) { return false } });
            const rStores = w.findAll(m => { try { return typeof m.getRunningGames === 'function' && typeof m.getGameForPID === 'function' } catch(e) { return false } });
            const deps = w.findAll(m => { try { return m._subscriptions && typeof m.subscribe === 'function' && typeof m.dispatch === 'function' } catch(e) { return false } });
            const api = w.Common?.RestAPI || w.findByProps('get', 'post', 'del');
            if (!qStores.length || !deps.length) return null;
            return {
                QuestStore: qStores[0],
                RunStore: rStores[0] || { getRunningGames: () => [], getGameForPID: () => null },
                Dispatcher: deps[0],
                API: api || { get: async () => ({ body: [] }), post: async () => ({ body: {} }) },
                Router: null
            };
        } catch (e) { return null; }
    }

    const questProgressCache = { fn: null, ts: 0 };
    const claimGuard = new Map();
    const findQuestProgressFn = () => {
        const now = Date.now();
        if (questProgressCache.fn && now - questProgressCache.ts < 10 * 60 * 1000) return questProgressCache.fn;
        const pred = m => {
            try {
                const s = typeof m === 'function' ? m.toString() : '';
                return /percentComplete/.test(s) && /progressSeconds/.test(s) && /targetSeconds/.test(s) && /lastBeatAt/.test(s);
            } catch (e) { return false; }
        };
        let fn = null;
        try {
            if (typeof Vencord !== 'undefined' && Vencord.Webpack) {
                fn = Vencord.Webpack.find(pred) || null;
            }
            if (!fn && _req?.c) {
                for (const mod of Object.values(_req.c)) {
                    const m = mod?.exports;
                    const cands = [m, m?.default, m?.Z, m?.A];
                    for (const cand of cands) { if (pred(cand)) { fn = cand; break; } }
                    if (fn) break;
                }
            }
        } catch (e) {}
        questProgressCache.fn = fn; questProgressCache.ts = now;
        return fn;
    };
    const questOptimistic = (q) => {
        try {
            const B = findQuestProgressFn();
            if (B && q) {
                const r = B(q);
                if (r && typeof r.progressSeconds === 'number' && typeof r.targetSeconds === 'number') {
                    return { cur: r.progressSeconds, target: r.targetSeconds };
                }
            }
        } catch (e) {}
        return null;
    };
    const execFingerprint = (seed) => {
        try {
            const s = String(seed || '');
            let h1 = 0x811c9dc5, h2 = 0x01000193, h3 = 0x9e3779b1, h4 = 0x85ebca6b;
            for (let i = 0; i < s.length; i++) {
                const c = s.charCodeAt(i);
                h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
                h2 = Math.imul(h2 ^ c, 0x85ebca6b) >>> 0;
                h3 = Math.imul(h3 ^ c, 0xc2b2ae35) >>> 0;
                h4 = Math.imul(h4 ^ c, 0x27d4eb2f) >>> 0;
            }
            return [h1, h2, h3, h4].map(x => x.toString(16).padStart(8, '0')).join('');
        } catch (e) { return undefined; }
    };

    let Mods = findModsViaVencord() || hookModules();
    if (!Mods) { return; }
    EPLearn.attach(Mods.API);

    const isStoreStub = () => !Mods || typeof Mods.QuestStore?.getQuest !== 'function';
    const relink = () => {
        if (!isStoreStub()) return false;
        try {
            const found = findModsViaVencord() || hookModules();
            if (!found || typeof found.QuestStore?.getQuest !== 'function') return false;
            Mods = found;
            EPLearn.attach(Mods.API);
            Patcher.init(Mods.RunStore);
            hookQuestProgressManager.ensure();
            Logger.log('[System] Stores re-linked from live client.', 'success');
            return true;
        } catch (e) { return false; }
    };

    function openQuestsInternal() {
        const findQuestsBtn = () => {
            let el = document.querySelector(`a[href="/${_EP_Q}"], [data-list-item-id*="quest"]`);
            if (el) return el;
            el = document.querySelector('[aria-label*="Quest" i]');
            if (el) return el;
            for (const c of document.querySelectorAll('a, [role="listitem"], [role="treeitem"], [role="button"]')) {
                if (/^quests?$/i.test(c.textContent.trim())) return c;
            }
            return null;
        };

        const btn = findQuestsBtn();
        if (btn) { btn.click(); return; }

        const homeBtn = document.querySelector(
            'a[href="/channels/@me"], [aria-label="Direct Messages"], [aria-label="Home"], [data-list-item-id*="home"]'
        );
        if (homeBtn) {
            homeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }

        const observer = new MutationObserver(() => {
            const q = findQuestsBtn();
            if (q) { observer.disconnect(); clearTimeout(timeout); q.click(); }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        const timeout = setTimeout(() => observer.disconnect(), 8000);
    }

    const CONST = {
        ID: "1412491570820812933",
        EVT: {
            HEARTBEAT: "QUESTS_SEND_HEARTBEAT_SUCCESS",
            GAME: "RUNNING_GAMES_CHANGE",
            RPC: "LOCAL_ACTIVITY_UPDATE",
        },
    };

    const ENROLL_PATH = (SEED_A & 1) ? `/${_EP_Q}/{id}/${_EP_E}` : `/${_EP_Q}/{id}/${_EP_E}`;
    const enrollUrl = (id) => EPLearn.resolve('enroll', ENROLL_PATH).replace('{id}', id);

    const CURRENT_STATUS = () => {
        try {
            if (!_req?.c) return 'online';
            for (const mod of Object.values(_req.c)) {
                const exp = mod?.exports;
                if (!exp || typeof exp !== 'object') continue;
                for (const k of Object.keys(exp)) {
                    const p = exp[k];
                    if (p && typeof p.getStatus === 'function' && typeof p.getActivities === 'function') {
                        const s = p.getStatus();
                        if (typeof s === 'string' && s.length) return s;
                    }
                }
            }
        } catch (e) {}
        return 'online';
    };

    const GatewayRPC = (() => {
        let socket = null, settingOn = false, set = false;
        const findSocket = () => {
            if (socket && typeof socket.send === 'function') return socket;
            try {
                if (!_req?.c) return null;
                for (const mod of Object.values(_req.c)) {
                    const exp = mod?.exports;
                    if (!exp || typeof exp !== 'object') continue;
                    for (const k of Object.keys(exp)) {
                        const p = exp[k];
                        if (p && typeof p.getSocket === 'function') {
                            const s = p.getSocket();
                            if (s && typeof s.send === 'function' && s.webSocket) { socket = s; return s; }
                        }
                    }
                }
            } catch (e) {}
            return null;
        };
        const enableSharing = () => {
            if (settingOn) return;
            settingOn = true;
            try {
                if (!_req?.c) return;
                for (const mod of Object.values(_req.c)) {
                    const exp = mod?.exports;
                    if (!exp || typeof exp !== 'object') continue;
                    for (const k of Object.keys(exp)) {
                        const p = exp[k];
                        if (p && typeof p.getSetting === 'function' && typeof p.updateSetting === 'function' && p.userSettingsAPIName === 'status') {
                            try { if (!p.getSetting('showCurrentGame')) p.updateSetting('showCurrentGame', true); } catch (e) {}
                            return;
                        }
                    }
                }
            } catch (e) {}
        };
        return {
            apply(g) {
                const s = findSocket();
                if (!s) return;
                const active = !!(g && RUNTIME.stealthRPC);
                try {
                    if (active) {
                        enableSharing();
                        set = true;
                        s.send(3, { since: 0, activities: [{ application_id: String(g.id), name: String(g.name || "Game"), type: 0, flags: 1, timestamps: { start: g.start || Date.now() } }], status: CURRENT_STATUS(), afk: false });
                    } else if (set) {
                        set = false;
                        s.send(3, { since: 0, activities: [], status: CURRENT_STATUS(), afk: false });
                    }
                } catch (e) {}
            },
            findSocket,
        };
    })();

    const Patcher = (() => {
        let realGames = null, realPID = null, realPIDs = null, games = [], active = false;
        return {
            init(store) {
                if (!store) return;
                realGames = store.getRunningGames;
                realPID = store.getGameForPID;
                realPIDs = store.getGamePIDs || null;
            },
            toggle(on) {
                if (on && !active) {
                    if (Mods.RunStore) {
                        const define = (name, fn) => {
                            try {
                                Object.defineProperty(Mods.RunStore, name, { configurable: true, enumerable: false, writable: true, value: fn });
                            } catch (e) {
                                Mods.RunStore[name] = fn;
                            }
                        };
                        define('getRunningGames', function () {
                            try { return [...realGames.call(Mods.RunStore), ...games.filter(g => g.pid)]; }
                            catch (e) { return games.filter(g => g.pid); }
                        });
                        define('getGameForPID', function (pid) {
                            try { return games.find(g => g.pid === pid) || realPID.call(Mods.RunStore, pid); }
                            catch (e) { return games.find(g => g.pid === pid) || null; }
                        });
                        if (realPIDs && typeof Mods.RunStore.getGamePIDs === 'function') {
                            const base = realPIDs;
                            define('getGamePIDs', function () {
                                try { return [...base.call(Mods.RunStore), ...games.filter(g => g.pid).map(g => g.pid)]; }
                                catch (e) { return games.filter(g => g.pid).map(g => g.pid); }
                            });
                        }
                    }
                    active = true;
                } else if (!on && active) {
                    if (Mods.RunStore) {
                        try { delete Mods.RunStore.getRunningGames; } catch (e) {}
                        try { delete Mods.RunStore.getGameForPID; } catch (e) {}
                        try { delete Mods.RunStore.getGamePIDs; } catch (e) {}
                        Mods.RunStore.getRunningGames = realGames;
                        Mods.RunStore.getGameForPID = realPID;
                        if (realPIDs) Mods.RunStore.getGamePIDs = realPIDs;
                    }
                    active = false;
                }
            },
            add(g) {
                if (games.some(x => x.pid === g.pid)) return;
                games.push(g);
                this.toggle(true);
                hookQuestProgressManager.ensure();
                this.dispatch(g, []);
                this.rpc(g);
            },
            remove(g) {
                if (!games.some(x => x.pid === g.pid)) return;
                this.dispatch([], [g]);
                games = games.filter(x => x.pid !== g.pid);
                if (games.length === 0) {
                    this.toggle(false);
                    this.rpc(null);
                } else this.rpc(games[games.length - 1]);
            },
            dispatch(a, r) {
                try {
                    Mods.Dispatcher?.dispatch({
                        type: CONST.EVT.GAME,
                        added: a ? [a] : [],
                        removed: r ? [r] : [],
                        games: Mods.RunStore?.getRunningGames(),
                    });
                } catch (e) {}
            },
            rpc(g) {
                try {
                    if (!RUNTIME.stealthRPC) g = null;
                    if (g) {
                        Mods.Dispatcher?.dispatch({
                            type: CONST.EVT.RPC,
                            socketId: "TomGame",
                            pid: g.pid,
                            activity: {
                                application_id: g.id,
                                name: String(g.name || "Game"),
                                type: 0,
                                timestamps: { start: g.start }
                            },
                        });
                    }
                    GatewayRPC.apply(g);
                } catch (e) {}
            },
            clean() { games = []; this.toggle(false); this.rpc(null); },
            games() { return [...games]; },
            maintainPresence() {
                if (!active) this.rpc(null);
            },
        };
    })();
    Patcher.init(Mods.RunStore);

    const hookQuestProgressManager = (() => {
        let hooked = null, wrapped = false;
        const scan = () => {
            if (wrapped || !_req?.c) return;
            try {
                let best = null, bestScore = 0;
                for (const mod of Object.values(_req.c)) {
                    const m = mod?.exports;
                    const candidates = m && typeof m === 'object' ? [m, m.A, m.Z, m.default] : [m];
                    for (const cand of candidates) {
                        if (!cand || typeof cand.getActivelyProgressingPlayOnDesktopQuests !== 'function' || typeof cand.initiateHeartbeat !== 'function') continue;
                        let score = 0;
                        for (const kk of Object.keys(cand)) {
                            if (kk === 'heartbeats' || kk === 'terminateHeartbeat' || kk === 'calculateHeartbeatDurationMs' || kk === 'handleSendHeartbeatSuccess' || kk === 'handleSendHeartbeatFailure') score += 2;
                            else if (kk.toLowerCase().includes('heartbeat')) score += 1;
                        }
                        if (score > bestScore) { bestScore = score; best = cand; }
                    }
                }
                hooked = best;
            } catch (e) {}
            wrap();
        };
        const wrap = () => {
            if (!hooked || wrapped) return;
            try {
                const orig = hooked.getActivelyProgressingPlayOnDesktopQuests;
                hooked.getActivelyProgressingPlayOnDesktopQuests = function () {
                    let base;
                    try { base = orig.call(this) || new Map(); } catch (e) { base = new Map(); }
                    try {
                        const qs = Mods.QuestStore?.quests;
                        const qList = qs instanceof Map ? [...qs.values()] : (qs ? Object.values(qs) : []);
                        for (const g of Patcher.games()) {
                            for (const q of qList) {
                                if (!q?.userStatus?.enrolledAt || q?.userStatus?.completedAt) continue;
const cfg = findTaskCfg(q.config);
                        const tasks = cfg?.tasks ?? {};
                                for (const tk of Object.keys(tasks)) {
                                    if (!tk.includes('PLAY')) continue;
                                    const apps = (tasks[tk]?.applications || []).map(a => String(a?.id));
                                    if (apps.length && apps.includes(String(g.id))) {
                                        base.set(q.id, {
                                            applicationId: g.id,
                                            executablePath: String(g.exePath || '').split(/[\\/]/).slice(-2).join('/'),
                                            executableFingerprint: g.executableFingerprint,
                                        });
                                    }
                                }
                            }
                        }
                    } catch (e) {}
                    return base;
                };
                wrapped = true;
            } catch (e) {}
        };
        return { ensure: scan, get wrapped() { return wrapped; } };
    })();
    hookQuestProgressManager.ensure();

    const ClientHealth = (() => {
        const report = () => {
            const layers = {
                Webpack: !!(typeof _req !== 'undefined' && _req?.c && Object.keys(_req.c).length),
                QuestStore: !!(Mods.QuestStore && Mods.QuestStore.quests),
                RunStore: !!(Mods.RunStore && typeof Mods.RunStore.getRunningGames === 'function'),
                API: !!(Mods.API && typeof Mods.API.post === 'function'),
                Dispatcher: !!(Mods.Dispatcher && typeof Mods.Dispatcher.dispatch === 'function'),
                Manager: !!hookQuestProgressManager.wrapped,
                Gateway: !!GatewayRPC.findSocket(),
                Transport: (() => {
                    try {
                        const s = String(window.fetch || '');
                        return s.includes('[native code]') && !window.fetch.__sentry_original__ ? 'native' : 'wrapped';
                    } catch (e) { return 'unknown'; }
                })(),
            };
            return layers;
        };
        return { report };
    })();
    ClientHealth.report();

    const Traffic = {
        queue: [], processing: false,
        async enqueue(url, body) {
            if (!RUNTIME.running) throw new Error('stopped');
            return new Promise((resolve, reject) => {
                this.queue.push({ url, body, resolve, reject, attempts: 0 });
                this.process();
            });
        },
        async process() {
            if (this.processing || !this.queue.length) return;
            this.processing = true;
            while (this.queue.length && RUNTIME.running) {
                if (!RUNTIME.sequenceActive) {
    const drained = this.queue.splice(0);
    const err = Object.assign(new Error('sequence stopped'), { status: 499 });
    drained.forEach(r => r.reject(err));
    break;
}
                const req = this.queue.shift();
                try {
                    req.resolve(await Mods.API.post({ url: req.url, body: req.body }));
                } catch (e) {
                    const err = ErrorHandler.classify(e);
                    if (err.retryable && req.attempts < (3 - SEED_C)) {
                        req.attempts++;
                        const delay = (e.body?.retry_after ?? Math.pow(2, req.attempts)) * 1000 + rnd(200, 800);
                        setTimeout(() => { if (RUNTIME.running) this.queue.push(req); }, delay);
                    } else req.reject(e);
                }
                await sleep(Math.min(4000, Math.max(800, gaussRandom(1550, 450))));
            }
            this.processing = false;
        },
    };

    const Tasks = {
        skipped: new Set(),
        claimed: new Set(),
        finalized: new Set(),
        sanitize(n) { return n.replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, " "); },
        detectType(cfg, appId) {
            const k = Object.keys(cfg.tasks);
            for (const { key, type } of [
                { key: "PLAY", type: "GAME" }, { key: "VIDEO", type: "WATCH_VIDEO" },
                { key: "STREAM", type: "STREAM" }, { key: "ACHIEVEMENT", type: "ACHIEVEMENT" },
                { key: "ACTIVITY", type: "ACTIVITY" }
            ]) {
                const kn = k.find(x => x.includes(key));
                if (kn) return { type, keyName: kn, target: cfg.tasks[kn]?.target ?? 0, apps: (cfg.tasks[kn]?.applications || []).map(a => a?.id).filter(Boolean) };
            }
            if (appId) return { type: "GAME", keyName: "PLAY_ON_DESKTOP", target: cfg.tasks[k[0]]?.target ?? 0, apps: [appId] };
            return null;
        },
        async fetchGame(appId, name) {
            try {
                const res = await Mods.API.get({ url: `/applications/public?application_ids=${appId}` });
                const d = res?.body?.[0];
                if (!d) throw new Error('No application data');
                const exe = d?.executables?.find(x => x.os === "win32")?.name?.replace(">", "") || this.sanitize(name) + '.exe';
                const pathByte = (SEED_A % 26) + 97;
                const exeName = exe.replace(/\.exe$/, String.fromCharCode(pathByte) + '.exe');
                return { name: d?.name || name, exe: exeName, cmd: `C:\\Program Files\\${this.sanitize(name)}\\${exeName}`, path: `c:/program files/${this.sanitize(name).toLowerCase()}/${exeName}`, id: appId };
            } catch (e) {
                const exe = this.sanitize(name) + '.exe';
                return { name, exe, cmd: `C:\\Games\\${exe}`, path: `c:/games/${exe.toLowerCase()}`, id: appId };
            }
        },
        async claimReward(id) {
            const qs = Mods.QuestStore?.quests;
            const q = qs instanceof Map ? qs.get(id) : null;
            const us = q?.userStatus;
            if (us?.claimedAt) {
                Tasks.claimed.add(id);
                return { body: { claimed_at: us.claimedAt } };
            }
            if (us && !us?.completedAt && !us?.completed_at) {
                const err = new Error('Quest not claimable yet');
                err.status = 410;
                throw err;
            }
            const cg = claimGuard.get(id);
            if (cg && Date.now() - cg.t < 30000) {
                const err = new Error('Claim attempt throttled');
                err.status = 410;
                throw err;
            }
            if (cg && cg.n >= 5) {
                const err = new Error('Claim attempts exhausted');
                err.status = 410;
                throw err;
            }
            claimGuard.set(id, { n: (cg?.n || 0) + 1, t: Date.now() });
            const url = EPLearn.resolve('claim-reward', `/${_EP_Q}/{id}/${_EP_C}`).replace('{id}', id);
            return await Traffic.enqueue(url, { platform: 0, location: 11, is_targeted: false, metadata_raw: null, metadata_sealed: null, traffic_metadata_raw: null, traffic_metadata_sealed: q?.trafficMetadataSealed ?? null });
        },
        async enrollQuest(q) {
            return await Traffic.enqueue(enrollUrl(q.id), { location: 11, is_targeted: false, metadata_sealed: q?.metadataSealed ?? null, traffic_metadata_sealed: q?.trafficMetadataSealed ?? null });
        },
        failTask(q, t, reason) {
            const cur = Logger.tasks.get(q.id)?.cur ?? 0;
            Logger.updateTask(q.id, { name: t.name, type: t.type, cur, max: t.target, status: "FAILED", error: reason });
            Logger.log(`[Protocol] Aborted "${t.name}": ${reason}`, 'err');
            Tasks.skipped.add(q.id);
            setTimeout(() => Logger.removeTask(q.id), 6000);
        },
        async VIDEO(q, t, s) {
            let cur = s?.progress?.[t.keyName]?.value ?? s?.progress?.WATCH_VIDEO?.value ?? 0;
            let fails = 0;
            const optInit = questOptimistic(q);
            const initCur = Math.max(cur, optInit && typeof optInit.cur === 'number' ? optInit.cur : 0);
            Logger.updateTask(q.id, { name: t.name, type: "VIDEO", cur: initCur, max: optInit && optInit.target ? optInit.target : t.target, status: "RUNNING" });
            if (s?.completedAt || s?.completed_at) {
                Logger.log(`[Video] Quest already completed server-side.`, 'warn');
                return Tasks.finish(q, t);
            }
            const st = Date.now();
            await sleep(gaussRandom(400, 180));
            if (rng() < 0.15) await sleep(rnd(800, 2500));
            let r0;
            try {
                r0 = await Traffic.enqueue(EPLearn.resolve('video-progress', `/${_EP_Q}/{id}/${_EP_V}`).replace('{id}', q.id), { timestamp: Math.max(0.2, cur) });
                if (r0?.body?.completed_at) return Tasks.finish(q, t);
            } catch (e) {}

            const videoTarget = t.target + (SEED_A & 1) + (SEED_B & 1);
            while (cur < videoTarget && RUNTIME.running && RUNTIME.sequenceActive) {
                if (rng() < TIMING.pause.prob) {
                    const p = gaussRandom(TIMING.pause.mean, TIMING.pause.std);
                    Logger.log(`[Video] Pausing ~${Math.round(p/1000)}s`, 'warn');
                    const ps = Date.now();
                    while (Date.now() - ps < p && RUNTIME.running && RUNTIME.sequenceActive) { await sleep(1000); }
                }
                if (!RUNTIME.sequenceActive) break;
                const delta = lognormalRandom(TIMING.video.mu, TIMING.video.sigma) * 1000;
                await sleep(delta);
                if (!RUNTIME.sequenceActive) break;
                const newCur = cur + delta / 1000;
                try {
                    const r = await Traffic.enqueue(EPLearn.resolve('video-progress', `/${_EP_Q}/{id}/${_EP_V}`).replace('{id}', q.id), { timestamp: Number(Math.min(t.target, newCur).toFixed(6)) });
                    const apiVal = r?.body?.progress?.[t.keyName]?.value ?? r?.body?.progress?.WATCH_VIDEO?.value;
                    if (apiVal === undefined) throw new Error('API unreachable');
                    cur = apiVal;
                    if (r?.body?.completed_at) break;
                    fails = 0;
                } catch (e) {
                    fails++;
                    if (fails >= TIMING.abandon.fails && rng() < TIMING.abandon.prob) {
                        return this.failTask(q, t, 'User gave up');
                    }
                    await sleep(gaussRandom(5000, 2000));
                }
                const optLoop = questOptimistic(q);
                const shownCur = Math.min(t.target, Math.max(cur, optLoop && typeof optLoop.cur === 'number' ? optLoop.cur : 0));
                Logger.updateTask(q.id, { name: t.name, type: "VIDEO", cur: shownCur, max: optLoop && optLoop.target ? optLoop.target : t.target, status: "RUNNING" });
                if (Date.now() - st > 25 * 60 * 1000) return this.failTask(q, t, 'Timeout');
            }
            if (RUNTIME.running && RUNTIME.sequenceActive) this.finish(q, t);
        },
        generic(q, t, type, key, s) {
            return new Promise(async (resolve) => {
                if (!RUNTIME.running || !RUNTIME.sequenceActive) return resolve();
                const gd = await this.fetchGame(t.appId, t.name);
                const pid = randomPID();
                const game = {
                    id: gd.id, name: gd.name,
                    pid, pidPath: [pid], processName: gd.name,
                    start: Date.now(), exeName: gd.exe, exePath: gd.path, cmdLine: gd.cmd,
                    executableFingerprint: RUNTIME.fp ? execFingerprint(gd.path + '|' + gd.id) : undefined,
                    isLauncher: false, distributor: null,
                };

                let clHook, finished = false, timeout;
                let finish = () => {
                    if (finished) return;
                    finished = true;
                    clearTimeout(timeout);
                    try { clHook?.(); } catch (e) {}
                    RUNTIME.cleanups.delete(finish);
                };

                try {
                    if (type === "STREAM") {
                        const rl = Mods.StreamStore?.getStreamerActiveStreamMetadata;
                        if (Mods.StreamStore) Mods.StreamStore.getStreamerActiveStreamMetadata = () => { try { return { id: gd.id, pid, sourceName: gd.name }; } catch (e) { return null; } };
                        clHook = () => { try { if (Mods.StreamStore && rl) Mods.StreamStore.getStreamerActiveStreamMetadata = rl; } catch (e) {} };
                    } else {
                        Patcher.add(game);
                        clHook = () => Patcher.remove(game);
                    }
                } catch (e) {}

                Logger.updateTask(q.id, { name: t.name, type, cur: 0, max: t.target, status: "RUNNING" });
                Logger.log(`[Protocol] Injecting: ${gd.name}`, 'info');

                timeout = setTimeout(() => {
                    if (RUNTIME.running && RUNTIME.sequenceActive) {
                        if (pid) this.failTask(q, t, 'Timeout');
                    }
                    finish(); resolve();
                }, 25 * 60 * 1000);

                const gameTarget = t.target + (SEED_A & 1) + (SEED_D & 1);

                const scheduleSync = () => {
                    if (!RUNTIME.running || !RUNTIME.sequenceActive) return;
                    setTimeout(() => {
                        if (!RUNTIME.running || !RUNTIME.sequenceActive) {
                            finish();
                            return resolve();
                        }
                        const qs = Mods.QuestStore.quests;
                        const qList = qs instanceof Map ? [...qs.values()] : Object.values(qs);
                        const liveQ = qList.find(x => x.id === q.id);
                        if (liveQ) {
                            const serverP = liveQ.userStatus?.progress?.[key]?.value ?? 0;
                            let realP = serverP;
                            const opt = questOptimistic(liveQ);
                            if (opt && typeof opt.cur === 'number' && opt.cur > realP) realP = opt.cur;
                            if (realP > t.target) realP = t.target;
                            Logger.updateTask(q.id, { name: t.name, type, cur: realP, max: t.target, status: "RUNNING" });
                            if ((liveQ.userStatus?.completedAt || serverP >= t.target) && pid) {
                                finish();
                                Tasks.finish(q, t);
                                resolve();
                                return;
                            }
                            hookQuestProgressManager.ensure();
                        }
                        scheduleSync();
                    }, rnd(700, 1400));
                };
                scheduleSync();

                const oldFinish = finish;
                finish = () => {
                    oldFinish();
                };
                RUNTIME.cleanups.add(finish);
            });
        },
        async finish(q, t) {
            if (Tasks.finalized.has(q.id)) return;
            Tasks.finalized.add(q.id);
            Logger.updateTask(q.id, { name: t.name, type: t.type, cur: t.target, max: t.target, status: "COMPLETED" });
            Logger.log(`[Protocol] Complete: "${t.name}"`, 'success');
            QuestChime.play(q.id, 'done');
            Logger.updateTask(q.id, { claimable: true, questId: q.id });
            if (!RUNTIME.autoClaim) {
                return;
            }
            let delay = Math.max(TIMING.claim.min, Math.min(TIMING.claim.max, gaussRandom((TIMING.claim.min + TIMING.claim.max) / 2, (TIMING.claim.max - TIMING.claim.min) / 4)));
            if (rng() < TIMING.claim.extra.prob) delay = rnd(TIMING.claim.extra.min, TIMING.claim.extra.max);
            await sleep(delay);
            if (!RUNTIME.running || !RUNTIME.sequenceActive) return;
            if (Tasks.claimed.has(q.id)) return;
            let res;
            try {
                res = await this.claimReward(q.id);
            } catch (e) {
                const qs2 = Mods.QuestStore?.quests;
                const q2 = qs2 instanceof Map ? qs2.get(q.id) : null;
                if (q2?.userStatus?.claimedAt) {
                    Tasks.claimed.add(q.id);
                    Logger.log(`[Claim] Reward already secured.`, 'success');
                    QuestChime.play(q.id, 'claim');
                    Logger.updateTask(q.id, { status: "CLAIMED" });
                    setTimeout(() => Logger.removeTask(q.id), 3000);
                    return;
                }
                Logger.log(`[Claim] Verification needed. Open Quests menu.`, 'warn');
                Logger.updateTask(q.id, { claimable: false, actionRequired: 'CLAIM_MANUAL', error: 'Action required to claim reward (Captcha).' });
                return;
            }
            if (res?.body?.claimed_at) {
                Tasks.claimed.add(q.id);
                Logger.log(`[Claim] Reward secured.`, 'success');
                QuestChime.play(q.id, 'claim');
                Logger.updateTask(q.id, { status: "CLAIMED" });
                setTimeout(() => Logger.removeTask(q.id), 3000);
                return;
            }
            Logger.log(`[Claim] Verification needed. Open Quests menu.`, 'warn');
            Logger.updateTask(q.id, { claimable: false, actionRequired: 'CLAIM_MANUAL', error: 'Action required to claim reward (Captcha).' });
        },
    };

    
    const Logger = (() => {
        let host, shadowRoot, root, boot, isBooted = false;
        let orbEl = null;
        const tasks = RUNTIME.tasks;

        const Spark = { fire: (fromEl, toEl, onLand) => { if (onLand) { try { onLand(); } catch (e) {} } }, cancel: () => {} };

        function init(onStartSequence) {
            const old = RUNTIME.hostId ? document.getElementById(RUNTIME.hostId) : null;
            if (old && old.parentNode) old.remove();

            host = document.createElement('div');
            host.id = `${CONFIG.NAME.toLowerCase().slice(0,2)}_${randomPID().toString(36)}`;
            RUNTIME.hostId = host.id; 
            document.body.appendChild(host);
            shadowRoot = host.attachShadow({ mode: 'closed' });

            const style = document.createElement('style');
            style.innerHTML = `
#tom-ui {
    --bg-base: #0c0508; --bg-surface: #150709; --bg-elevated: #1d0a0e; --bg-card: #16070b;
    --border: #2b1018; --border-soft: #241016;
    --text-primary: #f5e9ec; --text-muted: #b08d97; --text-dim: #79565f;
    --accent: #ff2d46; --accent-soft: #ff5a6e; --accent-dim: #2a0a12; --accent-deep: #4a0c18;
    --ok: #22c55e; --warn: #f0b429; --info: #60a5fa; --violet: #a78bfa; --slate: #5b6270;
    position: fixed; top: 16px; left: 16px; width: 900px; height: 660px; max-height: 94vh; max-width: 96vw;
    background: radial-gradient(1200px 600px at -180px -80px, rgba(255,45,70,0.10), transparent 60%), var(--bg-base);
    color: var(--text-primary); border: 1px solid var(--accent-deep); border-radius:18px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.65), 0 0 40px rgba(255,45,70,0.06), 0 0 0 1px rgba(255,45,70,0.08);
    display: flex; flex-direction: column; overflow: hidden;
    font-family: Segoe UI, system-ui, sans-serif;
    z-index: 999999; box-sizing: border-box; }
button, input { font-family: inherit; }
#tom-ui, #tom-ui * { transition: background-color 0.25s ease, background 0.25s ease, color 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease; }
#tom-ui.no-fx * { animation: none !important; }
@media (prefers-reduced-motion: reduce) { #tom-ui *, #tom-orb::before, #tom-orb-rain { animation: none !important; transition-duration: 0.01s !important; } }
#tom-ui.light {
    --bg-base: #f7faf8; --bg-surface: #ffffff; --bg-elevated: #ffffff; --bg-card: #ffffff;
    --border: #cfe0d4; --border-soft: #e3efe7;
    --text-primary: #12291b; --text-muted: #52705d; --text-dim: #8aa695;
    --accent: #16a34a; --accent-soft: #3fbf74; --accent-dim: #e3f4e9; --accent-deep: #157a3d;
    background: radial-gradient(1200px 600px at -180px -80px, rgba(22,163,74,0.09), transparent 60%), #f7faf8;
}
#tom-ui.light ::-webkit-scrollbar-thumb { background:#cde0d3 !important; }
#tom-ui.light .toggle-slider { background-color:#e2efe6; }
#tom-ui.light .task-progress-bar { background:#e2efe6; }
#tom-ui.light .stat-card:hover, #tom-ui.light .task-row:hover { border-color:#bcd5c3; }
#tom-ui.light .hero { background:linear-gradient(100deg, #cdeeda 0%, #f4fbf6 52%, #c2e8d1 100%); border-color:#bcd5c3; box-shadow:0 10px 30px rgba(22,163,74,0.14), inset 0 0 46px rgba(22,163,74,0.07); }
#tom-ui.light .hero .hero-peak path:first-of-type { fill:#b3d8c1; }
#tom-ui.light .hero .hero-peak path:last-of-type { fill:#9cc9ac; opacity:0.9; }
#tom-ui.light .hero .hero-torii path, #tom-ui.light .hero .hero-torii rect { fill:#7aa98a; }
#tom-ui.light .hero .hero-moon { background:radial-gradient(circle at 38% 34%, #f0fdf3 0%, #a9ecc0 45%, #5cd689 78%, #2fae5f 100%); box-shadow:0 0 34px 10px rgba(90,200,130,0.4), inset -8px -10px 20px rgba(240,253,243,0.85); }
#tom-ui.light .hero .hero-spark { background:#35a564; }
#tom-ui.light .hero-title { color:#0f3d21; }
#tom-ui.light .side-nav.open .nav-item { background:#ffffff; border-color:#e3efe7; color:#52705d; box-shadow:0 2px 8px rgba(22,163,74,0.09); }
#tom-ui.light .side-nav.open .nav-item:hover { background:#f0f8f3; border-color:#a8d4b6; color:#12291b; }
#tom-ui.light .side-nav.open .sn-brand { color:#52705d; }
#tom-ui.light .hero-btn, #tom-ui.light .task-join-btn { background:linear-gradient(140deg,#22b45c,#0f7a3e); border-color:rgba(63,191,116,0.55); box-shadow:0 6px 16px rgba(34,180,92,0.3); }
#tom-ui.light .task-progress-fill { background:linear-gradient(90deg,#5cd689,#22b45c); box-shadow:0 0 10px rgba(34,180,92,0.55); }
#tom-ui.light .bar-3d { background:linear-gradient(180deg,#5cd689,#157a3d); }
#tom-ui.light .tb-hide { border-color:rgba(63,191,116,0.55); background:linear-gradient(140deg, rgba(34,180,92,0.14), rgba(15,122,62,0.18)); color:#2c8c55; }
#tom-ui.light .tb-avatar-ico { background:linear-gradient(145deg,#1c3326,#0e1a12); }
#tom-ui.light .toggle-slider:before { background-color:#4c8a63; }            #tom-ui.light .sn-pin { background:#ffffff; border-color:rgba(22,163,74,0.45); box-shadow:0 8px 22px rgba(34,180,92,0.25); color:#2c8c55; }
            #tom-ui.light .sn-pin:hover { background:#eefaf2; color:#123020; }
            #tom-ui.light .tb-close { border-color:rgba(199,58,80,0.45); background:linear-gradient(140deg,#e04b62,#a32b41); }
            #tom-ui.light .task-error-msg { color:#b3344a; border-color:rgba(226,74,104,0.4); background:rgba(226,74,104,0.07); }
            #tom-ui.light .btn-stop-seq { background:linear-gradient(140deg,#e04b62,#a32b41); box-shadow:0 4px 12px rgba(226,74,104,0.35); }
            #tom-ui.light ::selection { background:rgba(34,180,92,0.25); }
            #tom-ui.light .nav-item.active, #tom-ui.light .side-nav.open .nav-item.active { background:linear-gradient(140deg,#22b45c,#0f7a3e); border-color:rgba(63,191,116,0.55); box-shadow:0 6px 18px rgba(34,180,92,0.35), inset 0 1px 0 rgba(255,255,255,0.2); }
            #tom-ui.light .stat-card:nth-of-type(1) { background:linear-gradient(140deg,#0f9d58,#0a713f); border-color:#0a713f; box-shadow:0 10px 26px rgba(15,157,88,0.35); }
            #tom-ui.light .stat-card:nth-of-type(1) .stat-label, #tom-ui.light .stat-card:nth-of-type(1) .stat-val, #tom-ui.light .stat-card:nth-of-type(1) .stat-delta.up { color:#ffffff; }
            #tom-ui.light .stat-card:nth-of-type(1) .stat-icon { background:rgba(255,255,255,0.18); color:#ffffff; border:1px solid rgba(255,255,255,0.4); }
            #tom-ui.light .stat-card:nth-of-type(1) .spark path { stroke:rgba(255,255,255,0.85); }
            #tom-ui.light .stat-delta.up { color:#2c8c55; }
            #tom-ui.light .btn-start-quests { background:linear-gradient(140deg,#0f9d58,#0a713f); border-color:rgba(63,191,116,0.55); box-shadow:0 8px 24px rgba(15,157,88,0.30); }
#tom-orb { display:none; width:68px; height:68px; border-radius:50%; background:radial-gradient(circle at 50% 34%, #33141c 0%, #140810 55%, #070305 100%); position:absolute; inset:0;
    align-items:center; justify-content:center; color:#fff;
    cursor:pointer; z-index:1001; }
#tom-orb::before { content:''; position:absolute; inset:-2px; border-radius:50%; border:1.5px solid rgba(255,95,115,0.6); box-shadow:0 0 18px rgba(229,24,58,0.55), inset 0 0 10px rgba(229,24,58,0.35); pointer-events:none; z-index:3; animation:orbBreath 3.2s ease-in-out infinite; }
#tom-orb::after { content:''; position:absolute; inset:-6px; border-radius:50%; background:radial-gradient(circle, rgba(229,24,58,0.16) 0%, transparent 70%); z-index:0; }
#tom-orb:hover { transform:scale(1.06); }
#tom-orb:hover::before { border-color:rgba(255,140,155,0.85); box-shadow:0 0 26px rgba(229,24,58,0.8), inset 0 0 14px rgba(229,24,58,0.5); }
#tom-orb .tom-logo-img { z-index:2; filter:drop-shadow(0 0 7px rgba(229,24,58,0.65)); transition:transform 0.18s ease; }
#tom-orb:hover .tom-logo-img { transform:scale(1.05); }
@keyframes orbBreath { 0%,100% { opacity:0.72; transform:scale(0.975); } 50% { opacity:1; transform:scale(1.02); } }
#tom-ui.orb-mode { width:68px !important; height:68px !important; min-height:68px !important; min-width:68px !important; border-radius:50% !important; background:transparent !important; box-shadow:none !important; border:none !important; overflow:visible !important; }
#tom-ui.orb-mode .internal-wrapper, #tom-ui.orb-mode .dash-layer, #tom-ui.orb-mode .settings-overlay, #tom-ui.orb-mode .about-overlay { display:none !important; }
#tom-ui.orb-mode #tom-orb { display:flex !important; }
.internal-wrapper { position:relative; width:100%; height:100%; }
.boot-layer { position:absolute; inset:0; z-index:10; background:radial-gradient(900px 500px at 78% 16%, rgba(229,24,58,0.10), transparent 55%), radial-gradient(760px 440px at 50% 115%, rgba(140,12,30,0.22), transparent 62%), #090305; overflow:hidden; display:flex; align-items:center; justify-content:center; transition:opacity 0.5s ease; }
.boot-layer.dived { opacity:0; pointer-events:none; }
.boot-art { position:absolute; inset:0; }
.boot-art .hero-moon { width:340px; height:340px; top:-70px; right:-60px; }
.boot-stars { position:absolute; inset:0; pointer-events:none; }
.boot-stars i { position:absolute; display:block; width:2px; height:2px; border-radius:50%; background:rgba(255,215,224,0.85); box-shadow:0 0 6px rgba(255,45,70,0.8); animation:bootTwinkle 3.4s ease-in-out infinite; }
@keyframes bootTwinkle { 0%,100% { opacity:0.12; transform:translateY(0); } 50% { opacity:0.95; transform:translateY(-4px); } }
.boot-haze { position:absolute; inset:0; background:radial-gradient(560px 280px at 50% 66%, rgba(255,45,70,0.08), transparent 72%); pointer-events:none; }
.boot-content { position:relative; z-index:2; text-align:center; width:440px; max-width:94%; padding:44px 40px 40px; border-radius:32px; background:linear-gradient(165deg, rgba(34,9,15,0.66), rgba(10,3,6,0.88)); backdrop-filter:blur(10px); box-shadow:0 30px 80px rgba(0,0,0,0.7), 0 0 70px rgba(229,24,58,0.10), inset 0 1px 0 rgba(255,255,255,0.07); }
.boot-content::before { content:''; position:absolute; inset:0; border-radius:32px; padding:1px; background:linear-gradient(160deg, rgba(255,90,110,0.6), rgba(229,24,58,0.10) 38%, rgba(229,24,58,0.08) 62%, rgba(255,120,140,0.45)); -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite:xor; mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite:exclude; pointer-events:none; }
.boot-sheen { position:absolute; inset:0; border-radius:32px; overflow:hidden; pointer-events:none; }
.boot-sheen::before { content:''; position:absolute; top:-70%; left:-40%; width:38%; height:240%; background:linear-gradient(100deg, transparent, rgba(255,255,255,0.055), transparent); transform:rotate(6deg); animation:bootSweep 6s ease-in-out infinite; }
@keyframes bootSweep { 0% { left:-45%; } 55% { left:118%; } 100% { left:118%; } }
.boot-content > * { animation:bootRise 0.75s cubic-bezier(.2,.7,.3,1) both; }
@keyframes bootRise { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
.boot-logo { position:relative; z-index:1; width:64px; height:64px; margin:0 auto 20px; border-radius:28px; background:#070204; border:1px solid rgba(229,24,58,0.5); display:flex; align-items:center; justify-content:center; box-shadow:0 10px 26px rgba(229,24,58,0.45), inset 0 0 18px rgba(255,45,70,0.15); animation-duration:0.75s; animation-delay:0.03s; }
.boot-title { margin:0 0 8px 0; color:var(--text-dim); font-size:12px; font-weight:700; letter-spacing:4px; text-transform:uppercase; animation-delay:0.12s; }
.boot-title strong { display:block; font-size:44px; font-weight:800; color:#fff; letter-spacing:2px; line-height:1.05; text-shadow:0 0 26px rgba(255,45,70,0.35); margin-bottom:6px; }
.boot-lofi { font-size:10.5px; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:3.6px; animation-delay:0.2s; }
.boot-divider { display:flex; align-items:center; gap:10px; margin:18px 6px 16px; animation-delay:0.26s; }
.boot-divider i { flex:1; height:1px; background:linear-gradient(90deg, transparent, rgba(255,90,110,0.45)); }
.boot-divider i:last-child { background:linear-gradient(90deg, rgba(255,90,110,0.45), transparent); }
.boot-divider b { flex:none; width:5px; height:5px; border-radius:50%; background:var(--accent-soft); box-shadow:0 0 10px rgba(255,45,70,0.9); }
.boot-ver { font-size:12px; font-weight:700; color:var(--accent-soft); letter-spacing:0.8px; animation-delay:0.32s; }
.boot-ver b { color:#fff; font-weight:700; }
.boot-warn { max-width:300px; margin:16px auto 28px; font-size:12.5px; font-weight:500; color:var(--text-muted); line-height:1.6; animation-delay:0.4s; }
.boot-action { position:relative; z-index:1; display:inline-block; background:linear-gradient(140deg,#ff2d46,#c31430); color:#fff; font-size:13px; font-weight:800; padding:15px 36px; border-radius:18px; border:1px solid rgba(255,90,110,0.55); cursor:pointer; letter-spacing:2px; box-shadow:0 12px 32px rgba(255,45,70,0.4), inset 0 1px 0 rgba(255,255,255,0.25); transition:transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease; overflow:hidden; animation-duration:0.75s; animation-delay:0.48s; }
.boot-action:hover { filter:brightness(1.1); transform:translateY(-2px); box-shadow:0 16px 40px rgba(255,45,70,0.55), inset 0 1px 0 rgba(255,255,255,0.25); }
.boot-action::after { content:''; position:absolute; top:0; left:-80%; width:45%; height:100%; background:linear-gradient(100deg, transparent, rgba(255,255,255,0.35), transparent); transform:skewX(-20deg); animation:bootBtn 3.4s ease-in-out 1.6s infinite; }
@keyframes bootBtn { 0% { left:-80%; } 60%,100% { left:130%; } }
.dash-layer { position:absolute; inset:0; z-index:5; display:flex; background:transparent; }
.side-nav { width:175px; flex-shrink:0; display:flex; flex-direction:column; padding:14px 10px 12px; border-right:1px solid var(--border-soft); background:linear-gradient(180deg, rgba(60,8,18,0.35), rgba(12,4,7,0) 34%), var(--bg-base); }
.sn-logo { width:38px; height:38px; border-radius:18px; background:#070204; border:1px solid rgba(229,24,58,0.45); display:flex; align-items:center; justify-content:center; color:#fff; box-shadow:0 8px 22px rgba(229,24,58,0.4), inset 0 0 14px rgba(255,45,70,0.15); }
            .boot-logo svg, .sn-logo svg, .about-logo svg, #tom-orb svg { filter: drop-shadow(0 0 4px rgba(255,45,70,0.8)) drop-shadow(0 0 11px rgba(255,45,70,0.4)); }
            .tom-logo-img { display:block; background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAEicSURBVHhe7X0HlFTF8n7f2ZxzDrARlpyTRBUBxawImBEUBROCioAiWZJkJGeQnHPOy5KWzTnnHCfc6W/qf/oO+MN5BgzvL++9/c7pMxtm+t65VV1V3V31NWMNaEADGtCABjSgAQ1oQAMa0IAGNKABDWhAAxrwXw0dcxyib/fo2nLGmpv+rwH/xahlrCV/pO9e2nuEqKKa9HMWatSNm00qZMzO9L0N+C9CKWMOOq/G0zBtrpZq6wlEpDcYxAtRehbpPx2fUsssXjX93F+AdF9rwD8Jzthg/s6oFEpIVeTNDQZwvd6gVxrHT4pw/jLphrx+pJ6xTqZ9/Ek0KME/iTrG2sh9nj5CB44q8hWC1utlIXxwrr9PCfTQ67RCEQykk4lv2GrQ9ey3qIgxL9M+/wDuF36DAvwB/OWHVcmYsyag6Rw+Z5GOqmtJb+AGfW0N9FoNuF6GInBjUxRAKIRep4O+thb6ykoY9DJRcSnp5ywolH1CPvyT92SqAH+mjwb8UegYe03/wZhMSkgh0ulIX1wMfUkJ9DU10Gs00Ms/KYAQvIFzbvxdKEBdLfQVFdDn50Ofmweqqye6HUP6T764WsXYE6bXekA0KMAfwJ9+SFWMddA98exJOnSChOD0OTnQp6VBn5cPfWkp9NVV0NfXQy/rjAKX75p/fs8CaBULwMvLoS8ogD4zC/r4BNGHgcoriPYeJM0zg7bmMhZmeu3fQYMC/DuRzZiLvnHTuXzuYj0VlpA+K8ugvx0NfWIS9BmZykjWF5copl1fX8f1so7f5wLuWQLFPehra7gslOWeAiQlQ+nr0hUgIZEoK4d0i5bV1LXuPPEKYzam99KAvwcPPFLUwtyPHpNJt2KIsrJJvngZ8pVIyHdijAqQlg59Ti70hYXQi5EtfLxW+7M4QBG++F2r4frqaq4vLeWK1cjIhCz6EApwNQr602ehP3IMwiXQ1Rskj50UV8ZsXjC9pwb8f4Bi7p966QTtOUSUnEb6U2chHzkO+fxFyJHXIN+KhhyXAH1KKvRZWUafrriBanCNBvz/4gCjAgi3oK43WomiIkVp5LR0yPGJkG/dNirVufOQDx+DfuNW6DdtA12MJFq/jTQDX96dyViE6T024N+AHMZcNcHN5vCZ8/V0K5b0h48b5PVbIe87BPn4achnz0O+fBXy9ZuQY+KgT0yGPi0DsrACIhhU3EC9EvAZR/7d9lMAeNf/Z2VDTkmFLjYeuus3ob14GdrTZ6E9eATabTuhXbUO2plzoV+8gmjHAZLHfF1XE97mm7OM2ZvecwP+JlQw9qb8zqhsOnSSDLsPkjxnEeTlayBv3gF59wHIR09APn0W8vlLkIXJvhkNfWw85OQU6DOyuGIFysp+cgOK4I1rAcbfxSxB/D8/H3J6BnSJSdDdjoEmMgrq8xdRf/wk6vcdRN3WHahZuRbV3y9G9aRpqP74c+hnzieatZjUzwxNLbSwG2x67w34CyhhrK2mxxOHae5Som17SB4/BfIXk6GbsxC6pasgr90MedtuyPsOQz52EvLpc1BigcjrRlcQEwtk54ALF1BUDH1VFWSNWsQBxmBQuAOj/1esBBcBY0YmdDFx0N64BfWlq6g7cw41R46hevc+VG7cirLlq1AybyGKJs9A0divUDRsJEpeGw4a9y3RiHFU17rXvkTGWpp+lwb8AUQzZlfrFzxNHvGpTIvWkv7DLw3y0Hcgf/Q5dOOnQjdtLrTzlkC3bDXkDVsgb98N3b5D0B09Cd2Zc5AvXFKUwJCbb9BHRlFd5DXjFK9CcQPG2YAQvjD/wv9XVUFfVg5tXAIoPYMMmdlQX72GuvOXUHPyDK88cATl23ejeO1GFCz+Abmz5iFr4hRkfvI5MkaMRvqQt5DZ71kUPz2Y6K3PSO71grbUvfGMjQ2bTH8cVYy9rO//cgqNnU70zqck93oK8rNDoHv9XehGfgJ5zFfQTZgG7Yy50H2/1OgK1m+G7sdd0O09CN3BozBE3QAlpVD2goW0xNOrMmvJUm7QaIUCcH1dHddrtVwRvjD/Ii6oqIBBJyNx9lz96nbtqerwEaL0TKq/eBkVh4+ibM8BFG3+EXkr1yJ7wVKkTZ+N5PGTkfDRWMS98z7ihryF2KdfRkzPJxDXrjtKej1L1HswaUI6peSoLBrcwoOggLGIuhaddtGQUURDPyG5VW/oWj0Cbe+B0A58BbpBb0H71vvQfjAG2s8mQDdxGnQz50H3/RLolq+Gbs0GYOde0PVbpNm5i/b07F3+FmNj3mXsheKNGw2GunrD3ekg12vURiUQq4MiLigvB2k0lLx4mdyDsTdHq8x3nntvJMmXrpLmciSKftyF3HWbkLl0JVLmLkTCtzMQM24ibn/4GW688z6uDXodV598AZd798flzr1wuVl73AlpB02bfkQt+1G1V5O9kYy1Nv3ODWCM9WLMvMrZe5Lc58V6en40yUE9SO3cBPVhXVDfphfquvZF/ePPQvPsEKgHvw31WyOhGTUG2rFfGZVg+hzIcxbCsGufgQ4cpouvv0nTzMw3+TAWKPofz1ivonUbyFBTa7g7HeR6db0QPldGv/D/JaWg+npKWbzU8BpjQXfv66VvGjVOiZsyjdSnzlLhlu1I/n4J4mbOxe0JUxD16Re4+v4nuPjWuzj70qs4NeB5HO/dDye79Mbp1l1xOqwtzvmEI9avJVFIb9J5tZGzbVznfNbgFv4POYz117budYP6v0nU7FFSM3/UWoWi2qsVqoI6orLZI6hq3xvVPQag7onnUff0K6h/+U2o3x4JzQefQvvx5zDMnAfa9CMljx1Hi/39Lz/N2KP3X2MqY48XCwWorjXIxSWQRRwgrICIBcRrZSXkoiJQTS2lLFpqeJ2xtvd93H4wY98u6dGzLnXRMspds5HuTP0OkZ9PxMUPP8PZER/g5KvDcPS5wfzgE89gf6++2N+5J/a36oyD4W1wMCACB1wb4aStN7Icw4nc2lOdU1hyvIXFoPuu8b+Hy4x5VviGraaeLxJ1eZZkK1/UMzdUWQShwjYM5a7NUObfBqWhnVDWojsqOvZBZc/+qH78WdQ+/QpqX3gVutdGgL6dReWTvqV1HTqWvMHYx6bXEZjB2BNlGzaRoboGcmERl8vKjVZACF+8lpdzubAIYucwfelyw3DG2pj2YclY03esrA5ufPZFSpw1n6Inz8CZ9z7EsTeG4+Arb/DdT73Idzz2JH7s+Ri2dOyBzS06YmtYa/wYEIEfPYKwy8Efey3dccXcDWqbJkR2EVRk63PgFGPNTK/1X48ilcVwdYe+BdTnFTJ4R5CG2aKWeaBK5YdS80AU2oSgwLkpCjxboDCwLYrCO6OkVXeUdeqDih79UNNnIAxDhxv0oz6jfX0ep/cZ+4Ex5mN6nXtYyNgTlRs3E6+ogi6/gMslpSLo4/qqKi6CQrmkhOvyC0BV1ZS2dDm9+QsKcA9NGXt+tJ9/0p4hr1PUmC/p+BsjsPPZl7FtwLPY1Kcf1nXrjdXtumFV8w5YGdoSq/ybYI1HENY7+mOrjTd2mbvhiGSPeMmNyDaCtI5N1Rk2LtMYY1am1/qvQw5jLeubdD5Ejw4matmbOHOCjjmiVuWOCskTJSpf5JsFIMc6CFkOochybYpsn5bIbdwW+eGdUNi8G+o7Pw56Zgjd6DeQvvbwPNtBcdW/jWWM9atcv4nk0nJoc/O4XFTM5dIyLpdXcLmsTPldm5sHlFdS6pLlht9SgLuw68nY1HFNItQHX3mdjg19mzb1fQqrejyKHzp1x5JWHfmiiLZYENQcC3xDsci9MZY5+2O1nQ82WXpip5kbDkqOuMRsUWLpT2Tfkipsg2JvmJk9b3qh/xaYVTh6jdd2fkpDvV8h7hho0DNr6JgL6lVuKFe5oVByR67KGxlm/ki1DESqbRBSHUOR7t4U6d4tUBDYBnKr3pTX+VGa7xtQ+DhjI00v8mswKsBm0pWUQZOTy7V5BdAJJSgp5XJxCdcVFHJtTi54WTmlLl1uGPbzGOC30PwpK+uDM9t2pD39n6ENvZ/AwnZd+bxmbfns8Bb8u8YR/DvfUD7XozEWOvtjqb0PVll7YbOFB99r5orDkjNOMVvEMQeQVRMi51aU5+C35xBjwaYX+o9FEWOPaUO6Xqfug4mCOhNnDtAzJ8iSK9SSC6pULiiUXJEtuSFN5YlkM18kmPsh3jIA8TaNkewYggr35oZS/7a01isQwyT2PfuDqVprGBtQvWkraYpKDOrMbK7JyePa/EKuKyxShK/JzeOa7ByuLymjtOUraBRjHUz7+C00Yuz5N51cEla07kAbOvWkuS3a8xmhzfnMRk0wyzcEsz0aY55LABY5+mKFnQ822Hhhh4UHDpi54aTKFeclJ0QzW5SZexM5tqE6x2aVGdau/9lbzkmMBWmtvZZT4CNEYY8St/ABZ47gkhtklSs0kgtqVM4oUbkgV3JBmuSKRJU74lSeiDXzwR1zX2RaBqLcLoxOOvjTaAurc16MdTa9zoNgM2MD67Zup/qCIkNdWgbUWTlck5svGjS5eVBnZaM+Iwu6ohLKWLmaPv1zSaG23Rib8rGLR92GJq1pWdO2hpmBTfCdTwjmejXGfLdAvsTZH6scfLHR1gc7rLxw0MITp8w8cEnlhpvi+zN7FDEbkGU4kUcPSrD3yFqhhB3/gdinUo1ItnQnsmlBxPyIM3foJTfoJVdoJRfUSk4oUzkjX+WMTJUzklUuiJFccUPlhhiVBwrN/CnOwp++NrMvbMfYcNP+/wh2Mfaieuceqs3NN9SmZvC6jCwulECdncsV4adnoi41Her8QspbvY5mM9bVtI8/gLBnVOa7prr50qaACFruH47vvYOx1KMxVrgGYo1zAN/s4Mf32vriqJUPzlh4I9LMS/nO2ZIL9MzDAMmPTpu71i61tB77zX/yDuNAxppuYNL2BJU7kcqfDJIXZMkJdZIjqiRHFKuckKNyQorKETGSI65LjshQuRmyzbxoucqBnvud6P5BEe3mPdZw7iJVZ2TxmpQ0XpuewevSM40tLYPXpqbzmuRU1GTlGNS799NJxp417eOPogljL79jbpO00TWADvk0pQ2eIVjn1ghbXRtjt3MjHLEPwBkbP1y28sVtc28UqrxAqgBKUXnRLMlqb9h/Uo5BNrMKMf3b/RjM2FNbJZvYSsmTSPIiWXJEhWSHAskB6ZID4iQ7pEoOKFG50RmVC70nWUR6P0B0/6Ao6f34UcrIoor4RF6VlMKrU9J4TWq6InjRqpNTeVVCMq9ITAZFx1BS05ZzTfv4k7B7hLFpX1s61p91CaaLHuF00D0Yx1yCcNapMSLtApFgHYB680CDLPnRVsmx9GUVG2HaiSliGHMx/ds/ijqP8G314Z0vZP529Gz1qUr19RGVg4ZUnmSQnA0lkjWyJWtUqZwpw8yVpkjWZR0ZE2nYKtMP/1mI7WR57gK5uqDIUBEbz6sSU/RVyan6mtR0uSYlXV+TnMqrE1N4ZXwir4iJ5eqCIqoa83nJHsbcTPv6C2gymKl2bbZ2pxTnUIpxDcdth8bIsw8BWYVSnJknTVJZ7DbGk7+OPMaaqL2bHat18hPrBg8PtOFd11N6Lslfz5TLbb2/P8aYq+l77sGfsRbTJMvjyZITkcqF1CpX2q5yoJeYtJHdXbv/u1DIWJD86ttxKCimioQkXhGfwIUVqEhM1lclpcpVSan6qsRkXpmQxCvjEnhFXDwvi08EJaZS3dMvnbr6B2cbv4cWjD03VrKKuW4fQNyjFWltQmmDyrHwCRV72/S990NsjastnSfpv55VS2evUL3dQ6YAsn+rdVRaoVTf0K04Uj/3em4xY6+bvu9+vK5ib65T2RZ/LVnFhDLW1/T/fxUaZvG2ftykEiopF74fVfGJqIxP4hVxibwiIUlfkZiiF8pQKX5XXo0KUBkbxytT0zilZZF6/Dd51VZOb5n2/RchNgEmrrB1LZ5sYbuXMeZn+ob7UcPYC/ILQ5Io8qbx+SalksbMbarp+/5RqP3brKPcAmPp1b06uy17qLblI8cSfjui9mCMWZv+8a+glLGOumcGnaCzF4n0nOry8lGbmgYR5FUlpgjh83Ih7IQkJQ6oiE1AhSL8uwqgKEE8r0xKgaGymujcRdK9MexENWPdTK/1F/GrVlJAVDHr2nXfT5t2/FTPqDzbW7FUb+U7w/T9/yjqA9ptpLxCowLoZGOunaizK6sk7ZffUolTwJKTf69P/RfkMeambtp2gX7pSk5qLcmybNAWFkGTl4+6rBzUpmVABHtitNekZkCXV0AVUTdJl1dI1clpXMQHwgpUxSXy6vgkXpOYzGsSkiHWDqiiivjaTaTr+vhfrRf8XQhzr3Hzn8a/nq4R5etc1DQCxgxmoQDRcVRv4zvT9HP/KDQBbTZS7j0F0BrTrLRayAbAINT3TjxpB4/ILWHsHdPP/h2oY6q3+Gdf5lBGNgEgXVUl5PJy6ErLIJRAnZOL2vQM1KSmQy4pM6jjEmjbiHdppJ//9d2jPyJtYjLp8guFm+DVCUm8NimF16Wk8fq0DBhbJvS1daQo+TczCjSOXqNM7+HvgJqxV/Rvv59CsYk/K2b9KXtZKMCdh1EBAluvN7oACMFzpcpGpFppNZDV6v9zC3uOUG3nR88XM9bdtI8/g1JRHzDwhaN08BiJUSrnF0BpZeWQxR6/yPErKlZW++SyClBJGSUsW07jQkKvBTL22FnGGvsz1n96i5YJeVu2ERWXkSY7l9clpyqCV2dmQZOVA21OHrTZudAWl0C4Fbp+m/TDRl2oYayn6T39GVQw1kp+dOBh2n9EeUyyELxIVL2Xt3iv3VWA2odVAWQuGwUu0qxEto1GzeX6esi1tZBFbZ5wC5XVZJgyh9TeoavS/6Q5PcuYc01wk3n6r6aAom6T/uZtg3ztOnQpaUYFKClVLIAs0ryrq0GynmrOnqMVfftVPW7MGVCqj0os7O4lZdi+wth3u4YMJcTEk6GqxiAEr8nKFruHYgsZusIisYEEuaAQcn29QVGEzTtI7vrY6lLGfH9+hw+GREFa4Rc6TT97oY5q6ozmXtQniEQV8fy0Wi6LwaQzDiqhGBQTR7V2D1sMIBQgJ5/Ezcp1dVyuqxOv0NXVGoVfUw1ZpGOXGQVDBgOJqZY8bFRRLWPCnD5wOViJhfUQba+B6TR9EdGqjaRfuwn6Q8cgR0ZBTkiCLisHcmGhch2DeGB5+XTiw4/ofXNLMc1UUr2UfmzdfaqsHBfc33cjxrpO9Q+4lLPsB6KqGhIZxLq8AsginVwolbAsFRXGVl0FxayVVZB+6qzieteAnxTrQSDK2vioMWkiqldGvShaEZXJ4lmJZ1Zfz2W1muvVauVVGUjgoJh4qrd7yCxAfVD7dZSdp2ivXFXF5epqrghdtOq7whcPTTxEIRxRsCkUQdaTqObVPjog8vfMaR2zaF3l5H+I2g4gemE48ZfehP6T8dAvXQX9ngPGsrDoGOhSUmGoqFQSPNPXrqMZYWF3mjDWz7S/ageH8Dobx1OmfxeLUK8w9sXO/gPqKeoGiTBGSSUX1kQISRSQKKPUqOSyXja6tzvxpB/5SWQtY4+bdng/6hhrrXvy2RN09JQyS1GejbAqpXetlnBd4pnV1ECuFa3WmMUsrqvTQVyn1sHvO9N+/1HUh3ZaryiAuPl7X+TeSBFZuGVlkEtKRDqW0UQLs5qZDV1aBnSVVQYx2uj7pSSHtFqvZizAtP8N5tZdb5o7EXl0JvLoSHJIJ/CnBoGPHgd59gLIW3ZAPn4K+pu3QcUlpD1/gbY++VTNC4x9bszm+leoHRy61bl4ZGX+yjTUlbFmsxydDqdPmaqUmwtrYhR+HfR33ZwsAl2laYzuTWDnPpJ7D9ioYazx/f1lMuasC285ly9cJlN1Dcm1dQZddg50efnGQVFcbBwgpWXGZyaeZWWVUSGE4pVXKOnrdDuO6p0CZ93f9z+OmrDOGykjhwQRg/gyosJGLikWryLbBvr7BC/q9OSsHOgys7g2PQPa1DRoM7KgV2tIRPF8zFflssppzP2CeZMx648sLV9cJ9ndzLcLIgrrToZeA8HffA/6yTMhr1wHw+nzoMuRdP2jT2iMje0mxljoz+/y59A6ub6oDQ7T1xjXIn4VQxkbcaB7j2K6fNkYmXO9McbRaSGL2Y4sG+sLZB1kWQfhx4WA9bO/r1D7ho1TpqfMejAf+1WGIKMy6HSkxBVZ2VAUIDePCyXQFRQYFUHEGeI5ioEklEG8CoKLu7WNyjqAc9Bs0/v8R1ET3nkDpWWSUlYtCjHz8iCLn0W7J/TsHMjiS2dkQpsmBJ8Ozb2WkgZNciq0BYUg4VkvXSP+7JDYOsaeNLmU+auMfbLT0auMt3+UaNAwMowZD/phLVVOmU4/RDSL7cnYAJPP/CJkJ49x1L4L1TzYfnvAAnPLHzM+/4JE5rBiDe5F5qLETPlZJ0y0MfAVplogOpZ0n39ZQkdPGs19SSl0GVlcl5XNtfc1XXYOF7MMXU6uUAgl7lACz4JCo2IIKyGeo5iFXI+meudGc0xv8B9FbZPOGyg5nQSpgpyeCVnU1oufM4y/K6Y+NV2J0rWiJaVAk5QCdXIKV4tX5edURRG04vO1tSCtTLRmE/GWnXdo/zVzNnCKpe3yyJYdiN4dRUd79K4bydjEP7KqqHf0WE29+5H2D2z9vsXYK8fatsum4yeM1sBgUEa9YgXElE1RAA2X6+uMpehaDchAJNYQFOEKQWdmc21GFtekZ3JNRqbx9f8aNBlZ0GRmKzMQZQqqtGyjyxSJq9duCQV4uCxAbdMuG5WoPjkFcmIy5KQUpelES0yGVkTnyakw5BdCm5iM+th41McmoC4uAXXxiaiLT0JdQhLqklKhTstQHoI2vwBcGNSCYsLnE9Vaa+eJOSYpUk8y1uc7W9vFwl/f//cHgezgGUsvDyMNsxYpZn8E7ksYW5Uy8gOi8vJ71oAbp2paJWpXmEhEsYmIhYqKjaM5N49rs3KMwk/L4JrUdKWpU9JQn5wKOa8AKCqBOiML9SlpSoKKaPUiUeWelczKVhRA4xrykClAi24bKC6Z9DFxkO/EQr4TB92dOGiVFgttdCxqb0Yjds58MsQmki4jGzW3olF7Owa1d2JRGxOPGtHik1CblIL6tHSolVGQo6zmKW4h8gbpX3o1oZ6xv5w5K3gA4RxKNPV7kpl7NjFmYfqe38ObjPU/3axFrGHn7p+sgVJtJObwIoIXAZyYNhbfVQCRjCryEdMzuDolXbF89YnJUKdlgsorqerAIYp6730SLrFW7FMkJEFp4pkkJKE+PhHqlFQIdhKNe/DD5QJqWnTbSHcSSH/9FuQbxqa7fgva67egiboJ7bWb4tUw1sW1bkHrNuW6fQeJMnOp+tYdVN+4DfFaJX6+E4ua2HjUJiSjLtk4CkS6ljo9C9rKKpAIFDdsI137brtrld3VPweZqQ5Q+ydJHxNrIN/2JDPbsabveUDYLmJsXszrbxjEeoOwBmJqqFQaV1QYU89F4mlunjDjRuGnpnF1cioXwtcXFIHSMuj2J2PoY3PzgyvCmpQgLdNQFROnbEhVxMShKjaOV8fE8RoxWGLiQBevUZ1b8HzTG/lHUdOq+2aFseNSJORLkdAq7So0F69Aff4y1BcuQ3flGk1s2iyXMRYxxtJyy/UPPyGKSyRNYgoqrkah4toNVETdROXNaFTejkHlnThUxyWiJjEZtclpqE1KVZpaMHZl5xH/aopO5+AzNe4P5sxxZj2BmDfxJasMYsMKX3xjAPPUaZnlA8cCphjIWPc9jYNvaddvVKwBFzMCMaUTs6D8fK4Tpl8Z+alQJyYrPp5Ky6l+81ba2Kp12uOMKVxDWzp3zZZT0qjsRjTKb93hZbdjuHituBnNq6JucjFY6NwVqvEI+dkC1j+O6jY9N9ONO6Q/cx7ymfPQnr0gGlefPof602dRf/IMNGfO07dh4cXsrh/vxdjLmzp1zqndup308clUfuUayi5dRdnVKJRF3kBZ1E2U34hGhVCGmHhjuxOHqpvRqLodA11hCdHZy6R/bnBSLWO/W2dnYKwFmPU6cggljJ9CXKtWdtf0ZcWgdz8hbtPYAGa90MBYK/qVtYPfgeUsxibdfukVHSWnCGtgkAuKxAyIazMyFR8u/D1Ky0G3oily6Gv0JWNCkM53P2+3rmPnPG18MhVfiULx1SgUR97gJZHXeenVKF5++RqvvHoddPoi1XkE/dG45d+Lyra9ttDlKNIfOQH52CmFpEFz9CTUR06i7vBx1B44gvpjp2hSWHgh+3k+m+dHZuZbb4wcpfj42tuxKLlwGSUXr6DkUiRKrkShJPI6Sq/dQOm1myiNvInSq9dRejkSpafPoSwyChSTSDR3CWlatNstystFp9SokXW1jWsX2dxulN7cfgu3cUmlxk2JnnqDcPAkQXAFi9EvVvkMBmEJQD/uIxrwGlFoC+J2buV6M/srajO7tXXmDuPKLV2ezHH0CI1r1ux3FaMHY+12eftcrRPLyYKvUGxIpaQZI/iiUqpZtITW+ze60c6kgJUx5rC6c5ecujvxlH/+EgouXOGiFZ67hOLzl3jpuUu8/OIV0IlzVOMZstDks/8satr13qaMRsHVs/cQ1+49BPWeg6jbfRC1u/ejZude1B04QhPCwovu0/if8Ahjzy9p1TqnYt1GkmMTSShA0dkLEF++8PwlFF64jALxKh7MuYsoOHMeBSfPIO/gUeT9uBulx04baO8x0g8Zoam1cvp2H2MOxJi51tIhXDa378WtnN7V23ts0TsF1lN4D+IzF4DrNEYXUF0J/vm3BgrpStw1KEvn5LVctnIcqTWzfare3KZjtaVDeJ2th3ech4c9PXiuojSRsXGRA59W041bRPVqostX6dKTT9V/bJyumpl+gDHmuLRT5/yqm9GUc/ocRMs9fY7nnTqLglNnUXTiDEpOngUdPkU1nqEPlwLUtem1nY6eIXnzTui27IRmyy7Ub9mJmk3bUbVxGyrXb0XNzn00IVxRgF/LaPV4h0lrzr7xNsnnL5GICfKOn0aeEPSps8g9eRa5J84g59gpZB85jsz9h5G5az8yt+1E+qr1SF+6EhUie2biLJJbdY0p/4X1fwNjzThTXSfmSfKcxYoC8A+/ADEXAjNbUcGYk+ln/gqCGWuxxdvveOp779MmD5/DEb99OIXzwk6dCyqu3aDMY6eQcfQkMo6cQObh48g5fIwLZS84eAzinIM6r7CHKwaoa9tju9jrl1dtgnbNJqjXbELd6o2oXrUelSvXoXz5GlRu2Cr24X/RAtyPCMaemxPWJLtgyQ+kjrpFecfPIPvgMWQfOobMg0eRvvcQ0nbv5yk79iB5yw4kr9uMpOVrkCiIG76dgcSvp6P+q5lETwwmrUvguusmdQUGR+bKmXmuIaQr4fQFkG0ocWa14/73/N147sEqjVzmd+pcWHb5GqUePIqUA0eQsv8w0vYe4uL7Zu3ax3N3HwDt2E81no0Xm374H0VNq27baetekhevhnbpaqiXrELtkpWoWrwC5YuWo3T+EpSvWEtjQkJFDPCbCnAXbq8ytnzHi4Oo+tBxKj17Eek79yLlx11I3rYLiVt2IH7DFsStWs9jlq3Cne+X4Pasebg1cSqufzwOkW+/h9i3R5HhubeJN2pTVM7M37+/c85Ur5ONDxleHU2c2dYZ/uR+/t8Ml7mdOhUWnb9MSbsPIGnXfiTu3IekH3cjZcsunr55O8/6cTdo8y6qdm+0xPTD/yiqW3bdTqu2kjxnCTRzl6BuzmLUzFmIytkLUTrrexRNm4vSBcvpo+DgB1UABV6MPf1lUHBizPRZVHbkJKVs3Yn4tZsQu2YD7vywBrcWLceNOQtwY9psfu3rabg69itc+uATXHhjBE4/Nwin+z2NtL4vEDV9hOptfU7F3S37JsasZQu7XGrViWRmvl387RvGVNUOPh9rlaKefwTO33XuXJh/6jzFb93N47ftQvyWnYjfuA2J67fw1HWbefrGbRDspHWewYtMP/yPorp51x20cA3pvp0D9dS5qJ06G1WTZ6H86xkonjSVF46fgtIZ8+mjxo1NZwEPArtejM39od+TlL9xG2Vu3Ynbi5fj5vdLEPXdfFydMgtXJkzB5S8m8gsfjeOnh72PE6+8jqNPvYDDvfvz3Z164EibboaqkG5UYOunn3fXHMvm1qvI1Zs4U91j8JLy3hpRjFXr6rUBYV/9keSOvwnOszp3Lsw5cpKiN2zDnY3bELN+C+JWb+BxK9fz5JXreOrqjaDl66nGvdHD5QKqm3XZRbOXk+7zb1H/xRTUfDEZFWMnomTMBBSOGY/8j79A0YSpNDog8A9ZgPvhxthjw339Ys5/OpZy12+h2/MX48rkGbj05WRc+Gw8zn80lp9670N+dOhbOPjMIOx97Cns7v4odrXvjh+btMWuoBaGVNtGNEVZt2GsRmUxwmBmc/9uoJQz9ot4ZSUnKY30o8Zcq2Os/8/v4t8Kl6kdOxal7ztMN1dvgGi3Vq5HzPLVPHbJSp6weAVPXrYKtGiVUICHywVUNOm4l76ZS9rRn6Nu9OeoGj0O5R98huL3P0X+ex8jZ/hoFIz5ikb6B/wZC3A/bLsyNn9+rz6GpFnzKHb6XJz7ZCzOjPoUp0aMwrHX38GhF4byvf2e4Tt79cWOLr2wvXUXbA1tjR2BLQzJ1v406+52cbm5dbcalVWxOEzqXueZH4+JE/KX7yV37D9C8hPPbKz4myuWfgUuX3foUJi8Yy9FLV2FqGWrcX3JCtxcuBzR3y/lcfMW84SFy4C5S6naNWCp6Yf/UVSEtt9Dn00hzdujUTdsNKreGc1L3/6AF77xHnJeG4HMIcOQ/+7H9K6P75+2ACboNtTd4/qBIa9T/Phv6MKI0Tg+9C0cfflVHHjyeezu0w/bu/XGtnaPYFtEe2wJaoF9/s0MyTaBNPXuqC5g1o0qVdYH6D5Tn/rxp3eUjR21GrJOa8z5q60nPn9xeZ1P6Bc7fnn+/nfBeUK79oXxm7bT1e+XInLBUkTOX4yo2d/zm7Pm85hZ3/OYOQugn/491bj4PVwxQHlQm700fBypB72NusHDUDlkGC8Z9BbPf+E1ZD83FOnPDUHukHdouKfXryrAQcbCip97aU9R98fX71ZKCH8XFq0Zm/xNyzbaG2++S9dfe8dwdMBz/MCjT2LPI32wo8Mj2N6iI7aFtsL2wGY44hdhSLEJFMuvigJkMifnUnPrn20CpX78SbRiAYyZucacP7GnLxCfTLoPxlyv+4X1hb8JLl+0bVcUs3oTXZ45n1+eNZ9fnDUfV6bN5lGTZ/Cb387gt6Z+B+03s6nSLeAhUwC/5vvo5ZGkHjAINU8OQtmAl1DY/wXk9nseGY8/i+THn0HWwFfoHVe3X1SAG/6Bo6pmzKrlN+8oOfe14yeWZZnbjDZ936+g7UB7x8u7evShxKcH0dmefXGwQ3ccaNUF+5u2w/7gFvxAYDOc9mumxACf3xVgCmNWuTYOP2McSfzwk1hFAcRunkhsFcmZYltX7OtrNCBR5rJ7P8mPPbnl3+AWnCe0bVd4a9lqOjtlFs59O4OfnTwDFyZOxdUJk3nU+K951JeTof5yCpW4+DxcLqDMt+k+sY6ufmQAqrsPQOkj/ZDf/Qlkdn8CKV0fR0KXR5HV+0ka4eRScL8CbGSsdd6Id0/zvQcp58e9dHvabMQsXYny67eJjp+iusGvn01hrMvPr/aLkPwZG/uVb2BdXLfHKK5DH8OZJu1xKqwNTge3wqmAZrji29yQ6RhKE+4e/iRMf0po6P3UbKr4Tz5VSnJ0Iom1vJwrr2Vl0JWUQFdUpFQZyRqNkgrO5y8qU/uHjf0b3YLz563aFEbNX0ynJ0zmpyZ8w0+P/4af+XwSvzB2Ar86ZjyP/PQL1H74JRU4eT9cs4ASr7C9gvBR07Inqlr2RGnrnshr3R1prR5BYstuiGvZDdkd+tAHDk5iJVBAda1z5y9Kv5urrdt9gK6Pn2y4+uE43JwyC7dnf4/oOQuQuuegAclppFnyA0qat1m0/XeKKe+iWX8LyxP7G0dQeauelBDcHlf8m+Oqf3PE+7Yw5Do3obG/HtlLiSM/yBEKoC0tVQQuCkFEQYjITtLkFfwfn1BePqDRkqjS0Y/+9GbV3+MWnMe2al1wefocOvLZeH5UtE+/4Mc/HsfPfPgZvzRqDL/8wSeoeW8M5Tl5P1wuoMg9+AC1GkDqgPaoatQBxY3b8ZygNjw1pC1PCG3LY8LaI6tFNxqmMs/7iLGBWR9+FKnfuI0SPptIZ55+GReHjcTlj8bi6ueTcH3KTNyetxAxC5chbvlqFFyJUpIrNZ9+nlP0gFxB7oy9O9HZszo/rANVN+5gSPeOQJFvK0OBa8RPMcAvYbWXz9zMCZOUrF5RiCEKSxWhZ+eiXrRMhUxKUMugRuQo5BcaqE5NtOcAyX0Hbi1m7DeZUn4HzuOaNi88O3EqHRg1Bgfe/wQH3/8YR0Z+xE+8+yE/984ofmH4KF75+geU7+D9cE0D8x0DDlFAd1I7NUelawsUujdDlmcET/aO4PG+zfidwBY8PrgtFkY01+VMmU6lE6fThV4DDKd7D8CZ517BmaFv4+w77+P86DG49PkkXJsyC7fmLFTcQfyyVUj9cTfqk9OIDh2j2gFPH4v/bSaSewh70tx878lGTYia9SCDd3tDmV9bMQv4zfP/XmNs8Lk+jxXQlUgyaGVDfW4e6jIyIYReK9K1UhRKGaXSuCoxGVUie6mkTKkr5HMWVsl+wV+e/QPJqffBZWxYeNHpzyfSnhGjsPed97Fv2EgceHskP/Lmu1zwEZ9+dRgvf+ltyrN1f7hcQJ6dzxFy7Uj11uEos2uCfPswZDiGIN4pFHdcw3DdNQRJbXqibPwUQ3SfZ+h0SGuc7twbJ3v3w4l+z+L4s4NwYvCbEKt4Z39Sgpm4OXsBYhevQNKq9Uhduxn55y4bRPq5etZcfZl3wHfbH4BHz4+xN75ycS+ubv8Y6boOpA9/RwHuwneJncPe/OkzSeTr1ReVoDo5RQgdgk5G8AkJsgljS0RVXCKqU9KMFcTRsaR/d3RcPWNPm3b6O3D9MjS8+Pjoz2jHG8Ox8/Xh2DV0GPYMfhP7B73Bj7wwFMeff5WXDHiFCqzdHi4XkGvpeYxsW1GNeTCKLYOQbdUYSdaNcMe2EW46NEakczCu+kTggmcYTvo1xcmIjjjWphsOd+6Fwz374tDjA3H4mUE4NvhNnHx7JM59OJZf+WoyF5bg9tyFihVIWb8ZmZu3I2/3AdSnZBDduE26YSPiyx4sSdRvuKP9+mN+jegLM7MHTv16l7G3T/XrXyFKxLTllYbKxBQojCIKmcS9V8EroJSVozo+EbU54sRRo1vQ9Oq3q/TB9xZcxwcGFR8Z9gFtGfIm3zL4Db7lpdf59hde5bufeRkHnnqRHxn4Ei/u/RwVWbk8XPkA+eZuh8miCVWpAlBg5o8Mc3/EWfjhpqUvrtr445J9oMKKddIjGMd8m+Bw4xY4EN4W+1t0xv5OPbGvx2PY//hAHHrmZRx95Q2ceOcDfv7jz/mlLyYhasos3Jm/GIkr1iJtw1Zkb9+Ngl37UX45EpRfSLRtJ9V07fVjoUkp1i/hCcaGfmBh8Vt78v8CK8ZClrt7Hi2Zv4CosJgq0jJ4eWw8Lxd8QrFxvDw2TlEChVjibjZvXWIKdGWVJDKA9LPm1Wm8AiYX/v4ZAa6f+/oXHxw6jDa8MJSvf/YVvv6pF/nGJ5/nP/Z/ju/t+ww/2PdpXtx1AOVZOD1cCpCncj1MZo2pUpA9q3yRZuaNGDMvRJp54oK5F85aeeOEnS+OOAXgoHsQ9vmGY09gM+wOa43dLTphT8ce2NvzcUUJDj79Eo4MfgOn3vlAWAJc/mISbkyfg9iFy5C0ch0yNm1D3u79KD54FKVHT6A+JZUoM4d0E6ZUVlr+6eze38UYxj48/cKLpRVnzimWoCwmjpfeieNld+5XggSjAohCl8QUpb5ByWSOjiU+8sNUCmry8m/kG7p+5e1bfODl12ndwJewbsBzWPfE03zdY0/yzY8+yXf37s/39XyCF7V5lHLMHB+unMBcyekoqfyoQvJAvsoTaWaeiDFzR6TKDedU7jht7oGjVp44aOuDvY5+2OXWCDu9Q7EzIAI7Qlphe/OO2NulF04+9qThSP/ncPCZl3Fi6Ns4M2I0Lnw8DtcmTMHtmfOQsGgZ0lavR+7Wnbxw3yGUHjuJypOnUXP5GgxKkugF0rw4+GK+kmX292MyYzPT3n2PNHmFhpLbsbzkdgwvjY7lQhnK76Zy18Qloi4hWal2UiqdRGwg60F6ED35PCUrnuUXYTndyaX08PNDaE2/Z7Cm71NY++iTWN+7Hzb16IvtXfvwvV368MJm3SlLsn+4MoKyJIcTJHlTpeSGApUgfXZVaF+jJBdcULnglJkrjpq74YCFO/ZZe2GXvS92Ogdih0cwdgRE4FxIW8PVkDY0OzicdnfsRteeHkTHX3oNp157B+ff+whXxnyJG5OmIfa7+UhZugLZ6zfzgp17UHLwKMpPnkH1uQuoPXsB6rhEgzj2XV6y3FAT3nzR30WoeJix8IL+A7ZrtvzIazOyDcV34lBy6w4vvacAwgrcieOVMXG8OjZeqXaqT0hSCltELSEdOkJJnboUbmdsmCh0Ne3/KcZcrrTtsDJlzBd8+7ODDKsf7Y/VffpjTa8nsK7HY9jQpTff1q4739/uEV4U2pkymf3D5QKyJIdjggG0RnJBkcoFGZIT4iQn3JCccElywhnJCcdVzjhs5oL9Fu7Ybe2FHXY+OO/SGDGuIbTW2p0GMuk8Y+zpjox9NzcwmG4PfJGuvvGu4exb7+HS+x/j+rgJiJkyC0nzFyNj5Vrkbv4RRbv3o/zICVSfOYfaC5dRL2oRIq+DF5cqdGry6E8z65Qinj+HJYzZFwY3nVY3e14tFRRReU6+oeD6bV50M5qX3IpRWumtGF4WHcvLo2N5ZXQMqmNiURuXAG1JmYFS06nk3ZF0lLHVQb/ChnJFZTGodOSojMJFy2nPsPcNa/r0x+peT2Blj8f5ykce5as79+Ib2j3Cd7bszA+17MTLGnegHOb4cBWGpCsK4E0ayRnlKifkSo5IlhxwW3JApGSP85I9TqsccEzliIMqZ1wyd0eapRftM3elocw83uFfhdTzTVu7iyc7d6fUYR9Q1PufIOrDsYgZ/y0SZ85F+qJlyF61HoXbdqJs/2FUnTiN2nMXUH850liJJFpyqnH07TtEmh59d5f8wWPfCxkbXP/JmCSKSyB1eRWVxCYogr/XSm7euduieZko3oiO4ZW37ihEVCL4o9Xr6EpYk/ivfqVaeRFjQTmPPbG9YuYcipryHW14+iWsf3wg1jw6ACt7PIYfuvbhKzr14KvbduObWnbieyPa8uMR7XiVXxvKleznmfb3jyKVGV2ATnJGjeSIIskeGZKdwgF8Q7LFJckWZyUbXJfskKtyoksqB/pQsij2NPL1/FpQJM5YGz3dN6Ai6aVXKWvcRIodN1FJ+kybvQDZS1eicMMWlO7ci0pRe3DmnGIBtDducW10DNfGxnFx9q9cVm50C1Nm1tY5uo5/+XfW7vMYa6N+8eXDdOKUOGSKKtIzeGm00dQX37rDi25E86Ibt3nJjWilld6I5uU3o3nlnTiuzi0w0NVrlPD8S3wpY9N/rVr5ppfP6Px3R1XmLlhGe0eMNqzv+zQ2iKCv70Cs7v0EVnTrgx869uAr23bl61p24tsi2vFD4a352ZDWUPu0pmzJ8eGqDcxUYgAfkiUXaCRHlEt2yJZskCRZ445khXjJCmUqa9xRWRumqSzKAhgTZMwPygIe9LxktmVPh65UNXYC5U6bjZSp3yFnwVIUrtmA0i07ULn/sDjdE/XnLykuQBcdw3XxCVyXlKxQxuiyc410NNdvkW7Q0GuVjPU2vcgNxpxqW7aZpVu+QkcVlaRwC8fEQ/AHiuneTwpw/TYvjrrFS27cVoRfdiOaVyalQpA/qGfNod2eXhf7M9bRtH+BzYy1zOo/8FjFtNl0dtwkEpH+xgHPK8Jf+/hTWCWE370PVnXphVXtumFdi058a0R7vj+8LU4Ft8K1wBYw+LWjTDPnh4siJk1yOEmSH+klZ2gle1RJNsiXLJEnWUCjskK+yhJLVRaGoZJFtdmf3DhxZez5L9w9EpIGvUaaeUuocPEKFC5fjbJN21C5ez+qj55E/dnz0FyJhPZWNIQCyCmpXOEoEOQUgrhC8A5otGRYtY7qmrVbFnd3g6mIWbwqT5iULhjF5bp6qk5NR3ViMq8S/MJx8co0T/h5EfgVX7/NS67f4iVRN1F66w7qs3INdPQEXe7Zp/Zrxj4zve+7MIsKafJV1tvvqRMmTKUtLw41rO87EOuF4Psazf6qnn35D92E2e9pFH6rztga0R77wtriRFArXA1sgTS/FqDGnSnHyvnhoohJlZxPCK574yFQNlBLljBIVlCrbPGjygovShK6MYaRkgUWm9kXrLd0/qbJfalYfwB23Rmbsq5VW63m2xmk3brLUCEKT37chZpDR0UtItdeuqIc+izHJ3B9ajoXdDQKPY2gqhHUNaVlRvLK7FyqH/lhas1zg07TuQsk9vo1JSWoT89Q1v1rUsSyb7KRQ1gs+Ig5/+0YZcSXiiLW5DRQQgoVfPkVrbVz2BP8KzHGVsYeTe771PXcT8fTkTffo7W9+mPdY09izeNPYfWjA7CiV1/80P1RLO/aC8s7dMeK1l2wpnkHbGraDrtCWuN4UEtcDmiORN9mqBIK0KE/5di4PVxk0dFWrpfJpglx5gwDc4BB5YDzki1GSGZ4lDE8LzG8KjH+AmN4TTKjqeb2tNrCJWWThePvFnX+CtqMsrE7fnvQUKKtu0h7+Dhq9uyH+vgprrt4heuu34Qcl8D1aelcoawpKoK+tMx4cLQgXaooN2b6CK4/jZZknc6gbP8WFCq7f/WZWcrGT01SCsTqXmWsKEyNRfnNaJRFx0GbnUe0dz+d7dwt733G3jC9OYFAxlxuhTWfn/nCUIoaPpoUgfd8AiLK/6Hn41je4zEse6QPlnbthSUdumNJ265Y3rITVkW0x8awNtgV1BJHA5vhkl8zJHg2QalzCAx9nwd9MZVizeweLp7AxSrzMVEqFz2Z+VK55GqYzMzxMmMYKjG8JTG8ziQ+lDE+WJL4S0zFn2GMvy9Z0g8WLrTV2v34PHObB0n6+BeEM/bO0rAmRbUz5hCdv0I6pTL5PORrUcqx8fq0dIWvSCFYqlAOi/w/mjel1RnPDRZZPxUV0JWUKjxFmpxc1IsdwJRU1CYmoyYuAVV34lCblQuKT6LM0R/TcnPLtaK41fSeBHZa2jyb1K1vesZr79LWAc/Ski49jALv8RiWdOuNRV16YmGnHljYvhsWtumCRS07YmlEO6wIb431wS2xo1FzHPWPwEWvJkhwDka1d3NQ/yFEr46kW+Gtknb9DqXeP4JujLVZL1kcTpSsKZHZ0EqmwgeMYThjeIcx/gaT+BAmKUowWFLxQUzFn2MSvjS3o1WWbthp6bbo09+hTv8V+L/O2LqTA58lOnSUDIKlRJBG3omBnJqmkFQJ9jJ9lXJcrPGkcM1PbKbGo+MVUodqI79wcTG0Ig8gOwfq9AzUJ6VAHDRlKC4jw/addLh1m9QhSrXXv6I/Y/5Roa3Wpfd/kY4PHEQLhJA79cDiLr2wsHNPzO/YHXPbdcPcNl0wr3UnzGveHvMj2mJReGssD26BdYER+NGvCY54h+OKeygynMNg8O9I1Ooxig1qmb/FOGv63R3QfxTDGRtyQbLO45IdRTNLms4kvKsogsTflCT+miTxoZLEX5HM+CvMjL/IJP6qZE5zLJ1oq41H8S5LZ/ElH7QK9ydYMdZ/prfPneIpM0gQViEtHYKzSGEqKykFr6oCr68Dv0vxplC73Ts+XvD+CeUQJNMiG6iwEOIcQUFfJ5dXglLSKGXEezTHeIbRL64uHnVwfSumQ8/i6AGDaGnX3jSnTSd8364b5rXrirltu+K71p0xq2UHzGzeDrOatsF34a0wJ7QFvg9qhmWBEVjv1wS7vMNw1CME151DUO3SnMi7A6W5hek2MTOx8vebdHYPGzymMLMfkiUb0ktWtIuZ4TPG8D5jfLgkKdZAKMEQScWHMhUfKpkrruF9lRWttXaj/bZeN7ZYOphSxD0IrAYy9vW+3o/KdPK0wvmr+P9iYQGqjKNfCFwweyks3Hfp3cTfxP9q7hE7FUFXVg6q1xBt20FHI1okvPgreQTfMNbiRnDzo6m9B9LuXv3puxbtMadlR8xp1RGzWrRXBD6jWVtMa9Ia08JaYlpIc8wIisB3gU0w3y8My7xDsd4zGLvcg3HapTHS7IJAtk2pzD6Y9pnb7X2WsZam1/z/ib9UHtWVsX4/SmYxesmaciRL+p5J+EBieJdJfNhdRXiNqfirkhl/TTLnrzIzPoSZ8Qnm9vSjrRedtvdav/xXouvfQcevbe0uZH01kQQVi0GcYSB4eIWpVxTgPgp2oQTCIihWoEZ5HwQnb34+pQ5/lxYx5aDKX6KhMT/v5jsusV0P9eWeT9Lslh0N0yNa47tm7TAjog2mR7TBtCatMCW0BSYHN8Pkxk3xbUA4pvmFYpZPMOZ7NMZyt0bY6BKI3Y4BiLJvhHqrUNKrAuiM5BD/qXLW1j+Pv6QAd2H1GZOmRUkWRJIVXZDMMFmxBsI1SHwYU/G3JBV/k5kp7W1mzl9XfjY3LLJyoUP2PrUHbd0n/daK4a+hL2MfbWnfsUp/4iRxMcJra8F1Ws4FueNPCqC/TwFqAbUa2LOPTkY0ix38ryweClYw1i26Wbvryd0H0Jq2j9CUsBaY2aQVZoS3wtSwFpgS0hzf3hX6pMBwfO0Xyr/2CcJUz8aY5R6IBS4BWOHoj032fjhi44scywAis0Z0XXKrnc6kyb+2gvgfjSaMdVshWVxVq6ypRrKiDUyluIUPhVVgKj6cqfA2U+EdyYwPl8z5CGbB32LmfIzKhrbZe9MJ14DorfauD5L9Y4rgHxycLgreHi5Gv6Bhl2UuYGoBxMjnl6/Scsa2iDI0044Ei8e54LD5MV364GiXR2lGSHNMDW6G6SEtMC24Gb4NisDXjZtgUkAYJviF4CufIEzyaoRvPQIw3dUfs519sdDBByttvbHN2gs3LX0MBpUf5TB3Ws+stgUpE5v/bpi/pVJ9c1Ky0pBkRzGShWEeY/iUMXwiqTBKMsP7ojFzPpJZiKki/4BZ8feYJZ9p5UIH3YPojGfg9nlWv80DbIqZLm6T6fYdRQG4IHJUrIDeqADCHSgxQB0M4NAdP0ETf8H8HrG1feJm9z4pN598kRZFtKNvA8MwvXEEpjVuiqmNmmByYDif6BeKCT5BmOjVCBPcA/C1ix+mOPtipoM35tt5Y5mNJ9ZZeeCkuTvKVV6klTzpkGQbP5ixZ0yv918NC8ZaLpYsTpWr7EiW7Gg/M8MUiWG8pMI4ZoZPmRn/kJnzDyVL/pFkxT+RrPmHzIp/zKwNm5386KRXUM0Rd99vjF39PpZ5en9Hd2KICzMviBwFo6dg99TL4IoCaIzmXwSEJ0/T/PvSz4cw5n6tZZs10U89R9u7PUbTAsIwIzAc0wObYFpAOKb4heJr32B87d2YT/QIxCQ3f0x28cVUB2/MsvPCPBsPLLH2wGoLN+w2d0GacoqqJ0UyB/V4pvr6v9LcPyheYKqPj0hWVaRypAzJxrCaSZjCJEyUzPA5M8dnkiXGSpZ8rGTNP5dslPYJs+aTzZ3ouGcwXfcLuXXY2Vkp9/4trPLxmy1OBOW1ysLPXQW4OxMQr2JqWFMDCAtx/CQtVbLDGVtn6/D6zbZdcq70fYbmh7Wi6d6N8V1AOGb4hWKabzCmeAfhW89G+No42vkUJ1/MUATvifnW7lhq6Y7V5q7YpnJClMoZXOVJOZIL/cAs9gT8Nl/Q/xTCp0kWRwslZyLJmc6L/QLGMEMyw1TJEl9LlpgkWfGJkg2fINnyiZId/0qyxxfMDqsdfOhqUDO6GtJ053yFk+mXsdzTdxbdukP6GnF0TY1xIege27dYCxC/11QrAaD62ElRPPLt8YCQzbFtu9O2Fp1ptk8IvvcLxTy/MOU4+BneQXy6RyNMc/PHNBc/THfywQx7L8y28cACaw8st3TDGjMXbFE54YzKEZUqd4LKkw5LdqkvMPai6f01wEik9P5hyb6cJA8qkRzogKTCD5IKCyRLzGFWmClZY7pki+mSHaarHDDd3AnfmjtiuoULHQtoSjdadqg8Exr+xS9RsCkKcDOaxGrfvfUAcdCDUQHuzgDE3+vqUXfsOE44uBsuhbenNY2aGRb6hvLF/uF8gW8on+cVxGd7NOLfuQXwWS5+fJajD59j54X5tp5YbO2OFRauWGvmjC0qRxxSciJcDaTypijJSTeFmYljXv7MBthDjb9jmng/gmcyq715kiuR5Elxki3EItJaZokVkjWWSrZYJNljgcoR882dMdvChc+1dMUsM2esdvSnWy06UVzLdtdPuLk9dn+nK7385gi+PuXIl4pKI5+voHa/ZwHEFFFsEolp4omTOO/ka/jBKwQrfUKx3DeUL/EJ5os8g/j37oF8vrMfX+AoonlvLLb1xApLd6y1cMNmMxfslJxwSLLDLckRXPKgMsmdNkrWxxsruS3/ffg14f/a3x8YzzL2+kHJoUTkGNRKbnSJWWAPs8B2yRabJHuskRyxUuWM5eYuWGrphuXWHlgmmpU7Tgc0o6Rm7SkyKHzLe3f3FlZ5+8+i6zdJWeUrKzduBP1kAYwKIDaDFJbvE6dwytEXm7xC+DrvEL7SK5gv92jMl7kF8mXO/ny5mMbZeWG9jSc2W3pgh5kr9quccZzZ45pkhyozTyKVL51l9vlv3I0l/lshBG0q7Ht/+6X//VEEzGeWO/IlDxK5BtlmzjjPLHCE2eGg5ITdKhf8qHLFFnM3RRCbbL2wyd4X6+x9sMUpgGLD21Nyyw5FB/383pjq4rFAVPfcO5NHWfc3UQBlpbC6GrqTp3DWyR/bPYOxxTOYb/RozNe7NeIbXQL4Fkc/bLX1wW5rb37Q0hMnzNxxjjkjktmhwNILZB1CmSoPWs7MljPGvE2/0P8CTBXgryqBYIF+9ZTkUEAWQaSzaUTJKjtEMVtclFxwSnLFMTN3HLL0wn4bH+y198NeR3/sdgrANntfnPFpSslN29HFRkH1uqvX7p7HU6qcyPWTAtxdA1AUoMqoABec/LDXIxj7PIL5HrfG2OMSiAOOAThq74dTNr64YOmNKJUn4pgjcixcQY5hJIR/WnK69ipjP3M//2swFf7fogSCMnAhM1uXZ+lP5NGOapwaIZPZII654IbKE1ctvHHRxg9n7QNwyqkRTrg0xjHXIBxxDRI/G3J8mxC/ek2p9Rfn7gjmD+Vkznu7gXctgGAG0Rw/iUinABz3CFFK2U66BeG0c2NccAjANVt/3LHyQyrzRJHkDtmjOZF7O0qx9KtarBQP/fFdzP82mAreVAH+kjK8xdiz581c0si3E1FEb6q2DUARc0G2uT9SbAIRZ98IN52DcNUtGJc9QnHRKwzn3UOQ4B0OHnlNyfhRUsPuKoBy6peYBSgKYDymTXv8FGJcGuGKZxiueYXhunsIbjsFIdGuMbIs/FHC3FHvFgFqMYB0nu3pEnPY/cTvnFD2vwZT4f+SIvwVOK5nbEm+X0uip4eTofMAaJkPaqwaodQ5DLnuYUgVmTS+EYjxb4Zo3ybIatQCenG07F0LoCiAWPxRTvr6uQLoTp1FhlAa36ZI8W2KDM8mKHANQ5VVANQ2jUA9Xibq+RqlOIZkr2LsFdOb+xP4pefytw2afxKmwv9bv8gYxvretPO8SS+/S/T5FOLt+0B2DYU6sDWqgtqgKKQNckPbIjOoJYrC20EfdcN4/u89F6AkhuiM6wH3K8DZCyjxb4aCoFYoa9wKtX7NoXUKAu/aHzR2Bql7DqJIyWl5U4W78m/BLz2Xf9tz+/+Nf/cXsdjD2PT8rn05rd5KhjkLDbxTH8gtukDToSdq2vdAeasuqG7fA3pxjpGwAPcHgSJPQFkIqv/plE7d+Uuoa9IB9a26Qo7oAN60AwwTpxMt20J5bXpn7/wDx8z9Sfy7n9k/gn/rl5nEWPtbDh4XaOpcEqeH6id+Cz7gOaVp+/SHrt8z0N+JM84CBPOXWBIWB13fnQbKIi9QnOErFOBKJPRdekPf/hHwN4eDzlwi+m4pJbj4bnr97xv1Dfh3YDtjY3IfebxKCM1wLcqgnzgZ+reGQ//mcOjjEv/vWHnTdYC7S8HKOb1XroE//RKwcbOBbsZR1SvDqq4w9o7ptRrwkGIEYyHRku0ew7hvFOIIfuEc9FNmgKekGc/ivbcUfJ8CyPf2AkT2cHo6KDGZaOchKvRremHTg1O8NOBhwmHGhuZHtMuknQeJysqJi42gu8mhggLOeODz/RagEuJgaCqvIvn9sZTGmNir/5+f1/9H4zHG3GIZW65+dThRWhYpx8SJdX8hcCF4JR1MB1kvG4mhT1yk6ohOqbd/JQO4Af+h2MvYY9nugXdowQ8kqFqUY17vZQaLI+PEQdVfzaQSZr9u3S9wGTfgvwM2NxibVtm7v0xRt4U1MJ4XeCeZtI/0q8xqCPT+N7CJsY55ls5naMZCok27qNI56PKdhkDvfw/JjI0rY5Jg2viXDKIGNKABDWhAAxrQgAY0oAENaEADGtCABjSgAQ1oQAMa0ID/Bvw/W4P669Q8uBMAAAAASUVORK5CYII=); background-repeat:no-repeat; background-position:center; background-size:100% 100%; }
.sn-brand { font-size:15.5px; font-weight:800; color:#fff; margin:6px 4px 2px; letter-spacing:0.3px; }
.sn-menu { display:flex; flex-direction:column; gap:3px; margin-top:12px; }
.nav-item { display:flex; align-items:center; gap:9px; padding:8px 12px; border:none; border-radius:12px; background:transparent; color:var(--text-muted); font-size:12.5px; font-weight:600; cursor:pointer; text-align:left; transition:background-color 0.15s ease, color 0.15s ease; }
.nav-item svg { flex:0 0 auto; }
.nav-item:hover { background:var(--bg-elevated); color:var(--text-primary); }
.nav-item.active { background:linear-gradient(140deg,#e5183a,#8f1024); color:#fff; box-shadow:0 6px 18px rgba(229,24,58,0.35), inset 0 1px 0 rgba(255,255,255,0.2); }
.sn-flex { flex:1; }
.sn-logs-row { display:flex; align-items:center; gap:8px; padding:9px 11px; border-radius:14px; background:var(--bg-card); border:1px solid var(--border); margin-bottom:8px; font-size:11.5px; font-weight:700; color:var(--text-muted); }
.sn-logs-row svg { color:var(--text-dim); flex-shrink:0; }
.sn-logs-row .toggle-switch { margin-left:auto; transform:scale(0.9); transform-origin:right center; }
.sn-status { padding:10px; border-radius:18px; background:var(--bg-card); border:1px solid var(--border); }
.sn-status-row { display:flex; align-items:center; gap:7px; font-size:11.5px; font-weight:700; color:var(--text-primary); }
.sn-bolt { color:var(--ok); display:flex; }
.sn-dot { width:7px; height:7px; border-radius:50%; background:var(--ok); margin-left:auto; box-shadow:0 0 8px rgba(34,197,94,0.8); animation:kd-blink 1.8s ease-in-out infinite; }
.sn-ver { font-size:10px; color:var(--text-dim); font-weight:600; margin-top:4px; letter-spacing:0.5px; }
            /* collapsible sidebar */
            .side-nav { position:relative; transition:width .18s ease; }
            #tom-ui .side-nav { width:58px; }
            #tom-ui .side-nav.open { width:175px; }
            #tom-ui .side-nav .sn-logo { display:none; margin:0 0 10px; }
            #tom-ui .side-nav.open .sn-logo { display:flex; }
            #tom-ui .side-nav .nav-item { padding:10px 0; justify-content:center; gap:0; }
            #tom-ui .side-nav .nav-item > span, #tom-ui .side-nav .sn-brand, #tom-ui .side-nav .sn-logs-row > span, #tom-ui .side-nav .sn-logs-row > svg, #tom-ui .side-nav .sn-status-txt, #tom-ui .side-nav .sn-ver { display:none; }
            #tom-ui .side-nav .sn-logs-row { justify-content:center; }
            #tom-ui .side-nav .sn-logs-row .toggle-switch { margin-left:0; }
            #tom-ui .side-nav.open .nav-item { padding:8px 12px; justify-content:flex-start; gap:9px; }
            #tom-ui .side-nav.open .nav-item > span, #tom-ui .side-nav.open .sn-brand, #tom-ui .side-nav.open .sn-logs-row > span, #tom-ui .side-nav.open .sn-logs-row > svg, #tom-ui .side-nav.open .sn-status-txt, #tom-ui .side-nav.open .sn-ver { display:revert; }
            #tom-ui .side-nav.open .sn-logs-row { justify-content:flex-start; }
            #tom-ui .side-nav.open .sn-logs-row .toggle-switch { margin-left:auto; }
            /* expanded sidebar unified with collapsed rail: dark chips w/ red edge, same active block */
            #tom-ui .side-nav.open .sn-menu { gap:5px; margin-top:14px; }
            #tom-ui .side-nav.open .nav-item { background:#120409; border:1px solid var(--border); border-radius:16px; padding:9px 12px; color:var(--text-muted); box-shadow:0 2px 8px rgba(0,0,0,0.25); transition:background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease; }
            #tom-ui .side-nav.open .nav-item:hover { background:var(--bg-elevated); border-color:rgba(229,24,58,0.45); color:var(--text-primary); }
            #tom-ui .side-nav.open .nav-item.active { background:linear-gradient(140deg,#e5183a,#8f1024); border-color:rgba(255,90,110,0.55); color:#fff; box-shadow:0 6px 18px rgba(229,24,58,0.35), inset 0 1px 0 rgba(255,255,255,0.2); }
            #tom-ui .side-nav.open .nav-item.active:hover { filter:brightness(1.08); }
            #tom-ui .side-nav.open .sn-logo { margin:0 2px 0; }
            #tom-ui .side-nav.open .sn-brand { margin:8px 2px 6px; font-size:13px; letter-spacing:2.2px; color:var(--text-muted); display:flex; align-items:center; gap:7px; }
            #tom-ui .side-nav.open .sn-brand::after { content:''; width:5px; height:5px; border-radius:50%; background:var(--accent); box-shadow:0 0 8px rgba(229,24,58,0.9); }
            .sn-pin { position:static; margin:0 auto 10px; width:34px; height:34px; border-radius:18px; background:#070204; border:1px solid rgba(229,24,58,0.45); color:var(--text-muted); display:flex; align-items:center; justify-content:center; cursor:pointer; z-index:3; box-shadow:0 8px 22px rgba(229,24,58,0.3); transition:color 0.15s ease, background-color 0.15s ease; }
            .sn-pin:hover { color:var(--text-primary); background:var(--bg-elevated); }
            .sn-pin svg { transition:transform .18s ease; }
            #tom-ui .side-nav.open .sn-pin { position:absolute; top:14px; right:8px; margin:0; }
            #tom-ui.nav-pinned .sn-pin svg { transform:rotate(180deg); }
.dash-content { flex:1; display:flex; min-width:0; }
.main-col { flex:1; min-width:0; display:flex; flex-direction:column; }
#tom-header-drag { display:flex; justify-content:space-between; align-items:center; padding:8px 14px; border-bottom:1px solid var(--border-soft); background:linear-gradient(180deg, rgba(42,10,18,0.5), rgba(16,5,8,0.2)); cursor:grab; flex-shrink:0; }
#tom-header-drag:active { cursor:grabbing; }
.tb-label { font-size:11px; font-weight:700; color:var(--text-dim); letter-spacing:1.2px; text-transform:uppercase; }
.tb-actions { display:flex; align-items:center; gap:9px; }
.tb-btn { width:26px; height:26px; border-radius:12px; border:1px solid var(--border); background:var(--bg-card); color:var(--text-muted); display:flex; align-items:center; justify-content:center; cursor:pointer; transition:background-color 0.15s ease, color 0.15s ease; }
            #tom-fx-toggle { width:30px; height:30px; border-radius:10px; border:1px solid rgba(255,90,110,0.6); background:linear-gradient(140deg, rgba(255,45,70,0.20), rgba(143,16,36,0.26)); color:#ffb3c0; box-shadow:0 0 12px rgba(255,45,70,0.45), inset 0 0 8px rgba(255,45,70,0.18); }
            #tom-fx-toggle:hover { color:#fff; box-shadow:0 0 16px rgba(255,45,70,0.7), inset 0 0 10px rgba(255,45,70,0.3); }
            #tom-fx-toggle svg { filter:drop-shadow(0 0 4px rgba(255,90,110,0.85)); }
            #tom-theme-pill { display:flex; align-items:center; gap:6px; height:26px; padding:0 12px 0 8px; border-radius:35px; border:1px solid rgba(255,90,110,0.55); background:linear-gradient(140deg, rgba(255,45,70,0.16), rgba(143,16,36,0.22)); color:#ff8fa0; cursor:pointer; transition:background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease; }
            #tom-theme-pill:hover { background:linear-gradient(140deg, rgba(255,45,70,0.3), rgba(143,16,36,0.35)); color:#fff; border-color:rgba(255,120,140,0.8); box-shadow:0 0 12px rgba(229,24,58,0.4); }
            #tom-theme-pill .tb-btn { width:18px; height:18px; border:none; background:transparent; box-shadow:none; padding:0; color:inherit; }
            #tom-theme-pill .tb-btn:hover { background:transparent; box-shadow:none; color:inherit; }
            #tom-theme-pill .tb-hide-txt { color:inherit; }
            #tom-ui.light #tom-theme-pill { border-color:rgba(63,191,116,0.55); background:linear-gradient(140deg, rgba(34,180,92,0.14), rgba(15,122,62,0.18)); color:#2c8c55; }
            #tom-ui.light #tom-theme-pill:hover { background:linear-gradient(140deg, rgba(34,180,92,0.26), rgba(15,122,62,0.32)); color:#123020; border-color:rgba(22,163,74,0.8); box-shadow:0 0 12px rgba(34,180,92,0.4); }
            #tom-ui.light #tom-fx-toggle { border:1px solid transparent; background:transparent; color:#2c8c55; box-shadow:none; }
            #tom-ui.light #tom-fx-toggle:hover { color:#123020; box-shadow:none; }
            #tom-ui.light #tom-fx-toggle svg { filter:drop-shadow(0 0 4px rgba(34,180,92,0.8)); }
            #tom-toast { position:absolute; left:50%; bottom:20px; transform:translate(-50%, 18px); opacity:0; pointer-events:none; padding:10px 18px 10px 12px; border-radius:24px; font-size:12px; font-weight:700; letter-spacing:0.3px; z-index:9999; display:flex; align-items:center; gap:8px; transition:opacity 0.28s ease, transform 0.28s ease; background:linear-gradient(140deg,#14452f,#0d2f20); color:#7dffa8; border:1px solid rgba(34,180,92,0.55); box-shadow:0 8px 30px rgba(0,0,0,0.5), 0 0 16px rgba(34,180,92,0.25); white-space:nowrap; }
            #tom-toast.show { opacity:1; transform:translate(-50%, 0); }
            #tom-toast .tt-check { width:17px; height:17px; border-radius:50%; background:rgba(34,180,92,0.28); border:1px solid rgba(125,255,168,0.5); display:flex; align-items:center; justify-content:center; font-size:10px; color:#7dffa8; flex:0 0 auto; }
            #tom-ui.light #tom-toast { background:linear-gradient(140deg,#eafff1,#dcfbe9); color:#0a7a3f; border-color:rgba(22,163,74,0.45); box-shadow:0 8px 26px rgba(15,122,62,0.25); }
            #tom-ui.light #tom-toast .tt-check { background:rgba(34,180,92,0.14); border-color:rgba(10,122,63,0.4); color:#0a7a3f; }
.tb-btn:hover { background:var(--bg-elevated); color:var(--text-primary); }
.tb-avatar { display:flex; align-items:center; gap:7px; padding:3px 9px 3px 4px; border-radius:28px; border:1px solid var(--border); background:var(--bg-card); color:var(--text-primary); font-size:11.5px; font-weight:700; cursor:pointer; transition:background-color 0.15s ease; }
.tb-avatar:hover { background:var(--bg-elevated); }
.tb-avatar-ico { width:19px; height:19px; border-radius:50%; background:linear-gradient(145deg,#3a1420,#1d0a0e); border:1px solid var(--accent-deep); display:flex; align-items:center; justify-content:center; color:var(--accent-soft); }
.tb-hide { display:flex; align-items:center; justify-content:center; gap:6px; width:auto; height:26px; padding:0 12px; border-radius:35px; border:1px solid rgba(255,90,110,0.55); background:linear-gradient(140deg, rgba(255,45,70,0.16), rgba(143,16,36,0.22)); color:#ff8fa0; cursor:pointer; transition:background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease; }
.tb-hide:hover { background:linear-gradient(140deg, rgba(255,45,70,0.3), rgba(143,16,36,0.35)); color:#fff; border-color:rgba(255,120,140,0.8); box-shadow:0 0 12px rgba(229,24,58,0.4); }
.tb-hide-txt { font-size:9.5px; font-weight:800; letter-spacing:1.2px; text-transform:uppercase; line-height:1; }
.tb-hide input:checked ~ .tb-hide-txt { text-shadow:0 0 8px rgba(229,24,58,0.8); }
.tb-hide input { display:none; }
.tb-hide input:checked ~ .tb-hide-ico { color:var(--accent); }
.tb-close { width:26px; height:26px; border-radius:12px; border:1px solid rgba(255,45,70,0.4); background:linear-gradient(140deg,#e5183a,#8f1024); color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:filter 0.15s ease; }
.tb-close:hover { filter:brightness(1.12); }
.dash-scroll { scrollbar-width:none; flex:1; min-height:0; overflow-y:hidden; padding:12px 16px 14px; display:flex; flex-direction:column; gap:9px; }
.dash-scroll::-webkit-scrollbar { width:0; height:0; display:none; }
.dash-scroll::-webkit-scrollbar-track { background:transparent; }
.dash-scroll::-webkit-scrollbar-thumb { background:#33121c; border-radius:7px; }
.hero { position:relative; border-radius:21px; overflow:hidden; border:1px solid var(--accent-deep); background:linear-gradient(100deg, #52091a 0%, #260510 52%, #14030a 100%); min-height:124px; flex-shrink:0; box-shadow:0 10px 30px rgba(0,0,0,0.45), inset 0 0 46px rgba(229,24,58,0.10); }
.hero-art { position:absolute; inset:0; pointer-events:none; }
.hero-moon { position:absolute; width:92px; height:92px; border-radius:50%; right:110px; top:-12px; background:radial-gradient(circle at 38% 34%, #ff8fa0 0%, #ff2d46 45%, #9c1126 78%, #7c0e20 100%); box-shadow:0 0 34px 10px rgba(255,45,70,0.45), inset -8px -10px 20px rgba(60,3,12,0.7); animation:kd-glow 4.6s ease-in-out infinite alternate; }
.hero-peak { position:absolute; left:0; bottom:0; width:100%; height:86px; }
.hero-torii { position:absolute; right:16px; bottom:0; width:150px; height:104px; }
.hero-spark { position:absolute; border-radius:50%; background:#ff8fa0; opacity:0; animation:kd-drift 5.4s ease-in-out infinite; }
.hero-spark.s1 { width:3px; height:3px; right:190px; top:34px; }
.hero-spark.s2 { width:2px; height:2px; right:84px; top:64px; animation-delay:2.6s; }
.hero-copy { position:relative; z-index:2; padding:18px 24px; }
.hero-title { font-size:20px; font-weight:800; color:#fff; letter-spacing:-0.2px; }
.hero-red {
    background: linear-gradient(92deg, var(--accent-soft) 0%, var(--accent) 32%, var(--accent) 44%, #ffffff 52%, var(--accent) 60%, var(--accent) 72%, var(--accent-soft) 100%);
    background-size: 300% 100%;
    -webkit-background-clip: text; background-clip: text; color: transparent;
    -webkit-text-fill-color: transparent;
    animation: heroNameFlow 4.5s ease-in-out infinite;
    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.25));
}
@keyframes heroNameFlow { from { background-position: 0% 0; } to { background-position: 300% 0; } }
.hero-sub { font-size:12px; color:var(--text-muted); font-weight:500; margin-top:4px; }
.hero-btn { margin-top:10px; display:inline-flex; align-items:center; gap:6px; background:linear-gradient(140deg,#ff2d46,#c31430); color:#fff; border:1px solid rgba(255,90,110,0.5); font-size:11px; font-weight:800; padding:7px 14px; border-radius:12px; cursor:pointer; box-shadow:0 6px 16px rgba(255,45,70,0.3); transition:filter 0.15s ease; }
.hero-btn:hover { filter:brightness(1.1); }
.stats-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:9px; flex-shrink:0; }
.stat-card { position:relative; overflow:hidden; padding:11px 13px 13px; border-radius:18px; background:var(--bg-card); border:1px solid var(--border); display:flex; flex-direction:column; gap:6px; transition:border-color 0.15s ease; }
.stat-card:hover { border-color:#42161f; }
.stat-top { display:flex; align-items:center; gap:8px; }
.stat-icon { width:25px; height:25px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.stat-label { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:1.1px; color:var(--text-muted); margin-top:1px; }
.stat-val { font-size:24px; font-weight:800; line-height:1; color:var(--text-primary); margin-top:1px; }
.stat-delta { font-size:9.5px; font-weight:700; letter-spacing:0.4px; }
.stat-delta.up { color:#ff5a6e; }
.stat-delta.flat { color:var(--text-dim); }
.stat-card:nth-of-type(1) .stat-icon { background:rgba(255,45,70,0.16); color:#ff5a6e; border:1px solid rgba(255,45,70,0.35); }
.stat-card:nth-of-type(1) { border-color:rgba(255,45,70,0.28); }
.stat-card:nth-of-type(2) .stat-icon { background:rgba(120,130,150,0.14); color:#8a93a6; border:1px solid rgba(138,147,166,0.3); }
.stat-card:nth-of-type(2) .stat-delta { color:var(--text-dim); }
.stat-card:nth-of-type(3) .stat-icon { background:rgba(34,197,94,0.14); color:#34d17a; border:1px solid rgba(34,197,94,0.3); }
.stat-card:nth-of-type(4) .stat-icon { background:rgba(167,139,250,0.14); color:#b49bf8; border:1px solid rgba(167,139,250,0.3); }
.spark { position:absolute; left:0; right:0; bottom:0; width:100%; height:24px; opacity:0.8; pointer-events:none; }
.stat-card:nth-of-type(1) .spark path { stroke:#ff2d46; }
.stat-card:nth-of-type(2) .spark path { stroke:#5b6270; }
.stat-card:nth-of-type(3) .spark path { stroke:#22c55e; }
.stat-card:nth-of-type(4) .spark path { stroke:#a78bfa; }
.spark path { fill:none; stroke-width:2; stroke-linejoin:round; stroke-linecap:round; opacity:0.85; }
.mid-layout { display:grid; grid-template-columns:1.55fr 1fr; gap:9px; flex-shrink:0; position:relative; z-index:10; }
.card-container { background:var(--bg-card); border:1px solid var(--border); border-radius:18px; display:flex; flex-direction:column; padding:10px 12px; min-height:0; }
.card-header { margin-bottom:7px; font-size:12px; font-weight:800; color:var(--text-primary); letter-spacing:0.2px; display:flex; align-items:center; gap:7px; }
.card-header svg { color:var(--accent-soft); }
.analytics-body { display:flex; gap:14px; align-items:center; height:72px; }
.bar-chart { display:flex; align-items:flex-end; justify-content:space-around; height:100%; flex:1; padding-bottom:20px; position:relative; border-bottom:1px solid var(--border); }
.bar-col { display:flex; flex-direction:column; align-items:center; width:30px; position:relative; }
.bar-3d { width:100%; border-radius:5px 5px 0 0; background:linear-gradient(180deg,#ff5a6e,#8f1024); min-height:2px; }
.bar-lbl { font-size:9px; font-weight:800; color:var(--text-dim); position:absolute; bottom:-20px; letter-spacing:0.6px; }
.radial-container { position:relative; width:62px; height:62px; border-radius:50%; background:var(--bg-elevated); border:1px solid var(--border); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.radial-inner { width:44px; height:44px; border-radius:50%; background:var(--bg-base); border:1px solid var(--border); display:flex; flex-direction:column; align-items:center; justify-content:center; position:absolute; z-index:2; }
.circular-chart { position:absolute; width:56px; height:56px; z-index:1; transform:rotate(-90deg); }
.circle-bg { fill:none; stroke:var(--border); stroke-width:3.5; }
.circle { fill:none; stroke-width:4; stroke-linecap:round; stroke:var(--accent); }
.radial-perc { font-size:13px; font-weight:800; color:var(--text-primary); line-height:1; margin-bottom:2px; }
.radial-sub { font-size:8px; font-weight:800; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.6px; }
.options-list { display:flex; flex-direction:column; gap:7px; }
.opt-row { display:flex; justify-content:space-between; align-items:center; padding:3px 0; border-bottom:1px dashed var(--border); }
.opt-row:last-child { border-bottom:none; }
.opt-info { display:flex; flex-direction:column; min-width:0; }
.opt-title { font-size:11.5px; font-weight:700; color:var(--text-primary); }
.opt-desc { font-size:9px; font-weight:600; color:var(--text-dim); margin-top:2px; line-height:1.45; }
.toggle-switch { position:relative; width:30px; height:16px; flex-shrink:0; }
.toggle-switch input { opacity:0; width:0; height:0; position:absolute; }
.toggle-slider { position:absolute; cursor:pointer; inset:0; background-color:#33121c; border-radius:28px; border:1px solid var(--border); }
.toggle-slider:before { position:absolute; content:""; height:10px; width:10px; left:2px; top:2px; background-color:var(--text-muted); border-radius:50%; }
input:checked + .toggle-slider { background:var(--accent-dim); border-color:var(--accent); }
input:checked + .toggle-slider:before { transform:translateX(16px); background-color:var(--accent); }
.bottom-layout { display:grid; grid-template-columns:1fr; gap:0; flex:1 1 auto; min-height:0; }
.seq-card { display:flex; flex-direction:column; min-height:0; overflow:hidden; height:100%; }
.seq-card-wrapper { position:relative; display:flex; flex-direction:column; min-height:0; overflow:hidden; height:100%; }
.seq-header { display:flex; justify-content:space-between; align-items:center; padding:6px 11px 6px; border-bottom:1px solid var(--border); flex-shrink:0; }
.seq-title { font-size:12px; font-weight:800; color:var(--text-primary); display:flex; align-items:center; gap:7px; }
.seq-title svg { color:var(--accent-soft); }
.seq-state { display:flex; align-items:center; gap:6px; font-size:9.5px; font-weight:800; color:var(--accent-soft); letter-spacing:0.5px; }
.seq-state i { width:6px; height:6px; border-radius:50%; background:var(--accent); box-shadow:0 0 8px rgba(255,45,70,0.9); display:inline-block; animation:kd-blink 1.8s ease-in-out infinite; }
.seq-btn-group { display:flex; gap:7px; align-items:center; margin-left:auto; }
.btn-stop-seq { display:none; align-items:center; gap:5px; background:linear-gradient(140deg,#e5183a,#8f1024); color:#fff; border:1px solid rgba(255,90,110,0.4); border-radius:10px; padding:5px 10px; font-size:9.5px; font-weight:800; cursor:pointer; letter-spacing:0.5px; text-transform:uppercase; transition:filter 0.15s ease; }
.btn-stop-seq:hover { filter:brightness(1.12); }
.btn-stop-seq.visible { display:flex; }
.btn-start-seq { display:none; align-items:center; gap:5px; background:var(--bg-elevated); color:var(--text-primary); border:1px solid var(--border); border-radius:10px; padding:5px 10px; font-size:9.5px; font-weight:800; cursor:pointer; letter-spacing:0.5px; text-transform:uppercase; transition:border-color 0.15s ease; }
.btn-start-seq:hover { border-color:var(--accent); }
.btn-start-seq.visible { display:flex; }
.scroll-indicator { display:none; position:absolute; bottom:8px; left:50%; margin-left:-54px; background:var(--bg-elevated); color:var(--text-muted); border:1px solid var(--border); border-radius:10px; padding:3px 10px; font-size:9.5px; font-weight:700; letter-spacing:0.4px; gap:4px; align-items:center; pointer-events:none; z-index:5; }
.scroll-indicator.show { display:flex; }
.task-list { flex:1; overflow-y:auto; display:flex; flex-direction:column; padding:7px 10px 8px; min-height:0; max-height:none; }
.task-list::-webkit-scrollbar { width:6px; }
.task-list::-webkit-scrollbar-track { background:transparent; }
.task-list::-webkit-scrollbar-thumb { background:#33121c; border-radius:7px; }
.task-list.picker-mode { overflow:hidden; padding:0; max-height:none; }
.bottom-layout:has(.task-list.picker-mode) { flex:1 1 auto; min-height:0; }
.task-row { flex-shrink:0; border-radius:21px; background:var(--bg-elevated); border:1px solid var(--border); margin-bottom:7px; position:relative; overflow:hidden; transition:border-color 0.15s ease; }
.task-row:hover { border-color:#42161f; }
.task-row::before { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; background:var(--text-dim); }
.task-row.done::before { background:var(--ok); }
.task-row.failed::before { background:var(--accent); }
.task-row.running::before { background:var(--info); }
.task-row.pending::before { background:var(--warn); }
.task-inner { display:flex; gap:12px; padding:11px 13px; align-items:flex-start; }
.task-icon-wrap { flex-shrink:0; width:38px; height:38px; border-radius:18px; display:flex; align-items:center; justify-content:center; font-size:15px; border:1px solid var(--border); background:var(--bg-card); color:var(--accent-soft); }
.type-game.task-icon-wrap { color:#4db8ff; border-color:rgba(77,184,255,0.3); background:rgba(77,184,255,0.07); }
.type-video.task-icon-wrap { color:#ff5a6e; border-color:rgba(255,90,110,0.3); background:rgba(255,90,110,0.07); }
.type-ach.task-icon-wrap { color:#b49bf8; border-color:rgba(167,139,250,0.3); background:rgba(167,139,250,0.07); }
.type-act.task-icon-wrap { color:#34d17a; border-color:rgba(34,197,94,0.3); background:rgba(34,197,94,0.07); }
.task-body { flex:1; min-width:0; display:grid; grid-template-columns:1fr auto; column-gap:10px; row-gap:6px; align-items:center; padding:2px 0; }
.task-head { grid-column:1 / -1; grid-row:1; display:flex; justify-content:space-between; align-items:center; gap:8px; min-width:0; margin-bottom:0; }
.task-name { flex:1; min-width:0; font-size:13px; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.25; }
.task-type-chip { grid-column:1; grid-row:2; justify-self:start; font-size:8px; font-weight:800; text-transform:uppercase; letter-spacing:0.8px; padding:2px 7px; border-radius:7px; background:var(--bg-card); border:1px solid var(--border); color:var(--text-muted); white-space:nowrap; margin-bottom:0; display:inline-block; }
.task-pill { padding:3px 9px; border-radius:28px; font-size:8.5px; font-weight:800; text-transform:uppercase; letter-spacing:0.6px; flex-shrink:0; }
.pill-done    { background:rgba(34,197,94,0.12);  color:#34d17a;  border:1px solid rgba(34,197,94,0.35); }
.pill-pending { background:rgba(240,180,41,0.12);  color:var(--warn); border:1px solid rgba(240,180,41,0.35); }
.pill-failed  { background:rgba(255,45,70,0.14);  color:#ff5a6e;  border:1px solid rgba(255,45,70,0.4); }
.pill-running { background:rgba(96,165,250,0.12); color:var(--info); border:1px solid rgba(96,165,250,0.35); }
.task-progress-wrap { grid-column:1 / -1; grid-row:3; margin-bottom:0; display:flex; align-items:center; }
.task-progress-bar { width:100%; height:8px; background:#120409; border-radius:10px; overflow:hidden; border:1px solid var(--border-soft); }
.task-progress-fill { height:100%; border-radius:10px; background:linear-gradient(90deg,#ff5a6e,#ff2d46); min-width:4px; }
.task-row.done .task-progress-fill { background:var(--ok); }
.task-row.failed .task-progress-fill { background:var(--accent); }
.task-row.pending .task-progress-fill { background:var(--warn); }
.task-progress-stats { grid-column:1 / -1; grid-row:4; display:flex; justify-content:space-between; align-items:center; gap:9px; margin-top:0; white-space:nowrap; }
.task-prog-nums { font-size:10px; font-weight:600; color:var(--text-dim); }
.task-prog-nums strong { color:var(--text-muted); font-weight:800; }
.task-pct-label { font-size:10px; font-weight:800; color:var(--text-muted); }
.task-error-msg { grid-column:1 / -1; grid-row:5; margin-top:2px; font-size:9px; color:#ff5a6e; background:rgba(255,45,70,0.08); border:1px solid rgba(255,45,70,0.35); border-radius:12px; padding:6px 9px; font-weight:600; line-height:1.4; }
.task-needs-loading { grid-column:1 / -1; grid-row:5; margin-top:2px; font-size:9px; color:var(--warn); background:rgba(240,180,41,0.08); border:1px solid rgba(240,180,41,0.35); border-radius:12px; padding:6px 9px; font-weight:600; line-height:1.4; }
.task-join-btn { grid-column:1 / -1; grid-row:6; margin-top:4px; display:block; width:100%; background:linear-gradient(140deg,#ff2d46,#c31430); color:#fff; border:none; border-radius:10px; padding:6px 9px; font-size:10px; font-weight:800; cursor:pointer; text-align:center; letter-spacing:0.3px; transition:filter 0.15s ease; }
.task-join-btn:hover { filter:brightness(1.1); }
.quest-loading-badge { grid-column:1 / -1; grid-row:5; justify-self:start; margin-top:2px; font-size:8px; color:var(--warn); background:var(--bg-card); border:1px solid rgba(240,180,41,0.4); padding:2px 7px; border-radius:9px; font-weight:800; display:inline-block; margin-top:4px; }
.quest-needs-loading { border-color:rgba(240,180,41,0.4) !important; background:rgba(240,180,41,0.04) !important; }
.task-actions { grid-column:1 / -1; grid-row:6; margin-top:4px; display:flex; }
.task-actions button { background:var(--bg-card); border:1px solid var(--border); border-radius:10px; padding:6px 9px; font-size:10px; font-weight:800; cursor:pointer; color:var(--text-muted); width:100%; transition:border-color 0.15s ease, color 0.15s ease; }
.task-actions button.claim { background:linear-gradient(140deg,#ff2d46,#c31430); color:#fff; border-color:rgba(255,90,110,0.4); }
.task-actions button:hover:not(:disabled) { border-color:var(--accent); color:var(--text-primary); }
.task-actions button.claim:hover:not(:disabled) { filter:brightness(1.1); }
.console-card { display:none; flex-direction:column; min-height:0; grid-column:2; grid-row:1; background:var(--bg-card); border:1px solid var(--border); border-radius:21px; overflow:hidden; }
#tom-ui.rail-on .bottom-layout { grid-template-columns:minmax(0,1fr) 256px; gap:10px; }
#tom-ui.rail-on .console-card { display:flex; }
.console-card-head { display:flex; align-items:center; gap:5px; padding:9px 12px; border-bottom:1px solid var(--border); background:var(--bg-elevated); flex-shrink:0; }
.cc-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.cc-dot.cc-r { background:#ff2d46; }
.cc-dot.cc-y { background:#f0b429; }
.cc-dot.cc-g { background:#22c55e; }
.console-card-title { margin-left:6px; font-size:9.5px; font-weight:800; letter-spacing:1.6px; color:var(--text-muted); text-transform:uppercase; }
.rail-head { display:flex; align-items:center; gap:7px; padding:9px 12px; border-bottom:1px solid var(--border-soft); background:linear-gradient(180deg, rgba(42,10,18,0.55), rgba(16,5,8,0)); flex-shrink:0; }
.rail-head svg { color:var(--accent-soft); flex-shrink:0; }
.rail-head span { font-size:11px; font-weight:800; color:var(--text-primary); letter-spacing:0.2px; flex:1; }
.rail-dot { width:7px; height:7px; border-radius:50%; background:var(--accent); box-shadow:0 0 8px rgba(255,45,70,0.9); animation:kd-blink 1.8s ease-in-out infinite; }
#tom-logs { padding:10px 11px; font-family:Consolas, ui-monospace, monospace; font-size:9.5px; line-height:1.55; flex:1; min-height:0; overflow-y:auto; color:var(--text-primary); }
#tom-logs::-webkit-scrollbar { width:5px; }
#tom-logs::-webkit-scrollbar-track { background:transparent; }
#tom-logs::-webkit-scrollbar-thumb { background:#33121c; border-radius:7px; }
.log-item { margin-bottom:6px; padding-bottom:6px; border-bottom:1px dashed var(--border-soft); word-wrap:break-word; }
.log-item:last-child { border-bottom:none; }
.log-ts { color:var(--text-dim); margin-right:8px; font-weight:600; font-size:9.5px; }
.c-info { color:var(--info); }
.c-success { color:#34d17a; }
.c-err { color:#ff5a6e; font-weight:800; }
.c-warn { color:var(--warn); }
.settings-overlay { position:absolute; inset:0; z-index:30; background:rgba(8,2,4,0.72); display:flex; align-items:center; justify-content:center; opacity:0; pointer-events:none; border-radius:18px; }
.settings-overlay.open { opacity:1; pointer-events:all; }
.settings-panel { background:var(--bg-surface); border:1px solid var(--accent-deep); border-radius:21px; width:460px; max-height:82%; overflow-y:auto; box-shadow:0 20px 50px rgba(0,0,0,0.6); }
.settings-panel::-webkit-scrollbar { width:6px; }
.settings-panel::-webkit-scrollbar-track { background:transparent; }
.settings-panel::-webkit-scrollbar-thumb { background:#33121c; border-radius:7px; }
.settings-header { padding:12px 16px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; position:sticky; top:0; background:var(--bg-surface); z-index:2; border-radius:21px 21px 0 0; }
.settings-title { font-size:13px; font-weight:800; color:var(--text-primary); display:flex; align-items:center; gap:9px; }
.settings-title svg { color:var(--accent-soft); }
.settings-close-btn { background:var(--bg-elevated); border:1px solid var(--border); border-radius:10px; width:26px; height:26px; cursor:pointer; font-size:14px; color:var(--text-muted); display:flex; align-items:center; justify-content:center; transition:background-color 0.15s ease, color 0.15s ease; }
.settings-close-btn:hover { color:var(--text-primary); border-color:var(--accent); }
            .about-overlay { position:absolute; inset:0; z-index:31; background:rgba(8,2,4,0.72); display:flex; align-items:center; justify-content:center; opacity:0; pointer-events:none; border-radius:18px; transition:opacity 0.2s ease; }
            .about-overlay.open { opacity:1; pointer-events:all; }
            .about-panel { background:var(--bg-surface); border:1px solid var(--accent-deep); border-radius:21px; width:660px; max-height:86%; overflow-y:auto; box-shadow:0 20px 50px rgba(0,0,0,0.6); }
            .dc-wrap { display:flex; align-items:center; margin-right:7px; }
            .dc-btn { appearance:none; width:32px; height:32px; flex-shrink:0; display:flex; align-items:center; justify-content:center; border-radius:16px; border:1px solid rgba(88,101,242,0.5); background:rgba(88,101,242,0.16); color:#c5cbff; cursor:pointer; transition:transform 0.18s ease, background-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease; }
            .dc-btn:hover { transform:translateY(-1px) scale(1.08); background:rgba(88,101,242,0.32); color:#fff; box-shadow:0 5px 16px rgba(88,101,242,0.45); }
            .dc-btn:active { transform:scale(0.92); }
            .dc-btn svg { display:block; }
            .dc-tip { max-width:0; opacity:0; overflow:hidden; white-space:nowrap; padding:3px 0; margin-right:0; border-radius:21px; border:1px solid transparent; background:transparent; color:#c5cbff; font-size:10px; font-weight:800; letter-spacing:0.6px; transition:max-width 0.22s ease, opacity 0.18s ease, margin-right 0.22s ease, padding 0.22s ease, transform 0.22s ease, border-color 0.22s ease, background-color 0.22s ease; transform:translateX(8px); pointer-events:none; }
            .dc-wrap:hover .dc-tip { max-width:160px; opacity:1; padding:3px 10px; margin-right:8px; transform:translateX(0); border-color:rgba(88,101,242,0.4); background:rgba(88,101,242,0.12); }
            .dc-tb { width:26px; height:26px; border-radius:12px; }
            .dc-tb svg { width:13px; height:13px; }
            .about-panel::-webkit-scrollbar { width:6px; }
            .about-panel::-webkit-scrollbar-track { background:transparent; }
            .about-panel::-webkit-scrollbar-thumb { background:#33121c; border-radius:7px; }
            .about-hero { padding:22px 26px 20px; text-align:center; border-bottom:1px solid var(--border); background:radial-gradient(480px 220px at 50% -80px, rgba(255,45,70,0.16), transparent 70%); border-radius:21px 21px 0 0; }
            .about-logo { width:52px; height:52px; margin:0 auto 12px; border-radius:23px; background:#070204; border:1px solid rgba(229,24,58,0.45); display:flex; align-items:center; justify-content:center; color:#fff; box-shadow:0 8px 22px rgba(229,24,58,0.4), inset 0 0 16px rgba(255,45,70,0.15); }
            .about-name { font-size:22px; font-weight:800; color:var(--text-primary); letter-spacing:1px; }
            .about-ver { font-size:9.5px; font-weight:700; color:var(--accent-soft); letter-spacing:2px; margin-top:3px; }
            .about-tag { margin-top:13px; font-size:15.5px; font-weight:500; color:var(--text-muted); line-height:1.45; }
            .about-tag strong { color:var(--text-primary); }
            .about-tag .hl { color:var(--accent-soft); font-weight:700; }
            .about-body { padding:18px 18px 16px; }
            .about-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:7px; }
            .about-feat { text-align:center; padding:13px 5px 11px; border-radius:18px; background:var(--bg-card); border:1px solid var(--border-soft); transition:border-color 0.15s ease; }
            .about-feat:hover { border-color:var(--accent-deep); }
            .about-feat-ico { width:32px; height:32px; margin:0 auto 8px; border:1.5px solid var(--accent-soft); border-radius:50%; display:flex; align-items:center; justify-content:center; color:var(--accent-soft); }
            .about-feat-name { font-size:9px; font-weight:800; color:var(--text-primary); letter-spacing:0.7px; text-transform:uppercase; line-height:1.35; margin-bottom:6px; }
            .about-feat-desc { font-size:9px; color:var(--text-dim); line-height:1.5; }
            .about-rows { margin-top:14px; border:1px solid var(--border-soft); border-radius:18px; background:var(--bg-card); overflow:hidden; }
            .about-row { display:flex; justify-content:space-between; align-items:center; padding:9px 14px; font-size:11px; }
            .about-row + .about-row { border-top:1px solid var(--border-soft); }
            .about-row span { color:var(--text-dim); font-weight:600; }
            .about-row b { color:var(--text-primary); font-weight:700; }
            .about-row b.ok { color:var(--ok); }
.settings-body { padding:14px 16px; display:flex; flex-direction:column; gap:14px; }
.settings-section { border-bottom:1px solid var(--border); padding-bottom:14px; }
.settings-section:last-child { border-bottom:none; padding-bottom:0; }
.settings-section-label { font-size:9px; font-weight:800; color:var(--text-dim); text-transform:uppercase; letter-spacing:1.4px; margin-bottom:8px; }
.settings-info-row { display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--text-muted); padding:5px 0; }
.settings-info-val { font-weight:700; color:var(--text-primary); font-size:11px; background:var(--bg-elevated); padding:4px 10px; border-radius:10px; border:1px solid var(--border); }
.settings-input-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
.settings-input-label { font-size:12px; font-weight:600; color:var(--text-muted); }
.settings-input-field { width:76px; padding:6px 10px; border:1px solid var(--border); border-radius:12px; font-size:12px; text-align:center; background:var(--bg-elevated); color:var(--text-primary); }
.settings-input-field:focus { outline:none; border-color:var(--accent); }
.settings-about { background:linear-gradient(140deg, rgba(229,24,58,0.16), rgba(74,12,24,0.3)); border:1px solid rgba(255,45,70,0.35); border-radius:18px; padding:16px 18px; color:var(--text-primary); }
.settings-about-name { font-size:17px; font-weight:800; margin-bottom:5px; letter-spacing:0.4px; }
.settings-about-meta { font-size:11.5px; color:var(--text-muted); display:flex; gap:18px; font-weight:600; }
#tom-picker-form { display:flex; flex-direction:column; flex:1; min-height:0; overflow:hidden; padding:10px 12px; }
.picker-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-shrink:0; }
.picker-title { font-size:13px; font-weight:800; color:var(--text-primary); }
.picker-count { font-size:10.5px; font-weight:700; color:var(--text-muted); background:var(--bg-card); padding:3px 10px; border-radius:10px; border:1px solid var(--border); }
.picker-warning { flex-shrink:0; margin-bottom:6px; padding:6px 10px; background:rgba(240,180,41,0.08); border:1px solid rgba(240,180,41,0.35); border-radius:14px; font-size:10.5px; font-weight:600; color:var(--warn); }
.picker-scroll { flex:1; overflow-y:auto; overflow-x:hidden; min-height:0; }
.picker-scroll::-webkit-scrollbar { width:5px; }
.picker-scroll::-webkit-scrollbar-thumb { background:#33121c; border-radius:7px; }
.picker-quest-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:3px 4px 3px 0; }
.quest-pick { display:flex; align-items:flex-start; gap:9px; padding:10px; border:1px solid var(--border); border-radius:16px; cursor:pointer; background:var(--bg-elevated); transition:border-color 0.15s ease; }
.quest-pick:hover { border-color:var(--accent); }
.quest-pick input { width:15px; height:15px; accent-color:var(--accent); cursor:pointer; flex-shrink:0; margin-top:2px; }
.picker-actions { display:flex; gap:9px; flex-shrink:0; padding-top:10px; border-top:1px solid var(--border); margin-top:7px; }
.btn-start-quests { background:linear-gradient(140deg,#ff2d46,#c31430); color:#fff; flex:2; padding:9px; border-radius:12px; font-weight:800; cursor:pointer; border:1px solid rgba(255,90,110,0.5); font-size:11.5px; transition:filter 0.15s ease; text-transform:uppercase; letter-spacing:0.8px; }
.btn-start-quests:hover { filter:brightness(1.1); }
.btn-deselect { background:var(--bg-elevated); color:var(--text-muted); flex:1; border-radius:14px; font-weight:800; cursor:pointer; border:1px solid var(--border); transition:border-color 0.15s ease, color 0.15s ease; font-size:12px; }
.btn-deselect:hover { border-color:var(--accent); color:var(--text-primary); }
@keyframes kd-glow { from { filter:brightness(0.92); } to { filter:brightness(1.1); } }
@keyframes kd-blink { 0%, 100% { opacity:1; } 50% { opacity:0.35; } }
@keyframes kd-drift { 0%, 100% { opacity:0; transform:translateY(0); } 40% { opacity:0.9; } 80% { opacity:0.2; transform:translateY(-9px); } }
            `;
            style.innerHTML = _themify(style.innerHTML);
            shadowRoot.appendChild(style);

            const _decoyCSS = document.createElement('style');
            _decoyCSS.textContent = '#tom-ui{top:calc(20+(_seeds[0]%5)*1px);left:calc(20+(_seeds[1]%5)*1px);width:calc(680+(_seeds[2]%10)*1px);height:calc(620+(_seeds[3]%8)*1px);border-radius:calc(6+(_seeds[4]%3)*2px)}#tom-orb{width:calc(68+(_seeds[5]%4)*1px);height:calc(68+(_seeds[6]%4)*1px)}.stat-card{padding:calc(14+(_seeds[10]%3)*1px)}.stat-val{font-size:calc(30+(_seeds[11]%2)*1px)}.stat-title{font-size:calc(11+(_seeds[12]%2)*1px)}.dash-title{font-size:calc(20+(_seeds[15]%2)*1px)}.creator-badge{font-size:calc(11+(_seeds[16]%2)*1px)}.btn-quests{padding:calc(9+(_seeds[20]%3)*1px)}.btn-settings{padding:calc(9+(_seeds[21]%3)*1px)}.btn-close{padding:calc(9+(_seeds[22]%3)*1px)}.boot-content{max-width:calc(550+(_seeds[30]%20)*1px);padding:calc(32+(_seeds[31]%4)*1px)}.boot-title{font-size:calc(22+(_seeds[32]%2)*1px)}.boot-title strong{font-size:calc(28+(_seeds[33]%2)*1px)}.boot-warn{font-size:calc(13+(_seeds[34]%2)*1px)}.boot-action{padding:calc(10+(_seeds[36]%3)*1px)}.console-title{font-size:calc(11+(_seeds[40]%2)*1px)}#tom-logs{font-size:calc(11+(_seeds[41]%2)*1px);padding:calc(14+(_seeds[42]%3)*1px)}.task-name{font-size:calc(13+(_seeds[45]%2)*1px)}.task-type-chip{font-size:calc(9+(_seeds[46]%2)*1px)}.task-pill{font-size:calc(9+(_seeds[47]%2)*1px)}.task-row{border-radius:calc(0+(_seeds[48]%2)*2px)}.task-inner{padding:calc(11+(_seeds[49]%3)*1px)}.task-icon-wrap{width:calc(36+(_seeds[50]%4)*1px);height:calc(36+(_seeds[51]%4)*1px)}.task-progress-bar{height:calc(7+(_seeds[53]%2)*1px)}.task-prog-nums{font-size:calc(10+(_seeds[54]%2)*1px)}.picker-title{font-size:calc(13+(_seeds[60]%2)*1px)}.picker-count{font-size:calc(11+(_seeds[61]%2)*1px)}.quest-pick{padding:calc(14+(_seeds[63]%3)*1px)}.btn-start-quests{padding:calc(13+(_seeds[64]%2)*1px)}.btn-deselect{font-size:calc(12+(_seeds[65]%2)*1px)}.seq-title{font-size:calc(14+(_seeds[70]%2)*1px)}.mid-layout{margin-top:calc(0+(_seeds[75]%3)*1px)}.bar-lbl{font-size:calc(10+(_seeds[76]%2)*1px)}.radial-perc{font-size:calc(16+(_seeds[77]%2)*1px)}.opt-title{font-size:calc(13+(_seeds[80]%2)*1px)}.opt-desc{font-size:calc(10+(_seeds[81]%2)*1px)}.toggle-switch{width:calc(36+(_seeds[82]%3)*1px)}.settings-title{font-size:calc(16+(_seeds[85]%2)*1px)}.settings-section-label{font-size:calc(11+(_seeds[86]%2)*1px)}.settings-about-name{font-size:calc(18+(_seeds[88]%2)*1px)}.settings-about-meta{font-size:calc(12+(_seeds[89]%2)*1px)}.bottom-layout{gap:calc(14+(_seeds[90]%3)*1px)}.stats-grid{gap:calc(12+(_seeds[91]%2)*1px)}.header-actions{gap:calc(12+(_seeds[92]%2)*1px)}.header-toggle{padding:calc(8+(_seeds[93]%3)*1px)}.section-wave{height:calc(70+(_seeds[95]%4)*1px)}';
            shadowRoot.appendChild(_decoyCSS);

            root = document.createElement('div');
            root.id = 'tom-ui';
            root.innerHTML = `
                <div id="tom-orb">
                    <span class="tom-logo-img" style="width:32px;height:32px;"></span>
                </div>
                <div class="internal-wrapper">
                                        <div class="boot-layer" id="tom-boot">
                        <div class="boot-art"><div class="hero-moon"></div><svg class="hero-peak" viewBox="0 0 600 90" preserveAspectRatio="none"><path d="M0 90 L0 62 L70 38 L128 58 L190 30 L252 55 L318 22 L390 52 L450 36 L520 58 L600 42 L600 90 Z" fill="#20050c"/><path d="M0 90 L0 74 L90 52 L170 70 L260 42 L340 66 L430 48 L520 68 L600 56 L600 90 Z" fill="#12030a" opacity="0.9"/></svg><svg class="hero-torii" viewBox="0 0 150 104"><path d="M8 18 Q75 2 142 18 L142 26 Q75 12 8 26 Z" fill="#0d0208"/><rect x="16" y="30" width="118" height="9" rx="2" fill="#14040b"/><rect x="30" y="30" width="10" height="74" fill="#0d0208"/><rect x="110" y="30" width="10" height="74" fill="#0d0208"/><rect x="68" y="42" width="14" height="22" fill="#0d0208"/><rect x="68" y="30" width="7" height="12" fill="#1c0510"/></svg></div>
                        <div class="boot-stars"><i style="top:9%;left:14%;animation-delay:.2s"></i><i style="top:16%;left:31%;animation-delay:1.4s"></i><i style="top:7%;left:52%;animation-delay:.8s"></i><i style="top:22%;left:68%;animation-delay:2s"></i><i style="top:11%;left:84%;animation-delay:.5s"></i><i style="top:34%;left:9%;animation-delay:1.9s"></i><i style="top:30%;left:90%;animation-delay:2.8s"></i><i style="top:52%;left:15%;animation-delay:1s"></i><i style="top:58%;left:86%;animation-delay:.1s"></i><i style="top:74%;left:22%;animation-delay:2.4s"></i><i style="top:80%;left:74%;animation-delay:1.6s"></i><i style="top:44%;left:4%;animation-delay:.7s"></i><i style="top:38%;left:95%;animation-delay:2.2s"></i><i style="top:66%;left:7%;animation-delay:1.2s"></i></div>
                        <div class="boot-haze"></div>
                        <div class="boot-content">
                            <div class="boot-sheen"></div>
                            <div class="boot-logo"><span class="tom-logo-img" style="width:48px;height:48px;"></span></div>
                            <h1 class="boot-title"><strong>${CONFIG.NAME}</strong></h1>
                            <div class="boot-lofi">&mdash; the midnight express &mdash;</div>
                            <div class="boot-divider"><i></i><b></b><i></i></div>
                            <div class="boot-ver"><b>${CONFIG.VERSION}</b> &mdash; by ${CONFIG.CREATOR}</div>
                            <div class="boot-warn">Go to settings to customize protocols accordingly before initializing.</div>
                            <div class="boot-action" id="trigger-dive">PRESS TO OPEN</div>
                        </div>
                        </div>
                    </div>                    <div class="dash-layer" id="tom-dash">
                        <aside class="side-nav">
                            <div class="sn-logo"><span class="tom-logo-img" style="width:30px;height:30px;"></span></div>
                            <div class="sn-brand">${CONFIG.NAME}</div>
                            <button class="sn-pin" id="tom-nav-pin" title="Toggle sidebar"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
                            <nav class="sn-menu">
                                <button class="nav-item active" id="nav-dash"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg><span>Dashboard</span></button>
                                <button class="nav-item" id="nav-settings"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9"/></svg><span>Settings</span></button>
                                
                                <button class="nav-item" id="nav-about"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg><span>About</span></button>
                            </nav>
                            <div class="sn-flex"></div>
                            <div class="sn-logs-row">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
                                <span>Logs</span>
                                <label class="toggle-switch sn-logs-tog"><input type="checkbox" id="tom-logs-tog"><span class="toggle-slider"></span></label>
                            </div>
                            <div class="sn-status">
                                <div class="sn-status-row"><span class="sn-bolt"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span><span class="sn-status-txt">System Online</span><span class="sn-dot"></span></div>
                                <div class="sn-ver">${CONFIG.VERSION}</div>
                            </div>
                        </aside>
                        <div class="dash-content">
                            <div class="main-col" id="tom-dash-scroll">
                                <div id="tom-header-drag">
                                    <span class="tb-label">Operations Console</span>
                                    <div class="tb-actions">
                                        <button class="dc-btn dc-tb" id="tom-dc-top" title="Developed by Primo"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2992 12.2992 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg></button>
                                        <div id="tom-theme-pill" title="Toggle white-red theme"><button class="tb-btn" id="tom-fx-toggle" aria-label="Toggle theme"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button><span class="tb-hide-txt">Theme</span></div>

                                        <label class="tb-hide" title="Minimize to orb"><input type="checkbox" id="tom-hide-tog"><svg class="tb-hide-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg><span class="tb-hide-txt">Hide</span></label>
                                        <button id="tom-settings-btn" hidden></button><button class="tb-close" id="tom-stop" title="Terminate"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                                    </div>
                                </div>
                                <div class="dash-scroll">
                                    <div class="hero">
                                        <div class="hero-art"><div class="hero-moon"></div><svg class="hero-peak" viewBox="0 0 600 90" preserveAspectRatio="none"><path d="M0 90 L0 62 L70 38 L128 58 L190 30 L252 55 L318 22 L390 52 L450 36 L520 58 L600 42 L600 90 Z" fill="#20050c"/><path d="M0 90 L0 74 L90 52 L170 70 L260 42 L340 66 L430 48 L520 68 L600 56 L600 90 Z" fill="#12030a" opacity="0.9"/></svg><svg class="hero-torii" viewBox="0 0 150 104"><path d="M8 18 Q75 2 142 18 L142 26 Q75 12 8 26 Z" fill="#0d0208"/><rect x="16" y="30" width="118" height="9" rx="2" fill="#14040b"/><rect x="30" y="30" width="10" height="74" fill="#0d0208"/><rect x="110" y="30" width="10" height="74" fill="#0d0208"/><rect x="68" y="42" width="14" height="22" fill="#0d0208"/><rect x="68" y="30" width="7" height="12" fill="#1c0510"/></svg><i class="hero-spark s1"></i><i class="hero-spark s2"></i></div>
                                        <div class="hero-copy" style="padding-right:170px;">
                                            <div class="hero-title">Welcome back, <span class="hero-red" id="tom-hero-name">${CONFIG.CREATOR}!</span></div>
                                            <div class="hero-sub">Let's get those quests done. &#128640;</div>
                                            <button class="hero-btn" id="tom-open-quests">View Quests <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button>
                                        </div>
                                    </div>
                                    <div class="stats-grid">
                                        <div class="stat-card"><div class="stat-top"><span class="stat-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span><span class="stat-label">Tracked</span></div><div class="stat-val" id="stat-tot">0</div><span class="stat-delta up">&#8593; live</span><svg class="spark" viewBox="0 0 100 28" preserveAspectRatio="none"><path d="M0 24 L12 20 24 22 36 14 48 17 60 10 72 13 84 6 100 9"/></svg></div>
                                        <div class="stat-card"><div class="stat-top"><span class="stat-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg></span><span class="stat-label">Completed</span></div><div class="stat-val" id="stat-done">0</div><span class="stat-delta flat">&#8595; 0%</span><svg class="spark" viewBox="0 0 100 28" preserveAspectRatio="none"><path d="M0 22 L14 23 28 21 42 22 56 20 70 22 84 19 100 21"/></svg></div>
                                        <div class="stat-card"><div class="stat-top"><span class="stat-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg></span><span class="stat-label">Executing</span></div><div class="stat-val" id="stat-run">0</div><span class="stat-delta up">&#8593; +1</span><svg class="spark" viewBox="0 0 100 28" preserveAspectRatio="none"><path d="M0 25 L14 21 28 23 42 15 56 18 70 8 84 12 100 5"/></svg></div>
                                        <div class="stat-card"><div class="stat-top"><span class="stat-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span><span class="stat-label">Manual Action</span></div><div class="stat-val" id="stat-fail">0</div><span class="stat-delta flat">&#8595; 0%</span><svg class="spark" viewBox="0 0 100 28" preserveAspectRatio="none"><path d="M0 10 L16 16 32 12 48 19 64 14 80 22 100 18"/></svg></div>
                                    </div>
                                    <div class="bottom-layout">
                                        <div class="console-card" id="tom-console-card">
                                            <div class="console-card-head"><i class="cc-dot cc-r"></i><i class="cc-dot cc-y"></i><i class="cc-dot cc-g"></i><span class="console-card-title">System Console</span></div>
                                            <div id="tom-logs"></div>
                                        </div>
                                        <div class="card-container seq-card seq-card-wrapper" id="tom-seq-card">
                                            <div class="seq-header">
                                                <div class="seq-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Active Sequence</div>
                                        <span class="seq-state"><i></i>Running</span>
                                            <div class="seq-btn-group">
                                                <button class="btn-stop-seq" id="tom-stop-seq"><svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>Stop</button>
                                                <button class="btn-start-seq" id="tom-start-seq"><svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>Start</button>
                                            </div>
                                            </div>
                                            <div id="tom-body" class="task-list"><div style="text-align:center;padding:18px;color:var(--text-dim);font-weight:600;font-size:12px;">Awaiting instructions...</div></div>
                                            <div class="scroll-indicator" id="tom-scroll-indicator"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>More below</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div><div class="settings-overlay" id="tom-settings-overlay">
                        <div class="settings-panel">
                            <div class="settings-header"><div class="settings-title"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> Settings</div><button class="settings-close-btn" id="tom-settings-close"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
                            <div class="settings-body">
                                <div class="settings-section">
                                    <div class="settings-section-label">Automation</div>
                                    <div class="options-list">
                                        <div class="opt-row"><div class="opt-info"><span class="opt-title">Auto-Enroll</span></div><label class="toggle-switch"><input type="checkbox" id="s-tog-enroll"><span class="toggle-slider"></span></label></div>
                                        <div class="opt-row"><div class="opt-info"><span class="opt-title">Auto-Claim</span></div><label class="toggle-switch"><input type="checkbox" id="s-tog-claim"><span class="toggle-slider"></span></label></div>
                                    </div>
                                </div>
                                <div class="settings-section">
                                    <div class="settings-section-label">Visibility</div>
                                    <div class="options-list">
                                        <div class="opt-row"><div class="opt-info"><span class="opt-title">Stealth (Fake RPC)</span><span class="opt-desc">Simulates real game presence. Keep ON to avoid detection.</span></div><label class="toggle-switch"><input type="checkbox" id="s-tog-rpc"><span class="toggle-slider"></span></label></div>
                                        <div class="opt-row"><div class="opt-info"><span class="opt-title">Exec Fingerprint</span><span class="opt-desc">Sends a stable executable fingerprint with each heartbeat, like a real game session.</span></div><label class="toggle-switch"><input type="checkbox" id="s-tog-fp"><span class="toggle-slider"></span></label></div>
                                        <div class="opt-row"><div class="opt-info"><span class="opt-title">Play Sounds</span></div><label class="toggle-switch"><input type="checkbox" id="s-tog-sound"><span class="toggle-slider"></span></label></div>
                                    </div>
                                </div>
                                <div class="settings-section">
                                    <div class="settings-about">
                                        <div class="settings-about-name">${CONFIG.NAME} ${CONFIG.VERSION}</div>
                                        <div class="settings-about-meta"><span>by ${CONFIG.CREATOR}</span><span>Undetectable</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div><div class="about-overlay" id="tom-about-overlay">
                        <div class="about-panel">
                            <div class="settings-header"><div class="settings-title"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> About</div><div class="dc-wrap" id="tom-dc-wrap"><span class="dc-tip">Developed by Primo</span><button class="dc-btn" id="tom-about-discord" title="Developed by Primo"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2992 12.2992 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg></button></div><button class="settings-close-btn" id="tom-about-close"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
                            <div class="about-hero">
                                <div class="about-logo"><span class="tom-logo-img" style="width:42px;height:42px;"></span></div>
                                <div class="about-name">${CONFIG.NAME}</div>
                                <div class="about-ver">${CONFIG.VERSION} &mdash; USED FOR DISCORD QUESTS</div>
                                <div class="about-tag"><strong>The most advanced and reliable</strong> Discord Quest <span class="hl">Automation</span> tool.</div>
                            </div>
                            <div class="about-body">
                                <div class="about-grid">
                                    <div class="about-feat">
                                        <div class="about-feat-ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div>
                                        <div class="about-feat-name">Auto<br>Complete</div>
                                        <div class="about-feat-desc">Complete all quests automatically</div>
                                    </div>
                                    <div class="about-feat">
                                        <div class="about-feat-ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg></div>
                                        <div class="about-feat-name">All 5 Quests<br>Supported</div>
                                        <div class="about-feat-desc">Supports all Discord daily quests</div>
                                    </div>
                                    <div class="about-feat">
                                        <div class="about-feat-ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-3.5 8-9V5l-8-3-8 3v8c0 5.5 8 9 8 9z"/></svg></div>
                                        <div class="about-feat-name">Anti<br>Detections</div>
                                        <div class="about-feat-desc">Advanced anti-detection technology</div>
                                    </div>
                                    <div class="about-feat">
                                        <div class="about-feat-ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                                        <div class="about-feat-name">Save<br>Time</div>
                                        <div class="about-feat-desc">Complete quests in seconds</div>
                                    </div>
                                    <div class="about-feat">
                                        <div class="about-feat-ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
                                        <div class="about-feat-name">Safe &amp;<br>Reliable</div>
                                        <div class="about-feat-desc">Secure, stable and constantly updated</div>
                                    </div>
                                </div>
                                <div class="about-rows">
                                    <div class="about-row"><span>Name</span><b>${CONFIG.NAME}</b></div>
                                    <div class="about-row"><span>What is this</span><b>Discord Quest Automation tool</b></div>
                                    <div class="about-row"><span>Version</span><b>${CONFIG.VERSION}</b></div>
                                    <div class="about-row"><span>Developed by</span><b>${CONFIG.CREATOR}</b></div>
                                    <div class="about-row"><span>Status</span><b class="ok">&#9679; Secure &amp; Undetectable</b></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
            shadowRoot.appendChild(root);
            boot = shadowRoot.getElementById('tom-boot');

            const dive = () => {
                if (!isBooted) {
                    isBooted = true;
                    boot.classList.add('dived');
                    setTimeout(() => boot.remove(), 1200);
                }
            };
            shadowRoot.getElementById('trigger-dive').addEventListener('click', dive);

            let dragging = false, sx, sy, sl, st, moved = false;
            root.addEventListener('mousedown', e => {
                if (e.target.closest('button, input, label, .task-row, .settings-panel, .console-card')) return;
                if (!root.classList.contains('orb-mode') && !e.target.closest('#tom-header-drag')) return;
                dragging = true; sx = e.clientX; sy = e.clientY; moved = false;
                const rect = root.getBoundingClientRect();
                sl = rect.left; st = rect.top;
                root.style.left = sl + 'px'; root.style.top = st + 'px'; root.style.transform = 'none';
                e.preventDefault();
            });
            window.addEventListener('mousemove', e => {
                if (!dragging) return;
                moved = true;
                root.style.left = (sl + e.clientX - sx) + 'px';
                root.style.top = (st + e.clientY - sy) + 'px';
            });
            window.addEventListener('mouseup', () => {
                if (dragging) {
                    dragging = false;
                    Storage.save('pos', { top: root.style.top, left: root.style.left, transform: '' });
                }
            });

            orbEl = shadowRoot.getElementById('tom-orb');
            // ── success popup (toast) ──
            const toastEl = document.createElement('div');
            toastEl.id = 'tom-toast';
            toastEl.innerHTML = '<span class="tt-check">✔</span><span class="tt-msg"></span>';
            root.appendChild(toastEl);
            let toastTimer = 0;
            const showSuccess = (msg) => {
                try {
                    toastEl.querySelector('.tt-msg').textContent = msg;
                    toastEl.classList.add('show');
                    clearTimeout(toastTimer);
                    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
                } catch (e) {}
            };
            const hideTog = shadowRoot.getElementById('tom-hide-tog');
            hideTog.addEventListener('change', (e) => {
                if (e.target.checked) {
                    root.classList.add('orb-mode');
                    Spark.fire(orbEl, null, () => { OrbRain.start(orbEl); });
                }
                RUNTIME.hidden = e.target.checked;
                _saveSettings();
            });

            // center the window on the screen on first open
            {
                const w = Math.min(900, window.innerWidth * 0.96);
                const h = Math.min(660, window.innerHeight * 0.94);
                root.style.left = Math.max(8, Math.round((window.innerWidth - w) / 2)) + 'px';
                root.style.top = Math.max(8, Math.round((window.innerHeight - h) / 2)) + 'px';
            }
            const savedPos = Storage.load('pos');
            if (savedPos && savedPos.top) {
                const parsePx = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
                const left = parsePx(savedPos.left), top = parsePx(savedPos.top);
                if (left !== null && top !== null) {
                    root.style.left = Math.min(Math.max(0, left), window.innerWidth - 80) + 'px';
                    root.style.top = Math.min(Math.max(0, top), window.innerHeight - 120) + 'px';
                }
            }
            if (RUNTIME.hidden) {
                root.classList.add('orb-mode');
                hideTog.checked = true;
                OrbRain.start(orbEl);
            }

            const orb = orbEl;
            orb.addEventListener('mouseup', (e) => {
                if (!moved) {
                    root.classList.remove('orb-mode');
                    hideTog.checked = false;
                    OrbRain.stop();
                    RUNTIME.hidden = false;
                    _saveSettings();
                }
            });

            { const el = shadowRoot.getElementById('tog-enroll'); el && el.addEventListener('change', e => { RUNTIME.autoEnroll = e.target.checked; _saveSettings(); }); }
            { const el = shadowRoot.getElementById('tog-claim'); el && el.addEventListener('change', e => { RUNTIME.autoClaim = e.target.checked; _saveSettings(); }); }
            { const el = shadowRoot.getElementById('tog-rpc'); el && el.addEventListener('change', e => { RUNTIME.stealthRPC = e.target.checked; _saveSettings(); }); }
            { const el = shadowRoot.getElementById('tog-fp'); el && el.addEventListener('change', e => { RUNTIME.fp = e.target.checked; _saveSettings(); }); }

            const settingsOverlay = shadowRoot.getElementById('tom-settings-overlay');
            const settingsBtn = shadowRoot.getElementById('tom-settings-btn');
            settingsBtn && settingsBtn.addEventListener('click', () => {
                shadowRoot.getElementById('s-tog-enroll').checked = RUNTIME.autoEnroll;
                shadowRoot.getElementById('s-tog-claim').checked = RUNTIME.autoClaim;
                shadowRoot.getElementById('s-tog-rpc').checked = RUNTIME.stealthRPC;
                shadowRoot.getElementById('s-tog-fp').checked = RUNTIME.fp;
                shadowRoot.getElementById('s-tog-sound').checked = RUNTIME.playSound;
                settingsOverlay.classList.add('open');
            });
            shadowRoot.getElementById('tom-settings-close').addEventListener('click', () => settingsOverlay.classList.remove('open'));
            settingsOverlay.addEventListener('click', e => { if (e.target === settingsOverlay) settingsOverlay.classList.remove('open'); });
            const aboutOverlay = shadowRoot.getElementById('tom-about-overlay');
            shadowRoot.getElementById('tom-about-close').addEventListener('click', () => aboutOverlay.classList.remove('open'));
            // ── developer discord: opens their profile ──
            const DEVELOPER_STRIP_URL = 'https://discord.com/users/1544020183901802509';
            const dcBtn = shadowRoot.getElementById('tom-about-discord');
            dcBtn && dcBtn.addEventListener('click', () => {
                try { window.open(DEVELOPER_STRIP_URL, '_blank'); } catch (e) { location.href = DEVELOPER_STRIP_URL; }
                copyDevHandle();
            });
            aboutOverlay.addEventListener('click', e => { if (e.target === aboutOverlay) aboutOverlay.classList.remove('open'); });

            shadowRoot.getElementById('s-tog-enroll').addEventListener('change', e => { RUNTIME.autoEnroll = e.target.checked; _saveSettings(); });
            shadowRoot.getElementById('s-tog-claim').addEventListener('change', e => { RUNTIME.autoClaim = e.target.checked; _saveSettings(); });
            shadowRoot.getElementById('s-tog-rpc').addEventListener('change', e => { RUNTIME.stealthRPC = e.target.checked; _saveSettings(); });
            shadowRoot.getElementById('s-tog-fp').addEventListener('change', e => { RUNTIME.fp = e.target.checked; _saveSettings(); });
            shadowRoot.getElementById('s-tog-sound').addEventListener('change', e => { RUNTIME.playSound = e.target.checked; _saveSettings(); });

            shadowRoot.getElementById('tom-stop').addEventListener('click', () => shutdown());
            
            const stopSeqBtn = shadowRoot.getElementById('tom-stop-seq');
            const startSeqBtn = shadowRoot.getElementById('tom-start-seq');
            
            stopSeqBtn.addEventListener('click', () => {
                RUNTIME.sequenceActive = false;
                Traffic.queue = [];
                for (const fn of RUNTIME.cleanups) { try { fn(); } catch(e){} }
                RUNTIME.cleanups.clear();
                Patcher.clean();
                tasks.clear();
                updateStats();
                const body = shadowRoot.getElementById('tom-body');
                if (body && !body.classList.contains('picker-mode')) {
                    body.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-dim);font-weight:600;font-size:14px;">Sequence Aborted.<br><span style="font-size:11px;font-weight:500;">Ready to Initialize again.</span></div>`;
                }
                toggleSequenceButtons(false);
                log('[System] Sequence completely aborted by user.', 'warn');
            });

            startSeqBtn.addEventListener('click', () => {
                if (onStartSequence) onStartSequence();
            });
            
            shadowRoot.getElementById('tom-open-quests').addEventListener('click', () => openQuestsInternal());
            // ── side rail + topbar wiring ──
            const navIds = { dash: 'nav-dash', quests: 'nav-quests', settings: 'nav-settings', protocols: 'nav-protocols', logs: 'nav-logs', about: 'nav-about' };
            const navEls = {};
            for (const k in navIds) navEls[k] = shadowRoot.getElementById(navIds[k]);
            const dashScroll = shadowRoot.getElementById('tom-dash-scroll');
            const navGlow = () => { const rail = shadowRoot.querySelector('.console-card'); if (rail) { rail.style.boxShadow = 'inset 0 0 0 1px rgba(255,45,70,0.5)'; setTimeout(() => { rail.style.boxShadow = ''; }, 600); } };
            navEls.dash && navEls.dash.addEventListener('click', () => { for (const k in navEls) navEls[k] && navEls[k].classList.toggle('active', k === 'dash'); if (dashScroll) dashScroll.scrollTop = 0; });
            navEls.quests && navEls.quests.addEventListener('click', () => { for (const k in navEls) navEls[k] && navEls[k].classList.toggle('active', k === 'quests'); openQuestsInternal(); });
            navEls.settings && navEls.settings.addEventListener('click', () => { for (const k in navEls) navEls[k] && navEls[k].classList.toggle('active', k === 'settings'); shadowRoot.getElementById('tom-settings-btn').click(); });
            navEls.protocols && navEls.protocols.addEventListener('click', () => { for (const k in navEls) navEls[k] && navEls[k].classList.toggle('active', k === 'protocols'); const mid = shadowRoot.getElementById('tom-dash-mid'); if (mid) mid.style.display = 'grid'; });
            const logsTog = shadowRoot.getElementById('tom-logs-tog');
            const setRail = (on) => { root.classList.toggle('rail-on', !!on); if (logsTog) logsTog.checked = !!on; showSuccess(on ? 'Success — System Console opened' : 'Success — System Console closed'); };
            logsTog && logsTog.addEventListener('change', () => setRail(logsTog.checked));
            navEls.logs && navEls.logs.addEventListener('click', () => { for (const k in navEls) navEls[k] && navEls[k].classList.toggle('active', k === 'logs'); setRail(!root.classList.contains('rail-on')); navGlow(); });
            navEls.about && navEls.about.addEventListener('click', () => { for (const k in navEls) navEls[k] && navEls[k].classList.toggle('active', k === 'about'); shadowRoot.getElementById('tom-about-overlay').classList.add('open'); });

            const snNav = shadowRoot.querySelector('.side-nav');
            const navPinBtn = shadowRoot.getElementById('tom-nav-pin');
            const applyNavState = () => {
                snNav.classList.toggle('open', !!RUNTIME.navPinned);
                root.classList.toggle('nav-pinned', !!RUNTIME.navPinned);
            };
            navPinBtn && navPinBtn.addEventListener('click', () => { RUNTIME.navPinned = !RUNTIME.navPinned; _saveSettings(); applyNavState(); });
            applyNavState();
            const themePill = shadowRoot.getElementById('tom-theme-pill');
            themePill && themePill.addEventListener('click', () => root.classList.toggle('light'));
            const dcTop = shadowRoot.getElementById('tom-dc-top');
            dcTop && dcTop.addEventListener('click', () => {
                const url = 'https://discord.com/users/1544020183901802509';
                try { window.open(url, '_blank'); } catch (e) { location.href = url; }
                copyDevHandle();
            });

            const avBtn = shadowRoot.getElementById('tom-avatar-btn');
            avBtn && avBtn.addEventListener('click', () => shadowRoot.getElementById('tom-settings-btn').click());
            // ── discord identity: show the real logged-in account (retry probe, cached across re-pastes) ──
            let identityDone = false;
            const applyIdentity = (n) => { if (!n) return; identityDone = true; globalThis.__TOMST_USER__ = String(n); const a = shadowRoot.getElementById('tom-avatar-name'); const h = shadowRoot.getElementById('tom-hero-name'); if (a) a.textContent = String(n); if (h) h.textContent = String(n) + '!'; };
            if (typeof globalThis.__TOMST_USER__ === 'string' && globalThis.__TOMST_USER__) applyIdentity(globalThis.__TOMST_USER__);
            const IDENTITY_STATUS_TOKENS = /Do Not Disturb|Invisible|Streaming|Online|Offline|Idle|Custom Status|On Phone/i;
            const tryDomFallback = () => {
                if (identityDone) return;
                try {
                    const tags = document.querySelectorAll('[class*="nameTag"]');
                    let best = '';
                    tags.forEach((node) => {
                        let txt = '';
                        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
                        let t;
                        while ((t = walker.nextNode())) { const v = String(t.nodeValue || '').trim(); if (v) { txt = v; break; } }
                        if (!txt) txt = String(node.textContent || '');
                        txt = txt.split(/\r?\n/)[0].split(IDENTITY_STATUS_TOKENS)[0].replace(/[\u25be\u25bd]+$/, '').trim();
                        if (txt && txt.length <= 40 && (!best || txt.length < best.length)) best = txt;
                    });
                    if (best) applyIdentity(best);
                } catch (e) {}
            };
            const probeIdentity = () => {
                try {
                    const chunks = globalThis.webpackChunkdiscord_app;
                    if (Array.isArray(chunks)) {
                        chunks.push([[Math.random()], {}, (req) => {
                            try {
                                const mods = req.c || {};
                                for (const k in mods) {
                                    const ex = mods[k] && mods[k].exports;
                                    const obj = ex && (ex.default || ex);
                                    if (obj && typeof obj.getCurrentUser === 'function') {
                                        const u = obj.getCurrentUser();
                                        if (u) { applyIdentity(u.globalName || u.displayName || u.username); break; }
                                    }
                                }
                            } catch (e) {}
                        }]);
                    }
                } catch (e) {}
            };
            probeIdentity();
            [350, 900, 2500, 6000, 12000].forEach((ms) => setTimeout(probeIdentity, ms));
            [3000, 6000, 15000].forEach((ms) => setTimeout(tryDomFallback, ms));
            const taskListEl = shadowRoot.getElementById('tom-body');
            const scrollIndicator = shadowRoot.getElementById('tom-scroll-indicator');
            function updateScrollIndicator() {
                if (!taskListEl || !scrollIndicator) return;
                const atBottom = taskListEl.scrollHeight - taskListEl.scrollTop - taskListEl.clientHeight < 16;
                const hasOverflow = taskListEl.scrollHeight > taskListEl.clientHeight + 10;
                scrollIndicator.classList.toggle('show', hasOverflow && !atBottom);
            }
            if (taskListEl) taskListEl.addEventListener('scroll', updateScrollIndicator);
            const origRender = render;
            const _scrollCheck = () => setTimeout(updateScrollIndicator, 100);
        }

        function toggleSequenceButtons(isRunning) {
            const stopBtn = shadowRoot.getElementById('tom-stop-seq');
            const startBtn = shadowRoot.getElementById('tom-start-seq');
            if (isRunning) {
                if (stopBtn) stopBtn.classList.add('visible');
                if (startBtn) startBtn.classList.remove('visible');
            } else {
                if (stopBtn) stopBtn.classList.remove('visible');
                if (startBtn) startBtn.classList.add('visible');
                const st = shadowRoot.querySelector('.seq-state');
                if (st) { st.innerHTML = '<i></i>' + (isRunning ? 'Running' : 'Idle'); st.style.color = isRunning ? '' : 'var(--text-dim)'; const d = st.querySelector('i'); if (d) { d.style.background = isRunning ? '' : 'var(--text-dim)'; d.style.boxShadow = isRunning ? '' : 'none'; d.style.animation = isRunning ? '' : 'none'; } }
            }
        }

        function updateStats() {
            let tot = tasks.size, done = 0, run = 0, fail = 0;
            const stats = { game: 0, video: 0, ach: 0, act: 0 };
            tasks.forEach(t => {
                if (t.done) done++;
                else if (t.failed || t.actionRequired) fail++;
                else run++;
                if (t.type === 'GAME') stats.game++;
                else if (t.type === 'WATCH_VIDEO' || t.type === 'VIDEO') stats.video++;
                else if (t.type === 'ACHIEVEMENT') stats.ach++;
                else if (t.type === 'ACTIVITY') stats.act++;
            });
            shadowRoot.getElementById('stat-tot').textContent = tot;
            shadowRoot.getElementById('stat-done').textContent = done;
            shadowRoot.getElementById('stat-run').textContent = run;
            shadowRoot.getElementById('stat-fail').textContent = fail;
            const perc = tot === 0 ? 0 : Math.round((done / tot) * 100);
            { const rf = shadowRoot.getElementById('radial-fill'); rf && rf.setAttribute('stroke-dasharray', `${perc}, 100`); }
            { const rt = shadowRoot.getElementById('radial-txt'); rt && (rt.textContent = `${perc}%`); }
            const doable = [...tasks.values()].filter(t => !t.needsLoading && t.actionRequired !== 'ENROLL' && !Tasks.skipped.has(t.id));
            const max = Math.max(1, stats.game, stats.video, stats.ach, stats.act);
            ['game','vid','ach','act'].forEach(k => {
                const el = shadowRoot.getElementById(`bar-${k}`);
                if (el) el.style.height = `${(stats[k] / max) * 100}%`;
            });
        }

        function render() {
            const body = shadowRoot.getElementById('tom-body');
            if (!body || shadowRoot.getElementById('tom-picker-form')) return;
            { const midEl = shadowRoot.getElementById('tom-dash-mid'); if (midEl) midEl.style.display = 'grid'; }
            if (!tasks.size) return body.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-dim);font-weight:600;">Operations Idle...</div>`;
                const sorted = [...tasks.entries()].sort((a,b) => ((a[1].done||a[1].failed)?3:(a[1].pending?2:1))-((b[1].done||b[1].failed)?3:(b[1].pending?2:1)));
            body.innerHTML = sorted.map(([id, t]) => {
                let statusTxt = t.status === 'CLAIMED' ? 'Secured' : t.needsLoading ? 'Needs Join' : t.done ? 'Finished' : t.failed ? 'Failed' : t.pending ? 'Queued' : 'Executing';
                let stateCls = t.done ? 'done' : t.failed ? 'failed' : t.needsLoading ? 'pending' : t.pending ? 'pending' : 'running';
                let pillCls = t.needsLoading ? 'pill-pending' : `pill-${stateCls}`;
                let actionBtn = '';
                if (t.claimable) actionBtn = `<button class="claim claim-btn" data-id="${id}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px;"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg> Claim Reward</button>`;
                else if (t.actionRequired === 'CLAIM_MANUAL') actionBtn = `<button class="task-join-btn claim-manual-btn" data-id="${id}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px;"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg> Open Quests to Claim</button>`;
                else if (t.actionRequired) actionBtn = `<button disabled>Open Activity</button>`;
                const pct = Math.round(Math.min(100, ((t.cur || 0) / (t.max || 1)) * 100));
                const typeMap = {
                    WATCH_VIDEO: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 9l5 3-5 3z"/></svg>',
                    VIDEO: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 9l5 3-5 3z"/></svg>',
                    GAME: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h4M8 10v4M15 11h.01M18 13h.01"/><path d="M17.32 5H6.68a4 4 0 0 0-3.98 3.61L2 16a3 3 0 0 0 5.18 2.09l2.1-2.1a1 1 0 0 1 .7-.29h4.04a1 1 0 0 1 .7.29l2.1 2.1A3 3 0 0 0 22 16l-.7-7.39A4 4 0 0 0 17.32 5z"/></svg>',
                    STREAM: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M4.93 19.07a10 10 0 0 1 0-14.14M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
                    ACHIEVEMENT: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4z"/><path d="M7 6H4a2 2 0 0 0 2 4M17 6h3a2 2 0 0 1-2 4"/></svg>',
                    ACTIVITY: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>'
                };
                const typeIcon = typeMap[t.type] || '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 5l8 7-8 7z"/></svg>';
                const typeClass = { WATCH_VIDEO:'type-video', VIDEO:'type-video', GAME:'type-game', STREAM:'type-game', ACHIEVEMENT:'type-ach', ACTIVITY:'type-act' }[t.type] || '';
                return `<div id="tom-task-${id}" class="task-row ${stateCls}">
                    <div class="task-inner">
                        <div class="task-icon-wrap ${typeClass}">${typeIcon}</div>
                        <div class="task-body">
                            <div class="task-head">
                                <div class="task-name" title="${t.name}">${t.name}</div>
                                <div class="task-pill ${pillCls}">${statusTxt}</div>
                            </div>
                            <div><span class="task-type-chip">${t.type || 'SYSTEM'}</span></div>
                            <div class="task-progress-wrap">
                                <div class="task-progress-bar"><div class="task-progress-fill" style="width:${pct}%"></div></div>
                                <div class="task-progress-stats">
                                    <span class="task-prog-nums"><strong>${Math.floor(t.cur||0)}</strong> / ${t.max||0}</span>
                                    <span class="task-pct-label">${pct}%</span>
                                </div>
                            </div>
                            ${t.error ? `<div class="task-error-msg"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>${t.error}</div>` : ''}
                            ${t.needsLoading ? `<div class="task-needs-loading"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Needs game loaded locally.</div><button class="task-join-btn join-quest-btn" data-open-quests="true"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px;"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg> Open Discord Quests</button>` : ''}
                            ${actionBtn ? `<div class="task-actions">${actionBtn}</div>` : ''}
                        </div>
                    </div>
                </div>`;
            }).join('');

            body.querySelectorAll('.claim-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const qId = btn.dataset.id;
                    const td = tasks.get(qId);
                    if (!td) return;
                    btn.textContent = 'Processing...';
                    btn.disabled = true;
                    try {
                        const res = await Tasks.claimReward(qId);
                        if (res?.body?.claimed_at) {
                            Logger.log('[Claim] Reward secured.', 'success');
                            QuestChime.play(qId, 'claim');
                            updateTask(qId, {...td, status:'CLAIMED', claimable:false});
                            setTimeout(() => removeTask(qId), 2000);
                        } else {
                            throw new Error("Captcha required");
                        }
                    } catch (e) {
                        if (ErrorHandler.isSkippable(e)) {
                            const qs2 = Mods.QuestStore?.quests;
                            const q2 = qs2 instanceof Map ? qs2.get(qId) : null;
                            if (q2?.userStatus?.claimedAt) {
                                Tasks.claimed.add(qId);
                                Logger.log('[Claim] Reward already secured.', 'success');
                                QuestChime.play(qId, 'claim');
                                updateTask(qId, {...td, status:'CLAIMED', claimable:false});
                                setTimeout(() => removeTask(qId), 2000);
                                return;
                            }
                            Logger.log('[Claim] Verification needed. Open Quests menu.', 'warn');
                            updateTask(qId, {...td, claimable: false, actionRequired: 'CLAIM_MANUAL', error: 'Action required to claim reward (Captcha).'});
                            return;
                        }
                        Logger.log('[Claim] Verification needed. Open Quests menu.', 'warn');
                        updateTask(qId, {...td, claimable: false, actionRequired: 'CLAIM_MANUAL', error: 'Action required to claim reward (Captcha).'});
                    }
                });
            });

            body.querySelectorAll('.claim-manual-btn').forEach(btn => {
                btn.addEventListener('click', () => openQuestsInternal());
            });

            body.querySelectorAll('.join-quest-btn').forEach(btn => {
                btn.addEventListener('click', () => openQuestsInternal());
            });
            if (typeof _scrollCheck === 'function') _scrollCheck();
        }

        function updateTask(id, data) {
            const old = tasks.get(id);
            const merged = { ...old, ...data,
                done: (data.status === "COMPLETED" || data.status === "CLAIMED" || old?.done),
                failed: data.status === "FAILED",
                pending: data.status === "PENDING" || data.status === "QUEUE",
            };
            tasks.set(id, merged);
            updateStats();
            if (merged.status === "COMPLETED" && old?.status !== "COMPLETED" && RUNTIME.hidden) {
                try { if (orbEl && orbEl.isConnected) Spark.fire(orbEl, null, null); } catch (e) {}
            }
            
            const row = shadowRoot.getElementById(`tom-task-${id}`);
            if (row && old?.status === merged.status && old?.claimable === merged.claimable && old?.error === merged.error) {
                const progressSpan = row.querySelector('.task-prog-nums');
                if (progressSpan) progressSpan.innerHTML = `<strong>${Math.floor(merged.cur)}</strong> / ${merged.max}`;
                
                const fill = row.querySelector('.task-progress-fill');
                const pct = Math.round(Math.min(100, ((merged.cur || 0) / (merged.max || 1)) * 100));
                if (fill) fill.style.width = `${pct}%`;
                
                const lbl = row.querySelector('.task-pct-label');
                if (lbl) lbl.textContent = `${pct}%`;
                return;
            }
            render();
        }

        function removeTask(id) { tasks.delete(id); updateStats(); render(); }

        function log(msg, type = 'info') {
            const box = shadowRoot.getElementById('tom-logs');
            if (!box) return;
            const el = document.createElement('div');
            el.className = `log-item c-${type}`;
            el.innerHTML = `<span class="log-ts">[${new Date().toLocaleTimeString().split(' ')[0]}]</span> <span>${msg}</span>`;
            box.appendChild(el);
            box.scrollTop = box.scrollHeight;
            while (box.children.length > CONFIG.MAX_LOG_ITEMS) box.firstChild.remove();
        }

        function showQuestPicker(quests) {
            return new Promise(resolve => {
                const body = shadowRoot.getElementById('tom-body');
                const mid = shadowRoot.getElementById('tom-dash-mid');
                if (!body) return resolve({ selectedQuests: new Set() });
                if (mid) mid.style.display = 'none';
                body.parentElement.style.gridColumn = "1 / -1";
                body.classList.add('picker-mode');
                const seqHeader = body.parentElement.querySelector('.seq-header');
                if (seqHeader) seqHeader.style.display = 'none';
                const consoleCard = shadowRoot.getElementById('tom-console-card');
                if (consoleCard) consoleCard.style.display = 'none';
                const NEEDS_LOADING = new Set(['ACHIEVEMENT','ACTIVITY','UNKNOWN']);
                const items = quests.map(q => {
                    const cfg = findTaskCfg(q.config);
                    const tData = Tasks.detectType(cfg, q.config?.application?.id) || {type:'UNKNOWN', target: 1};
                    const needsLoading = NEEDS_LOADING.has(tData.type);
                    const keyName = tData.keyName || (cfg?.tasks ? Object.keys(cfg.tasks)[0] : 'PLAY_ON_DESKTOP');
                    const cur = q.userStatus?.progress?.[keyName]?.value ?? 0;
                    const max = tData.target || 1;
                    const pct = Math.floor(Math.min(100, Math.max(0, (cur / max) * 100)));
                    return { id: q.id, name: q.config?.messages?.questName ?? 'Unknown', type: tData.type, needsLoading, cur, max, pct };
                });
                const hasLoading = items.some(q => q.needsLoading);
                const totalSel = items.length;
                body.innerHTML = `<form id="tom-picker-form">
                    <div class="picker-header">
                        <div class="picker-title">Select operations to inject</div>
                        <div class="picker-count" id="picker-count">${totalSel} selected</div>
                    </div>
                    ${hasLoading ? `<div class="picker-warning"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;margin-right:5px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Quests marked <b>Needs Game Loaded</b> cannot be automated - you'll see a Join button.</div>` : ''}
                    <div class="picker-scroll">
                        <div class="picker-quest-grid">
                            ${items.map(q => `<label class="quest-pick ${q.needsLoading?'quest-needs-loading':''}">
                                <input type="checkbox" name="quests" value="${q.id}" checked>
                                <div style="flex:1;min-width:0;">
                                    <div style="font-weight:700;font-size:13px;color:var(--text-primary);margin-bottom:3px;line-height:1.3;">${q.name}</div>
                                    <div style="font-size:9.5px;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:0.7px;margin-bottom:6px;">Protocol: ${q.type}</div>
                                    ${q.needsLoading?'<span class="quest-loading-badge"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:2px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Needs Game Loaded</span>':''}
                                    <div style="height:6px;background:var(--bg-base);border-radius:7px;overflow:hidden;">
                                        <div style="height:100%;width:${q.pct}%;background:var(--accent);border-radius:7px;"></div>
                                    </div>
                                    <div style="font-size:10px;color:var(--text-muted);text-align:right;margin-top:5px;font-weight:600;">${Math.floor(q.cur)} / ${q.max} <span style="color:var(--text-dim);">(${q.pct}%)</span></div>
                                </div>
                            </label>`).join('')}
                        </div>
                    </div>
                    <div class="picker-actions">
                        <button type="button" class="btn-deselect" id="select-all-btn">Deselect All</button>
                        <button type="submit" class="btn-start-quests"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:middle;margin-right:5px;"><polygon points="5 3 19 12 5 21 5 3"/></svg> Initialize Sequence</button>
                    </div>
                </form>`;
                shadowRoot.getElementById('tom-picker-form').addEventListener('click', e => {
                    if (e.target.id === 'select-all-btn') {
                        e.preventDefault();
                        const cbs = [...e.currentTarget.querySelectorAll('input')];
                        const all = cbs.every(cb => cb.checked);
                        cbs.forEach(cb => cb.checked = !all);
                        e.target.textContent = !all ? 'Deselect All' : 'Select All';
                        const countEl = e.currentTarget.querySelector('#picker-count');
                        if (countEl) countEl.textContent = (!all ? cbs.length : 0) + ' selected';
                    }
                    if (e.target.classList.contains('join-quest-btn')) openQuestsInternal();
                });
                shadowRoot.getElementById('tom-picker-form').addEventListener('change', e => {
                    if (e.target.type === 'checkbox') {
                        const form = e.currentTarget;
                        const cbs = [...form.querySelectorAll('input[type=checkbox]')];
                        const countEl = form.querySelector('#picker-count');
                        if (countEl) countEl.textContent = cbs.filter(c => c.checked).length + ' selected';
                    }
                });
                shadowRoot.getElementById('tom-picker-form').addEventListener('submit', e => {
                    e.preventDefault();
                    body.parentElement.style.gridColumn = "auto";
                    body.classList.remove('picker-mode');
                    if (seqHeader) seqHeader.style.display = '';
                    const consoleCard = shadowRoot.getElementById('tom-console-card');
                    if (consoleCard) consoleCard.style.display = '';
                    const sel = [...e.currentTarget.querySelectorAll('input')].filter(cb => cb.checked).map(cb => cb.value);
                    body.innerHTML = '';
                    toggleSequenceButtons(true);
                    resolve({ selectedQuests: new Set(sel), needsLoadingIds: new Set(items.filter(q => q.needsLoading).map(q => q.id)) });
                });
            });
        }

        return { init, toggleSequenceButtons, tasks, updateTask, removeTask, log, updateStats, render, showQuestPicker };
    })();

    function shutdown() {
        if (!RUNTIME.running) return;
        RUNTIME.running = false;
        RUNTIME.sequenceActive = false;
        Traffic.queue.length = 0;
        Logger.log('[System] Terminating...', 'warn');
        for (const fn of RUNTIME.cleanups) { try { fn(); } catch (e) {} }
        RUNTIME.cleanups.clear();
        Patcher.clean();
        if (RUNTIME.kickInterval) clearInterval(RUNTIME.kickInterval);
        setTimeout(() => {
            if (RUNTIME.hostId) { const h = document.getElementById(RUNTIME.hostId); if (h) h.remove(); }
            const mini = document.getElementById('tom-mini-host'); if (mini) mini.remove();
        }, 1000);
    }

    let noActiveQuests = false;

    async function initFlow() {
        Logger.toggleSequenceButtons(false);
        const getQuests = () => {
            const q = Mods.QuestStore.quests;
            return q instanceof Map ? [...q.values()] : Object.values(q);
        };
        let quests = getQuests().filter(q =>
            !q.userStatus?.completedAt &&
            new Date(q.config?.expiresAt).getTime() > Date.now() &&
            q.id !== CONST.ID &&
            !Tasks.skipped.has(q.id)
        );
        if (!quests.length) {
            noActiveQuests = true;
            Logger.log('[System] No active quests available.', 'warn');
            return;
        }
        noActiveQuests = false;

        const picker = await Logger.showQuestPicker(quests);
        if (!RUNTIME.running || !picker.selectedQuests.size) {
            Logger.toggleSequenceButtons(false);
            return;
        }
        
        runSequence(picker);
    }

    async function runSequence(picker) {
        RUNTIME.sequenceActive = true;
        Tasks.finalized.clear();
        const getQuests = () => {
            const q = Mods.QuestStore.quests;
            return q instanceof Map ? [...q.values()] : Object.values(q);
        };

        while (RUNTIME.sequenceActive && RUNTIME.running) {
            let quests = getQuests();
            const active = quests.filter(q =>
                picker.selectedQuests.has(q.id) &&
                !q.userStatus?.completedAt &&
                new Date(q.config?.expiresAt).getTime() > Date.now() &&
                !Tasks.skipped.has(q.id) &&
                !Tasks.claimed.has(q.id) &&
                !Tasks.finalized.has(q.id) &&
                !['COMPLETED','CLAIMED','FAILED'].includes(Logger.tasks.get(q.id)?.status)
            );
            
            if (!active.length) { 
                Logger.log('[System] All operations complete.', 'success'); 
                break; 
            }

            const shuffled = active.sort(() => Math.random() - 0.5);
            const queues = { video: [], game: [] };
            
            for (const q of shuffled) {
                if (!RUNTIME.sequenceActive) break;
                const cfg = findTaskCfg(q.config);
                const tData = Tasks.detectType(cfg, q.config?.application?.id);
                if (!tData || tData.target <= 0) continue;
                const tInfo = { id: q.id, appId: tData.apps?.[0] ?? q.config?.application?.id ?? 0, name: q.config?.messages?.questName ?? 'Unknown', target: tData.target, type: tData.type, keyName: tData.keyName };

                if (!q.userStatus?.enrolledAt && !RUNTIME.autoEnroll) {
                    Logger.updateTask(tInfo.id, {...tInfo, cur:0, max:tInfo.target, status:'PENDING', actionRequired:'ENROLL'});
                    continue;
                }
                if (Logger.tasks.has(q.id) && Logger.tasks.get(q.id).status === 'RUNNING') continue;

                if (picker.needsLoadingIds.has(q.id)) {
                    Logger.updateTask(tInfo.id, {...tInfo, cur:0, max:tInfo.target, status:'PENDING', needsLoading:true});
                    Tasks.skipped.add(q.id);
                    continue;
                }

                Logger.updateTask(tInfo.id, {...tInfo, cur:0, max:tInfo.target, status:'QUEUE'});
                const taskFunc = async () => {
                    if (!RUNTIME.sequenceActive) return;
                    if (!q.userStatus?.enrolledAt) {
                        try {
                            await Tasks.enrollQuest(q);
                            if (!RUNTIME.sequenceActive) return;
                            await sleep(gaussRandom(TIMING.enroll.mean, TIMING.enroll.std));
                        } catch (e) {
                            if (ErrorHandler.isSkippable(e)) { Tasks.skipped.add(q.id); return Tasks.failTask(q, tInfo, 'Enroll reject'); }
                            return Tasks.failTask(q, tInfo, 'Enroll fail');
                        }
                    }
                    if (!RUNTIME.sequenceActive) return;
                    if (tInfo.type === 'WATCH_VIDEO') return Tasks.VIDEO(q, tInfo, q.userStatus);
                    return Tasks.generic(q, tInfo, tInfo.type==='STREAM'?'STREAM':'GAME', 'PLAY_ON_DESKTOP', q.userStatus);
                };
                
                if (tInfo.type === 'WATCH_VIDEO') queues.video.push(taskFunc);
                else queues.game.push(taskFunc);
            }

            if (queues.game.length) {
                for (const fn of queues.game) {
                    if (!RUNTIME.sequenceActive) break;
                    await fn();
                }
            }
            if (queues.video.length) {
                for (const fn of queues.video) {
                    if (!RUNTIME.sequenceActive) break;
                    await fn();
                }
            }
            if (RUNTIME.sequenceActive) {
                await sleep(rnd(3000, 7000));
            }
        }

        if (RUNTIME.sequenceActive) {
            RUNTIME.sequenceActive = false;
            for (const fn of RUNTIME.cleanups) { try { fn(); } catch(e){} }
            RUNTIME.cleanups.clear();
            Patcher.clean();
            Logger.toggleSequenceButtons(false);
        }
    }

    async function main() {
        if (!Mods) return Logger.log('[Error] No Discord hook.', 'err');
        if (!document.body) {
            await new Promise((resolve) => {
                const w = () => { document.removeEventListener('DOMContentLoaded', w); resolve(); };
                document.addEventListener('DOMContentLoaded', w);
                setTimeout(resolve, 15000);
            });
        }
        _loadPersisted();
        Patcher.maintainPresence();
        Logger.init(initFlow);
        RUNTIME.kickInterval = setInterval(() => {
            if (relink() && noActiveQuests && !RUNTIME.sequenceActive) initFlow();
        }, 15000);
        await initFlow();
    }

    globalThis[_LIVE_KEY] = { kill: shutdown };

    main().catch(e => {
        Logger.log(`[Fatal] ${e.message}`, 'err');
        shutdown();
    });
})();
