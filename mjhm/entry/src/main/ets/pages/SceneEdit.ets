import { router, promptAction } from '@kit.ArkUI';
import * as ApiService from '../service/ApiService';
import { Scene, Device, SceneCondition, SceneAction } from '../model/Models';

/**
 * 场景编辑页：配置触发条件 + 执行动作。
 * 场景本地真实存储，执行时通过 miIO/米家云真实控制设备。
 */
@Entry
@Component
struct SceneEdit {
  @State sceneName: string = '';
  @State conditionType: string = 'manual';
  @State conditionTime: string = '22:00';
  @State devices: Device[] = [];
  @State selectedDevice: Device | null = null;
  @State targetPower: boolean = true;
  @State editingSceneId: string = '';

  async aboutToAppear(): Promise<void> {
    this.devices = await ApiService.getDevices('');
    const params = router.getParams() as Record<string, string>;
    this.editingSceneId = params['sceneId'] ?? '';
    if (this.editingSceneId !== '') {
      const scenes = await ApiService.getScenes('');
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        if (scene.sceneId === this.editingSceneId) {
          this.sceneName = scene.name;
          if (scene.conditions.length > 0) {
            this.conditionType = scene.conditions[0].type;
            const t = scene.conditions[0].time;
            this.conditionTime = t === undefined ? '22:00' : t;
          }
          if (scene.actions.length > 0) {
            const did = scene.actions[0].did;
            for (let j = 0; j < this.devices.length; j++) {
              if (this.devices[j].did === did) {
                this.selectedDevice = this.devices[j];
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
    let cond: SceneCondition;
    if (this.conditionType === 'time') {
      cond = { type: 'time', time: this.conditionTime };
    } else {
      cond = { type: 'manual' };
    }
    const conditions: SceneCondition[] = [cond];
    let actions: SceneAction[] = [];
    if (this.selectedDevice !== null) {
      const act: SceneAction = { did: this.selectedDevice.did, method: 'set_power', params: [this.targetPower] };
      actions = [act];
    }
    const sceneId = this.editingSceneId === '' ? `scene_${Date.now()}` : this.editingSceneId;
    const scene: Scene = {
      sceneId: sceneId,
      name: this.sceneName,
      enabled: true,
      conditions: conditions,
      actions: actions
    };
    await ApiService.saveScene(scene);
    promptAction.showToast({ message: '场景已保存' });
    router.back();
  }

  build() {
    Column() {
      Row() {
        Text('←')
          .fontSize(20)
          .onClick(() => { router.back(); })
        Text(this.editingSceneId === '' ? '新建场景' : '编辑场景')
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
          .margin({ left: 12 })
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 14, bottom: 12 })

      Scroll() {
        Column() {
          // 场景名
          TextInput({ placeholder: '场景名称', text: this.sceneName })
            .onChange((v: string) => { this.sceneName = v; })
            .height(48)
            .backgroundColor('#FFFFFF')
            .borderRadius(12)
            .margin({ bottom: 12 })

          // 触发条件
          Text('触发条件')
            .fontSize(14)
            .fontColor('#999999')
            .margin({ bottom: 8 })
          Row() {
            this.ConditionChip('手动触发', 'manual')
            this.ConditionChip('定时', 'time')
          }
          .margin({ bottom: 12 })

          if (this.conditionType === 'time') {
            TextInput({ placeholder: 'HH:mm', text: this.conditionTime })
              .onChange((v: string) => { this.conditionTime = v; })
              .height(48)
              .backgroundColor('#FFFFFF')
              .borderRadius(12)
              .margin({ bottom: 12 })
          }

          // 执行动作：选择设备
          Text('执行动作（选择设备）')
            .fontSize(14)
            .fontColor('#999999')
            .margin({ bottom: 8 })
          ForEach(this.controllableDevices(), (device: Device) => {
            Row() {
              Text(device.name)
                .fontSize(15)
                .fontColor('#333333')
                .layoutWeight(1)
              if (this.isSelected(device)) {
                Text('✓').fontSize(18).fontColor('#1677FF')
              }
            }
            .width('100%')
            .padding(14)
            .backgroundColor('#FFFFFF')
            .borderRadius(12)
            .margin({ bottom: 10 })
            .onClick(() => { this.selectedDevice = device; })
          })

          if (this.selectedDevice !== null) {
            Row() {
              Text('动作：打开/关闭')
                .fontSize(14)
                .fontColor('#333333')
                .layoutWeight(1)
              Toggle({ type: ToggleType.Switch, isOn: this.targetPower })
                .selectedColor('#1677FF')
                .onChange((isOn: boolean) => { this.targetPower = isOn; })
            }
            .width('100%')
            .padding(14)
            .backgroundColor('#FFFFFF')
            .borderRadius(12)
            .margin({ bottom: 12 })
          }

          Button('保存场景')
            .width('100%')
            .height(48)
            .backgroundColor('#1677FF')
            .fontColor('#FFFFFF')
            .onClick(() => { this.save(); })
        }
        .padding({ left: 16, right: 16, bottom: 20 })
      }
      .layoutWeight(1)
      .scrollBar(BarState.Off)
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F5F6F7')
  }

  @Builder
  ConditionChip(label: string, type: string) {
    Text(label)
      .fontSize(14)
      .fontColor(this.conditionType === type ? '#FFFFFF' : '#333333')
      .padding({ left: 16, right: 16, top: 8, bottom: 8 })
      .backgroundColor(this.conditionType === type ? '#1677FF' : '#F2F3F5')
      .borderRadius(16)
      .margin({ right: 8 })
      .onClick(() => { this.conditionType = type; })
  }

  controllableDevices(): Device[] {
    const result: Device[] = [];
    for (let i = 0; i < this.devices.length; i++) {
      const d = this.devices[i];
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
}
