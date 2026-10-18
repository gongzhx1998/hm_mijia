import { router, promptAction } from '@kit.ArkUI';
import * as ApiService from '../service/ApiService';
import { Scene } from '../model/Models';

/**
 * 场景列表页：本地真实存储的场景，手动执行时逐动作真实下发到设备
 */
@Entry
@Component
struct SceneList {
  @State scenes: Scene[] = [];

  async aboutToAppear(): Promise<void> {
    this.scenes = await ApiService.getScenes('');
  }

  async runScene(scene: Scene): Promise<void> {
    try {
      const okCount = await ApiService.runScene(scene.sceneId);
      promptAction.showToast({ message: `已执行 ${okCount} 个动作` });
    } catch (e) {
      promptAction.showToast({ message: '场景执行失败' });
    }
  }

  @Builder
  SceneRow(scene: Scene) {
    Row() {
      Column() {
        Text(scene.name)
          .fontSize(15)
          .fontColor('#1A1A1A')
        Text(this.describeCondition(scene))
          .fontSize(12)
          .fontColor('#999999')
          .margin({ top: 4 })
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)

      Text('▶ 执行')
        .fontSize(13)
        .fontColor('#1677FF')
        .padding({ left: 12, right: 12, top: 6, bottom: 6 })
        .backgroundColor('#E8F3FF')
        .borderRadius(14)
        .margin({ right: 10 })
        .onClick(() => { this.runScene(scene); })

      Toggle({ type: ToggleType.Switch, isOn: scene.enabled })
        .selectedColor('#1677FF')
        .onChange((isOn: boolean) => {
          scene.enabled = isOn;
          ApiService.saveScene(scene);
        })
    }
    .width('100%')
    .padding(14)
    .backgroundColor('#FFFFFF')
    .borderRadius(12)
    .margin({ bottom: 10 })
    .onClick(() => {
      router.pushUrl({ url: 'pages/SceneEdit', params: { sceneId: scene.sceneId } });
    })
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

  build() {
    Column() {
      Row() {
        Text('←')
          .fontSize(20)
          .onClick(() => { router.back(); })
        Text('场景')
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
          .margin({ left: 12 })
        Blank()
        Text('＋ 新建')
          .fontSize(14)
          .fontColor('#1677FF')
          .onClick(() => {
            router.pushUrl({ url: 'pages/SceneEdit', params: { sceneId: '' } });
          })
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 14, bottom: 12 })

      if (this.scenes.length === 0) {
        Column() {
          Text('⚡')
            .fontSize(48)
          Text('暂无场景')
            .fontSize(15)
            .fontColor('#999999')
            .margin({ top: 12 })
          Text('点击右上角 ＋ 新建，让设备自动执行')
            .fontSize(13)
            .fontColor('#BBBBBB')
            .margin({ top: 6 })
        }
        .width('100%')
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
      } else {
        Scroll() {
          Column() {
            ForEach(this.scenes, (scene: Scene) => {
              this.SceneRow(scene)
            })
          }
          .padding({ left: 16, right: 16, bottom: 20 })
        }
        .layoutWeight(1)
        .scrollBar(BarState.Off)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F5F6F7')
  }
}
