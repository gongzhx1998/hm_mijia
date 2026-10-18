if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface a6 {
    sceneName?: string;
    conditionType?: string;
    conditionTime?: string;
    devices?: Device[];
    selectedDevice?: Device | null;
    targetPower?: boolean;
    editingSceneId?: string;
}
import router from "@ohos:router";
import promptAction from "@ohos:promptAction";
import * as e1 from "@normalized:N&&&entry/src/main/ets/c/d&";
import type { Scene, Device, b6, c6 } from "../f/g";
class d6 extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__sceneName = new ObservedPropertySimplePU('', this, "sceneName");
        this.__conditionType = new ObservedPropertySimplePU('manual', this, "conditionType");
        this.__conditionTime = new ObservedPropertySimplePU('22:00', this, "conditionTime");
        this.__devices = new ObservedPropertyObjectPU([], this, "devices");
        this.__selectedDevice = new ObservedPropertyObjectPU(null, this, "selectedDevice");
        this.__targetPower = new ObservedPropertySimplePU(true, this, "targetPower");
        this.__editingSceneId = new ObservedPropertySimplePU('', this, "editingSceneId");
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: a6) {
        if (params.sceneName !== undefined) {
            this.sceneName = params.sceneName;
        }
        if (params.conditionType !== undefined) {
            this.conditionType = params.conditionType;
        }
        if (params.conditionTime !== undefined) {
            this.conditionTime = params.conditionTime;
        }
        if (params.devices !== undefined) {
            this.devices = params.devices;
        }
        if (params.selectedDevice !== undefined) {
            this.selectedDevice = params.selectedDevice;
        }
        if (params.targetPower !== undefined) {
            this.targetPower = params.targetPower;
        }
        if (params.editingSceneId !== undefined) {
            this.editingSceneId = params.editingSceneId;
        }
    }
    updateStateVars(params: a6) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__sceneName.purgeDependencyOnElmtId(rmElmtId);
        this.__conditionType.purgeDependencyOnElmtId(rmElmtId);
        this.__conditionTime.purgeDependencyOnElmtId(rmElmtId);
        this.__devices.purgeDependencyOnElmtId(rmElmtId);
        this.__selectedDevice.purgeDependencyOnElmtId(rmElmtId);
        this.__targetPower.purgeDependencyOnElmtId(rmElmtId);
        this.__editingSceneId.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__sceneName.aboutToBeDeleted();
        this.__conditionType.aboutToBeDeleted();
        this.__conditionTime.aboutToBeDeleted();
        this.__devices.aboutToBeDeleted();
        this.__selectedDevice.aboutToBeDeleted();
        this.__targetPower.aboutToBeDeleted();
        this.__editingSceneId.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __sceneName: ObservedPropertySimplePU<string>;
    get sceneName() {
        return this.__sceneName.get();
    }
    set sceneName(newValue: string) {
        this.__sceneName.set(newValue);
    }
    private __conditionType: ObservedPropertySimplePU<string>;
    get conditionType() {
        return this.__conditionType.get();
    }
    set conditionType(newValue: string) {
        this.__conditionType.set(newValue);
    }
    private __conditionTime: ObservedPropertySimplePU<string>;
    get conditionTime() {
        return this.__conditionTime.get();
    }
    set conditionTime(newValue: string) {
        this.__conditionTime.set(newValue);
    }
    private __devices: ObservedPropertyObjectPU<Device[]>;
    get devices() {
        return this.__devices.get();
    }
    set devices(newValue: Device[]) {
        this.__devices.set(newValue);
    }
    private __selectedDevice: ObservedPropertyObjectPU<Device | null>;
    get selectedDevice() {
        return this.__selectedDevice.get();
    }
    set selectedDevice(newValue: Device | null) {
        this.__selectedDevice.set(newValue);
    }
    private __targetPower: ObservedPropertySimplePU<boolean>;
    get targetPower() {
        return this.__targetPower.get();
    }
    set targetPower(newValue: boolean) {
        this.__targetPower.set(newValue);
    }
    private __editingSceneId: ObservedPropertySimplePU<string>;
    get editingSceneId() {
        return this.__editingSceneId.get();
    }
    set editingSceneId(newValue: string) {
        this.__editingSceneId.set(newValue);
    }
    async aboutToAppear(): Promise<void> {
        this.devices = await e1.getDevices('');
        const params = router.getParams() as Record<string, string>;
        this.editingSceneId = params['sceneId'] ?? '';
        if (this.editingSceneId !== '') {
            const h6 = await e1.m6('');
            for (let i6 = 0; i6 < h6.length; i6++) {
                const scene = h6[i6];
                if (scene.sceneId === this.editingSceneId) {
                    this.sceneName = scene.name;
                    if (scene.conditions.length > 0) {
                        this.conditionType = scene.conditions[0].type;
                        const l6 = scene.conditions[0].time;
                        this.conditionTime = l6 === undefined ? '22:00' : l6;
                    }
                    if (scene.actions.length > 0) {
                        const j6 = scene.actions[0].did;
                        for (let k6 = 0; k6 < this.devices.length; k6++) {
                            if (this.devices[k6].did === j6) {
                                this.selectedDevice = this.devices[k6];
                                break;
                            }
                        }
                        const p = scene.actions[0].params;
                        if (p.length > 0 && typeof p[0] === 'boolean') {
                            this.targetPower = p[0] as boolean;
                        }
                    }
                    break;
                }
            }
        }
    }
    async save(): Promise<void> {
        if (this.sceneName === '') {
            promptAction.showToast({ message: '请输入场景名称' });
            return;
        }
        let f6: b6;
        if (this.conditionType === 'time') {
            f6 = { type: 'time', time: this.conditionTime };
        }
        else {
            f6 = { type: 'manual' };
        }
        const conditions: b6[] = [f6];
        let actions: c6[] = [];
        if (this.selectedDevice !== null) {
            const g6: c6 = { did: this.selectedDevice.did, method: 'set_power', params: [this.targetPower] };
            actions = [g6];
        }
        const sceneId = this.editingSceneId === '' ? `scene_${Date.now()}` : this.editingSceneId;
        const scene: Scene = {
            sceneId: sceneId,
            name: this.sceneName,
            enabled: true,
            conditions: conditions,
            actions: actions
        };
        await e1.n6(scene);
        promptAction.showToast({ message: '场景已保存' });
        router.back();
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
            Text.create(this.editingSceneId === '' ? '新建场景' : '编辑场景');
            Text.fontSize(18);
            Text.fontWeight(FontWeight.Medium);
            Text.margin({ left: 12 });
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
            TextInput.create({ placeholder: '场景名称', text: this.sceneName });
            TextInput.onChange((v: string) => { this.sceneName = v; });
            TextInput.height(48);
            TextInput.backgroundColor('#FFFFFF');
            TextInput.borderRadius(12);
            TextInput.margin({ bottom: 12 });
        }, TextInput);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('触发条件');
            Text.fontSize(14);
            Text.fontColor('#999999');
            Text.margin({ bottom: 8 });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.margin({ bottom: 12 });
        }, Row);
        this.ConditionChip.bind(this)('手动触发', 'manual');
        this.ConditionChip.bind(this)('定时', 'time');
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.conditionType === 'time') {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        TextInput.create({ placeholder: 'HH:mm', text: this.conditionTime });
                        TextInput.onChange((v: string) => { this.conditionTime = v; });
                        TextInput.height(48);
                        TextInput.backgroundColor('#FFFFFF');
                        TextInput.borderRadius(12);
                        TextInput.margin({ bottom: 12 });
                    }, TextInput);
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('执行动作（选择设备）');
            Text.fontSize(14);
            Text.fontColor('#999999');
            Text.margin({ bottom: 8 });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            ForEach.create();
            const forEachItemGenFunction = _item => {
                const device = _item;
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Row.create();
                    Row.width('100%');
                    Row.padding(14);
                    Row.backgroundColor('#FFFFFF');
                    Row.borderRadius(12);
                    Row.margin({ bottom: 10 });
                    Row.onClick(() => { this.selectedDevice = device; });
                }, Row);
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Text.create(device.name);
                    Text.fontSize(15);
                    Text.fontColor('#333333');
                    Text.layoutWeight(1);
                }, Text);
                Text.pop();
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    If.create();
                    if (this.isSelected(device)) {
                        this.ifElseBranchUpdateFunction(0, () => {
                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                Text.create('✓');
                                Text.fontSize(18);
                                Text.fontColor('#1677FF');
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
            };
            this.forEachUpdateFunction(elmtId, this.controllableDevices(), forEachItemGenFunction);
        }, ForEach);
        ForEach.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.selectedDevice !== null) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create();
                        Row.width('100%');
                        Row.padding(14);
                        Row.backgroundColor('#FFFFFF');
                        Row.borderRadius(12);
                        Row.margin({ bottom: 12 });
                    }, Row);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('动作：打开/关闭');
                        Text.fontSize(14);
                        Text.fontColor('#333333');
                        Text.layoutWeight(1);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Toggle.create({ type: ToggleType.Switch, isOn: this.targetPower });
                        Toggle.selectedColor('#1677FF');
                        Toggle.onChange((isOn: boolean) => { this.targetPower = isOn; });
                    }, Toggle);
                    Toggle.pop();
                    Row.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Button.createWithLabel('保存场景');
            Button.width('100%');
            Button.height(48);
            Button.backgroundColor('#1677FF');
            Button.fontColor('#FFFFFF');
            Button.onClick(() => { this.save(); });
        }, Button);
        Button.pop();
        Column.pop();
        Scroll.pop();
        Column.pop();
    }
    ConditionChip(label: string, type: string, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(label);
            Text.fontSize(14);
            Text.fontColor(this.conditionType === type ? '#FFFFFF' : '#333333');
            Text.padding({ left: 16, right: 16, top: 8, bottom: 8 });
            Text.backgroundColor(this.conditionType === type ? '#1677FF' : '#F2F3F5');
            Text.borderRadius(16);
            Text.margin({ right: 8 });
            Text.onClick(() => { this.conditionType = type; });
        }, Text);
        Text.pop();
    }
    controllableDevices(): Device[] {
        const result: Device[] = [];
        for (let e6 = 0; e6 < this.devices.length; e6++) {
            const d = this.devices[e6];
            if (d.type === 'switch' || d.type === 'light' || d.type === 'air_conditioner') {
                result.push(d);
            }
        }
        return result;
    }
    isSelected(device: Device): boolean {
        if (this.selectedDevice === null) {
            return false;
        }
        return this.selectedDevice.did === device.did;
    }
    rerender() {
        this.updateDirtyElements();
    }
    static getEntryName(): string {
        return "SceneEdit";
    }
}
registerNamedRoute(() => new d6(undefined, {}), "", { bundleName: "com.mijia.hm", moduleName: "entry", pagePath: "pages/SceneEdit", pageFullPath: "entry/src/main/ets/pages/SceneEdit", integratedHsp: "false", moduleType: "followWithHap" });
