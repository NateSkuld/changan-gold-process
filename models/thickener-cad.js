// Model units per metre are passed in. Piping and civil plans are distinct
// sources; these sections describe geometry, not survey or construction data.
import * as THREE from 'three';

export function buildCadThickenerCivil(tank,{s, el, M, halfProfile, box, cyl, floorAt}) {
  const pts=[[1.5825,-4.231],[2.275,-3.031],[11.325,-.942],[19,0]];
  const top=pts.map(([r,h])=>[r*s,el(h)]), under=top.map(([r,h])=>[r,h-.35*s]);
  // The concrete slab terminates against the annular collection pocket, not
  // at the rotation axis which is occupied by the central concrete pier.
  halfProfile(tank,[...top,...under.reverse(),top[0]],M.concrete,'cad38-sloped-slab');
  halfProfile(tank,[[19*s,el(-.35)],[19.35*s,el(-.35)],[19.35*s,el(1.9)],[19*s,el(1.9)],[19*s,el(-.35)]],M.concrete,'cad38-perimeter-wall');
  const annular=[[.90,-4.231],[1.5825,-4.231],[1.5825,-4.581],[.90,-4.581],[.90,-4.231]];
  halfProfile(tank,annular.map(([r,h])=>[r*s,el(h)]),M.concrete,'cad38-annular-sump');
  const pier=cyl(tank,.90*s,el(1.50),[0,el(1.50)*.5,0],M.concrete,48);pier.name='cad38-central-pier';
  for (const [radius,count,side] of [[4.2,9,.60],[11.325,18,.65]]) {
    const columns=new THREE.Group();columns.name='cad38-columns-'+count;tank.add(columns);
    const h=floorAt(radius*s)-.35*s;
    for(let n=0;n<count;n++){
      const a=2*Math.PI*n/count,x=Math.cos(a)*radius*s,z=Math.sin(a)*radius*s,cut=z>0.00001;
      const column=box(columns,[side*s,h,side*s],[x,h/2,z],M.concrete,cut);column.rotation.y=-a;
      const foot=box(columns,[side*s*1.8,.08,side*s*1.8],[x,.04,z],M.concrete,cut);foot.rotation.y=-a;
    }
  }
  // Exterior undercroft elevations have doors/windows. Model openings as
  // actual voids. Their positions here illustrate the elevation, not a
  // construction layout. Foreground panels come off with the basin section.
  const rad=19.17*s,baseY=el(-.35),step=2*Math.PI/32;
  for(let i=0;i<32;i++){
    const a=(i+.5)*step,cut=Math.sin(a)>0,door=i===5||i===21;
    for (const [y,h,w,t] of [[baseY*.52,baseY*.96,.30*s,0],
      [baseY*.89,baseY*.22,2*rad*Math.tan(step/2),step/2],
      ...(!door?[[baseY*.24,baseY*.48,2*rad*Math.tan(step/2),step/2]]:[])]) {
      const o=box(tank,[w,h,.30*s],[Math.cos(a+t)*rad,y,Math.sin(a+t)*rad],M.concrete,cut);
      o.rotation.y=Math.PI/2-(a+t);
    }
  }
  const walk=[[19.35,1.88],[20.9,1.88],[20.9,1.70],[19.35,1.70],[19.35,1.88]];
  halfProfile(tank,walk.map(([r,h])=>[r*s,el(h)]),M.concrete,'cad38-peripheral-walkway');
}

