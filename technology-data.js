// Public documents provide context. Field boards remain the source for nodes,
// equipment models, operating-group configurations and provisional connections.
export const RESEARCH_DATE = '2026-10-22';
export const TECHNICAL_SOURCES = [
  {id:'principle',publisher:'北京矿冶研究总院 · 原始专利说明书',date:'2014-01-22',period:'CN102284369B / 通用技术解释',title:'一种提高浮选回收率的方法',url:'https://patents.google.com/patent/CN102284369B/zh',finding:'说明书解释了原矿磨矿与中矿另行再磨，如何兼顾不同解离需求，减少一次过细磨矿的过磨与泥化问题。',limit:'该专利未点名长安金矿，仅用于原理说明；其示例流程、参数和效果未移植到本图。'},
  {id:'bgrimm',publisher:'矿冶科技集团',date:'2020-07-01',period:'2012 年技改 / 2013 年成效',title:'金平长安金矿 2000 t/d 选厂改扩建工程',url:'https://www.bgrimm.com/gcsj/ywly/fmks/3cf82b42723446d099ec87b96fb69787.htm',finding:'工程案例确认，选厂于 2012 年底将一段磨浮改为阶段磨浮与中矿再磨再选。',limit:'文中 2013 年生产指标属于历史成效，未作为当前运行数据。'},
  {id:'plan2021',publisher:'红河州自然资源和规划局',date:'2022-01-26',period:'报告引述 2021 年 8 月开发利用方案',title:'长安金矿采矿权评估报告 · 选矿工艺',url:'https://www.hh.gov.cn/info/11161/625582.htm',finding:'正文第 58 页（PDF 第 69 页）引述阶段磨浮、中矿集中再磨及四粗五精两扫，与现场展板的核心流程相符。',limit:'该段提及陶瓷过滤机；本图仍按现场展板保留 MG100/1000-U 压滤机，配置差异待核对。报告前部的旧流程不与此版本混用。'},
  {id:'acceptance',publisher:'云南黄金集团',date:'2022-07-19',period:'2000 t/d 扩建工程验收公示',title:'长安矿业采选扩建工程竣工环保验收公示',url:'https://www.ygmg.net/154/231/content_1373.html',finding:'公示说明既有浮选厂改造与新增选矿系统的扩建背景，并说明项目通过自主环保验收。',limit:'这里核阅的是公示正文，未取得网盘中的完整验收报告；设计规模不等同于当前实际处理量。'},
  {id:'green2025',publisher:'云南省自然资源厅',date:'2025-08-25',period:'绿色矿山案例 / 其中技术成效涉及 2023 年',title:'金平县长安金矿绿色矿山建设典型案例',url:'https://dnr.yn.gov.cn/html/2025/shengtingdongtai_0825/4050432.html',finding:'官方案例介绍选矿回水回用及选厂主要设备的自动化远程控制。',limit:'本图展示回水汇集关系；尚未接入设备控制或实时数据，也未据报道补画逐用水点管线。'},
];

export const CIRCUIT_GUIDES = {
  primary:{kicker:'01 / STAGED RECOVERY',headline:'先磨先选，分段回收',explanation:'矿仓给矿经磨矿分级后进入第一段粗选。粗选Ⅰ泡沫经精选Ⅰ—Ⅲ得到精矿 1，粗选Ⅱ槽底矿浆进入二段磨矿。',chips:['Φ250 · 4 用 4 备','一段溢流 −325 目占 60%'],nodes:['spiral-classifier','cyclone-primary','rougher-2'],note:'细度及台数组别据展板；颜色区分使用 / 备用配置，非实时开停状态。',sources:['bgrimm','plan2021']},
  secondary:{kicker:'02 / SECOND-STAGE CIRCUIT',headline:'继续解离，再粗选与扫选',explanation:'承接粗选Ⅱ后的矿浆，二段旋流器底流返磨，溢流进入 3# 搅拌桶；后续粗选、精选与扫选分别通向精矿、中矿和尾矿。',chips:['Φ250 · 4 用 4 备','二段溢流 −325 目占 80%'],nodes:['cyclone-secondary','rougher-3','scavenger-2'],note:'粗选、扫选与精选Ⅰ的浮选机台数按展板合计保留，模型不推定逐作业台数。',sources:['plan2021']},
  regrind:{kicker:'03 / MIDDLINGS REGRIND',headline:'中矿再磨，返回选别',explanation:'Φ150 旋流器与 JM1500 构成再磨闭路，分级溢流进入再磨再选，精矿返回精选Ⅳ。外围接口保留中矿的来路与去向。',chips:['Φ150 · 1 用 5 备','再磨溢流 −400 目占 95%'],nodes:['cyclone-regrind','stirred-mill','regrind-flotation'],note:'集中再磨的总体技术有公开资料印证；具体中矿汇入点仍以展板的虚线待核对连接表达。',sources:['bgrimm','plan2021']},
  recovery:{kicker:'04 / CONCENTRATE & WATER',headline:'看清底流、溢流与滤饼',explanation:'先看精选Ⅲ、Ⅴ的两路精矿汇入 NZS-12 浓密池，再沿底流看 MG100/1000-U 压滤与精矿库。浓密溢流经过三台斜板，斜板底流也送压滤。切换“澄清与回水”，可追踪展板已有的四条水路；滤饼用静态箭头表示固体去向。',chips:['底流 → 压滤 → 固体滤饼','三台斜板 · 一组节点','蓝色 → 澄清与回水'],nodes:['cleaner-3','cleaner-5','concentrate-thickener','lamella-group','filter-press','return-water'],note:'左侧精选Ⅱ / Ⅳ接口保留前段浮选往返关系；扫选Ⅱ接口接尾矿支线。高位水池后的逐用水点和现场管线走向未确认，未补画。脱水仍按现场展板，历史陶瓷过滤机记录未替换当前压滤节点。',sources:['plan2021','green2025']},
};

export const TECHNICAL_DIFFERENCES = [
  ['设备配置','历史方案记载陶瓷过滤机；现场展板为 MG100/1000-U 压滤机。按现场保留，变更时间与对应系统待核对。'],
  ['指标时期','展板、2013 年技改成效与 2023 年科技项目报道采用不同指标背景，不拼成一组当前生产指标。'],
  ['磨矿编号','2021 年方案按球磨机顺序称后续作业为三段磨矿；本图按现场磨浮分段保留“二段溢流磨”名称。'],
  ['连接与外形','公开资料印证工艺总体结构，未补齐 7 条暂定回流、制造尺寸或厂房坐标。具体连接继续以现场资料核对。'],
];
