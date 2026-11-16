// The tour is a reading order through the supplied process graph. Branch changes
// are announced explicitly; successive shots do not imply additional pipework.
export const PROCESS_TOUR_CHAPTERS = [
  { id:'crushing', label:'原矿破碎' },
  { id:'primary', label:'一段磨浮' },
  { id:'secondary', label:'二段磨浮' },
  { id:'regrind', label:'中矿再磨' },
  { id:'recovery', label:'精矿脱水' },
  { id:'water', label:'尾矿与回水' },
];

const edge=(from,to)=>({from,to});
export const PROCESS_TOUR_STEPS = [
  {
    id:'ore-to-primary-crusher', chapterId:'crushing', title:'原矿进入粗碎',
    description:'原矿首先进入 PE600×900 颚式破碎机，破碎后送往中碎前预筛。沿箭头观察原矿从给料端到排料端的移动。',
    view:{stage:'crushing'}, nodeIds:['raw-ore','jaw-primary','prescreen'], primaryNodeId:'jaw-primary',
    edges:[edge('raw-ore','jaw-primary'),edge('jaw-primary','prescreen')], flowFocus:'all', duration:8,
  },
  {
    id:'prescreen-and-secondary-crusher', chapterId:'crushing', title:'预筛分流，筛上进入中碎',
    description:'预筛把物料分成两路：+40 mm 进入中碎颚破；-40 mm 从旁路进入闭路筛。中碎排料也汇入闭路筛，筛下物料无需重复经过中碎。',
    view:{stage:'crushing'}, nodeIds:['prescreen','jaw-secondary','closed-screen'], primaryNodeId:'prescreen',
    edges:[edge('prescreen','jaw-secondary'),edge('prescreen','closed-screen'),edge('jaw-secondary','closed-screen')], flowFocus:'all', duration:10,
  },
  {
    id:'cone-screen-closed-loop', chapterId:'crushing', title:'圆锥细碎与筛分形成闭路',
    description:'闭路筛的 +10 mm 筛上物料进入 CC300 圆锥破碎机，细碎后返回筛分；-10 mm 筛下产品进入磨矿前矿仓。粒度口径沿用流程图。',
    view:{stage:'crushing'}, nodeIds:['closed-screen','cone-crusher','ore-bin'], primaryNodeId:'cone-crusher',
    edges:[edge('closed-screen','cone-crusher'),edge('cone-crusher','closed-screen'),edge('closed-screen','ore-bin')], flowFocus:'all', duration:10,
  },
  {
    id:'primary-mill-spiral-loop', chapterId:'primary', title:'格子磨与双螺旋分级',
    description:'矿仓给料进入一段格子磨，磨后矿浆进入双螺旋分级机。粗颗粒以返砂形式回到球磨机，合格溢流进入下一组分级闭路。',
    view:{circuit:'primary'}, nodeIds:['ore-bin','mill-primary','spiral-classifier'], primaryNodeId:'mill-primary',
    edges:[edge('ore-bin','mill-primary'),edge('mill-primary','spiral-classifier'),edge('spiral-classifier','mill-primary')], flowFocus:'grinding', duration:10,
  },
  {
    id:'primary-cyclone-polishing-loop', chapterId:'primary', title:'旋流分级与溢流磨再磨',
    description:'双螺旋溢流进入一段旋流器。旋流器底流返回一段溢流磨，磨后再回到旋流器，形成第二个磨矿分级闭路。',
    view:{circuit:'primary'}, nodeIds:['spiral-classifier','cyclone-primary','mill-polishing'], primaryNodeId:'cyclone-primary',
    edges:[edge('spiral-classifier','cyclone-primary'),edge('cyclone-primary','mill-polishing'),edge('mill-polishing','cyclone-primary')], flowFocus:'grinding', duration:10,
  },
  {
    id:'primary-overflow-conditioning', chapterId:'primary', title:'合格溢流调浆后进入浮选',
    description:'一段旋流器的合格溢流进入 1# 搅拌桶，调浆后送入粗选Ⅰ。沿这一路可分清进入浮选的溢流与返回球磨机的底流。',
    view:{circuit:'primary'}, nodeIds:['cyclone-primary','conditioner-1','rougher-1'], primaryNodeId:'conditioner-1',
    edges:[edge('cyclone-primary','conditioner-1'),edge('conditioner-1','rougher-1')], flowFocus:'overflow', duration:9,
  },
  {
    id:'primary-roughing-main-stream', chapterId:'primary', title:'第一段粗选的槽内矿浆',
    description:'粗选Ⅰ后槽内矿浆继续进入粗选Ⅱ，后续将送第二段磨矿。含金矿物形成的精矿另走精选支路，下面切换到这条支路观察。',
    view:{circuit:'primary'}, nodeIds:['rougher-1','rougher-2'], primaryNodeId:'rougher-2',
    edges:[edge('rougher-1','rougher-2')], flowFocus:'all', duration:8,
  },
  {
    id:'first-concentrate-branch', chapterId:'primary', title:'精选Ⅰ—Ⅲ产出精矿 1',
    description:'粗选Ⅰ精矿依次经过精选Ⅰ、Ⅱ、Ⅲ，得到精矿 1；精选Ⅱ、Ⅲ的中矿逐级返回。精矿 1 后续送往精矿浓密池。',
    transitionNote:'切换支路：回到粗选Ⅰ的精矿出口，与粗选Ⅱ后矿浆分开追踪。',
    view:{circuit:'primary'}, nodeIds:['rougher-1','cleaner-1','cleaner-2','cleaner-3'], primaryNodeId:'cleaner-3',
    edges:[edge('rougher-1','cleaner-1'),edge('cleaner-1','cleaner-2'),edge('cleaner-2','cleaner-3'),edge('cleaner-2','cleaner-1'),edge('cleaner-3','cleaner-2')], flowFocus:'concentrate', duration:10,
  },
  {
    id:'secondary-mill-cyclone-loop', chapterId:'secondary', title:'粗选Ⅱ后矿浆进入二段磨矿',
    description:'粗选Ⅱ后矿浆进入二段旋流器，底流送二段溢流磨，磨后返回旋流器。分级溢流继续送往第二段浮选。',
    transitionNote:'返回主矿浆路线：从粗选Ⅱ出口接续二段磨矿；精矿 1 已分流。',
    view:{circuit:'secondary'}, nodeIds:['rougher-2','cyclone-secondary','mill-secondary'], primaryNodeId:'mill-secondary',
    edges:[edge('rougher-2','cyclone-secondary'),edge('cyclone-secondary','mill-secondary'),edge('mill-secondary','cyclone-secondary')], flowFocus:'grinding', duration:10,
  },
  {
    id:'secondary-overflow-conditioning', chapterId:'secondary', title:'二段溢流进入粗选Ⅲ',
    description:'二段旋流器溢流进入 3# 搅拌桶，调浆后送入粗选Ⅲ。此处接续的是二段分级后的矿浆。',
    view:{circuit:'secondary'}, nodeIds:['cyclone-secondary','conditioner-3','rougher-3'], primaryNodeId:'rougher-3',
    edges:[edge('cyclone-secondary','conditioner-3'),edge('conditioner-3','rougher-3')], flowFocus:'overflow', duration:8,
  },
  {
    id:'secondary-roughing-scavenging', chapterId:'secondary', title:'粗选Ⅳ与两次扫选',
    description:'粗选Ⅲ后槽内矿浆依次进入粗选Ⅳ、扫选Ⅰ和扫选Ⅱ，进一步回收剩余可浮矿物。扫选Ⅱ的最终尾矿另送尾矿浓密池。',
    view:{circuit:'secondary'}, nodeIds:['rougher-3','rougher-4','scavenger-1','scavenger-2'], primaryNodeId:'scavenger-2',
    edges:[edge('rougher-3','rougher-4'),edge('rougher-4','scavenger-1'),edge('scavenger-1','scavenger-2')], flowFocus:'all', duration:10,
  },
  {
    id:'second-concentrate-branch', chapterId:'secondary', title:'精选Ⅳ—Ⅴ产出精矿 2',
    description:'粗选Ⅲ精矿进入精选Ⅳ，再经精选Ⅴ得到精矿 2；精选Ⅴ的中矿返回精选Ⅳ。这一路精矿与精矿 1 汇入同一脱水系统。',
    transitionNote:'切换支路：回到粗选Ⅲ的精矿出口，观察第二路精矿。',
    view:{circuit:'secondary'}, nodeIds:['rougher-3','cleaner-4','cleaner-5'], primaryNodeId:'cleaner-5',
    edges:[edge('rougher-3','cleaner-4'),edge('cleaner-4','cleaner-5'),edge('cleaner-5','cleaner-4')], flowFocus:'concentrate', duration:9,
  },
  {
    id:'regrind-classification-loop', chapterId:'regrind', title:'中矿再磨闭路',
    description:'单独观察已确认的再磨闭路：Φ150 旋流器底流进入 JM1500 立式搅拌磨，磨后返回旋流器。中矿来路交叉处仍待核对，保留虚线。',
    transitionNote:'独立支路说明：中矿进入再磨的连接待核对，此处切换视角，不表示精矿 2 流入再磨。',
    view:{circuit:'regrind'}, nodeIds:['cyclone-regrind','stirred-mill'], primaryNodeId:'stirred-mill',
    edges:[edge('cyclone-regrind','stirred-mill'),edge('stirred-mill','cyclone-regrind')], flowFocus:'grinding', duration:10,
  },
  {
    id:'regrind-overflow-flotation', chapterId:'regrind', title:'再磨溢流再选，接回精选',
    description:'再磨旋流器溢流进入再磨浮选，回收精矿送往精选Ⅳ，继续精选至精矿 2。只沿图中已确认的出口接回精选系统。',
    view:{circuit:'regrind'}, nodeIds:['cyclone-regrind','regrind-flotation','cleaner-4','cleaner-5'], primaryNodeId:'regrind-flotation',
    edges:[edge('cyclone-regrind','regrind-flotation'),edge('regrind-flotation','cleaner-4'),edge('cleaner-4','cleaner-5')], flowFocus:'concentrate', duration:9,
  },
  {
    id:'concentrates-merge-thickening', chapterId:'recovery', title:'两路精矿汇入浓密池',
    description:'精选Ⅲ的精矿 1 和精选Ⅴ的精矿 2 汇入 Φ12 m 精矿浓密池。颗粒沉降到池底，旋转耙架把沉积精矿推向底流出口。',
    transitionNote:'汇合两路产品：精矿 1 与精矿 2 一起进入精矿脱水。',
    view:{circuit:'recovery'}, nodeIds:['cleaner-3','cleaner-5','concentrate-thickener'], primaryNodeId:'concentrate-thickener',
    edges:[edge('cleaner-3','concentrate-thickener'),edge('cleaner-5','concentrate-thickener')], flowFocus:'dewatering', duration:10,
  },
  {
    id:'overflow-lamella-clarification', chapterId:'recovery', title:'浓密溢流逐级澄清',
    description:'精矿浓密池溢流进入 1#—3# 斜板浓密机逐级澄清，回收的精矿从底流汇出。全景把三台斜板设备合并为一组展示。',
    transitionNote:'浓密池内分流：先观察上部溢流的澄清路线，再看底流压滤。',
    view:{circuit:'recovery'}, nodeIds:['concentrate-thickener','lamella-group'], primaryNodeId:'lamella-group',
    edges:[edge('concentrate-thickener','lamella-group')], flowFocus:'water', duration:8,
  },
  {
    id:'underflow-to-filter-press', chapterId:'recovery', title:'浓密底流汇入压滤机',
    description:'精矿浓密池底流与三台斜板浓密机回收的底流汇入压滤机。滤室压紧后进浆，滤布截留固体，液体经滤液出口排出。',
    transitionNote:'切换到底流：两处回收精矿汇入压滤，与澄清水分开追踪。',
    view:{circuit:'recovery'}, nodeIds:['concentrate-thickener','lamella-group','filter-press'], primaryNodeId:'filter-press',
    edges:[edge('concentrate-thickener','filter-press'),edge('lamella-group','filter-press')], flowFocus:'dewatering', duration:10,
  },
  {
    id:'filter-cake-to-storage', chapterId:'recovery', title:'卸饼后精矿入库',
    description:'压滤完成并卸压后，滤板逐片拉开，滤饼落入接料区域，再送精矿库。这里的产品是含金精矿滤饼；卸饼与进浆属于不同运行阶段。',
    view:{circuit:'recovery'}, nodeIds:['filter-press','concentrate-storage'], primaryNodeId:'filter-press',
    edges:[edge('filter-press','concentrate-storage')], flowFocus:'dewatering', duration:10,
  },
  {
    id:'tailings-thickening-branch', chapterId:'water', title:'最终尾矿单独浓密',
    description:'扫选Ⅱ最终尾矿进入 Φ38 m 尾矿浓密池。沉降后底流经输送系统送往大黑山尾矿库，上部溢流水进入回水系统。',
    transitionNote:'切换尾矿支路：回到扫选Ⅱ出口；精矿滤饼不进入尾矿系统。',
    view:{circuit:'recovery'}, nodeIds:['scavenger-2','tailings-thickener','tailings-storage'], primaryNodeId:'tailings-thickener',
    edges:[edge('scavenger-2','tailings-thickener'),edge('tailings-thickener','tailings-storage')], flowFocus:'all', duration:10,
  },
  {
    id:'recovered-water-collection', chapterId:'water', title:'三路回水汇入高位水池',
    description:'斜板末端溢流、压滤滤液和尾矿浓密溢流水汇入高位水池，供生产回用。演示到此完成；资料未提供逐个用水点的供水管线。',
    transitionNote:'汇合回水：来自精矿脱水和尾矿浓密的三路水，在水池汇集。',
    view:{circuit:'recovery'}, nodeIds:['lamella-group','filter-press','tailings-thickener','return-water'], primaryNodeId:'return-water',
    edges:[edge('lamella-group','return-water'),edge('filter-press','return-water'),edge('tailings-thickener','return-water')], flowFocus:'water', duration:10,
  },
];

