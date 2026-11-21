/**
 * Plant-specific content transcribed from the user's two display-board photographs.
 * Model names follow the flow diagram where the two boards differ.
 * This is an educational reconstruction, not a surveyed or dimensioned engineering model.
 */
const FLOW = { title: '现场资料 · 选矿工艺流程图', url: './references/reference-01.jpg' };
const INTRO = { title: '现场资料 · 选厂工艺流程简介', url: './references/reference-02.jpg' };

export const EQUIPMENT = [
  {
    id: 'crusher', number: '01', name: '颚式破碎机', enName: 'JAW CRUSHER', stage: '粗碎 · 中碎',
    model: 'PE600×900 / PE250×1250',
    badge: '现场外观参考 · 粗 / 中碎对应待核对',
    evidence: '橙色机体、圆侧护罩及黑色溜槽参考 IMG_7481、7482；照片无法确认是粗碎还是中碎。两节点共用同类外观示意，内部按通用颚破原理。型号按流程图，简介中的 PEX250×1200 待核对。',
    description: '现场采用三段一闭路破碎。PE600×900 完成粗碎，SZZ1500×4000 预先筛出细料，筛上矿石进入中碎颚式破碎机，随后进入圆振筛与圆锥破碎闭路。',
    principle: '偏心轴带动动颚往复运动，矿石在动颚与定颚之间受挤压而破碎。破碎矿石从下部排料口排出，再进入筛分和后续破碎环节。',
    input: '原矿；中碎接收预筛筛上料', output: '粗碎排料 → 预筛；中碎排料 → 圆振筛',
    focus: ['定颚与动颚', '偏心轴与飞轮', '破碎腔'],
    steps: ['原矿进入粗碎腔', '预筛细料旁路，中碎处理筛上料', '中碎产品与旁路物料进入圆振筛'],
    sources: [FLOW, INTRO, {title:'现场实拍 · 颚破与平台',url:'./references/2026-10-21/IMG_7481.jpg'}],
  },
  {
    id: 'cone', number: '02', name: '圆锥破碎机', enName: 'CONE CRUSHER', stage: '细碎 · 闭路',
    model: 'CC300', badge: 'CC300 铭牌已确认 · 现场外观重建', evidence: 'IMG_7484 铭牌确认 CC300；机体、红环、双段黑罩、侧检修门与传动外观参考实拍。内部结合此前教学模型与通用原理，尚未取得 CC300 制造图，尺寸为示意。',
    description: 'CC300 承担第三段细碎。2YAN1848 圆振筛筛上物料进入圆锥破碎机，排料返回圆振筛；筛下产品进入磨矿前矿仓，组成一段闭路。',
    principle: '偏心机构使动锥相对定锥周期性靠近和远离，矿石在环形破碎腔中受到挤压。矿石逐级下移，破碎产品由底部排出，筛上粗粒返回继续破碎。',
    input: '圆振筛筛上料（流程图标注 +10 mm）', output: '细碎产品 → 圆振筛；筛下料 → 矿仓',
    focus: ['动锥与定锥衬板', '偏心套与主轴', '传动及排料区域'],
    steps: ['筛上粗粒进入破碎腔', '动锥偏摆，矿石受压破碎', '产品返回筛分，筛下料进入磨矿'],
    sources: [FLOW, INTRO, { title: '现场实拍 · CC300 外观与铭牌', url: './references/2026-10-21/IMG_7484.jpg' }, { title: '现场资料 · 圆锥破碎机教学模型', url: './references/reference-03.jpg' }],
  },
  {
    id: 'mill', number: '03', name: '球磨机', enName: 'BALL MILL', stage: '阶段磨矿',
    model: 'MQG2700×3600 / MQCY2740 / MQCY2736',
    evidence: '型号采用现场设备标牌；流程图依次简写 MQG2736、MQY2740、MQY2736。现场确认衬板材质，内部结构按照片作原理示意。',
    description: '1# 格子磨采用钢衬板，与双螺旋分级机闭路。2# 一段溢流磨和 3# 二段溢流磨采用橡胶衬板，分别与各自的 Φ250 旋流器组闭路；两台仍以钢球作为研磨介质。',
    principle: '传动装置带动筒体旋转，衬板将钢球和矿料提升，随后发生冲击与研磨，使矿石变细并促进矿物解离。格子型与溢流型的排矿结构不同；当前模型重点展示筒体、衬板、钢球与齿轮传动。',
    input: '碎矿或阶段选别后的矿浆 + 分级返砂', output: '磨机排矿 → 螺旋分级机或水力旋流器',
    focus: ['筒体与衬板', '钢球与矿料', '齿圈与传动'],
    steps: ['物料与返砂进入磨机', '衬板提升钢球，冲击并研磨', '排矿进入分级，粗粒返回磨机'],
    sources: [FLOW, INTRO, { title: '现场资料 · 球磨机模型', url: './references/reference-04.jpg' }],
  },
  {
    id: 'cyclone', number: '04', name: '水力旋流器', enName: 'HYDROCYCLONE', stage: '闭路分级',
    model: 'Φ250 / Φ150', evidence: '简介标注：两组 Φ250 各 8 台（4 用 4 备）；Φ150 为 6 台（1 用 5 备）。',
    description: '两组 Φ250 旋流器分别配合第一段、第二段溢流型球磨机；Φ150 旋流器与 JM1500 立式搅拌磨组成中矿再磨闭路。细粒溢流进入对应的调浆或选别作业，较粗底流返回磨机。',
    principle: '矿浆由切向入口进入筒锥体，旋转流场完成分级。较粗颗粒更多随底流排出，较细颗粒更多随溢流排出；分配也受颗粒密度与运行状态影响。',
    input: '磨机排矿及对应阶段回流矿浆', output: '溢流 → 后续选别；底流 → 对应磨机',
    focus: ['切向给料口', '溢流管', '锥体与沉砂嘴'],
    steps: ['矿浆切向进入', '旋转流场完成分级', '溢流前行，底流返回磨机'],
    sources: [FLOW, INTRO],
  },
  {
    id: 'flotation', number: '05', name: '机械搅拌浮选机', enName: 'FLOTATION CELL', stage: '四粗 · 两扫 · 五精',
    model: '8 m³ / 2.8 m³ / 3 m³', evidence: '简介标注 23 台 8 m³、4 台 2.8 m³、6 台 3 m³ 浮选机；作业分配见生产流程。',
    description: '采用“阶段磨矿阶段选别—中矿再磨再选”。第一段包括粗选Ⅰ、Ⅱ与精选Ⅰ、Ⅱ、Ⅲ；第二段包括粗选Ⅲ、Ⅳ、扫选Ⅰ、Ⅱ和精选Ⅳ、Ⅴ；中矿另设再磨再选作业。',
    principle: '矿浆经调浆后与空气接触，叶轮搅拌使矿物颗粒与气泡碰撞。疏水性颗粒附着气泡上浮，被收集为泡沫产品；槽内矿浆进入下一作业，精矿经精选后送往脱水。',
    input: '分级溢流或上一选别作业矿浆', output: '精矿 → 精选或脱水；中矿 → 回流或再磨；尾矿 → 浓密池',
    focus: ['叶轮与定子', '气泡矿化区', '泡沫层与精矿槽'],
    steps: ['矿浆调浆并充气', '气泡携带目标矿物上浮', '按粗选、扫选、精选及再选路径分流'],
    sources: [FLOW, INTRO],
  },
  {
    id: 'thickener', number: '06', name: '精矿浓密机', enName: 'CONCENTRATE THICKENER', stage: '浓缩 · 回水',
    model: 'NZS-12 + 3 台 150/55 斜板浓密机', evidence: '流程图标注 Φ12 m 精矿浓密池；简介补充 NZS-12 与 150/55 型号。另有 Φ38 m 尾矿浓密池。',
    description: '两路浮选精矿进入 Φ12 m 浓密池。浓密溢流再经过三台串联斜板浓密机回收细颗粒，各路浓缩精矿汇入压滤机，澄清水进入回水系统。',
    principle: '矿浆进入给料区，固体依靠重力沉降；耙架缓慢汇集沉积固体并由底流口排出。后续斜板装置增加有效沉降面积，进一步回收溢流中的细颗粒。',
    input: '精选Ⅲ与精选Ⅴ的精矿', output: '浓密底流及斜板底流 → 压滤；溢流水 → 高位水池',
    focus: ['中心给料筒', '耙架与耙齿', '底流口与溢流堰'],
    steps: ['两路精矿进入浓密池', '沉降浓缩，溢流进入斜板组', '精矿汇入压滤，澄清水回用'],
    sources: [FLOW, INTRO],
  },
  {
    id: 'filter', number: '07', name: '精矿压滤机', enName: 'CONCENTRATE FILTER PRESS', stage: '精矿脱水',
    model: 'MG100/1000-U', evidence: '简介标注压滤给料浓度 45%、滤饼水分 ≤13%；为展板数据，并非当前实测。',
    description: '接收 Φ12 m 浓密池和三台斜板浓密机的浓缩精矿，完成两段脱水中的过滤环节。滤饼送至精矿库，滤液汇入高位水池回用。',
    principle: '液压机构夹紧滤板形成滤室，给料压力推动液体通过滤布与流道。固体被截留并形成滤饼，过滤周期结束后开板卸饼。',
    input: '浓密机及斜板浓密机底流', output: '含金精矿滤饼 → 精矿库；滤液 → 高位水池',
    focus: ['滤板与滤室', '滤布与排液流道', '液压夹紧机构'],
    steps: ['滤板闭合，矿浆入室', '压差过滤，形成滤饼', '开板卸饼，滤液回收'],
    sources: [FLOW, INTRO],
  },
];

