precision mediump int;
precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;
uniform sampler2D u_texture; // Screen texture
uniform sampler2D u_fontAtlas; // Texture atlas for font
uniform sampler2D u_pleaseAtlas; 
uniform sampler2D u_tryAtlas; 
uniform sampler2D u_againAtlas; 
uniform float u_emission;
varying vec2 vUv;

// Function to check if a point is within the text area
bool isInTextArea(vec2 uv, vec2 textPos, vec2 textSize) {
    return uv.x >= textPos.x && uv.x <= textPos.x + textSize.x &&
           uv.y >= textPos.y && uv.y <= textPos.y + textSize.y;
}


vec3 _0x0=vec3(.22,.24,.09);
vec3 _0x1=vec3(.2314,.2627,.0941);
vec3 _0x2=vec3(.1882,.2627,.149);
vec3 _0x3=vec3(.2941,.3686,.1882);


struct TextAtlasPosition {
    vec2 gameOverPos;
    vec2 pleasePos;
    vec2 tryPos;
    vec2 againPos;
};

struct TextAtlasSize {
    vec2 gameOverSize;
    vec2 pleaseSize;
    vec2 trySize;
    vec2 againSize;
};

void main() {
    // Sample the screen texture
    vec4 screenColor = texture2D(u_texture, vUv);
    
    // Apply tinted background
    vec4 tintedColor = mix(screenColor, vec4(_0x3, 1.0), 1.0);
    
    // Default to background color
    gl_FragColor = tintedColor;
    
    // Define text positions and sizes
    vec2 gameOverPos = vec2(0.2, 0.1);
    vec2 gameOverSize = vec2(0.6, 0.3);
    
    vec2 pleasePos = vec2(0.1, 0.4);
    vec2 pleaseSize = vec2(0.4, 0.15);
    
    vec2 tryPos = vec2(0.18, 0.55);
    vec2 trySize = vec2(0.28, 0.14);
    
    vec2 againPos = vec2(0.3, 0.7);
    vec2 againSize = vec2(0.35, 0.15);


    // GAME OVER text
    if (isInTextArea(vUv, gameOverPos, gameOverSize)) {
        vec2 atlasUV = (vUv - gameOverPos) / gameOverSize;
        atlasUV.y = 1.0 - atlasUV.y; // Flip Y coordinate
        
        vec4 textColor = texture2D(u_fontAtlas, atlasUV);
        if (textColor.r > 0.5) {
            gl_FragColor = vec4(_0x0, 1.0); // Solid green text
        }
    }
    
    // PLEASE text
    if (isInTextArea(vUv, pleasePos, pleaseSize)) {
        vec2 pleaseUV = (vUv - pleasePos) / pleaseSize;
        pleaseUV.y = 1.0 - pleaseUV.y; // Flip Y coordinate
        
        vec4 pleaseColor = texture2D(u_pleaseAtlas, pleaseUV);
        if (pleaseColor.r > 0.5) {
            gl_FragColor = vec4(_0x0, 1.0); // Solid green text
        }
    }
    
    // TRY text
    if (isInTextArea(vUv, tryPos, trySize)) {
        vec2 tryUV = (vUv - tryPos) / trySize;
        tryUV.y = 1.0 - tryUV.y; // Flip Y coordinate
        
        vec4 tryColor = texture2D(u_tryAtlas, tryUV);
        if (tryColor.r > 0.5) {
            gl_FragColor = vec4(_0x0, 1.0); // Solid green text
        }
    }
    
    // AGAIN text
    if (isInTextArea(vUv, againPos, againSize)) {
        vec2 againUV = (vUv - againPos) / againSize;
        againUV.y = 1.0 - againUV.y; // Flip Y coordinate
        
        vec4 againColor = texture2D(u_againAtlas, againUV);
        if (againColor.r > 0.5) {
            gl_FragColor = vec4(_0x0, 1.0); // Solid green text
        }
    }

    // Define the position and size of the heart
    vec2 heartPos = againPos + vec2(againSize.x * 1.1, againSize.y * 0.3); // Position next to "AGAIN"
    vec2 heartSize = vec2(againSize.x * 0.4, againSize.y * 0.8); // Size relative to "AGAIN"
    
    // Create a pixelated grid effect
    float pixelSize = 0.015; // Size of each pixel
    vec2 pixelPos = floor((vUv - heartPos) / pixelSize) * pixelSize + heartPos;
    
    // Remap to centered coordinates
    vec2 p = (pixelPos - heartPos - heartSize * 0.32) / (heartSize * 0.5); // Center in area
    p.y = -p.y; // Flip Y for correct orientation
    p.x *= 1.2; // Adjust aspect ratio slightly
    
    // Compute implicit heart function
    float h = p.x*p.x + p.y*p.y - 1.0;
    float f = h*h*h - p.x*p.x * p.y*p.y*p.y;
    
    // For pixelated look, use a sharp cutoff instead of smoothstep
    if (f < 0.0) {
        gl_FragColor = vec4(_0x0, 1.0); // Green heart to match the game's color scheme
        return;
    }
}