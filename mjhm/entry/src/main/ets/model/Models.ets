/**
 * 设备数据模型
 * 对应逆向结论中的设备类型：开关、灯、传感器、摄像头等
 */
export interface Device {
  did: string;              // 设备 ID
  model: string;            // 设备型号
  name: string;             // 设备名
  type: string;             // 设备类型（switch / light / sensor / camera ...）
  roomId: string;           // 所属房间
  online: boolean;          // 在线状态
  icon: string;             // 图标资源名
  iconUrl?: string;         // 米家云真实产品图标 URL（/v2/productconfig/single_pull icon_real）
  token?: string;           // 设备 token（局域网控制用，云端提取）
  ip?: string;              // 局域网 IP
  props: Record<string, string | number | boolean>; // 设备属性（可读状态）
}

export interface DeviceCommand {
  did: string;
  method: string;           // 控制方法，如 set_power / set_brightness
  params: (string | number | boolean)[];
}

/** 房间 */
export interface Room {
  roomId: string;
  name: string;
  homeId: string;
  deviceCount: number;
}

/** 家庭 */
export interface Home {
  homeId: string;
  name: string;
  roomCount: number;
  deviceCount: number;
  latitude?: number;
  longitude?: number;
  address?: string;
}

/** 场景动作 */
export interface SceneAction {
  did: string;
  method: string;
  params: (string | number | boolean)[];
}

/** 场景条件 */
export interface SceneCondition {
  type: string;             // manual / time / sensor
  did?: string;             // 条件设备（传感器类）
  prop?: string;            // 条件属性
  operator?: string;        // 比较符
  value?: string;           // 比较值
  time?: string;            // 定时 HH:mm（time 类型）
}

/** 场景 */
export interface Scene {
  sceneId: string;
  name: string;
  enabled: boolean;
  conditions: SceneCondition[];
  actions: SceneAction[];
}

/** 用户 */
export interface UserInfo {
  userId: string;
  nickname: string;
  avatar: string;
  token: string;
}
