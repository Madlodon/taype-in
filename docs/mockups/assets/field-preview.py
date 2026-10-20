# Render every garage body/team/stadium combination with 32 headings.
# Blender -b -t 8 -P docs/mockups/assets/field-preview.py
import argparse
import math
import os
import sys
import tempfile
from array import array

import bpy

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from models import reset, car, BLUE, ORANGE

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../public/sprites/cars"))
os.makedirs(OUT, exist_ok=True)
SIZE = 128
COLUMNS = 8
ROWS = 4

CAMERAS = {"diorama": (115, -140, 128), "cutaway": (5, -173, 78), "top-down": (0, 0, 100)}
parser = argparse.ArgumentParser()
parser.add_argument("--stadium", choices=CAMERAS)
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
for stadium, camera_location in CAMERAS.items():
    if args.stadium and stadium != args.stadium:
        continue
    for shape in ("octane", "fennec", "dominus", "merc"):
        for name, color in (("blue", BLUE), ("orange", ORANGE)):
            reset()
            car(color, shape)
            objects = list(bpy.context.scene.objects)
            originals = [(obj, obj.location.copy()) for obj in objects]
            for obj in objects:
                obj.scale *= 2
            bpy.ops.object.light_add(type="SUN", rotation=(math.radians(50), math.radians(10), math.radians(-30)))
            bpy.context.object.data.energy = 2.5
            bpy.ops.object.camera_add(location=camera_location)
            camera = bpy.context.object
            camera.rotation_euler = (0, 0, 0) if stadium == "top-down" else (-camera.location).to_track_quat("-Z", "Y").to_euler()
            camera.data.type = "ORTHO"
            camera.data.ortho_scale = 12
            scene = bpy.context.scene
            scene.camera = camera
            scene.render.resolution_x = SIZE
            scene.render.resolution_y = SIZE
            atlas = array('f', [0]) * (SIZE * COLUMNS * SIZE * ROWS * 4)
            with tempfile.TemporaryDirectory(prefix="taype-sprites-") as temp:
                for frame in range(COLUMNS * ROWS):
                    angle = frame * math.tau / (COLUMNS * ROWS)
                    for obj, location in originals:
                        obj.location = (2 * (location.x * math.cos(angle) - location.y * math.sin(angle)),
                                        2 * (location.x * math.sin(angle) + location.y * math.cos(angle)), 2 * location.z)
                        # Wheels already have their axle rotated around X.
                        obj.rotation_euler.z = angle
                    scene.render.filepath = os.path.join(temp, f"{frame}.png")
                    bpy.ops.render.render(write_still=True)
                    image = bpy.data.images.load(scene.render.filepath)
                    pixels = array('f', [0]) * (SIZE * SIZE * 4)
                    image.pixels.foreach_get(pixels)
                    for row in range(SIZE):
                        start = (((ROWS - 1 - frame // COLUMNS) * SIZE + row) * SIZE * COLUMNS + frame % COLUMNS * SIZE) * 4
                        atlas[start:start + SIZE * 4] = pixels[row * SIZE * 4:(row + 1) * SIZE * 4]
                    bpy.data.images.remove(image)
            sheet = bpy.data.images.new(f"field-{name}", width=SIZE * COLUMNS, height=SIZE * ROWS, alpha=True)
            sheet.pixels.foreach_set(atlas)
            os.makedirs(os.path.join(OUT, stadium), exist_ok=True)
            sheet.filepath_raw = os.path.join(OUT, stadium, f"{shape}-{name}.png")
            sheet.file_format = "PNG"
            sheet.save()
