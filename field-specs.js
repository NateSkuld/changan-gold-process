// 现场设备标示卡：按工艺节点绑定，避免同型设备间误用参数。
// 型号与技术数据来自设备卡；衬板材质由矿方确认，不是设备卡字段。
const millMaker = '山东黄金集团烟台设计研究工程有限公司';
function mill({unit, model, type, liner, sourceId, length, volume, charge, speed, size, capacity, current, air, oil, note}) {
  return {
    unit, model, type, liner, sourceId, note,
    rows: [
      ['排矿型式', type], ['筒体内径', '2700 mm'], ['筒体工作长度', length + ' mm'],
      ['有效容积', volume + ' m³'], ['最大装球量', charge + ' t'], ['筒体工作转速', speed + ' r/min'],
      ...(capacity ? [['排矿粒度', '0.3～0.074 mm'], ['产量范围', capacity + ' t/h']] : []),
      ['整机外廓（长×宽×高）', size + ' mm'],
      ['高压电机', 'TDMK400-32/2150 · 400 kW'], ['电机额定电压 / 电流', '10 kV / ' + current + ' A'],
      ['电机转速', '187.5 r/min'], ['空气压缩机', air], ...(oil ? [['稀油站', oil]] : []),
      ['主机出厂年月', '2009 年 1 月'], ['主机出厂厂家', millMaker],
    ],
  };
}

export const FIELD_EQUIPMENT = {
  'mill-primary': mill({
    unit: 1, model: 'MQG2700×3600', type: '格子型', liner: 'steel', sourceId: 'IMG_7675',
    length: 3600, volume: 18.5, charge: 39, speed: 20.94, size: '10377 × 5825 × 4680',
    capacity: '12～145', current: 28, air: 'V-0.67/8 · 4 kW', oil: 'GXYZ2.5-40',
    note: '矿方确认为钢衬板。型号和参数来自 1# 设备标示卡；产量范围不代表现场实时处理量。',
  }),
  'mill-polishing': mill({
    unit: 2, model: 'MQCY2740', type: '溢流型', liner: 'rubber', sourceId: 'IMG_7673',
    length: 4000, volume: 20.5, charge: 35, speed: 20.9, size: '10376 × 5950 × 4680',
    current: 28.5, air: 'V-0.67/8 · 3 kW',
    note: '矿方确认采用照片所示橡胶衬板。现场标示卡写 MQCY2740，工艺展板写 MQY2740。此卡未列产量和排矿粒度。',
  }),
  'mill-secondary': mill({
    unit: 3, model: 'MQCY2736', type: '溢流型', liner: 'rubber', sourceId: 'IMG_7672',
    length: 3600, volume: 18.5, charge: 32, speed: 20.9, size: '10250 × 5825 × 4680',
    capacity: '10.5～130', current: 28, air: 'V-0.67/8 · 3 kW',
    note: '矿方确认采用照片所示橡胶衬板。现场标示卡写 MQCY2736，工艺展板写 MQY2736；产量范围不代表现场实时处理量。',
  }),
  'spiral-classifier': {
    model: '2FG-2000', type: '螺旋分级机', sourceId: 'IMG_7674',
    note: '现场标示卡列的是设备参数。返砂量与溢流量是不同物流的标示值，不代表选厂实时处理量。',
    rows: [
      ['水槽尺寸', '9400 × 4240（卡上未注单位）'], ['槽体倾角', '14°～18.5°'],
      ['螺旋直径', '2000 mm'], ['螺旋长度', '8200 mm'], ['螺旋转速', '5.6 r/min'],
      ['返砂量', '10800 t/d'], ['溢流量', '800 t/d'],
      ['三相异步电动机', 'Y160L-4 · 15 kW'], ['电机额定电压 / 电流', '380 V / 30.3 A'],
      ['电机转速', '1460 r/min'], ['圆柱齿轮减速机', 'ZL60 · 传动比 31.5'], ['主机出厂年月', '2009 年 2 月'],
    ],
  },
};
