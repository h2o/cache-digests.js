/*
 * Copyright (c) 2015,2016 Jxck, DeNA Co., Ltd., Kazuho Oku
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 *
 *
 * Includes a minified SHA256 implementation taken from https://gist.github.com/kazuho/bb8aab1a2946bbf42127d8a6197ad18c,
 * licensed under the following copyright:
 *
 * Copyright (c) 2015,2016 Chen Yi-Cyuan, Kazuho Oku
 *
 * MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */
"use strict";

if (typeof self !== "undefined" && "ServiceWorkerGlobalScope" in self &&
    self instanceof ServiceWorkerGlobalScope) {

    /* ServiceWorker */
    function openCache() {
        return caches.open("v1");
    }
    function logRequest(req) {
        var s = req.method + " " + req.url + "\n";
        for (var nv of req.headers.entries())
            s += nv[0] + ": " + nv[1] + "\n";
        console.log(s);
    }
    function logError(req, msg) {
        console.log(req.url + ":error:" + msg);
    }
    function logInfo(req, msg) {
        console.log(req.url + ":info:" + msg);
    }
    function logDebug(req, msg) {
        console.log(req.url + ":debug:" + msg);
    }
    self.addEventListener('fetch', function(evt) {
        var req = evt.request.clone();
        if (req.method != "GET" || req.url.match(/\/cache-digests\.js(?:\?|$)/)) {
            logInfo(req, "skip");
            return;
        }
        evt.respondWith(openCache().then(function (cache) {
            return cache.match(req).then(function (res) {
                if (res) {
                    logInfo(req, "hit");
                    return res;
                }
                var requestWithDigests = function (digests) {
                    if (digests != null) {
                        var err = null;
                        try {
                            req = new Request(req);
                            req.headers.append("cache-digests", digests);
                            if (req.headers.get("cache-digests") == null)
                                err = "append failed";
                        } catch (e) {
                            err = e;
                        }
                        if (err)
                            logError(req, e);
                    }
                    return fetch(req).then(function (res) {
                        var cached = false;
                        if (res.status == 200) {
                            cache.put(req, res.clone());
                            cached = true;
                        }
                        logInfo(req, "fetched" + (cached ? " & cached" : "") + " with cache-digests:\"" + digests + "\"");
                        return res;
                    });
                };
                if (req.mode == "navigate") {
                    return generateCacheDigests(cache).then(requestWithDigests);
                } else {
                    return requestWithDigests(null);
                }
            });
        }));
    });

} else if (typeof navigator !== "undefined") {

    /* bootstrap, loaded via <script src=...> */
    navigator.serviceWorker.register("/cache-digests.js", {scope: "./"}).then(function(reg) {
        console.log("registered cache-digests.js service worker");
    }).catch(function(e) {
        console.log("failed to register cache-digests.js service worker:" + e);
    });

} else {

    /* test */
    setTimeout(function () {
        var ntests = 0, failed = false;
        function ok(b, name) {
            console.log((b ? "ok" : "not ok" ) + " " + ++ntests + " - " + name);
            if (!b)
                failed = true;
        }
        function is(result, expected, name) {
            if (Array.isArray(result)) {
                if (result.length != expected.length)
                    return ok(false, name);
                for (var i = 0; i != result.length; ++i)
                    if (result[i] !== expected[i])
                        return ok(false, name);
                return ok(true, name);
            } else {
                return ok(result === expected, name);
            }
        }
        is((new BitCoder).gcsEncode([], 2).value, []);
        is((new BitCoder).gcsEncode([3, 10], 2).value, [0b11101100]);
        is((new BitCoder).gcsEncode([1025], 8).value, [0b00001000, 0b00001000]);
        is(base64Encode(["h", "e", "l"].map(function (c) { return c.charCodeAt(0) })), "aGVs");
        is(base64Encode(["h", "e", "l", "l"].map(function (c) { return c.charCodeAt(0) })), "aGVsbA");
        is(base64Encode(["h", "e", "l", "l", "o"].map(function (c) { return c.charCodeAt(0) })), "aGVsbG8");
        is(sha256(""), [0xe3b0c442, 0x98fc1c14, 0x9afbf4c8, 0x996fb924, 0x27ae41e4, 0x649b934c, 0xa495991b, 0x7852b855].map(function (v) { return v | 0; }), "sha256 empty string");
        is(sha256("hello world"), [0xb94d27b9, 0x934d3e08, 0xa52e52d7, 0xda7dabfa, 0xc484efe3, 0x7a5380ee, 0x9088f7ac, 0xe2efcde9].map(function (v) { return v | 0; }), "sha256 hello world");
        console.log("1.." + ntests);
        process.exit(failed ? 127 : 0);
    }, 0);

}

// returns a promise that returns the cache digest value
function generateCacheDigests(cache) {
    var hashes = [];
    return cache.keys().then(function (reqs) {
        // collect 31-bit hashes of fresh responses
        return Promise.all(reqs.map(function (req) {
            var now = Date.now();
            return cache.match(req).then(function (resp) {
                if (resp)
                    hashes.push(sha256(req.url)[7] & 0x7fffffff);
            });
        })).then(function () {
            var pbits = 7;
            var nbits = Math.floor(Math.log(Math.max(hashes.length, 1)) / Math.log(2) + 0.7);
            if (nbits + pbits > 31)
                return null;
            var mask = (1 << pbits + nbits) - 1;
            for (var i = 0; i < hashes.length; ++i)
                hashes[i] &= mask;
            var digestValue = (new BitCoder).addBits(nbits, 5).addBits(pbits, 5).gcsEncode(hashes, pbits).value;
            return base64Encode(digestValue) + "; complete";
        });
    });
}

