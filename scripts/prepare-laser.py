"""Build the TACK Laser and its PFD in Blender, using the game's hull in metres.

blender -b -t 2 --python scripts/prepare-laser.py -- /tmp/tack-laser.blend
The .blend path is optional. Export also writes the embedded GLB used by TACK.
"""
import base64
import json
import math
from pathlib import Path
import subprocess
import sys
import tempfile

import bpy

ROOT = Path(__file__).resolve().parents[1]
profile_json = subprocess.check_output(
    ["node", "-e", "const scope={};require('./assets/simulation/boats.js')(scope);"
     "console.log(JSON.stringify(scope.SailingBoats.get('laser')))"], cwd=ROOT
)
boat = json.loads(profile_json)
stations = boat["hullSections"]
deck_y = boat["deckY"]
cockpit = boat["cockpit"]
aft = cockpit["x0"] - .20
fore = cockpit["x1"] + .07
floor_y = cockpit["floorY"]
centre = (aft + fore) * .5
crew_x = boat["crewX"]

bpy.ops.wm.read_factory_settings(use_empty=True)


def finish(name, hex_color, roughness, metallic=0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    srgb = [int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    rgb = [value / 12.92 if value < .04045 else ((value + .055) / 1.055) ** 2.4 for value in srgb]
    shader.inputs["Base Color"].default_value = (*rgb, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    material.diffuse_color = (*rgb, 1)
    return material


ivory = finish("Ivory gelcoat", "eeeee4", .31)
blue = finish("Atlantic blue", "075f96", .32)
line = finish("Pale pinstripe", "acc9d1", .36)
deck = finish("Moulded deck", "e2e9e5", .57)
grip = finish("Deck grip", "aabcb8", .91)
floor = finish("Cockpit sole", "bdcdcc", .78)
strap = finish("Webbing", "9c4e3c", .96)
rubber = finish("Fittings", "29393c", .74)
alloy = finish("Anodised fittings", "a8b8b7", .42, .55)
webbing = finish("Vest edging", "233944", .88)
vest_shell = finish("Vest shell", "a94123", .89)
vest_foam = finish("Vest foam", "ea782d", .87)
zipper = finish("Zip and binding", "273239", .81)
patch = finish("Reflective tabs", "c9d9d3", .54)


def mesh(name, vertices, faces, materials, surface=None, smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata([(x, -z, y) for x, y, z in vertices], [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    for material in materials:
        data.materials.append(material)
    for face in data.polygons:
        face.use_smooth = smooth
        if surface:
            face.material_index = surface[face.index]
    uv = data.uv_layers.new()
    for face in data.polygons:
        for corner in face.loop_indices:
            x, y, z = vertices[data.loops[corner].vertex_index]
            uv.data[corner].uv = (x * 1.1, (z + .22 * y) * 1.1)
    return obj


def strip(faces, offset, width, closed=False, invert=False):
    for col in range(width if closed else width - 1):
        next_col = (col + 1) % width
        face = (offset + col, offset + next_col, offset + next_col + width, offset + col + width)
        faces.append(face[::-1] if invert else face)


def width_at(x):
    for (x0, w0), (x1, w1) in zip(stations, stations[1:]):
        if x <= x1:
            return w0 + (w1 - w0) * (x - x0) / (x1 - x0)
    return stations[-1][1]


def bottom(x, w, across):
    u = x / (boat["length"] * .52)
    depth = (boat["hullDepth"] - boat["rocker"] * u * u) * (.58 + .42 * min(1, w / (boat["beam"] * .25)))
    return deck_y - depth * (1 - abs(across) ** boat["chinePower"])


def build_shell():
    # Dense at the sheer and along the chines. The stations sampled by buoyancy
    # also define this shell, so the waterline never intersects two hull shapes.
    fractions = [0, .23, .43, .56, .66, .74, .80, .85, .89, .918, .944, .952, .975, .989, 1]
    ring = [-value for value in reversed(fractions[1:])] + fractions
    xs = []
    for (x0, _), (x1, _) in zip(stations, stations[1:]):
        steps = math.ceil((x1 - x0) / .14)
        xs.extend(x0 + (x1 - x0) * i / steps for i in range(steps))
    xs.append(stations[-1][0])
    vertices = [(x, bottom(x, width_at(x), ratio), width_at(x) * ratio) for x in xs for ratio in ring]
    faces, assignment = [], []
    width = len(ring)
    for index in range(len(xs) - 1):
        strip(faces, index * width, width, invert=True)
        for a, b in zip(ring, ring[1:]):
            ratio = abs((a + b) * .5)
            assignment.append(1 if .952 < ratio < .989 else 2 if .944 < ratio < .952 else 0)
    # Flat transom and bow cap have their own vertices to keep the molded edge.
    for end in (0, len(xs) - 1):
        x = xs[end]
        w = width_at(x)
        levels = [0, .69, .728, .92, 1]
        offset = len(vertices)
        for level in levels:
            for ratio in ring:
                y = bottom(x, w, ratio)
                vertices.append((x, y + (deck_y - y) * level, w * ratio))
        for row in range(len(levels) - 1):
            strip(faces, offset + row * width, width, invert=end != 0)
            assignment.extend([2 if row == 1 else 1 if row == 2 else 0] * (width - 1))
    mesh("Hull", vertices, faces, [ivory, blue, line], assignment)


def rounded_rect(x0, x1, half_width, radius, steps=6, taper=1):
    points = []
    corners = [(x1 - radius, half_width - radius, 0), (x0 + radius, half_width - radius, 90),
               (x0 + radius, -half_width + radius, 180), (x1 - radius, -half_width + radius, 270)]
    for x, z, start in corners:
        for segment in range(steps + 1):
            angle = math.radians(start + 90 * segment / steps)
            px = x + radius * math.cos(angle)
            pz = z + radius * math.sin(angle)
            points.append((px, pz * (1 - (1 - taper) * (px - x0) / (x1 - x0))))
    return points


def distance_on_ray(points, dx, dz):
    for (ax, az), (bx, bz) in zip(points, points[1:] + points[:1]):
        ax -= centre
        bx -= centre
        ex, ez = bx - ax, bz - az
        den = dx * ez - dz * ex
        if abs(den) < 1e-10:
            continue
        distance = (ax * ez - az * ex) / den
        ratio = (ax * dz - az * dx) / den
        if distance > 0 and -.00001 <= ratio <= 1.00001:
            return distance
    raise ValueError("Contour does not enclose the cockpit centre")


def build_deck():
    outline = stations + [(x, -width) for x, width in reversed(stations)]
    opening = rounded_rect(aft, fore, cockpit["halfWidth"], .055, taper=.82)
    angles = sorted({round(math.atan2(z, x - centre) % math.tau, 8) for x, z in outline + opening}
                    | {i * math.tau / 80 for i in range(80)})
    rings = []
    for angle in angles:
        dx, dz = math.cos(angle), math.sin(angle)
        inner = distance_on_ray(opening, dx, dz)
        outer = distance_on_ray(outline, dx, dz)
        rings.append((dx, dz, inner, outer))
    vertices = []
    # Small molded radius at the cockpit, with positive clearance for boot soles.
    layers = [
        (.970, .73, .0, floor_y), (.983, .84, .0, floor_y + .006),
        (.993, .94, .0, deck_y - .047), (1, 1, .0, deck_y - .017),
        (1, 1, .013, deck_y + .002), (1, 1, .037, deck_y + .008),
        (1, 1, .23, deck_y + .014), (1, 1, .70, deck_y + .014),
        (1, 1, .95, deck_y + .007), (1, 1, 1, deck_y),
    ]
    for length_scale, beam_scale, t, y in layers:
        for dx, dz, inner, outer in rings:
            between = (outer - inner) * t
            vertices.append((centre + dx * (inner * length_scale + between),
                             y, dz * (inner * beam_scale + between)))
    faces, assignment = [], []
    count = len(rings)
    for j in range(len(layers) - 1):
        strip(faces, j * count, count, closed=True)
        assignment.extend([0 if j == 0 else 1 if j >= 5 else 2] * count)
    vertices.append((centre, floor_y, 0))
    for i in range(count):
        faces.append((len(vertices) - 1, (i + 1) % count, i))
        assignment.append(0)
    mesh("Deck", vertices, faces, [floor, deck, ivory], assignment)


def patch_plane(name, shape, y, material):
    return mesh(name, [(x, y, z) for x, z in shape], [tuple(reversed(range(len(shape))))], [material], smooth=False)


def box(name, location, dimensions, material, bevel=.009):
    x, y, z = location
    w, h, d = dimensions
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -z, y))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (w, d, h)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    modifier = obj.modifiers.new("Soft edge", "BEVEL")
    modifier.width = bevel
    modifier.segments = 2
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    modifier = obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def oval(name, position, radii, material):
    x, y, z = position
    w, h, d = radii
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=7, location=(x, -z, y))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (w, d, h)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def combine(name, objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    return obj


def build_fittings():
    objects = []
    for side in (-1, 1):
        # Narrow anti-slip surface follows the shape of the side deck.
        contour = [(-1.40, .381), (-1.28, .365), (.21, .331), (.32, .375),
                   (.28, .512), (-.34, .529), (-1.20, .498), (-1.38, .460)]
        if side < 0:
            contour.reverse()
        objects.append(patch_plane("Non-slip rail", [(x, z * side) for x, z in contour], deck_y + .018, grip))
    for x in (crew_x - .803, crew_x + .803):
        objects.append(box("Hiking strap plate", (x, floor_y + .017, 0), (.105, .024, .145), alloy))
    xs = [crew_x - .823, crew_x - .755, crew_x - .675, crew_x + .675, crew_x + .755, crew_x + .823]
    ys = [floor_y + .026, .147, .182, .182, .147, floor_y + .026]
    vertices = [(x, y, z) for x, y in zip(xs, ys) for z in (-.072, .072)]
    faces = [(i, i + 1, i + 3, i + 2) for i in range(0, len(vertices) - 2, 2)]
    web = mesh("Hiking strap", vertices, faces, [strap])
    modifier = web.modifiers.new("Woven strap thickness", "SOLIDIFY")
    modifier.thickness = .008
    bpy.context.view_layer.objects.active = web
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    objects.append(web)
    objects.append(oval("Drain well", (aft + .23, floor_y + .004, -.13), (.083, .009, .052), rubber))
    for i in range(3):
        objects.append(box("Drain grate", (aft + .19 + i * .038, floor_y + .013, -.13), (.013, .010, .066), alloy, .003))
    objects.append(box("Mainsheet cleat base", (fore - .57, deck_y + .002, 0), (.17, .049, .11), rubber))
    return combine("Fittings", objects)


def build_vest():
    # Local origin is the midpoint of the hip-to-chest segment. Y is scaled
    # by that segment's length in Three.js. The underlayer fills the armholes.
    sections = [(-.49, .083, .061), (-.39, .154, .093), (-.16, .174, .108),
                (.12, .193, .119), (.29, .187, .113), (.45, .127, .083), (.53, .083, .062)]
    count = 24
    vertices = [(w * math.cos(i * math.tau / count), y, d * math.sin(i * math.tau / count))
                for y, w, d in sections for i in range(count)]
    faces = [tuple(range(count))]
    assignment = [0]
    for row in range(len(sections) - 1):
        strip(faces, row * count, count, closed=True, invert=True)
        assignment.extend([0 if row in (0, 5) else 1] * count)
    faces.append(tuple(reversed(range(len(vertices) - count, len(vertices)))))
    assignment.append(0)
    shell = mesh("PFD underlayer", vertices, faces, [webbing, vest_shell], assignment)
    objects = [shell]
    for side in (-1, 1):
        objects.append(oval("Front foam", (side * .090, .006, .094), (.092, .39, .057), vest_foam))
        objects.append(oval("Shoulder panel", (side * .10, .316, .041), (.046, .184, .071), vest_foam))
        objects.append(oval("Side foam", (side * .145, -.19, 0), (.045, .15, .102), vest_shell))
        objects.append(box("Reflective tab", (side * .102, .195, .14), (.062, .076, .012), patch, .006))
    objects.append(oval("Back foam panel", (0, .048, -.076), (.156, .43, .064), vest_foam))
    objects.append(box("Centre zip", (0, -.001, .13), (.017, .68, .035), zipper))
    objects.append(box("Zip pull", (.012, .253, .151), (.013, .049, .007), alloy, .003))
    return combine("Vest", objects)


build_shell()
build_deck()
build_fittings()
# Keep working pivots inspectable in Blender. The live rig owns their movement.
for name, (x, y, z) in {
    "Mast step": (boat["mastX"], deck_y, 0),
    "Rudder pivot": (boat["rudderX"], deck_y - .03, 0),
    "Strap centre": (crew_x, .182, 0),
    "Sheet lead": (fore - .57, deck_y + .023, 0),
}.items():
    marker = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(marker)
    marker.location = (x, -z, y)
    marker.empty_display_size = .075
build_vest()

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if args:
    bpy.ops.wm.save_as_mainfile(filepath=str(Path(args[0]).resolve()))
with tempfile.TemporaryDirectory() as directory:
    glb = Path(directory) / "laser.glb"
    bpy.ops.export_scene.gltf(filepath=str(glb), export_format="GLB", export_yup=True,
                              export_animations=False, export_materials="EXPORT")
    data = glb.read_bytes()
    if args:
        Path(args[0]).with_suffix(".glb").write_bytes(data)
asset = ROOT / "assets" / "laser-detail.glb.js"
asset.write_text("// Original TACK art. Generated by scripts/prepare-laser.py.\n"
                 "globalThis.TackLaserGlb='" + base64.b64encode(data).decode("ascii") + "';\n")
print(f"Embedded {len(data):,} bytes of Laser glTF in {asset.relative_to(ROOT)}")