export function buildCadDrive(drive,{civil,s,el,box,cyl,beam,mesh,ring,M}){
  const rail=M.brass, steel=M.dark;
  if(civil){
    // Radial bridge as seen in the GZN-38 piping general arrangement.
    const deck=el(2.42),inner=.17,outer=19.55*s,span=outer-inner,w=.24,band=.025;
    for(const z of [-w/2,w/2]) {
      for(const y of [deck,deck+.115])box(drive,[span,band,band],[(inner+outer)/2,y,z],steel);
      for(let n=0;n<12;n++){
        const x=inner+span*n/12,xx=x+span/12;
        beam(drive,[x,deck,z],[xx,deck+.115,z],.012,M.edge);
        beam(drive,[x,deck+.115,z],[xx,deck,z],.012,M.edge);
      }
      for(let n=0;n<10;n++){
        const x=inner+span*n/9;beam(drive,[x,deck+.12,z],[x,deck+.30,z],.010,rail);
      }
      beam(drive,[inner,deck+.30,z],[outer,deck+.30,z],.011,rail);
    }
    box(drive,[span,.025,w],[(inner+outer)/2,deck+.116,0],M.steel);
    cyl(drive,.19,.06,[0,deck-.03,0],steel);
    cyl(drive,.15,.13,[0,deck+.058,0],M.edge);
    cyl(drive,.055,.20,[0,deck+.205,0],M.teal);
    return;
  }
  const deck=3.44,length=13.590*s, halfWidth=.785*s;
  for(const sign of [-1,1]){
    // GXF12-05-1 BOM: two long 785x13590 plates and two 350x2430 plates.
    const panel=box(drive,[length, .004*s, halfWidth],[0,deck,sign*halfWidth/2],M.steel);
    panel.name='cad12-walkway-plate-'+sign;
    const extra=box(drive,[2.430*s,.004*s,.350*s],[0,deck,sign*(halfWidth+.175*s)],M.steel);
    extra.name='cad12-walkway-wing-'+sign;
    box(drive,[length,.095,.055],[0,deck-.052,sign*(halfWidth-.035)],steel);
    for(let k=0;k<10;k++){
      const x=-length/2+k*length/9,z=sign*halfWidth;
      beam(drive,[x,deck,z],[x,deck+.49,z],.016,rail);
    }
    for(const y of [.25,.49])beam(drive,[-length/2,deck+y,sign*halfWidth],[length/2,deck+y,sign*halfWidth],.016,rail);
  }
  // Stamped chevrons on a patterned plate, not a grating specification.
  for(let k=-29;k<=29;k++)for(const sign of [-1,1]){
    const o=box(drive,[.092,.004,.014],[k*.115,deck+.006,sign*halfWidth*.6],M.edge);
    o.rotation.y=sign*.58;
  }
  // Centre worm wheel and perpendicular worm housing, with an offset horizontal
  // motor on the worm axis (mechanical sheet 123301-01B).
  const y=deck+.18, z=.685*s;
  cyl(drive,.73*s,.20,[0,y,0],M.teal,64);
  cyl(drive,.735*s,.045,[0,y+.109,0],M.edge,64);
  cyl(drive,.59*s,.042,[0,y+.149,0],M.teal,64);
  ring(drive,.20*s,.012,[0,y+.178,0],M.brass);
  for(let i=0;i<24;i++){const a=(i+.5)*Math.PI/12;cyl(drive,.014,.027,[Math.sin(a)*.70*s,y+.15,Math.cos(a)*.70*s],M.steel,6);}
  function axial(r,h,x,yy,zz,mat){const o=cyl(drive,r,h,[x,yy,zz],mat);o.rotation.z=Math.PI/2;return o;}
  axial(.119,.68,0,y+.007,z,M.teal);
  for(const x of [-.35,.35])axial(.14,.046,x,y+.007,z,M.edge);
  axial(.072,.22,.45,y+.007,z,M.brass);
  axial(.159,.43,.75,y+.007,z,M.teal);
  for(let i=0;i<7;i++)axial(.168,.018,.58+i*.051,y+.007,z,M.edge);
  box(drive,[.33,.048,.22],[.75,deck+.022,z],steel);
  // Visible pointer sector from the 306-1-3P overload indicator detail.
  const dial=new THREE.Group();dial.name='cad12-overload-indicator';dial.position.set(-.37,y+.10,z+.12);drive.add(dial);
  const backing=new THREE.Shape();backing.moveTo(0,0);backing.absarc(0,0,.098,Math.PI*.13,Math.PI*.88,false);backing.closePath();
  mesh(dial,new THREE.ShapeGeometry(backing),M.steel);
  beam(dial,[0,.006,.004],[.020,.076,.004],.005,M.dark);
  for(let i=0;i<7;i++){
    const a=(.18+.10*i)*Math.PI;
    beam(dial,[.081*Math.cos(a),.081*Math.sin(a),.003],[.094*Math.cos(a),.094*Math.sin(a),.003],.0025,M.dark);
  }
}
