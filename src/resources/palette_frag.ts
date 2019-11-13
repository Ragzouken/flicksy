export default 
`varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform sampler2D uPalette;
uniform float uAlpha;

void main(void)
{
    float index = texture2D(uSampler, vTextureCoord).r;
    gl_FragColor = texture2D(uPalette, vec2(index, .5)) * uAlpha;
}`;
