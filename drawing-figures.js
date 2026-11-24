// Draw selected dimensions, not a facsimile of the engineering sheets.
export function drawingFigure(key){
  const axis=(x1,y1,x2,y2)=>`<path class="axis" d="M${x1} ${y1} L${x2} ${y2}"/>`;
  const dimension=(x1,x2,y,label)=>`<path class="measure" d="M${x1} ${y-4}v8m0 -4H${x2}m0 -4v8"/><text x="${(x1+x2)/2}" y="${y-6}" text-anchor="middle">${label}</text>`;
  let art='',caption='';
  if(key==='flotation'){
    caption='槽体正视、端视轮廓 · 尺寸 mm';
    art=dimension(47,155,32,'2 180')+dimension(230,342,32,'2 250')+
      '<path class="section" d="M47 46h108v94H47z M230 46h112v38a56 56 0 0 1 -112 0z"/>'+
      axis(101,41,101,148)+axis(286,41,286,148)+
      '<path class="measure" d="M164 46h15m-7 0v94m-8 0h15"/><text x="181" y="96">1 900</text>';
  }else if(key==='thickener38'){
    caption='池底径向半剖 · 半径和标高按相同比例绘制（m）';
    const scale=14, x=r=>49+r*scale, y=e=>73-e*scale;
    const floor=[[.9,-4.231],[1.5825,-4.231],[2.275,-3.031],[11.325,-.942],[19,0]];
    const section=[[0,1.5],[.9,1.5],...floor,[19,1.9],[19.35,1.9],[19.35,-.35],...floor.slice().reverse().map(([r,h])=>[r,h-.35]),[0,-4.581]];
    art=dimension(x(0),x(19),29,'半径 19.000')+
      `<path class="section" d="M${section.map(([r,h])=>x(r)+' '+y(h)).join('L')}Z"/>`+
      axis(x(0),34,x(0),144)+
      '<text x="59" y="157">集泥环槽</text><text x="194" y="113">坡度转折</text><text x="306" y="98">池壁</text>';
  }else{
    caption='走台花纹板 · 单件平面轮廓，厚 4 mm';
    art=dimension(42,344,43,'13 590 mm')+
      '<path class="section" d="M42 59h302v17.45H42z"/><text x="42" y="97">长板 · 宽 785 mm</text>'+
      '<path class="section" d="M42 124h54v7.78H42z"/><text x="112" y="133">短板 · 2 430 × 350 mm</text>';
  }
  return `<figure class="drawing-sheet"><svg viewBox="0 0 380 168" role="img" aria-label="${caption}">${art}</svg><figcaption>${caption}</figcaption></figure>`;
}
