if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface q4 {
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
import * as f1 from "@normalized:N&&&entry/src/main/ets/c/e&";
import * as Storage from "@normalized:N&&&entry/src/main/ets/c/h&";
import { i, j } from "@normalized:N&&&entry/src/main/ets/a/b&";
import type { UserInfo } from "../f/g";
const g1 = 'Login';
class r4 extends ViewPU {
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
    setInitiallyProvidedValue(params: q4) {
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
    updateStateVars(params: q4) {
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
            const g5 = await f1.h5(this.account, this.password);
            if (!g5) {
                const url = f1.i5();
                if (url !== '') {
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
    async finishLogin(): Promise<void> {
        const user: UserInfo = {
            userId: f1.getUserId(),
            nickname: this.account,
            avatar: '',
            token: 'cloud_session'
        };
        try {
            await Storage.j5(i.o, user);
            await Storage.k5(i.KEY_TOKEN, 'cloud_session');
        }
        catch (e) {
            j.error(g1, `save user failed: ${e}`);
        }
        promptAction.showToast({ message: '登录成功' });
        router.replaceUrl({ url: 'pages/Home' });
        f1.getDevices('cn').then((devices: f1.l5[]) => {
            Storage.j5(i.u, devices);
        }).catch((e: Error) => {
            j.error(g1, `getDevices background failed: ${e}`);
        });
    }
    isVerifyCallback(url: string): boolean {
        return url.indexOf('callbackLogin') >= 0
            || url.indexOf('/pass/callback') >= 0;
    }
    isResultCheck(url: string): boolean {
        return url.indexOf('identity/result/check') >= 0;
    }
    isStsCallback(url: string): boolean {
        return url.indexOf('sts.api.io.mi.com') >= 0 || url.indexOf('/sts?') >= 0;
    }
    delay(e5: number): Promise<void> {
        return new Promise<void>((f5: () => void) => {
            setTimeout(f5, e5);
        });
    }
    async tryHttpFinish(url: string): Promise<void> {
        if (this.verifying) {
            return;
        }
        this.verifying = true;
        try {
            const c5 = this.readCookieFromWeb('https://account.xiaomi.com');
            f1.m5(c5);
            const d5 = await f1.n5(url);
            if (d5) {
                j.info(g1, 'http path success, calling finishLogin');
                await this.finishLogin();
                return;
            }
            j.error(g1, 'http finish failed, waiting web path');
        }
        catch (e) {
            j.error(g1, `tryHttpFinish error: ${e}`);
            promptAction.showToast({ message: '登录态获取异常，请重试' });
        }
        finally {
            this.verifying = false;
        }
    }
    async tryWebFinish(): Promise<void> {
        if (this.verifying) {
            return;
        }
        this.verifying = true;
        try {
            await this.delay(2500);
            const x4 = this.readCookieFromWeb('https://sts.api.io.mi.com');
            const y4 = this.readCookieFromWeb('https://api.io.mi.com');
            const z4 = this.readCookieFromWeb('https://account.xiaomi.com');
            f1.m5(x4);
            f1.m5(y4);
            let token = f1.o5(x4, 'serviceToken');
            if (token === '') {
                token = f1.o5(y4, 'serviceToken');
            }
            if (token === '') {
                token = f1.o5(z4, 'serviceToken');
            }
            j.error(g1, `web path stsCookie=${x4}`);
            if (token !== '') {
                const b5 = await f1.p5(token, `${x4}; ${y4}`);
                if (b5) {
                    await this.finishLogin();
                    return;
                }
            }
            const a5 = await f1.n5('https://account.xiaomi.com/identity/result/check');
            if (a5) {
                await this.finishLogin();
                return;
            }
            promptAction.showToast({ message: '验证已通过，但获取登录态失败，请重试' });
        }
        catch (e) {
            j.error(g1, `tryWebFinish error: ${e}`);
            promptAction.showToast({ message: '登录态获取异常，请重试' });
        }
        finally {
            this.verifying = false;
        }
    }
    async onVerifyIntercept(url: string): Promise<void> {
        if (this.verifying) {
            return;
        }
        this.verifying = true;
        try {
            j.info(g1, `onVerifyIntercept url=${url}`);
            const t4 = this.readCookieFromWeb('https://account.xiaomi.com');
            const u4 = this.readCookieFromWeb('https://sts.api.io.mi.com');
            const v4 = this.readCookieFromWeb('https://api.io.mi.com');
            j.info(g1, `account cookie=${t4}`);
            j.info(g1, `sts cookie=${u4}`);
            f1.m5(t4);
            f1.m5(u4);
            f1.m5(v4);
            const w4 = await f1.n5(url);
            if (w4) {
                await this.finishLogin();
                return;
            }
            promptAction.showToast({ message: '验证已通过，但获取登录态失败，请重试' });
        }
        catch (e) {
            j.error(g1, `onVerifyIntercept error: ${e}`);
            promptAction.showToast({ message: '登录态获取异常，请重试' });
        }
        finally {
            this.verifying = false;
        }
    }
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
                        Column.create();
                        Column.width('100%');
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
                            const s4 = f1.q5();
                            if (s4 !== '') {
                                webview.WebCookieManager.configCookieSync('https://account.xiaomi.com', s4);
                            }
                        });
                        Web.onLoadIntercept((event) => {
                            const url = event.data.getRequestUrl();
                            if (this.isResultCheck(url)) {
                                j.info(g1, `result/check, allow web + http parallel: ${url}`);
                                this.tryHttpFinish(url);
                                return false;
                            }
                            if (this.isStsCallback(url)) {
                                if (!this.stsPassed) {
                                    this.stsPassed = true;
                                    j.info(g1, `sts callback, allow once: ${url}`);
                                    this.tryWebFinish();
                                    return false;
                                }
                                this.onVerifyIntercept(url);
                                return true;
                            }
                            if (this.isVerifyCallback(url)) {
                                this.onVerifyIntercept(url);
                                return true;
                            }
                            return false;
                        });
                        Web.width('100%');
                        Web.layoutWeight(1);
                    }, Web);
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
registerNamedRoute(() => new r4(undefined, {}), "", { bundleName: "com.mijia.hm", moduleName: "entry", pagePath: "pages/Login", pageFullPath: "entry/src/main/ets/pages/Login", integratedHsp: "false", moduleType: "followWithHap" });