function BitCoder() {
    this.value = [];
    this.leftBits = 0;
}

BitCoder.prototype.addBit = function (b) {
    if (this.leftBits == 0) {
        this.value.push(0);
        this.leftBits = 8;
    }
    --this.leftBits;
    if (b)
        this.value[this.value.length - 1] |= 1 << this.leftBits;
    return this;
};

BitCoder.prototype.addBits = function (v, nbits) {
    if (nbits != 0) {
        do {
            --nbits;
            this.addBit(v & (1 << nbits));
        } while (nbits != 0);
    }
    return this;
};

BitCoder.prototype.gcsEncode = function (values, bits_fixed) {
    values = values.sort(function (a, b) { return a - b; });
    var prev = -1;
    for (var i = 0; i != values.length; ++i) {
        if (prev == values[i])
            continue;
        var v = values[i] - prev - 1;
        for (var q = v >> bits_fixed; q != 0; --q)
            this.addBit(0);
        this.addBit(1);
        this.addBits(v, bits_fixed);
        prev = values[i];
    }
    return this;
};

var base64Encode = function (buf) {
    var TOKENS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    return function base64Encode(buf) {
        var str = '';
        for (var pos = 0; pos < buf.length; pos += 3) {
            var quad = buf[pos] << 16 | buf[pos + 1] << 8 | buf[pos + 2];
            str += TOKENS[(quad >> 18)] + TOKENS[(quad >> 12) & 63] + TOKENS[(quad >>  6) & 63] + TOKENS[quad & 63];
        }
        str = str.substring(0, str.length - pos + buf.length);
        return str;
    };
}();

var sha256=function(){var r=[-2147483648,8388608,32768,128],o=[24,16,8,0],a=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298];return function(n){var t,e,f,h,c,u,v,d,i,l,A,C,g,s=[],w=!0,b=!1,j=0,k=0,m=0,p=n.length,q=1779033703,x=3144134277,y=1013904242,z=2773480762,B=1359893119,D=2600822924,E=528734635,F=1541459225,G=0;do{for(s[0]=G,s[16]=s[1]=s[2]=s[3]=s[4]=s[5]=s[6]=s[7]=s[8]=s[9]=s[10]=s[11]=s[12]=s[13]=s[14]=s[15]=0,e=k;p>j&&64>e;++j)t=n.charCodeAt(j),128>t?s[e>>2]|=t<<o[3&e++]:2048>t?(s[e>>2]|=(192|t>>6)<<o[3&e++],s[e>>2]|=(128|63&t)<<o[3&e++]):55296>t||t>=57344?(s[e>>2]|=(224|t>>12)<<o[3&e++],s[e>>2]|=(128|t>>6&63)<<o[3&e++],s[e>>2]|=(128|63&t)<<o[3&e++]):(t=65536+((1023&t)<<10|1023&n.charCodeAt(++j)),s[e>>2]|=(240|t>>18)<<o[3&e++],s[e>>2]|=(128|t>>12&63)<<o[3&e++],s[e>>2]|=(128|t>>6&63)<<o[3&e++],s[e>>2]|=(128|63&t)<<o[3&e++]);m+=e-k,k=e-64,j==p&&(s[e>>2]|=r[3&e],++j),G=s[16],j>p&&56>e&&(s[15]=m<<3,b=!0);var H=q,I=x,J=y,K=z,L=B,M=D,N=E,O=F;for(f=16;64>f;++f)v=s[f-15],h=(v>>>7|v<<25)^(v>>>18|v<<14)^v>>>3,v=s[f-2],c=(v>>>17|v<<15)^(v>>>19|v<<13)^v>>>10,s[f]=s[f-16]+h+s[f-7]+c<<0;for(g=I&J,f=0;64>f;f+=4)w?(l=704751109,v=s[0]-210244248,O=v-1521486534<<0,K=v+143694565<<0,w=!1):(h=(H>>>2|H<<30)^(H>>>13|H<<19)^(H>>>22|H<<10),c=(L>>>6|L<<26)^(L>>>11|L<<21)^(L>>>25|L<<7),l=H&I,u=l^H&J^g,i=L&M^~L&N,v=O+c+i+a[f]+s[f],d=h+u,O=K+v<<0,K=v+d<<0),h=(K>>>2|K<<30)^(K>>>13|K<<19)^(K>>>22|K<<10),c=(O>>>6|O<<26)^(O>>>11|O<<21)^(O>>>25|O<<7),A=K&H,u=A^K&I^l,i=O&L^~O&M,v=N+c+i+a[f+1]+s[f+1],d=h+u,N=J+v<<0,J=v+d<<0,h=(J>>>2|J<<30)^(J>>>13|J<<19)^(J>>>22|J<<10),c=(N>>>6|N<<26)^(N>>>11|N<<21)^(N>>>25|N<<7),C=J&K,u=C^J&H^A,i=N&O^~N&L,v=M+c+i+a[f+2]+s[f+2],d=h+u,M=I+v<<0,I=v+d<<0,h=(I>>>2|I<<30)^(I>>>13|I<<19)^(I>>>22|I<<10),c=(M>>>6|M<<26)^(M>>>11|M<<21)^(M>>>25|M<<7),g=I&J,u=g^I&K^C,i=M&N^~M&O,v=L+c+i+a[f+3]+s[f+3],d=h+u,L=H+v<<0,H=v+d<<0;q=q+H<<0,x=x+I<<0,y=y+J<<0,z=z+K<<0,B=B+L<<0,D=D+M<<0,E=E+N<<0,F=F+O<<0}while(!b);return[q,x,y,z,B,D,E,F]}}();
