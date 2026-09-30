# Modèles low-poly de la maquette 2.5D : une voiture (bleue et orange) et un ballon.
# Rendu en sprites PNG transparents, vus de 3/4 en caméra orthographique.
#
# Lancer depuis la racine du dépôt :
#   /Applications/Blender.app/Contents/MacOS/Blender -b -P docs/mockups/assets/models.py

import math
import os

import bpy
from mathutils import Vector

OUT = os.path.join(os.getcwd(), "docs", "mockups", "assets")
BLUE = (0.010, 0.114, 0.63)  # #1a5fd0 en couleur linéaire
ORANGE = (0.91, 0.20, 0.0)  # #f57c00 en couleur linéaire


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0  # pas de copies .blend1
    scene = bpy.context.scene
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    scene.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in engines else "BLENDER_EEVEE_NEXT"
    scene.render.film_transparent = True
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.view_settings.view_transform = "Standard"
    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.55, 0.6, 0.7, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8
    scene.world = world


def material(name, color, emission=0.0, roughness=0.5, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*color, 1)
        bsdf.inputs["Emission Strength"].default_value = emission
    return mat


def box(name, size, location, mat, taper=None):
    """Boîte ; taper rétrécit le dessus (x, y) pour faire un habitacle."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if taper:
        top = max(v.co.z for v in obj.data.vertices)
        for v in obj.data.vertices:
            if v.co.z == top:
                v.co.x *= taper[0]
                v.co.y *= taper[1]
                v.co.x += size[0] * 0.08
    obj.data.materials.append(mat)
    return obj


def wheel(location, mat, rim):
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.36, depth=0.28, location=location, rotation=(math.pi / 2, 0, 0))
    tire = bpy.context.object
    tire.data.materials.append(mat)
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.18, depth=0.30, location=location, rotation=(math.pi / 2, 0, 0))
    bpy.context.object.data.materials.append(rim)


def car(color):
    body = material("Body", color, roughness=0.35, metallic=0.3)
    dark = material("Tire", (0.04, 0.05, 0.08), roughness=0.9)
    glass = material("Glass", (0.05, 0.1, 0.2), roughness=0.1)
    rim = material("Rim", (0.8, 0.82, 0.86), metallic=0.8, roughness=0.3)
    boost = material("Boost", ORANGE, emission=6)

    box("Chassis", (2.4, 1.2, 0.45), (0, 0, 0.5), body)
    box("Nose", (0.6, 1.1, 0.25), (1.35, 0, 0.42), body)
    box("Cabin", (1.2, 1.0, 0.45), (-0.2, 0, 0.95), glass, taper=(0.7, 0.85))
    box("Spoiler", (0.25, 1.3, 0.08), (-1.15, 0, 1.2), body)
    box("SpoilerLeg", (0.1, 0.6, 0.35), (-1.1, 0, 0.9), dark)
    box("Nozzle", (0.15, 0.35, 0.2), (-1.25, 0, 0.55), boost)
    for x in (0.8, -0.8):
        for y in (0.62, -0.62):
            wheel((x, y, 0.36), dark, rim)


def ball():
    light = material("Panel", (0.85, 0.87, 0.92), roughness=0.4)
    dark = material("PanelDark", (0.06, 0.07, 0.1), roughness=0.4)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1)
    corners = [v.co.normalized() for v in bpy.context.object.data.vertices]
    bpy.ops.object.delete()

    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=0.9, location=(0, 0, 0.6))
    obj = bpy.context.object
    obj.data.materials.append(light)
    obj.data.materials.append(dark)
    # Les 5 faces qui touchent chaque coin de l'icosaèdre forment un pentagone foncé, comme un ballon.
    for poly in obj.data.polygons:
        for i in poly.vertices:
            direction = obj.data.vertices[i].co.normalized()
            if max(direction.dot(c) for c in corners) > 0.999:
                poly.material_index = 1


def light_and_camera(distance):
    bpy.ops.object.light_add(type="SUN", rotation=(math.radians(50), math.radians(10), math.radians(-30)))
    bpy.context.object.data.energy = 2.5
    angle = math.radians(35)
    location = Vector((distance * 0.55, -distance * math.cos(angle), distance * math.sin(angle) + 0.6))
    bpy.ops.object.camera_add(location=location)
    cam = bpy.context.object
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 4.2
    cam.rotation_euler = (Vector((0, 0, 0.6)) - location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam


def render(name):
    bpy.context.scene.render.filepath = os.path.join(OUT, f"{name}.png")
    bpy.ops.render.render(write_still=True)


for name, color in (("car-blue", BLUE), ("car-orange", ORANGE)):
    reset()
    car(color)
    light_and_camera(8)
    render(name)
    if name == "car-blue":
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "car.blend"))

reset()
ball()
light_and_camera(8)
bpy.context.scene.camera.data.ortho_scale = 2.4
render("ball")
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "ball.blend"))
