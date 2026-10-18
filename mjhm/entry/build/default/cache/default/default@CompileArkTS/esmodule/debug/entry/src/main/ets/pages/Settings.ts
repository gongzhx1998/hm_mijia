if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface SettingsPage_Params {
    nickname?: string;
    version?: string;
}
import router from "@ohos:router";
import * as Storage from "@normalized:N&&&entry/src/main/ets/service/Storage&";
import { AppConfig, Logger } from "@normalized:N&&&entry/src/main/ets/common/AppConfig&";
const TAG = 'Settings';
class SettingsPage extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__nickname = new ObservedPropertySimplePU('', this, "nickname");
        this.__version = new ObservedPropertySimplePU('1.0.0', this, "version");
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: SettingsPage_Params) {
        if (params.nickname !== undefined) {
            this.nickname = params.nickname;
        }
        if (params.version !== undefined) {
            this.version = params.version;
        }
    }
    updateStateVars(params: SettingsPage_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__nickname.purgeDependencyOnElmtId(rmElmtId);
        this.__version.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__nickname.aboutToBeDeleted();
        this.__version.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __nickname: ObservedPropertySimplePU<string>;
    get nickname() {
        return this.__nickname.get();
    }
    set nickname(newValue: string) {
        this.__nickname.set(newValue);
    }
    private __version: ObservedPropertySimplePU<string>;
    get version() {
        return this.__version.get();
    }
    set version(newValue: string) {
        this.__version.set(newValue);
    }
    async aboutToAppear(): Promise<void> {
        const userJson = await Storage.getString(AppConfig.KEY_USER, '');
        if (userJson !== '') {
            try {
                const obj = JSON.parse(userJson) as Record<string, string>;
                this.nickname = String(obj['nickname'] ?? '');
            }
            catch (e) {
                Logger.error(TAG, `parse user failed`);
            }
        }
    }
    async logout(): Promise<void> {
        await Storage.clear(AppConfig.KEY_TOKEN);
        await Storage.clear(AppConfig.KEY_USER);
        await Storage.clear(AppConfig.KEY_CLOUD_DEVICES);
        Logger.info(TAG, 'logged out from settings');
        router.replaceUrl({ url: 'pages/Login' });
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.height('100%');
            Column.backgroundColor('#F5F6F7');
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 顶栏
            Row.create();
            // 顶栏
            Row.width('100%');
            // 顶栏
            Row.padding({ left: 16, right: 16, top: 14, bottom: 10 });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('‹');
            Text.fontSize(28);
            Text.fontColor('#1A1A1A');
            Text.onClick(() => {
                router.back();
            });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('更多设置');
            Text.fontSize(20);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor('#1A1A1A');
            Text.layoutWeight(1);
            Text.textAlign(TextAlign.Center);
            Text.margin({ right: 28 });
        }, Text);
        Text.pop();
        // 顶栏
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Scroll.create();
            Scroll.scrollBar(BarState.Off);
            Scroll.layoutWeight(1);
        }, Scroll);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.padding({ left: 16, right: 16 });
        }, Column);
        // 地区与语言
        this.GroupTitle.bind(this)('地区与语言');
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.backgroundColor('#FFFFFF');
            Column.borderRadius(14);
        }, Column);
        this.RowItem.bind(this)('地区', '中国大陆', false, () => { });
        this.GroupDivider.bind(this)();
        this.RowItem.bind(this)('多语言', '默认', false, () => { });
        Column.pop();
        // 通用
        this.GroupTitle.bind(this)('通用');
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.backgroundColor('#FFFFFF');
            Column.borderRadius(14);
        }, Column);
        this.RowItem.bind(this)('温度单位', '摄氏度', false, () => { });
        this.GroupDivider.bind(this)();
        this.RowItem.bind(this)('快捷开关音效', '开', false, () => { });
        Column.pop();
        // 关于
        this.GroupTitle.bind(this)('关于');
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.backgroundColor('#FFFFFF');
            Column.borderRadius(14);
        }, Column);
        this.RowItem.bind(this)('关于米家鸿蒙版', this.version, false, () => { });
        this.GroupDivider.bind(this)();
        this.RowItem.bind(this)('检查更新', '', true, () => {
            Logger.info(TAG, 'check update: already latest');
        });
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 退出登录
            Text.create('退出登录');
            // 退出登录
            Text.fontSize(16);
            // 退出登录
            Text.fontColor('#E53935');
            // 退出登录
            Text.width('100%');
            // 退出登录
            Text.textAlign(TextAlign.Center);
            // 退出登录
            Text.padding(16);
            // 退出登录
            Text.backgroundColor('#FFFFFF');
            // 退出登录
            Text.borderRadius(14);
            // 退出登录
            Text.margin({ top: 24, bottom: 30 });
            // 退出登录
            Text.onClick(() => {
                this.logout();
            });
        }, Text);
        // 退出登录
        Text.pop();
        Column.pop();
        Scroll.pop();
        Column.pop();
    }
    GroupTitle(title: string, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(title);
            Text.fontSize(13);
            Text.fontColor('#999999');
            Text.width('100%');
            Text.margin({ top: 18, bottom: 8, left: 4 });
        }, Text);
        Text.pop();
    }
    GroupDivider(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.height(0.5);
            Row.backgroundColor('#F0F0F0');
            Row.margin({ left: 16 });
        }, Row);
        Row.pop();
    }
    RowItem(label: string, value: string, chevron: boolean, action: () => void, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.padding(16);
            Row.onClick(() => {
                action();
            });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(label);
            Text.fontSize(16);
            Text.fontColor('#1A1A1A');
            Text.layoutWeight(1);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (value !== '') {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(value);
                        Text.fontSize(14);
                        Text.fontColor('#999999');
                    }, Text);
                    Text.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (chevron) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('›');
                        Text.fontSize(20);
                        Text.fontColor('#CCCCCC');
                        Text.margin({ left: 6 });
                    }, Text);
                    Text.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
        Row.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
    static getEntryName(): string {
        return "SettingsPage";
    }
}
registerNamedRoute(() => new SettingsPage(undefined, {}), "", { bundleName: "com.mijia.hm", moduleName: "entry", pagePath: "pages/Settings", pageFullPath: "entry/src/main/ets/pages/Settings", integratedHsp: "false", moduleType: "followWithHap" });
