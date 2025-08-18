precision mediump float;
precision mediump int;

uniform float opacity;
uniform float u_time;
uniform float u_timeStart;
uniform float u_offsetX;
uniform int u_shapeId;
uniform sampler2D u_gridTexture;
uniform int u_rotation;

varying vec2 vUv;

vec3 _0x0=vec3(.22,.24,.09);// darkest (text, borders)
vec3 _0x1=vec3(0.2314, 0.2627, 0.0941);// medium (grid, shadow)
vec3 _0x2=vec3(0.1882, 0.2627, 0.149);// light (block fill, panels)
vec3 _0x3=vec3(0.2941, 0.3686, 0.1882);

// Brick texture for side borders
vec3 bricktexture(vec2 uv){
    float brickWidth=.034;
    float brickHeight=.025;
    float mortar=.0028;
    
    float row=floor(uv.y/brickHeight);
    float offset=mod(row,2.)*(brickWidth*.5);
    float x=mod(uv.x+offset,brickWidth);
    float y=mod(uv.y,brickHeight);
    
    vec3 brickColor=_0x3;
    vec3 mortarColor=_0x1;
    
    float edge=step(mortar,x)*step(mortar,brickWidth-x)*
    step(mortar,y)*step(mortar,brickHeight-y);
    return mix(mortarColor,brickColor,edge);
}

const int ITermino[16]=int[16](
    0,1,0,0,
    0,1,0,0,
    0,1,0,0,
    0,1,0,0
);
const int OTermino[16]=int[16](
    0,0,0,0,
    0,1,1,0,
    0,1,1,0,
    0,0,0,0
);
const int TTermino[16]=int[16](
    0,0,1,0,
    0,1,1,0,
    0,0,1,0,
    0,0,0,0
);
const int LTermino[16]=int[16](
    0,0,0,0,
    0,1,0,0,
    0,1,0,0,
    0,1,1,0
);
const int JTermino[16]=int[16](
    0,0,0,0,
    0,0,1,0,
    0,0,1,0,
    0,1,1,0
);
const int STermino[16]=int[16](
    0,0,0,0,
    0,0,1,1,
    0,1,1,0,
    0,0,0,0
);
const int ZTermino[16]=int[16](
    0,0,0,0,
    0,1,1,0,
    0,0,1,1,
    0,0,0,0
);

int getShapeValueById(int shapeId,int x,int y){
    int i=y*4+x;
    if(shapeId==0)return ITermino[i];
    if(shapeId==1)return OTermino[i];
    if(shapeId==2)return TTermino[i];
    if(shapeId==3)return LTermino[i];
    if(shapeId==4)return JTermino[i];
    if(shapeId==5)return STermino[i];
    if(shapeId==6)return ZTermino[i];
    return 0;
}

void main(void){
    vec2 uv=vUv;
    vec3 color;
    
    float gridSize=14.;
    float blockHeight=4.;
    float fall_speed=1.;
    float max_fall=10.;
    float t=u_time-u_timeStart;
    float rawFall=floor(min(t*fall_speed,max_fall));
    
    float border_width=.08;
    
    if(uv.x<border_width||uv.x>(1.-border_width)){
        color=bricktexture(uv);
    }else{
        vec2 gridUv = floor(uv*gridSize);
        vec2 texCoord = (gridUv+.5)/gridSize;
        vec4 gridVal = texture2D(u_gridTexture,texCoord);
        
        int gx = int(gridUv.x);
        int gy = int(gridUv.y);
        
        bool isStatic = gridVal.r > 0.0;
        int staticShapeId = int(gridVal.g / 36.0) - 1;
        
        int fx = gx-int(u_offsetX);
        int fy = gy-int(rawFall);
        
        int rx = fx;
        int ry = fy;
        int rot = int(mod(float(u_rotation) / 90.0, 4.0));

        if(rot == 1) {
            rx = fy;
            ry = 3 - fx;
        } else if(rot == 2) {
            rx = 3 - fx;
            ry = 3 - fy;
        } else if(rot == 3) {
            rx = 3 - fy;
            ry = fx;
        }
        
        bool isBlock = false;
        int shapeId;

        // Check if the pixel is part of the currently falling block
        if(rx>=0 && rx<4 && ry>=0 && ry<4 && getShapeValueById(int(u_shapeId), rx, ry)==1) {
            isBlock = true;
            shapeId = int(u_shapeId);
        } 
        // Otherwise, check if it's part of a static block on the grid
        else if(isStatic) {
            isBlock = true;
            shapeId = staticShapeId;
        }

        if(isBlock){
            vec3 baseColor = _0x0; // The dark outline color
            vec3 innerColor = _0x2; // The light fill color for the pattern
            vec2 cellUv = fract(uv*gridSize);

            // if(shapeId == 0) {

                // 1. Draw the base block with its outer border
                float edge=step(.08,cellUv.x)*step(cellUv.x,.92)*
                        step(.08,cellUv.y)*step(cellUv.y,.92);
                vec3 borderColor=baseColor*.5;
                color=mix(borderColor,baseColor,edge);

                // 2. Draw the "block-in-block" pattern on top for ALL shapes
                // This now works for both falling and static blocks.
                
                float outer = step(0.18,cellUv.x)*step(cellUv.x,0.82)*
                            step(0.18,cellUv.y)*step(cellUv.y,0.82);
                color = mix(color, borderColor, outer);

                float inner = step(0.32,cellUv.x)*step(cellUv.x,0.68)*
                            step(0.32,cellUv.y)*step(cellUv.y,0.68);
                // FIX: Use the light innerColor, not the dark borderColor
                color = mix(color, innerColor, inner);
            // }

        }else{
            color=_0x3;
        }
    }
    
    gl_FragColor=vec4(color,opacity);
}
