
External values sent by the CPU/host .js script determines these vars:

- u_time 
- u_timeStart
- u_shapeId (which shape is falling 0 = L, 1 = Cube etc.)
- u_rotation (determines how block is rotated)
- u_offsetX (used for input control for vertical movement)
- u_gridTexture (Stores blocks as static on board - memory managment)

The original gamecube was constructed with a 2-bit display. Meaning each
pixel could be 1 of 4 colors. 
- 0x0 (Lightest green)
- 0x1 (Light green)
- 0x2 (Dark green)
- 0x3 (Darkest green)

The brick texture:
- Divides space into repeating rectangles
- Adds slight horizontal offset every other row


Shapes are defined as

<pre>
. . . .
. █ █ .
. █ █ .
. . . .
</pre>

The board / grid size is 14x14 blocks.


First we draw the two lanes on each side (the two brick walls), then we 
create the allowed movable area for the blocks to move vertically.

Each cell is encoded in a texture. We are using red and green channels as a hack.

A texture is a 2d Grid of RGBA pixels. Each pixel encodes data for one cell on the tetris board.

Red (R) -> Current block type (L-shape)
Green (G) -> Current block rotation

Texture returns colors as normaliszed float values as 0. - 1., for readability we want to store integers.