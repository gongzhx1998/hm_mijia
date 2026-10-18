if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface Login_Params {
    account?: string;
    password?: string;
    loading?: boolean;
    verifyUrl?: string;
    verifying?: boolean;
    stsPassed?: boolean;
    webController?: webview.WebviewController;
}
import router from "@ohos:router";
import promptAction from "@ohos:promptAction";
import webview from "@ohos:web.webview";
import * as MiCloud from "@normalized:N&&&entry/src/main/ets/service/MiCloud&";
import * as Storage from "@normalized:N&&&entry/src/main/ets/service/Storage&";
import { AppConfig, Logger } from "@normalized:N&&&entry/src/main/ets/common/AppConfig&";
import type { UserInfo } from '../model/Models';
const TAG = 'Login';
class Login extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__account = new ObservedPropertySimplePU('', this, "account");
        this.__password = new ObservedPropertySimplePU('', this, "password");
        this.__loading = new ObservedPropertySimplePU(false, this, "loading");
        this.__verifyUrl = new ObservedPropertySimplePU('', this, "verifyUrl");
        this.__verifying = new ObservedPropertySimplePU(false, this, "verifying");
        this.stsPassed = false;
        this.webController = new webview.WebviewController();
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: Login_Params) {
        if (params.account !== undefined) {
            this.account = params.account;
        }
        if (params.password !== undefined) {
            this.password = params.password;
        }
        if (params.loading !== undefined) {
            this.loading = params.loading;
        }
        if (params.verifyUrl !== undefined) {
            this.verifyUrl = params.verifyUrl;
        }
        if (params.verifying !== undefined) {
            this.verifying = params.verifying;
        }
        if (params.stsPassed !== undefined) {
            this.stsPassed = params.stsPassed;
        }
        if (params.webController !== undefined) {
            this.webController = params.webController;
        }
    }
    updateStateVars(params: Login_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__account.purgeDependencyOnElmtId(rmElmtId);
        this.__password.purgeDependencyOnElmtId(rmElmtId);
        this.__loading.purgeDependencyOnElmtId(rmElmtId);
        this.__verifyUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__verifying.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__account.aboutToBeDeleted();
        this.__password.aboutToBeDeleted();
        this.__loading.aboutToBeDeleted();
        this.__verifyUrl.aboutToBeDeleted();
        this.__verifying.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __account: ObservedPropertySimplePU<string>;
    get account() {
        return this.__account.get();
    }
    set account(newValue: string) {
        this.__account.set(newValue);
    }
    private __password: ObservedPropertySimplePU<string>;
    get password() {
        return this.__password.get();
    }
    set password(newValue: string) {
        this.__password.set(newValue);
    }
    private __loading: ObservedPropertySimplePU<boolean>;
    get loading() {
        return this.__loading.get();
    }
    set loading(newValue: boolean) {
        this.__loading.set(newValue);
    }
    private __verifyUrl: ObservedPropertySimplePU<string>;
    get verifyUrl() {
        return this.__verifyUrl.get();
    }
    set verifyUrl(newValue: string) {
        this.__verifyUrl.set(newValue);
    }
    private __verifying: ObservedPropertySimplePU<boolean>;
    get verifying() {
        return this.__verifying.get();
    }
    set verifying(newValue: boolean) {
        this.__verifying.set(newValue);
    }
    private stsPassed: boolean;
    private webController: webview.WebviewController;
    async doLogin(): Promise<void> {
        if (this.account === '' || this.password === '') {
            promptAction.showToast({ message: '请输入账号和密码' });
            return;
        }
        this.loading = true;
        this.verifyUrl = '';
        try {
            const ok = await MiCloud.login(this.account, this.password);
            if (!ok) {
                const url = MiCloud.getNotificationUrl();
                if (url !== '') {
                    // 打开内嵌 WebView 做二次验证：先同步 http 模块的会话 Cookie 到 WebView
                    this.stsPassed = false;
                    this.verifyUrl = url;
                    return;
                }
                promptAction.showToast({ message: '登录失败：请检查账号和密码' });
                return;
            }
            await this.finishLogin();
        }
        catch (e) {
            promptAction.showToast({ message: '登录异常，请检查网络' });
        }
        finally {
            this.loading = false;
        }
    }
    /** 登录成功后进入首页；设备列表后台异步拉取，避免网络卡顿阻断跳转 */
    async finishLogin(): Promise<void> {
        // 先保存登录态并跳转首页（不等待设备列表）
        const user: UserInfo = {
            userId: MiCloud.getUserId(),
            nickname: this.account,
            avatar: '',
            token: 'cloud_session'
        };
        try {
            await Storage.saveObject(AppConfig.KEY_USER, user);
            await Storage.saveString(AppConfig.KEY_TOKEN, 'cloud_session');
        }
        catch (e) {
            Logger.error(TAG, `save user failed: ${e}`);
        }
        promptAction.showToast({ message: '登录成功' });
        router.replaceUrl({ url: 'pages/Home' });
        // 后台异步拉设备列表，成功后再写入存储（首页 onShow 时读取）
        MiCloud.getDevices('cn').then((devices: MiCloud.CloudDevice[]) => {
            Storage.saveObject(AppConfig.KEY_CLOUD_DEVICES, devices);
        }).catch((e: Error) => {
            Logger.error(TAG, `getDevices background failed: ${e}`);
        });
    }
    /**
     * 同步判断某 URL 是否为验证完成回跳地址（callbackLogin 等，直接拦截）。
     */
    isVerifyCallback(url: string): boolean {
        return url.indexOf('callbackLogin') >= 0
            || url.indexOf('/pass/callback') >= 0;
    }
    /** 验证结果检查页：放行让 WebView 继续跳，同时 http 并行 GET 其 callback 参数签发 token */
    isResultCheck(url: string): boolean {
        return url.indexOf('identity/result/check') >= 0;
    }
    /** sts 签发地址：第一次放行让 WebView 写入 serviceToken cookie */
    isStsCallback(url: string): boolean {
        return url.indexOf('sts.api.io.mi.com') >= 0 || url.indexOf('/sts?') >= 0;
    }
    /** 延迟指定毫秒 */
    delay(ms: number): Promise<void> {
        return new Promise<void>((resolve: () => void) => {
            setTimeout(resolve, ms);
        });
    }
    /**
     * http 路径：用 cookieJar 直接 GET result/check 的 callback 地址签发 serviceToken。
     */
    async tryHttpFinish(url: string): Promise<void> {
        if (this.verifying) {
            return;
        }
        this.verifying = true;
        try {
            const accCookie = this.readCookieFromWeb('https://account.xiaomi.com');
            MiCloud.mergeCookieFromWeb(accCookie);
            const ok = await MiCloud.completeLoginAfterVerify(url);
            if (ok) {
                Logger.info(TAG, 'http path success, calling finishLogin');
                await this.finishLogin();
                return;
            }
            // http 路径失败，等 WebView 路径（tryWebFinish）继续尝试，这里不弹 toast
            Logger.error(TAG, 'http finish failed, waiting web path');
        }
        catch (e) {
            Logger.error(TAG, `tryHttpFinish error: ${e}`);
            promptAction.showToast({ message: '登录态获取异常，请重试' });
        }
        finally {
            this.verifying = false;
        }
    }
    /**
     * WebView 路径：sts 跳转放行后，serviceToken 已写入 WebView cookie，延迟读取完成登录。
     */
    async tryWebFinish(): Promise<void> {
        if (this.verifying) {
            return;
        }
        this.verifying = true;
        try {
            await this.delay(2500);
            const stsCookie = this.readCookieFromWeb('https://sts.api.io.mi.com');
            const apiCookie = this.readCookieFromWeb('https://api.io.mi.com');
            const accCookie = this.readCookieFromWeb('https://account.xiaomi.com');
            MiCloud.mergeCookieFromWeb(stsCookie);
            MiCloud.mergeCookieFromWeb(apiCookie);
            let token = MiCloud.extractCookieValue(stsCookie, 'serviceToken');
            if (token === '') {
                token = MiCloud.extractCookieValue(apiCookie, 'serviceToken');
            }
            if (token === '') {
                token = MiCloud.extractCookieValue(accCookie, 'serviceToken');
            }
            Logger.error(TAG, `web path stsCookie=${stsCookie}`);
            if (token !== '') {
                const ok = await MiCloud.completeLoginWithToken(token, `${stsCookie}; ${apiCookie}`);
                if (ok) {
                    await this.finishLogin();
                    return;
                }
            }
            // WebView cookie 里也拿不到，最后再走一次 http 完整链路
            const ok2 = await MiCloud.completeLoginAfterVerify('https://account.xiaomi.com/identity/result/check');
            if (ok2) {
                await this.finishLogin();
                return;
            }
            promptAction.showToast({ message: '验证已通过，但获取登录态失败，请重试' });
        }
        catch (e) {
            Logger.error(TAG, `tryWebFinish error: ${e}`);
            promptAction.showToast({ message: '登录态获取异常，请重试' });
        }
        finally {
            this.verifying = false;
        }
    }
    /**
     * 拦截 WebView 的跳转：验证完成后小米会跳回 callback 约定地址，
     * 此时用保存的登录参数重放 serviceLoginAuth2 完成登录。
     */
    async onVerifyIntercept(url: string): Promise<void> {
        if (this.verifying) {
            return;
        }
        this.verifying = true;
        try {
            Logger.info(TAG, `onVerifyIntercept url=${url}`);
            // 先把 WebView 验证得到的 Cookie 合并进 http 模块会话罐（信任状态绑定在 Cookie 上）
            const accCookie = this.readCookieFromWeb('https://account.xiaomi.com');
            const stsCookie = this.readCookieFromWeb('https://sts.api.io.mi.com');
            const apiCookie = this.readCookieFromWeb('https://api.io.mi.com');
            Logger.info(TAG, `account cookie=${accCookie}`);
            Logger.info(TAG, `sts cookie=${stsCookie}`);
            MiCloud.mergeCookieFromWeb(accCookie);
            MiCloud.mergeCookieFromWeb(stsCookie);
            MiCloud.mergeCookieFromWeb(apiCookie);
            // 用保存的登录参数完成登录（重新拿 ssecurity + serviceToken）
            const ok = await MiCloud.completeLoginAfterVerify(url);
            if (ok) {
                await this.finishLogin();
                return;
            }
            promptAction.showToast({ message: '验证已通过，但获取登录态失败，请重试' });
        }
        catch (e) {
            Logger.error(TAG, `onVerifyIntercept error: ${e}`);
            promptAction.showToast({ message: '登录态获取异常，请重试' });
        }
        finally {
            this.verifying = false;
        }
    }
    /** 从 WebView Cookie 读取指定域的 Cookie 字符串 */
    readCookieFromWeb(domain: string): string {
        try {
            return webview.WebCookieManager.fetchCookieSync(domain);
        }
        catch (e) {
            return '';
        }
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.height('100%');
            Column.backgroundColor('#FFFFFF');
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.verifyUrl !== '') {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        // 二次验证：全屏内嵌浏览器，验证完成后自动登录
                        Column.create();
                        // 二次验证：全屏内嵌浏览器，验证完成后自动登录
                        Column.width('100%');
                        // 二次验证：全屏内嵌浏览器，验证完成后自动登录
                        Column.height('100%');
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create();
                        Row.width('100%');
                        Row.padding({ left: 16, right: 16, top: 12, bottom: 12 });
                    }, Row);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('←');
                        Text.fontSize(20);
                        Text.onClick(() => { this.verifyUrl = ''; });
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('小米账号安全验证');
                        Text.fontSize(16);
                        Text.fontWeight(FontWeight.Medium);
                        Text.margin({ left: 12 });
                    }, Text);
                    Text.pop();
                    Row.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Web.create({ src: this.verifyUrl, controller: this.webController });
                        Web.onControllerAttached(() => {
                            // 同步 http 模块会话 Cookie 到 WebView（含 deviceId，保持会话一致）
                            const sessionCookie = MiCloud.getSessionCookie();
                            if (sessionCookie !== '') {
                                webview.WebCookieManager.configCookieSync('https://account.xiaomi.com', sessionCookie);
                            }
                        });
                        Web.onLoadIntercept((event) => {
                            const url = event.data.getRequestUrl();
                            // 验证结果检查页：放行 WebView 继续跳，同时 http 并行 GET 其 callback 签发 token
                            if (this.isResultCheck(url)) {
                                Logger.info(TAG, `result/check, allow web + http parallel: ${url}`);
                                this.tryHttpFinish(url);
                                return false;
                            }
                            // sts 签发地址：第一次放行让 WebView 写入 serviceToken cookie，随后延迟读取
                            if (this.isStsCallback(url)) {
                                if (!this.stsPassed) {
                                    this.stsPassed = true;
                                    Logger.info(TAG, `sts callback, allow once: ${url}`);
                                    this.tryWebFinish();
                                    return false;
                                }
                                this.onVerifyIntercept(url);
                                return true;
                            }
                            // 其他验证完成回跳（callbackLogin 等）：拦截，由 App 接管
                            if (this.isVerifyCallback(url)) {
                                this.onVerifyIntercept(url);
                                return true;
                            }
                            return false;
                        });
                        Web.width('100%');
                        Web.layoutWeight(1);
                    }, Web);
                    // 二次验证：全屏内嵌浏览器，验证完成后自动登录
                    Column.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.margin({ top: 80 });
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('米家');
                        Text.fontSize(36);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor('#1A1A1A');
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('HarmonyOS 原生版');
                        Text.fontSize(14);
                        Text.fontColor('#999999');
                        Text.margin({ top: 8 });
                    }, Text);
                    Text.pop();
                    Column.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.width('100%');
                        Column.padding({ left: 32, right: 32 });
                        Column.margin({ top: 40 });
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        TextInput.create({ placeholder: '小米账号（手机号/邮箱/小米ID）', text: this.account });
                        TextInput.onChange((v: string) => { this.account = v; });
                        TextInput.height(48);
                        TextInput.margin({ bottom: 16 });
                    }, TextInput);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        TextInput.create({ placeholder: '密码', text: this.password });
                        TextInput.type(InputType.Password);
                        TextInput.onChange((v: string) => { this.password = v; });
                        TextInput.height(48);
                        TextInput.margin({ bottom: 24 });
                    }, TextInput);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Button.createWithLabel(this.loading ? '登录中…' : '登录小米账号');
                        Button.width('100%');
                        Button.height(48);
                        Button.backgroundColor('#FF6700');
                        Button.fontColor('#FFFFFF');
                        Button.enabled(!this.loading);
                        Button.onClick(() => { this.doLogin(); });
                    }, Button);
                    Button.pop();
                    Column.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('登录即代表同意《用户协议》与《隐私政策》');
                        Text.fontSize(12);
                        Text.fontColor('#BBBBBB');
                        Text.textAlign(TextAlign.Center);
                        Text.margin({ top: 24 });
                    }, Text);
                    Text.pop();
                });
            }
        }, If);
        If.pop();
        Column.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
    static getEntryName(): string {
        return "Login";
    }
}
registerNamedRoute(() => new Login(undefined, {}), "", { bundleName: "com.mijia.hm", moduleName: "entry", pagePath: "pages/Login", pageFullPath: "entry/src/main/ets/pages/Login", integratedHsp: "false", moduleType: "followWithHap" });
