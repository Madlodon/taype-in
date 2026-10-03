"""Arena study: real geometry, two cameras, no runtime dependency.

Run from any directory:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P arena-model.py
"""

import math
from pathlib import Path

import bpy
from mathutils import Vector

OUT = Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.resolution_x = 1400
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new("Night sky")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs[0].default_value = (.065, .095, .16, 1)
scene.world.node_tree.nodes["Background"].inputs[1].default_value = .5
scene.view_settings.view_transform = "AgX"


def material(name, color, emission=0, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = .55
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Emission Color"].default_value = (*color, 1)
    bsdf.inputs["Emission Strength"].default_value = emission
    return mat


steel = material("Midnight steel", (.035, .055, .085), metallic=.6)
concrete = material("Stadium concrete", (.105, .14, .18))
rubber = material("Rubber", (.012, .019, .028))
glass = material("Dark reflective glass", (.025, .09, .14), metallic=.6)
white = material("Pitch paint", (.72, .83, .77))
blue = material("Blue team", (.018, .22, .7), metallic=.25)
orange = material("Orange team", (.9, .22, .018), metallic=.25)
blue_light = material("Blue LED", (.015, .36, 1), emission=4)
orange_light = material("Orange LED", (1, .22, .018), emission=4)
lamp = material("Floodlight", (.65, .84, 1), emission=5)
net = material("Steel net", (.2, .3, .37), metallic=.5)
gold = material("Boost energy", (1, .47, .03), emission=3)
turf = material("Mown turf", (.035, .22, .095))
nodes = turf.node_tree.nodes
links = turf.node_tree.links
noise = nodes.new("ShaderNodeTexNoise")
noise.inputs["Scale"].default_value = 350
noise.inputs["Detail"].default_value = 2
wave = nodes.new("ShaderNodeTexWave")
wave.bands_direction = "X"
wave.wave_profile = "SAW"
wave.inputs["Scale"].default_value = 2.2
ramp = nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.interpolation = "CONSTANT"
ramp.color_ramp.elements[0].color = (.032, .135, .062, 1)
ramp.color_ramp.elements[1].position = .5
ramp.color_ramp.elements[1].color = (.057, .205, .095, 1)
links.new(wave.outputs["Color"], ramp.inputs[0])
links.new(ramp.outputs[0], nodes["Principled BSDF"].inputs["Base Color"])
bump = nodes.new("ShaderNodeBump")
bump.inputs["Strength"].default_value = .18
bump.inputs["Distance"].default_value = .09
links.new(noise.outputs["Fac"], bump.inputs["Height"])
links.new(bump.outputs[0], nodes["Principled BSDF"].inputs["Normal"])


def mesh(name, vertices, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.materials.append(mat)
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    return obj


def box(name, size, location, mat, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("Soft edges", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return obj


def curves(name, paths, radius, mat):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.bevel_depth = radius
    data.bevel_resolution = 2
    for points in paths:
        spline = data.splines.new("POLY")
        spline.points.add(len(points) - 1)
        for p, xyz in zip(spline.points, points):
            p.co = (*xyz, 1)
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    data.materials.append(mat)
    return obj


def ring(extra=0, z=0):
    points = []
    for cx, cy, start in ((41, 23, 0), (-41, 23, 90), (-41, -23, 180), (41, -23, 270)):
        for i in range(25):
            a = math.radians(start + i * 90 / 24)
            points.append((cx + (12 + extra) * math.cos(a), cy + (12 + extra) * math.sin(a), z))
    return points


def band(name, inner, outer, mat, front=True, goals=False):
    vertices = inner + outer
    count = len(inner)
    faces = []
    for i in range(count):
        j = (i + 1) % count
        mid = [(inner[i][k] + inner[j][k]) / 2 for k in range(3)]
        if not front and mid[1] < -20:
            continue
        if goals and abs(mid[0]) > 50 and abs(mid[1]) < 11:
            continue
        faces.append((i, j, count + j, count + i))
    return mesh(name, vertices, faces, mat)


outline = ring()
mesh("Playing field", outline, [tuple(range(len(outline)))], turf)
band("Floating stadium plinth", ring(22, -3), ring(22, -1), steel)
mesh("Foundation", ring(22, -1), [tuple(range(100))], steel)

# A quarter-pipe joins the grass to the side wall, including the curved corners.
for step in range(12):
    a, b = step * math.pi / 24, (step + 1) * math.pi / 24
    band("Curved wall ramp", ring(4 * math.sin(a), 4 * (1 - math.cos(a))),
         ring(4 * math.sin(b), 4 * (1 - math.cos(b))), concrete, goals=True)

for team, sign in ((blue_light, -1), (orange_light, 1)):
    rim = ring(4, 4.15)
    paths = [[rim[i], rim[(i + 1) % 100]] for i in range(100)
             if (rim[i][0] + rim[(i + 1) % 100][0]) * sign >= 0
             and not (abs(rim[i][0]) > 52 and abs(rim[i][1]) < 11)]
    curves("Blue wall rim" if sign < 0 else "Orange wall rim", paths, .13, team)

# Bowl seating is kept open at the front so the cars remain visible in the cutaway.
for tier in range(10):
    extra = 6 + tier * 1.35
    z = 4 + tier * .83
    band("Seating terrace", ring(extra, z), ring(extra + 1.3, z), concrete, front=False)
    band("Terrace riser", ring(extra + 1.3, z), ring(extra + 1.3, z + .8), steel, front=False)
    points = ring(extra + .6, z + .3)
    for i in range(100):
        p, q = Vector(points[i]), Vector(points[(i + 1) % 100])
        if (p.y + q.y) / 2 < -20:
            continue
        length = (q - p).length
        for j in range(max(1, int(length / 1.4))):
            at = p.lerp(q, (j + .5) / max(1, int(length / 1.4)))
            seat = box("Seat", (.75, .7, .32), at, blue if at.x < 0 else orange)
            seat.rotation_euler.z = math.atan2(q.y - p.y, q.x - p.x)

# Recessed goals: floor, back and roof mesh, chamfered luminous frames.
for sign, accent, paint in ((-1, blue_light, blue), (1, orange_light, orange)):
    x, back = 53 * sign, 62 * sign
    box("Goal floor", (9, 21, .2), ((x + back) / 2, 0, 0), paint)
    frame = [(x, -10, .1), (x, -10, 6.3), (x, -8.3, 8.4), (x, 8.3, 8.4), (x, 10, 6.3), (x, 10, .1)]
    rear = [(back, y, z) for _, y, z in frame]
    curves("Goal frame", [frame, rear] + [[a, b] for a, b in zip(frame, rear)], .22, accent)
    paths = []
    for y in range(-10, 11):
        height = min(8.4, 6.3 + (10 - abs(y)) * 1.24)
        paths.extend([[(back, y, 0), (back, y, height)], [(x, y, height), (back, y, height)]])
    for z in range(1, 9):
        half = min(10, 10 - max(0, z - 6.3) / 1.24)
        paths.append([(back, -half, z), (back, half, z)])
    for xx in range(54, 63):
        paths.append([(xx * sign, -10, 0), (xx * sign, -10, 6.3), (xx * sign, -8.3, 8.4), (xx * sign, 8.3, 8.4), (xx * sign, 10, 6.3), (xx * sign, 10, 0)])
    curves("Goal net", paths, .035, net)

# Regulation-inspired markings and diagonal corner hatching.
curves("Touchline", [ring(-1, .04) + [ring(-1, .04)[0]]], .1, white)
curves("Halfway line", [[(0, -34, .05), (0, 34, .05)]], .12, white)
circle = [(10 * math.cos(t * math.tau / 96), 10 * math.sin(t * math.tau / 96), .06) for t in range(97)]
curves("Center circle", [circle], .14, white)
for sign, paint in ((-1, blue), (1, orange)):
    curves("Goal area", [[(52 * sign, -17, .07), (36 * sign, -17, .07), (33 * sign, -14, .07), (33 * sign, 14, .07), (36 * sign, 17, .07), (52 * sign, 17, .07)]], .24, paint)
    curves("Goal box paint", [[(52 * sign, -13, .08), (44 * sign, -13, .08), (44 * sign, 13, .08), (52 * sign, 13, .08)]], .1, white)
    curves("End zone stripes", [[(sign * (43 + i * 1.1), -25, .07), (sign * (40 + i * 1.1), -30, .07)] for i in range(5)], .22, paint)

for x, y, big in [(-39, -24, True), (-39, 24, True), (39, -24, True), (39, 24, True),
                   (0, -27, True), (0, 27, True)] + [(x, y, False) for x in (-25, 0, 25) for y in (-12, 12)]:
    radius = 1.2 if big else .65
    curves("Boost pad socket", [[(x + radius * math.cos(t * math.tau / 24), y + radius * math.sin(t * math.tau / 24), .1) for t in range(25)]], .13, steel)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=radius * .65, depth=.08, location=(x, y, .12))
    bpy.context.object.data.materials.append(gold)

# A restrained protective cage, with hexagonal cells along the far straight.
hexes = []
for row in range(5):
    for col in range(32):
        x, z = -41 + col * 2.6 + (row % 2) * 1.3, 5.4 + row * 2.25
        hexes.append([(x + 1.5 * math.cos(t * math.pi / 3), 39, z + 1.5 * math.sin(t * math.pi / 3)) for t in range(7)])
curves("Hex safety mesh", hexes, .025, net)
for x in range(-40, 41, 10):
    curves("Back wall support", [[(x, 39, 4), (x, 39, 16)]], .12, steel)
curves("Upper rail", [[(-45, 39, 16), (45, 39, 16)]], .2, steel)

# Floodlights and a long roof truss give the arena its scale.
for x in (-39, -13, 13, 39):
    curves("Lighting mast", [[(x, 49, 8), (x, 49, 25), (x, 39, 27)]], .25, steel)
    box("Light housing", (7, 2, .65), (x, 38, 26.5), steel, .1)
    for j in range(6):
        box("Floodlight panel", (.8, 1.5, .1), (x - 2.7 + j * 1.08, 38, 26.1), lamp)
curves("Roof truss", [[(-55, 44, 25), (55, 44, 25)], [(-55, 44, 27), (55, 44, 27)]] +
       [[(x, 44, 25), (x + 2.5, 44, 27), (x + 5, 44, 25)] for x in range(-55, 55, 5)], .13, steel)


def car(position, heading, paint):
    before = set(bpy.data.objects)
    box("Car body", (4.3, 2.3, .75), (0, 0, .9), paint, .24)
    cabin = box("Car cabin", (2.1, 1.8, .8), (-.25, 0, 1.62), glass, .2)
    for vertex in cabin.data.vertices:
        if vertex.co.z > 0:
            vertex.co.x *= .76
            vertex.co.y *= .83
    box("Roof stripe", (1.5, .45, .08), (-.25, 0, 2.08), white, .03)
    box("Spoiler", (.45, 2.6, .15), (-1.9, 0, 1.7), paint, .05)
    for x in (-1.3, 1.3):
        for y in (-1.18, 1.18):
            bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=.6, depth=.35, location=(x, y, .62), rotation=(math.pi / 2, 0, 0))
            bpy.context.object.data.materials.append(rubber)
    for y in (-.75, .75):
        box("Headlight", (.08, .5, .17), (2.16, y, 1.05), lamp)
    box("Boost exhaust", (.3, .55, .3), (-2.2, 0, .85), gold, .08)
    parent = bpy.data.objects.new("Blue racer" if paint == blue else "Orange racer", None)
    scene.collection.objects.link(parent)
    for obj in set(bpy.data.objects) - before - {parent}:
        obj.parent = parent
    parent.location = position
    parent.rotation_euler.z = heading


car((-17, -12, 0), .28, blue)
car((25, 13, 0), 3.4, orange)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.65, location=(-6, -8, 1.67))
ball = bpy.context.object
ball.name = "Soccer ball"
ball.data.materials.append(white)
ball.data.materials.append(steel)
for face in ball.data.polygons:
    if face.index % 21 < 5:
        face.material_index = 1

for location, power, size, color in [((0, -20, 65), 95000, 65, (.78, .87, 1)),
                                      ((-40, 18, 32), 20000, 25, (.32, .56, 1)),
                                      ((40, 18, 32), 24000, 25, (1, .57, .29))]:
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.data.energy, light.data.shape, light.data.size, light.data.color = power, "DISK", size, color
    light.rotation_euler = (Vector((0, 0, 0)) - light.location).to_track_quat("-Z", "Y").to_euler()

box("Backdrop", (2000, 2000, .2), (0, 0, -3.3), material("Backdrop", (.017, .025, .042)))
bpy.ops.object.camera_add()
camera = bpy.context.object
camera.data.type = "ORTHO"
scene.camera = camera

for name, location, target, scale in [
    ("arena-broadcast", (5, -170, 85), (0, 3, 7), 161),
    ("arena-diorama", (115, -140, 135), (0, 0, 7), 185),
]:
    camera.location = location
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.ortho_scale = scale
    scene.render.filepath = str(OUT / f"{name}.png")
    bpy.ops.render.render(write_still=True)

bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "arena.blend"), compress=True)
