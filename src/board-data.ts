export type CategoryId = 'core' | 'power' | 'clock' | 'io' | 'boot' | 'passive' | 'pcb';
export type Part = { id: string; name: string; ref: string; category: CategoryId; description: string; specs: [string, string][] };
export const categories: { id: CategoryId; name: string; color: string }[] = [
  { id: 'core', name: '主控芯片', color: '#414c58' },
  { id: 'power', name: '供电与指示', color: '#cf9c54' },
  { id: 'clock', name: '时钟系统', color: '#99a8b7' },
  { id: 'io', name: '接口与排针', color: '#8b9e78' },
  { id: 'boot', name: '启动与复位', color: '#7197c3' },
  { id: 'passive', name: '阻容器件', color: '#bc9d87' },
  { id: 'pcb', name: 'PCB 与丝印', color: '#5385b5' },
];
export const parts: Part[] = [
  { id: 'mcu', name: 'STM32F103C8T6', ref: 'U1', category: 'core', description: '这块最小系统板的核心。基于 Arm Cortex-M3 内核，负责运行程序，并通过 GPIO 与外部器件交互。', specs: [['内核', 'Arm Cortex-M3'], ['最高主频', '72 MHz'], ['Flash / SRAM', '64 KB / 20 KB'], ['封装', 'LQFP48 · 7 × 7 mm']] },
  { id: 'usb', name: 'Micro USB 接口', ref: 'J1', category: 'power', description: '板载 Micro-B 接口。模型展示金属屏蔽壳、内部舌片和连接触点。', specs: [['接口形式', 'USB Micro-B'], ['所在区域', '电源输入端']] },
  { id: 'regulator', name: '3.3 V 稳压器', ref: 'U2', category: 'power', description: '板上的稳压器外观模型，包含封装主体、引脚和散热片。', specs: [['外观标识', '1117 / 3V3'], ['封装外形', 'SOT-223']] },
  { id: 'crystal-hse', name: '8 MHz 晶振', ref: 'Y1', category: 'clock', description: '为主控提供外部高速时钟参考，位于 MCU 左侧。金属外壳上的标记为 8.000。', specs: [['标识频率', '8 MHz'], ['类型', '高速时钟']] },
  { id: 'crystal-lse', name: '32.768 kHz 晶振', ref: 'Y2', category: 'clock', description: '板上低速晶振，用作实时时钟的外部时钟参考。', specs: [['标识频率', '32.768 kHz'], ['类型', '低速时钟']] },
  { id: 'header-top', name: '上排 GPIO 排针', ref: 'J2', category: 'io', description: '一排 20 针连接器，将 GPIO 与电源引出，方便连接面包板或其他电路。', specs: [['针数', '20'], ['间距', '2.54 mm']] },
  { id: 'header-bottom', name: '下排 GPIO 排针', ref: 'J3', category: 'io', description: '与另一侧排针配合引出主控接口。板面丝印用于辨识各引脚位置。', specs: [['针数', '20'], ['间距', '2.54 mm']] },
  { id: 'swd', name: 'SWD 调试接口', ref: 'J4', category: 'io', description: '用于连接调试器，进行程序下载与调试。模型使用四针直角排针。', specs: [['接口', 'SWD'], ['丝印', '3V3 · DIO · CLK · GND']] },
  { id: 'boot0', name: 'BOOT0 跳线', ref: 'BOOT0', category: 'boot', description: '启动配置跳线。蓝色跳帽跨接相邻排针，用于选择启动配置。', specs: [['结构', '3 针选择器 + 跳帽'], ['间距', '2.54 mm']] },
  { id: 'boot1', name: 'BOOT1 跳线', ref: 'BOOT1', category: 'boot', description: '与 BOOT0 配合设置启动配置。可以用展开视图观察跳线组件。', specs: [['结构', '3 针选择器 + 跳帽'], ['间距', '2.54 mm']] },
  { id: 'reset', name: '复位按键', ref: 'SW1', category: 'boot', description: '用于手动复位主控。模型包含黑色按帽、金属顶盖、铆点和焊接引脚。', specs: [['形式', '贴片轻触按键'], ['板上标识', 'RESET']] },
  { id: 'led-power', name: '电源指示灯', ref: 'D1', category: 'power', description: '红色电源指示 LED。此页面展示外观，不模拟实际电路通电状态。', specs: [['颜色', '红色'], ['丝印', 'PWR']] },
  { id: 'led-user', name: '用户指示灯', ref: 'D2', category: 'power', description: '绿色用户 LED，旁边的板面标识为 PC13。', specs: [['颜色', '绿色'], ['丝印', 'PC13']] },
  ...Array.from({ length: 10 }, (_, i): Part => ({ id: 'c' + (i + 1), name: '贴片电容 C' + (i + 1), ref: 'C' + (i + 1), category: 'passive', description: '板上的贴片电容。模型展示陶瓷主体及两端金属电极，便于观察器件布局。', specs: [['器件类型', '贴片电容'], ['展示内容', '外形与位置']] })),
  ...Array.from({ length: 7 }, (_, i): Part => ({ id: 'r' + (i + 1), name: '贴片电阻 R' + (i + 1), ref: 'R' + (i + 1), category: 'passive', description: '板上的贴片电阻。黑色主体与两端金属端帽作为整体进行选择。', specs: [['器件类型', '贴片电阻'], ['展示内容', '外形与位置']] })),
  { id: 'pcb', name: '蓝色 PCB', ref: 'PCB', category: 'pcb', description: '承载所有器件的板体，包含蓝色阻焊层、板边、焊盘、过孔与白色丝印。走线仅作外观示意。', specs: [['板尺寸', '52 × 23 mm'], ['板厚', '1.6 mm'], ['比例', '真实尺寸']] },
];
export const partMap = Object.fromEntries(parts.map(p => [p.id, p])) as Record<string, Part>;
export const allVisible = () => Object.fromEntries(categories.map(c => [c.id, true])) as Record<CategoryId, boolean>;