// A shared geometry does not imply the same process duty.
export const NODE_EQUIPMENT_OVERRIDES = {
  'prescreen': {
    badge:'展板节点 · 通用预筛结构',
    evidence:'流程图标注 SZZ1500×4000，按 ±40 mm 分流。新照片未能确认蓝色筛箱对应此节点，所以此处保留通用预筛造型。',
  },
  'closed-screen': {
    badge:'蓝色外罩参考实拍 · 设备对应待核对',
    evidence:'蓝色封闭筛箱、加强筋与支撑参考 IMG_7483，同类外观暂用于筛分原理表达；尚不能确认照片设备就是 2YAN1848。型号按流程图，简介 2YAH1848 待核对。内部筛层、振动与支承均为通用示意。',
    sources:[FLOW,INTRO,{title:'现场实拍 · 蓝色筛分外罩',url:'./references/2026-10-21/IMG_7483.jpg'}],
  },
  'tailings-thickener': {
    name: '尾矿浓密池', enName: 'TAILINGS THICKENER', stage: '尾矿 · 回水',
    description: '扫选Ⅱ的最终尾矿浆自流进入 Φ38 m 尾矿浓密池脱水。沉降后的底流由柱塞泥浆泵输送至大黑山尾矿库，溢流水进入高位水池回用。',
    principle: '尾矿固体依靠重力沉降，耙架将沉积物汇集至底流排出口。澄清液越过周边溢流堰进入回水管路，实现固体浓缩与水的分离。',
    input: '扫选Ⅱ最终尾矿', output: '浓密底流 → 大黑山尾矿库；溢流水 → 高位水池',
    steps: ['尾矿浆自流进入浓密池', '沉降浓缩，底流泵送至尾矿库', '上部溢流水进入高位水池回用'],
    evidence: 'Φ38 m 来自流程图；工艺简介标注底流浓度 37%，为展板数据。三维结构为通用原理示意。',
    partDescriptions: {
      'thickener-outlets': '上部溢流堰收集澄清水并送至高位水池。底部管路排出浓缩尾矿浆，经柱塞泥浆泵输送至大黑山尾矿库。',
    },
  },
};

