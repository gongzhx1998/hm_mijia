if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface r5 {
    devices?: Device[];
    homes?: m3[];
    nickname?: string;
    userId?: string;
    onLoggedOut?: () => void;
}
import router from "@ohos:router";
import promptAction from "@ohos:promptAction";
import * as e1 from "@normalized:N&&&entry/src/main/ets/c/d&";
import * as Storage from "@normalized:N&&&entry/src/main/ets/c/h&";
import { i, j } from "@normalized:N&&&entry/src/main/ets/a/b&";
import type { m3, Device, UserInfo } from "../f/g";
const g1 = 'Profile';
export class n3 extends ViewPU {
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
    setInitiallyProvidedValue(params: r5) {
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
    updateStateVars(params: r5) {
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
    private __homes: ObservedPropertyObjectPU<m3[]>;
    get homes() {
        return this.__homes.get();
    }
    set homes(newValue: m3[]) {
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
    private onLoggedOut: () => void;
    async aboutToAppear(): Promise<void> {
        const user: UserInfo | null = await Storage.t5<UserInfo>(i.o);
        if (user !== null) {
            this.nickname = user.nickname;
            this.userId = user.userId;
        }
    }
    async refreshStats(): Promise<void> {
        try {
            this.homes = await e1.f4();
            this.devices = await e1.getDevices('');
        }
        catch (e) {
            j.error(g1, `refreshStats failed: ${e}`);
        }
    }
    async logout(): Promise<void> {
        await Storage.clear(i.KEY_TOKEN);
        await Storage.clear(i.o);
        await Storage.clear(i.u);
        j.info(g1, 'logged out');
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
            Row.create();
            Row.width('100%');
            Row.padding(20);
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
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            ForEach.create();
            const forEachItemGenFunction = _item => {
                const s5 = _item;
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
                    Text.create(s5.name);
                    Text.fontSize(17);
                    Text.fontWeight(FontWeight.Medium);
                    Text.fontColor('#1A1A1A');
                }, Text);
                Text.pop();
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Text.create(`${s5.u5}个房间 | ${s5.m4}个设备`);
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
        ForEach.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.padding({ top: 4, bottom: 4 });
            Column.backgroundColor('#FFFFFF');
            Column.borderRadius(14);
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
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.padding({ top: 4, bottom: 4 });
            Column.backgroundColor('#FFFFFF');
            Column.borderRadius(14);
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
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.padding(18);
            Row.backgroundColor('#FFFFFF');
            Row.borderRadius(14);
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
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('退出登录');
            Text.fontSize(16);
            Text.fontColor('#E53935');
            Text.width('100%');
            Text.textAlign(TextAlign.Center);
            Text.padding(16);
            Text.backgroundColor('#FFFFFF');
            Text.borderRadius(14);
            Text.margin({ left: 16, right: 16, top: 16, bottom: 30 });
            Text.onClick(() => {
                this.logout();
            });
        }, Text);
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
