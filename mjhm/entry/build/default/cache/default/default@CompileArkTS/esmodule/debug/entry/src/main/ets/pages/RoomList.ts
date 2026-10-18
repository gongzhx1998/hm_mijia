if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface RoomList_Params {
    homes?: Home[];
    rooms?: Room[];
    currentHomeId?: string;
}
import router from "@ohos:router";
import * as ApiService from "@normalized:N&&&entry/src/main/ets/service/ApiService&";
import type { Home, Room } from '../model/Models';
class RoomList extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__homes = new ObservedPropertyObjectPU([], this, "homes");
        this.__rooms = new ObservedPropertyObjectPU([], this, "rooms");
        this.__currentHomeId = new ObservedPropertySimplePU('', this, "currentHomeId");
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: RoomList_Params) {
        if (params.homes !== undefined) {
            this.homes = params.homes;
        }
        if (params.rooms !== undefined) {
            this.rooms = params.rooms;
        }
        if (params.currentHomeId !== undefined) {
            this.currentHomeId = params.currentHomeId;
        }
    }
    updateStateVars(params: RoomList_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__homes.purgeDependencyOnElmtId(rmElmtId);
        this.__rooms.purgeDependencyOnElmtId(rmElmtId);
        this.__currentHomeId.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__homes.aboutToBeDeleted();
        this.__rooms.aboutToBeDeleted();
        this.__currentHomeId.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
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
    private __currentHomeId: ObservedPropertySimplePU<string>;
    get currentHomeId() {
        return this.__currentHomeId.get();
    }
    set currentHomeId(newValue: string) {
        this.__currentHomeId.set(newValue);
    }
    async aboutToAppear(): Promise<void> {
        this.homes = await ApiService.getHomes();
        if (this.homes.length > 0) {
            this.currentHomeId = this.homes[0].homeId;
            this.rooms = await ApiService.getRooms(this.currentHomeId);
        }
    }
    RoomRow(room: Room, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.padding(14);
            Row.backgroundColor('#FFFFFF');
            Row.borderRadius(12);
            Row.margin({ bottom: 8 });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('🏠');
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
            Text.create(room.name);
            Text.fontSize(15);
            Text.fontColor('#1A1A1A');
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(`${room.deviceCount} 个设备`);
            Text.fontSize(12);
            Text.fontColor('#999999');
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
            Text.create(this.homeName());
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
            Text.create('＋ 添加房间');
            Text.fontSize(14);
            Text.fontColor('#1677FF');
        }, Text);
        Text.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.rooms.length === 0) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.width('100%');
                        Column.layoutWeight(1);
                        Column.justifyContent(FlexAlign.Center);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('🏠');
                        Text.fontSize(48);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('暂无房间');
                        Text.fontSize(15);
                        Text.fontColor('#999999');
                        Text.margin({ top: 12 });
                    }, Text);
                    Text.pop();
                    Column.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
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
                            const room = _item;
                            this.RoomRow.bind(this)(room);
                        };
                        this.forEachUpdateFunction(elmtId, this.rooms, forEachItemGenFunction);
                    }, ForEach);
                    ForEach.pop();
                    Column.pop();
                    Scroll.pop();
                });
            }
        }, If);
        If.pop();
        Column.pop();
    }
    homeName(): string {
        for (let i = 0; i < this.homes.length; i++) {
            if (this.homes[i].homeId === this.currentHomeId) {
                return this.homes[i].name;
            }
        }
        return '房间';
    }
    rerender() {
        this.updateDirtyElements();
    }
    static getEntryName(): string {
        return "RoomList";
    }
}
registerNamedRoute(() => new RoomList(undefined, {}), "", { bundleName: "com.mijia.hm", moduleName: "entry", pagePath: "pages/RoomList", pageFullPath: "entry/src/main/ets/pages/RoomList", integratedHsp: "false", moduleType: "followWithHap" });
