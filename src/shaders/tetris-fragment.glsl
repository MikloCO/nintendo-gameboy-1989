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
vec3 _0x0=vec3(.443,.443,.035);
vec3 _0x1=vec3(.180,.298,.251);
vec3 _0x2=vec3(.341,.325,.020);
vec3 _0x3=vec3(.286,.404,.263);

// Brick texture for side borders
vec3 bricktexture(vec2 uv){
    float brickWidth=.034;
    float brickHeight=.025;
    float mortar=.0028;
    
    float row=floor(uv.y/brickHeight);
    float offset=mod(row,2.)*(brickWidth*.5);
    float x=mod(uv.x+offset,brickWidth);
    float y=mod(uv.y,brickHeight);
    
    vec3 brickColor=_0x2;
    vec3 mortarColor=_0x1;
    
    float edge=step(mortar,x)*step(mortar,brickWidth-x)*
    step(mortar,y)*step(mortar,brickHeight-y);
    return mix(mortarColor,brickColor,edge);
}

const int ITermino[16]=int[16](
    0,1,0,0,
    0,1,0,0,
    0,1,1,0,
    0,0,0,0
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
        
        // Check for static blocks directly using the red channel
        bool isStatic = gridVal.r > 0.0;
        int staticShapeId = int(gridVal.g / 36.0) - 1;   // G: shapeId (0-6)
        
        int fx = gx-int(u_offsetX);
        int fy = gy-int(rawFall);
        
        // Simple rotation matching JS
        int rx = fx;
        int ry = fy;
        int rot = int(mod(float(u_rotation) / 90.0, 4.0));

        // Clockwise rotation in GLSL (opposite to JS)
        if(rot == 1) { // 90° clockwise
            rx = fy;
            ry = 3 - fx;
        } else if(rot == 2) { // 180°
            rx = 3 - fx;
            ry = 3 - fy;
        } else if(rot == 3) { // 270° clockwise
            rx = 3 - fy;
            ry = fx;
        }
        int irx = rx;
        int iry = ry;
        
        bool isFalling=false;
        vec3 baseColor;
        
        if(rx>=0 && rx<4 && ry>=0 && ry<4 && 
           getShapeValueById(int(u_shapeId), rx, ry)==1) {
            isFalling = true;
            baseColor = (int(u_shapeId)==0) ? _0x1 : _0x2;
            }
            
            else if(isStatic){
                // Static blocks are always visible with _0x2 color
                baseColor = _0x2;
                }
                
                if(isFalling||isStatic){
                    vec2 cellUv=fract(uv*gridSize);
                    float edge=step(.08,cellUv.x)*step(cellUv.x,.92)*
                    step(.08,cellUv.y)*step(cellUv.y,.92);
                    vec3 borderColor=baseColor*.5;
                    color=mix(borderColor,baseColor,edge);
                }else{
                    color=_0x3;
                }
            }
            
            gl_FragColor=vec4(color,opacity);
        }
        