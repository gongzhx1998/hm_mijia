if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface HomePage_Params {
    currentTab?: number;
    homeName?: string;
    homeId?: string;
    homes?: Home[];
    rooms?: Room[];
    devices?: Device[];
    currentRoom?: string;
    loading?: boolean;
    errorMsg?: string;
    showRoomSheet?: boolean;
    showHomeSheet?: boolean;
}
import router from "@ohos:router";
import * as ApiService from "@normalized:N&&&entry/src/main/ets/service/ApiService&";
import * as Storage from "@normalized:N&&&entry/src/main/ets/service/Storage&";
import * as MiCloud from "@normalized:N&&&entry/src/main/ets/service/MiCloud&";
import { AppConfig, Logger, setStatusBar } from "@normalized:N&&&entry/src/main/ets/common/AppConfig&";
import type { Room, Device, DeviceCommand, Home } from '../model/Models';
import { ProfileTab } from "@normalized:N&&&entry/src/main/ets/pages/Profile&";
import type common from "@ohos:app.ability.common";
import { prefetchAll } from "@normalized:N&&&entry/src/main/ets/service/PluginStore&";
const TAG = 'Home';
class HomePage extends ViewPU {
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
    setInitiallyProvidedValue(params: HomePage_Params) {
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
    updateStateVars(params: HomePage_Params) {
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
    private __homes: ObservedPropertyObjectPU<Home[]>;
    get homes() {
        return this.__homes.get();
    }
    set homes(newValue: Home[]) {
        this.__homes.set(newValue);
    }
    private __rooms: ObservedPropertyObjectPU<Room[]>;
    get rooms() {
        return this.__rooms.get();
    }
    set rooms(newValue: Room[]) {
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
        const token = await Storage.getString(AppConfig.KEY_TOKEN, '');
        if (token === '') {
            router.replaceUrl({ url: 'pages/Login' });
            return;
        }
        // 首页深色背景：状态栏用深蓝 + 白字
        this.applyStatusBar();
        // 恢复米家云登录态（ssecurity/serviceToken/userId），否则云签名请求会因 ssecurity 为空而失败
        await MiCloud.restoreSession();
        await this.loadData();
    }
    /** 根据当前 Tab 设置状态栏颜色（Tab0=深色首页，Tab1=浅色我的） */
    applyStatusBar(): void {
        if (this.currentTab === 0) {
            setStatusBar('#6E93B8', true);
        }
        else {
            setStatusBar('#F5F6F7', false);
        }
    }
    onPageShow(): void {
        this.applyStatusBar();
    }
    onPageHide(): void {
        // 离开首页进入浅色子页面时恢复浅色状态栏
        setStatusBar('#F5F6F7', false);
    }
    async loadData(): Promise<void> {
        this.loading = true;
        this.errorMsg = '';
        try {
            this.homes = await ApiService.getHomes();
            if (this.homes.length > 0) {
                this.homeName = this.homes[0].name;
                this.homeId = this.homes[0].homeId;
                this.rooms = await ApiService.getRooms(this.homeId);
            }
            this.devices = await ApiService.getDevices(this.homeId);
            // 批量读取可开关设备的电源状态，让开关按钮显示真实状态
            await ApiService.readPowerStates(this.devices);
            Logger.info(TAG, `loadData done: homes=${this.homes.length} rooms=${this.rooms.length} devices=${this.devices.length}`);
            this.startPluginPrefetch();
        }
        catch (e) {
            Logger.error(TAG, `loadData failed: ${e}`);
            this.errorMsg = '同步失败，请检查网络后下拉重试';
        }
        finally {
            this.loading = false;
        }
    }
    /**
     * 后台预取所有设备的米家插件：先从云端刷新全量设备列表（缓存可能缺新设备），
     * 再交给 PluginStore 去重/批量查询/限并发下载。不阻塞首页渲染。
     */
    private startPluginPrefetch(): void {
        const ctx: common.Context = getContext(this) as common.UIAbilityContext;
        const fallback: string[] = this.devices.map((d: Device) => d.model);
        setTimeout(() => {
            ApiService.reloadDevicesForHome('').then((all: Device[]) => {
                const models: string[] = all.length > 0 ? all.map((d: Device) => d.model) : fallback;
                prefetchAll(ctx, models);
            }).catch((e: Error) => {
                Logger.error(TAG, `prefetch device list failed: ${e?.message ?? e}`);
                prefetchAll(ctx, fallback);
            });
        }, 1500);
    }
    /** 切换家庭：更新 homeId/homeName，重新拉取该家庭的房间和设备 */
    async switchHome(home: Home): Promise<void> {
        this.showHomeSheet = false;
        if (home.homeId === this.homeId) {
            return;
        }
        this.homeId = home.homeId;
        this.homeName = home.name;
        this.currentRoom = '';
        this.loading = true;
        this.errorMsg = '';
        try {
            this.rooms = await ApiService.getRooms(home.homeId);
            this.devices = await ApiService.reloadDevicesForHome(home.homeId);
            await ApiService.readPowerStates(this.devices);
            Logger.info(TAG, `switchHome done: ${home.name} rooms=${this.rooms.length} devices=${this.devices.length}`);
        }
        catch (e) {
            Logger.error(TAG, `switchHome failed: ${e}`);
            this.errorMsg = '切换家庭失败，请重试';
        }
        finally {
            this.loading = false;
        }
    }
    /** 房间 Tab 列表：全屋 + 各房间 */
    roomTabs(): Room[] {
        return this.rooms;
    }
    filteredDevices(): Device[] {
        if (this.currentRoom === '') {
            return this.devices;
        }
        const result: Device[] = [];
        for (let i = 0; i < this.devices.length; i++) {
            if (this.devices[i].roomId === this.currentRoom) {
                result.push(this.devices[i]);
            }
        }
        return result;
    }
    roomName(roomId: string): string {
        for (let i = 0; i < this.rooms.length; i++) {
            if (this.rooms[i].roomId === roomId) {
                return this.rooms[i].name;
            }
        }
        return '';
    }
    roomDeviceCount(roomId: string): number {
        let n = 0;
        for (let i = 0; i < this.devices.length; i++) {
            if (this.devices[i].roomId === roomId) {
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
        const cmd: DeviceCommand = { did: device.did, method: 'set_power', params: [isOn ? 'on' : 'off'] };
        try {
            await ApiService.controlDevice(cmd);
            device.props['power'] = isOn;
            // 触发刷新（ArkTS 无展开语法，手动重建数组）
            const next: Device[] = [];
            for (let i = 0; i < this.devices.length; i++) {
                next.push(this.devices[i]);
            }
            this.devices = next;
            Logger.info(TAG, `toggle ok: ${device.name} -> ${isOn}`);
        }
        catch (e) {
            Logger.error(TAG, `toggle failed: ${e}`);
        }
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Tabs.create({ barPosition: BarPosition.End, index: this.currentTab });
            Tabs.barHeight(56);
            Tabs.onChange((index: number) => {
                this.currentTab = index;
                this.applyStatusBar();
            });
            Tabs.width('100%');
            Tabs.height('100%');
        }, Tabs);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            TabContent.create(() => {
                this.HomeContent.bind(this)();
            });
            TabContent.tabBar({ builder: () => {
                    this.TabBarItem.call(this, '米家', 0);
                } });
        }, TabContent);
        TabContent.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            TabContent.create(() => {
                {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        if (isInitialRender) {
                            let componentCall = new ProfileTab(this, {
                                onLoggedOut: () => {
                                    router.replaceUrl({ url: 'pages/Login' });
                                }
                            }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/pages/Home.ets", line: 265, col: 9 });
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
                    this.TabBarItem.call(this, '我的', 1);
                } });
        }, TabContent);
        TabContent.pop();
        Tabs.pop();
    }
    // ==================== 首页内容 ====================
    HomeContent(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.TopStart });
            Stack.width('100%');
            Stack.height('100%');
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 天空蓝渐变背景（原版米家首页风格）
            Column.create();
            // 天空蓝渐变背景（原版米家首页风格）
            Column.width('100%');
            // 天空蓝渐变背景（原版米家首页风格）
            Column.height('100%');
            // 天空蓝渐变背景（原版米家首页风格）
            Column.linearGradient({
                angle: 180,
                colors: [['#6E93B8', 0], ['#87A9C9', 0.35], ['#A7C2D8', 0.7], ['#C3D6E5', 1]]
            });
        }, Column);
        // 天空蓝渐变背景（原版米家首页风格）
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.height('100%');
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 顶部图标栏：家庭名⌄ + 消息 + 添加
            Row.create();
            // 顶部图标栏：家庭名⌄ + 消息 + 添加
            Row.width('100%');
            // 顶部图标栏：家庭名⌄ + 消息 + 添加
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
                // 消息中心（原版为服务端推送消息，此处留入口）
            });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('＋');
            Text.fontSize(26);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor('#FFFFFF');
        }, Text);
        Text.pop();
        // 顶部图标栏：家庭名⌄ + 消息 + 添加
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 标题：家庭名⌄（点击弹出家庭切换）
            Row.create();
            // 标题：家庭名⌄（点击弹出家庭切换）
            Row.width('100%');
            // 标题：家庭名⌄（点击弹出家庭切换）
            Row.padding({ left: 20, right: 20, top: 6, bottom: 10 });
            // 标题：家庭名⌄（点击弹出家庭切换）
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
            Image.create({ "id": 16777225, "type": 20000, params: [], "bundleName": "com.mijia.hm", "moduleName": "entry" });
            Image.width(14);
            Image.height(14);
            Image.fillColor('#FFFFFF');
            Image.margin({ left: 6 });
        }, Image);
        // 标题：家庭名⌄（点击弹出家庭切换）
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 房间 Tab 行（全屋 + 各房间 + ≡）
            Row.create();
            // 房间 Tab 行（全屋 + 各房间 + ≡）
            Row.width('100%');
            // 房间 Tab 行（全屋 + 各房间 + ≡）
            Row.padding({ left: 20, right: 16 });
            // 房间 Tab 行（全屋 + 各房间 + ≡）
            Row.margin({ bottom: 14 });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Scroll.create();
            Scroll.scrollable(ScrollDirection.Horizontal);
            Scroll.scrollBar(BarState.Off);
            Scroll.align(Alignment.Start);
            Scroll.layoutWeight(1);
        }, Scroll);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
        }, Row);
        this.RoomTabItem.bind(this)('全屋', '', 0);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            ForEach.create();
            const forEachItemGenFunction = _item => {
                const room = _item;
                this.RoomTabItem.bind(this)(room.name, room.roomId, this.roomDeviceCount(room.roomId));
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
        // 房间 Tab 行（全屋 + 各房间 + ≡）
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            // 内容区
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
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            // ≡ 房间列表弹层（米家原版样式：白色圆角卡靠右，房间+设备数，底部导航编辑/全部设备）
            if (this.showRoomSheet) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.width('100%');
                        Column.height('100%');
                        Column.backgroundColor('#33000000');
                        Column.onClick(() => {
                            this.showRoomSheet = false;
                        });
                    }, Column);
                    Column.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create();
                        Row.width('100%');
                        Row.margin({ top: 128 });
                    }, Row);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Blank.create();
                    }, Blank);
                    Blank.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.width('58%');
                        Column.backgroundColor('#FFFFFF');
                        Column.borderRadius(24);
                        Column.margin({ right: 16 });
                        Column.alignItems(HorizontalAlign.Start);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Scroll.create();
                        Scroll.constraintSize({ maxHeight: 420 });
                        Scroll.scrollBar(BarState.Off);
                    }, Scroll);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                    }, Column);
                    this.SheetRoomItem.bind(this)('全屋', '', this.devices.length);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        ForEach.create();
                        const forEachItemGenFunction = _item => {
                            const room = _item;
                            this.SheetRoomItem.bind(this)(room.name, room.roomId, this.roomDeviceCount(room.roomId));
                        };
                        this.forEachUpdateFunction(elmtId, this.roomTabs(), forEachItemGenFunction);
                    }, ForEach);
                    ForEach.pop();
                    Column.pop();
                    Scroll.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create();
                        Row.width('100%');
                        Row.height(0.5);
                        Row.backgroundColor('#EEEEEE');
                    }, Row);
                    Row.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create();
                        Row.width('100%');
                        Row.padding({ left: 22, right: 22, top: 16, bottom: 16 });
                    }, Row);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('导航编辑');
                        Text.fontSize(17);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor('#1A1A1A');
                        Text.layoutWeight(1);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('⚙️');
                        Text.fontSize(20);
                    }, Text);
                    Text.pop();
                    Row.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create();
                        Row.width('100%');
                        Row.padding({ left: 22, right: 22, top: 4, bottom: 20 });
                        Row.onClick(() => {
                            this.showRoomSheet = false;
                            this.currentRoom = '';
                            router.pushUrl({ url: 'pages/DeviceList' });
                        });
                    }, Row);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('全部设备');
                        Text.fontSize(17);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor('#1A1A1A');
                        Text.layoutWeight(1);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('🔍');
                        Text.fontSize(20);
                    }, Text);
                    Text.pop();
                    Row.pop();
                    Column.pop();
                    Row.pop();
                });
            }
            // 家庭切换弹层（米家原版样式：白色圆角卡，定位项 + 家庭列表（当前绿✓） + 家庭管理）
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            // 家庭切换弹层（米家原版样式：白色圆角卡，定位项 + 家庭列表（当前绿✓） + 家庭管理）
            if (this.showHomeSheet) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.width('100%');
                        Column.height('100%');
                        Column.backgroundColor('#33000000');
                        Column.onClick(() => {
                            this.showHomeSheet = false;
                        });
                    }, Column);
                    Column.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create();
                        Row.width('100%');
                        Row.margin({ top: 96 });
                    }, Row);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.width('88%');
                        Column.backgroundColor('#FFFFFF');
                        Column.borderRadius(24);
                        Column.margin({ left: 16 });
                        Column.alignItems(HorizontalAlign.Start);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        // 顶部：定位图标 + 当前家庭名
                        Row.create();
                        // 顶部：定位图标 + 当前家庭名
                        Row.width('100%');
                        // 顶部：定位图标 + 当前家庭名
                        Row.padding({ left: 20, right: 20, top: 20, bottom: 20 });
                    }, Row);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('📍');
                        Text.fontSize(20);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.homeName);
                        Text.fontSize(18);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor('#1A1A1A');
                        Text.margin({ left: 12 });
                        Text.layoutWeight(1);
                    }, Text);
                    Text.pop();
                    // 顶部：定位图标 + 当前家庭名
                    Row.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        // 家庭列表
                        Scroll.create();
                        // 家庭列表
                        Scroll.constraintSize({ maxHeight: 320 });
                        // 家庭列表
                        Scroll.scrollBar(BarState.Off);
                    }, Scroll);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        ForEach.create();
                        const forEachItemGenFunction = _item => {
                            const home = _item;
                            this.HomeSheetItem.bind(this)(home);
                        };
                        this.forEachUpdateFunction(elmtId, this.homes, forEachItemGenFunction);
                    }, ForEach);
                    ForEach.pop();
                    Column.pop();
                    // 家庭列表
                    Scroll.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create();
                        Row.width('100%');
                        Row.height(0.5);
                        Row.backgroundColor('#EEEEEE');
                    }, Row);
                    Row.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        // 底部：家庭管理（占位入口）
                        Row.create();
                        // 底部：家庭管理（占位入口）
                        Row.width('100%');
                        // 底部：家庭管理（占位入口）
                        Row.padding({ left: 20, right: 20, top: 18, bottom: 22 });
                    }, Row);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('家庭管理');
                        Text.fontSize(18);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor('#1A1A1A');
                        Text.layoutWeight(1);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('⚙️');
                        Text.fontSize(20);
                    }, Text);
                    Text.pop();
                    // 底部：家庭管理（占位入口）
                    Row.pop();
                    Column.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Blank.create();
                    }, Blank);
                    Blank.pop();
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
    RoomTabItem(label: string, roomId: string, count: number, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.margin({ right: 20 });
            Column.onClick(() => {
                this.currentRoom = roomId;
            });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(label);
            Text.fontSize(this.currentRoom === roomId ? 18 : 16);
            Text.fontWeight(this.currentRoom === roomId ? FontWeight.Bold : FontWeight.Normal);
            Text.fontColor(this.currentRoom === roomId ? '#FFFFFF' : '#D0DEEA');
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 选中下划线
            Row.create();
            // 选中下划线
            Row.width(20);
            // 选中下划线
            Row.height(3);
            // 选中下划线
            Row.borderRadius(2);
            // 选中下划线
            Row.backgroundColor(this.currentRoom === roomId ? '#FFFFFF' : Color.Transparent);
            // 选中下划线
            Row.margin({ top: 4 });
        }, Row);
        // 选中下划线
        Row.pop();
        Column.pop();
    }
    SheetRoomItem(label: string, roomId: string, count: number, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.padding({ left: 22, right: 22, top: 15, bottom: 15 });
            Row.onClick(() => {
                this.currentRoom = roomId;
                this.showRoomSheet = false;
            });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(label);
            Text.fontSize(17);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor('#1A1A1A');
            Text.layoutWeight(1);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(String(count));
            Text.fontSize(15);
            Text.fontColor('#AAAAAA');
        }, Text);
        Text.pop();
        Row.pop();
    }
    HomeSheetItem(home: Home, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.padding({ left: 20, right: 20, top: 16, bottom: 16 });
            Row.backgroundColor(this.homeId === home.homeId ? '#E8F8EF' : Color.Transparent);
            Row.onClick(() => {
                this.switchHome(home);
            });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(home.name);
            Text.fontSize(18);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor(this.homeId === home.homeId ? '#34C759' : '#1A1A1A');
            Text.layoutWeight(1);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.homeId === home.homeId) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('✓');
                        Text.fontSize(18);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor('#34C759');
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
    // 深色设备卡（原版样式：深色圆角卡 + 图标块 + 名称 + 房间·状态）
    DeviceCard(device: Device, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.TopStart });
            Stack.width('100%');
            Stack.height(150);
            Stack.backgroundColor('#D9222B33');
            Stack.borderRadius(16);
            Stack.onClick(() => {
                // 点设备 → 打开该设备自己的米家 RN 插件（按型号下载/缓存）；无插件时插件页自动回退原生控制页
                const params: Record<string, string> = {
                    'did': device.did,
                    'model': device.model,
                    'name': device.name,
                    'online': device.online ? '1' : '0'
                };
                router.pushUrl({ url: 'pages/PluginHost', params: params });
            });
            globalThis.Gesture.create(GesturePriority.Low);
            LongPressGesture.create();
            LongPressGesture.onAction(() => {
                // 长按：直接进原生控制页
                router.pushUrl({ url: 'pages/DeviceControl', params: { did: device.did } });
            });
            LongPressGesture.pop();
            globalThis.Gesture.pop();
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.alignItems(HorizontalAlign.Start);
            Column.width('100%');
            Column.height(150);
            Column.padding(14);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 图标块
            Row.create();
            // 图标块
            Row.width(56);
            // 图标块
            Row.height(56);
            // 图标块
            Row.borderRadius(12);
            // 图标块
            Row.backgroundColor('#33FFFFFF');
            // 图标块
            Row.justifyContent(FlexAlign.Center);
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.deviceIcon(device.type));
            Text.fontSize(30);
        }, Text);
        Text.pop();
        // 图标块
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
                ? (this.roomName(device.roomId) === '' ? '未分配房间' : this.roomName(device.roomId))
                : `${this.roomName(device.roomId) === '' ? '' : this.roomName(device.roomId) + ' · '}设备离线`);
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
            // 开关类设备：右上角电源按钮（矢量 Path 绘制标准电源符号：弧线缺口+竖线，避免字符渲染歪斜）
            if (this.isSwitchable(device) && device.online) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create();
                        Row.width('100%');
                        Row.padding(10);
                    }, Row);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Blank.create();
                    }, Blank);
                    Blank.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create();
                        Row.width(34);
                        Row.height(34);
                        Row.borderRadius(17);
                        Row.backgroundColor(this.devicePower(device) ? '#66FFD54F' : '#26FFFFFF');
                        Row.justifyContent(FlexAlign.Center);
                        Row.alignItems(VerticalAlign.Center);
                        Row.onClick(() => {
                            this.toggleDevice(device, !this.devicePower(device));
                        });
                    }, Row);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Image.create({ "id": 16777228, "type": 20000, params: [], "bundleName": "com.mijia.hm", "moduleName": "entry" });
                        Image.width(17);
                        Image.height(17);
                        Image.fillColor(this.devicePower(device) ? '#FFD54F' : '#B8CBD9');
                    }, Image);
                    Row.pop();
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
    TabBarItem(label: string, index: number, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.justifyContent(FlexAlign.Center);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (index === 0) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Image.create({ "id": 16777226, "type": 20000, params: [], "bundleName": "com.mijia.hm", "moduleName": "entry" });
                        Image.width(22);
                        Image.height(22);
                        Image.fillColor(this.currentTab === index ? '#4A90D9' : '#999999');
                    }, Image);
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Image.create({ "id": 16777227, "type": 20000, params: [], "bundleName": "com.mijia.hm", "moduleName": "entry" });
                        Image.width(22);
                        Image.height(22);
                        Image.fillColor(this.currentTab === index ? '#4A90D9' : '#999999');
                    }, Image);
                });
            }
        }, If);
        If.pop();
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
    public __resetStateVarsOnReuse__Internal(params: Object): void {
    }
    static getEntryName(): string {
        return "HomePage";
    }
}
registerNamedRoute(() => new HomePage(undefined, {}), "", { bundleName: "com.mijia.hm", moduleName: "entry", pagePath: "pages/Home", pageFullPath: "entry/src/main/ets/pages/Home", integratedHsp: "false", moduleType: "followWithHap" });
