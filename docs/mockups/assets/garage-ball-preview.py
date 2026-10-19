# First run: node docs/mockups/assets/export-ball-textures.mjs
# Then: Blender -b -t 8 -P docs/mockups/assets/garage-ball-preview.py
import json
import os
import sys
import tempfile

import bpy
from mathutils import Vector

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from models import reset

TEXTURES = os.path.join(tempfile.gettempdir(), "taype-garage-ball-textures")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "arena-preview")
with open(os.path.join(TEXTURES, "balls.json")) as manifest:
    finishes = json.load(manifest)

for finish in finishes:
    reset()
    # Project the original garage design onto a smooth sphere from the same camera.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=64, radius=0.9)
    sphere = bpy.context.object
    for face in sphere.data.polygons:
        face.use_smooth = True
    direction = Vector((115, -140, 128)).normalized()
    right = Vector((-direction.y, direction.x, 0)).normalized()
    up = direction.cross(right)
    uv = sphere.data.uv_layers.active
    for loop in sphere.data.loops:
        point = sphere.data.vertices[loop.vertex_index].co
        uv.data[loop.index].uv = (point.dot(right) / 1.8 + 0.5, point.dot(up) / 1.8 + 0.5)
    material = bpy.data.materials.new(f"Garage-{finish}")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    surface = nodes["Principled BSDF"]
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = bpy.data.images.load(os.path.join(TEXTURES, f"{finish}.png"))
    material.node_tree.links.new(texture.outputs["Color"], surface.inputs["Base Color"])
    surface.inputs["Roughness"].default_value = 0.34 if finish == "gold" else 0.48
    surface.inputs["Metallic"].default_value = 0.4 if finish == "gold" else 0.08
    sphere.data.materials.append(material)

    # Broad studio lights retain the garage's colors and panel details at game size.
    for location, energy, size in [((-3, -4, 6), 350, 5), ((4, -2, 3), 180, 4)]:
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.rotation_euler = (-light.location).to_track_quat("-Z", "Y").to_euler()
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
    bpy.ops.object.camera_add(location=(115, -140, 128))
    camera = bpy.context.object
    camera.rotation_euler = (-camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 2.4
    scene = bpy.context.scene
    scene.camera = camera
    scene.render.resolution_x = 256
    scene.render.resolution_y = 256
    scene.render.filepath = os.path.join(OUT, f"field-ball-{finish}.png")
    bpy.ops.render.render(write_still=True)
