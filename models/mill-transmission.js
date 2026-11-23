import * as THREE from 'three';

// Common external arrangement from the November shop-floor photos. The shaft
// axes matter here; concealed bearing internals are deliberately not specified.
export function buildMillTransmission({ part, mesh, box, cyl, sector, ring, bolts, M, CY, endOffset, cachedGeometry }) {
  const paint = (color, roughness = .56, metalness = .18) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const mainWhite = paint(0xd3d2c8), baseGray = paint(0x646b6c, .77);
  const motorGray = paint(0x858b90), motorEdge = paint(0xa2a6a6);
  const red = paint(0xb03329, .48), redEdge = paint(0x932b25);
  const casting = paint(0x444a43, .68), castEdge = paint(0x5a6058, .62);
  const joint = paint(0x222724, .73), oiled = paint(0x383937, .38, .72);
  const tau = Math.PI * 2;
  const addGroup = (root, name, x, y, z) => {
    const g = new THREE.Group();
    g.name = name; g.position.set(x, y, z); root.add(g);
    return g;
  };
  function plinth(parent, depth, height, lower, upper, material, y) {
    // Extruded trapezoidal block: a broad concrete foot and narrower top.
    const geometry = cachedGeometry('mill-plinth:' + [depth,height,lower,upper].join(':'), () => {
      const shape = new THREE.Shape();
      shape.moveTo(-lower/2,0); shape.lineTo(lower/2,0);
      shape.lineTo(upper/2,height); shape.lineTo(-upper/2,height); shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled:false, steps:1 });
      g.translate(0,0,-depth/2); g.rotateY(Math.PI/2);
      return g;
    });
    mesh(parent,geometry,material,0,y,0);
  }
  function nut(parent, x, y, z, radius) {
    cyl(parent,radius * 1.24,.017,M.steel,x,y,z,'y',16);
    cyl(parent,radius,radius * .85,M.steelBright,x,y + .016,z,'y',6);
    cyl(parent,radius * .50,radius * .50,M.dark,x,y + radius * .61,z,'y',10);
  }

  const pinY = 1.20, pinZ = 1.30;
  const drive = part('drive','灰色电机与红色联轴器',
    '灰色电机罩位于筒体侧面。动力沿红色法兰联轴器和传动轴送到小齿轮，再经大齿圈带动筒体。剖视时收起联轴器网罩，便于辨认转动件。',[-3.76,1.44,1.52],[-1.50,.05,2.10]);
  const pinion = addGroup(drive,'pinion-shaft-and-coupling',-2.34,pinY,pinZ);
  cyl(pinion,.20,.31,oiled,0,0,0);
  for(let i=0;i<18;i++){
    const a=i*tau/18;
    const tooth=box(pinion,.30,.06,.052,oiled,0,.218*Math.sin(a),.218*Math.cos(a));
    tooth.rotation.x=Math.PI/2-a;
  }
  cyl(pinion,.085,2.06,M.steel,-.48,0,0);
  cyl(pinion,.105,.15,oiled,.61,0,0);
  // The red pair of flanges belongs to the shaft, not the fixed split blocks.
  cyl(pinion,.206,.40,red,-1.26,0,0);
  for (const x of [-1.485,-1.38,-1.13,-1.035]) {
    cyl(pinion,.254,.047,redEdge,x,0,0);
    bolts(pinion,x-.025,.214,12,.022,M.dark,false,0);
  }
  cyl(pinion,.227,.019,joint,-1.27,0,0);

  const motor=addGroup(drive,'stationary-grey-motor',-4.32,pinY,pinZ);
  cyl(motor,.685,.72,motorGray,0,0,0);
  for(const side of [-1,1]){
    cyl(motor,.703,.055,motorEdge,side*.345,0,0);
    cyl(motor,.626,.075,M.dark,side*.405,0,0);
    sector(motor,.545,.662,.072,0,tau,motorGray,side*.447,false,0,0);
    // Circular wire screen over a dark fan cavity on each face.
    for(let n=-10;n<=10;n++){
      const v=n*.052,span=2*Math.sqrt(.543**2-v*v);
      box(motor,.011,span,.009,motorEdge,side*.473,0,v);
      box(motor,.011,.009,span,motorEdge,side*.474,v,0);
    }
    cyl(motor,.113,.094,motorGray,side*.50,0,0);
    for(let n=0;n<4;n++){
      const a=n*tau/4;
      const spoke=box(motor,.025,.036,.46,motorGray,side*.482,.32*Math.sin(a),.32*Math.cos(a));
      spoke.rotation.x=-a;
    }
  }
  // Dark ventilation slot banks on the curved motor shroud.
  for(let i=0;i<12;i++){
    const a=i*tau/12;
    for(let n=-3;n<=3;n++){
      const vent=box(motor,.022,.102,.012,M.slot,n*.054,.686*Math.sin(a),.686*Math.cos(a));
      vent.rotation.x=-a;
    }
  }
  box(motor,1.20,.19,1.32,baseGray,0,-1.10,0);
  box(motor,1.09,.20,1.19,M.base,0,-.91,0);
  for (const zz of [-.40,.40]) {
    box(motor,.79,.38,.215,motorGray,0,-.65,zz);
    box(motor,.90,.07,.29,motorEdge,0,-.79,zz);
    for(const xx of [-.31,.31]) nut(motor,xx,-.744,zz,.04);
  }
  // Stationary coupling screen. Discrete bar geometry keeps red visible; a
  // removable upper half opens in section. No transparent blending required.
  const cage=addGroup(drive,'stationary-coupling-screen',-3.59,pinY,pinZ);
  for(const xx of [-.29,0,.29])
    sector(cage,.306,.319,.022,-.22,Math.PI+.22,motorEdge,xx,true,0,0);
  for(let i=0;i<=18;i++){
    const a=-.22+i*(Math.PI+.44)/18;
    cyl(cage,.006,.58,motorEdge,0,.314*Math.sin(a),.314*Math.cos(a),'x',6,true);
  }

  const sideSupport = part('pinion-bearings','小齿轮轴承座',
    '红色联轴器旁，传动轴穿过固定在底座上的剖分轴承座；两个支点分列小齿轮两侧。外部可辨认上盖、水平接缝、压紧螺栓和轴端密封。照片未露出轴承内部，内部型式不作推定。',
    [-2.78-endOffset,1.43,1.48],[.15,1.0,2.40]);
  for(const [id,x] of [['outboard',-2.78],['inboard',-1.90]]){
    const h=addGroup(sideSupport,'pinion-bearing-'+id,x-endOffset,pinY,pinZ);
    box(h,.60,.16,.76,baseGray,0,-1.10,0);
    plinth(h,.42,.68,.67,.48,baseGray,-1.02);
    box(h,.54,.072,.71,M.dark,0,-.316,0);
    box(h,.43,.065,.64,castEdge,0,-.249,0);
    // Lower casting and domed cap surround an open bore on the shaft axis.
    box(h,.318,.145,.45,casting,0,-.172,0);
    sector(h,.106,.218,.335,Math.PI+.015,tau-.015,casting,0,false,0);
    sector(h,.106,.221,.335,.018,Math.PI-.018,castEdge,0,false,0);
    for(const zz of [-.211,.211]){
      box(h,.331,.068,.102,casting,0,-.037,zz);
      box(h,.333,.010,.108,joint,0,.001,zz);
      box(h,.331,.086,.108,castEdge,0,.049,zz);
      for(const xx of [-.093,.093])nut(h,xx,.097,zz,.033);
    }
    for(const ss of [-1,1]){
      sector(h,.087,.154,.040,0,tau,oiled,ss*.176,false,0);
      sector(h,.088,.114,.012,0,tau,joint,ss*.203,false,0);
    }
    for(const xx of [-.148,.148])for(const zz of [-.267,.267])nut(h,xx,-.204,zz,.035);
    cyl(h,.023,.044,M.steelBright,.056,.239,0,'y',8);
    cyl(h,.029,.013,redEdge,.056,.266,0,'y',10);
  }

  const support=part('bearings','两端主轴承座',
    '给矿端和排矿端各有一座白灰色主轴承座，环抱中空轴并将筒体重量传到底部基础。上盖与底座固定，轴颈在座孔中转动。这里按外部照片表现壳体、接缝和紧固件。',[-3.0,2.52,.38],[0,0,0]);
  for(const side of [-1,1]){
    const h=addGroup(support,'trunnion-bearing-'+(side<0?'feed':'discharge'),side*2.99,0,0);
    box(h,1.31,.20,1.62,baseGray,0,.12,0);
    plinth(h,.98,1.02,1.41,1.15,baseGray,.22);
    box(h,1.06,.13,1.33,M.base,0,1.28,0);
    box(h,.94,.095,1.31,mainWhite,0,1.387,0);
    plinth(h,.716,.40,1.12,.95,mainWhite,1.434);
    // Split joint surrounds (rather than crosses) the trunnion.
    sector(h,.351,.595,.704,Math.PI+.005,tau-.005,mainWhite,0,false,CY);
    sector(h,.351,.599,.718,.005,Math.PI-.005,mainWhite,0,false,CY);
    for(const s of [-1,1]){
      sector(h,.336,.425,.032,0,tau,M.dark,s*.370,false,CY);
      sector(h,.327,.358,.032,0,tau,M.steelBright,s*.392,false,CY);
      for(const z of [-.508,.508]){
        box(h,.704,.092,.267,mainWhite,0,CY+s*.052,z);
      }
    }
    for(const z of [-.530,.530]){
      box(h,.714,.012,.235,joint,0,CY,z);
      for(const x of [-.217,.217])nut(h,x,CY+.107,z,.051);
    }
    for(const x of [-.372,.372]) for(const z of [-.525,.525]) nut(h,x,1.443,z,.049);
    // Lifting eye and small oil inlet are external fittings, not internal detail.
    const eye=ring(h,.067,.019,mainWhite,.16,CY+.643,0);
    eye.name='主轴承盖吊耳';
    cyl(h,.035,.075,M.steel,-.12,CY+.624,-.02,'y',10);
    cyl(h,.036,.015,redEdge,-.12,CY+.665,-.02,'y',12);
  }
  return {drive,pinion,support};
}
