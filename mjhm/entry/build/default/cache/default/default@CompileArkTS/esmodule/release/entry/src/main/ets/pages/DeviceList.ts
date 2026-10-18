if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface v2 {
    devices?: Device[];
    rooms?: string[];
    roomMap?: Record<string, string[]>;
}
import router from "@ohos:router";
import * as e1 from "@normalized:N&&&entry/src/main/ets/c/d&";
import type { Device } from "../f/g";
class w2 extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__devices = new ObservedPropertyObjectPU([], this, "devices");
        this.__rooms = new ObservedPropertyObjectPU([], this, "rooms");
        this.__roomMap = new ObservedPropertyObjectPU({}, this, "roomMap");
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: v2) {
        if (params.devices !== undefined) {
            this.devices = params.devices;
        }
        if (params.rooms !== undefined) {
            this.rooms = params.rooms;
        }
        if (params.roomMap !== undefined) {
            this.roomMap = params.roomMap;
        }
    }
    updateStateVars(params: v2) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__devices.purgeDependencyOnElmtId(rmElmtId);
        this.__rooms.purgeDependencyOnElmtId(rmElmtId);
        this.__roomMap.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__devices.aboutToBeDeleted();
        this.__rooms.aboutToBeDeleted();
        this.__roomMap.aboutToBeDeleted();
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
    private __rooms: ObservedPropertyObjectPU<string[]>;
    get rooms() {
        return this.__rooms.get();
    }
    set rooms(newValue: string[]) {
        this.__rooms.set(newValue);
    }
    private __roomMap: ObservedPropertyObjectPU<Record<string, string[]>>;
    get roomMap() {
        return this.__roomMap.get();
    }
    set roomMap(newValue: Record<string, string[]>) {
        this.__roomMap.set(newValue);
    }
    async aboutToAppear(): Promise<void> {
        this.devices = await e1.getDevices('');
        this.buildGroup();
    }
    buildGroup(): void {
        const map: Record<string, string[]> = {};
        const order: string[] = [];
        for (let g3 = 0; g3 < this.devices.length; g3++) {
            const d = this.devices[g3];
            const key = d.h3 === '' ? '__none__' : d.h3;
            if (map[key] === undefined) {
                map[key] = [];
                order.push(key);
            }
            map[key].push(d.did);
        }
        this.roomMap = map;
        this.rooms = order;
    }
    devicesInRoom(c3: string): Device[] {
        const d3 = this.roomMap[c3];
        const result: Device[] = [];
        if (d3 === undefined) {
            return result;
        }
        for (let e3 = 0; e3 < this.devices.length; e3++) {
            for (let f3 = 0; f3 < d3.length; f3++) {
                if (this.devices[e3].did === d3[f3]) {
                    result.push(this.devices[e3]);
                    break;
                }
            }
        }
        return result;
    }
    roomName(b3: string): string {
        if (b3 === '__none__') {
            return '未分组设备';
        }
        return `房间 ${b3}`;
    }
    deviceIcon(type: string): string {
        if (type === 'light') {
            return '💡';
        }
        if (type === 'switch') {
            return '🔌';
        }
        if (type === 'sensor') {
            return '📡';
        }
        if (type === 'camera') {
            return '📷';
        }
        return '📦';
    }
    DeviceRow(device: Device, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.padding(14);
            Row.backgroundColor('#FFFFFF');
            Row.borderRadius(12);
            Row.margin({ bottom: 8 });
            Row.onClick(() => {
                router.pushUrl({ url: 'pages/DeviceControl', params: { did: device.did } });
            });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.deviceIcon(device.type));
            Text.fontSize(24);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.alignItems(HorizontalAlign.Start);
            Column.margin({ left: 12 });
            Column.layoutWeight(1);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(device.name);
            Text.fontSize(15);
            Text.fontColor('#1A1A1A');
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(device.online ? '在线' : '离线');
            Text.fontSize(12);
            Text.fontColor(device.online ? '#52C41A' : '#BFBFBF');
            Text.margin({ top: 3 });
        }, Text);
        Text.pop();
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('>');
            Text.fontSize(16);
            Text.fontColor('#BBBBBB');
        }, Text);
        Text.pop();
        Row.pop();
    }
    RoomGroup(a3: string, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.margin({ top: 8, bottom: 10 });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.roomName(a3));
            Text.fontSize(14);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor('#666666');
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Blank.create();
        }, Blank);
        Blank.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(`${this.devicesInRoom(a3).length} 个设备`);
            Text.fontSize(12);
            Text.fontColor('#999999');
        }, Text);
        Text.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            ForEach.create();
            const forEachItemGenFunction = _item => {
                const device = _item;
                this.DeviceRow.bind(this)(device);
            };
            this.forEachUpdateFunction(elmtId, this.devicesInRoom(a3), forEachItemGenFunction);
        }, ForEach);
        ForEach.pop();
        Column.pop();
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.height('100%');
            Column.backgroundColor('#F5F6F7');
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.padding({ left: 16, right: 16, top: 14, bottom: 12 });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('←');
            Text.fontSize(20);
            Text.onClick(() => { router.back(); });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('全部设备');
            Text.fontSize(18);
            Text.fontWeight(FontWeight.Medium);
            Text.margin({ left: 12 });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Blank.create();
        }, Blank);
        Blank.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('＋ 添加');
            Text.fontSize(14);
            Text.fontColor('#1677FF');
        }, Text);
        Text.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Scroll.create();
            Scroll.layoutWeight(1);
            Scroll.scrollBar(BarState.Off);
        }, Scroll);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.padding({ left: 16, right: 16, bottom: 20 });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            ForEach.create();
            const forEachItemGenFunction = _item => {
                const z2 = _item;
                this.RoomGroup.bind(this)(z2);
            };
            this.forEachUpdateFunction(elmtId, this.rooms, forEachItemGenFunction);
        }, ForEach);
        ForEach.pop();
        Column.pop();
        Scroll.pop();
        Column.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
    static getEntryName(): string {
        return "DeviceList";
    }
}
registerNamedRoute(() => new w2(undefined, {}), "", { bundleName: "com.mijia.hm", moduleName: "entry", pagePath: "pages/DeviceList", pageFullPath: "entry/src/main/ets/pages/DeviceList", integratedHsp: "false", moduleType: "followWithHap" });
