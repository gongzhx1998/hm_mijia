if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface SceneList_Params {
    scenes?: Scene[];
}
import router from "@ohos:router";
import promptAction from "@ohos:promptAction";
import * as ApiService from "@normalized:N&&&entry/src/main/ets/service/ApiService&";
import type { Scene } from '../model/Models';
class SceneList extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__scenes = new ObservedPropertyObjectPU([], this, "scenes");
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: SceneList_Params) {
        if (params.scenes !== undefined) {
            this.scenes = params.scenes;
        }
    }
    updateStateVars(params: SceneList_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__scenes.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__scenes.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __scenes: ObservedPropertyObjectPU<Scene[]>;
    get scenes() {
        return this.__scenes.get();
    }
    set scenes(newValue: Scene[]) {
        this.__scenes.set(newValue);
    }
    async aboutToAppear(): Promise<void> {
        this.scenes = await ApiService.getScenes('');
    }
    async runScene(scene: Scene): Promise<void> {
        try {
            const okCount = await ApiService.runScene(scene.sceneId);
            promptAction.showToast({ message: `已执行 ${okCount} 个动作` });
        }
        catch (e) {
            promptAction.showToast({ message: '场景执行失败' });
        }
    }
    SceneRow(scene: Scene, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.padding(14);
            Row.backgroundColor('#FFFFFF');
            Row.borderRadius(12);
            Row.margin({ bottom: 10 });
            Row.onClick(() => {
                router.pushUrl({ url: 'pages/SceneEdit', params: { sceneId: scene.sceneId } });
            });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.alignItems(HorizontalAlign.Start);
            Column.layoutWeight(1);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(scene.name);
            Text.fontSize(15);
            Text.fontColor('#1A1A1A');
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.describeCondition(scene));
            Text.fontSize(12);
            Text.fontColor('#999999');
            Text.margin({ top: 4 });
        }, Text);
        Text.pop();
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('▶ 执行');
            Text.fontSize(13);
            Text.fontColor('#1677FF');
            Text.padding({ left: 12, right: 12, top: 6, bottom: 6 });
            Text.backgroundColor('#E8F3FF');
            Text.borderRadius(14);
            Text.margin({ right: 10 });
            Text.onClick(() => { this.runScene(scene); });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Toggle.create({ type: ToggleType.Switch, isOn: scene.enabled });
            Toggle.selectedColor('#1677FF');
            Toggle.onChange((isOn: boolean) => {
                scene.enabled = isOn;
                ApiService.saveScene(scene);
            });
        }, Toggle);
        Toggle.pop();
        Row.pop();
    }
    describeCondition(scene: Scene): string {
        if (scene.conditions.length === 0) {
            return '无触发条件';
        }
        const c = scene.conditions[0];
        if (c.type === 'manual') {
            return '手动触发';
        }
        if (c.type === 'time') {
            return `定时 ${c.time}`;
        }
        return '传感器触发';
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
            Text.create('场景');
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
            Text.create('＋ 新建');
            Text.fontSize(14);
            Text.fontColor('#1677FF');
            Text.onClick(() => {
                router.pushUrl({ url: 'pages/SceneEdit', params: { sceneId: '' } });
            });
        }, Text);
        Text.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.scenes.length === 0) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.width('100%');
                        Column.layoutWeight(1);
                        Column.justifyContent(FlexAlign.Center);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('⚡');
                        Text.fontSize(48);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('暂无场景');
                        Text.fontSize(15);
                        Text.fontColor('#999999');
                        Text.margin({ top: 12 });
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('点击右上角 ＋ 新建，让设备自动执行');
                        Text.fontSize(13);
                        Text.fontColor('#BBBBBB');
                        Text.margin({ top: 6 });
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
                            const scene = _item;
                            this.SceneRow.bind(this)(scene);
                        };
                        this.forEachUpdateFunction(elmtId, this.scenes, forEachItemGenFunction);
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
    rerender() {
        this.updateDirtyElements();
    }
    static getEntryName(): string {
        return "SceneList";
    }
}
registerNamedRoute(() => new SceneList(undefined, {}), "", { bundleName: "com.mijia.hm", moduleName: "entry", pagePath: "pages/SceneList", pageFullPath: "entry/src/main/ets/pages/SceneList", integratedHsp: "false", moduleType: "followWithHap" });
