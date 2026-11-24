// Engineering dimensions are transcribed from annotations, not measured from paper space.
// Only derived model notes are published; the supplied drawings remain local.
export const DRAWINGS = {
  thickener12: {
    title:'精矿浓密池', short:'12 m 精矿池', number:'01', equipment:'thickener', node:'concentrate-thickener',
    badge:'机械图 · 走台板图 · 基础变更', lead:'按机械分图还原中心传动、过载指示器和花纹钢走台。锚栓尺寸见基础变更记录。',
    rows:[['名义池径','Φ12 m'],['走台长板（2 件）','13 590 × 785 × 4 mm'],['走台短板（2 件）','2 430 × 350 × 4 mm'],['基础变更图 · 埋设螺栓','8 × M24，长 680 mm'],['基础变更图 · 螺栓外露','80 mm']],
    source:'12m浓密机机械图、12m浓密机机械图2、12米高效走台板、12米浓密机变更_t3。',
    limit:'机械分图给出了传动部件和过载指示器；未提供完整的池体施工剖面。池深、耙齿形状及沉降速度为示意。'
  },
  thickener38: {
    title:'尾矿浓密池', short:'38 m 尾矿池', number:'02', equipment:'thickener', node:'tailings-thickener',
    badge:'土建剖面 · GZN-38 管路图', lead:'沿池壁向中心看，两段池底斜坡通往集泥环槽，中心另设混凝土支座。',
    rows:[['池内径','Φ38 m'],['两段池底坡度（外 → 内）','12.3% → 23.1%'],['池底标高（外 → 内）','±0.000 → −0.942 → −3.031 m'],['环槽底标高','−4.231 m'],['中心支座顶标高','+1.500 m'],['给矿 / 底流 / 溢流管（外径 × 壁厚）','Φ273 × 10 / Φ219 × 10 / Φ219 × 8 mm']],
    source:'金平浓密机土建 Model (2)、(4) 平面与池体剖面；金平38M浓密机管路图，YS0160211-03。',
    limit:'标高为土建相对标高。管路图给出扫选尾矿、底流去尾矿泵、溢流去回水池三条路径；耙架细节与流动动画为原理示意。'
  },
  flotation: {
    title:'U 形槽浮选机', short:'浮选单槽', number:'03', equipment:'flotation', node:null,
    badge:'设备 DWG · 正视与侧视', lead:'轴向看槽底呈 U 形；正视图与侧视图共同限定槽体和中央立轴的位置。',
    rows:[['槽长','2 180 mm'],['槽宽','2 250 mm'],['槽底至上缘','1 900 mm'],['两侧定位','各 550 mm'],['局部定位尺寸','400 mm']],
    source:'浮选机.dwg，正、侧视图。尺寸依图上标注文字，未用全图统一比例反推其他尺寸。',
    limit:'原图未标型号、有效容积或所属选别作业，不能认定为任一组 8、2.8 或 3 m³ 设备。叶片、气路和泡沫输送为教学示意。'
  }
};
