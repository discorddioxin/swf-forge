/**
 * GLSL ES 3.00 sources for the P4 static path — solid colour + projection, one program
 * (`IMPL-130` §5.1). Shader variants for gradients, bitmap fills, filters and blend modes land with
 * their work packages; keeping the P4 set to one program is what makes the draw-call counter in the
 * budget gates meaningful (each run is exactly two passes: stencil, cover).
 */

export const VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 a_position;
uniform vec4 u_projection; // (sx, sy, tx, ty): device px → clip space
void main() {
  gl_Position = vec4(a_position * u_projection.xy + u_projection.zw, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = `#version 300 es
precision mediump float;
uniform vec4 u_colour;
out vec4 fragColour;
void main() {
  fragColour = u_colour;
}
`;
