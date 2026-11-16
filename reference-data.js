// Captions distinguish visible features from unresolved equipment identities.
export const SITE_REFERENCES = [
  {file:'IMG_7484',title:'CC300 圆锥破碎机',note:'铭牌确认 CC300；银灰机体、红色环带、黑色上罩。内部结构不可见。'},
  {file:'IMG_7481',title:'颚破与给料平台',note:'橙色机体、圆形侧护罩和黑色溜槽；粗碎 / 中碎对应关系待核对。'},
  {file:'IMG_7483',title:'蓝色筛分外罩与高架平台',note:'可见封闭筛箱、钢架与管道；筛机型号及流程节点待核对。'},
  {file:'IMG_7482',title:'1# 胶带机与厂房钢架',note:'倾斜胶带机、橙色栏杆与酒红钢柱；输送方向、上下游端点待核对。'},
].map(item=>({...item,url:`./references/2026-10-21/${item.file}.jpg`}));
export const BOARD_REFERENCES = ['选矿工艺流程图','选厂工艺流程简介','圆锥破碎机教学模型','球磨机教学模型'].map((title,i)=>({title,note:'2026.10.12 / 展板与教学模型',url:`./references/reference-0${i+1}.jpg`}));