/** A deterministic clock; rendering and camera changes stay in the caller. */
export function createProcessTour(steps=PROCESS_TOUR_STEPS){
  if(!Array.isArray(steps)||!steps.length)throw new RangeError('A process tour requires at least one step.');
  const durations=steps.map(step=>{
    if(!Number.isFinite(step?.duration)||step.duration<=0)throw new RangeError('Tour step duration must be a positive finite number.');
    return step.duration;
  });
  const offsets=[0];
  for(const duration of durations)offsets.push(offsets.at(-1)+duration);
  const totalDuration=offsets.at(-1);
  if(!Number.isFinite(totalDuration))throw new RangeError('Tour total duration must be finite.');
  let active=false,playing=false,completed=false,index=0,elapsed=0;
  const snapshot=()=>({
    active,playing,completed,index,step:steps[index],elapsed,
    stepProgress:Math.min(1,Math.max(0,elapsed/durations[index])),
    progress:completed?1:Math.min(1,Math.max(0,(offsets[index]+elapsed)/totalDuration)),
    totalDuration,
  });
  const finish=()=>{index=steps.length-1;elapsed=durations[index];completed=true;playing=false;};
  const seek=value=>{
    let number;
    try{number=Number(value);}catch{number=0;}
    index=Number.isNaN(number)?0:Math.max(0,Math.min(steps.length-1,Math.trunc(number)));
    if(!active)playing=false;
    active=true;completed=false;elapsed=0;
    return snapshot();
  };
  return {
    get snapshot(){return snapshot();},
    start(){active=true;playing=true;completed=false;index=0;elapsed=0;return snapshot();},
    pause(){playing=false;return snapshot();},
    resume(){if(active&&!completed)playing=true;return snapshot();},
    stop(){active=false;playing=false;completed=false;index=0;elapsed=0;return snapshot();},
    seek,
    next(){
      if(index===steps.length-1){active=true;finish();return snapshot();}
      return seek(index+1);
    },
    previous(){return seek(index-1);},
    tick(dt){
      if(!active||!playing||!Number.isFinite(dt)||dt<=0)return snapshot();
      let remaining=dt;
      while(remaining>=durations[index]-elapsed){
        remaining-=durations[index]-elapsed;
        if(index===steps.length-1){finish();return snapshot();}
        index++;elapsed=0;
      }
      elapsed+=remaining;
      return snapshot();
    },
  };
}
