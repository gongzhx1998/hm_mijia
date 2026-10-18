if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface i3 {
    currentTab?: number;
    homeName?: string;
    homeId?: string;
    homes?: m3[];
    rooms?: j3[];
    devices?: Device[];
    currentRoom?: string;
    loading?: boolean;
    errorMsg?: string;
    showRoomSheet?: boolean;
    showHomeSheet?: boolean;
}
import router from "@ohos:router";
import * as e1 from "@normalized:N&&&entry/src/main/ets/c/d&";
import * as Storage from "@normalized:N&&&entry/src/main/ets/c/h&";
import * as f1 from "@normalized:N&&&entry/src/main/ets/c/e&";
import { i, j } from "@normalized:N&&&entry/src/main/ets/a/b&";
import type { j3, Device, l3, m3 } from "../f/g";
import { n3 } from "@normalized:N&&&entry/src/main/ets/pages/i&";
const g1 = 'Home';
class q3 extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__currentTab = new ObservedPropertySimplePU(0, this, "currentTab");
        this.__homeName = new ObservedPropertySimplePU('我的家', this, "homeName");
        this.__homeId = new ObservedPropertySimplePU('', this, "homeId");
        this.__homes = new ObservedPropertyObjectPU([], this, "homes");
        this.__rooms = new ObservedPropertyObjectPU([], this, "rooms");
        this.__devices = new ObservedPropertyObjectPU([], this, "devices");
        this.__currentRoom = new ObservedPropertySimplePU('', this, "currentRoom");
        this.__loading = new ObservedPropertySimplePU(true, this, "loading");
        this.__errorMsg = new ObservedPropertySimplePU('', this, "errorMsg");
        this.__showRoomSheet = new ObservedPropertySimplePU(false, this, "showRoomSheet");
        this.__showHomeSheet = new ObservedPropertySimplePU(false, this, "showHomeSheet");
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: i3) {
        if (params.currentTab !== undefined) {
            this.currentTab = params.currentTab;
        }
        if (params.homeName !== undefined) {
            this.homeName = params.homeName;
        }
        if (params.homeId !== undefined) {
            this.homeId = params.homeId;
        }
        if (params.homes !== undefined) {
            this.homes = params.homes;
        }
        if (params.rooms !== undefined) {
            this.rooms = params.rooms;
        }
        if (params.devices !== undefined) {
            this.devices = params.devices;
        }
        if (params.currentRoom !== undefined) {
            this.currentRoom = params.currentRoom;
        }
        if (params.loading !== undefined) {
            this.loading = params.loading;
        }
        if (params.errorMsg !== undefined) {
            this.errorMsg = params.errorMsg;
        }
        if (params.showRoomSheet !== undefined) {
            this.showRoomSheet = params.showRoomSheet;
        }
        if (params.showHomeSheet !== undefined) {
            this.showHomeSheet = params.showHomeSheet;
        }
    }
    updateStateVars(params: i3) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__currentTab.purgeDependencyOnElmtId(rmElmtId);
        this.__homeName.purgeDependencyOnElmtId(rmElmtId);
        this.__homeId.purgeDependencyOnElmtId(rmElmtId);
        this.__homes.purgeDependencyOnElmtId(rmElmtId);
        this.__rooms.purgeDependencyOnElmtId(rmElmtId);
        this.__devices.purgeDependencyOnElmtId(rmElmtId);
        this.__currentRoom.purgeDependencyOnElmtId(rmElmtId);
        this.__loading.purgeDependencyOnElmtId(rmElmtId);
        this.__errorMsg.purgeDependencyOnElmtId(rmElmtId);
        this.__showRoomSheet.purgeDependencyOnElmtId(rmElmtId);
        this.__showHomeSheet.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__currentTab.aboutToBeDeleted();
        this.__homeName.aboutToBeDeleted();
        this.__homeId.aboutToBeDeleted();
        this.__homes.aboutToBeDeleted();
        this.__rooms.aboutToBeDeleted();
        this.__devices.aboutToBeDeleted();
        this.__currentRoom.aboutToBeDeleted();
        this.__loading.aboutToBeDeleted();
        this.__errorMsg.aboutToBeDeleted();
        this.__showRoomSheet.aboutToBeDeleted();
        this.__showHomeSheet.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __currentTab: ObservedPropertySimplePU<number>;
    get currentTab() {
        return this.__currentTab.get();
    }
    set currentTab(newValue: number) {
        this.__currentTab.set(newValue);
    }
    private __homeName: ObservedPropertySimplePU<string>;
    get homeName() {
        return this.__homeName.get();
    }
    set homeName(newValue: string) {
        this.__homeName.set(newValue);
    }
    private __homeId: ObservedPropertySimplePU<string>;
    get homeId() {
        return this.__homeId.get();
    }
    set homeId(newValue: string) {
        this.__homeId.set(newValue);
    }
    private __homes: ObservedPropertyObjectPU<m3[]>;
    get homes() {
        return this.__homes.get();
    }
    set homes(newValue: m3[]) {
        this.__homes.set(newValue);
    }
    private __rooms: ObservedPropertyObjectPU<j3[]>;
    get rooms() {
        return this.__rooms.get();
    }
    set rooms(newValue: j3[]) {
        this.__rooms.set(newValue);
    }
    private __devices: ObservedPropertyObjectPU<Device[]>;
    get devices() {
        return this.__devices.get();
    }
    set devices(newValue: Device[]) {
        this.__devices.set(newValue);
    }
    private __currentRoom: ObservedPropertySimplePU<string>;
    get currentRoom() {
        return this.__currentRoom.get();
    }
    set currentRoom(newValue: string) {
        this.__currentRoom.set(newValue);
    }
    private __loading: ObservedPropertySimplePU<boolean>;
    get loading() {
        return this.__loading.get();
    }
    set loading(newValue: boolean) {
        this.__loading.set(newValue);
    }
    private __errorMsg: ObservedPropertySimplePU<string>;
    get errorMsg() {
        return this.__errorMsg.get();
    }
    set errorMsg(newValue: string) {
        this.__errorMsg.set(newValue);
    }
    private __showRoomSheet: ObservedPropertySimplePU<boolean>;
    get showRoomSheet() {
        return this.__showRoomSheet.get();
    }
    set showRoomSheet(newValue: boolean) {
        this.__showRoomSheet.set(newValue);
    }
    private __showHomeSheet: ObservedPropertySimplePU<boolean>;
    get showHomeSheet() {
        return this.__showHomeSheet.get();
    }
    set showHomeSheet(newValue: boolean) {
        this.__showHomeSheet.set(newValue);
    }
    async aboutToAppear(): Promise<void> {
        const token = await Storage.getString(i.KEY_TOKEN, '');
        if (token === '') {
            router.replaceUrl({ url: 'pages/Login' });
            return;
        }
        await f1.e4();
        await this.loadData();
    }
    async loadData(): Promise<void> {
        this.loading = true;
        this.errorMsg = '';
        try {
            this.homes = await e1.f4();
            if (this.homes.length > 0) {
                this.homeName = this.homes[0].name;
                this.homeId = this.homes[0].homeId;
                this.rooms = await e1.g4(this.homeId);
            }
            this.devices = await e1.getDevices(this.homeId);
            await e1.h4(this.devices);
            j.info(g1, `loadData done: homes=${this.homes.length} rooms=${this.rooms.length} devices=${this.devices.length}`);
        }
        catch (e) {
            j.error(g1, `loadData failed: ${e}`);
            this.errorMsg = '同步失败，请检查网络后下拉重试';
        }
        finally {
            this.loading = false;
        }
    }
    async switchHome(d4: m3): Promise<void> {
        this.showHomeSheet = false;
        if (d4.homeId === this.homeId) {
            return;
        }
        this.homeId = d4.homeId;
        this.homeName = d4.name;
        this.currentRoom = '';
        this.loading = true;
        this.errorMsg = '';
        try {
            this.rooms = await e1.g4(d4.homeId);
            this.devices = await e1.i4(d4.homeId);
            await e1.h4(this.devices);
            j.info(g1, `switchHome done: ${d4.name} rooms=${this.rooms.length} devices=${this.devices.length}`);
        }
        catch (e) {
            j.error(g1, `switchHome failed: ${e}`);
            this.errorMsg = '切换家庭失败，请重试';
        }
        finally {
            this.loading = false;
        }
    }
    roomTabs(): j3[] {
        return this.rooms;
    }
    filteredDevices(): Device[] {
        if (this.currentRoom === '') {
            return this.devices;
        }
        const result: Device[] = [];
        for (let c4 = 0; c4 < this.devices.length; c4++) {
            if (this.devices[c4].h3 === this.currentRoom) {
                result.push(this.devices[c4]);
            }
        }
        return result;
    }
    roomName(a4: string): string {
        for (let b4 = 0; b4 < this.rooms.length; b4++) {
            if (this.rooms[b4].h3 === a4) {
                return this.rooms[b4].name;
            }
        }
        return '';
    }
    roomDeviceCount(y3: string): number {
        let n = 0;
        for (let z3 = 0; z3 < this.devices.length; z3++) {
            if (this.devices[z3].h3 === y3) {
                n++;
            }
        }
        return n;
    }
    isSwitchable(device: Device): boolean {
        return device.type === 'switch' || device.type === 'light' || device.type === 'air_conditioner'
            || device.type === 'air_purifier' || device.type === 'humidifier' || device.type === 'fan'
            || device.type === 'heater' || device.type === 'desk';
    }
    devicePower(device: Device): boolean {
        return device.props['power'] === true;
    }
    deviceIcon(type: string): string {
        if (type === 'light') {
            return '💡';
        }
        if (type === 'switch') {
            return '🔌';
        }
        if (type === 'sensor') {
            return '🌡️';
        }
        if (type === 'camera') {
            return '📷';
        }
        if (type === 'air_conditioner') {
            return '❄️';
        }
        if (type === 'air_purifier') {
            return '🍃';
        }
        if (type === 'water_purifier') {
            return '🚰';
        }
        if (type === 'humidifier') {
            return '💧';
        }
        if (type === 'desk') {
            return '🪑';
        }
        if (type === 'fan') {
            return '🌀';
        }
        if (type === 'heater') {
            return '🔥';
        }
        if (type === 'curtain') {
            return '🪟';
        }
        if (type === 'lock') {
            return '🔒';
        }
        if (type === 'washer') {
            return '🧺';
        }
        if (type === 'speaker') {
            return '🔊';
        }
        if (type === 'juicer') {
            return '🥤';
        }
        if (type === 'cooker') {
            return '🍳';
        }
        if (type === 'fridge') {
            return '🧊';
        }
        if (type === 'router') {
            return '📶';
        }
        return '📱';
    }
    async toggleDevice(device: Device, isOn: boolean): Promise<void> {
        const cmd: l3 = { did: device.did, method: 'set_power', params: [isOn ? 'on' : 'off'] };
        try {
            await e1.j4(cmd);
            device.props['power'] = isOn;
            const next: Device[] = [];
            for (let x3 = 0; x3 < this.devices.length; x3++) {
                next.push(this.devices[x3]);
            }
            this.devices = next;
            j.info(g1, `toggle ok: ${device.name} -> ${isOn}`);
        }
        catch (e) {
            j.error(g1, `toggle failed: ${e}`);
        }
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Tabs.create({ barPosition: BarPosition.End, index: this.currentTab });
            Tabs.barHeight(56);
            Tabs.onChange((index: number) => {
                this.currentTab = index;
            });
            Tabs.width('100%');
            Tabs.height('100%');
        }, Tabs);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            TabContent.create(() => {
                this.HomeContent.bind(this)();
            });
            TabContent.tabBar({ builder: () => {
                    this.TabBarItem.call(this, '米家', '⌂', 0);
                } });
        }, TabContent);
        TabContent.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            TabContent.create(() => {
                {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        if (isInitialRender) {
                            let componentCall = new n3(this, {
                                onLoggedOut: () => {
                                    router.replaceUrl({ url: 'pages/Login' });
                                }
                            }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/pages/Home.ets", line: 224, l4: 9 });
                            ViewPU.create(componentCall);
                            let paramsLambda = () => {
                                return {
                                    onLoggedOut: () => {
                                        router.replaceUrl({ url: 'pages/Login' });
                                    }
                                };
                            };
                            componentCall.paramsGenerator_ = paramsLambda;
                        }
                        else {
                            this.updateStateVarsOfChildByElmtId(elmtId, {});
                        }
                    }, { name: "ProfileTab" });
                }
            });
            TabContent.tabBar({ builder: () => {
                    this.TabBarItem.call(this, '我的', '☺', 1);
                } });
        }, TabContent);
        TabContent.pop();
        Tabs.pop();
    }
    HomeContent(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create();
            Stack.width('100%');
            Stack.height('100%');
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.height('100%');
            Column.linearGradient({
                angle: 180,
                colors: [['#6E93B8', 0], ['#87A9C9', 0.35], ['#A7C2D8', 0.7], ['#C3D6E5', 1]]
            });
        }, Column);
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.height('100%');
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.padding({ left: 20, right: 20, top: 12, bottom: 6 });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Blank.create();
        }, Blank);
        Blank.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('🔔');
            Text.fontSize(22);
            Text.fontColor('#FFFFFF');
            Text.margin({ right: 22 });
            Text.onClick(() => {
            });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('＋');
            Text.fontSize(26);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor('#FFFFFF');
            Text.onClick(() => {
                this.showRoomSheet = true;
            });
        }, Text);
        Text.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.padding({ left: 20, right: 20, top: 6, bottom: 10 });
            Row.onClick(() => {
                if (this.homes.length > 1) {
                    this.showHomeSheet = true;
                }
            });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.homeName);
            Text.fontSize(26);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor('#FFFFFF');
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('⌄');
            Text.fontSize(18);
            Text.fontColor('#FFFFFF');
            Text.margin({ left: 4 });
        }, Text);
        Text.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.padding({ left: 20, right: 16 });
            Row.margin({ bottom: 14 });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Scroll.create();
            Scroll.scrollable(ScrollDirection.Horizontal);
            Scroll.scrollBar(BarState.Off);
            Scroll.layoutWeight(1);
        }, Scroll);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
        }, Row);
        this.RoomTabItem.bind(this)('全屋', '', 0);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            ForEach.create();
            const forEachItemGenFunction = _item => {
                const w3 = _item;
                this.RoomTabItem.bind(this)(w3.name, w3.h3, this.roomDeviceCount(w3.h3));
            };
            this.forEachUpdateFunction(elmtId, this.roomTabs(), forEachItemGenFunction);
        }, ForEach);
        ForEach.pop();
        Row.pop();
        Scroll.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('≡');
            Text.fontSize(20);
            Text.fontColor('#FFFFFF');
            Text.margin({ left: 10 });
            Text.onClick(() => {
                this.showRoomSheet = true;
            });
        }, Text);
        Text.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.loading) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.width('100%');
                        Column.layoutWeight(1);
                        Column.justifyContent(FlexAlign.Center);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        LoadingProgress.create();
                        LoadingProgress.width(40);
                        LoadingProgress.height(40);
                        LoadingProgress.color('#FFFFFF');
                    }, LoadingProgress);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('正在同步设备…');
                        Text.fontSize(13);
                        Text.fontColor('#E8F0F8');
                        Text.margin({ top: 12 });
                    }, Text);
                    Text.pop();
                    Column.pop();
                });
            }
            else if (this.errorMsg !== '') {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.width('100%');
                        Column.layoutWeight(1);
                        Column.justifyContent(FlexAlign.Center);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.errorMsg);
                        Text.fontSize(14);
                        Text.fontColor('#F5F5F5');
                        Text.textAlign(TextAlign.Center);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('重试');
                        Text.fontSize(14);
                        Text.fontColor('#FFFFFF');
                        Text.padding({ left: 24, right: 24, top: 8, bottom: 8 });
                        Text.backgroundColor('#33FFFFFF');
                        Text.borderRadius(20);
                        Text.margin({ top: 16 });
                        Text.onClick(() => {
                            this.loadData();
                        });
                    }, Text);
                    Text.pop();
                    Column.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(2, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Grid.create();
                        Grid.columnsTemplate('1fr 1fr');
                        Grid.columnsGap(12);
                        Grid.rowsGap(12);
                        Grid.padding({ left: 16, right: 16 });
                        Grid.layoutWeight(1);
                        Grid.scrollBar(BarState.Off);
                    }, Grid);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        ForEach.create();
                        const forEachItemGenFunction = _item => {
                            const device = _item;
                            {
                                const itemCreation2 = (elmtId, isInitialRender) => {
                                    GridItem.create(() => { }, false);
                                };
                                const observedDeepRender = () => {
                                    this.observeComponentCreation2(itemCreation2, GridItem);
                                    this.DeviceCard.bind(this)(device);
                                    GridItem.pop();
                                };
                                observedDeepRender();
                            }
                        };
                        this.forEachUpdateFunction(elmtId, this.filteredDevices(), forEachItemGenFunction);
                    }, ForEach);
                    ForEach.pop();
                    Grid.pop();
                });
            }
        }, If);
        If.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (!this.loading && this.filteredDevices().length > 0) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('编辑');
                        Text.fontSize(14);
                        Text.fontColor('#FFFFFF');
                        Text.padding({ left: 26, right: 26, top: 9, bottom: 9 });
                        Text.backgroundColor('#4D3D4F5E');
                        Text.borderRadius(20);
                        Text.margin({ top: 8, bottom: 12 });
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
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.showRoomSheet) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.width('100%');
                        Column.height('100%');
                        Column.backgroundColor('#66000000');
                        Column.onClick(() => {
                            this.showRoomSheet = false;
                        });
                    }, Column);
                    Column.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.width('62%');
                        Column.height('70%');
                        Column.backgroundColor('#E6222B33');
                        Column.borderRadius(16);
                        Column.margin({ top: 150 });
                        Column.alignItems(HorizontalAlign.Start);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('全部设备');
                        Text.fontSize(17);
                        Text.fontWeight(FontWeight.Medium);
                        Text.fontColor('#FFFFFF');
                        Text.width('100%');
                        Text.padding({ left: 20, top: 16, bottom: 14 });
                        Text.onClick(() => {
                            this.showRoomSheet = false;
                            this.currentRoom = '';
                        });
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Scroll.create();
                        Scroll.layoutWeight(1);
                        Scroll.scrollBar(BarState.Off);
                    }, Scroll);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                    }, Column);
                    this.SheetRoomItem.bind(this)('全屋', '', this.devices.length);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        ForEach.create();
                        const forEachItemGenFunction = _item => {
                            const v3 = _item;
                            this.SheetRoomItem.bind(this)(v3.name, v3.h3, this.roomDeviceCount(v3.h3));
                        };
                        this.forEachUpdateFunction(elmtId, this.roomTabs(), forEachItemGenFunction);
                    }, ForEach);
                    ForEach.pop();
                    Column.pop();
                    Scroll.pop();
                    Column.pop();
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
            if (this.showHomeSheet) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.width('100%');
                        Column.height('100%');
                        Column.backgroundColor('#66000000');
                        Column.onClick(() => {
                            this.showHomeSheet = false;
                        });
                    }, Column);
                    Column.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.width('62%');
                        Column.height('70%');
                        Column.backgroundColor('#E6222B33');
                        Column.borderRadius(16);
                        Column.margin({ top: 150 });
                        Column.alignItems(HorizontalAlign.Start);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('选择家庭');
                        Text.fontSize(17);
                        Text.fontWeight(FontWeight.Medium);
                        Text.fontColor('#FFFFFF');
                        Text.width('100%');
                        Text.padding({ left: 20, top: 16, bottom: 14 });
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Scroll.create();
                        Scroll.layoutWeight(1);
                        Scroll.scrollBar(BarState.Off);
                    }, Scroll);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        ForEach.create();
                        const forEachItemGenFunction = _item => {
                            const u3 = _item;
                            this.HomeSheetItem.bind(this)(u3);
                        };
                        this.forEachUpdateFunction(elmtId, this.homes, forEachItemGenFunction);
                    }, ForEach);
                    ForEach.pop();
                    Column.pop();
                    Scroll.pop();
                    Column.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
        Stack.pop();
    }
    RoomTabItem(label: string, t3: string, count: number, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.margin({ right: 20 });
            Column.onClick(() => {
                this.currentRoom = t3;
            });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(label);
            Text.fontSize(this.currentRoom === t3 ? 18 : 16);
            Text.fontWeight(this.currentRoom === t3 ? FontWeight.Bold : FontWeight.Normal);
            Text.fontColor(this.currentRoom === t3 ? '#FFFFFF' : '#D0DEEA');
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width(20);
            Row.height(3);
            Row.borderRadius(2);
            Row.backgroundColor(this.currentRoom === t3 ? '#FFFFFF' : Color.Transparent);
            Row.margin({ top: 4 });
        }, Row);
        Row.pop();
        Column.pop();
    }
    SheetRoomItem(label: string, s3: string, count: number, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.padding({ left: 20, right: 20, top: 13, bottom: 13 });
            Row.onClick(() => {
                this.currentRoom = s3;
                this.showRoomSheet = false;
            });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(label);
            Text.fontSize(16);
            Text.fontColor('#FFFFFF');
            Text.layoutWeight(1);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(String(count));
            Text.fontSize(15);
            Text.fontColor('#99FFFFFF');
        }, Text);
        Text.pop();
        Row.pop();
    }
    HomeSheetItem(r3: m3, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.padding({ left: 20, right: 20, top: 15, bottom: 15 });
            Row.onClick(() => {
                this.switchHome(r3);
            });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(r3.name);
            Text.fontSize(16);
            Text.fontColor(this.homeId === r3.homeId ? '#FFD54F' : '#FFFFFF');
            Text.layoutWeight(1);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(`${r3.m4} 个设备`);
            Text.fontSize(14);
            Text.fontColor('#99FFFFFF');
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.homeId === r3.homeId) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('✓');
                        Text.fontSize(16);
                        Text.fontColor('#FFD54F');
                        Text.margin({ left: 10 });
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
    DeviceCard(device: Device, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.TopStart });
            Stack.width('100%');
            Stack.height(150);
            Stack.backgroundColor('#D9222B33');
            Stack.borderRadius(16);
            Stack.onClick(() => {
                router.pushUrl({ url: 'pages/DeviceControl', params: { did: device.did } });
            });
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.alignItems(HorizontalAlign.Start);
            Column.width('100%');
            Column.height(150);
            Column.padding(14);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width(56);
            Row.height(56);
            Row.borderRadius(12);
            Row.backgroundColor('#33FFFFFF');
            Row.justifyContent(FlexAlign.Center);
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.deviceIcon(device.type));
            Text.fontSize(30);
        }, Text);
        Text.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Blank.create();
        }, Blank);
        Blank.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(device.name);
            Text.fontSize(15);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor('#FFFFFF');
            Text.maxLines(1);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
            Text.width('100%');
            Text.textAlign(TextAlign.Start);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(device.online
                ? (this.roomName(device.h3) === '' ? '未分配房间' : this.roomName(device.h3))
                : `${this.roomName(device.h3) === '' ? '' : this.roomName(device.h3) + ' · '}设备离线`);
            Text.fontSize(12);
            Text.fontColor(device.online ? '#B8CBD9' : '#7F93A5');
            Text.maxLines(1);
            Text.margin({ top: 3 });
            Text.width('100%');
            Text.textAlign(TextAlign.Start);
        }, Text);
        Text.pop();
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.isSwitchable(device) && device.online) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create();
                        Row.width(34);
                        Row.height(34);
                        Row.borderRadius(17);
                        Row.backgroundColor(this.devicePower(device) ? '#66FFD54F' : '#26FFFFFF');
                        Row.justifyContent(FlexAlign.Center);
                        Row.align(Alignment.TopEnd);
                        Row.onClick(() => {
                            this.toggleDevice(device, !this.devicePower(device));
                        });
                    }, Row);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('⏻');
                        Text.fontSize(16);
                        Text.fontColor(this.devicePower(device) ? '#FFD54F' : '#B8CBD9');
                    }, Text);
                    Text.pop();
                    Row.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
        Stack.pop();
    }
    TabBarItem(label: string, icon: string, index: number, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.justifyContent(FlexAlign.Center);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(icon);
            Text.fontSize(20);
            Text.fontColor(this.currentTab === index ? '#4A90D9' : '#999999');
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(label);
            Text.fontSize(11);
            Text.fontColor(this.currentTab === index ? '#4A90D9' : '#999999');
            Text.margin({ top: 2 });
        }, Text);
        Text.pop();
        Column.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
    static getEntryName(): string {
        return "HomePage";
    }
}
registerNamedRoute(() => new q3(undefined, {}), "", { bundleName: "com.mijia.hm", moduleName: "entry", pagePath: "pages/Home", pageFullPath: "entry/src/main/ets/pages/Home", integratedHsp: "false", moduleType: "followWithHap" });