export const PROCESS_NOTE = '根据用户提供的《选矿工艺流程图》《选厂工艺流程简介》重建，型号冲突先采用流程图，差异标为待核对。设备采用原理级三维表达，空间位置不代表现场施工布置。部分中矿回流线在照片中交叉密集，以虚线标示待核对连接。品位、回收率、浓度与水分等为展板标注，不是当前实测值。终点为含金精矿滤饼，仍需后续冶金处理。';


// Supplementary asset: intentionally absent from PLANT_NODES until its endpoints are confirmed.
export const SITE_EQUIPMENT = [{
  id:'conveyor',number:'S1',name:'1# 胶带机',enName:'BELT CONVEYOR',stage:'破碎工段 · 输送',
  model:'现场标识 1# · 规格待核对',badge:'现场外观参考 · 上下游待核对',
  description:'照片可见倾斜胶带机、黑色胶带、橙色框架及护栏。此模型用于观察胶带、托辊和驱动的配合，作为现场补充设备单独展示；暂未接入生产流程。',
  principle:'驱动滚筒通过摩擦带动闭合胶带运行，托辊支承承载段与回程段。动画演示沿模型坡向输送的常见原理，实际运行方向和转接点尚待现场确认。',
  input:'给料端位置待核对',output:'卸料端及后续设备待核对',
  focus:['胶带与托辊','机架与护栏','驱动滚筒'],
  steps:['矿料落在承载胶带上（原理示意）','托辊支承胶带，驱动滚筒带动运行','物料经端部卸出，实际去向待核对'],
  evidence:'外观依据 IMG_7481、7482，可见 1#胶带机 标识。坡度、长度、内部驱动布置均为示意；照片不能确认运动方向和上下游，未据此改变展板连接。',
  sources:[{title:'现场实拍 · 1#胶带机与钢架',url:'./references/2026-10-21/IMG_7482.jpg'},{title:'现场实拍 · 设备及1#标识',url:'./references/2026-10-21/IMG_7481.jpg'}],
}];
