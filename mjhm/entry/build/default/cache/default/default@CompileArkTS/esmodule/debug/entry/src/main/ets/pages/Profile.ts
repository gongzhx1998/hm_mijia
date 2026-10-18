if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface ProfileTab_Params {
    devices?: Device[];
    homes?: Home[];
    nickname?: string;
    userId?: string;
    /** 登出回调（父组件传入，跳转登录页） */
    onLoggedOut?: () => void;
}
import router from "@ohos:router";
import promptAction from "@ohos:promptAction";
import * as ApiService from "@normalized:N&&&entry/src/main/ets/service/ApiService&";
import * as Storage from "@normalized:N&&&entry/src/main/ets/service/Storage&";
import { AppConfig, Logger } from "@normalized:N&&&entry/src/main/ets/common/AppConfig&";
import type { Home, Device, UserInfo } from '../model/Models';
const TAG = 'Profile';
export class ProfileTab extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__devices = new ObservedPropertyObjectPU([], this, "devices");
        this.__homes = new ObservedPropertyObjectPU([], this, "homes");
        this.__nickname = new ObservedPropertySimplePU('我的', this, "nickname");
        this.__userId = new ObservedPropertySimplePU('', this, "userId");
        this.onLoggedOut = () => { };
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: ProfileTab_Params) {
        if (params.devices !== undefined) {
            this.devices = params.devices;
        }
        if (params.homes !== undefined) {
            this.homes = params.homes;
        }
        if (params.nickname !== undefined) {
            this.nickname = params.nickname;
        }
        if (params.userId !== undefined) {
            this.userId = params.userId;
        }
        if (params.onLoggedOut !== undefined) {
            this.onLoggedOut = params.onLoggedOut;
        }
    }
    updateStateVars(params: ProfileTab_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__devices.purgeDependencyOnElmtId(rmElmtId);
        this.__homes.purgeDependencyOnElmtId(rmElmtId);
        this.__nickname.purgeDependencyOnElmtId(rmElmtId);
        this.__userId.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__devices.aboutToBeDeleted();
        this.__homes.aboutToBeDeleted();
        this.__nickname.aboutToBeDeleted();
        this.__userId.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __devices: ObservedPropertyObjectPU<Device[]>;
    get devices() {
        return this.__devices.get();
    }
    set devices(newValue: Device[]) {
        this.__devices.set(newValue);
    }
    private __homes: ObservedPropertyObjectPU<Home[]>;
    get homes() {
        return this.__homes.get();
    }
    set homes(newValue: Home[]) {
        this.__homes.set(newValue);
    }
    private __nickname: ObservedPropertySimplePU<string>;
    get nickname() {
        return this.__nickname.get();
    }
    set nickname(newValue: string) {
        this.__nickname.set(newValue);
    }
    private __userId: ObservedPropertySimplePU<string>;
    get userId() {
        return this.__userId.get();
    }
    set userId(newValue: string) {
        this.__userId.set(newValue);
    }
    /** 登出回调（父组件传入，跳转登录页） */
    private onLoggedOut: () => void;
    async aboutToAppear(): Promise<void> {
        const user: UserInfo | null = await Storage.getObject<UserInfo>(AppConfig.KEY_USER);
        if (user !== null) {
            this.nickname = user.nickname;
            this.userId = user.userId;
        }
    }
    async refreshStats(): Promise<void> {
        try {
            this.homes = await ApiService.getHomes();
            this.devices = await ApiService.getDevices('');
        }
        catch (e) {
            Logger.error(TAG, `refreshStats failed: ${e}`);
        }
    }
    async logout(): Promise<void> {
        await Storage.clear(AppConfig.KEY_TOKEN);
        await Storage.clear(AppConfig.KEY_USER);
        await Storage.clear(AppConfig.KEY_CLOUD_DEVICES);
        Logger.info(TAG, 'logged out');
        this.onLoggedOut();
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.height('100%');
            Column.backgroundColor('#F5F6F7');
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Scroll.create();
            Scroll.scrollBar(BarState.Off);
            Scroll.layoutWeight(1);
            Scroll.onAppear(() => {
                this.refreshStats();
            });
        }, Scroll);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 用户卡（深色，对标原版）
            Row.create();
            // 用户卡（深色，对标原版）
            Row.width('100%');
            // 用户卡（深色，对标原版）
            Row.padding(20);
            // 用户卡（深色，对标原版）
            Row.margin({ left: 16, right: 16, top: 16 });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.alignItems(HorizontalAlign.Start);
            Column.layoutWeight(1);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.nickname);
            Text.fontSize(26);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor('#1A1A1A');
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('管理账号、会员权益等');
            Text.fontSize(13);
            Text.fontColor('#999999');
            Text.margin({ top: 6 });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(`${this.homes.length}个家庭 | ${this.devices.length}个智能设备`);
            Text.fontSize(13);
            Text.fontColor('#4A90D9');
            Text.padding({ left: 12, right: 12, top: 6, bottom: 6 });
            Text.backgroundColor('#E8F3FF');
            Text.borderRadius(16);
            Text.margin({ top: 10 });
        }, Text);
        Text.pop();
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('👤');
            Text.fontSize(26);
            Text.width(64);
            Text.height(64);
            Text.textAlign(TextAlign.Center);
            Text.backgroundColor('#E8EDF2');
            Text.borderRadius(32);
        }, Text);
        Text.pop();
        // 用户卡（深色，对标原版）
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 家庭卡（真实家庭列表）
            ForEach.create();
            const forEachItemGenFunction = _item => {
                const home = _item;
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Row.create();
                    Row.width('100%');
                    Row.padding(18);
                    Row.backgroundColor('#FFFFFF');
                    Row.borderRadius(14);
                    Row.margin({ left: 16, right: 16, top: 12 });
                }, Row);
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Column.create();
                    Column.alignItems(HorizontalAlign.Start);
                    Column.layoutWeight(1);
                }, Column);
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Text.create(home.name);
                    Text.fontSize(17);
                    Text.fontWeight(FontWeight.Medium);
                    Text.fontColor('#1A1A1A');
                }, Text);
                Text.pop();
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Text.create(`${home.roomCount}个房间 | ${home.deviceCount}个设备`);
                    Text.fontSize(13);
                    Text.fontColor('#999999');
                    Text.margin({ top: 4 });
                }, Text);
                Text.pop();
                Column.pop();
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Text.create('›');
                    Text.fontSize(22);
                    Text.fontColor('#CCCCCC');
                }, Text);
                Text.pop();
                Row.pop();
            };
            this.forEachUpdateFunction(elmtId, this.homes, forEachItemGenFunction);
        }, ForEach);
        // 家庭卡（真实家庭列表）
        ForEach.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 菜单组一
            Column.create();
            // 菜单组一
            Column.width('100%');
            // 菜单组一
            Column.padding({ top: 4, bottom: 4 });
            // 菜单组一
            Column.backgroundColor('#FFFFFF');
            // 菜单组一
            Column.borderRadius(14);
            // 菜单组一
            Column.margin({ left: 16, right: 16, top: 16 });
        }, Column);
        this.MenuItem.bind(this)('📦', '设备耗材', '', () => {
            this.toast('设备耗材即将上线');
        });
        this.Divider.bind(this)();
        this.MenuItem.bind(this)('🎙️', '语音控制', '', () => {
            this.toast('语音控制即将上线');
        });
        this.Divider.bind(this)();
        this.MenuItem.bind(this)('🌐', '家庭网络', '良好', () => {
            this.toast('家庭网络即将上线');
        });
        this.Divider.bind(this)();
        this.MenuItem.bind(this)('🔗', '中枢与网关', '', () => {
            this.toast('中枢与网关即将上线');
        });
        this.Divider.bind(this)();
        this.MenuItem.bind(this)('⚙️', '更多设置', '', () => {
            router.pushUrl({ url: 'pages/Settings' });
        });
        // 菜单组一
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 菜单组二
            Column.create();
            // 菜单组二
            Column.width('100%');
            // 菜单组二
            Column.padding({ top: 4, bottom: 4 });
            // 菜单组二
            Column.backgroundColor('#FFFFFF');
            // 菜单组二
            Column.borderRadius(14);
            // 菜单组二
            Column.margin({ left: 16, right: 16, top: 16 });
        }, Column);
        this.MenuItem.bind(this)('🛒', '商城中心', '', () => {
            this.toast('商城中心未开启');
        });
        this.Divider.bind(this)();
        this.MenuItem.bind(this)('🏠', '全屋智能', '', () => {
            this.toast('全屋智能即将上线');
        });
        this.Divider.bind(this)();
        this.MenuItem.bind(this)('🛠️', '小米服务', '', () => {
            this.toast('小米服务即将上线');
        });
        this.Divider.bind(this)();
        this.MenuItem.bind(this)('💬', '帮助与反馈', '', () => {
            this.toast('帮助与反馈即将上线');
        });
        // 菜单组二
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 地区
            Row.create();
            // 地区
            Row.width('100%');
            // 地区
            Row.padding(18);
            // 地区
            Row.backgroundColor('#FFFFFF');
            // 地区
            Row.borderRadius(14);
            // 地区
            Row.margin({ left: 16, right: 16, top: 16 });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('地区');
            Text.fontSize(15);
            Text.fontColor('#1A1A1A');
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Blank.create();
        }, Blank);
        Blank.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('中国大陆');
            Text.fontSize(14);
            Text.fontColor('#999999');
        }, Text);
        Text.pop();
        // 地区
        Row.pop();
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
            Text.margin({ left: 16, right: 16, top: 16, bottom: 30 });
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
    toast(msg: string): void {
        promptAction.showToast({ message: msg, duration: 1500 });
    }
    MenuItem(icon: string, label: string, extra: string, action: () => void, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.padding({ left: 16, right: 16, top: 14, bottom: 14 });
            Row.onClick(() => {
                action();
            });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(icon);
            Text.fontSize(20);
            Text.width(36);
            Text.height(36);
            Text.textAlign(TextAlign.Center);
            Text.backgroundColor('#F2F4F7');
            Text.borderRadius(10);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(label);
            Text.fontSize(16);
            Text.fontColor('#1A1A1A');
            Text.margin({ left: 14 });
            Text.layoutWeight(1);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (extra !== '') {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(extra);
                        Text.fontSize(14);
                        Text.fontColor('#999999');
                        Text.margin({ right: 6 });
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
            Text.create('›');
            Text.fontSize(20);
            Text.fontColor('#CCCCCC');
        }, Text);
        Text.pop();
        Row.pop();
    }
    Divider(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.height(0.5);
            Row.backgroundColor('#F0F0F0');
            Row.margin({ left: 66 });
        }, Row);
        Row.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
}
