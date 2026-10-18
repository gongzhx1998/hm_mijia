import type AbilityConstant from "@ohos:app.ability.AbilityConstant";
import UIAbility from "@ohos:app.ability.UIAbility";
import type Want from "@ohos:app.ability.Want";
import hilog from "@ohos:hilog";
import type window from "@ohos:window";
const b1 = 0x0000;
export default class c1 extends UIAbility {
    onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
        hilog.info(b1, 'EntryAbility', 'onCreate');
    }
    onWindowStageCreate(windowStage: window.WindowStage): void {
        windowStage.loadContent('pages/Index', (err) => {
            if (err.code) {
                hilog.error(b1, 'EntryAbility', 'Failed to load content: %{public}s', JSON.stringify(err));
                return;
            }
            hilog.info(b1, 'EntryAbility', 'Succeeded in loading content');
        });
    }
    onWindowStageDestroy(): void {
        hilog.info(b1, 'EntryAbility', 'onWindowStageDestroy');
    }
    onForeground(): void {
        hilog.info(b1, 'EntryAbility', 'onForeground');
    }
    onBackground(): void {
        hilog.info(b1, 'EntryAbility', 'onBackground');
    }
    onDestroy(): void {
        hilog.info(b1, 'EntryAbility', 'onDestroy');
    }
}
